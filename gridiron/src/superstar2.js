// ============================================================
// Gridiron Dynasty - Superstar mode, part 2: archetypes with a
// signature ability, weekly training (timing mini-game), coach trust
// (more plays designed for you), post-game grade + recap, game log,
// milestones, brand / followers / endorsements, a gear shop that shows
// up on your player in 3D, and a Hall of Fame legacy tracker.
// ============================================================
'use strict';

const SS_ARCH = {
  QB: [['pocket', 'Pocket Passer', { tha: 6, thp: 3, awr: 5, spd: -6 }, 'laser'], ['dual', 'Dual Threat', { spd: 9, agi: 7, tha: -3 }, 'escape'], ['gun', 'Gunslinger', { thp: 10, awr: -2 }, 'laser']],
  RB: [['power', 'Power Back', { str: 7, btk: 9, spd: -2 }, 'freight'], ['elusive', 'Elusive Back', { agi: 9, spd: 5, str: -4 }, 'ankle'], ['receiving', 'Receiving Back', { cat: 10, rte: 7 }, 'ankle']],
  WR: [['deep', 'Deep Threat', { spd: 8, agi: 3, str: -3 }, 'deep'], ['route', 'Route Technician', { rte: 9, cat: 4 }, 'glue'], ['physical', 'Physical Receiver', { str: 7, btk: 7, cat: 4, spd: -2 }, 'glue']],
  TE: [['vertical', 'Vertical Threat', { spd: 6, cat: 6 }, 'glue'], ['blocking', 'Blocking TE', { rbk: 12, str: 7 }, 'freight']],
  DL: [['speed', 'Speed Rusher', { spd: 7, prs: 7, str: -3 }, 'edge'], ['power', 'Power Rusher', { str: 9, prs: 5 }, 'wall']],
  LB: [['run', 'Run Stopper', { tkl: 9, str: 5 }, 'heat'], ['cover', 'Coverage LB', { cov: 9, spd: 4 }, 'lock'], ['rush', 'Pass Rusher', { prs: 10, spd: 3 }, 'edge']],
  CB: [['lock', 'Lockdown', { cov: 9, spd: 2 }, 'lock'], ['hawk', 'Ballhawk', { cat: 11, awr: 5 }, 'hawk']],
  S: [['hybrid', 'Hybrid Safety', { cov: 6, tkl: 6 }, 'hawk'], ['hitter', 'Enforcer', { tkl: 7, str: 7 }, 'heat']],
};
const SS_DRILLS = {
  QB: [['Pocket drill', ['awr', 'tha']], ['Long ball', ['thp']], ['Footwork', ['spd', 'agi']]],
  RB: [['Ball security', ['btk', 'str']], ['Cone drill', ['agi', 'spd']], ['Hands drill', ['cat']]],
  WR: [['Route tree', ['rte']], ['Jugs machine', ['cat']], ['Speed ladder', ['spd', 'agi']]],
  TE: [['Route tree', ['rte']], ['Sled drive', ['rbk', 'str']], ['Jugs machine', ['cat']]],
  DL: [['Rush moves', ['prs']], ['Sled drive', ['str']], ['Get-off drill', ['spd', 'agi']]],
  LB: [['Tackling circuit', ['tkl']], ['Zone drops', ['cov', 'awr']], ['Blitz timing', ['prs', 'spd']]],
  CB: [['Mirror drill', ['cov']], ['Ball skills', ['cat', 'awr']], ['Backpedal', ['spd', 'agi']]],
  S: [['Read & react', ['awr', 'cov']], ['Open-field tackling', ['tkl']], ['Ball skills', ['cat']]],
};
const SS_BADGES = [
  ['td1', 'First touchdown', p => ssTot(p).td >= 1], ['g100', '100-yard game', (p, b) => b && ((b.ry || 0) + (b.rcy || 0) >= 100 || (b.py || 0) >= 300)],
  ['g3td', 'Three-TD game', (p, b) => b && ((b.ptd || 0) + (b.rtd || 0) + (b.rctd || 0)) >= 3], ['int1', 'First interception', p => (ssTot(p).dint || 0) >= 1],
  ['sk1', 'First sack', p => (ssTot(p).sk || 0) >= 1], ['k1000', '1,000-yard season', p => ((p.st.ry || 0) + (p.st.rcy || 0)) >= 1000 || (p.st.py || 0) >= 4000],
  ['d100', '100-tackle season', p => (p.st.tk || 0) >= 100], ['sk10', '10-sack season', p => (p.st.sk || 0) >= 10],
  ['ovr80', 'Reach 80 OVR', p => p.ovr >= 80], ['ovr90', 'Reach 90 OVR', p => p.ovr >= 90], ['ovr99', 'Reach 99 OVR', p => p.ovr >= 99],
  ['allpro', 'All-Pro', (p, b, L) => (L.awards || []).some(a => (a.allpro || []).some(x => x.id === p.id))],
  ['award', 'Major award', (p) => (p.awards || []).length > 0], ['champ', 'Champion', (p, b, L) => (L.history || []).some(h => h.champ === p.tid && h.season >= (L.superstar.since || 0))],
  ['td50', '50 career TDs', p => ssTot(p).td >= 50], ['fans1m', '1 million followers', (p, b, L) => L.superstar.fans >= 1e6],
];
const SS_DEALS = [[10000, 'Local car dealership', 0.3], [50000, 'Sports drink', 1.2], [250000, 'Sneaker deal', 4], [1000000, 'Video game cover', 10], [3000000, 'Signature shoe line', 25]];
const SS_GEAR = {
  visor: [['none', 'No visor', 0], ['dark', 'Dark visor', 0.4], ['gold', 'Gold visor', 1.5], ['clear', 'Clear visor', 0.3]],
  gloves: [['team', 'Team gloves', 0], ['black', 'Black gloves', 0.2], ['white', 'White gloves', 0.2], ['gold', 'Gold gloves', 1]],
  cleats: [['std', 'Standard cleats', 0], ['white', 'White cleats', 0.3], ['black', 'Black cleats', 0.3], ['gold', 'Gold cleats', 2], ['team', 'Team-color cleats', 0.6]],
  sleeve: [['none', 'No arm sleeve', 0], ['black', 'Black sleeve', 0.2], ['white', 'White sleeve', 0.2], ['team', 'Team sleeve', 0.4]],
};
const ssTot = p => { const t = careerTotals(p.career || []); for (const k in p.st || {}) t[k] = (t[k] || 0) + p.st[k]; t.td = (t.ptd || 0) + (t.rtd || 0) + (t.rctd || 0) + (t.krtd || 0); return t; };
function ssS(L) { const s = L.superstar; if (!s) return null; if (s.trust == null) Object.assign(s, { trust: 45, fans: 1500, cash: 0, deals: [], badges: {}, games: [], gear: { visor: 'none', gloves: 'team', cleats: 'std', sleeve: 'none' }, owned: {}, train: {}, trained: null, since: L.season }); return s; }

