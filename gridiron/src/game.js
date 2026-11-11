// ============================================================
// Gridiron Dynasty - live on-field engine (playable games)
// World units = yards. Offense always attacks to the right (+x).
// x: 0..120 (end zones 0-10 & 110-120), y: 0..53.33
// ============================================================
'use strict';

const FIELD_W = 53.333, HASH_L = 23.58, HASH_R = 29.75, MID_Y = FIELD_W / 2;

// ---------- formations (dx behind LOS negative, dy relative to ball) ----------
const FORMS = {
  gun:    { QB: [-5, 0], RB: [-5, 2.2], WR1: [-1, -19], WR2: [-1, 18.5], WR3: [-1.6, -10], TE: [-1.3, 4.3] },
  single: { QB: [-1.4, 0], RB: [-6.8, 0], WR1: [-1, -19], WR2: [-1, 18.5], WR3: [-1.6, -10], TE: [-1.3, 4.3] },
  trips:  { QB: [-5, 0], RB: [-5, -2.2], WR1: [-1, -19], WR2: [-1, 18.5], WR3: [-1.6, 12], TE: [-1.3, 4.3] },
};
const OL_DY = [-3.2, -1.6, 0, 1.6, 3.2];

// route steps: [dx, dyIn, flag]; dyIn > 0 = toward the middle of the field
const ROUTES = {
  go: [[42, 0]], seam: [[40, 0.5]],
  slant: [[2, 0], [12, 9]],
  curl: [[12, 0], [-2, 1.5, 's']],
  hitch: [[6, 0], [-1, 0, 's']],
  out: [[10, 0], [0.5, -14]],
  post: [[11, 0], [26, 10]],
  corner: [[11, 0], [20, -12]],
  dig: [[12, 0], [0.5, 18]],
  flat: [[1, -2.5], [3, -12]],
  drag: [[3, 0], [2, 24]],
  wheel: [[0.5, -5], [3, -3], [32, 0]],
  screen: [[-2.5, -3.5, 's']],
  comeback: [[15, 0], [-3, -3, 's']],
};

const OFF_PLAYS = [
  { id: 'dive', name: 'HB Dive', type: 'run', form: 'single', path: [[1.5, 0], [4, 1.2], [10, 1.6]], desc: 'Power run through the A-gap.' },
  { id: 'toss', name: 'HB Toss', type: 'run', form: 'single', path: [[1.2, 3], [3, 7.5], [20, 8.5]], toss: true, desc: 'Pitch outside right — get the edge.' },
  { id: 'counter', name: 'Counter', type: 'run', form: 'gun', path: [[0, 2], [2, -3], [4, -6], [20, -7]], desc: 'Fake right, cut back left.' },
  { id: 'draw', name: 'HB Draw', type: 'run', form: 'gun', path: [[0, -0.5], [0.3, -2], [9, -1.5]], delay: 0.7, desc: 'Sell the pass, run late.' },
  { id: 'slants', name: 'Slants', type: 'pass', form: 'gun', routes: { WR1: 'slant', WR2: 'slant', WR3: 'slant', TE: 'hitch', RB: 'flat' }, desc: 'Quick timing throws inside.' },
  { id: 'curlflat', name: 'Curl Flat', type: 'pass', form: 'gun', routes: { WR1: 'curl', WR2: 'curl', WR3: 'flat', TE: 'seam', RB: 'block' }, desc: 'Beats zone underneath.' },
  { id: 'outs', name: 'Quick Outs', type: 'pass', form: 'trips', routes: { WR1: 'out', WR2: 'hitch', WR3: 'out', TE: 'flat', RB: 'block' }, desc: 'Sideline throws, stops the clock.' },
  { id: 'mesh', name: 'Mesh', type: 'pass', form: 'gun', routes: { WR1: 'drag', WR2: 'drag', WR3: 'corner', TE: 'dig', RB: 'flat' }, desc: 'Crossers rub off man coverage.' },
  { id: 'postcorner', name: 'Post Corner', type: 'pass', form: 'gun', routes: { WR1: 'post', WR2: 'corner', WR3: 'out', TE: 'dig', RB: 'block' }, desc: 'Intermediate & deep shots.' },
  { id: 'verts', name: 'Four Verts', type: 'pass', form: 'gun', routes: { WR1: 'go', WR2: 'go', WR3: 'seam', TE: 'seam', RB: 'flat' }, desc: 'Stretch the defense deep.' },
  { id: 'pa', name: 'PA Shot', type: 'pass', form: 'single', pa: true, routes: { WR1: 'post', WR2: 'comeback', WR3: 'dig', TE: 'corner', RB: 'block' }, desc: 'Play-action, hold LBs, go deep.' },
  { id: 'screen', name: 'HB Screen', type: 'pass', form: 'gun', routes: { WR1: 'go', WR2: 'go', WR3: 'curl', TE: 'block', RB: 'screen' }, screen: true, desc: 'Let the rush come, dump it off.' },
  { id: 'hail', name: 'Hail Mary', type: 'pass', form: 'trips', routes: { WR1: 'go', WR2: 'go', WR3: 'go', TE: 'seam', RB: 'block' }, desc: 'Everybody deep. Pray.' },
];

// zone spots [dx from LOS, dy from ball]
const ZONES = {
  deepL: [17, -12, 1], deepR: [17, 12, 1], deepM: [19, 0, 1],
  d3L: [15, -17, 1], d3M: [18, 0, 1], d3R: [15, 17, 1],
  d4a: [15, -18, 1], d4b: [15, -6, 1], d4c: [15, 6, 1], d4d: [15, 18, 1],
  flatL: [4, -17, 0], flatR: [4, 17, 0], hookL: [7, -6, 0], hookR: [7, 6, 0], hookM: [7, 0, 0],
  curlL: [9, -13, 0], curlR: [9, 13, 0],
};
// defense roles: DL1-4, LB1-2, CB1(on WR1) CB2(on WR2) CB3(on WR3), S1(left) S2(right)
const DEF_PLAYS = [
  { id: 'c2', name: 'Cover 2', desc: 'Two deep safeties, corners sit in the flats.', a: { LB1: 'z:hookL', LB2: 'z:hookR', CB1: 'z:flatL', CB2: 'z:flatR', CB3: 'z:curlL', S1: 'z:deepL', S2: 'z:deepR' } },
  { id: 'c3', name: 'Cover 3', desc: 'Three deep, four under. Solid vs everything.', a: { LB1: 'z:hookL', LB2: 'z:hookR', CB1: 'z:d3L', CB2: 'z:d3R', CB3: 'z:flatL', S1: 'z:d3M', S2: 'z:curlR' } },
  { id: 'c4', name: 'Cover 4', desc: 'Quarters: take away the deep ball.', a: { LB1: 'z:hookL', LB2: 'z:hookR', CB1: 'z:d4a', CB2: 'z:d4d', CB3: 'z:flatL', S1: 'z:d4b', S2: 'z:d4c' } },
  { id: 'c1', name: 'Cover 1 Man', desc: 'Man-to-man with a deep safety help.', a: { LB1: 'm:TE', LB2: 'm:RB', CB1: 'm:WR1', CB2: 'm:WR2', CB3: 'm:WR3', S1: 'z:deepM', S2: 'z:hookM' } },
  { id: 'blitz', name: 'Cover 0 Blitz', desc: 'Send 6. Win fast or get burned.', a: { LB1: 'b', LB2: 'b', CB1: 'm:WR1', CB2: 'm:WR2', CB3: 'm:WR3', S1: 'm:TE', S2: 'm:RB' } },
  { id: 'cblitz', name: 'Corner Blitz', desc: 'Slot corner off the edge, Cover 3 behind.', a: { LB1: 'z:hookL', LB2: 'z:hookR', CB1: 'z:d3L', CB2: 'z:d3R', CB3: 'b', S1: 'z:d3M', S2: 'z:flatR' } },
  { id: 'runstop', name: 'Run Stop', desc: 'Load the box, crash the run lanes.', a: { LB1: 'f', LB2: 'f', CB1: 'm:WR1', CB2: 'm:WR2', CB3: 'm:WR3', S1: 'z:deepM', S2: 'f' } },
  { id: 'prevent', name: 'Prevent', desc: 'Rush 3, everybody deep. Protect a lead.', a: { DL4: 'z:hookM', LB1: 'z:curlL', LB2: 'z:curlR', CB1: 'z:d4a', CB2: 'z:d4d', CB3: 'z:d4b', S1: 'z:deepM', S2: 'z:d4c' } },
];
const SPECIAL_PLAYS = [
  { id: 'punt', name: 'Punt', type: 'special', desc: 'Flip field position.' },
  { id: 'fg', name: 'Field Goal', type: 'special', desc: 'Kick it through.' },
  { id: 'kneel', name: 'QB Kneel', type: 'special', desc: 'Burn the clock.' },
];

const DIFF_BONUS = { rookie: -8, pro: 0, allpro: 4, legend: 8 };

