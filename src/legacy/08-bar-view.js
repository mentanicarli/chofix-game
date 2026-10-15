/* Слои чашки для напитков нового ядра: то, что идёт под кофе/молоком, и пена сверху */
function xLayers(B, px) {
  const pal = MENUAPI.paletteOf(B.drink), rc = B.rc, list = [], top = [];
  let bobaH = 0;
  B.tasks.forEach(t => {
    const st = B.xs[t]; if (!st) return;
    if (t === 'juice') list.push({ col: pal.juice, h: st.ml * px });
    else if (t === 'tonic') list.push({ col: pal.tonic, h: st.ml * px });
    else if (t === 'brew') list.push({ col: pal.tea, h: Math.min(1, st.t / st.minutes) * (rc.tea ? rc.tea.waterMl : 120) * px });
    else if (t === 'whisk') list.push({ col: pal.matcha, h: st.t > 0 || B.done.whisk ? (rc.matcha ? rc.matcha.waterMl : 50) * px * (.5 + .5 * Math.min(1, st.t / st.target)) : 0 });
    else if (t === 'powder') list.push({ col: pal.powder, h: st.ml * px });
    else if (t === 'boba') bobaH = st.ml * px; /* шарики всегда на дне стакана, даже если их кладут после шейкера */
    else if (t === 'foam' || t === 'whip') top.push({ col: pal.foam, h: Math.min(1, st.t / st.target) * (rc.topFoam || 40) * px });
  });
  const h = list.reduce((a, x) => a + x.h, 0);
  return { list: list.filter(x => x.h > .2), h, bobaH, top, mix: !!(B.done.blend || B.done.shake), pal, topCol: null };
}
/* слои «нового ядра»: возвращает прямоугольники жидкости и новую высоту поверхности */
function paintX(B, XL, base, legH, topY, rects) {
  const hide = XL.mix, bh = XL.bobaH;
  if (bh > .2) rects.push({ y: 2 - bh, h: bh, col: '#3A2A24' });
  if (XL.mix) {
    const tot = XL.h + legH;
    rects.push({ y: 2 - bh - tot, h: tot, col: XL.pal.blend });
    topY = 2 - bh - tot; XL.topCol = XL.pal.blend;
  } else {
    let acc = 2 - bh;
    XL.list.slice(0, 4).forEach(l => { acc -= l.h; rects.push({ y: acc, h: l.h, col: l.col }); });
    if (!legH && XL.list.length) XL.topCol = XL.list[XL.list.length - 1].col;
  }
  const t = XL.top.length ? XL.top[0] : null;
  if (t && t.h > .3) { rects.push({ y: topY - t.h, h: t.h, col: t.col }); topY -= t.h; XL.topCol = t.col; }
  return { topY, hide };
}

/* ---------- прорисовка обзора: считаем кадр и отдаём его Pixi ---------- */
function barPaint(dt) {
  const B = BR; if (!B) return;
  /* Высота слоёв считается от объёма чашки этого заказа: 72 px внутри чашки = rc.cupMl мл (чашка сама масштабируется по объёму, см. WORLD.paintBar cupK) */
  const cup = B.cup, rc = B.rc, pxMl = 72 / rc.cupMl, XL = MENUAPI.isMenuKey(B.drink) ? xLayers(B, pxMl) : null, base = 2 - (XL ? XL.bobaH : 0) - (XL && !XL.mix ? XL.h : 0);
  const raf = rc.pitcherShot, pour = raf ? clamp(B.pourLevel || 0, 0, 1) : 1;
  /* у рафа эспрессо в питчере и попадает в чашку вместе со сливками при заливке */
  const sy = cup.pumps * 8 * pxMl, ey = raf ? 0 : cup.es * pxMl;
  const milkMl = cup.milk * (rc.cupMilk ? 1 + (rc.coldX || 0) : 1) + (raf ? B.pit.es * pour : 0);
  const wy = Math.max(cup.water * pxMl, milkMl * pxMl);
  /* пена: доля молока по шкале «Пена» (расширение x = пена / 1,1) */
  const fo = cup.milk > 0 && !rc.cupMilk ? cup.milk * (cup.foam / 1.1) * pxMl + 2 : 0;
  const rects = [];
  let topY = base - sy - ey - wy - fo, hide = false;
  const liqCol = raf && cup.milk > 0 ? mixC('#8A5B3A', '#C99B6E', .6) : cup.milk > 0 ? mixC('#8A5B3A', '#C99B6E', clamp(cup.milk / ((rc.milk || 120) * .6), 0, 1)) : '#8A5B3A';
  const std = [
    { y: base - sy, h: sy, col: B.syrId ? SYR[B.syrId].col : '#E8C766' },
    { y: base - sy - ey, h: ey, col: '#4A2E20' },
    { y: base - sy - ey - wy, h: wy, col: liqCol },
    { y: base - sy - ey - wy - fo, h: fo, col: '#F1DFC2' }
  ];
  if (XL) { const r = paintX(B, XL, base, sy + ey + wy + fo, topY, rects); topY = r.topY; hide = r.hide; }
  if (!hide) std.forEach(r => rects.push(r));
  const topCol = XL && XL.topCol ? XL.topCol : cup.milk > 0 ? mixC('#B07A4F', '#E9D2B2', clamp(cup.level, 0, 1)) : '#4A2E20';
  let art = null;
  if (cup.art && B.guide) {
    const pts = B.guide.filter((q, i) => i % 2 === 0).map(q => [(q.x - 220) * .34, topY + (q.y - 205) * .052]);
    art = { pts, alpha: .3 + .7 * (B.artQ || 0) };
  }
  const run = B.shot.st === 'run', now = performance.now();
  const ring = ringTarget();
  const k = rc.cupK || 1;
  /* раф: эспрессо льётся в питчер под группой, пока в него не налили сливки */
  const pitUnder = raf && B.pit.ml === 0 && !B.done.steam ? { level: clamp((B.pit.es || 0) / ((rc.shots || 1) * 30), 0, 1) } : null;
  WORLD.paintBar({
    pf: B.pf0, cof: B.dose > 2 && !B.done.shot,
    grindDeg: ((G.grindSet || 3) - 3) * 40, dose: B.dose,
    tamperUp: B.inset === 'tamp', cupK: k, pitUnder,
    ice: rc.ice ? clamp(cup.ice / rc.ice, 0, 1) : 0, rects, topY, topRx: 46 + (-topY) * .12, topCol, topOn: topY < -10, art,
    pitH: Math.min(74, (B.pit.ml + B.pit.es) / B.pitCap * 74 * 1.6),
    stream: run ? { y: 354, h: Math.max(8, (pitUnder ? 470 : 478 + topY * k) - 354), col: mixC('#4A2E20', '#C99B6E', clamp((B.shot.t - 14) / 24, 0, 1)) } : null,
    gaugeDeg: run ? 70 + Math.sin(now / 120) * 4 : B.inset === 'steam' ? 40 : -30,
    steam: B.inset === 'steam' && !!B.hold,
    bell: B.ready ? .06 * Math.sin(now / 140) : 0,
    ring: ring && (G.hints || tutKey()) ? { x: ring[0], y: ring[1], a: .7 + .3 * Math.sin(now / 260), s: 1 + .05 * Math.sin(now / 260) } : null
  });
}
function ringTarget() {
  const B = BR; if (!B || B.inset) return null;
  if (B.shot.st === 'run') return [740, 257];
  if (B.ready) return ZONE_POS.bell;
  if (B.pumps > 0 && !B.done.syrup) return null;
  const t = B.tasks.find(x => !B.done[x] && !blockMsg(x));
  if (!t) return null;
  return t === 'syrup' ? ZONE_POS[SYR[B.c.syrup].z] : ZONE_POS[MENUAPI.TASK_ZONE[t] || t];
}

