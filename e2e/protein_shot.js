/* Билет и книга рецептов у протеина (шаги без «лёд»): инструмент для глаз, не тест. Отладочная сборка.
   CHROMIUM_ARGS=--mute-audio node e2e/protein_shot.js dist/artifact.html docs/art/drinks/h2-4 */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'docs/art/drinks/h2-4'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { MENUAPI: window.__MENUAPI, get G() { return G; }, get D() { return D; }, get BR() { return BR; }, SBX, spawn, barOpen, applyUpgrades, showBook, get bookSel() { return bookSel; }, set bookSel(v) { bookSel = v; } };');
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.pr.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: (process.env.CHROMIUM_ARGS || '').split(' ').filter(Boolean) });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: PW.css })); PW.watch(p, errs);
  await p.goto('about:blank'); await p.goto(PW.url(tmp) + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400);
  await p.evaluate(() => window.__sandbox.start({ day: 40, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 });
  await p.waitForFunction(() => window.__dbg && window.__dbg.G, null, { timeout: 30000 });
  await p.addStyleTag({ content: '#banner{display:none!important}' });
  await p.evaluate(() => { const G = __dbg.G; G.tutOff = true; G.hints = false; __dbg.D.nextArr = 1e9; });
  await p.evaluate(() => { __dbg.SBX.next = { drink: 'protein_milk', size: '0.4', cold: true }; __dbg.spawn(); __dbg.D.customers.forEach(c => { c.pat = c.max = 1e9; }); });
  await p.waitForFunction(() => __dbg.D.customers.length && __dbg.D.customers.every(c => c.arrived), null, { timeout: 120000 });
  await p.evaluate(() => __dbg.barOpen(__dbg.D.customers[0]));
  await p.waitForTimeout(600); await PW.dismissCard(p);
  await p.click('[data-tkmore]'); await p.waitForTimeout(400);
  await p.locator('#bTk').screenshot({ path: `${out}/protein_ticket.png` });
  const steps = await p.evaluate(() => [...document.querySelectorAll('#bTk .tkSteps *')].map(e => e.textContent.trim()).filter(Boolean));
  console.log('билет:', JSON.stringify(steps), '| в билете «лёд»:', steps.some(s => /лёд/i.test(s)));
  await p.evaluate(() => { __dbg.G.rank = 9; __dbg.bookSel = { protein_milk: { size: '0.4', cold: true }, protein_water: { size: '0.4', cold: true } }; __dbg.showBook('hud'); });
  await p.waitForTimeout(800);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => { const bb = document.querySelector('.bookBody'), el = document.querySelector('.bk[data-drink="protein_water"]'); bb.scrollTop += el.getBoundingClientRect().top - bb.getBoundingClientRect().top - 4; }); await p.waitForTimeout(500); }
  await p.waitForTimeout(300);
  await p.locator('.book').screenshot({ path: `${out}/protein_book.png` });
  const book = await p.evaluate(() => [...document.querySelectorAll('.bk[data-drink^="protein_"] ol li')].map(e => e.textContent.trim()));
  console.log('книга:', JSON.stringify(book), '| в книге «лёд»:', book.some(s => /лёд/i.test(s)));
  console.log(errs.length ? errs.slice(0, 6).join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
