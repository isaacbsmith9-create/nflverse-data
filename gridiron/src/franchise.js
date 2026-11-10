// ============================================================
// Gridiron Dynasty - franchise: league, schedule, standings,
// playoffs, offseason (progression, re-sign, FA, draft), trades
// ============================================================
'use strict';

function newLeague(userAbbr, opts = {}) {
  const L = {
    version: 1, nextPid: 1, season: 2026, week: 1, phase: 'regular',
    userTid: 0, teams: [], players: {}, fa: [], schedule: [], playoffs: null,
    draftClass: [], picks: [], news: [], history: [], awards: [],
    settings: Object.assign({ qlen: 240, diff: 'pro', simDef: false, autoSave: true }, opts.settings || {}),
    draft: null,
  };
  TEAM_DEFS.forEach((d, i) => {
    L.teams.push({ id: i, city: d[0], name: d[1], abbr: d[2], c1: d[3], c2: d[4], conf: d[5], div: d[6],
      roster: [], depth: {}, w: 0, l: 0, t: 0, pf: 0, pa: 0, titles: 0, strength: gauss(0, 3.2) });
  });
  L.userTid = Math.max(0, L.teams.findIndex(t => t.abbr === userAbbr));
  for (const t of L.teams) {
    for (const pos of POSITIONS) {
      const n = ROSTER_TARGET[pos], st = STARTERS[pos];
      for (let i = 0; i < n; i++) {
        let target;
        if (i < st) target = 74 + t.strength + gauss(0, 6) - i * 1.5;
        else target = 62 + t.strength * 0.5 + gauss(0, 5) - (i - st) * 2;
        if (pos === 'QB' && i === 0) target += 3;
        const p = genPlayer(L, pos, clamp(target, 45, 97));
        setContract(p);
        addToTeam(L, p, t.id);
      }
    }
    autoDepth(L, t);
    trimToCap(L, t);
  }
  for (let i = 0; i < 90; i++) {
    const pos = weighted(POSITIONS, p => ROSTER_TARGET[p]);
    const p = genPlayer(L, pos, clamp(gauss(58, 6), 42, 72));
    setContract(p, 1); p.tid = null; L.players[p.id] = p; L.fa.push(p.id);
  }
  L.schedule = makeSchedule(L);
  initPicks(L);
  L.draftClass = genDraftClass(L);
  addNews(L, `Welcome to the ${L.season} season! You are the GM and head coach of the ${teamName(L.teams[L.userTid])}.`);
  return L;
}

// ---------- helpers ----------
const team = (L, tid) => L.teams[tid];
const teamName = t => t.city + ' ' + t.name;
const P = (L, id) => L.players[id];
function addNews(L, txt) { L.news.unshift({ s: L.season, w: L.week, txt }); if (L.news.length > 80) L.news.length = 80; }

function addToTeam(L, p, tid) {
  L.players[p.id] = p; p.tid = tid;
  const t = L.teams[tid];
  if (!t.roster.includes(p.id)) t.roster.push(p.id);
  // unique jersey number on team
  const used = new Set(t.roster.filter(id => id !== p.id).map(id => L.players[id].num));
  let tries = 0; while (used.has(p.num) && tries++ < 40) p.num = jerseyNum(p.pos);
  fixDepth(L, t);
}
function removeFromTeam(L, p) {
  if (p.tid == null || p.tid < 0) return;
  const t = L.teams[p.tid];
  t.roster = t.roster.filter(id => id !== p.id);
  for (const pos in t.depth) t.depth[pos] = t.depth[pos].filter(id => id !== p.id);
  p.tid = null;
}
// players on injured reserve (ir) don't count toward the 53-man limit
function activeCount(L, t) { return t.roster.reduce((n, id) => n + (L.players[id].ir ? 0 : 1), 0); }
function payroll(L, t) { return t.roster.reduce((s, id) => s + L.players[id].con.sal, 0); }
function capRoom(L, t) { return capOf(L) - payroll(L, t); }
function trimToCap(L, t) {
  // scale down contracts if generated team is over cap (initial league only)
  const pay = payroll(L, t);
  if (pay > CAP * 0.97) {
    const f = (CAP * 0.93) / pay;
    for (const id of t.roster) { const p = L.players[id]; p.con.sal = Math.max(0.75, Math.round(p.con.sal * f * 100) / 100); }
  }
}

function autoDepth(L, t) {
  t.depth = {};
  for (const pos of POSITIONS) t.depth[pos] = t.roster.filter(id => L.players[id].pos === pos).sort((a, b) => L.players[b].ovr - L.players[a].ovr);
}
function fixDepth(L, t) {
  for (const pos of POSITIONS) {
    const cur = (t.depth[pos] || []).filter(id => t.roster.includes(id) && L.players[id].pos === pos);
    const missing = t.roster.filter(id => L.players[id].pos === pos && !cur.includes(id)).sort((a, b) => L.players[b].ovr - L.players[a].ovr);
    t.depth[pos] = cur.concat(missing);
  }
}

