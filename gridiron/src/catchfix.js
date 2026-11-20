// ============================================================
// Gridiron Dynasty - catch assist for the receiver you control.
// The ball is aimed where the receiver is going; if you steer him
// a step off that spot, he still gets to it (within reach), and a
// receiver who is open hangs onto clean catches.
// ============================================================
'use strict';
const LCF = LiveGame.prototype;
// while the ball is in the air to you: gently pull your receiver to the catch spot
const _liveStepCF = LCF.liveStep;
LCF.liveStep = function (dt) {
  const b = this.ball, r = this.play && this.play.target;
  if (b && b.state === 'air' && r && r === this.ctrl && r.side === 'O') {
    const left = b.T - b.t, dx = b.tx - r.x, dy = b.ty - r.y, d = Math.hypot(dx, dy);
    if (d > 0.3 && left < 0.9) { const k = Math.min(1, dt * (left < 0.4 ? 9 : 4)); r.x += dx * k * 0.75; r.y += dy * k * 0.75; }
  }
  return _liveStepCF.call(this, dt);
};
// at the catch: snap a controlled receiver onto the ball if he is close, and fewer drops when nobody is on him
const _resolveCF = LCF.resolvePass;
LCF.resolvePass = function () {
  const b = this.ball, r = this.play && this.play.target;
  if (!r || r.side !== 'O') return _resolveCF.call(this);
  const mine = r === this.ctrl || (r.p && r.p.star);
  const rd = Math.hypot(r.x - b.tx, r.y - b.ty);
  if (mine && rd < 3.2) { r.x += (b.tx - r.x) * 0.75; r.y += (b.ty - r.y) * 0.75; }
  let nearD = 99; for (const e of this.ents) if (e.side === 'D') nearD = Math.min(nearD, Math.hypot(e.x - b.tx, e.y - b.ty));
  const boost = mine ? (nearD > 2.2 ? 16 : 7) : (nearD > 2.2 ? 6 : 0);
  r.r.cat += boost;
  try { return _resolveCF.call(this); } finally { r.r.cat -= boost; }
};
