
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const BREW_TEMPS: readonly number[] = [70, 80, 90, 95];
/** Игровых минут заварки в секунду. */
export const BREW_SPEED = 0.8;

export interface BrewOrder { temp: number; minutes: number }
export interface BrewState extends BrewOrder {
  /** Выбранная температура воды. */
  set: number | null;
  started: boolean;
  /** Сколько минут настаивается. */
  t: number;
}

export const brewStation = {
  id: 'brew',
  init: (o: BrewOrder): BrewState => ({ ...o, set: null, started: false, t: 0 }),
  /** Игрок выбрал температуру (пока чай не засыпан). */
  setTemp(s: BrewState, temp: number) {
    if (s.started) return { message: { text: 'Чай уже заваривается', bad: true } };
    s.set = temp;
    return {};
  },
  /** Залить водой и запустить таймер. */
  start(s: BrewState) {
    if (s.started) return {};
    if (s.set === null) return { message: { text: 'Сначала выберите температуру воды', bad: true } };
    s.started = true;
    return { effects: [{ kind: 'sound' as const, id: 'pump' }] };
  },
  update(s: BrewState, dt: number) {
    if (s.started) s.t = Math.min(s.minutes * 2.5, s.t + dt * BREW_SPEED);
    return undefined;
  },
  finish(s: BrewState) {
    if (!s.started) return { message: { text: 'Сначала заварите чай', bad: true } };
    const dT = Math.abs((s.set ?? 0) - s.temp);
    const tempScore = dT === 0 ? 1 : dT <= 5 ? 0.85 : dT <= 10 ? 0.55 : 0.2;
    const e = Math.abs(s.t - s.minutes);
    const timeScore = clamp(1 - Math.max(0, e - 0.3) / (s.minutes * 0.8), 0, 1);
    const score = clamp(tempScore * 0.45 + timeScore * 0.55, 0, 1);
    const parts: string[] = [];
    parts.push(dT === 0 ? 'вода в точку' : (s.set ?? 0) < s.temp ? 'вода холодновата' : 'вода горячая');
    parts.push(e <= 0.3 ? 'время идеально' : s.t < s.minutes ? 'недонастоялся' : 'перенастоялся');
    return { result: { score, message: { text: `Чай: ${parts.join(', ')}`, bad: score < 0.5 } } };
  }
};