// lineup used by games: healthy players by depth, with fallbacks & scrubs
const FALLBACK = { QB: ['RB', 'WR'], RB: ['WR', 'TE'], WR: ['TE', 'RB', 'CB'], TE: ['WR', 'OL'], OL: ['DL', 'TE'], DL: ['LB', 'OL'], LB: ['S', 'DL'], CB: ['S', 'WR'], S: ['CB', 'LB'], K: ['P'], P: ['K'] };
function lineup(L, t, extra = 1) {
  if (t.id !== L.userTid) autoDepth(L, t); else fixDepth(L, t);
  const used = new Set(), out = {};
  for (const pos of POSITIONS) {
    const need = STARTERS[pos] + (['RB', 'WR', 'DL', 'LB', 'CB'].includes(pos) ? extra : 0);
    const list = [];
    for (const id of t.depth[pos]) { const p = L.players[id]; if (!p.inj && !used.has(id) && list.length < need) { list.push(p); used.add(id); } }
    for (const fb of FALLBACK[pos]) {
      if (list.length >= need) break;
      for (const id of t.depth[fb] || []) { const p = L.players[id]; if (!p.inj && !used.has(id) && list.length < need && STARTERS[fb] < (t.depth[fb] || []).length) { list.push(p); used.add(id); } }
    }
    while (list.length < need) list.push(scrub(pos));
    out[pos] = list;
  }
  return out;
}
function scrub(pos) {
  const p = genPlayer(null, pos, 42, 25); p.id = -randi(1, 1e9); p.first = 'Practice'; p.last = 'Squad'; p.scrub = true; return p;
}

function teamOvr(L, t) {
  const lu = lineup(L, t, 0);
  const avg = pos => lu[pos].reduce((s, p) => s + p.ovr, 0) / lu[pos].length;
  const off = avg('QB') * .35 + avg('RB') * .1 + avg('WR') * .2 + avg('TE') * .08 + avg('OL') * .27;
  const def = avg('DL') * .3 + avg('LB') * .2 + avg('CB') * .3 + avg('S') * .2;
  return { off: Math.round(off), def: Math.round(def), ovr: Math.round(off * .5 + def * .42 + avg('K') * .04 + avg('P') * .04) };
}

// ---------- schedule ----------
function makeSchedule(L) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const s = tryMakeSchedule(L);
    if (s) return s;
  }
  // fallback: pure random round robin matchups
  return Array.from({ length: SEASON_WEEKS }, () => {
    const ids = shuffle(L.teams.map(t => t.id)); const wk = [];
    for (let i = 0; i < ids.length; i += 2) wk.push({ h: ids[i], a: ids[i + 1], hs: null, as: null });
    return wk;
  });
}
function tryMakeSchedule(L) {
  const weeks = [];
  const played = new Set(); const key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  // division double round robin: 6 weeks
  const divs = {};
  for (const t of L.teams) (divs[t.conf + t.div] = divs[t.conf + t.div] || []).push(t.id);
  const rr = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  for (let k = 0; k < 6; k++) {
    const wk = [];
    for (const d in divs) {
      const ids = divs[d];
      for (const [a, b] of rr[k % 3]) {
        const home = k < 3 ? ids[a] : ids[b], away = k < 3 ? ids[b] : ids[a];
        wk.push({ h: home, a: away, hs: null, as: null }); played.add(key(ids[a], ids[b]));
      }
    }
    weeks.push(wk);
  }
  // 11 more weeks of non-division matchups via random matching
  const homeCount = {}; L.teams.forEach(t => homeCount[t.id] = 3);
  for (let w = 0; w < SEASON_WEEKS - 6; w++) {
    let ok = false;
    for (let tries = 0; tries < 60 && !ok; tries++) {
      const ids = shuffle(L.teams.map(t => t.id)); const wk = []; const used = new Set(); ok = true;
      for (const a of ids) {
        if (used.has(a)) continue;
        const cands = ids.filter(b => b !== a && !used.has(b) && !played.has(key(a, b)));
        if (!cands.length) { ok = false; break; }
        // prefer same conference slightly
        const b = weighted(cands, b => (L.teams[b].conf === L.teams[a].conf ? 2 : 1));
        used.add(a); used.add(b);
        const aHome = homeCount[a] <= homeCount[b];
        wk.push(aHome ? { h: a, a: b, hs: null, as: null } : { h: b, a: a, hs: null, as: null });
      }
      if (ok) { for (const g of wk) { played.add(key(g.h, g.a)); homeCount[g.h]++; } weeks.push(wk); }
    }
    if (!ok) return null;
  }
  return shuffle(weeks);
}

