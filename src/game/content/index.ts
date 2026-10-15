// Тексты К1 (docs/content/*.md) для игры. Сами данные генерирует npm run content.
import { DRINK_TEXTS, GLOSSARY, type DrinkText, type GlossaryTerm } from './generated';

export * from './generated';

export const drinkText = (id: string): DrinkText | null => DRINK_TEXTS[id] ?? null;

/** В источнике шаг про второй шот написан для всех размеров сразу («С 0,4 л шотов два: …»). Для выбранного размера оставляем только то, что верно. */
const SHOTS_NOTE = /\s*С 0,4 л шотов два: повторите помол, темпер и шот\./;
export function stepsForShots(steps: readonly string[], shots: number): string[] {
  return steps.map((s) => (SHOTS_NOTE.test(s) ? s.replace(SHOTS_NOTE, shots > 1 ? ' Шота два: повторите помол, темпер и шот.' : '') : s));
}

/** Термины справочника по группам в порядке источника. */
export function glossaryGroups(): { group: string; terms: GlossaryTerm[] }[] {
  const out: { group: string; terms: GlossaryTerm[] }[] = [];
  for (const t of GLOSSARY) {
    let g = out.find((x) => x.group === t.group);
    if (!g) out.push((g = { group: t.group, terms: [] }));
    g.terms.push(t);
  }
  return out;
}
