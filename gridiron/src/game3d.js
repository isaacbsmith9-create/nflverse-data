// ============================================================
// Gridiron Dynasty - broadcast camera renderer (v2 graphics)
// Perspective view from behind the offense: downfield = up the screen,
// the offense's right (+y) = screen right.
// Field: mowed grass, painted end zones, sideline benches, goal posts.
// Players: shaded figures sized by position, run cycle and lean.
// Effects: ball trail, tackle dust, touchdown confetti, crowd flashes.
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

// ---------- color helpers ----------
function shade(hex, amt) { // amt -1..1 (negative darkens)
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
const _mkCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(Math.max(1, w), Math.max(1, h)) : Object.assign(document.createElement('canvas'), { width: Math.max(1, w), height: Math.max(1, h) });

// ---------- stadium backdrop (cached per size + home colors) ----------
let _crowdCache = null;
function crowdCanvas(W, Hh, c1, c2) {
  const key = W + 'x' + Hh + c1 + c2;
  if (_crowdCache && _crowdCache.key === key) return _crowdCache.cv;
  const cv = _mkCanvas(W, Hh), g = cv.getContext('2d');
  // night sky into the upper deck
  const sky = g.createLinearGradient(0, 0, 0, Hh);
  sky.addColorStop(0, '#03060b'); sky.addColorStop(0.35, '#0a1220'); sky.addColorStop(1, '#151d2b');
  g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
  // light towers
  for (let i = 0; i < 4; i++) {
    const lx = (i + 0.5) * W / 4, ly = Hh * 0.07, bw = Math.max(18, W * 0.045);
    const glow = g.createRadialGradient(lx, ly, 0, lx, ly, W * 0.16);
    glow.addColorStop(0, 'rgba(255,248,220,.75)'); glow.addColorStop(0.25, 'rgba(255,245,215,.25)'); glow.addColorStop(1, 'rgba(255,245,215,0)');
    g.fillStyle = glow; g.fillRect(lx - W * 0.16, 0, W * 0.32, Hh * 0.6);
    g.fillStyle = '#fffbe8';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) g.fillRect(lx - bw / 2 + c * bw / 5 + 1, ly - 4 + r * 5, bw / 5 - 2, 3);
  }
  // upper deck facade
  g.fillStyle = '#0d131d'; g.fillRect(0, Hh * 0.2, W, Hh * 0.04);
  g.fillStyle = c1; g.fillRect(0, Hh * 0.24, W, Math.max(2, Hh * 0.012));
  // crowd: dense rows, larger toward the field, home colors mixed in
  const palette = [c1, c1, c2, '#e8e8e8', '#9aa2ad', '#d6c4ae', '#5a6372', c1, '#2b3442', '#c0392b', '#2e86de'];
  for (let row = 0; row < 34; row++) {
    const t = row / 33, y = Hh * (0.27 + t * 0.66), r = 0.9 + t * 2.4, gap = r * 2.35;
    g.fillStyle = `rgba(10,14,20,${0.5 - t * 0.3})`; g.fillRect(0, y - r, W, r * 2.2);
    for (let x = (row % 2) * gap / 2; x < W; x += gap) {
      g.globalAlpha = 0.45 + t * 0.55;
      g.fillStyle = palette[(Math.random() * palette.length) | 0];
      g.beginPath(); g.arc(x + Math.random() * 1.2, y + Math.random() * 1.2, r, 0, Math.PI * 2); g.fill();
      if (t > 0.5 && Math.random() < 0.15) { g.fillStyle = '#e9c39b'; g.beginPath(); g.arc(x, y - r * 0.9, r * 0.55, 0, Math.PI * 2); g.fill(); }
    }
  }
  g.globalAlpha = 1;
  // stadium wall with home trim
  const wh = Math.max(7, Hh * 0.075);
  const wall = g.createLinearGradient(0, Hh - wh, 0, Hh);
  wall.addColorStop(0, shade(c1, -0.15)); wall.addColorStop(1, shade(c1, -0.55));
  g.fillStyle = wall; g.fillRect(0, Hh - wh, W, wh);
  g.fillStyle = c2; g.fillRect(0, Hh - wh, W, 2);
  _crowdCache = { key, cv };
  return cv;
}

// screen-space film grain for the grass (static, cheap)
let _grain = null;
function grainCanvas(W, H) {
  const key = W + 'x' + H;
  if (_grain && _grain.key === key) return _grain.cv;
  const cv = _mkCanvas(W, H), g = cv.getContext('2d');
  for (let i = 0; i < (W * H) / 90; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.035)';
    g.fillRect(x, y, 1 + Math.random() * 1.5, 1 + Math.random() * 2.5);
  }
  _grain = { key, cv };
  return cv;
}

