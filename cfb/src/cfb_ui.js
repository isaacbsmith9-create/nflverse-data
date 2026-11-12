// ============================================================
// College Gridiron Dynasty - UI: menu, school picker, hub, home cards
// for every phase, Top 25 / CFP, schedule, conference standings,
// roster and player cards.
// ============================================================
'use strict';

// NFL-only words in shared views
function cfbText(h) {
  return String(h)
    .replace(/<button class="btn sm( ghost)?" data-act="lu-need-trade" data-pos="(\w+)">[^<]*<\/button>/g, '<button class="btn sm" data-act="tab" data-tab="recruit">Recruit one</button>')
    .replace(/<button class="btn sm( ghost)?" data-act="lu-need-fa" data-pos="(\w+)">[^<]*<\/button>/g, '<button class="btn sm ghost" data-act="tab" data-tab="portal">Transfer portal</button>')
    .replace(/<span class="lu-age">(\d+)y · [^<]*<\/span>/g, '<span class="lu-age">$1y</span>')
    .replace(/Sign someone/g, 'Recruit someone')
    .replace(/His \$[\d.]+M salary comes off your cap\./g, 'His NIL deal comes off your budget and he leaves the program.');
}
const _modalC = modal;
modal = function (html) { _modalC(LEAGUE && LEAGUE.cfb ? cfbText(html) : html); };
const _viewLineupC = viewLineup;
viewLineup = function () { return cfbText(_viewLineupC()); };

// ============================================================ MENU
renderMenu = function () {
  if (typeof flushSave === 'function') flushSave();
  show('menu');
  $('#fanNote').hidden = false;
  const box = $('#slots'); let h = '';
  for (let s = 1; s <= 3; s++) {
    const m = saveMeta(s);
    if (m) h += `<div class="slot"><div class="row">${badge({ abbr: m.abbr, c1: m.c1, c2: m.c2, name: m.team.split(' ').slice(-1)[0], city: '' })}<div class="grow"><h3>${m.rank ? '#' + m.rank + ' ' : ''}${esc(m.team)}</h3><div class="muted small">${m.season} · ${phaseLabel(m.phase, m.week)} · ${m.rec}</div></div></div>
      <div class="row"><button class="btn primary sm" data-act="load" data-slot="${s}">Continue</button><button class="btn danger sm" data-act="del-slot" data-slot="${s}">Delete</button></div></div>`;
    else h += `<div class="slot"><h3 class="muted">Slot ${s}: empty</h3><div><button class="btn sm" data-act="new-franchise" data-slot="${s}">Start a dynasty here</button></div></div>`;
  }
  box.innerHTML = h;
};

