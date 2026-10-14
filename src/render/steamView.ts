import { INK, SOFT, clamp, type Brush } from './brush';

export interface SteamView {
  ml: number;
  foam: number;
  coarse: number;
  temp: number;
  steamed: boolean;
  hold: boolean;
  my: number;
  thermo: boolean;
  /** зона температуры напитка с учётом питчера с термометром */
  zone: readonly [number, number];
  /** вместимость питчера, мл */
  cap: number;
  targetFoam: number;
  now: number;
}

export function drawSteam(b: Brush, v: SteamView): void {
  const cap = v.cap;
  const vol = (v.ml * (1 + 0.6 * v.foam)) / cap;
  const surf = 330 - vol * 220;
  const mil = 330 - (v.ml / cap) * 220;
  const px = 62;
  const pw = 150;
  // ручка
  const handle = () => b.g.moveTo(px + pw - 2, 128).bezierCurveTo(px + pw + 46, 128, px + pw + 40, 230, px + pw - 8, 236);
  handle().stroke({ width: 9, color: INK, cap: 'round', join: 'round' });
  handle().stroke({ width: 4, color: '#C9C8C0', cap: 'round', join: 'round' });
  const jug = [px, 110, px + pw, 110, px + pw - 12, 332, px + 12, 332];
  b.shape(jug, '#E4E2DA');
  b.clip((g) => g.poly(jug), () => {
    b.g.rect(px, mil, pw, 340 - mil).fill('#FBF4E8');
    b.g.rect(px, surf, pw, mil - surf).fill('#FFFFFF');
    for (let i = 0; i < 20 && v.coarse > 0.3; i++) {
      b.g.circle(px + 10 + ((i * 37) % (pw - 20)), surf + 2 + ((i * 11) % Math.max(4, mil - surf)), 2 + v.coarse * 3).stroke({ width: 1.5, color: 'rgba(74,47,37,.25)' });
    }
    b.g.rect(px, surf, pw, 16).fill('rgba(232,176,74,.3)');
  });
  b.shape(jug, null, { w: 3, col: INK, join: 'round' });
  // трубка
  const tipY = clamp(v.my, 70, 326);
  const depth = tipY - surf;
  const wx = px + pw - 34;
  b.line(wx, 62, wx, tipY, '#4A2F25', 12);
  b.line(wx, 62, wx, tipY, '#BFC4C2', 6);
  b.disc(wx, tipY, 6, '#BFC4C2', { w: 2.5, col: '#BFC4C2' });
  if (v.hold && !v.steamed) {
    for (let i = 0; i < 6; i++) {
      const a = v.now / 130 + i;
      b.disc(wx + Math.sin(a * 1.7) * 14, tipY + 6 + ((a * 9) % 22), 2.4, 'rgba(255,248,236,.9)');
    }
  }
  const state = !v.hold ? 'пар выключен' : depth < 0 ? 'брызги: опустите ниже' : depth <= 16 ? 'воздух: пена растёт' : 'прогрев';
  b.text(state, 22, 80, 15, depth < 0 && v.hold ? '#C4694A' : SOFT);
  // термометр
  const tx0 = 330;
  const ty0 = 80;
  const th = 240;
  const yT = (val: number) => ty0 + th - (val / 90) * th;
  b.rr(tx0 - 11, ty0, 22, th, 11).fill('#E7D6BC');
  b.rr(tx0 - 11, ty0, 22, th, 11).stroke({ width: 3, color: INK });
  const lo = v.zone[0];
  const hi = v.zone[1];
  b.rr(tx0 - 11, yT(hi), 22, yT(lo) - yT(hi), 5).fill('#93A684');
  b.rr(tx0 - 11, yT(hi), 22, yT(lo) - yT(hi), 5).stroke({ width: 3, color: INK });
  b.rr(tx0 - 7, yT(v.temp), 14, ty0 + th - yT(v.temp), 6).fill(v.temp > hi ? '#E0745A' : '#C4694A');
  b.text(Math.round(v.temp) + '°', tx0, ty0 + th + 26, 20, INK, 'center');
  // пена
  const fx0 = 30;
  const fw = 230;
  b.text('Пена', 30, 352, 14, SOFT);
  b.rr(fx0, 358, fw, 14, 7).fill('#E7D6BC');
  b.rr(fx0, 358, fw, 14, 7).stroke({ width: 2.5, color: INK });
  b.rr(fx0 + (v.targetFoam - 0.12) * fw, 358, 0.24 * fw, 14, 4).fill('#93A684');
  b.rr(fx0 + (v.targetFoam - 0.12) * fw, 358, 0.24 * fw, 14, 4).stroke({ width: 2.5, color: INK });
  b.rr(fx0, 358, Math.max(8, v.foam * fw), 14, 7).fill('rgba(255,255,255,.85)');
  b.rr(fx0, 358, Math.max(8, v.foam * fw), 14, 7).stroke({ width: 2.5, color: INK });
  b.button('steamDone', 296, 384, 114, 52, 'Готово', { col: '#B9CAA9' });
  b.text('Мышь ↕ глубина, зажмите: пар', 30, 412, 14, SOFT, 'left', 700);
}
