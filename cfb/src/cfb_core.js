// ============================================================
// College Gridiron Dynasty - core: schools, class years, redshirts,
// NIL value model, league creation from CFB_DATA (real 2026 rosters)
// Everything here wraps or replaces pieces of the shared NFL engine.
// ============================================================
'use strict';

const CONF_ORDER = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'American', 'Mountain West', 'Sun Belt', 'C-USA', 'MAC', 'Ind'];
const P4 = ['SEC', 'Big Ten', 'Big 12', 'ACC'];
const CONF_GAMES = { SEC: 9, 'Big Ten': 9, 'Big 12': 9, ACC: 8, 'Pac-12': 8, American: 8, 'Mountain West': 8, 'Sun Belt': 8, 'C-USA': 8, MAC: 8, Ind: 0 };
const CFB_ROSTER_MAX = 85, CFB_ROSTER_MIN = 62;
// college depth targets (shared object, mutated in place)
Object.assign(ROSTER_TARGET, { QB: 4, RB: 5, WR: 9, TE: 4, OL: 14, DL: 12, LB: 8, CB: 8, S: 6, K: 2, P: 1 });
const CLS_NAME = ['', 'FR', 'SO', 'JR', 'SR'];
function clsLabel(p) { return (p.rs ? 'RS ' : '') + (CLS_NAME[p.cls] || 'SR'); }
function isP4(t) { return P4.includes(t.conf) || t.abbr === 'ND'; }
function prestigeStars(n) { return '★'.repeat(n) + '<span class="dim">' + '★'.repeat(Math.max(0, 6 - n)) + '</span>'; }
function starsStr(n) { return n ? '★'.repeat(n) : '—'; }

// US regions for recruiting pipelines
const REGION = {
  South: 'AL GA FL MS LA SC TN AR', Texas: 'TX OK', Mid: 'NC VA KY WV MD DC DE', East: 'PA NJ NY CT MA RI NH VT ME',
  Midwest: 'OH MI IN IL WI MN IA MO KS NE ND SD', West: 'CA OR WA NV AZ UT CO ID MT WY NM HI AK',
};
const STATE_REGION = {}; for (const r in REGION) for (const s of REGION[r].split(' ')) STATE_REGION[s] = r;
function proximity(a, b) { if (!a || !b) return 0.25; if (a === b) return 1; return STATE_REGION[a] && STATE_REGION[a] === STATE_REGION[b] ? 0.62 : 0.18; }

// ---------- NIL (this game's own estimate, not any outside valuation) ----------
const NIL_POS = { QB: 1.0, WR: .55, RB: .45, DL: .5, CB: .45, OL: .38, LB: .36, S: .34, TE: .36, K: .08, P: .06 };
function nilValue(L, p) { // $M per year
  const t = p.tid != null && p.tid >= 0 ? L.teams[p.tid] : null;
  const pres = t ? t.prestige : 3;
  const base = Math.pow(clamp((p.ovr - 55) / 40, 0, 1), 2.7) * 2.6;
  const market = 0.32 + 0.68 * pres / 6;
  const hype = 1 + (p.stars || 0) * 0.04 + (p.dev === 'X' ? 0.3 : p.dev === 'S' ? 0.1 : 0) + (p.st && p.st.gp ? 0.05 : 0);
  return Math.round(Math.max(0.004, base * NIL_POS[p.pos] * market * hype + 0.004) * 1000) / 1000;
}
function fmtNil(m) { m = m || 0; if (m <= 0) return '$0'; return m >= 1 ? '$' + m.toFixed(m >= 10 ? 1 : 2) + 'M' : '$' + Math.max(0, Math.round(m * 1000)) + 'K'; }
function nilBudgetFor(t) { // collective + revenue share, $M per season
  const base = [0, 1.6, 3.2, 6.5, 12, 20, 29][clamp(t.prestige, 1, 6)];
  const p4 = isP4(t) ? 1.15 : 0.85;
  return Math.round(base * p4 * (0.92 + ((t.talent || 50) / 100) * 0.16) * 10) / 10;
}
payroll = function (L, t) { return t.roster.reduce((s, id) => s + (L.players[id].con ? L.players[id].con.sal : 0), 0); };
capRoom = function (L, t) { return Math.round(((t.nilBudget || 0) - payroll(L, t) - (t.nilPromised || 0)) * 1000) / 1000; };


