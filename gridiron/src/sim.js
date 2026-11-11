// ============================================================
// Gridiron Dynasty - game rules + statistical play-by-play sim
// Shared by AI-vs-AI games and the live engine (for "sim drive")
// ============================================================
'use strict';

function newGameState(L, hid, aid, opts = {}) {
  const gs = {
    tids: [hid, aid], score: [0, 0], quarter: 1, qlen: opts.qlen || 900, clock: opts.qlen || 900,
    poss: 0, yard: 25, down: 1, togo: 10, over: false, playoff: !!opts.playoff,
    box: {}, log: [], drives: 0, otPoss: 0,
    lu: [lineup(L, L.teams[hid]), lineup(L, L.teams[aid])],
    runoff: (opts.qlen || 900) >= 900 ? 34 : 18,
    tstats: [{ yds: 0, pass: 0, rush: 0, to: 0, fd: 0 }, { yds: 0, pass: 0, rush: 0, to: 0, fd: 0 }],
    diff: opts.diff || 'pro', userSide: opts.userSide ?? -1,
  };
  gs.rt = [teamRatings(gs.lu[0]), teamRatings(gs.lu[1])];
  // difficulty: boosts CPU team ratings in all modes
  if (gs.userSide >= 0) {
    const b = { rookie: -6, pro: 0, allpro: 4, legend: 8 }[gs.diff] || 0;
    const c = gs.rt[1 - gs.userSide]; for (const k in c) c[k] += b;
  }
  gs.timeouts = [3, 3]; gs.noHuddle = [false, false]; gs.tmw = {}; gs.lastRunoff = 0; gs.pens = [[0, 0], [0, 0]];
  gs.opening = chance(0.5) ? 0 : 1;
  kickoff(gs, gs.opening, true);
  return gs;
}

function teamRatings(lu) {
  const avg = (pos, k, n) => { const a = lu[pos].slice(0, n || lu[pos].length); return a.reduce((s, p) => s + (k ? p.r[k] : p.ovr), 0) / a.length; };
  const qb = lu.QB[0];
  return {
    pass: qb.r.tha * .3 + qb.r.awr * .15 + qb.r.thp * .1 + avg('WR', null, 3) * .25 + avg('TE') * .07 + avg('OL', 'rbk') * .13,
    run: avg('RB', null, 1) * .45 + avg('OL', 'rbk') * .4 + avg('TE', 'rbk') * .05 + qb.r.spd * .1,
    prot: avg('OL', 'rbk') * .7 + avg('OL', 'str') * .3,
    rush: avg('DL', 'prs', 4) * .75 + avg('LB', 'prs', 2) * .25,
    cover: avg('CB', 'cov', 3) * .6 + avg('S', 'cov') * .3 + avg('LB', 'cov', 2) * .1,
    rundef: avg('DL', null, 4) * .4 + avg('LB', 'tkl', 2) * .4 + avg('S', 'tkl') * .2,
    kick: lu.K[0].r.kpw * .5 + lu.K[0].r.kac * .5, kpw: lu.K[0].r.kpw, kac: lu.K[0].r.kac, ppw: lu.P[0].r.kpw,
  };
}

// ---------- stat helpers ----------
function st(gs, p, k, v = 1) { if (!p || p.scrub) return; const b = gs.box[p.id] || (gs.box[p.id] = {}); b[k] = (b[k] || 0) + v; }
function logp(gs, txt, big) { gs.log.push({ q: gs.quarter, c: gs.clock, txt, big: !!big, s: gs.score.slice() }); }
function fmtClock(c) { c = Math.max(0, Math.ceil(c)); return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); }
function yardStr(gs, yard = gs.yard, poss = gs.poss) {
  if (yard === 50) return '50';
  return yard < 50 ? `own ${yard}` : `opp ${100 - yard}`;
}
function downStr(gs) {
  const d = ['', '1st', '2nd', '3rd', '4th'][gs.down];
  const g = gs.yard + gs.togo >= 100 ? 'Goal' : gs.togo;
  return `${d} & ${g}`;
}

// ---------- rules ----------
function setBall(gs, poss, yard) {
  gs.poss = poss; gs.yard = clamp(Math.round(yard), 1, 99); gs.down = 1; gs.togo = Math.min(10, 100 - gs.yard); gs.drives++;
  if (gs.quarter >= 5) gs.otPoss++;
}

