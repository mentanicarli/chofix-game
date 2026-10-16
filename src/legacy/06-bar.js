/* ---------- бар от первого лица ---------- */
const TS = 3; /* 1 реальная секунда = 3 секунды шота */
/* Цели бара считаются по заказу (ключ, размер, холодный): шоты, объёмы, зона пара, масштаб чашки — src/game/volumes.ts */
const rcFor = c => MENUAPI.legacyRecipe(c.drink, c.order && c.order.size, !!(c.order && c.order.cold));
/* вместимость питчера, мл: молоко (у рафа с эспрессо) после вспенивания и запас сверху; у мелких напитков прежние 330 */
const pitCapOf = rc => rc.milk && !rc.cupMilk ? Math.max(330, Math.ceil((rc.milk + (rc.pitcherShot ? rc.shots * 30 : 0)) * (1 + (rc.foam || 0) / 1.1) * 1.18 / 10) * 10) : 330;
const MILKY = new Set(['cappuccino', 'latte', 'flatwhite', 'raf', 'vanillaraf', 'rafhalva']);
const TASK_NAME = MENUAPI.TASK_NAME;
const SYR = Object.fromEntries(MENUAPI.SYRUPS.filter(s => MENUAPI.SYRUP_META[s.name]).map(s => { const m = MENUAPI.SYRUP_META[s.name]; return [m.key, { name: s.name, short: m.short, col: m.col, z: 'syrup', rank: s.rank, recipe: MENUAPI.RECIPE_SYRUPS.has(s.name) }]; }));
const ZONE_POS = { grind: [160, 330], tamp: [330, 496], shot: [630, 380], water: [500, 336], ice: [680, 676], food: [405, 676], micro: [932, 676], milk: [1160, 380], steam: [836, 420], pour: [630, 430], bell: [1032, 500], syrup: [968, 250], syr1: [902, 250], syr2: [968, 250], syr3: [1034, 250], tea: [75, 590], matcha: [175, 590], powders: [275, 590], juice: [858, 590], whipper: [972, 590], foamer: [1086, 590], blender: [1200, 590], boba: [75, 668], shaker: [175, 668] };
const WEIGHT = MENUAPI.WEIGHT;
const bi = $('#bi'), bx = bi.getContext('2d'); bx.scale(2, 2);
const IW = 440, IH = 450;
let BR = null, HIT = [], coachKey = '', tkKey = '', barT = 0, tkOpen = false;
const LP = {};
const f1 = v => v.toFixed(1).replace('.', ',');
const lerp = (a, b, u) => a + (b - a) * u;
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const mixC = (a, b, u) => { const x = hexRGB(a), y = hexRGB(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * u)).join(',') + ')'; };
const UI = { tk: $('#bTk'), coach: $('#bCoach'), close: $('#bClose'), flt: $('#bFloat') };

