const { chromium } = require('playwright');
(async () => { const f = process.argv[2]; const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const p = await require('./pw').page(b);
p.on('pageerror', e => console.log('PAGE', e.message)); p.on('console', m => { if (m.type()==='error'||m.type()==='warning') console.log(m.type(), m.text().slice(0,200)); });
await p.addInitScript(() => { window.addEventListener('blur', () => console.log('BLUR event')); document.addEventListener('visibilitychange', () => console.log('VIS', document.hidden)); });
await p.goto('file://' + require('path').resolve(f) + '#nopixi'); await p.waitForTimeout(2500);
await require('./pw').startNew(p); await p.waitForTimeout(1500);
console.log('screen hidden:', await p.evaluate(() => document.querySelector('#screen').hidden));
const t = Date.now(); try { await p.screenshot({ path: '../out/_d.png', timeout: 20000 }); console.log('shot ok', Date.now() - t); } catch (e) { console.log('shot fail', e.message.split('\n')[0]); }
console.log('screen hidden:', await p.evaluate(() => document.querySelector('#screen').hidden));
await b.close(); })();
