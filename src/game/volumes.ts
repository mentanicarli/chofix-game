import { drinkById } from './menu';
import type { Drink, Size } from './types';

/* ---------- Объёмы и рецептуры по размеру ----------
   Размер в литрах = итоговый объём напитка в чашке V (мл). Всё, что зависит от размера, считается здесь
   одной функцией recipeNumbers: из неё берут и бар (цели налива), и книга рецептов, и себестоимость.
   Чистая логика: ничего про DOM и рендер. */

export const SIZES: readonly Size[] = ['0.2', '0.3', '0.4', '0.6'];
export const SIZE_ML: Readonly<Record<Size, number>> = { '0.2': 200, '0.3': 300, '0.4': 400, '0.6': 600 };
/** Один шот эспрессо: объём (мл) и доза кофе (г). */
export const SHOT_ML = 30;
export const SHOT_G = 9;
/** Шоты по размеру, как в сетях: 0.2 и 0.3 л = 1 шот, 0.4 и 0.6 л = 2 шота. */
export const SHOTS_BY_SIZE: Readonly<Record<Size, number>> = { '0.2': 1, '0.3': 1, '0.4': 2, '0.6': 2 };
/** Одна помпа сиропа, мл, и помпы по размеру. */
export const PUMP_ML = 8;
export const PUMPS_BY_SIZE: Readonly<Record<Size, number>> = { '0.2': 2, '0.3': 3, '0.4': 4, '0.6': 5 };
/** Холодные напитки: жидкая часть стакана, остальное занимает лёд (его масса 0,3·V занимает 0,45·V с воздухом между кубиками). */
export const LIQUID_SHARE = 0.55;
export const ICE_SHARE_G = 0.3;
/** Грамм льда на миллилитр занятого им объёма. */
export const ICE_G_PER_ML = ICE_SHARE_G / (1 - LIQUID_SHARE);

/** Расширение молока при вспенивании: объём после пара = молоко · (1 + x). */
export const FOAM_X: Readonly<Record<string, number>> = {
  cappuccino: 0.5, cappuccino_pumpkin: 0.5, latte: 0.2, flat_white: 0.1, raf: 0.3, vanilla_raf: 0.3, raf_halva: 0.3
};
export const FOAM_X_DEFAULT = 0.2;
/** Шкала «Пена» в баре: расширение 0,5 = 0,55 на шкале (так было у капучино). */
export const FOAM_SCALE = 1.1;
export const foamXOf = (drinkId: string): number => FOAM_X[drinkId] ?? FOAM_X_DEFAULT;
export const foamTarget = (x: number): number => Math.round(x * FOAM_SCALE * 100) / 100;

/** Температурные зоны пара по напиткам, °C. Остальные молочные напитки: ZONE_DEFAULT. */
export const STEAM_ZONES: Readonly<Record<string, readonly [number, number]>> = {
  cappuccino: [60, 65], cappuccino_pumpkin: [60, 65], latte: [55, 62], flat_white: [55, 60],
  raf: [60, 65], vanilla_raf: [60, 65], raf_halva: [60, 65], cocoa: [60, 65]
};
export const ZONE_DEFAULT: readonly [number, number] = [55, 62];
/** Питчер с термометром расширяет зону: на 2° вниз и на 3° вверх. */
export const THERMO_LO = 2;
export const THERMO_HI = 3;
export function steamZoneOf(drinkId: string, thermo = false): [number, number] {
  const z = STEAM_ZONES[drinkId] ?? ZONE_DEFAULT;
  return thermo ? [z[0] - THERMO_LO, z[1] + THERMO_HI] : [z[0], z[1]];
}

/** Масштаб чашки по объёму: (V / 200)^(1/3). 0.2 л = 1,00; 0.3 = 1,14; 0.4 = 1,26; 0.6 = 1,44. */
export const cupScale = (ml: number): number => Math.cbrt(ml / 200);
/** Чашка эспрессо и двойного эспрессо, мл. */
export const CUP_ESPRESSO = 90;
export const CUP_DOUBLE = 120;

