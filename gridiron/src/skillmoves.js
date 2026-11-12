// ============================================================
// Gridiron Dynasty - skill moves. Ball carrier: juke (existing), stiff
// arm, spin, hurdle, truck, hesitation. Defender: hit stick, strip.
// Receiver: high-point catch. CPU players use them too.
// ============================================================
'use strict';

const MOVES = {
  stiff: { dur: 0.5, cd: 1.0, name: 'Stiff arm!' },
  spin: { dur: 0.42, cd: 1.2, name: 'Spin move!' },
  hurdle: { dur: 0.55, cd: 1.4, name: 'Hurdle!' },
  truck: { dur: 0.4, cd: 1.1, name: 'Trucked him!' },
  hesi: { dur: 0.3, cd: 1.0, name: 'Hesitation!' },
  hit: { dur: 0.35, cd: 1.3, name: 'BIG HIT!' },
  strip: { dur: 0.35, cd: 1.1, name: 'Going for the ball!' },
  high: { dur: 0.6, cd: 1.5, name: 'High point!' },
};
const LM = LiveGame.prototype;
LM.doMove = function (e, type) {
  const M = MOVES[type]; if (!M || !e) return false;
  if ((e.mvCd || 0) > this.t || e.stun > 0 || e.eng) return false;
  e.mv = { type, until: this.t + M.dur }; e.mvCd = this.t + M.cd;
  e.anim = { type: 'mv_' + type, t0: this.t2, dur: M.dur };
  const sp = Math.hypot(e.vx, e.vy) || 1, ux = e.vx / sp, uy = e.vy / sp;
  if (type === 'spin') { e.vx *= 0.85; e.vy *= 0.85; }
  if (type === 'truck') { e.vx = ux * Math.max(sp, 6.5); e.vy = uy * Math.max(sp, 6.5); }
  if (type === 'hesi') { e.vx *= 0.45; e.vy *= 0.45; e.burst = this.t + 0.75; for (const d of this.ents) if (d.side !== e.side && this.dist(d, e) < 5 && !d.eng) { d.stun = Math.max(d.stun, 0.12 + (e.r.agi - d.r.awr) / 600); d.vx *= 1.2; d.vy *= 1.2; } }
  if (type === 'hit' || type === 'strip') { const c = this.carrier(); if (c) { const dx = c.x - e.x, dy = c.y - e.y, m = Math.hypot(dx, dy) || 1; e.vx = dx / m * (e.maxV + 1.5); e.vy = dy / m * (e.maxV + 1.5); } }
  sfx('juke');
  return true;
};
const mvOn = (lg, e, type) => e && e.mv && e.mv.type === type && lg.t < e.mv.until;

// inputs: keys while a play is live
const _liveStepMV = LM.liveStep;
LM.liveStep = function (dt) {
  const inp = this.input, c = this.ctrl, car = this.carrier(), b = this.ball;
  if (c && inp.move) {
    const m = inp.move; inp.move = null;
    if (car === c && ['stiff', 'spin', 'hurdle', 'truck', 'hesi'].includes(m) && !(c === this.passer && this.passReady && !this.play.thrown && !this.play.crossed)) this.doMove(c, m);
    else if (car && car.side !== c.side && (m === 'hit' || m === 'strip') && this.dist(c, car) < 3.2) this.doMove(c, m);
  }
  // receiver: SPACE while the ball is coming to you = high-point catch
  if (c && inp.actionEdge && b && b.state === 'air' && this.play.target === c && c.side === 'O') { inp.actionEdge = false; this.doMove(c, 'high'); }
  // burst after a hesitation
  for (const e of this.ents) if (e.burst && e.burst > this.t && e.burst - this.t < 0.45) { const sp = Math.hypot(e.vx, e.vy) || 1; const top = e.maxV * 1.08; if (sp < top) { e.vx *= 1 + dt * 3; e.vy *= 1 + dt * 3; } }
  // stiff arm and truck slow you a little
  for (const e of this.ents) if (e.mv && this.t < e.mv.until && (e.mv.type === 'stiff' || e.mv.type === 'truck')) { e.vx *= 1 - dt * 0.4; e.vy *= 1 - dt * 0.4; }
  return _liveStepMV.call(this, dt);
};

