import { Mesh, MeshGeometry, Rectangle, Sprite, Texture } from 'pixi.js';
import type { Atlas } from './svg';

/**
 * Лента: заготовка из атласа (прямая вдоль оси x), протянутая по ломаной линии.
 * Так рука или нога изгибается в локте и колене без швов, а нарисованный контур остаётся целым.
 */
export class Ribbon extends Mesh {
  private readonly n: number;
  private readonly half: number;
  private readonly buf;

  /**
   * @param atlas общий атлас, frame — клетка заготовки (в пикселях атласа)
   * @param us доля длины заготовки (0..1) для каждой точки ломаной
   * @param half половина толщины ленты в логических пикселях
   */
  constructor(atlas: Atlas, id: string, us: readonly number[], half: number) {
    const fr = atlas.frames.get(id);
    if (!fr) throw new Error('ribbon: нет клетки ' + id);
    const n = us.length;
    const aw = atlas.tex.source.pixelWidth;
    const ah = atlas.tex.source.pixelHeight;
    const uvs = new Float32Array(n * 4);
    us.forEach((u, i) => {
      const uu = (fr.x + u * fr.w) / aw;
      uvs[i * 4] = uu;
      uvs[i * 4 + 1] = fr.y / ah;
      uvs[i * 4 + 2] = uu;
      uvs[i * 4 + 3] = (fr.y + fr.h) / ah;
    });
    const idx = new Uint32Array((n - 1) * 6);
    for (let i = 0; i < n - 1; i++) {
      const k = i * 2;
      idx.set([k, k + 1, k + 2, k + 2, k + 1, k + 3], i * 6);
    }
    const geometry = new MeshGeometry({ positions: new Float32Array(n * 4), uvs, indices: idx });
    super({ geometry, texture: atlas.tex });
    this.n = n;
    this.half = half;
    this.buf = geometry.getBuffer('aPosition');
    this.eventMode = 'none';
  }

  /** Ломаная: x0,y0,x1,y1… (n точек). */
  set(p: ArrayLike<number>): void {
    const d = this.buf.data as Float32Array;
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let tx = (p[b * 2] as number) - (p[a * 2] as number);
      let ty = (p[b * 2 + 1] as number) - (p[a * 2 + 1] as number);
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const px = -ty * this.half;
      const py = tx * this.half;
      const x = p[i * 2] as number;
      const y = p[i * 2 + 1] as number;
      d[i * 4] = x + px;
      d[i * 4 + 1] = y + py;
      d[i * 4 + 2] = x - px;
      d[i * 4 + 3] = y - py;
    }
    this.buf.update();
  }
}

/** Спрайт из кадра атласа с точкой вращения в начале координат клетки (кисть, ступня и т. п.). */
export function frameSprite(atlas: Atlas, id: string, anchorX: number, anchorY: number): Sprite {
  const fr = atlas.frames.get(id);
  if (!fr) throw new Error('frameSprite: нет клетки ' + id);
  const t = new Texture({ source: atlas.tex.source, frame: new Rectangle(fr.x, fr.y, fr.w, fr.h) });
  const s = new Sprite(t);
  s.width = fr.box.w;
  s.height = fr.box.h;
  s.position.set(0, 0);
  s.pivot.set((anchorX - fr.box.x) * (t.width / fr.box.w), (anchorY - fr.box.y) * (t.height / fr.box.h));
  return s;
}
