/**
 * Панели «станций» нового ядра: налив, таймер «держите», заварка.
 * HTML-панель в стиле игры с живой SVG-иллюстрацией; логика — в src/game/stations.
 */
import { BREW_TEMPS } from '../game/stations/brew';

const INK = '#4A2F25';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

export type PanelKind = 'fill' | 'timed' | 'brew';
export interface PanelView {
  task: string;
  kind: PanelKind;
  title: string;
  hint: string;
  /** Цвет содержимого / второй цвет (пена, топпинг). */
  col: string;
  col2: string;
  /** Шкала: максимум значения и зона цели. */
  max: number;
  zone: [number, number];
  holdLabel: string;
  brew?: { set: number | null; started: boolean; target: { temp: number; minutes: number } | null };
}

/** Что рисуется заново каждый кадр. */
export interface PanelLive {
  value: number;
  readout: string;
  holding: boolean;
  brewStarted?: boolean;
}

const GLASS = 'M140 28H260L250 172H150Z';

function glass(liq: string, extra = ''): string {
  return `<defs><clipPath id="xpClip"><path d="${GLASS}"/></clipPath></defs>
<g clip-path="url(#xpClip)"><rect id="xpLiq" x="130" y="172" width="140" height="0" fill="${liq}"/>${extra}</g>
<path d="${GLASS}" fill="#FFFFFF" fill-opacity=".28" ${S}/>
<path d="M156 40L162 150" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" fill="none"/>
<path id="xpMark" d="M144 100H256" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 5" fill="none"/>`;
}

const stream = (x1: number, y1: number, x2: number, y2: number, col: string) =>
  `<path id="xpStream" d="M${x1} ${y1}L${x2} ${y2}" stroke="${col}" stroke-width="7" stroke-linecap="round" fill="none" class="xpStream"/>`;

const dots = (col: string, xs: number[]) =>
  `<g id="xpDots" class="xpDots" fill="${col}" stroke="${INK}" stroke-width="2">${xs.map((x, i) => `<circle cx="${x}" cy="${46 + (i % 3) * 18}" r="4.5" style="animation-delay:${(i * 0.11).toFixed(2)}s"/>`).join('')}</g>`;