/* ---------- тикет и подсказки ---------- */
const TCOL = { food: '#C98B5A', ice: '#9FC3C7', syrup: '#C99028', grind: '#8A5B3A', tamp: '#6B4C3D', shot: '#C4694A', water: '#7FA7AE', milk: '#9AA79A', steam: '#8FA58A', pour: '#C98B5A' };
const WHO = { regular: 'Преподаватель', student: 'Студент', hurry: 'Опаздывает на пару' };
/* Шаги билета: повторы цикла «помол, темпер, шот» (двойной эспрессо, 0.4 и 0.6 л) подписаны «Шот 1/2», «Шот 2/2» */
function ticketChips() {
  const B = BR, labels = MENUAPI.stepLabels(B.exp, B.c.order.id), tot = {}, seen = {};
  B.exp.forEach(t => { tot[t] = (tot[t] || 0) + 1; });
  return B.exp.map((t, i) => { const k = seen[t] || 0; seen[t] = k + 1; const rep = tot[t] > 1; return { t, label: labels[i], done: rep ? (k < B.shotIdx - 1 || (k === B.shotIdx - 1 && !!B.done[t])) : !!B.done[t], cur: !rep || k === B.shotIdx - 1 }; });
}
const sizeTxt = o => String(o.size).replace('.', ',') + ' л';
function drawTicket() {
  const B = BR; if (!B) { UI.tk.innerHTML = ''; return; }
  const c = B.c, f = Math.max(0, c.pat / c.max), cs = ticketChips();
  const key = [cs.map(x => (x.done ? 1 : 0)).join(''), tkOpen, B.shotIdx, B.inset, B.shot.st, B.ready, Math.round(f * 20), G.hints, B.pumps].join('|');
  if (key === tkKey) return; tkKey = key;
  const next = cs.find(x => x.cur && !x.done && !blockMsg(x.t));
  const o = c.order, multi = MENUAPI.drinkById[o.id] && Object.keys(MENUAPI.drinkById[o.id].sizes).length > 1;
  const tags = (multi && o.size !== '0.2' ? `<i style="background:#8FA58A">${sizeTxt(o)}</i>` : '') + (B.shots > 1 ? `<i style="background:#7A5A4A">${B.shots === 2 ? '2 шота' : B.shots + ' шотов'}</i>` : '') + (c.strong ? '<i style="background:#C4694A">крепкий</i>' : '') + (c.order && c.order.food ? `<i style="background:#C98B5A">${c.order.food.heat ? 'разогреть' : 'еда'}</i>` : '') + (c.syrup ? `<i style="background:${SYR[c.syrup].col};color:#4A2F25">${SYR[c.syrup].name.toLowerCase()} ×${c.pumps}</i>` : '');
  const chips = cs.map(x => `<button type="button" data-t="${x.t}" class="${x.done ? 'done' : x === next ? 'next' : !x.cur || blockMsg(x.t) ? 'lock' : ''}">${x.done ? '✓ ' : ''}${x.label}</button>`).join('<b>›</b>');
  const bar = f > .5 ? '#93A684' : f > .25 ? '#E8B04A' : '#C4694A';
  /* компактный билет (контракт раскладки, стайлгайд разд. 14): одна строка (гость, напиток, размер, текущий шаг); все шаги и реплика гостя раскрываются кнопкой и сворачиваются при открытии станции */
  if (B.inset) tkOpen = false;
  const cur = next || cs.find(x => x.cur && !x.done), nDone = cs.filter(x => x.done).length;
  const now = cur ? `<button type="button" data-t="${cur.t}" class="tkStep ${cur === next ? 'next' : 'lock'}">Шаг ${nDone + 1} из ${cs.length}: ${cur.label}</button>` : '<span class="tkStep ready">Готово: позвоните в звонок</span>';
  const ik = Math.round(44 * Math.min(1.15, B.rc.cupK || 1));
  UI.tk.innerHTML = `<div class="tkWho"><span>${WHO[c.type] || 'Гость'} · №${c.id}</span><div class="tkBar"><u style="width:${(f * 100).toFixed(0)}%;background:${bar}"></u></div></div>
<div class="tkMain"><svg class="tkIcon" viewBox="-30 -30 60 60" width="${ik}" height="${ik}" aria-hidden="true"><g stroke="#4A2F25" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${iconOf(B.drink)}</g></svg><b class="tkName">${NAME[B.drink]}</b>${tags}</div>
<div class="tkNow">${now}<button type="button" class="tkMore" data-tkmore="1" aria-expanded="${tkOpen}" title="Все шаги и реплика гостя">${tkOpen ? '▴' : '▾'}</button></div>
<div class="tkBtns"><button type="button" data-hint="1" class="${G.hints ? 'on' : ''}" title="Подсказки">?</button><button type="button" data-back="1" title="К залу (Tab)">К залу</button></div>${tkOpen ? `<div class="tkDrop"><div class="tkSay">«${c.order ? c.order.line : ''}»</div><div class="tkSteps${cs.length > 7 ? ' many' : ''}">${chips}</div></div>` : ''}`;
}
/* Подсказки новых станций и шагов (молоко, пар, заливка, сироп): пока не пройдены и пока игрок не выключил подсказки (настройкой или кнопкой «?») */
const tutOffNow = () => (SET.hintsSet && !SET.hints) || G.tutOff;
function tutCtx() {
  const B = BR, o = B.c.order, rc = B.rc;
  return { drinkId: o.id, drinkName: o.name, ml: rc.milk, foam: rc.foam, thermo: !!G.thermo, steam: !(/^iced/.test(B.drink) || rc.cupMilk), syrupName: B.c.syrup ? SYR[B.c.syrup].name : undefined, pumps: B.c.pumps, cream: !!rc.pitcherShot, shots: B.shots };
}
function tutKey() {
  const B = BR; if (!B || tutOffNow()) return null;
  const t = B.inset || B.tasks.find(x => !B.done[x] && !blockMsg(x));
  if (!t || B.done[t]) return null;
  return MENUAPI.nextTutorial(t, B.c.order.id, B.c.order.food, G.tutorialSeen, B.shots);
}
/* где игрок сейчас на шагах подсказки и что подсветить */
function tutLive(key) {
  const B = BR, p = B.pit, rc = B.rc;
  return MENUAPI.lessonStep(key, { ml: B.inset === 'milk' ? B.fill : p.ml, line: rc.milk, foam: p.foam, targetFoam: rc.foam, temp: p.T, thermo: !!G.thermo, zone: MENUAPI.steamZoneOf(B.c.order.id, !!G.thermo), started: !!B.started, pumps: B.pumps || 0, wantPumps: B.c.pumps, shotIdx: B.shotIdx }, { syrupKey: B.c.syrup });
}
function tutText(key) {
  const L = MENUAPI.lesson(key, tutCtx()); if (!L) return '';
  const head = `<span class="tutTag">${L.tag}</span>${L.title}. `;
  if (!BR.inset) return head + L.where;
  if (!L.paced) return head + '<br>' + MENUAPI.coachSteps(key);
  const st = tutLive(key).step;
  return head + `<br><b class="tutStep">Шаг ${st + 1} из ${L.steps.length}.</b> ${L.steps[st]}`;
}
const hlEl = $('#tutHl'); let hlKey = '';
/* подсветка кнопки в окне станции (координаты HIT совпадают с холстом 440×450 внутри рамки) */
function tutHl() {
  const key = BR && BR.inset && !paused ? tutKey() : null;
  const L = key && MENUAPI.lesson(key, tutCtx()), g = L && L.paced ? tutLive(key).glow : null;
  const h = g && HIT.find(x => x.id === g && !x.off);
  const k = h ? [h.x, h.y, h.w, h.h].join() : '';
  if (k === hlKey) return; hlKey = k;
  if (!h) { hlEl.hidden = true; return; }
  hlEl.style.cssText = `left:${19 + h.x}px;top:${205 + h.y}px;width:${h.w}px;height:${h.h}px`; hlEl.hidden = false;
}
function coachText() {
  const B = BR; if (!B) return '';
  const te = tutKey(); if (te) return tutText(te);
  const s = B.shot;
  const gr = u => String(u / 2).replace('.', ','), nth = B.shots > 1 ? ' (шот ' + B.shotIdx + ' из ' + B.shots + ')' : '';
  if (B.inset === 'grind') return G.day === 1 ? 'Держите «Молоть» (или Пробел), пока весы не покажут ' + gr(B.tgtDose) + ' г' + nth + '. Настройку помола не трогайте. Потом «Готово».' : 'Доза ' + gr(B.tgtDose) + ' г' + nth + '. Если шот выходит слишком быстро или долго, подкрутите помол.';
  if (B.inset === 'tamp') return B.tampPhase === 'level' ? 'Проведите мышью по кофе (зажав кнопку), чтобы выровнять. Ровная «таблетка» даёт ровный шот.' : 'Зажмите «Прессовать» и отпустите, когда стрелка в зелёной зоне (около 15 кг).';
  if (B.inset === 'shot') return !s.locked ? 'Вставьте портафильтр в группу.' : s.st === 'idle' ? 'Запустите шот' + nth + (B.rc.pitcherShot ? ' (он льётся в питчер)' : '') + '. Остановите, когда уровень дойдёт до линии, и посмотрите на время.' : 'Следите за линией! Остановить можно здесь, кнопкой на машине или Пробелом.';
  if (B.inset === 'food') return B.food && B.food.picked ? 'Разогрейте блюдо: держите кнопку и отпустите, когда шкала в зелёной зоне. Потом «Готово».' : 'Найдите на витрине блюдо, которое просил гость: «' + (B.c.order.food ? B.c.order.food.name : '') + '».';
  if (MENUAPI.PANEL_TASKS.has(B.inset)) return B.xv[B.inset] ? B.xv[B.inset].hint : '';
  if (B.inset === 'water') return 'Держите кнопку, пока вода не дойдёт до линии на чашке.';
  if (B.inset === 'ice') return 'Держите кнопку: лёд сыплется в чашку. Остановитесь у линии: ' + B.rc.ice + ' г.';
  if (B.inset === 'milk') return (B.rc.pitcherShot ? 'Налейте холодные сливки до линии: ' : 'Налейте молоко до линии: ') + B.rc.milk + ' мл. Лишнее можно вылить.';
  if (B.inset === 'steam') { const z = MENUAPI.steamZoneOf(B.c.order.id, !!G.thermo); return 'Зажмите мышь: пар включён. Трубка у самой поверхности добавляет пену, глубже греет. Остановите на ' + z[0] + ' – ' + z[1] + '°.'; }
  if (B.inset === 'pour') return 'Зажмите и ведите мышью по контуру над чашкой. Заливка заканчивается, когда питчер опустеет.';
  if (B.shot.st === 'run') return 'Шот идёт! Нажмите на машину или Пробел, когда уровень дойдёт до линии.';
  if (B.ready) return 'Всё готово. Нажмите на звонок, чтобы подать напиток.';
  if (B.inset === 'syrup') return 'Выберите бутылку: каждое нажатие это одна порция. Нужно: ' + (B.c.syrup ? SYR[B.c.syrup].name.toLowerCase() + ' ×' + B.c.pumps : '') + '. Потом «Готово».';
  const t = B.tasks.find(x => !B.done[x] && !blockMsg(x));
  return { syrup: `Клиент просил сироп: ${B.c.syrup ? SYR[B.c.syrup].name.toLowerCase() : ''} ×${B.c.pumps}. Нажмите на полку с сиропами и выберите бутылку: одно нажатие это одна порция.`, grind: 'Начнём с помола. Нажмите на кофемолку слева.', tamp: 'Молотый кофе нужно уплотнить. Нажмите на темпер.', shot: 'Теперь на кофемашину: вставить портафильтр и запустить шот.', water: 'Долейте воду (' + (B.rc.water || 0) + ' мл): нажмите на носик слева на машине.', milk: B.rc.pitcherShot ? 'Теперь холодные сливки: нажмите на холодильник.' : 'Пока кофе настаивается, займитесь молоком: нажмите на холодильник.', steam: 'Вспеньте молоко: нажмите на паровую трубку справа.', pour: 'Заливайте молоко в чашку: нажмите на чашку.' }[t] || '';
}
/* Коуч (Макс): реплика остаётся не короче max(4 с; длина / 12 симв./с) и меняется на новую, только когда прошла пауза ≥ 1,5 с после смены состояния (шаг выполнен); при нескольких сменах показывается последняя актуальная. Исключение: последний шаг пара («Остановите») показывается сразу, иначе подсказка придёт, когда молоко уже пригорит (зона 7°, нагрев 7°/с). «Повторить» показывает предыдущую реплику. */
const COACH = { br: null, clk: 0, text: '', key: '', shownAt: 0, wantKey: '', wantSince: 0, prev: '', rep: null, html: '' };
const COACH_PAUSE = 1.5, coachMin = html => Math.max(4, html.split('<br>').pop().replace(/<[^>]+>/g, '').length / 12); /* считаем сам текст шага, без постоянной шапки «Новый шаг · Название» */
const goalEl = $('#bGoal');
function drawCoach(dt) {
  const el = UI.coach, tk = BR && tutKey();
  if (!BR || (!G.hints && !tk)) { el.hidden = true; COACH.text = ''; COACH.html = ''; COACH.br = null; goalEl.hidden = true; return; }
  if (COACH.br !== BR) Object.assign(COACH, { br: BR, text: '', key: '', prev: '', rep: null, html: '', wantKey: '' });
  COACH.clk += dt || 0;
  const want = coachText(), wantKey = want + '|' + (tk || '');
  if (wantKey !== COACH.wantKey) { COACH.wantKey = wantKey; COACH.wantSince = COACH.clk; }
  const urgent = !!tk && tk.startsWith('step:steam:') && COACH.key.endsWith('|' + tk) && tutLive(tk).step >= 2;
  if (COACH.rep && (COACH.clk >= COACH.rep.until || urgent)) COACH.rep = null;
  if (!COACH.text) { COACH.text = want; COACH.key = wantKey; COACH.shownAt = COACH.clk; }
  else if (wantKey !== COACH.key) {
    const aged = COACH.clk - COACH.shownAt >= coachMin(COACH.text), calm = COACH.clk - COACH.wantSince >= COACH_PAUSE;
    if ((aged && calm) || urgent) { COACH.prev = COACH.text; COACH.text = want; COACH.key = wantKey; COACH.shownAt = COACH.clk; }
  }
  el.classList.toggle('compact', !!BR.inset);
  const shown = COACH.rep ? COACH.rep.html : COACH.text, skipKey = COACH.key.split('|')[1];
  const html = shown + '|' + (COACH.rep ? 'r' : '') + '|' + (COACH.prev ? 'p' : '') + '|' + (skipKey || '');
  if (html !== COACH.html) {
    COACH.html = html; el.hidden = false;
    el.innerHTML = `<i class="av">М</i><div><b>Макс, старший бариста${COACH.rep ? ' · повтор' : ''}</b><p>${shown}</p></div><div class="coachBtns"><button type="button" class="coachRep" data-coachrep="1" title="Показать предыдущую подсказку">Повторить</button>${skipKey ? `<button type="button" class="tutSkip" data-tutskip="${skipKey}">Пропустить</button>` : ''}</div>`;
  }
  /* цель текущего шага одной строкой над окном станции (стайлгайд, разд. 16): игрок не отводит взгляд от питчера и трубки */
  let goal = '';
  if (BR.inset && tk) { const L = MENUAPI.lesson(tk, tutCtx()); if (L && L.paced) goal = MENUAPI.lessonGoal(tk, tutCtx(), tutLive(tk).step) || ''; }
  if (goal) { if (goalEl.textContent !== 'Цель: ' + goal) goalEl.textContent = 'Цель: ' + goal; goalEl.hidden = false; } else goalEl.hidden = true;
}

