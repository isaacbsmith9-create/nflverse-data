// Browser click-through with screenshots. Usage: THREE_JS=/path/to/three.min.js node tests/ui_test.js [outDir]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = process.argv[2] || path.join(__dirname, 'shots');
const THREE_JS = process.env.THREE_JS;
fs.mkdirSync(OUT, { recursive: true });
const file = 'file://' + path.join(__dirname, '..', 'index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  async function newPage(opts) {
    const page = await browser.newPage(opts);
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.route('**/three.min.js', r => THREE_JS ? r.fulfill({ path: THREE_JS, contentType: 'text/javascript' }) : r.abort());
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.route('**/fonts.gstatic.com/**', r => r.abort());
    return page;
  }
  const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 120000 }); console.log('shot', name); };
  // swiftshader is far slower than a real GPU: keep the 3D camera on for the screenshots
  const lockGL = p => p.evaluate(() => { if (GAME) GAME.live.glPerf = { n: 0, t0: performance.now(), step: 3 }; });
  const click = async (page, sel) => { await page.click(sel); await sleep(150); };

  // ---------- desktop / Chromebook ----------
  const page = await newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(file); await sleep(800);
  await shot(page, '01-menu');
  await click(page, '[data-act="new-franchise"]'); await sleep(600);
  await page.selectOption('#setConf', 'Big Ten'); await sleep(300);
  await page.fill('#setCoach', 'Isaac');
  await shot(page, '02-setup');
  await click(page, '.team-card[data-tid]');
  await click(page, '#setupGo'); await sleep(900);
  await shot(page, '03-hub-home');
  for (const tab of ['poll', 'roster', 'nil', 'portal', 'standings', 'schedule', 'program', 'lineup', 'records', 'dev', 'stats', 'depth', 'playbook', 'settings']) {
    await click(page, `.tab[data-tab="${tab}"]`); await sleep(200);
    if (['poll', 'roster', 'nil', 'program', 'lineup'].includes(tab)) await shot(page, '04-tab-' + tab);
  }
  // recruiting: search, add 3 to board, assign hours, offer
  await click(page, '.tab[data-tab="recruit"]');
  await click(page, '[data-act="rc-tab"][data-tab="search"]'); await sleep(300);
  await shot(page, '05-recruit-search');
  for (let i = 0; i < 3; i++) { await page.click('[data-act="rc-add"]'); await sleep(200); }
  await click(page, '[data-act="rc-tab"][data-tab="board"]'); await sleep(200);
  for (let i = 0; i < 3; i++) { await page.locator('select[data-act="rc-hrs"]').nth(i).selectOption('10'); await sleep(200); }
  for (let i = 0; i < 3; i++) { const b = page.locator('[data-act="rc-offer"]:not(.primary)').first(); if (await b.count()) { await b.click(); await sleep(200); } }
  await shot(page, '06-recruit-board');
  // player card
  await click(page, '.tab[data-tab="roster"]');
  await click(page, 'tr[data-act="player"]'); await sleep(200);
  await shot(page, '07-player-card');
  await click(page, '#modalBox [data-act="close"]');
  // play a live game
  await click(page, '.tab[data-tab="home"]');
  const playBtn = await page.$('[data-act="play-game"]');
  if (!playBtn) { await click(page, '[data-act="sim-week"]'); }
  await click(page, '[data-act="play-game"]'); await lockGL(page); await sleep(1500);
  // first call can be offense or defense
  await page.waitForSelector('#playcall:not([hidden])', { timeout: 15000 });
  await shot(page, '08-playcall');
  await page.click('#playcall .play[data-act="call-play"]'); await sleep(4000);
  await shot(page, '09-presnap-3d');
  await page.keyboard.press('Space'); await sleep(2500);
  await shot(page, '10-live-3d');
  await sleep(3000);
  // pause -> sim rest of game -> final
  await page.keyboard.press('Escape'); await sleep(300);
  await page.click('#pause [data-act="sim-game-rest"]').catch(() => page.evaluate(() => simRestOfGame()));
  await sleep(800);
  await shot(page, '11-final');
  await page.click('[data-act="game-continue"]'); await sleep(800);
  await shot(page, '12-after-game');
  // sim to end of season and through the postseason, then the offseason screens
  await click(page, '[data-act="sim-to-playoffs"]'); await sleep(1500);
  await click(page, '.tab[data-tab="poll"]'); await sleep(200);
  await shot(page, '13-poll-end');
  let guard = 0;
  while (guard++ < 8) {
    const ph = await page.evaluate(() => LEAGUE.phase);
    if (ph !== 'playoffs') break;
    await click(page, '.tab[data-tab="home"]');
    const pg = await page.$('[data-act="sim-game"]');
    if (pg) await pg.click(); else await page.click('[data-act="sim-week"]');
    await sleep(700);
    if (guard === 2) { await click(page, '.tab[data-tab="poll"]'); await shot(page, '14-cfp-bracket'); }
  }
  await click(page, '.tab[data-tab="home"]'); await sleep(300);
  await shot(page, '15-recap');
  const fired = await page.evaluate(() => LEAGUE.fired);
  if (fired) await click(page, '[data-act="take-job"]');
  await click(page, '[data-act="begin-offseason"]'); await sleep(800);
  await shot(page, '16-departures');
  await click(page, '[data-act="open-portal"]'); await sleep(1200);
  await shot(page, '17-portal');
  const offer = await page.$('[data-act="portal-offer-open"]');
  if (offer) { await offer.click(); await sleep(200); await shot(page, '18-portal-offer'); await click(page, '#modalBox [data-act="portal-offer"]'); }
  for (let d = 0; d < 3; d++) { await click(page, '[data-act="portal-day"]'); await sleep(900); }
  await shot(page, '19-signing-day');
  await click(page, '[data-act="new-season"]'); await sleep(1500);
  await shot(page, '20-new-season');
  // save / reload
  await page.evaluate(() => flushSave());
  const meta = await page.evaluate(() => JSON.stringify(saveMeta(SLOT)));
  console.log('save meta', meta);
  await page.reload(); await sleep(1200);
  await shot(page, '21-menu-after-reload');
  await click(page, '[data-act="load"]'); await sleep(1200);
  const season = await page.evaluate(() => LEAGUE && LEAGUE.season);
  console.log('reloaded season', season);

  // ---------- phone ----------
  const phone = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await phone.goto(file); await sleep(800);
  await shot(phone, '30-phone-menu');
  await phone.tap('[data-act="new-franchise"]'); await sleep(700);
  await phone.tap('.team-card[data-tid]'); await sleep(200);
  await phone.tap('#setupGo'); await sleep(900);
  await shot(phone, '31-phone-hub');
  await phone.tap('.tab[data-tab="recruit"]'); await sleep(300);
  await phone.tap('[data-act="rc-tab"][data-tab="search"]'); await sleep(300);
  await shot(phone, '32-phone-recruit');
  await phone.setViewportSize({ width: 844, height: 390 });
  await phone.tap('.tab[data-tab="home"]'); await sleep(300);
  await phone.tap('[data-act="play-game"]'); await lockGL(phone); await sleep(1500);
  await phone.waitForSelector('#playcall:not([hidden])', { timeout: 15000 });
  await phone.tap('#playcall .play[data-act="call-play"]'); await sleep(1500);
  await shot(phone, '33-phone-game');
  const sw = await phone.evaluate(() => ({ w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log('phone scroll width', sw);

  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
