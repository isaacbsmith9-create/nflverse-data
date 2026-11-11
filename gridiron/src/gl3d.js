// ============================================================
// Gridiron Dynasty - real 3D renderer (Three.js / WebGL)
// World: x 0..120 downfield, y 0..53.33 lateral (offense attacks +x).
// Three.js axes: X = y - MID_Y (right), Y = up, Z = -(x - 60) (downfield is -Z).
// Falls back to the 2D broadcast renderer when WebGL/Three.js is missing.
// ============================================================
'use strict';

const GL = { ok: null, renderer: null, canvas: null };
function glAvailable() {
  if (GL.ok !== null) return GL.ok;
  try {
    if (typeof THREE === 'undefined') return (GL.ok = false);
    GL.canvas = document.getElementById('gl');
    if (!GL.canvas) return (GL.ok = false);
    GL.renderer = new THREE.WebGLRenderer({ canvas: GL.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    GL.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    GL.renderer.shadowMap.enabled = true; GL.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    GL.renderer.outputEncoding = THREE.sRGBEncoding;
    GL.ok = true;
  } catch (e) { console.warn('WebGL unavailable', e); GL.ok = false; }
  return GL.ok;
}
const W2T = (x, y, h = 0) => new THREE.Vector3(y - MID_Y, h, -(x - 60));

// ---------- shared materials / geometry ----------
const _matCache = {};
function stdMat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!_matCache[key]) { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05 }, opts)); m.color.convertSRGBToLinear(); _matCache[key] = m; }
  return _matCache[key];
}
let _geo = null;
function geos() {
  if (_geo) return _geo;
  _geo = {
    thigh: new THREE.CylinderGeometry(0.11, 0.09, 0.46, 8), shin: new THREE.CylinderGeometry(0.085, 0.065, 0.46, 8),
    foot: new THREE.BoxGeometry(0.13, 0.08, 0.26), pelvis: new THREE.BoxGeometry(0.42, 0.22, 0.26),
    torso: new THREE.CylinderGeometry(0.3, 0.22, 0.7, 10), pads: new THREE.SphereGeometry(0.3, 12, 8),
    upperArm: new THREE.CylinderGeometry(0.085, 0.075, 0.32, 8), foreArm: new THREE.CylinderGeometry(0.07, 0.06, 0.3, 8),
    hand: new THREE.SphereGeometry(0.07, 8, 6), helmet: new THREE.SphereGeometry(0.21, 16, 12),
    mask: new THREE.BoxGeometry(0.26, 0.11, 0.04), stripe: new THREE.BoxGeometry(0.05, 0.02, 0.36),
    num: new THREE.PlaneGeometry(0.34, 0.34), neck: new THREE.CylinderGeometry(0.07, 0.08, 0.14, 8),
    ring: new THREE.RingGeometry(0.75, 0.95, 32), arrow: new THREE.ConeGeometry(0.22, 0.4, 12),
  };
  return _geo;
}
const _numTex = {};
function numberTexture(num, fg, stroke) {
  const key = num + fg + stroke;
  if (_numTex[key]) return _numTex[key];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.font = "800 92px 'Saira Condensed', 'Arial Narrow', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = stroke; g.strokeText(String(num), 64, 70); g.fillStyle = fg; g.fillText(String(num), 64, 70);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; _numTex[key] = t; return t;
}

