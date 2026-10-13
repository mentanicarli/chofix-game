/**
 * Рисованные персонажи: гости собираются из частей, бариста и мимика.
 * Здесь только SVG-разметка (векторный исходник); в игру части попадают как текстуры (см. rig.ts).
 */
export const INK = '#4A2F25';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

const P = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a: string, b: string, t: number): string => {
  const x = P(a);
  const y = P(b);
  return '#' + [0, 1, 2].map((i) => Math.round((x[i] as number) + ((y[i] as number) - (x[i] as number)) * t).toString(16).padStart(2, '0')).join('');
};
const dk = (h: string, t = 0.22) => mix(h, '#3A1F18', t);
const lt = (h: string, t = 0.3) => mix(h, '#FFF4E0', t);
export const SKIN = ['#F5D0AE', '#EBC09A', '#D9A67E', '#B98160', '#A26C49'];
const HAIR = ['#3A2A22', '#7A3E2B', '#C99028', '#2E2E3A', '#A55B3A', '#CFC4B4'];
const CLOTH = ['#C4694A', '#93A684', '#E8B04A', '#7FA3A8', '#8A5A6E', '#D98C5F', '#5F7A8A', '#B85C3F'];
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)] as T;

const arm = (d: string, c: string, w = 11) =>
  `<path d="${d}" stroke="${INK}" stroke-width="${w + 6}" fill="none"/><path d="${d}" stroke="${c}" stroke-width="${w}" fill="none"/>`;

export type MoodId = 'neutral' | 'happy' | 'joy' | 'wait' | 'annoyed' | 'angry';
interface MoodDef { m: string; b: string; h: boolean; f?: string }
/** Настроения: рот, брови, закрытые глаза. blink — моргание на нейтральном лице. */
const MOOD: Readonly<Record<MoodId, MoodDef>> = {
  neutral: { m: 'M-6 450q6 3 12 0', b: '', h: false },
  happy: { m: 'M-8 447q8 9 16 0', b: '', h: false },
  joy: { m: 'M-10 446q10 14 20 0Z', b: '', h: true, f: '#8A3F34' },
  wait: { m: 'M-5 451h10', b: 'M-15 427q5 -3 10 0M5 427q5 -3 10 0', h: false },
  annoyed: { m: 'M-7 454q7 -5 14 0', b: 'M-16 426L-5 430M16 426L5 430', h: false },
  angry: { m: 'M-8 456q8 -8 16 0', b: 'M-17 423L-4 430M17 423L4 430', h: false }
};

