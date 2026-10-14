import typicalJson from '../../data/typical-progress.json';
import { DRINKS, DRINK_NEEDS, ENGINE, EQUIPMENT, MAX_RANK, needsMilk, rankInfo } from './menu';
import { rentFor } from './economy';
import { FOAM_KINDS, SEEN_MARK, STEP_KEYS, drinkSeenKey, freshSeen, lessonKeysOfDrink } from './lessons';
import { SHOP_BASE, SHOP_DEFS, isPurchasable } from './playerModel';
import { TUTORIALS } from './tutorial';
import type { PaceId } from './types';

/**
 * Песочница разработчика (ссылка с #dev): чистая часть. Ничего про DOM и localStorage.
 *
 * Принцип: игрок выбирает день, всё остальное выводится из него. Ранг, рейтинг, «обслужено» и деньги берутся из таблицы
 * типичного прогресса (`data/typical-progress.json`, её считает `npm run sim:table` по модели игрока), а покупки —
 * либо всё, что к этому дню доступно по правилам магазина («Всё доступное»), либо покупки типичного игрока.
 * Состояние всегда достижимо для обычного игрока: ранг не выше допустимого для дня, ничего из будущего не открыто.
 */

/** Ключ localStorage: только последняя конфигурация экрана настройки. Настоящий сейв песочница не трогает. */
export const SANDBOX_KEY = 'chofix.sandbox.v1';

/** Позиции магазина, кроме оборудования (те же id, что в SHOP из src/legacy/00-core.js; сверяет test/sandbox.test.ts). */
export const SHOP_BASE_IDS: readonly string[] = SHOP_BASE.map((i) => i.id);
/** Все позиции магазина: базовые и оборудование, которое уже работает в баре. */
export const allShopIds = (): string[] => SHOP_DEFS.map((i) => i.id);

export const SANDBOX_MAX_DAY = 60;
const PACES: readonly PaceId[] = ['cozy', 'normal', 'hard'];

export type ProfileId = 'medium' | 'confident';
export const PROFILE_IDS: readonly ProfileId[] = ['medium', 'confident'];
export const PROFILE_NAMES: Readonly<Record<ProfileId, string>> = { medium: 'Средний', confident: 'Уверенный' };
export type ItemsMode = 'all' | 'typical';
export const MODE_NAMES: Readonly<Record<ItemsMode, string>> = { all: 'Всё доступное', typical: 'Как у типичного игрока' };

interface TableDay { day: number; rank: number; rating: number; served: number; servedMax: number; money: number }
interface TableProfile { days: TableDay[]; purchases: Array<{ id: string; day: number }> }
const TABLE = typicalJson as unknown as { profiles: Record<ProfileId, TableProfile> };

const clampN = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
};

/** Строка таблицы типичного прогресса на начало дня. */
export function typicalRow(profile: ProfileId, day: number): TableDay {
  const days = TABLE.profiles[profile].days;
  return days[Math.min(days.length, Math.max(1, day)) - 1] as TableDay;
}
/** Сколько поданных напитков набирается к дню не больше, чем у лучшего из прогонов профиля «Уверенный» (правдоподобный потолок). */
export const servedCap = (day: number): number => typicalRow('confident', day).servedMax;
/** Максимальный ранг, который обычный игрок может иметь к началу этого дня: хватает дня (minDay) и поданных (minServed ≤ потолка). */
export function maxRankForDay(day: number): number {
  const cap = servedCap(day);
  for (let r = MAX_RANK; r > 1; r--) {
    const i = rankInfo(r);
    if (i.minDay <= day && i.minServed <= cap) return r;
  }
  return 1;
}

/**
 * Оставляет из списка только то, что обычный игрок мог купить к началу дня при этом ранге: правила магазина (isShopItemAvailable),
 * «С дня N» / «Ранг N», цепочки зависимостей (молоко, потом то, что после молока, и т. д.; считается до неподвижной точки).
 * Порядок результата — порядок покупки. В первый день ничего не куплено: магазин открывается вечером.
 */