// ============================================================ SETUP
let SETUP_CONF = 'ALL', SETUP_Q = '';
renderSetup = function (mode, slot) {
  const keep = SETUP.tmp && SETUP.tmp.cfb && SETUP.mode === mode;
  SETUP = { mode, tid: null, slot: slot || (SETUP.slot && mode === SETUP.mode ? SETUP.slot : firstFreeSlot()), tmp: keep ? SETUP.tmp : newCfbLeague('OSU') };
  show('setup');
  $('#setupTitle').textContent = mode === 'franchise' ? 'Choose your school' : 'Quick Play: pick your team';
  $('#awayWrap').hidden = mode !== 'quick';
  $('#setupGo').disabled = true;
  const L = SETUP.tmp;
  $('#setConf').innerHTML = ['ALL', ...L.confs].map(c => `<option value="${c}" ${c === SETUP_CONF ? 'selected' : ''}>${c === 'ALL' ? 'All FBS' : c === 'Ind' ? 'Independents' : c}</option>`).join('');
  $('#setAway').innerHTML = L.teams.slice().sort((a, b) => a.city.localeCompare(b.city)).map(t => `<option value="${t.id}">${esc(t.city)} ${esc(t.name)}</option>`).join('');
  $('#setAway').value = String(L.poll[randi(0, 9)].tid);
  setupGrid();
};
function setupGrid() {
  const L = SETUP.tmp; let h = '';
  const q = SETUP_Q.trim().toLowerCase();
  for (const conf of L.confs) {
    if (SETUP_CONF !== 'ALL' && conf !== SETUP_CONF) continue;
    const ts = L.teams.filter(t => t.conf === conf && (!q || (t.city + ' ' + t.name + ' ' + t.abbr).toLowerCase().includes(q)))
      .map(t => ({ t, o: teamOvr(L, t) })).sort((a, b) => b.o.ovr - a.o.ovr || b.t.prestige - a.t.prestige);
    if (!ts.length) continue;
    h += `<h2 class="conf-h">${conf === 'Ind' ? 'Independents' : conf}</h2><div class="teams-grid">`;
    for (const { t, o } of ts) {
      h += `<button class="team-card ${SETUP.tid === t.id ? 'sel' : ''}" data-act="pick-team" data-tid="${t.id}" style="--tc1:${t.c1}">${badge(t)}<div class="grow"><div class="nm">${t.rank ? `<span class="rk">#${t.rank}</span> ` : ''}${esc(t.city)}<br><span class="nick">${esc(t.name)}</span></div>
        <div class="pstars small">${prestigeStars(t.prestige)}</div><div class="muted small">OFF ${o.off} · DEF ${o.def} · NIL ${fmtNil(t.nilBudget)}</div><div class="muted small">HC ${esc(t.coach)}</div></div>${ovrTag(o.ovr)}</button>`;
    }
    h += '</div>';
  }
  $('#teamGrid').innerHTML = h || '<p class="muted">No schools match.</p>';
}
setupGo = function () {
  const L = SETUP.tmp; const tid = SETUP.tid; if (tid == null) return;
  L.userTid = tid;
  L.settings.diff = $('#setDiff').value; L.settings.qlen = +$('#setQlen').value; L.settings.simDef = $('#setSimDef').checked;
  L.settings.coachName = ($('#setCoach').value || '').trim().slice(0, 24) || 'You';
  const t = L.teams[tid];
  L.startSeason = L.season; L.security = clamp(78 - t.prestige * 3, 55, 75);
  L.news = [];
  if (SETUP.mode === 'franchise') {
    t.coach = coachName(L);
    addNews(L, `Welcome to ${t.city}, Coach ${coachName(L)}! The ${t.name} are ${t.rank ? 'ranked #' + t.rank + ' in the preseason poll' : 'unranked to start the year'}. Expectation: about ${Math.round(expectedWins(t))} wins.`);
    addNews(L, `Recruiting is open: ${L.recruits.length} high school prospects (all fictional) are on the board. Spend your weekly hours on the Recruiting tab.`);
    LEAGUE = L; SLOT = SETUP.slot; EXHIB = false; save(); TAB = 'home'; renderHub();
  } else {
    LEAGUE = L; EXHIB = true;
    let away = +$('#setAway').value; if (away === tid) away = L.poll[0].tid === tid ? L.poll[1].tid : L.poll[0].tid;
    startLiveGame(tid, away, tid, { exhibition: true });
  }
};

// ============================================================ HUB
const CFB_TABS = [['home', 'Home'], ['poll', 'Top 25'], ['lineup', 'Lineup'], ['roster', 'Roster'], ['depth', 'Depth Chart'], ['recruit', 'Recruiting'], ['nil', 'NIL'], ['portal', 'Portal'],
  ['dev', 'Development'], ['schedule', 'Schedule'], ['standings', 'Standings'], ['stats', 'Leaders'], ['program', 'Program'], ['records', 'Records'], ['playbook', 'Playbook'], ['settings', 'Settings']];
renderHub = function () {
  show('hub');
  const L = LEAGUE, t = UT(), o = teamOvr(L, t);
  document.documentElement.style.setProperty('--tc1', t.c1);
  document.documentElement.style.setProperty('--tc2', t.c2);
  const conf = t.conf === 'Ind' ? 'Independent' : `${t.cw}-${t.cl} ${t.conf}`;
  $('#hubHead').innerHTML = `<div class="wrap">${badge(t, 'lg')}<div class="grow"><div class="hub-title">${t.rank ? `<span class="rk">#${t.rank}</span> ` : ''}${esc(teamName(t))}</div>
    <div class="hub-sub">HC ${esc(coachName(L))} · ${L.season} · ${phaseLabel(L.phase, L.week)} · <b class="num">${recStr(t)}</b> (${conf}) · NIL room <b class="num">${fmtNil(capRoom(L, t))}</b> of ${fmtNil(t.nilBudget)} · Roster ${t.roster.length}/${CFB_ROSTER_MAX}</div>
    <div class="secbar" title="Job security"><span>Job security</span><i><b style="width:${L.security}%;background:${L.security < 25 ? 'var(--red)' : L.security < 50 ? 'var(--amber)' : 'var(--green)'}"></b></i><span class="num">${L.security}</span></div></div>
    <div class="rings">${[['OVR', o.ovr], ['OFF', o.off], ['DEF', o.def]].map(([n, v]) => `<div class="ring" style="--v:${v}"><b>${v}</b><span>${n}</span></div>`).join('')}</div>
    <button class="btn sm ghost" data-act="menu">Menu</button></div>`;
  const dot = { home: ['recap', 'departures', 'portal', 'signing'].includes(L.phase), portal: L.phase === 'portal', recruit: L.phase === 'regular' && userHoursUsed(L) < RC_HOURS * 0.5 && (L.recruits || []).length > 0 };
  $('#tabs').innerHTML = CFB_TABS.map(([k, n]) => `<button class="tab ${TAB === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}${dot[k] ? '<span class="dot"></span>' : ''}</button>`).join('');
  const fn = { home: viewHome, poll: viewPoll, lineup: viewLineup, roster: viewRoster, depth: viewDepth, recruit: viewRecruit, nil: viewNil, portal: viewPortal, dev: viewDev,
    schedule: viewSchedule, standings: viewStandings, stats: viewStats, program: viewProgram, records: viewRecords, playbook: viewPlaybook, settings: viewSettings }[TAB] || viewHome;
  $('#panel').innerHTML = fn();
};

// ---------- home ----------
viewHome = function () {
  const L = LEAGUE, t = UT();
  let main = '';
  if (L.phase === 'regular' || L.phase === 'playoffs') main = homeGameCard();
  else if (L.phase === 'recap') main = recapCard();
  else if (L.phase === 'departures') main = departuresCard();
  else if (L.phase === 'portal') main = portalHomeCard();
  else if (L.phase === 'signing') main = signingCard();
  const lu = lineup(L, t, 0);
  const starters = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'CB', 'S'].map(pos => lu[pos].slice(0, pos === 'WR' || pos === 'CB' ? 2 : 1).map(p => `<tr class="click" data-act="player" data-pid="${p.id}"><td>${pos}</td><td>${esc(pname(p))} <span class="muted small">${clsLabel(p)}</span>${p.inj ? ` <span class="inj">INJ ${p.inj}w</span>` : ''}</td><td class="r">${ovrTag(p.ovr)}</td></tr>`).join('')).join('');
  const top = (L.poll || []).slice(0, 10).map((x, i) => { const tt = L.teams[x.tid]; return `<div class="pollrow ${x.tid === L.userTid ? 'me' : ''}"><b class="num">${i + 1}</b>${badge(tt, 'xs')}<span class="grow">${esc(tt.city)}</span><span class="muted small num">${recStr(tt)}</span></div>`; }).join('');
  return `${main}<div class="cols">
    <div class="card"><h2>Key starters</h2><div class="tbl-wrap"><table class="t"><tbody>${starters}</tbody></table></div></div>
    <div class="card"><div class="row"><h2 class="grow">Top 10</h2><button class="btn sm ghost" data-act="tab" data-tab="poll">Full poll</button></div><div class="stack" style="gap:4px">${top}</div></div>
    <div class="card"><h2>College football news</h2><div class="news">${L.news.slice(0, 30).map(n => `<div><span class="muted small">${n.s} · </span>${esc(n.txt)}</div>`).join('')}</div></div>
  </div>`;
};
homeGameCard = function () {
  const L = LEAGUE, g = userGame(L), po = L.playoffs;
  if (!g) {
    if (L.phase === 'playoffs') return `<div class="card stack"><h2>${ROUND_NAMES[po.round]}</h2><p>${po.round === 0 ? 'You are not in a conference title game this week.' : 'Your season is over. Watch the rest of the postseason.'}</p>${postList()}<div class="row"><button class="btn primary" data-act="sim-week">Sim ${ROUND_NAMES[po.round]}</button></div></div>`;
    return `<div class="card stack"><div class="row"><span class="eyebrow grow">Week ${L.week} of ${weeksOf(L)}</span><span class="pill">BYE</span></div><h2>Bye week</h2><p class="muted small">A week off. Recruiting hours still count.</p><div class="row"><button class="btn primary" data-act="sim-week">Sim week</button><button class="btn ghost" data-act="sim-to-playoffs">Sim to end of regular season</button></div>${lastResults()}</div>`;
  }
  const H = L.teams[g.h], A = L.teams[g.a];
  const label = L.phase === 'playoffs' ? (g.name || ROUND_NAMES[po.round]) : `Week ${L.week} of ${weeksOf(L)}`;
  const tag = L.phase === 'playoffs' ? (g.cfp ? (g.seedH ? `#${g.seedH} vs #${g.seedA} seed` : 'College Football Playoff') : g.bowl ? 'Bowl game' : 'Title game') : gameLabel(L, g);
  const rv = isRivalry(L, g.h, g.a);
  const side = t => `<div class="side">${badge(t, 'lg')}<div class="tn">${t.rank ? `<span class="rk">#${t.rank}</span> ` : ''}${esc(t.city)}<br><span class="nick">${esc(t.name)}</span></div><div class="muted small num">${recStr(t)} · OVR ${teamOvr(L, t).ovr}</div><div class="muted small">HC ${esc(t.id === L.userTid ? coachName(L) : t.coach)}</div></div>`;
  const venue = g.n ? 'Neutral site' : `${esc(H.stadium)}`;
  return `<div class="card stack game-card ${rv ? 'rivalry' : ''}" style="--hc1:${H.c1};--ac1:${A.c1}"><div class="row"><span class="eyebrow grow">${label}</span>${rv ? '<span class="pill rival">RIVALRY</span>' : ''}<span class="pill">${tag}</span><span class="pill">${g.n ? 'NEUTRAL' : g.h === L.userTid ? 'HOME' : 'AWAY'}</span></div>
    <div class="matchup">${side(A)}<div class="vs">@</div>${side(H)}</div>
    <div class="muted small" style="text-align:center">${venue}</div>
    <div class="row" style="justify-content:center"><button class="btn primary" data-act="play-game">▶ Play Game</button><button class="btn" data-act="sim-game">Sim Game</button>
    ${L.phase === 'regular' ? `<button class="btn ghost" data-act="sim-to-playoffs">Sim to end of regular season</button>` : ''}</div>
    ${L.phase === 'playoffs' ? postList() : lastResults()}</div>`;
};
function postList() {
  const L = LEAGUE, po = L.playoffs; if (!po) return '';
  const gs = po.games.slice().sort((a, b) => (b.cfp ? 1 : 0) - (a.cfp ? 1 : 0)).slice(0, 18);
  return `<div class="stack small" style="gap:4px">${gs.map(g => `<div class="row small"><span class="pill ${g.cfp ? 'amber' : ''}">${esc(g.name || '')}</span><span class="grow">${rkTxt(L.teams[g.a])}${esc(L.teams[g.a].city)} vs ${rkTxt(L.teams[g.h])}${esc(L.teams[g.h].city)}</span><span class="num">${g.hs == null ? '' : g.as + '-' + g.hs}</span></div>`).join('')}${po.games.length > 18 ? `<div class="muted small">+${po.games.length - 18} more bowl games</div>` : ''}</div>`;
}
lastResults = function () {
  const L = LEAGUE; const wk = L.schedule[L.week - 2]; if (!wk) return '';
  const top = wk.filter(g => L.teams[g.h].rank || L.teams[g.a].rank || g.h === L.userTid || g.a === L.userTid).slice(0, 14);
  return `<div class="small muted">Last week: ${top.map(g => `${esc(L.teams[g.a].abbr)} ${g.as}-${g.hs} ${esc(L.teams[g.h].abbr)}${g.ot ? ' (OT)' : ''}`).join(' · ')}</div>`;
};
recapCard = function () {
  const L = LEAGUE, h = L.history[0], aw = L.awards[0], u = L.userTid, U = UT();
  const awn = a => a ? `${esc(a.name)} <span class="muted">(${a.pos}, ${L.teams[a.tid] ? esc(L.teams[a.tid].city) : ''})</span>` : '—';
  const fin = (aw.finalists || []).map((f, i) => `<div class="row small"><b class="num">${i + 1}.</b><span class="grow">${esc(f.name)} <span class="muted">${f.pos} · ${esc(L.teams[f.tid].city)} · ${f.cls}</span></span><span class="muted">${esc(f.line)}</span></div>`).join('');
  const seed = (L.playoffs.seeds || []).indexOf(u);
  const sum = `${recStr(U)}${U.rank ? `, finished #${U.rank}` : ''}${seed >= 0 ? `, CFP #${seed + 1} seed` : ''}`;
  return `<div class="card stack"><span class="eyebrow">${L.season} season complete</span>
    <div class="row">${badge(L.teams[h.champ], 'lg')}<div><h2 style="margin:0">${esc(teamName(L.teams[h.champ]))} win the national title</h2><div class="muted">Beat ${esc(L.teams[h.runner].city)} ${h.score}</div></div></div>
    <div><div class="eyebrow">Heisman Trophy voting</div>${fin || '—'}</div>
    <div class="cols"><div><div class="eyebrow">Top quarterback</div>${awn(aw.qb)}</div><div><div class="eyebrow">Top running back</div>${awn(aw.rb)}</div><div><div class="eyebrow">Top receiver</div>${awn(aw.wr)}</div><div><div class="eyebrow">Top defender</div>${awn(aw.dpoy)}</div><div><div class="eyebrow">Freshman of the Year</div>${awn(aw.fresh)}</div><div><div class="eyebrow">Coach of the Year</div>${aw.coy ? esc(aw.coy.name) + ` <span class="muted">(${esc(L.teams[aw.coy.tid].city)})</span>` : '—'}</div></div>
    <div class="card inner"><b>Your season:</b> ${sum}. Your job review and any offers from other programs come when the offseason starts.</div>
    <p class="muted small">Next: seniors graduate, early entries leave for the NFL Draft, redshirts are decided (4 or fewer games keeps a year), and players think about the transfer portal.</p>
    <div><button class="btn primary" data-act="begin-offseason">Begin Offseason</button></div></div>`;
};

// ---------- Top 25 / CFP ----------
function viewPoll() {
  const L = LEAGUE, po = L.playoffs;
  const rows = (L.poll || []).map((x, i) => {
    const t = L.teams[x.tid], mv = x.prev ? x.prev - (i + 1) : null;
    return `<tr class="${x.tid === L.userTid ? 'me' : ''}"><td class="num"><b>${i + 1}</b></td><td><div class="row" style="gap:8px">${badge(t, 'sm')}<span>${esc(t.city)} <span class="muted small">${esc(t.name)}</span></span></div></td><td class="r num">${recStr(t)}</td><td class="small muted">${t.conf}</td>
      <td class="r small ${mv > 0 ? 'up' : mv < 0 ? 'down' : 'muted'}">${mv == null ? 'NEW' : mv > 0 ? '▲' + mv : mv < 0 ? '▼' + (-mv) : '–'}</td></tr>`;
  }).join('');
  let bracket = '';
  if (po && po.seeds && po.seeds.length) {
    const S = po.seeds, T = id => L.teams[id], nm = id => `${badge(T(id), 'xs')} <span class="muted small">${S.indexOf(id) + 1}</span> ${esc(T(id).city)}`;
    const res = (r) => po.done.concat(po.games).filter(g => g.cfp && g.round === r).sort((a, b) => a.slot - b.slot);
    const gline = g => `<div class="bk-g"><div class="${g.hs != null && g.as > g.hs ? 'w' : ''}">${nm(g.a)} <b class="num">${g.as ?? ''}</b></div><div class="${g.hs != null && g.hs > g.as ? 'w' : ''}">${nm(g.h)} <b class="num">${g.hs ?? ''}</b></div></div>`;
    bracket = `<div class="card"><h2>College Football Playoff</h2><div class="muted small">12 teams: the five highest-ranked conference champions plus seven at-large, seeded by ranking. Seeds 1-4 get byes.</div>
      <div class="bracket"><div><div class="eyebrow">First round</div>${res(1).map(gline).join('')}</div><div><div class="eyebrow">Quarterfinals</div>${res(2).map(gline).join('') || S.slice(0, 4).map((id, i) => `<div class="bk-g"><div>#${i + 1} ${nm(id)}</div><div class="muted">bye</div></div>`).join('')}</div>
      <div><div class="eyebrow">Semifinals</div>${res(3).map(gline).join('')}</div><div><div class="eyebrow">Championship</div>${res(4).map(gline).join('')}</div></div>
      <div class="small muted">Seeds: ${S.map((id, i) => `#${i + 1} ${esc(T(id).city)}`).join(' · ')}</div></div>`;
  }
  const cls = (L.classRanks || []).slice(0, 15).map((x, i) => `<div class="pollrow ${x.tid === L.userTid ? 'me' : ''}"><b class="num">${i + 1}</b>${badge(L.teams[x.tid], 'xs')}<span class="grow">${esc(L.teams[x.tid].city)}</span><span class="muted small">${x.n} signees</span></div>`).join('');
  return `${bracket}<div class="cols"><div class="card" style="grid-column: span 2"><h2>${L.phase === 'regular' && L.week > 9 ? 'CFP Rankings' : 'Top 25 poll'} <span class="muted small">${L.phase === 'regular' ? (L.week === 1 ? 'Preseason' : 'After week ' + (L.week - 1)) : 'Final regular season'}</span></h2>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>#</th><th>Team</th><th class="r">Record</th><th>Conf</th><th class="r">Move</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted small">This game's own poll: record, strength of schedule and margin, starting from preseason talent.</p></div>
    <div class="card"><h2>Recruiting class rankings</h2>${cls || '<p class="muted small">Final class rankings come out on National Signing Day.</p>'}</div></div>`;
}

// ---------- schedule ----------
viewSchedule = function () {
  const L = LEAGUE, u = L.userTid;
  const rows = L.schedule.map((wk, i) => {
    const g = wk.find(g => g.h === u || g.a === u); if (!g) return `<tr><td class="num">${i + 1}</td><td colspan="4" class="muted">Bye</td></tr>`;
    const home = g.h === u, opp = L.teams[home ? g.a : g.h];
    let res = '';
    if (g.hs != null) { const us = home ? g.hs : g.as, them = home ? g.as : g.hs; res = `<b class="${us > them ? 'win' : 'loss'}">${us > them ? 'W' : 'L'}</b> ${us}-${them}${g.ot ? ' OT' : ''}`; }
    const rv = isRivalry(L, g.h, g.a), cg = L.teams[g.h].conf === L.teams[g.a].conf && L.teams[g.h].conf !== 'Ind';
    return `<tr class="${i + 1 === L.week && L.phase === 'regular' ? 'me' : ''}"><td class="num">${i + 1}</td><td>${g.n ? 'vs' : home ? 'vs' : '@'}</td><td><div class="row" style="gap:8px">${badge(opp, 'sm')} ${rk(opp)}${esc(opp.city)} <span class="muted small">${recStr(opp)}</span>${rv ? '<span class="pill rival">Rivalry</span>' : ''}</div></td><td class="small muted">${g.n ? 'Neutral' : cg ? 'Conf' : 'Non-conf'}</td><td class="r num">${res}</td></tr>`;
  }).join('');
  const po = L.playoffs ? `<div class="card"><h2>Postseason</h2>${L.playoffs.done.concat(L.playoffs.games).filter(g => g.h === u || g.a === u || g.cfp).map(g => `<div class="row small"><span class="pill ${g.cfp ? 'amber' : ''}">${esc(g.name || '')}</span><span class="grow">${esc(L.teams[g.a].city)} vs ${esc(L.teams[g.h].city)}</span><span class="num">${g.hs == null ? '—' : g.as + '-' + g.hs}</span></div>`).join('')}</div>` : '';
  return `${po}<div class="card"><h2>${L.season} Schedule ${L.realSchedule ? '<span class="pill">Real 2026 schedule</span>' : ''}</h2><div class="tbl-wrap"><table class="t"><thead><tr><th>Wk</th><th></th><th>Opponent</th><th></th><th class="r">Result</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
};

// ---------- standings ----------
let ST_CONF = null;
viewStandings = function () {
  const L = LEAGUE, conf = ST_CONF || UT().conf;
  const tbl = conf === 'Ind' ? L.teams.filter(t => t.conf === 'Ind').map(t => t.id) : confTable(L, conf);
  const rows = tbl.map((id, i) => { const t = L.teams[id]; return `<tr class="${id === L.userTid ? 'me' : ''}"><td class="num muted">${i + 1}</td><td><div class="row" style="gap:8px">${badge(t, 'sm')}${rk(t)}${esc(t.city)}</div></td><td class="r num">${t.cw}-${t.cl}</td><td class="r num">${recStr(t)}</td><td class="r num">${t.pf}</td><td class="r num">${t.pa}</td></tr>`; }).join('');
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">${conf === 'Ind' ? 'Independents' : conf} standings</h2>
    <select data-act="st-conf">${L.confs.map(c => `<option ${c === conf ? 'selected' : ''} value="${c}">${c === 'Ind' ? 'Independents' : c}</option>`).join('')}</select></div>
    <div class="muted small">${conf === 'Ind' ? 'Independents play no conference title game.' : 'The top two teams in conference play meet in the conference championship game.'}</div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th></th><th>Team</th><th class="r">Conf</th><th class="r">Overall</th><th class="r">PF</th><th class="r">PA</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
};

// ---------- roster ----------
viewRoster = function () {
  const L = LEAGUE, t = UT();
  let ps = t.roster.map(id => L.players[id]);
  if (ROSTER_FILTER !== 'ALL') ps = ps.filter(p => p.pos === ROSTER_FILTER);
  const sorters = { pos: (a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.ovr - a.ovr, ovr: (a, b) => b.ovr - a.ovr, age: (a, b) => (b.cls * 2 + b.rs) - (a.cls * 2 + a.rs), sal: (a, b) => b.con.sal - a.con.sal };
  ps.sort(sorters[ROSTER_SORT] || sorters.pos);
  const rows = ps.map(p => `<tr class="click" data-act="player" data-pid="${p.id}"><td>${p.pos}</td><td>#${p.num} ${esc(pname(p))}${p.inj ? ` <span class="inj">INJ ${p.inj}w</span>` : ''}${p.rsPlan ? ' <span class="pill">RS plan</span>' : ''}</td>
    <td>${clsLabel(p)}</td><td class="r">${ovrTag(p.ovr)}</td><td>${p.dev !== 'N' ? `<span class="devb dev-${p.dev}">${devLabel(p.dev)}</span>` : '<span class="muted small">Normal</span>'}</td><td class="stars">${starsStr(p.stars)}</td><td class="small muted">${p.home || ''}</td><td class="r">${fmtNil(p.con.sal)}</td><td class="small muted">${statLine(p)}${p.st && p.st.gp ? ` <span class="muted">(${p.st.gp} gp)</span>` : ''}</td></tr>`).join('');
  return `<div class="card stack"><div class="row"><h2 class="grow" style="margin:0">Roster</h2>
    <select data-act="roster-filter">${['ALL', ...POSITIONS].map(p => `<option ${p === ROSTER_FILTER ? 'selected' : ''}>${p}</option>`).join('')}</select>
    <select data-act="roster-sort">${[['pos', 'Sort: Position'], ['ovr', 'Sort: OVR'], ['age', 'Sort: Class'], ['sal', 'Sort: NIL']].map(([k, n]) => `<option value="${k}" ${k === ROSTER_SORT ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="muted small">${t.roster.length} of ${CFB_ROSTER_MAX} players. Anyone who plays in 4 or fewer games keeps a year of eligibility (redshirt). Tap a player for ratings, NIL and a redshirt plan.</div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Pos</th><th>Player</th><th>Class</th><th class="r">OVR</th><th>Dev</th><th>HS</th><th>Home</th><th class="r">NIL deal</th><th>Season</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
};

playerModal = function (pid) {
  const L = LEAGUE; const p = L.players[pid]; if (!p) return;
  const mine = p.tid === L.userTid, inPortal = p.tid == null && p.portal;
  const t = p.tid != null && p.tid >= 0 ? L.teams[p.tid] : null, prev = inPortal ? L.teams[p.prevTid] : null;
  const w = OVR_W[p.pos];
  const keys = Object.keys(w).sort((a, b) => w[b] - w[a]).concat(RATING_KEYS.filter(k => !w[k] && ['spd', 'str', 'agi', 'awr'].includes(k)));
  const bars = keys.map(k => `<div class="bar ${w[k] ? 'key' : ''}"><span>${RATING_NAMES[k]}</span><i><b style="width:${p.r[k]}%"></b></i><span class="num">${p.r[k]}</span></div>`).join('');
  const career = p.career.slice().reverse().map(c => `<tr><td>${c.season}</td><td>${c.tm}</td><td class="r">${c.gp || 0}</td><td class="small">${statLine(p, c)}</td></tr>`).join('');
  const est = nilValue(L, p);
  let actions = '';
  if (mine) {
    actions = `<button class="btn sm" data-act="promote" data-pid="${p.id}">Make starter</button>
      ${!p.rs && L.phase === 'regular' ? `<button class="btn sm ${p.rsPlan ? 'primary' : ''}" data-act="rs-plan" data-pid="${p.id}">${p.rsPlan ? 'Cancel redshirt plan' : 'Plan to redshirt'}</button>` : ''}
      <button class="btn sm" data-act="nil-edit" data-pid="${p.id}">Change NIL deal</button>
      <button class="btn sm danger" data-act="cut" data-pid="${p.id}">Release</button>`;
  } else if (inPortal) actions = `<button class="btn sm primary" data-act="portal-offer-open" data-pid="${p.id}">Make an NIL offer</button>`;
  const gp = (p.st && p.st.gp) || 0;
  const header = `${t ? esc(teamName(t)) : inPortal ? 'Transfer portal (from ' + esc(prev ? prev.city : '?') + ')' : 'Free agent'} · ${clsLabel(p)} · ${p.age}y · ${p.home ? 'From ' + p.home : ''}${p.stars ? ' · ' + starsStr(p.stars) + ' recruit' : ''} · ${devLabel(p.dev)} dev${mine ? ` · Potential ${potGrade(p.pot)}` : ''}`;
  modal(`<div class="modal-head pcard" style="--tc:${(t || prev || { c1: '#2a3a34' }).c1}"><div class="shield ${ovrClass(p.ovr)}"><b>${p.ovr}</b><span>OVR</span></div><div class="grow"><div class="row" style="gap:8px"><span class="pos-chip">${p.pos}</span><span class="pos-chip cls">${clsLabel(p)}</span>${p.dev !== 'N' ? `<span class="devb dev-${p.dev}">${devLabel(p.dev)}</span>` : ''}</div><h2 style="margin:4px 0 0">#${p.num} ${esc(pname(p))}</h2><div class="muted small">${header}</div></div><button class="btn sm ghost x" data-act="close">✕</button></div>
    <div class="row small"><span class="pill">NIL deal ${fmtNil(p.con.sal)}/yr</span><span class="pill" title="This game's own estimate">Est. NIL value ${fmtNil(est)}</span>${p.inj ? `<span class="pill red">Injured: ${p.inj} wk</span>` : ''}<span class="pill">Games this year ${gp}${!p.rs && L.phase === 'regular' ? (gp <= 4 ? ' (redshirt still possible)' : ' (redshirt used up)') : ''}</span>${p.cls >= 3 && L.phase !== 'portal' ? `<span class="pill">NFL projection: ${draftGrade(p) <= 7 ? 'Round ' + draftGrade(p) : 'Undrafted'}</span>` : ''}${p.recruitRank ? `<span class="pill">Recruit #${p.recruitRank} nationally</span>` : ''}</div>
    <div class="bars">${bars}</div>
    ${p.st && p.st.gp ? `<div><div class="eyebrow">This season (${p.st.gp} games)</div><div>${statLine(p) || '—'}</div></div>` : ''}
    ${(p.awards || []).length ? `<div class="small"><b>Honors:</b> ${(p.awards || []).map(a => esc(a)).join(' · ')}</div>` : ''}
    ${career ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Season</th><th>Team</th><th class="r">GP</th><th>Stats</th></tr></thead><tbody>${career}</tbody></table></div>` : ''}
    <div class="row">${actions}</div><div class="small" id="negMsg"></div>`);
};
