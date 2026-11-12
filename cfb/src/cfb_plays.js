// ============================================================
// College Gridiron Dynasty - college playbook additions: pistol,
// spread option and triple-option style reads, air raid concepts.
// Built from the shared play types so the live engine runs them.
// ============================================================
'use strict';

FORMS.pistol = { QB: [-3.6, 0], RB: [-6.6, 0], WR1: [-1, -19], WR2: [-1, 18.5], WR3: [-1.6, -10], TE: [-1.3, 4.3] };
FORMS.spread = { QB: [-5, 0], RB: [-5, 2.2], WR1: [-1, -21], WR2: [-1, 20.5], WR3: [-1.6, -12], TE: [-1.6, 12] };

const CFB_PLAYS = [
  { id: 'pistolread', name: 'Pistol Zone Read', type: 'option', cat: 'Option', form: 'pistol', read: 'DL4',
    path: [[0.6, -1.2], [1.6, -3], [9, -4]], qbPath: [[1, 1.8], [3, 3.4], [12, 3.2]],
    desc: 'Downhill read from the pistol. Give if the end sits, keep if he crashes.' },
  { id: 'veer', name: 'Inverted Veer', type: 'option', cat: 'Option', form: 'gun', read: 'DL4',
    path: [[0.2, 2.5], [1, 6], [14, 8]], qbPath: [[0.8, 0.6], [2.5, 0.8], [12, 0.5]],
    desc: 'RB sweeps the edge, QB keeps inside. Read the end.' },
  { id: 'triple', name: 'Triple Option', type: 'speedopt', cat: 'Option', form: 'pistol', read: 'DL4',
    qbPath: [[1.2, 1.8], [2.4, 3.6], [3, 2.4], [14, 2]], path: [[0.6, 3.6], [1.8, 5.8], [2.6, 4.4], [14, 3]],
    desc: 'Ride the dive, attack the edge, pitch when the end commits. Old-school college ball.' },
  { id: 'rpopeek', name: 'RPO Peek Slant', type: 'rpo', cat: 'RPO', form: 'pistol', read: 'LB2', quick: true,
    path: [[0.5, 1.2], [1.5, 2.6], [9, 3]], routes: { WR2: 'slant', WR1: 'go', WR3: 'hitch' },
    desc: 'Pistol inside zone. Throw the slant behind a linebacker who steps up.' },
  { id: 'ycross', name: 'Air Raid Y-Cross', type: 'pass', cat: 'Pass', form: 'spread', routes: { WR1: 'post', WR2: 'curl', WR3: 'dig', TE: 'drag', RB: 'flat' },
    desc: 'Spread them out. The inside receiver crosses the field.' },
  { id: 'fourverts', name: 'Spread Verts', type: 'pass', cat: 'Pass', form: 'spread', routes: { WR1: 'go', WR2: 'go', WR3: 'seam', TE: 'seam', RB: 'screen' },
    desc: 'Four vertical routes from a wide split, RB checkdown screen.' },
  { id: 'pistolpa', name: 'Pistol PA Boot', type: 'pass', cat: 'Pass', form: 'pistol', pa: true, routes: { WR1: 'comeback', WR2: 'post', WR3: 'drag', TE: 'flat', RB: 'block' },
    desc: 'Fake the zone, QB bootlegs. Drag, flat or the deep post.' },
];
for (const p of CFB_PLAYS) { p.routes = p.routes || {}; OFF_PLAYS.push(p); NEW_PLAYS.push(p); }
