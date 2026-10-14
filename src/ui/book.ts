// Книга рецептов: чистая функция «состояние -> HTML». Обработчики кликов — в старом ядре (data-book*).
import { ADDONS, ALT_MILK, BOTTLES, DRINKS, DRINK_NEEDS, ENGINE, EQUIPMENT, FOOD, MAX_RANK, SYRUPS, needsMilk, rankInfo } from '../game/menu';
import { lesson, lessonKeysOfDrink } from '../game/lessons';
import { cardVariants, recipeCard, type RecipeCard } from '../game/recipeCard';
import { TUTORIALS, coachSteps, equipmentName, tutorialEqsOfDrink } from '../game/tutorial';
import type { Drink, Family, Size, Temp } from '../game/types';

const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

const ru1 = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');
const TEMP: Record<Temp, string> = { hot: 'горячий', cold: 'холодный', both: 'горячий или холодный' };
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

const money = (n: number): string => '₽ ' + n.toLocaleString('ru-RU');

/** Цены нужных покупок. То, чего ещё нет в магазине (ждёт другую покупку), называем без цены. */
function needText(miss: string[], costs: Readonly<Record<string, number>>, avail: Readonly<Record<string, boolean>>): string {
  const now = miss.filter((m) => avail[m] !== false);
  const later = miss.filter((m) => avail[m] === false);
  const nm = (m: string): string => esc(EQ_NAME[m] ?? m);
  const a = now.length ? `Нужно купить: ${now.map((m) => nm(m) + (costs[m] ? ' — ' + money(costs[m]) : '')).join(', ')}.` : '';
  const b = later.length ? `${now.length ? ' Потом в магазине появится' : 'Сначала нужны другие покупки. Потом в магазине появится'}: ${later.map(nm).join(', ')}.` : '';
  return `<p class="bkNeed">${a}${b}</p>`;
}

/** Состав одной строкой: «Шоты 30 мл · Молоко 113 мл · …». Числа те же, что цели налива в баре (recipeCard → recipeNumbers). */
const partsText = (c: RecipeCard): string =>
  c.parts.map((p) => `${esc(p.label)} ${p.unit === 'помп' ? p.amount + ' ' + (p.amount === 1 ? 'помпа' : p.amount < 5 ? 'помпы' : 'помп') : ru1(p.amount) + ' ' + p.unit}`).join(' · ');
/** Пена: сколько мл получается из молока при вспенивании. */
function foamText(c: RecipeCard): string {
  const r = c.recipe;
  if (r.foamX && r.milk) return `+${Math.round(r.foamX * 100)}%: ≈${Math.round(r.milk * r.foamX)} мл пены, ${Math.round(r.milk * (1 + r.foamX))} мл всего`;
  if (r.coldX && r.milk) return `холодная, +${Math.round(r.coldX * 100)}%`;
  if (r.topFoam) return `сверху ${r.topFoam} мл`;
  return '—';
}
const variantName = (c: RecipeCard, d: Drink): string => (d.temp === 'both' ? (c.cold ? 'холодный ' : 'горячий ') : '') + c.sizeLabel;
const shotsText = (n: number): string => (n === 0 ? '—' : n === 1 ? '1 шот' : `${n} шота`);

/** Таблица «размер → шоты → состав → пена → цена» и шаги каждого варианта (они лежат под спойлером, первый открыт). */
function recipeBlock(d: Drink): string {
  const cards = cardVariants(d).map((v) => recipeCard(d.id, v.size, v.cold)).filter((c): c is RecipeCard => !!c);
  const rows = cards
    .map((c) => `<tr><td>${esc(variantName(c, d))}</td><td>${shotsText(c.shots)}</td><td>${partsText(c)}</td><td>${esc(foamText(c))}</td><td>${c.price}&nbsp;₽</td></tr>`)
    .join('');
  const table = `<table class="bkTbl"><thead><tr><th>Размер</th><th>Шоты</th><th>Состав</th><th>Пена</th><th>Цена</th></tr></thead><tbody>${rows}</tbody></table>`;
  const first = cards[0];
  const temp = first?.temperature ? `<p class="bkTemp">${esc(first.temperature)}</p>` : '';
  const cup = first ? `<p class="bkCup">${cards.map((c) => `${esc(variantName(c, d))}: чашка ${c.cupMl} мл`).filter((t, i, a) => a.indexOf(t) === i).join(' · ')}</p>` : '';
  const steps = cards
    .map(
      (c, i) =>
        `<details class="bkVar"${i === 0 ? ' open' : ''}><summary>${esc(variantName(c, d))} · шаги</summary><ol class="bkSteps">${c.steps
          .map((x) => `<li><b>${esc(x.label)}</b>${x.detail ? ': ' + esc(x.detail) : ''}</li>`)
          .join('')}</ol></details>`
    )
    .join('');
  return `${table}${temp}${cup}${steps}`;
}

