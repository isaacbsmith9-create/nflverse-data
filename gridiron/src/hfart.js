// ============================================================
// Gridiron Dynasty - art made with Higgsfield (see assets/README.md):
// real grass blended into the field, a photo crowd on the stands,
// day / dusk / night sky panoramas, and the main-menu background.
// ============================================================
'use strict';

const HF_IMG = {};
if (typeof Image !== 'undefined' && typeof HF_ART !== 'undefined') for (const k in HF_ART) { const im = new Image(); im.src = HF_ART[k]; HF_IMG[k] = im; }
const hfReady = k => HF_IMG[k] && HF_IMG[k].complete && HF_IMG[k].naturalWidth > 0;
function hfTex(k, wrap) {
  const t = new THREE.Texture(HF_IMG[k]); t.encoding = THREE.sRGBEncoding;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (hfReady(k)) t.needsUpdate = true; else HF_IMG[k].addEventListener('load', () => { t.needsUpdate = true; }, { once: true });
  return t;
}

// ---------- field: real grass under the paint ----------
let _turfTile = null;
const _fieldCanvasHF = fieldCanvas;
fieldCanvas = function (lg) {
  const fc = _fieldCanvasHF(lg);
  if (!hfReady('turf')) return fc;
  if (!_turfTile) { _turfTile = document.createElement('canvas'); _turfTile.width = _turfTile.height = 144; _turfTile.getContext('2d').drawImage(HF_IMG.turf, 0, 0, 144, 144); }
  const g = fc.c.getContext('2d');
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.62;
  g.fillStyle = g.createPattern(_turfTile, 'repeat'); g.fillRect(0, 0, fc.c.width, fc.c.height);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.35; g.fillRect(0, 0, fc.c.width, fc.c.height);
  g.restore();
  fc.hf = true;
  return fc;
};

// ---------- crowd + sky ----------
const _buildSceneHF = buildScene;
buildScene = function (lg) {
  const S = _buildSceneHF(lg);
  if (!HF_IMG.crowd) return S;
  // photo crowd on every stand (the old drawn crowd frames all point at it)
  const ct = hfTex('crowd', true); ct.repeat.set(3.2, 1.15);
  S.crowdMat.map = ct; S.crowdMat.needsUpdate = true;
  S.crowdTex = [ct, ct, ct]; S.hfCrowd = ct;
  // sky panorama for the time of day
  const key = S.tod === 'dusk' ? 'dusk' : S.tod === 'night' ? 'night' : S.tod === 'dome' ? null : 'day';
  if (key) S.scene.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.radius === 480 && o.material && o.material.side === THREE.BackSide) {
      const t = hfTex(key, false); t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1.9); t.offset.set(0, -0.9);
      o.material.map = t; o.material.color.set('#ffffff'); o.material.needsUpdate = true;
    }
  });
  return S;
};
const _renderGLHF = LiveGame.prototype.renderGL;
LiveGame.prototype.renderGL = function (ctx, W, H) {
  const S = this.gl;
  // the grass finished loading after the field was drawn: redraw it once
  if (S && S.fc && !S.fc.hf && hfReady('turf')) { S.fc = fieldCanvas(this); S.ftex.image = S.fc.c; S.ftex.needsUpdate = true; }
  // the crowd bounces when it cheers
  if (S && S.hfCrowd) S.hfCrowd.offset.y = (this.cheer || 0) > 0.2 ? Math.abs(Math.sin((this.t2 || 0) * 10)) * 0.012 : 0;
  return _renderGLHF.call(this, ctx, W, H);
};

// ---------- main menu background ----------
function hfMenuBg() {
  const m = document.getElementById('menu'); if (!m || !HF_ART || !HF_ART.menu) return;
  m.style.backgroundImage = `linear-gradient(180deg, rgba(6,12,10,.55) 0%, rgba(6,12,10,.78) 45%, rgba(6,12,10,.96) 100%), url(${HF_ART.menu})`;
  m.style.backgroundSize = 'cover'; m.style.backgroundPosition = 'center top'; m.style.backgroundAttachment = 'scroll';
}
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hfMenuBg); else hfMenuBg(); }
