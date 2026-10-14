import { describe, expect, test } from 'vitest';
import {
  DRINKS, SHOTS_BY_SIZE, SIZE_ML, SIZES, cupScale, drinkById, drinkCost, foamTarget, legacyRecipe, partsVolume, recipeCost, recipeNumbers, recipeOf, scoreSteps, shotsOf,
  steamZoneOf, buildTasks, stepLabels, taskTarget, FORCED_SYRUP_IDS, FORCED_SYRUP, ENGINE
} from '../src/game/api';
import type { Size } from '../src/game/types';

const d = (id: string) => drinkById[id] as (typeof DRINKS)[number];
const sizesOf = (id: string) => Object.keys(d(id).sizes) as Size[];

describe('шоты по размеру', () => {
  test('таблица 1/1/2/2', () => {
    expect(SIZES.map((s) => SHOTS_BY_SIZE[s])).toEqual([1, 1, 2, 2]);
  });
  test('эспрессо один шот, двойной два, флэт уайт всегда два', () => {
    expect(shotsOf(d('espresso'), '0.2')).toBe(1);
    expect(shotsOf(d('espresso_double'), '0.2')).toBe(2);
    for (const s of sizesOf('flat_white')) expect(shotsOf(d('flat_white'), s)).toBe(2);
    expect(sizesOf('flat_white')).toEqual(['0.2']);
  });
  test('напитки с шотами по размеру берут их из таблицы', () => {
    for (const id of ['americano', 'cappuccino', 'latte', 'raf', 'espresso_tonic', 'aerocano', 'latte_sakura']) for (const s of sizesOf(id)) expect(shotsOf(d(id), s), `${id} ${s}`).toBe(SHOTS_BY_SIZE[s]);
  });
  test('бамблы и фраппе — два шота на любом размере, матча и цикорий без шотов', () => {
    for (const id of ['orange_bumble', 'pomegranate_bumble', 'hot_bumble', 'frappe_caramel']) for (const s of sizesOf(id)) expect(shotsOf(d(id), s)).toBe(2);
    for (const id of ['matcha_latte', 'cocoa', 'chicory_latte', 'tea_sencha', 'protein_milk']) expect(shotsOf(d(id), sizesOf(id)[0] as Size)).toBe(0);
  });
});