function card(d: Drink, rank: number, eq: Readonly<Record<string, boolean>>, costs: Readonly<Record<string, number>>, avail: Readonly<Record<string, boolean>>, tut: string): string {
  const open = d.rank <= rank;
  if (!open)
    return `<div class="bk lock"><div class="bkTop"><b>? ? ?</b><em>ранг ${d.rank}</em></div><p>Откроется на ранге «${esc(rankInfo(d.rank).title)}».</p></div>`;
  const miss = missing(d, eq);
  const made = d.id in ENGINE;
  const need = miss.length ? needText(miss, costs, avail) : '<p class="bkReady">Можно готовить</p>';
  return `<div class="bk${made && !miss.length ? '' : ' soon'}"><div class="bkTop"><b>${esc(d.name)}</b><em>${esc(FAM[d.family] || '')}</em></div>
<div class="bkSub">${TEMP[d.temp]} · ранг ${d.rank} «${esc(rankInfo(d.rank).title)}»</div>
<p class="bkIng">Ингредиенты: ${esc(d.ing.join(', '))}</p>${recipeBlock(d)}${d.note ? `<p class="bkNote">${esc(d.note)}</p>` : ''}${need}${hintBlock(d, tut)}</div>`;
}
/** Кнопка «Подсказка»: показывает коуча по станциям напитка ещё раз. */
function hintBlock(d: Drink, tut: string): string {
  const eqs = tutorialEqsOfDrink(d.id);
  const sz = Object.keys(d.sizes)[0] as Size;
  const rc = recipeCard(d.id, sz);
  const steps = lessonKeysOfDrink(d.id).flatMap((k) => lesson(k, { drinkId: d.id, drinkName: d.name, steam: true, foam: rc?.recipe.foam, cream: d.family === 'raf', shots: rc?.shots, ml: rc?.recipe.milk }) ?? []);
  if (!eqs.length && !steps.length) return '';
  const shown = tut === d.id;
  const body = shown
    ? `<div class="bkCoach"><i class="av">М</i><div>${steps.map((l) => `<p><b>${esc(l.title)}.</b> ${esc(l.where)}<br>${l.steps.map((x, i) => `${i + 1}. ${esc(x)}`).join('<br>')}</p>`).join('')}${eqs.map((e) => `<p><b>${esc(equipmentName(e))}.</b> ${esc(TUTORIALS[e]?.where ?? '')}<br>${coachSteps(e)}</p>`).join('')}</div></div>`
    : '';
  return `<button type="button" class="chip bkHint${shown ? ' on' : ''}" data-booktut="${esc(d.id)}">Подсказка</button>${body}`;
}
function tabDrinks(rank: number, eq: Readonly<Record<string, boolean>>, fam: string, costs: Readonly<Record<string, number>>, avail: Readonly<Record<string, boolean>>, tut: string): string {
  const all = [...DRINKS].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'ru'));
  const present = Array.from(new Set(all.filter((d) => d.rank <= rank).map((d) => d.family)));
  const chips = ['all', ...present]
    .map((f) => `<button type="button" class="chip${f === fam ? ' on' : ''}" data-bookfam="${f}">${f === 'all' ? 'Все' : esc(FAM[f as Family] ?? f)}</button>`)
    .join('');
  const list = all.filter((d) => fam === 'all' || d.family === fam || d.rank > rank);
  const shown = fam === 'all' ? list : list.filter((d) => d.family === fam);
  let last = 0;
  const cards = shown
    .map((d) => {
      const head = d.rank !== last ? `<h4 class="bkRank">Ранг ${d.rank}: ${esc(rankInfo(d.rank).title)}${d.rank > rank ? ' <small>(ещё закрыто)</small>' : ''}</h4>` : '';
      last = d.rank;
      return head + card(d, rank, eq, costs, avail, tut);
    })
    .join('');
  return `<div class="bkChips">${chips}</div><div class="bkGrid">${cards}</div>`;
}

function tabFood(rank: number): string {
  const sec: Record<string, typeof FOOD[number][]> = {};
  FOOD.forEach((f) => (sec[f.section] ??= []).push(f));
  const bot = BOTTLES.filter((b) => b.rank <= rank);
  let h =
    '<p class="bkNote">Блюда лежат готовыми на витрине. Гость называет блюдо, вы достаёте его; если просит разогреть, греете в микроволновке. Витрины и микроволновка появляются в магазине с ростом ранга.</p>';
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

export interface BookState { rank: number; tab: BookTab | string; eq?: Readonly<Record<string, boolean>>; fam?: string;
  /** цены оборудования в магазине: id → ₽ */
  costs?: Readonly<Record<string, number>>;
  /** что сейчас есть в магазине: id → показывается ли карточка (false — ждёт другую покупку или ранг) */
  avail?: Readonly<Record<string, boolean>>;
  /** карточка напитка, у которой раскрыта подсказка */
  tut?: string;
}
export function bookHTML(state: BookState): string {
  const { rank, tab } = state;
  const eq = state.eq ?? {};
  const tabs = BOOK_TABS.map(
    ([id, n]) => `<button type="button" class="tab${id === tab ? ' on' : ''}" data-booktab="${id}">${n}</button>`
  ).join('');
  const body = tab === 'food' ? tabFood(rank) : tab === 'extra' ? tabExtra(rank) : tabDrinks(rank, eq, state.fam ?? 'all', state.costs ?? {}, state.avail ?? {}, state.tut ?? '');
  const total = DRINKS.length;
  const open = DRINKS.filter((d) => d.rank <= rank).length;
  return `<div class="book"><div class="bookHead"><div><h2>Книга рецептов</h2><span>Ранг ${rank} из ${MAX_RANK}: ${esc(rankInfo(rank).title)} · напитков открыто ${open} из ${total}</span></div>
<button type="button" class="ghost" data-bookclose="1">Закрыть</button></div><div class="tabs">${tabs}</div><div class="bookBody">${body}</div></div>`;
}
