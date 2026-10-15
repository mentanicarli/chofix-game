// Временный генератор макетов секций бара (Б0). Не входит в сборку, код игры не трогает.
// Берёт реальные кадры из out/sec (scripts/spike/shoot-bar.cjs), палитру art-src/palette.json, части bar-parts.json.
// node scripts/spike/mockups.cjs <srcDir=out/sec> <outDir=docs/art/sections>
// Стиль A: плоские заливки, контур INK, толщины 3,5 / 3 / 2 px, палитра art-src/palette.json (без градиентов и шума).
const { chromium } = require('../../e2e/node_modules/playwright'); const fs = require('fs'); const path = require('path');
const pw = require('../../e2e/pw');
const SRC = path.resolve(process.argv[2] || 'out/sec'); const OUT = path.resolve(process.argv[3] || 'docs/art/sections');
fs.mkdirSync(OUT, { recursive: true });
const SRCU = SRC.split(path.sep).join('/');
const C = JSON.parse(fs.readFileSync('art-src/palette.json', 'utf8')).colors;
const DEFS = fs.readFileSync('src/assets/art/defs.svgf', 'utf8');
const PARTS = JSON.parse(fs.readFileSync('src/assets/art/bar-parts.json', 'utf8'));
const INK = C.INK;
const S = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const shadow = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${Math.max(5, rx * 0.16)}" fill="${C.SHADOW}" opacity=".25"/>`;
const rect = (x, y, w, h, fill, r = 0, sw = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${sw ? S(sw) : 'stroke="none"'}/>`;
const circ = (x, y, r, fill, sw = 3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${sw ? S(sw) : 'stroke="none"'}/>`;
const path_ = (d, fill, sw = 3, extra = '') => `<path d="${d}" fill="${fill}" ${sw ? S(sw) : 'stroke="none"'} ${extra}/>`;
const tube = (d, w, inner, innerW) => `<path d="${d}" fill="none" ${S(w)}/><path d="${d}" fill="none" stroke="${inner}" stroke-width="${innerW}" stroke-linecap="round"/>`;

/* ---------- названия и состав секций ---------- */
const SEC = { L: { name: 'Чайный бар', short: 'Чай' }, C: { name: 'Кофейный бар', short: 'Кофе' }, R: { name: 'Холодный бар', short: 'Холод' } };
/* предметы: id станции, название, bbox в локальных координатах секции, реальные габариты (см) для подписи шкалы */
const ITEMS = {
  L: [
    { id: 'tea', n: 'Чайная станция', box: [112, 370, 226, 136], cm: '22 × 16 × 22 (чайник), заварочный чайник 17' },
    { id: 'matcha', n: 'Набор для матчи', box: [428, 428, 266, 84], cm: 'чаша 14 × 14 × 10, венчик 11' },
    { id: 'powders', n: 'Полка порошков', box: [716, 392, 376, 118], cm: 'банки 15 × 15 × 19, весы 17 × 12' },
  ],
  R: [
    { id: 'juice', n: 'Холодильник соков и тоника', box: [66, 296, 152, 214], cm: '30 × 28 × 45' },
    { id: 'whipper', n: 'Сифон для сливочной пены', box: [262, 328, 134, 182], cm: '10 × 10 × 30' },
    { id: 'foamer', n: 'Миксер для пенок', box: [418, 344, 104, 166], cm: '12 × 12 × 35' },
    { id: 'blender', n: 'Блендер', box: [552, 288, 130, 220], cm: '20 × 20 × 45' },
    { id: 'boba', n: 'Станция бабл ти', box: [716, 388, 232, 122], cm: '40 × 25 × 25' },
    { id: 'shaker', n: 'Шейкер', box: [992, 408, 150, 100], cm: '9 × 9 × 20' },
  ],
};
const ZONES_C = [ // зоны центра из index.html (#bZones), x y w h
  ['grind', 90, 170, 140, 300], ['tamp', 260, 440, 140, 90], ['shot', 560, 296, 140, 190], ['food', 250, 626, 310, 94], ['micro', 816, 626, 232, 94],
  ['ice', 572, 626, 232, 94], ['water', 466, 296, 70, 80], ['steam', 776, 296, 100, 170], ['milk', 1066, 244, 190, 262], ['syr', 878, 170, 180, 130],
  ['pour', 540, 380, 180, 120], ['bell', 984, 470, 96, 70], ['stop', 716, 231, 48, 48],
];

/* ---------- фон боковых секций ---------- */
function wallStripes(off) { let s = ''; for (let x = off - 130; x < 1300; x += 130) s += `<rect x="${x}" y="0" width="26" height="480" fill="#E8D3B0" fill-opacity=".55"/>`; return s; }
function shelf(x, y, w) { return rect(x, y, w, 12, C.WOOD, 3) + rect(x + 8, y + 12, 8, 26, C.WOOD_SH, 2) + rect(x + w - 16, y + 12, 8, 26, C.WOOD_SH, 2); }
function tin(x, y, w, h, col, lab = C.PAPER) { return rect(x, y, w, h, col, 6) + rect(x + 4, y - 7, w - 8, 9, C.STEEL, 3, 2) + rect(x + 6, y + h * 0.38, w - 12, h * 0.26, lab, 3, 2); }
function mug(x, y, col) { return rect(x, y, 34, 30, col, 8, 2.5) + `<path d="M${x + 34} ${y + 7}h7a8 8 0 0 1 0 16h-7" fill="none" ${S(2.5)}/>`; }
function tumbler(x, y, h) { return `<path d="M${x} ${y}h26l-4 ${h}h-18z" fill="${C.GLASS}" fill-opacity=".85" ${S(2.5)}/>`; }
function plant(x, y) { return path_(`M${x - 22} ${y}h44l-6 36h-32z`, C.TERRA, 3) + path_(`M${x} ${y} C ${x - 30} ${y - 20} ${x - 24} ${y - 56} ${x - 6} ${y - 40} C ${x} ${y - 70} ${x + 26} ${y - 60} ${x + 22} ${y - 30} C ${x + 36} ${y - 28} ${x + 24} ${y - 4} ${x} ${y}z`, C.SAGE, 3); }

function backdrop(secKey) {
  const off = secKey === 'L' ? 40 : 80; // полосы обоев продолжают центр (шаг 130, у центра 60 + 130k в мировых координатах)
  let s = `<rect x="0" y="0" width="1280" height="480" fill="url(#gWall)" stroke="none"/><g stroke="none">${wallStripes(off)}</g>`;
  s += `<rect x="0" y="466" width="1280" height="254" fill="url(#gWoodTop)" stroke="none"/>`;
  s += `<rect x="0" y="466" width="1280" height="14" fill="#C98B55" stroke="none"/>`;
  s += `<path d="M0 466H1280" fill="none" ${S(3)}/>`;
  s += `<g stroke="#B67F4C" stroke-width="2" stroke-opacity=".5" fill="none"><path d="M0 540H1280M0 616H1280M0 690H1280"/></g>`;
  return s;
}
function wallDecor(secKey) {
  let s = '';
  if (secKey === 'L') {
    s += shelf(120, 214, 450);
    [[134, C.TERRA], [190, C.SAGE], [246, C.MUSTARD], [302, C.DUSTY], [358, C.PINK]].forEach(([x, c]) => { s += tin(x, 152, 46, 62, c); });
    s += mug(430, 184, C.PAPER) + mug(480, 184, C.KRAFT);
    // картина: чайный лист
    s += `<g transform="translate(700 150)">${rect(0, 0, 160, 124, C.WOOD, 8)}${rect(10, 10, 140, 104, C.KRAFT, 4, 2)}${path_('M40 90 C 50 40 100 26 124 32 C 118 70 84 92 40 90z', C.SAGE, 2.5)}${path_('M44 88 L112 40', 'none', 2)}</g>`;
    s += shelf(1000, 340, 180) + plant(1090, 296);
    s += `<g transform="translate(940 150)"><path d="M0 0V-60" fill="none" ${S(2.5)}/>${rect(-50, 0, 100, 40, C.MUSTARD, 12)}<path d="M-26 20h52" fill="none" ${S(3)}/></g>`;
  } else {
    s += shelf(320, 214, 720);
    for (let i = 0; i < 8; i++) s += tumbler(344 + i * 76, 166, 48);
    // меню-доска
    s += `<g transform="translate(1060 90)">${rect(0, 0, 176, 140, C.WOOD, 10)}${rect(10, 10, 156, 120, '#3B3A33', 6, 2)}<g stroke="${C.PAPER}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".85"><path d="M30 36h70M30 60h96M30 84h56M30 108h80"/></g></g>`;
    s += `<g transform="translate(1000 150)">${circ(0, 0, 42, C.DUSTY, 3.5)}${circ(0, 0, 30, C.GLASS, 2.5)}<path d="M0 -22V0L15 10" fill="none" ${S(3)}/></g>`; // часы
    s += plant(1180, 320) + shelf(1100, 330, 150);
    return s;
  }
  return s;
}

/* ---------- предметы левой секции ---------- */
function itemsL() {
  let s = '';
  // чайная станция: чайник с гусиной шеей, заварочный чайник, чашки
  s += shadow(172, 596, 66);
  s += rect(124, 582, 98, 12, C.STEEL_SH, 6) + rect(130, 478, 86, 106, C.STEEL, 22);
  s += rect(140, 490, 12, 74, C.STEEL_HI, 6, 0) + rect(140, 466, 66, 16, C.STEEL_HI, 8) + circ(173, 461, 7, C.DARK);
  s += tube('M132 546 C 106 546 100 500 114 468', 12, C.STEEL, 6);
  s += tube('M216 496 C 246 496 248 566 216 570', 14, C.DARK, 8);
  s += circ(173, 568, 4, C.MUSTARD, 0);
  s += shadow(290, 596, 38);
  s += `<ellipse cx="290" cy="560" rx="34" ry="30" fill="${C.KRAFT}" ${S(3)}/>` + path_('M258 560 C 238 556 236 534 252 532', 'none', 6) + path_('M322 556 C 346 552 346 580 324 578', 'none', 6);
  s += `<ellipse cx="290" cy="532" rx="18" ry="6" fill="${C.SAGE}" ${S(3)}/>` + circ(290, 524, 5, C.SAGE);
  [[350, C.PAPER], [394, C.KRAFT]].forEach(([x, c]) => { s += `<ellipse cx="${x + 16}" cy="590" rx="26" ry="6" fill="${C.KRAFT_SH}" ${S(2.5)}/>` + rect(x, 564, 32, 26, c, 9, 2.5); });
  // матча: банка, чаша, венчик, ложка
  s += shadow(570, 600, 112);
  s += rect(434, 526, 46, 60, C.SAGE_LT, 8) + rect(438, 518, 38, 12, C.DARK, 4, 2.5) + rect(442, 546, 30, 20, C.PAPER, 3, 2);
  s += `<path d="M506 556H636C636 590 612 600 571 600C530 600 506 590 506 556Z" fill="${C.PAPER}" ${S(3)}/><ellipse cx="571" cy="556" rx="65" ry="10" fill="${C.SAGE}" ${S(3)}/><path d="M528 548 C 560 540 590 542 612 546" fill="none" stroke="${C.SAGE_LT}" stroke-width="3" stroke-linecap="round"/>`;
  s += rect(546, 598, 50, 6, C.KRAFT_SH, 2, 2.5);
  s += rect(660, 528, 18, 44, C.WOOD_HI, 5) + `<path d="M652 574h34l-5 24h-24z" fill="${C.KRAFT}" ${S(3)}/><path d="M663 576V596M669 576V596M675 576V596" fill="none" ${S(2)}/>`;
  s += tube('M446 596 C 460 584 470 580 486 566', 8, C.WOOD_HI, 3);
  // порошки: три банки и весы
  s += shadow(850, 600, 130);
  s += rect(722, 506, 66, 92, C.GLASS, 10) + rect(724, 540, 62, 56, C.CHOC, 8, 0) + rect(718, 494, 74, 16, C.WOOD, 5) + rect(732, 540, 46, 22, C.PAPER, 3, 2);
  s += rect(808, 506, 66, 92, C.GLASS, 10) + rect(810, 548, 62, 48, C.WOOD_SH, 8, 0) + rect(804, 494, 74, 16, C.WOOD, 5) + rect(818, 540, 46, 22, C.PAPER, 3, 2);
  s += rect(896, 486, 88, 112, C.KRAFT, 12) + rect(892, 472, 96, 18, C.DARK, 6) + rect(906, 520, 68, 34, C.MUSTARD, 4, 2.5) + rect(916, 530, 48, 14, C.PAPER, 3, 0);
  s += rect(1010, 568, 90, 28, C.PAPER, 8) + rect(1024, 574, 40, 12, C.DARK, 3, 0) + circ(1084, 580, 5, C.MUSTARD, 2) + path_('M1002 560 h26', 'none', 6);
  return s;
}

/* ---------- предметы правой секции ---------- */
function itemsR() {
  let s = '';
  // холодильник соков и тоника
  s += shadow(140, 600, 84);
  s += rect(72, 394, 136, 204, C.STEEL, 14) + rect(82, 428, 106, 148, C.GLASS, 8) + rect(82, 404, 106, 18, C.DARK, 5, 2.5) + circ(172, 413, 4, C.MUSTARD, 0);
  s += `<path d="M110 512H166M110 546H166" fill="none" ${S(2)}/>`;
  [[94, C.MUSTARD], [118, C.TERRA], [142, C.GLASS_DP]].forEach(([x, c]) => { s += rect(x, 458, 20, 54, c, 6, 2.5) + rect(x + 5, 444, 10, 16, c, 3, 2.5); });
  [[100, C.MUSTARD], [128, C.GLASS_DP]].forEach(([x, c]) => { s += rect(x, 520, 20, 26, c, 5, 2.5); });
  s += rect(196, 470, 6, 56, C.STEEL_HI, 3, 2.5);
  // сифон
  s += shadow(300, 600, 54);
  s += rect(262, 588, 78, 10, C.WOOD_SH, 3) + rect(274, 468, 54, 122, C.STEEL, 20) + rect(280, 482, 10, 90, C.STEEL_HI, 5, 0);
  s += rect(282, 436, 38, 30, C.STEEL_SH, 6) + rect(296, 420, 10, 18, C.DARK, 3) + rect(328, 486, 22, 14, C.MUSTARD, 4, 2.5) + `<path d="M274 520H328" fill="none" ${S(2.5)}/>`;
  s += rect(352, 540, 42, 58, C.PAPER, 4) + `<path d="M352 540l21-14 21 14z" fill="${C.DUSTY}" ${S(3)}/>`;
  // миксер для пенок
  s += shadow(470, 600, 56);
  s += rect(430, 504, 60, 94, C.STEEL, 10) + rect(436, 514, 10, 70, C.STEEL_HI, 5, 0) + tube('M490 520 C 516 520 516 572 490 574', 11, C.STEEL_SH, 5);
  s += `<ellipse cx="460" cy="504" rx="30" ry="8" fill="${C.PAPER}" ${S(2.5)}/>`;
  s += rect(448, 440, 24, 46, C.TERRA, 8) + rect(454, 484, 12, 24, C.STEEL, 3, 2.5) + circ(460, 456, 5, C.MUSTARD, 2);
  // блендер
  s += shadow(616, 600, 80);
  s += rect(566, 546, 100, 52, C.TERRA, 12) + circ(616, 572, 12, C.MUSTARD) + circ(616, 572, 3, C.DARK, 0);
  s += `<path d="M574 546 L580 394 H652 L658 546 Z" fill="${C.GLASS}" fill-opacity=".9" ${S(3)}/><path d="M577 500 H655 L658 546 H574 Z" fill="${C.PAPER}" ${S(2)}/>`;
  s += rect(576, 380, 74, 16, C.DARK, 6) + tube('M658 410 C 688 410 688 500 658 504', 11, C.DARK, 5) + rect(606, 536, 20, 10, C.STEEL, 2, 2);
  // станция бабл ти: кастрюля с шариками, запайщик, стаканы, трубочки
  s += shadow(840, 602, 120);
  s += rect(724, 542, 90, 56, C.STEEL, 8) + `<ellipse cx="769" cy="542" rx="45" ry="9" fill="${C.CHOC}" ${S(3)}/>`;
  [[748, 541], [762, 545], [776, 541], [790, 545], [756, 548], [782, 549]].forEach(([x, y]) => { s += circ(x, y, 4, C.DARK, 0); });
  s += rect(726, 528, 20, 10, C.STEEL_SH, 3, 2.5) + `<path d="M798 520 C 830 506 846 520 842 546" fill="none" ${S(5)}/>`;
  s += rect(836, 502, 90, 96, C.DUSTY, 10) + rect(830, 494, 102, 18, C.STEEL, 7) + rect(852, 534, 58, 36, C.DARK, 5, 2.5) + circ(902, 516, 4, C.MUSTARD, 0) + rect(846, 576, 70, 8, C.STEEL_HI, 3, 0);
  s += `<path d="M954 598l4-96h30l4 96z" fill="${C.GLASS}" fill-opacity=".85" ${S(2.5)}/>` + rect(968, 470, 7, 34, C.PINK, 3, 2.5) + rect(978, 476, 7, 28, C.MUSTARD, 3, 2.5);
  // шейкер и мерный стаканчик
  s += shadow(1060, 600, 80);
  s += rect(1000, 590, 140, 10, C.WOOD_SH, 3) + rect(1016, 512, 44, 78, C.STEEL, 10) + `<path d="M1020 512l6-18h28l6 18z" fill="${C.STEEL_SH}" ${S(3)}/>` + rect(1030, 484, 16, 12, C.STEEL, 4, 2.5) + rect(1022, 524, 8, 52, C.STEEL_HI, 4, 0);
  s += `<path d="M1076 590l-5-50h38l-5 50z" fill="${C.GLASS}" fill-opacity=".9" ${S(2.5)}/>` + `<path d="M1118 590l-4-44h28l-4 44z" fill="${C.STEEL}" ${S(2.5)}/>`;
  return s;
}

/* ---------- сборка кадра секции ---------- */
function sectionSvg(key, opts = {}) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720"><defs>${DEFS}</defs>`;
  s += `<g ${S(3)}>`;
  s += backdrop(key) + wallDecor(key);
  s += `<g transform="translate(0 -92)">${key === 'L' ? itemsL() : itemsR()}</g>`;
  s += `<g>${PARTS.counterNose.svg}</g><g>${PARTS.counterFront.svg}</g>`;
  if (key === 'R' && opts.ghostIce) {
    s += `<g opacity=".55" transform="translate(0 0)">${PARTS.ice.svg}</g><rect x="560" y="606" width="252" height="112" rx="10" fill="none" stroke="${C.TERRA}" stroke-width="3" stroke-dasharray="10 7"/>`;
  }
  s += '</g></svg>';
  return s;
}

