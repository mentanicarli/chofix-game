/* Замер бара (Н1-3): время WORLD.paintBar (мс на вызов) и кадры в секунду при открытом баре; инструмент для сравнения «до/после», не тест.
   CHROMIUM_ARGS=--mute-audio node e2e/paint_time.js out/base-debug.html [секунд=6] [повторов=3]
   Заказы: латте 0,3, холодное капучино 0,4, бамбл 0,6 (пилот) и американо 0,3 (контроль, старая отрисовка). Отладочная сборка. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const SEC = Number(process.argv[3] || 6), REP = Number(process.argv[4] || 3);
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { MENUAPI: window.__MENUAPI, get G() { return G; }, get D() { return D; }, get BR() { return BR; }, SBX, WORLD, spawn, barOpen, barShow, applyUpgrades, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.pt.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: (process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean) });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css }));
  await p.goto('about:blank'); await p.goto(PW.url(tmp) + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400);
  await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 });
  await p.waitForFunction(() => window.__dbg && window.__dbg.G);
  await p.evaluate(() => { const G = __dbg.G; ['ice', 'tea', 'matcha', 'powders', 'juice', 'blender', 'boba'].forEach(k => G['eq_' + k] = true); G.milk = true; G.tutOff = true; G.hints = false; __dbg.applyUpgrades(); __dbg.D.nextArr = 1e9; __dbg.SBX.next = { drink: 'latte', size: '0.3', cold: false }; __dbg.spawn(); __dbg.D.customers.forEach(c => { c.pat = c.max = 1e9; }); });
  await p.waitForTimeout(1500);
  for (const [id, size, cold] of [['latte', '0.3', false], ['cappuccino', '0.4', true], ['orange_bumble', '0.6', true], ['americano', '0.3', false]]) {
    const rs = [];
    for (let r = 0; r < REP; r++) {
      await p.evaluate(() => __dbg.resetBar());
      await p.evaluate(({ id, size, cold }) => { const M = __dbg.MENUAPI, c = __dbg.D.customers[0], dk = M.drinkById[id]; c.drink = id; c.order.key = id; c.order.id = id; c.order.name = dk.name; c.order.size = size; c.order.cold = cold; c.order.food = null; c.syrup = null; c.pat = c.max = 1e9; __dbg.G.tutOff = true; __dbg.barOpen(c); }, { id, size, cold });
      await p.waitForTimeout(500); await PW.dismissCard(p);
      await p.evaluate(() => { const B = __dbg.BR, rc = B.rc, f = 0.7; B.cup.es = (rc.shots || 0) * 30; if (rc.water) B.cup.water = rc.water * f; if (rc.milk) B.cup.milk = rc.milk * f; if (rc.ice) B.cup.ice = rc.ice; B.cup.level = f; });
      await p.waitForTimeout(2500); /* прогрев: текстуры модели грузятся асинхронно */
      const m = await p.evaluate(async (sec) => {
        const W = __dbg.WORLD, o = W.paintBar.bind(W); let n = 0, tot = 0, mx = 0; W.paintBar = f => { const t = performance.now(); o(f); const d = performance.now() - t; n++; tot += d; if (d > mx) mx = d; };
        let fr = 0; const t0 = performance.now(); await new Promise(res => { const f = () => { fr++; if (performance.now() - t0 > sec * 1000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
        W.paintBar = o; return { calls: n, avg: n ? tot / n : 0, max: mx, fps: fr / sec };
      }, SEC);
      rs.push(m);
    }
    const avg = k => rs.reduce((a, x) => a + x[k], 0) / rs.length;
    console.log(`${id}_${size}${cold ? '_cold' : ''}\tpaint avg ${avg('avg').toFixed(4)} ms\tmax ${Math.max(...rs.map(x => x.max)).toFixed(2)} ms\tcalls ${avg('calls').toFixed(0)}\tfps ${avg('fps').toFixed(1)}`);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
