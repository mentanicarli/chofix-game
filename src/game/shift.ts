import type { Rng } from './types';

export const DAY_LEN = 300;
export const OPEN_MIN = 480;
export const SPAN_MIN = 600;
/** После 18:00 новых гостей нет, очередь дообслуживается; если за столько секунд не управились, день тихо заканчивается (без штрафа). */
export const CLOSING_LIMIT = 240;
export const RUSH_FROM = 720;
export const RUSH_TO = 780;

/** Время на часах в минутах от полуночи; t — секунды смены. */
export const clockMinutes = (t: number): number => OPEN_MIN + Math.min(1, t / DAY_LEN) * SPAN_MIN;
/** Для интервала приходов часы считаются без обрезки. */
const clockRaw = (t: number): number => OPEN_MIN + (t / DAY_LEN) * SPAN_MIN;
export const isRush = (t: number): boolean => {
  const c = clockRaw(t);
  return c >= RUSH_FROM && c < RUSH_TO;
};

/** Границы паузы между гостями, секунд, по номеру дня. */
export function arrivalRange(day: number): [number, number] {
  if (day === 1) return [42, 56];
  if (day === 2) return [36, 48];
  if (day === 3) return [30, 42];
  return [Math.max(20, 30 - 1.5 * (day - 3)), Math.max(28, 42 - 2 * (day - 3))];
}

export interface ArrivalIn { day: number; rating: number; t: number; wifi: boolean }
/** Через сколько секунд придёт следующий гость. */
export function arrivalInterval(i: ArrivalIn, rng: Rng = Math.random): number {
  const [a, b] = arrivalRange(i.day);
  let k = 1.25 - 0.1 * i.rating;
  if (isRush(i.t)) k *= 0.6;
  if (i.wifi) k *= 0.88;
  return (a + rng() * (b - a)) * k;
}

/** Идеальный помол на сегодня: в первый день всегда 3. */
export const idealGrind = (day: number, rng: Rng = Math.random): number =>
  day === 1 ? 3 : ([2, 3, 3, 4] as const)[Math.floor(rng() * 4)] ?? 3;
