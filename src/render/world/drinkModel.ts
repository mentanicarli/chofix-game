/**
 * Отрисовка модели напитка (Н1-2): из `DrinkSpec` (src/game/drinkModel.ts) строит SVG-разметку для DOM (билет) и для Pixi (`raster`: бар, пузырь).
 * Геометрия одна: SVG-строка и текстуры Pixi получаются из одних и тех же функций, поэтому расходиться им нечему.
 * Стиль A: плоские заливки (основной тон и второй тон «цветной тени»), контур INK 3 / 2 px на экране (толщина считается как px / масштаб),
 * цвета из art-src/palette.json. Два уровня: full (бар, книга) и compact (билет, пузырь).
 * Разметка делится на четыре слоя снизу вверх: back (блюдце, корпус), liquid (жидкость и поверхность), ice (лёд), front (контур, блик).
 * В баре слой liquid рисуется вживую (налив), остальные — текстурами.
 */
import PAL from '../../../art-src/palette.json';
import { HEIGHT_CAP, mixColor, type DrinkSpec, type Layer, type Lod, type VesselSpec } from '../../game/drinkModel';

const COLORS = PAL.colors as Record<string, string>;
const col = (name: string): string => COLORS[name] as string;
const INK = col('INK');
const f2 = (n: number): number => Math.round(n * 100) / 100;

/* ---------- геометрия ---------- */

export interface GlassGeom { kind: 'glass'; k: number; ky: number; Wt: number; Wb: number; H: number; yb: number; bulge: number; ry: number; yBot: number; yTop: number }
export interface CeramicGeom { kind: 'ceramic'; k: number; ky: number; W: number; Wb: number; H: number; yb: number; ryR: number; reach: number }
export interface DemitasGeom { kind: 'demitas'; k: number; W: number; Wb: number; H: number; yb: number; ryR: number; reach: number }
export type Geom = GlassGeom | CeramicGeom | DemitasGeom;

/** Геометрия посуды в единицах модели при k = 1 (0,2 л): стакан 92 / 72 / 80, керамика как `drawShell`, демитас тюльпан. Высота обрезана потолком HEIGHT_CAP. */
export function geomOf(v: VesselSpec): Geom {
  const k = v.k;
  if (v.material === 'glass') {
    const ky = Math.min(k, HEIGHT_CAP);
    return { kind: 'glass', k, ky, Wt: 46 * k, Wb: 36 * k, H: 80 * ky, yb: -7 * ky, bulge: 3 * ky, ry: 8.5 * ky, yBot: -9 * ky, yTop: -80 * ky + 5 * ky };
  }
  if (v.material === 'ceramic') {
    const ky = Math.min(k, HEIGHT_CAP);
    return { kind: 'ceramic', k, ky, W: 55 * k, Wb: 55 * k * 0.78, H: 75 * ky, yb: -8 * ky, ryR: 14 * ky, reach: 26 * k };
  }
  return { kind: 'demitas', k, W: 40 * k, Wb: 24 * k, H: 52 * k, yb: -7 * k, ryR: 10 * k, reach: 22 * k };
}
/** Масштаб единиц модели в px на баре при ×2,5 (решение владельца): стакан 0,942 (ширина верха 0,2 л = 104 · 5/6 при 92 ед.), керамика и демитас 5/6. */
export const BAR_UNIT: Readonly<Record<VesselSpec['material'], number>> = { glass: (2.5 / 3) * (104 / 92), ceramic: 2.5 / 3, demitas: 2.5 / 3 };
/** Полуширина стакана на высоте y (линейно между дном и верхом). */
export const glassHalfWidth = (g: GlassGeom, y: number): number => g.Wb + (g.Wt - g.Wb) * ((g.yb - y) / (g.H + g.yb));
/** Контур стакана для маски и клипа. */
export const glassPath = (g: GlassGeom): string =>
  `M${f2(-g.Wt)} ${f2(-g.H)}L${f2(g.Wt)} ${f2(-g.H)}L${f2(g.Wb)} ${f2(g.yb)}Q0 ${f2(g.bulge)} ${f2(-g.Wb)} ${f2(g.yb)}Z`;

/* ---------- детерминированный PRNG ---------- */

/** Хэш строки (FNV-1a) для seed. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** mulberry32: последовательность из seed без Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- лёд v3 ---------- */

