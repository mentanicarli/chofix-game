/* Плеер музыки на коротких тестовых треках (по ~6 с): очередь по кругу, кроссфейд, подгрузка следующего, названия.
   Запуск: BASE=http://localhost:4174/cuppable/ node e2e/music_test.js   (треки: scratch gen.mjs + MUSIC_DIR) */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173/';
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await require('./pw').page(b);
  const errs = []; require('./pw').watch(p, errs);
  await p.addInitScript(() => { const A = window.Audio; window.__audios = []; window.Audio = function () { const a = new A(); window.__audios.push(a); return a; }; });
  await p.goto(BASE + '#nopixi-lowfx'); await p.waitForSelector('[data-menu=title]', { timeout: 30000 }); await p.waitForTimeout(800);
  const np = () => p.evaluate(() => { const e = document.querySelector('[data-np]'); return e && !e.hidden ? e.textContent.trim() : ''; });
  console.log('до жеста:', JSON.stringify(await np()), 'играет:', await p.evaluate(() => window.__audios.filter(a => !a.paused).length));
  await p.click('[data-howto]'); await p.waitForTimeout(700); await p.click('[data-menuback]');
  const seen = []; let both = 0, t0 = Date.now(); const names = [];
  while (Date.now() - t0 < 24000) {
    const s = await p.evaluate(() => ({ pl: window.__audios.filter(a => !a.paused).map(a => decodeURIComponent(a.src.split('/').pop()) + '@' + a.volume.toFixed(2)), np: (document.querySelector('[data-np]') || {}).textContent || '' }));
    if (s.pl.length > 1) both++;
    if (names[names.length - 1] !== s.np.trim()) { names.push(s.np.trim()); }
    seen.push(s.pl.join(' + ')); await p.waitForTimeout(400);
  }
  console.log('строки «сейчас играет» по порядку:\n  ' + names.join('\n  '));
  console.log('замеров с двумя играющими (кроссфейд):', both);
  console.log('пример замеров:', seen.slice(0, 3).join(' | '), '...', seen.slice(-2).join(' | '));
  const loaded = await p.evaluate(() => window.__audios.map(a => decodeURIComponent(a.src.split('/').pop()) + ':' + a.readyState));
  console.log('подгружено (readyState):', loaded.join(', '));
  if (names.filter(Boolean).length < 3) errs.push('FAIL треки не сменялись');
  if (!both) errs.push('FAIL не было кроссфейда');
  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
