// ============================================================
// Gridiron Dynasty - star abilities + "In the Zone", fatigue with auto
// rotation, TD celebrations, gameplay sliders, pre-snap stat card.
// Ability names and effects are original to this game.
// ============================================================
'use strict';

// ---------------- abilities ----------------
const ABIL = {
  laser: ['Laser', 'Throws land right on target', { tha: 15 }],
  escape: ['Escape Artist', 'Slips out of sacks', { btk: 22, agi: 8 }],
  freight: ['Freight Train', 'Runs through arm tackles', { btk: 16, str: 8 }],
  ankle: ['Ankle Breaker', 'Jukes that leave defenders grasping', { agi: 16 }],
  deep: ['Deep Threat', 'An extra gear on deep routes', { spd: 6, rte: 6 }],
  glue: ['Glue Hands', 'Wins contested catches', { cat: 16 }],
  edge: ['Edge Terror', 'Beats blocks fast', { prs: 16, str: 8 }],
  wall: ['Brick Wall', 'Stuffs runs at the line', { str: 12, tkl: 8 }],
  heat: ['Heat Seeker', 'Almost never misses a tackle', { tkl: 16 }],
  hawk: ['Ballhawk', 'Turns tipped balls into picks', { cat: 20, cov: 5 }],
  lock: ['Lockdown', 'Sticks to receivers like glue', { cov: 15 }],
};
const ABIL_POS = { QB: ['laser', 'escape'], RB: ['freight', 'ankle'], WR: ['deep', 'glue'], TE: ['glue', 'freight'], DL: ['edge', 'wall'], LB: ['heat', 'edge'], CB: ['lock', 'hawk'], S: ['hawk', 'heat'] };
function abilOf(p) {
  if (!p || p.scrub || !ABIL_POS[p.pos]) return null;
  if (!(p.dev === 'X' || (p.star && p.ovr >= 78) || p.ovr >= 92)) return null;
  if (!p.abil || !ABIL_POS[p.pos].includes(p.abil)) p.abil = ABIL_POS[p.pos][p.id % 2];
  return p.abil;
}
function zoneOf(gs, p) { gs.zone = gs.zone || {}; return gs.zone[p.id] || (gs.zone[p.id] = { pts: 0, on: false }); }
const LZ = LiveGame.prototype;
LZ.zoneAdd = function (p, n) {
  if (!p || !abilOf(p)) return;
  const z = zoneOf(this.gs, p); z.pts = Math.max(0, z.pts + n);
  if (!z.on && z.pts >= 3) { z.on = true; const a = ABIL[abilOf(p)]; this.h.toast && this.h.toast(`🔥 ${pshort(p)} is IN THE ZONE — ${a[0]}: ${a[1].toLowerCase()}`); }
};
LZ.zoneBreak = function (p) {
  if (!p || !abilOf(p)) return; const z = zoneOf(this.gs, p);
  if (z.on) this.h.toast && this.h.toast(`${pshort(p)} is out of the zone.`);
  z.on = false; z.pts = 0;
};

// ---------------- sliders ----------------
const sl = () => Object.assign({ speed: 1, inj: 1, fum: 1, fat: true }, (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.settings.sl) || {});

