// ============================================================
// Gridiron Dynasty - owner mode, coaching staff, player morale /
// holdouts / trade requests, in-game injuries + injury report,
// trade deadline notice.
// ============================================================
'use strict';

// ---------------- owner ----------------
const OWN_UP = { seats: ['Expand seating', 60, '+4,000 seats per level'], lux: ['Luxury suites', 45, 'More revenue per home game'], fan: ['Fan zone', 30, 'Fans grow happier every week'], train: ['Training facility', 50, 'Young players develop faster'] };
const RELOCATE = ['London', 'Toronto', 'Mexico City', 'San Antonio', 'Portland', 'St. Louis', 'Oklahoma City', 'Salt Lake City', 'Orlando', 'Columbus', 'Austin', 'Vancouver', 'San Diego', 'Oakland'];
function ownerOf(L) {
  if (!L.owner) L.owner = { cash: 80, ticket: 110, fans: 62, lv: { seats: 0, lux: 0, fan: 0, train: 0 }, hist: [], season: { rev: 0, exp: 0 } };
  return L.owner;
}
function ownerCapacity(o) { return 65000 + o.lv.seats * 4000; }
function ownerDemand(L, o) {
  const t = L.teams[L.userTid], gp = t.w + t.l + t.t, wp = gp ? (t.w + t.t * 0.5) / gp : 0.5;
  return clamp(0.5 + o.fans / 260 + wp * 0.22 - (o.ticket - 100) / 380, 0.28, 1);
}
function ownerWeek(L, homeGame, won) {
  const o = ownerOf(L), t = L.teams[L.userTid];
  let rev = capOf(L) / weeksOf(L) * 0.8, exp = payrollOf(L, t) / weeksOf(L) + 0.6 + Object.values(o.lv).reduce((a, b) => a + b, 0) * 0.15 + staffCost(L) / weeksOf(L);
  let att = 0;
  if (homeGame) { att = Math.round(ownerCapacity(o) * ownerDemand(L, o)); rev += att * o.ticket / 1e6 + att * (16 + o.lv.lux * 5) / 1e6 + o.lv.lux * 0.9 + o.fans * 0.02; }
  o.cash = Math.round((o.cash + rev - exp) * 10) / 10;
  o.season.rev += rev; o.season.exp += exp;
  o.fans = clamp(o.fans + (won === true ? 1.4 : won === false ? -1.1 : 0) + o.lv.fan * 0.3 - Math.max(0, o.ticket - 135) / 40, 5, 100);
  o.last = { att, rev: Math.round(rev * 10) / 10, exp: Math.round(exp * 10) / 10, home: homeGame };
}
function payrollOf(L, t) { return t.roster.reduce((s, id) => s + (L.players[id].con ? L.players[id].con.sal : 0), 0); }
function viewOwner() {
  const L = LEAGUE, o = ownerOf(L), t = UT(), dem = ownerDemand(L, o);
  const ups = Object.entries(OWN_UP).map(([k, [n, base, d]]) => { const lv = o.lv[k], cost = base * (lv + 1); return `<div class="own-up"><div class="grow"><b>${n}</b> <span class="muted small">Level ${lv}/3</span><div class="small muted">${d}</div></div>${lv >= 3 ? '<span class="pill green">Maxed</span>' : `<button class="btn sm" data-act="own-up" data-k="${k}" ${o.cash >= cost ? '' : 'disabled'}>Upgrade $${cost}M</button>`}</div>`; }).join('');
  return `<div class="cols"><div class="card"><h2>Owner's office</h2>
      <div class="own-stats"><div><span class="muted small">Cash</span><b class="${o.cash < 0 ? 'neg' : ''}">$${o.cash.toFixed(1)}M</b></div><div><span class="muted small">Fan happiness</span><b>${Math.round(o.fans)}</b></div><div><span class="muted small">Stadium</span><b>${ownerCapacity(o).toLocaleString()}</b></div><div><span class="muted small">Projected crowd</span><b>${Math.round(dem * 100)}%</b></div></div>
      <label class="small" style="display:block;margin-top:10px">Average ticket price: <b id="tkVal">$${o.ticket}</b><input type="range" min="50" max="250" step="5" value="${o.ticket}" data-act="own-ticket" style="width:100%"></label>
      <p class="muted small">Higher prices make more per fan but empty seats and annoy fans. Winning fills the stadium.</p>
      ${o.last ? `<p class="small">Last week: ${o.last.home ? `${o.last.att.toLocaleString()} fans · ` : 'road game · '}revenue $${o.last.rev}M · costs $${o.last.exp}M</p>` : ''}
      <p class="small">This season: revenue <b>$${o.season.rev.toFixed(1)}M</b> · costs <b>$${o.season.exp.toFixed(1)}M</b></p></div>
    <div class="card"><h2>Stadium upgrades</h2>${ups}</div></div>
    <div class="card"><h2>Relocate or rebrand</h2><p class="small muted">Moving costs $150M and resets fan happiness to 55. Rebranding costs $20M.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><select id="relCity">${RELOCATE.map(c => `<option>${c}</option>`).join('')}</select><button class="btn sm" data-act="own-move" ${o.cash >= 150 ? '' : 'disabled'}>Move the ${esc(t.name)}</button>
      <input id="relName" placeholder="New nickname" maxlength="16"><button class="btn sm" data-act="own-rename" ${o.cash >= 20 ? '' : 'disabled'}>Rebrand</button></div></div>`;
}

