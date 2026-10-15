// Временный замер ширины билета #bTk для самых длинных названий (Б0). Не входит в сборку.
const { chromium } = require('../../e2e/node_modules/playwright'); const path = require('path'); const fs = require('fs');
const pw = require('../../e2e/pw');
(async () => {
  const html = path.resolve('dist/artifact.html');
  const src = fs.readFileSync(html, 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, spawn, barOpen, zoneClick, applyUpgrades, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  const tmp = html.replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch(); const p = await pw.page(b, { width: 1312, height: 752 });
  await p.goto('file://' + tmp + '#nopixi-lowfx'); await p.waitForTimeout(3500); await pw.startNew(p);
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 90000 });
  await p.evaluate(() => { const G = __dbg.G; G.milk = true; G.tutOff = true; __dbg.applyUpgrades(); });
  const ids = (process.env.IDS || 'espresso_double,latte_coconut,matcha_coconut,latte_banana,latte_lemon,raf_halva,boba_raspberry,cappuccino_pumpkin,pomegranate_bumble,flat_white').split(',');
  for (const id of ids) {
    await p.evaluate(() => __dbg.resetBar()); await p.waitForTimeout(150);
    await p.evaluate((id) => { const M = window.__MENUAPI, c = __dbg.D.customers[0], dk = M.drinkById[id]; c.drink = id; c.order.key = id; c.order.id = id; c.order.name = dk.name; c.order.size = Object.keys(dk.sizes).pop(); c.order.cold = false; c.order.food = null; c.syrup = null; c.pumps = 0; c.pat = c.max = 1e9; __dbg.barOpen(c); }, id);
    await p.waitForTimeout(500); await pw.dismissCard(p);
    const w = await p.evaluate(() => { const e = document.querySelector('#bTk'); const r = e.getBoundingClientRect(); const st = document.querySelector('#stage').getBoundingClientRect(); return [Math.round(r.x - st.x), Math.round(r.width), Math.round(r.height)]; });
    console.log(id, JSON.stringify(w));
  }
  await b.close();
})();
