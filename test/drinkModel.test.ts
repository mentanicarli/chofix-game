import { describe, expect, test } from 'vitest';
import { DRINKS } from '../src/game/menu';
import {
  COMPACT_MAX_BANDS, DEMITAS_K, ICE_CUBE, GLASS_HOT, HEIGHT_CAP, LOD_FULL_MIN_PX, allSpecs, compactIce, groupOf, iceCount, iceGridFor, layersFor, lodFor, mixColor,
  sizesOf, specOf, variantsOf, vesselDims, vesselOf, type ModelGroup
} from '../src/game/drinkModel';
import { cupScale } from '../src/game/volumes';

const GLASS_LATTES = ['latte', 'latte_sakura', 'latte_banana', 'latte_lemon', 'latte_coconut', 'matcha_latte', 'matcha_coconut', 'chicory_latte'];
const ALL_GROUPS: ModelGroup[] = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'];

describe('посуда по правилу владельца', () => {
  test('в меню 37 напитков и у каждого есть хотя бы один вариант с описанием', () => {
    expect(DRINKS.length).toBe(37);
    for (const d of DRINKS) {
      const n = variantsOf(d).reduce((a, cold) => a + sizesOf(d.id, cold).length, 0);
      expect(n, d.id).toBeGreaterThan(0);
    }
  });
  test('восемь горячих «латте» в стакане, эспрессо в демитасе, остальные горячие в керамике', () => {
    expect([...GLASS_HOT].sort()).toEqual([...GLASS_LATTES].sort());
    for (const d of DRINKS) {
      if (d.temp === 'cold') continue;
      const want = d.id === 'espresso' || d.id === 'espresso_double' ? 'demitas' : GLASS_LATTES.includes(d.id) ? 'glass' : 'ceramic';
      expect(vesselOf(d.id, false), d.id).toBe(want);
    }
  });
  test('какао, капучино пряная тыква и горячий бамбл в керамике', () => {
    for (const id of ['cocoa', 'cappuccino_pumpkin', 'hot_bumble']) expect(vesselOf(id, false), id).toBe('ceramic');
  });
  test('все холодные варианты в стакане', () => {
    for (const d of DRINKS) if (d.temp !== 'hot') expect(vesselOf(d.id, true), d.id).toBe('glass');
  });
  test('неизвестный напиток, неверный вариант и размер дают ошибку', () => {
    expect(() => vesselOf('nope', false)).toThrow();
    expect(() => specOf('espresso', '0.2', true)).toThrow();
    expect(() => specOf('orange_bumble', '0.2', true)).toThrow();
    expect(() => specOf('latte', '0.2', true)).toThrow();
  });
});

