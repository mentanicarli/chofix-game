const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { WORLD };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await require('./pw').page(b);
  await p.goto('file://' + tmp + (process.env.HASH || '')); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const W = window.__dbg.WORLD, gl = W.app.renderer.gl, S = W.app.stage, o = {}, px = new Uint8Array(4);
    const PIXI = Object.getPrototypeOf(S).constructor; 
    const kids = S.children.slice(); kids.forEach(c => c.visible = false);
    const t = (k = 5) => { const a = performance.now(); for (let i = 0; i < k; i++) { W.app.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return ((performance.now() - a) / k).toFixed(0); };
    const bgSprite = kids[1];
    bgSprite.visible = true; o.bg = t();
    const tex = bgSprite.texture; o.texSize = [tex.width, tex.height, tex.source.resolution, tex.source.alphaMode, tex.source.format, tex.source.autoGenerateMipmaps];
    const sp = new bgSprite.constructor(tex.constructor.WHITE); sp.width = 1280; sp.height = 720; S.addChild(sp);
    bgSprite.visible = false; o.white = t();
    sp.texture = tex; sp.width = 1280; sp.height = 720; o.sameTexNew = t();
    return o;
  });
  console.log(JSON.stringify(r)); await b.close();
})();
