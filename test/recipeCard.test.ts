import { describe, expect, test } from 'vitest';
import { DRINKS, EQUIPMENT, buildTasks, cardVariants, legacyRecipe, partsVolume, recipeCard, stepLabels, taskTarget, FORCED_SYRUP } from '../src/game/api';
import { bookHTML } from '../src/ui/book';
import type { Size } from '../src/game/types';

const allEq = Object.fromEntries(['milk', ...EQUIPMENT.map((e) => e.id)].map((k) => [k, true]));
const html = bookHTML({ rank: 9, tab: 'drinks', fam: 'all', eq: allEq });

const ids = DRINKS.map((d) => d.id);
/** Книга, где у каждого напитка выбран вариант с номером i (или последний) и раскрыты «Точные цифры». */
function roundHtml(i: number): string {
  const sel: Record<string, { size: Size; cold: boolean }> = {};
  for (const d of DRINKS) {
    const vs = cardVariants(d);
    const v = vs[Math.min(i, vs.length - 1)];
    if (v) sel[d.id] = v;
  }
  return bookHTML({ rank: 9, tab: 'drinks', fam: 'all', eq: allEq, sel, exact: ids });
}
const MAX_VARIANTS = Math.max(...DRINKS.map((d) => cardVariants(d).length));
const rounds = Array.from({ length: MAX_VARIANTS }, (_, i) => roundHtml(i));
const allHtml = rounds.join('\n');
/** Кусок книги про один напиток. */
function drinkHtml(h: string, id: string): string {
  const i = h.indexOf(`data-drink="${id}"`);
  expect(i, id).toBeGreaterThanOrEqual(0);
  const j = h.indexOf('data-drink="', i + 10);
  return h.slice(i, j < 0 ? undefined : j);
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

describe('книга рецептов строится из тех же данных, что и бар', () => {
  test('один рецепт на напиток: переключатель размера и холодного; «Точные цифры» по умолчанию свёрнуты', () => {
    expect(html.match(/data-drink="/g)?.length).toBe(DRINKS.length);
    expect(html).not.toContain('class="bkExact"');
    expect(html).toContain('aria-expanded="false"');
    const latte = drinkHtml(html, 'latte');
    expect(latte).toContain('data-booksize="latte|0.2"');
    expect(latte).toContain('data-bookcold="latte|1"');
    expect(latte).not.toContain('Если со льдом');
    const iced = bookHTML({ rank: 9, tab: 'drinks', fam: 'all', eq: allEq, sel: { latte: { size: '0.3', cold: true } } });
    expect(drinkHtml(iced, 'latte')).toContain('Если со льдом');
    expect(drinkHtml(iced, 'latte')).not.toContain('data-booksize="latte|0.2"');
    // у напитка без холодной механики переключателя температуры нет, у холодного бамбла есть только размеры
    expect(drinkHtml(html, 'flat_white')).not.toContain('data-bookcold');
    expect(drinkHtml(html, 'orange_bumble')).not.toContain('data-bookcold');
    expect(drinkHtml(html, 'orange_bumble')).toContain('data-booksize');
    // слот под картинку есть и скрыт
    expect(latte).toMatch(/class="imgSlot bkImg"[^>]* hidden/);
  });
  test('основной текст без цифр с единицами, они только в «Точных цифрах»', () => {
    for (const d of DRINKS) {
      const part = drinkHtml(html, d.id).replace(/<p class="bkNote">[\s\S]*?<\/p>/, '');
      const text = part.replace(/<[^>]+>/g, ' ');
      expect(text, d.id).not.toMatch(/\d+\s?(г|мл|°|кг)(\s|[.,:;)]|$)/);
    }
  });
  test('справочник открывается отдельной вкладкой', () => {
    const g = bookHTML({ rank: 1, tab: 'guide' });
    expect(g).toContain('data-guideq');
    expect((g.match(/class="gTerm"/g) ?? []).length).toBeGreaterThanOrEqual(35);
    expect(g).toContain('Питчер');
  });

  test('для каждого напитка и каждого размера шаги книги = buildTasks (с «Шот 1/2»)', () => {
    let n = 0;
    for (const d of DRINKS) {
      for (const v of cardVariants(d)) {
        const c = recipeCard(d.id, v.size, v.cold);
        expect(c, d.id).not.toBeNull();
        if (!c) continue;
        const tasks = buildTasks(c.key, { cold: v.cold && d.temp === 'both', syrup: !!FORCED_SYRUP[d.id], shots: c.shots });
        expect(c.tasks, `${d.id} ${v.size}`).toEqual(tasks);
        expect(c.steps.map((s) => s.task)).toEqual(tasks);
        const labels = stepLabels(tasks, d.id);
        expect(c.steps.map((s) => s.label)).toEqual(labels);
        if (c.shots > 1) expect(labels).toContain('Шот 2/' + c.shots);
        // выбранный вариант: «Точные цифры» содержат ровно эти шаги, в этом порядке
        const vi = cardVariants(d).findIndex((x) => x.size === v.size && x.cold === v.cold);
        const part = drinkHtml(rounds[vi] as string, d.id);
        const ex = part.slice(part.indexOf('<div class="bkExact">'));
        let at = 0;
        for (const l of labels) {
          const j = ex.indexOf(`<li><b>${esc(l)}</b>`, at);
          expect(j, `${d.id} ${v.size}: шаг «${l}» в книге по порядку`).toBeGreaterThanOrEqual(at);
          at = j + 1;
        }
        expect((ex.match(/<li><b>/g) ?? []).length).toBe(labels.length);
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  test('числа книги совпадают с целями налива в баре', () => {
    for (const d of DRINKS) {
      for (const v of cardVariants(d)) {
        const c = recipeCard(d.id, v.size, v.cold);
        if (!c) continue;
        const r = c.recipe;
        const lr = legacyRecipe(c.key, v.size, v.cold);
        if (r.milk !== undefined) expect(lr.milk, `${d.id} ${v.size} молоко`).toBe(r.milk);
        if (r.water !== undefined) expect(lr.water, `${d.id} ${v.size} вода`).toBe(r.water);
        if (r.ice !== undefined) expect(taskTarget(c.key, 'ice', v.size, v.cold && d.temp === 'both'), `${d.id} ${v.size} лёд`).toBe(r.ice);
        if (r.juice !== undefined) expect(taskTarget(c.key, 'juice', v.size, v.cold && d.temp === 'both'), `${d.id} ${v.size} сок`).toBe(r.juice);
        if (r.tonic !== undefined) expect(taskTarget(c.key, 'tonic', v.size), `${d.id} ${v.size} тоник`).toBe(r.tonic);
        if (r.powder !== undefined) expect(taskTarget(c.key, 'powder', v.size), `${d.id} ${v.size} порошок`).toBe(r.powder);
        if (r.boba !== undefined) expect(taskTarget(c.key, 'boba', v.size), `${d.id} ${v.size} шарики`).toBe(r.boba);
        if (r.foam !== undefined) expect(lr.foam, `${d.id} пена`).toBe(r.foam);
        expect(lr.shots).toBe(c.shots);
        // каждая цифра состава попадает в строку таблицы книги
        for (const p of c.parts) {
          const txt = p.unit === 'помп' ? String(p.amount) : String(Math.round(p.amount * 10) / 10).replace('.', ',');
          expect(allHtml.includes(esc(p.label)) && allHtml.includes(txt), `${d.id} ${v.size}: «${p.label}» ${txt}`).toBe(true);
        }
        // сумма составляющих сходится с объёмом напитка
        expect(Math.abs(partsVolume(r) - r.drinkMl) / r.drinkMl).toBeLessThanOrEqual(0.03);
        // в таблице книги те же шоты
        expect(c.shots).toBe(r.shots);
      }
    }
  });

  test('цена варианта и ранг открытия показаны', () => {
    for (const d of DRINKS) {
      const sizes = Object.keys(d.sizes) as Size[];
      for (const s of sizes) expect(recipeCard(d.id, s)?.price).toBe(d.sizes[s]);
      expect(html).toContain(`ранг ${d.rank} «`);
    }
  });

  test('напитки с одним размером показаны таблицей из одной строки', () => {
    for (const id of ['espresso', 'espresso_double', 'flat_white', 'tea_buckwheat', 'protein_milk', 'protein_water']) {
      const d = DRINKS.find((x) => x.id === id);
      expect(d && Object.keys(d.sizes).length, id).toBe(1);
      const c = recipeCard(id, '0.2' as Size) ?? recipeCard(id, '0.4');
      expect(c?.steps.length, id).toBeGreaterThan(0);
    }
    expect(recipeCard('espresso', '0.2')?.sizeLabel).toBe('30 мл');
    expect(recipeCard('espresso_double', '0.2')?.sizeLabel).toBe('60 мл');
  });

  test('слово «бариста» не склоняется, текст по-русски', () => {
    expect(html).not.toMatch(/баристы|баристе|баристу|баристой/i);
  });

  test('закрытые напитки показаны под своим рангом, ранги идут по возрастанию', () => {
    const low = bookHTML({ rank: 1, tab: 'drinks', fam: 'all', eq: {} });
    expect(low).toContain('Откроется на ранге');
    const ranks = [...html.matchAll(/class="bkRank">Ранг (\d+):/g)].map((m) => +(m[1] as string));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});
