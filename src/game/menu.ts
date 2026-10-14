import menuJson from '../../data/menu.json';
import progJson from '../../data/progression.json';
import type { AltMilk, Addon, Bottle, Drink, EquipmentDef, Food, MenuData, ProgressionData, RankDef, Syrup } from './types';

// Данные приходят из JSON, который генерирует data/build_menu.py. Форма проверяется тестом (menu.test.ts).
const MENU = menuJson as unknown as MenuData;
const PROG = progJson as unknown as ProgressionData;

export const STATIONS = MENU.stations;
export const DRINKS: readonly Drink[] = MENU.drinks;
export const FOOD: readonly Food[] = MENU.food;
export const BOTTLES: readonly Bottle[] = MENU.bottles;
/** Сиропы, которые есть только в составе рецептов (гость отдельно их не просит). */
const RECIPE_SYRUP_LIST: readonly Syrup[] = [
  { id: 'syr_sakura', name: 'Сакура-вишня', price: 0, rank: 6 },
  { id: 'syr_banana', name: 'Банан', price: 0, rank: 6 },
  { id: 'syr_lemonmer', name: 'Лимонная меренга', price: 0, rank: 6 },
  { id: 'syr_guava', name: 'Гуава-персик', price: 0, rank: 9 },
  { id: 'syr_raspberrylemon', name: 'Малина-лимон', price: 0, rank: 9 }
];
export const RECIPE_SYRUPS: ReadonlySet<string> = new Set(RECIPE_SYRUP_LIST.map((x) => x.name));
export const SYRUPS: readonly Syrup[] = [...MENU.syrups, ...RECIPE_SYRUP_LIST];
export const ALT_MILK: readonly AltMilk[] = MENU.altMilk;
export const ADDONS: readonly Addon[] = MENU.addons;
export const RANKS: readonly RankDef[] = PROG.ranks;
export const EQUIPMENT: readonly EquipmentDef[] = PROG.equipment;
export const PROMOTIONS = PROG.promotions;
export const MAX_RANK = RANKS[RANKS.length - 1]?.rank ?? 1;

export const drinkById: Readonly<Record<string, Drink>> = Object.fromEntries(DRINKS.map((d) => [d.id, d]));
export const rankInfo = (r: number): RankDef => RANKS.find((x) => x.rank === r) ?? (RANKS[0] as RankDef);

/** Напитки, которые уже умеет готовить бар: id меню → ключ механики старого ядра. Растёт вместе со станциями. */
export const ENGINE: Readonly<Record<string, string>> = {
  espresso: 'espresso',
  espresso_double: 'espresso2',
  americano: 'americano',
  cappuccino: 'cappuccino',
  latte: 'latte',
  flat_white: 'flatwhite',
  vanilla_raf: 'vanillaraf',
  raf: 'raf',
  raf_halva: 'rafhalva'
};
// Остальные напитки меню готовятся по своему id: рецепт собирается из шагов меню (см. recipes.ts).
for (const d of DRINKS) if (!(d.id in ENGINE)) (ENGINE as Record<string, string>)[d.id] = d.id;
/** Оборудование, которое уже работает в баре. */
export const EQ_IMPL: readonly string[] = [
  'cream', 'ice', 'case_snacks', 'case_pastry', 'case_dessert', 'fridge_deli', 'microwave',
  'powders', 'matcha', 'tea', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker'
];
/** Оборудование под шаг рецепта. */
const STEP_EQ: Readonly<Record<string, string>> = {
  whisk: 'matcha', brew: 'tea', powder: 'powders', juice: 'juice', tonic: 'juice', blend: 'blender', boba: 'boba', shake: 'shaker', ice: 'ice', cream: 'cream'
};
/** Оборудование, необходимое напитку: вычисляется из шагов рецепта. */
export const DRINK_NEEDS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  DRINKS.map((d) => {
    const need = new Set<string>();
    for (const st of d.steps) {
      if (st.st === 'foam') need.add(st.arg === 'cream' ? 'whipper' : 'foamer');
      else if (STEP_EQ[st.st]) need.add(STEP_EQ[st.st] as string);
    }
    return [d.id, [...need]] as const;
  })
);
/** Нужно ли напитку молоко (холодильник с молоком). У рафа молока нет: ему нужен кувшин сливок (eq_cream). */
export const needsMilk = (d: Drink): boolean => d.steps.some((s) => s.st === 'milk');
/** Холодные версии (льдогенератор): ключ механики обычного напитка → ключ холодного. */
export const ICED: Readonly<Record<string, string>> = { americano: 'icedamericano', latte: 'icedlatte', cappuccino: 'icedcappuccino' };
/** Ключ механики → напиток меню и холодный ли он (для старых ручных напитков; новые идут по своему id). */
export const KEY_DRINK: Readonly<Record<string, { id: string; cold: boolean }>> = {
  espresso: { id: 'espresso', cold: false }, espresso2: { id: 'espresso_double', cold: false },
  americano: { id: 'americano', cold: false }, icedamericano: { id: 'americano', cold: true },
  cappuccino: { id: 'cappuccino', cold: false }, icedcappuccino: { id: 'cappuccino', cold: true },
  latte: { id: 'latte', cold: false }, icedlatte: { id: 'latte', cold: true },
  flatwhite: { id: 'flat_white', cold: false }, raf: { id: 'raf', cold: false }, vanillaraf: { id: 'vanilla_raf', cold: false }, rafhalva: { id: 'raf_halva', cold: false }
};
/** Напиток меню и холодность по ключу механики. */
export const drinkOfKey = (key: string): { id: string; cold: boolean } => KEY_DRINK[key] ?? { id: key, cold: false };