describe('объёмы по формулам', () => {
  const nums = (id: string, f: (r: ReturnType<typeof recipeNumbers>) => number | undefined, cold = false) =>
    SIZES.map((s) => (d(id).sizes[s] !== undefined || id === 'americano' ? f(recipeNumbers(d(id), s, cold)) : undefined));
  test('американо: вода = V − 30·S', () => {
    expect(SIZES.map((s) => recipeNumbers(d('americano'), s).water)).toEqual([170, 270, 340, 540]);
  });
  test('капучино, латте, флэт уайт, раф: молоко до вспенивания', () => {
    expect(SIZES.map((s) => recipeNumbers(d('cappuccino'), s).milk)).toEqual([113, 180, 227, 360]);
    expect(SIZES.map((s) => recipeNumbers(d('latte'), s).milk)).toEqual([142, 225, 283, 450]);
    expect(recipeNumbers(d('flat_white'), '0.2').milk).toBe(127);
    expect(SIZES.map((s) => recipeNumbers(d('raf'), s).milk)).toEqual([131, 208, 262, 415]);
  });
  test('капучино 0,2 л: пены больше и жидкого молока меньше, чем у латте 0,2 л', () => {
    const c = recipeNumbers(d('cappuccino'), '0.2');
    const l = recipeNumbers(d('latte'), '0.2');
    expect((c.milk as number)).toBeLessThan(l.milk as number);
    expect((c.milk as number) * (c.foamX as number)).toBeGreaterThan((l.milk as number) * (l.foamX as number));
    expect((c.foam as number)).toBeGreaterThan(l.foam as number);
  });
  test('флэт уайт крепче капучино и латте 0,2 л: два шота против одного', () => {
    expect(recipeNumbers(d('flat_white'), '0.2').shots).toBe(2);
    expect(recipeNumbers(d('cappuccino'), '0.2').shots).toBe(1);
    expect(recipeNumbers(d('latte'), '0.2').shots).toBe(1);
  });
  test('раф: без молока, эспрессо в питчер, сливки и сахар или сироп', () => {
    for (const id of ['raf', 'vanilla_raf', 'raf_halva']) {
      const r = recipeNumbers(d(id), '0.3');
      expect(r.parts.some((p) => p.label === 'Молоко'), id).toBe(false);
      expect(r.parts.some((p) => /Сливки/.test(p.label)), id).toBe(true);
      expect(legacyRecipe(ENGINE[id] as string, '0.3').pitcherShot, id).toBe(true);
      expect(d(id).ing.includes('молоко'), id).toBe(false);
      expect(buildTasks(ENGINE[id] as string, { cold: false, syrup: id !== 'raf', shots: 1 })).toEqual(id === 'raf' ? ['grind', 'tamp', 'shot', 'milk', 'steam', 'pour'] : ['grind', 'tamp', 'shot', 'milk', 'syrup', 'steam', 'pour']);
    }
    expect(recipeNumbers(d('raf'), '0.2').parts.some((p) => p.label === 'Сахар')).toBe(true);
    expect(recipeNumbers(d('vanilla_raf'), '0.2').parts.some((p) => p.label === 'Сахар')).toBe(false);
  });
  test('раф получает подпись «Сливки» вместо «Молоко»', () => {
    expect(stepLabels(['grind', 'tamp', 'shot', 'milk', 'steam', 'pour'], 'raf')[3]).toBe('Сливки');
    expect(stepLabels(['grind', 'tamp', 'shot', 'milk', 'steam', 'pour'], 'latte')[3]).toBe('Молоко');
  });
  test('матча латте и порошки по размеру', () => {
    expect(SIZES.map((s) => recipeNumbers(d('matcha_latte'), s).matcha)).toEqual([{ g: 2, waterMl: 50 }, { g: 3, waterMl: 60 }, { g: 4, waterMl: 70 }, { g: 4, waterMl: 70 }]);
    expect(SIZES.map((s) => recipeNumbers(d('cocoa'), s).powder)).toEqual([20, 30, 40, 60]);
    expect(SIZES.map((s) => recipeNumbers(d('chicory_latte'), s).powder)).toEqual([6, 9, 12, 18]);
    expect(recipeNumbers(d('cocoa'), '0.2').milk).toBe(Math.round(200 / 1.2));
  });
  test('холодные: жидкость 0,55 V, лёд 0,3 V; тоник и бамблы', () => {
    expect((['0.3', '0.4', '0.6'] as Size[]).map((s) => recipeNumbers(d('espresso_tonic'), s).tonic)).toEqual([135, 160, 270]);
    expect((['0.3', '0.4', '0.6'] as Size[]).map((s) => recipeNumbers(d('orange_bumble'), s).juice)).toEqual([105, 160, 270]);
    expect(recipeNumbers(d('hot_bumble'), '0.3').juice).toBe(240);
    expect((['0.3', '0.4', '0.6'] as Size[]).map((s) => recipeNumbers(d('orange_bumble'), s).ice)).toEqual([90, 120, 180]);
    expect(recipeNumbers(d('matcha_tonic'), '0.3').tonic).toBe(120);
    expect(recipeNumbers(d('matcha_bumble'), '0.3').juice).toBe(120);
  });
  test('латте с пенкой: молоко = (V − 30·S − пенка) / 1,2 (сироп занимает место в стакане)', () => {
    const r = recipeNumbers(d('latte_lemon'), '0.3');
    expect(r.topFoam).toBe(40);
    expect(recipeNumbers(d('latte_lemon'), '0.6').topFoam).toBe(50);
    expect(r.pumps).toBe(3);
    expect(r.milk).toBe(Math.round((300 - 30 - 40 - 24) / 1.2));
  });
  test('бабл ти: шарики после шейкера, тапиока 60/85 г', () => {
    expect(buildTasks('boba_guava', { cold: false, syrup: true })).toEqual(['brew', 'syrup', 'ice', 'shake', 'boba']);
    expect(recipeNumbers(d('boba_guava'), '0.4').boba).toBe(60);
    expect(recipeNumbers(d('boba_guava'), '0.6').boba).toBe(85);
  });
  test('таблицы не дают undefined для числовых целей', () => {
    expect(nums('americano', (r) => r.water).filter((x) => x !== undefined).length).toBe(4);
  });
});

