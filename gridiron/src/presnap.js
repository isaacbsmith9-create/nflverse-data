// ============================================================
// Gridiron Dynasty - pre-snap: receiver motion (shows man vs zone),
// goal line package, defensive adjustments (show blitz, press/off,
// line shift) and a pass-rush move for the user's defender.
// ============================================================
'use strict';

const LPS = LiveGame.prototype;

// ---------- goal line package ----------
FORMS.goalline = { QB: [-1.4, 0], RB: [-6.4, 0], WR1: [-1, -8.5], WR2: [-1, 8.5], WR3: [-1.3, -4.3], TE: [-1.3, 4.3] };
const GL_PLAYS = [
  { id: 'gldive', name: 'Goal Line Dive', type: 'run', cat: 'Goal Line', form: 'goalline', path: [[1.5, 0.4], [3, 1], [8, 1.2]], desc: 'Two tight ends, hit it straight ahead.' },
  { id: 'gltoss', name: 'Goal Line Toss', type: 'run', cat: 'Goal Line', form: 'goalline', toss: true, path: [[1.2, 3], [2.4, 6.5], [10, 8.5]], desc: 'Pitch it to the edge behind the tight ends.' },
  { id: 'glsneak', name: 'QB Sneak (heavy)', type: 'qbrun', cat: 'Goal Line', form: 'goalline', qbPath: [[1.2, 0], [5, 0]], routes: {}, desc: 'Under center, push the pile.' },
  { id: 'glpa', name: 'PA Tight End Flat', type: 'pass', cat: 'Goal Line', form: 'goalline', pa: true, routes: { TE: 'flat', WR3: 'drag', WR1: 'corner', WR2: 'slant', RB: 'block' }, desc: 'Sell the dive, the tight end leaks to the flat.' },
  { id: 'glfade', name: 'Goal Line Fade', type: 'pass', cat: 'Goal Line', form: 'goalline', quick: true, routes: { WR1: 'go', WR2: 'slant', WR3: 'flat', TE: 'block', RB: 'block' }, desc: 'Back-shoulder fade to your best receiver.' },
];
for (const p of GL_PLAYS) { OFF_PLAYS.push(p); if (p.type !== 'run' && p.type !== 'pass') NEW_PLAYS.push(p); }
DEF_PLAYS.push({ id: 'goalline', name: 'Goal Line D', desc: 'Everyone on the line. Stop the run at the 1.', a: { LB1: 'f', LB2: 'f', CB1: 'm:WR1', CB2: 'm:WR2', CB3: 'm:WR3', S1: 'm:TE', S2: 'f' } });

const _cpuDefCallPS = cpuDefCall;
cpuDefCall = function (gs) {
  if (gs.yard >= 95 && gs.togo <= 3 && chance(0.65)) return DEF_PLAYS.find(p => p.id === 'goalline');
  return _cpuDefCallPS(gs);
};
const _cpuOffCallPS = cpuOffCall;
cpuOffCall = function (gs) {
  if (gs.yard >= 96 && gs.togo <= 3 && chance(0.45)) return pick(GL_PLAYS);
  const p = _cpuOffCallPS(gs);
  return p && p.cat === 'Goal Line' && gs.yard < 90 ? OFF_PLAYS.find(x => x.id === 'dive') : p;
};

const _setupPS = LPS.setup;
LPS.setup = function () {
  _setupPS.call(this);
  this.motion = null; this.defAdj = { blitz: false, press: false, shift: 0 };
  if (this.defPlay && this.defPlay.id === 'goalline') {
    for (const e of this.ents) if (e.side === 'D' && !e.role.startsWith('DL') && e.task.k !== 'man') { e.x = this.los + (e.role.startsWith('S') ? 3.5 : 2.2); }
    for (const e of this.D.CB) e.x = this.los + 1.6;
  }
};