/* ---------- прорисовка инсета ---------- */
const ICOL = { bg: '#FBF1DF', ink: '#4A2F25', soft: '#7A5A4A' };
function rrI(x, y, w, h, r) { bx.beginPath(); bx.roundRect(x, y, w, h, r); }
function tI(t, x, y, s, col, al, w) { bx.font = `${w || 800} ${s}px Nunito, sans-serif`; bx.textAlign = al || 'left'; bx.fillStyle = col || ICOL.ink; bx.fillText(t, x, y); }
function btnI(id, x, y, w, h, label, o = {}) {
  HIT.push({ id, x, y, w, h, hold: !!o.hold, off: !!o.off });
  const down = o.hold && BR.hold && !o.off;
  bx.save(); bx.lineWidth = 3; bx.strokeStyle = o.off ? '#9B8574' : ICOL.ink;
  rrI(x, y + (down ? 3 : 0), w, h, 14); bx.fillStyle = o.off ? '#E3D6C0' : (o.col || '#E8B04A'); if (!down) { bx.shadowColor = o.off ? '#9B8574' : ICOL.ink; bx.shadowOffsetY = 4; bx.shadowBlur = 0; } bx.fill(); bx.shadowColor = 'transparent'; bx.stroke();
  tI(label, x + w / 2, y + h / 2 + 7 + (down ? 3 : 0), o.size || 18, o.off ? '#9B8574' : ICOL.ink, 'center'); bx.restore();
}
function lineW(x1, y1, x2, y2, col, w) { bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.lineWidth = w || 3; bx.strokeStyle = col || ICOL.ink; bx.lineCap = 'round'; bx.stroke(); }
const SEED = Array.from({ length: 46 }, (_, i) => ({ a: (i * 2.399) % 6.283, r: Math.sqrt((i + .5) / 46) * 112, s: 8 + (i * 7 % 11), t: (i * 5) % 3 }));
/* Станции, уже перенесённые на Pixi (src/render). Остальные пока рисуются на canvas 2D. Отключить: #nopixi в адресе. */
const PX = new InsetRenderer(), bp = $('#bp'); let pxOn = false;
const PX_MODES = { ice: 1, syrup: 1, water: 1, milk: 1, grind: 1, tamp: 1, shot: 1, steam: 1, pour: 1 };
if (!location.hash.includes('nopixi')) PX.init(bp, location.hash.includes('pixi') && !location.hash.includes('nopixi')).catch(e => { console.warn('cuppable: Pixi недоступен, рисуем на canvas', e); });
function pxScene(B, m, title) {
  if (m === 'syrup') {
    const c = B.c, need = c.syrup ? SYR[c.syrup] : null;
    return { mode: 'syrup', title, view: { need: need ? 'Нужно: ' + need.name.toLowerCase() + ' ×' + c.pumps : '', list: Object.keys(SYR).filter(k => SYR[k].rank <= G.rank && (!SYR[k].recipe || k === c.syrup)).map(k => ({ key: k, short: SYR[k].short, col: SYR[k].col })), inCup: B.syrId ? { key: B.syrId, name: SYR[B.syrId].name } : null, pumps: B.pumps || 0 } };
  }
  if (m === 'grind') return { mode: m, title, view: { set: G.grindSet || 3, ideal: G.idealGrind || 3, pro: !!G.grinderPro, hold: !!B.hold, done: !!B.done.grind, dose: B.dose, target: B.tgtDose, now: performance.now() } };
  if (m === 'tamp') return { mode: m, title, view: { phase: B.tampPhase, press: B.tampP, uneven: B.uneven, hold: !!B.hold, mx: B.mx, my: B.my, wide: !!G.tamper, seeds: SEED } };
  if (m === 'shot') return { mode: m, title, view: { ml: B.shot.ml, t: B.shot.t, state: B.shot.st, locked: !!B.shot.locked, target: B.tgtMl, lastShot: B.shotNote ? B.shotNote.t : null, idx: B.shots > 1 ? B.shotIdx + '/' + B.shots : '', now: performance.now() } };
  if (m === 'steam') { const p = B.pit; return { mode: m, title, view: { ml: p.ml + p.es, foam: p.foam, coarse: p.coarse, temp: p.T, steamed: !!p.steamed, hold: !!B.hold, my: B.my, thermo: !!G.thermo, zone: MENUAPI.steamZoneOf(B.c.order.id, !!G.thermo), cap: B.pitCap, targetFoam: B.rc.foam, now: performance.now() } }; }
  if (m === 'pour') return { mode: m, title, view: { level: B.pourLevel, blobs: B.blobs, guide: (G.hints || G.stencil) ? (B.guide || guideFor(B.c.art)) : null, hold: !!B.hold, mx: B.mx, my: B.my, started: !!B.started } };
  const k = B.fillKind, tl = k === 'water' ? B.rc.total : k === 'ice' ? B.rc.ice : B.rc.milk;
  return { mode: m, title, view: { kind: k, ml: B.fill, espresso: B.cup.es, line: tl, holding: !!B.hold, label: k === 'water' ? 'Лить воду (держите)' : k === 'ice' ? 'Сыпать лёд (держите)' : B.rc.pitcherShot ? 'Лить сливки (держите)' : 'Лить молоко (держите)', now: performance.now() } };
}
function drawInset() {
  HIT = [];
  const B = BR, m = B && B.inset;
  if (!m) { pxOn = false; return; }
  if (m === 'food') { pxOn = false; bp.style.display = 'none'; renderFood(B); return; }
  if (MENUAPI.PANEL_TASKS.has(m)) { pxOn = false; bp.style.display = 'none'; xRender(B); return; }
  const title = { grind: 'Кофемолка', tamp: 'Темпер', shot: 'Группа кофемашины', water: B && B.drink === 'icedamericano' ? 'Холодная вода' : 'Горячая вода', ice: 'Льдогенератор', milk: B && (/^iced/.test(B.drink) || B.rc.cupMilk) ? 'Молоко в стакан' : B && B.rc.pitcherShot ? 'Сливки в питчер' : 'Молоко в питчер', syrup: 'Сиропы', steam: 'Паровая трубка', pour: 'Заливка и рисунок' }[m];
  pxOn = PX.ready && !!PX_MODES[m];
  if (pxOn) { const hits = PX.draw(pxScene(B, m, title)); if (hits) { HIT = hits; bi.style.opacity = 0; bp.style.display = 'block'; return; } pxOn = false; }
  bi.style.opacity = 1; bp.style.display = 'none';
  bx.clearRect(0, 0, IW, IH);
  bx.fillStyle = ICOL.bg; rrI(0, 0, IW, IH, 0); bx.fill();
  tI(title, 22, 38, 24); lineW(22, 50, IW - 70, 50, 'rgba(74,47,37,.25)', 2);
  if (m === 'grind') drawGrind(B); else if (m === 'tamp') drawTamp(B); else if (m === 'shot') drawShot(B); else if (m === 'water' || m === 'milk' || m === 'ice') drawFill(B); else if (m === 'syrup') drawSyrupI(B); else if (m === 'steam') drawSteam(B); else if (m === 'pour') drawPour(B);
}
function drawSyrupI(B) {
  const c = B.c, need = c.syrup ? SYR[c.syrup] : null;
  tI(need ? 'Нужно: ' + need.name.toLowerCase() + ' ×' + c.pumps : '', 22, 74, 17, ICOL.soft);
  const list = Object.keys(SYR).filter(k => SYR[k].rank <= G.rank && (!SYR[k].recipe || k === c.syrup)), cw = 120, ch = 44, gx = 22, gy = 90;
  list.forEach((k, i) => {
    const x = gx + (i % 3) * (cw + 8), y = gy + Math.floor(i / 3) * (ch + 6), on = B.syrId === k && B.pumps > 0;
    HIT.push({ id: 'syr:' + k, x, y, w: cw, h: ch, hold: false, off: false });
    bx.save(); bx.lineWidth = on ? 4 : 3; bx.strokeStyle = ICOL.ink; rrI(x, y, cw, ch, 12); bx.fillStyle = on ? '#F8E3B5' : '#FFF8EC'; bx.fill(); bx.stroke();
    bx.beginPath(); bx.arc(x + 21, y + ch / 2, 12, 0, 7); bx.fillStyle = SYR[k].col; bx.fill(); bx.lineWidth = 2.5; bx.stroke();
    tI(SYR[k].short, x + 40, y + ch / 2 + 5, 14, ICOL.ink); bx.restore();
  });
  const n = B.pumps || 0;
  tI(n ? 'В чашке: ' + SYR[B.syrId].name.toLowerCase() + ' ×' + n : 'Нажмите на бутылку: одно нажатие — одна порция', 22, 372, 15, ICOL.ink);
  btnI('syrDump', 22, 384, 118, 48, 'Вылить', { size: 16, col: '#F0B3A0', off: !n });
  btnI('syrDone', 296, 384, 122, 48, 'Готово', { col: '#B9CAA9', off: !n });
}
function drawGrind(B) {
  const set = G.grindSet || 3, ideal = G.idealGrind || 3;
  /* диск настройки */
  bx.save(); bx.translate(106, 150); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink; bx.beginPath(); bx.arc(0, 0, 58, 0, 7); bx.fillStyle = '#F3E4CB'; bx.fill(); bx.stroke();
  for (let i = 1; i <= 5; i++) { const a = (-120 + (i - 1) * 60) * Math.PI / 180 - Math.PI / 2 + Math.PI / 2; const x = Math.sin(a + 0) * 0, y = 0; const ang = (-100 + (i - 1) * 50) * Math.PI / 180; lineW(Math.sin(ang) * 44, -Math.cos(ang) * 44, Math.sin(ang) * 54, -Math.cos(ang) * 54, ICOL.ink, i === set ? 5 : 2.5); }
  const ang = (-100 + (set - 1) * 50) * Math.PI / 180; bx.beginPath(); bx.arc(0, 0, 30, 0, 7); bx.fillStyle = '#E8B04A'; bx.fill(); bx.stroke(); lineW(Math.sin(ang) * 21, -Math.cos(ang) * 21, Math.sin(ang) * 29, -Math.cos(ang) * 29, ICOL.ink, 4);
  tI(String(set), 0, 10, 28, ICOL.ink, 'center'); bx.restore();
  tI('Помол', 106, 232, 14, ICOL.soft, 'center'); tI('мельче', 44, 252, 13, ICOL.soft, 'center'); tI('крупнее', 168, 252, 13, ICOL.soft, 'center');
  btnI('dialL', 30, 262, 52, 38, '◀', { col: '#F3E4CB' }); btnI('dialR', 130, 262, 52, 38, '▶', { col: '#F3E4CB' });
  if (G.grinderPro) tI('Рекомендуем: ' + ideal, 106, 318, 14, '#4F7A3E', 'center');
  /* портафильтр и горка */
  bx.save(); bx.translate(296, 0); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink; bx.lineJoin = 'round';
  bx.beginPath(); bx.moveTo(-34, 66); bx.lineTo(34, 66); bx.lineTo(14, 128); bx.lineTo(-14, 128); bx.closePath(); bx.fillStyle = '#C9C8C0'; bx.fill(); bx.stroke();
  rrI(-12, 126, 24, 22, 5); bx.fillStyle = '#B9B9B2'; bx.fill(); bx.stroke();
  if (B.hold && !B.done.grind) { bx.strokeStyle = '#6B4331'; bx.setLineDash([4, 5]); bx.lineDashOffset = -performance.now() / 40; bx.lineWidth = 6; bx.beginPath(); bx.moveTo(0, 148); bx.lineTo(0, 200 - Math.min(70, B.dose * 2.4)); bx.stroke(); bx.setLineDash([]); bx.strokeStyle = ICOL.ink; bx.lineWidth = 3; }
  bx.beginPath(); bx.moveTo(-56, 202); bx.lineTo(56, 202); bx.lineTo(44, 240); bx.lineTo(-44, 240); bx.closePath(); bx.fillStyle = '#C9C8C0'; bx.fill(); bx.stroke();
  const hh = Math.min(64, B.dose * 2.2); bx.beginPath(); bx.moveTo(-50, 202); bx.quadraticCurveTo(0, 202 - hh * 1.6, 50, 202); bx.fillStyle = '#6B4331'; bx.fill(); bx.stroke();
  lineW(54, 218, 112, 228, ICOL.ink, 14); lineW(54, 218, 112, 228, '#6B4C3D', 8);
  bx.restore();
  /* весы */
  const e = Math.abs(B.dose - B.tgtDose), col = e <= .5 ? '#7BC46A' : e <= 1.5 ? '#E8B04A' : '#E0745A';
  rrI(220, 252, 190, 54, 12); bx.fillStyle = '#2F2A27'; bx.fill(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink; bx.stroke();
  tI(f1(B.dose / 2) + ' г', 396, 292, 32, col, 'right'); tI('цель ' + String(B.tgtDose / 2).replace('.', ','), 236, 290, 14, '#BFB5A5');
  if (B.dose > B.tgtDose + 1.6 && !B.done.grind) btnI('dump', 220, 312, 190, 30, 'Высыпать (−₽ 5)', { size: 14, col: '#F0B3A0' });
  btnI('grindHold', 30, 356, 250, 56, 'Молоть (держите)', { hold: true, col: '#C98B5A' });
  btnI('grindDone', 296, 356, 114, 56, 'Готово', { col: '#B9CAA9' });
}
function drawTamp(B) {
  const cx0 = 220, cy0 = 190;
  bx.save(); bx.translate(cx0, cy0);
  bx.beginPath(); bx.arc(0, 0, 126, 0, 7); bx.fillStyle = '#BFC4C2'; bx.fill(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink; bx.stroke();
  bx.beginPath(); bx.arc(0, 0, 112, 0, 7); bx.fillStyle = B.tampPhase === 'press' && B.tampP > 4 ? '#4A2E20' : '#5A3A2A'; bx.fill();
  if (B.tampPhase === 'level') { bx.save(); bx.clip(); SEED.forEach(s => { const x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r; bx.fillStyle = s.t === 0 ? `rgba(120,80,56,${B.uneven * .9})` : s.t === 1 ? `rgba(36,20,14,${B.uneven * .8})` : `rgba(156,110,78,${B.uneven * .7})`; bx.beginPath(); bx.arc(x, y, s.s * (.4 + B.uneven * .6), 0, 7); bx.fill(); }); bx.restore(); }
  else { bx.beginPath(); bx.arc(0, 0, 100, 0, 7); bx.strokeStyle = 'rgba(255,255,255,.12)'; bx.lineWidth = 4; bx.stroke(); }
  bx.restore();
  if (B.tampPhase === 'level') {
    rrI(60, 336, 320, 14, 7); bx.fillStyle = '#E7D6BC'; bx.fill(); bx.lineWidth = 2.5; bx.strokeStyle = ICOL.ink; bx.stroke();
    rrI(60, 336, Math.max(14, 320 * (1 - B.uneven)), 14, 7); bx.fillStyle = '#93A684'; bx.fill(); bx.stroke();
    tI('Ровность кофе', 60, 330, 14, ICOL.soft);
    if (B.hold) { bx.beginPath(); bx.arc(B.mx, B.my, 14, 0, 7); bx.strokeStyle = 'rgba(255,248,236,.9)'; bx.lineWidth = 3; bx.stroke(); }
    tI('Зажмите и водите мышью по кофе', IW / 2, 392, 17, ICOL.soft, 'center', 700);
  } else {
    /* темпер сверху */
    const P = B.tampP, lift = Math.max(0, 40 - P * 2.6);
    bx.save(); bx.translate(cx0, cy0 - lift * .0);
    bx.beginPath(); bx.arc(0, 0, 74 + (P > 0 ? 6 : 0) - P * .4, 0, 7); bx.fillStyle = 'rgba(190,196,194,.92)'; bx.fill(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink; bx.stroke();
    bx.beginPath(); bx.arc(0, 0, 26, 0, 7); bx.fillStyle = '#3F3A36'; bx.fill(); bx.stroke(); bx.restore();
    /* шкала */
    const gx = 398, gy0 = 80, gh = 232; rrI(gx - 12, gy0, 24, gh, 12); bx.fillStyle = '#E7D6BC'; bx.fill(); bx.stroke();
    const y = v => gy0 + gh - v / 32 * gh, zw = G.tamper ? 5 : 3.5; rrI(gx - 12, y(15 + zw), 24, y(15 - zw) - y(15 + zw), 6); bx.fillStyle = '#93A684'; bx.fill(); bx.stroke();
    lineW(gx - 22, y(P), gx + 22, y(P), '#C4694A', 5); tI(Math.round(P) + ' кг', gx, gy0 + gh + 24, 16, ICOL.ink, 'center');
    btnI('tampHold', 30, 356, 360, 56, 'Прессовать (держите)', { hold: true, col: '#C98B5A' });
  }
}
function drawShot(B) {
  const s = B.shot, tgt = B.tgtMl;
  /* стакан */
  const gx = 110, gy = 96, gw = 100, gh = 220, my = ml => gy + gh - ml / 54 * gh;
  bx.save(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink;
  bx.beginPath(); bx.moveTo(gx, gy); bx.lineTo(gx + gw, gy); bx.lineTo(gx + gw - 8, gy + gh); bx.lineTo(gx + 8, gy + gh); bx.closePath(); bx.fillStyle = 'rgba(214,232,230,.55)'; bx.fill();
  if (s.ml > 0) { bx.save(); bx.clip(); bx.fillStyle = mixC('#4A2E20', '#C99B6E', clamp((s.t - 14) / 24, 0, 1)); bx.fillRect(gx, my(s.ml), gw, gy + gh - my(s.ml)); bx.fillStyle = '#B07A4F'; bx.fillRect(gx, my(s.ml), gw, 7); bx.restore(); }
  bx.beginPath(); bx.moveTo(gx, gy); bx.lineTo(gx + gw, gy); bx.lineTo(gx + gw - 8, gy + gh); bx.lineTo(gx + 8, gy + gh); bx.closePath(); bx.stroke();
  if (s.st === 'run') { bx.strokeStyle = '#5A3A2A'; bx.lineWidth = 5; bx.setLineDash([5, 5]); bx.lineDashOffset = -performance.now() / 30; bx.beginPath(); bx.moveTo(gx + gw / 2, 60); bx.lineTo(gx + gw / 2, my(s.ml)); bx.stroke(); bx.setLineDash([]); }
  rrI(gx + gw / 2 - 20, 54, 40, 14, 5); bx.fillStyle = '#B9B9B2'; bx.fill(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink; bx.stroke();
  bx.restore();
  /* линия цели */
  const ty = my(tgt); bx.save(); bx.setLineDash([8, 6]); lineW(gx - 18, ty, gx + gw + 18, ty, '#C4694A', 3.5); bx.restore(); tI(tgt + ' мл', gx - 22, ty + 5, 15, '#C4694A', 'right');
  /* время */
  tI(f1(s.t) + ' с', 396, 128, 40, ICOL.ink, 'right'); tI(Math.round(s.ml) + ' мл', 396, 160, 22, ICOL.soft, 'right'); if (B.shots > 1) tI('Шот ' + B.shotIdx + '/' + B.shots, 396, 100, 18, ICOL.soft, 'right');
  const bx0 = 250, bw = 150; rrI(bx0, 186, bw, 16, 8); bx.fillStyle = '#E7D6BC'; bx.fill(); bx.lineWidth = 2.5; bx.strokeStyle = ICOL.ink; bx.stroke();
  const tx = t => bx0 + clamp(t / 45, 0, 1) * bw; rrI(tx(24), 186, tx(33) - tx(24), 16, 4); bx.fillStyle = '#93A684'; bx.fill(); bx.stroke(); lineW(tx(s.t), 180, tx(s.t), 208, '#C4694A', 4);
  tI('идеальное время 24–33 с', 400, 226, 13, ICOL.soft, 'right');
  const nt = B.shotNote; if (nt) tI('Прошлый шот: ' + Math.round(nt.t) + ' с', 400, 250, 13, ICOL.soft, 'right');
  if (!s.locked) btnI('lock', 30, 356, 380, 56, 'Вставить портафильтр', { col: '#C98B5A' });
  else if (s.st === 'idle') btnI('go', 30, 356, 380, 56, 'Запустить шот (Пробел)', { col: '#93A684' });
  else if (s.st === 'run') btnI('stopShot', 30, 356, 380, 56, 'Остановить шот (Пробел)', { col: '#E0745A' });
}
function drawFill(B) {
  const k = B.fillKind, tl0 = k === 'water' ? B.rc.total : k === 'ice' ? B.rc.ice : B.rc.milk, cap = k === 'milk' ? Math.max(330, tl0 * 1.3) : Math.max(200, tl0 * 1.35), ml = B.fill, gx = 90, gy = 80, gw = 140, gh = 250, my = v => gy + gh - v / cap * gh;
  bx.save(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink;
  bx.beginPath(); bx.moveTo(gx, gy); bx.lineTo(gx + gw, gy); bx.lineTo(gx + gw - 14, gy + gh); bx.lineTo(gx + 14, gy + gh); bx.closePath(); bx.fillStyle = k === 'milk' ? 'rgba(200,200,194,.5)' : '#FFF8EC'; bx.fill();
  bx.save(); bx.clip();
  if (k === 'water') { const es = B.cup.es; bx.fillStyle = '#4A2E20'; bx.fillRect(gx, my(es), gw, gy + gh - my(es)); bx.fillStyle = '#8A5B3A'; bx.fillRect(gx, my(es + ml), gw, my(es) - my(es + ml)); }
  else if (k === 'ice') { bx.fillStyle = '#DCEEF1'; bx.fillRect(gx, my(ml), gw, gy + gh - my(ml)); }
  else { bx.fillStyle = '#FBF4E8'; bx.fillRect(gx, my(ml), gw, gy + gh - my(ml)); }
  bx.restore(); bx.beginPath(); bx.moveTo(gx, gy); bx.lineTo(gx + gw, gy); bx.lineTo(gx + gw - 14, gy + gh); bx.lineTo(gx + 14, gy + gh); bx.closePath(); bx.stroke();
  if (k === 'milk') { lineW(gx + gw, gy + 30, gx + gw + 44, gy + 30, ICOL.ink, 5); }
  if (B.hold) { bx.strokeStyle = k === 'milk' ? '#FBF4E8' : k === 'ice' ? '#CFE6EA' : '#9FC3C7'; bx.lineWidth = 7; bx.setLineDash([6, 5]); bx.lineDashOffset = -performance.now() / 25; bx.beginPath(); bx.moveTo(gx + gw / 2, 54); bx.lineTo(gx + gw / 2, my(k === 'water' ? B.cup.es + ml : ml)); bx.stroke(); bx.setLineDash([]); }
  bx.restore();
  const tl = k === 'water' ? B.rc.total : k === 'ice' ? B.rc.ice : B.rc.milk;
  const ty = my(tl); bx.save(); bx.setLineDash([8, 6]); lineW(gx - 14, ty, gx + gw + 14, ty, '#C4694A', 3.5); bx.restore(); tI('линия', gx - 18, ty + 5, 14, '#C4694A', 'right');
  const shown = k === 'water' ? B.cup.es + ml : ml;
  const unit = k === 'ice' ? ' г' : ' мл'; tI(Math.round(shown) + unit, 396, 140, 38, ICOL.ink, 'right'); tI('нужно ' + Math.round(tl) + unit, 396, 168, 17, ICOL.soft, 'right');
  if (k === 'milk') btnI('fillDump', 270, 200, 130, 34, 'Вылить', { size: 15, col: '#F0B3A0' });
  btnI('fillHold', 30, 356, 250, 56, k === 'water' ? 'Лить воду (держите)' : k === 'ice' ? 'Сыпать лёд (держите)' : B.rc.pitcherShot ? 'Лить сливки (держите)' : 'Лить молоко (держите)', { hold: true, col: k === 'water' || k === 'ice' ? '#9FC3C7' : '#C98B5A', size: 17 });
  btnI('fillDone', 296, 356, 114, 56, 'Готово', { col: '#B9CAA9' });
}
function drawSteam(B) {
  const p = B.pit, cap = B.pitCap, vol = ((p.ml + p.es) * (1 + .6 * p.foam)) / cap, surf = 330 - vol * 220, mil = 330 - ((p.ml + p.es) / cap) * 220;
  const px = 62, pw = 150;
  bx.save(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink; bx.lineJoin = 'round';
  /* ручка */
  bx.beginPath(); bx.moveTo(px + pw - 2, 128); bx.bezierCurveTo(px + pw + 46, 128, px + pw + 40, 230, px + pw - 8, 236); bx.lineWidth = 9; bx.strokeStyle = ICOL.ink; bx.stroke(); bx.lineWidth = 4; bx.strokeStyle = '#C9C8C0'; bx.stroke(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink;
  bx.beginPath(); bx.moveTo(px, 110); bx.lineTo(px + pw, 110); bx.lineTo(px + pw - 12, 332); bx.lineTo(px + 12, 332); bx.closePath(); bx.fillStyle = '#E4E2DA'; bx.fill();
  bx.save(); bx.clip(); bx.fillStyle = '#FBF4E8'; bx.fillRect(px, mil, pw, 340 - mil); bx.fillStyle = '#FFFFFF'; bx.fillRect(px, surf, pw, mil - surf);
  for (let i = 0; i < 20 && p.coarse > .3; i++) { bx.beginPath(); bx.arc(px + 10 + (i * 37) % (pw - 20), surf + 2 + (i * 11) % Math.max(4, mil - surf), 2 + p.coarse * 3, 0, 7); bx.strokeStyle = 'rgba(74,47,37,.25)'; bx.lineWidth = 1.5; bx.stroke(); }
  bx.fillStyle = 'rgba(232,176,74,.3)'; bx.fillRect(px, surf, pw, 16);
  bx.restore(); bx.strokeStyle = ICOL.ink; bx.lineWidth = 3;
  bx.beginPath(); bx.moveTo(px, 110); bx.lineTo(px + pw, 110); bx.lineTo(px + pw - 12, 332); bx.lineTo(px + 12, 332); bx.closePath(); bx.stroke();
  /* трубка */
  const tipY = clamp(B.my, 70, 326), depth = tipY - surf, wx = px + pw - 34;
  lineW(wx, 62, wx, tipY, '#4A2F25', 12); lineW(wx, 62, wx, tipY, '#BFC4C2', 6); bx.beginPath(); bx.arc(wx, tipY, 6, 0, 7); bx.fillStyle = '#BFC4C2'; bx.fill(); bx.lineWidth = 2.5; bx.stroke();
  if (B.hold && !p.steamed) { for (let i = 0; i < 6; i++) { const a = performance.now() / 130 + i; bx.beginPath(); bx.arc(wx + Math.sin(a * 1.7) * 14, tipY + 6 + ((a * 9) % 22), 2.4, 0, 7); bx.fillStyle = 'rgba(255,248,236,.9)'; bx.fill(); } }
  bx.restore();
  const state = !B.hold ? 'пар выключен' : depth < 0 ? 'брызги: опустите ниже' : depth <= 16 ? 'воздух: пена растёт' : 'прогрев';
  tI(state, 22, 80, 15, depth < 0 && B.hold ? '#C4694A' : ICOL.soft, 'left');
  /* термометр */
  const tx0 = 330, ty0 = 80, th = 240, yT = v => ty0 + th - v / 90 * th;
  rrI(tx0 - 11, ty0, 22, th, 11); bx.fillStyle = '#E7D6BC'; bx.fill(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink; bx.stroke();
  const zn = MENUAPI.steamZoneOf(B.c.order.id, !!G.thermo), hi = zn[1], lo = zn[0]; rrI(tx0 - 11, yT(hi), 22, yT(lo) - yT(hi), 5); bx.fillStyle = '#93A684'; bx.fill(); bx.stroke();
  rrI(tx0 - 7, yT(p.T), 14, ty0 + th - yT(p.T), 6); bx.fillStyle = p.T > hi ? '#E0745A' : '#C4694A'; bx.fill();
  tI(Math.round(p.T) + '°', tx0, ty0 + th + 26, 20, ICOL.ink, 'center');
  /* пена */
  const tf = B.rc.foam, fx0 = 30, fw = 230; tI('Пена', 30, 352, 14, ICOL.soft);
  rrI(fx0, 358, fw, 14, 7); bx.fillStyle = '#E7D6BC'; bx.fill(); bx.lineWidth = 2.5; bx.strokeStyle = ICOL.ink; bx.stroke();
  rrI(fx0 + (tf - .12) * fw, 358, .24 * fw, 14, 4); bx.fillStyle = '#93A684'; bx.fill(); bx.stroke(); rrI(fx0, 358, Math.max(8, p.foam * fw), 14, 7); bx.fillStyle = 'rgba(255,255,255,.85)'; bx.fill(); bx.stroke();
  btnI('steamDone', 296, 384, 114, 52, 'Готово', { col: '#B9CAA9' });
  tI('Мышь ↕ глубина, зажмите: пар', 30, 412, 14, ICOL.soft, 'left', 700);
}
function drawPour(B) {
  const cx0 = 220, cy0 = 205;
  bx.save(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink;
  bx.beginPath(); bx.arc(cx0, cy0 + 7, 144, 0, 7); bx.fillStyle = 'rgba(74,47,37,.15)'; bx.fill();
  bx.beginPath(); bx.arc(cx0, cy0, 140, 0, 7); bx.fillStyle = '#FFF8EC'; bx.fill(); bx.stroke();
  bx.beginPath(); bx.arc(cx0, cy0, 128, 0, 7); bx.fillStyle = mixC('#9C6B45', '#C99B6E', clamp(B.pourLevel, 0, 1)); bx.fill(); bx.stroke();
  bx.save(); bx.beginPath(); bx.arc(cx0, cy0, 127, 0, 7); bx.clip();
  B.blobs.forEach(b => { bx.beginPath(); bx.arc(b.x, b.y, b.r, 0, 7); bx.fillStyle = `rgba(253,248,238,${(b.a * .55).toFixed(2)})`; bx.fill(); });
  bx.restore();
  if (G.hints || G.stencil) { const g = B.guide || guideFor(B.c.art); bx.setLineDash([5, 7]); bx.beginPath(); g.forEach((q, i) => i ? bx.lineTo(q.x, q.y) : bx.moveTo(q.x, q.y)); bx.strokeStyle = 'rgba(74,47,37,.35)'; bx.lineWidth = 2.5; bx.stroke(); bx.setLineDash([]); }
  if (B.hold) { bx.save(); bx.translate(B.mx + 6, B.my - 40); bx.rotate(.5); bx.beginPath(); bx.moveTo(-26, -34); bx.lineTo(26, -34); bx.lineTo(20, 20); bx.lineTo(-20, 20); bx.closePath(); bx.fillStyle = '#C9C8C0'; bx.fill(); bx.lineWidth = 3; bx.strokeStyle = ICOL.ink; bx.stroke(); bx.restore(); }
  bx.restore();
  const lv = B.pourLevel;
  tI('Чашка', 30, 372, 14, ICOL.soft);
  rrI(30, 380, 250, 12, 6); bx.fillStyle = '#E7D6BC'; bx.fill(); bx.lineWidth = 2.5; bx.strokeStyle = ICOL.ink; bx.stroke();
  rrI(30, 380, Math.max(10, 250 * lv), 12, 6); bx.fillStyle = '#C9A982'; bx.fill(); bx.stroke();
  tI(B.started ? 'Ведите по контуру' : 'Зажмите мышь над чашкой', 30, 424, 15, ICOL.soft, 'left', 700);
  btnI('pourDone', 296, 366, 114, 56, 'Готово', { col: '#B9CAA9' });
}

