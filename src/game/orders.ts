import { DRINKS, DRINK_NEEDS, ENGINE, FORCED_SYRUP, ICED, RECIPE_SYRUPS, SYRUPS, SYRUP_META, isOrderable, needsMilk, priceOf, syrupByName } from './menu';
import { coldVariantOk, isNewKeyEngine } from './recipes';
import { forceFood, rollFood } from './food';
import { drinkFitsItem, foodWantOfItem, orderUsesItem } from './shop';
import { say } from './phrases';
import type { CustomerType, Drink, Order, Rng, Size } from './types';

const wpick = <T>(rng: Rng, list: readonly (readonly [T, number])[]): T => {
  const total = list.reduce((a, x) => a + x[1], 0);
  let r = rng() * total;
  for (const x of list) if ((r -= x[1]) <= 0) return x[0];
  return (list[0] as readonly [T, number])[0];
};

export const MILKY = /^(milk|raf|foamlatte)$/;
export const SYRUP_PRICE = 20;

const WEIGHTS: Readonly<Record<string, number>> = {
  espresso_double: 0.4,
  americano: 0.3,
  cappuccino: 0.25,
  latte: 0.25,
  flat_white: 0.15,
  vanilla_raf: 0.2,
  raf: 0.2,
  raf_halva: 0.15
};
const baseW = (d: Drink): number => WEIGHTS[d.id] ?? 0.2;

export interface OrderState {
  rank: number;
  day: number;
  /** Есть ли молочная техника. */
  milk: boolean;
  eq?: Readonly<Record<string, boolean | undefined>>;
  /** Вчерашняя покупка (id позиции магазина): этот заказ должен её использовать. Без неё заказы считаются как обычно. */
  focus?: string;
}

/** Бросок заказа: что гость закажет сейчас. key — механика бара. */
export function rollOrder(state: OrderState, type: CustomerType, rng: Rng = Math.random): Order {
  const eq = state.eq ?? {};
  const unlocked = DRINKS.filter((d) => isOrderable(d, state) && (!needsMilk(d) || state.milk) && (DRINK_NEEDS[d.id] ?? []).every((n) => eq[n]));
  let pool = unlocked.filter((d) => !(type === 'student' && d.family === 'milk' && state.day < 3));
  if (state.focus) {
    const focus = state.focus;
    const fit = unlocked.filter((d) => drinkFitsItem(focus, d));
    if (fit.length) pool = fit;
  }
  const from = pool.length ? pool : DRINKS.filter((d) => d.id === 'americano');
  const d = wpick(rng, from.map((x) => [x, baseW(x)] as const));
  let key = ENGINE[d.id] as string;
  // Холодная версия: нужен льдогенератор, у напитка есть холодные объёмы и механика льда.
  const coldSize = d.coldSizes[0];
  const fresh = isNewKeyEngine(key);
  let cold: boolean;
  let size: Size;
  if (fresh) {
    // напиток из меню по шагам: размер из его списка; чай бывает холодным по желанию гостя
    cold = !!eq['ice'] && coldVariantOk(d) && !!coldSize && (rng() < 0.3 || state.focus === 'eq_ice');
    const sizes = Object.keys(d.sizes) as Size[];
    size = cold && coldSize ? coldSize : (sizes[Math.floor(rng() * sizes.length) % sizes.length] as Size);
  } else {
    cold = !!eq['ice'] && key in ICED && !!coldSize && (rng() < 0.3 || state.focus === 'eq_ice');
    size = cold && coldSize ? coldSize : '0.2';
  }
  const baseKey = key;
  if (cold && !fresh) key = ICED[baseKey] as string;
  const strong = state.day >= 2 && rng() < 0.25;
  const forced = FORCED_SYRUP[d.id];
  const open = SYRUPS.filter((s) => s.rank <= state.rank && SYRUP_META[s.name] && !RECIPE_SYRUPS.has(s.name));
  const canSyrup = !fresh || d.steps.some((x) => x.st === 'milk' || x.st === 'shot');
  const withSyrup = forced || (canSyrup && open.length > 0 && baseKey !== 'espresso' && state.day >= 2 && rng() < 0.3);
  const syrup = forced ? syrupByName[forced] : withSyrup ? open[Math.floor(rng() * open.length) % open.length] : undefined;
  const meta = syrup ? SYRUP_META[syrup.name] : undefined;
  const order: Order = {
    id: d.id,
    key,
    name: d.name,
    size,
    strong,
    price: priceOf(d.id, size),
    base: priceOf(d.id, size),
    syrup:
      syrup && meta ? { name: syrup.name, shelf: meta.key, pumps: 1 + Math.floor(rng() * 2) } : null,
    syrupImplied: !!forced,
    altMilk: null,
    cold,
    food: null,
    line: ''
  };
  if (syrup && !forced) order.price += SYRUP_PRICE;
  // еда с витрины: только если витрины куплены (иначе случайные числа не расходуются)
  order.food = rollFood({ rank: state.rank, day: state.day, eq }, rng);
  const want = state.focus ? foodWantOfItem(state.focus) : null;
  if (want && state.focus && !orderUsesItem(state.focus, order)) order.food = forceFood({ rank: state.rank, day: state.day, eq }, rng, want) ?? order.food;
  order.line = say(order, type, rng);
  return order;
}
