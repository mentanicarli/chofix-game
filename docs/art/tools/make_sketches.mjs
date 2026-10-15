// Генератор эскизов направлений стиля (документация, не игровой код). node docs/art/tools/make_sketches.mjs
import fs from 'node:fs';
const OUT = 'docs/art/sketches/';
const st = (ink, w) => (ink ? `stroke="${ink}" stroke-width="${w}"` : 'stroke="none"');
const sw = (cols) =>
  cols
    .map(
      (c, i) =>
        `<g transform="translate(${40 + i * 92} 352)"><circle r="22" fill="${c}" stroke="#4A2F25" stroke-width="2"/><text y="42" text-anchor="middle" font-family="Nunito,sans-serif" font-size="11" font-weight="700" fill="#4A2F25">${c}</text></g>`
    )
    .join('');
const head = (t, sub, bg, wob, grain) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400"><title>${t}</title>
<defs>
<filter id="w" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${wob}" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .29  0 0 0 0 .18  0 0 0 0 .15  0 0 0 .5 -.18"/></filter>
<linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E0846A"/><stop offset="1" stop-color="#B4553B"/></linearGradient>
</defs>
<rect width="640" height="400" fill="${bg}"/>
<text x="24" y="34" font-family="Caveat,cursive" font-size="26" font-weight="700" fill="#4A2F25">${t}</text>
<text x="24" y="54" font-family="Nunito,sans-serif" font-size="12" font-weight="700" fill="#7A5A4A">${sub}</text>`;
const tail = (grain) => (grain ? `<rect width="640" height="400" filter="url(#g)" opacity="${grain}" pointer-events="none"/>` : '') + '</svg>';
const guest = (o) => {
  const s = st(o.ink, o.w);
  return `<g transform="translate(520 110)" ${o.wob ? 'filter="url(#w)"' : ''} stroke-linejoin="round" stroke-linecap="round">
<ellipse cx="0" cy="214" rx="86" ry="10" fill="#4A2F25" fill-opacity=".16" stroke="none"/>
<path d="M-70 210Q-72 120 0 112Q72 120 70 210Z" fill="${o.cloth}" ${s}/>
<path d="M20 118Q72 128 70 210L40 210Q46 150 20 118Z" fill="${o.clothSh}" stroke="none"/>
<path d="M-52 150Q-44 126 -20 120" fill="none" stroke="${o.clothHi}" stroke-width="5"/>
<rect x="-12" y="96" width="24" height="24" rx="8" fill="${o.skin}" ${s}/>
<circle cy="52" r="50" fill="${o.skin}" ${s}/>
<path d="M14 14Q54 30 46 72Q36 60 24 56Q30 36 14 14Z" fill="${o.skinSh}" stroke="none"/>
<path d="M-48 46Q-52 2 0 0Q52 2 48 46Q30 22 0 24Q-30 22 -48 46Z" fill="${o.hair}" ${s}/>
<circle cx="-17" cy="56" r="4.5" fill="#3A1F18" stroke="none"/><circle cx="17" cy="56" r="4.5" fill="#3A1F18" stroke="none"/>
<path d="M-10 74Q0 82 10 74" fill="none" stroke="#3A1F18" stroke-width="3"/>
<circle cx="-30" cy="68" r="7" fill="#E8957A" fill-opacity=".55" stroke="none"/><circle cx="30" cy="68" r="7" fill="#E8957A" fill-opacity=".55" stroke="none"/></g>`;
};
const mug = (o) => {
  const s = st(o.ink, o.w);
  const handle = 'M64 88Q104 88 100 120Q96 146 58 142';
  return `<g transform="translate(150 130)" ${o.wob ? 'filter="url(#w)"' : ''} stroke-linejoin="round" stroke-linecap="round">
