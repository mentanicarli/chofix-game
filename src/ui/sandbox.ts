import { RANKS } from '../game/menu';
import type { SandboxConfig } from '../game/sandbox';

/** Разметка песочницы (только при #dev). Обработчики — в src/legacy/16-sandbox.js. */
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export interface SandboxItem { id: string; name: string; cat: string }
export interface SandboxScreenOpts {
  cfg: SandboxConfig;
  items: readonly SandboxItem[];
  cats: ReadonlyArray<readonly [string, string]>;
  msg?: string;
}

const num = (name: string, label: string, v: number, min: number, max: number, step = 1): string =>
  `<label class="sbxf"><span>${label}</span><input type="number" data-f="${name}" value="${v}" min="${min}" max="${max}" step="${step}"></label>`;

export function sandboxScreenHTML(o: SandboxScreenOpts): string {
  const { cfg } = o;
  const ranks = RANKS.map((r) => `<option value="${r.rank}"${r.rank === cfg.rank ? ' selected' : ''}>${r.rank}. ${esc(r.title)}</option>`).join('');
  const paces = (['cozy', 'normal', 'hard'] as const).map((p) => `<option value="${p}"${p === cfg.pace ? ' selected' : ''}>${{ cozy: 'Уютный', normal: 'Обычный', hard: 'Сложный' }[p]}</option>`).join('');
  const groups = o.cats
    .map(([cat, name]) => {
      const list = o.items.filter((i) => i.cat === cat).map((i) => `<label class="sbxc"><input type="checkbox" data-item="${i.id}"${cfg.items.includes(i.id) ? ' checked' : ''}> <span>${esc(i.name)}</span></label>`).join('');
      return list ? `<div class="sbxg"><b>${esc(name)}</b>${list}</div>` : '';
    })
    .join('');
  return `<div class="paper setcard sbxcard" data-menu="sandbox"><h2>Песочница</h2>
<div class="sbody">
<div class="sbxrow">${num('day', 'День (1–60)', cfg.day, 1, 60)}
<label class="sbxf"><span>Ранг</span><select data-f="rank">${ranks}</select></label>
${num('rating', 'Рейтинг (1,0–5,0)', cfg.rating, 1, 5, 0.1)}${num('served', 'Обслужено', cfg.served, 0, 99999)}${num('money', 'Деньги', cfg.money, 0, 99999999)}
<label class="sbxf"><span>Темп</span><select data-f="pace">${paces}</select></label></div>
<p class="shelp">Ранг подтягивает день, рейтинг и «обслужено» до своего минимума. Выше можно оставить или поправить руками. Аренда считается как в обычной игре.</p>
<div class="sbxbtns"><b>Улучшения магазина</b><button type="button" class="ghost sm" data-sbx="all">Все открыто</button><button type="button" class="ghost sm" data-sbx="none">Ничего</button></div>
<div class="sbxgrid">${groups}</div>
<div class="sbxbtns"><label class="sbxc"><input type="checkbox" data-f="showTutorial"${cfg.showTutorial ? ' checked' : ''}> <span>Показывать обучение</span></label><button type="button" class="ghost sm" data-sbx="tutreset">Сбросить обучение</button></div>
</div>
<p class="smsg" role="status" aria-live="polite">${o.msg ? esc(o.msg) : ''}</p>
<div class="foot"><button type="button" class="ghost" data-menuback="1">Назад</button><button type="button" class="big" data-sbx="start">Начать</button></div></div>`;
}

export interface DevPanelOpts {
  drinks: ReadonlyArray<{ id: string; name: string }>;
  syrups: readonly string[];
  altMilks: readonly string[];
  foods: ReadonlyArray<{ id: string; name: string }>;
  types: ReadonlyArray<readonly [string, string]>;
}
const opts = (list: ReadonlyArray<readonly [string, string]>, any = 'Любой'): string => `<option value="">${any}</option>` + list.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join('');

export function devPanelHTML(o: DevPanelOpts): string {
  return `<button type="button" id="devBtn" aria-expanded="false" title="Панель разработчика">DEV</button>
<div id="devPanel" hidden>
<div class="dvh"><b>Песочница</b><span id="dvInfo"></span></div>
<div class="dvs"><b>Время</b><div class="dvr" id="dvSpeed">${[1, 2, 4, 8].map((n) => `<button type="button" data-dv="speed" data-v="${n}">×${n}</button>`).join('')}<button type="button" data-dv="speed" data-v="0">Стоп</button><button type="button" data-dv="step">Шаг 1 с</button></div>
<div class="dvr"><button type="button" data-dv="endday">Закончить день</button></div></div>
<div class="dvs"><b>Деньги и рейтинг</b><div class="dvr"><button type="button" data-dv="money" data-v="100">+100</button><button type="button" data-dv="money" data-v="1000">+1000</button><button type="button" data-dv="rate" data-v="-0.1">−0,1</button><button type="button" data-dv="rate" data-v="0.1">+0,1</button><button type="button" data-dv="rank">Следующий ранг</button></div>
<div class="dvr"><label><input type="checkbox" data-dv="inf"> Неограниченные деньги</label><label><input type="checkbox" data-dv="free"> Бесплатные ингредиенты</label></div></div>
<div class="dvs"><b>Гости</b><div class="dvr"><button type="button" data-dv="call">Позвать гостя сейчас</button><label><input type="checkbox" data-dv="nopat"> Без терпения</label></div>
<div class="dvr"><label>Тип <select data-dv="type">${opts(o.types, 'Случайный')}</select></label><label>Приход <select data-dv="rate2"><option value="0.5">реже</option><option value="1" selected>как в игре</option><option value="2">чаще</option><option value="4">очень часто</option></select></label></div></div>
<div class="dvs"><b>Следующий заказ</b>
<div class="dvr"><label>Напиток <select data-o="drink">${opts(o.drinks.map((d) => [d.id, d.name] as const))}</select></label><label>Размер <select data-o="size"><option value="">Любой</option><option value="0.2">0,2</option><option value="0.3">0,3</option><option value="0.4">0,4</option><option value="0.6">0,6</option></select></label></div>
<div class="dvr"><label>Температура <select data-o="cold"><option value="">Любая</option><option value="0">Горячий</option><option value="1">Холодный</option></select></label><label>Сироп <select data-o="syrup"><option value="">Любой</option><option value="-">Без сиропа</option>${o.syrups.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label></div>
<div class="dvr"><label>Молоко <select data-o="altMilk"><option value="">Обычное</option>${o.altMilks.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label><label>Еда <select data-o="food"><option value="">Любая</option><option value="-">Без еды</option>${o.foods.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select></label></div>
<div class="dvr"><label><input type="checkbox" data-o="strong"> Крепкий</label><label><input type="checkbox" data-o="heat"> Разогреть</label><button type="button" data-dv="setorder">Задать заказ следующему гостю</button></div><div class="dvn" id="dvNext"></div></div>
<div class="dvs"><b>Статистика смены</b><pre id="dvStats"></pre><div class="dvr"><button type="button" data-dv="copy">Скопировать JSON</button><button type="button" data-dv="tutreset">Сбросить обучение</button></div></div>
<div class="dvr"><button type="button" data-dv="exit">Сохранить и выйти в меню</button></div>
</div>`;
}