// ---------------- fatigue ----------------
const ROTATE = ['RB', 'WR', 'DL', 'LB', 'CB'];
function fatOf(gs, p) { gs.fat = gs.fat || {}; return gs.fat[p.id] == null ? 100 : gs.fat[p.id]; }
const _setupZ = LZ.setup;
LZ.setup = function () {
  const gs = this.gs, swaps = [];
  if (sl().fat && this.offPlay && this.offPlay !== RET_PLAY) {
    for (const side of [0, 1]) for (const pos of ROTATE) {
      const arr = gs.lu[side][pos], n = STARTERS[pos];
      if (!arr || arr.length <= n) continue;
      const bench = arr[n];
      for (let i = 0; i < n; i++) {
        const p = arr[i];
        if (p.star || bench.scrub || p.scrub) continue;
        if (fatOf(gs, p) < 62 && fatOf(gs, bench) > 85 && bench.ovr >= p.ovr - 14) { swaps.push([arr, i, n]); [arr[i], arr[n]] = [arr[n], arr[i]]; break; }
      }
    }
  }
  try { _setupZ.call(this); } finally { for (const [arr, i, n] of swaps.reverse()) [arr[i], arr[n]] = [arr[n], arr[i]]; }
  this.subs = swaps.length;
};
const _mkEntZ = LZ.mkEnt;
LZ.mkEnt = function (p, side, role, x, y) {
  const e = _mkEntZ.call(this, p, side, role, x, y);
  if (!p || p.scrub) return e;
  // in the zone: ability boosts
  const a = abilOf(p);
  if (a && zoneOf(this.gs, p).on) { const b = ABIL[a][2]; for (const k in b) e.r[k] = Math.min(110, e.r[k] + b[k]); if (b.spd) e.maxV += b.spd * 0.06; e.zone = true; }
  // tired legs
  if (sl().fat) { const f = fatOf(this.gs, p); if (f < 72) { const k = (72 - f) / 72; e.maxV -= 0.7 * k; e.acc -= 2.5 * k; for (const r of ['spd', 'agi', 'btk', 'prs', 'cov', 'tkl']) e.r[r] -= 7 * k; } }
  return e;
};

// after every play: zone points, fatigue, celebrations
const _endPlayZ = LZ.endPlay;
LZ.endPlay = function (kind, msg) {
  if (this.phase !== 'live') return _endPlayZ.call(this, kind, msg);
  const pl = this.play, c = this.carrier(), los = this.los, gs = this.gs, s0 = gs.score.slice(), tk = this.tackler;
  const passer = this.passer, sack = c && c === passer && this.passReady && !pl.thrown && !pl.crossed && c.x <= los;
  const gain = c ? c.x - los : 0, ents = this.ents.slice(), t = this.t, wasRet = !!this.ret;
  const r = _endPlayZ.call(this, kind, msg);
  const td = gs.score[0] - s0[0] >= 6 || gs.score[1] - s0[1] >= 6;
  // zone
  if (!wasRet) {
    if (pl.int) { this.zoneBreak(passer && passer.p); this.zoneAdd(pl.intBy && pl.intBy.p, 3); }
    else if (sack) { this.zoneBreak(passer.p); this.zoneAdd(tk && tk.p, 2); }
    else if (pl.caught && c) { this.zoneAdd(passer && passer.p, gain >= 20 ? 2 : 1); this.zoneAdd(c.p, gain >= 12 ? 2 : gain >= 6 ? 1 : 0); if (td) { this.zoneAdd(passer.p, 1); this.zoneAdd(c.p, 1); } }
    else if (kind === 'inc' && pl.target) { const cov = ents.filter(e => e.side !== pl.target.side).sort((a, b) => this.dist(a, pl.target) - this.dist(b, pl.target))[0]; if (cov && this.dist(cov, pl.target) < 2) this.zoneAdd(cov.p, 1); }
    else if (c) { this.zoneAdd(c.p, gain >= 10 ? 2 : gain >= 5 ? 1 : 0); if (td) this.zoneAdd(c.p, 2); if (tk) this.zoneAdd(tk.p, gain <= 0 ? 1.5 : 0.4); if (gain <= -1 && c.p) this.zoneAdd(c.p, -1); }
    if (pl.caught && c && gain >= 18) { const beat = ents.filter(e => e.side !== c.side && (e.role.startsWith('CB') || e.role.startsWith('S'))).sort((a, b) => this.dist(a, c) - this.dist(b, c))[0]; if (beat) this.zoneBreak(beat.p); }
  }
  // fatigue: players on the field get tired, everyone else recovers
  if (sl().fat) {
    const on = new Set();
    for (const e of ents) { if (!e.p || e.p.scrub) continue; on.add(e.p.id); const drain = 2.2 + Math.min(t, 10) * 0.75 + (e === c ? 3 : 0) + (e.role.startsWith('DL') ? 1.5 : 0); gs.fat[e.p.id] = clamp(fatOf(gs, e.p) - drain, 25, 100); }
    for (const id in gs.fat) if (!on.has(+id)) gs.fat[id] = Math.min(100, gs.fat[id] + 7);
    for (const id of on) gs.fat[id] = Math.min(100, gs.fat[id] + 1.5);
  }
  // celebration
  if (td && c && c.anim && c.anim.type === 'celebrate') {
    c.anim.type = pick(['celebrate', 'flex', 'spike', 'dance', 'point', 'leap']);
    this.celeb = { who: c, t: 0 };
  }
  return r;
};
const _updateZ = LZ.update;
LZ.update = function (dt) {
  dt *= sl().speed;
  if (this.phase === 'post' && this.celeb) {
    const c = this.celeb.who; this.celeb.t += dt;
    if (this.celeb.t < 2.2) for (const e of this.ents) if (e !== c && e.side === c.side && this.dist(e, c) < 22 && this.dist(e, c) > 1.6) {
      const dx = c.x - e.x, dy = c.y - e.y, m = Math.hypot(dx, dy); const sp = Math.min(6, e.maxV) * dt;
      e.vx = dx / m * 6; e.vy = dy / m * 6; e.x += dx / m * sp; e.y += dy / m * sp;
    } else if (this.celeb.t >= 2.2) this.celeb = null;
  } else if (this.phase !== 'post') this.celeb = null;
  return _updateZ.call(this, dt);
};

