/* ---------- главное меню, настройки, пауза, музыка ---------- */
const MUSIC = new MusicPlayer();
function gfxLow() { return MENUAPI.isLowGraphics(SET.graphics, !!WORLD.software); }
const hintsNow = () => (G && !SET.hintsSet ? !!G.hints : SET.hints);
const setValue = k => (k === 'hints' ? hintsNow() : SET[k]);
let menuFrom = 'title', confirmBack = null, confirmYes = null;
const menuView = () => { if (scr.hidden) return null; const m = scr.querySelector('[data-menu]'); return m ? m.dataset.menu : null; };

/* «сейчас играет: Исполнитель — Название» */
function npText() {
  const t = MUSIC.track, st = MUSIC.status;
  if (st === 'playing' && t) return 'сейчас играет: ' + trackLabel(t);
  if (st === 'waiting') return 'музыка включится после первого нажатия';
  return '';
}
function updateNp() {
  const txt = npText();
  document.querySelectorAll('[data-np]').forEach(el => {
    el.hidden = !txt;
    if (!txt) { el.textContent = ''; return; }
    const i = document.createElement('i'); i.setAttribute('aria-hidden', 'true'); i.textContent = '♪';
    el.replaceChildren(i, document.createTextNode(' ' + txt));
  });
}
MUSIC.onChange(() => { updateNp(); refreshSettingsView(); });
MUSIC.init();

