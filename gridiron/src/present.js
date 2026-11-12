// ============================================================
// Gridiron Dynasty - presentation: play-by-play commentary ticker,
// halftime report, fuller postgame box score, instant replay,
// power rankings + playoff bracket, shareable custom plays.
// ============================================================
'use strict';

// ---------------- commentary ----------------
const CALL_LINES = {
  td: ['TOUCHDOWN! {who} finds the end zone!', 'He is IN! Six for {team}!', 'Nobody touches {who} — touchdown {team}!', 'What a finish — {who} takes it to the house!'],
  bigpass: ['{qb} lets it fly… CAUGHT! {who} for {y}!', 'Dime from {qb}! {who} hauls it in for {y}.', 'Big strike downfield — {y} yards to {who}.'],
  pass: ['{qb} hits {who} for {y}.', 'Quick throw to {who}, picks up {y}.', '{who} with the grab, {y} yards.', 'Completion, {qb} to {who}.'],
  bigrun: ['{who} breaks free! {y} yards on the run!', 'Daylight for {who} — {y} yards!', '{who} bounces it outside and he is GONE for {y}!'],
  run: ['{who} pounds ahead for {y}.', '{who} on the carry, {y} yards.', 'Handoff to {who}, he picks up {y}.'],
  stuff: ['{who} is stuffed at the line.', 'Nowhere to go for {who}.', 'Met in the backfield — {who} loses ground.'],
  sack: ['SACKED! The pocket collapses on {qb}.', '{qb} goes down — the rush gets home!', 'No time to throw — {qb} is buried.'],
  inc: ['Incomplete. {qb} couldn\'t connect.', 'Thrown behind the receiver — incomplete.', 'Broken up! Incomplete pass.', 'Off the fingertips. Incomplete.'],
  int: ['PICKED OFF! {who} jumps the route!', 'Interception! {who} reads it all the way!', '{qb} throws it right to {who}! Turnover!'],
  flag: ['Flag on the play — {t}.', 'Yellow laundry: {t}.'],
  fumble: ['FUMBLE! The ball is loose — and the defense has it!', 'He coughs it up! Turnover!'],
  ret: ['{t}.', 'The return: {t}.'],
};
function callLine(k, v) { return pick(CALL_LINES[k]).replace(/\{(\w+)\}/g, (_, x) => v[x] != null ? v[x] : ''); }
function commentFor(lg, b) {
  const gs = lg.gs, t = b.title || '', s = b.sub || '';
  const team = teamAbbr(gs, gs.poss), qb = gs.lu[gs.poss].QB[0] ? pshort(gs.lu[gs.poss].QB[0]) : 'The QB';
  const y = (t.match(/[-+]?\d+/) || [''])[0].replace('+', '');
  const who = (s.match(/to (.+)$/) || s.match(/^(.+?) (run|scramble|picks|coughs|takes)/) || [, s.split(' ')[0]])[1];
  if (/^FLAG/.test(t)) return callLine('flag', { t: t.replace('FLAG: ', '') });
  if (/TOUCHDOWN|RETURN TD/.test(t)) return callLine('td', { who: who || 'He', team });
  if (/INTERCEPTION|PICK SIX/.test(t)) return callLine('int', { who: (s.match(/^(.+?) picks/) || [, 'the defender'])[1], qb });
  if (/FUMBLE/.test(t)) return callLine('fumble', {});
  if (/SACKED/.test(t)) return callLine('sack', { qb });
  if (/Incomplete|Thrown away/.test(t)) return callLine('inc', { qb });
  if (/Pass complete/.test(t)) return callLine(+y >= 20 ? 'bigpass' : 'pass', { qb, who, y: y + (Math.abs(+y) === 1 ? ' yard' : ' yards') });
  if (/Gain of|Loss of/.test(t)) { const n = /Loss/.test(t) ? -y : +y; return callLine(n >= 15 ? 'bigrun' : n <= 0 ? 'stuff' : 'run', { who, y: Math.abs(n) + (Math.abs(n) === 1 ? ' yard' : ' yards') }); }
  if (/Return|Fair catch|Touchback/.test(t)) return callLine('ret', { t: t + (s ? ' — ' + s : '') });
  return t + (s ? ' — ' + s : '');
}
const _showBannerP = showBanner;
showBanner = function (b) {
  _showBannerP(b);
  if (!GAME) return;
  const el = document.getElementById('ticker'); if (!el) return;
  el.textContent = '🎙 ' + commentFor(GAME.live, b); el.hidden = false;
  clearTimeout(showBanner._tk); showBanner._tk = setTimeout(() => el.hidden = true, 4200);
};

