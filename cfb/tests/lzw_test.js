// Round-trip test for the save compressor
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'cfb_store.js'), 'utf8').split('function cfbMeta')[0];
eval(src.replace(/'use strict';/, ''));
function rnd(n) { let s = ''; for (let i = 0; i < n; i++) { const r = Math.random(); s += r < 0.01 ? '🏆' : r < 0.02 ? 'é' : r < 0.5 ? 'abc{"x":1}'[i % 10] : String.fromCharCode(32 + Math.floor(Math.random() * 90)); } return s; }
for (const n of [0, 1, 5, 100, 5000, 300000]) {
  const s = rnd(n), p = lzwPack(s), u = lzwUnpack(p);
  if (u !== s) { console.log('FAIL', n); process.exit(1); }
  let bad = 0; for (let i = 0; i < p.length; i++) { const c = p.charCodeAt(i); if (c >= 0xD800 && c <= 0xDFFF) bad++; }
  if (bad) { console.log('surrogates in output', n); process.exit(1); }
}
const big = JSON.stringify(Array.from({ length: 60000 }, (_, i) => ({ id: i, first: 'Name' + (i % 977), r: { spd: i % 99, str: (i * 7) % 99 }, st: {}, x: Math.random().toString(36) })));
let t = Date.now(); const p = lzwPack(big); const t1 = Date.now() - t; t = Date.now(); const u = lzwUnpack(p);
console.log('big', big.length, '->', p.length, u === big ? 'OK' : 'FAIL', t1 + 'ms pack', (Date.now() - t) + 'ms unpack');
if (u !== big) process.exit(1);
