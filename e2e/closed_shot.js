/* Скриншоты HUD с пометкой «закрыто» (зал и бар): инструмент для глаз, не тест. node e2e/closed_shot.js dist/artifact.html out/closed */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const pw = require('./pw');
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, tickDay, spawn, barOpen };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await pw.page(b); const out = process.argv[3] || 'out/closed';
  await pw.sandboxStart(p, pw.url(tmp), { day: 10 });
  await p.waitForFunction(() => window.__dbg && window.__dbg.D, null, { timeout: 60000 });
  await p.evaluate(() => { const d = __dbg; d.D.nextArr = 1e9; for (let i = 0; i < 2; i++) d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; }); d.D.t = 300.5; d.tickDay(0.1); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + '_hall_banner.png', timeout: 120000 });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: out + '_hall.png', timeout: 120000 });
  await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 60000 });
  await p.keyboard.press('Space'); await p.waitForTimeout(1500); await pw.dismissCard(p); await p.waitForTimeout(800);
  await p.screenshot({ path: out + '_bar.png', timeout: 120000 });
  console.log(await p.evaluate(() => JSON.stringify({ chip: document.querySelector('#chClock').getBoundingClientRect().toJSON(), next: document.querySelector('#chMoney').getBoundingClientRect().toJSON(), bar: !!__dbg.BR })));
  await b.close();
})();
