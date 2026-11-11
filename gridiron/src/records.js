// ============================================================
// Gridiron Dynasty - records, All-Pro teams, Hall of Fame,
// retired numbers
// ============================================================
'use strict';

const REC_STATS = [['py', 'Passing yards'], ['ptd', 'Passing TD'], ['ry', 'Rushing yards'], ['rtd', 'Rushing TD'], ['rec', 'Receptions'], ['rcy', 'Receiving yards'], ['rctd', 'Receiving TD'], ['sk', 'Sacks'], ['dint', 'Interceptions'], ['tk', 'Tackles'], ['fgm', 'Field goals']];

function seasonScore(p) {
  const s = p.st || {};
  if (p.pos === 'QB') return (s.py || 0) / 25 + (s.ptd || 0) * 4 - (s.pint || 0) * 2 + (s.ry || 0) / 10 + (s.rtd || 0) * 6;
  if (['RB', 'WR', 'TE'].includes(p.pos)) return ((s.ry || 0) + (s.rcy || 0)) / 10 + ((s.rtd || 0) + (s.rctd || 0)) * 6;
  if (p.pos === 'OL') return p.ovr * 2 + (s.gp || 0);
  if (p.pos === 'K' || p.pos === 'P') return p.ovr * 2 + (s.fgm || 0);
  return (s.tk || 0) + (s.sk || 0) * 5 + (s.dint || 0) * 6 + (s.pd || 0) * 1.5 + p.ovr * 0.3;
}

// All-Pro team added to each season's awards
const _computeAwardsR = computeAwards;
computeAwards = function (L) {
  _computeAwardsR(L);
  const aw = L.awards[0]; if (!aw) return;
  const all = Object.values(L.players).filter(p => p.tid != null && p.tid >= 0 && p.st && p.st.gp);
  const team = [];
  for (const pos of POSITIONS) {
    const n = pos === 'CB' ? 2 : STARTERS[pos];
    all.filter(p => p.pos === pos).sort((a, b) => seasonScore(b) - seasonScore(a)).slice(0, n).forEach(p => {
      team.push({ id: p.id, name: pname(p), pos, tid: p.tid }); p.allPros = (p.allPros || 0) + 1;
    });
  }
  aw.allpro = team;
  for (const k of ['mvp', 'opoy', 'dpoy', 'roy']) if (aw[k]) { const p = L.players[aw[k].id]; if (p) { p.awards = p.awards || []; p.awards.push(k.toUpperCase() + ' ' + aw.season); } }
};

// archive retirees so records and the Hall of Fame keep them
function careerTotals(career) {
  const t = {}; for (const c of career || []) for (const k in c) if (typeof c[k] === 'number' && k !== 'season') t[k] = (t[k] || 0) + c[k];
  return t;
}
function hofScore(p, tot) {
  const aw = (p.awards || []).join(' ');
  const mvps = (aw.match(/MVP/g) || []).length, poys = (aw.match(/OPOY|DPOY/g) || []).length;
  return (tot.py || 0) / 500 + (tot.ptd || 0) * 0.8 - (tot.pint || 0) * 0.5 + (tot.ry || 0) / 100 + (tot.rtd || 0) * 1.5 + (tot.rcy || 0) / 100 + (tot.rctd || 0) * 1.5
    + (tot.sk || 0) * 2.5 + (tot.dint || 0) * 4 + (tot.tk || 0) * 0.06 + (tot.fgm || 0) * 0.2 + mvps * 30 + poys * 18 + (p.allPros || 0) * 12;
}
const _beginOffR = beginOffseason;
beginOffseason = function (L) {
  const before = new Map(Object.values(L.players).map(p => [p.id, p]));
  _beginOffR(L);
  L.retired = L.retired || [];
  for (const [id, p] of before) {
    if (L.players[id] || p.tid === -1) continue;
    const tot = careerTotals(p.career), seasons = (p.career || []).length;
    if (!seasons) continue;
    const score = hofScore(p, tot), hof = seasons >= 5 && score >= 240 && ((p.allPros || 0) >= 2 || (p.awards || []).length > 0 || score >= 320);
    const teams = [...new Set((p.career || []).map(c => c.tm).filter(t => t && t !== 'FA'))];
    L.retired.push({ id, name: pname(p), pos: p.pos, num: p.num, teams, seasons, tot, career: p.career, awards: p.awards || [], allPros: p.allPros || 0, hof, year: L.season, score: Math.round(score) });
    if (hof) addNews(L, `🏛 Hall of Fame: ${p.pos} ${pname(p)} is inducted in the Class of ${L.season + 1}.`);
  }
  // keep the archive light: all Hall of Famers plus the 300 best careers
  L.retired.sort((a, b) => (b.hof - a.hof) || b.score - a.score);
  if (L.retired.length > 340) L.retired = L.retired.filter((r, i) => r.hof || i < 300);
};

