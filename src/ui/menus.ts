import type { GraphicsMode, Settings } from '../game/settings';

/** Разметка главного меню, настроек, паузы и подтверждений. Обработчики кликов — в src/legacy/15-menu.js. */
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** Строка «сейчас играет». Пустая строка — блок скрыт. */
export function nowPlayingHTML(text: string): string {
  return `<div class="np" data-np${text ? '' : ' hidden'}>${text ? '<i aria-hidden="true">♪</i> ' + esc(text) : ''}</div>`;
}

export interface TitleOpts {
  logo: string;
  /** сохранение: день и название ранга; null — сохранения нет */
  cont: { day: number; rank: string } | null;
  notice?: string;
  np: string;
  /** только по ссылке с #dev: кнопка «Песочница» */
  dev?: boolean;
}
export function titleHTML(o: TitleOpts): string {
  const cont = o.cont
    ? `<button type="button" class="mbtn main" data-continue="1"><b>Продолжить</b><span>День ${o.cont.day} · ${esc(o.cont.rank)}</span></button>`
    : '';
  return `<div class="title" data-menu="title">
<div class="sign"><i class="chain l"></i><i class="chain r"></i>${o.logo}<div><h1>Chofix</h1><p>кофе между парами</p></div></div>
<div class="paper menucard">
<div class="mbtns">${cont}<button type="button" class="mbtn${o.cont ? '' : ' main'}" data-start="1"><b>Новая игра</b></button>${o.dev ? '<button type="button" class="mbtn" data-sandbox="1"><b>Песочница</b></button>' : ''}<button type="button" class="mbtn" data-settings="title"><b>Настройки</b></button><button type="button" class="mbtn" data-howto="1"><b>Как играть</b></button></div>
${o.notice ? `<p class="mnote" role="status">${esc(o.notice)}</p>` : ''}
</div>
${nowPlayingHTML(o.np)}
</div>`;
}

export function paceScreenHTML(logo: string, paces: string): string {
  return `<div class="title" data-menu="pace">
<div class="sign"><i class="chain l"></i><i class="chain r"></i>${logo}<div><h1>Chofix</h1><p>кофе между парами</p></div></div>
<div class="paper"><div class="lbl">Вы бариста в университетской кофейне. Как будем играть?</div><div class="paces">${paces}</div>
<div class="foot"><button type="button" class="ghost" data-menuback="1">Назад</button><button type="button" class="big" data-go="1">Открыть кофейню</button></div></div></div>`;
}

export function howtoHTML(msg = ''): string {
  return `<div class="paper howto" data-menu="howto"><h2>Как играть</h2>
<ul>
<li><b>Принять заказ.</b> Нажмите на гостя в зале или <kbd>Пробел</kbd>.</li>
<li><b>Приготовить.</b> В баре нажимайте на станции: кофемолка, темпер, группа, молоко, пар, сироп. Сверху висит тикет с шагами.</li>
<li><b>Остановить шот.</b> <kbd>Пробел</kbd> или кнопка у группы.</li>
<li><b>Подать.</b> Позвоните в звонок на баре, затем нажмите на гостя.</li>
<li><b>Вернуться к залу.</b> <kbd>Tab</kbd>, <kbd>Esc</kbd> или кнопка «К залу».</li>
<li><b>Пауза</b> — <kbd>P</kbd>, <b>звук</b> — <kbd>M</kbd>.</li>
<li><b>Подсказки.</b> Кнопка «?» на тикете включает и выключает их. Новые напитки и станции объясняются один раз.</li>
</ul>
<p class="hnote">Вечером тратьте выручку на улучшения. Хорошие напитки поднимают рейтинг и ранг.</p>
<p class="smsg hmsg" role="status">${esc(msg)}</p>
<div class="foot"><button type="button" class="ghost" data-tutreset="1">Показать подсказки заново</button><button type="button" class="big" data-menuback="1">Назад</button></div></div>`;
}