/* ---------- настройки: применяются сразу и сохраняются отдельно от игры ---------- */
function persistSet() { SETTINGS_STORE.save(SET); }
function applySettings() {
  muted = !SET.sfxOn; sfxMute();
  MUSIC.configure(SET.musicOn, SET.musicVol);
  if (SET.hintsSet && G) { G.hints = SET.hints; G.hintsTouched = true; coachKey = ''; tkKey = ''; }
  const low = gfxLow();
  WORLD.setLowFx(low); stage.classList.toggle('fx-low', low); fit();
  const allOff = !SET.sfxOn && !(MUSIC.available && SET.musicOn), b = $('#chSound');
  b.classList.toggle('off', allOff); b.setAttribute('aria-pressed', String(allOff));
}
/* кнопка «Звук» и клавиша M: всё выключить или всё включить */
function toggleAllSound() {
  const on = SET.sfxOn || (MUSIC.available && SET.musicOn);
  SET.sfxOn = SET.musicOn = !on; persistSet(); applySettings(); refreshSettingsView();
}
function refreshSettingsView() {
  if (menuView() !== 'settings') return;
  scr.querySelectorAll('[data-set]').forEach(b => { const on = !!setValue(b.dataset.set); b.setAttribute('aria-checked', String(on)); b.querySelector('b').textContent = on ? 'Вкл' : 'Выкл'; });
  scr.querySelectorAll('[data-range]').forEach(r => { if (document.activeElement !== r) r.value = Math.round(SET[r.dataset.range] * 100); });
  scr.querySelectorAll('[data-gfx]').forEach(b => { const on = b.dataset.gfx === SET.graphics; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
}
function setSettingsMsg(txt) { const m = scr.querySelector('.smsg'); if (m) m.textContent = txt; }

/* ---------- показ экранов меню ---------- */
function menuRender(html, blur) {
  scr.innerHTML = blur ? `<div class="menuwrap">${html}</div>` : html; scr.hidden = false;
}
function focusFirst(sel) { const b = scr.querySelector(sel || '.mbtn.main, .big, button'); if (b) b.focus({ preventScroll: true }); }
function showTitle(notice) {
  if (SBX.on) sbxLeave();
  G.phase = 'title'; menuFrom = 'title';
  let rd = SAVE_STORE.load(), msg = notice || '';
  if (rd.kind === 'broken') {
    SAVE_STORE.quarantine();
    msg = rd.reason === 'newer' ? 'Сохранение сделано в более новой версии игры. Начните новую игру.' : 'Сохранение повреждено. Начните новую игру.';
    rd = { kind: 'none' };
  }
  const cont = rd.kind === 'ok' ? { day: rd.data.day, rank: MENUAPI.rankInfo(MENUAPI.restore(rd.data).rank).title } : null;
  menuRender(titleHTML({ cont, notice: msg, np: npText(), dev: DEV }), true);
  focusFirst();
}
function showPace() {
  const paces = Object.keys(PACE).map(k => `<button type="button" class="pace${k === selPace ? ' sel' : ''}" data-pace="${k}">${PACE_ICON[k]}<b>${PACE[k].name}</b><span>${PACE[k].text}</span></button>`).join('');
  menuRender(paceScreenHTML(paces), true); focusFirst('.pace.sel');
}
function showHowto(msg) { menuRender(howtoHTML(msg), menuFrom === 'title'); focusFirst('.big'); }
function showSettings(from, msg) {
  if (from) menuFrom = from;
  menuRender(settingsHTML({ s: SET, hints: hintsNow(), music: MUSIC.available, msg }), menuFrom === 'title');
  focusFirst('.sw, .rng, .big');
}
function showPauseCard() { menuFrom = 'pause'; menuRender(pauseHTML(CUP_LOGO, npText()), false); focusFirst(); }
function setPause(on) {
  if (!G || G.phase !== 'day') return;
  paused = on; stage.classList.toggle('paused', on);
  if (on) { pauseFreeze(); showPauseCard(); } else scr.hidden = true;
}
/* Пауза замораживает шаг: зажатое отпускается (без оценки), прогресс, окно станции и тикет остаются как были */
function pauseFreeze() { if (BR) BR.hold = false; }
function confirmDialog(title, text, yes, onYes, onNo) {
  confirmYes = onYes; confirmBack = onNo;
  menuRender(confirmHTML({ title, text, yes }), menuFrom === 'title'); focusFirst('.ghost');
}
/* Esc / «Назад» внутри меню; true — нажатие обработано меню */
function menuBack() {
  const mv = menuView();
  if (mv === 'settings' || mv === 'howto') { if (menuFrom === 'pause') showPauseCard(); else showTitle(); return true; }
  if (mv === 'pace' || mv === 'sandbox') { showTitle(); return true; }
  if (mv === 'confirm') { (confirmBack || showTitle)(); return true; }
  return false;
}
/* из паузы или из настроек назад к главному меню: день бросается, игра остаётся на последнем сохранении */
function leaveToTitle(notice) {
  paused = false; barAbort(); stopLoops(); stage.classList.remove('inbar', 'closing');
  $('#helperChip').hidden = true; $('#frontHint').hidden = true;
  newGame(); lastHud = ''; updateHud(); showTitle(notice);
}

/* ---------- сохранение: файл и сброс ---------- */
function exportSave() {
  const r = SAVE_STORE.load();
  if (r.kind !== 'ok') { setSettingsMsg('Сохранения пока нет. Сначала начните игру.'); return; }
  const name = 'cuppable-save-day' + r.data.day + '.json';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([MENUAPI.serializeSave(r.data)], { type: 'application/json' })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setSettingsMsg('Файл ' + name + ' скачан.');
}
function importText(text) {
  const r = MENUAPI.readSave(text);
  if (r.kind !== 'ok') { setSettingsMsg(r.kind === 'broken' && r.reason === 'newer' ? 'Этот файл сделан в более новой версии игры.' : 'Этот файл не похож на сохранение игры Cuppable.'); return; }
  const apply = () => {
    SAVE_STORE.save(r.data);
    if (menuFrom === 'pause') leaveToTitle('Сохранение загружено. Нажмите «Продолжить».');
    else showSettings(null, 'Сохранение загружено: день ' + r.data.day + '. Оно ждёт на главном экране.');
  };
  const cur = loadSave();
  if (cur) confirmDialog('Заменить сохранение?', `Вместо сохранения (день ${cur.day}) загрузится сохранение из файла (день ${r.data.day}).` + (menuFrom === 'pause' ? ' Текущий день прервётся.' : ''), 'Заменить', apply, () => showSettings());
  else apply();
}
scr.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'impFile') {
    const f = el.files && el.files[0]; el.value = ''; if (!f) return;
    if (f.size > 500000) { setSettingsMsg('Файл слишком большой для сохранения.'); return; }
    f.text().then(importText, () => setSettingsMsg('Не удалось прочитать файл.'));
  } else if (el.dataset.range === 'sfxVol') sndTap();
});
scr.addEventListener('input', e => {
  const k = e.target.dataset.range; if (!k) return;
  SET[k] = Math.min(1, Math.max(0, +e.target.value / 100)); persistSet(); applySettings();
});

