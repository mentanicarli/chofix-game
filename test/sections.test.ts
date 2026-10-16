import { describe, expect, test } from 'vitest';
import BAR from '../src/legacy/06-bar.js?raw';
import INDEX from '../index.html?raw';
import PROGRESSION from '../data/progression.json';
import { TASK_ZONE } from '../src/game/recipes';
import {
  CAM_SECONDS, SECTION_CAM, SECTION_EQ, SECTION_NAMES, SECTION_ORDER, STATIONS,
  cameraAt, cameraTarget, easeInOut, neighbors, sectionOfStation, sectionOfZone, sectionsOpen
} from '../src/game/sections';

/** Ключи ZONE_POS из legacy (общая область видимости, импортировать нельзя). */
const zonePosKeys = (): string[] => {
  const m = /const ZONE_POS = \{([^}]*)\}/.exec(BAR);
  if (!m) throw new Error('нет ZONE_POS');
  return [...(m[1] as string).matchAll(/(\w+):\s*\[/g)].map((x) => x[1] as string);
};

describe('секции: карта станций', () => {
  test('названия и порядок', () => {
    expect(SECTION_ORDER).toEqual(['L', 'C', 'R']);
    expect(SECTION_NAMES).toEqual({ L: 'Чайный бар', C: 'Кофейный бар', R: 'Холодный бар' });
  });

  test('19 станций: 10 в центре, 3 слева, 6 справа', () => {
    expect(STATIONS).toHaveLength(19);
    expect(new Set(STATIONS.map((s) => s.id)).size).toBe(19);
    const by = (id: string): string[] => STATIONS.filter((s) => s.section === id).map((s) => s.id);
    expect(by('C')).toEqual(['grind', 'tamp', 'shot', 'water', 'steam', 'milk', 'pour', 'syrup', 'ice', 'cream']);
    expect(by('L')).toEqual(['matcha', 'tea', 'powders']);
    expect(by('R')).toEqual(['juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker']);
  });

  test('каждая зона ZONE_POS и каждое значение TASK_ZONE принадлежит секции', () => {
    for (const z of zonePosKeys()) expect(sectionOfZone(z), `ZONE_POS.${z}`).toBeDefined();
    for (const [task, z] of Object.entries(TASK_ZONE)) expect(sectionOfZone(z), `TASK_ZONE.${task}`).toBeDefined();
  });

  test('зоны index.html покрыты, боковые зоны по ключам оборудования', () => {
    const ids = [...INDEX.matchAll(/data-z="(\w+)"/g)].map((m) => m[1] as string);
    expect(ids.length).toBeGreaterThan(15);
    for (const z of ids) expect(sectionOfZone(z), z).toBeDefined();
    for (const [sec, eq] of Object.entries(SECTION_EQ)) for (const k of eq) expect(sectionOfZone(k)).toBe(sec);
  });

  test('станция без потерь: у каждой станции есть зона из ZONE_POS или TASK_ZONE', () => {
    const known = new Set([...zonePosKeys(), ...Object.values(TASK_ZONE)]);
    for (const s of STATIONS) expect(s.zones.some((z) => known.has(z)), s.id).toBe(true);
    expect(sectionOfStation('boba')).toBe('R');
    expect(sectionOfStation('нет')).toBeUndefined();
  });

  test('льдогенератор в центре (решение владельца)', () => {
    expect(sectionOfZone('ice')).toBe('C');
    expect(sectionOfZone('micro')).toBe('C');
    expect(sectionOfZone('food')).toBe('C');
  });
});

describe('секции: открытие по покупкам', () => {
  test('ключи оборудования существуют в progression.json', () => {
    const eq = new Set((PROGRESSION as { equipment: { id: string }[] }).equipment.map((e) => e.id));
    for (const k of [...SECTION_EQ.L, ...SECTION_EQ.R]) {
      expect(eq.has(k), k).toBe(true);
    }
  });

  test('без покупок открыт только центр', () => {
    expect(sectionsOpen({})).toEqual({ L: false, C: true, R: false });
    expect(sectionsOpen({ eq_ice: true, eq_cream: true, eq_case_snacks: true, milk: true })).toEqual({ L: false, C: true, R: false });
  });

  test('первая покупка из списка открывает секцию', () => {
    for (const k of SECTION_EQ.L) expect(sectionsOpen({ ['eq_' + k]: true })).toEqual({ L: true, C: true, R: false });
    for (const k of SECTION_EQ.R) expect(sectionsOpen({ ['eq_' + k]: true })).toEqual({ L: false, C: true, R: true });
    expect(sectionsOpen({ eq_tea: true, eq_boba: true })).toEqual({ L: true, C: true, R: true });
  });

  test('ложное значение не открывает', () => {
    expect(sectionsOpen({ eq_tea: false, eq_juice: 0 })).toEqual({ L: false, C: true, R: false });
  });
});

describe('секции: соседи и камера', () => {
  test('соседи', () => {
    expect(neighbors('L')).toEqual({ left: null, right: 'C' });
    expect(neighbors('C')).toEqual({ left: 'L', right: 'R' });
    expect(neighbors('R')).toEqual({ left: 'C', right: null });
  });

  test('цели камеры: −1280, 0, +1280', () => {
    expect(cameraTarget('L')).toBe(-1280);
    expect(cameraTarget('C')).toBe(0);
    expect(cameraTarget('R')).toBe(1280);
    expect(SECTION_CAM.C).toBe(0);
  });

  test('плавность: начало, середина, конец, зажим', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(-3)).toBe(0);
    expect(easeInOut(7)).toBe(1);
    expect(easeInOut(0.25)).toBeLessThan(0.25); /* ease-in: в начале медленнее линейного */
    expect(easeInOut(0.75)).toBeGreaterThan(0.75);
    let prev = -1;
    for (let i = 0; i <= 20; i++) { const v = easeInOut(i / 20); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  });

  test('cameraAt: 0,3 с от центра к правой секции и обратно', () => {
    expect(CAM_SECONDS).toBe(0.3);
    expect(cameraAt(0, 1280, 0)).toBe(0);
    expect(cameraAt(0, 1280, 0.15)).toBeCloseTo(640, 6);
    expect(cameraAt(0, 1280, 0.3)).toBe(1280);
    expect(cameraAt(0, 1280, 5)).toBe(1280);
    expect(cameraAt(1280, 0, 0.15)).toBeCloseTo(640, 6);
    expect(cameraAt(0, -1280, 0.3)).toBe(-1280);
    expect(cameraAt(0, 1280, -1)).toBe(0);
    expect(cameraAt(0, 1280, 0.1, 0)).toBe(1280);
  });
});
