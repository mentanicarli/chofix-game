/**
 * Модель напитка (Н1-1): чистое описание «что нарисовать» для одного напитка, размера и температуры.
 * Из него будут рисоваться бар, билет, пузырь заказа, книга, окно «Новый напиток» и выдача (рисование и подключение — этап Н1-2, здесь их нет).
 * Источники: рецепт `recipeNumbers`, палитра `paletteOf`, правило посуды владельца (docs/art/drinks/decisions.md).
 * Чистая логика: без DOM, window и Pixi.
 */
import { drinkById, DRINKS } from './menu';
import { paletteOf } from './recipes';
import type { Drink, Size } from './types';
import { PUMP_ML, SHOT_ML, cupScale, recipeNumbers, type Recipe } from './volumes';

export type Material = 'glass' | 'ceramic' | 'demitas';
/** Граница слоёв: прямая, ступенчатая (полоса среднего тона без градиента) или волнистая с языками. */
export type Edge = 'sharp' | 'step' | 'wavy';
/** Особая деталь рисунка (одна на напиток). «Функциональность» бабл ти малина-лимон сюда не входит: она в `tags`. */
export type Detail = 'swirl' | 'tonic_bubbles' | 'caramel_stripes' | 'spice_specks' | 'taro_cap' | 'cloudy' | 'caramel_sauce';
/** Группы моделей: H — горячие, C — холодные (docs/art/drinks/table.md). */
export type ModelGroup = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'H8' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
export type Lod = 'full' | 'compact';
/** Сетка льда: кубики одного размера плотно от дна до верха стакана. */
export interface IceGrid { rows: number; cols: number }

export interface VesselSpec {
  material: Material;
  /** объём чашки или стакана, мл (`recipeNumbers().cupMl`) */
  ml: number;
  /** масштаб силуэта: `cupScale(ml)`, у демитаса собственный (0,62 / 0,70) */
  k: number;
}
export interface Layer {
  color: string;
  /** доля высоты жидкости; сумма долей = 1 */
  frac: number;
  /** граница с предыдущим (нижним) слоем */
  edge: Edge;
  tone?: 'clear' | 'cloudy';
}
export interface TopSpec {
  color: string;
  ring?: string;
  art?: 'heart' | 'tulip';
  specks?: string;
}
export interface DrinkSpec {
  id: string;
  size: Size;
  cold: boolean;
  group: ModelGroup;
  vessel: VesselSpec;
  /** снизу вверх */
  liquid: Layer[];
  top: TopSpec;
  /** лёд в полном уровне: сетка кубиков (ряды × столбцы), у горячих и блендерных напитков 0 × 0 */
  ice: IceGrid;
  bottom: 'boba' | null;
  detail: Detail | null;
  tags: string[];
}

/* ---------- посуда ---------- */

/** Горячие напитки в прозрачном стекле: все с «латте» в названии (решение владельца 15.10.2026). */
export const GLASS_HOT: ReadonlySet<string> = new Set([
  'latte', 'latte_sakura', 'latte_banana', 'latte_lemon', 'latte_coconut', 'matcha_latte', 'matcha_coconut', 'chicory_latte'
]);
const DEMITAS_IDS: ReadonlySet<string> = new Set(['espresso', 'espresso_double']);
/** Масштаб демитаса: одинарный и двойной (чашки 90 и 120 мл); объёмы напитка и чашки не меняются. */
export const DEMITAS_K: Readonly<Record<string, number>> = { espresso: 0.62, espresso_double: 0.7 };
/** Потолок высоты силуэта (в баре — `CUP_MAX_KY`): обе оси растут на k, высота не больше этого множителя. */
export const HEIGHT_CAP = 1.12;

