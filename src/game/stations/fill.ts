import type { Station } from './station';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export type FillKind = 'water' | 'milk' | 'ice' | 'juice' | 'tonic' | 'powder' | 'boba' | 'topping';

interface FillCfg {
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

export interface FillOrder {
  kind: FillKind;
  /** Целевое количество. Для воды — доля воды в американо (total − эспрессо); для льда — граммы. */
  target: number;
}
export interface FillState extends FillOrder { ml: number }

export const fillStation: Station<FillState, FillOrder> = {
  id: 'fill',
  init: (o) => ({ ...o, ml: 0 }),
  update(s, dt, holding) {
    if (holding) s.ml = Math.min(FILL[s.kind].max, s.ml + FILL[s.kind].rate * dt);
  },
  finish(s) {
    const c = FILL[s.kind];
    if (c.min !== undefined && s.ml < c.min) return { message: { text: c.minMsg ?? 'Нужно больше', bad: true } };
    const e = Math.abs(s.ml - s.target);
    const score = clamp(1 - Math.max(0, e - c.tol) / c.span, 0, 1);
    const n = Math.round(s.ml);
    return {
      result: {
        score,
        message: { text: `${c.noun} ${n} ${c.unit}: ` + (e <= c.tol ? c.ok : s.ml < s.target ? c.low : c.high), bad: score < 0.5 }
      }
    };
  }
};
