import { EQUIPMENT, EQ_IMPL, nextRank } from './menu';
import { drinkCost, helperWage, ratingAfterLoss, rentFor, settle, settleDay } from './economy';
import { estimatedPrepSeconds, patienceMax, queueDecayRate, queueOrder } from './patience';
import { CLOSING_LIMIT, DAY_LEN, arrivalInterval } from './shift';
import { FOOD_COST_SHARE } from './food';
import { rollOrder } from './orders';
import { isShopItemAvailable } from './shop';
import type { CustomerType, Order, Quality } from './types';

/**
 * Модель игрока: проходит дни с теми же формулами, что и игра (заказы, приход гостей, цены, аренда, ранги, правила магазина),
 * только вместо рук бариста у неё время приготовления `estimatedPrepSeconds(заказ)·speed` и доли качества; гости идут строгой очередью (`queueOrder`), терпение тает по месту (`queueDecayRate`).
 * Используется скриптом `scripts/shop-sim.test.ts` (отчёт по покупкам) и `scripts/typical-progress.ts` (таблица для песочницы).
 * Числа в модели грубые; перегенерировать таблицу нужно после изменения цен, порогов рангов, правил магазина или самой модели.
 */

export interface ShopDef { id: string; name: string; cost: number; minDay?: number; minRank?: number; progression: boolean }

/** Позиции магазина, кроме оборудования. Цены и условия обязаны совпадать с SHOP в src/legacy/00-core.js (сверяет test/sandbox.test.ts). */
export const SHOP_BASE: readonly ShopDef[] = [
  { id: 'milk', name: 'Молоко и капучино', cost: 400, progression: true },
  { id: 'beans', name: 'Зерно получше', cost: 450, progression: false },
  { id: 'stencil', name: 'Трафарет для арта', cost: 240, progression: false },
  { id: 'grinderPro', name: 'Кофемолка с экраном', cost: 320, progression: false },
  { id: 'tamper', name: 'Калиброванный темпер', cost: 300, progression: false },
  { id: 'thermo', name: 'Питчер с термометром', cost: 280, progression: false },
  { id: 'machine', name: 'Кофемашина Pro', cost: 600, minDay: 2, progression: false },
  { id: 'cozy', name: 'Уютный зал', cost: 350, progression: false },
  { id: 'wifi', name: 'Wi-Fi для студентов', cost: 380, minDay: 2, progression: false },
  { id: 'cards', name: 'Карта лояльности', cost: 420, minDay: 2, progression: false },
  { id: 'helper', name: 'Помощник-стажёр', cost: 1500, minRank: 5, progression: false }
];
const EQ_DEFS: readonly ShopDef[] = EQUIPMENT.filter((e) => EQ_IMPL.includes(e.id)).map((e) => ({ id: 'eq_' + e.id, name: e.name, cost: e.cost, progression: true }));
/** Все позиции магазина: базовые и оборудование, которое уже работает в баре. */
export const SHOP_DEFS: readonly ShopDef[] = [...SHOP_BASE, ...EQ_DEFS];

/** Очередь покупок: сначала то, что открывает меню (по рангу), потом улучшения; помощник последним. */
export const PRIORITY: readonly ShopDef[] = [
  ...SHOP_BASE.filter((i) => i.id === 'milk'),
  ...EQ_DEFS.slice().sort((a, b) => (EQUIPMENT.find((e) => 'eq_' + e.id === a.id)?.rank ?? 0) - (EQUIPMENT.find((e) => 'eq_' + e.id === b.id)?.rank ?? 0)),
  ...['tamper', 'grinderPro', 'machine', 'wifi', 'cards', 'cozy', 'beans', 'thermo', 'stencil', 'helper'].map((id) => SHOP_BASE.find((i) => i.id === id) as ShopDef)
];

/** Можно ли купить позицию: правило показа магазина плюс кнопка «С дня N» / «Ранг N». `day` — день, в который покупка уже действует. */
export function isPurchasable(item: ShopDef, day: number, rank: number, owned: Readonly<Record<string, boolean | undefined>>): boolean {
  if (item.minDay && day < item.minDay) return false;
  if (item.minRank && rank < item.minRank) return false;
  return isShopItemAvailable(item, { rank, owned });
}

export const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export interface Profile { id: 'medium' | 'confident'; name: string; speed: number; q: [number, number, number] }
export const PROFILES: readonly Profile[] = [
  { id: 'medium', name: 'средний игрок', speed: 0.88, q: [0.1, 0.5, 0.4] },
  { id: 'confident', name: 'уверенный игрок', speed: 0.7, q: [0.04, 0.36, 0.6] }
];

/** Состояние на начало дня (после вечера предыдущего). */
export interface DaySnap { day: number; rank: number; rating: number; served: number; money: number; owned: string[] }
export interface Run {
  avail: Map<string, number>;
  afford: Map<string, number>;
  bought: Map<string, number>;
  rank: Map<number, number>;
  income: number[];
  over: boolean;
  /** снимки на начало каждого сыгранного дня (и ещё один после последнего, если игрок не обанкротился) */
  snaps: DaySnap[];
  /** по дням: после вечерних покупок не осталось ни одной доступной непокупленной позиции («нечего покупать») */
  idle: boolean[];
  /** всего гостей пришло / ушло по терпению за все сыгранные дни */
  guests: number;
  lost: number;
}

