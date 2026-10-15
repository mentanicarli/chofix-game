/* ---------- день ---------- */
function interval() { const v = MENUAPI.arrivalInterval({ day: G.day, rating: G.rating, t: D.t, wifi: !!G.wifi }); return SBX.on ? v / SBX.rate : v; }
function startDay() {
  G.phase = 'day'; paused = false; scr.hidden = true;
  WORLD.clearActors(); ACT.clear();
  D = { t: 0, customers: [], nextArr: 4, closing: false, closeT: 0, cup: null, hold: null, rushShown: false, idc: 0, focus: G.fresh.slice(), focusDone: new Set(), stats: { served: 0, lost: 0, revenue: 0, tips: 0, costs: 0, perfect: 0 } };
  if (SBX.on) { SBX.log = []; SBX.clock = 0; }
  BR = null; renderCup(); lastHud = ''; updateHud(); stopLoops(); stage.classList.remove('inbar');
  G.fresh = [];
  G.idealGrind = MENUAPI.idealGrind(G.day); if (G.day >= 3 && !G.hintsTouched) G.hints = false;
  saveGame();
  banner('День ' + G.day, 'Открываемся');
  if (G.idealGrind !== (G.grindSet || 3) && G.day > 1) toast('Сегодня другая погода: проверьте помол по первому шоту', 4200);
}
function tickDay(dt) {
  D.t += dt;
  if (SBX.inf && G.money < 1e6) G.money = 1e6;
  const clock = OPEN_MIN + Math.min(1, D.t / DAY_LEN) * SPAN_MIN;
  if (!D.rushShown && clock >= 720 && !D.closing) { D.rushShown = true; toast('Обеденный час пик: клиентов станет больше'); }
  if (!D.closing && D.t >= DAY_LEN) { D.closing = true; banner('Закрываемся', 'Доделываем заказы'); }
  if (!D.closing) {
    D.nextArr -= dt;
    if (D.nextArr <= 0) {
      if (D.customers.length >= SLOTS.length) D.nextArr = 1.2; else { spawn(); D.nextArr = interval(); }
    }
  } else {
    /* после 18:00 новых гостей нет, очередь дообслуживается по обычным правилам; страховка от зависшего дня — без штрафа */
    D.closeT += dt;
    if ((D.customers.length === 0 && !BR) || D.closeT > MENUAPI.CLOSING_LIMIT) { endDay(); return; }
  }
  for (const c of D.customers.slice()) {
    if (!c.arrived) continue;
    /* терпение тает по месту в очереди: первый 1, второй 0,5, третий и дальше 0,3; хинт дня 1 в баре замедляет ещё в 0,3 раза */
    c.pat -= dt * MENUAPI.queueDecayRate(D.customers.indexOf(c)) * (BR && BR.c === c && stage.classList.contains('inbar') && G.day === 1 && G.hints ? .3 : 1);
    const f = Math.max(0, c.pat / c.max), w = Math.round(f * 520) / 10;
    if (w !== c.lastW) { c.lastW = w; c.act.setPatience(f); }
    const m = f < .12 ? 'angry' : f < .3 ? 'annoyed' : f < .6 ? 'wait' : 'neutral';
    if (m !== c.mood) { c.mood = m; c.act.setMood(m); }
    if (SBX.noPat) c.pat = c.max;
    if (c.pat <= 0) lose(c);
  }
  helperTick(dt);
  updateHud();
}
function endDay() {
  /* день закрылся посреди заказа: расходы за невыданный напиток возвращаем */
  if (BR) refund(BR.paid);
  if (D.helper && D.helper.c) { refund(D.helper.paid); D.helper.paid = 0; D.helper.c = null; }
  const s = D.stats, fin = MENUAPI.settleDay({ money: G.money, pace: G.pace, rank: G.rank, wage: G.helper ? MENUAPI.helperWage(G.rank) : 0 }), rent = fin.rent;
  G.money = fin.money;
  G.served += s.served;
  const nr = MENUAPI.nextRank(G.rank, { day: G.day + 1, rating: G.rating, served: G.served });
  if (nr) { const was = shopState(); G.rank = nr.rank; s.rankUp = nr; s.shopNew = MENUAPI.shopNewText(MENUAPI.newlyAvailable(SHOP, was, shopState()).map(i => i.name)); applyUpgrades(); }
  D.stats.rent = rent; D.stats.profit = s.revenue + s.tips - s.costs - rent;
  D.cup = null; barAbort(); renderCup(); updateHud();
  const over = fin.over;
  G.phase = over ? 'over' : 'evening';
  banner('Закрыто', 'Считаем выручку'); stage.classList.add('closing'); play('door', .6);
  setTimeout(() => { over ? showOver() : showEvening(); stage.classList.remove('closing'); }, 2600);
}

