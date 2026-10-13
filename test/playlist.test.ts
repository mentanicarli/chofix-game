import { describe, expect, test } from 'vitest';
import { Playlist, shuffleOrder } from '../src/game/playlist';

/** Простой детерминированный генератор (mulberry32). */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('перемешивание треков', () => {
  test('все индексы ровно по разу', () => {
    for (let s = 1; s < 50; s++) {
      const o = shuffleOrder(9, seeded(s));
      expect([...o].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });
  test('первым не бывает запрещённый трек (треков больше одного)', () => {
    for (let s = 1; s < 200; s++) expect(shuffleOrder(4, seeded(s), 2)[0]).not.toBe(2);
    expect(shuffleOrder(2, () => 0, 0)[0]).toBe(1);
  });
  test('один трек и пустой список', () => {
    expect(shuffleOrder(1, seeded(1), 0)).toEqual([0]);
    expect(shuffleOrder(0, seeded(1))).toEqual([]);
  });
  test('первый трек разный на разных запусках, порядок не всегда одинаков', () => {
    const firsts = new Set<number>();
    const orders = new Set<string>();
    for (let s = 1; s < 80; s++) {
      const o = shuffleOrder(6, seeded(s));
      firsts.add(o[0] as number);
      orders.add(o.join());
    }
    expect(firsts.size).toBe(6);
    expect(orders.size).toBeGreaterThan(40);
  });
  test('равномерность: каждый трек первым примерно в 1/n случаев', () => {
    const rng = seeded(7);
    const cnt = [0, 0, 0, 0, 0];
    for (let i = 0; i < 10000; i++) {
      const first = shuffleOrder(5, rng)[0] as number;
      cnt[first] = (cnt[first] ?? 0) + 1;
    }
    expect(cnt.reduce((a, b) => a + b, 0)).toBe(10000);
    for (const c of cnt) expect(Math.abs(c - 2000)).toBeLessThan(250);
  });
});

describe('плейлист', () => {
  test('круг: каждый трек по разу, затем новая перестановка', () => {
    const p = new Playlist(5, seeded(3));
    for (let lap = 0; lap < 6; lap++) {
      const seen = [p.current];
      for (let i = 1; i < 5; i++) seen.push(p.advance());
      expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
      p.advance();
    }
  });
  test('последний трек круга не открывает следующий', () => {
    for (let s = 1; s < 200; s++) {
      const p = new Playlist(3, seeded(s));
      for (let lap = 0; lap < 5; lap++) {
        for (let i = 0; i < 2; i++) p.advance();
        const last = p.current;
        expect(p.peek()).not.toBe(last);
        expect(p.advance()).not.toBe(last);
      }
    }
  });
  test('peek совпадает с тем, что даст advance', () => {
    const p = new Playlist(4, seeded(11));
    for (let i = 0; i < 30; i++) {
      const n = p.peek();
      expect(p.advance()).toBe(n);
    }
  });
  test('один трек: играет по кругу и не падает', () => {
    const p = new Playlist(1, seeded(1));
    expect(p.current).toBe(0);
    expect(p.peek()).toBe(0);
    expect(p.advance()).toBe(0);
    p.skipNext();
    expect(p.advance()).toBe(0);
  });
  test('пустой список ничего не делает', () => {
    const p = new Playlist(0, seeded(1));
    expect(p.current).toBe(-1);
    expect(p.peek()).toBe(-1);
    expect(p.advance()).toBe(-1);
    p.skipNext();
    expect(p.current).toBe(-1);
  });
  test('нерабочий трек можно выбросить из круга', () => {
    const p = new Playlist(4, seeded(5));
    const bad = p.peek();
    p.skipNext();
    const rest = [p.current];
    for (let i = 0; i < 2; i++) rest.push(p.advance());
    expect(rest).not.toContain(bad);
    expect(new Set(rest).size).toBe(3);
  });
});