// ---------------- coaching staff ----------------
const SPECS = { qbdev: ['QB guru', 'OC', ['QB']], skill: ['Skill-position coach', 'OC', ['RB', 'WR', 'TE']], ol: ['O-line guru', 'OC', ['OL']], offscheme: ['Play designer', 'OC', []],
  rush: ['Pass-rush specialist', 'DC', ['DL', 'LB']], dbs: ['Secondary coach', 'DC', ['CB', 'S']], defscheme: ['Defensive mastermind', 'DC', []] };
function genCoach(role) {
  const specs = Object.keys(SPECS).filter(k => SPECS[k][1] === role);
  const ovr = clamp(Math.round(gauss(72, 8)), 55, 94);
  return { name: pick(FIRST) + ' ' + pick(LAST), role, age: randi(34, 64), ovr, spec: pick(specs), sal: Math.round((0.8 + (ovr - 55) / 9) * 10) / 10 };
}
function staffOf(L, tid) {
  L.staff = L.staff || {};
  if (!L.staff[tid]) L.staff[tid] = { oc: genCoach('OC'), dc: genCoach('DC') };
  return L.staff[tid];
}
function staffCost(L) { const s = staffOf(L, L.userTid); return (s.oc ? s.oc.sal : 0) + (s.dc ? s.dc.sal : 0); }
function coachPool(L) { if (!L.coachPool || !L.coachPool.length) L.coachPool = [...Array(5)].map(() => genCoach('OC')).concat([...Array(5)].map(() => genCoach('DC'))); return L.coachPool; }
function coachLine(c) { return c ? `<b>${esc(c.name)}</b> <span class="muted small">${c.age}y</span> ${ovrTag(c.ovr)} <span class="pill">${SPECS[c.spec][0]}</span> <span class="muted small">$${c.sal}M/yr</span>` : '<span class="muted">Vacant</span>'; }
function viewStaff() {
  const L = LEAGUE, s = staffOf(L, L.userTid), t = UT();
  const pool = coachPool(L);
  const row = (c, i) => `<tr><td>${c.role}</td><td>${coachLine(c)}</td><td class="small muted">${SPECS[c.spec][2].length ? 'Develops ' + SPECS[c.spec][2].join('/') : c.role === 'OC' ? 'Boosts the whole offense' : 'Boosts the whole defense'}</td><td class="r"><button class="btn sm" data-act="staff-hire" data-i="${i}">Hire</button></td></tr>`;
  return `<div class="cols"><div class="card"><h2>${esc(t.name)} staff</h2>
      <div class="staff-row"><span class="pos-chip">HC</span> <b>${esc(t.coach || 'You')}</b> <span class="muted small">head coach</span></div>
      <div class="staff-row"><span class="pos-chip">OC</span> ${coachLine(s.oc)}</div><div class="staff-row"><span class="pos-chip">DC</span> ${coachLine(s.dc)}</div>
      <p class="muted small">Coordinators add to game-day ratings (better coach, bigger boost) and speed up development for their specialty. Win a lot and other teams will try to hire them away as head coaches.</p></div>
    <div class="card"><h2>Available coordinators</h2><div class="tbl-wrap"><table class="t"><tbody>${pool.map(row).join('')}</tbody></table></div><p class="muted small">Hiring replaces your current coach in that role. Salary comes out of the owner's cash.</p></div></div>`;
}
const _newGSStaff = newGameState;
newGameState = function (L, hid, aid, opts = {}) {
  const gs = _newGSStaff(L, hid, aid, opts);
  [hid, aid].forEach((tid, side) => {
    const s = staffOf(L, tid), rt = gs.rt[side];
    if (s.oc) { const b = (s.oc.ovr - 70) / 9 * (s.oc.spec === 'offscheme' ? 1.6 : 1); rt.pass += b; rt.run += b; }
    if (s.dc) { const b = (s.dc.ovr - 70) / 9 * (s.dc.spec === 'defscheme' ? 1.6 : 1); rt.cover += b; rt.rush += b * 0.7; rt.rundef += b * 0.7; }
    if (tid === L.userTid) { const ch = teamChem(L); rt.pass += ch; rt.run += ch; rt.cover += ch; rt.rundef += ch; }
  });
  return gs;
};
const _progressStaff = progressPlayer;
progressPlayer = function (p) {
  const r = _progressStaff(p);
  const L = typeof LEAGUE !== 'undefined' ? LEAGUE : null;
  if (!L || p.tid == null || p.tid < 0 || p.age > 31) return r;
  const s = staffOf(L, p.tid); let bonus = 0;
  for (const c of [s.oc, s.dc]) if (c && SPECS[c.spec][2].includes(p.pos)) bonus += 0.6 + (c.ovr - 70) / 18;
  if (p.tid === L.userTid && L.owner) bonus += L.owner.lv.train * 0.35;
  if (bonus > 0.2) { for (const k in OVR_W[p.pos]) p.r[k] = Math.min(99, p.r[k] + bonus * (0.6 + Math.random() * 0.8)); p.ovr = calcOvr(p); }
  return r;
};

