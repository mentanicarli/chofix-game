// Книга рецептов: чистая функция «состояние -> HTML». Обработчики кликов — в старом ядре (data-book*).
import { ADDONS, ALT_MILK, BOTTLES, DRINKS, DRINK_NEEDS, ENGINE, EQUIPMENT, FOOD, MAX_RANK, SYRUPS, needsMilk, rankInfo } from '../game/menu';
import { lesson, lessonKeysOfDrink } from '../game/lessons';
import { cardVariants, recipeCard, sizeLabelOf, type RecipeCard } from '../game/recipeCard';
import { MODEL_TAGS } from '../game/drinkModel';
import { drinkText, glossaryGroups, stepsForShots } from '../game/content';
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
export type BookTab = 'drinks' | 'food' | 'extra' | 'guide';
const BOOK_TABS: readonly (readonly [BookTab, string])[] = [
  ['drinks', 'Напитки'],
  ['food', 'Еда'],
  ['extra', 'Добавки'],
  ['guide', 'Справочник']
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
  if (r.topFoam) return `поверх напитка ${r.topFoam} мл`;
  return '—';
}
const variantName = (c: RecipeCard, d: Drink): string => (d.temp === 'both' ? (c.cold ? 'холодный ' : 'горячий ') : '') + c.sizeLabel;
const shotsText = (n: number): string => (n === 0 ? '—' : n === 1 ? '1 шот' : `${n} шота`);

/** Выбранный вариант напитка в книге: размер и горячий/холодный. */
export interface BookPick { size: Size; cold: boolean }
/** Приводит выбор к существующему варианту: холодный без механики недоступен, размер подбирается из доступных. */
export function pickVariant(d: Drink, sel?: Partial<BookPick>): BookPick {
  const vars = cardVariants(d);
  let cold = sel?.cold ?? d.temp === 'cold';
  if (!vars.some((v) => v.cold === cold)) cold = !cold;
  const sizes = vars.filter((v) => v.cold === cold).map((v) => v.size);
  const size = sel?.size && sizes.includes(sel.size) ? sel.size : (sizes[0] ?? (Object.keys(d.sizes)[0] as Size));
  return { size, cold };
}

/** Переключатели температуры и размера (кнопки; состояние живёт в старом ядре, data-booksize / data-bookcold). */
function pickBlock(d: Drink, pick: BookPick): string {
  const vars = cardVariants(d);
  const canTemp = vars.some((v) => v.cold) && vars.some((v) => !v.cold);
  const sizes = vars.filter((v) => v.cold === pick.cold).map((v) => v.size);
  const temp = canTemp
    ? `<div class="bkPick" role="group" aria-label="Температура">${[false, true]
        .map((c) => `<button type="button" class="chip${c === pick.cold ? ' on' : ''}" aria-pressed="${c === pick.cold}" data-bookcold="${esc(d.id)}|${c ? 1 : 0}">${c ? 'Холодный' : 'Горячий'}</button>`)
        .join('')}</div>`
    : '';
  const size =
    sizes.length > 1
      ? `<div class="bkPick" role="group" aria-label="Размер">${sizes
          .map((z) => `<button type="button" class="chip${z === pick.size ? ' on' : ''}" aria-pressed="${z === pick.size}" data-booksize="${esc(d.id)}|${z}">${esc(sizeLabelOf(d, z))}</button>`)
          .join('')}</div>`
      : '';
  return temp || size ? `<div class="bkPicks">${temp}${size}</div>` : '';
}

/** Блок «Точные цифры» выбранного варианта: состав, пена, цена, шаги с количествами. Числа берутся из recipeCard, как цели налива в баре. */
function exactBlock(d: Drink, c: RecipeCard): string {
  const table = `<table class="bkTbl"><thead><tr><th>Шоты</th><th>Состав</th><th>Пена</th><th>Цена</th></tr></thead><tbody><tr><td>${shotsText(c.shots)}</td><td>${partsText(c)}</td><td>${esc(foamText(c))}</td><td>${c.price}&nbsp;₽</td></tr></tbody></table>`;
  const temp = c.temperature ? `<p class="bkTemp">${esc(c.temperature)}</p>` : '';
  const cup = `<p class="bkCup">${esc(variantName(c, d))}: чашка ${c.cupMl} мл</p>`;
  const steps = `<ol class="bkSteps">${c.steps.map((x) => `<li><b>${esc(x.label)}</b>${x.detail ? ': ' + esc(x.detail) : ''}</li>`).join('')}</ol>`;
  return `<div class="bkExact">${table}${temp}${cup}${steps}${d.note ? `<p class="bkNote">${esc(d.note)}</p>` : ''}</div>`;
}