/* ---------- начало и конец заказа ---------- */
function blockMsg(t) {
  const d = BR.done, c = BR.c;
  if (MENUAPI.isMenuKey(BR.drink)) {
    if (t === 'food') return '';
    const i = BR.tasks.indexOf(t);
    for (let j = 0; j < i; j++) { const p = BR.tasks[j]; if (p !== 'food' && !d[p]) return 'Сначала: ' + TASK_NAME[p].toLowerCase(); }
    return '';
  }
  const raf = BR.rc.pitcherShot;
  if (t === 'tamp' && !d.grind) return 'Сначала помол';
  if (t === 'shot' && !d.tamp) return 'Сначала помол и темпер';
  if (t === 'ice' && !d.shot) return 'Сначала нужен шот';
  if (t === 'water' && !d.shot) return 'Сначала нужен шот';
  if ((t === 'water' || t === 'milk') && BR.tasks.indexOf('ice') >= 0 && !d.ice) return 'Сначала лёд в чашку';
  if (raf && t === 'milk' && !d.shot) return 'Сначала эспрессо в питчер';
  if (raf && t === 'syrup' && !d.milk) return 'Сначала сливки: сироп идёт в питчер';
  if (t === 'steam' && !d.milk) return raf ? 'Сначала налейте сливки в питчер' : 'Сначала налейте молоко в питчер';
  if (raf && t === 'steam' && c.syrup && !d.syrup) return 'Сначала сироп: он идёт в питчер';
  if (t === 'pour' && !d.steam) return 'Сначала вспеньте ' + (raf ? 'сливки' : 'молоко');
  if (t === 'pour' && !d.shot) return 'Сначала нужен шот';
  if (!raf && (t === 'pour' || t === 'water') && c.syrup && !d.syrup) return 'Сначала сироп: он идёт на дно чашки';
  return '';
}
function barOpen(c) {
  if (!G || G.phase !== 'day' || paused || c.leaving) return;
  if (BR) { if (BR.c === c) barShow(true); else hint('Сначала закончите текущий напиток'); return; }
  if (notFirst(c)) return;
  const rc = rcFor(c);
  /* перед приготовлением: сначала «Зачем это нужно» (по одному), потом карточка нового напитка; после каждого окна заказ открывается заново */
  const intro = c.order && !tutOffNow() ? MENUAPI.orderIntro(c.order.id, G.tutorialSeen, { shots: rc.shots || 1, foam: rc.foam, size: c.order.size, cold: !!c.order.cold }) : [];
  if (intro.length) {
    const again = () => { if (G && G.phase === 'day' && !paused && !c.leaving && D.customers.includes(c)) barOpen(c); };
    const it = intro[0]; if (it.kind === 'why') showWhy(it.key, again); else showDrinkCard(it.card, again, c.order); return;
  }
  const d = c.drink, exp = MENUAPI.buildTasks(d, { cold: !!(c.order && c.order.cold), syrup: !!c.syrup, shots: rc.shots });
  if (c.order && c.order.food) exp.push('food');
  const tasks = MENUAPI.uniqueTasks(exp);
  const cost = drinkCost(d, c.order) + (c.order && c.order.food ? Math.round(c.order.food.price * MENUAPI.FOOD_COST_SHARE) : 0); spend(cost); updateHud(true);
  if (SBX.on) { c.tPrep = SBX.clock; c.nTasks = tasks.length; }
  /* шоты: tgtDose в условных единицах весов (2 на грамм: 18 = 9 г), цель шота 30 мл; крепкий: 10 г и 25 мл. Шоты идут циклами «помол, темпер, шот», shotIdx — номер текущего. */
  tkOpen = false; BR = { c, paid: cost, drink: d, rc, exp, tasks, done: {}, res: {}, shots: rc.shots || 1, shotIdx: 1, cyc: [], esPrev: 0, pitCap: pitCapOf(rc), tgtDose: c.strong ? 20 : 18, tgtMl: c.strong ? 25 : 30, dose: 0, uneven: 1, tampPhase: 'level', tampP: 0, tampHold: 0, sweep: 0,
    pf: 'grinder', shot: { st: 'idle', t: 0, ml: 0, locked: false }, cup: { es: 0, water: 0, ice: 0, milk: 0, foam: 0, pumps: 0, syr: null, art: null, level: 0 },
    pit: { ml: 0, es: 0, T: 8, foam: 0, coarse: .2, steamed: false, burnt: false }, fill: 0, pumps: 0, pumpT: 0, inset: null, hold: false, mx: 220, my: 200,
    food: null, foodChoices: [], foodPicked: null, xs: {}, xv: {},
    blobs: [], cov: [], dev: 0, devN: 0, started: false, ready: false, pf0: { x: 160, y: 440 }, art: null, pourLevel: 0, spill: 0, fillKind: null, steamT: 0, notes: [] };
  if (c.order && c.order.food) { const fs = { rank: G.rank, eq: { case_snacks: !!G.eq_case_snacks, case_pastry: !!G.eq_case_pastry, case_dessert: !!G.eq_case_dessert, fridge_deli: !!G.eq_fridge_deli, microwave: !!G.eq_microwave } }; BR.foodChoices = MENUAPI.foodChoices(fs, c.order.food.id, Math.random); const names = {}; BR.foodChoices.forEach(x => { names[x.id] = x.name; }); BR.food = MENUAPI.foodStation.init({ targetId: c.order.food.id, names, heat: c.order.food.heat }); }
  c.hopT = .38; xKey = ''; fpKey = '';
  barShow(true); play('clink', .6);
  barMsg('Заказ принят: ' + NAME[d].toLowerCase());
}
/* Карточка «Новый напиток»: рецепт по шагам, пока гость ждёт (его терпение на это время стоит) */
const dcEl = $('#drinkCard'); let CARDON = null;
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function markSeen(key) { if (!G.tutorialSeen.includes(key)) G.tutorialSeen.push(key); }
/* Общее окно поверх бара: карточка напитка и «Зачем это нужно». Пока открыто (CARDON), таймер дня, терпение гостей и симуляция бара стоят. Цифры в карточке только по кнопке «Точные цифры». */
function openModal(html, next) {
  CARDON = { next }; dcEl.innerHTML = html; dcEl.hidden = false; sndTap();
  const b = dcEl.querySelector('[data-cardok]'); if (b) b.focus({ preventScroll: true });
}
const dcList = xs => `<ol>${xs.map(s => `<li>${escH(s)}</li>`).join('')}</ol>`;
function showDrinkCard(card, next, order) {
  markSeen(card.key);
  /* модель напитка полного уровня, крупнее, чем в книге (только пилот Н1-2) */
  const ref = order && MENUAPI.pilotRef(order.id, order.size, !!order.cold), art = ref && WORLD.drinkArt(ref, 1.4);
  openModal(`<div class="dcard" role="dialog" aria-label="Новый напиток"><span class="tutTag">Новый напиток</span><h3>${escH(card.name)}</h3>${art ? `<div class="dcModel" aria-hidden="true">${art}</div>${MENUAPI.MODEL_TAGS[order.id] ? `<p class="mdlTag">${escH(MENUAPI.MODEL_TAGS[order.id])}</p>` : ''}` : ''}<div class="imgSlot dcImg" hidden></div>${card.what ? `<p class="dcWhat">${escH(card.what)}</p>` : ''}${dcList(card.steps)}${card.ice.length ? `<h4>Если со льдом</h4>${dcList(card.ice)}` : ''}${card.differs ? `<p class="tip"><b>Чем отличается.</b> ${escH(card.differs)}</p>` : ''}<button type="button" class="dcExactBtn" data-dcexact="1" aria-expanded="false">Точные цифры</button><div class="dcExact" hidden><ul>${card.exact.map(s => `<li>${escH(s)}</li>`).join('')}</ul></div><button type="button" class="big" data-cardok="1">Понятно</button></div>`, next);
}
/* «Зачем это нужно»: один раз при первом упоминании станции или механики (ключи why:* в tutorialSeen) */
function showWhy(key, next) {
  const w = MENUAPI.WHY_TEXTS[key]; markSeen(key);
  if (!w) { if (next) next(); return; }
  openModal(`<div class="dcard why" role="dialog" aria-label="Зачем это нужно"><span class="tutTag">Зачем это нужно</span><h3>${escH(w.title)}</h3><div class="imgSlot dcImg" hidden></div><p class="dcWhat">${escH(w.text.join(' '))}</p><button type="button" class="big" data-cardok="1">Понятно</button></div>`, next);
}
function closeDrinkCard() {
  if (!CARDON) return; const f = CARDON.next; CARDON = null; dcEl.hidden = true; dcEl.innerHTML = ''; sndTap(); if (f) f();
}
dcEl.addEventListener('click', e => {
  if (e.target.closest('[data-cardok]')) closeDrinkCard();
  const x = e.target.closest('[data-dcexact]');
  if (x) { const box = dcEl.querySelector('.dcExact'); box.hidden = !box.hidden; x.setAttribute('aria-expanded', String(!box.hidden)); x.classList.toggle('on', !box.hidden); sndTap(); }
});
function barShow(on) {
  stage.classList.toggle('inbar', on);
  if (on) { zonesSync(); UI.close.hidden = !BR || !BR.inset; coachKey = ''; tkKey = ''; }
  frontHintUpd();
}
function frontHintUpd() {
  const h = $('#frontHint'); if (!h) return;
  const show = G && G.phase === 'day' && !stage.classList.contains('inbar') && !paused;
  h.hidden = !show;
  h.textContent = BR ? 'Заказ готовится: Пробел, чтобы вернуться к бару' : (D && D.cup ? 'Нажмите на клиента, чтобы подать' : 'Нажмите на клиента или Пробел, чтобы принять заказ');
}
function barAbort(msg) {
  if (!BR) return;
  closeInset(); BR = null; stage.classList.remove('inbar'); stopLoops(); frontHintUpd();
  if (msg) toast(msg);
}
function stopLoops() { Object.keys(LP).forEach(k => { LP[k].stop(); delete LP[k]; }); }
function barMsg(txt, bad) {
  const d = document.createElement('div'); d.className = 'bmsg' + (bad ? ' bad' : ''); d.textContent = txt; const life = Math.max(4200, txt.length / 15 * 1000); d.style.animationDuration = life + 'ms'; UI.flt.appendChild(d);
  while (UI.flt.children.length > 2) UI.flt.firstChild.remove();
  setTimeout(() => d.remove(), life);
}
function complete(t, score, msg, bad) {
  BR.done[t] = true; BR.res[t] = clamp(score, 0, 1);
  const o = BR.c.order, last = BR.shotIdx >= BR.shots;
  /* «Несколько шотов» засчитывается, когда сделан последний шот, а не первый помол */
  const ks = MENUAPI.tutorialKeys(t, o.id, o.food, BR.shots).filter(k => k !== 'step:shots');
  if (t === 'shot' && last && BR.shots > 1) ks.push('step:shots');
  ks.forEach(markSeen);
  if (msg) barMsg(msg, bad);
  (score > .8 ? play('ui_success-warm-chime', .45) : score > .45 ? play('ui_select-item', .6) : play('ui_error-soft-thud', .5));
  if (t === 'shot' && !last) nextShot();
  if (BR.tasks.every(x => BR.done[x])) { BR.ready = true; setTimeout(() => play('ui_pop-bubble', .8), 300); }
  if (BR.inset === t) closeInset(); tkKey = '';
}
/* Следующий шот того же напитка: оценки цикла откладываются, помол/темпер/шот начинаются заново, эспрессо копится в той же чашке (у рафа в питчере) */
function nextShot() {
  const B = BR;
  B.cyc.push({ grind: B.res.grind, tamp: B.res.tamp, shot: B.res.shot });
  B.esPrev += B.shot.ml;
  ['grind', 'tamp', 'shot'].forEach(k => { delete B.done[k]; delete B.res[k]; });
  B.shotIdx++; B.dose = 0; B.uneven = 1; B.tampPhase = 'level'; B.tampP = 0; B.tampHold = 0; B.sweep = 0; B.pf = 'grinder';
  B.shot = { st: 'idle', t: 0, ml: 0, locked: false };
  B.hold = false; coachKey = '';
  barMsg('Шот ' + (B.shotIdx - 1) + ' из ' + B.shots + ' готов. Теперь шот ' + B.shotIdx + ': снова помол', false);
}
function quality() { return MENUAPI.scoreSteps(BR.exp, BR.res, BR.cyc); }
function barBell() {
  if (!BR) return;
  if (!BR.ready) { const nt = BR.tasks.find(t => !BR.done[t]); barMsg('Ещё не готово: ' + TASK_NAME[nt].toLowerCase(), true); play('ui_error-soft-thud', .4); return; }
  const s = quality(), q = MENUAPI.levelOf(s), c = BR.c, d = BR.drink, rc = BR.rc;
  play('bell', .9);
  D.cup = { steps: [], drink: d, q: [q], s, forId: c.id, k: rc.cupK || 1, ref: c.order ? MENUAPI.modelRefOf(c.order.id, c.order.size, !!c.order.cold) : null, art: rc.art ? c.art : null, aq: BR.res.pour == null ? .5 : BR.res.pour };
  closeInset(); BR = null; stopLoops(); stage.classList.remove('inbar'); renderCup(); frontHintUpd();
  setTimeout(() => { if (G && G.phase === 'day' && c.act && c.act.alive && !c.leaving) serve(c); else if (D) { D.cup = null; renderCup(); } }, 380);
}

