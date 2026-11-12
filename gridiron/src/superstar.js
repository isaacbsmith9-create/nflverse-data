// ============================================================
// Gridiron Dynasty - Superstar mode: create one player and play only his
// snaps. Earn XP from games, spend points on ratings, chase goals/awards.
// Works on top of a franchise (you still run the team).
// ============================================================
'use strict';

const SS_POS = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'CB', 'S'];
const SS_OFF = ['QB', 'RB', 'WR', 'TE'];
const SS_GOALS = {
  QB: [['py', 4000, 'Pass for 4,000 yards'], ['ptd', 30, 'Throw 30 touchdowns'], ['wins', 11, 'Win 11 games']],
  RB: [['ry', 1200, 'Rush for 1,200 yards'], ['rtd', 12, 'Score 12 rushing TDs'], ['rec', 40, 'Catch 40 passes']],
  WR: [['rcy', 1200, '1,200 receiving yards'], ['rctd', 10, '10 receiving TDs'], ['rec', 85, '85 catches']],
  TE: [['rcy', 800, '800 receiving yards'], ['rctd', 8, '8 receiving TDs'], ['rec', 65, '65 catches']],
  DL: [['sk', 12, 'Record 12 sacks'], ['tk', 50, 'Make 50 tackles'], ['ff', 3, 'Force 3 fumbles']],
  LB: [['tk', 120, 'Make 120 tackles'], ['sk', 6, 'Record 6 sacks'], ['dint', 2, 'Grab 2 interceptions']],
  CB: [['dint', 5, 'Grab 5 interceptions'], ['pd', 14, 'Defend 14 passes'], ['tk', 60, 'Make 60 tackles']],
  S: [['dint', 4, 'Grab 4 interceptions'], ['tk', 90, 'Make 90 tackles'], ['pd', 10, 'Defend 10 passes']],
};
const SS_KEYS = { QB: ['tha', 'thp', 'awr', 'spd', 'agi'], RB: ['spd', 'agi', 'btk', 'cat', 'str', 'awr'], WR: ['spd', 'cat', 'rte', 'agi', 'btk', 'awr'], TE: ['cat', 'rte', 'rbk', 'str', 'spd', 'awr'],
  DL: ['prs', 'str', 'spd', 'tkl', 'agi', 'awr'], LB: ['tkl', 'awr', 'spd', 'cov', 'prs', 'str'], CB: ['cov', 'spd', 'agi', 'awr', 'cat', 'tkl'], S: ['cov', 'tkl', 'spd', 'awr', 'agi', 'cat'] };
const SS_NAMES = { spd: 'Speed', str: 'Strength', agi: 'Agility', awr: 'Awareness', thp: 'Throw power', tha: 'Throw accuracy', cat: 'Catching', rte: 'Route running', btk: 'Break tackle', rbk: 'Blocking', prs: 'Pass rush', tkl: 'Tackling', cov: 'Coverage', kpw: 'Kick power', kac: 'Kick accuracy' };

function ssPlayer(L) { return L && L.superstar && L.players[L.superstar.pid]; }
function ssCreate(L, first, last, pos) {
  const t = L.teams[L.userTid];
  const p = genPlayer(L, pos, 70, 22);
  p.first = first || 'Your'; p.last = last || 'Player'; p.age = 22; p.dev = 'X'; p.num = jerseyNum(pos); p.col = 'Superstar';
  p.con = { sal: 1.2, yrs: 4 }; p.st = {}; p.career = []; p.star = true;
  addToTeam(L, p, L.userTid);
  t.depth[pos] = [p.id, ...(t.depth[pos] || []).filter(id => id !== p.id)];
  L.superstar = { pid: p.id, xp: 0, pts: 6, spent: 0, lvl: 1, log: [] };
  addNews(L, `⭐ Superstar mode: ${pos} ${pname(p)} joins the ${t.name} as a rookie starter.`);
  return p;
}
function ssLevel(xp) { return 1 + Math.floor(Math.sqrt(xp / 45)); } // each level takes longer
function ssNext(xp) { const l = ssLevel(xp); return l * l * 45 - xp; }
function ssXP(p, b, won) {
  let x = 20 + (won ? 30 : 0);
  if (p.pos === 'QB') x += (b.py || 0) * 0.1 + (b.ptd || 0) * 20 - (b.pint || 0) * 15 + (b.ry || 0) * 0.2 + (b.rtd || 0) * 20;
  else if (SS_OFF.includes(p.pos)) x += ((b.ry || 0) + (b.rcy || 0)) * 0.2 + (b.rec || 0) * 3 + ((b.rtd || 0) + (b.rctd || 0)) * 25;
  else x += (b.tk || 0) * 8 + (b.sk || 0) * 25 + (b.dint || 0) * 35 + (b.pd || 0) * 8 + (b.ff || 0) * 20;
  return Math.max(10, Math.round(x));
}
function ssGrant(L, xp, why) {
  const s = L.superstar; s.xp += xp;
  const lvl = ssLevel(s.xp);
  if (lvl > s.lvl) { s.pts += (lvl - s.lvl) * 2; s.lvl = lvl; addNews(L, `⭐ Level ${lvl}! You earned upgrade points.`); }
  s.log.unshift({ s: L.season, w: L.week, xp, why }); s.log.length = Math.min(s.log.length, 30);
}

