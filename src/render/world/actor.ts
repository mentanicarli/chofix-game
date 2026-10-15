import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { BONE, HEAD_BOX, JOINT, personParts, wrapCell, wrapPart, type Gaze, type Look, type MoodId, type PersonParts } from './art';
import { Seq, Spring, Spring2, clamp, damp, ease, ik2 } from './anim';
import { Ribbon, frameSprite } from './ribbon';
import { rasterAtlas, raster, type Atlas } from './svg';

const INK = 0x4a2f25;
const RAD = Math.PI / 180;
/** Свой генератор для чисто визуальной случайности: игровая случайность (Math.random) от внешнего вида не зависит. */
let seed = 0x9e3779b9;
const vr = (): number => {
  seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) | 0;
  return ((seed ^ (seed >>> 13)) >>> 0) / 4294967296;
};
const rr = (a: number, b: number): number => a + vr() * (b - a);

/** Куда смотрят глаза: центр, вниз (в экран), влево, вправо, вверх. */
const GAZES = { c: { x: 0, y: 0 }, d: { x: 0, y: 1.7 }, l: { x: -1.9, y: 0.4 }, r: { x: 1.9, y: 0.4 }, u: { x: 0, y: -1.4 } } as const satisfies Record<string, Gaze>;
type GazeKey = keyof typeof GAZES;

type Pt = { x: number; y: number };

export interface ActorOpts {
  look: Look;
  /** Разметка иконки напитка для пузыря заказа (рисуется вокруг точки 0,0). */
  icon: string;
  iconKey: string;
  /** масштаб иконки чашки в пузыре по объёму напитка */
  iconK?: number;
  title: string;
  tags: { text: string; color: string }[];
  x: number;
  res: number;
  shadow: Texture;
  onTap: () => void;
  /** Рост относительно базового, от точки на полу (ноги остаются на месте). Для сидящего масштабирует сцена целиком. */
  scale?: number;
  /** Гость за столиком: ноги анфас, слой для рук поверх стола, пар над чашкой. */
  seat?: { front: Container; tableCup: Pt };
  /** Пар над чашкой: мировые координаты. */
  steam?: (x: number, y: number) => void;
}

/** верх головы по причёскам (см. art.ts hair): у пучка выше, у шапки и кудрей чуть ниже обычного */
const HEAD_TOP: Readonly<Record<string, number>> = { bun: 379, curly: 384, beanie: 390, grey: 402 };

/** пузырь заказа чуть меньше (карточка 128 px → 115): при шаге очереди 130 px соседние пузыри не заходят друг на друга */
const BUBBLE_SCALE = 0.9;

export type SeatPhase = 'walk' | 'sit' | 'seated' | 'rise';

const iconCache = new Map<string, Promise<Texture>>();

/** Рука или нога: лента из атласа по ломаной и конец (кисть, ступня). */
export class Limb {
  readonly rope: Ribbon;
  readonly end: Sprite;
  readonly pts = new Float32Array(16);
  constructor(rope: Ribbon, end: Sprite) {
    this.rope = rope;
    this.end = end;
  }

  /** Три сустава (плечо, локоть, кисть) в ломаную с мягким сгибом. */
  bend(sx: number, sy: number, ex: number, ey: number, hx: number, hy: number, cap: number): void {
    const p = this.pts;
    let ax = ex - sx;
    let ay = ey - sy;
    let l = Math.hypot(ax, ay) || 1;
    ax /= l;
    ay /= l;
    let bx = hx - ex;
    let by = hy - ey;
    l = Math.hypot(bx, by) || 1;
    bx /= l;
    by /= l;
    const k = 3;
    const set = (i: number, x: number, y: number) => {
      p[i * 2] = x;
      p[i * 2 + 1] = y;
    };
    set(0, sx - ax * cap, sy - ay * cap);
    set(1, sx, sy);
    set(2, (sx + ex) / 2, (sy + ey) / 2);
    set(3, ex - ax * k, ey - ay * k);
    set(4, ex, ey);
    set(5, ex + bx * k, ey + by * k);
    set(6, (ex + hx) / 2, (ey + hy) / 2);
    set(7, hx, hy);
    this.rope.set(p);
  }
}

/** Гость: фигура из атласа (торс, ленты рук и ног, голова), пружинные позы, чашка, пузырь заказа. Всё Pixi. */
export class Actor {
  readonly root = new Container();
  alive = true;
  /** Фаза посадки: идёт / садится / сидит / встаёт. */
  phase: SeatPhase = 'walk';
  /** Насколько отодвинут стул (0..1) и насколько присел (0..1) — читает сцена. */
  chairK = 0;
  seatK = 0;
  /** Ноутбук раскрыт (0..1). */
  laptopK = 0;
  private readonly inner = new Container();
  private readonly back = { root: new Container(), up: new Container() };
  private readonly front = { root: new Container(), up: new Container() };
  private readonly holder = new Container();
  private readonly cupHolder = new Container();
  private readonly legsC = new Container();
  private readonly shadowS: Sprite;
  private readonly parts: PersonParts;
  private readonly tex: Texture[] = [];
  private readonly heads = new Map<string, Texture>();
  private readonly pending = new Set<string>();
  private atlas: Atlas | null = null;
  private headSp = new Sprite();
  private readonly headC = new Container();
  private hairC: Container | null = null;
  private legs: Limb[] = [];
  private shoes: Sprite[] = [];
  private seatShoes: Sprite[] = [];
  private knees: Sprite[] = [];
  private arms: Limb[] = [];
  private hands: { sp: Spring2; ovr: Pt | null }[] = [{ sp: new Spring2(-35, 533, 13, 0.7), ovr: null }, { sp: new Spring2(35, 533, 13, 0.7), ovr: null }];
  private readonly cup = new Container();
  private cupTop = new Graphics();
  private cupBody = new Graphics();
  private cupState: 'none' | 'hand' | 'table' = 'none';
  private cupScale = new Spring(0, 14, 0.45);
  /** масштаб модели чашки по объёму напитка: умножается на рост гостя (чашка живёт внутри его контейнера) */
  cupK = 1;
  private steamT = 0;
  private mood: MoodId = 'neutral';
  private gaze: GazeKey = 'c';
  private blinkT = 1.5 + vr() * 3;
  private blinking = 0;
  private eyesShut = false;
  private shakeT = 0;
  private readonly bubble = new Container();
  /** теги заказа («крепкий», сироп…) над пузырём: показываем только первому в очереди, чтобы теги соседей не накладывались (подробности всегда в билете) */
  private readonly tagsC = new Container();
  private bubbleOn = false;
  private bubbleK = 0;
  private readonly barG = new Graphics();
  private patW = 52;
  private patCol = 0x93a684;
  private patF = 1;
  private t = vr() * 10;
  private loaded = 0;

