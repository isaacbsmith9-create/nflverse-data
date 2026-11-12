// ============================================================
// Gridiron Dynasty - playable kickoff and punt returns, onside kicks.
// When the user's team receives, the return is played live: blockers set
// a wall, the coverage team runs down, and you steer the returner.
// ============================================================
'use strict';

const RET_PLAY = { id: 'ret', name: 'Return', type: 'run', form: 'single', path: [[0.5, 0]], desc: '' };

// kickoffs: the user's team receiving gets a live return (touchbacks stay touchbacks)
const _kickoffR = kickoff;
kickoff = function (gs, recv, silent) {
  const kick = 1 - recv;
  // onside kicks: the user's toggle, or the CPU late and behind
  const late = gs.quarter >= 4 && gs.clock < 150, behind = gs.score[kick] < gs.score[recv] && gs.score[recv] - gs.score[kick] <= 16;
  const userOnside = gs.onside && gs.onside[kick];
  const cpuOnside = !silent && late && behind && kick !== gs.liveUser && (gs.liveUser == null || gs.liveUser >= 0) && chance(0.85);
  if (!silent && (userOnside || cpuOnside)) {
    if (gs.onside) gs.onside[kick] = false;
    const got = chance(0.14);
    if (got) { setBall(gs, kick, 45); logp(gs, `ONSIDE KICK — ${teamAbbr(gs, kick)} RECOVERS!`, true); gs.onsideMsg = { title: 'ONSIDE KICK RECOVERED!', sub: `${teamAbbr(gs, kick)} keeps the ball`, big: true }; }
    else { setBall(gs, recv, 55); logp(gs, `Onside kick recovered by ${teamAbbr(gs, recv)}.`); gs.onsideMsg = { title: 'Onside kick fails', sub: `${teamAbbr(gs, recv)} recovers at the ${yardStr(gs, 55)}`, big: false }; }
    return;
  }
  if (silent || gs.liveUser == null || recv !== gs.liveUser || chance(0.55)) return _kickoffR(gs, recv, silent);
  const land = randi(-3, 12); // where it comes down (receiving team's yard line; <0 = end zone)
  setBall(gs, recv, 30);
  logp(gs, `${teamAbbr(gs, kick)} kicks off.`);
  gs.retPending = { kind: 'ko', land };
};

const _doPuntR = doPunt;
doPunt = function (gs) {
  const off = gs.poss, def = 1 - off;
  if (gs.liveUser == null || def !== gs.liveUser) return _doPuntR(gs);
  const pp = gs.lu[off].P[0];
  const dist = Math.round(clamp(gauss(42 + (pp.r.kpw - 70) / 3, 6), 25, 68));
  const land = gs.yard + dist;
  if (land >= 100 || chance(0.25)) return _doPuntR(gs); // touchback / out of bounds / downed: just simulate it
  st(gs, pp, 'punts'); st(gs, pp, 'puntyds', dist);
  logp(gs, `${teamAbbr(gs, off)} punts ${dist} yds.`);
  setBall(gs, def, 100 - land);
  runClock(gs, 6);
  gs.retPending = { kind: 'punt', land: 100 - land };
};

const LRT = LiveGame.prototype;
const _nextR = LRT.next;
LRT.next = function () {
  const gs = this.gs;
  if (gs.onsideMsg && !gs.over) { const m = gs.onsideMsg; gs.onsideMsg = null; this.ents = []; this.ball = null; this.phase = 'call'; this.result(m.title, m.sub, m.big); return; }
  if (gs.retPending && !gs.over && this.user >= 0) { const r = gs.retPending; gs.retPending = null; return this.startReturn(r); }
  gs.retPending = null;
  return _nextR.call(this);
};

