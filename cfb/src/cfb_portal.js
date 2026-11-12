// ============================================================
// College Gridiron Dynasty - transfer portal + NIL retention.
// After the season players enter based on playing time, NIL pay vs.
// their estimated value, coaching changes and ambition. Schools bid
// with NIL over three portal days; players weigh money, playing time,
// prestige and home.
// ============================================================
'use strict';

function depthRank(L, p, t) { const d = t.depth[p.pos] || []; const i = d.indexOf(p.id); return i < 0 ? d.length : i; }
function portalChance(L, p, t) {
  const rank = depthRank(L, p, t), st = STARTERS[p.pos] + (['K', 'P'].includes(p.pos) ? 0 : 1);
  const est = nilValue(L, p), deal = p.con ? p.con.sal : 0;
  let c = 0.025;
  if (rank >= st && p.ovr >= 62) c += 0.1 + Math.min(0.12, (p.ovr - 62) * 0.008);
  if ((p.lastGp || 0) <= 3 && p.cls >= 2 && rank >= st) c += 0.06;
  const scale = t.nilScale || 1;
  if (est > 0.04 && deal < est * scale * 0.6) c += 0.08;
  if (t.coachChanged) c += 0.1;
  if (p.stars >= 4 && rank >= st) c += 0.06;
  if (rank < STARTERS[p.pos]) c -= 0.02;
  if (t.prestige <= 2 && p.ovr >= 76) c += 0.12; // G5 standouts get poached
  if (t.lastSeason && t.lastSeason.rank && t.lastSeason.rank <= 12) c -= 0.03;
  if (p.cls >= 4 && p.rs) c *= 0.7;
  return clamp(c, 0.005, 0.5);
}
function portalReason(L, p, t) {
  const rank = depthRank(L, p, t), st = STARTERS[p.pos];
  const est = nilValue(L, p), deal = p.con ? p.con.sal : 0;
  if (t.coachChanged) return 'Coaching change';
  if (est > 0.04 && deal < est * (t.nilScale || 1) * 0.6) return 'Wants more NIL';
  if (rank >= st) return 'Wants playing time';
  if (t.prestige <= 2 && p.ovr >= 76) return 'Wants a bigger stage';
  return 'Looking for a fresh start';
}
function retentionAsk(L, p) { return Math.round(Math.max(nilValue(L, p) * 1.15, (p.con ? p.con.sal : 0) * 1.3, 0.01) * 1000) / 1000; }
function portalAsk(L, p) { return Math.round(Math.max(0.005, nilValue(L, p) * rand(0.95, 1.25)) * 1000) / 1000; }

// open the portal window: departures leave, entries hit the pool
function startPortal(L) {
  processDepartures(L);
  const u = L.userTid, pool = [];
  const enter = (p, t, reason) => {
    removeFromTeam(L, p); p.tid = null; p.prevTid = t.id;
    p.portal = { ask: portalAsk(L, p), offers: {}, reason, day: 0 };
    pool.push(p.id);
  };
  for (const t of L.teams) {
    if (t.id === u) continue;
    for (const id of t.roster.slice()) { const p = L.players[id]; if (chance(portalChance(L, p, t))) enter(p, t, portalReason(L, p, t)); }
  }
  const U = L.teams[u];
  for (const x of L.departures.risk) { const p = L.players[x.id]; if (p && p.tid === u && !x.kept) { enter(p, U, x.reason); addNews(L, `${p.pos} ${pname(p)} (${clsLabel(p)}, ${p.ovr}) entered the transfer portal.`); } }
  for (const t of L.teams) autoDepth(L, t);
  L.portal = { day: 1, pool, moves: [] };
  L.phase = 'portal';
  aiPortalOffers(L); // rival schools make their first bids right away
  addNews(L, `The transfer portal is open: ${pool.length} players entered. You have 3 portal days to make NIL offers.`);
}

// how good a landing spot a school is for a portal player (0..1+)
function portalPT(L, p, t) {
  const better = t.roster.map(id => L.players[id]).filter(x => x.pos === p.pos && x.ovr >= p.ovr).length;
  return clamp(1 - better / (STARTERS[p.pos] + 1), 0, 1);
}
function portalOfferScore(L, p, tid, amt) {
  const t = L.teams[tid];
  return clamp(amt / Math.max(0.004, p.portal.ask), 0, 1.6) * 0.45 + t.prestige * 0.055 + portalPT(L, p, t) * 0.38 + proximity(p.home, t.state) * 0.09 + (t.rank ? 0.06 : 0);
}
function portalLeader(L, p) {
  let best = null;
  for (const k in p.portal.offers) { const s = portalOfferScore(L, p, +k, p.portal.offers[k]); if (!best || s > best.s) best = { tid: +k, s }; }
  return best;
}
function outstandingOffers(L, tid) {
  if (!L.portal) return 0;
  return L.portal.pool.reduce((s, id) => { const p = L.players[id]; return s + (p && p.tid == null && p.portal ? (p.portal.offers[tid] || 0) : 0); }, 0);
}
function portalRoom(L, tid) { return Math.round((capRoom(L, L.teams[tid]) - outstandingOffers(L, tid)) * 1000) / 1000; }

