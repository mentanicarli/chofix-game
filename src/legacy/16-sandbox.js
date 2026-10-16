/* ---------- песочница разработчика: работает только при #dev (DEV из 00-core.js) ---------- */
/* Здесь только объявления; всё, что исполняется, лежит в блоке if (DEV) внизу. Настоящий сейв песочница не читает и не пишет (см. SAVE_STORE). */
const SBX_STORE = {
  load() { try { return MENUAPI.parseSandboxConfig(localStorage.getItem(MENUAPI.SANDBOX_KEY)); } catch (e) { return MENUAPI.defaultSandboxConfig(); } },
  save(c) { try { localStorage.setItem(MENUAPI.SANDBOX_KEY, MENUAPI.serializeSandboxConfig(c)); } catch (e) { /* конфигурация не запомнится */ } }
};
let sbxCfg = null, devBtnEl = null, devPanelEl = null, dvOpen = false, dvT = 0;
const dvq = sel => devPanelEl.querySelector(sel);

/* --- экран настройки старта --- */
function sbxRead() {
  const q = k => scr.querySelector(`[data-f="${k}"]`), det = scr.querySelector('[data-custom]');
  const cfg = { day: +q('day').value, profile: q('profile').value, mode: q('mode').value, pace: q('pace').value, showTutorial: q('showTutorial').checked, custom: null };
  if (det && det.open) cfg.custom = { rank: +q('rank').value, rating: +q('rating').value, served: +q('served').value, money: +q('money').value, items: [...scr.querySelectorAll('[data-item]:checked')].map(e => e.dataset.item) };
  return MENUAPI.normalizeSandboxConfig(cfg);
}
function sbxShow(cfg, msg, focus) {
  const old = scr.querySelector('.sbody'), y = old ? old.scrollTop : 0;
  sbxCfg = cfg; menuFrom = 'title';
  menuRender(sandboxScreenHTML({ view: MENUAPI.resolveSandbox(cfg), items: SHOP.map(i => ({ id: i.id, name: i.name, cat: i.cat })), cats: SHOP_CATS, msg }), true);
  const b = scr.querySelector('.sbody'); if (b) b.scrollTop = y;
  if (focus) focusFirst('.big');
}
/* Старт: то же, что делает кнопка «Начать» (и e2e через window.__sandbox.start) */
function sbxStart(raw) {
  const cfg = MENUAPI.normalizeSandboxConfig(raw || SBX_STORE.load()); SBX_STORE.save(cfg); sbxCfg = cfg;
  const st = MENUAPI.makeSandboxState(cfg);
  Object.assign(SBX, { mode: cfg.mode, custom: !!cfg.custom, on: true, scale: 1, noPat: false, free: false, inf: false, rate: 1, type: null, next: null, clock: 0, log: [] });
  newGame(); Object.assign(G, st);
  applyUpgrades(); lastHud = ''; updateHud();
  if (devPanelEl) {
    devPanelEl.querySelectorAll('input[type=checkbox][data-dv]').forEach(e => { e.checked = false; });
    dvq('[data-dv="type"]').value = ''; dvq('[data-dv="rate2"]').value = '1';
  }
  startDay();
}
function sbxLeave() {
  Object.assign(SBX, { on: false, scale: 1, noPat: false, free: false, inf: false, rate: 1, type: null, next: null, log: [] });
  if (devBtnEl) { devBtnEl.hidden = true; devPanelEl.hidden = true; }
}

