// ============================================================
// Gridiron Dynasty - expanded playbook: read option, speed option,
// RPOs, designed QB runs and trick plays (flea flicker, end-around,
// HB pass, double pass), plus QB slide and the read-defender system.
// ============================================================
'use strict';

Object.assign(ROUTES, {
  bubble: [[-0.8, -3], [0.6, -4], [4, -1]],
  glance: [[3, 0], [10, 5]],
  backstep: [[-2.5, 0.6, 's']],
});

// tag existing plays with playbook categories
for (const p of OFF_PLAYS) p.cat = p.cat || (p.type === 'run' ? 'Run' : 'Pass');

const NEW_PLAYS = [
  { id: 'zoneread', name: 'Zone Read', type: 'option', cat: 'Option', form: 'gun', read: 'DL4',
    path: [[0.4, -1.5], [1.5, -3.5], [9, -4.5]], qbPath: [[1, 1.8], [3, 3.2], [12, 3]],
    desc: 'Read the unblocked end. He crashes, you keep. He sits, you give.' },
  { id: 'speedopt', name: 'Speed Option', type: 'speedopt', cat: 'Option', form: 'gun', read: 'DL4',
    qbPath: [[1.6, 2.2], [2.6, 3.6], [3, 2.6], [14, 2]], path: [[0.8, 3.2], [2, 5.4], [2.6, 4.2], [14, 3]],
    desc: 'Attack the edge with the RB trailing. Pitch when the end commits.' },
  { id: 'rpoglance', name: 'RPO Glance', type: 'rpo', cat: 'RPO', form: 'gun', read: 'LB1', quick: true,
    path: [[0.4, -1.5], [1.5, -3], [9, -3.5]], routes: { WR1: 'glance', WR2: 'hitch', WR3: 'bubble' },
    desc: 'Inside zone with a glance tag. LB fills the run, throw it behind him.' },
  { id: 'rpobubble', name: 'RPO Bubble', type: 'rpo', cat: 'RPO', form: 'trips', read: 'LB2', quick: true,
    path: [[0.4, 1.5], [1.5, 3], [9, 3.5]], routes: { WR3: 'bubble', WR2: 'slant', WR1: 'go' },
    desc: 'Count the box. Light box, hand it off. Loaded box, throw the bubble.' },
  { id: 'qbpower', name: 'QB Power', type: 'qbrun', cat: 'QB Run', form: 'gun', qbPath: [[0.5, 1.2], [1.5, 2.6], [10, 3.2]],
    desc: 'Designed QB run behind a lead-blocking back.' },
  { id: 'qbdraw', name: 'QB Draw', type: 'qbrun', cat: 'QB Run', form: 'gun', delay: 0.45, qbPath: [[-0.6, 0], [0.4, -0.5], [10, -1]],
    desc: 'Show pass, then take off up the middle.' },
  { id: 'qbsneak', name: 'QB Sneak', type: 'qbrun', cat: 'QB Run', form: 'single', qbPath: [[1.2, 0], [5, 0]],
    desc: 'Push the pile on short yardage.' },
  { id: 'flea', name: 'Flea Flicker', type: 'trick', cat: 'Trick', form: 'single', handTo: 'RB', fakeRun: true, flea: true, pitchBackAt: 1.0,
    path: [[2, 0], [1.2, 0]], routes: { WR1: 'post', WR2: 'go', WR3: 'dig' },
    desc: 'Hand off, RB pitches it back, QB airs it out over a biting secondary.' },
  { id: 'endaround', name: 'End Around', type: 'trick', cat: 'Trick', form: 'gun', handTo: 'WR3',
    carrierPath: [[-2.2, 4.5], [0.2, 5], [2.5, 5], [18, 5]], path: [[1.5, -1], [6, -1]],
    desc: 'Fake the dive, slot receiver sweeps the other way.' },
  { id: 'hbpass', name: 'HB Pass', type: 'trick', cat: 'Trick', form: 'single', toss: true, fakeRun: true,
    path: [[1, 3], [0.3, 6], [0.2, 9], [0, 11]], routes: { WR1: 'post', WR2: 'go', TE: 'corner' },
    desc: 'Toss to the RB, he rolls right and throws deep.' },
  { id: 'doublepass', name: 'Double Pass', type: 'trick', cat: 'Trick', form: 'gun', lateralTo: 'WR1', latAt: 0.45, fakeRun: true,
    routes: { WR1: 'backstep', WR2: 'go', WR3: 'post', TE: 'seam' },
    desc: 'Backward pass to the outside WR, who throws it downfield.' },
];
for (const p of NEW_PLAYS) { p.routes = p.routes || {}; OFF_PLAYS.push(p); }
const SCRIPT_TYPES = ['option', 'speedopt', 'rpo', 'qbrun', 'trick'];

