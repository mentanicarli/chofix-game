import { describe, expect, test } from 'vitest';
import {
  DRINKS, DRINK_NEEDS, EQUIPMENT, EQ_IMPL, FORCED_SYRUP, PANEL_TASKS, SYRUPS, SYRUP_META, TASK_NAME, TASK_ZONE, WEIGHT,
  brewOf, brewStation, buildTasks, drinkCost, fillStation, legacyRecipe, rollOrder, taskTarget, timedStation, TIMED
} from '../src/game/api';

const seq = (xs: number[]) => { let i = 0; return () => xs[i++ % xs.length] as number; };

describe('сборка шагов', () => {
  test('старые напитки собираются как раньше', () => {
    expect(buildTasks('espresso', { cold: false, syrup: false })).toEqual(['grind', 'tamp', 'shot']);
    expect(buildTasks('americano', { cold: false, syrup: true })).toEqual(['syrup', 'grind', 'tamp', 'shot', 'water']);
    expect(buildTasks('icedamericano', { cold: true, syrup: false })).toEqual(['grind', 'tamp', 'shot', 'ice', 'water']);
    expect(buildTasks('icedlatte', { cold: true, syrup: false })).toEqual(['grind', 'tamp', 'shot', 'ice', 'milk']);
    expect(buildTasks('vanillaraf', { cold: false, syrup: true })).toEqual(['syrup', 'grind', 'tamp', 'shot', 'milk', 'steam', 'pour']);
  });
  test('новые напитки по шагам меню', () => {
    expect(buildTasks('tea_sencha', { cold: false, syrup: false })).toEqual(['brew']);
    expect(buildTasks('tea_sencha', { cold: true, syrup: false })).toEqual(['brew', 'ice']);
    expect(buildTasks('matcha_latte', { cold: false, syrup: false })).toEqual(['whisk', 'milk', 'steam', 'pour']);
    expect(buildTasks('orange_bumble', { cold: false, syrup: false })).toEqual(['ice', 'juice', 'grind', 'tamp', 'shot', 'layer']);
    expect(buildTasks('aerocano', { cold: false, syrup: false })).toEqual(['ice', 'grind', 'tamp', 'shot', 'water', 'whip', 'topping']);
    expect(buildTasks('latte_sakura', { cold: false, syrup: true })).toEqual(['syrup', 'grind', 'tamp', 'shot', 'milk', 'steam', 'pour', 'foam']);
    expect(buildTasks('hot_bumble', { cold: false, syrup: false })).toEqual(['juice', 'grind', 'tamp', 'shot']);
  });
  test('каждый шаг любого напитка известен игре', () => {
    for (const d of DRINKS) {
      for (const cold of [false, true]) {
        for (const t of buildTasks(d.id, { cold, syrup: !!FORCED_SYRUP[d.id] })) {
          expect(TASK_NAME[t], `${d.id}:${t} имя`).toBeTruthy();
          expect(TASK_ZONE[t], `${d.id}:${t} зона`).toBeTruthy();
          expect(WEIGHT[t], `${d.id}:${t} вес`).toBeGreaterThan(0);
        }
      }
    }
  });
  test('оборудование под напитки есть в списке и в баре', () => {
    const ids = new Set(EQUIPMENT.map((e) => e.id));
    for (const d of DRINKS) for (const n of DRINK_NEEDS[d.id] ?? []) {
      expect(ids.has(n), `${d.id} нужен ${n}`).toBe(true);
      expect(EQ_IMPL.includes(n), `${n} не реализован`).toBe(true);
    }
  });
  test('сиропы по рецептам существуют и нарисованы', () => {
    for (const name of Object.values(FORCED_SYRUP)) {
      expect(SYRUPS.find((s) => s.name === name), name).toBeTruthy();
      expect(SYRUP_META[name], name).toBeTruthy();
    }
  });
  test('панельные шаги имеют цель или станцию', () => {
    for (const t of PANEL_TASKS) expect(TASK_ZONE[t]).toBeTruthy();
    expect(taskTarget('cocoa', 'powder')).toBe(25);
    expect(brewOf('tea_sencha')).toEqual({ temp: 80, minutes: 2 });
    expect(brewOf('boba_guava')).toEqual({ temp: 90, minutes: 3 });
    expect(legacyRecipe('milkshake_vanilla')).toMatchObject({ milk: 200, cupMilk: true, ice: 100 });
    expect(legacyRecipe('matcha_latte')).toMatchObject({ milk: 200, art: true });
  });
});

