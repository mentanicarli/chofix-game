/* Модель игрока: когда каждая покупка становится доступной (isShopItemAvailable) и когда игрок реально может её позволить.
   Сама модель лежит в src/game/playerModel.ts (её же использует таблица для песочницы, npm run sim:table).
   Не входит в обычный прогон. Запуск: SIM=1 npx vitest run scripts/shop-sim.test.ts  → out/shop-sim.md */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { MAX_RANK, RANKS } from '../src/game/api';
import { PROFILES, SHOP_DEFS, simulate } from '../src/game/playerModel';
import type { DaySnap, Run } from '../src/game/playerModel';
import { DAYS, RUNS } from './typical-progress';

const ITEMS = SHOP_DEFS;

const median = (a: number[]): number => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number : NaN);

/** Горизонт отчёта совпадает с таблицей песочницы (60 дней, 60 прогонов): раньше отчёт считал 40 дней, и ранги 8–9 выходили как «день NaN». */
const HORIZON = DAYS;
const NEVER = HORIZON + 1;

/** Первый день (на начало дня), когда условие выполнено; NEVER, если не выполнялось за горизонт. */
const firstDay = (r: Run, ok: (s: DaySnap) => boolean): number => r.snaps.find(ok)?.day ?? NEVER;

const rankSection = (runs: Run[]): string[] => {
  const out = [
    `### Ранги (горизонт ${HORIZON} дней, ${runs.length} прогонов)`, '',
    'Условия ранга: день ≥ minDay, рейтинг ≥ порога, подано ≥ порога (на начало дня). «Выполнено» — медианный первый день, когда условие выполнено (если у большинства прогонов не выполнено за горизонт: «не за N дней»). «Тормозило» — условие с самым поздним медианным днём и на сколько дней оно позже следующего по поздности.',
    '', '| Ранг | Достигли | День достижения (медиана среди достигших) | День (minDay) | Рейтинг ≥ | выполнен, день | Подано ≥ | выполнено, день | Тормозило |', '|---|---|---|---|---|---|---|---|---|'
  ];
  const med = (xs: number[]): number => median(xs);
  const show = (d: number): string => (d >= NEVER ? `не за ${HORIZON} дней` : String(d));
  for (const info of RANKS.filter((x) => x.rank >= 2)) {
    const reached = runs.map((r) => r.rank.get(info.rank)).filter((x): x is number => x !== undefined);
    const dRate = med(runs.map((r) => firstDay(r, (s) => s.rating >= info.minRating)));
    const dServ = med(runs.map((r) => firstDay(r, (s) => s.served >= info.minServed)));
    const conds: Array<[string, number]> = [['день', info.minDay], ['рейтинг', dRate], ['число гостей', dServ]];
    conds.sort((a, b) => b[1] - a[1]);
    const [top, second] = [conds[0] as [string, number], conds[1] as [string, number]];
    const ties = conds.filter((c) => c[1] === top[1]).map((c) => c[0]);
    const lag = top[1] - second[1];
    const slow = top[1] >= NEVER ? `${top[0]}: не выполнено за ${HORIZON} дней` : lag === 0 ? `${ties.join(' и ')} (вместе)` : `${top[0]} (позже следующего на ${lag} дн.)`;
    out.push(`| ${info.rank} ${info.title} | ${reached.length}/${runs.length} | ${reached.length ? median(reached) + 1 : `не достигнут за ${HORIZON} дней`} | ${info.minDay} | ${info.minRating} | ${show(dRate)} | ${info.minServed} | ${show(dServ)} | ${slow} |`);
  }
  // где прогоны оказались к концу горизонта
  const last = runs.map((r) => r.snaps[r.snaps.length - 1] as DaySnap);
  const parts: string[] = [];
  for (let k = 1; k <= MAX_RANK; k++) {
    const at = last.filter((x) => x.rank === k);
    if (at.length) parts.push(`ранг ${k}: ${at.length} (рейтинг медиана ${(median(at.map((x) => x.rating)) as number).toFixed(2)}, подано ${median(at.map((x) => x.served))})`);
  }
  out.push('', `Где прогоны к концу горизонта (день ${HORIZON + 1} на начало): ${parts.join('; ')}.`);
  return out;
};