// CPU sometimes calls the new stuff, more with a running QB
const _cpuOffCall = cpuOffCall;
cpuOffCall = function (gs) {
  const qb = gs.lu[gs.poss].QB[0];
  const r = Math.random(), mobile = qb.r.spd >= 80;
  if (gs.togo <= 1 && r < 0.25) return NEW_PLAYS.find(p => p.id === 'qbsneak');
  if (r < (mobile ? 0.16 : 0.05)) return pick(NEW_PLAYS.filter(p => p.cat === 'Option' || p.cat === 'QB Run'));
  if (r < (mobile ? 0.24 : 0.12)) return pick(NEW_PLAYS.filter(p => p.cat === 'RPO'));
  if (r < (mobile ? 0.27 : 0.15)) return pick(NEW_PLAYS.filter(p => p.cat === 'Trick'));
  return _cpuOffCall(gs);
};

const LG = LiveGame.prototype;
const pathFrom = (sx, sy, steps) => { let x = sx, y = sy; return steps.map(([dx, dy]) => { x += dx; y += dy; return [x, clamp(y, 1, FIELD_W - 1)]; }); };

// ---------- setup ----------
const _setup = LG.setup;
LG.setup = function () {
  _setup.call(this);
  this.qbRunMode = false; this.readKey = null; this.qbPts = null;
  const op = this.offPlay, O = this.O;
  if (!SCRIPT_TYPES.includes(op.type)) return;
  this.runBlocking = !(op.type === 'trick' && (op.toss || op.lateralTo)) && !(op.type === 'qbrun' && op.delay);
  for (const e of O.OL) e.task = { k: this.runBlocking ? 'rblock' : 'pblock', assign: e.task.assign };
  for (const k of ['WR1', 'WR2', 'WR3', 'TE', 'RB']) {
    const e = O[k], rt = op.routes[k];
    if (rt && rt !== 'block') e.task = { k: 'route', name: rt, pts: this.routePts(rt, e.x, e.y, this.gs.ballY), i: 0 };
    else if (k === op.handTo && op.carrierPath) e.task = { k: 'path', pts: pathFrom(e.x, e.y, op.carrierPath), i: 0 };
    else if (k === 'RB' && op.path) e.task = { k: 'path', pts: pathFrom(e.x, e.y, op.path), i: 0, delay: op.delay || 0 };
    else e.task = { k: this.runBlocking ? 'block' : 'pblock' };
  }
  this.eligible = ['WR1', 'WR2', 'WR3', 'TE', 'RB'].filter(k => O[k].task.k === 'route').map(k => O[k]);
  if (op.id === 'endaround') { const w = O.WR3; w.x = this.los - 2.5; w.y = clamp(this.gs.ballY - 5, 2, FIELD_W - 2); w.task = { k: 'path', pts: pathFrom(w.x, w.y, op.carrierPath), i: 0 }; }
  if (op.qbPath) this.qbPts = pathFrom(O.QB.x, O.QB.y, op.qbPath);
  if (op.type === 'qbrun' || op.type === 'speedopt') { this.qbRunMode = true; O.QB.task = { k: 'path', pts: this.qbPts, i: 0, delay: op.delay || 0 }; }
  this.passer = O.QB; this.passReady = op.type === 'rpo'; this.passReadyAt = op.type === 'rpo' ? 0.2 : null;
  if (op.read && this.droles[op.read]) {
    const e = this.droles[op.read]; e.unblocked = true; e.readKey = true; this.readKey = e;
    e.readMode = chance(0.5) ? 'crash' : 'squeeze';
    for (const b of O.OL) if (b.task.assign === e) b.task.assign = null;
  }
  if (this.userOnOffense()) this.ctrl = O.QB;
};

