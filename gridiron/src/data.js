// ============================================================
// Gridiron Dynasty - data: utils, teams, names, player generation
// ============================================================
'use strict';

// ---------- utils ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const chance = p => Math.random() < p;
function gauss(mean = 0, sd = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function weighted(items, wfn) {
  let tot = 0; for (const it of items) tot += Math.max(0, wfn(it));
  let r = Math.random() * tot;
  for (const it of items) { r -= Math.max(0, wfn(it)); if (r <= 0) return it; }
  return items[items.length - 1];
}
const fmtMoney = m => '$' + (m >= 10 ? m.toFixed(1) : m.toFixed(2)) + 'M';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- league constants ----------
const CAP = 255;            // salary cap in $M
const ROSTER_MAX = 53;
const SEASON_WEEKS = 17;   // generated schedules; real schedules may have 18 weeks with byes
const capOf = L => (L && L.cap) || CAP;
const confsOf = L => (L && L.confs) || ['East', 'West'];
const weeksOf = L => (L && L.schedule && L.schedule.length) || SEASON_WEEKS;

// city, nickname, abbr, primary, secondary
const TEAM_DEFS = [
  // EAST CONFERENCE
  ['Boston', 'Ironclads', 'BOS', '#1b2a4a', '#c8a24a', 'East', 'North'],
  ['Toronto', 'Huskies', 'TOR', '#c8102e', '#f2f2f2', 'East', 'North'],
  ['Buffalo', 'Blizzard', 'BUF', '#2b6cb0', '#e2f1ff', 'East', 'North'],
  ['Montreal', 'Voyageurs', 'MTL', '#5b2a86', '#f4c542', 'East', 'North'],
  ['New York', 'Skyline', 'NYS', '#0b0b0b', '#3ec1d3', 'East', 'Metro'],
  ['Philadelphia', 'Liberty', 'PHL', '#0f5c4d', '#d9d9d9', 'East', 'Metro'],
  ['Baltimore', 'Hammers', 'BAL', '#7a1f1f', '#f0b429', 'East', 'Metro'],
  ['Washington', 'Sentinels', 'WAS', '#22313f', '#e05a2a', 'East', 'Metro'],
  ['Miami', 'Riptide', 'MIA', '#00a3ad', '#ff7a59', 'East', 'South'],
  ['Atlanta', 'Firebirds', 'ATL', '#b3121b', '#1a1a1a', 'East', 'South'],
  ['Charlotte', 'Copperheads', 'CHA', '#b8641f', '#1f2d3a', 'East', 'South'],
  ['Orlando', 'Comets', 'ORL', '#2d3e9e', '#ff9f1c', 'East', 'South'],
  ['Chicago', 'Steelhounds', 'CHI', '#3a3f47', '#ff6b00', 'East', 'Central'],
  ['Detroit', 'Motors', 'DET', '#0077b6', '#c0c0c0', 'East', 'Central'],
  ['Cleveland', 'Ironmen', 'CLE', '#6b3e26', '#ff8c1a', 'East', 'Central'],
  ['Pittsburgh', 'Forge', 'PIT', '#1c1c1c', '#ffcc00', 'East', 'Central'],
  // WEST CONFERENCE
  ['Seattle', 'Orcas', 'SEA', '#002b36', '#7fdbca', 'West', 'North'],
  ['Portland', 'Lumberjacks', 'POR', '#2f5d34', '#e9c46a', 'West', 'North'],
  ['Minneapolis', 'Frost', 'MIN', '#4a4e9c', '#bde0fe', 'West', 'North'],
  ['Milwaukee', 'Muskies', 'MIL', '#14532d', '#facc15', 'West', 'North'],
  ['Denver', 'Summit', 'DEN', '#1e3a5f', '#f97316', 'West', 'Mountain'],
  ['Salt Lake', 'Stallions', 'SLC', '#5c2d91', '#e2e8f0', 'West', 'Mountain'],
  ['Las Vegas', 'High Rollers', 'LV', '#111111', '#d4af37', 'West', 'Mountain'],
  ['Phoenix', 'Scorpions', 'PHX', '#9b2226', '#ee9b00', 'West', 'Mountain'],
  ['Houston', 'Wildcatters', 'HOU', '#0a2342', '#e63946', 'West', 'South'],
  ['Dallas', 'Marshals', 'DAL', '#1d3557', '#a8dadc', 'West', 'South'],
  ['San Antonio', 'Outlaws', 'SA', '#2b2d42', '#c0a080', 'West', 'South'],
  ['New Orleans', 'Krewe', 'NO', '#4b1d6b', '#2ec4b6', 'West', 'South'],
  ['Los Angeles', 'Stars', 'LA', '#003087', '#ffd100', 'West', 'Pacific'],
  ['San Diego', 'Surf', 'SD', '#0081a7', '#fdfcdc', 'West', 'Pacific'],
  ['San Francisco', 'Fog', 'SF', '#6c757d', '#d00000', 'West', 'Pacific'],
  ['Sacramento', 'Gold', 'SAC', '#3d405b', '#f2cc8f', 'West', 'Pacific'],
];

// ---------- positions ----------
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
const ROSTER_TARGET = { QB: 3, RB: 3, WR: 6, TE: 3, OL: 9, DL: 8, LB: 5, CB: 6, S: 4, K: 1, P: 1 }; // 49
const STARTERS = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 2, CB: 3, S: 2, K: 1, P: 1 };
const RATING_KEYS = ['spd', 'str', 'agi', 'awr', 'thp', 'tha', 'cat', 'rte', 'btk', 'rbk', 'prs', 'tkl', 'cov', 'kpw', 'kac'];
const RATING_NAMES = {
  spd: 'Speed', str: 'Strength', agi: 'Agility', awr: 'Awareness', thp: 'Throw Power', tha: 'Throw Accuracy',
  cat: 'Catching', rte: 'Route Running', btk: 'Break Tackle', rbk: 'Blocking', prs: 'Pass Rush', tkl: 'Tackling',
  cov: 'Coverage', kpw: 'Kick Power', kac: 'Kick Accuracy'
};
const OVR_W = {
  QB: { tha: .38, thp: .24, awr: .28, spd: .10 },
  RB: { spd: .30, agi: .25, btk: .25, cat: .10, awr: .10 },
  WR: { spd: .30, cat: .30, rte: .25, agi: .15 },
  TE: { cat: .30, rbk: .25, rte: .15, str: .15, spd: .15 },
  OL: { rbk: .50, str: .35, awr: .15 },
  DL: { prs: .45, str: .30, tkl: .15, spd: .10 },
  LB: { tkl: .35, spd: .20, cov: .20, awr: .15, prs: .10 },
  CB: { cov: .45, spd: .35, agi: .10, awr: .10 },
  S:  { cov: .35, tkl: .25, spd: .25, awr: .15 },
  K:  { kpw: .50, kac: .50 },
  P:  { kpw: .60, kac: .40 },
};
// baseline for non-key ratings
const BASE = {
  QB: { spd: 60, str: 55, agi: 60, btk: 40, cat: 30 },
  RB: { str: 62, rte: 55, rbk: 40 },
  WR: { str: 50, awr: 60, btk: 50, rbk: 40 },
  TE: { agi: 60, awr: 60, btk: 55 },
  OL: { spd: 52, agi: 50 },
  DL: { agi: 60, awr: 60, cov: 30 },
  LB: { str: 68, agi: 65 },
  CB: { str: 50, tkl: 55, cat: 55 },
  S:  { str: 60, agi: 68, cat: 50 },
  K:  { spd: 45, str: 40, agi: 45, awr: 60 },
  P:  { spd: 45, str: 40, agi: 45, awr: 60 },
};
const POS_SAL = { QB: 1.0, RB: .35, WR: .65, TE: .4, OL: .5, DL: .6, LB: .45, CB: .55, S: .4, K: .12, P: .1 };
const POS_VALUE = { QB: 1.6, RB: .8, WR: 1.0, TE: .8, OL: .85, DL: 1.0, LB: .85, CB: .95, S: .85, K: .3, P: .25 };

