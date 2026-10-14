// npm run sim:table: собирает scripts/typical-progress.ts через esbuild, считает таблицу и пишет data/typical-progress.json
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '..');
const outfile = resolve(root, '.tmp/typical-progress.mjs');
mkdirSync(resolve(root, '.tmp'), { recursive: true });
await build({ entryPoints: [resolve(root, 'scripts/typical-progress.ts')], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error' });
const { buildTable } = await import(pathToFileURL(outfile).href);
const t0 = Date.now();
const table = buildTable();
writeFileSync(resolve(root, 'data/typical-progress.json'), JSON.stringify(table) + '\n');
for (const [id, p] of Object.entries(table.profiles)) {
  const d = (n) => p.days[n - 1];
  console.log(id, 'день 10: ранг', d(10).rank, 'рейтинг', d(10).rating, 'подано', d(10).served, 'деньги', d(10).money, 'покупок', p.purchases.filter((x) => x.day <= 10).length, '| день 60: ранг', d(60).rank, 'покупок', p.purchases.length);
}
console.log('готово за', Math.round((Date.now() - t0) / 1000), 'с → data/typical-progress.json');