// ---------- player model ----------
function makePlayerModel(team, home, num, side, role) {
  const G = geos();
  const pos = role.replace(/[0-9]/, '');
  const [bw, bh] = (typeof BUILD !== 'undefined' && BUILD[pos]) || [1, 1];
  const jersey = home ? team.c1 : '#f2f2f2', trim = home ? team.c2 : team.c1, pants = home ? '#e6e6e6' : shade(team.c1, -0.05);
  const sock = home ? team.c1 : shade(team.c1, -0.1);
  const skins = ['#c68a5e', '#7b4a2e', '#a76d47', '#e0b48c'];
  const skin = skins[num % skins.length];
  const mJ = stdMat(jersey), mP = stdMat(pants), mS = stdMat(sock), mSk = stdMat(skin, { roughness: 0.6 }), mShoe = stdMat('#151515', { roughness: 0.5 });
  const mHelm = stdMat(team.c1, { roughness: 0.28, metalness: 0.35 }), mMask = stdMat('#c8c8c8', { metalness: 0.6, roughness: 0.3 }), mTrim = stdMat(trim);
  const cast = o => { o.castShadow = true; return o; };
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const body = new THREE.Group(); body.scale.set(bw, bh, bw); tilt.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  const pelvis = cast(new THREE.Mesh(G.pelvis, mP)); hips.add(pelvis);
  const legs = [-1, 1].map(sx => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.13, -0.05, 0); hips.add(hip);
    const th = cast(new THREE.Mesh(G.thigh, mP)); th.position.y = -0.23; hip.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    const sh = cast(new THREE.Mesh(G.shin, mS)); sh.position.y = -0.23; knee.add(sh);
    const ft = cast(new THREE.Mesh(G.foot, mShoe)); ft.position.set(0, -0.46, 0.05); knee.add(ft);
    const st = new THREE.Mesh(G.stripe, mTrim); st.scale.set(0.8, 1, 1.2); st.rotation.x = Math.PI / 2; st.position.set(sx * 0.1, -0.2, 0); hip.add(st);
    return { hip, knee };
  });
  const torso = new THREE.Group(); torso.position.y = 1.0; body.add(torso);
  const chest = cast(new THREE.Mesh(G.torso, mJ)); chest.position.y = 0.32; torso.add(chest);
  const pads = cast(new THREE.Mesh(G.pads, mJ)); pads.scale.set(1.45, 0.45, 0.95); pads.position.y = 0.62; torso.add(pads);
  const numFg = home ? '#ffffff' : team.c1, numSt = home ? shade(trim, -0.2) : shade(team.c1, 0.4);
  const nm = new THREE.MeshBasicMaterial({ map: numberTexture(num, numFg, numSt), transparent: true });
  const back = new THREE.Mesh(G.num, nm); back.position.set(0, 0.36, -0.265); back.rotation.y = Math.PI; torso.add(back);
  const front = new THREE.Mesh(G.num, nm); front.scale.setScalar(0.8); front.position.set(0, 0.36, 0.265); torso.add(front);
  const arms = [-1, 1].map(sx => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.4, 0.6, 0); torso.add(sh);
    const ua = cast(new THREE.Mesh(G.upperArm, mJ)); ua.position.y = -0.16; sh.add(ua);
    const band = new THREE.Mesh(G.stripe, mTrim); band.rotation.x = Math.PI / 2; band.scale.set(1.8, 1, 0.5); band.position.y = -0.08; sh.add(band);
    const el = new THREE.Group(); el.position.y = -0.32; sh.add(el);
    const fa = cast(new THREE.Mesh(G.foreArm, mSk)); fa.position.y = -0.15; el.add(fa);
    const hd = cast(new THREE.Mesh(G.hand, pos === 'OL' || pos === 'DL' ? mShoe : mTrim)); hd.position.y = -0.31; el.add(hd);
    return { sh, el, hd };
  });
  const head = new THREE.Group(); head.position.y = 0.93; torso.add(head);
  const neck = new THREE.Mesh(G.neck, mSk); neck.position.y = -0.12; head.add(neck);
  const helm = cast(new THREE.Mesh(G.helmet, mHelm)); helm.scale.set(1, 1, 1.1); head.add(helm);
  const stripe = new THREE.Mesh(G.stripe, mTrim); stripe.position.set(0, 0.2, -0.02); head.add(stripe);
  const mask = new THREE.Mesh(G.mask, mMask); mask.position.set(0, -0.06, 0.2); head.add(mask);
  const mask2 = new THREE.Mesh(G.mask, mMask); mask2.scale.set(0.8, 0.5, 1); mask2.position.set(0, 0.02, 0.21); head.add(mask2);
  return { root, tilt, body, hips, legs, torso, arms, head, yaw: side === 'O' ? Math.PI : 0 };
}