const FIRST = ('James Marcus Tyler Jalen Darius Caleb Malik Brandon Isaiah Josh Trey Andre Jordan Cameron Devin Xavier Kyle Tre Mason Elijah ' +
  'Bryce Jaylen Derrick Lamar Tavon Zach Noah Logan Ethan Hunter Cole Grant Dylan Austin Blake Chase Garrett Wyatt Brady Luke ' +
  'Micah Quinton Rashad Desmond Terrell Cedric Jamal Keenan Kendrick Dante Omar Reggie Tyrese Javon DeShawn Marquise Kobe Amari Jaxon ' +
  'Bo Sam Max Ty Jake Nate Ben Evan Owen Carter Ryder Colton Brock Drew Shane Troy Spencer Hayden Riley Parker Jace ' +
  'Mekhi Zion Keon Jahmir Cam Davion Aidan Gavin Rocco Dominic Mateo Luis Diego Andres Kai Koa Malakai Tua Sione Ike').split(' ');
const LAST = ('Johnson Williams Brown Jones Davis Miller Wilson Moore Taylor Anderson Thomas Jackson White Harris Martin Thompson Robinson ' +
  'Clark Lewis Walker Hall Allen Young King Wright Scott Green Baker Adams Nelson Hill Campbell Mitchell Carter Roberts Turner Phillips ' +
  'Parker Evans Edwards Collins Stewart Morris Murphy Cook Rogers Morgan Cooper Peterson Reed Bailey Bell Howard Ward Cox Richardson ' +
  'Wood Watson Brooks Bennett Gray James Hughes Price Sanders Myers Long Ross Foster Powell Jenkins Perry Russell Sullivan Butler ' +
  'Barnes Fisher Henderson Coleman Simmons Patterson Jordan Reynolds Hamilton Graham Wallace Woods West Cole Hayes Bryant Gibson ' +
  'Ellis Stevens Murray Ford Marshall Owens McDonald Harrison Kennedy Wells Dixon Hunt Palmer Holmes Mason Rice Black Daniels Knight ' +
  'Boone Hargrove Okafor Mabry Fuimaono Tagaloa Mbeki Castillo Delgado Ramos Vega Ortiz Sutton Pruitt Battle Moton Dyson Lockhart ' +
  'Fontenot Thibodeaux Broussard Landry Guidry Kincaid Stroud Whitfield Calloway Booker Crenshaw Dunbar Pickett Rhodes Steele Strong').split(' ');