// XP from every game the star plays (live or simulated)
const _recordGameSS = recordGame;
recordGame = function (L, g, res) {
  _recordGameSS(L, g, res);
  const p = ssPlayer(L); if (!p || !res.box || !res.box[p.id]) return;
  const home = g.h === p.tid, won = home ? g.hs > g.as : g.as > g.hs;
  if (g.h !== p.tid && g.a !== p.tid) return;
  ssGrant(L, ssXP(p, res.box[p.id], won), `${home ? 'vs' : '@'} ${L.teams[home ? g.a : g.h].abbr}${won ? ' (W)' : ''}`);
};
// season goals pay out at the end of the season
const _computeAwardsSS = computeAwards;
computeAwards = function (L) {
  _computeAwardsSS(L);
  const p = ssPlayer(L); if (!p) return;
  const t = L.teams[p.tid] || { w: 0 };
  let n = 0;
  for (const [k, need] of SS_GOALS[p.pos]) if ((k === 'wins' ? t.w : (p.st[k] || 0)) >= need) n++;
  if (n) ssGrant(L, n * 300, `${n} season goal${n > 1 ? 's' : ''} reached`);
  const aw = L.awards[0]; if (aw) for (const k of ['mvp', 'opoy', 'dpoy', 'roy']) if (aw[k] && aw[k].id === p.id) ssGrant(L, 800, k.toUpperCase() + '!');
};