function kickoff(gs, recv, silent) {
  const r = Math.random();
  let yard, txt;
  if (r < 0.62) { yard = 30; txt = 'Touchback.'; }
  else if (r < 0.985) { yard = clamp(Math.round(gauss(28, 7)), 8, 60); txt = `Returned to the ${yardStr(gs, yard)}.`; }
  else { // return TD
    const kr = gs.lu[recv].RB[1] || gs.lu[recv].WR[2];
    gs.score[recv] += 6; logp(gs, `KICKOFF RETURN TOUCHDOWN by ${pshort(kr)}!`, true); st(gs, kr, 'krtd');
    pat(gs, recv); kickoff(gs, 1 - recv); return;
  }
  setBall(gs, recv, yard);
  if (!silent) logp(gs, `${teamAbbr(gs, 1 - recv)} kicks off. ${txt}`);
}
function teamAbbr(gs, side) { return (typeof LEAGUE !== 'undefined' && LEAGUE) ? LEAGUE.teams[gs.tids[side]].abbr : 'T' + side; }

function pat(gs, side) {
  const k = gs.lu[side].K[0];
  // 2-pt try if trailing by 2 late
  const diff = gs.score[side] - gs.score[1 - side];
  if (gs.quarter >= 4 && gs.clock < 420 && [-2, -10, 1, 5].includes(diff)) {
    if (chance(0.48)) { gs.score[side] += 2; logp(gs, 'Two-point conversion is GOOD.'); }
    else logp(gs, 'Two-point conversion fails.');
    return;
  }
  const p = clamp(0.88 + (k.r.kac - 70) / 300, 0.8, 0.99);
  st(gs, k, 'xpa');
  if (chance(p)) { gs.score[side] += 1; st(gs, k, 'xpm'); } else logp(gs, 'Extra point is NO GOOD!');
}

function fgProb(k, dist) {
  const range = 48 + (k.r.kpw - 60) * 0.42; // max comfortable range
  let p = 0.995 - Math.max(0, dist - 25) * 0.012 - Math.max(0, dist - range) * 0.06 + (k.r.kac - 75) / 350;
  return clamp(p, dist > range + 9 ? 0 : 0.05, 0.99);
}

// time management + quarter transitions. returns true if game over
function runClock(gs, sec) {
  const before = gs.clock;
  gs.clock -= sec;
  // two-minute warning: the clock stops at 2:00 of each half
  if ((gs.quarter === 2 || gs.quarter === 4) && gs.qlen > 150 && before > 120 && gs.clock <= 120 && gs.tmw && !gs.tmw[gs.quarter]) {
    gs.tmw[gs.quarter] = true; gs.clock = 120; gs.lastRunoff = 0; logp(gs, '— Two-minute warning —'); return false;
  }
  if (gs.clock > 0) return false;
  gs.clock = 0;
  return endQuarter(gs);
}
function endQuarter(gs) {
  if (gs.quarter === 2) {
    gs.quarter = 3; gs.clock = gs.qlen; gs.timeouts = [3, 3]; gs.lastRunoff = 0; logp(gs, '— Halftime —', true);
    kickoff(gs, 1 - gs.opening); return false;
  }
  if (gs.quarter < 4) { gs.quarter++; gs.clock = gs.qlen; logp(gs, `— End of Q${gs.quarter - 1} —`); return false; }
  // end of 4th or OT
  if (gs.score[0] !== gs.score[1]) { gs.over = true; return true; }
  if (gs.quarter >= 5 && !gs.playoff) { gs.over = true; logp(gs, 'Game ends in a TIE.', true); return true; }
  gs.quarter++; gs.clock = Math.min(600, gs.qlen); gs.otPoss = 0; gs.timeouts = [2, 2]; gs.lastRunoff = 0;
  logp(gs, gs.quarter === 5 ? '— OVERTIME —' : '— Another OT period —', true);
  kickoff(gs, chance(0.5) ? 0 : 1);
  return false;
}
function checkOT(gs) {
  // simplified sudden death: any score in OT ends it, except a FG on the opening possession (other team gets a shot)
  if (gs.quarter >= 5 && gs.score[0] !== gs.score[1]) { gs.over = true; logp(gs, 'Game over in overtime!', true); }
}