  /* движение */
  private lastX: number;
  private vx = 0;
  private ax = 0;
  private lastVx = 0;
  private dir = 1;
  private wk = 0;
  private ph = vr() * 6;
  private moving = false;
  private readonly sq = new Spring(0, 15, 0.32);
  private readonly lean = new Spring(0, 9, 0.38);
  private readonly headRot = new Spring(0, 11, 0.3);
  private readonly hairRot = new Spring(0, 8, 0.25);
  private readonly sway = new Spring(0, 7, 0.6);
  private hopY = 0;
  /** Множитель роста: скорости и прыжки считаются в «базовых» пикселях, на экране умножаются обратно. */
  private readonly k: number;
  /** верх макушки в координатах гостя (причёска выше или ниже): от неё считается хвостик пузыря и реплики */
  private readonly headTop: number;
  private hopV = 0;
  private hopQ = 0;
  private hopMul = 1;
  private airborne = false;
  private yParam = 0;
  /* ожидание */
  private idleT = rr(1.5, 3);
  private lookT = rr(1, 3);
  private lookYaw = 0;
  private lookHold = 0;
  private watchT = rr(4, 8);
  private watch = 0;
  private waveT = 0;
  private cheerT = 0;
  private sighT = rr(2, 4);
  private sigh = 0;
  private tapT = 0;
  private stomp = 0;
  private stompT = 0;
  private legBias = [0, 0];
  private arrivedOnce = false;
  private carry = false;
  /* посадка */
  private seq: Seq | null = null;
  private seatT = rr(4, 8);
  private act: 'type' | 'glance' | 'sip' | 'stretch' | 'think' = 'type';
  private actT = 0;
  private busy = false;
  private sipping = 0;
  private typeJ = 0;
  private armsFront = false;
  private wantFront = false;
  private kneeT = 0;
  private headDown = new Spring(0, 8, 0.6);

  constructor(private readonly o: ActorOpts) {
    this.parts = personParts(o.look, !!o.seat);
    this.lastX = o.x;
    const sh = new Sprite(o.shadow);
    sh.anchor.set(0.5);
    sh.position.set(0, 605);
    sh.width = 130;
    sh.height = 28;
    sh.tint = 0x3b2418;
    sh.alpha = 0.42;
    this.shadowS = sh;
    for (const r of [this.back, this.front]) {
      r.root.pivot.set(0, 600);
      r.root.position.set(0, 600);
      r.up.pivot.set(JOINT.waist[0], JOINT.waist[1]);
      r.up.position.set(JOINT.waist[0], JOINT.waist[1]);
      r.root.addChild(r.up);
    }
    this.back.root.addChild(this.legsC, this.back.up);
    this.inner.addChild(this.back.root, this.front.root, this.cupHolder, this.bubble);
    this.root.addChild(sh, this.inner);
    this.k = o.scale ?? 1;
    this.headTop = HEAD_TOP[o.look.hair] ?? 397;
    this.root.pivot.set(0, 600);
    this.root.position.set(o.x, 600);
    this.root.scale.set(this.k);
    this.root.visible = false;
    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';
    this.root.hitArea = new Rectangle(-64, 296, 128, 310);
    this.root.on('pointertap', () => o.onTap());
    this.holder.pivot.set(0, 600);
    this.buildBubble();
    this.buildCup();
    void this.load();
  }

  private async load(): Promise<void> {
    const p = this.parts;
    const sc = Math.ceil(clamp(this.o.res * this.k, 1, 3));
    const cells = [...p.cells, ...p.seatCells];
    const atlas = await rasterAtlas(cells, sc, wrapCell);
    const h = await raster(wrapPart(p.head('neutral', false, GAZES.c), HEAD_BOX), HEAD_BOX, this.o.res * this.k);
    if (!this.alive) {
      atlas.tex.destroy(true);
      h.destroy(true);
      return;
    }
    this.atlas = atlas;
    this.tex.push(h);
    this.heads.set('neutral|c', h);
    /* ноги: две ленты + ступни (под торсом) */
    const legUs = [0.5, 9, 17.5, 23.5, 26, 28.5, 34.5, 43].map((x) => x / (9 + BONE.leg1 + BONE.leg2 + 9));
    const armUs = [0.5, 9, 23, 34, 37, 40, 51.5, 66].map((x) => x / (9 + BONE.arm1 + BONE.arm2 + 10));
    for (let i = 0; i < 2; i++) {
      const rope = new Ribbon(atlas, 'legRope', legUs, 12);
      const shoe = frameSprite(atlas, 'shoe', 0, 0);
      this.legsC.addChild(rope, shoe);
      this.legs.push(new Limb(rope, shoe));
      this.shoes.push(shoe);
      if (this.o.seat) {
        const ss = frameSprite(atlas, 'shoeSeat', 0, 0);
        ss.visible = false;
        this.legsC.addChild(ss);
        this.seatShoes.push(ss);
        const kn = frameSprite(atlas, 'knee', 0, 0);
        kn.visible = false;
        this.legsC.addChild(kn);
        this.knees.push(kn);
      }
    }
    /* голова: сзади (волосы) и лицо */
    this.headC.pivot.set(JOINT.neck[0], JOINT.neck[1]);
    this.headC.position.set(JOINT.neck[0], JOINT.neck[1]);
    if (p.hairBack) {
      const hc = new Container();
      const fr = atlas.frames.get('hairBack');
      const sp = frameSprite(atlas, 'hairBack', 0, 0);
      /* точка подвеса: хвост — у виска, длинные и каре — на макушке */
      const px = p.hairBack === 'pony' ? 22 : 0;
      const py = p.hairBack === 'pony' ? 410 : 404;
      sp.position.set((fr?.box.x ?? 0) - px, (fr?.box.y ?? 0) - py);
      hc.position.set(px, py);
      hc.addChild(sp);
      this.headC.addChild(hc);
      this.hairC = hc;
    }
    this.headSp.texture = h;
    this.headSp.position.set(HEAD_BOX.x, HEAD_BOX.y);
    this.headSp.width = HEAD_BOX.w;
    this.headSp.height = HEAD_BOX.h;
    this.headC.addChild(this.headSp);
    /* торс */
    const fr = atlas.frames.get('torso');
    const ts = frameSprite(atlas, 'torso', 0, 0);
    ts.position.set(fr?.box.x ?? 0, fr?.box.y ?? 0);
    ts.pivot.set(0, 0);
    this.back.up.addChild(ts, this.headC);
    /* руки: ленты и кисти (над торсом и над головой) */
    for (let i = 0; i < 2; i++) {
      const rope = new Ribbon(atlas, 'armRope', armUs, 12);
      const hand = frameSprite(atlas, i === 0 ? 'handL' : 'handR', 0, 0);
      this.front.up.addChild(rope);
      if (i === 1) this.front.up.addChild(this.cup);
      this.front.up.addChild(hand);
      this.arms.push(new Limb(rope, hand));
    }
    this.root.visible = true;
    this.loaded = 1;
    this.setHead();
    this.update(0.0001, this.o.x, 0);
  }