/* ---------- интерфейс-макет (HTML) ---------- */
const CSS = `
*{box-sizing:border-box} body{margin:0;background:#F6EAD6;font-family:Nunito,sans-serif;overflow:hidden}
.win{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.st{position:relative;width:1280px;height:720px;overflow:hidden;transform-origin:center center;flex:none}
.st>*{position:absolute;left:0;top:0}
.pill{position:absolute;display:flex;align-items:center;gap:8px;height:46px;padding:0 14px;border:3px solid ${INK};border-radius:16px;background:${C.PAPER};box-shadow:0 4px 0 ${INK};font-weight:800;font-size:16px;color:${INK};white-space:nowrap}
.pill i{width:26px;height:26px;border-radius:50%;background:${C.MUSTARD};border:2.5px solid ${INK};display:grid;place-items:center;font-style:normal;font-size:12px}
.pill.hint{box-shadow:0 0 0 5px rgba(240,188,85,.75),0 4px 0 ${INK}}
.pill.off{opacity:.45;box-shadow:0 2px 0 ${INK}}
.badge{position:absolute;width:20px;height:20px;border-radius:50%;background:${C.TERRA};border:2.5px solid ${INK}}
.mm{position:absolute;display:flex;gap:6px;padding:7px 9px;border:3px solid ${INK};border-radius:14px;background:${C.PAPER};box-shadow:0 4px 0 ${INK}}
.mm b{position:relative;width:44px;height:26px;border:2.5px solid ${INK};border-radius:8px;background:${C.KRAFT};display:block}
.mm b.cur{background:${C.MUSTARD}} .mm b.shut{display:none}
.mm b u{position:absolute;right:-5px;top:-7px;width:14px;height:14px;border-radius:50%;background:${C.TERRA};border:2px solid ${INK}}
.pic{position:absolute;width:50px;height:50px;border:3px dashed ${C.TERRA};border-radius:14px;background:rgba(255,248,236,.92);display:grid;place-items:center;font-weight:800;font-size:9.5px;color:${C.TERRA};text-align:center;line-height:1.1}
.tag{position:absolute;font:800 13px Nunito;color:${INK};background:rgba(255,248,236,.92);border:2px solid ${INK};border-radius:8px;padding:2px 6px;white-space:nowrap}
.dim{position:absolute;border:2px dashed ${C.TERRA}}
.tint{position:absolute;inset:0;mix-blend-mode:multiply;pointer-events:none}
`;
const GHOST_TAG = `<div class="tag" style="left:578px;top:652px;background:rgba(255,248,236,.95)">льдогенератор: вариант владельца</div>`;
const TINT = { day: 'rgb(255,252,246)', eve: 'rgb(244,186,140)' };
const MM_POS = { A: [598, 12], B: [1096, 74], C: [14, 654] };
const ARROW_Y = 524;