// ---------- field texture ----------
function fieldCanvas(lg) {
  const S = 18, X0 = -10, X1 = 130, Y0 = -10, Y1 = FIELD_W + 10;
  const cw = Math.round((Y1 - Y0) * S), ch = Math.round((X1 - X0) * S);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
  const P = (x, y) => [(y - Y0) * S, (X1 - x) * S];
  const offT = lg.teamOf(lg.gs.poss), defT = lg.teamOf(1 - lg.gs.poss), homeT = lg.teamOf(0), awayT = lg.teamOf(1);
  g.fillStyle = '#1d5629'; g.fillRect(0, 0, cw, ch);
  // field stripes
  for (let x = 10; x < 110; x += 5) { const [a, b] = P(x + 5, 0), [, d] = P(x, 0); g.fillStyle = ((x - 10) / 5) % 2 ? '#2f8c40' : '#2a7f39'; g.fillRect(a, b, FIELD_W * S, d - b); }
  for (let i = 0; i < 10; i++) if (i % 2) { const [a, b] = P(110, i * FIELD_W / 10); g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(a, b, FIELD_W / 10 * S, 100 * S); }
  // grain
  for (let i = 0; i < cw * ch / 60; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.03)'; g.fillRect(Math.random() * cw, Math.random() * ch, 1.5, 2.5); }
  // end zones
  for (const [ez, t] of [[0, offT], [110, defT]]) {
    const [a, b] = P(ez + 10, 0); g.fillStyle = t.c1; g.fillRect(a, b, FIELD_W * S, 10 * S);
    g.save(); g.beginPath(); g.rect(a, b, FIELD_W * S, 10 * S); g.clip(); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = S;
    for (let d = -20; d < 80; d += 3.2) { const [p1, q1] = P(ez, d), [p2, q2] = P(ez + 10, d + 10); g.beginPath(); g.moveTo(p1, q1); g.lineTo(p2, q2); g.stroke(); } g.restore();
    const [cx, cy] = P(ez + 5, MID_Y);
    g.font = `800 ${Math.round(6.4 * S)}px 'Saira Condensed', 'Arial Narrow', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 0.5 * S; g.strokeStyle = shade(t.c1, -0.5); g.strokeText(t.name.toUpperCase(), cx, cy); g.fillStyle = '#fff'; g.fillText(t.name.toUpperCase(), cx, cy);
    const img = typeof emblemImage === 'function' ? emblemImage(t) : null;
    if (img) for (const yy of [6, FIELD_W - 6]) { const [ix, iy] = P(ez + 5, yy); g.drawImage(img, ix - 3.5 * S, iy - 3.5 * S, 7 * S, 7 * S); }
  }
  // sideline border + benches
  g.fillStyle = 'rgba(255,255,255,.14)'; { const [a, b] = P(X1, -2); g.fillRect(a, b, 2 * S, ch); const [a2] = P(X1, FIELD_W); g.fillRect(a2, b, 2 * S, ch); }
  g.fillStyle = shade(homeT.c1, -0.35); { const [a, b] = P(85, -9); g.fillRect(a, b, 5 * S, 50 * S); }
  g.fillStyle = shade(awayT.c1, -0.35); { const [a, b] = P(85, FIELD_W + 4); g.fillRect(a, b, 5 * S, 50 * S); }
  // paint
  g.strokeStyle = 'rgba(255,255,255,.92)';
  const ln = (x1, y1, x2, y2, w) => { const [a, b] = P(x1, y1), [c2, d] = P(x2, y2); g.lineWidth = w * S; g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); };
  for (let x = 0; x <= 120; x += 5) ln(x, 0, x, FIELD_W, x === 10 || x === 110 ? 0.22 : 0.12);
  ln(-1, 0, 121, 0, 0.3); ln(-1, FIELD_W, 121, FIELD_W, 0.3);
  for (let x = 11; x < 110; x++) { if (x % 5 === 0) continue; for (const hy of [0.6, HASH_L, HASH_R, FIELD_W - 0.6]) ln(x, hy - 0.4, x, hy + 0.4, 0.1); }
  g.fillStyle = 'rgba(255,255,255,.92)'; g.font = `800 ${Math.round(2.4 * S)}px 'Saira Condensed', 'Arial Narrow', sans-serif`;
  for (let x = 20; x <= 100; x += 10) {
    const n = x <= 60 ? x - 10 : 110 - x;
    for (const yy of [9, FIELD_W - 9]) {
      const [a, b] = P(x, yy); g.fillText(String(n), a, b);
      if (n !== 50) { const dir = x < 60 ? -1 : 1; const [p1, q1] = P(x + dir * 1.7, yy - 1.4), [p2, q2] = P(x + dir * 1.7, yy + 1.4), [p3, q3] = P(x + dir * 2.6, yy); g.beginPath(); g.moveTo(p1, q1); g.lineTo(p2, q2); g.lineTo(p3, q3); g.fill(); }
    }
  }
  const mid = typeof emblemImage === 'function' ? emblemImage(homeT) : null;
  if (mid) { const [a, b] = P(60, MID_Y); g.drawImage(mid, a - 6.5 * S, b - 6.5 * S, 13 * S, 13 * S); }
  return { c, ready: !!mid, key: lg.gs.poss + '|' + homeT.abbr + awayT.abbr, X0, X1, Y0, Y1 };
}

// ---------- scene ----------
function buildScene(lg) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070b12').convertSRGBToLinear();
  scene.fog = new THREE.Fog('#0a1220', 120, 260);
  const hemi = new THREE.HemisphereLight('#cfe0ff', '#24402a', 0.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff6e6', 0.95); sun.position.set(-30, 70, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -35; sc.right = 35; sc.top = 35; sc.bottom = -35; sc.near = 10; sc.far = 200; sun.shadow.bias = -0.0008;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#9fb8ff', 0.25); fill.position.set(40, 40, -60); scene.add(fill);
  // field
  const fc = fieldCanvas(lg);
  const ftex = new THREE.CanvasTexture(fc.c); ftex.encoding = THREE.sRGBEncoding; ftex.anisotropy = GL.renderer.capabilities.getMaxAnisotropy();
  const field = new THREE.Mesh(new THREE.PlaneGeometry(fc.Y1 - fc.Y0, fc.X1 - fc.X0), new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.95 }));
  field.rotation.x = -Math.PI / 2; field.position.copy(W2T((fc.X0 + fc.X1) / 2, (fc.Y0 + fc.Y1) / 2, 0)); field.receiveShadow = true; scene.add(field);
  // apron beyond the texture
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(260, 400), stdMat('#173f22', { roughness: 1 })); apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; apron.receiveShadow = true; scene.add(apron);
  // stands
  const homeT = lg.teamOf(0);
  const ctx2 = document.getElementById('cv').getContext('2d');
  crowdPatterns(ctx2, homeT.c1, homeT.c2);
  const crowdTex = _crowdPat.cvs.map(cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; });
  const crowdMat = new THREE.MeshStandardMaterial({ map: crowdTex[0], roughness: 1 });
  const wallMat = stdMat(shade(homeT.c1, -0.25)), trimMat = stdMat(homeT.c2);
  const stand = (x1, y1, x2, y2, along) => { // sloped crowd surface from the wall line up and back
    const a = W2T(x1, y1, 2.6), b = W2T(x2, y2, 2.6);
    const len = a.distanceTo(b), depth = 34, rise = 24;
    const geo = new THREE.PlaneGeometry(len, Math.hypot(depth, rise));
    const t = crowdTex.map(tx => tx); // shared
    const m = new THREE.Mesh(geo, crowdMat);
    const midp = a.clone().add(b).multiplyScalar(0.5);
    const outward = along === 'x' ? new THREE.Vector3(Math.sign(midp.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(midp.z) || -1);
    m.position.copy(midp).add(outward.clone().multiplyScalar(depth / 2)).add(new THREE.Vector3(0, rise / 2, 0));
    m.lookAt(m.position.clone().sub(outward).add(new THREE.Vector3(0, depth / rise * 0.0 + 1.4, 0)));
    // orient: face the field, tilted back
    m.rotation.set(0, 0, 0);
    if (along === 'x') { m.rotation.y = outward.x > 0 ? -Math.PI / 2 : Math.PI / 2; m.rotateX(-Math.atan2(rise, depth)); }
    else { m.rotation.y = outward.z < 0 ? 0 : Math.PI; m.rotateX(-Math.atan2(rise, depth)); }
    scene.add(m);
    crowdMat.map.repeat.set(len / 9, Math.hypot(depth, rise) / 5);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(along === 'x' ? 0.5 : len, 2.6, along === 'x' ? len : 0.5), wallMat);
    wall.position.copy(midp).sub(new THREE.Vector3(0, 1.3, 0)); scene.add(wall);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(along === 'x' ? 0.55 : len, 0.25, along === 'x' ? len : 0.55), trimMat); tr.position.copy(midp); scene.add(tr);
  };
  stand(-25, -12, 145, -12, 'x'); stand(-25, FIELD_W + 12, 145, FIELD_W + 12, 'x'); stand(126, -45, 126, FIELD_W + 45, 'z');
  // light towers
  const towerMat = stdMat('#20252e'), lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff8e0').convertSRGBToLinear() });
  for (const [x, y] of [[20, -30], [100, -30], [20, FIELD_W + 30], [100, FIELD_W + 30]]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(1, 50, 1), towerMat); pole.position.copy(W2T(x, y, 25)); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 0.6), lampMat); lamp.position.copy(W2T(x, y, 50)); lamp.lookAt(W2T(60, MID_Y, 0)); scene.add(lamp);
  }
  // goal posts
  const postMat = stdMat('#f4c20d', { roughness: 0.4, metalness: 0.2 }), padMat = stdMat(lg.teamOf(1 - lg.gs.poss).c1);
  for (const gx of [0, 120]) {
    const back = gx === 120 ? 2 : -2;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.3, 12), padMat); base.position.copy(W2T(gx + back, MID_Y, 1.65)); scene.add(base);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, Math.abs(back), 8), postMat); neck.rotation.x = Math.PI / 2; neck.position.copy(W2T(gx + back / 2, MID_Y, 3.3)); scene.add(neck);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6.2, 8), postMat); bar.rotation.z = Math.PI / 2; bar.position.copy(W2T(gx, MID_Y, 3.3)); scene.add(bar);
    for (const s2 of [-3.1, 3.1]) { const up = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 8), postMat); up.position.copy(W2T(gx, MID_Y + s2, 7.8)); scene.add(up); }
  }
  // line of scrimmage / first down markers (repositioned per play)
  const mkLine = col => { const m = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, 0.32), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).convertSRGBToLinear(), transparent: true, opacity: 0.95 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; scene.add(m); return m; };
  const los = mkLine('#5aa5ff'), fd = mkLine('#ffdc28');
  // selection ring + arrow
  const ring = new THREE.Mesh(geos().ring, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe14d').convertSRGBToLinear(), transparent: true, opacity: 0.9, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; scene.add(ring);
  const arrow = new THREE.Mesh(geos().arrow, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe14d').convertSRGBToLinear() })); arrow.rotation.x = Math.PI; scene.add(arrow);
  // ball
  const ball = new THREE.Group();
  const bm = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), stdMat('#7a3d14', { roughness: 0.55 })); bm.scale.set(1, 1, 1.65); bm.castShadow = true; ball.add(bm);
  const lace = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.12), stdMat('#ffffff')); lace.position.y = 0.105; ball.add(lace);
  scene.add(ball);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 600);
  return { scene, camera, sun, field, ftex, fc, los, fd, ring, arrow, ball, models: {}, crowdMat, crowdTex };
}

// ---------- per-frame pose for a model ----------
function poseModel(m, e, pose, sp, t2) {
  const run = Math.min(1, sp / 5), s = Math.sin(e.phase || 0) * run;
  const [L, R] = m.legs, [AL, AR] = m.arms;
  // defaults: run cycle
  L.hip.rotation.x = -s * 0.85; R.hip.rotation.x = s * 0.85;
  L.knee.rotation.x = 0.15 + Math.max(0, s) * 1.2 * run; R.knee.rotation.x = 0.15 + Math.max(0, -s) * 1.2 * run;
  AL.sh.rotation.set(s * 0.8, 0, -0.12); AR.sh.rotation.set(-s * 0.8, 0, 0.12);
  AL.el.rotation.x = -0.4 - run * 0.8; AR.el.rotation.x = -0.4 - run * 0.8;
  m.torso.rotation.set(0.12 * run, 0, 0); m.tilt.rotation.set(0, 0, 0); m.body.position.y = Math.abs(Math.cos(e.phase || 0)) * run * 0.06;
  if (!sp || sp < 0.3) { L.hip.rotation.x = -0.05; R.hip.rotation.x = 0.05; L.knee.rotation.x = R.knee.rotation.x = 0.25; m.torso.rotation.x = 0.08; m.body.position.y = -0.03; }
  if (e.stun > 0 && !pose) m.tilt.rotation.x = Math.sin(e.stun * 9) * 0.3;
  if (!pose) return;
  const k = pose.k, ease = 1 - Math.pow(1 - k, 3);
  switch (pose.type) {
    case 'qbready': AR.sh.rotation.set(-2.3, 0, 0.35); AR.el.rotation.x = -1.6; AL.sh.rotation.set(-1.0, 0, -0.2); AL.el.rotation.x = -1.5; break;
    case 'throw':
      if (k < 0.3) { AR.sh.rotation.set(-2.9, 0, 0.5); AR.el.rotation.x = -1.9; m.torso.rotation.y = 0.5; AL.sh.rotation.set(-1.3, 0, -0.3); AL.el.rotation.x = -0.6; }
      else { const f = (k - 0.3) / 0.7; AR.sh.rotation.set(-2.9 + f * 2.3, 0, 0.5 - f * 0.9); AR.el.rotation.x = -1.9 + f * 1.7; m.torso.rotation.y = 0.5 - f * 0.9; m.torso.rotation.x = 0.1 + f * 0.25; AL.sh.rotation.set(-0.6, 0, -0.5); AL.el.rotation.x = -1.0; }
      break;
    case 'reach': AL.sh.rotation.set(-2.85, 0, -0.15); AR.sh.rotation.set(-2.85, 0, 0.15); AL.el.rotation.x = AR.el.rotation.x = -0.25; m.torso.rotation.x = -0.05; break;
    case 'secure': AL.sh.rotation.set(-0.5, 0, 0.35); AR.sh.rotation.set(-0.5, 0, -0.35); AL.el.rotation.x = AR.el.rotation.x = -2.0; break;
    case 'block': AL.sh.rotation.set(-1.45, 0, 0.15); AR.sh.rotation.set(-1.45, 0, -0.15); AL.el.rotation.x = AR.el.rotation.x = -0.35; m.torso.rotation.x = 0.4; L.knee.rotation.x = R.knee.rotation.x = 0.55; L.hip.rotation.x = -0.4; R.hip.rotation.x = 0.1; break;
    case 'wrap': case 'dive':
      AL.sh.rotation.set(-1.6, 0, 0.3); AR.sh.rotation.set(-1.6, 0, -0.3); AL.el.rotation.x = AR.el.rotation.x = -0.3;
      m.tilt.rotation.x = (pose.type === 'dive' ? 1.05 : ease * 1.3); m.body.position.y = 0; break;
    case 'down': m.tilt.rotation.x = -ease * 1.5; AL.sh.rotation.set(-0.4, 0, -0.9); AR.sh.rotation.set(-0.4, 0, 0.9); L.knee.rotation.x = 0.6; break;
    case 'celebrate': AL.sh.rotation.set(-3.0, 0, -0.35); AR.sh.rotation.set(-3.0, 0, 0.35); AL.el.rotation.x = AR.el.rotation.x = -0.2; m.body.position.y = Math.abs(Math.sin(t2 * 9)) * 0.35; break;
    case 'incomp': AL.sh.rotation.set(-0.2, 0, -1.3); AR.sh.rotation.set(-0.2, 0, 1.3); AL.el.rotation.x = AR.el.rotation.x = -0.2; break;
    case 'swat': AR.sh.rotation.set(-2.95, 0, 0.2); AR.el.rotation.x = -0.1; break;
  }
}

// ---------- render ----------
LiveGame.prototype.renderGL = function (ctx, W, H) {
  const lg = this, gs = this.gs;
  if (!this.gl) this.gl = buildScene(this);
  const S = this.gl, { scene, camera } = S;
  // field texture refresh when possession flips or emblems finish loading
  const key = gs.poss + '|' + this.teamOf(0).abbr + this.teamOf(1).abbr;
  if (S.fc.key !== key || (!S.fc.ready && typeof emblemImage === 'function' && emblemImage(this.teamOf(0)))) {
    S.fc = fieldCanvas(this); S.ftex.image = S.fc.c; S.ftex.needsUpdate = true;
  }
  // renderer size
  const r = GL.renderer;
  if (S.w !== W || S.h !== H) { r.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); S.w = W; S.h = H; }
  // crowd animation (shares the 2D crowd's cheer state)
  this.cheer = Math.max(0, (this.cheer || 0) - 1 / 240);
  if (!this._cfT || this.t2 - this._cfT > (this.cheer > 0.2 ? 0.16 : 0.45)) { this._cfT = this.t2; this._cf = this.cheer > 0.2 ? 1 + ((this._cf || 0) % 2) : (Math.random() < 0.85 ? 0 : 1); }
  const ct = S.crowdTex[this._cf || 0]; if (S.crowdMat.map !== ct) { ct.repeat.copy(S.crowdMat.map.repeat); S.crowdMat.map = ct; S.crowdMat.needsUpdate = true; }
  // camera: high, behind the offense, long lens
  const portrait = H > W * 1.05;
  const pocket = this.phase === 'pre' || this.phase === 'call' || (this.phase === 'live' && this.carrier() === this.passer && this.passReady && !this.play.crossed);
  this.glBack = (this.glBack == null ? 38 : this.glBack) + ((pocket ? 38 : 34) - (this.glBack == null ? 38 : this.glBack)) * 0.06;
  const cy = clamp(this.cam.y, MID_Y - 14, MID_Y + 14);
  const fastCam = this.ball && (this.ball.state === 'air' || this.ball.state === 'pitch' || (this.play && (this.play.caught || this.play.int)));
  this.glCamY = this.glCamY == null ? cy : this.glCamY + (cy - this.glCamY) * (fastCam ? 0.12 : 0.08);
  const fx = this.cam.x;
  camera.fov = portrait ? 58 : 40; camera.updateProjectionMatrix();
  camera.position.copy(W2T(fx - this.glBack, this.glCamY, this.glBack * 0.72));
  camera.lookAt(W2T(fx - 3, this.glCamY, 0));
  S.sun.target.position.copy(W2T(fx + 8, this.glCamY, 0)); S.sun.position.copy(W2T(fx - 10, this.glCamY - 30, 70));
  // lines
  const show = ['pre', 'live', 'call', 'kick'].includes(this.phase);
  const losX = this.los || 10 + gs.yard, fdX = this.firstX || Math.min(110, losX + gs.togo);
  S.los.visible = show; S.fd.visible = show && fdX < 110;
  S.los.position.copy(W2T(losX, MID_Y, 0.03)); S.fd.position.copy(W2T(fdX, MID_Y, 0.03));
  // players
  const seen = new Set();
  const carrier = this.carrier();
  for (const e of this.ents) {
    const side = e.side === 'O' ? gs.poss : 1 - gs.poss, t = this.teamOf(side);
    const mk = e.p.id + ':' + side + ':' + e.role.replace(/[0-9]/, '');
    let m = S.models[mk];
    if (!m) { m = makePlayerModel(t, side === 0, e.p.num, e.side, e.role); S.models[mk] = m; scene.add(m.root); }
    seen.add(mk); m.root.visible = true;
    const sp = Math.hypot(e.vx, e.vy); e.phase = (e.phase || Math.random() * 6) + sp * 0.03;
    m.root.position.copy(W2T(e.x, e.y, 0));
    const pose = this.poseFor ? this.poseFor(e) : null;
    // facing: velocity, or default facing for the side; falls face along the hit
    let want = m.yawWant != null ? m.yawWant : (e.side === 'O' ? Math.PI : 0);
    if (sp > 0.8) want = Math.atan2(e.vy, -e.vx);
    else if (this.phase === 'pre') want = e.side === 'O' ? Math.PI : 0;
    if (pose && (pose.type === 'down' || pose.type === 'wrap') && e.anim && e.anim.fy != null) want = Math.atan2(e.anim.fy, -e.anim.fx) + (pose.type === 'down' ? Math.PI : 0);
    if (pose && (pose.type === 'throw' || pose.type === 'qbready')) want = Math.PI;
    m.yawWant = want;
    let dy = want - m.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    m.yaw += dy * Math.min(1, 0.25 + sp * 0.04); m.root.rotation.y = m.yaw;
    poseModel(m, e, pose, sp, this.t2 || 0);
    m.e = e;
  }
  for (const k in S.models) if (!seen.has(k)) S.models[k].root.visible = false;
  // selection ring
  const c = this.ctrl; S.ring.visible = S.arrow.visible = !!c && this.phase !== 'call';
  if (c) { S.ring.position.copy(W2T(c.x, c.y, 0.04)); S.arrow.position.copy(W2T(c.x, c.y, 2.75 + Math.sin(this.t2 * 5) * 0.08)); }
  // ball
  const b = this.ball; S.ball.visible = !!b && this.phase !== 'call';
  if (b) {
    if (b.state === 'held' && b.holder) {
      const hm = Object.values(S.models).find(mm => mm.e === b.holder && mm.root.visible);
      if (hm) {
        hm.root.updateMatrixWorld(true);
        const pose = this.poseFor ? this.poseFor(b.holder) : null;
        const useHand = pose && ['qbready', 'throw', 'celebrate'].includes(pose.type);
        const pos = new THREE.Vector3();
        if (useHand) hm.arms[1].hd.getWorldPosition(pos); else hm.torso.localToWorld(pos.set(0.3, 0.3, 0.12));
        S.ball.position.copy(pos); S.ball.rotation.set(0.3, hm.yaw, 0);
      }
    } else {
      S.ball.position.copy(W2T(b.x, b.y, 1.3 + (b.z || 0)));
      if (b.state === 'air' || b.state === 'pitch') { const tgt = W2T(b.tx, b.ty, 1.3); S.ball.lookAt(tgt); S.ball.rotateZ(this.t2 * 20); }
    }
  }
  r.render(scene, camera);
  // quality guard: drop shadows / resolution on slow devices, fall back to the classic view if still slow
  const now = performance.now(); const q = this.glPerf || (this.glPerf = { n: 0, t0: now, step: 0 });
  q.n++;
  if (now - q.t0 > 2500 && q.step < 2) {
    const fps = q.n / ((now - q.t0) / 1000); q.n = 0; q.t0 = now;
    if (fps < 24 && q.step === 0) { q.step = 1; r.shadowMap.enabled = false; S.sun.castShadow = false; r.setPixelRatio(1); S.w = 0; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
    else if (fps < 16 && q.step === 1) { q.step = 2; this.camMode = '3d'; if (this.h.toast) this.h.toast('Switched to the classic camera for smoother play on this device. Change it in the pause menu.'); }
    else if (fps >= 24) q.step = 3;
  }
  // ---------- 2D overlays on top ----------
  ctx.clearRect(0, 0, W, H);
  const v = new THREE.Vector3();
  const P = (x, y, h = 0) => { v.copy(W2T(x, y, h)).project(camera); if (v.z > 1) return null; const d = camera.position.distanceTo(W2T(x, y, h)); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, k: H / (2 * Math.tan(camera.fov * Math.PI / 360) * d) }; };
  this._glP = P;
  const showArt = this.userOnOffense() && (this.phase === 'pre' || (this.phase === 'live' && this.t < 0.8));
  if (showArt && this.O) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const kk of ['WR1', 'WR2', 'WR3', 'TE', 'RB', 'QB']) {
      const e = this.O[kk]; if (!e) continue; const tk = e.task; const pts = tk.k === 'route' || tk.k === 'path' ? tk.pts : null; if (!pts) continue;
      const col = tk.k === 'path' ? 'rgba(255,255,255,.9)' : RCOL[this.eligible.indexOf(e)] || '#fff';
      const sp = [[e.x, e.y], ...pts.map(q => [Math.min(q[0], 118), q[1]])].map(([x, y]) => P(x, y, 0.05)).filter(Boolean);
      if (sp.length < 2) continue;
      for (const [w, cc] of [[7, 'rgba(0,0,0,.35)'], [4, col]]) { ctx.strokeStyle = cc; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y); sp.slice(1).forEach(q => ctx.lineTo(q.x, q.y)); ctx.stroke(); }
      const l = sp[sp.length - 1]; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(l.x, l.y, 6, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (this.drawScriptTags) this.drawScriptTags(ctx, P);
  if (this.canUserThrow()) this.eligible.forEach((e, i) => {
    const p = P(e.x, e.y, 2.9); if (!p) return; const rr = clamp(p.k * 0.42, 11, 20);
    ctx.fillStyle = RCOL[i]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.font = `800 ${Math.round(rr * 1.25)}px 'Saira Condensed', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), p.x, p.y + 1);
  });
  if (c && c.p && this.phase !== 'call') {
    const p = P(c.x, c.y, 0); if (p) { const label = c.p.last.toUpperCase(), fs = 13; ctx.font = `800 ${fs}px 'Saira Condensed', system-ui`; const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,.72)'; roundRect(ctx, p.x - tw / 2, p.y + 12, tw, fs + 6, 4); ctx.fill(); ctx.fillStyle = '#ffe14d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, p.x, p.y + 12 + fs / 2 + 3); }
  }
  for (const f of this.effects) {
    f.t += 1 / 60; if (f.t > 1.2) continue; const p = P(f.x, f.y, 3 + f.t * 2); if (!p) continue;
    ctx.globalAlpha = 1 - f.t / 1.2; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.font = `800 italic 28px 'Saira Condensed', system-ui`; ctx.textAlign = 'center'; ctx.strokeText(f.txt, p.x, p.y); ctx.fillText(f.txt, p.x, p.y); ctx.globalAlpha = 1;
  }
  this.effects = this.effects.filter(f => f.t <= 1.2);
  this.parts = this.parts || [];
  for (const q of this.parts) {
    if (q.kind !== 'confetti') continue;
    q.t += 1 / 60; q.x += q.vx; q.y += q.vy; q.vy += 0.06; q.vx *= 0.99; q.rot += q.vr;
    ctx.save(); ctx.translate(q.x * W, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.c; ctx.globalAlpha = Math.max(0, 1 - q.t / 3); ctx.fillRect(-4, -2, 8, Math.abs(Math.cos(q.rot)) * 5 + 1); ctx.restore();
  }
  this.parts = this.parts.filter(q => q.kind === 'dust' ? (q.t += 1 / 60) < 1 : q.t < 3 && q.y < H + 20);
  if (this.phase === 'kick') this.renderKick(ctx, W, H);
};