  /** Лицо: настроение + мигание + взгляд. Если нужной картинки ещё нет, остаётся прежняя. */
  private async want(m: MoodId, blink: boolean, g: GazeKey): Promise<void> {
    const key = `${m}${blink ? '*' : ''}|${g}`;
    if (this.heads.has(key) || this.pending.has(key) || !this.alive) return;
    this.pending.add(key);
    const t = await raster(wrapPart(this.parts.head(m, blink, GAZES[g]), HEAD_BOX), HEAD_BOX, this.o.res * this.k);
    this.pending.delete(key);
    if (!this.alive) {
      t.destroy(true);
      return;
    }
    this.heads.set(key, t);
    this.tex.push(t);
    this.setHead();
  }

  private setHead(): void {
    const b = this.blinking > 0 || this.eyesShut;
    const t = this.heads.get(`${this.mood}${b ? '*' : ''}|${this.gaze}`) ?? this.heads.get(`${this.mood}|${this.gaze}`) ?? this.heads.get(`${this.mood}|c`) ?? this.heads.get('neutral|c');
    if (t && this.headSp.texture !== t) this.headSp.texture = t;
  }

  setMood(m: MoodId): void {
    this.mood = m;
    void this.want(m, false, this.gaze);
    if (m === 'neutral' || m === 'wait') void this.want(m, true, this.gaze);
    this.setHead();
    if (m === 'annoyed' || m === 'angry') this.sigh = 1;
  }

  /** Заказ в пузыре: прячет/показывает с «пружинкой». Первое появление — гость машет рукой. */
  /** Y кончика хвостика пузыря на сцене (под него встаёт реплика), с учётом роста гостя */
  get bubbleTipY(): number {
    return 600 - this.k * (600 - (this.headTop - 4));
  }

  showBubble(on: boolean): void {
    this.bubbleOn = on;
    if (on && !this.arrivedOnce) {
      this.arrivedOnce = true;
      this.waveT = 1.1;
      this.sq.x = Math.max(this.sq.x, 0.07);
    }
  }

  showTags(on: boolean): void {
    this.tagsC.visible = on;
  }

  hideBubbleNow(): void {
    this.bubbleOn = false;
    this.bubbleK = 0;
    this.bubble.visible = false;
  }

  /** Полоска терпения, f от 0 до 1. */
  setPatience(f: number): void {
    this.patF = f;
    this.patW = Math.round(f * 520) / 10;
    this.patCol = f > 0.5 ? 0x93a684 : f > 0.25 ? 0xe8b04a : 0xc4694a;
    this.barG.clear().roundRect(-16, 330, this.patW, 10, 5).fill(this.patCol).stroke({ width: 2, color: INK });
  }

  shake(): void {
    this.shakeT = 0.4;
  }

  toFront(): void {
    this.root.parent?.addChild(this.root);
  }

  /** Прыжок: strength 1 — радость (два подскока), меньше — лёгкий подскок. */
  hop(strength = 1): void {
    this.hopMul = strength;
    this.hopQ = strength > 0.8 ? 1 : 0;
    this.launch(strength);
  }

  private launch(k: number): void {
    this.hopV = -Math.sqrt(2 * 1000 * 15 * k);
    this.airborne = true;
    this.sq.x = -0.1 * k;
  }

  /** Протянуть правую руку к чашке, которую сейчас подадут. */
  reach(on: boolean): void {
    const h = this.hands[1];
    if (h) h.ovr = on ? { x: 40, y: 506 } : this.carry ? { x: 17, y: 507 } : null;
  }

  /** Чашка оказалась в руке: рука подносит её к груди, гость радуется. */
  takeCup(top: string, k = 1): void {
    this.cupK = k;
    this.drawCup(top);
    this.cupState = 'hand';
    this.cup.visible = true;
    this.cupScale.set(0.55);
    this.carry = true;
    const h = this.hands[1];
    if (h) h.ovr = { x: 17, y: 507 };
    this.cheerT = 1.1;
  }

  /** Гость идёт с чашкой (пришёл в зал с кофе). */
  holdCup(top: string, k = 1): void {
    this.cupK = k;
    this.drawCup(top);
    this.cupState = 'hand';
    this.cup.visible = true;
    this.cupScale.set(1);
    this.carry = true;
    const h = this.hands[1];
    if (h) h.ovr = { x: 17, y: 507 };
  }

  get cupInHand(): boolean {
    return this.cupState === 'hand';
  }

  private buildCup(): void {
    this.cup.visible = false;
    this.cup.addChild(this.cupBody, this.cupTop);
    this.drawCup('#5A3A2A');
  }

  private drawCup(top: string): void {
    this.cupBody.clear();
    this.cupBody.moveTo(-9, -8).lineTo(9, -8).lineTo(7, 8).quadraticCurveTo(0, 12, -7, 8).closePath().fill('#FFF8EC').stroke({ width: 2.4, color: INK, join: 'round' });
    this.cupBody.moveTo(9, -3).quadraticCurveTo(16, -3, 15, 3).quadraticCurveTo(14, 7, 8, 5).stroke({ width: 2.2, color: INK, cap: 'round', join: 'round' });
    this.cupTop.clear().ellipse(0, -8, 9, 2.8).fill(top).stroke({ width: 2, color: INK });
  }

  /* ---------- координаты ---------- */

