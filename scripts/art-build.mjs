// Сборка арта из исходников art-src/**/*.svg в src/assets/art/*.svgf (стайлгайд, разд. 10; этап 12.3(0)).
// Запуск: npm run art (записать) / npm run art:check (только сравнить, код возврата 1 при расхождении).
// Результат коммитится: check, build и CI этот скрипт не запускают.
// Правила исходника: корневой <svg viewBox data-out="имя.svgf" data-scale="масштаб предмета на экране (1 или GUEST_K = 1,6)">,
// внутри только фигуры; {{ИМЯ}} — цвет из palette.json; {{L}} {{M}} {{D}} — толщина контура 3,5 / 3 / 2 экранных px, делённая на data-scale.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'art-src');
const OUT = join(ROOT, 'src/assets/art');
const check = process.argv.includes('--check');
const pal = JSON.parse(readFileSync(join(SRC, 'palette.json'), 'utf8'));

const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.svg')) files.push(p);
  }
})(SRC);

let bad = 0;
const fail = (f, m) => { console.error(`✗ ${relative(ROOT, f)}: ${m}`); bad++; };
for (const f of files.sort()) {
  let s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const head = /<svg\b([^>]*)>/.exec(s);
  if (!head) { fail(f, 'нет корневого <svg>'); continue; }
  const attr = (n) => new RegExp(`${n}="([^"]*)"`).exec(head[1])?.[1];
  const out = attr('data-out'), scale = Number(attr('data-scale') ?? '1');
  if (!out || !attr('viewBox') || !(scale > 0)) { fail(f, 'нужны viewBox, data-out и data-scale > 0'); continue; }
  const w = Object.fromEntries(Object.entries(pal.stroke).map(([k, v]) => [k, +(v / scale).toFixed(2)]));
  let inner = s.slice(head.index + head[0].length, s.lastIndexOf('</svg>'));
  inner = inner.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').trim();
  let unknown = '';
  inner = inner.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in pal.colors ? pal.colors[k] : k in w ? String(w[k]) : ((unknown = m), m)));
  if (unknown) { fail(f, `неизвестный токен ${unknown}`); continue; }
  /* правила стайлгайда: только три толщины и цвета из палитры */
  const widths = new Set(Object.values(w).map(String));
  for (const m of inner.matchAll(/stroke-width="([\d.]+)"/g)) if (!widths.has(m[1])) fail(f, `толщина ${m[1]} не из набора ${[...widths].join(' / ')}`);
  const colors = new Set(Object.values(pal.colors).map((c) => c.toLowerCase()));
  for (const m of inner.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g)) if (!colors.has(m[1].toLowerCase())) fail(f, `цвет ${m[1]} вне палитры`);
  const target = join(OUT, out);
  const text = inner + '\n';
  if (check) {
    if (!existsSync(target) || readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== text) fail(f, `${out} устарел: запустите npm run art`);
  } else {
    writeFileSync(target, text);
    console.log(`${relative(ROOT, f)} → src/assets/art/${out} (${text.length} Б)`);
  }
}
if (bad) process.exit(1);
console.log(check ? 'art-src и src/assets/art совпадают' : `собрано файлов: ${files.length}`);