/* ---------- инсеты (крупные планы) ---------- */
function openInset(mode) {
  if (!BR) return;
  if (mode === 'water' || mode === 'milk' || mode === 'ice') {
    BR.fillKind = mode; BR.fill = mode === 'water' ? BR.cup.water : mode === 'ice' ? BR.cup.ice : BR.pit.ml;
  }
  if (MENUAPI.PANEL_TASKS.has(mode)) xOpen(mode);
  BR.inset = mode; BR.hold = false; UI.close.hidden = false; coachKey = '';
  if (mode === 'pour') { BR.mx = 220; BR.my = 150; }
  if (mode === 'steam') { BR.my = 140; BR.steamT = 0; }
  sndTap();
  /* первое открытие станции: «Зачем это нужно» (при выключенных подсказках не показывается) */
  const wk = BR.c.order && !tutOffNow() ? MENUAPI.whyOfInset(mode, { drinkId: BR.c.order.id, cream: !!BR.rc.pitcherShot }) : null;
  if (wk && !G.tutorialSeen.includes(wk)) showWhy(wk);
}
function closeInset() {
  if (!BR) return;
  BR.inset = null; BR.hold = false; UI.close.hidden = true; coachKey = '';
}
/* Зона активна, только если то, что в ней, нарисовано на баре (те же условия, что у WORLD.setBarUpgrades). Остальное — пустое место стола. */
function zoneShown(z) {
  if (z === 'milk') return !!G.milk || !!G.eq_cream; /* кувшин сливок для рафа стоит у холодильника */
  if (z === 'ice') return !!G.eq_ice;
  if (z === 'micro') return !!G.eq_microwave; /* микроволновка стоит в нише справа от холодильной витрины; клик ведёт на ту же станцию «Еда» */
  if (z === 'food') return !!(G.eq_case_snacks || G.eq_case_pastry || G.eq_case_dessert || G.eq_fridge_deli);
  if (['tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker'].includes(z)) return !!G['eq_' + z];
  return true;
}
function zonesSync() {
  document.querySelectorAll('#bZones [data-z]').forEach(r => { r.style.pointerEvents = zoneShown(r.dataset.z) ? '' : 'none'; });
}
function zoneClick(z) {
  if (!BR) return;
  if (z === 'micro' && zoneShown('micro')) z = 'food';
  if (!zoneShown(z)) return;
  const d = BR.done;
  if (z === 'stop') { if (BR.shot.st === 'run') stopShot(); return; }
  if (z === 'bell') { barBell(); return; }
  if (z === 'syr1' || z === 'syr2' || z === 'syr3') z = 'syrup';
  const tz = MENUAPI.TASK_ZONE;
  if (z === 'pour' && MENUAPI.isMenuKey(BR.drink)) { const lt = BR.tasks.find(x => !d[x] && x !== 'pour' && tz[x] === 'pour'); if (lt && !blockMsg(lt)) z = lt; }
  /* к группе отправляем, только если шот в рецепте есть и ещё не готов (у матчи, какао и т. п. шота нет) */
  if (z === 'pour' && BR.tasks.indexOf('shot') >= 0 && (BR.tasks.indexOf('pour') < 0 || !d.shot)) z = 'shot';
  if (BR.tasks.indexOf(z) < 0) { const zt = BR.tasks.find(x => !d[x] && tz[x] === z); if (zt) z = zt; }
  const t = z;
  if (BR.tasks.indexOf(t) < 0 && !(z === 'pour' && BR.tasks.indexOf('pour') >= 0)) { barMsg(zoneNoNeed(z)); sndTap(); return; }
  if (d[t]) { barMsg(TASK_NAME[t] + ' уже готов'); return; }
  const b = blockMsg(t); if (b) { barMsg(b, true); play('ui_error-soft-thud', .4); return; }
  if (t === 'tamp') { BR.pf = 'mat'; }
  openInset(t);
}
function zoneNoNeed(z) {
  return { grind: 'Помол здесь не нужен', tamp: 'Темпер не нужен', shot: 'Шот не нужен', water: 'Вода в этом напитке не нужна', ice: 'Лёд в этом напитке не нужен', food: 'Еду гость не просил', milk: 'Молоко в этом напитке не нужно', steam: 'Пар не нужен', pour: 'Заливать нечего', syrup: 'Клиент не просил сироп', tea: 'Чай здесь не нужен', matcha: 'Матча здесь не нужна', powders: 'Порошок не нужен', juice: 'Сок и тоник не нужны', whipper: 'Сифон не нужен', foamer: 'Пенка не нужна', blender: 'Блендер не нужен', boba: 'Шарики не нужны', shaker: 'Шейкер не нужен' }[z] || 'Здесь ничего не нужно';
}
/* Мост к станциям из src/game/stations: состояние живёт в BR, логика — в чистых модулях. */
function runStep(step, t) {
  if (!step) return false;
  (step.effects || []).forEach(e => {
    if (e.kind === 'cost') spend(e.amount);
    else if (e.kind === 'sound') play(e.id, e.id === 'pump' ? .9 : e.id === 'fridge' ? .5 : .4, e.id === 'pump' ? .9 + Math.random() * .2 : undefined);
  });
  if (step.result) { complete(t, step.result.score, step.result.message && step.result.message.text, step.result.message && step.result.message.bad); return true; }
  if (step.message) barMsg(step.message.text, step.message.bad);
  return false;
}
const SYR_NAMES = Object.fromEntries(Object.entries(SYR).map(([k, v]) => [k, v.name]));
function syrState() { const B = BR; return { want: B.c.syrup, wantPumps: B.c.pumps, names: SYR_NAMES, id: B.syrId || null, pumps: B.pumps || 0, done: !!B.done.syrup }; }
function syrSave(st) { BR.syrId = st.id; BR.pumps = st.pumps; BR.cup.pumps = st.pumps; }
function pump(id) { const st = syrState(); const step = MENUAPI.syrupStation.pump(st, id); syrSave(st); runStep(step, 'syrup'); }
function syrDone() { const st = syrState(); const B = BR; const step = MENUAPI.syrupStation.finish(st); if (step.result) B.cup.syr = B.syrId; runStep(step, 'syrup'); }
function syrDump() { const st = syrState(); const step = MENUAPI.syrupStation.dump(st); syrSave(st); runStep(step, 'syrup'); }