function aiPortalOffers(L) {
  const u = L.userTid;
  const avail = L.portal.pool.map(id => L.players[id]).filter(p => p && p.tid == null);
  const byPos = {}; for (const p of avail) (byPos[p.pos] = byPos[p.pos] || []).push(p);
  for (const k in byPos) byPos[k].sort((a, b) => b.ovr - a.ovr);
  for (const t of shuffle(L.teams.slice())) {
    if (t.id === u) continue;
    let room = portalRoom(L, t.id);
    const n = t.prestige >= 5 ? 3 : t.prestige >= 3 ? 2 : 1;
    const needs = POSITIONS.filter(pos => pos !== 'K' && pos !== 'P').map(pos => {
      const have = t.roster.map(id => L.players[id]).filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr);
      const st = have.slice(0, STARTERS[pos]); const avg = st.length ? st.reduce((s, p) => s + p.ovr, 0) / st.length : 40;
      return { pos, gap: Math.max(0, ROSTER_TARGET[pos] - have.length) * 3 + Math.max(0, 80 - avg) * 0.5, floor: st.length < STARTERS[pos] ? 0 : (have[STARTERS[pos] - 1] || { ovr: 0 }).ovr };
    }).sort((a, b) => b.gap - a.gap);
    let made = 0;
    for (const nd of needs) {
      if (made >= n) break;
      const cand = (byPos[nd.pos] || []).find(p => p.tid == null && p.portal.offers[t.id] == null && p.prevTid !== t.id && p.ovr >= nd.floor - 3 && p.ovr <= 60 + t.prestige * 6.5);
      if (!cand) continue;
      const amt = Math.round(Math.min(room * 0.6, cand.portal.ask * rand(0.8, 1.3) * (0.8 + t.prestige * 0.06)) * 1000) / 1000;
      if (amt < cand.portal.ask * 0.55) continue;
      cand.portal.offers[t.id] = amt; room -= amt; made++;
    }
  }
}
// a portal player commits; returns the new team id
function portalSign(L, p, tid, amt) {
  const t = L.teams[tid];
  p.con = { sal: amt, yrs: 1 }; const from = p.prevTid;
  teamAddPlayer(L, p, tid); fixDepth(L, t);
  L.portal.moves.push({ id: p.id, name: pname(p), pos: p.pos, ovr: p.ovr, from, to: tid, amt });
  delete p.portal;
  if (tid === L.userTid) addNews(L, `🔁 TRANSFER: ${p.pos} ${pname(p)} (${p.ovr} OVR, from ${L.teams[from] ? L.teams[from].city : '?'}) commits to ${t.city} for ${fmtNil(amt)}.`);
  else if (from === L.userTid) addNews(L, `${p.pos} ${pname(p)} transferred from ${L.teams[from].city} to ${t.city}.`);
  else if (p.ovr >= 84) addNews(L, `Portal: ${p.pos} ${pname(p)} (${p.ovr}) leaves ${L.teams[from] ? L.teams[from].city : '?'} for ${t.city}.`);
}
function portalDecisions(L, final) {
  const day = L.portal.day, bar = final ? 0 : day === 1 ? 1.02 : 0.86;
  for (const id of L.portal.pool) {
    const p = L.players[id]; if (!p || p.tid != null || !p.portal) continue;
    const best = portalLeader(L, p); if (!best) continue;
    if (best.s >= bar + gauss(0, 0.05) && L.teams[best.tid].roster.length < CFB_ROSTER_MAX) portalSign(L, p, best.tid, p.portal.offers[best.tid]);
  }
}
function portalAdvance(L) {
  aiPortalOffers(L);
  portalDecisions(L, false);
  recruitWeek(L, 'portal');
  L.portal.day++;
  if (L.portal.day > 3) finishPortal(L);
}
function finishPortal(L) {
  aiPortalOffers(L);
  portalDecisions(L, true);
  // nobody bid: some find a smaller school, the rest leave FBS
  for (const id of L.portal.pool) {
    const p = L.players[id]; if (!p || p.tid != null) continue;
    if (chance(0.45)) {
      const t = weighted(L.teams.filter(t => t.id !== L.userTid && t.id !== p.prevTid && t.roster.length < 80), t => (7 - t.prestige) * (1 + proximity(p.home, t.state)));
      if (t) { portalSign(L, p, t.id, Math.round(nilValue(L, p) * 0.5 * 1000) / 1000); continue; }
    }
    delete L.players[id];
  }
  for (const t of L.teams) autoDepth(L, t);
  const mine = L.portal.moves.filter(m => m.to === L.userTid).length, lost = L.portal.moves.filter(m => m.from === L.userTid).length;
  addNews(L, `The portal window closed: ${L.portal.moves.length} transfers. ${L.teams[L.userTid].city} added ${mine} and lost ${lost} to other schools.`);
  L.portalLog = { season: L.season, moves: L.portal.moves.slice(0, 400) };
  signingDay(L);
  L.phase = 'signing';
}
function userPortalOffer(L, p, amt) {
  const u = L.userTid, U = L.teams[u];
  if (U.roster.length >= CFB_ROSTER_MAX) return 'Your roster is full (85).';
  const room = portalRoom(L, u) + (p.portal.offers[u] || 0);
  if (amt > room + 1e-6) return `You only have ${fmtNil(Math.max(0, room))} of NIL room for portal offers.`;
  if (amt < p.portal.ask * 0.45) return `${p.first} won't even listen to less than ${fmtNil(p.portal.ask * 0.45)}.`;
  p.portal.offers[u] = Math.round(amt * 1000) / 1000;
  return null;
}
