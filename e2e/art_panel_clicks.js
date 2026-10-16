/* Регрессия кликов по кнопкам панелей станций (замечание №6 «кнопки обрезаны и работают через раз»). Инструмент аудита.
   Настоящая мышь с паузой 150–400 мс между нажатием и отпусканием, по 30 попыток на кнопку (для разовых «Залить», «Вынуть», «Готово» — по 30 новых открытий).
   Считаем: pointerdown на кнопке, click, дошедший до кнопки (document, capture), эффект в игре, обрезку и перекрытие нижнего края.
   node e2e/art_panel_clicks.js dist/artifact.html out/art-audit/sys   (ОТЛАДОЧНАЯ сборка). Ожидаемо: 100 % попаданий, обрезки 0.
   Переменные: N=30 число попыток, SIZES=1280x720,1024x600 размеры окна. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'out/art-audit/sys'); fs.mkdirSync(out, { recursive: true });
const N = +(process.env.N || 30);
const SIZES = (process.env.SIZES || '1280x720,1024x600,1920x1080').split(',').map(s => s.split('x').map(Number));
const PANELS = [['tea_sencha', 'brew'], ['matcha_latte', 'whisk'], ['cocoa', 'powder'], ['espresso_tonic', 'tonic'], ['orange_bumble', 'juice'], ['milkshake_vanilla', 'blend'], ['boba_guava', 'brew'], ['latte_coconut', 'foam'], ['aerocano', 'whip'], ['protein_milk', 'powder'], ['frappe_caramel', 'blend']];
const rnd = (a, b) => a + Math.random() * (b - a);
/* Долгий прогон в одной странице иногда падает целиком («Target crashed» после ошибки звукового устройства, см. CLAUDE.md): память и состояние копятся. Поэтому без ONLY каждая панель идёт в своём процессе со свежим браузером, один повтор при падении процесса; ожидания (100 % попаданий, обрезки 0) не менялись. */
if (!process.env.ONLY && !process.env.ART_PC_CHILD) {
  let bad = 0;
  for (const [id] of PANELS) {
    let r; for (let k = 0; k < 2; k++) { r = require('child_process').spawnSync(process.execPath, [__filename, process.argv[2], process.argv[3] || 'out/art-audit/sys', ...process.argv.slice(4)], { stdio: 'inherit', env: { ...process.env, ONLY: id, ART_PC_CHILD: '1' } }); if (!r.status) break; console.log('панель ' + id + ': процесс упал, повтор ' + (k + 1)); }
    if (r.status) bad++;
  }
  process.exit(bad ? 1 : 0);
}
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, spawn, barOpen, zoneClick, applyUpgrades, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ args: (process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean), ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const rows = []; let fail = 0;
  for (const [w, h] of SIZES) {
    const p = await PW.page(b, { width: w, height: h });
    /* диагностика падений (PROBE=1): где упала страница, ошибки, память JS по шагам */
    let step = 'старт';
    p.on('crash', () => console.log('CRASH страница упала на шаге:', step));
    p.on('pageerror', e => console.log('PAGEERROR', step, e.message));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), step, m.text().slice(0, 160)); });
    const cdp = await p.context().newCDPSession(p); await cdp.send('Performance.enable');
    const mem = async () => { try { const { metrics } = await cdp.send('Performance.getMetrics'); const g = n => (metrics.find(x => x.name === n) || {}).value || 0; return 'heap=' + (g('JSHeapUsedSize') / 1e6).toFixed(0) + 'MB nodes=' + g('Nodes') + ' listeners=' + g('JSEventListeners'); } catch (e) { return 'mem?'; } };
    await p.goto('about:blank'); await p.goto(PW.url(tmp) + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400);
    await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 });
    await p.evaluate(() => { const d = __dbg; ['tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker'].forEach(k => { d.G['eq_' + k] = true; }); d.G.ice = true; d.G.eq_ice = true; d.G.milk = true; d.G.tutOff = true; d.applyUpgrades(); d.D.nextArr = 1e9; d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; }); });
    await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
    await p.evaluate(() => {
      window.__cnt = {}; const sel = '[data-xtemp],[data-xstart],[data-xdone],[data-xhold],[data-xdump]';
      const key = e => { const b = e.target.closest && e.target.closest(sel); return b && Object.keys(b.dataset).find(k => k.startsWith('x')) + (b.dataset.xtemp ? ':' + b.dataset.xtemp : ''); };
      document.addEventListener('pointerdown', e => { const k = key(e); if (k) { (__cnt[k] = __cnt[k] || { down: 0, click: 0 }).down++; window.__lastDown = k; } }, true);
      document.addEventListener('click', e => { const k = key(e); if (k) (__cnt[k] = __cnt[k] || { down: 0, click: 0 }).click++; }, true);
    });
    const open = async (id, task) => {
      /* прогон идёт десятки минут: не даём игровому дню закончиться (иначе бар закрывается и BR становится null) */
      await p.evaluate(() => { if (__dbg.D) __dbg.D.t = Math.min(__dbg.D.t, 60); });
      await p.evaluate(() => __dbg.resetBar()); await p.waitForTimeout(150);
      await p.evaluate(({ id }) => { const M = window.__MENUAPI, c = __dbg.D.customers[0], dk = M.drinkById[id]; c.drink = id; c.order.key = id; c.order.id = id; c.order.name = dk.name; c.order.size = '0.6'; c.order.cold = /bumble|tonic|shake|boba|frappe|aero|protein/.test(id); c.order.food = null; c.syrup = null; c.pumps = 0; c.strong = false; c.pat = c.max = 1e9; __dbg.barOpen(c); }, { id }); /* без сиропа: иначе шаг «Сироп» блокирует открытие станции */
      await p.waitForTimeout(450); await PW.dismissCard(p);
      await p.evaluate(task => { const B = __dbg.BR; for (const t of B.tasks) { if (t === task) break; B.done[t] = true; B.res[t] = 1; } }, task); /* предыдущие шаги выполнены */
      await p.evaluate(t => __dbg.zoneClick(t), task); await p.waitForTimeout(450);
    };
    const press = async (sel, holdMs) => {
      const r = await p.evaluate(sel => { const e = document.querySelector(sel); if (!e || e.disabled) return null; const r = e.getBoundingClientRect(); const pr = document.querySelector('#xPanel').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * .8, bottom: r.bottom, pb: pr.bottom }; }, sel);
      if (!r) return null; await p.mouse.move(r.x, r.y); await p.mouse.down(); await p.waitForTimeout(holdMs); await p.mouse.up(); await p.waitForTimeout(60); return r;
    };
    for (const [id, task] of PANELS.filter(x => !process.env.ONLY || process.env.ONLY.split(',').includes(x[0]))) {
      step = id + '/open'; if (process.env.PROBE) console.log('->', id, await mem());
      await open(id, task);
      const btns = await p.evaluate(() => [...document.querySelectorAll('#xPanel button')].map(b => ({ cls: b.className, txt: b.textContent.trim(), key: Object.keys(b.dataset).find(k => k.startsWith('x')) + (b.dataset.xtemp ? ':' + b.dataset.xtemp : '') })));
      const fit = await p.evaluate(() => { const x = document.querySelector('#xPanel .xp'), pn = document.querySelector('#xPanel'); const clipped = [...document.querySelectorAll('#xPanel button')].filter(b => b.getBoundingClientRect().bottom > pn.getBoundingClientRect().bottom + 1).length; return { overflow: x ? x.scrollHeight - x.clientHeight : null, clippedButtons: clipped }; });
      for (const bt of btns) {
        const sel = bt.key.startsWith('xtemp') ? `[data-xtemp="${bt.key.split(':')[1]}"]` : `[data-${bt.key.slice(0, 1) + bt.key.slice(1).replace(/([A-Z])/g, '-$1').toLowerCase()}]`;
        await p.evaluate(() => { window.__cnt = {}; });
        let ok = 0, tries = 0;
        const oneShot = bt.key === 'xstart' || bt.key === 'xdone';
        const n = oneShot ? Math.min(N, +(process.env.N_ONESHOT || N)) : N;
        for (let i = 0; i < n; i++) {
          tries++; step = id + '/' + bt.key + '/' + i; if (process.env.PROBE && i % 5 === 0) console.log('   ', step, await mem());
          if (oneShot) {
            await open(id, task);
            if (task === 'brew') { await press('[data-xtemp="80"]', 80); }
            if (bt.key === 'xdone' && id.includes('tea') || bt.key === 'xdone' && task === 'brew') { await press('[data-xstart]', 80); await p.waitForTimeout(rnd(300, 900)); }
            if (bt.key === 'xdone' && task !== 'brew') { await p.mouse.move(0, 0); const r0 = await p.evaluate(() => { const e = document.querySelector('[data-xhold]').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; }); await p.mouse.move(r0[0], r0[1]); await p.mouse.down(); /* держим, пока не наберётся цель станции, иначе «Готово» честно откажет */ await p.waitForFunction(task => { const st = __dbg.BR.xs[task]; return !st || ('ml' in st ? st.ml >= st.target : st.t >= st.target); }, task, { timeout: 25000, polling: 30 }).catch(() => {}); await p.mouse.up(); }
          }
          const before = await p.evaluate(({ task }) => { const B = __dbg.BR, st = B.xs[task]; return { done: !!B.done[task], set: st && st.set, started: st && st.started, ml: st && st.ml }; }, { task });
          const holdMs = rnd(150, 400);
          const pr = await press(sel, holdMs);
          if (!pr) { if (process.env.DEBUG_PC) console.log('нет кнопки', bt.key, i, await p.evaluate(() => JSON.stringify({ inset: __dbg.BR && __dbg.BR.inset, money: __dbg.G.money, cust: __dbg.D.customers.length, hidden: document.querySelector('#xPanel').hidden }))); continue; }
          const after = await p.evaluate(({ task }) => { const B = __dbg.BR; const st = B && B.xs[task]; return { done: !!(B && B.done[task]), set: st && st.set, started: st && st.started, ml: st && st.ml, hold: B && B.hold, inset: B && B.inset }; }, { task });
          if (process.env.DEBUG_PC) console.log(bt.key, JSON.stringify({ before, after }));
          let eff;
          if (bt.key.startsWith('xtemp')) eff = after.set === +bt.key.split(':')[1];
          else if (bt.key === 'xstart') eff = !!after.started;
          else if (bt.key === 'xdone') eff = after.done || after.inset !== task;
          else if (bt.key === 'xhold') eff = true; /* эффект hold проверяется ниже по счётчику pointerdown */
          else if (bt.key === 'xdump') eff = true;
          const cnt = await p.evaluate(k => (window.__cnt[k] || { down: 0, click: 0 }), bt.key);
          if (eff && (bt.key === 'xhold' || cnt.click >= 1 || bt.key === 'xdump')) ok++;
          else if (eff && cnt.click >= tries) ok++;
          /* для разовых кнопок: после эффекта панель закрыта; для температур/удержания продолжаем */
          if (!oneShot && after.done) { await open(id, task); }
        }
        const cnt = await p.evaluate(k => (window.__cnt[k] || { down: 0, click: 0 }), bt.key);
        const row = { size: `${w}x${h}`, drink: id, task, button: bt.txt, key: bt.key, tries, effectOk: ok, down: cnt.down, click: cnt.click, ...fit };
        if (!oneShot && bt.key !== 'xhold' && bt.key !== 'xdump') row.clickRate = tries ? +(cnt.click / tries).toFixed(2) : null;
        rows.push(row);
        if (fit.clippedButtons || (row.clickRate !== undefined && row.clickRate < 1) || (oneShot && ok < tries)) fail++;
      }
      console.log(`${w}x${h} ${id}: ${btns.map(x => x.txt).join(' | ')} fit=${JSON.stringify(fit)}`);
    }
    await p.screenshot({ path: `${out}/panel_clicks_${w}x${h}.png` }); await p.close();
  }
  fs.writeFileSync(`${out}/panel_clicks.json`, JSON.stringify(rows, null, 1));
  const bad = rows.filter(r => r.clippedButtons || (r.clickRate !== undefined && r.clickRate < 1) || (r.key && /xstart|xdone/.test(r.key) && r.effectOk < r.tries));
  console.log(`кнопок: ${rows.length}, проблемных: ${bad.length}`); bad.slice(0, 15).forEach(r => console.log(JSON.stringify(r)));
  await b.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