/** Посуда по правилу владельца: все холодные в стакане; горячие «латте» в стакане; эспрессо в демитасе; остальное керамика. */
export function vesselOf(drinkId: string, cold: boolean): Material {
  if (!drinkById[drinkId]) throw new Error(`нет напитка ${drinkId}`);
  if (DEMITAS_IDS.has(drinkId)) return 'demitas';
  if (cold || GLASS_HOT.has(drinkId)) return 'glass';
  return 'ceramic';
}

/** Контур в единицах модели при k = 1 (0,2 л); стакан — предложенный (верх 92, дно 72, высота 80), керамика как `drawShell`. */
export const GEOMETRY: Readonly<Record<Material, { width: number; height: number; bottom: number }>> = {
  glass: { width: 92, height: 80, bottom: 72 },
  ceramic: { width: 110, height: 75, bottom: 86 },
  demitas: { width: 80, height: 52, bottom: 48 }
};
/** Ширина и высота силуэта: обе оси растут на k, высота обрезается потолком `HEIGHT_CAP` (у демитаса потолка нет). */
export function vesselDims(v: VesselSpec): { width: number; height: number } {
  const g = GEOMETRY[v.material];
  const ky = v.material === 'demitas' ? v.k : Math.min(v.k, HEIGHT_CAP);
  return { width: g.width * v.k, height: g.height * ky };
}

/* ---------- размеры напитка ---------- */

const bySize = (a: Size, b: Size): number => Number(a) - Number(b);
/** Размеры, в которых бывает вариант напитка. */
export function sizesOf(drinkId: string, cold: boolean): Size[] {
  const d = drinkById[drinkId];
  if (!d) throw new Error(`нет напитка ${drinkId}`);
  if (cold && d.temp === 'hot') return [];
  if (!cold && d.temp === 'cold') return [];
  const own = Object.keys(d.sizes) as Size[];
  const list = cold && d.temp === 'both' ? d.coldSizes : own;
  return [...list].sort(bySize);
}
/** Какие варианты (горячий, холодный) есть у напитка. */
export const variantsOf = (d: Drink): boolean[] => (d.temp === 'both' ? [false, true] : [d.temp === 'cold']);

/* ---------- цвета ---------- */

