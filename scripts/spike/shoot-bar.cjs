// Временный снимок реального кадра бара для макетов секций (Б0). Не входит в сборку.
// node scripts/spike/shoot-bar.cjs <outDir>; нужна отладочная сборка dist/artifact.html (CUPPABLE_DEBUG=1).
// Снимает: base_center.png (только мир бара без плиток и интерфейса), ui_*.png (интерфейс на прозрачном фоне),
// rects.json (прямоугольники интерфейса в координатах сцены 1280×720).
const { chromium } = require('../../e2e/node_modules/playwright'); const path = require('path'); const fs = require('fs');
const pw = require('../../e2e/pw');
(async () => {
  const out = path.resolve(process.argv[2]); fs.mkdirSync(out, { recursive: true });
  const html = path.resolve('dist/artifact.html');
  const src = fs.readFileSync(html, 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, spawn, barOpen, zoneClick, applyUpgrades, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  const tmp = html.replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch();
  const p = await pw.page(b, { width: 1312, height: 752 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + tmp + '#nopixi-lowfx'); await p.waitForTimeout(3500);
  await pw.startNew(p); await p.waitForTimeout(300);
  await p.waitForFunction(() => window.__dbg.D.customers[0] && window.__dbg.D.customers[0].arrived, null, { timeout: 90000 });
  if (process.env.NOHINT) await p.evaluate(() => { window.__NOHINT = true; });
  const EQ = (process.env.EQ || 'ice,case_snacks,case_pastry,case_dessert,fridge_deli,microwave,cream').split(',').filter(Boolean);
  await p.evaluate((eq) => { const G = window.__dbg.G; eq.forEach(k => G['eq_' + k] = true); G.milk = true; window.__dbg.applyUpgrades(); }, EQ);
  await p.evaluate(() => { const M = window.__MENUAPI, c = __dbg.D.customers[0], dk = M.drinkById['matcha_latte']; c.drink = 'matcha_latte'; c.order.key = 'matcha_latte'; c.order.id = 'matcha_latte'; c.order.name = dk.name; c.order.size = '0.3'; c.order.cold = false; c.order.food = null; c.syrup = null; c.pumps = 0; __dbg.D.customers.forEach(x => x.pat = x.max = 9999); __dbg.G.tutOff = true; if (window.__NOHINT) __dbg.G.hints = false; __dbg.barOpen(c); });
  await p.waitForTimeout(1500); await pw.dismissCard(p);
  const box = await p.evaluate(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await p.waitForTimeout(1200);
  const rect = async sels => p.evaluate((sels) => { const o = {}; const st = document.querySelector('#stage').getBoundingClientRect(); for (const s of sels) { const e = document.querySelector(s); if (e && !e.hidden) { const r = e.getBoundingClientRect(); if (r.width) o[s] = [Math.round(r.x - st.x), Math.round(r.y - st.y), Math.round(r.width), Math.round(r.height)]; } } return o; }, sels);
  const SEL = ['#hud', '#bTk', '#bCoach', '#bFloat', '#toast', '#bGoal', '#xPanel', '#bClose', '#chPause', '#chSound', '#bp', '#bi', '#foodPanel', '.chip'];
  const rects = {};
  rects.coach = await rect(SEL);
  // мир без интерфейса
  await p.addStyleTag({ content: '#stage > *:not(#world){visibility:hidden !important} #tint{display:none !important}' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/base_center.png', clip: box, timeout: 120000 });
  // интерфейс без мира, прозрачный фон
  await p.addStyleTag({ content: '#stage > *:not(#world){visibility:visible !important} #world{visibility:hidden !important} #bFloat,#toast{display:none !important} html,body,#stage{background:transparent !important}' });
  await p.waitForTimeout(300);
  const say = async (txt) => { await p.evaluate((t) => { const e = document.querySelector('#bCoach p'); if (e) e.innerHTML = t; }, txt); await p.waitForTimeout(150); };
  await say('Начнём с матчи. Нажмите на набор для матчи.');
  await p.screenshot({ path: out + '/ui_matcha_here.png', clip: box, omitBackground: true, timeout: 120000 });
  await say('Матча готовится в секции «Чайный бар». Нажмите стрелку с этим названием.');
  await p.screenshot({ path: out + '/ui_matcha_away.png', clip: box, omitBackground: true, timeout: 120000 });
  await p.evaluate(() => { const e = document.querySelector('#bCoach'); e.style.display = 'none'; });
  await p.screenshot({ path: out + '/ui_nocoach.png', clip: box, omitBackground: true, timeout: 120000 });
  await p.evaluate(() => { const e = document.querySelector('#bCoach'); e.style.display = ''; });
  const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: out + '/' + name + '.png', clip: box, omitBackground: true, timeout: 120000 }); };
  // билет раскрыт
  await p.click('#bTk .tkMore'); await shot('ui_ticket_open'); rects.ticketOpen = await rect(['#bTk', '#bCoach']);
  await p.click('#bTk .tkMore'); await p.waitForTimeout(300);
  // станция нового ядра (матча): окно #xPanel
  await p.evaluate(() => __dbg.zoneClick('whisk')); await p.waitForTimeout(450);
  await shot('ui_panel_matcha'); rects.panel = await rect(['#xPanel', '#bTk', '#bCoach', '#bClose', '#bGoal', '#bp']);
  await p.evaluate(() => document.querySelector('#bClose').click()); await p.waitForTimeout(400);
  // инсет кофемолки
  await p.evaluate(() => { const r = document.querySelector('#bZones [data-z="grind"]'); r.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await shot('ui_inset_grind'); rects.inset = await rect(['#bi', '#bp', '#bTk', '#bCoach', '#bClose', '#bGoal']);
  fs.writeFileSync(out + '/rects.json', JSON.stringify(rects, null, 1));
  await b.close();
})();
