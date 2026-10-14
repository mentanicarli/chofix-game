/* ---------- состояние ---------- */
function newGame() {
  G = { rank: 1, served: 0, money: 500, day: 1, rating: 3, pace: selPace, milk: false, machine: false, cozy: false, beans: false, phase: 'title', grindSet: 3, idealGrind: 3, hints: SET.hintsSet ? SET.hints : true, hintsTouched: SET.hintsSet, tutorialSeen: MENUAPI.freshSeen(), tutOff: false, fresh: [], syrups: false, stencil: false, grinderPro: false, tamper: false, thermo: false, wifi: false, cards: false, helper: false };
  D = null;
  WORLD.clearActors(); ACT.clear();
  applyUpgrades();
}
function holdSpec(kind) {
  if (kind === 'E') return G.machine ? { dur: 1.5, z: [.52, .74], ok: .10 } : { dur: 1.9, z: [.55, .69], ok: .08 };
  return { dur: 2.2, z: [.58, .76], ok: .08 };
}
function setTrack(id, kind) {
  const s = holdSpec(kind), t = $(id);
  const ok = t.querySelector('.zok'), go = t.querySelector('.zgo');
  ok.style.left = (s.z[0] - s.ok) * 100 + '%'; ok.style.width = (s.z[1] - s.z[0] + 2 * s.ok) * 100 + '%';
  go.style.left = s.z[0] * 100 + '%'; go.style.width = (s.z[1] - s.z[0]) * 100 + '%';
}
/* меню на доске: до четырёх последних открытых напитков, цены из меню */
function menuBoard() {
  const ids = MENUAPI.DRINKS.filter(d => MENUAPI.ENGINE[d.id] && d.rank <= G.rank && (G.milk || !MENUAPI.needsMilk(d)) && (MENUAPI.DRINK_NEEDS[d.id] || []).every(n => G['eq_' + n])).slice(-4);
  WORLD.setMenu(ids.map(d => ({ name: d.name, price: MENUAPI.priceOf(d.id) })));
}
function applyUpgrades() {
  menuBoard(); zonesSync();
  WORLD.setUpgrades({ milk: !!G.milk, machine: !!G.machine, cozy: !!G.cozy });
  WORLD.setBarUpgrades({ milk: !!G.milk, ice: !!G.eq_ice, eq: Object.fromEntries(['tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker'].map(k => [k, !!G['eq_' + k]])), snacks: !!G.eq_case_snacks, pastry: !!G.eq_case_pastry, dessert: !!G.eq_case_dessert, deli: !!G.eq_fridge_deli, micro: !!G.eq_microwave });
}
/* ---------- HUD ---------- */
function starSVG(fill) { return `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 15,9 22,9.5 16.5,14.5 18.5,22 12,18 5.5,22 7.5,14.5 2,9.5 9,9" fill="${fill}" stroke="#4A2F25" stroke-width="2" stroke-linejoin="round"/></svg>`; }
let lastHud = '';
function updateHud(bump) {
  const clockMin = D ? OPEN_MIN + Math.min(1, D.t / DAY_LEN) * SPAN_MIN : OPEN_MIN;
  const hh = String(Math.floor(clockMin / 60)).padStart(2, '0'), mm = String(Math.floor(clockMin % 60)).padStart(2, '0');
  const r = G.rating;
  const key = [G.day, hh + mm, Math.round(G.money), r.toFixed(2), D ? D.stats.served : 0].join('|');
  if (key === lastHud) return; lastHud = key;
  $('#chDay span').textContent = 'День ' + G.day;
  $('#chClock span').textContent = hh + ':' + mm;
  if (bump) { const cm = $('#chMoney'); cm.classList.remove('pulse'); void cm.offsetWidth; cm.classList.add('pulse'); }
  let st = ''; for (let i = 0; i < 5; i++) st += starSVG(r >= i + .75 ? '#E8B04A' : r >= i + .25 ? 'url(#gStarHalf)' : '#F3E4CB');
  $('#stars').innerHTML = st + `<b>${r.toFixed(1)}</b>`;
  $('#stars').setAttribute('aria-label', 'Рейтинг ' + r.toFixed(1) + ' из 5');
  $('#chServed span').textContent = D ? D.stats.served : 0;
}
function toast(msg, ms = 2400) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* Расход на ингредиенты (в песочнице может быть бесплатным) */
function spend(n) { if (SBX.free) return; D.stats.costs += n; G.money -= n; }
const drinkCost = (d, o) => MENUAPI.drinkCost(d, !!G.beans, o ? { size: o.size, cold: o.cold } : {});
/* Короткая подсказка поверх сцены */
function hint(msg) { toast(msg, 2200); }
function floatText(x, html, bad) {
  const f = document.createElement('div'); f.className = 'float' + (bad ? ' bad' : ''); f.innerHTML = html;
  f.style.left = x + 'px'; f.style.top = '230px'; stage.appendChild(f); setTimeout(() => f.remove(), 1400);
}

/* ---------- чашка ---------- */
const drinkOf = c => { if (!c) return null; if (c.drink) return c.drink; const s = c.steps.join(''); return s === 'E' ? 'espresso' : s === 'EW' ? 'americano' : s === 'EM' ? 'cappuccino' : null; };
const cupQ = c => Math.min(...c.q);
const QL = ['плохо', 'нормально', 'идеально'];
function renderCup() {
  const c = D && D.cup;
  if (!c) { WORLD.setHeld(null); return; }
  const d = drinkOf(c), q = cupQ(c);
  WORLD.setHeld({ k: c.k || 1, top: MENUAPI.isMenuKey(d) ? MENUAPI.topColorOf(d) : d === 'cappuccino' ? '#F1DFC2' : d === 'americano' ? '#8A5B3A' : '#5A3A2A', art: c.art || null, aq: c.aq || 0, star: q === 2 });
}