// Apply the result of an offensive snap. res: {yards, inc, oob, elapsed, turnover:{yard(from new offense goal), td}, sack, kneel}
function applyPlay(gs, res) { const n = gs.log.length; _applyPlay(gs, res); stampLog(gs, n - 1); }
function stampLog(gs, from) { for (let i = Math.max(0, from); i < gs.log.length; i++) if (gs.log[i].big) gs.log[i].s = gs.score.slice(); }
function _applyPlay(gs, res) {
  const off = gs.poss, def = 1 - off;
  let stop = !!(res.inc || res.oob);
  let scored = false;
  if (res.turnover) {
    const T = res.turnover;
    gs.tstats[off].to++;
    if (T.td || T.yard >= 100) {
      gs.score[def] += 6; logp(gs, 'Returned for a TOUCHDOWN!', true); pat(gs, def); checkOT(gs);
      if (!gs.over) { kickoff(gs, off); runClock(gs, res.elapsed); }
      return;
    }
    if (T.yard <= 0) { setBall(gs, def, 20); } // touchback on INT in endzone
    else setBall(gs, def, T.yard);
    runClock(gs, res.elapsed);
    return;
  }
  const ny = gs.yard + res.yards;
  gs.tstats[off].yds += res.yards;
  if (ny >= 100) {
    gs.score[off] += 6; scored = true;
    pat(gs, off); checkOT(gs);
    if (gs.over) return;
    kickoff(gs, def);
    runClock(gs, res.elapsed);
    return;
  }
  if (ny <= 0) {
    gs.score[def] += 2; logp(gs, 'SAFETY!', true); checkOT(gs);
    if (gs.over) return;
    // free kick
    setBall(gs, def, clamp(Math.round(gauss(35, 6)), 20, 55));
    runClock(gs, res.elapsed);
    return;
  }
  gs.yard = ny;
  gs.togo -= res.yards;
  if (gs.togo <= 0) { gs.down = 1; gs.togo = Math.min(10, 100 - gs.yard); gs.tstats[off].fd++; stop = stop || false; }
  else {
    gs.down++;
    if (gs.down > 4) { logp(gs, 'Turnover on downs.'); setBall(gs, def, 100 - gs.yard); stop = true; }
  }
  // clock: running unless stopped; hurry-up late in halves
  // time that runs between plays is remembered so a timeout or spike can save it
  const runoff = stop ? 0 : (hurry(gs, off) || (gs.noHuddle && gs.noHuddle[off])) ? 8 : gs.runoff;
  const q0 = gs.quarter;
  runClock(gs, res.elapsed + runoff);
  gs.lastRunoff = gs.quarter === q0 ? Math.min(runoff, gs.qlen - gs.clock) : 0;
}
function hurry(gs, side) {
  const late = (gs.quarter === 2 || gs.quarter >= 4) && gs.clock < 150;
  return late && gs.score[side] <= gs.score[1 - side];
}

function doFieldGoal(gs, made) { const n = gs.log.length; const r = _doFieldGoal(gs, made); stampLog(gs, n); return r; }
function _doFieldGoal(gs, made) {
  const off = gs.poss, def = 1 - off, k = gs.lu[off].K[0];
  const dist = 100 - gs.yard + 17;
  st(gs, k, 'fga');
  if (made === undefined) made = chance(fgProb(k, dist));
  if (made) {
    gs.score[off] += 3; st(gs, k, 'fgm'); logp(gs, `${dist}-yd field goal is GOOD.`, true);
    checkOT(gs);
    if (gs.over) return made;
    kickoff(gs, def);
    runClock(gs, 5);
  } else {
    logp(gs, `${dist}-yd field goal is NO GOOD.`);
    setBall(gs, def, Math.max(20, 100 - (gs.yard - 7)));
    runClock(gs, 5);
  }
  return made;
}
function doPunt(gs) {
  const off = gs.poss, def = 1 - off, pp = gs.lu[off].P[0];
  const dist = Math.round(clamp(gauss(42 + (pp.r.kpw - 70) / 3, 6), 25, 68));
  const land = gs.yard + dist;
  st(gs, pp, 'punts'); st(gs, pp, 'puntyds', Math.min(dist, 100 - gs.yard));
  let ny;
  if (land >= 100) { ny = 20; logp(gs, `Punt of ${100 - gs.yard} yds into the end zone. Touchback.`); }
  else {
    const ret = chance(0.35) ? 0 : Math.max(0, Math.round(gauss(8, 6)));
    if (chance(0.006)) { // punt return TD
      gs.score[def] += 6; logp(gs, 'PUNT RETURN TOUCHDOWN!', true); pat(gs, def); checkOT(gs);
      if (!gs.over) { kickoff(gs, off); runClock(gs, 12); }
      return;
    }
    ny = 100 - land + ret;
    logp(gs, `Punt ${dist} yds${ret ? `, returned ${ret}` : ', fair catch'}.`);
  }
  setBall(gs, def, ny);
  runClock(gs, 9);
}

