// Временный генератор макетов моделей напитков (Н0). Не входит в сборку, код игры не трогает.
// Стиль A: плоские заливки (основной тон + второй тон тени), контур INK 3,5 / 3 / 2 px на экране, палитра art-src/palette.json, без градиентов и шума на предметах.
// Геометрия стакана и керамики взята из drawShell (src/render/world/bar.ts) в «единицах бара при ×3»: стакан 0,2 л = 104 × 78.
// drinkSVG(spec, {V, level:'full'|'compact', s}) → { g, bbox } : g — содержимое SVG с началом координат в центре дна, s — итоговый масштаб (толщина линии считается как px / s).
const fs = require('fs'); const path = require('path');
const PALJ = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../art-src/palette.json'), 'utf8'));
const C = PALJ.colors; const INK = C.INK;
const cupScale = (ml) => Math.cbrt(ml / 200);

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const shade = (c, t = 0.14) => mix(c, C.SHADOW, t);   // второй тон: тот же цвет в тени, тон «цветной тени», а не серый
const light = (c, t = 0.3) => mix(c, C.HILITE, t);
const f = (n) => +n.toFixed(2);

/** Волнистая или прямая граница слоя: от x=-W до x=W на высоте y, амплитуда A (ед.), фаза ph. Возвращает точки верхней кромки. */
function edge(W, y, A, ph, step = 4) {
  const pts = [];
  for (let x = -W; x <= W + 0.01; x += step) pts.push([x, y + (A ? A * Math.sin((x / W) * 4.2 + ph) + A * 0.4 * Math.sin((x / W) * 9 + ph * 2) : 0)]);
  return pts;
}
const poly = (top, yBot, W) => 'M' + top.map((p) => f(p[0]) + ' ' + f(p[1])).join('L') + `L${f(W)} ${f(yBot)}L${f(-W)} ${f(yBot)}Z`;