// ---------------- halftime ----------------
function statTable(gs) {
  const L = LEAGUE, tm = s => L.teams[gs.tids[s]], ts = gs.tstats;
  const rows = [['Total yards', s => ts[s].yds], ['Passing', s => ts[s].pass], ['Rushing', s => ts[s].rush], ['First downs', s => ts[s].fd], ['Turnovers', s => ts[s].to], ['Penalties', s => gs.pens ? `${gs.pens[s][0]}-${gs.pens[s][1]}` : '0-0'], ['Timeouts left', s => gs.timeouts ? gs.timeouts[s] : '-']];
  return `<table class="t box"><thead><tr><th></th><th class="r">${esc(tm(1).abbr)}</th><th class="r">${esc(tm(0).abbr)}</th></tr></thead><tbody>${rows.map(([n, f]) => `<tr><td>${n}</td><td class="r num">${f(1)}</td><td class="r num">${f(0)}</td></tr>`).join('')}</tbody></table>`;
}
function leadersHTML(gs) {
  const L = LEAGUE, rows = [];
  for (const side of [1, 0]) {
    const ids = Object.keys(gs.box).map(Number).filter(id => { const p = L.players[id]; return p && p.tid === gs.tids[side]; });
    const best = k => ids.map(id => [L.players[id], gs.box[id]]).filter(x => x[1][k]).sort((a, b) => b[1][k] - a[1][k])[0];
    const q = best('py'), r = best('ry'), w = best('rcy'), d = best('tk');
    rows.push(`<div><b>${esc(L.teams[gs.tids[side]].abbr)}</b>${q ? `<div class="small">${esc(pshort(q[0]))} ${q[1].pc || 0}/${q[1].pa || 0} ${q[1].py} yds ${q[1].ptd || 0} TD</div>` : ''}${r ? `<div class="small">${esc(pshort(r[0]))} ${r[1].ra} car ${r[1].ry} yds</div>` : ''}${w ? `<div class="small">${esc(pshort(w[0]))} ${w[1].rec} rec ${w[1].rcy} yds</div>` : ''}${d ? `<div class="small">${esc(pshort(d[0]))} ${d[1].tk} tkl${d[1].sk ? ' ' + d[1].sk + ' sk' : ''}</div>` : ''}</div>`);
  }
  return `<div class="cols">${rows.join('')}</div>`;
}
const _nextHalf = LiveGame.prototype.next;
LiveGame.prototype.next = function () {
  const gs = this.gs;
  if (this.user >= 0 && !gs.over && gs.quarter === 3 && !this._halfShown && typeof GAME !== 'undefined' && GAME && GAME.live === this) {
    this._halfShown = true;
    const L = LEAGUE, tm = s => L.teams[gs.tids[s]];
    const el = document.getElementById('halftime');
    if (el) {
      el.innerHTML = `<div class="final-inner wrap"><div class="eyebrow" style="text-align:center">Halftime</div>
        <div class="final-score"><div>${badge(tm(1), 'lg')}</div><div class="big">${gs.score[1]} – ${gs.score[0]}</div><div>${badge(tm(0), 'lg')}</div></div>
        <div class="cols"><div class="card"><h2>Team stats</h2>${statTable(gs)}</div><div class="card"><h2>First-half leaders</h2>${leadersHTML(gs)}</div></div>
        <div style="text-align:center"><button class="btn primary" data-act="half-go">Start the second half</button></div></div>`;
      el.hidden = false; GAME.paused = true; this._halfWait = true;
      return;
    }
  }
  return _nextHalf.call(this);
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.dataset.act === 'half-go' && GAME) { document.getElementById('halftime').hidden = true; GAME.paused = false; GAME.live._halfWait = false; GAME.live.next(); }
  if (el.dataset.act === 'replay' && GAME) GAME.live.startReplay();
  if (el.dataset.act === 'onside-toggle' && GAME) { const g = GAME.gs, u = GAME.live.user; g.onside[u] = !g.onside[u]; toast(g.onside[u] ? 'Onside kick ON for your next kickoff.' : 'Onside kick off.'); showPlayCall(GAME.live.userOnOffense() ? 'off' : 'def'); }
});