// ---------- motion ----------
LPS.canMotion = function () {
  if (this.phase !== 'pre' || !this.userOnOffense() || this.motion) return false;
  return !!this.motionMan();
};
LPS.motionMan = function () {
  const O = this.O, op = this.offPlay;
  if (op.form === 'wildcat' || op.directSnap) return null;
  for (const k of ['WR3', 'TE', 'WR2', 'WR1']) { const e = O[k]; if (e && e.task && (e.task.k === 'route' || e.task.k === 'block' || e.task.k === 'pblock')) return e; }
  return null;
};
LPS.startMotion = function () {
  if (!this.canMotion()) return false;
  const e = this.motionMan(), by = this.gs.ballY;
  // go across the formation to a mirrored spot (slot on the other side)
  const ty = clamp(by - (e.y - by) * 0.55, 3, FIELD_W - 3);
  this.motion = { e, ty, x: this.los - 1.6, t: 0 };
  const shadow = this.ents.find(d => d.side === 'D' && d.task && d.task.k === 'man' && d.task.tgt === e);
  this.motion.shadow = shadow || null;
  sfx && sfx('snap');
  return true;
};
LPS.stepMotion = function (dt) {
  const m = this.motion; if (!m || m.done) return;
  const e = m.e; m.t += dt;
  const dy = m.ty - e.y, sp = Math.min(e.maxV * 0.82, 8);
  if (Math.abs(dy) < 0.3) { e.vx = 0; e.vy = 0; m.done = true; }
  else { e.vy = Math.sign(dy) * sp; e.vx = (m.x - e.x) * 4; e.y += e.vy * dt; e.x += e.vx * dt; }
  // man defender travels with him; zone defenders just bump over
  if (m.shadow) { const d = m.shadow; d.y += (e.y + (e.y < this.gs.ballY ? 1 : -1) - d.y) * Math.min(1, dt * 5); }
  else for (const d of this.ents) if (d.side === 'D' && d.task && d.task.k === 'zone' && !d.task.deep) d.y += Math.sign(dy) * dt * 0.8;
  if (!m.told && m.t > 0.45) {
    m.told = true;
    this.h.toast && this.h.toast(m.shadow ? `MAN coverage — ${m.shadow.role.replace(/\d/, '')} #${m.shadow.p.num} followed him across` : 'ZONE coverage — nobody followed the motion');
  }
};
const _updatePS = LPS.update;
LPS.update = function (dt) {
  if (this.phase === 'pre' && this.motion) this.stepMotion(dt);
  return _updatePS.call(this, dt);
};
const _snapPS = LPS.snap;
LPS.snap = function () {
  const m = this.motion, wasPre = this.phase === 'pre';
  if (wasPre && m) {
    const e = m.e, by = this.gs.ballY;
    if (e.task && e.task.k === 'route') { e.task.pts = this.routePts(e.task.name, e.x, e.y, by); e.task.i = 0; }
    if (!m.done) e.jetBoost = 0.6; // snapped while moving: a running start
    if (m.shadow && m.shadow.task.k === 'man') m.shadow.x = this.los + 4;
  }
  if (wasPre) this.applyDefAdj();
  return _snapPS.call(this);
};

// ---------- defensive adjustments ----------
LPS.applyDefAdj = function () {
  const a = this.defAdj; if (!a || a.applied) return; a.applied = true;
  if (a.press) for (const c of this.D.CB) if (c.task.k === 'man') { const r = c.task.tgt; if (r && r.task.k === 'route' && chance(0.35 + (c.r.str + c.r.cov - r.r.str - r.r.rte) / 220)) { r.stun = 0.28 + Math.random() * 0.2; r.jammed = true; } }
};
LPS.defAdjust = function (kind) {
  if (this.phase !== 'pre' || !this.userOnDefense()) return;
  const a = this.defAdj, los = this.los;
  if (kind === 'blitz') {
    a.blitz = !a.blitz;
    for (const s of this.D.S) if (s.task.k !== 'man' || a.blitz) s.x = a.blitz ? los + 6.5 : los + 13;
    this.h.toast && this.h.toast(a.blitz ? 'Showing blitz: safeties walked down. They still play their call.' : 'Safeties back deep.');
  } else if (kind === 'press') {
    a.press = !a.press;
    for (const c of this.D.CB) c.x = a.press ? los + 1.2 : los + 6.5;
    this.h.toast && this.h.toast(a.press ? 'Press coverage: jam them at the line (risky vs speed).' : 'Off coverage: corners play soft.');
  } else if (kind === 'left' || kind === 'right') {
    const s = kind === 'left' ? -1 : 1; if (Math.abs(a.shift + s) > 2) return; a.shift += s;
    for (const d of this.D.DL) d.y = clamp(d.y + s * 0.9, 2, FIELD_W - 2);
    for (const d of this.D.LB) d.y = clamp(d.y + s * 0.6, 2, FIELD_W - 2);
    this.assignBlocks();
    this.h.toast && this.h.toast(`Line shifted ${a.shift < 0 ? 'left' : a.shift > 0 ? 'right' : 'back to normal'}.`);
  }
};

// ---------- pass rush move ----------
const _liveStepPS = LPS.liveStep;
LPS.liveStep = function (dt) {
  const c = this.ctrl, inp = this.input;
  if (c && c.side === 'D' && c.eng && inp.actionEdge && this.userOnDefense()) {
    inp.actionEdge = false;
    if ((c.moveCd || 0) <= this.t) {
      c.moveCd = this.t + 1.1;
      const bl = c.eng, pass = !this.isRunPhase();
      const p = clamp(0.32 + ((pass ? c.r.prs : c.r.str) - bl.r.rbk) / 140 + (c.r.agi - 70) / 400, 0.1, 0.75);
      if (chance(p)) {
        bl.eng = null; c.eng = null; c.freeT = 1.2; bl.stun = 0.45;
        const dx = (this.carrier() || this.O.QB).x - c.x; c.vx += Math.sign(dx) * 2;
        this.h.toast && this.h.toast(pick(['Swim move — he\'s through!', 'Spin move — free!', 'Rip move — beat him!', 'Bull rush — walked him back!']), 1200);
      } else this.h.toast && this.h.toast('Rush move stopped. Try again in a second.', 1000);
    }
  }
  // a running start for a receiver snapped in motion
  for (const e of this.ents) if (e.jetBoost > 0) { e.jetBoost -= dt; e.vx += dt * 6; }
  return _liveStepPS.call(this, dt);
};