/** Модель стакана или чашки. spec: { vessel:'glass'|'ceramic'|'demitas', layers:[{col, frac, edge:'sharp'|'wavy'|'soft'}], fill, top:{col, ring?, art?, spice?}, ice:n, boba:bool, bubbles:bool, hot:bool, foamCap?:bool } */
function drinkSVG(spec, o) {
  const { V, level, s } = o;
  const compact = level === 'compact';
  const k = spec.k || cupScale(V);
  const sw = (px) => f(px / s);                       // толщина линии: ровно px на экране
  const L = compact ? 2 : 3.5, M = compact ? 2 : 3, D = 2;
  let g = ''; let bb = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const grow = (x0, y0, x1, y1) => { bb = { x0: Math.min(bb.x0, x0), y0: Math.min(bb.y0, y0), x1: Math.max(bb.x1, x1), y1: Math.max(bb.y1, y1) }; };

  /* ---------- блюдце: у керамики и демитас; у стакана контактная тень ---------- */
  const shadowEl = (rx) => `<ellipse cx="2" cy="${f(3 * k)}" rx="${f(rx)}" ry="${f(3.6 * k)}" fill="${C.SHADOW}" opacity=".22"/>`;

  if (spec.vessel === 'glass') {
    const old = o.geom === 'old'; /* геометрия текущего drawShell: ширина по cupScale, высота не больше CUP_MAX_KY = 1,12 */
    const ky = old || o.geom === 'newcap' ? Math.min(k, 1.12) : k;
    const Wt = (old ? 52 : 46) * k, Wb = (old ? 42 : 36) * k, H = (old ? 78 : 80) * ky, yb = -(old ? 8 : 7) * ky, bulge = (old ? 4 : 3) * ky, ry0 = (old ? 9 : 8.5) * ky;
    const hw = (y) => Wb + (Wt - Wb) * ((yb - y) / (H + yb));      // полуширина стакана на высоте y
    const glassPath = `M${f(-Wt)} ${f(-H)}L${f(Wt)} ${f(-H)}L${f(Wb)} ${f(yb)}Q0 ${f(bulge)} ${f(-Wb)} ${f(yb)}Z`;
    if (o.saucer) { const sr = 76 * Math.max(0.85, Math.min(1.4, 0.2 + 0.8 * k)) * (old ? 1 : 0.8); g += `<ellipse cx="0" cy="7" rx="${f(sr * 0.9)}" ry="9" fill="${C.KRAFT}" stroke="${INK}" stroke-width="${sw(3)}"/><ellipse cx="0" cy="5" rx="${f(sr * 0.62)}" ry="4.6" fill="${C.KRAFT_SH}"/>`; grow(-sr * 0.9, 0, sr * 0.9, 18); } else g += shadowEl(Wt * 0.95);
    g += `<path d="${glassPath}" fill="${PALJ.glass.fill}" fill-opacity="${PALJ.glass.alpha}"/>`;
    /* толстое дно: второй тон стекла */
    const yBot = yb - 2 * k;                        // дно жидкости
    const fillF = spec.fill ?? (spec.hot ? 0.88 : 0.96);
    const Ymin = -H + 5 * k;                         // верх жидкости при «полном»
    const Ytop = yBot + (Ymin - yBot) * fillF;
    const liqH = yBot - Ytop;
    let id = 'cp' + Math.random().toString(36).slice(2, 7);
    g += `<clipPath id="${id}"><path d="${glassPath}"/></clipPath><g clip-path="url(#${id})">`;
    /* слои снизу вверх */
    const layers = spec.layers; let acc = yBot; const ytops = [];
    layers.forEach((ly, i) => {
      const h = liqH * ly.frac; const yt = acc - h;
      const col = ly.col; const wavy = !compact && ly.edge === 'wavy'; const soft = !compact && ly.edge === 'soft';
      const A = wavy ? 4.5 * k : soft ? 2.2 * k : 0; ytops[i] = yt;
      const top = i === layers.length - 1 ? edge(Wt + 4, yt, 0, 0) : edge(Wt + 4, yt, A, i * 1.7);
      g += `<path d="${poly(top, acc + 1, Wt + 4)}" fill="${col}"/>`;
      if (soft && i < layers.length - 1) { /* ступенчатый переход вместо градиента: узкая полоса среднего тона над границей */
        const nxt = layers[i + 1].col; const bh = liqH * 0.07;
        g += `<path d="${poly(edge(Wt + 4, yt - bh, A, i * 1.7 + 1), yt + A + 1, Wt + 4)}" fill="${mix(col, nxt, 0.5)}"/>`;
      }
      acc = yt;
    });
    if (spec.swirl && !compact) { /* языки верхнего слоя вниз в нижний: размытая граница бамбла */
      const yb0 = ytops[spec.swirl.from]; const col = layers[spec.swirl.from + 1].col; const d = liqH * 0.17;
      [[-0.62, 0.8], [-0.12, 1.15], [0.55, 0.9]].forEach(([ux, sc]) => { const x = ux * Wb; const w = 3.4 * k, dd = liqH * 0.17 * sc; g += `<path d="M${f(x - w)} ${f(yb0 - 3)}C${f(x - w * 0.9)} ${f(yb0 + dd * 0.6)} ${f(x - w * 0.3)} ${f(yb0 + dd)} ${f(x)} ${f(yb0 + dd)}C${f(x + w * 0.3)} ${f(yb0 + dd)} ${f(x + w * 0.9)} ${f(yb0 + dd * 0.6)} ${f(x + w)} ${f(yb0 - 3)}Z" fill="${col}"/>`; });
    }
    /* второй тон: тень справа */
    g += `<path d="M${f(Wt * 0.5)} ${f(-H)}L${f(Wt)} ${f(-H)}L${f(Wb)} ${f(yb)}L${f(Wb * 0.55)} ${f(yb)}Z" fill="${C.SHADOW}" opacity=".09"/>`;
    /* дно: толстое стекло */
    g += `<path d="M${f(-Wb)} ${f(yb - 4 * k)}L${f(Wb)} ${f(yb - 4 * k)}L${f(Wb)} ${f(yb)}Q0 ${f(bulge)} ${f(-Wb)} ${f(yb)}Z" fill="${C.GLASS_DP}" fill-opacity=".55"/>`;
    g += `</g>`;
    /* поверхность напитка */
    const rxS = hw(Ytop) - 3, ryS = ry0 * (rxS / Wt);
    const topCol = spec.top?.col || layers[layers.length - 1].col;
    if (spec.top !== null) {
      g += `<ellipse cx="0" cy="${f(Ytop)}" rx="${f(rxS)}" ry="${f(ryS)}" fill="${light(topCol, 0.25)}" stroke="${shade(topCol, 0.3)}" stroke-width="${sw(1.6)}"/>`;
      if (spec.top?.art && !compact) g += heart(0, Ytop, rxS, ryS, spec.top.art, k);
      if (spec.top?.spice && !compact) for (let i = 0; i < 9; i++) { const a = i * 2.4; g += `<circle cx="${f(Math.cos(a) * rxS * 0.6 * ((i % 3) / 2 + 0.3))}" cy="${f(Ytop + Math.sin(a) * ryS * 0.55)}" r="${f(1.3)}" fill="${C.CHOC}"/>`; }
    }
    /* лёд: кубики, часть выступает над поверхностью */
    if (spec.ice) {
      const lb = []; let a2 = yBot; layers.forEach((ly, i) => { const h2 = liqH * ly.frac; lb.push({ yt: a2 - h2, yb: a2, col: ly.col, h: h2 }); a2 -= h2; });
      g += spec.iceStyle === 'old' ? iceCubesOld(spec.ice, Wt, Wb, Ytop, yBot, k, compact, sw, hw) : iceCubes({ n: spec.ice, Ytop, yBot, k, compact, sw, hw, lb, Wt });
    }
    if (spec.boba) g += boba(Wb, yb, k, compact);
    if (spec.bubbles && !compact) for (let i = 0; i < 9; i++) g += `<circle cx="${f(((i * 37) % 70 - 35) * k * 0.9)}" cy="${f(yBot - 8 - ((i * 53) % 40) * k * 0.9)}" r="${f(1.8)}" fill="#FFFFFF" fill-opacity=".7" stroke="${C.GLASS_DP}" stroke-width="${sw(0.8)}"/>`;
    /* контур стакана */
    g += `<path d="M${f(-Wt)} ${f(-H)}L${f(-Wb)} ${f(yb)}Q0 ${f(bulge)} ${f(Wb)} ${f(yb)}L${f(Wt)} ${f(-H)}" fill="none" stroke="${INK}" stroke-width="${sw(M)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    g += `<ellipse cx="0" cy="${f(-H)}" rx="${f(Wt)}" ry="${f(ry0)}" fill="none" stroke="${INK}" stroke-width="${sw(D)}"/>`;
    if (!compact) g += `<path d="M${f(-Wt * 0.8)} ${f(-H * 0.8)}L${f(-Wb * 0.85)} ${f(-H * 0.2)}" stroke="#fff" stroke-opacity=".7" stroke-width="${sw(3)}" stroke-linecap="round"/>`;
    grow(-Wt, -H - ry0 - 1, Wt, bulge + 8 * k);
    if (spec.ice) grow(-Wt, -H - ry0 - 8 * k, Wt, 0);
  } else if (spec.vessel === 'ceramic') {
    const W = 55 * k, Wb = W * 0.78, H = 75 * k, yb = -8 * k, ryR = 14 * k;
    const side = (cmd) => `M${f(-W)} ${f(-H)}C${f(-W * 1.03)} ${f(-H * 0.5)} ${f(-Wb * 1.1)} ${f(-H * 0.1)} ${f(-Wb)} ${f(yb)}Q0 ${f(4 * k)} ${f(Wb)} ${f(yb)}C${f(Wb * 1.1)} ${f(-H * 0.1)} ${f(W * 1.03)} ${f(-H * 0.5)} ${f(W)} ${f(-H)}${cmd}`;
    const reach = 26 * k, th = 6 * Math.min(k, 1.2), hx = W - 3, y0 = -H * 0.8, y1 = -H * 0.26;
    const hp = `M${f(hx)} ${f(y0)}C${f(hx + reach)} ${f(y0 - 6 * k)} ${f(hx + reach)} ${f(y1 + 4 * k)} ${f(hx - 3)} ${f(y1)}`;
    /* блюдце */
    const sr = compact ? W * 1.15 : 76 * Math.max(0.85, Math.min(1.4, (0.2 + 0.8 * k)));
    g += `<ellipse cx="0" cy="7" rx="${f(sr * 0.9)}" ry="10" fill="${C.KRAFT}" stroke="${INK}" stroke-width="${sw(M)}"/><ellipse cx="0" cy="5" rx="${f(sr * 0.62)}" ry="5" fill="${C.KRAFT_SH}"/>`;
    g += `<path d="${hp}" fill="none" stroke="${INK}" stroke-width="${sw(th * 0 + 6 * Math.min(k, 1.2) + 2 * M)}" stroke-linecap="round"/><path d="${hp}" fill="none" stroke="${C.PAPER}" stroke-width="${sw(6 * Math.min(k, 1.2))}" stroke-linecap="round"/>`;
    g += `<path d="${side('Z')}" fill="${C.PAPER}"/>`;
    g += `<path d="M${f(W * 0.55)} ${f(-H * 0.98)}L${f(W)} ${f(-H)}C${f(W * 1.03)} ${f(-H * 0.5)} ${f(Wb * 1.1)} ${f(-H * 0.1)} ${f(Wb)} ${f(yb)}Q${f(Wb * 0.4)} ${f(k)} ${f(Wb * 0.15)} 0C${f(Wb * 0.5)} ${f(-H * 0.3)} ${f(W * 0.72)} ${f(-H * 0.62)} ${f(W * 0.55)} ${f(-H * 0.98)}Z" fill="${C.KRAFT_SH}"/>`;
    g += `<path d="${side('')}" fill="none" stroke="${INK}" stroke-width="${sw(M)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    /* обод и поверхность */
    g += `<ellipse cx="0" cy="${f(-H)}" rx="${f(W)}" ry="${f(ryR)}" fill="${C.CER_IN}" stroke="${INK}" stroke-width="${sw(M)}"/>`;
    g += `<ellipse cx="0" cy="${f(-H + 1.5 * k)}" rx="${f(W - 5 * k)}" ry="${f(ryR - 3 * k)}" fill="${C.CER_IN_DP}"/>`;
    const surf = spec.top; const lvl = spec.fill ?? 0.9;
    const rxS = (W - 6 * k) * (0.88 + 0.12 * lvl), ryS = (ryR - 3.5 * k) * (0.9 + 0.1 * lvl), cyS = -H + (3 + (1 - lvl) * 9) * k;
    if (surf) {
      g += `<ellipse cx="0" cy="${f(cyS)}" rx="${f(rxS)}" ry="${f(ryS)}" fill="${surf.ring || surf.col}"/>`;
      if (surf.ring) g += `<ellipse cx="0" cy="${f(cyS)}" rx="${f(rxS * 0.82)}" ry="${f(ryS * 0.8)}" fill="${surf.col}"/>`;
      if (surf.art && !compact) g += heart(0, cyS, rxS, ryS, surf.art, k);
      if (surf.spice && !compact) for (let i = 0; i < 11; i++) { const a = i * 2.3; g += `<circle cx="${f(Math.cos(a) * rxS * 0.7 * ((i % 4) / 3 + 0.25))}" cy="${f(cyS + Math.sin(a) * ryS * 0.6)}" r="1.4" fill="${C.CHOC}"/>`; }
    }
    g += `<path d="M${f(-W * 0.82)} ${f(-H * 0.8)}Q${f(-W * 0.88)} ${f(-H * 0.45)} ${f(-Wb * 0.88)} ${f(-H * 0.2)}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="${sw(3)}" stroke-linecap="round"/>`;
    grow(-sr * 0.9, -H - ryR - 2, sr * 0.9 + 4, 18); grow(-W, -H - ryR, W + reach + 6, 0);
  } else if (spec.vessel === 'demitas') {
    /* демитас: тюльпан, маленькая ручка, блюдце; k — собственный масштаб (0,62 / 0,70), не cupScale */
    const W = 40 * k, Wb = 24 * k, H = 52 * k, yb = -7 * k, ryR = 10 * k;
    const side = (cmd) => `M${f(-W)} ${f(-H)}C${f(-W * 1.04)} ${f(-H * 0.45)} ${f(-Wb * 1.5)} ${f(-H * 0.1)} ${f(-Wb)} ${f(yb)}Q0 ${f(3 * k)} ${f(Wb)} ${f(yb)}C${f(Wb * 1.5)} ${f(-H * 0.1)} ${f(W * 1.04)} ${f(-H * 0.45)} ${f(W)} ${f(-H)}${cmd}`;
    const reach = 22 * k, hx = W - 2, y0 = -H * 0.82, y1 = -H * 0.3;
    const hp = `M${f(hx)} ${f(y0)}C${f(hx + reach)} ${f(y0 - 4 * k)} ${f(hx + reach)} ${f(y1 + 3 * k)} ${f(hx - 3)} ${f(y1)}`;
    const sr = 62 * k * 1.12;
    g += `<ellipse cx="0" cy="${f(5 * k)}" rx="${f(sr)}" ry="${f(8 * k)}" fill="${C.KRAFT}" stroke="${INK}" stroke-width="${sw(M)}"/><ellipse cx="0" cy="${f(3.5 * k)}" rx="${f(sr * 0.58)}" ry="${f(3.6 * k)}" fill="${C.KRAFT_SH}"/>`;
    g += `<path d="${hp}" fill="none" stroke="${INK}" stroke-width="${sw(4.2 + 2 * M)}" stroke-linecap="round"/><path d="${hp}" fill="none" stroke="${C.PAPER}" stroke-width="${sw(4.2)}" stroke-linecap="round"/>`;
    g += `<path d="${side('Z')}" fill="${C.PAPER}"/>`;
    g += `<path d="M${f(W * 0.5)} ${f(-H * 0.98)}L${f(W)} ${f(-H)}C${f(W * 1.04)} ${f(-H * 0.45)} ${f(Wb * 1.5)} ${f(-H * 0.1)} ${f(Wb)} ${f(yb)}Q${f(Wb * 0.4)} ${f(k)} ${f(Wb * 0.1)} 0C${f(Wb * 0.6)} ${f(-H * 0.3)} ${f(W * 0.7)} ${f(-H * 0.6)} ${f(W * 0.5)} ${f(-H * 0.98)}Z" fill="${C.KRAFT_SH}"/>`;
    g += `<path d="${side('')}" fill="none" stroke="${INK}" stroke-width="${sw(M)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    g += `<ellipse cx="0" cy="${f(-H)}" rx="${f(W)}" ry="${f(ryR)}" fill="${C.CER_IN}" stroke="${INK}" stroke-width="${sw(M)}"/>`;
    g += `<ellipse cx="0" cy="${f(-H + 1.4 * k)}" rx="${f(W - 4 * k)}" ry="${f(ryR - 2.6 * k)}" fill="#5A3A2A"/>`;
    if (!compact) g += `<ellipse cx="0" cy="${f(-H + 1.4 * k)}" rx="${f(W - 4 * k)}" ry="${f(ryR - 2.6 * k)}" fill="none" stroke="#C99B6E" stroke-width="${sw(3)}"/><ellipse cx="${f(-W * 0.18)}" cy="${f(-H + 1 * k)}" rx="${f(W * 0.35)}" ry="${f(ryR * 0.35)}" fill="#C99B6E" opacity=".55"/>`;
    g += `<path d="M${f(-W * 0.8)} ${f(-H * 0.8)}Q${f(-W * 0.86)} ${f(-H * 0.45)} ${f(-Wb * 1.0)} ${f(-H * 0.22)}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="${sw(2.4)}" stroke-linecap="round"/>`;
    grow(-sr, -H - ryR - 2, sr + 2, 14 * k); grow(-W, -H, W + reach + 5, 0);
  }
  /* маркер горячего: два завитка пара (компактный уровень и книга: на бару пар рисует сцена) */
  if (spec.hot && spec.steamMark !== false) {
    const top = bb.y0 - 3; const sx = (spec.vessel === 'ceramic' ? 0 : 0);
    const w = compact ? 5 : 8, hh = compact ? 10 : 18;
    [-1, 1].forEach((d, i) => { g += `<path d="M${f(sx + d * w * 1.3)} ${f(top)}q${f(-w * d * 0.9)} ${f(-hh * 0.4)} 0 ${f(-hh * 0.6)}t0 ${f(-hh * 0.6)}" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="${sw(compact ? 2 : 2.4)}" stroke-linecap="round"/>`; });
    grow(-w * 2.6, top - hh * 1.3, w * 2.6, top);
  }
  return { g, bbox: bb };
}

