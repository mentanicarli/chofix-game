// Компактный уровень модели напитка в слоте билета и в пузыре заказа на реальных кадрах (Н0, Н1-1).
// node scripts/spike/drinks-ticket-bubble.cjs <shotDir> <outDir>  (SET=ice — бамбл и холодное капучино с новым льдом, префикс файлов ice_)
// Билет — docs/art/sections/s_*_day.png (слот «картинка (этап Н)» измерен: 49×42 при 1280×720, 38×35 при 1024×600), зал — <shotDir>/hall.png (DPR 2).
const { chromium } = require('../../e2e/node_modules/playwright'); const fs = require('fs'); const path = require('path');
const { drinkSVG, C } = require('./drinks-art.cjs'); const SPEC = require('./drinks-specs.cjs');
const SHOT = path.resolve(process.argv[2]); const OUT = path.resolve(process.argv[3]); fs.mkdirSync(OUT, { recursive: true });
const uri = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
/** Модель, вписанная в прямоугольник слота: масштаб подбирается по bbox, толщина линии 2 px на экране. */
function fit(spec0, V, W, H, geom = 'new') {
  const spec = spec0.iceAuto ? { ...spec0, ice: V <= 300 ? 4 : 5 } : spec0;
  const probe = drinkSVG(spec, { V, level: 'compact', s: 1, geom }); const bw = probe.bbox.x1 - probe.bbox.x0, bh = probe.bbox.y1 - probe.bbox.y0;
  const s = Math.min((W - 4) / bw, (H - 2) / bh, 0.5);
  const r = drinkSVG(spec, { V, level: 'compact', s, geom });
  const w = (r.bbox.x1 - r.bbox.x0) * s, h = (r.bbox.y1 - r.bbox.y0) * s;
  return { svg: `<svg width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${r.bbox.x0.toFixed(1)} ${r.bbox.y0.toFixed(1)} ${(r.bbox.x1 - r.bbox.x0).toFixed(1)} ${(r.bbox.y1 - r.bbox.y0).toFixed(1)}" style="position:absolute;left:${((W - w) / 2).toFixed(1)}px;bottom:0" overflow="visible">${r.g}</svg>`, s, w, h };
}
/* модели в зале тонируются так же, как кадр (тонировка DOM-слоя #tint, multiply rgb(255,236,200)); кадры билета сняты без тонировки */
const tintBox = (x, y, W, H, inner, tint) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${W}px;height:${H}px;${tint ? 'filter:url(#tintf)' : ''}">${inner}</div>`;
async function sampleColor(p, file, x, y, scale) {
  return p.evaluate(async ([u, x, y, sc]) => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(Math.round(x * sc) - 2, Math.round(y * sc) - 2, 5, 5).data; let r = 0, gg = 0, bb = 0; const n = d.length / 4; for (let k = 0; k < d.length; k += 4) { r += d[k]; gg += d[k + 1]; bb += d[k + 2]; } return `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(bb / n)})`; }, [uri(file), x, y, scale]);
}
const ICE = process.env.SET === 'ice';
const DRINKS = ICE ? [
  { key: 'orange_bumble', title: 'Апельсиновый бамбл', sizes: [0.3, 0.6] },
  { key: 'cold_cappuccino', title: 'Холодное капучино', sizes: [0.3, 0.6] },
  { key: 'orange_bumble', title: 'Апельсиновый бамбл', sizes: [0.4, 0.6] }
] : [
  { key: 'latte', title: 'Латте', sizes: [0.2, 0.6] },
  { key: 'cappuccino', title: 'Капучино', sizes: [0.2, 0.6] },
  { key: 'orange_bumble', title: 'Апельсиновый бамбл', sizes: [0.3, 0.6] }
];
const PFX = ICE ? 'ice_' : '';
/** Кроп кадра: img с позиции (x,y), ширина кадра baseW (логические px), поверх — патчи и модели в координатах кадра. */
const crop = (img, baseW, c, layers, zoom = 1) => `<div style="position:relative;width:${c.w * zoom}px;height:${c.h * zoom}px;overflow:hidden;border-radius:4px"><div style="position:absolute;left:0;top:0;width:${c.w}px;height:${c.h}px;transform:scale(${zoom});transform-origin:0 0"><img src="${img}" style="position:absolute;left:${-c.x}px;top:${-c.y}px;width:${baseW}px">${layers.map((l) => l(c)).join('')}</div></div>`;
const patch = (x, y, w, h, col, r = 6) => (c) => `<div style="position:absolute;left:${x - c.x}px;top:${y - c.y}px;width:${w}px;height:${h}px;background:${col};border-radius:${r}px"></div>`;
const model = (x, y, W, H, m, tint = false) => (c) => tintBox(x - c.x, y - c.y, W, H, m.svg, tint);
const text = (x, y, w, t, size = 11) => (c) => `<div style="position:absolute;left:${x - c.x}px;top:${y - c.y}px;width:${w}px;text-align:center;font:800 ${size}px Nunito,sans-serif;color:#4A2F25;white-space:normal;line-height:11px;mix-blend-mode:multiply">${t}</div>`;
async function render(b, html, file, w, dpr) {
  const p = await b.newPage({ viewport: { width: w, height: 300 }, deviceScaleFactor: dpr });
  await p.setContent(`<html><body style="margin:0;background:#F6E9D2;font:600 13px Nunito,system-ui,sans-serif;color:${C.INK}"><svg width="0" height="0" style="position:absolute"><filter id="tintf" color-interpolation-filters="sRGB"><feColorMatrix values="1 0 0 0 0  0 .925 0 0 0  0 0 .784 0 0  0 0 0 1 0"/></filter></svg><div id="s" style="padding:14px;display:inline-block">${html}</div></body></html>`); await p.waitForTimeout(300);
  await (await p.$('#s')).screenshot({ path: path.join(OUT, file) }); await p.close();
}
(async () => {
  const b = await chromium.launch(); const sp = await b.newPage();
  /* ---------- билет: два размера кадра ---------- */
  const frames = [
    { name: '1280x720', file: 'docs/art/sections/s_1280x720_day.png', W: 1280, slot: { x: 45, y: 88, w: 49, h: 42 }, crop: { x: 36, y: 78, w: 330, h: 62 }, samp: [100, 107] },
    { name: '1024x600', file: 'docs/art/sections/s_1024x600_day.png', W: 1024, slot: { x: 41, y: 83, w: 38, h: 35 }, crop: { x: 30, y: 74, w: 270, h: 52 }, samp: [82, 90] }
  ];
  for (const fr of frames) {
    const col = await sampleColor(sp, fr.file, fr.samp[0], fr.samp[1], 1); const img = uri(fr.file);
    let cells = '';
    for (const sz of [0, 1]) for (const d of DRINKS) {
      const V = d.sizes[sz] * 1000; const m = fit(SPEC[d.key], V, fr.slot.w, fr.slot.h);
      const layers = [patch(fr.slot.x - 2, fr.slot.y - 1, fr.slot.w + 4, fr.slot.h + 2, col, 7), model(fr.slot.x, fr.slot.y, fr.slot.w, fr.slot.h, m)];
      cells += `<div>${crop(img, fr.W, fr.crop, layers)}<div style="font-size:12px;margin:3px 0 10px">${d.title}, ${String(d.sizes[sz]).replace('.', ',')} л · масштаб ${m.s.toFixed(2)}</div></div>`;
    }
    const html = `<div style="font:800 17px Nunito,sans-serif;margin-bottom:8px">Слот билета ${fr.name}: ${fr.slot.w}×${fr.slot.h} px, компактный уровень</div><div style="display:grid;grid-template-columns:repeat(3,${fr.crop.w + 4}px);gap:6px 16px">${cells}</div>`;
    const wpx = (fr.crop.w + 20) * 3 + 60;
    await render(b, html, `ticket_${PFX}slot_${fr.name}_1x.png`, wpx, 1); await render(b, html, `ticket_${PFX}slot_${fr.name}_2x.png`, wpx, 2);
    /* увеличение ×4: сам слот */
    let big = '';
    for (const d of DRINKS) for (const sz of [0, 1]) { const V = d.sizes[sz] * 1000; const m = fit(SPEC[d.key], V, fr.slot.w, fr.slot.h); big += `<div>${crop(img, fr.W, { x: fr.slot.x - 6, y: fr.slot.y - 4, w: fr.slot.w + 12, h: fr.slot.h + 8 }, [patch(fr.slot.x - 2, fr.slot.y - 1, fr.slot.w + 4, fr.slot.h + 2, col, 7), model(fr.slot.x, fr.slot.y, fr.slot.w, fr.slot.h, m)], 4)}<div style="font-size:12px">${d.title} ${d.sizes[sz]} л</div></div>`; }
    await render(b, `<div style="font:800 17px Nunito,sans-serif;margin-bottom:8px">Слот билета ${fr.name}, увеличение ×4</div><div style="display:grid;grid-template-columns:repeat(6,${(fr.slot.w + 12) * 4 + 4}px);gap:10px">${big}</div>`, `ticket_${PFX}slot_${fr.name}_zoom4.png`, 6 * ((fr.slot.w + 12) * 4 + 14) + 40, 1);
  }
  /* ---------- пузырь заказа: зал ---------- */
  const hall = path.join(SHOT, 'hall.png'); const himg = uri(hall);
  const cards = [{ l: 322, t: 215, w: 114, h: 51 }, { l: 453, t: 215, w: 113, h: 51 }, { l: 582, t: 215, w: 115, h: 51 }];
  const pick = [[DRINKS[0], 0], [DRINKS[1], 1], [DRINKS[2], 0]];
  const colors = []; for (const c of cards) colors.push(await sampleColor(sp, hall, c.l + c.w - 14, c.t + 40, 2));
  const mkBubble = (ci, d, szi, geom = 'new') => {
    const c = cards[ci]; const V = d.sizes[szi] * 1000; const slot = { x: c.l + 6, y: c.t + 5, w: 38, h: 41 };
    const m = fit(SPEC[d.key], V, slot.w, slot.h, geom);
    return [patch(c.l + 3, c.t + 3, c.w - 6, c.h - 6, colors[ci], 8), model(slot.x, slot.y, slot.w, slot.h, m, true),
      (cc) => `<div style="position:absolute;left:${c.l + 47 - cc.x}px;top:${c.t + 8 - cc.y}px;width:${c.w - 56}px;height:10px;background:#93A684;border:2px solid #4A2F25;border-radius:7px;box-sizing:content-box;mix-blend-mode:multiply;opacity:.9"></div>`,
      text(c.l + 44, c.t + 24, c.w - 50, d.title, 10)];
  };
  const hc = { x: 300, y: 195, w: 420, h: 90 };
  const l3 = [0, 1, 2].flatMap((i) => mkBubble(i, ...pick[i]));
  const l3b = [0, 1, 2].flatMap((i) => mkBubble(i, ...[pick[i][0], 1 - pick[i][1]]));
  const nm = (i, sz) => `${DRINKS[i].title.toLowerCase()} ${String(DRINKS[i].sizes[sz]).replace('.', ',')} л`;
  const html = `<div style="font:800 17px Nunito,sans-serif;margin-bottom:8px">Пузырь заказа: слот 38×41 px слева, полоска терпения и название справа</div>
   <div style="font-size:12px;margin-bottom:4px">Реальный кадр зала 1280×720: ${nm(0, 0)} · ${nm(1, 1)} · ${nm(2, 0)}</div>${crop(himg, 1280, hc, l3)}
   <div style="font-size:12px;margin:10px 0 4px">Другие размеры: ${nm(0, 1)} · ${nm(1, 0)} · ${nm(2, 1)}</div>${crop(himg, 1280, hc, l3b)}
   <div style="font-size:12px;margin:10px 0 4px">Как сейчас (для сравнения)</div>${crop(himg, 1280, hc, [])}`;
  await render(b, html, `bubble_${PFX}1x.png`, 460, 1); await render(b, html, `bubble_${PFX}2x.png`, 460, 2);
  await render(b, `<div style="font:800 17px Nunito,sans-serif;margin-bottom:8px">Пузыри, увеличение ×3</div>${crop(himg, 1280, hc, l3, 3)}`, `bubble_${PFX}zoom3.png`, 1300, 1);
  const html1024 = `<div style="font:800 17px Nunito,sans-serif;margin-bottom:8px">Пузыри при 1024×600 (кадр зала уменьшен до 0,8, слот ≈ 30×33 px)</div><div style="zoom:.8">${crop(himg, 1280, hc, l3)}</div>`;
  await render(b, html1024, `bubble_${PFX}1024x600_1x.png`, 460, 1); await render(b, html1024, `bubble_${PFX}1024x600_2x.png`, 460, 2);
  await b.close();
})();
