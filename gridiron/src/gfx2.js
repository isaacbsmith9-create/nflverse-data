// ============================================================
// Gridiron Dynasty - graphics upgrade for the 3D view:
// filmic tone mapping, day / dusk / night skies and stadium lights,
// detailed player models (facemask, collar, sleeve numbers, name bar,
// gloves, cleats), referees, sideline teams, upper deck + ribbon boards,
// end-zone video boards, pylons and chains, ball trail, dust, fireworks,
// camera shake, pregame fly-in and a tighter replay camera.
// ============================================================
'use strict';

// ---------- renderer ----------
const _glAvailG2 = glAvailable;
glAvailable = function () {
  const ok = _glAvailG2();
  if (ok && !GL._tone) { GL._tone = true; GL.renderer.toneMapping = THREE.ACESFilmicToneMapping; GL.renderer.toneMappingExposure = 1.05; }
  return ok;
};

// ---------- helpers ----------
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t._c = c; return t; }
let _glowTex = null;
function glowTex() { return _glowTex || (_glowTex = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,250,230,1)'); r.addColorStop(0.25, 'rgba(255,240,200,.55)'); r.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); })); }
function glowSprite(color, scale) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.scale.set(scale, scale, 1); return s; }
const _nameTex = {};
function nameTexture(name, fg) {
  const k = name + fg; if (_nameTex[k]) return _nameTex[k];
  return (_nameTex[k] = canvasTex(256, 48, (g, w, h) => { g.font = "800 38px 'Saira Condensed', 'Arial Narrow', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(name.toUpperCase().slice(0, 12), w / 2, h / 2 + 2, w - 8); }));
}
let _stripeTex = null;
function refStripeTex() { return _stripeTex || (_stripeTex = canvasTex(64, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#f4f4f4'; g.fillRect(i * 8, 0, 8, 64); } })); }

// ---------- detailed player model (same skeleton the poses use) ----------
let _geo2 = null;
function geos2() {
  if (_geo2) return _geo2;
  const T = THREE;
  _geo2 = {
    thigh: new T.CylinderGeometry(0.115, 0.095, 0.46, 12), shin: new T.CylinderGeometry(0.088, 0.066, 0.46, 12), kneePad: new T.SphereGeometry(0.1, 10, 8),
    cleat: new T.BoxGeometry(0.13, 0.07, 0.27), sole: new T.BoxGeometry(0.135, 0.025, 0.28), band: new T.CylinderGeometry(0.09, 0.09, 0.05, 12),
    pelvis: new T.CylinderGeometry(0.22, 0.2, 0.24, 14), belt: new T.CylinderGeometry(0.225, 0.225, 0.05, 14),
    torso: new T.CylinderGeometry(0.3, 0.225, 0.72, 16), pads: new T.SphereGeometry(0.3, 18, 12), cap: new T.SphereGeometry(0.135, 12, 10), collar: new T.TorusGeometry(0.1, 0.025, 6, 16),
    upperArm: new T.CylinderGeometry(0.083, 0.073, 0.32, 10), foreArm: new T.CylinderGeometry(0.07, 0.058, 0.3, 10), wrist: new T.CylinderGeometry(0.068, 0.068, 0.06, 10), hand: new T.SphereGeometry(0.075, 10, 8),
    helmet: new T.SphereGeometry(0.215, 22, 16), stripe: new T.BoxGeometry(0.05, 0.02, 0.38), decal: new T.CircleGeometry(0.075, 18),
    bar: new T.TorusGeometry(0.19, 0.011, 6, 18, Math.PI * 0.9), vbar: new T.CylinderGeometry(0.011, 0.011, 0.16, 6), visor: new T.PlaneGeometry(0.2, 0.07),
    num: new T.PlaneGeometry(0.34, 0.34), tvnum: new T.PlaneGeometry(0.12, 0.12), name: new T.PlaneGeometry(0.36, 0.068), neck: new T.CylinderGeometry(0.075, 0.085, 0.14, 10),
  };
  return _geo2;
}
makePlayerModel = function (team, home, num, side, role, opts = {}) {
  const G = geos2(), T = THREE;
  const pos = role.replace(/[0-9]/, '');
  const [bw, bh] = (typeof BUILD !== 'undefined' && BUILD[pos]) || [1, 1];
  const ref = !!opts.ref;
  const jersey = ref ? '#ffffff' : home ? team.c1 : '#f3f3f3', trim = ref ? '#111111' : home ? team.c2 : team.c1;
  const pants = ref ? '#f2f2f2' : home ? '#e8e8e8' : shade(team.c1, -0.05), sock = ref ? '#111111' : home ? team.c1 : shade(team.c1, -0.1);
  const skins = ['#c68a5e', '#7b4a2e', '#a76d47', '#e0b48c', '#5e3a22', '#d9a273'];
  const skin = skins[(num * 7 + (opts.seed || 0)) % skins.length];
  const mJ = ref ? new T.MeshStandardMaterial({ map: refStripeTex(), roughness: 0.8 }) : stdMat(jersey, { roughness: 0.7 });
  const mP = stdMat(pants, { roughness: 0.65 }), mS = stdMat(sock), mSk = stdMat(skin, { roughness: 0.55 });
  const mShoe = stdMat(pos === 'OL' || pos === 'DL' || ref ? '#141414' : (num % 3 ? '#151515' : '#f5f5f5'), { roughness: 0.45 }), mSole = stdMat(num % 3 ? '#e9e9e9' : '#1a1a1a', { roughness: 0.6 });
  const mHelm = stdMat(ref ? '#111111' : team.c1, { roughness: 0.22, metalness: 0.38 }), mMask = stdMat(ref ? '#111111' : (num % 2 ? '#d8d8d8' : shade(team.c2 || '#888', -0.1)), { metalness: 0.55, roughness: 0.32 });
  const mTrim = stdMat(trim), mGlove = stdMat(pos === 'OL' || pos === 'DL' ? '#151515' : trim, { roughness: 0.5 }), mWhite = stdMat('#f4f4f4');
  const cast = o => { o.castShadow = true; return o; };
  const root = new T.Group(), tilt = new T.Group(); root.add(tilt);
  const body = new T.Group(); body.scale.set(bw, bh, bw); tilt.add(body);
  const hips = new T.Group(); hips.position.y = 0.95; body.add(hips);
  const pelvis = cast(new T.Mesh(G.pelvis, mP)); pelvis.scale.set(1, 1, 0.65); hips.add(pelvis);
  const belt = new T.Mesh(G.belt, mTrim); belt.scale.set(1, 1, 0.66); belt.position.y = 0.12; hips.add(belt);
  const legs = [-1, 1].map(sx => {
    const hip = new T.Group(); hip.position.set(sx * 0.12, -0.06, 0); hips.add(hip);
    const th = cast(new T.Mesh(G.thigh, mP)); th.position.y = -0.23; hip.add(th);
    const st = new T.Mesh(G.stripe, mTrim); st.scale.set(0.7, 1, 1.15); st.rotation.x = Math.PI / 2; st.position.set(sx * 0.105, -0.2, 0); hip.add(st);
    const knee = new T.Group(); knee.position.y = -0.46; hip.add(knee);
    const kp = new T.Mesh(G.kneePad, mP); kp.scale.set(1, 0.8, 0.7); kp.position.set(0, 0.01, 0.05); knee.add(kp);
    const sh = cast(new T.Mesh(G.shin, mS)); sh.position.y = -0.23; knee.add(sh);
    const sb = new T.Mesh(G.band, ref ? mS : mWhite); sb.position.y = -0.08; knee.add(sb);
    const ft = cast(new T.Mesh(G.cleat, mShoe)); ft.position.set(0, -0.455, 0.05); knee.add(ft);
    const so = new T.Mesh(G.sole, mSole); so.position.set(0, -0.495, 0.05); knee.add(so);
    return { hip, knee };
  });
  const torso = new T.Group(); torso.position.y = 1.0; body.add(torso);
  const chest = cast(new T.Mesh(G.torso, mJ)); chest.position.y = 0.32; chest.scale.set(1, 1, 0.78); torso.add(chest);
  const pads = cast(new T.Mesh(G.pads, mJ)); pads.scale.set(1.48, 0.46, 0.92); pads.position.y = 0.62; torso.add(pads);
  const collar = new T.Mesh(G.collar, mTrim); collar.rotation.x = Math.PI / 2; collar.position.y = 0.77; torso.add(collar);
  if (!ref) {
    const numFg = home ? '#ffffff' : team.c1, numSt = home ? shade(trim, -0.2) : shade(team.c1, 0.4);
    const nm = new T.MeshBasicMaterial({ map: numberTexture(num, numFg, numSt), transparent: true });
    const back = new T.Mesh(G.num, nm); back.position.set(0, 0.33, -0.235); back.rotation.y = Math.PI; torso.add(back);
    const front = new T.Mesh(G.num, nm); front.scale.setScalar(0.78); front.position.set(0, 0.36, 0.235); torso.add(front);
    if (opts.name) { const nb = new T.Mesh(G.name, new T.MeshBasicMaterial({ map: nameTexture(opts.name, numFg), transparent: true })); nb.position.set(0, 0.56, -0.26); nb.rotation.y = Math.PI; nb.rotation.x = -0.25; torso.add(nb); }
    for (const sx of [-1, 1]) { const tv = new T.Mesh(G.tvnum, nm); tv.position.set(sx * 0.45, 0.62, 0); tv.rotation.y = sx * Math.PI / 2; torso.add(tv); }
  }
  const arms = [-1, 1].map(sx => {
    const sh = new T.Group(); sh.position.set(sx * 0.4, 0.6, 0); torso.add(sh);
    const capM = cast(new T.Mesh(G.cap, mJ)); capM.scale.set(1, 0.85, 1); capM.position.y = -0.04; sh.add(capM);
    const band = new T.Mesh(G.band, mTrim); band.scale.set(1.45, 1, 1.45); band.position.y = -0.13; sh.add(band);
    const ua = cast(new T.Mesh(G.upperArm, pos === 'OL' || pos === 'DL' ? mSk : mSk)); ua.position.y = -0.17; sh.add(ua);
    const el = new T.Group(); el.position.y = -0.32; sh.add(el);
    const fa = cast(new T.Mesh(G.foreArm, mSk)); fa.position.y = -0.15; el.add(fa);
    const wr = new T.Mesh(G.wrist, mWhite); wr.position.y = -0.27; el.add(wr);
    const hd = cast(new T.Mesh(G.hand, ref ? mSk : mGlove)); hd.scale.set(1, 1.15, 0.8); hd.position.y = -0.33; el.add(hd);
    return { sh, el, hd };
  });
  const head = new T.Group(); head.position.y = 0.93; torso.add(head);
  const neck = new T.Mesh(G.neck, mSk); neck.position.y = -0.12; head.add(neck);
  if (ref) { const cap = cast(new T.Mesh(G.helmet, mWhite)); cap.scale.set(0.82, 0.55, 0.9); cap.position.y = 0.05; head.add(cap); const face = new T.Mesh(G.helmet, mSk); face.scale.set(0.7, 0.75, 0.7); face.position.y = -0.02; head.add(face); }
  else {
    const helm = cast(new T.Mesh(G.helmet, mHelm)); helm.scale.set(1, 0.98, 1.12); head.add(helm);
    const stripe = new T.Mesh(G.stripe, mTrim); stripe.position.set(0, 0.205, -0.02); head.add(stripe);
    for (const sx of [-1, 1]) { const dc = new T.Mesh(G.decal, stdMat(team.c2 || '#ffffff', { roughness: 0.3 })); dc.position.set(sx * 0.214, 0.02, -0.01); dc.rotation.y = sx * Math.PI / 2; head.add(dc); }
    for (const [h, sc] of [[-0.02, 1], [-0.085, 0.92], [-0.14, 0.78]]) { const b = new T.Mesh(G.bar, mMask); b.scale.setScalar(sc); b.rotation.set(Math.PI / 2, 0, Math.PI * 0.05); b.position.set(0, h, 0.04); head.add(b); }
    const vb = new T.Mesh(G.vbar, mMask); vb.position.set(0, -0.08, 0.235); head.add(vb);
    if ((pos === 'WR' || pos === 'CB' || pos === 'S' || pos === 'QB') && num % 3 === 1) { const vi = new T.Mesh(G.visor, stdMat('#0b0f14', { roughness: 0.1, metalness: 0.6 })); vi.position.set(0, 0.03, 0.226); head.add(vi); }
  }
  return { root, tilt, body, hips, legs, torso, arms, head, yaw: side === 'O' ? Math.PI : 0 };
};

// ---------- time of day ----------
const TOD = {
  day: { top: '#3d78c4', hor: '#cfe2f4', fog: '#bcd2e8', sun: ['#fff3dc', 1.25], hemi: ['#dfeaff', '#2f4a2a', 0.85], glow: 0.25, exp: 1.0 },
  dusk: { top: '#18204a', mid: '#8a4a7c', hor: '#ffae66', fog: '#6b4a60', sun: ['#ffb070', 0.8], hemi: ['#ffd1b0', '#1d2c1c', 0.6], glow: 0.7, exp: 1.08 },
  night: { top: '#02040a', hor: '#14223c', fog: '#0b1424', sun: ['#eef2ff', 1.0], hemi: ['#b4c4ff', '#1a2a1a', 0.5], glow: 1, exp: 1.12 },
  dome: { top: '#0c0f14', hor: '#1c222c', fog: '#141a22', sun: ['#f6f6ff', 1.05], hemi: ['#e6ecff', '#22302a', 0.7], glow: 0.9, exp: 1.08 },
};
function pickTod(gs) {
  if (gs.weather && gs.weather.k === 'dome') return 'dome';
  if (gs.weather && gs.weather.k === 'snow') return chance(0.5) ? 'night' : 'day';
  const r = Math.random(); return r < 0.5 ? 'day' : r < 0.72 ? 'dusk' : 'night';
}
function skyTex(P) { return canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P.top); if (P.mid) gr.addColorStop(0.55, P.mid); gr.addColorStop(0.8, P.hor); gr.addColorStop(1, P.hor); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); }

// ---------- scene additions ----------
const _buildSceneG2 = buildScene;
buildScene = function (lg) {
  const S = _buildSceneG2(lg), scene = S.scene, gs = lg.gs, T = THREE;
  const tod = gs.tod || (gs.tod = pickTod(gs)), P = TOD[tod]; S.tod = tod;
  GL.renderer.toneMappingExposure = P.exp;
  // sky dome
  const sky = new T.Mesh(new T.SphereGeometry(480, 24, 12), new T.MeshBasicMaterial({ map: skyTex(P), side: T.BackSide, fog: false, depthWrite: false }));
  sky.position.y = -40; scene.add(sky); scene.background = new T.Color(P.top).convertSRGBToLinear();
  scene.fog = new T.Fog(new T.Color(P.fog).convertSRGBToLinear(), 150, 420);
  // lights
  scene.traverse(o => { if (o.isHemisphereLight) { o.color.set(P.hemi[0]); o.groundColor.set(P.hemi[1]); o.intensity = P.hemi[2]; } });
  S.sun.color.set(P.sun[0]); S.sun.intensity = P.sun[1];
  S.sun.shadow.mapSize.set(2048, 2048); if (S.sun.shadow.map) { S.sun.shadow.map.dispose(); S.sun.shadow.map = null; }
  const sc = S.sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.updateProjectionMatrix(); S.sun.shadow.bias = -0.0005; S.sun.shadow.normalBias = 0.02;
  // light tower glow
  if (tod !== 'day') for (const [x, y] of [[20, -30], [100, -30], [20, FIELD_W + 30], [100, FIELD_W + 30]]) { const gsp = glowSprite('#fff4d8', 26 * P.glow + 8); gsp.position.copy(W2T(x, y, 50.5)); scene.add(gsp); }
  // upper deck: copy each crowd surface up and back, with a ribbon board on its front edge
  const homeT = lg.teamOf(0), awayT = lg.teamOf(1);
  const ribbon = canvasTex(1024, 64, (g, w, h) => { g.fillStyle = '#05070b'; g.fillRect(0, 0, w, h); g.font = "800 44px 'Saira Condensed', sans-serif"; g.textBaseline = 'middle'; let x = 10; let i = 0; while (x < w) { const txt = i % 2 ? (homeT.city || '').toUpperCase() : (homeT.name || homeT.abbr).toUpperCase(); g.fillStyle = i % 2 ? homeT.c2 : homeT.c1 === '#000000' ? '#ffffff' : shade(homeT.c1, 0.25); g.fillText(txt, x, h / 2 + 2); x += g.measureText(txt).width + 40; i++; } });
  ribbon.wrapS = T.RepeatWrapping;
  S.ribbonMat = new T.MeshBasicMaterial({ map: ribbon, fog: false });
  const crowd = []; scene.traverse(o => { if (o.isMesh && o.material === S.crowdMat) crowd.push(o); });
  for (const m of crowd) {
    const out = new T.Vector3(m.position.x, 0, m.position.z); if (Math.abs(m.position.x) > Math.abs(m.position.z) * 0.6 && Math.abs(m.position.z) < 60) out.set(Math.sign(m.position.x), 0, 0); else out.set(0, 0, Math.sign(m.position.z)); out.normalize();
    const up = m.clone(); up.position.add(out.clone().multiplyScalar(30)).add(new T.Vector3(0, 23, 0)); scene.add(up);
    const len = m.geometry.parameters.width;
    const rb = new T.Mesh(new T.PlaneGeometry(len, 1.6), S.ribbonMat); rb.position.copy(m.position).add(out.clone().multiplyScalar(-15.5)).add(new T.Vector3(0, 12.2 + 1, 0));
    rb.lookAt(rb.position.clone().sub(out)); ribbon.repeat.set(len / 60, 1); scene.add(rb);
    const fascia = new T.Mesh(new T.BoxGeometry(out.x ? 1 : len, 2.4, out.x ? len : 1), stdMat(shade(homeT.c1, -0.35))); fascia.position.copy(m.position).add(out.clone().multiplyScalar(15)).add(new T.Vector3(0, 12.5 + 10, 0)); scene.add(fascia);
  }
  if (tod === 'dome') { const roof = new T.Mesh(new T.CylinderGeometry(220, 220, 2, 32, 1, true), stdMat('#2a3038', { side: T.DoubleSide })); roof.position.y = 85; scene.add(roof); const cap = new T.Mesh(new T.CircleGeometry(220, 32), new T.MeshBasicMaterial({ color: new T.Color('#1a1f27').convertSRGBToLinear(), side: T.DoubleSide })); cap.rotation.x = Math.PI / 2; cap.position.y = 90; scene.add(cap); sky.visible = false; }
  // video boards above the end zones
  S.boards = [];
  for (const [x, rot] of [[158, Math.PI]]) { // one board above the far end zone (the near end is behind the camera)
    const tex = canvasTex(512, 224, () => { }); const mat = new T.MeshBasicMaterial({ map: tex, fog: false });
    const b = new T.Mesh(new T.PlaneGeometry(36, 15.75), mat); b.position.copy(W2T(x, MID_Y, 58)); b.rotation.y = rot === 0 ? Math.PI : 0; b.lookAt(W2T(60, MID_Y, 30)); scene.add(b);
    const frame = new T.Mesh(new T.BoxGeometry(38, 17.5, 1), stdMat('#111418')); frame.position.copy(b.position); frame.quaternion.copy(b.quaternion); frame.translateZ(-0.6); scene.add(frame);
    S.boards.push(tex);
  }
  S.boardKey = '';
  // pylons
  const pyl = stdMat('#ff6a13', { roughness: 0.6 });
  for (const x of [10, 0, 110, 120]) for (const y of [0, FIELD_W]) { const p = new T.Mesh(new T.BoxGeometry(0.33, 1, 0.33), pyl); p.position.copy(W2T(x, y + (y ? 0.2 : -0.2), 0.5)); p.castShadow = true; scene.add(p); }
  // chain crew on the far sideline
  const chainMat = stdMat('#ff7a1a', { roughness: 0.5 }), poleMat = stdMat('#202020');
  const mkStick = () => { const g = new T.Group(); const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.6, 6), poleMat); pole.position.y = 1.3; g.add(pole); const top = new T.Mesh(new T.BoxGeometry(0.5, 0.35, 0.12), chainMat); top.position.y = 2.65; g.add(top); scene.add(g); return g; };
  S.chain = [mkStick(), mkStick(), mkStick()];
  S.chainLine = new T.Mesh(new T.BoxGeometry(0.03, 0.03, 1), chainMat); scene.add(S.chainLine);
  // sideline teams (instanced: one draw call per part)
  S.bench = [];
  for (const [side, y0] of [[0, FIELD_W + 5.5], [1, -5.5]]) {
    const t = lg.teamOf(side), n = 34;
    const bodies = new T.InstancedMesh(new T.CylinderGeometry(0.32, 0.26, 1.4, 8), stdMat('#ffffff'), n);
    const heads = new T.InstancedMesh(new T.SphereGeometry(0.22, 10, 8), stdMat('#ffffff', { roughness: 0.3, metalness: 0.3 }), n);
    const pos = [];
    for (let i = 0; i < n; i++) {
      const coach = i % 9 === 0;
      const p = { x: 32 + (i / n) * 56 + rand(-0.6, 0.6), y: y0 + (side === 0 ? 1 : -1) * rand(0, 3.2), coach, ph: Math.random() * 6 };
      pos.push(p);
      bodies.setColorAt(i, new T.Color(coach ? '#1b1f26' : side === 0 ? t.c1 : '#eeeeee').convertSRGBToLinear());
      heads.setColorAt(i, new T.Color(coach ? '#2b2f36' : t.c1).convertSRGBToLinear());
    }
    bodies.castShadow = heads.castShadow = true; scene.add(bodies); scene.add(heads);
    S.bench.push({ bodies, heads, pos });
  }
  // referees
  S.refs = ['R', 'U', 'B', 'L', 'J'].map((k, i) => { const m = makePlayerModel({ c1: '#111', c2: '#fff' }, false, 0, 'O', 'LB', { ref: true, seed: i }); scene.add(m.root); return { k, m, e: { x: 30, y: MID_Y, vx: 0, vy: 0, phase: 0, stun: 0 } }; });
  // ball trail + effects
  S.trailPts = [];
  S.trail = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 0.55, fog: false }));
  S.trail.geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(3 * 24), 3)); scene.add(S.trail);
  S.fx = [];
  return S;
};

