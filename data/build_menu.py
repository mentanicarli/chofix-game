#!/usr/bin/env python3
"""menu_raw.json + авторская разметка (семьи, шаги, ранги) -> menu.json, progression.json, PROGRESSION.md"""
import json, re, statistics
raw = json.load(open('menu_raw.json', encoding='utf8'))

# ---------- станции (повторно используемые шаги) ----------
STATIONS = {
 'grind':'Смолоть кофе','tamp':'Утрамбовать (темпер)','shot':'Пробить шот','water':'Добавить горячую воду','milk':'Налить молоко в питчер','steam':'Вспенить молоко паром','pour':'Залить в чашку',
 'syrup':'Сироп','ice':'Насыпать лёд','cream':'Добавить сливки','foam':'Взбить пенку','whisk':'Взбить матчу венчиком','brew':'Заварить чай','juice':'Налить сок или пюре','tonic':'Налить тоник','blend':'Взбить в блендере',
 'boba':'Добавить шарики','powder':'Добавить порошок','shake':'Взболтать в шейкере','topping':'Украсить','shot_only':'Пробить шот сверху'}

# ---------- напитки: id, семья, шаги, ранг, температура ----------
# steps — последовательность станций; параметры — в скобках-словарях
D = {}
def d(name, id, fam, steps, rank, temp='both', ing=None, note='', shots=0):
    # shots: сколько шотов эспрессо в напитке: число или 'size' (по размеру: 0.2 и 0.3 л = 1, 0.4 и 0.6 л = 2, см. src/game/volumes.ts)
    D[name] = dict(id=id, family=fam, steps=steps, rank=rank, temp=temp, ing=ing or [], note=note, shots=shots)
