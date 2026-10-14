import { describe, expect, test } from 'vitest';
import {
  ORDER_OVERHEAD_SECONDS, PATIENCE_A, PATIENCE_K, PATIENCE_RANDOM, QUEUE_DECAY, estimatedPrepSeconds, newbieFactor, patienceMax, queueDecayRate, queueOrder, queuePosition
} from '../src/game/api';

const ord = (key: string, o: { cold?: boolean; shots?: number; syrup?: unknown; food?: unknown } = {}) => ({ key, cold: false, shots: 1, syrup: null, food: null, ...o });
const seeded = (s: number) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

describe('оценка времени заказа', () => {
  test('растёт с числом шагов: эспрессо < американо < латте < латте с сиропом и едой', () => {
    const t = [ord('espresso'), ord('americano'), ord('latte'), ord('latte', { syrup: {}, food: {} })].map(estimatedPrepSeconds);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1] as number);
  });
  test('двойной эспрессо заметно дольше одинарного (два полных цикла)', () => {
    const one = estimatedPrepSeconds(ord('espresso'));
    const two = estimatedPrepSeconds(ord('espresso2', { shots: 2 }));
    expect(two - one).toBeGreaterThan(25);
    expect(estimatedPrepSeconds(ord('cappuccino', { shots: 2 }))).toBeGreaterThan(estimatedPrepSeconds(ord('cappuccino')));
  });
  test('заказ из 5–6 шагов около минуты, как в реальном замере', () => {
    const t = estimatedPrepSeconds(ord('latte'));
    expect(t).toBeGreaterThan(55);
    expect(t).toBeLessThan(70);
    expect(estimatedPrepSeconds(ord('espresso'))).toBeGreaterThan(ORDER_OVERHEAD_SECONDS + 20);
  });
});

describe('терпение гостя', () => {
  test('растёт со сложностью заказа и зависит от типа', () => {
    for (const type of ['regular', 'student', 'hurry'] as const) {
      const easy = patienceMax(type, { pace: 'normal', prep: 30 });
      const hard = patienceMax(type, { pace: 'normal', prep: 90 });
      expect(hard).toBeGreaterThan(easy);
      expect(easy).toBeCloseTo(PATIENCE_A[type] + PATIENCE_K[type] * 30);
    }
    expect(patienceMax('hurry', { pace: 'normal', prep: 60 })).toBeLessThan(patienceMax('regular', { pace: 'normal', prep: 60 }));
  });
  test('новичкам больше: день 1 ×1,4, 2 ×1,3, 3 ×1,2, 4–5 ×1,1, дальше ×1', () => {
    expect([1, 2, 3, 4, 5, 6, 30].map(newbieFactor)).toEqual([1.4, 1.3, 1.2, 1.1, 1.1, 1, 1]);
    const base = patienceMax('regular', { pace: 'normal', prep: 60, day: 6 });
    expect(patienceMax('regular', { pace: 'normal', prep: 60, day: 1 })).toBeCloseTo(base * 1.4);
  });
  test('случайный множитель 0,85–1,25 воспроизводим по генератору', () => {
    const [lo, hi] = PATIENCE_RANDOM;
    const base = patienceMax('student', { pace: 'normal', prep: 50 });
    const r1 = seeded(5), r2 = seeded(5);
    for (let i = 0; i < 200; i++) {
      const a = patienceMax('student', { pace: 'normal', prep: 50, rng: r1 });
      expect(a).toBe(patienceMax('student', { pace: 'normal', prep: 50, rng: r2 }));
      expect(a / base).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(a / base).toBeLessThanOrEqual(hi + 1e-9);
    }
  });
  test('темп, зал и помощник множатся как раньше', () => {
    const b = patienceMax('regular', { pace: 'normal', prep: 40 });
    expect(patienceMax('regular', { pace: 'cozy', prep: 40 })).toBeCloseTo(b * 1.5);
    expect(patienceMax('regular', { pace: 'hard', prep: 40, cozy: true, helper: true })).toBeCloseTo(b * 0.75 * 1.15 * 1.2);
  });
});

describe('строгая очередь', () => {
  test('первый — самый ранний из не ушедших; после ухода первого пересчитывается', () => {
    const a = { id: 1 }, b = { id: 2 }, c = { id: 3 };
    const q = [a, b, c];
    expect(queueOrder(q)).toBe(a);
    expect(queuePosition(q, c)).toBe(2);
    expect(queueOrder(q.filter((x) => x !== a))).toBe(b);
    const l = [{ id: 1, leaving: true }, b, c];
    expect(queueOrder(l)).toBe(b);
    expect(queuePosition(l, b)).toBe(0);
    expect(queueOrder([])).toBeNull();
  });
  test('скорость убывания: 1, 0,5, 0,3 и не возрастает; не больше 1', () => {
    expect([0, 1, 2, 3, 7].map(queueDecayRate)).toEqual([1, 0.5, 0.3, 0.3, 0.3]);
    for (let i = 1; i < 6; i++) expect(queueDecayRate(i)).toBeLessThanOrEqual(queueDecayRate(i - 1));
    expect(Math.max(...QUEUE_DECAY)).toBeLessThanOrEqual(1);
  });
});
