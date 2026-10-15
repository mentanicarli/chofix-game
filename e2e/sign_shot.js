/* Кадры вывески: титул, экран темпа, зал, бар (1× и 2×). node e2e/sign_shot.js dist/artifact.html out/sign/before */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, barShow, barOpen, showPace, WORLD };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const out = process.argv[3];
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const dsf of [1, 2]) {
    const ctx = await b.newContext({ viewport: { width: 1312, height: 752 }, deviceScaleFactor: dsf });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text().slice(0, 300)); });
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: require('./pw').css }));
    await p.goto('file://' + tmp + '#nopixi-lowfx'); await p.waitForTimeout(3000);
    await p.screenshot({ path: `${out}_title_${dsf}x.png` });
    await p.click('[data-start]'); await p.waitForSelector('[data-go]'); await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}_pace_${dsf}x.png` });
    await p.click('[data-go]'); await p.waitForTimeout(400);
    await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}_hall_${dsf}x.png` });
    await p.keyboard.press('Space'); await p.waitForTimeout(2500); await require('./pw').dismissCard(p);
    await p.evaluate(() => { window.__dbg.D.customers.forEach(c => c.pat = c.max = 9999); ['#tint', '#hud', '#bTk', '#bCoach'].forEach(s => { const e = document.querySelector(s); if (e) e.style.display = 'none'; }); });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}_bar_${dsf}x.png`, timeout: 120000 });
    console.log(dsf, 'ERRS', errs.slice(0, 5).join('|'));
    await ctx.close();
  }
  await b.close();
})();
