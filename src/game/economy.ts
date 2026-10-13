import { drinkById, priceOf } from './menu';
import { isMenuKey } from './recipes';
import type { CustomerType, PaceId, Quality } from './types';

export const COST = { E: 18, W: 4, M: 28, ICE: 3 } as const;
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

/** Себестоимость напитка по ключу механики бара. */
export function drinkCost(key: string, beans: boolean): number {
  let c: number;
  if (key === 'espresso') c = COST.E;
  else if (key === 'americano') c = COST.E + COST.W;
  else if (key === 'icedamericano') c = COST.E + COST.W + COST.ICE;
  else if (key === 'icedlatte') c = COST.E + COST.M + 8 + COST.ICE;
  else if (key === 'icedcappuccino') c = COST.E + COST.M + 10 + COST.ICE;
  else if (key === 'latte') c = COST.E + COST.M + 8;
  else if (key === 'flatwhite') c = COST.E + COST.M + 4;
  else if (MILKY_KEYS.has(key)) c = COST.E + COST.M + 10;
  else if (isMenuKey(key)) c = Math.round(priceOf(key, (Object.keys(drinkById[key]?.sizes ?? {})[0] ?? '0.3') as '0.3') * 0.33);
  else c = COST.E + COST.M;
  return c + (beans ? 6 : 0);
}