function arrowsHtml(cur, open, opts) {
  const order = ['L', 'C', 'R'].filter(k => k === 'C' || open.includes(k));
  const i = order.indexOf(cur); let h = '';
  const prev = order[i - 1], next = order[i + 1];
  const hintTo = opts.hintSec;
  if (prev) h += `<div class="pill ${opts.off ? 'off' : ''} ${hintTo === prev ? 'hint' : ''}" style="left:10px;top:${ARROW_Y}px"><i>◀</i>${SEC[prev].name}</div>` + (hintTo === prev ? `<div class="badge" style="left:2px;top:${ARROW_Y - 8}px"></div>` : '');
  if (next) { const w = SEC[next].name.length * 9.2 + 76; h += `<div class="pill ${opts.off ? 'off' : ''} ${hintTo === next ? 'hint' : ''}" style="left:${1270 - w}px;top:${ARROW_Y}px">${SEC[next].name}<i>▶</i></div>` + (hintTo === next ? `<div class="badge" style="left:${1250}px;top:${ARROW_Y - 8}px"></div>` : ''); }
  return h;
}
function minimapHtml(cur, open, pos, dotSec) {
  if (!open.length || pos === 'none') return '';
  const [x, y] = MM_POS[pos || 'A'];
  const cell = k => (k === 'C' || open.includes(k)) ? `<b class="${k === cur ? 'cur' : ''}">${dotSec === k ? '<u></u>' : ''}</b>` : '';
  const ks = ['L', 'C', 'R'].filter(k => k === 'C' || open.includes(k));
  const w = ks.length * 50 + 18;
  return `<div class="mm" style="left:${x}px;top:${y}px;width:${w}px">${ks.map(cell).join('')}</div>`;
}

