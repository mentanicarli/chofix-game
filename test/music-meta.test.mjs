/* global Buffer */
import { describe, expect, test } from 'vitest';
import { fromFilename, readId3, trackInfo } from '../scripts/music-meta.mjs';

describe('названия треков', () => {
  const id3 = (frames) => {
    const body = Buffer.concat(
      frames.map(([id, text]) => {
        const data = Buffer.concat([Buffer.from([3]), Buffer.from(text, 'utf8')]);
        const h = Buffer.alloc(10);
        h.write(id, 0, 'latin1');
        h.writeUInt32BE(data.length, 4);
        return Buffer.concat([h, data]);
      })
    );
    const head = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, (body.length >> 21) & 127, (body.length >> 14) & 127, (body.length >> 7) & 127, body.length & 127]);
    return Buffer.concat([head, body, Buffer.alloc(64)]);
  };
  test('ID3v2: исполнитель и название (UTF-8)', () => {
    expect(readId3(id3([['TIT2', 'Утро'], ['TPE1', 'Лофи']]))).toEqual({ title: 'Утро', artist: 'Лофи' });
  });
  test('теги важнее имени файла', () => {
    expect(trackInfo('A - B.mp3', id3([['TIT2', 'Утро'], ['TPE1', 'Лофи']]))).toEqual({ file: 'A - B.mp3', title: 'Утро', artist: 'Лофи' });
  });
  test('без тегов: «Исполнитель - Название.mp3»', () => {
    expect(trackInfo('Лофи - Утро.mp3', Buffer.alloc(10))).toEqual({ file: 'Лофи - Утро.mp3', title: 'Утро', artist: 'Лофи' });
  });
  test('без тегов и без дефиса: имя файла', () => {
    expect(fromFilename('Rainy Window Mocha.mp3')).toEqual({ artist: '', title: 'Rainy Window Mocha' });
  });
  test('битый тег не роняет скрипт', () => {
    expect(readId3(Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x7fTIT2'))).toEqual({ artist: '', title: '' });
  });
});
