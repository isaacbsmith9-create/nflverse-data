// Headless harness: loads the whole college game (shared engine + college files) into a
// Node vm with a stub DOM, so dynasty seasons can be simulated without a browser.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { shared, college } = require('../build.js');

function stubEl() {
  const el = new Proxy({ style: { setProperty() { } }, dataset: {}, classList: { add() { }, remove() { }, toggle() { } }, children: [] }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'getContext') return () => new Proxy({}, { get: (o, kk) => kk === 'canvas' ? stubEl() : typeof kk === 'string' && kk.startsWith('create') ? () => ({ addColorStop() { } }) : () => { } });
      if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 800, height: 600 });
      if (k === 'querySelector') return () => stubEl();
      if (k === 'querySelectorAll') return () => [];
      if (['addEventListener', 'removeEventListener', 'append', 'appendChild', 'remove', 'setPointerCapture', 'focus', 'select', 'setSelectionRange', 'click', 'scrollTo'].includes(k)) return () => { };
      return undefined;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return el;
}

function load(opts = {}) {
  const store = {};
  const els = {};
  const ctx = {
    console, Math, Date, JSON, setTimeout: opts.syncTimers ? (f) => { f(); return 0; } : setTimeout, clearTimeout, setInterval, clearInterval, performance: { now: () => Date.now() },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, navigator: {}, Image: function () { }, Blob: function () { }, URL: { createObjectURL: () => '' },
  };
  ctx.document = {
    querySelector: s => (els[s] = els[s] || stubEl()), querySelectorAll: () => [], getElementById: id => (els['#' + id] = els['#' + id] || stubEl()),
    createElement: () => stubEl(), addEventListener() { }, documentElement: stubEl(), visibilityState: 'visible',
  };
  ctx.window = ctx; ctx.self = ctx; ctx.top = ctx; ctx.addEventListener = () => { };
  vm.createContext(ctx);
  const read = (dir, f) => fs.readFileSync(path.join(__dirname, '..', dir, f), 'utf8');
  const src = [read('src', 'cfb_data.js'), ...shared.map(f => read('../gridiron/src', f)), ...college.map(f => read('src', f))].join('\n')
    + '\n;globalThis.__api = { newCfbLeague, simWeek, beginOffseason, startPortal, portalAdvance, startNewSeason, simGame, saveLeague, loadLeague, teamOvr, pname, clsLabel, nilValue, payroll, capRoom, userPortalOffer, recruitWeek, fitScore, rcCtx, takeJob, lzwPack, lzwUnpack, get L() { return LEAGUE; }, set L(v) { LEAGUE = v; } };';
  vm.runInContext(src, ctx, { filename: 'cfb-game.js' });
  ctx.__store = store;
  return ctx;
}
module.exports = { load };
