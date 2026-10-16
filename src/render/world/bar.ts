import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import PARTS from '../../assets/art/bar-parts.json';
import { raster } from './svg';
import { TexCache, modelTexKey } from './texCache';
import { BAR_UNIT, drinkPx, geomOf, glassHalfWidth, type CeramicGeom, type GlassGeom } from './drinkModel';
import { specOf, type DrinkSpec, type ModelRef } from '../../game/drinkModel';
import { SECTION_CAM, SECTION_NAMES, SECTION_W, type SectionsOpen } from '../../game/sections';
import PAL from '../../../art-src/palette.json';

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
/** Четыре слоя модели одного ключа; `destroy` освобождает видеопамять при вытеснении из кэша. */
/** Ключ живого налива: меняется только когда меняется то, что рисуется (дешевле JSON.stringify каждый кадр). */
function liveKey(f: BarFrame): string {
  let k = `${f.topY}|${f.topRx}|${f.topCol}|${f.topOn ? 1 : 0}|${f.art ? f.art.pts.length + ':' + f.art.alpha : ''}`;
  for (const r of f.rects) k += `|${r.y},${r.h},${r.col}`;
  return k;
}
class ModelTex {
  constructor(readonly back: Texture, readonly liquid: Texture, readonly ice: Texture | null, readonly front: Texture, readonly box: { x: number; y: number; w: number; h: number }) {}
  destroy(): void {
    for (const t of [this.back, this.liquid, this.ice, this.front]) t?.destroy(true);
  }
}

/** Боковая секция (Б1-1): плашка-заглушка вместо будущего арта (этап 30). Текстуры живут, пока секция открыта и камера на ней или на соседней остановке. */
interface SideSection { c: Container; tex: Texture | null; label: Text | null; loading: boolean }

/** Заглушка фона боковой секции: стена в полоску со смещением (шов с центром без разрыва ритма, sections.md 1.2), тумба, плашка под подпись. Только палитра art-src. */
function placeholderSvg(id: 'L' | 'R'): string {
  const C = PAL.colors;
  const off = id === 'L' ? 40 : 80;
  let stripes = '';
  for (let x = off - 130; x < SECTION_W + 130; x += 130) stripes += `<rect x="${x}" y="0" width="65" height="472" fill="${C.KRAFT_SH}" opacity="0.55"/>`;
  return `<rect width="${SECTION_W}" height="720" fill="${C.KRAFT}"/>${stripes}`
    + `<rect x="-6" y="472" width="${SECTION_W + 12}" height="140" fill="${C.TOP}" stroke="${C.INK}" stroke-width="3.5"/>`
    + `<rect x="-6" y="612" width="${SECTION_W + 12}" height="130" fill="${C.WOOD}" stroke="${C.INK}" stroke-width="3.5"/>`
    + `<rect x="${SECTION_W / 2 - 220}" y="236" width="440" height="150" rx="22" fill="${C.PAPER}" stroke="${C.INK}" stroke-width="3.5" stroke-dasharray="14 9"/>`;
}

export class BarScene {
  readonly root = new Container();
  /** Весь мир бара: центр в 0…1280, боковые секции по бокам; камера сдвигает `world.x = −cam` (Б1-1). */
  readonly world = new Container();
  private fontRes = 1;
  private cam = 0;
  private sOpen: SectionsOpen = { L: false, C: true, R: false };
  private side: Record<'L' | 'R', SideSection> = {
    L: { c: new Container(), tex: null, label: null, loading: false },
    R: { c: new Container(), tex: null, label: null, loading: false }
  };
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
  private pitUnderG = new Container();
  private pitCoffee = new Graphics();
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
  private mSpecRef: ModelRef | null = null;
  private mSpec: DrinkSpec | null = null;
  private mTexKey = '';
  private mTexSpec: DrinkSpec | null = null;
  private lastHop = -1;
  private lastPit = -1;