function cpuOffCall(gs) {
  const trail = gs.score[gs.poss] < gs.score[1 - gs.poss];
  let passP = gs.togo >= 8 ? 0.72 : gs.togo <= 2 ? 0.3 : 0.55;
  if (gs.down === 3 && gs.togo >= 4) passP = 0.9;
  if (gs.quarter >= 4 && gs.clock < 300) passP = trail ? 0.85 : 0.2;
  if (trail && gs.clock < 10 && (gs.quarter === 2 || gs.quarter >= 4) && 100 - gs.yard > 35) return OFF_PLAYS.find(p => p.id === 'hail');
  const wantPass = chance(passP);
  const pool = OFF_PLAYS.filter(p => (wantPass ? p.type === 'pass' : p.type === 'run') && p.id !== 'hail' && p.cat !== 'Trick');
  return pick(pool.length ? pool : OFF_PLAYS);
}
function cpuDefCall(gs) {
  const w = { c2: 3, c3: 4, c4: 2, c1: 3, blitz: 1, cblitz: 1.5, runstop: 1, prevent: 0 };
  if (gs.togo <= 2) { w.runstop = 5; w.blitz = 2; w.c1 = 3; }
  if (gs.togo >= 10) { w.c4 += 2; w.c2 += 1; }
  const lead = gs.score[1 - gs.poss] - gs.score[gs.poss];
  if (gs.quarter >= 4 && gs.clock < 120 && lead > 0 && lead <= 8) { w.prevent = 5; w.blitz = 0; }
  const id = weighted(Object.keys(w), k => w[k]);
  return DEF_PLAYS.find(p => p.id === id);
}

// ============================================================
class LiveGame {
  constructor(L, gs, userSide, hooks) {
    this.L = L; this.gs = gs; this.user = userSide; this.h = hooks || {};
    this.phase = 'idle'; this.ents = []; this.ball = null; this.cam = { x: 35, y: MID_Y };
    this.input = { mx: 0, my: 0, sprint: false, action: false, actionEdge: false, sw: false, throwTo: null, throwAway: false };
    this.banner = null; this.t = 0; this.effects = [];
    gs.ballY = MID_Y;
    this.diff = DIFF_BONUS[gs.diff] || 0;
  }
  teamOf(side) { return this.L.teams[this.gs.tids[side]]; }
  userOnOffense() { return this.user === this.gs.poss; }
  userOnDefense() { return this.user >= 0 && this.user !== this.gs.poss; }

  // ---------- flow ----------
  next() {
    const gs = this.gs;
    this.ents = []; this.ball = null; this.phase = 'call';
    if (gs.over) { this.phase = 'over'; this.h.over && this.h.over(); return; }
    const off = gs.poss;
    if (this.user < 0) { this.choose(null); return; }
    if (off !== this.user) {
      if (this.L.settings.simDef) {
        const before = gs.score.slice(); const q = gs.quarter;
        simDrive(gs);
        const pts = gs.score[off] - before[off], pts2 = gs.score[1 - off] - before[1 - off];
        const txt = pts >= 6 ? `${this.teamOf(off).abbr} drive ends in a TOUCHDOWN.` : pts === 3 ? `${this.teamOf(off).abbr} kicks a field goal.` :
          pts2 > 0 ? `Defensive score!` : `Defense gets the stop!`;
        this.h.toast && this.h.toast('CPU drive simulated — ' + txt);
        this.h.update && this.h.update();
        setTimeout(() => this.next(), 60);
        return;
      }
      const dec = cpuDecision(gs);
      if (dec !== 'go') { this.choose(null); return; }
      this.h.call && this.h.call('def');
    } else {
      this.h.call && this.h.call('off');
    }
  }

  // userPlayId: chosen by the user for their side (offense or defense)
  choose(userPlayId) {
    const gs = this.gs; const userOff = this.userOnOffense();
    let offPlay, defPlay;
    if (userOff) offPlay = OFF_PLAYS.concat(SPECIAL_PLAYS).find(p => p.id === userPlayId);
    else {
      const dec = cpuDecision(gs);
      offPlay = dec === 'go' ? cpuOffCall(gs) : SPECIAL_PLAYS.find(p => p.id === dec);
    }
    if (this.userOnDefense()) defPlay = DEF_PLAYS.find(p => p.id === userPlayId) || cpuDefCall(gs);
    else defPlay = cpuDefCall(gs);
    if (!offPlay) offPlay = cpuOffCall(gs);

    if (offPlay.type === 'special') return this.special(offPlay.id);
    this.offPlay = offPlay; this.defPlay = defPlay;
    this.setup();
    this.phase = 'pre'; this.preT = 0;
    this.h.update && this.h.update();
  }

  special(id) {
    const gs = this.gs, side = gs.poss;
    const abbr = this.teamOf(side).abbr;
    if (id === 'punt') { doPunt(gs); this.result(`${abbr} punts.`, gs.log[gs.log.length - 1]?.txt); return; }
    if (id === 'kneel') {
      st(gs, gs.lu[side].QB[0], 'ra'); st(gs, gs.lu[side].QB[0], 'ry', -1);
      applyPlay(gs, { yards: -1, elapsed: 2 }); this.result('QB kneels.', ''); return;
    }
    if (id === 'fg') {
      const k = gs.lu[side].K[0]; const dist = 100 - gs.yard + 17;
      if (side === this.user) {
        this.phase = 'kick'; this.kick = { t: 0, dist, p: fgProb(k, dist), pos: 0, done: false, speed: 1.6 + dist / 30 };
        this.kick.win = 0.06 + this.kick.p * 0.3;
        this.h.update && this.h.update();
        return;
      }
      const made = doFieldGoal(gs);
      this.result(made ? `${dist}-yd FIELD GOAL IS GOOD!` : `${dist}-yd field goal NO GOOD`, '', made);
    }
  }
  kickPress() {
    if (this.phase !== 'kick' || this.kick.done) return;
    const k = this.kick; k.done = true;
    const made = Math.abs(k.pos) <= k.win;
    doFieldGoal(this.gs, made);
    setTimeout(() => this.result(made ? `${k.dist}-yd FIELD GOAL IS GOOD!` : `${k.dist}-yd field goal ${k.pos < 0 ? 'wide left' : 'wide right'}`, '', made), 500);
  }

  result(title, sub, big) {
    this.phase = 'post'; this.postT = 0;
    this.banner = { title, sub: sub || '', big: !!big, t: 0 };
    this.h.update && this.h.update();
    this.h.result && this.h.result(this.banner);
  }

  // ---------- play setup ----------
  mkEnt(p, side, role, x, y) {
    const cpu = (side === 'O' ? this.gs.poss : 1 - this.gs.poss) !== this.user;
    const b = cpu && this.user >= 0 ? this.diff : 0;
    const r = {}; for (const k in p.r) r[k] = clamp(p.r[k] + b, 10, 105);
    const e = {
      p, r, side, role, x, y, vx: 0, vy: 0, maxV: 3.6 + r.spd * 0.06, acc: 9 + r.agi * 0.07,
      task: null, eng: null, stun: 0, tcd: 0, read: Infinity, react: 0.1 + (100 - r.awr) / 230, freeT: 0,
      juke: 0, jcd: 0, dive: 0, swat: 0, mem: null, memT: 0,
    };
    if (role.startsWith('WR') || role === 'TE' || role === 'RB') e.acc += r.rte * 0.03;
    this.ents.push(e); return e;
  }