const rank9Section = (runs: Run[]): string[] => {
  const r9 = RANKS.find((x) => x.rank === MAX_RANK);
  const out = ['', `Ранг ${MAX_RANK}: рейтинг ≥ ${r9?.minRating}, подано ≥ ${r9?.minServed}. Медианы на начало дня (по живым прогонам):`, '', '| День | Рейтинг | Подано | Ранг |', '|---|---|---|---|'];
  for (const d of [30, 40, 60]) {
    const sn = runs.map((r) => r.snaps[d - 1]).filter((x): x is DaySnap => !!x);
    out.push(`| ${d} | ${sn.length ? (median(sn.map((s) => s.rating)) as number).toFixed(2) : '—'} | ${sn.length ? median(sn.map((s) => s.served)) : '—'} | ${sn.length ? median(sn.map((s) => s.rank)) : '—'} |`);
  }
  return out;
};

const moneySection = (runs: Run[]): string[] => {
  const days = Array.from({ length: HORIZON / 5 }, (_, i) => (i + 1) * 5);
  const cell = (d: number): string => {
    const sn = runs.map((r) => r.snaps[d]).filter((x): x is DaySnap => !!x); // снимок на начало следующего дня = остаток на конец этого
    return sn.length ? String(Math.round(median(sn.map((s) => s.money)))) : '—';
  };
  const streak = (r: Run): number => { let best = 0, cur = 0; for (const x of r.idle) { cur = x ? cur + 1 : 0; best = Math.max(best, cur); } return best; };
  const firstIdle = runs.map((r) => r.idle.findIndex(Boolean) + 1).filter((x) => x > 0);
  const out = ['', '### Свободные деньги', '', 'Медианный остаток на конец дня (после вечерних покупок), ₽:', '', `| ${days.map((d) => 'д' + d).join(' | ')} |`, `|${days.map(() => '---').join('|')}|`, `| ${days.map(cell).join(' | ')} |`, ''];
  const st = runs.map(streak);
  const total = runs.map((r) => r.idle.filter(Boolean).length);
  out.push(`«Нечего покупать» (после вечерних покупок нет ни одной доступной непокупленной позиции): самая долгая серия подряд, дней: медиана ${median(st)}, максимум ${Math.max(...st)}; всего таких дней за ${HORIZON}: медиана ${median(total)}; первый такой день: медиана ${firstIdle.length ? median(firstIdle) : '—'} (в ${firstIdle.length}/${runs.length} прогонах).`);
  return out;
};

test.skipIf(!process.env['SIM'])('модель игрока: доступность и накопления', () => {
  const lines: string[] = ['# Покупки по дням (модель игрока)', '', 'День = вечер после этого дня: покупка доступна в магазине и, если денег хватает, куплена; эффект с утра следующего дня.', ''];
  for (const prof of PROFILES) {
    const runs = Array.from({ length: RUNS }, (_, i) => simulate(i + 1, prof, HORIZON));
    lines.push(`## ${prof.name} (${RUNS} прогонов, ${HORIZON} дней, обычный темп)`, '', `Банкротств: ${runs.filter((r) => r.over).length}. Доход за день (выручка − себестоимость − аренда), медиана по дням: ${[1, 3, 5, 8, 12, 16, 20, 25, 30].map((d) => `д${d} ${median(runs.map((r) => r.income[d - 1] ?? NaN).filter((x) => !Number.isNaN(x)))}`).join(', ')}.`, '');
    lines.push(...rankSection(runs));
    if (prof.id === 'medium') lines.push(...rank9Section(runs));
    lines.push(...moneySection(runs), '', '### Покупки', '');
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
