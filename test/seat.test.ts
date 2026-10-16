import { describe, expect, test } from 'vitest';
import { allSpecs } from '../src/game/drinkModel';
import { BAR_UNIT, SEAT_MIN_WIDE, bottomArc, drinkParts, geomOf, seatOf, type Ell } from '../src/render/world/drinkModel';

const norm = (e: Ell, x: number, y: number): number => ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2;
const LODS = ['full', 'compact', 'tiny'] as const;

describe('посадка посуды на блюдце (Н1-3б)', () => {
  test('для каждого напитка × размера × варианта × уровня донышко лежит в углублении, углубление в блюдце: зазор 0', () => {
    let n = 0;
    for (const spec of allSpecs()) {
      for (const lod of LODS) {
        const seat = seatOf(geomOf(spec.vessel), lod);
        const tag = `${spec.id} ${spec.size} ${spec.cold ? 'cold' : 'hot'} ${lod}`;
        for (let i = 0; i <= 40; i++) {
          const p = bottomArc(seat, i / 40);
          expect(norm(seat.recess, p.x, p.y), `дуга донышка вне углубления: ${tag}`).toBeLessThanOrEqual(1 + 1e-9);
        }
        /* верх донышка (задняя дуга основания) тоже внутри углубления: основание не торчит за блюдце */
        for (const sx of [-1, 0, 1]) expect(norm(seat.recess, sx * seat.Wb, seat.yb - seat.depth * (sx === 0 ? 1 : 0)), `основание вне углубления: ${tag}`).toBeLessThanOrEqual(1 + 1e-9);
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * 2 * Math.PI;
          expect(norm(seat.saucer, seat.recess.cx + seat.recess.rx * Math.cos(a), seat.recess.cy + seat.recess.ry * Math.sin(a)), `углубление вне блюдца: ${tag}`).toBeLessThanOrEqual(1 + 1e-9);
        }
        /* нижняя точка корпуса не выше верхней кромки блюдца в точке контакта, зазор 0 */
        const top = seat.saucer.cy - seat.saucer.ry;
        expect(seat.yLow, tag).toBeGreaterThanOrEqual(top);
        expect(seat.yLow - top, `нижняя точка не ниже верха блюдца: ${tag}`).toBeGreaterThan(0);
        expect(seat.yLow - seat.recess.cy).toBeCloseTo(seat.sink, 9);
        expect(seat.saucer.rx, `блюдце шире донышка на 30 %: ${tag}`).toBeGreaterThanOrEqual(SEAT_MIN_WIDE * seat.Wb);
        /* контактная тень под донышком, внутри углубления */
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * 2 * Math.PI;
          expect(norm(seat.recess, seat.contact.cx + seat.contact.rx * Math.cos(a), seat.contact.cy + seat.contact.ry * Math.sin(a))).toBeLessThanOrEqual(1 + 1e-9);
        }
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });
  test('утопленность: 2–4 px в баре (×BAR_UNIT) и около 1 px в иконках (масштаб ≈ 0,5)', () => {
    for (const spec of allSpecs()) {
      const full = seatOf(geomOf(spec.vessel), 'full');
      const px = full.sink * BAR_UNIT[spec.vessel.material];
      expect(px).toBeGreaterThanOrEqual(2);
      expect(px).toBeLessThanOrEqual(4);
      const c = seatOf(geomOf(spec.vessel), 'compact');
      expect(c.sink * 0.5).toBeGreaterThanOrEqual(0.9);
      expect(c.sink * 0.5).toBeLessThanOrEqual(1.1);
    }
  });
  test('границы модели включают блюдце целиком', () => {
    for (const spec of allSpecs()) {
      for (const lod of LODS) {
        const parts = drinkParts(spec, { level: lod, s: 1, saucer: true });
        const seat = seatOf(parts.geom, lod);
        expect(parts.bbox.y1).toBeGreaterThanOrEqual(seat.saucer.cy + seat.saucer.ry);
        expect(parts.bbox.x0).toBeLessThanOrEqual(-seat.saucer.rx);
        expect(parts.bbox.x1).toBeGreaterThanOrEqual(seat.saucer.rx);
      }
    }
  });
});
