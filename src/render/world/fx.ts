import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { ModelRef } from '../../game/drinkModel';
import { cupTexture } from './cupTex';
import { canvasTexture } from './svg';

const INK = '#4A2F25';

export interface Particle {
  kind?: string;
  t?: number;
  life: number;
  x?: number; y?: number; vx?: number; vy?: number; g?: number;
  r?: number; grow?: number; a?: number; col?: string;
  x0?: number; y0?: number; tx?: number; ty?: number; arc?: number;
  /** масштаб летящей чашки (по объёму напитка) */
  cs?: number;
  /** модель напитка: летящая чашка рисуется ею (Н2-4), без неё остаётся простая чашка */
  model?: ModelRef | null;
  /** внутреннее: спрайт частицы */
  _s?: Sprite | Graphics;
  /** внутреннее: спрайт чашки-модели */
  _m?: Container;
}
type P = Required<Pick<Particle, 'life'>> & Particle & { t: number; x: number; y: number; vx: number; vy: number; g: number; r: number; grow: number; a: number; col: string; kind: string };

const rgb = (c: string): number => {
  const [r = 255, g = 255, b = 255] = c.split(',').map(Number);
  return (r << 16) | (g << 8) | b;
};

/** Общие мелкие текстуры частиц: мягкое пятно, сердце, искра, монета, капля. */
export interface FxTextures { soft: Texture; heart: Texture; spark: Texture; coin: Texture; drop: Texture }
export function makeFxTextures(): FxTextures {
  const soft = canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.45, 'rgba(255,255,255,.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
  const heart = canvasTexture(64, 64, (g) => {
    g.translate(32, 36);
    g.scale(3.4, 3.4);
    g.beginPath();
    g.moveTo(0, 5.5);
    g.bezierCurveTo(-13, -3, -7, -13, 0, -4.5);
    g.bezierCurveTo(7, -13, 13, -3, 0, 5.5);
    g.fillStyle = '#fff';
    g.fill();
    g.lineWidth = 0.9;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
  });
  const spark = canvasTexture(64, 64, (g) => {
    g.translate(32, 32);
    g.scale(9, 9);
    g.beginPath();
    g.moveTo(0, -1.6); g.lineTo(0.45, -0.45); g.lineTo(1.6, 0); g.lineTo(0.45, 0.45);
    g.lineTo(0, 1.6); g.lineTo(-0.45, 0.45); g.lineTo(-1.6, 0); g.lineTo(-0.45, -0.45);
    g.closePath();
    g.fillStyle = '#fff';
    g.fill();
  });
  const coin = canvasTexture(48, 48, (g) => {
    g.beginPath();
    g.arc(24, 24, 18, 0, 7);
    g.fillStyle = '#E8B04A';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.arc(24, 24, 9, 0, 7);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(74,47,37,.35)';
    g.stroke();
  });
  const drop = canvasTexture(32, 32, (g) => {
    g.beginPath();
    g.arc(16, 16, 14, 0, 7);
    g.fillStyle = '#fff';
    g.fill();
  });
  return { soft, heart, spark, coin, drop };
}

/** Частицы мира: пар, пыль, монеты, сердечки, искры, летящая чашка. Всё на спрайтах Pixi. */
export class Fx {
  readonly root = new Container();
  private readonly list: P[] = [];
  private readonly tex = makeFxTextures();

  /** Лёгкая графика: частицы не создаются. */
  enabled = true;
  /** плотность текстур мира (для чашек-моделей) */
  res = 1;

  add(o: Particle): void {
    if (!this.enabled) return;
    this.list.push({ t: 0, vx: 0, vy: 0, g: 0, r: 3, grow: 0, a: 0.5, col: '255,255,255', kind: 'puff', x: 0, y: 0, ...o } as P);
  }

  count(kind: string): number {
    let n = 0;
    for (const p of this.list) if (p.kind === kind) n++;
    return n;
  }

  clear(): void {
    for (const p of this.list) this.kill(p);
    this.list.length = 0;
  }

  private kill(p: P): void {
    if (p._s) {
      p._s.destroy();
      p._s = undefined;
    }
    if (p._m) {
      p._m.destroy();
      p._m = undefined;
    }
  }

  private sprite(p: P, tex: Texture, add = false): Sprite {
    let s = p._s as Sprite | undefined;
    if (!s) {
      s = new Sprite(tex);
      s.anchor.set(0.5);
      if (add) s.blendMode = 'add';
      this.root.addChild(s);
      p._s = s;
    }
    return s;
  }

