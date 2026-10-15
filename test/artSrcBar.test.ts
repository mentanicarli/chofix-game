import { describe, expect, test } from 'vitest';
import SHOWCASE from '../art-src/bar/showcase.svg?raw';
import GLASS from '../art-src/bar/showcase-glass.svg?raw';
import SNACKS from '../art-src/bar/sc-snacks.svg?raw';
import PASTRY from '../art-src/bar/sc-pastry.svg?raw';
import DESSERT from '../art-src/bar/sc-dessert.svg?raw';
import DELI from '../art-src/bar/sc-deli.svg?raw';
import MICRO from '../art-src/bar/sc-micro.svg?raw';
import ICE from '../art-src/bar/ice.svg?raw';

/* Этап 12.3(1): геометрия исходников частей бара (стайлгайд, разд. 12–13). Зоны кликов из index.html (#bZones): food (520,540,270,72), ice (330,516,124,90). */
const FOOD_ZONE = { x: 520, y: 540, w: 270, h: 72 };
const ICE_ZONE = { x: 330, y: 516, w: 124, h: 90 };
const vb = (s: string): { x: number; y: number; w: number; h: number } => {
  const m = /viewBox="(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)"/.exec(s);
  if (!m) throw new Error('нет viewBox');
  return { x: +(m[1] as string), y: +(m[2] as string), w: +(m[3] as string), h: +(m[4] as string) };
};
const rect = (s: string, fill: string): { x: number; y: number; w: number; h: number } => {
  const m = new RegExp(`<rect x="([\\d.]+)" y="([\\d.]+)" width="([\\d.]+)" height="([\\d.]+)"[^>]*fill="\\{\\{${fill}\\}\\}"`).exec(s);
  if (!m) throw new Error('нет rect ' + fill);
  return { x: +(m[1] as string), y: +(m[2] as string), w: +(m[3] as string), h: +(m[4] as string) };
};

describe('art-src/bar: витрина', () => {
  const body = rect(SHOWCASE, 'STEEL'); /* корпус */
  const interior = rect(SHOWCASE, 'PAPER'); /* задняя стенка */
  const glass = rect(GLASS, 'GLASS');
  test('стекло точно закрывает внутренность витрины, внутренность внутри рамки корпуса', () => {
    expect(glass).toEqual(interior);
    expect(interior.x).toBeGreaterThan(body.x);
    expect(interior.y).toBeGreaterThan(body.y);
    expect(interior.x + interior.w).toBeLessThan(body.x + body.w);
    expect(interior.y + interior.h).toBeLessThan(body.y + body.h);
  });
  test('части с едой лежат внутри витрины и не выходят за рамку: верхний ряд на полке, нижний на дне', () => {
    const shelfTop = 565; /* верх полки */
    const floor = interior.y + interior.h - 2; /* дно */
    for (const [src, base] of [[SNACKS, shelfTop], [PASTRY, shelfTop], [DESSERT, floor], [DELI, floor]] as const) {
      const b = vb(src);
      expect(b.x).toBeGreaterThanOrEqual(interior.x);
      expect(b.x + b.w).toBeLessThanOrEqual(interior.x + interior.w);
      expect(b.y + b.h).toBeLessThanOrEqual(base + 3); /* рамка части не ниже основания, еда не уходит под полку */
    }
  });
  test('витрина целиком в зоне клика food и не заходит на микроволновку', () => {
    expect(body.x).toBeGreaterThanOrEqual(FOOD_ZONE.x);
    const micro = rect(MICRO, 'STEEL');
    expect(body.x + body.w).toBeLessThan(micro.x);
    expect(micro.x + micro.w).toBeLessThanOrEqual(FOOD_ZONE.x + FOOD_ZONE.w);
  });
  test('в рамке части корпус стоит не ниже тени: низ цоколя внутри box', () => {
    const b = vb(SHOWCASE);
    const plinth = rect(SHOWCASE, 'STEEL_SH');
    expect(plinth.y + plinth.h).toBeLessThanOrEqual(b.y + b.h);
  });
});

describe('art-src/bar: микроволновка и ледогенератор', () => {
  test('окно микроволновки внутри дверцы, дверца внутри корпуса', () => {
    const body = rect(MICRO, 'STEEL');
    const door = rect(MICRO, 'STEEL_HI');
    const win = rect(MICRO, 'DARK');
    expect(door.x).toBeGreaterThan(body.x);
    expect(door.x + door.w).toBeLessThan(body.x + body.w);
    expect(win.x).toBeGreaterThan(door.x);
    expect(win.y).toBeGreaterThan(door.y);
    expect(win.x + win.w).toBeLessThan(door.x + door.w);
    expect(win.y + win.h).toBeLessThan(door.y + door.h);
  });
  test('корпус ледогенератора и совок в зоне клика ice; окно внутри корпуса', () => {
    const body = rect(ICE, 'STEEL');
    const win = rect(ICE, 'GLASS_DP');
    expect(body.x).toBeGreaterThanOrEqual(ICE_ZONE.x);
    expect(body.x + body.w + 12).toBeLessThanOrEqual(ICE_ZONE.x + ICE_ZONE.w); /* +12: совок сбоку */
    expect(body.y).toBeGreaterThanOrEqual(ICE_ZONE.y);
    expect(win.x).toBeGreaterThan(body.x);
    expect(win.x + win.w).toBeLessThan(body.x + body.w);
    expect(win.y).toBeGreaterThan(body.y);
  });
  test('в исходниках бара нет подписей-текстов: предметы читаются без подписи', () => {
    for (const s of [SHOWCASE, GLASS, SNACKS, PASTRY, DESSERT, DELI, MICRO, ICE]) expect(s).not.toMatch(/<text\b/);
  });
});