/* ---------- напиток → число шотов ---------- */
export const shotsOf = (d: Drink, size: Size): number => (d.shots === 'size' ? (SHOTS_BY_SIZE[size] ?? 1) : d.shots);

/** Матча: граммы и вода (мл) по размеру. */
export const MATCHA_G: Readonly<Record<Size, number>> = { '0.2': 2, '0.3': 3, '0.4': 4, '0.6': 4 };
export const MATCHA_WATER: Readonly<Record<Size, number>> = { '0.2': 50, '0.3': 60, '0.4': 70, '0.6': 70 };
/** Матча в холодных напитках: 2 г в 45 мл воды. */
export const MATCHA_COLD_G = 2;
export const MATCHA_COLD_WATER = 45;
/** Порошки на 200 мл, г. */
export const POWDER_G_200: Readonly<Record<string, number>> = { cocoa: 20, chicory_latte: 6 };
export const PROTEIN_G = 30;
/** Чай на 200 мл, г, и вода на заварку. */
export const TEA_G_200: Readonly<Record<string, number>> = {
  tea_sencha: 2, tea_assam: 2, tea_hibiscus: 3, tea_buckwheat: 5, tea_currant: 2, boba_guava: 4, boba_raspberry: 4
};
/** Холодная пенка таро / крем-брюле на латте с пенкой, мл. */
export const TOP_FOAM: Readonly<Record<Size, number>> = { '0.2': 40, '0.3': 40, '0.4': 40, '0.6': 50 };
/** Сливочная пена аэрокано, мл. */
export const AERO_FOAM: Readonly<Record<Size, number>> = { '0.2': 40, '0.3': 40, '0.4': 55, '0.6': 80 };
/** Банановое пюре в милкшейке, г. */
export const BANANA_G: Readonly<Record<Size, number>> = { '0.2': 60, '0.3': 60, '0.4': 60, '0.6': 90 };
/** Тапиока в бабл ти, г. */
export const TAPIOCA_G: Readonly<Record<Size, number>> = { '0.2': 60, '0.3': 60, '0.4': 60, '0.6': 85 };
/** Бабл ти: помпы сиропа. */
export const BOBA_PUMPS: Readonly<Record<Size, number>> = { '0.2': 3, '0.3': 3, '0.4': 3, '0.6': 4 };
/** Щепотка специй в тыквенном капучино, г, и карамельный соус, г. */
export const SPICE_G = 0.5;
export const SAUCE_G = 8;

export type Unit = 'мл' | 'г' | 'помп';
/** Строка состава: подпись, количество и сколько занимает в стакане (мл). */
export interface Part {
  /** шаг бара, к которому относится строка */
  task: string;
  label: string;
  amount: number;
  unit: Unit;
  /** сколько места занимает в стакане, мл (0 — растворяется или добавка сверху) */
  vol: number;
  note?: string;
}

/** Цели и состав напитка выбранного размера. */
export interface Recipe {
  id: string;
  size: Size;
  cold: boolean;
  /** объём напитка, мл (для эспрессо — только жидкость в чашке) */
  drinkMl: number;
  /** объём чашки или стакана, мл (от него масштаб модели) */
  cupMl: number;
  shots: number;
  parts: Part[];
  /** молоко (или сливки у рафа) в питчер до вспенивания, либо молоко в стакан без пара, мл */
  milk?: number;
  cupMilk: boolean;
  /** вода в чашку, мл */
  water?: number;
  /** лёд, г */
  ice?: number;
  /** расширение при вспенивании и цель шкалы «Пена» */
  foamX?: number;
  foam?: number;
  zone?: [number, number];
  /** холодное взбитое молоко без пара (холодный капучино): расширение для рисунка */
  coldX?: number;
  /** сок, пюре, тоник, мл или г */
  juice?: number;
  tonic?: number;
  powder?: number;
  boba?: number;
  /** помпы сиропа, входящие в рецепт */
  pumps: number;
  /** заварка */
  tea?: { g: number; waterMl: number };
  matcha?: { g: number; waterMl: number };
  /** пенка или сливочная пена сверху, мл */
  topFoam?: number;
}

