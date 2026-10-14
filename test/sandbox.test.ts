import { describe, expect, test } from 'vitest';
import {
  DRINKS, EQUIPMENT, EQ_IMPL, MAX_RANK, SANDBOX_MAX_DAY, SEEN_MARK, SHOP_BASE, SHOP_BASE_IDS, SHOP_DEFS, allAvailableItems, allShopIds, defaultSandboxConfig, extendAvailable, freshSeen,
  isPurchasable, makeSandboxState, maxRankForDay, modelPrepTime, newDrinkCard, normalizeSandboxConfig, parseSandboxConfig, rankInfo, resolveSandbox, rollOrder, sanitizeItems,
  serializeSandboxConfig, servedCap, summarizeShift, typicalItems, typicalRow
} from '../src/game/api';
import type { ProfileId, ServeRecord } from '../src/game/api';
import core from '../src/legacy/00-core.js?raw';

const seeded = (s: number) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const PROFILES: ProfileId[] = ['medium', 'confident'];
const DAYS = Array.from({ length: SANDBOX_MAX_DAY }, (_, i) => i + 1);
const owns = (ids: readonly string[]) => Object.fromEntries(ids.map((i) => [i, true]));
const FUTURE_EQ = ['eq_shaker', 'eq_boba', 'eq_blender', 'eq_whipper'];

describe('песочница: магазин совпадает со старым ядром', () => {
  test('id, цены и условия SHOP в 00-core.js равны SHOP_BASE', () => {
    const rows = [...core.matchAll(/\{ id: '(\w+)',\s+cat:.*?cost: (\d+)(?:, minDay: (\d+))?(?:, minRank: (\d+))? \}/g)].map((m) => ({
      id: m[1], cost: +(m[2] as string), minDay: m[3] ? +m[3] : undefined, minRank: m[4] ? +m[4] : undefined
    }));
    expect(rows).toEqual(SHOP_BASE.map((i) => ({ id: i.id, cost: i.cost, minDay: i.minDay, minRank: i.minRank })));
    expect(rows.map((r) => r.id)).toEqual([...SHOP_BASE_IDS]);
  });
});