// route the renderer: 'gl' (3D), '3d' (classic 2D broadcast), 'top'
const _renderPick = LiveGame.prototype.render;
LiveGame.prototype.render = function (ctx, W, H) {
  const gl = document.getElementById('gl');
  if (this.camMode === 'gl' && glAvailable()) { if (gl) gl.style.display = 'block'; return this.renderGL(ctx, W, H); }
  if (gl) gl.style.display = 'none';
  if (this.camMode === 'gl') this.camMode = '3d';
  return _renderPick.call(this, ctx, W, H);
};
// tap-to-throw in 3D
const _recvAtGL = LiveGame.prototype.receiverAt;
LiveGame.prototype.receiverAt = function (px, py) {
  if (this.camMode !== 'gl' || !this._glP) return _recvAtGL.call(this, px, py);
  let best = null, bd = 1e9;
  for (const e of this.eligible || []) { const p = this._glP(e.x, e.y, 1.2); if (!p) continue; const d = Math.hypot(p.x - px, p.y - py); if (d < 60 && d < bd) { bd = d; best = e; } }
  return best;
};
// falls follow the line of the hit in 3D
const _endPlayGL = LiveGame.prototype.endPlay;
LiveGame.prototype.endPlay = function (kind, msg) {
  const c = this.carrier(), tk = this.tackler;
  _endPlayGL.call(this, kind, msg);
  if (c && tk && kind === 'tackle') {
    const fx = c.x - tk.x, fy = c.y - tk.y;
    if (c.anim) { c.anim.fx = fx; c.anim.fy = fy; }
    if (tk.anim) { tk.anim.fx = fx; tk.anim.fy = fy; }
  }
};