async function render(browser, o) {
  const { W = 1280, H = 720 } = o;
  const cur = o.sec || 'C'; const open = o.open || ['L', 'R'];
  const bg = cur === 'C' ? `<img src="file://${SRC.replace(/\\/g, '/')}/base_center.png" width="1280" height="720">` : sectionSvg(cur, { ghostIce: o.ghostIce });
  const ui = o.ui === undefined ? (cur === 'C' ? 'ui_matcha_away' : cur === 'L' ? 'ui_matcha_here' : 'ui_nocoach') : o.ui;
  const sc = Math.min((W - 32) / 1280, (H - 18) / 720);
  let inner = `<div style="left:0;top:0">${bg}</div>`;
  inner += `<div class="tint" style="background:${TINT[o.eve ? 'eve' : 'day']}"></div>`;
  if (ui) inner += `<img src="file://${SRC.replace(/\\/g, '/')}/${ui}.png" width="1280" height="720" style="left:0;top:0">`;
  if (o.arrows !== false) inner += arrowsHtml(cur, open, { hintSec: o.hintSec, off: o.lock });
  inner += minimapHtml(cur, open, o.mm === undefined ? 'A' : o.mm, o.dotSec);
  if (o.pic) inner += `<div class="pic" style="left:${o.picX ?? 30}px;top:78px">картинка<br>(этап Н)</div>`;
  if (o.extra) inner += o.extra;
  const html = `<!doctype html><meta charset=utf-8><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Nunito"><style>${CSS}</style><div class=win><div class=st style="transform:scale(${sc})">${inner}</div></div>`;
  const p = await pw.page(browser, { width: W, height: H });
  fs.writeFileSync(path.join(SRC, '_mock.html'), html);
  await p.goto('file://' + path.join(SRC, '_mock.html')); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, o.name + '.png') });
  await p.close();
  console.log('ok', o.name);
}

