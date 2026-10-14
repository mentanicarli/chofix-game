import { test, expect } from 'vitest';
const assert = { ok: (v: unknown, m?: string) => expect(v, m).toBeTruthy(), equal: (a: unknown, b: unknown) => expect(a).toBe(b), deepEqual: (a: unknown, b: unknown) => expect(a).toEqual(b), match: (a: string, re: RegExp) => expect(a).toMatch(re) };
import type { Drink } from '../src/game/types';
import { rollOrder } from '../src/game/orders';
import { say } from '../src/game/phrases';
import { nextRank, rankGap, isOrderable, drinkById, ENGINE } from '../src/game/menu';

const seeded = (s: number) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

test('ранг 1: только эспрессо, двойной эспрессо и американо, в первый день размер 0,2 л', () => {
  const r = seeded(7); const ids = new Set<string>();
  for (let i = 0; i < 300; i++) { const o = rollOrder({ rank: 1, day: 1, milk: true }, 'regular', r); ids.add(o.id); assert.ok(['espresso', 'espresso_double', 'americano'].includes(o.id)); assert.equal(o.size, '0.2'); }
  assert.ok(ids.has('espresso') && ids.has('espresso_double') && ids.has('americano'));
});
test('эспрессо — один шот, двойной — два; реплики различают их; сироп к ним не просят', () => {
  const r = seeded(21);
  for (let i = 0; i < 400; i++) {
    const o = rollOrder({ rank: 1, day: 5, milk: true }, 'regular', r);
    if (o.id === 'espresso') { assert.equal(o.shots, 1); assert.equal(o.key, 'espresso'); assert.ok(!o.syrup); assert.ok(/эспрессо/i.test(o.line) && !/двойной/i.test(o.line)); assert.equal(o.base, 70); }
    if (o.id === 'espresso_double') { assert.equal(o.shots, 2); assert.equal(o.key, 'espresso2'); assert.ok(!o.syrup); assert.ok(/двойной эспрессо/i.test(o.line)); assert.equal(o.base, 100); }
  }
});
test('размер классических напитков: с 3-го дня встречаются все, шоты по размеру, в реплике — размер', () => {
  const r = seeded(9); const seen = new Set<string>();
  for (let i = 0; i < 1500; i++) {
    const o = rollOrder({ rank: 3, day: 8, milk: true }, 'regular', r);
    if (o.id === 'cappuccino' && !o.cold) { seen.add(o.size); assert.equal(o.shots, o.size === '0.4' || o.size === '0.6' ? 2 : 1); assert.equal(o.price >= o.base, true); if (o.size !== '0.2') assert.ok(/на 0,[346] литра/.test(o.line), o.line); }
    if (o.id === 'flat_white') { assert.equal(o.size, '0.2'); assert.equal(o.shots, 2); }
  }
  assert.deepEqual([...seen].sort(), ['0.2', '0.3', '0.4', '0.6']);
});
test('раф идёт без молока: альтернативное молоко к нему не предлагается и не звучит', () => {
  const r = seeded(31);
  for (let i = 0; i < 300; i++) {
    const o = rollOrder({ rank: 9, day: 30, milk: true, eq: { cream: true }, override: { drink: 'vanilla_raf', altMilk: 'Овсяное' } }, 'regular', r);
    assert.equal(o.id, 'vanilla_raf'); assert.equal(o.altMilk, null); assert.ok(!/молоке/.test(o.line), o.line);
  }
});
test('сироп из рецепта: помпы по размеру', () => {
  const r = seeded(4);
  for (let i = 0; i < 100; i++) { const o = rollOrder({ rank: 9, day: 30, milk: true, eq: { cream: true }, override: { drink: 'raf_halva', size: '0.6' } }, 'regular', r); assert.equal(o.syrup?.pumps, 5); assert.equal(o.size, '0.6'); }
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

test('холодный американо: только с льдогенератором, 0,3–0,6 л, цена из меню', () => {
  const r = seeded(77); const cold: ReturnType<typeof rollOrder>[] = []; const none: string[] = [];
  for (let i = 0; i < 800; i++) {
    const o = rollOrder({ rank: 3, day: 6, milk: true, eq: { ice: true } }, 'regular', r);
    if (o.cold) cold.push(o);
    none.push(rollOrder({ rank: 3, day: 6, milk: true, eq: {} }, 'regular', r).key);
  }
  assert.ok(cold.length > 10);
  cold.forEach((o) => { assert.ok(/^iced(americano|latte|cappuccino)$/.test(o.key)); assert.ok(['0.3', '0.4', '0.6'].includes(o.size)); assert.ok(/холодный/i.test(o.line)); assert.ok(o.price >= 200); });
  assert.ok(!none.some((k) => k.startsWith('iced')));
  assert.ok(new Set(cold.map((o) => o.key)).size >= 2);
});
