/* ---------- клиенты ---------- */
function reindex() { D.customers.forEach((c, i) => { c.x = SLOTS[i]; c.tx = SLOTS[i]; }); }
function spawn() {
  const type = (SBX.on && SBX.type) || wpick(G.day === 1 ? [['regular', .6], ['student', .4]] : [['regular', .45], ['student', .3], ['hurry', .25]]);
  /* вчерашние покупки: в первых 5 гостях каждая должна встретиться хотя бы в одном заказе */
  const left = D.focus.filter(f => !D.focusDone.has(f)), focus = left.length && D.idc < 5 && 5 - D.idc <= left.length ? left[0] : undefined;
  const order = MENUAPI.rollOrder({ rank: G.rank, day: G.day, milk: !!G.milk, eq: Object.fromEntries(MENUAPI.EQ_IMPL.map(e => [e, !!G['eq_' + e]])), focus, override: SBX.on && SBX.next ? SBX.next : undefined }, type);
  if (SBX.on) SBX.next = null;
  D.focus.forEach(f => { if (MENUAPI.orderUsesItem(f, order)) D.focusDone.add(f); });
  const drink = order.key;
  /* терпение зависит от сложности заказа (estimatedPrepSeconds), дня игры и случайного множителя гостя; заказ уже известен */
  const max = MENUAPI.patienceMax(type, { pace: G.pace, cozy: !!G.cozy, helper: !!G.helper, prep: MENUAPI.estimatedPrepSeconds(order), day: G.day, rng: Math.random });
  const c = { id: ++D.idc, type, drink, max, pat: max, leaving: false, lastW: -1, look: ART.look(type), wk: 0, ty: 0, mood: 'neutral', arrived: false, walkOn: false, order, strong: order.strong, syrup: order.syrup ? order.syrup.shelf : null, pumps: order.syrup ? order.syrup.pumps : 1, art: Math.random() < .5 ? 'heart' : 'leaf' };
  const tags = [];
  const multi = Object.keys(MENUAPI.drinkById[order.id].sizes).length > 1;
  if (multi && order.size !== '0.2') tags.push({ text: String(order.size).replace('.', ',') + ' л', color: '#8FA58A' });
  if (order.shots > 1) tags.push({ text: order.shots === 2 ? '2 шота' : order.shots + ' шотов', color: '#7A5A4A' });
  if (order.strong) tags.push({ text: 'крепкий', color: '#C4694A' });
  if (c.syrup) tags.push({ text: SYR[c.syrup].name.toLowerCase() + (c.pumps ? ' ×' + c.pumps : ''), color: SYR[c.syrup].col });
  const slot = SLOTS[Math.min(D.customers.length, SLOTS.length - 1)];
  c.px = -110; c.tx = slot; c.x = slot; c.ph = Math.random() * 6.28; c.walk = Math.random() * 6;
  c.act = WORLD.addActor({ look: c.look, model: MENUAPI.modelRefOf(order.id, order.size, !!order.cold), title: NAME[drink], tags, x: c.px, onTap: () => serve(c) });
  ACT.add(c);
  if (SBX.on) c.t0 = SBX.clock;
  D.customers.push(c);
  reindex();
}
/* точки на госте: рост гостя растёт от пола (y 600), поэтому координаты «руки» и «лица» пересчитываем */
function gx(c, dx) { return c.x + dx * WORLD.guestK; }
function gy(y) { return 600 - WORLD.guestK * (600 - y); }
function showSay(c) {
  if (!c.order || c.sayEl) return;
  const d = document.createElement('div'); d.className = 'say'; d.textContent = c.order.line;
  stage.appendChild(d); c.sayEl = d; c.sayVis = c.sayVis || 0; c.sayDur = sayDuration(c.order.line); placeSay(c); requestAnimationFrame(() => d.classList.add('show'));
}
/* Реплика над пузырём заказа, на оси головы гостя (хвостик пузыря на макушке: actor.bubbleTipY), не выходит за края сцены; говорит один гость за раз, чтобы реплики не накладывались */
const SAY_STACK = 82 + 22; /* высота карточки пузыря с тегами, масштаб 0,9 и хвостик реплики */
function placeSay(c) {
  const d = c.sayEl; if (!d) return;
  const half = Math.min(170, d.offsetWidth / 2 || 120), x = clamp(c.px, half + 16, 1280 - half - 16);
  d.style.left = Math.round(x) + 'px'; d.style.bottom = Math.round(720 - (c.act.bubbleTipY - SAY_STACK)) + 'px'; d.style.setProperty('--tail', Math.round(c.px - x) + 'px');
}
/* время показа растёт с длиной (≈ 12 символов в секунду, от 5 до 10 с); терпение и очередь от него не зависят */
const sayDuration = line => clamp(line.length / 12, 5, 10);
function hideSay(c) { if (!c.sayEl) return; const d = c.sayEl; c.sayEl = null; d.classList.remove('show'); setTimeout(() => d.remove(), 300); }
function exit(c) {
  hideSay(c);
  c.leaving = true; D.customers = D.customers.filter(x => x !== c); reindex();
  c.act.toFront(); c.tx = -150;
  setTimeout(() => { WORLD.removeActor(c.act); ACT.delete(c); }, 7000);
}
function lose(c) {
  if (BR && BR.c === c) { refund(BR.paid); barAbort('Клиент ушёл, пока вы готовили'); updateHud(true); }
  if (D.helper && D.helper.c === c) { refund(D.helper.paid); D.helper.paid = 0; D.helper.c = null; }
  D.stats.lost++; G.rating = MENUAPI.ratingAfterLoss(G.rating); sndBad();
  floatText(c.x, 'Ушёл', true); c.act.setMood('angry'); exit(c); updateHud();
}
function shake(c) { c.act.shake(); }
/* Строгая очередь: заказ берут только у первого гостя (пришёл раньше всех из ожидающих); подсказка не чаще раза в 2 с */
let qHintT = 0;
function notFirst(c) {
  const f = MENUAPI.queueOrder(D.customers);
  if (!f || f === c) return false;
  const n = performance.now(); if (n - qHintT > 2200) { qHintT = n; hint('Сначала обслужите первого гостя'); }
  return true;
}
function serve(c) {
  if (!G || G.phase !== 'day' || paused || c.leaving) return;
  if (!D.cup) { if (BR) { if (BR.c === c) barShow(true); else { hint('Сначала закончите текущий напиток'); shake(c); } } else if (!c.arrived) hint('Клиент ещё подходит'); else if (!notFirst(c)) barOpen(c); return; }
  const d = drinkOf(D.cup);
  if (d !== c.drink) { hint('Клиент ждёт ' + NAME[c.drink].toLowerCase()); c.pat = Math.max(0, c.pat - c.max * .15); shake(c); sndBad(); return; }
  deliver(c, d, cupQ(D.cup), D.cup.s > .92, true);
  D.cup = null; renderCup(); updateHud(true);
}
/* Выдача напитка гостю: деньги, чаевые, рейтинг, эффекты. Игрок и помощник пользуются одним путём. */
function deliver(c, d, q, flawless, byPlayer) {
  const st = MENUAPI.settle({ basePrice: c.order ? c.order.base : PRICE[d], beans: !!G.beans, paidSyrup: !!(c.order && c.order.syrup && !c.order.syrupImplied), quality: q, type: c.type, flawless, cards: !!G.cards, rating: G.rating, extra: c.order && c.order.food ? c.order.food.price : 0 });
  const price = st.price, tip = st.tip;
  if (SBX.on) SBX.log.push({ serve: SBX.clock - c.t0, prep: byPlayer && c.tPrep !== undefined ? SBX.clock - c.tPrep : null, tasks: byPlayer && c.nTasks ? c.nTasks : null, est: c.order ? MENUAPI.estimatedPrepSeconds(c.order) : null, q, byPlayer });
  D.stats.revenue += price; D.stats.tips += tip; D.stats.served++; if (q === 2) D.stats.perfect++;
  G.money += st.total; G.rating = st.rating;
  floatText(c.x, `+${money(price + tip)}` + (tip ? `<small>чаевые ${money(tip)}</small>` : q === 0 ? '<small>испорчено</small>' : ''), q === 0);
  coinBurst(c.x, price + tip); if (byPlayer) { servePulse = .55; WORLD.baristaServe(); } if (q >= 1) WORLD.baristaJoy();
  c.act.setMood(q === 2 ? 'joy' : q === 1 ? 'happy' : 'annoyed');
  c.act.hideBubbleNow(); hideSay(c);
  (q === 2 ? sndPerfect : sndCoin)(); if (q === 2) setTimeout(sndCoin, 220);
  /* чашка в полёте и в руке гостя рисуется моделью напитка (Н2-4); цвет верха и масштаб — запасные, пока текстура не готова */
  const ref = c.order ? MENUAPI.modelRefOf(c.order.id, c.order.size, !!c.order.cold) : null, topCol = ref ? MENUAPI.modelTopColor(ref) : '#5A3A2A';
  const ck = ref ? MENUAPI.specOf(ref.id, ref.size, ref.cold).vessel.k : 1;
  cupFly(byPlayer ? 791 : 700, byPlayer ? 396 : 420, gx(c, 40), gy(508), topCol, ck, ref); c.hold = 1.5; c.hopT = 0; c.act.reach(true);
  setTimeout(() => {
    if (!c.act.alive) return;
    c.got = true; c.hopT = .6; c.act.takeCup(topCol, ck, ref);
    if (q === 2) { loveBurst(c.x, gy(425), 3); sparkBurst(gx(c, 40), gy(500), 7); } else if (q === 1) { loveBurst(c.x, gy(425), 1); if (tip) sparkBurst(gx(c, 40), gy(500), 3); } else puffBurst(c.x, gy(440));
  }, 400);
  exit(c);
}
/* Пробел без активного заказа: подать готовую чашку или принять заказ первого гостя */
function openNext() {
  if (!G || G.phase !== 'day' || paused) return;
  if (D.cup) serveMatch();
  else if (D.customers.length) { const c = D.customers[0]; if (!c.arrived) hint('Клиент ещё подходит'); else barOpen(c); }
  else hint('Пока никого нет');
}
function serveMatch() {
  if (!G || G.phase !== 'day' || paused) return;
  if (D.customers.length === 0) { hint('Пока никого нет'); return; }
  const d = drinkOf(D.cup);
  const c = D.customers.find(x => x.drink === d) || D.customers[0];
  serve(c);
}