/** Иллюстрация к шагу. Жидкость растёт через #xpLiq (его высоту ставит xpUpdate). */
export function artFor(v: Pick<PanelView, 'task' | 'col' | 'col2'>): string {
  const { col, col2 } = v;
  switch (v.task) {
    case 'juice':
    case 'tonic': {
      const lid = v.task === 'tonic' ? '#7FB7A4' : '#F6EBDC';
      return `${glass(col)}<g class="xpTilt"><path d="M44 52L98 44L106 108L52 118Z" fill="${lid}" ${S}/><path d="M60 60L92 55" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M98 44L120 40L124 58L104 62Z" fill="${col}" ${S}/></g>${stream(118, 52, 190, 150, col)}`;
    }
    case 'powder':
      return `${glass(col)}<g class="xpTilt"><path d="M40 56H112L104 118H48Z" fill="#E7D6BC" ${S}/><path d="M40 56H112" ${S}/><ellipse cx="76" cy="56" rx="36" ry="7" fill="${col}" ${S}/></g>${dots(col, [150, 170, 190, 210, 230])}`;
    case 'boba':
      return `${glass('#E8D9BE')}<g id="xpPearls" fill="#3A2A24" stroke="none"></g><g class="xpTilt"><path d="M40 56H112L104 118H48Z" fill="#F6EBDC" ${S}/><circle cx="64" cy="94" r="7" fill="#3A2A24"/><circle cx="84" cy="100" r="7" fill="#3A2A24"/><circle cx="76" cy="84" r="7" fill="#3A2A24"/></g>${dots('#3A2A24', [150, 175, 200, 225])}`;
    case 'topping':
      return `${glass('#C9A27A')}<g class="xpTilt"><path d="M60 44H112L108 94H64Z" fill="#E7D6BC" ${S}/><rect x="56" y="36" width="60" height="12" rx="5" fill="${col}" ${S}/></g>${dots(col, [170, 190, 205, 225])}`;
    case 'whisk':
      return `<ellipse cx="200" cy="150" rx="104" ry="22" fill="#3B2418" fill-opacity=".25" stroke="none"/>
<path d="M104 100H296Q290 164 200 170Q110 164 104 100Z" fill="#F6EBDC" ${S}/>
<defs><clipPath id="xpClip"><path d="M110 104H290Q284 160 200 165Q116 160 110 104Z"/></clipPath></defs>
<g clip-path="url(#xpClip)"><rect id="xpLiq" x="100" y="165" width="200" height="0" fill="${col}"/></g>
<path id="xpMark" d="M124 140H276" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 5" fill="none"/>
<ellipse cx="200" cy="100" rx="96" ry="9" fill="none" ${S}/>
<g class="xpWhisk"><path d="M200 18V70" stroke="#C98B5A" stroke-width="9" stroke-linecap="round"/><path d="M176 112Q176 74 200 70Q224 74 224 112Q212 98 200 100Q188 98 176 112Z" fill="#E7C98B" ${S}/><path d="M190 76V106M200 74V104M210 76V106" stroke="${INK}" stroke-width="2" fill="none"/></g>`;
    case 'blend':
      return `<path d="M130 170H270V186H130Z" fill="#8FA882" ${S}/>
<defs><clipPath id="xpClip"><path d="M148 30H252L240 164H160Z"/></clipPath></defs>
<g class="xpShake"><g clip-path="url(#xpClip)"><rect id="xpLiq" x="130" y="164" width="140" height="0" fill="${col}"/><g class="xpSwirl"><path d="M150 140Q200 120 250 140M152 110Q200 90 248 110" stroke="#FFFFFF" stroke-opacity=".45" stroke-width="5" fill="none"/></g></g>
<path d="M148 30H252L240 164H160Z" fill="#FFFFFF" fill-opacity=".26" ${S}/><rect x="140" y="20" width="120" height="12" rx="5" fill="#4A3328" ${S}/><path d="M164 150H236" stroke="${INK}" stroke-width="3" class="xpBlade"/></g>
<path id="xpMark" d="M154 100H246" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 5" fill="none"/>`;
    case 'shake':
      return `<g class="xpShake"><path d="M158 56H242L252 176H148Z" fill="#C9C8C0" ${S}/><path d="M168 56L174 20H226L232 56Z" fill="#A9A9A3" ${S}/><rect x="184" y="8" width="32" height="14" rx="6" fill="#4A3328" ${S}/>
<defs><clipPath id="xpClip"><path d="M163 62H237L246 170H154Z"/></clipPath></defs><g clip-path="url(#xpClip)"><rect id="xpLiq" x="140" y="170" width="120" height="0" fill="${col}" fill-opacity=".9"/></g><path d="M170 76L176 160" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="5" stroke-linecap="round" fill="none"/></g>
<path id="xpMark" d="M156 110H244" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 5" fill="none" opacity="0"/>`;
    case 'foam':
      return `${glass('#C99B6E')}<g clip-path="url(#xpClip)"><rect id="xpFoam" x="130" y="172" width="140" height="0" fill="${col2}"/></g><g class="xpWhisk" style="transform-origin:200px 30px"><path d="M200 8V120" stroke="#C9C8C0" stroke-width="7" stroke-linecap="round"/><path d="M186 120H214" ${S}/></g>`;
    case 'whip':
      return `<ellipse cx="200" cy="176" rx="90" ry="12" fill="#3B2418" fill-opacity=".25" stroke="none"/><path d="M128 154H272L262 178H138Z" fill="#E7D6BC" ${S}/><path d="M150 154Q150 120 200 118Q250 120 250 154" fill="${col2}" ${S}/>
<g class="xpTilt"><path d="M70 40H112L108 150H74Z" fill="#C9C8C0" ${S}/><path d="M112 70H146L170 100" stroke="${INK}" stroke-width="3" fill="none"/><rect x="76" y="30" width="30" height="12" rx="4" fill="#A9A9A3" ${S}/></g>
<g clip-path="url(#xpClip)"></g><rect id="xpLiq" x="0" y="0" width="0" height="0" fill="none"/><path id="xpMark" d="M0 0" opacity="0"/><g class="xpDots" id="xpDots" fill="${col2}" stroke="${INK}" stroke-width="2"><circle cx="190" cy="104" r="6"/><circle cx="206" cy="94" r="5"/><circle cx="198" cy="82" r="4"/></g>`;
    case 'layer':
      return `${glass(col)}<g clip-path="url(#xpClip)"><rect id="xpLiq2" x="130" y="172" width="140" height="0" fill="#4A2E20"/></g><g id="xpIce" fill="#FFFFFF" fill-opacity=".6" stroke="#DCEEF1" stroke-width="2"><rect x="156" y="126" width="26" height="26" rx="5"/><rect x="190" y="118" width="26" height="26" rx="5"/><rect x="220" y="130" width="24" height="24" rx="5"/></g>
<g class="xpTilt"><path d="M44 40H100L104 78H48Z" fill="#8E4A33" ${S}/><path d="M104 56L170 74" stroke="${INK}" stroke-width="3" fill="none"/></g>${stream(172, 60, 200, 100, '#4A2E20')}`;
    case 'brew':
      return `<ellipse cx="200" cy="176" rx="104" ry="11" fill="#3B2418" fill-opacity=".25" stroke="none"/>
<path d="M130 80H270L258 160Q200 178 142 160Z" fill="#FFF8EC" ${S}/>
<path d="M270 96Q304 96 300 126Q296 152 262 148" fill="none" ${S}/>
<defs><clipPath id="xpClip"><path d="M136 86H264L254 156Q200 172 146 156Z"/></clipPath></defs>
<g clip-path="url(#xpClip)"><rect id="xpLiq" x="130" y="160" width="140" height="0" fill="${col}"/></g>
<path d="M200 86V56" stroke="${INK}" stroke-width="2.5" fill="none"/><rect x="190" y="38" width="20" height="22" rx="4" fill="#F1DFC2" ${S}/>
<path id="xpMark" d="M0 0" opacity="0"/>
<g id="xpSteamG" fill="none" stroke="#C9B79B" stroke-width="4" stroke-linecap="round" opacity="0"><path d="M168 66Q158 52 170 40"/><path d="M232 66Q222 52 234 40"/></g>`;
    default:
      return glass(col);
  }
}

