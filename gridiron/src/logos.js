// ============================================================
// Gridiron Dynasty - original team emblems
// Built from each team's colors: a frame shape, a pattern and a
// monogram. Deliberately generic; no league or club marks are copied.
// ============================================================
'use strict';

function _h(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function _lum(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; }

const EMBLEM_FRAMES = [
  'M50 4 L92 16 L92 52 C92 76 72 90 50 97 C28 90 8 76 8 52 L8 16 Z',            // shield
  'M50 4 A46 46 0 1 1 49.9 4 Z',                                                // roundel
  'M50 3 L91 26 L91 74 L50 97 L9 74 L9 26 Z',                                   // hexagon
  'M50 3 L95 50 L50 97 L5 50 Z',                                                // diamond
  'M14 8 L86 8 L94 28 L94 62 C94 80 74 92 50 97 C26 92 6 80 6 62 L6 28 Z',     // crest
];
function emblemSVG(t, opts = {}) {
  const h = _h(t.abbr + (t.name || ''));
  const frame = EMBLEM_FRAMES[h % EMBLEM_FRAMES.length];
  const motif = (h >> 5) % 6;
  const c1 = t.c1, c2 = t.c2;
  const dark = _lum(c1) < 0.5;
  const ink = _lum(c2) > 0.5 === dark ? c2 : (dark ? '#ffffff' : '#111111');
  const id = 'e' + h.toString(36);
  let pattern = '';
  if (motif === 0) pattern = `<path d="M-10 70 L70 -10 L84 4 L4 84 Z M20 104 L104 20 L112 32 L32 112 Z" fill="${c2}" opacity=".35"/>`;
  if (motif === 1) pattern = `<path d="M10 62 L50 40 L90 62 L90 72 L50 50 L10 72 Z M10 78 L50 56 L90 78 L90 88 L50 66 L10 88 Z" fill="${c2}" opacity=".4"/>`;
  if (motif === 2) pattern = `<rect x="0" y="38" width="100" height="24" fill="${c2}" opacity=".3"/>`;
  if (motif === 3) pattern = `<path d="M50 0 V100 H0 V50 H100 V0 Z" fill="${c2}" opacity=".18"/>`;
  if (motif === 4) pattern = `<circle cx="50" cy="50" r="31" fill="none" stroke="${c2}" stroke-width="5" opacity=".55"/>`;
  if (motif === 5) pattern = `<path d="M0 30 Q25 18 50 30 T100 30 V40 Q75 28 50 40 T0 40 Z M0 70 Q25 58 50 70 T100 70 V80 Q75 68 50 80 T0 80 Z" fill="${c2}" opacity=".3"/>`;
  const txt = t.abbr.length > 2 ? t.abbr : t.abbr;
  const fs = txt.length >= 3 ? 30 : 40;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="${id}"><path d="${frame}"/></clipPath></defs>` +
    `<path d="${frame}" fill="${c1}"/><g clip-path="url(#${id})">${pattern}</g>` +
    `<path d="${frame}" fill="none" stroke="${c2}" stroke-width="5"/><path d="${frame}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.5" transform="translate(50 50) scale(.86) translate(-50 -50)"/>` +
    `<text x="50" y="${57 + (fs - 30) * 0.35}" text-anchor="middle" font-family="'Saira Condensed','Arial Narrow',sans-serif" font-weight="800" font-size="${fs}" letter-spacing="-1" fill="${ink}" stroke="rgba(0,0,0,.45)" stroke-width="1.2" paint-order="stroke">${txt}</text></svg>`;
}

// cached <img> versions for drawing on the canvas (midfield, end zones)
const _embImgs = {};
function emblemImage(t) {
  const k = t.abbr + t.c1 + t.c2;
  if (!_embImgs[k] && typeof Image !== 'undefined') {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(emblemSVG(t)); _embImgs[k] = img;
  }
  const img = _embImgs[k];
  return img && img.complete && img.naturalWidth ? img : null;
}
