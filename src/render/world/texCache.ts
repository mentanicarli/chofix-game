/**
 * Кэш текстур модели напитка (Н1-3): LRU на `MODEL_TEX_CAP` записей, вытесненное уничтожается (`destroy`).
 * Модуль без Pixi: запись сама знает, как себя уничтожить, поэтому число живых текстур проверяется юнит-тестом.
 */
import type { DrinkSpec, Lod } from '../../game/drinkModel';

/** Сколько записей держит кэш (запись = один ключ: либо четыре слоя бара, либо одна иконка). */
export const MODEL_TEX_CAP = 40;

/** Ключ текстуры: напиток, размер, уровень детализации, режим (холодный/горячий), разрешение. */
export const modelTexKey = (spec: Pick<DrinkSpec, 'id' | 'size' | 'cold'>, lod: Lod, res: number): string => `${spec.id}|${spec.size}|${lod}|${spec.cold ? 'cold' : 'hot'}|${res}`;

export interface Destroyable { destroy(): void }

/** LRU: `get` и `set` делают запись самой свежей; при переполнении самая старая (кроме защищённой) вытесняется и уничтожается. */
export class TexCache<V extends Destroyable> {
  private readonly m = new Map<string, V>();
  constructor(readonly cap: number = MODEL_TEX_CAP) {}

  get size(): number {
    return this.m.size;
  }

  has(key: string): boolean {
    return this.m.has(key);
  }

  get(key: string): V | undefined {
    const v = this.m.get(key);
    if (v !== undefined) {
      this.m.delete(key);
      this.m.set(key, v);
    }
    return v;
  }

  /** `keep` — ключ, который сейчас на экране: его не вытесняем, даже если он самый старый. */
  set(key: string, v: V, keep = ''): void {
    const old = this.m.get(key);
    if (old !== undefined && old !== v) old.destroy();
    this.m.delete(key);
    this.m.set(key, v);
    for (const k of this.m.keys()) {
      if (this.m.size <= this.cap) break;
      if (k === key || k === keep) continue;
      (this.m.get(k) as V).destroy();
      this.m.delete(k);
    }
  }

  keys(): string[] {
    return [...this.m.keys()];
  }

  clear(): void {
    this.m.forEach((v) => v.destroy());
    this.m.clear();
  }
}