  setup() {
    const gs = this.gs, op = this.offPlay, dp = this.defPlay;
    this.ents = []; this.t = 0; this.effects = []; this.tackler = null; this.qbScramble = false;
    const los = 10 + gs.yard, by = gs.ballY;
    this.los = los; this.firstX = Math.min(110, los + gs.togo);
    const lo = gs.lu[gs.poss], ld = gs.lu[1 - gs.poss];
    const F = FORMS[op.form];
    const fy = dy => clamp(by + dy, 1.5, FIELD_W - 1.5);
    const O = this.O = {}, D = this.D = {};
    O.QB = this.mkEnt(lo.QB[0], 'O', 'QB', los + F.QB[0], fy(F.QB[1]));
    O.RB = this.mkEnt(lo.RB[0], 'O', 'RB', los + F.RB[0], fy(F.RB[1]));
    O.WR1 = this.mkEnt(lo.WR[0], 'O', 'WR1', los + F.WR1[0], fy(F.WR1[1]));
    O.WR2 = this.mkEnt(lo.WR[1], 'O', 'WR2', los + F.WR2[0], fy(F.WR2[1]));
    O.WR3 = this.mkEnt(lo.WR[2], 'O', 'WR3', los + F.WR3[0], fy(F.WR3[1]));
    O.TE = this.mkEnt(lo.TE[0], 'O', 'TE', los + F.TE[0], fy(F.TE[1]));
    O.OL = OL_DY.map((dy, i) => this.mkEnt(lo.OL[i], 'O', 'OL' + (i + 1), los - 0.8, fy(dy)));
    // routes / tasks
    for (const k of ['WR1', 'WR2', 'WR3', 'TE', 'RB']) {
      const e = O[k];
      if (op.type === 'run') {
        if (k === 'RB') e.task = { k: 'path', pts: op.path.map(([dx, dy]) => null), raw: op.path, i: 0 };
        else e.task = { k: 'block' };
      } else {
        const rt = op.routes[k];
        if (!rt || rt === 'block') e.task = { k: k === 'RB' || k === 'TE' ? 'pblock' : 'block' };
        else e.task = { k: 'route', name: rt, pts: this.routePts(rt, e.x, e.y, by), i: 0, stop: false };
      }
    }
    if (op.type === 'run') { // compute path points from RB start
      let x = O.RB.x, y = O.RB.y; const pts = [];
      for (const [dx, dy] of op.path) { x += dx; y += dy; pts.push([x, clamp(y, 1, FIELD_W - 1)]); }
      O.RB.task = { k: 'path', pts, i: 0, delay: op.delay || 0 };
    }
    for (const e of O.OL) e.task = { k: op.type === 'run' ? 'rblock' : 'pblock' };
    O.QB.task = { k: 'qb' };
    this.eligible = op.type === 'pass' ? ['WR1', 'WR2', 'WR3', 'TE', 'RB'].filter(k => O[k].task.k === 'route').map(k => O[k]) : [];

    // defense
    D.DL = [-4.4, -1.5, 1.5, 4.4].map((dy, i) => this.mkEnt(ld.DL[i], 'D', 'DL' + (i + 1), los + 1.1, fy(dy)));
    D.LB = [-3.5, 3.5].map((dy, i) => this.mkEnt(ld.LB[i], 'D', 'LB' + (i + 1), los + 5, fy(dy)));
    D.CB = [O.WR1, O.WR2, O.WR3].map((w, i) => this.mkEnt(ld.CB[i], 'D', 'CB' + (i + 1), los + (i === 2 ? 4.5 : 5.5), w.y + (w.y < by ? 1 : -1)));
    D.S = [-9, 9].map((dy, i) => this.mkEnt(ld.S[i], 'D', 'S' + (i + 1), los + 13, fy(dy)));
    const droles = { DL1: D.DL[0], DL2: D.DL[1], DL3: D.DL[2], DL4: D.DL[3], LB1: D.LB[0], LB2: D.LB[1], CB1: D.CB[0], CB2: D.CB[1], CB3: D.CB[2], S1: D.S[0], S2: D.S[1] };
    this.droles = droles;
    for (const role in droles) {
      const e = droles[role]; const a = dp.a[role] || 'r';
      if (a === 'r') e.task = { k: 'rush', lane: e.y - by };
      else if (a === 'b') e.task = { k: 'rush', lane: (e.y - by) * 0.5, blitz: true };
      else if (a === 'f') e.task = { k: 'fill' };
      else if (a.startsWith('m:')) e.task = { k: 'man', tgt: O[a.slice(2)] };
      else if (a.startsWith('z:')) { const z = ZONES[a.slice(2)]; e.task = { k: 'zone', x: los + z[0], y: clamp(by + z[1], 3, FIELD_W - 3), deep: !!z[2] }; }
    }
    // run stop: bring the box in tight
    if (dp.id === 'runstop') { D.S[1].x = los + 6; D.S[1].y = by + 2; D.LB.forEach(l => l.x = los + 3.8); }
    if (dp.id === 'blitz' || dp.id === 'cblitz') for (const e of this.ents) if (e.side === 'D' && e.task.k === 'rush' && e.task.blitz) e.x = los + 3;
    // pass-pro: assign each OL to nearest rusher by y order
    this.assignBlocks();

    this.passer = O.QB; this.passReady = op.type === 'pass'; this.passReadyAt = null; this.runBlocking = op.type === 'run';
    this.ball = { state: 'held', holder: O.QB, x: los, y: by, z: 0 };
    O.QB.hasBallVisual = true;
    // user control
    this.ctrl = null;
    if (this.userOnOffense()) this.ctrl = op.type === 'run' ? O.RB : O.QB;
    else if (this.userOnDefense()) this.ctrl = this.lastDefCtrlRole && droles[this.lastDefCtrlRole] ? droles[this.lastDefCtrlRole] : D.LB[0];
    this.play = { thrown: false, caught: false, handoff: false, crossed: false, int: false, target: null, airYds: 0, rusher: null, result: null, sackable: true, scramble: false };
    this.cam.x = los + 6; this.cam.y = clamp(by, 0, FIELD_W);
  }

  routePts(name, sx, sy, by) {
    const steps = ROUTES[name]; let inDir = Math.sign(by - sy) || (sy <= by ? 1 : -1);
    if (Math.abs(by - sy) < 0.5) inDir = -1; // backfield: break to the left by default
    if (name === 'flat' || name === 'wheel' || name === 'screen') { if (Math.abs(by - sy) < 3) inDir = sy < by ? 1 : -1; }
    const pts = []; let x = sx, y = sy;
    for (const [dx, dy, f] of steps) { x += dx; y = clamp(y + dy * inDir, 1, FIELD_W - 1); pts.push([x, y, f]); }
    return pts;
  }

  assignBlocks() {
    const O = this.O, rushers = this.ents.filter(e => e.side === 'D' && e.task.k === 'rush').sort((a, b) => a.y - b.y);
    const ol = O.OL.slice().sort((a, b) => a.y - b.y);
    const used = new Set();
    for (const b of ol) {
      let best = null, bd = 1e9;
      for (const r of rushers) { if (used.has(r)) continue; const d = Math.abs(r.y - b.y) + Math.abs(r.x - b.x) * 0.5; if (d < bd) { bd = d; best = r; } }
      if (best) { used.add(best); b.task.assign = best; }
    }
  }

  snap() {
    if (this.phase !== 'pre') return;
    this.phase = 'live'; this.t = 0;
    sfx('snap');
  }

  // ---------- helpers ----------
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  carrier() { return this.ball && this.ball.state === 'held' ? this.ball.holder : null; }
  opp(e) { return this.ents.filter(o => o.side !== e.side); }
  steer(e, tx, ty, mul, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    let sp = e.maxV * mul;
    if (d < 1.2) sp *= d / 1.2;
    const dvx = (d > 0.05 ? dx / d * sp : 0) - e.vx, dvy = (d > 0.05 ? dy / d * sp : 0) - e.vy;
    const dv = Math.hypot(dvx, dvy), lim = e.acc * dt;
    const f = dv > lim ? lim / dv : 1;
    e.vx += dvx * f; e.vy += dvy * f;
  }
  steerDir(e, ux, uy, mul, dt) { this.steer(e, e.x + ux * 4, e.y + uy * 4, mul, dt); }

  // ---------- main update ----------
  update(dt) {
    this.t2 = (this.t2 || 0) + dt;
    if (this.phase === 'kick') { const k = this.kick; if (!k.done) { k.t += dt; k.pos = Math.sin(k.t * k.speed * 2.2); } if (this.input.actionEdge) this.kickPress(); this.input.actionEdge = false; return; }
    if (this.phase === 'post') {
      this.postT += dt; if (this.banner) this.banner.t += dt;
      if (this.postT > (this.banner && this.banner.big ? 2.4 : 1.6) || (this.input.actionEdge && this.postT > 0.4)) { this.input.actionEdge = false; this.banner = null; this.next(); }
      this.input.actionEdge = false; this.updateCam(dt); return;
    }
    if (this.phase === 'pre') {
      this.preT += dt;
      if (this.input.sw && this.userOnDefense()) { this.input.sw = false; this.cycleDefender(); }
      if (this.userOnOffense()) { if (this.input.actionEdge) this.snap(); }
      else if (this.preT > (this.user < 0 ? 0 : 1.6)) this.snap();
      this.input.actionEdge = false;
      this.updateCam(dt); return;
    }
    if (this.phase !== 'live') return;
    this.t += dt;
    this.liveStep(dt);
    this.input.actionEdge = false; this.input.throwTo = null; this.input.throwAway = false; this.input.sw = false;
    this.updateCam(dt);
  }

  updateCam(dt) {
    let fx = this.ball ? this.ball.x : this.cam.x, fy = this.ball ? this.ball.y : this.cam.y;
    if (this.phase === 'pre' || (this.phase === 'live' && !this.play.thrown && !this.play.caught && this.carrier() === this.passer && this.passReady && !this.play.crossed)) fx = this.los + 9;
    const k = 1 - Math.exp(-dt * 4);
    this.cam.x += (fx - this.cam.x) * k; this.cam.y += (fy - this.cam.y) * k;
  }

  cycleDefender() {
    const defs = this.ents.filter(e => e.side === (this.userOnDefense() ? 'D' : 'O'));
    const ref = this.ball || { x: this.los, y: this.gs.ballY };
    if (this.phase === 'pre') { // cycle in role order
      const order = ['LB1', 'LB2', 'S1', 'S2', 'CB1', 'CB2', 'CB3', 'DL1', 'DL2', 'DL3', 'DL4'];
      const i = order.indexOf(this.ctrl ? this.ctrl.role : 'DL4');
      this.ctrl = this.droles[order[(i + 1) % order.length]]; this.lastDefCtrlRole = this.ctrl.role; return;
    }
    const cands = defs.filter(e => e !== this.ctrl).sort((a, b) => this.dist(a, ref) - this.dist(b, ref));
    if (cands[0]) this.ctrl = cands[0];
  }

