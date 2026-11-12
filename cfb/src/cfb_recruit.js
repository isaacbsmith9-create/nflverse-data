// ============================================================
// College Gridiron Dynasty - recruiting. Every recruit is a FICTIONAL,
// generated high-school player (real recruits are minors).
// Weekly hours budget, scholarship offers, NIL promises, visits,
// AI schools competing, commitments and National Signing Day.
// ============================================================
'use strict';

const RC_HOURS = 60, RC_MAX_HRS = 12, RC_BOARD = 35, RC_VISITS = 4;
const RC_STATES = [['TX', 14], ['FL', 12], ['CA', 10], ['GA', 9], ['OH', 4], ['LA', 4], ['AL', 4], ['NC', 3.5], ['PA', 3], ['VA', 3], ['TN', 3], ['MS', 2.5], ['SC', 2.5],
  ['MI', 2.5], ['IL', 2.5], ['NJ', 2], ['MD', 2], ['AZ', 2], ['WA', 1.5], ['AR', 1.5], ['MO', 1.5], ['OK', 1.5], ['IN', 1.5], ['NY', 1.3], ['KY', 1], ['UT', 1], ['NV', 1],
  ['OR', 1], ['CO', 1], ['MN', 1], ['WI', 1], ['KS', .7], ['MA', .7], ['IA', .8], ['NE', .5], ['HI', .6], ['CT', .5], ['DC', .5], ['WV', .4], ['NM', .4], ['ID', .3]];
const RC_PRIOS = { pres: 'Program prestige', pt: 'Playing time', prox: 'Close to home', nil: 'NIL', win: 'Title contender', coach: 'Coach stability' };
const STAR_TARGET_PRES = [0, 1.2, 1.7, 3.0, 4.6, 5.8];

function recruitAsk(r) { return [0, 0.005, 0.012, 0.035, 0.16, 0.55][r.stars] * (0.8 + Math.random() * 0.4); }
function genRecruitClass(L) {
  const N = Math.max(900, Math.round(L.teams.length * 13));
  const list = [];
  let id = (L.nextRid || 1);
  for (let i = 0; i < N; i++) {
    const stars = i < 32 ? 5 : i < 32 + 360 ? 4 : i < 32 + 360 + Math.round(N * 0.48) ? 3 : 2;
    const pos = weighted(POSITIONS, p => ROSTER_TARGET[p] * (p === 'K' || p === 'P' ? 0.5 : 1));
    const n = genName();
    const ovr = Math.round(clamp([0, 46, 53, 61, 68, 75][stars] + gauss(0, 3.5), 40, 84));
    const devR = Math.random(), dev = devR < [0, .01, .015, .03, .09, .3][stars] ? 'X' : devR < [0, .07, .09, .16, .32, .55][stars] ? 'S' : 'N';
    const pot = Math.round(clamp(ovr + [0, 12, 14, 16, 18, 21][stars] + gauss(0, 4.5) + (dev === 'X' ? 5 : dev === 'S' ? 2 : 0), ovr + 3, 99));
    const state = weighted(RC_STATES, s => s[1])[0];
    const pk = shuffle(Object.keys(RC_PRIOS)).slice(0, 2);
    const r = { id: id++, first: n.first, last: n.last, pos, stars, state, ovr, pot, dev, prio: pk, comp: stars * 20 + ovr * 0.6 + pot * 0.4 + gauss(0, 3),
      suit: {}, commit: -1, offers: {}, visit: 0, nil: 0, hrs: 0, weeks: 0 };
    r.ask = Math.round(recruitAsk(r) * 1000) / 1000;
    // initial suitors: schools at about the right level, with a regional lean
    const cands = L.teams.map(t => ({ t, w: Math.exp(-Math.pow(t.prestige - STAR_TARGET_PRES[stars], 2) / 1.6) * (0.6 + proximity(r.state, t.state) * 1.6) * (isP4(t) || stars < 4 ? 1 : 0.25) }));
    const k = randi(4, 7);
    for (let j = 0; j < k; j++) { const c = weighted(cands, x => x.w); if (c && r.suit[c.t.id] == null) { r.suit[c.t.id] = Math.round(rand(0, 160)); r.offers[c.t.id] = true; } }
    list.push(r);
  }
  list.sort((a, b) => b.comp - a.comp);
  const posRank = {};
  list.forEach((r, i) => { r.rank = i + 1; posRank[r.pos] = (posRank[r.pos] || 0) + 1; r.posRank = posRank[r.pos]; });
  L.nextRid = id;
  L.recruits = list; L.rboard = []; L.rWeekHrs = RC_HOURS;
  // class needs: open spots next year
  for (const t of L.teams) {
    const leaving = t.roster.filter(pid => { const p = L.players[pid]; return p.cls >= 4 || (p.cls === 3 && p.ovr >= 80); }).length;
    t.classNeed = clamp(leaving + Math.max(0, 78 - t.roster.length) + randi(-2, 2), 12, 30);
    t.nilPromised = 0;
  }
}
function recruitThreshold(r) { return [0, 380, 520, 760, 1050, 1400][r.stars]; }
function teamCommits(L, tid) { return L.recruits.filter(r => r.commit === tid).length; }
// per-week lookup tables so recruiting stays fast with ~1,800 recruits
function rcCtx(L) {
  const c = { commits: {}, cpos: {}, room: {} };
  for (const r of L.recruits) if (r.commit >= 0) { c.commits[r.commit] = (c.commits[r.commit] || 0) + 1; const k = r.commit + '|' + r.pos; c.cpos[k] = (c.cpos[k] || 0) + 1; }
  for (const t of L.teams) for (const id of t.roster) { const p = L.players[id]; if (p.cls >= 4) continue; (c.room[t.id + '|' + p.pos] = c.room[t.id + '|' + p.pos] || []).push(p.ovr); }
  return c;
}