export function sanitizeItems(day: number, rank: number, wanted: readonly string[]): string[] {
  if (day < 2) return [];
  const known = new Set(allShopIds());
  const want = [...new Set(wanted)].filter((x) => known.has(x));
  const owned: Record<string, boolean> = {};
  const out: string[] = [];
  for (let again = true; again; ) {
    again = false;
    for (const id of want) {
      const def = SHOP_DEFS.find((x) => x.id === id);
      if (!owned[id] && def && isPurchasable(def, day, rank, owned)) {
        owned[id] = true;
        out.push(id);
        again = true;
      }
    }
  }
  return out;
}
/** Всё, что на этом дне и ранге уже можно было купить. */
export const allAvailableItems = (day: number, rank: number): string[] => sanitizeItems(day, rank, allShopIds());
/** Дополняет уже купленное тем, что стало доступно (после повышения ранга). */
export const extendAvailable = (day: number, rank: number, owned: readonly string[]): string[] => [...new Set([...owned, ...allAvailableItems(day, rank)])];
/** Покупки типичного игрока к началу дня (из таблицы), проверенные правилами. */
export const typicalItems = (profile: ProfileId, day: number, rank: number): string[] =>
  sanitizeItems(day, rank, TABLE.profiles[profile].purchases.filter((p) => p.day <= day).map((p) => p.id));

/** Ручная правка («Своё»): что задано, то и берётся, но в допустимых для дня границах. */
export interface SandboxOverride { rank?: number; rating?: number; served?: number; money?: number; items?: string[] }

export interface SandboxConfig {
  day: number;
  profile: ProfileId;
  mode: ItemsMode;
  pace: PaceId;
  /** true — обучение как у игрока на этом ранге, false — всё уже пройдено */
  showTutorial: boolean;
  /** null — блок «Своё» свёрнут, всё выводится из дня */
  custom: SandboxOverride | null;
}

export const defaultSandboxConfig = (): SandboxConfig => ({ day: 1, profile: 'medium', mode: 'all', pace: 'normal', showTutorial: false, custom: null });

function normalizeOverride(o: unknown): SandboxOverride | null {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  const num = (k: string): number | undefined => (typeof r[k] === 'number' && Number.isFinite(r[k]) ? (r[k] as number) : undefined);
  const out: SandboxOverride = {};
  const rank = num('rank');
  const rating = num('rating');
  const served = num('served');
  const money = num('money');
  if (rank !== undefined) out.rank = Math.round(rank);
  if (rating !== undefined) out.rating = rating;
  if (served !== undefined) out.served = Math.round(served);
  if (money !== undefined) out.money = Math.max(0, Math.round(money));
  if (Array.isArray(r['items'])) out.items = r['items'].filter((x): x is string => typeof x === 'string');
  return out;
}

