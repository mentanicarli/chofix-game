const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, barShow, barOpen, applyUpgrades, WORLD };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await require('./pw').page(b);
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CERR', m.text().slice(0, 200)); });
  await p.goto('file://' + tmp + (process.env.HASH || '#nopixi-lowfx')); await p.waitForTimeout(3500);
  await require('./pw').startNew(p); await p.waitForTimeout(300);
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 60000 });
  await p.evaluate(() => { const G = window.__dbg.G; ['ice', 'tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker', 'case_snacks', 'case_pastry', 'case_dessert', 'fridge_deli', 'microwave'].forEach(k => G['eq_' + k] = true); window.__dbg.applyUpgrades(); });
  await p.keyboard.press('Space'); await p.waitForTimeout(2500); await require('./pw').dismissCard(p);
  await p.evaluate(() => { const D = window.__dbg.D; D.customers.forEach(c => c.pat = c.max = 9999); });
  if (process.env.HIDE !== '0') await p.evaluate(() => { ['#tint', '#hud', '#bTk', '#bCoach', '#boot'].forEach(s => { const e = document.querySelector(s); if (e) e.style.display = 'none'; }); });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.resolve(process.argv[3]), timeout: 120000 });
  await b.close();
})();
