/* Подсказки новой станции на примере матчи: покупка → плашка «Новое» → заказ → коуч по шагам → повторный заказ без коуча.
   Запуск (отладочная сборка): BASE=http://localhost:4173 HASH='#nopixi-lowfx' node e2e/tutorial_flow.js dist/artifact.html out/tut */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const out = process.argv[3] || 'out/tut';
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, endDay, barAbort, SET };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await require('./pw').page(b);
  const errs = []; require('./pw').watch(p, errs);
  const ok = (name, v) => { console.log((v ? 'OK   ' : 'FAIL ') + name); if (!v) errs.push('FAIL ' + name); };
  const coach = () => p.evaluate(() => { const e = document.querySelector('#bCoach'); return e.hidden ? '' : e.textContent; });
  await p.goto(require('./pw').url(tmp) + (process.env.HASH || '#nopixi-lowfx')); await p.waitForTimeout(600);
  await require('./pw').startNew(p); await p.waitForTimeout(500);
  await p.evaluate(() => { const G = window.__dbg.G; G.rank = 4; G.day = 7; G.money = 5000; G.milk = true; G.hints = true; });
  await p.evaluate(() => window.__dbg.endDay()); await p.waitForSelector('.evening', { timeout: 15000 }); await p.waitForTimeout(1500);
  await p.click('[data-tab=gear]'); await p.waitForTimeout(500);
  await p.click('[data-buy=eq_matcha]'); await p.waitForTimeout(700);
  const note = await p.textContent('.note.newEq').catch(() => '');
  console.log('плашка:', JSON.stringify(note));
  ok('после покупки: «Новое: …. Попробуйте на заказе: …»', /^Новое: .+\. Попробуйте на заказе: .+/.test(note.trim()));
  ok('покупка попала в сохранение', await p.evaluate(() => JSON.parse(localStorage.getItem('coffee-sim-save-v1')).up.includes('eq_matcha')));
  await p.screenshot({ path: out + '_1buy.png' });
  await p.click('[data-next]'); await p.waitForTimeout(800);
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 40000 });
  const order = () => p.evaluate(() => {
    const M = window.__MENUAPI, G = window.__dbg.G, eq = { matcha: true };
    const ids = M.DRINKS.filter(d => d.steps.some(s => s.st === 'whisk') && d.rank <= G.rank).map(d => d.id);
    let o; for (let i = 0; i < 8000 && !(o && ids.includes(o.id)); i++) o = M.rollOrder({ rank: G.rank, day: G.day, milk: true, eq: { ...eq } }, 'regular');
    const c = window.__dbg.D.customers[0]; c.order = o; c.drink = o.key; c.syrup = o.syrup ? o.syrup.shelf : null; c.pumps = o.syrup ? o.syrup.pumps : 1; c.strong = false; c.pat = c.max = 9999;
    return { id: o.id, tasks: null };
  });
  console.log('заказ 1:', JSON.stringify(await order()));
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  console.log('задачи:', await p.evaluate(() => window.__dbg.BR.tasks.join(',')));
  let t1 = await coach(); console.log('коуч до открытия станции:', JSON.stringify(t1));
  await p.screenshot({ path: out + '_2coach_closed.png' });
  /* шаги до матчи (если есть) выполняем быстро: отмечаем готовыми */
  await p.evaluate(() => { const B = window.__dbg.BR; for (const t of B.tasks) { if (t === 'whisk') break; B.done[t] = true; B.res[t] = 1; } });
  await p.waitForTimeout(400);
  t1 = await coach();
  ok('коуч называет станцию и где она', t1.includes('Новая станция') && /матч/i.test(t1));
  await p.click('[data-z=matcha]', { force: true }); await p.waitForTimeout(700);
  const t2 = await coach(); console.log('коуч в станции:', JSON.stringify(t2));
  ok('в станции коуч ведёт по шагам (1. и 2.)', t2.includes('1.') && t2.includes('2.') && t2.includes('Взбивать'));
  await p.screenshot({ path: out + '_3coach_open.png' });
  const box = await p.locator('[data-xhold]').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
  await p.waitForFunction(() => { const s = window.__dbg.BR.xs.whisk; return s.t >= s.target - 0.05; }, null, { timeout: 20000, polling: 30 });
  await p.mouse.up(); await p.click('[data-xdone]'); await p.waitForTimeout(600);
  ok('станция пройдена: matcha отмечена как пройденная', await p.evaluate(() => window.__dbg.G.tutorialSeen.includes('matcha')));
  /* второй заказ той же станции: коуча «Новая станция» быть не должно */
  await p.evaluate(() => window.__dbg.barAbort()); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__dbg.G.hints = true; });
  console.log('заказ 2:', JSON.stringify(await order()));
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  await p.evaluate(() => { const B = window.__dbg.BR; for (const t of B.tasks) { if (t === 'whisk') break; B.done[t] = true; B.res[t] = 1; } });
  await p.click('[data-z=matcha]', { force: true }); await p.waitForTimeout(700);
  const t3 = await coach(); console.log('коуч при повторе:', JSON.stringify(t3));
  ok('повторный заказ: коуч есть (подсказки включены), но без «Новая станция»', t3.length > 0 && !t3.includes('Новая станция') && !t3.includes('1. '));
  await p.screenshot({ path: out + '_4repeat.png' });
  /* сохранение и перезапуск */
  await p.evaluate(() => window.__dbg.barAbort()); await p.waitForTimeout(300);
  /* выключенные подсказки: на новой станции коуча нет */
  await p.evaluate(() => { const G = window.__dbg.G; G.tutorialSeen = []; window.__dbg.SET.hintsSet = true; window.__dbg.SET.hints = false; G.hints = false; });
  console.log('заказ 3:', JSON.stringify(await order()));
  await p.keyboard.press('Space'); await p.waitForTimeout(900);
  ok('подсказки выключены в настройках: коуча нет', (await coach()) === '');
  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
