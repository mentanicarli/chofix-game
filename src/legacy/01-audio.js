/* ---------- звук ---------- */
/* ---------- звуки: готовые WAV (кофейные отрендерены офлайн, интерфейсные из SoundWeaver) ---------- */

/* движок: декодирует WAV один раз, играет одиночные и зацикленные звуки с плавной громкостью */
let AC = null, MASTER = null; const BUF = {}, SFX_LOOPS = new Set(); let sfxReady = false, sfxLoading = false;
function audioCtx() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    MASTER = AC.createGain(); MASTER.gain.value = sfxGain(); MASTER.connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
/* Звуки лежат файлами (Opus в WebM, см. scripts/make-audio.py). Байты подтягиваются сразу после загрузки страницы,
   декодируются при первом жесте игрока (AudioContext нельзя создавать раньше). */
const RAW = {}; let sfxFetch = null;
function sfxPrefetch() {
  if (sfxFetch) return sfxFetch;
  if (location.protocol === 'file:') return (sfxFetch = Promise.resolve()); // из файла звуки не загрузить (CORS): нужен http
  sfxFetch = fetch('sfx/manifest.json').then(r => r.json()).then(man => Promise.all(Object.keys(man).map(id =>
    fetch(man[id]).then(r => r.arrayBuffer()).then(ab => { RAW[id] = ab; if (sfxReady) sfxDecode(id); }).catch(() => { /* этого звука не будет */ })
  ))).catch(() => { console.warn('cuppable: звуки недоступны'); });
  return sfxFetch;
}
function sfxDecode(id) {
  const ab = RAW[id]; if (!ab || BUF[id] || !AC) return; delete RAW[id];
  try { const p = AC.decodeAudioData(ab, buf => { BUF[id] = buf; }, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) { /* без звука */ }
}
function sfxLoad() {
  if (sfxReady || sfxLoading) return; sfxLoading = true;
  audioCtx(); sfxReady = true;
  sfxPrefetch().then(() => Object.keys(RAW).forEach(sfxDecode));
  Object.keys(RAW).forEach(sfxDecode);
}
sfxPrefetch();
const sfxGain = () => muted ? 0 : .9 * SET.sfxVol;
function sfxMute() { if (MASTER) MASTER.gain.setTargetAtTime(sfxGain(), AC.currentTime, .03); }
function play(id, vol = 1, rate = 1, delay = 0) {
  if (muted) return null;
  try {
    const ctx = audioCtx(); sfxLoad(); const buf = BUF[id]; if (!buf) return null;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g); g.connect(MASTER); s.start(ctx.currentTime + delay); return s;
  } catch (e) { return null; }
}
/* зацикленный звук: h.set(громкость, скорость), h.stop() */
function loopSnd(id, vol = 0, rate = 1) {
  const h = { id, on: true, v: vol, r: rate, set(v, r) { this.v = v; if (r != null) this.r = r; }, stop() { this.v = 0; this.dead = true; } };
  h.t0 = 0; SFX_LOOPS.add(h);
  try {
    const ctx = audioCtx(); sfxLoad();
    h.g = ctx.createGain(); h.g.gain.value = 0; h.g.connect(MASTER);
    const start = () => { const buf = BUF[id]; if (!buf) { if (!h.dead) setTimeout(start, 120); return; } if (h.dead) return; h.s = ctx.createBufferSource(); h.s.buffer = buf; h.s.loop = true; h.s.connect(h.g); h.s.start(); };
    start();
  } catch (e) { /* без звука */ }
  return h;
}
function tickLoops() {
  if (!AC) return;
  SFX_LOOPS.forEach(h => {
    if (!h.g) return;
    h.g.gain.setTargetAtTime(muted || paused ? 0 : h.v, AC.currentTime, .05);
    if (h.s) h.s.playbackRate.setTargetAtTime(h.r, AC.currentTime, .06);
    if (h.dead && h.v === 0) { setTimeout(() => { try { h.s && h.s.stop(); h.g.disconnect(); } catch (e) { /* ничего */ } }, 400); SFX_LOOPS.delete(h); }
  });
}
function stopAllLoops() { SFX_LOOPS.forEach(h => h.stop()); }
function snd(f, d = .12, type = 'sine', v = .05, delay = 0) {
  if (muted) return;
  try {
    const ctx = audioCtx(), o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay;
    o.type = type; o.frequency.value = f; o.connect(g); g.connect(MASTER);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.start(t); o.stop(t + d + .02);
  } catch (e) { /* звук необязателен */ }
}
const sndCoin = () => { play('ui_coin-collect', .8); };
const sndPerfect = () => { play('ui_success-warm-chime', .8); };
const sndOk = () => play('ui_select-item', .7);
const sndBad = () => { play('ui_error-soft-thud', .8); kick(); };
const sndTap = () => play('ui_tap-light', .7);


/* ---------- внешность гостей: рисует модуль мира ---------- */
const ART = { look: lookFor };