// CPU ball carriers and defenders pick moves that fit their ratings
const _aiCarrierMV = LM.aiCarrier;
LM.aiCarrier = function (e, dt) {
  _aiCarrierMV.call(this, e, dt);
  if (e === this.ctrl || (e.mvCd || 0) > this.t) return;
  const threat = this.ents.find(d => d.side !== e.side && !d.eng && d.stun <= 0 && this.dist(d, e) < 2.6 && (e.side === 'O' ? d.x > e.x - 0.5 : d.x < e.x + 0.5));
  if (!threat || !chance(dt * 0.9)) return;
  const r = e.r, opts = [['stiff', r.str + r.btk * 0.5], ['spin', r.agi + r.btk * 0.3], ['truck', r.str * 1.1 + r.btk * 0.5 - 20], ['hesi', r.agi * 0.8], ['hurdle', threat.dive > 0 ? 200 : r.agi * 0.5 - 10]];
  this.doMove(e, weighted(opts.filter(o => o[1] > 0), o => o[1])[0]);
};

// tackling, now aware of moves (replaces the base version)
LM.tackles = function (c) {
  for (const d of this.ents) {
    if (d.side === c.side || d.stun > 0 || d.tcd > 0) continue;
    const dd = this.dist(d, c);
    const cpuDive = d !== this.ctrl && dd > 1.15 && dd < 2.0 && d.dive <= 0;
    if (cpuDive) {
      if (chance(0.06)) { // the CPU sometimes goes for a big hit or the ball instead of a dive
        if (d.r.str >= 72 && chance(0.12) && this.doMove(d, 'hit')) { }
        else if (chance(0.06) && this.doMove(d, 'strip')) { }
        else d.dive = 0.3;
      } else continue;
    }
    const hitting = mvOn(this, d, 'hit'), stripping = mvOn(this, d, 'strip');
    const R = d.dive > 0 ? 2.0 : hitting ? 1.7 : 1.15;
    if (dd > R) continue;
    if (d.eng && (dd > 0.95 || !chance(0.12))) { d.tcd = 0.4; continue; }
    const btk = (!this.play.caught && c.role !== 'RB') ? Math.max(c.r.btk, c.r.agi * 0.5 + c.r.spd * 0.42) : c.r.btk;
    let p = 0.73 + (d.r.tkl - btk) / 110;
    if (c.juke > 0) p -= 0.22 + c.r.agi / 450;
    const front = c.side === 'O' ? d.x > c.x - 0.3 : d.x < c.x + 0.3;
    let move = null;
    if (mvOn(this, c, 'stiff') && front) { p -= 0.13 + (c.r.str - d.r.tkl) / 260; move = 'stiff'; }
    if (mvOn(this, c, 'spin')) { p -= front ? 0.08 : 0.22; move = 'spin'; }
    if (mvOn(this, c, 'hurdle')) { if (d.dive > 0) p = 0.04; else p -= 0.06; move = 'hurdle'; }
    if (mvOn(this, c, 'truck') && front) { p -= 0.05 + (c.r.str + c.r.btk - d.r.str - d.r.tkl) / 170; move = 'truck'; }
    if (mvOn(this, c, 'hesi')) { p -= 0.05; move = 'hesi'; }
    if (c === this.passer && this.passReady && !this.play.crossed && !this.play.thrown) p += 0.22;
    if (d.dive > 0) p += 0.08;
    if (hitting) p += 0.1 + (d.r.str - c.r.str) / 220;
    if (stripping) p -= 0.08;
    const behind = (c.side === 'O' ? d.x < c.x : d.x > c.x);
    if (behind) p -= 0.12;
    const sp = Math.hypot(c.vx, c.vy); p -= Math.max(0, sp - 7) * 0.025;
    p = clamp(p, 0.04, 0.95);
    this.tAtt = (this.tAtt || 0) + 1;
    if (chance(p)) {
      this.tackler = d;
      // fumbles: big hits, strips and moves that leave the ball loose
      let fb = 0;
      if (hitting) fb += 0.05 + Math.max(0, d.r.str - c.r.btk) / 500;
      if (stripping) fb += 0.11;
      if (move === 'spin' || move === 'hurdle') fb += 0.02;
      this.fumbleBoost = fb;
      if (hitting) { this.flash('BIG HIT!'); this.cheer = 1; sfx('snap'); }
      return this.endPlay('tackle');
    }
    this.tMiss = (this.tMiss || 0) + 1;
    d.tcd = 0.7; d.stun = d.dive > 0 ? 0.9 : hitting ? 1.2 : 0.45; d.dive = 0;
    if (move === 'stiff' || move === 'truck') { const dx = d.x - c.x, dy = d.y - c.y, m = Math.hypot(dx, dy) || 1; d.vx = dx / m * 4; d.vy = dy / m * 4; d.stun = move === 'truck' ? 1.2 : 0.8; d.anim = { type: 'down', t0: this.t2, dur: 0.4, hold: false }; }
    const keep = { stiff: 0.85, truck: 0.62, spin: 0.75, hurdle: 0.9, hesi: 0.7 }[move] || 0.55;
    c.vx *= keep; c.vy *= keep;
    if (move) { this.flash(MOVES[move].name); st(this.gs, c.p, 'btk'); }
    else if (c.juke > 0) this.flash('Juked!');
    else if (hitting) this.flash('Whiffed!');
    else if (chance(0.5)) this.flash('Broken tackle!');
  }
};

