// Пилотные спецификации моделей напитков (Н0). Цвета берутся из кода игры (paletteOf, recipes.ts) и палитры art-src.
const { C } = require('./drinks-art.cjs');
const FOAM = '#F1DFC2', FOAM_W = '#FBF4E8', MILK = '#F3E7D0', COF = '#8A5B3A', MIXC = '#C99B6E', ESP = '#4A2E20';
module.exports = {
  latte: { name: 'Латте', hot: true, vessel: 'glass', fill: 0.9,
    layers: [{ col: MILK, frac: 0.5, edge: 'soft' }, { col: MIXC, frac: 0.15, edge: 'soft' }, { col: COF, frac: 0.15, edge: 'soft' }, { col: FOAM, frac: 0.2, edge: 'sharp' }],
    top: { col: '#D9B98F', art: FOAM_W }, sizes: ['0.2', '0.6'] },
  cappuccino: { name: 'Капучино', hot: true, vessel: 'ceramic', fill: 0.92, layers: [{ col: FOAM, frac: 1, edge: 'sharp' }],
    top: { col: FOAM, ring: MIXC, art: FOAM_W }, sizes: ['0.2', '0.6'] },
  orange_bumble: { name: 'Апельсиновый бамбл', hot: false, vessel: 'glass', fill: 0.96, iceAuto: true,
    layers: [{ col: '#F2A33A', frac: 0.5, edge: 'wavy' }, { col: '#B8742B', frac: 0.08, edge: 'wavy' }, { col: ESP, frac: 0.42, edge: 'sharp' }],
    top: { col: ESP }, swirl: { from: 1 }, sizes: ['0.3', '0.6'] }
,
  /* было: лёд Н0 (6 белых кубиков); без льда — для проверки чтения слоёв */
  orange_bumble_old: { name: 'Апельсиновый бамбл, лёд Н0', hot: false, vessel: 'glass', fill: 0.96, ice: 6, iceStyle: 'old',
    layers: [{ col: '#F2A33A', frac: 0.5, edge: 'wavy' }, { col: '#B8742B', frac: 0.08, edge: 'wavy' }, { col: ESP, frac: 0.42, edge: 'sharp' }],
    top: { col: ESP }, swirl: { from: 1 }, sizes: ['0.3', '0.6'] },
  orange_bumble_n11: { name: 'Апельсиновый бамбл, лёд Н1-1 (5 кубиков)', hot: false, vessel: 'glass', fill: 0.96, iceAuto: true, iceStyle: 'n11',
    layers: [{ col: '#F2A33A', frac: 0.5, edge: 'wavy' }, { col: '#B8742B', frac: 0.08, edge: 'wavy' }, { col: ESP, frac: 0.42, edge: 'sharp' }],
    top: { col: ESP }, swirl: { from: 1 }, sizes: ['0.3', '0.6'] },
  orange_bumble_noice: { name: 'Апельсиновый бамбл, без льда', hot: false, vessel: 'glass', fill: 0.96, ice: 0,
    layers: [{ col: '#F2A33A', frac: 0.5, edge: 'wavy' }, { col: '#B8742B', frac: 0.08, edge: 'wavy' }, { col: ESP, frac: 0.42, edge: 'sharp' }],
    top: { col: ESP }, swirl: { from: 1 }, sizes: ['0.3', '0.6'] },
  /* холодное капучино: эспрессо на дно, молоко с кофе (цвет liqCol из barPaint), холодная пена сверху */
  cold_cappuccino: { name: 'Холодное капучино', hot: false, vessel: 'glass', fill: 0.96, iceAuto: true,
    layers: [{ col: ESP, frac: 0.12, edge: 'soft' }, { col: MIXC, frac: 0.5, edge: 'soft' }, { col: FOAM, frac: 0.38, edge: 'sharp' }],
    top: { col: FOAM }, sizes: ['0.3', '0.6'] }
};