/* --- панель во время игры --- */
function sbxOrder() {
  const v = k => dvq(`[data-o="${k}"]`), o = {};
  if (v('drink').value) o.drink = v('drink').value;
  if (v('size').value) o.size = v('size').value;
  if (v('cold').value) o.cold = v('cold').value === '1';
  if (v('syrup').value) o.syrup = v('syrup').value === '-' ? null : v('syrup').value;
  if (v('altMilk').value) o.altMilk = v('altMilk').value;
  if (v('food').value) o.food = v('food').value === '-' ? null : v('food').value;
  if (v('strong').checked) o.strong = true;
  if (v('heat').checked) o.heat = true;
  return Object.keys(o).length ? o : null;
}
function sbxOrderText(o) {
  if (!o) return 'Следующий заказ случайный.';
  const parts = [o.drink ? (MENUAPI.drinkById[o.drink] ? MENUAPI.drinkById[o.drink].name : o.drink) : 'любой напиток'];
  if (o.size) parts.push(o.size.replace('.', ','));
  if (o.cold !== undefined) parts.push(o.cold ? 'холодный' : 'горячий');
  if (o.syrup !== undefined) parts.push(o.syrup || 'без сиропа');
  if (o.altMilk) parts.push(o.altMilk);
  if (o.food !== undefined) parts.push(o.food ? 'с едой' : 'без еды');
  if (o.strong) parts.push('крепкий');
  return 'Задан: ' + parts.join(', ') + '.';
}
function sbxSummary() {
  const z = D ? D.stats : { lost: 0, revenue: 0, tips: 0, costs: 0 };
  return MENUAPI.summarizeShift(SBX.log, { lost: z.lost, revenue: z.revenue, tips: z.tips, costs: z.costs }, 'dev: день ' + G.day + ', ранг ' + G.rank);
}
function sbxStatsText() {
  const s = sbxSummary(), st = x => (x ? Math.round(x.mean) + ' с (медиана ' + Math.round(x.median) + ' с)' : '—'), p = n => Math.round(n * 100) + '%';
  const lines = ['Подано ' + s.served + (s.servedByHelper ? ' (помощник ' + s.servedByHelper + ')' : '') + ', ушло ' + s.lost, 'Доход ' + money(s.income) + ', расходы ' + money(s.costs),
    'От появления до выдачи: ' + st(s.serveTime), 'Готовка у бара: ' + st(s.prepTime)];
  Object.keys(s.byTasks).forEach(k => { const b = s.byTasks[k]; lines.push('Шагов ' + k + ': ' + b.n + ' шт, ' + st(b.serveTime)); });
  lines.push('Скорость ×' + (s.profile.speed === null ? '—' : s.profile.speed) + '; плохо ' + p(s.profile.q[0]) + ', нормально ' + p(s.profile.q[1]) + ', идеально ' + p(s.profile.q[2]));
  return lines.join('\n');
}
/* раз в кадр: показ панели и обновление чисел (раз в полсекунды) */
function sbxUi(dt) {
  if (!devBtnEl) return;
  const show = !!G && (G.phase === 'day' || G.phase === 'evening');
  if (devBtnEl.hidden === show) devBtnEl.hidden = !show;
  const po = show && dvOpen; if (devPanelEl.hidden === po) devPanelEl.hidden = !po;
  dvT -= dt; if (!po || dvT > 0) return; dvT = .5;
  dvq('#dvInfo').textContent = 'День ' + G.day + ' · ранг ' + G.rank + ' · ' + (SBX.custom ? 'Своё' : SBX.mode === 'typical' ? 'Типичный игрок' : 'Всё доступное');
  dvq('#dvStats').textContent = sbxStatsText();
  dvq('#dvNext').textContent = sbxOrderText(SBX.next);
  devPanelEl.querySelectorAll('[data-dv="speed"]').forEach(b => b.classList.toggle('on', +b.dataset.v === SBX.scale));
}
function sbxEndDay() {
  if (!D || G.phase !== 'day') return;
  if (CARDON) { CARDON = null; dcEl.hidden = true; dcEl.innerHTML = ''; }
  D.customers.slice().forEach(c => exit(c));
  endDay();
}
function sbxNextRank() {
  if (G.rank >= MENUAPI.MAX_RANK) { toast('Это высший ранг'); return; }
  const was = shopState(), r = MENUAPI.rankInfo(G.rank + 1), nm = MENUAPI.unlockedAt(r.rank).drinks.map(d => d.name), unreal = r.rank > MENUAPI.maxRankForDay(G.day);
  G.rank = r.rank;
  const shopNew = MENUAPI.shopNewText(MENUAPI.newlyAvailable(SHOP, was, shopState()).map(i => i.name));
  /* «Всё доступное»: как у обычной игры, ставшее доступным открыто сразу (цепочки зависимостей считаются до неподвижной точки) */
  if (SBX.mode === 'all' && !SBX.custom) MENUAPI.extendAvailable(G.day, G.rank, SHOP.filter(i => G[i.id]).map(i => i.id)).forEach(id => { G[id] = true; });
  applyUpgrades();
  D.stats.rankUp = r; D.stats.shopNew = shopNew;
  toast((unreal ? 'Для этого дня ранг нереалистичен. ' : '') + 'Новый ранг: ' + r.title + '. Новое: ' + (nm.length ? nm.slice(0, 3).join(', ') + (nm.length > 3 ? ' и ещё ' + (nm.length - 3) : '') : 'блюда и добавки') + '.' + (shopNew ? ' ' + shopNew : ''), 5200);
  lastHud = ''; updateHud();
}
function sbxCopy() {
  const txt = JSON.stringify(sbxSummary(), null, 2);
  const done = ok => toast(ok ? 'Статистика скопирована' : 'Не удалось скопировать: текст выделен в панели', 2600);
  const fallback = () => { const pre = dvq('#dvStats'); try { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); done(document.execCommand('copy')); } catch (e) { done(false); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => done(true), fallback); else fallback();
  window.__sandboxStats = txt;
}
function sbxAction(a, v) {
  const day = G && G.phase === 'day' && D;
  if (a === 'speed') { if (day) SBX.scale = +v; }
  else if (a === 'step') { if (day) for (let i = 0; i < 10 && G.phase === 'day'; i++) { SBX.clock += .1; tickDay(.1); } }
  else if (a === 'endday') sbxEndDay();
  else if (a === 'money') { G.money += +v; lastHud = ''; updateHud(true); }
  else if (a === 'rate') { G.rating = clamp(Math.round((G.rating + +v) * 100) / 100, 1, 5); lastHud = ''; updateHud(); }
  else if (a === 'rank') { if (day) sbxNextRank(); }
  else if (a === 'call') { if (day) { if (D.customers.length >= SLOTS.length) toast('Все места у стойки заняты'); else spawn(); } }
  else if (a === 'setorder') { SBX.next = sbxOrder(); dvq('#dvNext').textContent = sbxOrderText(SBX.next); }
  else if (a === 'tutreset') { G.tutorialSeen = MENUAPI.freshSeen(); coachKey = ''; tkKey = ''; toast('Обучение сброшено: карточки и подсказки покажутся снова'); }
  else if (a === 'copy') sbxCopy();
  else if (a === 'exit') { SBX_STORE.save(sbxCfg || SBX_STORE.load()); dvOpen = false; leaveToTitle(); }
}