  /** Точка стола/сцены (системa «внутри гостя», без сдвигов тела) → система фигуры. */
  private toFig(x: number, y: number): Pt {
    const dy = this.bodyDy();
    const r = -this.back.up.rotation;
    const wx = JOINT.waist[0];
    const wy = JOINT.waist[1];
    const px = x - wx;
    const py = y - dy - wy;
    return { x: wx + px * Math.cos(r) - py * Math.sin(r), y: wy + px * Math.sin(r) + py * Math.cos(r) };
  }

  private fromFig(x: number, y: number): Pt {
    const dy = this.bodyDy();
    const r = this.back.up.rotation;
    const wx = JOINT.waist[0];
    const wy = JOINT.waist[1];
    const px = x - wx;
    const py = y - wy;
    return { x: wx + px * Math.cos(r) - py * Math.sin(r), y: wy + px * Math.sin(r) + py * Math.cos(r) + dy };
  }

  private bodyDy(): number {
    return this.seatK * 11;
  }

  /* ---------- посадка за стол ---------- */

  /** Посадка: отодвинуть стул, присесть, придвинуться, поставить чашку. Читает сцена через phase/chairK/seatK/laptopK. */
  sitDown(): void {
    if (!this.o.seat || this.phase !== 'walk') return;
    const T = this.o.seat.tableCup;
    this.phase = 'sit';
    this.busy = true;
    this.wantFront = true;
    const s = new Seq();
    /* руки поднимаются к поясу: так их можно перенести на слой над столом незаметно */
    s.call(() => this.setHandTargets({ x: -15, y: 506 }, { x: 15, y: 506 }))
      .wait(0.3)
      .to(0.38, (u) => (this.chairK = u), ease.outCubic)
      .over(0.3, 0.55, (u) => {
        this.seatK = u;
        this.sq.x = Math.max(this.sq.x, 0.1 * ease.bell(u));
      }, ease.inOutCubic)
      .over(0.25, 0.4, (u) => (this.chairK = 1 - u), ease.inOutCubic)
      .call(() => {
        this.setHandTargets({ x: -14, y: 524 }, { x: 14, y: 524 });
      })
      .wait(0.3)
      .call(() => {
        this.laptopK = 0.01;
        const p = this.cupFigPoint(T);
        this.setHandTargets({ x: -14, y: 540 }, p ? { x: T.x, y: T.y - 4 } : null);
      })
      .to(0.35, (u) => (this.laptopK = u), ease.outBack)
      .wait(0.35)
      .call(() => {
        this.cupToTable();
        this.setHandTargets(null, null);
      })
      .wait(0.3)
      .call(() => {
        this.phase = 'seated';
        this.busy = false;
        this.seatT = rr(2.5, 5);
      });
    this.seq = s;
  }

  /** Встать: закрыть ноутбук, взять чашку, отодвинуть стул, подняться. */
  standUp(): void {
    if (!this.o.seat || this.phase !== 'seated') return;
    const T = this.o.seat.tableCup;
    this.phase = 'rise';
    this.busy = true;
    this.seq = null;
    this.sipping = 0;
    this.headDown.x = 0;
    this.setGaze('d');
    const s = new Seq();
    s.call(() => this.setHandTargets({ x: -16, y: 530 }, { x: 16, y: 530 }))
      .to(0.35, (u) => (this.laptopK = 1 - u), ease.inOutCubic)
      .call(() => this.setHandTargets(null, { x: T.x, y: T.y - 3 }))
      .wait(0.55)
      .call(() => {
        this.cupToHand();
        this.setHandTargets(null, { x: 17, y: 507 });
        this.carry = true;
      })
      .wait(0.35)
      .to(0.34, (u) => (this.chairK = u), ease.outCubic)
      .over(0.2, 0.55, (u) => (this.seatK = 1 - u), ease.inOutCubic)
      .over(0.3, 0.4, (u) => (this.chairK = 1 - u), ease.inOutCubic)
      .call(() => {
        const r = this.hands[1];
        if (r) r.ovr = { x: 17, y: 507 };
        const l = this.hands[0];
        if (l) l.ovr = null;
        this.wantFront = false;
        this.phase = 'walk';
        this.busy = false;
      });
    this.seq = s;
  }

  private cupFigPoint(p: Pt): Pt {
    return this.toFig(p.x, p.y);
  }

  private setHandTargets(l: Pt | null, r: Pt | null): void {
    const a = this.hands[0];
    const b = this.hands[1];
    if (a) a.ovr = l ? this.toFig(l.x, l.y) : null;
    if (b) b.ovr = r ? this.toFig(r.x, r.y) : null;
  }

  /** Чашка из руки на блюдце. */
  private cupToTable(): void {
    const T = this.o.seat?.tableCup;
    if (!T) return;
    this.cupState = 'table';
    this.cupHolder.addChild(this.cup);
    this.cup.position.set(T.x, T.y);
    this.cup.rotation = 0;
    this.cup.scale.set(this.cupK);
    this.carry = false;
  }

  private cupToHand(): void {
    this.cupState = 'hand';
    this.front.up.addChildAt(this.cup, Math.max(0, this.front.up.children.length - 1));
    const h = this.hands[1];
    if (h) this.cup.position.set(h.sp.x, h.sp.y);
  }

  private setGaze(g: GazeKey): void {
    if (this.gaze === g) return;
    this.gaze = g;
    void this.want(this.mood, false, g);
    void this.want(this.mood, true, g);
    this.setHead();
  }

