#!/usr/bin/env python3
"""chofix_menu.md -> menu_raw.json (только то, что написано в md, без домыслов)."""
import re, json, sys
src = open('chofix_menu.md', encoding='utf8').read().splitlines()
SIZES = ['0.2', '0.3', '0.4', '0.6']
out = {'drinks': [], 'bottles': [], 'food': [], 'syrups': [], 'altMilk': {}, 'addons': []}
part = sec = None; hdr = None
def price(s):
    m = re.search(r'(\d+)\s*₽', s); return int(m.group(1)) if m else None
def weight(s):
    m = re.search(r'(\d+)\s*(г|мл)', s); return (int(m.group(1)), 'g' if m.group(2) == 'г' else 'ml') if m else (None, None)
for ln in src:
    if ln.startswith('# '): part = ln[2:].strip(); sec = None; continue
    if ln.startswith('## '): sec = ln[3:].strip(); continue
    if not ln.startswith('|'): continue
    cells = [c.strip() for c in ln.strip().strip('|').split('|')]
    if cells[0] in ('Позиция', 'Сироп', 'Молоко', 'Добавка') or set(cells[0]) <= set('-'): hdr = cells; continue
    if part == 'Напитки' and sec == 'Напитки в бутылках':
        w, u = weight(cells[1]); out['bottles'].append({'name': cells[0], 'amount': w, 'unit': u, 'price': price(cells[2])})
    elif part == 'Напитки':
        sizes = {s: price(c) for s, c in zip(SIZES, cells[1:5]) if price(c)}
        out['drinks'].append({'name': cells[0], 'section': sec, 'sizes': sizes})
    elif part == 'Еда':
        w, u = weight(cells[1]); out['food'].append({'name': cells[0], 'section': sec, 'weight': w, 'price': price(cells[2])})
    elif sec == 'Сиропы': out['syrups'].append({'name': cells[0], 'price': price(cells[1])})
    elif sec == 'Альтернативное молоко': out['altMilk'][cells[0]] = {s: price(c) for s, c in zip(SIZES, cells[1:5])}
    elif sec == 'Добавки': out['addons'].append({'name': cells[0], 'price': price(cells[1])})
json.dump(out, open('menu_raw.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in out.items()})
