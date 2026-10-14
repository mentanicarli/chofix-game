import { FORCED_SYRUP, ENGINE, ICED, drinkById, rankInfo } from './menu';
import { buildTasks, brewOf, stepLabels } from './recipes';
import type { Drink, Size } from './types';
import { PUMP_ML, SHOT_G, SHOT_ML, SIZE_ML, cupScale, recipeNumbers, type Part, type Recipe } from './volumes';

/* ---------- Карточка рецепта: одна функция для бара и книги ----------
   Шаги идут ровно в том порядке, как их собирает buildTasks для заказа; числа — из recipeNumbers, как цели налива в баре. */

export interface CardStep {
  /** шаг бара (grind, shot, milk…) */
  task: string;
  /** подпись, как в билете: «Шот 1/2» */
  label: string;
  /** что и сколько делать на этом шаге */
  detail: string;
}
export interface RecipeCard {
  id: string;
  name: string;
  size: Size;
  cold: boolean;
  /** «0,3 л» или «30 мл» (эспрессо без выбора размера) */
  sizeLabel: string;
  /** объём напитка и чашки, мл; масштаб модели чашки */
  drinkMl: number;
  cupMl: number;
  cupK: number;
  shots: number;
  price: number;
  rank: number;
  rankTitle: string;
  /** ключ механики бара и шаги (как buildTasks) */
  key: string;
  tasks: string[];
  steps: CardStep[];
  parts: Part[];
  /** температура: пар или заварка, одной строкой (пусто, если нет) */
  temperature: string;
  recipe: Recipe;
}

const ru = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');

/** Размер словами: 0,3 л; для эспрессо — объём напитка. */
export function sizeLabelOf(d: Drink, size: Size): string {
  if (d.id === 'espresso') return '30 мл';
  if (d.id === 'espresso_double') return '60 мл';
  return `${ru(SIZE_ML[size] / 1000)} л`;
}

/** Ключ механики бара для напитка меню и холодности. */
export function keyFor(d: Drink, cold: boolean): string {
  const k = ENGINE[d.id] ?? d.id;
  return cold && k in ICED ? (ICED[k] as string) : k;
}

/** Холодный ли вариант нужно считать на этом размере (старые напитки и чаи: по льдогенератору). */
export const canBeCold = (d: Drink, size: Size): boolean => d.temp === 'cold' || (d.temp === 'both' && d.coldSizes.includes(size));

/** Все варианты (размер, холодный), которые игрок может встретить: горячие размеры и холодные. Для напитков «только холодных» — только холодные. */
export function cardVariants(d: Drink): { size: Size; cold: boolean }[] {
  const out: { size: Size; cold: boolean }[] = [];
  for (const s of Object.keys(d.sizes) as Size[]) {
    if (d.temp !== 'cold') out.push({ size: s, cold: false });
    if (d.temp === 'both' && d.coldSizes.includes(s) && coldHasBar(d)) out.push({ size: s, cold: true });
    if (d.temp === 'cold') out.push({ size: s, cold: true });
  }
  return out;
}
/** У холодного варианта есть механика: старые напитки с ICED и чаи. */
const coldHasBar = (d: Drink): boolean => (ENGINE[d.id] ?? '') in ICED || d.family === 'tea';

