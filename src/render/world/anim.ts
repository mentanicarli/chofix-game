/**
 * Маленькая библиотека анимации мира: кривые, пружины, сглаживание, последовательности.
 * Без зависимостей и без обращений к DOM — всё считается из dt.
 */
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
/** Плавное приближение к цели, не зависит от частоты кадров (rate — 1/с). */
export const damp = (cur: number, tgt: number, rate: number, dt: number): number => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

/** Кривые на u от 0 до 1. */
export const ease = {
  linear: (u: number): number => u,
  inQuad: (u: number): number => u * u,
  outQuad: (u: number): number => 1 - (1 - u) * (1 - u),
  outCubic: (u: number): number => 1 - (1 - u) ** 3,
  inOutCubic: (u: number): number => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  inOutSine: (u: number): number => -(Math.cos(Math.PI * u) - 1) / 2,
  outBack: (u: number): number => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2,
  /** Колокол 0→1→0: для коротких толчков (сжатие при посадке). */
  bell: (u: number): number => Math.sin(Math.PI * clamp(u, 0, 1))
};
export type Ease = (u: number) => number;

/** Пружина с затуханием. freq — рад/с (жёсткость), zeta — демпфирование (1 — без колебаний, 0.3 — пружинит). */
export class Spring {
  v = 0;
  constructor(
    public x = 0,
    public freq = 10,
    public zeta = 0.55
  ) {}

  step(dt: number, target: number): number {
    /* подшаги: пружина остаётся устойчивой и при длинном кадре */
    const n = Math.max(1, Math.ceil(dt / 0.012));
    const h = dt / n;
    const k = this.freq * this.freq;
    const c = 2 * this.zeta * this.freq;
    for (let i = 0; i < n; i++) {
      this.v += (k * (target - this.x) - c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }

  kick(v: number): void {
    this.v += v;
  }

  set(x: number): void {
    this.x = x;
    this.v = 0;
  }
}

/** Пара пружин — для рук и других двумерных точек. */
export class Spring2 {
  readonly sx: Spring;
  readonly sy: Spring;
  constructor(x = 0, y = 0, freq = 12, zeta = 0.7) {
    this.sx = new Spring(x, freq, zeta);
    this.sy = new Spring(y, freq, zeta);
  }

  get x(): number {
    return this.sx.x;
  }

  get y(): number {
    return this.sy.x;
  }

  step(dt: number, tx: number, ty: number): void {
    this.sx.step(dt, tx);
    this.sy.step(dt, ty);
  }

  set(x: number, y: number): void {
    this.sx.set(x);
    this.sy.set(y);
  }
}

interface SeqItem {
  at: number;
  dur: number;
  fn: (u: number) => void;
  ease: Ease;
  done: boolean;
}

/**
 * Последовательность шагов: pause, to(длительность, функция u), call. Шаги идут один за другим.
 * update(dt) возвращает true, когда всё доиграно.
 */
export class Seq {
  private readonly items: SeqItem[] = [];
  private t = 0;
  private end = 0;

  /** Шаг длиной dur секунд: fn(u) получает u от 0 до 1 уже со сглаживанием. */
  to(dur: number, fn: (u: number) => void, e: Ease = ease.inOutCubic): this {
    this.items.push({ at: this.end, dur, fn, ease: e, done: false });
    this.end += dur;
    return this;
  }

  /** Параллельный шаг: стартует вместе с предыдущим на offset секунд раньше его конца. */
  over(offset: number, dur: number, fn: (u: number) => void, e: Ease = ease.inOutCubic): this {
    this.items.push({ at: Math.max(0, this.end - offset), dur, fn, ease: e, done: false });
    this.end = Math.max(this.end, this.end - offset + dur);
    return this;
  }

  wait(dur: number): this {
    this.end += dur;
    return this;
  }

  call(fn: () => void): this {
    this.items.push({ at: this.end, dur: 0, fn: () => fn(), ease: ease.linear, done: false });
    return this;
  }

  get time(): number {
    return this.t;
  }

  update(dt: number): boolean {
    this.t += dt;
    for (const it of this.items) {
      if (it.done || this.t < it.at) continue;
      if (it.dur <= 0) {
        it.fn(1);
        it.done = true;
        continue;
      }
      const u = clamp((this.t - it.at) / it.dur, 0, 1);
      it.fn(it.ease(u));
      if (u >= 1) it.done = true;
    }
    return this.t >= this.end;
  }
}

/** Двухзвенная рука/нога: углы суставов, чтобы кисть попала в точку (x, y). dir — в какую сторону гнётся локоть. */
export function ik2(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, dir: number): { a1: number; a2: number; ex: number; ey: number; hx: number; hy: number } {
  let dx = tx - sx;
  let dy = ty - sy;
  let d = Math.hypot(dx, dy);
  const lo = Math.abs(l1 - l2) + 0.5;
  const hi = l1 + l2 - 0.4;
  if (d < 0.001) {
    dx = 0;
    dy = 1;
    d = 0.001;
  }
  const dd = clamp(d, lo, hi);
  const base = Math.atan2(dy, dx);
  const cosS = clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1);
  const a1 = base + dir * Math.acos(cosS);
  const ex = sx + Math.cos(a1) * l1;
  const ey = sy + Math.sin(a1) * l1;
  const hx = sx + (dx / d) * dd;
  const hy = sy + (dy / d) * dd;
  const a2 = Math.atan2(hy - ey, hx - ex);
  return { a1, a2, ex, ey, hx, hy };
}
