/* ---------- значки для экранов ---------- */
const KS = 'stroke="#4A2F25" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const PACE_ICON = {
  cozy: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 38Q8 16 30 10Q40 10 38 22Q36 36 14 38Z" fill="#93A684" ${KS}/><path d="M12 36Q22 24 32 16" fill="none" ${KS} stroke-width="2.4"/></svg>`,
  normal: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 18H35L32 38Q22 44 12 38Z" fill="#FFF8EC" ${KS}/><path d="M35 22Q45 22 43 31Q41 37 33 36" fill="none" ${KS}/><ellipse cx="22" cy="18" rx="13" ry="3.4" fill="#8A5B3A" ${KS} stroke-width="2.4"/><path d="M16 10q3 3 0 6M24 8q3 3 0 6" fill="none" ${KS} stroke-width="2.2"/></svg>`,
  hard: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M27 5L11 27H22L19 43L37 20H26Z" fill="#E8B04A" ${KS}/></svg>`
};
/* оборудование из прогрессии: в магазине появляется только то, что уже работает в баре */
MENUAPI.EQUIPMENT.filter(e => MENUAPI.EQ_IMPL.includes(e.id)).forEach(e => SHOP.push({ id: 'eq_' + e.id, cat: 'gear', name: e.name, desc: 'Открывает: ' + e.unlocks + '.', cost: e.cost }));
const SHOP_ICON = {
  milk: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 22H40L38 54Q30 58 22 54Z" fill="#FFF8EC" ${KS}/><path d="M40 29Q52 29 50 41Q48 49 39 47" fill="none" ${KS}/><rect x="18" y="15" width="26" height="9" rx="4.5" fill="#C4694A" ${KS}/><path d="M24 38Q30 34 36 38" fill="none" ${KS} stroke-width="2.4"/></svg>`,
  machine: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="14" width="44" height="34" rx="7" fill="#C4694A" ${KS}/><rect x="8" y="10" width="48" height="8" rx="4" fill="#FBF4E8" ${KS}/><rect x="14" y="44" width="36" height="6" rx="3" fill="#E8B04A" ${KS} stroke-width="2.4"/><circle cx="32" cy="29" r="6.5" fill="#FBF4E8" ${KS} stroke-width="2.4"/><path d="M32 29l3-4" fill="none" ${KS} stroke-width="2.2"/><rect x="24" y="52" width="16" height="6" rx="2" fill="#4A3328" ${KS} stroke-width="2.4"/></svg>`,
  cozy: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 16Q32 36 60 16" fill="none" ${KS} stroke-width="2.4"/><circle cx="18" cy="30" r="10" fill="#FFE29A" fill-opacity=".5"/><circle cx="18" cy="30" r="5" fill="#FFE29A" ${KS} stroke-width="2.4"/><circle cx="32" cy="35" r="10" fill="#FFE29A" fill-opacity=".5"/><circle cx="32" cy="35" r="5" fill="#FFE29A" ${KS} stroke-width="2.4"/><circle cx="46" cy="30" r="10" fill="#FFE29A" fill-opacity=".5"/><circle cx="46" cy="30" r="5" fill="#FFE29A" ${KS} stroke-width="2.4"/></svg>`,
  beans: `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="24" cy="30" rx="14" ry="18" transform="rotate(-24 24 30)" fill="#7A4A38" ${KS}/><path d="M16 46Q26 32 32 14" fill="none" stroke="#E8CDA8" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="44" cy="40" rx="11" ry="14" transform="rotate(26 44 40)" fill="#8A5440" ${KS}/><path d="M50 52Q42 42 38 28" fill="none" stroke="#E8CDA8" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  syrups: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="22" width="22" height="34" rx="7" fill="#A67855" ${KS}/><rect x="28" y="12" width="10" height="12" rx="3" fill="#BFC4C2" ${KS} stroke-width="2.4"/><path d="M28 12h20" fill="none" ${KS} stroke-width="4"/><rect x="25" y="34" width="16" height="12" rx="3" fill="#FFF8EC" ${KS} stroke-width="2"/></svg>`,
  stencil: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="22" fill="#F1DFC2" ${KS}/><path d="M32 46C22 38 20 30 25 27C29 25 32 28 32 30C32 28 35 25 39 27C44 30 42 38 32 46Z" fill="#FFF8EC" ${KS} stroke-width="2.4"/></svg>`,
  grinderPro: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 10H46L42 26H22Z" fill="#DCEBF0" ${KS}/><rect x="16" y="26" width="32" height="28" rx="6" fill="#C4694A" ${KS}/><rect x="22" y="32" width="20" height="10" rx="3" fill="#2F2A27" ${KS} stroke-width="2.4"/><path d="M26 37h12" stroke="#7BC46A" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  tamper: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="27" y="8" width="10" height="28" rx="5" fill="#3F3A36" ${KS}/><rect x="14" y="36" width="36" height="12" rx="4" fill="#BFC4C2" ${KS}/><path d="M14 54H50" ${KS}/></svg>`,
  thermo: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 22H38L35 54Q26 58 19 54Z" fill="#C9C8C0" ${KS}/><path d="M38 28Q50 28 48 38Q46 45 37 44" fill="none" ${KS}/><rect x="46" y="8" width="8" height="24" rx="4" fill="#FFF8EC" ${KS} stroke-width="2.4"/><rect x="48.5" y="18" width="3" height="12" fill="#C4694A"/></svg>`,
  wifi: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 26Q32 4 56 26" fill="none" ${KS}/><path d="M16 35Q32 20 48 35" fill="none" ${KS}/><path d="M24 44Q32 36 40 44" fill="none" ${KS}/><circle cx="32" cy="53" r="4" fill="#E8B04A" ${KS} stroke-width="2.4"/></svg>`,
  cards: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="16" width="48" height="32" rx="6" fill="#F3D88F" ${KS}/><path d="M8 25H56" ${KS} stroke-width="2.4"/><polygon points="32,29 34.6,35 41,35.4 36,39.4 37.8,45.4 32,42 26.2,45.4 28,39.4 23,35.4 29.4,35" fill="#C4694A" stroke="#4A2F25" stroke-width="2" stroke-linejoin="round"/></svg>`,
  helper: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="22" r="11" fill="#E7B58E" ${KS}/><path d="M20 20Q22 8 34 9Q44 10 44 20Q36 14 20 20Z" fill="#4A3328" ${KS} stroke-width="2.4"/><path d="M12 56Q14 38 32 38Q50 38 52 56Z" fill="#93A684" ${KS}/></svg>`
};
const CUP_LOGO = `<svg class="logo" viewBox="0 0 96 96" aria-hidden="true"><g class="steam"><path d="M32 22q7 7 0 14q-7 7 0 14" fill="none" stroke="#F1DFC2" stroke-width="4" stroke-linecap="round"/><path d="M48 14q7 7 0 14q-7 7 0 14" fill="none" stroke="#F1DFC2" stroke-width="4" stroke-linecap="round"/><path d="M64 22q7 7 0 14q-7 7 0 14" fill="none" stroke="#F1DFC2" stroke-width="4" stroke-linecap="round"/></g><path d="M16 54H72L66 82Q44 92 22 82Z" fill="#FFF8EC" ${KS}/><path d="M72 58Q90 58 86 72Q83 82 68 80" fill="none" ${KS}/><ellipse cx="44" cy="54" rx="28" ry="6" fill="#8A5B3A" ${KS}/><path d="M36 54q8 -5 16 0" fill="none" stroke="#F1DFC2" stroke-width="3" stroke-linecap="round"/></svg>`;