function stepDetail(task: string, d: Drink, r: Recipe, i: number, tasks: readonly string[]): string {
  const raf = d.family === 'raf';
  switch (task) {
    case 'grind': return `около ${SHOT_G} г кофе`;
    case 'tamp': return 'давление около 15 кг';
    case 'shot': {
      const dest = raf ? 'сразу в питчер' : tasks.filter((x) => x === 'shot').length > 1 ? 'в ту же чашку' : d.steps.some((s) => s.st === 'pour' && s.arg === 'layer') ? 'в чашку или кувшин' : 'в чашку';
      return `${SHOT_ML} мл за 24–33 с, ${dest}`;
    }
    case 'water': return `${r.water} мл${d.id === 'protein_water' ? '' : r.cold ? ' холодной воды' : ' горячей воды'}`;
    case 'ice': return `${r.ice} г`;
    case 'milk': return raf ? `${r.milk} мл холодных сливок 10–15% в питчер${r.pumps ? '' : ', сахар'}` : r.cupMilk ? `${r.milk} мл молока в стакан` : `${r.milk} мл молока в питчер`;
    case 'steam': return `${r.zone ? `до ${r.zone[0]}–${r.zone[1]}°C, ` : ''}пена +${Math.round((r.foamX ?? 0) * 100)}% к объёму`;
    case 'pour': return raf || d.family === 'milk' || d.family === 'foamlatte' || d.family === 'matcha' || d.family === 'powder' ? 'переливаем в чашку, рисунок по контуру' : 'в чашку';
    case 'syrup': return `${r.pumps || 1} помп (${(r.pumps || 1) * PUMP_ML} мл)`;
    case 'juice': return d.id === 'milkshake_banana' ? `${r.juice} г банана (пюре)` : d.id === 'tea_currant' ? `${r.juice} мл смородинового пюре` : `${r.juice} мл${d.id === 'hot_bumble' ? ', тёплый (60–65°C, не кипятить)' : ''}`;
    case 'tonic': return `${r.tonic} мл`;
    case 'powder': return `${r.powder} г`;
    case 'boba': return `${r.boba} г на дно стакана`;
    case 'topping': return d.steps.find((s) => s.st === 'topping')?.arg === 'специи' ? 'щепотка специй, около 0,5 г' : 'карамельный соус, около 8 г';
    case 'whisk': return r.matcha ? `${r.matcha.g} г матчи в ${r.matcha.waterMl} мл воды 80°C` : '';
    case 'brew': {
      const b = brewOf(d.id);
      return r.tea ? `${b.temp}°C, ${b.minutes} мин, ${ru(r.tea.g)} г чая на ${r.tea.waterMl} мл воды` : '';
    }
    case 'blend': return d.family === 'shake' && d.id !== 'frappe_caramel' ? `взбить вместе с мороженым (${Math.round(0.3 * r.drinkMl)} г)` : 'взбить, пока не станет гладко';
    case 'shake': return d.family === 'boba' ? 'чай, сироп и лёд вместе, шарики не кладём' : 'встряхнуть';
    case 'foam': return `${r.topFoam ?? ''} мл${d.id === 'latte_banana' ? ' протеиновой пенки' : ' холодной пенки'} сверху`.trim();
    case 'whip': return `${r.topFoam} мл сливочной пены (сливки 33% из сифона) сверху`;
    case 'layer': return d.id === 'espresso_tonic' || d.id === 'orange_bumble' || d.id === 'pomegranate_bumble' ? 'эспрессо сверху по ложке, слои не смешивать' : 'матча сверху по ложке, слои не смешивать';
    case 'food': return '';
    default: return tasks[i] ?? '';
  }
}

/** Температура одной строкой: пар или заварка. */
function temperatureOf(d: Drink, r: Recipe): string {
  const bits: string[] = [];
  if (r.zone) bits.push(`пар до ${r.zone[0]}–${r.zone[1]}°C`);
  const b = d.steps.find((s) => s.st === 'brew');
  if (b) bits.push(`заварка ${brewOf(d.id).temp}°C, ${brewOf(d.id).minutes} мин`);
  if (r.matcha) bits.push('вода для матчи 80°C');
  if (d.id === 'hot_bumble') bits.push('сок 60–65°C');
  return bits.join('; ');
}

/** Карточка рецепта напитка меню для размера и холодности. */
export function recipeCard(drinkId: string, size: Size, cold = false): RecipeCard | null {
  const d = drinkById[drinkId];
  if (!d) return null;
  const sz = d.sizes[size] !== undefined ? size : ((Object.keys(d.sizes)[0] as Size | undefined) ?? size);
  const r = recipeNumbers(d, sz, cold);
  const variantCold = r.cold && d.temp === 'both';
  const key = keyFor(d, variantCold);
  const tasks = buildTasks(key, { cold: variantCold, syrup: !!FORCED_SYRUP[d.id], shots: r.shots });
  const labels = stepLabels(tasks, d.id);
  return {
    id: d.id,
    name: d.name,
    size: sz,
    cold: r.cold,
    sizeLabel: sizeLabelOf(d, sz),
    drinkMl: r.drinkMl,
    cupMl: r.cupMl,
    cupK: cupScale(r.cupMl),
    shots: r.shots,
    price: d.sizes[sz] ?? 0,
    rank: d.rank,
    rankTitle: rankInfo(d.rank).title,
    key,
    tasks,
    steps: tasks.map((t, i) => ({ task: t, label: labels[i] as string, detail: stepDetail(t, d, r, i, tasks) })),
    parts: r.parts,
    temperature: temperatureOf(d, r),
    recipe: r
  };
}
