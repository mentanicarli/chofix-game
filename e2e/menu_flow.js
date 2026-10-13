/* Сценарий меню: титул → как играть → настройки → новая игра → пауза → настройки → музыка выкл → назад в игру → в главное меню → продолжить.
   Запуск: BASE=http://localhost:4173/ node e2e/menu_flow.js <префикс-скриншотов> [gfx]
   BASE — адрес папки, где лежит index.html (можно с подпапкой, например http://localhost:4174/chofix-game/). */
const { chromium } = require('playwright');
const out = process.argv[2] || 'out/menu';
const BASE = process.env.BASE || 'http://localhost:4173/';
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await require('./pw').page(b);
  const errs = []; require('./pw').watch(p, errs);
  /* запоминаем все Audio, чтобы проверить, что музыка играет/молчит */
  await p.addInitScript(() => { const A = window.Audio; window.__audios = []; window.Audio = function () { const a = new A(); window.__audios.push(a); return a; }; });
  const playing = () => p.evaluate(() => window.__audios.filter(a => !a.paused && a.volume > 0).length);
  const anyAudio = () => p.evaluate(() => window.__audios.length);
  const menu = () => p.evaluate(() => { const m = document.querySelector('#screen:not([hidden]) [data-menu]'); return m ? m.dataset.menu : null; });
  const ok = (name, v) => { console.log((v ? 'OK   ' : 'FAIL ') + name); if (!v) errs.push('FAIL ' + name); };
  const shot = async n => { const r = await p.evaluate(() => { const b = document.querySelector('#stage').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), scrollX, scrollY]; }); if (r[0] !== 24 || r[1] !== 24 || r[2] || r[3]) errs.push('FAIL сцена сдвинулась на кадре ' + n + ' ' + r); await p.screenshot({ path: out + '_' + n + '.png' }); };
  const np = () => p.evaluate(() => { const e = document.querySelector('[data-np]'); return e && !e.hidden ? e.textContent.trim() : ''; });

  await p.goto(BASE + (process.env.HASH || '')); await p.waitForSelector('[data-menu=title]', { timeout: 30000 }); await p.waitForTimeout(800);
  ok('титул без сохранения: нет «Продолжить»', !(await p.$('[data-continue]')));
  ok('титул: музыка не играет до первого жеста', (await playing()) === 0);
  const hadMusic = (await anyAudio()) > 0;
  console.log('музыка в манифесте:', hadMusic, '| строка:', JSON.stringify(await np()));
  ok('нет музыки: строки «сейчас играет» нет', hadMusic || (await np()) === '');
  await shot('1title');

  await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  ok('Tab двигает фокус по кнопкам', await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('mbtn')));
  await p.click('[data-howto]'); await p.waitForTimeout(700);
  ok('«Как играть» открылось', (await menu()) === 'howto'); await shot('2howto');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  ok('Esc вернул на титул', (await menu()) === 'title');
  if (hadMusic) { await p.waitForTimeout(1200); ok('после жеста музыка играет', (await playing()) >= 1); console.log('строка:', JSON.stringify(await np())); await shot('3title_music'); }

  await p.click('[data-settings]'); await p.waitForTimeout(700);
  ok('настройки открылись из меню', (await menu()) === 'settings'); await shot('4settings');
  ok('музыкальный ряд настроек виден только если есть треки', hadMusic === !!(await p.$('[data-set=musicOn]')));
  await p.click('[data-gfx=low]'); await p.waitForTimeout(700);
  ok('графика «Лёгкая» сохранилась', (await p.evaluate(() => JSON.parse(localStorage.getItem('chofix-settings')).graphics)) === 'low');
  ok('stage.fx-low включён', await p.evaluate(() => document.querySelector('#stage').classList.contains('fx-low')));
  await p.click('[data-gfx=auto]');
  await p.click('[data-set=hints]'); await p.waitForTimeout(100);
  ok('подсказки: выбор запомнен', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('chofix-settings')); return s.hintsSet === true && s.hints === false; }));
  await p.click('[data-set=hints]');
  await p.click('[data-menuback]'); await p.waitForTimeout(700);
  ok('«Назад» вернул на титул', (await menu()) === 'title');

  await p.click('[data-start]'); await p.waitForTimeout(700);
  ok('новая игра без сохранения → выбор темпа', (await menu()) === 'pace'); await shot('5pace');
  await p.click('[data-go]'); await p.waitForTimeout(1500);
  ok('игра началась (экран закрыт)', await p.evaluate(() => document.querySelector('#screen').hidden));
  ok('автосохранение в начале дня', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('coffee-sim-save-v1')); return s && s.day === 1 && s.v === 2; }));

  await p.keyboard.press('KeyP'); await p.waitForTimeout(700);
  ok('пауза', (await menu()) === 'pause'); console.log('строка в паузе:', JSON.stringify(await np())); await shot('6pause');
  if (hadMusic) { ok('в паузе музыка приглушена', await p.evaluate(() => { const v = window.__audios.filter(a => !a.paused).map(a => a.volume); return v.length >= 1 && Math.max(...v) < 0.12; })); }
  await p.keyboard.press('KeyP'); await p.waitForTimeout(700);
  ok('P при паузе продолжает', await p.evaluate(() => document.querySelector('#screen').hidden));
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  await p.click('[data-settings]'); await p.waitForTimeout(700);
  ok('настройки открылись из паузы', (await menu()) === 'settings'); await shot('7settings_pause');
  await p.keyboard.press('KeyP'); await p.waitForTimeout(700);
  ok('P в настройках не закрывает паузу', (await menu()) === 'settings');
  if (hadMusic) {
    await p.click('[data-set=musicOn]'); await p.waitForTimeout(1500);
    ok('музыка выключена: ничего не играет', (await playing()) === 0);
    ok('musicOn=false в настройках', await p.evaluate(() => JSON.parse(localStorage.getItem('chofix-settings')).musicOn === false));
  }
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  ok('Esc из настроек вернул на карточку паузы', (await menu()) === 'pause');
  await p.click('[data-resume]'); await p.waitForTimeout(700);
  ok('«Продолжить» вернул в игру', await p.evaluate(() => document.querySelector('#screen').hidden));

  await p.keyboard.press('KeyP'); await p.waitForTimeout(700);
  await p.click('[data-tomenu]'); await p.waitForTimeout(700);
  ok('вопрос перед выходом', (await menu()) === 'confirm'); await shot('8confirm');
  await p.click('[data-no]'); await p.waitForTimeout(700);
  ok('«Отмена» вернула на паузу', (await menu()) === 'pause');
  await p.click('[data-tomenu]'); await p.click('[data-yes]'); await p.waitForTimeout(500);
  ok('вышли в главное меню', (await menu()) === 'title');
  ok('есть «Продолжить» с днём', (await p.textContent('[data-continue]')).includes('День 1')); await shot('9title_continue');
  await p.click('[data-continue]'); await p.waitForTimeout(1500);
  ok('«Продолжить» запускает день', await p.evaluate(() => document.querySelector('#screen').hidden && document.querySelector('#chDay').textContent.includes('1')));

  /* экспорт / импорт / сброс */
  await p.keyboard.press('KeyP'); await p.click('[data-settings]'); await p.waitForTimeout(700);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-export]')]);
  const path = require('path').resolve(out + '_save.json'); await dl.saveAs(path);
  const saved = JSON.parse(require('fs').readFileSync(path, 'utf8'));
  ok('экспорт: файл с версией и днём', saved.v === 2 && saved.day === 1);
  require('fs').writeFileSync(path, JSON.stringify({ ...saved, day: 7, money: 1234 }));
  await p.setInputFiles('#impFile', path); await p.waitForTimeout(700);
  ok('импорт при наличии сохранения спрашивает', (await menu()) === 'confirm');
  await p.click('[data-yes]'); await p.waitForTimeout(500);
  ok('после импорта из паузы — главное меню с днём 7', (await menu()) === 'title' && (await p.textContent('[data-continue]')).includes('День 7'));
  require('fs').writeFileSync(path, '{не json');
  await p.click('[data-settings]'); await p.setInputFiles('#impFile', path); await p.waitForTimeout(700);
  ok('битый файл импорта: сообщение, сохранение цело', (await p.textContent('.smsg')).includes('не похож') && (await p.evaluate(() => JSON.parse(localStorage.getItem('coffee-sim-save-v1')).day)) === 7);
  await shot('10import_error');
  await p.click('[data-reset]'); await p.waitForTimeout(700);
  ok('сброс спрашивает', (await menu()) === 'confirm');
  await p.click('[data-yes]'); await p.waitForTimeout(700);
  ok('после сброса нет «Продолжить» и нет сохранения', !(await p.$('[data-continue]')) && (await p.evaluate(() => localStorage.getItem('coffee-sim-save-v1'))) === null);

  /* битое сохранение при запуске */
  await p.evaluate(() => localStorage.setItem('coffee-sim-save-v1', '{"day":'));
  await p.reload(); await p.waitForSelector('[data-menu=title]', { timeout: 30000 }); await p.waitForTimeout(500);
  ok('битое сохранение: сообщение и «Новая игра»', (await p.textContent('.mnote')).includes('повреждено') && !(await p.$('[data-continue]')));
  await shot('11broken');
  await p.evaluate(() => localStorage.setItem('chofix-settings', 'мусор'));
  await p.reload(); await p.waitForSelector('[data-menu=title]', { timeout: 30000 });
  ok('битые настройки не ломают запуск', true);

  /* старое сохранение (без версии) подхватывается */
  await p.evaluate(() => localStorage.setItem('coffee-sim-save-v1', '{"day":6,"money":900,"rating":3.2,"pace":"normal"}'));
  await p.reload(); await p.waitForSelector('[data-continue]', { timeout: 30000 });
  ok('сохранение v1 мигрирует (День 6)', (await p.textContent('[data-continue]')).includes('День 6'));

  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
