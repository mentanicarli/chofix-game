import type { Brush } from './brush';
import { INK, SOFT } from './brush';

export interface FillView {
  kind: 'water' | 'milk' | 'ice';
  /** Объём в стакане, мл (для воды — только долитая вода). */
  ml: number;
  /** Эспрессо под водой, мл. */
  espresso: number;
  /** Линия «нужно», мл от дна. */
  line: number;
  holding: boolean;
  label: string;
  /** performance.now() для анимации струи. */
  now: number;
}

const GX = 90;
const GY = 80;
const GW = 140;
const GH = 250;

export function drawFill(b: Brush, v: FillView): void {
  const k = v.kind;
  /* шкала растёт с размером напитка: линия «нужно» всегда в верхней трети стакана */
  const cap = k === 'milk' ? Math.max(330, v.line * 1.3) : Math.max(200, v.line * 1.35);
  const my = (ml: number) => GY + GH - (ml / cap) * GH;
  const inset = (y: number) => (14 * (y - GY)) / GH;
  const left = (y: number) => GX + inset(y);
  const right = (y: number) => GX + GW - inset(y);
  const band = (y1: number, y2: number, col: string) =>
    b.g.poly([left(y1), y1, right(y1), y1, right(y2), y2, left(y2), y2]).fill(col);

  // стакан и жидкость (обрезка по трапеции считается геометрией, без маски)
  b.g.poly([GX, GY, GX + GW, GY, GX + GW - 14, GY + GH, GX + 14, GY + GH]).fill(k === 'milk' ? { color: '#C8C8C2', alpha: 0.5 } : '#FFF8EC');
  const bottom = GY + GH;
  if (k === 'water') {
    band(my(v.espresso), bottom, '#4A2E20');
    band(my(v.espresso + v.ml), my(v.espresso), '#8A5B3A');
  } else band(my(v.ml), bottom, k === 'ice' ? '#DCEEF1' : '#FBF4E8');
  b.g.poly([GX, GY, GX + GW, GY, GX + GW - 14, GY + GH, GX + 14, GY + GH], true).stroke({ width: 3, color: INK, join: 'miter' });
  if (k === 'milk') b.line(GX + GW, GY + 30, GX + GW + 44, GY + 30, INK, 5);
  if (v.holding) {
    const end = my(k === 'water' ? v.espresso + v.ml : v.ml);
    b.dashed([{ x: GX + GW / 2, y: 54 }, { x: GX + GW / 2, y: end }], 6, 5, v.now / 25, k === 'milk' ? '#FBF4E8' : k === 'ice' ? '#CFE6EA' : '#9FC3C7', 7);
  }
  // линия «нужно»
  const ty = my(v.line);
  for (let x = GX - 14; x < GX + GW + 14; x += 14) b.g.moveTo(x, ty).lineTo(Math.min(x + 8, GX + GW + 14), ty);
  b.g.stroke({ width: 3.5, color: '#C4694A', cap: 'round' });
  b.text('линия', GX - 18, ty + 5, 14, '#C4694A', 'right');
  const unit = k === 'ice' ? ' г' : ' мл';
  b.text(`${Math.round(k === 'water' ? v.espresso + v.ml : v.ml)}${unit}`, 396, 140, 38, INK, 'right');
  b.text(`нужно ${Math.round(v.line)}${unit}`, 396, 168, 17, SOFT, 'right');
  if (k === 'milk') b.button('fillDump', 270, 200, 130, 34, 'Вылить', { size: 15, col: '#F0B3A0' });
  b.button('fillHold', 30, 356, 250, 56, v.label, { hold: true, col: k === 'water' || k === 'ice' ? '#9FC3C7' : '#C98B5A', size: 17, down: v.holding });
  b.button('fillDone', 296, 356, 114, 56, 'Готово', { col: '#B9CAA9' });
}
