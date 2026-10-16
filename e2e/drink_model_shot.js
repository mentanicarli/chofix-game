/* Скриншоты модели напитка (Н1-3): бар, билет, пузырь, книга, окно «Новый напиток»; 1280×720 и 1024×600, 1× и 2×. Инструмент для глаз, не тест. Отладочная сборка.
   CHROMIUM_ARGS=--mute-audio node e2e/drink_model_shot.js dist/artifact.html docs/art/drinks/h1-3 [bar,ticket,bubble,book,card,ice]
   ice: крупный лёд бамбла 0,3 и 0,6 л в баре (3×). */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'docs/art/drinks/h1-3'); fs.mkdirSync(out, { recursive: true });
const parts = (process.argv[4] || 'bar,ticket,bubble,book,card,ice').split(','); const on = k => parts.includes(k);
const SIZES = process.env.SIZES ? JSON.parse(process.env.SIZES) : [[1280, 720], [1024, 600]];
/* H21=1: кадры Н2-1 (горячие напитки: эспрессо, флэт уайт, чай, латте сакура; книга и окно для двух чаёв и двух латте) */
const H21 = !!process.env.H21;
const BUBBLES = H21 ? [{ drink: 'espresso', size: '0.2', cold: false }, { drink: 'tea_hibiscus', size: '0.4', cold: false }, { drink: 'latte_sakura', size: '0.4', cold: false }] : [{ drink: 'latte', size: '0.3', cold: false }, { drink: 'orange_bumble', size: '0.6', cold: true }, { drink: 'cappuccino', size: '0.2', cold: true }];
const BOOK_IDS = H21 ? ['tea_sencha', 'tea_currant', 'latte_sakura', 'latte_banana', 'hot_bumble'] : ['latte', 'cappuccino', 'orange_bumble'];
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { MENUAPI: window.__MENUAPI, get G() { return G; }, get D() { return D; }, get BR() { return BR; }, SBX, WORLD, spawn, tickDay, barOpen, barShow, applyUpgrades, zoneClick, barPaint, showBook, bookRefresh, showDrinkCard, closeDrinkCard, get bookSel() { return bookSel; }, set bookSel(v) { bookSel = v; }, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const args = (process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args });
  const errs = [];
  for (const [W, H] of SIZES) for (const dsf of [1, 2]) {
    const tag = `${W}x${H}_${dsf}x`;
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dsf }); const p = await ctx.newPage();
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs);
    await p.goto('about:blank'); await p.goto(PW.url(tmp) + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400);
    await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 }); await p.waitForFunction(() => window.__dbg && window.__dbg.G, null, { timeout: 30000 }).catch(async e => { console.error('dbg', await p.evaluate(() => typeof window.__dbg), errs.slice(0, 5)); throw e; });
    await p.addStyleTag({ content: '#banner{display:none!important}' });
    await p.evaluate(() => { const G = __dbg.G; ['ice', 'tea', 'matcha', 'powders', 'juice', 'blender', 'boba'].forEach(k => G['eq_' + k] = true); G.milk = true; G.tutOff = true; G.hints = false; __dbg.applyUpgrades(); __dbg.D.nextArr = 1e9; });
    const stage = async () => p.locator('#stage').boundingBox();
    const clipOf = async (x, y, w, h) => { const s = await stage(), k = s.width / 1280; return { x: s.x + x * k, y: s.y + y * k, width: w * k, height: h * k }; };
    /* пузыри: три гостя с пилотными напитками */
    if (on('bubble')) {
      for (const o of BUBBLES) { await p.evaluate(o => { __dbg.SBX.next = o; __dbg.spawn(); }, o); }
      await p.evaluate(() => __dbg.D.customers.forEach(c => { c.pat = c.max = 1e9; }));
      await p.waitForFunction(() => __dbg.D.customers.every(c => c.arrived), null, { timeout: 120000 }).catch(() => {});
      await p.evaluate(() => document.querySelectorAll('#hud,#toast,.say,#hint').forEach(e => { e.style.visibility = 'hidden'; }));
      await p.waitForTimeout(1500);
      await p.screenshot({ path: `${out}/bubble_hall_${tag}.png`, clip: await clipOf(300, 170, 700, 260), timeout: 120000 });
      await p.evaluate(() => document.querySelectorAll('#hud,#toast,.say,#hint').forEach(e => { e.style.visibility = ''; }));
    } else {
      await p.evaluate(() => { __dbg.SBX.next = { drink: 'latte', size: '0.3', cold: false }; __dbg.spawn(); __dbg.D.customers.forEach(c => { c.pat = c.max = 1e9; }); });
    }
    const order = async (id, size, cold) => {
      await p.evaluate(() => __dbg.resetBar());
      await p.evaluate(({ id, size, cold }) => { const M = __dbg.MENUAPI, c = __dbg.D.customers[0]; const dk = M.drinkById[M.drinkOfKey(id).id]; c.drink = id; c.order.key = id; c.order.id = dk.id; c.order.name = dk.name; c.order.size = size; c.order.cold = cold; c.order.food = null; c.syrup = null; c.pat = c.max = 1e9; __dbg.G.tutOff = true; __dbg.barOpen(c); }, { id, size, cold });
      await p.waitForTimeout(500); await PW.dismissCard(p);
    };
    const level = async (f) => { await p.evaluate((f) => { const B = __dbg.BR, rc = B.rc; B.cup.es = f > 0.15 ? (rc.shots || 0) * 30 : 0; if (rc.water) B.cup.water = rc.water * f; if (rc.milk) { B.cup.milk = rc.milk * f; B.cup.foam = f > 0.9 ? rc.foam || 0 : 0; } if (rc.ice) B.cup.ice = rc.ice * f; B.cup.level = f; }, f); await p.waitForTimeout(900); };
    const cases = H21 ? [['espresso', '0.2', false, 'espresso'], ['flatwhite', '0.2', false, 'flat_white'], ['tea_sencha', '0.4', false, 'tea_sencha'], ['latte_sakura', '0.4', false, 'latte_sakura'], ['hot_bumble', '0.3', false, 'hot_bumble']] : [['latte', '0.3', false, 'latte_hot'], ['cappuccino', '0.4', true, 'cappuccino_cold'], ['orange_bumble', '0.3', true, 'bumble_0.3'], ['orange_bumble', '0.6', true, 'bumble_0.6'], ['espresso', '0.2', false, 'espresso_old_art']];
    for (const [id, size, cold, name] of cases) {
      if (!(on('bar') || on('ticket') || on('ice'))) break;
      await order(id, size, cold); await level(1); if (H21) { await p.evaluate(() => { __dbg.BR.ready = true; }); await p.waitForTimeout(500); }
      if (on('bar')) await p.screenshot({ path: `${out}/bar_${name}_${tag}.png`, timeout: 120000 });
      if (on('ticket')) { const tk = p.locator('#bTk'); if (await tk.count()) await tk.screenshot({ path: `${out}/ticket_${name}_${tag}.png`, timeout: 120000 }); }
      if (on('ice') && id === 'orange_bumble' && W === 1280 && dsf === 2) {
        await p.evaluate(() => document.querySelectorAll('#hud,#bTk,#bCoach,#toast,#bFloat,#bGoal,#tint').forEach(e => { e.style.visibility = 'hidden'; }));
        await p.evaluate(() => { __dbg.BR.ready = true; }); await p.waitForTimeout(700); /* готовый напиток: слои спецификации и лёд, как их увидит игрок при подаче */
        await p.screenshot({ path: `${out}/ice_${name}_zoom_${tag}.png`, clip: await clipOf(540, 360, 200, 135), timeout: 120000 });
        await p.evaluate(() => document.querySelectorAll('#hud,#bTk,#bCoach,#toast,#bFloat,#bGoal,#tint').forEach(e => { e.style.visibility = ''; }));
      }
    }
    await p.evaluate(() => __dbg.resetBar());
    if (on('card')) {
      for (const [id, size, cold, name] of (H21 ? [['tea_sencha', '0.4', false, 'tea_sencha'], ['tea_hibiscus', '0.4', false, 'tea_hibiscus'], ['latte_sakura', '0.4', false, 'latte_sakura'], ['latte', '0.3', false, 'latte'], ['hot_bumble', '0.3', false, 'hot_bumble']] : [['latte', '0.4', false, 'latte'], ['orange_bumble', '0.6', true, 'bumble']])) {
        await p.evaluate(({ id, size, cold }) => { __dbg.barShow(true); const card = __dbg.MENUAPI.newDrinkCard(id, [], undefined, size, cold); __dbg.showDrinkCard(card, null, { id, size, cold }); }, { id, size, cold });
        await p.waitForTimeout(500);
        await p.screenshot({ path: `${out}/card_${name}_${tag}.png`, timeout: 120000 });
        await p.evaluate(() => __dbg.closeDrinkCard()); await p.waitForTimeout(200);
      }
      await p.evaluate(() => __dbg.barShow(false));
    }
    if (on('book')) {
      await p.evaluate((H21) => { __dbg.G.rank = 9; __dbg.bookSel = H21 ? { tea_sencha: { size: '0.4', cold: false }, tea_currant: { size: '0.4', cold: false }, latte_sakura: { size: '0.4', cold: false } } : { orange_bumble: { size: '0.6', cold: true }, latte: { size: '0.4', cold: false }, cappuccino: { size: '0.3', cold: true } }; __dbg.showBook('hud'); }, H21);
      await p.waitForTimeout(800);
      for (const id of BOOK_IDS) {
        /* карточка прижимается к верху списка, снимок всего окна книги (иначе липкая шапка закрывает верх карточки) */
        await p.evaluate(id => { const bb = document.querySelector('.bookBody'), el = document.querySelector(`.bk[data-drink="${id}"]`); bb.scrollTop += el.getBoundingClientRect().top - bb.getBoundingClientRect().top - 4; }, id);
        await p.waitForTimeout(300);
        await p.locator('.book').screenshot({ path: `${out}/book_${id}_${tag}.png`, timeout: 120000 });
      }
      await p.screenshot({ path: `${out}/book_page_${tag}.png`, timeout: 120000 });
    }
    await ctx.close();
  }
  console.log(errs.length ? errs.slice(0, 8).join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