export interface IceHighlight { dx: number; dy: number; len: number }
export interface IceCube { x: number; y: number; s: number; rot: number; back: boolean; over: boolean; hl: IceHighlight | null }
/** Seed льда: хэш «id напитка | размер». */
export const iceSeed = (spec: DrinkSpec): number => hashSeed(`${spec.id}|${spec.size}`);
/**
 * Кубики льда стакана (полный уровень): сетка по `spec.ice`, равномерно от дна до верха; поворот ±25°, размер ±15 %, ряды сдвинуты на полкубика ±4 px,
 * верхний ряд неровный и 1–2 кубика выступают над ободом; часть кубиков на заднем плане (светлее, без контура); блики разной длины, у части их нет.
 * Все случайные величины из seeded PRNG (один seed — одна геометрия). Чистая функция: тесты проверяют детерминизм и границы.
 */
export function iceCubes(spec: DrinkSpec, g: GlassGeom): IceCube[] {
  const { rows, cols } = spec.ice;
  if (rows <= 0 || cols <= 0) return [];
  const rnd = mulberry32(iceSeed(spec));
  const zone = g.yBot - g.yTop;
  const s0 = Math.max(18, Math.min(34, zone / (rows * 0.88)));
  const yTopRow = g.yTop - 0.1 * s0;
  const yBotRow = g.yBot - 0.5 * s0 + 1;
  const pitch = rows > 1 ? (yBotRow - yTopRow) / (rows - 1) : 0;
  const innerW = (g.Wt + g.Wb) - 6 * g.k;
  const colSpan = innerW / cols;
  const s = Math.min(s0 * 1.35, Math.max(s0, colSpan * 0.66));
  const out: IceCube[] = [];
  const nOver = rnd() < 0.5 ? 1 : 2;
  const overCols = new Set<number>();
  while (overCols.size < nOver) overCols.add(Math.floor(rnd() * cols));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const size = s * (0.85 + 0.3 * rnd());
      const rot = (rnd() * 2 - 1) * 25;
      const over = r === 0 && overCols.has(c);
      let y = yTopRow + r * pitch + (rnd() * 2 - 1) * (r === 0 ? 0.22 : 0.1) * size;
      if (over) y = -g.H - 0.05 * size - rnd() * 0.12 * size;
      else y = Math.min(y, g.yb - 0.62 * size); /* нижний ряд не ниже дна (с запасом на поворот) */
      const stagger = (r % 2 ? 0.5 : -0.5) * 0.5 * colSpan * 0.5 + (rnd() * 2 - 1) * 4;
      const wy = glassHalfWidth(g, Math.min(y, g.yb)) - 3 - size * 0.5;
      const x = Math.max(-wy, Math.min(wy, (c - (cols - 1) / 2) * colSpan + stagger));
      const back = !over && rnd() < 0.42;
      const hl: IceHighlight | null = rnd() < 0.4 ? null : { dx: -0.34 + rnd() * 0.2, dy: -0.32 + rnd() * 0.12, len: 0.16 + rnd() * 0.24 };
      out.push({ x, y, s: size, rot, back, over, hl });
    }
  }
  return out;
}

const ICE_EDGE = mixColor(col('DUSTY'), col('HILITE'), 0.12);
const ICE_AIR = '#DCEBEA';

function iceSvg(cubes: readonly IceCube[], sw: (px: number) => number): string {
  const body = (c: IceCube, fill: string, fo: number, edge: boolean): string => {
    const h = f2(c.s / 2);
    const hi = !edge || !c.hl ? '' : `<path d="M${f2(c.hl.dx * c.s)} ${f2(c.hl.dy * c.s)}h${f2(c.hl.len * c.s)}" stroke="${col('HILITE')}" stroke-opacity=".9" stroke-width="${f2(sw(2))}" stroke-linecap="round" fill="none"/>`;
    const strokeAttr = edge ? ` stroke="${ICE_EDGE}" stroke-opacity=".9" stroke-width="${f2(sw(2))}"` : '';
    return `<g transform="translate(${f2(c.x)} ${f2(c.y)}) rotate(${f2(c.rot)})"><rect x="${-h}" y="${-h}" width="${f2(c.s)}" height="${f2(c.s)}" rx="${f2(c.s * 0.14)}" fill="${fill}" fill-opacity="${fo}"${strokeAttr}/>${hi}</g>`;
  };
  /* два слоя глубины: задние светлее, прозрачнее и без контура, передние с контуром 2 px */
  return cubes.filter((c) => c.back).map((c) => body(c, '#EEF6F5', 0.16, false)).join('') + cubes.filter((c) => !c.back).map((c) => body(c, ICE_AIR, 0.24, true)).join('');
}

