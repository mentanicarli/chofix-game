import { describe, expect, test } from 'vitest';
import {
  DRINKS, DRINK_TEXTS, GLOSSARY, STATION_NAMES, TUTORIALS, WHY_KEYS, WHY_MARK, WHY_SECTIONS, WHY_TEXTS, drinkSeenKey, freshSeen, glossaryGroups, lesson, orderIntro, stepsForShots, whyOfInset, whyOfOrder
} from '../src/game/api';

const POSITION = /слева|справа|в центре|по центру|сверху|снизу|вверху|внизу/i;
const allTexts = (): { id: string; t: string }[] => {
  const out: { id: string; t: string }[] = [];
  // «Размеры» и «Картинка» в игре не показываются как текст подсказки; «сверху» в описании слоёв допустимо только там, где это не положение на экране
  for (const [id, d] of Object.entries(DRINK_TEXTS)) out.push({ id, t: [d.what, ...d.steps, ...d.ice, d.differs, d.sizes].join('\n') });
  for (const g of GLOSSARY) out.push({ id: 'glossary:' + g.name, t: g.name + '\n' + g.text });
  for (const [k, w] of Object.entries(WHY_TEXTS)) out.push({ id: k, t: w.title + '\n' + w.text.join('\n') });
  return out;
};

describe('тексты К1 в игре', () => {
  test('у всех 37 напитков меню есть текст, лишних нет', () => {
    expect(DRINKS).toHaveLength(37);
    for (const d of DRINKS) expect(DRINK_TEXTS[d.id], d.id).toBeTruthy();
    expect(Object.keys(DRINK_TEXTS).sort()).toEqual(DRINKS.map((d) => d.id).sort());
  });
  test('нет пустых полей, «Если со льдом» только там, где есть холодная механика', () => {
    for (const [id, d] of Object.entries(DRINK_TEXTS)) {
      for (const f of ['name', 'what', 'differs', 'sizes', 'picture'] as const) expect(d[f].trim().length, `${id}.${f}`).toBeGreaterThan(f === 'name' ? 2 : 5);
      expect(d.steps.length, id).toBeGreaterThan(1);
      d.steps.forEach((s, i) => expect(s.trim().length, `${id} шаг ${i}`).toBeGreaterThan(5));
    }
    const withIce = Object.entries(DRINK_TEXTS)
      .filter(([, d]) => d.ice.length)
      .map(([id]) => id)
      .sort();
    expect(withIce).toEqual(['americano', 'cappuccino', 'latte', 'tea_assam', 'tea_currant', 'tea_hibiscus', 'tea_sencha']);
  });
  test('справочник: термины по группам, у каждого текст', () => {
    expect(glossaryGroups().map((g) => g.group)).toEqual(['Кофе', 'Молоко и пена', 'Добавки и основа', 'Чай, матча и остальное']);
    for (const t of GLOSSARY) expect(t.text.length, t.name).toBeGreaterThan(20);
    expect(GLOSSARY.find((t) => /ристретто/i.test(t.name))).toBeUndefined();
  });
  test('23 экрана «Зачем» с заголовком и текстом; why:sections зарезервирован, но без текста', () => {
    expect(WHY_KEYS).toHaveLength(23);
    for (const w of Object.values(WHY_TEXTS)) {
      expect(w.title.length).toBeGreaterThan(5);
      expect(w.text.length).toBeGreaterThan(1);
      expect(w.text.length).toBeLessThanOrEqual(5);
    }
    expect(WHY_SECTIONS).toBe('why:sections');
    expect(WHY_KEYS).not.toContain(WHY_SECTIONS);
  });
  test('нет положений на экране и восклицательных знаков', () => {
    for (const { id, t } of allTexts()) {
      expect(t, id).not.toMatch(POSITION);
      expect(t, id).not.toContain('!');
    }
  });
  test('тексты подсказок и станций тоже без положений, «!» и цифр с единицами', () => {
    const texts: string[] = [];
    for (const [k, t] of Object.entries(TUTORIALS)) texts.push(t.where, ...t.steps, k);
    const ctx = { drinkId: 'latte', ml: 150, foam: 0.22, steam: true, pumps: 2, syrupName: 'Ваниль', shots: 2 };
    for (const k of ['step:milk', 'step:steam:thick', 'step:steam:thin', 'step:steam:micro', 'step:shots', 'step:pitcher', 'step:pour', 'step:syrup'])
      for (const cream of [false, true]) {
        const l = lesson(k, { ...ctx, cream });
        texts.push(l?.where ?? '', ...(l?.steps ?? []), ...(l?.goals ?? []));
      }
    for (const t of texts) {
      expect(t).not.toMatch(POSITION);
      expect(t).not.toContain('!');
      expect(t).not.toMatch(/\d+\s?(г|мл|°|кг)(\s|[.,:;)]|$)/);
    }
  });
  test('названия станций в подсказках — из списка guide.md', () => {
    expect(STATION_NAMES).toHaveLength(19);
    for (const key of ['tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker', 'ice', 'cream']) {
      const title = lesson(key, { drinkId: 'latte' })?.title ?? '';
      expect(STATION_NAMES.map((n) => n.toLowerCase()), key).toContain(title.toLowerCase());
    }
  });
});

