// ============================================================
// College Gridiron Dynasty - season: generated 12-game schedules,
// rivalry week, Top 25 poll (Elo + record), conference title games,
// 12-team College Football Playoff, bowls, Heisman + awards
// ============================================================
'use strict';

// rivalry pairs by school name (labels only; generated schedules put same-conference rivals in the last week)
const RIVALS = [
  ['Ohio State', 'Michigan'], ['Alabama', 'Auburn'], ['Georgia', 'Georgia Tech'], ['Florida', 'Florida State'], ['Clemson', 'South Carolina'],
  ['Texas', 'Texas A&M'], ['Texas', 'Oklahoma'], ['Georgia', 'Florida'], ['Auburn', 'Georgia'], ['Alabama', 'Tennessee'], ['Alabama', 'LSU'],
  ['Ole Miss', 'Mississippi State'], ['Kentucky', 'Louisville'], ['Iowa', 'Iowa State'], ['USC', 'UCLA'], ['USC', 'Notre Dame'], ['Army', 'Navy'],
  ['Oregon', 'Oregon State'], ['Washington', 'Washington State'], ['Arizona', 'Arizona State'], ['Utah', 'BYU'], ['Michigan', 'Michigan State'],
  ['Minnesota', 'Wisconsin'], ['Indiana', 'Purdue'], ['California', 'Stanford'], ['Kansas', 'Kansas State'], ['Virginia', 'Virginia Tech'],
  ['North Carolina', 'NC State'], ['Miami', 'Florida State'], ['Pittsburgh', 'West Virginia'], ['Oklahoma', 'Oklahoma State'], ['Baylor', 'TCU'],
  ['Colorado', 'Colorado State'], ['Penn State', 'Pittsburgh'], ['Tennessee', 'Vanderbilt'], ['LSU', 'Arkansas'], ['Missouri', 'Kansas'],
  ['Nebraska', 'Iowa'], ['Illinois', 'Northwestern'], ['Boise State', 'Fresno State'], ['Houston', 'Rice'], ['Memphis', 'Tulane'],
  ['Cincinnati', 'Louisville'], ['Air Force', 'Army'], ['Air Force', 'Navy'], ['Duke', 'North Carolina'], ['Wake Forest', 'NC State'],
  ['UCF', 'South Florida'], ['Toledo', 'Bowling Green'], ['Miami (OH)', 'Ohio'], ['Appalachian State', 'Georgia Southern'], ['Hawai\'i', 'Wyoming'],
  ['Texas Tech', 'Texas'], ['SMU', 'TCU'], ['Arkansas', 'Texas A&M'], ['Maryland', 'Penn State'], ['Rutgers', 'Maryland'], ['Boston College', 'Syracuse'],
];
const NEUTRAL_RIVALS = [['Texas', 'Oklahoma'], ['Georgia', 'Florida'], ['Army', 'Navy']];
function _sch(L, school) { return L.teams.find(t => t.city === school); }
function isRivalry(L, a, b) {
  const A = L.teams[a].city, B = L.teams[b].city;
  return RIVALS.some(([x, y]) => (x === A && y === B) || (x === B && y === A));
}