/** Латте-арт: сердце (тюльпан из двух сердец) на поверхности — светлая пенка по тёмному. */
function heart(cx, cy, rx, ry, col) {
  const c = typeof col === 'string' ? col : C.PAPER;
  const h = (t, y) => `<path d="M0 ${f(y + 9 * t)}C${f(-13 * t)} ${f(y + 1 * t)} ${f(-10 * t)} ${f(y - 9 * t)} 0 ${f(y - 3 * t)}C${f(10 * t)} ${f(y - 9 * t)} ${f(13 * t)} ${f(y + 1 * t)} 0 ${f(y + 9 * t)}Z" fill="${c}"/>`;
  return `<g transform="translate(${f(cx)} ${f(cy)}) scale(${f(rx / 22)} ${f(ry / 11)})">${h(1, 0)}${h(0.55, 2.2)}</g>`;
}

function iceCubesOld(n, Wt, Wb, Ytop, yBot, k, compact, sw, hw) {
  const cubes = compact ? [[-0.3, 0.55, 15, -10], [0.28, 0.45, 14, 12], [0.0, 0.8, 13, 4]] : [[-0.45, 0.02, 22, -10], [0.12, -0.08, 24, 9], [-0.12, 0.38, 22, -6], [0.5, 0.42, 20, 14], [-0.5, 0.7, 20, 8], [0.1, 0.82, 21, -8]];
  let o = '';
  cubes.slice(0, compact ? 3 : n).forEach(([ux, uy, sz, rot]) => {
    const y = Ytop + (yBot - Ytop) * uy; const x = ux * (hw(y) - 8 * k); const s = sz * k * (compact ? 1.1 : 1);
    o += `<g transform="translate(${f(x)} ${f(y)}) rotate(${rot})"><rect x="${f(-s / 2)}" y="${f(-s / 2)}" width="${f(s)}" height="${f(s)}" rx="${f(4 * k)}" fill="#fff" fill-opacity=".58" stroke="#B8D9DE" stroke-width="${sw(compact ? 1.4 : 2)}"/>${compact ? '' : `<path d="M${f(-s * 0.3)} ${f(-s * 0.18)}h${f(s * 0.22)}" stroke="#fff" stroke-width="${sw(2)}" stroke-linecap="round"/>`}</g>`;
  });
  return o;
}
/**
 * Лёд по правилу владельца (16.10.2026): кубики полупрозрачные, без белой заливки. Внутри жидкости заливка = цвет слоя, светлее на 15 %, прозрачность 0,32;
 * над жидкостью (воздух, пена) светло-голубая прозрачность 0,4. Контур 2 px серо-голубой (из DUSTY и HILITE), один короткий блик на кубик.
 * Кубик внутри слоя не выше трети высоты слоя; 4–5 кубиков (4 до 0,3 л, 5 с 0,4 л); кубики на поверхности наполовину над жидкостью.
 * Компактный уровень: 2–3 светлых блика-точки.
 */
