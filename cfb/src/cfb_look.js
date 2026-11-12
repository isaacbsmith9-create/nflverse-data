// ============================================================
// College Gridiron Dynasty - look and sound: generic varsity-letter
// emblems (no school marks), home-team end zones (school name at one
// end, nickname at the other), a marching band and student section in
// the 3D stadium, and an original band riff after a home touchdown.
// ============================================================
'use strict';

// ---------- emblems: block initials in school colors inside a generic frame ----------
const CFB_FRAMES = [
  'M50 4 L92 16 L92 52 C92 76 72 90 50 97 C28 90 8 76 8 52 L8 16 Z',
  'M50 4 A46 46 0 1 1 49.9 4 Z',
  'M12 10 L88 10 L88 70 L50 96 L12 70 Z',
  'M8 20 L50 4 L92 20 L92 80 L50 96 L8 80 Z',
];
emblemSVG = function (t) {
  const h = _h(t.abbr + (t.name || ''));
  const frame = CFB_FRAMES[h % CFB_FRAMES.length];
  const c1 = t.c1, c2 = t.c2 || '#ffffff';
  const ink = _lum(c1) < 0.55 ? (_lum(c2) > 0.45 ? c2 : '#ffffff') : (_lum(c2) < 0.45 ? c2 : '#111111');
  const id = 'c' + h.toString(36);
  const txt = String(t.abbr || '?').slice(0, 4);
  const fs = txt.length >= 4 ? 25 : txt.length === 3 ? 31 : txt.length === 2 ? 42 : 54;
  const band = (h >> 3) % 3;
  const pat = band === 0 ? `<rect x="0" y="66" width="100" height="10" fill="${c2}" opacity=".55"/>` : band === 1 ? `<path d="M0 0 L100 100 L100 84 L16 0 Z" fill="${c2}" opacity=".22"/>` : `<circle cx="50" cy="50" r="34" fill="none" stroke="${c2}" stroke-width="3" opacity=".45"/>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="${id}"><path d="${frame}"/></clipPath></defs>` +
    `<path d="${frame}" fill="${c1}"/><g clip-path="url(#${id})">${pat}</g><path d="${frame}" fill="none" stroke="${c2}" stroke-width="5"/>` +
    `<text x="50" y="${50 + fs * 0.36}" text-anchor="middle" font-family="'Saira Condensed','Arial Narrow',sans-serif" font-weight="800" font-size="${fs}" letter-spacing="-.5" fill="${ink}" stroke="${ink === c2 ? shade(c1, -0.5) : c2}" stroke-width="${fs / 14}" paint-order="stroke">${esc(txt)}</text></svg>`;
};

