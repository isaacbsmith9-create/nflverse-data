// ============================================================
// Gridiron Dynasty - 2-player head-to-head on one keyboard.
// Whoever has the ball plays offense; the other player controls a
// defender. Both call plays in secret.
//   P1 (home): WASD · Space action · Left Shift sprint · Q switch · 1-5 throw · T away · F/R/V/X/C moves
//   P2 (away): Arrows · Enter action · Right Shift sprint · / switch · 6-0 throw · . away · J/K/L/U/I moves
// ============================================================
'use strict';

const KS = {
  0: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: ['Space'], sprint: 'ShiftLeft', sw: ['KeyQ', 'KeyE'], away: ['KeyT'], thr: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'], mv: { KeyF: ['stiff', 'hit'], KeyR: ['spin', 'strip'], KeyV: ['hurdle'], KeyX: ['truck'], KeyC: ['hesi'] } },
  1: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: ['Enter', 'NumpadEnter'], sprint: 'ShiftRight', sw: ['Slash'], away: ['Period'], thr: ['Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'], mv: { KeyJ: ['stiff', 'hit'], KeyK: ['spin', 'strip'], KeyL: ['hurdle'], KeyU: ['truck'], KeyI: ['hesi'] } },
};
const TP_DOWN = new Set();
const LTP = LiveGame.prototype;

function tpAxis(lg, side) {
  const k = KS[side], d = TP_DOWN;
  const x = (d.has(k.right) ? 1 : 0) - (d.has(k.left) ? 1 : 0), y = (d.has(k.down) ? 1 : 0) - (d.has(k.up) ? 1 : 0);
  return lg.camMode === 'top' ? [x, y] : [-y, x];
}
// who is on defense this snap
LTP.defSide = function () { return 1 - this.gs.poss; };

const _nextTP = LTP.next;
LTP.next = function () {
  if (this.two && !this.gs.over) { this.user = this.gs.poss; this.diff = 0; this._defPick = null; this._offPick = null; }
  return _nextTP.call(this);
};
// secret play calling: offense picks, then the defense picks
const _chooseTP = LTP.choose;
LTP.choose = function (id) {
  if (!this.two || this.gs.over) return _chooseTP.call(this, id);
  const special = SPECIAL_PLAYS.some(p => p.id === id) || id === 'fakepunt' || id === 'fakefg';
  if (this._offPick == null && !special) {
    this._offPick = id; this.phase = 'call';
    const who = this.defSide() === 0 ? 'Player 1' : 'Player 2';
    showPlayCall('def');
    const h = document.querySelector('#playcall .pc-head h2'); if (h) h.textContent = `${who}: call your defense`;
    const n = document.querySelector('#playcall .pc-head'); if (n) n.insertAdjacentHTML('afterend', `<p class="small pill amber" style="display:inline-block">${this.defSide() === 0 ? 'Player 2' : 'Player 1'} — no peeking!</p>`);
    return;
  }
  if (this._offPick != null && !special) {
    const off = this._offPick, def = DEF_PLAYS.find(d => d.id === id) || cpuDefCall(this.gs); this._offPick = null;
    const keep = cpuDefCall; cpuDefCall = () => def;
    try { _chooseTP.call(this, off); } finally { cpuDefCall = keep; }
  } else _chooseTP.call(this, id);
  // the defending player starts on a linebacker
  if (this.D && this.D.LB) { this.ctrl2 = this.D.LB[0]; this.input2 = { mx: 0, my: 0, sprint: false, actionEdge: false, sw: false, move: null }; }
};
const _showPCtp = showPlayCall;
showPlayCall = function (mode, audible) {
  _showPCtp(mode, audible);
  const lg = GAME && GAME.live; if (!lg || !lg.two || mode !== 'off') return;
  const h = document.querySelector('#playcall .pc-head h2'); if (h) h.textContent = `${lg.gs.poss === 0 ? 'Player 1' : 'Player 2'}: call your play`;
  for (const b of document.querySelectorAll('#playcall [data-act="sim-drive"], #playcall [data-act="call-auto"]')) b.hidden = true;
};

