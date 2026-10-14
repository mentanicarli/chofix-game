/* Модель игрока: когда каждая покупка становится доступной (isShopItemAvailable) и когда игрок реально может её позволить.
   Сама модель лежит в src/game/playerModel.ts (её же использует таблица для песочницы, npm run sim:table).
   Не входит в обычный прогон. Запуск: SIM=1 npx vitest run scripts/shop-sim.test.ts  → out/shop-sim.md */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { PROFILES, SHOP_DEFS, simulate } from '../src/game/playerModel';

const ITEMS = SHOP_DEFS;

const median = (a: number[]): number => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number : NaN);

test.skipIf(!process.env['SIM'])('модель игрока: доступность и накопления', () => {
  const lines: string[] = ['# Покупки по дням (модель игрока)', '', 'День = вечер после этого дня: покупка доступна в магазине и, если денег хватает, куплена; эффект с утра следующего дня.', ''];
  for (const prof of PROFILES) {
    const runs = Array.from({ length: 60 }, (_, i) => simulate(i + 1, prof));
    lines.push(`## ${prof.name} (60 прогонов, обычный темп)`, '', `Банкротств: ${runs.filter((r) => r.over).length}. Доход за день (выручка − себестоимость − аренда), медиана по дням: ${[1, 3, 5, 8, 12, 16, 20, 25, 30].map((d) => `д${d} ${median(runs.map((r) => r.income[d - 1] ?? NaN).filter((x) => !Number.isNaN(x)))}`).join(', ')}.`, '');
    lines.push('Ранг: ' + [2, 3, 4, 5, 6, 7, 8, 9].map((k) => `${k} → день ${median(runs.map((r) => r.rank.get(k) ?? NaN).filter((x) => !Number.isNaN(x)))}`).join(', '), '');
    lines.push('| Позиция | Цена | Доступна (день) | Хватает денег (день) | Куплена (день) | Ждёт после появления, дней | Куплена в прогонах |', '|---|---|---|---|---|---|---|');
    for (const it of ITEMS) {
      const av = runs.map((r) => r.avail.get(it.id)).filter((x): x is number => x !== undefined);
      const af = runs.map((r) => r.afford.get(it.id)).filter((x): x is number => x !== undefined);
      const bo = runs.map((r) => r.bought.get(it.id)).filter((x): x is number => x !== undefined);
      const gap = runs.map((r) => (r.bought.has(it.id) && r.avail.has(it.id) ? (r.bought.get(it.id) as number) - (r.avail.get(it.id) as number) : NaN)).filter((x) => !Number.isNaN(x));
      const g = gap.length ? median(gap) : NaN;
      lines.push(`| ${it.name} | ${it.cost} | ${av.length ? median(av) : '—'} | ${af.length ? median(af) : '—'} | ${bo.length ? median(bo) : '—'} | ${Number.isNaN(g) ? '—' : g}${g > 3 ? ' ⚠' : ''} | ${bo.length}/${runs.length} |`);
    }
    lines.push('');
  }
  mkdirSync('out', { recursive: true });
  writeFileSync('out/shop-sim.md', lines.join('\n'));
  expect(lines.length).toBeGreaterThan(10);
});