// ---------- names for generated people (recruits, walk-ons, coaches) ----------
const CFB_FIRST = FIRST.concat(('Aiden Jayden Braylon Kaden Treyvon Jamarion Kamari Ja\'Marr Zaire Deion Malachi Josiah Isaac Gage Colt Tate Reid Brooks Beau Cooper Easton Hudson ' +
  'Landon Maddox Nico Rome Sincere Trevor Wesley Xzavier Yusuf Zeke Amare Bryson Cade Dashawn Emeka Fisher Graham Hollis Ishmael Jett Kingston Lachlan Marquez Nasir Obi ' +
  'Pierce Quincy Ronan Solomon Tobias Ulysses Vance Wade Ayden Brayden Camden Darnell Elias Finn Gunner Holden Jaxson Keegan Legend Major Navy Onyx Princeton Royal Saint Titus').split(' '));
const CFB_LAST = LAST.concat(('Abernathy Alcorn Bankston Beasley Blackwell Bonner Bowden Burrell Cagle Chambers Coker Dorsey Eason Fairley Fowler Gaines Gentry Grimes Hairston ' +
  'Hollins Hubbard Ingram Jeter Kearse Lackey Ledbetter Lyles Maddox McCray Mosley Nall Odom Overton Pace Plummer Quarles Ragland Rowe Sapp Sims Spears Swann Tatum ' +
  'Tillman Upshaw Vick Waddell Whitley Yancey Zeigler Achebe Adeyemi Faleolo Leota Mauga Tuipulotu Vainikolo Kahananui Okonkwo Nwosu Eze Aguilar Benavidez Cervantes').split(' '));
function genName() { return { first: pick(CFB_FIRST), last: pick(CFB_LAST) }; }
function genCoachName() { const n = genName(); return n.first + ' ' + n.last; }

// generated college player (walk-on / recruit conversion)
function genCollegePlayer(L, pos, ovr, cls, opts = {}) {
  const p = genPlayer(L, pos, clamp(ovr, 30, 99), 17 + cls + (opts.rs ? 1 : 0));
  const n = genName(); p.first = opts.first || n.first; p.last = opts.last || n.last;
  p.cls = cls; p.rs = opts.rs ? 1 : 0; p.stars = opts.stars || 0; p.home = opts.home || pick(['TX', 'FL', 'CA', 'GA', 'OH', 'AL', 'LA', 'NC', 'PA', 'VA', 'TN', 'SC', 'MS', 'MI', 'IL']);
  p.dev = opts.dev || p.dev;
  p.pot = Math.round(clamp(opts.pot || (p.ovr + (5 - cls) * rand(2, 5) + gauss(0, 3)), p.ovr, 99));
  p.col = ''; p.con = { sal: opts.nil || 0, yrs: 1 };
  return p;
}
function walkOn(L, pos, cls) {
  const o = clamp(gauss(47 + cls * 2.5, 4), 38, 60);
  return genCollegePlayer(L, pos, o, cls, { stars: chance(0.4) ? 2 : 0, nil: 0 });
}

function teamAddPlayer(L, p, tid) { // fast add (no jersey shuffling cost beyond the check)
  L.players[p.id] = p; p.tid = tid; const t = L.teams[tid];
  if (!t.roster.includes(p.id)) t.roster.push(p.id);
  const used = new Set(t.roster.filter(id => id !== p.id).map(id => L.players[id].num));
  let tries = 0; while (used.has(p.num) && tries++ < 60) p.num = randi(0, 99);
}
function fillPositions(L, t, toMin) {
  const need = toMin ? { QB: 3, RB: 3, WR: 6, TE: 3, OL: 10, DL: 8, LB: 6, CB: 5, S: 4, K: 1, P: 1 } : ROSTER_TARGET;
  let n = 0;
  for (const pos of POSITIONS) {
    let have = t.roster.filter(id => L.players[id].pos === pos).length;
    while (have < need[pos]) { teamAddPlayer(L, walkOn(L, pos, randi(1, 3)), t.id); have++; n++; }
  }
  return n;
}