E = ['grind','tamp','shot']
d('Эспрессо','espresso','espresso',E,1,'hot',['кофе'],'один шот 30 мл (около 9 г кофе), чашка 90 мл; размера нет',1)
d('Двойной эспрессо','espresso_double','espresso',E,1,'hot',['кофе'],'два одинаковых шота подряд в одну чашку: 60 мл (18 г кофе), чашка 120 мл',2)
d('Американо','americano','espresso',E+['water'],1,'both',['кофе','вода'],'шот(ы) и горячая вода до объёма чашки',shots='size')
d('Капучино','cappuccino','milk',E+['milk','steam:thick','pour'],2,'both',['кофе','молоко'],'густая пена: около трети напитка',shots='size')
d('Латте','latte','milk',E+['milk','steam:thin','pour'],2,'both',['кофе','молоко'],'больше жидкого молока и тонкая пена',shots='size')
d('Флэт уайт','flat_white','milk',E+['milk','steam:micro','pour'],3,'hot',['кофе','молоко'],'всегда двойной эспрессо, плотная микропена; только 0.2 л',2)
d('Ванильный раф','vanilla_raf','raf',['grind','tamp','shot:pitcher','cream','syrup:ваниль','steam:thin','pour'],3,'both',['кофе','сливки','сироп ваниль'],'классический раф: эспрессо сразу в питчер, сливки и сироп, всё взбивается паром вместе; молока нет',shots='size')
d('Раф кофе','raf','raf',['grind','tamp','shot:pitcher','cream','steam:thin','pour'],4,'both',['кофе','сливки','сахар'],'классический раф: эспрессо сразу в питчер, холодные сливки 10–15% и сахар, всё взбивается паром вместе; молока нет',shots='size')
d('Какао','cocoa','powder',['powder:какао','milk','steam:thin','pour'],3,'both',['какао','молоко'],'порошок какао и молоко с паром')
d('Цикорий латте','chicory_latte','powder',['powder:цикорий','milk','steam:thin','pour'],4,'both',['цикорий','молоко'],'кофе нет — для любителей без кофеина')
d('Матча латте (на церемониальной матче кансай)','matcha_latte','matcha',['whisk','milk','steam:thin','pour'],4,'both',['матча','молоко'],'матча взбивается в воде 80°C, сверху молоко с паром')
d('Чай зелёный сенча','tea_sencha','tea',['brew:80/2'],4,'both',['чай сенча'],'80°C, 2 мин')
d('Чай чёрный ассам','tea_assam','tea',['brew:95/4'],4,'both',['чай ассам'],'95°C, 4 мин')
d('Чай каркадэ','tea_hibiscus','tea',['brew:95/5'],4,'both',['каркадэ'],'95°C, 5 мин')
d('Чай гречишный','tea_buckwheat','tea',['brew:95/5'],4,'hot',['гречишный чай'],'95°C, 5 мин; только 0.2 л')
d('Горячий бамбл','hot_bumble','bumble',['juice:горячий','shot_only'],5,'hot',['сок','кофе'],'тёплый сок 60–65°C (не кипятить) и два шота сверху по ложке; 0.3 л; без льда',2)
d('Апельсиновый бамбл','orange_bumble','bumble',['ice','juice:апельсин']+E+['pour:layer'],5,'cold',['апельсиновый сок','кофе','лёд'],'слои: лёд → сок → два шота сверху по ложке',2)
d('Гранатовый бамбл','pomegranate_bumble','bumble',['ice','juice:гранат']+E+['pour:layer'],5,'cold',['гранатовый сок','кофе','лёд'],'слои: лёд → сок → два шота сверху по ложке',2)
d('Эспрессо-тоник','espresso_tonic','tonic',['ice','tonic']+E+['pour:layer'],5,'cold',['тоник','кофе','лёд'],'слои: лёд → тоник → эспрессо сверху по ложке',shots='size')
d('Сливочный аэрокано с карамелью','aerocano','aero',['ice']+E+['water','foam:cream','topping:карамельный соус'],5,'cold',['кофе','вода','сливки','карамель','лёд'],'лёд → эспрессо → холодная вода → сливочная пена из сифона → карамельный соус',shots='size')
d('Матча бамбл','matcha_bumble','bumble',['whisk','ice','juice:апельсин','pour:layer'],6,'cold',['апельсиновый сок','матча','лёд'],'матча взбивается в воде 80°C, потом лёд → сок → матча сверху по ложке')
d('Матча-тоник','matcha_tonic','tonic',['whisk','ice','tonic','pour:layer'],6,'cold',['тоник','матча','лёд'],'матча взбивается в воде 80°C, потом лёд → тоник → матча сверху по ложке')
d('Латте сакура-вишня с пенкой таро','latte_sakura','foamlatte',E+['syrup:сакура-вишня','milk','steam:thin','pour','foam:таро'],6,'both',['кофе','молоко','сироп сакура-вишня','пенка таро'],'0.4/0.6 л; сверху холодная пенка таро',shots='size')
d('Латте банановый с пенкой крем-брюле (протеиновая пенка — 11 г белка на порцию)','latte_banana','foamlatte',E+['syrup:банан','milk','steam:thin','pour','foam:крем-брюле протеин'],6,'both',['кофе','молоко','банан','протеиновая пенка'],'0.4/0.6 л; сверху протеиновая пенка крем-брюле',shots='size')
d('Латте лимонная меренга с пенкой таро','latte_lemon','foamlatte',E+['syrup:лимонная меренга','milk','steam:thin','pour','foam:таро'],6,'both',['кофе','молоко','лимонная меренга','пенка таро'],'сверху холодная пенка таро',shots='size')
d('Чай смородиновый сорбет','tea_currant','tea',['brew:95/4','juice:смородина'],6,'both',['чай','смородиновый сорбет'],'чёрный чай 95°C, 4 мин и смородиновое пюре (около пятой части напитка)')
d('Латте кокосовый пломбир с пенкой таро','latte_coconut','foamlatte',E+['syrup:кокосовый пломбир','milk','steam:thin','pour','foam:таро'],7,'both',['кофе','молоко','кокос','пенка таро'],'сезон; 0.4/0.6 л',shots='size')
d('Матча латте кокосовый пломбир с пенкой таро','matcha_coconut','foamlatte',['whisk','syrup:кокосовый пломбир','milk','steam:thin','pour','foam:таро'],7,'both',['матча','молоко','кокос','пенка таро'],'сезон; 0.4/0.6 л')
d('Капучино пряная тыква','cappuccino_pumpkin','milk',E+['syrup:тыква','milk','steam:thick','pour','topping:специи'],7,'both',['кофе','молоко','тыква','специи'],'сезон; капучино с тыквенным сиропом и щепоткой специй (около 0,5 г)',shots='size')
d('Раф сливочная халва','raf_halva','raf',['grind','tamp','shot:pitcher','cream','syrup:халва','steam:thin','pour'],7,'both',['кофе','сливки','халва'],'сезон; классический раф с сиропом халва, молока нет',shots='size')
d('Милкшейк ванильный','milkshake_vanilla','shake',['ice','milk','syrup:ваниль','blend'],8,'cold',['молоко','мороженое','ваниль','лёд'],'мороженое входит в шаг «Блендер»: 0,3 объёма в граммах')
d('Милкшейк банановый','milkshake_banana','shake',['ice','milk','juice:банан','blend'],8,'cold',['молоко','мороженое','банановое пюре','лёд'],'мороженое входит в шаг «Блендер»; банановое пюре (из холодильника соков) вместо сиропа')
d('Фраппе карамельный','frappe_caramel','shake',['ice']+E+['milk','syrup:карамель','blend','topping:карамельный соус'],8,'cold',['кофе','молоко','карамель','лёд'],'два шота, молоко и лёд взбиваются в блендере, сверху карамельный соус',2)
d('Бабл ти гуава-персик','boba_guava','boba',['brew:90/3','syrup:гуава-персик','ice','shake','boba'],9,'cold',['чай','сироп гуава-персик','шарики','лёд'],'чай, сироп и лёд взбиваются в шейкере; шарики лежат на дне стакана, напиток переливают на них')
d('Бабл ти малина-лимон с ежовиком','boba_raspberry','boba',['brew:90/3','syrup:малина-лимон','ice','shake','boba:ежовик'],9,'cold',['чай','малина-лимон','ежовик','лёд'],'«ежовик» трактую как топпинг-желе; уточните. Чай, сироп и лёд взбиваются в шейкере; шарики на дне стакана')
d('Протеин на молоке','protein_milk','protein',['powder:протеин','milk','shake'],9,'cold',['протеин','молоко'],'только 0.4 л; 30 г порошка и молоко в шейкере')
d('Протеин на воде','protein_water','protein',['powder:протеин','water','shake'],9,'cold',['протеин','вода'],'только 0.4 л; 30 г порошка и вода в шейкере')