describe('шаг про второй шот', () => {
  test('для одного шота фраза убирается, для двух — уточняется', () => {
    const s = ['Заварите шот на кофемашине. С 0,4 л шотов два: повторите помол, темпер и шот.', 'Подайте.'];
    expect(stepsForShots(s, 1)[0]).toBe('Заварите шот на кофемашине.');
    expect(stepsForShots(s, 2)[0]).toBe('Заварите шот на кофемашине. Шота два: повторите помол, темпер и шот.');
    expect(stepsForShots(s, 2)[1]).toBe('Подайте.');
  });
});

describe('«Зачем» перед карточкой', () => {
  test('станции открываются своим экраном, раф по сливкам, пар только для молочных', () => {
    expect(whyOfInset('grind', { drinkId: 'latte' })).toBe('why:grind');
    expect(whyOfInset('milk', { drinkId: 'raf', cream: true })).toBe('why:cream');
    expect(whyOfInset('milk', { drinkId: 'latte' })).toBe('why:milk');
    expect(whyOfInset('whisk', { drinkId: 'matcha_latte' })).toBe('why:matcha');
    expect(whyOfInset('tonic', { drinkId: 'espresso_tonic' })).toBe('why:juice');
    expect(whyOfInset('pour', { drinkId: 'americano' })).toBeNull();
    expect(whyOfInset('pour', { drinkId: 'latte' })).toBe('why:pour');
    expect(whyOfInset('layer', { drinkId: 'orange_bumble' })).toBeNull();
  });
  test('заказ: сначала все «Зачем», потом карточка; повторно ни того ни другого', () => {
    const seen = freshSeen();
    const items = orderIntro('raf', seen, { shots: 2, size: '0.4' });
    expect(items.map((i) => i.kind)).toEqual(['why', 'why', 'card']);
    expect(items.map((i) => (i.kind === 'why' ? i.key : 'card'))).toEqual(['why:cream', 'why:shots', 'card']);
    const after = [...seen, 'why:cream', 'why:shots', drinkSeenKey('raf')];
    expect(orderIntro('raf', after, { shots: 2, size: '0.4' })).toEqual([]);
    expect(orderIntro('espresso', seen).map((i) => i.kind)).toEqual(['card']);
  });
  test('другой вид пены объясняется на втором молочном напитке, не на первом', () => {
    const seen = freshSeen();
    expect(whyOfOrder('cappuccino', 1, seen)).toEqual([]);
    expect(whyOfOrder('latte', 1, [...seen, drinkSeenKey('cappuccino')])).toEqual(['why:steam-foam']);
    expect(whyOfOrder('latte', 1, [...seen, drinkSeenKey('latte')])).toEqual([]);
  });
  test('слои и топпинг — по заказу', () => {
    expect(whyOfOrder('orange_bumble', 2, freshSeen())).toEqual(['why:shots', 'why:layer']);
    expect(whyOfOrder('cappuccino_pumpkin', 1, freshSeen())).toEqual(['why:topping']);
    expect(whyOfOrder('americano', 1, freshSeen())).toEqual([]);
  });
  test('метка сохранения', () => {
    expect(WHY_MARK).toBe('v3');
  });
});