const f1 = (n: number) => n.toFixed(1).replace('.', ',');

export function panelHTML(v: PanelView): string {
  const pct = (x: number) => Math.min(100, Math.max(0, (x / v.max) * 100));
  const lo = pct(v.zone[0]);
  const hi = pct(v.zone[1]);
  let controls: string;
  if (v.kind === 'brew') {
    const b = v.brew;
    const temps = BREW_TEMPS.map(
      (t) => `<button type="button" class="xpTemp${b?.set === t ? ' on' : ''}" data-xtemp="${t}"${b?.started ? ' disabled' : ''}>${t}°</button>`
    ).join('');
    controls = `<div class="xpTemps">${temps}</div>
<div class="xpBar"><i class="zone" style="left:${lo}%;width:${Math.max(2, hi - lo)}%"></i><i class="fill" id="xpFill"></i></div>
<div class="xpRead" id="xpRead"></div>
<div class="xpBtns"><button type="button" class="xpGo" data-xstart${b?.started ? ' disabled' : ''}>Залить водой</button><button type="button" class="xpDone" data-xdone>Вынуть</button></div>`;
  } else {
    controls = `<div class="xpBar"><i class="zone" style="left:${lo}%;width:${Math.max(2, hi - lo)}%"></i><i class="fill" id="xpFill"></i></div>
<div class="xpRead" id="xpRead"></div>
<div class="xpBtns"><button type="button" class="xpHold" data-xhold>${v.holdLabel}</button>${v.kind === 'fill' ? '<button type="button" class="xpDump" data-xdump>Вылить</button>' : ''}<button type="button" class="xpDone" data-xdone>Готово</button></div>`;
  }
  return `<div class="xp" data-task="${v.task}"><div class="xpHead"><b>${v.title}</b><span>${v.hint}</span></div>
<svg class="xpArt" viewBox="0 0 400 190" aria-hidden="true">${artFor(v)}</svg>${controls}</div>`;
}