// crowd texture: rows of seated fans (heads, shoulders, shirts) in 3 animation frames
let _crowdPat = null;
function _rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function crowdPatterns(ctx, c1, c2) {
  const key = c1 + c2;
  if (_crowdPat && _crowdPat.key === key) return _crowdPat.pats;
  const TW = 240, TH = 120, ROW = 15;
  const shirts = [c1, c1, c1, c2, c1, '#f2f2f2', '#2b3442', '#7f8794', c2, '#1d1d1d', '#b03a2e', '#3f6fb5', c1, '#d9c7a8'];
  const skins = ['#f1c9a5', '#d9a37a', '#b07a52', '#7b4a2e', '#5a3622', '#e8b892'];
  const people = []; const r = _rng(7);
  for (let row = 0; row < TH / ROW; row++) for (let x = (row % 2) * 5; x < TW; x += 10) {
    if (r() < 0.07) continue; // empty seat
    people.push({ x: x + r() * 2, y: row * ROW, shirt: shirts[(r() * shirts.length) | 0], skin: skins[(r() * skins.length) | 0], hat: r() < 0.18 ? (r() < 0.6 ? c1 : c2) : null, armP: r(), h: 0.85 + r() * 0.3 });
  }
  const cvs = [];
  const pats = [0, 1, 2].map(frame => {
    const cv = _mkCanvas(TW, TH), g = cv.getContext('2d');
    for (let row = 0; row < TH / ROW; row++) { // seat rows with step shadow
      g.fillStyle = row % 2 ? '#20283a' : '#1b2232'; g.fillRect(0, row * ROW, TW, ROW);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, row * ROW + ROW - 3, TW, 3);
      g.fillStyle = shade(c1, -0.55); g.fillRect(0, row * ROW + ROW - 5, TW, 2);
    }
    for (const p of people) {
      const cheer = frame > 0 && p.armP < (frame === 1 ? 0.3 : 0.65);
      const bob = frame === 2 && p.armP < 0.65 ? -2 : frame === 1 && p.armP > 0.7 ? -1 : 0;
      const bx = p.x, by = p.y + ROW - 4 + bob, bh = 7 * p.h;
      g.fillStyle = p.shirt; g.beginPath(); g.moveTo(bx - 4, by); g.quadraticCurveTo(bx - 4, by - bh, bx, by - bh); g.quadraticCurveTo(bx + 4, by - bh, bx + 4, by); g.fill();
      if (cheer) { g.strokeStyle = p.shirt; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx - 3, by - bh + 1); g.lineTo(bx - 5, by - bh - 6); g.moveTo(bx + 3, by - bh + 1); g.lineTo(bx + 5, by - bh - 6); g.stroke(); g.fillStyle = p.skin; g.fillRect(bx - 6, by - bh - 8, 2, 2); g.fillRect(bx + 4, by - bh - 8, 2, 2); }
      g.fillStyle = p.skin; g.beginPath(); g.arc(bx, by - bh - 2.6, 2.6, 0, Math.PI * 2); g.fill();
      if (p.hat) { g.fillStyle = p.hat; g.beginPath(); g.arc(bx, by - bh - 3.4, 2.7, Math.PI, 0); g.fill(); }
    }
    cvs.push(cv);
    return ctx.createPattern(cv, 'repeat');
  });
  _crowdPat = { key, pats, cvs };
  return pats;
}

