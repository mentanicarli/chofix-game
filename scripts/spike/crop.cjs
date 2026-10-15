// Вырезка и увеличение части картинки: node scripts/spike/crop.cjs in.png out.png x y w h zoom [srcScale=1]
const { chromium } = require('../../e2e/node_modules/playwright'); const fs = require('fs'); const path = require('path');
(async () => { const [inp, out, x, y, w, h, z, sc] = process.argv.slice(2); const S = +(sc || 1);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Math.ceil(w * z), height: Math.ceil(h * z) } });
  const d = 'data:image/png;base64,' + fs.readFileSync(inp).toString('base64');
  await p.setContent(`<body style="margin:0;overflow:hidden"><img id=i src="${d}" style="position:absolute;image-rendering:auto"></body>`); await p.waitForTimeout(200);
  await p.evaluate(([x, y, z, S]) => { const i = document.getElementById('i'); const nw = i.naturalWidth / S; i.style.width = nw * z + 'px'; i.style.left = -x * z + 'px'; i.style.top = -y * z + 'px'; }, [+x, +y, +z, S]);
  await p.screenshot({ path: out }); await b.close(); })();
