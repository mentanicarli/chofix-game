import PAL from '../../../art-src/palette.json';

/**
 * Общий источник толщин и цветов для Pixi-кода (чашка в баре, чашка гостя): `art-src/palette.json`, тот же файл читает scripts/art-build.mjs.
 * Толщины заданы на экране (3,5 / 3 / 2 px); у предмета, растущего вместе с гостем, в исходнике они делятся на масштаб (`strokeAt(GUEST_K)`).
 */
export const STROKE = PAL.stroke as { L: number; M: number; D: number };
export const strokeAt = (scale: number): { L: number; M: number; D: number } => ({
  L: +(STROKE.L / scale).toFixed(2),
  M: +(STROKE.M / scale).toFixed(2),
  D: +(STROKE.D / scale).toFixed(2)
});
export type PaletteName = keyof typeof PAL.colors;
/** Цвет палитры числом для Pixi. */
export const pc = (name: PaletteName): number => parseInt(PAL.colors[name].slice(1), 16);
/** Стекло стакана: заливка и непрозрачность (белый 18 %). */
export const GLASS_FILL = { color: parseInt(PAL.glass.fill.slice(1), 16), alpha: PAL.glass.alpha };
