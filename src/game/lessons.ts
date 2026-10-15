import { DRINKS, STATIONS, drinkById } from './menu';
import { THICK } from './recipes';
import { recipeCard } from './recipeCard';
import { steamZoneOf } from './volumes';
import { TUTORIALS, equipmentName, tutorialEqs } from './tutorial';
import type { RecipeStep } from './types';

/* ---------- обучение по шагам и «Новый напиток» ----------
   Что уже показано, лежит в tutorialSeen (в сохранении) строками:
   `matcha` (станция), `drink:latte` (карточка напитка), `step:milk` / `step:steam:thin` / `step:pour` / `step:syrup` (шаги). */

/** Метка «сохранение уже знает про обучение по шагам». Без неё старое сохранение переносится один раз (migrateSeen). */
export const SEEN_MARK = 'v2';
/** Подсказки по шагам (кроме пара: у него ключ на вид пены). */
export const STEP_KEYS: readonly string[] = ['step:milk', 'step:pour', 'step:syrup', 'step:shots', 'step:pitcher'];
export const freshSeen = (): string[] => [SEEN_MARK];

/** Параметры пара. Должны совпадать с 07-bar-sim.js (steamDone, шаг пара) и steamView.ts; старт молока 8° задан в 06-bar.js.
    Зона температуры зависит от напитка (steamZoneOf в volumes.ts); zone/zoneThermo здесь — общая зона по умолчанию. */
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
  zone: [55, 62],
  zoneThermo: [53, 65]
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
  shot: { pitcher: 'сразу в питчер' },
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
export function newDrinkCard(drinkId: string, seen: readonly string[], foam?: number, size?: string): DrinkCard | null {
  const d = drinkById[drinkId];
  if (!d || seen.includes(drinkSeenKey(drinkId))) return null;
  const tip = d.steps.some((s) => s.st === 'steam') ? foamLine(steamKind(drinkId), foam) : '';
  const rc = recipeCard(drinkId, (size ?? Object.keys(d.sizes)[0]) as '0.2');
  const steps = rc ? rc.steps.map((x) => (x.detail ? `${x.label}: ${x.detail}` : x.label)) : recipeLines(drinkId);
  return { key: drinkSeenKey(drinkId), name: d.name, steps, tip };
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
  /** у рафа вместо молока сливки */
  cream?: boolean;
  /** шотов в заказе */
  shots?: number;
}

export interface Lesson {
  /** ключ в tutorialSeen */
  key: string;
  tag: string;
  title: string;
  /** где станция, когда окно ещё не открыто */
  where: string;
  steps: string[];
  /** короткая цель шага (≤ 45 символов) для строки над окном станции; у пошаговых подсказок по числу шагов */
  goals?: string[];
  /** показывать шаги по одному (текущий выбирает lessonStep); иначе списком целиком */
  paced: boolean;
}

const STEP_TAG = 'Новый шаг';
const steamZone = (drinkId: string, thermo?: boolean): readonly [number, number] => steamZoneOf(drinkId, !!thermo);
/** За сколько секунд пар доводит молоко до границ зелёной зоны. */
export function steamSeconds(drinkId: string, thermo?: boolean): [number, number] {
  const [lo, hi] = steamZone(drinkId, thermo);
  return [Math.round((lo - STEAM.startTemp) / STEAM.heatPerSec), Math.round((hi - STEAM.startTemp) / STEAM.heatPerSec)];
}

/** Ключи шагов (не оборудования) для задачи бара. */
export function stepKeysOf(task: string, drinkId: string, shots = 1): string[] {
  switch (task) {
    case 'grind': return shots > 1 ? ['step:shots'] : [];
    case 'shot': return drinkById[drinkId]?.family === 'raf' ? ['step:pitcher'] : [];
    case 'syrup': return ['step:syrup'];
    case 'milk': return ['step:milk'];
    case 'steam': return [`step:steam:${steamKind(drinkId)}`];
    case 'pour': return ['step:pour'];
    default: return [];
  }
}
/** Все подсказки задачи: сначала шаговые, потом по оборудованию. */
export const tutorialKeys = (task: string, drinkId: string, food?: { case: string; heat: boolean } | null, shots = 1): string[] => [...stepKeysOf(task, drinkId, shots), ...tutorialEqs(task, food)];
/** Какая подсказка нужна сейчас (первая не показанная). */
export const nextTutorial = (task: string, drinkId: string, food: { case: string; heat: boolean } | null | undefined, seen: readonly string[], shots = 1): string | null =>
  tutorialKeys(task, drinkId, food, shots).find((k) => !seen.includes(k)) ?? null;

