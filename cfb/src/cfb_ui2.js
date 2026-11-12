// ============================================================
// College Gridiron Dynasty - UI part 2: Recruiting, NIL, Portal,
// offseason cards, Program + Ring of Honor, settings, actions.
// ============================================================
'use strict';

// ---------- recruiting ----------
let RC = { tab: 'board', pos: 'ALL', stars: 0, state: '', q: '', page: 0 };
function viewRecruit() {
  const L = LEAGUE, u = L.userTid, U = UT();
  if (!L.recruits || !L.recruits.length) {
    const cls = Object.values(L.players).filter(p => p.tid === u && p.cls === 1 && p.recruitRank && L.lastClass && L.lastClass.season === L.season - 1);
    return `<div class="card"><h2>Recruiting</h2><p class="muted">${L.phase === 'signing' ? 'Signing Day is done. Your new class is on the Home tab.' : 'The next recruiting class opens when the new season starts.'}</p></div>`;
  }
  const ctx = rcCtx(L);
  const used = userHoursUsed(L), commits = L.recruits.filter(r => r.commit === u);
  const board = L.rboard.map(id => L.recruits.find(r => r.id === id)).filter(Boolean);
  const live = L.phase === 'regular' || L.phase === 'playoffs' || L.phase === 'departures' || L.phase === 'portal';
  const stars = r => `<span class="stars s${r.stars}">${'★'.repeat(r.stars)}</span>`;
  const fitCells = r => { const f = recruitFit(L, r, U, ctx); return r.prio.map(k => `<span class="pri" title="${RC_PRIOS[k]}">${RC_PRIOS[k]} <b class="g ${gradeClass(gradeLetter(f[k]))}">${gradeLetter(f[k])}</b></span>`).join(''); };
  const suitors = r => topSuitors(L, r, 3).map(([tid, v]) => `<span class="suit ${tid === u ? 'me' : ''}">${esc(L.teams[tid].abbr)} ${interestPct(L, r, tid)}%</span>`).join(' ');
  const status = r => r.commit === u ? '<span class="pill green">Committed to you</span>' : r.commit >= 0 ? `<span class="pill">Committed: ${esc(L.teams[r.commit].abbr)}</span>` : '';
  let body = '';
  if (RC.tab === 'board') {
    const rows = board.map(r => `<div class="rc-card ${r.commit === u ? 'won' : r.commit >= 0 ? 'lost' : ''}">
      <div class="row"><span class="pos-chip">${r.pos}</span><b class="grow">${esc(r.first)} ${esc(r.last)}</b>${stars(r)}<span class="muted small">#${r.rank} · ${r.pos} #${r.posRank} · ${r.state}</span></div>
      <div class="row small">${fitCells(r)}</div>
      <div class="row small"><span class="grow">Top schools: ${suitors(r) || '—'}</span>${status(r)}</div>
      ${r.commit < 0 && live ? `<div class="row small">
        <label>Hours/wk <select data-act="rc-hrs" data-id="${r.id}">${[0, 2, 4, 6, 8, 10, 12].map(h => `<option ${h === (r.hrs || 0) ? 'selected' : ''}>${h}</option>`).join('')}</select></label>
        <button class="btn sm ${r.offers[u] ? 'primary' : ''}" data-act="rc-offer" data-id="${r.id}">${r.offers[u] ? 'Scholarship offered ✓' : 'Offer scholarship'}</button>
        <button class="btn sm" data-act="rc-nil" data-id="${r.id}">${r.nil ? 'NIL ' + fmtNil(r.nil) : 'NIL offer'}</button>
        ${L.phase === 'regular' ? `<button class="btn sm" data-act="rc-visit" data-id="${r.id}">${r.visit ? 'Visit: wk ' + r.visit : r.visitDone ? 'Visited ✓' : 'Official visit'}</button>` : ''}
        <button class="btn sm ghost" data-act="rc-drop" data-id="${r.id}">Remove</button></div>` : `<div class="row small"><button class="btn sm ghost" data-act="rc-drop" data-id="${r.id}">Remove</button></div>`}</div>`).join('');
    body = `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">Your board <span class="muted small">${board.length}/${RC_BOARD}</span></h2><span class="pill ${used > RC_HOURS ? 'red' : 'amber'}">${used}/${RC_HOURS} hours this week</span></div>
      <p class="muted small">Set weekly hours for each recruit, offer scholarships (needed to commit), promise NIL, and bring them to a home game for an official visit (a win helps). A recruit commits when one school builds a clear lead. ${live ? '' : 'Recruiting is paused until the next class opens.'}</p>
      ${rows ? `<div class="rc-grid">${rows}</div>` : '<p class="muted">Your board is empty. Find recruits on the Search tab.</p>'}</div>`;
  } else if (RC.tab === 'search') {
    let list = L.recruits.filter(r => (RC.pos === 'ALL' || r.pos === RC.pos) && (!RC.stars || r.stars === RC.stars) && (!RC.state || r.state === RC.state) && (!RC.q || (r.first + ' ' + r.last).toLowerCase().includes(RC.q.toLowerCase())));
    const total = list.length; list = list.slice(RC.page * 60, RC.page * 60 + 60);
    const rows = list.map(r => `<tr><td class="num muted">${r.rank}</td><td>${r.pos}</td><td><b>${esc(r.first)} ${esc(r.last)}</b> <span class="muted small">${r.state}</span></td><td>${stars(r)}</td><td class="small">${fitCells(r)}</td><td class="small">${suitors(r)} ${status(r)}</td>
      <td>${L.rboard.includes(r.id) ? '<span class="pill amber">On board</span>' : r.commit >= 0 ? '' : `<button class="btn sm" data-act="rc-add" data-id="${r.id}">+ Board</button>`}</td></tr>`).join('');
    const states = [...new Set(L.recruits.map(r => r.state))].sort();
    body = `<div class="card stack"><h2 style="margin:0">Find recruits <span class="muted small">${total}</span></h2><div class="row">
      <select data-act="rc-f" data-k="pos">${['ALL', ...POSITIONS].map(p => `<option ${p === RC.pos ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <select data-act="rc-f" data-k="stars">${[[0, 'All stars'], [5, '5★'], [4, '4★'], [3, '3★'], [2, '2★']].map(([v, n]) => `<option value="${v}" ${+v === RC.stars ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select data-act="rc-f" data-k="state"><option value="">All states</option>${states.map(s => `<option ${s === RC.state ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <input type="text" id="rcSearch" placeholder="Name" value="${esc(RC.q)}" style="width:120px"></div>
      <p class="muted small">Every recruit is a fictional, generated player. Grades show how your school fits what he cares about most. Home state: ${U.state || '—'} (pipeline bonus nearby).</p>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>#</th><th>Pos</th><th>Recruit</th><th>Stars</th><th>What he wants</th><th>Leaders</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row"><button class="btn sm" data-act="rc-page" data-d="-1" ${RC.page ? '' : 'disabled'}>← Prev</button><span class="muted small">Page ${RC.page + 1} of ${Math.max(1, Math.ceil(total / 60))}</span><button class="btn sm" data-act="rc-page" data-d="1" ${(RC.page + 1) * 60 < total ? '' : 'disabled'}>Next →</button></div></div>`;
  } else {
    const rows = commits.sort((a, b) => b.stars - a.stars || a.rank - b.rank).map(r => `<tr><td>${r.pos}</td><td>${esc(r.first)} ${esc(r.last)} <span class="muted small">${r.state}</span></td><td>${stars(r)}</td><td class="num muted">#${r.rank}</td><td class="r">${fmtNil(r.nil || 0)}</td></tr>`).join('');
    const pts = commits.reduce((s, r) => s + [0, 6, 18, 45, 120, 300][r.stars], 0);
    body = `<div class="card"><h2>Your commits <span class="muted small">${commits.length} · class need ${U.classNeed || '?'}</span></h2>${rows ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Recruit</th><th>Stars</th><th>Rank</th><th class="r">NIL promised</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No commitments yet.</p>'}
      <p class="muted small">Class points: ${pts}. Commits sign on National Signing Day, after the transfer portal.</p></div>`;
  }
  return `<div class="card row"><div class="seg">${[['board', 'My board'], ['search', 'Find recruits'], ['commits', 'Commits (' + commits.length + ')']].map(([k, n]) => `<button class="btn sm ${RC.tab === k ? 'primary' : ''}" data-act="rc-tab" data-tab="${k}">${n}</button>`).join('')}</div><span class="grow"></span><span class="muted small">${L.recruits.length} prospects in the ${L.season + 1} class</span></div>${body}`;
}

// ---------- NIL ----------
function viewNil() {
  const L = LEAGUE, t = UT(), pay = payroll(L, t), room = capRoom(L, t);
  const ps = t.roster.map(id => L.players[id]).sort((a, b) => b.con.sal - a.con.sal);
  const rows = ps.map(p => { const est = nilValue(L, p), r = est > 0.03 ? p.con.sal / est : 1;
    return `<tr><td>${p.pos}</td><td class="click" data-act="player" data-pid="${p.id}">${esc(pname(p))} <span class="muted small">${clsLabel(p)}</span></td><td class="r">${ovrTag(p.ovr)}</td><td class="r num">${fmtNil(p.con.sal)}</td><td class="r num muted">${fmtNil(est)}</td>
      <td>${r < 0.6 ? '<span class="pill red">Underpaid</span>' : r > 1.6 && p.con.sal > 0.05 ? '<span class="pill">Overpaid</span>' : ''}</td><td><button class="btn sm" data-act="nil-edit" data-pid="${p.id}">Change</button></td></tr>`; }).join('');
  const recPromised = (L.recruits || []).filter(r => r.nil && (r.commit === L.userTid || (r.commit < 0 && L.rboard.includes(r.id)))).reduce((s, r) => s + r.nil, 0);
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">NIL &amp; revenue share</h2><span class="pill">Budget ${fmtNil(t.nilBudget)}</span></div>
    <div class="capgrid"><div class="capcell"><span class="eyebrow">Committed to players</span><b class="num">${fmtNil(pay)}</b><div class="meter"><b style="width:${clamp(pay / Math.max(0.1, t.nilBudget) * 100, 0, 100)}%"></b></div></div>
      <div class="capcell"><span class="eyebrow">Room</span><b class="num ${room < 0 ? 'neg' : ''}">${fmtNil(room)}</b><span class="small muted">for portal offers and raises</span></div>
      <div class="capcell"><span class="eyebrow">Promised to recruits</span><b class="num">${fmtNil(recPromised)}</b><span class="small muted">paid once they sign</span></div></div>
    <p class="small muted">Each school's budget combines its collective and a revenue-sharing pool. Blue bloods and the SEC/Big Ten have the most. Winning grows it. Players paid well below their estimated value are more likely to enter the portal. Values are this game's estimates.</p></div>
    <div class="card"><h2>Player deals</h2><div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Player</th><th class="r">OVR</th><th class="r">Deal</th><th class="r">Est. value</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function nilEditModal(p) {
  const L = LEAGUE, room = capRoom(L, UT()) + p.con.sal, est = nilValue(L, p);
  modal(`<div class="modal-head"><h2>NIL deal: ${esc(pname(p))}</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p>${p.pos} · ${clsLabel(p)} · ${p.ovr} OVR. Current deal <b>${fmtNil(p.con.sal)}</b>/yr. Estimated value <b>${fmtNil(est)}</b>.</p>
    <div class="row"><label>New amount ($K/yr) <input type="number" id="nilAmt" min="0" step="5" value="${Math.round(p.con.sal * 1000)}" style="width:120px"></label>
    <button class="btn primary" data-act="nil-set" data-pid="${p.id}">Save deal</button><button class="btn" data-act="nil-match" data-pid="${p.id}">Pay his value (${fmtNil(est)})</button></div>
    <p class="small muted">You can spend up to ${fmtNil(Math.max(0, room))} on him. Cutting a deal makes him more likely to transfer.</p><div class="small" id="negMsg"></div>`);
}

// ---------- portal ----------
let PT = { pos: 'ALL', sort: 'ovr' };
function viewPortal() {
  const L = LEAGUE, u = L.userTid;
  if (L.phase !== 'portal') {
    const log = L.portalLog;
    const moves = log ? log.moves.filter(m => m.to === u || m.from === u || m.ovr >= 82).slice(0, 40) : [];
    return `<div class="card"><h2>Transfer portal</h2><p class="muted">${L.phase === 'departures' ? 'The portal opens when you finish reviewing departures on the Home tab.' : 'The portal window opens after the season, once seniors and NFL early entries are gone.'} Players enter because of playing time, NIL pay below their value, coaching changes, or to move up from smaller schools.</p></div>
      ${moves.length ? `<div class="card"><h2>${log.season} portal moves</h2><div class="tbl-wrap"><table class="t"><tbody>${moves.map(m => `<tr class="${m.to === u ? 'me' : ''}"><td>${m.pos}</td><td>${esc(m.name)}</td><td class="r">${ovrTag(m.ovr)}</td><td class="small">${L.teams[m.from] ? esc(L.teams[m.from].city) : '?'} → <b>${esc(L.teams[m.to].city)}</b></td><td class="r num">${fmtNil(m.amt)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  }
  let ps = L.portal.pool.map(id => L.players[id]).filter(p => p && p.tid == null && p.portal);
  if (PT.pos !== 'ALL') ps = ps.filter(p => p.pos === PT.pos);
  ps.sort(PT.sort === 'ask' ? (a, b) => b.portal.ask - a.portal.ask : (a, b) => b.ovr - a.ovr);
  const rows = ps.slice(0, 150).map(p => {
    const lead = portalLeader(L, p), mine = p.portal.offers[u];
    const n = Object.keys(p.portal.offers).length;
    return `<tr class="${mine ? 'me' : ''}"><td>${p.pos}</td><td class="click" data-act="player" data-pid="${p.id}">${esc(pname(p))} <span class="muted small">${clsLabel(p)} · ${p.home || ''}</span></td><td class="r">${ovrTag(p.ovr)}</td>
      <td class="small">${L.teams[p.prevTid] ? esc(L.teams[p.prevTid].abbr) : ''}</td><td class="small muted">${esc(p.portal.reason)}</td><td class="r num">${fmtNil(p.portal.ask)}</td>
      <td class="small">${n} offer${n === 1 ? '' : 's'}${lead ? ` · leader <b>${lead.tid === u ? 'YOU' : esc(L.teams[lead.tid].abbr)}</b>` : ''}</td>
      <td><button class="btn sm ${mine ? 'primary' : ''}" data-act="portal-offer-open" data-pid="${p.id}">${mine ? fmtNil(mine) : 'Offer'}</button></td></tr>`;
  }).join('');
  const out = outstandingOffers(L, u);
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">Transfer portal — day ${Math.min(3, L.portal.day)} of 3</h2><span class="pill amber">Offer room ${fmtNil(portalRoom(L, u))}</span>
      <button class="btn primary" data-act="portal-day">${L.portal.day >= 3 ? 'Close the portal → Signing Day' : 'Advance to day ' + (L.portal.day + 1)}</button></div>
    <p class="muted small">Offer NIL to players you want. Each day other schools bid and players commit to the best fit: money vs. their ask, chance to start, program prestige and distance from home. You have ${fmtNil(out)} in open offers. Roster ${UT().roster.length}/${CFB_ROSTER_MAX}.</p>
    <div class="row"><select data-act="pt-f" data-k="pos">${['ALL', ...POSITIONS].map(p => `<option ${p === PT.pos ? 'selected' : ''}>${p}</option>`).join('')}</select><select data-act="pt-f" data-k="sort"><option value="ovr" ${PT.sort === 'ovr' ? 'selected' : ''}>Sort: OVR</option><option value="ask" ${PT.sort === 'ask' ? 'selected' : ''}>Sort: Ask</option></select><span class="muted small">${ps.length} available</span></div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Player</th><th class="r">OVR</th><th>From</th><th>Why</th><th class="r">Ask</th><th>Interest</th><th></th></tr></thead><tbody>${rows || '<tr><td class="muted">Nobody left at this position.</td></tr>'}</tbody></table></div></div>`;
}
function portalOfferModal(p) {
  const L = LEAGUE, u = L.userTid, cur = p.portal.offers[u] || 0;
  const room = portalRoom(L, u) + cur, pt = portalPT(L, p, UT());
  modal(`<div class="modal-head"><h2>Offer ${esc(pname(p))}</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p>${p.pos} · ${clsLabel(p)} · ${p.ovr} OVR · from ${L.teams[p.prevTid] ? esc(L.teams[p.prevTid].city) : '?'}. He's asking about <b>${fmtNil(p.portal.ask)}</b>/yr. Playing time at your school: <b>${gradeLetter(pt)}</b>.</p>
    <div class="row"><label>NIL offer ($K/yr) <input type="number" id="ptAmt" min="0" step="5" value="${Math.round((cur || p.portal.ask) * 1000)}" style="width:120px"></label><button class="btn primary" data-act="portal-offer" data-pid="${p.id}">Send offer</button>${cur ? `<button class="btn ghost" data-act="portal-pull" data-pid="${p.id}">Pull offer</button>` : ''}</div>
    <p class="small muted">Room for offers: ${fmtNil(Math.max(0, room))}. Other schools: ${Object.keys(p.portal.offers).filter(k => +k !== u).map(k => esc(L.teams[k].abbr)).join(', ') || 'none yet'}.</p><div class="small" id="negMsg"></div>`);
}

// ---------- offseason cards ----------
function departuresCard() {
  const L = LEAGUE, u = L.userTid, D = L.departures, P = id => L.players[id];
  const mine = id => P(id) && P(id).tid === u;
  const grads = D.grads.filter(mine).map(P);
  const nfl = D.nfl.filter(x => mine(x.id));
  const risk = D.risk.filter(x => P(x.id));
  const row = (p, extra) => `<tr><td>${p.pos}</td><td class="click" data-act="player" data-pid="${p.id}">${esc(pname(p))}</td><td class="r">${ovrTag(p.ovr)}</td><td>${extra}</td></tr>`;
  const offers = (L.jobOffers || []).map(id => { const t = L.teams[id]; return `<div class="row">${badge(t, 'sm')}<span class="grow"><b>${esc(t.city)}</b> <span class="muted small">${t.conf} · ${prestigeStars(t.prestige)}</span></span><button class="btn sm primary" data-act="take-job" data-tid="${id}">Take the job</button></div>`; }).join('');
  return `<div class="card stack"><span class="eyebrow">${L.season} offseason</span><h2>Departures</h2>
    ${L.fired ? `<div class="card inner"><b>You were fired.</b> Pick a new job to continue.${offers}</div>` : ''}
    <div class="stack dep-stack"><div><div class="eyebrow">Graduating (${grads.length})</div>${grads.length ? `<div class="tbl-wrap"><table class="t"><tbody>${grads.map(p => row(p, '<span class="muted small">Out of eligibility</span>')).join('')}</tbody></table></div>` : '<p class="muted small">None.</p>'}</div>
    <div><div class="eyebrow">NFL Draft early entries (${nfl.length})</div>${nfl.length ? `<div class="tbl-wrap"><table class="t"><tbody>${nfl.map(x => { const p = P(x.id), kept = D.kept.includes(x.id); return row(p, kept ? '<span class="pill green">Returning!</span>' : `<span class="small">Proj. ${x.round <= 7 ? 'round ' + x.round : 'undrafted'}</span> ${x.round >= 3 ? `<button class="btn sm" data-act="dep-stay" data-pid="${p.id}">Pitch to return (${fmtNil(retentionAsk(L, p) * 1.4)})</button>` : ''}`); }).join('')}</tbody></table></div>` : '<p class="muted small">None.</p>'}</div>
    <div><div class="eyebrow">Thinking about the portal (${risk.length})</div>${risk.length ? `<div class="tbl-wrap"><table class="t"><tbody>${risk.map(x => { const p = P(x.id); return row(p, x.kept ? '<span class="pill green">Staying</span>' : `<span class="small muted">${esc(x.reason)}</span> <button class="btn sm" data-act="dep-keep" data-pid="${p.id}">Keep him: ${fmtNil(x.ask)}</button>`); }).join('')}</tbody></table></div>` : '<p class="muted small">Nobody. The locker room is happy.</p>'}</div></div>
    <div class="card inner small">Job security <b>${L.security}</b>${L.securityDelta != null ? ` (${L.securityDelta >= 0 ? '+' : ''}${L.securityDelta} this year)` : ''}. ${!L.fired && (L.jobOffers || []).length ? 'Other programs want to talk to you:' : ''}${!L.fired ? offers : ''}</div>
    <p class="muted small">NIL room: <b>${fmtNil(capRoom(L, UT()))}</b>. Keeping a player raises his NIL deal to the amount shown. Players you don't keep enter the portal.</p>
    <div><button class="btn primary" data-act="open-portal" ${L.fired ? 'disabled' : ''}>Open the transfer portal</button></div></div>`;
}
function portalHomeCard() {
  const L = LEAGUE, u = L.userTid;
  const mine = L.portal.moves.filter(m => m.to === u), offers = L.portal.pool.filter(id => { const p = L.players[id]; return p && p.tid == null && p.portal && p.portal.offers[u]; }).length;
  return `<div class="card stack"><span class="eyebrow">Transfer portal — day ${Math.min(3, L.portal.day)} of 3</span><h2>${L.portal.pool.length} players in the portal</h2>
    <p>You have ${offers} open offer${offers === 1 ? '' : 's'} and ${mine.length} commitment${mine.length === 1 ? '' : 's'}${mine.length ? ': ' + mine.map(m => `${m.pos} ${esc(m.name)} (${m.ovr})`).join(', ') : ''}.</p>
    <div class="row"><button class="btn" data-act="tab" data-tab="portal">Open the portal</button><button class="btn primary" data-act="portal-day">${L.portal.day >= 3 ? 'Close the portal → Signing Day' : 'Advance to day ' + (L.portal.day + 1)}</button></div></div>`;
}
function signingCard() {
  const L = LEAGUE, u = L.userTid, lc = L.lastClass || {};
  const fr = UT().roster.map(id => L.players[id]).filter(p => p.cls === 1 && !p.rs && p.recruitRank).sort((a, b) => b.stars - a.stars || b.ovr - a.ovr);
  const rows = fr.map(p => `<tr class="click" data-act="player" data-pid="${p.id}"><td>${p.pos}</td><td>${esc(pname(p))} <span class="muted small">${p.home}</span></td><td class="stars">${starsStr(p.stars)}</td><td class="r">${ovrTag(p.ovr)}</td><td>${potGrade(p.pot)} pot${p.dev !== 'N' ? ' · ' + devLabel(p.dev) : ''}</td></tr>`).join('');
  return `<div class="card stack"><span class="eyebrow">National Signing Day</span><h2>Your ${L.season + 1} class: No. ${lc.rank || '—'} in the country</h2>
    <p class="muted small">${lc.n || 0} signees. True ratings are revealed now that they're on campus. Top class: ${L.teams[lc.top] ? esc(L.teams[lc.top].city) : '—'}.</p>
    ${rows ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Signee</th><th>Stars</th><th class="r">OVR</th><th>Outlook</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No recruits signed. Preferred walk-ons filled your roster.</p>'}
    <div><button class="btn primary" data-act="new-season">Start the ${L.season + 1} season</button></div></div>`;
}

// ---------- program ----------
function viewProgram() {
  const L = LEAGUE, t = UT();
  const champs = L.history.map(h => `<tr><td>${h.season}</td><td><div class="row" style="gap:8px">${badge(L.teams[h.champ], 'sm')}${esc(teamName(L.teams[h.champ]))}</div></td><td class="muted">def. ${esc(L.teams[h.runner].city)} ${h.score}</td></tr>`).join('');
  const heis = L.awards.filter(a => a.heisman).map(a => `<tr><td>${a.season}</td><td>${esc(a.heisman.name)} <span class="muted small">${a.heisman.pos}</span></td><td>${esc(L.teams[a.heisman.tid] ? L.teams[a.heisman.tid].city : '')}</td></tr>`).join('');
  const draft = (L.nflDraft || []).slice(0, 2).map(d => `<div><div class="eyebrow">${d.season} NFL Draft</div>${d.picks.filter(x => x.round <= 2 || x.tid === L.userTid).slice(0, 30).map(x => `<div class="small ${x.tid === L.userTid ? 'mine' : ''}">R${x.round} · ${x.pos} ${esc(x.name)} <span class="muted">${esc(L.teams[x.tid].city)}${x.early ? ' · early entry' : ''}</span></div>`).join('') || '<span class="muted small">None</span>'}</div>`).join('');
  const coaches = L.teams.filter(x => x.coachYrs <= 0 && x.id !== L.userTid).slice(0, 20).map(x => `<div class="small">${esc(x.city)}: ${esc(x.coach)}</div>`).join('');
  const hot = L.teams.filter(x => x.id !== L.userTid && (x.heat || 0) >= 2).sort((a, b) => b.heat - a.heat).slice(0, 10).map(x => `<div class="small">🔥 ${esc(x.city)}: ${esc(x.coach)} <span class="muted">(${x.coachYrs} yrs)</span></div>`).join('');
  return `<div class="card"><h2>${esc(t.city)} program</h2><div class="stat-strip">
      <div><span class="eyebrow">Prestige</span><b class="pstars">${prestigeStars(t.prestige)}</b></div><div><span class="eyebrow">National titles</span><b>${t.titles}</b></div><div><span class="eyebrow">Conf titles</span><b>${t.confTitles}</b></div>
      <div><span class="eyebrow">CFP trips</span><b>${t.cfpApps}</b></div><div><span class="eyebrow">Bowl wins</span><b>${t.bowlWins}</b></div><div><span class="eyebrow">NFL picks</span><b>${t.nflPicks || 0}</b></div>
      <div><span class="eyebrow">Stadium</span><b class="small">${esc(t.stadium)}</b></div><div><span class="eyebrow">Job security</span><b>${L.security}</b></div></div>
      <p class="small muted">Expectation here: about ${Math.round(expectedWins(t))} wins a year. Beat it to raise your job security and draw offers from bigger programs. Fall short for too long and you'll be on the hot seat.</p></div>
    <div class="cols"><div class="card"><h2>National champions</h2>${champs ? `<div class="tbl-wrap"><table class="t"><tbody>${champs}</tbody></table></div>` : '<p class="muted small">Finish a season to start the record book.</p>'}</div>
    <div class="card"><h2>Heisman winners</h2>${heis ? `<div class="tbl-wrap"><table class="t"><tbody>${heis}</tbody></table></div>` : '<p class="muted small">None yet.</p>'}</div>
    <div class="card"><h2>NFL Draft</h2>${draft || '<p class="muted small">After the season, juniors and seniors with high grades declare.</p>'}</div>
    <div class="card"><h2>Coaching carousel</h2>${hot ? '<div class="eyebrow">Hot seat</div>' + hot : ''}${coaches ? '<div class="eyebrow" style="margin-top:8px">New hires</div>' + coaches : ''}${!hot && !coaches ? '<p class="muted small">Quiet for now.</p>' : ''}</div></div>`;
}

// ---------- records: national + program, Ring of Honor ----------
viewRecords = function () {
  const L = LEAGUE, u = UT();
  const active = Object.values(L.players).filter(p => p.tid != null && p.tid >= 0);
  const seasonRows = [];
  for (const p of active) {
    for (const c of p.career || []) seasonRows.push({ name: pname(p), pos: p.pos, season: c.season, tm: c.tm, s: c });
    if (p.st && p.st.gp) seasonRows.push({ name: pname(p), pos: p.pos, season: L.season, tm: L.teams[p.tid].abbr, s: p.st, live: true });
  }
  for (const r of L.retired || []) for (const c of r.career || []) seasonRows.push({ name: r.name, pos: r.pos, season: c.season, tm: c.tm, s: c });
  const careers = active.map(p => ({ name: pname(p), pos: p.pos, tms: [L.teams[p.tid].abbr], tot: (() => { const t = careerTotals(p.career); for (const k in p.st || {}) t[k] = (t[k] || 0) + p.st[k]; return t; })(), active: true }))
    .concat((L.retired || []).map(r => ({ name: r.name, pos: r.pos, tms: r.teams, tot: r.tot, active: false })));
  const prog = REC_TAB === 'program';
  const sRows = prog ? seasonRows.filter(r => r.tm === u.abbr) : seasonRows, cRows = prog ? careers.filter(c => (c.tms || []).includes(u.abbr)) : careers;
  const board = (rows, val, label) => {
    const top = rows.filter(r => val(r) > 0).sort((a, b) => val(b) - val(a)).slice(0, 5);
    return `<div class="card"><h2>${label}</h2>${top.length ? `<div class="tbl-wrap"><table class="t"><tbody>${top.map((r, i) => `<tr><td class="num muted">${i + 1}</td><td>${esc(r.name)} <span class="muted small">${r.pos}${r.season ? ' · ' + r.season + ' ' + r.tm : r.active ? '' : ' · alum'}${r.live ? ' · in progress' : ''}</span></td><td class="r num"><b>${val(r)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">No stats yet.</p>'}</div>`;
  };
  let body = '';
  if (REC_TAB === 'season' || prog) body = `${prog ? `<h2 class="conf-h">${esc(u.city)} single-season records</h2>` : ''}<div class="cols">${REC_STATS.map(([k, n]) => board(sRows, r => r.s[k] || 0, n)).join('')}</div>`;
  if (REC_TAB === 'career' || prog) body += `${prog ? `<h2 class="conf-h">${esc(u.city)} career records</h2>` : ''}<div class="cols">${REC_STATS.map(([k, n]) => board(cRows, r => r.tot[k] || 0, n)).join('')}</div>`;
  if (REC_TAB === 'hof') {
    const ring = (L.retired || []).filter(r => r.hof && r.teams.includes(u.abbr));
    const others = (L.retired || []).filter(r => r.hof && !r.teams.includes(u.abbr)).slice(0, 30);
    const nums = (L.retiredNums || {})[u.abbr] || [];
    const tbl = (arr, mine) => `<div class="tbl-wrap"><table class="t"><thead><tr><th>Class</th><th>Player</th><th>School</th><th class="r">Seasons</th><th>Honors</th><th></th></tr></thead><tbody>${arr.map(r => {
      const done = nums.some(x => x.num === r.num);
      return `<tr><td>${r.year}</td><td>${r.pos} <b>${esc(r.name)}</b> <span class="muted small">#${r.num}</span></td><td class="small">${r.teams.join(', ')}</td><td class="r">${r.seasons}</td><td class="small">${[...r.awards, r.allPros ? r.allPros + '× All-American' : '', r.round ? 'NFL R' + r.round : ''].filter(Boolean).join(' · ') || '—'}</td>
        <td>${mine ? (done ? '<span class="pill amber">Number retired</span>' : `<button class="btn sm" data-act="rec-retire" data-id="${r.id}">Retire #${r.num}</button>`) : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
    const ap = (L.awards || []).find(a => a.allpro);
    body = `${nums.length ? `<div class="card"><h2>${esc(u.city)} retired numbers</h2><div class="row">${nums.map(x => `<div class="retnum"><b>${x.num}</b><span>${esc(x.name)}</span></div>`).join('')}</div></div>` : ''}
      <div class="card"><h2>${esc(u.city)} Ring of Honor</h2>${ring.length ? tbl(ring, true) : '<p class="muted small">Nobody yet. Heisman winners, multi-time All-Americans and stars with huge careers go in when they leave school.</p>'}</div>
      ${others.length ? `<div class="card"><h2>Other programs' greats</h2>${tbl(others, false)}</div>` : ''}
      ${ap ? `<div class="card"><h2>${ap.season} All-America team</h2><div class="ap-grid">${ap.allpro.map(x => `<div class="ap"><span class="pos-chip">${x.pos}</span> ${esc(x.name)} <span class="muted small">${L.teams[x.tid] ? esc(L.teams[x.tid].abbr) : ''}</span></div>`).join('')}</div></div>` : ''}`;
  }
  return `<div class="card row"><h2 class="grow" style="margin:0">Records</h2><div class="seg">${[['season', 'Single season'], ['career', 'Career'], ['program', esc(u.city)], ['hof', 'Ring of Honor']].map(([k, n]) => `<button class="btn sm ${REC_TAB === k ? 'primary' : ''}" data-act="rec-tab" data-tab="${k}">${n}</button>`).join('')}</div></div>
    <p class="muted small">Records count games played in this dynasty, starting with your first season.</p>${body}`;
};

// ---------- settings ----------
const _viewSettingsC = viewSettings;
viewSettings = function () {
  const s = LEAGUE.settings;
  return `<div class="card stack"><h2>Coach</h2><label>Your name <input type="text" id="coachNameIn" value="${esc(s.coachName || '')}" maxlength="24" style="width:180px"></label><div><button class="btn sm" data-act="coach-name">Save name</button></div></div>` + _viewSettingsC()
    + `<div class="card small muted">${$('#fanNote').textContent}</div>`;
};
exportSave = function () {
  const code = exportCode(LEAGUE);
  let dl = '', embedded = true; try { embedded = window.self !== window.top; } catch (e) { }
  if (!embedded) try { const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' })); dl = `<a class="btn" href="${url}" download="cfb-dynasty-${UT().abbr}-${LEAGUE.season}.txt">Download file</a>`; } catch (e) { }
  modal(`<div class="modal-head"><h2>Export save</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p class="small muted">This code is your whole dynasty (${Math.round(code.length / 1024)} KB of text). Copy it into a note or doc. To restore it on any device, choose Import save and paste it.</p>
    <textarea id="exportTxt" rows="4" readonly style="width:100%">${code}</textarea><div class="row"><button class="btn primary" data-act="copy-export">Copy to clipboard</button>${dl}</div>`);
};

// ---------- scorebug ranks + college HUD ----------
const _updateHUDC = updateHUD;
updateHUD = function () {
  _updateHUDC();
  if (!GAME || !LEAGUE || !LEAGUE.cfb) return;
  const gs = GAME.gs;
  $$('#scorebug .sb-team').forEach((el, i) => { const side = i === 0 ? 1 : 0, t = LEAGUE.teams[gs.tids[side]]; const ab = el.querySelector('.ab'); if (ab && t.rank && !ab.dataset.rk) { ab.dataset.rk = 1; ab.innerHTML = `<small>${t.rank}</small>${esc(t.abbr)}`; } });
  if (gs.ot) { const c = $('#scorebug .clk'); if (c) c.textContent = gs.ot.n >= 3 ? `OT${gs.ot.n} · 2-PT` : `OT${gs.ot.n > 1 ? gs.ot.n : ''}`; }
};

howTo = function () {
  modal(`<div class="modal-head"><h2>How to play</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
  <div class="cols small">
    <div><div class="eyebrow">Keyboard (Chromebook)</div><p><kbd>W A S D</kbd> / arrows: move<br><kbd>Shift</kbd>: sprint<br><kbd>Space</kbd>: snap · juke · dive tackle · kick<br><kbd>1</kbd>–<kbd>5</kbd>: throw to that receiver (hold <kbd>Shift</kbd> to lob)<br><kbd>P</kbd> audible · <kbd>H</kbd> hot routes<br><kbd>T</kbd>: throw it away · <kbd>E</kbd>: switch defender · <kbd>Esc</kbd>: pause</p></div>
    <div><div class="eyebrow">Touch (phone)</div><p>Left half: drag to move. SNAP / ACTION: snap, juke, dive, kick. Tap a receiver (or the colored buttons) to throw. SPRINT: hold. SWITCH: change defender.</p></div>
    <div><div class="eyebrow">Dynasty</div><p>12-game season with a rivalry week, conference title games, a 12-team playoff and bowls. Then the offseason: graduation, NFL early entries, the transfer portal, and National Signing Day. Recruit every week, manage your NIL budget, and keep your job.</p></div>
    <div><div class="eyebrow">College rules</div><p>Overtime: each team gets the ball at the 25. Teams must go for two after a TD in the 2nd OT, and from the 3rd OT it's a two-point shootout. No two-minute warning. Play in 4 or fewer games and a player keeps his redshirt.</p></div>
  </div>`);
};

// ---------- actions ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !LEAGUE || !LEAGUE.cfb) return;
  const a = el.dataset.act, L = LEAGUE, u = L.userTid;
  const R = () => L.recruits.find(r => r.id === +el.dataset.id);
  switch (a) {
    case 'rc-tab': RC.tab = el.dataset.tab; RC.page = 0; renderHub(); break;
    case 'rc-page': RC.page = Math.max(0, RC.page + +el.dataset.d); renderHub(); break;
    case 'rc-add': { if (L.rboard.length >= RC_BOARD) { toast(`Your board holds ${RC_BOARD} recruits. Remove someone first.`); break; } const r = R(); if (r && !L.rboard.includes(r.id)) { L.rboard.push(r.id); if (r.suit[u] == null) r.suit[u] = 0; } save(); renderHub(); toast('Added to your board.'); break; }
    case 'rc-drop': { const r = R(); L.rboard = L.rboard.filter(x => x !== +el.dataset.id); if (r) { r.hrs = 0; r.visit = 0; } save(); renderHub(); break; }
    case 'rc-offer': { const r = R(); if (!r) break; if (r.offers[u]) { toast('Offer already out.'); break; } r.offers[u] = true; r.suit[u] = (r.suit[u] || 0) + 45; save(); renderHub(); toast(`Scholarship offered to ${r.first} ${r.last}.`); break; }
    case 'rc-visit': {
      const r = R(); if (!r || r.visitDone) break;
      const homes = L.schedule.map((wk, i) => ({ i: i + 1, g: wk.find(g => g.h === u && g.hs == null && !g.n) })).filter(x => x.g && x.i >= L.week);
      if (!homes.length) { toast('No home games left this season.'); break; }
      const opts = homes.map(x => { const n = L.recruits.filter(q => q.visit === x.i).length; return `<button class="btn sm" data-act="rc-visit-set" data-id="${r.id}" data-wk="${x.i}" ${n >= RC_VISITS ? 'disabled' : ''}>Week ${x.i} vs ${esc(L.teams[x.g.a].city)}${isRivalry(L, x.g.h, x.g.a) ? ' (rivalry)' : ''} · ${n}/${RC_VISITS}</button>`; }).join('');
      modal(`<div class="modal-head"><h2>Official visit: ${esc(r.first)} ${esc(r.last)}</h2><button class="btn sm ghost x" data-act="close">✕</button></div><p class="small muted">Pick a home game. A win (and a rivalry game) makes the visit count more. Up to ${RC_VISITS} visitors per game.</p><div class="row">${opts}${r.visit ? `<button class="btn sm ghost" data-act="rc-visit-set" data-id="${r.id}" data-wk="0">Cancel visit</button>` : ''}</div>`);
      break;
    }
    case 'rc-visit-set': { const r = R(); if (r) { r.visit = +el.dataset.wk; } closeModal(); save(); renderHub(); break; }
    case 'rc-nil': {
      const r = R(); if (!r) break;
      modal(`<div class="modal-head"><h2>NIL offer: ${esc(r.first)} ${esc(r.last)}</h2><button class="btn sm ghost x" data-act="close">✕</button></div><p>${starsStr(r.stars)} ${r.pos}. He's hoping for around <b>${fmtNil(r.ask)}</b> a year. ${r.prio.includes('nil') ? '<b>NIL is one of his top priorities.</b>' : ''}</p>
        <div class="row"><label>Amount ($K/yr) <input type="number" id="rcNil" min="0" step="5" value="${Math.round((r.nil || r.ask) * 1000)}" style="width:110px"></label><button class="btn primary" data-act="rc-nil-set" data-id="${r.id}">Promise</button></div><p class="small muted">Promises are paid from next year's budget once he signs.</p>`);
      break;
    }
    case 'rc-nil-set': {
      const r = R(); if (!r) break; const amt = Math.max(0, (+$('#rcNil').value || 0) / 1000);
      const U = UT(), prev = r.nil || 0;
      const promised = L.recruits.filter(x => x.nil && x !== r && (x.commit === u || x.commit < 0)).reduce((s, x) => s + x.nil, 0);
      if (promised + amt > U.nilBudget * 0.35) { toast(`Keep recruit promises under ${fmtNil(U.nilBudget * 0.35)} total.`); break; }
      r.nil = Math.round(amt * 1000) / 1000; if (amt >= r.ask && prev < r.ask) r.suit[u] = (r.suit[u] || 0) + 60;
      closeModal(); save(); renderHub(); toast('NIL promise made.'); break;
    }
    case 'rs-plan': { const p = L.players[+el.dataset.pid]; p.rsPlan = !p.rsPlan; save(); playerModal(p.id); toast(p.rsPlan ? `${pshort(p)} will only play if needed (keeps his redshirt at 4 games or fewer).` : 'Redshirt plan cancelled.'); break; }
    case 'nil-edit': nilEditModal(L.players[+el.dataset.pid]); break;
    case 'nil-set': case 'nil-match': {
      const p = L.players[+el.dataset.pid]; const amt = a === 'nil-match' ? nilValue(L, p) : Math.max(0, (+$('#nilAmt').value || 0) / 1000);
      const room = capRoom(L, UT()) + p.con.sal;
      if (amt > room + 1e-6) { $('#negMsg').textContent = `Not enough NIL room. You can spend up to ${fmtNil(Math.max(0, room))}.`; break; }
      const cut = amt < p.con.sal; p.con.sal = Math.round(amt * 1000) / 1000;
      if (L.departures) { const x = L.departures.risk.find(x => x.id === p.id); if (x && amt >= x.ask) x.kept = true; }
      closeModal(); save(); renderHub(); toast(cut ? 'Deal cut. He may look elsewhere.' : 'Deal updated.'); break;
    }
    case 'dep-keep': {
      const x = L.departures.risk.find(x => x.id === +el.dataset.pid), p = L.players[x.id];
      if (capRoom(L, UT()) + p.con.sal < x.ask) { toast('Not enough NIL room. Lower other deals on the NIL tab.'); break; }
      p.con.sal = x.ask; x.kept = true; addNews(L, `${p.pos} ${pname(p)} stays at ${UT().city} with a new ${fmtNil(x.ask)} NIL deal.`); save(); renderHub(); break;
    }
    case 'dep-stay': {
      const p = L.players[+el.dataset.pid], ask = Math.round(retentionAsk(L, p) * 1.4 * 1000) / 1000;
      if (capRoom(L, UT()) + p.con.sal < ask) { toast('Not enough NIL room to make that pitch.'); break; }
      if (!chance(draftGrade(p) >= 5 ? 0.85 : draftGrade(p) === 4 ? 0.6 : 0.4)) { toast(`${pshort(p)} thanks you, but he's going pro.`); el.disabled = true; L.departures.nfl.find(x => x.id === p.id).round = draftGrade(p); break; }
      p.con.sal = ask; L.departures.kept.push(p.id); addNews(L, `${p.pos} ${pname(p)} returns to ${UT().city} for another year!`); save(); renderHub(); break;
    }
    case 'open-portal': startPortal(L); TAB = 'portal'; save(); renderHub(); break;
    case 'portal-day': portalAdvance(L); save(); if (L.phase === 'signing') TAB = 'home'; renderHub(); toast(L.phase === 'signing' ? 'Portal closed. National Signing Day results are in.' : `Portal day ${L.portal.day}.`); break;
    case 'portal-offer-open': portalOfferModal(L.players[+el.dataset.pid]); break;
    case 'portal-offer': {
      const p = L.players[+el.dataset.pid], amt = Math.max(0, (+$('#ptAmt').value || 0) / 1000);
      const err = userPortalOffer(L, p, amt); if (err) { $('#negMsg').textContent = err; break; }
      closeModal(); save(); renderHub(); toast(`Offer sent to ${pshort(p)}.`); break;
    }
    case 'portal-pull': { const p = L.players[+el.dataset.pid]; delete p.portal.offers[u]; closeModal(); save(); renderHub(); break; }
    case 'take-job': takeJob(L, +el.dataset.tid); save(); TAB = 'home'; renderHub(); break;
    case 'coach-name': { const n = ($('#coachNameIn').value || '').trim().slice(0, 24); if (n) { L.settings.coachName = n; UT().coach = n; save(); renderHub(); toast('Saved.'); } break; }
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'setConf') { SETUP_CONF = el.value; setupGrid(); return; }
  if (!LEAGUE || !LEAGUE.cfb) return;
  const a = el.dataset && el.dataset.act;
  if (a === 'rc-hrs') {
    const r = LEAGUE.recruits.find(r => r.id === +el.dataset.id); const h = +el.value;
    const used = userHoursUsed(LEAGUE) - (r.hrs || 0);
    if (used + h > RC_HOURS) { toast(`Only ${RC_HOURS - used} hours left this week.`); el.value = r.hrs || 0; return; }
    r.hrs = h; save(); renderHub();
  }
  if (a === 'rc-f') { RC[el.dataset.k] = el.dataset.k === 'stars' ? +el.value : el.value; RC.page = 0; renderHub(); }
  if (a === 'pt-f') { PT[el.dataset.k] = el.value; renderHub(); }
  if (a === 'st-conf') { ST_CONF = el.value; renderHub(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'setSearch') { SETUP_Q = e.target.value; setupGrid(); }
  if (e.target.id === 'rcSearch') { RC.q = e.target.value; RC.page = 0; clearTimeout(RC._t); RC._t = setTimeout(() => { renderHub(); const s = $('#rcSearch'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 350); }
});

// school picker: show what you're taking over (runs after the shared handler)
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act="pick-team"]'); if (!el || !SETUP.tmp || !SETUP.tmp.cfb) return;
  const L = SETUP.tmp, t = L.teams[+el.dataset.tid], o = teamOvr(L, t), qb = lineup(L, t, 0).QB[0];
  $('#setupInfo').innerHTML = `<b>${esc(teamName(t))}</b> (${t.conf === 'Ind' ? 'Independent' : esc(t.conf)}) · OVR ${o.ovr} · ${t.rank ? 'Preseason #' + t.rank : 'Unranked'} · QB ${esc(pname(qb))} (${qb.ovr}) · NIL budget ${fmtNil(t.nilBudget)} · Expectation ~${Math.round(expectedWins(t))} wins`;
});
// college: released players leave the program for good
const _releaseToFAC = releaseToFA;
releaseToFA = function (L, p) { if (!L.cfb) return _releaseToFAC(L, p); removeFromTeam(L, p); L.fa = L.fa.filter(id => id !== p.id); delete L.players[p.id]; };
renderMenu();
