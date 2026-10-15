/* Скриншоты для аудита графики (инструмент для глаз, не тест). Только чтение игры.
   node docs/art/tools/shoot_all.cjs dist/artifact.html out/art-audit  [часть: menus|hall|bar|stations|screens|all] */
const E = 'C:/Users/menta/OneDrive/Desktop/ПРОЕКТЫ/chofix/e2e';
const { chromium } = require(E + '/node_modules/playwright'); const path = require('path'); const fs = require('fs');
const PW = require(E + '/pw');
const part = process.argv[4] || 'all', on = k => part === 'all' || part === k;
const out = path.resolve(process.argv[3]); fs.mkdirSync(out, { recursive: true });
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, WORLD, spawn, tickDay, barOpen, barShow, applyUpgrades, zoneClick, endDay, showEvening, showBook, showTitle, setPause, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await PW.page(b); const errs = []; PW.watch(p, errs);
  const shot = async (n, t = 400) => { await p.waitForTimeout(t); await p.screenshot({ path: `${out}/${n}.png`, timeout: 120000 }); console.log('shot', n); };
  const url = PW.url(tmp);
  const sbx = async (o) => { await p.goto('about:blank'); await p.goto(url + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400); await p.evaluate(c => window.__sandbox.start(c), o); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 }); };
  if (on('menus')) {
    await p.goto(url + '#nopixi-lowfx'); await p.waitForTimeout(3500);
    await shot('menu_title');
    for (const [sel, n] of [['[data-howto]', 'menu_howto'], ['[data-settings]', 'menu_settings']]) {
      try { await p.click(sel, { timeout: 4000 }); await shot(n, 700); await p.click('[data-menuback]', { timeout: 3000 }); await p.waitForTimeout(500); } catch (e) { console.log('skip', n, e.message.slice(0, 80)); }
    }
    try { await p.click('[data-start]'); await p.waitForTimeout(300); const y = await p.$('[data-yes]'); if (y) await y.click(); await p.waitForSelector('[data-go]', { timeout: 3000 }); await shot('menu_pace', 800); } catch (e) { console.log('skip pace'); }
  }
  if (on('hall') || on('bar') || on('stations') || on('screens')) await sbx({ day: 10, profile: 'medium' });
  if (on('hall')) {
    await p.evaluate(() => { const d = __dbg; d.D.nextArr = 1e9; for (let i = 0; i < 6; i++) d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; }); });
    await p.waitForTimeout(500);
    console.log('types', await p.evaluate(() => JSON.stringify(__dbg.D.customers.map(c => c.type || c.kind || c.look))));
    await p.waitForFunction(() => __dbg.D.customers.every(c => c.arrived), null, { timeout: 90000 }).catch(() => {});
    await shot('hall_day_queue', 1500);
    await p.evaluate(() => document.querySelectorAll('#hud,#tint,#toast,.say').forEach(e => e.style.visibility = 'hidden'));
    await shot('hall_day_clean', 500);
    await p.evaluate(() => document.querySelectorAll('#hud,#tint,#toast,.say').forEach(e => e.style.visibility = ''));
    await p.evaluate(() => { __dbg.D.t = 270; __dbg.tickDay(0.1); });
    await shot('hall_evening', 2500);
    await p.evaluate(() => { __dbg.D.t = 150; __dbg.tickDay(0.1); });
    await shot('hall_noon', 1500);
  }
  if (on('bar') || on('stations')) {
    await p.evaluate(() => { const d = __dbg; d.D.nextArr = 1e9; if (!d.D.customers.length) d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; }); });
    await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
    await p.evaluate(() => { const G = __dbg.G; ['ice', 'tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker', 'case_snacks', 'case_pastry', 'case_dessert', 'fridge_deli', 'microwave', 'siphon'].forEach(k => G['eq_' + k] = true); G.milk = true; __dbg.applyUpgrades(); });
  }
  const open = async (id, size = '0.3', cold = false) => {
    await p.evaluate(() => __dbg.resetBar()); await p.waitForTimeout(300);
    await p.evaluate(({ id, size, cold }) => { const M = window.__MENUAPI, c = __dbg.D.customers[0]; const dk = M.drinkById[id]; c.drink = id; c.order.key = id; c.order.id = id; c.order.name = dk.name; c.order.size = size; c.order.cold = cold; c.order.food = null; c.pat = c.max = 1e9; __dbg.G.hints = true; __dbg.G.tutOff = true; }, { id, size, cold });
    await p.evaluate(() => __dbg.barOpen(__dbg.D.customers[0])); await p.waitForTimeout(700); await PW.dismissCard(p);
    return p.evaluate(() => __dbg.BR && __dbg.BR.exp.join(','));
  };
  if (on('bar')) {
    console.log('latte tasks', await open('latte'));
    await p.evaluate(() => { document.querySelectorAll('#hud,#bTk,#bCoach,#toast').forEach(e => e.style.visibility = 'hidden'); });
    await shot('bar_clean_allgear', 800);
    await p.evaluate(() => { const e = document.querySelector('#bFloat'); if (e) e.style.visibility = 'hidden'; });
    await shot('bar_clean_no_buttons', 400);
    await p.evaluate(() => { const e = document.querySelector('#bFloat'); if (e) e.style.visibility = ''; });
    await p.evaluate(() => { document.querySelectorAll('#hud,#bTk,#bCoach,#toast').forEach(e => e.style.visibility = ''); });
    await shot('bar_hud_ticket', 300);
  }
  if (on('stations')) {
    const fams = [['matcha_latte', 'st_matcha'], ['tea_sencha', 'st_tea'], ['cocoa', 'st_powder'], ['espresso_tonic', 'st_tonic'], ['orange_bumble', 'st_juice'], ['milkshake_vanilla', 'st_shake'], ['boba_guava', 'st_boba'], ['latte_coconut', 'st_foamtop'], ['aerocano', 'st_aero'], ['protein_milk', 'st_protein'], ['frappe_caramel', 'st_blend']];
    for (const [id, tag] of fams) {
      try {
        const exp = await open(id, '0.4', /bumble|tonic|shake|boba|frappe|aero|protein/.test(id));
        console.log(id, exp);
        const t = (exp || '').split(',').find(x => !/^(grind|tamp|shot|milk|steam|pour|water|ice|syrup)$/.test(x));
        if (!t) { console.log('no new-core task', id); continue; }
        await p.evaluate(t => { const z = (window.TASK_ZONE || {})[t] || t; __dbg.zoneClick(z); }, t);
        await shot(`${tag}_${t}`, 900);
      } catch (e) { console.log('fail', id, e.message.slice(0, 100)); }
    }
    await open('latte');
    await p.click('[data-z=grind]', { force: true }); await shot('inset_grind', 700);
    const r = await p.evaluate(() => { const r = document.querySelector('#bi').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    await p.mouse.move(r[0] + 155 * r[2] / 440, r[1] + 384 * r[3] / 450); await p.mouse.down(); await p.waitForTimeout(1800); await shot('inset_grind_running', 100); await p.mouse.up();
  }
  if (on('screens')) {
    await p.evaluate(() => __dbg.resetBar());
    await p.evaluate(() => { __dbg.D.customers.forEach(c => { c.leaving = true; }); });
    await p.evaluate(() => { __dbg.showBook('title'); }); await shot('screen_book', 1000);
    await p.evaluate(() => { __dbg.showEvening(true); }); await shot('screen_evening_shop', 1200);
    for (const t of ['gear', 'hall']) { try { await p.click(`[data-tab=${t}]`, { timeout: 2000 }); await shot('screen_shop_' + t, 700); } catch (e) { console.log('no tab', t); } }
    await p.evaluate(() => { __dbg.setPause(true); }); await shot('screen_pause', 800);
  }
  console.log(errs.length ? errs.slice(0, 8).join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
