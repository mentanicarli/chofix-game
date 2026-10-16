import { MILKY_OLD, drinkById, drinkOfKey } from './menu';
import type { Drink, Size } from './types';
import { SAUCE_G, SPICE_G, cupScale, recipeNumbers } from './volumes';

/** Названия шагов в билете. */
export const TASK_NAME: Readonly<Record<string, string>> = {
  syrup: 'Сироп', grind: 'Помол', tamp: 'Темпер', shot: 'Шот', water: 'Вода', ice: 'Лёд', food: 'Еда', milk: 'Молоко', steam: 'Пар', pour: 'Заливка',
  whisk: 'Матча', brew: 'Заварка', juice: 'Сок', tonic: 'Тоник', powder: 'Порошок', boba: 'Шарики', topping: 'Топпинг',
  blend: 'Блендер', shake: 'Шейкер', foam: 'Пенка', whip: 'Пена', layer: 'Слои'
};

/** Шаги, которые идут в панели «станция» (не в крупном плане Pixi). */
export const PANEL_TASKS: ReadonlySet<string> = new Set(['whisk', 'brew', 'juice', 'tonic', 'powder', 'boba', 'topping', 'blend', 'shake', 'foam', 'whip', 'layer']);

/** Где на баре делается шаг: id зоны. */
export const TASK_ZONE: Readonly<Record<string, string>> = {
  syrup: 'syrup', grind: 'grind', tamp: 'tamp', shot: 'shot', water: 'water', ice: 'ice', food: 'food', milk: 'milk', steam: 'steam', pour: 'pour',
  whisk: 'matcha', brew: 'tea', juice: 'juice', tonic: 'juice', powder: 'powders', boba: 'boba', topping: 'pour',
  blend: 'blender', shake: 'shaker', foam: 'foamer', whip: 'whipper', layer: 'pour'
};

/** Это напиток нового ядра (рецепт собирается из шагов меню)? */
const OLD_KEYS: ReadonlySet<string> = new Set([
  'espresso', 'espresso2', 'americano', 'icedamericano', 'icedlatte', 'icedcappuccino', 'cappuccino', 'latte', 'flatwhite', 'raf', 'vanillaraf', 'rafhalva'
]);
export const isMenuKey = (key: string): boolean => key in drinkById && !OLD_KEYS.has(key);

const OLD_MILKY = new Set(MILKY_OLD);

export interface BuildOpts {
  /** Холодная версия: для старых напитков ключ уже ice*, для новых чаёв добавляется лёд. */
  cold: boolean;
  /** У заказа есть сироп. */
  syrup: boolean;
  /** Сколько шотов в заказе (по размеру); без него — как у напитка без выбора (1 или 2). */
  shots?: number;
}

const RAF_KEYS: ReadonlySet<string> = new Set(['raf', 'vanillaraf', 'rafhalva']);
/** Повторяет цикл «помол → темпер → шот» n раз (двойной эспрессо и крупные размеры: два шота подряд в ту же чашку). */
function expandShots(t: string[], n: number): string[] {
  const i = t.findIndex((x, k) => x === 'grind' && t[k + 1] === 'tamp' && t[k + 2] === 'shot');
  if (i < 0 || n <= 1) return t;
  const cycle = ['grind', 'tamp', 'shot'];
  const rep: string[] = [];
  for (let k = 0; k < n; k++) rep.push(...cycle);
  return [...t.slice(0, i), ...rep, ...t.slice(i + 3)];
}
/** Сколько шотов по умолчанию, когда размер не известен. */
function defaultShots(key: string): number {
  if (key === 'espresso2' || key === 'flatwhite') return 2;
  const d = isMenuKey(key) ? drinkById[key] : undefined;
  return d ? (d.shots === 'size' ? 1 : d.shots) : 1;
}

/** Есть ли у холодного рецепта напитка цель льда (по первому размеру: наличие льда от размера не зависит). */
function hasIceTarget(d: Drink): boolean {
  const size = Object.keys(d.sizes)[0] as Size | undefined;
  return !size || (recipeNumbers(d, size, true).ice ?? 0) > 0;
}

