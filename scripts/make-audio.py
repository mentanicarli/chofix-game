#!/usr/bin/env python3
"""Исходники звуков (assets/sfx/*.wav) -> public/sfx/*.webm (Opus) + manifest.json.
Первый запуск: --extract достаёт WAV из старого src/audio/sfx_data.js."""
import base64, json, re, subprocess, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src, out = root / 'assets/sfx', root / 'public/sfx'
if '--extract' in sys.argv:
    s = (root / 'src/audio/sfx_data.js').read_text()
    for k, b in re.findall(r'"([\w\-]+)":"data:audio/\w+;base64,([^"]*)"', s):
        (src / f'{k}.wav').write_bytes(base64.b64decode(b))
out.mkdir(parents=True, exist_ok=True)
man = {}
for w in sorted(src.glob('*.wav')):
    o = out / f'{w.stem}.webm'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(w), '-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on', str(o)], check=True)
    man[w.stem] = {'file': f'sfx/{o.name}', 'bytes': o.stat().st_size}
(out / 'manifest.json').write_text(json.dumps({k: v['file'] for k, v in man.items()}, ensure_ascii=False, indent=1))
print(len(man), 'sounds', sum(v['bytes'] for v in man.values()) // 1024, 'KB opus;', sum(p.stat().st_size for p in src.glob('*.wav')) // 1024, 'KB wav')