  liveStep(dt) {
    const gs = this.gs, O = this.O, b = this.ball, pl = this.play, inp = this.input;
    const car = this.carrier();
    // ---- user special inputs ----
    if (this.ctrl) {
      const c = this.ctrl;
      if (inp.sw) this.cycleDefender();
      if (car === c && c === this.passer && this.passReady && !pl.thrown && !pl.crossed) {
        if (inp.throwTo) this.throwBall(inp.throwTo);
        else if (inp.throwAway) this.throwAway();
      } else if (inp.actionEdge && car === c) {
        if (c.jcd <= 0) { c.juke = 0.38; c.jcd = 1.1; const px = -c.vy, py = c.vx, pm = Math.hypot(px, py) || 1; const sgn = inp.my !== 0 ? Math.sign(inp.my * (py / pm || 1)) : (chance(0.5) ? 1 : -1); c.vx += px / pm * 4.2 * sgn; c.vy += py / pm * 4.2 * sgn; sfx('juke'); }
      } else if (inp.actionEdge && c.side !== (car ? car.side : 'O')) {
        if (b.state === 'air') c.swat = 0.45; else if (c.stun <= 0) { c.dive = 0.35; c.stun = 0; }
      }
    }
    // ---- handoff / QB logic ----
    if (!pl.handoff && this.offPlay.type === 'run' && b.holder === O.QB) {
      const rb = O.RB;
      if ((this.offPlay.toss && this.t > 0.3) || (this.t > 0.25 && this.dist(O.QB, rb) < 1.4) || this.t > 1.6) {
        b.holder = rb; pl.handoff = true; pl.rusher = rb; this.readAll(this.t, 'run');
        if (this.userOnOffense()) this.ctrl = rb;
      }
    }
    if (b.state === 'held' && b.holder === this.passer && !pl.thrown && this.passReady) {
      if (!pl.crossed && this.passer.x > this.los + 0.3) { pl.crossed = true; pl.scramble = true; this.readAll(this.t, 'scramble'); }
      if (this.passer !== this.ctrl) this.aiQB(dt);
    }
    if (this.offPlay.pa && this.t > 0.55 && this.t < 0.6 && !pl.paRead) { pl.paRead = true; for (const e of this.D.LB) e.paFreeze = 0.6; }

    // ---- movement ----
    for (const e of this.ents) {
      e.stun = Math.max(0, e.stun - dt); e.tcd = Math.max(0, e.tcd - dt); e.juke = Math.max(0, e.juke - dt); e.jcd = Math.max(0, e.jcd - dt);
      e.dive = Math.max(0, e.dive - dt); e.swat = Math.max(0, e.swat - dt); e.freeT = Math.max(0, e.freeT - dt); e.paFreeze = Math.max(0, (e.paFreeze || 0) - dt);
      if (e.eng) continue;
      if (e.stun > 0) { e.vx *= 0.85; e.vy *= 0.85; continue; }
      const userMove = e === this.ctrl && (Math.abs(inp.mx) + Math.abs(inp.my) > 0.15);
      if (userMove) {
        const m = Math.hypot(inp.mx, inp.my); const mul = (inp.sprint ? (this.carrier() === e ? 0.97 : 1.0) : 0.86) * Math.min(1, m);
        this.steerDir(e, inp.mx / m, inp.my / m, mul, dt);
        if (e.dive > 0) { e.vx *= 1.04; e.vy *= 1.04; }
      } else this.ai(e, dt);
    }
    this.blocking(dt);
    for (const e of this.ents) {
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.x = clamp(e.x, -2, 122); e.y = clamp(e.y, -3, FIELD_W + 3);
    }
    this.separate();
    // ---- ball ----
    if (b.state === 'held') { b.x = b.holder.x + 0.35; b.y = b.holder.y + 0.25; b.z = 0; }
    else if (b.state === 'air') {
      b.t += dt; const k = Math.min(1, b.t / b.T);
      b.x = b.sx + (b.tx - b.sx) * k; b.y = b.sy + (b.ty - b.sy) * k; b.z = Math.sin(Math.PI * k) * b.h;
      if (k >= 1) this.resolvePass();
    }
    if (this.phase !== 'live') return;
    // ---- whistle checks ----
    const c = this.carrier();
    if (c) {
      if (c.x > this.los + 0.3 && c.side === 'O') pl.crossed = true;
      if (c.y < 0 || c.y > FIELD_W) return this.endPlay('oob');
      if (c.side === 'O' && c.x >= 110) return this.endPlay('td');
      if (c.side === 'D' && c.x <= 10) return this.endPlay('td');
      if (c.x < -0.5 || c.x > 120.5) return this.endPlay('oob');
      this.tackles(c);
    }
    if (this.t > 18) this.endPlay('tackle');
  }

  readAll(t, why) {
    for (const e of this.ents) if (e.side === 'D') {
      let r = e.react;
      if (why === 'run' && e.task && e.task.k === 'man' && e.task.tgt && e.task.tgt.task.k === 'route') r += 0.5;
      if (why === 'run' && (this.offPlay.type === 'pass' || this.offPlay.delay)) r += 0.35; // screen/draw fools them a bit
      e.read = Math.min(e.read, t + r);
    }
  }

  // ---------- AI ----------
  ai(e, dt) {
    const pl = this.play, b = this.ball, car = this.carrier(), O = this.O;
    // ball carrier
    if (car === e) {
      if (e.role === 'QB' && !pl.handoff && !pl.crossed && !this.qbScramble && !pl.int) return this.aiQBmove(e, dt);
      if (e.task && e.task.k === 'path' && e.task.i < e.task.pts.length && !(e.x > this.los + 0.5 && e.task.i >= e.task.pts.length - 1)) return this.aiPath(e, e.task, dt);
      return this.aiCarrier(e, dt);
    }
    if (e.side === 'O' && !pl.int) {
      if (this.isRunPhase() && e !== this.passer) {
        if (e.task.k === 'catch' && b.state === 'air') return this.steer(e, e.task.x, e.task.y, 1, dt);
        return this.aiEscort(e, dt);
      }
      const tk = e.task;
      switch (tk.k) {
        case 'qb': return this.aiQBmove(e, dt);
        case 'route': return this.aiRoute(e, tk, dt);
        case 'catch': return this.steer(e, tk.x, tk.y, 1, dt);
        case 'path': return this.aiPath(e, tk, dt);
        case 'pblock': return this.aiPassBlock(e, dt);
        case 'rblock': case 'block': return this.aiRunBlock(e, dt);
      }
      return;
    }
    if (pl.int && e.side === 'O') { // offense now tackling the interceptor
      return this.aiPursue(e, car, dt);
    }
    if (pl.int && e.side === 'D') return this.aiEscort(e, dt);
    // defense
    if (e.paFreeze > 0) { this.steer(e, e.x - 0.5, e.y, 0.4, dt); return; }
    if (b.state === 'air') {
      if (e.ballChase && this.t >= e.ballChase) return this.steer(e, b.tx, b.ty, 1, dt);
    }
    if (car && (this.t >= e.read || (car !== O.QB && (pl.caught || pl.handoff) && this.t >= e.read))) return this.aiPursue(e, car, dt);
    const tk = e.task;
    switch (tk.k) {
      case 'rush': return this.steer(e, (car || O.QB).x, (car || O.QB).y + tk.lane * clamp(this.dist(e, O.QB) / 12, 0, 0.6), 1, dt);
      case 'fill': return this.steer(e, this.los + 2, O.RB.y, 0.9, dt);
      case 'man': return this.aiMan(e, tk.tgt, dt);
      case 'zone': return this.aiZone(e, tk, dt);
    }
  }

  aiQBmove(e, dt) {
    const pl = this.play, op = this.offPlay;
    if (op.type === 'run') { // meet RB / carry out fake
      if (!pl.handoff) return this.steer(e, this.los - 2.2, this.gs.ballY + (op.toss ? 1 : 0), 0.7, dt);
      return this.steer(e, e.x - 2, e.y - 3, 0.5, dt);
    }
    if (pl.thrown) return this.steer(e, e.x, e.y, 0.3, dt);
    const dropX = this.los - (op.form === 'single' ? 7 : 6.5);
    let ty = this.gs.ballY;
    // feel pressure: slide away from the nearest free rusher
    const rush = this.ents.filter(d => d.side === 'D' && !d.eng).sort((a, b) => this.dist(a, e) - this.dist(b, e))[0];
    if (rush && this.dist(rush, e) < 3.5 && this.t > 0.8) { ty = e.y + (e.y - rush.y > 0 ? 3 : -3); return this.steer(e, dropX + 1.5, ty, 0.7, dt); }
    this.steer(e, dropX, ty, this.t < 1 ? 0.7 : 0.2, dt);
  }

