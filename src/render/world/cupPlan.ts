/**
 * План чашки в зале (Н2-4): масштаб (px экрана на единицу модели), уровень детализации и ключ текстуры для чашки в руке баристы, в руке и на столе гостя, в полёте.
 * Чистая логика без Pixi: тесты перебирают все 56 видов × размеры × места. Масштаб зала меняется одной константой (`CUP_TOP_PX`), логика не трогается (блок 30).
 */
import { lodFor, specOf, type DrinkSpec, type Lod, type Material, type ModelRef } from '../../game/drinkModel';
import { GUEST_K } from './art';
import { geomOf } from './drinkModel';
import { modelTexKey } from './texCache';

export type CupPlace = 'barista' | 'guest' | 'fly';
/** Ширина обода чашки 0,2 л (k = 1) на экране, px: рука баристы 33 (было 22 × 1,5), рука и стол гостя 18 × GUEST_K, полёт 22. Размеры крупнее растут вместе с моделью (k = cupScale). */
export const CUP_TOP_PX: Readonly<Record<CupPlace, number>> = { barista: 33, guest: 18 * GUEST_K, fly: 22 };
/** Ширина обода в единицах модели при k = 1 (стакан 92, керамика 110, демитас 80). */
const MODEL_TOP: Readonly<Record<Material, number>> = { glass: 92, ceramic: 110, demitas: 80 };
/** px экрана на единицу модели для места и посуды. */
export const cupUnit = (place: CupPlace, material: Material): number => CUP_TOP_PX[place] / MODEL_TOP[material];

export interface CupPlan {
  spec: DrinkSpec;
  unit: number;
  /** высота корпуса на экране, px */
  heightPx: number;
  lod: Lod;
  key: string;
}
/** Что и как рисовать для чашки напитка в месте `place` при плотности `res`. Чашка в руке и на столе рисуется без блюдца (блюдце на столе есть в сцене). */
export function cupPlan(ref: ModelRef, place: CupPlace, res: number): CupPlan {
  const spec = specOf(ref.id, ref.size, ref.cold);
  const unit = cupUnit(place, spec.vessel.material);
  const heightPx = geomOf(spec.vessel).H * unit;
  const lod = lodFor(heightPx);
  return { spec, unit, heightPx, lod, key: `${modelTexKey(spec, lod, res)}|${place}|cup` };
}
