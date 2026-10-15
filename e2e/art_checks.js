/* Систематические проверки графики и вёрстки (инструмент аудита, не тест). Игру не меняет.
   Нужна ОТЛАДОЧНАЯ сборка (CUPPABLE_DEBUG=1, см. CLAUDE.md).
   node e2e/art_checks.js dist/artifact.html out/art-audit/sys [overlap,panels,cups,texts,recog] [sizes]
   sizes: 1280x720,1366x768,1536x864,1920x1080,1024x600 (по умолчанию все пять; для быстрого прогона: SIZES=1280x720)
   overlap — наложения текстов, обрезка и «вылезание», кликабельность (elementFromPoint) в каждом состоянии на каждом размере;
   panels — то же только для панелей станций (входит в overlap); cups — модель налива по данным и пиксельная проверка;
   texts — автоскрывающиеся тексты (символов в секунду) и перечень подписей; recog — крупные планы для оценки узнаваемости.
   Результат: JSON и PNG в указанной папке. */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'out/art-audit/sys'); fs.mkdirSync(out, { recursive: true });
const parts = (process.argv[4] || 'overlap,cups,texts,recog').split(',');
const SIZES = (process.env.SIZES || process.argv[5] || '1280x720,1366x768,1536x864,1920x1080,1024x600').split(',').map(s => s.split('x').map(Number));
const on = k => parts.includes(k);
const MIN_OVERLAP = +(process.env.MIN_OVERLAP || 150); /* px² в координатах сцены 1280×720 */

/* ----- код, выполняемый на странице ----- */
function pageCollect() {
  const st = document.querySelector('#stage').getBoundingClientRect(), s = st.width / 1280;
  const toStage = r => ({ x: (r.left - st.left) / s, y: (r.top - st.top) / s, w: r.width / s, h: r.height / s });
  const BLOCKS = ['hud', 'bTk', 'bCoach', 'xPanel', 'bi', 'foodPanel', 'toast', 'banner', 'bFloat', 'drinkCard', 'frontHint', 'helperChip', 'screen', 'bClose', 'tutHl'];
  const blockOf = el => { for (let e = el; e && e.id !== 'stage'; e = e.parentElement) { if (e.id && BLOCKS.includes(e.id)) return e.id; if (e.classList && (e.classList.contains('say') || e.classList.contains('float'))) return e.classList.contains('say') ? 'say' : 'float'; } return 'other'; };
  const vis = el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; for (let e = el.parentElement; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; } const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const items = [], inter = [];
  const clipper = el => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflow + getComputedStyle(e).overflowY; if (/hidden|clip/.test(o) && e.id !== 'stage') { return e; } } return null; };
  const desc = e => e ? (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')) : 'null';
  document.querySelectorAll('#stage *').forEach(el => {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'rect') return;
    if (el.closest('#world') && el.id !== 'world') return;
    if (!vis(el)) return;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const r = el.getBoundingClientRect();
    const rec = { id: desc(el), block: blockOf(el), text: own ? el.textContent.trim().slice(0, 50) : '', ...toStage(r), cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    const cl = clipper(el);
    if (cl) { const c = cl.getBoundingClientRect(); const d = Math.max(0, r.bottom - c.bottom, c.top - r.top, r.right - c.right, c.left - r.left); if (d > 1.5) rec.clipped = { by: desc(cl), px: Math.round(d / s) }; }
    if (own) { const cs = getComputedStyle(el); if ((el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX)) || (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1)) rec.truncated = true; }
    if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) rec.outsideWindow = true;
    if (own) items.push(rec);
    const tag = el.tagName.toLowerCase();
    const zone = el.tagName.toLowerCase() === 'rect' && el.dataset && el.dataset.z;
    if (tag === 'button' || tag === 'a' || tag === 'input' || el.getAttribute('role') === 'button' || zone || (el.dataset && (el.dataset.tutskip || el.dataset.cardok)) || el.matches('#chSound,#chPause,#bClose')) {
      if (getComputedStyle(el).pointerEvents === 'none') return;
      inter.push({ ...rec, zone: zone || null, rawRect: { l: r.left, t: r.top, w: r.width, h: r.height } });
    }
  });
  /* Pixi Text */
  const px = [];
  try {
    const W = window.__dbg.WORLD, walk = (n, ok) => { const vv = ok && n.visible !== false && (n.worldAlpha === undefined || n.worldAlpha > 0.05); if (typeof n.text === 'string' && n.text.trim() && vv && n.getBounds) { const b = n.getBounds(); const cv = document.querySelector('#world').getBoundingClientRect(); const k = cv.width / 1280; px.push({ id: 'pixi', block: 'pixi', text: n.text.slice(0, 50), x: b.x, y: b.y, w: b.width, h: b.height }); } (n.children || []).forEach(c => walk(c, vv)); };
    walk(W.app.stage, true);
  } catch (e) { /* без Pixi */ }
  /* координаты Pixi уже логические (холст 1280×720) */
  px.forEach(p => { p.x = p.x; });
  /* кликабельность */
  const clicks = [];
  inter.forEach(it => {
    const el = [...document.querySelectorAll('#stage *')].find(e => desc(e) === it.id && Math.abs(e.getBoundingClientRect().left - it.rawRect.l) < 1 && Math.abs(e.getBoundingClientRect().top - it.rawRect.t) < 1);
    if (!el) return;
    const r = it.rawRect, ins = Math.min(4, r.w / 4, r.h / 4);
    const pts = [[r.l + r.w / 2, r.t + r.h / 2, 'c'], [r.l + ins, r.t + ins, 'tl'], [r.l + r.w - ins, r.t + ins, 'tr'], [r.l + ins, r.t + r.h - ins, 'bl'], [r.l + r.w - ins, r.t + r.h - ins, 'br']];
    const bad = [];
    pts.forEach(([x, y, n]) => { if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { bad.push(n + ':вне окна'); return; } const h = document.elementFromPoint(x, y); const ok = h === el || (h && (el.contains(h) || (it.zone && false))); if (!ok) bad.push(n + ':' + desc(h)); });
    if (bad.length) clicks.push({ id: it.id, text: it.text, zone: it.zone, block: it.block, bad });
  });
  return { scale: s, items, px, clicks, nInter: inter.length };
}
function overlaps(items) {
  const res = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.block === b.block && a.block !== 'pixi' && a.block !== 'other') continue;
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (w > 0 && h > 0 && w * h >= MIN_OVERLAP) res.push({ a: `${a.block}:${a.text}`, b: `${b.block}:${b.text}`, px2: Math.round(w * h) });
  }
  return res;
}