// CPU 4th-down / situational decision. returns 'go'|'fg'|'punt'|'kneel'
function cpuDecision(gs) {
  const off = gs.poss, diff = gs.score[off] - gs.score[1 - off];
  const k = gs.lu[off].K[0], dist = 100 - gs.yard + 17;
  const endHalfFG = (gs.quarter === 2 || gs.quarter >= 4) && gs.clock < 12 && fgProb(k, dist) > 0.25 && (gs.quarter === 2 || diff >= -3 && diff <= 0);
  if (endHalfFG && (gs.quarter === 2 || diff <= 0)) return 'fg';
  if (gs.quarter >= 4 && diff > 0 && gs.clock < 120 && gs.down < 4) return 'kneel';
  if (gs.down < 4) return 'go';
  const late = gs.quarter >= 4 && gs.clock < 300;
  if (late && diff < 0 && (diff < -3 || gs.clock < 120)) return dist <= 52 && diff >= -3 ? 'fg' : 'go';
  if (gs.togo <= 1 && gs.yard >= 40 && gs.yard < 75) return 'go';
  if (gs.togo <= 2 && gs.yard >= 60 && chance(0.4)) return 'go';
  if (fgProb(k, dist) >= 0.45) return 'fg';
  if (gs.yard >= 62 && gs.togo <= 4) return 'go';
  return 'punt';
}