  update(dt: number): void {
    const T = this.tex;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i] as P;
      p.t += dt;
      if (p.t >= p.life) {
        this.kill(p);
        this.list.splice(i, 1);
        continue;
      }
      if (p.t < 0) {
        if (p._s) p._s.visible = false;
        continue;
      }
      const k = p.t / p.life;
      if (p.kind === 'coin') {
        const u = 1 - Math.pow(1 - k, 2.2);
        const s = this.sprite(p, T.coin);
        s.position.set(p.x0! + (p.tx! - p.x0!) * u + Math.sin(u * Math.PI) * p.arc!, p.y0! + (p.ty! - p.y0!) * u - Math.sin(u * Math.PI) * 80);
        s.scale.set((2 + 5 * Math.abs(Math.cos(p.t * 13))) / 12, 5 / 12);
        s.rotation = 0;
        continue;
      }
      if (p.kind === 'cup') {
        const u = 1 - Math.pow(1 - k, 2);
        let g = p._s as Graphics | undefined;
        if (!g) {
          g = new Graphics();
          g.moveTo(-11, -8).lineTo(11, -8).lineTo(8, 10).quadraticCurveTo(0, 14, -8, 10).closePath().fill('#FFF8EC').stroke({ width: 2.4, color: INK, join: 'round' });
          g.ellipse(0, -8, 11, 3.4).fill(p.col).stroke({ width: 2.4, color: INK });
          this.root.addChild(g);
          p._s = g;
        }
        const cx = p.x0! + (p.tx! - p.x0!) * u;
        const cy = p.y0! + (p.ty! - p.y0!) * u - Math.sin(u * Math.PI) * 64;
        const ct = p.model ? cupTexture(p.model, 'fly', this.res) : null;
        g.visible = !ct;
        if (ct) {
          /* чашка-модель: размер уже включает масштаб напитка, поэтому cs не применяется */
          let m = p._m;
          if (!m) {
            m = new Container();
            m.addChild(new Sprite(ct.tex));
            this.root.addChild(m);
            p._m = m;
          }
          const sp = m.children[0] as Sprite;
          sp.texture = ct.tex;
          sp.position.set(ct.box.x, ct.box.y);
          sp.width = ct.box.w;
          sp.height = ct.box.h;
          m.position.set(cx, cy);
          m.rotation = (u - 0.4) * 0.7;
          continue;
        }
        g.position.set(cx, cy);
        g.rotation = (u - 0.4) * 0.7;
        g.scale.set(p.cs ?? 1);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'heart') {
        const s = this.sprite(p, T.heart);
        const sz = p.r * (0.6 + 0.4 * Math.min(1, p.t * 7));
        s.position.set(p.x + Math.sin(p.t * 5 + p.r) * 5, p.y);
        s.scale.set((sz * 2.3) / 64);
        s.tint = rgb(p.col);
        s.alpha = Math.min(1, p.t * 6) * (1 - Math.pow(k, 2.5));
        s.rotation = Math.sin(p.t * 4 + p.r) * 0.2;
      } else if (p.kind === 'spark') {
        const s = this.sprite(p, T.spark, true);
        const sz = p.r * (1 - k * 0.5);
        s.position.set(p.x, p.y);
        s.scale.set((sz * 3.2) / 64 * 1.2);
        s.rotation = k * 2;
        s.tint = rgb(p.col);
        s.alpha = 1 - k;
      } else if (p.kind === 'dust') {
        const s = this.sprite(p, T.soft, true);
        s.position.set(p.x, p.y);
        s.scale.set((p.r * 5) / 128);
        s.tint = rgb(p.col);
        s.alpha = p.a * Math.sin(k * Math.PI) * 0.75;
      } else if (p.kind === 'drop') {
        const s = this.sprite(p, T.drop);
        s.position.set(p.x, p.y);
        s.scale.set((p.r * 2) / 32, (p.r * 3.6) / 32);
        s.tint = rgb(p.col);
        s.alpha = p.a;
      } else {
        const s = this.sprite(p, T.soft);
        const r = p.r + p.grow * p.t;
        s.position.set(p.x, p.y);
        s.scale.set((r * 2.6) / 128);
        s.tint = rgb(p.col);
        s.alpha = Math.min(0.95, p.a * (1 - k) * Math.min(1, p.t * 5) * 1.25);
      }
    }
  }
}
