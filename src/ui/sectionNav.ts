import { SECTION_NAMES, moveTarget, type SectionId, type SectionsOpen } from '../game/sections';

/** Стрелка перехода между секциями: куда ведёт и что написано. */
export interface NavArrow { dir: -1 | 1; to: SectionId; label: string }

/** Какие стрелки показать в секции `section` при открытых `open` (слева — левая соседняя, справа — правая; закрытых нет). */
export function navArrows(section: SectionId, open: SectionsOpen): NavArrow[] {
  return ([-1, 1] as const).flatMap((dir) => {
    const to = moveTarget(section, dir, open);
    return to ? [{ dir, to, label: SECTION_NAMES[to] }] : [];
  });
}

/** Разметка двух кнопок (скрыты, пока нет секции для стрелки). Создаётся только когда листание включено. */
export function sectionNavHTML(): string {
  const btn = (dir: -1 | 1): string => `<button type="button" class="secNavBtn ${dir < 0 ? 'l' : 'r'}" data-secnav="${dir}" hidden></button>`;
  return `<div id="secNav">${btn(-1)}${btn(1)}</div>`;
}

/** Содержимое кнопки: стрелка у края сцены и название секции. */
export function navLabelHTML(a: NavArrow): string {
  return a.dir < 0 ? `<span aria-hidden="true">◀</span> ${a.label}` : `${a.label} <span aria-hidden="true">▶</span>`;
}
