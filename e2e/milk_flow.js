/* Магазин и обучение молоку: день 1 (в магазине нет молока и зависимого от него) → ранг 2 (молоко появилось, плашка про магазин)
   → покупка (появились питчер и трафарет) → первые гости следующего дня → первый латте: карточка «Новый напиток» и шаги молоко / пар / заливка
   → второй латте: ни карточки, ни подсказок.
   Запуск (отладочная сборка): BASE=http://localhost:4173 HASH='#nopixi-lowfx' node e2e/milk_flow.js dist/artifact.html out/milk */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const out = process.argv[3] || 'out/milk';
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, endDay, barAbort, SET, spawn, exit };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const pw = require('./pw'), p = await pw.page(b);
  const errs = []; pw.watch(p, errs);
  const ok = (name, v) => { console.log((v ? 'OK   ' : 'FAIL ') + name); if (!v) errs.push('FAIL ' + name); };
  const coach = () => p.evaluate(() => { const e = document.querySelector('#bCoach'); return e.hidden ? '' : e.textContent; });
  const goal = () => p.evaluate(() => { const e = document.querySelector('#bGoal'); return e.hidden ? '' : e.textContent; });
  /* реплика коуча живёт не короче max(4 с; длина / 12) и сменяется через 1,5 с после выполнения шага (этап 12.2): ждём нужный текст */
  const waitCoach = async (re, ms = 40000) => { const t0 = Date.now(); for (;;) { const t = await coach(); if (re.test(t) || Date.now() - t0 > ms) return t; await p.waitForTimeout(150); } };
  const glow = () => p.evaluate(() => { const e = document.querySelector('#tutHl'); return e.hidden ? '' : e.style.left + '/' + e.style.top; });
  const shopNames = () => p.evaluate(() => [...document.querySelectorAll('.evening .item b')].map(e => e.textContent));
  const allShop = async () => { const all = []; for (const t of ['menu', 'gear', 'hall']) { await p.click(`[data-tab=${t}]`); await p.waitForTimeout(250); all.push(...await shopNames()); } return all; };
  await p.goto(pw.url(tmp) + (process.env.HASH || '#nopixi-lowfx')); await p.waitForTimeout(600);
  await pw.startNew(p); await p.waitForTimeout(500);

  /* 1. день 1: в магазине нет молока и всего, что от него зависит */
  await p.evaluate(() => { window.__dbg.G.money = 5000; window.__dbg.endDay(); });
  await p.waitForSelector('.evening', { timeout: 15000 }); await p.waitForTimeout(1500);
  let names = await allShop(); console.log('день 1, магазин:', names.join(' | '));
  ok('день 1: нет «Молоко и капучино»', !names.includes('Молоко и капучино'));
  ok('день 1: нет трафарета и питчера с термометром', !names.includes('Трафарет для арта') && !names.includes('Питчер с термометром'));
  ok('день 1: нет оборудования рангов 2+ (витрины, лёд, порошки…)', !names.some(n => /Витрин|Ледо|порош|Набор для матчи|Чайная|Блендер|Шейкер/i.test(n)));
  ok('день 1: зерно, кофемолка, темпер остаются', ['Зерно получше', 'Кофемолка с экраном', 'Калиброванный темпер'].every(n => names.includes(n)));
  await p.screenshot({ path: out + '_1day1_shop.png' });

  /* 2. ранг 2 */
  await p.click('[data-next]'); await p.waitForTimeout(800);
  await p.evaluate(() => { const G = window.__dbg.G; G.served = 8; G.rating = 3; G.money = 3000; window.__dbg.D.nextArr = 9999; window.__dbg.endDay(); });
  await p.waitForSelector('.evening', { timeout: 15000 }); await p.waitForTimeout(1500);
  const rc = await p.textContent('.rankcard.up').catch(() => '');
  console.log('плашка ранга:', JSON.stringify(rc));
  ok('ранг 2: плашка говорит, что в магазине появилось молоко', /В магазине теперь можно купить: .*Молоко и капучино/.test(rc));
  ok('ранг 2: в плашке нет того, что ещё нельзя купить', !/Трафарет|Питчер/.test(rc));
  names = await allShop(); console.log('ранг 2, магазин:', names.join(' | '));
  ok('ранг 2: молоко в магазине', names.includes('Молоко и капучино'));
  ok('ранг 2: трафарета и питчера всё ещё нет (молока нет)', !names.includes('Трафарет для арта') && !names.includes('Питчер с термометром'));
  await p.click('[data-tab=menu]'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '_2rank2_shop.png' });

  /* 3. покупка молока */
  await p.click('[data-buy=milk]'); await p.waitForTimeout(700);
  const note = (await p.textContent('.note.newEq').catch(() => '')).trim(); console.log('плашка покупки:', JSON.stringify(note));
  ok('после покупки молока: плашка и про подсказки, и про новое в магазине', /Новое: молоко/.test(note) && /В магазине теперь можно купить: .*(Питчер|Трафарет)/.test(note));
  names = await allShop(); ok('после покупки появились трафарет и питчер', names.includes('Трафарет для арта') && names.includes('Питчер с термометром'));
  await p.click('[data-tab=menu]'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '_3after_buy.png' });
  ok('покупка попала в сохранение', await p.evaluate(() => JSON.parse(localStorage.getItem('coffee-sim-save-v1')).up.includes('milk')));

  /* 4. следующий день: в первых 5 гостях есть молочный заказ */
  await p.click('[data-next]'); await p.waitForTimeout(800);
  await p.evaluate(() => { window.__dbg.D.nextArr = 9999; });
  const ids = await p.evaluate(() => { const d = window.__dbg, r = []; for (let i = 0; i < 5; i++) { d.spawn(); const c = d.D.customers[d.D.customers.length - 1]; r.push(c.order.id); d.D.customers.slice().forEach(d.exit); } return r; });
  console.log('первые 5 заказов дня:', ids.join(', '));
  ok('в первых 5 заказах есть молочный напиток', await p.evaluate(ids => ids.some(id => window.__MENUAPI.needsMilk(window.__MENUAPI.DRINKS.find(d => d.id === id))), ids));

  /* 5. первый латте */
  const makeLatte = () => p.evaluate(() => {
    const d = window.__dbg, M = window.__MENUAPI; d.spawn();
    const c = d.D.customers[d.D.customers.length - 1]; let o;
    for (let i = 0; i < 8000 && !(o && o.id === 'latte' && o.size === '0.2' && !o.cold && !o.syrup && !o.food); i++) o = M.rollOrder({ rank: d.G.rank, day: d.G.day, milk: true, eq: {} }, 'regular');
    c.order = o; c.drink = o.key; c.syrup = null; c.pumps = 1; c.strong = false; c.pat = c.max = 99999; return o.id;
  });
  console.log('латте 1:', await makeLatte());
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 40000 });
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  const card = await p.evaluate(() => { const e = document.querySelector('#drinkCard'); return e.hidden ? '' : e.textContent; });
  console.log('карточка:', JSON.stringify(card));
  ok('перед приготовлением карточка «Новый напиток» с рецептом', /Новый напиток/.test(card) && /Латте/.test(card) && /Пар: до 55–62/.test(card) && /22%/.test(card) && /Понятно/.test(card));
  ok('пока карточка открыта, бар не начат', await p.evaluate(() => window.__dbg.BR === null));
  await p.screenshot({ path: out + '_4card.png' });
  const pat0 = await p.evaluate(() => window.__dbg.D.customers[0].pat); await p.waitForTimeout(1200);
  ok('терпение гостя стоит, пока читаем карточку', await p.evaluate(p0 => window.__dbg.D.customers[0].pat === p0, pat0));
  await p.click('[data-cardok]'); await p.waitForTimeout(900);
  ok('после «Понятно» бар открылся', await p.evaluate(() => !!window.__dbg.BR && document.querySelector('#drinkCard').hidden));
  await p.evaluate(() => { const B = window.__dbg.BR; for (const t of B.tasks) { if (t === 'milk') break; B.done[t] = true; B.res[t] = 1; } B.pf = 'group'; });
  await p.waitForTimeout(400);
  let t = await waitCoach(/Молоко/, 40000); console.log('коуч до молока:', JSON.stringify(t));
  ok('коуч называет шаг и где он', /Новый шаг/.test(t) && /Молоко/.test(t) && /холодильник/.test(t));
  await p.screenshot({ path: out + '_5milk_zone.png' });
  const bi = async () => { const sel = await p.evaluate(() => (document.querySelector('#bi').style.display === 'block' ? '#bi' : '#bp')); return p.locator(sel).boundingBox(); };
  const at = async (x, y) => { const r = await bi(); return { x: r.x + x * r.width / 440, y: r.y + y * r.height / 450 }; };
  await p.click('[data-z=milk]', { force: true }); await p.waitForTimeout(700);
  t = await waitCoach(/Шаг 1 из 2/, 40000); console.log('коуч в молоке:', JSON.stringify(t));
  ok('молоко, шаг 1: «Лить молоко» и линия 142 мл (латте 0,2 л)', /Шаг 1 из 2/.test(t) && /Лить молоко/.test(t) && /142 мл/.test(t));
  ok('цель над окном: молоко до линии 142 мл', (await goal()) === 'Цель: Молоко до линии: 142 мл');
  ok('молоко, шаг 1: подсвечена кнопка «Лить»', (await glow()) === '49px/561px');
  await p.screenshot({ path: out + '_6milk_inset.png' });
  let pt = await at(150, 384); await p.mouse.move(pt.x, pt.y); await p.mouse.down();
  await p.waitForFunction(() => window.__dbg.BR.fill >= 135, null, { timeout: 20000, polling: 25 }); await p.mouse.up(); await p.waitForTimeout(300);
  ok('цель сменилась сразу и «Готово» подсвечена, а коуч держит шаг 1 (минимум показа)', (await goal()) === 'Цель: Лишнее вылить, затем «Готово»' && (await glow()) === '315px/561px' && /Шаг 1 из 2/.test(await coach()));
  t = await waitCoach(/Шаг 2 из 2/, 40000); ok('молоко, шаг 2: «Готово» (после паузы)', /Шаг 2 из 2/.test(t));
  await p.screenshot({ path: out + '_7milk_done.png' });
  pt = await at(353, 384); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(500);
  ok('молоко принято', await p.evaluate(() => window.__dbg.BR.done.milk === true));
  ok('шаг молока отмечен как пройденный', await p.evaluate(() => window.__dbg.G.tutorialSeen.includes('step:milk')));

  /* пар */
  t = await waitCoach(/Пар и пена/, 40000); console.log('коуч до пара:', JSON.stringify(t));
  ok('пар: коуч ведёт к паровой трубке', /Пар и пена/.test(t) && /паровую трубку/.test(t));
  await p.click('[data-z=steam]', { force: true }); await p.waitForTimeout(700);
  t = await waitCoach(/Шаг 1 из 3/, 40000); console.log('коуч в паре:', JSON.stringify(t));
  ok('пар, шаг 1: воздух', /Шаг 1 из 3/.test(t) && /Воздух/.test(t));
  ok('цель над окном: пена около 22 %, у поверхности около 1 с', (await goal()) === 'Цель: Пена около 22%: у поверхности около 1 с');
  await p.screenshot({ path: out + '_8steam_1.png' });
  pt = await at(150, 200); await p.mouse.move(pt.x, pt.y); await p.mouse.down();
  const surf = () => p.evaluate(() => { const p = window.__dbg.BR.pit; return 330 - ((p.ml + p.es) * (1 + .6 * p.foam)) / window.__dbg.BR.pitCap * 220; });
  let tries = 0;
  while (tries++ < 400) {
    const s = await surf(); const q = await at(150, s + 8); await p.mouse.move(q.x, q.y);
    if (await p.evaluate(() => { const B = window.__dbg.BR; return B.pit.foam >= B.rc.foam - .04 || B.pit.T >= 44; })) break;
    await p.waitForTimeout(30);
  }
  await p.mouse.up(); /* стоим на шаге 2, пока коуч дочитают: нагрев остановлен */
  ok('цель сменилась сразу: опустите трубку глубже', (await goal()) === 'Цель: Опустите трубку глубже');
  t = await waitCoach(/Шаг 2 из 3/, 40000); console.log('коуч, пена набрана:', JSON.stringify(t));
  await p.click('[data-coachrep]'); await p.waitForTimeout(400); { const rep = await coach(); ok('«Повторить» показывает предыдущую подсказку (шаг 1)', /повтор/.test(rep) && /Воздух/.test(rep)); }
  pt = await at(150, (await surf()) + 8); await p.mouse.move(pt.x, pt.y); await p.mouse.down();
  ok('пар, шаг 2: «Закрутите»', /Шаг 2 из 3/.test(t) && /Закрутите/.test(t));
  await p.screenshot({ path: out + '_9steam_2.png' });
  tries = 0;
  while (tries++ < 400) {
    const s = await surf(); const q = await at(150, s + 60); await p.mouse.move(q.x, q.y);
    if (await p.evaluate(() => window.__dbg.BR.pit.T >= 56)) break;
    await p.waitForTimeout(30);
  }
  await p.mouse.up();
  t = await coach(); console.log('коуч, молоко нагрето:', JSON.stringify(t), 'T=', await p.evaluate(() => window.__dbg.BR.pit.T));
  ok('цель над окном: стоп в зоне 55–62°', (await goal()) === 'Цель: Стоп на 55–62°, не выше 76°');
  ok('пар, шаг 3: «Остановите», зона латте 55–62°', /Шаг 3 из 3/.test(t) && /55–62°/.test(t));
  ok('пар, шаг 3: подсвечена кнопка «Готово»', (await glow()) === '315px/589px');
  await p.screenshot({ path: out + '_10steam_3.png' });
  pt = await at(353, 410); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(500);
  ok('пар принят', await p.evaluate(() => window.__dbg.BR.done.steam === true));
  ok('шаг пара отмечен как пройденный', await p.evaluate(() => window.__dbg.G.tutorialSeen.includes('step:steam:thin')));

  /* заливка */
  t = await waitCoach(/Заливка и рисунок/, 40000); console.log('коуч до заливки:', JSON.stringify(t));
  ok('заливка: коуч ведёт к чашке', /Заливка и рисунок/.test(t) && /чашку/.test(t));
  await p.click('[data-z=pour]', { force: true }); await p.waitForTimeout(700);
  t = await waitCoach(/Шаг 1 из 2/, 40000); ok('заливка, шаг 1: ведите по контуру', /Шаг 1 из 2/.test(t) && /контуру/.test(t) && (await goal()) === 'Цель: Ведите мышью по контуру рисунка');
  pt = await at(220, 205); await p.mouse.move(pt.x, pt.y); await p.mouse.down();
  for (let i = 0; i < 400 && !(await p.evaluate(() => window.__dbg.BR.done.pour)); i++) {
    const a = i / 6, q = await at(220 + 40 * Math.cos(a), 205 + 40 * Math.sin(a)); await p.mouse.move(q.x, q.y); await p.waitForTimeout(40);
    if (i === 8) { ok('заливка, шаг 2: цель «Питчер пуст» сразу, «Готово» подсвечена', (await goal()) === 'Цель: Питчер пуст: напиток готов'); }
  }
  await p.mouse.up();
  ok('заливка принята', await p.evaluate(() => window.__dbg.BR.done.pour === true));
  ok('в сохранении: напиток и три шага отмечены', await p.evaluate(() => ['drink:latte', 'step:milk', 'step:steam:thin', 'step:pour'].every(k => window.__dbg.G.tutorialSeen.includes(k))));
  await p.screenshot({ path: out + '_11pour_done.png' });

  /* 6. второй латте: ни карточки, ни подсказок */
  await p.evaluate(() => { window.__dbg.barAbort(); window.__dbg.D.customers.slice().forEach(window.__dbg.exit); });
  console.log('латте 2:', await makeLatte());
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 40000 });
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  ok('второй латте: карточки нет, бар открылся', await p.evaluate(() => !!window.__dbg.BR && document.querySelector('#drinkCard').hidden));
  const seen = [];
  for (const z of ['milk', 'steam', 'pour']) {
    await p.evaluate(z => { const B = window.__dbg.BR; for (const t of B.tasks) { if (t === z) break; B.done[t] = true; B.res[t] = 1; } }, z);
    await p.waitForTimeout(300); const c1 = await coach(); seen.push(c1);
    await p.click(`[data-z=${z}]`, { force: true }); await p.waitForTimeout(600); seen.push(await coach(), await glow());
  }
  console.log('коуч и подсветка на втором латте:', JSON.stringify(seen));
  ok('второй латте: нет подсказок по шагам (коуч скрыт, подсветки нет)', seen.every(x => x === ''));
  await p.screenshot({ path: out + '_12second.png' });

  /* 7. «Пропустить» и выключенные подсказки */
  await p.evaluate(() => { window.__dbg.barAbort(); window.__dbg.D.customers.slice().forEach(window.__dbg.exit); const G = window.__dbg.G; G.tutorialSeen = G.tutorialSeen.filter(k => !/^step:|^drink:latte/.test(k)); });
  console.log('латте 3:', await makeLatte());
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 40000 });
  await p.keyboard.press('Space'); await p.waitForTimeout(700);
  ok('карточка снова (метки сброшены)', await pw.dismissCard(p));
  await p.evaluate(() => { const B = window.__dbg.BR; for (const t of B.tasks) { if (t === 'milk') break; B.done[t] = true; B.res[t] = 1; } });
  await p.waitForTimeout(400);
  ok('подсказка молока есть и пропускается', /Новый шаг/.test(await coach()));
  await p.click('[data-tutskip]'); await p.waitForTimeout(500);
  ok('после «Пропустить» подсказка молока не возвращается', !/Молоко\./.test(await coach()) && await p.evaluate(() => window.__dbg.G.tutorialSeen.includes('step:milk')));
  await p.evaluate(() => { const G = window.__dbg.G; G.tutorialSeen = G.tutorialSeen.filter(k => !/^step:|^drink:latte/.test(k)); G.tutOff = true; });
  await p.waitForTimeout(400);
  ok('подсказки выключены игроком: коуча нет', (await coach()) === '');

  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
