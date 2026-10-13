/* Модель игрока: когда каждая покупка становится доступной (isShopItemAvailable) и когда игрок реально может её позволить.
   Не входит в обычный прогон. Запуск: SIM=1 npx vitest run scripts/shop-sim.test.ts  → out/shop-sim.md */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  EQUIPMENT, EQ_IMPL, arrivalInterval, buildTasks, drinkCost, isShopItemAvailable, nextRank, patienceMax, ratingAfterLoss, rollOrder, settle, settleDay,
  FOOD_COST_SHARE, DAY_LEN, rentFor, helperWage
} from '../src/game/api';
import type { CustomerType, Quality } from '../src/game/api';

interface Item { id: string; name: string; cost: number; minDay?: number; minRank?: number; progression: boolean }
const BASE: Item[] = [
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
const EQ: Item[] = EQUIPMENT.filter((e) => EQ_IMPL.includes(e.id)).map((e) => ({ id: 'eq_' + e.id, name: e.name, cost: e.cost, progression: true }));
const ITEMS: Item[] = [...BASE, ...EQ];
/** Очередь покупок: сначала то, что открывает меню (по рангу), потом улучшения; помощник последним. */
const PRIORITY = [...BASE.filter((i) => i.id === 'milk'), ...EQ.slice().sort((a, b) => (EQUIPMENT.find((e) => 'eq_' + e.id === a.id)?.rank ?? 0) - (EQUIPMENT.find((e) => 'eq_' + e.id === b.id)?.rank ?? 0)),
  ...['tamper', 'grinderPro', 'machine', 'wifi', 'cards', 'cozy', 'beans', 'thermo', 'stencil', 'helper'].map((id) => BASE.find((i) => i.id === id) as Item)];

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

interface Profile { name: string; speed: number; q: [number, number, number] }
const PROFILES: Profile[] = [
  { name: 'средний игрок', speed: 1.15, q: [0.1, 0.5, 0.4] },
  { name: 'уверенный игрок', speed: 1.0, q: [0.04, 0.36, 0.6] }
];

interface Run { avail: Map<string, number>; afford: Map<string, number>; bought: Map<string, number>; rank: Map<number, number>; income: number[]; over: boolean }

function simulate(seed: number, prof: Profile, days = 40): Run {
  const rng = seeded(seed);
  const owned: Record<string, boolean> = {};
  const run: Run = { avail: new Map(), afford: new Map(), bought: new Map(), rank: new Map([[1, 1]]), income: [], over: false };
  let money = 500, rank = 1, rating = 3, served = 0;
  const pace = 'normal' as const;
  const typeOf = (day: number): CustomerType => {
    const r = rng();
    return day === 1 ? (r < 0.6 ? 'regular' : 'student') : r < 0.45 ? 'regular' : r < 0.75 ? 'student' : 'hurry';
  };
  for (let day = 1; day <= days; day++) {
    const eq = Object.fromEntries(EQ_IMPL.map((e) => [e, !!owned['eq_' + e]]));
    let nominal = 4, free = 0, revenue = 0, costs = 0, count = 0;
    const lastCall = DAY_LEN - 25;
    const ends: number[] = [];
    // гости приходят по таймеру; у стойки три места: пока все заняты, приход ждёт (в игре повтор через 1,2 с), следующий отсчёт идёт от фактического прихода
    for (;;) {
      const at = Math.max(nominal, count >= 3 ? (ends[count - 3] as number) : 0);
      if (at >= lastCall) break;
      nominal = at + arrivalInterval({ day, rating, t: at, wifi: !!owned['wifi'] }, rng);
      const type = typeOf(day);
      const order = rollOrder({ rank, day, milk: !!owned['milk'], eq }, type, rng);
      const g = { type, at, pat: patienceMax(type, { pace, cozy: !!owned['cozy'], helper: !!owned['helper'] }), order };
      count++;
      const start = Math.max(g.at, free);
      if (start - g.at > g.pat) {
        rating = ratingAfterLoss(rating);
        ends.push(g.at + g.pat);
        continue;
      }
      const tasks = buildTasks(g.order.key, { cold: g.order.cold, syrup: !!g.order.syrup }).length + (g.order.food ? 1 : 0);
      free = start + (12 + 7 * tasks) * prof.speed;
      ends.push(free);
      if (free > DAY_LEN + 90) {
        rating = ratingAfterLoss(rating);
        continue;
      }
      const r = rng();
      const quality = (r < prof.q[0] ? 0 : r < prof.q[0] + prof.q[1] ? 1 : 2) as Quality;
      const st = settle({ basePrice: g.order.base, beans: !!owned['beans'], paidSyrup: !!g.order.syrup && !g.order.syrupImplied, quality, type: g.type, flawless: quality === 2 && rng() < 0.5, cards: !!owned['cards'], rating, extra: g.order.food?.price ?? 0 });
      revenue += st.total;
      costs += drinkCost(g.order.key, !!owned['beans']) + (g.order.food ? Math.round(g.order.food.price * FOOD_COST_SHARE) : 0);
      rating = st.rating;
      served++;
    }
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
    const state = () => ({ rank, owned });
    let blocked = false;
    for (const it of PRIORITY) {
      if (owned[it.id]) continue;
      if (!isShopItemAvailable(it, state())) continue;
      const open = !(it.minDay && day + 1 < it.minDay) && !(it.minRank && rank < it.minRank);
      if (!open) continue;
      if (!run.avail.has(it.id)) run.avail.set(it.id, day);
      if (money >= it.cost && !run.afford.has(it.id)) run.afford.set(it.id, day);
      if (blocked && it.progression) continue;
      if (money - it.cost >= eveningRent) {
        money -= it.cost;
        owned[it.id] = true;
        run.bought.set(it.id, day);
      } else if (it.progression) blocked = true; // копит на следующую ступень меню
    }
  }
  return run;
}

const median = (a: number[]): number => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number : NaN);

