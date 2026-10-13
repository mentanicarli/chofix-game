/* ---------- помощник: с ранга «Старший смены» сам готовит простые напитки ---------- */
function helperTick(dt) {
  const chip = $('#helperChip');
  if (!G.helper || G.rank < MENUAPI.HELPER_MIN_RANK) { chip.hidden = true; return; }
  const H = D.helper || (D.helper = { c: null, t: 0, need: 0 });
  if (H.c && (H.c.leaving || !D.customers.includes(H.c) || (BR && BR.c === H.c))) H.c = null;
  if (!H.c && !D.closing) {
    const g = MENUAPI.helperPick(D.customers.map(c => ({ id: c.id, drink: c.drink, arrived: c.arrived, leaving: c.leaving, pat: c.pat, syrup: c.syrup, food: !!(c.order && c.order.food) })), BR ? BR.c.id : null);
    if (g) { H.c = D.customers.find(c => c.id === g.id); H.t = 0; H.need = MENUAPI.helperPrepTime(H.c.drink); const cost = drinkCost(H.c.drink); D.stats.costs += cost; G.money -= cost; }
  } else if (H.c) {
    H.t += dt;
    if (H.t >= H.need) { const c = H.c; H.c = null; deliver(c, c.drink, MENUAPI.helperQuality(G.rank), false, false); updateHud(true); }
  }
  chip.hidden = !H.c;
  if (H.c) { chip.textContent = 'Помощник: ' + NAME[H.c.drink].toLowerCase() + ' ' + Math.min(100, Math.round(H.t / H.need * 100)) + '%'; }
}
