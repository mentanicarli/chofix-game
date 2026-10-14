import { PACE } from './economy';
import { buildTasks } from './recipes';
import type { CustomerType, PaceId, Rng } from './types';

/* ---------- Терпение гостей: зависит от сложности заказа, дня игры и места в очереди ----------
   patienceMax = (A_type + K_type · estimatedPrepSeconds(order)) · random · pace · cozy · helper · newbie
   Чистая логика: ни DOM, ни Pixi. Числа подбираются по симулятору (scripts/shop-sim.test.ts). */

/** Типичные секунды на шаг бара (из реального замера: около 10 с на шаг). */
export const STEP_SECONDS: Readonly<Record<string, number>> = {
  grind: 8, tamp: 7, shot: 11, water: 5, milk: 7, steam: 10, pour: 11, syrup: 7, ice: 6, food: 8,
  whisk: 8, brew: 12, juice: 6, tonic: 6, powder: 6, boba: 6, topping: 5, blend: 8, shake: 7, foam: 7, whip: 7, layer: 8
};
/** Запас на заказ: принять, отдать, гость подходит. */
export const ORDER_OVERHEAD_SECONDS = 11;
/** Шаг, которого нет в таблице. */
export const STEP_SECONDS_DEFAULT = 10;

export interface PrepOrder {
  key: string;
  cold: boolean;
  shots: number;
  syrup: unknown;
  food: unknown;
}
/** Сколько секунд у игрока уйдёт на заказ: шаги по `buildTasks` (двойной эспрессо — два полных цикла) плюс запас. */
export function estimatedPrepSeconds(o: PrepOrder): number {
  const tasks = buildTasks(o.key, { cold: !!o.cold, syrup: !!o.syrup, shots: o.shots });
  if (o.food) tasks.push('food');
  return ORDER_OVERHEAD_SECONDS + tasks.reduce((a, t) => a + (STEP_SECONDS[t] ?? STEP_SECONDS_DEFAULT), 0);
}

/** A (запас, с) и K (множитель времени заказа) по типу гостя: нетерпеливый ждёт меньше, но сложный заказ даёт запас и ему. */
export const PATIENCE_A: Readonly<Record<CustomerType, number>> = { regular: 60, student: 70, hurry: 35 };
export const PATIENCE_K: Readonly<Record<CustomerType, number>> = { regular: 1.6, student: 1.8, hurry: 1.0 };
/** Случайный множитель на каждого гостя. */
export const PATIENCE_RANDOM: readonly [number, number] = [0.85, 1.25];
/** Поддержка новичков по дню игры: день 1 ×1,4, день 2 ×1,3, день 3 ×1,2, дни 4–5 ×1,1, дальше ×1. */
export const newbieFactor = (day: number): number => (day <= 1 ? 1.4 : day === 2 ? 1.3 : day === 3 ? 1.2 : day <= 5 ? 1.1 : 1);

export interface PatienceOpts {
  pace: PaceId;
  cozy?: boolean;
  helper?: boolean;
  /** секунды готовки заказа (estimatedPrepSeconds); без заказа — 0 */
  prep?: number;
  /** день игры для поддержки новичков; без дня — без неё */
  day?: number;
  /** генератор случайных чисел для множителя; без него множитель 1 */
  rng?: Rng;
}
/** Максимальное терпение гостя, секунд. */
export function patienceMax(type: CustomerType, o: PatienceOpts): number {
  const [lo, hi] = PATIENCE_RANDOM;
  const rand = o.rng ? lo + (hi - lo) * o.rng() : 1;
  const base = PATIENCE_A[type] + PATIENCE_K[type] * (o.prep ?? 0);
  return base * rand * PACE[o.pace].pat * (o.cozy ? 1.15 : 1) * (o.helper ? 1.2 : 1) * (o.day !== undefined ? newbieFactor(o.day) : 1);
}

/* ---------- очередь у стойки ---------- */

/** Гость очереди: любое поле `leaving: true` значит «уходит» (такой в очереди не стоит). */
const gone = (g: object): boolean => (g as { leaving?: boolean }).leaving === true;
/** Первый в очереди: пришёл раньше всех из тех, кто ещё не ушёл (гости идут в порядке прихода). null — очередь пуста. */
export function queueOrder<T extends object>(guests: readonly T[]): T | null {
  return guests.find((g) => !gone(g)) ?? null;
}
/** Места в очереди (0 — первый), не ушедшие гости по порядку прихода. */
export const queuePosition = <T extends object>(guests: readonly T[], g: T): number => guests.filter((x) => !gone(x)).indexOf(g);

/** Скорость убывания терпения по месту: первый 1, второй 0,5, третий и дальше 0,3. Не возрастает с местом. */
export const QUEUE_DECAY: readonly number[] = [1, 0.5, 0.3];
export const queueDecayRate = (position: number): number => QUEUE_DECAY[Math.min(Math.max(0, position), QUEUE_DECAY.length - 1)] as number;
