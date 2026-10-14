/* Зоны бара: оборудование, которого нет, не принимает клики; есть, но не нужно — «X не нужен».
   node e2e/zones_test.js dist/artifact.html out/zones   (отладочная сборка, см. CLAUDE.md) */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const pw = require('./pw');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const HOOK = 'window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; } }';
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); ' + HOOK);
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const out = process.argv[3] || 'out/zones';
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await pw.page(b); const errs = []; pw.watch(p, errs);
  const url = pw.url(tmp);
  const ZONES = ['ice', 'food', 'tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker'];
  const msgs = () => p.evaluate(() => [...document.querySelectorAll('.bmsg')].map(e => e.textContent).filter(t => !/^Заказ принят/.test(t)));
  const center = z => p.evaluate(z => { const r = document.querySelector('#bZones [data-z="' + z + '"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, z);
  const openBar = async () => {
    await p.waitForFunction(() => { const c = window.__dbg.D && window.__dbg.D.customers[0]; return c && c.arrived; }, null, { timeout: 60000 });
    await p.keyboard.press('Space'); await p.waitForTimeout(900); await pw.dismissCard(p);
    await p.waitForFunction(() => !!window.__dbg.BR, null, { timeout: 5000 });
  };

  /* 1. день 1, новый сейв: пустые места стола молчат */
  await p.goto(url + '#nopixi-lowfx'); await p.waitForSelector('[data-start]', { timeout: 30000 });
  await pw.startNew(p); await openBar();
  ok(await p.evaluate(() => window.__dbg.G.day === 1 && window.__dbg.G.rank === 1 && !window.__dbg.G.eq_ice), 'день 1, ранг 1, оборудования нет');
  ok(await p.evaluate(z => z.every(k => getComputedStyle(document.querySelector('#bZones [data-z="' + k + '"]')).pointerEvents === 'none'), ZONES), 'все зоны отсутствующего оборудования: pointer-events none');
  for (const z of ZONES) { const c = await center(z); await p.mouse.click(c.x, c.y); }
  for (const [x, y] of [[100, 600], [300, 680], [850, 650], [1200, 650], [60, 690]]) { const s = await p.evaluate(() => { const r = document.querySelector('#barSvg').getBoundingClientRect(); return { x: r.x, y: r.y, k: r.width / 1280 }; }); await p.mouse.click(s.x + x * s.k, s.y + y * s.k); }
  await p.waitForTimeout(300);
  ok((await msgs()).length === 0, 'клики по пустому столу: подсказок нет ' + JSON.stringify(await msgs()));
  /* зона нужного оборудования живая: помол открывает инсет */
  const g = await center('grind'); await p.mouse.click(g.x, g.y); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__dbg.BR.inset === 'grind'), 'клик по кофемолке открывает помол');
  await p.screenshot({ path: out + '_day1.png' });

  /* 2. песочница, поздний ранг: оборудование есть → «Сифон не нужен», но то, чего нет, молчит */
  await pw.sandboxStart(p, url, { day: 30, mode: 'all' });
  await p.click('#devBtn'); await p.waitForSelector('#devPanel:not([hidden])'); await p.waitForTimeout(500);
  await p.selectOption('[data-o="drink"]', 'espresso_double'); await p.click('[data-dv="setorder"]'); await p.click('[data-dv="nopat"]'); await p.click('[data-dv="call"]');
  await openBar();
  await p.click('#devBtn'); await p.waitForTimeout(300);
  const own = await p.evaluate(z => Object.fromEntries(z.map(k => [k, !!window.__dbg.G['eq_' + k]])), ['whipper', 'ice', 'blender']);
  ok(own.whipper, 'на дне 30 сифон куплен: ' + JSON.stringify(own));
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#bZones [data-z="whipper"]')).pointerEvents !== 'none'), 'зона сифона активна');
  const w = await center('whipper'); await p.mouse.click(w.x, w.y); await p.waitForTimeout(300);
  ok((await msgs()).includes('Сифон не нужен'), 'ненужный сифон: «Сифон не нужен» ' + JSON.stringify(await msgs()));
  await p.screenshot({ path: out + '_late.png' });

  ok(errs.length === 0, errs.length ? 'ошибки: ' + errs.slice(0, 5).join(' | ') : 'NO_ERRORS');
  await b.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
