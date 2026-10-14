// npm run audit:recipes: собирает scripts/recipes-audit.ts через esbuild и пишет docs/recipes_audit.md
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '..');
const outfile = resolve(root, '.tmp/recipes-audit.mjs');
mkdirSync(resolve(root, '.tmp'), { recursive: true });
await build({ entryPoints: [resolve(root, 'scripts/recipes-audit.ts')], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error' });
const { markdown } = await import(pathToFileURL(outfile).href);
writeFileSync(resolve(root, 'docs/recipes_audit.md'), markdown);
console.log('docs/recipes_audit.md:', markdown.split('\n').length, 'строк');
