// ============================================================
// Gridiron Dynasty - extra point or go for two (played live), smarter
// CPU two-point decisions, and Watch mode (CPU vs CPU, live).
// ============================================================
'use strict';

// CPU: chart-style two-point decisions late in games (replaces the old rule)
function cpuGoesForTwo(gs, side) {
  const diff = gs.score[side] - gs.score[1 - side]; // after the TD, before the try
  if (gs.quarter < 4 && !(gs.quarter === 3 && gs.clock < 300)) return false;
  return [-2, -5, -9, -10, -12, -13, 1, 5, 12].includes(diff);
}
const _patG = pat;
pat = function (gs, side) {
  const human = gs.liveUser != null && gs.liveUser >= 0 ? side === gs.liveUser : !!gs.two;
  if (gs.livePAT && !gs.over) { gs.patPending = { side, human, cpu2: !human && cpuGoesForTwo(gs, side) }; return; }
  if (cpuGoesForTwo(gs, side)) {
    if (chance(0.48)) { gs.score[side] += 2; logp(gs, 'Two-point conversion is GOOD.', true); } else logp(gs, 'Two-point conversion fails.');
    return;
  }
  const k = gs.lu[side].K[0], p = clamp(0.88 + (k.r.kac - 70) / 300, 0.8, 0.99);
  st(gs, k, 'xpa');
  if (chance(p)) { gs.score[side] += 1; st(gs, k, 'xpm'); } else logp(gs, 'Extra point is NO GOOD!');
};
// hold the kickoff until the try is done
const _kickoffG = kickoff;
kickoff = function (gs, recv, silent) {
  if (gs.patPending && !silent) { gs.koPending = recv; return; }
  return _kickoffG(gs, recv, silent);
};
function finishTry(gs) {
  const r = gs.koPending; gs.koPending = null; gs.twoTry = null;
  if (r != null && !gs.over) kickoff(gs, r);
}
// a live two-point try: one snap from the 2, no clock
const _applyPlayG = applyPlay;
applyPlay = function (gs, res) {
  const T = gs.twoTry; if (!T) return _applyPlayG(gs, res);
  const good = !res.turnover && !res.inc && gs.yard + (res.yards || 0) >= 100;
  if (good) { gs.score[T.side] += 2; logp(gs, 'TWO-POINT CONVERSION IS GOOD!', true); } else logp(gs, 'Two-point try fails.');
  gs.lastTry = good;
  checkOT(gs); finishTry(gs);
};
const LG2 = LiveGame.prototype;
const _nextG2 = LG2.next;
LG2.next = function () {
  const gs = this.gs;
  if (this.user < 0 && !this.two) gs.livePAT = false;
  if (gs.patPending) {
    const P = gs.patPending;
    if (gs.over) { gs.patPending = null; _patG(gs, P.side); gs.koPending = null; return _nextG2.call(this); }
    if (P.human) return this.showPAT(P.side);
    gs.patPending = null;
    if (P.cpu2 && this.user >= 0) return this.startTwo(P.side); // CPU goes for two: you defend it live
    _patG(gs, P.side); finishTry(gs);
  }
  if (gs.twoTry && this.phase !== 'live') { /* try finished via applyPlay */ }
  return _nextG2.call(this);
};
LG2.showPAT = function (side) {
  this.ents = []; this.ball = null; this.phase = 'call';
  const gs = this.gs, k = gs.lu[side].K[0], p = Math.round(clamp(0.88 + (k.r.kac - 70) / 300, 0.8, 0.99) * 100);
  const diff = gs.score[side] - gs.score[1 - side];
  const el = $('#playcall');
  el.innerHTML = `<div class="pc-inner wrap"><div class="pc-head"><h2>${this.two ? (side === 0 ? 'Player 1: ' : 'Player 2: ') : ''}Touchdown! Now what?</h2><span class="pill amber">${diff > 0 ? 'Up ' + diff : diff < 0 ? 'Down ' + -diff : 'Tied'} · ${gs.quarter <= 4 ? 'Q' + gs.quarter : 'OT'} ${fmtClock(gs.clock)}</span></div>
    <div class="plays"><button class="play special" data-act="pat-kick"><span class="tag">1 point</span><span class="pn">Extra point</span><span class="pd">${esc(pshort(k))} makes these about ${p}% of the time.</span></button>
    <button class="play special" data-act="pat-two"><span class="tag">2 points</span><span class="pn">Go for two</span><span class="pd">One play from the 2-yard line. Call any play.</span></button></div></div>`;
  el.hidden = false;
};
LG2.startTwo = function (side) {
  const gs = this.gs; gs.patPending = null;
  gs.twoTry = { side }; gs.poss = side; gs.yard = 98; gs.down = 1; gs.togo = 2; gs.ballY = MID_Y;
  this.h.toast && this.h.toast(`${teamAbbr(gs, side)} going for two!`);
  return _nextG2.call(this);
};
// no clock on tries
const _runClockG = runClock;
runClock = function (gs, sec) { if (gs.twoTry) return false; return _runClockG(gs, sec); };
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !GAME) return;
  const lg = GAME.live, gs = lg.gs, P = gs.patPending; if (!P) return;
  if (el.dataset.act === 'pat-kick') { $('#playcall').hidden = true; gs.patPending = null; _patG(gs, P.side); finishTry(gs); lg.h.update(); lg.result(gs.log[gs.log.length - 1] && /NO GOOD/.test(gs.log[gs.log.length - 1].txt) ? 'Extra point NO GOOD' : 'Extra point is good', ''); }
  if (el.dataset.act === 'pat-two') { $('#playcall').hidden = true; lg.startTwo(P.side); }
});
// two-point banners
const _resultG2 = LG2.result;
LG2.result = function (title, sub, big) {
  const gs = this.gs;
  if (gs.lastTry != null) { const g = gs.lastTry; gs.lastTry = null; return _resultG2.call(this, g ? 'TWO-POINT CONVERSION!' : 'Two-point try fails', sub, g); }
  return _resultG2.call(this, title, sub, big);
};
// live games handle the try themselves
const _startLiveG2 = startLiveGame;
startLiveGame = function (hid, aid, userTid, opts = {}) {
  _startLiveG2(hid, aid, userTid, opts);
  if (GAME) { GAME.gs.livePAT = true; if (opts.two) GAME.gs.two = true; if (opts.watch) { const lg = GAME.live; lg.user = -1; lg.ctrl = null; GAME.gs.liveUser = null; GAME.gs.livePAT = false; lg.watch = true; } }
};

