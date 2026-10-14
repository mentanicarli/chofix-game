import { describe, expect, test } from 'vitest';
import { DRINKS, EQUIPMENT, buildTasks, cardVariants, legacyRecipe, partsVolume, recipeCard, stepLabels, taskTarget, FORCED_SYRUP } from '../src/game/api';
import { bookHTML } from '../src/ui/book';
import type { Size } from '../src/game/types';

const allEq = Object.fromEntries(['milk', ...EQUIPMENT.map((e) => e.id)].map((k) => [k, true]));
const html = bookHTML({ rank: 9, tab: 'drinks', fam: 'all', eq: allEq });

/** Кусок книги про один вариант напитка (размер и горячий/холодный) */
function variantHtml(name: string, label: string): string {
  const card = html.split(/<div class="bk(?: soon| lock)?">/).find((c) => c.includes(`<b>${name.replace(/&/g, '&amp;')}</b>`)) ?? '';
  const i = card.indexOf(`<summary>${label} · шаги`);
  expect(i, `${name} / ${label}`).toBeGreaterThanOrEqual(0);
  return card.slice(i, card.indexOf('</details>', i));
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

describe('книга рецептов строится из тех же данных, что и бар', () => {
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
        // страница книги содержит ровно эти шаги, в этом порядке
        const part = variantHtml(esc(d.name), c.sizeLabel.length && d.temp === 'both' ? (v.cold ? 'холодный ' : 'горячий ') + c.sizeLabel : c.sizeLabel);
        let at = 0;
        for (const l of labels) {
          const j = part.indexOf(`<li><b>${esc(l)}</b>`, at);
          expect(j, `${d.id} ${v.size}: шаг «${l}» в книге по порядку`).toBeGreaterThanOrEqual(at);
          at = j + 1;
        }
        expect((part.match(/<li>/g) ?? []).length).toBe(labels.length);
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
          expect(html.includes(esc(p.label)) && html.includes(txt), `${d.id} ${v.size}: «${p.label}» ${txt}`).toBe(true);
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
