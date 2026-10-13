import { describe, expect, test } from 'vitest';
import {
  DRINKS, FOAM_KINDS, SEEN_MARK, STEAM, airTime, drinkSeenKey, foamLine, freshSeen, lesson, lessonKeysOfDrink, lessonStep, legacyRecipe, migrateSeen,
  newDrinkCard, nextTutorial, purchaseToast, recipeLines, steamKind, steamSeconds, stepKeysOf, tutorialKeys
} from '../src/game/api';

describe('карточка «Новый напиток»', () => {
  test('первый заказ: рецепт тот же, что в книге; повторно карточки нет', () => {
    const c = newDrinkCard('latte', freshSeen());
    expect(c?.name).toBe('Латте');
    expect(c?.steps).toEqual(recipeLines('latte'));
    expect(c?.steps.length).toBeGreaterThan(3);
    expect(c?.tip).toMatch(/лёгкая пена/);
    expect(newDrinkCard('latte', [...freshSeen(), drinkSeenKey('latte')])).toBeNull();
  });
  test('цель пены из бара подменяет значение меню (латте в баре 28 %)', () => {
    expect(newDrinkCard('latte', freshSeen(), 0.28)?.tip).toContain('28%');
    expect(newDrinkCard('latte', freshSeen())?.tip).toContain('26%');
  });
  test('у напитка без пара нет совета про пену; неизвестный напиток — null', () => {
    expect(newDrinkCard('americano', freshSeen())?.tip).toBe('');
    expect(newDrinkCard('нет такого', freshSeen())).toBeNull();
  });
  test('каждый напиток меню получает карточку со всеми шагами', () => {
    for (const d of DRINKS) expect(newDrinkCard(d.id, [])?.steps.length, d.id).toBe(d.steps.length);
  });
});

describe('вид пены', () => {
  test('капучино густая, флэт уайт микро, латте лёгкая', () => {
    expect(steamKind('cappuccino')).toBe('thick');
    expect(steamKind('flat_white')).toBe('micro');
    expect(steamKind('latte')).toBe('thin');
    expect(steamKind('americano')).toBe('thin');
  });
  test('цифры берутся из параметров станции, виды различаются', () => {
    const lines = FOAM_KINDS.map((k) => foamLine(k));
    expect(new Set(lines).size).toBe(3);
    expect(foamLine('thick')).toContain('55%');
    expect(foamLine('thick')).toContain(airTime(0.55));
    expect(airTime(0.55)).toBe('около 3 с');
    expect(airTime(0.26)).toBe('около 1,5 с');
    expect(airTime(0.16)).toBe('меньше секунды');
  });
  test('цель пены в подсказке совпадает с рецептом напитка', () => {
    for (const d of DRINKS.filter((x) => x.steps.some((s) => s.st === 'steam'))) {
      const foam = legacyRecipe(d.id).foam;
      if (foam === undefined) continue;
      expect(foamLine(steamKind(d.id)), d.id).toBe(foamLine(steamKind(d.id), foam));
    }
  });
});

