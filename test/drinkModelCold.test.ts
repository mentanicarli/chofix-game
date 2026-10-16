import { describe, expect, test } from 'vitest';
import { COLD_MODEL_GROUPS, allSpecs, compactGlassDelta, pilotRef, specOf, type DrinkSpec } from '../src/game/drinkModel';
import { drinkIconSvg, drinkParts } from '../src/render/world/drinkModel';

/** Н2-2: холодные группы C1–C3 (24 вида). */
const COLD_GROUPS: Record<string, string[]> = {
  C1: ['americano', 'tea_sencha', 'tea_assam', 'tea_hibiscus', 'tea_currant'],
  C2: ['cappuccino', 'latte', 'vanilla_raf', 'cocoa', 'raf', 'matcha_latte', 'chicory_latte', 'latte_sakura', 'latte_banana', 'latte_lemon', 'latte_coconut', 'matcha_coconut', 'cappuccino_pumpkin', 'raf_halva'],
  C3: ['pomegranate_bumble', 'orange_bumble', 'espresso_tonic', 'matcha_bumble', 'matcha_tonic']
};
const ALL_IDS = Object.values(COLD_GROUPS).flat();
const cold = (id: string): DrinkSpec[] => allSpecs().filter((x) => x.id === id && x.cold);

describe('Н2-2: холодные C1–C3 (24 вида)', () => {
  test('посуда стекло, слои с суммой 1, лёд по размеру (3 × 3 до 0,4 л, 4 × 3 с 0,6 л), размеры только допустимые', () => {
    expect([...COLD_MODEL_GROUPS].sort()).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);
    let n = 0;
    for (const [g, ids] of Object.entries(COLD_GROUPS)) {
      for (const id of ids) {
        n++;
        const list = cold(id);
        expect(list.length, id).toBeGreaterThan(0);
        for (const sp of list) {
          expect(sp.group, id).toBe(g);
          expect(Number(sp.size), id).toBeGreaterThanOrEqual(0.3);
          expect(sp.vessel.material, id).toBe('glass');
          expect(sp.liquid.reduce((a, l) => a + l.frac, 0), id).toBeCloseTo(1, 5);
          expect(sp.ice, id).toEqual({ rows: sp.size === '0.6' ? 4 : 3, cols: 3 });
          expect(pilotRef(id, sp.size, true), id).toEqual({ id, size: sp.size, cold: true });
        }
      }
    }
    expect(n).toBe(24);
  });
  test('верх и детали: таро у четырёх, крем-брюле у банана, крапинки у тыквы, мутный тон у смородины, пузырьки у тоников, языки у C3', () => {
    for (const id of ['latte_sakura', 'latte_lemon', 'latte_coconut', 'matcha_coconut']) {
      const sp = cold(id)[0] as DrinkSpec;
      expect(sp.top.color, id).toBe('#B9A3D4');
      expect(sp.detail, id).toBe('taro_cap');
    }
    expect((cold('latte_banana')[0] as DrinkSpec).top.color).toBe('#E9D29A');
    const pump = cold('cappuccino_pumpkin')[0] as DrinkSpec;
    expect(pump.top.specks).toBe('#7A4A38');
    expect(pump.detail).toBe('spice_specks');
    expect((cold('tea_currant')[0] as DrinkSpec).liquid.some((l) => l.tone === 'cloudy')).toBe(true);
    for (const id of ['espresso_tonic', 'matcha_tonic']) expect((cold(id)[0] as DrinkSpec).detail, id).toBe('tonic_bubbles');
    for (const id of COLD_GROUPS.C3 as string[]) {
      const sp = cold(id)[0] as DrinkSpec;
      expect(sp.liquid.length, id).toBe(2);
      expect(sp.liquid[1]?.edge, id).toBe('wavy');
    }
  });
  test('детали попадают в разметку: пузырьки, вуаль, крапинки (поверхность, толща, лёд), компактный без кубиков', () => {
    const f = (id: string, level: 'full' | 'compact' = 'full') => drinkParts(cold(id).slice(-2)[0] as DrinkSpec, { level, s: 1, saucer: true });
    expect(f('espresso_tonic').liquid).toContain('fill-opacity="0.45"');
    expect(f('espresso_tonic', 'compact').liquid).toContain('fill-opacity="0.85"');
    expect(f('tea_currant').liquid).toContain('fill-opacity="0.2"');
    expect(f('cappuccino_pumpkin').liquid.match(/#7A4A38/g)?.length).toBeGreaterThan(8);
    expect(f('cappuccino_pumpkin').ice).toContain('#7A4A38');
    expect(f('cappuccino_pumpkin', 'compact').liquid.match(/#7A4A38/g)?.length).toBeGreaterThanOrEqual(4);
    expect(f('latte', 'compact').ice).not.toContain('rotate(');
    for (const id of ALL_IDS) for (const level of ['full', 'compact'] as const) {
      const p = f(id, level);
      expect(p.back.length, id).toBeGreaterThan(50);
      expect(p.liquid.length, id).toBeGreaterThan(20);
      expect(p.ice.length, id).toBeGreaterThan(20);
    }
  });
  test('иконки билета (49 × 42) и пузыря (38 × 41) рисуются для всех размеров', () => {
    for (const id of ALL_IDS) for (const sp of cold(id)) {
      expect(drinkIconSvg(sp, 49, 42).svg, id).toContain('<svg');
      expect(drinkIconSvg(sp, 38, 41).svg, id).toContain('<svg');
    }
  });
  /* Различимость в компактном уровне: стопки цвета сравниваются срезами снизу вверх (compactGlassDelta, ΔE76).
     Пороги подобраны по расчёту (самая близкая из проверяемых пар — см. docs/art/drinks/decisions.md, п. 12). */
  const CONFUSABLE: string[][] = [
    ['tea_sencha', 'tea_assam', 'tea_hibiscus', 'tea_currant', 'americano'],
    ['latte_sakura', 'latte_lemon', 'latte_coconut', 'matcha_coconut', 'latte_banana'],
    ['raf', 'vanilla_raf', 'raf_halva'],
    ['cocoa', 'americano', 'chicory_latte'],
    ['cappuccino', 'latte', 'cappuccino_pumpkin']
  ];
  const MIN_MAX_DE = 12;
  const MIN_MEAN_DE = 3;
  test(`пары, которые легко спутать: наибольшее ΔE76 среди срезов не меньше ${MIN_MAX_DE}, среднее не меньше ${MIN_MEAN_DE}`, () => {
    for (const grp of CONFUSABLE) {
      for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) {
        const a = cold(grp[i] as string).slice(-2)[0] as DrinkSpec;
        const b = cold(grp[j] as string).slice(-2)[0] as DrinkSpec;
        const d = compactGlassDelta(a, b);
        expect(d.max, `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(MIN_MAX_DE);
        expect(d.mean, `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(MIN_MEAN_DE);
      }
    }
  });
  test('compactGlassDelta: одинаковые стопки дают 0, функция симметрична', () => {
    const a = cold('latte')[0] as DrinkSpec;
    const b = cold('cocoa')[0] as DrinkSpec;
    expect(compactGlassDelta(a, a)).toEqual({ max: 0, mean: 0 });
    expect(compactGlassDelta(a, b).max).toBeCloseTo(compactGlassDelta(b, a).max, 9);
    expect(specOf('latte', '0.3', true).group).toBe('C2');
  });
});
