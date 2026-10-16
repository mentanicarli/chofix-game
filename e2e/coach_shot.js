/* Б1-5: реплики коуча у новых станций (инструмент для глаз + проверка текста). Отладочная сборка.
   CHROMIUM_ARGS=--mute-audio node e2e/coach_shot.js out/b11/b15-debug.html docs/art/sections/b1-5
   1) #dev без листания (плитки в центре), шаг «чай»; 2) обычная игра без #dev, шаг матчи; 3) #dev с листанием, шаг «сок» в секции R с кольцом. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'out/b15'); fs.mkdirSync(out, { recursive: true });
const HOOK = 'newGame(); updateHud(); showTitle(); window.__dbg = { resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; }, get G() { return G; }, get D() { return D; }, get BR() { return BR; }, CAM, WORLD, ringTarget, camGo, spawn, barOpen, barShow, applyUpgrades };';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', HOOK);
  const tmp = path.resolve(process.argv[2]).replace('.html', '.cs.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--mute-audio'] });
  const errs = [];
  const open = async (hash, sandbox) => {
    const ctx = await b.newContext({ viewport: { width: 1312, height: 752 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs);
    await p.addInitScript(() => { let a = 99; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
    await p.goto('about:blank'); await p.goto(PW.url(tmp) + hash);
    if (sandbox) { await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400); await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 }); }
    else await PW.startNew(p);
    await p.waitForFunction(() => window.__dbg && __dbg.D && __dbg.G.phase === 'day', null, { timeout: 60000 });
    await p.evaluate(() => { const d = __dbg, G = d.G; G.tutOff = true; G.hints = true; ['ice', 'tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker'].forEach(k => { G['eq_' + k] = true; }); G.milk = true; d.applyUpgrades(); d.D.nextArr = 1e9; d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; c.syrup = null; }); });
    await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
    return { ctx, p };
  };
  const order = async (p, id, size, cold) => { await p.evaluate(() => __dbg.resetBar()); await p.evaluate(([id, size, cold]) => { const M = window.__MENUAPI, c = __dbg.D.customers[0], dk = M.drinkById[id]; c.drink = id; c.order.key = id; c.order.id = id; c.order.name = dk.name; c.order.size = size; c.order.cold = cold; c.order.food = null; c.syrup = null; c.pat = c.max = 1e9; __dbg.barOpen(c); }, [id, size, cold]); await p.waitForTimeout(900); await PW.dismissCard(p); await p.evaluate(() => { setInterval(() => { __dbg.D.t = 100; }, 16); document.querySelectorAll('#devBtn,#devPanel').forEach(e => { e.style.visibility = 'hidden'; }); }); await p.waitForTimeout(900); };
  const coach = (p) => p.evaluate(() => { const c = document.querySelector('#bCoach'); return c && !c.hidden ? c.querySelector('p').textContent : ''; });
  const shot = async (p, n) => { await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('#stage').screenshot({ path: `${out}/${n}.png`, timeout: 120000 }); };
  /* 1: чай, #dev без листания */
  { const { ctx, p } = await open('#dev-nopixi-lowfx-nosec', true); await order(p, 'tea_sencha', '0.3', false);
    const t = await coach(p); ok(t === 'Нажмите «Чайная станция», заварите чай и выньте его вовремя.', 'шаг «чай»: реплика коуча: ' + t); await shot(p, 'b15_1_coach_tea'); await ctx.close(); }
  /* 2: матча, обычная игра */
  { const { ctx, p } = await open('', false); await order(p, 'matcha_latte', '0.3', false);
    const t = await coach(p); ok(t === 'Нажмите «Набор для матчи» и взбейте матчу до готовности.', 'шаг матчи, без #dev: реплика коуча: ' + t); await shot(p, 'b15_2_coach_matcha_normal'); await ctx.close(); }
  /* 3: сок в секции R: реплика и кольцо */
  { const { ctx, p } = await open('#dev', true); await order(p, 'orange_bumble', '0.4', true);
    await p.evaluate(() => { const B = __dbg.BR; B.tasks.forEach(x => { if (x !== 'juice') B.done[x] = true; }); });
    await p.evaluate(() => __dbg.camGo('R', true)); await p.waitForTimeout(7000); /* реплика меняется не раньше, чем через время показа предыдущей */
    const t = await coach(p); ok(t === 'Нажмите «Холодильник соков и тоника» и налейте сок в чашку.', 'шаг «сок» в R: реплика: ' + t);
    const r = await p.evaluate(() => __dbg.ringTarget()); ok(!!r && r[0] > 1280, 'кольцо на станции в R есть (подсказки включены): ' + JSON.stringify(r)); await shot(p, 'b15_3_coach_juice_right_ring'); await ctx.close(); }
  ok(!errs.length, errs.length ? errs.slice(0, 3).join(' | ') : 'ошибок страницы нет'); console.log(fails ? 'FAILS ' + fails : 'NO_ERRORS'); await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
