// ============================================================
// Gridiron Dynasty - team management: in-season development,
// Development / Contracts / Scouting tabs, big board
// ============================================================
'use strict';

// ---------- in-season development ----------
function bumpOvr(p, d) {
  const w = OVR_W[p.pos];
  for (const k in w) p.r[k] = Math.round(clamp(p.r[k] + d, 15, 99));
  const before = p.ovr; p.ovr = calcOvr(p);
  if (p.ovr > p.pot) p.pot = p.ovr;
  return p.ovr - before;
}
function weeklyProgress(L) {
  const ups = [], downs = [];
  for (const t of L.teams) for (const id of t.roster) {
    const p = L.players[id]; if (!p || p.inj) continue;
    let d = 0;
    if (p.age <= 25 && p.ovr < p.pot) { const c = 0.05 + (p.dev === 'X' ? 0.07 : p.dev === 'S' ? 0.035 : 0) + (p.st && p.st.gp ? 0.02 : 0); if (chance(c)) d = 1; }
    else if (p.age >= 31 && L.week >= 9 && chance(0.03 + (p.age - 31) * 0.01)) d = -1;
    if (!d) continue;
    const ch = bumpOvr(p, d);
    if (!ch) continue;
    p.seasonProg = (p.seasonProg || 0) + ch;
    if (t.id === L.userTid) (ch > 0 ? ups : downs).push(p);
  }
  if (ups.length) addNews(L, `Development: ${ups.map(p => `${p.pos} ${pshort(p)} → ${p.ovr}`).join(', ')} improved this week.`);
  if (downs.length) addNews(L, `Wear and tear: ${downs.map(p => `${p.pos} ${pshort(p)} → ${p.ovr}`).join(', ')} slipped.`);
}
const _simWeekM = simWeek;
simWeek = function (L, includeUser) {
  const wk = L.week, ph = L.phase;
  _simWeekM(L, includeUser);
  if (ph === 'regular' && (L.week > wk || L.phase !== 'regular')) weeklyProgress(L);
};
const _newSeasonM = startNewSeason;
startNewSeason = function (L) {
  _newSeasonM(L);
  for (const p of Object.values(L.players)) p.seasonProg = 0;
  L.scoutPts = SCOUT_BUDGET; L.board = [];
};

// ---------- Development tab ----------
function viewDev() {
  const L = LEAGUE, t = UT();
  const ps = t.roster.map(id => L.players[id]);
  const row = (p, extra) => `<tr class="click" data-act="player" data-pid="${p.id}"><td>${p.pos}</td><td>${esc(pname(p))}</td><td class="r">${p.age}</td><td class="r">${ovrTag(p.ovr)}</td><td>${extra}</td></tr>`;
  const delta = v => `<b style="color:${v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--muted)'}">${v > 0 ? '+' : ''}${v}</b>`;
  const season = ps.filter(p => p.seasonProg).sort((a, b) => b.seasonProg - a.seasonProg);
  const young = ps.filter(p => p.age <= 25).sort((a, b) => b.pot - a.pot).slice(0, 14);
  const last = ps.filter(p => p.lastProg).sort((a, b) => b.lastProg - a.lastProg);
  const aging = ps.filter(p => p.age >= 30).sort((a, b) => b.ovr - a.ovr).slice(0, 10);
  const bar = p => { const lo = 40, w = v => clamp((v - lo) / (99 - lo) * 100, 0, 100); return `<div class="potbar"><i style="width:${w(p.ovr)}%"></i><b style="left:${w(p.pot)}%"></b></div><span class="muted small">POT ${potGrade(p.pot)} · ${devLabel(p.dev)}</span>`; };
  const tbl = (rows, head) => rows ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Player</th><th class="r">Age</th><th class="r">OVR</th><th>${head}</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted small">Nothing yet.</p>';
  return `<div class="card"><h2>How development works</h2><p class="small muted">Players 25 and under can improve during the season, faster with a Star or Superstar trait and when they're playing. Players 31 and older can slip late in the year. Every offseason everyone ages and gets a bigger update.</p></div>
    <div class="cols">
      <div class="card"><h2>This season</h2>${tbl(season.map(p => row(p, delta(p.seasonProg))).join(''), 'Change')}</div>
      <div class="card"><h2>Young core</h2>${tbl(young.map(p => row(p, bar(p))).join(''), 'OVR → potential')}</div>
      <div class="card"><h2>Last offseason</h2>${tbl(last.map(p => row(p, delta(p.lastProg))).join(''), 'Change')}</div>
      <div class="card"><h2>Aging watch</h2>${tbl(aging.map(p => row(p, `<span class="small muted">${p.age >= 33 ? 'High' : p.age >= 31 ? 'Medium' : 'Low'} decline risk · ${p.con.yrs} yr left</span>`)).join(''), 'Outlook')}</div>
    </div>`;
}

