import { Playlist } from '../game/playlist';

/**
 * Фоновая музыка. Потоковое воспроизведение через HTMLAudioElement (файлы не декодируются целиком):
 * порядок случайный и на каждом запуске новый (круг: все треки по разу, затем новая перестановка),
 * следующий подгружается заранее, на стыке — кроссфейд. Запуск только после первого жеста игрока.
 * Список треков берётся из music/manifest.json рядом со страницей (его пишет scripts/make-music-manifest.mjs).
 */
export interface Track {
  file: string;
  artist: string;
  title: string;
}

/** playing — играет; waiting — включена, но игрок ещё ничего не нажал; off — выключена в настройках; none — треков нет */
export type MusicStatus = 'none' | 'off' | 'waiting' | 'playing';

const FADE = 1.5; // секунд на стык треков
const STEP = 100; // мс между шагами таймера
const curve = (v: number): number => v * v; // ползунок линейный, слух — нет

/** Подпись «сейчас играет»: только название, без исполнителя. */
export const trackLabel = (t: Track): string => t.title;

export class MusicPlayer {
  tracks: Track[] = [];
  private pl = new Playlist(0, Math.random);
  private cur: HTMLAudioElement | null = null;
  private nxt: HTMLAudioElement | null = null;
  private enabled = true;
  private vol = 0.5;
  private duckK = 1;
  private gain = 0;
  private unlocked = false;
  private fade = -1;
  private fails = 0;
  private timer = 0;
  private handlers: Array<() => void> = [];

  /** Подтягивает список треков. Любая неудача — просто «музыки нет», без ошибок в консоли. */
  async init(): Promise<void> {
    if (typeof location !== 'undefined' && location.protocol === 'file:') return; // из файла ничего не загрузить
    try {
      const r = await fetch('music/manifest.json');
      if (!r.ok) return;
      const j: unknown = await r.json();
      const list = j && typeof j === 'object' ? (j as { tracks?: unknown }).tracks : null;
      if (!Array.isArray(list)) return;
      this.tracks = list.flatMap((t): Track[] => {
        if (!t || typeof t !== 'object') return [];
        const o = t as Record<string, unknown>;
        if (typeof o['file'] !== 'string' || !o['file']) return [];
        return [{ file: o['file'], artist: typeof o['artist'] === 'string' ? o['artist'] : '', title: typeof o['title'] === 'string' && o['title'] ? o['title'] : o['file'] }];
      });
    } catch {
      this.tracks = [];
    }
    if (!this.tracks.length) return;
    this.pl = new Playlist(this.tracks.length, Math.random);
    this.cur = this.make(this.pl.current);
    this.nxt = this.make(this.pl.peek());
    this.timer = window.setInterval(() => this.step(STEP / 1000), STEP);
    this.emit();
  }

  get available(): boolean {
    return this.tracks.length > 0;
  }

  get status(): MusicStatus {
    if (!this.available) return 'none';
    if (!this.enabled) return 'off';
    return this.unlocked ? 'playing' : 'waiting';
  }

  /** Трек, который звучит сейчас (или вот-вот зазвучит). */
  get track(): Track | null {
    return this.tracks[this.pl.current] ?? null;
  }

  onChange(fn: () => void): void {
    this.handlers.push(fn);
  }

  /** Включено ли и какая громкость (0..1). Применяется сразу. */
  configure(enabled: boolean, volume: number): void {
    const was = this.enabled;
    this.enabled = enabled;
    this.vol = Math.min(1, Math.max(0, volume));
    if (was !== enabled) this.emit();
  }

  /** Приглушение (пауза игры): 1 — как есть, меньше — тише. */
  duck(k: number): void {
    this.duckK = k;
  }

  /** Вызывать из обработчика жеста игрока: браузер разрешает звук только после него. */
  unlock(): void {
    if (this.unlocked || !this.available) return;
    this.unlocked = true;
    this.emit();
    this.cur?.setAttribute('preload', 'auto');
    this.nxt?.setAttribute('preload', 'auto');
  }

  private url(i: number): string {
    const t = this.tracks[i];
    return t ? new URL('music/' + encodeURIComponent(t.file), document.baseURI).href : '';
  }
  private make(i: number): HTMLAudioElement {
    const a = new Audio();
    a.preload = 'metadata';
    a.volume = 0;
    a.src = this.url(i);
    a.addEventListener('error', () => this.onFail(a));
    return a;
  }
  private emit(): void {
    this.handlers.forEach((f) => f());
  }
  private onFail(a: HTMLAudioElement): void {
    if (a !== this.cur && a !== this.nxt) return;
    this.fails++;
    if (this.fails > this.tracks.length) {
      // ни один трек не грузится: тихо отключаемся, чтобы не крутить цикл ошибок
      this.tracks = [];
      window.clearInterval(this.timer);
      this.cur?.pause();
      this.nxt?.pause();
      this.emit();
      return;
    }
    if (a === this.cur) this.advance();
    else {
      this.pl.skipNext();
      this.nxt = this.make(this.pl.peek());
    }
  }

  private play(a: HTMLAudioElement): void {
    const p = a.play();
    if (p) {
      p.catch(() => {
        // браузер не пустил: попробуем после следующего жеста
        if (a === this.cur && !a.paused) return;
        this.unlocked = false;
        this.emit();
      });
    }
  }

  /** Сразу переходит к следующему треку (без кроссфейда: текущий не грузится или кончился). */
  private advance(): void {
    this.cur?.pause();
    this.cur = this.nxt;
    this.pl.advance();
    this.nxt = this.make(this.pl.peek());
    this.fade = -1;
    this.emit();
  }

  private step(dt: number): void {
    const cur = this.cur;
    if (!cur || !this.nxt) return;
    const want = this.enabled && this.unlocked ? curve(this.vol) * this.duckK : 0;
    this.gain += (want - this.gain) * Math.min(1, dt * 6);
    if (Math.abs(want - this.gain) < 0.002) this.gain = want;
    if (want === 0 && this.gain === 0) {
      if (!cur.paused) cur.pause();
      if (this.fade >= 0 && !this.nxt.paused) this.nxt.pause();
      return;
    }
    if (cur.ended) {
      this.advance();
      return;
    }
    if (cur.paused) this.play(cur);
    if (this.fade >= 0 && this.nxt.paused) this.play(this.nxt);
    // стык: за FADE секунд до конца включаем следующий
    if (this.fade < 0 && Number.isFinite(cur.duration) && cur.duration > FADE * 2 && cur.currentTime >= cur.duration - FADE && !cur.paused) {
      this.fade = 0;
      this.nxt.currentTime = 0;
      this.play(this.nxt);
    }
    if (this.fade >= 0) {
      this.fade = Math.min(1, this.fade + dt / FADE);
      cur.volume = this.gain * (1 - this.fade);
      this.nxt.volume = this.gain * this.fade;
      if (this.fade >= 1) {
        cur.pause();
        this.cur = this.nxt;
        this.pl.advance();
        this.nxt = this.make(this.pl.peek());
        this.fade = -1;
        this.fails = 0;
        this.emit();
      }
    } else {
      cur.volume = this.gain;
    }
  }
}
