import { FOOD } from './menu';
import type { Food, OrderFood, Rng } from './types';

/** Какое оборудование держит каждую витрину. */
export const CASE_EQ: Readonly<Record<string, string>> = {
  snacks: 'case_snacks',
  pastry: 'case_pastry',
  dessert: 'case_dessert',
  deli: 'fridge_deli'
};
export const MICROWAVE = 'microwave';
export const FOOD_COST_SHARE = 0.45;
export const FOOD_CHANCE = 0.4;

export interface ShowcaseState {
  rank: number;
  day?: number;
  eq?: Readonly<Record<string, boolean | undefined>>;
}

/** Блюда, доступные на витринах прямо сейчас. */
export function foodAvailable(s: ShowcaseState): Food[] {
  const eq = s.eq ?? {};
  return FOOD.filter((f) => f.rank <= s.rank && !!eq[CASE_EQ[f.case] ?? '']);
}

/** Берёт ли гость еду к напитку. Если витрин нет — ничего не бросаем (случайные числа не расходуются). */
export function rollFood(s: ShowcaseState, rng: Rng): OrderFood | null {
  const pool = foodAvailable(s);
  if (!pool.length || (s.day ?? 99) < 2) return null;
  if (rng() >= FOOD_CHANCE) return null;
  const f = pool[Math.floor(rng() * pool.length) % pool.length] as Food;
  const heat = f.heatable && !!s.eq?.[MICROWAVE] && rng() < 0.5;
  return { id: f.id, name: f.name, price: f.price, case: f.case, heat };
}

/** Блюда на выбор игроку: нужное и до n−1 других (перемешаны). */
export function foodChoices(s: ShowcaseState, targetId: string, rng: Rng, n = 8): Food[] {
  const pool = foodAvailable(s);
  const target = FOOD.find((f) => f.id === targetId);
  const others = pool.filter((f) => f.id !== targetId);
  // сначала блюда из той же витрины: так выбор похож на настоящий
  others.sort((a, b) => Number(b.case === target?.case) - Number(a.case === target?.case) + (rng() - 0.5) * 0.9);
  const list = [...(target ? [target] : []), ...others.slice(0, n - 1)];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j] as Food, list[i] as Food];
  }
  return list;
}
