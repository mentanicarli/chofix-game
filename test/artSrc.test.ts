import { describe, expect, test } from 'vitest';
import TABLE from '../art-src/hall/table.svg?raw';
import LID from '../art-src/hall/laptop-lid.svg?raw';
import BASE from '../art-src/hall/laptop-base.svg?raw';

/* Этап 12.3(0): геометрия исходников арта (art-src), стайлгайд раздел 12 («каждая деталь на своём месте, ножка на основании, основание ноутбука не шире экрана»).
   Совпадение src/assets/art с art-src проверяет `npm run art:check` (в `check` не входит: результат сборки коммитится). */
const m = (s: string, re: RegExp): ((i: number) => number) => {
  const r = re.exec(s);
  if (!r) throw new Error('не найдено: ' + String(re));
  return (i) => Number(r[i]);
};

describe('art-src: стол', () => {
  const base = m(TABLE, /<ellipse cx="(\d+)" cy="(\d+)" rx="(\d+)" ry="(\d+)" fill="\{\{WOOD\}\}"\/>/);
  const top = m(TABLE, /<ellipse cx="(\d+)" cy="(\d+)" rx="(\d+)" ry="(\d+)" fill="\{\{TOP\}\}"\/>/);
  const leg = m(TABLE, /<path d="M(\d+) (\d+)V(\d+)A\d+ [\d.]+ 0 0 0 (\d+) \d+V\d+Z" fill="\{\{WOOD\}\}"\/>/);
  const side = m(TABLE, /<path d="M\d+ (\d+)V(\d+)A\d+ \d+ 0 0 0 \d+ \d+V\d+Z" fill="\{\{WOOD_SH\}\}"\/>\n<ellipse cx="230" cy="548"/);
  test('столешница круглая в перспективе 4:1, основание тоже около 4:1', () => {
    expect(top(3) / top(4)).toBe(4);
    expect(base(3) / base(4)).toBeGreaterThan(3.8);
    expect(base(3) / base(4)).toBeLessThan(4.6);
  });
  test('колонна стоит на основании: нижний конец на эллипсе основания, по ширине внутри него', () => {
    expect(leg(3)).toBe(base(2));
    expect(leg(1)).toBeGreaterThan(base(1) - base(3));
    expect(leg(4)).toBeLessThan(base(1) + base(3));
    expect(Math.abs((leg(1) + leg(4)) / 2 - base(1))).toBeLessThanOrEqual(1);
  });
  test('верхний конец колонны за боком столешницы, а не поверх неё', () => {
    expect(leg(2)).toBeGreaterThan(top(2)); /* ниже центра столешницы: прячется за боковой кромкой */
    expect(leg(2)).toBeLessThan(side(2) + top(4)); /* и не ниже нижней кромки бока */
  });
  test('колонна и столешница на одной оси (SEAT_PIVOT x = 230)', () => {
    expect(top(1)).toBe(230);
    expect(base(1)).toBe(230);
  });
});

describe('art-src: ноутбук', () => {
  test('основание не шире крышки (замечание владельца №3: клавиатура шире экрана)', () => {
    const lid = m(LID, /<path d="M(\d+) 540L\d+ \d+Q\d+ \d+ \d+ \d+H\d+Q\d+ \d+ \d+ \d+L(\d+) 540Z" fill="\{\{KRAFT\}\}"\/>/);
    const base = m(BASE, /<path d="M(\d+) 540H(\d+)L[\d.]+ [\d.]+Q[\d.]+ [\d.]+ [\d.]+ [\d.]+Z" fill="\{\{KRAFT_SH\}\}"\/>/);
    const lidW = lid(2) - lid(1);
    const baseW = base(2) - base(1);
    expect(baseW).toBeLessThanOrEqual(lidW);
    expect(baseW).toBeGreaterThanOrEqual(lidW * 0.9);
  });
  test('нижний край крышки на шарнире y 540 (крышка открывается масштабом от шарнира)', () => {
    expect(LID).toContain('540Z');
  });
});