// ---------- per-frame scripting ----------
LG.pitch = function (from, to) {
  const b = this.ball;
  b.state = 'pitch'; b.holder = null; b.sx = from.x; b.sy = from.y; b.to = to; b.t = 0;
  b.T = clamp(this.dist(from, to) / 16, 0.18, 0.5); b.tx = to.x; b.ty = to.y; b.h = 0.8;
  sfx('throw');
};
LG.onPitchCaught = function (to) {
  const op = this.offPlay, pl = this.play, user = this.userOnOffense();
  if (to.task && to.task.k === 'path') { while (to.task.i < to.task.pts.length - 1 && to.task.pts[to.task.i][0] < to.x + 0.5) to.task.i++; } // never run back to old path points
  if (op.type === 'speedopt') { pl.handoff = true; this.qbRunMode = false; this.readAll(this.t, 'run'); this.flash('Pitch!'); }
  else if (op.toss || (op.flea && to === this.O.QB) || op.lateralTo) {
    this.passer = to; this.passReady = true; this.passReadyAt = this.t; pl.handoff = true;
    if (op.lateralTo) { this.eligible = this.eligible.filter(e => e !== to); to.task = { k: 'hold' }; }
    if (op.toss) this.readAll(this.t, 'run');
    if (op.flea) this.flash('Flea flicker!');
  }
  if (user) this.ctrl = to;
};
LG.optKeep = function () {
  const pl = this.play, O = this.O;
  pl.decided = true; this.qbRunMode = true;
  O.QB.task = { k: 'path', pts: this.qbPts, i: 0 };
  this.readAll(this.t, 'scramble'); this.flash('Keeper!');
};
LG.optGive = function () {
  const pl = this.play, O = this.O;
  pl.decided = true; this.ball.holder = O.RB; pl.handoff = true; this.passReady = false;
  this.readAll(this.t, 'run');
  if (this.userOnOffense()) this.ctrl = O.RB;
  if (this.qbPts) O.QB.task = { k: 'fake', pts: this.qbPts };
};