// big hits / strips raise the fumble chance in the weather fumble check
const _endPlayMV = LM.endPlay;
LM.endPlay = function (kind, msg) {
  const r = _endPlayMV.call(this, kind, msg);
  this.fumbleBoost = 0;
  return r;
};

// high-point catch: bigger catch radius and better odds in traffic
const _resolveMV = LM.resolvePass;
LM.resolvePass = function () {
  const r = this.play.target, hi = mvOn(this, r, 'high');
  if (hi) { r.r.cat += 14; r._hiBoost = true; }
  try { return _resolveMV.call(this); } finally { if (r && r._hiBoost) { r.r.cat -= 14; r._hiBoost = false; } }
};

// ---------- animations ----------
const _poseForMV = LM.poseFor;
LM.poseFor = function (e) {
  if (e.mv && this.t < e.mv.until && this.phase === 'live') return { type: 'mv_' + e.mv.type, k: clamp(1 - (e.mv.until - this.t) / MOVES[e.mv.type].dur, 0, 1), dir: Math.sign(e.vy) || 1 };
  return _poseForMV.call(this, e);
};

// ---------- controls ----------
document.addEventListener('keydown', e => {
  if (typeof GAME === 'undefined' || !GAME || GAME.paused) return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const lg = GAME.live; if (lg.phase !== 'live') return;
  const carrierIsMe = lg.carrier() === lg.ctrl;
  const map = carrierIsMe ? { KeyF: 'stiff', KeyR: 'spin', KeyV: 'hurdle', KeyX: 'truck', KeyC: 'hesi' } : { KeyF: 'hit', KeyR: 'strip' };
  if (map[e.code]) { lg.input.move = map[e.code]; e.preventDefault(); }
});
document.addEventListener('click', e => {
  const el = e.target.closest('[data-mv]'); if (!el || !GAME) return;
  GAME.live.input.move = el.dataset.mv; e.preventDefault();
});
document.addEventListener('touchstart', e => {
  const el = e.target.closest && e.target.closest('[data-mv]'); if (!el || !GAME) return;
  GAME.live.input.move = el.dataset.mv; e.preventDefault();
}, { passive: false });
const _updateHUDMV = updateHUD;
updateHUD = function () {
  _updateHUDMV();
  if (!GAME) return;
  const lg = GAME.live, box = document.getElementById('moveBtns'); if (!box) return;
  const car = lg.carrier(), c = lg.ctrl, live = lg.phase === 'live' && c;
  const mode = !live ? '' : car === c && !(c === lg.passer && lg.passReady && !lg.play.thrown && !lg.play.crossed) ? 'run' : car && car.side !== c.side ? 'def' : '';
  if (box._m !== mode + touchMode) {
    box._m = mode + touchMode;
    box.hidden = !mode;
    box.innerHTML = mode === 'run' ? [['stiff', 'Stiff arm', 'F'], ['spin', 'Spin', 'R'], ['hurdle', 'Hurdle', 'V'], ['truck', 'Truck', 'X'], ['hesi', 'Hesi', 'C']].map(([k, n, key]) => `<button class="mvb" data-mv="${k}">${n}${touchMode ? '' : ` <kbd>${key}</kbd>`}</button>`).join('')
      : mode === 'def' ? [['hit', 'Hit stick', 'F'], ['strip', 'Strip', 'R']].map(([k, n, key]) => `<button class="mvb" data-mv="${k}">${n}${touchMode ? '' : ` <kbd>${key}</kbd>`}</button>`).join('') : '';
  }
};
