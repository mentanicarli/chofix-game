// Замер кадров бара: чашка-модель (латте, холодное капучино, бамбл) против старой чашки (американано) на программном WebGL. Не входит в сборку.
// node scripts/spike/h12-perf.cjs ; нужна отладочная сборка dist/artifact.html.
const { chromium } = require('../../e2e/node_modules/playwright'); const path = require('path'); const fs = require('fs');
const pw = require('../../e2e/pw');
(async () => {
  const html = path.resolve('dist/artifact.html');
  const src = fs.readFileSync(html, 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, spawn, barOpen, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  const tmp = html.replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch(); const p = await pw.page(b);
  const HASHP = process.env.HP || '#dev-nopixi';
  await p.goto('about:blank'); await p.goto(pw.url(tmp) + HASHP); await p.waitForSelector('[data-sandbox]', { timeout: 30000 }); await p.waitForTimeout(400); await p.evaluate(() => window.__sandbox.start({ day: 30, profile: 'confident' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 10000 }); await p.waitForTimeout(500);
  await p.evaluate(() => { const d = window.__dbg; d.G.tutOff = true; if (!d.D.customers.length) d.spawn(); });
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 90000 });
  const cases = [['americano (старая чашка)', 'americano', '0.3', false], ['latte (модель)', 'latte', '0.3', false], ['icedcappuccino (модель, лёд)', 'icedcappuccino', '0.6', true], ['orange_bumble (модель, лёд)', 'orange_bumble', '0.6', true]];
  for (const rep of [0, 1]) for (const [name, key, size, cold] of cases) {
    await p.evaluate(({ key, size, cold }) => { const d = window.__dbg; d.resetBar(); const M = window.__MENUAPI, dk = M.drinkOfKey(key), c = d.D.customers[0]; c.drink = key; c.order.key = key; c.order.id = dk.id; c.order.name = M.drinkById[dk.id].name; c.order.size = size; c.order.cold = cold && /^iced/.test(key); c.order.food = null; c.pat = c.max = 9999; d.barOpen(c); }, { key, size, cold });
    await p.waitForTimeout(1500); await pw.dismissCard(p);
    await p.evaluate(() => { const B = window.__dbg.BR; B.ready = true; B.cup.ice = B.rc.ice || 0; });
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => new Promise((ok) => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = () => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; n++; if (t - t0 < 4000) requestAnimationFrame(f); else ok({ fps: +(n / ((t - t0) / 1000)).toFixed(1), worstMs: +worst.toFixed(0) }); }; requestAnimationFrame(f); }));
    if (rep) console.log(name, JSON.stringify(r));
  }
  await b.close();
})();
