import { MILKY_OLD, drinkById } from './menu';
import type { Drink, Size } from './types';

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
  'espresso', 'americano', 'icedamericano', 'icedlatte', 'icedcappuccino', 'cappuccino', 'latte', 'flatwhite', 'raf', 'vanillaraf', 'rafhalva'
]);
export const isMenuKey = (key: string): boolean => key in drinkById && !OLD_KEYS.has(key);

const OLD_MILKY = new Set(MILKY_OLD);

export interface BuildOpts {
  /** Холодная версия: для старых напитков ключ уже ice*, для новых чаёв добавляется лёд. */
  cold: boolean;
  /** У заказа есть сироп. */
  syrup: boolean;
}

/** Шаги бара по ключу механики. */
export function buildTasks(key: string, o: BuildOpts): string[] {
  const t: string[] = [];
  if (o.syrup) t.push('syrup');
  const d = isMenuKey(key) ? drinkById[key] : undefined;
  if (!d) {
    // старые напитки с ручной механикой
    t.push('grind', 'tamp', 'shot');
    if (key === 'americano') t.push('water');
    if (key === 'icedamericano') t.push('ice', 'water');
    if (key === 'icedlatte' || key === 'icedcappuccino') t.push('ice', 'milk');
    if (OLD_MILKY.has(key)) t.push('milk', 'steam', 'pour');
    return t;
  }
  for (const s of d.steps) {
    switch (s.st) {
      case 'syrup': break; // сироп уже первым шагом (по заказу)
      case 'cream': break; // сливки входят в раф: отдельного шага нет
      case 'shot_only': t.push('grind', 'tamp', 'shot'); break;
      case 'pour': t.push(s.arg === 'layer' ? 'layer' : 'pour'); break;
      case 'foam': t.push(s.arg === 'cream' ? 'whip' : 'foam'); break;
      default: t.push(s.st);
    }
  }
  if (o.cold && !t.includes('ice')) t.push('ice');
  return t;
}

/** Какие напитки можно сделать холодными вариантом по просьбе (кроме старых с ключами ice*). */
export const coldVariantOk = (d: Drink): boolean => d.temp === 'both' && d.family === 'tea' && d.coldSizes.length > 0;

const SIZE_K: Readonly<Record<Size, number>> = { '0.2': 1, '0.3': 1, '0.4': 1.15, '0.6': 1.3 };

export interface TaskTarget { value: number; unit: string }
/** Цель для шага (единицы налива, секунды таймера). */
export function taskTarget(key: string, task: string, size: Size = '0.3'): number {
  const k = SIZE_K[size] ?? 1;
  const d = drinkById[key];
  const id = d?.id ?? key;
  switch (task) {
    case 'ice': return 100;
    case 'juice': return Math.round((id === 'tea_currant' ? 60 : id === 'hot_bumble' ? 130 : 100) * k);
    case 'tonic': return Math.round(120 * k);
    case 'powder': return id === 'chicory_latte' ? 20 : id === 'cocoa' ? 25 : 30;
    case 'boba': return Math.round(60 * k);
    case 'topping': return 8;
    case 'whisk': return 4;
    case 'blend': return 6;
    case 'shake': return 5;
    case 'foam': return 4;
    case 'whip': return 3;
    case 'layer': return 4;
    default: return 0;
  }
}

/** Заварка: градусы/минуты из шага меню. */
export function brewOf(key: string): { temp: number; minutes: number } {
  const arg = drinkById[key]?.steps.find((s) => s.st === 'brew')?.arg ?? '95/4';
  const [t, m] = arg.split('/').map(Number);
  return { temp: t || 95, minutes: m || 4 };
}

export interface LegacyRecipe { milk?: number; foam?: number; art?: boolean; total?: number; ice?: number; cupMilk?: boolean }
const THICK: Readonly<Record<string, number>> = { thick: 0.55, thin: 0.26, micro: 0.16 };
/** Рецепт для старой механики налива/пара. */
export function legacyRecipe(key: string): LegacyRecipe {
  const d = isMenuKey(key) ? drinkById[key] : undefined;
  if (!d) return {};
  const r: LegacyRecipe = {};
  const steam = d.steps.find((s) => s.st === 'steam');
  const hasMilk = d.steps.some((s) => s.st === 'milk');
  if (hasMilk) r.milk = steam ? (steam.arg === 'thick' ? 140 : 200) : d.family === 'shake' ? 200 : 220;
  if (steam) { r.foam = THICK[steam.arg ?? 'thin'] ?? 0.26; r.art = d.steps.some((s) => s.st === 'pour' && !s.arg); }
  if (d.steps.some((s) => s.st === 'water')) r.total = d.id === 'protein_water' ? 300 : 150;
  if (d.steps.some((s) => s.st === 'ice')) r.ice = 100;
  if (hasMilk && !steam) r.cupMilk = true;
  return r;
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
  milkshake_banana: { blend: '#F2DA8A' },
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

/** Цвет верхнего слоя напитка (для чашки в руке и иконки). */
export function topColorOf(key: string): string {
  const d = isMenuKey(key) ? drinkById[key] : undefined;
  const p = paletteOf(key);
  if (!d) return '#5A3A2A';
  const has = (s: string) => d.steps.some((x) => x.st === s);
  if (has('foam')) return p.foam;
  if (has('blend') || has('shake')) return p.blend;
  if (has('steam')) return '#F1DFC2';
  if (has('layer')) return p.juice;
  if (has('whisk')) return p.matcha;
  if (has('brew')) return p.tea;
  if (has('juice')) return p.juice;
  if (has('tonic')) return p.tonic;
  if (has('powder')) return p.powder;
  return '#5A3A2A';
}
