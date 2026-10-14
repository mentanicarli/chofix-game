import { rankInfo } from '../game/menu';
import { MODE_NAMES, PROFILE_IDS, PROFILE_NAMES } from '../game/sandbox';
import type { Resolved } from '../game/sandbox';

/** Разметка песочницы (только при #dev). Обработчики — в src/legacy/16-sandbox.js. */
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export interface SandboxItem { id: string; name: string; cat: string }
export interface SandboxScreenOpts {
  /** выведенное из дня состояние (resolveSandbox) */
  view: Resolved;
  items: readonly SandboxItem[];
  cats: ReadonlyArray<readonly [string, string]>;
  msg?: string;
}

const num = (name: string, label: string, v: number, min: number, max: number, step = 1): string =>
  `<label class="sbxf"><span>${label}</span><input type="number" data-f="${name}" value="${v}" min="${min}" max="${max}" step="${step}"></label>`;
const sel = (name: string, label: string, list: ReadonlyArray<readonly [string, string]>, cur: string): string =>
  `<label class="sbxf"><span>${label}</span><select data-f="${name}">${list.map(([v, n]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;

export function sandboxScreenHTML(o: SandboxScreenOpts): string {
  const v = o.view;
  const cfg = v.config;
  const groups = o.cats
    .map(([cat, name]) => {
      const list = o.items
        .filter((i) => i.cat === cat)
        .map((i) => {
          const on = v.items.includes(i.id);
          const off = !on && !v.avail.includes(i.id);
          return `<label class="sbxc${off ? ' off' : ''}"><input type="checkbox" data-item="${i.id}"${on ? ' checked' : ''}${off ? ' disabled' : ''}> <span>${esc(i.name)}</span></label>`;
        })
        .join('');
      return list ? `<div class="sbxg"><b>${esc(name)}</b>${list}</div>` : '';
    })
    .join('');
  const total = o.items.length;
  const summary = `На ${cfg.day}-й день: ранг ${v.rank} «${esc(rankInfo(v.rank).title)}», рейтинг ${String(v.rating.toFixed(1)).replace('.', ',')}, обслужено ${v.served}, деньги ${v.money} ₽, куплено ${v.items.length} из ${total}. Остальное в магазине появится позже, как у обычного игрока.`;
  return `<div class="paper setcard sbxcard" data-menu="sandbox"><h2>Песочница</h2>
<div class="sbody">
<div class="sbxrow">${num('day', 'День (1–60)', cfg.day, 1, 60)}
${sel('profile', 'Профиль игрока', PROFILE_IDS.map((p) => [p, PROFILE_NAMES[p]] as const), cfg.profile)}
${sel('mode', 'Покупки', (['all', 'typical'] as const).map((m) => [m, MODE_NAMES[m]] as const), cfg.mode)}
${sel('pace', 'Темп', [['cozy', 'Уютный'], ['normal', 'Обычный'], ['hard', 'Сложный']], cfg.pace)}</div>
<p class="shelp" data-sbx-summary>${summary}</p>
<div class="sbxbtns"><label class="sbxc"><input type="checkbox" data-f="showTutorial"${cfg.showTutorial ? ' checked' : ''}> <span>Показывать обучение</span></label><button type="button" class="ghost sm" data-sbx="tutreset">Сбросить обучение</button></div>
<details class="sbxcustom" data-custom${cfg.custom ? ' open' : ''}><summary>Своё</summary>
<div class="sbxrow">${num('rank', 'Ранг', v.rank, 1, v.maxRank)}${num('rating', 'Рейтинг', v.rating, v.minRating, 5, 0.1)}${num('served', 'Обслужено', v.served, v.minServed, v.servedMax)}${num('money', 'Деньги', v.money, 0, 99999999)}</div>
<p class="shelp">На ${cfg.day}-й день максимум ранг ${v.maxRank}. Рейтинг и «обслужено» не ниже порогов ранга. Недоступные сейчас позиции магазина выключены. Сменили день, профиль, режим или ранг: значения пересчитаются.</p>
<div class="sbxgrid">${groups}</div></details>
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
