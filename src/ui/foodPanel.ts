// Панель витрины: чистая функция «состояние -> HTML». Клики и удержание кнопки обрабатывает старое ядро (data-food*).
import { HEAT_FROM, HEAT_TO } from '../game/stations/food';

export interface FoodPanelItem { id: string; name: string; price: number }
export interface FoodPanelState {
  want: string;
  heat: boolean;
  picked: boolean;
  choices: FoodPanelItem[];
  pickedId: string | null;
}

const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** Шкала нагрева идёт до 9 с. */
export const HEAT_MAX = 9;
export const heatPct = (t: number): number => Math.min(100, Math.max(0, (t / HEAT_MAX) * 100));

export function foodPanelHTML(s: FoodPanelState): string {
  const hint = !s.picked ? `Гость просил: «${esc(s.want)}». Нажмите на нужное блюдо.` : s.heat ? 'Блюдо в микроволновке: зажмите «Разогреть», отпустите, когда шкала в зелёной зоне.' : 'Блюдо достали.';
  const items = s.choices
    .map((c) => `<button type="button" class="fpItem${c.id === s.pickedId ? ' on' : ''}" data-food="${esc(c.id)}"${s.picked ? ' disabled' : ''}><span>${esc(c.name)}</span><i>${c.price} ₽</i></button>`)
    .join('');
  const lo = heatPct(HEAT_FROM);
  const hi = heatPct(HEAT_TO);
  const heat = s.picked && s.heat
    ? `<div class="fpHeat"><div class="fpBar"><u class="zone" style="left:${lo.toFixed(1)}%;width:${(hi - lo).toFixed(1)}%"></u><u class="fill" id="fpFill"></u></div><div class="fpBtns"><button type="button" class="fpHold" data-foodheat="1">Разогреть (держите)</button><button type="button" class="fpDone" data-fooddone="1">Готово</button></div></div>`
    : '';
  return `<div class="fp"><div class="fpHead"><b>Витрина</b><span>${hint}</span></div><div class="fpGrid">${items}</div>${heat}</div>`;
}
