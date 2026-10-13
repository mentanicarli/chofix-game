// Проверка «неопределённых имён» в старом ядре: куски src/legacy склеиваются в один файл и гоняются через no-undef.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir = resolve(import.meta.dirname, '../src/legacy');
const src = readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const tmp = resolve(import.meta.dirname, '../.tmp');
mkdirSync(tmp, { recursive: true });
const out = join(tmp, 'legacy_all.js');
writeFileSync(out, `(() => {\n${src}\n})();\n`);
const r = spawnSync('npx', ['eslint', '--no-config-lookup', '-c', resolve(import.meta.dirname, 'undef.config.mjs'), out], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
