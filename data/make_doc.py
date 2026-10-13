import json
m = json.load(open('menu.json', encoding='utf8')); p = json.load(open('progression.json', encoding='utf8'))
R = {r['rank']: r for r in p['ranks']}
out = ['# Chofix: меню и лестница открытий (черновик для согласования)\n',
 'Источник: ваш `chofix_menu.md`. Всего **%d позиций**: напитки %d, бутылки %d, еда %d, сиропы %d, альтернативное молоко %d, добавки %d.\n' % (
  len(m['drinks'])+len(m['bottles'])+len(m['food'])+len(m['syrups'])+len(m['altMilk'])+len(m['addons']), len(m['drinks']), len(m['bottles']), len(m['food']), len(m['syrups']), len(m['altMilk']), len(m['addons'])),
 open('summary_table.md', encoding='utf8').read(), '\n']
out.append('Повышения: **ранг 5 «Старший смены»** (день 13, открыто 57% меню) — появляется помощник-бариста. После **ранга 9** (день 30) и ещё 2 дней работы — повышение до менеджера.\n')
for r in range(1, 10):
    out.append(f"\n## Ранг {r}: {R[r]['title']}\nНужно: день {R[r]['minDay']}+, рейтинг {R[r]['minRating']}+, подано {R[r]['minServed']}+ напитков.\n")
    ds = [d for d in m['drinks'] if d['rank'] == r]
    if ds: out.append('**Напитки:** ' + '; '.join(d['name'] + (' (' + d['note'] + ')' if d['note'] and len(d['note']) < 60 else '') for d in ds) + '\n')
    eq = [e for e in p['equipment'] if e['rank'] == r]
    if eq: out.append('**Оборудование (за деньги):** ' + '; '.join(f"{e['name']} — {e['cost']} ₽ ({e['unlocks']})" for e in eq) + '\n')
    for key, lbl in (('syrups', 'Сиропы'), ('altMilk', 'Альтернативное молоко'), ('addons', 'Добавки'), ('bottles', 'Бутылки')):
        xs = [x['name'] for x in m[key] if x['rank'] == r]
        if xs: out.append(f'**{lbl}:** ' + ', '.join(xs) + '\n')
    fs = [f for f in m['food'] if f['rank'] == r]
    if fs:
        secs = {}
        for f in fs: secs.setdefault(f['section'], []).append(f['name'])
        out.append('**Еда:** ' + '; '.join(f"{s} ({len(n)})" for s, n in secs.items()) + '\n')
out.append('\n## Станции приготовления (повторно используемые шаги)\n')
out.append(', '.join(f'`{k}` — {v}' for k, v in m['stations'].items()) + '\n')
out.append('\n## Допущения, которые нужно подтвердить\n')
out += [
 '- «Любой напиток холодным в объёмах 0.3/0.4/0.6» реализуется льдогенератором (ранг 3) как переключатель «холодный».',
 '- «Ежовик» в бабл ти я трактую как топпинг-желе. Если это что-то другое — скажите.',
 '- Сезонные напитки пока открываются на ранге 7 как обычные; смена сезонов появится в режиме менеджера.',
 '- 31 блюдо без цены в вашем меню в игру не включено (по вашему решению).',
 '- Прогрессия растянута на 30 игровых дней: ранг 9 открывается на 30-й день, менеджер — примерно на 32-й.',
 '- Цены оборудования и пороги рангов — черновые, их надо будет настроить симуляцией и вашей игрой.',
 '- Цены меню (100–440 ₽) выше нынешних игровых (80–160), поэтому экономика (аренда, закупки) будет пересчитана.',
 '- Сироп «Орех» в игре сейчас заменится на «Миндаль» из вашего меню.']
open('PROGRESSION.md', 'w', encoding='utf8').write('\n'.join(out))
print(len('\n'.join(out)))
