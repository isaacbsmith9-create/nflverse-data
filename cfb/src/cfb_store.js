// ============================================================
// College Gridiron Dynasty - saves. A college league holds ~11,000
// players, so saves are LZW-compressed into UTF-16 text (no surrogate
// code units) and written a moment after the last change.
// ============================================================
'use strict';

const CFB_SAVE = 'cfb_dynasty_save_', CFB_META = 'cfb_dynasty_meta_';
const LZ_OFF = 32, LZ_MAX = 0xD7FF - LZ_OFF, LZ_ESC = 256, LZ_RESET = 257, LZ_FIRST = 258;
function lzwPack(str) {
  // open-addressing hash of (prefix code, next char) -> code, in typed arrays (fast on Chromebooks)
  const HS = 1 << 17, MASK = HS - 1, keys = new Int32Array(HS), vals = new Int32Array(HS);
  keys.fill(-1);
  let next = LZ_FIRST, w = -1, n = 0;
  let buf = new Uint16Array(Math.max(1024, str.length >> 2));
  const emit = c => { if (n >= buf.length) { const b2 = new Uint16Array(buf.length * 2); b2.set(buf); buf = b2; } buf[n++] = c + LZ_OFF; };
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c > 255) { if (w >= 0) emit(w); w = -1; emit(LZ_ESC); emit(c >> 8); emit(c & 255); continue; }
    if (w < 0) { w = c; continue; }
    const k = w * 256 + c;
    let h = (Math.imul(k, 0x9E3779B1) >>> 15) & MASK;
    while (keys[h] !== -1 && keys[h] !== k) h = (h + 1) & MASK;
    if (keys[h] === k) { w = vals[h]; continue; }
    emit(w);
    if (next < LZ_MAX) { keys[h] = k; vals[h] = next++; }
    else { emit(LZ_RESET); keys.fill(-1); next = LZ_FIRST; }
    w = c;
  }
  if (w >= 0) emit(w);
  let s = ''; for (let i = 0; i < n; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, Math.min(n, i + 8192)));
  return s;
}
function lzwUnpack(s) {
  let dict = [], next = LZ_FIRST, prev = null;
  const parts = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) - LZ_OFF;
    if (c === LZ_ESC) { const hi = s.charCodeAt(++i) - LZ_OFF, lo = s.charCodeAt(++i) - LZ_OFF; parts.push(String.fromCharCode(hi * 256 + lo)); prev = null; continue; }
    if (c === LZ_RESET) { dict = []; next = LZ_FIRST; prev = null; continue; }
    let entry;
    if (c < 256) entry = String.fromCharCode(c);
    else if (dict[c] !== undefined) entry = dict[c];
    else if (c === next && prev !== null) entry = prev + prev[0];
    else throw new Error('bad save data');
    parts.push(entry);
    if (prev !== null && next < LZ_MAX) dict[next++] = prev + entry[0];
    prev = entry;
  }
  return parts.join('');
}
// the packer drops dictionary growth exactly where the unpacker does: when the RESET code is emitted
// (the unpacker sees RESET right after the code that would have filled the last slot)

function cfbMeta(L) { const t = L.teams[L.userTid]; return { team: teamName(t), abbr: t.abbr, c1: t.c1, c2: t.c2, season: L.season, week: L.week, phase: L.phase, rec: recStr(t), rank: t.rank || 0 }; }
saveLeague = function (L, slot) {
  try {
    const json = JSON.stringify(L);
    localStorage.setItem(CFB_SAVE + slot, 'Z1' + lzwPack(json));
    localStorage.setItem(CFB_META + slot, JSON.stringify(cfbMeta(L)));
    return true;
  } catch (e) { console.warn(e); return false; }
};
function unpackSave(s) { if (!s) return null; if (s.startsWith('Z1')) return JSON.parse(lzwUnpack(s.slice(2))); return JSON.parse(s); }
loadLeague = function (slot) { try { return unpackSave(localStorage.getItem(CFB_SAVE + slot)); } catch (e) { console.warn(e); return null; } };
saveMeta = function (slot) {
  try {
    const m = localStorage.getItem(CFB_META + slot); if (m) return JSON.parse(m);
    const L = loadLeague(slot); return L ? cfbMeta(L) : null;
  } catch (e) { return null; }
};
deleteSave = function (slot) { try { localStorage.removeItem(CFB_SAVE + slot); localStorage.removeItem(CFB_META + slot); } catch (e) { } };

// debounced autosave: the hub calls save() after every click
let _saveT = null, _saveDirty = false;
save = function () {
  if (!LEAGUE || EXHIB) return;
  _saveDirty = true; clearTimeout(_saveT);
  _saveT = setTimeout(flushSave, 700);
};
function flushSave() {
  clearTimeout(_saveT); _saveT = null;
  if (!_saveDirty || !LEAGUE || EXHIB) return;
  _saveDirty = false;
  if (!saveLeague(LEAGUE, SLOT)) toast('Save failed: browser storage may be full or blocked. Use Export in Settings to back up.');
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
}

// ---------- export / import as plain text (works inside sandboxed pages where downloads are blocked) ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function exportCode(L) {
  const p = lzwPack(JSON.stringify(L)), parts = [];
  for (let i = 0; i < p.length; i += 4096) {
    let s = ''; for (let j = i; j < Math.min(p.length, i + 4096); j++) { const v = p.charCodeAt(j); s += B64[(v >> 12) & 63] + B64[(v >> 6) & 63] + B64[v & 63]; }
    parts.push(s);
  }
  return 'CGD1:' + parts.join('');
}
function importCode(txt) {
  txt = String(txt || '').trim();
  if (!txt.startsWith('CGD1:')) return JSON.parse(txt);
  const s = txt.slice(5).replace(/\s+/g, ''), idx = {}; for (let i = 0; i < 64; i++) idx[B64[i]] = i;
  const codes = [];
  for (let i = 0; i + 2 < s.length; i += 3) codes.push(String.fromCharCode((idx[s[i]] << 12) | (idx[s[i + 1]] << 6) | idx[s[i + 2]]));
  return JSON.parse(lzwUnpack(codes.join('')));
}
doImport = function (txt, slot) {
  try {
    const L = importCode(txt); if (!L.teams || !L.players) throw new Error('bad');
    LEAGUE = L; SLOT = slot; EXHIB = false; save(); flushSave(); closeModal(); TAB = 'home'; renderHub(); toast('Save imported.');
  } catch (e) { toast('That text is not a valid College Gridiron Dynasty save.'); }
};
