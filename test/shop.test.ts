import { describe, expect, test } from 'vitest';
import { DRINKS, EQUIPMENT, EQ_IMPL, MILK_RANK, hasOrderEffect, isShopItemAvailable, needsMilk, newlyAvailable, orderUsesItem, rollOrder, shopNewText } from '../src/game/api';
import type { ShopItem } from '../src/game/api';

/** Те же позиции, что в магазине (src/legacy/00-core.js), только id и условия. */
const BASE: ShopItem[] = [
  { id: 'milk' }, { id: 'beans' }, { id: 'stencil' }, { id: 'grinderPro' }, { id: 'tamper' }, { id: 'thermo' },
  { id: 'machine', minDay: 2 }, { id: 'cozy' }, { id: 'wifi', minDay: 2 }, { id: 'cards', minDay: 2 }, { id: 'helper', minRank: 5 }
];
const ITEMS: ShopItem[] = [...BASE, ...EQUIPMENT.filter((e) => EQ_IMPL.includes(e.id)).map((e) => ({ id: 'eq_' + e.id }))];
const st = (rank: number, owned: string[] = []) => ({ rank, owned: Object.fromEntries(owned.map((i) => [i, true])) });
const shown = (rank: number, owned: string[] = []) => ITEMS.filter((i) => isShopItemAvailable(i, st(rank, owned))).map((i) => i.id);
const item = (id: string): ShopItem => ITEMS.find((i) => i.id === id) as ShopItem;

describe('магазин: что показывается', () => {
  test('ранг 1: молока и всего, что от него зависит, нет', () => {
    const s = shown(1);
    for (const id of ['milk', 'stencil', 'thermo']) expect(s).not.toContain(id);
    expect(s.filter((i) => i.startsWith('eq_'))).toEqual([]);
  });
  test('молоко появляется с ранга первого молочного напитка', () => {
    const minRank = Math.min(...DRINKS.filter(needsMilk).map((d) => d.rank));
    expect(MILK_RANK).toBe(minRank);
    expect(MILK_RANK).toBeGreaterThan(1);
    expect(isShopItemAvailable(item('milk'), st(MILK_RANK - 1))).toBe(false);
    expect(isShopItemAvailable(item('milk'), st(MILK_RANK))).toBe(true);
  });
  test('питчер с термометром и трафарет только после молока', () => {
    for (const id of ['thermo', 'stencil']) {
      expect(isShopItemAvailable(item(id), st(MILK_RANK))).toBe(false);
      expect(isShopItemAvailable(item(id), st(MILK_RANK, ['milk']))).toBe(true);
    }
  });
  test('сразу полезное показывается всегда', () => {
    for (const id of ['beans', 'grinderPro', 'tamper', 'machine', 'cozy', 'wifi', 'cards', 'helper']) expect(shown(1)).toContain(id);
  });
  test('оборудование: не раньше ранга и не раньше, чем есть что приготовить', () => {
    expect(shown(2)).toContain('eq_case_snacks');
    expect(shown(2)).not.toContain('eq_case_pastry');
    expect(shown(3)).toContain('eq_case_pastry');
    expect(shown(3)).toContain('eq_cream'); // ванильный раф (ранг 3) не требует покупки молока
    expect(shown(2)).not.toContain('eq_cream');
    expect(shown(3)).not.toContain('eq_powders'); // какао варится на молоке: без него порошки бесполезны
    expect(shown(3, ['milk'])).toContain('eq_powders');
    expect(shown(3)).toContain('eq_ice');
    for (const e of EQUIPMENT.filter((x) => EQ_IMPL.includes(x.id))) expect(shown(e.rank - 1, ['milk'])).not.toContain('eq_' + e.id);
  });
  test('микроволновка только при купленной витрине с блюдом, которое можно разогреть', () => {
    expect(shown(9)).not.toContain('eq_microwave');
    expect(shown(9, ['eq_fridge_deli'])).toContain('eq_microwave');
  });
  test('станция, у всех напитков которой есть ещё одна нужная станция, ждёт её', () => {
    // аэрокано нужны и лёд, и сифон: сифон появляется после льдогенератора
    expect(shown(5, ['milk'])).not.toContain('eq_whipper');
    expect(shown(5, ['milk', 'eq_ice'])).toContain('eq_whipper');
    expect(shown(6, ['milk'])).toContain('eq_foamer');
    expect(shown(6)).not.toContain('eq_foamer');
  });
  test('купленное остаётся в списке при любом ранге и без зависимостей', () => {
    expect(isShopItemAvailable(item('milk'), st(1, ['milk']))).toBe(true);
    expect(isShopItemAvailable(item('stencil'), st(1, ['stencil']))).toBe(true);
    expect(isShopItemAvailable(item('eq_boba'), st(1, ['eq_boba']))).toBe(true);
  });
  test('с нуля можно докупить всё: ни одна позиция не ждёт то, что само скрыто', () => {
    let owned: string[] = [];
    for (let rank = 1; rank <= 9; rank++) {
      for (let pass = 0; pass < 30; pass++) {
        const add = ITEMS.filter((i) => !owned.includes(i.id) && isShopItemAvailable(i, st(rank, owned)));
        if (!add.length) break;
        owned = [...owned, ...add.map((i) => i.id)];
      }
    }
    expect(ITEMS.filter((i) => !owned.includes(i.id)).map((i) => i.id)).toEqual([]);
  });
});

