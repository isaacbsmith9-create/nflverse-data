// ============================================================
// College Gridiron Dynasty - offseason: redshirts and class years,
// graduation, NFL early entries, coach carousel / hot seat, your job
// security and job offers, program prestige, progression, new season.
// Flow: recap -> departures -> portal -> signing -> next season
// ============================================================
'use strict';

const _phaseLabelC = phaseLabel;
phaseLabel = function (ph, wk) {
  return { regular: 'Week ' + wk, playoffs: 'Postseason', recap: 'Season recap', departures: 'Offseason: departures', portal: 'Transfer portal', signing: 'Signing Day' }[ph] || _phaseLabelC(ph, wk);
};

function expectedWins(t) { return 3 + t.prestige * 1.2; }

// ---------- end of season -> departures ----------
beginOffseason = function (L) {
  if (!L.cfb) return;
  const u = L.userTid;
  seasonReview(L);
  // classes advance; players who saw 4 or fewer games keep a year (redshirt)
  const grads = [], nfl = [], risk = [];
  for (const p of Object.values(L.players)) {
    if (p.tid == null || p.tid < 0) continue;
    const gp = p.lastGp || 0;
    p.prevCls = p.cls;
    if (!p.rs && gp <= 4) { p.rs = 1; p.redshirted = L.season; }
    else p.cls++;
    p.rsPlan = false; p.inj = 0; p.ir = false;
    if (p.cls > 4) { grads.push(p.id); continue; }
    const yrs = (p.cls - 1) + p.rs; // seasons completed since high school
    if (yrs >= 3) nfl.push({ id: p.id, round: 8 });
  }
  // draft projections against this year's eligible pool; grades use the shared cut lines
  computeDraftCuts(L, 3); const _prev = LEAGUE; LEAGUE = L;
  for (const x of nfl) x.round = draftGrade(L.players[x.id]);
  const keepNfl = nfl.filter(x => chance([0, 0.95, 0.8, 0.55, 0.32, 0.16, 0.07, 0.03, 0.005][x.round]));
  LEAGUE = _prev;
  nfl.length = 0; nfl.push(...keepNfl);
  L.departures = { grads, nfl, risk: [], kept: [] };
  // who on your team is thinking about the portal
  const U = L.teams[u], leaving = new Set(grads.concat(nfl.map(x => x.id)));
  for (const id of U.roster) {
    if (leaving.has(id)) continue;
    const p = L.players[id], pr = portalChance(L, p, U);
    if (chance(pr)) L.departures.risk.push({ id, reason: portalReason(L, p, U), ask: retentionAsk(L, p) });
  }
  L.phase = 'departures';
  const nG = grads.filter(id => L.players[id].tid === u).length, nN = nfl.filter(x => L.players[x.id].tid === u).length;
  addNews(L, `Offseason: ${nG} senior${nG === 1 ? '' : 's'} graduate and ${nN} player${nN === 1 ? '' : 's'} declared for the NFL Draft. ${L.departures.risk.length} more are thinking about the transfer portal.`);
};

function seasonReview(L) {
  const u = L.userTid;
  // program prestige drifts with results
  for (const t of L.teams) {
    t.pp = t.pp == null ? t.prestige : t.pp;
    const r = t.rank;
    let d = r && r <= 5 ? 0.45 : r && r <= 12 ? 0.28 : r ? 0.12 : t.w >= t.l ? -0.02 : t.w <= 3 ? -0.32 : -0.15;
    if (L.history[0] && L.history[0].season === L.season && L.history[0].champ === t.id) d += 0.5;
    t.pp = clamp(t.pp + d, 0.6, 6.4);
    const np = clamp(Math.round(t.pp), 1, 6);
    if (np !== t.prestige && t.id === u) addNews(L, np > t.prestige ? `📈 ${t.city}'s program prestige rises to ${np} stars.` : `📉 ${t.city}'s program prestige slips to ${np} stars.`);
    t.prestige = np;
    t.lastSeason = { w: t.w, l: t.l, rank: t.rank };
  }
  coachCarousel(L);
}