function iceCubes({ n, Ytop, yBot, k, compact, sw, hw, lb }) {
  const EDGE = mix(C.DUSTY, C.HILITE, 0.12);
  if (compact) {
    const lbw = lb.slice().sort((a, b) => b.h - a.h)[0];
    return [[-0.45, 0.35], [0.1, 0.62], [0.5, 0.3]].map(([ux, uy]) => { const y = lbw.yt + lbw.h * uy; return `<circle cx="${f(ux * (hw(y) - 10 * k))}" cy="${f(y)}" r="${sw(1.4)}" fill="${C.HILITE}" fill-opacity=".85"/>`; }).join('');
  }
  const big = lb.slice().sort((a, b) => b.h - a.h)[0];
  const topH = lb[lb.length - 1].h;
  /* кубик на поверхности: в жидкости не больше трети высоты верхнего слоя (и не больше 40 % своей высоты), остальное над ней */
  const surf = (ux, sz, r) => { const inn = Math.min(0.4 * sz, 0.33 * topH); return { ux, y: Ytop + inn - sz / 2, s: sz, r, air: true }; };
  const cubes = [
    surf(-0.42, 20 * k, -10), surf(0.22, 18 * k, 12), surf(0.64, 15 * k, -6),
    { ux: -0.55, y: big.yt + big.h * 0.5, s: Math.min(12 * k, 0.33 * big.h), r: 8 },
    { ux: 0.1, y: big.yt + big.h * 0.6, s: Math.min(11 * k, 0.33 * big.h), r: -12 }
  ].slice(0, Math.min(5, Math.max(4, n)));
  let o = ''; let id = 0;
  const cid = 'ic' + Math.random().toString(36).slice(2, 6);
  o += `<clipPath id="${cid}a"><rect x="-300" y="-300" width="600" height="${f(300 + Ytop)}"/></clipPath><clipPath id="${cid}b"><rect x="-300" y="${f(Ytop)}" width="600" height="400"/></clipPath>`;
  cubes.forEach((c) => {
    if (c.s < 7) return;
    const x = c.ux * (hw(c.y) - 9 * k);
    const layer = lb.find((l) => c.y >= l.yt && c.y <= l.yb) || lb[lb.length - 1];
    const yIn = Math.max(c.y, Ytop + 2);
    const inLayer = lb.find((l) => yIn >= l.yt && yIn <= l.yb) || lb[lb.length - 1];
    const body = (fill, op) => `<rect x="${f(-c.s / 2)}" y="${f(-c.s / 2)}" width="${f(c.s)}" height="${f(c.s)}" rx="${f(3 * k)}" fill="${fill}" fill-opacity="${op}" stroke="${EDGE}" stroke-opacity=".95" stroke-width="${sw(2)}"/>`;
    const hi = `<path d="M${f(-c.s * 0.32)} ${f(-c.s * 0.28)}h${f(c.s * 0.28)}" stroke="${C.HILITE}" stroke-opacity=".9" stroke-width="${sw(2)}" stroke-linecap="round" fill="none"/>`;
    if (c.air) {
      o += `<g clip-path="url(#${cid}a)"><g transform="translate(${f(x)} ${f(c.y)}) rotate(${c.r})">${body('#DCEBEA', 0.4)}</g></g>`;
      o += `<g clip-path="url(#${cid}b)"><g transform="translate(${f(x)} ${f(c.y)}) rotate(${c.r})">${body(light(inLayer.col, 0.2), 0.4)}</g></g>`;
      o += `<g transform="translate(${f(x)} ${f(c.y)}) rotate(${c.r})">${hi}</g>`;
    } else o += `<g transform="translate(${f(x)} ${f(c.y)}) rotate(${c.r})">${body(light(layer.col, 0.2), 0.4)}${hi}</g>`;
  });
  return o;
}
function boba(Wb, yb, k, compact) { let o = ''; const n = compact ? 4 : 7; for (let i = 0; i < n; i++) { const x = (-0.8 + (1.6 * i) / (n - 1)) * (Wb - 8 * k); o += `<circle cx="${f(x)}" cy="${f(yb - 8 * k - (i % 2) * 4 * k)}" r="${f(5.2 * k)}" fill="#3A2A24" stroke="${INK}" stroke-width=".8"/>`; } return o; }

module.exports = { drinkSVG, C, INK, PALJ, cupScale, mix, shade, light };