// fuller postgame
const _showFinalP = showFinal;
showFinal = function () {
  _showFinalP();
  const gs = GAME.gs, inner = document.querySelector('#final .final-inner'); if (!inner) return;
  const btn = inner.querySelector('[data-act="game-continue"]');
  const box = document.createElement('div'); box.className = 'cols';
  box.innerHTML = `<div class="card"><h2>Box score</h2>${statTable(gs)}${gs.weather ? `<p class="muted small">${wxLabel(gs)}</p>` : ''}</div><div class="card"><h2>Game leaders</h2>${leadersHTML(gs)}</div>`;
  if (btn) btn.parentNode.parentNode.insertBefore(box, btn.parentNode); else inner.appendChild(box);
};

// ---------------- instant replay ----------------
const LRP = LiveGame.prototype;
const _liveStepRP = LRP.liveStep;
LRP.liveStep = function (dt) {
  if (this.t < dt * 1.5 || !this.rec) this.rec = [];
  const r = _liveStepRP.call(this, dt);
  if (this.rec.length < 1400) {
    const b = this.ball;
    this.rec.push({ e: this.ents.map(e => [e.x, e.y, e.vx, e.vy]), b: b ? [b.x, b.y, b.z, b.state, this.ents.indexOf(b.holder), b.tx, b.ty] : null, t: this.t });
  }
  return r;
};
const _resultRP = LRP.result;
LRP.result = function (title, sub, big) {
  _resultRP.call(this, title, sub, big);
  const worth = big || /SACK|INTERCEPT|FUMBLE|FLAG|Return of [4-9]\d/.test(title) || /(\+|Gain of |Return of )(1[5-9]|[2-9]\d)/.test(title);
  this.canReplay = !!(worth && this.rec && this.rec.length > 30 && this.user >= 0);
  const btn = document.getElementById('replayBtn'); if (btn) btn.hidden = !this.canReplay;
};
LRP.startReplay = function () {
  if (!this.canReplay || this.phase !== 'post') return;
  this.canReplay = false; const rb = document.getElementById('replayBtn'); if (rb) rb.hidden = true;
  this.replay = { i: 0, f: 0, save: this.ents.map(e => [e.x, e.y, e.vx, e.vy]), ball: this.ball ? Object.assign({}, this.ball) : null };
  this.phase = 'replay'; this.h.toast && this.h.toast('▶ Instant replay (press SPACE to skip)');
};
const _updateRP = LRP.update;
LRP.update = function (dt) {
  if (this.phase !== 'replay') { const r = _updateRP.call(this, dt); if (this.phase !== 'post') { const btn = document.getElementById('replayBtn'); if (btn && !btn.hidden && this.phase !== 'post') btn.hidden = true; } return r; }
  const rp = this.replay; rp.f += dt * 30; // half speed (recorded at 60/s)
  const fr = this.rec[Math.min(this.rec.length - 1, Math.floor(rp.f))];
  fr.e.forEach((v, i) => { const e = this.ents[i]; if (e) { e.x = v[0]; e.y = v[1]; e.vx = v[2]; e.vy = v[3]; } });
  if (fr.b && this.ball) { const b = this.ball; b.x = fr.b[0]; b.y = fr.b[1]; b.z = fr.b[2]; b.state = fr.b[3] === 'air' || fr.b[3] === 'pitch' ? fr.b[3] : 'held'; b.holder = this.ents[fr.b[4]] || b.holder; b.tx = fr.b[5]; b.ty = fr.b[6]; }
  const k = 1 - Math.exp(-dt * 4); const tx = this.ball ? this.ball.x : this.cam.x; this.cam.x += (tx - this.cam.x) * k; if (this.ball) this.cam.y += (this.ball.y - this.cam.y) * k;
  if (rp.f >= this.rec.length + 20 || this.input.actionEdge) {
    this.input.actionEdge = false;
    rp.save.forEach((v, i) => { const e = this.ents[i]; if (e) { e.x = v[0]; e.y = v[1]; e.vx = v[2]; e.vy = v[3]; } });
    if (rp.ball) this.ball = rp.ball;
    this.replay = null; this.phase = 'post'; this.postT = 99; // continue to the next play
  }
};

