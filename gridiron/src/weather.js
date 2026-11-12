// ============================================================
// Gridiron Dynasty - weather: rain, snow, wind, domes. Affects passing,
// catching, footing, fumbles and kicks in both the live game and the sim.
// ============================================================
'use strict';

const DOMES = ['ATL', 'DET', 'MIN', 'NO', 'LV', 'ARI', 'DAL', 'HOU', 'IND', 'LAR', 'LAC'];
const COLD = ['BUF', 'GB', 'CHI', 'CLE', 'PIT', 'NE', 'NYJ', 'NYG', 'DEN', 'KC', 'CIN', 'BAL', 'PHI', 'WAS'];
const WETTER = ['SEA', 'SF', 'JAX', 'MIA', 'TB', 'CAR', 'TEN'];
const WX = {
  dome: { name: 'Dome', icon: '🏟', pass: 0, kick: 0, spd: 0, fum: 1 },
  clear: { name: 'Clear', icon: '☀️', pass: 0, kick: 0, spd: 0, fum: 1 },
  rain: { name: 'Rain', icon: '🌧', pass: 5, kick: 5, spd: 1, fum: 2.2 },
  snow: { name: 'Snow', icon: '❄️', pass: 6, kick: 8, spd: 3, fum: 2.4 },
  wind: { name: 'Windy', icon: '💨', pass: 4, kick: 11, spd: 0, fum: 1.1 },
};
let WX_NOW = 'clear';

function rollWeather(L, hid) {
  const t = L.teams[hid], ab = t.abbr || '', wk = L.week || 0;
  const dome = DOMES.includes(ab) || (!L.real && hid % 6 === 5);
  if (dome) return { k: 'dome', temp: 72 };
  const cold = COLD.includes(ab) || (!L.real && hid % 4 === 0), late = wk >= 11 || L.phase === 'playoffs';
  const r = Math.random();
  let k = 'clear';
  if (cold && late && r < 0.28) k = 'snow';
  else if (r < (WETTER.includes(ab) ? 0.2 : 0.12) + (cold && late ? 0.28 : 0)) k = 'rain';
  else if (r < (cold && late ? 0.28 : 0) + 0.22) k = 'wind';
  const base = late ? (cold ? 30 : 58) : wk >= 6 ? (cold ? 48 : 70) : 78;
  return { k, temp: Math.round(k === 'snow' ? Math.min(base, 28) - randi(0, 10) : base + randi(-8, 8)) };
}

const _newGSW = newGameState;
newGameState = function (L, hid, aid, opts = {}) {
  const gs = _newGSW(L, hid, aid, opts);
  gs.weather = opts.weather || rollWeather(L, hid);
  const w = WX[gs.weather.k];
  if (w.pass || w.spd) for (const rt of gs.rt) { rt.pass -= w.pass; rt.run -= w.spd * 0.6; rt.kick -= w.kick; rt.kac -= w.kick; rt.kpw -= w.kick * 0.5; }
  WX_NOW = gs.weather.k;
  return gs;
};
const _fgProbW = fgProb;
fgProb = function (k, dist) { const w = WX[WX_NOW] || WX.clear; return clamp(_fgProbW(k, dist) * (1 - w.kick / 100 * (dist > 40 ? 1.6 : 1)), 0, 0.99); };
function wxLabel(gs) { if (!gs || !gs.weather) return ''; const w = WX[gs.weather.k]; return `${w.icon} ${w.name}${gs.weather.k === 'dome' ? '' : ' · ' + gs.weather.temp + '°F'}`; }

// live engine: slick ball and slow footing
const _mkEntW = LiveGame.prototype.mkEnt;
LiveGame.prototype.mkEnt = function (p, side, role, x, y) {
  const e = _mkEntW.call(this, p, side, role, x, y);
  const w = WX[(this.gs.weather || {}).k] || WX.clear;
  if (w.pass) { e.r.tha -= w.pass; e.r.cat -= Math.round(w.pass * 0.8); }
  if (w.spd) { e.maxV -= w.spd * 0.06; e.acc -= w.spd * 0.4; }
  if (w.kick) { e.r.kac -= w.kick; e.r.kpw -= Math.round(w.kick * 0.5); }
  return e;
};
const _startLiveW = LiveGame.prototype.next;
LiveGame.prototype.next = function () { WX_NOW = (this.gs.weather || {}).k || 'clear'; return _startLiveW.call(this); };

// fumbles on contact (more in the wet)
const _endPlayW = LiveGame.prototype.endPlay;
LiveGame.prototype.endPlay = function (kind, msg) {
  const c = this.carrier(), pl = this.play, gs = this.gs;
  if (this.phase === 'live' && kind === 'tackle' && c && c.side === 'O' && !pl.int && !this.ret && c.x < 109.5) {
    const w = WX[(gs.weather || {}).k] || WX.clear;
    const p = 0.0075 * w.fum * clamp((110 - c.r.btk) / 50, 0.5, 1.6) * (this.tackler && this.tackler.dive > 0 ? 1.4 : 1);
    if (chance((p + (this.fumbleBoost || 0)) * sl().fum)) {
      sfx('whistle');
      st(gs, c.p, 'fum');
      if (chance(0.52)) {
        const rec = this.tackler || this.nearest(c, 'D');
        const x = c.x; if (this.tackler) st(gs, this.tackler.p, 'tk');
        if (rec) st(gs, rec.p, 'ff');
        logp(gs, `${pshort(c.p)} FUMBLES! Recovered by ${rec ? pshort(rec.p) : 'the defense'}.`, true);
        gs.ballY = clamp(c.y, HASH_L, HASH_R);
        applyPlay(gs, { turnover: { yard: Math.round(110 - x), td: false }, elapsed: Math.max(3, Math.min(this.t, 14)) });
        return this.result('FUMBLE!', `${pshort(c.p)} coughs it up${w.fum > 1.5 ? ' on the slick field' : ''} — ${rec ? pshort(rec.p) : 'defense'} recovers`, true);
      }
      this.h.toast && this.h.toast(`${pshort(c.p)} fumbled — but fell on it!`);
    }
  }
  return _endPlayW.call(this, kind, msg);
};

// ---------- visuals: rain / snow over the field, weather chip ----------
let WXFX = null;
function wxLoop() {
  const cv = document.getElementById('wxfx');
  if (!cv || typeof GAME === 'undefined' || !GAME || !GAME.gs.weather) { WXFX = null; if (cv) cv.style.display = 'none'; return; }
  const k = GAME.gs.weather.k;
  if (k !== 'rain' && k !== 'snow') { cv.style.display = 'none'; WXFX = null; return; }
  cv.style.display = 'block';
  const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  if (!WXFX || WXFX.k !== k) WXFX = { k, p: Array.from({ length: k === 'rain' ? 220 : 160 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() })) };
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(200,215,235,.45)'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1;
  for (const d of WXFX.p) {
    if (k === 'rain') { d.y += 16 * d.s; d.x -= 3 * d.s; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 3 * d.s, d.y - 12 * d.s); ctx.stroke(); }
    else { d.y += 1.4 * d.s; d.x += Math.sin((d.y + d.s * 100) / 30) * 0.6; ctx.beginPath(); ctx.arc(d.x, d.y, 1.3 * d.s + 0.4, 0, 6.3); ctx.fill(); }
    if (d.y > H + 10) { d.y = -10; d.x = Math.random() * W; } if (d.x < -10) d.x = W + 5;
  }
  if (k === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, 0, W, H); }
  requestAnimationFrame(wxLoop);
}
