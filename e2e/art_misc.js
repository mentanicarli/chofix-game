/* Проверки графики, часть 2 (инструмент аудита, не тест): модель налива и чашек, тексты, узнаваемость. Игру не меняет.
   Отладочная сборка обязательна. node e2e/art_misc.js dist/artifact.html out/art-audit/sys [cups,texts,recog]
   cups  — rc (цели) для каждого напитка и объёма: доля налива относительно чашки, габарит чашки против окна группы; кадры 0,2/0,3/0,4/0,6;
   texts — реплики гостей (символов в секунду), автоскрывающиеся тексты из кода, регистр подписей;
   recog — крупные планы всех частей бара и предметов зала для оценки «узнаётся без подписи». */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const PW = require('./pw');
const out = path.resolve(process.argv[3] || 'out/art-audit/sys'); fs.mkdirSync(out, { recursive: true });
const parts = (process.argv[4] || 'cups,texts,recog').split(','); const on = k => parts.includes(k);
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { get G() { return G; }, get D() { return D; }, get BR() { return BR; }, WORLD, spawn, tickDay, barOpen, barShow, applyUpgrades, zoneClick, rcFor, barPaint, xLayers, resetBar() { try { barShow(false); } catch (e) { /* нет бара */ } BR = null; } };');
  if (!src.includes('window.__dbg')) { console.error('нужна отладочная сборка'); process.exit(2); }
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
  const p = await PW.page(b); const errs = []; PW.watch(p, errs);
  const url = PW.url(tmp);
  await p.goto('about:blank'); await p.goto(url + '#dev'); await p.waitForSelector('[data-sandbox]', { timeout: 60000 }); await p.waitForTimeout(400);
  await p.evaluate(() => window.__sandbox.start({ day: 10, profile: 'medium' })); await p.waitForSelector('#screen', { state: 'hidden', timeout: 20000 });
  await p.evaluate(() => { const G = __dbg.G; ['ice', 'tea', 'matcha', 'powders', 'juice', 'whipper', 'foamer', 'blender', 'boba', 'shaker', 'case_snacks', 'case_pastry', 'case_dessert', 'fridge_deli', 'microwave', 'siphon'].forEach(k => G['eq_' + k] = true); G.milk = true; G.tutOff = true; G.hints = true; __dbg.applyUpgrades(); const d = __dbg; d.D.nextArr = 1e9; for (let i = 0; i < 3; i++) d.spawn(); d.D.customers.forEach(c => { c.pat = c.max = 1e9; }); });
  await p.waitForFunction(() => __dbg.D.customers[0] && __dbg.D.customers[0].arrived, null, { timeout: 90000 });
  const shot = async (n, clip) => { await p.screenshot({ path: `${out}/${n}.png`, timeout: 120000, ...(clip ? { clip } : {}) }); };
  const hideUi = sel => p.evaluate(s => document.querySelectorAll(s).forEach(e => { e.style.visibility = 'hidden'; }), sel);

  if (on('cups')) {
    const menu = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/menu.json'), 'utf8')).drinks;
    const rows = await p.evaluate(({ ids }) => {
      const c = __dbg.D.customers[0], M = window.__MENUAPI, res = [];
      for (const id of ids) {
        const dk = M.drinkById[id];
        for (const [size, cold] of [['0.3', false], ['0.4', false], ['0.6', false], ['0.4', true], ['0.6', true]]) {
          if (cold && !(dk.temp === 'cold' || dk.temp === 'both')) continue;
          if (!cold && dk.temp === 'cold') continue;
          try { c.drink = id; c.order.key = id; c.order.id = id; c.order.size = size; c.order.cold = cold; c.order.food = null; const rc = __dbg.rcFor(c); res.push({ id, family: dk.family, size, cold, rc: JSON.parse(JSON.stringify(rc)) }); } catch (e) { res.push({ id, size, cold, err: String(e).slice(0, 80) }); }
        }
      }
      return res;
    }, { ids: menu.map(d => d.id) });
    fs.writeFileSync(`${out}/cups_rc.json`, JSON.stringify(rows, null, 1));
    console.log('rc rows', rows.length);
    /* кадры чашки по размерам: классический латте-пустая чашка и американо, окно группы вокруг (460..800 × 320..540) */
    await hideUi('#hud,#bTk,#bCoach,#toast,#bFloat');
    for (const [id, sz] of [['americano', '0.2'], ['americano', '0.3'], ['americano', '0.4'], ['americano', '0.6'], ['latte', '0.6']]) {
      await p.evaluate(({ id, size }) => { __dbg.resetBar(); const c = __dbg.D.customers[0], M = window.__MENUAPI, dk = M.drinkOfKey(id); c.drink = id; c.order.key = id; c.order.id = dk.id; c.order.size = size; c.order.cold = false; c.order.food = null; c.pat = c.max = 1e9; __dbg.barOpen(c); }, { id, size: sz });
      await p.waitForTimeout(900); await PW.dismissCard(p);
      await hideUi('#hud,#bTk,#bCoach,#toast,#bFloat');
      /* ставим налив «полная чашка по данным» для классики: вода/молоко до цели */
      await p.evaluate(() => { const B = __dbg.BR, rc = B.rc; B.cup.es = (rc.shots || 1) * 30; if (rc.water) B.cup.water = rc.water; if (rc.milk) { B.cup.milk = rc.milk; B.cup.foam = rc.foam || 0; } B.cup.level = 1; });
      await p.waitForTimeout(500);
      /* габарит чашки на сцене по границам Pixi-контейнера; носик группы кончается около y 372 (по снимкам), перекрытие = насколько обод выше этой линии */
      const f = await p.evaluate(() => { const c = __dbg.WORLD.bar && __dbg.WORLD.bar.cupC; if (!c) return null; const b = c.getBounds(); return { top: Math.round(b.y), bottom: Math.round(b.y + b.height), left: Math.round(b.x), right: Math.round(b.x + b.width), overlapGroupPx: Math.max(0, 372 - Math.round(b.y)) }; });
      await shot(`cup_${id}_${sz}`, { x: 16 + 470, y: 16 + 300, width: 360, height: 260 });
      console.log('cup', id, sz, JSON.stringify(f));
    }
  }

  if (on('fill')) {
    /* Налив для каждого напитка и объёма (этап 12.2, задача E): ставим «всё налито по цели», вызываем настоящий barPaint и читаем кадр
       (window.__frame.topY). Доля на экране = (2 − topY) / 72; доля по данным = налитое / ёмкость выбранной чашки. */
    await p.evaluate(() => { const W = __dbg.WORLD, o = W.paintBar.bind(W); W.paintBar = f => { window.__frame = f; return o(f); }; });
    const menu = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/menu.json'), 'utf8')).drinks;
    const rows = [];
    for (const d of menu) {
      for (const [size, cold] of [['0.3', false], ['0.4', false], ['0.6', false], ['0.3', true], ['0.4', true], ['0.6', true]]) {
        if (cold && !(d.temp === 'cold' || d.temp === 'both')) continue; if (!cold && d.temp === 'cold') continue;
        if (!d.sizes[size]) continue;
        const r = await p.evaluate(({ id, size, cold }) => {
          __dbg.resetBar();
          const c = __dbg.D.customers[0], M = window.__MENUAPI, dk = M.drinkById[id];
          c.drink = id; c.order.key = id; c.order.id = id; c.order.name = dk.name; c.order.size = size; c.order.cold = cold; c.order.food = null; c.syrup = null; c.pumps = 0; c.pat = c.max = 1e9; __dbg.G.tutOff = true;
          __dbg.barOpen(c); const B = __dbg.BR; if (!B) return { err: 'нет заказа' };
          const rc = B.rc;
          for (const t of B.exp) if (!M.PANEL_TASKS.has(t)) { B.done[t] = true; B.res[t] = 1; } /* порядок шагов не мешает открыть станции */
          for (const t of B.exp) if (M.PANEL_TASKS.has(t)) {
            __dbg.zoneClick(t); const st = B.xs[t]; if (!st) continue;
            if (t === 'brew') st.t = st.minutes; else if ('ml' in st) st.ml = st.target; else if ('target' in st) st.t = st.target;
            B.done[t] = true; B.res[t] = 1;
          }
          B.cup.es = rc.pitcherShot ? 0 : (rc.shots || 0) * 30; if (rc.water) B.cup.water = rc.water; if (rc.milk) { B.cup.milk = rc.milk; B.cup.foam = rc.foam || 0; } B.cup.level = 1; if (rc.ice) B.cup.ice = rc.ice;
          for (const t of ['grind', 'tamp', 'shot', 'water', 'milk', 'steam', 'pour', 'ice']) B.done[t] = true;
          B.inset = null; __dbg.barPaint(0.016);
          const fr = window.__frame, top = fr ? fr.topY : null; let xl = null; try { const XL = __dbg.xLayers(B, 72 / rc.cupMl); xl = { h: XL.h, boba: XL.bobaH, n: XL.list.length }; } catch (e) { /* не новое ядро */ }
          const liquid = (rc.tea ? rc.tea.waterMl : 0) + (rc.matcha ? rc.matcha.waterMl : 0);
          return { cupMl: rc.cupMl, cupK: rc.cupK, topY: top, fracScreen: top === null ? null : +(((2 - top) / 72).toFixed(3)), teaMl: rc.tea ? rc.tea.waterMl : null, matchaMl: rc.matcha ? rc.matcha.waterMl : null, fracData: liquid ? +(liquid / rc.cupMl).toFixed(3) : null, ice: rc.ice || 0, xl, tasks: B.tasks.join(), xsKeys: Object.keys(B.xs).join() };
        }, { id: d.id, size, cold });
        rows.push({ id: d.id, family: d.family, size, cold, ...r });
      }
    }
    fs.writeFileSync(path.join(out, 'fill_table.json'), JSON.stringify(rows, null, 1));
    const bad = rows.filter(r => r.fracScreen !== null && (r.fracScreen > 1.02 || r.fracScreen < 0.2));
    const byFam = {}; rows.forEach(r => { if (r.fracScreen == null) return; const k = r.family + (r.cold ? ' холод.' : ' гор.'); const b = byFam[k] = byFam[k] || { n: 0, min: 9, max: 0 }; b.n++; b.min = Math.min(b.min, r.fracScreen); b.max = Math.max(b.max, r.fracScreen); });
    console.log('fill rows', rows.length, 'вне 0,2–1,02:', bad.length); console.log(JSON.stringify(byFam));
    bad.slice(0, 12).forEach(r => console.log(JSON.stringify(r)));
  }

  if (on('load')) {
    /* доля сцены бара, закрытая интерфейсом, и перекрытые зоны (#bZones) */
    const measure = () => p.evaluate(() => {
      const st = document.querySelector('#stage').getBoundingClientRect(), s = st.width / 1280;
      const rect = e => { const r = e.getBoundingClientRect(); return { x: (r.left - st.left) / s, y: (r.top - st.top) / s, w: r.width / s, h: r.height / s }; };
      const vis = e => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .05) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
      const defs = { hud: '#hud .chip, #hud > *', ticket: '#bTk', coach: '#bCoach', tray: '#bFloat > *', panel: '#xPanel, #bi', toast: '#toast.show', frontHint: '#frontHint' };
      const blocks = [];
      for (const [k, sel] of Object.entries(defs)) document.querySelectorAll(sel).forEach(e => { if (vis(e)) blocks.push({ k, ...rect(e) }); });
      const W = 320, H = 180, cell = 4, grid = new Uint8Array(W * H), byKind = {};
      const mark = (b, g) => { for (let y = Math.max(0, Math.floor(b.y / cell)); y < Math.min(H, Math.ceil((b.y + b.h) / cell)); y++) for (let x = Math.max(0, Math.floor(b.x / cell)); x < Math.min(W, Math.ceil((b.x + b.w) / cell)); x++) g[y * W + x] = 1; };
      blocks.forEach(b => { mark(b, grid); (byKind[b.k] = byKind[b.k] || new Uint8Array(W * H)); mark(b, byKind[b.k]); });
      const cnt = g => g.reduce((a, v) => a + v, 0) / (W * H);
      const zones = [...document.querySelectorAll('#bZones rect[data-z]')].filter(z => getComputedStyle(z).pointerEvents !== 'none').map(z => { const r = rect(z); const zg = new Uint8Array(W * H); mark(r, zg); let a = 0, o = 0; for (let i = 0; i < zg.length; i++) if (zg[i]) { a++; if (grid[i]) o++; } return { z: z.dataset.z, covered: a ? +(o / a).toFixed(2) : 0, by: Object.keys(byKind).filter(k => { let n = 0; for (let i = 0; i < zg.length; i++) if (zg[i] && byKind[k][i]) n++; return a && n / a > 0.05; }) }; });
      return { totalCovered: +cnt(grid).toFixed(3), perKind: Object.fromEntries(Object.entries(byKind).map(([k, g]) => [k, +cnt(g).toFixed(3)])), blocks: blocks.length, zones: zones.filter(z => z.covered > 0.05) };
    });
    const res = {};
    for (const [id, sz, cold, tag] of [['latte', '0.3', false, 'latte_03'], ['latte', '0.6', false, 'latte_06'], ['frappe_caramel', '0.4', true, 'frappe_04_long_ticket'], ['tea_sencha', '0.4', false, 'tea_04']]) {
      await p.evaluate(() => __dbg.resetBar()); await p.waitForTimeout(250);
      await p.evaluate(({ id, size, cold }) => { const c = __dbg.D.customers[0], M = window.__MENUAPI, dk = M.drinkById[id] || M.drinkById[M.drinkOfKey(id).id]; c.drink = id; c.order.key = id; c.order.id = dk.id || id; c.order.name = dk.name; c.order.size = size; c.order.cold = cold; c.order.food = null; c.pat = c.max = 1e9; __dbg.G.hints = true; __dbg.barOpen(c); }, { id, size: sz, cold });
      await p.waitForTimeout(900); await PW.dismissCard(p); await p.waitForTimeout(500);
      res[tag] = await measure(); await shot('load_' + tag);
      /* то же с открытой панелью первой станции нового ядра */
      const t = await p.evaluate(() => { const B = __dbg.BR; return B && B.exp.find(x => !/^(grind|tamp|shot|milk|steam|pour|water|ice|syrup)$/.test(x)); });
      if (t) { await p.evaluate(t => { __dbg.zoneClick((window.TASK_ZONE || {})[t] || t); }, t); await p.waitForTimeout(700); res[tag + '+panel'] = await measure(); await shot('load_' + tag + '_panel'); }
    }
    fs.writeFileSync(`${out}/bar_load.json`, JSON.stringify(res, null, 1)); console.log('load done');
  }

  if (on('texts')) {
    const lines = await p.evaluate(() => { const d = __dbg, seen = new Map(); for (let i = 0; i < 400; i++) { d.D.customers.length = 0; d.spawn(); const c = d.D.customers[d.D.customers.length - 1]; if (c && c.order && c.order.line) seen.set(c.order.line, c.type || ''); } return [...seen.entries()].map(([line, type]) => ({ line, type })); });
    /* время показа реплики: clamp(длина / 12, 5, 10) с (sayDuration в 04-customers.js; до этапа 12.2 было 5 с) */
    const sayDur = n => Math.min(10, Math.max(5, n / 12));
    const rows = lines.map(l => ({ ...l, chars: l.line.length, sec: +sayDur(l.line.length).toFixed(1), cps: +(l.line.length / sayDur(l.line.length)).toFixed(1) })).sort((a, b) => b.cps - a.cps);
    fs.writeFileSync(`${out}/say_lines.json`, JSON.stringify({ n: rows.length, maxCps: rows[0] && rows[0].cps, over15: rows.filter(r => r.cps > 15).length, top: rows.slice(0, 15), median: rows[Math.floor(rows.length / 2)] }, null, 1));
    console.log('say', rows.length, 'max cps', rows[0] && rows[0].cps);
    /* статический разбор toast/hint/banner/таймеров из исходников */
    const files = fs.readdirSync(path.resolve(__dirname, '../src/legacy')).filter(f => f.endsWith('.js'));
    const tl = [];
    for (const f of files) fs.readFileSync(path.resolve(__dirname, '../src/legacy', f), 'utf8').split('\n').forEach((ln, i) => {
      for (const m of ln.matchAll(/\b(toast|hint|barMsg|banner)\(\s*(['`"])((?:(?!\2).)*)\2(?:\s*,\s*(\d+))?/g)) tl.push({ fn: m[1], file: f, line: i + 1, text: m[3].replace(/\$\{[^}]*\}/g, '…').slice(0, 90), ms: m[4] ? +m[4] : (m[1] === 'toast' ? 2400 : m[1] === 'hint' ? 2200 : m[1] === 'barMsg' ? 4200 : null) });
    });
    /* фактическое время: toast/hint — max(ms; 2,5 с; длина / 15 с) (02-state.js), barMsg — max(4,2 с; длина / 15 с) (06-bar.js) */
    tl.forEach(t => { if (t.ms && (t.fn === 'toast' || t.fn === 'hint')) t.ms = Math.max(t.ms, 2500, t.text.length / 15 * 1000); else if (t.ms && t.fn === 'barMsg') t.ms = Math.max(t.ms, t.text.length / 15 * 1000); });
    tl.forEach(t => { t.chars = t.text.length; t.cps = t.ms ? +(t.chars / (t.ms / 1000)).toFixed(1) : null; });
    fs.writeFileSync(`${out}/toasts_static.json`, JSON.stringify(tl.sort((a, b) => (b.cps || 0) - (a.cps || 0)), null, 1));
    console.log('toasts static', tl.length);
    /* подписи: тексты Pixi и DOM-подписи в баре и зале */
    const labels = await p.evaluate(() => { const px = []; const walk = (n, ok) => { const v = ok && n.visible !== false; if (typeof n.text === 'string' && n.text.trim()) px.push({ t: n.text, vis: v }); (n.children || []).forEach(c => walk(c, v)); }; walk(__dbg.WORLD.app.stage, true); return px; });
    const bp = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/assets/art/bar-parts.json'), 'utf8')); const bar = [];
    for (const [k, v] of Object.entries(bp)) (v.texts || []).forEach(t => bar.push({ part: k, t: t.t, family: t.family, size: t.size }));
    fs.writeFileSync(`${out}/labels.json`, JSON.stringify({ pixiRuntime: labels, barParts: bar }, null, 1));
    console.log('labels', labels.length, bar.length);
  }

  if (on('recog')) {
    await p.evaluate(() => __dbg.resetBar());
    await hideUi('#hud,#bTk,#bCoach,#toast,.say,#tint');
    await p.waitForTimeout(800);
    const hall = { 'hall_showcase': [715, 335, 110, 110], 'hall_machine': [950, 315, 190, 130], 'hall_grinder_toaster': [1140, 335, 160, 110], 'hall_table_sitter': [80, 470, 300, 200], 'hall_plant_fg': [10, 520, 200, 220], 'hall_board_clock': [370, 110, 290, 170], 'hall_window': [86, 100, 240, 280], 'hall_lamps_shelf': [650, 40, 600, 240], 'hall_counter_front': [700, 420, 580, 230], 'hall_barista': [800, 260, 190, 150], 'hall_guest_1': [300, 230, 200, 400] };
    for (const [n, [x, y, w, h]] of Object.entries(hall)) await shot('recog_' + n, { x: 16 + x, y: 16 + y, width: w, height: h });
    await p.evaluate(() => { const d = __dbg, c = d.D.customers[0]; d.barOpen(c); }); await p.waitForTimeout(1200); await PW.dismissCard(p);
    await hideUi('#hud,#bTk,#bCoach,#toast,#bFloat,#tint'); await p.waitForTimeout(600);
    await shot('recog_bar_full');
    const bp = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/assets/art/bar-parts.json'), 'utf8'));
    for (const k of ['showcase', 'ice', 'milk', 'steam', 'pitBack', 'bell', 'grinderBack', 'tamper', 'scSnacks', 'scPastry', 'scDessert', 'scDeli', 'scMicro', 'eq_tea', 'eq_matcha', 'eq_powders', 'eq_juice', 'eq_whipper', 'eq_foamer', 'eq_blender', 'eq_boba', 'eq_shaker']) {
      const bx = bp[k].box; await shot('recog_bar_' + k, { x: Math.max(0, 16 + bx.x - 8), y: Math.max(0, 16 + bx.y - 8), width: Math.min(1280, bx.w + 16), height: Math.min(720, bx.h + 16) });
    }
    console.log('recog crops done');
  }
  console.log(errs.length ? errs.slice(0, 6).join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