LiveGame.prototype.render3D = function (ctx, W, H) {
  const gs = this.gs;
  // ---- telephoto broadcast camera: high and far back, long lens, gentle perspective ----
  const portrait = H > W * 1.05;
  const pocket = this.phase === 'pre' || this.phase === 'call' || (this.phase === 'live' && this.carrier() === this.passer && this.passReady && !this.play.crossed);
  this.backT = (this.backT == null ? 56 : this.backT) + ((pocket ? 56 : 50) - (this.backT == null ? 56 : this.backT)) * 0.06;
  const B = this.backT, behind = 12, yLos = portrait ? 0.64 : 0.6;
  const zb = B - 9 - behind, zl = B - 9;
  const C = (H - H * yLos) / (1 / zb - 1 / zl);       // vertical projection constant
  const hor = H - C / zb;                             // horizon (usually above the screen)
  const F = (portrait ? 1.35 : 0.9) * W * zl / FIELD_W; // field width at the line of scrimmage ~ screen width
  const camH = C / F;
  const cy = clamp(this.cam.y, MID_Y - 14, MID_Y + 14);
  this.c3 = { F, hor, camH, C, W, H, camX: this.cam.x - B, camY: this.c3 ? this.c3.camY + (cy - this.c3.camY) * 0.1 : cy };
  const P = (x, y, h) => this.proj(x, y, h);
  const homeT = this.teamOf(0), awayT = this.teamOf(1), offT = this.teamOf(gs.poss), defT = this.teamOf(1 - gs.poss);
  const x0 = this.c3.camX + 1;

  // ---- backdrop + stands in 3D ----
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  sky.addColorStop(0, '#05080e'); sky.addColorStop(1, '#141c2a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const polyH = (pts, fill) => { // pts: [x, y, h]
    const pp = []; for (const [x, y, h] of pts) { const p = P(Math.max(x, x0), y, h || 0); if (!p) return; pp.push(p); }
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pp[0].x, pp[0].y); for (let i = 1; i < pp.length; i++) ctx.lineTo(pp[i].x, pp[i].y); ctx.closePath(); ctx.fill();
  };
  // crowd animates: bob between frames, stand and cheer on big moments
  this.cheer = Math.max(0, (this.cheer || 0) - 1 / 240);
  const pats = crowdPatterns(ctx, homeT.c1, homeT.c2);
  if (!this._cfT || this.t2 - this._cfT > (this.cheer > 0.2 ? 0.16 : 0.45)) { this._cfT = this.t2; this._cf = this.cheer > 0.2 ? 1 + ((this._cf || 0) % 2) : (Math.random() < 0.85 ? 0 : 1); }
  const crowd = pats[this._cf || 0];
  if (crowd.setTransform && typeof DOMMatrix !== 'undefined') crowd.setTransform(new DOMMatrix().scale(clamp(W / 1100, 0.7, 1.6)));
  const xFar = 160;
  // far end: wall + rising crowd behind the end line
  polyH([[124, -40, 2.6], [124, FIELD_W + 40, 2.6], [150, FIELD_W + 60, 22], [150, -60, 22]], crowd);
  polyH([[124, -40, 0], [124, FIELD_W + 40, 0], [124, FIELD_W + 40, 2.6], [124, -40, 2.6]], shade(homeT.c1, -0.25));
  // side stands: wall at the edge of the apron, crowd rising away from the field
  for (const [yw, yo] of [[-12, -34], [FIELD_W + 12, FIELD_W + 34]]) {
    polyH([[x0, yw, 2.6], [124, yw, 2.6], [150, yo, 22], [x0, yo, 22]], crowd);
    polyH([[x0, yw, 0], [124, yw, 0], [124, yw, 2.6], [x0, yw, 2.6]], shade(homeT.c1, -0.3));
    polyH([[x0, yw, 2.4], [124, yw, 2.4], [124, yw, 2.75], [x0, yw, 2.75]], homeT.c2);
  }
  { const sg = ctx.createLinearGradient(0, 0, 0, H * 0.45); sg.addColorStop(0, 'rgba(0,0,0,.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.45); }
  // crowd camera flashes
  if (this.phase === 'live' || (this.banner && this.banner.big)) {
    const n = this.banner && this.banner.big ? 16 : 4;
    for (let i = 0; i < n; i++) if (Math.random() < 0.5) {
      const side = Math.random() < 0.5 ? -1 : 1, p = P(this.cam.x + rand(-10, 40), side < 0 ? rand(-30, -14) : rand(FIELD_W + 14, FIELD_W + 30), rand(4, 18));
      if (p && p.y > 0 && p.y < H) { ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(p.x, p.y, 2.5, 2.5); }
    }
  }
  // ground (apron) only between the stands
  polyH([[x0, -12, 0], [x0, FIELD_W + 12, 0], [124, FIELD_W + 12, 0], [124, -12, 0]], '#1c5129');

  const poly = (pts, fill) => {
    const pp = []; for (const [x, y] of pts) { const p = P(x, y); if (!p) return; pp.push(p); }
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pp[0].x, pp[0].y); for (let i = 1; i < pp.length; i++) ctx.lineTo(pp[i].x, pp[i].y); ctx.closePath(); ctx.fill();
  };
  const quad = (xa, xb, ya, yb, fill) => { const a = Math.max(xa, x0); if (xb <= a) return; poly([[a, ya], [a, yb], [xb, yb], [xb, ya]], fill); };
  // painted ground line: a thin quad in world space, so it narrows correctly with distance
  const line = (xa, ya, xb, yb, w, col) => {
    const zmin = x0;
    if (xa < zmin && xb < zmin) return;
    if (xa < zmin) { const t = (zmin - xa) / (xb - xa); ya += (yb - ya) * t; xa = zmin; }
    if (xb < zmin) { const t = (zmin - xb) / (xa - xb); yb += (ya - yb) * t; xb = zmin; }
    const dx = xb - xa, dy = yb - ya, m = Math.hypot(dx, dy) || 1, nx = -dy / m * w / 2, ny = dx / m * w / 2;
    const q = [P(xa + nx, ya + ny), P(xb + nx, yb + ny), P(xb - nx, yb - ny), P(xa - nx, ya - ny)];
    if (q.some(v => !v)) return;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(q[i].x, q[i].y); ctx.closePath(); ctx.fill();
  };
  quad(-10, 124, -2, 0, 'rgba(255,255,255,.12)'); quad(-10, 124, FIELD_W, FIELD_W + 2, 'rgba(255,255,255,.12)');
  quad(35, 85, -9, -4, shade(homeT.c1, -0.35)); quad(35, 85, FIELD_W + 4, FIELD_W + 9, shade(awayT.c1, -0.35));

  // ---- field: mowed stripes + cross-cut ----
  for (let x = 0; x < 120; x += 5) {
    let col;
    if (x < 10) col = offT.c1; else if (x >= 110) col = defT.c1;
    else col = ((x - 10) / 5) % 2 ? '#2f8c40' : '#2a7f39';
    quad(x, x + 5, 0, FIELD_W, col);
  }
  for (let i = 0; i < 10; i++) if (i % 2) quad(10, 110, i * FIELD_W / 10, (i + 1) * FIELD_W / 10, 'rgba(255,255,255,.035)');
  // end zone diagonal stripes + names
  for (const [ez, t] of [[0, offT], [110, defT]]) {
    if (ez + 10 < x0) continue;
    for (let d = -12; d < 60; d += 3.2) line(ez, d, ez + 10, d + 10, 1.1, 'rgba(255,255,255,.07)');
  }
  // grain over everything grassy
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(grainCanvas(Math.ceil(W), Math.ceil(H)), 0, 0); ctx.restore();

  // ---- paint ----
  const chalk = 'rgba(255,255,255,.9)';
  for (let x = Math.max(0, Math.ceil(x0 / 5) * 5); x <= 120; x += 5) line(x, 0, x, FIELD_W, x === 10 || x === 110 ? 0.22 : 0.12, chalk);
  line(Math.max(-1, x0), 0, 121, 0, 0.3, chalk); line(Math.max(-1, x0), FIELD_W, 121, FIELD_W, 0.3, chalk);
  for (let x = Math.max(11, Math.ceil(x0)); x < 110; x++) {
    if (x % 5 === 0) continue;
    for (const hy of [0.6, HASH_L, HASH_R, FIELD_W - 0.6]) line(x, hy - 0.4, x, hy + 0.4, 0.09, 'rgba(255,255,255,.72)');
  }
  const groundText = (txt, x, y, sizeYds, col, stroke) => {
    const p = P(x, y); if (!p || p.k < 1.5) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, clamp(this.c3.C / (this.c3.F * p.z), 0.12, 0.95));
    ctx.font = `800 ${Math.round(sizeYds * p.k)}px 'Saira Condensed', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = Math.max(2, sizeYds * p.k * 0.08); ctx.strokeStyle = stroke; ctx.strokeText(txt, 0, 0); }
    ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore();
  };
  for (let x = 20; x <= 100; x += 10) {
    if (x < x0 + 2) continue;
    const n = x <= 60 ? x - 10 : 110 - x;
    groundText(String(n), x, 9, 2.2, 'rgba(255,255,255,.9)');
    groundText(String(n), x, FIELD_W - 9, 2.2, 'rgba(255,255,255,.9)');
    if (n !== 50) { // direction arrows point to the nearer goal line
      const dir = x < 60 ? -1 : 1;
      for (const yy of [9, FIELD_W - 9]) { const a = P(x + dir * 1.6, yy - 1.6), b = P(x + dir * 1.6, yy + 1.6), c = P(x + dir * 2.4, yy); if (a && b && c) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.fill(); } }
    }
  }
  const groundImg = (img, x, y, sizeYds) => {
    const p = P(x, y); if (!p || !img || p.k < 1.2) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, clamp(this.c3.C / (this.c3.F * p.z), 0.12, 0.95));
    const s2 = sizeYds * p.k; ctx.globalAlpha = 0.95; ctx.drawImage(img, -s2 / 2, -s2 / 2, s2, s2); ctx.restore();
  };
  const em = t => typeof emblemImage === 'function' ? emblemImage(t) : null;
  if (60 > x0 + 3) groundImg(em(homeT), 60, MID_Y, 13);
  if (115 > x0) { groundImg(em(defT), 115, 9, 6.5); groundImg(em(defT), 115, FIELD_W - 9, 6.5); }
  if (5 > x0 + 1) { groundImg(em(offT), 5, 9, 6.5); groundImg(em(offT), 5, FIELD_W - 9, 6.5); }
  if (115 > x0) groundText(defT.name.toUpperCase(), 115, MID_Y, 6, '#ffffff', shade(defT.c1, -0.5));
  if (5 > x0 + 1) groundText(offT.name.toUpperCase(), 5, MID_Y, 6, '#ffffff', shade(offT.c1, -0.5));

  // ---- goal posts (padded base, gooseneck, uprights with flags) ----
  const goalPost = gx => {
    const base = P(gx + 2, MID_Y); if (!base) return;
    const k = base.k, pts = h => [P(gx + 2, MID_Y, h), P(gx, MID_Y, h)];
    const sh = P(gx + 2, MID_Y + 1.5); if (sh) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 1.4 * k, 0.4 * k, 0, 0, Math.PI * 2); ctx.fill(); }
    const pad = P(gx + 2, MID_Y, 2.2);
    ctx.fillStyle = defT.c1; ctx.fillRect(base.x - 0.35 * k, pad.y, 0.7 * k, base.y - pad.y);
    const g1 = P(gx + 2, MID_Y, 3.3), g2 = P(gx, MID_Y, 3.3);
    const lt = P(gx, MID_Y - 3.1, 3.3), rt = P(gx, MID_Y + 3.1, 3.3), lu = P(gx, MID_Y - 3.1, 12), ru = P(gx, MID_Y + 3.1, 12);
    if (!g2 || !lt || !rt || !lu || !ru) return;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#f4c20d'; ctx.lineWidth = Math.max(2, 0.28 * k);
    ctx.beginPath(); ctx.moveTo(base.x, pad.y); ctx.lineTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.stroke();
    ctx.lineWidth = Math.max(2, 0.22 * k); ctx.beginPath(); ctx.moveTo(lt.x, lt.y); ctx.lineTo(rt.x, rt.y); ctx.moveTo(lt.x, lt.y); ctx.lineTo(lu.x, lu.y); ctx.moveTo(rt.x, rt.y); ctx.lineTo(ru.x, ru.y); ctx.stroke();
    const sway = Math.sin(this.t2 * 3) * 0.3 * k;
    ctx.fillStyle = '#ff5a1f'; for (const u of [lu, ru]) { ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x + 0.9 * k + sway, u.y + 0.2 * k); ctx.lineTo(u.x, u.y + 0.45 * k); ctx.fill(); }
  };
  goalPost(120);

  // ---- LOS + first down (soft glow) ----
  if (['pre', 'live', 'call', 'kick'].includes(this.phase)) {
    const los = this.los || 10 + gs.yard;
    line(los, 0, los, FIELD_W, 0.7, 'rgba(70,150,255,.22)'); line(los, 0, los, FIELD_W, 0.3, 'rgba(90,165,255,.95)');
    const fd = this.firstX || Math.min(110, los + gs.togo);
    if (fd < 110) { line(fd, 0, fd, FIELD_W, 0.7, 'rgba(255,214,0,.22)'); line(fd, 0, fd, FIELD_W, 0.3, 'rgba(255,220,40,.95)'); }
  }
  // route art
  const showArt = this.userOnOffense() && (this.phase === 'pre' || (this.phase === 'live' && this.t < 0.8));
  if (showArt && this.O) {
    for (const k of ['WR1', 'WR2', 'WR3', 'TE', 'RB', 'QB']) {
      const e = this.O[k]; if (!e) continue; const tk = e.task;
      const pts = tk.k === 'route' || tk.k === 'path' ? tk.pts : null; if (!pts) continue;
      const col = tk.k === 'path' ? 'rgba(255,255,255,.9)' : RCOL[this.eligible.indexOf(e)] || '#fff';
      let prev = [e.x, e.y];
      for (const q of pts) { line(prev[0], prev[1], Math.min(q[0], 118), q[1], 0.6, 'rgba(0,0,0,.25)'); line(prev[0], prev[1], Math.min(q[0], 118), q[1], 0.32, col); prev = q; }
      const last = pts[pts.length - 1], lp = P(Math.min(last[0], 118), last[1]);
      if (lp) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lp.x, lp.y, Math.max(3, 0.45 * lp.k), 0, Math.PI * 2); ctx.fill(); }
    }
  }

  // ---- bench players (simple tokens, far away) ----
  if (!this._bench) this._bench = Array.from({ length: 22 }, (_, i) => ({ x: 37 + i * 2.1 + Math.random() * 1.2, off: (i % 3) * 1.1 + Math.random() * 0.6, seed: i + 1 }));
  for (const [side, by] of [[0, -6.5], [1, FIELD_W + 6.5]]) {
    const t = this.teamOf(side);
    for (const bp of this._bench.slice().sort((a, b) => (side === 0 ? a.off - b.off : b.off - a.off))) { const p = P(bp.x, by + (side === 0 ? -bp.off : bp.off)); if (!p || p.k < 2) continue; benchToken(ctx, p.x, p.y, p.k, t, side === 0, bp.seed); }
  }

  // ---- particles on the ground (dust) ----
  this.parts = this.parts || [];
  for (const q of this.parts) {
    if (q.kind !== 'dust') continue;
    q.t += 1 / 60; const p = P(q.x, q.y, 0.3 + q.t * 0.8); if (!p) continue;
    ctx.fillStyle = `rgba(190,170,130,${Math.max(0, 0.45 - q.t * 0.5)})`;
    ctx.beginPath(); ctx.arc(p.x + q.vx * q.t * p.k, p.y, (0.3 + q.t * 1.2) * p.k, 0, Math.PI * 2); ctx.fill();
  }

  // ---- players (far to near) ----
  const ents = this.ents.slice().sort((a, b) => b.x - a.x);
  const carrier = this.carrier();
  for (const e of ents) {
    const p = P(e.x, e.y); if (!p) continue;
    const side = e.side === 'O' ? gs.poss : 1 - gs.poss;
    const sp = Math.hypot(e.vx, e.vy); e.phase = (e.phase || Math.random() * 6) + sp * 0.032;
    drawFigure(ctx, p.x, p.y, p.k, e, this.teamOf(side), side === 0, sp, e === this.ctrl, e === carrier && this.ball && this.ball.state === 'held', this.poseFor(e));
    if (e === this.ctrl && e.p) {
      const label = e.p.last.toUpperCase(), fs = Math.round(clamp(p.k * 0.42, 11, 16));
      ctx.font = `800 ${fs}px 'Saira Condensed', system-ui`; const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,.7)'; roundRect(ctx, p.x - tw / 2, p.y + 0.45 * p.k, tw, fs + 6, 4); ctx.fill();
      ctx.fillStyle = '#ffe14d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, p.x, p.y + 0.45 * p.k + fs / 2 + 3);
    }
  }
  if (this.drawScriptTags) this.drawScriptTags(ctx, P);
  // receiver icons
  if (this.canUserThrow()) {
    this.eligible.forEach((e, i) => {
      const p = P(e.x, e.y, 2.85); if (!p) return; const r = Math.max(10, 0.44 * p.k);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(p.x + 1.5, p.y + 2, r, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
      g.addColorStop(0, shade(RCOL[i], 0.4)); g.addColorStop(1, RCOL[i]);
      ctx.fillStyle = g; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = `800 ${Math.round(r * 1.25)}px 'Saira Condensed', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), p.x, p.y + 1);
    });
  }
  // ---- ball in flight with trail ----
  const b = this.ball;
  if (b && (b.state === 'air' || b.state === 'pitch')) {
    b.trail = b.trail || []; b.trail.push([b.x, b.y, b.z]); if (b.trail.length > 10) b.trail.shift();
    b.trail.forEach(([tx, ty, tz], i) => { const q = P(tx, ty, 1.3 + tz); if (q) { ctx.fillStyle = `rgba(255,255,255,${i / b.trail.length * 0.35})`; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, 0.12 * q.k), 0, Math.PI * 2); ctx.fill(); } });
    const sh = P(b.x, b.y), p = P(b.x, b.y, 1.3 + b.z);
    if (sh) { ctx.fillStyle = `rgba(0,0,0,${0.35 - Math.min(0.25, b.z * 0.02)})`; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 0.32 * sh.k, 0.11 * sh.k, 0, 0, Math.PI * 2); ctx.fill(); }
    if (p) drawBall(ctx, p.x, p.y, Math.max(3, 0.32 * p.k), this.t2 * 14);
  } else if (b) b.trail = null;
  // floating text
  for (const f of this.effects) {
    f.t += 1 / 60; if (f.t > 1.2) continue;
    const p = P(f.x, f.y, 3 + f.t * 2); if (!p) continue;
    ctx.globalAlpha = 1 - f.t / 1.2; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.font = `800 italic ${Math.round(clamp(p.k * 1.15, 16, 38))}px 'Saira Condensed', system-ui`; ctx.textAlign = 'center';
    ctx.strokeText(f.txt, p.x, p.y); ctx.fillText(f.txt, p.x, p.y); ctx.globalAlpha = 1;
  }
  this.effects = this.effects.filter(f => f.t <= 1.2);

  // ---- atmosphere: horizon haze + vignette ----
  const vig = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.42)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

  // ---- screen-space confetti for touchdowns ----
  for (const q of this.parts) {
    if (q.kind !== 'confetti') continue;
    q.t += 1 / 60; q.x += q.vx; q.y += q.vy; q.vy += 0.06; q.vx *= 0.99; q.rot += q.vr;
    ctx.save(); ctx.translate(q.x * W, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.c; ctx.globalAlpha = Math.max(0, 1 - q.t / 3);
    ctx.fillRect(-4, -2, 8, Math.abs(Math.cos(q.rot)) * 5 + 1); ctx.restore();
  }
  this.parts = this.parts.filter(q => q.kind === 'dust' ? q.t < 1 : q.t < 3 && q.y < H + 20);
  if (this.phase === 'kick') this.renderKick(ctx, W, H);
};