const COF = '#8A5B3A';
const ESP = '#4A2E20';
const ESP_CUP = '#5A3A2A';
const MIXC = '#C99B6E';
const FOAM = '#F1DFC2';
const FOAM_W = '#FBF4E8';
const MILK = '#F3E7D0';
const CREAM = '#E9D2B2';
const CREAM_GOLD = '#E9D29A';
const CREMA = '#C99B6E';
const SYRUP_COLOR: Readonly<Record<string, string>> = {
  latte_sakura: '#F0B3A0', latte_banana: '#F2DA8A', latte_lemon: '#F3E6A8', latte_coconut: '#F3E6C8', cappuccino_pumpkin: '#E0A24C'
};
const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
/** Смесь двух цветов #rrggbb, t — доля второго. */
export function mixColor(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return '#' + x.map((v, i) => Math.round(v + ((y[i] as number) - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/* ---------- группы ---------- */

const TEA_IDS: ReadonlySet<string> = new Set(['tea_sencha', 'tea_assam', 'tea_hibiscus', 'tea_buckwheat', 'tea_currant']);
const BLENDED: ReadonlySet<string> = new Set(['milkshake_vanilla', 'milkshake_banana', 'frappe_caramel', 'protein_milk', 'protein_water']);
/** Группа модели напитка (docs/art/drinks/table.md). */
export function groupOf(d: Drink, cold: boolean): ModelGroup {
  const id = d.id;
  if (!cold) {
    if (DEMITAS_IDS.has(id)) return 'H1';
    if (id === 'americano' || id === 'hot_bumble') return 'H2';
    if (id === 'cappuccino' || id === 'cappuccino_pumpkin') return 'H3';
    if (id === 'flat_white') return 'H4';
    if (id === 'vanilla_raf' || id === 'raf' || id === 'raf_halva' || id === 'cocoa') return 'H5';
    if (TEA_IDS.has(id)) return 'H6';
    if (id === 'latte' || id === 'latte_sakura' || id === 'latte_banana' || id === 'latte_lemon' || id === 'latte_coconut') return 'H7';
    return 'H8';
  }
  if (id === 'americano' || TEA_IDS.has(id)) return 'C1';
  if (d.family === 'bumble' || d.family === 'tonic') return 'C3';
  if (d.family === 'aero') return 'C4';
  if (BLENDED.has(id)) return 'C5';
  if (d.family === 'boba') return 'C6';
  return 'C2';
}
const ICE_GROUPS: ReadonlySet<ModelGroup> = new Set(['C1', 'C2', 'C3', 'C4', 'C6']);
/** Лёд заполняет стакан равномерно (правило 16.10.2026, Н1-1б): кубик одного размера на любом стакане, число рядов по высоте, столбцов по ширине. */
export const ICE_CUBE = 28;
/** Шаг рядов и столбцов в долях стороны кубика: кубики слегка перекрываются. */
export const ICE_ROW_PITCH = 0.85;
export const ICE_COL_PITCH = 0.95;
/** Доля высоты стакана, занятая льдом от дна (верхний ряд выступает над жидкостью). */
export const ICE_FILL_SHARE = 0.9;
/** Наклон кубиков, градусы (±). */
export const ICE_ROT_MAX = 12;
export const NO_ICE: IceGrid = { rows: 0, cols: 0 };
/** Сетка льда стакана: ряды по высоте силуэта (с потолком `HEIGHT_CAP`), столбцы по средней внутренней ширине. У групп без льда — 0 × 0. */
export function iceGridFor(group: ModelGroup, vessel: VesselSpec): IceGrid {
  if (!ICE_GROUPS.has(group) || vessel.material !== 'glass') return NO_ICE;
  const g = GEOMETRY.glass;
  const rows = Math.max(2, Math.round((ICE_FILL_SHARE * vesselDims(vessel).height) / (ICE_ROW_PITCH * ICE_CUBE)));
  const innerWidth = ((g.width + g.bottom) / 2) * vessel.k - 6;
  const cols = Math.max(2, Math.round(innerWidth / (ICE_COL_PITCH * ICE_CUBE)));
  return { rows, cols };
}
export const iceCount = (g: IceGrid): number => g.rows * g.cols;

/* ---------- слои ---------- */

interface RawLayer { color: string; vol: number; edge?: Edge; tone?: 'clear' | 'cloudy' }
/** Доли из объёмов: сумма ровно 1 (последняя доля добирает округление), нулевые слои пропускаются. */
function toLayers(raw: readonly RawLayer[]): Layer[] {
  const live = raw.filter((l) => l.vol > 0);
  const sum = live.reduce((a, l) => a + l.vol, 0);
  if (!live.length || sum <= 0) throw new Error('пустой напиток');
  let acc = 0;
  return live.map((l, i) => {
    const frac = i === live.length - 1 ? Math.round((1 - acc) * 1e6) / 1e6 : Math.round((l.vol / sum) * 1e4) / 1e4;
    acc += frac;
    const out: Layer = { color: l.color, frac, edge: i === 0 ? 'sharp' : (l.edge ?? 'sharp') };
    if (l.tone) out.tone = l.tone;
    return out;
  });
}
const partVol = (r: Recipe, task: string): number => r.parts.filter((p) => p.task === task).reduce((a, p) => a + p.vol, 0);

interface Body { liquid: Layer[]; top: TopSpec; detail: Detail | null; bottom?: 'boba' }

function build(d: Drink, r: Recipe, group: ModelGroup): Body {
  const pal = paletteOf(d.id);
  const shotMl = r.shots * SHOT_ML;
  const syrupMl = r.pumps * PUMP_ML;
  const milkAfter = partVol(r, 'milk');
  const foamVol = r.milk !== undefined && !r.cupMilk ? Math.max(0, milkAfter - r.milk) : 0;
  const cap = r.topFoam ?? 0;
  switch (group) {
    case 'H1':
      return { liquid: toLayers([{ color: ESP_CUP, vol: r.drinkMl }]), top: { color: ESP_CUP, ring: CREMA }, detail: null };
    case 'H2':
      if (d.id === 'hot_bumble') {
        const juice = r.juice ?? 0;
        return { liquid: toLayers([{ color: pal.juice, vol: juice }, { color: ESP, vol: shotMl, edge: 'wavy' }]), top: { color: ESP }, detail: null };
      }
      return { liquid: toLayers([{ color: COF, vol: r.drinkMl }]), top: { color: COF }, detail: null };
    case 'H3':
    case 'H4': {
      const liquid = toLayers([{ color: COF, vol: shotMl }, { color: MIXC, vol: r.milk ?? 0, edge: 'step' }, { color: FOAM, vol: foamVol }]);
      const top: TopSpec = group === 'H3' ? { color: FOAM, ring: MIXC, art: 'heart' } : { color: FOAM, ring: MIXC, art: 'tulip' };
      if (d.id === 'cappuccino_pumpkin') {
        top.specks = '#7A4A38';
        return { liquid, top, detail: 'spice_specks' };
      }
      return { liquid, top, detail: null };
    }
    case 'H5': {
      const color = d.id === 'cocoa' ? pal.powder : d.id === 'raf_halva' ? CREAM_GOLD : CREAM;
      return { liquid: toLayers([{ color, vol: r.drinkMl }]), top: { color: FOAM }, detail: null };
    }
    case 'H6': {
      const juice = r.juice ?? 0;
      const raw: RawLayer[] = [{ color: pal.tea, vol: r.tea?.waterMl ?? r.drinkMl, tone: 'clear' }];
      if (juice) raw.push({ color: pal.juice, vol: juice, tone: 'cloudy' });
      return { liquid: toLayers(raw), top: { color: juice ? mixColor(pal.tea, pal.juice, 0.4) : pal.tea }, detail: juice ? 'cloudy' : null };
    }
    case 'H7': {
      const syrup = SYRUP_COLOR[d.id];
      const isLatte = d.id === 'latte';
      const capColor = isLatte ? FOAM : pal.foam;
      const raw: RawLayer[] = [];
      if (syrup) raw.push({ color: syrup, vol: syrupMl });
      raw.push({ color: MILK, vol: r.milk ?? 0, edge: 'step' }, { color: COF, vol: shotMl, edge: 'step' }, { color: capColor, vol: isLatte ? foamVol : foamVol + cap, edge: 'sharp' });
      const top: TopSpec = isLatte ? { color: '#D9B98F', art: 'heart' } : { color: capColor, ring: MIXC };
      const taro = d.id === 'latte_sakura' || d.id === 'latte_lemon' || d.id === 'latte_coconut';
      return { liquid: toLayers(raw), top, detail: taro ? 'taro_cap' : null };
    }
    case 'H8': {
      const matcha = r.matcha?.waterMl ?? 0;
      const base = d.id === 'chicory_latte' ? mixColor(pal.powder, MILK, 0.5) : mixColor(pal.matcha, MILK, 0.55);
      const raw: RawLayer[] = [];
      if (matcha) raw.push({ color: pal.matcha, vol: matcha });
      raw.push({ color: base, vol: r.milk ?? r.drinkMl, edge: 'step' }, { color: d.id === 'matcha_coconut' ? pal.foam : FOAM, vol: foamVol + cap });
      return { liquid: toLayers(raw), top: { color: d.id === 'matcha_coconut' ? pal.foam : FOAM }, detail: d.id === 'matcha_coconut' ? 'taro_cap' : null };
    }
    case 'C1': {
      const juice = r.juice ?? 0;
      const color = d.id === 'americano' ? COF : pal.tea;
      const raw: RawLayer[] = [{ color, vol: d.id === 'americano' ? shotMl + (r.water ?? 0) : (r.tea?.waterMl ?? r.drinkMl), tone: 'clear' }];
      if (juice) raw.push({ color: pal.juice, vol: juice, tone: 'cloudy' });
      return { liquid: toLayers(raw), top: { color: juice ? mixColor(pal.tea, pal.juice, 0.4) : color }, detail: juice ? 'cloudy' : null };
    }
    case 'C2': {
      const syrup = SYRUP_COLOR[d.id];
      const coffee = r.shots > 0;
      const base = d.id === 'cocoa' ? pal.powder
        : d.id === 'chicory_latte' ? mixColor(pal.powder, MILK, 0.5)
        : d.family === 'matcha' || d.id === 'matcha_coconut' ? mixColor(pal.matcha, MILK, 0.55)
        : d.family === 'raf' ? (d.id === 'raf_halva' ? CREAM_GOLD : CREAM)
        : MIXC;
      const milkVol = r.milk ?? r.drinkMl;
      const coldFoam = r.coldX ? milkVol * r.coldX : 0;
      const raw: RawLayer[] = [];
      if (syrup) raw.push({ color: syrup, vol: syrupMl });
      if (coffee && d.family !== 'raf') raw.push({ color: ESP, vol: shotMl, edge: 'step' });
      raw.push({ color: base, vol: milkVol, edge: 'step' });
      const foamColor = cap ? pal.foam : FOAM;
      if (coldFoam + cap > 0) raw.push({ color: foamColor, vol: coldFoam + cap });
      const taro = d.id === 'latte_sakura' || d.id === 'latte_lemon' || d.id === 'latte_coconut' || d.id === 'matcha_coconut';
      const detail: Detail | null = taro ? 'taro_cap' : d.id === 'cappuccino_pumpkin' ? 'spice_specks' : null;
      return { liquid: toLayers(raw), top: { color: coldFoam + cap > 0 ? foamColor : base }, detail };
    }
    case 'C3': {
      const tonic = d.family === 'tonic';
      const bottomColor = tonic ? pal.tonic : pal.juice;
      const bottomVol = tonic ? (r.tonic ?? 0) : (r.juice ?? 0);
      const matcha = d.id.startsWith('matcha');
      const topColor = matcha ? pal.matcha : ESP;
      const topVol = matcha ? (r.matcha?.waterMl ?? 0) : shotMl;
      return { liquid: toLayers([tonic ? { color: bottomColor, vol: bottomVol, tone: 'clear' } : { color: bottomColor, vol: bottomVol }, { color: topColor, vol: topVol, edge: 'wavy' }]), top: { color: topColor }, detail: tonic ? 'tonic_bubbles' : 'swirl' };
    }
    case 'C4': {
      const F = r.topFoam ?? 0;
      return { liquid: toLayers([{ color: COF, vol: shotMl + (r.water ?? 0) }, { color: FOAM_W, vol: F }]), top: { color: FOAM_W }, detail: 'caramel_stripes' };
    }
    case 'C5': {
      const proteins = d.family === 'protein';
      const color = proteins ? pal.powder : pal.blend;
      const detail: Detail | null = d.id === 'frappe_caramel' ? 'caramel_sauce' : d.id === 'protein_water' ? 'cloudy' : null;
      return { liquid: toLayers([d.id === 'protein_water' ? { color, vol: r.drinkMl, tone: 'cloudy' } : { color, vol: r.drinkMl }]), top: { color: d.id === 'frappe_caramel' ? pal.topping : color }, detail };
    }
    case 'C6': {
      const liquidColor = mixColor(pal.tea, pal.topping, 0.6);
      return { liquid: toLayers([{ color: liquidColor, vol: r.drinkMl }]), top: { color: liquidColor }, detail: null, bottom: 'boba' };
    }
  }
}

/** Описание напитка для рисования. Бросает ошибку, если такого напитка, размера или варианта нет. */
export function specOf(drinkId: string, size: Size, cold: boolean): DrinkSpec {
  const d = drinkById[drinkId];
  if (!d) throw new Error(`нет напитка ${drinkId}`);
  if (!sizesOf(drinkId, cold).includes(size)) throw new Error(`у ${drinkId} нет варианта ${cold ? 'холодный' : 'горячий'} ${size} л`);
  const r = recipeNumbers(d, size, cold);
  const group = groupOf(d, cold);
  const body = build(d, r, group);
  const material = vesselOf(drinkId, cold);
  const k = material === 'demitas' ? (DEMITAS_K[drinkId] as number) : cupScale(r.cupMl);
  const vessel: VesselSpec = { material, ml: r.cupMl, k };
  return {
    id: drinkId,
    size,
    cold,
    group,
    vessel,
    liquid: body.liquid,
    top: body.top,
    ice: iceGridFor(group, vessel),
    bottom: body.bottom ?? null,
    detail: body.detail,
    tags: d.id === 'boba_raspberry' ? ['functional'] : []
  };
}

/** Все описания: каждый напиток × размер × вариант (горячий/холодный). Нужны листу проверки и тестам. */
export function allSpecs(): DrinkSpec[] {
  const out: DrinkSpec[] = [];
  for (const d of DRINKS) for (const cold of variantsOf(d)) for (const size of sizesOf(d.id, cold)) out.push(specOf(d.id, size, cold));
  return out;
}

/* ---------- уровни детализации ---------- */

/** Полный уровень — от 56 px высоты модели на экране (бар, книга, окно «Новый напиток»), ниже компактный (билет, пузырь, чашка в руке). */
export const LOD_FULL_MIN_PX = 56;
export const lodFor = (heightPx: number): Lod => (heightPx >= LOD_FULL_MIN_PX ? 'full' : 'compact');
/** В компактном уровне не больше трёх полос цвета. */
export const COMPACT_MAX_BANDS = 3;
/** Слои для уровня: в компактном соседние слои сливаются до трёх полос (низ, середина, верх), границы прямые; сумма долей остаётся 1. */
export function layersFor(spec: DrinkSpec, lod: Lod): Layer[] {
  if (lod === 'full') return spec.liquid.map((l) => ({ ...l }));
  if (spec.liquid.length <= COMPACT_MAX_BANDS) return spec.liquid.map((l) => ({ ...l, edge: 'sharp' as Edge }));
  const n = spec.liquid.length;
  const groups: Layer[][] = [[], [], []];
  spec.liquid.forEach((l, i) => (groups[Math.min(2, Math.floor((i * 3) / n))] as Layer[]).push(l));
  let acc = 0;
  const out = groups.filter((g) => g.length).map((g) => {
    const frac = g.reduce((a, l) => a + l.frac, 0);
    // цвет полосы — цвет самого большого слоя группы
    const main = g.reduce((a, l) => (l.frac > a.frac ? l : a));
    acc += frac;
    return { color: main.color, frac, edge: 'sharp' as Edge };
  });
  const last = out[out.length - 1] as Layer;
  last.frac = Math.round((last.frac + (1 - acc)) * 1e6) / 1e6;
  return out;
}
/** Лёд в компактном уровне: отдельных кубиков нет, вместо них лёгкая прозрачная решётка мелких квадратов (3–4 ряда, столбцов как в полном) и две блика-точки. */
export interface CompactIce { rows: number; cols: number; dots: number }
export function compactIce(spec: DrinkSpec): CompactIce | null {
  if (spec.ice.rows <= 0) return null;
  return { rows: Math.min(4, spec.ice.rows + 1), cols: spec.ice.cols, dots: 2 };
}