/* ---------- проверка наложений (д) ---------- */
const inter = (a, b) => { const x = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])); const y = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])); return x * y; };
function overlapReport(cur, open, rects) {
  const arrows = []; const order = ['L', 'C', 'R'].filter(k => k === 'C' || open.includes(k)); const i = order.indexOf(cur);
  if (order[i - 1]) arrows.push(['стрелка «' + SEC[order[i - 1]].name + '»', [10, ARROW_Y, 178, 46 + 4]]);
  if (order[i + 1]) { const w = SEC[order[i + 1]].name.length * 9.2 + 76; arrows.push(['стрелка «' + SEC[order[i + 1]].name + '»', [1270 - w, ARROW_Y, w, 50]]); }
  const mm = ['mini A', [598, 12, 168, 44]];
  const ui = [['билет #bTk', [24, 76, 870, 54]], ['коуч #bCoach', [472, 531, 322, 89]], ['тосты #bFloat', [484, 136, 380, 42]], ['HUD слева', [24, 20, 514, 46]], ['HUD справа', [1060, 20, 196, 50]], ['слот картинки (Н)', [28, 78, 50, 50]]];
  const zones = (cur === 'C' ? ZONES_C.map(z => ['зона ' + z[0], z.slice(1)]) : (ITEMS[cur] || []).map(z => ['зона ' + z.id, z.box.map((v, k) => k > 1 ? v : v)]).map(([n, b]) => [n, [b[0], b[1], b[2], b[3]]]));
  zones.push(['нижняя полоса y 626–720', [0, 626, 1280, 94]]);
  const rows = [];
  const A = [...arrows, mm];
  for (const a of A) for (const u of [...ui, ...zones.filter(z => !z[0].startsWith('нижняя'))]) { const v = inter(a[1], u[1]); if (v > 0) rows.push([a[0], u[0], v]); }
  for (let x = 0; x < A.length; x++) for (let y = x + 1; y < A.length; y++) { const v = inter(A[x][1], A[y][1]); if (v > 0) rows.push([A[x][0], A[y][0], v]); }
  // нижняя полоса: только пересечения со стрелками и мини-картой
  for (const a of A) { const v = inter(a[1], [0, 626, 1280, 94]); if (v > 0) rows.push([a[0], 'нижняя полоса y 626–720', v]); }
  return rows;
}

