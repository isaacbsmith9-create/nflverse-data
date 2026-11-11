// ============================================================
// Gridiron Dynasty - playbook maker. Design your own plays: pick a
// formation, tap a player, tap the field to draw his route. Saved plays
// show up in the play-call screen under "My Plays".
// ============================================================
'use strict';

const CP_KEY = 'gd_custom_plays';
const CP_SKILL = ['WR1', 'WR2', 'WR3', 'TE', 'RB'];
const CP_TYPES = [['pass', 'Pass'], ['run', 'HB Run'], ['qbrun', 'QB Run']];
const CP_FORM_NAMES = { wildcat: 'Wildcat', gun: 'Shotgun', single: 'Under center', trips: 'Trips', pistol: 'Pistol', empty: 'Empty', bunch: 'Bunch', iform: 'I-Form', tight: 'Tight' };

// custom routes are objects: { pts: [[dx, dy] offsets from the player's start], stop }
const _routePtsCP = LiveGame.prototype.routePts;
LiveGame.prototype.routePts = function (name, sx, sy, by) {
  if (name && typeof name === 'object') {
    const n = name.pts.length;
    return name.pts.map(([dx, dy], i) => [sx + dx, clamp(sy + dy, 1, FIELD_W - 1), i === n - 1 && name.stop ? 's' : undefined]);
  }
  return _routePtsCP.call(this, name, sx, sy, by);
};

// the CPU never calls your custom plays
const _cpuOffCallCP = cpuOffCall;
cpuOffCall = function (gs) {
  for (let i = 0; i < 6; i++) { const p = _cpuOffCallCP(gs); if (!p || p.cat !== 'My Plays') return p; }
  return OFF_PLAYS.find(p => p.id === 'curlflat');
};

function cpLoad() { try { return JSON.parse(localStorage.getItem(CP_KEY) || '[]') || []; } catch (e) { return []; } }
function cpStore(list) { try { localStorage.setItem(CP_KEY, JSON.stringify(list)); } catch (e) { toast('Could not save (storage blocked).'); } }
const stepsOf = pts => pts.map(([x, y], i) => i ? [x - pts[i - 1][0], y - pts[i - 1][1]] : [x, y]);

// turn a saved design into a real play the engine can run
function cpCompile(d) {
  const forms = FORMS[d.form] ? d.form : 'gun';
  const p = { id: d.id, name: d.name || 'My Play', cat: 'My Plays', type: d.type, form: forms, custom: true, routes: {}, desc: '' };
  const draw = d.draw || {};
  if (d.type === 'pass') {
    for (const k of CP_SKILL) {
      const a = d.assign[k] || 'block';
      if (a === 'custom') p.routes[k] = draw[k] && draw[k].length ? { pts: draw[k], stop: !!(d.stop || {})[k] } : 'block';
      else p.routes[k] = a;
    }
    if (d.pa) p.pa = true;
    const n = CP_SKILL.filter(k => p.routes[k] !== 'block').length;
    p.desc = `${d.pa ? 'Play-action. ' : ''}${n} receiver${n === 1 ? '' : 's'} out${CP_SKILL.some(k => typeof p.routes[k] === 'object') ? ', hand-drawn routes' : ''}.`;
  } else if (d.type === 'run') {
    p.path = draw.RB && draw.RB.length ? stepsOf(draw.RB) : [[1.5, 0], [4, 1.2], [10, 1.6]];
    p.desc = 'Your custom run design.';
  } else {
    p.type = 'qbrun';
    p.qbPath = draw.QB && draw.QB.length ? stepsOf(draw.QB) : [[1.2, 0], [5, 0]];
    if (draw.RB && draw.RB.length) p.path = stepsOf(draw.RB);
    for (const k of ['WR1', 'WR2', 'WR3', 'TE']) { const a = d.assign[k]; if (a === 'custom' && draw[k] && draw[k].length) p.routes[k] = { pts: draw[k], stop: !!(d.stop || {})[k] }; else if (a && a !== 'block' && a !== 'custom') p.routes[k] = a; }
    p.desc = 'Designed QB run.';
  }
  if (forms === 'wildcat') { // direct snap to the RB; the QB is split out as a receiver
    p.directSnap = 'RB'; p.fakeRun = true;
    if (p.type === 'pass') {
      p.type = 'trick'; p.path = [[0.6, 1.5], [-0.4, 0.5]]; delete p.routes.RB;
      const a = d.assign.QB || 'block';
      if (a === 'custom' && draw.QB && draw.QB.length) p.routes.QB = { pts: draw.QB, stop: !!(d.stop || {}).QB };
      else if (a !== 'block' && a !== 'custom') p.routes.QB = a;
    } else { p.type = 'trick'; p.directNoPass = true; delete p.qbPath; p.path = draw.RB && draw.RB.length ? stepsOf(draw.RB) : [[0.6, 0.8], [1.6, 2.2], [12, 3]]; }
  }
  return p;
}
function cpInstall() {
  for (let i = OFF_PLAYS.length - 1; i >= 0; i--) if (OFF_PLAYS[i].custom) OFF_PLAYS.splice(i, 1);
  for (const d of cpLoad()) { try { OFF_PLAYS.push(cpCompile(d)); } catch (e) { /* skip a broken design */ } }
}
cpInstall();

