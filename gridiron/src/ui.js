// ============================================================
// Gridiron Dynasty - UI: menus, franchise hub, game screen
// ============================================================
'use strict';

let LEAGUE = null, SLOT = 1, GAME = null, EXHIB = false, TAB = 'home';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function show(id) { for (const s of $$('.screen')) s.hidden = s.id !== id; }
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); }
function badge(t, cls = '') { return typeof emblemSVG === 'function' ? `<span class="emb ${cls}" title="${esc(t.city + ' ' + t.name)}">${emblemSVG(t)}</span>` : `<span class="badge ${cls}" style="--c1:${t.c1};--c2:${t.c2}">${esc(t.abbr)}</span>`; }
function ovrTag(o) { return `<span class="ovr ${ovrClass(o)}">${o}</span>`; }
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
function save() { if (LEAGUE && !EXHIB) { if (!saveLeague(LEAGUE, SLOT)) toast('Save failed — browser storage may be full or blocked. Use Export in Settings.'); } }
const UT = () => LEAGUE.teams[LEAGUE.userTid];
let touchMode = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
window.__mute = false;
try { window.__mute = localStorage.getItem('gd_mute') === '1'; } catch (e) { }

// ============================================================ MENU
function renderMenu() {
  show('menu');
  const box = $('#slots'); let h = '';
  for (let s = 1; s <= 3; s++) {
    const m = saveMeta(s);
    if (m) h += `<div class="slot"><div class="row">${badge({ abbr: m.abbr, c1: m.c1, c2: m.c2, name: m.team.split(' ').slice(-1)[0], city: '' })}<div class="grow"><h3>${esc(m.team)}</h3><div class="muted small">${m.season} · ${phaseLabel(m.phase, m.week)} · ${m.rec}</div></div></div>
      <div class="row"><button class="btn primary sm" data-act="load" data-slot="${s}">Continue</button><button class="btn danger sm" data-act="del-slot" data-slot="${s}">Delete</button></div></div>`;
    else h += `<div class="slot"><h3 class="muted">Slot ${s} — empty</h3><div><button class="btn sm" data-act="new-franchise" data-slot="${s}">Start franchise here</button></div></div>`;
  }
  box.innerHTML = h;
}
function phaseLabel(ph, wk) {
  return { regular: 'Week ' + wk, playoffs: 'Playoffs', recap: 'Season recap', resign: 'Re-sign players', fa: 'Free agency', draft: 'Draft' }[ph] || ph;
}
function firstFreeSlot() { for (let s = 1; s <= 3; s++) if (!saveMeta(s)) return s; return 1; }

// ============================================================ SETUP
let SETUP = { mode: 'franchise', tid: null, slot: 1, tmp: null };
function renderSetup(mode, slot) {
  const real = hasRealData() && $('#setLeague').value === 'real';
  SETUP = { mode, tid: null, slot: slot || (SETUP.slot && mode === SETUP.mode ? SETUP.slot : firstFreeSlot()), tmp: real ? newRealLeague('BUF') : newLeague('BOS') };
  $('#leagueWrap').hidden = !hasRealData();
  show('setup');
  $('#setupTitle').textContent = mode === 'franchise' ? 'Choose your franchise' : 'Quick Play — pick your team';
  $('#awayWrap').hidden = mode !== 'quick';
  $('#setupGo').disabled = true;
  const L = SETUP.tmp;
  $('#setAway').innerHTML = L.teams.map(t => `<option value="${t.id}">${esc(teamName(t))}</option>`).join('');
  $('#setAway').value = String(randi(0, 31));
  let h = '';
  for (const conf of confsOf(L)) {
    h += `<h2 class="conf-h">${conf}${L.real ? '' : ' Conference'}</h2><div class="teams-grid">`;
    for (const t of L.teams.filter(t => t.conf === conf)) {
      const o = teamOvr(L, t);
      h += `<button class="team-card" data-act="pick-team" data-tid="${t.id}">${badge(t)}<div class="grow"><div class="nm">${esc(t.city)}<br>${esc(t.name)}</div><div class="muted small">${t.coach ? 'HC ' + esc(t.coach) + ' · ' : ''}${t.div} · OFF ${o.off} · DEF ${o.def}</div></div>${ovrTag(o.ovr)}</button>`;
    }
    h += '</div>';
  }
  $('#teamGrid').innerHTML = h;
}

function setupGo() {
  const L = SETUP.tmp; const tid = SETUP.tid; if (tid == null) return;
  L.userTid = tid;
  L.settings.diff = $('#setDiff').value; L.settings.qlen = +$('#setQlen').value; L.settings.simDef = $('#setSimDef').checked;
  L.news = []; addNews(L, `Welcome to the ${L.season} season! You are the GM and head coach of the ${teamName(L.teams[tid])}.`);
  if (SETUP.mode === 'franchise') {
    LEAGUE = L; SLOT = SETUP.slot; EXHIB = false; save(); TAB = 'home'; renderHub();
  } else {
    LEAGUE = L; EXHIB = true;
    let away = +$('#setAway').value; if (away === tid) away = (tid + 1) % 32;
    startLiveGame(tid, away, tid, { exhibition: true });
  }
}

// ============================================================ HUB
const TABS = [['home', 'Home'], ['roster', 'Roster'], ['depth', 'Depth Chart'], ['schedule', 'Schedule'], ['standings', 'Standings'], ['stats', 'Leaders'], ['trade', 'Trade'], ['fa', 'Free Agents'], ['draft', 'Draft'], ['history', 'History'], ['settings', 'Settings']];
function renderHub() {
  show('hub');
  const L = LEAGUE, t = UT(), o = teamOvr(L, t);
  document.documentElement.style.setProperty('--tc1', t.c1);
  $('#hubHead').innerHTML = `<div class="wrap">${badge(t, 'lg')}<div class="grow"><div class="hub-title">${esc(teamName(t))}</div>
    <div class="hub-sub">${t.coach ? 'Head coach ' + esc(t.coach) + ' · ' : ''}${L.season} · ${phaseLabel(L.phase, L.week)} · <b class="num">${recStr(t)}</b> · OVR ${o.ovr} (OFF ${o.off} / DEF ${o.def}) · Cap room <b class="num">${fmtMoney(capRoom(L, t))}</b> · Roster ${activeCount(L, t)}/53${t.roster.length > activeCount(L, t) ? ` (+${t.roster.length - activeCount(L, t)} IR)` : ''}</div></div>
    <div class="rings">${[['OVR', o.ovr], ['OFF', o.off], ['DEF', o.def]].map(([n, v]) => `<div class="ring" style="--v:${v}"><b>${v}</b><span>${n}</span></div>`).join('')}</div>
    <button class="btn sm ghost" data-act="menu">Menu</button></div>`;
  const dotTab = { home: ['recap', 'resign', 'fa', 'draft'].includes(L.phase), draft: L.phase === 'draft', fa: L.phase === 'fa' };
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button class="tab ${TAB === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}${dotTab[k] ? '<span class="dot"></span>' : ''}</button>`).join('');
  const P = $('#panel');
  const fn = { home: viewHome, roster: viewRoster, depth: viewDepth, schedule: viewSchedule, standings: viewStandings, stats: viewStats, trade: viewTrade, fa: viewFA, draft: viewDraft, history: viewHistory, settings: viewSettings }[TAB];
  P.innerHTML = fn();
  if (TAB === 'trade') tradeRefresh();
}

