/* apple-touch-icon.png (180×180, квадратный фон без скруглений) из docs/brand/cuppable-icon.svg. node e2e/brand_png.js */
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  let svg = fs.readFileSync(path.resolve(__dirname, '../docs/brand/cuppable-icon.svg'), 'utf8').replace(' rx="52"', '').replace('width="240" height="240"', 'width="180" height="180"');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 180, height: 180 } });
  await p.setContent(`<body style="margin:0">${svg}</body>`);
  await p.screenshot({ path: path.resolve(__dirname, '../public/apple-touch-icon.png') }); await b.close();
})();
