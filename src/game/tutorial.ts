import { CASE_EQ, MICROWAVE } from './food';
import { DRINKS, DRINK_NEEDS, ENGINE, EQUIPMENT, drinkById } from './menu';

/** Короткие подсказки для нового оборудования: 1–2 шага простым языком. */
export interface Tutorial {
  /** где станция на баре */
  where: string;
  steps: readonly string[];
}

const SHOWCASE: Tutorial = {
  where: 'Нажмите на холодильную витрину внизу слева.',
  steps: ['Найдите на витрине блюдо, которое просил гость, и нажмите на него.', 'Если блюдо готово к выдаче, нажмите «Готово».']
};

export const TUTORIALS: Readonly<Record<string, Tutorial>> = {
  tea: {
    where: 'Нажмите на чайную станцию слева внизу.',
    steps: ['Выберите температуру воды, как в рецепте напитка (он есть в книге рецептов).', 'Нажмите «Залить водой» и «Вынуть», когда шкала дойдёт до зелёной зоны.']
  },
  matcha: {
    where: 'Нажмите на набор для матчи слева внизу.',
    steps: ['Держите «Взбивать» (или Пробел), пока шкала не дойдёт до зелёной зоны.', 'Отпустите и нажмите «Готово».']
  },
  powders: {
    where: 'Нажмите на полку порошков слева внизу.',
    steps: ['Держите «Сыпать», пока порошок не дойдёт до линии.', 'Насыпали лишнее: «Вылить» и ещё раз. Потом «Готово».']
  },
  juice: {
    where: 'Нажмите на холодильник соков справа внизу.',
    steps: ['Держите «Лить», пока уровень не дойдёт до линии.', 'Нажмите «Готово». Лишнее можно вылить.']
  },
  whipper: {
    where: 'Нажмите на сифон справа внизу.',
    steps: ['Держите «Взбивать» (или Пробел), пока шкала не дойдёт до зелёной зоны.', 'Отпустите и нажмите «Готово».']
  },
  foamer: {
    where: 'Нажмите на миксер для пенок справа внизу.',
    steps: ['Держите «Взбивать» (или Пробел), пока шкала не дойдёт до зелёной зоны.', 'Отпустите и нажмите «Готово».']
  },
  blender: {
    where: 'Нажмите на блендер справа внизу.',
    steps: ['Держите «Блендер» (или Пробел), пока шкала не дойдёт до зелёной зоны.', 'Отпустите и нажмите «Готово».']
  },
  boba: {
    where: 'Нажмите на станцию бабл ти слева внизу.',
    steps: ['Держите «Сыпать», пока шарики не дойдут до линии.', 'Нажмите «Готово». Лишнее можно вылить.']
  },
  shaker: {
    where: 'Нажмите на шейкер слева внизу.',
    steps: ['Держите «Встряхивать» (или Пробел), пока шкала не дойдёт до зелёной зоны.', 'Отпустите и нажмите «Готово».']
  },
  ice: {
    where: 'Нажмите на ледогенератор внизу, справа от витрины.',
    steps: ['Держите кнопку: лёд сыплется в чашку.', 'Остановитесь у линии на чашке.']
  },
  cream: {
    where: 'Кувшин сливок стоит рядом с молоком, у холодильника справа.',
    steps: ['В классическом рафе вместо молока холодные сливки: шаг называется «Сливки», эспрессо перед ним льётся сразу в питчер.', 'Налейте сливки до линии, добавьте сироп (если он нужен) и вспеньте всё вместе паром.']
  },
  case_snacks: SHOWCASE,
  case_pastry: SHOWCASE,
  case_dessert: SHOWCASE,
  fridge_deli: SHOWCASE,
  microwave: {
    where: 'Если гость просит разогреть, нажмите на микроволновку внизу справа.',
    steps: ['Достаньте блюдо и держите «Разогреть», пока шкала не дойдёт до зелёной зоны.', 'Отпустите и нажмите «Готово».']
  }
};

/** Оборудование под шаг бара. */
const TASK_EQ: Readonly<Record<string, string>> = {
  whisk: 'matcha', brew: 'tea', powder: 'powders', juice: 'juice', tonic: 'juice', layer: 'juice', blend: 'blender', boba: 'boba', topping: 'boba',
  shake: 'shaker', foam: 'foamer', whip: 'whipper', ice: 'ice'
};

/** Оборудование, чьи подсказки относятся к шагу. У еды: витрина заказа и, если просят разогреть, микроволновка. */
export function tutorialEqs(task: string, food?: { case: string; heat: boolean } | null): string[] {
  if (task === 'food') {
    if (!food) return [];
    const c = CASE_EQ[food.case];
    return [...(c ? [c] : []), ...(food.heat ? [MICROWAVE] : [])];
  }
  const e = TASK_EQ[task];
  return e ? [e] : [];
}

export const equipmentName = (eq: string): string => EQUIPMENT.find((e) => e.id === eq)?.name ?? eq;

/** Напиток, на котором удобно пробовать станцию (самый ранний из тех, что её требуют). */
export function exampleDrink(eq: string): string | null {
  if (eq === 'cream') return drinkById['raf']?.name ?? null;
  const d = DRINKS.filter((x) => x.id in ENGINE && (DRINK_NEEDS[x.id] ?? []).includes(eq)).sort((a, b) => a.rank - b.rank)[0];
  return d?.name ?? null;
}

/** Текст тоста при покупке. */
export function purchaseToast(eq: string): string | null {
  if (eq === 'milk') return 'Новое: молоко. Первый молочный заказ подскажет, как взбивать пену.';
  if (!(eq in TUTORIALS)) return null;
  const d = exampleDrink(eq);
  const tail = d ? `Попробуйте на заказе: ${d}` : 'Попробуйте на заказе с едой';
  return `Новое: ${equipmentName(eq)}. ${tail}`;
}

/** Текст коуча для станции: где она и что делать. */
export function coachSteps(eq: string): string {
  const t = TUTORIALS[eq];
  if (!t) return '';
  return t.steps.map((s, i) => `${i + 1}. ${s}`).join('<br>');
}

/** Оборудование, чьи подсказки нужны напитку (для кнопки «Подсказка» в книге рецептов). */
export const tutorialEqsOfDrink = (drinkId: string): string[] => (DRINK_NEEDS[drinkId] ?? []).filter((e) => e in TUTORIALS);