// ---------- standings ----------
function pct(t) { const g = t.w + t.l + t.t; return g ? (t.w + t.t * 0.5) / g : 0; }
function sortStand(L, ids) {
  return ids.slice().sort((a, b) => {
    const A = L.teams[a], B = L.teams[b];
    return pct(B) - pct(A) || (B.pf - B.pa) - (A.pf - A.pa) || B.pf - A.pf;
  });
}
function divisions(L, conf) {
  const out = {};
  for (const t of L.teams) if (!conf || t.conf === conf) (out[t.conf + ' ' + t.div] = out[t.conf + ' ' + t.div] || []).push(t.id);
  for (const k in out) out[k] = sortStand(L, out[k]);
  return out;
}
function confSeeds(L, conf) {
  const divs = divisions(L, conf);
  const winners = sortStand(L, Object.values(divs).map(d => d[0]));
  const rest = sortStand(L, L.teams.filter(t => t.conf === conf && !winners.includes(t.id)).map(t => t.id));
  return winners.concat(rest.slice(0, 3));
}
function recStr(t) { return t.w + '-' + t.l + (t.t ? '-' + t.t : ''); }

// ---------- week flow ----------
function userGame(L) {
  if (L.phase === 'regular') {
    const wk = L.schedule[L.week - 1]; if (!wk) return null;
    return wk.find(g => (g.h === L.userTid || g.a === L.userTid) && g.hs == null) || null;
  }
  if (L.phase === 'playoffs' && L.playoffs) {
    return L.playoffs.games.find(g => (g.h === L.userTid || g.a === L.userTid) && g.hs == null) || null;
  }
  return null;
}

function recordGame(L, g, res) {
  g.hs = res.score[0]; g.as = res.score[1];
  if (res.box) commitBox(L, res.box, g);
  if (L.phase !== 'regular') return;
  const H = L.teams[g.h], A = L.teams[g.a];
  H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs;
  if (g.hs > g.as) { H.w++; A.l++; } else if (g.as > g.hs) { A.w++; H.l++; } else { H.t++; A.t++; }
}

function commitBox(L, box, g) {
  for (const id in box) {
    const p = L.players[id]; if (!p) continue;
    const b = box[id];
    p.st.gp = (p.st.gp || 0) + 1;
    for (const k in b) if (k !== 'gp') p.st[k] = (p.st[k] || 0) + b[k];
  }
}

function injuriesTick(L, played) {
  // heal
  for (const t of L.teams) for (const id of t.roster) { const p = L.players[id]; if (p.inj > 0) { p.inj--; if (p.inj === 0) p.ir = false; if (p.inj === 0 && t.id === L.userTid) addNews(L, `${p.pos} ${pname(p)} has returned from injury.`); } }
  // new injuries for players who played
  for (const tid of played) {
    const t = L.teams[tid]; const lu = lineup(L, t);
    for (const pos in lu) for (const p of lu[pos]) {
      if (p.scrub || p.pos === 'K' || p.pos === 'P') continue;
      if (chance(0.012)) {
        p.inj = weighted([[1, 40], [2, 25], [3, 15], [4, 9], [6, 7], [10, 4]], x => x[1])[0];
        if (t.id === L.userTid || p.ovr >= 85) addNews(L, `${t.abbr} ${p.pos} ${pname(p)} injured — out ${p.inj} week${p.inj > 1 ? 's' : ''}.`);
      }
    }
  }
}

// Sim every unplayed game in the current week (except the user's unless includeUser)
function simWeek(L, includeUser = true) {
  if (L.phase === 'regular') {
    const wk = L.schedule[L.week - 1];
    const played = [];
    for (const g of wk) {
      if (g.hs != null) { played.push(g.h, g.a); continue; }
      if (!includeUser && (g.h === L.userTid || g.a === L.userTid)) continue;
      const res = simGame(L, g.h, g.a, { qlen: 900 });
      recordGame(L, g, res); played.push(g.h, g.a);
    }
    if (wk.every(g => g.hs != null)) {
      const ug = wk.find(g => g.h === L.userTid || g.a === L.userTid);
      if (ug) {
        const us = ug.h === L.userTid ? ug.hs : ug.as, them = ug.h === L.userTid ? ug.as : ug.hs;
        const opp = L.teams[ug.h === L.userTid ? ug.a : ug.h];
        addNews(L, `Week ${L.week}: ${us > them ? 'W' : us < them ? 'L' : 'T'} ${us}-${them} ${ug.h === L.userTid ? 'vs' : '@'} ${opp.abbr}`);
      }
      injuriesTick(L, played);
      aiRosterMoves(L);
      L.week++;
      if (L.week > weeksOf(L)) startPlayoffs(L);
    }
    return;
  }
  if (L.phase === 'playoffs') {
    for (const g of L.playoffs.games) {
      if (g.hs != null) continue;
      if (!includeUser && (g.h === L.userTid || g.a === L.userTid)) continue;
      const res = simGame(L, g.h, g.a, { qlen: 900, playoff: true });
      recordGame(L, g, res);
    }
    if (L.playoffs.games.every(g => g.hs != null)) advancePlayoffs(L);
  }
}

