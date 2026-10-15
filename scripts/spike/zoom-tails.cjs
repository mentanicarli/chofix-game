// Временный кадр для хвостов 24б: нижняя полоса центра в увеличении ×2,5 (витрина, ледогенератор, микроволновка).
const { chromium } = require('../../e2e/node_modules/playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const src = path.resolve('out/sec/base_center.png').split(path.sep).join('/');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 330 } });
  fs.writeFileSync('out/sec/_zoom.html', `<body style="margin:0;background:#F6EAD6"><div style="width:1280px;height:330px;overflow:hidden;position:relative"><img src="file://${src}" style="position:absolute;left:-600px;top:-1540px;width:3200px;image-rendering:auto"></div>`); await p.goto('file://' + path.resolve('out/sec/_zoom.html').split(path.sep).join('/'));
  await p.waitForTimeout(400); await p.screenshot({ path: 'docs/art/sections/f_tails_zoom.png' }); await b.close();
})();
