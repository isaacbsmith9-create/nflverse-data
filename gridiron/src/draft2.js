// ============================================================
// Gridiron Dynasty - draft day: trade up / trade down during the draft,
// pick grades and class grades, and a Fantasy Draft franchise start.
// ============================================================
'use strict';

const pickVal = overall => Math.round(1000 * Math.exp(-0.042 * (overall - 1)) + 15);
const futureVal = round => Math.round(pickVal((round - 1) * 32 + 16) * 0.85);
function boardScore(p) { return p.ovr * 0.6 + (p.pot || p.ovr) * 0.4; }
function letter(v) { return v >= 15 ? 'A+' : v >= 7 ? 'A' : v >= 2 ? 'B+' : v >= -4 ? 'B' : v >= -10 ? 'C' : v >= -20 ? 'D' : 'F'; }

// ---------------- pick grades ----------------
const _draftPickD2 = draftPick;
draftPick = function (L, pid) {
  const d = L.draft, slot = d && d.slots[d.cur];
  const board = L.draftClass.slice().sort((a, b) => boardScore(b) - boardScore(a));
  const rank = board.findIndex(p => p.id === pid) + 1, overall = d ? d.cur + 1 : 0;
  _draftPickD2(L, pid);
  if (!slot || !rank) return;
  // grade = where he sat on the board of players still available when the pick was made
  const v = rank <= 1 ? 6 : rank <= 3 ? 3 : rank <= 8 ? 0 : rank <= 15 ? -5 : -12;
  const g = { pid, tid: slot.owner, overall, rank, grade: letter(v + (rank === 1 && overall > 10 ? 9 : 0)) };
  (L.dgrades = L.dgrades || []).push(g);
  if (slot.owner === L.userTid && typeof toast === 'function') {
    const p = L.players[pid];
    toast(`Pick #${overall}: ${p.pos} ${pname(p)} — grade ${g.grade}${rank === 1 ? ' (best player on the board!)' : rank > 15 ? ' (a reach)' : ''}`, 3500);
  }
};
function classGrades(L) {
  const by = {};
  for (const g of L.dgrades || []) { const s = { 'A+': 4.3, A: 4, 'B+': 3.3, B: 3, C: 2, D: 1, F: 0 }[g.grade]; (by[g.tid] = by[g.tid] || []).push(s * (g.overall <= 64 ? 1.5 : 1)); }
  return Object.entries(by).map(([tid, a]) => ({ tid: +tid, gpa: a.reduce((x, y) => x + y, 0) / a.length })).sort((a, b) => b.gpa - a.gpa)
    .map(x => Object.assign(x, { grade: x.gpa >= 3.9 ? 'A' : x.gpa >= 3.5 ? 'A-' : x.gpa >= 3.2 ? 'B+' : x.gpa >= 2.9 ? 'B' : x.gpa >= 2.5 ? 'C+' : x.gpa >= 2.1 ? 'C' : 'D' }));
}
const _startDraftD2 = startDraft;
startDraft = function (L) { L.dgrades = []; return _startDraftD2(L); };

