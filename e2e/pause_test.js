/* Пауза во время приготовления: окна скрыты, ввод заблокирован, зажатое прерывается, после «Продолжить» всё на месте.
   Запуск (отладочная сборка): BASE=http://localhost:4173 HASH='#nopixi-lowfx' node e2e/pause_test.js dist/artifact.html out/pause */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const out = process.argv[3] || 'out/pause';
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, endDay };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await require('./pw').page(b);
  const errs = []; require('./pw').watch(p, errs);
  await p.addInitScript(() => { let a = 4242; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
  const ok = (name, v) => { console.log((v ? 'OK   ' : 'FAIL ') + name); if (!v) errs.push('FAIL ' + name); };
  await p.goto(require('./pw').url(tmp) + (process.env.HASH || '#nopixi-lowfx')); await p.waitForTimeout(600);
  await require('./pw').startNew(p); await p.waitForTimeout(400);
  await p.evaluate(() => { const G = window.__dbg.G; G.milk = true; G.day = 2; G.rank = 3; G.hints = true; });
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 40000 });

  const vis = sel => p.evaluate(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).visibility : 'none'; }, sel);
  const ic = async (x, y) => { const r = await p.evaluate(() => { const r = document.querySelector('#bi').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); return [r[0] + x * r[2] / 440, r[1] + y * r[3] / 450]; };
  const msgs = () => p.evaluate(() => [...document.querySelectorAll('.bmsg')].map(e => e.textContent).join('|'));
  const snap = () => p.evaluate(() => { const B = window.__dbg.BR; return { inset: B.inset, dose: B.dose, fill: B.fill, ml: B.shot.ml, st: B.shot.st, T: B.pit.T, pml: B.pit.ml, lvl: B.pourLevel, blobs: B.blobs.length, hold: B.hold }; });
  const same = (a, b2) => ['inset', 'dose', 'fill', 'ml', 'st', 'T', 'pml', 'lvl', 'blobs'].every(k => Math.abs((a[k] === b2[k] ? 0 : (typeof a[k] === 'number' ? a[k] - b2[k] : 1))) < 1e-9);
  const hiddenMock = on => p.evaluate(on => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => on }); if (on) document.dispatchEvent(new Event('visibilitychange')); }, on);
  const doPause = async how => {
    if (how === 'key') await p.keyboard.press('KeyP');
    else if (how === 'auto') await hiddenMock(true);
    else if (how === 'blur') await p.evaluate(() => window.dispatchEvent(new Event('blur')));
    await p.waitForSelector('[data-resume]', { timeout: 3000 }); await p.waitForTimeout(250);
  };
  const resume = async how => { if (how === 'auto') await hiddenMock(false); await p.click('[data-resume]'); await p.waitForTimeout(350); };

  /* одна проверка: подготовка → открыть станцию → зажать → пауза → всё скрыто и стоит → отпустить → продолжить → всё на месте */
  async function scenario(name, how, prep, zone, holdAt, beforeHold) {
    await p.evaluate(prep);
    await p.click(`[data-z=${zone}]`, { force: true }); await p.waitForTimeout(500); await require('./pw').dismissCard(p); /* первое открытие станции показывает «Зачем это нужно»: окно держит CARDON и забирает клавишу P */
    if (beforeHold) await beforeHold();
    let held = false;
    if (holdAt) { const [x, y] = await ic(...holdAt); await p.mouse.move(x, y); await p.mouse.down(); held = true; await p.waitForTimeout(700); }
    const before = await snap();
    await doPause(how);
    const atP = await snap();
    ok(`${name}/${how}: на паузе зажатие снято`, atP.hold === false);
    for (const s of ['#bTk', '#bCoach', '#bi', '#xPanel', '#bFloat', '#bClose', '#frontHint', '#toast', '#helperChip']) {
      const v = await vis(s); if (v === 'visible' && s !== '#bCoach' && s !== '#bi') errs.push(`FAIL ${name}/${how}: ${s} виден на паузе`);
    }
    ok(`${name}/${how}: #bar скрыт, виден только экран паузы`, (await vis('#bar')) === 'hidden' && !(await p.evaluate(() => document.querySelector('#screen').hidden)));
    ok(`${name}/${how}: «Продолжить» сверху (клик попадёт в кнопку)`, await p.evaluate(() => { const b = document.querySelector('[data-resume]').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!e.closest('[data-resume]'); }));
    await p.screenshot({ path: `${out}_${name}_${how}_pause.png` });
    if (held) await p.mouse.up();
    await p.focus('[data-settings]'); await p.keyboard.press('Space'); await p.waitForTimeout(100); await p.keyboard.press('Escape'); await p.keyboard.press('KeyW'); await p.waitForTimeout(600);
    const frozen = await snap();
    if (!(same(atP, frozen))) console.log('DIFF', JSON.stringify(before), JSON.stringify(atP), JSON.stringify(frozen));
    ok(`${name}/${how}: за паузу прогресс не менялся, пробел не доходит до бара`, same(atP, frozen));
    await resume(how);
    ok(`${name}/${how}: после «Продолжить» нет сообщений-блокировок`, (await msgs()) === '' || !/Сначала|Ещё не/.test(await msgs()));
    const after = await snap();
    ok(`${name}/${how}: то же окно и тот же прогресс`, same(atP, after));
    ok(`${name}/${how}: окно станции снова видно`, (await vis('#bar')) === 'visible');
    ok(`${name}/${how}: «призрачного» зажатия нет`, after.hold === false);
    await p.waitForTimeout(500);
    ok(`${name}/${how}: без зажатия прогресс не растёт`, same(after, await snap()));
    await p.screenshot({ path: `${out}_${name}_${how}_resume.png` });
    return after;
  }

  /* заказ латте и открытие бара */
  const startOrder = async () => {
    await p.evaluate(() => { const c = window.__dbg.D.customers[0]; c.drink = 'latte'; c.strong = false; c.syrup = null; c.pumps = 2; c.pat = c.max = 9999; });
    await p.keyboard.press('Space'); await p.waitForTimeout(600); await require('./pw').dismissCard(p);
  };
  await startOrder();

  /* 1. помол: зажали «Молоть», пауза, продолжить; затем клавишей, автопаузой, блюром */
  await scenario('grind', 'key', () => {}, 'grind', [155, 384]);
  const g = await snap();
  { const [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up(); const g2 = await snap(); ok('grind: после паузы помол продолжается обычным нажатием', g2.dose > g.dose); }
  await p.evaluate(() => { window.__dbg.BR.dose = 5; });
  { const [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(500); const before = await snap(); await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.waitForSelector('[data-resume]'); await p.mouse.up(); await p.waitForTimeout(500); const fr = await snap(); ok('grind/blur: зажатие снято, помол стоит', fr.hold === false && Math.abs(fr.dose - before.dose) < 0.5);
    await p.click('[data-resume]'); await p.waitForTimeout(400); ok('grind/blur: после продолжения нет сообщений', !/Сначала/.test(await msgs())); }
  /* закончить помол и темпер быстро: дальше проверяем шот, воду, пар, заливку */
  await p.evaluate(() => { const B = window.__dbg.BR; B.done.grind = true; B.res.grind = 1; B.dose = 18; B.done.tamp = true; B.res.tamp = 1; B.tampP = 15; });
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  /* 2. шот идёт: автопауза */
  await p.click('[data-z=shot]', { force: true }); await p.waitForTimeout(400); await require('./pw').dismissCard(p);
  await p.keyboard.press('Space'); await p.waitForTimeout(300); await p.keyboard.press('Space'); await p.waitForTimeout(1500);
  { const before = await snap(); ok('шот: идёт (st=run)', before.st === 'run');
    await doPause('auto'); const frz0 = await snap(); await p.waitForTimeout(900); const fr = await snap();
    ok('шот: на паузе жидкость не льётся', fr.ml === frz0.ml && fr.st === 'run');
    await p.screenshot({ path: `${out}_shot_auto_pause.png` });
    await resume('auto'); const af = await snap(); console.log('shot before', before.ml, before.st, 'after', af.ml, af.st); ok('шот: после продолжения тот же шаг и объём', af.st === 'run' && Math.abs(af.ml - frz0.ml) < 3);
    ok('шот: нет сообщений-блокировок', !/Сначала|Ещё не/.test(await msgs()));
    await p.waitForTimeout(800); ok('шот: идёт дальше после паузы', (await snap()).ml > af.ml);
    await p.keyboard.press('Space'); await p.waitForTimeout(500); }
  await p.evaluate(() => { const B = window.__dbg.BR; B.done.shot = true; B.res.shot = 1; });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  /* 3. вода (налив): зажатая кнопка */
  await scenario('water', 'key', () => { const B = window.__dbg.BR; B.cup.es = 36; }, 'water', [155, 384]).catch(e => { errs.push('FAIL water: ' + e.message); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  /* 4. пар: молоко налито, мышь зажата */
  await scenario('steam', 'blur', () => { const B = window.__dbg.BR; B.done.milk = true; B.res.milk = 1; B.cup.milk = 150; B.pit.ml = 150; }, 'steam', [220, 200]).catch(e => { errs.push('FAIL steam: ' + e.message); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  /* 5. заливка */
  await scenario('pour', 'key', () => { const B = window.__dbg.BR; B.done.steam = true; B.res.steam = 1; B.pit.steamed = true; B.pit.ml = 150; B.pit.foam = .3; B.cup.es = 36; B.cup.milk = 150; }, 'pour', [220, 150]).catch(e => { errs.push('FAIL pour: ' + e.message); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  /* 6. зал: реплика гостя и тост, пауза из зала */
  await p.evaluate(() => window.__dbg.BR && 0);
  await p.keyboard.press('Tab'); await p.waitForTimeout(800);
  await p.evaluate(() => { const c = window.__dbg.D.customers[0]; c.sayDone = false; c.sayVis = 0; });
  await p.waitForFunction(() => document.querySelector('.say.show'), null, { timeout: 8000 });
  await p.evaluate(() => { window.__dbg.D.customers[0].sayVis = 2; }); /* реплика уже показана 2 из 5 секунд */
  await p.evaluate(() => { const t = document.querySelector('#toast'); t.textContent = 'Проверочный тост'; t.classList.add('show'); });
  const sv0 = await p.evaluate(() => window.__dbg.D.customers[0].sayVis);
  await doPause('key'); await p.waitForTimeout(1500);
  ok('зал: реплика и тост скрыты на паузе', (await vis('.say')) === 'hidden' && (await vis('#toast')) === 'hidden');
  await p.screenshot({ path: `${out}_hall_pause.png` });
  const sv1 = await p.evaluate(() => window.__dbg.D.customers[0].sayVis);
  ok('зал: время показа реплики на паузе не идёт', Math.abs(sv1 - sv0) < 0.2);
  await resume('key');
  ok('зал: после продолжения реплика снова видна', (await vis('.say')) === 'visible');
  const sv2 = await p.evaluate(() => window.__dbg.D.customers[0].sayVis);
  ok('зал: осталось то же время показа (не сбросилось)', sv2 >= sv1 - 0.01 && sv2 < sv1 + 0.8);
  await p.screenshot({ path: `${out}_hall_resume.png` });
  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
