// Сборка арта из исходников art-src/**/*.svg (стайлгайд, разд. 10; этапы 12.3(0), 12.3(1)).
// Запуск: npm run art (записать) / npm run art:check (только сравнить, код возврата 1 при расхождении).
// Результат коммитится: check, build и CI этот скрипт не запускают.
// Корневой <svg viewBox="x y w h" data-scale="масштаб предмета на экране (1 или GUEST_K = 1,6)"> и ОДИН из атрибутов назначения:
//   data-out="имя.svgf"        → src/assets/art/имя.svgf (куски зала; рамка берётся в world.ts);
//   data-part="id"             → часть бара в src/assets/art/bar-parts.json (svg, box из viewBox, texts из <text>); остальные части не трогаются;
//     data-after="id"          → для НОВОЙ части: после какой существующей её вставить.
// Внутри только фигуры; {{ИМЯ}} — цвет из palette.json; {{L}} {{M}} {{D}} — толщина контура 3,5 / 3 / 2 экранных px, делённая на data-scale.
// <text x y font-size font-weight fill font-family>…</text> превращаются в записи texts части бара (рисует Pixi Text) и из SVG удаляются.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'art-src');
const OUT = join(ROOT, 'src/assets/art');
const PARTS = join(OUT, 'bar-parts.json');
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
const barParts = [];
for (const f of files.sort()) {
  const s = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const head = /<svg\b([^>]*)>/.exec(s);
  if (!head) { fail(f, 'нет корневого <svg>'); continue; }
  const attr = (n) => new RegExp(`${n}="([^"]*)"`).exec(head[1])?.[1];
  const out = attr('data-out'), part = attr('data-part'), vb = attr('viewBox'), scale = Number(attr('data-scale') ?? '1');
  if ((!out && !part) || (out && part) || !vb || !(scale > 0)) { fail(f, 'нужны viewBox, data-scale > 0 и ровно один из data-out / data-part'); continue; }
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
  if (out) {
    const target = join(OUT, out);
    const text = inner + '\n';
    if (check) {
      if (!existsSync(target) || readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== text) fail(f, `${out} устарел: запустите npm run art`);
    } else {
      writeFileSync(target, text);
      console.log(`${relative(ROOT, f)} → src/assets/art/${out} (${text.length} Б)`);
    }
  } else {
    const [x, y, bw, bh] = vb.split(/\s+/).map(Number);
    const texts = [];
    const svg = inner.replace(/<text\b([^>]*)>([^<]*)<\/text>/g, (m, a, t) => {
      const g = (n, d) => new RegExp(`${n}="([^"]*)"`).exec(a)?.[1] ?? d;
      texts.push({ t, x: Number(g('x', 0)), y: Number(g('y', 0)), size: Number(g('font-size', 12)), weight: g('font-weight', '800'), fill: g('fill', pal.colors.INK), family: g('font-family', 'Nunito'), tl: null });
      return '';
    });
    barParts.push({ id: part, after: attr('data-after'), svg, box: { x, y, w: bw, h: bh }, texts, file: f });
  }
}

if (barParts.length) {
  const cur = JSON.parse(readFileSync(PARTS, 'utf8'));
  let next = { ...cur };
  for (const p of barParts) {
    const entry = { svg: p.svg, box: p.box, texts: p.texts };
    if (p.id in next) next[p.id] = entry;
    else if (p.after && p.after in next) {
      const o = {};
      for (const k of Object.keys(next)) { o[k] = next[k]; if (k === p.after) o[p.id] = entry; }
      next = o;
    } else { fail(p.file, `часть ${p.id} новая: укажите data-after существующей части`); }
  }
  const text = JSON.stringify(next);
  if (!bad) {
    if (check) {
      if (readFileSync(PARTS, 'utf8').trim() !== text) fail(PARTS, 'bar-parts.json устарел: запустите npm run art');
    } else {
      writeFileSync(PARTS, text);
      console.log(`частей бара собрано: ${barParts.map((p) => p.id).join(', ')} → src/assets/art/bar-parts.json`);
    }
  }
}
if (bad) process.exit(1);
console.log(check ? 'art-src и src/assets/art совпадают' : `собрано файлов: ${files.length}`);
