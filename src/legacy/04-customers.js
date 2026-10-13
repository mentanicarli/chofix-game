/* ---------- клиенты ---------- */
const ICE_CUBES = '<rect x="-6" y="-9" width="6" height="6" rx="1.5" fill="#FFFFFF" fill-opacity=".85" transform="rotate(-12 -3 -6)"/><rect x="1" y="-4" width="6" height="6" rx="1.5" fill="#FFFFFF" fill-opacity=".85" transform="rotate(10 4 -1)"/>';
ICON.icedlatte = ICON.latte + ICE_CUBES; ICON.icedcappuccino = ICON.cappuccino + ICE_CUBES;
ICON.flatwhite = ICON.latte; ICON.vanillaraf = ICON.raf = ICON.rafhalva = ICON.latte;
function reindex() { D.customers.forEach((c, i) => { c.x = SLOTS[i]; c.tx = SLOTS[i]; }); }
function spawn() {
  const type = wpick(G.day === 1 ? [['regular', .6], ['student', .4]] : [['regular', .45], ['student', .3], ['hurry', .25]]);
  /* вчерашние покупки: в первых 5 гостях каждая должна встретиться хотя бы в одном заказе */
  const left = D.focus.filter(f => !D.focusDone.has(f)), focus = left.length && D.idc < 5 && 5 - D.idc <= left.length ? left[0] : undefined;
  const order = MENUAPI.rollOrder({ rank: G.rank, day: G.day, milk: !!G.milk, eq: Object.fromEntries(MENUAPI.EQ_IMPL.map(e => [e, !!G['eq_' + e]])), focus }, type);
  D.focus.forEach(f => { if (MENUAPI.orderUsesItem(f, order)) D.focusDone.add(f); });
  const drink = order.key;
  const max = MENUAPI.patienceMax(type, { pace: G.pace, cozy: !!G.cozy, helper: !!G.helper });
  const c = { id: ++D.idc, type, drink, max, pat: max, leaving: false, lastW: -1, look: ART.look(type), wk: 0, ty: 0, mood: 'neutral', arrived: false, walkOn: false, order, strong: order.strong, syrup: order.syrup ? order.syrup.shelf : null, pumps: order.syrup ? order.syrup.pumps : 1, art: Math.random() < .5 ? 'heart' : 'leaf' };
  const tags = [];
  if (order.strong) tags.push({ text: 'крепкий', color: '#C4694A' });
  if (c.syrup) tags.push({ text: SYR[c.syrup].name.toLowerCase() + (c.pumps ? ' ×' + c.pumps : ''), color: SYR[c.syrup].col });
  const slot = SLOTS[Math.min(D.customers.length, SLOTS.length - 1)];
  c.px = -110; c.tx = slot; c.x = slot; c.ph = Math.random() * 6.28; c.walk = Math.random() * 6;
  c.act = WORLD.addActor({ look: c.look, icon: iconOf(drink), iconKey: drink, title: NAME[drink], tags, x: c.px, onTap: () => serve(c) });
  ACT.add(c);
  D.customers.push(c);
  reindex();
}
function showSay(c) {
  if (!c.order || c.sayEl) return;
  const d = document.createElement('div'); d.className = 'say'; d.textContent = c.order.line; d.style.left = Math.round(c.tx) + 'px';
  stage.appendChild(d); c.sayEl = d; requestAnimationFrame(() => d.classList.add('show'));
}
function hideSay(c) { if (!c.sayEl) return; const d = c.sayEl; c.sayEl = null; d.classList.remove('show'); setTimeout(() => d.remove(), 300); }
function exit(c) {
  hideSay(c);
  c.leaving = true; D.customers = D.customers.filter(x => x !== c); reindex();
  c.act.toFront(); c.tx = -150;
  setTimeout(() => { WORLD.removeActor(c.act); ACT.delete(c); }, 7000);
}
function lose(c) {
  if (BR && BR.c === c) barAbort('Клиент ушёл, пока вы готовили');
  D.stats.lost++; G.rating = MENUAPI.ratingAfterLoss(G.rating); sndBad();
  floatText(c.x, 'Ушёл', true); c.act.setMood('angry'); exit(c); updateHud();
}
function shake(c) { c.act.shake(); }
function serve(c) {
  if (!G || G.phase !== 'day' || paused || c.leaving) return;
  if (!D.cup) { if (BR) { if (BR.c === c) barShow(true); else { hint('Сначала закончите текущий напиток'); shake(c); } } else if (!c.arrived) hint('Клиент ещё подходит'); else barOpen(c); return; }
  const d = drinkOf(D.cup);
  if (d !== c.drink) { hint('Клиент ждёт ' + NAME[c.drink].toLowerCase()); c.pat = Math.max(0, c.pat - c.max * .15); shake(c); sndBad(); return; }
  deliver(c, d, cupQ(D.cup), D.cup.s > .92, true);
  D.cup = null; renderCup(); updateHud(true);
}
/* Выдача напитка гостю: деньги, чаевые, рейтинг, эффекты. Игрок и помощник пользуются одним путём. */
function deliver(c, d, q, flawless, byPlayer) {
  const st = MENUAPI.settle({ basePrice: c.order ? c.order.base : PRICE[d], beans: !!G.beans, paidSyrup: !!(c.order && c.order.syrup && !c.order.syrupImplied), quality: q, type: c.type, flawless, cards: !!G.cards, rating: G.rating, extra: c.order && c.order.food ? c.order.food.price : 0 });
  const price = st.price, tip = st.tip;
  D.stats.revenue += price; D.stats.tips += tip; D.stats.served++; if (q === 2) D.stats.perfect++;
  G.money += st.total; G.rating = st.rating;
  floatText(c.x, `+${money(price + tip)}` + (tip ? `<small>чаевые ${money(tip)}</small>` : q === 0 ? '<small>испорчено</small>' : ''), q === 0);
  coinBurst(c.x, price + tip); if (byPlayer) { servePulse = .55; WORLD.baristaServe(); } if (q >= 1) WORLD.baristaJoy();
  c.act.setMood(q === 2 ? 'joy' : q === 1 ? 'happy' : 'annoyed');
  c.act.hideBubbleNow(); hideSay(c);
  (q === 2 ? sndPerfect : sndCoin)(); if (q === 2) setTimeout(sndCoin, 220);
  const topCol = MENUAPI.isMenuKey(d) ? MENUAPI.topColorOf(d) : d === 'cappuccino' ? '#F1DFC2' : d === 'americano' ? '#8A5B3A' : '#5A3A2A';
  cupFly(byPlayer ? 808 : 700, byPlayer ? 396 : 420, c.x + 40, 508, topCol); c.hold = 1.5; c.hopT = 0; c.act.reach(true);
  setTimeout(() => {
    if (!c.act.alive) return;
    c.got = true; c.hopT = .6; c.act.takeCup(topCol);
    if (q === 2) { loveBurst(c.x, 425, 3); sparkBurst(c.x + 40, 500, 7); } else if (q === 1) { loveBurst(c.x, 425, 1); if (tip) sparkBurst(c.x + 40, 500, 3); } else puffBurst(c.x, 440);
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