function hair(style: string, h: string, bc: string): { b: string; f: string } {
  const top = `<path d="M-28 430Q-31 398 0 397Q31 398 28 430Q16 413 0 415Q-16 413 -28 430Z" fill="${h}"/>`;
  switch (style) {
    case 'bun': return { b: '', f: top + `<circle cx="0" cy="391" r="12" fill="${h}"/><path d="M-6 389q6 -5 12 0" fill="none" stroke="${lt(h, 0.35)}" stroke-width="2.5"/>` };
    case 'pony': return { b: `<path d="M18 408Q54 410 46 462Q38 444 24 436Z" fill="${h}"/>`, f: top };
    case 'long': return { b: `<path d="M-30 432Q-35 402 0 398Q35 402 30 432L35 482Q22 490 18 472L-18 472Q-22 490 -35 482Z" fill="${h}"/>`, f: `<path d="M-28 430Q-31 398 0 397Q31 398 28 430Q10 410 -9 419Q-21 421 -28 430Z" fill="${h}"/>` };
    case 'bob': return { b: `<path d="M-31 440Q-36 400 0 397Q36 400 31 440L31 456Q18 460 16 446L-16 446Q-18 460 -31 456Z" fill="${h}"/>`, f: `<path d="M-28 430Q-31 398 0 397Q31 398 28 430Q8 412 -10 420Q-20 422 -28 430Z" fill="${h}"/>` };
    case 'curly': return { b: '', f: [[-22, 414], [-12, 402], [0, 398], [12, 402], [22, 414], [-27, 428], [27, 428]].map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="11" fill="${h}"/>`).join('') };
    case 'beanie': return { b: '', f: `<path d="M-29 427Q-30 392 0 390Q30 392 29 427Z" fill="${bc}"/><rect x="-30" y="420" width="60" height="12" rx="6" fill="${lt(bc, 0.35)}"/><path d="M-20 424v6M-10 424v6M0 424v6M10 424v6M20 424v6" stroke="${dk(bc, 0.2)}" stroke-width="2"/><circle cx="0" cy="388" r="8" fill="${lt(bc, 0.5)}"/>` };
    case 'grey': return { b: '', f: `<path d="M-28 434Q-30 410 -20 404Q-26 420 -22 438Z" fill="${h}"/><path d="M28 434Q30 410 20 404Q26 420 22 438Z" fill="${h}"/><path d="M-20 404Q0 396 20 404Q0 408 -20 404Z" fill="${h}"/>` };
    default: return { b: '', f: top };
  }
}

function outfit(kind: string, c: string, w: number): { back: string; torso: string } {
  const cd = dk(c, 0.25);
  const cl = lt(c, 0.3);
  const torso = `M${-30 * w} 572Q${-34 * w} 464 0 458Q${34 * w} 464 ${30 * w} 572Q0 582 ${-30 * w} 572Z`;
  const coatTorso = `M${-32 * w} 588Q${-36 * w} 466 0 458Q${36 * w} 466 ${32 * w} 588Q0 598 ${-32 * w} 588Z`;
  const shadeR = `<path d="M${30 * w} 570Q${34 * w} 466 0 458Q${24 * w} 470 ${20 * w} 574Z" fill="${cd}" fill-opacity=".38" stroke="none"/>`;
  switch (kind) {
    case 'hoodie': return { back: `<ellipse cx="0" cy="464" rx="26" ry="11" fill="${cd}"/>`, torso: `<path d="${torso}" fill="${c}"/>${shadeR}<path d="M${-18 * w} 538Q0 548 ${18 * w} 538L${21 * w} 562Q0 570 ${-21 * w} 562Z" fill="${cd}" stroke-width="2.5"/><path d="M-6 470v18M6 470v18" stroke-width="2.5" fill="none"/>` };
    case 'coat': return { back: '', torso: `<path d="${coatTorso}" fill="${c}"/>${shadeR}<path d="M-14 460L0 494L14 460Z" fill="#FBF4E8" stroke-width="2.5"/><path d="M-14 460L-7 504M14 460L7 504" fill="none" stroke-width="2.5"/><circle cx="0" cy="522" r="2.6" fill="${INK}" stroke="none"/><circle cx="0" cy="548" r="2.6" fill="${INK}" stroke="none"/>` };
    case 'sweater': return { back: '', torso: `<path d="${torso}" fill="${c}"/>${shadeR}<path d="M${-29 * w} 520Q0 530 ${29 * w} 520" fill="none" stroke="${cl}" stroke-width="9" stroke-linecap="butt"/><path d="M${-30 * w} 544Q0 554 ${30 * w} 544" fill="none" stroke="${cl}" stroke-width="9" stroke-linecap="butt"/><path d="M-14 461Q0 476 14 461" fill="none" stroke-width="3"/>` };
    case 'jacket': return { back: '', torso: `<path d="${torso}" fill="${c}"/>${shadeR}<path d="M-15 460L-9 474L0 466L9 474L15 460" fill="${cd}" stroke-width="2.5"/><path d="M0 466V574" fill="none" stroke-width="2.5"/><path d="M${-30 * w} 566Q0 576 ${30 * w} 566" fill="none" stroke="${cd}" stroke-width="8" stroke-linecap="butt"/>` };
    default: return { back: '', torso: `<path d="${torso}" fill="${c}"/>${shadeR}<path d="M-10 460L10 460L0 494Z" fill="#FBF4E8" stroke-width="2.5"/><path d="M-3 470H3L5 496L0 503L-5 496Z" fill="#C4694A" stroke-width="2.5"/>` };
  }
}

export interface Look {
  skin: string;
  hair: string;
  hairCol: string;
  outfit: string;
  cloth: string;
  hat?: string;
  pants?: string;
  shoe?: string;
  acc?: string;
  item?: string;
  build?: string;
  mustache?: boolean;
}

export const LOOKS: Readonly<Record<string, () => Look>> = {
  regular: () => ({ skin: pick(SKIN), hair: pick(['grey', 'short', 'bob', 'bun', 'curly']), hairCol: pick(HAIR), outfit: pick(['coat', 'sweater', 'jacket']), cloth: pick(CLOTH), pants: pick(['#5C4A3E', '#4F4A5A', '#3E4A55']), acc: pick(['glasses', 'scarf', 'none', 'glasses']), item: pick(['tote', 'none']), build: pick(['slim', 'mid', 'round']), mustache: Math.random() < 0.15 }),
  student: () => ({ skin: pick(SKIN), hair: pick(['beanie', 'long', 'pony', 'curly', 'bun']), hairCol: pick(HAIR), outfit: 'hoodie', cloth: pick(CLOTH), hat: pick(CLOTH), pants: pick(['#4F4A5A', '#6A5B4E', '#3E4A55']), shoe: '#FBF4E8', acc: pick(['backpack', 'phones', 'backpack']), item: 'none', build: pick(['slim', 'mid']) }),
  hurry: () => ({ skin: pick(SKIN), hair: pick(['short', 'bob', 'pony']), hairCol: pick(HAIR), outfit: 'suit', cloth: pick(['#4A5568', '#5A4A5E', '#3F5A58', '#6B4A44']), pants: '#3A3440', acc: 'none', item: pick(['briefcase', 'phone']), build: pick(['slim', 'mid']) })
};
export const lookFor = (type: string): Look => (LOOKS[type] ?? LOOKS['regular'])!();

/** Клетка атласа: кусок разметки в собственных координатах, рамка box — что из него попадёт в текстуру. */
export interface PartCell { id: string; box: Box; svg: string }

/** Части фигуры. Туловище и голова нарисованы в координатах фигуры (центр x=0, ноги на y=600),
 *  руки и ноги — «лентами»: прямая заготовка вдоль оси x, которую игра изгибает по суставам. */
export interface PersonParts {
  /** Клетки общего атласа гостя. */
  cells: PartCell[];
  /** Дополнительные клетки для сидящего за столиком (ступня анфас). */
  seatCells: PartCell[];
  head: (mood: MoodId, blink?: boolean, gaze?: Gaze) => string;
  /** Тип задних волос, которые качаются отдельно: хвост, длинные, каре. */
  hairBack: 'pony' | 'long' | 'bob' | null;
  skin: string;
}
export interface Gaze { x: number; y: number }

/** Длины костей, общие для рисунка и для расчёта поз (координаты фигуры). */
export const BONE = { arm1: 28, arm2: 29, leg1: 17, leg2: 17, cap: 8.5 } as const;
/** Плечи и бёдра в координатах фигуры. */
export const JOINT = { shL: [-24, 482], shR: [24, 482], hipL: [-11, 566], hipR: [11, 566], neck: [0, 458], waist: [0, 570] } as const;
/** Размеры заготовок лент (в собственных координатах клетки). */
export const ARM_LEN = 9 + BONE.arm1 + BONE.arm2 + 10;
export const LEG_LEN = 9 + BONE.leg1 + BONE.leg2 + 9;

export function personParts(o: Look, seat = false): PersonParts {
  const w = o.build === 'round' ? 1.12 : o.build === 'slim' ? 0.93 : 1;
  const sk = o.skin;
  const skd = dk(sk, 0.2);
  const ou = outfit(o.outfit, o.cloth, w);
  const hr = hair(o.hair, o.hairCol, o.hat ?? o.cloth);
  const slv = o.outfit === 'suit' ? dk(o.cloth, 0.1) : o.cloth;
  const pants = o.pants ?? '#4F4A5A';
  const shoe = o.shoe ?? '#2F211B';
  const item = seat ? 'none' : o.item;
  const back = o.acc === 'backpack' ? `<rect x="-46" y="468" width="38" height="78" rx="14" fill="${dk(o.cloth, 0.12)}"/><rect x="-42" y="520" width="20" height="18" rx="6" fill="${lt(o.cloth, 0.15)}" stroke-width="2.5"/>` : '';
  /* то, что человек держит в руке: рисуется вокруг кисти (0,0) */
  const caseL =
    item === 'briefcase' ? `<rect x="-17" y="8" width="34" height="26" rx="5" fill="#C98B5A"/><path d="M-8 8q8 -13 16 0" fill="none" stroke-width="2.5"/><path d="M-17 20h34" stroke-width="2" fill="none"/>`
    : item === 'tote' ? `<rect x="-15" y="8" width="30" height="28" rx="6" fill="#E7D3AE"/><path d="M-9 8q9 -15 18 0" fill="none" stroke-width="2.5"/><circle cx="0" cy="22" r="5" fill="${lt(o.cloth, 0.1)}" stroke-width="2"/>`
    : '';
  const phoneR = item === 'phone' ? `<rect x="-7" y="-17" width="13" height="22" rx="3.5" fill="#2F2B3A"/><rect x="-5" y="-14" width="9" height="14" rx="2" fill="#9FC3C7" stroke="none"/>` : '';
  const hand = (extra: string) => `${extra}<circle cx="0" cy="0" r="8.5" fill="${sk}"/>`;
  const dark = o.skin === SKIN[4] || o.skin === SKIN[3];
  const cheeks = `<ellipse cx="-19" cy="446" rx="5.5" ry="3.2" fill="#E3806C" fill-opacity="${dark ? 0.35 : 0.6}" stroke="none"/><ellipse cx="19" cy="446" rx="5.5" ry="3.2" fill="#E3806C" fill-opacity="${dark ? 0.35 : 0.6}" stroke="none"/>`;
  const stache = o.mustache ? `<path d="M-11 446Q-5 440 0 444Q5 440 11 446Q5 451 0 447Q-5 451 -11 446Z" fill="${o.hairCol}" stroke-width="2"/>` : '';
  const eye = (cx: number, hl: number, g: Gaze) => `<g><ellipse cx="${cx}" cy="437" rx="4.7" ry="5" fill="#FFFDF6" stroke-width="1.8"/><circle cx="${cx + 0.4 + g.x}" cy="${438 + g.y}" r="2.8" fill="#2F211B" stroke="none"/><circle cx="${hl + g.x}" cy="${436.6 + g.y}" r="1" fill="#fff" stroke="none"/></g>`;
  const glasses = o.acc === 'glasses' ? `<circle cx="-11" cy="437" r="8" fill="#fff" fill-opacity=".28" stroke-width="2.5"/><circle cx="11" cy="437" r="8" fill="#fff" fill-opacity=".28" stroke-width="2.5"/><path d="M-3 436H3M-19 435L-28 432M19 435L28 432" stroke-width="2.5" fill="none"/>` : '';
  const scarf = o.acc === 'scarf' ? `<path d="M-24 464Q0 480 24 464L26 478Q0 494 -26 478Z" fill="${lt('#C4694A', 0.05)}" stroke-width="2.8"/><path d="M14 478L20 512L30 508L24 476Z" fill="${lt('#C4694A', 0.05)}" stroke-width="2.8"/><path d="M-12 474v8M0 478v8M12 476v8" stroke="${lt('#C4694A', 0.45)}" stroke-width="2" fill="none"/>` : '';
  const phones = o.acc === 'phones' ? `<path d="M-27 428Q-28 396 0 394Q28 396 27 428" fill="none" stroke-width="5"/><rect x="-35" y="422" width="12" height="22" rx="6" fill="#4A6B72"/><rect x="23" y="422" width="12" height="22" rx="6" fill="#4A6B72"/>` : '';
  const ears = `<circle cx="-27" cy="438" r="5.5" fill="${sk}"/><circle cx="27" cy="438" r="5.5" fill="${sk}"/>`;
  const head = (mood: MoodId, blink = false, gaze: Gaze = { x: 0, y: 0 }): string => {
    const m = MOOD[mood];
    const eyes = m.h || blink ? `<path d="M-15 438q5 -7 10 0M5 438q5 -7 10 0" fill="none" stroke-width="2.6"/>` : `${eye(-10, -8.5, gaze)}${eye(10, 11.5, gaze)}`;
    const face = `${eyes}<path d="${m.b}" fill="none" stroke-width="2.5"/><path d="${m.m}" fill="${m.f ?? 'none'}" stroke-width="2.5"/>${cheeks}${stache}`;
    return `<g transform="translate(0 458) scale(1.1) translate(0 -458)">${ears}<circle cx="0" cy="432" r="28" fill="${sk}"/><path d="M14 408Q34 424 20 452Q28 432 14 408Z" fill="${skd}" fill-opacity=".35" stroke="none"/><path d="M-26 424Q-24 414 -18 410" fill="none" stroke="${lt(sk, 0.5)}" stroke-width="3" stroke-opacity=".7"/>${face}${glasses}${hr.f}${phones}</g>`;
  };
  const rope = (len: number, c: string): string => arm(`M9 0H${len - 9}`, c, 11);
  const cells: PartCell[] = [
    { id: 'armRope', box: { x: 0, y: -12, w: ARM_LEN, h: 24 }, svg: rope(ARM_LEN, slv) },
    { id: 'legRope', box: { x: 0, y: -12, w: LEG_LEN, h: 24 }, svg: rope(LEG_LEN, pants) },
    { id: 'shoe', box: { x: -18, y: -11, w: 36, h: 22 }, svg: `<ellipse cx="0" cy="0" rx="14" ry="6.5" fill="${shoe}"/><path d="M-6 -3Q0 -5 6 -3" stroke="${lt(shoe, 0.35)}" stroke-width="2" fill="none" stroke-opacity=".7"/>` },
    { id: 'handL', box: { x: -24, y: -16, w: 48, h: 56 }, svg: hand(caseL) },
    { id: 'handR', box: { x: -24, y: -22, w: 48, h: 50 }, svg: hand(phoneR) },
    { id: 'torso', box: { x: -54, y: 452, w: 108, h: 150 }, svg: `${back}${ou.back}${ou.torso}${scarf}` }
  ];
  const seatCells: PartCell[] = seat
    ? [{ id: 'shoeSeat', box: { x: -18, y: -13, w: 36, h: 26 }, svg: `<ellipse cx="0" cy="0" rx="14" ry="8.5" fill="${shoe}"/><ellipse cx="0" cy="2.5" rx="8.5" ry="4.6" fill="${lt(shoe, 0.22)}" stroke-width="2"/>` }]
    : [];
  const hb = hr.b ? (o.hair === 'pony' ? 'pony' : o.hair === 'long' ? 'long' : 'bob') : null;
  if (hb) cells.push({ id: 'hairBack', box: { x: -48, y: 392, w: 114, h: 110 }, svg: `<g transform="translate(0 458) scale(1.1) translate(0 -458)">${hr.b}</g>` });
  return { cells, seatCells, head, hairBack: hb, skin: sk };
}

/** Оборачивает часть в самостоятельный SVG: общая рамка для всех частей фигуры.
 *  Дрожание линий (как у остальной графики) считается в координатах фигуры, поэтому швов между частями нет. */
export const PERSON_BOX = { x: -80, y: 356, w: 160, h: 264 } as const;
export const HEAD_BOX = { x: -46, y: 362, w: 92, h: 114 } as const;
export interface Box { x: number; y: number; w: number; h: number }
export function wobbleDef(b: Box, id = 'wbx'): string {
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.04" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>`;
}
export function wrapPart(inner: string, b: Box = PERSON_BOX): string {
  return `<defs>${wobbleDef(b)}</defs><g filter="url(#wbx)"><g ${S}>${inner}</g></g>`;
}


/** Бариста за стойкой: координаты сцены, голова в (865,322), плечо левой руки (834,376). */
export type BaristaFace = 'smile' | 'blink' | 'joy' | 'focus';
export interface BaristaParts { body: string; arm2: string; arm: string; head: (f: BaristaFace) => string; heldCup: string }
export function baristaParts(): BaristaParts {
  const sk = '#F5D0AE';
  const skd = dk(sk, 0.2);
  const hr = '#3A2A22';
  return {
    body: `<path d="M824 414Q824 370 865 364Q906 370 906 414Z" fill="#93A684"/>
<path d="M906 414Q906 374 874 365Q894 382 890 414Z" fill="#6E8262" fill-opacity=".45" stroke="none"/>
<rect x="853" y="342" width="24" height="28" rx="9" fill="${sk}"/>
<path d="M842 414L847 382Q865 374 883 382L888 414Z" fill="#8A5240"/>
<path d="M848 380L852 364M882 380L878 364" fill="none" stroke-width="2.5"/>
<rect x="855" y="396" width="20" height="14" rx="3.5" fill="#6A3E2E" stroke-width="2.5"/>`,
    arm2: `${arm('M894 379Q918 384 938 386', '#93A684', 12)}<circle cx="942" cy="386" r="8.5" fill="${sk}"/>`,
    arm: `${arm('M836 379Q818 381 808 386', '#93A684', 12)}<circle cx="805" cy="386" r="8.5" fill="${sk}"/>`,
    heldCup: '',
    head: (f: BaristaFace) => {
      const eye = (cx: number, hl: number) => f === 'blink' || f === 'joy'
        ? `<path d="M${cx - 5} 328q5 -6 10 0" fill="none" stroke-width="2.4"/>`
        : `<g><ellipse cx="${cx}" cy="327" rx="4.8" ry="${f === 'focus' ? 4.2 : 5.2}" fill="#FFFDF6" stroke-width="1.8"/><circle cx="${cx + 0.4}" cy="328" r="3" fill="#2F211B" stroke="none"/><circle cx="${hl}" cy="326.6" r="1" fill="#fff" stroke="none"/></g>`;
      const mouth = f === 'joy' ? '<path d="M855 335q10 13 20 0Z" fill="#8A3F34" stroke-width="2.4"/>' : f === 'focus' ? '<path d="M860 339q5 3 10 0" stroke-width="2.6" fill="none"/>' : '<path d="M857 337q8 9 16 0" stroke-width="2.6" fill="none"/>';
      const brows = f === 'focus' ? '<path d="M848 320L860 322M870 322L882 320" stroke-width="2.2" fill="none"/>' : '<path d="M848 319q6 -4 12 -1M870 318q6 -3 12 1" stroke-width="2.2" fill="none"/>';
      return `<circle cx="865" cy="290" r="13" fill="${hr}"/><path d="M859 288q6 -5 12 0" fill="none" stroke="#6A5348" stroke-width="2.5"/>
<circle cx="835" cy="326" r="5.5" fill="${sk}"/><circle cx="895" cy="326" r="5.5" fill="${sk}"/>
<circle cx="865" cy="322" r="29" fill="${sk}"/>
<path d="M880 296Q898 314 886 346Q892 322 880 296Z" fill="${skd}" fill-opacity=".35" stroke="none"/>
<path d="M834 318Q832 290 865 289Q898 290 896 318Q880 302 865 304Q850 302 834 318Z" fill="${hr}"/>
<path d="M835 312Q865 299 895 312" stroke="#C4694A" stroke-width="7" fill="none"/>
${eye(854, 855.5)}${eye(876, 877.5)}${brows}${mouth}
<ellipse cx="845" cy="336" rx="5.5" ry="3.2" fill="#E3806C" fill-opacity=".6" stroke="none"/><ellipse cx="885" cy="336" rx="5.5" ry="3.2" fill="#E3806C" fill-opacity=".6" stroke="none"/>`;
    }
  };
}

/** Обёртка клетки атласа: свой фильтр дрожания линий на рамку клетки. */
export function wrapCell(inner: string, b: Box, id: string): string {
  return `<defs>${wobbleDef(b, id)}</defs><g filter="url(#${id})"><g ${S}>${inner}</g></g>`;
}