// ---------- per-frame ----------
function drawBoard(lg, tex) {
  const g = tex._c.getContext('2d'), W = tex._c.width, H = tex._c.height, gs = lg.gs;
  const a = lg.teamOf(1), h = lg.teamOf(0);
  g.fillStyle = '#04060a'; g.fillRect(0, 0, W, H);
  const half = (t, x, sc) => { g.fillStyle = t.c1; g.fillRect(x, 0, W / 2, 120); g.fillStyle = '#fff'; g.font = "800 64px 'Saira Condensed', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t.abbr, x + 80, 62); g.font = "800 92px 'Saira Condensed', sans-serif"; g.fillText(String(sc), x + W / 2 - 70, 64); };
  half(a, 0, gs.score[1]); half(h, W / 2, gs.score[0]);
  g.fillStyle = '#ffd23f'; g.font = "800 48px 'Saira Condensed', sans-serif"; g.textAlign = 'center';
  const q = gs.quarter <= 4 ? 'Q' + gs.quarter : 'OT';
  g.fillText(`${q}  ${fmtClock(gs.clock)}`, W / 2, 158);
  g.fillStyle = '#fff'; g.font = "700 34px 'Barlow', sans-serif"; g.fillText(`${downStr(gs)} · ${lg.teamOf(gs.poss).abbr} ball`, W / 2, 202);
  tex.needsUpdate = true;
}
const LGX = LiveGame.prototype;
const _renderGLG2 = LGX.renderGL;
LGX.renderGL = function (ctx, W, H) {
  // detailed models with names (created before the base renderer looks them up)
  if (this.gl && this.ents) for (const e of this.ents) {
    const side = e.side === 'O' ? this.gs.poss : 1 - this.gs.poss, mk = e.p.id + ':' + side + ':' + e.role.replace(/[0-9]/, '');
    if (!this.gl.models[mk]) { const m = makePlayerModel(this.teamOf(side), side === 0, e.p.num, e.side, e.role, { name: e.p.scrub ? '' : e.p.last }); this.gl.models[mk] = m; this.gl.scene.add(m.root); }
  }
  // pregame fly-in, replay camera, shake
  if (this.introT != null) { this.introT += 1 / 60; if (this.introT < 3.2) this.glBack = Math.min(this.cam.x + 30, Math.max(this.glBack || 0, 40 + (3.2 - this.introT) * 22)); else this.introT = null; }
  if (this.phase === 'replay') this.glBack = Math.min(this.glBack || 34, 19);
  let shakeX = 0;
  if (this.shake > 0) { this.shake -= 1 / 60; shakeX = (Math.random() - 0.5) * this.shake * 2.2; this.cam.x += shakeX; }
  const r = _renderGLG2.call(this, ctx, W, H);
  if (shakeX) this.cam.x -= shakeX;
  const S = this.gl; if (!S || !S.refs) return r;
  const T = THREE, gs = this.gs, dt = 1 / 60, b = this.ball;
  // video boards
  const key = gs.score.join('-') + gs.quarter + Math.ceil(gs.clock) + gs.down + gs.togo + gs.poss;
  if (key !== S.boardKey && (!S._bt || this.t2 - S._bt > 0.5)) { S.boardKey = key; S._bt = this.t2; for (const tex of S.boards) drawBoard(this, tex); }
  // chains
  const losX = this.los || 10 + gs.yard, fdX = this.firstX || Math.min(110, losX + gs.togo), cy = FIELD_W + 2.2;
  const chainOn = gs.yard + gs.togo < 100 && ['pre', 'live', 'post', 'call'].includes(this.phase);
  S.chain[0].position.copy(W2T(losX - (gs.togo > 0 ? 0 : 0), cy, 0)); S.chain[1].position.copy(W2T(fdX, cy, 0)); S.chain[2].position.copy(W2T(losX, cy + 0.9, 0));
  S.chain.forEach(c => c.visible = chainOn); S.chainLine.visible = chainOn;
  S.chainLine.position.copy(W2T((losX + fdX) / 2, cy, 0.25)); S.chainLine.scale.z = Math.max(0.1, fdX - losX); S.chainLine.rotation.y = 0;
  // sideline teams: idle sway, jump when the crowd erupts
  const m4 = new T.Matrix4(), q = new T.Quaternion(), sc1 = new T.Vector3(1, 1, 1);
  for (const B of S.bench) {
    B.pos.forEach((p, i) => {
      const jump = (this.cheer || 0) > 0.4 && !p.coach ? Math.abs(Math.sin(this.t2 * 8 + p.ph)) * 0.45 : 0;
      const sway = Math.sin(this.t2 * 1.3 + p.ph) * 0.04;
      m4.compose(W2T(p.x, p.y + sway, 0.7 + jump), q, sc1); B.bodies.setMatrixAt(i, m4);
      m4.compose(W2T(p.x, p.y + sway, 1.62 + jump), q, sc1); B.heads.setMatrixAt(i, m4);
    });
    B.bodies.instanceMatrix.needsUpdate = true; B.heads.instanceMatrix.needsUpdate = true;
  }
  // referees follow the play from their spots
  const bx = b ? b.x : losX, by = b ? b.y : gs.ballY || MID_Y;
  const spot = { R: [losX - 13, (gs.ballY || MID_Y) + 4], U: [losX + 6.5, gs.ballY || MID_Y], B: [losX + 24, MID_Y - 6], L: [losX, -1.6], J: [losX, FIELD_W + 1.6] };
  const live = this.phase === 'live' || this.phase === 'replay';
  for (const R of S.refs) {
    const e = R.e, s = spot[R.k];
    let tx = s[0], ty = s[1];
    if (live && (R.k === 'L' || R.k === 'J')) tx = bx; else if (live && R.k === 'B') { tx = Math.max(s[0], bx + 10); ty = by; } else if (live && R.k === 'R') { tx = bx - 10; ty = by + 3; }
    if (R.k === 'U' && live) { tx = bx + 5; ty = by - 2; }
    if (!R.init) { e.x = tx; e.y = ty; R.init = true; }
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy), v = Math.min(6.5, d * 2);
    e.vx = d > 0.2 ? dx / d * v : 0; e.vy = d > 0.2 ? dy / d * v : 0; e.x += e.vx * dt; e.y += e.vy * dt;
    e.phase += Math.hypot(e.vx, e.vy) * 0.03;
    const m = R.m; m.root.position.copy(W2T(e.x, e.y, 0)); m.root.visible = this.phase !== 'call';
    const want = Math.atan2(by - e.y, -(bx - e.x)); let dyaw = want - m.yaw; while (dyaw > Math.PI) dyaw -= 2 * Math.PI; while (dyaw < -Math.PI) dyaw += 2 * Math.PI; m.yaw += dyaw * 0.15; m.root.rotation.y = m.yaw;
    poseModel(m, e, null, Math.hypot(e.vx, e.vy), this.t2 || 0);
  }
  // sun / shadow camera follows the action for crisp shadows
  S.sun.shadow.camera.updateProjectionMatrix();
  // ball trail
  if (b && (b.state === 'air' || b.state === 'pitch')) { S.trailPts.push(S.ball.position.clone()); if (S.trailPts.length > 24) S.trailPts.shift(); } else if (S.trailPts.length) S.trailPts.length = 0;
  const arr = S.trail.geometry.attributes.position.array;
  for (let i = 0; i < 24; i++) { const p = S.trailPts[Math.min(i, S.trailPts.length - 1)] || S.ball.position; arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; }
  S.trail.geometry.attributes.position.needsUpdate = true; S.trail.visible = S.trailPts.length > 2;
  // dust puffs and fireworks
  if (this.gfxDust) { const dd = this.gfxDust; this.gfxDust = null; for (let i = 0; i < 9; i++) { const sp = glowSprite(i % 2 ? '#8a7a5a' : '#6f8a4f', 0.9); sp.material.blending = T.NormalBlending; sp.material.opacity = 0.7; sp.position.copy(W2T(dd.x + rand(-0.4, 0.4), dd.y + rand(-0.4, 0.4), 0.2)); S.scene.add(sp); S.fx.push({ s: sp, t: 0, life: 0.8, v: new T.Vector3(rand(-1.5, 1.5), rand(1, 2.5), rand(-1.5, 1.5)), grow: 2.2 }); } }
  if (this.gfxFireworks) { const n = this.gfxFireworks; this.gfxFireworks = 0; for (let k = 0; k < n; k++) { const c = new T.Vector3().copy(W2T(rand(0, 120), rand(-40, FIELD_W + 40), rand(45, 70))); const col = pick([this.teamOf(0).c1, this.teamOf(0).c2, '#ffffff', '#ffd23f']); for (let i = 0; i < 26; i++) { const sp = glowSprite(col, 2.4); sp.position.copy(c); S.scene.add(sp); const dir = new T.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(10, 16)); S.fx.push({ s: sp, t: -k * 0.35, life: 1.6, v: dir, grav: 6, grow: 0 }); } } }
  for (const f of S.fx) {
    f.t += dt; if (f.t < 0) { f.s.visible = false; continue; } f.s.visible = true;
    f.s.position.addScaledVector(f.v, dt); if (f.grav) f.v.y -= f.grav * dt; f.v.multiplyScalar(0.97);
    if (f.grow) f.s.scale.addScalar(f.grow * dt);
    f.s.material.opacity = Math.max(0, 1 - f.t / f.life) * (f.grav ? 1 : 0.7);
  }
  S.fx = S.fx.filter(f => { if (f.t > f.life) { S.scene.remove(f.s); f.s.material.dispose(); return false; } return true; });
  return r;
};
// event hooks: dust on tackles, shake on big hits, fireworks on home TDs at night
const _endPlayGX = LGX.endPlay;
LGX.endPlay = function (kind, msg) {
  const c = this.carrier(), s0 = this.gs.score.slice();
  const r = _endPlayGX.call(this, kind, msg);
  if (c && (kind === 'tackle' || kind === 'oob')) this.gfxDust = { x: c.x, y: c.y };
  const homeTD = this.gs.score[0] - s0[0] >= 6;
  if ((homeTD || this.gs.score[1] - s0[1] >= 6) && this.gl && this.gl.tod !== 'day') this.gfxFireworks = homeTD ? 5 : 2;
  return r;
};
const _flashGX = LGX.flash;
LGX.flash = function (txt) { if (/BIG HIT|Trucked|SACK/.test(txt)) this.shake = 0.4; return _flashGX.call(this, txt); };
const _resultGX = LGX.result;
LGX.result = function (title, sub, big) { if (/SACKED|INTERCEPTION|FUMBLE/.test(title)) this.shake = Math.max(this.shake || 0, 0.3); return _resultGX.call(this, title, sub, big); };

