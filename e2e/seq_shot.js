/* Серия кадров детерминированной симуляции: игра ставится на паузу цикла кадров, дальше шаги по 1/30 с.
 * node seq_shot.js <html> <out.png> '<js перед стартом>' '<x,y,w,h в координатах сцены>' '<t1,t2,...>' [масштаб] [колонок]
 * Расписание событий: в js-части `window.__at = [[сек, () => ...]]`.
 * Пример: node seq_shot.js ../dist/artifact.html ../out/sit.png "WORLD.sitT=0" 100,380,280,300 5,6,7 1 6 */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const [html, out, pre = '', clipS = '0,0,1280,720', timesS = '1', scaleS = '1', colsS = '6'] = process.argv.slice(2);
  const src = fs.readFileSync(path.resolve(html), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, WORLD, frame, get last() { return last; }, set last(v) { last = v; }, spawn, serve, deliver, ACT, setPause, startDay, tickDay, animActors, animBarista, tickSky, tickFx };');
  const tmp = path.resolve(html).replace('.html', '.seq.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1312, height: 752 }, deviceScaleFactor: +scaleS });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_FILE_NOT_FOUND|GL Driver Message/.test(t)) errs.push('CON ' + t.slice(0, 600)); });
  await p.addInitScript(seed => { const raf = window.requestAnimationFrame.bind(window); window.__hold = false; window.requestAnimationFrame = cb => window.__hold ? 0 : raf(cb); let a = seed; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, +(process.env.SEED || 777));
  await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: require('./pw').css }));
  await p.goto('file://' + tmp + (process.env.HASH || '#nopixi')); await p.waitForTimeout(2500);
  await require('./pw').startNew(p); await p.waitForTimeout(600);
  await p.evaluate(() => { window.__hold = true; });
  await p.waitForTimeout(300);
  await p.evaluate(pre => { const { WORLD, G, D } = window.__dbg; (0, eval)('(function(){ const {WORLD,G,D,ACT,spawn,serve,deliver}=window.__dbg; ' + pre + '\n})()'); }, pre);
  const clip = clipS.split(',').map(Number); const times = timesS.split(',').map(Number); const cols = +colsS;
  const shots = []; let t = 0;
  for (const tt of times) {
    const n = Math.max(0, Math.round((tt - t) * 30)); t = tt;
    await p.evaluate(n => { const d = window.__dbg; for (let i = 0; i < n; i++) { window.__sim = (window.__sim || 0) + 1 / 30; (window.__at || []).forEach(e => { if (!e.done && window.__sim >= e[0]) { e.done = true; e[1](); } }); d.frame(d.last + 33.333); } d.WORLD.app.render(); }, n);
    await p.waitForTimeout(60);
    shots.push((await p.screenshot({ timeout: 120000, clip: { x: 16 + clip[0], y: 16 + clip[1], width: clip[2], height: clip[3] } })).toString('base64'));
  }
  console.log('ERRS', errs.slice(0, 6).join('\n') || 'нет');
  const pg = await ctx.newPage(); const W = Math.round(clip[2] * +scaleS), H = Math.round(clip[3] * +scaleS);
  await pg.setContent(`<body style="margin:0;background:#2a1d17;display:grid;grid-template-columns:repeat(${cols},${W}px);gap:4px;font:12px sans-serif;color:#fff">` + shots.map((s, i) => `<div style="position:relative"><img src="data:image/png;base64,${s}"><span style="position:absolute;left:4px;top:2px;background:#0008;padding:0 3px">${times[i]}s</span></div>`).join('') + '</body>');
  await pg.screenshot({ path: out, fullPage: true });
  await b.close();
})();
