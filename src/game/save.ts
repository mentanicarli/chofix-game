import { nextRank } from './menu';
import type { PaceId } from './types';

export const SAVE_KEY = 'coffee-sim-save-v1';

/** Что хранится между сессиями. Версия формата — v1 (обратно совместимо). */
export interface SaveData {
  rank?: number;
  served?: number;
  money: number;
  day: number;
  rating: number;
  pace: PaceId;
  grindSet?: number;
  up?: string[];
}

export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const o: unknown = JSON.parse(raw);
    if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (typeof r['day'] === 'number' && typeof r['money'] === 'number') return o as SaveData;
    }
  } catch {
    /* повреждённое сохранение — как будто его нет */
  }
  return null;
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
  return { rank, served, money: sv.money, day: sv.day, rating: sv.rating, pace: sv.pace, grindSet: sv.grindSet || 3, up: sv.up ?? [] };
}