drinks = []
names = {x['name'] for x in raw['drinks']}
assert names == set(D), (names ^ set(D))
for x in raw['drinks']:
    m = D[x['name']]
    drinks.append({**m, 'name': re.sub(r'\s*\(.*\)$', '', x['name']), 'fullName': x['name'], 'section': x['section'], 'sizes': x['sizes'],
                   'coldSizes': [s for s in x['sizes'] if s != '0.2'] if m['temp'] == 'both' else [],
                   'steps': [dict(zip(('st', 'arg'), s.split(':', 1))) if ':' in s else {'st': s} for s in m['steps']]})

# ---------- бутылки ----------
bottles = [{'id': 'bottle_%d' % i, **b, 'rank': 2} for i, b in enumerate(raw['bottles'])]

# ---------- еда ----------
KIND = [('Круассан|Круглый круассан', 'croissant'), ('Краффин', 'croissant'), ('Торт|Тирамису|Медовик|Синнокейк', 'cake'), ('Чизкейк', 'cheesecake'),
 ('Кукис|Печенье|Орешки', 'cookie'), ('Брауни', 'brownie'), ('Маффин|Кекс', 'muffin'), ('Донат|Шелл|Рондель', 'donut'), ('Эклер|Трубочка|Шу ', 'eclair'),
 ('Макарон', 'macaron'), ('Моти', 'mochi'), ('Сэндвич|Бейгл|Чиабатта', 'sandwich'), ('Ролл', 'roll'), ('Салат|Поке|поке|Винегрет', 'bowl'), ('Суп|Крем-суп|рамен', 'soup'),
 ('Блин|Сырники|Драники|Запеканка|Омлет', 'pancake'), ('Каша', 'porridge'), ('Конфеты|Батончик', 'candy'), ('Брецель', 'pretzel'), ('Штрудель|Тарталетка|Киш', 'pie'),
 ('Плов|Паста|Куриный|Куриное|Ланч', 'plate'), ('Колбас|Пирожное|Сосиска|Дрип', 'other')]
