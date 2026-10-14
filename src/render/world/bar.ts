import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import PARTS from '../../assets/art/bar-parts.json';
import { raster } from './svg';

interface Box { x: number; y: number; w: number; h: number }
interface TextSpec { t: string; x: number; y: number; size: number; weight: string; fill: string; family: string; tl: number | null }
interface Part { svg: string; box: Box; texts: TextSpec[] }

const P = PARTS as unknown as Record<string, Part>;
const INK = 0x4a2f25;

/** Слой жидкости в чашке: от дна вверх, y/h в координатах чашки. */
export interface CupRect { y: number; h: number; col: string }

/** Всё, что меняется в баре от кадра к кадру. Считает игра, рисует Pixi. */
export interface BarFrame {
  pf: { x: number; y: number };
  cof: boolean;
  grindDeg: number;
  /** доза в бункере 0..40 */
  dose: number;
  tamperUp: boolean;
  /** масштаб модели чашки по объёму напитка: 1 = 0,2 л (cupScale в src/game/volumes.ts) */
  cupK: number;
  /** раф: эспрессо льётся в питчер под группой, пока в него не налили сливки; level — доля налитого */
  pitUnder: { level: number } | null;
  ice: number;
  rects: CupRect[];
  topY: number;
  topRx: number;
  topCol: string;
  topOn: boolean;
  art: { pts: [number, number][]; alpha: number } | null;
  pitH: number;
  stream: { y: number; h: number; col: string } | null;
  gaugeDeg: number;
  steam: boolean;
  bell: number;
  ring: { x: number; y: number; a: number; s: number } | null;
}

export interface BarUpgrades {
  /** холодильник с молоком (покупка «Молоко и капучино») */
  milk: boolean;
  ice: boolean;
  eq: Record<string, boolean>;
  snacks: boolean;
  pastry: boolean;
  dessert: boolean;
  deli: boolean;
  micro: boolean;
}

const hexNum = (c: string): number => {
  if (c.startsWith('#')) return parseInt(c.slice(1), 16);
  const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(c);
  return m ? ((+(m[1] as string)) << 16) | ((+(m[2] as string)) << 8) | +(m[3] as string) : 0xffffff;
};

/** Бар: статичный арт одним спрайтом, подвижные детали — отдельными узлами. */
export class BarScene {
  readonly root = new Container();
  private tex = new Map<string, Texture>();
  private res = 1;
  private pf = new Container();
  private cof = new Graphics();
  private dial = new Container();
  private hopRect = new Graphics();
  private tamper = new Container();
  private needle = new Container();
  private pitMilk = new Graphics();
  private bell = new Container();
  private stream = new Graphics();
  private cupC = new Container();
  private saucer = new Graphics();
  private pitUnderG = new Container();
  private pitCoffee = new Graphics();
  private inner = new Container();
  private layers = new Graphics();
  private ice = new Container();
  private top = new Graphics();
  private art = new Graphics();
  private steam!: Sprite;
  private ring = new Container();
  private fridge = new Container();
  private iceMaker = new Container();
  private showcase = new Container();
  private subs = new Map<string, Container>();
  private eq = new Map<string, Container>();
  private lastKey = '';
  private lastHop = -1;
  private lastPit = -1;

