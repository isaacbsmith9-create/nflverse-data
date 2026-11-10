// ============================================================
// Gridiron Dynasty - broadcast camera renderer
// Perspective view from behind the offense: downfield = up the screen,
// the offense's right (+y) = screen right. Players drawn as animated figures.
// ============================================================
'use strict';

LiveGame.prototype.render2D = LiveGame.prototype.render;
LiveGame.prototype.render = function (ctx, W, H) {
  if (this.camMode === 'top') return this.render2D(ctx, W, H);
  return this.render3D(ctx, W, H);
};

// project ground point (x, y) at height h (yards) -> screen
LiveGame.prototype.proj = function (x, y, h = 0) {
  const c = this.c3; const z = x - c.camX;
  if (z < 0.9) return null;
  const s = c.F / z;
  return { x: c.W / 2 + (y - c.camY) * s, y: c.hor + (c.camH - h) * s, k: s, z };
};

let _crowdCache = null;
function crowdCanvas(W, Hh, c1, c2) {
  const key = W + 'x' + Hh + c1 + c2;
  if (_crowdCache && _crowdCache.key === key) return _crowdCache.cv;
  const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(Math.max(1, W), Math.max(1, Hh)) : Object.assign(document.createElement('canvas'), { width: W, height: Hh });
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, Hh);
  grd.addColorStop(0, '#05080d'); grd.addColorStop(0.55, '#101722'); grd.addColorStop(1, '#1a2230');
  g.fillStyle = grd; g.fillRect(0, 0, W, Hh);
  // stadium lights
  for (let i = 0; i < 6; i++) {
    const lx = (i + 0.5) * W / 6, ly = Hh * 0.08;
    const rg = g.createRadialGradient(lx, ly, 0, lx, ly, W * 0.12);
    rg.addColorStop(0, 'rgba(255,250,225,.55)'); rg.addColorStop(1, 'rgba(255,250,225,0)');
    g.fillStyle = rg; g.fillRect(lx - W * 0.12, 0, W * 0.24, Hh * 0.5);
  }
  // fans: rows of dots, bigger toward the bottom; sprinkle home colors
  const palette = [c1, c2, c1, '#d9d9d9', '#8a8f99', '#c7b9a6', c1, '#3b4250'];
  for (let row = 0; row < 26; row++) {
    const t = row / 25, y = Hh * (0.22 + t * 0.72), r = 1 + t * 2.6, gap = r * 2.6;
    for (let x = (row % 2) * gap / 2; x < W; x += gap) {
      g.globalAlpha = 0.35 + t * 0.6;
      g.fillStyle = palette[(Math.random() * palette.length) | 0];
      g.beginPath(); g.arc(x + Math.random() * 1.5, y + Math.random() * 1.5, r, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
  // advertising-free wall band in team colors
  g.fillStyle = c1; g.fillRect(0, Hh - Math.max(6, Hh * 0.07), W, Math.max(6, Hh * 0.07));
  g.fillStyle = c2; g.fillRect(0, Hh - Math.max(6, Hh * 0.07), W, 2);
  _crowdCache = { key, cv };
  return cv;
}

LiveGame.prototype.render3D = function (ctx, W, H) {
  const gs = this.gs;
  const F = Math.min(0.31 * W, 0.6 * H), hor = H * 0.2;
  const nearZ = 10, camH = (H * 0.97 - hor) * nearZ / F;
  const cy = clamp(this.cam.y, MID_Y - 12, MID_Y + 12);
  // pull back while the QB is in the pocket / pre-snap, tighten up once the ball is out
  const pocket = this.phase === 'pre' || this.phase === 'call' || (this.phase === 'live' && this.carrier() === this.passer && this.passReady && !this.play.crossed);
  this.backT = (this.backT == null ? 28 : this.backT) + ((pocket ? 28 : 19) - (this.backT == null ? 28 : this.backT)) * 0.06;
  this.c3 = { F, hor, camH, W, H, camX: this.cam.x - this.backT, camY: this.c3 ? this.c3.camY + (cy - this.c3.camY) * 0.08 : cy };
  const P = (x, y, h) => this.proj(x, y, h);
  const homeT = this.teamOf(0);
  // ---- sky + crowd ----
  ctx.drawImage(crowdCanvas(Math.ceil(W), Math.ceil(hor + 2), homeT.c1, homeT.c2), 0, 0);
  // ---- ground (sideline area) ----
  ctx.fillStyle = '#1b4d26'; ctx.fillRect(0, hor, W, H - hor);
  const poly = (pts, fill) => {
    const pp = []; for (const [x, y] of pts) { const p = P(x, y); if (!p) return; pp.push(p); }
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pp[0].x, pp[0].y); for (let i = 1; i < pp.length; i++) ctx.lineTo(pp[i].x, pp[i].y); ctx.closePath(); ctx.fill();
  };
  const x0 = this.c3.camX + 1;
  // field stripes (clip each band at the near plane)
  for (let x = 0; x < 120; x += 5) {
    const a = Math.max(x, x0), b = x + 5; if (b <= a) continue;
    let col;
    if (x < 10) col = this.teamOf(gs.poss).c1; else if (x >= 110) col = this.teamOf(1 - gs.poss).c1;
    else col = ((x - 10) / 5) % 2 ? '#2f8a3e' : '#2a7d38';
    poly([[a, 0], [a, FIELD_W], [b, FIELD_W], [b, 0]], col);
  }
  // far stands behind the end zone sit on the horizon already; draw a dark apron beyond the back line
  // painted ground line: a thin quad in world space, so it narrows correctly with distance
  const line = (xa, ya, xb, yb, w, col) => {
    const zmin = this.c3.camX + 1;
    if (xa < zmin && xb < zmin) return;
    if (xa < zmin) { const t = (zmin - xa) / (xb - xa); ya += (yb - ya) * t; xa = zmin; }
    if (xb < zmin) { const t = (zmin - xb) / (xa - xb); yb += (ya - yb) * t; xb = zmin; }
    const dx = xb - xa, dy = yb - ya, m = Math.hypot(dx, dy) || 1, nx = -dy / m * w / 2, ny = dx / m * w / 2;
    const q = [P(xa + nx, ya + ny), P(xb + nx, yb + ny), P(xb - nx, yb - ny), P(xa - nx, ya - ny)];
    if (q.some(v => !v)) return;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(q[i].x, q[i].y); ctx.closePath(); ctx.fill();
  };
  const chalk = 'rgba(255,255,255,.88)';
  for (let x = Math.max(0, Math.ceil(x0 / 5) * 5); x <= 120; x += 5) line(x, 0, x, FIELD_W, 0.12, chalk);
  line(Math.max(0, x0), 0, 120, 0, 0.15, chalk); line(Math.max(0, x0), FIELD_W, 120, FIELD_W, 0.15, chalk);
  for (let x = Math.max(11, Math.ceil(x0)); x < 110; x++) {
    if (x % 5 === 0) continue;
    for (const hy of [0.6, HASH_L, HASH_R, FIELD_W - 0.6]) line(x, hy - 0.4, x, hy + 0.4, 0.09, 'rgba(255,255,255,.7)');
  }
  // squashed ground text
  const groundText = (txt, x, y, sizeYds, col, rot) => {
    const p = P(x, y); if (!p || p.k < 1.5) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, Math.min(0.55, 4.5 / p.z + 0.12)); if (rot) ctx.rotate(rot);
    ctx.fillStyle = col; ctx.font = `800 ${Math.round(sizeYds * p.k)}px 'Saira Condensed', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, 0, 0); ctx.restore();
  };
  for (let x = 20; x <= 100; x += 10) {
    if (x < x0 + 2) continue;
    const n = x <= 60 ? x - 10 : 110 - x;
    groundText(String(n), x, 9, 2.2, 'rgba(255,255,255,.85)');
    groundText(String(n), x, FIELD_W - 9, 2.2, 'rgba(255,255,255,.85)');
  }
  if (60 > x0 + 3) { // midfield emblem
    const p = P(60, MID_Y);
    const img = typeof emblemImage === 'function' ? emblemImage(homeT) : null;
    if (p && img) { ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, Math.min(0.55, 4.5 / p.z + 0.12)); const s = 9.5 * p.k; ctx.globalAlpha = 0.92; ctx.drawImage(img, -s / 2, -s / 2, s, s); ctx.restore(); }
    else if (p) { ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, Math.min(0.55, 4.5 / p.z + 0.12)); ctx.fillStyle = homeT.c1; ctx.strokeStyle = homeT.c2; ctx.lineWidth = 0.35 * p.k;
      ctx.beginPath(); ctx.arc(0, 0, 4.2 * p.k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = homeT.c2; ctx.font = `800 ${Math.round(3.2 * p.k)}px 'Saira Condensed', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(homeT.abbr, 0, 0.2 * p.k); ctx.restore(); }
  }
  if (115 > x0) groundText(this.teamOf(1 - gs.poss).name.toUpperCase(), 115, MID_Y, 5, 'rgba(255,255,255,.9)');
  if (5 > x0 + 1) groundText(this.teamOf(gs.poss).name.toUpperCase(), 5, MID_Y, 5, 'rgba(255,255,255,.9)');
  // goal posts at the far end
  const gp = P(120, MID_Y);
  if (gp) {
    const k = gp.k; const base = P(120, MID_Y, 3.3), lt = P(120, MID_Y - 3.1, 3.3), rt = P(120, MID_Y + 3.1, 3.3), lu = P(120, MID_Y - 3.1, 11), ru = P(120, MID_Y + 3.1, 11);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(2, 0.25 * k); ctx.beginPath();
    ctx.moveTo(gp.x, gp.y); ctx.lineTo(base.x, base.y); ctx.moveTo(lt.x, lt.y); ctx.lineTo(rt.x, rt.y); ctx.moveTo(lt.x, lt.y); ctx.lineTo(lu.x, lu.y); ctx.moveTo(rt.x, rt.y); ctx.lineTo(ru.x, ru.y); ctx.stroke();
  }
  // LOS + first down
  if (['pre', 'live', 'call', 'kick'].includes(this.phase)) {
    const los = this.los || 10 + gs.yard;
    line(los, 0, los, FIELD_W, 0.35, 'rgba(70,150,255,.95)');
    const fd = this.firstX || Math.min(110, los + gs.togo);
    if (fd < 110) line(fd, 0, fd, FIELD_W, 0.35, 'rgba(255,214,0,.95)');
  }
  // route art
  const showArt = this.userOnOffense() && (this.phase === 'pre' || (this.phase === 'live' && this.t < 0.8));
  if (showArt && this.O) {
    for (const k of ['WR1', 'WR2', 'WR3', 'TE', 'RB']) {
      const e = this.O[k]; const tk = e.task;
      const pts = tk.k === 'route' || tk.k === 'path' ? tk.pts : null; if (!pts) continue;
      const col = tk.k === 'path' ? 'rgba(255,255,255,.9)' : RCOL[this.eligible.indexOf(e)] || '#fff';
      let prev = [e.x, e.y];
      for (const q of pts) { line(prev[0], prev[1], Math.min(q[0], 118), q[1], 0.35, col); prev = q; }
      const last = pts[pts.length - 1], lp = P(Math.min(last[0], 118), last[1]);
      if (lp) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lp.x, lp.y, Math.max(3, 0.45 * lp.k), 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // ---- players (far to near) ----
  const ents = this.ents.slice().sort((a, b) => b.x - a.x);
  const carrier = this.carrier();
  for (const e of ents) {
    const p = P(e.x, e.y); if (!p) continue;
    const side = e.side === 'O' ? gs.poss : 1 - gs.poss;
    const sp = Math.hypot(e.vx, e.vy); e.phase = (e.phase || Math.random() * 6) + sp * 0.03;
    drawFigure(ctx, p.x, p.y, p.k, e, this.teamOf(side), side === 0, sp, e === this.ctrl, e === carrier && this.ball && this.ball.state === 'held');
  }
  if (this.drawScriptTags) this.drawScriptTags(ctx, P);
  // receiver icons
  if (this.canUserThrow()) {
    this.eligible.forEach((e, i) => {
      const p = P(e.x, e.y, 2.75); if (!p) return; const r = Math.max(9, 0.42 * p.k);
      ctx.fillStyle = RCOL[i]; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = `800 ${Math.round(r * 1.25)}px 'Saira Condensed', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), p.x, p.y + 1);
    });
  }
  // ball in flight
  const b = this.ball;
  if (b && (b.state === 'air' || b.state === 'pitch')) {
    const sh = P(b.x, b.y), p = P(b.x, b.y, 1.3 + b.z);
    if (sh) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 0.3 * sh.k, 0.1 * sh.k, 0, 0, Math.PI * 2); ctx.fill(); }
    if (p) { drawBall(ctx, p.x, p.y, Math.max(3, 0.32 * p.k), this.t2 * 14); }
  }
  // floating text
  for (const f of this.effects) {
    f.t += 1 / 60; if (f.t > 1.2) continue;
    const p = P(f.x, f.y, 3 + f.t * 2); if (!p) continue;
    ctx.globalAlpha = 1 - f.t / 1.2; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4;
    ctx.font = `800 italic ${Math.round(clamp(p.k * 1.1, 14, 34))}px 'Saira Condensed', system-ui`; ctx.textAlign = 'center';
    ctx.strokeText(f.txt, p.x, p.y); ctx.fillText(f.txt, p.x, p.y); ctx.globalAlpha = 1;
  }
  this.effects = this.effects.filter(f => f.t <= 1.2);
  if (this.phase === 'kick') this.renderKick(ctx, W, H);
};

function drawBall(ctx, x, y, r, spin) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(spin) * 0.25 - 0.6);
  ctx.fillStyle = '#7a3d14'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, r * 0.18); ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
  ctx.restore();
}

// one player figure, feet at (X, Y), k = pixels per yard at that depth
function drawFigure(ctx, X, Y, k, e, team, home, sp, selected, hasBall) {
  const jersey = home ? team.c1 : '#f2f2f2', trim = home ? team.c2 : team.c1, pants = home ? '#e9e9e9' : team.c1;
  const helmet = team.c1, skin = '#8d5a3b';
  const run = Math.min(1, sp / 4), st = Math.sin(e.phase || 0) * run;
  const down = e.stun > 0 ? 1 : 0;
  // ring under the selected player
  if (selected) {
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = Math.max(2, 0.12 * k);
    ctx.beginPath(); ctx.ellipse(X, Y, 0.85 * k, 0.3 * k, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(X + 0.12 * k, Y, 0.55 * k, 0.18 * k, 0, 0, Math.PI * 2); ctx.fill();
  if (k < 6) { // far away: simple token
    ctx.fillStyle = jersey; ctx.fillRect(X - 0.35 * k, Y - 1.7 * k, 0.7 * k, 1.2 * k);
    ctx.fillStyle = pants; ctx.fillRect(X - 0.3 * k, Y - 0.6 * k, 0.6 * k, 0.6 * k);
    ctx.fillStyle = helmet; ctx.beginPath(); ctx.arc(X, Y - 1.85 * k, 0.26 * k, 0, Math.PI * 2); ctx.fill();
    if (selected) { ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(X, Y - 2.25 * k); ctx.lineTo(X - 4, Y - 2.25 * k - 7); ctx.lineTo(X + 4, Y - 2.25 * k - 7); ctx.fill(); }
    return;
  }
  ctx.save();
  if (down) { ctx.translate(X, Y); ctx.rotate(0.9); ctx.translate(-X, -Y + 0.3 * k); }
  const hipY = Y - 0.95 * k;
  // legs
  ctx.lineCap = 'round'; ctx.strokeStyle = pants; ctx.lineWidth = 0.24 * k;
  const leg = (dx, s) => { ctx.beginPath(); ctx.moveTo(X + dx, hipY); ctx.lineTo(X + dx + s * 0.18 * k, hipY + 0.5 * k - Math.max(0, s) * 0.12 * k); ctx.lineTo(X + dx + s * 0.1 * k, Y - Math.max(0, s) * 0.25 * k); ctx.stroke(); };
  leg(-0.14 * k, st); leg(0.14 * k, -st);
  ctx.fillStyle = '#111'; // cleats
  ctx.fillRect(X - 0.24 * k + st * 0.1 * k, Y - 0.08 * k - Math.max(0, st) * 0.25 * k, 0.2 * k, 0.1 * k);
  ctx.fillRect(X + 0.04 * k - st * 0.1 * k, Y - 0.08 * k - Math.max(0, -st) * 0.25 * k, 0.2 * k, 0.1 * k);
  // torso
  const tTop = Y - 1.62 * k, tH = 0.72 * k;
  ctx.fillStyle = jersey; roundRect(ctx, X - 0.36 * k, tTop, 0.72 * k, tH, 0.12 * k); ctx.fill();
  // shoulder pads
  ctx.beginPath(); ctx.ellipse(X, tTop + 0.05 * k, 0.5 * k, 0.16 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = trim; ctx.fillRect(X - 0.36 * k, tTop + tH - 0.08 * k, 0.72 * k, 0.06 * k);
  // arms
  ctx.strokeStyle = jersey; ctx.lineWidth = 0.18 * k;
  const arm = (dx, s) => { ctx.beginPath(); ctx.moveTo(X + dx, tTop + 0.1 * k); ctx.lineTo(X + dx * 1.25, tTop + 0.4 * k + s * 0.1 * k); ctx.stroke(); ctx.strokeStyle = skin; ctx.beginPath(); ctx.moveTo(X + dx * 1.25, tTop + 0.4 * k + s * 0.1 * k); ctx.lineTo(X + dx * 1.15 - s * 0.12 * k, tTop + 0.68 * k); ctx.stroke(); ctx.strokeStyle = jersey; };
  arm(-0.45 * k, -st); arm(0.45 * k, st);
  // number
  if (k >= 11) {
    ctx.fillStyle = home ? '#fff' : team.c1; ctx.strokeStyle = trim; ctx.lineWidth = Math.max(1, 0.04 * k);
    ctx.font = `800 ${Math.round(0.42 * k)}px 'Saira Condensed', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(String(e.p.num), X, tTop + tH * 0.5); ctx.fillText(String(e.p.num), X, tTop + tH * 0.5);
  }
  // helmet
  const hy = Y - 1.86 * k, hr = 0.25 * k;
  ctx.fillStyle = helmet; ctx.beginPath(); ctx.arc(X, hy, hr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = team.c2; ctx.lineWidth = Math.max(1, 0.06 * k); ctx.beginPath(); ctx.moveTo(X, hy - hr); ctx.lineTo(X, hy + hr * 0.6); ctx.stroke();
  if (e.side === 'D') { ctx.strokeStyle = '#bbb'; ctx.lineWidth = Math.max(1, 0.04 * k); ctx.beginPath(); ctx.moveTo(X - hr * 0.6, hy + hr * 0.35); ctx.lineTo(X + hr * 0.6, hy + hr * 0.35); ctx.stroke(); }
  if (hasBall) drawBall(ctx, X + 0.3 * k, tTop + 0.4 * k, 0.17 * k, 0);
  ctx.restore();
  if (selected) { ctx.fillStyle = '#ffe14d'; ctx.beginPath(); const ty = Y - 2.3 * k; ctx.moveTo(X, ty); ctx.lineTo(X - 0.22 * k, ty - 0.3 * k); ctx.lineTo(X + 0.22 * k, ty - 0.3 * k); ctx.fill(); }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// tap-to-throw in broadcast view
LiveGame.prototype.receiverAt2D = LiveGame.prototype.receiverAt;
LiveGame.prototype.receiverAt = function (px, py) {
  if (this.camMode === 'top' || !this.c3) return this.receiverAt2D(px, py);
  let best = null, bd = 1e9;
  for (const e of this.eligible || []) {
    const p = this.proj(e.x, e.y, 1.2); if (!p) continue;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < Math.max(40, p.k * 1.6) && d < bd) { bd = d; best = e; }
  }
  return best;
};