// ---------------- morale, holdouts, trade requests ----------------
const mor = p => p.morale == null ? 70 : p.morale;
function teamChem(L) {
  const t = L.teams[L.userTid]; if (!t) return 0;
  const ids = POSITIONS.flatMap(pos => (t.depth[pos] || []).slice(0, STARTERS[pos]));
  if (!ids.length) return 0;
  const avg = ids.reduce((s, id) => s + mor(L.players[id]), 0) / ids.length;
  return clamp((avg - 65) / 8, -2.5, 2.5);
}
function underpaid(p) { return p.ovr >= 80 && p.con && p.con.sal < marketSalary(p) * 0.6; }
function moraleWeek(L, won) {
  const t = L.teams[L.userTid];
  const starters = new Set(POSITIONS.flatMap(pos => (t.depth[pos] || []).slice(0, STARTERS[pos])));
  for (const id of t.roster) {
    const p = L.players[id]; let m = mor(p);
    m += won === true ? 1.8 : won === false ? -1.6 : 0;
    if (starters.has(id)) m += 0.6; else if (p.ovr >= 76) m -= 1.4;
    if (underpaid(p)) m -= 0.9;
    m += (70 - m) * 0.04;
    p.morale = clamp(Math.round(m * 10) / 10, 0, 100);
    if (p.holdout && (p.con.sal >= marketSalary(p) * 0.8 || L.week > 6)) {
      p.holdout = false; p.morale = clamp(p.morale + (L.week > 6 ? -10 : 15), 0, 100);
      addNews(L, `${p.pos} ${pname(p)} ${L.week > 6 ? 'ends his holdout and reports, unhappy' : 'ends his holdout after his new deal'}.`);
    }
    if (!p.tradeReq && p.morale < 30 && p.ovr >= 72) { p.tradeReq = true; addNews(L, `😠 ${p.pos} ${pname(p)} has requested a trade.`); }
    else if (p.tradeReq && p.morale > 52) { p.tradeReq = false; addNews(L, `${p.pos} ${pname(p)} withdraws his trade request.`); }
  }
}
// holdouts can't play
const _lineupMor = lineup;
lineup = function (L, t, extra) {
  const hold = t.id === L.userTid ? t.roster.map(id => L.players[id]).filter(p => p.holdout && !p.inj) : [];
  for (const p of hold) p.inj = 99;
  try { return _lineupMor(L, t, extra); } finally { for (const p of hold) p.inj = 0; }
};
const _startNewSeasonMor = startNewSeason;
startNewSeason = function (L) {
  _startNewSeasonMor(L);
  const t = L.teams[L.userTid]; if (!t) return;
  ownerOf(L).season = { rev: 0, exp: 0 };
  for (const id of t.roster) {
    const p = L.players[id];
    if (p.ovr >= 84 && p.con && p.con.yrs <= 1 && underpaid(p) && chance(0.5) && !p.star) { p.holdout = true; p.morale = Math.min(mor(p), 40); addNews(L, `💼 ${p.pos} ${pname(p)} is HOLDING OUT for a new contract. Extend him in Contracts to end it.`); }
  }
};

