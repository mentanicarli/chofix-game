/* ---------- атмосфера кофейни ---------- */
let AMB = null, fhKey = '';
function ambTick() {
  const on = G && G.phase === 'day' && !paused;
  if (on && !AMB && AC) AMB = loopSnd('amb', 0, 1);
  if (AMB) AMB.set(on ? (stage.classList.contains('inbar') ? .05 : .09) : 0, 1);
  const k = [G && G.phase, paused, stage.classList.contains('inbar'), !!BR, !!(D && D.cup)].join();
  if (k !== fhKey) { fhKey = k; frontHintUpd(); }
}
/* ---------- кадр бара ---------- */
function barTick(dt) {
  if (!BR) { hlEl.hidden = true; hlKey = ''; return; }
  barSim(dt); barPaint(dt);
  if (stage.classList.contains('inbar')) { drawInset(); drawTicket(); drawCoach(); tutHl(); }
  const xin = MENUAPI.PANEL_TASKS.has(BR.inset);
  bi.style.display = BR.inset && BR.inset !== 'food' && !xin && stage.classList.contains('inbar') ? 'block' : 'none';
  fpEl.hidden = !(BR.inset === 'food' && stage.classList.contains('inbar'));
  xEl.hidden = !(xin && stage.classList.contains('inbar'));
  if (bi.style.display === 'none') bp.style.display = 'none';
}


/* ---- запекаем зерно бумаги в один canvas (дорогие SVG-фильтры + multiply пересчитывались каждый кадр) ---- */
(function bakePaper(){
  try {
    const el = document.getElementById('paper'); if (!el) return;
    const defs = ['blotch','woodH','woodV','grain'].map(id => { const f = document.getElementById(id); return f ? new XMLSerializer().serializeToString(f) : ''; }).join('');
    const vig = document.getElementById('gVig'); const vigS = vig ? new XMLSerializer().serializeToString(vig) : '';
    const inner = el.innerHTML.replace(/mix-blend-mode:\s*multiply/g, '');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs>' + defs + vigS + '</defs>' + inner + '</svg>';
    const img = new Image();
    img.onload = () => {
      // multiply поверх белого холста = как multiply поверх сцены; затем в альфу чёрного
      const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1280, 720);
      g.globalCompositeOperation = 'multiply'; g.drawImage(img, 0, 0);
      // multiply-по-белому -> обычное наложение «цвет + альфа»: c*k == c*(1-a) + C*a (точно для белого, близко для светлого)
      const im = g.getImageData(0, 0, 1280, 720), d = im.data;
      for (let i = 0; i < d.length; i += 4) {
        const kr = d[i] / 255, kg = d[i + 1] / 255, kb = d[i + 2] / 255, a = 1 - Math.max(kr, kg, kb);
        if (a < .002) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; }
        d[i] = Math.max(0, (kr - (1 - a)) / a * 255); d[i + 1] = Math.max(0, (kg - (1 - a)) / a * 255); d[i + 2] = Math.max(0, (kb - (1 - a)) / a * 255); d[i + 3] = a * 255;
      }
      g.putImageData(im, 0, 0);
      c.id = 'paperc'; c.setAttribute('aria-hidden', 'true');
      c.style.cssText = 'position:absolute;left:0;top:0;width:1280px;height:720px;pointer-events:none';
      el.replaceWith(c);
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  } catch (e) {}
})();

