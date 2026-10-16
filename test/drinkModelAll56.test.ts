import { describe, expect, test } from 'vitest';
import { DRINKS } from '../src/game/menu';
import { HEIGHT_CAP, allSpecs, lodFor, modelRefOf, modelTopColor, pilotRef, sizesOf, specOf, tinyOf, variantsOf, type Lod } from '../src/game/drinkModel';
import { CUP_TOP_PX, cupPlan, cupUnit, type CupPlace } from '../src/render/world/cupPlan';
import { drinkIconSvg, drinkParts, geomOf, seatOf } from '../src/render/world/drinkModel';
import { MODEL_TEX_CAP, TexCache } from '../src/render/world/texCache';

/** Н2-4: итоговый проход по всем видам (напиток × размер × горячий/холодный) × уровни full / compact / tiny. */
const LEVELS: Lod[] = ['full', 'compact', 'tiny'];
const PLACES: CupPlace[] = ['barista', 'guest', 'fly'];
const specs = allSpecs();

class Fake {
  static live = 0;
  constructor() {
    Fake.live++;
  }
  destroy(): void {
    Fake.live--;
  }
}

describe('Н2-4: все виды × размеры × уровни', () => {
  test('видов 56, у каждого есть ссылка на модель (ни одного напитка по-старому)', () => {
    const kinds = new Set(specs.map((s) => `${s.id}|${s.cold}`));
    expect(kinds.size).toBe(56);
    expect(new Set(specs.map((s) => s.id)).size).toBe(DRINKS.length);
    for (const s of specs) expect(pilotRef(s.id, s.size, s.cold), `${s.id} ${s.size} ${s.cold}`).toEqual({ id: s.id, size: s.size, cold: s.cold });
  });
  test('рисуется без исключений, слои не пустые, с блюдцем и без', () => {
    let n = 0;
    for (const sp of specs) {
      for (const level of LEVELS) {
        for (const noSaucer of [false, true]) {
          const p = drinkParts(sp, { level, s: 0.5, saucer: !noSaucer, noSaucer, steamMark: true });
          const tag = `${sp.id} ${sp.size} ${sp.cold ? 'cold' : 'hot'} ${level} ${noSaucer ? 'bez' : 'sauc'}`;
          expect(p.back.length, tag).toBeGreaterThan(20);
          expect(p.liquid, tag).toMatch(/fill="#[0-9A-Fa-f]{6}"/);
          expect(p.front.length, tag).toBeGreaterThan(20);
          expect(Number.isFinite(p.bbox.x1 - p.bbox.x0) && p.bbox.x1 - p.bbox.x0 > 5, tag).toBe(true);
          n++;
        }
      }
    }
    expect(n).toBe(specs.length * 6);
  });
  test('tiny: один цвет жидкости, без льда, шариков и деталей; без блюдца в разметке нет эллипса блюдца', () => {
    for (const sp of specs) {
      const t = tinyOf(sp);
      expect(t.liquid, sp.id).toHaveLength(1);
      expect(t.liquid[0]?.frac).toBe(1);
      expect(t.ice).toEqual({ rows: 0, cols: 0 });
      expect(t.bottom).toBeNull();
      expect(t.detail).toBeNull();
      expect(t.vessel).toEqual(sp.vessel);
      const p = drinkParts(sp, { level: 'tiny', s: 1, noSaucer: true });
      expect(p.ice, sp.id).toBe('');
      expect(p.steam, sp.id).toBe('');
      expect(p.back, sp.id).not.toContain('opacity=".18"'); /* мягкая тень под блюдцем */
    }
  });
  test('высота не больше HEIGHT_CAP, у стакана и керамики обе оси растут на k, у демитаса собственный k', () => {
    for (const sp of specs) {
      const g = geomOf(sp.vessel);
      if (g.kind === 'demitas') continue;
      expect(g.ky, sp.id).toBeLessThanOrEqual(HEIGHT_CAP + 1e-9);
      expect(g.ky, sp.id).toBeCloseTo(Math.min(sp.vessel.k, HEIGHT_CAP), 9);
    }
  });
  test('зазор посадки 0 на всех видах и уровнях (в том числе tiny)', () => {
    for (const sp of specs) for (const level of LEVELS) {
      const seat = seatOf(geomOf(sp.vessel), level);
      expect(seat.yLow - seat.recess.cy, `${sp.id} ${level}`).toBeCloseTo(seat.sink, 9);
      expect(seat.saucer.rx, `${sp.id} ${level}`).toBeGreaterThanOrEqual(1.3 * seat.Wb);
    }
  });
  test('чашка в зале: уровень выбирается по высоте в px; в руке и на столе ниже 56 px, полный там не нужен', () => {
    const seen: Record<CupPlace, Set<Lod>> = { barista: new Set(), guest: new Set(), fly: new Set() };
    for (const sp of specs) for (const place of PLACES) {
      const plan = cupPlan({ id: sp.id, size: sp.size, cold: sp.cold }, place, 1);
      expect(plan.lod, `${sp.id} ${place}`).toBe(lodFor(plan.heightPx));
      expect(plan.lod, `${sp.id} ${place}`).not.toBe('full');
      expect(plan.unit).toBeCloseTo(cupUnit(place, sp.vessel.material), 9);
      seen[place].add(plan.lod);
    }
    /* крупная чашка в руке баристы читается компактным уровнем, мелкие и в полёте — tiny */
    expect(seen.barista.has('compact')).toBe(true);
    expect(seen.guest.has('tiny')).toBe(true);
    expect(seen.fly.has('tiny')).toBe(true);
    expect(CUP_TOP_PX.barista).toBe(33);
    expect(CUP_TOP_PX.fly).toBe(22);
  });
  test('ключи текстур чашек уникальны, кэш держит не больше 40 живых', () => {
    Fake.live = 0;
    const c = new TexCache<Fake>();
    const keys = new Set<string>();
    for (const sp of specs) for (const place of PLACES) for (const res of [1, 2]) keys.add(cupPlan({ id: sp.id, size: sp.size, cold: sp.cold }, place, res).key);
    expect(keys.size).toBeGreaterThan(MODEL_TEX_CAP);
    for (const k of keys) {
      c.set(k, new Fake());
      expect(Fake.live).toBeLessThanOrEqual(MODEL_TEX_CAP);
    }
    expect(c.size).toBe(MODEL_TEX_CAP);
    c.clear();
    expect(Fake.live).toBe(0);
  });
  test('иконки билета и пузыря рисуются для всех видов; заглушка modelRefOf отдаёт допустимую модель при любом мусоре', () => {
    for (const sp of specs) {
      expect(drinkIconSvg(sp, 49, 42).svg, sp.id).toContain('<svg');
      expect(drinkIconSvg(sp, 38, 41).svg, sp.id).toContain('<svg');
    }
    for (const d of DRINKS) for (const cold of [false, true]) for (const size of ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '1']) {
      const r = modelRefOf(d.id, size, cold);
      expect(() => specOf(r.id, r.size, r.cold), `${d.id} ${size} ${cold}`).not.toThrow();
      expect(sizesOf(r.id, r.cold)).toContain(r.size);
    }
    const stub = modelRefOf('нет-такого', '0.4', true);
    expect(() => specOf(stub.id, stub.size, stub.cold)).not.toThrow();
    expect(modelTopColor(stub)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(modelTopColor({ id: 'нет', size: '0.2', cold: false })).toBe('#5A3A2A');
    for (const d of DRINKS) expect(variantsOf(d).length, d.id).toBeGreaterThan(0);
  });
});