const ROUND_NAMES = ['Wild Card', 'Divisional', 'Conference Championship', 'Grand Bowl'];
function startPlayoffs(L) {
  L.phase = 'playoffs';
  const [C1, C2] = confsOf(L);
  const seeds = { [C1]: confSeeds(L, C1), [C2]: confSeeds(L, C2) };
  L.playoffs = { round: 0, seeds, games: [], done: [], alive: { [C1]: seeds[C1].slice(), [C2]: seeds[C2].slice() } };
  const made = Object.values(seeds).flat().includes(L.userTid);
  addNews(L, made ? `🏈 The ${L.teams[L.userTid].name} clinched a playoff spot (#${(seeds[L.teams[L.userTid].conf].indexOf(L.userTid) + 1)} seed)!` : `The ${L.teams[L.userTid].name} missed the playoffs this season.`);
  makePlayoffRound(L);
}
function makePlayoffRound(L) {
  const po = L.playoffs; po.games = [];
  if (po.round === 3) {
    const [C1, C2] = confsOf(L); const e = po.alive[C1][0], w = po.alive[C2][0];
    po.games.push({ h: e, a: w, hs: null, as: null, round: 3, neutral: true });
    return;
  }
  for (const conf of confsOf(L)) {
    const seedOrder = po.seeds[conf];
    const alive = po.alive[conf].slice().sort((a, b) => seedOrder.indexOf(a) - seedOrder.indexOf(b));
    let teams = alive;
    if (po.round === 0) teams = alive.slice(1); // #1 seed bye
    const n = teams.length;
    for (let i = 0; i < n / 2; i++) po.games.push({ h: teams[i], a: teams[n - 1 - i], hs: null, as: null, round: po.round, conf });
  }
}
function advancePlayoffs(L) {
  const po = L.playoffs;
  for (const g of po.games) {
    const win = g.hs > g.as ? g.h : g.a, lose = win === g.h ? g.a : g.h;
    po.done.push(g);
    for (const c of confsOf(L)) po.alive[c] = po.alive[c].filter(x => x !== lose);
    if (lose === L.userTid) addNews(L, `Season over: eliminated in the ${ROUND_NAMES[g.round]} by ${L.teams[win].abbr} (${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}).`);
    if (g.round === 3) {
      L.teams[win].titles++;
      L.history.unshift({ season: L.season, champ: win, runner: lose, score: `${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}` });
      addNews(L, `🏆 The ${teamName(L.teams[win])} win the ${L.season} Grand Bowl, ${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)} over ${L.teams[lose].abbr}!`);
      endSeason(L);
      return;
    }
  }
  po.round++;
  makePlayoffRound(L);
}

// ---------- end of season / offseason ----------
function computeAwards(L) {
  const all = Object.values(L.players).filter(p => p.tid != null && p.tid >= 0 && p.st.gp);
  const winPct = p => pct(L.teams[p.tid]);
  const qbScore = p => (p.st.py || 0) / 25 + (p.st.ptd || 0) * 4 - (p.st.pint || 0) * 3 + (p.st.ry || 0) / 10 + (p.st.rtd || 0) * 6;
  const offScore = p => (p.pos === 'QB' ? qbScore(p) * 0.8 : 0) + (p.st.ry || 0) / 10 + (p.st.rcy || 0) / 10 + ((p.st.rtd || 0) + (p.st.rctd || 0)) * 6;
  const defScore = p => (p.st.tk || 0) * 1 + (p.st.sk || 0) * 5 + (p.st.dint || 0) * 6 + (p.st.pd || 0) * 1.5;
  const best = (arr, f) => arr.reduce((b, p) => (!b || f(p) > f(b) ? p : b), null);
  const aw = { season: L.season };
  const mvp = best(all, p => (p.pos === 'QB' ? qbScore(p) : offScore(p) * 0.85) * (0.6 + winPct(p)));
  const opoy = best(all.filter(p => p.id !== (mvp && mvp.id)), offScore);
  const dpoy = best(all.filter(p => ['DL', 'LB', 'CB', 'S'].includes(p.pos)), defScore);
  const roy = best(all.filter(p => p.rookie), p => Math.max(offScore(p), defScore(p) * 1.2, p.pos === 'QB' ? qbScore(p) : 0));
  const fmt = p => p ? { id: p.id, name: pname(p), pos: p.pos, tid: p.tid } : null;
  aw.mvp = fmt(mvp); aw.opoy = fmt(opoy); aw.dpoy = fmt(dpoy); aw.roy = fmt(roy);
  L.awards.unshift(aw);
  if (mvp) addNews(L, `MVP: ${mvp.pos} ${pname(mvp)} (${L.teams[mvp.tid].abbr}).`);
}

