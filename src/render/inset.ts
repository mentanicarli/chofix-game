import { Application, type WebGLRenderer } from 'pixi.js';
import { BG, Brush, IH, IW, type Hit } from './brush';
import { drawFill, type FillView } from './fillView';
import { drawGrind, type GrindView } from './grindView';
import { drawPour, type PourView } from './pourView';
import { drawShot, type ShotView } from './shotView';
import { drawSteam, type SteamView } from './steamView';
import { drawSyrup, type SyrupView } from './syrupView';
import { drawTamp, type TampView } from './tampView';

export type InsetScene =
  | { mode: 'syrup'; title: string; view: SyrupView }
  | { mode: 'water' | 'milk' | 'ice'; title: string; view: FillView }
  | { mode: 'grind'; title: string; view: GrindView }
  | { mode: 'tamp'; title: string; view: TampView }
  | { mode: 'shot'; title: string; view: ShotView }
  | { mode: 'steam'; title: string; view: SteamView }
  | { mode: 'pour'; title: string; view: PourView };

/** Инсеты бара на Pixi v8. Ввод остаётся на старом canvas (хит-боксы), поэтому этот холст не ловит события. */
export class InsetRenderer {
  private app: Application | null = null;
  private readonly brush = new Brush();
  ready = false;

  /** Описание GPU, если браузер рисует программно (тогда Pixi медленнее старого canvas). */
  software: string | null = null;

  /** force — включить Pixi даже на программном рендере (для сверки и тестов). */
  async init(canvas: HTMLCanvasElement, force = false): Promise<void> {
    const app = new Application();
    await app.init({ canvas, width: IW, height: IH, resolution: 2, autoDensity: true, backgroundColor: BG, antialias: true, autoStart: false, preference: 'webgl' });
    app.ticker.stop();
    const gl = (app.renderer as WebGLRenderer).gl;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) {
      this.software = name;
      if (!force) {
        app.destroy(false);
        return;
      }
    }
    app.stage.addChild(this.brush.root);
    this.app = app;
    this.ready = true;
  }

  /** Рисует кадр и возвращает хит-боксы кнопок; null — не вышло (тогда игра рисует старым способом). */
  draw(scene: InsetScene): Hit[] | null {
    if (!this.app) return null;
    try {
      return this.render(this.app, scene);
    } catch (e) {
      if (!this.failed) console.warn('cuppable: кадр Pixi не нарисован, откат на canvas', e);
      this.failed = true;
      return null;
    }
  }
  private failed = false;
  private lastSig = '';
  private lastHits: Hit[] = [];

  /** Идёт ли на сцене анимация (пунктир струи, пузырьки пара): только тогда кадр меняется сам по себе. */
  private static animating(s: InsetScene): boolean {
    switch (s.mode) {
      case 'water':
      case 'ice':
      case 'milk': return s.view.holding;
      case 'grind': return s.view.hold && !s.view.done;
      case 'shot': return s.view.state === 'run';
      case 'steam': return s.view.hold && !s.view.steamed;
      default: return false;
    }
  }

  private render(app: Application, scene: InsetScene): Hit[] {
    // Перерисовываем только при изменении: на программном GPU кадр Pixi дорог.
    const anim = InsetRenderer.animating(scene);
    const view = { ...scene.view, now: anim ? Math.floor(((scene.view as { now?: number }).now ?? 0) / 16) : 0 };
    const sig = scene.mode + '|' + scene.title + '|' + JSON.stringify(view);
    if (sig === this.lastSig) return this.lastHits;
    this.lastSig = '';
    const b = this.brush;
    b.begin();
    b.frame(scene.title);
    switch (scene.mode) {
      case 'syrup': drawSyrup(b, scene.view); break;
      case 'water':
      case 'ice':
      case 'milk': drawFill(b, scene.view); break;
      case 'grind': drawGrind(b, scene.view); break;
      case 'tamp': drawTamp(b, scene.view); break;
      case 'shot': drawShot(b, scene.view); break;
      case 'steam': drawSteam(b, scene.view); break;
      case 'pour': drawPour(b, scene.view); break;
    }
    b.commit();
    app.renderer.render(app.stage);
    this.lastSig = sig;
    this.lastHits = b.hits.slice();
    return this.lastHits;
  }
}