  /** Сидячие занятия: печатает, смотрит по сторонам, пьёт, потягивается, задумывается. */
  private seatedLife(dt: number): void {
    this.seatT -= dt;
    this.typeJ += dt;
    if (this.seatT > 0 || this.busy) return;
    const T = this.o.seat?.tableCup;
    if (!T) return;
    const roll = vr();
    const s = new Seq();
    this.busy = true;
    if (roll < 0.42) {
      /* пьёт кофе: рука к чашке, подняла, глоток, вернула */
      this.act = 'sip';
      s.call(() => this.setHandTargets({ x: -14, y: 540 }, { x: T.x, y: T.y - 3 }))
        .wait(0.5)
        .call(() => {
          this.cupToHand();
          this.setHandTargets({ x: -14, y: 540 }, null);
          const h = this.hands[1];
          if (h) h.ovr = { x: 11, y: 459 };
          this.setGaze('d');
        })
        .wait(0.75)
        .call(() => (this.sipping = 1))
        .wait(0.95)
        .call(() => {
          this.sipping = 0;
          const h = this.hands[1];
          if (h) h.ovr = this.toFig(T.x, T.y - 3);
        })
        .wait(0.75)
        .call(() => {
          this.cupToTable();
          this.setHandTargets(null, null);
        })
        .wait(0.3)
        .call(() => this.endAct(rr(6, 11)));
    } else if (roll < 0.62) {
      /* смотрит по сторонам */
      this.act = 'glance';
      const side: GazeKey = vr() < 0.5 ? 'l' : 'r';
      s.call(() => {
        this.setGaze(side);
        this.lookYaw = side === 'l' ? -6 : 6;
      })
        .wait(1.0)
        .call(() => {
          this.setGaze(side === 'l' ? 'r' : 'l');
          this.lookYaw = side === 'l' ? 6 : -6;
        })
        .wait(0.8)
        .call(() => {
          this.setGaze('u');
          this.lookYaw = 0;
        })
        .wait(0.7)
        .call(() => {
          this.setGaze('d');
          this.endAct(rr(4, 8));
        });
    } else if (roll < 0.8) {
      /* потягивается */
      this.act = 'stretch';
      s.call(() => {
        this.setGaze('c');
        this.setHandTargets({ x: -30, y: 480 }, { x: 30, y: 480 });
      })
        .wait(0.35)
        .call(() => {
          const a = this.hands[0];
          const b = this.hands[1];
          if (a) a.ovr = { x: -26, y: 418 };
          if (b) b.ovr = { x: 26, y: 418 };
          this.headDown.x = -4;
          this.sq.kick(-0.5);
        })
        .wait(1.3)
        .call(() => this.setHandTargets({ x: -14, y: 530 }, { x: 14, y: 530 }))
        .wait(0.5)
        .call(() => {
          this.setHandTargets(null, null);
          this.setGaze('d');
          this.endAct(rr(8, 14));
        });
    } else {
      /* задумалась: рука к подбородку */
      this.act = 'think';
      s.call(() => {
        const b = this.hands[1];
        if (b) b.ovr = { x: 12, y: 462 };
        this.setGaze('u');
        this.lookYaw = 3;
      })
        .wait(2.0)
        .call(() => {
          this.setHandTargets(null, null);
          this.setGaze('d');
          this.lookYaw = 0;
          this.endAct(rr(6, 10));
        });
    }
    this.seq = s;
  }

  private endAct(next: number): void {
    this.busy = false;
    this.act = 'type';
    this.seatT = next;
    this.seq = null;
  }

  /* ---------- кадр ---------- */

  /**
   * Кадр. x — положение гостя, y — смещение по вертикали (уход чуть ближе к краю).
   * Шаг, наклон, сжатие и всё прочее гость считает сам из скорости.
   */
  update(dt: number, x: number, y: number): void {
    this.t += dt;
    this.yParam = y;
    const atl = this.atlas;
    if (!atl || !this.loaded) {
      this.root.position.set(x, 600 + y);
      this.lastX = x;
      return;
    }
    const seated = this.phase === 'seated' || this.phase === 'sit' || (this.phase === 'rise' && this.seatK > 0.05);
    /* скорость, ускорение */
    const raw = dt > 1e-5 ? (x - this.lastX) / dt / this.k : 0;
    this.lastX = x;
    this.vx = damp(this.vx, raw, 16, Math.max(dt, 1e-4));
    this.ax = damp(this.ax, dt > 1e-5 ? (this.vx - this.lastVx) / dt : 0, 10, Math.max(dt, 1e-4));
    this.lastVx = this.vx;
    const sp = Math.abs(this.vx);
    if (sp > 6) this.dir = Math.sign(this.vx);
    const wasMoving = this.moving;
    this.moving = sp > 14;
    if (wasMoving && !this.moving && !this.airborne) this.sq.x = Math.max(this.sq.x, clamp(0.03 + this.lastSpeed * 0.0004, 0.03, 0.08));
    if (!wasMoving && this.moving) this.sq.x = Math.min(this.sq.x, -0.035);
    if (sp > 14) this.lastSpeed = sp;
    this.wk = damp(this.wk, clamp((sp - 8) / 40, 0, 1), 10, dt);
    this.ph += dt * clamp(sp / 12, 0, 16);
    const wk = this.wk;
    this.sway.step(dt, 0);
    if (this.seq && this.seq.update(dt)) this.seq = null;
    if (this.phase === 'seated') this.seatedLife(dt);

    /* ожидание, пока стоит */
    this.idle(dt, wk, seated);

    /* прыжок */
    let hopY = 0;
    if (this.airborne) {
      this.hopV += 1000 * dt;
      this.hopY += this.hopV * dt;
      if (this.hopY >= 0) {
        this.hopY = 0;
        this.sq.x = 0.13 * this.hopMul;
        if (this.hopQ > 0) {
          this.hopQ = 0;
          this.hopV = -Math.sqrt(2 * 1000 * 8 * this.hopMul);
          this.hopY = -0.01;
        } else this.airborne = false;
      }
      hopY = this.hopY;
    }

    /* ноги */
    const A = 22 * RAD;
    const B = 42 * RAD;
    const legPts: { kx: number; ky: number; ax: number; ay: number; sh: number }[] = [];
    let lowest = 0;
    for (let i = 0; i < 2; i++) {
      const hip = i === 0 ? JOINT.hipL : JOINT.hipR;
      const phi = this.ph + i * Math.PI;
      const th = -this.dir * A * Math.sin(phi) * wk + (this.legBias[i] ?? 0) * RAD;
      let ka = this.dir * B * Math.max(0, Math.cos(phi)) * wk;
      if (i === 1 && this.tapT > 0) ka += 26 * RAD * (0.5 + 0.5 * Math.sin(this.t * 22)) * Math.min(1, this.tapT);
      const kx = hip[0] - Math.sin(th) * BONE.leg1;
      const ky = hip[1] + Math.cos(th) * BONE.leg1;
      const ax = kx - Math.sin(th + ka) * BONE.leg2;
      const ay = ky + Math.cos(th + ka) * BONE.leg2;
      legPts.push({ kx, ky, ax, ay, sh: th + ka });
      lowest = Math.max(lowest, ay);
    }
    /* опорная ступня всегда на полу */
    const ground = this.airborne ? 0 : clamp(600 - lowest, -2, 6);

    /* корень: положение, сжатие, наклон */
    const bob = this.seatK > 0.5 ? 0 : ground;
    const jump = hopY;
    this.root.position.set(x + this.sway.x * this.k, 600 + y + (jump + bob) * this.k);
    this.root.rotation = 0;
    const sq = this.sq.step(dt, 0);
    const sy = 1 - sq;
    const sx = 1 + sq * 0.55;
    const breath = 1 + 0.011 * Math.sin(this.t * 2.1) + this.sigh * 0.025 * Math.sin(clamp(this.sigh, 0, 1) * Math.PI);
    const dyS = this.bodyDy();
    for (const r of [this.back, this.front]) {
      r.root.scale.set(sx * (2 - breath), sy * breath);
      r.root.position.set(0, 600 + dyS);
    }
    const target = clamp(this.dir * (sp / 170) * 5 + -this.ax * 0.0035, -9, 9) * wk;
    const lean = this.lean.step(dt, target + this.leanTarget(seated)) * RAD;
    const seatScale = 1 + 0.025 * this.seatK;
    for (const r of [this.back, this.front]) {
      r.up.rotation = lean + Math.sin(this.ph) * 0.02 * wk * this.dir;
      r.up.scale.set(seatScale);
    }

    /* тень по высоте прыжка */
    this.shadowS.visible = this.seatK < 0.2;
    const hh = clamp(-jump / 18, 0, 1);
    this.shadowS.width = 130 * (1 - hh * 0.25);
    this.shadowS.alpha = 0.42 * (1 - hh * 0.4);
    this.shadowS.position.y = 605 - bob - jump;

    /* ноги: ступени ходьбы или сидячее положение */
    this.layoutLegs(legPts, dt, seated, ground);

    /* руки */
    this.layoutArms(dt, wk, seated);

    /* голова: запаздывает за телом, смотрит по сторонам */
    const headTarget = -lean * 0.8 + this.lookYaw * RAD + (this.watch > 0 ? -9 * RAD : 0) + Math.sin(this.t * 1.3) * 1.1 * RAD + (this.sipping > 0 ? 6 * RAD : 0);
    const hr = this.headRot.step(dt, headTarget + (this.stomp > 0 ? Math.sin(this.t * 40) * 0.02 * this.stomp : 0));
    this.headC.rotation = hr + Math.sin(this.ph * 2) * 0.026 * wk;
    const hd = this.headDown.step(dt, (seated && this.phase === 'seated' && this.act !== 'glance' && this.act !== 'think' && this.sipping === 0 ? 3.2 : 0) + this.watch * 2);
    const hdx = this.lookYaw * 0.35;
    this.headC.position.set(JOINT.neck[0] + hdx, JOINT.neck[1] + hd + (this.sipping > 0 ? -1 : 0));
    this.headC.scale.set(1, 1 - Math.max(0, hd) * 0.004);
    if (this.hairC) {
      const swing = this.hairRot.step(dt, clamp(-this.vx * 0.0011 + -this.ax * 0.0002 - (hr - 0) * 0.5, -0.5, 0.5));
      const k = this.parts.hairBack === 'pony' ? 1 : 0.35;
      this.hairC.rotation = swing * k;
    }

    this.faceLife(dt, seated);
    this.cupLife(dt);
    this.armsLayer(seated);
    this.shake_(dt);
    this.bubbleLife(dt);
  }

