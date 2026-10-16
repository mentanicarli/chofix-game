// Лист посадки Н1-3б: все материалы × размеры × горячий/холодный × full/compact; подпись под каждой моделью. Инструмент для глаз, не тест.
// node scripts/spike/h13b-sheet.cjs docs/art/drinks/h1-3b
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const { chromium } = require('../../e2e/node_modules/playwright');
const OUT = path.resolve(process.argv[2] || 'out/h13b'); fs.mkdirSync(OUT, { recursive: true });
const tmp = path.resolve('out/h13b'); fs.mkdirSync(tmp, { recursive: true });
const bundle = path.join(tmp, 'h12.cjs');
execSync(`npx esbuild scripts/spike/h12-entry.ts --bundle --format=cjs --platform=node --outfile="${bundle}" --log-level=error`, { stdio: 'inherit' });
const M = require(bundle);
const spec = (id, size, cold) => { try { return M.specOf(id, size, cold); } catch (e) { return null; } };
const cell = (sp, level) => {
  const mat = sp.vessel.material;
  const s = level === 'full' ? M.BAR_UNIT[mat] * 1.15 : 0.5;
  const r = M.drinkSvg(sp, { level, s, saucer: true, steamMark: true });
  return `<div class="c">${r.svg}<div class="l">${sp.id.replace('orange_', '')} ${sp.size.replace('.', ',')} · ${sp.cold ? 'хол.' : 'гор.'}<br>${mat} · ${level}</div></div>`;
};
const rows = [
  ['glass, горячие (латте)', ['0.2', '0.3', '0.4', '0.6'].map((z) => spec('latte', z, false)).filter(Boolean)],
  ['glass, холодные (капучино)', ['0.2', '0.3', '0.4', '0.6'].map((z) => spec('cappuccino', z, true)).filter(Boolean)],
  ['glass, холодные (бамбл)', ['0.3', '0.4', '0.6'].map((z) => spec('orange_bumble', z, true)).filter(Boolean)],
  ['ceramic (капучино, американо)', ['0.2', '0.3', '0.4', '0.6'].map((z) => spec('cappuccino', z, false)).concat(['0.3', '0.6'].map((z) => spec('americano', z, false))).filter(Boolean)],
  ['demitas (эспрессо, двойной)', [spec('espresso', '0.2', false), spec('espresso_double', '0.2', false), spec('espresso_double', '0.3', false)].filter(Boolean)],
];
const kinds = [...new Set(M.allSpecs().map((s) => s.vessel.material))];
let html = `<style>body{margin:0;background:#F6E9D2;padding:14px;font-family:Nunito,sans-serif;width:1500px}h3{margin:14px 0 4px;font:800 14px sans-serif;color:#4A2F25}.row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px 20px}.c{display:flex;flex-direction:column;align-items:center}.l{font:700 11px/1.25 sans-serif;color:#4A2F25;text-align:center;margin-top:4px}</style>`;
for (const lod of ['full', 'compact']) {
  html += `<h3 style="font-size:17px;border-bottom:2px solid #4A2F25">${lod === 'full' ? 'Полный уровень (бар, книга, окно «Новый напиток»)' : 'Компактный уровень (билет, пузырь)'}</h3>`;
  for (const [t, list] of rows) html += `<h3>${t}</h3><div class="row">${list.map((sp) => cell(sp, lod)).join('')}</div>`;
}
html += `<div style="margin-top:8px;font:11px sans-serif">материалы в игре: ${kinds.join(', ')}</div>`;
(async () => {
  const b = await chromium.launch();
  for (const dpr of [1, 2]) { const p = await b.newPage({ viewport: { width: 1530, height: 900 }, deviceScaleFactor: dpr }); await p.setContent(html); await p.screenshot({ path: path.join(OUT, dpr === 2 ? 'seat_sheet.png' : 'seat_sheet_1x.png'), fullPage: true }); await p.close(); }
  await b.close();
})();
