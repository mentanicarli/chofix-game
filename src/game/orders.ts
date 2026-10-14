import { DRINKS, DRINK_NEEDS, ENGINE, FOOD, FORCED_SYRUP, ICED, RECIPE_SYRUPS, SYRUPS, SYRUP_META, drinkById, isOrderable, needsMilk, priceOf, syrupByName } from './menu';
import { coldVariantOk, isNewKeyEngine } from './recipes';
import { SIZE_ML, recipePumps, shotsOf } from './volumes';
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
  espresso: 0.3,
  espresso_double: 0.2,
  americano: 0.3,
  cappuccino: 0.25,
  latte: 0.25,
  flat_white: 0.15,
  vanilla_raf: 0.2,
  raf: 0.2,
  raf_halva: 0.15
};
const baseW = (d: Drink): number => WEIGHTS[d.id] ?? 0.2;

/** Размеры классических напитков (ручная механика): мелкий чаще. Крупные размеры — с 3-го дня, чтобы первый день остался прежним. */
const OLD_SIZE_W: ReadonlyArray<readonly [Size, number]> = [['0.2', 0.5], ['0.3', 0.25], ['0.4', 0.15], ['0.6', 0.1]];
const OLD_COLD_W: ReadonlyArray<readonly [Size, number]> = [['0.3', 0.5], ['0.4', 0.3], ['0.6', 0.2]];
const pickSize = (rng: Rng, d: Drink, w: ReadonlyArray<readonly [Size, number]>): Size => {
  const ok = w.filter((x) => d.sizes[x[0]] !== undefined);
  return ok.length ? wpick(rng, ok) : ((Object.keys(d.sizes)[0] as Size | undefined) ?? '0.2');
};
/** Напитки, к которым сироп гость не просит. */
const NO_GUEST_SYRUP: ReadonlySet<string> = new Set(['espresso', 'espresso_double']);
/** Раф: классический, без молока: альтернативное молоко к нему не предлагается. */
const isRaf = (d: Drink): boolean => d.family === 'raf';

/**
 * Подмена заказа для песочницы (#dev). Подменяет только названные поля, остальное бросается как обычно.
 * В обычной игре не передаётся, и rollOrder работает как раньше.
 */
export interface OrderOverride {
  /** id напитка из меню */
  drink?: string;
  size?: Size;
  cold?: boolean;
  strong?: boolean;
  /** название сиропа; null — без сиропа */
  syrup?: string | null;
  /** название альтернативного молока; null — обычное */
  altMilk?: string | null;
  /** id блюда; null — без еды */
  food?: string | null;
  /** разогреть блюдо */
  heat?: boolean;
}

export interface OrderState {
  rank: number;
  day: number;
  /** Есть ли молочная техника. */
  milk: boolean;
  eq?: Readonly<Record<string, boolean | undefined>>;
  /** Вчерашняя покупка (id позиции магазина): этот заказ должен её использовать. Без неё заказы считаются как обычно. */
  focus?: string;
  /** Только песочница: подмена частей заказа. */
  override?: OrderOverride;
}

/** Помпы сиропа: у напитков с сиропом в рецепте их число зависит от размера, у сиропа по просьбе гостя 1–2 (случайное число бросается всегда, чтобы поток случайных чисел не менялся). */
const syrupPumps = (recipe: number, rolled: number): number => recipe || rolled;

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
  const ov = state.override;
  const picked = wpick(rng, from.map((x) => [x, baseW(x)] as const));
  const forcedDrink = ov?.drink ? drinkById[ov.drink] : undefined;
  const d = forcedDrink && forcedDrink.id in ENGINE ? forcedDrink : picked;
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
    const bigOk = state.day >= 3 || state.rank >= 2;
    size = cold && coldSize ? (bigOk ? pickSize(rng, d, OLD_COLD_W) : coldSize) : bigOk ? pickSize(rng, d, OLD_SIZE_W) : '0.2';
  }
  if (ov) {
    if (ov.cold !== undefined) {
      const can = fresh ? coldVariantOk(d) && !!coldSize : key in ICED && !!coldSize;
      cold = ov.cold && can;
      if (!cold && size === coldSize) size = fresh ? ((Object.keys(d.sizes)[0] as Size | undefined) ?? size) : '0.2';
    }
    if (!cold && ov.size && d.sizes[ov.size] !== undefined) size = ov.size;
  }
  const baseKey = key;
  if (cold && !fresh) key = ICED[baseKey] as string;
  const strongRoll = state.day >= 2 && rng() < 0.25;
  const strong = ov?.strong ?? strongRoll;
  const forced = FORCED_SYRUP[d.id];
  const open = SYRUPS.filter((s) => s.rank <= state.rank && SYRUP_META[s.name] && !RECIPE_SYRUPS.has(s.name));
  const canSyrup = !fresh || d.steps.some((x) => x.st === 'milk' || x.st === 'shot');
  const withSyrup = forced || (canSyrup && open.length > 0 && !NO_GUEST_SYRUP.has(d.id) && state.day >= 2 && rng() < 0.3);
  let syrup = forced ? syrupByName[forced] : withSyrup ? open[Math.floor(rng() * open.length) % open.length] : undefined;
  if (ov && ov.syrup !== undefined && !forced) syrup = ov.syrup ? syrupByName[ov.syrup] : undefined;
  const meta = syrup ? SYRUP_META[syrup.name] : undefined;
  const order: Order = {
    id: d.id,
    key,
    name: d.name,
    size,
    strong,
    shots: shotsOf(d, size),
    price: priceOf(d.id, size),
    base: priceOf(d.id, size),
    syrup:
      syrup && meta ? { name: syrup.name, shelf: meta.key, pumps: syrupPumps(forced ? recipePumps(d, size) : 0, 1 + Math.floor(rng() * 2)) } : null,
    syrupImplied: !!forced,
    altMilk: ov?.altMilk && !isRaf(d) ? { name: ov.altMilk } : null,
    cold,
    food: null,
    line: ''
  };
  if (syrup && !forced) order.price += SYRUP_PRICE;
  // еда с витрины: только если витрины куплены (иначе случайные числа не расходуются)
  order.food = rollFood({ rank: state.rank, day: state.day, eq }, rng);
  const want = state.focus ? foodWantOfItem(state.focus) : null;
  if (want && state.focus && !orderUsesItem(state.focus, order)) order.food = forceFood({ rank: state.rank, day: state.day, eq }, rng, want) ?? order.food;
  if (ov && ov.food !== undefined) {
    const f = ov.food ? FOOD.find((x) => x.id === ov.food) : undefined;
    order.food = f ? { id: f.id, name: f.name, price: f.price, case: f.case, heat: !!ov.heat && f.heatable } : null;
  }
  order.line = say({ ...order, sizeMl: Object.keys(d.sizes).length > 1 ? SIZE_ML[size] : 0 }, type, rng);
  return order;
}