/** Компактный уровень: легкая светлая полупрозрачная решётка мелких квадратов и две точки бликов; отдельных кубиков нет. */
function iceLatticeSvg(spec: DrinkSpec, g: GlassGeom, sw: (px: number) => number): string {
  const rows = Math.min(4, spec.ice.rows + 1);
  const cols = spec.ice.cols;
  const q = 12;
  const top = g.yTop + 5;
  const bot = g.yBot - 6;
  let o = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const y = top + (bot - top) * (r / Math.max(1, rows - 1));
      const w = glassHalfWidth(g, y) - 8;
      const x = (c - (cols - 1) / 2) * ((2 * w) / cols) + (r % 2 ? 0.25 : -0.25) * (w / cols);
      o += `<rect x="${f2(x - q / 2)}" y="${f2(y - q / 2)}" width="${q}" height="${q}" rx="${f2(q * 0.28)}" fill="${col('HILITE')}" fill-opacity=".28" stroke="${ICE_EDGE}" stroke-opacity=".7" stroke-width="${f2(sw(1))}"/>`;
    }
  }
  for (const [ux, uy] of [[-0.35, 0.3], [0.3, 0.55]] as const) {
    const y = top + (bot - top) * uy;
    o += `<circle cx="${f2(ux * (glassHalfWidth(g, y) - 8))}" cy="${f2(y)}" r="${f2(sw(1.4))}" fill="${col('HILITE')}" fill-opacity=".9"/>`;
  }
  return o;
}

/* ---------- слои жидкости ---------- */

const shade = (c: string, t = 0.14): string => mixColor(c, col('SHADOW'), t);
const light = (c: string, t = 0.3): string => mixColor(c, col('HILITE'), t);

function edgePoints(W: number, y: number, A: number, ph: number, step = 4): string {
  const pts: string[] = [];
  for (let x = -W; x <= W + 0.01; x += step) {
    const dy = A ? A * Math.sin((x / W) * 4.2 + ph) + A * 0.4 * Math.sin((x / W) * 9 + ph * 2) : 0;
    pts.push(`${f2(x)} ${f2(y + dy)}`);
  }
  return pts.join('L');
}
const layerPoly = (top: string, yBot: number, W: number): string => `M${top}L${f2(W)} ${f2(yBot)}L${f2(-W)} ${f2(yBot)}Z`;

/** Слои спецификации стакана от yBot вверх до уровня fill; границы sharp / step / wavy; языки в бамбле. Только полный уровень умеет step и wavy. */
function glassLiquidSvg(spec: DrinkSpec, g: GlassGeom, fill: number, compact: boolean, sw: (px: number) => number): { svg: string; yTop: number } {
  const layers = spec.liquid;
  const span = g.yBot - g.yTop;
  const yTopLiq = g.yBot - span * fill;
  const liqH = g.yBot - yTopLiq;
  const W = g.Wt + 4;
  let acc = g.yBot;
  const tops: number[] = [];
  let o = '';
  layers.forEach((ly, i) => {
    const h = liqH * ly.frac;
    const yt = acc - h;
    tops[i] = yt;
    const wavy = !compact && ly.edge === 'wavy';
    const step = !compact && ly.edge === 'step';
    const A = wavy ? 4.5 * g.k : step ? 2.2 * g.k : 0;
    const topEdge = i === layers.length - 1 ? edgePoints(W, yt, 0, 0) : edgePoints(W, yt, A, i * 1.7);
    o += `<path d="${layerPoly(topEdge, acc + 1, W)}" fill="${ly.color}"/>`;
    if (step && i < layers.length - 1) {
      const next = (layers[i + 1] as Layer).color;
      const bh = liqH * 0.07;
      o += `<path d="${layerPoly(edgePoints(W, yt - bh, A, i * 1.7 + 1), yt + A + 1, W)}" fill="${mixColor(ly.color, next, 0.5)}"/>`;
    }
    acc = yt;
  });
  if (spec.detail === 'swirl' && !compact && layers.length > 1) {
    const from = (tops[0] as number);
    const c2 = (layers[layers.length - 1] as Layer).color;
    const d = liqH * 0.17;
    for (const [ux, sc] of [[-0.62, 0.8], [-0.12, 1.15], [0.55, 0.9]] as const) {
      const x = ux * g.Wb;
      const w = 3.4 * g.k;
      const dd = d * sc;
      o += `<path d="M${f2(x - w)} ${f2(from - 3)}C${f2(x - w * 0.9)} ${f2(from + dd * 0.6)} ${f2(x - w * 0.3)} ${f2(from + dd)} ${f2(x)} ${f2(from + dd)}C${f2(x + w * 0.3)} ${f2(from + dd)} ${f2(x + w * 0.9)} ${f2(from + dd * 0.6)} ${f2(x + w)} ${f2(from - 3)}Z" fill="${c2}"/>`;
    }
  }
  void sw;
  return { svg: o, yTop: yTopLiq };
}