describe('описания всех напитков', () => {
  const specs = allSpecs();
  test('56 видов (24 горячих и 32 холодных), на каждый вид хотя бы один размер', () => {
    const looks = new Set(specs.map((s) => `${s.id}|${s.cold}`));
    expect(looks.size).toBe(56);
    expect([...looks].filter((k) => k.endsWith('false')).length).toBe(24);
    expect([...looks].filter((k) => k.endsWith('true')).length).toBe(32);
  });
  test('сумма долей слоёв равна 1 (допуск 0,001), доли положительные', () => {
    for (const s of specs) {
      const sum = s.liquid.reduce((a, l) => a + l.frac, 0);
      expect(Math.abs(sum - 1), `${s.id} ${s.size} ${s.cold}`).toBeLessThan(0.001);
      for (const l of s.liquid) expect(l.frac, `${s.id} ${s.size}`).toBeGreaterThan(0);
      expect(s.liquid[0]?.edge).toBe('sharp');
    }
  });
  test('холодные в стакане, горячие по правилу; посуда в описании совпадает с vesselOf', () => {
    for (const s of specs) {
      expect(s.vessel.material, `${s.id} ${s.cold}`).toBe(vesselOf(s.id, s.cold));
      if (s.cold) expect(s.vessel.material).toBe('glass');
    }
  });
  test('лёд: у горячих нет, у холодных 9–12 кубиков сеткой (3 ряда, 3 или 4 столбца), у блендерных нет', () => {
    for (const s of specs) {
      const n = iceCount(s.ice);
      if (!s.cold || s.group === 'C5') expect(n, `${s.id} ${s.size} ${s.cold}`).toBe(0);
      else {
        expect(n, `${s.id} ${s.size}`).toBeGreaterThanOrEqual(9);
        expect(n, `${s.id} ${s.size}`).toBeLessThanOrEqual(12);
        expect(s.ice.rows).toBe(3);
        expect([3, 4]).toContain(s.ice.cols);
      }
    }
  });
  test('лёд: число столбцов растёт с размером стакана, кубик один и тот же', () => {
    expect(ICE_CUBE).toBe(28);
    const cols = (id: string, size: '0.3' | '0.4' | '0.6'): number => specOf(id, size, true).ice.cols;
    expect(cols('orange_bumble', '0.3')).toBe(3);
    expect(cols('orange_bumble', '0.4')).toBe(4);
    expect(cols('orange_bumble', '0.6')).toBe(4);
    expect(iceCount(specOf('orange_bumble', '0.3', true).ice)).toBe(9);
    expect(iceCount(specOf('orange_bumble', '0.6', true).ice)).toBe(12);
    expect(iceGridFor('C2', specOf('latte', '0.3', true).vessel)).toEqual(specOf('latte', '0.3', true).ice);
    expect(iceGridFor('H3', specOf('cappuccino', '0.2', false).vessel)).toEqual({ rows: 0, cols: 0 });
    expect(iceGridFor('C5', specOf('milkshake_vanilla', '0.4', true).vessel)).toEqual({ rows: 0, cols: 0 });
  });
  test('цвета в формате #rrggbb', () => {
    for (const s of specs) {
      for (const l of s.liquid) expect(l.color, `${s.id}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(s.top.color, `${s.id}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
  test('ежовик: значок «функциональный» в тегах, детали нет; других тегов нет', () => {
    for (const s of specs) expect(s.tags.length > 0, s.id).toBe(s.id === 'boba_raspberry');
    expect(specOf('boba_raspberry', '0.4', true).detail).toBeNull();
    expect(specOf('boba_raspberry', '0.4', true).bottom).toBe('boba');
  });
  test('все 14 групп используются, группы соответствуют таблице', () => {
    const used = new Set(specs.map((s) => s.group));
    for (const g of ALL_GROUPS) expect(used.has(g), g).toBe(true);
    expect(specOf('hot_bumble', '0.3', false).group).toBe('H2');
    expect(specOf('americano', '0.3', true).group).toBe('C1');
    expect(specOf('cappuccino_pumpkin', '0.3', true).detail).toBe('spice_specks');
    expect(specOf('aerocano', '0.3', true).detail).toBe('caramel_stripes');
    expect(iceCount(specOf('milkshake_vanilla', '0.4', true).ice)).toBe(0);
  });
  test('таро: сиреневая пена #B9A3D4 у четырёх латте с таро', () => {
    for (const id of ['latte_sakura', 'latte_lemon', 'latte_coconut', 'matcha_coconut']) {
      const s = specOf(id, '0.4', false);
      expect(s.top.color.toUpperCase(), id).toBe('#B9A3D4');
      expect(s.detail).toBe('taro_cap');
    }
  });
});

describe('силуэт', () => {
  const specs = allSpecs();
  test('силуэт одного размера и материала не зависит от напитка', () => {
    const seen = new Map<string, { k: number; w: number; h: number }>();
    for (const s of specs) {
      const key = `${s.vessel.material}|${s.vessel.ml}`;
      const dims = vesselDims(s.vessel);
      const prev = seen.get(key);
      if (prev) {
        expect(s.vessel.k, key).toBe(prev.k);
        expect(dims.width, key).toBeCloseTo(prev.w, 6);
        expect(dims.height, key).toBeCloseTo(prev.h, 6);
      } else seen.set(key, { k: s.vessel.k, w: dims.width, h: dims.height });
    }
    expect(seen.size).toBeGreaterThan(6);
  });
  test('масштаб стакана и керамики = cupScale объёма, демитас 0,62 и 0,70, объёмы чашек 90 и 120 мл', () => {
    for (const s of specs) {
      if (s.vessel.material === 'demitas') expect(s.vessel.k).toBe(DEMITAS_K[s.id]);
      else expect(s.vessel.k).toBeCloseTo(cupScale(s.vessel.ml), 9);
    }
    expect(specOf('espresso', '0.2', false).vessel).toEqual({ material: 'demitas', ml: 90, k: 0.62 });
    expect(specOf('espresso_double', '0.2', false).vessel).toEqual({ material: 'demitas', ml: 120, k: 0.7 });
  });
  test('двойной демитас чуть больше одинарного, оба меньше кружки 0,2 л', () => {
    const one = vesselDims(specOf('espresso', '0.2', false).vessel);
    const two = vesselDims(specOf('espresso_double', '0.2', false).vessel);
    const mug = vesselDims(specOf('cappuccino', '0.2', false).vessel);
    expect(two.width).toBeGreaterThan(one.width);
    expect(two.width / one.width).toBeLessThan(1.2);
    expect(two.width).toBeLessThan(mug.width * 0.7);
  });
  test('высота обрезана потолком, ширина растёт на cupScale', () => {
    const big = vesselDims(specOf('latte', '0.6', false).vessel);
    const small = vesselDims(specOf('latte', '0.2', false).vessel);
    expect(big.width / small.width).toBeCloseTo(cupScale(600), 6);
    expect(big.height / small.height).toBeCloseTo(HEIGHT_CAP, 6);
  });
  test('стакан предложенной формы: верх 92, дно 72, высота 80 при k = 1', () => {
    const d = vesselDims(specOf('latte', '0.2', false).vessel);
    expect(d.width).toBe(92);
    expect(d.height).toBe(80);
  });
});

describe('уровни детализации', () => {
  test('lodFor на границах: 56 px и выше — полный', () => {
    expect(LOD_FULL_MIN_PX).toBe(56);
    expect(lodFor(56)).toBe('full');
    expect(lodFor(55.99)).toBe('compact');
    expect(lodFor(300)).toBe('full');
    expect(lodFor(0)).toBe('compact');
    expect(lodFor(-1)).toBe('compact');
    expect(lodFor(Number.NaN)).toBe('compact');
  });
  test('компактный уровень: не больше трёх полос, сумма долей 1, границы прямые', () => {
    for (const s of allSpecs()) {
      const c = layersFor(s, 'compact');
      expect(c.length, `${s.id} ${s.size}`).toBeLessThanOrEqual(COMPACT_MAX_BANDS);
      expect(Math.abs(c.reduce((a, l) => a + l.frac, 0) - 1), s.id).toBeLessThan(0.001);
      for (const l of c) expect(l.edge).toBe('sharp');
      expect(layersFor(s, 'full')).toEqual(s.liquid);
    }
  });
  test('лёд в компактном уровне: решётка 3–4 ряда и две блика-точки, отдельных кубиков нет; без льда ничего', () => {
    const c = compactIce(specOf('orange_bumble', '0.3', true));
    expect(c).toEqual({ rows: 4, cols: 3, dots: 2 });
    expect(compactIce(specOf('latte', '0.2', false))).toBeNull();
    expect(compactIce(specOf('milkshake_vanilla', '0.4', true))).toBeNull();
    for (const s of allSpecs()) {
      const ci = compactIce(s);
      if (ci) {
        expect(ci.rows).toBeGreaterThanOrEqual(3);
        expect(ci.rows).toBeLessThanOrEqual(4);
        expect(ci.dots).toBeGreaterThanOrEqual(2);
        expect(ci.dots).toBeLessThanOrEqual(3);
      }
    }
  });

});

describe('группы и цвета', () => {
  test('groupOf даёт ту же группу, что и описание', () => {
    for (const s of allSpecs()) expect(groupOf(DRINKS.find((d) => d.id === s.id) as (typeof DRINKS)[number], s.cold), s.id).toBe(s.group);
  });
  test('mixColor: края и середина', () => {
    expect(mixColor('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixColor('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixColor('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});
