// Книга рецептов: чистая функция «состояние -> HTML». Обработчики кликов — в старом ядре (data-book*).
import { ADDONS, ALT_MILK, BOTTLES, DRINKS, DRINK_NEEDS, ENGINE, EQUIPMENT, FOOD, MAX_RANK, STATIONS, SYRUPS, needsMilk, rankInfo } from '../game/menu';
import type { Drink, Family, RecipeStep, Temp } from '../game/types';

const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

const SIZE_TXT = (d: Drink): string =>
  Object.entries(d.sizes)
    .map(([s, p]) => `${s.replace('.', ',')} л — ${p} ₽`)
    .join(' · ');
const TEMP: Record<Temp, string> = { hot: 'горячий', cold: 'холодный', both: 'горячий или холодный' };
const ARG: Record<string, Record<string, string>> = {
  steam: { thick: 'плотная пена', thin: 'лёгкая пена', micro: 'микропена' },
  pour: { layer: 'слоями' },
  juice: { 'горячий': 'горячая основа' }
};
const STEP_TXT = (s: RecipeStep): string => {
  const nm = STATIONS[s.st] || s.st;
  if (!s.arg) return nm;
  if (s.st === 'brew') {
    const [t, m] = s.arg.split('/');
    return `${nm} (${t}°C, ${m} мин)`;
  }
  return `${nm} (${ARG[s.st]?.[s.arg] ?? s.arg})`;
};
const FAM: Record<Family, string> = {
  espresso: 'Эспрессо', milk: 'Молочные', raf: 'Раф', powder: 'Порошковые', matcha: 'Матча', tea: 'Чай',
  bumble: 'Бамблы', tonic: 'Тоники', aero: 'Аэрокано', foamlatte: 'Латте с пенкой', shake: 'Шейки и фраппе',
  boba: 'Бабл ти', protein: 'Протеин'
};
export type BookTab = 'drinks' | 'food' | 'extra';
const BOOK_TABS: readonly (readonly [BookTab, string])[] = [
  ['drinks', 'Напитки'],
  ['food', 'Еда'],
  ['extra', 'Добавки']
];

const EQ_NAME: Record<string, string> = { milk: 'Молоко и капучино', ...Object.fromEntries(EQUIPMENT.map((e) => [e.id, e.name])) };

/** Чего не хватает для напитка из купленного оборудования. */
const missing = (d: Drink, eq: Readonly<Record<string, boolean>>): string[] => [...(needsMilk(d) ? ['milk'] : []), ...(DRINK_NEEDS[d.id] ?? [])].filter((n) => !eq[n]);

function card(d: Drink, rank: number, eq: Readonly<Record<string, boolean>>): string {
  const open = d.rank <= rank;
  if (!open)
    return `<div class="bk lock"><div class="bkTop"><b>? ? ?</b><em>ранг ${d.rank}</em></div><p>Откроется на ранге «${esc(rankInfo(d.rank).title)}».</p></div>`;
  const miss = missing(d, eq);
  const made = d.id in ENGINE;
  const steps = d.steps.map((s) => `<li>${esc(STEP_TXT(s))}</li>`).join('');
  const need = miss.length
    ? `<p class="bkNeed">Нужно купить: ${miss.map((m) => esc(EQ_NAME[m] ?? m)).join(', ')}</p>`
    : '<p class="bkReady">Можно готовить</p>';
  return `<div class="bk${made && !miss.length ? '' : ' soon'}"><div class="bkTop"><b>${esc(d.name)}</b><em>${esc(FAM[d.family] || '')}</em></div>
<div class="bkSub">${TEMP[d.temp]} · ${esc(SIZE_TXT(d))}</div>
<ol class="bkSteps">${steps}</ol>${d.note ? `<p class="bkNote">${esc(d.note)}</p>` : ''}${need}</div>`;
}
function tabDrinks(rank: number, eq: Readonly<Record<string, boolean>>, fam: string): string {
  const all = [...DRINKS].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'ru'));
  const present = Array.from(new Set(all.filter((d) => d.rank <= rank).map((d) => d.family)));
  const chips = ['all', ...present]
    .map((f) => `<button type="button" class="chip${f === fam ? ' on' : ''}" data-bookfam="${f}">${f === 'all' ? 'Все' : esc(FAM[f as Family] ?? f)}</button>`)
    .join('');
  const list = all.filter((d) => fam === 'all' || d.family === fam || d.rank > rank);
  const shown = fam === 'all' ? list : list.filter((d) => d.family === fam);
  return `<div class="bkChips">${chips}</div><div class="bkGrid">${shown.map((d) => card(d, rank, eq)).join('')}</div>`;
}