/* ---------- клики ---------- */
function startFromSave() {
  const sv = loadSave(); newGame();
  if (sv) { const r = MENUAPI.restore(sv); Object.assign(G, { rank: r.rank, served: r.served, money: r.money, day: r.day, rating: r.rating, pace: r.pace, grindSet: r.grindSet, tutorialSeen: MENUAPI.migrateSeen(r.tutorialSeen, { rank: r.rank, day: r.day, served: r.served, milk: r.up.includes('milk'), up: r.up }) }); r.up.forEach(id => { G[id] = true; }); }
  applyUpgrades(); lastHud = ''; startDay();
}
scr.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
  if (d.continue) { sndTap(); startFromSave(); }
  else if (d.start) {
    sndTap(); const sv = loadSave();
    if (sv) confirmDialog('Начать новую игру?', `Сохранённая игра (день ${sv.day}) будет заменена новой, когда вы откроете кофейню.`, 'Начать новую', showPace, () => showTitle());
    else showPace();
  }
  else if (d.go) { clearSave(); newGame(); G.pace = selPace; startDay(); }
  else if (d.settings) { sndTap(); showSettings(d.settings); }
  else if (d.howto) { sndTap(); showHowto(); }
  else if (d.menuback) { sndTap(); menuBack(); }
  else if (d.tutreset) {
    sndTap(); const r = SAVE_STORE.load();
    if (r.kind === 'ok') { SAVE_STORE.save({ ...r.data, tutorialSeen: MENUAPI.freshSeen() }); showHowto('Готово: подсказки и карточки новых напитков покажутся снова.'); }
    else showHowto('Сохранения пока нет: в новой игре подсказки покажутся сами.');
  }
  else if (d.set) {
    sndTap();
    if (d.set === 'hints') { SET.hints = !hintsNow(); SET.hintsSet = true; } else SET[d.set] = !SET[d.set];
    persistSet(); applySettings(); refreshSettingsView();
  }
  else if (d.gfx) { sndTap(); SET.graphics = d.gfx; persistSet(); applySettings(); refreshSettingsView(); }
  else if (d.export) exportSave();
  else if (d.import) { const f = $('#impFile'); if (f) f.click(); }
  else if (d.reset) confirmDialog('Сбросить прогресс?', 'Сохранение будет стёрто без возврата. Настройки останутся.', 'Сбросить прогресс', () => { clearSave(); leaveToTitle('Прогресс сброшен.'); }, () => showSettings());
  else if (d.yes) { const f = confirmYes; confirmYes = null; sndTap(); if (f) f(); }
  else if (d.no) { sndTap(); menuBack(); }
  else if (d.tomenu) { sndTap(); confirmDialog('Выйти в главное меню?', 'Сегодняшний день не сохранится: «Продолжить» вернёт вас к его началу.', 'В главное меню', () => leaveToTitle(), () => showPauseCard()); }
});

/* стрелки двигают выбор по кнопкам меню */
addEventListener('keydown', e => {
  if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp') return;
  const mv = menuView(); if (mv !== 'title' && mv !== 'pause') return;
  const list = [...scr.querySelectorAll('.mbtn')], i = list.indexOf(document.activeElement);
  e.preventDefault(); list[(i + (e.code === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
});
