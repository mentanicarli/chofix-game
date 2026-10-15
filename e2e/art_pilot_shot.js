/* Скриншоты пилота 12.3(0): сидячее место в зале и чашка в баре, 1× и 2× (инструмент для глаз, не тест). Отладочная сборка.
   node e2e/art_pilot_shot.js dist/artifact.html out/pilot/before [hall,cups]
   hall: зал с очередью и сидящим (день и вечер), крупный план столика;  cups: чашки 0,3/0,4/0,6 л, уровни 0, 1/3, 2/3, полная, разные напитки. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'out/pilot/shot'); fs.mkdirSync(out, { recursive: true });
const parts = (process.argv[4] || 'hall,cups').split(','); const on = k => parts.includes(k);
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, WORLD, spawn, tickDay, barOpen, barShow, applyUpgrades, zoneClick, barPaint, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const errs = [];
  const mk = async (dsf) => { const ctx = await b.newContext({ viewport: { width: 1312, height: 752 }, deviceScaleFactor: dsf }); const p = await ctx.newPage(); await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs); return p; };
  const start = async (p) => { await p.goto('about:blank'); await p.goto(PW.url(tmp) + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400); await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 }); };
  const clip = (x, y, w, h) => ({ x: 16 + x, y: 16 + y, width: w, height: h });
  for (const dsf of [1, 2]) {
    const p = await mk(dsf); await start(p);
    await p.evaluate(() => { const G = __dbg.G; ['ice', 'tea', 'matcha', 'powders', 'juice', 'blender', 'boba'].forEach(k => G['eq_' + k] = true); G.milk = true; G.tutOff = true; G.hints = false; __dbg.applyUpgrades(); const d = __dbg.D; d.nextArr = 1e9; for (let i = 0; i < 3; i++) __dbg.spawn(); d.customers.forEach(c => { c.pat = c.max = 1e9; c.syrup = null; }); });
    if (on('hall')) {
      await p.waitForFunction(() => __dbg.D.customers.every(c => c.arrived), null, { timeout: 90000 }).catch(() => {});
      await p.waitForFunction(() => { const w = __dbg.WORLD; return w.sitter && w.sitSt === 'seated'; }, null, { timeout: 120000, polling: 200 }).catch(() => console.log('сидящий не дошёл'));
      await p.evaluate(() => document.querySelectorAll('#hud,#toast,.say,#hint').forEach(e => { e.style.visibility = 'hidden'; }));
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${out}/hall_day_${dsf}x.png`, timeout: 120000 });
      await p.screenshot({ path: `${out}/table_day_${dsf}x.png`, clip: clip(60, 440, 360, 270), timeout: 120000 });
      await p.evaluate(() => { __dbg.D.t = 270; __dbg.tickDay(0.1); }); await p.waitForTimeout(2500);
      await p.screenshot({ path: `${out}/table_evening_${dsf}x.png`, clip: clip(60, 440, 360, 270), timeout: 120000 });
      await p.evaluate(() => { __dbg.D.t = 120; __dbg.tickDay(0.1); });
    }
    if (on('cups')) {
      const order = async (id, size, cold) => {
        await p.evaluate(() => __dbg.resetBar());
        await p.evaluate(({ id, size, cold }) => { const M = window.__MENUAPI, c = __dbg.D.customers[0]; const dk = M.drinkById[id] || M.drinkById[M.drinkOfKey(id).id]; c.drink = id; c.order.key = id; c.order.id = dk.id || id; c.order.name = dk.name; c.order.size = size; c.order.cold = cold; c.order.food = null; c.syrup = null; c.pat = c.max = 1e9; __dbg.G.tutOff = true; __dbg.barOpen(c); }, { id, size, cold });
        await p.waitForTimeout(500); await PW.dismissCard(p);
        await p.evaluate(() => document.querySelectorAll('#hud,#bTk,#bCoach,#toast,#bFloat,#bGoal,#tint').forEach(e => { e.style.visibility = 'hidden'; }));
      };
      const level = async (f) => { await p.evaluate((f) => { const B = __dbg.BR, rc = B.rc; B.cup.es = f > 0.15 ? (rc.shots || 0) * 30 : 0; if (rc.water) B.cup.water = rc.water * f; if (rc.milk) { B.cup.milk = rc.milk * f; B.cup.foam = f > 0.9 ? rc.foam || 0 : 0; } if (rc.ice) B.cup.ice = rc.ice * f; B.cup.level = f; for (const t of B.exp) { const st = B.xs[t]; if (t === 'brew') { B.xs.brew = B.xs.brew || { minutes: 2, t: 0, temp: 80 }; B.xs.brew.t = B.xs.brew.minutes * f; } } }, f); await p.waitForTimeout(350); };
      const shot = async (name) => p.screenshot({ path: `${out}/cup_${name}_${dsf}x.png`, clip: clip(470, 330, 320, 210), timeout: 120000 });
      for (const sz of ['0.3', '0.4', '0.6']) { await order('americano', sz, false); for (const [n, f] of [['0', 0], ['33', 0.33], ['66', 0.66], ['100', 1]]) { await level(f); await shot(`americano_${sz}_${n}`); } }
      await order('latte', '0.4', false); await level(1); await shot('latte_0.4_100');
      await order('tea_sencha', '0.6', false); await p.evaluate(() => { const B = __dbg.BR; __dbg.zoneClick('brew'); }); for (const [n, f] of [['0', 0], ['100', 1]]) { await level(f); await shot(`tea_0.6_${n}`); }
      await order('espresso', '0.2', false); await level(1); await shot('espresso_100');
      await order('icedamericano', '0.4', true); for (const [n, f] of [['33', 0.33], ['100', 1]]) { await level(f); await shot(`icedamericano_0.4_${n}`); }
      await order('matcha_latte', '0.3', false); await level(1); await shot('matcha_0.3_100');
    }
    await p.context().close();
  }
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
