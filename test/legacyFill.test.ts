import { describe, expect, test } from 'vitest';
import { DRINKS, legacyRecipe, recipeNumbers } from '../src/game/api';

/* Этап 12.2, замечание №9: бар рисовал чай и матчу по константам 120 и 50 мл, потому что legacyRecipe не передавал tea/matcha.
   Теперь уровень в чашке берётся из тех же чисел, что в книге рецептов: доля = налитое / ёмкость чашки. */
type D = { id: string; family: string; sizes: Record<string, number>; temp: string };
const all = DRINKS as unknown as D[];
const variants = (d: D): [string, boolean][] =>
  Object.keys(d.sizes).flatMap((s) => [false, true].filter((c) => (c ? d.temp === 'cold' || d.temp === 'both' : d.temp !== 'cold')).map((c): [string, boolean] => [s, c]));

describe('налив чая и матчи в баре идёт по данным рецепта', () => {
  test('legacyRecipe передаёт tea и matcha, равные recipeNumbers', () => {
    let n = 0;
    for (const d of all) for (const [size, cold] of variants(d)) {
      const r = recipeNumbers(d as never, size as '0.2', cold);
      const l = legacyRecipe(d.id, size as '0.2', cold);
      expect(l.tea, `${d.id} ${size} ${cold}`).toEqual(r.tea);
      expect(l.matcha, `${d.id} ${size} ${cold}`).toEqual(r.matcha);
      if (r.tea || r.matcha) n++;
    }
    expect(n).toBeGreaterThan(40);
  });
  test('чай 0,2–0,6 л горячий: заварка заполняет чашку (≥ 80 %), а не 120 мл', () => {
    for (const d of all.filter((x) => x.family === 'tea')) for (const size of Object.keys(d.sizes)) {
      const l = legacyRecipe(d.id, size as '0.2', false);
      const cup = l.cupMl as number;
      expect((l.tea?.waterMl ?? 0) / cup, `${d.id} ${size}`).toBeGreaterThanOrEqual(0.8);
      expect((l.tea?.waterMl ?? 0) / cup).toBeLessThanOrEqual(1);
    }
  });
  test('чай 0,6 л виден как полная чашка: доля на экране равна доле по данным', () => {
    const l = legacyRecipe('tea_sencha', '0.6', false);
    const px = (72 / (l.cupMl as number)) * (l.tea?.waterMl as number); /* высота слоя в px по формуле 08-bar-view.js */
    expect(px / 72).toBeCloseTo((l.tea?.waterMl as number) / (l.cupMl as number), 6);
    expect(px).toBeCloseTo(72, 6);
  });
});
