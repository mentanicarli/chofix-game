// Читает public/music/*.mp3 и пишет public/music/manifest.json: { tracks: [{ file, artist, title }] }.
// Запускается автоматически перед `npm run dev` и `npm run build`. Нет папки или файлов — список пустой, игра идёт без музыки.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { trackInfo } from './music-meta.mjs';

const dir = process.env.MUSIC_DIR ? resolve(process.env.MUSIC_DIR) : resolve(import.meta.dirname, '../public/music'); // MUSIC_DIR — для проверок на тестовых файлах
mkdirSync(dir, { recursive: true });
const files = readdirSync(dir).filter((f) => /\.mp3$/i.test(f)).sort((a, b) => a.localeCompare(b, 'ru'));
const tracks = files.map((f) => trackInfo(f, readFileSync(resolve(dir, f))));
writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify({ tracks }, null, 2) + '\n');
console.log(`music manifest: ${tracks.length} track(s)`);
tracks.forEach((t) => console.log(`  ${t.artist || '-'} / ${t.title}  (${t.file})`));
