/**
 * Секции бара (Б1-1): левая «Чайный бар», центральная «Кофейный бар», правая «Холодный бар».
 * Схема A (docs/design/sections.md, разд. 1–2, 9): три остановки камеры, мир 3 × 1280.
 * Чистый модуль: без DOM, window, Pixi, Math.random и часов; время приходит параметром.
 */

export type SectionId = 'L' | 'C' | 'R';

/** Порядок слева направо; соседи — по этому списку. */
export const SECTION_ORDER: readonly SectionId[] = ['L', 'C', 'R'];

export const SECTION_NAMES: Readonly<Record<SectionId, string>> = { L: 'Чайный бар', C: 'Кофейный бар', R: 'Холодный бар' };

/** Ширина одной секции и мира, px сцены. */
export const SECTION_W = 1280;
export const WORLD_W = SECTION_W * 3;

/** Положение камеры (левый край кадра в мировых координатах) на каждой остановке: центр остаётся в 0…1280. */
export const SECTION_CAM: Readonly<Record<SectionId, number>> = { L: -SECTION_W, C: 0, R: SECTION_W };

/** Длительность перехода между остановками, секунды. */
export const CAM_SECONDS = 0.3;

export interface Station {
  id: string;
  name: string;
  section: SectionId;
  /** id зон бара (`ZONE_POS`, `TASK_ZONE`), которые принадлежат станции */
  zones: readonly string[];
}

/** 19 станций из раздела 11 sections.md. «Кувшин сливок» стоит у холодильника молока и делит с ним зону `milk`. */
export const STATIONS: readonly Station[] = [
  { id: 'grind', name: 'Кофемолка', section: 'C', zones: ['grind'] },
  { id: 'tamp', name: 'Темпер', section: 'C', zones: ['tamp'] },
  { id: 'shot', name: 'Кофемашина', section: 'C', zones: ['shot', 'stop'] },
  { id: 'water', name: 'Горячая вода', section: 'C', zones: ['water'] },
  { id: 'steam', name: 'Паровая трубка', section: 'C', zones: ['steam'] },
  { id: 'milk', name: 'Холодильник с молоком', section: 'C', zones: ['milk'] },
  { id: 'pour', name: 'Чашка', section: 'C', zones: ['pour'] },
  { id: 'syrup', name: 'Полка сиропов', section: 'C', zones: ['syrup', 'syr1', 'syr2', 'syr3'] },
  { id: 'ice', name: 'Льдогенератор', section: 'C', zones: ['ice'] },
  { id: 'cream', name: 'Кувшин сливок', section: 'C', zones: ['milk'] },
  { id: 'matcha', name: 'Набор для матчи', section: 'L', zones: ['matcha'] },
  { id: 'tea', name: 'Чайная станция', section: 'L', zones: ['tea'] },
  { id: 'powders', name: 'Полка порошков', section: 'L', zones: ['powders'] },
  { id: 'juice', name: 'Холодильник соков и тоника', section: 'R', zones: ['juice'] },
  { id: 'whipper', name: 'Сифон для сливочной пены', section: 'R', zones: ['whipper'] },
  { id: 'foamer', name: 'Миксер для пенок', section: 'R', zones: ['foamer'] },
  { id: 'blender', name: 'Блендер', section: 'R', zones: ['blender'] },
  { id: 'boba', name: 'Станция бабл ти', section: 'R', zones: ['boba'] },
  { id: 'shaker', name: 'Шейкер', section: 'R', zones: ['shaker'] }
];

/** Зоны центра, которые не отдельные «станции» из раздела 11: витрина и микроволновка под столешницей, звонок. */
const CENTER_EXTRA_ZONES: readonly string[] = ['food', 'micro', 'bell'];

/** Секция по id зоны (ключи `ZONE_POS` и значения `TASK_ZONE`); неизвестная зона — undefined. */
export function sectionOfZone(zone: string): SectionId | undefined {
  if (CENTER_EXTRA_ZONES.includes(zone)) return 'C';
  return STATIONS.find((s) => s.zones.includes(zone))?.section;
}

export function sectionOfStation(id: string): SectionId | undefined {
  return STATIONS.find((s) => s.id === id)?.section;
}

/** Покупки (`G.eq_<id>`), которые открывают боковую секцию: первая же из списка. Центр открыт всегда. */
export const SECTION_EQ: Readonly<Record<'L' | 'R', readonly string[]>> = {
  L: ['tea', 'matcha', 'powders'],
  R: ['juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker']
};

export type SectionsOpen = Readonly<Record<SectionId, boolean>>;

/** Какие секции открыты по покупкам. `owned` — состояние игры (`G`): ключи `eq_tea`, `eq_juice` и т. д. */
export function sectionsOpen(owned: Readonly<Record<string, unknown>>): SectionsOpen {
  const has = (ids: readonly string[]): boolean => ids.some((k) => !!owned['eq_' + k]);
  return { L: has(SECTION_EQ.L), C: true, R: has(SECTION_EQ.R) };
}

/** Соседи секции по ряду L–C–R: слева и справа (null, если края нет). */
export function neighbors(id: SectionId): { left: SectionId | null; right: SectionId | null } {
  const i = SECTION_ORDER.indexOf(id);
  return { left: SECTION_ORDER[i - 1] ?? null, right: SECTION_ORDER[i + 1] ?? null };
}

/** Цель камеры: мировой x левого края кадра. */
export function cameraTarget(id: SectionId): number {
  return SECTION_CAM[id];
}

/** Плавность перехода: ease-in-out (кубическая), `t` — доля пути по времени, зажата в 0…1. */
export function easeInOut(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

/** Положение камеры через `elapsed` секунд после старта перехода `from` → `to` (оба — мировые x). */
export function cameraAt(from: number, to: number, elapsed: number, duration: number = CAM_SECONDS): number {
  if (duration <= 0) return to;
  return from + (to - from) * easeInOut(elapsed / duration);
}