describe('новые станции', () => {
  test('долив: сок и порошок', () => {
    const j = fillStation.init({ kind: 'juice', target: 100 });
    expect(fillStation.finish(j).message?.text).toBe('Налейте больше');
    for (let i = 0; i < 100; i++) fillStation.update(j, 0.03, true);
    const r = fillStation.finish(j).result;
    expect(r?.message?.text).toMatch(/^Сока \d+ мл/);
    const p = fillStation.init({ kind: 'powder', target: 25 });
    for (let i = 0; i < 1000; i++) { fillStation.update(p, 0.01, true); if (p.ml >= 25) break; }
    expect(fillStation.finish(p).result?.score).toBeGreaterThan(0.9);
  });
  test('старые вода/молоко/лёд считаются как раньше', () => {
    const w = fillStation.init({ kind: 'water', target: 100 }); w.ml = 110;
    expect(fillStation.finish(w).result?.score).toBeCloseTo(1 - 2 / 40, 5);
    const m = fillStation.init({ kind: 'milk', target: 200 }); m.ml = 30;
    expect(fillStation.finish(m).message?.text).toBe('Налейте больше молока');
  });
  test('таймер: в цель и мимо', () => {
    for (const k of Object.keys(TIMED) as (keyof typeof TIMED)[]) {
      const s = timedStation.init({ kind: k });
      for (let i = 0; i < 1000; i++) { timedStation.update(s, 0.01, true); if (s.t >= TIMED[k].target) break; }
      expect(timedStation.finish(s).result?.score, k).toBeGreaterThan(0.9);
    }
    const s = timedStation.init({ kind: 'blend' });
    expect(timedStation.finish(s).message?.bad).toBe(true);
    for (let i = 0; i < 300; i++) timedStation.update(s, 0.05, true);
    expect(timedStation.finish(s).result?.score).toBeLessThan(0.5);
  });
  test('заварка: температура и время', () => {
    const b = brewStation.init({ temp: 80, minutes: 2 });
    expect(brewStation.start(b).message?.text).toMatch(/температуру/);
    brewStation.setTemp(b, 80); brewStation.start(b);
    for (let i = 0; i < 400; i++) { brewStation.update(b, 0.01); if (b.t >= 2) break; }
    expect(brewStation.finish(b).result?.score).toBe(1);
    const c = brewStation.init({ temp: 80, minutes: 2 });
    brewStation.setTemp(c, 95); brewStation.start(c);
    for (let i = 0; i < 50; i++) brewStation.update(c, 0.02);
    const r = brewStation.finish(c).result;
    expect(r?.score).toBeLessThan(0.5);
    expect(r?.message?.text).toMatch(/горячая.*недонастоялся/);
  });
});

describe('заказы новых напитков', () => {
  test('на высоком ранге выпадают разные напитки с нужным оборудованием', () => {
    const eq = Object.fromEntries(EQ_IMPL.map((e) => [e, true]));
    const seen = new Set<string>();
    let r = 0.01;
    for (let i = 0; i < 400; i++) {
      r = (r * 7.31 + 0.137) % 1;
      const o = rollOrder({ rank: 9, day: 30, milk: true, eq }, 'regular', seq([r, (r * 3.7) % 1, (r * 5.3) % 1, (r * 11.1) % 1, (r * 13.7) % 1, (r * 17.3) % 1]));
      seen.add(o.id);
      expect(o.base).toBeGreaterThan(0);
      expect(o.line.length).toBeGreaterThan(5);
    }
    expect(seen.size).toBeGreaterThan(20);
  });
  test('без оборудования новых напитков нет', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(rollOrder({ rank: 9, day: 5, milk: true, eq: {} }, 'regular', Math.random).id);
    for (const id of seen) expect(DRINKS.find((d) => d.id === id)?.steps.some((s) => ['whisk', 'brew', 'juice', 'blend', 'boba', 'shake', 'powder', 'ice'].includes(s.st))).toBe(false);
  });
  test('себестоимость новых напитков положительна и меньше цены', () => {
    for (const d of DRINKS) { const c = drinkCost(d.id, false); expect(c).toBeGreaterThan(0); }
  });
});

import { helperPick, helperQuality, helperPrepTime } from '../src/game/helper';
import { rentFor, helperWage } from '../src/game/economy';
test('помощник берёт только простые напитки и самого нетерпеливого', () => {
  const g = (id: number, drink: string, pat: number, extra = {}) => ({ id, drink, arrived: true, leaving: false, pat, syrup: null, food: false, ...extra });
  expect(helperPick([g(1, 'latte', 5), g(2, 'americano', 90), g(3, 'espresso', 40)], null)?.id).toBe(3);
  expect(helperPick([g(1, 'americano', 5, { syrup: 'vanilla' }), g(2, 'espresso', 9, { food: true })], null)).toBeNull();
  expect(helperPick([g(1, 'americano', 5)], 1)).toBeNull();
  expect(helperPrepTime('espresso')).toBeLessThan(helperPrepTime('icedamericano'));
});
test('качество помощника: доли и рост с рангом', () => {
  let s = 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const n = 4000, c = [0, 0, 0] as number[];
  for (let i = 0; i < n; i++) { const q = helperQuality(5, r); c[q] = (c[q] ?? 0) + 1; }
  expect((c[1] ?? 0) / n).toBeGreaterThan(0.6);
  expect(c[0] ?? 0).toBeLessThan(c[1] ?? 0);
});
test('аренда растёт с рангом, зарплата помощника тоже', () => {
  expect(rentFor('normal', 1)).toBe(140);
  expect(rentFor('normal', 9)).toBeGreaterThan(rentFor('normal', 5));
  expect(helperWage(9)).toBeGreaterThan(helperWage(5));
});
