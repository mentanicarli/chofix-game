import type { Station, StationStep } from './station';

export const HEAT_FROM = 3.5;
export const HEAT_TO = 5.5;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export interface FoodStationOrder {
  targetId: string;
  names: Readonly<Record<string, string>>;
  heat: boolean;
}
export interface FoodStationState extends FoodStationOrder {
  wrong: number;
  picked: boolean;
  heatT: number;
  done: boolean;
}

export const heatScore = (t: number): number => clamp(1 - (t < HEAT_FROM ? HEAT_FROM - t : t > HEAT_TO ? t - HEAT_TO : 0) / 3, 0, 1);

export const foodStation = {
  id: 'food',
  init: (o: FoodStationOrder): FoodStationState => ({ ...o, wrong: 0, picked: false, heatT: 0, done: false }),
  /** Время нагрева идёт, пока зажата кнопка. */
  update(s: FoodStationState, dt: number, holding: boolean): StationStep | undefined {
    if (s.picked && s.heat && holding && !s.done) s.heatT += dt;
    return undefined;
  },
  /** Игрок достаёт блюдо с витрины. */
  pick(s: FoodStationState, id: string): StationStep {
    if (s.picked) return { message: { text: 'Блюдо уже достали', bad: false } };
    if (id !== s.targetId) {
      s.wrong++;
      return {
        message: { text: `Не то: гость просил «${s.names[s.targetId] ?? ''}»`, bad: true },
        effects: [{ kind: 'sound', id: 'ui_error-soft-thud' }]
      };
    }
    s.picked = true;
    const score = clamp(1 - 0.35 * s.wrong, 0, 1);
    if (!s.heat) {
      s.done = true;
      return { result: { score, message: { text: s.wrong ? 'Нашли, но не сразу' : 'Блюдо готово к выдаче', bad: score < 0.5 } } };
    }
    return { message: { text: 'Теперь разогрейте: зажмите кнопку и отпустите вовремя', bad: false } };
  },
  /** «Готово» после нагрева. */
  finish(s: FoodStationState): StationStep {
    if (!s.picked) return { message: { text: 'Сначала достаньте блюдо с витрины', bad: true } };
    if (!s.heat) return {};
    if (s.heatT < 0.5) return { message: { text: 'Зажмите «Разогреть» и держите', bad: true } };
    const h = heatScore(s.heatT);
    const score = (clamp(1 - 0.35 * s.wrong, 0, 1) + h) / 2;
    s.done = true;
    const how = s.heatT < HEAT_FROM ? 'ещё холодное' : s.heatT > HEAT_TO ? 'перегрели' : 'в самый раз';
    return { result: { score, message: { text: `Разогрето ${s.heatT.toFixed(1).replace('.', ',')} с: ${how}`, bad: score < 0.5 } } };
  }
} satisfies Omit<Station<FoodStationState, FoodStationOrder>, 'update'> & { update: unknown; pick: unknown };
