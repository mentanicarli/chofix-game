# Chofix

Браузерный симулятор кофейни в университете: вы бариста от первого лица, готовите напитки по рецептам, обслуживаете гостей между парами и растёте в ранге от стажёра до шеф-бариста.

**Играть:** https://mentanicarli.github.io/chofix-game/

## Управление

- Клик по гостю или **Пробел** — принять заказ и перейти к бару.
- В баре кликайте по станциям (кофемолка, темпер, группа, молоко, паровая трубка, сиропы, лёд, витрина, звонок) и следуйте тикету сверху.
- **Пробел** — остановить шот; **Esc** или «К залу» — вернуться; **P** — пауза.

## Музыка

Фоновые треки лежат в `public/music/*.mp3` (до ~15 файлов). Скрипт `scripts/make-music-manifest.mjs` сам запускается перед `npm run dev` и `npm run build` и пишет `public/music/manifest.json` (его в git нет). Название берётся из ID3-тегов, иначе из имени файла вида `Исполнитель - Название.mp3`, иначе это имя файла без расширения. Треки играют по кругу с плавным стыком, музыка стартует после первого нажатия игрока. Пустая папка — игра идёт без музыки, а ползунок и строка «сейчас играет» скрыты.

Чтобы добавить трек: положите mp3 в `public/music/`, перезапустите `npm run dev` (или сделайте `npm run build`). Файлы лежат рядом со страницей, пути относительные, поэтому подпапка `/chofix-game/` на GitHub Pages работает.

**Важно:** кладите только ту музыку, на которую у вас есть права (своя, лицензия, CC с подходящими условиями). Репозиторий и сайт публичные.

## Быстрый старт

Нужны Node.js 20+ и npm.

```bash
npm install
npm run dev        # dev-сервер
npm run build      # релиз: dist/index.html, dist/artifact.html и dist/sfx
```

Игра грузит звуки по относительному пути `sfx/…`, поэтому открывайте `dist/` через любой статический сервер (из файла звука не будет).

## Структура

```
index.html            разметка HUD, экранов, холстов
src/legacy/           ядро игры по частям (склеивается плагином Vite)
src/game/             чистая логика: меню, заказы, экономика, смена, сохранение
src/ui/               книга рецептов, панели станций и еды
src/render/           инсеты станций на Pixi
src/render/world/     мир на Pixi: зал, гости, барист, бар, частицы
src/assets/art/       куски SVG-арта
data/                 меню (chofix_menu.md → menu.json), прогрессия
public/sfx/           звуки; assets/sfx — исходники
scripts/              сборка, проверка legacy, генерация звука
test/                 тесты vitest
e2e/                  Playwright-проверки
docs/                 заметки и промпты
```

## Проверки

```bash
npm run check         # типы + линтер + тесты
npm run lint:legacy   # неопределённые имена в src/legacy
npm run build:debug   # неминифицированная сборка для e2e (в Windows cmd запускайте из bash)
cd e2e && npm install && npx playwright install chromium
node e2e/bar_test2.js dist/artifact.html out latte
BASE=http://localhost:4173/ node e2e/menu_flow.js out/menu   # меню, настройки, пауза, сохранение (после npm run build:debug и vite preview)
```

Подробности — в [CLAUDE.md](CLAUDE.md).

## Деплой

Каждый push в `main` запускает [workflow](.github/workflows/deploy.yml): `npm ci`, проверки, `npm run build`, публикация `dist/` на GitHub Pages. Один раз включите в репозитории Settings → Pages → Source: «GitHub Actions». Повторный деплой — новый push или Actions → «Deploy to GitHub Pages» → Run workflow.
