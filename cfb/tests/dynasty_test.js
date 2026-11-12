// Simulates several full dynasty seasons headlessly and checks the results look like college football.
// Usage: node tests/dynasty_test.js [seasons] [teamAbbr]
const { load } = require('./harness');
const SEASONS = +(process.argv[2] || 3), ABBR = process.argv[3] || 'OSU';
const g = load({ syncTimers: false });
const A = g.__api;
const fail = m => { console.error('FAIL:', m); process.exitCode = 1; };
const t0 = Date.now();
const L = A.newCfbLeague(ABBR);
L.settings.coachName = 'Test Coach'; L.startSeason = L.season;
A.L = L;
console.log(`league: ${L.teams.length} teams, ${Object.keys(L.players).length} players, ${L.schedule.length} weeks, ${L.recruits.length} recruits (${Date.now() - t0}ms)`);
const U = () => L.teams[L.userTid];
{ const ovs = L.teams.map(t => A.teamOvr(L, t).ovr).sort((a, b) => b - a); console.log(`team OVR: #1 ${ovs[0]}, top-25 avg ${(ovs.slice(0, 25).reduce((a, b) => a + b, 0) / 25).toFixed(1)}, median ${ovs[69]}, worst ${ovs[ovs.length - 1]}`); }
console.log(`user: ${U().city} OVR ${A.teamOvr(L, U()).ovr}, preseason #${U().rank}, NIL ${U().nilBudget}M`);
console.log('preseason top 10:', L.poll.slice(0, 10).map((x, i) => `${i + 1}.${L.teams[x.tid].city}(${A.teamOvr(L, L.teams[x.tid]).ovr})`).join(' '));

function userRecruit() {
  // put the 25 best-fitting realistic targets on the board and spread 60 hours
  if (!L.recruits.length) return;
  const ctx = A.rcCtx(L);
  if (L.rboard.length < 25) {
    const cands = L.recruits.filter(r => r.commit < 0 && !L.rboard.includes(r.id) && r.stars >= Math.min(4, U().prestige - 2)).sort((a, b) => A.fitScore(L, b, U(), ctx) * (b.stars + 1) - A.fitScore(L, a, U(), ctx) * (a.stars + 1));
    for (const r of cands.slice(0, 25 - L.rboard.length)) { L.rboard.push(r.id); r.offers[L.userTid] = true; r.suit[L.userTid] = (r.suit[L.userTid] || 0) + 45; }
  }
  const open = L.rboard.map(id => L.recruits.find(r => r.id === id)).filter(r => r && r.commit < 0);
  for (const r of L.recruits) r.hrs = 0;
  let hrs = 60; for (const r of open.slice(0, 12)) { const h = Math.min(r.stars >= 5 ? 8 : 5, hrs); r.hrs = h; hrs -= h; }
  L.rboard = L.rboard.filter(id => { const r = L.recruits.find(x => x.id === id); return r && (r.commit < 0 || r.commit === L.userTid); });
}

