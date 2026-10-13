import { DRINKS, STATIONS, drinkById } from './menu';
import { THICK } from './recipes';
import { TUTORIALS, equipmentName, tutorialEqs } from './tutorial';
import type { RecipeStep } from './types';

/* ---------- обучение по шагам и «Новый напиток» ----------
   Что уже показано, лежит в tutorialSeen (в сохранении) строками:
   `matcha` (станция), `drink:latte` (карточка напитка), `step:milk` / `step:steam:thin` / `step:pour` / `step:syrup` (шаги). */

/** Метка «сохранение уже знает про обучение по шагам». Без неё старое сохранение переносится один раз (migrateSeen). */
export const SEEN_MARK = 'v2';
export const freshSeen = (): string[] => [SEEN_MARK];

/** Параметры пара. Должны совпадать с 07-bar-sim.js (steamDone, шаг пара) и steamView.ts; старт молока 8° задан в 06-bar.js. */
export const STEAM = {
  startTemp: 8,
  /** нагрев, °C в секунду, пока пар включён */
  heatPerSec: 7,
  /** рост пены у поверхности, доля шкалы в секунду */
  foamPerSec: 0.2,
  /** у поверхности пена растёт, только пока молоко холоднее */
  airUntil: 46,
  /** выше этого молоко пригорает */
  burnAt: 76,
  zone: [55, 65],
  zoneThermo: [53, 68]
} as const;

export type FoamKind = 'thick' | 'thin' | 'micro';
export const FOAM_KINDS: readonly FoamKind[] = ['thick', 'thin', 'micro'];
/** Вид пены напитка по рецепту (капучино густая, флэт уайт микро, остальное лёгкая). */
export function steamKind(drinkId: string): FoamKind {
  const a = drinkById[drinkId]?.steps.find((s) => s.st === 'steam')?.arg;
  return a === 'thick' || a === 'micro' ? a : 'thin';
}

const ru = (n: number): string => String(n).replace('.', ',');
/** «около 3 с» / «меньше секунды»: сколько держать трубку у поверхности, чтобы набрать пену. */
export function airTime(foam: number): string {
  const t = foam / STEAM.foamPerSec;
  return t < 1 ? 'меньше секунды' : `около ${ru(Math.round(t * 2) / 2)} с`;
}

const FOAM_WORD: Readonly<Record<FoamKind, string>> = { thick: 'густая пена', thin: 'лёгкая пена', micro: 'микропена, самая тонкая' };
/** Чем отличается пена напитка: плотность и время у поверхности (из параметров станции). */
export function foamLine(kind: FoamKind, foam: number = THICK[kind] ?? 0.26, name = ''): string {
  return `${name ? name + ': ' : ''}${FOAM_WORD[kind]}, около ${Math.round(foam * 100)}% шкалы «Пена». У поверхности ${airTime(foam)}.`;
}

/** Шаг рецепта простыми словами (как в книге рецептов). */
const ARG_TXT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  steam: { thick: 'плотная пена', thin: 'лёгкая пена', micro: 'микропена' },
  pour: { layer: 'слоями' },
  juice: { 'горячий': 'горячая основа' }
};
export function recipeStepText(s: RecipeStep): string {
  const nm = STATIONS[s.st] || s.st;
  if (!s.arg) return nm;
  if (s.st === 'brew') {
    const [t, m] = s.arg.split('/');
    return `${nm} (${t}°C, ${m} мин)`;
  }
  return `${nm} (${ARG_TXT[s.st]?.[s.arg] ?? s.arg})`;
}
export const recipeLines = (drinkId: string): string[] => (drinkById[drinkId]?.steps ?? []).map(recipeStepText);

/** Карточка «Новый напиток» при первом заказе. */
export interface DrinkCard {
  key: string;
  name: string;
  steps: string[];
  /** чем напиток отличается, если есть что сказать (вид пены) */
  tip: string;
}
export const drinkSeenKey = (drinkId: string): string => `drink:${drinkId}`;
/** null — уже показывали (или такого напитка нет). */
/** foam — целевая пена из механики бара (если она отличается от меню), иначе берётся из вида пены. */
export function newDrinkCard(drinkId: string, seen: readonly string[], foam?: number): DrinkCard | null {
  const d = drinkById[drinkId];
  if (!d || seen.includes(drinkSeenKey(drinkId))) return null;
  const tip = d.steps.some((s) => s.st === 'steam') ? foamLine(steamKind(drinkId), foam) : '';
  return { key: drinkSeenKey(drinkId), name: d.name, steps: recipeLines(drinkId), tip };
}