/** Приводит любые значения к допустимым (день 1–60, известные профиль и режим). Допустимость остального проверяет resolveSandbox. */
export function normalizeSandboxConfig(c: Partial<SandboxConfig>): SandboxConfig {
  const d = defaultSandboxConfig();
  return {
    day: Math.round(clampN(c.day, 1, SANDBOX_MAX_DAY, d.day)),
    profile: PROFILE_IDS.find((p) => p === c.profile) ?? d.profile,
    mode: c.mode === 'typical' || c.mode === 'all' ? c.mode : d.mode,
    pace: PACES.find((p) => p === c.pace) ?? d.pace,
    showTutorial: typeof c.showTutorial === 'boolean' ? c.showTutorial : d.showTutorial,
    custom: normalizeOverride(c.custom)
  };
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

export interface Resolved {
  config: SandboxConfig;
  rank: number;
  rating: number;
  served: number;
  money: number;
  /** купленное, в порядке покупки */
  items: string[];
  /** выше этого ранга на этот день не бывает */
  maxRank: number;
  minRating: number;
  minServed: number;
  servedMax: number;
  /** что ещё можно отметить (доступно при текущем наборе) */
  avail: string[];
}

/** Из дня, профиля и режима выводит всё состояние; ручные правки применяет в границах допустимого. */
export function resolveSandbox(config: Partial<SandboxConfig>): Resolved {
  const c = normalizeSandboxConfig(config);
  const row = typicalRow(c.profile, c.day);
  const maxRank = maxRankForDay(c.day);
  const cus = c.custom ?? {};
  const rank = Math.round(clampN(cus.rank, 1, maxRank, Math.min(row.rank, maxRank)));
  const info = rankInfo(rank);
  const servedMax = Math.max(servedCap(c.day), info.minServed);
  const rating = Math.round(clampN(cus.rating, info.minRating, 5, row.rating) * 10) / 10;
  const served = Math.round(clampN(cus.served, info.minServed, servedMax, row.served));
  const money = cus.money ?? Math.max(row.money, 2 * rentFor(c.pace, rank));
  const items = cus.items ? sanitizeItems(c.day, rank, cus.items) : c.mode === 'all' ? allAvailableItems(c.day, rank) : typicalItems(c.profile, c.day, rank);
  const owned = Object.fromEntries(items.map((i) => [i, true]));
  const avail = c.day < 2 ? [] : SHOP_DEFS.filter((d) => !owned[d.id] && isPurchasable(d, c.day, rank, owned)).map((d) => d.id);
  return { config: c, rank, rating: Math.max(info.minRating, rating), served, money, items, maxRank, minRating: info.minRating, minServed: info.minServed, servedMax, avail };
}

/**
 * Что игрок «уже видел» к этому дню и рангу: напитки прошлых рангов (и первого со второго дня), их шаги и станции,
 * которые куплены и не новые для ранга. Подсказки для ещё не открытого не заполняются.
 */
export function seenFor(day: number, rank: number, items: readonly string[]): string[] {
  const owned = new Set(items);
  const out = new Set<string>([SEEN_MARK]);
  for (const d of DRINKS) {
    if (!(d.id in ENGINE)) continue;
    if (needsMilk(d) && !owned.has('milk')) continue;
    if (!(DRINK_NEEDS[d.id] ?? []).every((n) => owned.has('eq_' + n))) continue;
    if (d.rank < rank || (d.rank === 1 && day > 1)) {
      out.add(drinkSeenKey(d.id));
      lessonKeysOfDrink(d.id).forEach((k) => out.add(k));
    }
  }
  if (day > 1) out.add('step:syrup');
  for (const e of EQUIPMENT) if (e.id in TUTORIALS && owned.has('eq_' + e.id) && e.rank < rank) out.add(e.id);
  return [...out];
}

/** Всё обучение уже пройдено: карточки новых напитков, шаги и подсказки станций не показываются. */
export function fullSeen(): string[] {
  return [SEEN_MARK, ...DRINKS.map((d) => drinkSeenKey(d.id)), ...STEP_KEYS, ...FOAM_KINDS.map((k) => `step:steam:${k}`), ...Object.keys(TUTORIALS)];
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
 * Поля состояния игры (G) для старта в песочнице, как их создаёт newGame() плюс выведенные из дня.
 * Настройки игрока (подсказки, звук) сюда не входят: песочница их не меняет.
 * Улучшения и оборудование `eq_*` включены ровно у купленных позиций.
 */
export function makeSandboxState(config: Partial<SandboxConfig>): SandboxState {
  const r = resolveSandbox(config);
  const c = r.config;
  const st: SandboxState = {
    rank: r.rank, served: r.served, money: r.money, day: c.day, rating: r.rating, pace: c.pace,
    grindSet: 3, idealGrind: 3, tutOff: false, fresh: [],
    tutorialSeen: c.showTutorial ? (c.day > 1 || r.rank > 1 ? seenFor(c.day, r.rank, r.items) : freshSeen()) : fullSeen(),
    milk: false, machine: false, cozy: false, beans: false, syrups: false, stencil: false, grinderPro: false, tamper: false, thermo: false, wifi: false, cards: false, helper: false
  };
  for (const d of SHOP_DEFS) st[d.id] = false;
  for (const id of r.items) st[id] = true;
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