// spawn effects when plays end
const _endPlayFx = LiveGame.prototype.endPlay;
LiveGame.prototype.endPlay = function (kind, msg) {
  const c = this.carrier(), score = this.gs.score.slice(), poss = this.gs.poss;
  _endPlayFx.call(this, kind, msg);
  this.parts = this.parts || [];
  if (c && (kind === 'tackle' || kind === 'oob')) for (let i = 0; i < 7; i++) this.parts.push({ kind: 'dust', x: c.x + gauss(0, 0.4), y: c.y + gauss(0, 0.5), vx: gauss(0, 0.8), t: 0 });
  const scorer = this.gs.score[0] - score[0] >= 6 ? 0 : this.gs.score[1] - score[1] >= 6 ? 1 : -1;
  if (scorer >= 0) {
    const t = this.teamOf(scorer), cols = [t.c1, t.c2, '#ffffff', '#ffd23f'];
    for (let i = 0; i < 140; i++) this.parts.push({ kind: 'confetti', x: Math.random(), y: -20 - Math.random() * 200, vx: gauss(0, 0.0015), vy: 1 + Math.random() * 2.5, rot: Math.random() * 6, vr: gauss(0, 0.15), c: pick(cols), t: 0 });
  }
};

function drawBall(ctx, x, y, r, spin) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(spin) * 0.25 - 0.6);
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#a5592a'); g.addColorStop(1, '#5a2a0c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * 0.55); ctx.lineTo(-r * 1.05, r * 0.55); ctx.moveTo(r * 1.05, -r * 0.55); ctx.lineTo(r * 1.05, r * 0.55); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.14); ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.1); ctx.lineTo(r * 0.45, -r * 0.1); ctx.stroke();
  ctx.restore();
}