// ---------- coach carousel ----------
function coachCarousel(L) {
  const u = L.userTid, openings = [];
  const champ = L.history[0] && L.history[0].season === L.season ? L.history[0].champ : -1;
  for (const t of L.teams) {
    t.coachChanged = false; t.coachYrs++;
    const diff = t.w - expectedWins(t);
    if (t.id === u) {
      let d = diff * 7 + (t.id === champ ? 30 : 0) + ((L.playoffs && L.playoffs.seeds || []).includes(t.id) ? 10 : 0);
      if (Object.values((L.playoffs && L.playoffs.champs) || {}).includes(t.id)) d += 8;
      const prev = L.security; L.security = Math.round(clamp(L.security + d, 0, 100));
      if (L.season === L.startSeason) L.security = Math.max(L.security, 18); // first-year grace
      L.securityDelta = L.security - prev;
      continue;
    }
    t.heat = (t.heat || 0) * 0.55 - diff * 0.9;
    const fire = (t.heat >= 3.2 && t.coachYrs >= 3) || t.heat >= 5.5;
    const retire = !fire && t.coachYrs >= 9 && chance(0.05);
    if (fire || retire) { openings.push(t.id); addNews(L, fire ? `🔥 ${t.city} fires head coach ${t.coach} after ${t.w}-${t.l}.` : `${t.city} head coach ${t.coach} retires.`); }
  }
  // hot coaches move up
  openings.sort((a, b) => L.teams[b].prestige - L.teams[a].prestige);
  const filled = [];
  for (const tid of openings) {
    const t = L.teams[tid];
    const cands = L.teams.filter(c => c.id !== u && c.id !== tid && !openings.includes(c.id) && !filled.includes(c.id) && c.prestige < t.prestige && c.w - expectedWins(c) >= 2 && c.coachYrs >= 2);
    const hire = cands.sort((a, b) => (b.w - expectedWins(b)) - (a.w - expectedWins(a)))[0];
    if (hire && chance(0.7)) {
      addNews(L, `🚨 ${t.city} hires ${hire.coach} away from ${hire.city}.`);
      t.coach = hire.coach; t.coachRating = Math.min(95, hire.coachRating + 2);
      initCoach(hire); hire.coachChanged = true; hire.coachYrs = 0; filled.push(hire.id);
      addNews(L, `${hire.city} names ${hire.coach} its new head coach.`);
    } else { initCoach(t); t.coachRating = Math.round(clamp(55 + t.prestige * 4 + gauss(0, 6), 45, 88)); addNews(L, `${t.city} names ${t.coach} its new head coach.`); }
    t.coachYrs = 0; t.heat = 0; t.coachChanged = true;
  }
  // your job: fired, or offers from programs with openings
  const U = L.teams[u];
  const open = openings.concat(filled).filter(id => id !== u);
  L.jobOffers = [];
  if (L.security <= 0) {
    L.fired = true;
    const pool = L.teams.filter(t => t.id !== u && t.prestige <= Math.max(2, U.prestige - 1)).sort((a, b) => b.prestige - a.prestige + gauss(0, 1));
    L.jobOffers = (open.filter(id => L.teams[id].prestige < U.prestige || L.teams[id].prestige <= 2).concat(pool.map(t => t.id))).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
    addNews(L, `❌ ${U.city} has fired you. Pick a new job to keep your career going.`);
  } else if (U.w - expectedWins(U) >= 1.5 || (L.playoffs && (L.playoffs.seeds || []).includes(u))) {
    L.jobOffers = open.filter(id => L.teams[id].prestige > U.prestige || (L.teams[id].prestige === U.prestige && isP4(L.teams[id]) && !isP4(U))).slice(0, 3);
    if (L.jobOffers.length) addNews(L, `📞 ${L.jobOffers.length} program${L.jobOffers.length > 1 ? 's want' : ' wants'} to interview you: ${L.jobOffers.map(id => L.teams[id].city).join(', ')}.`);
  }
}
function takeJob(L, tid) {
  const old = L.teams[L.userTid], t = L.teams[tid];
  initCoach(old); old.coachChanged = true; old.coachYrs = 0;
  addNews(L, `🧢 You are the new head coach at ${t.city}! ${old.city} hires ${old.coach}.`);
  L.userTid = tid; t.coach = coachName(L); t.coachYrs = 0; t.coachChanged = true;
  L.security = 62; L.fired = false; L.jobOffers = []; L.rboard = [];
  for (const r of L.recruits || []) { r.hrs = 0; r.visit = 0; r.nil = 0; }
  if (L.departures) { // re-roll the portal-risk list for the new roster
    const leaving = new Set(L.departures.grads.concat(L.departures.nfl.map(x => x.id)));
    L.departures.risk = t.roster.filter(id => !leaving.has(id)).map(id => L.players[id]).filter(p => chance(portalChance(L, p, t))).map(p => ({ id: p.id, reason: portalReason(L, p, t), ask: retentionAsk(L, p) }));
  }
}

