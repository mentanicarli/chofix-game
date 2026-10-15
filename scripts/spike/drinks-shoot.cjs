// Реальные кадры для макетов моделей напитков (Н0): бар без чашки (мир без интерфейса и тонировки) и зал с гостями в очереди.
// node scripts/spike/drinks-shoot.cjs <outDir>; нужна отладочная сборка dist/artifact.html. Не входит в сборку.
const { chromium } = require('../../e2e/node_modules/playwright'); const path = require('path'); const fs = require('fs');
const pw = require('../../e2e/pw');
(async () => {
  const out = path.resolve(process.argv[2]); fs.mkdirSync(out, { recursive: true });
  const html = path.resolve('dist/artifact.html');
  const src = fs.readFileSync(html, 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, get WORLD() { return WORLD; }, spawn, barOpen, applyUpgrades };');
  const tmp = html.replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch();
  const DPR = +(process.env.DPR || 1); const p = await b.newPage({ viewport: { width: 1312, height: 752 }, deviceScaleFactor: DPR }); await p.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: pw.css }));
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('file://' + tmp + '#nopixi-lowfx'); await p.waitForTimeout(3500);
  await pw.startNew(p); await p.waitForTimeout(300);
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 90000 });
  await p.evaluate(() => { const G = window.__dbg.G; ['ice', 'case_snacks', 'case_pastry', 'case_dessert', 'fridge_deli', 'microwave', 'cream'].forEach((k) => (G['eq_' + k] = true)); G.milk = true; window.__dbg.applyUpgrades(); window.__dbg.D.customers.forEach((x) => (x.pat = x.max = 9999)); window.__dbg.G.tutOff = true; });
  /* зал: три гостя в очереди */
  await p.evaluate(() => { const D = window.__dbg.D; for (let i = D.customers.length; i < 3; i++) window.__dbg.spawn(); });
  await p.waitForFunction(() => window.__dbg.D.customers.length >= 3 && window.__dbg.D.customers.every((c) => c.arrived), null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const box = await p.evaluate(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await p.screenshot({ path: out + '/hall.png', clip: box, timeout: 120000 });
  const info = await p.evaluate(() => window.__dbg.D.customers.map((c) => ({ px: c.px, drink: c.drink, size: c.order && c.order.size })));
  fs.writeFileSync(out + '/hall.json', JSON.stringify({ box, info }, null, 1));
  /* бар без чашки */
  await p.evaluate(() => { const M = window.__MENUAPI, c = window.__dbg.D.customers[0], dk = M.drinkById['latte']; c.drink = 'latte'; c.order.key = 'latte'; c.order.id = 'latte'; c.order.name = dk.name; c.order.size = '0.2'; c.order.cold = false; c.order.food = null; c.syrup = null; c.pumps = 0; window.__dbg.barOpen(c); });
  await p.waitForTimeout(1500); await pw.dismissCard(p);
  await p.evaluate(() => { window.__dbg.WORLD.bar.cupC.alpha = 0; });
  await p.addStyleTag({ content: '#stage > *:not(#world){visibility:hidden !important} #tint{display:none !important}' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/bar_nocup.png', clip: box, timeout: 120000 });
  await b.close();
})();
