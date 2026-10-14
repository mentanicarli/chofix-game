import { INK, SOFT, clamp, mix, type Brush } from './brush';

export interface ShotView {
  ml: number;
  t: number;
  state: 'idle' | 'run' | string;
  locked: boolean;
  target: number;
  lastShot: number | null;
  /** «1/2» у двойного эспрессо и крупных размеров, иначе пусто */
  idx?: string;
  now: number;
}
const f1 = (v: number): string => v.toFixed(1).replace('.', ',');

export function drawShot(b: Brush, v: ShotView): void {
  const gx = 110;
  const gy = 96;
  const gw = 100;
  const gh = 220;
  const my = (ml: number) => gy + gh - (ml / 54) * gh;
  const inset = (y: number) => (8 * (y - gy)) / gh;
  const band = (y1: number, y2: number, col: string) => b.g.poly([gx + inset(y1), y1, gx + gw - inset(y1), y1, gx + gw - inset(y2), y2, gx + inset(y2), y2]).fill(col);
  const glass = [gx, gy, gx + gw, gy, gx + gw - 8, gy + gh, gx + 8, gy + gh];
  b.shape(glass, 'rgba(214,232,230,.55)');
  if (v.ml > 0) {
    band(my(v.ml), gy + gh, mix('#4A2E20', '#C99B6E', clamp((v.t - 14) / 24, 0, 1)));
    band(my(v.ml), my(v.ml) + 7, '#B07A4F');
  }
  b.shape(glass, null, { w: 3, col: INK });
  if (v.state === 'run') b.dashed([{ x: gx + gw / 2, y: 60 }, { x: gx + gw / 2, y: my(v.ml) }], 5, 5, v.now / 30, '#5A3A2A', 5);
  b.rr(gx + gw / 2 - 20, 54, 40, 14, 5).fill('#B9B9B2');
  b.rr(gx + gw / 2 - 20, 54, 40, 14, 5).stroke({ width: 3, color: INK });
  const ty = my(v.target);
  b.dashed([{ x: gx - 18, y: ty }, { x: gx + gw + 18, y: ty }], 8, 6, 0, '#C4694A', 3.5);
  b.text(v.target + ' мл', gx - 22, ty + 5, 15, '#C4694A', 'right');
  b.text(f1(v.t) + ' с', 396, 128, 40, INK, 'right');
  b.text(Math.round(v.ml) + ' мл', 396, 160, 22, SOFT, 'right');
  if (v.idx) b.text('Шот ' + v.idx, 396, 100, 18, SOFT, 'right');
  const bx0 = 250;
  const bw = 150;
  b.rr(bx0, 186, bw, 16, 8).fill('#E7D6BC');
  b.rr(bx0, 186, bw, 16, 8).stroke({ width: 2.5, color: INK });
  const tx = (t: number) => bx0 + clamp(t / 45, 0, 1) * bw;
  b.rr(tx(24), 186, tx(33) - tx(24), 16, 4).fill('#93A684');
  b.rr(tx(24), 186, tx(33) - tx(24), 16, 4).stroke({ width: 2.5, color: INK });
  b.line(tx(v.t), 180, tx(v.t), 208, '#C4694A', 4);
  b.text('идеальное время 24–33 с', 400, 226, 13, SOFT, 'right');
  if (v.lastShot != null) b.text('Прошлый шот: ' + Math.round(v.lastShot) + ' с', 400, 250, 13, SOFT, 'right');
  if (!v.locked) b.button('lock', 30, 356, 380, 56, 'Вставить портафильтр', { col: '#C98B5A' });
  else if (v.state === 'idle') b.button('go', 30, 356, 380, 56, 'Запустить шот (Пробел)', { col: '#93A684' });
  else if (v.state === 'run') b.button('stopShot', 30, 356, 380, 56, 'Остановить шот (Пробел)', { col: '#E0745A' });
}