  aiRoute(e, tk, dt) {
    if (this.offPlay.screen && e.role === (this.offPlay.screenTo || 'RB') && this.t < (this.offPlay.screenTo ? 0.4 : 1.0)) return this.offPlay.screenTo ? this.steer(e, e.x, e.y, 0.2, dt) : this.aiPassBlock(e, dt);
    if (this.t < (this.offPlay.pa && e.role !== 'WR1' && e.role !== 'WR2' ? 0.4 : 0)) return;
    if (tk.i >= tk.pts.length) {
      const last = tk.pts[tk.pts.length - 1];
      if (last[2] === 's') { // settle in space, drift away from nearest defender
        const d = this.nearest(e, 'D'); let tx = last[0], ty = last[1];
        if (d && this.dist(d, e) < 3) ty += (e.y - d.y) > 0 ? 1.2 : -1.2;
        return this.steer(e, tx, ty, 0.5, dt);
      }
      const prev = tk.pts.length > 1 ? tk.pts[tk.pts.length - 2] : [e.x - 1, e.y];
      let dx = last[0] - prev[0], dy = last[1] - prev[1]; const m = Math.hypot(dx, dy) || 1;
      let tx = e.x + dx / m * 5, ty = e.y + dy / m * 5;
      if (ty < 1.5 || ty > FIELD_W - 1.5) { ty = clamp(ty, 1.5, FIELD_W - 1.5); tx = e.x + 4; }
      if (tx > 118) tx = 118;
      return this.steer(e, tx, ty, 0.97, dt);
    }
    const p = tk.pts[tk.i];
    if (Math.hypot(p[0] - e.x, p[1] - e.y) < 0.9) { tk.i++; e.cutT = this.t; }
    this.steer(e, p[0], p[1], 0.97, dt);
  }

  aiPath(e, tk, dt) {
    if (this.t < (tk.delay || 0)) return this.steer(e, e.x, e.y, 0.2, dt);
    if (tk.i >= tk.pts.length) return this.aiCarrier(e, dt);
    const p = tk.pts[tk.i];
    if (Math.hypot(p[0] - e.x, p[1] - e.y) < 1.2) tk.i++;
    this.steer(e, p[0], p[1], 0.95, dt);
  }

