/* Нижняя полоса бара (y 520–720) на трёх размерах окна, день и вечер, 1× и 2× (этап 12.3(2), 24б; инструмент для глаз, не тест).
   Отладочная сборка. node e2e/art_under_shot.js out/s5/it3.html out/s5/under */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'out/s5/under'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, WORLD, spawn, tickDay, barOpen, barShow, applyUpgrades, zoneClick, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const errs = [];
  for (const [vw, vh] of [[1280, 720], [1536, 864], [1024, 600]]) for (const dsf of [1, 2]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dsf }); const p = await ctx.newPage();
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs);
    await p.goto('about:blank'); await p.goto(PW.url(tmp) + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400);
    await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 });
    await p.evaluate(() => { const d = __dbg; d.D.nextArr = 1e9; d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; c.syrup = null; }); d.G.tutOff = true; d.G.hints = false; });
    await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
    await p.evaluate(() => { __dbg.barOpen(__dbg.D.customers[0]); });
    await p.waitForTimeout(900); await PW.dismissCard(p);
    await p.evaluate(() => { const G = __dbg.G; ['case_snacks', 'case_pastry', 'case_dessert', 'fridge_deli', 'microwave', 'ice', 'tea', 'matcha', 'powders'].forEach(k => { G['eq_' + k] = true; }); __dbg.applyUpgrades(); });
    await p.waitForTimeout(600);
    const box = await p.evaluate(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const k = box.h / 720; const clip = { x: Math.max(0, box.x), y: box.y + 520 * k, width: Math.min(box.w, vw), height: 200 * k };
    const tag = `${vw}x${vh}_${dsf}x`;
    await p.screenshot({ path: `${out}/day_${tag}.png`, timeout: 120000, clip });
    await p.evaluate(() => { __dbg.D.t = 270; __dbg.tickDay(0.1); }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/eve_${tag}.png`, timeout: 120000, clip });
    await ctx.close();
  }
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