/** Напитки, где сироп — часть рецепта (гость не просит его отдельно). */
export const FORCED_SYRUP: Readonly<Record<string, string>> = {
  vanilla_raf: 'Ваниль', raf_halva: 'Халва',
  latte_coconut: 'Кокос', matcha_coconut: 'Кокос', cappuccino_pumpkin: 'Тыква',
  latte_sakura: 'Сакура-вишня', latte_banana: 'Банан', latte_lemon: 'Лимонная меренга',
  boba_guava: 'Гуава-персик', boba_raspberry: 'Малина-лимон',
  milkshake_vanilla: 'Ваниль', frappe_caramel: 'Карамель'
};

/** Старые молочные напитки (ручная механика пара). */
export const MILKY_OLD: readonly string[] = ['cappuccino', 'latte', 'flatwhite', 'raf', 'vanillaraf', 'rafhalva'];

export interface SyrupMeta { key: string; col: string; short: string }
export const SYRUP_META: Readonly<Record<string, SyrupMeta>> = {
  'Ваниль': { key: 'vanilla', col: '#E8C766', short: 'Ваниль' },
  'Карамель': { key: 'caramel', col: '#B7773F', short: 'Карамель' },
  'Миндаль': { key: 'almond', col: '#C9A27A', short: 'Миндаль' },
  'Соленая карамель': { key: 'salted', col: '#A8683A', short: 'Солёная кар.' },
  'Каштан': { key: 'chestnut', col: '#8A6A4E', short: 'Каштан' },
  'Халва': { key: 'halva', col: '#D9B26A', short: 'Халва' },
  'Тыква': { key: 'pumpkin', col: '#E08A3C', short: 'Тыква' },
  'Кокос': { key: 'coconut', col: '#EFE6D2', short: 'Кокос' },
  'Персик': { key: 'peach', col: '#F0A57A', short: 'Персик' },
  'Лаванда': { key: 'lavender', col: '#B29BD0', short: 'Лаванда' },
  'Ваниль (без сахара)': { key: 'vanilla0', col: '#F0DC9A', short: 'Ваниль б/с' },
  'Карамель (без сахара)': { key: 'caramel0', col: '#D09A60', short: 'Карамель б/с' },
  'Малина (без сахара)': { key: 'raspberry0', col: '#D2506A', short: 'Малина б/с' },
  'Шоколад (без сахара)': { key: 'chocolate0', col: '#6B4331', short: 'Шоколад б/с' },
  'Сакура-вишня': { key: 'sakura', col: '#F0A5B8', short: 'Сакура' },
  'Банан': { key: 'banana', col: '#F2DA8A', short: 'Банан' },
  'Лимонная меренга': { key: 'lemonmer', col: '#F3E27A', short: 'Лимон. мер.' },
  'Гуава-персик': { key: 'guava', col: '#F28C7A', short: 'Гуава' },
  'Малина-лимон': { key: 'raspberrylemon', col: '#C94A63', short: 'Малина-лимон' }
};
export const syrupByName: Readonly<Record<string, Syrup>> = Object.fromEntries(SYRUPS.map((s) => [s.name, s]));

export function priceOf(id: string, size: keyof Drink['sizes'] = '0.2'): number {
  const d = drinkById[id];
  if (!d) return 0;
  return d.sizes[size] ?? Object.values(d.sizes)[0] ?? 0;
}

export interface UnlockState { rank: number }
export const isDrinkUnlocked = (d: Drink, s: UnlockState): boolean => d.rank <= s.rank;
export const isOrderable = (d: Drink, s: UnlockState): boolean => d.id in ENGINE && isDrinkUnlocked(d, s);

export interface ProgressStats { day: number; rating: number; served: number }
/** Следующий ранг, если условия выполнены (иначе null). */
export function nextRank(rank: number, stats: ProgressStats): RankDef | null {
  if (rank >= MAX_RANK) return null;
  const n = rankInfo(rank + 1);
  return stats.day >= n.minDay && stats.rating >= n.minRating && stats.served >= n.minServed ? n : null;
}
/** Чего не хватает до следующего ранга. */
export function rankGap(rank: number, stats: ProgressStats): { next: RankDef; missing: string[] } | null {
  if (rank >= MAX_RANK) return null;
  const n = rankInfo(rank + 1);
  const missing: string[] = [];
  if (stats.day < n.minDay) missing.push(`день ${n.minDay}`);
  if (stats.rating < n.minRating) missing.push(`рейтинг ${n.minRating.toFixed(1)}`);
  if (stats.served < n.minServed) missing.push(`подано ${n.minServed}`);
  return { next: n, missing };
}
/** Позиции, открывающиеся на ранге r. */
export function unlockedAt(r: number) {
  const by = <T extends { rank: number }>(a: readonly T[]) => a.filter((x) => x.rank === r);
  return {
    drinks: by(DRINKS), food: by(FOOD), bottles: by(BOTTLES), syrups: by(SYRUPS),
    altMilk: by(ALT_MILK), addons: by(ADDONS), equipment: EQUIPMENT.filter((e) => e.rank === r)
  };
}