/* Витрина: панель на HTML (src/ui/foodPanel), логика — станция еды */
const fpEl = $('#foodPanel'); let fpKey = '';
function renderFood(B) {
  if (!B.food) return;
  const key = B.food.picked + '|' + B.foodPicked;
  if (key !== fpKey) { fpKey = key; fpEl.innerHTML = foodPanelHTML({ want: B.c.order.food.name, heat: B.food.heat, picked: B.food.picked, choices: B.foodChoices, pickedId: B.foodPicked }); }
  const fill = $('#fpFill'); if (fill) fill.style.width = heatPct(B.food.heatT).toFixed(1) + '%';
}
fpEl.addEventListener('click', e => {
  if (!BR || !BR.food || paused) return;
  const it = e.target.closest('[data-food]'); if (it) { const id = it.dataset.food; const done = runStep(MENUAPI.foodStation.pick(BR.food, id), 'food'); if (BR && BR.food && BR.food.picked) { BR.foodPicked = id; fpKey = ''; } if (done) fpKey = ''; return; }
  if (e.target.closest('[data-fooddone]')) runStep(MENUAPI.foodStation.finish(BR.food), 'food');
});
fpEl.addEventListener('pointerdown', e => { if (BR && !paused && e.target.closest('[data-foodheat]')) { BR.hold = true; sndTap(); } });
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => fpEl.addEventListener(t, () => { if (BR && BR.inset === 'food') BR.hold = false; }));
window.addEventListener('pointerup', () => { if (BR && BR.inset === 'food') BR.hold = false; });

