// ============================================================
// Gridiron Dynasty - Superstar screen: when you play as one player the
// hub only shows what a player cares about. GM tabs (free agents,
// development, contracts...) are hidden unless you switch them back on.
// ============================================================
'use strict';

const SS_TABS = ['home', 'star', 'schedule', 'standings', 'stats', 'rankings', 'records', 'playbook', 'settings'];
const TABS_ALL = TABS.slice();
const ssFocus = L => !!(L && L.superstar && !EXHIB && !(L.settings && L.settings.ssGM));
const _renderHubSSUI = renderHub;
renderHub = function () {
  const L = LEAGUE;
  TABS.length = 0;
  if (ssFocus(L)) {
    const keep = SS_TABS.slice(); if (L.phase === 'draft') keep.splice(2, 0, 'draft');
    for (const t of TABS_ALL) if (keep.includes(t[0])) TABS.push(t[0] === 'star' ? ['star', '⭐ My Player'] : t);
    TABS.splice(1, 0, TABS.splice(TABS.findIndex(t => t[0] === 'star'), 1)[0]);
    if (!TABS.some(t => t[0] === TAB)) TAB = 'star';
    document.body.classList.add('ss-focus');
  } else { TABS.push(...TABS_ALL); document.body.classList.remove('ss-focus'); }
  return _renderHubSSUI();
};
// Home in Superstar mode: your player first
const _viewHomeSSUI = viewHome;
viewHome = function () {
  const L = LEAGUE, base = _viewHomeSSUI();
  if (!ssFocus(L)) return base;
  const p = ssPlayer(L), s = ssS(L); if (!p) return base;
  const st = p.st || {}, last = s.games[0];
  const line = SS_OFF.includes(p.pos) ? (p.pos === 'QB' ? `${st.pc || 0}/${st.pa || 0} · ${st.py || 0} yds · ${st.ptd || 0} TD · ${st.pint || 0} INT` : `${st.rec || 0} rec · ${(st.rcy || 0) + (st.ry || 0)} yds · ${(st.rtd || 0) + (st.rctd || 0)} TD`) : `${st.tk || 0} tkl · ${st.sk || 0} sk · ${st.dint || 0} INT`;
  const card = `<div class="card ss-home" style="--c1:${L.teams[p.tid] ? L.teams[p.tid].c1 : '#333'}"><div class="ss-num">${p.num}</div><div class="grow"><div class="eyebrow">${esc(s.arch || p.pos)} · ${p.pos}</div><div class="hub-title" style="font-size:26px">${esc(pname(p))}</div>
    <div class="small">${L.season}: ${line}${last ? ` · last game <b class="grade g${last.grade[0]}">${last.grade}</b>` : ''}</div>
    <div class="ssmeter" style="max-width:420px"><span>Coach trust</span><div class="ssm-track"><div class="ssm-fill" style="width:${s.trust}%"></div></div><b>${Math.round(s.trust)}</b></div></div>
    <div class="ring big" style="--v:${p.ovr}"><b>${p.ovr}</b><span>OVR</span></div></div>`;
  // drop the GM-only cards (key starters / league news stay)
  return card + base.replace(/<div class="card"><h2>Key starters<\/h2>[\s\S]*?<\/table><\/div><\/div>/, '');
};
// toggle in My Player and Settings
const _viewStarSSUI = viewStar;
viewStar = function () {
  const L = LEAGUE, h = _viewStarSSUI();
  if (!ssPlayer(L)) return h;
  return h + `<div class="card row"><label class="row grow" style="gap:8px"><input type="checkbox" data-act="ss-gm" ${L.settings.ssGM ? 'checked' : ''}> <b>Show GM tools</b> <span class="muted small">— roster, free agents, development, contracts, trades and more</span></label></div>`;
};
document.addEventListener('change', e => {
  if (e.target.dataset && e.target.dataset.act === 'ss-gm' && LEAGUE) { LEAGUE.settings.ssGM = e.target.checked; save(); renderHub(); toast(e.target.checked ? 'GM tools shown.' : 'Player view: GM tools hidden.'); }
});
// the front office handles the roster for you when GM tools are hidden
const _simWeekSSUI = simWeek;
simWeek = function (L, inc) { if (ssFocus(L)) { const t = L.teams[L.userTid]; autoDepth(L, t); const p = ssPlayer(L); if (p && !p.inj) t.depth[p.pos] = [p.id, ...t.depth[p.pos].filter(id => id !== p.id)]; } return _simWeekSSUI(L, inc); };