// per-frame: route each keyboard half to the right player
const _updateTP = LTP.update;
LTP.update = function (dt) {
  if (this.two) {
    const off = this.gs.poss, def = 1 - off, inp = this.input;
    const [ox, oy] = tpAxis(this, off); inp.mx = ox; inp.my = oy; inp.sprint = TP_DOWN.has(KS[off].sprint);
    if (this.input2) { const [dx, dy] = tpAxis(this, def); this.input2.mx = dx; this.input2.my = dy; this.input2.sprint = TP_DOWN.has(KS[def].sprint); }
    if (this.phase === 'pre' && this.input2 && this.input2.sw) { this.input2.sw = false; this.cycleD2(); }
  }
  return _updateTP.call(this, dt);
};
LTP.cycleD2 = function () {
  const order = ['LB1', 'LB2', 'S1', 'S2', 'CB1', 'CB2', 'CB3', 'DL1', 'DL2', 'DL3', 'DL4'];
  if (this.phase === 'pre') { const i = order.indexOf(this.ctrl2 ? this.ctrl2.role : 'DL4'); this.ctrl2 = this.droles[order[(i + 1) % order.length]]; return; }
  const ref = this.ball || { x: this.los, y: this.gs.ballY };
  const c = this.ents.filter(e => e.side === 'D' && e !== this.ctrl2).sort((a, b) => this.dist(a, ref) - this.dist(b, ref))[0]; if (c) this.ctrl2 = c;
};
const _liveStepTP = LTP.liveStep;
LTP.liveStep = function (dt) {
  const c = this.ctrl2, i2 = this.input2;
  if (this.two && c && i2) {
    if (this.play.int) { this.ctrl2 = this.play.intBy; } // picked it off: player 2 runs it back
    if (i2.sw) { i2.sw = false; this.cycleD2(); }
    const car = this.carrier(), b = this.ball;
    if (i2.move) { const m = i2.move; i2.move = null; if (car && car.side !== c.side && this.dist(c, car) < 3.2) this.doMove(c, m === 'stiff' ? 'hit' : m === 'spin' ? 'strip' : m); }
    if (i2.actionEdge) {
      i2.actionEdge = false;
      if (c.eng && (c.moveCd || 0) <= this.t) { c.moveCd = this.t + 1.1; const bl = c.eng; if (chance(clamp(0.32 + (c.r.prs - bl.r.rbk) / 140, 0.1, 0.75))) { bl.eng = null; c.eng = null; c.freeT = 1.2; bl.stun = 0.45; this.flash('Rush move!'); } }
      else if (b && b.state === 'air') c.swat = 0.45; else if (c.stun <= 0) c.dive = 0.35;
    }
  }
  return _liveStepTP.call(this, dt);
};
// the defending player's stick steers his defender (otherwise he plays his assignment)
const _aiTP = LTP.ai;
LTP.ai = function (e, dt) {
  const i2 = this.input2;
  if (this.two && e === this.ctrl2 && i2 && Math.abs(i2.mx) + Math.abs(i2.my) > 0.15 && !e.eng && e.stun <= 0) {
    const m = Math.hypot(i2.mx, i2.my);
    this.steerDir(e, i2.mx / m, i2.my / m, (i2.sprint ? 1.0 : 0.86) * Math.min(1, m), dt);
    if (e.dive > 0) { e.vx *= 1.04; e.vy *= 1.04; }
    return;
  }
  return _aiTP.call(this, e, dt);
};

