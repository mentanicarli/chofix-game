import { DRINKS, EQUIPMENT, EQ_IMPL, MAX_RANK, nextRank, rankInfo } from './menu';
import { FOAM_KINDS, SEEN_MARK, drinkSeenKey, freshSeen } from './lessons';
import { TUTORIALS } from './tutorial';
import type { PaceId } from './types';

/**
 * Песочница разработчика (ссылка с #dev): чистая часть. Ничего про DOM и localStorage.
 * Состояние для старта собирается здесь, чтобы тесты могли проверить согласованность.
 */

/** Ключ localStorage: только последняя конфигурация экрана настройки. Настоящий сейв песочница не трогает. */
export const SANDBOX_KEY = 'chofix.sandbox.v1';

/** Позиции магазина, кроме оборудования (те же id, что в SHOP из src/legacy/00-core.js; сверяет test/sandbox.test.ts). */
export const SHOP_BASE_IDS: readonly string[] = ['milk', 'beans', 'stencil', 'grinderPro', 'tamper', 'thermo', 'machine', 'cozy', 'wifi', 'cards', 'helper'];
/** Все позиции магазина: базовые и оборудование, которое уже работает в баре. */
export const allShopIds = (): string[] => [...SHOP_BASE_IDS, ...EQUIPMENT.filter((e) => EQ_IMPL.includes(e.id)).map((e) => 'eq_' + e.id)];

export const SANDBOX_MAX_DAY = 60;
const PACES: readonly PaceId[] = ['cozy', 'normal', 'hard'];

export interface SandboxConfig {
  day: number;
  rank: number;
  served: number;
  rating: number;
  money: number;
  pace: PaceId;
  /** id купленных позиций магазина: `milk`, `eq_ice`… */
  items: string[];
  /** true — обучение как в новой игре, false — всё уже пройдено */
  showTutorial: boolean;
}

export const defaultSandboxConfig = (): SandboxConfig => ({ day: 1, rank: 1, served: 0, rating: 3, money: 500, pace: 'normal', items: allShopIds(), showTutorial: false });

const clampN = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
};

/** Приводит любые значения к допустимым границам (день 1–60, ранг 1–9, рейтинг 1–5 с шагом 0,1). Согласование с рангом не делает. */
export function normalizeSandboxConfig(c: Partial<SandboxConfig>): SandboxConfig {
  const d = defaultSandboxConfig();
  const known = new Set(allShopIds());
  return {
    day: Math.round(clampN(c.day, 1, SANDBOX_MAX_DAY, d.day)),
    rank: Math.round(clampN(c.rank, 1, MAX_RANK, d.rank)),
    served: Math.round(clampN(c.served, 0, 99999, d.served)),
    rating: Math.round(clampN(c.rating, 1, 5, d.rating) * 10) / 10,
    money: Math.round(clampN(c.money, 0, 99999999, d.money)),
    pace: PACES.find((p) => p === c.pace) ?? d.pace,
    items: Array.isArray(c.items) ? [...new Set(c.items.filter((x): x is string => typeof x === 'string' && known.has(x)))] : d.items,
    showTutorial: typeof c.showTutorial === 'boolean' ? c.showTutorial : d.showTutorial
  };
}

/** Ранг, который следует из дня, рейтинга и числа поданных (по порогам из progression.json). */
export function derivedRank(day: number, rating: number, served: number): number {
  let rank = 1;
  for (let n = nextRank(rank, { day, rating, served }); n; n = nextRank(rank, { day, rating, served })) rank = n.rank;
  return rank;
}

/** Выбор ранга на экране: день, рейтинг и «обслужено» поднимаются до минимума этого ранга (выше оставляем как есть). */
export function withRank(c: SandboxConfig, rank: number): SandboxConfig {
  const r = rankInfo(Math.round(clampN(rank, 1, MAX_RANK, 1)));
  return normalizeSandboxConfig({ ...c, rank: r.rank, day: Math.max(c.day, r.minDay), rating: Math.max(c.rating, r.minRating), served: Math.max(c.served, r.minServed) });
}

/** Разбор сохранённой конфигурации: битое и пустое даёт значения по умолчанию. */
export function parseSandboxConfig(raw: string | null): SandboxConfig {
  if (!raw) return defaultSandboxConfig();
  try {
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return defaultSandboxConfig();
    return normalizeSandboxConfig(o as Partial<SandboxConfig>);
  } catch {
    return defaultSandboxConfig();
  }
}
export const serializeSandboxConfig = (c: SandboxConfig): string => JSON.stringify(normalizeSandboxConfig(c));

/** Всё обучение уже пройдено: карточки новых напитков, шаги и подсказки станций не показываются. */
export function fullSeen(): string[] {
  return [SEEN_MARK, ...DRINKS.map((d) => drinkSeenKey(d.id)), 'step:milk', 'step:pour', 'step:syrup', ...FOAM_KINDS.map((k) => `step:steam:${k}`), ...Object.keys(TUTORIALS)];
}