function endSeason(L) {
  computeAwards(L);
  // archive stats into career
  for (const p of Object.values(L.players)) {
    if (p.st && p.st.gp) p.career.push(Object.assign({ season: L.season, tm: p.tid != null && p.tid >= 0 ? L.teams[p.tid].abbr : 'FA' }, p.st));
    p.st = {}; p.rookie = false; p.inj = 0;
  }
  L.phase = 'recap';
}

// called when user advances out of 'recap'
function beginOffseason(L) {
  const retired = [];
  for (const p of Object.values(L.players)) {
    if (p.tid === -1) continue;
    progressPlayer(p);
    const retireP = p.age >= 38 ? 0.9 : p.age >= 35 ? 0.45 : p.age >= 33 ? 0.2 : (p.age >= 30 && p.ovr < 60) ? 0.35 : 0;
    if (chance(retireP)) retired.push(p);
  }
  for (const p of retired) {
    if (p.tid != null && p.tid >= 0 && (p.tid === L.userTid || p.ovr >= 82)) addNews(L, `${L.teams[p.tid].abbr} ${p.pos} ${pname(p)} announced his retirement at ${p.age}.`);
    removeFromTeam(L, p); L.fa = L.fa.filter(id => id !== p.id); delete L.players[p.id];
  }
  // contracts tick
  for (const t of L.teams) for (const id of t.roster) { const p = L.players[id]; p.con.yrs--; }
  L.phase = 'resign';
  // AI re-signs
  for (const t of L.teams) {
    if (t.id === L.userTid) continue;
    for (const id of t.roster.slice()) {
      const p = L.players[id];
      if (p.con.yrs > 0) continue;
      const want = p.ovr >= 72 && p.age <= 31 ? 0.8 : p.ovr >= 65 && p.age <= 29 ? 0.5 : 0.15;
      if (chance(want) && capRoom(L, t) > marketSalary(p)) setContract(p, randi(1, 4));
      else releaseToFA(L, p);
    }
  }
}

function progressPlayer(p) {
  p.age++;
  let delta;
  const devB = p.dev === 'X' ? 2.5 : p.dev === 'S' ? 1.3 : 0;
  if (p.age <= 24) delta = gauss(3.2 + devB, 2.5);
  else if (p.age <= 27) delta = gauss(1.4 + devB * 0.7, 2);
  else if (p.age <= 30) delta = gauss(-0.3 + devB * 0.3, 1.8);
  else delta = gauss(-1.8 - (p.age - 31) * 0.9, 1.6);
  if (p.ovr + delta > p.pot && delta > 0) delta = Math.max(0, (p.pot - p.ovr)) + gauss(0, 0.8);
  const w = OVR_W[p.pos];
  for (const k of RATING_KEYS) {
    const isKey = w[k] !== undefined;
    let d = isKey ? delta + gauss(0, 1.5) : delta * 0.4 + gauss(0, 1);
    if (k === 'spd' && p.age >= 29) d -= rand(0.5, 2);
    if (k === 'awr' && p.age <= 31) d += rand(0, 1.5);
    p.r[k] = Math.round(clamp(p.r[k] + d, 15, 99));
  }
  const prev = p.ovr; p.ovr = calcOvr(p);
  p.lastProg = p.ovr - prev;
  if (p.pot < p.ovr) p.pot = p.ovr;
}

function releaseToFA(L, p) {
  removeFromTeam(L, p);
  p.con = { sal: marketSalary(p), yrs: randi(1, 3) };
  if (!L.fa.includes(p.id)) L.fa.push(p.id);
}

function resignAsk(p) { return Math.round(marketSalary(p) * (p.ovr >= 85 ? 1.12 : 1.05) * 100) / 100; }

function finishResign(L) {
  // any user expiring players not re-signed go to FA
  const t = L.teams[L.userTid];
  for (const id of t.roster.slice()) { const p = L.players[id]; if (p.con.yrs <= 0) { releaseToFA(L, p); addNews(L, `${p.pos} ${pname(p)} left in free agency.`); } }
  L.phase = 'fa'; L.faDay = 1;
  for (const id of L.fa) { const p = L.players[id]; p.con = { sal: marketSalary(p), yrs: randi(1, 4) }; }
}

