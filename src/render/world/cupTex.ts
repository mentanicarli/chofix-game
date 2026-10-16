/**
 * Текстуры чашек в зале (Н2-4): рука баристы, рука и стол гостя, полёт чашки. Одна текстура на ключ (`cupPlan`), LRU на 40 записей, вытесненное уничтожается.
 * Чашка без блюдца и контактной тени. Возвращает null, пока текстура рисуется (вызывающий показывает прежнюю иконку-заглушку или ничего).
 */
import type { Texture } from 'pixi.js';
import type { ModelRef } from '../../game/drinkModel';
import { cupPlan, type CupPlace } from './cupPlan';
import { drinkPx } from './drinkModel';
import { raster } from './svg';
import { TexCache } from './texCache';

export interface CupTex {
  tex: Texture;
  /** границы относительно основания чашки, px экрана */
  box: { x: number; y: number; w: number; h: number };
  destroy(): void;
}

const cache = new TexCache<CupTex>();
const loading = new Set<string>();

/** Готовая текстура чашки или null (запустит рисование). */
export function cupTexture(ref: ModelRef, place: CupPlace, res: number): CupTex | null {
  let plan;
  try {
    plan = cupPlan(ref, place, res);
  } catch {
    return null;
  }
  const hit = cache.get(plan.key);
  if (hit) return hit;
  if (loading.has(plan.key)) return null;
  loading.add(plan.key);
  const px = drinkPx(plan.spec, { level: plan.lod, s: plan.unit, noSaucer: true });
  void raster(px.all.inner, px.all.box, res).then((tex) => {
    cache.set(plan.key, { tex, box: px.all.box, destroy: () => tex.destroy(true) });
    loading.delete(plan.key);
  });
  return null;
}

export const cupTextureCount = (): number => cache.size;
