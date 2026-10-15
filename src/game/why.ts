import { DRINKS, drinkById } from './menu';
import { WHY_TEXTS } from './content';

/* ---------- экраны «Зачем это нужно» ----------
   Ключи `why:*` лежат в tutorialSeen. Тексты — docs/content/guide.md (часть 2). Показываются один раз:
   станция при первом открытии окна, механика при первом заказе, где она есть. */

/** Метка «сохранение знает про экраны “Зачем”». Без неё старое сохранение переносится один раз (migrateSeen). */
export const WHY_MARK = 'v3';
/** Экран «Как листать» нужен только секциям бара (Б1); имя зарезервировано, текст и показ в К2 не делаются. */
export const WHY_SECTIONS = 'why:sections';
export const WHY_KEYS: readonly string[] = Object.keys(WHY_TEXTS);
export const isWhyKey = (k: string): boolean => k.startsWith('why:');

/** Окно станции → экран. Для заказов с особой механикой (раф, слои, топпинг, два шота) см. whyOfOrder. */
const INSET_WHY: Readonly<Record<string, string>> = {
  grind: 'why:grind', tamp: 'why:tamp', shot: 'why:shot', water: 'why:water', milk: 'why:milk', steam: 'why:steam', pour: 'why:pour', syrup: 'why:syrup', ice: 'why:ice',
  whisk: 'why:matcha', brew: 'why:brew', juice: 'why:juice', tonic: 'why:juice', powder: 'why:powder', foam: 'why:foam', whip: 'why:whip', blend: 'why:blend', boba: 'why:boba', shake: 'why:shake'
};
/** Оборудование из магазина → экран его станции. */
const EQ_WHY: Readonly<Record<string, string>> = {
  ice: 'why:ice', matcha: 'why:matcha', tea: 'why:brew', juice: 'why:juice', powders: 'why:powder', foamer: 'why:foam', whipper: 'why:whip', blender: 'why:blend', boba: 'why:boba', shaker: 'why:shake', cream: 'why:cream'
};

const steamArg = (drinkId: string): string | null => {
  const s = drinkById[drinkId]?.steps.find((x) => x.st === 'steam');
  return s ? (s.arg ?? 'thin') : null;
};

/** Экран для окна станции или null. cream: окно молока на самом деле кувшин сливок (раф). */
export function whyOfInset(mode: string, ctx: { drinkId: string; cream?: boolean }): string | null {
  if (mode === 'milk' && ctx.cream) return 'why:cream';
  if (mode === 'pour') return steamArg(ctx.drinkId) !== null ? 'why:pour' : null;
  return INSET_WHY[mode] ?? null;
}

/** Первый заказ напитка с другим видом пены, чем у уже виденных: капучино, потом латте и т. д. */
export function foamContrast(drinkId: string, seen: readonly string[]): boolean {
  const mine = steamArg(drinkId);
  if (mine === null) return false;
  return DRINKS.some((d) => d.id !== drinkId && seen.includes(`drink:${d.id}`) && steamArg(d.id) !== null && steamArg(d.id) !== mine);
}

/** Экраны, которые нужны с самого заказа (механика, а не станция), в порядке показа. Показанные не возвращаются. */
export function whyOfOrder(drinkId: string, shots: number, seen: readonly string[]): string[] {
  const d = drinkById[drinkId];
  if (!d) return [];
  const out: string[] = [];
  if (d.family === 'raf') out.push('why:cream');
  if (shots > 1) out.push('why:shots');
  if (d.steps.some((s) => s.st === 'pour' && s.arg === 'layer')) out.push('why:layer');
  if (d.steps.some((s) => s.st === 'topping')) out.push('why:topping');
  if (foamContrast(drinkId, seen)) out.push('why:steam-foam');
  return out.filter((k) => !seen.includes(k));
}

const maxShots = (drinkId: string): number => {
  const s = drinkById[drinkId]?.shots;
  return s === 'size' ? 2 : (s ?? 1);
};

/**
 * Что из «Зачем» игрок уже видел по старому сохранению или по настройкам песочницы: всё, что открыто рангом или куплено.
 * played: хотя бы одна смена пройдена (кофемолка, темпер, шот, сироп, вода); milk: куплено молоко; eqs: id оборудования без eq_; drinkIds: напитки, которые считаются знакомыми.
 */
export function whySeenOf(p: { played: boolean; milk: boolean; eqs: readonly string[]; drinkIds: readonly string[] }): string[] {
  const out = new Set<string>();
  if (p.played) ['why:grind', 'why:tamp', 'why:shot', 'why:syrup', 'why:water'].forEach((k) => out.add(k));
  if (p.milk) ['why:milk', 'why:steam', 'why:pour'].forEach((k) => out.add(k));
  for (const e of p.eqs) if (EQ_WHY[e]) out.add(EQ_WHY[e] as string);
  const known = p.drinkIds.map((id) => `drink:${id}`);
  for (const id of p.drinkIds) {
    whyOfOrder(id, maxShots(id), []).forEach((k) => out.add(k));
    if (foamContrast(id, known)) out.add('why:steam-foam');
  }
  return [...out];
}
