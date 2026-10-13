const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const drink = process.argv[4] || 'espresso';
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, endDay, barOpen };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const out = process.argv[3];
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await require('./pw').page(b);
  const errs = []; require('./pw').watch(p, errs);
  await p.addInitScript(() => { let a = 1234567; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; /* mulberry32: детерминированный прогон */ });
  await p.goto(require('./pw').url(tmp) + (process.env.HASH || '')); await p.waitForTimeout(600);
  await require('./pw').startNew(p); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__dbg.G.milk = true; window.__dbg.G.eq_ice = true; window.__dbg.G.day = 2; });
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 30000 });
  await p.evaluate(d => { window.__dbg.G.rank = 3; const c = window.__dbg.D.customers[0]; c.drink = d; c.strong = false; c.syrup = (d === 'cappuccino' || d === 'vanillaraf') ? 'vanilla' : null; c.pumps = 2; c.pat = c.max = 999; }, drink);
  const st = () => p.evaluate(() => { const B = window.__dbg.BR; return B ? { inset: B.inset, dose: +B.dose.toFixed(1), un: +B.uneven.toFixed(2), tp: B.tampPhase, P: +B.tampP.toFixed(1), shot: B.shot.st, ml: +B.shot.ml.toFixed(1), t: +B.shot.t.toFixed(1), done: Object.keys(B.done).join(','), ready: B.ready, res: JSON.stringify(B.res), pit: JSON.stringify(B.pit), lvl: B.pourLevel } : null; });
  const ic = async (x, y) => { const r = await p.evaluate(() => { const r = document.querySelector('#bi').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); return [r[0] + x * r[2] / 440, r[1] + y * r[3] / 450]; };
  const zone = z => p.click(`[data-z=${z}]`, { force: true });
  const waitFor = (fn, arg, to = 20000) => p.waitForFunction(fn, arg, { timeout: to, polling: 30 });
  await p.keyboard.press('Space'); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '_0bar.png' });
  const syrup = drink === 'cappuccino' || drink === 'vanillaraf';
  if (syrup) { await zone('syr1'); await p.waitForTimeout(300); let [sx, sy] = await ic(82, 112); await p.mouse.click(sx, sy); await p.waitForTimeout(200); await p.mouse.click(sx, sy); await p.waitForTimeout(300); await p.screenshot({ path: out + '_1syrup.png' }); [sx, sy] = await ic(357, 408); await p.mouse.click(sx, sy); await p.waitForTimeout(300); console.log('syrup', await st()); }
  /* помол */
  await zone('grind'); await p.waitForTimeout(300);
  let [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down();
  await p.screenshot({ path: out + '_2grind.png' });
  await waitFor(() => window.__dbg.BR.dose >= 17.7); await p.mouse.up();
  await p.screenshot({ path: out + '_2grind2.png' });
  console.log('grind', await st());
  [x, y] = await ic(353, 384); await p.mouse.click(x, y); await p.waitForTimeout(200);
  console.log('after grind', await st());
  /* темпер */
  await zone('tamp'); await p.waitForTimeout(300);
  [x, y] = await ic(220, 190); await p.mouse.move(x, y); await p.mouse.down();
  for (let i = 0; i < 80 && (await st()).tp === 'level'; i++) { const a = i / 4; await p.mouse.move(x + Math.cos(a) * 70, y + Math.sin(a) * 70, { steps: 3 }); }
  await p.screenshot({ path: out + '_3tamp.png' }); await p.mouse.up();
  console.log('tamp lvl', await st());
  [x, y] = await ic(210, 384); await p.mouse.move(x, y); await p.mouse.down();
  await waitFor(() => window.__dbg.BR.tampP >= 14.6); await p.screenshot({ path: out + '_3tamp2.png' }); await p.mouse.up(); await p.waitForTimeout(250);
  console.log('after tamp', await st());
  /* шот */
  await zone('shot'); await p.waitForTimeout(250);
  [x, y] = await ic(220, 384); await p.mouse.click(x, y); await p.waitForTimeout(150); await p.mouse.click(x, y);
  await p.waitForTimeout(2500); await p.screenshot({ path: out + '_4shot.png' });
  await waitFor(() => window.__dbg.BR.shot.ml >= window.__dbg.BR.tgtMl - .8 || window.__dbg.BR.shot.st !== 'run', null, 30000);
  await zone('stop'); await p.waitForTimeout(300);
  console.log('after shot', await st());
  await p.screenshot({ path: out + '_5aftershot.png' });
  if (/^iced/.test(drink)) {
    await zone('ice'); await p.waitForTimeout(250); await p.screenshot({ path: out + '_5ice0.png' });
    [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down();
    await waitFor(() => window.__dbg.BR.cup.ice >= 99); await p.mouse.up(); await p.screenshot({ path: out + '_5ice.png' });
    [x, y] = await ic(353, 384); await p.mouse.click(x, y); await p.waitForTimeout(250);
    console.log('after ice', await st());
    const milkT = drink === 'icedlatte' ? 149 : 129;
    if (drink === 'icedamericano') { await zone('water'); await p.waitForTimeout(200); [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down();
    await waitFor(() => { const B = window.__dbg.BR; return B.cup.es + B.cup.water >= 128; }); await p.mouse.up(); await p.screenshot({ path: out + '_6water.png' }); }
    else { await zone('milk'); await p.waitForTimeout(200); [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down();
    await waitFor(t => window.__dbg.BR.cup.milk >= t, milkT); await p.mouse.up(); await p.screenshot({ path: out + '_6milk.png' }); }
    [x, y] = await ic(353, 384); await p.mouse.click(x, y); await p.waitForTimeout(200);
  }
  if (drink === 'americano') {
    await zone('water'); await p.waitForTimeout(200); [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down();
    await waitFor(() => { const B = window.__dbg.BR; return B.cup.es + B.cup.water >= 148; }); await p.mouse.up(); await p.screenshot({ path: out + '_6water.png' });
    [x, y] = await ic(353, 384); await p.mouse.click(x, y); await p.waitForTimeout(200);
  }
  if (['cappuccino', 'latte', 'flatwhite', 'raf', 'vanillaraf', 'rafhalva'].includes(drink)) {
    await zone('milk'); await p.waitForTimeout(200); [x, y] = await ic(155, 384); await p.mouse.move(x, y); await p.mouse.down();
    await waitFor(() => window.__dbg.BR.pit.ml >= (window.__dbg.BR.drink === 'latte' ? 199 : window.__dbg.BR.drink === 'flatwhite' ? 129 : /raf/.test(window.__dbg.BR.drink) ? 189 : 139)); await p.mouse.up(); await p.screenshot({ path: out + '_6milk.png' });
    [x, y] = await ic(353, 384); await p.mouse.click(x, y); await p.waitForTimeout(200);
    await zone('steam'); await p.waitForTimeout(200);
    [x, y] = await ic(150, 200); await p.mouse.move(x, y); await p.mouse.down();
    /* держим трубку у поверхности, пока температура ~ 36, потом глубже */
    for (let i = 0; i < 400; i++) { const pit = JSON.parse((await st()).pit); const surf = 330 - (pit.ml * (1 + .6 * pit.foam) / 330) * 220; const [mx, my] = await ic(150, pit.T < 38 ? surf + 6 : surf + 40); await p.mouse.move(mx, my); if (pit.T >= 60) break; await p.waitForTimeout(40); }
    await p.screenshot({ path: out + '_7steam.png' }); await p.mouse.up();
    console.log('steam', await st());
    [x, y] = await ic(353, 410); await p.mouse.click(x, y); await p.waitForTimeout(250);
    console.log('after steam', await st());
    await zone('pour'); await p.waitForTimeout(250);
    const guide = await p.evaluate(() => { const g = []; const c = window.__dbg.BR.c.art; const N = 40; for (let k = 0; k <= N; k++) { if (c === 'heart') { const t = Math.PI + k / N * Math.PI * 2, s = 4.6; g.push([220 + 16 * Math.pow(Math.sin(t), 3) * s, 205 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s * .95 + 8]); } else { const u = k / N; g.push([220 + 36 * Math.sin(u * Math.PI * 5) * (1 - u * .4), 305 - 200 * u]); } } return g; });
    let [gx, gy] = await ic(guide[0][0], guide[0][1]); await p.mouse.move(gx, gy); await p.mouse.down();
    for (let r = 0; r < 6; r++) for (const q of guide) { const [qx, qy] = await ic(q[0], q[1]); await p.mouse.move(qx, qy, { steps: 2 }); if (!(await st()) || (await st()).inset !== 'pour') break; await p.waitForTimeout(18); if (r === 0 && q === guide[20]) await p.screenshot({ path: out + '_8pour.png' }); }
    await p.mouse.up(); await p.waitForTimeout(300);
    console.log('after pour', await st());
  }
  await p.screenshot({ path: out + '_9ready.png' });
  const served0 = await p.evaluate(() => window.__dbg.D.stats.served);
  await zone('bell'); await p.waitForTimeout(1200);
  await (async()=>{const t=Date.now(); await p.screenshot({ path: out + '_10served.png', timeout: 120000 }); console.log('SHOT10 ms', Date.now()-t);})();
  console.log('served', served0, '->', await p.evaluate(() => window.__dbg.D.stats.served), 'money', await p.evaluate(() => window.__dbg.G.money));
  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS'); await b.close();
})();
