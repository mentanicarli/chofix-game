/* Б1-1: камера бара и секции. Отладочная сборка. node e2e/sections_cam.js out/b11/after-debug.html docs/art/sections/b1-1
   1) обычная игра (без #dev): текстур боковых секций нет; после покупки чая появляются, камера остаётся в центре;
   2) #dev: три остановки, кадры центра, L, R, перехода C→R (0, 0,15, 0,3 с), центра после возврата (1280×720, 2×);
   3) переход в реальном времени: 0,3 с, монотонно; вход в бар из зала всегда в центре. Печатает NO_ERRORS. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'out/b11/frames'); fs.mkdirSync(out, { recursive: true });
const HOOK = 'newGame(); updateHud(); showTitle(); window.__dbg = { MENUAPI: window.__MENUAPI, get G() { return G; }, get D() { return D; }, get BR() { return BR; }, WORLD, CAM, spawn, barOpen, barShow, applyUpgrades, camGo };';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('ok   ' + m); };
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', HOOK);
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.sec.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--mute-audio'] });
  const errs = [];
  const open = async (hash, dsf, sandbox) => {
    const ctx = await b.newContext({ viewport: { width: 1312, height: 752 }, deviceScaleFactor: dsf }); const p = await ctx.newPage();
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs);
    await p.goto('about:blank'); await p.goto(PW.url(tmp) + hash);
    if (sandbox) { await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400); await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 }); }
    else await PW.startNew(p);
    await p.waitForFunction(() => window.__dbg && __dbg.D && __dbg.G.phase === 'day', null, { timeout: 60000 });
    await p.evaluate(() => { const d = __dbg; d.G.tutOff = true; d.G.hints = false; d.applyUpgrades(); d.D.nextArr = 1e9; d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; c.syrup = null; }); });
    await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
    await p.evaluate(() => __dbg.barOpen(__dbg.D.customers[0])); await p.waitForTimeout(900); await PW.dismissCard(p);
    await p.evaluate(() => { setInterval(() => { __dbg.D.t = 100; }, 16); document.querySelectorAll('#hud,#bTk,#bCoach,#toast,#bFloat,#bGoal,#frontHint,#devBtn,#devPanel').forEach(e => { e.style.visibility = 'hidden'; }); });
    return { ctx, p };
  };
  /* 1) обычная игра */
  { const { ctx, p } = await open('', 1, false);
    ok(await p.evaluate(() => __dbg.WORLD.barSideTextures()) === 0, 'обычная игра, без покупок: текстур боковых секций 0');
    ok(await p.evaluate(() => !window.__sec), 'без #dev window.__sec нет');
    await p.evaluate(() => { __dbg.G.eq_tea = true; __dbg.applyUpgrades(); }); await p.waitForTimeout(800);
    const n = await p.evaluate(() => __dbg.WORLD.barSideTextures());
    ok(n > 0, 'после покупки чая секция L получила текстуры (' + n + '), R нет'); ok(await p.evaluate(() => __dbg.CAM.sec === 'C' && __dbg.CAM.x === 0), 'камера осталась в центре (навигации нет)');
    await ctx.close(); }
  /* 2) #dev */
  const { ctx, p } = await open('#dev', 2, true);
  const shot = async (name) => { await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('#stage').screenshot({ path: `${out}/${name}.png`, timeout: 120000 }); };
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => __dbg.WORLD.barSideTextures()) === 4, '#dev: обе боковые секции открыты, 4 текстуры (2 фона + 2 подписи)');
  await shot('b11_1_center');
  await PW.goSection(p, 'L'); await p.waitForTimeout(300); await shot('b11_2_left');
  ok(await p.evaluate(() => __dbg.CAM.x === -1280), 'L: камера −1280');
  await PW.goSection(p, 'R'); await p.waitForTimeout(300); await shot('b11_3_right');
  ok(await p.evaluate(() => __dbg.CAM.x === 1280), 'R: камера +1280');
  await PW.goSection(p, 'C'); await p.waitForTimeout(300);
  /* кадры перехода C→R: положения камеры из той же функции, что в camTick (cameraAt), без привязки к частоте кадров */
  const M = (t) => p.evaluate((t) => { const M = __dbg.MENUAPI; __dbg.CAM.moving = false; __dbg.WORLD.setBarCamera(M.cameraAt(0, 1280, t)); return M.cameraAt(0, 1280, t); }, t);
  for (const [t, n] of [[0, 'b11_4_move_000'], [0.15, 'b11_5_move_150'], [0.3, 'b11_6_move_300']]) { const x = await M(t); await p.waitForTimeout(200); await shot(n); console.log(`кадр ${n}: cam ${x}`); }
  await PW.goSection(p, 'C'); await p.waitForTimeout(300); await shot('b11_7_center_back');
  ok(await p.evaluate(() => __dbg.CAM.x === 0), 'возврат: камера 0');
  /* 3) реальное время */
  const tr = await p.evaluate(async () => { const xs = []; const t0 = performance.now(); __dbg.camGo('R', false); await new Promise(res => { const f = () => { xs.push([performance.now() - t0, __dbg.CAM.x]); if (!__dbg.CAM.moving && xs.length > 2) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); return xs; });
  const tEnd = tr[tr.length - 1][0]; const mono = tr.every((q, i) => !i || q[1] >= tr[i - 1][1]);
  ok(tEnd >= 250 && tEnd < 600, `переход C→R в реальном времени закончился на ${tEnd.toFixed(0)} мс (кадров ${tr.length}; на программном WebGL кадры редкие)`); ok(mono && tr[tr.length - 1][1] === 1280, 'переход монотонный и приходит ровно в 1280');
  /* вход в бар всегда в центре */
  await p.evaluate(() => { __dbg.camGo('L', true); __dbg.barShow(false); }); await p.waitForTimeout(400); await p.evaluate(() => __dbg.barShow(true));
  ok(await p.evaluate(() => __dbg.CAM.sec === 'C' && __dbg.CAM.x === 0), 'вход в бар из зала: камера в центре без анимации (после L)');
  await p.evaluate(() => { __dbg.camGo('R', true); }); await p.evaluate(() => __dbg.barShow(true));
  ok(await p.evaluate(() => __dbg.CAM.x === 0 && !__dbg.CAM.moving), 'повторный вход в бар (после окна/паузы): камера в центре');
  await ctx.close();
  ok(!errs.length, errs.length ? errs.slice(0, 4).join(' | ') : 'ошибок страницы нет'); console.log(fails ? 'FAILS ' + fails : 'NO_ERRORS'); await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
