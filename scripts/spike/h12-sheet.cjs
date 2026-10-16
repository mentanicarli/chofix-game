// Листы моделей Н1-2: полный и компактный уровни, 0,3 и 0,6 л, прямо из модуля src/render/world/drinkModel.ts.
// node scripts/spike/h12-sheet.cjs <outDir> ; сначала собирается esbuild-бандл (см. npm-команду в скрипте).
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const { chromium } = require('../../e2e/node_modules/playwright');
const OUT = path.resolve(process.argv[2] || 'out/h12'); fs.mkdirSync(OUT, { recursive: true });
const bundle = path.join(OUT, 'h12.cjs');
execSync(`npx esbuild scripts/spike/h12-entry.ts --bundle --format=cjs --platform=node --outfile="${bundle}" --log-level=error`, { stdio: 'inherit' });
const M = require(bundle);
const cell = (ref, level, s, extra = {}) => { const spec = M.specOf(ref[0], ref[1], ref[2]); const r = M.drinkSvg(spec, { level, s, saucer: false, steamMark: true, ...extra }); return `<div style="display:inline-block;margin:6px 14px;vertical-align:bottom">${r.svg}<div style="font:700 11px sans-serif">${ref[0]} ${ref[1]} ${ref[2] ? 'хол.' : 'гор.'} · ${level}</div></div>`; };
(async () => {
  const refs = [['latte', '0.3', false], ['latte', '0.6', false], ['cappuccino', '0.3', false], ['cappuccino', '0.3', true], ['cappuccino', '0.6', true], ['orange_bumble', '0.3', true], ['orange_bumble', '0.6', true]];
  let html = '<body style="margin:0;background:#F6E9D2;padding:10px">' + refs.map((r) => cell(r, 'full', 1.5)).join('') + '<hr>' + refs.map((r) => cell(r, 'compact', 1.2)).join('') + '<hr>' + refs.map((r) => { const spec = M.specOf(r[0], r[1], r[2]); const i = M.drinkIconSvg(spec, 49, 42); return `<span style="display:inline-block;width:49px;height:42px;margin:8px;background:#FFFDF6;border-radius:8px;position:relative">${i.svg}</span>`; }).join('');
  const b = await chromium.launch();
  for (const dpr of [1, 2]) { const p = await b.newPage({ viewport: { width: 1500, height: 700 }, deviceScaleFactor: dpr }); await p.setContent(html); await p.screenshot({ path: path.join(OUT, `sheet_${dpr}x.png`), fullPage: true }); await p.close(); }
  await b.close();
})();
