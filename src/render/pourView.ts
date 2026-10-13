import { INK, SOFT, clamp, mix, type Brush, type Pt } from './brush';

export interface PourView {
  level: number;
  blobs: { x: number; y: number; r: number; a: number }[];
  guide: Pt[] | null;
  hold: boolean;
  mx: number;
  my: number;
  started: boolean;
}

export function drawPour(b: Brush, v: PourView): void {
  const cx = 220;
  const cy = 205;
  b.disc(cx, cy + 7, 144, 'rgba(74,47,37,.15)');
  b.disc(cx, cy, 140, '#FFF8EC', { w: 3, col: INK });
  const milk = mix('#9C6B45', '#C99B6E', clamp(v.level, 0, 1));
  b.disc(cx, cy, 128, milk, { w: 3, col: INK });
  b.clip((g) => g.circle(cx, cy, 127), () => {
    // Пока пена не измерена, у капли нет прозрачности: canvas тогда оставлял прежний цвет заливки — повторяем.
    let col = milk;
    v.blobs.forEach((o) => {
      if (Number.isFinite(o.a)) col = `rgba(253,248,238,${(o.a * 0.55).toFixed(2)})`;
      b.g.circle(o.x, o.y, o.r).fill(col);
    });
  });
  if (v.guide) b.dashed(v.guide, 5, 7, 0, 'rgba(74,47,37,.35)', 2.5);
  if (v.hold) {
    const c = Math.cos(0.5);
    const s = Math.sin(0.5);
    const tx = v.mx + 6;
    const ty = v.my - 40;
    const pts = [-26, -34, 26, -34, 20, 20, -20, 20];
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] as number;
      const y = pts[i + 1] as number;
      out.push(tx + x * c - y * s, ty + x * s + y * c);
    }
    b.shape(out, '#C9C8C0', { w: 3, col: INK });
  }
  b.text('Чашка', 30, 372, 14, SOFT);
  b.rr(30, 380, 250, 12, 6).fill('#E7D6BC');
  b.rr(30, 380, 250, 12, 6).stroke({ width: 2.5, color: INK });
  const w = Math.max(10, 250 * v.level);
  b.rr(30, 380, w, 12, 6).fill('#C9A982');
  b.rr(30, 380, w, 12, 6).stroke({ width: 2.5, color: INK });
  b.text(v.started ? 'Ведите по контуру' : 'Зажмите мышь над чашкой', 30, 424, 15, SOFT, 'left', 700);
  b.button('pourDone', 296, 366, 114, 56, 'Готово', { col: '#B9CAA9' });
}
