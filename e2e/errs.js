const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) }); const p = await require('./pw').page(b);
 p.on('pageerror', e => console.log('PAGEERR', e.message, (e.stack||'').split('\n').slice(0,3).join('|'))); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
 await p.goto('file://' + path.resolve(process.argv[2]) + '#nopixi'); await p.waitForTimeout(1500); await b.close(); })();