describe('песочница: состояние выводится из дня', () => {
  test('день 1: ничего не куплено, ранг 1, оба профиля и режима', () => {
    for (const profile of PROFILES) for (const mode of ['all', 'typical'] as const) {
      const s = makeSandboxState({ day: 1, profile, mode });
      expect(s).toMatchObject({ rank: 1, day: 1, tutOff: false, fresh: [] });
      for (const id of allShopIds()) expect(s[id]).toBe(false);
    }
  });
  test('каждый день 1–60, оба профиля и режима: достижимое состояние', () => {
    for (const profile of PROFILES) for (const mode of ['all', 'typical'] as const) for (const day of DAYS) {
      const r = resolveSandbox({ day, profile, mode });
      const info = rankInfo(r.rank);
      expect(r.rank).toBeLessThanOrEqual(maxRankForDay(day));
      expect(info.minDay).toBeLessThanOrEqual(day);
      expect(r.rating).toBeGreaterThanOrEqual(info.minRating);
      expect(r.rating).toBeLessThanOrEqual(5);
      expect(r.served).toBeGreaterThanOrEqual(info.minServed);
      expect(r.served).toBeLessThanOrEqual(Math.max(servedCap(day), info.minServed));
      // каждая покупка проходит правила магазина в порядке покупки
      const owned: Record<string, boolean> = {};
      for (const id of r.items) {
        const def = SHOP_DEFS.find((x) => x.id === id);
        expect(def, id).toBeDefined();
        expect(isPurchasable(def as (typeof SHOP_DEFS)[number], day, r.rank, owned), `${profile} день ${day} ${id}`).toBe(true);
        owned[id] = true;
      }
      // ничего из будущего: непокупленное, что уже доступно, — только в режиме «как у типичного»
      const open = day < 2 ? [] : SHOP_DEFS.filter((d) => !owned[d.id] && isPurchasable(d, day, r.rank, owned)).map((d) => d.id);
      expect([...r.avail].sort()).toEqual(open.sort());
      if (mode === 'all') expect(open, `все доступное, ${profile} день ${day}`).toEqual([]);
      for (const e of EQUIPMENT.filter((x) => x.rank > r.rank)) expect(r.items).not.toContain('eq_' + e.id);
      expect(r.money).toBeGreaterThan(0);
    }
  });
  test('ранг в таблице не убывает и не выше допустимого по minDay', () => {
    for (const profile of PROFILES) {
      let prev = 1;
      for (const day of DAYS) {
        const rank = typicalRow(profile, day).rank;
        expect(rank).toBeGreaterThanOrEqual(prev);
        expect(rankInfo(rank).minDay).toBeLessThanOrEqual(day);
        prev = rank;
      }
    }
  });
  test('день 10, «Средний»: ранг и покупки как в таблице, без шейкера, бабл-ти, блендера и сифона', () => {
    const r = resolveSandbox({ day: 10, profile: 'medium', mode: 'typical' });
    expect(r.rank).toBe(typicalRow('medium', 10).rank);
    expect(r.items).toEqual(typicalItems('medium', 10, r.rank));
    expect(r.items.length).toBeGreaterThan(0);
    for (const id of FUTURE_EQ) expect(r.items, id).not.toContain(id);
    const all = resolveSandbox({ day: 10, profile: 'medium', mode: 'all' });
    expect(all.rank).toBe(r.rank);
    for (const id of FUTURE_EQ) expect(all.items, id).not.toContain(id);
  });
  test('«Всё доступное» — неподвижная точка правил магазина: повтор ничего не меняет', () => {
    for (const day of [2, 6, 10, 17, 30, 60]) {
      const rank = resolveSandbox({ day }).rank;
      const items = allAvailableItems(day, rank);
      expect([...allAvailableItems(day, rank)].sort()).toEqual([...items].sort());
      expect([...extendAvailable(day, rank, items)].sort()).toEqual([...items].sort());
      expect(sanitizeItems(day, rank, items)).toEqual(items);
      for (const d of SHOP_DEFS) if (!items.includes(d.id)) expect(isPurchasable(d, day, rank, owns(items)), d.id).toBe(false);
    }
  });
  test('«Своё»: ранг не выше допустимого для дня, рейтинг и «обслужено» в границах, лишние позиции снимаются', () => {
    const max = maxRankForDay(10);
    expect(max).toBeLessThan(MAX_RANK);
    const r = resolveSandbox({ day: 10, custom: { rank: 9 } });
    expect(r.rank).toBe(max);
    expect(r.maxRank).toBe(max);
    expect(resolveSandbox({ day: 10, custom: { rank: 1 } }).rank).toBe(1);
    const c = resolveSandbox({ day: 20, custom: { rank: 5, rating: 1, served: 0 } });
    expect(c.rating).toBeGreaterThanOrEqual(rankInfo(5).minRating);
    expect(c.served).toBeGreaterThanOrEqual(rankInfo(5).minServed);
    expect(resolveSandbox({ day: 20, custom: { rating: 9 } }).rating).toBe(5);
    expect(resolveSandbox({ day: 20, custom: { served: 999999 } }).served).toBeLessThanOrEqual(servedCap(20));
    // без молока то, что после молока, снимается; недоступное в первый день тоже
    const items = resolveSandbox({ day: 30, custom: { items: ['stencil', 'thermo', 'beans'] } }).items;
    expect(items).toEqual(['beans']);
    expect(resolveSandbox({ day: 30, custom: { items: ['milk', 'stencil'] } }).items).toEqual(['milk', 'stencil']);
    expect(resolveSandbox({ day: 1, custom: { items: ['beans'] } }).items).toEqual([]);
  });
  test('состояние G: куплено ровно выведенное', () => {
    const r = resolveSandbox({ day: 12, profile: 'confident' });
    const s = makeSandboxState({ day: 12, profile: 'confident' });
    for (const id of allShopIds()) expect(s[id], id).toBe(r.items.includes(id));
    expect(s).toMatchObject({ rank: r.rank, day: 12, money: r.money, served: r.served });
  });
  test('обучение: выключено — пройдено всё; включено — только виденное к этому рангу', () => {
    const off = makeSandboxState({ day: 10, showTutorial: false }).tutorialSeen;
    for (const d of DRINKS) expect(newDrinkCard(d.id, off)).toBeNull();
    const on = makeSandboxState({ day: 10, showTutorial: true });
    expect(on.tutorialSeen).toContain(SEEN_MARK);
    // напитки текущего и будущих рангов — новые: карточка покажется
    for (const d of DRINKS.filter((x) => x.rank >= on.rank)) expect(newDrinkCard(d.id, on.tutorialSeen), d.id).not.toBeNull();
    // станции текущего и будущих рангов не помечены
    for (const e of EQUIPMENT.filter((x) => x.rank >= on.rank)) expect(on.tutorialSeen).not.toContain(e.id);
    expect(makeSandboxState({ day: 1, showTutorial: true }).tutorialSeen).toEqual(freshSeen());
  });
  test('границы значений и разбор сохранённой конфигурации', () => {
    const c = normalizeSandboxConfig({ day: 999, profile: 'x' as never, mode: 'y' as never, pace: 'z' as never });
    expect(c).toMatchObject({ day: SANDBOX_MAX_DAY, profile: 'medium', mode: 'all', pace: 'normal', custom: null });
    expect(parseSandboxConfig(null)).toEqual(defaultSandboxConfig());
    expect(parseSandboxConfig('{{')).toEqual(defaultSandboxConfig());
    const mine = { ...defaultSandboxConfig(), day: 10, profile: 'confident' as const, mode: 'typical' as const, custom: { rank: 3, items: ['milk'] } };
    expect(parseSandboxConfig(serializeSandboxConfig(mine))).toEqual(mine);
  });
});

