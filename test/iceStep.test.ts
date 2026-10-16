import { describe, expect, test } from 'vitest';
import { DRINKS } from '../src/game/menu';
import { sizesOf, variantsOf } from '../src/game/drinkModel';
import { buildTasks, stepLabels } from '../src/game/recipes';
import { recipeCard } from '../src/game/recipeCard';
import { recipeNumbers } from '../src/game/volumes';

/** Шаг «лёд» в билете и цель льда в рецепте согласованы: нет шага без цели и цели без шага. */
const ICED_KEY: Readonly<Record<string, string>> = { americano: 'icedamericano', cappuccino: 'icedcappuccino', latte: 'icedlatte' };
/** Холодные варианты напитков «и горячий, и холодный» без холодной механики: в баре их заказать нельзя, видны только в книге и окне. У них шаг «лёд» стоит, а цели льда в рецепте нет
 *  (известное расхождение, решение владельца отдельно; список зафиксирован, чтобы новое расхождение не прошло незамеченным). */
const BOOK_ONLY_COLD_WITHOUT_ICE_TARGET = ['chicory_latte', 'cocoa', 'latte_banana', 'latte_coconut', 'latte_lemon', 'latte_sakura', 'matcha_coconut', 'matcha_latte', 'raf_halva', 'vanilla_raf'];

describe('шаг «лёд» и цель льда', () => {
  test('в баре: шаг «лёд» есть ровно тогда, когда в recipeNumbers есть цель льда (все напитки, варианты и размеры)', () => {
    let checked = 0;
    for (const d of DRINKS) for (const cold of variantsOf(d)) {
      const orderableInBar = !(cold && d.temp === 'both') || !!ICED_KEY[d.id];
      if (!orderableInBar) continue;
      const key = cold && ICED_KEY[d.id] ? (ICED_KEY[d.id] as string) : d.id;
      for (const size of sizesOf(d.id, cold)) {
        const r = recipeNumbers(d, size, cold);
        for (const syrup of [false, true]) {
          const tasks = buildTasks(key, { cold, syrup, shots: r.shots });
          expect(tasks.includes('ice'), `${d.id} ${cold ? 'холодный' : 'горячий'} ${size}: шаг лёд / цель ${r.ice ?? 0}`).toBe((r.ice ?? 0) > 0);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
  test('протеин готовится без льда: три шага (порошок, молоко или вода, шейкер) в билете и в книге, с сиропом на один больше', () => {
    for (const [id, mid] of [['protein_milk', 'milk'], ['protein_water', 'water']] as const) {
      const d = DRINKS.find((x) => x.id === id);
      expect(d).toBeTruthy();
      if (!d) continue;
      expect(buildTasks(id, { cold: true, syrup: false })).toEqual(['powder', mid, 'shake']);
      const card = recipeCard(d.id, '0.4', true);
      expect(card, id).not.toBeNull();
      if (!card) continue;
      expect(card.tasks, id).toEqual(['powder', mid, 'shake']);
      expect(stepLabels(card.tasks, id), id).toHaveLength(3);
    }
  });
  test('известное расхождение зафиксировано: у холодных вариантов без механики шаг «лёд» стоит, цели льда нет (только книга и окно)', () => {
    const found = new Set<string>();
    for (const d of DRINKS) {
      if (d.temp !== 'both' || ICED_KEY[d.id]) continue;
      for (const size of sizesOf(d.id, true)) {
        const r = recipeNumbers(d, size, true);
        if (buildTasks(d.id, { cold: true, syrup: false, shots: r.shots }).includes('ice') && !((r.ice ?? 0) > 0)) found.add(d.id);
      }
    }
    expect([...found].sort()).toEqual(BOOK_ONLY_COLD_WITHOUT_ICE_TARGET);
  });
  test('остальные напитки не изменились: шаги холодных напитков с механикой по-прежнему кончаются льдом там, где цель есть', () => {
    expect(buildTasks('icedlatte', { cold: true, syrup: false })).toContain('ice');
    expect(buildTasks('orange_bumble', { cold: true, syrup: false })).toContain('ice');
    expect(buildTasks('boba_guava', { cold: true, syrup: true })).toContain('ice');
    expect(buildTasks('aerocano', { cold: true, syrup: false })).toContain('ice');
    expect(buildTasks('frappe_caramel', { cold: true, syrup: false })).toContain('ice');
    expect(buildTasks('milkshake_vanilla', { cold: true, syrup: false })).toContain('ice');
  });
});
