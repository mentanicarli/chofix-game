/* ---------- масштаб и цикл ---------- */
let stageScale = 1;
const worldRes = () => Math.min(gfxLow() ? 1 : 2, Math.max(1, (devicePixelRatio || 1) * stageScale));
function fit() {
  const s = Math.max(.2, Math.min((innerWidth - 32) / 1280, innerHeight / 720)); stageScale = s;
  WORLD.setResolution(worldRes());
  stage.style.transform = `translate(${(innerWidth - 1280 * s) / 2}px,${(innerHeight - 720 * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fit); { const s0 = Math.max(.2, Math.min((innerWidth - 32) / 1280, innerHeight / 720)); stageScale = s0; stage.style.transform = `translate(${(innerWidth - 1280 * s0) / 2}px,${(innerHeight - 720 * s0) / 2}px) scale(${s0})`; }
let last = performance.now();
function frame(ts) {
  requestAnimationFrame(frame);
  const rawMs = ts - last, dt = Math.min(.1, rawMs / 1000); last = ts;
  if (G && G.phase === 'day' && !paused) tickDay(dt);
  if (!paused) { tickFx(dt); animActors(dt); animBarista(dt); if (G && G.phase === 'day') barTick(dt); }
  ambTick(); tickLoops(); MUSIC.duck(paused ? .35 : 1); stage.classList.toggle('paused', paused);
  tickSky(paused ? 0 : dt); tickMoney(dt); tickTint(dt);
  WORLD.setBar(stage.classList.contains('inbar')); WORLD.render(dt, rawMs);
}
