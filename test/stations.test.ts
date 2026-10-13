import { describe, expect, test } from 'vitest';
import { fillStation, syrupStation } from '../src/game/api';

const names = { vanilla: 'Ваниль', caramel: 'Карамель' };
const syr = (want: string | null = 'vanilla', wantPumps = 2) => syrupStation.init({ want, wantPumps, names });

describe('станция сиропа', () => {
  test('идеально: тот сироп и столько порций', () => {
    const s = syr();
    syrupStation.pump(s, 'vanilla');
    syrupStation.pump(s, 'vanilla');
    const r = syrupStation.finish(s).result;
    expect(r?.score).toBe(1);
    expect(r?.message?.text).toBe('Ваниль ×2: как заказали');
  });
  test('ошибка на порцию, лишняя порция, не тот сироп', () => {
    const a = syr(); syrupStation.pump(a, 'vanilla');
    expect(syrupStation.finish(a).result?.score).toBe(0.55);
    const b = syr('vanilla', 1); ['vanilla', 'vanilla', 'vanilla'].forEach((x) => syrupStation.pump(b, x));
    expect(syrupStation.finish(b).result?.score).toBe(0.25);
    const c = syr(); syrupStation.pump(c, 'caramel');
    const r = syrupStation.finish(c).result;
    expect(r?.score).toBe(0.1);
    expect(r?.message?.text).toBe('Не тот сироп');
  });
  test('ограничения: нет заказа, другой сироп, максимум 4, пустое «Готово»', () => {
    expect(syrupStation.pump(syr(null), 'vanilla').message?.text).toBe('Клиент не просил сироп');
    const s = syr(); syrupStation.pump(s, 'vanilla');
    expect(syrupStation.pump(s, 'caramel').message?.text).toMatch(/другой сироп/);
    for (let i = 0; i < 5; i++) syrupStation.pump(s, 'vanilla');
    expect(s.pumps).toBe(4);
    expect(syrupStation.finish(syr()).result).toBeUndefined();
  });
  test('«Вылить» стоит 3 ₽ и сбрасывает порции', () => {
    const s = syr(); syrupStation.pump(s, 'vanilla');
    const st = syrupStation.dump(s);
    expect(s.pumps).toBe(0);
    expect(st.effects).toContainEqual({ kind: 'cost', amount: 3 });
    expect(syrupStation.dump(s).effects).toBeUndefined();
  });
});

describe('станция налива', () => {
  const hold = (st: ReturnType<typeof fillStation.init>, sec: number) => { for (let i = 0; i < sec * 100; i++) fillStation.update(st, 0.01, true); };
  test('скорость 38 мл/с и потолок 330', () => {
    const s = fillStation.init({ kind: 'milk', target: 200 });
    hold(s, 1); expect(s.ml).toBeCloseTo(38);
    hold(s, 20); expect(s.ml).toBe(330);
    fillStation.update(s, 1, false); expect(s.ml).toBe(330);
  });
  test('оценка воды: допуск ±8 мл', () => {
    const s = fillStation.init({ kind: 'water', target: 100 }); s.ml = 108;
    expect(fillStation.finish(s).result).toMatchObject({ score: 1, message: { text: 'Воды 108 мл: по линии' } });
    s.ml = 148; /* e=48 → (48−8)/40 = 1 → 0 */
    expect(fillStation.finish(s).result?.score).toBeCloseTo(0);
    s.ml = 60;
    expect(fillStation.finish(s).result?.message?.text).toBe('Воды 60 мл: маловато');
  });
  test('оценка молока: допуск ±10, меньше 40 мл не принимается', () => {
    const s = fillStation.init({ kind: 'milk', target: 200 }); s.ml = 30;
    expect(fillStation.finish(s).result).toBeUndefined();
    expect(fillStation.finish(s).message?.text).toBe('Налейте больше молока');
    s.ml = 260;
    expect(fillStation.finish(s).result?.score).toBeCloseTo(0);
    s.ml = 205;
    expect(fillStation.finish(s).result?.message?.text).toBe('Молока 205 мл: ровно');
  });
});

describe('станция льда', () => {
  test('допуск ±8 г и подписи', () => {
    const s = fillStation.init({ kind: 'ice', target: 100 });
    s.ml = 104;
    expect(fillStation.finish(s).result).toMatchObject({ score: 1, message: { text: 'Льда 104 г: в самый раз' } });
    s.ml = 40;
    expect(fillStation.finish(s).result?.message?.text).toBe('Льда 40 г: маловато');
    s.ml = 180;
    expect(fillStation.finish(s).result?.message?.text).toBe('Льда 180 г: многовато');
  });
});