/* Панели станций нового ядра: налив, таймер, заварка (src/ui/stationPanel, src/game/stations) */
const xEl = $('#xPanel'); let xKey = '';
const X_TITLE = { juice: 'Налить сок или пюре', tonic: 'Налить тоник', powder: 'Добавить порошок', boba: 'Добавить шарики', topping: 'Украсить', whisk: 'Взбить матчу венчиком', brew: 'Заварить чай', blend: 'Взбить в блендере', shake: 'Взболтать в шейкере', foam: 'Взбить пенку', whip: 'Взбить сливочную пену', layer: 'Налить слоями' };
const X_HOLD = { juice: 'Лить (держите)', tonic: 'Лить (держите)', powder: 'Сыпать (держите)', boba: 'Сыпать (держите)', topping: 'Посыпать (держите)', whisk: 'Взбивать (держите)', blend: 'Блендер (держите)', shake: 'Встряхивать (держите)', foam: 'Взбивать (держите)', whip: 'Взбивать (держите)', layer: 'Лить медленно (держите)' };
const X_FILL = new Set(['juice', 'tonic', 'powder', 'boba', 'topping']);
function xOpen(t) {
  const B = BR; if (B.xs[t]) return;
  const d = B.drink, size = B.c.order.size, pal = MENUAPI.paletteOf(d), tg = MENUAPI.taskTarget(d, t, size, !!B.c.order.cold);
  let v;
  if (t === 'brew') {
    const o = MENUAPI.brewOf(d); B.xs[t] = MENUAPI.brewStation.init(o);
    v = { kind: 'brew', max: o.minutes * 1.9, zone: [o.minutes - .3, o.minutes + .3], col: pal.tea, col2: pal.foam, holdLabel: '', hint: 'Выберите температуру воды, залейте чай и вынимайте вовремя.' };
  } else if (X_FILL.has(t)) {
    const fc = MENUAPI.fillCfgFor(d, t); B.xs[t] = MENUAPI.fillStation.init({ kind: t, target: tg, cfg: fc || undefined }); const tol = fc && fc.tol !== undefined ? fc.tol : MENUAPI.fillTol(t, tg);
    v = { kind: 'fill', max: tg * 1.7, zone: [tg - tol, tg + tol], col: { juice: pal.juice, tonic: pal.tonic, powder: pal.powder, boba: pal.tea, topping: pal.topping }[t], col2: pal.foam, holdLabel: X_HOLD[t], hint: 'Держите кнопку (или Пробел) и остановитесь у линии. Лишнее можно вылить.' };
  } else {
    B.xs[t] = MENUAPI.timedStation.init({ kind: t, target: tg }); const tol = MENUAPI.TIMED[t].tol;
    const col = { whisk: pal.matcha, blend: pal.blend, shake: B.tasks.includes('powder') ? pal.powder : pal.blend, foam: '#C99B6E', whip: pal.foam, layer: B.tasks.includes('tonic') ? pal.tonic : pal.juice }[t];
    v = { kind: 'timed', max: tg * 1.7, zone: [tg - tol, tg + tol], col, col2: pal.foam, holdLabel: X_HOLD[t], hint: 'Держите кнопку (или Пробел), пока шкала не дойдёт до зелёной зоны. Потом «Готово».' };
  }
  B.xv[t] = Object.assign({ task: t, title: X_TITLE[t] }, v);
}
function xRender(B) {
  const t = B.inset, st = B.xs[t], v = B.xv[t]; if (!st || !v) return;
  if (t === 'brew') v.brew = { set: st.set, started: st.started, target: null };
  const key = t + '|' + (t === 'brew' ? st.set + '|' + st.started : '');
  if (key !== xKey) { xKey = key; xEl.innerHTML = panelHTML(v); }
  let value, readout;
  if (t === 'brew') { value = st.t; readout = readoutBrew(st.t, G.hints ? { temp: st.temp, minutes: st.minutes } : null); }
  else if (X_FILL.has(t)) { value = st.ml; readout = readoutFill(st.ml, (st.cfg && st.cfg.unit) || MENUAPI.FILL[t].unit, st.target); }
  else { value = st.t; readout = readoutTime(st.t, st.target); }
  panelUpdate(xEl, v, { value, readout, holding: !!B.hold, brewStarted: t === 'brew' && st.started });
}
function xUpdate(B, dt) {
  const b = B.xs.brew; if (b && b.started && !B.done.brew) MENUAPI.brewStation.update(b, dt);
  const t = B.inset, st = t && B.xs[t]; if (!st || B.done[t] || t === 'brew') return false;
  if (X_FILL.has(t)) MENUAPI.fillStation.update(st, dt, !!B.hold); else if (MENUAPI.PANEL_TASKS.has(t)) MENUAPI.timedStation.update(st, dt, !!B.hold);
  return !!B.hold;
}
xEl.addEventListener('click', e => {
  if (!BR || paused) return; const t = BR.inset, st = t && BR.xs[t]; if (!st) return;
  if (e.target.closest('[data-xdone]')) { runStep(t === 'brew' ? MENUAPI.brewStation.finish(st) : X_FILL.has(t) ? MENUAPI.fillStation.finish(st) : MENUAPI.timedStation.finish(st), t); return; }
  if (e.target.closest('[data-xdump]')) { st.ml = 0; play('fridge', .5); return; }
  const tp = e.target.closest('[data-xtemp]'); if (tp) { sndTap(); runStep(MENUAPI.brewStation.setTemp(st, +tp.dataset.xtemp), t); return; }
  if (e.target.closest('[data-xstart]')) { runStep(MENUAPI.brewStation.start(st), t); }
});
xEl.addEventListener('pointerdown', e => { if (BR && !paused && e.target.closest('[data-xhold]')) { BR.hold = true; sndTap(); } });
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => xEl.addEventListener(t, () => { if (BR && MENUAPI.PANEL_TASKS.has(BR.inset)) BR.hold = false; }));
window.addEventListener('pointerup', () => { if (BR && MENUAPI.PANEL_TASKS.has(BR.inset)) BR.hold = false; });