test.skipIf(!process.env['SIM'])('модель игрока: доступность и накопления', () => {
  const lines: string[] = ['# Покупки по дням (модель игрока)', '', 'День = вечер после этого дня: покупка доступна в магазине и, если денег хватает, куплена; эффект с утра следующего дня.', ''];
  for (const prof of PROFILES) {
    const runs = Array.from({ length: 60 }, (_, i) => simulate(i + 1, prof));
    lines.push(`## ${prof.name} (60 прогонов, обычный темп)`, '', `Банкротств: ${runs.filter((r) => r.over).length}. Доход за день (выручка − себестоимость − аренда), медиана по дням: ${[1, 3, 5, 8, 12, 16, 20, 25, 30].map((d) => `д${d} ${median(runs.map((r) => r.income[d - 1] ?? NaN).filter((x) => !Number.isNaN(x)))}`).join(', ')}.`, '');
    lines.push('Ранг: ' + [2, 3, 4, 5, 6, 7, 8, 9].map((k) => `${k} → день ${median(runs.map((r) => r.rank.get(k) ?? NaN).filter((x) => !Number.isNaN(x)))}`).join(', '), '');
    lines.push('| Позиция | Цена | Доступна (день) | Хватает денег (день) | Куплена (день) | Ждёт после появления, дней | Куплена в прогонах |', '|---|---|---|---|---|---|---|');
    for (const it of ITEMS) {
      const av = runs.map((r) => r.avail.get(it.id)).filter((x): x is number => x !== undefined);
      const af = runs.map((r) => r.afford.get(it.id)).filter((x): x is number => x !== undefined);
      const bo = runs.map((r) => r.bought.get(it.id)).filter((x): x is number => x !== undefined);
      const gap = runs.map((r) => (r.bought.has(it.id) && r.avail.has(it.id) ? (r.bought.get(it.id) as number) - (r.avail.get(it.id) as number) : NaN)).filter((x) => !Number.isNaN(x));
      const g = gap.length ? median(gap) : NaN;
      lines.push(`| ${it.name} | ${it.cost} | ${av.length ? median(av) : '—'} | ${af.length ? median(af) : '—'} | ${bo.length ? median(bo) : '—'} | ${Number.isNaN(g) ? '—' : g}${g > 3 ? ' ⚠' : ''} | ${bo.length}/${runs.length} |`);
    }
    lines.push('');
  }
  mkdirSync('out', { recursive: true });
  writeFileSync('out/shop-sim.md', lines.join('\n'));
  expect(lines.length).toBeGreaterThan(10);
});
