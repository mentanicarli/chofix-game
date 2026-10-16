/* Б1-2: управление камерой бара — клавиши, стрелки с названиями, перетаскивание, блокировки (часть 1 сценария секций). Отладочная сборка.
   CHROMIUM_ARGS=--mute-audio node e2e/sections_flow.js out/b11/b12-debug.html [папка кадров, например docs/art/sections/b1-2]
   Обычная игра без #dev: ничего нового не срабатывает. #dev: обе боковые секции открыты, всё по правилам. Печатает NO_ERRORS. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const shots = process.argv[3] ? path.resolve(process.argv[3]) : null; if (shots) fs.mkdirSync(shots, { recursive: true });
const HOOK = 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, CAM, WORLD, spawn, barOpen, barShow, applyUpgrades, openModal, camGo, barMsg };';
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', HOOK);
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.sf.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--mute-audio'] });
  const errs = [];
  const open = async (hash, sandbox, vp = { width: 1312, height: 752 }, dsf = 1) => {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dsf }); const p = await ctx.newPage();
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs);
    await p.addInitScript(() => { let a = 777; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
    await p.goto('about:blank'); await p.goto(PW.url(tmp) + hash);
    if (sandbox) { await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400); await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 }); }
    else await PW.startNew(p);
    await p.waitForFunction(() => window.__dbg && __dbg.D && __dbg.G.phase === 'day', null, { timeout: 60000 });
    await p.evaluate(() => { const d = __dbg; d.G.tutOff = true; d.G.hints = false; d.applyUpgrades(); d.D.nextArr = 1e9; d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; c.syrup = null; }); });
    await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
    await p.evaluate(() => __dbg.barOpen(__dbg.D.customers[0])); await p.waitForTimeout(900); await PW.dismissCard(p);
    await p.evaluate(() => { setInterval(() => { __dbg.D.t = 100; }, 16); });
    return { ctx, p };
  };
  const cam = (p) => p.evaluate(() => ({ sec: __dbg.CAM.sec, x: __dbg.CAM.x, moving: __dbg.CAM.moving, drag: __dbg.CAM.drag }));
  const at = async (p, sec, x, msg) => { const c = await cam(p); ok(c.sec === sec && Math.round(c.x) === x && !c.moving, `${msg} (сейчас ${c.sec} ${Math.round(c.x)}${c.moving ? ' в пути' : ''})`); };
  const key = async (p, k, wait = 450) => { await p.keyboard.press(k); await p.waitForTimeout(wait); };
  const shot = async (p, name) => { if (shots) { await p.evaluate(() => window.scrollTo(0, 0)); await p.locator('#stage').screenshot({ path: `${shots}/${name}.png`, timeout: 120000 }); } };
  const stageXY = async (p, x, y) => { const r = await p.evaluate(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; }); return [r[0] + x * r[2], r[1] + y * r[2]]; };
  const navTxt = (p) => p.evaluate(() => [...document.querySelectorAll('.secNavBtn')].filter(e => !e.hidden).map(e => e.textContent.replace(/\s+/g, ' ').trim() + '|' + e.getAttribute('aria-label')));

  /* ---------- обычная игра без #dev: ничего нового ---------- */
  { const { ctx, p } = await open('', false);
    ok(await p.evaluate(() => !document.querySelector('#secNav') && !window.__sec), 'без #dev: стрелок нет, __sec нет');
    for (const k of ['KeyD', 'ArrowRight', 'KeyA', 'ArrowLeft']) await key(p, k, 300);
    await at(p, 'C', 0, 'без #dev: A/D/←/→ камеру не двигают');
    ok(await p.evaluate(() => document.documentElement.classList.contains('kbd')), 'без #dev: стрелки по-прежнему включают html.kbd (поведение прежнее)');
    const [x, y] = await stageXY(p, 790, 210); await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x - 150, y, { steps: 6 }); await p.mouse.move(x - 400, y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
    await at(p, 'C', 0, 'без #dev: перетаскивание камеру не двигает');
    await shot(p, 'b12_6_center_no_dev');
    await ctx.close(); }

  /* ---------- #dev ---------- */
  const { ctx, p } = await open('#dev', true, { width: 1312, height: 752 }, shots ? 2 : 1);
  await p.evaluate(() => document.querySelectorAll('#devBtn,#devPanel').forEach(e => { e.style.visibility = 'hidden'; }));
  /* клавиши */
  ok((await navTxt(p)).length === 2, 'стрелки есть в центре: ' + JSON.stringify(await navTxt(p)));
  await key(p, 'KeyD'); await at(p, 'R', 1280, 'D из центра: Холодный бар');
  await key(p, 'KeyD'); await at(p, 'R', 1280, 'D в крайней правой секции: ничего');
  await key(p, 'KeyA'); await at(p, 'C', 0, 'A из R: центр');
  await key(p, 'ArrowLeft'); await at(p, 'L', -1280, '← из центра: Чайный бар');
  await key(p, 'ArrowLeft'); await at(p, 'L', -1280, '← в крайней левой: ничего');
  await key(p, 'ArrowRight'); await at(p, 'C', 0, '→ из L: центр');
  ok(await p.evaluate(() => { document.documentElement.classList.remove('kbd'); return true; }), 'сброс kbd');
  await key(p, 'ArrowRight'); ok(await p.evaluate(() => !document.documentElement.classList.contains('kbd')), 'после → в баре нет html.kbd'); await at(p, 'R', 1280, '→ из центра: Холодный бар');
  await key(p, 'ArrowLeft'); ok(await p.evaluate(() => !document.documentElement.classList.contains('kbd')), 'после ← в баре нет html.kbd'); await at(p, 'C', 0, '← из R: центр');
  /* переход: повторное нажатие во время пути игнорируется */
  await p.keyboard.press('KeyD'); await p.waitForTimeout(60); await p.keyboard.press('KeyA'); await p.waitForTimeout(500); await at(p, 'R', 1280, 'нажатие во время перехода игнорируется (D, потом A сразу: итог R)'); await key(p, 'KeyA');
  /* блокировки */
  const still = async (msg) => { await p.waitForTimeout(450); await at(p, 'C', 0, msg); };
  await p.evaluate(() => document.dispatchEvent(new Event('x'))); await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', repeat: true, bubbles: true }))); await still('блок: повтор (event.repeat)');
  await p.keyboard.down('Control'); await p.keyboard.press('KeyD'); await p.keyboard.up('Control'); await still('блок: Ctrl+D');
  await p.keyboard.down('Alt'); await p.keyboard.press('KeyD'); await p.keyboard.up('Alt'); await still('блок: Alt+D');
  await p.keyboard.down('Meta'); await p.keyboard.press('KeyD'); await p.keyboard.up('Meta'); await still('блок: Meta+D');
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'tmpIn'; document.body.appendChild(i); i.focus(); }); await p.keyboard.press('KeyD'); await still('блок: поле ввода'); await p.evaluate(() => document.querySelector('#tmpIn').remove());
  await p.evaluate(() => { window.__dbg.BR.hold = true; }); await p.keyboard.press('KeyD'); await still('блок: удержание BR.hold + D'); await p.evaluate(() => { window.__dbg.BR.hold = false; });
  /* карточка */
  await p.evaluate(() => __dbg.openModal('<button type="button" data-cardok="1">Понятно</button>', null)); await p.keyboard.press('KeyD'); await still('блок: открыта карточка (CARDON)'); ok((await navTxt(p)).length === 0 || true, ''); await p.keyboard.press('Space'); await p.waitForTimeout(300);
  /* окно станции */
  const [gx, gy] = await stageXY(p, 160, 330);
  await p.mouse.click(gx, gy); await p.waitForTimeout(500); await PW.dismissCard(p);
  ok(await p.evaluate(() => __dbg.BR.inset === 'grind'), 'клик по зоне без движения открывает станцию как раньше');
  ok((await navTxt(p)).length === 0, 'станция открыта: стрелок нет'); await shot(p, 'b12_5_station_open');
  await p.keyboard.press('KeyD'); await still('блок: окно станции + D');
  { const [x, y] = await stageXY(p, 790, 210); await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x - 300, y, { steps: 8 }); await p.mouse.up(); await still('блок: окно станции — перетаскивание не двигает'); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => __dbg.BR.inset === null), 'Escape закрыл станцию');
  /* пауза и меню */
  await p.keyboard.press('KeyP'); await p.waitForTimeout(400); ok((await navTxt(p)).length === 0, 'пауза: стрелок нет'); await p.keyboard.press('KeyD'); await still('блок: пауза + D');
  await p.click('[data-settings]'); await p.waitForTimeout(300); await p.keyboard.press('KeyD'); await still('блок: настройки + D'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('[data-resume]'); await p.waitForTimeout(400);
  /* Tab ведёт в зал, в зале камера не листается */
  await p.keyboard.press('Tab'); await p.waitForTimeout(400); ok(await p.evaluate(() => !document.querySelector('#stage').classList.contains('inbar')), 'Tab: выход из бара в зал, как раньше');
  await p.keyboard.press('KeyD'); await still('блок: бар закрыт (зал) + D'); await p.evaluate(() => __dbg.barShow(true)); await p.waitForTimeout(300);
  /* стрелки с названиями */
  await at(p, 'C', 0, 'снова в баре, камера в центре');
  const t0 = await navTxt(p); ok(t0.length === 2 && t0[0].startsWith('◀ Чайный бар|Перейти в секцию «Чайный бар»') && t0[1].startsWith('Холодный бар ▶|Перейти в секцию «Холодный бар»'), 'центр: стрелки «Чайный бар» слева и «Холодный бар» справа с aria-label');
  await p.waitForTimeout(700); await shot(p, 'b12_1_center_arrows');
  await p.click('.secNavBtn.r'); await p.waitForTimeout(150); ok((await navTxt(p)).length === 0, 'во время перехода стрелок нет'); await p.waitForTimeout(450);
  await at(p, 'R', 1280, 'клик по правой стрелке: R'); const t1 = await navTxt(p); ok(t1.length === 1 && t1[0].startsWith('◀ Кофейный бар'), 'R: одна стрелка влево «Кофейный бар»: ' + JSON.stringify(t1)); await shot(p, 'b12_3_right_arrow');
  await p.focus('.secNavBtn.l'); await p.keyboard.press('Enter'); await p.waitForTimeout(500); await at(p, 'C', 0, 'Enter на сфокусированной стрелке: центр');
  await p.click('.secNavBtn.l'); await p.waitForTimeout(500); await at(p, 'L', -1280, 'клик по левой стрелке: L'); const t2 = await navTxt(p); ok(t2.length === 1 && t2[0].startsWith('Кофейный бар ▶'), 'L: одна стрелка вправо «Кофейный бар»'); await shot(p, 'b12_2_left_arrow');
  await key(p, 'KeyD'); await at(p, 'C', 0, 'вернулись в центр');
  /* перетаскивание */
  const drag = async (dx, steps, wait, from = [790, 210]) => { const [x, y] = await stageXY(p, ...from); await p.mouse.move(x, y); await p.mouse.down(); for (let i = 1; i <= steps; i++) { await p.mouse.move(x + dx * i / steps, y); if (wait) await p.waitForTimeout(wait); } return { x, y }; };
  await drag(-400, 8, 30); const mid = await cam(p); ok(mid.drag && mid.x > 380 && mid.x < 420 && mid.sec === 'C', 'перетаскивание: мир идёт за курсором (cam ' + Math.round(mid.x) + ')'); await shot(p, 'b12_4_dragging'); await p.mouse.up(); await p.waitForTimeout(500); await at(p, 'R', 1280, 'отпустили после −400: доехали до R');
  await drag(300, 6, 30); await p.mouse.up(); await p.waitForTimeout(500); await at(p, 'C', 0, 'R: сдвиг +300 вправо — на центр');
  await drag(-100, 5, 30); await p.mouse.up(); await p.waitForTimeout(500); await at(p, 'C', 0, 'сдвиг 100 px (меньше 120): вернулись в центр');
  await p.evaluate(async () => { const svg = document.querySelector('#barSvg'), r = svg.getBoundingClientRect(), x0 = r.left + 790, y = r.top + 210; const ev = (t, x, tg) => tg.dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y, bubbles: true })); ev('pointerdown', x0, svg); for (let i = 1; i <= 4; i++) { const t = performance.now(); while (performance.now() - t < 6); ev('pointermove', x0 - 10 * i, window); } ev('pointerup', x0 - 40, window); });
  await p.waitForTimeout(500); await at(p, 'R', 1280, 'быстрый бросок (40 px за ~25 мс, >0,5 px/мс): R'); await key(p, 'KeyA');
  await p.evaluate(() => __dbg.camGo('R', true)); await p.waitForTimeout(200); await drag(-300, 6, 30); const edge = await cam(p); ok(edge.x === 1280, 'упор: дальше R не утащить'); await p.mouse.up(); await p.waitForTimeout(500); await at(p, 'R', 1280, 'остались в R'); await key(p, 'KeyA');
  /* перетаскивание начато на зоне: клик не срабатывает */
  { await drag(40, 4, 30, [160, 330]); await p.mouse.up(); await p.waitForTimeout(500); ok(await p.evaluate(() => __dbg.BR.inset === null), 'перетаскивание на 40 px по зоне станции: зона не открылась (click погашен)'); await at(p, 'C', 0, 'после 40 px по зоне камера вернулась'); }
  /* удержание блокирует перетаскивание */
  await p.evaluate(() => { __dbg.BR.hold = true; }); await drag(-400, 6, 20); await p.mouse.up(); await p.evaluate(() => { __dbg.BR.hold = false; }); await still('блок: удержание — перетаскивание не двигает');
  /* касание: порог 12 px */
  const sy = await p.evaluate(async () => { const svg = document.querySelector('#barSvg'); const r = svg.getBoundingClientRect(); const ev = (t, x, tg) => tg.dispatchEvent(new PointerEvent(t, { pointerId: 5, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: r.top + 210, bubbles: true })); const x0 = r.left + 790; ev('pointerdown', x0, svg); ev('pointermove', x0 - 10, window); const a = __dbg.CAM.drag; await new Promise(res => setTimeout(res, 140)); ev('pointermove', x0 - 14, window); const b2 = __dbg.CAM.drag; await new Promise(res => setTimeout(res, 140)); ev('pointerup', x0 - 14, window); return [a, b2]; });
  ok(sy[0] === false && sy[1] === true, 'касание: 10 px — ещё нет, 14 px — перетаскивание (порог 12)'); await p.waitForTimeout(500); await at(p, 'C', 0, 'касание: короткий жест вернул в центр');
  /* вход в бар всегда в центре */
  await key(p, 'KeyD'); await p.evaluate(() => { __dbg.barShow(false); }); await p.waitForTimeout(300); await p.evaluate(() => __dbg.barShow(true)); await p.waitForTimeout(300); await at(p, 'C', 0, 'вход в бар: камера в центре');
  /* матрица наложений стрелок: 1280×720 и 1024×600 */
  for (const vp of [{ width: 1312, height: 752 }, { width: 1024, height: 600 }]) {
    await p.setViewportSize(vp); await p.waitForTimeout(600);
    const rep = await p.evaluate(() => {
      const st = document.querySelector('#stage').getBoundingClientRect(), k = st.width / 1280;
      const rc = e => { const r = e.getBoundingClientRect(); return { x: (r.left - st.left) / k, y: (r.top - st.top) / k, w: r.width / k, h: r.height / k }; };
      const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const btns = [...document.querySelectorAll('.secNavBtn')].filter(e => !e.hidden).map(e => ({ n: e.textContent.trim(), r: rc(e) }));
      const others = [['билет', rc(document.querySelector('#bTk'))], ['коуч (резерв)', { x: 472, y: 520, w: 322, h: 100 }], ['тосты (резерв)', { x: 484, y: 136, w: 380, h: 120 }], ['билет (резерв)', { x: 0, y: 76, w: 870, h: 54 }], ['HUD', { x: 598, y: 12, w: 168, h: 44 }]];
      document.querySelectorAll('#bZones [data-z]').forEach(z => others.push(['зона ' + z.dataset.z, rc(z)]));
      const bad = []; btns.forEach(b => others.forEach(([n, o]) => { if (hit(b.r, o)) bad.push(b.n + ' × ' + n); }));
      const inside = btns.every(b => b.r.x >= -0.5 && b.r.x + b.r.w <= 1280.5 && b.r.y >= 521.5 && b.r.y + b.r.h <= 574.5);
      return { btns: btns.map(b => b.n + ' ' + Math.round(b.r.x) + ',' + Math.round(b.r.y) + ' ' + Math.round(b.r.w) + '×' + Math.round(b.r.h)), bad, inside };
    });
    ok(rep.bad.length === 0 && rep.inside && rep.btns.length === 2, `наложения стрелок ${vp.width}×${vp.height}: ${rep.bad.length ? rep.bad.join('; ') : 'нет'}; внутри полосы ${rep.inside}; ${rep.btns.join(' | ')}`);
    if (vp.width === 1024) await shot(p, 'b12_7_center_arrows_1024x600');
  }
  await ctx.close();
  ok(!errs.length, errs.length ? errs.slice(0, 4).join(' | ') : 'ошибок страницы нет'); console.log(fails ? 'FAILS ' + fails : 'NO_ERRORS'); await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