if (DEV) {
  const holder = document.createElement('div');
  holder.innerHTML = devPanelHTML({
    drinks: MENUAPI.DRINKS.map(d => ({ id: d.id, name: d.name })),
    syrups: MENUAPI.SYRUPS.filter(s => MENUAPI.SYRUP_META[s.name] && !MENUAPI.RECIPE_SYRUPS.has(s.name)).map(s => s.name),
    altMilks: MENUAPI.ALT_MILK.map(a => a.name),
    foods: MENUAPI.FOOD.map(f => ({ id: f.id, name: f.name })),
    types: [['regular', 'Постоянный'], ['student', 'Студент'], ['hurry', 'Спешащий']]
  });
  devBtnEl = holder.querySelector('#devBtn'); devPanelEl = holder.querySelector('#devPanel');
  devBtnEl.hidden = true; devPanelEl.hidden = true;
  stage.append(devBtnEl, devPanelEl);
  devBtnEl.addEventListener('click', () => { dvOpen = !dvOpen; devBtnEl.setAttribute('aria-expanded', String(dvOpen)); dvT = 0; devBtnEl.blur(); });
  /* клавиши внутри панели не должны доходить до игры (Пробел, P, Esc) */
  ['keydown', 'keyup'].forEach(t => devPanelEl.addEventListener(t, e => e.stopPropagation()));
  devPanelEl.addEventListener('click', e => { const b = e.target.closest('button[data-dv]'); if (!b) return; sbxAction(b.dataset.dv, b.dataset.v); b.blur(); dvT = 0; });
  devPanelEl.addEventListener('change', e => {
    const k = e.target.dataset.dv; if (!k) return;
    if (k === 'inf') SBX.inf = e.target.checked; else if (k === 'free') SBX.free = e.target.checked; else if (k === 'nopat') SBX.noPat = e.target.checked;
    else if (k === 'type') SBX.type = e.target.value || null; else if (k === 'rate2') SBX.rate = +e.target.value || 1;
    e.target.blur();
  });
  scr.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
    if (d.sandbox) { sndTap(); sbxShow(SBX_STORE.load(), '', true); }
    else if (d.sbx === 'tutreset') { sndTap(); sbxShow({ ...sbxRead(), showTutorial: true }, 'Обучение сброшено: в игре покажутся карточки новых напитков и подсказки станций.'); }
    else if (d.sbx === 'start') { sndTap(); sbxStart(sbxRead()); }
  });
  /* пересчёт экрана: день, профиль, режим и темп сбрасывают ручные правки; ранг пересчитывает покупки; остальное просто приводится к допустимому */
  scr.addEventListener('change', e => {
    if (menuView() !== 'sandbox') return;
    const f = e.target.dataset.f; if (e.target.dataset.item !== undefined) { sbxShow(sbxRead()); return; }
    if (!f || f === 'showTutorial') return;
    const cfg = sbxRead();
    if (['day', 'profile', 'mode', 'pace'].includes(f)) sbxShow({ ...cfg, custom: cfg.custom ? {} : null });
    else if (f === 'rank') sbxShow({ ...cfg, custom: { ...cfg.custom, items: undefined } });
    else sbxShow(cfg);
  });
  /* «Своё» открыли или закрыли: пересчитать сводку (при закрытии ручные правки отбрасываются) */
  scr.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('[data-custom]') && menuView() === 'sandbox' && sbxCfg && e.target.open !== (sbxCfg.custom !== null)) sbxShow(sbxRead()); }, true);
  window.__sandbox = { start: sbxStart, config: () => SBX_STORE.load(), state: SBX };
  /* только для проверки Б1-1: камера бара без навигации игрока (goSection из e2e: window.__sec.go('L'|'C'|'R', instant)) */
  window.__sec = { go: (id, instant) => camGo(id, !!instant), state: () => ({ sec: CAM.sec, x: CAM.x, moving: CAM.moving }), textures: () => WORLD.barSideTextures() };
}