// weekly hooks
const _simWeekF2 = simWeek;
simWeek = function (L, includeUser) {
  const wk0 = L.week, ph0 = L.phase;
  const g = ph0 === 'regular' ? (L.schedule[wk0 - 1] || []).find(x => x.h === L.userTid || x.a === L.userTid) : null;
  const r = _simWeekF2(L, includeUser);
  if (ph0 === 'regular' && L.week !== wk0) {
    const won = g && g.hs != null ? (g.h === L.userTid ? g.hs > g.as : g.as > g.hs) : null;
    ownerWeek(L, !!(g && g.h === L.userTid), won);
    moraleWeek(L, won);
    if (wk0 === 10) addNews(L, '⏰ The trade deadline has passed. No more trades until the offseason.');
  }
  return r;
};

// offseason: coordinators get poached, bad head coaches get fired
const _beginOffF2 = beginOffseason;
beginOffseason = function (L) {
  _beginOffF2(L);
  L.coachPool = [];
  for (const t of L.teams) {
    const s = staffOf(L, t.id);
    for (const role of ['oc', 'dc']) {
      const c = s[role]; if (!c) continue;
      c.age++; c.ovr = clamp(c.ovr + randi(-2, 3) - (c.age > 62 ? 2 : 0), 50, 96);
      if (t.w >= 11 && c.ovr >= 78 && chance(0.35)) {
        addNews(L, `${t.abbr} ${role.toUpperCase()} ${c.name} is hired as a head coach elsewhere.`);
        s[role] = t.id === L.userTid ? null : genCoach(c.role);
      }
    }
    if (t.id !== L.userTid && t.w <= 4 && chance(0.5)) {
      const old = t.coach; t.coach = pick(FIRST) + ' ' + pick(LAST);
      addNews(L, `${t.abbr} fires head coach ${old || 'their head coach'}; ${t.coach} takes over.`);
      s.oc = genCoach('OC'); s.dc = genCoach('DC');
    }
  }
  const us = staffOf(L, L.userTid);
  if (!us.oc || !us.dc) addNews(L, `⚠ Your staff has a vacancy — hire a coordinator in the Staff tab.`);
};

// ---------------- in-game injuries ----------------
const INJ = [['ankle sprain', 1, 2], ['hamstring', 1, 3], ['knee', 2, 6], ['shoulder', 1, 4], ['concussion', 1, 2], ['ribs', 1, 3], ['high ankle sprain', 3, 6], ['torn ACL', 12, 17]];
const _endPlayInj = LiveGame.prototype.endPlay;
LiveGame.prototype.endPlay = function (kind, msg) {
  const was = this.phase, c = this.carrier(), tk = this.tackler;
  const r = _endPlayInj.call(this, kind, msg);
  if (was === 'live' && kind === 'tackle' && c) {
    for (const [e, p0] of [[c, 0.0055], [tk, 0.0025]]) if (e && e.p && !e.p.scrub && !e.p.star && chance(p0 * sl().inj)) this.injure(e);
  }
  return r;
};
LiveGame.prototype.injure = function (e) {
  const L = this.L, p = e.p, gs = this.gs;
  const side = gs.lu[0][p.pos] && gs.lu[0][p.pos].includes(p) ? 0 : gs.lu[1][p.pos] && gs.lu[1][p.pos].includes(p) ? 1 : -1; if (side < 0) return;
  const [type, lo, hi] = weighted(INJ, x => x[1] >= 12 ? 0.4 : 3);
  p.inj = randi(lo, hi) + 1; p.injType = type;
  const t = L.teams[gs.tids[side]], used = new Set(Object.values(gs.lu[side]).flat().map(x => x.id));
  const sub = (t.depth[p.pos] || []).map(id => L.players[id]).find(x => x && !x.inj && !used.has(x.id) && !x.holdout);
  const arr = gs.lu[side][p.pos], i = arr.indexOf(p);
  if (sub) arr[i] = sub;
  logp(gs, `INJURY: ${pshort(p)} (${type}) is out.`);
  this.h.toast && this.h.toast(`🚑 ${t.abbr} ${p.pos} ${pshort(p)} is hurt (${type}, ~${p.inj - 1} wk).${sub ? ` ${pshort(sub)} comes in.` : ''}`);
  if (t.id === L.userTid) addNews(L, `🚑 ${p.pos} ${pname(p)} suffered a ${type} — out about ${p.inj - 1} week${p.inj - 1 === 1 ? '' : 's'}.`);
};

