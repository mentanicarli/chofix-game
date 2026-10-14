import type { Station } from './station';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export type FillKind = 'water' | 'milk' | 'ice' | 'juice' | 'tonic' | 'powder' | 'boba' | 'topping';

export interface FillCfg {
  /** Скорость налива: единиц в секунду. */
  rate: number;
  max: number;
  /** Допуск без штрафа и ширина спада оценки. */
  tol: number;
  span: number;
  unit: string;
  /** «Воды 150 мл». */
  noun: string;
  ok: string;
  low: string;
  high: string;
  /** Меньше этого — «Готово» не принимается. */
  min?: number;
  minMsg?: string;
}
export const FILL: Readonly<Record<FillKind, FillCfg>> = {
  water: { rate: 38, max: 330, tol: 8, span: 40, unit: 'мл', noun: 'Воды', ok: 'по линии', low: 'маловато', high: 'много' },
  milk: { rate: 38, max: 330, tol: 10, span: 50, unit: 'мл', noun: 'Молока', ok: 'ровно', low: 'маловато', high: 'многовато', min: 40, minMsg: 'Налейте больше молока' },
  ice: { rate: 38, max: 330, tol: 8, span: 40, unit: 'г', noun: 'Льда', ok: 'в самый раз', low: 'маловато', high: 'многовато' },
  juice: { rate: 34, max: 300, tol: 10, span: 50, unit: 'мл', noun: 'Сока', ok: 'по линии', low: 'маловато', high: 'многовато', min: 20, minMsg: 'Налейте больше' },
  tonic: { rate: 34, max: 300, tol: 10, span: 50, unit: 'мл', noun: 'Тоника', ok: 'по линии', low: 'маловато', high: 'многовато', min: 20, minMsg: 'Налейте больше' },
  powder: { rate: 8, max: 60, tol: 2.5, span: 14, unit: 'г', noun: 'Порошка', ok: 'в точку', low: 'маловато', high: 'многовато', min: 4, minMsg: 'Насыпьте больше' },
  boba: { rate: 20, max: 160, tol: 8, span: 40, unit: 'г', noun: 'Шариков', ok: 'в самый раз', low: 'маловато', high: 'многовато', min: 10, minMsg: 'Насыпьте больше' },
  topping: { rate: 4, max: 20, tol: 1.5, span: 8, unit: 'г', noun: 'Топпинга', ok: 'в самый раз', low: 'маловато', high: 'многовато' }
};

/** Целевое количество, при котором настройки выше «как раньше»; больше цель (крупный размер) — быстрее налив и шире допуск, чтобы время и сложность не росли с размером. */
const REF: Readonly<Record<FillKind, number>> = { water: 114, milk: 200, ice: 100, juice: 100, tonic: 120, powder: 25, boba: 60, topping: 8 };
const scaleOf = (kind: FillKind, target: number, cfg?: Partial<FillCfg>): number => (cfg?.rate !== undefined ? 1 : Math.max(1, target / REF[kind]));
/** Скорость налива, единиц в секунду. */
export const fillRate = (kind: FillKind, target: number): number => FILL[kind].rate * scaleOf(kind, target);
/** Сколько можно налить сверх цели (предел шкалы). */
export const fillCap = (kind: FillKind, target: number): number => Math.max(FILL[kind].max, target * 1.7);
/** Допуск без штрафа для цели. */
export const fillTol = (kind: FillKind, target: number): number => FILL[kind].tol * scaleOf(kind, target);

export interface FillOrder {
  kind: FillKind;
  /** Целевое количество. Для воды — вода без эспрессо, мл; для льда — граммы. */
  target: number;
  /** Свои единицы и скорость (щепотка специй, пюре в граммах). */
  cfg?: Partial<FillCfg>;
}
export interface FillState extends FillOrder { ml: number }

export const fillStation: Station<FillState, FillOrder> = {
  id: 'fill',
  init: (o) => ({ ...o, ml: 0 }),
  update(s, dt, holding) {
    if (holding) s.ml = Math.min(s.cfg?.max ?? fillCap(s.kind, s.target), s.ml + (s.cfg?.rate ?? fillRate(s.kind, s.target)) * dt);
  },
  finish(s) {
    const c = { ...FILL[s.kind], ...s.cfg };
    const k = scaleOf(s.kind, s.target, s.cfg);
    const tol = c.tol * k;
    if (c.min !== undefined && s.ml < c.min) return { message: { text: c.minMsg ?? 'Нужно больше', bad: true } };
    const e = Math.abs(s.ml - s.target);
    const score = clamp(1 - Math.max(0, e - tol) / (c.span * k), 0, 1);
    const n = s.target < 5 ? String(Math.round(s.ml * 10) / 10).replace('.', ',') : Math.round(s.ml);
    return {
      result: {
        score,
        message: { text: `${c.noun} ${n} ${c.unit}: ` + (e <= tol ? c.ok : s.ml < s.target ? c.low : c.high), bad: score < 0.5 }
      }
    };
  }
};