// ---------- home ----------
function viewHome() {
  const L = LEAGUE, t = UT();
  let main = '';
  if (L.phase === 'regular' || L.phase === 'playoffs') main = homeGameCard();
  else if (L.phase === 'recap') main = recapCard();
  else if (L.phase === 'resign') main = resignCard();
  else if (L.phase === 'fa') main = `<div class="card"><h2>Free Agency — Day ${L.faDay} of 3</h2><p>Sign players from the <b>Free Agents</b> tab. Other teams sign players each day you advance.</p>
    <div class="row"><button class="btn" data-act="tab" data-tab="fa">Open Free Agents</button>${L.faDay < 3 ? `<button class="btn primary" data-act="fa-day">Advance to Day ${L.faDay + 1}</button>` : `<button class="btn primary" data-act="start-draft">Go to the Draft</button>`}</div></div>`;
  else if (L.phase === 'draft') main = `<div class="card"><h2>${L.season + 1} Draft</h2><p>${draftDone(L) ? 'The draft is complete.' : 'The draft is live — head to the Draft tab.'}</p><div class="row">${draftDone(L) ? `<button class="btn primary" data-act="new-season">Start the ${L.season + 1} season</button>` : `<button class="btn primary" data-act="tab" data-tab="draft">Open Draft Room</button>`}</div></div>`;
  const lu = lineup(L, t, 0);
  const starters = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'CB', 'S'].map(pos => lu[pos].slice(0, pos === 'WR' || pos === 'CB' ? 2 : 1).map(p => `<tr class="click" data-act="player" data-pid="${p.id}"><td>${pos}</td><td>${esc(pname(p))}${p.inj ? ` <span class="inj">INJ ${p.inj}w</span>` : ''}</td><td class="r">${ovrTag(p.ovr)}</td></tr>`).join('')).join('');
  return `${main}<div class="cols">
    <div class="card"><h2>Key starters</h2><div class="tbl-wrap"><table class="t"><tbody>${starters}</tbody></table></div></div>
    <div class="card"><h2>League news</h2><div class="news">${L.news.slice(0, 30).map(n => `<div><span class="muted small">${n.s}${L.phase === 'regular' ? '' : ''} · </span>${esc(n.txt)}</div>`).join('')}</div></div>
  </div>`;
}
function homeGameCard() {
  const L = LEAGUE, g = userGame(L);
  if (!g) {
    if (L.phase === 'playoffs') return `<div class="card"><h2>${ROUND_NAMES[L.playoffs.round]}</h2><p>Your season is over. Watch the rest of the playoffs.</p>${playoffList()}<div class="row"><button class="btn primary" data-act="sim-week">Sim ${ROUND_NAMES[L.playoffs.round]}</button></div></div>`;
    return `<div class="card"><h2>Bye</h2><div class="row"><button class="btn primary" data-act="sim-week">Sim week</button></div></div>`;
  }
  const H = L.teams[g.h], A = L.teams[g.a], oh = teamOvr(L, H), oa = teamOvr(L, A);
  const label = L.phase === 'playoffs' ? ROUND_NAMES[L.playoffs.round] : `Week ${L.week} of ${weeksOf(L)}`;
  const side = t => `<div class="side">${badge(t, 'lg')}<div class="tn">${esc(t.city)}<br>${esc(t.name)}</div><div class="muted small num">${recStr(t)} · OVR ${teamOvr(L, t).ovr}</div>${t.coach ? `<div class="muted small">HC ${esc(t.coach)}</div>` : ''}</div>`;
  return `<div class="card stack"><div class="row"><span class="eyebrow grow">${label}</span><span class="pill">${g.h === L.userTid ? 'HOME' : 'AWAY'}</span></div>
    <div class="matchup">${side(A)}<div class="vs">@</div>${side(H)}</div>
    <div class="row" style="justify-content:center"><button class="btn primary" data-act="play-game">▶ Play Game</button><button class="btn" data-act="sim-game">Sim Game</button>
    ${L.phase === 'regular' ? `<button class="btn ghost" data-act="sim-to-playoffs">Sim to end of season</button>` : ''}</div>
    ${L.phase === 'playoffs' ? playoffList() : lastResults()}</div>`;
}
function playoffList() {
  const L = LEAGUE; const po = L.playoffs; if (!po) return '';
  const rows = po.games.map(g => `<div class="row small"><span class="grow">${L.teams[g.a].abbr} @ ${L.teams[g.h].abbr}</span><span class="num">${g.hs == null ? '—' : g.as + '-' + g.hs}</span></div>`).join('');
  return `<div class="stack small" style="gap:4px">${rows}</div>`;
}
function lastResults() {
  const L = LEAGUE; const wk = L.schedule[L.week - 2]; if (!wk) return '';
  return `<div class="small muted">Last week: ${wk.map(g => `${L.teams[g.a].abbr} ${g.as}-${g.hs} ${L.teams[g.h].abbr}`).join(' · ')}</div>`;
}
function recapCard() {
  const L = LEAGUE, h = L.history[0], aw = L.awards[0];
  const awn = a => a ? `${esc(a.name)} <span class="muted">(${a.pos}, ${L.teams[a.tid] ? L.teams[a.tid].abbr : ''})</span>` : '—';
  return `<div class="card stack"><span class="eyebrow">${L.season} season complete</span>
    <div class="row">${badge(L.teams[h.champ], 'lg')}<div><h2 style="margin:0">${esc(teamName(L.teams[h.champ]))} win the Grand Bowl</h2><div class="muted">Beat ${esc(teamName(L.teams[h.runner]))} ${h.score}</div></div></div>
    <div class="cols"><div><div class="eyebrow">MVP</div>${awn(aw.mvp)}</div><div><div class="eyebrow">Offensive POY</div>${awn(aw.opoy)}</div><div><div class="eyebrow">Defensive POY</div>${awn(aw.dpoy)}</div><div><div class="eyebrow">Rookie of the Year</div>${awn(aw.roy)}</div></div>
    <p class="muted small">Next: players age and progress, some retire, and contracts expire.</p>
    <div><button class="btn primary" data-act="begin-offseason">Begin Offseason</button></div></div>`;
}
function resignCard() {
  const L = LEAGUE, t = UT();
  const exp = t.roster.map(id => L.players[id]).filter(p => p.con.yrs <= 0).sort((a, b) => b.ovr - a.ovr);
  const rows = exp.map(p => `<tr><td>${p.pos}</td><td class="click" data-act="player" data-pid="${p.id}">${esc(pname(p))}</td><td class="r">${p.age}</td><td class="r">${ovrTag(p.ovr)}</td><td class="r">${fmtMoney(resignAsk(p))}</td>
    <td><select id="ry${p.id}">${[1, 2, 3, 4, 5].map(y => `<option ${y === 3 ? 'selected' : ''}>${y}</option>`).join('')}</select></td>
    <td><button class="btn sm primary" data-act="resign" data-pid="${p.id}">Re-sign</button> <button class="btn sm" data-act="release" data-pid="${p.id}">Let go</button></td></tr>`).join('');
  const prog = t.roster.map(id => L.players[id]).filter(p => p.lastProg).sort((a, b) => b.lastProg - a.lastProg);
  const pr = arr => arr.map(p => `${p.pos} ${esc(pshort(p))} <b class="${p.lastProg > 0 ? '' : ''}">${p.lastProg > 0 ? '+' : ''}${p.lastProg}</b>`).join(' · ');
  return `<div class="card stack"><h2>Re-sign your players</h2>
    <div class="small"><b>Biggest jumps:</b> ${pr(prog.slice(0, 5)) || '—'}<br><b>Declines:</b> ${pr(prog.slice(-4).reverse().filter(p => p.lastProg < 0)) || '—'}</div>
    <div class="muted small">Cap room: <b>${fmtMoney(capRoom(L, t))}</b>. Expiring players you don't re-sign hit free agency.</div>
    ${exp.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Name</th><th class="r">Age</th><th class="r">OVR</th><th class="r">Asking / yr</th><th>Years</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No expiring contracts.</p>'}
    <div><button class="btn primary" data-act="finish-resign">Continue to Free Agency</button></div></div>`;
}