  private lastSpeed = 60;

  /** Наклон корпуса от поз: потягивание откидывает назад, сидя — чуть вперёд. */
  /** Тянется к чашке на столе: рука должна быть видна справа от ноутбука. */
  get reaching(): boolean {
    return this.act === 'sip';
  }

  private leanTarget(seated: boolean): number {
    let l = 0;
    if (this.sipping > 0) l -= 1.5;
    if (this.act === 'stretch' && this.busy) l -= 2.5;
    if (seated && this.phase === 'seated' && this.act === 'type') l += 0.8;
    if (this.sigh > 0) l += 1.2 * Math.sin(Math.min(1, this.sigh) * Math.PI);
    return l;
  }

  /** Живость на месте: переминается, смотрит по сторонам, на часы, вздыхает, топает. */
  private idle(dt: number, wk: number, seated: boolean): void {
    if (this.waveT > 0) this.waveT = Math.max(0, this.waveT - dt);
    if (this.cheerT > 0) this.cheerT = Math.max(0, this.cheerT - dt);
    if (this.sigh > 0) this.sigh = Math.max(0, this.sigh - dt * 0.6);
    if (this.tapT > 0) this.tapT = Math.max(0, this.tapT - dt);
    if (this.stomp > 0) this.stomp = Math.max(0, this.stomp - dt * 2);
    if (seated || wk > 0.05 || this.phase !== 'walk') {
      this.watch = Math.max(0, this.watch - dt);
      return;
    }
    const m = this.mood;
    const waiting = m === 'wait' || m === 'annoyed' || m === 'angry';
    /* перенос веса */
    this.idleT -= dt;
    if (this.idleT <= 0) {
      this.idleT = rr(2.5, 5.5);
      const s = vr() < 0.5 ? -1 : 1;
      this.legBias[0] = s * rr(2, 5);
      this.legBias[1] = -s * rr(1, 4);
      this.sway.kick(s * 18);
    }
    /* взгляд */
    this.lookT -= dt;
    if (this.lookT <= 0) {
      if (this.lookYaw !== 0) {
        this.lookYaw = 0;
        this.lookT = rr(2, 4);
      } else {
        this.lookYaw = (vr() < 0.5 ? -1 : 1) * rr(4, 8);
        this.lookT = rr(0.8, 1.6);
      }
    }
    /* часы: левая рука к лицу */
    this.watchT -= dt;
    if (this.watchT <= 0 && this.carry === false) {
      this.watch = waiting ? 1.7 : 0;
      this.watchT = waiting ? rr(5, 9) : rr(9, 15);
      if (!waiting) this.watch = 1.3;
    }
    this.watch = Math.max(0, this.watch - dt);
    /* нетерпение: постукивание, вздох, топанье */
    if (m === 'wait') {
      if (this.tapT <= 0 && vr() < dt * 0.5) this.tapT = 1.6;
    } else if (m === 'annoyed') {
      if (this.tapT <= 0 && vr() < dt * 0.9) this.tapT = 2.2;
      this.sighT -= dt;
      if (this.sighT <= 0) {
        this.sighT = rr(3, 5);
        this.sigh = 1;
      }
    } else if (m === 'angry') {
      this.stompT -= dt;
      if (this.stompT <= 0) {
        this.stompT = rr(0.55, 0.9);
        this.stomp = 1;
        this.sq.x = Math.max(this.sq.x, 0.06);
        this.sway.kick((vr() < 0.5 ? -1 : 1) * 25);
      }
    }
  }

