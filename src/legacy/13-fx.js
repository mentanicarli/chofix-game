/* ---------- частицы, свет, анимация персонажей ---------- */
const ACT = new Set();
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fxT = { cup: 0, held: 0, wand: 0, drip: 0, dust: 0 };
const emit = o => FX.add(o);
const dayK = () => (D && G && G.phase === 'day') ? clamp(D.t / DAY_LEN, 0, 1) : (G && G.phase === 'evening' ? 1 : .3);
function stagePos(el) {
  const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = (s.width / 1280) || 1;
  return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k };
}
function coinBurst(x, amount) {
  const n = clamp(Math.round(amount / 35), 3, 8), tp = stagePos($('#chMoney'));
  for (let i = 0; i < n; i++) emit({ kind: 'coin', x0: x + rnd(-14, 14), y0: 392, tx: tp.x + rnd(-24, 24), ty: tp.y, t: -i * .07, life: 1 + rnd(0, .15), arc: rnd(-60, 60) });
}
function tickFx(dt) {
  if (!RM) {
    if (D && D.cup) { fxT.held += dt; if (fxT.held > .16) { fxT.held = 0; emit({ x: 788 + rnd(-3, 3), y: 351, vx: rnd(-4, 4), vy: -rnd(18, 28), r: 2.5, grow: 9, a: .5, life: 2 }); } }
    const milk = !!(BR && BR.inset === 'steam' && BR.hold);
    fxT.wand += dt;
    if (fxT.wand > (milk ? .05 : .5)) { fxT.wand = 0; emit({ x: 1114 + rnd(-2, 2), y: 392, vx: rnd(-6, 6), vy: -rnd(24, 40), r: 2.5, grow: milk ? 12 : 8, a: milk ? .6 : .22, life: milk ? 1.3 : 2, col: milk ? '255,255,255' : '235,225,205' }); }
    if (BR && BR.shot.st === 'run') {
      fxT.drip += dt;
      if (fxT.drip > .07) {
        fxT.drip = 0;
        emit({ kind: 'drop', x: 991 + rnd(-1, 1), y: 378, vy: 90, g: 500, r: 1.7, a: .95, life: .22, col: '74,44,30' });
        if (Math.random() < .5) emit({ x: 991 + rnd(-8, 8), y: 396, vx: rnd(-5, 5), vy: -rnd(18, 28), r: 3, grow: 9, a: .35, life: 1.5 });
      }
    }
  }
  fxT.dust += dt;
  if (fxT.dust > .5 && FX.count('dust') < 14) {
    fxT.dust = 0; const u = Math.random();
    emit({ kind: 'dust', x: 330 + u * 230 + rnd(-30, 30), y: 130 + u * 430 + rnd(-30, 30), vx: rnd(-3, 3), vy: rnd(-5, 2), r: rnd(1.3, 2.4), a: .8, life: rnd(5, 9), col: '255,244,200' });
  }
}

function animActors(dt) {
  const now = performance.now() / 1000;
  ACT.forEach(c => {
    const held = c.hold > 0; if (held) c.hold -= dt;
    const dx = c.tx - c.px, dist = Math.abs(dx);
    /* скорость плавно набирается и гасится: разгон мягче, торможение резче */
    const want = held ? 0 : Math.sign(dx) * Math.min(dist * 3.2, c.leaving ? 215 : 170);
    c.v = c.v || 0;
    const acc = (Math.abs(want) > Math.abs(c.v) ? 820 : 1500) * dt;
    c.v += clamp(want - c.v, -acc, acc);
    const step = c.v * dt; c.px += Math.abs(step) > dist ? dx : step;
    c.ty += ((c.leaving ? 14 : 0) - c.ty) * (1 - Math.exp(-dt * 5));
    /* подскоки: сам прыжок (с растяжением и сжатием) считает гость */
    if (c.hopT > 0) { c.act.hop(c.hopT > .5 ? 1 : .55); c.hopT = 0; }
    c.act.update(dt, c.px, c.ty);
    if (!c.arrived && !c.leaving && dist < 6) { c.arrived = true; c.act.showBubble(true); WORLD.baristaReact(); play('door', .5); }
    /* реплика живёт 5 секунд именно в зале: в баре или на паузе время не идёт, ушёл в бар — покажется снова */
    if (c.arrived && !c.leaving && !c.sayDone && !paused) {
      if (stage.classList.contains('inbar')) hideSay(c);
      else if (c.sayEl) { c.sayVis += dt; if (c.sayVis >= c.sayDur) { hideSay(c); c.sayDone = true; } else placeSay(c); }
      else if (D.customers.every(o => o === c || !o.sayEl)) showSay(c);
    }
    if (c.leaving && c.px < -100) { WORLD.removeActor(c.act); ACT.delete(c); }
  });
}

