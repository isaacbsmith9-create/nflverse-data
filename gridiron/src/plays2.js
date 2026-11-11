// ============================================================
// Gridiron Dynasty - big playbook expansion: new formations,
// routes and ~40 more plays across every category.
// ============================================================
'use strict';

Object.assign(FORMS, {
  pistol: { QB: [-4, 0], RB: [-6.6, 0], WR1: [-1, -19], WR2: [-1, 18.5], WR3: [-1.6, -10], TE: [-1.3, 4.3] },
  empty:  { QB: [-5, 0], RB: [-1.4, 10.5], WR1: [-1, -19], WR2: [-1, 18.5], WR3: [-1.6, -10], TE: [-1.3, 4.3] },
  bunch:  { QB: [-5, 0], RB: [-5, 2.2], WR1: [-1, -12.5], WR2: [-1, 18.5], WR3: [-2.1, -10.8], TE: [-2.3, -14.3] },
  iform:  { QB: [-1.4, 0], RB: [-7.6, 0], WR1: [-1, -19], WR2: [-1, 18.5], WR3: [-1, 12], TE: [-1.3, 4.3] },
  tight:  { QB: [-1.4, 0], RB: [-6.8, 0], WR1: [-1, -8.5], WR2: [-1, 8.5], WR3: [-1.3, -4.3], TE: [-1.3, 4.3] },
});

Object.assign(ROUTES, {
  sluggo: [[2, 0], [3, 3], [30, -1]],          // slant-and-go
  outup: [[6, 0], [0.5, -3], [28, 0]],         // out-and-up
  fade: [[3, -1.5], [30, -3]],
  spot: [[5, 2, 's']],
  cross: [[7, 0], [6, 22]],
  swing: [[-1.5, -3], [1, -6], [5, -6]],
  angle: [[2, -3], [3, 5], [6, 3]],
  whip: [[4, 4], [-0.5, -5, 's']],
  stick: [[5, 0], [0, 1.5, 's']],
  sail: [[10, 0], [8, -10]],
  deepdig: [[16, 0], [0.5, 16]],
  wrscreen: [[-1.5, 2, 's']],
});