// ---------- roster ----------
let ROSTER_FILTER = 'ALL', ROSTER_SORT = 'pos';
const POS_ORDER = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));
function viewRoster() {
  const L = LEAGUE, t = UT();
  let ps = t.roster.map(id => L.players[id]);
  if (ROSTER_FILTER !== 'ALL') ps = ps.filter(p => p.pos === ROSTER_FILTER);
  const sorters = { pos: (a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.ovr - a.ovr, ovr: (a, b) => b.ovr - a.ovr, age: (a, b) => a.age - b.age, sal: (a, b) => b.con.sal - a.con.sal };
  ps.sort(sorters[ROSTER_SORT] || sorters.pos);
  const rows = ps.map(p => `<tr class="click" data-act="player" data-pid="${p.id}"><td>${p.pos}</td><td>#${p.num} ${esc(pname(p))}${p.inj ? ` <span class="inj">${p.ir ? 'IR' : 'INJ'} ${p.inj}w</span>` : ''}${p.rookie ? ' <span class="pill">R</span>' : ''}</td>
    <td class="r">${p.age}</td><td class="r">${ovrTag(p.ovr)}</td><td>${p.dev !== 'N' ? `<span class="devb dev-${p.dev}">${devLabel(p.dev)}</span>` : '<span class="muted small">Normal</span>'}</td><td class="r">${fmtMoney(p.con.sal)}</td><td class="r">${p.con.yrs}</td><td class="small muted">${statLine(p)}</td></tr>`).join('');
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">Roster</h2>
    <select data-act="roster-filter">${['ALL', ...POSITIONS].map(p => `<option ${p === ROSTER_FILTER ? 'selected' : ''}>${p}</option>`).join('')}</select>
    <select data-act="roster-sort">${[['pos', 'Sort: Position'], ['ovr', 'Sort: OVR'], ['age', 'Sort: Age'], ['sal', 'Sort: Salary']].map(([k, n]) => `<option value="${k}" ${k === ROSTER_SORT ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="muted small">Payroll ${fmtMoney(payroll(L, t))} / ${fmtMoney(capOf(L))} · ${t.roster.length} players. Tap a player for ratings, contract and actions.</div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Player</th><th class="r">Age</th><th class="r">OVR</th><th>Dev</th><th class="r">Salary</th><th class="r">Yrs</th><th>Season</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function statLine(p, s) {
  s = s || p.st || {};
  const parts = [];
  if (s.pa) parts.push(`${s.pc || 0}/${s.pa} ${s.py || 0} yds ${s.ptd || 0} TD ${s.pint || 0} INT`);
  if (s.ra) parts.push(`${s.ra} car ${s.ry || 0} yds ${s.rtd || 0} TD`);
  if (s.rec) parts.push(`${s.rec} rec ${s.rcy || 0} yds ${s.rctd || 0} TD`);
  if (s.tk || s.sk || s.dint) parts.push(`${s.tk || 0} tkl ${s.sk || 0} sk ${s.dint || 0} INT`);
  if (s.fga) parts.push(`${s.fgm || 0}/${s.fga} FG`);
  return parts.join(' · ');
}

function playerModal(pid) {
  const L = LEAGUE; const p = L.players[pid] || (L.draftClass || []).find(x => x.id === +pid); if (!p) return;
  const mine = p.tid === L.userTid, fa = p.tid == null, prospect = p.tid === -1;
  const t = p.tid != null && p.tid >= 0 ? L.teams[p.tid] : null;
  const w = OVR_W[p.pos];
  const keys = Object.keys(w).sort((a, b) => w[b] - w[a]).concat(RATING_KEYS.filter(k => !w[k] && ['spd', 'str', 'agi', 'awr'].includes(k)));
  const bars = keys.map(k => { const v = prospect ? null : p.r[k]; return `<div class="bar ${w[k] ? 'key' : ''}"><span>${RATING_NAMES[k]}</span><i><b style="width:${prospect ? 0 : v}%"></b></i><span class="num">${prospect ? '?' : v}</span></div>`; }).join('');
  const career = p.career.slice().reverse().map(c => `<tr><td>${c.season}</td><td>${c.tm}</td><td class="r">${c.gp || 0}</td><td class="small">${statLine(p, c)}</td></tr>`).join('');
  let actions = '';
  if (mine) {
    actions = `<button class="btn sm" data-act="promote" data-pid="${p.id}">Make starter</button>
      ${tradeAllowed(L) ? `<button class="btn sm" data-act="shop" data-pid="${p.id}">Trade him</button>` : ''}
      <button class="btn sm danger" data-act="cut" data-pid="${p.id}">Release</button>`;
  } else if (fa && !prospect) {
    const ask = faAsk(p), rivals = faRivals(L, p), interest = Math.round(faInterest(L, p, L.userTid) * 100);
    actions = `<div class="stack" style="width:100%;gap:8px"><div class="small muted">Asking ${fmtMoney(ask)}/yr · Interest in your team ${interest}%${rivals ? ` · ${rivals} rival team${rivals > 1 ? 's' : ''} bidding` : ''}</div>
      <div class="row"><label>Salary $M/yr <input type="number" id="faSal" step="0.25" min="0.75" value="${ask.toFixed(2)}" style="width:110px"></label>
      <label>Years <select id="faYrs">${[1, 2, 3, 4, 5].map(y => `<option ${y === 2 ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <button class="btn sm primary" data-act="sign" data-pid="${p.id}">Make offer</button></div><div class="small" id="negMsg"></div></div>`;
  } else if (t && tradeAllowed(L)) actions = `<button class="btn sm" data-act="trade-for" data-pid="${p.id}">Trade for him</button>`;
  const header = prospect ? `${p.col} · Age ${p.age} · Proj. round ${p.proj > 7 ? 'UDFA' : p.proj} · Scouted OVR ${p.scout.lo}–${p.scout.hi} · Potential ${p.scout.potG}`
    : `${t ? esc(teamName(t)) : 'Free agent'} · Age ${p.age} · ${p.col} · ${devLabel(p.dev)} dev${mine ? ` · Potential ${potGrade(p.pot)}` : ''}`;
  modal(`<div class="modal-head pcard" style="--tc:${t ? t.c1 : '#2a3a34'}">${prospect ? '' : `<div class="shield ${ovrClass(p.ovr)}"><b>${p.ovr}</b><span>OVR</span></div>`}<div class="grow"><div class="row" style="gap:8px"><span class="pos-chip">${p.pos}</span>${p.dev !== 'N' ? `<span class="devb dev-${p.dev}">${devLabel(p.dev)}</span>` : ''}</div><h2 style="margin:4px 0 0">#${p.num} ${esc(pname(p))}</h2><div class="muted small">${header}</div></div><button class="btn sm ghost x" data-act="close">✕</button></div>
    ${!prospect ? `<div class="row small"><span class="pill">Contract ${fmtMoney(p.con.sal)}/yr · ${p.con.yrs} yr${p.con.yrs === 1 ? '' : 's'}</span>${p.inj ? `<span class="pill red">Injured — ${p.inj} wk</span>` : ''}${p.draft ? `<span class="pill">Drafted ${p.draft.season} R${p.draft.round} #${p.draft.pick}</span>` : ''}</div>` : ''}
    <div class="bars">${bars}</div>
    ${p.st && p.st.gp ? `<div><div class="eyebrow">This season (${p.st.gp} games)</div><div>${statLine(p) || '—'}</div></div>` : ''}
    ${career ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Season</th><th>Team</th><th class="r">GP</th><th>Stats</th></tr></thead><tbody>${career}</tbody></table></div>` : ''}
    <div class="row">${actions}</div>`);
}

// ---------- depth ----------
function viewDepth() {
  const L = LEAGUE, t = UT(); fixDepth(L, t);
  const blocks = POSITIONS.map(pos => {
    const ids = t.depth[pos];
    return `<div class="card"><h2>${pos} <span class="muted small">${STARTERS[pos]} starter${STARTERS[pos] > 1 ? 's' : ''}</span></h2><div class="tbl-wrap"><table class="t"><tbody>${ids.map((id, i) => {
      const p = L.players[id];
      return `<tr class="${i < STARTERS[pos] ? 'me' : ''}"><td class="num">${i + 1}</td><td class="click" data-act="player" data-pid="${id}">${esc(pshort(p))}${p.inj ? ' <span class="inj">INJ</span>' : ''}</td><td class="r">${ovrTag(p.ovr)}</td>
      <td class="r"><button class="btn sm ghost" data-act="depth-up" data-pos="${pos}" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button class="btn sm ghost" data-act="depth-down" data-pos="${pos}" data-i="${i}" ${i === ids.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button></td></tr>`;
    }).join('') || '<tr><td class="muted">No players — sign one in Free Agents.</td></tr>'}</tbody></table></div></div>`;
  }).join('');
  return `<div class="card row"><div class="grow">Highlighted rows start. Injured players are skipped automatically on game day.</div><button class="btn" data-act="auto-depth">Auto-sort by OVR</button></div><div class="cols">${blocks}</div>`;
}

// ---------- schedule ----------
function viewSchedule() {
  const L = LEAGUE, u = L.userTid;
  const rows = L.schedule.map((wk, i) => {
    const g = wk.find(g => g.h === u || g.a === u); if (!g) return `<tr><td>${i + 1}</td><td colspan="3" class="muted">Bye</td></tr>`;
    const home = g.h === u, opp = L.teams[home ? g.a : g.h];
    let res = '';
    if (g.hs != null) { const us = home ? g.hs : g.as, them = home ? g.as : g.hs; res = `<b class="${us > them ? '' : 'muted'}">${us > them ? 'W' : us < them ? 'L' : 'T'}</b> ${us}-${them}`; }
    return `<tr class="${i + 1 === L.week && L.phase === 'regular' ? 'me' : ''}"><td class="num">${i + 1}</td><td>${home ? 'vs' : '@'}</td><td><div class="row" style="gap:8px">${badge(opp, 'sm')} ${esc(teamName(opp))} <span class="muted small">${recStr(opp)}</span></div></td><td class="r num">${res}</td></tr>`;
  }).join('');
  const po = L.playoffs ? `<div class="card"><h2>Playoffs — ${ROUND_NAMES[Math.min(3, L.playoffs.round)]}</h2>${L.playoffs.done.concat(L.playoffs.games).map(g => `<div class="row small"><span class="pill">${ROUND_NAMES[g.round]}</span><span class="grow">${L.teams[g.a].abbr} @ ${L.teams[g.h].abbr}</span><span class="num">${g.hs == null ? '—' : g.as + '-' + g.hs}</span></div>`).join('')}</div>` : '';
  return `${po}<div class="card"><h2>${L.season} Schedule</h2><div class="tbl-wrap"><table class="t"><thead><tr><th>Wk</th><th></th><th>Opponent</th><th class="r">Result</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

// ---------- standings ----------
function viewStandings() {
  const L = LEAGUE;
  const seeds = {}; for (const c of confsOf(L)) seeds[c] = confSeeds(L, c);
  let h = '';
  for (const conf of confsOf(L)) {
    const divs = divisions(L, conf);
    h += `<div class="card"><h2>${conf}${L.real ? '' : ' Conference'}</h2><div class="cols">`;
    for (const d in divs) {
      h += `<div><div class="eyebrow" style="margin-bottom:6px">${d.split(' ')[1]}</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Team</th><th class="r">W-L-T</th><th class="r">PF</th><th class="r">PA</th><th class="r">Seed</th></tr></thead><tbody>${divs[d].map(id => {
        const t = L.teams[id]; const s = seeds[conf].indexOf(id);
        return `<tr class="${id === L.userTid ? 'me' : ''}"><td><div class="row" style="gap:8px">${badge(t, 'sm')}${esc(t.abbr)} ${esc(t.name)}</div></td><td class="r">${recStr(t)}</td><td class="r">${t.pf}</td><td class="r">${t.pa}</td><td class="r">${s >= 0 ? '#' + (s + 1) : ''}</td></tr>`;
      }).join('')}</tbody></table></div></div>`;
    }
    h += '</div></div>';
  }
  return `<div class="muted small">Top 7 in each conference make the playoffs: 4 division winners plus 3 wild cards. The #1 seed gets a bye.</div>${h}`;
}

// ---------- leaders ----------
function viewStats() {
  const L = LEAGUE;
  const all = Object.values(L.players).filter(p => p.tid != null && p.tid >= 0 && p.st && p.st.gp);
  const cats = [['Passing yards', 'py'], ['Passing TD', 'ptd'], ['Rushing yards', 'ry'], ['Rushing TD', 'rtd'], ['Receiving yards', 'rcy'], ['Receptions', 'rec'], ['Receiving TD', 'rctd'], ['Tackles', 'tk'], ['Sacks', 'sk'], ['Interceptions', 'dint'], ['Field goals', 'fgm']];
  const blocks = cats.map(([n, k]) => {
    const top = all.filter(p => p.st[k]).sort((a, b) => b.st[k] - a.st[k]).slice(0, 8);
    return `<div class="card"><h2>${n}</h2><div class="tbl-wrap"><table class="t"><tbody>${top.map((p, i) => `<tr class="click ${p.tid === L.userTid ? 'me' : ''}" data-act="player" data-pid="${p.id}"><td class="num muted">${i + 1}</td><td>${esc(pshort(p))} <span class="muted small">${p.pos} ${L.teams[p.tid].abbr}</span></td><td class="r num"><b>${p.st[k]}</b></td></tr>`).join('') || '<tr><td class="muted">No games played yet.</td></tr>'}</tbody></table></div></div>`;
  }).join('');
  return `<div class="cols">${blocks}</div>`;
}

// ---------- trade ----------
let TRADE = { tid: null, give: { players: [], picks: [] }, get: { players: [], picks: [] } };
function viewTrade() {
  const L = LEAGUE, u = UT();
  if (!tradeAllowed(L)) return `<div class="card"><h2>Trades closed</h2><p>The trade deadline is after week 10. Trading reopens after the season (recap, re-signing and free agency).</p></div>`;
  if (TRADE.tid == null || TRADE.tid === L.userTid) TRADE.tid = (L.userTid + 1) % 32;
  const other = L.teams[TRADE.tid];
  const plist = (team, side) => team.roster.map(id => L.players[id]).sort((a, b) => b.ovr - a.ovr).map(p => `<label class="pickrow"><input type="checkbox" data-act="trade-toggle" data-side="${side}" data-kind="player" data-id="${p.id}" ${TRADE[side].players.includes(p.id) ? 'checked' : ''}><span style="width:28px">${p.pos}</span><span class="grow">${esc(pshort(p))} <span class="muted small">${p.age}y · ${fmtMoney(p.con.sal)} · ${p.con.yrs}yr</span></span>${ovrTag(p.ovr)}</label>`).join('');
  const pk = (tid, side) => L.picks.filter(x => x.owner === tid).sort((a, b) => a.season - b.season || a.round - b.round).map(x => { const i = L.picks.indexOf(x); return `<label class="pickrow"><input type="checkbox" data-act="trade-toggle" data-side="${side}" data-kind="pick" data-id="${i}" ${TRADE[side].picks.includes(i) ? 'checked' : ''}><span class="grow">${pickLabel(L, x)}</span></label>`; }).join('');
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">Trade with</h2><select data-act="trade-team">${L.teams.filter(t => t.id !== L.userTid).map(t => `<option value="${t.id}" ${t.id === TRADE.tid ? 'selected' : ''}>${esc(teamName(t))} (${recStr(t)})</option>`).join('')}</select></div>
    <div id="tradeSummary"></div></div>
    <div class="trade-grid"><div class="card"><h2>You give</h2><div class="muted small">Cap room ${fmtMoney(capRoom(L, u))}</div><div class="scroll-list">${plist(u, 'give')}${pk(u.id, 'give')}</div></div>
    <div class="card"><h2>You get — ${esc(other.abbr)}</h2><div class="muted small">Cap room ${fmtMoney(capRoom(L, other))}</div><div class="scroll-list">${plist(other, 'get')}${pk(other.id, 'get')}</div></div></div>`;
}
function tradeSides() {
  const L = LEAGUE;
  return { give: { players: TRADE.give.players, picks: TRADE.give.picks.map(i => L.picks[i]) }, get: { players: TRADE.get.players, picks: TRADE.get.picks.map(i => L.picks[i]) } };
}
function tradeRefresh() {
  const el = $('#tradeSummary'); if (!el) return;
  const L = LEAGUE; const s = tradeSides();
  const empty = !s.give.players.length && !s.give.picks.length && !s.get.players.length && !s.get.picks.length;
  if (empty) { el.innerHTML = '<div class="muted small"><b>Tip:</b> check only your own players and press <b>Find offers</b> to shop them to every team. Or check players or picks on both sides. The AI accepts deals that give it more value than it sends — young, high-rated players and early picks are worth the most.</div>'; return; }
  const ev = tradeEval(L, TRADE.tid, s.give, s.get);
  const pctv = clamp(ev.ratio / 1.08 * 70, 0, 100);
  el.innerHTML = `<div class="stack" style="gap:8px"><div class="row small"><span class="grow">AI interest</span><b>${ev.ok ? 'Will accept' : ev.reason ? 'Blocked' : ev.ratio > 0.85 ? 'Close — add a little more' : 'Not interested'}</b></div>
    <div class="meter"><b style="width:${pctv}%"></b></div>${ev.reason ? `<div class="small" style="color:var(--red)">${esc(ev.reason)}</div>` : ''}
    <div class="row"><button class="btn primary" data-act="trade-propose" ${ev.ok ? '' : 'disabled'}>Propose trade</button>${s.give.players.length || s.give.picks.length ? '<button class="btn" data-act="trade-finder">Find offers from all teams</button>' : ''}<button class="btn ghost" data-act="trade-clear">Clear</button></div></div>`;
}

// ---------- free agents ----------
let FA_FILTER = 'ALL';
function viewFA() {
  const L = LEAGUE, u = UT();
  let ps = L.fa.map(id => L.players[id]).filter(Boolean);
  if (FA_FILTER !== 'ALL') ps = ps.filter(p => p.pos === FA_FILTER);
  ps.sort((a, b) => b.ovr - a.ovr);
  const rows = ps.slice(0, 120).map(p => `<tr class="click" data-act="player" data-pid="${p.id}"><td>${p.pos}</td><td>${esc(pname(p))}</td><td class="r">${p.age}</td><td class="r">${ovrTag(p.ovr)}</td><td class="dev-${p.dev}">${devLabel(p.dev)}</td><td class="r">${fmtMoney(faAsk(p))}</td></tr>`).join('');
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">Free agents</h2><select data-act="fa-filter">${['ALL', ...POSITIONS].map(p => `<option ${p === FA_FILTER ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
    <div class="muted small">Cap room <b>${fmtMoney(capRoom(L, u))}</b> · Roster ${activeCount(L, u)}/53. Tap a player to sign him.</div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Name</th><th class="r">Age</th><th class="r">OVR</th><th>Dev</th><th class="r">Asking / yr</th></tr></thead><tbody>${rows || '<tr><td class="muted">Nobody available.</td></tr>'}</tbody></table></div></div>`;
}

// ---------- draft ----------
function viewDraft() {
  const L = LEAGUE;
  const prospects = (L.draftClass || []).slice(0, 160);
  const pRow = (p, btn) => `<tr><td>${p.pos}</td><td class="click" data-act="player" data-pid="${p.id}">${esc(pname(p))} <span class="muted small">${esc(p.col)}</span></td><td class="r">${p.age}</td><td class="r num">${p.scout ? p.scout.lo + '–' + p.scout.hi : ''}</td><td class="r">${p.scout ? p.scout.potG : ''}</td><td class="r">${p.proj > 7 ? 'UDFA' : 'R' + p.proj}</td><td>${btn || ''}</td></tr>`;
  const head = `<thead><tr><th>Pos</th><th>Prospect</th><th class="r">Age</th><th class="r">Scouted OVR</th><th class="r">Pot</th><th class="r">Proj</th><th></th></tr></thead>`;
  if (L.phase !== 'draft') {
    const mine = L.picks.filter(p => p.owner === L.userTid && p.season === L.season + 1).map(p => pickLabel(L, p)).join(', ');
    return `<div class="card"><h2>${L.season + 1} Draft class — scouting board</h2><p class="muted small">Your ${L.season + 1} picks: ${mine || 'none'}. Ratings are scouting estimates; true ratings show after the draft.</p>
      <div class="tbl-wrap"><table class="t">${head}<tbody>${prospects.map(p => pRow(p)).join('')}</tbody></table></div></div>`;
  }
  const d = L.draft; const done = draftDone(L);
  const slot = d.slots[d.cur];
  const onClock = !done && slot.owner === L.userTid;
  const recent = d.slots.slice(Math.max(0, d.cur - 12), d.cur).reverse().map((s, i) => { const p = L.players[s.pid]; return `<div class="row small"><span class="pill num">#${d.cur - i}</span><span class="grow">${L.teams[s.owner].abbr}: ${p ? `${p.pos} ${esc(pname(p))}` : ''}</span></div>`; }).join('');
  const myPicks = d.slots.map((s, i) => ({ s, i })).filter(x => x.s.owner === L.userTid).map(x => `#${x.i + 1}${x.s.pid ? ' ✓' : ''}`).join(' · ');
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">${L.season + 1} Draft ${done ? '— complete' : `— Round ${slot.round}, Pick #${d.cur + 1}`}</h2>
    ${done ? `<button class="btn primary" data-act="new-season">Start the ${L.season + 1} season</button>` : onClock ? '<span class="pill amber">You are on the clock</span>' : `<span class="pill">${L.teams[slot.owner].abbr} on the clock</span>`}</div>
    <div class="muted small">Your picks: ${myPicks || 'none'}</div>
    ${!done ? `<div class="row">${!onClock ? `<button class="btn primary" data-act="draft-sim">Sim to my next pick</button>` : `<button class="btn" data-act="draft-auto1">Auto-pick for me</button>`}<button class="btn ghost" data-act="draft-simall">Auto-draft the rest</button></div>` : ''}</div>
    <div class="cols"><div class="card" style="grid-column: span 2"><h2>Best available</h2><div class="tbl-wrap"><table class="t">${head}<tbody>${prospects.slice(0, 80).map(p => pRow(p, onClock ? `<button class="btn sm primary" data-act="draft-pick" data-pid="${p.id}">Draft</button>` : '')).join('')}</tbody></table></div></div>
    <div class="card"><h2>Recent picks</h2><div class="stack" style="gap:6px">${recent || '<span class="muted">No picks yet.</span>'}</div></div></div>`;
}

// ---------- history ----------
function viewHistory() {
  const L = LEAGUE;
  const champs = L.history.map(h => `<tr><td>${h.season}</td><td><div class="row" style="gap:8px">${badge(L.teams[h.champ], 'sm')}${esc(teamName(L.teams[h.champ]))}</div></td><td class="muted">def. ${L.teams[h.runner].abbr} ${h.score}</td></tr>`).join('');
  const aw = L.awards.map(a => `<tr><td>${a.season}</td><td>${a.mvp ? esc(a.mvp.name) + ' (' + a.mvp.pos + ')' : ''}</td><td>${a.opoy ? esc(a.opoy.name) : ''}</td><td>${a.dpoy ? esc(a.dpoy.name) : ''}</td><td>${a.roy ? esc(a.roy.name) : ''}</td></tr>`).join('');
  return `<div class="card"><h2>Your legacy</h2><div class="stat-strip"><div><span class="eyebrow">Titles</span><b>${UT().titles}</b></div><div><span class="eyebrow">Seasons</span><b>${L.history.length + (L.phase === 'regular' || L.phase === 'playoffs' ? 1 : 0)}</b></div></div></div>
    <div class="card"><h2>Grand Bowl champions</h2>${champs ? `<div class="tbl-wrap"><table class="t"><tbody>${champs}</tbody></table></div>` : '<p class="muted">Finish a season to start the record book.</p>'}</div>
    <div class="card"><h2>Awards</h2>${aw ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Season</th><th>MVP</th><th>OPOY</th><th>DPOY</th><th>ROY</th></tr></thead><tbody>${aw}</tbody></table></div>` : '<p class="muted">No awards yet.</p>'}</div>`;
}

// ---------- settings ----------
function viewSettings() {
  const s = LEAGUE.settings;
  return `<div class="card stack"><h2>Game settings</h2>
    <label>Difficulty <select data-act="set" data-key="diff">${[['rookie', 'Rookie'], ['pro', 'Pro'], ['allpro', 'All-Pro'], ['legend', 'Legend']].map(([k, n]) => `<option value="${k}" ${s.diff === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Quarter length <select data-act="set" data-key="qlen">${[[120, '2 min'], [180, '3 min'], [240, '4 min'], [300, '5 min'], [480, '8 min']].map(([k, n]) => `<option value="${k}" ${+s.qlen === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="row" style="gap:8px"><input type="checkbox" data-act="set" data-key="simDef" ${s.simDef ? 'checked' : ''}> <b>Offense only</b>: the CPU's drives are simulated, you only play offense</label></div>
    <div class="card stack"><h2>Save &amp; backup</h2><div class="muted small">Franchise slot ${SLOT}. The game saves automatically after every action.</div>
    <div class="row"><button class="btn" data-act="save-now">Save now</button><button class="btn" data-act="export">Export save</button><button class="btn" data-act="import">Import save</button></div></div>
    <div class="card stack"><h2>Danger zone</h2><div class="row"><button class="btn danger" data-act="del-current">Delete this franchise</button></div></div>`;
}
function exportSave() {
  const json = JSON.stringify(LEAGUE);
  let dl = '';
  let embedded = true; try { embedded = window.self !== window.top; } catch (e) { }
  if (!embedded) try { const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })); dl = `<a class="btn" href="${url}" download="gridiron-${UT().abbr}-${LEAGUE.season}.json">Download file</a>`; } catch (e) { }
  modal(`<div class="modal-head"><h2>Export save</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p class="small muted">Copy this text and keep it somewhere safe (a note or doc). To restore, choose Import save and paste it, or load a downloaded file.</p>
    <textarea id="exportTxt" rows="6" readonly style="width:100%">${esc(json)}</textarea><div class="row"><button class="btn primary" data-act="copy-export">Copy to clipboard</button>${dl}</div>`);
}
function importSave() {
  modal(`<div class="modal-head"><h2>Import save</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p class="small muted">Paste exported save text, or pick a .json file. It goes into slot <select id="impSlot"><option>1</option><option>2</option><option>3</option></select>, replacing what is there.</p>
    <textarea id="importTxt" rows="6" style="width:100%" placeholder="Paste save text here"></textarea>
    <div class="row"><button class="btn primary" data-act="do-import">Import</button><button class="btn" data-act="import-file">Choose file…</button></div>`);
}
function doImport(txt, slot) {
  try {
    const L = JSON.parse(txt); if (!L.teams || !L.players) throw new Error('bad');
    LEAGUE = L; SLOT = slot; EXHIB = false; save(); closeModal(); TAB = 'home'; renderHub(); toast('Save imported.');
  } catch (e) { toast('That text is not a valid Gridiron Dynasty save.'); }
}

// ============================================================ ACTIONS
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'button')) return;
  const a = el.dataset.act, L = LEAGUE;
  switch (a) {
    case 'menu': if (LEAGUE && !EXHIB) save(); renderMenu(); break;
    case 'howto': howTo(); break;
    case 'new-franchise': renderSetup('franchise', el.dataset.slot ? +el.dataset.slot : null); break;
    case 'quick-play': renderSetup('quick'); break;
    case 'import': importSave(); break;
    case 'import-file': $('#fileIn').click(); break;
    case 'do-import': doImport($('#importTxt').value, +$('#impSlot').value); break;
    case 'load': { const l = loadLeague(+el.dataset.slot); if (l) { LEAGUE = l; SLOT = +el.dataset.slot; EXHIB = false; TAB = 'home'; renderHub(); } else toast('Could not load that save.'); break; }
    case 'del-slot': confirmBox(`Delete the franchise in slot ${el.dataset.slot}? This can't be undone.`, () => { deleteSave(+el.dataset.slot); renderMenu(); }); break;
    case 'del-current': confirmBox('Delete this franchise for good?', () => { deleteSave(SLOT); LEAGUE = null; renderMenu(); }); break;
    case 'confirm-yes': { const f = confirmBox._f; closeModal(); f && f(); break; }
    case 'pick-team': {
      $$('.team-card').forEach(c => c.classList.toggle('sel', c === el));
      SETUP.tid = +el.dataset.tid; $('#setupGo').disabled = false;
      const t = SETUP.tmp.teams[SETUP.tid]; const o = teamOvr(SETUP.tmp, t); const qb = lineup(SETUP.tmp, t, 0).QB[0];
      $('#setupInfo').innerHTML = `<b>${esc(teamName(t))}</b> — OVR ${o.ovr}. Starting QB: ${esc(pname(qb))} (${qb.ovr}). Cap room ${fmtMoney(capRoom(SETUP.tmp, t))}.`;
      break;
    }
    case 'setup-go': setupGo(); break;
    case 'tab': TAB = el.dataset.tab; closeModal(); renderHub(); $('.panel').scrollTop = 0; break;
    case 'close': closeModal(); break;
    case 'player': playerModal(+el.dataset.pid); break;
    case 'play-game': { const g = userGame(L); if (g) startLiveGame(g.h, g.a, L.userTid, { playoff: L.phase === 'playoffs' }); break; }
    case 'sim-game': { const g = userGame(L); if (!g) break; const res = simGame(L, g.h, g.a, { qlen: 900, playoff: L.phase === 'playoffs' }); finishUserGame(res); break; }
    case 'sim-week': simWeek(L, true); afterAdvance(); break;
    case 'sim-to-playoffs': { let guard = 0; while (L.phase === 'regular' && guard++ < 20) simWeek(L, true); afterAdvance(); break; }
    case 'begin-offseason': beginOffseason(L); save(); renderHub(); break;
    case 'resign': {
      const p = L.players[+el.dataset.pid]; const yrs = +$('#ry' + p.id).value; const ask = resignAsk(p);
      if (capRoom(L, UT()) + p.con.sal < ask) { toast('Not enough cap room. Release or trade someone first.'); break; }
      p.con = { sal: ask, yrs }; addNews(L, `Re-signed ${p.pos} ${pname(p)}: ${yrs} yr / ${fmtMoney(ask)} per year.`); save(); renderHub(); break;
    }
    case 'release': { const p = L.players[+el.dataset.pid]; releaseToFA(L, p); addNews(L, `${p.pos} ${pname(p)} will test free agency.`); save(); renderHub(); break; }
    case 'finish-resign': finishResign(L); aiFreeAgencyRound(L, 1); save(); renderHub(); break;
    case 'fa-day': aiFreeAgencyRound(L, 2); L.faDay++; save(); renderHub(); toast(`Free agency day ${L.faDay}. Other teams made signings.`); break;
    case 'start-draft': aiFreeAgencyRound(L, 2); startDraft(L); TAB = 'draft'; save(); renderHub(); break;
    case 'new-season': startNewSeason(L); TAB = 'home'; save(); renderHub(); toast(`Welcome to the ${L.season} season!`); break;
    case 'draft-sim': draftAdvance(L, true); save(); renderHub(); break;
    case 'draft-auto1': { const p = aiDraftChoice(L, L.userTid); if (p) draftPick(L, p.id); draftAdvance(L, true); save(); renderHub(); break; }
    case 'draft-simall': { while (!draftDone(L)) { const slot = L.draft.slots[L.draft.cur]; const p = aiDraftChoice(L, slot.owner); if (!p) break; draftPick(L, p.id); } save(); renderHub(); break; }
    case 'draft-pick': draftPick(L, +el.dataset.pid); draftAdvance(L, true); save(); renderHub(); break;
    case 'promote': { const p = L.players[+el.dataset.pid]; const t = UT(); fixDepth(L, t); t.depth[p.pos] = [p.id, ...t.depth[p.pos].filter(x => x !== p.id)]; save(); closeModal(); toast(`${pshort(p)} is now the starting ${p.pos}.`); renderHub(); break; }
    case 'cut': { const p = L.players[+el.dataset.pid]; confirmBox(`Release ${pname(p)}? His ${fmtMoney(p.con.sal)} salary comes off your cap.`, () => { releaseToFA(L, p); addNews(L, `Released ${p.pos} ${pname(p)}.`); save(); renderHub(); }); break; }
    case 'sign': {
      const p = L.players[+el.dataset.pid]; const yrs = +$('#faYrs').value; const sal = Math.max(0.75, +$('#faSal').value || faAsk(p));
      if (capRoom(L, UT()) < sal) { $('#negMsg').textContent = `You only have ${fmtMoney(capRoom(L, UT()))} in cap room.`; break; }
      const r = negotiate(L, p, sal, yrs);
      if (!r.ok) { $('#negMsg').textContent = r.msg; save(); break; }
      const err = signFA(L, L.userTid, p, yrs, sal); if (err) { $('#negMsg').textContent = err; break; }
      closeModal(); save(); renderHub(); toast(`Signed ${pname(p)}: ${yrs} yr / ${fmtMoney(sal)} per year.`); break;
    }
    case 'shop': { TRADE = { tid: TRADE.tid, give: { players: [+el.dataset.pid], picks: [] }, get: { players: [], picks: [] } }; TAB = 'trade'; closeModal(); renderHub(); break; }
    case 'trade-for': { const p = L.players[+el.dataset.pid]; TRADE = { tid: p.tid, give: { players: [], picks: [] }, get: { players: [p.id], picks: [] } }; TAB = 'trade'; closeModal(); renderHub(); break; }
    case 'trade-finder': {
      const s = tradeSides(); const offers = findOffers(L, s.give); TRADE.offers = offers;
      const giveTxt = s.give.players.map(id => `${L.players[id].pos} ${esc(pshort(L.players[id]))}`).concat(s.give.picks.map(pk => pickLabel(L, pk))).join(', ');
      const rows = offers.map((o, i) => { const t = L.teams[o.tid]; const items = o.get.players.map(id => { const p = L.players[id]; return `${ovrTag(p.ovr)} ${p.pos} ${esc(pname(p))} <span class="muted small">${p.age}y · ${fmtMoney(p.con.sal)}</span>`; }).concat(o.get.picks.map(pk => `<span class="pill">${pickLabel(L, pk)}</span>`)).join('<br>');
        return `<div class="card row" style="align-items:flex-start">${badge(t)}<div class="grow"><b>${esc(teamName(t))}</b> <span class="muted small">${recStr(t)}</span><div class="small" style="margin-top:6px;line-height:1.9">${items}</div></div><button class="btn sm primary" data-act="accept-offer" data-i="${i}">Accept</button></div>`; }).join('');
      modal(`<div class="modal-head"><h2>Offers for ${giveTxt}</h2><button class="btn sm ghost x" data-act="close">✕</button></div>${rows || '<p class="muted">No team wants that package. Try adding a pick or a better player.</p>'}`);
      break;
    }
    case 'accept-offer': {
      const o = TRADE.offers && TRADE.offers[+el.dataset.i]; if (!o) break; const s = tradeSides();
      const ev = tradeEval(L, o.tid, s.give, o.get); if (!ev.ok) { toast(ev.reason || 'Offer expired.'); break; }
      executeTrade(L, o.tid, s.give, o.get); TRADE.give = { players: [], picks: [] }; TRADE.get = { players: [], picks: [] }; closeModal(); save(); renderHub(); toast('Trade done!'); break;
    }
    case 'trade-clear': TRADE.give = { players: [], picks: [] }; TRADE.get = { players: [], picks: [] }; renderHub(); break;
    case 'trade-propose': {
      const s = tradeSides(); const ev = tradeEval(L, TRADE.tid, s.give, s.get);
      if (!ev.ok) { toast(ev.reason || 'They turned it down.'); break; }
      executeTrade(L, TRADE.tid, s.give, s.get); TRADE.give = { players: [], picks: [] }; TRADE.get = { players: [], picks: [] }; save(); renderHub(); toast('Trade accepted!'); break;
    }
    case 'depth-up': case 'depth-down': {
      const t = UT(), pos = el.dataset.pos, i = +el.dataset.i, j = a === 'depth-up' ? i - 1 : i + 1; const arr = t.depth[pos];
      if (j < 0 || j >= arr.length) break; [arr[i], arr[j]] = [arr[j], arr[i]]; save(); renderHub(); break;
    }
    case 'auto-depth': autoDepth(L, UT()); save(); renderHub(); break;
    case 'save-now': save(); toast('Saved.'); break;
    case 'export': exportSave(); break;
    case 'copy-export': { const ta = $('#exportTxt'); navigator.clipboard && navigator.clipboard.writeText(ta.value).then(() => toast('Copied.'), () => { ta.select(); toast('Select-all and copy manually.'); }); if (!navigator.clipboard) { ta.select(); toast('Text selected — copy it now.'); } break; }
    // in-game
    case 'resume': $('#pause').hidden = true; if (GAME) GAME.paused = false; break;
    case 'sim-game-rest': simRestOfGame(); break;
    case 'toggle-touch': touchMode = !touchMode; applyTouch(); break;
    case 'toggle-simdef': { LEAGUE.settings.simDef = !LEAGUE.settings.simDef; save(); $('#simDefBtn').textContent = 'Offense only: ' + (LEAGUE.settings.simDef ? 'On' : 'Off'); toast(LEAGUE.settings.simDef ? 'Offense only ON: the CPU\'s drives will be simulated.' : 'Offense only OFF: you play defense too.'); break; }
    case 'toggle-cam': if (GAME) { const m = GAME.live.camMode === 'top' ? '3d' : 'top'; GAME.live.camMode = m; LEAGUE.settings.cam = m; save(); toast(m === 'top' ? 'Camera: Top-down' : 'Camera: Broadcast'); } break;
    case 'toggle-sound': window.__mute = !window.__mute; try { localStorage.setItem('gd_mute', window.__mute ? '1' : '0'); } catch (e) { } toast(window.__mute ? 'Sound off' : 'Sound on'); break;
    case 'call-play': if (GAME) { $('#playcall').hidden = true; GAME.live.choose(el.dataset.id); } break;
    case 'call-auto': if (GAME) { $('#playcall').hidden = true; const lg = GAME.live; lg.choose(lg.userOnOffense() ? autoOffCall(lg.gs) : cpuDefCall(lg.gs).id); } break;
    case 'offense-only-now': if (GAME) { LEAGUE.settings.simDef = true; save(); $('#simDefBtn').textContent = 'Offense only: On'; $('#playcall').hidden = true; toast('Offense only ON. Turn it off any time in the pause menu.'); GAME.live.next(); } break;
    case 'sim-drive': if (GAME) { $('#playcall').hidden = true; simDrive(GAME.live.gs); GAME.live.h.update(); GAME.live.next(); } break;
    case 'game-continue': endLiveGame(); break;
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'setLeague') { renderSetup(SETUP.mode, SETUP.slot); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, L = LEAGUE;
  if (a === 'roster-filter') { ROSTER_FILTER = el.value; renderHub(); }
  if (a === 'roster-sort') { ROSTER_SORT = el.value; renderHub(); }
  if (a === 'fa-filter') { FA_FILTER = el.value; renderHub(); }
  if (a === 'trade-team') { TRADE = { tid: +el.value, give: TRADE.give, get: { players: [], picks: [] } }; renderHub(); }
  if (a === 'trade-toggle') {
    const side = TRADE[el.dataset.side], arr = el.dataset.kind === 'player' ? side.players : side.picks, id = +el.dataset.id;
    const i = arr.indexOf(id); if (el.checked && i < 0) arr.push(id); else if (!el.checked && i >= 0) arr.splice(i, 1);
    tradeRefresh();
  }
  if (a === 'set') { const k = el.dataset.key; L.settings[k] = el.type === 'checkbox' ? el.checked : (k === 'qlen' ? +el.value : el.value); save(); toast('Setting saved.'); }
});
$('#fileIn').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => doImport(r.result, $('#impSlot') ? +$('#impSlot').value : firstFreeSlot()); r.readAsText(f); e.target.value = '';
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

function confirmBox(msg, f) {
  confirmBox._f = f;
  modal(`<h2>Are you sure?</h2><p>${esc(msg)}</p><div class="row"><button class="btn danger" data-act="confirm-yes">Yes, do it</button><button class="btn" data-act="close">Cancel</button></div>`);
}
function afterAdvance() {
  save(); renderHub();
  if (LEAGUE.phase === 'playoffs' && LEAGUE.playoffs.round === 0 && !LEAGUE._poShown) { LEAGUE._poShown = true; toast('The regular season is over. Playoffs are set!'); }
}
function howTo() {
  modal(`<div class="modal-head"><h2>How to play</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
  <div class="cols small">
    <div><div class="eyebrow">Keyboard (Chromebook)</div><p><kbd>W A S D</kbd> / arrows — move<br><kbd>Shift</kbd> — sprint<br><kbd>Space</kbd> — snap · juke (ball carrier) · dive tackle (defense) · kick<br><kbd>1</kbd>–<kbd>5</kbd> — throw to that receiver<br><kbd>T</kbd> — throw it away<br><kbd>E</kbd> — switch defender<br><kbd>Esc</kbd> — pause</p></div>
    <div><div class="eyebrow">Touch (phone)</div><p>Left half: drag to move.<br>SNAP / ACTION — snap, juke, dive, kick.<br>Tap a receiver (or the colored buttons) to throw.<br>SPRINT — hold to run faster.<br>SWITCH — change defender.</p></div>
    <div><div class="eyebrow">Tips</div><p>Hold the ball too long and you'll get sacked. Man coverage loses to crossing routes; zones leave holes between defenders. If you let go of the stick, your ball carrier keeps running on his own. On defense, your player plays his assignment until you move him.</p></div>
    <div><div class="eyebrow">Franchise</div><p>17-game season (the real 18-week 2026 schedule in the NFL league), 14-team playoffs, then an offseason: progression and retirements, re-signing, three days of free agency and a 7-round draft. Watch the salary cap.</p></div>
  </div>`);
}

// ============================================================ LIVE GAME
function autoOffCall(gs) {
  const dec = cpuDecision(gs); if (dec === 'fg' || dec === 'punt') return dec; return cpuOffCall(gs).id;
}
function startLiveGame(hid, aid, userTid, opts = {}) {
  const L = LEAGUE; closeModal();
  const userSide = userTid === hid ? 0 : 1;
  const gs = newGameState(L, hid, aid, { qlen: +L.settings.qlen || 240, playoff: !!opts.playoff, diff: L.settings.diff, userSide });
  show('game');
  const live = new LiveGame(L, gs, userSide, {
    call: mode => showPlayCall(mode), update: () => updateHUD(), result: b => showBanner(b), toast: m => toast(m, 3000), over: () => showFinal(),
  });
  live.camMode = L.settings.cam || '3d';
  GAME = { live, gs, opts, paused: false, last: performance.now() };
  applyTouch(); resizeCanvas(); updateHUD();
  $('#final').hidden = true; $('#pause').hidden = true; $('#banner').hidden = true;
  toast(`Kickoff! ${L.teams[gs.tids[1 - gs.opening]].abbr} kicks to ${L.teams[gs.tids[gs.opening]].abbr}.`);
  setTimeout(() => live.next(), 300);
  requestAnimationFrame(loop);
}
function loop(now) {
  if (!GAME) return;
  const dt = Math.min(0.05, (now - GAME.last) / 1000); GAME.last = now;
  if (!GAME.paused) {
    const sx = KEYS.mx + JOY.x, sy = KEYS.my + JOY.y, inp = GAME.live.input;
    if (GAME.live.camMode === 'top') { inp.mx = sx; inp.my = sy; }
    else { inp.mx = -sy; inp.my = sx; } // broadcast view: stick up = downfield, stick right = offense's right
    inp.sprint = KEYS.sprint || JOY.sprint;
    GAME.live.update(dt);
  }
  const cv = $('#cv'), ctx = cv.getContext('2d'); const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  GAME.live.render(ctx, cv.width / dpr, cv.height / dpr);
  hudTick();
  requestAnimationFrame(loop);
}
function resizeCanvas() {
  const cv = $('#cv'); const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
}
window.addEventListener('resize', () => { if (GAME) resizeCanvas(); });

function updateHUD() {
  if (!GAME) return; const gs = GAME.gs, L = LEAGUE;
  const tm = s => L.teams[gs.tids[s]];
  const q = gs.quarter <= 4 ? 'Q' + gs.quarter : 'OT';
  const lg = GAME.live;
  const clock = lg.phase === 'live' ? Math.max(0, gs.clock - lg.t) : gs.clock;
  const sbt = s => `<div class="sb-team ${gs.poss === s ? 'has' : ''}" style="--c1:${tm(s).c1}"><span class="poss"></span><span class="emb xs">${emblemSVG(tm(s))}</span><span class="ab">${tm(s).abbr}</span><span class="sc">${gs.score[s]}</span></div>`;
  $('#scorebug').innerHTML = `${sbt(1)}<div class="sb-mid"><div class="clk">${q} ${fmtClock(clock)}</div><div class="dd">${downStr(gs)} · ${yardStr(gs)}</div></div>${sbt(0)}`;
  // hint + action button label
  const ph = lg.phase; let hint = '', act = 'Action';
  if (ph === 'pre') { if (lg.userOnOffense()) { hint = touchMode ? 'Tap SNAP to start the play' : 'Press SPACE to snap'; act = 'Snap'; } else { hint = touchMode ? 'SWITCH picks your defender' : 'E switches your defender · play starts automatically'; act = 'Dive'; } }
  else if (ph === 'live') {
    const c = lg.carrier();
    const sh = lg.scriptHint && lg.scriptHint();
    if (sh) { hint = touchMode ? sh.touch : sh.key; act = sh.act || act; }
    else if (lg.canUserThrow()) { hint = touchMode ? 'Tap a receiver to throw · hold the stick to lead him' : 'Press 1–5 to throw · hold a direction to lead him · T throws it away'; act = 'Juke'; }
    else if (c && c === lg.ctrl && c.role === 'QB' && lg.play.crossed) { hint = touchMode ? 'SLIDE gives yourself up' : 'E to slide'; act = 'Juke'; }
    else if (c && c === lg.ctrl) { hint = ''; act = 'Juke'; }
    else { act = lg.ball && lg.ball.state === 'air' ? 'Swat' : 'Dive'; }
  } else if (ph === 'kick') { hint = ''; act = 'Kick'; }
  else if (ph === 'post') act = 'Next';
  const h = $('#hint'); h.hidden = !hint; h.textContent = hint;
  $('#tbAct').textContent = act;
  $('#tbSwitch').textContent = lg.userOnOffense() && ph === 'live' ? (lg.canUserThrow() ? 'Throw away' : lg.carrier() === lg.ctrl && lg.ctrl && lg.ctrl.role === 'QB' && lg.play.crossed ? 'Slide' : 'Switch') : 'Switch';
  // receiver buttons
  const showR = touchMode && lg.canUserThrow();
  const rb = $('#rbtns'); rb.hidden = !showR;
  const rk = showR ? lg.offPlay.id + '|' + lg.los + '|' + gs.down + '|' + gs.quarter + '|' + gs.clock : '';
  if (showR && rb.dataset.k !== rk) {
    rb.dataset.k = rk;
    rb.innerHTML = lg.eligible.map((e, i) => `<button class="rb" data-rb="${i}" style="background:${RCOL[i]}">${i + 1}<small>${e.role.replace(/[0-9]/, '')}</small></button>`).join('');
  }
}
let _hudT = 0; function hudTick() { const n = performance.now(); if (n - _hudT > 150) { _hudT = n; updateHUD(); } }

function showBanner(b) {
  const el = $('#banner'); el.className = 'banner' + (b.big ? ' big' : ''); el.innerHTML = `<div class="bt">${esc(b.title)}</div>${b.sub ? `<div class="bs">${esc(b.sub)}</div>` : ''}`;
  el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(showBanner._t); showBanner._t = setTimeout(() => el.hidden = true, b.big ? 2300 : 1500);
}

function playSVG(play, kind) {
  // playbook view: offense moves UP. svg 100 x 62; LOS at y=44
  const by = MID_Y, X = y => (y / FIELD_W) * 100, Y = dx => 44 - dx * 1.45;
  let s = `<svg viewBox="0 0 100 62" aria-hidden="true"><line x1="0" y1="44" x2="100" y2="44" stroke="rgba(120,180,255,.8)" stroke-width=".7"/>`;
  if (kind === 'off') {
    const F = FORMS[play.form];
    const pos = {}; for (const k in F) pos[k] = [F[k][0], by + F[k][1]];
    for (const dy of OL_DY) s += `<circle cx="${X(by + dy)}" cy="${Y(-0.8)}" r="1.7" fill="#ddd"/>`;
    const rcolor = { WR1: RCOL[0], WR2: RCOL[1], WR3: RCOL[2], TE: RCOL[3], RB: RCOL[4] };
    const cum = (dx, y, steps) => { let x = dx, yy = y; return steps.map(([a, b]) => { x += a; yy += b; return [x, yy]; }); };
    for (const k of ['WR1', 'WR2', 'WR3', 'TE', 'RB']) {
      const [dx, y] = pos[k];
      let pts = null, col = rcolor[k];
      const rt = play.routes && play.routes[k];
      if (rt && rt !== 'block') pts = LiveGame.prototype.routePts.call(null, rt, dx, y, by);
      else if (k === play.handTo && play.carrierPath) { pts = cum(dx, y, play.carrierPath); col = '#fff'; }
      else if (k === 'RB' && play.path) { pts = cum(dx, y, play.path); col = '#fff'; }
      if (pts) s += `<polyline fill="none" stroke="${col}" stroke-width="1.2" stroke-linejoin="round" points="${[[dx, y], ...pts].map(([a, b]) => `${X(clamp(b, 0, FIELD_W)).toFixed(1)},${clamp(Y(Math.min(a, 26)), 1, 61).toFixed(1)}`).join(' ')}"/>`;
      else if (play.type === 'pass' || k !== 'RB') s += `<line x1="${X(y)}" y1="${Y(dx)}" x2="${X(y)}" y2="${Y(dx) - 3}" stroke="#bbb" stroke-width="1"/><line x1="${X(y) - 1.5}" y1="${Y(dx) - 3}" x2="${X(y) + 1.5}" y2="${Y(dx) - 3}" stroke="#bbb" stroke-width="1"/>`;
      s += `<circle cx="${X(y)}" cy="${Y(dx)}" r="1.9" fill="${col}"/>`;
    }
    if (play.qbPath) { const q = cum(pos.QB[0], by, play.qbPath); s += `<polyline fill="none" stroke="#ffb81c" stroke-width="1.3" stroke-dasharray="2 1.2" points="${[[pos.QB[0], by], ...q].map(([a, b]) => `${X(clamp(b, 0, FIELD_W)).toFixed(1)},${clamp(Y(Math.min(a, 26)), 1, 61).toFixed(1)}`).join(' ')}"/>`; }
    if (play.read) { const rd = { DL4: [1.1, 4.4], DL1: [1.1, -4.4], LB1: [5, -3.5], LB2: [5, 3.5] }[play.read]; if (rd) s += `<rect x="${X(by + rd[1]) - 4}" y="${Y(rd[0]) - 2.6}" width="8" height="4.4" rx="1" fill="#ff5a4e"/><text x="${X(by + rd[1])}" y="${Y(rd[0]) + 0.6}" font-size="3" text-anchor="middle" fill="#fff" font-weight="800">READ</text>`; }
    if (play.lateralTo || play.toss || play.flea) s += `<text x="96" y="7" font-size="5" text-anchor="end" fill="#ffb81c" font-weight="800">${play.flea ? 'FLICK' : 'LAT'}</text>`;
    s += `<circle cx="${X(by)}" cy="${Y(pos.QB[0])}" r="1.9" fill="#fff" stroke="#111" stroke-width=".5"/>`;
  } else {
    const spots = { DL1: [1.1, -4.4], DL2: [1.1, -1.5], DL3: [1.1, 1.5], DL4: [1.1, 4.4], LB1: [5, -3.5], LB2: [5, 3.5], CB1: [5.5, -18], CB2: [5.5, 17.5], CB3: [4.5, -9.5], S1: [13, -9], S2: [13, 9] };
    for (const r in spots) {
      const [dx, dy] = spots[r]; const a = play.a[r] || 'r'; const x = X(by + dy), y = Y(dx);
      if (a.startsWith('z:')) { const z = ZONES[a.slice(2)]; s += `<line x1="${x}" y1="${y}" x2="${X(by + z[1])}" y2="${Y(Math.min(z[0], 20))}" stroke="rgba(255,255,255,.35)" stroke-width=".6"/><ellipse cx="${X(by + z[1])}" cy="${Y(Math.min(z[0], 20))}" rx="${z[2] ? 9 : 6.5}" ry="${z[2] ? 5 : 4}" fill="${z[2] ? 'rgba(77,171,255,.35)' : 'rgba(255,212,59,.35)'}"/>`; }
      else if (a === 'r' || a === 'b') s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${Y(-3)}" stroke="#ff6b6b" stroke-width="1.1"/>`;
      else if (a === 'f') s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${Y(0.5)}" stroke="#ffa94d" stroke-width="1.1"/>`;
      else if (a.startsWith('m:')) s += `<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="#d0a2ff" stroke-width=".7" stroke-dasharray="1 1"/>`;
      s += `<text x="${x}" y="${y + 1.3}" font-size="4" text-anchor="middle" fill="#fff" font-weight="700">${a === 'b' ? '▲' : 'x'}</text>`;
    }
  }
  return s + '</svg>';
}

function showPlayCall(mode) {
  const lg = GAME.live, gs = lg.gs, L = LEAGUE;
  const el = $('#playcall');
  const sit = `${downStr(gs)} · ${yardStr(gs)} · ${gs.quarter <= 4 ? 'Q' + gs.quarter : 'OT'} ${fmtClock(gs.clock)}`;
  let cards = '';
  if (mode === 'off') {
    const k = gs.lu[gs.poss].K[0]; const dist = 100 - gs.yard + 17; const fp = fgProb(k, dist);
    const specials = [];
    if (gs.down === 4 || (gs.clock < 30 && (gs.quarter === 2 || gs.quarter >= 4))) {
      if (fp > 0.02) specials.push(`<button class="play special" data-act="call-play" data-id="fg"><span class="tag">Special teams</span><span class="pn">Field Goal</span><span class="pd">${dist} yds · ~${Math.round(fp * 100)}% for ${esc(pshort(k))}</span></button>`);
      if (gs.down === 4) specials.push(`<button class="play special" data-act="call-play" data-id="punt"><span class="tag">Special teams</span><span class="pn">Punt</span><span class="pd">Flip the field.</span></button>`);
    }
    if (gs.score[gs.poss] > gs.score[1 - gs.poss] && gs.quarter >= 4 && gs.clock < 150) specials.push(`<button class="play special" data-act="call-play" data-id="kneel"><span class="tag">Clock</span><span class="pn">QB Kneel</span><span class="pd">Run out the clock.</span></button>`);
    const cats = ['Run', 'Option', 'QB Run', 'RPO', 'Pass', 'Trick'];
    cards = specials.join('') + cats.map(c => { const ps = OFF_PLAYS.filter(p => (p.cat || 'Pass') === c); if (!ps.length) return ''; return `<h3 class="pc-cat">${c === 'Trick' ? 'Trick plays' : c === 'RPO' ? 'RPOs' : c}</h3>` + ps.map(p => `<button class="play" data-act="call-play" data-id="${p.id}">${playSVG(p, 'off')}<span class="tag">${c}</span><span class="pn">${p.name}</span><span class="pd">${p.desc}</span></button>`).join(''); }).join('');
  } else {
    cards = DEF_PLAYS.map(p => `<button class="play" data-act="call-play" data-id="${p.id}">${playSVG(p, 'def')}<span class="tag">Defense</span><span class="pn">${p.name}</span><span class="pd">${p.desc}</span></button>`).join('');
  }
  el.innerHTML = `<div class="pc-inner wrap"><div class="pc-head"><h2>${mode === 'off' ? 'Call your play' : 'Call your defense'}</h2><span class="pill amber">${sit}</span><span class="grow"></span>
    <button class="btn sm" data-act="call-auto">Ask coach</button><button class="btn sm" data-act="sim-drive">Sim this drive</button>${mode === 'def' ? '<button class="btn sm primary" data-act="offense-only-now">Offense only from now on</button>' : ''}<button class="btn sm ghost" data-act="sim-game-rest">Sim rest of game</button></div>
    <div class="plays">${cards}</div></div>`;
  el.hidden = false;
}

function simRestOfGame() {
  if (!GAME) return; const gs = GAME.gs;
  $('#pause').hidden = true; $('#playcall').hidden = true; GAME.paused = false;
  let guard = 0; while (!gs.over && guard++ < 500) simOnePlay(gs);
  if (!gs.over) gs.over = true;
  if (gs.playoff && gs.score[0] === gs.score[1]) gs.score[chance(0.5) ? 0 : 1] += 3;
  GAME.live.phase = 'over'; showFinal();
}

function showFinal() {
  const gs = GAME.gs, L = LEAGUE; const tm = s => L.teams[gs.tids[s]];
  const us = GAME.live.user, won = gs.score[us] > gs.score[1 - us], tie = gs.score[0] === gs.score[1];
  const top = side => {
    const ids = Object.keys(gs.box).map(Number).filter(id => { const p = L.players[id]; return p && p.tid === gs.tids[side]; });
    const best = (k) => ids.map(id => [L.players[id], gs.box[id]]).filter(x => x[1][k]).sort((a, b) => b[1][k] - a[1][k])[0];
    const out = [];
    const qb = best('py'); if (qb) out.push(`${esc(pshort(qb[0]))}: ${qb[1].pc || 0}/${qb[1].pa || 0}, ${qb[1].py} yds, ${qb[1].ptd || 0} TD, ${qb[1].pint || 0} INT`);
    const rb = best('ry'); if (rb) out.push(`${esc(pshort(rb[0]))}: ${rb[1].ra} car, ${rb[1].ry} yds${rb[1].rtd ? ', ' + rb[1].rtd + ' TD' : ''}`);
    const wr = best('rcy'); if (wr) out.push(`${esc(pshort(wr[0]))}: ${wr[1].rec} rec, ${wr[1].rcy} yds${wr[1].rctd ? ', ' + wr[1].rctd + ' TD' : ''}`);
    const df = best('tk'); if (df) out.push(`${esc(pshort(df[0]))}: ${df[1].tk} tkl${df[1].sk ? ', ' + df[1].sk + ' sk' : ''}`);
    return out.map(x => `<div>${x}</div>`).join('');
  };
  const ts = gs.tstats;
  const big = gs.log.filter(l => l.big).slice(-10).map(l => `<div class="small"><span class="muted">${l.q <= 4 ? 'Q' + l.q : 'OT'} ${fmtClock(l.c)}</span> ${esc(l.txt)} <span class="muted num">(${l.s[1]}-${l.s[0]})</span></div>`).join('');
  $('#final').innerHTML = `<div class="final-inner wrap"><div class="eyebrow" style="text-align:center">Final${gs.quarter > 4 ? ' / OT' : ''}</div>
    <div class="final-score"><div>${badge(tm(1), 'lg')}<div>${esc(tm(1).name)}</div></div><div class="big">${gs.score[1]} – ${gs.score[0]}</div><div>${badge(tm(0), 'lg')}<div>${esc(tm(0).name)}</div></div></div>
    <h2 style="text-align:center;color:var(--amber)">${tie ? 'A hard-fought tie' : won ? 'VICTORY' : 'Tough loss'}</h2>
    <div class="cols"><div class="card"><h2>${esc(tm(1).abbr)}</h2><div class="small">${ts[1].yds} total yds · ${ts[1].pass} pass · ${ts[1].rush} rush · ${ts[1].to} TO</div>${top(1)}</div>
    <div class="card"><h2>${esc(tm(0).abbr)}</h2><div class="small">${ts[0].yds} total yds · ${ts[0].pass} pass · ${ts[0].rush} rush · ${ts[0].to} TO</div>${top(0)}</div></div>
    <div class="card"><h2>Scoring &amp; big plays</h2>${big || '<span class="muted">No scoring.</span>'}</div>
    <div style="text-align:center"><button class="btn primary" data-act="game-continue">Continue</button></div></div>`;
  $('#final').hidden = false; $('#playcall').hidden = true;
}

function endLiveGame() {
  const g = GAME; GAME = null;
  if (g.opts.exhibition) { LEAGUE = null; EXHIB = false; renderMenu(); return; }
  finishUserGame(g.gs);
}
function finishUserGame(gs) {
  const L = LEAGUE; const g = userGame(L);
  if (g) recordGame(L, g, gs);
  const us = g.h === L.userTid ? gs.score[0] : gs.score[1], them = g.h === L.userTid ? gs.score[1] : gs.score[0];
  simWeek(L, true);
  save(); TAB = 'home'; renderHub();
  toast(`${us > them ? 'Win' : us < them ? 'Loss' : 'Tie'}, ${us}-${them}. ${L.phase === 'recap' ? 'Season complete!' : ''}`, 3500);
}

// ---------- input ----------
const KEYS = { mx: 0, my: 0, sprint: false, down: new Set() };
const JOY = { x: 0, y: 0, sprint: false, id: null, bx: 0, by: 0 };
function keyAxis() {
  const d = KEYS.down;
  KEYS.mx = (d.has('ArrowRight') || d.has('KeyD') ? 1 : 0) - (d.has('ArrowLeft') || d.has('KeyA') ? 1 : 0);
  KEYS.my = (d.has('ArrowDown') || d.has('KeyS') ? 1 : 0) - (d.has('ArrowUp') || d.has('KeyW') ? 1 : 0);
  KEYS.sprint = d.has('ShiftLeft') || d.has('ShiftRight');
}
window.addEventListener('keydown', e => {
  if (!GAME || $('#game').hidden) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName)) return;
  const lg = GAME.live, inp = lg.input;
  if (e.code === 'Escape') { const p = $('#pause'); p.hidden = !p.hidden; GAME.paused = !p.hidden; if (!p.hidden) $('#pauseLog').innerHTML = GAME.gs.log.slice(-8).reverse().map(l => esc(l.txt)).join('<br>'); return; }
  if (!$('#playcall').hidden) {
    // quick keys on play call: 1-9 pick card
    if (/^Digit[1-9]$/.test(e.code)) { const cards = $$('#playcall .play'); const c = cards[+e.code.slice(5) - 1]; if (c) c.click(); }
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  KEYS.down.add(e.code); keyAxis();
  if (e.code === 'Space' || e.code === 'Enter') inp.actionEdge = true;
  if (e.code === 'KeyE' || e.code === 'KeyQ') inp.sw = true;
  if (e.code === 'KeyT') inp.throwAway = true;
  const m = /^(Digit|Numpad)([1-5])$/.exec(e.code);
  if (m && lg.eligible) inp.throwTo = lg.eligible[+m[2] - 1] || null;
});
window.addEventListener('keyup', e => { KEYS.down.delete(e.code); keyAxis(); });
window.addEventListener('blur', () => { KEYS.down.clear(); keyAxis(); });

function applyTouch() {
  $('#touch').hidden = !touchMode; $('#kbdHelp').hidden = touchMode;
  $('#kbdHelp').innerHTML = '<b>Move</b> <kbd>WASD</kbd>/<kbd>↑↓←→</kbd> · <b>Sprint</b> <kbd>Shift</kbd><br><b>Snap/Juke/Dive</b> <kbd>Space</kbd> · <b>Throw</b> <kbd>1</kbd>–<kbd>5</kbd> · <kbd>T</kbd> away<br><b>Switch</b> <kbd>E</kbd> · <b>Pause</b> <kbd>Esc</kbd>';
}
(function initTouch() {
  const joy = $('#joy'); let base = null, knob = null;
  joy.addEventListener('pointerdown', e => {
    e.preventDefault(); JOY.id = e.pointerId; joy.setPointerCapture(e.pointerId);
    const r = joy.getBoundingClientRect(); JOY.bx = e.clientX - r.left; JOY.by = e.clientY - r.top;
    base = document.createElement('div'); base.className = 'joy-base'; base.style.left = JOY.bx + 'px'; base.style.top = JOY.by + 'px';
    knob = document.createElement('div'); knob.className = 'joy-knob'; knob.style.left = JOY.bx + 'px'; knob.style.top = JOY.by + 'px';
    joy.append(base, knob);
  });
  joy.addEventListener('pointermove', e => {
    if (e.pointerId !== JOY.id) return;
    const r = joy.getBoundingClientRect(); let dx = e.clientX - r.left - JOY.bx, dy = e.clientY - r.top - JOY.by;
    const m = Math.hypot(dx, dy), R = 55; if (m > R) { dx = dx / m * R; dy = dy / m * R; }
    JOY.x = dx / R; JOY.y = dy / R;
    if (knob) { knob.style.left = (JOY.bx + dx) + 'px'; knob.style.top = (JOY.by + dy) + 'px'; }
  });
  const end = e => { if (e.pointerId !== JOY.id) return; JOY.id = null; JOY.x = JOY.y = 0; base && base.remove(); knob && knob.remove(); base = knob = null; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  const hold = (id, on, off) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); on(); b.classList.add('on'); }); const up = () => { off && off(); b.classList.remove('on'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up); };
  hold('#tbAct', () => { if (GAME) GAME.live.input.actionEdge = true; });
  hold('#tbSprint', () => JOY.sprint = true, () => JOY.sprint = false);
  hold('#tbSwitch', () => { if (!GAME) return; const lg = GAME.live; if (lg.canUserThrow()) lg.input.throwAway = true; else lg.input.sw = true; });
  $('#rbtns').addEventListener('pointerdown', e => { const b = e.target.closest('[data-rb]'); if (!b || !GAME) return; e.preventDefault(); GAME.live.input.throwTo = GAME.live.eligible[+b.dataset.rb]; });
  $('#cv').addEventListener('pointerdown', e => {
    if (!GAME) return; const lg = GAME.live;
    if (lg.phase === 'post') { lg.input.actionEdge = true; return; }
    if (lg.phase === 'kick') { lg.input.actionEdge = true; return; }
    const r = $('#cv').getBoundingClientRect(); const rec = lg.receiverAt(e.clientX - r.left, e.clientY - r.top);
    if (rec && lg.phase === 'live') lg.input.throwTo = rec;
    else if (lg.phase === 'pre' && lg.userOnOffense() && !touchMode) lg.input.actionEdge = true;
  });
  $('#pauseBtn').addEventListener('click', () => { if (!GAME) return; $('#simDefBtn').textContent = 'Offense only: ' + (LEAGUE.settings.simDef ? 'On' : 'Off'); const p = $('#pause'); p.hidden = false; GAME.paused = true; $('#pauseLog').innerHTML = GAME.gs.log.slice(-8).reverse().map(l => esc(l.txt)).join('<br>'); });
})();

// ---------- boot ----------
function boot() { renderMenu(); }
boot();
