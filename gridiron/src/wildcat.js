// ============================================================
// Gridiron Dynasty - Wildcat: the RB takes a direct snap, the QB
// splits out wide, a receiver comes across on jet motion.
// ============================================================
'use strict';

// RB in the shotgun spot, WR3 in the backfield for the jet, QB split out in the slot
FORMS.wildcat = { QB: [-1.2, 12.5], RB: [-5, 0], WR1: [-1, -19], WR2: [-1, 19.5], WR3: [-4.6, -7], TE: [-1.3, 4.3] };

const WILDCAT_PLAYS = [
  { id: 'wcpower', name: 'Wildcat Power', type: 'trick', cat: 'Wildcat', form: 'wildcat', directSnap: 'RB', directNoPass: true, fakeRun: true,
    path: [[0.6, 0.8], [1.6, 2.2], [12, 3]], jetPath: [[0.4, 3], [0.6, 6], [1, 8], [8, 9]], routes: { QB: 'go' },
    desc: 'Direct snap. Jet motion pulls the defense left, RB powers off right tackle.' },
  { id: 'wcjet', name: 'Wildcat Jet Sweep', type: 'trick', cat: 'Wildcat', form: 'wildcat', directSnap: 'RB', directNoPass: true, wcHand: true,
    path: [[0.2, 0.3]], delay: 1.3, jetPath: [[0.3, 3.5], [0.6, 3.5], [1.6, 3.5], [3.2, 3], [12, 1]], routes: { QB: 'go' },
    desc: 'RB hands it to the jet man at full speed. Get to the edge.' },
  { id: 'wccounter', name: 'Wildcat Counter', type: 'trick', cat: 'Wildcat', form: 'wildcat', directSnap: 'RB', directNoPass: true, fakeRun: true,
    path: [[0, 1], [0.6, -1.5], [2, -4.5], [12, -6]], jetPath: [[0.4, 3], [0.6, 6], [1, 8], [8, 9]], routes: { QB: 'go' },
    desc: 'Fake the jet right, RB cuts back left behind the pullers.' },
  { id: 'wcpass', name: 'Wildcat Pass', type: 'trick', cat: 'Wildcat', form: 'wildcat', directSnap: 'RB', fakeRun: true,
    path: [[0.6, 1.5], [-0.4, 0.5]], jetPath: [[0.4, 3], [0.6, 6], [1, 8], [3, 9]], routes: { QB: 'corner', WR1: 'post', WR2: 'go', TE: 'seam' },
    desc: 'RB fakes the run, pulls up and throws. Your QB runs a corner route.' },
];
for (const p of WILDCAT_PLAYS) { OFF_PLAYS.push(p); NEW_PLAYS.push(p); }

const LW = LiveGame.prototype;
const _setupW = LW.setup;
LW.setup = function () {
  _setupW.call(this);
  const op = this.offPlay, O = this.O;
  if (op.form !== 'wildcat') return;
  if (op.jetPath) O.WR3.task = { k: 'path', pts: pathFrom(O.WR3.x, O.WR3.y, op.jetPath), i: 0, jet: true };
  if (op.jetPath) { const sgn = Math.sign(op.jetPath[0][1]) || 1; O.WR3.vy = sgn * O.WR3.maxV * 0.85; } // already in full-speed motion at the snap
  // QB without a route just blocks out wide
  if (!(op.routes && op.routes.QB)) O.QB.task = { k: 'block' };
  this.eligible = this.eligible.filter(e => e !== O.WR3 || e.task.k === 'route');
};

// jet handoff: RB gives it to WR3 as he flies past
const _scriptW = LW.scriptStep;
LW.scriptStep = function (dt) {
  _scriptW.call(this, dt);
  if (this.phase !== 'live') return;
  const op = this.offPlay, pl = this.play, O = this.O;
  if (op.wcHand && !pl.wcGiven && this.carrier() === O.RB) {
    const w = O.WR3;
    if ((this.t > 0.3 && this.dist(O.RB, w) < 1.7) || (this.t > 1.1 && this.dist(O.RB, w) < 4)) {
      pl.wcGiven = true; this.ball.holder = w; pl.handoff = true; this.readAll(this.t, 'run');
      O.RB.task = { k: 'block' };
      if (this.userOnOffense()) this.ctrl = w;
    }
  }
};

// jet decoy: once the fake path ends, keep running wide instead of wandering
const _aiPathW = LW.aiPath;
LW.aiPath = function (e, tk, dt) {
  if (tk.jet && tk.i >= tk.pts.length && this.carrier() !== e) { const ty = clamp(e.y + (e.y > this.gs.ballY ? 3 : -3), 3, FIELD_W - 3); return this.steer(e, e.x + 3, ty, 0.8, dt); }
  return _aiPathW.call(this, e, tk, dt);
};

// the jet man runs his motion even while everyone else switches to run blocking
const _aiW = LW.ai;
LW.ai = function (e, dt) {
  if (e.task && e.task.jet && this.carrier() !== e && !this.play.int && !this.play.thrown) return this.aiPath(e, e.task, dt);
  return _aiW.call(this, e, dt);
};
