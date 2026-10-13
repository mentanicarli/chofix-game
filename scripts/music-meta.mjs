// Названия треков: ID3-теги (v2.2–2.4, запасной вариант v1), иначе имя файла «Исполнитель - Название.mp3».

function decode(enc, b) {
  if (enc === 1 || enc === 2) {
    let le = false;
    let s = 0;
    if (enc === 1 && b.length >= 2) {
      if (b[0] === 0xff && b[1] === 0xfe) { le = true; s = 2; } else if (b[0] === 0xfe && b[1] === 0xff) { s = 2; }
    }
    let out = '';
    for (let i = s; i + 1 < b.length; i += 2) out += String.fromCharCode(le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
    return out;
  }
  return Buffer.from(b).toString(enc === 3 ? 'utf8' : 'latin1');
}
const clean = (s) => s.replace(/\0+/g, ' ').trim();
const textFrame = (b) => (b.length ? clean(decode(b[0], b.subarray(1))) : '');
const synchsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

/** Достаёт { artist, title } из начала mp3-файла (ID3v2) или из его конца (ID3v1). Нет тегов — пустые строки. */
export function readId3(buf) {
  const res = { artist: '', title: '' };
  try {
    if (buf.length > 10 && buf.toString('latin1', 0, 3) === 'ID3') {
      const ver = buf[3];
      const end = Math.min(buf.length, 10 + synchsafe(buf, 6));
      let o = 10;
      if (buf[5] & 0x40) o += ver === 4 ? synchsafe(buf, o) : buf.readUInt32BE(o) + 4; // расширенный заголовок
      const idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10;
      while (o + hdr <= end) {
        const id = buf.toString('latin1', o, o + idLen);
        if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
        let size;
        if (ver === 2) size = (buf[o + 3] << 16) | (buf[o + 4] << 8) | buf[o + 5];
        else if (ver === 4) size = synchsafe(buf, o + 4);
        else size = buf.readUInt32BE(o + 4);
        if (size <= 0) break;
        const body = buf.subarray(o + hdr, o + hdr + size);
        if (id === 'TIT2' || id === 'TT2') res.title = textFrame(body);
        else if (id === 'TPE1' || id === 'TP1') res.artist = textFrame(body);
        o += hdr + size;
      }
    }
    if ((!res.title || !res.artist) && buf.length >= 128 && buf.toString('latin1', buf.length - 128, buf.length - 125) === 'TAG') {
      res.title = res.title || clean(buf.toString('latin1', buf.length - 125, buf.length - 95));
      res.artist = res.artist || clean(buf.toString('latin1', buf.length - 95, buf.length - 65));
    }
  } catch {
    /* битый тег — как будто его нет */
  }
  return res;
}

/** «Исполнитель - Название.mp3» → { artist, title }; без « - » — только название из имени файла. */
export function fromFilename(file) {
  const base = file.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: base };
}

/** Итог по файлу: теги важнее имени, имя важнее ничего. */
export function trackInfo(file, buf) {
  const tag = readId3(buf), name = fromFilename(file);
  const fromTags = tag.title || tag.artist;
  return { file, artist: fromTags ? tag.artist : name.artist, title: tag.title || name.title };
}
