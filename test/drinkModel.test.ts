import { describe, expect, test } from 'vitest';
import { DRINKS } from '../src/game/menu';
import {
  COMPACT_MAX_BANDS, DEMITAS_K, ICE_COLS, ICE_FOUR_ROWS_FROM_K, ICE_ROT_MAX, PILOT_IDS, HOT_MODEL_IDS, COMPACT_BASE_FRAC, compactLayers, compactTopDelta, deltaE, MODEL_TAGS, pilotRef, GLASS_HOT, HEIGHT_CAP, LOD_FULL_MIN_PX, LOD_COMPACT_MIN_PX, allSpecs, compactIce, groupOf, iceCount, iceGridFor, layersFor, lodFor, mixColor,
  sizesOf, specOf, variantsOf, vesselDims, vesselOf, type DrinkSpec, type Layer, type ModelGroup, type TopSpec
} from '../src/game/drinkModel';
import { drinkIconSvg, drinkParts, geomOf } from '../src/render/world/drinkModel';
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
  test('лёд v3: у горячих и блендерных нет, у остальных холодных 9–12 кубиков (3 или 4 ряда по 3)', () => {
    for (const s of specs) {
      const n = iceCount(s.ice);
      if (!s.cold || s.group === 'C5') expect(n, `${s.id} ${s.size} ${s.cold}`).toBe(0);
      else {
        expect(n, `${s.id} ${s.size}`).toBeGreaterThanOrEqual(9);
        expect(n, `${s.id} ${s.size}`).toBeLessThanOrEqual(12);
        expect([3, 4]).toContain(s.ice.rows);
        expect(s.ice.cols).toBe(ICE_COLS);
      }
    }
  });
  test('лёд v3: ряды по cupScale — 0,3 л 3 × 3, 0,6 л 4 × 3', () => {
    expect(ICE_COLS).toBe(3);
    expect(ICE_ROT_MAX).toBe(25);
    expect(ICE_FOUR_ROWS_FROM_K).toBeGreaterThan(cupScale(400));
    expect(ICE_FOUR_ROWS_FROM_K).toBeLessThan(cupScale(600));
    expect(specOf('orange_bumble', '0.3', true).ice).toEqual({ rows: 3, cols: 3 });
    expect(specOf('orange_bumble', '0.4', true).ice).toEqual({ rows: 3, cols: 3 });
    expect(specOf('orange_bumble', '0.6', true).ice).toEqual({ rows: 4, cols: 3 });
    expect(iceGridFor('C2', specOf('latte', '0.3', true).vessel)).toEqual(specOf('latte', '0.3', true).ice);
    expect(iceGridFor('H3', specOf('cappuccino', '0.2', false).vessel)).toEqual({ rows: 0, cols: 0 });
    expect(iceGridFor('C5', specOf('milkshake_vanilla', '0.4', true).vessel)).toEqual({ rows: 0, cols: 0 });
  });
  test('пилот: латте, капучино, бамбл; ссылка только для существующих размеров и вариантов', () => {
    expect([...PILOT_IDS].sort()).toEqual(['cappuccino', 'latte', 'orange_bumble']);
    expect(pilotRef('latte', '0.2', false)).toEqual({ id: 'latte', size: '0.2', cold: false });
    expect(pilotRef('cappuccino', '0.3', true)).toEqual({ id: 'cappuccino', size: '0.3', cold: true });
    expect(pilotRef('latte', '0.2', true)).toBeNull();
    expect(pilotRef('orange_bumble', '0.3', false)).toEqual({ id: 'orange_bumble', size: '0.3', cold: true });
    expect(pilotRef('orange_bumble', '0.2', true)).toBeNull();
    expect(pilotRef('milkshake_vanilla', '0.4', true)).toEqual({ id: 'milkshake_vanilla', size: '0.4', cold: true }); /* Н2-3 */
    expect(pilotRef('tea_sencha', '0.4', true)).toEqual({ id: 'tea_sencha', size: '0.4', cold: true }); /* Н2-2 */
    expect(pilotRef('tea_sencha', '0.2', true)).toBeNull();
    expect(pilotRef('aerocano', '0.3', true)).toEqual({ id: 'aerocano', size: '0.3', cold: true });
    expect(pilotRef('boba_guava', '0.4', true)).toEqual({ id: 'boba_guava', size: '0.4', cold: true });
    expect(pilotRef('tea_sencha', '0.4', false)).toEqual({ id: 'tea_sencha', size: '0.4', cold: false });
  });
  test('Н2-1: 24 горячих вида на модели (H1–H8), по группам таблицы', () => {
    expect(HOT_MODEL_IDS.size).toBe(24);
    const grp: Record<string, string[]> = {
      H1: ['espresso', 'espresso_double'], H2: ['americano', 'hot_bumble'], H3: ['cappuccino', 'cappuccino_pumpkin'], H4: ['flat_white'],
      H5: ['vanilla_raf', 'cocoa', 'raf', 'raf_halva'], H6: ['tea_sencha', 'tea_assam', 'tea_hibiscus', 'tea_buckwheat', 'tea_currant'],
      H7: ['latte', 'latte_sakura', 'latte_banana', 'latte_lemon', 'latte_coconut'], H8: ['matcha_latte', 'chicory_latte', 'matcha_coconut']
    };
    const seen = new Set<string>();
    for (const [g, ids] of Object.entries(grp)) {
      for (const id of ids) {
        seen.add(id);
        expect(HOT_MODEL_IDS.has(id), id).toBe(true);
        const hot = specs.filter((x) => x.id === id && !x.cold);
        expect(hot.length, id).toBeGreaterThan(0);
        for (const sp of hot) {
          expect(sp.group, id).toBe(g);
          expect(sp.ice, id).toEqual({ rows: 0, cols: 0 });
          expect(pilotRef(id, sp.size, false), id).toEqual({ id, size: sp.size, cold: false });
          expect(sp.vessel.material, id).toBe(g === 'H1' ? 'demitas' : g === 'H7' || g === 'H8' ? 'glass' : 'ceramic');
          expect(sp.liquid.reduce((a, l) => a + l.frac, 0)).toBeCloseTo(1, 5);
        }
      }
    }
    expect(seen.size).toBe(24);
  });
  test('Н2-1: цвета верха и детали по таблице', () => {
    const top = (id: string, size: '0.2' | '0.3' | '0.4' | '0.6' = '0.4') => specOf(id, size, false).top;
    expect(top('espresso', '0.2').ring).toBe('#C99B6E');
    expect(top('cappuccino_pumpkin').specks).toBe('#7A4A38');
    expect(specOf('cappuccino_pumpkin', '0.4', false).detail).toBe('spice_specks');
    expect(top('flat_white', '0.2').art).toBe('tulip');
    expect(top('cappuccino').art).toBe('heart');
    expect(top('tea_sencha').color.toLowerCase()).toBe('#c8b84a');
    expect(top('tea_hibiscus').color.toLowerCase()).toBe('#b4234a');
    expect(top('tea_assam').color.toLowerCase()).toBe('#a0501e');
    expect(top('tea_buckwheat', '0.2').color.toLowerCase()).toBe('#b88a3a');
    expect(specOf('tea_currant', '0.4', false).detail).toBe('cloudy');
    for (const id of ['latte_sakura', 'latte_lemon', 'latte_coconut', 'matcha_coconut']) {
      expect(top(id).color.toLowerCase(), id).toBe('#b9a3d4');
      expect(specOf(id, '0.4', false).detail, id).toBe('taro_cap');
    }
    expect(top('latte_banana').color.toLowerCase()).toBe('#e9d29a');
    expect(top('cocoa').ring?.toLowerCase()).toBe('#6b4331');
    expect(top('raf_halva').ring?.toLowerCase()).toBe('#e9d29a');
    expect(top('raf').ring).toBeUndefined();
    /* горячий бамбл: слои сок и эспрессо, сверху эспрессо (в керамике не видны), подпись «с соком» */
    const hb = specOf('hot_bumble', '0.3', false);
    expect(hb.liquid.length).toBe(2);
    expect(MODEL_TAGS.hot_bumble).toBe('с соком');
    /* американано и горячий бамбл — разные цвета верха */
    expect(top('americano').color).not.toBe(hb.top.color);
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
  test('lodFor на границах: от 56 px полный, от 28 до 56 компактный, ниже 28 tiny; мусор даёт компактный', () => {
    expect(LOD_FULL_MIN_PX).toBe(56);
    expect(LOD_COMPACT_MIN_PX).toBe(28);
    expect(lodFor(56)).toBe('full');
    expect(lodFor(55.99)).toBe('compact');
    expect(lodFor(300)).toBe('full');
    expect(lodFor(28)).toBe('compact');
    expect(lodFor(27.99)).toBe('tiny');
    expect(lodFor(0)).toBe('tiny');
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

describe('Н2-1б: различимость в компактном уровне', () => {
  const topOf = (id: string): TopSpec => (allSpecs().find((x) => x.id === id && !x.cold) as DrinkSpec).top;
  /** ΔE76 ≈ 2,3 едва заметна, до 5 пара похожа; порог 7,5 подобран по самой близкой паре (раф и флэт уайт ≈ 7,9). */
  const MIN_DELTA_E = 7.5;
  test('верх какао, рафа, ванильного рафа, халвы, капучино, тыквы и флэт уайт: попарное расстояние в Lab не меньше порога', () => {
    const ids = ['cocoa', 'raf', 'vanilla_raf', 'raf_halva', 'cappuccino', 'cappuccino_pumpkin', 'flat_white'];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(compactTopDelta(topOf(ids[i] as string), topOf(ids[j] as string)), `${ids[i]} / ${ids[j]}`).toBeGreaterThanOrEqual(MIN_DELTA_E);
      }
    }
  });
  test('какао: тёмное кольцо #6B4331 не уже 3 px в слоте 49 × 42 и тёмный центр; тыква: 3–4 крупные точки не меньше 2 px', () => {
    const cocoa = specOf('cocoa', '0.2', false);
    expect(cocoa.top.compact?.ring).toBe('#6B4331');
    expect(cocoa.top.compact?.core).toBe('#6B4331');
    const g = geomOf(cocoa.vessel);
    if (g.kind !== 'ceramic') throw new Error('не керамика');
    const icon = drinkIconSvg(cocoa, 49, 42);
    const rxPx = (g.W - 6 * g.k) * (0.88 + 0.12 * 0.92) * icon.s;
    expect((cocoa.top.compact?.ringFrac ?? 0) * rxPx).toBeGreaterThanOrEqual(3);
    const pump = specOf('cappuccino_pumpkin', '0.4', false);
    const dots = pump.top.compact?.dots;
    expect(dots?.color).toBe('#7A4A38');
    expect(dots?.n).toBeGreaterThanOrEqual(3);
    expect(dots?.n).toBeLessThanOrEqual(4);
    const pi = drinkIconSvg(pump, 49, 42);
    const radii = [...pi.svg.matchAll(/<circle [^>]*r="([\d.]+)"[^>]*fill="#7A4A38"/g)].map((m) => Number(m[1]));
    expect(radii.length).toBe(dots?.n);
    for (const r of radii) expect(r * pi.s).toBeGreaterThanOrEqual(2 - 0.01);
    expect(specOf('raf_halva', '0.4', false).top.compact).toMatchObject({ color: '#E9D29A' });
    expect(specOf('cappuccino', '0.2', false).top.compact?.ring).toBe('#C99B6E');
    expect(specOf('flat_white', '0.2', false).top.compact?.ring).toBeUndefined();
  });
  test('латте со стаканом: цветная основа в компактном уровне 18 % наполнения, сумма долей 1, основы трёх лиловых различаются', () => {
    const bases: string[] = [];
    for (const id of ['latte_sakura', 'latte_lemon', 'latte_coconut', 'latte_banana']) {
      const sp = specOf(id, '0.4', false);
      const cl = compactLayers(sp);
      expect(cl[0]?.frac, id).toBeCloseTo(COMPACT_BASE_FRAC, 6);
      expect(cl.reduce((a, l) => a + l.frac, 0), id).toBeCloseTo(1, 6);
      expect(cl.length).toBe(sp.liquid.length);
      bases.push((cl[0] as Layer).color);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(deltaE(bases[i] as string, bases[j] as string), `${i}/${j}`).toBeGreaterThanOrEqual(7.5);
    /* без основы (обычное латте) слои не меняются */
    const latte = specOf('latte', '0.4', false);
    expect(compactLayers(latte)).toEqual(latte.liquid.map((l) => ({ ...l })));
    /* полный уровень не тронут */
    expect(specOf('latte_sakura', '0.4', false).liquid[0]?.frac).toBeLessThan(0.1);
  });
  test('блюдце под стаканом в компактном уровне: контур 2 px, как у керамики', () => {
    const glassCompact = drinkParts(specOf('latte', '0.4', false), { level: 'compact', s: 1, saucer: true });
    const ceramicCompact = drinkParts(specOf('cappuccino', '0.4', false), { level: 'compact', s: 1, saucer: true });
    const outline = (back: string): string | undefined => /<ellipse[^>]*fill="#[0-9A-Fa-f]{6}" stroke="#[0-9A-Fa-f]{6}" stroke-width="([\d.]+)"/.exec(back)?.[1];
    expect(outline(glassCompact.back)).toBe('2');
    expect(outline(ceramicCompact.back)).toBe('2');
  });
});