function faAsk(p) { return Math.round(marketSalary(p) * 1.08 * 100) / 100; }
function signFA(L, tid, p, yrs, sal, force) {
  const t = L.teams[tid];
  if (activeCount(L, t) >= ROSTER_MAX) return 'Roster is full (53 active players). Release someone first.';
  if (!force && capRoom(L, t) < sal) return 'Not enough cap space.';
  L.fa = L.fa.filter(id => id !== p.id);
  p.con = { sal: Math.round(sal * 100) / 100, yrs };
  addToTeam(L, p, tid);
  if (tid === L.userTid || p.ovr >= 80) addNews(L, `${L.teams[tid].abbr} signed ${p.pos} ${pname(p)} (${p.ovr} OVR) — ${yrs} yr / ${fmtMoney(sal)} per year.`);
  return null;
}

function needScore(L, t, pos) {
  const have = t.roster.filter(id => L.players[id].pos === pos).map(id => L.players[id]).sort((a, b) => b.ovr - a.ovr);
  const st = STARTERS[pos], target = ROSTER_TARGET[pos];
  let s = 0;
  if (have.length < target) s += (target - have.length) * 10;
  const startAvg = have.slice(0, st).reduce((a, p) => a + p.ovr, 0) / Math.max(1, Math.min(st, have.length) || 1);
  if (have.length < st) s += 40;
  s += Math.max(0, 78 - startAvg) * 0.8;
  return s;
}

function aiFreeAgencyRound(L, maxPerTeam = 1) {
  const pool = L.fa.map(id => L.players[id]).sort((a, b) => b.ovr - a.ovr);
  for (const t of shuffle(L.teams.slice())) {
    if (t.id === L.userTid) continue;
    for (let k = 0; k < maxPerTeam; k++) {
      if (activeCount(L, t) >= ROSTER_MAX - 1) break;
      let bestP = null, bestS = -1;
      for (const p of pool) {
        if (p.tid != null) continue;
        const ask = faAsk(p);
        if (ask > capRoom(L, t) - 2) continue;
        const s = needScore(L, t, p.pos) * 1.5 + p.ovr - ask * 0.3;
        if (s > bestS) { bestS = s; bestP = p; }
      }
      if (bestP && (needScore(L, t, bestP.pos) > 5 || bestP.ovr >= 75)) signFA(L, t.id, bestP, randi(1, 4), faAsk(bestP));
    }
  }
}

// in-season AI moves: fill holes from FA
function aiRosterMoves(L) {
  for (const t of L.teams) {
    if (t.id === L.userTid) continue;
    for (const pos of POSITIONS) {
      const healthy = t.roster.filter(id => L.players[id].pos === pos && !L.players[id].inj).length;
      if (healthy < STARTERS[pos] + (pos === 'K' || pos === 'P' ? 0 : 1)) {
        const cand = L.fa.map(id => L.players[id]).filter(p => p.pos === pos && faAsk(p) < capRoom(L, t)).sort((a, b) => b.ovr - a.ovr)[0];
        if (cand) {
          if (activeCount(L, t) >= ROSTER_MAX) cutWorst(L, t);
          signFA(L, t.id, cand, 1, faAsk(cand));
        }
      }
    }
  }
}
function cutWorst(L, t) {
  const cands = t.roster.map(id => L.players[id]).filter(p => {
    const same = t.roster.filter(id => L.players[id].pos === p.pos).length; return same > STARTERS[p.pos] + 1;
  }).sort((a, b) => playerValue(a) - playerValue(b));
  if (cands[0]) releaseToFA(L, cands[0]);
}

// ---------- draft ----------
function initPicks(L) {
  L.picks = [];
  for (const s of [L.season + 1, L.season + 2]) for (let r = 1; r <= 7; r++) for (const t of L.teams) L.picks.push({ season: s, round: r, orig: t.id, owner: t.id });
}
function pickLabel(L, pk) { return `${pk.season} R${pk.round}` + (pk.orig !== pk.owner ? ` (${L.teams[pk.orig].abbr})` : ''); }
function pickValue(L, pk) {
  const equivOvr = [0, 77, 71, 67, 63, 59, 56, 53][pk.round];
  // better value for picks from bad teams
  const t = L.teams[pk.orig]; const adj = (0.5 - pct(t)) * 6 * (L.phase === 'regular' ? Math.min(1, (t.w + t.l) / 8) : 1);
  const fake = { ovr: equivOvr + adj, age: 22, pot: equivOvr + adj + 8, pos: 'WR' };
  return playerValue(fake) * (pk.season > L.season + 1 ? 0.85 : 1);
}