  async build(res: number, fontRes: number): Promise<void> {
    this.res = res;
    const ids = Object.keys(P);
    await Promise.all(ids.map(async (id) => {
      const p = P[id] as Part;
      this.tex.set(id, await raster(p.svg, p.box, res));
    }));
    const R = this.root;
    const spr = (id: string, parent: Container = R): Sprite => {
      const p = P[id] as Part;
      const s = new Sprite(this.tex.get(id));
      s.position.set(p.box.x, p.box.y);
      s.width = p.box.w;
      s.height = p.box.h;
      parent.addChild(s);
      return s;
    };
    const txt = (id: string, parent: Container): void => {
      (P[id] as Part).texts.forEach((t) => {
        const x = new Text({ text: t.t, style: { fontFamily: t.family === 'Caveat' ? 'Caveat, Nunito, cursive' : 'Nunito, sans-serif', fontSize: t.size, fontWeight: t.weight as '700', fill: t.fill, padding: 4 }, resolution: fontRes });
        x.anchor.set(0.5, 0.5);
        if (t.tl) x.scale.x = t.tl / Math.max(1, x.width);
        x.position.set(t.x, t.y - t.size * (t.family === 'Caveat' ? 0.3 : 0.36));
        parent.addChild(x);
      });
    };

    spr('static');
    txt('static', R);
    /* холодильник с молоком: рисуется под кофемолкой и сиропами, как раньше в статике */
    spr('milk', this.fridge);
    txt('milk', this.fridge);
    R.addChild(this.fridge);

    /* кофемолка: стекло, зерно (движется), корпус, ручка помола */
    spr('grinderBack');
    const hop = new Container();
    hop.position.set(160, 470);
    const hopMask = new Graphics().poly([-52, -208, -72, -312, 72, -312, 52, -208]).fill(0xffffff);
    hop.addChild(hopMask, this.hopRect);
    const beans = new Container();
    [[-30, -250, -20], [22, -232, 25]].forEach(([x, y, a]) => {
      const b = new Graphics().ellipse(0, 0, 8, 5).fill(0x8a5b3a);
      b.position.set(x as number, y as number);
      b.rotation = ((a as number) * Math.PI) / 180;
      beans.addChild(b);
    });
    this.hopRect.mask = hopMask;
    hop.addChild(beans);
    beans.mask = hopMask;
    R.addChild(hop);
    spr('grinderFront');
    this.dial.position.set(160, 332);
    const d = spr('dial', this.dial);
    d.position.set(136 - 160, 308 - 332);
    R.addChild(this.dial);

    this.tamper.addChild(spr('tamper', this.tamper));
    R.addChild(this.tamper);

    this.needle.position.set(630, 257);
    const n = spr('needle', this.needle);
    n.position.set(600 - 630, 225 - 257);
    R.addChild(this.needle);

    spr('pitBack');
    const pm = new Container();
    pm.position.set(940, 514);
    const pmask = new Graphics().moveTo(-30, -80).lineTo(30, -80).lineTo(26, -4).quadraticCurveTo(0, 4, -26, -4).closePath().fill(0xffffff);
    pm.addChild(pmask, this.pitMilk);
    this.pitMilk.mask = pmask;
    R.addChild(pm);
    spr('pitFront');

    this.bell.position.set(1032, 526);
    const bs = spr('bell', this.bell);
    bs.position.set(985 - 1032, 465 - 526);
    R.addChild(this.bell);

    /* портафильтр */
    spr('pfA', this.pf);
    this.cof.rect(-30, -10, 60, 8).fill(0x4a2e20);
    this.pf.addChild(this.cof);
    spr('pfB', this.pf);
    R.addChild(this.pf);

    R.addChild(this.stream);

    /* чашка */
    this.cupC.position.set(630, 478);
    const saucer = this.saucer;
    saucer.ellipse(0, 7, 76, 10).fill(0xe9ddc7).stroke({ width: 3, color: INK });
    saucer.ellipse(0, 5, 52, 5).fill(0xd9cdb6);
    this.cupC.addChild(saucer, this.inner);
    const shape = (g: Graphics): Graphics => g.moveTo(-55, -78).lineTo(55, -78).lineTo(45, -6).quadraticCurveTo(0, 10, -45, -6).closePath();
    this.inner.addChild(shape(new Graphics()).fill(0xfff8ec));
    this.inner.addChild(new Graphics().ellipse(0, -78, 55, 9).fill(0xe9ddc7));
    const clip = new Container();
    const cmask = shape(new Graphics()).fill(0xffffff);
    clip.addChild(cmask, this.layers, this.ice);
    clip.mask = cmask;
    this.inner.addChild(clip);
    [[-38, -44, 26, -10, 0.6], [-8, -50, 28, 8, 0.6], [18, -34, 24, -6, 0.6], [-26, -22, 22, 12, 0.55]].forEach(([x, y, s, a, al]) => {
      const g = new Graphics().roundRect(-(s as number) / 2, -(s as number) / 2, s as number, s as number, 5).fill({ color: 0xffffff, alpha: al as number }).stroke({ width: 2, color: 0xdceef1 });
      g.position.set((x as number) + (s as number) / 2, (y as number) + (s as number) / 2);
      g.rotation = ((a as number) * Math.PI) / 180;
      this.ice.addChild(g);
    });
    this.inner.addChild(shape(new Graphics()).stroke({ width: 2.5, color: 0xfff8ec }));
    const handle = new Graphics().moveTo(55, -62).quadraticCurveTo(82, -62, 76, -34).quadraticCurveTo(72, -16, 48, -20).stroke({ width: 7, color: 0xfff8ec, cap: 'round' });
    this.inner.addChild(handle, this.top, this.art);
    this.inner.addChild(new Graphics().moveTo(-48, -62).quadraticCurveTo(-46, -30, -38, -14).stroke({ width: 4, color: 0xffffff, alpha: 0.55, cap: 'round' }));
    R.addChild(this.cupC);
    /* питчер из нержавейки под группой (раф): корпус, уровень эспрессо, носик и ручка */
    const pb = new Graphics();
    pb.poly([-34, -72, 34, -72, 26, -4, -26, -4]).fill(0xd8d8d0).stroke({ width: 3, color: INK, join: 'round' });
    pb.moveTo(34, -60).quadraticCurveTo(62, -58, 56, -30).quadraticCurveTo(52, -14, 28, -18).stroke({ width: 7, color: INK, cap: 'round' });
    pb.moveTo(34, -60).quadraticCurveTo(62, -58, 56, -30).quadraticCurveTo(52, -14, 28, -18).stroke({ width: 3.5, color: 0xc9c8c0, cap: 'round' });
    this.pitUnderG.addChild(pb, this.pitCoffee);
    this.pitUnderG.position.set(630, 482);
    this.pitUnderG.visible = false;
    R.addChild(this.pitUnderG);

    this.steam = spr('steam');
    this.steam.alpha = 0;

    /* кольцо подсказки */
    const ringG = new Graphics();
    for (let i = 0; i < 15; i++) {
      const a0 = (i / 15) * Math.PI * 2;
      ringG.moveTo(Math.cos(a0) * 46, Math.sin(a0) * 46).arc(0, 0, 46, a0, a0 + 10 / 46).stroke({ width: 5, color: 0xfff2c6 });
    }
    ringG.circle(0, 0, 52).stroke({ width: 3, color: 0xe8b04a, alpha: 0.7 });
    this.ring.addChild(ringG);
    this.ring.alpha = 0;
    R.addChild(this.ring);

    /* улучшения */
    spr('ice', this.iceMaker);
    txt('ice', this.iceMaker);
    R.addChild(this.iceMaker);
    spr('showcase', this.showcase);
    txt('showcase', this.showcase);
    ['scSnacks', 'scPastry', 'scDessert', 'scDeli', 'scMicro'].forEach((k) => {
      const c = new Container();
      spr(k, c);
      this.showcase.addChild(c);
      this.subs.set(k, c);
    });
    R.addChild(this.showcase);
    ids.filter((k) => k.startsWith('eq_')).forEach((k) => {
      const c = new Container();
      spr(k, c);
      txt(k, c);
      R.addChild(c);
      this.eq.set(k.slice(3), c);
    });
    this.setUpgrades({ milk: false, ice: false, eq: {}, snacks: false, pastry: false, dessert: false, deli: false, micro: false });
    this.root.visible = false;
  }

