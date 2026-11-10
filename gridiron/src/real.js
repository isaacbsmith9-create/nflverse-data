// ============================================================
// Gridiron Dynasty - real NFL league loader (uses NFL_DATA from nfl_data.js when present)
// ============================================================
'use strict';

function hasRealData() { return typeof NFL_DATA !== 'undefined' && NFL_DATA && NFL_DATA.players; }

// nudge a player's position-key ratings so the computed OVR lands on the target
function fitOvr(p, target, locked) {
  const w = OVR_W[p.pos];
  for (let it = 0; it < 8; it++) {
    let s = 0; for (const k in w) s += p.r[k] * w[k];
    const diff = target - s; if (Math.abs(diff) < 0.4) break;
    const free = Object.keys(w).filter(k => !locked[k] && p.r[k] > 16 && p.r[k] < 99);
    const sw = free.reduce((a, k) => a + w[k], 0); if (!sw) break;
    for (const k of free) p.r[k] = Math.round(clamp(p.r[k] + diff / sw, 15, 99));
  }
  p.ovr = calcOvr(p);
}

function newRealLeague(userAbbr, opts = {}) {
  const D = NFL_DATA;
  const L = {
    version: 1, real: true, nextPid: 1, season: D.season, week: 1, phase: 'regular',
    userTid: 0, teams: [], players: {}, fa: [], schedule: [], playoffs: null,
    draftClass: [], picks: [], news: [], history: [], awards: [], draft: null,
    settings: Object.assign({ qlen: 240, diff: 'pro', simDef: false, autoSave: true }, opts.settings || {}),
    cap: 301.2, confs: ['AFC', 'NFC'], dataAsOf: D.asOf,
  };
  const idx = {};
  D.teams.forEach(([abbr, city, name, c1, c2, conf, div, coach], i) => {
    idx[abbr] = i;
    L.teams.push({ id: i, city, name, abbr, c1, c2, conf, div, coach, roster: [], depth: {}, w: 0, l: 0, t: 0, pf: 0, pa: 0, titles: 0, strength: 0 });
  });
  for (const row of D.players) {
    const [first, last, pos, age, num, ovr, dev, col, sal, yrs, tm, entry, dn, ov, exp, inj] = row;
    const p = genPlayer(L, pos, ovr, age);
    p.first = first; p.last = last; p.num = num || jerseyNum(pos); p.dev = dev; p.col = col || '—';
    p.con = { sal: Math.max(0.75, sal), yrs: Math.max(1, yrs) };
    const locked = ov || {};
    for (const k in locked) p.r[k] = locked[k];
    fitOvr(p, ovr, locked);
    const upside = Math.max(0, 27 - age) * rand(0.8, 2.6) + (dev === 'X' ? 5 : dev === 'S' ? 2 : 0);
    p.pot = Math.round(clamp(p.ovr + upside + gauss(0, 2), p.ovr, 99));
    p.rookie = exp === 0; p.inj = inj || 0; p.ir = !!inj;
    if (dn) p.draft = { season: entry, round: Math.min(7, Math.ceil(dn / 32)), pick: dn, tid: -1 };
    if (tm && idx[tm] != null) {
      L.players[p.id] = p; p.tid = idx[tm]; L.teams[p.tid].roster.push(p.id); // keep real jersey numbers
    } else { p.tid = null; L.players[p.id] = p; L.fa.push(p.id); }
  }
  for (const t of L.teams) autoDepth(L, t);
  // game cap scaled to the payrolls we could match from public contract data
  L.cap = Math.round(Math.max(200, Math.max(...L.teams.map(t => payroll(L, t))) * 1.08));
  L.schedule = D.schedule.map(wk => wk.map(([h, a]) => ({ h: idx[h], a: idx[a], hs: null, as: null })));
  L.userTid = idx[userAbbr] != null ? idx[userAbbr] : 0;
  initPicks(L);
  L.draftClass = genDraftClass(L);
  return L;
}
