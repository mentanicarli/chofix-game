import { Application, Container, FillGradient, Graphics, GraphicsPath, Sprite, Text, Texture, type Renderer, type WebGLRenderer } from 'pixi.js';
import GOLD from '../../assets/art/gold-trim.svgf?raw';
import JUG from '../../assets/art/milk-jug.svgf?raw';
import CLOCK from '../../assets/art/clock-face.svgf?raw';
import BG from '../../assets/art/hall-bg.svgf?raw';
import ITEMS from '../../assets/art/hall-items.svgf?raw';
import FG from '../../assets/art/hall-fg.svgf?raw';
import TABLE from '../../assets/art/hall-table.svgf?raw';
import RUG from '../../assets/art/hall-rug.svgf?raw';
import CHAIR from '../../assets/art/hall-chair.svgf?raw';
import LID from '../../assets/art/hall-laptop-lid.svgf?raw';
import LBASE from '../../assets/art/hall-laptop-base.svgf?raw';
import SAUCER from '../../assets/art/hall-saucer.svgf?raw';
import HILLS from '../../assets/art/sky-hills.svgf?raw';
import LAMP0 from '../../assets/art/lamp-0.svgf?raw';
import LAMP1 from '../../assets/art/lamp-1.svgf?raw';
import LAMP2 from '../../assets/art/lamp-2.svgf?raw';
import { Actor, Limb, type ActorOpts } from './actor';
import { Ribbon, frameSprite } from './ribbon';
import { BarScene, type BarFrame, type BarUpgrades } from './bar';
import { drinkIconSvg } from './drinkModel';
import { specOf, type ModelRef } from '../../game/drinkModel';
import { BARISTA_ARM_LEN, BARISTA_K, BARISTA_PIVOT, GUEST_K, SEAT_PIVOT, baristaCells, baristaParts, lookFor, wrapCell, wrapPart, type BaristaFace, type Box, type Look } from './art';
import { Spring, Spring2, damp, ik2 } from './anim';
import { Fx } from './fx';
import { bakePaper, canvasTexture, raster, rasterAtlas } from './svg';

export { lookFor, type Look };

