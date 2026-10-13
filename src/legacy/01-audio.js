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
  ))).catch(() => { console.warn('chofix: звуки недоступны'); });
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
const ICON = {
  latte: `<path d="M-13 -8H13L10 12Q0 17 -10 12Z" fill="#FFF8EC"/><ellipse cx="0" cy="-8" rx="13" ry="3.6" fill="#C99B6E"/><path d="M-6 -8q6 -4 12 0" fill="none" stroke="#FFF8EC" stroke-width="2"/><path d="M13 -4Q21 -4 20 3Q19 8 11 7" fill="none"/>`,
  espresso: `<path d="M-11 -6H11L8 12Q0 16 -8 12Z" fill="#FFF8EC"/><ellipse cx="0" cy="-6" rx="11" ry="3" fill="#5A3A2A"/><path d="M11 -2Q19 -2 18 5Q17 10 9 9" fill="none"/>`,
  americano: `<path d="M-10 -12H10L8 12Q0 16 -8 12Z" fill="#FFF8EC"/><ellipse cx="0" cy="-12" rx="10" ry="3" fill="#8A5B3A"/><path d="M-8 2q4 -3 8 0t8 0" fill="none" stroke-width="2"/>`,
  icedamericano: `<path d="M-10 -14H10L8 12Q0 16 -8 12Z" fill="#E8F3F4"/><ellipse cx="0" cy="-14" rx="10" ry="3" fill="#8A5B3A"/><rect x="-6" y="-9" width="6" height="6" rx="1.5" fill="#FFFFFF" fill-opacity=".85" transform="rotate(-12 -3 -6)"/><rect x="1" y="-4" width="6" height="6" rx="1.5" fill="#FFFFFF" fill-opacity=".85" transform="rotate(10 4 -1)"/>`,
  cappuccino: `<path d="M-13 -6H13L9 12Q0 16 -9 12Z" fill="#FFF8EC"/><ellipse cx="0" cy="-6" rx="13" ry="3.5" fill="#F1DFC2"/><circle cx="0" cy="-6" r="2.4" fill="#B07A4F" stroke="none"/><path d="M13 -2Q21 -2 20 5Q19 10 10 9" fill="none"/>`
};
const iconOf = key => { if (ICON[key]) return ICON[key]; const d = MENUAPI.drinkById[key]; const top = MENUAPI.topColorOf(key), cold = d && (d.temp === 'cold' || ['shake', 'boba', 'bumble', 'tonic', 'aero', 'protein'].includes(d.family));
  if (cold) return `<path d="M-10 -14H10L8 12Q0 16 -8 12Z" fill="#E8F3F4"/><rect x="-8.5" y="-6" width="17" height="17" fill="${top}" stroke="none"/><path d="M-10 -14H10L8 12Q0 16 -8 12Z" fill="none"/><ellipse cx="0" cy="-14" rx="10" ry="3" fill="${top}"/><path d="M5 -22L8 -8" stroke="#C4694A" stroke-width="3"/>`;
  return `<path d="M-13 -8H13L10 12Q0 17 -10 12Z" fill="#FFF8EC"/><ellipse cx="0" cy="-8" rx="13" ry="3.6" fill="${top}"/><path d="M13 -4Q21 -4 20 3Q19 8 11 7" fill="none"/>`; };
