import type { Rng } from './types';

/** Случайная перестановка индексов 0..n−1 (Фишер—Йетс). Если задан avoidFirst и треков больше одного, первым он не окажется. */
export function shuffleOrder(n: number, rng: Rng, avoidFirst = -1): number[] {
  const a = Array.from({ length: Math.max(0, n) }, (_, i) => i);
  const pick = (m: number): number => Math.min(m - 1, Math.floor(rng() * m));
  for (let i = a.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [a[i], a[j]] = [a[j] as number, a[i] as number];
  }
  if (a.length > 1 && a[0] === avoidFirst) {
    const j = 1 + pick(a.length - 1);
    [a[0], a[j]] = [a[j] as number, a[0] as number];
  }
  return a;
}

/**
 * Порядок воспроизведения: каждый круг — новая перестановка, все треки по разу.
 * Последний трек круга не становится первым в следующем. Порядок нигде не хранится.
 */
export class Playlist {
  private order: number[];
  private pos = 0;
  private following: number[] | null = null;

  constructor(
    readonly size: number,
    private readonly rng: Rng
  ) {
    this.order = shuffleOrder(size, rng);
  }

  /** Индекс играющего трека (−1, если треков нет). */
  get current(): number {
    return this.order[this.pos] ?? -1;
  }

  /** Индекс следующего трека; на стыке кругов перестановка делается заранее. */
  peek(): number {
    if (this.size === 0) return -1;
    if (this.pos + 1 < this.order.length) return this.order[this.pos + 1] as number;
    this.following ??= shuffleOrder(this.size, this.rng, this.current);
    return this.following[0] as number;
  }

  /** Переходит к следующему треку и возвращает его индекс. */
  advance(): number {
    if (this.size === 0) return -1;
    if (this.pos + 1 < this.order.length) this.pos++;
    else {
      this.order = this.following ?? shuffleOrder(this.size, this.rng, this.current);
      this.following = null;
      this.pos = 0;
    }
    return this.current;
  }

  /** Выбрасывает следующий трек из текущего круга (он не загрузился). Единственный трек остаётся. */
  skipNext(): void {
    if (this.size <= 1) return;
    if (this.pos + 1 < this.order.length) this.order.splice(this.pos + 1, 1);
    else if (this.following) {
      this.following.shift();
      if (!this.following.length) this.following = null;
    }
  }
}