/** Что известно о заказе, когда подсказка собирает текст. Всё необязательное: книга рецептов цифр не знает. */
export interface LessonCtx {
  drinkId: string;
  drinkName?: string;
  /** молоко в питчере (или стакане), мл */
  ml?: number;
  /** целевая пена, доля шкалы */
  foam?: number;
  thermo?: boolean;
  /** молоко идёт в питчер на пар (иначе сразу в стакан) */
  steam?: boolean;
  syrupName?: string;
  pumps?: number;
}

export interface Lesson {
  /** ключ в tutorialSeen */
  key: string;
  tag: string;
  title: string;
  /** где станция, когда окно ещё не открыто */
  where: string;
  steps: string[];
  /** показывать шаги по одному (текущий выбирает lessonStep); иначе списком целиком */
  paced: boolean;
}

const STEP_TAG = 'Новый шаг';
const steamZone = (thermo?: boolean): readonly [number, number] => (thermo ? STEAM.zoneThermo : STEAM.zone);
/** За сколько секунд пар доводит молоко до границ зелёной зоны. */
export function steamSeconds(thermo?: boolean): [number, number] {
  const [lo, hi] = steamZone(thermo);
  return [Math.round((lo - STEAM.startTemp) / STEAM.heatPerSec), Math.round((hi - STEAM.startTemp) / STEAM.heatPerSec)];
}

/** Ключи шагов (не оборудования) для задачи бара. */
export function stepKeysOf(task: string, drinkId: string): string[] {
  switch (task) {
    case 'syrup': return ['step:syrup'];
    case 'milk': return ['step:milk'];
    case 'steam': return [`step:steam:${steamKind(drinkId)}`];
    case 'pour': return ['step:pour'];
    default: return [];
  }
}
/** Все подсказки задачи: сначала шаговые, потом по оборудованию. */
export const tutorialKeys = (task: string, drinkId: string, food?: { case: string; heat: boolean } | null): string[] => [...stepKeysOf(task, drinkId), ...tutorialEqs(task, food)];
/** Какая подсказка нужна сейчас (первая не показанная). */
export const nextTutorial = (task: string, drinkId: string, food: { case: string; heat: boolean } | null | undefined, seen: readonly string[]): string | null =>
  tutorialKeys(task, drinkId, food).find((k) => !seen.includes(k)) ?? null;

/** Подсказка по ключу: станция (TUTORIALS) или шаг. */
export function lesson(key: string, c: LessonCtx): Lesson | null {
  const t = TUTORIALS[key];
  if (t) return { key, tag: 'Новая станция', title: equipmentName(key), where: t.where, steps: [...t.steps], paced: false };
  if (key === 'step:milk') {
    const until = c.ml ? `до линии: ${Math.round(c.ml)} мл` : 'до красной линии';
    const where = c.steam === false ? 'в стакане' : 'в питчере';
    return {
      key, tag: STEP_TAG, title: 'Молоко', where: 'Нажмите на холодильник справа.', paced: true,
      steps: [`Держите «Лить молоко (держите)» или Пробел, пока молоко ${where} не дойдёт ${until}.`, 'Налили лишнее: «Вылить». Потом «Готово».']
    };
  }
  if (key.startsWith('step:steam:')) {
    const kind = key.slice('step:steam:'.length) as FoamKind;
    if (!FOAM_KINDS.includes(kind)) return null;
    const [lo, hi] = steamZone(c.thermo);
    const [s1, s2] = steamSeconds(c.thermo);
    return {
      key, tag: STEP_TAG, title: 'Пар и пена', where: 'Нажмите на паровую трубку справа.', paced: true,
      steps: [
        `Воздух. Зажмите мышь (или Пробел), кончик трубки держите в жёлтой полосе у поверхности: пока молоко холоднее ${STEAM.airUntil}°, растёт пена. ${foamLine(kind, c.foam, c.drinkName)}`,
        'Закрутите. Когда пены хватает, опустите трубку глубже: пена перестанет расти, молоко станет гладким и будет греться.',
        `Остановите. Когда термометр дойдёт до зелёной зоны (${lo}–${hi}°, это ${s1}–${s2} с пара), отпустите мышь и нажмите «Готово». Выше ${STEAM.burnAt}° молоко пригорает.`
      ]
    };
  }
  if (key === 'step:pour')
    return {
      key, tag: STEP_TAG, title: 'Заливка и рисунок', where: 'Нажмите на чашку по центру.', paced: true,
      steps: ['Зажмите мышь над чашкой и ведите по контуру рисунка: молоко льётся, пока вы водите.', 'Когда питчер опустеет, напиток готов. Закончить раньше можно кнопкой «Готово».']
    };
  if (key === 'step:syrup') {
    const what = c.syrupName ? `${c.syrupName.toLowerCase()} ×${c.pumps ?? 1}` : 'сколько просил гость (написано на тикете)';
    return {
      key, tag: STEP_TAG, title: 'Сироп', where: 'Нажмите на полку с сиропами вверху.', paced: true,
      steps: [`Нажмите на бутылку нужного сиропа: одно нажатие это одна порция. Нужно: ${what}.`, 'Нажмите «Готово». Ошиблись: «Вылить».']
    };
  }
  return null;
}

