/* ---------- симуляция ---------- */
const STEAM = MENUAPI.STEAM; /* числа пара живут в src/game/lessons.ts: по ним же пишутся подсказки */
/* Эспрессо копится в чашке (у рафа в питчере): esPrev — уже сделанные шоты */
function setEs(v) { if (BR.rc.pitcherShot) BR.pit.es = v; else BR.cup.es = v; }
function grindRate() { return 3.4 + .5 * Math.sin(performance.now() / 90); }
function shotRate() {
  const B = BR, ideal = G.idealGrind || 3, set = G.grindSet || 3;
  const f = Math.pow(1.45, set - ideal) * (1 - ((B.res.tamp == null ? 0 : (B.tampP - 15)) * .02)) * (1 - (B.dose - B.tgtDose) * .04) * (G.machine ? 1 : (.97 + .06 * Math.sin(performance.now() / 700)));
  return 3.857 * f * (B.tgtMl / 30);
}
function stopShot() {
  const B = BR, s = B.shot; if (s.st !== 'run') return;
  s.st = 'done'; setEs(B.esPrev + s.ml);
  const ml = s.ml, t = s.t, tgt = B.tgtMl, K = 30 / 36;
  const ts = t >= 24 && t <= 33 ? 1 : 1 - (t < 24 ? 24 - t : t - 33) / 12;
  const ys = Math.abs(ml - tgt) <= 2 * K ? 1 : 1 - (Math.abs(ml - tgt) - 2 * K) / (14 * K);
  const sc = clamp(.6 * ts + .4 * ys, 0, 1);
  let msg = (B.shots > 1 ? 'Шот ' + B.shotIdx + '/' + B.shots + ' ' : 'Шот ') + Math.round(ml) + ' мл за ' + Math.round(t) + ' с';
  if (t < 22) msg += ': слишком быстро, кисло. Помол мельче';
  else if (t > 35) msg += ': слишком долго, горько. Помол крупнее';
  else if (Math.abs(ml - tgt) > 4 * K) msg += ml < tgt ? ': маловато' : ': слишком много';
  else msg += ': отлично';
  B.shotNote = { t, ml };
  play('lock', .5, .8);
  complete('shot', sc, msg, sc < .5);
}
function tampRelease() {
  const B = BR, P = B.tampP; B.hold = false;
  if (P < 4) { B.tampP = 0; barMsg('Нажмите сильнее и держите', true); return; }
  const zw = G.tamper ? 5 : 3.5;
  const sc = clamp((1 - Math.max(0, Math.abs(P - 15) - zw * .4) / 10) * (.6 + .4 * (1 - B.uneven)), 0, 1);
  play('tamp', .9);
  complete('tamp', sc, 'Темпер ' + Math.round(P) + ' кг' + (P < 12 ? ': слабовато' : P > 18 ? ': слишком сильно' : ': в зоне'), sc < .5);
  B.pf = 'mat';
}
function fillDone() {
  const B = BR, k = B.fillKind;
  const target = k === 'water' ? B.rc.water : k === 'ice' ? B.rc.ice : B.rc.milk;
  const st = MENUAPI.fillStation.init({ kind: k, target }); st.ml = k === 'water' ? B.cup.water : k === 'ice' ? B.cup.ice : B.pit.ml;
  runStep(MENUAPI.fillStation.finish(st), k);
}
function steamDone() {
  const B = BR, p = B.pit; if (p.T < 30) { barMsg('Молоко ещё холодное: подержите пар', true); return; }
  const tgtF = B.rc.foam, fs = clamp(1 - Math.abs(p.foam - tgtF) / .35, 0, 1);
  const [lo, hi] = MENUAPI.steamZoneOf(B.c.order.id, !!G.thermo);
  const ts = p.burnt ? 0 : clamp(1 - (p.T < lo ? lo - p.T : p.T > hi ? p.T - hi : 0) / 12, 0, 1);
  const silk = clamp(1 - p.coarse, 0, 1);
  const sc = .35 * fs + .4 * ts + .25 * silk;
  p.steamed = true; p.score = sc;
  barMsg(p.burnt ? 'Молоко пригорело' : ts < .5 ? (p.T < lo ? 'Холодновато: ' + Math.round(p.T) + '°' : 'Горячо: ' + Math.round(p.T) + '°') : fs < .5 ? (p.foam < tgtF ? 'Мало пены' : 'Слишком много пены') : silk < .6 ? 'Пена с пузырями' : 'Шёлковое молоко', sc < .5);
  complete('steam', sc);
}
function guideFor(kind) {
  const pts = [], N = 70, X = 220, Y = 205;
  for (let k = 0; k <= N; k++) {
    if (kind === 'heart') { const t = Math.PI + k / N * Math.PI * 2, s = 4.6; pts.push({ x: X + 16 * Math.pow(Math.sin(t), 3) * s, y: Y - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s * .95 + 8 }); }
    else { const u = k / N; pts.push({ x: X + 36 * Math.sin(u * Math.PI * 5) * (1 - u * .4), y: Y + 100 - 200 * u }); }
  }
  return pts;
}
function pourDown(p) { if (!BR.guide) { BR.guide = guideFor(BR.c.art); BR.cov = []; } BR.started = true; BR.pourMax = Math.min(1, BR.pit.ml / BR.rc.milk); pourMove(p); }
function pourMove(p) {
  const B = BR; if (!B.guide) return;
  const inCup = Math.hypot(p.x - 220, p.y - 205) < 130; if (!inCup) return;
  let near = 99;
  B.guide.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < near) near = d; if (d < 15) B.cov[i] = true; });
  B.dev += Math.min(near, 40); B.devN++;
  const last = B.blobs[B.blobs.length - 1];
  if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 3) B.blobs.push({ x: p.x, y: p.y, r: 9 + 4 * (B.pourFlow || .5), a: B.artA });
}
function pourDone() {
  const B = BR; if (!B.started) { barMsg('Начните заливку: зажмите мышь над чашкой', true); return; }
  const n = B.guide ? B.cov.filter(Boolean).length / B.guide.length : 0, avg = B.devN ? B.dev / B.devN : 40;
  let art = clamp(n * (1 - Math.min(.5, avg / 70)) * 1.2, 0, 1);
  const maxL = B.pourMax, lv = B.pourLevel, ls = clamp(1 - Math.max(0, maxL - lv) * 3, 0, 1);
  const sc = clamp(.55 * art + .45 * ls, 0, 1) * (.65 + .35 * (B.pit.score == null ? .7 : B.pit.score));
  B.cup.level = lv; B.cup.art = B.c.art; B.artQ = art; B.pit.ml = 0;
  complete('pour', sc, art > .75 ? 'Красивый рисунок!' : art > .45 ? 'Рисунок узнаётся' : 'Получились каракули', sc < .5);
}