/* числа считаются, как на кассе */
function countUp() {
  const els = [...scr.querySelectorAll('[data-count]')];
  els.forEach((el, i) => {
    const to = +el.dataset.count, kind = el.dataset.kind || 'int';
    const fmt = v => kind === 'money' ? money(v) : kind === 'plus' ? (v > 0 ? '+' : '') + money(v) : kind === 'minus' ? '−' + money(Math.abs(v)) : String(Math.round(v));
    if (RM) { el.textContent = fmt(to); return; }
    el.textContent = fmt(0);
    const t0 = performance.now() + 200 + i * 110, dur = 700;
    const step = () => {
      const u = Math.max(0, Math.min(1, (performance.now() - t0) / dur));
      el.textContent = fmt(to * (1 - Math.pow(1 - u, 3)));
      if (u < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ---------- экраны ---------- */
/* Что куплено: по id позиций магазина. Правило показа карточек — MENUAPI.isShopItemAvailable */
function shopState() { return { rank: G.rank, owned: Object.fromEntries(SHOP.map(i => [i.id, !!G[i.id]])) }; }
function showEvening(keep) {
  const s = D.stats; if (!keep) saveGame();
  const row = (a, v, kind, cls) => `<div class="rw"><span>${a}</span><b class="${cls || ''}" data-count="${v}" data-kind="${kind || 'int'}">${keep ? (kind === 'money' ? money(v) : kind === 'plus' ? (v > 0 ? '+' : '') + money(v) : kind === 'minus' ? '−' + money(Math.abs(v)) : v) : 0}</b></div>`;
  const shopNow = shopState(), avail = SHOP.filter(i => MENUAPI.isShopItemAvailable(i, shopNow));
  const tabs = SHOP_CATS.map(([id, n]) => `<button type="button" class="tab${id === shopTab ? ' on' : ''}" data-tab="${id}">${n}<em>${avail.filter(i => i.cat === id && !G[i.id]).length || '✓'}</em></button>`).join('');
  const shown = avail.filter(it => it.cat === shopTab);
  const items = (shown.length ? shown : []).map(it => {
    const owned = G[it.id], can = G.money >= it.cost, locked = (it.minDay && G.day < it.minDay) || (it.minRank && G.rank < it.minRank), lockTxt = it.minRank && G.rank < it.minRank ? 'Ранг ' + it.minRank : 'С дня ' + it.minDay;
    return `<div class="item${owned ? ' own' : ''}">${SHOP_ICON[it.id] || SHOP_ICON.machine}<div class="tx"><b>${it.name}</b><span>${it.desc}</span></div>${owned ? '<em class="stamp">Куплено</em>' : locked ? `<button type="button" class="buy" disabled>${lockTxt}</button>` : `<button type="button" class="buy" data-buy="${it.id}"${can ? '' : ' disabled'}>${money(it.cost)}</button>`}</div>`;
  }).join('') || '<p class="shopEmpty">Здесь пока нечего покупать. Новое появится с рангом.</p>';
  let st = ''; for (let i = 0; i < 5; i++) st += starSVG(G.rating >= i + .75 ? '#E8B04A' : G.rating >= i + .25 ? 'url(#gStarHalf)' : '#F3E4CB');
  const gap = MENUAPI.rankGap(G.rank, { day: G.day + 1, rating: G.rating, served: G.served });
  const ru = s.rankUp, nmA = ru ? MENUAPI.unlockedAt(ru.rank).drinks.map(d => d.name) : [], nm = nmA.slice(0, 3).join(', ') + (nmA.length > 3 ? ' и ещё ' + (nmA.length - 3) : '');
  const rankCard = ru ? `<div class="rankcard up"><b>Новый ранг: ${ru.title}</b><span>В книге рецептов новое: ${MENUAPI.unlockedAt(ru.rank).drinks.length} напитков, блюда и добавки${nm ? ' (' + nm + ')' : ''}</span>${s.shopNew ? `<span class="shopNew">${s.shopNew}</span>` : ''}</div>`
    : gap ? `<div class="rankcard"><b>Ранг ${G.rank}: ${MENUAPI.rankInfo(G.rank).title}</b><span>До «${gap.next.title}»: ${gap.missing.length ? gap.missing.join(', ') : 'завтра'}</span></div>` : `<div class="rankcard"><b>Высший ранг: ${MENUAPI.rankInfo(G.rank).title}</b></div>`;
  const note = G.day === 1 ? `<div class="note">Первый день позади. Деньги уходят на аренду, зерно и молоко, остальное можно вложить в улучшения. Они делают приготовление проще или точнее.</div>` : G.day === 3 ? `<div class="note">Три дня позади. Дальше клиентов станет больше, а помол будет «плавать» от погоды: следите за временем шота.</div>` : '';
  scr.innerHTML = `<div class="evening${keep ? ' still' : ''}"><div class="evh"><h2>День ${G.day} закончен</h2><div class="evstars">${st}<b>${G.rating.toFixed(1)}</b></div></div>
${G.buyNote ? `<div class="note newEq" role="status"><b>${G.buyNote}</b></div>` : ''}<div class="cols"><div class="receipt"><div class="rcTop">Чек дня</div>
${row('Подано', s.served)}${row('Идеальных', s.perfect)}${row('Ушли без кофе', s.lost, 'int', s.lost ? 'neg' : '')}<hr>${row('Выручка', s.revenue, 'money')}${row('Чаевые', s.tips, 'money')}${row('Зерно и молоко', s.costs, 'minus')}${row('Аренда', s.rent, 'minus')}
<div class="rcTot"><span>Итого за день</span><b class="${s.profit < 0 ? 'neg' : 'pos'}" data-count="${s.profit}" data-kind="plus">${keep ? (s.profit > 0 ? '+' : '') + money(s.profit) : 0}</b></div>
<div class="rw bal"><span>На счёте</span><b>${money(G.money)}</b></div></div>
<div class="shop"><div class="tabs">${tabs}</div><div class="grid">${items}</div></div></div>${rankCard}${note}
<div class="foot"><button type="button" class="ghost" data-book="evening">Книга рецептов</button><button type="button" class="big" data-next="1">День ${G.day + 1}</button></div></div>`;
  scr.hidden = false; if (!keep) countUp();
}
function showOver() {
  clearSave();
  scr.innerHTML = `<div class="title"><div class="sign closed"><i class="chain l"></i><i class="chain r"></i><div><h1>Закрыто</h1><p>кофейня отработала ${G.day} ${G.day === 1 ? 'день' : G.day < 5 ? 'дня' : 'дней'}</p></div></div>
<div class="paper"><p class="overtxt">На счёте ${money(G.money)}, а аренду платить нечем. Попробуйте ещё раз: в «Уютном» темпе клиенты терпеливее и банкротства нет.</p><div class="foot"><button type="button" class="big" data-restart="1">Начать заново</button></div></div></div>`;
  scr.hidden = false;
}
let bookTab = 'drinks', bookBack = null, bookFam = 'all', bookTut = '', bookSel = {}, bookExact = [];
/* модель напитка в карточке книги (только пилот Н1-2; остальные без картинки до Н2), масштаб один на все размеры, чтобы их можно было сравнить */
const bookArt = (id, size, cold) => { const r = MENUAPI.pilotRef(id, size, cold); return r ? WORLD.drinkArt(r, 1.15) : null; };
function showBook(back) {
  if (back) bookBack = back;
  scr.innerHTML = bookHTML({ art: bookArt, rank: G.rank, tab: bookTab, fam: bookFam, tut: bookTut, sel: bookSel, exact: bookExact, costs: Object.fromEntries(SHOP.map(i => [i.id.replace(/^eq_/, ''), i.cost])), avail: Object.fromEntries(SHOP.map(i => [i.id.replace(/^eq_/, ''), MENUAPI.isShopItemAvailable(i, shopState())])), eq: { milk: !!G.milk, ...Object.fromEntries(MENUAPI.EQUIPMENT.map(e => [e.id, !!G['eq_' + e.id]])) } }); scr.hidden = false;
}
/* перерисовать книгу, не сбросив прокрутку списка (переключатели размера, «Точные цифры») */
function bookRefresh() { const bb = scr.querySelector('.bookBody'), y = bb ? bb.scrollTop : 0; showBook(); const nb = scr.querySelector('.bookBody'); if (nb) nb.scrollTop = y; }
/* справочник: поиск по названию прячет остальные термины на месте */
scr.addEventListener('input', e => {
  const q = e.target.closest('[data-guideq]'); if (!q) return; const v = q.value.trim().toLowerCase();
  let any = false; scr.querySelectorAll('.gTerm').forEach(el => { const ok = !v || el.dataset.n.includes(v); el.hidden = !ok; any = any || ok; });
  scr.querySelectorAll('.gGroup').forEach(g => { g.hidden = !g.querySelector('.gTerm:not([hidden])'); });
  const em = scr.querySelector('.gEmpty'); if (em) em.hidden = any;
});
function closeBook() {
  const b = bookBack; bookBack = null;
  if (b === 'pause') setPause(true); else if (b === 'evening') showEvening(true); else if (b === 'title') showTitle(); else scr.hidden = true;
}
scr.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.pace) { selPace = t.dataset.pace; scr.querySelectorAll('.pace').forEach(b => b.classList.toggle('sel', b === t)); sndOk(); }
  else if (t.dataset.tab) { shopTab = t.dataset.tab; showEvening(true); sndTap(); }
  else if (t.dataset.buy) { const it = SHOP.find(x => x.id === t.dataset.buy); if (it && !G[it.id] && G.money >= it.cost) { const was = shopState(); G.money -= it.cost; G[it.id] = true; if (MENUAPI.hasOrderEffect(it.id)) G.fresh.push(it.id); G.buyNote = [MENUAPI.purchaseToast(it.id.replace(/^eq_/, '')), MENUAPI.shopNewText(MENUAPI.newlyAvailable(SHOP, was, shopState()).map(i => i.name))].filter(Boolean).join(' ') || null; applyUpgrades(); saveGame(); sndCoin(); lastHud = ''; updateHud(true); showEvening(true); } }
  else if (t.dataset.next) { G.buyNote = null; G.day++; saveGame(); startDay(); }
  else if (t.dataset.restart) { newGame(); lastHud = ''; updateHud(); showTitle(); }
  else if (t.dataset.resume) setPause(false);
  else if (t.dataset.book) { showBook(t.dataset.book); sndTap(); }
  else if (t.dataset.booktut) { const bb = scr.querySelector('.bookBody'), y = bb ? bb.scrollTop : 0; bookTut = bookTut === t.dataset.booktut ? '' : t.dataset.booktut; showBook(); const nb = scr.querySelector('.bookBody'); if (nb) nb.scrollTop = y; sndTap(); }
  else if (t.dataset.booksize) { const [id, z] = t.dataset.booksize.split('|'); bookSel[id] = { ...bookSel[id], size: z }; bookRefresh(); sndTap(); }
  else if (t.dataset.bookcold) { const [id, c] = t.dataset.bookcold.split('|'); bookSel[id] = { ...bookSel[id], cold: c === '1' }; bookRefresh(); sndTap(); }
  else if (t.dataset.bookexact) { const id = t.dataset.bookexact; bookExact = bookExact.includes(id) ? bookExact.filter(x => x !== id) : [...bookExact, id]; bookRefresh(); sndTap(); }
  else if (t.dataset.bookfam) { bookFam = t.dataset.bookfam; showBook(); sndTap(); }
  else if (t.dataset.booktab) { bookTab = t.dataset.booktab; showBook(); sndTap(); }
  else if (t.dataset.bookclose) { closeBook(); sndTap(); }
});

/* ---------- ввод ---------- */
$('#chPause').addEventListener('click', e => { setPause(!paused); e.currentTarget.blur(); });
$('#chSound').addEventListener('click', e => { toggleAllSound(); e.currentTarget.blur(); });
addEventListener('keydown', e => {
  MUSIC.unlock();
  if (CARDON && !paused) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) { e.preventDefault(); closeDrinkCard(); } return; }
  if (e.repeat) return;
  const c = e.code, mv = menuView();
  /* Б1-2: A/D и ←/→ листают бар (по event.code: работает на русской раскладке); стрелка-кнопка Enter/Space нажимается сама */
  const nb = e.target.closest && e.target.closest('.secNavBtn'); if (nb && (c === 'Enter' || c === 'Space')) { e.preventDefault(); nb.click(); return; }
  if ((c === 'KeyA' || c === 'ArrowLeft' || c === 'KeyD' || c === 'ArrowRight') && !e.ctrlKey && !e.altKey && !e.metaKey && !(e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) && camStep(c === 'KeyA' || c === 'ArrowLeft' ? -1 : 1)) { e.preventDefault(); return; }
  if (c === 'Escape' && menuBack()) { e.preventDefault(); return; }
  if (G && G.phase === 'day' && !paused) {
    if ((BR || c === 'Space') && barKey(c)) { e.preventDefault(); return; }
    if (c === 'Space') { e.preventDefault(); openNext(); }
  }
  if ((c === 'KeyP' || (c === 'Escape' && !(BR && stage.classList.contains('inbar')))) && (!mv || mv === 'pause')) setPause(!paused);
  if (c === 'KeyM') $('#chSound').click();
});
addEventListener('keyup', e => { if (e.code === 'Space' && G && G.phase === 'day' && !paused) { e.preventDefault(); barKeyUp(e.code); } });
addEventListener('pointerdown', () => { try { audioCtx(); sfxLoad(); } catch (x) { /* без звука */ } MUSIC.unlock(); });
addEventListener('pointerup', () => MUSIC.unlock());
/* режим клавиатуры: кольцо фокуса появляется после Tab или стрелок и гаснет при любом нажатии мышью или касании */
/* ←/→ в баре листают камеру и кольцо фокуса не включают (только Tab); пока листание не включено, всё как раньше */
addEventListener('keydown', e => { if (e.code === 'Tab' || (e.code.startsWith('Arrow') && !((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && sectionsPlayable() && BR && stage.classList.contains('inbar')))) document.documentElement.classList.add('kbd'); }, true);
addEventListener('pointerdown', () => document.documentElement.classList.remove('kbd'), true);
const autoPause = () => { if (G && G.phase === 'day' && !paused) setPause(true); };
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
addEventListener('blur', autoPause);

