// Лист холодных напитков Н2-3 (группы C4–C6): 13 напитков, полный уровень (0,3 / 0,4 / 0,6 л) и компактный (слот билета 49 × 42 и слот пузыря 38 × 41, ×3); подписи.
// node scripts/spike/h23-sheet.cjs docs/art/drinks/h2-3   (также pairs_ticket_49x42_x3.png)
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const { chromium } = require('../../e2e/node_modules/playwright');
const OUT = path.resolve(process.argv[2] || 'out/h23'); fs.mkdirSync(OUT, { recursive: true });
const tmp = path.resolve('out/h23'); fs.mkdirSync(tmp, { recursive: true });
const bundle = path.join(tmp, 'h12.cjs');
execSync(`npx esbuild scripts/spike/h12-entry.ts --bundle --format=cjs --platform=node --outfile="${bundle}" --log-level=error`, { stdio: 'inherit' });
const M = require(bundle);
const ORDER = ['aerocano', 'milkshake_vanilla', 'milkshake_banana', 'frappe_caramel', 'protein_milk', 'protein_water', 'boba_guava', 'boba_raspberry'];
const cold = (id) => M.allSpecs().filter((x) => x.id === id && x.cold);
const want = ['0.3', '0.4', '0.6'];
const full = (sp) => `<div class="c">${M.drinkSvg(sp, { level: 'full', s: M.BAR_UNIT[sp.vessel.material] * 1.0, saucer: true, steamMark: true }).svg}<div class="l">${sp.size.replace('.', ',')} л</div></div>`;
const icon = (sp, w, h) => `<div class="c"><div class="ib" style="width:${w * 3}px;height:${h * 3}px"><div style="transform:scale(3);transform-origin:0 0;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">${M.drinkIconSvg(sp, w, h).svg}</div></div><div class="l">${sp.size.replace('.', ',')} л</div></div>`;
let html = `<style>body{margin:0;background:#F6E9D2;padding:14px;font-family:sans-serif;width:2100px;color:#4A2F25}.r{display:flex;align-items:flex-end;gap:14px;border-top:2px solid #4A2F25;padding:8px 0}.n{width:190px;font:800 14px sans-serif}.n small{font-weight:600;display:block}.c{display:flex;flex-direction:column;align-items:center;min-width:90px}.l{font:700 11px sans-serif;margin-top:3px}.ib{background:#FFFDF6;border-radius:8px;border:1px solid #D9C7A5;overflow:hidden}.sep{width:2px;align-self:stretch;background:#C9B38A}h2{margin:0 0 6px;font:800 18px sans-serif}</style><h2>Густые, аэрокано и бабл ти на модели (Н2-3): полный уровень | билет 49×42 (×3) | пузырь 38×41 (×3)</h2>`;
for (const id of ORDER) {
  const have = cold(id); const use = want.map((z) => have.find((x) => x.size === z)).filter(Boolean); const list = use.length ? use : have.slice(0, 2);
  html += `<div class="r"><div class="n">${id}<small>${list[0].group} · ${list[0].vessel.material}</small></div>${list.map(full).join('')}<div class="sep"></div>${list.map((s) => icon(s, 49, 42)).join('')}<div class="sep"></div>${list.map((s) => icon(s, 38, 41)).join('')}</div>`;
}
const pairIds = ORDER.map((id) => { const l = cold(id); return l.find((x) => x.size === '0.4') || l[0]; });
const pairs = pairIds.map((sp) => { const w = 49, h = 42; return `<div style="text-align:center;font:600 10px sans-serif"><div style="width:${w * 3}px;height:${h * 3}px;background:#FFFDF6;border-radius:8px;overflow:hidden"><div style="transform:scale(3);transform-origin:0 0;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">${M.drinkIconSvg(sp, w, h).svg}</div></div>${sp.id}</div>`; });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2130, height: 900 }, deviceScaleFactor: 1 }); await p.setContent(html); await p.screenshot({ path: path.join(OUT, 'c456_sheet.png'), fullPage: true });
  await p.setViewportSize({ width: 1700, height: 200 });
  await p.setContent(`<body style="margin:0;background:#F6E9D2;display:grid;grid-template-columns:repeat(8,1fr);gap:8px;padding:8px">${pairs.join('')}`); await p.screenshot({ path: path.join(OUT, 'pairs_ticket_49x42_x3.png'), fullPage: true });
  await b.close();
})();
