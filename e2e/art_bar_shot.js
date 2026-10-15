/* Кадры бара для сравнения до/после (этап 12.3(1), инструмент для глаз, не тест): весь бар, ледогенератор, витрина с каждым набором еды, микроволновка, день и вечер, 1× и 2×.
   Отладочная сборка. node e2e/art_bar_shot.js out/s3/before.html out/s3/before */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'out/s3/shot'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, WORLD, spawn, tickDay, barOpen, barShow, applyUpgrades, zoneClick, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const errs = [];
  for (const dsf of [1, 2]) {
    const ctx = await b.newContext({ viewport: { width: 1312, height: 752 }, deviceScaleFactor: dsf }); const p = await ctx.newPage();
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs);
    await p.goto('about:blank'); await p.goto(PW.url(tmp) + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400);
    await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 });
    await p.evaluate(() => { const d = __dbg; d.D.nextArr = 1e9; __dbg.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; c.syrup = null; }); d.G.tutOff = true; d.G.hints = false; });
    await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
    await p.evaluate(() => { const c = __dbg.D.customers[0]; __dbg.barOpen(c); });
    await p.waitForTimeout(900); await PW.dismissCard(p);
    await p.evaluate(() => document.querySelectorAll('#hud,#bTk,#bCoach,#toast,#bFloat,#bGoal').forEach(e => { e.style.visibility = 'hidden'; }));
    const clip = (x, y, w, h) => ({ x: 16 + x, y: 16 + y, width: w, height: h });
    const set = async (flags) => { await p.evaluate((f) => { const G = __dbg.G; ['case_snacks', 'case_pastry', 'case_dessert', 'fridge_deli', 'microwave', 'ice'].forEach(k => { G['eq_' + k] = !!f[k]; }); __dbg.applyUpgrades(); }, flags); await p.waitForTimeout(500); };
    const shot = async (name, c) => p.screenshot({ path: `${out}/${name}_${dsf}x.png`, timeout: 120000, ...(c ? { clip: c } : {}) });
    const region = clip(315, 495, 490, 125);
    await set({ ice: true, case_snacks: true, case_pastry: true, case_dessert: true, fridge_deli: true, microwave: true });
    await shot('bar_full'); await shot('region_all', region);
    await set({ ice: true, case_snacks: true }); await shot('region_snacks', region);
    await set({ case_pastry: true }); await shot('region_pastry', region);
    await set({ case_dessert: true }); await shot('region_dessert', region);
    await set({ fridge_deli: true }); await shot('region_deli', region);
    await set({ case_snacks: true, microwave: true }); await shot('region_micro', region);
    await set({ ice: true, case_snacks: true, case_pastry: true, case_dessert: true, fridge_deli: true, microwave: true });
    await p.evaluate(() => { __dbg.D.t = 270; __dbg.tickDay(0.1); }); await p.waitForTimeout(1500); await shot('bar_full_evening'); await shot('region_all_evening', region);
    await ctx.close();
  }
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