<ellipse cx="10" cy="176" rx="96" ry="14" fill="#4A2F25" fill-opacity=".16" stroke="none"/>
<path d="${handle}" fill="none" ${o.ink ? `stroke="${o.ink}" stroke-width="${o.w + 8}"` : `stroke="${o.sh}" stroke-width="11"`}/>
${o.ink ? `<path d="${handle}" fill="none" stroke="${o.handle ?? o.sh}" stroke-width="8"/>` : ''}
<path d="M-44 70H64L56 154Q10 170 -36 154Z" fill="${o.body}" ${s}/>
<path d="M40 74H64L56 154Q46 158 36 160Z" fill="${o.sh}" stroke="none"/>
<path d="M-36 84L-32 140" stroke="${o.hi}" stroke-width="6" fill="none"/>
<ellipse cx="10" cy="70" rx="54" ry="11" fill="${o.coffee}" ${s}/>
<path d="M-8 56Q-18 40 -6 26Q4 12 -6 0M20 56Q10 40 22 26Q32 12 22 0" fill="none" stroke="#C9B8A0" stroke-width="4"/></g>`;
};
const lines = (c, w, note) => `<g stroke="${c}" stroke-linecap="round" fill="none"><path d="M250 300H290" stroke-width="${w[0]}"/><path d="M310 300H350" stroke-width="${w[1]}"/><path d="M370 300H410" stroke-width="${w[2]}"/></g><text x="250" y="322" font-family="Nunito,sans-serif" font-size="11" font-weight="700" fill="#4A2F25">${note}</text>`;
const write = (name, body) => fs.writeFileSync(OUT + name, body);

write(
  'direction-a-ink-paper.svg',
  head('A. Рисованный контур и бумага', 'Развитие зала: контур #4A2F25, дрожание, два тона тени, зерно', '#FFF8EC', 5) +
    mug({ ink: '#4A2F25', w: 3, body: '#F6E7CF', sh: '#E3CBA6', hi: '#FFFDF6', coffee: '#8A5B3A', handle: '#F6E7CF', wob: 1 }) +
    guest({ ink: '#4A2F25', w: 3, skin: '#F0C9A4', skinSh: '#DDA982', hair: '#7A3E2B', cloth: '#C4694A', clothSh: '#A9553A', clothHi: '#E39477', wob: 1 }) +
    lines('#4A2F25', [4, 3, 2], 'линия 4 / 3 / 2 px, контур #4A2F25') +
    sw(['#FFF8EC', '#4A2F25', '#C4694A', '#F0BC55', '#93A684', '#7FA3A8']) +
    tail(0.5)
);
write(
  'direction-b-flat-clean.svg',
  head('B. Чистая плоскость без контура', 'Формы без обводки, три тона на предмет, чёткие края, зерна нет', '#FFF1DC', 0) +
    mug({ ink: null, w: 0, body: '#E6B25A', sh: '#C88F3D', hi: '#F8D58E', coffee: '#6B3F2A', wob: 0 }) +
    guest({ ink: null, w: 0, skin: '#F0C9A4', skinSh: '#DDA982', hair: '#4A2F25', cloth: '#7FA3A8', clothSh: '#5F8489', clothHi: '#A8C5C8', wob: 0 }) +
    lines('#4A2F25', [1.5, 1.5, 1.5], 'контур только у мелочей: 1,5 px') +
    sw(['#FFF1DC', '#4A2F25', '#E6B25A', '#7FA3A8', '#C4694A', '#93A684']) +
    tail(0)
);
write(
  'direction-c-soft-volume.svg',
  head('C. Мягкий объём и цветной контур', 'Градиент по форме, тонкая линия темнее заливки, мягкие тени, зерно', '#F7EBDD', 2) +
    mug({ ink: '#A9553A', w: 2, body: 'url(#gm)', sh: '#8F3F2A', hi: '#F2A58C', coffee: '#6B3F2A', handle: '#C4694A', wob: 1 }) +
    guest({ ink: '#9A6A58', w: 2, skin: '#F3CFAE', skinSh: '#E0AE8A', hair: '#8A4A33', cloth: '#93A684', clothSh: '#71866A', clothHi: '#C5D3B9', wob: 1 }) +
    lines('#9A6A58', [3, 2, 1.5], 'линия 3 / 2 / 1,5 px, цвет = заливка темнее') +
    sw(['#F7EBDD', '#9A6A58', '#C4694A', '#F0BC55', '#93A684', '#E8957A']) +
    tail(0.35)
);
console.log('ok');
