import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Пока игра переезжает на модули, «старое ядро» лежит кусками в src/legacy/NN-*.js.
// Куски склеиваются в один модуль в порядке номеров — область видимости та же, что была в одном IIFE.
const LEGACY = resolve(import.meta.dirname, 'src/legacy');
function legacyPlugin() {
  const id = 'virtual:legacy';
  return {
    name: 'cuppable-legacy',
    resolveId: s => (s === id ? '\0' + id : null),
    load(rid) {
      if (rid !== '\0' + id) return null;
      const files = readdirSync(LEGACY).filter(f => f.endsWith('.js')).sort();
      files.forEach(f => this.addWatchFile(resolve(LEGACY, f)));
      // Как и раньше, всё внутри одной функции: так повторные function-объявления (старый и новый drawGrind и т.п.) разрешены, побеждает последнее.
      const head = `import * as MENUAPI from '/src/game/api';\nimport { bookHTML } from '/src/ui/book';\nimport { InsetRenderer } from '/src/render/inset';\nimport { foodPanelHTML, heatPct } from '/src/ui/foodPanel';\nimport { World, lookFor } from '/src/render/world/world';\nimport { MusicPlayer, trackLabel } from '/src/ui/music';
import { sandboxScreenHTML, devPanelHTML } from '/src/ui/sandbox';
import { titleHTML, paceScreenHTML, howtoHTML, settingsHTML, confirmHTML, pauseHTML } from '/src/ui/menus';
import { panelHTML, panelUpdate, readoutFill, readoutTime, readoutBrew } from '/src/ui/stationPanel';\n${process.env.CUPPABLE_DEBUG ? 'window.__MENUAPI = MENUAPI;\n' : ''}(() => {\n'use strict';\n`;
      return head + files.map(f => `/* ===== ${f} ===== */\n` + readFileSync(resolve(LEGACY, f), 'utf8')).join('\n') + `\n})();\n`;
    }
  };
}
export default defineConfig({
  base: './',
  plugins: [legacyPlugin(), viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 4000, minify: process.env.CUPPABLE_DEBUG ? false : 'esbuild' }
});
