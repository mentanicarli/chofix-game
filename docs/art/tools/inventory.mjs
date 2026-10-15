// Инвентаризация графики Cuppable: считает части, размеры, ширины линий, цвета. Только чтение.
// Запуск: node docs/art/tools/inventory.mjs > out/art-audit/inventory.json
import fs from 'node:fs';
import path from 'node:path';
const R = (p) => fs.readFileSync(p, 'utf8');
const hist = (arr) => { const m = {}; for (const a of arr) m[a] = (m[a] || 0) + 1; return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1])); };
const norm = (h) => { h = h.toLowerCase(); return h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h; };
function svgStats(s) {
  const tags = hist([...s.matchAll(/<([a-zA-Z]+)[\s>/]/g)].map((m) => m[1]));
  const sw = hist([...s.matchAll(/stroke-width=["']?([\d.]+)/g)].map((m) => m[1]));
  const colors = hist([...s.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => norm(m[0])));
  const filters = hist([...s.matchAll(/filter=["']url\(#(\w+)\)/g)].map((m) => m[1]));
  return { bytes: s.length, elements: Object.values(tags).reduce((a, b) => a + b, 0), strokeWidths: sw, uniqueColors: Object.keys(colors).length, topColors: Object.fromEntries(Object.entries(colors).slice(0, 8)), filters, gradients: (s.match(/<(linear|radial)Gradient/g) || []).length, paths: tags.path || 0 };
}
const out = { svgf: {}, barParts: {}, code: {}, css: {}, legacy: {} };
for (const f of fs.readdirSync('src/assets/art').filter((f) => f.endsWith('.svgf'))) out.svgf[f] = svgStats(R('src/assets/art/' + f));
const bp = JSON.parse(R('src/assets/art/bar-parts.json'));
let totalTexts = 0;
for (const [k, v] of Object.entries(bp)) { const st = svgStats(v.svg); st.box = v.box; st.texts = (v.texts || []).length; totalTexts += st.texts; out.barParts[k] = st; }
out.barPartsTotal = { parts: Object.keys(bp).length, texts: totalTexts, bytes: R('src/assets/art/bar-parts.json').length };
for (const f of ['src/render/world/art.ts', 'src/render/world/world.ts', 'src/render/world/bar.ts', 'src/render/world/actor.ts', 'src/render/world/fx.ts', 'src/render/world/svg.ts', ...fs.readdirSync('src/render').filter((f) => f.endsWith('.ts')).map((f) => 'src/render/' + f), 'src/ui/menus.ts', 'src/ui/stationPanel.ts', 'src/ui/book.ts']) {
  const s = R(f); const c = hist([...s.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => norm(m[0])));
  out.code[f] = { lines: s.split('\n').length, bytes: s.length, hexColors: Object.keys(c).length, strokeWidthAttr: hist([...s.matchAll(/stroke-width[=:]\s*["']?([\d.]+)/g)].map((m) => m[1])), pixiStrokeWidth: hist([...s.matchAll(/width:\s*([\d.]+)/g)].map((m) => m[1])), graphicsCalls: (s.match(/new Graphics/g) || []).length };
}
for (const f of fs.readdirSync('src/styles')) {
  const s = R('src/styles/' + f); const col = hist([...s.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => norm(m[0])));
  out.css[f] = { bytes: s.length, hexColors: Object.keys(col).length, topColors: Object.fromEntries(Object.entries(col).slice(0, 12)), borderWidths: hist([...s.matchAll(/border(?:-\w+)?:\s*([\d.]+)px/g)].map((m) => m[1] + 'px')), radii: hist([...s.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim())), shadows: (s.match(/box-shadow/g) || []).length, fonts: hist([...s.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim().slice(0, 40))), fontSizes: Object.keys(hist([...s.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => m[1]))).length };
}
// иконки магазина/станций в legacy и UI
const scr = R('src/legacy/11-screens.js');
const iconBlock = [...scr.matchAll(/^\s{2}(\w+):\s*`<svg viewBox="([^"]+)"/gm)];
out.legacy.shopOrModeIcons = iconBlock.map((m) => ({ key: m[1], viewBox: m[2] }));
out.legacy.iconsByViewBox = hist(iconBlock.map((m) => m[2]));
for (const f of fs.readdirSync('src/legacy').filter((f) => f.endsWith('.js'))) {
  const s = R('src/legacy/' + f);
  out.legacy[f] = { bytes: s.length, svgLiterals: (s.match(/<svg/g) || []).length, hex: Object.keys(hist([...s.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => norm(m[0])))).length, emoji: (s.match(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu) || []).length };
}
// все цвета проекта
const all = {};
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|js|css|svgf|json|html)$/.test(e.name) && !/manifest|typical|menu\.json|progression|real-shifts/.test(e.name)) for (const m of R(p).matchAll(/#[0-9a-fA-F]{6}\b/g)) all[norm(m[0])] = (all[norm(m[0])] || 0) + 1; } };
walk('src'); out.allColors = { unique: Object.keys(all).length, top: Object.entries(all).sort((a, b) => b[1] - a[1]).slice(0, 40) };
const idx = R('index.html'); out.indexHtml = { bytes: idx.length, svgLiterals: (idx.match(/<svg/g) || []).length };
out.sfx = fs.existsSync('public/sfx') ? fs.readdirSync('public/sfx').length : 0;
out.menuDrinks = JSON.parse(R('data/menu.json')).drinks?.length;
console.log(JSON.stringify(out, null, 1));
