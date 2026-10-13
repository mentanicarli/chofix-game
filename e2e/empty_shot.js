const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1312, height: 752 }, deviceScaleFactor: 1 })).newPage();
  await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: require('./pw').css }));
  await p.addInitScript(() => { Math.random = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); });
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(2500);
  await require('./pw').startNew(p); await p.addStyleTag({ content: '#tint,#banner,#hud,#hudR,#frontHint{display:none!important}' }); await p.waitForTimeout(700);
  await p.screenshot({ path: process.argv[3] });
  await b.close();
})();
