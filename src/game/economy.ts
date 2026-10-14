import { drinkById, drinkOfKey } from './menu';
import { recipeNumbers } from './volumes';
import type { Recipe } from './volumes';
import type { CustomerType, PaceId, Quality, Size } from './types';

/** Цены ингредиентов. E — за шот, остальное за мл или грамм; расходники (стакан, крышка) растут с размером. */
export const COST = { E: 18, W: 0.03, M: 0.16, ICE: 0.03 } as const;
export const UNIT_COST = {
  /** сливки для рафа, мл */
  cream: 0.2,
  /** помпа сиропа */
  pump: 2.5,
  tonic: 0.08,
  /** сок или пюре по напитку, мл (г) */
  juice: { orange_bumble: 0.12, pomegranate_bumble: 0.2, hot_bumble: 0.12, matcha_bumble: 0.12, tea_currant: 0.3, milkshake_banana: 0.25 } as Readonly<Record<string, number>>,
  powder: { cocoa: 0.5, chicory_latte: 0.6, protein_milk: 1.2, protein_water: 1.2 } as Readonly<Record<string, number>>,
  tea: 1.5,
  matcha: 6,
  tapioca: 0.5,
  iceCream: 0.35,
  topFoam: 0.4,
  /** сливочная пена аэрокано (сливки 33%) */
  whip: 0.5,
  sauce: 0.5,
  /** стакан, крышка, салфетка: 5 + 0,03 · мл */
  cupBase: 5,
  cupPerMl: 0.03
} as const;
export const SYRUP_SURCHARGE = 20;

export interface Pace { name: string; pat: number; rent: number; text: string }
export const PACE: Readonly<Record<PaceId, Pace>> = {
  cozy: { name: 'Уютный', pat: 1.5, rent: 100, text: 'Клиенты терпеливее, банкротства нет' },
  normal: { name: 'Обычный', pat: 1.0, rent: 140, text: 'Можно уйти в минус, но не слишком глубоко' },
  hard: { name: 'Жёсткий', pat: 0.75, rent: 190, text: 'Быстрые клиенты, минус на счёте означает конец' }
};

const BASE_PATIENCE: Readonly<Record<CustomerType, number>> = { regular: 120, student: 140, hurry: 75 };

export interface PatienceOpts { pace: PaceId; cozy?: boolean; helper?: boolean }
/** Максимальное терпение гостя, секунд. */
export const patienceMax = (type: CustomerType, o: PatienceOpts): number =>
  BASE_PATIENCE[type] * PACE[o.pace].pat * (o.cozy ? 1.15 : 1) * (o.helper ? 1.2 : 1);

export interface SettleIn {
  /** Цена напитка из меню (без надбавок). */
  basePrice: number;
  beans: boolean;
  /** Сироп по просьбе гостя (не входящий в рецепт). */
  paidSyrup: boolean;
  /** Блюдо с витрины к напитку, ₽ (зерно получше на него не действует). */
  extra?: number;
  quality: Quality;
  type: CustomerType;
  /** Чашка отдана почти без потерь (cup.s > .92). */
  flawless: boolean;
  cards: boolean;
  rating: number;
}
export interface Settled { price: number; tip: number; total: number; rating: number }

/** Расчёт при выдаче напитка: цена, чаевые, новый рейтинг. */
export function settle(i: SettleIn): Settled {
  let price = Math.round(i.basePrice * (i.beans ? 1.15 : 1)) + (i.paidSyrup ? SYRUP_SURCHARGE : 0) + (i.extra ?? 0);
  let tip = 0;
  if (i.quality === 0) price = Math.round(price * 0.6);
  else if (i.quality === 2) tip = Math.round(price * 0.2);
  if (i.type === 'hurry' && i.quality >= 1) tip += Math.round(price * 0.25);
  if (i.flawless) tip += Math.round(price * 0.1);
  const k = i.cards ? 1.6 : 1;
  const delta = ([-0.08, 0.015 * k, 0.05 * k] as const)[i.quality];
  return { price, tip, total: price + tip, rating: Math.min(5, Math.max(1, i.rating + delta)) };
}