// keyboard: both halves handled here in 2-player games
window.addEventListener('keydown', e => {
  if (!GAME || !GAME.live.two || $('#game').hidden) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName)) return;
  if (e.code === 'Escape' || !$('#playcall').hidden || !$('#halftime').hidden) return; // menus work as usual
  const lg = GAME.live, off = lg.gs.poss, def = 1 - off;
  if (e.repeat) { e.stopImmediatePropagation(); e.preventDefault(); return; }
  TP_DOWN.add(e.code);
  const ko = KS[off], kd = KS[def], i = lg.input, i2 = lg.input2 || {};
  if (ko.act.includes(e.code)) i.actionEdge = true;
  if (ko.sw.includes(e.code)) i.sw = true;
  if (ko.away.includes(e.code)) i.throwAway = true;
  const ti = ko.thr.indexOf(e.code); if (ti >= 0 && lg.eligible) i.throwTo = lg.eligible[ti] || null;
  if (ko.mv[e.code]) i.move = ko.mv[e.code][0];
  if (kd.act.includes(e.code)) i2.actionEdge = true;
  if (kd.sw.includes(e.code)) i2.sw = true;
  if (kd.mv[e.code]) i2.move = kd.mv[e.code][kd.mv[e.code].length - 1];
  if (off === 0 && e.code === 'KeyP' && lg.phase === 'pre') showPlayCall('off', true);
  if (off === 0 && e.code === 'KeyH' && lg.phase === 'pre') openHotMenu();
  if (off === 0 && e.code === 'KeyM' && lg.phase === 'pre') lg.startMotion();
  e.stopImmediatePropagation(); e.preventDefault();
}, true);
window.addEventListener('keyup', e => { TP_DOWN.delete(e.code); }, true);
window.addEventListener('blur', () => TP_DOWN.clear());

// second selection ring for player 2's defender (3D view)
const _renderGLtp = LTP.renderGL;
if (_renderGLtp) LTP.renderGL = function (ctx, W, H) {
  const r = _renderGLtp.call(this, ctx, W, H);
  const S = this.gl;
  if (this.two && S && S.ring) {
    if (!this._ring2 || this._ring2.parent !== S.scene) { this._ring2 = S.ring.clone(); this._ring2.material = S.ring.material.clone(); this._ring2.material.color = new THREE.Color('#4dd7ff').convertSRGBToLinear(); S.scene.add(this._ring2); }
    const c2 = this.ctrl2; this._ring2.visible = !!c2 && this.phase !== 'call'; if (c2) this._ring2.position.copy(W2T(c2.x, c2.y, 0.05));
  }
  return r;
};

// start a 2-player game
function twoPlayerModal() {
  const L = freshLeague();
  PR_TMP = L;
  modal(`<div class="modal-head"><h2>2 Players</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p class="small">Head-to-head on one keyboard. Whoever has the ball plays offense; the other player controls a defender. Plays are called in secret.</p>
    <div class="stack"><label>Player 1 (home) <select id="tpA">${teamOpts(L, 0)}</select></label><label>Player 2 (away) <select id="tpB">${teamOpts(L, 7)}</select></label>
    <label>Quarter length <select id="tpQ"><option value="120">2 min</option><option value="180" selected>3 min</option><option value="300">5 min</option></select></label></div>
    <div class="tp-keys"><div><b>Player 1</b><br>Move <kbd>WASD</kbd> · Action <kbd>Space</kbd> · Sprint <kbd>L-Shift</kbd><br>Switch <kbd>Q</kbd> · Throw <kbd>1</kbd>–<kbd>5</kbd> · Away <kbd>T</kbd><br>Moves <kbd>F</kbd> <kbd>R</kbd> <kbd>V</kbd> <kbd>X</kbd> <kbd>C</kbd></div>
    <div><b>Player 2</b><br>Move <kbd>Arrows</kbd> · Action <kbd>Enter</kbd> · Sprint <kbd>R-Shift</kbd><br>Switch <kbd>/</kbd> · Throw <kbd>6</kbd>–<kbd>0</kbd> · Away <kbd>.</kbd><br>Moves <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>U</kbd> <kbd>I</kbd></div></div>
    <button class="btn primary" data-act="tp-go">Kick off</button>`);
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.dataset.act === 'two-player') twoPlayerModal();
  if (el.dataset.act === 'tp-go') {
    const L = PR_TMP, a = +$('#tpA').value; let b = +$('#tpB').value; if (a === b) b = (a + 1) % L.teams.length;
    L.userTid = a; L.settings.simDef = false; L.settings.qlen = +$('#tpQ').value; L.settings.diff = 'pro'; L.superstar = null;
    LEAGUE = L; EXHIB = true; closeModal();
    startLiveGame(a, b, a, { exhibition: true, two: true });
    GAME.live.two = true; GAME.gs.liveUser = null; GAME.live.diff = 0;
    toast('2 players: P1 = WASD + Space · P2 = Arrows + Enter');
  }
});