function tabFood(rank: number): string {
  const sec: Record<string, typeof FOOD[number][]> = {};
  FOOD.forEach((f) => (sec[f.section] ??= []).push(f));
  const bot = BOTTLES.filter((b) => b.rank <= rank);
  let h =
    '<p class="bkNote">Блюда лежат готовыми на витрине. Гость называет блюдо, вы достаёте его; если просит разогреть, греете в микроволновке. Витрины и микроволновка покупаются в магазине.</p>';
  Object.entries(sec).forEach(([s, arr]) => {
    const open = arr.filter((f) => f.rank <= rank);
    h += `<h4>${esc(s)} <small>${open.length}/${arr.length}</small></h4><div class="bkList">${
      open.length
        ? open.map((f) => `<span>${esc(f.name)}<i>${f.price} ₽${f.heatable ? ' · можно разогреть' : ''}</i></span>`).join('')
        : '<em>Пока не открыто</em>'
    }</div>`;
  });
  h += `<h4>Напитки в бутылках <small>${bot.length}/${BOTTLES.length}</small></h4><div class="bkList">${
    bot.length ? bot.map((b) => `<span>${esc(b.name)}<i>${b.price} ₽</i></span>`).join('') : '<em>Пока не открыто</em>'
  }</div>`;
  return h;
}
function tabExtra(rank: number): string {
  const g = <T extends { rank: number }>(title: string, arr: readonly T[], fmt: (x: T) => string): string => {
    const o = arr.filter((x) => x.rank <= rank);
    return `<h4>${title} <small>${o.length}/${arr.length}</small></h4><div class="bkList">${o.length ? o.map(fmt).join('') : '<em>Пока не открыто</em>'}</div>`;
  };
  return (
    g('Сиропы', SYRUPS, (s) => `<span>${esc(s.name)}<i>${s.price} ₽</i></span>`) +
    g('Альтернативное молоко', ALT_MILK, (m) => `<span>${esc(m.name)}<i>+${m.surcharge['0.2']}…${m.surcharge['0.6']} ₽</i></span>`) +
    g('Добавки', ADDONS, (a) => `<span>${esc(a.name)}<i>${a.price} ₽</i></span>`)
  );
}

export interface BookState { rank: number; tab: BookTab | string; eq?: Readonly<Record<string, boolean>>; fam?: string }
export function bookHTML(state: BookState): string {
  const { rank, tab } = state;
  const eq = state.eq ?? {};
  const tabs = BOOK_TABS.map(
    ([id, n]) => `<button type="button" class="tab${id === tab ? ' on' : ''}" data-booktab="${id}">${n}</button>`
  ).join('');
  const body = tab === 'food' ? tabFood(rank) : tab === 'extra' ? tabExtra(rank) : tabDrinks(rank, eq, state.fam ?? 'all');
  const total = DRINKS.length;
  const open = DRINKS.filter((d) => d.rank <= rank).length;
  return `<div class="book"><div class="bookHead"><div><h2>Книга рецептов</h2><span>Ранг ${rank} из ${MAX_RANK}: ${esc(rankInfo(rank).title)} · напитков открыто ${open} из ${total}</span></div>
<button type="button" class="ghost" data-bookclose="1">Закрыть</button></div><div class="tabs">${tabs}</div><div class="bookBody">${body}</div></div>`;
}
