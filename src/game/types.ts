/** Общие типы чистой логики. Никаких зависимостей от DOM и рендера. */

export type Rng = () => number;

export type Size = '0.2' | '0.3' | '0.4' | '0.6';
export type Temp = 'hot' | 'cold' | 'both';
export type CustomerType = 'regular' | 'student' | 'hurry';
export type PaceId = 'cozy' | 'normal' | 'hard';
/** Качество напитка: 0 плохо, 1 нормально, 2 идеально. */
export type Quality = 0 | 1 | 2;

export type Family =
  | 'espresso' | 'milk' | 'foamlatte' | 'raf' | 'matcha' | 'tea' | 'tonic' | 'boba'
  | 'bumble' | 'aero' | 'powder' | 'protein' | 'shake';

export type StationId =
  | 'grind' | 'tamp' | 'shot' | 'water' | 'milk' | 'steam' | 'pour' | 'syrup' | 'ice' | 'cream' | 'foam'
  | 'whisk' | 'brew' | 'juice' | 'tonic' | 'blend' | 'boba' | 'powder' | 'shake' | 'topping' | 'shot_only';

export interface RecipeStep {
  st: StationId;
  arg?: string;
}

export interface Drink {
  id: string;
  name: string;
  fullName: string;
  family: Family;
  section: string;
  steps: RecipeStep[];
  rank: number;
  temp: Temp;
  ing: string[];
  note: string;
  /** шоты эспрессо: число или 'size' (по размеру, см. volumes.ts) */
  shots: number | 'size';
  sizes: Partial<Record<Size, number>>;
  coldSizes: Size[];
}

export interface Food {
  id: string;
  name: string;
  section: string;
  weight: number;
  price: number;
  kind: string;
  case: string;
  heatable: boolean;
  rank: number;
}

export interface Bottle { id: string; name: string; amount: number; unit: string; price: number; rank: number }
export interface Syrup { id: string; name: string; price: number; rank: number }
export interface AltMilk { id: string; name: string; surcharge: Record<Size, number>; rank: number }
export interface Addon { id: string; name: string; price: number; rank: number }

export interface MenuData {
  stations: Record<StationId, string>;
  drinks: Drink[];
  bottles: Bottle[];
  food: Food[];
  syrups: Syrup[];
  altMilk: AltMilk[];
  addons: Addon[];
}

export interface RankDef { rank: number; title: string; minDay: number; minRating: number; minServed: number }
export interface EquipmentDef { id: string; name: string; rank: number; cost: number; unlocks: string }
export interface ProgressionData {
  ranks: RankDef[];
  equipment: EquipmentDef[];
  promotions: { seniorRank: number; managerAfterRank: number; managerExtraDays: number };
}

/** Блюдо с витрины, которое гость берёт к напитку. */
export interface OrderFood { id: string; name: string; price: number; case: string; heat: boolean }

/** Заказ гостя в терминах механики бара. */
export interface Order {
  id: string;
  /** Ключ механики в баре (старое ядро): espresso, americano, latte… */
  key: string;
  name: string;
  size: Size;
  strong: boolean;
  /** шоты эспрессо в этом заказе */
  shots: number;
  price: number;
  /** Цена напитка выбранного размера без надбавок за сироп и еду. */
  base: number;
  syrup: { name: string; shelf: string; pumps: number } | null;
  syrupImplied: boolean;
  altMilk: { name: string } | null;
  cold: boolean;
  food: OrderFood | null;
  line: string;
}
