// npm run content: разбирает docs/content/drinks.md и guide.md и пишет src/game/content/generated.ts.
// npm run content:check: то же, но только сверяет файл с результатом (в check/CI не входит).
// В игру не попадают: блок «Точные цифры» (цифры берутся из recipeCard), «Проверить», «Примечание».
// «Картинка: особая деталь» сохраняется отдельным полем для этапа Н.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const OUT = resolve(root, 'src/game/content/generated.ts');
const read = (p) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');

const join = (lines) => lines.map((l) => l.trim()).filter(Boolean).join(' ');
const list = (lines) => {
  const out = [];
  for (const l of lines) {
    const m = /^\s*\d+\.\s+(.*)$/.exec(l);
    if (m) out.push(m[1].trim());
    else if (l.trim() && out.length) out[out.length - 1] += ' ' + l.trim();
  }
  return out;
};

/** drinks.md → записи по напиткам. */
function parseDrinks(md) {
  const drinks = {};
  const chunks = md.split(/^### /m).slice(1);
  for (const ch of chunks) {
    const lines = ch.split('\n');
    const head = /^(.*) \(`([a-z_]+)`\)\s*$/.exec(lines[0]);
    if (!head) continue;
    const [, name, id] = head;
    const f = {};
    let cur = null;
    let inDetails = false;
    for (const l of lines.slice(1)) {
      if (l.startsWith('<details')) { inDetails = true; continue; }
      if (l.startsWith('</details')) { inDetails = false; continue; }
      if (inDetails) continue;
      if (l.trim() === '---') { cur = null; continue; }
      const b = /^\*\*(.+)\*\*\s*$/.exec(l);
      if (b) { cur = b[1]; f[cur] = []; continue; }
      if (cur) f[cur].push(l);
    }
    const need = (k) => { if (!f[k]) throw new Error(`${id}: нет блока «${k}»`); return f[k]; };
    drinks[id] = {
      name,
      what: join(need('Что это')),
      steps: list(need('Как готовится')),
      ice: f['Если со льдом'] ? list(f['Если со льдом']) : [],
      differs: join(need('Чем отличается')),
      sizes: join(need('Размеры')),
      picture: join(need('Картинка: особая деталь'))
    };
  }
  return drinks;
}

/** guide.md → станции, справочник, экраны «Зачем». */
function parseGuide(md) {
  const stationsLine = /^Названия станций, как в игре: ([^\n]*(?:\n[^\n]+)*?)\.\n\n/m.exec(md);
  if (!stationsLine) throw new Error('guide.md: нет списка станций');
  const stations = stationsLine[1].replace(/\n/g, ' ').split(',').map((s) => s.trim()).filter(Boolean);

  const [, part1, part2] = /## Часть 1[^\n]*\n([\s\S]*?)\n## Часть 2[^\n]*\n([\s\S]*?)\n## Часть 3/.exec(md) ?? [];
  if (!part1 || !part2) throw new Error('guide.md: не нашёл части 1 и 2');

  const glossary = [];
  let group = null;
  let term = null;
  const flush = () => { if (term) { glossary.push({ group, name: term.name, text: join(term.lines), picture: term.picture }); term = null; } };
  for (const l of part1.split('\n')) {
    const g = /^### (.+)$/.exec(l);
    if (g) { flush(); group = g[1].trim(); continue; }
    const t = /^\*\*(.+)\*\*\s*$/.exec(l);
    if (t) { flush(); term = { name: t[1], lines: [], picture: '' }; continue; }
    if (!term || l.trim() === '---') continue;
    const pic = /^Иллюстрация:\s*(.*)$/.exec(l);
    if (pic) term.picture = pic[1].trim();
    else if (l.trim()) term.lines.push(l);
  }
  flush();

  const why = {};
  for (const ch of part2.split(/^### /m).slice(1)) {
    const lines = ch.split('\n');
    const h = /^(why:[a-z-]+) — (.*)$/.exec(lines[0]);
    if (!h) continue;
    const key = h[1];
    let mode = '';
    const o = { when: '', title: '', text: [], picture: '' };
    for (const l of lines.slice(1)) {
      if (l.trim() === '---') break;
      let m;
      if ((m = /^Когда:\s*(.*)$/.exec(l))) { o.when = m[1].trim(); mode = 'when'; }
      else if ((m = /^Заголовок:\s*(.*)$/.exec(l))) { o.title = m[1].trim(); mode = ''; }
      else if (/^Текст:\s*$/.test(l)) mode = 'text';
      else if ((m = /^Иллюстрация:\s*(.*)$/.exec(l))) { o.picture = m[1].trim(); mode = ''; }
      else if (mode === 'text' && l.trim()) o.text.push(l.trim());
    }
    if (!o.title || !o.text.length) throw new Error(`${key}: нет заголовка или текста`);
    why[key] = { title: o.title, text: o.text, picture: o.picture };
  }
  return { stations, glossary, why };
}

const drinks = parseDrinks(read('docs/content/drinks.md'));
const guide = parseGuide(read('docs/content/guide.md'));

const body = `// Сгенерировано скриптом scripts/make-content.mjs из docs/content/drinks.md и guide.md. Руками не править.
// Править тексты нужно в docs/content/*.md, затем npm run content.

export interface DrinkText {
  name: string;
  /** «Что это» */
  what: string;
  /** человеческие шаги без цифр */
  steps: readonly string[];
  /** «Если со льдом»: чем холодный вариант отличается (пусто, если нет холодной механики) */
  ice: readonly string[];
  /** «Чем отличается» */
  differs: string;
  /** «Размеры» */
  sizes: string;
  /** подсказка для картинки напитка (этап Н), в игре не показывается */
  picture: string;
}
export interface GlossaryTerm {
  group: string;
  name: string;
  text: string;
  picture: string;
}
export interface WhyText {
  title: string;
  text: readonly string[];
  picture: string;
}

export const STATION_NAMES: readonly string[] = ${JSON.stringify(guide.stations)};

export const DRINK_TEXTS: Readonly<Record<string, DrinkText>> = ${JSON.stringify(drinks, null, 1)};

export const GLOSSARY: readonly GlossaryTerm[] = ${JSON.stringify(guide.glossary, null, 1)};

export const WHY_TEXTS: Readonly<Record<string, WhyText>> = ${JSON.stringify(guide.why, null, 1)};
`;

if (process.argv.includes('--check')) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (cur !== body) {
    console.error('src/game/content/generated.ts не совпадает с docs/content/*.md: запустите npm run content');
    process.exit(1);
  }
  console.log('content: актуально,', Object.keys(drinks).length, 'напитков,', guide.glossary.length, 'терминов,', Object.keys(guide.why).length, 'экранов «Зачем»');
} else {
  mkdirSync(resolve(root, 'src/game/content'), { recursive: true });
  writeFileSync(OUT, body);
  console.log('content:', Object.keys(drinks).length, 'напитков,', guide.glossary.length, 'терминов,', Object.keys(guide.why).length, 'экранов «Зачем» →', OUT);
}