let bt = 0, armA = 0, servePulse = 0;
let arm2A = 0;
function animBarista(dt) {
  bt += dt;
  let tgt = 1.6 * Math.sin(bt * 1.7), nod = 1.6 * Math.sin(bt * 1.3 + 1), t2 = 2 * Math.sin(bt * 1.4 + 2);
  if (BR) {
    const m = BR.inset;
    if (m === 'grind' && BR.hold) { tgt = 7 * Math.sin(bt * 19); nod += 2 * Math.sin(bt * 19); t2 = -6 * Math.sin(bt * 19); }
    else if (m === 'steam' && BR.hold) { tgt = clamp((BR.my - 80) * .14, -12, 12); t2 = 8 * Math.sin(bt * 7); }
    else if (m === 'pour') tgt = 5 * Math.sin(bt * 5) * (BR.hold ? 1 : .3);
    else if (BR.shot.st === 'run') { tgt = -5; t2 = -9; }
    else tgt = -5 + 1.5 * Math.sin(bt * 3);
  }
  if (servePulse > 0) { servePulse = Math.max(0, servePulse - dt); tgt = -20 * Math.sin((1 - servePulse / .55) * Math.PI); }
  armA += (tgt - armA) * (1 - Math.exp(-dt * 16));
  arm2A += (t2 - arm2A) * (1 - Math.exp(-dt * 12));
  /* нагрузка: очередь и терпение гостей видны по лицу */
  let stress = 0;
  if (D && G && G.phase === 'day') { const w = D.customers.filter(c => c.arrived); if (w.length >= 3 || w.some(c => c.pat / c.max < .3)) stress = 2; else if (w.length >= 2) stress = 1; }
  WORLD.setBaristaStress(stress);
  WORLD.setBarista({ arm: armA, arm2: arm2A, nod, bob: 1.3 * Math.sin(bt * 2.2) });
}

/* деньги плавно, свет по времени дня */
let shownMoney = 500, lastMoneyTxt = '', tintT = 1;
function tickMoney(dt) {
  if (!G) return;
  if (Math.abs(G.money - shownMoney) > 900) shownMoney = G.money;
  shownMoney += (G.money - shownMoney) * (1 - Math.exp(-dt * 7));
  if (Math.abs(G.money - shownMoney) < .5) shownMoney = G.money;
  const t = money(shownMoney);
  if (t !== lastMoneyTxt) { lastMoneyTxt = t; $('#chMoney span').textContent = t; }
}
const TINT = [[0, [255, 226, 176]], [.25, [255, 243, 222]], [.5, [255, 252, 246]], [.75, [255, 232, 196]], [1, [244, 186, 140]]];
function tickTint(dt) {
  tintT += dt; if (tintT < .5) return; tintT = 0;
  const k = dayK(); let a = TINT[0], b = TINT[TINT.length - 1];
  for (let i = 0; i < TINT.length - 1; i++) if (k >= TINT[i][0] && k <= TINT[i + 1][0]) { a = TINT[i]; b = TINT[i + 1]; break; }
  const u = b[0] === a[0] ? 0 : (k - a[0]) / (b[0] - a[0]);
  $('#tint').style.background = `rgb(${a[1].map((v, i) => Math.round(v + (b[1][i] - v) * u)).join(',')})`;
}

/* ---------- живая сцена: небо, часы, лампы, свет — считает мир (Pixi), здесь только время ---------- */
function tickSky(dt) {
  const cm = (D && G.phase === 'day') ? OPEN_MIN + Math.min(1, D.t / DAY_LEN) * SPAN_MIN : (G && G.phase === 'evening' ? OPEN_MIN + SPAN_MIN : OPEN_MIN);
  WORLD.update(dt, dayK(), cm);
}

/* ---------- эффекты подачи: летящая чашка, сердечки, искры ---------- */
function cupFly(x1, y1, x2, y2, topCol, k) { FX.add({ life: .42, kind: 'cup', x0: x1, y0: y1, tx: x2, ty: y2, col: topCol, cs: k || 1 }); }
function loveBurst(x, y, n, col) {
  for (let i = 0; i < n; i++) FX.add({ t: -i * .09, life: 1.25 + Math.random() * .3, kind: 'heart', x: x + rnd(-16, 16), y, vx: rnd(-8, 8), vy: -rnd(34, 52), r: rnd(6, 9), col: col || '232,120,120', g: 0 });
}
function sparkBurst(x, y, n) {
  for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * .4; FX.add({ t: 0, life: .55, kind: 'spark', x, y, vx: Math.cos(a) * rnd(40, 80), vy: Math.sin(a) * rnd(40, 80), r: rnd(3.5, 6), col: '255,214,110', g: 0 }); }
}
function puffBurst(x, y) {
  for (let i = 0; i < 4; i++) emit({ x: x + rnd(-12, 12), y, vx: rnd(-14, 14), vy: -rnd(14, 26), r: 6, grow: 14, a: .5, life: 1, col: '110,90,80' });
}

/* кадр вздрагивает при ошибке */
function kick() { if (RM) return; stage.classList.remove('kick'); void stage.offsetWidth; stage.classList.add('kick'); }

/* большой заголовок дня */
function banner(big, small) {
  const b = $('#banner'); b.innerHTML = `<b>${big}</b>${small ? '<span>' + small + '</span>' : ''}`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

WORLD.init($('#world'), worldRes()).then(() => {
  applySettings(); tickSky(0);
  newGame(); updateHud(); showTitle();
  requestAnimationFrame(frame);
  const bt = $('#boot'); bt.classList.add('done'); setTimeout(() => bt.remove(), 600);
}).catch(e => {
  const bt = $('#boot'); if (bt) bt.remove();
  console.error('cuppable: мир не запустился', e);
  const m = document.createElement('div'); m.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:40px;font:700 22px Nunito,sans-serif;color:#4A2F25;background:#F6EAD6;z-index:20';
  m.textContent = 'Не удалось запустить графику (нужен WebGL). Обновите браузер или включите аппаратное ускорение.'; stage.appendChild(m);
});
