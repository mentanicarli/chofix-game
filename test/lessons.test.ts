import { describe, expect, test } from 'vitest';
import {
  DRINKS, FOAM_KINDS, SEEN_MARK, STEAM, airTime, recipeCard, drinkSeenKey, foamLine, freshSeen, lesson, lessonGoal, lessonKeysOfDrink, lessonStep, legacyRecipe, migrateSeen,
  newDrinkCard, nextTutorial, purchaseToast, recipeLines, steamKind, steamSeconds, stepKeysOf, tutorialKeys
} from '../src/game/api';

describe('карточка «Новый напиток»', () => {
  test('первый заказ: рецепт тот же, что в книге; повторно карточки нет', () => {
    const c = newDrinkCard('latte', freshSeen());
    expect(c?.name).toBe('Латте');
    // шаги карточки — те же, что в книге (recipeCard), с количествами
    expect(c?.steps).toEqual(recipeCard('latte', '0.2')?.steps.map((x) => (x.detail ? `${x.label}: ${x.detail}` : x.label)));
    expect(recipeLines('latte').length).toBeGreaterThan(3);
    expect(c?.steps.length).toBeGreaterThan(3);
    expect(c?.tip).toMatch(/лёгкая пена/);
    expect(newDrinkCard('latte', [...freshSeen(), drinkSeenKey('latte')])).toBeNull();
  });
  test('цель пены из бара подменяет значение меню (латте в баре 28 %)', () => {
    expect(newDrinkCard('latte', freshSeen(), 0.28)?.tip).toContain('28%');
    expect(newDrinkCard('latte', freshSeen())?.tip).toContain('22%');
  });
  test('у напитка без пара нет совета про пену; неизвестный напиток — null', () => {
    expect(newDrinkCard('americano', freshSeen())?.tip).toBe('');
    expect(newDrinkCard('нет такого', freshSeen())).toBeNull();
  });
  test('каждый напиток меню получает карточку со всеми шагами', () => {
    for (const d of DRINKS) expect(newDrinkCard(d.id, [])?.steps.length, d.id).toBe(recipeCard(d.id, Object.keys(d.sizes)[0] as '0.2')?.tasks.length);
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
      // подсказка книги и бара получает цель пены из рецепта (у рафа 33% при виде «лёгкая»)
      expect(lesson(`step:steam:${steamKind(d.id)}`, { drinkId: d.id, foam })?.goals?.[0], d.id).toContain(`${Math.round(foam * 100)}%`);
    }
  });
});

describe('шаги подсказок', () => {
  test('каждая реплика обучения ≤ 120 символов, у пошаговых есть цель на каждый шаг (этап 12.2)', () => {
    const ctx = { drinkId: 'latte', ml: 150, foam: 0.22, steam: true, pumps: 2, syrupName: 'Ваниль', cream: false, shots: 2, drinkName: 'Латте' };
    const keys = ['step:milk', 'step:steam:thick', 'step:steam:thin', 'step:steam:micro', 'step:shots', 'step:pitcher', 'step:pour', 'step:syrup'];
    for (const k of keys) for (const cream of [false, true]) {
      const l = lesson(k, { ...ctx, cream });
      expect(l, k).not.toBeNull();
      l?.steps.forEach((t, i) => expect(t.length, k + ' шаг ' + i).toBeLessThanOrEqual(120));
      expect(l?.goals?.length, k).toBe(l?.steps.length);
      l?.goals?.forEach((g) => expect(g.length, g).toBeLessThanOrEqual(45));
    }
  });
  test('lessonGoal берёт цель по номеру шага и не выходит за список', () => {
    expect(lessonGoal('step:milk', { drinkId: 'latte', ml: 150 }, 0)).toBe('Молоко до линии: 150 мл');
    expect(lessonGoal('step:milk', { drinkId: 'latte', ml: 150 }, 9)).toContain('Лишнее');
    expect(lessonGoal('step:nothing', { drinkId: 'latte' }, 0)).toBeNull();
  });
  test('пар: три шага и числа из станции', () => {
    const l = lesson('step:steam:thick', { drinkId: 'cappuccino', drinkName: 'Капучино', foam: 0.55 });
    expect(l?.steps).toHaveLength(3);
    expect(l?.goals?.[0]).toContain('Пена около 55%');
    expect(l?.steps[0]).toContain(`${STEAM.airUntil}°`);
    expect(l?.steps[2]).toContain('60–65°');
    expect(l?.steps[2]).toContain(`${STEAM.burnAt}°`);
    expect(lesson('step:steam:thin', { drinkId: 'latte', thermo: true })?.steps[2]).toContain('53–65°');
    expect(steamSeconds('latte')).toEqual([7, 8]);
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
    expect(stepKeysOf('grind', 'latte', 2)).toEqual(['step:shots']);
    expect(stepKeysOf('shot', 'raf')).toEqual(['step:pitcher']);
    expect(stepKeysOf('shot', 'latte')).toEqual([]);
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
      for (const task of ['milk', 'steam', 'pour', 'syrup', 'whisk', 'brew', 'ice', 'blend', 'shake', 'foam', 'whip', 'grind', 'shot'])
        for (const k of tutorialKeys(task, d.id, null, 2)) expect(lesson(k, { drinkId: d.id }), `${d.id} ${k}`).not.toBeNull();
  });
  test('подсказки книги для молочного напитка', () => {
    expect(lessonKeysOfDrink('latte')).toEqual(['step:shots', 'step:milk', 'step:steam:thin', 'step:pour']);
    expect(lessonKeysOfDrink('raf')).toEqual(['step:pitcher', 'step:shots', 'step:milk', 'step:steam:thin', 'step:pour']);
    expect(lessonKeysOfDrink('americano')).toEqual(['step:shots']);
    expect(lessonKeysOfDrink('espresso')).toEqual([]);
    expect(lessonKeysOfDrink('espresso_double')).toEqual(['step:shots']);
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