(async () => {
  const b = await chromium.launch();
  const both = ['L', 'R'];
  // (а) секции, день и вечер
  for (const sec of ['L', 'C', 'R']) for (const eve of [false, true]) {
    await render(b, { name: `a_${{ L: 'left', C: 'center', R: 'right' }[sec]}_${eve ? 'eve' : 'day'}`, sec, open: both, eve, hintSec: sec === 'C' ? 'L' : undefined, dotSec: sec === 'C' ? 'L' : undefined, ghostIce: false, pic: true, extra: ''});
  }
  // (а) подписи габаритов
  for (const sec of ['L', 'R']) {
    let ex = '';
    for (const it of ITEMS[sec]) { const [x, y, w, h] = it.box; ex += `<div class="dim" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div><div class="tag" style="left:${x}px;top:${Math.max(150, y - 30)}px">${it.n} · ${it.cm} см</div>`; }
    ex += `<div class="tag" style="left:20px;top:690px">шкала 4,64 px/см · контуры 3 px · палитра art-src</div>`;
    await render(b, { name: `a_${sec === 'L' ? 'left' : 'right'}_scale`, sec, open: both, ui: null, arrows: false, mm: 'none', ghostIce: false, extra: ex });
  }
  // (б) стрелки, мини-карта
  await render(b, { name: 'b_arrows_center', sec: 'C', open: both, hintSec: 'L', dotSec: 'L' });
  for (const pos of ['A', 'B', 'C']) await render(b, { name: `b_minimap_${pos}`, sec: 'C', open: both, mm: pos, hintSec: 'L', dotSec: 'L' });
  await render(b, { name: 'b_dot_on', sec: 'C', open: both, hintSec: 'L', dotSec: 'L' });
  await render(b, { name: 'b_dot_off', sec: 'C', open: both, ui: 'ui_nocoach' });
  // (в) состояния
  await render(b, { name: 'c_state_none', sec: 'C', open: [], ui: 'ui_nocoach', arrows: true });
  await render(b, { name: 'c_state_one', sec: 'C', open: ['L'], hintSec: 'L', dotSec: 'L' });
  await render(b, { name: 'c_state_both', sec: 'C', open: both, hintSec: 'L', dotSec: 'L' });
  // (г) окно станции и инсет: листание заблокировано
  await render(b, { name: 'd_panel_matcha_left', sec: 'L', open: both, ui: 'ui_panel_matcha', lock: true, pic: true, picX: 30 });
  await render(b, { name: 'd_inset_center', sec: 'C', open: both, ui: 'ui_inset_grind', lock: true });
  await render(b, { name: 'd_ticket_open_center', sec: 'C', open: both, ui: 'ui_ticket_open', hintSec: 'L', dotSec: 'L' });
  // размеры окна
  for (const [W, H] of [[1280, 720], [1536, 864], [1024, 600]]) for (const eve of [false, true]) await render(b, { name: `s_${W}x${H}_${eve ? 'eve' : 'day'}`, W, H, sec: 'C', open: both, eve, hintSec: 'L', dotSec: 'L', pic: true });
  // (д) проверка наложений
  const report = [];
  for (const sec of ['C', 'L', 'R']) report.push([sec, overlapReport(sec, both, null)]);

  // (д) наглядные кадры наложений
  const zoneBoxes = k => k === 'C' ? ZONES_C.map(z => [z[0], z.slice(1)]) : ITEMS[k].map(z => [z.id, z.box]);
  for (const [sec, nm] of [['C', 'center'], ['L', 'left'], ['R', 'right']]) {
    let ex = '';
    for (const [n, bx] of zoneBoxes(sec)) ex += `<div class="dim" style="left:${bx[0]}px;top:${bx[1]}px;width:${bx[2]}px;height:${bx[3]}px;border-color:#2F7F7A"></div><div class="tag" style="left:${bx[0] + 2}px;top:${bx[1] + 2}px;font-size:11px;padding:0 4px;color:#2F7F7A;border-color:#2F7F7A">${n}</div>`;
    ex += `<div class="dim" style="left:0;top:626px;width:1280px;height:94px;border-color:#6A4FB3"></div><div class="tag" style="left:1000px;top:690px;font-size:11px;color:#6A4FB3;border-color:#6A4FB3">полоса y 626–720</div>`;
    for (const [n, bx] of [['билет (до 870 px)', [24, 76, 870, 54]], ['коуч', [472, 531, 322, 89]], ['тосты', [484, 136, 380, 42]], ['слот Н', [28, 78, 50, 50]]]) ex += `<div style="position:absolute;left:${bx[0]}px;top:${bx[1]}px;width:${bx[2]}px;height:${bx[3]}px;background:rgba(200,40,40,.22);outline:2px solid #C82828"></div>`;
    await render(b, { name: `e_overlap_${nm}`, sec, open: both, hintSec: sec === 'C' ? 'L' : undefined, ui: null, ghostIce: false, extra: ex });
  }
  // панорама: три секции подряд, швы и три положения камеры
  {
    const secs = [sectionSvg('L', {}), `<img src="file://${SRCU}/base_center.png" width="1280" height="720">`, sectionSvg('R', { ghostIce: false })];
    const html = `<!doctype html><meta charset=utf-8><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Nunito"><style>${CSS}body{background:#fff}</style><div style="position:relative;width:1920px;height:440px;background:#F6EAD6;overflow:hidden"><div style="position:absolute;left:0;top:40px;width:3840px;height:720px;transform:scale(.5);transform-origin:0 0;display:flex">${secs.map(x => `<div style="width:1280px;height:720px;flex:none;position:relative">${x}</div>`).join('')}<div class="tint" style="background:${TINT.day}"></div></div>` +
      [0, 1, 2].map(k => `<div style="position:absolute;left:${k * 640}px;top:40px;width:640px;height:360px;outline:4px dashed ${C.TERRA};outline-offset:-4px"></div><div class="tag" style="left:${k * 640 + 12}px;top:8px;font-size:18px">${['Чайный бар', 'Кофейный бар', 'Холодный бар'][k]} · камера ${['слева', 'в центре', 'справа'][k] ? ['0', '1280', '2560'][k] : ''}</div>`).join('') +
      `<div class="tag" style="left:12px;top:408px">мир 3840 px; кромка столешницы и фасад тумбы сплошные; обои продолжаются без шва</div></div>`;
    const p = await pw.page(b, { width: 1920, height: 440 }); fs.writeFileSync(path.join(SRC, '_pano.html'), html);
    await p.goto('file://' + path.join(SRC, '_pano.html')); await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(OUT, 'panorama.png') }); await p.close(); console.log('ok panorama');
  }
  const sz = k => sectionSvg(k, {}).length - PARTS.counterNose.svg.length - PARTS.counterFront.svg.length - DEFS.length;
  console.log('SVG bytes (фон+декор+предметы, без общих defs и тумбы): L', sz('L'), 'R', sz('R'));
  fs.writeFileSync(path.join(OUT, '_overlaps.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report));
  await b.close();
})();
