import type { Station } from './station';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export type TimedKind = 'whisk' | 'blend' | 'shake' | 'foam' | 'whip' | 'layer';

interface TimedCfg {
  /** Сколько секунд держать. */
  target: number;
  tol: number;
  verb: string;
  /** Что видит игрок: «Взбито 4,0 с». */
  noun: string;
  low: string;
  high: string;
  ok: string;
}
export const TIMED: Readonly<Record<TimedKind, TimedCfg>> = {
  whisk: { target: 4, tol: 0.7, verb: 'Взбивать', noun: 'Матча взбита', low: 'ещё комочки', high: 'перебили', ok: 'гладкая' },
  blend: { target: 6, tol: 1, verb: 'Блендер', noun: 'Взбито', low: 'остались кусочки', high: 'слишком жидко', ok: 'как надо' },
  shake: { target: 5, tol: 1, verb: 'Встряхивать', noun: 'Взболтано', low: 'не размешалось', high: 'долго', ok: 'отлично' },
  foam: { target: 4, tol: 0.8, verb: 'Взбивать пенку', noun: 'Пенка', low: 'жидковата', high: 'плотная, как масло', ok: 'воздушная' },
  whip: { target: 3, tol: 0.6, verb: 'Взбивать', noun: 'Сливочная пена', low: 'жидкая', high: 'слишком густая', ok: 'как облако' },
  layer: { target: 4, tol: 0.7, verb: 'Лить медленно', noun: 'Слои', low: 'слои не легли', high: 'слои смешались', ok: 'слои ровные' }
};

export interface TimedOrder { kind: TimedKind; /** Свой целевой срок, с (по умолчанию из TIMED). */ target?: number }
export interface TimedState { kind: TimedKind; target: number; t: number }

export const timedStation: Station<TimedState, TimedOrder> = {
  id: 'timed',
  init: (o) => ({ kind: o.kind, target: o.target ?? TIMED[o.kind].target, t: 0 }),
  update(s, dt, holding) {
    if (holding) s.t = Math.min(s.target * 2.2, s.t + dt);
    return undefined;
  },
  finish(s) {
    const c = TIMED[s.kind];
    if (s.t < s.target * 0.25) return { message: { text: `Подержите дольше: ${c.verb.toLowerCase()}`, bad: true } };
    const e = Math.abs(s.t - s.target);
    const score = clamp(1 - Math.max(0, e - c.tol) / (s.target * 0.7), 0, 1);
    const verdict = e <= c.tol ? c.ok : s.t < s.target ? c.low : c.high;
    return { result: { score, message: { text: `${c.noun}: ${verdict}`, bad: score < 0.5 } } };
  }
};