const INK = '#4A2F25';
/** предметы столика без дрожания (стайлгайд: дрожание только у крупных поверхностей) */
const WRAP_PLAIN = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const WRAP = `filter="url(#wobble)" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
/* бумага поверх всей сцены: пятна, зерно, виньетка */
const PAPER = `<rect width="1280" height="720" filter="url(#blotch)" opacity=".5"/><rect width="1280" height="720" filter="url(#grain)" opacity=".55"/><rect width="1280" height="720" fill="url(#gVig)"/>`;
/* текстура досок пола и фасада стойки: часть фона, лежит под гостями и баристой (иначе доски «просвечивают» сквозь одежду) */
const WOOD = `<rect x="0" y="550" width="1280" height="170" filter="url(#woodH)" opacity=".5"/><rect x="688" y="424" width="592" height="96" filter="url(#woodV)" opacity=".4"/>`;
/** Для автотестов на слабой машине: мир рисуется редко (#lowfx в адресе). */
const LOWFX = typeof location !== 'undefined' && location.hash.includes('lowfx');
const NOFX = typeof location !== 'undefined' && location.hash.includes('nofx');
const W = 1280;
const H = 720;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
/** Столик без растения: рисуется отдельно, чтобы расти вместе с сидящим гостем. */
const TABLE_BOX = box(118, 514, 224, 160);

const SKY: [number, string, string, string][] = [
  [0, '#F3C9A6', '#FBE3B8', '#FFD79A'],
  [0.25, '#BFE0E8', '#FBEFD2', '#FFF0B8'],
  [0.5, '#9FD1E3', '#E8F3EC', '#FFF6D0'],
  [0.75, '#D9D2C8', '#FBDDB0', '#FFD08A'],
  [1, '#E59A78', '#F6C58A', '#FF9F5A']
];
const hex3 = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerpRGB = (a: string, b: string, u: number): [number, number, number] => {
  const x = hex3(a);
  const y = hex3(b);
  return [0, 1, 2].map((i) => Math.round((x[i] as number) + ((y[i] as number) - (x[i] as number)) * u)) as [number, number, number];
};
const css = (c: number[]) => `rgb(${c.join(',')})`;
const num = (c: number[]) => ((c[0] as number) << 16) | ((c[1] as number) << 8) | (c[2] as number);

export interface BaristaPose { arm: number; arm2: number; nod: number; bob: number }
/** k — масштаб модели чашки по объёму напитка (cupScale из src/game/volumes.ts) */
export interface HeldCup { k?: number; top: string; art: 'heart' | 'leaf' | null; aq: number; star: boolean }
export interface MenuRow { name: string; price: number | string }

/** Мир зала на Pixi: небо, стена, лампы, барист, гости, частицы, свет и бумажная фактура поверх. */
export class World {
  app!: Application;
  readonly fx = new Fx();
  ready = false;
  res = 1;
  /** Описание GPU, если браузер рисует программно. */
  software: string | null = null;
  low = false;
  /** доски пола поверх фона, но под людьми */
  floorGrain!: Sprite;
  /** Рост гостей (для эффектов в legacy: точки на госте считаются от пола, y 600). */
  readonly guestK = GUEST_K;
  private texRes = 1;
  private readonly actors = new Set<Actor>();
  private readonly cust = new Container();
  private readonly sitC = new Container();
  private readonly sitFront = new Container();
  /** ноутбук, блюдце, руки и чашка сидящего: над столиком (слой 11) */
  private readonly deskC = new Container();
  private readonly lid = new Sprite();
  private readonly deskBase = new Sprite();
  private readonly saucer = new Sprite();
  private readonly chair = new Sprite();
  private sitter: Actor | null = null;
  /* маски гостя за ноутбуком: тело ниже кромки крышки и сбоку от неё скрыто */
  private readonly seatMaskA = new Graphics();
  private readonly seatMaskB = new Graphics();
  private seatMaskState = '';
  private sitSt: 'empty' | 'in' | 'sit' | 'seated' | 'rise' | 'out' = 'empty';
  private sitT = 2;
  private sitX = -100;
  private sitV = 0;
  private lidSy = 1;
  private shadow!: Texture;
  private soft!: Texture;
  private hall!: Container;
  private readonly bar = new BarScene();
  private barOn = false;
  private barP = 0;
  private now = 80;

  private skyCv!: HTMLCanvasElement;
  private skyTex!: Texture;
  private sunGlow!: Sprite;
  private clouds = new Container();
  private readonly glare = new Graphics();
  private readonly glareBands = new Graphics();
  private shaft = new Graphics();
  private shaftGrad: FillGradient | null = null;
  private lastSky = -1;
  private clkH = new Graphics();
  private clkM = new Graphics();
  private lamps: Container[] = [];
  private glows: Sprite[] = [];
  private pools: Sprite[] = [];
  private motes = new Container();
  private signC = new Container();
  private cozy!: Sprite;
  private gold!: Sprite;
  private jug!: Sprite;
  private baristaC = new Container();
  /* левая рука с чашкой на время подачи едет в этот слой: он выше предметов на стойке */
  private frontWrap = new Container();
  private baristaF = new Container();
  private bodyF = new Container();
  private armFront = false;
  private bodyC = new Container();
  private headC = new Container();
  private cupC = new Container();
  private cupTop = new Graphics();
  private cupArt = new Graphics();
  private cupStar = new Graphics();
  private cupG = new Container();
  private rowsKey = '';
  private headSprite!: Sprite;
  private readonly faces: Partial<Record<BaristaFace, Texture>> = {};
  private face: BaristaFace = 'smile';
  private joyT = 0;
  private bArms: Limb[] = [];
  private readonly bHands = [new Spring2(805, 386, 14, 0.7), new Spring2(942, 386, 14, 0.7)];
  private bPose: BaristaPose = { arm: 0, arm2: 0, nod: 0, bob: 0 };
  private readonly bHop = new Spring(0, 16, 0.35);
  private readonly bHead = new Spring(0, 12, 0.5);
  private readonly cupHold = new Container();
  private turnT = 0;
  private serveT = 0;
  private stress = 0;
  private blinkT = 2.5;
  private blinkOn = 0;

  /** Поднимает Pixi и рисует всю неподвижную графику. Любая ошибка — наверх: игра покажет сообщение. */
  async init(canvas: HTMLCanvasElement, res: number): Promise<void> {
    this.res = res;
    this.texRes = clamp(res, 1, 2);
    const app = new Application();
    await app.init({ canvas, width: W, height: H, resolution: res, autoDensity: true, backgroundColor: 0xf6ead6, antialias: true, autoStart: false, preference: 'webgl' });
    app.ticker.stop();
    this.app = app;
    /* без видеокарты (программный WebGL) заливка экрана дорогая: рисуем вдвое грубее и реже, игра при этом идёт в обычном темпе */
    const gl = (app.renderer as WebGLRenderer).gl;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu)) {
      this.software = gpu;
      this.res = 0.5;
      app.renderer.resize(W, H, 0.5);
    }
    const r = this.texRes;
    const S = app.stage;
    const fonts = Promise.race([Promise.all([document.fonts.load('700 30px Caveat', 'Cuppable'), document.fonts.load('700 20px Caveat', 'Эспрессо Американо 0123456789'), document.fonts.load('800 12px Nunito', 'Американо крепкий ×')]).catch(() => null), new Promise((ok) => setTimeout(ok, 1800))]);

    this.soft = canvasTexture(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
    this.shadow = canvasTexture(128, 32, (g) => {
      const gr = g.createRadialGradient(64, 16, 0, 64, 16, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.55, 'rgba(255,255,255,.7)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.save();
      g.translate(0, 16);
      g.scale(1, 0.25);
      g.translate(0, -16);
      g.fillStyle = gr;
      g.fillRect(0, -48, 128, 128);
      g.restore();
    });

    const full = box(0, 0, W, H);
    const lampBox = (x: number) => box(x - 60, -30, 120, 180);
    const [bg, items, hills, clock, l0, l1, l2, fg, tableT, paperT, woodT, rugT] = await Promise.all([
      raster(BG, full, r),
      raster(ITEMS, box(690, 280, 610, 140), r),
      raster(HILLS, box(80, 230, 240, 140), r),
      raster(CLOCK, box(345, 110, 80, 80), r),
      raster(LAMP0, lampBox(680), r),
      raster(LAMP1, lampBox(870), r),
      raster(LAMP2, lampBox(1060), r),
      raster(FG, full, r),
      raster(TABLE, TABLE_BOX, r * GUEST_K),
      bakePaper(PAPER, full),
      bakePaper(WOOD, full),
      raster(RUG, box(40, 596, 380, 112), r),
      fonts
    ]);

    /* небо в окне: градиент, солнце, облака, холмы — маска по раме окна */
    const skyC = new Container();
    this.skyCv = document.createElement('canvas');
    this.skyCv.width = 2;
    this.skyCv.height = 64;
    this.skyTex = Texture.from(this.skyCv);
    const sky = new Sprite(this.skyTex);
    sky.position.set(80, 100);
    sky.width = 240;
    sky.height = 270;
    this.sunGlow = new Sprite(this.soft);
    this.sunGlow.anchor.set(0.5);
    this.sunGlow.width = this.sunGlow.height = 168;
    this.sunGlow.tint = 0xffe6a0;
    this.sunGlow.alpha = 0.7;
    const sunDisc = new Graphics().circle(0, 0, 32).fill(0xffffff);
    const sunC = new Container();
    sunC.addChild(sunDisc);
    this.sunDisc = sunDisc;
    this.sunC = sunC;
    const cloud = (x: number, y: number, s: number) => {
      const g = new Graphics();
      g.ellipse(0, 0, 36, 11).fill({ color: 0xffffff, alpha: 0.82 });
      g.ellipse(-17, -8, 21, 10).fill({ color: 0xffffff, alpha: 0.82 });
      g.ellipse(14, -10, 23, 12).fill({ color: 0xffffff, alpha: 0.82 });
      g.position.set(x, y);
      g.scale.set(s);
      return g;
    };
    this.clouds.addChild(cloud(-150, 150, 1), cloud(-340, 205, 0.75));
    const hillSp = new Sprite(hills);
    hillSp.position.set(80, 230);
    hillSp.width = 240;
    hillSp.height = 140;
    skyC.addChild(sky, this.sunGlow, sunC, this.clouds, hillSp);
    const m = new Graphics().rect(80, 100, 240, 270).fill(0xffffff);
    skyC.addChild(m);
    skyC.mask = m;
    S.addChild(skyC);

    /* стена, пол, прилавок */
    const place = (t: Texture, x: number, y: number, w: number, h: number) => {
      const s = new Sprite(t);
      s.position.set(x, y);
      s.width = w;
      s.height = h;
      return s;
    };
    S.addChild(place(bg, 0, 0, W, H));
    S.addChild(place(rugT, 40, 596, 380, 112)); /* ковёр под столиком: art-src/hall/rug.svg */
    this.floorGrain = place(woodT, 0, 0, W, H);
    S.addChild(this.floorGrain);
    /* мягкая тень под столиком, блик на стекле витрины */
    const tsh = new Sprite(this.shadow);
    tsh.anchor.set(0.5);
    tsh.position.set(SEAT_PIVOT.x, SEAT_PIVOT.y + 6 * GUEST_K);
    tsh.width = 190 * GUEST_K;
    tsh.height = 34 * GUEST_K;
    tsh.tint = 0x3b2418;
    tsh.alpha = 0.3;
    S.addChild(tsh);
    const glass = new Container();
    const gm = new Graphics().roundRect(704, 332, 76, 58, 8).fill(0xffffff);
    /* стекло чуть холоднее воздуха, на нём тёплый белый блик двумя полосами */
    this.glare.rect(0, 0, 76, 58).fill({ color: 0x9ec7cf, alpha: 0.1 });
    this.glareBands.poly([-6, 58, 12, 0, 26, 0, 8, 58]).fill({ color: 0xfffaf0, alpha: 0.95 });
    this.glareBands.poly([32, 58, 48, 0, 55, 0, 39, 58]).fill({ color: 0xfffaf0, alpha: 0.8 });
    this.glare.position.set(704, 332);
    this.glareBands.position.set(704, 332);
    glass.addChild(this.glare, this.glareBands);
    glass.mask = gm;
    /* улучшения зала рисуются по первому требованию */
    this.cozy = place(Texture.EMPTY, -30, 0, 1340, 70);
    this.gold = place(Texture.EMPTY, 930, 300, 180, 120);
    this.jug = place(Texture.EMPTY, 900, 375, 50, 45);
    this.cozy.visible = this.gold.visible = this.jug.visible = false;
    S.addChild(this.cozy);

    /* луч света из окна */
    this.shaft.blendMode = 'screen';
    S.addChild(this.shaft);
    S.addChild(place(clock, 345, 110, 80, 80));
    const hands = new Container();
    hands.position.set(385, 150);
    this.clkH.moveTo(0, 3).lineTo(0, -15).stroke({ width: 4.5, color: INK, cap: 'round' });
    this.clkM.moveTo(0, 3).lineTo(0, -22).stroke({ width: 3, color: INK, cap: 'round' });
    hands.addChild(this.clkH, this.clkM, new Graphics().circle(0, 0, 3.6).fill('#C4694A').stroke({ width: 2, color: INK }));
    S.addChild(hands);

    /* лампы качаются, как маятники */
    [[680, l0], [870, l1], [1060, l2]].forEach(([x, t]) => {
      const c = new Container();
      c.pivot.set(x as number, -20);
      c.position.set(x as number, -20);
      c.addChild(place(t as Texture, (x as number) - 60, -30, 120, 180));
      this.lamps.push(c);
      S.addChild(c);
    });
    S.addChild(this.signC);

    /* актёры: бариста за стойкой, гости */
    await this.buildBarista();
    /* предметы на стойке (машина, витрина, кофемолка…) стоят перед баристой; блик на стекле и улучшения — поверх них */
    S.addChild(place(items, 690, 280, 610, 140), glass, this.gold, this.jug, this.frontWrap);
    /* порядок: гость (ноги, торс, голова) → стол → руки и чашка → ноутбук; стул — за гостем */
    this.sitC.addChild(this.chair);
    S.addChild(this.cust, this.sitC);
    /* столик, ноутбук, чашка и гость — одна группа: растёт вместе с гостем от точки на полу (маски считаются так же) */
    const seatScale = (c: Container) => {
      c.pivot.set(SEAT_PIVOT.x, SEAT_PIVOT.y);
      c.position.set(SEAT_PIVOT.x, SEAT_PIVOT.y);
      c.scale.set(GUEST_K);
    };
    seatScale(this.sitC);
    const tableC = new Container();
    tableC.addChild(place(tableT, TABLE_BOX.x, TABLE_BOX.y, TABLE_BOX.w, TABLE_BOX.h));
    seatScale(tableC);
    S.addChild(tableC, place(fg, 0, 0, W, H));
    this.deskC.addChild(this.saucer, this.sitFront, this.deskBase, this.lid);
    seatScale(this.deskC);
    S.addChild(this.deskC);
    this.buildDesk();

    /* свет: ореолы ламп, световые пятна на прилавке, пылинки в луче */
    [680, 870, 1060].forEach((x) => {
      const g = new Sprite(this.soft);
      g.anchor.set(0.5);
      g.position.set(x, 148);
      g.width = 320;
      g.height = 300;
      g.tint = 0xffc86e;
      g.blendMode = 'add';
      this.glows.push(g);
      const p = new Sprite(this.soft);
      p.anchor.set(0.5);
      p.position.set(x, 402);
      p.width = 250;
      p.height = 46;
      p.tint = 0xffb45a;
      p.blendMode = 'add';
      this.pools.push(p);
      S.addChild(g, p);
    });
    S.addChild(this.fx.root);

    /* бумага: пятна, волокна, зерно и виньетка — один запечённый слой */
    S.addChild(place(paperT, 0, 0, W, H));

    this.buildText();
    /* зал и бар — два слоя одного холста: вход в бар — плавное наложение, как раньше в CSS */
    const hall = new Container();
    for (const c of [...S.children]) hall.addChild(c);
    hall.pivot.set(W / 2, H / 2);
    hall.position.set(W / 2, H / 2);
    S.addChild(hall);
    this.hall = hall;
    await this.bar.build(r, r);
    this.bar.root.pivot.set(W / 2, H / 2);
    S.addChild(this.bar.root);
    this.ready = true;
    this.setLowFx(this.low);
    this.update(0, 0.3, 480);
  }

  private sunDisc!: Graphics;
  private sunC!: Container;

  private buildText(): void {
    const sign = new Text({ text: 'Cuppable', style: { fontFamily: 'Caveat, Nunito, cursive', fontSize: 30, fontWeight: '700', fill: '#F6EBDC', padding: 6 }, resolution: this.res });
    sign.alpha = 0.96;
    sign.anchor.set(0, 1);
    sign.position.set(466, 139);
    this.signC.addChild(sign);
  }

  /** Меню на доске: до четырёх строк «название — цена». */
  setMenu(rows: MenuRow[]): void {
    if (!this.ready) return;
    const key = JSON.stringify(rows);
    if (key === this.rowsKey) return;
    this.rowsKey = key;
    while (this.signC.children.length > 1) this.signC.children[this.signC.children.length - 1]?.destroy();
    const st = { fontFamily: 'Caveat, Nunito, cursive', fontSize: 20, fontWeight: '700', fill: '#F6EBDC', padding: 6 } as const;
    rows.forEach((r, i) => {
      const b = new Text({ text: String(r.price), style: st, resolution: this.res });
      b.anchor.set(1, 1);
      b.position.set(598, 163 + i * 24);
      /* название слева, цена справа: длинное название сжимаем, а если и так не влезает — обрезаем с многоточием */
      const room = 598 - b.width - 10 - 464;
      let name = r.name;
      const a = new Text({ text: name, style: st, resolution: this.res });
      while (a.width * 0.78 > room && name.length > 3) {
        name = name.slice(0, -2).trimEnd();
        a.text = name + '…';
      }
      if (a.width > room) a.scale.set(room / a.width);
      a.anchor.set(0, 1);
      a.position.set(464, 163 + i * 24);
      a.alpha = b.alpha = 0.96;
      this.signC.addChild(a, b);
    });
  }

  setUpgrades(u: { milk: boolean; machine: boolean; cozy: boolean }): void {
    if (!this.ready) return;
    this.lazyShow(this.jug, u.milk, () => raster(`<g ${WRAP}>${JUG}</g>`, { x: 900, y: 375, w: 50, h: 45 }, this.texRes), [900, 375, 50, 45]);
    this.lazyShow(this.gold, u.machine, () => raster(`<g ${WRAP}>${GOLD}</g>`, { x: 930, y: 300, w: 180, h: 120 }, this.texRes), [930, 300, 180, 120]);
    this.lazyShow(this.cozy, u.cozy, () => raster(`<g ${WRAP}>${lights()}</g>`, { x: -30, y: 0, w: 1340, h: 70 }, this.texRes), [-30, 0, 1340, 70]);
  }

  private readonly lazyDone = new WeakSet<Sprite>();
  private lazyShow(sp: Sprite, on: boolean, make: () => Promise<Texture>, r: number[]): void {
    if (!on) {
      sp.visible = false;
      return;
    }
    if (this.lazyDone.has(sp)) {
      sp.visible = true;
      return;
    }
    this.lazyDone.add(sp);
    void make().then((t) => {
      sp.texture = t;
      sp.position.set(r[0], r[1]);
      sp.width = r[2] as number;
      sp.height = r[3] as number;
      sp.visible = true;
    });
  }

  /** Бариста (и его рука перед предметами) растёт от линии края стойки; маска внутри переводится вместе с ним. */
  private baristaScale(c: Container): void {
    c.pivot.set(BARISTA_PIVOT.x, BARISTA_PIVOT.y);
    c.position.set(BARISTA_PIVOT.x, BARISTA_PIVOT.y);
    c.scale.set(BARISTA_K);
  }

  private async buildBarista(): Promise<void> {
    const B: Box = { x: 780, y: 270, w: 190, h: 150 };
    const p = baristaParts();
    const mk = (inner: string, px: number, py: number) => {
      const c = new Container();
      c.pivot.set(px, py);
      c.position.set(px, py);
      const s = new Sprite();
      s.position.set(B.x, B.y);
      c.addChild(s);
      void raster(wrapPart(inner, B), B, this.texRes * BARISTA_K).then((t) => {
        s.texture = t;
        s.width = B.w;
        s.height = B.h;
      });
      return c;
    };
    const wrapper = new Container();
    this.baristaC.position.set(0, 8);
    this.bodyC = mk(p.body, 0, 0);
    this.headC = mk(p.head('smile'), 865, 350);
    this.headSprite = this.headC.children[0] as Sprite;
    (['blink', 'joy', 'focus', 'smile', 'tired'] as BaristaFace[]).forEach((f) => {
      void raster(wrapPart(p.head(f), B), B, this.texRes * BARISTA_K).then((t) => {
        this.faces[f] = t;
      });
    });
    /* чашка в руке (лежит в системе руки) */
    this.cupC.position.set(8, 16);
    this.cupC.visible = false;
    const cup = new Graphics();
    cup.moveTo(786, 350).lineTo(808, 350).lineTo(804, 368).quadraticCurveTo(797, 372, 790, 368).closePath().fill('#FFF8EC').stroke({ width: 2.2, color: INK, join: 'round' });
    const cupG = this.cupG;
    cupG.pivot.set(797, 362);
    cupG.position.set(797, 362);
    cupG.scale.set(1.5);
    cupG.addChild(cup, this.cupTop, this.cupArt);
    this.cupC.addChild(cupG, this.cupStar);
    /* руки: ленты из атласа с суставами; чашка едет за левой кистью */
    const atlas = await rasterAtlas(baristaCells(), Math.ceil(this.texRes * BARISTA_K), wrapCell);
    const us = [0.5, 9, 21, 30, 33, 36, 45, 57].map((x) => x / BARISTA_ARM_LEN);
    for (let i = 0; i < 2; i++) {
      const rope = new Ribbon(atlas, 'bArm', us, 12);
      const hand = frameSprite(atlas, 'bHand', 0, 0);
      this.bArms.push(new Limb(rope, hand));
      this.bodyC.addChild(rope, hand);
    }
    this.cupHold.addChild(this.cupC);
    this.bodyC.addChild(this.cupHold);
    this.baristaC.addChild(this.bodyC, this.headC);
    wrapper.addChild(this.baristaC);
    const mask = new Graphics().rect(760, 250, 220, 149).fill(0xffffff);
    wrapper.addChild(mask);
    wrapper.mask = mask;
    this.baristaScale(wrapper);
    this.app.stage.addChild(wrapper);
    this.baristaF.position.set(0, 8);
    this.baristaF.addChild(this.bodyF);
    this.frontWrap.addChild(this.baristaF);
    const maskF = new Graphics().rect(760, 250, 220, 149).fill(0xffffff);
    this.frontWrap.addChild(maskF);
    this.frontWrap.mask = maskF;
    this.baristaScale(this.frontWrap);
    this.frontWrap.visible = false;
  }

  /** Руки баристы: кисть тянется к цели пружиной, локоть гнётся вниз (за стойкой его не видно). */
  private stepBarista(dt: number): void {
    const SH = [[836, 379], [894, 379]];
    const V = [[-29, 7], [48, 7]];
    const th = [this.bPose.arm, this.bPose.arm2];
    if (this.serveT > 0) this.serveT = Math.max(0, this.serveT - dt);
    const u = this.serveT > 0 ? Math.sin(Math.PI * (1 - this.serveT / 0.55)) : 0;
    for (let i = 0; i < 2; i++) {
      const limb = this.bArms[i];
      const h = this.bHands[i];
      const sh = SH[i];
      const v = V[i];
      if (!limb || !h || !sh || !v) continue;
      const a = ((th[i] ?? 0) * Math.PI) / 180;
      let tx = sh[0]! + v[0]! * Math.cos(a) - v[1]! * Math.sin(a);
      let ty = sh[1]! + v[0]! * Math.sin(a) + v[1]! * Math.cos(a);
      if (i === 0 && u > 0) {
        tx -= 26 * u;
        ty -= 5 * u;
      }
      h.step(dt, tx, ty);
      const k = ik2(sh[0]!, sh[1]!, h.x, h.y, 24, 24, i === 0 ? -1 : 1);
      limb.bend(sh[0]!, sh[1]!, k.ex, k.ey, k.hx, k.hy, 8.5);
      limb.end.position.set(k.hx, k.hy);
      if (i === 0) this.cupHold.position.set(k.hx - 805, k.hy - 386);
    }
    if (this.turnT > 0) this.turnT = Math.max(0, this.turnT - dt);
    this.headC.rotation = this.bHead.step(dt, ((this.bPose.nod + (this.turnT > 0 ? -7 : 0) + (this.stress > 1 ? 2.5 : 0)) * Math.PI) / 180);
    this.baristaC.y = 8 + this.bHop.step(dt, 0);
    /* подаёт или держит чашку: левая рука впереди предметов, иначе прячется за ними */
    const front = this.serveT > 0 || this.cupC.visible;
    const l0 = this.bArms[0];
    if (l0 && front !== this.armFront) {
      this.armFront = front;
      (front ? this.bodyF : this.bodyC).addChild(l0.rope, l0.end, this.cupHold);
      this.frontWrap.visible = front;
    }
    this.baristaF.y = this.baristaC.y;
    this.bodyF.y = this.bodyC.y;
  }

  /** Новый гость подошёл: бариста поворачивает голову и кивает. */
  baristaReact(): void {
    if (!this.ready) return;
    this.turnT = 1.1;
    this.bHead.kick(1.3);
    this.bHop.kick(-45);
  }

  /** Рука баристы протягивает чашку гостю. */
  baristaServe(): void {
    this.serveT = 0.55;
  }

  /** Нагрузка: 0 спокойно, 1 собранно, 2 устал и напряжён. */
  setBaristaStress(n: number): void {
    this.stress = n;
  }

  setBarista(p: BaristaPose): void {
    if (!this.ready) return;
    this.bPose = p;
    this.bodyC.y = p.bob;
  }

  /** Бариста радуется после выдачи напитка. */
  baristaJoy(sec = 1.6): void {
    this.joyT = sec;
    this.bHop.kick(-200);
  }

  private stepFace(dt: number): void {
    let want: BaristaFace = 'smile';
    if (this.joyT > 0) {
      this.joyT -= dt;
      want = 'joy';
    } else if (this.blinkOn > 0) {
      this.blinkOn -= dt;
      want = 'blink';
    } else {
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blinkT = 2.4 + ((this.now * 7919) % 3.1);
        this.blinkOn = 0.13;
      }
      if (this.stress > 1) want = 'tired';
      else if (this.stress > 0) want = 'focus';
    }
    if (want !== this.face) {
      const t = this.faces[want];
      if (t) {
        this.headSprite.texture = t;
        this.face = want;
      }
    }
  }

  setHeld(h: HeldCup | null): void {
    if (!this.ready) return;
    this.cupC.visible = !!h;
    if (!h) return;
    this.cupG.scale.set(1.5 * (h.k ?? 1));
    this.cupTop.clear().ellipse(797, 350, 11, 3.5).fill(h.top).stroke({ width: 2, color: INK });
    this.cupArt.clear();
    if (h.art) {
      const d = h.art === 'heart' ? 'M797 351.4c-2.6-1.7-4.8-.5-4.8 1 0 1.5 2.4 2.1 4.8 3.2 2.4-1.1 4.8-1.7 4.8-3.2 0-1.5-2.2-2.7-4.8-1Z' : 'M797 347.2Q802 349.2 801.6 351.2Q799.4 353.8 797 353.8Q794.6 353.8 792.4 351.2Q792 349.2 797 347.2Z';
      this.cupArt.path(new GraphicsPath(d)).fill({ color: '#F7EAD3', alpha: 0.3 + 0.7 * h.aq });
    }
    this.cupStar.clear();
    if (h.star) this.cupStar.path(new GraphicsPath('M810 332l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z')).fill('#E8B04A').stroke({ width: 1.6, color: INK, join: 'round' });
  }

  addActor(o: Omit<ActorOpts, 'res' | 'shadow'>): Actor {
    const a = new Actor({ ...o, res: this.texRes, shadow: this.shadow, scale: GUEST_K });
    this.cust.addChild(a.root);
    this.actors.add(a);
    return a;
  }

  removeActor(a: Actor): void {
    this.actors.delete(a);
    a.destroy();
  }

  clearActors(): void {
    this.actors.forEach((a) => a.destroy());
    this.actors.clear();
    this.fx.clear();
  }

  /** Лёгкая графика: без частиц, ореолов ламп, пятен света и луча. Вызывать можно в любой момент. */
  setLowFx(low: boolean): void {
    this.low = low;
    this.fx.enabled = !low;
    if (low) this.fx.clear();
    if (!this.ready) return;
    this.sunGlow.visible = !low;
    this.shaft.visible = !low;
    this.glows.forEach((g) => (g.visible = !low));
    this.pools.forEach((p) => (p.visible = !low));
  }

  /** Скорость пересчёта плотности под размер окна (dpr × масштаб сцены). */
  setResolution(res: number): void {
    if (!this.ready || this.software || Math.abs(res - this.res) < 0.05) return;
    this.res = res;
    this.app.renderer.resize(W, H, res);
  }

  /** Бар открыт или закрыт: зал уходит под бар, бар выезжает поверх. */
  setBar(on: boolean): void {
    this.barOn = on;
  }

  paintBar(f: BarFrame): void {
    if (this.ready && this.barP > 0) this.bar.paint(f);
  }

  /** SVG иконки напитка из пилота Н1-2 (компактный уровень) для билета; null, если такого размера и варианта нет. */
  drinkIcon(ref: ModelRef, w: number, h: number): string | null {
    try {
      return drinkIconSvg(specOf(ref.id, ref.size, ref.cold), w, h).svg;
    } catch {
      return null;
    }
  }

  setBarUpgrades(u: BarUpgrades): void {
    if (this.ready) this.bar.setUpgrades(u);
  }

  /** Ноутбук, блюдце и стул: неподвижные предметы столика, которыми двигает посадка гостя. */
  private buildDesk(): void {
    const set = (sp: Sprite, box: Box, inner: string, ax: number, ay: number, x: number, y: number, after?: () => void) => {
      sp.anchor.set(ax, ay);
      sp.position.set(x, y);
      sp.visible = false;
      void raster(`<g ${WRAP_PLAIN}>${inner}</g>`, box, this.texRes * GUEST_K).then((t) => {
        sp.texture = t;
        sp.width = box.w;
        sp.height = box.h;
        after?.();
      });
    };
    set(this.lid, box(188, 482, 84, 62), LID, 0.5, (540 - 482) / 62, 230, 540, () => (this.lidSy = this.lid.scale.y));
    set(this.deskBase, box(186, 536, 88, 18), LBASE, 0, 0, 186, 536);
    set(this.saucer, box(258, 543, 48, 16), SAUCER, 0, 0, 258, 543);
    /* стул: спинка и задние ножки; «подвес» внизу, чтобы отодвигаться и наклоняться от пола */
    const CH = box(172, 474, 116, 176);
    set(this.chair, CH, CHAIR, 0.5, (640 - 474) / 176, 230, 640);
    this.chair.visible = true;
  }

  /** Гость за столиком: приходит с кофе, отодвигает стул, садится, работает, пьёт; потом закрывает ноутбук, встаёт и уходит. */
  private stepSitter(dt: number): void {
    const TX = 230;
    this.sitT -= dt;
    if (this.sitSt === 'empty') {
      if (this.sitT > 0) return;
      const kind = ['student', 'student', 'regular', 'hurry'][Math.floor(Math.random() * 4)] as string;
      const a = new Actor({
        look: lookFor(kind),
        icon: '',
        iconKey: '',
        title: '',
        tags: [],
        x: -100,
        res: this.texRes * GUEST_K,
        shadow: this.shadow,
        onTap: () => undefined,
        seat: { front: this.sitFront, tableCup: { x: 52, y: 538 } },
        steam: (x, y) => this.fx.add({ x, y: y - 9, vx: (Math.random() - 0.5) * 6, vy: -(16 + Math.random() * 8), r: 2.5, grow: 8, a: 0.5, life: 2.2 })
      });
      a.root.eventMode = 'none';
      /* у каждого сидящего своя чашка: от эспрессо (0,77) до большой на 0,6 л (1,44) */
      a.holdCup('#5A3A2A', [0.77, 0.84, 1, 1, 1.14, 1.26, 1.44][Math.floor(Math.random() * 7)] as number);
      this.sitC.addChild(a.root);
      this.sitter = a;
      this.sitX = -100;
      this.sitV = 0;
      this.sitSt = 'in';
      return;
    }
    const a = this.sitter;
    if (!a) return;
    if (this.sitSt === 'in') {
      const want = Math.min(85, Math.max(0, (TX - this.sitX) * 3));
      this.sitV = damp(this.sitV, want, 5, dt);
      this.sitX += this.sitV * dt;
      if (TX - this.sitX < 1.2) {
        this.sitX = TX;
        this.sitV = 0;
        this.sitSt = 'sit';
        a.sitDown();
      }
    } else if (this.sitSt === 'sit' && a.phase === 'seated') {
      this.sitSt = 'seated';
      this.sitT = 28 + Math.random() * 32;
    } else if (this.sitSt === 'seated' && this.sitT <= 0) {
      this.sitSt = 'rise';
      a.standUp();
    } else if (this.sitSt === 'rise' && a.phase === 'walk') {
      this.sitSt = 'out';
      this.sitV = 0;
    } else if (this.sitSt === 'out') {
      this.sitV = damp(this.sitV, -85, 4, dt);
      this.sitX += this.sitV * dt;
      if (this.sitX <= -100) {
        a.destroy();
        this.sitter = null;
        this.sitSt = 'empty';
        this.sitT = 4 + Math.random() * 8;
        this.deskShow(null);
        return;
      }
    }
    a.update(dt, this.sitX, 0);
    this.deskShow(a);
  }

  /**
   * Ноутбук стоит между камерой и гостем. Пока он открыт, тело и руки гостя ниже кромки крышки (y 490–546)
   * скрыты на всю ширину стула, а над кромкой остаются голова и плечи. Тянется к чашке справа — рука видна.
   */
  private seatMasks(a: Actor | null): void {
    const on = !!a && a.laptopK > 0.5;
    const reach = on && !!a && a.reaching;
    const kc = a ? a.cupK : 1;
    const key = `${on ? 1 : 0}${reach ? 1 : 0}${a ? 1 : 0}${kc}`;
    if (a && a.root.mask !== (on ? this.seatMaskA : null)) a.root.mask = on ? this.seatMaskA : null;
    if (key === this.seatMaskState) return;
    this.seatMaskState = key;
    /* маски заданы в «исходных» координатах столика (крышка y 490–546); на экране группа растёт от точки на полу, маски переводим так же */
    const P = SEAT_PIVOT;
    const mx = (x: number) => P.x + (x - P.x) * GUEST_K;
    const my = (y: number) => P.y + (y - P.y) * GUEST_K;
    const R = (g: Graphics, x: number, y: number, w: number, h: number) => g.rect(mx(x), my(y), w * GUEST_K, h * GUEST_K);
    /* x1 — правая кромка скрытого; чашка на блюдце (x от 270, y от 524) остаётся видимой целиком */
    const draw = (g: Graphics, x1: number, cup: boolean) => {
      g.clear();
      R(g, 0, 0, W, 490);
      R(g, 0, 546, W, H - 546);
      R(g, 0, 490, 164, 56);
      R(g, x1, 490, W - x1, 56);
      /* окно под чашку растёт вместе с чашкой от её центра (280, 535): целая, с ручкой справа */
      if (cup) R(g, 280 - 10 * kc, 535 - 11 * kc, 26 * kc, 11 + 11 * kc);
      g.fill(0xffffff);
    };
    draw(this.seatMaskA, 284, false);
    draw(this.seatMaskB, reach ? 262 : 284, true);
    this.sitFront.mask = on ? this.seatMaskB : null;
  }

  /** Ноутбук, блюдце и стул следуют за фазой посадки гостя. */
  private deskShow(a: Actor | null): void {
    const open = a ? a.laptopK : 0;
    this.seatMasks(a);
    this.lid.visible = this.deskBase.visible = open > 0.002;
    this.lid.scale.y = this.lidSy * clamp(open, 0.001, 1.08);
    this.lid.alpha = clamp(open * 3, 0, 1);
    this.deskBase.alpha = clamp(open * 4, 0, 1);
    this.saucer.visible = !!a && a.seatK > 0.55;
    const k = a ? a.chairK : 0;
    this.chair.y = 640 - 9 * k;
    this.chair.x = 230 + 3 * k;
    this.chair.rotation = -0.08 * k;
  }

  private stepBar(dt: number): void {
    const to = this.barOn ? 1 : 0;
    if (this.barP === to) return;
    this.barP = clamp(this.barP + (to ? dt : -dt) / 0.3, 0, 1);
    const e = 1 - (1 - this.barP) ** 3;
    const b = this.bar.root;
    b.visible = this.barP > 0;
    b.alpha = clamp(e * 1.15, 0, 1);
    b.y = H / 2 + (1 - e) * 26;
    b.scale.set(1 + 0.02 * (1 - e));
    b.x = W / 2;
    this.hall.scale.set(1 + 0.04 * e);
    this.hall.visible = this.barP < 1;
  }

  /** Небо, часы, лампы, свет — раз в кадр. k — доля дня 0..1, minutes — время на часах. */
  update(dt: number, k: number, minutes: number): void {
    if (!this.ready) return;
    this.now += dt;
    this.stepBar(dt);
    const now = this.now;
    this.lamps.forEach((l, i) => (l.rotation = (1.1 * Math.sin(now * 0.8 + i * 1.9) * Math.PI) / 180));
    this.clouds.x = (now * 3.2) % 400;
    const ev = clamp((k - 0.55) / 0.45, 0, 1);
    /* у каждой лампы своё мерцание, к вечеру заметнее */
    this.glows.forEach((g, i) => (g.alpha = (0.1 + ev * 0.3) * (1 + (0.04 + ev * 0.05) * Math.sin(now * 3.1 + i * 2.1) + 0.03 * Math.sin(now * 7.3 + i * 1.3)) * 0.9));
    this.pools.forEach((p, i) => (p.alpha = (0.04 + ev * 0.2) * (1 + 0.05 * Math.sin(now * 3.4 + i * 2.1) + 0.03 * Math.sin(now * 8.1 + i))));
    /* блик ползёт по стеклу витрины раз в ~11 секунд */
    const gk = (now % 11) / 11;
    /* тонировка стекла постоянна, полосы едут (двигаем только их) */
    this.glareBands.x = 704 + gk * 120 - 50;
    this.glareBands.alpha = Math.sin(Math.min(1, gk * 1.5) * Math.PI);
    if (Math.abs(k - this.lastSky) > 0.002 || this.lastSky < 0) {
      this.lastSky = k;
      let a = SKY[0] as (typeof SKY)[number];
      let b = SKY[SKY.length - 1] as (typeof SKY)[number];
      for (let i = 0; i < SKY.length - 1; i++) {
        const lo = SKY[i] as (typeof SKY)[number];
        const hi = SKY[i + 1] as (typeof SKY)[number];
        if (k >= lo[0] && k <= hi[0]) {
          a = lo;
          b = hi;
          break;
        }
      }
      const u = b[0] === a[0] ? 0 : (k - a[0]) / (b[0] - a[0]);
      const g = this.skyCv.getContext('2d')!;
      const gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, css(lerpRGB(a[1], b[1], u)));
      gr.addColorStop(1, css(lerpRGB(a[2], b[2], u)));
      g.fillStyle = gr;
      g.fillRect(0, 0, 2, 64);
      this.skyTex.source.update();
      const sx = 112 + k * 176;
      const sy = 262 - Math.sin(k * Math.PI) * 128;
      this.sunC.position.set(sx, sy);
      this.sunDisc.tint = num(lerpRGB(a[3], b[3], u));
      this.sunGlow.position.set(sx, sy);
      /* луч ползёт по полу */
      const dx = (k - 0.5) * 240;
      const str = 0.15 + Math.sin(k * Math.PI) * 0.75;
      this.shaftGrad?.destroy();
      this.shaftGrad = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, colorStops: [{ offset: 0, color: 'rgba(255,241,196,.65)' }, { offset: 1, color: 'rgba(255,241,196,0)' }], textureSpace: 'local' });
      this.shaft.clear().poly([318, 112, 318, 362, 660 + dx, 720, 470 + dx, 720]).fill(this.shaftGrad);
      this.shaft.alpha = str;
      this.clkM.rotation = (((minutes % 60) * 6) * Math.PI) / 180;
      this.clkH.rotation = ((((minutes / 60) % 12) * 30 + (minutes % 60) / 2) * Math.PI) / 180;
    }
    this.shaft.alpha = (0.15 + Math.sin(clamp(k, 0, 1) * Math.PI) * 0.75) * (0.94 + 0.06 * Math.sin(now * 0.7));
    this.stepFace(dt);
    this.stepBarista(dt);
    this.stepSitter(dt);
    this.fx.update(dt);
  }

  private since = 0;
  private interval = 0;
  private lastWasRender = false;

  /**
   * Рисует кадр, если холст сейчас виден. frameMs — настоящая длительность прошлого кадра страницы:
   * если после отрисовки кадр «зависает» (слабая графика), следующие отрисовки идут реже.
   */
  render(dt: number, frameMs = 16.7): void {
    if (!this.ready) return;
    if (this.lastWasRender) {
      const cost = Math.max(0, frameMs - 20);
      this.interval = this.interval * 0.7 + Math.min(600, cost * 2) * 0.3;
      this.lastWasRender = false;
    }
    this.since += dt;
    if (this.since < (NOFX ? 1e9 : LOWFX ? 0.4 : this.interval / 1000)) return;
    this.since = 0;
    this.lastWasRender = true;
    this.app.render();
  }

  get renderer(): Renderer {
    return this.app.renderer;
  }
}

function lights(): string {
  let s = '';
  for (let i = 0; i < 9; i++) {
    const x = -20 + i * 160;
    s += `<path d="M${x} 16Q${x + 80} 46 ${x + 160} 16" fill="none" stroke-width="2"/><circle cx="${x + 80}" cy="36" r="18" fill="url(#gGlow)" stroke="none"/><circle cx="${x + 80}" cy="35" r="6" fill="#FFE29A"/>`;
  }
  return s;
}