// ---------- coaches ----------
function initCoach(t, name) {
  t.coach = name || genCoachName();
  t.coachRating = Math.round(clamp(52 + t.prestige * 5 + gauss(0, 7), 40, 95));
  t.coachYrs = randi(1, 6); t.heat = 0; t.coachChanged = false;
}

// ---------- league ----------
function newCfbLeague(userAbbr, opts = {}) {
  const D = CFB_DATA;
  const L = {
    version: 1, cfb: true, real: true, nextPid: 1, season: D.season, week: 1, phase: 'regular',
    userTid: 0, teams: [], players: {}, fa: [], schedule: [], playoffs: null,
    draftClass: [], picks: [], news: [], history: [], awards: [], draft: null,
    settings: Object.assign({ qlen: 240, diff: 'pro', simDef: false, autoSave: true, coachName: '' }, opts.settings || {}),
    confs: [], dataAsOf: D.asOf, recruits: [], rboard: [], poll: [], nflDraft: [], security: 70, programs: {},
  };
  const idx = {};
  D.teams.forEach(([abbr, school, nick, c1, c2, conf, coach, stadium, state, prestige, talent], i) => {
    idx[abbr] = i;
    const t = { id: i, city: school, name: nick, abbr, c1, c2, conf: CONF_ORDER.includes(conf) ? conf : 'Ind', div: '', stadium: stadium || (school + ' Stadium'), state: state || '',
      prestige: clamp(prestige || 3, 1, 6), talent: talent || 50, roster: [], depth: {}, w: 0, l: 0, t: 0, pf: 0, pa: 0, cw: 0, cl: 0,
      titles: 0, confTitles: 0, bowlWins: 0, cfpApps: 0, nflPicks: 0, elo: 1500, rank: 0 };
    initCoach(t, coach);
    L.teams.push(t);
  });
  L.confs = CONF_ORDER.filter(c => L.teams.some(t => t.conf === c));
  for (const row of D.players) {
    const [first, last, pos, cls, rs, num, ovr0, pot0, dev, home, stars, tm, ov] = row;
    if (idx[tm] == null || !POSITIONS.includes(pos)) continue;
    // the source curve is generous at the top; compress it so year one matches the dynasty's long-run talent level
    const squeeze = v => v > 80 ? Math.round(80 + (v - 80) * 0.76 + Math.max(0, v - 96) * 1.2) : v;
    const ovr = squeeze(ovr0), pot = Math.max(ovr, squeeze(pot0));
    const p = genPlayer(L, pos, ovr, 17 + clamp(cls, 1, 4) + (rs ? 1 : 0));
    p.first = first; p.last = last; p.num = num || jerseyNum(pos); p.dev = dev || 'N'; p.col = '';
    p.cls = clamp(cls || 1, 1, 4); p.rs = rs ? 1 : 0; p.home = home || ''; p.stars = stars || 0;
    const locked = ov || {}; for (const k in locked) p.r[k] = locked[k];
    fitOvr(p, ovr, locked);
    p.pot = Math.round(clamp(Math.max(pot || 0, p.ovr), p.ovr, 99));
    p.con = { sal: 0, yrs: 1 };
    L.players[p.id] = p; p.tid = idx[tm]; L.teams[p.tid].roster.push(p.id);
  }
  for (const t of L.teams) {
    fillPositions(L, t, false);
    autoDepth(L, t);
    t.nilBudget = nilBudgetFor(t);
    initDeals(L, t);
  }
  L.userTid = idx[userAbbr] != null ? idx[userAbbr] : 0;
  // real 2026 schedule when available, otherwise generated
  const real = (D.schedule || []).map(wk => wk.filter(g => idx[g[0]] != null && idx[g[1]] != null)
    .map(([h, a, n]) => ({ h: idx[h], a: idx[a], hs: null, as: null, n: n ? 1 : 0 }))).filter(wk => wk.length);
  L.schedule = real.length >= 10 ? dedupeWeeks(real) : makeCfbSchedule(L);
  L.realSchedule = real.length >= 10;
  for (const t of L.teams) t.elo = preseasonElo(L, t);
  updatePoll(L, true);
  genRecruitClass(L);
  computeDraftCuts(L);
  L.startSeason = L.season;
  return L;
}
// a team can only appear once per week
function dedupeWeeks(weeks) {
  return weeks.map(wk => { const seen = new Set(); return wk.filter(g => { if (seen.has(g.h) || seen.has(g.a) || g.h === g.a) return false; seen.add(g.h); seen.add(g.a); return true; }); });
}