// pregame: matchup banner + camera fly-in
const _startLiveGX = startLiveGame;
startLiveGame = function (hid, aid, userTid, opts = {}) {
  _startLiveGX(hid, aid, userTid, opts);
  if (!GAME) return;
  const lg = GAME.live, L = LEAGUE, h = L.teams[hid], a = L.teams[aid], gs = GAME.gs;
  gs.tod = gs.tod || pickTod(gs);
  lg.introT = 0; lg.glBack = 100;
  const el = document.getElementById('intro'); if (!el) return;
  const rec = t => L.phase === 'regular' || L.phase === 'playoffs' ? `${t.w}-${t.l}${t.t ? '-' + t.t : ''}` : '';
  const todTxt = { day: 'Afternoon', dusk: 'Late afternoon', night: 'Prime time', dome: 'Indoors' }[gs.tod];
  el.innerHTML = `<div class="in-team" style="--c:${a.c1}">${emblemSVG(a)}<b>${esc(a.name)}</b><span>${rec(a)}</span></div><div class="in-mid"><span>${opts.playoff ? 'PLAYOFFS' : todTxt}</span><b>AT</b><span>${gs.weather ? wxLabel(gs) : ''}</span></div><div class="in-team" style="--c:${h.c1}">${emblemSVG(h)}<b>${esc(h.name)}</b><span>${rec(h)}</span></div>`;
  el.hidden = false; el.classList.remove('out'); void el.offsetWidth;
  clearTimeout(el._t); el._t = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.hidden = true, 600); }, 2800);
};
