// Точка входа для сборки esbuild: отдаёт модуль отрисовки моделей скриптам-макетам (Н1-2). Не входит в сборку игры.
export { specOf, allSpecs, pilotRef, HOT_MODEL_IDS } from '../../src/game/drinkModel';
export { drinkSvg, drinkIconSvg, drinkPx, drinkParts, iceCubes, geomOf, BAR_UNIT } from '../../src/render/world/drinkModel';