function heartSvg(cx: number, cy: number, rx: number, ry: number, color: string): string {
  const h = (t: number, y: number): string => `<path d="M0 ${f2(y + 9 * t)}C${f2(-13 * t)} ${f2(y + t)} ${f2(-10 * t)} ${f2(y - 9 * t)} 0 ${f2(y - 3 * t)}C${f2(10 * t)} ${f2(y - 9 * t)} ${f2(13 * t)} ${f2(y + t)} 0 ${f2(y + 9 * t)}Z" fill="${color}"/>`;
  return `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(rx / 22)} ${f2(ry / 11)})">${h(1, 0)}${h(0.55, 2.2)}</g>`;
}
function tulipSvg(cx: number, cy: number, rx: number, ry: number, color: string): string {
  return `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(rx / 26)} ${f2(ry / 12)})"><path d="M0 8C-10 4 -10 -4 0 -2C10 -4 10 4 0 8Z" fill="${color}"/><path d="M0 4C-6 1 -6 -3 0 -2C6 -3 6 1 0 4Z" fill="${mixColor(color, '#C99B6E', 0.4)}"/></g>`;
}
function specksSvg(rx: number, ry: number, cy: number, color: string): string {
  let o = '';
  for (let i = 0; i < 10; i++) {
    const a = i * 2.35;
    o += `<circle cx="${f2(Math.cos(a) * rx * 0.62 * ((i % 4) / 3 + 0.25))}" cy="${f2(cy + Math.sin(a) * ry * 0.55)}" r="1.4" fill="${color}"/>`;
  }
  return o;
}

/* ---------- части ---------- */

export interface DrinkParts {
  back: string;
  liquid: string;
  ice: string;
  front: string;
  steam: string;
  /** границы в единицах модели */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  geom: Geom;
}
export interface PartsOpts {
  level: Lod;
  /** итоговый масштаб (px на единицу модели): толщина линий = px / s */
  s: number;
  /** блюдце под стаканом (бар) вместо контактной тени */
  saucer?: boolean;
  /** два завитка пара над горячим напитком (билет, карточка; в баре пар рисует сцена) */
  steamMark?: boolean;
  /** лёд не рисовать (бар рисует лёд отдельно с прозрачностью по мере добавления) */
  noIce?: boolean;
}

const saucerRx = (k: number): number => 76 * Math.max(0.85, Math.min(1.4, 0.2 + 0.8 * k));

