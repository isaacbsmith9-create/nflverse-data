// Screenshots of the stadium: end zone with school name, band, student section. THREE_JS=... node tests/look_test.js outDir
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const OUT = process.argv[2] || path.join(__dirname, 'shots');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS, contentType: 'text/javascript' }));
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.goto('file://' + path.join(__dirname, '..', 'index.html')); await page.waitForTimeout(800);
  for (const [abbr, opp, yard, name] of [['UGA', 'BAMA', 88, 'look-goal-line'], ['TENN', 'FLA', 60, 'look-midfield']]) {
    await page.evaluate(([abbr, opp, yard]) => {
      const L = newCfbLeague(abbr); LEAGUE = L; EXHIB = true; L.settings.simDef = false;
      const h = L.teams.find(t => t.abbr === abbr), a = L.teams.find(t => t.abbr === opp) || L.teams[L.poll[3].tid];
      startLiveGame(h.id, a.id, h.id, { exhibition: true });
      GAME.live.glPerf = { n: 0, t0: performance.now(), step: 3 };
      const gs = GAME.gs; gs.poss = 0; gs.yard = yard; gs.down = 1; gs.togo = 10;
    }, [abbr, opp, yard]);
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const lg = GAME.live; $('#playcall').hidden = true; lg.choose('verts'); });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 120000 });
    console.log('shot', name);
    await page.evaluate(() => { GAME = null; });
  }
  console.log('errors', errs);
  await browser.close();
})();
