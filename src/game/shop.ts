import { DRINKS, DRINK_NEEDS, ENGINE, EQUIPMENT, FOOD, ICED, drinkById, needsMilk } from './menu';
import { CASE_EQ, MICROWAVE } from './food';
import type { Drink } from './types';

/**
 * Что показывать в магазине. Правило: карточка есть, только если покупка даёт эффект сразу
 * (гости уже могут заказать то, что с ней становится возможным). Иначе её нет вообще.
 * Купленное остаётся в списке (штамп «Куплено»), ничего не списывается и не возвращается.
 */
export interface ShopItem {
  id: string;
  minDay?: number;
  minRank?: number;
}
export interface ShopState {
  rank: number;
  /** что куплено, по id позиции магазина: `milk`, `beans`, `eq_ice`… */
  owned: Readonly<Record<string, boolean | undefined>>;
}

const EQ_PREFIX = 'eq_';
export const isEqItem = (id: string): boolean => id.startsWith(EQ_PREFIX);
export const eqOfItem = (id: string): string => id.slice(EQ_PREFIX.length);

/** С какого ранга открываются молочные напитки (минимальный ранг среди напитков с молоком). */
export const MILK_RANK: number = Math.min(...DRINKS.filter((d) => needsMilk(d) && d.id in ENGINE).map((d) => d.rank));

/** Позиции, которые работают только с паром и молоком (латте-арт, температура молока). */
const NEEDS_MILK_ITEMS: ReadonlySet<string> = new Set(['stencil', 'thermo']);

const hasSteam = (d: Drink): boolean => d.steps.some((s) => s.st === 'steam');
const hasArt = (d: Drink): boolean => d.steps.some((s) => s.st === 'pour' && !s.arg);
/** Старые напитки с ручной механикой, у которых есть холодная версия (нужен лёд). */
const hasColdVariant = (d: Drink): boolean => (ENGINE[d.id] ?? '') in ICED && d.coldSizes.length > 0;

/** Умеет ли напиток работать с оборудованием (шаги рецепта или холодная версия). */
function drinkUsesEq(d: Drink, eq: string): boolean {
  return (DRINK_NEEDS[d.id] ?? []).includes(eq) || (eq === 'ice' && hasColdVariant(d));
}

/** Есть ли у оборудования немедленный эффект: открытый по рангу напиток или блюдо, которое с ним уже можно заказать. */
function eqHasEffect(eq: string, s: ShopState): boolean {
  const def = EQUIPMENT.find((e) => e.id === eq);
  if (!def || s.rank < def.rank) return false;
  const has = (n: string): boolean => !!s.owned[EQ_PREFIX + n];
  const milk = !!s.owned['milk'];
  const drinkOk = DRINKS.some(
    (d) =>
      d.id in ENGINE &&
      d.rank <= s.rank &&
      drinkUsesEq(d, eq) &&
      (!needsMilk(d) || milk) &&
      // остальное оборудование, нужное этому напитку, уже куплено (лёд для холодной версии других станций не требует)
      (DRINK_NEEDS[d.id] ?? []).every((n) => n === eq || has(n))
  );
  if (drinkOk) return true;
  if (FOOD.some((f) => f.rank <= s.rank && CASE_EQ[f.case] === eq)) return true;
  // микроволновка греет только блюда с купленной витрины
  return eq === MICROWAVE && FOOD.some((f) => f.heatable && f.rank <= s.rank && has(CASE_EQ[f.case] ?? ''));
}

/** Показывать ли карточку в магазине. minDay / minRank проверяет сам экран (кнопка «С дня 2», «Ранг 5»). */
export function isShopItemAvailable(item: ShopItem, s: ShopState): boolean {
  if (s.owned[item.id]) return true;
  if (item.id === 'milk') return s.rank >= MILK_RANK;
  if (NEEDS_MILK_ITEMS.has(item.id)) return !!s.owned['milk'] && s.rank >= MILK_RANK;
  if (isEqItem(item.id)) return eqHasEffect(eqOfItem(item.id), s);
  return true;
}

/** Что появилось в магазине между двумя состояниями (повышение ранга или покупка). Купленное не считается. */
export function newlyAvailable<T extends ShopItem>(items: readonly T[], before: ShopState, after: ShopState): T[] {
  return items.filter((i) => !after.owned[i.id] && !isShopItemAvailable(i, before) && isShopItemAvailable(i, after));
}

const NAMES_LIMIT = 3;
/** «В магазине теперь можно купить: …» (пустая строка, если нечего). */
export function shopNewText(names: readonly string[]): string {
  if (!names.length) return '';
  const head = names.slice(0, NAMES_LIMIT).join(', ');
  const tail = names.length > NAMES_LIMIT ? ` и ещё ${names.length - NAMES_LIMIT}` : '';
  return `В магазине теперь можно купить: ${head}${tail}.`;
}

/** Использует ли заказ купленную вещь (null — вещь не про заказы: зерно, зал, помощник и т. д.). */
export function orderUsesItem(
  id: string,
  o: { id: string; cold: boolean; food: { case: string; heat: boolean } | null }
): boolean | null {
  const d = drinkById[o.id];
  if (id === 'milk') return !!d && needsMilk(d);
  if (id === 'thermo') return !!d && hasSteam(d);
  if (id === 'stencil') return !!d && hasArt(d);
  if (!isEqItem(id)) return null;
  const eq = eqOfItem(id);
  if (eq === 'ice' && o.cold) return true;
  if (o.food && CASE_EQ[o.food.case] === eq) return true;
  if (eq === MICROWAVE) return !!o.food?.heat;
  return !!d && (DRINK_NEEDS[d.id] ?? []).includes(eq);
}

/** Покупки, для которых имеет смысл гарантия «закажут в первые 5 гостей». */
export const hasOrderEffect = (id: string): boolean =>
  id === 'milk' || NEEDS_MILK_ITEMS.has(id) || (isEqItem(id) && EQUIPMENT.some((e) => e.id === eqOfItem(id)));

/** Подходит ли напиток для гарантированного заказа (для еды и микроволновки ограничений на напиток нет). */
export function drinkFitsItem(id: string, d: Drink): boolean {
  if (id === 'milk') return needsMilk(d);
  if (id === 'thermo') return hasSteam(d);
  if (id === 'stencil') return hasArt(d);
  if (!isEqItem(id)) return true;
  const eq = eqOfItem(id);
  if (eq === MICROWAVE || Object.values(CASE_EQ).includes(eq)) return true;
  return drinkUsesEq(d, eq);
}

/** Вещь, которая появляется в заказе через еду. */
export const foodWantOfItem = (id: string): { case?: string; heat?: boolean } | null => {
  if (!isEqItem(id)) return null;
  const eq = eqOfItem(id);
  if (eq === MICROWAVE) return { heat: true };
  const c = Object.entries(CASE_EQ).find(([, e]) => e === eq)?.[0];
  return c ? { case: c } : null;
};
