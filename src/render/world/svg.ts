import { Texture } from 'pixi.js';
import DEFS from '../../assets/art/defs.svgf?raw';
import type { Box } from './art';

export type { Box };

/** Целый SVG-документ: общие defs (градиенты, фильтры) + кусок сцены, рамка = viewBox. */
export function svgDoc(inner: string, b: Box, scale: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" width="${Math.ceil(b.w * scale)}" height="${Math.ceil(b.h * scale)}"><defs>${DEFS}</defs>${inner}</svg>`;
}

async function loadImage(inner: string, b: Box, scale: number): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svgDoc(inner, b, scale)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad(new Error('svg raster failed'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Бумажная фактура одним слоем: пятна, волокна дерева, зерно и виньетка запекаются в одну текстуру «цвет + альфа».
 * Умножение по белому холсту переводится в обычное наложение (точно для белого, близко для светлого),
 * поэтому на экране один дешёвый спрайт вместо четырёх дорогих multiply-слоёв.
 */
export async function bakePaper(inner: string, b: Box): Promise<Texture> {
  const img = await loadImage(inner, b, 1);
  const c = document.createElement('canvas');
  c.width = b.w;
  c.height = b.h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, b.w, b.h);
  g.globalCompositeOperation = 'multiply';
  g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, b.w, b.h);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const kr = (d[i] as number) / 255;
    const kg = (d[i + 1] as number) / 255;
    const kb = (d[i + 2] as number) / 255;
    const a = 1 - Math.max(kr, kg, kb);
    if (a < 0.002) {
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      continue;
    }
    d[i] = Math.max(0, ((kr - (1 - a)) / a) * 255);
    d[i + 1] = Math.max(0, ((kg - (1 - a)) / a) * 255);
    d[i + 2] = Math.max(0, ((kb - (1 - a)) / a) * 255);
    d[i + 3] = a * 255;
  }
  g.globalCompositeOperation = 'source-over';
  g.putImageData(im, 0, 0);
  const t = Texture.from(c);
  t.source.scaleMode = 'linear';
  return t;
}

/** Рисует SVG-кусок в текстуру нужной плотности. Весь рисованный арт игры проходит через эту функцию. */
export async function raster(inner: string, b: Box, scale: number): Promise<Texture> {
  const url = URL.createObjectURL(new Blob([svgDoc(inner, b, scale)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad(new Error('svg raster failed'));
      img.src = url;
    });
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(b.w * scale);
    cv.height = Math.ceil(b.h * scale);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    const t = Texture.from(cv);
    t.source.scaleMode = 'linear';
    return t;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Мелкий вспомогательный холст-текстура (градиенты, частицы). */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  return Texture.from(cv);
}

export interface AtlasFrame { x: number; y: number; w: number; h: number; box: Box }
export interface Atlas { tex: Texture; scale: number; frames: Map<string, AtlasFrame> }

/**
 * Общий атлас: все клетки рисуются одним SVG и одной текстурой, дальше из неё нарезаются кадры.
 * wrap оборачивает клетку (контур, дрожание линий); между клетками остаётся зазор, чтобы линейная фильтрация не подмешивала соседей.
 */
export async function rasterAtlas(cells: { id: string; box: Box; svg: string }[], scale: number, wrap: (svg: string, box: Box, id: string) => string): Promise<Atlas> {
  const GAP = 3;
  const MAXW = 300;
  let cx = GAP;
  let cy = GAP;
  let rowH = 0;
  let W = 0;
  const place: { id: string; x: number; y: number; box: Box; svg: string }[] = [];
  for (const c of cells) {
    const w = Math.ceil(c.box.w);
    const h = Math.ceil(c.box.h);
    if (cx + w + GAP > MAXW && cx > GAP) {
      cx = GAP;
      cy += rowH + GAP;
      rowH = 0;
    }
    place.push({ id: c.id, x: cx, y: cy, box: c.box, svg: c.svg });
    cx += w + GAP;
    rowH = Math.max(rowH, h);
    W = Math.max(W, cx);
  }
  const H = cy + rowH + GAP;
  const inner = place.map((p) => `<g transform="translate(${p.x - p.box.x} ${p.y - p.box.y})">${wrap(p.svg, p.box, 'f_' + p.id)}</g>`).join('');
  const tex = await raster(inner, { x: 0, y: 0, w: W, h: H }, scale);
  const frames = new Map<string, AtlasFrame>();
  for (const p of place) frames.set(p.id, { x: p.x * scale, y: p.y * scale, w: Math.ceil(p.box.w) * scale, h: Math.ceil(p.box.h) * scale, box: p.box });
  return { tex, scale, frames };
}