const allScores = [];
for (let s = 0; s < SEASONS; s++) {
  const ts = Date.now();
  let guard = 0;
  while (L.phase === 'regular' && guard++ < 30) { userRecruit(); A.simWeek(L, true); }
  for (const wk of L.schedule) for (const gm of wk) if (gm.hs != null) allScores.push(gm.hs, gm.as);
  if (L.phase !== 'playoffs') fail('postseason did not start');
  const po = L.playoffs;
  console.log(`\n=== ${L.season} regular season done (${Date.now() - ts}ms). CCGs: ${po.games.map(gm => `${gm.conf}: ${L.teams[gm.a].abbr} vs ${L.teams[gm.h].abbr}`).join(', ')}`);
  guard = 0;
  while (L.phase === 'playoffs' && guard++ < 10) {
    const r = L.playoffs.round; A.simWeek(L, true);
    if (r === 0) {
      const p2 = L.playoffs;
      console.log(`CFP seeds: ${p2.seeds.map((id, i) => `${i + 1}.${L.teams[id].city}(${L.teams[id].w}-${L.teams[id].l})`).join(' ')}`);
      console.log(`bowls: ${p2.games.filter(x => x.bowl).length}, Heisman: ${L.heisman[0] ? L.heisman[0].name + ' ' + L.heisman[0].pos + ' ' + L.teams[L.heisman[0].tid].city + ' — ' + L.heisman[0].line : '?'}`);
      if (p2.seeds.length !== 12) fail('CFP field is not 12');
      if (new Set(p2.seeds).size !== 12) fail('duplicate CFP seeds');
      const champs = Object.values(p2.champs); const auto = champs.filter(id => p2.seeds.includes(id));
      if (auto.length < 5) fail('fewer than 5 conference champions in CFP');
    }
  }
  if (L.phase !== 'recap') fail('season did not reach recap, phase=' + L.phase);
  const h = L.history[0];
  console.log(`CHAMPION: ${L.teams[h.champ].city} def. ${L.teams[h.runner].city} ${h.score}. User ${U().city}: ${U().w}-${U().l}, rank ${U().rank || '-'}`);
  // sanity: records
  for (const t of L.teams) { if (t.w + t.l > 17 || t.w + t.l < 8) fail(`${t.city} played ${t.w + t.l} games`); if (t.t) fail('tie recorded'); }
  const aw = L.awards[0]; console.log(`awards: QB ${aw.qb && aw.qb.name}, DPOY ${aw.dpoy && aw.dpoy.name}, FOY ${aw.fresh && aw.fresh.name}, COY ${aw.coy && aw.coy.name}; All-Americans ${aw.allpro.length}`);
  // offseason
  A.beginOffseason(L);
  const D = L.departures;
  console.log(`departures: ${D.grads.length} grads, ${D.nfl.length} NFL entries, user risk ${D.risk.length}; job security ${L.security}${L.fired ? ' (FIRED)' : ''}, offers ${(L.jobOffers || []).length}`);
  if (L.fired) { A.takeJob(L, L.jobOffers[0]); console.log('took job at', U().city); }
  for (const x of D.risk) { const p = L.players[x.id]; if (p && A.capRoom(L, U()) + p.con.sal >= x.ask && p.ovr >= 70) { p.con.sal = x.ask; x.kept = true; } }
  const before = Object.keys(L.players).length;
  A.startPortal(L);
  console.log(`portal: ${L.portal.pool.length} entered (players ${before} -> ${Object.keys(L.players).length}); NFL R1: ${L.nflDraft[0].picks.filter(p => p.round === 1).length}`);
  for (let d = 0; d < 3; d++) {
    // user offers to the best few players at need spots
    const avail = L.portal.pool.map(id => L.players[id]).filter(p => p && p.tid == null && p.portal).sort((a, b) => b.ovr - a.ovr).slice(0, 4);
    for (const p of avail) A.userPortalOffer(L, p, p.portal.ask * 1.1);
    A.portalAdvance(L);
  }
  if (L.phase !== 'signing') fail('portal did not reach signing');
  const mv = L.portalLog.moves;
  console.log(`portal moves ${mv.length}, user in ${mv.filter(m => m.to === L.userTid).length} out ${mv.filter(m => m.from === L.userTid).length}; class #${L.lastClass.rank} (${L.lastClass.n} signees), top class ${L.teams[L.lastClass.top].city}`);
  A.startNewSeason(L);
  // invariants
  const sizes = L.teams.map(t => t.roster.length);
  if (Math.min(...sizes) < 60 || Math.max(...sizes) > 85) fail('roster sizes ' + Math.min(...sizes) + '-' + Math.max(...sizes));
  for (const p of Object.values(L.players)) {
    if (!(p.ovr >= 20 && p.ovr <= 99) || Number.isNaN(p.ovr)) { fail('bad ovr ' + A.pname(p)); break; }
    if (p.cls < 1 || p.cls > 4) { fail('bad class ' + A.pname(p) + ' ' + p.cls); break; }
    if (p.tid == null || !L.teams[p.tid].roster.includes(p.id)) { fail('orphan player ' + A.pname(p)); break; }
  }
  for (const t of L.teams) for (const id of t.roster) if (!L.players[id]) { fail('roster has missing player'); break; }
  const games = L.schedule.flat(); const per = {}; for (const gm of games) { per[gm.h] = (per[gm.h] || 0) + 1; per[gm.a] = (per[gm.a] || 0) + 1; }
  const cnt = L.teams.map(t => per[t.id] || 0);
  console.log(`new season ${L.season}: players ${Object.keys(L.players).length}, rosters ${Math.min(...sizes)}-${Math.max(...sizes)}, games/team ${Math.min(...cnt)}-${Math.max(...cnt)}, user ${U().city} OVR ${A.teamOvr(L, U()).ovr} #${U().rank || '-'} (${Date.now() - ts}ms)`);
  if (Math.min(...cnt) < 10) fail('a team has fewer than 10 games');
  const ovs = L.teams.map(t => A.teamOvr(L, t).ovr).sort((a, b) => b - a);
  console.log(`team OVR: #1 ${ovs[0]}, top-25 avg ${(ovs.slice(0, 25).reduce((a, b) => a + b, 0) / 25).toFixed(1)}, median ${ovs[69]}, worst ${ovs[ovs.length - 1]}; NFL draft ${L.nflDraft[0].picks.length} picks (R1 ${L.nflDraft[0].picks.filter(p => p.round === 1).length})`);
  const fr = Object.values(L.players).filter(p => p.cls === 1 && p.tid === L.userTid);
  console.log(`user freshmen ${fr.length}; RS players on roster ${U().roster.filter(id => L.players[id].rs).length}`);
}
const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
const shut = allScores.filter(x => x === 0).length / allScores.length;
console.log(`\npoints per team-game ${avg.toFixed(1)} (shutouts ${(shut * 100).toFixed(1)}%, 50+ ${(allScores.filter(x => x >= 50).length / allScores.length * 100).toFixed(1)}%)`);
if (avg < 18 || avg > 40) fail('scoring looks off');
// save round trip
let t = Date.now(); const ok = A.saveLeague(L, 1); const packMs = Date.now() - t;
const raw = g.__store['cfb_dynasty_save_1'] || '';
t = Date.now(); const back = A.loadLeague(1);
console.log(`save ok=${ok} json ${(JSON.stringify(L).length / 1e6).toFixed(2)}MB -> stored ${(raw.length / 1e6).toFixed(2)}M chars, pack ${packMs}ms, load ${Date.now() - t}ms, same=${back && back.season === L.season && Object.keys(back.players).length === Object.keys(L.players).length}`);
if (!back) fail('load failed');
console.log(`total ${(Date.now() - t0) / 1000}s`, process.exitCode ? 'WITH FAILURES' : 'ALL OK');
