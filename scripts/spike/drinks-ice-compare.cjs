// «Было / стало» для льда бамбла (Н1-1): полный уровень, 0,3 и 0,6 л. node scripts/spike/drinks-ice-compare.cjs <outDir>
const { chromium } = require('../../e2e/node_modules/playwright'); const fs = require('fs'); const path = require('path');
const { drinkSVG, C } = require('./drinks-art.cjs'); const SPEC = require('./drinks-specs.cjs');
const OUT = path.resolve(process.argv[2] || 'docs/art/drinks'); fs.mkdirSync(OUT, { recursive: true });
function cell(spec0, V, s) { const spec = spec0.iceAuto ? { ...spec0, ice: V <= 300 ? 4 : 5 } : spec0; const { g, bbox } = drinkSVG(spec, { V, level: 'full', s }); const w = Math.ceil((bbox.x1 - bbox.x0) * s + 24), h = Math.ceil((bbox.y1 - bbox.y0) * s + 24); return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g transform="translate(${(12 - bbox.x0 * s).toFixed(1)} ${(12 - bbox.y0 * s).toFixed(1)}) scale(${s})">${g}</g></svg>`; }
(async () => {
  let h = `<div style="font:800 18px Nunito,sans-serif;margin-bottom:10px">Лёд бамбла: без льда · было (Н0) · стало</div><div style="display:grid;grid-template-columns:repeat(3,auto);gap:10px 40px;align-items:end">`;
  for (const V of [300, 600]) for (const [nm, k] of [['без льда', 'orange_bumble_noice'], ['было: 6 белых кубиков', 'orange_bumble_old'], ['стало: прозрачные кубики цвета слоя, 4–5 штук', 'orange_bumble']]) h += `<div>${cell(SPEC[k], V, 1.5)}<div style="font-size:12px">${nm} · ${V / 1000} л</div></div>`;
  h += '</div>';
  const b = await chromium.launch();
  for (const dpr of [1, 2]) { const p = await b.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: dpr }); await p.setContent(`<html><body style="margin:0;background:#F6E9D2;font:600 13px Nunito,system-ui,sans-serif;color:${C.INK}"><div id="s" style="padding:14px;display:inline-block">${h}</div></body></html>`); await (await p.$('#s')).screenshot({ path: path.join(OUT, `pilot_bumble_before-after_${dpr}x.png`) }); await p.close(); }
  await b.close();
})();
