/* Полный заказ в баре на реальных событиях мыши: помол → темпер → шот (по числу шотов) → вода/молоко/сливки → пар → заливка → подача.
   node e2e/bar_test2.js dist/artifact.html out/bar latte            — один заказ (размер 0,2 л)
   node e2e/bar_test2.js dist/artifact.html out/bar latte:0.4        — с размером
   node e2e/bar_test2.js dist/artifact.html out/bar espresso2,cappuccino:0.4,raf:0.2   — несколько заказов подряд в одном прогоне
   Ключи механики: espresso, espresso2 (двойной), americano, icedamericano, cappuccino, icedcappuccino, latte, icedlatte, flatwhite, raf, vanillaraf, rafhalva.
   Цели берутся из самой игры (BR.rc: шоты, молоко, вода, лёд, зона пара), поэтому сценарий не зависит от размера. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const specs = (process.argv[4] || 'espresso').split(',').map(s => { const [drink, size] = s.split(':'); return { drink, size: size || '0.2' }; });
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, endDay, barOpen, spawn };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const out = process.argv[3];
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await require('./pw').page(b);
  const errs = []; require('./pw').watch(p, errs);
  await p.addInitScript(() => { let a = 1234567; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; /* mulberry32: детерминированный прогон */ });
  /* песочница: день 6, «Средний», всё доступное: ранг 3 с молоком и льдогенератором */
  await require('./pw').sandboxStart(p, require('./pw').url(tmp), { day: 6, profile: 'medium' }); await p.waitForTimeout(400);
  const st = () => p.evaluate(() => { const B = window.__dbg.BR; return B ? { inset: B.inset, shot: B.shotIdx + '/' + B.shots, dose: +B.dose.toFixed(1), un: +B.uneven.toFixed(2), tp: B.tampPhase, P: +B.tampP.toFixed(1), sh: B.shot.st, ml: +B.shot.ml.toFixed(1), t: +B.shot.t.toFixed(1), done: Object.keys(B.done).join(','), ready: B.ready, res: JSON.stringify(B.res), pit: JSON.stringify(B.pit), lvl: B.pourLevel } : null; });
  const ic = async (x, y) => { const r = await p.evaluate(() => { const r = document.querySelector('#bi').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); return [r[0] + x * r[2] / 440, r[1] + y * r[3] / 450]; };
  const zone = z => p.click(`[data-z=${z}]`, { force: true });
  const waitFor = (fn, arg, to = 30000) => p.waitForFunction(fn, arg, { timeout: to, polling: 30 });
  const done = async () => { const [x, y] = await ic(353, 384); await p.mouse.click(x, y); await p.waitForTimeout(250); };
  const hold = async (fn, arg) => { const [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down(); await waitFor(fn, arg); await p.mouse.up(); };

  const make = async (drink, size, tag) => {
    await p.evaluate(() => { const d = window.__dbg; if (!d.D.customers.length) d.spawn(); });
    await waitFor(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, 60000);
    await p.evaluate(({ d, size }) => {
      const M = window.__MENUAPI, dk = M.drinkOfKey(d), cold = /^iced/.test(d), c = window.__dbg.D.customers[0];
      c.drink = d; c.order.key = d; c.order.id = dk.id; c.order.name = M.drinkById[dk.id].name; c.order.size = size; c.order.cold = cold; c.order.food = null;
      c.order.shots = M.legacyRecipe(d, size, cold).shots; c.strong = false; c.syrup = d === 'vanillaraf' ? 'vanilla' : null; c.pumps = 2; c.pat = c.max = 999;
    }, { d: drink, size });
    await p.evaluate(() => { window.__dbg.G.hints = true; });
    await p.keyboard.press('Space'); await p.waitForTimeout(600); await require('./pw').dismissCard(p);
    const info = await p.evaluate(() => { const B = window.__dbg.BR; return { drink: B.drink, shots: B.shots, tasks: B.exp.join(','), rc: JSON.stringify(B.rc) }; });
    console.log(tag, 'заказ', JSON.stringify(info));
    await p.screenshot({ path: `${out}_${tag}_0bar.png` });
    const exp = await p.evaluate(() => window.__dbg.BR.exp.slice());
    let shotN = 0;
    for (const t of exp) {
      let x, y;
      if (t === 'syrup') {
        await zone('syr1'); await p.waitForTimeout(300); let [sx, sy] = await ic(82, 112); await p.mouse.click(sx, sy); await p.waitForTimeout(200); await p.mouse.click(sx, sy); await p.waitForTimeout(300);
        [sx, sy] = await ic(357, 408); await p.mouse.click(sx, sy); await p.waitForTimeout(300);
      } else if (t === 'grind') {
        await zone('grind'); await p.waitForTimeout(300);
        [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down();
        await waitFor(() => window.__dbg.BR.dose >= window.__dbg.BR.tgtDose - 0.3); await p.mouse.up();
        [x, y] = await ic(353, 384); await p.mouse.click(x, y); await p.waitForTimeout(200);
      } else if (t === 'tamp') {
        await zone('tamp'); await p.waitForTimeout(300);
        [x, y] = await ic(220, 190); await p.mouse.move(x, y); await p.mouse.down();
        for (let i = 0; i < 80 && (await st()).tp === 'level'; i++) { const a = i / 4; await p.mouse.move(x + Math.cos(a) * 70, y + Math.sin(a) * 70, { steps: 3 }); }
        await p.mouse.up();
        [x, y] = await ic(210, 384); await p.mouse.move(x, y); await p.mouse.down();
        await waitFor(() => window.__dbg.BR.tampP >= 14.6); await p.mouse.up(); await p.waitForTimeout(250);
      } else if (t === 'shot') {
        await zone('shot'); await p.waitForTimeout(250);
        [x, y] = await ic(220, 384); await p.mouse.click(x, y); await p.waitForTimeout(150); await p.mouse.click(x, y);
        await p.waitForTimeout(2500); await p.screenshot({ path: `${out}_${tag}_4shot${++shotN}.png` });
        await waitFor(() => window.__dbg.BR.shot.ml >= window.__dbg.BR.tgtMl - .8 || window.__dbg.BR.shot.st !== 'run', null, 40000);
        await zone('stop'); await p.waitForTimeout(400);
        console.log(tag, 'шот', shotN, await st());
      } else if (t === 'ice') {
        await zone('ice'); await p.waitForTimeout(250);
        await hold(() => window.__dbg.BR.cup.ice >= window.__dbg.BR.rc.ice - 1); await p.screenshot({ path: `${out}_${tag}_5ice.png` }); await done();
      } else if (t === 'water') {
        await zone('water'); await p.waitForTimeout(250);
        await hold(() => window.__dbg.BR.cup.water >= window.__dbg.BR.rc.water - 2); await p.screenshot({ path: `${out}_${tag}_6water.png` }); await done();
      } else if (t === 'milk') {
        await zone('milk'); await p.waitForTimeout(250);
        await hold(() => window.__dbg.BR.fill >= window.__dbg.BR.rc.milk - 2); await p.screenshot({ path: `${out}_${tag}_6milk.png` }); await done();
      } else if (t === 'steam') {
        await zone('steam'); await p.waitForTimeout(200);
        [x, y] = await ic(150, 200); await p.mouse.move(x, y); await p.mouse.down();
        for (let i = 0; i < 600; i++) {
          const s = await p.evaluate(() => { const B = window.__dbg.BR; return { pit: B.pit, cap: B.pitCap, lo: B.rc.zone[0], tf: B.rc.foam }; });
          const surf = 330 - ((s.pit.ml + s.pit.es) * (1 + .6 * s.pit.foam) / s.cap) * 220;
          const air = s.pit.foam < s.tf - .02 && s.pit.T < 44;
          const [mx, my] = await ic(150, air ? surf + 6 : surf + 40); await p.mouse.move(mx, my);
          if (s.pit.T >= s.lo + 1.2) break; await p.waitForTimeout(40);
        }
        await p.screenshot({ path: `${out}_${tag}_7steam.png` }); await p.mouse.up();
        console.log(tag, 'пар', await st());
        [x, y] = await ic(353, 410); await p.mouse.click(x, y); await p.waitForTimeout(250);
      } else if (t === 'pour') {
        await zone('pour'); await p.waitForTimeout(250);
        const guide = await p.evaluate(() => { const g = []; const c = window.__dbg.BR.c.art; const N = 40; for (let k = 0; k <= N; k++) { if (c === 'heart') { const t = Math.PI + k / N * Math.PI * 2, s = 4.6; g.push([220 + 16 * Math.pow(Math.sin(t), 3) * s, 205 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s * .95 + 8]); } else { const u = k / N; g.push([220 + 36 * Math.sin(u * Math.PI * 5) * (1 - u * .4), 305 - 200 * u]); } } return g; });
        let [gx, gy] = await ic(guide[0][0], guide[0][1]); await p.mouse.move(gx, gy); await p.mouse.down();
        for (let r = 0; r < 6; r++) for (const q of guide) { const [qx, qy] = await ic(q[0], q[1]); await p.mouse.move(qx, qy, { steps: 2 }); if (!(await st()) || (await st()).inset !== 'pour') break; await p.waitForTimeout(18); if (r === 0 && q === guide[20]) await p.screenshot({ path: `${out}_${tag}_8pour.png` }); }
        await p.mouse.up(); await p.waitForTimeout(300);
        console.log(tag, 'заливка', await st());
      }
    }
    await p.screenshot({ path: `${out}_${tag}_9ready.png` });
    const served0 = await p.evaluate(() => window.__dbg.D.stats.served);
    await zone('bell'); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}_${tag}_10served.png`, timeout: 120000 });
    console.log(tag, 'served', served0, '->', await p.evaluate(() => window.__dbg.D.stats.served), 'money', await p.evaluate(() => window.__dbg.G.money));
    await p.waitForTimeout(1500);
  };
  for (let i = 0; i < specs.length; i++) await make(specs[i].drink, specs[i].size, `${i + 1}_${specs[i].drink}_${specs[i].size}`);
  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