// ---------- departures -> portal ----------
function processDepartures(L) {
  const D = L.departures, u = L.userTid;
  const _prevL = LEAGUE; LEAGUE = L;
  const draft = [];
  const gone = new Set(D.grads);
  for (const x of D.nfl) if (!D.kept.includes(x.id)) gone.add(x.id);
  // the actual draft: departing players in order of draft grade, ~36-37 picks a round
  const order = [...gone].map(id => L.players[id]).filter(Boolean).sort((a, b) => draftScore(b) - draftScore(a));
  order.forEach((p, i) => { const proj = draftGrade(p); p._round = i < 257 && proj <= 7 ? Math.min(7, Math.floor(i / 36.7) + 1) : 0; });
  for (const p of order) {
    const id = p.id, t = L.teams[p.tid];
    const declared = D.nfl.find(x => x.id === id);
    const round = p._round; delete p._round;
    if (round || declared) {
      draft.push({ name: pname(p), pos: p.pos, tid: p.tid, round, early: !!declared });
      if (round) t.nflPicks = (t.nflPicks || 0) + 1;
    }
    archivePlayer(L, p, round);
    removeFromTeam(L, p); delete L.players[id];
  }
  draft.sort((a, b) => (a.round || 9) - (b.round || 9));
  LEAGUE = _prevL;
  L.nflDraft.unshift({ season: L.season + 1, picks: draft.filter(d => d.round) });
  if (L.nflDraft.length > 8) L.nflDraft.length = 8;
  const mine = draft.filter(d => d.tid === u && d.round);
  if (mine.length) addNews(L, `NFL Draft: ${mine.length} ${L.teams[u].city} player${mine.length > 1 ? 's' : ''} drafted${mine[0].round === 1 ? `, led by first-rounder ${mine[0].name}` : ''}.`);
  const r1 = draft.filter(d => d.round === 1).length; if (r1) addNews(L, `${r1} college players went in the first round of the NFL Draft. ${L.teams[draft[0].tid].city}'s ${draft[0].name} went first.`);
}

// ---------- Ring of Honor archive ----------
function archivePlayer(L, p, round) {
  L.retired = L.retired || [];
  const tot = careerTotals(p.career), seasons = (p.career || []).length;
  if (!seasons) return;
  const score = hofScore(p, tot) * 1.6 + (round ? (8 - round) * 6 : 0);
  const aw = (p.awards || []).map(a => typeof a === 'string' ? a : '');
  const heis = aw.some(a => /^Heisman/.test(a));
  const ring = heis || (p.allPros || 0) >= 2 || score >= 210 || (round === 1 && score >= 120);
  const teams = [...new Set((p.career || []).map(c => c.tm).filter(Boolean))];
  L.retired.push({ id: p.id, name: pname(p), pos: p.pos, num: p.num, teams, seasons, tot, career: p.career, awards: aw, allPros: p.allPros || 0, hof: ring, year: L.season, score: Math.round(score), round });
  if (ring && teams.includes(L.teams[L.userTid].abbr)) addNews(L, `🏛 ${p.pos} ${pname(p)} enters the ${L.teams[L.userTid].city} Ring of Honor.`);
  L.retired.sort((a, b) => (b.hof - a.hof) || b.score - a.score);
  if (L.retired.length > 420) L.retired = L.retired.filter((r, i) => r.hof || i < 360);
}