const COLLEGES = ('Alabama;Georgia;Ohio State;Michigan;Texas;LSU;Oregon;USC;Clemson;Notre Dame;Penn State;Florida;Florida State;Miami;Oklahoma;' +
  'Tennessee;Auburn;Texas A&M;Washington;Utah;Wisconsin;Iowa;Ole Miss;Missouri;Kentucky;TCU;Baylor;UCLA;Stanford;Arizona State;' +
  'Boise State;Toledo;Appalachian St;North Dakota St;Jackson State;Tulane;Memphis;Cincinnati;Houston;Louisville;Pitt;Virginia Tech;Duke').split(';');

// ---------- players ----------
let _pid = 1;
function newPid(league) { if (league) return league.nextPid++; return _pid++; }

function calcOvr(p) {
  const w = OVR_W[p.pos]; let s = 0;
  for (const k in w) s += p.r[k] * w[k];
  return Math.round(clamp(s, 25, 99));
}

function genPlayer(league, pos, targetOvr, age) {
  const p = {
    id: newPid(league),
    first: pick(FIRST), last: pick(LAST),
    pos, age: age || randi(22, 33),
    r: {}, tid: null,
    num: 0,
    dev: weighted([['N', 70], ['S', 23], ['X', 7]], x => x[1])[0], // Normal, Star, Superstar(X-Factor)
    inj: 0,
    con: { sal: 1, yrs: 1 },
    st: {}, career: [], col: pick(COLLEGES),
    rookie: false, draft: null,
  };
  const w = OVR_W[pos], b = BASE[pos];
  for (const k of RATING_KEYS) {
    let v;
    if (w[k] !== undefined) v = targetOvr + gauss(0, 4.5);
    else if (b[k] !== undefined) v = b[k] + gauss(0, 6);
    else v = randi(20, 45);
    p.r[k] = Math.round(clamp(v, 15, 99));
  }
  // physical archetype tweaks
  if (pos === 'OL' || pos === 'DL') p.r.str = Math.round(clamp(p.r.str + 6, 15, 99));
  if (pos === 'WR' || pos === 'CB') p.r.spd = Math.round(clamp(p.r.spd + 3, 15, 99));
  p.ovr = calcOvr(p);
  // potential: younger players more upside
  const upside = Math.max(0, (27 - p.age)) * rand(1, 3.2) + (p.dev === 'X' ? 6 : p.dev === 'S' ? 3 : 0);
  p.pot = Math.round(clamp(p.ovr + upside + gauss(0, 3), p.ovr, 99));
  p.num = jerseyNum(pos);
  return p;
}

function jerseyNum(pos) {
  const ranges = { QB: [1, 19], RB: [20, 39], WR: [1, 19], TE: [80, 89], OL: [60, 79], DL: [90, 99], LB: [40, 59], CB: [20, 39], S: [20, 49], K: [1, 19], P: [1, 19] };
  const r = ranges[pos]; return randi(r[0], r[1]);
}

function marketSalary(p) {
  const base = Math.pow(clamp((p.ovr - 55) / 44, 0, 1), 2.6);
  let ageF = p.age <= 27 ? 1 : p.age <= 30 ? 0.95 : p.age <= 32 ? 0.8 : p.age <= 34 ? 0.55 : 0.35;
  const sal = 0.8 + base * 52 * POS_SAL[p.pos] * ageF;
  return Math.round(sal * 100) / 100;
}

function setContract(p, yrs) {
  p.con = { sal: marketSalary(p), yrs: yrs || randi(1, 5) };
}

function playerValue(p) {
  const base = Math.pow(Math.max(0, p.ovr - 40), 2.2);
  const ageF = p.age <= 24 ? 1.25 : p.age <= 27 ? 1.1 : p.age <= 29 ? 0.95 : p.age <= 31 ? 0.7 : p.age <= 33 ? 0.45 : 0.25;
  const potF = 1 + Math.max(0, p.pot - p.ovr) / 60;
  return base * ageF * potF * POS_VALUE[p.pos];
}

function devLabel(d) { return d === 'X' ? 'Superstar X' : d === 'S' ? 'Star' : 'Normal'; }
function pname(p) { return p.first + ' ' + p.last; }
function pshort(p) { return p.first[0] + '. ' + p.last; }
function ovrClass(o) { return o >= 90 ? 'o-elite' : o >= 80 ? 'o-good' : o >= 70 ? 'o-ok' : o >= 60 ? 'o-meh' : 'o-bad'; }