  /** Ходьба/ожидание: мёртвые и живые позы ног. В сидячей позе — колени и ступни анфас. */
  private layoutLegs(pts: { kx: number; ky: number; ax: number; ay: number; sh: number }[], dt: number, seated: boolean, ground: number): void {
    void dt;
    void ground;
    const full = this.seatK > 0.5;
    if (full && this.legsC.parent !== this.inner) {
      /* пока гость сидит, ноги стоят в системе «стола» и не двигаются вместе с корпусом */
      this.inner.addChildAt(this.legsC, 0);
      this.legsC.position.set(0, 0);
    } else if (!full && this.legsC.parent !== this.back.root) {
      this.back.root.addChildAt(this.legsC, 0);
      this.legsC.position.set(0, 0);
    }
    for (let i = 0; i < 2; i++) {
      const l = this.legs[i];
      const sh = this.shoes[i];
      if (!l || !sh) continue;
      const ss = this.seatShoes[i];
      const kn = this.knees[i];
      if (kn) kn.visible = full;
      if (full) {
        const s = i === 0 ? -1 : 1;
        this.kneeT += 0;
        const jig = this.legJig(i);
        const hx = s * 14;
        const hy = 576;
        const kx = s * (25 + jig.kx);
        const ky = 597;
        const ax = s * (17 + jig.ax);
        const ay = 629 + jig.ay;
        l.bend(hx, hy, kx, ky, ax, ay, 5);
        kn?.position.set(kx, ky - 1);
        sh.visible = false;
        if (ss) {
          ss.visible = true;
          ss.position.set(ax + s * 1, ay + 5);
          ss.rotation = s * (0.05 + jig.rot);
        }
      } else {
        const p = pts[i];
        if (!p) continue;
        const hip = i === 0 ? JOINT.hipL : JOINT.hipR;
        l.bend(hip[0], hip[1], p.kx, p.ky, p.ax, p.ay, BONE.cap);
        sh.visible = true;
        sh.position.set(p.ax - Math.sin(p.sh) * 1, p.ay + Math.cos(p.sh) * 1);
        sh.rotation = p.sh * 0.75;
        if (ss) ss.visible = false;
      }
    }
    void seated;
  }

  /** Лёгкое подрагивание коленей и ступней сидящего: печатает — колено пляшет, ждёт — переступает. */
  private legJig(i: number): { kx: number; ax: number; ay: number; rot: number } {
    const t = this.t;
    const k = this.phase === 'seated' ? 1 : this.seatK;
    const tap = i === 1 ? Math.max(0, Math.sin(t * 5.3)) * (Math.sin(t * 0.37) > 0.35 ? 1 : 0) : 0;
    const sw = Math.sin(t * 0.9 + i) * 0.4;
    return { kx: sw * 0.5 * k, ax: sw * k, ay: -tap * 2.2 * k, rot: tap * 0.18 * k };
  }

  /** Руки: куда тянется каждая кисть. Свободные — маятник ходьбы; иначе заданная цель. */
  private layoutArms(dt: number, wk: number, seated: boolean): void {
    for (let i = 0; i < 2; i++) {
      const limb = this.arms[i];
      const h = this.hands[i];
      if (!limb || !h) continue;
      const sh = i === 0 ? JOINT.shL : JOINT.shR;
      const out = i === 0 ? 1 : -1;
      const phi = this.ph + i * Math.PI;
      const swing = this.dir * 24 * RAD * Math.sin(phi) * wk;
      const splay = out * 11 * RAD;
      const th = splay + swing;
      const reach = 55.5 - 4 * Math.max(0, swing * out) * 2;
      let tx = sh[0] - Math.sin(th) * reach;
      let ty = sh[1] + Math.cos(th) * reach;
      let ovr = h.ovr;
      /* пока руки не вернулись под стол, левая держится у пояса */
      if (!ovr && i === 0 && this.armsFront && !this.wantFront) ovr = { x: -15, y: 506 };
      /* особые позы ожидания и радости, пока заняты не по сцене */
      if (!ovr && !seated) {
        if (i === 0 && this.watch > 0) ovr = { x: -4, y: 476 };
        else if (i === 1 && this.waveT > 0) ovr = { x: 50 + Math.sin(this.t * 15) * 6, y: 436 };
        else if (i === 0 && this.cheerT > 0 && this.carry) ovr = { x: -34 + Math.sin(this.t * 14) * 3, y: 428 };
        else if (this.mood === 'annoyed' || this.mood === 'angry') {
          if (!(i === 1 && this.carry)) ovr = i === 0 ? { x: 17, y: 503 } : { x: -17, y: 509 };
        }
      }
      if (ovr) {
        tx = ovr.x;
        ty = ovr.y;
      } else if (seated && this.phase === 'seated' && this.act === 'type') {
        const j = Math.sin(this.typeJ * 17 + i * 2) * Math.sin(this.typeJ * 3.1) * 1.6;
        const p = this.toFig(i === 0 ? -14 : 14, 541 + j);
        tx = p.x;
        ty = p.y;
      } else if (seated) {
        const p = this.toFig(i === 0 ? -15 : 15, 538);
        tx = p.x;
        ty = p.y;
      }
      h.sp.step(dt, tx, ty);
      const r = ik2(sh[0], sh[1], h.sp.x, h.sp.y, BONE.arm1, BONE.arm2, i === 0 ? 1 : -1);
      limb.bend(sh[0], sh[1], r.ex, r.ey, r.hx, r.hy, BONE.cap);
      limb.end.position.set(r.hx, r.hy);
      limb.end.rotation = (r.a2 - Math.PI / 2) * 0.28;
      if (i === 1 && this.cupState === 'hand') {
        this.cup.position.set(r.hx + 1, r.hy - 3);
        const tilt = this.sipping > 0 ? -0.55 : -0.06;
        this.cup.rotation = damp(this.cup.rotation, tilt, 9, dt);
      }
    }
    void this.cheerT;
  }