export interface SettingsOpts {
  s: Settings;
  /** подсказки сейчас включены (с учётом правила «с 3-го дня выключаются сами») */
  hints: boolean;
  /** есть ли музыка в папке public/music */
  music: boolean;
  msg?: string;
}
const sw = (key: string, on: boolean, label: string): string =>
  `<button type="button" class="sw" role="switch" aria-checked="${on}" data-set="${key}" aria-label="${label}"><i></i><b>${on ? 'Вкл' : 'Выкл'}</b></button>`;
const range = (key: string, v: number, label: string): string =>
  `<input type="range" class="rng" min="0" max="100" step="1" value="${Math.round(v * 100)}" data-range="${key}" aria-label="${label}">`;
const GFX: Array<[GraphicsMode, string]> = [['auto', 'Авто'], ['high', 'Высокая'], ['low', 'Лёгкая']];

export function settingsHTML(o: SettingsOpts): string {
  const { s } = o;
  const gfx = GFX.map(([m, n]) => `<button type="button" class="seg${s.graphics === m ? ' on' : ''}" data-gfx="${m}" aria-pressed="${s.graphics === m}">${n}</button>`).join('');
  return `<div class="paper setcard" data-menu="settings"><h2>Настройки</h2>
<div class="sbody">
${o.music ? `<div class="srow"><span class="sl">Музыка</span><div class="sc">${sw('musicOn', s.musicOn, 'Музыка')}${range('musicVol', s.musicVol, 'Громкость музыки')}</div></div>` : ''}
<div class="srow"><span class="sl">Звуки</span><div class="sc">${sw('sfxOn', s.sfxOn, 'Звуки')}${range('sfxVol', s.sfxVol, 'Громкость звуков')}</div></div>
<div class="srow"><span class="sl">Подсказки в игре</span><div class="sc">${sw('hints', o.hints, 'Подсказки в игре')}</div></div>
<div class="srow col"><span class="sl">Графика</span><div class="sc segs">${gfx}</div><span class="shelp">«Лёгкая» убирает частицы и свечение. Она нужна слабым устройствам. «Авто» сама выбирает по видеокарте.</span></div>
<div class="srow col"><span class="sl">Сохранение</span><div class="sc wrap"><button type="button" class="ghost sm" data-export="1">Сохранить в файл</button><button type="button" class="ghost sm" data-import="1">Загрузить из файла</button><button type="button" class="ghost sm danger" data-reset="1">Сбросить прогресс</button></div><span class="shelp">Файл нужен, чтобы перенести игру в другой браузер.</span></div>
</div>
<p class="smsg" role="status" aria-live="polite">${o.msg ? esc(o.msg) : ''}</p>
<input type="file" id="impFile" accept=".json,application/json" hidden>
<div class="foot"><button type="button" class="big" data-menuback="1">Назад</button></div></div>`;
}

export interface ConfirmOpts {
  title: string;
  text: string;
  yes: string;
  no?: string;
}
export function confirmHTML(o: ConfirmOpts): string {
  return `<div class="paper confirm" data-menu="confirm" role="alertdialog" aria-label="${esc(o.title)}"><h2>${esc(o.title)}</h2><p>${esc(o.text)}</p>
<div class="foot"><button type="button" class="ghost" data-no="1">${esc(o.no ?? 'Отмена')}</button><button type="button" class="big warn" data-yes="1">${esc(o.yes)}</button></div></div>`;
}

export function pauseHTML(logo: string, np: string): string {
  return `<div class="paper pausecard" data-menu="pause">${logo}<h2>Пауза</h2>
<div class="mbtns"><button type="button" class="mbtn main" data-resume="1"><b>Продолжить</b></button><button type="button" class="mbtn" data-settings="pause"><b>Настройки</b></button><button type="button" class="mbtn" data-book="pause"><b>Книга рецептов</b></button><button type="button" class="mbtn" data-tomenu="1"><b>В главное меню</b></button></div>
${nowPlayingHTML(np)}</div>`;
}