// ---------- generated schedule: conference round robin + non-conference fill ----------
function makeCfbSchedule(L) {
  let best = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const s = tryCfbSchedule(L);
    const short = L.teams.reduce((n, t) => n + Math.max(0, 12 - s.count[t.id]), 0);
    if (!best || short < best.short) best = { weeks: s.weeks, short };
    if (short <= 2) break;
  }
  return best.weeks;
}
function tryCfbSchedule(L) {
  const W = 14, weeks = Array.from({ length: W }, () => []);
  const busy = Array.from({ length: W }, () => new Set());
  const count = {}; L.teams.forEach(t => count[t.id] = 0);
  const met = new Set(), key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  const homeN = {}; L.teams.forEach(t => homeN[t.id] = 0);
  const add = (w, a, b, n) => {
    const aHome = homeN[a] < homeN[b] || (homeN[a] === homeN[b] && chance(0.5));
    const g = { h: aHome ? a : b, a: aHome ? b : a, hs: null, as: null, n: n ? 1 : 0 };
    weeks[w].push(g); busy[w].add(a); busy[w].add(b); count[a]++; count[b]++; met.add(key(a, b)); homeN[g.h]++;
  };
  // conference games: circle method; rivals paired in round 0, which is played in the final week
  for (const conf of L.confs) {
    if (conf === 'Ind') continue;
    let ids = shuffle(L.teams.filter(t => t.conf === conf).map(t => t.id));
    const pairs = [];
    for (const [x, y] of RIVALS) { const A = _sch(L, x), B = _sch(L, y); if (A && B && A.conf === conf && B.conf === conf && !pairs.some(p => p.includes(A.id) || p.includes(B.id))) pairs.push([A.id, B.id]); }
    if (ids.length % 2) ids.push(-1);
    const n = ids.length, rest = ids.filter(id => !pairs.some(p => p.includes(id)));
    const order = new Array(n);
    pairs.forEach(([a, b], i) => { order[i] = a; order[n - 1 - i] = b; });
    let k = 0; for (let i = 0; i < n; i++) if (order[i] == null) order[i] = rest[k++];
    const rounds = [];
    let arr = order.slice();
    for (let r = 0; r < n - 1; r++) {
      const rd = []; for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; if (a >= 0 && b >= 0) rd.push([a, b]); }
      rounds.push(rd);
      arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
    }
    const want = Math.min(CONF_GAMES[conf] || 8, rounds.length);
    const use = [rounds[0], ...shuffle(rounds.slice(1)).slice(0, want - 1)];
    // weeks: rivalry round in week 14, others spread over weeks 4-13
    const slots = shuffle([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, use.length - 1).sort((a, b) => a - b);
    use.forEach((rd, i) => { const w = i === 0 ? W - 1 : slots[i - 1]; for (const [a, b] of rd) add(w, a, b); });
  }
  // cross-conference rivals in the last week when both are free
  for (const [x, y] of RIVALS) {
    const A = _sch(L, x), B = _sch(L, y); if (!A || !B || A.conf === B.conf) continue;
    if (met.has(key(A.id, B.id))) continue;
    const w = W - 1; if (!busy[w].has(A.id) && !busy[w].has(B.id) && count[A.id] < 12 && count[B.id] < 12) add(w, A.id, B.id, NEUTRAL_RIVALS.some(p => p.includes(x) && p.includes(y)));
  }
  // neutral-site / marquee rivals that are in-conference keep the neutral flag
  for (const wk of weeks) for (const g of wk) { const A = L.teams[g.h].city, B = L.teams[g.a].city; if (NEUTRAL_RIVALS.some(([x, y]) => (x === A && y === B) || (x === B && y === A))) g.n = 1; }
  // non-conference fill to 12 games, early weeks first
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (const w of order) {
    const need = shuffle(L.teams.filter(t => count[t.id] < 12 && !busy[w].has(t.id)).map(t => t.id));
    need.sort((a, b) => count[a] - count[b]);
    const used = new Set();
    for (const a of need) {
      if (used.has(a) || count[a] >= 12) continue;
      const A = L.teams[a];
      // games left to place vs. open weeks: don't let a team run out of weeks
      const cands = need.filter(b => b !== a && !used.has(b) && count[b] < 12 && !met.has(key(a, b)));
      if (!cands.length) continue;
      const b = weighted(cands, b => { const B = L.teams[b]; return (B.conf !== A.conf ? 3 : 0.05) * (1 / (1 + Math.abs(B.prestige - A.prestige) * 0.6)) * (A.conf === 'Ind' || B.conf === 'Ind' ? 1.5 : 1); });
      used.add(a); used.add(b); add(w, a, b);
    }
  }
  return { weeks, count };
}

// ---------- results ----------
recordGame = function (L, g, res) {
  g.hs = res.score[0]; g.as = res.score[1];
  if (res.box) {
    if (res.participants) for (const id of res.participants) if (!res.box[id]) res.box[id] = {};
    commitBox(L, res.box, g);
  }
  if (res.quarter > 4) g.ot = res.quarter - 4;
  const H = L.teams[g.h], A = L.teams[g.a];
  H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs;
  const hw = g.hs > g.as;
  if (hw) { H.w++; A.l++; } else { A.w++; H.l++; }
  if (L.phase === 'regular' && H.conf === A.conf && H.conf !== 'Ind') { if (hw) { H.cw++; A.cl++; } else { A.cw++; H.cl++; } }
  eloUpdate(H, A, g.hs - g.as, g.n);
};
function eloUpdate(H, A, margin, neutral) {
  const hfa = neutral ? 0 : 40;
  const exp = 1 / (1 + Math.pow(10, (A.elo - H.elo - hfa) / 400));
  const res = margin > 0 ? 1 : 0;
  const k = 30 * (1 + Math.log(1 + Math.abs(margin)) / 4);
  const d = k * (res - exp);
  H.elo += d; A.elo -= d;
}