describe('песочница: подмена заказа', () => {
  const eq = Object.fromEntries(EQ_IMPL.map((e) => [e, true]));
  const st = { rank: 9, day: 12, milk: true, eq };
  test('без подмены заказы прежние (те же числа при том же rng)', () => {
    for (let i = 0; i < 30; i++) {
      expect(rollOrder(st, 'regular', seeded(i + 1))).toEqual(rollOrder({ ...st, override: undefined }, 'regular', seeded(i + 1)));
    }
  });
  test('напиток, размер, холод, сироп, еда и крепость подменяются', () => {
    const o = rollOrder({ ...st, override: { drink: 'latte', cold: true, syrup: 'Ваниль', strong: true, food: null } }, 'student', seeded(5));
    expect(o).toMatchObject({ id: 'latte', cold: true, key: 'icedlatte', strong: true, food: null });
    expect(o.syrup?.name).toBe('Ваниль');
    const t = rollOrder({ ...st, override: { drink: 'cappuccino', cold: false, syrup: null, altMilk: 'Овсяное' } }, 'regular', seeded(9));
    expect(t).toMatchObject({ id: 'cappuccino', cold: false, syrup: null, altMilk: { name: 'Овсяное' } });
  });
  test('все напитки меню можно заказать подменой', () => {
    for (const d of DRINKS) expect(rollOrder({ ...st, override: { drink: d.id } }, 'regular', seeded(3)).id).toBe(d.id);
  });
});

describe('песочница: статистика смены', () => {
  const rec = (o: Partial<ServeRecord>): ServeRecord => ({ serve: 40, prep: 30, tasks: 3, q: 2, byPlayer: true, ...o });
  test('среднее, медиана, доли и профиль для shop-sim', () => {
    const t = modelPrepTime(3);
    const s = summarizeShift([rec({ prep: t, q: 2 }), rec({ prep: t * 2, q: 1, serve: 60 }), rec({ prep: t * 1.5, q: 0, serve: 50 }), rec({ prep: t * 0.5, q: 2, serve: 30 })], { lost: 2, revenue: 400, tips: 55, costs: 120 });
    expect(s.profile.speed).toBe(1.25);
    expect(s.profile.q).toEqual([0.25, 0.25, 0.5]);
    expect(s.serveTime).toEqual({ mean: 45, median: 45 });
    expect(s).toMatchObject({ served: 4, lost: 2, income: 455, costs: 120 });
    expect(s.byTasks['3']?.n).toBe(4);
  });
  test('помощник в профиль игрока не входит; пустая смена не падает', () => {
    const s = summarizeShift([rec({}), rec({ byPlayer: false, prep: null, tasks: null, q: 0 })], { lost: 0, revenue: 0, tips: 0, costs: 0 });
    expect(s.servedByHelper).toBe(1);
    expect(s.profile.q).toEqual([0, 0, 1]);
    const e = summarizeShift([], { lost: 1, revenue: 0, tips: 0, costs: 0 });
    expect(e.profile).toMatchObject({ speed: null, q: [0, 0, 0] });
    expect(e.serveTime).toBeNull();
  });
});
