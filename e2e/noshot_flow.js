/* Напитки без шота: заливка по клику на чашку (баг №17: «Шот не нужен») и регресс для латте с шотом.
   node e2e/noshot_flow.js dist/artifact.html out/noshot   (отладочная сборка: CUPPABLE_DEBUG=1 npx vite build && CUPPABLE_DEBUG=1 node scripts/fragment.mjs)
   Песочница: день 40, «Уверенный», «Всё доступное» — открыто всё оборудование (матча, порошки, сок/тоник, льдогенератор, пенка и т. д.), ранг 9 и молоко; свои покупки не задаём. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const pw = require('./pw');
const CASES = [['matcha_latte', '0.6', false], ['matcha_coconut', '0.4', false], ['matcha_bumble', '0.3', true], ['matcha_tonic', '0.3', true], ['cocoa', '0.4', false], ['chicory_latte', '0.3', false]];
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, barOpen, spawn, barAbort };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const out = process.argv[3] || 'out/noshot';
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await pw.page(b); const errs = []; pw.watch(p, errs);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
  await pw.sandboxStart(p, pw.url(tmp), { day: 40, profile: 'confident' }); await p.waitForTimeout(400);
  const ic = async (x, y) => { const r = await p.evaluate(() => { const r = document.querySelector('#bi').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); return [r[0] + x * r[2] / 440, r[1] + y * r[3] / 450]; };
  const zone = z => p.click(`[data-z=${z}]`, { force: true });
  const waitFor = (fn, arg, to = 40000) => p.waitForFunction(fn, arg, { timeout: to, polling: 30 });
  const done = async () => { const [x, y] = await ic(353, 384); await p.mouse.click(x, y); await p.waitForTimeout(250); };
  const hold = async (fn, arg) => { const [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down(); await waitFor(fn, arg); await p.mouse.up(); };
  const order = async (id, size, cold) => {
    await p.evaluate(() => { const d = window.__dbg; if (!d.D.customers.length) d.spawn(); });
    await waitFor(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, 60000);
    await p.evaluate(({ id, size, cold }) => {
      const M = window.__MENUAPI, G = window.__dbg.G, eq = {};
      Object.keys(G).forEach(k => { if (/^eq_/.test(k) && G[k]) eq[k.slice(3)] = true; });
      const o = M.rollOrder({ rank: G.rank, day: G.day, milk: true, eq, override: { drink: id, size, cold } }, 'regular');
      const c = window.__dbg.D.customers[0]; c.order = o; c.drink = o.key; c.order.food = null; c.strong = false; c.pat = c.max = 9999;
      c.syrup = o.syrup ? 'vanilla' : null; c.pumps = 2;
    }, { id, size, cold });
    await p.evaluate(() => { window.__dbg.G.hints = true; });
    await p.keyboard.press('Space'); await p.waitForTimeout(700); await pw.dismissCard(p);
  };
  const msgs = () => p.evaluate(() => [...document.querySelectorAll('#bFloat .bmsg')].map(e => e.textContent).join('|'));

  for (const [id, size, cold] of CASES) {
    await order(id, size, cold);
    const info = await p.evaluate(() => { const B = window.__dbg.BR; return { drink: B.drink, tasks: B.tasks.join(','), size: B.c.order.size, cold: !!B.c.order.cold, pit: B.pitCap, milk: B.rc.milk }; });
    console.log(id, size, JSON.stringify(info));
    ok(!info.tasks.includes('shot') && /pour|layer/.test(info.tasks), id + ': в рецепте нет шота, есть заливка (pour или layer)');
    let pourMsg = '';
    for (const t of await p.evaluate(() => window.__dbg.BR.tasks.slice())) {
      let x, y;
      if (t === 'syrup') {
        await zone('syr1'); await p.waitForTimeout(300); let [sx, sy] = await ic(82, 112); await p.mouse.click(sx, sy); await p.waitForTimeout(200); await p.mouse.click(sx, sy); await p.waitForTimeout(300);
        [sx, sy] = await ic(357, 408); await p.mouse.click(sx, sy); await p.waitForTimeout(300);
      } else if (t === 'ice') { await zone('ice'); await p.waitForTimeout(250); await hold(() => window.__dbg.BR.cup.ice >= window.__dbg.BR.rc.ice - 1); await done(); }
      else if (t === 'milk') { await zone('milk'); await p.waitForTimeout(250); await hold(() => window.__dbg.BR.fill >= window.__dbg.BR.rc.milk - 2); await done(); }
      else if (t === 'steam') {
        await zone('steam'); await p.waitForTimeout(200);
        [x, y] = await ic(150, 200); await p.mouse.move(x, y); await p.mouse.down();
        for (let i = 0; i < 600; i++) {
          const s = await p.evaluate(() => { const B = window.__dbg.BR; return { pit: B.pit, cap: B.pitCap, lo: B.rc.zone[0], tf: B.rc.foam }; });
          const surf = 330 - ((s.pit.ml + s.pit.es) * (1 + .6 * s.pit.foam) / s.cap) * 220;
          const air = s.pit.foam < s.tf - .02 && s.pit.T < 44;
          const [mx, my] = await ic(150, air ? surf + 6 : surf + 40); await p.mouse.move(mx, my);
          if (s.pit.T >= s.lo + 1.2) break; await p.waitForTimeout(40);
        }
        await p.mouse.up(); [x, y] = await ic(353, 410); await p.mouse.click(x, y); await p.waitForTimeout(250);
      } else if (t === 'layer') {
        /* слоями: клик именно по чашке (зона pour), раньше он уходил на «Шот не нужен» */
        await zone('pour'); await p.waitForTimeout(500);
        ok(await p.evaluate(() => window.__dbg.BR.inset) === 'layer', id + ': клик по чашке открыл слои (сообщение: «' + await msgs() + '»)');
        const box = await p.locator('[data-xhold]').boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
        await waitFor(() => { const s = window.__dbg.BR.xs.layer; return s.t >= s.target - 0.05; });
        await p.mouse.up(); await p.click('[data-xdone]'); await p.waitForTimeout(500);
      } else if (t === 'pour') {
        await zone('pour'); await p.waitForTimeout(300); pourMsg = await msgs();
        ok(await p.evaluate(() => window.__dbg.BR.inset) === 'pour', id + ': клик по чашке открыл заливку (сообщение: «' + pourMsg + '»)');
        ok(!/Шот не нужен/.test(pourMsg), id + ': нет «Шот не нужен»');
        const guide = await p.evaluate(() => { const g = []; const N = 40; for (let k = 0; k <= N; k++) { const u = k / N; g.push([220 + 36 * Math.sin(u * Math.PI * 5) * (1 - u * .4), 305 - 200 * u]); } return g; });
        let [gx, gy] = await ic(guide[0][0], guide[0][1]); await p.mouse.move(gx, gy); await p.mouse.down();
        for (let r = 0; r < 6; r++) for (const q of guide) { const [qx, qy] = await ic(q[0], q[1]); await p.mouse.move(qx, qy, { steps: 2 }); if (await p.evaluate(() => window.__dbg.BR.inset) !== 'pour') break; await p.waitForTimeout(18); }
        await p.mouse.up(); await p.waitForTimeout(300);
      } else {
        /* станции-панели: матча, порошок, сок, тоник, пенка и т. д. — держим кнопку до цели и жмём «Готово» */
        const zn = await p.evaluate(t => window.__MENUAPI.TASK_ZONE[t], t); await zone(zn); await p.waitForTimeout(500);
        const box = await p.locator('[data-xhold]').boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
        await waitFor(t => { const s = window.__dbg.BR.xs[t]; return s.ml !== undefined ? s.ml >= s.target - 0.2 : s.t >= s.target - 0.05; }, t);
        await p.mouse.up(); await p.click('[data-xdone]'); await p.waitForTimeout(500);
      }
    }
    if (id === 'matcha_latte') { await p.screenshot({ path: `${out}_${id}_ready.png` }); }
    const s0 = await p.evaluate(() => window.__dbg.D.stats.served);
    await zone('bell'); await p.waitForTimeout(1500);
    const s1 = await p.evaluate(() => window.__dbg.D.stats.served);
    ok(s1 === s0 + 1, id + ' ' + size + ': подано, served ' + s0 + ' -> ' + s1);
    await p.waitForTimeout(800);
  }

  /* регресс: у латте с шотом клик по чашке до шота ведёт к группе (шот), а не к заливке */
  await order('latte', '0.2', false);
  await p.evaluate(() => { const B = window.__dbg.BR; B.done.milk = true; B.done.steam = true; });
  await zone('pour'); await p.waitForTimeout(400);
  ok(/Сначала помол/.test(await msgs()) && await p.evaluate(() => window.__dbg.BR.inset) === null, 'латте: без помола клик по чашке говорит «Сначала помол и темпер», не «Шот не нужен»');
  await p.evaluate(() => { const B = window.__dbg.BR; B.done.grind = true; B.done.tamp = true; });
  await zone('pour'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__dbg.BR.inset) === 'shot', 'латте: клик по чашке до шота открывает группу (шот)');
  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
