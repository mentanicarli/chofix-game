import { describe, expect, test } from 'vitest';
import { EQ_IMPL, TUTORIALS, coachSteps, exampleDrink, purchaseToast, readSave, restore, tutorialEqs, tutorialEqsOfDrink } from '../src/game/api';

describe('подсказки новых станций', () => {
  test('у каждого работающего оборудования есть 1–2 шага', () => {
    for (const e of EQ_IMPL) {
      const t = TUTORIALS[e];
      expect(t, e).toBeDefined();
      expect(t?.steps.length).toBeGreaterThanOrEqual(1);
      expect(t?.steps.length).toBeLessThanOrEqual(2);
    }
  });
  test('шаги бара ведут к своему оборудованию', () => {
    expect(tutorialEqs('whisk')).toEqual(['matcha']);
    expect(tutorialEqs('whip')).toEqual(['whipper']);
    expect(tutorialEqs('tonic')).toEqual(['juice']);
    expect(tutorialEqs('grind')).toEqual([]);
    expect(tutorialEqs('food', { case: 'pastry', heat: true })).toEqual(['case_pastry', 'microwave']);
    expect(tutorialEqs('food', null)).toEqual([]);
  });
  test('тост при покупке называет станцию и напиток', () => {
    expect(purchaseToast('matcha')).toMatch(/^Новое: .+\. Попробуйте на заказе: .+/);
    expect(purchaseToast('case_snacks')).toContain('с едой');
    expect(purchaseToast('нет такого')).toBeNull();
    expect(exampleDrink('shaker')).not.toBeNull();
  });
  test('коуч по шагам нумерует их, у напитка без станций подсказки нет', () => {
    expect(coachSteps('matcha')).toMatch(/^1\. .+<br>2\. /);
    expect(tutorialEqsOfDrink('espresso_double')).toEqual([]);
  });
  test('tutorialSeen читается из сохранения, в старом его нет', () => {
    const r = readSave('{"day":3,"money":1,"tutorialSeen":["matcha",7,"tea"]}');
    if (r.kind !== 'ok') throw new Error('ожидалось ok');
    expect(r.data.tutorialSeen).toEqual(['matcha', 'tea']);
    expect(restore(r.data).tutorialSeen).toEqual(['matcha', 'tea']);
    const old = readSave('{"day":3,"money":1}');
    if (old.kind === 'ok') expect(restore(old.data).tutorialSeen).toEqual([]);
  });
});