// ---------- playbook tab ----------
let CP_EDIT = null; // the design being edited
const CP_SEL = { who: 'WR1' };
function cpNew() {
  return { id: 'cp_' + Date.now().toString(36), name: 'New play', type: 'pass', form: 'gun', pa: false,
    assign: { WR1: 'go', WR2: 'custom', WR3: 'slant', TE: 'block', RB: 'block' }, draw: {}, stop: {} };
}
function viewPlaybook() {
  if (CP_EDIT) return cpEditor();
  const list = cpLoad();
  return `<div class="card row"><div class="grow"><h2 style="margin:0">My Playbook</h2><div class="muted small">Draw your own plays. They show up in the play-call screen under <b>My Plays</b>.</div></div>
    <button class="btn primary" data-act="cp-new">+ New play</button></div>
    ${list.length ? `<div class="cp-list">${list.map(d => { const p = cpCompile(d); return `<div class="play cp-card">${playSVG(p, 'off')}<span class="tag">${CP_TYPES.find(t => t[0] === d.type)[1]} · ${CP_FORM_NAMES[d.form] || d.form}</span><span class="pn">${esc(p.name)}</span><span class="pd">${esc(p.desc)}</span>
      <div class="row"><button class="btn sm" data-act="cp-edit" data-id="${d.id}">Edit</button><button class="btn sm" data-act="cp-copy" data-id="${d.id}">Copy</button><button class="btn sm ghost" data-act="cp-del" data-id="${d.id}">Delete</button></div></div>`; }).join('')}</div>`
    : `<div class="card"><p>No custom plays yet. Hit <b>New play</b>, pick a formation, then tap a player and tap the field to draw his route.</p></div>`}`;
}