// ---------- field: home school's colors in both end zones ----------
const _fieldCanvasC = fieldCanvas;
fieldCanvas = function (lg) {
  const out = _fieldCanvasC(lg);
  if (!lg.L || !lg.L.cfb) return out;
  const S = 18, X1 = out.X1, Y0 = out.Y0, g = out.c.getContext('2d');
  const P = (x, y) => [(y - Y0) * S, (X1 - x) * S];
  const H = lg.teamOf(0);
  const words = [H.city.toUpperCase(), H.name.toUpperCase()];
  [[0, 0], [110, 1]].forEach(([ez, wi]) => {
    const [a, b] = P(ez + 10, 0);
    g.fillStyle = H.c1; g.fillRect(a, b, FIELD_W * S, 10 * S);
    // checkerboard border in the second color
    g.fillStyle = H.c2;
    for (let i = 0; i < FIELD_W / 2; i++) if (i % 2 === 0) { const [p, q] = P(ez + 10, i * 2); g.fillRect(p, q, 2 * S, 0.9 * S); const [p2, q2] = P(ez + 0.9, i * 2); g.fillRect(p2, q2, 2 * S, 0.9 * S); }
    const [cx, cy] = P(ez + 5, MID_Y);
    const word = words[wi], size = Math.min(6.4, 44 / Math.max(6, word.length) * 1.6);
    g.font = `800 ${Math.round(size * S)}px 'Saira Condensed', 'Arial Narrow', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 0.7 * S; g.strokeStyle = _lum(H.c2) > 0.6 ? shade(H.c1, -0.55) : H.c2; g.strokeText(word, cx, cy);
    g.fillStyle = _lum(H.c1) > 0.7 ? shade(H.c1, -0.7) : '#ffffff'; g.fillText(word, cx, cy);
  });
  // goal lines stay crisp
  g.strokeStyle = 'rgba(255,255,255,.92)';
  for (const x of [10, 110]) { const [a, b] = P(x, 0), [c, d] = P(x, FIELD_W); g.lineWidth = 0.22 * S; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
  return out;
};

// ---------- stadium: student section + marching band ----------
const _buildSceneC = buildScene;
buildScene = function (lg) {
  const S = _buildSceneC(lg);
  if (!lg.L || !lg.L.cfb) return S;
  try {
    const H = lg.teamOf(0), A = lg.teamOf(1), scene = S.scene;
    // overlay a section of the sideline bleachers (same slope as the shared stands, nudged toward the field)
    const section = (x1, x2, yLine, cv, rep) => {
      const a = W2T(x1, yLine, 2.6), b = W2T(x2, yLine, 2.6), len = a.distanceTo(b), depth = 34, rise = 24;
      const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(len / rep, Math.hypot(depth, rise) / 5); tex.encoding = THREE.sRGBEncoding;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, Math.hypot(depth, rise)), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
      const midp = a.clone().add(b).multiplyScalar(0.5), out = new THREE.Vector3(Math.sign(midp.x) || 1, 0, 0);
      m.position.copy(midp).add(out.clone().multiplyScalar(depth / 2 - 0.35)).add(new THREE.Vector3(0, rise / 2 + 0.25, 0));
      m.rotation.set(0, out.x > 0 ? -Math.PI / 2 : Math.PI / 2, 0); m.rotateX(-Math.atan2(rise, depth));
      scene.add(m);
    };
    const fans = (cA, cB, every) => {
      const cv = document.createElement('canvas'); cv.width = 120; cv.height = 60; const g = cv.getContext('2d');
      g.fillStyle = shade(cA, -0.6); g.fillRect(0, 0, 120, 60);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) {
        const x = c * 10 + (r % 2) * 5 + 1, y = r * 15 + 5;
        g.fillStyle = (r * 3 + c) % every === 0 ? cB : cA; g.fillRect(x, y + 3, 8, 8);
        g.fillStyle = ['#f1c9a5', '#b07a52', '#7b4a2e', '#d9a37a'][(r + c * 3) % 4]; g.beginPath(); g.arc(x + 4, y + 1.5, 2.6, 0, Math.PI * 2); g.fill();
        if ((r + c) % 4 === 0) { g.fillStyle = cA; g.fillRect(x - 1, y - 6, 2, 6); g.fillRect(x + 7, y - 6, 2, 6); } // arms up
      }
      return cv;
    };
    // student section on one sideline: a wall of school colors; visiting fans in a corner on the other side
    section(62, 124, -12, fans(H.c1, H.c2, 5), 10);
    section(96, 124, FIELD_W + 12, fans(A.c1, '#f2f2f2', 3), 10);
    // marching band in the far end zone stands: rows of uniforms with plumes and brass
    // instanced: 4 draw calls for the whole band, cheap on Chromebooks and phones
    const band = new THREE.Group();
    const ROWS = 4, COLS = 18, N = ROWS * COLS;
    const parts = [
      [new THREE.BoxGeometry(0.5, 1.1, 0.35), stdMat(H.c1), 0.55, 0, N],
      [new THREE.CylinderGeometry(0.2, 0.22, 0.45, 6), stdMat('#f5f5f5'), 1.35, 0, N],
      [new THREE.BoxGeometry(0.08, 0.35, 0.08), stdMat(H.c2), 1.75, 0, N],
      [new THREE.CylinderGeometry(0.05, 0.16, 0.5, 6), stdMat('#d9b44a', { metalness: 0.7, roughness: 0.3 }), 1.05, -0.4, N / 2],
    ];
    const m4 = new THREE.Matrix4(), rotX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    for (const [geo, mat, dz, dx, count] of parts) {
      const im = new THREE.InstancedMesh(geo, mat, count); let k = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (count < N && (r + c) % 2) continue;
        const x = 127.2 + r * 1.7 + dx, y = MID_Y - 13 + c * 1.5 + (r % 2) * 0.7, z = 2.6 + (x - dx - 126) * (24 / 34) + dz;
        m4.makeTranslation(...W2T(x, y, z).toArray()); if (count < N) m4.multiply(rotX);
        im.setMatrixAt(k++, m4);
      }
      im.count = k; im.instanceMatrix.needsUpdate = true; band.add(im);
    }
    scene.add(band); S.band = band;
  } catch (e) { console.warn('stadium extras', e); }
  return S;
};
// the band bounces when the crowd cheers
const _renderGLC = LiveGame.prototype.renderGL;
LiveGame.prototype.renderGL = function (ctx, W, H) {
  _renderGLC.call(this, ctx, W, H);
  const S = this.gl; if (S && S.band) S.band.position.y = (this.cheer || 0) > 0.2 ? Math.abs(Math.sin((this.t2 || 0) * 9)) * 0.18 : 0;
};

// ---------- sound: an original fight-song style riff for home touchdowns ----------
const _sfxC = sfx;
sfx = function (kind) {
  _sfxC(kind);
  if (kind !== 'td' || window.__mute || !_actx) return;
  try {
    const a = _actx, t0 = a.currentTime + 0.45;
    const notes = [[392, 0], [523, .16], [659, .32], [784, .48], [659, .72], [784, .84], [1047, 1.0]];
    for (const [f, dt] of notes) for (const [mul, type, v] of [[1, 'sawtooth', .025], [0.5, 'square', .018]]) {
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f * mul;
      const t = t0 + dt, d = dt >= 1 ? 0.5 : 0.15;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
    }
  } catch (e) { }
};