// ---------- creation: archetype + number ----------
let SS_PENDING = { arch: null, num: null };
const _ssCreate2 = ssCreate;
ssCreate = function (L, first, last, pos) {
  const p = _ssCreate2(L, first, last, pos), s = ssS(L);
  const arch = (SS_ARCH[pos] || []).find(a => a[0] === SS_PENDING.arch) || (SS_ARCH[pos] || [])[0];
  if (arch) { for (const k in arch[2]) p.r[k] = clamp(p.r[k] + arch[2][k], 30, 99); p.ovr = calcOvr(p); p.abil = p.abilFixed = arch[3]; s.arch = arch[1]; }
  if (SS_PENDING.num != null && SS_PENDING.num >= 0 && SS_PENDING.num <= 99) p.num = SS_PENDING.num;
  SS_PENDING = { arch: null, num: null };
  return p;
};
const _abilOfSS = abilOf;
abilOf = function (p) { if (p && p.star && p.abilFixed) return p.abilFixed; return _abilOfSS(p); };
function archOpts(pos, sel) { return (SS_ARCH[pos] || []).map(a => `<option value="${a[0]}" ${sel === a[0] ? 'selected' : ''}>${a[1]} — ${ABIL[a[3]][0]}</option>`).join(''); }
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'ssPos' || id === 'ssPos2') { const a = document.getElementById(id === 'ssPos' ? 'ssArch' : 'ssArch2'); if (a) { a.innerHTML = archOpts(e.target.value); SS_PENDING.arch = a.value; } }
  if (id === 'ssArch' || id === 'ssArch2') SS_PENDING.arch = e.target.value;
  if (id === 'ssNum' || id === 'ssNum2') SS_PENDING.num = e.target.value === '' ? null : clamp(+e.target.value, 0, 99);
  if (id === 'setSS' && e.target.checked) { const a = document.getElementById('ssArch'); if (a && !a.options.length) { a.innerHTML = archOpts(($('#ssPos') || {}).value || 'WR'); SS_PENDING.arch = a.value; } }
});

