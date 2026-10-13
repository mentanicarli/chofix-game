import type { CustomerType, Rng } from './types';

/** Что нужно реплике от заказа. */
export interface SpokenOrder {
  id: string;
  name: string;
  strong?: boolean;
  cold?: boolean;
  syrup?: { name: string } | null;
  syrupImplied?: boolean;
  altMilk?: { name: string } | null;
  food?: { name: string; heat: boolean } | null;
}

const SYR_INSTR: Readonly<Record<string, string>> = {
  'Ваниль': 'ванильным',
  'Карамель': 'карамельным',
  'Миндаль': 'миндальным',
  'Соленая карамель': 'солёно-карамельным',
  'Каштан': 'каштановым',
  'Халва': 'халвовым',
  'Тыква': 'тыквенным',
  'Кокос': 'кокосовым',
  'Персик': 'персиковым',
  'Лаванда': 'лавандовым'
};
const ALT_PREP: Readonly<Record<string, string>> = {
  'Овсяное': 'овсяном',
  'Миндальное': 'миндальном',
  'Кокосовое': 'кокосовом',
  'Банановое': 'банановом',
  'Безлактозное': 'безлактозном'
};
const NAME_ACC: Readonly<Record<string, string>> = {
  espresso_double: 'двойной эспрессо',
  americano: 'американо',
  cappuccino: 'капучино',
  latte: 'латте',
  flat_white: 'флэт уайт',
  vanilla_raf: 'ванильный раф',
  raf: 'раф',
  raf_halva: 'раф со сливочной халвой'
};

export const pick = <T>(rng: Rng, a: readonly T[]): T => a[Math.floor(rng() * a.length) % a.length] as T;

const OPEN: Record<CustomerType, readonly string[]> = {
  regular: ['Здравствуйте! ', 'Добрый день. ', 'Доброе утро. ', ''],
  student: ['Привет! ', 'Хай. ', 'Можно мне ', ''],
  hurry: ['Мне быстро, ', 'Я опаздываю на пару, ', 'Срочно, ']
};
const ASK: Record<CustomerType, readonly string[]> = {
  regular: ['Мне, пожалуйста, ', 'Можно ', 'Будьте добры, ', 'Хочу '],
  student: ['мне ', 'дайте ', 'мне бы ', 'можно '],
  hurry: ['дайте ', 'мне ', 'сделайте ']
};
const END: Record<CustomerType, readonly string[]> = {
  regular: ['', ' Спасибо!', ''],
  student: ['', ' Спасибо)', ''],
  hurry: [' Пожалуйста!', '', ' Только быстро!']
};

/** Полная фраза гостя. */
export function say(order: SpokenOrder, type: CustomerType | string, rng: Rng = Math.random): string {
  const t: CustomerType = type === 'student' || type === 'hurry' ? type : 'regular';
  let core = NAME_ACC[order.id] ?? order.name.toLowerCase();
  if (order.cold) core = 'холодный ' + core;
  const mods: string[] = [];
  if (order.altMilk) mods.push('на ' + (ALT_PREP[order.altMilk.name] ?? order.altMilk.name.toLowerCase()) + ' молоке');
  if (order.syrup && !order.syrupImplied)
    mods.push('с ' + (SYR_INSTR[order.syrup.name] ?? order.syrup.name.toLowerCase()) + ' сиропом');
  if (order.strong) mods.push('покрепче');
  if (order.food) mods.push(`и «${order.food.name}»`);
  let s = pick(rng, OPEN[t]);
  const ask = pick(rng, ASK[t]);
  s = s.endsWith('мне ') ? s + core : s + ask + core;
  if (mods.length) s += ' ' + mods.join(' ');
  s = s.trim() + (/[.!?)]$/.test(s.trim()) ? '' : '.');
  if (order.food?.heat) s += t === 'hurry' ? ' Разогрейте, только быстро!' : ' Разогрейте его, пожалуйста.';
  s += pick(rng, END[t]);
  s = s.replace(/\s+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
