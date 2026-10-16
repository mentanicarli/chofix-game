import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import PARTS from '../../assets/art/bar-parts.json';
import { raster } from './svg';
import { TexCache, modelTexKey } from './texCache';
import { BAR_UNIT, drinkPx, geomOf, glassHalfWidth, type CeramicGeom, type GlassGeom } from './drinkModel';
import { specOf, type DrinkSpec, type ModelRef } from '../../game/drinkModel';
import { GLASS_FILL, STROKE, pc } from './style';

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
  /** холодный напиток: прозрачный стакан со слоями и льдом; иначе непрозрачная керамическая чашка (стайлгайд, разд. 15) */
  glass: boolean;
  /** напиток из пилота Н1-2: чашка рисуется моделью (src/render/world/drinkModel.ts) вместо drawShell, масштаб ×2,5 */
  model: ModelRef | null;
  /** напиток готов (звонок): у модели вместо живого налива показываются слои спецификации */
  ready: boolean;
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
/** потолок масштаба чашки по высоте: обод остаётся ниже носика группы (y ≈ 372) */
const CUP_MAX_KY = 1.12;

/** Четыре слоя модели одного ключа; `destroy` освобождает видеопамять при вытеснении из кэша. */
class ModelTex {
  constructor(readonly back: Texture, readonly liquid: Texture, readonly ice: Texture | null, readonly front: Texture, readonly box: { x: number; y: number; w: number; h: number }) {}
  destroy(): void {
    for (const t of [this.back, this.liquid, this.ice, this.front]) t?.destroy(true);
  }
}

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
  /* чашка (этап 12.3(0)): снизу вверх — блюдце, ручка, тело (заливка), inner (внутри обода: интерьер, слои стакана, поверхность напитка), контур спереди; форма пересобирается при смене размера или материала */
  private handleG = new Graphics();
  private bodyG = new Graphics();
  private frontG = new Graphics();
  private openC = new Container();
  private surfC = new Container();
  private clipC = new Container();
  private openMask = new Graphics();
  private shellKey = '';
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
  /* модель напитка (Н1-2): слои снизу вверх — back (блюдце, корпус), живая жидкость под маской, лёд, front (контур) */
  private mC = new Container();
  private mBack = new Sprite();
  private mIce = new Sprite();
  private mFront = new Sprite();
  private mLive = new Container();
  private mLiveG = new Graphics();
  private mMask = new Graphics();
  private mSurfY: number | null = null;
  private mKey = '';
  private mLiveKey = '';
  private mUnit = 1;
  private mDone = new Sprite();
  /** Текстуры слоёв модели: LRU на 40 ключей (напиток, размер, уровень, режим, разрешение), вытесненное уничтожается. */
  private mTex = new TexCache<ModelTex>();
  private mLoading = new Set<string>();
  private lastKey = '';
  private lastHop = -1;
  private lastPit = -1;

  /**
   * Корпус чашки (не масштабируется, контур ровно 3 px). Керамика: непрозрачное тело с тенью справа, ручка, овал обода; три формы по размеру
   * (эспрессо — приземистая, до 0,3 л — кружка, больше — широкая чашка). Стакан: полупрозрачное тело и контур, слои видны сквозь стенку.
   * Размеры считаются из тех же чисел, что inner: ширина 55·kx, высота 78·ky (ky не больше CUP_MAX_KY — обод остаётся ниже носика группы).
   */
  private drawShell(kx: number, ky: number, glass: boolean): void {
    const h = this.handleG.clear();
    const b = this.bodyG.clear();
    const f = this.frontG.clear();
    const H = (glass ? 78 : 75) * ky; /* у керамики овал обода выше (взгляд сверху сильнее), корпус ниже на 3: верх обода остаётся на прежней высоте */
    if (glass) {
      const Wt = 52 * kx;
      const Wb = 42 * kx;
      const path = (g: Graphics): Graphics => g.moveTo(-Wt, -H).lineTo(Wt, -H).lineTo(Wb, -8 * ky).quadraticCurveTo(0, 4 * ky, -Wb, -8 * ky).closePath();
      path(b).fill(GLASS_FILL);
      f.moveTo(-Wt, -H).lineTo(-Wb, -8 * ky).quadraticCurveTo(0, 4 * ky, Wb, -8 * ky).lineTo(Wt, -H).stroke({ width: STROKE.M, color: INK, join: 'round', cap: 'round' });
      f.ellipse(0, -H, Wt, 9 * ky).stroke({ width: STROKE.D, color: INK });
      f.moveTo(-Wt * 0.8, -H * 0.8).lineTo(-Wb * 0.85, -H * 0.2).stroke({ width: STROKE.M, color: 0xffffff, alpha: 0.65, cap: 'round' });
      return;
    }
    const W = 55 * kx;
    const Wb = W * (kx < 0.9 ? 0.62 : kx < 1.2 ? 0.8 : 0.72);
    const yb = -8 * ky;
    const side = (g: Graphics): Graphics =>
      g.moveTo(-W, -H).bezierCurveTo(-W * 1.03, -H * 0.5, -Wb * 1.1, -H * 0.1, -Wb, yb).quadraticCurveTo(0, 4 * ky, Wb, yb).bezierCurveTo(Wb * 1.1, -H * 0.1, W * 1.03, -H * 0.5, W, -H);
    /* ручка за телом: чёрный контур и заливка поверх */
    const reach = kx < 0.9 ? 15 : kx < 1.2 ? 24 : 30;
    const th = 6 * Math.min(kx, 1.2);
    const hx = W - 3;
    const y0 = -H * 0.8;
    const y1 = -H * 0.26;
    h.moveTo(hx, y0).bezierCurveTo(hx + reach, y0 - 6 * ky, hx + reach, y1 + 4 * ky, hx - 3, y1).stroke({ width: th + 2 * STROKE.M, color: INK, cap: 'round', join: 'round' });
    h.moveTo(hx, y0).bezierCurveTo(hx + reach, y0 - 6 * ky, hx + reach, y1 + 4 * ky, hx - 3, y1).stroke({ width: th, color: pc('PAPER'), cap: 'round', join: 'round' });
    side(b).closePath().fill(pc('PAPER'));
    b.moveTo(W * 0.55, -H * 0.98).lineTo(W, -H).bezierCurveTo(W * 1.03, -H * 0.5, Wb * 1.1, -H * 0.1, Wb, yb).quadraticCurveTo(Wb * 0.4, 1 * ky, Wb * 0.15, 0).bezierCurveTo(Wb * 0.5, -H * 0.3, W * 0.72, -H * 0.62, W * 0.55, -H * 0.98).fill(pc('KRAFT_SH'));
    side(f).stroke({ width: STROKE.M, color: INK, join: 'round', cap: 'round' });
    f.ellipse(0, -H, W, 14 * ky).stroke({ width: STROKE.M, color: INK });
    f.moveTo(-W * 0.82, -H * 0.8).quadraticCurveTo(-W * 0.88, -H * 0.45, -Wb * 0.88, -H * 0.2).stroke({ width: STROKE.M, color: 0xffffff, alpha: 0.75, cap: 'round' });
  }

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
    /* фасад тумбы под столешницей: всегда виден, блоки (ледогенератор, витрина, микроволновка) стоят в его нишах (этап 12.3(2), 24б) */
    spr('counterFront');
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
    saucer.ellipse(0, 7, 76, 10).fill(pc('KRAFT')).stroke({ width: STROKE.M, color: INK });
    saucer.ellipse(0, 5, 52, 5).fill(pc('KRAFT_SH'));
    /* внутри inner (масштаб cupK по x и ≤ CUP_MAX_KY по y): интерьер керамики, слои и лёд стакана, поверхность напитка */
    const glassShape = (g: Graphics): Graphics => g.moveTo(-52, -78).lineTo(52, -78).lineTo(42, -8).quadraticCurveTo(0, 4, -42, -8).closePath();
    const openEllipse = (g: Graphics): Graphics => g.ellipse(0, -75, 55, 14);
    this.openC.addChild(openEllipse(new Graphics()).fill(pc('CER_IN')), new Graphics().ellipse(0, -78, 50, 10).fill(pc('CER_IN_DP')));
    const cmask = glassShape(new Graphics()).fill(0xffffff);
    this.clipC.addChild(cmask, this.layers, this.ice);
    this.clipC.mask = cmask;
    openEllipse(this.openMask).fill(0xffffff);
    this.surfC.addChild(this.openMask, this.top, this.art);
    this.inner.addChild(this.openC, this.clipC, this.surfC);
    this.cupC.addChild(saucer, this.handleG, this.bodyG, this.inner, this.frontG);
    [[-38, -44, 26, -10, 0.6], [-8, -50, 28, 8, 0.6], [18, -34, 24, -6, 0.6], [-26, -22, 22, 12, 0.55]].forEach(([x, y, s, a, al]) => {
      const g = new Graphics().roundRect(-(s as number) / 2, -(s as number) / 2, s as number, s as number, 5).fill({ color: 0xffffff, alpha: al as number }).stroke({ width: 2, color: 0xdceef1 });
      g.position.set((x as number) + (s as number) / 2, (y as number) + (s as number) / 2);
      g.rotation = ((a as number) * Math.PI) / 180;
      this.ice.addChild(g);
    });
    R.addChild(this.cupC);
    this.mC.position.set(630, 478);
    this.mLive.addChild(this.mMask, this.mLiveG);
    this.mLiveG.mask = this.mMask;
    this.mC.addChild(this.mBack, this.mLive, this.mDone, this.mIce, this.mFront);
    this.mC.visible = false;
    R.addChild(this.mC);
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
    /* еда четырёх наборов стоит внутри корпуса, переднее стекло (showcaseGlass) поверх неё; микроволновка — отдельный предмет справа от витрины (этап 12.3(1)) */
    ['scSnacks', 'scPastry', 'scDessert', 'scDeli'].forEach((k) => {
      const c = new Container();
      spr(k, c);
      this.showcase.addChild(c);
      this.subs.set(k, c);
    });
    spr('showcaseGlass', this.showcase);
    R.addChild(this.showcase);
    const micro = new Container();
    spr('scMicro', micro);
    this.subs.set('scMicro', micro);
    R.addChild(micro);
    /* кромка столешницы с тенью: поверх блоков, под плитками оборудования, чтобы блоки уходили под неё */
    spr('counterNose');
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

  /** Описание модели по ссылке заказа; нет такого размера или варианта — null (рисуется по-старому). */
  private modelSpec(m: ModelRef): DrinkSpec | null {
    try {
      return specOf(m.id, m.size, m.cold);
    } catch {
      return null;
    }
  }

  /** Текстуры слоёв модели (блюдце и корпус, лёд, контур) для ключа; грузятся асинхронно, пока их нет, чашка не показывается. */
  private ensureModelTex(key: string, spec: DrinkSpec): boolean {
    if (this.mTex.get(key)) return true;
    if (this.mLoading.has(key)) return false;
    this.mLoading.add(key);
    const u = BAR_UNIT[spec.vessel.material];
    const px = drinkPx(spec, { level: 'full', s: u, saucer: true });
    const box = px.all.box;
    const mk = (name: 'back' | 'liquid' | 'ice' | 'front'): Promise<Texture> => raster(px.layer(name).inner, box, this.res);
    void Promise.all([mk('back'), mk('liquid'), px.parts.ice ? mk('ice') : Promise.resolve(null), mk('front')]).then(([back, liquid, ice, front]) => {
      this.mTex.set(key, new ModelTex(back, liquid, ice, front, box), this.mKey);
      this.mLoading.delete(key);
    });
    return false;
  }

  /**
   * Чашка-модель в баре: back → живая жидкость (прямоугольники слоёв из legacy `barPaint`, 72 px старой чашки = полный налив) под маской → лёд (прозрачность по мере добавления) → front.
   * Масштаб ×2,5 (`BAR_UNIT`); высота ограничена потолком `HEIGHT_CAP` внутри геометрии. Возвращает false, пока текстуры не готовы.
   */
  private paintModel(f: BarFrame, spec: DrinkSpec): boolean {
    const key = modelTexKey(spec, 'full', this.res);
    if (!this.ensureModelTex(key, spec)) return false;
    const t = this.mTex.get(key);
    if (!t) return false;
    const u = BAR_UNIT[spec.vessel.material];
    const g = geomOf(spec.vessel);
    if (this.mKey !== key) {
      this.mKey = key;
      this.mUnit = u;
      for (const [sp, tex] of [[this.mBack, t.back], [this.mFront, t.front], [this.mDone, t.liquid]] as const) {
        sp.texture = tex;
        sp.position.set(t.box.x, t.box.y);
        sp.width = t.box.w;
        sp.height = t.box.h;
      }
      this.mIce.visible = !!t.ice;
      if (t.ice) {
        this.mIce.texture = t.ice;
        this.mIce.position.set(t.box.x, t.box.y);
        this.mIce.width = t.box.w;
        this.mIce.height = t.box.h;
      }
      this.mLive.scale.set(u);
      this.mLiveKey = '';
      this.mMask.clear();
      if (g.kind === 'glass') {
        const pts: number[] = [-g.Wt, -g.H, g.Wt, -g.H, g.Wb, g.yb];
        for (let i = 1; i < 12; i++) {
          const q = i / 12;
          const x = (1 - q) * (1 - q) * g.Wb + 2 * (1 - q) * q * 0 + q * q * -g.Wb;
          const y = (1 - q) * (1 - q) * g.yb + 2 * (1 - q) * q * g.bulge + q * q * g.yb;
          pts.push(x, y);
        }
        pts.push(-g.Wb, g.yb);
        this.mMask.poly(pts).fill(0xffffff);
      } else this.mMask.ellipse(0, -g.H, g.W, g.kind === 'ceramic' ? g.ryR : g.ryR).fill(0xffffff);
    }
    this.mIce.alpha = Math.max(0, Math.min(1, f.ice));
    this.mDone.visible = f.ready;
    this.mLive.visible = !f.ready;
    const lvl = Math.min(1, Math.max(0, (2 - f.topY) / 72));
    if (g.kind === 'glass') this.mSurfY = (g.yBot + lvl * (g.yTop - g.yBot)) * u;
    else if (g.kind === 'ceramic') this.mSurfY = (-g.H + (3 + (1 - lvl) * 9) * g.ky) * u;
    else this.mSurfY = -g.H * u;
    const lk = JSON.stringify([f.rects, f.topY, f.topRx, f.topCol, f.topOn, f.art]);
    if (lk !== this.mLiveKey) {
      this.mLiveKey = lk;
      const G = this.mLiveG.clear();
      if (g.kind === 'glass') this.liveGlass(G, g, f);
      else if (g.kind === 'ceramic') this.liveCeramic(G, g, f, lvl);
    }
    return true;
  }

  private liveGlass(G: Graphics, g: GlassGeom, f: BarFrame): void {
    const yAt = (y: number): number => g.yBot + Math.min(1, Math.max(0, (2 - y) / 72)) * (g.yTop - g.yBot);
    for (const r of f.rects) {
      if (r.h <= 0.05) continue;
      const y0 = yAt(r.y);
      const y1 = yAt(r.y + r.h);
      G.rect(-(g.Wt + 4), y0, 2 * (g.Wt + 4), y1 - y0).fill(hexNum(r.col));
    }
    if (!f.topOn) return;
    const ys = yAt(f.topY);
    const rx = glassHalfWidth(g, ys) - 3;
    const ry = g.ry * (rx / g.Wt);
    G.ellipse(0, ys, rx, ry).fill(hexNum(f.topCol)).stroke({ width: 1.6 / this.mUnit, color: 0x4a2f25, alpha: 0.25 });
    this.liveArt(G, f, ys, rx / Math.max(1, f.topRx), ry / 9);
  }

  private liveCeramic(G: Graphics, g: CeramicGeom, f: BarFrame, lvl: number): void {
    /* керамика: поверхность видна только в овале обода; чем меньше налито, тем ниже и уже она уходит за переднюю кромку */
    if (lvl <= 0.12) return;
    const cy = -g.H + (3 + (1 - lvl) * 9) * g.ky;
    const rx = (g.W - 6 * g.k) * (0.88 + 0.12 * lvl);
    const ry = (g.ryR - 3.5 * g.ky) * (0.9 + 0.1 * lvl);
    G.ellipse(0, cy, rx, ry).fill(hexNum(f.topCol));
    this.liveArt(G, f, cy, rx / 51, ry / 11);
  }

  private liveArt(G: Graphics, f: BarFrame, cy: number, sx: number, sy: number): void {
    if (!f.art || f.art.pts.length < 2) return;
    const p = f.art.pts;
    const at = (q: [number, number]): [number, number] => [q[0] * sx, cy + (q[1] - f.topY) * sy];
    const p0 = at(p[0] as [number, number]);
    G.moveTo(p0[0], p0[1]);
    for (let i = 1; i < p.length; i++) {
      const q = at(p[i] as [number, number]);
      G.lineTo(q[0], q[1]);
    }
    G.stroke({ width: 3 / this.mUnit, color: 0xfbf4e8, alpha: f.art.alpha, join: 'round', cap: 'round' });
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
    const spec = f.model ? this.modelSpec(f.model) : null;
    const modelReady = !!spec && this.paintModel(f, spec);
    /* чашка */
    /* высота чашки ограничена нишей группы (верх обода не выше y 380): крупные объёмы растут вширь, а не вверх; стайлгайд, раздел 15 */
    const ky = Math.min(f.cupK, CUP_MAX_KY);
    this.inner.scale.set(f.cupK, ky);
    const shellKey = f.cupK.toFixed(3) + '|' + f.glass;
    if (shellKey !== this.shellKey) {
      this.shellKey = shellKey;
      this.drawShell(f.cupK, ky, f.glass);
      this.openC.visible = !f.glass;
      this.clipC.visible = f.glass;
      this.surfC.mask = f.glass ? null : this.openMask;
      this.openMask.visible = !f.glass; /* маска лежит в дереве: у стакана без маски она бы рисовалась белым овалом */
      this.lastKey = '';
    }
    this.saucer.scale.set(Math.min(1.4, Math.max(0.85, 0.2 + 0.8 * f.cupK)));
    this.cupC.visible = !f.pitUnder && !spec;
    this.mC.visible = !f.pitUnder && modelReady;
    this.pitUnderG.visible = !!f.pitUnder;
    if (f.pitUnder) {
      const h = 6 + 54 * f.pitUnder.level;
      this.pitCoffee.clear().poly([-26 - (h / 68) * 6 + 6, -4 - h, 26 + (h / 68) * 6 - 6, -4 - h, 26, -6, -26, -6]).fill(0x4a2e20);
    }
    this.ice.alpha = Math.max(0, Math.min(1, f.ice));
    const key = JSON.stringify([f.rects, f.topY, f.topRx, f.topCol, f.topOn, f.art, f.glass]);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.layers.clear();
      f.rects.forEach((r) => {
        if (r.h > 0.05) this.layers.rect(-60, r.y, 120, r.h).fill(hexNum(r.col));
      });
      this.top.clear();
      /* керамика: поверхность напитка видна только в овале обода; чем меньше налито, тем ниже и уже она уходит за переднюю кромку (пустая чашка: видно только интерьер) */
      const lvl = Math.min(1, Math.max(0, (2 - f.topY) / 72));
      const surfY = f.glass ? f.topY : -73 + (1 - lvl) * 23.5;
      if (f.glass ? f.topOn : lvl > 0.12) this.top.ellipse(0, surfY, f.glass ? f.topRx : 51 * (1 - 0.12 * (1 - lvl)), f.glass ? 9 : 11).fill(hexNum(f.topCol));
      this.art.y = f.glass ? 0 : surfY - f.topY;
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
    if (f.stream) {
      /* струя кончается на поверхности напитка: у модели поверхность считается по её геометрии */
      const h = modelReady && this.mSurfY !== null ? Math.max(8, 478 + this.mSurfY - f.stream.y) : f.stream.h;
      this.stream.rect(627, f.stream.y, 6, h).fill(hexNum(f.stream.col));
    }
    this.steam.alpha += ((f.steam ? 0.9 : 0) - this.steam.alpha) * 0.4;
    if (f.ring) {
      this.ring.alpha = f.ring.a;
      this.ring.position.set(f.ring.x, f.ring.y);
      this.ring.scale.set(f.ring.s);
      this.ring.rotation = 0;
    } else this.ring.alpha = 0;
  }
}
