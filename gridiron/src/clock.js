// ============================================================
// Gridiron Dynasty - two-minute drill: timeouts, spike, no-huddle,
// CPU clock management
// ============================================================
'use strict';

function useTimeout(gs, side) {
  if (!gs.timeouts || gs.timeouts[side] <= 0) return false;
  gs.timeouts[side]--;
  const saved = gs.lastRunoff || 0;
  if (saved > 0) gs.clock = Math.min(gs.qlen, gs.clock + saved);
  gs.lastRunoff = 0;
  logp(gs, `Timeout ${teamAbbr(gs, side)} (${gs.timeouts[side]} left)${saved ? ` — saved ${Math.round(saved)}s` : ''}`);
  return true;
}
function twoMinuteTime(gs) { return (gs.quarter === 2 || gs.quarter >= 4) && gs.clock <= 180; }

// spike: stop the clock right away at the cost of a down
LiveGame.prototype.spikeBall = function () {
  const gs = this.gs, saved = Math.max(0, (gs.lastRunoff || 0) - 6);
  gs.clock = Math.min(gs.qlen, gs.clock + saved); gs.lastRunoff = 0;
  st(gs, gs.lu[gs.poss].QB[0], 'pa');
  logp(gs, `${pshort(gs.lu[gs.poss].QB[0])} spikes the ball.`);
  applyPlay(gs, { yards: 0, inc: true, elapsed: 1 });
  this.result('Spiked', `Clock stopped at ${fmtClock(gs.clock)}`);
};
SPECIAL_PLAYS.push({ id: 'spike', name: 'Spike', type: 'special', desc: 'Stop the clock.' });
const _specialClock = LiveGame.prototype.special;
LiveGame.prototype.special = function (id) {
  if (id === 'spike') return this.spikeBall();
  return _specialClock.call(this, id);
};

// CPU uses timeouts late when it's behind (on defense to save time, on offense in the two-minute drill)
const _nextClock = LiveGame.prototype.next;
LiveGame.prototype.next = function () {
  const gs = this.gs;
  if (!gs.over && this.user >= 0 && (gs.lastRunoff || 0) > 10) {
    const cpu = 1 - this.user, behind = gs.score[cpu] < gs.score[this.user] || (gs.quarter === 2 && gs.poss === cpu);
    const late = (gs.quarter >= 4 && gs.clock < 150) || (gs.quarter === 2 && gs.clock < 60);
    if (late && behind && gs.timeouts[cpu] > 0 && (gs.score[this.user] - gs.score[cpu] <= 16 || gs.quarter === 2)) {
      if (useTimeout(gs, cpu) && this.h.toast) this.h.toast(`${this.teamOf(cpu).abbr} calls timeout. ${gs.timeouts[cpu]} left.`);
    }
  }
  if (gs.tmw) for (const q of [2, 4]) if (gs.tmw[q] && !(this._tmwShown || {})[q]) { (this._tmwShown = this._tmwShown || {})[q] = true; this.h.toast && this.h.toast('Two-minute warning'); }
  return _nextClock.call(this);
};
