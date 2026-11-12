// College rules: overtime format, no ties, redshirts, firing / job offers, quick checks on the season structure.
const { load } = require('./harness');
const g = load();
const A = g.__api;
const fail = m => { console.error('FAIL:', m); process.exitCode = 1; };
const L = A.newCfbLeague('OSU'); L.startSeason = L.season; A.L = L;

// ---------- overtime: force ties at the end of regulation many times ----------
let ots = 0, shootouts = 0, ties = 0, maxOT = 0;
for (let i = 0; i < 400; i++) {
  const h = L.poll[i % 10].tid, a = L.poll[(i + 3) % 10].tid;
  const gs = g.newGameState(L, h, a, { qlen: 900 });
  // play to the end of the 3rd quarter, then tie it up
  let guard = 0; while (!gs.over && gs.quarter < 4 && guard++ < 400) g.simOnePlay(gs);
  gs.score = [21, 21]; gs.clock = 1; gs.poss = 0; gs.yard = 20; gs.down = 1; gs.togo = 10;
  guard = 0; while (!gs.over && guard++ < 700) g.simOnePlay(gs);
  if (!gs.over) { fail('OT game never ended'); break; }
  if (gs.score[0] === gs.score[1]) ties++;
  if (gs.ot) { ots++; maxOT = Math.max(maxOT, gs.ot.n); if (gs.ot.n >= 3) shootouts++; }
  if (gs.ot && gs.ot.n >= 3) {
    const log = gs.log.map(l => l.txt).join('\n');
    if (!/two-point shootout/.test(log)) fail('missing shootout log');
  }
}
console.log(`OT games ${ots}/400, reached 2-pt shootout ${shootouts}, longest ${maxOT} OTs, ties ${ties}`);
if (ots < 380) fail('tied games did not go to OT');
if (ties) fail('a game ended tied');
if (!shootouts) fail('never reached the 3rd OT shootout');

// a shootout possession is a single 2-point play from the 3
{
  const gs = g.newGameState(L, L.poll[0].tid, L.poll[1].tid, { qlen: 900 });
  gs.quarter = 4; gs.clock = 0; gs.score = [14, 14]; g.endQuarter(gs);
  if (!gs.ot || gs.yard !== 75) fail('OT should start at the opponent 25 (yard 75), got ' + gs.yard);
  gs.ot.n = 3; gs.ot.half = 0; g.otPlace(gs);
  if (gs.yard !== 97 || gs.down !== 4) fail('shootout try should be 4th down at the 3');
  const s0 = gs.score.slice(), side = gs.poss;
  g.applyPlay(gs, { yards: 5, elapsed: 4 }); // scores
  if (gs.score[side] - s0[side] !== 2) fail('shootout TD should count 2, got ' + (gs.score[side] - s0[side]));
  if (gs.poss === side) fail('possession should switch after the try');
}

// ---------- no two-minute warning ----------
{
  const gs = g.newGameState(L, L.poll[0].tid, L.poll[1].tid, { qlen: 900 });
  gs.quarter = 2; gs.clock = 130; g.runClock(gs, 20);
  if (gs.clock !== 110) fail('two-minute warning should not stop the clock in college');
}

// ---------- season: games have no ties; neutral sites ----------
let guard = 0; while (L.phase === 'regular' && guard++ < 30) A.simWeek(L, true);
const games = L.schedule.flat();
const otGames = games.filter(x => x.ot).length;
if (games.some(x => x.hs === x.as)) fail('tie in the regular season');
console.log(`regular season: ${games.length} games, ${otGames} went to OT, neutral-site games ${games.filter(x => x.n).length}`);
// redshirts: before offseason, count players with <=4 games who haven't redshirted
while (L.phase === 'playoffs' && guard++ < 50) A.simWeek(L, true);
const cand = Object.values(L.players).filter(p => p.tid >= 0 && !p.rs && (p.lastGp || 0) <= 4 && p.cls < 4).map(p => [p.id, p.cls]);
const played = Object.values(L.players).filter(p => p.tid >= 0 && (p.lastGp || 0) > 4 && p.cls < 4).map(p => [p.id, p.cls]);
const ol = Object.values(L.players).filter(p => p.tid >= 0 && p.pos === 'OL' && (p.lastGp || 0) >= 10).length;
console.log(`redshirt candidates ${cand.length}, regulars ${played.length}, OL with 10+ games ${ol}`);
if (!ol) fail('offensive linemen are not getting games played');
// fire the user to test the job market
L.teams[L.userTid].w = 1; L.security = 4; L.startSeason = L.season - 2;
A.beginOffseason(L);
const kept = cand.filter(([id, c]) => L.players[id] && L.players[id].cls === c && L.players[id].rs).length;
const adv = played.filter(([id, c]) => L.players[id] && L.players[id].cls === c + 1).length;
console.log(`redshirted (kept class) ${kept}/${cand.length}, advanced ${adv}/${played.length}`);
if (kept !== cand.length || adv !== played.length) fail('redshirt / class advance rule broken');
console.log(`fired=${L.fired} offers=${(L.jobOffers || []).map(id => L.teams[id].city).join(', ')}`);
if (!L.fired || !L.jobOffers.length) fail('firing / job offers did not happen');
const oldU = L.userTid; A.takeJob(L, L.jobOffers[0]);
if (L.userTid === oldU || L.fired) fail('taking a job failed');
console.log('new job:', L.teams[L.userTid].city, 'coach', L.teams[L.userTid].coach);
console.log(process.exitCode ? 'WITH FAILURES' : 'ALL OK');