function genDraftClass(L) {
  const cls = [];
  for (let i = 0; i < 256; i++) {
    const pos = weighted(POSITIONS, p => p === 'K' || p === 'P' ? 0.4 : ROSTER_TARGET[p]);
    const tier = i < 20 ? gauss(72, 4) : i < 60 ? gauss(66, 4) : i < 130 ? gauss(60, 4) : gauss(54, 5);
    const p = genPlayer(L, pos, clamp(tier, 40, 82), randi(21, 23));
    p.tid = -1; p.rookie = true;
    p.pot = Math.round(clamp(p.ovr + rand(4, 18) + (p.dev === 'X' ? 6 : p.dev === 'S' ? 3 : 0), p.ovr, 99));
    p.scout = { lo: p.ovr - randi(2, 7), hi: p.ovr + randi(2, 7), potG: potGrade(p.pot + gauss(0, 3)) };
    cls.push(p);
  }
  cls.sort((a, b) => (b.ovr * 0.7 + b.pot * 0.3 + gauss(0, 3)) - (a.ovr * 0.7 + a.pot * 0.3 + gauss(0, 3)));
  cls.forEach((p, i) => p.proj = Math.min(8, Math.floor(i / 32) + 1));
  return cls;
}
function potGrade(v) { return v >= 88 ? 'A+' : v >= 84 ? 'A' : v >= 80 ? 'B+' : v >= 76 ? 'B' : v >= 72 ? 'C+' : v >= 68 ? 'C' : 'D'; }

function draftOrder(L) {
  // worst to best regular season; playoff teams ordered by elimination, champ last
  const champ = L.history[0] && L.history[0].season === L.season ? L.history[0].champ : null;
  const runner = L.history[0] && L.history[0].season === L.season ? L.history[0].runner : null;
  const ids = L.teams.map(t => t.id).sort((a, b) => {
    const rank = id => id === champ ? 2 : id === runner ? 1 : 0;
    return rank(a) - rank(b) || pct(L.teams[a]) - pct(L.teams[b]) || (L.teams[a].pf - L.teams[a].pa) - (L.teams[b].pf - L.teams[b].pa);
  });
  return ids;
}

function startDraft(L) {
  L.phase = 'draft';
  const order = draftOrder(L);
  const season = L.season + 1;
  const slots = [];
  for (let r = 1; r <= 7; r++) for (const tid of order) {
    const pk = L.picks.find(p => p.season === season && p.round === r && p.orig === tid);
    slots.push({ round: r, owner: pk ? pk.owner : tid, orig: tid, pid: null });
  }
  L.draft = { slots, cur: 0 };
  addNews(L, `The ${season} Draft is underway!`);
}
function draftPick(L, pid) {
  const d = L.draft; const slot = d.slots[d.cur];
  const p = L.draftClass.find(x => x.id === pid); if (!p) return;
  L.draftClass = L.draftClass.filter(x => x.id !== pid);
  slot.pid = pid;
  const overall = d.cur + 1;
  p.draft = { season: L.season + 1, round: slot.round, pick: overall, tid: slot.owner };
  const sal = slot.round === 1 ? Math.max(3, 11.5 - (overall - 1) * 0.27) : slot.round === 2 ? 2.2 : 1.0 + (7 - slot.round) * 0.08;
  p.con = { sal: Math.round(sal * 100) / 100, yrs: 4 };
  delete p.scout; delete p.proj;
  addToTeam(L, p, slot.owner);
  if (slot.owner === L.userTid) addNews(L, `You drafted ${p.pos} ${pname(p)} (${p.col}) with pick #${overall}.`);
  d.cur++;
}
function aiDraftChoice(L, tid) {
  const t = L.teams[tid];
  let best = null, bs = -1e9;
  for (const p of L.draftClass.slice(0, 40)) {
    const s = p.ovr * 0.65 + p.pot * 0.35 + needScore(L, t, p.pos) * 0.12 + gauss(0, 1.5) - (p.pos === 'K' || p.pos === 'P' ? 8 : 0);
    if (s > bs) { bs = s; best = p; }
  }
  return best;
}
function draftAdvance(L, stopAtUser = true) {
  const d = L.draft;
  while (d.cur < d.slots.length) {
    const slot = d.slots[d.cur];
    if (stopAtUser && slot.owner === L.userTid) return;
    const p = aiDraftChoice(L, slot.owner); if (!p) break;
    draftPick(L, p.id);
  }
}
function draftDone(L) { return L.draft && L.draft.cur >= L.draft.slots.length; }