  /** Лицо: мигание, закрытые глаза при глотке. */
  private faceLife(dt: number, seated: boolean): void {
    if (this.blinking > 0) {
      this.blinking -= dt;
      if (this.blinking <= 0) this.setHead();
    } else {
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blinkT = 2.2 + vr() * 3.5;
        if (this.mood === 'neutral' || this.mood === 'wait' || seated) {
          this.blinking = 0.12;
          this.setHead();
        }
      }
    }
    const shut = this.sipping > 0;
    if (shut !== this.eyesShut) {
      this.eyesShut = shut;
      this.setHead();
    }
  }

  /** Чашка: появление, пар. */
  private cupLife(dt: number): void {
    if (this.cupState === 'none') return;
    const k = this.cupScale.step(dt, 1);
    this.cup.scale.set(clamp(k, 0.3, 1.25) * this.cupK);
    this.steamT += dt;
    if (this.steamT > 0.2 && this.o.steam && this.alive) {
      this.steamT = 0;
      const g = this.cup.getGlobalPosition();
      this.o.steam(g.x + (vr() - 0.5) * 6, g.y - 12);
    }
  }

  /** Руки переезжают на слой поверх стола, когда гость сел, и обратно после подъёма — когда кисти над краем стола. */
  private armsLayer(seated: boolean): void {
    void seated;
    const seat = this.o.seat;
    if (!seat) return;
    if (this.wantFront && !this.armsFront) {
      const hy = Math.max(this.hands[0]?.sp.y ?? 0, this.hands[1]?.sp.y ?? 0);
      if (this.hands.every((h) => this.fromFig(h.sp.x, h.sp.y).y < 514) || (this.phase === 'seated' && hy < 600)) {
        seat.front.addChild(this.holder);
        this.holder.addChild(this.front.root);
        this.holder.addChild(this.cupHolder);
        this.armsFront = true;
      }
    } else if (!this.wantFront && this.armsFront) {
      if (this.hands.every((h) => this.fromFig(h.sp.x, h.sp.y).y < 514)) {
        this.holder.parent?.removeChild(this.holder);
        this.inner.addChildAt(this.front.root, 1);
        this.inner.addChildAt(this.cupHolder, 2);
        this.armsFront = false;
      }
    }
    if (this.armsFront) {
      this.holder.position.set(this.root.x, this.root.y);
      this.holder.rotation = this.root.rotation;
    }
  }

  private shake_(dt: number): void {
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const u = 1 - this.shakeT / 0.4;
      const ks = [0, -9, 8, -6, 4, 0];
      const i = Math.min(4, Math.floor(u * 5));
      const f = u * 5 - i;
      this.inner.x = (ks[i] as number) + ((ks[i + 1] as number) - (ks[i] as number)) * f;
    } else this.inner.x = 0;
  }

  private bubbleLife(dt: number): void {
    const tgt = this.bubbleOn ? 1 : 0;
    this.bubbleK += (tgt - this.bubbleK) * (1 - Math.exp(-dt * (tgt ? 14 : 20)));
    if (Math.abs(tgt - this.bubbleK) < 0.004) this.bubbleK = tgt;
    this.bubble.visible = this.bubbleK > 0.01;
    if (this.bubble.visible) {
      const u = this.bubbleK;
      const s = tgt ? 0.2 + 0.8 * u + Math.sin(u * Math.PI) * 0.12 : u;
      this.bubble.scale.set((s * BUBBLE_SCALE) / this.k);
      this.bubble.alpha = Math.min(1, u * 3);
    }
  }

  private buildBubble(): void {
    const o = this.o;
    const b = this.bubble;
    b.pivot.set(0, 387);
    b.position.set(0, this.headTop - 4); /* хвостик на 4 px выше макушки у всех причёсок */
    b.visible = false;
    /* теги: «крепкий», сироп */
    const ws = o.tags.map((t) => t.text.length * 7 + 16);
    const total = ws.reduce((x, y) => x + y, 0) + 6 * Math.max(0, o.tags.length - 1);
    let tx = -total / 2;
    b.addChild(this.tagsC);
    o.tags.forEach((t, i) => {
      const w = ws[i] as number;
      const g = new Graphics().roundRect(tx, 296, w, 18, 9).fill(t.color).stroke({ width: 2, color: INK });
      const tt = new Text({ text: t.text, style: { fontFamily: 'Nunito, system-ui, sans-serif', fontSize: 11, fontWeight: '800', fill: '#FFF8EC' }, resolution: o.res });
      tt.anchor.set(0.5, 0.5);
      tt.position.set(tx + w / 2, 305.5);
      this.tagsC.addChild(g, tt);
      tx += w + 6;
    });
    const card = new Graphics();
    card.roundRect(-64, 318, 128, 58, 14).fill('#FFF8EC').stroke({ width: 3, color: INK, join: 'round' });
    card.poly([-9, 375, 0, 387, 9, 375]).fill('#FFF8EC');
    card.moveTo(-9, 376).lineTo(0, 387).lineTo(9, 376).stroke({ width: 3, color: INK, join: 'round', cap: 'round' });
    card.roundRect(-16, 330, 52, 10, 5).fill('#E7D6BC').stroke({ width: 2, color: INK });
    b.addChild(card, this.barG);
    this.setPatience(1);
    const name = new Text({ text: o.title, style: { fontFamily: 'Nunito, system-ui, sans-serif', fontSize: 12, fontWeight: '800', fill: '#4A2F25' }, resolution: o.res });
    name.anchor.set(0.5, 0.5);
    name.position.set(10, 357.5);
    if (name.width > 100) name.scale.set(100 / name.width);
    b.addChild(name);
    const ic = new Sprite();
    ic.anchor.set(0.5);
    ic.position.set(-41, 347);
    b.addChild(ic);
    let p = iconCache.get(o.iconKey);
    if (!p) {
      p = raster(`<g stroke="#4A2F25" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${o.icon}</g>`, { x: -30, y: -30, w: 60, h: 60 }, 2);
      iconCache.set(o.iconKey, p);
    }
    void p.then((t) => {
      if (!this.alive) return;
      ic.texture = t;
      ic.width = ic.height = 60 * (o.iconK ?? 1);
    });
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.holder.parent?.removeChild(this.holder);
    this.holder.destroy({ children: true });
    this.root.destroy({ children: true });
    this.tex.forEach((t) => t.destroy(true));
    this.tex.length = 0;
    this.atlas?.tex.destroy(true);
    this.atlas = null;
  }
}

