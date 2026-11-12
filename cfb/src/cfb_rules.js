// ============================================================
// College Gridiron Dynasty - college game rules on top of the shared sim:
//  - no two-minute warning
//  - overtime: alternating possessions from the opponent 25,
//    2-point tries required in the 2nd OT, 2-point shootout from the 3rd
//  - home-field advantage, no ties, touchbacks to the 25
//  - every player who dresses in the lineup gets a game played (redshirt counter)
// ============================================================
'use strict';

const _newGameStateC = newGameState;
newGameState = function (L, hid, aid, opts = {}) {
  if (!L || !L.cfb) return _newGameStateC(L, hid, aid, opts);
  const gs = _newGameStateC(L, hid, aid, Object.assign({}, opts, { playoff: true }));
  gs.cfb = true; gs.tmw = null; gs.neutral = !!opts.neutral;
  if (!gs.neutral) { const r = gs.rt[0]; for (const k in r) r[k] += 1.6; } // home crowd
  for (const r of gs.rt) { r.pass += 2.5; r.run += 2.5; r.prot += 1.5; } // college offenses: more points than the pros
  // everyone in the game-day lineup gets a game played
  gs.participants = [];
  for (const side of [0, 1]) for (const pos in gs.lu[side]) for (const p of gs.lu[side][pos]) if (!p.scrub) gs.participants.push(p.id);
  return gs;
};

const _simGameC = simGame;
simGame = function (L, hid, aid, opts = {}) {
  const gs = _simGameC(L, hid, aid, opts);
  if (gs.cfb && gs.score[0] === gs.score[1]) gs.score[chance(0.5) ? 0 : 1] += 2; // safety net if the play cap was hit
  return gs;
};

// ---------- overtime ----------
const _doFieldGoalC = doFieldGoal;
doFieldGoal = function (gs, made) {
  if (gs.ot && gs.ot.n >= 3) { logp(gs, 'No kicking in a two-point shootout. Try failed.'); otEndPossession(gs); return false; }
  return _doFieldGoalC(gs, made);
};
function otPlace(gs) {
  const ot = gs.ot, side = ot.half === 0 ? ot.first : 1 - ot.first;
  ot.placing = true;
  setBall(gs, side, ot.n >= 3 ? 97 : 75);
  ot.placing = false;
  gs.clock = gs.qlen; gs.lastRunoff = 0;
  if (ot.n >= 3) { gs.down = 4; gs.togo = 3; }
}
function otEndPossession(gs) {
  const ot = gs.ot;
  ot.half++;
  if (ot.half >= 2) {
    if (gs.score[0] !== gs.score[1]) { gs.over = true; logp(gs, `Game over in ${ot.n > 1 ? ot.n + ' overtimes' : 'overtime'}!`, true); return; }
    ot.n++; ot.half = 0; ot.first = 1 - ot.first; gs.quarter = 4 + ot.n;
    logp(gs, ot.n >= 3 ? `— OT ${ot.n}: two-point shootout —` : `— Overtime ${ot.n} —`, true);
  }
  otPlace(gs);
}
const _setBallC = setBall;
setBall = function (gs, poss, yard) {
  if (gs.ot && !gs.ot.placing && !gs.over) { otEndPossession(gs); return; }
  _setBallC(gs, poss, yard);
};
const _kickoffC = kickoff;
kickoff = function (gs, recv, silent) {
  if (gs.ot) { if (!gs.over) otEndPossession(gs); return; }
  if (!gs.cfb) return _kickoffC(gs, recv, silent);
  const r = Math.random();
  if (r < 0.985) {
    const tb = r < 0.56, yard = tb ? 25 : clamp(Math.round(gauss(26, 7)), 8, 60);
    setBall(gs, recv, yard);
    if (!silent) logp(gs, `${teamAbbr(gs, 1 - recv)} kicks off. ${tb ? 'Touchback.' : `Returned to the ${yardStr(gs, yard)}.`}`);
    return;
  }
  const kr = gs.lu[recv].RB[1] || gs.lu[recv].WR[2];
  gs.score[recv] += 6; logp(gs, `KICKOFF RETURN TOUCHDOWN by ${pshort(kr)}!`, true); st(gs, kr, 'krtd');
  pat(gs, recv); kickoff(gs, 1 - recv);
};
const _patC = pat;
pat = function (gs, side) {
  if (gs.ot && gs.ot.n >= 3) { gs.score[side] -= 4; logp(gs, 'Two-point try is GOOD.', true); return; } // the "TD" on a shootout play is worth 2
  if (gs.ot && gs.ot.n === 2) { // 2nd OT: must go for two after a TD
    const off = gs.lu[side], d = gs.lu[1 - side];
    const p = clamp(0.45 + ((off.QB[0].ovr + off.WR[0].ovr) / 2 - (d.CB[0].ovr + d.LB[0].ovr) / 2) / 120, 0.3, 0.62);
    if (chance(p)) { gs.score[side] += 2; logp(gs, 'Two-point conversion is GOOD.', true); } else logp(gs, 'Two-point conversion fails.');
    return;
  }
  _patC(gs, side);
};
const _endQuarterC = endQuarter;
endQuarter = function (gs) {
  if (!gs.cfb) return _endQuarterC(gs);
  if (gs.ot) { gs.clock = gs.qlen; return false; }
  if (gs.quarter === 4 && gs.score[0] === gs.score[1]) {
    gs.quarter = 5; gs.clock = gs.qlen; gs.timeouts = [1, 1];
    gs.ot = { n: 1, half: 0, first: chance(0.5) ? 0 : 1, placing: false };
    logp(gs, '— OVERTIME — each team gets the ball at the 25', true);
    otPlace(gs);
    return false;
  }
  return _endQuarterC(gs);
};
const _checkOTC = checkOT;
checkOT = function (gs) { if (gs.cfb) return; _checkOTC(gs); };
const _runClockC = runClock;
runClock = function (gs, sec) {
  if (gs.ot) { gs.clock = gs.qlen; return gs.over; }
  return _runClockC(gs, sec);
};
// in a 2-point shootout the defense can't "punt" or kick a field goal: the try is one play
const _cpuDecisionC = cpuDecision;
cpuDecision = function (gs) {
  if (gs.ot && gs.ot.n >= 3) return 'go';
  const d = _cpuDecisionC(gs);
  if (gs.ot) { // in OT you never punt; kick when it's 4th and long in range
    if (d === 'punt' || d === 'kneel') return fgProb(gs.lu[gs.poss].K[0], 100 - gs.yard + 17) > 0.3 ? 'fg' : 'go';
    if (gs.down === 4 && gs.ot.half === 1) { const diff = gs.score[gs.poss] - gs.score[1 - gs.poss]; if (diff <= -4) return 'go'; }
  }
  return d;
};