def kind(n):
    for pat, k in KIND:
        if re.search(pat, n): return k
    return 'other'
by_sec = {}
for f in raw['food']:
    if f['price'] and f['weight']: by_sec.setdefault(f['section'], []).append(f['price'] / f['weight'])
mains = by_sec.get('Завтраки и ланчи', []) + by_sec.get('Сэндвичи и выпечка', [])
glob = statistics.median(mains)
def est(f):
    r = statistics.median(by_sec[f['section']]) if len(by_sec.get(f['section'], [])) >= 3 else glob
    return int(round(f['weight'] * r / 10.0) * 10)
def frank(f):
    s, p, n = f['section'], f['price'] or est(f), f['name']
    if s == 'Сладкие снеки': return 2 if p <= 100 else 3
    if s == 'Сладкая выпечка': return 3 if p <= 160 else 4 if p <= 220 else 5
    if s == 'Десерты': return 5 if p <= 200 else 6
    if s == 'Vegan friendly': return 5
    if s == 'Сэндвичи и выпечка': return 6 if p <= 250 else 7
    if s == 'Завтраки и ланчи': return 7 if p <= 250 else 8
    if s == 'Новинки сезона': return 4 if 'Брецель' in n else 9 if 'дрип' in n else 8
    return 9
COLD_ONLY = re.compile(r'Салат|Поке|поке|Винегрет|Торт|Чизкейк|Тирамису|Моти|Макарон|Конфеты|Тарталетка|Каша рисовая с манго и чиа')
food = []
for i, f in enumerate([f for f in raw['food'] if f['price']]):
    p = f['price']; k = kind(f['name'])
    heat = f['section'] in ('Сэндвичи и выпечка', 'Завтраки и ланчи', 'Новинки сезона') and not COLD_ONLY.search(f['name']) and 'дрип' not in f['name'] and k not in ('pretzel',)
    heat = heat or (k == 'croissant' and re.search('курицей|ветчиной|сыром|лососем|рыбой', f['name']) is not None)
    case = {'Сладкие снеки': 'snacks', 'Сладкая выпечка': 'pastry', 'Десерты': 'dessert', 'Vegan friendly': 'dessert',
            'Сэндвичи и выпечка': 'deli', 'Завтраки и ланчи': 'deli', 'Новинки сезона': 'deli'}[f['section']]
    if f['section'] == 'Новинки сезона' and k in ('pretzel',): case = 'pastry'
    if 'дрип' in f['name']: case = 'snacks'
    food.append({'id': 'food_%03d' % i, 'name': f['name'], 'section': f['section'], 'weight': f['weight'], 'price': p, 
                 'kind': k, 'case': case, 'heatable': bool(heat), 'rank': frank(f)})

# ---------- модификаторы ----------
SYR_RANK = {'Ваниль': 2, 'Карамель': 2, 'Миндаль': 2, 'Соленая карамель': 3, 'Каштан': 3, 'Халва': 3, 'Кокос': 4, 'Персик': 4, 'Лаванда': 4, 'Тыква': 5,
            'Ваниль (без сахара)': 5, 'Карамель (без сахара)': 5, 'Малина (без сахара)': 5, 'Шоколад (без сахара)': 5}
syrups = [{'id': 'syr_%d' % i, **s, 'rank': SYR_RANK[s['name']]} for i, s in enumerate(raw['syrups'])]
MILK_RANK = {'Овсяное': 4, 'Миндальное': 5, 'Кокосовое': 5, 'Банановое': 6, 'Безлактозное': 6}
altMilk = [{'id': 'alt_%d' % i, 'name': k, 'surcharge': v, 'rank': MILK_RANK[k]} for i, (k, v) in enumerate(raw['altMilk'].items())]
ADD_RANK = {'Протеиновая пенка': 6, 'Сливочная пенка таро': 6, 'Джус боллы': 9, 'Доп. порция эспрессо / матчи / протеина': 3, 'Маршмеллоу': 3, 'Карамельный соус': 3}
addons = [{'id': 'add_%d' % i, **a, 'rank': ADD_RANK[a['name']]} for i, a in enumerate(raw['addons'])]

