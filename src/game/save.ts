import { nextRank } from './menu';
import type { PaceId } from './types';

export const SAVE_KEY = 'coffee-sim-save-v1';
/** Версия формата: 1 — без поля v (старые сохранения), 2 — с полем v. Читаются обе. */
export const SAVE_VERSION = 2;

/** Что хранится между сессиями. */
export interface SaveData {
  v?: number;
  rank?: number;
  served?: number;
  money: number;
  day: number;
  rating: number;
  pace: PaceId;
  grindSet?: number;
  up?: string[];
  /** оборудование, чьи подсказки игрок уже прошёл */
  tutorialSeen?: string[];
}

const PACES: readonly PaceId[] = ['cozy', 'normal', 'hard'];
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Результат чтения: сохранения нет, оно прочитано (возможно, мигрировано) или повреждено. */
export type SaveRead = { kind: 'none' } | { kind: 'ok'; data: SaveData } | { kind: 'broken'; reason: 'corrupt' | 'newer' };

/** Разбор и миграция сохранения любой версии. Лишние поля отбрасываются, числа проверяются. */
export function readSave(raw: string | null): SaveRead {
  if (!raw) return { kind: 'none' };
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return { kind: 'broken', reason: 'corrupt' };
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { kind: 'broken', reason: 'corrupt' };
  const r = o as Record<string, unknown>;
  const v = r['v'];
  if (num(v) && v > SAVE_VERSION) return { kind: 'broken', reason: 'newer' };
  const day = r['day'];
  const money = r['money'];
  const rating = r['rating'];
  if (!num(day) || !num(money) || day < 1) return { kind: 'broken', reason: 'corrupt' };
  const up = Array.isArray(r['up']) ? r['up'].filter((x): x is string => typeof x === 'string') : [];
  const data: SaveData = {
    v: SAVE_VERSION,
    day: Math.floor(day),
    money,
    rating: num(rating) ? Math.min(5, Math.max(0, rating)) : 3,
    pace: PACES.find((p) => p === r['pace']) ?? 'normal',
    up
  };
  const rank = r['rank'];
  const served = r['served'];
  const grind = r['grindSet'];
  if (num(rank) && rank >= 1) data.rank = Math.floor(rank);
  if (num(served) && served >= 0) data.served = Math.floor(served);
  if (num(grind)) data.grindSet = grind;
  if (Array.isArray(r['tutorialSeen'])) data.tutorialSeen = r['tutorialSeen'].filter((x): x is string => typeof x === 'string');
  return { kind: 'ok', data };
}

export function parseSave(raw: string | null): SaveData | null {
  const r = readSave(raw);
  return r.kind === 'ok' ? r.data : null;
}

export const serializeSave = (d: SaveData): string => JSON.stringify({ ...d, v: SAVE_VERSION });

/**
 * Куда игра кладёт сохранение. Сейчас это localStorage (см. 10-save.js); позже сюда можно подключить аккаунт:
 * достаточно другой реализации с теми же тремя методами.
 */
export interface SaveStore {
  load(): SaveRead;
  save(d: SaveData): void;
  clear(): void;
}

export interface Restored {
  rank: number;
  served: number;
  money: number;
  day: number;
  rating: number;
  pace: PaceId;
  grindSet: number;
  up: string[];
  tutorialSeen: string[];
}
/** Загрузка с миграцией: у старых сохранений нет ранга — он выводится из дня и рейтинга. */
export function restore(sv: SaveData): Restored {
  let rank = sv.rank || 0;
  let served = sv.served || 0;
  if (!rank) {
    rank = 1;
    served = Math.max(served, sv.day * 8);
    for (let n = nextRank(rank, { day: sv.day, rating: sv.rating, served }); n; n = nextRank(rank, { day: sv.day, rating: sv.rating, served }))
      rank = n.rank;
  }
  return { rank, served, money: sv.money, day: sv.day, rating: sv.rating, pace: sv.pace, grindSet: sv.grindSet || 3, up: sv.up ?? [], tutorialSeen: sv.tutorialSeen ?? [] };
}
