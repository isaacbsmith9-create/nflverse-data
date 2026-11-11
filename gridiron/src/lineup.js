// ============================================================
// Gridiron Dynasty - Adjust Lineup: starters laid out on a field
// as player cards, tap to swap, position-group grades, team needs
// ============================================================
'use strict';

let LU_SIDE = 'off';
// [slot label, depth position, index in depth, left %, top %]
const LU_SLOTS = {
  off: [
    ['WR', 'WR', 0, 6, 22], ['SLOT', 'WR', 2, 22, 30], ['WR', 'WR', 1, 94, 22],
    ['LT', 'OL', 0, 26, 52], ['LG', 'OL', 1, 38, 52], ['C', 'OL', 2, 50, 52], ['RG', 'OL', 3, 62, 52], ['RT', 'OL', 4, 74, 52],
    ['TE', 'TE', 0, 86, 54], ['QB', 'QB', 0, 50, 71], ['RB', 'RB', 0, 50, 88],
  ],
  def: [
    ['CB', 'CB', 0, 7, 62], ['NICKEL', 'CB', 2, 24, 50], ['CB', 'CB', 1, 93, 62],
    ['FS', 'S', 0, 36, 13], ['SS', 'S', 1, 64, 13],
    ['MLB', 'LB', 0, 40, 42], ['WLB', 'LB', 1, 60, 42],
    ['LE', 'DL', 0, 26, 74], ['DT', 'DL', 1, 42, 76], ['DT', 'DL', 2, 58, 76], ['RE', 'DL', 3, 74, 74],
  ],
  st: [['K', 'K', 0, 35, 50], ['P', 'P', 0, 65, 50]],
};
const LU_GROUPS = [
  ['Quarterback', ['QB'], 1], ['Running back', ['RB'], 1], ['Receivers', ['WR', 'TE'], 4], ['Offensive line', ['OL'], 5],
  ['Pass rush', ['DL'], 4], ['Linebackers', ['LB'], 2], ['Secondary', ['CB', 'S'], 5], ['Kicking', ['K', 'P'], 2],
];
function gradeOf(v) { return v >= 90 ? 'A+' : v >= 85 ? 'A' : v >= 81 ? 'B+' : v >= 77 ? 'B' : v >= 73 ? 'C+' : v >= 69 ? 'C' : v >= 64 ? 'D' : 'F'; }
function gradeClass(g) { return g[0] === 'A' ? 'g-a' : g[0] === 'B' ? 'g-b' : g[0] === 'C' ? 'g-c' : 'g-d'; }

function luStarter(L, t, pos, i) {
  // who is listed vs who actually plays (first healthy players by depth)
  const ids = t.depth[pos] || [];
  const listed = ids[i] != null ? L.players[ids[i]] : null;
  const healthy = ids.map(id => L.players[id]).filter(p => !p.inj);
  const plays = healthy[i] || null;
  return { listed, plays };
}

