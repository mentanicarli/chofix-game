const path = require('path');
const F = p => 'file://' + path.resolve(__dirname, 'node_modules/@fontsource', p);
const face = (fam, w, sub, range) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(${F(fam.toLowerCase() + '/files/' + fam.toLowerCase() + '-' + sub + '-' + w + '-normal.woff2')}) format('woff2');unicode-range:${range};}`;
const R = { cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', 'latin-ext': 'U+0100-02AF,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF' };
let css = '';
for (const [fam, ws] of [['Nunito', [600, 700, 800]], ['Caveat', [600, 700]]]) for (const w of ws) for (const sub of Object.keys(R)) css += face(fam, w, sub, R[sub]);
exports.page = async (browser, vp = { width: 1312, height: 752 }) => {
  const p = await browser.newPage({ viewport: vp });
  await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
  return p;
};
exports.css = css;
