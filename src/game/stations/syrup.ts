import type { Effect, Station, StationStep } from './station';

export const MAX_PUMPS = 4;
export const DUMP_COST = 3;

export interface SyrupOrder {
  /** Ключ сиропа, который заказал гость; null — сироп не просили. */
  want: string | null;
  wantPumps: number;
  /** Читаемое имя по ключу. */
  names: Readonly<Record<string, string>>;
}
export interface SyrupState extends SyrupOrder {
  id: string | null;
  pumps: number;
  done: boolean;
}

const err = (text: string, sound?: string): StationStep => ({
  message: { text, bad: true },
  ...(sound ? { effects: [{ kind: 'sound', id: sound }] as Effect[] } : {})
});

export const syrupStation = {
  id: 'syrup',
  init: (o: SyrupOrder): SyrupState => ({ ...o, id: null, pumps: 0, done: false }),
  update: () => undefined,
  /** Нажатие на бутылку: одна порция. */
  pump(s: SyrupState, bottle: string): StationStep {
    if (!s.want) return err('Клиент не просил сироп', 'ui_error-soft-thud');
    if (s.done) return { message: { text: 'Сироп уже добавлен', bad: false } };
    if (s.pumps > 0 && s.id !== bottle) return err('В чашке уже другой сироп. Нажмите «Вылить»', 'ui_error-soft-thud');
    if (s.pumps >= MAX_PUMPS) return { message: { text: 'Больше четырёх порций не нужно', bad: true } };
    s.id = bottle;
    s.pumps++;
    return { effects: [{ kind: 'sound', id: 'pump' }] };
  },
  /** «Вылить»: начать заново, сироп пропадает (−3 ₽). */
  dump(s: SyrupState): StationStep {
    if (!s.pumps) return {};
    s.pumps = 0;
    s.id = null;
    return { effects: [{ kind: 'cost', amount: DUMP_COST }, { kind: 'sound', id: 'fridge' }] };
  },
  finish(s: SyrupState): StationStep {
    if (s.pumps < 1) return err('Сначала выберите сироп и нажмите на него: одно нажатие это одна порция');
    const ok = s.id === s.want;
    const e = Math.abs(s.pumps - s.wantPumps);
    const score = ok ? (e === 0 ? 1 : e === 1 ? 0.55 : 0.25) : 0.1;
    const name = (s.id && s.names[s.id]) || '';
    const text = ok ? (e === 0 ? `${name} ×${s.pumps}: как заказали` : `${name} ×${s.pumps}: нужно ×${s.wantPumps}`) : 'Не тот сироп';
    s.done = true;
    return { result: { score, message: { text, bad: score < 0.5 } } };
  }
} satisfies Station<SyrupState, SyrupOrder> & { pump: unknown; dump: unknown };
