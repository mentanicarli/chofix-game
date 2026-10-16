import { SECTION_NAMES, SECTION_ORDER, type SectionId, type SectionsOpen } from '../game/sections';

/** Ячейка мини-карты: открытые секции слева направо; текущая закрашена, точка — «нужная станция» (только при подсказках). */
export interface MiniCell { id: SectionId; cur: boolean; dot: boolean }

export function minimapCells(cur: SectionId, open: SectionsOpen, dot: SectionId | null): MiniCell[] {
  return SECTION_ORDER.filter((s) => open[s]).map((id) => ({ id, cur: id === cur, dot: id === dot }));
}

/** Подпись для скринридера: «Секции бара: сейчас Кофейный бар». */
export const minimapLabel = (cur: SectionId): string => `Секции бара: сейчас ${SECTION_NAMES[cur]}`;

/** Пустой контейнер: ячейки рисует `minimapFill`. Создаётся только когда листание включено. */
export function minimapHTML(): string {
  return '<div id="miniMap" role="img" hidden></div>';
}

export function minimapFill(cells: MiniCell[], cur: SectionId): string {
  return cells.map((c) => `<b class="${c.cur ? 'cur' : ''}" data-mm="${c.id}">${c.dot ? '<u></u>' : ''}</b>`).join('') + `<span hidden>${minimapLabel(cur)}</span>`;
}