/* ---------- мышь / клавиши ---------- */
const bPt = e => { const r = bi.getBoundingClientRect(); return { x: (e.clientX - r.left) * IW / r.width, y: (e.clientY - r.top) * IH / r.height }; };
function hitAt(p) { for (let i = HIT.length - 1; i >= 0; i--) { const h = HIT[i]; if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h; } return null; }
bi.addEventListener('pointerdown', e => {
  e.preventDefault(); try { bi.setPointerCapture(e.pointerId); } catch (x) { /* не критично */ }
  if (!BR || paused) return;
  const p = bPt(e); BR.mx = p.x; BR.my = p.y;
  const h = hitAt(p);
  if (h) { if (h.off) { return; } if (h.hold) BR.hold = true; else insetClick(h.id); return; }
  if (BR.inset === 'steam' || BR.inset === 'pour') { BR.hold = true; if (BR.inset === 'pour') pourDown(p); }
  if (BR.inset === 'tamp' && BR.tampPhase === 'level') BR.hold = true;
});
bi.addEventListener('pointermove', e => {
  if (!BR || paused) return; const p = bPt(e); const px = BR.mx, py = BR.my; BR.mx = p.x; BR.my = p.y;
  if (BR.inset === 'tamp' && BR.tampPhase === 'level' && BR.hold) {
    const dx = p.x - 220, dy = p.y - 190;
    if (dx * dx + dy * dy < 130 * 130) {
      const dist = Math.hypot(p.x - px, p.y - py); BR.uneven = Math.max(0, BR.uneven - dist / 1500); BR.sweep += dist;
      if (BR.sweep > 90) { BR.sweep = 0; play('sweep', .5, .9 + Math.random() * .3); }
      if (BR.uneven <= .08) { BR.tampPhase = 'press'; BR.hold = false; play('knock', .6); coachKey = ''; }
    }
  }
  if (BR.inset === 'pour' && BR.hold) pourMove(p);
});
const bUp = () => { if (!BR || paused) return; if (BR.inset === 'tamp' && BR.tampPhase === 'press' && BR.hold) tampRelease(); BR.hold = false; };
bi.addEventListener('pointerup', bUp); bi.addEventListener('pointercancel', bUp);
UI.close.addEventListener('click', () => { if (!paused) closeInset(); });
UI.coach.addEventListener('click', e => { const b = e.target.closest('[data-tutskip]'); if (b && !paused) { markSeen(b.dataset.tutskip); coachKey = ''; COACH.text = ''; } const r = e.target.closest('[data-coachrep]'); if (r && !paused) { const h = COACH.prev || COACH.text; if (h) COACH.rep = { html: h, until: COACH.clk + coachMin(h) }; } });
$('#bZones').addEventListener('click', e => { if (paused) return; const r = e.target.closest('[data-z]'); if (r) zoneClick(r.dataset.z); });
UI.tk.addEventListener('click', e => { if (paused) return; const b = e.target.closest('[data-t]'); if (b && BR) zoneClick(b.dataset.t === 'syrup' ? SYR[BR.c.syrup].z : b.dataset.t); const h = e.target.closest('[data-hint]'); if (h) { G.hints = !G.hints; G.tutOff = !G.hints; coachKey = ''; tkKey = ''; } const m = e.target.closest('[data-tkmore]'); if (m) { tkOpen = !tkOpen; tkKey = ''; } const q = e.target.closest('[data-back]'); if (q) barShow(false); });
function barKey(c) {
  if (!BR) return false;
  if (!stage.classList.contains('inbar')) { if (c === 'Space') { barShow(true); return true; } return false; }
  if (c === 'Space') { BR.hold = true; if (BR.inset === 'shot') shotBtn(); else if (!BR.inset) { const nt = BR.tasks.find(t => !BR.done[t] && !blockMsg(t)); if (BR.ready) barBell(); else if (nt) zoneClick(nt === 'syrup' ? SYR[BR.c.syrup].z : nt); } else if (BR.inset === 'pour') pourDown({ x: BR.mx, y: BR.my }); return true; }
  if (c === 'Escape') { if (BR.inset) { closeInset(); return true; } return false; }
  if (c === 'Tab') { barShow(false); return true; }
  return false;
}
function barKeyUp(c) { if (BR && !paused && c === 'Space') { if (BR.inset === 'tamp' && BR.tampPhase === 'press' && BR.hold) tampRelease(); BR.hold = false; } }
function insetClick(id) {
  const B = BR;
  if (id === 'dialL' || id === 'dialR') { G.grindSet = clamp((G.grindSet || 3) + (id === 'dialL' ? -1 : 1), 1, 5); play('knock', .5, 1.4); return; }
  if (id.indexOf('syr:') === 0) { pump(id.slice(4)); return; }
  if (id === 'syrDone') { syrDone(); return; }
  if (id === 'syrDump') { syrDump(); return; }
  if (id === 'dump') { B.dose = 0; spend(5); play('fridge', .6); return; }
  if (id === 'grindDone') { if (B.dose < 8) { barMsg('Слишком мало кофе', true); return; } const e = Math.abs(B.dose - B.tgtDose); const sc = 1 - Math.max(0, e - .5) / 3.2; B.pf = 'mat'; complete('grind', sc, e <= .5 ? 'Доза ' + f1(B.dose / 2) + ' г: в точку' : B.dose < B.tgtDose ? 'Доза ' + f1(B.dose / 2) + ' г: маловато' : 'Доза ' + f1(B.dose / 2) + ' г: многовато', sc < .5); return; }
  if (id === 'lock') { B.shot.locked = true; B.pf = 'group'; play('lock', .9); return; }
  if (id === 'go' || id === 'stopShot') { shotBtn(); return; }
  if (id === 'fillDone') { fillDone(); return; }
  if (id === 'fillDump') { B.fill = 0; if (B.fillKind === 'milk') B.pit.ml = 0; play('fridge', .5); return; }
  if (id === 'steamDone') { steamDone(); return; }
  if (id === 'pourDone') { pourDone(); return; }
}
function shotBtn() {
  const s = BR.shot;
  if (BR.done.shot) return;
  if (!s.locked) { s.locked = true; BR.pf = 'group'; play('lock', .9); return; }
  if (s.st === 'idle') { s.st = 'run'; s.t = 0; s.ml = 0; setEs(BR.esPrev); barMsg((BR.shots > 1 ? 'Шот ' + BR.shotIdx + ' из ' + BR.shots + ' пошёл' : 'Шот пошёл') + (BR.rc.pitcherShot ? ' в питчер' : '') + ': следите за линией'); return; }
  if (s.st === 'run') stopShot();
}

