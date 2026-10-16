// Скриншоты Н1-2: бар (латте, капучино гор./хол., бамбл 0,3 и 0,6 л), билет, пузыри в зале; 1280×720 и 1024×600, 1× и 2×.
// node scripts/spike/h12-shots.cjs <outDir> [vp=1280x720|1024x600] [dpr=1|2]; нужна отладочная сборка dist/artifact.html (CUPPABLE_DEBUG=1). Не входит в сборку игры.
const { chromium } = require('../../e2e/node_modules/playwright'); const path = require('path'); const fs = require('fs');
const pw = require('../../e2e/pw');
const OUT = path.resolve(process.argv[2] || 'docs/art/drinks/h1-2'); fs.mkdirSync(OUT, { recursive: true });
const VPS = { '1280x720': { width: 1312, height: 752 }, '1024x600': { width: 1056, height: 632 } };
const only = process.argv[3]; const onlyDpr = process.argv[4];
const CASES = [
  ['latte', 'latte', '0.3', false], ['latte', 'latte', '0.6', false],
  ['cappuccino_hot', 'cappuccino', '0.3', false], ['cappuccino_hot', 'cappuccino', '0.6', false],
  ['cappuccino_cold', 'icedcappuccino', '0.3', true], ['cappuccino_cold', 'icedcappuccino', '0.6', true],
  ['bumble', 'orange_bumble', '0.3', true], ['bumble', 'orange_bumble', '0.6', true]
];
(async () => {
  const html = path.resolve('dist/artifact.html');
  const src = fs.readFileSync(html, 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, get SBX() { return SBX; }, spawn, barOpen, applyUpgrades, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  const tmp = html.replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch();
  for (const [vpName, vp] of Object.entries(VPS)) for (const dpr of [1, 2]) {
    if (only && only !== vpName) continue; if (onlyDpr && +onlyDpr !== dpr) continue;
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: dpr }); await p.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: pw.css }));
    const errs = []; pw.watch(p, errs);
    await pw.sandboxStart(p, pw.url(tmp), { day: 30, profile: 'confident' }); await p.waitForTimeout(500);
    const box = await p.evaluate(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const sc = box.width / 1280; const tag = `${vpName}_${dpr}x`;
    const clip = (x, y, w, h) => ({ x: box.x + x * sc, y: box.y + y * sc, width: w * sc, height: h * sc });
    /* зал: три гостя с напитками пилота, пузыри заказов */
    await p.evaluate(() => { const d = window.__dbg; d.G.tutOff = true; d.D.customers.forEach((c) => (c.pat = c.max = 9999)); });
    for (const o of [{ drink: 'latte', size: '0.3', cold: false }, { drink: 'cappuccino', size: '0.6', cold: true }, { drink: 'orange_bumble', size: '0.3' }]) {
      await p.evaluate((o) => { const d = window.__dbg; d.SBX.next = o; d.spawn(); d.D.customers.forEach((c) => (c.pat = c.max = 9999)); }, o);
      await p.waitForTimeout(250);
    }
    await p.waitForFunction(() => window.__dbg.D.customers.length >= 3 && window.__dbg.D.customers.every((c) => c.arrived), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(OUT, `hall_bubbles_${tag}.png`), clip: clip(0, 0, 1280, 720), timeout: 120000 });
    await p.screenshot({ path: path.join(OUT, `hall_bubbles_zoom_${tag}.png`), clip: clip(300, 170, 440, 130), timeout: 120000 });
    /* бар: готовый напиток (ready → слои спецификации, лёд полностью) */
    for (const [name, key, size, cold] of CASES) {
      await p.evaluate(({ key, size, cold }) => {
        const d = window.__dbg; d.resetBar();
        if (!d.D.customers.length) d.spawn();
        const M = window.__MENUAPI, dk = M.drinkOfKey(key), c = d.D.customers[0];
        c.drink = key; c.order.key = key; c.order.id = dk.id; c.order.name = M.drinkById[dk.id].name; c.order.size = size; c.order.cold = cold && /^iced/.test(key); c.order.food = null; c.syrup = null; c.pumps = 0; c.pat = c.max = 9999; d.G.tutOff = true;
        d.barOpen(c);
      }, { key, size, cold });
      await p.waitForTimeout(1500); await pw.dismissCard(p);
      await p.evaluate(() => { const B = window.__dbg.BR; B.ready = true; B.cup.ice = B.rc.ice || 0; });
      await p.waitForTimeout(900);
      const nm = `${name}_${size.replace('.', '')}_${tag}`;
      await p.screenshot({ path: path.join(OUT, `bar_${nm}.png`), clip: clip(0, 0, 1280, 720), timeout: 120000 });
      await p.screenshot({ path: path.join(OUT, `cup_${nm}.png`), clip: clip(520, 330, 220, 190), timeout: 120000 });
      await p.screenshot({ path: path.join(OUT, `ticket_${nm}.png`), clip: clip(20, 70, 480, 70), timeout: 120000 });
    }
    console.log(tag, errs.length ? errs.join(' | ') : 'NO_ERRORS');
    await p.close();
  }
  await b.close();
})();