// ---------------- pre-snap stat card ----------------
function statLineFor(gs, p) {
  const b = gs.box[p.id] || {};
  if (p.pos === 'QB') return `${b.pc || 0}/${b.pa || 0}, ${b.py || 0} yds, ${b.ptd || 0} TD${b.pint ? ', ' + b.pint + ' INT' : ''}`;
  if (p.pos === 'RB') return `${b.ra || 0} car, ${b.ry || 0} yds${b.rec ? `, ${b.rec} rec ${b.rcy} yds` : ''}${(b.rtd || 0) + (b.rctd || 0) ? `, ${(b.rtd || 0) + (b.rctd || 0)} TD` : ''}`;
  if (['WR', 'TE'].includes(p.pos)) return `${b.rec || 0} rec, ${b.rcy || 0} yds${b.rctd ? `, ${b.rctd} TD` : ''}`;
  return `${b.tk || 0} tkl${b.sk ? `, ${b.sk} sk` : ''}${b.dint ? `, ${b.dint} INT` : ''}`;
}
function statCardHTML(lg) {
  const gs = lg.gs, off = gs.poss, lo = gs.lu[off];
  const rows = [lo.QB[0], lo.RB[0], ...lo.WR.slice(0, 2)].filter(p => p && !p.scrub).map(p => {
    const z = gs.zone && gs.zone[p.id], a = abilOf(p), f = gs.fat ? fatOf(gs, p) : 100;
    return `<div class="sc-row"><span class="pos-chip">${p.pos}</span><b>${esc(pshort(p))}</b>${a ? `<span class="ab ${z && z.on ? 'on' : ''}" title="${ABIL[a][1]}">${z && z.on ? '🔥' : '★'} ${ABIL[a][0]}</span>` : ''}<span class="muted">${statLineFor(gs, p)}</span>${f < 70 ? '<span class="tired">tired</span>' : ''}</div>`;
  }).join('');
  const hot = Object.keys(gs.zone || {}).filter(id => gs.zone[id].on).map(id => LEAGUE.players[id]).filter(p => p && p.tid === lg.teamOf(1 - off).id);
  return rows + (hot.length ? `<div class="sc-row warn">🔥 Defense in the zone: ${hot.map(p => esc(pshort(p))).join(', ')}</div>` : '');
}