// ---------- progression (college players grow fast) ----------
function cfbProgress(p, t) {
  const done = p.prevCls || p.cls; // the class he just finished
  const base = [0, 7.6, 5.9, 4.3, 2.7][clamp(done, 1, 4)];
  const devB = p.dev === 'X' ? 2.2 : p.dev === 'S' ? 1.1 : 0;
  const coachB = t ? (t.coachRating - 70) / 30 : 0;
  let delta = gauss(base + devB + coachB, 2.1);
  if (p.ovr + delta > p.pot && delta > 0) delta = Math.max(0, p.pot - p.ovr) + gauss(0, 0.8);
  const w = OVR_W[p.pos];
  for (const k of RATING_KEYS) {
    const d = w[k] !== undefined ? delta + gauss(0, 1.4) : delta * 0.45 + gauss(0, 1);
    p.r[k] = Math.round(clamp(p.r[k] + d, 15, 99));
  }
  const prev = p.ovr; p.ovr = calcOvr(p); p.lastProg = p.ovr - prev; if (p.pot < p.ovr) p.pot = p.ovr;
  p.age++;
}

startNewSeason = function (L) {
  if (!L.cfb) return;
  const u = L.userTid;
  for (const id in L.players) { const p = L.players[id]; if (p.tid == null || p.tid < 0) delete L.players[id]; }
  for (const p of Object.values(L.players)) {
    if (p.prevCls != null) cfbProgress(p, L.teams[p.tid]);
    p.prevCls = null; p.seasonProg = 0; p.inj = 0; p.ir = false; p.st = {}; p.lastGp = 0;
  }
  L.season++;
  for (const t of L.teams) {
    t.w = t.l = t.t = t.pf = t.pa = t.cw = t.cl = 0; t.rank = 0; t.nilPromised = 0;
    t.nilBudget = Math.round(nilBudgetFor(t) * (1 + clamp((t.lastSeason ? t.lastSeason.w : 6) - 6, -4, 6) * 0.025) * 10) / 10;
    if (t.id !== u) while (t.roster.length > CFB_ROSTER_MAX) cutWorstCfb(L, t);
    // AI schools trim deals that blow the budget
    if (t.id !== u && payroll(L, t) > t.nilBudget) { const f = t.nilBudget * 0.95 / payroll(L, t); for (const id of t.roster) L.players[id].con.sal = Math.round(L.players[id].con.sal * f * 1000) / 1000; }
    autoDepth(L, t);
  }
  const U = L.teams[u]; fixDepth(L, U);
  L.week = 1; L.phase = 'regular'; L.playoffs = null; L.heisman = null; L.departures = null; L.portal = null; L.draft = null; L.jobOffers = []; L.securityDelta = null;
  L.schedule = makeCfbSchedule(L); L.realSchedule = false;
  for (const t of L.teams) t.elo = t.elo * 0.45 + preseasonElo(L, t) * 0.55;
  L.poll = []; updatePoll(L, true); L._lastRank = {};
  genRecruitClass(L);
  computeDraftCuts(L);
  L.scoutPts = SCOUT_BUDGET; L.board = [];
  const over = payroll(L, U) - U.nilBudget;
  addNews(L, `The ${L.season} season begins! ${U.city} is ${U.rank ? 'ranked #' + U.rank + ' in the preseason poll' : 'unranked in the preseason poll'}. NIL budget ${fmtNil(U.nilBudget)}${over > 0 ? ` — you're ${fmtNil(over)} over, trim deals on the NIL tab` : ''}.`);
};