const MORE_PLAYS = [
  // ---- runs ----
  { id: 'powero', name: 'Power O', type: 'run', cat: 'Run', form: 'iform', path: [[1, 1], [3, 3], [10, 3.5]], desc: 'Downhill power off right tackle from the I.' },
  { id: 'izone', name: 'Inside Zone', type: 'run', cat: 'Run', form: 'gun', path: [[0.5, 1], [2, 0.5], [10, 0]], desc: 'Press the line, find the crease, cut.' },
  { id: 'ozone', name: 'Outside Zone', type: 'run', cat: 'Run', form: 'single', path: [[1, 4], [1.5, 7], [10, 9]], desc: 'Stretch it wide, one cut and go.' },
  { id: 'trap', name: 'Trap', type: 'run', cat: 'Run', form: 'single', path: [[1.5, -1], [3, -1], [10, -1]], desc: 'Let the DT in, trap him, hit the hole.' },
  { id: 'pistoliso', name: 'Pistol Iso', type: 'run', cat: 'Run', form: 'pistol', path: [[1.5, 0.6], [4, 0.8], [10, 0.8]], desc: 'Straight downhill from the pistol.' },
  { id: 'istretch', name: 'I-Form Stretch', type: 'run', cat: 'Run', form: 'iform', path: [[0, 4], [1, 8], [12, 10]], desc: 'Get to the edge behind the fullback.' },
  { id: 'counterTrey', name: 'Counter Trey', type: 'run', cat: 'Run', form: 'pistol', path: [[0, -1.5], [1.5, 2.5], [3, 5], [12, 6]], desc: 'Step left, pulling guards lead it right.' },
  { id: 'tossleft', name: 'Toss Left', type: 'run', cat: 'Run', form: 'single', toss: true, path: [[1.4, -3], [3, -6.5], [20, -7]], desc: 'Pitch to the short side.' },
  { id: 'gldive', name: 'Goal Line Dive', type: 'run', cat: 'Run', form: 'tight', path: [[1.2, 0.8], [4, 0.8]], desc: 'Heavy set, push the pile.' },
  { id: 'jetsweep', name: 'Jet Sweep', type: 'trick', cat: 'Run', form: 'gun', handTo: 'WR3', jet: true,
    carrierPath: [[-2.2, 4.5], [1.5, 5], [4, 3], [18, 2]], path: [[1, 1], [4, 1]], desc: 'Slot in jet motion takes it on the move.' },
  // ---- option ----
  { id: 'pistolread', name: 'Pistol Read', type: 'option', cat: 'Option', form: 'pistol', read: 'DL4',
    path: [[1, -1.5], [2, -3], [9, -4]], qbPath: [[1, 1.8], [3, 3.2], [12, 3]], desc: 'Zone read from the pistol.' },
  { id: 'invveer', name: 'Inverted Veer', type: 'option', cat: 'Option', form: 'gun', read: 'DL4', invert: true,
    path: [[0.5, 3], [2, 7], [12, 9]], qbPath: [[1.5, -0.8], [3, -1.2], [10, -1.5]], desc: 'RB sweeps outside, QB keeps inside. End widens, you keep.' },
  // ---- QB runs ----
  { id: 'qbcounter', name: 'QB Counter', type: 'qbrun', cat: 'QB Run', form: 'pistol', qbPath: [[0, -1], [1.5, 2.5], [3, 4.5], [12, 5]], desc: 'Fake left, QB follows the pullers right.' },
  { id: 'qbsweep', name: 'QB Sweep', type: 'qbrun', cat: 'QB Run', form: 'gun', qbPath: [[1, 2.5], [2.5, 4.5], [12, 5]], desc: 'Get your QB to the perimeter.' },
  { id: 'qbiso', name: 'QB Iso', type: 'qbrun', cat: 'QB Run', form: 'pistol', qbPath: [[1.5, -0.6], [4, -0.8], [10, -0.8]], desc: 'RB leads, QB runs it up the gut.' },
  // ---- RPOs ----
  { id: 'rposlantflat', name: 'RPO Slant Flat', type: 'rpo', cat: 'RPO', form: 'gun', read: 'LB1', quick: true,
    path: [[0.4, -1.5], [1.5, -3], [9, -3.5]], routes: { WR1: 'slant', WR3: 'flat', WR2: 'hitch' }, desc: 'Slant-flat tag on inside zone.' },
  { id: 'rpostick', name: 'RPO Stick', type: 'rpo', cat: 'RPO', form: 'trips', read: 'LB2', quick: true,
    path: [[0.4, 1.5], [1.5, 3], [9, 3.5]], routes: { WR3: 'stick', TE: 'flat', WR2: 'hitch' }, desc: 'Stick concept married to the run.' },
  { id: 'rpopop', name: 'RPO Pop Pass', type: 'rpo', cat: 'RPO', form: 'single', read: 'LB1', quick: true,
    path: [[1.5, 0], [4, 1.2], [10, 1.6]], routes: { TE: 'seam', WR1: 'slant' }, desc: 'LB steps up, pop it to the TE behind him.' },
  // ---- passes ----
  { id: 'smash', name: 'Smash', type: 'pass', cat: 'Pass', form: 'gun', routes: { WR1: 'hitch', WR3: 'corner', WR2: 'hitch', TE: 'corner', RB: 'flat' }, desc: 'Hitch under, corner over. Beats Cover 2.' },
  { id: 'flood', name: 'Flood', type: 'pass', cat: 'Pass', form: 'trips', routes: { WR2: 'go', WR3: 'sail', TE: 'flat', WR1: 'dig', RB: 'block' }, desc: 'Three levels to one side. Beats Cover 3.' },
  { id: 'ycross', name: 'Y-Cross', type: 'pass', cat: 'Pass', form: 'gun', routes: { WR1: 'post', WR2: 'go', WR3: 'drag', TE: 'cross', RB: 'flat' }, desc: 'TE deep cross under the post.' },
  { id: 'levels', name: 'Levels', type: 'pass', cat: 'Pass', form: 'gun', routes: { WR1: 'deepdig', WR3: 'drag', WR2: 'curl', TE: 'seam', RB: 'swing' }, desc: 'Two in-breakers at different depths.' },
  { id: 'dagger', name: 'Dagger', type: 'pass', cat: 'Pass', form: 'gun', routes: { WR3: 'seam', WR1: 'deepdig', WR2: 'hitch', TE: 'flat', RB: 'block' }, desc: 'Seam clears it out, deep dig comes in behind.' },
  { id: 'spacing', name: 'Spacing', type: 'pass', cat: 'Pass', form: 'trips', routes: { WR1: 'spot', WR2: 'hitch', WR3: 'spot', TE: 'flat', RB: 'swing' }, desc: 'Find the hole in the zone, quick and easy.' },
  { id: 'stickplay', name: 'Stick', type: 'pass', cat: 'Pass', form: 'trips', routes: { WR3: 'stick', TE: 'flat', WR2: 'go', WR1: 'slant', RB: 'block' }, desc: 'Third-and-short money play.' },
  { id: 'doublemove', name: 'Double Moves', type: 'pass', cat: 'Pass', form: 'gun', routes: { WR1: 'sluggo', WR2: 'outup', WR3: 'hitch', RB: 'block' }, desc: 'Sell the short route, then go deep.' },
  { id: 'fadeslant', name: 'Fade Slant', type: 'pass', cat: 'Pass', form: 'gun', routes: { WR1: 'fade', WR2: 'fade', WR3: 'slant', TE: 'hitch', RB: 'flat' }, desc: 'Back-shoulder fades outside, slant inside.' },
  { id: 'bunchsnag', name: 'Bunch Snag', type: 'pass', cat: 'Pass', form: 'bunch', routes: { WR1: 'corner', WR3: 'spot', TE: 'flat', WR2: 'go', RB: 'block' }, desc: 'Triangle read out of a tight bunch.' },
  { id: 'bunchverts', name: 'Bunch Verts', type: 'pass', cat: 'Pass', form: 'bunch', routes: { WR1: 'go', WR3: 'seam', TE: 'out', WR2: 'post', RB: 'swing' }, desc: 'Release the bunch vertical, rub the man defenders.' },
  { id: 'emptyquick', name: 'Empty Quick', type: 'pass', cat: 'Pass', form: 'empty', routes: { WR1: 'slant', WR2: 'out', WR3: 'hitch', TE: 'stick', RB: 'slant' }, desc: 'Five wide, ball out in a flash.' },
  { id: 'emptyshot', name: 'Empty Shot', type: 'pass', cat: 'Pass', form: 'empty', routes: { WR1: 'go', WR2: 'post', WR3: 'seam', TE: 'dig', RB: 'corner' }, desc: 'Five wide, take the top off.' },
  { id: 'paboot', name: 'PA Boot', type: 'pass', cat: 'Pass', form: 'pistol', pa: true, routes: { TE: 'flat', WR3: 'cross', WR2: 'go', WR1: 'dig', RB: 'block' }, desc: 'Fake the run, roll out, flat-cross-go.' },
  { id: 'texas', name: 'Texas', type: 'pass', cat: 'Pass', form: 'gun', routes: { RB: 'angle', WR1: 'go', WR2: 'curl', WR3: 'drag', TE: 'seam' }, desc: 'RB angle route eats linebackers alive.' },
  { id: 'wrscreen', name: 'WR Screen', type: 'pass', cat: 'Pass', form: 'gun', screen: true, screenTo: 'WR1', routes: { WR1: 'wrscreen', WR3: 'block', TE: 'block', WR2: 'go', RB: 'block' }, desc: 'Quick screen outside with blockers in front.' },
  { id: 'swing', name: 'RB Swing', type: 'pass', cat: 'Pass', form: 'gun', routes: { RB: 'swing', WR1: 'go', WR2: 'go', WR3: 'curl', TE: 'block' }, desc: 'Get your back the ball in space.' },
  { id: 'ipadeep', name: 'I-Form PA Deep', type: 'pass', cat: 'Pass', form: 'iform', pa: true, routes: { WR1: 'post', WR3: 'go', TE: 'deepdig', WR2: 'comeback', RB: 'block' }, desc: 'Heavy look, max protection, shot downfield.' },
  { id: 'glfade', name: 'Goal Line Fade', type: 'pass', cat: 'Pass', form: 'tight', routes: { WR3: 'flat', TE: 'corner', WR1: 'fade', WR2: 'slant' }, desc: 'Red zone: fade the outside man.' },
  // ---- trick plays ----
  { id: 'statue', name: 'Statue of Liberty', type: 'trick', cat: 'Trick', form: 'gun', handTo: 'RB', handAt: 0.9, passPro: true,
    path: [[-0.5, -1], [0.5, -4], [3, -8], [18, -10]], routes: { WR1: 'go', WR2: 'go', WR3: 'post', TE: 'seam' }, desc: 'QB pump fakes, RB takes it out of his hand going the other way.' },
  { id: 'reversepass', name: 'Reverse Pass', type: 'trick', cat: 'Trick', form: 'gun', handTo: 'WR3', jet: true, handPass: true, fakeRun: true,
    carrierPath: [[-2.2, 4.5], [0.3, 4], [0.2, 3], [0, 2]], routes: { WR1: 'go', WR2: 'post', TE: 'corner' }, desc: 'Jet sweep look, the receiver pulls up and throws.' },
  { id: 'tethrowback', name: 'TE Throwback', type: 'trick', cat: 'Trick', form: 'gun', directSnap: 'RB', directNoPass: true, fakeRun: true,
    lateralTo: 'TE', latFrom: 'RB', latAt: 0.6, path: [[0.5, 2], [0.6, 2.5]], routes: { QB: 'wheel', WR1: 'go', WR2: 'post' },
    desc: 'Direct snap to the RB, pitch to the TE, TE throws it to the QB.' },
  { id: 'fakepunt', name: 'Fake Punt', type: 'trick', cat: 'Trick', form: 'single', directSnap: 'RB', directNoPass: true, fakeSpecial: true,
    path: [[1, 3], [3, 6], [14, 7]], desc: 'Fourth down surprise: direct snap, sweep it.' },
  { id: 'fakefg', name: 'Fake Field Goal', type: 'pass', cat: 'Trick', form: 'single', fakeSpecial: true, quick: true,
    routes: { TE: 'flat', WR3: 'corner', WR1: 'slant', WR2: 'go', RB: 'flat' }, desc: 'The holder pops up and throws.' },
];
for (const p of MORE_PLAYS) {
  p.routes = p.routes || {};
  OFF_PLAYS.push(p);
  if (['option', 'speedopt', 'rpo', 'qbrun', 'trick'].includes(p.type) && p.cat !== 'Run') NEW_PLAYS.push(p);
}

// a fake catches the defense in its special-teams look
const _chooseX = LiveGame.prototype.choose;
LiveGame.prototype.choose = function (id) {
  _chooseX.call(this, id);
  if (this.phase === 'pre' && this.offPlay && this.offPlay.fakeSpecial && !this.userOnDefense()) {
    this.defPlay = DEF_PLAYS.find(p => p.id === 'prevent'); this.setup(); this.phase = 'pre';
  }
};
