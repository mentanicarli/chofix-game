import { test, expect } from 'vitest';
const assert = { ok: (v: unknown, m?: string) => expect(v, m).toBeTruthy(), equal: (a: unknown, b: unknown) => expect(a).toBe(b), deepEqual: (a: unknown, b: unknown) => expect(a).toEqual(b), match: (a: string, re: RegExp) => expect(a).toMatch(re) };
import type { Drink } from '../src/game/types';
import { rollOrder } from '../src/game/orders';
import { say } from '../src/game/phrases';
import { nextRank, rankGap, isOrderable, drinkById, ENGINE } from '../src/game/menu';

const seeded = (s: number) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

test('ранг 1: только эспрессо и американо', () => {
  const r = seeded(7);
  for (let i = 0; i < 200; i++) assert.ok(['espresso_double', 'americano'].includes(rollOrder({ rank: 1, day: 1, milk: true }, 'regular', r).id));
});
test('ранг 2 без молочной техники — молочные не заказывают', () => {
  const r = seeded(3);
  for (let i = 0; i < 200; i++) assert.ok(!['cappuccino', 'latte'].includes(rollOrder({ rank: 2, day: 3, milk: false }, 'regular', r).id));
});
test('ранг 3 с молоком: появляется флэт уайт', () => {
  const r = seeded(11); const ids = new Set();
  for (let i = 0; i < 400; i++) ids.add(rollOrder({ rank: 3, day: 6, milk: true }, 'regular', r).id);
  assert.ok(ids.has('flat_white') && ids.has('latte') && ids.has('cappuccino'));
});
test('каждый заказ имеет реплику, цену и ключ механики', () => {
  const r = seeded(5);
  for (let i = 0; i < 300; i++) { const o = rollOrder({ rank: 3, day: 6, milk: true }, (['regular', 'student', 'hurry'] as const)[i % 3] as 'regular', r); assert.ok(o.line.length > 5 && o.price > 0 && ENGINE[o.id]); }
});
test('реплика склоняет сироп и добавляет «покрепче»', () => {
  const s = say({ id: 'latte', name: 'Латте', strong: true, syrup: { name: 'Ваниль' } }, 'regular', () => 0);
  assert.match(s, /с ванильным сиропом покрепче/);
});
test('реплика не склеивает «Можно мне»', () => {
  const s = say({ id: 'americano', name: 'Американо' }, 'student', () => .99); assert.ok(!/мне мне|Можно можно/i.test(s));
});
test('повышение ранга по условиям', () => {
  assert.equal(nextRank(1, { day: 2, rating: 3, served: 100 }), null);
  assert.equal(nextRank(1, { day: 3, rating: 2, served: 8 })?.rank, 2);
  assert.deepEqual(rankGap(1, { day: 3, rating: 1.5, served: 0 })?.missing, ['рейтинг 2.0', 'подано 8']);
});
test('флэт уайт и эспрессо доступны с правильных рангов', () => {
  assert.ok(isOrderable(drinkById['flat_white'] as Drink, { rank: 3 }) && !isOrderable(drinkById['flat_white'] as Drink, { rank: 2 }));
  assert.ok(isOrderable(drinkById['matcha_latte'] as Drink, { rank: 4 }) && !isOrderable(drinkById['matcha_latte'] as Drink, { rank: 3 }));
});

test('раф-семейство требует кувшин сливок и молоко', () => {
  const r = seeded(21); const ids = new Set(); const none = new Set();
  for (let i = 0; i < 600; i++) { ids.add(rollOrder({ rank: 3, day: 6, milk: true, eq: { cream: true } }, 'regular', r).id); none.add(rollOrder({ rank: 3, day: 6, milk: true, eq: {} }, 'regular', r).id); }
  assert.ok(ids.has('vanilla_raf'));
  assert.ok(!none.has('vanilla_raf') && !none.has('raf'));
});
test('ванильный раф всегда с ванилью и без повторного «с ванильным сиропом» в реплике', () => {
  const r = seeded(33);
  for (let i = 0; i < 800; i++) { const o = rollOrder({ rank: 3, day: 6, milk: true, eq: { cream: true } }, 'regular', r); if (o.id === 'vanilla_raf') { assert.equal(o.syrup?.name, 'Ваниль'); assert.ok(!/сиропом/.test(o.line)); } }
});
test('сироп в обычном заказе добавляет 20 ₽', () => {
  const r = seeded(9); let seen = false;
  for (let i = 0; i < 800; i++) { const o = rollOrder({ rank: 3, day: 6, milk: true, eq: {} }, 'regular', r); if (o.syrup && !o.syrupImplied) { seen = true; assert.ok(o.price >= 20 + 100); } }
  assert.ok(seen);
});

test('холодный американо: только с льдогенератором, 0,3 л, цена из меню', () => {
  const r = seeded(77); const cold: ReturnType<typeof rollOrder>[] = []; const none: string[] = [];
  for (let i = 0; i < 800; i++) {
    const o = rollOrder({ rank: 3, day: 6, milk: true, eq: { ice: true } }, 'regular', r);
    if (o.cold) cold.push(o);
    none.push(rollOrder({ rank: 3, day: 6, milk: true, eq: {} }, 'regular', r).key);
  }
  assert.ok(cold.length > 10);
  cold.forEach((o) => { assert.ok(/^iced(americano|latte|cappuccino)$/.test(o.key)); assert.equal(o.size, '0.3'); assert.ok(/холодный/i.test(o.line)); assert.ok(o.price >= 200); });
  assert.ok(!none.some((k) => k.startsWith('iced')));
  assert.ok(new Set(cold.map((o) => o.key)).size >= 2);
});
