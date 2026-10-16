/* Б1-1: побитовое сравнение кадра бара до и после (инструмент, не тест). Обычная игра БЕЗ #dev, разные улучшения, 1× и 2×.
   Отладочные сборки: node scripts/spike/b11-diff.cjs out/b11/before-debug.html out/b11/after-debug.html out/b11/diff
   Для каждого набора улучшений кадр снимается в обеих сборках, плюс повтор «до» против «до» (шум самого прогона). Печатает число отличающихся пикселей. */
const { chromium } = require('../../e2e/node_modules/playwright'); const path = require('path'); const fs = require('fs');
const PW = require('../../e2e/pw');
const [A, B, OUT] = [process.argv[2], process.argv[3], path.resolve(process.argv[4] || 'out/b11/diff')];
fs.mkdirSync(OUT, { recursive: true });
const HOOK = 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, WORLD, spawn, barOpen, barShow, applyUpgrades };';
const SETS = {
  none: [],
  milk_ice: ['milk', 'eq_ice'],
  food: ['eq_ice', 'eq_case_snacks', 'eq_case_pastry', 'eq_case_dessert', 'eq_fridge_deli', 'eq_microwave'],
  sides_bought: ['milk', 'eq_tea', 'eq_matcha', 'eq_powders', 'eq_juice', 'eq_blender', 'eq_boba'],
  everything: ['milk', 'eq_ice', 'eq_cream', 'eq_case_snacks', 'eq_case_pastry', 'eq_case_dessert', 'eq_fridge_deli', 'eq_microwave', 'eq_tea', 'eq_matcha', 'eq_powders', 'eq_juice', 'eq_whipper', 'eq_foamer', 'eq_blender', 'eq_boba', 'eq_shaker']
};
async function shoot(file, dsf, keys, name) {
  const src = fs.readFileSync(path.resolve(file), 'utf8').replace('newGame(); updateHud(); showTitle();', HOOK);
  const tmp = path.resolve(file).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 1312, height: 752 }, deviceScaleFactor: dsf }); const p = await ctx.newPage(); const errs = [];
  await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs);
  await p.addInitScript(() => { window.__seed = (a) => { Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }; });
  await p.goto('about:blank'); await p.goto(PW.url(tmp)); /* без #dev: обычная игра */
  await PW.startNew(p);
  await p.waitForFunction(() => window.__dbg && __dbg.D && __dbg.G.phase === 'day', null, { timeout: 60000 });
  await p.evaluate((ks) => { const d = __dbg; ks.forEach(k => { d.G[k] = true; }); d.G.tutOff = true; d.G.hints = false; d.applyUpgrades(); d.D.nextArr = 1e9; window.__seed(12345); d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; c.syrup = null; }); }, keys);
  await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
  await p.evaluate(() => __dbg.barOpen(__dbg.D.customers[0]));
  await p.waitForTimeout(900); await PW.dismissCard(p);
  /* время суток держим на месте, интерфейс скрыт */
  await p.evaluate(() => { setInterval(() => { __dbg.D.t = 100; }, 16); document.querySelectorAll('#hud,#bTk,#bCoach,#toast,#bFloat,#bGoal,#frontHint').forEach(e => { e.style.visibility = 'hidden'; }); });
  await p.waitForTimeout(2500);
  const f = path.join(OUT, `${name}_${dsf}x.png`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('#stage').screenshot({ path: f, timeout: 120000 }); /* по элементу, а не по координатам окна: страницу Playwright может сдвинуть на 8 px */
  const state = await p.evaluate(() => ({ side: __dbg.WORLD.barSideTextures ? __dbg.WORLD.barSideTextures() : 'н/д', inbar: document.querySelector('#stage').classList.contains('inbar') }));
  await b.close();
  return { f, errs, state };
}
async function diff(fa, fb) {
  const b = await chromium.launch(); const p = await b.newPage();
  const r = await p.evaluate(async ([x, y]) => {
    const load = s => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = s; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: false };
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data; g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, mx = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let i = 0; i < da.length; i += 4) { const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]), Math.abs(da[i + 3] - db[i + 3])); if (d) { n++; if (d > mx) mx = d; const q = i / 4, X = q % c.width, Y = (q - X) / c.width; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; } }
    return { size: true, px: n, max: mx, box: n ? [x0, y0, x1, y1].join(',') : '', total: da.length / 4 };
  }, ['data:image/png;base64,' + fs.readFileSync(fa).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(fb).toString('base64')]);
  await b.close(); return r;
}
(async () => {
  let bad = 0; const errs = [];
  for (const dsf of [1, 2]) for (const [name, keys] of Object.entries(SETS)) {
    const a = await shoot(A, dsf, keys, name + '_before'), c = await shoot(B, dsf, keys, name + '_after');
    errs.push(...a.errs, ...c.errs);
    const d = await diff(a.f, c.f); let noise = null;
    if (process.env.NOISE) { const a2 = await shoot(A, dsf, keys, name + '_before2'); noise = await diff(a.f, a2.f); }
    if (!d.size || d.px) bad++;
    console.log(`${name} ${dsf}x: ${d.size ? d.px + ' px отличаются (макс. канал ' + d.max + ', рамка ' + d.box + ') из ' + d.total : 'РАЗМЕР РАЗНЫЙ'}; текстур боковых секций после: ${c.state.side}${noise ? '; шум до/до: ' + noise.px + ' px, рамка ' + noise.box : ''}`);
  }
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'NO_ERRORS'); console.log(bad ? 'ЕСТЬ РАЗНИЦА: ' + bad : 'РАЗНИЦА 0 px ВО ВСЕХ КАДРАХ'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
