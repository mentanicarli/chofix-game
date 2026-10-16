const path = require('path');
/* шрифты встраиваются как data-URI: так они грузятся и из файла, и со статического сервера, на любой ОС */
const F = p => 'data:font/woff2;base64,' + require('fs').readFileSync(path.resolve(__dirname, 'node_modules/@fontsource', p)).toString('base64');
const face = (fam, w, sub, range) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(${F(fam.toLowerCase() + '/files/' + fam.toLowerCase() + '-' + sub + '-' + w + '-normal.woff2')}) format('woff2');unicode-range:${range};}`;
const R = { cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', 'latin-ext': 'U+0100-02AF,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF' };
let css = '';
for (const [fam, ws] of [['Nunito', [600, 700, 800]], ['Caveat', [600, 700]]]) for (const w of ws) for (const sub of Object.keys(R)) css += face(fam, w, sub, R[sub]);
exports.page = async (browser, vp = { width: 1312, height: 752 }) => {
  const p = await browser.newPage({ viewport: process.env.VP ? { width: +process.env.VP.split('x')[0], height: +process.env.VP.split('x')[1] } : vp, deviceScaleFactor: Number(process.env.DSF || 1) });
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
/** Окна поверх бара («Зачем это нужно», карточка «Новый напиток») → «Понятно», пока они есть. Возвращает, сколько окон закрыто. */
exports.dismissCard = async (p) => {
  let n = 0;
  for (let i = 0; i < 6; i++) {
    const on = await p.evaluate(() => { const e = document.querySelector('#drinkCard'); return !!e && !e.hidden; });
    if (!on) break;
    await p.click('[data-cardok]'); await p.waitForTimeout(450); n++;
  }
  return n;
};
/**
 * Песочница вместо «новой игры с нуля»: открывает #dev-nopixi-lowfx и запускает день программно тем же кодом, что кнопка «Начать»
 * (window.__sandbox.start). Состояние выводится из дня, как у обычного игрока (data/typical-progress.json).
 * o: { day, profile: 'medium'|'confident' (по умолчанию medium), mode: 'all' (всё доступное, по умолчанию) | 'typical', pace, showTutorial,
 *      custom: { rank, rating, served, money, items } — необязательное переопределение («Своё»), значения приводятся к допустимым для дня }.
 * Обучение по умолчанию выключено (showTutorial: true включит). Возвращает, когда экран закрылся и день идёт.
 */
exports.sandboxStart = async (p, url, o = {}) => {
  await p.goto('about:blank'); await p.goto(url + '#dev-nopixi-lowfx' + (o.sections || process.env.SEC ? '' : '-nosec')); /* без листания секций: плитки боковых станций кликаются в центре, как до Б1-4 (SEC=1 или o.sections — с листанием) */
  await p.waitForSelector('[data-sandbox]', { timeout: 30000 });
  await p.waitForTimeout(400);
  await p.evaluate(c => window.__sandbox.start(c), o);
  await p.waitForSelector('#screen', { state: 'hidden', timeout: 10000 });
};

/* Камера бара (Б1-1), только #dev: window.__sec.go('L'|'C'|'R', instant); вернёт false, если секция закрыта */
exports.goSection = (p, id, instant = true) => p.evaluate(([i, n]) => window.__sec.go(i, n), [id, instant]);

/** Станция бокового ряда (чай, матча, порошки, соки, сифон, пенка, блендер, бабл ти, шейкер) — зона в боковой секции, когда листание включено. */
const SIDE = ['tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker'];
/** Селектор нужной зоны: при листании у боковых станций две зоны с одним id (плитка в центре не активна), берём ту, что в боковой секции. */
exports.zoneSel = z => (SIDE.includes(z) ? `#bZones [data-sec] [data-z=${z}]` : `#bZones > [data-z=${z}]`);
/** Камера к секции станции (#dev с листанием): возвращает секцию или null, если листания нет. Без листания (#dev-nosec) ничего не делает. */
exports.goToStation = async (p, zone) => {
  const sec = await p.evaluate(z => { if (!window.__sec) return null; const s = window.__MENUAPI.sectionOfZone(z) || 'C'; return window.__sec.state().sec === s || window.__sec.go(s, true) ? s : null; }, zone);
  if (sec) await p.waitForTimeout(150);
  return sec;
};
/** Клик по зоне станции: сначала камера в её секцию (если листание включено). */
exports.clickZone = async (p, zone, opts = { force: true }) => {
  const on = await p.evaluate(() => !!document.querySelector('#bZones [data-sec]'));
  if (on) await exports.goToStation(p, zone);
  await p.click(on ? exports.zoneSel(zone) : `[data-z=${zone}]`, opts);
};