# ---------- прогрессия ----------
RANKS = [
 (1,'Стажёр',1,1.0,0),(2,'Бариста',3,2.0,8),(3,'Опытный бариста',6,2.5,25),(4,'Знаток чая и матчи',9,3.0,50),(5,'Старший смены',13,3.2,90),
 (6,'Мастер пенок',17,3.4,130),(7,'Мастер сезона',21,3.6,175),(8,'Мастер вкусов',25,3.8,220),(9,'Шеф-бариста',30,4.0,270)]
ranks = [dict(rank=r, title=t, minDay=dd, minRating=rt, minServed=s) for r, t, dd, rt, s in RANKS]
EQ = [  # id, имя, ранг, цена, открывает
 ('fridge_bottles','Холодильник за баром (бутылки)',2,500,'вода и морсы'),
 ('case_snacks','Прилавок со снеками',2,300,'снеки'),
 ('case_pastry','Витрина выпечки',3,900,'круассаны, маффины, брецели'),
 ('cream','Кувшин сливок',3,300,'раф'),
 ('powders','Полка порошков',3,250,'какао, цикорий, протеин'),
 ('ice','Льдогенератор',3,800,'холодные версии любых напитков 0.3–0.6 л'),
 ('matcha','Набор для матчи',4,500,'матча латте'),
 ('tea','Чайная станция',4,600,'чаи'),
 ('juice','Холодильник соков и тоника',5,1100,'бамблы, тоники'),
 ('whipper','Сифон для сливочной пены',5,900,'аэрокано'),
 ('case_dessert','Охлаждаемая витрина десертов',5,1400,'торты, чизкейки, vegan'),
 ('foamer','Миксер для пенок',6,1200,'пенки таро и крем-брюле'),
 ('fridge_deli','Холодильник для сэндвичей и ланчей',6,1600,'сэндвичи, ролы, салаты'),
 ('microwave','Микроволновка',6,600,'разогрев по просьбе гостя'),
 ('blender','Блендер',8,1500,'милкшейки, фраппе'),
 ('boba','Станция бабл ти',9,1800,'бабл ти, джус боллы'),
 ('shaker','Шейкер',9,400,'протеин')]
# для рангов 4 и выше оборудование вдвое дороже (решение владельца; в JSON цены лежали уже такими)
equipment = [dict(id=i, name=n, rank=r, cost=c * (2 if r >= 4 else 1), unlocks=u) for i, n, r, c, u in EQ]
prog = {'ranks': ranks, 'equipment': equipment, 'promotions': {'seniorRank': 5, 'managerAfterRank': 9, 'managerExtraDays': 2}}

menu = {'stations': STATIONS, 'drinks': drinks, 'bottles': bottles, 'food': food, 'syrups': syrups, 'altMilk': altMilk, 'addons': addons}
json.dump(menu, open('menu.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
json.dump(prog, open('progression.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)

# ---------- сводка ----------
cnt = {r: {'напитки': 0, 'еда': 0, 'бутылки': 0, 'сиропы': 0, 'молоко': 0, 'добавки': 0} for r in range(1, 10)}
for k, lst in (('напитки', drinks), ('еда', food), ('бутылки', bottles), ('сиропы', syrups), ('молоко', altMilk), ('добавки', addons)):
    for x in lst: cnt[x['rank']][k] += 1
tot = sum(sum(v.values()) for v in cnt.values()); cum = 0
lines = ['| Ранг | Звание | День от | Рейтинг от | Новое: напитки / еда / бутылки / сиропы / молоко / добавки | Всего позиций |', '|---|---|---|---|---|---|']
for rk in ranks:
    c = cnt[rk['rank']]; cum += sum(c.values())
    lines.append(f"| {rk['rank']} | {rk['title']} | {rk['minDay']} | {rk['minRating']} | {c['напитки']} / {c['еда']} / {c['бутылки']} / {c['сиропы']} / {c['молоко']} / {c['добавки']} | {cum} ({cum*100//tot}%) |")
open('summary_table.md', 'w', encoding='utf8').write('\n'.join(lines))
print('\n'.join(lines)); print('всего', tot, 'блюд без цены убрано:', sum(1 for f in raw['food'] if not f['price']))
