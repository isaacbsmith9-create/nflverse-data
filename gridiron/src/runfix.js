// ============================================================
// Gridiron Dynasty - outside run blocking: on tosses, sweeps, jet and
// speed option the line steps playside, the TE seals the edge, receivers
// stalk the corner and safety, and free blockers climb to linebackers.
// ============================================================
'use strict';

const LR = LiveGame.prototype;

// figure out which way an outside run is going (once), from the play design or the carrier's path
LR.runSide = function () {
  const pl = this.play; if (pl.rside !== undefined) return pl.rside;
  const op = this.offPlay, car = this.carrier(); if (!car) return 0;
  if (car === this.passer && !pl.handoff && !this.qbRunMode && !op.directSnap) return 0;
  const steps = (car === this.O.RB && op.path) || (car.task && car.task.k === 'path' && car.task.pts && null) || op.carrierPath || op.jetPath || op.qbPath;
  let dy = 0;
  let flip = false;
  if (steps) { for (const s of steps) dy += s[1]; for (const s of steps) if (Math.abs(s[1]) >= 1.5 && Math.sign(s[1]) !== Math.sign(dy)) flip = true; }
  if (flip) { pl.rside = 0; return 0; } // counters / cutbacks are gap runs, not perimeter runs
  else if (car.task && car.task.pts && car.task.pts.length) dy = car.task.pts[car.task.pts.length - 1][1] - this.gs.ballY;
  if (Math.abs(dy) < 4.5 && Math.abs(car.vy) > 3 && Math.abs(car.y - this.gs.ballY) > 3) dy = car.vy;
  const v = Math.abs(dy) >= 4.5 ? Math.sign(dy) : 0;
  if (v || this.t > 1.2) pl.rside = v; // decide once the real carrier shows the direction
  return v;
};

const _aiRunBlockRF = LR.aiRunBlock, _aiEscortRF = LR.aiEscort;
LR.aiRunBlock = function (e, dt) { if (!this.rfBlock(e, dt)) _aiRunBlockRF.call(this, e, dt); };
LR.aiEscort = function (e, dt) { if (e.role === 'QB' || !this.rfBlock(e, dt)) _aiEscortRF.call(this, e, dt); };
LR.rfBlock = function (e, dt) {
  const car = this.carrier();
  if (!car || car === e || car.side !== 'O' || e.side !== 'O' || this.play.int || this.play.thrown || this.play.caught) return false;
  const side = this.runSide();
  if (!side) return false;
  // keep a live assignment, otherwise pick the best playside threat nobody else has
  let tgt = e.rf;
  const valid = d => d && !d.unblocked && d.freeT <= 0 && this.dist(d, e) < 11 && (!d.eng || d.eng === e) && d.x > Math.min(e.x, car.x) - 3;
  if (!valid(tgt)) {
    const claimed = new Set(); for (const o of this.ents) if (o !== e && o.side === 'O' && o.rf) claimed.add(o.rf);
    const isOL = e.role.startsWith('OL'), wide = e.role.startsWith('WR');
    let best = null, bs = 1e9;
    for (const d of this.ents) {
      if (d.side !== 'D' || d.unblocked || d.freeT > 0 || (d.eng && d.eng !== e)) continue;
      if (d.x < Math.min(e.x, car.x) - 3) continue; // already beaten / behind the play
      const lat = (d.y - e.y) * side; // >0: defender is playside of me
      let s = this.dist(d, e);
      if (lat < -1.2) s += isOL ? 6 : 3;              // backside guys are someone else's problem
      if (claimed.has(d)) s += 7;                      // no double teams
      if (wide && (d.role.startsWith('CB') || d.role.startsWith('S'))) s -= 2.5; // stalk the DBs
      if (isOL && d.role.startsWith('LB') && !this.ents.some(x => x.side === 'D' && x.role.startsWith('DL') && !x.eng && this.dist(x, e) < 2.5)) s -= 1; // climb
      // the man who can actually make the tackle matters most
      if ((d.y - car.y) * side > -2 && d.x > car.x - 1) s -= 1.5;
      if (s < bs) { bs = s; best = d; }
    }
    e.rf = tgt = best;
  }
  if (!tgt) { this.steer(e, e.x + 2, e.y + side * 2, 0.7, dt); return true; }
  // get between the defender and the carrier, shaded inside so the runner has the edge
  const dx = tgt.x - car.x, dy = tgt.y - car.y, m = Math.hypot(dx, dy) || 1;
  this.steer(e, tgt.x - dx / m * 0.9, tgt.y - dy / m * 0.9 - side * 0.35, 1, dt);
  return true;
};

// carriers on outside runs: once past the edge, get vertical
const _aiCarrierRF = LR.aiCarrier;
LR.aiCarrier = function (e, dt) {
  const side = e.side === 'O' && !this.play.caught && !this.play.int ? this.runSide() : 0;
  if (side && e.x > this.los - 1.5 && Math.abs(e.y - this.gs.ballY) > 6) {
    // look for the alley: closest unblocked defender ahead
    const thr = this.ents.filter(d => d.side === 'D' && !d.eng && d.x > e.x - 1 && this.dist(d, e) < 6);
    if (!thr.length) return this.steerDir(e, 0.94, side * 0.34, 0.97, dt);
  }
  this._fwdW = side && e.x > this.los - 2 ? 5.5 : 3; // downhill once he reaches the line
  _aiCarrierRF.call(this, e, dt); this._fwdW = 3;
};
