import type { Brush } from './brush';
import { INK, SOFT } from './brush';

export interface SyrupView {
  need: string;
  list: { key: string; short: string; col: string }[];
  /** Выбранная в чашке бутылка. */
  inCup: { key: string; name: string } | null;
  pumps: number;
}

export function drawSyrup(b: Brush, v: SyrupView): void {
  b.text(v.need, 22, 74, 17, SOFT);
  const cw = 120;
  const ch = 44;
  v.list.forEach((s, i) => {
    const x = 22 + (i % 3) * (cw + 8);
    const y = 90 + Math.floor(i / 3) * (ch + 6);
    const on = v.inCup?.key === s.key && v.pumps > 0;
    b.hits.push({ id: 'syr:' + s.key, x, y, w: cw, h: ch, hold: false, off: false });
    b.rr(x, y, cw, ch, 12).fill(on ? '#F8E3B5' : '#FFF8EC');
    b.rr(x, y, cw, ch, 12).stroke({ width: on ? 4 : 3, color: INK });
    b.g.circle(x + 21, y + ch / 2, 12).fill(s.col);
    b.g.circle(x + 21, y + ch / 2, 12).stroke({ width: 2.5, color: INK });
    b.text(s.short, x + 40, y + ch / 2 + 5, 14, INK);
  });
  b.text(v.pumps ? `В чашке: ${v.inCup?.name.toLowerCase() ?? ''} ×${v.pumps}` : 'Нажмите на бутылку: одно нажатие — одна порция', 22, 372, 15, INK);
  b.button('syrDump', 22, 384, 118, 48, 'Вылить', { size: 16, col: '#F0B3A0', off: !v.pumps });
  b.button('syrDone', 296, 384, 122, 48, 'Готово', { col: '#B9CAA9', off: !v.pumps });
}