// ---------- coach trust: more plays designed for you ----------
LiveGame.prototype.starRole = function () {
  const p = ssPlayer(this.L); if (!p) return null; const lu = this.gs.lu[this.user]; if (!lu) return null;
  if (p.pos === 'WR') { const i = lu.WR.indexOf(p); return i >= 0 ? 'WR' + (i + 1) : null; }
  return p.pos;
};
const _autoOffCallSS = autoOffCall;
autoOffCall = function (gs) {
  const id = _autoOffCallSS(gs), L = LEAGUE, s = L && ssS(L), lg = GAME && GAME.live;
  if (!s || !lg || lg.starMode() !== 'off' || id === 'fg' || id === 'punt') return id;
  if (!chance(0.15 + s.trust / 170)) return id;
  const role = lg.starRole(); if (!role) return id;
  const deep = ['go', 'post', 'corner', 'seam', 'dig', 'wheel', 'comeback'];
  const pool = OFF_PLAYS.filter(pl => !pl.custom && pl.cat !== 'Trick' && pl.cat !== 'Goal Line' && (role === 'RB' ? (pl.type === 'run' || (pl.routes && ['screen', 'flat', 'wheel'].includes(pl.routes.RB))) : (pl.type === 'pass' && pl.routes && pl.routes[role] && pl.routes[role] !== 'block' && (gs.togo <= 4 || deep.includes(pl.routes[role]) || chance(0.4)))));
  if (!pool.length) return id;
  const pick1 = pick(pool); lg._featured = true; return pick1.id;
};
const _opennessSS2 = LiveGame.prototype.openness;
LiveGame.prototype.openness = function (r) {
  const v = _opennessSS2.call(this, r), s = this.L && ssS(this.L);
  if (s && r.p && r.p.star && this.passer !== this.ctrl) return v + (s.trust - 50) / 80 + (this._featured ? 0.6 : 0);
  return v;
};
const _nextSS2 = LiveGame.prototype.next;
LiveGame.prototype.next = function () { this._featured = false; return _nextSS2.call(this); };
const _chooseSS2 = LiveGame.prototype.choose;
LiveGame.prototype.choose = function (id) { const r = _chooseSS2.call(this, id); if (this._featured && this.starMode && this.starMode() === 'off') this.h.toast && this.h.toast(`📋 ${this.offPlay ? this.offPlay.name : 'Play'} — designed for you!`, 1600); return r; };

