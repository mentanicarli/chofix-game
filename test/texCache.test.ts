import { describe, expect, test } from 'vitest';
import { allSpecs, specOf } from '../src/game/drinkModel';
import { MODEL_TEX_CAP, TexCache, modelTexKey, type Destroyable } from '../src/render/world/texCache';
import { HOT_MODEL_IDS } from '../src/game/drinkModel';
import { drinkArtSvg, drinkParts } from '../src/render/world/drinkModel';
import { bookHTML } from '../src/ui/book';

/** Фальшивая текстура: считает, сколько штук живых. */
class Fake implements Destroyable {
  static live = 0;
  static made = 0;
  dead = false;
  constructor() {
    Fake.live++;
    Fake.made++;
  }
  destroy(): void {
    if (this.dead) throw new Error('двойное уничтожение');
    this.dead = true;
    Fake.live--;
  }
}

describe('кэш текстур модели (LRU 40)', () => {
  test('ёмкость 40, обход 120 разных ключей оставляет ровно 40 живых, остальные уничтожены один раз', () => {
    Fake.live = 0;
    Fake.made = 0;
    const c = new TexCache<Fake>();
    expect(c.cap).toBe(MODEL_TEX_CAP);
    expect(MODEL_TEX_CAP).toBe(40);
    for (let i = 0; i < 120; i++) c.set(`k${i}`, new Fake());
    expect(c.size).toBe(40);
    expect(Fake.live).toBe(40);
    expect(Fake.made).toBe(120);
    expect(c.keys()[0]).toBe('k80');
    c.clear();
    expect(Fake.live).toBe(0);
  });
  test('чтение обновляет свежесть, вытесняется самая давняя; ключ на экране не вытесняется', () => {
    Fake.live = 0;
    const c = new TexCache<Fake>(3);
    c.set('a', new Fake());
    c.set('b', new Fake());
    c.set('c', new Fake());
    c.get('a');
    c.set('d', new Fake());
    expect(c.keys()).toEqual(['c', 'a', 'd']);
    c.set('e', new Fake(), 'c');
    expect(c.keys()).toEqual(['c', 'd', 'e']);
    expect(Fake.live).toBe(3);
  });
  test('перезапись ключа уничтожает прежнюю запись', () => {
    Fake.live = 0;
    const c = new TexCache<Fake>(5);
    c.set('x', new Fake());
    c.set('x', new Fake());
    expect(c.size).toBe(1);
    expect(Fake.live).toBe(1);
  });
  test('ключ различает напиток, размер, уровень, режим и разрешение; на всех вариантах ключи уникальны', () => {
    const a = specOf('latte', '0.3', false);
    const keys = new Set<string>();
    for (const lod of ['full', 'compact'] as const) for (const res of [1, 2]) keys.add(modelTexKey(a, lod, res));
    expect(keys.size).toBe(4);
    expect(modelTexKey(specOf('latte', '0.3', true), 'full', 1)).not.toBe(modelTexKey(a, 'full', 1));
    const all = allSpecs().map((s) => modelTexKey(s, 'full', 1));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('Н2-1: 24 горячих вида в кэше', () => {
  test('обход всех горячих видов × размеров × уровней × разрешений оставляет в кэше ровно 40 живых, ключи уникальны', () => {
    Fake.live = 0;
    const c = new TexCache<Fake>();
    const hot = allSpecs().filter((s) => !s.cold && HOT_MODEL_IDS.has(s.id));
    expect(new Set(hot.map((s) => s.id)).size).toBe(24);
    const keys: string[] = [];
    for (const sp of hot) for (const lod of ['full', 'compact'] as const) for (const res of [1, 2]) keys.push(modelTexKey(sp, lod, res));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) c.set(k, new Fake());
    expect(c.size).toBe(40);
    expect(Fake.live).toBe(40);
    c.clear();
    expect(Fake.live).toBe(0);
  });
  test('каждый горячий вид рисуется в обоих уровнях и не пустой', () => {
    for (const sp of allSpecs().filter((s) => !s.cold && HOT_MODEL_IDS.has(s.id))) {
      for (const level of ['full', 'compact'] as const) {
        const p = drinkParts(sp, { level, s: 1, saucer: true, steamMark: true });
        expect(p.back.length, sp.id).toBeGreaterThan(50);
        expect(p.liquid.length, sp.id).toBeGreaterThan(20);
        expect(p.front.length, sp.id).toBeGreaterThan(20);
        expect(p.bbox.x1 - p.bbox.x0, sp.id).toBeGreaterThan(20);
      }
    }
  });
});

describe('модель в книге и окне', () => {
  test('SVG полного уровня запоминается и не меняется при повторе', () => {
    const s = specOf('latte', '0.4', true);
    const a = drinkArtSvg(s, 1.15);
    expect(drinkArtSvg(s, 1.15).svg).toBe(a.svg);
    expect(a.w).toBeGreaterThan(40);
  });
  test('книга рисует модель только там, где её дала функция art; без неё карточка прежняя', () => {
    const base = { rank: 9, tab: 'drinks', fam: 'all' };
    const calls: string[] = [];
    const withArt = bookHTML({ ...base, art: (id, size, cold) => { calls.push(`${id}|${size}|${cold}`); return id === 'latte' ? '<svg id="m"></svg>' : null; } });
    expect(withArt.match(/class="bkModel"/g)?.length).toBe(1);
    expect(calls.some((c) => c.startsWith('latte|'))).toBe(true);
    expect(bookHTML(base)).not.toContain('bkModel');
  });
});

describe('вес сборки', () => {
  test('dist/artifact.html: предупреждение при > 1,3 МБ, провал при > 1,5 МБ (проверяется минифицированная сборка)', () => {
    const files = import.meta.glob('../dist/artifact.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const text = Object.values(files)[0];
    if (!text) return; /* сборки нет */
    if (text.split(String.fromCharCode(10)).length > 20000) return; /* отладочная сборка не минифицирована */
    const mb = new TextEncoder().encode(text).length / 1048576;
    if (mb > 1.3) console.warn(`dist/artifact.html весит ${mb.toFixed(2)} МБ (предупреждение с 1,3, предел 1,5)`);
    expect(mb).toBeLessThanOrEqual(1.5);
  });
});
