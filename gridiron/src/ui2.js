// ============================================================
// Gridiron Dynasty - UI glue for the newer features: extra hub tabs,
// pre-snap buttons and keys, weather chip/effects, setup screen fields.
// ============================================================
'use strict';

Object.assign(EXTRA_VIEWS, { star: viewStar, rankings: viewRankings, locker: viewLocker, staff: viewStaff, owner: viewOwner });

const _updateHUD2 = updateHUD;
updateHUD = function () {
  _updateHUD2();
  if (!GAME) return;
  const lg = GAME.live, pre = lg.phase === 'pre' && $('#playcall').hidden && $('#hotMenu').hidden;
  const db = document.getElementById('defBtns'); if (db) db.hidden = !(pre && lg.userOnDefense() && !lg.starMode());
  const mb = document.getElementById('motionBtn'); if (mb) mb.hidden = !lg.canMotion();
  const pb = document.getElementById('preBtns'); if (pb && lg.starMode() === 'off') pb.hidden = true;
  const sb = document.getElementById('scorebug');
  if (sb && GAME.gs.weather && !sb.querySelector('.wx-chip')) sb.insertAdjacentHTML('beforeend', `<div class="wx-chip">${wxLabel(GAME.gs)}</div>`);
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !GAME) return;
  const lg = GAME.live;
  if (el.dataset.act === 'motion') { if (lg.startMotion()) updateHUD(); }
  if (el.dataset.act === 'dadj') lg.defAdjust(el.dataset.k);
});
document.addEventListener('keydown', e => {
  if (!GAME || GAME.paused) return; const lg = GAME.live;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (lg.phase !== 'pre') return;
  if (e.code === 'KeyM' && lg.userOnOffense()) { if (lg.startMotion()) updateHUD(); }
  if (lg.userOnDefense() && !lg.starMode()) {
    if (e.code === 'KeyB') lg.defAdjust('blitz');
    if (e.code === 'KeyC') lg.defAdjust('press');
    if (e.code === 'Comma') lg.defAdjust('left');
    if (e.code === 'Period') lg.defAdjust('right');
  }
});

// weather effects start with each game
const _startLive2 = startLiveGame;
startLiveGame = function (hid, aid, userTid, opts) {
  _startLive2(hid, aid, userTid, opts);
  if (GAME && GAME.gs.weather) { const w = GAME.gs.weather; if (w.k !== 'clear' && w.k !== 'dome') setTimeout(() => toast(`Weather: ${wxLabel(GAME.gs)}. ${w.k === 'wind' ? 'Kicks and deep balls will drift.' : 'Slick ball — protect it and expect drops.'}`, 3500), 2200); requestAnimationFrame(wxLoop); }
};

// superstar fields on the setup screen
document.addEventListener('change', e => {
  if (e.target.id === 'setSS') { const f = document.getElementById('ssFields'); if (f) f.hidden = !e.target.checked; }
});