// ---------- game grade, recap, followers, badges ----------
function ssPerf(p, b) {
  if (p.pos === 'QB') return (b.py || 0) / 30 + (b.ptd || 0) * 4 - (b.pint || 0) * 5 + (b.ry || 0) / 10 + (b.rtd || 0) * 4 + ((b.pc || 0) / Math.max(1, b.pa || 0) > 0.68 ? 2 : 0);
  if (SS_OFF.includes(p.pos)) return ((b.ry || 0) + (b.rcy || 0)) / 12 + (b.rec || 0) * 0.6 + ((b.rtd || 0) + (b.rctd || 0)) * 6 + (b.btk || 0) * 0.8 - (b.fum || 0) * 5;
  return (b.tk || 0) * 1.2 + (b.sk || 0) * 5 + (b.dint || 0) * 7 + (b.pd || 0) * 2.5 + (b.ff || 0) * 5;
}
const ssGrade = v => v >= 20 ? 'A+' : v >= 15 ? 'A' : v >= 11 ? 'B+' : v >= 8 ? 'B' : v >= 5 ? 'C' : v >= 2 ? 'D' : 'F';
function ssLine(p, b) {
  if (p.pos === 'QB') return `${b.pc || 0}/${b.pa || 0}, ${b.py || 0} yds, ${b.ptd || 0} TD, ${b.pint || 0} INT${b.ry ? `, ${b.ry} rush yds` : ''}`;
  if (p.pos === 'RB') return `${b.ra || 0} car, ${b.ry || 0} yds${b.rec ? `, ${b.rec} rec ${b.rcy} yds` : ''}${(b.rtd || 0) + (b.rctd || 0) ? `, ${(b.rtd || 0) + (b.rctd || 0)} TD` : ''}`;
  if (SS_OFF.includes(p.pos)) return `${b.rec || 0} rec, ${b.rcy || 0} yds${b.rctd ? `, ${b.rctd} TD` : ''}${b.tgt ? ` (${b.tgt} targets)` : ''}`;
  return `${b.tk || 0} tkl${b.sk ? `, ${b.sk} sk` : ''}${b.dint ? `, ${b.dint} INT` : ''}${b.pd ? `, ${b.pd} PD` : ''}${b.ff ? `, ${b.ff} FF` : ''}`;
}
let SS_LIVE = false;
const _recordGameSS2 = recordGame;
recordGame = function (L, g, res) {
  const s = L && ssS(L), p = s && ssPlayer(L), xp0 = s ? s.xp : 0;
  _recordGameSS2(L, g, res);
  if (!p || !res.box || (g.h !== p.tid && g.a !== p.tid)) return;
  const b = res.box[p.id] || {}, home = g.h === p.tid, us = home ? g.hs : g.as, them = home ? g.as : g.hs, won = us > them;
  const perf = ssPerf(p, b), grade = ssGrade(perf), xp = s.xp - xp0;
  const dTrust = { 'A+': 6, A: 4, 'B+': 2, B: 1, C: -1, D: -4, F: -6 }[grade] + (won ? 1 : -1);
  s.trust = clamp(s.trust + dTrust, 0, 100);
  const tds = (b.ptd || 0) + (b.rtd || 0) + (b.rctd || 0) + (b.dint || 0) * 0.5 + (b.sk || 0) * 0.4;
  const gain = Math.round((s.fans * 0.015 + 300) * (1 + perf / 10) * (won ? 1.2 : 0.9) + tds * 2500 * (1 + s.fans / 4e5));
  s.fans += gain;
  const row = { s: L.season, w: L.phase === 'playoffs' ? 'PO' : L.week, opp: L.teams[home ? g.a : g.h].abbr, home, res: `${won ? 'W' : us < them ? 'L' : 'T'} ${us}-${them}`, line: ssLine(p, b), grade, xp, trust: dTrust, fans: gain };
  s.games.unshift(row); s.games.length = Math.min(s.games.length, 60);
  const newBadges = ssCheckBadges(L, p, b);
  ssCheckDeals(L);
  if (SS_LIVE) { SS_LIVE = false; s.recap = Object.assign({ badges: newBadges }, row); }
};
function ssCheckBadges(L, p, b) {
  const s = ssS(L), out = [];
  for (const [id, name, f] of SS_BADGES) if (!s.badges[id]) { let ok = false; try { ok = f(p, b, L); } catch (e) { } if (ok) { s.badges[id] = L.season; out.push(name); ssGrant(L, 150, `Badge: ${name}`); s.fans += 5000; } }
  return out;
}
function ssCheckDeals(L) {
  const s = ssS(L);
  for (const [need, name, pay] of SS_DEALS) if (s.fans >= need && !s.deals.includes(name)) { s.deals.push(name); s.cash += pay; addNews(L, `🤝 ${pname(ssPlayer(L))} signs an endorsement deal: ${name} ($${pay}M).`); ssGrant(L, 200, `Endorsement: ${name}`); }
}
// endorsements pay every season; awards make you famous
const _computeAwardsSS2 = computeAwards;
computeAwards = function (L) {
  _computeAwardsSS2(L);
  const s = ssS(L), p = ssPlayer(L); if (!s || !p) return;
  const pay = SS_DEALS.filter(d => s.deals.includes(d[1])).reduce((a, d) => a + d[2], 0) + (p.con ? p.con.sal * 0.15 : 0);
  s.cash = Math.round((s.cash + pay) * 100) / 100;
  if ((p.awards || []).some(a => a.endsWith(String(L.awards[0] && L.awards[0].season)))) s.fans = Math.round(s.fans * 1.6);
  ssCheckBadges(L, p, null);
};
const _startLiveSS2 = startLiveGame;
startLiveGame = function (hid, aid, userTid, opts = {}) { SS_LIVE = !opts.exhibition && !!(LEAGUE && ssPlayer(LEAGUE)); return _startLiveSS2(hid, aid, userTid, opts); };
function ssRecapModal() {
  const L = LEAGUE, s = L && ssS(L), r = s && s.recap; if (!r) return; s.recap = null;
  const p = ssPlayer(L);
  modal(`<div class="modal-head"><h2>Game recap</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <div class="recap"><div class="grade-big g${r.grade[0]}">${r.grade}</div><div class="grow"><div class="eyebrow">${r.home ? 'vs' : '@'} ${esc(r.opp)} · ${r.res}</div><div class="hub-title" style="font-size:24px">${esc(pname(p))}</div><div>${esc(r.line)}</div></div></div>
    <div class="recap-stats"><div><b>+${r.xp}</b><span>XP</span></div><div><b class="${r.trust >= 0 ? 'pos' : 'neg'}">${r.trust >= 0 ? '+' : ''}${r.trust}</b><span>Coach trust</span></div><div><b>+${r.fans.toLocaleString()}</b><span>Followers</span></div></div>
    ${r.badges.length ? `<p>🏅 New badge${r.badges.length > 1 ? 's' : ''}: <b>${r.badges.map(esc).join(', ')}</b></p>` : ''}
    <div class="row"><button class="btn primary" data-act="close">Continue</button><button class="btn" data-act="tab" data-tab="star">My Player</button></div>`);
}
const _renderHubSS2 = renderHub;
renderHub = function () { _renderHubSS2(); if (LEAGUE && LEAGUE.superstar && LEAGUE.superstar.recap) setTimeout(ssRecapModal, 250); };