// ---------- Top 25 ----------
function pollScore(L, t) { return t.elo + t.w * 14 - t.l * 52 + (t.l === 0 && t.w >= 6 ? 30 : 0); }
function updatePoll(L, preseason) {
  const prev = {}; (L.poll || []).forEach((x, i) => prev[x.tid] = i + 1);
  const ranked = L.teams.slice().sort((a, b) => pollScore(L, b) - pollScore(L, a));
  L.poll = ranked.slice(0, 25).map(t => ({ tid: t.id, pts: Math.round(pollScore(L, t)), prev: prev[t.id] || 0 }));
  for (const t of L.teams) t.rank = 0;
  L.poll.forEach((x, i) => L.teams[x.tid].rank = i + 1);
  L.pollOrder = ranked.map(t => t.id);
  if (preseason) L.preRank = Object.fromEntries(ranked.map((t, i) => [t.id, i + 1]));
}
function rk(t) { return t.rank ? `<span class="rk">#${t.rank}</span> ` : ''; }
function rkTxt(t) { return t.rank ? `#${t.rank} ` : ''; }

// ---------- conference standings ----------
function confTable(L, conf) {
  const ids = L.teams.filter(t => t.conf === conf).map(t => t.id);
  return ids.sort((a, b) => {
    const A = L.teams[a], B = L.teams[b];
    const pa = A.cw + A.cl ? A.cw / (A.cw + A.cl) : 0, pb = B.cw + B.cl ? B.cw / (B.cw + B.cl) : 0;
    if (pb !== pa) return pb - pa;
    const h2h = headToHead(L, a, b); if (h2h) return h2h;
    return pct(B) - pct(A) || pollScore(L, B) - pollScore(L, A);
  });
}
function headToHead(L, a, b) {
  for (const wk of L.schedule) for (const g of wk) if (g.hs != null && ((g.h === a && g.a === b) || (g.h === b && g.a === a))) {
    const aw = g.h === a ? g.hs > g.as : g.as > g.hs; return aw ? -1 : 1;
  }
  return 0;
}

// ---------- weekly flow ----------
const _simWeekC = simWeek;
simWeek = function (L, includeUser) {
  if (!L.cfb) return _simWeekC(L, includeUser);
  const wk = L.week, ph = L.phase, rd = L.playoffs ? L.playoffs.round : -1;
  // keep participants on every game result
  _simWeekC(L, includeUser);
  const advanced = (ph === 'regular' && (L.week > wk || L.phase !== 'regular')) || (ph === 'playoffs' && (!L.playoffs || L.playoffs.round !== rd || L.phase !== 'playoffs'));
  if (advanced) {
    if (ph === 'regular') updatePoll(L);
    recruitWeek(L, ph === 'regular' ? wk : 'post');
    if (ph === 'regular' && L.phase === 'regular') weeklyStorylines(L, wk);
  }
};
function weeklyStorylines(L, wk) {
  const games = L.schedule[wk - 1] || [];
  // upsets of ranked teams
  for (const g of games) {
    if (g.hs == null) continue;
    const win = g.hs > g.as ? g.h : g.a, lose = win === g.h ? g.a : g.h, W = L.teams[win], Lo = L.teams[lose];
    const loserPrev = (L._lastRank || {})[lose] || 0, winPrev = (L._lastRank || {})[win] || 0;
    if (loserPrev && loserPrev <= 10 && (!winPrev || winPrev > loserPrev + 8)) addNews(L, `UPSET: ${winPrev ? '#' + winPrev + ' ' : ''}${W.city} knocks off #${loserPrev} ${Lo.city}, ${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}${g.ot ? ' (' + (g.ot > 1 ? g.ot + 'OT' : 'OT') + ')' : ''}.`);
  }
  L._lastRank = Object.fromEntries(L.teams.map(t => [t.id, t.rank]));
  const top = L.poll[0]; if (top && wk % 3 === 0) addNews(L, `AP-style poll: ${L.teams[top.tid].city} (${recStr(L.teams[top.tid])}) is #1 after week ${wk}.`);
}