const round = Math.round;
const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Нет ли у напитка рецептурного сиропа (его помпы входят в объём). */
export function recipePumps(d: Drink, size: Size): number {
  if (!FORCED_SYRUP_IDS.has(d.id)) return 0;
  if (d.family === 'boba') return BOBA_PUMPS[size];
  return PUMPS_BY_SIZE[size];
}
/** Напитки с сиропом в рецепте (совпадает с FORCED_SYRUP в menu.ts, сверяет тест). */
export const FORCED_SYRUP_IDS: ReadonlySet<string> = new Set([
  'vanilla_raf', 'raf_halva', 'latte_coconut', 'matcha_coconut', 'cappuccino_pumpkin', 'latte_sakura', 'latte_banana', 'latte_lemon',
  'boba_guava', 'boba_raspberry', 'milkshake_vanilla', 'frappe_caramel'
]);

const shotPart = (n: number): Part => ({ task: 'shot', label: n > 1 ? `Эспрессо, ${n} шота` : 'Эспрессо', amount: n * SHOT_ML, unit: 'мл', vol: n * SHOT_ML, note: `${n * round(SHOT_G)} г кофе` });

/**
 * Состав и цели напитка `d` размера `size`.
 * cold — холодный вариант (лёд по общему правилу); для напитков, которые бывают только холодными, всегда истина.
 */