// ---------- weekly training: timing mini-game ----------
function trainKey(L) { return `${L.season}-${L.phase}-${L.week}`; }
let TR = null;
function trainModal(i) {
  const L = LEAGUE, p = ssPlayer(L), s = ssS(L); if (!p) return;
  if (s.trained === trainKey(L)) return toast('You already trained this week. Play your game first.');
  const d = SS_DRILLS[p.pos][i]; if (!d) return;
  const zone = clamp(0.1 + p.r.awr / 900, 0.1, 0.2);
  TR = { i, d, reps: [], zone, pos: 0, dir: 1, speed: 1.1 + p.ovr / 120, running: true, t0: performance.now() };
  modal(`<div class="modal-head"><h2>${esc(d[0])}</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p class="small">Tap <b>GO</b> (or press Space) when the marker is in the gold zone. 3 reps. Gold center = perfect.</p>
    <div class="tr-bar"><div class="tr-zone" style="left:${50 - zone * 50}%;width:${zone * 100}%"></div><div class="tr-perfect" style="left:${50 - zone * 15}%;width:${zone * 30}%"></div><div class="tr-mark" id="trMark"></div></div>
    <div class="tr-reps" id="trReps"></div>
    <div class="row"><button class="btn primary tr-go" data-act="tr-go">GO</button></div>`);
  const loop = () => {
    if (!TR || !TR.running || document.getElementById('modal').hidden) return;
    const now = performance.now(); TR.pos = (Math.sin((now - TR.t0) / 1000 * TR.speed * 2.6) + 1) / 2;
    const m = document.getElementById('trMark'); if (m) m.style.left = (TR.pos * 100) + '%';
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function trainHit() {
  if (!TR || !TR.running) return;
  const off = Math.abs(TR.pos - 0.5), z = TR.zone / 2;
  const q = off <= z * 0.3 ? 'perfect' : off <= z ? 'good' : off <= z * 2 ? 'ok' : 'miss';
  TR.reps.push(q);
  const el = document.getElementById('trReps'); if (el) el.innerHTML = TR.reps.map(r => `<span class="tr-rep ${r}">${r.toUpperCase()}</span>`).join('');
  TR.speed *= 1.15;
  if (TR.reps.length >= 3) { TR.running = false; setTimeout(trainFinish, 500); }
}
function trainFinish() {
  const L = LEAGUE, p = ssPlayer(L), s = ssS(L), d = TR.d;
  const pts = TR.reps.reduce((a, r) => a + ({ perfect: 40, good: 25, ok: 12, miss: 3 })[r], 0);
  const medal = pts >= 110 ? 'Gold' : pts >= 70 ? 'Silver' : 'Bronze';
  let ups = [];
  for (const k of d[1]) { s.train[k] = (s.train[k] || 0) + pts / d[1].length; while (s.train[k] >= 50 && p.r[k] < 99) { s.train[k] -= 50; p.r[k] = Math.min(99, Math.round(p.r[k]) + 1); ups.push(SS_NAMES[k]); } }
  p.ovr = calcOvr(p);
  s.trained = trainKey(L);
  if (medal === 'Gold') s.trust = clamp(s.trust + 2, 0, 100);
  ssGrant(L, Math.round(pts * 0.8), `Training: ${d[0]} (${medal})`);
  save();
  modal(`<div class="modal-head"><h2>${medal} — ${esc(d[0])}</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p>${TR.reps.map(r => `<span class="tr-rep ${r}">${r.toUpperCase()}</span>`).join(' ')}</p>
    <p>${ups.length ? `Rating up: <b>${[...new Set(ups)].map(u => u + ' +' + ups.filter(x => x === u).length).join(', ')}</b>` : 'Progress saved toward your next rating point.'}</p>
    <p class="small muted">+${Math.round(pts * 0.8)} XP${medal === 'Gold' ? ' · the coaches noticed (+2 trust)' : ''}</p>
    <button class="btn primary" data-act="close-train">Done</button>`);
  TR = null;
}
document.addEventListener('keydown', e => { if (TR && TR.running && e.code === 'Space') { e.preventDefault(); trainHit(); } });

// ---------- gear on the 3D model ----------
const GEAR_COL = { dark: '#0b0f14', gold: '#d4a017', clear: '#bfe6ff', black: '#141414', white: '#f2f2f2' };
const _makePMss = makePlayerModel;
makePlayerModel = function (team, home, num, side, role, opts = {}) {
  const m = _makePMss(team, home, num, side, role, opts), gear = opts.gear; if (!gear || !m.parts) return m;
  const col = k => k === 'team' ? team.c1 : GEAR_COL[k];
  if (gear.gloves && gear.gloves !== 'team') for (const h of m.parts.hands) h.material = stdMat(col(gear.gloves), { roughness: 0.5 });
  if (gear.cleats && gear.cleats !== 'std') for (const c of m.parts.cleats) c.material = stdMat(col(gear.cleats), { roughness: 0.35, metalness: gear.cleats === 'gold' ? 0.6 : 0.1 });
  if (gear.visor && gear.visor !== 'none') { const v = new THREE.Mesh(geos2().visor, stdMat(col(gear.visor), { roughness: 0.08, metalness: gear.visor === 'gold' ? 0.9 : 0.5, transparent: gear.visor === 'clear', opacity: gear.visor === 'clear' ? 0.45 : 1 })); v.position.set(0, 0.03, 0.227); m.head.add(v); }
  if (gear.sleeve && gear.sleeve !== 'none') for (const a of m.arms) { const sl = new THREE.Mesh(geos2().foreArm, stdMat(col(gear.sleeve), { roughness: 0.6 })); sl.scale.set(1.12, 1.6, 1.12); sl.position.y = -0.2; a.sh.add(sl); }
  return m;
};

// ---------- My Player tab ----------
const _viewStarOld = viewStar;
viewStar = function () {
  const L = LEAGUE, p = ssPlayer(L);
  if (!p) return `<div class="card"><h2>Superstar mode</h2><p>Create your own player and play only his snaps — like a career mode. Pick a position and a play style; each style has its own strengths and a signature ability.</p>
    <div class="row" style="gap:10px;flex-wrap:wrap"><input id="ssFirst2" placeholder="First name" maxlength="16"><input id="ssLast2" placeholder="Last name" maxlength="18"><input id="ssNum2" type="number" min="0" max="99" placeholder="#" style="width:70px">
    <select id="ssPos2">${SS_POS.map(x => `<option ${x === 'WR' ? 'selected' : ''}>${x}</option>`).join('')}</select><select id="ssArch2">${archOpts('WR')}</select><button class="btn primary" data-act="ss-create">Create my player</button></div></div>`;
  const s = ssS(L), t = L.teams[p.tid], a = abilOf(p);
  let base = _viewStarOld();
  // trust + brand strip under the hero card
  const deals = SS_DEALS.map(([need, name, pay]) => `<div class="deal ${s.deals.includes(name) ? 'got' : ''}"><b>${name}</b><span>${s.deals.includes(name) ? `$${pay}M/yr` : `${(need / 1000 >= 1000 ? need / 1e6 + 'M' : need / 1000 + 'K')} followers`}</span></div>`).join('');
  const strip = `<div class="cols"><div class="card"><h2>${esc(s.arch || p.pos)}${a ? ` · <span class="ab-chip">★ ${ABIL[a][0]}</span>` : ''}</h2><p class="small muted">${a ? ABIL[a][1] + '. Turns on when you get In the Zone (a couple of big plays).' : ''}</p>
      <div class="meter"><span>Coach trust</span><div class="bar"><i style="width:${s.trust}%"></i></div><b>${Math.round(s.trust)}</b></div>
      <p class="small muted">${p.pos === 'QB' ? 'High trust means more freedom and a stronger supporting cast.' : SS_OFF.includes(p.pos) ? 'High trust means more plays designed for you and the QB looks your way more.' : 'High trust earns you more big-play chances.'} Grades of B or better raise it.</p></div>
    <div class="card"><h2>Brand</h2><div class="brand"><div><b>${s.fans >= 1e6 ? (s.fans / 1e6).toFixed(2) + 'M' : s.fans >= 1000 ? (s.fans / 1000).toFixed(1) + 'K' : s.fans}</b><span>followers</span></div><div><b>$${s.cash.toFixed(1)}M</b><span>to spend</span></div></div><div class="deals">${deals}</div></div></div>`;
  // training
  const done = s.trained === trainKey(L);
  const drills = `<div class="card"><h2>Training camp <span class="muted small">${done ? 'done for this week' : 'one drill per week'}</span></h2><div class="drills">${SS_DRILLS[p.pos].map((d, i) => `<button class="drill" data-act="ss-train" data-i="${i}" ${done ? 'disabled' : ''}><b>${d[0]}</b><span>${d[1].map(k => SS_NAMES[k]).join(' · ')}</span><span class="small muted">${d[1].map(k => `${Math.round(s.train[k] || 0)}/50`).join(' · ')}</span></button>`).join('')}</div></div>`;
  // badges + legacy
  const tot = ssTot(p), legacy = Math.round(typeof hofScore === 'function' ? hofScore(p, tot) : 0);
  const badges = `<div class="card"><h2>Milestones <span class="muted small">${Object.keys(s.badges).length}/${SS_BADGES.length}</span></h2><div class="badges">${SS_BADGES.map(([id, name]) => `<span class="badge ${s.badges[id] ? 'got' : ''}">${s.badges[id] ? '🏅' : '🔒'} ${name}</span>`).join('')}</div>
    <h2 style="margin-top:12px">Hall of Fame legacy</h2><div class="meter"><span>Legacy</span><div class="bar"><i style="width:${Math.min(100, legacy / 2.4)}%"></i></div><b>${legacy}/240</b></div><p class="small muted">Five or more seasons, a legacy score of 240 and All-Pro teams or awards punch your ticket.</p></div>`;
  // gear
  const shop = `<div class="card"><h2>Gear locker</h2><div class="gear">${Object.entries(SS_GEAR).map(([slot, items]) => `<label>${slot[0].toUpperCase() + slot.slice(1)} <select data-act="ss-gear" data-slot="${slot}">${items.map(([id, n, cost]) => { const own = !cost || s.owned[slot + ':' + id]; return `<option value="${id}" ${s.gear[slot] === id ? 'selected' : ''}>${n}${own ? '' : ` — $${cost}M`}</option>`; }).join('')}</select></label>`).join('')}</div><p class="small muted">Gear shows up on your player in the 3D view. Endorsement money pays for it.</p></div>`;
  // game log
  const log = `<div class="card"><h2>Game log</h2>${s.games.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Wk</th><th>Opp</th><th>Result</th><th>Line</th><th class="r">Grade</th><th class="r">XP</th></tr></thead><tbody>${s.games.slice(0, 20).map(g => `<tr><td>${g.s} ${g.w}</td><td>${g.home ? 'vs' : '@'} ${esc(g.opp)}</td><td>${g.res}</td><td class="small">${esc(g.line)}</td><td class="r"><b class="grade g${g.grade[0]}">${g.grade}</b></td><td class="r num">+${g.xp}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">No games yet.</p>'}</div>`;
  // insert after the hero card
  const i = base.indexOf('<div class="cols">');
  base = i >= 0 ? base.slice(0, i) + strip + drills + base.slice(i) : base + strip + drills;
  return base + `<div class="cols">${badges}${shop}</div>` + log;
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !LEAGUE) return;
  if (el.dataset.act === 'ss-train') trainModal(+el.dataset.i);
  if (el.dataset.act === 'tr-go') trainHit();
  if (el.dataset.act === 'close-train') { closeModal(); renderHub(); }
});
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset || el.dataset.act !== 'ss-gear' || !LEAGUE) return;
  const s = ssS(LEAGUE), slot = el.dataset.slot, id = el.value, item = SS_GEAR[slot].find(x => x[0] === id), key = slot + ':' + id;
  if (item[2] && !s.owned[key]) { if (s.cash < item[2]) { toast(`You need $${item[2]}M — grow your brand to land endorsement deals.`); renderHub(); return; } s.cash = Math.round((s.cash - item[2]) * 100) / 100; s.owned[key] = true; toast(`Bought: ${item[1]}`); }
  s.gear[slot] = id; save(); renderHub();
});