// how well a school fits what a recruit cares about (0..1 each)
function recruitFit(L, r, t, ctx) {
  ctx = ctx || rcCtx(L);
  const sameRoom = (ctx.room[t.id + '|' + r.pos] || []).filter(o => o >= r.ovr - 2).length;
  const commits = ctx.cpos[t.id + '|' + r.pos] || 0;
  const f = {
    pres: t.prestige / 6,
    pt: clamp(1 - (sameRoom + commits - STARTERS[r.pos]) / (STARTERS[r.pos] + 3), 0.05, 1),
    prox: proximity(r.state, t.state),
    nil: t.id === L.userTid ? clamp((r.nil || 0) / Math.max(0.004, r.ask), 0, 1.3) : clamp(t.nilBudget / 22 + 0.15, 0.1, 1.1),
    win: t.rank ? clamp(1.05 - t.rank / 30, 0.2, 1) : clamp(pct(t) * 0.6 + t.prestige / 15, 0.1, 0.8),
    coach: clamp(0.35 + t.coachYrs * 0.1 + (t.id === L.userTid ? (L.security - 50) / 120 : -t.heat / 10), 0.1, 1),
  };
  return f;
}
function fitScore(L, r, t, ctx) {
  const f = recruitFit(L, r, t, ctx);
  const all = Object.values(f).reduce((a, b) => a + b, 0) / 6, pri = (f[r.prio[0]] + f[r.prio[1]]) / 2;
  return clamp(all * 0.4 + pri * 0.6, 0, 1.2);
}
function gradeLetter(v) { return v >= 0.9 ? 'A+' : v >= 0.8 ? 'A' : v >= 0.7 ? 'B+' : v >= 0.6 ? 'B' : v >= 0.5 ? 'C+' : v >= 0.4 ? 'C' : v >= 0.3 ? 'D' : 'F'; }

// one week of recruiting (called after each regular-season week and each postseason round)
function recruitWeek(L, wk) {
  if (!L.recruits || L.phase === 'recap') return;
  const u = L.userTid, U = L.teams[u];
  const last = L._lastUserGame;
  const ctx = rcCtx(L);
  const nCommits = tid => ctx.commits[tid] || 0;
  for (const r of L.recruits) {
    if (r.commit >= 0) continue;
    r.weeks++;
    for (const tid in r.suit) {
      const t = L.teams[tid]; if (+tid === u) continue;
      if (nCommits(+tid) >= t.classNeed) continue;
      const base = 10 + t.prestige * 8.5 + (t.rank ? Math.max(0, 26 - t.rank) * 1.1 : 0) + (t.coachRating - 70) * 0.35;
      r.suit[tid] += Math.round(base * (0.55 + fitScore(L, r, t, ctx) * 0.7) * rand(0.7, 1.3));
    }
    // user effort
    if (L.rboard.includes(r.id)) {
      const h = r.hrs || 0;
      if (h > 0) { r.suit[u] = (r.suit[u] || 0) + Math.round(h * 15 * (0.6 + fitScore(L, r, U, ctx) * 0.9)); }
      if (r.visit && last && last.week === r.visit && last.h === u && last.phase === 'regular') {
        const g = (L.schedule[r.visit - 1] || []).find(x => x.h === u);
        const won = g && g.hs > g.as;
        r.suit[u] = (r.suit[u] || 0) + 130 + (won ? 90 : 0) + (g && isRivalry(L, g.h, g.a) ? 40 : 0);
        r.visitDone = true; r.visit = 0;
      }
    }
    // new suitors trickle in for good players nobody has locked down
    if (chance(0.06)) { const t = weighted(L.teams, t => Math.exp(-Math.pow(t.prestige - STAR_TARGET_PRES[r.stars], 2)) * (0.5 + proximity(r.state, t.state))); if (t && t.id !== u && r.suit[t.id] == null) { r.suit[t.id] = 0; r.offers[t.id] = true; } }
    // commitment
    const arr = Object.entries(r.suit).map(([k, v]) => [+k, v]).filter(([k]) => r.offers[k]).sort((a, b) => b[1] - a[1]);
    if (!arr.length) continue;
    const [lead, pts] = arr[0], second = arr[1] ? arr[1][1] : 0;
    if (r.weeks >= 2 && pts >= recruitThreshold(r) && pts >= second * 1.22 && nCommits(lead) < L.teams[lead].classNeed + (lead === u ? 8 : 0)) {
      r.commit = lead; ctx.commits[lead] = nCommits(lead) + 1; const ck = lead + '|' + r.pos; ctx.cpos[ck] = (ctx.cpos[ck] || 0) + 1;
      if (lead === u) addNews(L, `✍️ COMMIT: ${starsStr(r.stars)} ${r.pos} ${r.first} ${r.last} (${r.state}) commits to ${U.city}!`);
      else if (r.stars === 5 || (L.rboard.includes(r.id) && r.suit[u] > 0)) addNews(L, `${starsStr(r.stars)} ${r.pos} ${r.first} ${r.last} commits to ${L.teams[lead].city}${L.rboard.includes(r.id) ? ' (he was on your board)' : ''}.`);
    }
  }
  // the user's hours reset weekly (allocations persist)
}
function interestPct(L, r, tid) {
  const tot = Object.entries(r.suit).filter(([k]) => r.offers[k]).reduce((s, [, v]) => s + Math.max(0, v), 0) || 1;
  return Math.round((r.suit[tid] || 0) / tot * 100);
}
function topSuitors(L, r, n = 3) {
  return Object.entries(r.suit).filter(([k]) => r.offers[k]).map(([k, v]) => [+k, v]).sort((a, b) => b[1] - a[1]).slice(0, n);
}
function userHoursUsed(L) { return L.recruits.filter(r => L.rboard.includes(r.id) && r.commit < 0).reduce((s, r) => s + (r.hrs || 0), 0); }

