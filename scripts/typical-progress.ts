/* Таблица «типичный прогресс по дням» для песочницы: прогоняет модель игрока (src/game/playerModel.ts) и берёт медианы.
   Запуск: npm run sim:table → data/typical-progress.json. В npm run check не входит. */
import { PRIORITY, PROFILES, SHOP_DEFS, isPurchasable, simulate } from '../src/game/playerModel';
import type { DaySnap } from '../src/game/playerModel';

export const DAYS = 60;
export const RUNS = 60;

const median = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number;
const r2 = (x: number): number => Math.round(x * 100) / 100;

export interface TableDay { day: number; rank: number; rating: number; served: number; servedMax: number; money: number; alive: number }
export interface TableProfile { name: string; days: TableDay[]; purchases: Array<{ id: string; day: number }> }
export interface TypicalTable { version: 1; runs: number; days: number; pace: 'normal'; profiles: Record<string, TableProfile> }

export function buildTable(): TypicalTable {
  const profiles: Record<string, TableProfile> = {};
  for (const prof of PROFILES) {
    const runs = Array.from({ length: RUNS }, (_, i) => simulate(i + 1, prof, DAYS));
    const rows: TableDay[] = [];
    const ownedAt: Array<Map<string, number>> = [];
    for (let d = 1; d <= DAYS; d++) {
      const snaps = runs.map((r) => r.snaps[d - 1]).filter((x): x is DaySnap => !!x);
      const prev = rows[d - 2];
      if (!snaps.length) {
        rows.push({ ...(prev as TableDay), day: d, alive: 0 });
        ownedAt.push(new Map());
        continue;
      }
      rows.push({
        day: d,
        rank: Math.max(prev?.rank ?? 1, median(snaps.map((s) => s.rank))),
        rating: r2(median(snaps.map((s) => s.rating))),
        served: median(snaps.map((s) => s.served)),
        servedMax: Math.max(prev?.servedMax ?? 0, ...snaps.map((s) => s.served)),
        money: Math.round(median(snaps.map((s) => s.money))),
        alive: snaps.length
      });
      const cnt = new Map<string, number>();
      for (const s of snaps) for (const id of s.owned) cnt.set(id, (cnt.get(id) ?? 0) + 1);
      ownedAt.push(new Map([...cnt].filter(([, n]) => n / snaps.length >= 0.5)));
    }
    // покупка «в таблице» с того дня, когда её имеет не меньше половины живых прогонов
    const first = new Map<string, number>();
    for (let d = 1; d <= DAYS; d++) for (const id of ownedAt[d - 1]?.keys() ?? []) if (!first.has(id)) first.set(id, d);
    const prio = (id: string) => PRIORITY.findIndex((p) => p.id === id);
    const list = [...first].map(([id, day]) => ({ id, day })).sort((a, b) => a.day - b.day || prio(a.id) - prio(b.id));
    // согласованность: к своему дню позиция должна проходить правила магазина при ранге таблицы и уже купленном; иначе переносим на день, когда пройдёт
    const owned: Record<string, boolean> = {};
    const out: Array<{ id: string; day: number }> = [];
    const pending = [...list];
    for (let d = 1; d <= DAYS; d++) {
      const rank = (rows[d - 1] as TableDay).rank;
      for (let again = true; again; ) {
        again = false;
        for (const p of pending.slice()) {
          if (p.day > d) continue;
          const def = SHOP_DEFS.find((x) => x.id === p.id);
          if (def && isPurchasable(def, d, rank, owned)) {
            owned[p.id] = true;
            out.push({ id: p.id, day: d });
            pending.splice(pending.indexOf(p), 1);
            again = true;
          }
        }
      }
    }
    profiles[prof.id] = { name: prof.name, days: rows, purchases: out };
  }
  return { version: 1, runs: RUNS, days: DAYS, pace: 'normal', profiles };
}