/** Подсказка по ключу: станция (TUTORIALS) или шаг. */
export function lesson(key: string, c: LessonCtx): Lesson | null {
  const t = TUTORIALS[key];
  if (t) return { key, tag: 'Новая станция', title: equipmentName(key), where: t.where, steps: [...t.steps], paced: false };
  if (key === 'step:milk') {
    const until = c.ml ? `до линии: ${Math.round(c.ml)} мл` : 'до красной линии';
    const where = c.steam === false ? 'в стакане' : 'в питчере';
    if (c.cream)
      return {
        key, tag: STEP_TAG, title: 'Сливки', where: 'Нажмите на холодильник справа: кувшин сливок стоит там же.', paced: true,
        steps: [`Держите «Лить молоко со сливками» или Пробел, пока сливки ${where} не дойдут ${until}.`, 'Налили лишнее: «Вылить». Потом «Готово».'],
        goals: [`Сливки до линии: ${c.ml ? Math.round(c.ml) + ' мл' : 'красная черта'}`, 'Лишнее вылить, затем «Готово»']
      };
    return {
      key, tag: STEP_TAG, title: 'Молоко', where: 'Нажмите на холодильник справа.', paced: true,
      steps: [`Держите «Лить молоко (держите)» или Пробел, пока молоко ${where} не дойдёт ${until}.`, 'Налили лишнее: «Вылить». Потом «Готово».'],
      goals: [`Молоко до линии: ${c.ml ? Math.round(c.ml) + ' мл' : 'красная черта'}`, 'Лишнее вылить, затем «Готово»']
    };
  }
  if (key.startsWith('step:steam:')) {
    const kind = key.slice('step:steam:'.length) as FoamKind;
    if (!FOAM_KINDS.includes(kind)) return null;
    const [lo, hi] = steamZone(c.drinkId, c.thermo);
    const [s1, s2] = steamSeconds(c.drinkId, c.thermo);
    return {
      key, tag: STEP_TAG, title: 'Пар и пена', where: 'Нажмите на паровую трубку справа.', paced: true,
      steps: [
        `Воздух. Зажмите мышь, кончик трубки держите в жёлтой полосе у поверхности: пока молоко холоднее ${STEAM.airUntil}°, растёт пена.`,
        'Закрутите. Опустите трубку глубже: пена перестанет расти, молоко станет гладким и будет греться.',
        `Остановите. На зелёной зоне ${lo}–${hi}° (${s1}–${s2} с пара) отпустите мышь и нажмите «Готово». Выше ${STEAM.burnAt}° пригорает.`
      ],
      goals: [`Пена около ${Math.round((c.foam ?? THICK[kind] ?? 0.26) * 100)}%: у поверхности ${airTime(c.foam ?? THICK[kind] ?? 0.26)}`, 'Опустите трубку глубже', `Стоп на ${lo}–${hi}°, не выше ${STEAM.burnAt}°`]
    };
  }
  if (key === 'step:shots') {
    const n = c.shots && c.shots > 1 ? c.shots : 2;
    return {
      key, tag: STEP_TAG, title: n === 2 ? 'Два шота подряд' : 'Несколько шотов', where: 'Нажмите на кофемолку слева: шоты делаются по одному.', paced: true,
      steps: [
        'Первый шот: помол (около 9 г), темпер и шот 30 мл, как обычно. На билете он подписан «Шот 1/2».',
        'Второй шот такой же: снова помол, темпер и шот. Он попадает в ту же чашку. Подписан «Шот 2/2».'
      ],
      goals: ['Первый шот: помол, темпер, шот', 'Второй шот: так же, в ту же чашку']
    };
  }
  if (key === 'step:pitcher')
    return {
      key, tag: STEP_TAG, title: 'Эспрессо в питчер', where: 'Нажмите на кофемашину.', paced: true,
      steps: ['Классический раф: эспрессо льётся сразу в питчер, а не в чашку. Шот делается как обычно.', 'Дальше сливки, сироп (если просили), пар и заливка: всё взбивается вместе.'],
      goals: ['Шот льётся сразу в питчер', 'Дальше: сливки, пар, заливка']
    };
  if (key === 'step:pour')
    return {
      key, tag: STEP_TAG, title: 'Заливка и рисунок', where: 'Нажмите на чашку по центру.', paced: true,
      steps: ['Зажмите мышь над чашкой и ведите по контуру рисунка: молоко льётся, пока вы водите.', 'Когда питчер опустеет, напиток готов. Закончить раньше можно кнопкой «Готово».'],
      goals: ['Ведите мышью по контуру рисунка', 'Питчер пуст: напиток готов']
    };
  if (key === 'step:syrup') {
    const what = c.syrupName ? `${c.syrupName.toLowerCase()} ×${c.pumps ?? 1}` : 'сколько просил гость (написано на тикете)';
    return {
      key, tag: STEP_TAG, title: 'Сироп', where: 'Нажмите на полку с сиропами вверху.', paced: true,
      steps: [`Нажмите на бутылку нужного сиропа: одно нажатие это одна порция. Нужно: ${what}.`, 'Нажмите «Готово». Ошиблись: «Вылить».'],
      goals: [`Сироп: ${what}`, 'Нажмите «Готово»']
    };
  }
  return null;
}

/** Короткая цель текущего шага или null (строка над окном станции, чтобы не отводить взгляд от питчера). */
export function lessonGoal(key: string, c: LessonCtx, step: number): string | null {
  const l = lesson(key, c);
  return l && l.goals ? l.goals[Math.min(step, l.goals.length - 1)] ?? null : null;
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
  /** зона пара напитка (с учётом питчера с термометром) */
  zone?: readonly [number, number];
  /** номер текущего шота и их число */
  shotIdx?: number;
}
/** Номер текущего шага подсказки и кнопка, которую подсветить (id из HIT окна станции). */
export function lessonStep(key: string, live: LiveState, ctx: { syrupKey?: string } = {}): { step: number; glow: string | null } {
  if (key === 'step:shots') return { step: (live.shotIdx ?? 1) >= 2 ? 1 : 0, glow: null };
  if (key === 'step:pitcher') return { step: 0, glow: null };
  if (key === 'step:milk') {
    const ml = live.ml ?? 0;
    const line = live.line ?? 0;
    if (ml < line - 10) return { step: 0, glow: 'fillHold' };
    return { step: 1, glow: ml > line + 10 ? 'fillDump' : 'fillDone' };
  }
  if (key.startsWith('step:steam:')) {
    const [lo] = live.zone ?? steamZone('', live.thermo);
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
  if (d.family === 'raf') out.push('step:pitcher');
  if (d.shots === 'size' || (typeof d.shots === 'number' && d.shots > 1)) out.push('step:shots');
  if (d.steps.some((x) => x.st === 'milk' || x.st === 'cream')) out.push('step:milk');
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