export interface LiveState {
  /** налито молока, мл, и линия */
  ml?: number;
  line?: number;
  foam?: number;
  targetFoam?: number;
  temp?: number;
  thermo?: boolean;
  /** заливка начата */
  started?: boolean;
  pumps?: number;
  wantPumps?: number;
}
/** Номер текущего шага подсказки и кнопка, которую подсветить (id из HIT окна станции). */
export function lessonStep(key: string, live: LiveState, ctx: { syrupKey?: string } = {}): { step: number; glow: string | null } {
  if (key === 'step:milk') {
    const ml = live.ml ?? 0;
    const line = live.line ?? 0;
    if (ml < line - 10) return { step: 0, glow: 'fillHold' };
    return { step: 1, glow: ml > line + 10 ? 'fillDump' : 'fillDone' };
  }
  if (key.startsWith('step:steam:')) {
    const [lo] = steamZone(live.thermo);
    const T = live.temp ?? STEAM.startTemp;
    if (T >= lo - 4) return { step: 2, glow: T >= lo ? 'steamDone' : null };
    const enough = (live.foam ?? 0) >= (live.targetFoam ?? 0) - 0.05 || T >= STEAM.airUntil;
    return { step: enough ? 1 : 0, glow: null };
  }
  if (key === 'step:pour') return { step: live.started ? 1 : 0, glow: live.started ? 'pourDone' : null };
  if (key === 'step:syrup') {
    const done = (live.pumps ?? 0) >= (live.wantPumps ?? 1);
    return { step: done ? 1 : 0, glow: done ? 'syrDone' : ctx.syrupKey ? `syr:${ctx.syrupKey}` : null };
  }
  return { step: 0, glow: null };
}

/** Подсказки по шагам для напитка (кнопка «Подсказка» в книге рецептов). */
export function lessonKeysOfDrink(drinkId: string): string[] {
  const d = drinkById[drinkId];
  if (!d) return [];
  const out: string[] = [];
  if (d.steps.some((x) => x.st === 'milk')) out.push('step:milk');
  if (d.steps.some((x) => x.st === 'steam')) out.push(`step:steam:${steamKind(drinkId)}`);
  if (d.steps.some((x) => x.st === 'steam') && d.steps.some((x) => x.st === 'pour' && !x.arg)) out.push('step:pour');
  return out;
}

/**
 * Старое сохранение (без метки v2): что игрок уже проходил, второй раз не показываем.
 * Напитки прошлых рангов и, если день не первый, напитки 1-го ранга считаются знакомыми; молоко и пар — если молоко куплено.
 */
export function migrateSeen(seen: readonly string[], p: { rank: number; day: number; served: number; milk: boolean }): string[] {
  if (seen.includes(SEEN_MARK)) return [...seen];
  const out = new Set(seen);
  for (const d of DRINKS) if (d.rank < p.rank || (d.rank === 1 && (p.day > 1 || p.served > 0))) out.add(drinkSeenKey(d.id));
  if (p.day > 1 || p.served > 0) out.add('step:syrup');
  if (p.milk) ['step:milk', 'step:pour', ...FOAM_KINDS.map((k) => `step:steam:${k}`)].forEach((k) => out.add(k));
  out.add(SEEN_MARK);
  return [...out];
}