// ---------- live game: you only play your guy ----------
const LSS = LiveGame.prototype;
LSS.starEnt = function () {
  const p = ssPlayer(this.L); if (!p || p.tid !== this.teamOf(this.user).id) return null;
  return this.ents.find(e => e.p && e.p.id === p.id) || null;
};
LSS.starMode = function () {
  const p = ssPlayer(this.L); if (!p || this.user < 0 || p.inj || p.tid !== this.teamOf(this.user).id) return null;
  const lu = this.gs.lu[this.user]; if (!(lu[p.pos] || []).some(x => x.id === p.id)) return null;
  return SS_OFF.includes(p.pos) ? (p.pos === 'QB' ? 'qb' : 'off') : 'def';
};
const _nextSS = LSS.next;
LSS.next = function () {
  const gs = this.gs, mode = this.starMode();
  if (!mode || gs.over || gs.retPending || gs.onsideMsg) return _nextSS.call(this);
  const off = gs.poss, mine = off === this.user;
  if ((mode !== 'def' && !mine) || (mode === 'def' && mine)) { // the other unit's snaps are simulated
    this.ents = []; this.ball = null; this.phase = 'call';
    const before = gs.score.slice(); simDrive(gs);
    const d = gs.score[off] - before[off];
    this.h.toast && this.h.toast(`${this.teamOf(off).abbr} drive ${d >= 6 ? 'ends in a TOUCHDOWN' : d === 3 ? 'ends in a field goal' : 'is stopped'}. You're up.`);
    this.h.update && this.h.update();
    setTimeout(() => this.next(), 60); return;
  }
  if (mode === 'off') { // coach calls the play, you play your position
    this.ents = []; this.ball = null; this.phase = 'call';
    const id = autoOffCall(gs); const pl = OFF_PLAYS.concat(SPECIAL_PLAYS).find(p => p.id === id);
    this.h.toast && this.h.toast(`Coach's call: ${pl ? pl.name : id}`);
    return this.choose(id);
  }
  if (mode === 'def') {
    this.ents = []; this.ball = null; this.phase = 'call';
    const dec = cpuDecision(gs); if (dec !== 'go') return this.choose(null);
    const dp = cpuDefCall(gs); this.h.toast && this.h.toast(`Defensive call: ${dp.name}`);
    return this.choose(dp.id);
  }
  return _nextSS.call(this); // QB: you call the plays
};
const _updateSS = LSS.update;
LSS.update = function (dt) {
  if (this.phase === 'pre' && this.starMode() === 'off' && this.userOnOffense() && this.preT > 1.3) this.snap();
  return _updateSS.call(this, dt);
};
const _liveStepSS = LSS.liveStep;
LSS.liveStep = function (dt) {
  const s = this.starMode() ? this.starEnt() : null;
  if (s) {
    if (this.ctrl !== s && (s.side === 'O') === this.userOnOffense()) this.ctrl = s;
    const inp = this.input, pl = this.play, car = this.carrier();
    // receivers: press the action button to call for the ball
    if (inp.actionEdge && s.side === 'O' && car !== s && car === this.passer && this.passReady && !pl.thrown && this.eligible.includes(s)) {
      inp.actionEdge = false;
      const open = this.openness ? this.openness(s) : 1;
      if (open > 0.9 || chance(0.35)) { this.throwBall(s); this.h.toast && this.h.toast('QB heard you — ball\'s coming!', 1200); }
      else this.h.toast && this.h.toast('Covered — the QB looks elsewhere.', 1200);
    }
    inp.sw = false;
  }
  return _liveStepSS.call(this, dt);
};
// the QB likes throwing to the star
const _opennessSS = LSS.openness;
LSS.openness = function (r) { const v = _opennessSS.call(this, r); const p = ssPlayer(this.L); return p && r.p && r.p.id === p.id && this.passer !== this.ctrl ? v + 0.7 : v; };