// neutral sites: look the game up when the caller didn't say
const _ngsS = newGameState;
newGameState = function (L, hid, aid, opts = {}) {
  if (L && L.cfb && opts.neutral === undefined) {
    const list = L.phase === 'playoffs' && L.playoffs ? L.playoffs.games : (L.schedule[L.week - 1] || []);
    const g = list.find(x => x.h === hid && x.a === aid);
    opts = Object.assign({}, opts, { neutral: !!(g && g.n) });
  }
  return _ngsS(L, hid, aid, opts);
};
// play a user game: remember it for recruiting visits
const _finishUserGameC = finishUserGame;
finishUserGame = function (gs) {
  const L = LEAGUE;
  if (L && L.cfb) { const g = userGame(L); if (g) { L._lastUserGame = { h: g.h, a: g.a, week: L.week, phase: L.phase }; } }
  _finishUserGameC(gs);
};

// ---------- postseason ----------
ROUND_NAMES.length = 0; ROUND_NAMES.push('Conference Championships', 'Bowls & CFP First Round', 'CFP Quarterfinals', 'CFP Semifinals', 'National Championship');
const BOWLS = ['Sunshine', 'Lone Star', 'Bayou', 'Desert', 'Golden Gate', 'Bluegrass', 'Magnolia', 'Pinewood', 'Harbor', 'Canyon', 'Cotton Field', 'Palmetto', 'Prairie', 'Big Sky',
  'Gulf Coast', 'Blue Ridge', 'Great Lakes', 'Pacific Coast', 'Gateway', 'Frontier', 'Heartland', 'Riverboat', 'Mesa', 'Tidewater', 'Evergreen', 'Silver State',
  'Ozark', 'Keystone', 'Cactus', 'Crescent City', 'Liberty Bell', 'Space Coast', 'Rocky Top', 'Panhandle', 'Bay Area', 'Badlands', 'Islands', 'Smoky Mountain'];

startPlayoffs = function (L) {
  if (!L.cfb) return;
  L.phase = 'playoffs';
  updatePoll(L);
  const games = [];
  for (const conf of L.confs) {
    if (conf === 'Ind') continue;
    const tbl = confTable(L, conf); if (tbl.length < 4) continue;
    games.push({ h: tbl[0], a: tbl[1], hs: null, as: null, round: 0, name: `${conf} Championship`, conf, n: 1 });
  }
  L.playoffs = { round: 0, games, done: [], champs: {}, seeds: [], bowls: [] };
  const u = L.userTid, mine = games.find(g => g.h === u || g.a === u);
  addNews(L, mine ? `🏈 ${L.teams[u].city} plays for the ${mine.conf} title!` : `Regular season complete. ${L.teams[u].city} finished ${recStr(L.teams[u])} (${L.teams[u].cw}-${L.teams[u].cl} ${L.teams[u].conf}).`);
};

