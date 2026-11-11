// ============================================================
// Gridiron Dynasty - pre-snap adjustments and more trick plays:
// audibles, hot routes, lob passes, Hook & Lateral, QB Throwback
// ============================================================
'use strict';

Object.assign(ROUTES, { trail: [[2, 6], [5, 8], [3.5, 3, 's']] });

const EXTRA_PLAYS = [
  { id: 'hooklat', name: 'Hook & Lateral', type: 'pass', cat: 'Trick', form: 'gun', hooklat: true,
    routes: { WR1: 'curl', WR2: 'go', WR3: 'post', TE: 'seam', RB: 'trail' },
    desc: 'WR1 hooks up, the RB trails him. After the catch press SPACE to pitch it.' },
  { id: 'throwback', name: 'QB Throwback', type: 'trick', cat: 'Trick', form: 'gun', directSnap: 'RB', fakeRun: true,
    path: [[0.6, 2], [0.4, 1.5]], routes: { QB: 'wheel', WR1: 'go', WR2: 'post', WR3: 'drag' },
    desc: 'Direct snap to the RB. QB slips out on a wheel and the RB throws it back to him.' },
];
for (const p of EXTRA_PLAYS) { OFF_PLAYS.push(p); NEW_PLAYS.push(p); }

const HOT_ROUTES = [['go', 'Go'], ['slant', 'Slant'], ['out', 'Out'], ['dig', 'In'], ['curl', 'Curl'], ['hitch', 'Hitch'], ['drag', 'Drag'], ['post', 'Post'], ['corner', 'Corner'], ['flat', 'Flat'], ['block', 'Block']];

const LX = LiveGame.prototype;

// ---------- setup for the new plays ----------
const _setupX = LX.setup;
LX.setup = function () {
  _setupX.call(this);
  const op = this.offPlay, O = this.O, by = this.gs.ballY;
  if (op.directSnap) {
    const rb = O[op.directSnap];
    this.ball.holder = rb; this.passer = rb; this.passReady = false; this.passReadyAt = null;
    if (op.routes.QB) { O.QB.task = { k: 'route', name: op.routes.QB, pts: this.routePts(op.routes.QB, O.QB.x, O.QB.y, by), i: 0 }; this.eligible.push(O.QB); }
    for (const e of O.OL) e.task = { k: 'pblock', assign: e.task.assign };
    if (this.userOnOffense()) this.ctrl = rb;
  }
};

// ---------- per-frame: lateral after the catch, direct-snap timing ----------
const _scriptX = LX.scriptStep;
LX.scriptStep = function (dt) {
  _scriptX.call(this, dt);
  if (this.phase !== 'live') return;
  const op = this.offPlay, pl = this.play, O = this.O, inp = this.input, car = this.carrier();
  if (op.directSnap) {
    if (!pl.readSet && this.t > 0.2) { // only the front seven bite on the fake; DBs stay home
      pl.readSet = true; pl.handoff = true;
      for (const d of this.ents) if (d.side === 'D' && (d.role.startsWith('DL') || d.role.startsWith('LB'))) d.read = Math.min(d.read, this.t + d.react);
    }
    if (!this.passReady && !pl.thrown && this.t > 0.75 && car === this.passer) {
      this.passReady = true; this.passReadyAt = this.t;
      // the most alert defender nearby picks up the leaking QB
      const qb = O.QB; const cover = this.ents.filter(d => d.side === 'D' && !d.eng).sort((a, b) => (this.dist(a, qb) - a.r.awr / 10) - (this.dist(b, qb) - b.r.awr / 10))[0];
      if (cover) { cover.task = { k: 'man', tgt: qb }; cover.read = Infinity; cover.react = Math.max(0.15, cover.react); }
    }
  }
  if (op.hooklat && pl.caught && !pl.hookPitched && car && car.role === 'WR1') {
    const rb = O.RB, close = this.dist(rb, car) < 12 && rb.x < car.x + 2;
    const userWR = this.userOnOffense() && this.ctrl === car;
    if (close && ((userWR && inp.actionEdge) || (!userWR && this.t - (pl.catchT || this.t) > 0.35))) {
      inp.actionEdge = false; pl.hookPitched = true; this.pitch(car, rb);
    }
  }
};
const _pitchCaughtX = LX.onPitchCaught;
LX.onPitchCaught = function (to) {
  if (this.offPlay.hooklat) { this.flash('Lateral!'); if (this.userOnOffense()) this.ctrl = to; return; }
  return _pitchCaughtX.call(this, to);
};
// remember when the catch happened (for the CPU's lateral timing)
const _resolveX = LX.resolvePass;
LX.resolvePass = function () {
  _resolveX.call(this);
  if (this.play.caught && this.play.catchT == null) this.play.catchT = this.t;
};
const _hintX = LX.scriptHint;
LX.scriptHint = function () {
  const pl = this.play, car = this.carrier();
  if (this.phase === 'live' && this.offPlay.hooklat && pl.caught && !pl.hookPitched && car && car === this.ctrl && car.role === 'WR1')
    return { key: 'SPACE to pitch it to the trailing RB', touch: 'Tap LATERAL to pitch it', act: 'Lateral' };
  if (this.phase === 'live' && this.offPlay.directSnap && !this.passReady && !pl.thrown && car === this.ctrl)
    return { key: 'Sell the run... then throw it back to the QB', touch: 'Sell the run, then throw', act: 'Juke' };
  return _hintX ? _hintX.call(this) : null;
};

// ---------- hot routes ----------
LX.canAdjust = function () { return this.phase === 'pre' && this.userOnOffense() && this.O && ['pass', 'rpo'].includes(this.offPlay.type); };
LX.setHotRoute = function (role, route) {
  const e = this.O[role]; if (!e || !this.canAdjust()) return;
  if (route === 'block') e.task = { k: role === 'RB' || role === 'TE' ? 'pblock' : 'block' };
  else e.task = { k: 'route', name: route, pts: this.routePts(route, e.x, e.y, this.gs.ballY), i: 0 };
  this.eligible = ['WR1', 'WR2', 'WR3', 'TE', 'RB', 'QB'].map(k => this.O[k]).filter(x => x && x.task.k === 'route');
  this.hotRouted = true;
};

// Hook & Lateral: the RB shadows WR1 a few yards behind and inside him, before and after the catch
const _aiX = LX.ai;
LX.ai = function (e, dt) {
  const op = this.offPlay, pl = this.play, O = this.O;
  if (op.hooklat && e === O.RB && this.carrier() !== e && !pl.hookPitched && !pl.int && this.t > 0.35) {
    const w = O.WR1, inward = Math.sign(this.gs.ballY - w.y) || 1;
    return this.steer(e, w.x - 3, w.y + inward * 2.5, 1, dt);
  }
  return _aiX.call(this, e, dt);
};