// ---------- Contracts tab ----------
function extAsk(p) { return Math.round(resignAsk(p) * (p.ovr >= 85 ? 1.08 : 1) * 100) / 100; }
function viewCap() {
  const L = LEAGUE, t = UT(), cap = capOf(L);
  const ps = t.roster.map(id => L.players[id]).sort((a, b) => b.con.sal - a.con.sal);
  const yrs = [0, 1, 2, 3].map(i => L.season + i);
  const committed = yrs.map((y, i) => ps.reduce((s, p) => s + (p.con.yrs > i ? p.con.sal : 0), 0));
  const head = yrs.map((y, i) => `<div class="capcell"><span class="eyebrow">${y}</span><b class="num">${fmtMoney(committed[i])}</b><span class="small ${cap - committed[i] < 0 ? 'neg' : 'muted'}">${fmtMoney(cap - committed[i])} space</span><div class="meter"><b style="width:${clamp(committed[i] / cap * 100, 0, 100)}%"></b></div></div>`).join('');
  const rows = ps.map(p => {
    const cells = yrs.map((y, i) => `<td class="r num ${p.con.yrs > i ? '' : 'muted'}">${p.con.yrs > i ? fmtMoney(p.con.sal) : i === p.con.yrs ? 'FA' : ''}</td>`).join('');
    const expiring = p.con.yrs <= 1;
    return `<tr class="${expiring ? 'exp' : ''}"><td>${p.pos}</td><td class="click" data-act="player" data-pid="${p.id}">${esc(pname(p))}${expiring ? ' <span class="pill amber">Expiring</span>' : ''}</td><td class="r">${p.age}</td><td class="r">${ovrTag(p.ovr)}</td>${cells}
      <td><button class="btn sm" data-act="cap-ext" data-pid="${p.id}" ${L.phase === 'recap' || L.phase === 'draft' ? 'disabled' : ''}>Extend</button></td></tr>`;
  }).join('');
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">Salary cap</h2><span class="pill">Cap ${fmtMoney(cap)}</span></div><div class="capgrid">${head}</div>
      <p class="small muted">Future years show money already committed. Extend players before their deals run out, or they hit free agency after the season.</p></div>
    <div class="card"><h2>Contracts</h2><div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Player</th><th class="r">Age</th><th class="r">OVR</th>${yrs.map(y => `<th class="r">${y}</th>`).join('')}<th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function extModal(p) {
  const L = LEAGUE, ask = extAsk(p), room = capRoom(L, UT()) + p.con.sal;
  const pref = p.age >= 31 ? 2 : p.ovr >= 80 ? 4 : 3;
  modal(`<div class="modal-head"><h2>Extend ${esc(pname(p))}</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p>${p.pos} · ${p.age}y · ${p.ovr} OVR · current deal ${fmtMoney(p.con.sal)} × ${p.con.yrs} yr</p>
    <p>He wants <b>${fmtMoney(ask)}/yr</b>. ${p.age >= 31 ? 'At his age he prefers a short deal.' : 'He wants long-term security.'}</p>
    <div class="row"><label>Years <select id="extYrs">${[1, 2, 3, 4, 5].map(y => `<option ${y === pref ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
    <button class="btn primary" data-act="cap-ext-do" data-pid="${p.id}" ${room < ask ? 'disabled' : ''}>Sign extension</button></div>
    ${room < ask ? `<p class="small" style="color:var(--red)">You need ${fmtMoney(ask - room)} more cap room this season.</p>` : ''}
    <p class="small muted">The new deal replaces his current one starting now.</p>`);
}

// ---------- Scouting tab + big board ----------
const SCOUT_BUDGET = 1000, SCOUT_COST = [40, 80, 150];
let SC_FILTER = 'ALL';
function scoutInfo(p) {
  const sl = p.sl || 0;
  const ovr = sl >= 3 ? `${p.ovr}` : sl >= 1 ? `${Math.max(30, p.ovr - 2)}–${Math.min(99, p.ovr + 2)}` : `${p.scout.lo}–${p.scout.hi}`;
  const pot = sl >= 2 ? potGrade(p.pot) : p.scout.potG + '?';
  const dev = sl >= 2 ? devLabel(p.dev) : '?';
  return { sl, ovr, pot, dev };
}
function viewScout() {
  const L = LEAGUE; if (L.scoutPts == null) L.scoutPts = SCOUT_BUDGET; L.board = L.board || [];
  const cls = (L.draftClass || []).slice().sort((a, b) => (a.proj || 9) - (b.proj || 9));
  let list = SC_FILTER === 'ALL' ? cls : cls.filter(p => p.pos === SC_FILTER);
  list = list.slice(0, 120);
  const byId = id => cls.find(p => p.id === id);
  const board = L.board.map(byId).filter(Boolean);
  const rows = list.map(p => {
    const s = scoutInfo(p), on = L.board.includes(p.id), next = s.sl < 3 ? SCOUT_COST[s.sl] : null;
    const keys = s.sl >= 3 ? Object.keys(OVR_W[p.pos]).slice(0, 3).map(k => `${RATING_NAMES[k].split(' ').map(w => w[0]).join('')} ${p.r[k]}`).join(' · ') : '';
    return `<tr><td><button class="star ${on ? 'on' : ''}" data-act="sc-star" data-pid="${p.id}" aria-label="Add to big board">${on ? '★' : '☆'}</button></td><td>${p.pos}</td><td>${esc(pname(p))} <span class="muted small">${esc(p.col)}</span>${keys ? `<div class="small muted">${keys}</div>` : ''}</td><td class="r">${p.age}</td><td class="r">${p.proj > 7 ? 'UDFA' : 'R' + p.proj}</td>
      <td class="r num"><b>${s.ovr}</b></td><td class="r">${s.pot}</td><td>${s.dev}</td>
      <td><span class="sl">${'●'.repeat(s.sl)}${'○'.repeat(3 - s.sl)}</span> ${next ? `<button class="btn sm" data-act="sc-do" data-pid="${p.id}" ${L.scoutPts < next ? 'disabled' : ''}>Scout (${next})</button>` : '<span class="small muted">Fully scouted</span>'}</td></tr>`;
  }).join('');
  const boardRows = board.map((p, i) => { const s = scoutInfo(p); return `<div class="pickrow"><span class="num muted" style="width:22px">${i + 1}</span><span style="width:28px">${p.pos}</span><span class="grow">${esc(pname(p))} <span class="muted small">OVR ${s.ovr} · POT ${s.pot}</span></span>
    <button class="btn sm ghost" data-act="sc-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button class="btn sm ghost" data-act="sc-down" data-i="${i}" ${i === board.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button><button class="btn sm ghost" data-act="sc-star" data-pid="${p.id}" aria-label="Remove">✕</button></div>`; }).join('');
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">${L.season + 1} Draft scouting</h2><span class="pill amber">${L.scoutPts} scouting points</span></div>
      <p class="small muted">Level 1 narrows his OVR to within 2. Level 2 reveals true potential and development trait. Level 3 reveals his exact OVR and key ratings. Points reset every season. Star prospects to build your big board.</p></div>
    <div class="cols"><div class="card" style="grid-column: span 2"><div class="row"><h2 class="grow" style="margin:0">Prospects</h2><select data-act="sc-filter">${['ALL', ...POSITIONS].map(p => `<option ${p === SC_FILTER ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="tbl-wrap" style="margin-top:10px"><table class="t"><thead><tr><th></th><th>Pos</th><th>Prospect</th><th class="r">Age</th><th class="r">Proj</th><th class="r">OVR</th><th class="r">Pot</th><th>Dev</th><th>Scouting</th></tr></thead><tbody>${rows || '<tr><td class="muted">No prospects.</td></tr>'}</tbody></table></div></div>
      <div class="card"><h2>My big board</h2>${boardRows || '<p class="muted small">Tap ☆ next to a prospect to add him.</p>'}</div></div>`;
}
// big board inside the draft room
const _viewDraftM = viewDraft;
viewDraft = function () {
  const L = LEAGUE, base = _viewDraftM();
  if (L.phase !== 'draft' || !L.board || !L.board.length) return base;
  const d = L.draft, done = draftDone(L), onClock = !done && d.slots[d.cur].owner === L.userTid;
  const avail = L.board.map(id => L.draftClass.find(p => p.id === id)).filter(Boolean);
  if (!avail.length) return base;
  return `<div class="card"><h2>My big board ${onClock ? '<span class="pill amber">You\'re on the clock</span>' : ''}</h2>${avail.map((p, i) => { const s = scoutInfo(p); return `<div class="pickrow"><span class="num muted" style="width:22px">${i + 1}</span><span style="width:28px">${p.pos}</span><span class="grow">${esc(pname(p))} <span class="muted small">OVR ${s.ovr} · POT ${s.pot} · ${p.proj > 7 ? 'UDFA' : 'proj R' + p.proj}</span></span>${onClock ? `<button class="btn sm primary" data-act="draft-pick" data-pid="${p.id}">Draft</button>` : ''}</div>`; }).join('')}</div>` + base;
};

// ---------- actions ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !LEAGUE) return;
  const a = el.dataset.act, L = LEAGUE;
  if (a === 'cap-ext') extModal(L.players[+el.dataset.pid]);
  else if (a === 'cap-ext-do') {
    const p = L.players[+el.dataset.pid], yrs = +$('#extYrs').value, ask = extAsk(p);
    if (capRoom(L, UT()) + p.con.sal < ask) { toast('Not enough cap room.'); return; }
    p.con = { sal: ask, yrs }; addNews(L, `Extended ${p.pos} ${pname(p)}: ${yrs} yr / ${fmtMoney(ask)} per year.`);
    closeModal(); save(); renderHub(); toast(`${pshort(p)} signed through ${L.season + yrs - 1}.`);
  }
  else if (a === 'sc-do') {
    const p = L.draftClass.find(x => x.id === +el.dataset.pid); if (!p) return;
    const sl = p.sl || 0, cost = SCOUT_COST[sl]; if (sl >= 3 || L.scoutPts < cost) return;
    L.scoutPts -= cost; p.sl = sl + 1; save(); renderHub();
  }
  else if (a === 'sc-star') {
    L.board = L.board || []; const id = +el.dataset.pid, i = L.board.indexOf(id);
    if (i >= 0) L.board.splice(i, 1); else L.board.push(id); save(); renderHub();
  }
  else if (a === 'sc-up' || a === 'sc-down') {
    const i = +el.dataset.i, j = a === 'sc-up' ? i - 1 : i + 1; const b = L.board;
    if (j >= 0 && j < b.length) { [b[i], b[j]] = [b[j], b[i]]; save(); renderHub(); }
  }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-act=sc-filter]'); if (!el) return; SC_FILTER = el.value; renderHub();
});
