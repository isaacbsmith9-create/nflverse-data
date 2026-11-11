// ============================================================
// Gridiron Dynasty - penalties: offsides, false start, holding (both
// sides), defensive pass interference. Flags shown in the result banner.
// ============================================================
'use strict';

const LP = LiveGame.prototype;
const pensOn = lg => !(lg.L && lg.L.settings && lg.L.settings.penalties === false);

// pre-snap: defense jumps offsides, CPU offense false starts (you control your own snap)
const _snapPen = LP.snap;
LP.snap = function () {
  if (this.phase !== 'pre' || !pensOn(this) || !this.O) return _snapPen.call(this);
  const r = Math.random();
  if (r < 0.012) return this.preSnapFlag('D', 'Offsides', this.D.DL[randi(0, 3)]);
  if (r < 0.022 && !this.userOnOffense()) return this.preSnapFlag('O', 'False start', this.O.OL[randi(0, 4)]);
  return _snapPen.call(this);
};
LP.preSnapFlag = function (on, name, who) {
  const gs = this.gs; sfx('whistle');
  const pen = { on, yds: 5, name, who };
  this.enforce(pen);
  this.flagBanner(pen, true);
};

// during the play: decided when the whistle blows
const _endPen = LP.endPlay;
LP.endPlay = function (kind, msg) {
  if (this.phase !== 'live' || !pensOn(this) || !this.O || this.play.int) return _endPen.call(this, kind, msg);
  const pen = this.rollPenalty(kind);
  if (!pen) return _endPen.call(this, kind, msg);
  sfx('whistle');
  this.enforce(pen);
  this.flagBanner(pen, false, kind === 'td');
};

LP.rollPenalty = function (kind) {
  const pl = this.play, c = this.carrier(), gain = c ? c.x - this.los : 0;
  // defensive pass interference on a contested incompletion
  if (kind === 'inc' && pl.target && !pl.throwAway && this.ball) {
    const tx = this.ball.tx, ty = this.ball.ty;
    const d = this.ents.filter(e => e.side === 'D').sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty))[0];
    if (d && Math.hypot(d.x - pl.target.x, d.y - pl.target.y) < 1.3 && tx - this.los > 3 && chance(0.2 - d.r.cov / 1000)) {
      return { on: 'D', name: 'Pass interference', who: d, spot: Math.round(tx - this.los), auto: true };
    }
  }
  // offensive holding: only when blocks were set, declined if the play already lost a lot
  const blocked = this.ents.some(e => e.side === 'O' && e.eng) || this.t > 1.2;
  if (blocked && chance(0.03) && gain > -8) {
    const who = pick(this.O.OL);
    return { on: 'O', yds: 10, name: 'Holding', who };
  }
  // defensive holding on pass plays, accepted when the play gained less than 5
  if (this.passReady && chance(0.015) && (kind === 'inc' || gain < 5)) {
    return { on: 'D', yds: 5, name: 'Defensive holding', who: pick(this.D.CB), auto: true };
  }
  return null;
};

// move the ball for a penalty and replay the down (or give a first down)
LP.enforce = function (pen) {
  const gs = this.gs, off = gs.poss, def = 1 - off;
  let yds;
  if (pen.on === 'O') {
    yds = Math.min(pen.yds, Math.floor(gs.yard / 2) || 1);
    gs.yard -= yds; gs.togo += yds;
  } else {
    yds = pen.spot != null ? Math.max(1, pen.spot) : pen.yds;
    yds = Math.min(yds, pen.spot != null ? 99 - gs.yard : Math.max(1, Math.floor((100 - gs.yard) / 2)));
    gs.yard = Math.min(99, gs.yard + yds);
    if (pen.auto || gs.togo - yds <= 0) { gs.down = 1; gs.togo = Math.min(10, 100 - gs.yard); }
    else gs.togo -= yds;
  }
  pen.applied = yds;
  const side = pen.on === 'O' ? off : def;
  gs.pens[side][0]++; gs.pens[side][1] += yds;
  logp(gs, `FLAG: ${pen.name}, ${teamAbbr(gs, side)}${pen.who ? ' #' + pen.who.p.num : ''} — ${yds} yards${pen.auto && pen.on === 'D' ? ', automatic first down' : ''}.`);
  if (this.phase === 'live') runClock(gs, Math.max(3, Math.min(this.t, 12)));
  gs.lastRunoff = 0;
};
LP.flagBanner = function (pen, pre, calledBackTD) {
  const gs = this.gs, side = pen.on === 'O' ? gs.poss : 1 - gs.poss;
  const sub = `${this.teamOf(side).abbr}${pen.who ? ' #' + pen.who.p.num : ''} · ${pen.applied} yards${pen.on === 'D' && pen.auto ? ' · automatic first down' : pre ? ' · replay the down' : ' · repeat the down'}${calledBackTD ? ' · touchdown called back' : ''}`;
  this.result(`FLAG: ${pen.name}`, sub);
  if (this.banner) this.banner.flag = true;
};
