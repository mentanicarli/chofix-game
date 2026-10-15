// Временная выгрузка данных по 37 напиткам (Н0): размеры, объёмы чашки, палитра, цвет верха. Не входит в сборку.
// node scripts/spike/drinks-dump.cjs <out.json>; нужна отладочная сборка dist/artifact.html.
const { chromium } = require('../../e2e/node_modules/playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const html = path.resolve('dist/artifact.html');
  const src = fs.readFileSync(html, 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; } };');
  const tmp = html.replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + tmp + '#nopixi-lowfx'); await p.waitForTimeout(2500);
  const data = await p.evaluate(() => {
    const M = window.__MENUAPI; const out = [];
    for (const d of M.menu ? M.menu.drinks : Object.values(M.drinkById)) {
      const id = d.id; const sizes = Object.keys(d.sizes); const row = { id, name: d.name, temp: d.temp, family: d.family, rank: d.rank, steps: d.steps.map(s => s.st + (s.arg ? ':' + s.arg : '')), sizes: {}, pal: M.paletteOf(id), top: M.topColorOf(id) };
      for (const hc of (d.temp === 'both' ? [false, true] : [d.temp === 'cold'])) for (const s of (hc && d.coldSizes ? d.coldSizes : sizes)) { try { const r = M.recipeNumbers(d, s, hc); row.sizes[(hc ? 'c' : 'h') + s] = r; } catch (e) { row.sizes[(hc ? 'c' : 'h') + s] = 'ERR ' + e.message; } }
      out.push(row);
    }
    return out;
  });
  fs.writeFileSync(process.argv[2], JSON.stringify(data, null, 1)); console.log(data.length);
  await b.close();
})();
