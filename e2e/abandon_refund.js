/* Возврат расходов, если гость ушёл посреди заказа: деньги и D.stats.costs возвращаются к значениям до открытия бара.
   Контроль: осознанная трата (сброс дозы, spend(5)) не возвращается.
   node e2e/abandon_refund.js dist/artifact.html   (собрать: CHOFIX_DEBUG=1 npx vite build && CHOFIX_DEBUG=1 node scripts/fragment.mjs) */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, barOpen, lose, spend, helperTick, applyUpgrades };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const pw = require('./pw'), p = await pw.page(b); const errs = []; pw.watch(p, errs);
  await p.goto(pw.url(tmp) + '#nopixi-lowfx'); await pw.startNew(p);
  await p.waitForFunction(() => { const d = window.__dbg; return d && d.G && d.G.phase === 'day' && d.D.customers[0] && d.D.customers[0].arrived; }, null, { timeout: 60000 });
  const s0 = await p.evaluate(() => ({ m: __dbg.G.money, c: __dbg.D.stats.costs }));
  await p.evaluate(() => __dbg.barOpen(__dbg.D.customers[0]));
  await p.waitForTimeout(300); if (await pw.dismissCard(p)) await p.evaluate(() => __dbg.barOpen(__dbg.D.customers[0]));
  const s1 = await p.evaluate(() => ({ m: __dbg.G.money, c: __dbg.D.stats.costs, paid: __dbg.BR && __dbg.BR.paid }));
  ok(s1.paid > 0 && s1.m === s0.m - s1.paid && s1.c === s0.c + s1.paid, 'бар открыт: списано ' + s1.paid);
  await p.evaluate(() => __dbg.spend(5)); /* сброс дозы: осознанная трата */
  await p.evaluate(() => __dbg.lose(__dbg.D.customers[0]));
  const s2 = await p.evaluate(() => ({ m: __dbg.G.money, c: __dbg.D.stats.costs, br: !!__dbg.BR }));
  ok(!s2.br && s2.m === s0.m - 5 && s2.c === s0.c + 5, 'гость ушёл: возвращено всё, кроме сброса дозы (деньги ' + s2.m + ', расходы ' + s2.c + ')');

  /* помощник берёт только простое без сиропа и еды; первым в очереди делаем гостя с простым заказом и наименьшим терпением */
  await p.evaluate(() => { window.simple = () => { const d = __dbg, c = d.D.customers[0]; c.drink = 'espresso'; if (c.order) { c.order.id = 'espresso'; c.order.food = null; c.order.syrup = null; } c.syrup = false; c.pat = c.max * .9; }; });
  /* Помощник: расход списан один раз; игрок перехватил гостя — расход помощника возвращён, платит только игрок */
  await p.evaluate(() => { const d = __dbg; d.G.rank = 5; d.G.helper = true; d.G.money = 3000; d.applyUpgrades(); });
  await p.waitForFunction(() => { const d = __dbg; return d.D.customers[0] && d.D.customers[0].arrived && !d.BR; }, null, { timeout: 60000 });
  const h0 = await p.evaluate(() => { const d = __dbg; d.D.customers.forEach(c => { c.pat = c.max; }); simple(); return { m: d.G.money, c: d.D.stats.costs }; });
  const h1 = await p.evaluate(() => { const d = __dbg; d.helperTick(0.01); const H = d.D.helper; return { m: d.G.money, c: d.D.stats.costs, id: H && H.c && H.c.id, paid: H && H.paid }; });
  ok(h1.id != null && h1.paid > 0 && h1.m === h0.m - h1.paid && h1.c === h0.c + h1.paid, 'помощник начал заказ: списано ' + h1.paid);
  await p.evaluate(() => { window.hc = __dbg.D.helper.c; __dbg.barOpen(window.hc); });
  await p.waitForTimeout(300); if (await pw.dismissCard(p)) await p.evaluate(() => { __dbg.barOpen(window.hc); });
  const own = await p.evaluate(() => { const d = __dbg; const own = d.BR && d.BR.paid; d.helperTick(0.01); return { own, m: d.G.money, c: d.D.stats.costs, hc: d.D.helper.c, hp: d.D.helper.paid }; });
  ok(own.own > 0 && own.hc === null && own.hp === 0 && own.m === h0.m - own.own && own.c === h0.c + own.own, 'игрок перехватил: учтён один напиток (' + own.own + '), деньги ' + own.m);
  await p.evaluate(() => { const d = __dbg; d.helperTick(0.01); });
  ok(await p.evaluate(([m, c]) => __dbg.G.money === m && __dbg.D.stats.costs === c, [own.m, own.c]), 'повторный тик ничего не возвращает второй раз');
  /* Контроль: помощник сам доготовил и выдал — расход один и не возвращён */
  await p.evaluate(() => { const d = __dbg; d.lose(d.D.customers.find(c => d.BR && d.BR.c === c)); });
  await p.waitForFunction(() => { const d = __dbg; return d.D.customers.some(c => c.arrived && !c.leaving) && !d.BR; }, null, { timeout: 60000 });
  const k0 = await p.evaluate(() => { const d = __dbg; d.D.customers.forEach(c => { c.pat = c.max; }); simple(); const c0 = d.D.stats.costs; d.helperTick(0.01); const H = d.D.helper; return { c0, paid: H.paid, started: !!H.c }; });
  const k1 = await p.evaluate(() => { const d = __dbg; const s0 = d.D.stats.served; d.helperTick(100); return { served: d.D.stats.served - s0, costs: d.D.stats.costs, paid: d.D.helper.paid }; });
  ok(k0.started && k1.served === 1 && k1.costs === k0.c0 + k0.paid && k1.paid === 0, 'помощник выдал сам: расход ' + k0.paid + ' списан один раз и не возвращён');
  ok(!errs.length, errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
