const path = require('path');
/* шрифты встраиваются как data-URI: так они грузятся и из файла, и со статического сервера, на любой ОС */
const F = p => 'data:font/woff2;base64,' + require('fs').readFileSync(path.resolve(__dirname, 'node_modules/@fontsource', p)).toString('base64');
const face = (fam, w, sub, range) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(${F(fam.toLowerCase() + '/files/' + fam.toLowerCase() + '-' + sub + '-' + w + '-normal.woff2')}) format('woff2');unicode-range:${range};}`;
const R = { cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', 'latin-ext': 'U+0100-02AF,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF' };
let css = '';
for (const [fam, ws] of [['Nunito', [600, 700, 800]], ['Caveat', [600, 700]]]) for (const w of ws) for (const sub of Object.keys(R)) css += face(fam, w, sub, R[sub]);
exports.page = async (browser, vp = { width: 1312, height: 752 }) => {
  const p = await browser.newPage({ viewport: vp });
  await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
  return p;
};
exports.css = css;
/** Адрес собранной страницы: BASE=http://localhost:4173 — со статического сервера (звуки грузятся), иначе из файла. */
exports.url = tmp => process.env.BASE ? process.env.BASE + '/' + path.basename(tmp) : 'file://' + tmp;
/** Собирает pageerror, console.error и console.warning (кроме шума драйвера GL). */
exports.watch = (p, errs) => { p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message/.test(t)) errs.push('console ' + m.type() + ': ' + t.slice(0, 300)); }); };
/** «Новая игра» → (если есть сохранение, подтверждение) → «Открыть кофейню». Не бросает: дальше тест сам упадёт, если день не начался. */
exports.startNew = async (p) => {
  try {
    await p.click('[data-start]', { timeout: 20000 });
    const yes = await p.waitForSelector('[data-yes], [data-go]', { timeout: 3000 });
    if (await yes.getAttribute('data-yes') !== null) { await yes.click(); await p.waitForSelector('[data-go]', { timeout: 3000 }); }
    await p.waitForTimeout(650); /* карточка выезжает: клик до конца анимации промахивается */
    await p.click('[data-go]', { timeout: 3000 });
  } catch (e) { /* см. выше */ }
};
/** Карточка «Новый напиток» (если показана) → «Понятно». Возвращает true, если карточка была. */
exports.dismissCard = async (p) => {
  const on = await p.evaluate(() => { const e = document.querySelector('#drinkCard'); return !!e && !e.hidden; });
  if (on) { await p.click('[data-cardok]'); await p.waitForTimeout(500); }
  return on;
};
/**
 * Песочница вместо «новой игры с нуля»: открывает #dev-nopixi-lowfx и запускает день программно тем же кодом, что кнопка «Начать»
 * (window.__sandbox.start). Состояние выводится из дня, как у обычного игрока (data/typical-progress.json).
 * o: { day, profile: 'medium'|'confident' (по умолчанию medium), mode: 'all' (всё доступное, по умолчанию) | 'typical', pace, showTutorial,
 *      custom: { rank, rating, served, money, items } — необязательное переопределение («Своё»), значения приводятся к допустимым для дня }.
 * Обучение по умолчанию выключено (showTutorial: true включит). Возвращает, когда экран закрылся и день идёт.
 */
exports.sandboxStart = async (p, url, o = {}) => {
  await p.goto('about:blank'); await p.goto(url + '#dev-nopixi-lowfx');
  await p.waitForSelector('[data-sandbox]', { timeout: 30000 });
  await p.waitForTimeout(400);
  await p.evaluate(c => window.__sandbox.start(c), o);
  await p.waitForSelector('#screen', { state: 'hidden', timeout: 10000 });
};
