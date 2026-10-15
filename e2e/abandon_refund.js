/* Возврат расходов, если гость ушёл посреди заказа: деньги и D.stats.costs возвращаются к значениям до открытия бара.
   Контроль: осознанная трата (сброс дозы, spend(5)) не возвращается.
   node e2e/abandon_refund.js dist/artifact.html   (собрать: CHOFIX_DEBUG=1 npx vite build && CHOFIX_DEBUG=1 node scripts/fragment.mjs) */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, barOpen, lose, spend };');
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
  ok(!errs.length, errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close(); process.exit(fails ? 1 : 0);
})();