function viewLineup() {
  const L = LEAGUE, t = UT(); fixDepth(L, t);
  const slots = LU_SLOTS[LU_SIDE];
  const card = ([label, pos, i, x, y]) => {
    const { listed, plays } = luStarter(L, t, pos, i);
    const p = listed;
    if (!p) return `<button class="lu-card empty" style="left:${x}%;top:${y}%" data-act="lu-slot" data-pos="${pos}" data-i="${i}"><span class="lu-pos">${label}</span><span class="lu-name">Empty</span><span class="muted small">Sign someone</span></button>`;
    const out = p.inj > 0;
    return `<button class="lu-card ${out ? 'out' : ''} ${p.dev === 'X' ? 'x' : ''}" style="left:${x}%;top:${y}%" data-act="lu-slot" data-pos="${pos}" data-i="${i}">
      <span class="lu-top"><span class="lu-pos">${label}</span><span class="ovr ${ovrClass(p.ovr)}">${p.ovr}</span></span>
      <span class="lu-num">#${p.num}</span>
      <span class="lu-name">${esc(p.first[0])}. ${esc(p.last)}</span>
      ${out ? `<span class="lu-out">OUT ${p.inj}w${plays && plays !== p ? ` · ${esc(plays.last)} plays` : ''}</span>` : p.dev !== 'N' ? `<span class="devb dev-${p.dev}">${p.dev === 'X' ? 'Superstar' : 'Star'}</span>` : `<span class="lu-age">${p.age}y · ${fmtMoney(p.con.sal)}</span>`}
    </button>`;
  };
  // grades
  const lu = lineup(L, t, 0);
  const grades = LU_GROUPS.map(([name, poss, n]) => {
    const ps = poss.flatMap(pos => lu[pos].slice(0, STARTERS[pos]));
    const v = ps.reduce((s, p) => s + p.ovr, 0) / Math.max(1, ps.length);
    const g = gradeOf(v);
    return `<div class="lu-grade"><span class="g ${gradeClass(g)}">${g}</span><span class="grow">${name}</span><span class="muted num">${Math.round(v)}</span></div>`;
  }).join('');
  const needs = POSITIONS.filter(p => p !== 'K' && p !== 'P').map(pos => [pos, needScore(L, t, pos)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const needRows = needs.map(([pos]) => {
    const st = (t.depth[pos] || []).slice(0, STARTERS[pos]).map(id => L.players[id]);
    const avg = st.length ? Math.round(st.reduce((s, p) => s + p.ovr, 0) / st.length) : 0;
    return `<div class="lu-need"><b>${pos}</b><span class="grow muted small">starters avg ${avg || '—'} · ${(t.depth[pos] || []).length} on roster</span>
      <button class="btn sm" data-act="lu-need-trade" data-pos="${pos}">Trade for one</button><button class="btn sm ghost" data-act="lu-need-fa" data-pos="${pos}">Free agents</button></div>`;
  }).join('');
  const o = teamOvr(L, t);
  return `<div class="card stack">
      <div class="row lu-head"><h2 class="grow" style="margin:0">Adjust lineup</h2>
        <div class="seg">${[['off', 'Offense', o.off], ['def', 'Defense', o.def], ['st', 'Special teams', null]].map(([k, n, v]) => `<button class="btn sm ${LU_SIDE === k ? 'primary' : ''}" data-act="lu-side" data-side="${k}">${n}${v ? ` <span class="num">${v}</span>` : ''}</button>`).join('')}</div>
        <button class="btn sm ghost" data-act="lu-auto">Auto-set best lineup</button></div>
      <div class="lu-field ${LU_SIDE}">${LU_SIDE !== 'st' ? '<div class="lu-los"></div>' : ''}${slots.map(card).join('')}</div>
      <div class="muted small">Tap a player to swap in a backup. Injured starters show <b style="color:var(--red)">OUT</b> and the next healthy player at that spot plays.</div>
    </div>
    <div class="cols"><div class="card"><h2>Position grades</h2><div class="stack" style="gap:6px">${grades}</div></div>
      <div class="card"><h2>Biggest needs</h2><div class="stack" style="gap:8px">${needRows}</div></div></div>`;
}

function luSwapModal(pos, i) {
  const L = LEAGUE, t = UT(); fixDepth(L, t);
  const ids = t.depth[pos] || [];
  const cur = ids[i] != null ? L.players[ids[i]] : null;
  const rows = ids.map((id, j) => {
    const p = L.players[id]; const starter = j < STARTERS[pos];
    return `<button class="pickrow lu-pick ${j === i ? 'cur' : ''}" data-act="lu-pick" data-pos="${pos}" data-i="${i}" data-pid="${id}">
      ${ovrTag(p.ovr)}<span class="grow">#${p.num} ${esc(pname(p))} <span class="muted small">${p.age}y${p.inj ? ` · <span class="inj">INJ ${p.inj}w</span>` : ''}${p.dev !== 'N' ? ' · ' + devLabel(p.dev) : ''}</span></span>
      <span class="muted small">${j === i ? 'Current' : starter ? 'Starter #' + (j + 1) : 'Depth #' + (j + 1)}</span></button>`;
  }).join('');
  modal(`<div class="modal-head"><h2>${pos} — ${cur ? 'replace ' + esc(pname(cur)) : 'pick a starter'}</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <div class="stack" style="gap:4px">${rows || '<p class="muted">Nobody at this position. Sign one in Free Agents.</p>'}</div>
    <div class="row"><button class="btn sm ghost" data-act="lu-need-fa" data-pos="${pos}">Find a free agent ${pos}</button><button class="btn sm ghost" data-act="lu-need-trade" data-pos="${pos}">Trade for a ${pos}</button></div>`);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !LEAGUE) return;
  const a = el.dataset.act, L = LEAGUE;
  if (a === 'lu-side') { LU_SIDE = el.dataset.side; renderHub(); }
  else if (a === 'lu-auto') { autoDepth(L, UT()); save(); renderHub(); toast('Best lineup set by overall rating.'); }
  else if (a === 'lu-slot') luSwapModal(el.dataset.pos, +el.dataset.i);
  else if (a === 'lu-pick') {
    const t = UT(), pos = el.dataset.pos, i = +el.dataset.i, pid = +el.dataset.pid;
    const arr = t.depth[pos]; const j = arr.indexOf(pid);
    if (j >= 0 && j !== i) { [arr[i], arr[j]] = [arr[j], arr[i]]; save(); toast(`${pshort(L.players[pid])} is now starting at ${pos}.`); }
    closeModal(); renderHub();
  }
  else if (a === 'lu-need-trade') { TF.mode = 'get'; TF.q = el.dataset.pos; TAB = 'trade'; closeModal(); renderHub(); }
  else if (a === 'lu-need-fa') { FA_FILTER = el.dataset.pos; TAB = 'fa'; closeModal(); renderHub(); }
});
