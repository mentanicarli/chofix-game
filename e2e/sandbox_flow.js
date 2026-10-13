/* Песочница (#dev): без #dev её нет; с #dev — экран настройки, панель, подмена заказа, конец дня; настоящий сейв и настройки не меняются.
   node e2e/sandbox_flow.js dist/artifact.html out/sbx   (собрать: CHOFIX_DEBUG=1 npx vite build && CHOFIX_DEBUG=1 node scripts/fragment.mjs) */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const pw = require('./pw');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, endDay, barOpen, complete, barBell }');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const out = process.argv[3] || 'out/sbx';
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await pw.page(b); const errs = []; pw.watch(p, errs);
  const url = pw.url(tmp);
  const SAVE = JSON.stringify({ v: 2, day: 4, rank: 2, served: 20, money: 777, rating: 2.5, pace: 'normal', up: ['beans'] });
  const SET = JSON.stringify({ sfxOn: true, musicOn: false });
  const ls = () => p.evaluate(() => [localStorage.getItem('coffee-sim-save-v1'), localStorage.getItem('chofix-settings')]);

  /* 1. без #dev: ни кнопки, ни панели, ни интерфейса песочницы */
  await p.goto(url + '#nopixi-lowfx'); await p.waitForSelector('[data-start]', { timeout: 30000 });
  await p.evaluate(([a, c]) => { localStorage.setItem('coffee-sim-save-v1', a); localStorage.setItem('chofix-settings', c); }, [SAVE, SET]);
  await p.reload(); await p.waitForSelector('[data-start]', { timeout: 30000 });
  ok(await p.locator('[data-sandbox]').count() === 0, 'без #dev: кнопки «Песочница» нет');
  ok(await p.evaluate(() => !document.querySelector('#devBtn, #devPanel') && window.__sandbox === undefined), 'без #dev: панели и window.__sandbox нет');
  ok(await p.evaluate(() => localStorage.getItem('chofix.sandbox.v1')) === null, 'без #dev: ключа песочницы нет');

  /* 2. с #dev: кнопка, экран настройки */
  const before = await ls();
  await p.goto('about:blank'); await p.goto(url + '#dev-nopixi-lowfx'); await p.waitForSelector('[data-sandbox]', { timeout: 30000 }); await p.waitForTimeout(500);
  ok(await p.locator('[data-start]').count() === 1 && await p.locator('[data-settings]').count() === 1, 'с #dev: остальные кнопки меню на месте');
  await p.click('[data-sandbox]'); await p.waitForSelector('[data-menu="sandbox"]'); await p.waitForTimeout(700);
  await p.selectOption('[data-f="rank"]', '5');
  const afterRank = await p.evaluate(() => ({ day: +document.querySelector('[data-f="day"]').value, rating: +document.querySelector('[data-f="rating"]').value, served: +document.querySelector('[data-f="served"]').value }));
  ok(afterRank.day >= 13 && afterRank.rating >= 3.2 && afterRank.served >= 90, 'ранг 5 подставил день ≥13, рейтинг ≥3,2, подано ≥90: ' + JSON.stringify(afterRank));
  await p.fill('[data-f="day"]', '10'); await p.fill('[data-f="money"]', '3000');
  await p.click('[data-sbx="none"]'); ok(await p.locator('[data-item]:checked').count() === 0, '«Ничего» снимает все позиции');
  await p.click('[data-sbx="all"]'); ok(await p.locator('[data-item]:not(:checked)').count() === 0, '«Все открыто» отмечает все позиции');
  await p.waitForTimeout(300); await p.screenshot({ path: out + '_setup.png' });
  await p.click('[data-sbx="start"]'); await p.waitForSelector('#screen', { state: 'hidden' }); await p.waitForTimeout(500);
  const g = await p.evaluate(() => { const G = window.__dbg.G; return { day: G.day, rank: G.rank, money: G.money, milk: G.milk, ice: G.eq_ice, blender: G.eq_blender, helper: G.helper, seen: G.tutorialSeen.length }; });
  ok(g.day === 10 && g.rank === 5 && g.milk && g.ice && g.blender && g.helper && g.seen > 10, 'старт: день 10, ранг 5, всё куплено, обучение пройдено ' + JSON.stringify(g));
  ok(JSON.parse(await p.evaluate(() => localStorage.getItem('chofix.sandbox.v1'))).day === 10, 'конфигурация запомнена в chofix.sandbox.v1');

  /* 3. панель: подменить заказ, позвать гостя, приготовить, закончить день */
  await p.click('#devBtn'); await p.waitForSelector('#devPanel:not([hidden])');
  await p.selectOption('[data-o="drink"]', 'latte'); await p.selectOption('[data-o="size"]', '0.3'); await p.selectOption('[data-o="cold"]', '0'); await p.selectOption('[data-o="syrup"]', '-'); await p.selectOption('[data-o="food"]', '-');
  await p.click('[data-dv="setorder"]');
  ok(/Задан: Латте/.test(await p.textContent('#dvNext')), 'заказ задан: ' + await p.textContent('#dvNext'));
  await p.click('[data-dv="nopat"]');
  await p.keyboard.press('KeyP'); await p.waitForSelector('[data-menu="pause"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#devPanel')).visibility === 'hidden' && getComputedStyle(document.querySelector('#devBtn')).visibility === 'hidden'), 'на паузе панель и кнопка DEV скрыты');
  await p.click('[data-resume]'); await p.waitForSelector('#screen', { state: 'hidden' });
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#devPanel')).visibility === 'visible'), 'после паузы панель снова видна');
  await p.click('[data-dv="call"]');
  await p.waitForFunction(() => { const c = window.__dbg.D.customers[0]; return c && c.arrived; }, null, { timeout: 40000 });
  const o = await p.evaluate(() => { const c = window.__dbg.D.customers[0]; return { id: c.order.id, size: c.order.size, cold: c.order.cold, syrup: c.order.syrup, food: c.order.food }; });
  ok(o.id === 'latte' && o.size === '0.3' && !o.cold && !o.syrup && !o.food, 'гость заказал заданное: ' + JSON.stringify(o));
  ok(await p.evaluate(() => window.__sandbox.state.next === null), 'подмена сработала один раз');
  await p.screenshot({ path: out + '_day.png' });
  await p.keyboard.press('Space'); await p.waitForTimeout(500); await pw.dismissCard(p);
  await p.evaluate(() => { const d = window.__dbg; d.BR.tasks.slice().forEach(t => d.complete(t, .9, '')); d.barBell(); });
  await p.waitForFunction(() => window.__dbg.D.stats.served === 1, null, { timeout: 15000 });
  ok(true, 'напиток приготовлен и подан');
  await p.waitForTimeout(700);
  const stTxt = await p.textContent('#dvStats'); ok(/Подано 1/.test(stTxt), 'статистика в панели: ' + stTxt.split('\n')[0]);
  await p.click('[data-dv="copy"]'); await p.waitForTimeout(300);
  const stats = JSON.parse(await p.evaluate(() => window.__sandboxStats));
  ok(stats.served === 1 && Array.isArray(stats.profile.q) && stats.profile.q.length === 3 && stats.profile.speed > 0, 'JSON статистики: ' + JSON.stringify(stats.profile));
  await p.click('[data-dv="endday"]'); await p.waitForSelector('.evening', { timeout: 15000 });
  ok(true, 'обычный итоговый экран дня');
  await p.screenshot({ path: out + '_evening.png' });

  /* 4. настоящий сейв и настройки не тронуты; выход в меню */
  const mid = await ls();
  ok(mid[0] === before[0] && mid[1] === before[1], 'настоящий сейв и настройки не изменились после песочницы');
  await p.click('[data-dv="exit"]'); await p.waitForSelector('[data-menu="title"]');
  const end = await ls();
  ok(end[0] === before[0] && end[1] === before[1] && end[0] === SAVE, 'после выхода в меню сейв и настройки те же');
  ok(await p.locator('[data-continue]').count() === 1, 'кнопка «Продолжить» ведёт на настоящий сейв');
  ok(errs.length === 0, errs.length ? 'ошибки: ' + errs.slice(0, 5).join(' | ') : 'NO_ERRORS');
  await b.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
