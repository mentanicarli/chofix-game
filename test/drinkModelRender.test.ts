import { describe, expect, test } from 'vitest';
import { allSpecs, specOf } from '../src/game/drinkModel';
import SRC from '../src/render/world/drinkModel.ts?raw';
import { BAR_UNIT, drinkIconSvg, drinkParts, drinkPx, drinkSvg, geomOf, glassHalfWidth, hashSeed, iceCubes, iceSeed, mulberry32, type GlassGeom } from '../src/render/world/drinkModel';

const glass = (id: string, size: '0.3' | '0.4' | '0.6', cold = true): { spec: ReturnType<typeof specOf>; g: GlassGeom } => {
  const spec = specOf(id, size, cold);
  const g = geomOf(spec.vessel);
  if (g.kind !== 'glass') throw new Error('не стакан');
  return { spec, g };
};

describe('лёд v3: детерминизм', () => {
  test('hashSeed и mulberry32 дают одну и ту же последовательность для одного seed', () => {
    expect(hashSeed('orange_bumble|0.3')).toBe(hashSeed('orange_bumble|0.3'));
    expect(hashSeed('orange_bumble|0.3')).not.toBe(hashSeed('orange_bumble|0.6'));
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
    const r = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  test('один seed — одна геометрия, другой размер или напиток — другая', () => {
    const { spec, g } = glass('orange_bumble', '0.3');
    expect(iceCubes(spec, g)).toEqual(iceCubes(spec, g));
    expect(drinkParts(spec, { level: 'full', s: 1 }).ice).toBe(drinkParts(spec, { level: 'full', s: 1 }).ice);
    const six = glass('orange_bumble', '0.6');
    expect(iceCubes(six.spec, six.g)).not.toEqual(iceCubes(spec, g));
    const cap = glass('cappuccino', '0.3');
    expect(iceSeed(cap.spec)).not.toBe(iceSeed(spec));
    expect(iceCubes(cap.spec, cap.g)).not.toEqual(iceCubes(spec, g));
  });
  test('в коде отрисовки нет Math.random', () => {
    expect(SRC).not.toMatch(/Math\.random\s*\(/);
  });
});

describe('лёд v3: границы', () => {
  test('число кубиков = ряды × столбцы (9 или 12), поворот ±25°, размер ±15 % от базового', () => {
    for (const [size, n] of [['0.3', 9], ['0.4', 9], ['0.6', 12]] as const) {
      const { spec, g } = glass('orange_bumble', size);
      const cubes = iceCubes(spec, g);
      expect(cubes.length, size).toBe(n);
      const sizes = cubes.map((c) => c.s);
      expect(Math.max(...sizes) / Math.min(...sizes)).toBeLessThanOrEqual(1.15 / 0.85 + 1e-9);
      for (const c of cubes) expect(Math.abs(c.rot)).toBeLessThanOrEqual(25);
    }
  });
  test('кубики внутри стакана по ширине, не ниже дна и не выше обода больше чем на размер', () => {
    for (const size of ['0.3', '0.4', '0.6'] as const) {
      for (const id of ['orange_bumble', 'cappuccino', 'latte']) {
        const { spec, g } = glass(id, size);
        for (const c of iceCubes(spec, g)) {
          const wy = glassHalfWidth(g, Math.min(c.y, g.yb));
          expect(Math.abs(c.x), `${id} ${size}`).toBeLessThanOrEqual(wy + 0.01);
          expect(c.y - c.s / 2, `${id} ${size}`).toBeGreaterThanOrEqual(-g.H - 1.2 * c.s);
          expect(c.y + c.s / 2, `${id} ${size}`).toBeLessThanOrEqual(g.yb + 0.01);
        }
      }
    }
  });
  test('верхний ряд: 1–2 кубика выступают над ободом, остальные ниже обода', () => {
    for (const size of ['0.3', '0.6'] as const) {
      const { spec, g } = glass('orange_bumble', size);
      const cubes = iceCubes(spec, g);
      const over = cubes.filter((c) => c.over);
      expect(over.length).toBeGreaterThanOrEqual(1);
      expect(over.length).toBeLessThanOrEqual(2);
      for (const c of over) expect(c.y - c.s / 2).toBeLessThan(-g.H);
      for (const c of cubes.filter((x) => !x.over)) expect(c.y).toBeGreaterThan(-g.H);
    }
  });
  test('два слоя глубины: задние и передние кубики, блики есть не у всех', () => {
    const { spec, g } = glass('orange_bumble', '0.6');
    const cubes = iceCubes(spec, g);
    expect(cubes.some((c) => c.back)).toBe(true);
    expect(cubes.some((c) => !c.back)).toBe(true);
    expect(cubes.some((c) => c.hl === null)).toBe(true);
    expect(cubes.some((c) => c.hl !== null)).toBe(true);
    const parts = drinkParts(spec, { level: 'full', s: 1 });
    /* задние без контура (рисуются первыми), у передних контур 2 px */
    expect(parts.ice).toContain('stroke-opacity=".9"');
    expect(parts.ice.indexOf('fill-opacity="0.16"')).toBeLessThan(parts.ice.indexOf('stroke-opacity=".9"'));
  });
  test('горячие и блендерные напитки без льда; компактный уровень без отдельных кубиков', () => {
    for (const s of allSpecs()) {
      const p = drinkParts(s, { level: 'full', s: 1 });
      if (!s.cold || s.group === 'C5') expect(p.ice, `${s.id} ${s.size} ${s.cold}`).not.toContain('rotate(');
      const c = drinkParts(s, { level: 'compact', s: 1 });
      expect(c.ice, `${s.id} compact`).not.toContain('rotate(');
    }
    const c = drinkParts(specOf('orange_bumble', '0.3', true), { level: 'compact', s: 1 });
    expect(c.ice).toContain('<circle');
    expect(c.ice).toContain('<rect');
  });
});

describe('потолок высоты и масштаб бара', () => {
  test('стакан и керамика: высота растёт не больше чем на 1,12 от базовой', () => {
    for (const id of ['latte', 'cappuccino']) {
      const small = geomOf(specOf(id, '0.2', false).vessel);
      const big = geomOf(specOf(id, '0.6', false).vessel);
      if (small.kind === 'demitas' || big.kind === 'demitas') throw new Error('не демитас');
      expect(big.H / small.H).toBeCloseTo(1.12, 6);
    }
  });
  test('на баре ×2,5 верх обода всех размеров не выше y 380 (основание чашки y 478)', () => {
    for (const s of allSpecs()) {
      const g = geomOf(s.vessel);
      if (g.kind === 'demitas') continue;
      const u = BAR_UNIT[s.vessel.material];
      const rim = g.kind === 'glass' ? g.ry : g.ryR;
      const top = 478 - (g.H + rim) * u;
      expect(top, `${s.id} ${s.size} ${s.cold}`).toBeGreaterThanOrEqual(380);
    }
  });
  test('0,2 л: ширина стакана на баре около 87 px, керамики около 92 px', () => {
    const g = geomOf(specOf('latte', '0.2', false).vessel);
    expect(g.kind === 'glass' ? 2 * g.Wt * BAR_UNIT.glass : 0).toBeCloseTo(86.7, 0);
    const c = geomOf(specOf('cappuccino', '0.2', false).vessel);
    expect(c.kind === 'ceramic' ? 2 * c.W * BAR_UNIT.ceramic : 0).toBeCloseTo(91.7, 0);
  });
});

describe('SVG и растр из одной геометрии', () => {
  test('drinkSvg и drinkPx дают одну и ту же разметку и рамку', () => {
    const spec = specOf('latte', '0.3', false);
    const o = { level: 'full' as const, s: 1, saucer: true };
    const a = drinkPx(spec, o);
    const d = drinkSvg(spec, o);
    expect(d.svg).toContain(a.all.inner);
    expect(d.w).toBe(a.all.box.w);
    expect(d.h).toBe(a.all.box.h);
    const sum = a.layer('back').inner + a.layer('liquid').inner + a.layer('ice').inner + a.layer('front').inner + a.layer('steam').inner;
    const strip = (x: string): string => x.split('<g transform="scale(1)">').join('').split('</g>').join('');
    expect(strip(sum)).toBe(strip(a.all.inner));
  });
  test('иконка помещается в слоты билета 49 × 42, 38 × 35 и пузыря 42 × 45 для пилотных вариантов', () => {
    for (const [id, size, cold] of [['latte', '0.3', false], ['latte', '0.6', false], ['cappuccino', '0.3', true], ['cappuccino', '0.6', false], ['orange_bumble', '0.3', true], ['orange_bumble', '0.6', true]] as const) {
      const spec = specOf(id, size, cold);
      for (const [W, H] of [[49, 42], [38, 35], [42, 45]] as const) {
        const i = drinkIconSvg(spec, W, H);
        expect(i.w, `${id} ${size} ${W}`).toBeLessThanOrEqual(W + 6);
        expect(i.h, `${id} ${size} ${H}`).toBeLessThanOrEqual(H + 6);
        expect(i.svg.startsWith('<svg')).toBe(true);
      }
    }
  });
  test('демитас: масштаб 0,62 и 0,70, чашка уже кружки 0,2 л', () => {
    const one = geomOf(specOf('espresso', '0.2', false).vessel);
    const two = geomOf(specOf('espresso_double', '0.2', false).vessel);
    expect(one.kind).toBe('demitas');
    expect(one.k).toBe(0.62);
    expect(two.k).toBe(0.7);
    const mug = geomOf(specOf('cappuccino', '0.2', false).vessel);
    const w1 = one.kind === 'demitas' ? 2 * one.W : 0;
    expect(mug.kind === 'ceramic' ? 2 * mug.W : 0).toBeGreaterThan(w1 * 1.3);
  });
  test('все 56 видов рисуются в обоих уровнях', () => {
    for (const s of allSpecs()) {
      for (const level of ['full', 'compact'] as const) {
        const p = drinkParts(s, { level, s: 1 });
        expect(p.back.length + p.front.length, s.id).toBeGreaterThan(50);
        expect(p.bbox.x1).toBeGreaterThan(p.bbox.x0);
        expect(p.bbox.y1).toBeGreaterThan(p.bbox.y0);
      }
    }
  });
});
