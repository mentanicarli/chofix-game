// Временный замер Б0: память и время растеризации арта бара (части bar-parts.json) при разных разрешениях,
// лимиты WebGL. Не входит в сборку. node scripts/spike/texture-budget.cjs
const { chromium } = require('../../e2e/node_modules/playwright'); const fs = require('fs');
(async () => {
  const parts = JSON.parse(fs.readFileSync('src/assets/art/bar-parts.json', 'utf8'));
  const defs = fs.readFileSync('src/assets/art/defs.svgf', 'utf8');
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('about:blank');
  const r = await p.evaluate(async ({ parts, defs }) => {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const info = { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?', maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), maxUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS), maxRb: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) };
    const doc = (inner, bx, sc) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bx.x} ${bx.y} ${bx.w} ${bx.h}" width="${Math.ceil(bx.w * sc)}" height="${Math.ceil(bx.h * sc)}"><defs>${defs}</defs>${inner}</svg>`;
    const raster = async (inner, bx, sc) => {
      const url = URL.createObjectURL(new Blob([doc(inner, bx, sc)], { type: 'image/svg+xml' }));
      const img = new Image(); await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
      const cv = document.createElement('canvas'); cv.width = Math.ceil(bx.w * sc); cv.height = Math.ceil(bx.h * sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); return cv;
    };
    const out = {};
    for (const res of [1, 1.5, 2]) {
      const t0 = performance.now(); let px = 0, n = 0; const keep = [];
      const staticMs = {};
      for (const [id, pt] of Object.entries(parts)) {
        const t1 = performance.now(); const cv = await raster(pt.svg, pt.box, res); staticMs[id] = performance.now() - t1;
        px += cv.width * cv.height; n++; keep.push(cv);
      }
      out[res] = { parts: n, ms: Math.round(performance.now() - t0), MB: +(px * 4 / 1e6).toFixed(1), staticMs: Math.round(staticMs.static), counterMs: Math.round((staticMs.counterFront || 0) + (staticMs.counterNose || 0)) };
    }
    return { info, out };
  }, { parts, defs });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