// ---------- Records tab ----------
function viewRecords() {
  const L = LEAGUE, u = UT();
  const active = Object.values(L.players).filter(p => p.tid != null && p.tid >= 0);
  const seasonRows = [];
  for (const p of active) {
    for (const c of p.career || []) seasonRows.push({ name: pname(p), pos: p.pos, season: c.season, tm: c.tm, s: c });
    if (p.st && p.st.gp) seasonRows.push({ name: pname(p), pos: p.pos, season: L.season, tm: L.teams[p.tid].abbr, s: p.st, live: true });
  }
  for (const r of L.retired || []) for (const c of r.career || []) seasonRows.push({ name: r.name, pos: r.pos, season: c.season, tm: c.tm, s: c });
  const careers = active.map(p => ({ name: pname(p), pos: p.pos, tot: (() => { const t = careerTotals(p.career); for (const k in p.st || {}) t[k] = (t[k] || 0) + p.st[k]; return t; })(), active: true }))
    .concat((L.retired || []).map(r => ({ name: r.name, pos: r.pos, tot: r.tot, active: false })));
  const board = (rows, key, val, label) => {
    const top = rows.filter(r => val(r) > 0).sort((a, b) => val(b) - val(a)).slice(0, 5);
    return `<div class="card"><h2>${label}</h2>${top.length ? `<div class="tbl-wrap"><table class="t"><tbody>${top.map((r, i) => `<tr><td class="num muted">${i + 1}</td><td>${esc(r.name)} <span class="muted small">${r.pos}${r.season ? ' · ' + r.season + ' ' + r.tm : r.active ? '' : ' · retired'}${r.live ? ' · in progress' : ''}</span></td><td class="r num"><b>${val(r)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">No stats yet.</p>'}</div>`;
  };
  const tab = REC_TAB;
  const body = tab === 'season' ? REC_STATS.map(([k, n]) => board(seasonRows, k, r => r.s[k] || 0, n)).join('')
    : tab === 'career' ? REC_STATS.map(([k, n]) => board(careers, k, r => r.tot[k] || 0, n)).join('') : '';
  const hof = (L.retired || []).filter(r => r.hof);
  const retiredNums = (L.retiredNums || {})[u.abbr] || [];
  const hofHtml = `<div class="card"><h2>Hall of Fame</h2>${hof.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Class</th><th>Player</th><th>Teams</th><th class="r">Seasons</th><th>Honors</th><th></th></tr></thead><tbody>${hof.map(r => {
      const mine = r.teams.includes(u.abbr), done = retiredNums.some(x => x.num === r.num);
      return `<tr><td>${r.year + 1}</td><td>${r.pos} <b>${esc(r.name)}</b> <span class="muted small">#${r.num}</span></td><td class="small">${r.teams.join(', ')}</td><td class="r">${r.seasons}</td><td class="small">${[...r.awards, r.allPros ? r.allPros + '× All-Pro' : ''].filter(Boolean).join(' · ') || '—'}</td>
        <td>${mine ? (done ? '<span class="pill amber">Number retired</span>' : `<button class="btn sm" data-act="rec-retire" data-id="${r.id}">Retire #${r.num}</button>`) : ''}</td></tr>`; }).join('')}</tbody></table></div>`
    : '<p class="muted small">Nobody yet. Players are inducted when they retire after a great career (5+ seasons of big numbers plus All-Pro teams or awards).</p>'}</div>`;
  const ap = (L.awards || []).find(a => a.allpro);
  const apHtml = ap ? `<div class="card"><h2>${ap.season} All-Pro team</h2><div class="ap-grid">${ap.allpro.map(x => `<div class="ap"><span class="pos-chip">${x.pos}</span> ${esc(x.name)} <span class="muted small">${L.teams[x.tid] ? L.teams[x.tid].abbr : ''}</span></div>`).join('')}</div></div>` : '';
  const numsHtml = retiredNums.length ? `<div class="card"><h2>${esc(u.name)} retired numbers</h2><div class="row">${retiredNums.map(x => `<div class="retnum"><b>${x.num}</b><span>${esc(x.name)}</span></div>`).join('')}</div></div>` : '';
  return `<div class="card row"><h2 class="grow" style="margin:0">Records</h2><div class="seg">${[['season', 'Single season'], ['career', 'Career'], ['hof', 'Hall of Fame']].map(([k, n]) => `<button class="btn sm ${tab === k ? 'primary' : ''}" data-act="rec-tab" data-tab="${k}">${n}</button>`).join('')}</div></div>
    <p class="muted small">Records count games played in this league. They start from your first season.</p>
    ${tab === 'hof' ? numsHtml + hofHtml + apHtml : `<div class="cols">${body}</div>`}`;
}
let REC_TAB = 'season';
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !LEAGUE) return;
  if (el.dataset.act === 'rec-tab') { REC_TAB = el.dataset.tab; renderHub(); }
  if (el.dataset.act === 'rec-retire') {
    const L = LEAGUE, r = (L.retired || []).find(x => x.id === +el.dataset.id); if (!r) return;
    L.retiredNums = L.retiredNums || {}; const abbr = UT().abbr; (L.retiredNums[abbr] = L.retiredNums[abbr] || []).push({ num: r.num, name: r.name });
    addNews(L, `The ${UT().name} retire #${r.num} in honor of ${r.name}.`); save(); renderHub(); toast(`#${r.num} retired.`);
  }
});