// field drawing: offense goes up; svg 100 wide, LOS at y=52
const CPY = dx => 52 - dx * 1.6, CPX = y => (y / FIELD_W) * 100;
function cpWho(d) { if (d.form === 'wildcat') return d.type === 'pass' ? ['QB', 'WR1', 'WR2', 'WR3', 'TE'] : ['RB']; return d.type === 'run' ? ['RB'] : d.type === 'qbrun' ? ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE'] : CP_SKILL; }
function cpStart(d, k) { const F = FORMS[d.form] || FORMS.gun; return [F[k][0], MID_Y + F[k][1]]; }
function cpEditor() {
  const d = CP_EDIT, F = FORMS[d.form] || FORMS.gun, who = cpWho(d);
  if (!who.includes(CP_SEL.who)) CP_SEL.who = who[0];
  const col = { WR1: RCOL[0], WR2: RCOL[1], WR3: RCOL[2], TE: RCOL[3], RB: RCOL[4], QB: '#ffb81c' };
  const p = cpCompile(d);
  let s = `<svg id="cpField" viewBox="0 0 100 74" class="cp-field">`;
  for (let yd = -5; yd <= 30; yd += 5) s += `<line x1="0" x2="100" y1="${CPY(yd)}" y2="${CPY(yd)}" stroke="rgba(255,255,255,${yd === 0 ? 0 : .18})" stroke-width=".35"/>${yd > 0 ? `<text x="1" y="${CPY(yd) - .6}" font-size="2.4" fill="rgba(255,255,255,.5)">+${yd}</text>` : ''}`;
  s += `<line x1="0" x2="100" y1="${CPY(0)}" y2="${CPY(0)}" stroke="rgba(120,180,255,.9)" stroke-width=".6"/>`;
  for (const hy of [HASH_L, HASH_R]) for (let yd = -10; yd <= 30; yd++) s += `<line x1="${CPX(hy) - .6}" x2="${CPX(hy) + .6}" y1="${CPY(yd)}" y2="${CPY(yd)}" stroke="rgba(255,255,255,.3)" stroke-width=".25"/>`;
  for (const dy of OL_DY) s += `<circle cx="${CPX(MID_Y + dy)}" cy="${CPY(-0.8)}" r="1.5" fill="#ccc"/>`;
  const line = (k, pts, c, dash) => `<polyline fill="none" stroke="${c}" stroke-width="${k === CP_SEL.who ? 1.1 : .7}" ${dash ? 'stroke-dasharray="2 1.2"' : ''} stroke-linejoin="round" points="${pts.map(([a, b]) => `${CPX(clamp(b, 0, FIELD_W)).toFixed(1)},${clamp(CPY(a), 0, 74).toFixed(1)}`).join(' ')}"/>`;
  const all = ['QB', ...CP_SKILL];
  for (const k of all) {
    const [sx, sy] = cpStart(d, k);
    let pts = null, dash = false;
    if (k === 'QB') { if (p.routes.QB && p.routes.QB !== 'block') pts = LiveGame.prototype.routePts.call(null, p.routes.QB, sx, sy, MID_Y); else if (p.qbPath) { pts = LiveGame.prototype.routePts.call(null, { pts: cpCum(p.qbPath) }, sx, sy, MID_Y); dash = true; } }
    else if (p.routes[k] && p.routes[k] !== 'block') pts = LiveGame.prototype.routePts.call(null, p.routes[k], sx, sy, MID_Y);
    else if (k === 'RB' && p.path) pts = LiveGame.prototype.routePts.call(null, { pts: cpCum(p.path) }, sx, sy, MID_Y);
    if (pts) {
      s += line(k, [[sx, sy], ...pts], col[k], dash);
      const last = pts[pts.length - 1];
      if (last) s += (last[2] === 's' ? `<rect x="${CPX(last[1]) - 1}" y="${CPY(last[0]) - 1}" width="2" height="2" fill="${col[k]}"/>` : `<circle cx="${CPX(last[1])}" cy="${CPY(last[0])}" r=".8" fill="${col[k]}"/>`);
    } else if (k !== 'QB') s += `<line x1="${CPX(sy) - 1.4}" x2="${CPX(sy) + 1.4}" y1="${CPY(sx) - 2.4}" y2="${CPY(sx) - 2.4}" stroke="#bbb" stroke-width=".6"/>`;
    const on = k === CP_SEL.who, can = who.includes(k);
    s += `<g class="${can ? 'cp-pick' : ''}" data-who="${k}"><circle cx="${CPX(sy)}" cy="${CPY(sx)}" r="${on ? 2.6 : 2}" fill="${col[k]}" stroke="${on ? '#fff' : '#111'}" stroke-width="${on ? .7 : .3}" opacity="${can ? 1 : .55}"/><text x="${CPX(sy)}" y="${CPY(sx) + 4.6}" font-size="2.3" text-anchor="middle" fill="#fff" font-weight="700">${k}</text></g>`;
  }
  s += `</svg>`;
  const wcQB = d.form === 'wildcat' && d.type === 'pass';
  const sel = CP_SEL.who, a = sel === 'QB' && !wcQB ? 'custom' : (d.assign[sel] || (d.type === 'pass' ? 'block' : 'custom'));
  const presets = (d.type === 'pass' && (sel !== 'QB' || wcQB)) || (d.type === 'qbrun' && d.form !== 'wildcat' && sel !== 'QB' && sel !== 'RB') ? `<label>Route <select data-cp="assign">${[['custom', '✏️ Draw my own'], ['block', 'Block'], ...Object.keys(ROUTES).map(r => [r, r[0].toUpperCase() + r.slice(1)])].map(([v, n]) => `<option value="${v}" ${a === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : '';
  const drawn = (d.draw[sel] || []).length;
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">Playbook maker</h2><button class="btn sm ghost" data-act="cp-cancel">Cancel</button><button class="btn sm primary" data-act="cp-save">Save play</button></div>
    <div class="cp-form">
      <label>Name <input data-cp="name" maxlength="28" value="${esc(d.name)}"></label>
      <label>Type <select data-cp="type">${CP_TYPES.map(([v, n]) => `<option value="${v}" ${d.type === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Formation <select data-cp="form">${Object.keys(FORMS).map(f => `<option value="${f}" ${d.form === f ? 'selected' : ''}>${CP_FORM_NAMES[f] || f}</option>`).join('')}</select></label>
      ${d.type === 'pass' ? `<label class="row" style="gap:6px"><input type="checkbox" data-cp="pa" ${d.pa ? 'checked' : ''}> Play-action fake</label>` : ''}
    </div></div>
    <div class="cp-wrap"><div class="card cp-board">${s}<div class="muted small" style="margin-top:6px">${d.type === 'run' ? 'Tap the field to draw the running back\'s path.' : d.type === 'qbrun' ? 'Pick QB to draw his run. RB and receivers can lead block or run decoy routes.' : 'Tap a player, then tap the field to add route points. Each tap adds a cut.'}</div></div>
    <div class="card cp-side"><h2>${sel}${sel !== 'QB' ? ' · ' + esc(pname(cpPlayerFor(sel)) || '') : ''}</h2>
      <div class="row cp-who">${cpWho(d).map(k => `<button class="btn sm ${k === sel ? 'primary' : ''}" data-act="cp-who" data-who="${k}">${k}</button>`).join('')}</div>
      ${presets}
      ${a === 'custom' ? `<p class="small">${drawn ? `${drawn} point${drawn === 1 ? '' : 's'} drawn.` : 'Tap the field to start drawing.'}</p>
        <div class="row"><button class="btn sm" data-act="cp-undo" ${drawn ? '' : 'disabled'}>Undo point</button><button class="btn sm ghost" data-act="cp-clear" ${drawn ? '' : 'disabled'}>Clear</button></div>
        ${d.type !== 'run' && (sel !== 'QB' || wcQB) && sel !== 'RB' || (d.type === 'pass' && sel === 'RB') ? `<label class="row" style="gap:6px;margin-top:8px"><input type="checkbox" data-cp="stop" ${(d.stop || {})[sel] ? 'checked' : ''}> Sit down at the end (hook / curl)</label>` : ''}` : ''}
      <p class="muted small" style="margin-top:12px">Tips: a sharp cut works best 5+ yards apart. Routes over 40 yards get cut off. The CPU won't use your plays — they're yours.</p>
    </div></div>`;
}
const cpCum = steps => { let x = 0, y = 0; return steps.map(([a, b]) => [x += a, y += b]); };
function cpPlayerFor(k) {
  try { const lu = lineup(LEAGUE, UT(), 0); const m = { WR1: lu.WR[0], WR2: lu.WR[1], WR3: lu.WR[2], TE: lu.TE[0], RB: lu.RB[0], QB: lu.QB[0] }; return m[k] || { first: '', last: '' }; } catch (e) { return { first: '', last: '' }; }
}
function cpRender() { if (typeof renderHub === 'function' && LEAGUE) { const sy = window.scrollY; renderHub(); window.scrollTo(0, sy); } }
function cpTap(ev, svg) {
  const d = CP_EDIT, k = CP_SEL.who; if (!d || !cpWho(d).includes(k)) return;
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const m = svg.getScreenCTM(); if (!m) return;
  const q = pt.matrixTransform(m.inverse());
  const dx = (52 - q.y) / 1.6, y = clamp(q.x / 100 * FIELD_W, 1, FIELD_W - 1);
  const [sx, sy] = cpStart(d, k);
  const arr = d.draw[k] = d.draw[k] || [];
  if (arr.length >= 8) { toast('Max 8 points per route.'); return; }
  const prev = arr.length ? arr[arr.length - 1] : [0, 0];
  const o = [Math.round(clamp(dx - sx, -12, 45) * 2) / 2, Math.round((y - sy) * 2) / 2];
  if (Math.hypot(o[0] - prev[0], o[1] - prev[1]) < 1) return;
  arr.push(o);
  if (k !== 'QB' || (d.form === 'wildcat' && d.type === 'pass')) d.assign[k] = 'custom';
  cpRender();
}
document.addEventListener('click', e => {
  const svg = e.target.closest && e.target.closest('#cpField');
  if (svg && CP_EDIT) {
    const g = e.target.closest('[data-who]');
    if (g && g.classList.contains('cp-pick') && g.dataset.who !== CP_SEL.who) { CP_SEL.who = g.dataset.who; cpRender(); return; }
    cpTap(e, svg); return;
  }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act; if (!act.startsWith('cp-')) return;
  const list = cpLoad();
  if (act === 'cp-new') { CP_EDIT = cpNew(); CP_SEL.who = 'WR2'; }
  else if (act === 'cp-edit') { const d = list.find(x => x.id === el.dataset.id); if (d) CP_EDIT = JSON.parse(JSON.stringify(d)); }
  else if (act === 'cp-copy') { const d = list.find(x => x.id === el.dataset.id); if (d) { const c = JSON.parse(JSON.stringify(d)); c.id = 'cp_' + Date.now().toString(36); c.name = (d.name + ' 2').slice(0, 28); list.push(c); cpStore(list); cpInstall(); } }
  else if (act === 'cp-del') { if (!confirm('Delete this play?')) return; cpStore(list.filter(x => x.id !== el.dataset.id)); cpInstall(); toast('Play deleted.'); }
  else if (act === 'cp-cancel') CP_EDIT = null;
  else if (act === 'cp-who') CP_SEL.who = el.dataset.who;
  else if (act === 'cp-undo') { const a = CP_EDIT.draw[CP_SEL.who]; if (a) a.pop(); }
  else if (act === 'cp-clear') CP_EDIT.draw[CP_SEL.who] = [];
  else if (act === 'cp-save') {
    const d = CP_EDIT; d.name = (d.name || '').trim() || 'My Play';
    if (d.type === 'pass' && !CP_SKILL.some(k => d.assign[k] !== 'block' && (d.assign[k] !== 'custom' || (d.draw[k] || []).length))) { toast('Give at least one player a route.'); return; }
    const i = list.findIndex(x => x.id === d.id); if (i >= 0) list[i] = d; else list.push(d);
    cpStore(list); cpInstall(); CP_EDIT = null; toast(`"${d.name}" saved to your playbook.`);
  }
  cpRender();
});
document.addEventListener('change', e => {
  const el = e.target.closest && e.target.closest('[data-cp]'); if (!el || !CP_EDIT) return;
  const k = el.dataset.cp, d = CP_EDIT;
  if (k === 'name') { d.name = el.value.slice(0, 28); return; }
  if (k === 'type') { d.type = el.value; CP_SEL.who = d.type === 'pass' ? 'WR1' : d.type === 'run' ? 'RB' : 'QB'; }
  if (k === 'form') { d.form = el.value; if (d.form === 'wildcat' && d.type === 'qbrun') d.type = 'run'; }
  if (k === 'pa') d.pa = el.checked;
  if (k === 'assign') { d.assign[CP_SEL.who] = el.value; }
  if (k === 'stop') { d.stop = d.stop || {}; d.stop[CP_SEL.who] = el.checked; }
  cpRender();
});
document.addEventListener('input', e => { const el = e.target.closest && e.target.closest('[data-cp="name"]'); if (el && CP_EDIT) CP_EDIT.name = el.value.slice(0, 28); });