const STEP = 0.5;
export function simulate(seed: number, prof: Profile, days = 40): Run {
  const rng = seeded(seed);
  const owned: Record<string, boolean> = {};
  const order: string[] = [];
  const run: Run = { avail: new Map(), afford: new Map(), bought: new Map(), rank: new Map([[1, 1]]), income: [], over: false, snaps: [], idle: [], guests: 0, lost: 0 };
  let money = 500, rank = 1, rating = 3, served = 0;
  const pace = 'normal' as const;
  const typeOf = (day: number): CustomerType => {
    const r = rng();
    return day === 1 ? (r < 0.6 ? 'regular' : 'student') : r < 0.45 ? 'regular' : r < 0.75 ? 'student' : 'hurry';
  };
  for (let day = 1; day <= days; day++) {
    run.snaps.push({ day, rank, rating, served, money, owned: [...order] });
    const eq = Object.fromEntries(EQ_IMPL.map((e) => [e, !!owned['eq_' + e]]));
    let revenue = 0, costs = 0;
    /* смена идёт шагом в полсекунды: гости приходят по таймеру (мест у стойки три), игрок готовит только заказ первого в очереди (queueOrder),
       терпение каждого гостя тает со скоростью по его месту (queueDecayRate); заказ, который готовится, оплачивается расходами сразу, как в игре */
    interface Guest { type: CustomerType; pat: number; order: Order; leaving?: boolean }
    const queue: Guest[] = [];
    let nextArr = 4, prep: Guest | null = null, prepLeft = 0, prepCost = 0;
    const lose = (g: Guest): void => {
      rating = ratingAfterLoss(rating);
      run.lost++;
      queue.splice(queue.indexOf(g), 1);
      if (g === prep) { prep = null; costs -= prepCost; }
    };
    /* гости приходят до DAY_LEN; потом очередь дообслуживается с обычным терпением; не управились за CLOSING_LIMIT — день тихо заканчивается без штрафа */
    for (let t = 0; t < DAY_LEN + CLOSING_LIMIT; t += STEP) {
      if (t >= DAY_LEN && !queue.length && !prep) break;
      if (t < DAY_LEN) {
        nextArr -= STEP;
        if (nextArr <= 0) {
          if (queue.length >= 3) nextArr = 1.2;
          else {
            nextArr = arrivalInterval({ day, rating, t, wifi: !!owned['wifi'] }, rng);
            const type = typeOf(day);
            const ord = rollOrder({ rank, day, milk: !!owned['milk'], eq }, type, rng);
            const pat = patienceMax(type, { pace, cozy: !!owned['cozy'], helper: !!owned['helper'], prep: estimatedPrepSeconds(ord), day, rng });
            queue.push({ type, pat, order: ord });
            run.guests++;
          }
        }
      }
      for (const g of queue.slice()) {
        g.pat -= STEP * queueDecayRate(queue.indexOf(g));
        if (g.pat <= 0) lose(g);
      }
      if (!prep) {
        const first = queueOrder(queue);
        if (first) {
          prep = first;
          prepLeft = estimatedPrepSeconds(first.order) * prof.speed;
          prepCost = drinkCost(first.order.key, !!owned['beans'], { size: first.order.size, cold: first.order.cold }) + (first.order.food ? Math.round(first.order.food.price * FOOD_COST_SHARE) : 0);
          costs += prepCost;
        }
      } else {
        prepLeft -= STEP;
        if (prepLeft <= 0) {
          const g: Guest = prep;
          const r = rng();
          const quality = (r < prof.q[0] ? 0 : r < prof.q[0] + prof.q[1] ? 1 : 2) as Quality;
          const st = settle({ basePrice: g.order.base, beans: !!owned['beans'], paidSyrup: !!g.order.syrup && !g.order.syrupImplied, quality, type: g.type, flawless: quality === 2 && rng() < 0.5, cards: !!owned['cards'], rating, extra: g.order.food?.price ?? 0 });
          revenue += st.total;
          rating = st.rating;
          served++;
          queue.splice(queue.indexOf(g), 1);
          prep = null;
        }
      }
    }
    if (prep) costs -= prepCost; // день закрылся посреди заказа: расход возвращается, как в игре
    const fin = settleDay({ money: money + revenue - costs, pace, rank, wage: owned['helper'] ? helperWage(rank) : 0 });
    money = fin.money;
    run.income.push(revenue - costs - fin.rent);
    if (fin.over) {
      run.over = true;
      break;
    }
    const nr = nextRank(rank, { day: day + 1, rating, served });
    if (nr) {
      rank = nr.rank;
      run.rank.set(rank, day);
    }
    // вечер: магазин
    const eveningRent = rentFor(pace, rank);
    let blocked = false;
    for (const it of PRIORITY) {
      if (owned[it.id]) continue;
      if (!isPurchasable(it, day + 1, rank, owned)) continue;
      if (!run.avail.has(it.id)) run.avail.set(it.id, day);
      if (money >= it.cost && !run.afford.has(it.id)) run.afford.set(it.id, day);
      if (blocked && it.progression) continue;
      if (money - it.cost >= eveningRent) {
        money -= it.cost;
        owned[it.id] = true;
        order.push(it.id);
        run.bought.set(it.id, day);
      } else if (it.progression) blocked = true; // копит на следующую ступень меню
    }
    run.idle.push(!PRIORITY.some((it) => !owned[it.id] && isPurchasable(it, day + 1, rank, owned)));
  }
  if (!run.over) run.snaps.push({ day: days + 1, rank, rating, served, money, owned: [...order] });
  return run;
}