function benchToken(ctx, X, Y, k, t, home, seed) {
  // a small standing player: legs, pants, jersey with shoulder pads, helmet; slight variety per seed
  const j = home ? t.c1 : '#eeeeee', pn = home ? '#e6e6e6' : t.c1, h = 1 + ((seed * 37) % 10) / 60, lean = (((seed * 13) % 7) - 3) * 0.02;
  ctx.save(); ctx.translate(X, Y); ctx.rotate(lean);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(-0.1 * k, 0, 0.4 * k, 0.12 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = home ? t.c1 : shade(t.c1, -0.1); ctx.fillRect(-0.22 * k, -0.45 * k * h, 0.17 * k, 0.45 * k * h); ctx.fillRect(0.05 * k, -0.45 * k * h, 0.17 * k, 0.45 * k * h);
  ctx.fillStyle = pn; ctx.fillRect(-0.24 * k, -0.9 * k * h, 0.48 * k, 0.48 * k * h);
  ctx.fillStyle = j; ctx.beginPath(); ctx.moveTo(-0.4 * k, -1.55 * k * h); ctx.lineTo(0.4 * k, -1.55 * k * h); ctx.lineTo(0.3 * k, -0.86 * k * h); ctx.lineTo(-0.3 * k, -0.86 * k * h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(j, -0.2); ctx.fillRect(-0.44 * k, -1.52 * k * h, 0.14 * k, 0.4 * k); ctx.fillRect(0.3 * k, -1.52 * k * h, 0.14 * k, 0.4 * k);
  ctx.fillStyle = t.c1; ctx.beginPath(); ctx.arc(0, -1.75 * k * h, 0.21 * k, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-0.07 * k, -1.82 * k * h, 0.07 * k, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// one player figure, feet at (X, Y), k = pixels per yard at that depth
const BUILD = { OL: [1.28, 0.98], DL: [1.2, 1.0], TE: [1.08, 1.02], LB: [1.08, 1.0], RB: [1.0, 0.95], QB: [0.98, 1.02], WR: [0.9, 1.0], CB: [0.88, 0.97], S: [0.95, 1.0] };
function drawFigure(ctx, X, Y, k, e, team, home, sp, selected, hasBall, pose) {
  const pos = e.role.replace(/[0-9]/, '');
  const [bw, bh] = BUILD[pos] || [1, 1];
  const jersey = home ? team.c1 : '#f4f4f4', trim = home ? team.c2 : team.c1, pants = home ? '#ececec' : shade(team.c1, -0.05);
  const helmet = team.c1, skin = e.p && e.p.id % 3 === 0 ? '#c68a5e' : e.p && e.p.id % 3 === 1 ? '#7b4a2e' : '#a76d47';
  const run = Math.min(1, sp / 4), st = Math.sin(e.phase || 0) * run;
  const bob = Math.abs(Math.cos(e.phase || 0)) * run * 0.08 * k;
  const down = e.stun > 0;
  const facing = e.side === 'O' ? 'back' : 'front';
  const lean = clamp((e.vy || 0) / 9, -0.25, 0.25) * run; // lean into lateral movement (screen x)
  // selection ring + shadow
  if (selected) {
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = Math.max(2, 0.13 * k);
    ctx.beginPath(); ctx.ellipse(X, Y, 0.9 * k * bw, 0.32 * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,77,.35)'; ctx.lineWidth = Math.max(4, 0.3 * k); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.beginPath(); ctx.ellipse(X - 0.25 * k, Y + 0.02 * k, 0.62 * k * bw, 0.2 * k, -0.08, 0, Math.PI * 2); ctx.fill();
  if (k < 6) { // far: simple token with team colors
    const h = k * bh;
    ctx.fillStyle = jersey; ctx.fillRect(X - 0.36 * k * bw, Y - 1.7 * h, 0.72 * k * bw, 1.0 * h);
    ctx.fillStyle = pants; ctx.fillRect(X - 0.3 * k * bw, Y - 0.72 * h, 0.6 * k * bw, 0.7 * h);
    ctx.fillStyle = helmet; ctx.beginPath(); ctx.arc(X, Y - 1.86 * h, 0.27 * k, 0, Math.PI * 2); ctx.fill();
    if (selected) { ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(X, Y - 2.3 * h); ctx.lineTo(X - 4, Y - 2.3 * h - 7); ctx.lineTo(X + 4, Y - 2.3 * h - 7); ctx.fill(); }
    return;
  }
  ctx.save();
  ctx.translate(X, Y - bob);
  // body rotation for falls, wrap-ups, dives and stumbles (pivot at the feet)
  const pt = pose && ({ flex: 'celebrate', spike: 'celebrate', dance: 'celebrate', point: 'celebrate', leap: 'celebrate', mv_hurdle: 'celebrate', mv_high: 'reach', mv_hit: 'dive', mv_stiff: 'block', mv_truck: 'block', mv_strip: 'swat', mv_spin: null, mv_hesi: null }[pose.type] !== undefined ? { flex: 'celebrate', spike: 'celebrate', dance: 'celebrate', point: 'celebrate', leap: 'celebrate', mv_hurdle: 'celebrate', mv_high: 'reach', mv_hit: 'dive', mv_stiff: 'block', mv_truck: 'block', mv_strip: 'swat', mv_spin: null, mv_hesi: null }[pose.type] : pose.type), pk = pose ? pose.k : 0, ease = 1 - Math.pow(1 - pk, 3), pdir = pose && pose.dir ? pose.dir : 1;
  if (pt === 'down') { ctx.rotate(pdir * ease * 1.45); ctx.translate(0, ease * 0.2 * k); }
  else if (pt === 'wrap') { ctx.rotate(pdir * ease * 1.25); ctx.translate(0, ease * 0.25 * k); }
  else if (pt === 'dive') ctx.rotate(pdir * 1.05);
  else if (pt === 'celebrate') ctx.translate(0, -Math.abs(Math.sin(pk * 14)) * 0.25 * k);
  else if (down) ctx.rotate(Math.sin((e.stun || 0) * 9) * 0.35);
  ctx.scale(bw, bh);
  const kk = k; // local units
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const outline = 'rgba(0,0,0,.35)';
  // ---- legs: thigh, shin with sock, cleat ----
  const hipY = -0.95 * kk;
  const leg = (dx, s) => {
    const kneeX = dx + s * 0.2 * kk, kneeY = hipY + 0.48 * kk - Math.max(0, s) * 0.14 * kk;
    const footX = dx + s * 0.08 * kk, footY = -Math.max(0, s) * 0.28 * kk;
    ctx.strokeStyle = outline; ctx.lineWidth = 0.3 * kk; ctx.beginPath(); ctx.moveTo(dx, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
    ctx.strokeStyle = pants; ctx.lineWidth = 0.25 * kk; ctx.beginPath(); ctx.moveTo(dx, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.strokeStyle = home ? team.c1 : shade(team.c1, -0.1); ctx.lineWidth = 0.18 * kk; ctx.beginPath(); ctx.moveTo(kneeX, kneeY + 0.04 * kk); ctx.lineTo(footX, footY); ctx.stroke();
    ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.ellipse(footX, footY - 0.03 * kk, 0.13 * kk, 0.07 * kk, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = trim; ctx.lineWidth = Math.max(1, 0.04 * kk); ctx.beginPath(); ctx.moveTo(dx + (dx < 0 ? -0.1 : 0.1) * kk, hipY + 0.05 * kk); ctx.lineTo(kneeX + (dx < 0 ? -0.1 : 0.1) * kk, kneeY - 0.05 * kk); ctx.stroke();
  };
  leg(-0.14 * kk, st); leg(0.14 * kk, -st);
  ctx.save(); ctx.rotate(lean);
  // ---- torso with shading ----
  const tTop = -1.64 * kk, tH = 0.74 * kk, tw = 0.76 * kk;
  const jg = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
  jg.addColorStop(0, shade(jersey, 0.14)); jg.addColorStop(0.55, jersey); jg.addColorStop(1, shade(jersey, -0.28));
  ctx.fillStyle = jg; ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, 0.04 * kk);
  roundRect(ctx, -tw / 2, tTop, tw, tH, 0.14 * kk); ctx.fill(); ctx.stroke();
  // shoulder pads
  ctx.beginPath(); ctx.ellipse(0, tTop + 0.06 * kk, 0.54 * kk, 0.18 * kk, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // sleeve stripes + waist
  ctx.fillStyle = trim;
  ctx.fillRect(-0.53 * kk, tTop + 0.08 * kk, 0.16 * kk, 0.05 * kk); ctx.fillRect(0.37 * kk, tTop + 0.08 * kk, 0.16 * kk, 0.05 * kk);
  ctx.fillStyle = shade(pants, -0.15); ctx.fillRect(-tw / 2 + 0.03 * kk, tTop + tH - 0.08 * kk, tw - 0.06 * kk, 0.07 * kk);
  // arms pump opposite the legs
  const arm = (dx, s) => {
    const elx = dx * 1.22, ely = tTop + 0.42 * kk + s * 0.12 * kk, hx = dx * 1.08 - s * 0.16 * kk, hy = tTop + 0.7 * kk - Math.max(0, -s) * 0.1 * kk;
    ctx.strokeStyle = outline; ctx.lineWidth = 0.22 * kk; ctx.beginPath(); ctx.moveTo(dx, tTop + 0.12 * kk); ctx.lineTo(elx, ely); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = jersey; ctx.lineWidth = 0.18 * kk; ctx.beginPath(); ctx.moveTo(dx, tTop + 0.12 * kk); ctx.lineTo(elx, ely); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 0.14 * kk; ctx.beginPath(); ctx.moveTo(elx, ely); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = pos === 'OL' || pos === 'DL' ? '#222' : trim; ctx.beginPath(); ctx.arc(hx, hy, 0.08 * kk, 0, Math.PI * 2); ctx.fill();
  };
  // arm to an exact hand position (local units), elbow bowed outward
  const armTo = (dx, hx, hy) => {
    const sx = dx, sy = tTop + 0.12 * kk, mx = (sx + hx) / 2 + Math.sign(dx) * 0.12 * kk, my = (sy + hy) / 2 + 0.05 * kk;
    ctx.strokeStyle = outline; ctx.lineWidth = 0.22 * kk; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = jersey; ctx.lineWidth = 0.18 * kk; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 0.14 * kk; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = pos === 'OL' || pos === 'DL' ? '#222' : trim; ctx.beginPath(); ctx.arc(hx, hy, 0.08 * kk, 0, Math.PI * 2); ctx.fill();
  };
  const L_ = -0.46 * kk, R_ = 0.46 * kk;
  let ballAt = hasBall ? [0.32 * kk, tTop + 0.42 * kk] : null;
  if (pt === 'qbready') { armTo(L_, 0.05 * kk, tTop + 0.18 * kk); armTo(R_, 0.3 * kk, tTop + 0.08 * kk); if (hasBall) ballAt = [0.2 * kk, tTop + 0.05 * kk]; }
  else if (pt === 'throw') {
    if (pk < 0.3) { armTo(L_, -0.15 * kk, tTop + 0.25 * kk); armTo(R_, 0.6 * kk, tTop - 0.5 * kk); }
    else { const f = (pk - 0.3) / 0.7; armTo(L_, -0.55 * kk, tTop + 0.55 * kk); armTo(R_, (0.35 - f * 0.65) * kk, tTop + (-0.35 + f * 0.95) * kk); }
  }
  else if (pt === 'reach') { const o = pdir * 0.15 * kk; armTo(L_, -0.2 * kk + o, tTop - 0.6 * kk); armTo(R_, 0.2 * kk + o, tTop - 0.6 * kk); }
  else if (pt === 'secure') { armTo(L_, -0.05 * kk, tTop + 0.38 * kk); armTo(R_, 0.08 * kk, tTop + 0.34 * kk); if (hasBall) ballAt = [0.02 * kk, tTop + 0.36 * kk]; }
  else if (pt === 'block' || pt === 'wrap' || pt === 'dive') { const f = pdir * (pt === 'block' ? 0.45 : 0.7) * kk; armTo(L_, f - 0.12 * kk, tTop + 0.28 * kk); armTo(R_, f + 0.12 * kk, tTop + 0.32 * kk); }
  else if (pt === 'celebrate') { armTo(L_, -0.5 * kk, tTop - 0.75 * kk); armTo(R_, 0.5 * kk, tTop - 0.75 * kk); if (hasBall) ballAt = [0.52 * kk, tTop - 0.85 * kk]; }
  else if (pt === 'swat') { arm(L_, -st); armTo(R_, pdir * 0.35 * kk, tTop - 0.75 * kk); }
  else if (pt === 'incomp') { armTo(L_, -0.8 * kk, tTop + 0.15 * kk); armTo(R_, 0.8 * kk, tTop + 0.15 * kk); }
  else { arm(L_, -st); arm(R_, st); }
  // number (back for offense, chest for defense)
  if (k >= 10) {
    ctx.save(); ctx.scale(1 / bw, 1 / bh);
    const fs = Math.round(0.44 * kk * (facing === 'back' ? 1 : 0.8));
    ctx.font = `800 ${fs}px 'Saira Condensed', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(1.5, 0.06 * kk); ctx.strokeStyle = home ? shade(trim, -0.2) : shade(team.c1, 0.3);
    const ny = (tTop + tH * (facing === 'back' ? 0.5 : 0.55)) * bh;
    ctx.strokeText(String(e.p.num), 0, ny); ctx.fillStyle = home ? '#ffffff' : team.c1; ctx.fillText(String(e.p.num), 0, ny);
    ctx.restore();
  }
  // ---- helmet ----
  const hy = -1.88 * kk, hr = 0.27 * kk;
  const hg = ctx.createRadialGradient(-hr * 0.35, hy - hr * 0.4, hr * 0.1, 0, hy, hr * 1.05);
  hg.addColorStop(0, shade(helmet, 0.55)); hg.addColorStop(0.45, helmet); hg.addColorStop(1, shade(helmet, -0.45));
  ctx.fillStyle = hg; ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, 0.035 * kk);
  ctx.beginPath(); ctx.arc(0, hy, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = team.c2; ctx.lineWidth = Math.max(1, 0.07 * kk); ctx.beginPath(); ctx.moveTo(0, hy - hr); ctx.lineTo(0, hy + (facing === 'back' ? hr * 0.75 : -hr * 0.2)); ctx.stroke();
  if (facing === 'front') { // facemask + skin under it
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, hy + hr * 0.42, hr * 0.5, hr * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = Math.max(1, 0.045 * kk);
    ctx.beginPath(); ctx.moveTo(-hr * 0.62, hy + hr * 0.25); ctx.lineTo(hr * 0.62, hy + hr * 0.25); ctx.moveTo(-hr * 0.5, hy + hr * 0.55); ctx.lineTo(hr * 0.5, hy + hr * 0.55); ctx.moveTo(0, hy + hr * 0.25); ctx.lineTo(0, hy + hr * 0.8); ctx.stroke();
  } else { // back of the helmet: neck + collar
    ctx.fillStyle = skin; ctx.fillRect(-hr * 0.35, hy + hr * 0.75, hr * 0.7, hr * 0.35);
  }
  if (ballAt) drawBall(ctx, ballAt[0], ballAt[1], 0.18 * kk, 0);
  ctx.restore(); ctx.restore();
  if (selected) {
    const ty = Y - 2.45 * k * bh;
    ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X, ty); ctx.lineTo(X - 0.24 * k, ty - 0.34 * k); ctx.lineTo(X + 0.24 * k, ty - 0.34 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
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


// ---------- animation state ----------
LiveGame.prototype.poseFor = function (e) {
  const a = e.anim, now = this.t2 || 0;
  if (a) { const k = (now - a.t0) / a.dur; if (k < 1 || a.hold) return { type: a.type, k: clamp(k, 0, 1), dir: a.dir || 1 }; }
  const pl = this.play, b = this.ball; if (!pl || this.phase !== 'live') return null;
  const car = this.carrier();
  if (e.dive > 0 && car) return { type: 'dive', k: 1, dir: Math.sign(car.y - e.y) || 1 };
  if (e.eng) return { type: 'block', k: 1, dir: Math.sign(e.eng.y - e.y) || (e.side === 'O' ? 1 : -1) };
  if (b && b.state === 'air') {
    const left = b.T - b.t;
    if (pl.target === e && left < 0.6) return { type: 'reach', k: 1, dir: Math.sign(b.ty - e.y) || 1 };
    if (e.side !== (pl.target ? pl.target.side : 'O') && e.ballChase && left < 0.45 && Math.hypot(e.x - b.tx, e.y - b.ty) < 2.6) return { type: 'swat', k: 1, dir: Math.sign(b.ty - e.y) || 1 };
  }
  if (car === e && e === this.passer && this.passReady && !pl.thrown && !pl.crossed) return { type: 'qbready', k: 1 };
  return null;
};
const _throwAnim = LiveGame.prototype.throwBall;
LiveGame.prototype.throwBall = function (r) {
  const qb = this.passer, was = this.play.thrown;
  _throwAnim.call(this, r);
  if (!was && this.play.thrown && qb) qb.anim = { type: 'throw', t0: this.t2, dur: 0.55 };
};
const _resolveAnim = LiveGame.prototype.resolvePass;
LiveGame.prototype.resolvePass = function () {
  const r = this.play.target;
  _resolveAnim.call(this);
  const pl = this.play;
  if (!r) return;
  if (pl.caught && this.ball.holder === r) r.anim = { type: 'secure', t0: this.t2, dur: 0.45 };
  else if (pl.int) { this.cheer = 1; }
  else if (!pl.caught) r.anim = { type: 'incomp', t0: this.t2, dur: 0.9, hold: true };
};
const _endPlayAnim = LiveGame.prototype.endPlay;
LiveGame.prototype.endPlay = function (kind, msg) {
  const c = this.carrier(), tk = this.tackler, s0 = this.gs.score.slice(), y0 = this.gs.yard, los = this.los;
  _endPlayAnim.call(this, kind, msg);
  const now = this.t2 || 0;
  if (c && kind === 'tackle') {
    const dir = tk ? (Math.sign(c.y - tk.y) || (chance(0.5) ? 1 : -1)) : (chance(0.5) ? 1 : -1);
    c.anim = { type: 'down', t0: now, dur: 0.4, dir, hold: true };
    if (tk) tk.anim = { type: 'wrap', t0: now, dur: 0.32, dir, hold: true };
  }
  if (c && (this.gs.score[0] - s0[0] >= 6 || this.gs.score[1] - s0[1] >= 6)) { c.anim = { type: 'celebrate', t0: now, dur: 2.5, hold: true }; this.cheer = 1; }
  else if (c && c.x - (los || 0) >= 15) this.cheer = Math.max(this.cheer || 0, 0.7);
};
