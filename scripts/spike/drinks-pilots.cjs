// Макеты трёх пилотных напитков (Н0): полный и компактный уровни, 0,2 / 0,6 л. node scripts/spike/drinks-pilots.cjs <outDir>
const { chromium } = require('../../e2e/node_modules/playwright'); const fs = require('fs'); const path = require('path');
const { drinkSVG, C, cupScale } = require('./drinks-art.cjs'); const SPEC = require('./drinks-specs.cjs');
const OUT = path.resolve(process.argv[2] || 'docs/art/drinks'); fs.mkdirSync(OUT, { recursive: true });
const PAPER_BG = `<filter id="pg"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .4  0 0 0 0 .25  0 0 0 .07 0"/></filter>`;
/** Один макет как отдельный <svg> с заданным масштабом s и отступами. */
function cell(spec0, V, level, s, pad = 12) {
  const spec = spec0.iceAuto ? { ...spec0, ice: V <= 300 ? 4 : 5 } : spec0;
  const { g, bbox } = drinkSVG(spec, { V, level, s });
  const w = (bbox.x1 - bbox.x0) * s + pad * 2, h = (bbox.y1 - bbox.y0) * s + pad * 2;
  return { w: Math.ceil(w), h: Math.ceil(h), svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}"><g transform="translate(${(pad - bbox.x0 * s).toFixed(2)} ${(pad - bbox.y0 * s).toFixed(2)}) scale(${s})">${g}</g></svg>` };
}
const label = (t, sub = '') => `<div class="lb"><b>${t}</b>${sub ? '<br>' + sub : ''}</div>`;
async function sheet(file, title, specKey, o = {}) {
  const spec = SPEC[specKey]; const FULL = o.full || 1.5, COMP = o.comp || 0.42;
  let html = `<html><body style="margin:0;background:${C.KRAFT};font:600 13px Nunito,system-ui,sans-serif;color:${C.INK}"><svg width="0" height="0">${PAPER_BG}</svg><div id="s" style="position:relative;padding:18px 22px;background:#F6E9D2;width:1180px">`;
  html += `<div style="font:800 20px Nunito,system-ui;margin-bottom:6px">${title}</div><div style="margin-bottom:10px;opacity:.8">${o.note || ''}</div>`;
  html += `<div style="display:flex;gap:26px;align-items:flex-end">`;
  for (const sz of spec.sizes) { const V = +sz * 1000; const c = cell(spec, V, 'full', FULL); html += `<div>${c.svg}${label('Полный уровень, ' + sz.replace('.', ',') + ' л', `масштаб ×${FULL} от единиц бара; cupScale ${cupScale(V).toFixed(2)}`)}</div>`; }
  html += `</div><hr style="border:0;border-top:2px dashed ${C.KRAFT_DP};margin:16px 0">`;
  html += `<div style="display:flex;gap:34px;align-items:flex-end">`;
  for (const sz of spec.sizes) {
    const V = +sz * 1000; const real = cell(spec, V, 'compact', COMP), zoom = cell(spec, V, 'compact', COMP * 3, 6);
    html += `<div style="display:flex;gap:18px;align-items:flex-end"><div><div style="background:${C.PAPER};border:2px solid ${C.INK};border-radius:10px;width:49px;height:42px;display:flex;align-items:center;justify-content:center;overflow:visible">${real.svg}</div>${label('в слоте билета 49×42 px (1280×720),<br>реальный размер')}</div><div>${zoom.svg}${label('то же, ×3 для просмотра', 'компактный, ' + sz.replace('.', ',') + ' л')}</div></div>`;
  }
  html += `</div></div><style>.lb{font-size:12px;margin-top:4px;opacity:.85}svg{display:block}</style></body></html>`;
  const b = await chromium.launch();
  for (const dpr of [1, 2]) { const p = await b.newPage({ viewport: { width: 1230, height: 700 }, deviceScaleFactor: dpr }); await p.setContent(html); await p.waitForTimeout(200); await (await p.$('#s')).screenshot({ path: path.join(OUT, file.replace('.png', `_${dpr}x.png`)) }); await p.close(); }
  await b.close();
}
(async () => {
  const only = process.argv[3];
  const jobs = { latte: ['pilot_latte.png', 'Латте: стекло, горячий, слои и арт', 'latte', { note: 'Стеклянный стакан, слои «молоко → переход → кофе → пена» с ступенчатым переходом, латте-арт на поверхности.' }],
    cappuccino: ['pilot_cappuccino.png', 'Капучино: керамика, горячий', 'cappuccino', { note: 'Непрозрачная керамика, виден только верх: кольцо крема и рисунок на пене.' }],
    orange_bumble: ['pilot_bumble.png', 'Апельсиновый бамбл: стекло, лёд, слои', 'orange_bumble', { note: 'Холодный, в игре от 0,3 л (0,2 л не заказывается): показаны 0,3 и 0,6 л. Лёд по правилу 16.10.2026: прозрачные кубики цвета слоя, 4 (до 0,3 л) и 5 (с 0,4 л) штуки; компактный уровень: 3 блика-точки.' }],
    cold_cappuccino: ['pilot_cold_cappuccino.png', 'Холодное капучино: стекло, лёд в молочном напитке', 'cold_cappuccino', { note: 'Эспрессо на дне, молоко с кофе, холодная пена; лёд по новому правилу. Показаны 0,3 и 0,6 л.' }] };
  for (const k of Object.keys(jobs)) if (!only || only === k) await sheet(...jobs[k]);
})();
