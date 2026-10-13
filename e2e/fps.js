const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: (process.argv[3]||'').split(' ').filter(Boolean) });
  const p = await require('./pw').page(b);
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(2500);
  await p.click('[data-start]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(2500);
  if (process.argv[4]) await p.addStyleTag({ content: process.argv[4] });
  await p.waitForTimeout(500);
  const fps = await p.evaluate(async () => { let fr = 0; const t0 = performance.now(); await new Promise(res => { const f = () => { fr++; if (performance.now() - t0 > 3000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); return (fr / 3).toFixed(1); });
  console.log(process.argv[2], process.argv[4] || '', 'fps', fps); await b.close();
})();