describe('объём: сумма компонентов = V с допуском 3%', () => {
  test('каждый напиток, каждый размер, горячий и холодный', () => {
    let n = 0;
    for (const dr of DRINKS) {
      for (const s of sizesOf(dr.id)) {
        for (const cold of dr.temp === 'both' && s !== '0.2' ? [false, true] : [false]) {
          const r = recipeNumbers(dr, s, cold);
          const sum = partsVolume(r);
          expect(Math.abs(sum - r.drinkMl) / r.drinkMl, `${dr.id} ${s}${cold ? ' холодный' : ''}: ${sum}/${r.drinkMl}`).toBeLessThanOrEqual(0.03);
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(100);
  });
  test('сироп из рецепта и список FORCED_SYRUP совпадают', () => {
    expect([...FORCED_SYRUP_IDS].sort()).toEqual(Object.keys(FORCED_SYRUP).filter((k) => k !== 'milkshake_banana').sort());
  });
});

describe('масштаб чашки', () => {
  test('(V/200)^(1/3)', () => {
    expect([200, 300, 400, 600].map((v) => +cupScale(v).toFixed(2))).toEqual([1, 1.14, 1.26, 1.44]);
    expect(+cupScale(90).toFixed(2)).toBe(0.77);
    expect(+cupScale(120).toFixed(2)).toBe(0.84);
  });
  test('растёт монотонно с объёмом', () => {
    const v = SIZES.map((s) => SIZE_ML[s]);
    for (let i = 1; i < v.length; i++) expect(cupScale(v[i] as number)).toBeGreaterThan(cupScale(v[i - 1] as number));
  });
  test('чашка у эспрессо и двойного — по их объёму, а не по размеру 0,2 л', () => {
    expect(recipeNumbers(d('espresso'), '0.2').cupMl).toBe(90);
    expect(recipeNumbers(d('espresso_double'), '0.2').cupMl).toBe(120);
    expect(legacyRecipe('espresso', '0.2').cupK).toBeCloseTo(0.77, 2);
    expect(legacyRecipe('espresso2', '0.2').cupK).toBeCloseTo(0.84, 2);
    expect(legacyRecipe('cappuccino', '0.4').cupK).toBeCloseTo(1.26, 2);
  });
});

describe('пар', () => {
  test('температурные зоны по напиткам; термометр шире на 2° вниз и 3° вверх', () => {
    expect(steamZoneOf('cappuccino')).toEqual([60, 65]);
    expect(steamZoneOf('latte')).toEqual([55, 62]);
    expect(steamZoneOf('flat_white')).toEqual([55, 60]);
    expect(steamZoneOf('raf')).toEqual([60, 65]);
    expect(steamZoneOf('latte', true)).toEqual([53, 65]);
  });
  test('цель пены = расширение · 1,1: капучино 0,55, латте 0,22, флэт уайт 0,11, раф 0,33', () => {
    expect([0.5, 0.2, 0.1, 0.3].map(foamTarget)).toEqual([0.55, 0.22, 0.11, 0.33]);
    expect(legacyRecipe('cappuccino', '0.2').foam).toBe(0.55);
    expect(legacyRecipe('flatwhite', '0.2').foam).toBe(0.11);
    expect(legacyRecipe('raf', '0.2').foam).toBe(0.33);
  });
});

describe('шаги с несколькими шотами', () => {
  test('двойной эспрессо — два цикла помол, темпер, шот; подписи «Шот 1/2»', () => {
    const t = buildTasks('espresso2', { cold: false, syrup: false });
    expect(t).toEqual(['grind', 'tamp', 'shot', 'grind', 'tamp', 'shot']);
    expect(stepLabels(t, 'espresso_double')).toEqual(['Помол 1/2', 'Темпер 1/2', 'Шот 1/2', 'Помол 2/2', 'Темпер 2/2', 'Шот 2/2']);
    expect(buildTasks('espresso', { cold: false, syrup: false })).toEqual(['grind', 'tamp', 'shot']);
  });
  test('капучино 0,4 л: два шота перед молоком; американо 0,6 л: два шота, потом вода', () => {
    expect(buildTasks('cappuccino', { cold: false, syrup: false, shots: 2 })).toEqual(['grind', 'tamp', 'shot', 'grind', 'tamp', 'shot', 'milk', 'steam', 'pour']);
    expect(buildTasks('americano', { cold: false, syrup: false, shots: 2 }).slice(-1)).toEqual(['water']);
  });
  test('оценка двойного: оба цикла учитываются', () => {
    const t = ['grind', 'tamp', 'shot', 'grind', 'tamp', 'shot'];
    const good = { grind: 1, tamp: 1, shot: 1 };
    const bad = { grind: 0, tamp: 0, shot: 0 };
    expect(scoreSteps(t, good, [good])).toBeCloseTo(1, 5);
    expect(scoreSteps(t, bad, [good])).toBeCloseTo(0.5, 5);
    expect(scoreSteps(t, good, [bad])).toBeCloseTo(0.5, 5);
  });
  test('цели налива берутся из той же формулы', () => {
    expect(taskTarget('tea_sencha', 'ice', '0.4', true)).toBe(recipeNumbers(d('tea_sencha'), '0.4', true).ice);
    expect(taskTarget('espresso_tonic', 'tonic', '0.6')).toBe(270);
    expect(taskTarget('cocoa', 'powder', '0.2')).toBe(20);
    expect(taskTarget('cappuccino_pumpkin', 'topping', '0.3')).toBe(0.5);
  });
});

describe('себестоимость по объёмам', () => {
  test('шот умножается на число шотов, молоко растёт с размером', () => {
    const one = recipeCost(recipeNumbers(d('americano'), '0.3'));
    const two = recipeCost(recipeNumbers(d('americano'), '0.4'));
    expect(two).toBeGreaterThan(one + 15);
    expect(drinkCost('espresso2', false)).toBeGreaterThan(drinkCost('espresso', false));
    expect(drinkCost('latte', false, { size: '0.6' })).toBeGreaterThan(drinkCost('latte', false, { size: '0.2' }));
    expect(drinkCost('americano', true, { size: '0.4' }) - drinkCost('americano', false, { size: '0.4' })).toBe(12);
  });
  test('у каждой позиции себестоимость положительна и меньше цены', () => {
    for (const dr of DRINKS) for (const s of sizesOf(dr.id)) {
      const c = recipeCost(recipeOf(dr.id, s, false) as ReturnType<typeof recipeNumbers>);
      expect(c, `${dr.id} ${s}`).toBeGreaterThan(0);
      expect(c, `${dr.id} ${s}`).toBeLessThan(dr.sizes[s] as number);
    }
  });
});
