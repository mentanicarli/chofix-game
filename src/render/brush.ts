import { CanvasTextMetrics, Container, Graphics, Text, TextStyle } from 'pixi.js';

export const INK = '#4A2F25';
export const SOFT = '#7A5A4A';
export const BG = '#FBF1DF';
export const IW = 440;
export const IH = 450;

export interface Hit { id: string; x: number; y: number; w: number; h: number; hold: boolean; off: boolean }
export interface BtnOpts { size?: number; col?: string; hold?: boolean; off?: boolean; down?: boolean }
export type Align = 'left' | 'center' | 'right';
export type Pt = { x: number; y: number };

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Смешивание двух #RRGGBB в rgb(). */
export const mix = (a: string, b: string, u: number): string => {
  const x = hex(a);
  const y = hex(b);
  return 'rgb(' + x.map((v, i) => Math.round(v + ((y[i] as number) - v) * u)).join(',') + ')';
};

/**
 * Кисть кадра: примитивы инсета (текст, кнопка, пунктир, маска) поверх Pixi.
 * Каждый кадр сцена пересобирается; порядок слоёв — порядок вызовов, как на canvas.
 * По умолчанию штрихи с круглыми концами: так вели себя линии старого canvas.
 */
export class Brush {
  readonly root = new Container();
  /** Текущий слой для рисования. */
  g!: Graphics;
  readonly hits: Hit[] = [];
  private order: Container[] = [];
  private readonly segs: Graphics[] = [];
  private segUsed = 0;
  private readonly texts: Text[] = [];
  private textUsed = 0;

  begin(): void {
    this.hits.length = 0;
    this.order = [];
    this.segUsed = 0;
    this.textUsed = 0;
    this.segs.forEach((s) => {
      s.clear();
      s.mask = null;
    });
    this.next();
  }

  /** Заканчивает кадр: выставляет слои по порядку. */
  commit(): void {
    this.root.removeChildren();
    this.root.addChild(...this.order);
  }

  private seg(): Graphics {
    let s = this.segs[this.segUsed];
    if (!s) {
      s = new Graphics();
      this.segs[this.segUsed] = s;
    }
    this.segUsed++;
    return s;
  }
  private next(): Graphics {
    this.g = this.seg();
    this.order.push(this.g);
    return this.g;
  }

  /** Всё, что нарисует `draw`, обрезается по фигуре `shape` (аналог clip() на canvas). */
  clip(shape: (g: Graphics) => void, draw: () => void): void {
    const m = this.seg();
    shape(m);
    m.fill(0xffffff);
    this.order.push(m);
    const layer = this.seg();
    layer.mask = m;
    this.order.push(layer);
    this.g = layer;
    draw();
    this.next();
  }

  private readonly ascents = new Map<string, number>();
  private readonly slotKey: string[] = [];

  text(str: string, x: number, y: number, size: number, col: string = INK, align: Align = 'left', weight = 800): void {
    const i = this.textUsed++;
    let t = this.texts[i];
    if (!t) {
      t = new Text({ text: '', style: new TextStyle({ fontFamily: 'Nunito, sans-serif' }), resolution: 2 });
      this.texts[i] = t;
    }
    // Стиль и текст трогаем только при изменении: каждая запись пересоздаёт текстуру.
    const key = `${str}|${size}|${col}|${weight}`;
    if (this.slotKey[i] !== key) {
      this.slotKey[i] = key;
      const st = t.style as TextStyle;
      st.fontSize = size;
      st.fontWeight = String(weight) as TextStyle['fontWeight'];
      st.fill = col;
      t.text = str;
    }
    // Canvas рисует от алфавитной базовой линии, Pixi — от верха строки: сдвигаем на ascent (зависит только от шрифта).
    const ak = `${size}|${weight}`;
    let asc = this.ascents.get(ak);
    if (asc === undefined) {
      asc = CanvasTextMetrics.measureText('Нх', t.style as TextStyle).fontProperties.ascent;
      this.ascents.set(ak, asc);
    }
    t.anchor.set(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0);
    t.position.set(x, y - asc);
    this.order.push(t);
    // следующая фигура должна лечь поверх текста
    this.next();
  }

  line(x1: number, y1: number, x2: number, y2: number, col: string = INK, w = 3): void {
    this.g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: w, color: col, cap: 'round' });
  }

  /** Скруглённый прямоугольник: возвращает Graphics для .fill()/.stroke(). */
  rr(x: number, y: number, w: number, h: number, r: number): Graphics {
    return this.g.roundRect(x, y, w, h, r);
  }

  /** Круг: заливка и контур. */
  disc(x: number, y: number, r: number, fill: string | { color: string; alpha: number } | null, line?: { w: number; col: string }): void {
    if (fill) this.g.circle(x, y, r).fill(fill);
    if (line) this.g.circle(x, y, r).stroke({ width: line.w, color: line.col });
  }

  /** Многоугольник: заливка и контур. */
  shape(pts: number[], fill: string | { color: string; alpha: number } | null, line?: { w: number; col: string; join?: 'miter' | 'round' }): void {
    if (fill) this.g.poly(pts).fill(fill);
    if (line) this.g.poly(pts, true).stroke({ width: line.w, color: line.col, join: line.join ?? 'miter' });
  }

  /** Пунктир по ломаной: `shift` двигает узор вдоль пути (как lineDashOffset = −shift). */
  dashed(path: Pt[], on: number, off: number, shift: number, col: string, w: number, cap: 'round' | 'butt' = 'round'): void {
    const per = on + off;
    let d0 = ((shift % per) + per) % per; // позиция на узоре в начале пути
    d0 = -d0;
    let walked = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1] as Pt;
      const b = path[i] as Pt;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!len) continue;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      for (let s = Math.floor((walked + d0) / per) * per - d0; s < walked + len; s += per) {
        const s0 = Math.max(s, walked);
        const s1 = Math.min(s + on, walked + len);
        if (s1 > s0) this.g.moveTo(a.x + ux * (s0 - walked), a.y + uy * (s0 - walked)).lineTo(a.x + ux * (s1 - walked), a.y + uy * (s1 - walked));
      }
      walked += len;
    }
    this.g.stroke({ width: w, color: col, cap });
  }

  button(id: string, x: number, y: number, w: number, h: number, label: string, o: BtnOpts = {}): void {
    this.hits.push({ id, x, y, w, h, hold: !!o.hold, off: !!o.off });
    const down = !!o.hold && !!o.down && !o.off;
    const dy = down ? 3 : 0;
    const edge = o.off ? '#9B8574' : INK;
    if (!down) this.rr(x, y + 4, w, h, 14).fill(edge);
    this.rr(x, y + dy, w, h, 14).fill(o.off ? '#E3D6C0' : (o.col ?? '#E8B04A'));
    this.rr(x, y + dy, w, h, 14).stroke({ width: 3, color: edge });
    this.text(label, x + w / 2, y + h / 2 + 7 + dy, o.size ?? 18, o.off ? '#9B8574' : INK, 'center');
  }

  /** Фон инсета: заголовок и линия под ним (общие для всех станций). */
  frame(title: string): void {
    this.text(title, 22, 38, 24);
    this.line(22, 50, IW - 70, 50, 'rgba(74,47,37,.25)', 2);
  }
}