/** Шаги бара по ключу механики. Шоты идут циклами «помол → темпер → шот» (по одному на шот). */
export function buildTasks(key: string, o: BuildOpts): string[] {
  const n = Math.max(1, o.shots ?? defaultShots(key));
  const d = isMenuKey(key) ? drinkById[key] : undefined;
  if (!d) {
    // старые напитки с ручной механикой
    const t: string[] = [];
    if (RAF_KEYS.has(key)) {
      // классический раф: эспрессо в питчер, сливки, сироп (если есть), пар, заливка
      t.push(...expandShots(['grind', 'tamp', 'shot'], n), 'milk');
      if (o.syrup) t.push('syrup');
      t.push('steam', 'pour');
      return t;
    }
    if (o.syrup) t.push('syrup');
    t.push(...expandShots(['grind', 'tamp', 'shot'], n));
    if (key === 'americano') t.push('water');
    if (key === 'icedamericano') t.push('ice', 'water');
    if (key === 'icedlatte' || key === 'icedcappuccino') t.push('ice', 'milk');
    if (OLD_MILKY.has(key)) t.push('milk', 'steam', 'pour');
    return t;
  }
  const t: string[] = [];
  // сироп идёт на дно стакана первым шагом; у бабл ти он добавляется в шейкер к чаю, поэтому стоит там, где в рецепте
  const syrupInPlace = d.family === 'boba';
  if (o.syrup && !syrupInPlace) t.push('syrup');
  for (const s of d.steps) {
    switch (s.st) {
      case 'syrup': if (syrupInPlace && o.syrup) t.push('syrup'); break;
      case 'cream': break; // сливки входят в раф (раф идёт по ключам старой механики)
      case 'shot_only': t.push('grind', 'tamp', 'shot'); break;
      case 'pour': t.push(s.arg === 'layer' ? 'layer' : 'pour'); break;
      case 'foam': t.push(s.arg === 'cream' ? 'whip' : 'foam'); break;
      default: t.push(s.st);
    }
  }
  /* шаг «лёд» в конце холодного заказа — только там, где в рецепте есть цель льда: у протеина лёд не нужен (recipeNumbers.ice не задан), раньше шаг добавлялся без цели */
  if (o.cold && !t.includes('ice') && (d.temp !== 'cold' || hasIceTarget(d))) t.push('ice');
  return expandShots(t, n);
}

/** Какие напитки можно сделать холодными вариантом по просьбе (кроме старых с ключами ice*). */
export const coldVariantOk = (d: Drink): boolean => d.temp === 'both' && d.family === 'tea' && d.coldSizes.length > 0;

export interface TaskTarget { value: number; unit: string }
/** Цель для шага (единицы налива, секунды таймера). Налив считается по объёму: см. recipeNumbers в volumes.ts. */
export function taskTarget(key: string, task: string, size: Size = '0.3', cold = false): number {
  const dk = drinkOfKey(key);
  const d = drinkById[dk.id];
  if (!d) return 0;
  const sz = d.sizes[size] !== undefined ? size : ((Object.keys(d.sizes)[0] as Size | undefined) ?? size);
  const r = recipeNumbers(d, sz, cold || dk.cold);
  switch (task) {
    case 'ice': return r.ice ?? 0;
    case 'juice': return r.juice ?? 0;
    case 'tonic': return r.tonic ?? 0;
    case 'powder': return r.powder ?? 0;
    case 'boba': return r.boba ?? 0;
    case 'topping': return d.steps.find((s) => s.st === 'topping')?.arg === 'специи' ? SPICE_G : SAUCE_G;
    case 'whisk': return 4;
    case 'blend': return 6;
    case 'shake': return 5;
    case 'foam': return 4;
    case 'whip': return 3;
    case 'layer': return 4;
    default: return 0;
  }
}

/** Свои единицы и скорость налива для шага (щепотка специй, пюре в граммах); null — обычные. */
export function fillCfgFor(key: string, task: string): { rate?: number; max?: number; tol?: number; span?: number; unit?: string; noun?: string; min?: number } | null {
  const d = drinkById[drinkOfKey(key).id];
  if (!d) return null;
  if (task === 'topping' && d.steps.find((s) => s.st === 'topping')?.arg === 'специи')
    return { rate: 0.3, max: 1.5, tol: 0.15, span: 0.6, unit: 'г', noun: 'Специй', min: 0.1 };
  if (task === 'juice' && d.id === 'milkshake_banana') return { unit: 'г', noun: 'Пюре' };
  if (task === 'juice' && d.id === 'tea_currant') return { noun: 'Пюре' };
  return null;
}

/** Заварка: градусы/минуты из шага меню. */
export function brewOf(key: string): { temp: number; minutes: number } {
  const arg = drinkById[key]?.steps.find((s) => s.st === 'brew')?.arg ?? '95/4';
  const [t, m] = arg.split('/').map(Number);
  return { temp: t || 95, minutes: m || 4 };
}