// ---------------- trading picks ----------------
function myDraftAssets(L) {
  const d = L.draft, out = [];
  d.slots.forEach((s, i) => { if (i >= d.cur && s.owner === L.userTid && s.pid == null) out.push({ kind: 'slot', i, label: `Round ${s.round}, pick #${i + 1}`, v: pickVal(i + 1) }); });
  for (const pk of L.picks || []) if (pk.owner === L.userTid && pk.season === L.season + 2) out.push({ kind: 'future', pk, label: `${pk.season} round ${pk.round}`, v: futureVal(pk.round) });
  return out;
}
function tradeUpModal() {
  const L = LEAGUE, d = L.draft, cur = d.slots[d.cur]; if (!cur || cur.owner === L.userTid) return;
  const t = L.teams[cur.owner], want = pickVal(d.cur + 1);
  const mine = myDraftAssets(L);
  modal(`<div class="modal-head"><h2>Trade up to #${d.cur + 1}</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p class="small">${esc(teamName(t))} are on the clock. Offer picks worth more than theirs (pick value <b>${want}</b>) and they'll deal.</p>
    <div class="tu-list">${mine.map((a, i) => `<label class="row" style="gap:8px"><input type="checkbox" class="tu-cb" data-i="${i}"> ${a.label} <span class="muted small">value ${a.v}</span></label>`).join('') || '<p class="muted">You have no picks left to trade.</p>'}</div>
    <p class="small">Your offer: <b id="tuVal">0</b> / ${Math.round(want * 1.05)}</p>
    <button class="btn primary" data-act="tu-offer">Make the offer</button>`);
  TU = { mine, want: Math.round(want * 1.05), tid: cur.owner };
}
let TU = null;
function tradeDownOffers(L) {
  const d = L.draft, here = pickVal(d.cur + 1), offers = [];
  const seen = new Set();
  for (let i = d.cur + 1; i < Math.min(d.slots.length, d.cur + 26); i++) {
    const s = d.slots[i]; if (s.owner === L.userTid || seen.has(s.owner)) continue; seen.add(s.owner);
    const theirs = [{ i, v: pickVal(i + 1) }];
    for (let j = i + 1; j < d.slots.length && theirs.reduce((a, b) => a + b.v, 0) < here * 1.04; j++) if (d.slots[j].owner === s.owner) theirs.push({ i: j, v: pickVal(j + 1) });
    const total = theirs.reduce((a, b) => a + b.v, 0);
    if (total >= here * 1.02 && theirs.length <= 3) offers.push({ tid: s.owner, picks: theirs, total });
    if (offers.length >= 4) break;
  }
  return offers;
}
function tradeDownModal() {
  const L = LEAGUE, d = L.draft, offers = tradeDownOffers(L);
  TD_OFFERS = offers;
  modal(`<div class="modal-head"><h2>Trade down from #${d.cur + 1}</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    ${offers.length ? offers.map((o, k) => `<div class="card row"><div class="grow"><b>${esc(teamName(L.teams[o.tid]))}</b><div class="small">${o.picks.map(p => `Round ${d.slots[p.i].round}, #${p.i + 1}`).join(' + ')}</div></div><button class="btn sm primary" data-act="td-take" data-k="${k}">Accept</button></div>`).join('') : '<p class="muted">Nobody wants to move up right now.</p>'}`);
}
let TD_OFFERS = [];
document.addEventListener('change', e => {
  if (e.target.classList && e.target.classList.contains('tu-cb') && TU) { const v = [...document.querySelectorAll('.tu-cb')].filter(c => c.checked).reduce((s, c) => s + TU.mine[+c.dataset.i].v, 0); const el = document.getElementById('tuVal'); if (el) el.textContent = v; }
});
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !LEAGUE) return;
  const L = LEAGUE, a = el.dataset.act, d = L.draft;
  if (a === 'draft-up') tradeUpModal();
  if (a === 'draft-down') tradeDownModal();
  if (a === 'tu-offer' && TU) {
    const sel = [...document.querySelectorAll('.tu-cb')].filter(c => c.checked).map(c => TU.mine[+c.dataset.i]);
    const v = sel.reduce((s, x) => s + x.v, 0);
    if (!sel.length) return toast('Pick something to offer.');
    if (v < TU.want) return toast(`${L.teams[TU.tid].abbr} say no — that's not enough.`);
    for (const x of sel) { if (x.kind === 'slot') d.slots[x.i].owner = TU.tid; else x.pk.owner = TU.tid; }
    d.slots[d.cur].owner = L.userTid;
    addNews(L, `🔁 Draft trade: you move up to #${d.cur + 1} with ${L.teams[TU.tid].abbr}.`);
    TU = null; closeModal(); save(); renderHub(); toast('Trade accepted — you are on the clock!');
  }
  if (a === 'td-take') {
    const o = TD_OFFERS[+el.dataset.k]; if (!o) return;
    d.slots[d.cur].owner = o.tid; for (const p of o.picks) d.slots[p.i].owner = L.userTid;
    addNews(L, `🔁 Draft trade: you move down from #${d.cur + 1}, getting ${o.picks.length} picks from ${L.teams[o.tid].abbr}.`);
    closeModal(); draftAdvance(L, true); save(); renderHub(); toast('Trade done. More picks for you.');
  }
});
const _viewDraftD2 = viewDraft;
viewDraft = function () {
  const L = LEAGUE, h = _viewDraftD2();
  if (L.phase !== 'draft' || !L.draft) return h;
  const d = L.draft;
  if (draftDone(L)) {
    const cg = classGrades(L), mine = (L.dgrades || []).filter(g => g.tid === L.userTid);
    return `<div class="card"><h2>Draft grades</h2><div class="cols"><div><h3 class="small">Your class</h3>${mine.map(g => { const p = L.players[g.pid]; return `<div class="small"><b class="grade g${g.grade[0]}">${g.grade}</b> #${g.overall} ${p.pos} ${esc(pname(p))}</div>`; }).join('') || '<p class="muted small">No picks.</p>'}</div>
      <div><h3 class="small">Best classes</h3>${cg.slice(0, 8).map(x => `<div class="small"><b class="grade g${x.grade[0]}">${x.grade}</b> ${esc(L.teams[x.tid].abbr)}${x.tid === L.userTid ? ' (you)' : ''}</div>`).join('')}</div></div></div>` + h;
  }
  const mineOnClock = d.slots[d.cur] && d.slots[d.cur].owner === L.userTid;
  const bar = `<div class="card row"><span class="grow small">${mineOnClock ? 'You are on the clock.' : `${esc(L.teams[d.slots[d.cur].owner].abbr)} are on the clock at #${d.cur + 1}.`}</span>
    ${mineOnClock ? '<button class="btn sm" data-act="draft-down">Trade down</button>' : '<button class="btn sm" data-act="draft-up">Trade up to this pick</button>'}</div>`;
  return bar + h;
};

// ---------------- fantasy draft ----------------
const FD_ROUNDS = 49;
function initFantasy(L) {
  const pool = [];
  for (const t of L.teams) { for (const id of t.roster) { const p = L.players[id]; p.tid = null; p.ir = false; pool.push(id); } t.roster = []; t.depth = {}; }
  const order = shuffle(L.teams.map(t => t.id));
  L.fantasy = { order, round: 1, idx: 0, pool, done: false, log: [] };
  addNews(L, '🎲 Fantasy draft! Every player in the league is up for grabs. Build your team from scratch.');
}
function fdOnClock(L) { const F = L.fantasy, o = F.round % 2 ? F.order : F.order.slice().reverse(); return o[F.idx]; }
function fdNeed(L, tid, pos) {
  const n = L.teams[tid].roster.filter(id => L.players[id].pos === pos).length;
  return n < STARTERS[pos] ? 14 : n < ROSTER_TARGET[pos] ? 3 : -30;
}
function fdAIChoice(L, tid) {
  let best = null, bs = -1e9;
  const cands = L.fantasy.pool.map(id => L.players[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 120);
  for (const p of cands) {
    const s = p.ovr + (p.age <= 25 ? 3 : p.age >= 32 ? -4 : 0) + fdNeed(L, tid, p.pos) - ((p.pos === 'K' || p.pos === 'P') && L.fantasy.round < 30 ? 15 : 0) + gauss(0, 1.5);
    if (s > bs) { bs = s; best = p; }
  }
  return best;
}
function fdPick(L, pid) {
  const F = L.fantasy, tid = fdOnClock(L), p = L.players[pid]; if (!p || !F.pool.includes(pid)) return;
  F.pool = F.pool.filter(x => x !== pid);
  addToTeam(L, p, tid);
  F.log.unshift(`R${F.round}: ${L.teams[tid].abbr} — ${p.pos} ${pname(p)} (${p.ovr})`); F.log.length = Math.min(F.log.length, 12);
  F.idx++; if (F.idx >= F.order.length) { F.idx = 0; F.round++; }
  if (F.round > FD_ROUNDS || !F.pool.length) fdFinish(L);
}
function fdAdvance(L, stopAtUser) { const F = L.fantasy; while (!F.done && !(stopAtUser && fdOnClock(L) === L.userTid)) { const p = fdAIChoice(L, fdOnClock(L)); if (!p) { fdFinish(L); break; } fdPick(L, p.id); } }
function fdFinish(L) {
  const F = L.fantasy; if (F.done) return; F.done = true;
  for (const id of F.pool) { const p = L.players[id]; p.tid = null; L.fa.push(id); }
  F.pool = [];
  for (const t of L.teams) autoDepth(L, t);
  addNews(L, '✅ Fantasy draft complete. Leftover players are free agents.');
}
function viewFantasy() {
  const L = LEAGUE, F = L.fantasy, t = UT(), mine = fdOnClock(L) === L.userTid;
  const counts = POSITIONS.map(pos => { const n = t.roster.filter(id => L.players[id].pos === pos).length; return `<span class="pill ${n < STARTERS[pos] ? 'red' : n >= ROSTER_TARGET[pos] ? 'green' : ''}">${pos} ${n}/${ROSTER_TARGET[pos]}</span>`; }).join(' ');
  const list = F.pool.map(id => L.players[id]).filter(p => FD_FILTER === 'ALL' || p.pos === FD_FILTER).sort((a, b) => b.ovr - a.ovr).slice(0, 60);
  return `<div class="card"><div class="row"><div class="grow"><h2 style="margin:0">Fantasy Draft</h2><div class="muted small">Round ${F.round} of ${FD_ROUNDS} · ${mine ? '<b style="color:var(--amber)">You are on the clock</b>' : `${esc(L.teams[fdOnClock(L)].abbr)} on the clock`} · ${F.pool.length} players left</div></div>
      ${mine ? '<button class="btn sm" data-act="fd-auto1">Auto-pick for me</button>' : '<button class="btn sm primary" data-act="fd-sim">Sim to my pick</button>'}<button class="btn sm ghost" data-act="fd-all">Auto-draft the rest</button></div>
      <div class="row" style="gap:4px;flex-wrap:wrap;margin-top:8px">${counts}</div></div>
    <div class="cols"><div class="card"><div class="row"><h2 class="grow">Best available</h2><select data-act="fd-filter">${['ALL', ...POSITIONS].map(p => `<option ${FD_FILTER === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Player</th><th class="r">Age</th><th class="r">OVR</th><th class="r">$</th><th></th></tr></thead><tbody>${list.map(p => `<tr><td>${p.pos}</td><td class="click" data-act="player" data-pid="${p.id}">${esc(pname(p))}${p.dev === 'X' ? ' <span class="pill amber">X</span>' : ''}</td><td class="r">${p.age}</td><td class="r">${ovrTag(p.ovr)}</td><td class="r small">${fmtMoney(p.con ? p.con.sal : 0)}</td><td class="r">${mine ? `<button class="btn sm primary" data-act="fd-pick" data-pid="${p.id}">Draft</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h2>Recent picks</h2>${F.log.map(x => `<div class="small">${esc(x)}</div>`).join('') || '<p class="muted small">No picks yet.</p>'}
      <h2 style="margin-top:12px">Your team (${t.roster.length})</h2>${t.roster.map(id => L.players[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 25).map(p => `<div class="small">${p.pos} ${esc(pname(p))} <b>${p.ovr}</b></div>`).join('')}</div></div>`;
}
let FD_FILTER = 'ALL';
const _renderHubFD = renderHub;
renderHub = function () {
  _renderHubFD();
  const L = LEAGUE; if (!L || !L.fantasy || L.fantasy.done) return;
  $('#tabs').innerHTML = '<button class="tab on">Fantasy Draft</button>';
  $('#panel').innerHTML = viewFantasy();
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !LEAGUE || !LEAGUE.fantasy) return;
  const L = LEAGUE, a = el.dataset.act;
  if (a === 'fd-pick') { fdPick(L, +el.dataset.pid); fdAdvance(L, true); save(); renderHub(); }
  if (a === 'fd-auto1') { const p = fdAIChoice(L, L.userTid); if (p) fdPick(L, p.id); fdAdvance(L, true); save(); renderHub(); }
  if (a === 'fd-sim') { fdAdvance(L, true); save(); renderHub(); }
  if (a === 'fd-all') { fdAdvance(L, false); save(); TAB = 'home'; renderHub(); toast('Fantasy draft complete!'); }
});
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.act === 'fd-filter' && LEAGUE) { FD_FILTER = e.target.value; renderHub(); } });
const _setupGoFD = setupGo;
setupGo = function () {
  const fd = document.getElementById('setFD') && document.getElementById('setFD').checked && SETUP.mode === 'franchise';
  const L = SETUP.tmp;
  if (fd && L) initFantasy(L);
  _setupGoFD();
  if (fd && LEAGUE) { fdAdvance(LEAGUE, true); save(); renderHub(); }
};
// no games until the fantasy draft is done
const _simWeekFD = simWeek;
simWeek = function (L, inc) { if (L.fantasy && !L.fantasy.done) fdAdvance(L, false); return _simWeekFD(L, inc); };
