/* Книга рецептов: цена недостающего оборудования и кнопка «Подсказка». Запуск: BASE=http://localhost:4173 node e2e/book_tut.js dist/artifact.html out/bk */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, endDay };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) }); const p = await require('./pw').page(b); const errs = []; require('./pw').watch(p, errs);
  const ok = (n, v) => { console.log((v ? 'OK   ' : 'FAIL ') + n); if (!v) errs.push('FAIL ' + n); };
  await p.goto(require('./pw').url(tmp) + '#nopixi-lowfx'); await p.waitForTimeout(600); await require('./pw').startNew(p); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__dbg.G.rank = 5; window.__dbg.G.day = 9; }); await p.evaluate(() => window.__dbg.endDay());
  await p.waitForSelector('.evening', { timeout: 15000 }); await p.waitForTimeout(1500);
  await p.click('[data-book=evening]'); await p.waitForTimeout(800);
  const need = await p.locator('.bkNeed').allTextContents(); console.log(need.slice(0, 3));
  ok('«Нужно купить» с ценой', need.some(t => /— ₽ [\d\s\u00a0]+/.test(t)));
  await p.click('[data-bookfam=matcha]'); await p.waitForTimeout(400);
  await p.click('.bkHint'); await p.waitForTimeout(400);
  const txt = await p.textContent('.bkCoach'); console.log(txt);
  ok('подсказка раскрылась со шагами', txt.includes('1.') && txt.includes('Взбивать'));
  await p.screenshot({ path: process.argv[3] + '_book.png' });
  await p.click('.bkHint'); await p.waitForTimeout(300);
  ok('повторное нажатие скрывает', !(await p.$('.bkCoach')));
  /* разворот с молочным напитком и разворот с холодным: таблица «размер → шоты → состав → пена → цена» и шаги варианта */
  await p.click('[data-bookfam=milk]'); await p.waitForTimeout(400);
  ok('молочные: в карточке есть таблица размеров и шаги «Шот»', await p.evaluate(() => !!document.querySelector('.bkTbl') && /Шот/.test(document.querySelector('.bkVar').textContent)));
  await p.screenshot({ path: process.argv[3] + '_book_milk.png' });
  await p.click('[data-bookfam=tonic]'); await p.waitForTimeout(400);
  ok('холодные: в карточке тоника лёд и слои', await p.evaluate(() => /Лёд/.test(document.querySelector('.bkTbl').textContent) && /Слои/.test(document.querySelector('.bkVar').textContent)));
  await p.screenshot({ path: process.argv[3] + '_book_cold.png' });
  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