function startNewSeason(L) {
  // undrafted rookies -> FA
  for (const p of L.draftClass) { p.tid = null; p.con = { sal: 0.75, yrs: 1 }; delete p.scout; delete p.proj; L.players[p.id] = p; L.fa.push(p.id); }
  L.draftClass = [];
  L.season++;
  // AI fills rosters & cuts
  for (let i = 0; i < 4; i++) aiFreeAgencyRound(L, 2);
  for (const t of L.teams) {
    if (t.id !== L.userTid) { for (const id of t.roster) L.players[id].ir = false;
      while (t.roster.length > ROSTER_MAX) cutWorst(L, t); autoDepth(L, t); }
    else {
      // keep the user's team playable: auto-sign cheap depth if roster is thin
      let added = 0;
      while (t.roster.length < 46) {
        const pos = POSITIONS.slice().sort((a, b) => needScore(L, t, b) - needScore(L, t, a))[0];
        const c = L.fa.map(id => L.players[id]).filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0];
        if (!c) break;
        signFA(L, t.id, c, 1, 0.9, true); added++;
      }
      if (added) addNews(L, `Front office signed ${added} depth player${added > 1 ? 's' : ''} at minimum salary to fill out your roster.`);
      fixDepth(L, t);
    }
    t.w = t.l = t.t = t.pf = t.pa = 0;
  }
  // clean FA pool: drop old/bad
  L.fa = L.fa.filter(id => { const p = L.players[id]; if (p.ovr < 48 || p.age > 35) { delete L.players[id]; return false; } return true; });
  while (L.fa.length > 160) { const worst = L.fa.reduce((a, b) => L.players[a].ovr < L.players[b].ovr ? a : b); delete L.players[worst]; L.fa = L.fa.filter(x => x !== worst); }
  L.picks = L.picks.filter(p => p.season > L.season);
  for (const t of L.teams) L.picks.push(...Array.from({ length: 7 }, (_, r) => ({ season: L.season + 2, round: r + 1, orig: t.id, owner: t.id })));
  L.week = 1; L.phase = 'regular'; L.playoffs = null; L.draft = null;
  L.schedule = makeSchedule(L);
  L.draftClass = genDraftClass(L);
  addNews(L, `The ${L.season} season begins! Payroll: ${fmtMoney(payroll(L, L.teams[L.userTid]))} of ${fmtMoney(capOf(L))}.`);
}

// ---------- trades ----------
function tradeEval(L, otherTid, give, get) {
  // give/get: {players:[ids], picks:[pickObjs]} from user's perspective
  const val = side => side.players.reduce((s, id) => s + playerValue(L.players[id]), 0) + side.picks.reduce((s, pk) => s + pickValue(L, pk), 0);
  const theyGet = val(give), theyGive = val(get);
  const t = L.teams[otherTid], u = L.teams[L.userTid];
  const salIn = give.players.reduce((s, id) => s + L.players[id].con.sal, 0), salOut = get.players.reduce((s, id) => s + L.players[id].con.sal, 0);
  let reason = null;
  if (capRoom(L, t) + salOut - salIn < 0) reason = `${t.abbr} can't fit the salary under the cap.`;
  if (capRoom(L, u) + salIn - salOut < 0) reason = `You can't fit the incoming salary under the cap.`;
  if (activeCount(L, t) - get.players.length + give.players.length > ROSTER_MAX) reason = `${t.abbr} roster would exceed 53.`;
  if (activeCount(L, u) + get.players.length - give.players.length > ROSTER_MAX) reason = `Your roster would exceed 53.`;
  const ratio = theyGive > 0 ? theyGet / theyGive : (theyGet > 0 ? 9 : 0);
  return { theyGet, theyGive, ratio, ok: !reason && theyGet > 0 && ratio >= 1.08, reason };
}
function executeTrade(L, otherTid, give, get) {
  const u = L.userTid;
  for (const id of give.players) { const p = L.players[id]; removeFromTeam(L, p); addToTeam(L, p, otherTid); }
  for (const id of get.players) { const p = L.players[id]; removeFromTeam(L, p); addToTeam(L, p, u); }
  for (const pk of give.picks) pk.owner = otherTid;
  for (const pk of get.picks) pk.owner = u;
  const names = side => side.players.map(id => `${L.players[id].pos} ${pshort(L.players[id])}`).concat(side.picks.map(pk => pickLabel(L, pk))).join(', ') || 'nothing';
  addNews(L, `TRADE: ${L.teams[u].abbr} sends ${names(give)} to ${L.teams[otherTid].abbr} for ${names(get)}.`);
  autoDepth(L, L.teams[otherTid]);
}
function tradeAllowed(L) {
  if (L.phase === 'regular') return L.week <= 10;
  return ['resign', 'fa', 'recap'].includes(L.phase);
}

// ---------- save / load ----------
const SAVE_PREFIX = 'gridiron_dynasty_save_';
function saveLeague(L, slot) {
  try { localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(L)); return true; } catch (e) { console.warn(e); return false; }
}
function loadLeague(slot) {
  try { const s = localStorage.getItem(SAVE_PREFIX + slot); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function saveMeta(slot) {
  try {
    const s = localStorage.getItem(SAVE_PREFIX + slot); if (!s) return null;
    const L = JSON.parse(s); const t = L.teams[L.userTid];
    return { team: teamName(t), abbr: t.abbr, c1: t.c1, c2: t.c2, season: L.season, week: L.week, phase: L.phase, rec: recStr(t) };
  } catch (e) { return null; }
}
function deleteSave(slot) { try { localStorage.removeItem(SAVE_PREFIX + slot); } catch (e) { } }
