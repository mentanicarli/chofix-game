const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const stage = $('#stage'), scr = $('#screen');
const WORLD = new World(), FX = WORLD.fx;

const PRICE = { espresso: MENUAPI.priceOf('espresso_double'), americano: MENUAPI.priceOf('americano'), icedamericano: MENUAPI.priceOf('americano', '0.3'), icedlatte: MENUAPI.priceOf('latte', '0.3'), icedcappuccino: MENUAPI.priceOf('cappuccino', '0.3'), cappuccino: MENUAPI.priceOf('cappuccino'), latte: MENUAPI.priceOf('latte'), flatwhite: MENUAPI.priceOf('flat_white'), vanillaraf: MENUAPI.priceOf('vanilla_raf'), raf: MENUAPI.priceOf('raf'), rafhalva: MENUAPI.priceOf('raf_halva') };
const NAME = { espresso: 'Эспрессо', americano: 'Американо', icedamericano: 'Холодный американо', icedlatte: 'Холодный латте', icedcappuccino: 'Холодный капучино', cappuccino: 'Капучино', latte: 'Латте', flatwhite: 'Флэт уайт', vanillaraf: 'Ванильный раф', raf: 'Раф кофе', rafhalva: 'Раф сливочная халва' };
MENUAPI.DRINKS.forEach(d => { if (MENUAPI.isMenuKey(d.id)) { NAME[d.id] = d.name; PRICE[d.id] = MENUAPI.priceOf(d.id, Object.keys(d.sizes)[0]); } });
const COST = MENUAPI.COST;
const SLOTS = [640, 510, 380];
const { DAY_LEN, OPEN_MIN, SPAN_MIN } = MENUAPI;
const PACE = MENUAPI.PACE;
const SHOP = [
  { id: 'milk',       cat: 'menu',  name: 'Молоко и капучино',   desc: 'Открывает холодильник с молоком и молочные напитки: капучино, латте и другие.', cost: 400 },
  { id: 'beans',      cat: 'menu',  name: 'Зерно получше',       desc: 'Напитки дороже на 15%, порция дороже на ₽6.', cost: 450 },
  { id: 'stencil',    cat: 'menu',  name: 'Трафарет для арта',   desc: 'Контур рисунка всегда на чашке, даже без подсказок.', cost: 240 },
  { id: 'grinderPro', cat: 'gear',  name: 'Кофемолка с экраном', desc: 'Показывает подходящую настройку помола.', cost: 320 },
  { id: 'tamper',     cat: 'gear',  name: 'Калиброванный темпер', desc: 'Зелёная зона давления шире.', cost: 300 },
  { id: 'thermo',     cat: 'gear',  name: 'Питчер с термометром', desc: 'Допустимая температура молока шире.', cost: 280 },
  { id: 'machine',    cat: 'gear',  name: 'Кофемашина Pro',      desc: 'Стабильное давление: шот течёт ровно.', cost: 600, minDay: 2 },
  { id: 'cozy',       cat: 'hall',  name: 'Уютный зал',          desc: 'Гирлянда на стене, клиенты терпеливее на 15%.', cost: 350 },
  { id: 'wifi',       cat: 'hall',  name: 'Wi-Fi для студентов', desc: 'На переменах приходит больше народу.', cost: 380, minDay: 2 },
  { id: 'cards',      cat: 'hall',  name: 'Карта лояльности',    desc: 'Рейтинг растёт быстрее за хорошие напитки.', cost: 420, minDay: 2 },
  { id: 'helper',     cat: 'hall',  name: 'Помощник-стажёр',     desc: 'Сам готовит эспрессо и американо, гости терпеливее на 20%. Зарплата за смену растёт с рангом.', cost: 1500, minRank: 5 }
];
const SHOP_CATS = [['menu', 'Меню'], ['gear', 'Оборудование'], ['hall', 'Зал и команда']];
let shopTab = 'menu';

/* Песочница разработчика: включается только ссылкой с #dev. Без него всё ниже нейтрально (см. 16-sandbox.js). */
const DEV = /(^#|-)dev(-|$)/.test(location.hash);
const SBX = { on: false, scale: 1, noPat: false, free: false, inf: false, rate: 1, type: null, next: null, clock: 0, log: [] };

const rnd = (a, b) => a + Math.random() * (b - a);
const wpick = items => { let r = Math.random() * items.reduce((s, i) => s + i[1], 0); for (const [v, w] of items) { if ((r -= w) <= 0) return v; } return items[0][0]; };
const money = n => (n < 0 ? '−' : '') + '₽ ' + Math.abs(Math.round(n)).toLocaleString('ru-RU');

let G = null, D = null, paused = false, muted = false, selPace = 'normal', hintTimer = 0, toastTimer = 0;