function card(
  d: Drink, rank: number, eq: Readonly<Record<string, boolean>>, costs: Readonly<Record<string, number>>, avail: Readonly<Record<string, boolean>>, tut: string,
  sel: Partial<BookPick> | undefined, exactOpen: boolean, art?: BookArt
): string {
  const open = d.rank <= rank;
  if (!open)
    return `<div class="bk lock"><div class="bkTop"><b>? ? ?</b><em>ранг ${d.rank}</em></div><p>Откроется на ранге «${esc(rankInfo(d.rank).title)}».</p></div>`;
  const miss = missing(d, eq);
  const made = d.id in ENGINE;
  const need = miss.length ? needText(miss, costs, avail) : '<p class="bkReady">Можно готовить</p>';
  const pick = pickVariant(d, sel);
  const c = recipeCard(d.id, pick.size, pick.cold);
  const t = drinkText(d.id);
  const model = art?.(d.id, pick.size, pick.cold);
  const human = t ? stepsForShots(t.steps, c?.shots ?? 1) : (c?.steps.map((x) => x.label) ?? []);
  const ice = t && c?.cold ? t.ice : [];
  const ex = c
    ? `<button type="button" class="chip bkExactBtn${exactOpen ? ' on' : ''}" aria-expanded="${exactOpen}" data-bookexact="${esc(d.id)}">Точные цифры</button>${exactOpen ? exactBlock(d, c) : ''}`
    : '';
  const list = (xs: readonly string[]): string => `<ol class="bkSteps bkHuman">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  return `<div class="bk${made && !miss.length ? '' : ' soon'}" data-drink="${esc(d.id)}"><div class="bkTop"><b>${esc(d.name)}</b><em>${esc(FAM[d.family] || '')}</em></div>
<div class="bkSub">${TEMP[d.temp]} · ранг ${d.rank} «${esc(rankInfo(d.rank).title)}»</div>
${model ? `<div class="bkModel" aria-hidden="true">${model}</div>${MODEL_TAGS[d.id] ? `<p class="mdlTag">${esc(MODEL_TAGS[d.id])}</p>` : ''}` : ''}<div class="imgSlot bkImg" data-img="${esc(d.id)}" hidden></div>
${t ? `<p class="bkWhat">${esc(t.what)}</p>` : ''}<p class="bkIng">Ингредиенты: ${esc(d.ing.join(', '))}</p>${pickBlock(d, pick)}
<h5 class="bkH">Как готовится</h5>${list(human)}${ice.length ? `<h5 class="bkH">Если со льдом</h5>${list(ice)}` : ''}${t ? `<p class="bkDiff"><b>Чем отличается.</b> ${esc(t.differs)}</p>` : ''}${ex}${need}${hintBlock(d, tut)}</div>`;
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
function tabDrinks(
  rank: number, eq: Readonly<Record<string, boolean>>, fam: string, costs: Readonly<Record<string, number>>, avail: Readonly<Record<string, boolean>>, tut: string,
  sel: Readonly<Record<string, Partial<BookPick>>>, exact: readonly string[], art?: BookArt
): string {
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
      return head + card(d, rank, eq, costs, avail, tut, sel[d.id], exact.includes(d.id), art);
    })
    .join('');
  return `<div class="bkChips">${chips}</div><div class="bkGrid">${cards}</div>`;
}

/** Справочник: термины по группам, каждый раскрывается по клику. Поиск по названию фильтрует их на месте (обработчик input в старом ядре). */
function tabGuide(): string {
  const groups = glossaryGroups()
    .map(
      (g) =>
        `<section class="gGroup"><h4>${esc(g.group)}</h4><div class="gList">${g.terms
          .map(
            (t) =>
              `<details class="gTerm" data-n="${esc(t.name.toLowerCase())}"><summary>${esc(t.name)}</summary><p>${esc(t.text)}</p><div class="imgSlot" data-img="${esc(t.name)}" hidden></div></details>`
          )
          .join('')}</div></section>`
    )
    .join('');
  return `<div class="gSearch"><label for="gQ">Найти термин</label><input id="gQ" type="search" placeholder="Например, питчер" autocomplete="off" data-guideq="1"></div><p class="gEmpty" hidden>Такого термина нет в справочнике.</p><div class="gBody">${groups}</div>`;
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

/** Модель напитка для карточки книги: SVG полного уровня для (напиток, размер, холодный) или null, если напиток ещё рисуется по-старому. */
export type BookArt = (id: string, size: Size, cold: boolean) => string | null;
export interface BookState { rank: number; tab: BookTab | string; eq?: Readonly<Record<string, boolean>>; fam?: string;
  /** цены оборудования в магазине: id → ₽ */
  costs?: Readonly<Record<string, number>>;
  /** что сейчас есть в магазине: id → показывается ли карточка (false — ждёт другую покупку или ранг) */
  avail?: Readonly<Record<string, boolean>>;
  /** карточка напитка, у которой раскрыта подсказка */
  tut?: string;
  /** выбранный размер и холодность напитков: id → выбор (по умолчанию первый размер, горячий) */
  sel?: Readonly<Record<string, Partial<BookPick>>>;
  /** напитки, у которых раскрыт блок «Точные цифры» (по умолчанию закрыт) */
  exact?: readonly string[];
  /** рисует модель напитка (Н1-3); без неё карточка без картинки */
  art?: BookArt;
}
export function bookHTML(state: BookState): string {
  const { rank, tab } = state;
  const eq = state.eq ?? {};
  const tabs = BOOK_TABS.map(
    ([id, n]) => `<button type="button" class="tab${id === tab ? ' on' : ''}" data-booktab="${id}">${n}</button>`
  ).join('');
  const body =
    tab === 'food' ? tabFood(rank)
    : tab === 'extra' ? tabExtra(rank)
    : tab === 'guide' ? tabGuide()
    : tabDrinks(rank, eq, state.fam ?? 'all', state.costs ?? {}, state.avail ?? {}, state.tut ?? '', state.sel ?? {}, state.exact ?? [], state.art);
  const total = DRINKS.length;
  const open = DRINKS.filter((d) => d.rank <= rank).length;
  return `<div class="book"><div class="bookHead"><div><h2>Книга рецептов</h2><span>Ранг ${rank} из ${MAX_RANK}: ${esc(rankInfo(rank).title)} · напитков открыто ${open} из ${total}</span></div>
<button type="button" class="ghost" data-bookclose="1">Закрыть</button></div><div class="tabs">${tabs}</div><div class="bookBody">${body}</div></div>`;
}