// ---------------- power rankings + playoff bracket ----------------
function powerRanks(L) {
  return L.teams.map(t => {
    const gp = t.w + t.l + t.t, wp = gp ? (t.w + t.t * 0.5) / gp : 0.5, pd = gp ? (t.pf - t.pa) / gp : 0, o = teamOvr(L, t).ovr;
    return { t, score: wp * 60 + pd * 1.1 + o * 0.55 * (gp < 4 ? 1.4 : 1) };
  }).sort((a, b) => b.score - a.score);
}
const _simWeekPR = simWeek;
simWeek = function (L, inc) {
  const wk = L.week, ph = L.phase;
  if (ph === 'regular') L.prPrev = Object.fromEntries(powerRanks(L).map((r, i) => [r.t.id, i + 1]));
  return _simWeekPR(L, inc);
};
function prBlurb(L, r, i, mv) {
  const t = r.t, gp = t.w + t.l + t.t;
  if (!gp) return `Preseason: ${teamOvr(L, t).ovr} OVR roster.`;
  const pd = t.pf - t.pa;
  if (mv >= 4) return pick(['Surging — the hottest team in football.', 'Big jump after a statement week.', 'Rocketing up the board.']);
  if (mv <= -4) return pick(['Free fall. Something has to change.', 'A brutal week sends them tumbling.', 'Questions everywhere after that one.']);
  if (i < 3) return pick(['The class of the league right now.', 'Championship-caliber on both sides.', 'Everybody is chasing them.']);
  if (pd > 40) return 'Point differential says they are for real.';
  if (pd < -40) return 'Getting outscored badly — a rebuild may be coming.';
  return pick(['Hanging around the playoff picture.', 'Middle of the pack, waiting for a spark.', 'Solid, but not scaring anybody yet.', 'Win the close ones and they rise fast.']);
}
function bracketHTML(L) {
  const po = L.playoffs; if (!po) return '';
  const rounds = ['Wild Card', 'Divisional', 'Conference', 'Final'];
  const all = po.done.concat(po.games);
  const g2 = g => `<div class="bk-g ${g.hs == null ? 'live' : ''}">${[['h', 'hs'], ['a', 'as']].map(([k, s]) => { const t = L.teams[g[k]], won = g.hs != null && (k === 'h' ? g.hs > g.as : g.as > g.hs); return `<div class="bk-t ${won ? 'w' : g.hs != null ? 'l' : ''} ${g[k] === L.userTid ? 'me' : ''}"><span class="emb xs">${emblemSVG(t)}</span>${esc(t.abbr)}<b class="num">${g[s] == null ? '' : g[s]}</b></div>`; }).join('')}</div>`;
  return `<div class="card"><h2>Playoff bracket</h2><div class="bracket">${rounds.map((n, r) => `<div class="bk-col"><div class="eyebrow">${n}</div>${all.filter(g => g.round === r).map(g2).join('') || '<div class="muted small">TBD</div>'}</div>`).join('')}</div></div>`;
}
function viewRankings() {
  const L = LEAGUE, pr = powerRanks(L), prev = L.prPrev || {};
  return `${bracketHTML(L)}<div class="card"><h2>Power rankings <span class="muted small">${L.phase === 'regular' ? 'Week ' + L.week : phaseLabel(L.phase, L.week)}</span></h2><div class="tbl-wrap"><table class="t"><tbody>${pr.map((r, i) => {
    const was = prev[r.t.id], mv = was ? was - (i + 1) : 0;
    return `<tr class="${r.t.id === L.userTid ? 'me' : ''}"><td class="num"><b>${i + 1}</b></td><td class="small ${mv > 0 ? 'up' : mv < 0 ? 'down' : 'muted'}">${mv > 0 ? '▲' + mv : mv < 0 ? '▼' + -mv : '–'}</td><td><span class="emb xs">${emblemSVG(r.t)}</span> <b>${esc(teamName(r.t))}</b> <span class="muted small">${r.t.w}-${r.t.l}${r.t.t ? '-' + r.t.t : ''}</span><div class="small muted">${prBlurb(L, r, i, mv)}</div></td><td class="r">${ovrTag(teamOvr(L, r.t).ovr)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}

// ---------------- share custom plays ----------------
function cpCode(d) { const c = Object.assign({}, d); delete c.id; return 'GDP1:' + btoa(unescape(encodeURIComponent(JSON.stringify(c)))); }
function cpDecode(s) {
  s = (s || '').trim(); if (!s.startsWith('GDP1:')) throw new Error('Not a play code');
  const d = JSON.parse(decodeURIComponent(escape(atob(s.slice(5)))));
  if (!d || !d.form || !d.type || !d.assign) throw new Error('Broken play code');
  d.id = 'cp_' + Date.now().toString(36) + randi(0, 999); d.name = String(d.name || 'Shared play').slice(0, 28);
  return d;
}
const _viewPlaybookSh = viewPlaybook;
viewPlaybook = function () {
  let h = _viewPlaybookSh();
  if (CP_EDIT) return h;
  h = h.replace(/data-act="cp-del" data-id="([^"]+)">Delete<\/button>/g, (m, id) => `data-act="cp-share" data-id="${id}">Share</button><button class="btn sm ghost" ${m}`);
  return h + `<div class="card"><h2>Import a friend's play</h2><div class="row" style="gap:8px"><input id="cpImport" class="grow" placeholder="Paste a play code (starts with GDP1:)"><button class="btn sm primary" data-act="cp-import">Add to my playbook</button></div></div>`;
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.dataset.act === 'cp-share') {
    const d = cpLoad().find(x => x.id === el.dataset.id); if (!d) return;
    const code = cpCode(d);
    modal(`<div class="modal-head"><h2>Share "${esc(d.name)}"</h2><button class="btn sm ghost x" data-act="close">✕</button></div><p class="small">Send this code to a friend. They paste it under <b>Import a friend's play</b>.</p><textarea id="cpCodeTxt" rows="4" style="width:100%" readonly>${code}</textarea><div class="row"><button class="btn primary" data-act="cp-copycode">Copy code</button></div>`);
  }
  if (el.dataset.act === 'cp-copycode') { const ta = document.getElementById('cpCodeTxt'); ta.select(); if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => toast('Copied!'), () => toast('Select the text and copy it.')); else { document.execCommand && document.execCommand('copy'); toast('Copied.'); } }
  if (el.dataset.act === 'cp-import') {
    try { const d = cpDecode(document.getElementById('cpImport').value); const list = cpLoad(); list.push(d); cpStore(list); cpInstall(); toast(`"${d.name}" added to your playbook.`); renderHub(); }
    catch (err) { toast('That code didn\'t work — check you copied all of it.'); }
  }
});