/** Покадровое обновление: шкала, число, уровень жидкости, анимации. */
export function panelUpdate(root: HTMLElement, v: PanelView, l: PanelLive): void {
  const frac = Math.min(1, Math.max(0, l.value / v.max));
  const fill = root.querySelector<HTMLElement>('#xpFill');
  if (fill) fill.style.width = (frac * 100).toFixed(1) + '%';
  const rd = root.querySelector<HTMLElement>('#xpRead');
  if (rd && rd.textContent !== l.readout) rd.textContent = l.readout;
  const xp = root.querySelector<HTMLElement>('.xp');
  if (xp) { xp.classList.toggle('hold', l.holding); xp.classList.toggle('run', !!l.brewStarted); }
  const liq = root.querySelector<SVGGraphicsElement>('#xpLiq');
  if (liq && v.kind !== 'brew') {
    const isBowl = v.task === 'whisk';
    const top = isBowl ? 165 : v.task === 'blend' ? 164 : v.task === 'shake' ? 170 : 172;
    const full = isBowl ? 60 : v.task === 'blend' ? 120 : v.task === 'shake' ? 100 : 140;
    const h = Math.min(full, frac * full * (v.task === 'whisk' ? 0.8 : 1));
    liq.setAttribute('y', (top - h).toFixed(1));
    liq.setAttribute('height', h.toFixed(1));
  } else if (liq) {
    const h = Math.min(60, frac * 60);
    liq.setAttribute('y', (160 - h).toFixed(1)); liq.setAttribute('height', h.toFixed(1));
  }
  const mark = root.querySelector<SVGPathElement>('#xpMark');
  if (mark && v.kind === 'fill') {
    const tgt = (v.zone[0] + v.zone[1]) / 2 / v.max;
    const y = 172 - tgt * 140;
    mark.setAttribute('d', `M144 ${y.toFixed(1)}H256`);
  }
  const foam = root.querySelector<SVGGraphicsElement>('#xpFoam');
  if (foam) { const h = Math.min(30, frac * 30); foam.setAttribute('y', (172 - 60 - h).toFixed(1)); foam.setAttribute('height', h.toFixed(1)); }
  const liq2 = root.querySelector<SVGGraphicsElement>('#xpLiq2');
  if (liq2) { const h = Math.min(60, frac * 60); liq2.setAttribute('y', (172 - 70 - h).toFixed(1)); liq2.setAttribute('height', h.toFixed(1)); }
  const sg = root.querySelector<SVGGraphicsElement>('#xpSteamG');
  if (sg) sg.setAttribute('opacity', l.brewStarted ? '1' : '0');
}

export const readoutFill = (value: number, unit: string, target: number) => `${Math.round(value)} ${unit} · нужно ${Math.round(target)}`;
export const readoutTime = (t: number, target: number) => `${f1(t)} с · нужно ${f1(target)}`;
export const readoutBrew = (min: number, show: { temp: number; minutes: number } | null) =>
  `${f1(min)} мин` + (show ? ` · рецепт: ${show.temp}°, ${show.minutes} мин` : '');
