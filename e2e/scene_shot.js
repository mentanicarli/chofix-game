/* Кадр зала: гость у стойки, сидящий гость с чашкой, бариста. Запуск (отладочная сборка): node e2e/scene_shot.js dist/artifact.html out/scene [look] */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { WORLD, lookFor, get G() { return G; }, get D() { return D; } };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const out = process.argv[3] || 'out/scene';
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const p = await require('./pw').page(b); require('./pw').watch(p, errs);
  await p.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__hold = false; window.requestAnimationFrame = cb => window.__hold ? 0 : raf(cb); });
  await p.goto(require('./pw').url(tmp) + (process.env.HASH || '#nopixi-lowfx')); await p.waitForTimeout(2500);
  await require('./pw').startNew(p); await p.waitForTimeout(800);
  await p.addStyleTag({ content: '#screen,#hud,#hudR,#tint,#boot,#bar,#frontHint,#banner,.say{display:none!important}' });
  await p.evaluate(() => { window.__hold = true; });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const { WORLD } = window.__dbg; window.__step = n => { for (let i = 0; i < n; i++) WORLD.update(1 / 30, 0.3, 480); }; });
  await p.evaluate(() => { const { WORLD } = window.__dbg; const real = Math.random; WORLD.sitT = 0; Math.random = () => 0.05; WORLD.update(1 / 30, 0.3, 480); Math.random = real; });
  for (let i = 0; i < 40; i++) { await p.evaluate(() => window.__step(30)); if (await p.evaluate(() => window.__dbg.WORLD.sitSt === 'seated')) break; }
  await p.evaluate(() => { window.__step(90); });
  await p.evaluate((kind) => {
    const { WORLD, lookFor } = window.__dbg;
    const a = WORLD.addActor({ look: lookFor(kind), icon: '', iconKey: '', title: 'Латте', tags: [], x: 640, onTap: () => undefined });
    window.__guest = a; for (let i = 0; i < 60; i++) { a.update(1 / 30, 640, 0); WORLD.update(1 / 30, 0.3, 480); }
  }, process.argv[4] || 'student');
  await p.waitForTimeout(2500);
  await p.evaluate(() => { for (let i = 0; i < 60; i++) { window.__guest.update(1 / 30, 640, 0); window.__dbg.WORLD.update(1 / 30, 0.3, 480); } window.__dbg.WORLD.app.render(); });
  await p.screenshot({ path: out + '.png', timeout: 120000 });
  await p.screenshot({ path: out + '_cup.png', clip: { x: 260, y: 440, width: 200, height: 120 }, timeout: 120000 });
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'NO_ERRORS');
  await b.close();
})();