/** Рейтинг после ушедшего гостя. */
export const ratingAfterLoss = (rating: number): number => Math.max(1, rating - 0.15);

/** Плата за аренду и проверка конца игры в конце дня. */
export const rentFor = (pace: PaceId, rank = 1): number => Math.round((PACE[pace].rent * (1 + 0.45 * (Math.max(1, rank) - 1))) / 10) * 10;

/** Зарплата помощника за смену: берёт часть выручки на себя, поэтому растёт вместе с рангом. */
export const helperWage = (rank: number): number => 60 + 25 * Math.max(0, rank - 4);

export function settleDay(i: { money: number; pace: PaceId; rank?: number; wage?: number }): { money: number; over: boolean; rent: number } {
  const rent = rentFor(i.pace, i.rank) + (i.wage ?? 0);
  let money = i.money - rent;
  if (i.pace === 'cozy' && money < 0) money = 0;
  const over = (i.pace === 'hard' && money < 0) || (i.pace === 'normal' && money < -600);
  return { money, over, rent };
}

/** Напитки с молочным циклом (молоко, вспенивание, подача) в баре. */
export const MILKY_KEYS: ReadonlySet<string> = new Set(['cappuccino', 'latte', 'flatwhite', 'raf', 'vanillaraf', 'rafhalva']);

/** Себестоимость рецепта: ингредиенты по реальным объёмам плюс расходники. */
export function recipeCost(r: Recipe): number {
  let c = r.shots * COST.E;
  const raf = drinkById[r.id]?.family === 'raf';
  if (r.milk !== undefined) c += r.milk * (raf ? UNIT_COST.cream : COST.M);
  if (r.water !== undefined) c += r.water * COST.W;
  if (r.ice !== undefined) c += r.ice * COST.ICE;
  c += r.pumps * UNIT_COST.pump;
  if (r.juice !== undefined) c += r.juice * (UNIT_COST.juice[r.id] ?? 0.12);
  if (r.tonic !== undefined) c += r.tonic * UNIT_COST.tonic;
  if (r.powder !== undefined) c += r.powder * (UNIT_COST.powder[r.id] ?? 0.5);
  if (r.tea) c += r.tea.g * UNIT_COST.tea;
  if (r.matcha) c += r.matcha.g * UNIT_COST.matcha;
  if (r.boba !== undefined) c += r.boba * UNIT_COST.tapioca;
  if (r.id === 'aerocano') c += (r.topFoam ?? 0) * UNIT_COST.whip;
  else if (r.topFoam) c += r.topFoam * UNIT_COST.topFoam;
  if (r.id === 'milkshake_vanilla' || r.id === 'milkshake_banana') c += 0.3 * r.drinkMl * UNIT_COST.iceCream;
  if (r.parts.some((p) => p.task === 'topping' && p.label.startsWith('Карамельный'))) c += 8 * UNIT_COST.sauce;
  c += UNIT_COST.cupBase + UNIT_COST.cupPerMl * r.cupMl;
  return Math.round(c);
}

/** Себестоимость заказа: по ключу механики бара, размеру и холодности (без размера берётся первый из меню). */
export function drinkCost(key: string, beans: boolean, o: { size?: Size; cold?: boolean } = {}): number {
  const dk = drinkOfKey(key);
  const d = drinkById[dk.id];
  if (!d) return COST.E;
  const size = o.size && d.sizes[o.size] !== undefined ? o.size : ((Object.keys(d.sizes)[0] as Size | undefined) ?? '0.2');
  const r = recipeNumbers(d, size, !!o.cold || dk.cold);
  return recipeCost(r) + (beans ? 6 * r.shots : 0);
}
