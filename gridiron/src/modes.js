// ============================================================
// Gridiron Dynasty - Practice mode, Challenges (clutch scenarios with
// stars), Trophies (achievements), gameplay sliders in Settings.
// ============================================================
'use strict';

function freshLeague(abbr) { return hasRealData() ? newRealLeague(abbr || 'BUF') : newLeague('BOS'); }
const PR_SPOTS = [[25, 'Own 25'], [50, 'Midfield'], [80, 'Red zone (opp 20)'], [96, 'Goal line (opp 4)'], [10, 'Backed up (own 10)']];
function teamOpts(L, sel) { return L.teams.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(teamName(t))}</option>`).join(''); }

// ---------------- practice ----------------
let PR_TMP = null;
function practiceModal() {
  PR_TMP = freshLeague();
  const L = PR_TMP;
  modal(`<div class="modal-head"><h2>Practice</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p class="small">Run any play against any defense with no clock. Great for testing your custom plays.</p>
    <div class="stack"><label>Your offense <select id="prOff">${teamOpts(L, 0)}</select></label><label>Their defense <select id="prDef">${teamOpts(L, 5)}</select></label>
    <label>Spot <select id="prSpot">${PR_SPOTS.map(([y, n]) => `<option value="${y}">${n}</option>`).join('')}</select></label>
    <button class="btn primary" data-act="pr-go">Start practice</button></div>`);
}
const LPR = LiveGame.prototype;
const _nextPR = LPR.next;
LPR.next = function () {
  const P = this.practice;
  if (P) {
    const gs = this.gs; gs.over = false; gs.retPending = null; gs.onsideMsg = null;
    gs.poss = this.user; gs.yard = P.spot; gs.down = 1; gs.togo = Math.min(10, 100 - P.spot); gs.quarter = 1; gs.clock = gs.qlen; gs.ballY = MID_Y;
    this._halfShown = true;
  }
  return _nextPR.call(this);
};
const _chooseExtra = LPR.choose;
LPR.choose = function (id) {
  const P = this.practice;
  if (!P || !P.def || P.def === 'auto') return _chooseExtra.call(this, id);
  const keep = cpuDefCall; cpuDefCall = () => DEF_PLAYS.find(d => d.id === P.def) || keep(this.gs);
  try { return _chooseExtra.call(this, id); } finally { cpuDefCall = keep; }
};
const _resultPR = LPR.result;
LPR.result = function (title, sub, big) {
  _resultPR.call(this, title, sub, big);
  if (this.practice && this.offPlay && this.defPlay) { this.practice.log.unshift(`${this.offPlay.name} vs ${this.defPlay.name}: ${title}`); this.practice.log.length = Math.min(8, this.practice.log.length); }
};
const _showPlayCallM = showPlayCall;
showPlayCall = function (mode, audible) {
  _showPlayCallM(mode, audible);
  const lg = GAME && GAME.live; if (!lg || !lg.practice) return;
  const P = lg.practice, head = document.querySelector('#playcall .pc-head');
  if (head) head.insertAdjacentHTML('afterend', `<div class="pc-clock row"><span class="pill amber">PRACTICE</span>
    <label class="small">Defense <select id="prDefSel">${[['auto', 'Coach picks'], ...DEF_PLAYS.map(d => [d.id, d.name])].map(([v, n]) => `<option value="${v}" ${P.def === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="small">Spot <select id="prSpotSel">${PR_SPOTS.map(([y, n]) => `<option value="${y}" ${P.spot === y ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <button class="btn sm ghost" data-act="pr-end">End practice</button></div>
    ${P.log.length ? `<div class="small muted pr-log">${P.log.map(esc).join('<br>')}</div>` : ''}`);
};

// ---------------- challenges ----------------
const CHALLENGES = [
  { id: 'twomin', name: 'Two-Minute Comeback', desc: 'Down 4 with 2:00 left. Own 25, two timeouts. Go win it.', u: 'BUF', o: 'KC', st: { quarter: 4, clock: 120, score: [20, 24], yard: 25, to: [2, 3], poss: 'u' } },
  { id: 'gls', name: 'Goal Line Stand', desc: 'Up 3, 0:55 left. They have 1st & goal at your 4. Hold them.', u: 'PIT', o: 'BAL', st: { quarter: 4, clock: 55, score: [17, 14], yard: 96, to: [3, 2], poss: 'o' } },
  { id: 'hail', name: 'Last Gasp', desc: 'Down 5, 0:12 on the clock, ball at their 45. One shot (maybe two).', u: 'DET', o: 'GB', st: { quarter: 4, clock: 12, score: [23, 28], yard: 55, to: [0, 1], poss: 'u' } },
  { id: 'redzone', name: 'Red Zone Dagger', desc: 'Tied, 1:10 left, 1st & 10 at their 20. Score and leave no time.', u: 'PHI', o: 'DAL', st: { quarter: 4, clock: 70, score: [24, 24], yard: 80, to: [1, 0], poss: 'u' } },
  { id: 'protect', name: 'Protect the Lead', desc: 'Up 3 with 4:30 left at your own 30. Burn the clock and close it out.', u: 'SF', o: 'SEA', st: { quarter: 4, clock: 270, score: [27, 24], yard: 30, to: [3, 3], poss: 'u' } },
  { id: 'comeback', name: 'Comeback Kings', desc: 'Down 10 with 5:00 left. Own 25, all three timeouts.', u: 'CIN', o: 'CLE', st: { quarter: 4, clock: 300, score: [14, 24], yard: 25, to: [3, 3], poss: 'u' } },
  { id: 'backed', name: 'Backed Up', desc: 'Up 4, 3:00 left, ball at your own 2. Don\'t give it back.', u: 'GB', o: 'CHI', st: { quarter: 4, clock: 180, score: [20, 16], yard: 2, to: [2, 3], poss: 'u' } },
  { id: 'ot', name: 'Overtime Thriller', desc: 'Tied in overtime. Your ball at the 25. Win it.', u: 'KC', o: 'BUF', st: { quarter: 5, clock: 600, score: [30, 30], yard: 25, to: [2, 2], poss: 'u' } },
];
const DIFF_STARS = { rookie: 1, pro: 1, allpro: 2, legend: 3 };
function chalStore() { try { return JSON.parse(localStorage.getItem('gd_chal') || '{}'); } catch (e) { return {}; } }
function chalSave(o) { try { localStorage.setItem('gd_chal', JSON.stringify(o)); } catch (e) { } }
function challengesModal() {
  const S = chalStore();
  modal(`<div class="modal-head"><h2>Challenges</h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <p class="small">Clutch moments. Beat them on Pro for ★, All-Pro for ★★, Legend for ★★★.</p>
    <label class="small">Difficulty <select id="chDiff"><option value="pro">Pro</option><option value="allpro">All-Pro</option><option value="legend">Legend</option></select></label>
    <div class="ch-list">${CHALLENGES.map(c => `<button class="ch" data-act="ch-go" data-id="${c.id}"><span class="stars">${'★'.repeat(S[c.id] || 0)}<i>${'★'.repeat(3 - (S[c.id] || 0))}</i></span><b>${c.name}</b><span class="small muted">${c.desc}</span></button>`).join('')}</div>`);
}
function startChallenge(id, diff) {
  const c = CHALLENGES.find(x => x.id === id); if (!c) return;
  const L = freshLeague();
  const find = ab => { const t = L.teams.find(t => t.abbr === ab); return t ? t.id : null; };
  let u = find(c.u), o = find(c.o); if (u == null || o == null) { u = 0; o = 7; }
  L.userTid = u; L.settings.diff = diff; L.settings.simDef = false; L.settings.qlen = 300;
  LEAGUE = L; EXHIB = true; closeModal();
  startLiveGame(u, o, u, { exhibition: true, challenge: { id, diff } });
  const gs = GAME.gs, us = 0, s = c.st;
  gs.quarter = s.quarter; gs.clock = s.clock; gs.score = [s.score[0], s.score[1]]; gs.timeouts = [s.to[0], s.to[1]];
  gs.poss = s.poss === 'u' ? us : 1 - us; gs.yard = s.yard; gs.down = 1; gs.togo = Math.min(10, 100 - s.yard);
  gs.tmw = { 2: true, 4: true }; if (s.quarter === 5) gs.otPoss = 0;
  GAME.live._halfShown = true;
  updateHUD(); toast(`Challenge: ${c.name}`);
}
const _showFinalM = showFinal;
showFinal = function () {
  _showFinalM();
  const ch = GAME && GAME.opts.challenge; if (!ch) return;
  const gs = GAME.gs, won = gs.score[0] > gs.score[1];
  const stars = won ? DIFF_STARS[ch.diff] || 1 : 0, S = chalStore();
  if (stars > (S[ch.id] || 0)) { S[ch.id] = stars; chalSave(S); }
  if (won) trophy('chal'); if (stars >= 3) trophy('chal3');
  const h = document.querySelector('#final h2'); if (h) h.insertAdjacentHTML('afterend', `<p style="text-align:center;font-size:20px">${won ? `Challenge complete! <span class="stars">${'★'.repeat(stars)}</span>` : 'Challenge failed — try again.'}</p>`);
};

// ---------------- trophies ----------------
const TROPHIES = [
  ['win1', 'First Down... First Win', 'Win a game you played.'], ['blowout', 'Statement Game', 'Win a game by 28 or more.'], ['shutout', 'Shutout', 'Hold a team scoreless in a win.'],
  ['qb300', 'Air It Out', 'Throw for 300+ yards in a game.'], ['rush150', 'Ground and Pound', 'Rush for 150+ team yards in a game.'], ['comeback', 'Never Say Die', 'Win after trailing by 14+.'],
  ['rettd', 'House Call', 'Score on a kick or punt return.'], ['snow', 'Snow Globe', 'Win a game in the snow.'], ['onside', 'Surprise!', 'Recover an onside kick.'],
  ['ten', 'Double Digits', 'Win 10+ games in a season.'], ['perfect', 'Perfection', 'Go undefeated in the regular season.'], ['champ', 'Champions', 'Win the championship.'],
  ['dynasty', 'Dynasty', 'Win 3 championships in one franchise.'], ['hof', 'Canton Calling', 'Have one of your players inducted into the Hall of Fame.'], ['plays5', 'Mad Scientist', 'Create 5 custom plays.'],
  ['star85', 'Superstar', 'Get your Superstar to 85 OVR.'], ['owner', 'Palace', 'Max out a stadium upgrade.'], ['chal', 'Clutch', 'Complete a challenge.'], ['chal3', 'Ice Water', 'Get 3 stars on a challenge.'],
  ['zone', 'On Fire', 'Get one of your players In the Zone.'],
];
function trophyStore() { try { return JSON.parse(localStorage.getItem('gd_trophies') || '{}'); } catch (e) { return {}; } }
function trophy(id) {
  const T = trophyStore(); if (T[id]) return; const t = TROPHIES.find(x => x[0] === id); if (!t) return;
  T[id] = new Date().toISOString().slice(0, 10); try { localStorage.setItem('gd_trophies', JSON.stringify(T)); } catch (e) { }
  setTimeout(() => toast(`🏆 Trophy unlocked: ${t[1]}`, 3500), 400);
}
function trophiesModal() {
  const T = trophyStore(), n = Object.keys(T).length;
  modal(`<div class="modal-head"><h2>Trophies <span class="muted small">${n}/${TROPHIES.length}</span></h2><button class="btn sm ghost x" data-act="close">✕</button></div>
    <div class="tro-grid">${TROPHIES.map(([id, name, d]) => `<div class="tro ${T[id] ? 'got' : ''}"><span class="ic">${T[id] ? '🏆' : '🔒'}</span><b>${name}</b><span class="small muted">${d}</span>${T[id] ? `<span class="small muted">${T[id]}</span>` : ''}</div>`).join('')}</div>`);
}
// game-level trophies (live games only)
const _nextTro = LPR.next;
LPR.next = function () {
  const gs = this.gs; if (this.user >= 0) this.maxDown = Math.max(this.maxDown || 0, gs.score[1 - this.user] - gs.score[this.user]);
  if (this.user >= 0 && gs.zone && Object.keys(gs.zone).some(id => gs.zone[id].on && LEAGUE.players[id] && LEAGUE.players[id].tid === this.teamOf(this.user).id)) trophy('zone');
  return _nextTro.call(this);
};
function gameTrophies(gs, lg) {
  if (!lg || lg.user < 0 || lg.practice) return;
  const u = lg.user, won = gs.score[u] > gs.score[1 - u], L = LEAGUE;
  if (won) trophy('win1');
  if (won && gs.score[u] - gs.score[1 - u] >= 28) trophy('blowout');
  if (won && gs.score[1 - u] === 0) trophy('shutout');
  if (won && (lg.maxDown || 0) >= 14) trophy('comeback');
  if (won && gs.weather && gs.weather.k === 'snow') trophy('snow');
  if (gs.tstats[u].rush >= 150) trophy('rush150');
  const mine = Object.keys(gs.box).map(Number).filter(id => L.players[id] && L.players[id].tid === gs.tids[u]);
  if (mine.some(id => (gs.box[id].py || 0) >= 300)) trophy('qb300');
  if (mine.some(id => gs.box[id].krtd)) trophy('rettd');
  if (gs.log.some(l => /ONSIDE KICK — /.test(l.txt) && l.txt.includes(teamAbbr(gs, u) + ' RECOVERS'))) trophy('onside');
}
const _endLiveTro = endLiveGame;
endLiveGame = function () { if (GAME) gameTrophies(GAME.gs, GAME.live); return _endLiveTro(); };
const _advTro = advancePlayoffs;
advancePlayoffs = function (L) {
  const n = L.history.length; _advTro(L);
  if (L.history.length > n && L.history[0].champ === L.userTid && !EXHIB) { trophy('champ'); if (L.teams[L.userTid].titles >= 3) trophy('dynasty'); }
};
const _startPlayoffsTro = startPlayoffs;
startPlayoffs = function (L) {
  const t = L.teams[L.userTid]; if (!EXHIB && t) { if (t.w >= 10) trophy('ten'); if (t.l === 0 && t.t === 0 && t.w > 0) trophy('perfect'); }
  return _startPlayoffsTro(L);
};
const _beginOffTro = beginOffseason;
beginOffseason = function (L) {
  const n = (L.retired || []).length; _beginOffTro(L);
  if ((L.retired || []).slice(0).some((r, i) => r.hof && r.year === L.season && r.teams.includes(L.teams[L.userTid].abbr))) trophy('hof');
};
const _renderHubTro = renderHub;
renderHub = function () {
  _renderHubTro();
  const L = LEAGUE; if (!L || EXHIB) return;
  if (cpLoad().length >= 5) trophy('plays5');
  const s = ssPlayer(L); if (s && s.ovr >= 85) trophy('star85');
  if (L.owner && Object.values(L.owner.lv).some(v => v >= 3)) trophy('owner');
};

// ---------------- sliders in Settings ----------------
const _viewSettingsM = viewSettings;
viewSettings = function () {
  const s = sl(), opt = (k, list) => `<select data-act="set-sl" data-k="${k}">${list.map(([v, n]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  return `<div class="card stack"><h2>Gameplay sliders</h2>
    <label>Game speed ${opt('speed', [[0.8, 'Slow (0.8×)'], [0.9, 'A bit slower'], [1, 'Normal'], [1.1, 'A bit faster'], [1.2, 'Fast (1.2×)']])}</label>
    <label>Injuries ${opt('inj', [[0, 'Off'], [0.5, 'Fewer'], [1, 'Normal'], [1.8, 'More']])}</label>
    <label>Fumbles ${opt('fum', [[0, 'Off'], [0.5, 'Fewer'], [1, 'Normal'], [1.8, 'More']])}</label>
    <label>Fatigue & rotation ${opt('fat', [[true, 'On'], [false, 'Off']])}</label></div>` + _viewSettingsM();
};

// ---------------- events ----------------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'practice') practiceModal();
  if (a === 'challenges') challengesModal();
  if (a === 'trophies') trophiesModal();
  if (a === 'pr-go') {
    const L = PR_TMP, off = +$('#prOff').value; let def = +$('#prDef').value; if (def === off) def = (off + 1) % L.teams.length;
    L.userTid = off; L.settings.simDef = false; LEAGUE = L; EXHIB = true; closeModal();
    startLiveGame(off, def, off, { exhibition: true });
    GAME.live.practice = { spot: +$('#prSpot').value || 25, def: 'auto', log: [] };
    GAME.gs.poss = GAME.live.user;
  }
  if (a === 'pr-end' && GAME) { $('#playcall').hidden = true; endLiveGame(); }
  if (a === 'ch-go') startChallenge(el.dataset.id, ($('#chDiff') || {}).value || 'pro');
});
document.addEventListener('change', e => {
  const t = e.target; if (!t) return;
  if (t.id === 'prDefSel' && GAME && GAME.live.practice) GAME.live.practice.def = t.value;
  if (t.id === 'prSpotSel' && GAME && GAME.live.practice) { GAME.live.practice.spot = +t.value; const lg = GAME.live; $('#playcall').hidden = true; lg.next(); }
  if (t.dataset && t.dataset.act === 'set-sl' && LEAGUE) {
    const k = t.dataset.k; LEAGUE.settings.sl = Object.assign({}, sl()); LEAGUE.settings.sl[k] = k === 'fat' ? t.value === 'true' : +t.value; save(); toast('Slider saved.');
  }
});