  nearest(e, side, filt) {
    let best = null, bd = 1e9;
    for (const o of this.ents) if (o.side === side && o !== e && (!filt || filt(o))) { const d = this.dist(o, e); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  aiPassBlock(e, dt) {
    const qb = this.O.QB;
    let tgt = e.task.assign;
    if (!tgt || tgt.eng || this.dist(tgt, qb) > 9 || tgt.freeT > 0) {
      tgt = this.nearest(e, 'D', d => !d.eng && d.freeT <= 0 && d.x < this.los + 6 && this.dist(d, qb) < 9);
    }
    if (!tgt) return this.steer(e, (e.role.startsWith('OL') ? this.los - 1.5 : qb.x + 1.5), e.role.startsWith('OL') ? e.y : qb.y + (e.y > qb.y ? 1.8 : -1.8), 0.5, dt);
    // stand between rusher and QB
    const dx = qb.x - tgt.x, dy = qb.y - tgt.y, m = Math.hypot(dx, dy) || 1;
    this.steer(e, tgt.x + dx / m * 1.0, tgt.y + dy / m * 1.0, 0.9, dt);
  }

  aiRunBlock(e, dt) {
    const car = this.carrier() || this.O.RB;
    let tgt = e.task.assign && !e.task.assign.eng ? e.task.assign : null;
    if (!tgt || tgt.unblocked || this.dist(tgt, e) > 7) tgt = this.nearest(e, 'D', d => !d.eng && !d.unblocked && d.freeT <= 0 && d.x > e.x - 2);
    if (!tgt || this.dist(tgt, e) > 9) return this.steer(e, e.x + 3, e.y, 0.6, dt);
    const dx = tgt.x - car.x, dy = tgt.y - car.y, m = Math.hypot(dx, dy) || 1;
    this.steer(e, tgt.x - dx / m * 0.9, tgt.y - dy / m * 0.9, 0.95, dt);
  }

  aiEscort(e, dt) {
    const car = this.carrier();
    if (!car) { const b = this.ball; return this.steer(e, b.tx ?? b.x, b.ty ?? b.y, 0.6, dt); }
    const dir = car.side === 'O' ? 1 : -1;
    const foe = car.side === 'O' ? 'D' : 'O';
    const tgt = this.nearest(car, foe, d => !d.eng && (d.x - car.x) * dir > -1 && this.dist(d, car) < 9 && this.dist(d, e) < 8);
    if (tgt && e.role !== 'QB') {
      const dx = tgt.x - car.x, dy = tgt.y - car.y, m = Math.hypot(dx, dy) || 1;
      return this.steer(e, tgt.x - dx / m * 0.8, tgt.y - dy / m * 0.8, 0.95, dt);
    }
    this.steer(e, car.x + dir * 4, car.y + (e.y - car.y) * 0.6, e.role === 'QB' ? 0.4 : 0.8, dt);
  }

  aiPursue(e, c, dt) {
    if (!c) return;
    const d = this.dist(e, c);
    // solve for an intercept point using carrier velocity
    const cs = Math.hypot(c.vx, c.vy); let t = d / Math.max(1, e.maxV);
    for (let i = 0; i < 3; i++) { const px = c.x + c.vx * t, py = c.y + c.vy * t; t = Math.hypot(px - e.x, py - e.y) / Math.max(1, e.maxV); }
    t = clamp(t, 0, 1.6);
    const dir = c.side === 'O' ? 1 : -1;
    this.steer(e, c.x + c.vx * t + dir * Math.min(1.0, d * 0.08), c.y + c.vy * t, d < 3 ? 1.0 : 1.04, dt);
  }

  aiMan(e, r, dt) {
    if (!r) return;
    // reaction lag: remember receiver velocity, refresh every react interval
    const lag = clamp(0.42 - e.r.cov * 0.0034, 0.06, 0.35);
    if (!e.mem || this.t - e.memT > lag) { e.mem = { vx: r.vx, vy: r.vy }; e.memT = this.t; }
    if (r.task.k === 'block' || r.task.k === 'pblock') { // read run / help
      return this.steer(e, r.x + 2, r.y, 0.6, dt);
    }
    const cushion = clamp(1.7 - (this.t * 0.8), 0.4, 1.7);
    const tx = r.x + e.mem.vx * 0.55 + cushion, ty = r.y + e.mem.vy * 0.55;
    this.steer(e, tx, ty, 1, dt);
  }

  aiZone(e, z, dt) {
    let tx = z.x, ty = z.y; const R = z.deep ? 11 : 7.5;
    let threat = null, ts = -1e9;
    for (const r of this.eligible) {
      const d = Math.hypot(r.x - z.x, r.y - z.y);
      if (d > R) continue;
      const s = (z.deep ? r.x : -d);
      if (s > ts) { ts = s; threat = r; }
    }
    if (threat) {
      const k = z.deep ? 0.78 : 0.82;
      tx = z.x + (threat.x + (z.deep ? 2.5 : 0.8) - z.x) * k; ty = z.y + (threat.y - z.y) * k;
      if (z.deep && threat.x + 2 > tx) tx = threat.x + 2; // never let them get behind
    } else if (!z.deep) { ty += (this.O.QB.y - ty) * 0.15; }
    this.steer(e, tx, ty, threat ? 1 : 0.8, dt);
  }

  aiCarrier(e, dt) {
    const dir = e.side === 'O' ? 1 : -1, foe = e.side === 'O' ? 'D' : 'O';
    let best = null, bs = -1e9;
    for (let a = -80; a <= 80; a += 16) {
      const ang = a * Math.PI / 180, ux = Math.cos(ang) * dir, uy = Math.sin(ang);
      let s = Math.cos(ang) * 3;
      const px = e.x + ux * 4, py = e.y + uy * 4;
      if (py < 2 || py > FIELD_W - 2) s -= 6;
      for (const d of this.ents) {
        if (d.side !== foe) continue;
        const dd = Math.hypot(d.x - px, d.y - py);
        const w = d.eng ? 0.45 : d.stun > 0 ? 0.3 : 1.2;
        if (dd < 7) s -= (7 - dd) * w;
      }
      if (s > bs) { bs = s; best = [ux, uy]; }
    }
    this.steerDir(e, best[0], best[1], 0.93, dt);
  }

  // CPU quarterback reads
  aiQB(dt) {
    const pl = this.play, qb = this.passer, op = this.offPlay;
    if (pl.thrown || pl.crossed || this.qbScramble) return;
    let drop = (op.form === 'single' ? 1.3 : 0.95) + (op.pa ? 0.5 : 0) + (op.screen && !op.screenTo ? 0.6 : 0);
    if (this.passReadyAt != null) drop = this.passReadyAt + (op.quick ? 0.15 : 0.45);
    if (this.t < drop) return;
    pl.readT = (pl.readT || 0) + dt;
    if (pl.readT < 0.15) return; pl.readT = 0;
    const press = this.ents.some(d => d.side === 'D' && !d.eng && this.dist(d, qb) < 2.4);
    const elapsed = this.t - drop;
    let best = null, bs = -1e9;
    for (const r of this.eligible) {
      const op_ = this.openness(r);
      const down = r.x - this.los;
      const need = this.gs.down >= 3 ? (down >= this.gs.togo ? 2 : -2) : 0;
      const s = Math.min(op_, 6) * 0.9 + Math.min(down, 28) * 0.22 + need + (op.screen && r.role === (op.screenTo || 'RB') ? 6 : 0) + (op.hooklat && r.role === 'WR1' ? 5 : 0) + gauss(0, (100 - qb.r.awr) / 40) - (this.t - (r.cutT || 0) < 0.2 ? 1 : 0);
      if (s > bs) { bs = s; best = r; }
      r._open = op_;
    }
    if (elapsed < 0.25) return;
    const thresh = 3.3 - elapsed * 0.75;
    if (best && (best._open > thresh || (press && best._open > 1.4))) return this.throwBall(best);
    if (press && elapsed > 1.2 && chance(0.35)) {
      if (qb.r.spd >= 78 && chance(0.5)) { this.qbScramble = true; return; }
      return this.throwAway();
    }
    if (elapsed > 3.4) return best && best._open > 1 ? this.throwBall(best) : this.throwAway();
  }
  openness(r) {
    let m = 99; const px = r.x + r.vx * 0.5, py = r.y + r.vy * 0.5;
    for (const d of this.ents) if (d.side === 'D') m = Math.min(m, Math.hypot(d.x - px, d.y - py));
    return m;
  }

  throwBall(r) {
    const pl = this.play, qb = this.passer, b = this.ball;
    if (pl.thrown || b.holder !== qb || !this.passReady) return;
    if (!this.eligible.includes(r)) return;
    const lob = qb === this.ctrl && this.input.sprint;
    const bs = (17 + qb.r.thp * 0.11) * (lob ? 0.7 : 1);
    let ax = r.x, ay = r.y, T = 0;
    for (let i = 0; i < 4; i++) { const d = Math.hypot(ax - qb.x, ay - qb.y); T = d / bs + 0.12; ax = r.x + r.vx * T; ay = r.y + r.vy * T; }
    const dist = Math.hypot(ax - qb.x, ay - qb.y);
    const pressure = this.ents.some(d => d.side === 'D' && !d.eng && this.dist(d, qb) < 2.2) ? 1 : 0;
    const qbSpd = Math.hypot(qb.vx, qb.vy);
    const err = (1 - qb.r.tha / 105) * 2.3 * (0.4 + dist / 22) * (1 + pressure * 0.9 + qbSpd / 7 * 0.7);
    ax += gauss(0, err * 0.7); ay += gauss(0, err * 0.7);
    if (qb === this.ctrl && Math.abs(this.input.mx) + Math.abs(this.input.my) > 0.3) { ax += clamp(this.input.mx, -1, 1) * 2.8; ay += clamp(this.input.my, -1, 1) * 2.8; } // lead with the stick
    b.state = 'air'; b.holder = null; b.sx = qb.x; b.sy = qb.y; b.tx = ax; b.ty = ay; b.t = 0; b.T = Math.hypot(ax - qb.x, ay - qb.y) / bs + 0.12; b.h = lob ? Math.min(14, 3 + dist * 0.32) : Math.min(7, dist * 0.13); b.lob = lob;
    pl.thrown = true; pl.target = r; pl.throwX = this.los; pl.tThrow = this.t; pl.passerEnt = qb;
    r.task = { k: 'catch', x: ax, y: ay };
    st(this.gs, qb.p, 'pa'); st(this.gs, r.p, 'tgt');
    sfx('throw');
    // defenders break on the ball
    for (const d of this.ents) if (d.side === 'D' && !d.eng) {
      const dd = Math.hypot(d.x - ax, d.y - ay);
      if (dd < d.maxV * (b.T + 0.2) + 2) d.ballChase = this.t + d.react * 0.9 + (d.task.k === 'man' && d.task.tgt === r ? 0 : 0.12);
    }
  }
  throwAway() {
    const pl = this.play, qb = this.passer, b = this.ball; if (pl.thrown || b.holder !== qb) return; pl.passerEnt = qb;
    const side = qb.y < MID_Y ? -4 : FIELD_W + 4;
    b.state = 'air'; b.holder = null; b.sx = qb.x; b.sy = qb.y; b.tx = qb.x + 8; b.ty = side; b.t = 0; b.T = 0.9; b.h = 4;
    pl.thrown = true; pl.target = null; pl.throwAway = true; st(this.gs, qb.p, 'pa');
  }

  resolvePass() {
    const b = this.ball, pl = this.play, r = pl.target, gs = this.gs;
    if (!r) return this.endPlay('inc', 'Thrown away');
    const rd = Math.hypot(r.x - b.tx, r.y - b.ty);
    let d = null, dd = 1e9;
    for (const e of this.ents) if (e.side === 'D') { const x = Math.hypot(e.x - b.tx, e.y - b.ty); if (x < dd) { dd = x; d = e; } }
    const reach = 1.3 + r.r.cat / 220;
    const dReach = (1.15 + d.r.cov / 260 + (d.swat > 0 ? 0.7 : 0)) * (b.lob ? 0.7 : 1); // lobs float over underneath defenders
    const oob = b.ty < 0 || b.ty > FIELD_W || b.tx > 120;
    const canC = rd <= reach && !oob, canD = dd <= dReach;
    let out = 'inc';
    if (canC && canD) {
      const pInt = (d.r.cov / 100) * 0.045 + (d.r.cat / 100) * 0.03 + (dd < rd ? 0.04 : 0) + (d.swat > 0 ? 0.12 : 0);
      const pDef = 0.33 + (d.r.cov - r.r.cat) / 250 + (d.swat > 0 ? 0.15 : 0);
      const x = Math.random();
      if (x < pInt) out = 'int'; else if (x < pInt + pDef) out = 'pbu'; else out = chance(r.r.cat / 100 * 0.95) ? 'catch' : 'inc';
    } else if (canC) out = chance(0.7 + r.r.cat / 330 - (rd > reach * 0.8 ? 0.12 : 0)) ? 'catch' : 'inc';
    else if (canD) out = chance(0.035 + d.r.cat / 1500 + (d.swat > 0 ? 0.2 : 0)) ? 'int' : 'pbu';
    if (out === 'catch') {
      b.state = 'held'; b.holder = r; pl.caught = true; pl.airYds = r.x - this.los; r.task = { k: 'carry' }; r.vx *= 0.7; r.vy *= 0.7;
      if (this.userOnOffense()) this.ctrl = r;
      for (const e of this.ents) if (e.side === 'D') e.read = Math.min(e.read, this.t + e.react * 0.6);
      sfx('catch');
      this.flash(r.p.scrub ? 'Catch!' : `${pshort(r.p)} catch`);
    } else if (out === 'int') {
      b.state = 'held'; b.holder = d; pl.int = true; pl.intBy = d;
      for (const e of this.ents) e.eng = null;
      if (this.userOnDefense()) this.ctrl = d; else if (this.userOnOffense()) this.ctrl = this.nearest(d, 'O');
      st(gs, (pl.passerEnt || this.O.QB).p, 'pint'); st(gs, d.p, 'dint');
      sfx('int'); this.flash('INTERCEPTED!');
    } else {
      if (out === 'pbu') st(gs, d.p, 'pd');
      return this.endPlay('inc', out === 'pbu' ? `Broken up by ${pshort(d.p)}` : (oob ? 'Out of bounds' : 'Incomplete'));
    }
  }

  blocking(dt) {
    const pl = this.play;
    if (pl.int) return;
    const car = this.carrier();
    // create engagements
    for (const bl of this.ents) {
      if (bl.side !== 'O' || bl.eng || bl === car || bl.stun > 0) continue;
      const k = bl.task && bl.task.k;
      const blocking = k === 'pblock' || k === 'rblock' || k === 'block' || (this.isRunPhase() && bl !== this.passer && bl !== this.O.QB && k !== 'catch');
      if (!blocking) continue;
      for (const d of this.ents) {
        if (d.side !== 'D' || d.eng || d.freeT > 0 || d === car || d.stun > 0 || (d.unblocked && !pl.decided)) continue;
        if (k === 'pblock' && !(d.task.k === 'rush' || d.x < this.los + 3)) continue;
        if (this.dist(bl, d) < 1.15) { bl.eng = d; d.eng = bl; bl.engT = 0; break; }
      }
    }
    // resolve engagements
    for (const bl of this.ents) {
      if (bl.side !== 'O' || !bl.eng) continue;
      const d = bl.eng; bl.engT += dt;
      const tgt = car || this.ball;
      const runish = pl.handoff || pl.caught || pl.scramble || this.runBlocking;
      const dPow = runish ? (d.r.str * 0.5 + d.r.tkl * 0.3 + d.r.prs * 0.2) : (d.r.prs * 0.7 + d.r.str * 0.3);
      const bPow = bl.r.rbk * 0.7 + bl.r.str * 0.3;
      const edge = dPow - bPow;
      // move pair
      let dx = tgt.x - d.x, dy = tgt.y - d.y; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
      let push = clamp(0.9 + edge * 0.05, 0.15, 2.4);
      if (runish) push = clamp(0.25 + edge * 0.035, 0, 1.5);
      const driveBack = runish ? clamp(0.7 - edge * 0.03, 0, 1.6) : 0;
      d.vx = dx * push + driveBack; d.vy = dy * push * 0.8;
      bl.x = d.x - dx * 0.95; bl.y = d.y - dy * 0.95; bl.vx = d.vx; bl.vy = d.vy;
      // shed
      bl.shedT = (bl.shedT || 0) + dt;
      if (bl.shedT > 0.25) {
        bl.shedT = 0;
        let p = runish ? clamp(0.018 + edge * 0.0025, 0.005, 0.08) : clamp(0.035 + edge * 0.0035, 0.008, 0.14);
        if (runish && car && this.dist(d, car) < 2.2) p += 0.04;
        if (!runish && d.task.blitz) p += 0.03;
        if (chance(p)) { d.eng = null; bl.eng = null; d.freeT = 0.9; bl.stun = 0.3; d.vx = dx * 2; d.vy = dy * 2; }
      }
      // carrier ran away from this block — release
      if (runish && car && this.dist(d, car) > 9 && bl.engT > 1.5) { d.eng = null; bl.eng = null; d.freeT = 0.3; }
    }
  }

  separate() {
    const es = this.ents;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j]; if (a.eng === b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0.0001 && d < 0.85) {
        const push = (0.85 - d) / 2, ux = dx / d, uy = dy / d;
        const wa = a.eng ? 0.2 : 1, wb = b.eng ? 0.2 : 1;
        a.x -= ux * push * wa; a.y -= uy * push * wa; b.x += ux * push * wb; b.y += uy * push * wb;
      }
    }
  }

