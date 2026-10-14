/* Три визуальные правки одним сценарием:
   1) кольцо фокуса: у кнопок меню и паузы его нет после программного фокуса и после мыши, есть после Tab;
   2) сидящий гость за ноутбуком: тело и руки не торчат по бокам и поверх крышки (3 разных гостя, набор текста, питьё, потягивание, «задумался», осмотр);
   3) гости без просветов: все выходы одежды × телосложения × цвета, стоя и в ходьбе, при разрешении 1 и 0.5; доски пола лежат под людьми, а не поверх.
   Запуск (отладочная сборка): node e2e/visual_fixes_test.js dist/artifact.html out/vf */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const out = process.argv[3] || 'out/vf';
(async () => {
  const src = fs.readFileSync(path.resolve(process.argv[2]), 'utf8').replace('newGame(); updateHud(); showTitle();', 'newGame(); updateHud(); showTitle(); window.__dbg = { WORLD, lookFor, get G() { return G; }, get D() { return D; } };');
  const tmp = path.resolve(process.argv[2]).replace('.html', '.dbg.html'); fs.writeFileSync(tmp, src);
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const ok = (name, v, info) => { console.log((v ? 'OK   ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!v) errs.push('FAIL ' + name + (info ? ' ' + info : '')); };

  /* ---------- 1. кольцо фокуса ---------- */
  {
    const p = await require('./pw').page(b); require('./pw').watch(p, errs);
    await p.addInitScript(() => { try { localStorage.setItem('coffee-sim-save-v1', JSON.stringify({ v: 2, day: 3, money: 900, rating: 3.2, pace: 'normal', rank: 2, served: 10, up: [] })); } catch (e) { /* без сохранения */ } });
    await p.goto(require('./pw').url(tmp) + '#nopixi-lowfx'); await p.waitForSelector('[data-continue]', { timeout: 60000 }); await p.waitForTimeout(800);
    const ring = sel => p.evaluate(sel => { const e = document.querySelector(sel); const s = getComputedStyle(e); return { focused: document.activeElement === e, style: s.outlineStyle, w: s.outlineWidth, kbd: document.documentElement.classList.contains('kbd') }; }, sel);
    let r = await ring('[data-continue]');
    ok('меню: «Продолжить» в фокусе кодом, кольца нет', r.focused && r.style === 'none', JSON.stringify(r));
    await p.keyboard.press('Tab');
    r = await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { cls: e.className, style: s.outlineStyle, kbd: document.documentElement.classList.contains('kbd') }; });
    ok('Tab: режим клавиатуры включён и кольцо видно', r.kbd && r.style === 'solid', JSON.stringify(r));
    await p.keyboard.press('ArrowDown');
    r = await p.evaluate(() => ({ style: getComputedStyle(document.activeElement).outlineStyle }));
    ok('стрелки двигают выбор, кольцо на месте', r.style === 'solid');
    await p.click('[data-settings]'); await p.waitForTimeout(700);
    r = await p.evaluate(() => ({ kbd: document.documentElement.classList.contains('kbd'), style: getComputedStyle(document.activeElement).outlineStyle, tag: document.activeElement.className }));
    ok('после клика мышью: режим клавиатуры выключен, кольца нет (настройки)', !r.kbd && r.style === 'none', JSON.stringify(r));
    await p.click('[data-menuback]'); await p.waitForTimeout(700);
    await p.click('[data-continue]'); await p.waitForTimeout(1500);
    await p.click('#chPause'); await p.waitForSelector('[data-resume]'); await p.waitForTimeout(700);
    r = await ring('[data-resume]');
    ok('пауза, открытая мышью: «Продолжить» без кольца', r.focused && r.style === 'none', JSON.stringify(r));
    await p.click('[data-resume]'); await p.waitForTimeout(400);
    await p.click('#chPause'); await p.waitForSelector('[data-tomenu]'); await p.waitForTimeout(700);
    await p.click('[data-tomenu]'); await p.waitForTimeout(700);
    r = await p.evaluate(() => ({ style: getComputedStyle(document.activeElement).outlineStyle }));
    ok('диалог подтверждения: без кольца', r.style === 'none', JSON.stringify(r));
    await p.keyboard.press('Tab');
    r = await p.evaluate(() => ({ style: getComputedStyle(document.activeElement).outlineStyle }));
    ok('Tab в диалоге: кольцо есть', r.style === 'solid');
    await p.screenshot({ path: out + '_focus.png', timeout: 60000 });
    await p.close();
  }

  /* ---------- общая страница для сцены: игра запущена, цикл кадров остановлен, шагаем сами ---------- */
  const p = await require('./pw').page(b); require('./pw').watch(p, errs);
  await p.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__hold = false; window.requestAnimationFrame = cb => window.__hold ? 0 : raf(cb); });
  await p.goto(require('./pw').url(tmp) + '#nopixi'); await p.waitForTimeout(2500);
  await require('./pw').startNew(p); await p.waitForTimeout(800);
  await p.addStyleTag({ content: '#screen,#hud,#hudR,#tint,#boot,#bar,#frontHint,#banner{display:none!important}' });
  await p.evaluate(() => { window.__hold = true; });
  await p.waitForTimeout(300);

  /* вспомогательное в странице: кадр, чтение пикселей */
  await p.evaluate(() => {
    const { WORLD } = window.__dbg;
    window.__step = n => { for (let i = 0; i < n; i++) WORLD.update(1 / 30, 0.3, 480); };
    window.__canvas = () => WORLD.app.renderer.extract.canvas({ target: WORLD.app.stage, frame: WORLD.app.screen, resolution: WORLD.app.renderer.resolution });
    window.__px = () => { const c = window.__canvas(); const g = c.getContext('2d'); return { g, k: c.width / 1280, w: c.width, h: c.height }; };
    /* доля «пустых» (фон-маджента) пикселей в прямоугольнике сцены */
    window.__holes = (px, x0, y0, x1, y1) => {
      const X0 = Math.round(x0 * px.k), Y0 = Math.round(y0 * px.k), W = Math.max(1, Math.round((x1 - x0) * px.k)), H = Math.max(1, Math.round((y1 - y0) * px.k));
      const d = px.g.getImageData(X0, Y0, W, H).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 24 || (d[i] > 235 && d[i + 1] < 45 && d[i + 2] > 235)) n++;
      return n / (W * H);
    };
    /* доля пикселей, не похожих на цвет крышки ноутбука (без логотипа в центре) */
    window.__offLid = (px, x0, y0, x1, y1) => {
      const X0 = Math.round(x0 * px.k), Y0 = Math.round(y0 * px.k), W = Math.max(1, Math.round((x1 - x0) * px.k)), H = Math.max(1, Math.round((y1 - y0) * px.k));
      const d = px.g.getImageData(X0, Y0, W, H).data; const hist = {}; const px4 = [];
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        const sx = x0 + xx / px.k, sy = y0 + yy / px.k; if (Math.hypot(sx - 230, sy - (652 + (514 - 652) * 1.6)) < 11 * 1.6) continue;
        const i = (yy * W + xx) * 4; const key = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4) + ',' + (d[i + 3] > 200 ? 1 : 0);
        hist[key] = (hist[key] || 0) + 1; px4.push(key);
      }
      const mode = Object.keys(hist).sort((u, v) => hist[v] - hist[u])[0];
      const near = (k1, k2) => { const A = k1.split(',').map(Number), B = k2.split(',').map(Number); return A[3] === B[3] && Math.abs(A[0] - B[0]) <= 1 && Math.abs(A[1] - B[1]) <= 1 && Math.abs(A[2] - B[2]) <= 1; };
      return px4.filter(k => !near(k, mode)).length / px4.length;
    };
    WORLD.app.renderer.background.color = 0xff00ff;
  });

  /* ---------- 2. сидящий гость за ноутбуком ---------- */
  const seatedShot = async (name, setup) => {
    await p.evaluate(setup); await p.evaluate(() => window.__step(40));
    const res = await p.evaluate(() => {
      const { WORLD } = window.__dbg, a = WORLD.sitter;
      const keep = ['sitC', 'deskC'].map(k => WORLD[k]);
      const was = WORLD.hall.children.map(c => c.visible);
      WORLD.hall.children.forEach(c => { c.visible = keep.includes(c); });
      const chairV = WORLD.chair.visible; WORLD.chair.visible = false;
      WORLD.app.render();
      const px = window.__px();
      /* столик с гостем растёт от точки на полу (230, 652) в 1,6 раза: окна проверки переводим так же */
      const K = 1.6, mx = x => 230 + (x - 230) * K, my = y => 652 + (y - 652) * K;
      const side = [window.__holes(px, mx(166), my(496), mx(194), my(541)), window.__holes(px, mx(266), my(496), mx(282), my(518))];
      const lid = window.__offLid(px, mx(204), my(496), mx(258), my(534)); const cc = window.__canvas(), kk = cc.width / 1280, o = document.createElement('canvas'); o.width = 720; o.height = 560; const og = o.getContext('2d'); og.fillStyle = '#7a7'; og.fillRect(0, 0, 720, 560); og.imageSmoothingEnabled = false; og.drawImage(cc, mx(100) * kk, my(380) * kk, 240 * K * kk, 187 * K * kk, 0, 0, 720, 560); const url = o.toDataURL('image/png');
      WORLD.hall.children.forEach((c, i) => { c.visible = was[i]; }); WORLD.chair.visible = chairV;
      return { url, side, lid, masked: !!a.root.mask && !!WORLD.sitFront.mask, reach: a.reaching, open: a.laptopK };
    });
    return res;
  };
  const kinds = [[0.05, 'student'], [0.6, 'regular'], [0.99, 'hurry']];
  for (const [rv, kind] of kinds) {
    /* вызвать нужного гостя: на время появления случайное число фиксировано */
    await p.evaluate(rv => {
      const { WORLD } = window.__dbg; const real = Math.random;
      window.__real = real; WORLD.sitT = 0; Math.random = () => rv; WORLD.update(1 / 30, 0.3, 480); Math.random = real;
    }, rv);
    for (let i = 0; i < 40; i++) { await p.evaluate(() => window.__step(30)); if (await p.evaluate(() => window.__dbg.WORLD.sitSt === 'seated')) break; }
    ok(`гость ${kind}: сел за столик`, await p.evaluate(() => window.__dbg.WORLD.sitSt === 'seated'));
    await p.evaluate(() => { const a = window.__dbg.WORLD.sitter; a.busy = true; a.act = 'type'; a.seq = null; window.__step(60); });
    const states = {
      'набор текста': () => { const a = window.__dbg.WORLD.sitter; a.act = 'type'; a.hands.forEach(h => { h.ovr = null; }); a.cupToTable(); a.setHandTargets(null, null); a.setGaze('d'); },
      'питьё': () => { const a = window.__dbg.WORLD.sitter, T = { x: 52, y: 538 }; a.act = 'sip'; a.setHandTargets({ x: -14, y: 540 }, { x: T.x, y: T.y - 3 }); window.__step(15); a.cupToHand(); a.hands[1].ovr = { x: 11, y: 459 }; a.sipping = 1; },
      'потягивание': () => { const a = window.__dbg.WORLD.sitter; a.sipping = 0; a.act = 'stretch'; a.hands[0].ovr = { x: -26, y: 418 }; a.hands[1].ovr = { x: 26, y: 418 }; },
      'задумался': () => { const a = window.__dbg.WORLD.sitter; a.act = 'think'; a.hands[0].ovr = null; a.hands[1].ovr = { x: 12, y: 462 }; },
      'осмотр': () => { const a = window.__dbg.WORLD.sitter; a.act = 'glance'; a.hands[0].ovr = null; a.hands[1].ovr = null; a.setGaze('l'); }
    };
    for (const [sn, fn] of Object.entries(states)) {
      const r = await seatedShot(sn, fn);
      const reach = r.reach;
      if (!(r.side[0] > 0.97 && (reach || r.side[1] > 0.97)) || r.lid >= 0.02) fs.writeFileSync(`${out}_seat_${kind}_${sn}.png`, Buffer.from(r.url.split(',')[1], 'base64'));
      const sideOk = r.side[0] > 0.97 && (reach || r.side[1] > 0.97);
      ok(`сидящий ${kind} / ${sn}: по бокам крышки нет тела и рук`, sideOk && r.masked, `лево ${(r.side[0] * 100).toFixed(0)}% право ${(r.side[1] * 100).toFixed(0)}% пусто`);
      ok(`сидящий ${kind} / ${sn}: поверх крышки ничего нет`, r.lid < 0.02, `чужого цвета на крышке ${(r.lid * 100).toFixed(1)}%`);
    }
    await p.evaluate(() => { const a = window.__dbg.WORLD.sitter; a.hands[0].ovr = null; a.hands[1].ovr = null; a.setHandTargets(null, null); window.__dbg.WORLD.sitT = 0; });
    for (let i = 0; i < 40 && !(await p.evaluate(() => window.__dbg.WORLD.sitSt === 'empty')); i++) await p.evaluate(() => window.__step(30));
  }
  /* кадр для глаз: гость, набор текста */
  await p.evaluate(() => { const { WORLD } = window.__dbg; WORLD.hall.children.forEach(c => { c.visible = true; }); WORLD.app.renderer.background.color = 0xf6ead6; });

  /* ---------- 3. гости без просветов ---------- */
  await p.evaluate(() => {
    const { WORLD, lookFor } = window.__dbg;
    WORLD.hall.children.forEach(c => { c.visible = c === WORLD.cust; });
    WORLD.app.renderer.background.color = 0xff00ff;
    WORLD.clearActors(); window.__acts = [];
    const outfits = ['coat', 'sweater', 'jacket', 'hoodie', 'suit'], builds = ['slim', 'mid', 'round'], cloth = ['#4FA39A', '#E8B04A', '#C4694A', '#5A4A5E'];
    const base = (o, bd, c) => ({ skin: '#E7B58E', hair: 'short', hairCol: '#4A3328', outfit: o, cloth: c, pants: '#4F4A5A', shoe: '#2F211B', acc: 'none', item: 'none', build: bd });
    const looks = [];
    outfits.forEach((o, i) => builds.forEach((bd, j) => looks.push(base(o, bd, cloth[(i + j) % 4]))));
    ['student', 'regular', 'hurry'].forEach(t => { for (let i = 0; i < 4; i++) looks.push(lookFor(t)); });
    looks.forEach((look, i) => {
      const x = 70 + (i % 9) * 135, y = -300 + Math.floor(i / 9) * 160;
      const a = WORLD.addActor({ look, icon: '', iconKey: '', title: '', tags: [], x, onTap() {}, steam() {} }); a.__x = x; a.__y = 0; a.__row = Math.floor(i / 9); a.__look = look; window.__acts.push(a);
    });
  });
  await p.waitForTimeout(8000);
  console.log('загружено гостей:', await p.evaluate(() => window.__acts.filter(a => a.root.visible).length + '/' + window.__acts.length));
  await p.waitForFunction(() => window.__acts.every(a => a.root.visible), null, { timeout: 120000 });
  const lineup = async (res, walking) => {
    return await p.evaluate(({ res, walking }) => {
      const { WORLD } = window.__dbg; WORLD.software = null; WORLD.setResolution(res);
      let bad = []; let total = 0;
      const K = WORLD.guestK;
      /* гости выросли в 1,6 раза и закрывали бы друг друга: каждый ряд снимаем отдельно, остальные уводим за экран */
      for (const row of [0, 1, 2]) {
        for (let f = 0; f < 90; f++) window.__acts.forEach((a, i) => a.update(1 / 30, a.__x + (walking ? Math.sin(f / 5 + i) * 0 + f * 1.2 : 0), a.__row === row ? 0 : -3000));
        WORLD.app.render(); const px = window.__px();
        window.__acts.filter(a => a.__row === row).forEach(a => {
          const cx = a.__x + (walking ? 89 * 1.2 : 0), y0 = 600;
          const h = window.__holes(px, cx - 20, y0 - 125 * K, cx + 20, y0 - 32 * K);
          total++; if (h > 0.004) bad.push(`${a.__look.outfit}/${a.__look.build}/${a.__look.cloth} ${(h * 100).toFixed(1)}%`);
        });
      }
      return { bad, total };
    }, { res, walking });
  };
  for (const res of [0.5, 1]) for (const walking of [false, true]) {
    const r = await lineup(res, walking);
    ok(`просветов в торсе нет: ${r.total} гостей, разрешение ${res}, ${walking ? 'в ходьбе' : 'стоя'}`, r.bad.length === 0, r.bad.slice(0, 4).join('; '));
    await p.screenshot({ path: `${out}_looks_${res}_${walking ? 'walk' : 'stand'}.png`, timeout: 90000 });
  }
  /* доски пола лежат под людьми, а бумага (пятна, зерно, виньетка) — над ними */
  const order = await p.evaluate(() => { const { WORLD } = window.__dbg, c = WORLD.hall.children; return { wood: c.indexOf(WORLD.floorGrain), cust: c.indexOf(WORLD.cust), sit: c.indexOf(WORLD.sitC), last: c.length - 1 }; });
  ok('текстура досок пола под гостями', order.wood >= 0 && order.wood < order.cust && order.wood < order.sit, JSON.stringify(order));

  const real = errs.filter(e => !/willReadFrequently/.test(e));
  console.log(real.length ? real.join(String.fromCharCode(10)) : 'NO_ERRORS');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
