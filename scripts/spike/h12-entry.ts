// Точка входа для сборки esbuild: отдаёт модуль отрисовки моделей скриптам-макетам (Н1-2). Не входит в сборку игры.
export { specOf, allSpecs, pilotRef, modelRefOf, HOT_MODEL_IDS, compactTopDelta, compactGlassDelta, isColdModel, lodFor } from '../../src/game/drinkModel';
export { drinkSvg, drinkIconSvg, drinkPx, drinkParts, iceCubes, geomOf, BAR_UNIT, drinkArtSvg } from '../../src/render/world/drinkModel';
export { cupPlan, cupUnit, CUP_TOP_PX } from '../../src/render/world/cupPlan';
