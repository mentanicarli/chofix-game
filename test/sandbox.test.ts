import { describe, expect, test } from 'vitest';
import {
  DRINKS, EQUIPMENT, EQ_IMPL, MAX_RANK, SANDBOX_MAX_DAY, SEEN_MARK, SHOP_BASE_IDS, allShopIds, defaultSandboxConfig, derivedRank, makeSandboxState, newDrinkCard,
  normalizeSandboxConfig, parseSandboxConfig, rankInfo, rollOrder, serializeSandboxConfig, summarizeShift, withRank, freshSeen, modelPrepTime
} from '../src/game/api';
import type { ServeRecord } from '../src/game/api';
import core from '../src/legacy/00-core.js?raw';

const seeded = (s: number) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

describe('песочница: состояние старта', () => {
  test('список позиций магазина совпадает с SHOP в старом ядре', () => {
    const ids = [...core.matchAll(/\{ id: '(\w+)',\s+cat:/g)].map((m) => m[1]);
    expect(ids).toEqual([...SHOP_BASE_IDS]);
  });
  test('день 1 и «Ничего»: как новая игра, ничего не куплено', () => {
    const s = makeSandboxState({ day: 1, rank: 1, items: [], rating: 3, money: 500, pace: 'normal', showTutorial: true });
    expect(s).toMatchObject({ rank: 1, day: 1, served: 0, money: 500, rating: 3, pace: 'normal', grindSet: 3, idealGrind: 3, tutOff: false, fresh: [], tutorialSeen: freshSeen() });
    for (const id of allShopIds()) expect(s[id]).toBe(false);
    expect(Object.values(s).filter((v) => v === true)).toEqual([]);
  });
  test('ранг 9 и «Все открыто»: куплено всё, ранг и минимумы на месте', () => {
    const s = makeSandboxState(withRank(defaultSandboxConfig(), 9));
    const info = rankInfo(9);
    expect(s.rank).toBe(9);
    expect(s.day).toBeGreaterThanOrEqual(info.minDay);
    expect(s.rating).toBeGreaterThanOrEqual(info.minRating);
    expect(s.served).toBeGreaterThanOrEqual(info.minServed);
    for (const id of allShopIds()) expect(s[id]).toBe(true);
    for (const e of EQUIPMENT.filter((x) => EQ_IMPL.includes(x.id))) expect(s['eq_' + e.id]).toBe(true);
  });
  test('согласованность при смене ранга: день, рейтинг и поданные не ниже минимума, выше оставляем', () => {
    for (let r = 1; r <= MAX_RANK; r++) {
      const c = withRank({ ...defaultSandboxConfig(), rating: 1, day: 1 }, r);
      const i = rankInfo(r);
      expect(c.rank).toBe(r);
      expect(c.day).toBeGreaterThanOrEqual(i.minDay);
      expect(c.rating).toBeGreaterThanOrEqual(i.minRating);
      expect(c.served).toBeGreaterThanOrEqual(i.minServed);
      expect(derivedRank(c.day, c.rating, c.served)).toBeGreaterThanOrEqual(r);
    }
    const hi = withRank({ ...defaultSandboxConfig(), day: 40, rating: 4.8, served: 500 }, 2);
    expect(hi).toMatchObject({ rank: 2, day: 40, rating: 4.8, served: 500 });
  });
  test('ранг не ниже, чем следует из дня, рейтинга и поданных', () => {
    const s = makeSandboxState({ day: 30, rank: 1, rating: 5, served: 300, items: [] });
    expect(s.rank).toBe(9);
    expect(makeSandboxState({ day: 30, rank: 1, rating: 5, served: 0, items: [] }).rank).toBe(1);
    // поправить день ниже минимума ранга можно: состояние берёт введённое
    expect(makeSandboxState({ ...defaultSandboxConfig(), day: 10, rank: 5 })).toMatchObject({ day: 10, rank: 5 });
  });
  test('выбор позиции магазина: куплено ровно выбранное', () => {
    const s = makeSandboxState({ ...defaultSandboxConfig(), items: ['milk', 'eq_ice', 'nope'] });
    expect(s['milk']).toBe(true);
    expect(s['eq_ice']).toBe(true);
    expect(s['beans']).toBe(false);
    expect(s['eq_blender']).toBe(false);
    expect(s['nope']).toBeUndefined();
  });
  test('обучение: выключено — пройдено всё, включено — как в новой игре', () => {
    const off = makeSandboxState({ ...defaultSandboxConfig(), showTutorial: false }).tutorialSeen;
    expect(off).toContain(SEEN_MARK);
    for (const d of DRINKS) expect(newDrinkCard(d.id, off)).toBeNull();
    expect(off).toContain('step:milk');
    expect(makeSandboxState({ ...defaultSandboxConfig(), showTutorial: true }).tutorialSeen).toEqual(freshSeen());
  });
  test('границы значений и разбор сохранённой конфигурации', () => {
    const c = normalizeSandboxConfig({ day: 999, rank: 0, rating: 9, money: -5, pace: 'x' as never });
    expect(c).toMatchObject({ day: SANDBOX_MAX_DAY, rank: 1, rating: 5, money: 0, pace: 'normal' });
    expect(parseSandboxConfig(null)).toEqual(defaultSandboxConfig());
    expect(parseSandboxConfig('{{')).toEqual(defaultSandboxConfig());
    const mine = { ...defaultSandboxConfig(), day: 10, rank: 5, items: ['milk'] };
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
