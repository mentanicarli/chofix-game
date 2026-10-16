// Итоговые листы Н2-4: all56_sheet.png (все 56 видов × размеры, три уровня: full, compact, tiny) и places_sheet.png (восемь напитков в шести местах).
// node scripts/spike/h24-sheet.cjs docs/art/drinks/h2-4
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const { chromium } = require('../../e2e/node_modules/playwright');
const OUT = path.resolve(process.argv[2] || 'out/h24'); fs.mkdirSync(OUT, { recursive: true });
const tmp = path.resolve('out/h24'); fs.mkdirSync(tmp, { recursive: true });
const bundle = path.join(tmp, 'h12.cjs');
execSync(`npx esbuild scripts/spike/h12-entry.ts --bundle --format=cjs --platform=node --outfile="${bundle}" --log-level=error`, { stdio: 'inherit' });
const M = require(bundle);
const specs = M.allSpecs();
const ids = [...new Set(specs.map((s) => s.id))];
const css = `<style>body{margin:0;background:#F6E9D2;padding:12px;font-family:sans-serif;color:#4A2F25}.r{display:flex;align-items:flex-end;gap:10px;border-top:2px solid #4A2F25;padding:6px 0}.n{width:170px;font:800 12px sans-serif}.n small{font-weight:600;display:block}.c{display:flex;flex-direction:column;align-items:center;min-width:70px}.l{font:700 10px sans-serif;margin-top:2px}.ib{background:#FFFDF6;border-radius:6px;border:1px solid #D9C7A5;overflow:hidden;display:flex;align-items:flex-end;justify-content:center}.sep{width:2px;align-self:stretch;background:#C9B38A}h2{margin:0 0 6px;font:800 16px sans-serif}.g{display:flex;gap:6px;align-items:flex-end}.ibx{background:#FFFDF6;border-radius:6px;border:1px solid #D9C7A5;overflow:hidden}</style>`;
const lab = (s) => `${s.size.replace('.', ',')} л`;
const full = (sp) => `<div class="c">${M.drinkSvg(sp, { level: 'full', s: M.BAR_UNIT[sp.vessel.material] * 0.8, saucer: true, steamMark: true }).svg}<div class="l">${lab(sp)}</div></div>`;
const compact = (sp) => `<div class="c">`+`<div class="ibx" style="position:relative;width:150px;height:150px"><div style="position:absolute;left:50%;bottom:8px;transform:translateX(-50%) scale(3);transform-origin:50% 100%">${M.drinkIconSvg(sp, 49, 42).svg}</div></div>`+`<div class="l">${lab(sp)}</div></div>`;
const tinyAt = (sp, place) => { const u = M.cupUnit(place, sp.vessel.material); const plan = M.cupPlan({ id: sp.id, size: sp.size, cold: sp.cold }, place, 1); const p = M.drinkSvg(sp, { level: plan.lod, s: u, noSaucer: true }); return `<div class="c">`+`<div class="ibx" style="position:relative;width:130px;height:130px"><div style="position:absolute;left:50%;bottom:8px;transform:translateX(-50%) scale(3);transform-origin:50% 100%">${p.svg}</div></div>`+`<div class="l">${lab(sp)} · ${Math.round(plan.heightPx)} px ${plan.lod}</div></div>`; };
let html = css + '<h2>Все 56 видов × размеры (Н2-4): полный (бар ×2,0) | иконка билета 49×42 (×3, компактный уровень) | чашка гостя в руке и на столе (×3, уровень по высоте)</h2>';
for (const id of ids) for (const cold of [false, true]) {
  const list = specs.filter((s) => s.id === id && s.cold === cold);
  if (!list.length) continue;
  html += `<div class="r"><div class="n">${id}${cold ? ' · хол.' : ' · гор.'}<small>${list[0].group} · ${list[0].vessel.material}</small></div><div class="g">${list.map(full).join('')}</div><div class="sep"></div><div class="g">${list.map(compact).join('')}</div><div class="sep"></div><div class="g">${list.map((s) => tinyAt(s, 'guest')).join('')}</div></div>`;
}
const places = [['espresso', '0.2', false], ['cappuccino', '0.3', false], ['latte_sakura', '0.4', false], ['tea_hibiscus', '0.4', false], ['cappuccino', '0.4', true], ['orange_bumble', '0.4', true], ['aerocano', '0.4', true], ['boba_raspberry', '0.4', true]];
let ph = css + '<h2>Восемь напитков в шести местах (Н2-4): бар ×2,5 | книга ×1,15 | окно «Новый напиток» ×1,4 | билет 49×42 (×3) | пузырь 38×41 (×3) | рука баристы / рука и стол гостя / полёт (×3)</h2>';
for (const [id, size, cold] of places) {
  const sp = M.specOf(id, size, cold);
  const ib = (w, h, svg) => `<div class="c"><div class="ibx" style="width:${w * 3}px;height:${h * 3}px"><div style="transform:scale(3);transform-origin:0 0;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">${svg}</div></div></div>`;
  const hand = (place) => tinyAt(sp, place);
  ph += `<div class="r"><div class="n">${id}<small>${cold ? 'хол.' : 'гор.'} ${size.replace('.', ',')} л · ${sp.vessel.material}</small></div>`
    + `<div class="c">${M.drinkSvg(sp, { level: 'full', s: M.BAR_UNIT[sp.vessel.material], saucer: true }).svg}</div><div class="sep"></div>`
    + `<div class="c">${M.drinkArtSvg(sp, 1.15).svg}</div><div class="sep"></div>`
    + `<div class="c">${M.drinkArtSvg(sp, 1.4).svg}</div><div class="sep"></div>`
    + ib(49, 42, M.drinkIconSvg(sp, 49, 42).svg) + ib(38, 41, M.drinkIconSvg(sp, 38, 41).svg) + '<div class="sep"></div>'
    + hand('barista') + hand('guest') + hand('fly') + '</div>';
}
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  await p.setContent(html); await p.screenshot({ path: path.join(OUT, 'all56_sheet.png'), fullPage: true });
  await p.setViewport?.call; await p.setViewportSize({ width: 2400, height: 900 }); await p.setContent(ph); await p.screenshot({ path: path.join(OUT, 'places_sheet.png'), fullPage: true });
  await b.close();
})();
