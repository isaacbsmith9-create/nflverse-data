// Browser timing: league creation, weekly sim, save/load, quick play start. node tests/perf_test.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.abort());
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.goto('file://' + path.join(__dirname, '..', 'index.html')); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const T = f => { const t = performance.now(); f(); return Math.round(performance.now() - t); };
    const out = {};
    let L; out.newLeague = T(() => { L = newCfbLeague('MICH'); });
    LEAGUE = L; SLOT = 3; EXHIB = false; L.startSeason = L.season;
    out.week = T(() => simWeek(L, true));
    out.render = T(() => { TAB = 'recruit'; renderHub(); TAB = 'poll'; renderHub(); TAB = 'home'; renderHub(); });
    out.save = T(() => saveLeague(L, 3));
    out.load = T(() => loadLeague(3));
    out.restOfSeason = T(() => { let g = 0; while (L.phase !== 'recap' && g++ < 40) simWeek(L, true); });
    out.offseason = T(() => { beginOffseason(L); startPortal(L); portalAdvance(L); portalAdvance(L); portalAdvance(L); startNewSeason(L); });
    out.phase = L.phase; out.season = L.season;
    // quick play: exhibition with two ranked teams (2D fallback here, no WebGL in this run)
    const Q = newCfbLeague('OSU'); LEAGUE = Q; EXHIB = true; startLiveGame(Q.poll[0].tid, Q.poll[1].tid, Q.poll[0].tid, { exhibition: true });
    out.quickPlay = !!GAME;
    return out;
  });
  await page.waitForTimeout(1500);
  console.log(JSON.stringify(r), 'errors', errs);
  await browser.close();
  if (errs.length) process.exitCode = 1;
})();
