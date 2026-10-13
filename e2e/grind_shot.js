/* Цифра помола в инсете «Кофемолка»: все значения, Pixi (#pixi) и старый canvas (#nopixi). node e2e/grind_shot.js dist/artifact.html out/grind */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; } };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  for (const mode of ['nopixi', 'pixi']) {
    const p = await require('./pw').page(b); const errs = []; require('./pw').watch(p, errs);
    await p.goto(require('./pw').url(tmp) + '#' + mode + '-lowfx'); await p.waitForTimeout(600); await require('./pw').startNew(p); await p.waitForTimeout(400);
    await p.evaluate(() => { window.__dbg.G.day = 2; window.__dbg.G.rank = 3; window.__dbg.G.hints = false; });
    await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 40000 });
    await p.evaluate(() => { const c = window.__dbg.D.customers[0]; c.drink = 'espresso'; c.pat = c.max = 9999; });
    await p.keyboard.press('Space'); await p.waitForTimeout(600); await require('./pw').dismissCard(p); await p.click('[data-z=grind]', { force: true }); await p.waitForTimeout(700);
    for (const v of [1, 3, 5]) {
      await p.evaluate(v => { window.__dbg.G.grindSet = v; }, v); await p.waitForTimeout(500);
      await p.screenshot({ path: `${process.argv[3]}_${mode}_${v}.png`, clip: { x: 16, y: 218, width: 220, height: 240 }, timeout: 60000 });
    }
    console.log(mode, errs.length ? errs.join('\n') : 'NO_ERRORS'); await p.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
