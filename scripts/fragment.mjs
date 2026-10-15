// dist/index.html (полный документ, всё внутри) -> dist/artifact.html (фрагмент для публикации в Artifact)
import { readFileSync, writeFileSync } from 'node:fs';
const h = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const pick = (re) => (h.match(re) || [])[0] || '';
const title = pick(/<title>[\s\S]*?<\/title>/);
const links = (h.match(/<link[^>]*fonts\.googleapis[^>]*>/g) || []).join('\n');
const styles = (h.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
const scripts = (h.match(/<script[\s\S]*?<\/script>/g) || []).join('\n');
const body = h.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
let out = [title, links, styles, body.trim(), scripts].join('\n') + '\n';
// В отладочной сборке (без минификации) возвращаем стартовую строку в прежний вид — на неё опираются тесты.
if (process.env.CUPPABLE_DEBUG) out = out.replace(/newGame\(\);\s*updateHud\(\);\s*showTitle\(\);/, 'newGame(); updateHud(); showTitle();');
writeFileSync(new URL('../dist/artifact.html', import.meta.url), out);
console.log('artifact.html', (readFileSync(new URL('../dist/artifact.html', import.meta.url)).length / 1024).toFixed(0) + ' KB');
