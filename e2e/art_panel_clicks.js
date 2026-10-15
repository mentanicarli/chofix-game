/* Реальные клики по кнопкам чайной панели (воспроизведение замечания №6: «кнопки обрезаны и работают через раз»). Инструмент аудита.
   node e2e/art_panel_clicks.js dist/artifact.html out/art-audit/sys   (отладочная сборка) */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'out/art-audit/sys'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, spawn, barOpen, zoneClick, applyUpgrades };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const res = [];
  for (const [w, h] of [[1280, 720], [1024, 600], [1920, 1080]]) {
    const p = await PW.page(b, { width: w, height: h });
    await p.goto('about:blank'); await p.goto(PW.url(tmp) + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400);
    await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 });
    await p.evaluate(() => { const d = __dbg; d.G.eq_tea = true; d.G.tutOff = true; d.applyUpgrades(); d.D.nextArr = 1e9; d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; }); });
    await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
    await p.evaluate(() => { const M = window.__MENUAPI, c = __dbg.D.customers[0]; c.drink = 'tea_sencha'; c.order.key = 'tea_sencha'; c.order.id = 'tea_sencha'; c.order.name = M.drinkById.tea_sencha.name; c.order.size = '0.6'; c.order.cold = false; c.order.food = null; __dbg.barOpen(c); });
    await p.waitForTimeout(800); await PW.dismissCard(p);
    await p.evaluate(() => __dbg.zoneClick('brew')); await p.waitForTimeout(700);
    const rec = { size: `${w}x${h}`, temps: [], go: null, done: [] };
    const real = async (sel, nth, yFrac = .5, hold = 70) => { const r = await p.evaluate(({ sel }) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, dis: e.disabled }; }, { sel }); if (!r) return { missing: true }; const x = r.x + r.w / 2, y = r.y + r.h * yFrac; await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(hold); await p.mouse.up(); await p.waitForTimeout(120); return { rect: r, x, y }; };
    for (const t of [70, 80, 90, 95, 80, 95, 70, 90]) { await real(`[data-xtemp="${t}"]`); const set = await p.evaluate(() => __dbg.BR.xs.brew.set); rec.temps.push({ want: t, got: set, ok: set === t }); }
    const g = await real('[data-xstart]'); rec.go = { started: await p.evaluate(() => !!__dbg.BR.xs.brew.started), rect: g.rect };
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/tea_clicks_${w}x${h}.png` });
    /* «Вынуть»: по центру, по нижней видимой кромке и по самой нижней точке кнопки */
    for (const [lbl, yf] of [['центр', .5], ['низ -4px', 0.97], ['низ кнопки', 0.995]]) {
      const before = await p.evaluate(() => !!__dbg.BR.done.brew);
      const r = await p.evaluate(() => { const e = document.querySelector('[data-xdone]'); if (!e) return null; const r = e.getBoundingClientRect(); const pr = document.querySelector('#xPanel').getBoundingClientRect(); return { btnBottom: r.bottom, panelBottom: pr.bottom, hit: (() => { const x = r.left + r.width / 2, y = r.top + r.height * 0.97; const h = document.elementFromPoint(x, y); return h ? (h.tagName + (h.id ? '#' + h.id : '') + (h.className ? '.' + String(h.className).slice(0, 20) : '')) : null; })() }; });
      if (!r) { rec.done.push({ lbl, note: 'кнопки уже нет (панель закрыта)' }); break; }
      await real('[data-xdone]', 0, yf);
      const after = await p.evaluate(() => !!__dbg.BR.done.brew);
      rec.done.push({ lbl, before, after, btnBottom: Math.round(r.btnBottom), panelBottom: Math.round(r.panelBottom), hitAt97pct: r.hit });
      if (after) break;
    }
    res.push(rec); await p.close();
  }
  fs.writeFileSync(`${out}/tea_clicks.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1)); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