  tackles(c) {
    for (const d of this.ents) {
      if (d.side === c.side || d.stun > 0 || d.tcd > 0) continue;
      const dd = this.dist(d, c);
      const cpuDive = d !== this.ctrl && dd > 1.15 && dd < 2.0 && d.dive <= 0;
      if (cpuDive) { if (chance(0.06)) d.dive = 0.3; else continue; }
      const R = d.dive > 0 ? 2.0 : 1.15;
      if (dd > R) continue;
      if (d.eng && (dd > 0.95 || !chance(0.12))) { d.tcd = 0.4; continue; }
      // designed runs by QBs/WRs: elusiveness comes from speed and agility, not just break-tackle
      const btk = (!this.play.caught && c.role !== 'RB') ? Math.max(c.r.btk, c.r.agi * 0.5 + c.r.spd * 0.42) : c.r.btk;
      let p = 0.73 + (d.r.tkl - btk) / 110;
      if (c.juke > 0) p -= 0.22 + c.r.agi / 450;
      if (c === this.passer && this.passReady && !this.play.crossed && !this.play.thrown) p += 0.22; // sack, not designed runs
      if (d.dive > 0) p += 0.08;
      const behind = (c.side === 'O' ? d.x < c.x : d.x > c.x);
      if (behind) p -= 0.12;
      const sp = Math.hypot(c.vx, c.vy); p -= Math.max(0, sp - 7) * 0.025;
      p = clamp(p, 0.12, 0.95);
      this.tAtt = (this.tAtt || 0) + 1;
      if (chance(p)) { this.tackler = d; return this.endPlay('tackle'); }
      this.tMiss = (this.tMiss || 0) + 1;
      d.tcd = 0.7; d.stun = d.dive > 0 ? 0.9 : 0.45; d.dive = 0;
      c.vx *= 0.55; c.vy *= 0.55;
      if (c.juke > 0) this.flash('Juked!');
      else if (chance(0.5)) this.flash('Broken tackle!');
    }
  }

  flash(txt) { this.effects.push({ txt, t: 0, x: this.ball.x, y: this.ball.y }); }

  // ---------- end of play ----------
  endPlay(kind, msg) {
    if (this.phase !== 'live') return;
    sfx('whistle');
    const gs = this.gs, pl = this.play, c = this.carrier(), los = this.los, off = gs.poss; const QBp = (pl.passerEnt || this.O.QB).p;
    if (!c && kind !== 'inc') kind = 'inc';
    const elapsed = Math.max(3, Math.min(this.t, 14));
    const abbr = this.teamOf(off).abbr;
    let title = '', sub = '', big = false;
    if (kind === 'inc') {
      title = pl.throwAway ? 'Thrown away' : 'Incomplete';
      sub = msg && msg !== title ? msg : '';
      logp(gs, `${pshort(QBp)} pass ${pl.throwAway ? 'thrown away' : 'incomplete' + (pl.target ? ' to ' + pshort(pl.target.p) : '')}.`);
      applyPlay(gs, { yards: 0, inc: true, elapsed });
      return this.result(title, sub);
    }
    if (pl.int) {
      const x = c ? c.x : this.ball.x;
      const td = kind === 'td' || x <= 10;
      logp(gs, `${pshort(QBp)} INTERCEPTED by ${pshort(pl.intBy.p)}${td ? ' — PICK SIX!' : ''}`, true);
      if (this.tackler) st(gs, this.tackler.p, 'tk');
      applyPlay(gs, { turnover: { yard: Math.round(110 - x), td }, elapsed });
      return this.result(td ? 'PICK SIX!' : 'INTERCEPTION!', `${pshort(pl.intBy.p)} picks it off`, true);
    }
    let spot = c.x;
    if (kind === 'td') spot = 110;
    let yards = Math.round(spot - los);
    if (gs.yard + yards >= 100) yards = 100 - gs.yard;
    const rusher = pl.caught ? null : c;
    if (c === this.passer && this.passReady && !pl.thrown && !pl.crossed && yards <= 0) {
      // sack
      if (this.tackler) { st(gs, this.tackler.p, 'sk'); st(gs, this.tackler.p, 'tk'); }
      st(gs, c.p, 'sacked');
      logp(gs, `${pshort(c.p)} sacked${this.tackler ? ' by ' + pshort(this.tackler.p) : ''} for ${-yards}.`);
      title = 'SACKED!'; sub = `Loss of ${-yards}`;
    } else if (pl.caught) {
      const r = c; st(gs, QBp, 'pc'); st(gs, QBp, 'py', yards); st(gs, r.p, 'rec'); st(gs, r.p, 'rcy', yards);
      if (kind === 'td') { st(gs, QBp, 'ptd'); st(gs, r.p, 'rctd'); }
      logp(gs, `${pshort(QBp)} pass to ${pshort(r.p)} for ${yards}${kind === 'td' ? ' — TOUCHDOWN!' : ''}.`, kind === 'td');
      title = kind === 'td' ? 'TOUCHDOWN!' : `Pass complete, ${yards >= 0 ? '+' : ''}${yards}`; sub = `${pshort(QBp)} to ${pshort(r.p)}`;
    } else {
      st(gs, rusher.p, 'ra'); st(gs, rusher.p, 'ry', yards); if (kind === 'td') st(gs, rusher.p, 'rtd');
      logp(gs, `${pshort(rusher.p)} run for ${yards}${kind === 'td' ? ' — TOUCHDOWN!' : ''}.`, kind === 'td');
      title = kind === 'td' ? 'TOUCHDOWN!' : `${yards >= 0 ? 'Gain of ' + yards : 'Loss of ' + -yards}`; sub = `${pshort(rusher.p)} ${c.role === 'QB' ? 'scramble' : 'run'}`;
    }
    if (this.tackler && kind === 'tackle' && !(title === 'SACKED!')) st(gs, this.tackler.p, 'tk');
    if (kind === 'oob') sub += ' — out of bounds';
    big = kind === 'td';
    const prevDown = gs.down, prevTogo = gs.togo;
    gs.ballY = clamp(c.y, HASH_L, HASH_R);
    applyPlay(gs, { yards, oob: kind === 'oob', elapsed });
    if (big) { sfx('td'); title = `TOUCHDOWN ${abbr}!`; }
    else if (gs.poss === off && yards >= prevTogo) sub += ' — FIRST DOWN';
    else if (gs.poss !== off && prevDown === 4 && yards > -50) title = 'Turnover on downs';
    if (gs.poss !== off || big) gs.ballY = MID_Y;
    this.result(title, sub, big);
  }

