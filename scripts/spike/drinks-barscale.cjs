// Сравнение масштаба чашки на реальном кадре бара (Н0): ×1,5 / ×2 / ×2,5 / ×3 для 0,2 и 0,6 л, плюс демитас эспрессо.
// node scripts/spike/drinks-barscale.cjs <shotDir> <outDir>; кадр bar_nocup.png делает drinks-shoot.cjs (DPR=2).
const { chromium } = require('../../e2e/node_modules/playwright'); const fs = require('fs'); const path = require('path');
const { drinkSVG, C, cupScale } = require('./drinks-art.cjs'); const SPEC = require('./drinks-specs.cjs');
const SHOT = path.resolve(process.argv[2]); const OUT = path.resolve(process.argv[3]); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'data:image/png;base64,' + fs.readFileSync(path.join(SHOT, 'bar_nocup.png')).toString('base64');
const X0 = 400, Y0 = 250, CW = 720, CH = 310, OX = 630, OY = 478;
/** Модель на баре. geom 'old' — форма текущего drawShell, 'new' — предложенная; unit — масштаб единиц модели в px сцены. */
function onBar(spec, V, unit, geom, extra = {}) {
  const { g } = drinkSVG(spec, { V, level: 'full', s: unit, geom, saucer: true, ...extra });
  return `<svg style="position:absolute;left:${OX - X0}px;top:${OY - Y0}px;overflow:visible" width="1" height="1"><g transform="scale(${unit})">${g}</g></svg>`;
}
const cell = (inner, label, lim = true) => `<div style="position:relative;width:${CW}px;height:${CH}px;overflow:hidden;border:2px solid ${C.INK};border-radius:6px"><img src="${BASE}" style="position:absolute;left:${-X0}px;top:${-Y0}px;width:1280px;height:720px">${inner}${lim ? `<div style="position:absolute;left:0;right:0;top:${380 - Y0}px;border-top:2px dashed #C4402A;opacity:.8"></div><div style="position:absolute;left:4px;top:${380 - Y0 + 2}px;font:700 11px Nunito,sans-serif;color:#C4402A">предел: верх обода не выше y 380</div>` : ''}<div style="position:absolute;inset:0;background:rgb(255,236,200);mix-blend-mode:multiply"></div><div style="position:absolute;right:8px;top:6px;font:800 15px Nunito,sans-serif;color:${C.INK};background:#FFF8EC;border:2px solid ${C.INK};border-radius:8px;padding:2px 8px">${label}</div></div>`;
async function render(html, file, w) {
  const b = await chromium.launch();
  for (const dpr of [1, 2]) {
    const p = await b.newPage({ viewport: { width: w, height: 600 }, deviceScaleFactor: dpr });
    await p.setContent(`<html><body style="margin:0;background:#F6E9D2;font:600 13px Nunito,system-ui,sans-serif;color:${C.INK}"><div id="s" style="padding:14px;display:inline-block">${html}</div></body></html>`); await p.waitForTimeout(400);
    await (await p.$('#s')).screenshot({ path: path.join(OUT, file.replace('.png', `_${dpr}x.png`)) }); await p.close();
  }
  await b.close();
}
const grid = (cells, cols) => `<div style="display:grid;grid-template-columns:repeat(${cols},${CW + 4}px);gap:12px">${cells.join('')}</div>`;
(async () => {
  const latte = SPEC.latte;
  /* A. чистый масштаб: форма как в игре сейчас (drawShell, высота ≤ 1,12), ×N = N/3 от текущей отрисовки */
  for (const V of [200, 600]) {
    const cells = [1.5, 2, 2.5, 3].map((N) => cell(onBar(latte, V, N / 3, 'old'), `×${N}${N === 3 ? ' (сейчас)' : ''} · ${V / 1000} л`));
    await render(`<div style="font:800 18px Nunito,sans-serif;margin-bottom:8px">Масштаб чашки на баре, ${(V / 1000).toString().replace('.', ',')} л: форма как в игре сейчас, меняется только масштаб</div>` + grid(cells, 2), `scale_${V === 200 ? '0.2' : '0.6'}_current-shape.png`, 1500);
  }
  /* B. предложенный стакан (выше и уже, без потолка высоты): ширина верха стакана 0,2 л (92 ед.) приравнена к 104 ед. текущего при ×3, дальше ×N/3 */
  const cellsB = [];
  for (const V of [200, 600]) for (const N of [1.5, 2, 2.5]) cellsB.push(cell(onBar(latte, V, (N / 3) * (104 / 92), 'new'), `предложенный стакан ×${N} · ${V / 1000} л`));
  await render(`<div style="font:800 18px Nunito,sans-serif;margin-bottom:8px">Предложенная форма стакана (чуть выше текущей, без потолка высоты, одна форма для всех мест)</div>` + grid(cellsB, 3), 'scale_proposed-shape.png', 2300);
  /* C. эспрессо: демитас одинарный и двойной рядом с чашкой 0,2 л (×2), текущий cupScale против предложенного масштаба */
  const lat02 = { ...SPEC.cappuccino };
  const cup = (k, x, spec, V, unit, extra) => `<div style="position:absolute;left:${x}px;top:0">${onBar(spec, V, unit, 'old', extra)}</div>`;
  const dem = (kk, spec) => ({ ...spec, vessel: 'demitas', k: kk, hot: true, fill: 1, top: { col: '#5A3A2A' }, layers: [] });
  const N = 2.5, u = N / 3;
  const row = (kS, kD) => {
    const mk = (spec, V, dx, extra) => `<div style="position:absolute;left:${dx}px;top:0">${onBar(spec, V, u, 'old', extra)}</div>`;
    return mk(dem(kS), 90, -150) + mk(dem(kD), 120, -70) + mk({ ...lat02, hot: true }, 200, 10);
  };
  await render(grid([
    cell(row(0.77, 0.84), 'сейчас: cupScale 0,77 / 0,84', false) ,
    cell(row(0.62, 0.7), 'предложено: демитас 0,62 / 0,70', false)], 1) + `<div style="margin-top:8px">Слева направо: одинарный эспрессо (30 мл, чашка 90 мл), двойной (60 мл, чашка 120 мл), капучино 0,2 л. Бар ×2,5 (решение владельца 16.10.2026).</div>`, 'espresso_demitas.png', 800);
  /* D. решение владельца: ×2,5, предложенный стакан, потолок высоты CUP_MAX_KY = 1,12 (геометрия newcap) */
  const U = (2.5 / 3) * (104 / 92);
  const dec = [200, 300, 400, 600].map((V) => cell(onBar({ ...latte, hot: true }, V, U, 'newcap'), `×2,5 · предложенный стакан · ${V / 1000} л`));
  await render(`<div style="font:800 18px Nunito,sans-serif;margin-bottom:8px">Решение: ×2,5 с потолком высоты (0,6 л чуть шире, но под группой)</div>` + grid(dec, 2), 'scale_decided_x2.5.png', 1500);
  /* E. лёд: без льда / было (Н0) / стало на баре ×2,5, бамбл 0,3 и 0,6 л */
  const ice = (V, spec) => spec.iceAuto ? { ...spec, ice: V <= 300 ? 4 : 5 } : spec;
  const cellsI = [];
  for (const V of [300, 600]) for (const [nm, key] of [['без льда', 'orange_bumble_noice'], ['было (лёд Н0, 6 кубиков)', 'orange_bumble_old'], ['стало (правило 16.10.2026)', 'orange_bumble']]) cellsI.push(cell(onBar(ice(V, SPEC[key]), V, U, 'newcap'), `${nm} · ${V / 1000} л`));
  await render(`<div style="font:800 18px Nunito,sans-serif;margin-bottom:8px">Бамбл на баре ×2,5: чтение слоёв без льда, со старым и с новым льдом</div>` + grid(cellsI, 3), 'bumble_ice_bar_x2.5.png', 2300);
  await render(`<div style="font:800 18px Nunito,sans-serif;margin-bottom:8px">Холодное капучино на баре ×2,5</div>` + grid([300, 600].map((V) => cell(onBar(ice(V, SPEC.cold_cappuccino), V, U, 'newcap'), `холодное капучино · ${V / 1000} л`)), 2), 'cold_cappuccino_bar_x2.5.png', 1500);
})();
