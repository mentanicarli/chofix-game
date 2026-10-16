/* Кадры мест, где рисуется чашка (Н2-4): выдача под звонком, рука баристы, полёт, рука гостя, стол, зал с пузырями. Инструмент для глаз, не тест. Отладочная сборка.
   CHROMIUM_ARGS=--mute-audio node e2e/places_shot.js dist/artifact.html docs/art/drinks/h2-4 [serve,hand,fly,take,table,hall] */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'docs/art/drinks/h2-4'); fs.mkdirSync(out, { recursive: true });
const parts = (process.argv[4] || 'serve,hand,fly,take,table,hall').split(','); const on = k => parts.includes(k);
const SIZES = process.env.SIZES ? JSON.parse(process.env.SIZES) : [[1280, 720]];
/* напиток, размер, холодный */
const DRINKS = [['latte_sakura', '0.4', false], ['orange_bumble', '0.3', true], ['espresso', '0.2', false], ['tea_hibiscus', '0.4', false], ['boba_raspberry', '0.4', true]];
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { MENUAPI: window.__MENUAPI, get G() { return G; }, get D() { return D; }, get BR() { return BR; }, SBX, WORLD, FX, spawn, barOpen, barShow, applyUpgrades, barPaint, cupFly, renderCup, serve, deliver, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.pl.html'); fs.writeFileSync(tmp, src);
  const args = (process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args });
  const errs = [];
  for (const [W, H] of SIZES) for (const dsf of [1, 2]) {
    const tag = `${W}x${H}_${dsf}x`;
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dsf }); const p = await ctx.newPage();
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs);
    await p.goto('about:blank'); await p.goto(PW.url(tmp) + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400);
    await p.evaluate(() => window.__sandbox.start({ day: 30, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 });
    await p.waitForFunction(() => window.__dbg && window.__dbg.G, null, { timeout: 30000 });
    await p.addStyleTag({ content: '#banner{display:none!important}' });
    await p.evaluate(() => { const G = __dbg.G; ['ice', 'tea', 'matcha', 'powders', 'juice', 'blender', 'boba', 'shaker'].forEach(k => G['eq_' + k] = true); G.milk = true; G.tutOff = true; G.hints = false; __dbg.applyUpgrades(); __dbg.D.nextArr = 1e9; });
    const stage = async () => p.locator('#stage').boundingBox();
    const clipOf = async (x, y, w, h) => { const s = await stage(), k = s.width / 1280; return { x: s.x + x * k, y: s.y + y * k, width: w * k, height: h * k }; };
    const guest = async ([id, size, cold]) => {
      if (!(await p.evaluate(() => __dbg.D.customers.length))) await p.evaluate(o => { __dbg.SBX.next = o; __dbg.spawn(); __dbg.D.customers.forEach(c => { c.pat = c.max = 1e9; }); }, { drink: id, size, cold });
      await p.waitForFunction(() => __dbg.D.customers.length && __dbg.D.customers.every(c => c.arrived), null, { timeout: 120000 }).catch(() => {});
      await p.waitForTimeout(600);
    };
    /* выдача: готовый напиток под звонком (бар, слои спецификации) */
    if (on('serve')) {
      for (const d of DRINKS.slice(0, 3)) {
        await guest(d);
        await p.evaluate(({ id, size, cold }) => { const M = __dbg.MENUAPI, c = __dbg.D.customers[0]; const dk = M.drinkById[id]; c.drink = id; c.order.key = id; c.order.id = dk.id; c.order.name = dk.name; c.order.size = size; c.order.cold = cold; c.order.food = null; c.syrup = null; c.pat = c.max = 1e9; __dbg.G.tutOff = true; __dbg.barOpen(c); }, { id: d[0], size: d[1], cold: d[2] });
        await p.waitForTimeout(500); await PW.dismissCard(p);
        await p.evaluate(() => { const B = __dbg.BR, rc = B.rc; B.cup.es = (rc.shots || 0) * 30; if (rc.water) B.cup.water = rc.water; if (rc.milk) { B.cup.milk = rc.milk; B.cup.foam = rc.foam || 0; } if (rc.ice) B.cup.ice = rc.ice; B.cup.level = 1; B.ready = true; });
        await p.waitForTimeout(900);
        await p.screenshot({ path: `${out}/serve_${d[0]}_${tag}.png`, timeout: 120000 });
        await p.screenshot({ path: `${out}/serve_${d[0]}_zoom_${tag}.png`, clip: await clipOf(520, 330, 220, 190), timeout: 120000 });
        await p.evaluate(() => { __dbg.resetBar(); });
        await p.waitForTimeout(300);
      }
    }
    /* рука баристы (подача): чашка-модель в левой руке */
    if (on('hand')) {
      for (const d of [DRINKS[0], DRINKS[1]]) {
        await p.evaluate(({ id, size, cold }) => { const M = __dbg.MENUAPI; const ref = M.modelRefOf(id, size, cold); __dbg.D.cup = { steps: [], drink: id, q: [2], s: 1, forId: 0, k: 1, ref, art: null, aq: .5 }; __dbg.renderCup(); }, { id: d[0], size: d[1], cold: d[2] });
        await p.waitForTimeout(1200);
        await p.screenshot({ path: `${out}/hand_${d[0]}_${tag}.png`, clip: await clipOf(700, 230, 330, 220), timeout: 120000 });
        await p.screenshot({ path: `${out}/hand_${d[0]}_hall_${tag}.png`, timeout: 120000 });
        await p.evaluate(() => { __dbg.D.cup = null; __dbg.renderCup(); });
      }
    }
    /* гость получает чашку: полёт и рука */
    if (on('fly') || on('take')) {
      for (const d of [DRINKS[0], DRINKS[1], DRINKS[2]]) {
        await guest(d);
        await p.evaluate(({ id, size, cold }) => {
          const M = __dbg.MENUAPI, c = __dbg.D.customers[0], ref = M.modelRefOf(id, size, cold), k = M.specOf(ref.id, ref.size, ref.cold).vessel.k, top = M.modelTopColor(ref);
          c.act.reach(true);
          window.__flyT = { c, ref, k, top };
          __dbg.FX.add({ life: 3, kind: 'cup', x0: 791, y0: 396, tx: c.x + 40, ty: 548, col: top, cs: k, model: ref });
        }, { id: d[0], size: d[1], cold: d[2] });
        await p.waitForTimeout(1100);
        if (on('fly')) await p.screenshot({ path: `${out}/fly_${d[0]}_${tag}.png`, clip: await clipOf(300, 250, 760, 330), timeout: 120000 });
        await p.evaluate(() => { const t = window.__flyT; t.c.act.takeCup(t.top, t.k, t.ref); });
        await p.waitForTimeout(1500);
        if (on('take')) await p.screenshot({ path: `${out}/take_${d[0]}_${tag}.png`, clip: await clipOf(300, 250, 760, 330), timeout: 120000 });
        await p.waitForTimeout(300);
      }
    }
    /* гость за столиком с чашкой: три разных напитка */
    if (on('table')) {
      for (const d of [DRINKS[0], DRINKS[1], DRINKS[3]]) {
        await p.evaluate(({ id, size, cold }) => {
          const W = __dbg.WORLD; if (W.sitter) { W.sitter.destroy(); W.sitter = null; }
          const sp = __dbg.MENUAPI.specOf(id, size, cold); W.decor = [sp]; W.sitSt = 'empty'; W.sitT = 0;
        }, { id: d[0], size: d[1], cold: d[2] });
        await p.waitForFunction(() => __dbg.WORLD.sitSt === 'seated', null, { timeout: 120000 });
        /* чашка стоит на столе; ждём, пока гость не возьмёт её в руку, и снимаем оба состояния */
        await p.waitForTimeout(1200);
        await p.screenshot({ path: `${out}/table_${d[0]}_${tag}.png`, clip: await clipOf(0, 300, 420, 360), timeout: 120000 });
      }
    }
    /* зал с пузырями заказов */
    if (on('hall')) {
      for (const d of [DRINKS[2], DRINKS[0], DRINKS[1], DRINKS[4]]) await p.evaluate(o => { __dbg.SBX.next = o; __dbg.spawn(); }, { drink: d[0], size: d[1], cold: d[2] });
      await p.evaluate(() => __dbg.D.customers.forEach(c => { c.pat = c.max = 1e9; }));
      await p.waitForFunction(() => __dbg.D.customers.every(c => c.arrived), null, { timeout: 120000 }).catch(() => {});
      await p.evaluate(() => document.querySelectorAll('#toast,.say,#hint').forEach(e => { e.style.visibility = 'hidden'; }));
      await p.waitForTimeout(1500);
      await p.screenshot({ path: `${out}/hall_bubbles_${tag}.png`, timeout: 120000 });
      await p.screenshot({ path: `${out}/hall_bubbles_zoom_${tag}.png`, clip: await clipOf(250, 150, 800, 330), timeout: 120000 });
    }
    await ctx.close();
  }
  console.log(errs.length ? errs.slice(0, 8).join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