// ---------- statistical play sim ----------
function simOnePlay(gs) {
  const off = gs.poss, def = 1 - off;
  const O = gs.rt[off], D = gs.rt[def], lo = gs.lu[off], ld = gs.lu[def];
  const dec = cpuDecision(gs);
  if (dec === 'fg') { doFieldGoal(gs); return; }
  if (dec === 'punt') { doPunt(gs); return; }
  if (dec === 'kneel') { st(gs, lo.QB[0], 'ra'); st(gs, lo.QB[0], 'ry', -1); applyPlay(gs, { yards: -1, elapsed: 2 }); return; }

  const trail = gs.score[off] < gs.score[1 - off];
  let passP = 0.56;
  if (gs.togo >= 8) passP = 0.74; else if (gs.togo <= 2) passP = 0.32;
  if (gs.quarter >= 4 && gs.clock < 300) passP = trail ? 0.85 : 0.25;
  if (gs.down === 3 && gs.togo >= 4) passP = 0.88;
  const defTackler = () => weighted([...ld.LB.slice(0, 2), ...ld.S, ...ld.CB.slice(0, 3), ...ld.DL.slice(0, 4)], p => ({ LB: 5, S: 3, CB: 2.4, DL: 2 }[p.pos]));

  if (chance(passP)) {
    const qb = lo.QB[0];
    const pd = (O.pass - D.cover), pr = (D.rush - O.prot);
    const sackP = clamp(0.065 + pr * 0.0035, 0.02, 0.15);
    if (chance(sackP)) {
      const loss = -randi(3, 9), sacker = weighted([...ld.DL.slice(0, 4), ...ld.LB.slice(0, 2)], p => p.r.prs);
      st(gs, sacker, 'sk'); st(gs, sacker, 'tk'); st(gs, qb, 'sacked');
      logp(gs, `${pshort(qb)} sacked by ${pshort(sacker)} for ${-loss}.`);
      gs.tstats[off].pass += loss;
      applyPlay(gs, { yards: Math.max(loss, -gs.yard + 1), elapsed: rand(4, 7) });
      return;
    }
    if (chance(0.06 + qb.r.spd / 2500)) { // scramble
      const y = Math.round(clamp(gauss(5 + (qb.r.spd - 70) / 8, 5), -2, 40));
      st(gs, qb, 'ra'); st(gs, qb, 'ry', y); gs.tstats[off].rush += y;
      if (gs.yard + y >= 100) { st(gs, qb, 'rtd'); logp(gs, `${pshort(qb)} scrambles in for a TOUCHDOWN!`, true); }
      st(gs, defTackler(), 'tk');
      applyPlay(gs, { yards: y, elapsed: rand(4, 7), oob: chance(0.3) });
      return;
    }
    const tgt = weighted([lo.WR[0], lo.WR[1], lo.WR[2], lo.TE[0], lo.RB[0]], p => ({ 0: 30, 1: 23, 2: 15, 3: 17, 4: 13 }[[lo.WR[0], lo.WR[1], lo.WR[2], lo.TE[0], lo.RB[0]].indexOf(p)]) * (0.6 + p.ovr / 200));
    st(gs, qb, 'pa'); st(gs, tgt, 'tgt');
    const intP = clamp(0.024 - pd * 0.0009 - (qb.r.awr - 75) * 0.0004, 0.006, 0.06);
    if (chance(intP)) {
      const db = weighted([...ld.CB.slice(0, 3), ...ld.S, ...ld.LB.slice(0, 2)], p => p.r.cov * (p.pos === 'LB' ? 0.4 : 1));
      st(gs, qb, 'pint'); st(gs, db, 'dint');
      const air = randi(5, 30), ret = Math.max(0, Math.round(gauss(10, 12)));
      const spot = 100 - (gs.yard + air) + ret;
      logp(gs, `${pshort(qb)} INTERCEPTED by ${pshort(db)}!`, true);
      applyPlay(gs, { turnover: { yard: Math.min(100, spot), td: spot >= 100 || chance(0.06) }, elapsed: rand(5, 9) });
      return;
    }
    const compP = clamp(0.61 + pd * 0.009 + (tgt.r.cat - 75) * 0.003, 0.4, 0.82);
    if (chance(compP)) {
      let y = Math.round(clamp(gauss(tgt.pos === 'RB' ? 6 : tgt.pos === 'TE' ? 9 : 10.2 + pd * 0.12 + (tgt.r.spd - 80) * 0.08, 7), -3, 85));
      if (chance(0.032 + (tgt.r.spd - 75) * 0.001)) y += randi(15, 55);
      y = Math.min(y, 100 - gs.yard);
      st(gs, qb, 'pc'); st(gs, qb, 'py', y); st(gs, tgt, 'rec'); st(gs, tgt, 'rcy', y);
      gs.tstats[off].pass += y;
      if (gs.yard + y >= 100) { st(gs, qb, 'ptd'); st(gs, tgt, 'rctd'); logp(gs, `${pshort(qb)} TD pass to ${pshort(tgt)} (${y} yds)!`, true); }
      else st(gs, defTackler(), 'tk');
      if (chance(0.008)) { // fumble after catch
        st(gs, tgt, 'fum'); logp(gs, `${pshort(tgt)} FUMBLES! Recovered by the defense.`, true);
        applyPlay(gs, { turnover: { yard: 100 - Math.min(99, gs.yard + y) }, elapsed: rand(5, 8) }); return;
      }
      applyPlay(gs, { yards: y, elapsed: rand(5, 9), oob: chance(0.22) });
    } else {
      if (chance(0.25)) st(gs, weighted([...ld.CB.slice(0, 3), ...ld.S], p => p.r.cov), 'pd');
      applyPlay(gs, { yards: 0, inc: true, elapsed: rand(4, 7) });
    }
  } else {
    const rb = chance(0.82) ? lo.RB[0] : (lo.RB[1] || lo.RB[0]);
    const rd = O.run - D.rundef;
    let y = Math.round(clamp(gauss(3.7 + rd * 0.08 + (rb.r.btk - 75) * 0.02, 4.3), -5, 30));
    if (chance(0.025 + (rb.r.spd - 75) * 0.0012 + rd * 0.001)) y += randi(10, 60);
    y = Math.min(y, 100 - gs.yard);
    if (gs.yard + y <= 0) y = -gs.yard + 1;
    st(gs, rb, 'ra'); st(gs, rb, 'ry', y); gs.tstats[off].rush += y;
    if (gs.yard + y >= 100) { st(gs, rb, 'rtd'); logp(gs, `${pshort(rb)} runs it in for a TOUCHDOWN!`, true); }
    else st(gs, defTackler(), 'tk');
    if (chance(0.009)) {
      st(gs, rb, 'fum'); logp(gs, `${pshort(rb)} FUMBLES! Defense recovers.`, true);
      applyPlay(gs, { turnover: { yard: 100 - Math.min(99, Math.max(1, gs.yard + y)) }, elapsed: rand(4, 7) }); return;
    }
    applyPlay(gs, { yards: y, elapsed: rand(4, 7), oob: chance(0.1) });
  }
}

function simGame(L, hid, aid, opts = {}) {
  const gs = newGameState(L, hid, aid, opts);
  let guard = 0;
  while (!gs.over && guard++ < 600) simOnePlay(gs);
  if (!gs.over) gs.over = true;
  if (gs.playoff && gs.score[0] === gs.score[1]) gs.score[chance(0.5) ? 0 : 1] += 3;
  return gs;
}

// Sim until a condition (used by live game): stops when possession changes away from `untilPossNot`, or game over.
function simDrive(gs) {
  const startPoss = gs.poss, startQ = gs.quarter;
  let guard = 0;
  while (!gs.over && gs.poss === startPoss && guard++ < 40) {
    simOnePlay(gs);
    if ((startQ === 2 && gs.quarter === 3)) break;
  }
}
