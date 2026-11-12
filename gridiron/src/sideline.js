// ============================================================
// Gridiron Dynasty - receivers play the sideline like real players:
// out-breaking routes stop at the boundary, vertical routes turn
// upfield along it, nobody wanders out of bounds, receivers work back
// to the QB when he scrambles, and ball carriers use the sideline smartly.
// ============================================================
'use strict';

const SIDE_M = 2; // yards a route stays inside the sideline

// keep a route's shape but bend it where it would leave the field
function sidelineFix(pts, sx, sy) {
  const lo = SIDE_M, hi = FIELD_W - SIDE_M, out = [];
  let px = sx, py = sy, ox = sx, oy = sy;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0, f] = pts[i];
    const dx = x0 - ox, dy = y0 - oy; ox = x0; oy = y0;
    let nx = px + dx, ny = py + dy, flag = f;
    if (ny < lo || ny > hi) {
      const edge = ny < lo ? lo : hi;
      const t = dy ? clamp((edge - py) / dy, 0, 1) : 0;
      const ix = px + dx * t, remX = dx * (1 - t), remY = Math.abs(dy) * (1 - t);
      ny = edge;
      if (Math.abs(dy) > Math.abs(dx)) { // out / flat breaking toward the sideline: plant at the boundary
        nx = ix + Math.max(0, remX) * 0.5;
        if (i === pts.length - 1) flag = 's';
      } else nx = ix + Math.max(0, remX) + remY * 0.6; // fade / corner: bend upfield along the sideline
    }
    if (out.length && Math.hypot(nx - px, ny - py) < 0.6) { if (flag === 's') out[out.length - 1][2] = 's'; px = nx; py = ny; continue; }
    out.push([nx, ny, flag]); px = nx; py = ny;
  }
  if (!out.length) out.push([sx + 1, clamp(sy, lo, hi), 's']);
  return out;
}
const _routePtsSL = LiveGame.prototype.routePts;
LiveGame.prototype.routePts = function (name, sx, sy, by) {
  return sidelineFix(_routePtsSL.call(this, name, sx, sy, by), sx, sy);
};

// is the QB scrambling (out of the pocket, ball still in his hands)?
LiveGame.prototype.scrambling = function () {
  const pl = this.play, q = this.passer;
  if (!q || pl.thrown || pl.crossed || this.carrier() !== q || !this.passReady) return false;
  return this.qbScramble || (this.t > 1 && Math.abs(q.y - this.gs.ballY) > 4.5);
};

const _aiRouteSL = LiveGame.prototype.aiRoute;
LiveGame.prototype.aiRoute = function (e, tk, dt) {
  const lo = SIDE_M, hi = FIELD_W - SIDE_M;
  // scramble drill: once the route is run (or the play breaks down), work back to the QB's side
  if (this.scrambling() && (tk.i >= tk.pts.length || this.t > 2.4)) {
    const q = this.passer, deep = e.x - this.los > 14;
    const side = Math.sign(q.y - this.gs.ballY) || 1;
    let tx, ty;
    if (deep) { tx = e.x + 3; ty = e.y + side * 1.2; } // deep guys keep stretching, drifting with the QB
    else { tx = Math.max(this.los + 4, Math.min(e.x, q.x + 9)); ty = q.y + side * 4 + (e.y - q.y) * 0.4; } // short guys come back toward him
    if (tk.i < tk.pts.length) tk.i = tk.pts.length; // break off the route
    return this.steer(e, Math.min(tx, 118), clamp(ty, lo, hi), deep ? 0.95 : 0.85, dt);
  }
  // route finished: keep running logically instead of into the stands
  if (tk.i >= tk.pts.length && tk.pts.length) {
    const last = tk.pts[tk.pts.length - 1];
    if (last[2] === 's') {
      const d = this.nearest(e, 'D'); let ty = last[1];
      if (d && this.dist(d, e) < 3) ty += (e.y - d.y) > 0 ? 1.2 : -1.2;
      return this.steer(e, last[0], clamp(ty, lo, hi), 0.5, dt);
    }
    const prev = tk.pts.length > 1 ? tk.pts[tk.pts.length - 2] : [e.x - 1, e.y];
    const dx = last[0] - prev[0], dy = last[1] - prev[1], m = Math.hypot(dx, dy) || 1;
    let tx = e.x + dx / m * 5, ty = e.y + dy / m * 5;
    if (ty < lo + 1 || ty > hi - 1) { ty = clamp(ty, lo + 0.5, hi - 0.5); tx = e.x + 5; } // reached the sideline: turn upfield
    return this.steer(e, Math.min(tx, 118), ty, 0.97, dt);
  }
  return _aiRouteSL.call(this, e, tk, dt);
};

// ball carriers: stay in bounds and fight for yards, unless the clock says get out
LiveGame.prototype.aiCarrier = function (e, dt) {
  const gs = this.gs, dir = e.side === 'O' ? 1 : -1, foe = e.side === 'O' ? 'D' : 'O';
  const mySide = e.side === 'O' ? gs.poss : 1 - gs.poss;
  const late = (gs.quarter === 2 || gs.quarter >= 4) && gs.clock - this.t < 150;
  const wantOut = late && gs.score[mySide] <= gs.score[1 - mySide];
  let best = null, bs = -1e9;
  for (let a = -80; a <= 80; a += 10) {
    const ang = a * Math.PI / 180, ux = Math.cos(ang) * dir, uy = Math.sin(ang);
    let s = Math.cos(ang) * (this._fwdW || 3);
    const px = e.x + ux * 4, py = e.y + uy * 4;
    const edgeDist = Math.min(py, FIELD_W - py);
    if (edgeDist < 2.2) s -= wantOut ? 0 : 5 + (2.2 - edgeDist) * 4; // the sideline is a defender
    let close = 99;
    for (const d of this.ents) {
      if (d.side !== foe) continue;
      const dd = Math.hypot(d.x - px, d.y - py); close = Math.min(close, Math.hypot(d.x - e.x, d.y - e.y));
      const w = d.eng ? 0.45 : d.stun > 0 ? 0.3 : 1.2;
      if (dd < 7) s -= (7 - dd) * w;
    }
    // two-minute drill: get out of bounds when a tackle is coming
    if (wantOut && Math.min(e.y, FIELD_W - e.y) < 7 && close < 5 && edgeDist < Math.min(e.y, FIELD_W - e.y)) s += 4;
    if (s > bs) { bs = s; best = [ux, uy]; }
  }
  this.steerDir(e, best[0], best[1], 0.93, dt);
};