/** Все слои модели для спецификации. */
export function drinkParts(spec: DrinkSpec, o: PartsOpts): DrinkParts {
  const g = geomOf(spec.vessel);
  const compact = o.level === 'compact';
  const sw = (px: number): number => f2(px / o.s);
  const L = compact ? 2 : 3.5;
  const M = compact ? 2 : 3;
  const D = 2;
  void L;
  let back = '';
  let liquid = '';
  let ice = '';
  let front = '';
  const bb = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const grow = (x0: number, y0: number, x1: number, y1: number): void => {
    bb.x0 = Math.min(bb.x0, x0);
    bb.y0 = Math.min(bb.y0, y0);
    bb.x1 = Math.max(bb.x1, x1);
    bb.y1 = Math.max(bb.y1, y1);
  };
  const surfaceTop = spec.top;

  if (g.kind === 'glass') {
    const fill = spec.cold ? 0.96 : 0.88;
    if (o.saucer) {
      const sr = saucerRx(g.k) * 0.8;
      back += `<ellipse cx="0" cy="7" rx="${f2(sr * 0.9)}" ry="9" fill="${col('KRAFT')}" stroke="${INK}" stroke-width="${sw(3)}"/><ellipse cx="0" cy="5" rx="${f2(sr * 0.62)}" ry="4.6" fill="${col('KRAFT_SH')}"/>`;
      grow(-sr * 0.9, 0, sr * 0.9, 18);
    } else back += `<ellipse cx="2" cy="${f2(3 * g.ky)}" rx="${f2(g.Wt * 0.95)}" ry="${f2(3.6 * g.ky)}" fill="${col('SHADOW')}" opacity=".22"/>`;
    back += `<path d="${glassPath(g)}" fill="${PAL.glass.fill}" fill-opacity="${PAL.glass.alpha}"/>`;
    const liq = glassLiquidSvg(spec, g, fill, compact, sw);
    const id = 'gc' + (spec.id.length * 7 + Math.round(g.k * 100));
    liquid += `<clipPath id="${id}"><path d="${glassPath(g)}"/></clipPath><g clip-path="url(#${id})">${liq.svg}</g>`;
    const rxS = glassHalfWidth(g, liq.yTop) - 3;
    const ryS = g.ry * (rxS / g.Wt);
    liquid += `<ellipse cx="0" cy="${f2(liq.yTop)}" rx="${f2(rxS)}" ry="${f2(ryS)}" fill="${light(surfaceTop.color, 0.25)}" stroke="${shade(surfaceTop.color, 0.3)}" stroke-width="${sw(1.6)}"/>`;
    if (!compact && surfaceTop.art === 'heart') liquid += heartSvg(0, liq.yTop, rxS, ryS, col('PAPER'));
    if (!compact && surfaceTop.art === 'tulip') liquid += tulipSvg(0, liq.yTop, rxS, ryS, col('PAPER'));
    if (!compact && surfaceTop.specks) liquid += specksSvg(rxS, ryS, liq.yTop, surfaceTop.specks);
    if (!o.noIce && spec.ice.rows > 0) ice += compact ? iceLatticeSvg(spec, g, sw) : iceSvg(iceCubes(spec, g), sw);
    if (spec.bottom === 'boba') {
      const n = compact ? 4 : 7;
      for (let i = 0; i < n; i++) ice += `<circle cx="${f2((-0.8 + (1.6 * i) / (n - 1)) * (g.Wb - 8 * g.k))}" cy="${f2(g.yb - 8 * g.k - (i % 2) * 4 * g.k)}" r="${f2(5.2 * g.k)}" fill="#3A2A24" stroke="${INK}" stroke-width=".8"/>`;
    }
    front += `<path d="M${f2(g.Wt * 0.5)} ${f2(-g.H)}L${f2(g.Wt)} ${f2(-g.H)}L${f2(g.Wb)} ${f2(g.yb)}L${f2(g.Wb * 0.55)} ${f2(g.yb)}Z" fill="${col('SHADOW')}" opacity=".09"/>`;
    front += `<path d="M${f2(-g.Wb)} ${f2(g.yb - 4 * g.ky)}L${f2(g.Wb)} ${f2(g.yb - 4 * g.ky)}L${f2(g.Wb)} ${f2(g.yb)}Q0 ${f2(g.bulge)} ${f2(-g.Wb)} ${f2(g.yb)}Z" fill="${col('GLASS_DP')}" fill-opacity=".55"/>`;
    front += `<path d="M${f2(-g.Wt)} ${f2(-g.H)}L${f2(-g.Wb)} ${f2(g.yb)}Q0 ${f2(g.bulge)} ${f2(g.Wb)} ${f2(g.yb)}L${f2(g.Wt)} ${f2(-g.H)}" fill="none" stroke="${INK}" stroke-width="${sw(M)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    front += `<ellipse cx="0" cy="${f2(-g.H)}" rx="${f2(g.Wt)}" ry="${f2(g.ry)}" fill="none" stroke="${INK}" stroke-width="${sw(D)}"/>`;
    if (!compact) front += `<path d="M${f2(-g.Wt * 0.8)} ${f2(-g.H * 0.8)}L${f2(-g.Wb * 0.85)} ${f2(-g.H * 0.2)}" stroke="#fff" stroke-opacity=".7" stroke-width="${sw(3)}" stroke-linecap="round"/>`;
    grow(-g.Wt, -g.H - g.ry - 1, g.Wt, g.bulge + 8 * g.ky);
    if (spec.ice.rows > 0) grow(-g.Wt, -g.H - g.ry - 14 * g.ky, g.Wt, 0);
  } else if (g.kind === 'ceramic') {
    const { W, Wb, H, yb, ryR, reach, k, ky } = g;
    const side = (cmd: string): string => `M${f2(-W)} ${f2(-H)}C${f2(-W * 1.03)} ${f2(-H * 0.5)} ${f2(-Wb * 1.1)} ${f2(-H * 0.1)} ${f2(-Wb)} ${f2(yb)}Q0 ${f2(4 * ky)} ${f2(Wb)} ${f2(yb)}C${f2(Wb * 1.1)} ${f2(-H * 0.1)} ${f2(W * 1.03)} ${f2(-H * 0.5)} ${f2(W)} ${f2(-H)}${cmd}`;
    const th = 6 * Math.min(k, 1.2);
    const hx = W - 3;
    const y0 = -H * 0.8;
    const y1 = -H * 0.26;
    const hp = `M${f2(hx)} ${f2(y0)}C${f2(hx + reach)} ${f2(y0 - 6 * ky)} ${f2(hx + reach)} ${f2(y1 + 4 * ky)} ${f2(hx - 3)} ${f2(y1)}`;
    const sr = compact ? W * 1.15 : saucerRx(k);
    back += `<ellipse cx="0" cy="7" rx="${f2(sr * 0.9)}" ry="10" fill="${col('KRAFT')}" stroke="${INK}" stroke-width="${sw(M)}"/><ellipse cx="0" cy="5" rx="${f2(sr * 0.62)}" ry="5" fill="${col('KRAFT_SH')}"/>`;
    back += `<path d="${hp}" fill="none" stroke="${INK}" stroke-width="${sw(th * 0 + th + 2 * M)}" stroke-linecap="round"/><path d="${hp}" fill="none" stroke="${col('PAPER')}" stroke-width="${sw(th)}" stroke-linecap="round"/>`;
    back += `<path d="${side('Z')}" fill="${col('PAPER')}"/>`;
    back += `<path d="M${f2(W * 0.55)} ${f2(-H * 0.98)}L${f2(W)} ${f2(-H)}C${f2(W * 1.03)} ${f2(-H * 0.5)} ${f2(Wb * 1.1)} ${f2(-H * 0.1)} ${f2(Wb)} ${f2(yb)}Q${f2(Wb * 0.4)} ${f2(ky)} ${f2(Wb * 0.15)} 0C${f2(Wb * 0.5)} ${f2(-H * 0.3)} ${f2(W * 0.72)} ${f2(-H * 0.62)} ${f2(W * 0.55)} ${f2(-H * 0.98)}Z" fill="${col('KRAFT_SH')}"/>`;
    back += `<ellipse cx="0" cy="${f2(-H)}" rx="${f2(W)}" ry="${f2(ryR)}" fill="${col('CER_IN')}"/><ellipse cx="0" cy="${f2(-H + 1.5 * ky)}" rx="${f2(W - 5 * k)}" ry="${f2(ryR - 3 * ky)}" fill="${col('CER_IN_DP')}"/>`;
    const lvl = 0.92;
    const rxS = (W - 6 * k) * (0.88 + 0.12 * lvl);
    const ryS = (ryR - 3.5 * ky) * (0.9 + 0.1 * lvl);
    const cyS = -H + (3 + (1 - lvl) * 9) * ky;
    liquid += `<ellipse cx="0" cy="${f2(cyS)}" rx="${f2(rxS)}" ry="${f2(ryS)}" fill="${surfaceTop.ring ?? surfaceTop.color}"/>`;
    if (surfaceTop.ring) liquid += `<ellipse cx="0" cy="${f2(cyS)}" rx="${f2(rxS * 0.82)}" ry="${f2(ryS * 0.8)}" fill="${surfaceTop.color}"/>`;
    if (!compact && surfaceTop.art === 'heart') liquid += heartSvg(0, cyS, rxS, ryS, col('PAPER'));
    if (!compact && surfaceTop.art === 'tulip') liquid += tulipSvg(0, cyS, rxS, ryS, col('PAPER'));
    if (!compact && surfaceTop.specks) liquid += specksSvg(rxS, ryS, cyS, surfaceTop.specks);
    front += `<path d="${side('')}" fill="none" stroke="${INK}" stroke-width="${sw(M)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    front += `<ellipse cx="0" cy="${f2(-H)}" rx="${f2(W)}" ry="${f2(ryR)}" fill="none" stroke="${INK}" stroke-width="${sw(M)}"/>`;
    front += `<path d="M${f2(-W * 0.82)} ${f2(-H * 0.8)}Q${f2(-W * 0.88)} ${f2(-H * 0.45)} ${f2(-Wb * 0.88)} ${f2(-H * 0.2)}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="${sw(3)}" stroke-linecap="round"/>`;
    grow(-sr * 0.9, -H - ryR - 2, sr * 0.9 + 4, 18);
    grow(-W, -H - ryR, W + reach + 6, 0);
  } else {
    const { W, Wb, H, yb, ryR, reach, k } = g;
    const side = (cmd: string): string => `M${f2(-W)} ${f2(-H)}C${f2(-W * 1.04)} ${f2(-H * 0.45)} ${f2(-Wb * 1.5)} ${f2(-H * 0.1)} ${f2(-Wb)} ${f2(yb)}Q0 ${f2(3 * k)} ${f2(Wb)} ${f2(yb)}C${f2(Wb * 1.5)} ${f2(-H * 0.1)} ${f2(W * 1.04)} ${f2(-H * 0.45)} ${f2(W)} ${f2(-H)}${cmd}`;
    const hx = W - 2;
    const y0 = -H * 0.82;
    const y1 = -H * 0.3;
    const hp = `M${f2(hx)} ${f2(y0)}C${f2(hx + reach)} ${f2(y0 - 4 * k)} ${f2(hx + reach)} ${f2(y1 + 3 * k)} ${f2(hx - 3)} ${f2(y1)}`;
    const sr = 62 * k * 1.12;
    back += `<ellipse cx="0" cy="${f2(5 * k)}" rx="${f2(sr)}" ry="${f2(8 * k)}" fill="${col('KRAFT')}" stroke="${INK}" stroke-width="${sw(M)}"/><ellipse cx="0" cy="${f2(3.5 * k)}" rx="${f2(sr * 0.58)}" ry="${f2(3.6 * k)}" fill="${col('KRAFT_SH')}"/>`;
    back += `<path d="${hp}" fill="none" stroke="${INK}" stroke-width="${sw(4.2 + 2 * M)}" stroke-linecap="round"/><path d="${hp}" fill="none" stroke="${col('PAPER')}" stroke-width="${sw(4.2)}" stroke-linecap="round"/>`;
    back += `<path d="${side('Z')}" fill="${col('PAPER')}"/>`;
    back += `<ellipse cx="0" cy="${f2(-H)}" rx="${f2(W)}" ry="${f2(ryR)}" fill="${col('CER_IN')}"/>`;
    liquid += `<ellipse cx="0" cy="${f2(-H + 1.4 * k)}" rx="${f2(W - 4 * k)}" ry="${f2(ryR - 2.6 * k)}" fill="${surfaceTop.color}"/>`;
    if (!compact && surfaceTop.ring) liquid += `<ellipse cx="0" cy="${f2(-H + 1.4 * k)}" rx="${f2(W - 4 * k)}" ry="${f2(ryR - 2.6 * k)}" fill="none" stroke="${surfaceTop.ring}" stroke-width="${sw(3)}"/>`;
    front += `<path d="${side('')}" fill="none" stroke="${INK}" stroke-width="${sw(M)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    front += `<ellipse cx="0" cy="${f2(-H)}" rx="${f2(W)}" ry="${f2(ryR)}" fill="none" stroke="${INK}" stroke-width="${sw(M)}"/>`;
    grow(-sr, -H - ryR - 2, sr + 2, 14 * k);
    grow(-W, -H, W + reach + 5, 0);
  }
  let steam = '';
  if (!spec.cold && o.steamMark) {
    const top = bb.y0 - 3;
    const w = compact ? 5 : 8;
    const hh = compact ? 10 : 18;
    for (const d of [-1, 1]) steam += `<path d="M${f2(d * w * 1.3)} ${f2(top)}q${f2(-w * d * 0.9)} ${f2(-hh * 0.4)} 0 ${f2(-hh * 0.6)}t0 ${f2(-hh * 0.6)}" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="${sw(compact ? 2 : 2.4)}" stroke-linecap="round"/>`;
    grow(-w * 2.6, top - hh * 1.3, w * 2.6, top);
  }
  return { back, liquid, ice, front, steam, bbox: bb, geom: g };
}

/* ---------- сборка ---------- */

export interface DrinkPx {
  /** разметка в координатах px (масштаб уже применён), начало координат — точка основания */
  inner: string;
  /** границы в px относительно основания */
  box: { x: number; y: number; w: number; h: number };
}
/** Модель в пикселях: для `raster` (Pixi) и для встраивания в SVG. Слои можно взять по отдельности (`layers`). */
export function drinkPx(spec: DrinkSpec, o: PartsOpts, pad = 2): { all: DrinkPx; parts: DrinkParts; layer: (name: 'back' | 'liquid' | 'ice' | 'front' | 'steam') => DrinkPx } {
  const parts = drinkParts(spec, o);
  const b = parts.bbox;
  const box = { x: Math.floor(b.x0 * o.s) - pad, y: Math.floor(b.y0 * o.s) - pad, w: Math.ceil((b.x1 - b.x0) * o.s) + 2 * pad + 1, h: Math.ceil((b.y1 - b.y0) * o.s) + 2 * pad + 1 };
  const wrap = (m: string): DrinkPx => ({ inner: `<g transform="scale(${o.s})">${m}</g>`, box });
  return { all: wrap(parts.back + parts.liquid + parts.ice + parts.front + parts.steam), parts, layer: (n) => wrap(parts[n]) };
}

/** Целый SVG-документ модели (для DOM, например иконки билета). */
export function drinkSvg(spec: DrinkSpec, o: PartsOpts): { svg: string; w: number; h: number } {
  const { all } = drinkPx(spec, o);
  const { x, y, w, h } = all.box;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">${all.inner}</svg>`, w, h };
}