// ---------------- Watch mode ----------------
function watchModal() {
  const L = freshLeague(); PR_TMP = L;
  modal(`<div class="modal-head"><h2>Watch a game</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p class="small">Sit back and watch two teams play it out live. Space skips to the next play, Esc pauses.</p>
    <div class="stack"><label>Home <select id="wA">${teamOpts(L, 0)}</select></label><label>Away <select id="wB">${teamOpts(L, 9)}</select></label>
    <button class="btn primary" data-act="watch-go">Start</button></div>`);
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.dataset.act === 'watch') watchModal();
  if (el.dataset.act === 'watch-go') {
    const L = PR_TMP, a = +$('#wA').value; let b = +$('#wB').value; if (a === b) b = (a + 1) % L.teams.length;
    L.userTid = a; L.superstar = null; LEAGUE = L; EXHIB = true; closeModal();
    startLiveGame(a, b, a, { exhibition: true, watch: true });
  }
  if (el.dataset.act === 'watch-mine' && LEAGUE) { const g = userGame(LEAGUE); if (g) startLiveGame(g.h, g.a, LEAGUE.userTid, { playoff: LEAGUE.phase === 'playoffs', watch: true }); }
});
// franchise: "Watch it" next to Play on the home card
const _homeGameCardG2 = homeGameCard;
homeGameCard = function () {
  const h = _homeGameCardG2();
  return h.replace(/(<button[^>]*data-act="play-game"[^>]*>[^<]*<\/button>)/, '$1<button class="btn" data-act="watch-mine">Watch it</button>');
};

// simulated drives decide their own tries instantly
for (const fn of ['simDrive', 'simOnePlay']) {
  const orig = globalThis[fn] || (fn === 'simDrive' ? simDrive : simOnePlay);
  const wrapped = function (gs, ...a) { const lp = gs.livePAT; gs.livePAT = false; try { return orig(gs, ...a); } finally { gs.livePAT = lp; } };
  if (fn === 'simDrive') simDrive = wrapped; else simOnePlay = wrapped;
}
// a two-point try doesn't count toward season stats
const _endPlayG2 = LG2.endPlay;
LG2.endPlay = function (kind, msg) {
  if (!this.gs.twoTry || this.phase !== 'live') return _endPlayG2.call(this, kind, msg);
  const keep = JSON.stringify(this.gs.box); const r = _endPlayG2.call(this, kind, msg); this.gs.box = JSON.parse(keep); return r;
};