export interface LegacyRecipe {
  /** молоко (у рафа сливки) в питчер до вспенивания, либо молоко в стакан без пара, мл */
  milk?: number;
  /** цель шкалы «Пена» */
  foam?: number;
  art?: boolean;
  /** вода в чашку, мл */
  water?: number;
  /** шоты плюс вода, мл (линия на шкале налива воды) */
  total?: number;
  /** лёд, г */
  ice?: number;
  cupMilk?: boolean;
  /** сколько шотов и объём чашки/напитка, мл */
  shots?: number;
  cupMl?: number;
  /** масштаб модели чашки */
  cupK?: number;
  /** зона пара, °C (без термометра) */
  zone?: [number, number];
  /** эспрессо делается сразу в питчер (раф) */
  pitcherShot?: boolean;
  /** холодный капучино: расширение холодного молока для рисунка */
  coldX?: number;
  /** заварка чая и вода матчи, мл: по ним бар рисует уровень в чашке (раньше брались константы 120 и 50 мл) */
  tea?: { g: number; waterMl: number };
  matcha?: { g: number; waterMl: number };
}
/** Виды пены: густая (капучино), лёгкая (латте и остальные), микро (флэт уайт). Цель шкалы «Пена» = расширение при вспенивании · 1,1. */
export const THICK: Readonly<Record<string, number>> = { thick: 0.55, thin: 0.22, micro: 0.11 };
/** Рецепт для механики налива/пара: цели бара по ключу, размеру и холодности (новые напитки — по своему размеру из меню). */
export function legacyRecipe(key: string, size?: Size, cold = false): LegacyRecipe {
  const dk = drinkOfKey(key);
  const d = drinkById[dk.id];
  if (!d) return {};
  const sz = size && d.sizes[size] !== undefined ? size : ((Object.keys(d.sizes)[0] as Size | undefined) ?? '0.2');
  const r = recipeNumbers(d, sz, cold || dk.cold);
  const out: LegacyRecipe = { shots: r.shots, cupMl: r.cupMl, cupK: cupScale(r.cupMl) };
  if (r.milk !== undefined) out.milk = r.milk;
  if (r.cupMilk) out.cupMilk = true;
  if (r.foam !== undefined) {
    out.foam = r.foam;
    out.art = d.steps.some((s) => s.st === 'pour' && !s.arg);
    out.zone = r.zone;
  }
  if (r.water !== undefined) {
    out.water = r.water;
    out.total = r.shots * 30 + r.water;
  }
  if (r.ice !== undefined) out.ice = r.ice;
  if (r.coldX) out.coldX = r.coldX;
  if (r.tea) out.tea = r.tea;
  if (r.matcha) out.matcha = r.matcha;
  if (d.family === 'raf') out.pitcherShot = true;
  return out;
}

/** Цвета содержимого чашки для рисования. */
export interface Palette { juice: string; tea: string; powder: string; blend: string; foam: string; topping: string; matcha: string; tonic: string }
const DEFAULT_PAL: Palette = { juice: '#F2A33A', tea: '#B5762E', powder: '#6B4331', blend: '#F3E6C8', foam: '#FBF4E8', topping: '#B7773F', matcha: '#8DAA4B', tonic: '#DCE8E2' };
const PAL: Readonly<Record<string, Partial<Palette>>> = {
  pomegranate_bumble: { juice: '#B3203F' },
  orange_bumble: { juice: '#F2A33A' },
  matcha_bumble: { juice: '#F2A33A' },
  hot_bumble: { juice: '#E8883A' },
  tea_currant: { juice: '#6B2C4F', tea: '#A0501E' },
  tea_sencha: { tea: '#C8B84A' },
  tea_assam: { tea: '#A0501E' },
  tea_hibiscus: { tea: '#B4234A' },
  tea_buckwheat: { tea: '#B88A3A' },
  boba_guava: { tea: '#C99A5A', topping: '#F28C7A' },
  boba_raspberry: { tea: '#C99A5A', topping: '#C94A63' },
  cocoa: { powder: '#6B4331' },
  chicory_latte: { powder: '#8A6A4E' },
  protein_milk: { powder: '#EADFCB' },
  protein_water: { powder: '#EADFCB' },
  milkshake_vanilla: { blend: '#F3E6C8' },
  milkshake_banana: { blend: '#F2DA8A', juice: '#F2DA8A' },
  frappe_caramel: { blend: '#C9A27A' },
  latte_coconut: { foam: '#B9A3D4' },
  matcha_coconut: { foam: '#B9A3D4' },
  latte_sakura: { foam: '#B9A3D4' },
  latte_lemon: { foam: '#B9A3D4' },
  latte_banana: { foam: '#E9D29A' },
  aerocano: { foam: '#FBF4E8' }
};
export const paletteOf = (key: string): Palette => ({ ...DEFAULT_PAL, ...(PAL[key] ?? {}) });

export const isNewKeyEngine = isMenuKey;

/** Подпись шага для билета и книги: «Шот 1/2», «Сливки» у рафа, остальное — TASK_NAME. */
export function stepLabels(tasks: readonly string[], drinkId = ''): string[] {
  const total: Record<string, number> = {};
  tasks.forEach((t) => (total[t] = (total[t] ?? 0) + 1));
  const seen: Record<string, number> = {};
  const raf = drinkById[drinkOfKey(drinkId).id]?.family === 'raf';
  return tasks.map((t) => {
    seen[t] = (seen[t] ?? 0) + 1;
    const name = t === 'milk' && raf ? 'Сливки' : (TASK_NAME[t] ?? t);
    return (total[t] ?? 1) > 1 ? `${name} ${seen[t]}/${total[t]}` : name;
  });
}

/** Без повторов, в порядке первого появления: шаги одного цикла (сам цикл шотов повторяется в баре). */
export const uniqueTasks = (tasks: readonly string[]): string[] => tasks.filter((t, i) => tasks.indexOf(t) === i);