function cfpField(L) {
  const order = L.pollOrder.slice();
  const champs = Object.values(L.playoffs.champs);
  const autos = order.filter(id => champs.includes(id)).slice(0, 5);
  const field = new Set(autos);
  for (const id of order) { if (field.size >= 12) break; field.add(id); }
  // straight seeding by ranking
  return order.filter(id => field.has(id)).slice(0, 12);
}
advancePlayoffs = function (L) {
  if (!L.cfb) return;
  const po = L.playoffs, u = L.userTid;
  const winOf = g => g.hs > g.as ? g.h : g.a, loseOf = g => g.hs > g.as ? g.a : g.h;
  for (const g of po.games) {
    po.done.push(g);
    const w = winOf(g), lo = loseOf(g), W = L.teams[w];
    const sc = `${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}${g.ot ? ' (' + (g.ot > 1 ? g.ot + 'OT' : 'OT') + ')' : ''}`;
    if (g.round === 0) { po.champs[g.conf] = w; W.confTitles++; addNews(L, `🏆 ${W.city} wins the ${g.conf} Championship, ${sc} over ${L.teams[lo].city}.`); }
    else if (g.bowl) { W.bowlWins++; if (w === u || lo === u) addNews(L, `${g.name}: ${W.city} beats ${L.teams[lo].city}, ${sc}.`); }
    else if (g.cfp && g.round < 4 && (lo === u)) addNews(L, `Season over: ${L.teams[u].city} falls to ${W.city} in the ${g.name}, ${sc}.`);
    if (g.round === 4) {
      W.titles++;
      L.history.unshift({ season: L.season, champ: w, runner: lo, score: sc });
      addNews(L, `🏆 ${W.city} ${W.name} are the ${L.season} national champions! They beat ${L.teams[lo].city} ${sc}.`);
    }
  }
  if (po.round === 4) { po.games = []; endSeason(L); return; }
  po.round++;
  const cfpG = r => po.done.filter(g => g.cfp && g.round === r);
  if (po.round === 1) {
    updatePoll(L);
    L.heisman = heismanVote(L);
    if (L.heisman[0]) { const p = L.players[L.heisman[0].id]; if (p) { p.awards = p.awards || []; p.awards.push('Heisman ' + L.season); } addNews(L, `🏆 Heisman Trophy: ${L.heisman[0].pos} ${L.heisman[0].name} of ${L.teams[L.heisman[0].tid].city}.`); }
    const seeds = cfpField(L); po.seeds = seeds;
    for (const id of seeds) L.teams[id].cfpApps++;
    const S = i => seeds[i - 1];
    po.games = [[8, 9], [7, 10], [6, 11], [5, 12]].map(([a, b], i) => ({ h: S(a), a: S(b), hs: null, as: null, round: 1, cfp: true, slot: i, name: 'CFP First Round', seedH: a, seedA: b }));
    // bowls for everyone else with 6+ wins
    const pool = L.pollOrder.filter(id => !seeds.includes(id) && L.teams[id].w >= 6);
    const names = shuffle(BOWLS.slice());
    const used = new Set();
    for (const a of pool) {
      if (used.has(a) || !names.length) continue;
      const b = pool.find(x => x !== a && !used.has(x) && L.teams[x].conf !== L.teams[a].conf) || pool.find(x => x !== a && !used.has(x));
      if (b == null) break;
      used.add(a); used.add(b);
      po.games.push({ h: a, a: b, hs: null, as: null, round: 1, bowl: true, n: 1, name: names.shift() + ' Bowl' });
    }
    const ut = L.teams[u];
    if (seeds.includes(u)) addNews(L, `🎉 ${ut.city} is in the College Football Playoff as the #${seeds.indexOf(u) + 1} seed!${seeds.indexOf(u) < 4 ? ' First-round bye.' : ''}`);
    else { const bg = po.games.find(g => g.bowl && (g.h === u || g.a === u)); addNews(L, bg ? `${ut.city} accepts a bid to the ${bg.name}.` : `${ut.city} (${recStr(ut)}) is not bowl eligible this year.`); }
  } else if (po.round === 2) {
    const r1 = cfpG(1).sort((a, b) => a.slot - b.slot);
    po.games = [1, 2, 3, 4].map((s, i) => ({ h: po.seeds[s - 1], a: winOf(r1[i]), hs: null, as: null, round: 2, cfp: true, slot: i, n: 1, name: 'CFP Quarterfinal' }));
  } else if (po.round === 3) {
    const q = cfpG(2).sort((a, b) => a.slot - b.slot);
    po.games = [[0, 3], [1, 2]].map(([x, y], i) => ({ h: winOf(q[x]), a: winOf(q[y]), hs: null, as: null, round: 3, cfp: true, slot: i, n: 1, name: 'CFP Semifinal' }));
  } else if (po.round === 4) {
    const s = cfpG(3).sort((a, b) => a.slot - b.slot);
    po.games = [{ h: winOf(s[0]), a: winOf(s[1]), hs: null, as: null, round: 4, cfp: true, n: 1, name: 'National Championship' }];
  }
};

// user-facing: a game's label and neutral flag
function gameLabel(L, g) {
  if (g.name) return g.name;
  const rv = isRivalry(L, g.h, g.a);
  return rv ? 'Rivalry Game' : (L.teams[g.h].conf === L.teams[g.a].conf && L.teams[g.h].conf !== 'Ind' ? L.teams[g.h].conf + ' game' : 'Non-conference');
}

