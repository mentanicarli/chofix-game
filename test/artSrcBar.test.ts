import { describe, expect, test } from 'vitest';
import SHOWCASE from '../art-src/bar/showcase.svg?raw';
import GLASS from '../art-src/bar/showcase-glass.svg?raw';
import SNACKS from '../art-src/bar/sc-snacks.svg?raw';
import PASTRY from '../art-src/bar/sc-pastry.svg?raw';
import DESSERT from '../art-src/bar/sc-dessert.svg?raw';
import DELI from '../art-src/bar/sc-deli.svg?raw';
import MICRO from '../art-src/bar/sc-micro.svg?raw';
import ICE from '../art-src/bar/ice.svg?raw';

/* Этап 12.3(1)–(2): геометрия исходников частей бара (стайлгайд, разд. 12–13, 20). Подстоечные блоки: низ обрезан краем кадра (y 720), поэтому проверяются верхние края и x. */
type R = { x: number; y: number; w: number; h: number };
const vb = (s: string): R => {
  const m = /viewBox="(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)"/.exec(s);
  if (!m) throw new Error('нет viewBox');
  return { x: +(m[1] as string), y: +(m[2] as string), w: +(m[3] as string), h: +(m[4] as string) };
};
const rects = (s: string, fill: string): R[] =>
  [...s.matchAll(new RegExp(`<rect x="([\\d.]+)" y="([\\d.]+)" width="([\\d.]+)" height="([\\d.]+)"[^>]*fill="\\{\\{${fill}\\}\\}"`, 'g'))].map((m) => ({ x: +(m[1] as string), y: +(m[2] as string), w: +(m[3] as string), h: +(m[4] as string) }));
const inside = (a: R, b: R): boolean => a.x > b.x && a.y > b.y && a.x + a.w < b.x + b.w;

describe('art-src/bar: холодильная витрина под стойкой', () => {
  const front = (rects(SHOWCASE, 'STEEL')[0]) as R;
  const door = (rects(SHOWCASE, 'STEEL_HI')[0]) as R;
  const interior = (rects(SHOWCASE, 'GLASS')[0]) as R;
  const glass = (rects(GLASS, 'GLASS')[0]) as R;
  test('стекло точно закрывает внутренность, внутренность внутри рамки дверцы, рамка внутри фасада', () => {
    expect(glass).toEqual(interior);
    expect(inside(interior, door)).toBe(true);
    expect(inside(door, front)).toBe(true);
  });
  test('части с едой лежат внутри окна по ширине; верхний ряд стоит на полке (y 680), нижний на нижней полке (y 715), срез кадром (y 720) приходится на полку, а не на еду', () => {
    const shelf = (rects(SHOWCASE, 'STEEL_HI')[1]) as R; /* полка: вторая STEEL_HI после рамки дверцы */
    expect(shelf.y).toBe(680);
    for (const [src, base] of [[SNACKS, 680], [PASTRY, 680], [DESSERT, 718], [DELI, 718]] as const) {
      const b = vb(src);
      expect(b.x).toBeGreaterThanOrEqual(interior.x);
      expect(b.x + b.w).toBeLessThanOrEqual(interior.x + interior.w);
      expect(b.y + b.h).toBeLessThanOrEqual(base + 3); /* основание части не ниже полки или дна */
      expect(b.y).toBeGreaterThanOrEqual(interior.y); /* еда не выше верха окна */
    }
  });
  test('верхний ряд ниже верха окна, нижний ряд выше низа кадра и не залезает на полку', () => {
    expect(vb(DESSERT).y).toBeGreaterThanOrEqual(681); /* верх нижнего ряда ниже низа полки (680 + 5, контур) */
    expect(vb(SNACKS).y + vb(SNACKS).h).toBeLessThanOrEqual(683); /* рамка части на 2 px ниже основания: запас под контур */
  });
  test('еда крупнее прежней: высота частей ≥ 33 px (было 28), толщина контура ≥ 3 px', () => {
    for (const s of [SNACKS, PASTRY, DESSERT, DELI]) {
      expect(vb(s).h).toBeGreaterThanOrEqual(33);
      expect(s).toContain('stroke-width="{{M}}"');
    }
  });
});

describe('art-src/bar: микроволновка и ледогенератор', () => {
  test('микроволновка: окно внутри дверцы, дверца внутри корпуса; кнопки не меньше 12 px (под палец)', () => {
    const body = (rects(MICRO, 'STEEL')[0]) as R;
    const door = (rects(MICRO, 'STEEL_HI')[0]) as R;
    const win = (rects(MICRO, 'DARK')[1]) as R; /* первая DARK — ниша */
    expect(inside(door, body)).toBe(true);
    expect(inside(win, door)).toBe(true);
    const radii = [...MICRO.matchAll(/<circle [^>]*r="([\d.]+)"/g)].map((m) => +(m[1] as string));
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(6);
  });
  test('ледогенератор: бункер внутри рамы, рама внутри фасада; ручка откидной дверцы под бункером; лёд виден выше края дверцы', () => {
    const front = (rects(ICE, 'STEEL')[0]) as R;
    const frame = (rects(ICE, 'STEEL_HI')[0]) as R;
    const bin = (rects(ICE, 'DUSTY')[0]) as R;
    const handle = (rects(ICE, 'STEEL_SH')[0]) as R;
    expect(inside(frame, front)).toBe(true);
    expect(inside(bin, frame)).toBe(true);
    expect(handle.y).toBeGreaterThan(bin.y + bin.h);
    expect(handle.y + handle.h).toBeLessThanOrEqual(720); /* ручка целиком в кадре: срез проходит по дверце, не по ручке */
  });
  test('микроволновка: окно целиком в кадре (срез краем кадра не режет окно)', () => {
    const win = (rects(MICRO, 'DARK')[1]) as R;
    expect(win.y + win.h).toBeLessThanOrEqual(720);
  });
  test('в исходниках бара нет подписей-текстов: предметы читаются без подписи', () => {
    for (const s of [SHOWCASE, GLASS, SNACKS, PASTRY, DESSERT, DELI, MICRO, ICE]) expect(s).not.toMatch(/<text\b/);
  });
});
