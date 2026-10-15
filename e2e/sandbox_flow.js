/* Песочница (#dev): без #dev её нет; с #dev — экран настройки, панель, подмена заказа, конец дня; настоящий сейв и настройки не меняются.
   node e2e/sandbox_flow.js dist/artifact.html out/sbx   (собрать: CUPPABLE_DEBUG=1 npx vite build && CUPPABLE_DEBUG=1 node scripts/fragment.mjs) */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const pw = require('./pw');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, endDay, barOpen, complete, barBell, MENUAPI: window.__MENUAPI, SHOP, shopState }');
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

  /* 2. с #dev: кнопка, экран настройки: день 10, «Средний», «Всё доступное» */
  const before = await ls();
  await p.goto('about:blank'); await p.goto(url + '#dev-nopixi-lowfx'); await p.waitForSelector('[data-sandbox]', { timeout: 30000 }); await p.waitForTimeout(500);
  ok(await p.locator('[data-start]').count() === 1 && await p.locator('[data-settings]').count() === 1, 'с #dev: остальные кнопки меню на месте');
  await p.click('[data-sandbox]'); await p.waitForSelector('[data-menu="sandbox"]'); await p.waitForTimeout(700);
  await p.fill('[data-f="day"]', '10'); await p.press('[data-f="day"]', 'Tab'); await p.waitForTimeout(200);
  ok(await p.inputValue('[data-f="profile"]') === 'medium' && await p.inputValue('[data-f="mode"]') === 'all', 'по умолчанию «Средний» и «Всё доступное»');
  const maxRank = await p.evaluate(() => { const d = document.querySelector('[data-custom]'); d.open = true; return +document.querySelector('[data-f="rank"]').max; });
  ok(maxRank >= 3 && maxRank < 9, 'на день 10 максимум ранг ' + maxRank);
  /* в «Своём» нельзя поставить ранг 9 на день 10 */
  await p.fill('[data-f="rank"]', '9'); await p.press('[data-f="rank"]', 'Tab'); await p.waitForTimeout(300);
  const r9 = +await p.inputValue('[data-f="rank"]');
  ok(r9 === maxRank, 'ранг 9 на день 10 приведён к допустимому: ' + r9);
  ok(await p.locator('[data-item="eq_blender"]').isDisabled() && !await p.locator('[data-item="eq_blender"]').isChecked(), 'позиция будущего ранга (блендер) выключена и не отмечена');
  ok(await p.locator('[data-item="milk"]').isChecked(), 'молоко отмечено (доступно к дню 10)');
  /* снять молоко: то, что после молока, снимается */
  await p.uncheck('[data-item="milk"]'); await p.waitForTimeout(200);
  ok(!await p.locator('[data-item="stencil"]').isChecked() && await p.locator('[data-item="stencil"]').isDisabled(), 'без молока трафарет снят и недоступен');
  await p.check('[data-item="milk"]'); await p.waitForTimeout(200);
  await p.click('[data-custom] summary'); await p.waitForTimeout(400);
  const bought = +(/куплено (\d+)/.exec(await p.textContent('[data-sbx-summary]')) || [])[1];
  await p.screenshot({ path: out + '_setup.png' });
  await p.waitForTimeout(300); await p.click('[data-sbx="start"]'); await p.waitForSelector('#screen', { state: 'hidden' }); await p.waitForTimeout(500);
  const g = await p.evaluate(() => { const d = window.__dbg, G = d.G, M = d.MENUAPI; const eqBad = d.SHOP.filter(i => i.id.startsWith('eq_') && M.isShopItemAvailable(i, d.shopState()) && !G[i.id]).filter(i => M.EQUIPMENT.find(e => 'eq_' + e.id === i.id).rank > G.rank).map(i => i.id);
    return { day: G.day, rank: G.rank, max: M.maxRankForDay(G.day), milk: G.milk, ice: G.eq_ice, blender: G.eq_blender, shaker: G.eq_shaker, helper: G.helper, seen: G.tutorialSeen.length, eqBad }; });
  ok(g.day === 10 && g.rank <= g.max && g.rank === maxRank && g.milk && g.ice && !g.blender && !g.shaker && !g.helper && g.seen > 10, 'старт: день 10, ранг не выше допустимого, будущего оборудования нет ' + JSON.stringify(g));
  ok(bought === await p.evaluate(() => window.__dbg.SHOP.filter(i => window.__dbg.G[i.id]).length), 'сводка на экране совпадает с тем, что куплено: ' + bought);
  ok(g.eqBad.length === 0, 'в магазине нет оборудования будущих рангов');
  ok(JSON.parse(await p.evaluate(() => localStorage.getItem('chofix.sandbox.v1'))).day === 10, 'конфигурация запомнена в chofix.sandbox.v1');

  /* 3. панель: подменить заказ, позвать гостя, приготовить, закончить день */
  await p.click('#devBtn'); await p.waitForSelector('#devPanel:not([hidden])'); await p.waitForTimeout(600);
  const info = await p.textContent('#dvInfo'); ok(new RegExp('День 10 · ранг ' + g.rank + ' · Всё доступное').test(info), 'заголовок панели: ' + info);
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
  /* «Следующий ранг»: выше допустимого для дня — тост, ранг растёт, ставшее доступным открывается */
  const own0 = await p.evaluate(() => window.__dbg.SHOP.filter(i => window.__dbg.G[i.id]).length);
  await p.click('[data-dv="rank"]'); await p.waitForTimeout(200);
  const nx = await p.evaluate(() => ({ rank: window.__dbg.G.rank, toast: document.querySelector('#toast').textContent, own: window.__dbg.SHOP.filter(i => window.__dbg.G[i.id]).length }));
  ok(nx.rank === g.rank + 1 && /нереалистичен/.test(nx.toast) && nx.own >= own0, 'следующий ранг: ' + JSON.stringify(nx));
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