describe('шаги подсказок', () => {
  test('пар: три шага и числа из станции', () => {
    const l = lesson('step:steam:thick', { drinkId: 'cappuccino', drinkName: 'Капучино', foam: 0.55 });
    expect(l?.steps).toHaveLength(3);
    expect(l?.steps[0]).toContain('Капучино: густая пена');
    expect(l?.steps[0]).toContain(`${STEAM.airUntil}°`);
    expect(l?.steps[2]).toContain('55–65°');
    expect(l?.steps[2]).toContain(`${STEAM.burnAt}°`);
    expect(lesson('step:steam:thin', { drinkId: 'latte', thermo: true })?.steps[2]).toContain('53–68°');
    expect(steamSeconds()).toEqual([7, 8]);
    expect(lesson('step:steam:мусор', { drinkId: 'latte' })).toBeNull();
  });
  test('молоко: питчер или стакан, линия в миллилитрах', () => {
    expect(lesson('step:milk', { drinkId: 'latte', ml: 200 })?.steps[0]).toContain('в питчере');
    expect(lesson('step:milk', { drinkId: 'latte', ml: 200 })?.steps[0]).toContain('200 мл');
    expect(lesson('step:milk', { drinkId: 'milkshake_vanilla', steam: false })?.steps[0]).toContain('в стакане');
  });
  test('текущий шаг и подсвеченная кнопка', () => {
    expect(lessonStep('step:milk', { ml: 20, line: 200 })).toEqual({ step: 0, glow: 'fillHold' });
    expect(lessonStep('step:milk', { ml: 195, line: 200 })).toEqual({ step: 1, glow: 'fillDone' });
    expect(lessonStep('step:milk', { ml: 260, line: 200 })).toEqual({ step: 1, glow: 'fillDump' });
    expect(lessonStep('step:steam:thin', { temp: 10, foam: 0, targetFoam: 0.26 }).step).toBe(0);
    expect(lessonStep('step:steam:thin', { temp: 30, foam: 0.26, targetFoam: 0.26 }).step).toBe(1);
    expect(lessonStep('step:steam:thin', { temp: 48, foam: 0.1, targetFoam: 0.26 }).step).toBe(1);
    expect(lessonStep('step:steam:thin', { temp: 52, foam: 0.3, targetFoam: 0.26 })).toEqual({ step: 2, glow: null });
    expect(lessonStep('step:steam:thin', { temp: 58, foam: 0.3, targetFoam: 0.26 })).toEqual({ step: 2, glow: 'steamDone' });
    expect(lessonStep('step:pour', { started: true }).glow).toBe('pourDone');
    expect(lessonStep('step:syrup', { pumps: 0, wantPumps: 2 }, { syrupKey: 'vanilla' }).glow).toBe('syr:vanilla');
    expect(lessonStep('step:syrup', { pumps: 2, wantPumps: 2 }).glow).toBe('syrDone');
  });
  test('какая подсказка нужна задаче и когда она гаснет', () => {
    expect(stepKeysOf('milk', 'latte')).toEqual(['step:milk']);
    expect(stepKeysOf('steam', 'cappuccino')).toEqual(['step:steam:thick']);
    expect(stepKeysOf('grind', 'latte')).toEqual([]);
    expect(tutorialKeys('whisk', 'matcha_latte')).toEqual(['matcha']);
    const seen = freshSeen();
    expect(nextTutorial('milk', 'latte', null, seen)).toBe('step:milk');
    expect(nextTutorial('milk', 'latte', null, [...seen, 'step:milk'])).toBeNull();
    // другая пена — своя подсказка
    expect(nextTutorial('steam', 'cappuccino', null, [...seen, 'step:steam:thin'])).toBe('step:steam:thick');
    expect(nextTutorial('grind', 'latte', null, seen)).toBeNull();
  });
  test('на каждую задачу бара у каждого напитка есть текст', () => {
    for (const d of DRINKS)
      for (const task of ['milk', 'steam', 'pour', 'syrup', 'whisk', 'brew', 'ice', 'blend', 'shake', 'foam', 'whip'])
        for (const k of tutorialKeys(task, d.id)) expect(lesson(k, { drinkId: d.id }), `${d.id} ${k}`).not.toBeNull();
  });
  test('подсказки книги для молочного напитка', () => {
    expect(lessonKeysOfDrink('latte')).toEqual(['step:milk', 'step:steam:thin', 'step:pour']);
    expect(lessonKeysOfDrink('americano')).toEqual([]);
  });
  test('в текстах слово «бариста» не склоняется, обращение на «вы»', () => {
    const all: string[] = [];
    for (const k of ['step:milk', 'step:steam:thick', 'step:steam:thin', 'step:steam:micro', 'step:pour', 'step:syrup']) {
      const l = lesson(k, { drinkId: 'latte' });
      all.push(l?.where ?? '', ...(l?.steps ?? []));
    }
    for (const t of all) expect(t).not.toMatch(/баристы|баристе|баристу|баристой|\bты\b|\bтебя\b/i);
  });
});

describe('что уже показано', () => {
  test('новая игра: только метка', () => {
    expect(freshSeen()).toEqual([SEEN_MARK]);
  });
  test('старое сохранение: пройденное не повторяется, текущий ранг остаётся новым', () => {
    const m = migrateSeen(['matcha'], { rank: 3, day: 8, served: 40, milk: true });
    expect(m).toContain(SEEN_MARK);
    expect(m).toContain('matcha');
    expect(m).toContain('step:milk');
    expect(m).toContain('step:steam:thick');
    expect(m).toContain('step:syrup');
    expect(m).toContain(drinkSeenKey('espresso_double'));
    expect(m).toContain(drinkSeenKey('latte'));
    const cur = DRINKS.find((d) => d.rank === 3);
    expect(m).not.toContain(drinkSeenKey(cur?.id ?? ''));
  });
  test('старое сохранение без молока: шаги молока ещё впереди', () => {
    const m = migrateSeen([], { rank: 1, day: 2, served: 5, milk: false });
    expect(m).not.toContain('step:milk');
    expect(m).toContain(drinkSeenKey('americano'));
  });
  test('сохранение с меткой не трогаем, повторный перенос ничего не меняет', () => {
    const a = [SEEN_MARK, 'step:milk'];
    expect(migrateSeen(a, { rank: 9, day: 30, served: 900, milk: true })).toEqual(a);
    const once = migrateSeen([], { rank: 4, day: 9, served: 60, milk: true });
    expect(migrateSeen(once, { rank: 4, day: 9, served: 60, milk: true })).toEqual(once);
  });
  test('тост про молоко обещает подсказки', () => {
    expect(purchaseToast('milk')).toMatch(/^Новое: молоко\./);
  });
});