(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, WORLD, spawn, tickDay, barOpen, barShow, applyUpgrades, zoneClick, endDay, showEvening, showBook, showTitle, setPause, toast, banner, rcFor, barPaint, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка (CUPPABLE_DEBUG=1)'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await PW.page(b); const errs = []; PW.watch(p, errs);
  const url = PW.url(tmp);
  const start = async (o) => { await p.goto('about:blank'); await p.goto(url + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400); await p.evaluate(c => window.__sandbox.start(c), o); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 }); };
  await start({ day: 10, profile: 'medium' });
  await p.evaluate(() => { const G = __dbg.G; ['ice', 'tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker', 'case_snacks', 'case_pastry', 'case_dessert', 'fridge_deli', 'microwave', 'siphon'].forEach(k => G['eq_' + k] = true); G.milk = true; __dbg.applyUpgrades(); __dbg.G.tutOff = true; __dbg.G.hints = true; });
  /* перехват кадра бара для проверок налива */
  await p.evaluate(() => { const W = __dbg.WORLD, o = W.paintBar.bind(W); W.paintBar = f => { window.__frame = f; return o(f); }; });
  const report = { sizes: SIZES.map(s => s.join('x')), states: {}, minOverlap: MIN_OVERLAP };
  const open = async (id, size = '0.3', cold = false) => {
    await p.evaluate(() => __dbg.resetBar()); await p.waitForTimeout(250);
    await p.evaluate(({ id, size, cold }) => { const M = window.__MENUAPI, c = __dbg.D.customers[0]; const dk = M.drinkById[id] || M.drinkById[M.drinkOfKey(id).id]; c.drink = id; c.order.key = id; c.order.id = dk.id || id; c.order.name = dk.name; c.order.size = size; c.order.cold = cold; c.order.food = null; c.pat = c.max = 1e9; }, { id, size, cold });
    await p.evaluate(() => __dbg.barOpen(__dbg.D.customers[0])); await p.waitForTimeout(600); await PW.dismissCard(p);
    return p.evaluate(() => __dbg.BR && __dbg.BR.exp.join(','));
  };
  const measure = async (name, shotName) => {
    const per = {};
    for (const [w, h] of SIZES) {
      await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(500);
      const c = await p.evaluate(pageCollect);
      const all = [...c.items, ...c.px];
      per[w + 'x' + h] = { scale: +c.scale.toFixed(3), nItems: c.items.length, nPixi: c.px.length, nInteractive: c.nInter, overlaps: overlaps(all), clipped: c.items.filter(i => i.clipped).map(i => ({ id: i.id, text: i.text, ...i.clipped })), truncated: c.items.filter(i => i.truncated).map(i => ({ id: i.id, text: i.text })), outsideWindow: c.items.filter(i => i.outsideWindow).map(i => ({ id: i.id, text: i.text })), blockedClicks: c.clicks };
      if (shotName && w === 1280 && h === 720) await p.screenshot({ path: `${out}/${shotName}.png`, timeout: 120000 });
    }
    await p.setViewportSize({ width: 1312, height: 752 }); await p.waitForTimeout(300);
    report.states[name] = per; console.log('state', name);
  };
  const first = async () => { await p.evaluate(() => { const d = __dbg; d.D.nextArr = 1e9; if (d.D.customers.length < 6) for (let i = d.D.customers.length; i < 6; i++) d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; }); }); await p.waitForFunction(() => __dbg.D.customers.slice(0, 3).every(c => c.arrived), null, { timeout: 90000 }).catch(() => {}); };
  if (on('overlap') || on('panels') || on('cups') || on('recog') || on('texts')) await first();

  if (on('overlap') || on('panels')) {
    if (on('overlap')) {
      await p.waitForTimeout(1500); await measure('hall_queue_day', 'hall_queue_day');
      await p.evaluate(() => { __dbg.D.t = 270; __dbg.tickDay(0.1); }); await p.waitForTimeout(1500); await measure('hall_queue_evening', 'hall_queue_evening');
      await p.evaluate(() => { __dbg.D.t = 120; __dbg.tickDay(0.1); __dbg.toast('Обеденный час пик: клиентов станет больше'); __dbg.banner('Обед', 'Пик'); }); await p.waitForTimeout(500); await measure('hall_toast_banner', 'hall_toast_banner');
    }
    const plan = [['latte', '0.3', false, 'bar_latte_03'], ['latte', '0.6', false, 'bar_latte_06']];
    if (on('overlap')) for (const [id, sz, cold, nm] of plan) { await open(id, sz, cold); await p.waitForTimeout(400); await measure(nm, nm); }
    const fams = [['tea_sencha', 'tea'], ['matcha_latte', 'matcha'], ['cocoa', 'powder'], ['espresso_tonic', 'tonic'], ['orange_bumble', 'juice'], ['milkshake_vanilla', 'shake'], ['boba_guava', 'boba'], ['latte_coconut', 'foam'], ['aerocano', 'aero'], ['protein_milk', 'protein'], ['frappe_caramel', 'blend']];
    for (const [id, tag] of fams) {
      for (const sz of ['0.4', '0.6']) {
        try {
          const cold = /bumble|tonic|shake|boba|frappe|aero|protein/.test(id);
          const exp = await open(id, sz, cold);
          const t = (exp || '').split(',').find(x => !/^(grind|tamp|shot|milk|steam|pour|water|ice|syrup)$/.test(x));
          if (!t) continue;
          await p.evaluate(t => { const z = (window.TASK_ZONE || {})[t] || t; __dbg.zoneClick(z); }, t); await p.waitForTimeout(800);
          await measure(`panel_${tag}_${t}_${sz}`, sz === '0.6' ? `panel_${tag}_${t}_${sz}` : null);
        } catch (e) { console.log('panel fail', id, e.message.slice(0, 80)); }
      }
    }
    /* классические инсеты */
    for (const z of ['grind', 'tamp']) { await open('latte', '0.6'); await p.click(`[data-z=${z}]`, { force: true }).catch(() => {}); await p.waitForTimeout(600); await measure('inset_' + z, null); }
    /* карточка нового напитка */
    await p.evaluate(() => { __dbg.resetBar(); __dbg.G.tutOff = false; __dbg.G.tutorialSeen = []; const c = __dbg.D.customers[0]; c.order.id = 'matcha_latte'; c.drink = 'matcha_latte'; c.order.key = 'matcha_latte'; }).catch(() => {});
    await p.evaluate(() => __dbg.barOpen(__dbg.D.customers[0])).catch(() => {}); await p.waitForTimeout(800); await measure('drink_card', 'drink_card');
    await PW.dismissCard(p); await p.evaluate(() => { __dbg.G.tutOff = true; });
    await p.evaluate(() => __dbg.resetBar());
    /* экраны */
    await p.evaluate(() => { __dbg.D.customers.forEach(c => { c.leaving = true; }); __dbg.endDay(); }); await p.waitForTimeout(1500); await measure('screen_evening', 'screen_evening');
    await p.evaluate(() => __dbg.showBook('title')); await p.waitForTimeout(800); await measure('screen_book', 'screen_book');
    await p.evaluate(() => __dbg.showTitle()); await p.waitForTimeout(800); await measure('screen_title', 'screen_title');
    fs.writeFileSync(`${out}/overlap_report.json`, JSON.stringify(report, null, 1));
  }
  console.log(errs.length ? errs.slice(0, 6).join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