function barSim(dt) {
  const B = BR; if (!B) return;
  const inbar = stage.classList.contains('inbar');
  if (B.food) MENUAPI.foodStation.update(B.food, dt, B.inset === 'food' && !!B.hold);
  const xl = xUpdate(B, dt) ? B.inset : '';
  /* помол */
  let grinding = false;
  if (B.inset === 'grind' && B.hold && !B.done.grind) { grinding = true; B.dose = Math.min(40, B.dose + grindRate() * dt); }
  /* темпер */
  if (B.inset === 'tamp' && B.tampPhase === 'press' && B.hold) B.tampP = Math.min(32, B.tampP + (B.tampP < 8 ? 14 : 18) * dt);
  /* вода/молоко */
  let filling = false;
  if (B.inset === 'water' || B.inset === 'milk' || B.inset === 'ice') {
    if (B.hold) { filling = true; const fk = B.fillKind, tg = (fk === 'water' ? B.rc.water : fk === 'ice' ? B.rc.ice : B.rc.milk) || 0; B.fill = Math.min(MENUAPI.fillCap(fk, tg), B.fill + MENUAPI.fillRate(fk, tg) * dt); }
    if (B.fillKind === 'water') B.cup.water = B.fill; else if (B.fillKind === 'ice') B.cup.ice = B.fill; else { B.pit.ml = B.fill; if (/^iced/.test(B.drink) || B.rc.cupMilk) B.cup.milk = B.fill; }
  }
  /* шот */
  let shotRun = false;
  if (B.shot.st === 'run') {
    shotRun = true; const s = B.shot; s.t += dt * TS; s.ml += shotRate() * dt; setEs(B.esPrev + s.ml);
    if (s.ml >= 52) { stopShot(); barMsg('Перелив! Шот нужно было остановить раньше', true); }
  }
  /* пар */
  let steamMode = 0;
  if (B.inset === 'steam' && B.hold && !B.pit.steamed) {
    const p = B.pit, vol = ((p.ml + p.es) * (1 + .6 * p.foam)) / B.pitCap, surf = 330 - vol * 220, depth = B.my - surf;
    p.T += STEAM.heatPerSec * dt; B.steamT += dt;
    if (depth < 0) { p.coarse = Math.min(1, p.coarse + .45 * dt); steamMode = 3; p.T -= 3 * dt; }
    else if (depth <= 16) { steamMode = 1; if (p.T < STEAM.airUntil) p.foam = Math.min(1, p.foam + STEAM.foamPerSec * dt); else p.coarse = Math.min(1, p.coarse + .18 * dt); }
    else { steamMode = 2; p.coarse = Math.max(0, p.coarse - .22 * dt); }
    if (p.T >= STEAM.burnAt) { p.burnt = true; steamDone(); }
  }
  /* заливка */
  let pouring = false;
  if (B.inset === 'pour' && B.hold && B.guide) {
    const p = B.pit, tgt = B.rc.milk, maxL = clamp(p.ml / tgt, 0, 1.1); B.pourMax = Math.min(1, maxL);
    B.artA = clamp(.3 + p.foam * 1.1, .3, 1) * (1 - p.coarse * .5);
    if (Math.hypot(B.mx - 220, B.my - 205) < 130) {
      pouring = true; B.pourFlow = .5;
      B.pourLevel = Math.min(B.pourMax, B.pourLevel + .15 * dt);
      B.cup.level = B.pourLevel; B.cup.milk = B.pourLevel * tgt; B.cup.foam = p.foam;
      if (B.pourLevel >= B.pourMax - .001) pourDone();
    }
  }
  /* порта-фильтр */
  const tp = B.pf === 'grinder' ? { x: 160, y: 440 } : B.pf === 'mat' ? { x: 330, y: 470 } : { x: 630, y: 350 };
  B.pf0.x = lerp(B.pf0.x, tp.x, 1 - Math.exp(-dt * 9)); B.pf0.y = lerp(B.pf0.y, tp.y, 1 - Math.exp(-dt * 9));
  /* звук */
  const amb = inbar;
  loopSet('grind', grinding ? .55 : (xl === 'blend' || xl === 'shake') ? .5 : 0, xl === 'shake' ? 1.5 : 1);
  loopSet('shot', shotRun ? .5 : 0, 1);
  loopSet('water', (filling && B.fillKind === 'water') || xl === 'juice' || xl === 'tonic' || xl === 'layer' ? .5 : 0, 1);
  loopSet('sweep', (xl === 'powder' || xl === 'boba' || xl === 'topping') ? .5 : 0, 1.2);
  loopSet('pour', (filling && B.fillKind === 'milk') ? .55 : pouring ? .45 : 0, pouring ? .85 : 1);
  loopSet('steam', steamMode === 2 ? .5 : 0, 1);
  loopSet('steam_air', steamMode === 1 ? .55 : (xl === 'whisk' || xl === 'foam' || xl === 'whip') ? .4 : 0, 1 + (B.pit.T - 8) / 140);
  loopSet('steam_bad', steamMode === 3 ? .45 : 0, 1);
}
function loopSet(id, v, r) {
  let h = LP[id];
  if (!h) { if (v <= 0) return; h = LP[id] = loopSnd(id, 0, r); }
  h.set(v, r);
}

