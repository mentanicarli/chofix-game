/** Настройки игрока. Хранятся отдельно от сохранения игры, версионируются и применяются сразу. */
export const SETTINGS_KEY = 'chofix-settings';
export const SETTINGS_VERSION = 1;

export type GraphicsMode = 'auto' | 'high' | 'low';
export const GRAPHICS_MODES: readonly GraphicsMode[] = ['auto', 'high', 'low'];

export interface Settings {
  v: number;
  musicOn: boolean;
  /** 0..1 */
  musicVol: number;
  sfxOn: boolean;
  /** 0..1 */
  sfxVol: number;
  /** значение подсказок; пока hintsSet=false, игра сама выключает их с 3-го дня, как раньше */
  hints: boolean;
  hintsSet: boolean;
  graphics: GraphicsMode;
}

export const DEFAULT_SETTINGS: Settings = {
  v: SETTINGS_VERSION,
  musicOn: true,
  musicVol: 0.5,
  sfxOn: true,
  sfxVol: 1,
  hints: true,
  hintsSet: false,
  graphics: 'auto'
};

const bool = (x: unknown, d: boolean): boolean => (typeof x === 'boolean' ? x : d);
const vol = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : d);

/** Читает сохранённые настройки. Никогда не бросает: всё лишнее и битое заменяется значениями по умолчанию. */
export function parseSettings(raw: string | null): Settings {
  const d = DEFAULT_SETTINGS;
  if (!raw) return { ...d };
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return { ...d };
  }
  if (!o || typeof o !== 'object') return { ...d };
  const r = o as Record<string, unknown>;
  const g = r['graphics'];
  return {
    v: SETTINGS_VERSION,
    musicOn: bool(r['musicOn'], d.musicOn),
    musicVol: vol(r['musicVol'], d.musicVol),
    sfxOn: bool(r['sfxOn'], d.sfxOn),
    sfxVol: vol(r['sfxVol'], d.sfxVol),
    hints: bool(r['hints'], d.hints),
    hintsSet: bool(r['hintsSet'], d.hintsSet),
    graphics: GRAPHICS_MODES.find((m) => m === g) ?? d.graphics
  };
}

export const serializeSettings = (s: Settings): string => JSON.stringify({ ...s, v: SETTINGS_VERSION });

/** Лёгкая графика нужна, если выбрана вручную или если «Авто» и видеокарты нет (программный WebGL). */
export const isLowGraphics = (mode: GraphicsMode, software: boolean): boolean => mode === 'low' || (mode === 'auto' && software);
