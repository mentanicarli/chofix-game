/* Закрытие кафе: до 18:00 двери открыты, после — новых гостей нет, очередь дообслуживается; страховка CLOSING_LIMIT завершает день без штрафа.
   Время сдвигаем через __dbg.tickDay / D.t, выдачу напитка имитируем deliver + barAbort (как после звонка), всё остальное — настоящий код игры.
   node e2e/closing_flow.js dist/artifact.html   (собрать: CUPPABLE_DEBUG=1 npx vite build && CUPPABLE_DEBUG=1 node scripts/fragment.mjs) */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const pw = require('./pw');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, tickDay, spawn, deliver, barAbort, barOpen, MENUAPI: window.__MENUAPI };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await pw.page(b); const errs = []; pw.watch(p, errs);
  const url = pw.url(tmp);
  const DAY_LEN = 300, LIMIT = 240;
  /* свежий день песочницы: естественные приходы выключены (nextArr огромный), время — в наших руках */
  const fresh = async () => {
    await pw.sandboxStart(p, url, { day: 3 });
    await p.waitForFunction(() => window.__dbg && window.__dbg.G.phase === 'day' && window.__dbg.D, null, { timeout: 60000 });
    await p.evaluate(() => { const d = __dbg; d.D.nextArr = 1e9; });
  };
  /* имитация конца заказа: гость получает напиток */
  const serveFirst = () => p.evaluate(() => { const d = __dbg, c = d.D.customers.find(x => !x.leaving); d.barAbort(); d.deliver(c, c.drink, 2, true, true); return d.D.customers.length; });
  const open = async () => {
    await p.evaluate(() => __dbg.barOpen(__dbg.D.customers.find(x => !x.leaving)));
    await p.waitForTimeout(300); if (await pw.dismissCard(p)) await p.evaluate(() => __dbg.barOpen(__dbg.D.customers.find(x => !x.leaving)));
  };

  /* а) три гостя в очереди, за DAY_LEN: бар не обрывается, новых нет, lost 0, рейтинг тот же, после подачи всех день заканчивается */
  await fresh();
  await p.evaluate(() => { const d = __dbg; for (let i = 0; i < 3; i++) d.spawn(); d.D.customers.forEach(c => { c.arrived = true; c.pat = c.max; }); d.D.t = 301; d.D.nextArr = 0; });
  const r0 = await p.evaluate(() => __dbg.G.rating);
  await open();
  ok(await p.evaluate(() => !!__dbg.BR), 'а) заказ первого гостя готовится');
  await p.evaluate(() => { const d = __dbg; for (let i = 0; i < 40; i++) d.tickDay(0.5); });
  const a1 = await p.evaluate(() => { const d = __dbg; return { closing: d.D.closing, n: d.D.customers.length, br: !!d.BR, lost: d.D.stats.lost, r: d.G.rating, phase: d.G.phase }; });
  ok(a1.closing && a1.n === 3 && a1.br && a1.lost === 0 && a1.r === r0 && a1.phase === 'day', 'а) 20 с после закрытия: очередь 3, гость в баре на месте, lost 0, рейтинг тот же (' + JSON.stringify(a1) + ')');
  const n1 = await serveFirst();
  await p.evaluate(() => { const d = __dbg; for (let i = 0; i < 6; i++) d.tickDay(0.5); });
  ok(await p.evaluate(() => __dbg.D.customers.filter(c => !c.leaving).length) === 2, 'а) после подачи первого новых гостей нет (место свободно, nextArr = 0)');
  for (let k = 0; k < 2; k++) { await open(); await serveFirst(); await p.evaluate(() => __dbg.tickDay(0.5)); }
  await p.waitForFunction(() => __dbg.G.phase !== 'day', null, { timeout: 30000 });
  const a2 = await p.evaluate(() => ({ lost: __dbg.D.stats.lost, served: __dbg.D.stats.served, r: __dbg.G.rating, phase: __dbg.G.phase }));
  ok(a2.phase === 'evening' && a2.served === 3 && a2.lost === 0 && a2.r >= r0, 'а) подали всех — день закончился: ' + JSON.stringify(a2));

  /* б) за 1 с до DAY_LEN гость приходит и встаёт в очередь; после DAY_LEN новых нет */
  await fresh();
  await p.evaluate(() => { const d = __dbg; d.D.t = 299; d.D.nextArr = 0.05; d.tickDay(0.1); });
  const b1 = await p.evaluate(() => ({ n: __dbg.D.customers.length, closing: __dbg.D.closing }));
  ok(b1.n === 1 && !b1.closing, 'б) 299 с: гость пришёл в очередь');
  await p.evaluate(() => { const d = __dbg; d.D.customers.forEach(c => { c.arrived = true; c.pat = c.max; }); d.tickDay(1.2); });
  const b2 = await p.evaluate(() => ({ n: __dbg.D.customers.length, closing: __dbg.D.closing, lost: __dbg.D.stats.lost }));
  ok(b2.closing && b2.n === 1 && b2.lost === 0, 'б) 18:00: пришедший остался в очереди, не потерян');
  await p.evaluate(() => { const d = __dbg; d.D.nextArr = 0; for (let i = 0; i < 20; i++) d.tickDay(0.5); });
  ok(await p.evaluate(() => __dbg.D.customers.length) === 1 && await p.evaluate(() => __dbg.D.idc) === 1, 'б) после 18:00 новых гостей нет');
  await serveFirst();
  await p.waitForFunction(() => __dbg.G.phase !== 'day', null, { timeout: 30000 });
  ok(true, 'б) очередь пуста — день закончился');

  /* в) бесконечное терпение, ничего не делаем: через CLOSING_LIMIT день заканчивается сам, без штрафа; заказ в баре возвращён один раз */
  await fresh();
  await p.evaluate(() => { const d = __dbg; for (let i = 0; i < 2; i++) d.spawn(); d.D.customers.forEach(c => { c.arrived = true; c.max = 1e12; c.pat = 1e12; }); d.D.t = 300.1; });
  const r2 = await p.evaluate(() => __dbg.G.rating);
  await open();
  ok(await p.evaluate(() => !!__dbg.BR && __dbg.D.stats.costs > 0), 'в) заказ открыт, расходы списаны');
  const ticks = await p.evaluate((L) => { const d = __dbg; let n = 0; while (d.G.phase === 'day' && n < 1000) { d.tickDay(1); n++; } return { n, closeT: d.D.closeT, L }; }, LIMIT);
  ok(ticks.n >= LIMIT && ticks.n <= LIMIT + 3, 'в) день закончился сам через ' + ticks.n + ' с после закрытия (лимит ' + LIMIT + ')');
  const c1 = await p.evaluate(() => { const d = __dbg; return { phase: d.G.phase, lost: d.D.stats.lost, r: d.G.rating, costs: d.D.stats.costs, br: !!d.BR }; });
  ok(c1.phase === 'evening' && c1.lost === 0 && c1.r === r2 && c1.costs === 0 && !c1.br, 'в) без штрафа: lost 0, рейтинг тот же, расход за бросенный заказ возвращён ровно один раз: ' + JSON.stringify(c1));

  ok(!errs.length, errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