// ---------------- Locker Room tab ----------------
function viewLocker() {
  const L = LEAGUE, t = UT(), ch = teamChem(L);
  const ps = t.roster.map(id => L.players[id]).sort((a, b) => b.ovr - a.ovr);
  const inj = ps.filter(p => p.inj > 0);
  const flags = p => [p.holdout ? '<span class="pill red">Holdout</span>' : '', p.tradeReq ? '<span class="pill red">Wants trade</span>' : '', underpaid(p) ? '<span class="pill amber">Underpaid</span>' : ''].join(' ');
  const face = m => m >= 80 ? '😄' : m >= 60 ? '🙂' : m >= 40 ? '😐' : m >= 25 ? '😕' : '😠';
  return `<div class="cols"><div class="card"><h2>Team chemistry</h2><div class="chem"><b class="${ch >= 0 ? 'pos' : 'neg'}">${ch >= 0 ? '+' : ''}${ch.toFixed(1)}</b><span class="muted small">game-day rating bonus from your starters' morale</span></div>
      <p class="muted small">Winning, playing time and fair contracts keep players happy. Unhappy stars ask for trades; underpaid stars in their last year can hold out.</p>
      <h2 style="margin-top:12px">Injury report</h2>${inj.length ? `<div class="tbl-wrap"><table class="t"><tbody>${inj.map(p => `<tr><td>${p.pos}</td><td>${esc(pname(p))}</td><td class="small">${esc(p.injType || 'injury')}</td><td class="r">${p.inj >= 90 ? '—' : p.inj + ' wk'}${p.ir ? ' <span class="pill">IR</span>' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Everyone is healthy.</p>'}</div>
    <div class="card"><h2>Morale</h2><div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Player</th><th class="r">OVR</th><th class="r">Morale</th><th></th></tr></thead><tbody>${ps.map(p => `<tr class="click" data-act="player" data-pid="${p.id}"><td>${p.pos}</td><td>${esc(pname(p))}</td><td class="r">${ovrTag(p.ovr)}</td><td class="r num">${face(mor(p))} ${Math.round(mor(p))}</td><td>${flags(p)}</td></tr>`).join('')}</tbody></table></div></div></div>`;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !LEAGUE) return;
  const L = LEAGUE, a = el.dataset.act;
  if (a === 'own-up') { const o = ownerOf(L), k = el.dataset.k, cost = OWN_UP[k][1] * (o.lv[k] + 1); if (o.cash < cost || o.lv[k] >= 3) return; o.cash -= cost; o.lv[k]++; addNews(L, `🏗 ${OWN_UP[k][0]} upgraded to level ${o.lv[k]}.`); save(); renderHub(); toast('Upgrade complete.'); }
  if (a === 'own-move') { const o = ownerOf(L), city = $('#relCity').value, t = UT(); if (o.cash < 150) return; if (!confirm(`Move the ${t.name} to ${city}?`)) return; o.cash -= 150; o.fans = 55; const old = t.city; t.city = city; addNews(L, `🚚 The ${t.name} relocate from ${old} to ${city}!`); save(); renderHub(); }
  if (a === 'own-rename') { const o = ownerOf(L), n = ($('#relName').value || '').trim().slice(0, 16), t = UT(); if (!n || o.cash < 20) return; o.cash -= 20; const old = t.name; t.name = n; addNews(L, `🎨 The ${t.city} ${old} rebrand as the ${t.city} ${n}.`); save(); renderHub(); }
  if (a === 'staff-hire') { const pool = coachPool(L), c = pool[+el.dataset.i]; if (!c) return; const s = staffOf(L, L.userTid), k = c.role === 'OC' ? 'oc' : 'dc'; const old = s[k]; s[k] = c; pool.splice(+el.dataset.i, 1); if (old) pool.push(old); addNews(L, `📋 You hire ${c.name} as ${c.role}.`); save(); renderHub(); toast(`${c.name} hired.`); }
});
document.addEventListener('input', e => {
  if (e.target.dataset && e.target.dataset.act === 'own-ticket' && LEAGUE) { ownerOf(LEAGUE).ticket = +e.target.value; const v = document.getElementById('tkVal'); if (v) v.textContent = '$' + e.target.value; }
});
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.act === 'own-ticket' && LEAGUE) { save(); renderHub(); } });
