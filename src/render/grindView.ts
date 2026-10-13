import { INK, SOFT, type Brush } from './brush';

export interface GrindView {
  set: number;
  ideal: number;
  pro: boolean;
  hold: boolean;
  done: boolean;
  dose: number;
  target: number;
  now: number;
}
const f1 = (v: number): string => v.toFixed(1).replace('.', ',');

export function drawGrind(b: Brush, v: GrindView): void {
  // диск настройки
  b.disc(106, 150, 58, '#F3E4CB', { w: 3, col: INK });
  for (let i = 1; i <= 5; i++) {
    const a = ((-100 + (i - 1) * 50) * Math.PI) / 180;
    b.line(106 + Math.sin(a) * 44, 150 - Math.cos(a) * 44, 106 + Math.sin(a) * 54, 150 - Math.cos(a) * 54, INK, i === v.set ? 5 : 2.5);
  }
  const ang = ((-100 + (v.set - 1) * 50) * Math.PI) / 180;
  b.disc(106, 150, 30, '#E8B04A', { w: 3, col: INK });
  b.line(106, 150, 106 + Math.sin(ang) * 26, 150 - Math.cos(ang) * 26, INK, 4);
  b.text(String(v.set), 106, 160, 28, INK, 'center');
  b.text('Помол', 106, 232, 14, SOFT, 'center');
  b.text('мельче', 44, 252, 13, SOFT, 'center');
  b.text('крупнее', 168, 252, 13, SOFT, 'center');
  b.button('dialL', 30, 262, 52, 38, '◀', { col: '#F3E4CB' });
  b.button('dialR', 130, 262, 52, 38, '▶', { col: '#F3E4CB' });
  if (v.pro) b.text('Рекомендуем: ' + v.ideal, 106, 318, 14, '#4F7A3E', 'center');
  // портафильтр и горка (сдвиг по x на 296)
  const X = 296;
  b.shape([X - 34, 66, X + 34, 66, X + 14, 128, X - 14, 128], '#C9C8C0', { w: 3, col: INK, join: 'round' });
  b.rr(X - 12, 126, 24, 22, 5).fill('#B9B9B2');
  b.rr(X - 12, 126, 24, 22, 5).stroke({ width: 3, color: INK, join: 'round' });
  if (v.hold && !v.done) b.dashed([{ x: X, y: 148 }, { x: X, y: 200 - Math.min(70, v.dose * 2.4) }], 4, 5, v.now / 40, '#6B4331', 6);
  b.shape([X - 56, 202, X + 56, 202, X + 44, 240, X - 44, 240], '#C9C8C0', { w: 3, col: INK, join: 'round' });
  const hh = Math.min(64, v.dose * 2.2);
  b.g.moveTo(X - 50, 202).quadraticCurveTo(X, 202 - hh * 1.6, X + 50, 202).fill('#6B4331');
  b.g.moveTo(X - 50, 202).quadraticCurveTo(X, 202 - hh * 1.6, X + 50, 202).stroke({ width: 3, color: INK, join: 'round', cap: 'round' });
  b.line(X + 54, 218, X + 112, 228, INK, 14);
  b.line(X + 54, 218, X + 112, 228, '#6B4C3D', 8);
  // весы
  const e = Math.abs(v.dose - v.target);
  const col = e <= 0.5 ? '#7BC46A' : e <= 1.5 ? '#E8B04A' : '#E0745A';
  b.rr(220, 252, 190, 54, 12).fill('#2F2A27');
  b.rr(220, 252, 190, 54, 12).stroke({ width: 3, color: INK });
  b.text(f1(v.dose) + ' г', 396, 292, 32, col, 'right');
  b.text('цель ' + v.target, 236, 290, 14, '#BFB5A5');
  if (v.dose > v.target + 1.6 && !v.done) b.button('dump', 220, 312, 190, 30, 'Высыпать (−₽ 5)', { size: 14, col: '#F0B3A0' });
  b.button('grindHold', 30, 356, 250, 56, 'Молоть (держите)', { hold: true, col: '#C98B5A', down: v.hold });
  b.button('grindDone', 296, 356, 114, 56, 'Готово', { col: '#B9CAA9' });
}
