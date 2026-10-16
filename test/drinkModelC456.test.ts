import { describe, expect, test } from 'vitest';
import { COLD_MODEL_GROUPS, MODEL_TAGS, allSpecs, compactGlassDelta, pilotRef, sizesOf, type DrinkSpec } from '../src/game/drinkModel';
import { drinkIconSvg, drinkParts } from '../src/render/world/drinkModel';

/** Н2-3: аэрокано (C4), густые (C5), бабл ти (C6): 8 напитков, 13 вариантов с учётом размеров. */
const IDS = ['aerocano', 'milkshake_vanilla', 'milkshake_banana', 'frappe_caramel', 'protein_milk', 'protein_water', 'boba_guava', 'boba_raspberry'];
const GROUP: Record<string, string> = { aerocano: 'C4', milkshake_vanilla: 'C5', milkshake_banana: 'C5', frappe_caramel: 'C5', protein_milk: 'C5', protein_water: 'C5', boba_guava: 'C6', boba_raspberry: 'C6' };
const MIN_SIZE: Record<string, number> = { aerocano: 0.3, milkshake_vanilla: 0.4, milkshake_banana: 0.4, frappe_caramel: 0.4, protein_milk: 0.4, protein_water: 0.4, boba_guava: 0.4, boba_raspberry: 0.4 };
const spec = (id: string): DrinkSpec[] => allSpecs().filter((x) => x.id === id && x.cold);

describe('Н2-3: C4–C6', () => {
  test('все холодные группы C1–C6 рисуются моделью, размеры по таблице (протеин только 0,4 л, шейки, фраппе, бабл ти от 0,4 л, аэрокано от 0,3 л)', () => {
    expect([...COLD_MODEL_GROUPS].sort()).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);
    for (const id of IDS) {
      const list = spec(id);
      expect(list.length, id).toBeGreaterThan(0);
      for (const sp of list) {
        expect(sp.group, id).toBe(GROUP[id]);
        expect(Number(sp.size), id).toBeGreaterThanOrEqual(MIN_SIZE[id] as number);
        expect(sp.vessel.material, id).toBe('glass');
        expect(sp.liquid.reduce((a, l) => a + l.frac, 0), id).toBeCloseTo(1, 5);
        expect(pilotRef(id, sp.size, true), id).toEqual({ id, size: sp.size, cold: true });
      }
      expect(pilotRef(id, '0.2', true), id).toBeNull();
    }
    expect(sizesOf('protein_milk', true)).toEqual(['0.4']);
    expect(sizesOf('protein_water', true)).toEqual(['0.4']);
    expect(sizesOf('aerocano', true)).toContain('0.3');
  });
  test('лёд v3 только у аэрокано и бабл ти (3 × 3 до 0,4 л, 4 × 3 с 0,6 л); у густых растёртый, не рисуется', () => {
    for (const id of IDS) for (const sp of spec(id)) {
      const iced = id === 'aerocano' || id.startsWith('boba');
      expect(sp.ice, `${id} ${sp.size}`).toEqual(iced ? { rows: sp.size === '0.6' ? 4 : 3, cols: 3 } : { rows: 0, cols: 0 });
      const p = drinkParts(sp, { level: 'full', s: 1, saucer: true });
      if (!iced) expect(p.ice, id).toBe('');
    }
  });
  test('детали: карамельные полосы у аэрокано и фраппе, шарики у бабл ти (6–10 в полном, 3–4 в компактном), шапка у ванильного милкшейка, матовость и мутный тон у протеинов', () => {
    expect(spec('aerocano')[0]?.detail).toBe('caramel_stripes');
    expect(spec('frappe_caramel')[0]?.detail).toBe('caramel_sauce');
    expect(spec('milkshake_vanilla')[0]?.detail).toBe('whip_cap');
    expect(spec('milkshake_banana')[0]?.detail).toBeNull();
    expect(spec('protein_milk')[0]?.detail).toBe('matte');
    expect(spec('protein_water')[0]?.detail).toBe('cloudy');
    for (const id of ['aerocano', 'frappe_caramel']) {
      for (const sp of spec(id)) {
        const full = drinkParts(sp, { level: 'full', s: 1, saucer: true }).liquid;
        const stripes = full.match(/stroke="#B7773F"[^>]*stroke-linecap="round"/g) ?? [];
        expect(stripes.length, id).toBeGreaterThanOrEqual(3); /* 3 полосы и зигзаг по верху */
        expect(drinkParts(sp, { level: 'compact', s: 1, saucer: true }).liquid).toContain('#B7773F');
      }
    }
    for (const id of ['boba_guava', 'boba_raspberry']) for (const sp of spec(id)) {
      const balls = (lv: 'full' | 'compact'): number => (drinkParts(sp, { level: lv, s: 1, saucer: true }).liquid.match(/fill="#3A2A24"/g) ?? []).length;
      expect(balls('full'), id).toBeGreaterThanOrEqual(6);
      expect(balls('full'), id).toBeLessThanOrEqual(10);
      expect(balls('compact'), id).toBeGreaterThanOrEqual(3);
      expect(balls('compact'), id).toBeLessThanOrEqual(4);
      /* шарики seeded: один и тот же рисунок при повторе */
      expect(drinkParts(sp, { level: 'full', s: 1, saucer: true }).liquid).toBe(drinkParts(sp, { level: 'full', s: 1, saucer: true }).liquid);
    }
    expect(drinkParts(spec('protein_milk')[0] as DrinkSpec, { level: 'full', s: 1 }).front).not.toContain('stroke="#fff"');
    expect(drinkParts(spec('milkshake_vanilla')[0] as DrinkSpec, { level: 'compact', s: 1 }).bbox.y0).toBeLessThan(drinkParts(spec('milkshake_banana')[0] as DrinkSpec, { level: 'compact', s: 1 }).bbox.y0);
  });
  test('подпись «функциональный» у бабл ти малина-лимон по механизму MODEL_TAGS; у остальных подписи нет', () => {
    expect(MODEL_TAGS.boba_raspberry).toBe('функциональный');
    expect(MODEL_TAGS.boba_guava).toBeUndefined();
    expect(spec('boba_raspberry')[0]?.tags).toContain('functional');
  });
  test('иконки билета (49 × 42) и пузыря (38 × 41) рисуются для всех размеров', () => {
    for (const id of IDS) for (const sp of spec(id)) {
      expect(drinkIconSvg(sp, 49, 42).svg, id).toContain('<svg');
      expect(drinkIconSvg(sp, 38, 41).svg, id).toContain('<svg');
    }
  });
  /* Различимость стаканов в компактном уровне (ΔE76 по срезам, см. compactGlassDelta). Пороги подобраны по расчёту: самая близкая пара — ванильный милкшейк и протеин на молоке (≈ 11,0;
     у ванильного ещё шапка над краем, которой в цветовом сравнении нет). */
  const PAIRS: string[][] = [['milkshake_vanilla', 'milkshake_banana', 'protein_milk', 'protein_water', 'frappe_caramel'], ['boba_guava', 'boba_raspberry']];
  const MIN_MAX_DE = 10.5;
  test(`пары C5 и бабл ти: наибольшее ΔE76 среди срезов не меньше ${MIN_MAX_DE}`, () => {
    for (const grp of PAIRS) for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) {
      const a = spec(grp[i] as string).slice(-1)[0] as DrinkSpec;
      const b = spec(grp[j] as string).slice(-1)[0] as DrinkSpec;
      const d = compactGlassDelta(a, b);
      expect(d.max, `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(MIN_MAX_DE);
      expect(d.mean, `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(3);
    }
  });
});