  async build(res: number, fontRes: number): Promise<void> {
    this.res = res;
    this.fontRes = fontRes;
    this.root.addChild(this.world);
    for (const id of ['L', 'R'] as const) {
      this.side[id].c.position.set(SECTION_CAM[id], 0);
      this.side[id].c.visible = false;
      this.world.addChild(this.side[id].c);
    }
    const ids = Object.keys(P);
    await Promise.all(ids.map(async (id) => {
      const p = P[id] as Part;
      this.tex.set(id, await raster(p.svg, p.box, res));
    }));
    const R = this.world;
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

  /** Какие секции открыты (по покупкам или принудительно в #dev). Закрытая секция не держит текстур. */
  setSections(open: SectionsOpen): void {
    this.sOpen = open;
    this.syncSides();
  }

  /** Камера: мировой x левого края кадра (−1280, 0, +1280 и между ними при переходе). */
  setCamera(x: number): void {
    this.cam = x;
    this.world.x = -x;
    this.syncSides();
  }

  /** Живые текстуры боковых секций (счётчик для проверки: до покупки 0). */
  sideTextureCount(): number {
    let n = 0;
    for (const id of ['L', 'R'] as const) {
      const s = this.side[id];
      if (s.tex) n++;
      if (s.label) n++;
    }
    return n;
  }

  private syncSides(): void {
    for (const id of ['L', 'R'] as const) {
      const s = this.side[id];
      const dist = Math.abs(this.cam - SECTION_CAM[id]);
      const open = this.sOpen[id];
      /* создаём лениво: секция открыта, камера в ней или на соседней остановке (центр соседствует с обеими) */
      if (open && dist <= SECTION_W && !s.tex && !s.loading) this.buildSide(id);
      if (!open && (s.tex || s.label)) this.freeSide(id);
      s.c.visible = open && !!s.tex && dist < SECTION_W;
    }
  }

  private buildSide(id: 'L' | 'R'): void {
    const s = this.side[id];
    s.loading = true;
    void raster(placeholderSvg(id), { x: 0, y: 0, w: SECTION_W, h: 720 }, this.res).then((t) => {
      s.loading = false;
      if (!this.sOpen[id]) { t.destroy(true); return; }
      const sp = new Sprite(t);
      sp.width = SECTION_W;
      sp.height = 720;
      const label = new Text({ text: SECTION_NAMES[id], style: { fontFamily: 'Caveat, Nunito, cursive', fontSize: 64, fontWeight: '700', fill: PAL.colors.INK, padding: 6 }, resolution: this.fontRes });
      label.anchor.set(0.5, 0.5);
      label.position.set(SECTION_W / 2, 311);
      s.tex = t;
      s.label = label;
      s.c.addChild(sp, label);
      this.syncSides();
    });
  }

  private freeSide(id: 'L' | 'R'): void {
    const s = this.side[id];
    s.c.removeChildren().forEach((c) => c.destroy());
    s.tex?.destroy(true);
    s.tex = null;
    s.label = null;
    s.c.visible = false;
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
    /* описание считается из рецепта (recipeNumbers), поэтому не каждый кадр, а при смене ссылки */
    if (this.mSpecRef && this.mSpecRef.id === m.id && this.mSpecRef.size === m.size && this.mSpecRef.cold === m.cold) return this.mSpec;
    this.mSpecRef = m;
    try {
      this.mSpec = specOf(m.id, m.size, m.cold);
    } catch {
      this.mSpec = null;
    }
    return this.mSpec;
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
    if (this.mTexSpec !== spec) {
      this.mTexSpec = spec;
      this.mTexKey = modelTexKey(spec, 'full', this.res);
    }
    const key = this.mTexKey;
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
    const lk = liveKey(f);
    if (lk !== this.mLiveKey) {
      this.mLiveKey = lk;
      const G = this.mLiveG.clear();
      if (g.kind === 'glass') this.liveGlass(G, g, f);
      else if (g.kind === 'ceramic') this.liveCeramic(G, g, f, lvl);
      else if (lvl > 0.12) G.ellipse(0, -g.H + 1.4 * g.k, g.W - 4 * g.k, g.ryR - 2.6 * g.k).fill(hexNum(f.topCol));
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
    /* чашка: только модель напитка (Н2-4); старой чашки drawShell больше нет, modelRefOf в legacy даёт ссылку всегда */
    this.mC.visible = !f.pitUnder && modelReady;
    this.pitUnderG.visible = !!f.pitUnder;
    if (f.pitUnder) {
      const h = 6 + 54 * f.pitUnder.level;
      this.pitCoffee.clear().poly([-26 - (h / 68) * 6 + 6, -4 - h, 26 + (h / 68) * 6 - 6, -4 - h, 26, -6, -26, -6]).fill(0x4a2e20);
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
