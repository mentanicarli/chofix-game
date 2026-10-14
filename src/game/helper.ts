import type { Quality, Rng } from './types';

/** Помощник справляется только с простыми напитками без сиропов и блюд. */
export const HELPER_KEYS: ReadonlySet<string> = new Set(['espresso', 'espresso2', 'americano', 'icedamericano']);
export const HELPER_MIN_RANK = 5;

export interface HelperGuest { id: number; drink: string; arrived: boolean; leaving: boolean; pat: number; syrup: string | null; food: boolean }

/** Сколько секунд помощник готовит напиток: каждый шот сверх первого (двойной эспрессо, 0.4 и 0.6 л) добавляет ещё один полный цикл. */
export const helperPrepTime = (key: string, shots = 1): number => (key === 'espresso' || key === 'espresso2' ? 16 : key === 'americano' ? 20 : 26) + 16 * (Math.max(1, shots) - 1);

/** Берёт самого нетерпеливого из тех, кого можно отдать помощнику. */
export function helperPick(guests: readonly HelperGuest[], busyId: number | null): HelperGuest | null {
  let best: HelperGuest | null = null;
  for (const g of guests) {
    if (!g.arrived || g.leaving || g.id === busyId || g.syrup || g.food || !HELPER_KEYS.has(g.drink)) continue;
    if (!best || g.pat < best.pat) best = g;
  }
  return best;
}

/** Качество напитка помощника: чаще «нормально», с ростом ранга реже брак. */
export function helperQuality(rank: number, rng: Rng = Math.random): Quality {
  const bad = Math.max(0.04, 0.12 - 0.02 * Math.max(0, rank - 5));
  const good = 0.15 + 0.03 * Math.max(0, rank - 5);
  const r = rng();
  return r < bad ? 0 : r < bad + good ? 2 : 1;
}
