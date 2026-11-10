// ============================================================
// Gridiron Dynasty - league moves: trade finder, CPU-to-CPU trades,
// free-agent contract negotiation
// ============================================================
'use strict';

const sideValue = (L, side) => side.players.reduce((s, id) => s + playerValue(L.players[id]), 0) + side.picks.reduce((s, pk) => s + pickValue(L, pk), 0);

// What would each team give for the package the user is offering?
function findOffers(L, give, maxOffers = 8) {
  const want = sideValue(L, give);
  if (want <= 0) return [];
  const offers = [];
  const givePos = new Set(give.players.map(id => L.players[id].pos));
  for (const t of L.teams) {
    if (t.id === L.userTid) continue;
    const budget = want / 1.1; // they need to win the deal by ~10%
    // their tradeable assets: skip their single best starter at each position the user isn't sending
    const assets = t.roster.map(id => L.players[id]).filter(p => !p.ir && p.ovr >= 55)
      .map(p => ({ kind: 'player', id: p.id, v: playerValue(p), p }))
      .concat(L.picks.filter(pk => pk.owner === t.id).map(pk => ({ kind: 'pick', pk, v: pickValue(L, pk) })))
      .filter(a => a.v <= budget * 1.02 && a.v > budget * 0.08)
      .sort((a, b) => b.v - a.v);
    // need: favour giving players at positions where they're deep
    const pkg = { players: [], picks: [] }; let tot = 0;
    for (const a of assets) {
      if (tot + a.v > budget * 1.02) continue;
      if (a.kind === 'player' && givePos.has(a.p.pos) && chance(0.5)) continue;
      if (a.kind === 'player') pkg.players.push(a.id); else pkg.picks.push(a.pk);
      tot += a.v;
      if (tot >= budget * 0.8 || pkg.players.length + pkg.picks.length >= 3) break;
    }
    if (!pkg.players.length && !pkg.picks.length) continue;
    const ev = tradeEval(L, t.id, give, pkg);
    if (!ev.ok) continue;
    offers.push({ tid: t.id, get: pkg, value: sideValue(L, pkg) });
  }
  return offers.sort((a, b) => b.value - a.value).slice(0, maxOffers);
}

// occasional CPU-to-CPU trades before the deadline
function aiTradeWeek(L) {
  if (L.phase !== 'regular' || L.week > 10 || !chance(0.35)) return;
  const teams = shuffle(L.teams.filter(t => t.id !== L.userTid).slice());
  for (let attempt = 0; attempt < 6; attempt++) {
    const A = teams[attempt * 2 % teams.length], B = teams[(attempt * 2 + 1) % teams.length];
    // A targets a starter-level player at its weakest position
    const pos = POSITIONS.filter(p => p !== 'K' && p !== 'P').sort((x, y) => needScore(L, A, y) - needScore(L, A, x))[0];
    const target = B.roster.map(id => L.players[id]).filter(p => p.pos === pos && !p.ir && p.ovr >= 72).sort((a, b) => b.ovr - a.ovr)[1]; // B keeps its best
    if (!target) continue;
    const need = playerValue(target) * 1.1;
    const pool = A.roster.map(id => L.players[id]).filter(p => p.pos !== pos && !p.ir)
      .map(p => ({ kind: 'player', id: p.id, v: playerValue(p) }))
      .concat(L.picks.filter(pk => pk.owner === A.id).map(pk => ({ kind: 'pick', pk, v: pickValue(L, pk) })))
      .sort((a, b) => b.v - a.v);
    const pkg = { players: [], picks: [] }; let tot = 0;
    for (const a of pool) { if (tot >= need) break; if (a.v > need * 1.3) continue; if (a.kind === 'player') pkg.players.push(a.id); else pkg.picks.push(a.pk); tot += a.v; if (pkg.players.length + pkg.picks.length >= 3) break; }
    if (tot < need || tot > need * 1.5) continue;
    const salIn = playerValue && target.con.sal, salOut = pkg.players.reduce((s, id) => s + L.players[id].con.sal, 0);
    if (capRoom(L, A) + salOut - salIn < 0 || capRoom(L, B) + salIn - salOut < 0) continue;
    for (const id of pkg.players) { const p = L.players[id]; removeFromTeam(L, p); addToTeam(L, p, B.id); }
    removeFromTeam(L, target); addToTeam(L, target, A.id);
    for (const pk of pkg.picks) pk.owner = B.id;
    const names = pkg.players.map(id => `${L.players[id].pos} ${pshort(L.players[id])}`).concat(pkg.picks.map(pk => pickLabel(L, pk))).join(', ');
    addNews(L, `TRADE: ${A.abbr} acquire ${target.pos} ${pname(target)} (${target.ovr}) from ${B.abbr} for ${names}.`);
    autoDepth(L, A); autoDepth(L, B);
    return;
  }
}

// ---------- free-agent negotiation ----------
// interest: how much a player likes your team (winning + playing time)
function faInterest(L, p, tid) {
  const t = L.teams[tid];
  const win = (t.w + t.l) ? pct(t) : 0.5;
  const depth = t.roster.map(id => L.players[id]).filter(x => x.pos === p.pos && x.ovr > p.ovr).length;
  const playing = depth < STARTERS[p.pos] ? 1 : depth < STARTERS[p.pos] + 2 ? 0.6 : 0.3;
  return clamp(0.35 + win * 0.35 + playing * 0.3, 0, 1);
}
function faRivals(L, p) {
  if (L.phase !== 'fa') return 0;
  return L.teams.filter(t => t.id !== L.userTid && capRoom(L, t) > faAsk(p) && needScore(L, t, p.pos) > 8).length;
}
// returns { ok, msg }
function negotiate(L, p, sal, yrs) {
  const ask = faAsk(p);
  p.neg = p.neg || { tries: 0, mood: 1 };
  if (p.neg.tries >= 3 && p.neg.mood <= 0.5) return { ok: false, msg: `${pshort(p)} has stopped taking your calls.` };
  p.neg.tries++;
  const interest = faInterest(L, p, L.userTid);
  // longer deals: young players like security, vets want shorter if old
  const yrPref = p.age >= 31 ? (yrs <= 2 ? 1.03 : 0.95) : (yrs >= 3 ? 1.04 : 0.98);
  const ratio = sal / ask * yrPref * (0.9 + interest * 0.2) * (p.neg.mood);
  const rivals = faRivals(L, p);
  const need = 1 + Math.min(0.12, rivals * 0.02);
  if (ratio >= need) return { ok: true, msg: `${pname(p)} accepted!` };
  if (ratio >= need * 0.9) { p.neg.mood = Math.max(0.6, p.neg.mood - 0.08); return { ok: false, msg: `Close. ${pshort(p)}'s agent wants a bit more${rivals ? ` — ${rivals} other team${rivals > 1 ? 's are' : ' is'} interested` : ''}.` }; }
  p.neg.mood = Math.max(0.45, p.neg.mood - 0.2);
  return { ok: false, msg: `${pshort(p)} found that offer insulting. Asking: ${fmtMoney(ask)}/yr.` };
}