// starting NIL deals: estimated value, scaled so each school sits a little under its budget
function initDeals(L, t) {
  const ps = t.roster.map(id => L.players[id]);
  const est = ps.map(p => nilValue(L, p) * rand(0.75, 1.05));
  const tot = est.reduce((a, b) => a + b, 0), cap = t.nilBudget * 0.86;
  const f = tot > cap ? cap / tot : 1;
  t.nilScale = Math.round(f * 100) / 100; // how far below "market" this school pays across the board
  ps.forEach((p, i) => { p.con = { sal: Math.round(est[i] * f * 1000) / 1000, yrs: 1 }; });
}

function preseasonElo(L, t) {
  const o = teamOvr(L, t).ovr;
  return 1500 + (o - 72) * 24 + (t.prestige - 3) * 18 + (t.coachRating - 70) * 1.2;
}

// lineup: honour the user's redshirt plans (those players only play if nobody else can)
const _lineupC = lineup;
lineup = function (L, t, extra = 1) {
  if (!L.cfb || t.id !== L.userTid) return _lineupC(L, t, extra);
  fixDepth(L, t);
  const saved = t.depth, tmp = {};
  for (const pos of POSITIONS) { const a = saved[pos] || []; tmp[pos] = a.filter(id => !L.players[id].rsPlan).concat(a.filter(id => L.players[id].rsPlan)); }
  t.depth = tmp; const out = _lineupC(L, t, extra); t.depth = saved; return out;
};
// no free agency or trades in college
aiRosterMoves = function () { };
aiTradeWeek = function () { };
tradeAllowed = function () { return false; };

// age / class helpers for display
function eligLeft(p) { return Math.max(0, 4 - p.cls) + (p.rs ? 0 : 1); } // seasons left after this one incl. a possible redshirt
function draftScore(p) { return p.ovr + (p.dev === 'X' ? 3 : p.dev === 'S' ? 1 : 0) + (p.pos === 'QB' ? 2 : p.pos === 'K' || p.pos === 'P' ? -10 : 0) + (p.pot - p.ovr) * 0.15; }
// NFL draft rounds are rank-based: ~257 picks per year across all draft-eligible college players
function computeDraftCuts(L, minYrs = 2) {
  const sc = Object.values(L.players).filter(p => p.tid != null && p.tid >= 0 && (p.cls - 1) + p.rs >= minYrs).map(draftScore).sort((a, b) => b - a);
  L.draftCuts = [1, 2, 3, 4, 5, 6, 7].map(r => sc[Math.min(sc.length - 1, Math.round(r * 36.7) - 1)] || 99);
}
function draftGrade(p) { // projected NFL round (8 = undrafted)
  const cuts = (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.draftCuts) || [92, 88, 85, 83, 81, 79, 77];
  const s = draftScore(p);
  for (let r = 0; r < 7; r++) if (s >= cuts[r]) return r + 1;
  return 8;
}