describe('магазин: что нового', () => {
  test('повышение ранга и покупка молока показывают новое', () => {
    const up = newlyAvailable(ITEMS, st(MILK_RANK - 1), st(MILK_RANK)).map((i) => i.id);
    expect(up).toContain('milk');
    expect(up).not.toContain('stencil');
    const buy = newlyAvailable(ITEMS, st(MILK_RANK), st(MILK_RANK, ['milk'])).map((i) => i.id);
    expect(buy.sort()).toEqual(['stencil', 'thermo']);
  });
  test('текст для плашки', () => {
    expect(shopNewText([])).toBe('');
    expect(shopNewText(['А', 'Б'])).toBe('В магазине теперь можно купить: А, Б.');
    expect(shopNewText(['А', 'Б', 'В', 'Г', 'Д'])).toBe('В магазине теперь можно купить: А, Б, В и ещё 2.');
  });
});

describe('гарантия отдачи покупки', () => {
  const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const eqOn = (ids: string[]) => Object.fromEntries(EQ_IMPL.map((e) => [e, ids.includes(e)]));
  test('молоко: гость-студент в первые дни тоже закажет молочное', () => {
    for (let s = 1; s < 80; s++) {
      const o = rollOrder({ rank: MILK_RANK, day: 2, milk: true, focus: 'milk' }, 'student', seeded(s));
      expect(orderUsesItem('milk', o)).toBe(true);
    }
  });
  test('оборудование: заказ использует купленное', () => {
    const cases: [string, number, string[]][] = [
      ['eq_ice', 4, ['ice']], ['eq_powders', 4, ['powders']], ['eq_tea', 5, ['tea']], ['eq_matcha', 5, ['matcha']],
      ['eq_case_snacks', 3, ['case_snacks']], ['eq_microwave', 7, ['case_deli', 'fridge_deli', 'microwave', 'case_snacks', 'case_pastry']],
      ['eq_cream', 4, ['cream']], ['eq_foamer', 7, ['foamer']]
    ];
    for (const [id, rank, eqs] of cases) {
      for (let s = 1; s < 60; s++) {
        const o = rollOrder({ rank, day: 9, milk: true, eq: eqOn(eqs), focus: id }, 'regular', seeded(s));
        expect(orderUsesItem(id, o), `${id} seed ${s}`).toBe(true);
      }
    }
  });
  test('без focus заказы считаются как раньше: одинаковые числа дают одинаковый заказ', () => {
    for (let s = 1; s < 30; s++) {
      const a = rollOrder({ rank: 6, day: 5, milk: true, eq: eqOn(['ice']) }, 'regular', seeded(s));
      const b = rollOrder({ rank: 6, day: 5, milk: true, eq: eqOn(['ice']), focus: undefined }, 'regular', seeded(s));
      expect(a).toEqual(b);
    }
  });
  test('вещи не про заказы не получают гарантии', () => {
    expect(hasOrderEffect('beans')).toBe(false);
    expect(hasOrderEffect('wifi')).toBe(false);
    expect(hasOrderEffect('milk')).toBe(true);
    expect(hasOrderEffect('eq_ice')).toBe(true);
  });
});
