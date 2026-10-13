import { INK, SOFT, type Brush } from './brush';

export interface TampView {
  phase: 'level' | 'press';
  press: number;
  uneven: number;
  hold: boolean;
  mx: number;
  my: number;
  wide: boolean;
  seeds: { a: number; r: number; s: number; t: number }[];
}

export function drawTamp(b: Brush, v: TampView): void {
  const cx = 220;
  const cy = 190;
  b.disc(cx, cy, 126, '#BFC4C2', { w: 3, col: INK });
  b.disc(cx, cy, 112, v.phase === 'press' && v.press > 4 ? '#4A2E20' : '#5A3A2A');
  if (v.phase === 'level') {
    b.clip((g) => g.circle(cx, cy, 112), () => {
      v.seeds.forEach((s) => {
        const col = s.t === 0 ? `rgba(120,80,56,${v.uneven * 0.9})` : s.t === 1 ? `rgba(36,20,14,${v.uneven * 0.8})` : `rgba(156,110,78,${v.uneven * 0.7})`;
        b.g.circle(cx + Math.cos(s.a) * s.r, cy + Math.sin(s.a) * s.r, s.s * (0.4 + v.uneven * 0.6)).fill(col);
      });
    });
  } else b.g.circle(cx, cy, 100).stroke({ width: 4, color: 'rgba(255,255,255,.12)' });
  if (v.phase === 'level') {
    b.rr(60, 336, 320, 14, 7).fill('#E7D6BC');
    b.rr(60, 336, 320, 14, 7).stroke({ width: 2.5, color: INK });
    const w = Math.max(14, 320 * (1 - v.uneven));
    b.rr(60, 336, w, 14, 7).fill('#93A684');
    b.rr(60, 336, w, 14, 7).stroke({ width: 2.5, color: INK });
    b.text('Ровность кофе', 60, 330, 14, SOFT);
    if (v.hold) b.disc(v.mx, v.my, 14, null, { w: 3, col: 'rgba(255,248,236,.9)' });
    b.text('Зажмите и водите мышью по кофе', 220, 392, 17, SOFT, 'center', 700);
    return;
  }
  const P = v.press;
  b.disc(cx, cy, 74 + (P > 0 ? 6 : 0) - P * 0.4, 'rgba(190,196,194,.92)', { w: 3, col: INK });
  b.disc(cx, cy, 26, '#3F3A36', { w: 3, col: INK });
  // шкала давления (штрих у неё тонкий и бледный — так было на старом canvas)
  const gx = 398;
  const gy0 = 80;
  const gh = 232;
  const edge = { width: 2, color: 'rgba(74,47,37,.25)' };
  b.rr(gx - 12, gy0, 24, gh, 12).fill('#E7D6BC');
  b.rr(gx - 12, gy0, 24, gh, 12).stroke(edge);
  const y = (val: number) => gy0 + gh - (val / 32) * gh;
  const zw = v.wide ? 5 : 3.5;
  b.rr(gx - 12, y(15 + zw), 24, y(15 - zw) - y(15 + zw), 6).fill('#93A684');
  b.rr(gx - 12, y(15 + zw), 24, y(15 - zw) - y(15 + zw), 6).stroke(edge);
  b.line(gx - 22, y(P), gx + 22, y(P), '#C4694A', 5);
  b.text(Math.round(P) + ' кг', gx, gy0 + gh + 24, 16, INK, 'center');
  b.button('tampHold', 30, 356, 360, 56, 'Прессовать (держите)', { hold: true, col: '#C98B5A', down: v.hold });
}