  setUpgrades(u: BarUpgrades): void {
    this.fridge.visible = u.milk;
    this.iceMaker.visible = u.ice;
    this.showcase.visible = u.snacks || u.pastry || u.dessert || u.deli;
    this.subs.get('scSnacks')!.visible = u.snacks;
    this.subs.get('scPastry')!.visible = u.pastry;
    this.subs.get('scDessert')!.visible = u.dessert;
    this.subs.get('scDeli')!.visible = u.deli;
    this.subs.get('scMicro')!.visible = u.micro;
    this.eq.forEach((c, k) => (c.visible = !!u.eq[k]));
  }

  paint(f: BarFrame): void {
    this.pf.position.set(f.pf.x, f.pf.y);
    this.cof.visible = f.cof;
    this.dial.rotation = (f.grindDeg * Math.PI) / 180;
    if (f.dose !== this.lastHop) {
      this.lastHop = f.dose;
      const dy = (f.dose / 40) * 40;
      this.hopRect.clear().rect(-80, -302 + dy, 160, 94 - dy).fill(0x6b4331);
    }
    this.tamper.y = f.tamperUp ? -6 : 0;
    this.needle.rotation = (f.gaugeDeg * Math.PI) / 180;
    const ph = Math.round(f.pitH * 10) / 10;
    if (ph !== this.lastPit) {
      this.lastPit = ph;
      this.pitMilk.clear().rect(-34, -4 - ph, 68, ph).fill(0xfbf4e8);
    }
    const bs = f.bell ? 1 + f.bell : 1;
    this.bell.scale.set(bs);
    /* чашка */
    this.inner.scale.set(f.cupK);
    this.saucer.scale.set(Math.min(1.4, Math.max(0.85, 0.2 + 0.8 * f.cupK)));
    this.cupC.visible = !f.pitUnder;
    this.pitUnderG.visible = !!f.pitUnder;
    if (f.pitUnder) {
      const h = 6 + 54 * f.pitUnder.level;
      this.pitCoffee.clear().poly([-26 - (h / 68) * 6 + 6, -4 - h, 26 + (h / 68) * 6 - 6, -4 - h, 26, -6, -26, -6]).fill(0x4a2e20);
    }
    this.ice.alpha = Math.max(0, Math.min(1, f.ice));
    const key = JSON.stringify([f.rects, f.topY, f.topRx, f.topCol, f.topOn, f.art]);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.layers.clear();
      f.rects.forEach((r) => {
        if (r.h > 0.05) this.layers.rect(-60, r.y, 120, r.h).fill(hexNum(r.col));
      });
      this.top.clear();
      if (f.topOn) this.top.ellipse(0, f.topY, f.topRx, 9).fill(hexNum(f.topCol));
      this.art.clear();
      if (f.art && f.art.pts.length > 1) {
        const p = f.art.pts;
        this.art.moveTo((p[0] as [number, number])[0], (p[0] as [number, number])[1]);
        for (let i = 1; i < p.length; i++) this.art.lineTo((p[i] as [number, number])[0], (p[i] as [number, number])[1]);
        this.art.stroke({ width: 3, color: 0xfbf4e8, alpha: f.art.alpha, join: 'round', cap: 'round' });
      }
    }
    /* струя */
    this.stream.clear();
    if (f.stream) this.stream.rect(627, f.stream.y, 6, f.stream.h).fill(hexNum(f.stream.col));
    this.steam.alpha += ((f.steam ? 0.9 : 0) - this.steam.alpha) * 0.4;
    if (f.ring) {
      this.ring.alpha = f.ring.a;
      this.ring.position.set(f.ring.x, f.ring.y);
      this.ring.scale.set(f.ring.s);
      this.ring.rotation = 0;
    } else this.ring.alpha = 0;
  }
}
