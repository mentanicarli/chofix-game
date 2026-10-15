/* К2: тексты К1 в игре. Книга рецептов (размер, горячий/холодный, «Точные цифры»), справочник, окна «Зачем это нужно»
   (один раз, перед карточкой напитка), перенос старого сохранения без пачки окон.
   Запуск (отладочная сборка): BASE=http://localhost:4173 HASH='#nopixi-lowfx' node e2e/content_flow.js dist/artifact.html out/content */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const out = process.argv[3] || 'out/content';
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, endDay, saveGame, barAbort, exit };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const pw = require('./pw'), p = await pw.page(b);
  const errs = []; pw.watch(p, errs);
  const ok = (name, v) => { console.log((v ? 'OK   ' : 'FAIL ') + name); if (!v) errs.push('FAIL ' + name); };
  /* скриншот в двух размерах окна: 1280×720 (сцена без масштаба) и 1024×600 */
  const shot = async (name) => {
    for (const [w, h] of [[1312, 752], [1024, 600]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(350); await p.screenshot({ path: `${out}_${name}_${w === 1312 ? '1280x720' : '1024x600'}.png` }); }
    await p.setViewportSize({ width: 1312, height: 752 }); await p.waitForTimeout(250);
  };
  const modal = () => p.evaluate(() => { const e = document.querySelector('#drinkCard'); return e.hidden ? '' : e.textContent; });
  const url = pw.url(tmp) + (process.env.HASH || '#nopixi-lowfx');
  await p.goto(url); await p.waitForTimeout(600);
  await pw.startNew(p); await p.waitForTimeout(500);

  /* ---------- 1. книга рецептов ---------- */
  await p.evaluate(() => { const G = window.__dbg.G; G.rank = 9; G.day = 31; G.milk = true; });
  await p.evaluate(() => window.__dbg.endDay()); await p.waitForSelector('.evening', { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.click('[data-book=evening]'); await p.waitForTimeout(700);
  await p.click('[data-bookfam=milk]'); await p.waitForTimeout(300);
  const latte = '[data-drink=latte]';
  ok('латте: один рецепт, выбор размера и горячий/холодный', await p.evaluate(s => { const c = document.querySelector(s); return !!c && !!c.querySelector('[data-booksize]') && !!c.querySelector('[data-bookcold]'); }, latte));
  ok('«Что это» и «Чем отличается» из К1', await p.evaluate(s => { const c = document.querySelector(s); return /Много горячего молока/.test(c.querySelector('.bkWhat').textContent) && /От капучино/.test(c.querySelector('.bkDiff').textContent); }, latte));
  ok('«Точные цифры» по умолчанию свёрнуты', await p.evaluate(s => { const c = document.querySelector(s); return !c.querySelector('.bkExact') && c.querySelector('.bkExactBtn').getAttribute('aria-expanded') === 'false'; }, latte));
  ok('в основном тексте нет граммов и миллилитров', await p.evaluate(s => !/\d+\s?(г|мл|°|кг)(\s|[.,:;)]|$)/.test(document.querySelector(s).querySelector('.bkHuman').textContent), latte));
  ok('«Если со льдом» не видно у горячего', await p.evaluate(s => !/Если со льдом/.test(document.querySelector(s).textContent), latte));
  await p.locator(latte).scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await shot('1book_hot');
  await p.click(`${latte} [data-booksize="latte|0.4"]`); await p.waitForTimeout(300);
  ok('размер 0,4 л: нажата кнопка размера, шагов про два шота прибавилось', await p.evaluate(s => { const c = document.querySelector(s); return c.querySelector('[data-booksize="latte|0.4"]').classList.contains('on') && /Шота два/.test(c.querySelector('.bkHuman').textContent); }, latte));
  await p.click(`${latte} [data-bookcold="latte|1"]`); await p.waitForTimeout(300);
  ok('холодный: появилось «Если со льдом», размер остался допустимым', await p.evaluate(s => { const c = document.querySelector(s); return /Если со льдом/.test(c.textContent) && !!c.querySelector('[data-bookcold="latte|1"].on'); }, latte));
  await p.click(`${latte} .bkExactBtn`); await p.waitForTimeout(300);
  ok('«Точные цифры» раскрылись: цифры от выбранного размера (0,4 л, холодный)', await p.evaluate(s => { const x = document.querySelector(s + ' .bkExact'); return !!x && /Лёд/.test(x.textContent) && /0,4 л/.test(x.textContent); }, latte));
  await shot('2book_exact');
  await p.click(`${latte} .bkExactBtn`); await p.waitForTimeout(300);
  ok('и снова сворачиваются', await p.evaluate(s => !document.querySelector(s + ' .bkExact'), latte));
  ok('слот под картинку скрыт и не занимает места', await p.evaluate(s => { const i = document.querySelector(s + ' .imgSlot'); return !!i && i.hidden && i.getBoundingClientRect().height === 0; }, latte));
  ok('у флэт уайт нет переключателя холодного', await p.evaluate(() => { p = document.querySelector('[data-drink=flat_white]'); return !!p && !p.querySelector('[data-bookcold]'); }));

  /* ---------- 2. справочник ---------- */
  await p.click('[data-booktab=guide]'); await p.waitForTimeout(400);
  ok('справочник: термины по группам, все свёрнуты', await p.evaluate(() => document.querySelectorAll('.gTerm').length >= 35 && document.querySelectorAll('.gTerm[open]').length === 0 && document.querySelectorAll('.gGroup').length === 4));
  await shot('3guide');
  await p.fill('#gQ', 'пит'); await p.waitForTimeout(300);
  ok('поиск «пит» оставляет питчер', await p.evaluate(() => { const v = [...document.querySelectorAll('.gTerm')].filter(e => !e.hidden).map(e => e.dataset.n); return v.length >= 1 && v.every(n => n.includes('пит')) && v.includes('питчер'); }));
  await p.click('.gTerm:not([hidden]) summary'); await p.waitForTimeout(300);
  ok('термин раскрылся и показывает текст', await p.evaluate(() => { const d = document.querySelector('.gTerm[open]'); return !!d && d.textContent.length > 60; }));
  await shot('4guide_open');
  await p.fill('#gQ', 'ъъъ'); await p.waitForTimeout(200);
  ok('ничего не найдено: сообщение', await p.evaluate(() => !document.querySelector('.gEmpty').hidden));
  await p.click('[data-bookclose]'); await p.waitForTimeout(500);

  /* ---------- 3. «Зачем это нужно»: станция один раз ---------- */
  await p.evaluate(() => { window.__dbg.G.tutorialSeen = window.__MENUAPI.freshSeen(); window.__dbg.G.hints = true; window.__dbg.G.rank = 1; window.__dbg.G.day = 1; });
  await p.click('[data-next]'); await p.waitForTimeout(800);
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 40000 });
  await p.evaluate(() => { const c = window.__dbg.D.customers[0]; c.pat = c.max = 9999; });
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  let m = await modal(); console.log('первое окно:', JSON.stringify(m.slice(0, 80)));
  ok('первый заказ дня: карточка напитка (без «Зачем» на заказе)', /Новый напиток/.test(m));
  await shot('5card');
  await p.click('.dcExactBtn'); await p.waitForTimeout(250);
  ok('«Точные цифры» в карточке раскрываются по кнопке', await p.evaluate(() => { const x = document.querySelector('.dcExact'); return !x.hidden && /\d/.test(x.textContent); }));
  await shot('6card_exact');
  await pw.dismissCard(p);
  await p.click('[data-z=grind]', { force: true }); await p.waitForTimeout(700);
  m = await modal(); console.log('окно станции:', JSON.stringify(m.slice(0, 90)));
  ok('первое открытие кофемолки: «Зачем нужен помол»', /Зачем это нужно/.test(m) && /Зачем нужен помол/.test(m));
  ok('пока окно открыто, терпение гостя и таймер стоят', await (async () => { const a = await p.evaluate(() => [window.__dbg.D.t, window.__dbg.D.customers[0].pat]); await p.waitForTimeout(1200); const c = await p.evaluate(() => [window.__dbg.D.t, window.__dbg.D.customers[0].pat]); return a[0] === c[0] && a[1] === c[1]; })());
  await shot('7why');
  await p.keyboard.press('Space'); await p.waitForTimeout(500);
  ok('Пробел закрывает окно, станция осталась открытой', (await modal()) === '' && await p.evaluate(() => window.__dbg.BR.inset === 'grind'));
  ok('в сохранении отмечено why:grind', await p.evaluate(() => window.__dbg.G.tutorialSeen.includes('why:grind')));
  await p.screenshot({ path: out + '_8coach.png' });
  await p.click('#bClose'); await p.waitForTimeout(400);
  await p.click('[data-z=grind]', { force: true }); await p.waitForTimeout(600);
  ok('второй раз кофемолка без окна', (await modal()) === '');
  await shot('9coach');

  /* ---------- 4. порядок: «Зачем», потом карточка ---------- */
  await p.evaluate(() => { window.__dbg.barAbort(); window.__dbg.D.customers.slice().forEach(window.__dbg.exit); window.__dbg.G.rank = 4; });
  await p.evaluate(() => { const G = window.__dbg.G; G.tutorialSeen = window.__MENUAPI.freshSeen(); });
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 60000 });
  await p.evaluate(() => {
    const M = window.__MENUAPI, G = window.__dbg.G;
    let o; for (let i = 0; i < 20000 && !(o && o.id === 'raf'); i++) o = M.rollOrder({ rank: G.rank, day: G.day, milk: true, eq: { cream: true } }, 'regular');
    const c = window.__dbg.D.customers[0]; c.order = o; c.drink = o.key; c.syrup = o.syrup ? o.syrup.shelf : null; c.pumps = o.syrup ? o.syrup.pumps : 1; c.strong = false; c.pat = c.max = 9999;
  });
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  m = await modal(); console.log('раф, окно 1:', JSON.stringify(m.slice(0, 70)));
  ok('раф: сначала «Зачем» (сливки)', /Зачем это нужно/.test(m) && /Чем раф отличается от латте/.test(m));
  await p.click('[data-cardok]'); await p.waitForTimeout(600);
  m = await modal(); console.log('раф, окно 2:', JSON.stringify(m.slice(0, 70)));
  ok('потом карточка нового напитка (не два окна сразу)', /Новый напиток/.test(m) && !/Зачем это нужно/.test(m));
  await shot('10card_raf');
  await pw.dismissCard(p);
  ok('после окон бар открыт', await p.evaluate(() => !!window.__dbg.BR));

  /* ---------- 5. подсказки выключены: окон нет ---------- */
  await p.evaluate(() => { window.__dbg.barAbort(); window.__dbg.D.customers.slice().forEach(window.__dbg.exit); const G = window.__dbg.G; G.tutorialSeen = window.__MENUAPI.freshSeen(); G.tutOff = true; });
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 60000 });
  await p.evaluate(() => { const c = window.__dbg.D.customers[0]; c.pat = c.max = 9999; });
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  ok('подсказки выключены: ни «Зачем», ни карточки', (await modal()) === '' && await p.evaluate(() => !!window.__dbg.BR));
  await p.click('[data-z=grind]', { force: true }); await p.waitForTimeout(500);
  ok('и на станции окна нет', (await modal()) === '');

  /* ---------- 6. старое сохранение: пачки окон нет ---------- */
  await p.evaluate(() => { window.__dbg.barAbort(); window.__dbg.D.customers.slice().forEach(window.__dbg.exit); const G = window.__dbg.G; G.tutOff = false; G.rank = 4; G.day = 9; G.served = 60; G.milk = true; G.eq_matcha = true; G.eq_ice = true; window.__dbg.saveGame(); });
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('coffee-sim-save-v1')); s.tutorialSeen = ['v2', 'step:milk']; if (!s.up.includes('milk')) s.up.push('milk'); localStorage.setItem('coffee-sim-save-v1', JSON.stringify(s)); });
  await p.goto('about:blank'); await p.goto(url); await p.waitForTimeout(900);
  await p.click('[data-continue]', { timeout: 15000 }); await p.waitForTimeout(900);
  const seen = await p.evaluate(() => window.__dbg.G.tutorialSeen);
  console.log('после переноса:', seen.filter(k => k.startsWith('why:')).join(','));
  ok('старое сохранение: метка v3 и «Зачем» открытого и купленного отмечены', seen.includes('v3') && ['why:grind', 'why:milk', 'why:steam', 'why:matcha', 'why:ice'].every(k => seen.includes(k)));
  ok('чего не покупали, ещё впереди (блендер, шейкер)', !seen.includes('why:blend') && !seen.includes('why:shake'));
  ok('после загрузки нет окон', (await modal()) === '');

  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