// ---------- National Signing Day ----------
function classScore(L, tid) {
  return L.recruits.filter(r => r.signed === tid).reduce((s, r) => s + [0, 6, 18, 45, 120, 300][r.stars] + r.ovr * 0.2, 0);
}
function signingDay(L) {
  const u = L.userTid;
  // uncommitted recruits pick the leader with room
  const ctx = rcCtx(L);
  for (const r of L.recruits) {
    if (r.commit >= 0) continue;
    for (const [tid] of topSuitors(L, r, 6)) {
      const t = L.teams[tid];
      if (tid === u ? (r.suit[u] || 0) >= recruitThreshold(r) * 0.55 : (ctx.commits[tid] || 0) < t.classNeed + 2) { r.commit = tid; ctx.commits[tid] = (ctx.commits[tid] || 0) + 1; break; }
    }
  }
  const signed = {};
  for (const r of L.recruits) {
    if (r.commit < 0) continue;
    const t = L.teams[r.commit];
    if (t.roster.length >= CFB_ROSTER_MAX) continue;
    const p = genCollegePlayer(L, r.pos, r.ovr, 1, { first: r.first, last: r.last, stars: r.stars, home: r.state, dev: r.dev, pot: r.pot,
      nil: r.commit === u ? (r.nil || Math.min(r.ask, 0.02)) : Math.round(r.ask * rand(0.6, 1.1) * 1000) / 1000 });
    p.recruitRank = r.rank; p.age = 18;
    teamAddPlayer(L, p, t.id); r.signed = t.id; r.pid = p.id;
    signed[t.id] = (signed[t.id] || 0) + 1;
  }
  // rank the classes
  const ranks = L.teams.map(t => ({ tid: t.id, score: classScore(L, t.id), n: signed[t.id] || 0 })).sort((a, b) => b.score - a.score);
  L.classRanks = ranks.slice(0, 25);
  const ur = ranks.findIndex(x => x.tid === u) + 1;
  addNews(L, `National Signing Day: ${L.teams[u].city} signs ${signed[u] || 0} recruits, the No. ${ur} class in the country. Top class: ${L.teams[ranks[0].tid].city}.`);
  L.lastClass = { season: L.season, rank: ur, n: signed[u] || 0, top: ranks[0].tid };
  // walk-ons fill every roster to a playable size
  for (const t of L.teams) {
    const n = fillPositions(L, t, true) + (t.id !== u ? fillPositions(L, t, false) : 0);
    while (t.roster.length < (t.id === u ? CFB_ROSTER_MIN : 72)) { const pos = weighted(POSITIONS, p => ROSTER_TARGET[p]); teamAddPlayer(L, walkOn(L, pos, 1), t.id); }
    if (t.id === u && n) addNews(L, `${n} preferred walk-ons join ${t.city} to fill out the depth chart.`);
    while (t.roster.length > CFB_ROSTER_MAX) cutWorstCfb(L, t);
    autoDepth(L, t);
  }
  L.recruits = []; L.rboard = [];
}
function cutWorstCfb(L, t) {
  const ps = t.roster.map(id => L.players[id]).filter(p => t.roster.filter(id => L.players[id].pos === p.pos).length > STARTERS[p.pos] + 1);
  ps.sort((a, b) => (a.ovr + a.pot * 0.3) - (b.ovr + b.pot * 0.3));
  if (ps[0]) { removeFromTeam(L, ps[0]); delete L.players[ps[0].id]; }
}
