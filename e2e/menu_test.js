const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const id = process.argv[4]; const out = process.argv[3];
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, complete: (...a) => complete(...a), applyUpgrades: () => applyUpgrades(), MENUAPI: window.__MENUAPI };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await require('./pw').page(b);
  const errs = []; require('./pw').watch(p, errs);
  /* песочница: день 60, «Уверенный», всё доступное = ранг 9 и всё оборудование (тест перебирает любые напитки меню) */
  await require('./pw').sandboxStart(p, require('./pw').url(tmp), { day: 60, profile: 'confident' }); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__dbg.G.hints = true; });
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 30000 });
  const info = await p.evaluate(id => {
    const M = window.__dbg.MENUAPI; let o; const eq = Object.fromEntries(M.EQ_IMPL.map(e => [e, true]));
    for (let i = 0; i < 5000 && !(o && o.id === id); i++) o = M.rollOrder({ rank: 9, day: 12, milk: true, eq }, 'regular');
    const c = window.__dbg.D.customers[0]; c.order = o; c.drink = o.key; c.syrup = o.syrup ? o.syrup.shelf : null; c.pumps = o.syrup ? o.syrup.pumps : 1; c.strong = false; c.pat = c.max = 9999;
    return { id: o.id, key: o.key, size: o.size, cold: o.cold, base: o.base, line: o.line };
  }, id);
  console.log('order', JSON.stringify(info));
  await p.keyboard.press('Space'); await p.waitForTimeout(500); await require('./pw').dismissCard(p);
  const tasks = await p.evaluate(() => window.__dbg.BR.tasks.slice()); console.log('tasks', tasks.join(','));
  await p.screenshot({ path: out + '_0.png' });
  const money0 = await p.evaluate(() => window.__dbg.G.money);
  const PANEL = ['whisk', 'brew', 'juice', 'tonic', 'powder', 'boba', 'topping', 'blend', 'shake', 'foam', 'whip', 'layer'];
  let shotN = 0;
  for (const t of tasks) {
    if (!PANEL.includes(t)) {
      /* состояния шагов задаются напрямую (быстрый проход); шоты идут циклами «помол, темпер, шот» по числу шотов заказа */
      await p.evaluate(t => { const B = window.__dbg.BR, rc = B.rc, cp = window.__dbg.complete;
        if (t === 'tamp' || t === 'shot') return;
        if (t === 'grind') { for (let i = 0; i < B.shots; i++) { cp('grind', .9, ''); cp('tamp', .9, ''); B.shot.ml = B.tgtMl; B.cup.es = (i + 1) * 30; cp('shot', .9, ''); } return; }
        if (t === 'water') B.cup.water = rc.water || 0; if (t === 'ice') B.cup.ice = rc.ice || 0; if (t === 'syrup') { B.cup.pumps = 1; B.syrId = B.c.syrup; }
        if (t === 'milk') { B.cup.milk = rc.milk; B.pit.ml = rc.milk; } if (t === 'steam') B.cup.foam = rc.foam || .3;
        cp(t, .9, ''); }, t);
      await p.waitForTimeout(120); continue;
    }
    const zone = await p.evaluate(t => window.__dbg.MENUAPI.TASK_ZONE[t], t);
    await p.click(`[data-z=${zone}]`, { force: true }); await p.waitForTimeout(350);
    const inset = await p.evaluate(() => window.__dbg.BR.inset); if (inset !== t) { console.log('FAIL: inset', inset, 'expected', t, await p.evaluate(() => document.querySelector('.bmsg') && document.querySelector('.bmsg').textContent)); continue; }
    await p.screenshot({ path: out + '_' + (++shotN) + t + '_a.png' });
    if (t === 'brew') {
      const o = await p.evaluate(() => { const s = window.__dbg.BR.xs.brew; return { temp: s.temp, minutes: s.minutes }; });
      await p.click(`[data-xtemp="${o.temp}"]`); await p.click('[data-xstart]'); await p.waitForTimeout(300);
      await p.screenshot({ path: out + '_' + shotN + t + '_b.png' });
      await p.waitForFunction(m => window.__dbg.BR.xs.brew.t >= m, o.minutes, { timeout: 30000, polling: 30 });
      await p.click('[data-xdone]'); 
    } else {
      const target = await p.evaluate(() => { const s = window.__dbg.BR.xs[window.__dbg.BR.inset]; return s.target; });
      const hb = await p.$('[data-xhold]'); const bb = await hb.boundingBox();
      await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
      await p.waitForFunction(() => { const B = window.__dbg.BR, s = B.xs[B.inset]; return (s.ml !== undefined ? s.ml : s.t) >= s.target * (s.ml !== undefined ? 1 : 1) * 0.55; }, null, { timeout: 30000, polling: 30 });
      await p.screenshot({ path: out + '_' + shotN + t + '_b.png' });
      await p.waitForFunction(() => { const B = window.__dbg.BR, s = B.xs[B.inset]; return (s.ml !== undefined ? s.ml : s.t) >= s.target; }, null, { timeout: 30000, polling: 20 });
      await p.mouse.up(); await p.click('[data-xdone]');
    }
    await p.waitForTimeout(250);
    console.log(t, 'res', await p.evaluate(t => window.__dbg.BR && window.__dbg.BR.res[t], t));
  }
  await p.screenshot({ path: out + '_9ready.png' });
  console.log('ready', await p.evaluate(() => window.__dbg.BR && window.__dbg.BR.ready));
  await p.click('[data-z=bell]', { force: true }); await p.waitForTimeout(900);
  console.log('money', money0, '->', await p.evaluate(() => window.__dbg.G.money), 'served', await p.evaluate(() => window.__dbg.D.stats.served));
  console.log(errs.length ? 'ERRORS ' + JSON.stringify(errs) : 'NO_ERRORS');
  await b.close();
})();