/** Иконка компактного уровня, вписанная в слот W × H px: подбирается масштаб, чтобы вся модель (с паром и льдом) уместилась. */
export function drinkIconSvg(spec: DrinkSpec, W: number, H: number): { svg: string; s: number; w: number; h: number } {
  const probe = drinkParts(spec, { level: 'compact', s: 1, saucer: false, steamMark: true });
  const bw = probe.bbox.x1 - probe.bbox.x0;
  const bh = probe.bbox.y1 - probe.bbox.y0;
  const s = Math.min((W - 2) / bw, (H - 2) / bh, 0.5);
  const { svg, w, h } = drinkSvg(spec, { level: 'compact', s, steamMark: true });
  return { svg, s, w, h };
}

/** Иконка компактного уровня в пикселях для `raster` (пузырь заказа): модель вписана в слот W × H, начало координат — основание. */
export function drinkIconPx(spec: DrinkSpec, W: number, H: number): { inner: string; box: { x: number; y: number; w: number; h: number }; s: number } {
  const probe = drinkParts(spec, { level: 'compact', s: 1, saucer: false, steamMark: true });
  const bw = probe.bbox.x1 - probe.bbox.x0;
  const bh = probe.bbox.y1 - probe.bbox.y0;
  const s = Math.min((W - 2) / bw, (H - 2) / bh, 0.5);
  const { all } = drinkPx(spec, { level: 'compact', s, steamMark: true });
  return { inner: all.inner, box: all.box, s };
}

const artMemo = new Map<string, string>();
/**
 * Полный уровень для DOM (книга рецептов, окно «Новый напиток»): масштаб `s` px на единицу модели, блюдце и пар. Размеры сравнимы между собой, потому что `s` один на карточку.
 * Строки запоминаются (до 40 штук, самая старая вытесняется): книга перерисовывается целиком при каждом клике.
 */
export function drinkArtSvg(spec: DrinkSpec, s: number): { svg: string; w: number; h: number } {
  const key = `${spec.id}|${spec.size}|${spec.cold ? 'cold' : 'hot'}|${s}`;
  const hit = artMemo.get(key);
  if (hit !== undefined) {
    artMemo.delete(key);
    artMemo.set(key, hit);
    const m = /width="(\d+)" height="(\d+)"/.exec(hit);
    return { svg: hit, w: Number(m?.[1] ?? 0), h: Number(m?.[2] ?? 0) };
  }
  const o = drinkSvg(spec, { level: 'full', s, saucer: true, steamMark: true });
  artMemo.set(key, o.svg);
  if (artMemo.size > 40) artMemo.delete(artMemo.keys().next().value as string);
  return o;
}