LRT.startReturn = function (r) {
  const gs = this.gs, recv = gs.poss;
  this.offPlay = RET_PLAY; this.defPlay = DEF_PLAYS[0];
  this.setup();
  const O = this.O, D = this.D, landX = 10 + r.land;
  this.los = landX; this.firstX = landX;
  const ret = O.RB;
  const kr = gs.lu[recv].RB[1] && !gs.lu[recv].RB[1].scrub ? gs.lu[recv].RB[1] : gs.lu[recv].WR[2];
  if (kr && !kr.scrub) ret.p = kr;
  ret.x = landX; ret.y = clamp(MID_Y + gauss(0, 4), 8, FIELD_W - 8); ret.vx = 0; ret.vy = 0;
  // blockers form a wall in front of the returner
  const blockers = this.ents.filter(e => e.side === 'O' && e !== ret);
  const cover = this.ents.filter(e => e.side === 'D');
  const gap = r.kind === 'punt' ? 7 : 19;
  blockers.forEach((e, i) => { e.x = landX + gap + (i % 2) * 2.5 + randi(0, 2); e.y = 4 + i * (FIELD_W - 8) / (blockers.length - 1); e.task = { k: 'block' }; e.vx = 0; e.vy = 0; });
  cover.forEach((e, i) => { const fast = e.role.startsWith('CB') || e.role.startsWith('S'); e.x = landX + (r.kind === 'punt' ? (fast ? 11 : 17) : (fast ? 33 : 38)) + Math.random() * 4; e.y = 3 + i * (FIELD_W - 6) / (cover.length - 1); e.task = { k: 'fill' }; e.vx = -6; e.vy = 0; e.read = 0; e.react = 0.1; const tired = r.kind === 'punt' ? 0.93 : 0.86; e.maxV *= tired; e.acc *= tired; });
  this.ball = { state: 'held', holder: ret, x: ret.x, y: ret.y, z: 0 };
  this.passer = ret; this.passReady = false; this.runBlocking = true;
  this.play = { thrown: false, caught: false, handoff: true, crossed: true, int: false, target: null, airYds: 0, rusher: ret, result: null, sackable: false, scramble: false, decided: true };
  this.ret = { kind: r.kind, recv, land: r.land, x0: landX };
  ret.task = { k: 'path', pts: [[landX + 6, ret.y]], i: 0 };
  this.ctrl = this.userOnOffense() ? ret : null;
  this.cam.x = landX + 8; this.cam.y = ret.y;
  this.phase = 'live'; this.t = 0;
  this.h.toast && this.h.toast(r.kind === 'punt' ? 'Punt return! Run it back — or press T for a fair catch.' : r.land < 0 ? 'Kick in the end zone: run it out, or press T to take a knee.' : 'Kickoff return! Find a crease.');
  this.h.update && this.h.update();
};

// T (throw-away key) = fair catch / take a knee at the start of a return
const _liveStepR = LRT.liveStep;
LRT.liveStep = function (dt) {
  if (this.ret && (this.input.throwAway || this.input.sw) && this.t < 0.8) { this.input.throwAway = false; this.input.sw = false; return this.endReturn('fair'); }
  if (this.ret) { this.input.throwTo = null; this.input.throwAway = false; }
  return _liveStepR.call(this, dt);
};
const _endPlayR = LRT.endPlay;
LRT.endPlay = function (kind, msg) {
  if (this.ret && this.phase === 'live') return this.endReturn(kind);
  return _endPlayR.call(this, kind, msg);
};
LRT.endReturn = function (kind) {
  const gs = this.gs, r = this.ret, c = this.carrier() || this.O.RB, recv = r.recv; this.ret = null;
  sfx('whistle');
  const elapsed = Math.max(2, Math.min(this.t, 10));
  if (kind === 'td') {
    st(gs, c.p, 'kr'); st(gs, c.p, 'kry', Math.round(110 - r.x0)); st(gs, c.p, 'krtd');
    gs.score[recv] += 6; logp(gs, `${r.kind === 'punt' ? 'PUNT' : 'KICKOFF'} RETURN TOUCHDOWN by ${pshort(c.p)}!`, true);
    runClock(gs, elapsed); pat(gs, recv); checkOT(gs); if (!gs.over) kickoff(gs, 1 - recv);
    sfx('td');
    return this.result(`${r.kind === 'punt' ? 'PUNT' : 'KICK'} RETURN TD!`, `${pshort(c.p)} takes it all the way`, true);
  }
  let yard;
  if (kind === 'fair') yard = r.land <= 0 ? (r.kind === 'punt' ? 20 : 30) : r.land;
  else yard = Math.round(c.x - 10);
  if (yard <= 0) yard = r.kind === 'punt' ? 20 : 30; // downed in the end zone
  yard = clamp(yard, 1, 99);
  const yds = Math.max(0, yard - Math.max(0, r.land));
  if (kind !== 'fair') { st(gs, c.p, r.kind === 'punt' ? 'pr' : 'kr'); st(gs, c.p, r.kind === 'punt' ? 'pry' : 'kry', yds); if (this.tackler) st(gs, this.tackler.p, 'tk'); }
  gs.poss = recv; gs.yard = yard; gs.down = 1; gs.togo = Math.min(10, 100 - yard); gs.ballY = clamp(c.y, HASH_L, HASH_R);
  runClock(gs, kind === 'fair' ? 0 : elapsed); gs.lastRunoff = 0;
  logp(gs, kind === 'fair' ? (r.land <= 0 ? 'Touchback.' : 'Fair catch.') : `${pshort(c.p)} returns it ${yds} yds to the ${yardStr(gs, yard)}${kind === 'oob' ? ', out of bounds' : ''}.`, yds >= 35);
  return this.result(kind === 'fair' ? (r.land <= 0 ? 'Touchback' : 'Fair catch') : `Return of ${yds}`, kind === 'fair' ? '' : `${pshort(c.p)} to the ${yardStr(gs, yard)}`, yds >= 40);
};

// user game setup + onside toggle
const _startLiveR = startLiveGame;
startLiveGame = function (hid, aid, userTid, opts = {}) {
  _startLiveR(hid, aid, userTid, opts);
  if (GAME) { GAME.gs.liveUser = GAME.live.user; GAME.gs.onside = [false, false]; }
};
const _simRestR = simRestOfGame;
simRestOfGame = function () { if (GAME) GAME.gs.liveUser = null; return _simRestR(); };