export function recipeNumbers(d: Drink, size: Size, coldIn = false): Recipe {
  const cold = d.temp === 'cold' || (coldIn && d.temp === 'both');
  const S = shotsOf(d, size);
  const shotMl = S * SHOT_ML;
  const V = d.id === 'espresso' || d.id === 'espresso_double' ? shotMl : SIZE_ML[size];
  const cupMl = d.id === 'espresso' ? CUP_ESPRESSO : d.id === 'espresso_double' ? CUP_DOUBLE : V;
  const L = cold ? round(V * LIQUID_SHARE) : V;
  const pumps = recipePumps(d, size);
  const syrupMl = pumps * PUMP_ML;
  const parts: Part[] = [];
  const out: Recipe = { id: d.id, size, cold, drinkMl: V, cupMl, shots: S, parts, cupMilk: false, pumps };
  const icePart = (bulkMl: number): void => {
    out.ice = round(bulkMl * ICE_G_PER_ML);
    parts.push({ task: 'ice', label: 'Лёд', amount: out.ice, unit: 'г', vol: bulkMl, note: 'занимает остаток стакана' });
  };
  const syrupPart = (name: string): void => {
    if (pumps) parts.push({ task: 'syrup', label: `Сироп (${name})`, amount: pumps, unit: 'помп', vol: syrupMl, note: `${syrupMl} мл` });
  };
  const steamPart = (id: string, x: number): void => {
    out.foamX = x;
    out.foam = foamTarget(x);
    out.zone = [...(STEAM_ZONES[id] ?? ZONE_DEFAULT)] as [number, number];
  };
  const coldBase = (): void => icePart(V - L);

  switch (d.id) {
    case 'espresso':
    case 'espresso_double':
      parts.push(shotPart(S));
      return out;
    case 'americano': {
      if (cold) coldBase();
      parts.push(shotPart(S));
      out.water = L - shotMl;
      parts.push({ task: 'water', label: cold ? 'Холодная вода' : 'Горячая вода', amount: out.water, unit: 'мл', vol: out.water });
      return out;
    }
    case 'cappuccino':
    case 'latte':
    case 'flat_white':
    case 'cappuccino_pumpkin': {
      const x = foamXOf(d.id);
      if (cold) {
        // холодный напиток без пара: молоко наливается в стакан; у капучино оно «холодно взбитое» (x = 0,5), у латте жидкое
        const cx = d.id === 'cappuccino' ? 0.5 : 0;
        coldBase();
        parts.push(shotPart(S));
        syrupPart('тыква');
        out.milk = round((L - shotMl - syrupMl) / (1 + cx));
        out.cupMilk = true;
        if (cx) out.coldX = cx;
        parts.push({ task: 'milk', label: 'Молоко', amount: out.milk, unit: 'мл', vol: L - shotMl - syrupMl, note: cx ? `холодная пена, вместе ${L - shotMl} мл` : undefined });
        return out;
      }
      parts.push(shotPart(S));
      syrupPart('тыква');
      const M = V - shotMl - syrupMl;
      out.milk = round(M / (1 + x));
      steamPart(d.id, x);
      parts.push({ task: 'milk', label: 'Молоко', amount: out.milk, unit: 'мл', vol: M, note: `после пара ${round(M)} мл, пены ${round(M - out.milk)} мл` });
      if (d.id === 'cappuccino_pumpkin') parts.push({ task: 'topping', label: 'Специи', amount: SPICE_G, unit: 'г', vol: 0, note: 'щепотка' });
      return out;
    }
    case 'vanilla_raf':
    case 'raf':
    case 'raf_halva': {
      // классический раф: эспрессо сразу в питчер, холодные сливки и сахар (или сироп), всё взбивается паром, молока нет
      const x = foamXOf(d.id);
      parts.push({ ...shotPart(S), label: S > 1 ? `Эспрессо, ${S} шота, в питчер` : 'Эспрессо в питчер' });
      const M = V - shotMl - syrupMl;
      out.milk = round(M / (1 + x));
      steamPart(d.id, x);
      parts.push({ task: 'milk', label: 'Сливки 10–15% (холодные)', amount: out.milk, unit: 'мл', vol: M, note: `после пара ${round(M)} мл` });
      if (pumps) syrupPart(d.id === 'vanilla_raf' ? 'ваниль' : 'халва');
      else parts.push({ task: 'milk', label: 'Сахар', amount: r1((5 * V) / 200), unit: 'г', vol: 0, note: 'вместе со сливками' });
      return out;
    }
    case 'cocoa':
    case 'chicory_latte': {
      const g = (POWDER_G_200[d.id] as number * V) / 200;
      out.powder = round(g);
      parts.push({ task: 'powder', label: d.id === 'cocoa' ? 'Какао-порошок' : 'Цикорий (порошок)', amount: out.powder, unit: 'г', vol: 0, note: 'растворяется в молоке' });
      const x = foamXOf(d.id);
      out.milk = round(V / (1 + x));
      steamPart(d.id, x);
      parts.push({ task: 'milk', label: 'Молоко', amount: out.milk, unit: 'мл', vol: V, note: `после пара ${V} мл` });
      return out;
    }
    case 'matcha_latte':
    case 'matcha_coconut': {
      const mg = MATCHA_G[size];
      const mw = MATCHA_WATER[size];
      out.matcha = { g: mg, waterMl: mw };
      parts.push({ task: 'whisk', label: `Матча + вода 80°C`, amount: mg, unit: 'г', vol: mw, note: `${mw} мл воды` });
      const top = d.id === 'matcha_coconut' ? TOP_FOAM[size] : 0;
      if (top) out.topFoam = top;
      syrupPart('кокосовый пломбир');
      const x = foamXOf(d.id);
      const M = V - mw - top - syrupMl;
      out.milk = round(M / (1 + x));
      steamPart(d.id, x);
      parts.push({ task: 'milk', label: 'Молоко', amount: out.milk, unit: 'мл', vol: M, note: `после пара ${round(M)} мл` });
      if (top) parts.push({ task: 'foam', label: 'Холодная пенка таро', amount: top, unit: 'мл', vol: top });
      return out;
    }
    case 'latte_sakura':
    case 'latte_banana':
    case 'latte_lemon':
    case 'latte_coconut': {
      parts.push(shotPart(S));
      const name = { latte_sakura: 'сакура-вишня', latte_banana: 'банан', latte_lemon: 'лимонная меренга', latte_coconut: 'кокосовый пломбир' }[d.id] as string;
      syrupPart(name);
      const top = TOP_FOAM[size];
      out.topFoam = top;
      const x = foamXOf('latte');
      const M = V - shotMl - top - syrupMl;
      out.milk = round(M / (1 + x));
      steamPart('latte', x);
      parts.push({ task: 'milk', label: 'Молоко', amount: out.milk, unit: 'мл', vol: M, note: `после пара ${round(M)} мл, жидкого больше, чем пены` });
      parts.push({ task: 'foam', label: d.id === 'latte_banana' ? 'Протеиновая пенка крем-брюле' : 'Холодная пенка таро', amount: top, unit: 'мл', vol: top });
      return out;
    }
    case 'hot_bumble':
    case 'orange_bumble':
    case 'pomegranate_bumble': {
      const hot = d.id === 'hot_bumble';
      if (!hot) coldBase();
      out.juice = round((hot ? V : L) - shotMl);
      parts.push({ task: 'juice', label: hot ? 'Тёплый сок (60–65°C, не кипятить)' : d.id === 'orange_bumble' ? 'Апельсиновый сок' : 'Гранатовый сок', amount: out.juice, unit: 'мл', vol: out.juice });
      parts.push({ ...shotPart(S), label: `Эспрессо, ${S} шота, сверху по ложке` });
      return out;
    }
    case 'espresso_tonic': {
      coldBase();
      out.tonic = round(L - shotMl);
      parts.push({ task: 'tonic', label: 'Тоник', amount: out.tonic, unit: 'мл', vol: out.tonic });
      parts.push({ ...shotPart(S), label: S > 1 ? `Эспрессо, ${S} шота, сверху по ложке` : 'Эспрессо сверху по ложке' });
      return out;
    }
    case 'matcha_bumble':
    case 'matcha_tonic': {
      out.matcha = { g: MATCHA_COLD_G, waterMl: MATCHA_COLD_WATER };
      parts.push({ task: 'whisk', label: 'Матча + вода 80°C (остудить взбиванием)', amount: MATCHA_COLD_G, unit: 'г', vol: MATCHA_COLD_WATER, note: `${MATCHA_COLD_WATER} мл воды` });
      coldBase();
      const rest = round(L - MATCHA_COLD_WATER);
      if (d.id === 'matcha_bumble') {
        out.juice = rest;
        parts.push({ task: 'juice', label: 'Апельсиновый сок', amount: rest, unit: 'мл', vol: rest });
      } else {
        out.tonic = rest;
        parts.push({ task: 'tonic', label: 'Тоник', amount: rest, unit: 'мл', vol: rest });
      }
      return out;
    }
    case 'aerocano': {
      const F = AERO_FOAM[size];
      out.topFoam = F;
      icePart(V - L - F);
      parts.push(shotPart(S));
      out.water = L - shotMl;
      parts.push({ task: 'water', label: 'Холодная вода', amount: out.water, unit: 'мл', vol: out.water });
      parts.push({ task: 'foam', label: 'Сливочная пена (сливки 33% из сифона)', amount: F, unit: 'мл', vol: F, note: 'сверху' });
      parts.push({ task: 'topping', label: 'Карамельный соус', amount: SAUCE_G, unit: 'г', vol: 0 });
      return out;
    }
    case 'tea_sencha':
    case 'tea_assam':
    case 'tea_hibiscus':
    case 'tea_buckwheat':
    case 'tea_currant': {
      const liquid = cold ? L : V;
      const g = round(((TEA_G_200[d.id] as number) * liquid) / 200 * 10) / 10;
      const puree = d.id === 'tea_currant' ? round(0.2 * liquid) : 0;
      const brewMl = liquid - puree;
      out.tea = { g, waterMl: brewMl };
      parts.push({ task: 'brew', label: 'Чай (заварка)', amount: g, unit: 'г', vol: brewMl, note: `${brewMl} мл воды` });
      if (puree) {
        out.juice = puree;
        parts.push({ task: 'juice', label: 'Смородиновое пюре', amount: puree, unit: 'мл', vol: puree });
      }
      if (cold) icePart(V - L);
      return out;
    }
    case 'milkshake_vanilla':
    case 'milkshake_banana': {
      const cream = round(0.3 * V);
      const iceG = round(0.1 * V);
      const banana = d.id === 'milkshake_banana';
      const add = banana ? BANANA_G[size] : syrupMl;
      out.ice = iceG;
      parts.push({ task: 'ice', label: 'Лёд', amount: iceG, unit: 'г', vol: iceG });
      out.milk = round(V - cream - iceG - add);
      out.cupMilk = true;
      parts.push({ task: 'milk', label: 'Молоко', amount: out.milk, unit: 'мл', vol: out.milk, note: 'добирает объём до края' });
      if (banana) {
        out.juice = BANANA_G[size];
        parts.push({ task: 'juice', label: 'Банановое пюре', amount: out.juice, unit: 'г', vol: out.juice });
      } else syrupPart('ваниль');
      parts.push({ task: 'blend', label: 'Мороженое (входит в шаг «Блендер»)', amount: cream, unit: 'г', vol: cream });
      return out;
    }
    case 'frappe_caramel': {
      parts.push(shotPart(S));
      const milk = round(0.35 * V);
      out.milk = milk;
      out.cupMilk = true;
      const iceG = round(V - shotMl - milk - syrupMl);
      out.ice = iceG;
      parts.unshift({ task: 'ice', label: 'Лёд', amount: iceG, unit: 'г', vol: iceG, note: 'добирает объём до края' });
      parts.push({ task: 'milk', label: 'Молоко', amount: milk, unit: 'мл', vol: milk });
      syrupPart('карамель');
      parts.push({ task: 'topping', label: 'Карамельный соус', amount: SAUCE_G, unit: 'г', vol: 0 });
      return out;
    }
    case 'boba_guava':
    case 'boba_raspberry': {
      const brewMl = round(0.35 * V);
      out.tea = { g: 4, waterMl: brewMl };
      parts.push({ task: 'brew', label: 'Чай (заварка)', amount: 4, unit: 'г', vol: brewMl, note: `${brewMl} мл воды` });
      syrupPart(d.id === 'boba_guava' ? 'гуава-персик' : 'малина-лимон');
      icePart(round(V * ICE_SHARE_G / ICE_G_PER_ML));
      out.boba = TAPIOCA_G[size];
      parts.push({ task: 'boba', label: d.id === 'boba_guava' ? 'Тапиока (на дно стакана)' : 'Ежовик (на дно стакана)', amount: out.boba, unit: 'г', vol: out.boba });
      return out;
    }
    case 'protein_milk':
    case 'protein_water': {
      out.powder = PROTEIN_G;
      parts.push({ task: 'powder', label: 'Протеин', amount: PROTEIN_G, unit: 'г', vol: PROTEIN_G });
      const liquid = V - PROTEIN_G;
      if (d.id === 'protein_milk') {
        out.milk = liquid;
        out.cupMilk = true;
        parts.push({ task: 'milk', label: 'Молоко', amount: liquid, unit: 'мл', vol: liquid });
      } else {
        out.water = liquid;
        parts.push({ task: 'water', label: 'Вода', amount: liquid, unit: 'мл', vol: liquid });
      }
      return out;
    }
    default:
      return out;
  }
}

/** Рецепт по id напитка (нет такого — null). */
export function recipeOf(drinkId: string, size: Size, cold = false): Recipe | null {
  const d = drinkById[drinkId];
  return d ? recipeNumbers(d, size, cold) : null;
}

/** Сумма занятого места, мл (для проверки: должна сходиться с объёмом напитка). */
export const partsVolume = (r: Recipe): number => r.parts.reduce((a, p) => a + p.vol, 0);
