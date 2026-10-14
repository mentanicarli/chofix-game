import { describe, expect, test } from 'vitest';
import { arrivalInterval, arrivalRange, clockMinutes, drinkCost, idealGrind, isRush, levelOf, patienceMax, PACE, ratingAfterLoss, restore, parseSave, score, settle, settleDay } from '../src/game/api';

/** Эталоны — прямые копии формул старого ядра; при переносе поведение не меняется. */
const seeded = (s: number) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

describe('экономика', () => {
  test('цена, чаевые и рейтинг как в старом serve()', () => {
    const r = settle({ basePrice: 100, beans: true, paidSyrup: true, quality: 2, type: 'hurry', flawless: true, cards: true, rating: 4.9 });
    const price = Math.round(100 * 1.15) + 20; // 135
    expect(r.price).toBe(price);
    expect(r.tip).toBe(Math.round(price * 0.2) + Math.round(price * 0.25) + Math.round(price * 0.1));
    expect(r.rating).toBeCloseTo(4.98);
    const bad = settle({ basePrice: 100, beans: false, paidSyrup: false, quality: 0, type: 'hurry', flawless: false, cards: false, rating: 3 });
    expect(bad).toMatchObject({ price: 60, tip: 0 });
    expect(bad.rating).toBeCloseTo(2.92);
    expect(settle({ basePrice: 100, beans: false, paidSyrup: false, quality: 1, type: 'hurry', flawless: false, cards: false, rating: 3 }).tip).toBe(25);
    expect(settle({ basePrice: 100, beans: false, paidSyrup: false, quality: 1, type: 'regular', flawless: false, cards: true, rating: 3 }).rating).toBeCloseTo(3.024);
  });
  test('потеря гостя и терпение', () => {
    expect(ratingAfterLoss(1.1)).toBe(1);
    expect(ratingAfterLoss(3)).toBeCloseTo(2.85);
    // без заказа, дня и случайности: только запас A, темп, зал и помощник
    expect(patienceMax('student', { pace: 'hard', cozy: true, helper: true })).toBeCloseTo(70 * 0.75 * 1.15 * 1.2);
    expect(patienceMax('hurry', { pace: 'cozy' })).toBe(35 * 1.5);
  });
  test('конец дня: аренда, уютный режим не уходит в минус, условия проигрыша', () => {
    expect(settleDay({ money: 50, pace: 'cozy' })).toEqual({ money: 0, over: false, rent: PACE.cozy.rent });
    expect(settleDay({ money: 100, pace: 'hard' }).over).toBe(true);
    expect(settleDay({ money: 100, pace: 'normal' })).toMatchObject({ money: -40, over: false });
    expect(settleDay({ money: -500, pace: 'normal' }).over).toBe(true);
  });
  test('себестоимость', () => {
    // по реальным объёмам (src/game/economy.ts, recipeCost): шот × число шотов, молоко/сливки/вода по мл, расходники по размеру чашки
    expect(drinkCost('espresso', false)).toBe(26);
    expect(drinkCost('espresso2', false)).toBe(45);
    expect(drinkCost('americano', false)).toBe(34);
    expect(drinkCost('americano', true)).toBe(40);
    expect(drinkCost('latte', false)).toBe(52);
    expect(drinkCost('flatwhite', false)).toBe(67);
    expect(drinkCost('cappuccino', false)).toBe(47);
    expect(drinkCost('raf', true)).toBe(61);
  });
});

describe('смена', () => {
  test('интервал приходов', () => {
    expect(arrivalRange(1)).toEqual([42, 56]);
    expect(arrivalRange(3)).toEqual([30, 42]);
    expect(arrivalRange(5)).toEqual([27, 38]);
    expect(arrivalRange(30)).toEqual([20, 28]);
    const k = 1.25 - 0.1 * 4;
    expect(arrivalInterval({ day: 1, rating: 4, t: 0, wifi: false }, () => 0)).toBeCloseTo(42 * k);
    expect(arrivalInterval({ day: 1, rating: 4, t: 120, wifi: true }, () => 1)).toBeCloseTo(56 * k * 0.6 * 0.88);
  });
  test('час пик 12:00–13:00 и часы', () => {
    expect(isRush(119)).toBe(false);
    expect(isRush(120)).toBe(true);
    expect(isRush(149)).toBe(true);
    expect(isRush(150)).toBe(false);
    expect(clockMinutes(0)).toBe(480);
    expect(clockMinutes(999)).toBe(1080);
  });
  test('идеальный помол', () => {
    expect(idealGrind(1, () => 0.9)).toBe(3);
    const seen = new Set<number>();
    const r = seeded(1);
    for (let i = 0; i < 100; i++) seen.add(idealGrind(5, r));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });
});

describe('качество', () => {
  test('взвешенная оценка и пороги', () => {
    expect(score(['grind', 'tamp', 'shot'], { grind: 1, tamp: 1, shot: 1 })).toBe(1);
    expect(score(['grind', 'shot'], { grind: 1 })).toBeCloseTo((0.1 + 0.4 * 0.33) / 0.43);
    expect(score([], {})).toBe(0.5);
    expect([levelOf(0.78), levelOf(0.779), levelOf(0.5), levelOf(0.49)]).toEqual([2, 1, 1, 0]);
  });
});

describe('сохранение', () => {
  test('битое сохранение — как отсутствие', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('{не json')).toBeNull();
    expect(parseSave('{"day":2}')).toBeNull();
  });
  test('старое сохранение без ранга получает ранг по дню и рейтингу', () => {
    const sv = parseSave('{"day":6,"money":900,"rating":3.2,"pace":"normal"}');
    expect(sv).not.toBeNull();
    if (sv) {
      const r = restore(sv);
      expect(r.rank).toBeGreaterThanOrEqual(2);
      expect(r.served).toBeGreaterThanOrEqual(48);
      expect(r.grindSet).toBe(3);
    }
  });
  test('сохранение с рангом не трогается', () => {
    expect(restore({ day: 9, money: 1, rating: 5, pace: 'cozy', rank: 2, served: 10, grindSet: 4, up: ['milk'] })).toMatchObject({ rank: 2, served: 10, grindSet: 4, up: ['milk'] });
  });
});

describe('холодный американо', () => {
  test('себестоимость и вес льда в оценке', () => {
    expect(drinkCost('icedamericano', false, { size: '0.3' })).toBe(39);
    expect(drinkCost('icedamericano', true, { size: '0.3' })).toBe(45);
    expect(drinkCost('icedlatte', false, { size: '0.3' })).toBe(56);
    expect(drinkCost('icedcappuccino', false, { size: '0.3' })).toBe(49);
    expect(score(['ice'], { ice: 1 })).toBe(1);
  });
});
