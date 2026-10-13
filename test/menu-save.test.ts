import { describe, expect, test } from 'vitest';
import { DEFAULT_SETTINGS, SAVE_VERSION, isLowGraphics, parseSettings, readSave, serializeSave, serializeSettings } from '../src/game/api';

describe('настройки', () => {
  test('нет данных или мусор — значения по умолчанию', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{не json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
  });
  test('громкость зажимается, неверные типы заменяются', () => {
    const s = parseSettings('{"musicVol":7,"sfxVol":-1,"musicOn":"да","graphics":"ультра","hints":false}');
    expect(s.musicVol).toBe(1);
    expect(s.sfxVol).toBe(0);
    expect(s.musicOn).toBe(true);
    expect(s.graphics).toBe('auto');
    expect(s.hints).toBe(false);
  });
  test('круговой проход сохраняет значения и версию', () => {
    const s = { ...DEFAULT_SETTINGS, musicOn: false, graphics: 'low' as const, hintsSet: true, hints: false };
    expect(parseSettings(serializeSettings(s))).toEqual(s);
  });
  test('лёгкая графика: вручную или «Авто» без видеокарты', () => {
    expect(isLowGraphics('low', false)).toBe(true);
    expect(isLowGraphics('auto', true)).toBe(true);
    expect(isLowGraphics('auto', false)).toBe(false);
    expect(isLowGraphics('high', true)).toBe(false);
  });
});

describe('формат сохранения', () => {
  test('старое сохранение без версии мигрирует в текущую', () => {
    const r = readSave('{"day":4,"money":812,"rating":3.4,"pace":"hard","up":["milk"],"лишнее":1}');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.data.v).toBe(SAVE_VERSION);
      expect(r.data.up).toEqual(['milk']);
      expect(r.data).not.toHaveProperty('лишнее');
    }
  });
  test('битое: не json, не объект, нет обязательных полей, числа не числа', () => {
    for (const raw of ['{', '[]', '"x"', '{"day":2}', '{"day":"2","money":1}', '{"day":0,"money":1}']) expect(readSave(raw).kind).toBe('broken');
    expect(readSave(null).kind).toBe('none');
    expect(readSave('').kind).toBe('none');
  });
  test('сохранение из будущей версии не читается', () => {
    expect(readSave('{"v":99,"day":2,"money":1}')).toEqual({ kind: 'broken', reason: 'newer' });
  });
  test('неизвестный темп заменяется на обычный, рейтинг зажимается', () => {
    const r = readSave('{"day":2,"money":1,"pace":"???","rating":9}');
    if (r.kind === 'ok') {
      expect(r.data.pace).toBe('normal');
      expect(r.data.rating).toBe(5);
    } else throw new Error('ожидалось ok');
  });
  test('сериализация читается обратно', () => {
    const r = readSave(serializeSave({ day: 3, money: 700, rating: 4, pace: 'cozy', rank: 2, served: 9, up: [] }));
    expect(r.kind).toBe('ok');
  });
});