// ---------- Heisman + awards ----------
function heismanScore(L, p) {
  const s = p.st || {}, t = L.teams[p.tid];
  let v;
  if (p.pos === 'QB') v = (s.py || 0) / 22 + (s.ptd || 0) * 4.2 - (s.pint || 0) * 3 + (s.ry || 0) / 9 + (s.rtd || 0) * 5.5;
  else if (['RB', 'WR', 'TE'].includes(p.pos)) v = ((s.ry || 0) + (s.rcy || 0)) / 8.5 + ((s.rtd || 0) + (s.rctd || 0)) * 5.5;
  else v = ((s.sk || 0) * 5 + (s.dint || 0) * 7 + (s.tk || 0) * 0.6) * 0.75;
  const winF = 0.55 + pct(t) * 0.6 + (t.rank && t.rank <= 10 ? 0.12 : 0);
  return v * winF * (isP4(t) ? 1 : 0.82);
}
function heismanVote(L) {
  const all = Object.values(L.players).filter(p => p.tid != null && p.tid >= 0 && p.st && p.st.gp);
  return all.map(p => ({ p, v: heismanScore(L, p) })).sort((a, b) => b.v - a.v).slice(0, 5)
    .map(({ p, v }) => ({ id: p.id, name: pname(p), pos: p.pos, tid: p.tid, cls: clsLabel(p), line: statLine(p), v: Math.round(v) }));
}
computeAwards = function (L) {
  if (!L.cfb) return;
  const all = Object.values(L.players).filter(p => p.tid != null && p.tid >= 0 && p.st && p.st.gp);
  const fmt = p => p ? { id: p.id, name: pname(p), pos: p.pos, tid: p.tid } : null;
  const best = (arr, f) => arr.reduce((b, p) => (!b || f(p) > f(b) ? p : b), null);
  const aw = { season: L.season, heisman: (L.heisman || [])[0] || null, finalists: L.heisman || [] };
  aw.qb = fmt(best(all.filter(p => p.pos === 'QB'), p => heismanScore(L, p)));
  aw.rb = fmt(best(all.filter(p => p.pos === 'RB'), p => (p.st.ry || 0) + (p.st.rtd || 0) * 20 + (p.st.rcy || 0) * 0.5));
  aw.wr = fmt(best(all.filter(p => p.pos === 'WR' || p.pos === 'TE'), p => (p.st.rcy || 0) + (p.st.rctd || 0) * 20));
  const defS = p => (p.st.tk || 0) + (p.st.sk || 0) * 6 + (p.st.dint || 0) * 7 + (p.st.pd || 0) * 1.5 + p.ovr * 0.3;
  aw.dpoy = fmt(best(all.filter(p => ['DL', 'LB', 'CB', 'S'].includes(p.pos)), defS));
  aw.fresh = fmt(best(all.filter(p => p.cls === 1), p => Math.max(heismanScore(L, p), defS(p) * 0.9)));
  // coach of the year: beat preseason expectations the most
  const coyS = t => (L.preRank[t.id] || 99) - (t.rank || 60) + t.w * 3;
  const coy = L.teams.slice().sort((a, b) => coyS(b) - coyS(a))[0];
  aw.coy = { tid: coy.id, name: coy.id === L.userTid ? coachName(L) : coy.coach };
  // All-America first team
  const team = [];
  for (const pos of POSITIONS) {
    const n = pos === 'CB' ? 2 : STARTERS[pos];
    all.filter(p => p.pos === pos).sort((a, b) => seasonScore(b) + b.ovr * 0.5 - seasonScore(a) - a.ovr * 0.5).slice(0, n).forEach(p => {
      team.push({ id: p.id, name: pname(p), pos, tid: p.tid }); p.allPros = (p.allPros || 0) + 1;
    });
  }
  aw.allpro = team;
  for (const k of ['qb', 'rb', 'wr', 'dpoy', 'fresh']) if (aw[k]) { const p = L.players[aw[k].id]; if (p) { p.awards = p.awards || []; p.awards.push({ qb: 'Top QB', rb: 'Top RB', wr: 'Top Receiver', dpoy: 'Top Defender', fresh: 'Freshman of the Year' }[k] + ' ' + aw.season); } }
  L.awards.unshift(aw);
};
function coachName(L) { return L.settings.coachName || 'You'; }

// redshirt bookkeeping needs games played before stats are archived
const _endSeasonC = endSeason;
endSeason = function (L) {
  if (L.cfb) for (const p of Object.values(L.players)) p.lastGp = (p.st && p.st.gp) || 0;
  _endSeasonC(L);
};