// ---------- setup screen + My Player tab ----------
const _setupGoSS = setupGo;
setupGo = function () {
  const on = document.getElementById('setSS') && document.getElementById('setSS').checked && SETUP.mode === 'franchise';
  const first = on ? ($('#ssFirst').value || '').trim() : '', last = on ? ($('#ssLast').value || '').trim() : '', pos = on ? $('#ssPos').value : null;
  _setupGoSS();
  if (on && LEAGUE) { ssCreate(LEAGUE, first.slice(0, 16), last.slice(0, 18), pos); save(); TAB = 'star'; renderHub(); }
};
function ssCost(v) { return v < 80 ? 1 : v < 90 ? 2 : 3; }
function viewStar() {
  const L = LEAGUE, p = ssPlayer(L);
  if (!p) return `<div class="card"><h2>Superstar mode</h2><p>Create your own player and play only his snaps — like a career mode. He starts as a 70 OVR rookie starter on your team, and you upgrade him with XP from games.</p>
    <div class="row" style="gap:10px;flex-wrap:wrap"><input id="ssFirst2" placeholder="First name" maxlength="16"><input id="ssLast2" placeholder="Last name" maxlength="18">
    <select id="ssPos2">${SS_POS.map(x => `<option>${x}</option>`).join('')}</select><button class="btn primary" data-act="ss-create">Create my player</button></div></div>`;
  const s = L.superstar, need = ssNext(s.xp), t = L.teams[p.tid], span = (s.lvl * s.lvl - (s.lvl - 1) * (s.lvl - 1)) * 45;
  const goals = SS_GOALS[p.pos].map(([k, n, label]) => { const v = k === 'wins' ? (t ? t.w : 0) : (p.st[k] || 0); return `<div class="goal"><div class="row"><span class="grow">${label}</span><b class="num">${v}/${n}</b></div><div class="bar"><i style="width:${Math.min(100, v / n * 100)}%"></i></div></div>`; }).join('');
  const rows = SS_KEYS[p.pos].map(k => { const v = Math.round(p.r[k]), c = ssCost(v); return `<tr><td>${SS_NAMES[k]}</td><td class="r num"><b>${v}</b></td><td><div class="bar"><i style="width:${v}%"></i></div></td><td class="r"><button class="btn sm" data-act="ss-up" data-k="${k}" ${s.pts >= c && v < 99 ? '' : 'disabled'}>+1 <span class="muted small">(${c})</span></button></td></tr>`; }).join('');
  const st = p.st || {}, statLine = SS_OFF.includes(p.pos) ? `${st.gp || 0} GP · ${p.pos === 'QB' ? `${st.pc || 0}/${st.pa || 0}, ${st.py || 0} yds, ${st.ptd || 0} TD, ${st.pint || 0} INT · ` : ''}${st.ra || 0} car ${st.ry || 0} yds · ${st.rec || 0} rec ${st.rcy || 0} yds · ${(st.rtd || 0) + (st.rctd || 0)} TD`
    : `${st.gp || 0} GP · ${st.tk || 0} tkl · ${st.sk || 0} sk · ${st.dint || 0} INT · ${st.pd || 0} PD · ${st.ff || 0} FF`;
  return `<div class="card ss-hero" style="--c1:${t ? t.c1 : '#333'}"><div class="ss-num">${p.num}</div><div class="grow"><div class="eyebrow">Superstar · ${t ? esc(teamName(t)) : 'Free agent'}</div>
      <div class="hub-title">${esc(pname(p))}</div><div class="muted">${p.pos} · Age ${p.age} · Level ${s.lvl} · ${s.xp.toLocaleString()} XP (${need} to next level)</div>
      <div class="bar xp"><i style="width:${clamp((span - need) / span * 100, 0, 100)}%"></i></div></div><div class="ring big" style="--v:${p.ovr}"><b>${p.ovr}</b><span>OVR</span></div></div>
    <div class="cols"><div class="card"><h2>Upgrade ratings <span class="pill amber">${s.pts} point${s.pts === 1 ? '' : 's'}</span></h2><div class="tbl-wrap"><table class="t"><tbody>${rows}</tbody></table></div>
      <p class="muted small">Each level = 2 points, and levels take more XP as you go. Points cost more as a rating gets higher.</p></div>
      <div class="card"><h2>${L.season} season goals</h2>${goals}<p class="muted small">Each goal you hit pays 300 XP at the end of the season. Awards pay 800.</p>
      <h2 style="margin-top:14px">This season</h2><p class="small">${statLine}</p>
      <h2 style="margin-top:14px">Recent XP</h2>${s.log.slice(0, 8).map(x => `<div class="small"><b class="num">+${x.xp}</b> <span class="muted">${x.s} wk ${x.w}</span> ${esc(x.why)}</div>`).join('') || '<p class="muted small">Play a game to earn XP.</p>'}</div></div>
    <div class="card"><h2>How it works</h2><p class="small">In games you only control ${esc(p.last)}. ${p.pos === 'QB' ? 'You call the plays and run the offense; the defense is simulated.' : SS_OFF.includes(p.pos) ? 'The coach calls the plays and the snap is automatic. Run your route — press the action button (SPACE) to call for the ball when you\'re open. The defense is simulated.' : 'The defensive coordinator calls the defense. You control your player on every snap; your offense is simulated.'} Games you sim also earn XP from his stats.</p></div>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !LEAGUE) return;
  if (el.dataset.act === 'ss-up') {
    const L = LEAGUE, p = ssPlayer(L), k = el.dataset.k, c = ssCost(p.r[k]); if (!p || L.superstar.pts < c || p.r[k] >= 99) return;
    L.superstar.pts -= c; L.superstar.spent += c; p.r[k] = Math.min(99, Math.round(p.r[k]) + 1); p.ovr = calcOvr(p); save(); renderHub();
  }
  if (el.dataset.act === 'ss-create') { ssCreate(LEAGUE, ($('#ssFirst2').value || '').trim().slice(0, 16), ($('#ssLast2').value || '').trim().slice(0, 18), $('#ssPos2').value); save(); renderHub(); }
});
// select your player before the snap too
const _setupSS = LSS.setup;
LSS.setup = function () {
  _setupSS.call(this);
  if (this.starMode()) { const s = this.starEnt(); if (s && (s.side === 'O') === this.userOnOffense()) this.ctrl = s; }
};