LG.scriptStep = function (dt) {
  const op = this.offPlay, pl = this.play, O = this.O, b = this.ball, inp = this.input;
  if (!op || !pl) return;
  if (b.state === 'pitch') {
    b.t += dt; const k = Math.min(1, b.t / b.T);
    b.tx = b.to.x; b.ty = b.to.y;
    b.x = b.sx + (b.tx - b.sx) * k; b.y = b.sy + (b.ty - b.sy) * k; b.z = Math.sin(Math.PI * k) * b.h;
    if (k >= 1) { b.state = 'held'; b.holder = b.to; this.onPitchCaught(b.to); }
  }
  const car = this.carrier();
  // QB slide: give yourself up once past the line
  if (inp.sw && car && car === this.ctrl && car.role === 'QB' && pl.crossed && !pl.thrown) {
    inp.sw = false; this.flash('Slide'); this.play.slid = true; return this.endPlay('tackle');
  }
  const userQB = this.userOnOffense() && this.ctrl === O.QB;
  switch (op.type) {
    case 'option':
      if (!pl.decided && car === O.QB) {
        if (userQB && inp.actionEdge && this.t > 0.08) { inp.actionEdge = false; this.optKeep(); }
        else if (!userQB && this.t > 0.5) {
          const crash = this.readKey && (this.readKey.readMode === 'crash' || this.dist(this.readKey, O.RB) < 2.5);
          (crash ? chance(0.7 + O.QB.r.awr / 400) : chance(0.12)) ? this.optKeep() : this.optGive();
        } else if (this.t > 0.75) this.optGive();
      }
      break;
    case 'speedopt':
      if (!pl.pitched && car === O.QB) {
        const rk = this.readKey;
        if ((userQB && inp.actionEdge) || (!userQB && this.t > 0.45 && rk && this.dist(rk, O.QB) < 3.3 && O.RB.x > O.QB.x - 1.8)) {
          inp.actionEdge = false; pl.pitched = true; this.pitch(O.QB, O.RB);
        }
      }
      if (this.t > 0.25 && !pl.readSet) { pl.readSet = true; this.readAll(this.t, 'scramble'); }
      break;
    case 'rpo':
      if (!pl.decided && !pl.thrown && car === O.QB) {
        if (userQB) {
          if (inp.actionEdge) { inp.actionEdge = false; pl.decided = true; this.qbRunMode = true; this.flash('Keeper!'); this.readAll(this.t, 'scramble'); }
          else if (this.t > 0.8) this.optGive();
        } else if (this.t > 0.45) {
          const lb = this.readKey;
          const crashed = lb && (lb.x - this.los < 3.4 || lb.vx < -2.2);
          let best = null, bo = 0; for (const r of this.eligible) { const o = this.openness(r); if (o > bo) { bo = o; best = r; } }
          if (crashed && best && bo > 1.8) { pl.decided = true; this.throwBall(best); }
          else this.optGive();
        }
      }
      if (pl.thrown || pl.handoff) pl.decided = true;
      break;
    case 'qbrun':
      if (this.t > 0.25 + (op.delay || 0) && !pl.readSet) { pl.readSet = true; this.readAll(this.t, 'run'); }
      break;
    case 'trick':
      if (op.handTo && !pl.handoff && car === O.QB) {
        const tgt = O[op.handTo];
        if ((this.t > 0.25 && this.dist(O.QB, tgt) < 1.6) || this.t > 1.4) {
          b.holder = tgt; pl.handoff = true; this.readAll(this.t, 'run');
          if (op.flea) for (const d of this.ents) if (d.side === 'D' && (d.role.startsWith('CB') || d.role.startsWith('S')) && chance(0.25 + d.r.awr / 140)) d.read += 2.2; // smart DBs stay home
          if (this.userOnOffense()) this.ctrl = tgt;
        }
      }
      if (op.toss && !pl.tossed && this.t > 0.3 && car === O.QB) { pl.tossed = true; this.pitch(O.QB, O.RB); }
      if (op.flea && pl.handoff && !pl.pitched2 && car === O.RB && this.t > op.pitchBackAt) { pl.pitched2 = true; this.pitch(O.RB, O.QB); }
      if (op.lateralTo && !pl.lat && this.t > op.latAt && car === O.QB) { pl.lat = true; this.pitch(O.QB, O[op.lateralTo]); }
      break;
  }
};

const _liveStep = LG.liveStep;
LG.liveStep = function (dt) {
  this.scriptStep(dt);
  if (this.phase !== 'live') return;
  _liveStep.call(this, dt);
};

