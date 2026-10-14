import type { Quality } from './types';

export const WEIGHT: Readonly<Record<string, number>> = {
  grind: 0.1, tamp: 0.12, shot: 0.33, water: 0.12, milk: 0.05, steam: 0.2, pour: 0.2, syrup: 0.1, ice: 0.1, food: 0.15,
  whisk: 0.3, brew: 0.6, juice: 0.12, tonic: 0.12, powder: 0.2, boba: 0.12, topping: 0.05, blend: 0.3, shake: 0.3, foam: 0.2, whip: 0.2, layer: 0.2
};
export const GOOD = 0.78;
export const OK = 0.5;
/** Оценка невыполненного шага. */
export const MISSING = 0.4;

/** Взвешенная оценка напитка 0..1. res — оценка каждого шага (null/undefined — не сделан). */
export function score(tasks: readonly string[], res: Readonly<Record<string, number | null | undefined>>): number {
  let sum = 0;
  let ws = 0;
  for (const t of tasks) {
    const w = WEIGHT[t] ?? 0;
    sum += (res[t] ?? MISSING) * w;
    ws += w;
  }
  return ws ? sum / ws : 0.5;
}
export const levelOf = (s: number): Quality => (s >= GOOD ? 2 : s >= OK ? 1 : 0);

type Res = Readonly<Record<string, number | null | undefined>>;
/**
 * Оценка напитка с повторяющимися шагами (двойной эспрессо: два цикла «помол, темпер, шот»).
 * tasks — полный список шагов с повторами; past[k] — оценки уже законченного цикла k, res — текущего.
 */
export function scoreSteps(tasks: readonly string[], res: Res, past: readonly Res[] = []): number {
  const seen: Record<string, number> = {};
  let sum = 0;
  let ws = 0;
  for (const t of tasks) {
    const k = seen[t] ?? 0;
    seen[t] = k + 1;
    const repeated = tasks.indexOf(t) !== tasks.lastIndexOf(t);
    const r = repeated && k < past.length ? (past[k] as Res)[t] : res[t];
    const w = WEIGHT[t] ?? 0;
    sum += (r ?? MISSING) * w;
    ws += w;
  }
  return ws ? sum / ws : 0.5;
}