export type SandboxState = {
  rank: number;
  served: number;
  money: number;
  day: number;
  rating: number;
  pace: PaceId;
  grindSet: number;
  idealGrind: number;
  tutOff: boolean;
  fresh: string[];
  tutorialSeen: string[];
} & Record<string, boolean | number | string | string[]>;

/**
 * Поля состояния игры (G) для старта в песочнице, как их создаёт newGame() плюс выбранные улучшения.
 * Настройки игрока (подсказки, звук) сюда не входят: песочница их не меняет.
 * Согласованность: ранг не ниже того, что следует из дня, рейтинга и числа поданных (по порогам progression.json);
 * оборудование `eq_*` и улучшения включены ровно у выбранных позиций. День, рейтинг и поданные берутся как введены:
 * подтягивать их к минимуму ранга может экран настройки (`withRank`), но разработчик вправе поставить и иначе.
 */
export function makeSandboxState(config: Partial<SandboxConfig>): SandboxState {
  const c = normalizeSandboxConfig(config);
  c.rank = Math.max(c.rank, derivedRank(c.day, c.rating, c.served));
  const st: SandboxState = {
    rank: c.rank, served: c.served, money: c.money, day: c.day, rating: c.rating, pace: c.pace,
    grindSet: 3, idealGrind: 3, tutOff: false, fresh: [],
    tutorialSeen: c.showTutorial ? freshSeen() : fullSeen(),
    milk: false, machine: false, cozy: false, beans: false, syrups: false, stencil: false, grinderPro: false, tamper: false, thermo: false, wifi: false, cards: false, helper: false
  };
  for (const e of EQUIPMENT) if (EQ_IMPL.includes(e.id)) st['eq_' + e.id] = false;
  for (const id of c.items) st[id] = true;
  return st;
}

/* ---------- статистика смены ---------- */

/** Выдача одного напитка за смену (собирает песочница в памяти). */
export interface ServeRecord {
  /** сколько секунд от появления гостя до выдачи (игровое время без пауз и без ускорения) */
  serve: number;
  /** сколько секунд от принятия заказа до выдачи; null — готовил помощник */
  prep: number | null;
  /** число шагов заказа (задач бара вместе с едой); null — неизвестно */
  tasks: number | null;
  /** 0 плохо, 1 нормально, 2 идеально */
  q: 0 | 1 | 2;
  byPlayer: boolean;
}
export interface ShiftTotals { lost: number; revenue: number; tips: number; costs: number }
export interface Stat { mean: number; median: number }
export interface ShiftSummary {
  /** Готовый профиль для PROFILES в scripts/shop-sim.test.ts: speed — множитель к (12 + 7·шагов) секунд, q — доли [плохо, нормально, идеально]. */
  profile: { name: string; speed: number | null; q: [number, number, number] };
  served: number;
  servedByHelper: number;
  lost: number;
  income: number;
  revenue: number;
  tips: number;
  costs: number;
  serveTime: Stat | null;
  prepTime: Stat | null;
  byTasks: Record<string, { n: number; serveTime: Stat; prepTime: Stat | null }>;
}

const r2 = (x: number): number => Math.round(x * 100) / 100;
export function stat(xs: readonly number[]): Stat | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const median = s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
  return { mean: r2(s.reduce((a, x) => a + x, 0) / s.length), median: r2(median) };
}
/** Модель из shop-sim: время приготовления = (12 + 7 · шагов) · speed. */
export const modelPrepTime = (tasks: number): number => 12 + 7 * tasks;

export function summarizeShift(records: readonly ServeRecord[], totals: ShiftTotals, name = 'dev-смена'): ShiftSummary {
  const mine = records.filter((r) => r.byPlayer);
  const prepOf = (rs: readonly ServeRecord[]): number[] => rs.flatMap((r) => (r.prep === null ? [] : [r.prep]));
  const ratios = mine.flatMap((r) => (r.prep !== null && r.tasks ? [r.prep / modelPrepTime(r.tasks)] : []));
  const n = mine.length;
  const share = (q: number): number => (n ? mine.filter((r) => r.q === q).length / n : 0);
  const bad = r2(share(0));
  const normal = r2(share(1));
  const byTasks: ShiftSummary['byTasks'] = {};
  for (const k of [...new Set(mine.flatMap((r) => (r.tasks ? [r.tasks] : [])))].sort((a, b) => a - b)) {
    const rs = mine.filter((r) => r.tasks === k);
    byTasks[String(k)] = { n: rs.length, serveTime: stat(rs.map((r) => r.serve)) as Stat, prepTime: stat(prepOf(rs)) };
  }
  return {
    profile: {
      name,
      speed: ratios.length ? r2(ratios.reduce((a, x) => a + x, 0) / ratios.length) : null,
      q: [bad, normal, n ? r2(1 - bad - normal) : 0]
    },
    served: records.length,
    servedByHelper: records.length - n,
    lost: totals.lost,
    income: Math.round(totals.revenue + totals.tips),
    revenue: Math.round(totals.revenue),
    tips: Math.round(totals.tips),
    costs: Math.round(totals.costs),
    serveTime: stat(mine.map((r) => r.serve)),
    prepTime: stat(prepOf(mine)),
    byTasks
  };
}