// ---------- AI hooks ----------
const _ai = LG.ai;
LG.ai = function (e, dt) {
  const pl = this.play, car = this.carrier(), op = this.offPlay, O = this.O;
  if (op.type === 'speedopt' && e === O.RB && car !== e && !pl.pitched && e.task.k === 'path') return this.aiPath(e, e.task, dt); // stay in pitch relationship
  if (e.readKey && !pl.decided && !pl.handoff && !pl.pitched && op.read) {
    if (e.readMode === 'crash') return this.steer(e, O.RB.x + 1, O.RB.y, 1, dt);
    const keepY = this.qbPts ? this.qbPts[1][1] : O.QB.y + 4;
    return this.steer(e, Math.max(this.los + 0.8, O.QB.x + 3), keepY, 0.55, dt);
  }
  if (car === e && e === this.passer && this.passReady && !pl.thrown && !pl.crossed && !this.qbScramble) {
    if (e.role === 'QB') {
      if (op.type === 'rpo' && !pl.decided) return this.steer(e, e.x - 0.4, e.y, 0.3, dt);
      if (!(op.type === 'rpo' && this.qbRunMode)) return this.aiQBmove(e, dt);
    } else {
      if (e.task.k === 'path' && e.task.i < e.task.pts.length) return this.aiPath(e, e.task, dt);
      return this.steer(e, e.x - 0.2, e.y, 0.25, dt);
    }
  }
  if (car === e && e.role === 'QB' && this.qbRunMode) {
    if (e.task.k === 'path' && e.task.i < e.task.pts.length && e.x < this.los + 0.5) return this.aiPath(e, e.task, dt);
    return this.aiCarrier(e, dt);
  }
  if (e === O.QB && car === e && !this.passReady && !this.qbRunMode && !pl.handoff && SCRIPT_TYPES.includes(op.type)) return this.steer(e, e.x - 0.3, e.y, 0.2, dt);
  if (e === O.QB && car !== e && e.task.k === 'fake') { const p = e.task.pts[Math.min(1, e.task.pts.length - 1)]; return this.steer(e, p[0], p[1], 0.8, dt); }
  if (e === O.QB && car !== e && op.flea && !pl.pitched2) return this.steer(e, this.los - 6, this.gs.ballY, 0.5, dt);
  if (e.task && e.task.k === 'hold' && car !== e) return this.steer(e, e.x, e.y, 0.2, dt);
  return _ai.call(this, e, dt);
};

LG.isRunPhase = function () {
  const pl = this.play, op = this.offPlay;
  if (!pl) return false;
  if (pl.caught || pl.scramble) return true;
  if (this.qbRunMode && !(op.type === 'rpo' && !pl.crossed)) return true;
  if (pl.handoff && !this.passReady && !op.fakeRun) return true;
  return false;
};
LG.canUserThrow = function () {
  const b = this.ball, pl = this.play;
  return this.phase === 'live' && this.userOnOffense() && b && b.state === 'held' && b.holder === this.passer && this.ctrl === this.passer && this.passReady && !pl.thrown && !pl.crossed;
};
LG.scriptHint = function () {
  if (this.phase !== 'live' || !this.userOnOffense()) return null;
  const op = this.offPlay, pl = this.play, car = this.carrier();
  if (op.type === 'option' && !pl.decided && car === this.O.QB) return { key: 'SPACE to keep it, or let it ride to hand off', touch: 'Tap KEEP to pull it, or let it ride', act: 'Keep' };
  if (op.type === 'speedopt' && !pl.pitched && car === this.O.QB) return { key: 'SPACE to pitch to the back', touch: 'Tap PITCH to toss it', act: 'Pitch' };
  if (op.type === 'rpo' && !pl.decided && car === this.O.QB) return { key: '1–5 to throw · SPACE to keep · or let it ride to hand off', touch: 'Tap a receiver, KEEP to run, or let it ride', act: 'Keep' };
  return null;
};

// "READ" tag over the key defender in the broadcast view
LG.drawScriptTags = function (ctx, P) {
  const e = this.readKey, pl = this.play;
  if (!e || (pl && (pl.decided || pl.handoff || pl.pitched)) || !['pre', 'live'].includes(this.phase)) return;
  const p = P(e.x, e.y, 2.8); if (!p) return;
  const w = Math.max(38, p.k * 1.6), h = Math.max(16, p.k * 0.6);
  ctx.fillStyle = 'rgba(255,90,78,.92)'; ctx.fillRect(p.x - w / 2, p.y - h, w, h);
  ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(h * 0.8)}px 'Saira Condensed', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('READ', p.x, p.y - h / 2 + 1);
};