  // ============================================================
  // rendering
  // ============================================================
  render(ctx, W, H) {
    const scale = Math.max(Math.min(W / 56, H / 47), Math.min(13, W / 34));
    this.scale = scale;
    const viewH = H / scale, viewW = W / scale;
    let cy = this.cam.y;
    if (viewH >= FIELD_W + 6) cy = MID_Y; else cy = clamp(cy, viewH / 2 - 3, FIELD_W - viewH / 2 + 3);
    const cx = clamp(this.cam.x, viewW / 2 - 6, 120 - viewW / 2 + 6);
    this.view = { cx, cy, scale, W, H };
    const sx = x => (x - cx) * scale + W / 2, sy = y => (y - cy) * scale + H / 2;
    this.sx = sx; this.sy = sy;
    ctx.fillStyle = '#1d5e2a'; ctx.fillRect(0, 0, W, H);
    // stripes
    for (let x = 10; x < 110; x += 5) {
      ctx.fillStyle = ((x - 10) / 5) % 2 ? '#2f7d3a' : '#2b7536';
      ctx.fillRect(sx(x), sy(0), 5 * scale + 1, FIELD_W * scale);
    }
    // end zones
    const offT = this.teamOf(this.gs.poss), defT = this.teamOf(1 - this.gs.poss);
    ctx.fillStyle = offT.c1; ctx.fillRect(sx(0), sy(0), 10 * scale, FIELD_W * scale);
    ctx.fillStyle = defT.c1; ctx.fillRect(sx(110), sy(0), 10 * scale, FIELD_W * scale);
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `bold ${Math.round(scale * 4.2)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(sx(5), sy(MID_Y)); ctx.rotate(-Math.PI / 2); ctx.fillText(offT.name.toUpperCase(), 0, 0); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `bold ${Math.round(scale * 4.2)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(sx(115), sy(MID_Y)); ctx.rotate(Math.PI / 2); ctx.fillText(defT.name.toUpperCase(), 0, 0); ctx.restore();
    // lines
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, scale * 0.12);
    ctx.strokeRect(sx(0), sy(0), 120 * scale, FIELD_W * scale);
    for (let x = 10; x <= 110; x += 5) { ctx.beginPath(); ctx.moveTo(sx(x), sy(0)); ctx.lineTo(sx(x), sy(FIELD_W)); ctx.stroke(); }
    ctx.lineWidth = Math.max(1, scale * 0.08);
    for (let x = 11; x < 110; x++) {
      if (x % 5 === 0) continue;
      for (const hy of [0.4, HASH_L, HASH_R, FIELD_W - 0.4]) { ctx.beginPath(); ctx.moveTo(sx(x), sy(hy - 0.35)); ctx.lineTo(sx(x), sy(hy + 0.35)); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `bold ${Math.round(scale * 2)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let x = 20; x <= 100; x += 10) {
      const n = x <= 60 ? x - 10 : 110 - x;
      ctx.fillText(String(n), sx(x), sy(9)); ctx.fillText(String(n), sx(x), sy(FIELD_W - 9));
    }
    // LOS + first down
    if (this.phase === 'pre' || this.phase === 'live' || this.phase === 'call' || this.phase === 'kick') {
      const los = 10 + this.gs.yard;
      ctx.lineWidth = Math.max(2, scale * 0.25);
      ctx.strokeStyle = 'rgba(80,160,255,.9)'; ctx.beginPath(); ctx.moveTo(sx(this.los || los), sy(0)); ctx.lineTo(sx(this.los || los), sy(FIELD_W)); ctx.stroke();
      const fd = this.firstX || Math.min(110, los + this.gs.togo);
      if (fd < 110) { ctx.strokeStyle = 'rgba(255,220,0,.9)'; ctx.beginPath(); ctx.moveTo(sx(fd), sy(0)); ctx.lineTo(sx(fd), sy(FIELD_W)); ctx.stroke(); }
    }
    // route art pre-snap
    const showArt = this.userOnOffense() && (this.phase === 'pre' || (this.phase === 'live' && this.t < 0.8));
    if (showArt && this.O) {
      ctx.lineWidth = Math.max(1.5, scale * 0.18); ctx.setLineDash([scale * 0.6, scale * 0.4]);
      for (const k of ['WR1', 'WR2', 'WR3', 'TE', 'RB']) {
        const e = this.O[k]; const tk = e.task;
        const pts = tk.k === 'route' || tk.k === 'path' ? tk.pts : null; if (!pts) continue;
        ctx.strokeStyle = tk.k === 'path' ? 'rgba(255,255,255,.8)' : RCOL[this.eligible.indexOf(e)] || '#fff';
        ctx.beginPath(); ctx.moveTo(sx(e.x), sy(e.y)); for (const p of pts) ctx.lineTo(sx(p[0]), sy(p[1])); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // players
    const homeSide = 0;
    const rad = 0.72 * scale;
    for (const e of this.ents) {
      const sideIdx = e.side === 'O' ? this.gs.poss : 1 - this.gs.poss;
      const t = this.teamOf(sideIdx);
      const X = sx(e.x), Y = sy(e.y);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(X + rad * 0.25, Y + rad * 0.35, rad, rad * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      if (e === this.ctrl) {
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = Math.max(2, scale * 0.22);
        ctx.beginPath(); ctx.arc(X, Y, rad * 1.55, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = sideIdx === homeSide ? t.c1 : '#f4f4f4';
      ctx.strokeStyle = sideIdx === homeSide ? t.c2 : t.c1;
      ctx.lineWidth = Math.max(2, scale * 0.2);
      ctx.beginPath(); ctx.arc(X, Y, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = sideIdx === homeSide ? '#fff' : t.c1;
      ctx.font = `bold ${Math.max(8, Math.round(rad * 1.05))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(e.p.num), X, Y + 0.5);
      if (e.stun > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(X, Y, rad, 0, Math.PI * 2); ctx.fill(); }
    }
    // receiver icons
    if (this.canUserThrow()) {
      this.eligible.forEach((e, i) => {
        const X = sx(e.x), Y = sy(e.y) - rad * 2.2;
        ctx.fillStyle = RCOL[i]; ctx.beginPath(); ctx.arc(X, Y, rad * 0.95, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = `bold ${Math.max(9, Math.round(rad * 1.2))}px system-ui`; ctx.fillText(String(i + 1), X, Y + 0.5);
      });
    }
    // ball
    if (this.ball) {
      const b = this.ball; const X = sx(b.x), Y = sy(b.y);
      if (b.state === 'air') { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(X, Y, scale * 0.35, scale * 0.22, 0, 0, Math.PI * 2); ctx.fill(); }
      const bz = b.z * scale * 0.6;
      const sc = 1 + b.z * 0.08;
      ctx.fillStyle = '#8b4a1c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(X, Y - bz, scale * 0.42 * sc, scale * 0.26 * sc, b.state === 'air' ? Math.atan2(b.ty - b.sy, b.tx - b.sx) : 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // effects
    for (const f of this.effects) {
      f.t += 1 / 60; if (f.t > 1.2) continue;
      ctx.globalAlpha = 1 - f.t / 1.2; ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(scale * 1.6)}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText(f.txt, sx(f.x), sy(f.y) - scale * 2 - f.t * scale * 2); ctx.globalAlpha = 1;
    }
    this.effects = this.effects.filter(f => f.t <= 1.2);
    // kick meter
    if (this.phase === 'kick') this.renderKick(ctx, W, H);
  }

  renderKick(ctx, W, H) {
    const k = this.kick; const bw = Math.min(W * 0.7, 520), bh = 26, x0 = (W - bw) / 2, y0 = H * 0.62;
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x0 - 16, y0 - 54, bw + 32, bh + 84);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`${k.dist}-yard field goal — press ACTION / SPACE in the green`, W / 2, y0 - 26);
    ctx.fillStyle = '#7a1f1f'; ctx.fillRect(x0, y0, bw, bh);
    ctx.fillStyle = '#2fbf4a'; ctx.fillRect(x0 + bw / 2 - k.win * bw / 2, y0, k.win * bw, bh);
    const mx = x0 + bw / 2 + k.pos * bw / 2;
    ctx.fillStyle = '#ffe14d'; ctx.fillRect(mx - 3, y0 - 6, 6, bh + 12);
    ctx.font = '14px system-ui'; ctx.fillStyle = '#ddd'; ctx.fillText(`Make chance if centered: ${Math.round(k.p * 100)}% kicker range`, W / 2, y0 + bh + 22);
  }

  // hit-test for tapping receivers
  receiverAt(px, py) {
    if (!this.view || !this.eligible) return null;
    let best = null, bd = 1e9;
    for (const e of this.eligible) {
      const X = this.sx(e.x), Y = this.sy(e.y);
      const d = Math.hypot(X - px, Y - py);
      if (d < Math.max(36, this.scale * 3) && d < bd) { bd = d; best = e; }
    }
    return best;
  }
}
const RCOL = ['#4dabff', '#5be37d', '#ff6b6b', '#ffd43b', '#d0a2ff'];

// ---------- tiny sound effects via WebAudio ----------
let _actx = null;
function sfx(kind) {
  if (typeof window === 'undefined' || !window.AudioContext || (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.settings.mute) || window.__mute) return;
  try {
    _actx = _actx || new AudioContext();
    const a = _actx, t = a.currentTime;
    const tone = (f, d, type = 'square', vol = 0.05, f2) => {
      const t = a.currentTime;
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d);
    };
    const noise = (d, vol = 0.08) => {
      const buf = a.createBuffer(1, a.sampleRate * d, a.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
      const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(a.destination); s.start(t);
    };
    if (kind === 'whistle') { tone(2900, 0.25, 'sine', 0.04); tone(3100, 0.25, 'sine', 0.03); }
    if (kind === 'snap') tone(140, 0.08, 'square', 0.05);
    if (kind === 'throw') tone(500, 0.12, 'triangle', 0.04, 900);
    if (kind === 'catch') tone(320, 0.06, 'square', 0.05);
    if (kind === 'juke') tone(700, 0.08, 'sawtooth', 0.03, 300);
    if (kind === 'int') { tone(300, 0.3, 'sawtooth', 0.05, 120); noise(0.8, 0.06); }
    if (kind === 'td') { noise(1.6, 0.1); tone(523, 0.15, 'square', 0.04); setTimeout(() => tone(659, 0.15, 'square', 0.04), 150); setTimeout(() => tone(784, 0.3, 'square', 0.04), 300); }
  } catch (e) { }
}
