import { describe, expect, test } from 'vitest';
import FRIDGE from '../art-src/bar/showcase.svg?raw';
import ICE from '../art-src/bar/ice.svg?raw';
import MICRO from '../art-src/bar/sc-micro.svg?raw';
import INDEX from '../index.html?raw';
import FRONT from '../art-src/bar/counter-front.svg?raw';
import NOSE from '../art-src/bar/counter-nose.svg?raw';

/* Этап 12.3(2): соотношения размеров по шкале docs/art/scale.md. Бар: 4,64 px/см (кофемашина 75 см = 348 px). Допуск у фона 0,75–1,25. */
const S_BAR = 4.64;
const MACHINE_PX = 348;
const MACHINE_CM = 75;
const rect = (s: string, fill: string): { x: number; y: number; w: number; h: number } => {
  const m = new RegExp(`<rect x="([\\d.]+)" y="([\\d.]+)" width="([\\d.]+)" height="([\\d.]+)"[^>]*fill="\\{\\{${fill}\\}\\}"`).exec(s);
  if (!m) throw new Error('нет rect ' + fill);
  return { x: +(m[1] as string), y: +(m[2] as string), w: +(m[3] as string), h: +(m[4] as string) };
};
const zone = (name: string): { x: number; y: number; w: number; h: number } => {
  const m = new RegExp(`<rect data-z="${name}" x="(\\d+)" y="(\\d+)" width="(\\d+)" height="(\\d+)"`).exec(INDEX);
  if (!m) throw new Error('нет зоны ' + name);
  return { x: +(m[1] as string), y: +(m[2] as string), w: +(m[3] as string), h: +(m[4] as string) };
};
const units = [
  { name: 'холодильная витрина', src: FRIDGE, cm: 60, z: 'food' },
  { name: 'ледогенератор', src: ICE, cm: 40, z: 'ice' },
  { name: 'микроволновка', src: MICRO, cm: 45, z: 'micro' }
] as const;

describe('шкала: подстоечные блоки против кофемашины', () => {
  for (const u of units) {
    test(`${u.name}: ширина фасада в допуске 0,75–1,25 от реальных ${u.cm} см`, () => {
      const front = rect(u.src, 'STEEL');
      const ratio = front.w / (u.cm * S_BAR);
      expect(ratio, u.name).toBeGreaterThanOrEqual(0.75);
      expect(ratio, u.name).toBeLessThanOrEqual(1.25);
    });
    test(`${u.name}: отношение к ширине кофемашины близко к реальному (допуск ±25 %)`, () => {
      const front = rect(u.src, 'STEEL');
      const real = u.cm / MACHINE_CM;
      const game = front.w / MACHINE_PX;
      expect(game / real).toBeGreaterThanOrEqual(0.75);
      expect(game / real).toBeLessThanOrEqual(1.25);
    });
  }
  test('соотношение блоков между собой как в жизни: микроволновка уже холодильника (45 : 60), ледогенератор уже микроволновки (40 : 45)', () => {
    const [f, i, m] = units.map((u) => rect(u.src, 'STEEL').w) as [number, number, number];
    expect(m / f).toBeGreaterThan(0.6);
    expect(m / f).toBeLessThan(0.9);
    expect(i / m).toBeGreaterThan(0.75);
    expect(i / m).toBeLessThanOrEqual(1.0);
  });
});

describe('подстоечные блоки: опора и стыковка', () => {
  const bays = units.map((u) => ({ ...u, bay: rect(u.src, 'DARK') }));
  test('все ниши начинаются на одной линии (верх торца столешницы, y 620) и уходят за нижний край кадра', () => {
    for (const b of bays) {
      expect(b.bay.y).toBe(620);
      expect(b.bay.y + b.bay.h).toBeGreaterThanOrEqual(720);
    }
  });
  test('ниши не пересекаются и внутри кадра 1280 px', () => {
    const sorted = [...bays].sort((a, b) => a.bay.x - b.bay.x);
    for (let k = 1; k < sorted.length; k++) expect((sorted[k] as (typeof bays)[number]).bay.x).toBeGreaterThan((sorted[k - 1] as (typeof bays)[number]).bay.x + (sorted[k - 1] as (typeof bays)[number]).bay.w);
    for (const b of bays) expect(b.bay.x + b.bay.w).toBeLessThanOrEqual(1280);
  });
  test('зона клика совпадает с нишей по ширине и лежит ниже зон плиток (y ≥ 626: плитки кончаются на 624)', () => {
    for (const b of bays) {
      const z = zone(b.z);
      expect(z.x).toBe(b.bay.x);
      expect(z.w).toBe(b.bay.w);
      expect(z.y).toBeGreaterThanOrEqual(626);
      expect(z.y + z.h).toBe(720);
    }
  });
  test('фасад тумбы: дверцы counter-front стоят точно в нишах блоков (x и ширина), кромка столешницы во всю ширину кадра', () => {
    const front = FRONT;
    const nose = NOSE;
    for (const b of bays) expect(front).toContain(`<rect x="${b.bay.x}" y="630" width="${b.bay.w}"`);
    expect(nose).toMatch(/<rect x="-6" y="607" width="1292"/);
  });
});
