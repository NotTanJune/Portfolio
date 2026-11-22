import { currentStyle, observeTheme, prefersReducedMotion } from './env';
import { createGLRenderer, GLRenderer, lifeInstanceData } from './gl';
import { LOT_K, lotHeightPx, lotView } from './layout';
import { lifeTick, lotPuffs } from './life';
import { PARK_COUNT } from './parks';
import { createRasterBuffer, RasterBuffer, rasterizeLot } from './raster';
import { hash } from './rng';
import { applyBlink, makeScene } from './scene';
import { CityRepo, LifeInstance, LotTarget, Scene, View } from './types';

/**
 * The Projects cards' building lots. Every lot on the page shares ONE WebGL context: the stage draws each
 * lot into one offscreen canvas and copies the result into that card's own 2D canvas with `drawImage`.
 * Browsers cap live WebGL contexts at about 16 and the page has 18 cards, so a context per card would fail.
 * One animation loop serves every lot; the last `release()` stops it and frees the context.
 */

/** CSS pixels. `height` is the visible part of the lot; the canvas is taller and anchored to the bottom. */
export interface LotLayout { width: number; height: number; canvasHeight: number }
export interface LotHandle {
  setTarget(target: LotTarget): void;
  setHover(on: boolean): void;
  release(): void;
}

/** One turn takes 26 seconds, five times faster while the card is hovered. */
const TURN_PER_MS = (2 * Math.PI) / 26000;
/** A lot more than this far outside the viewport (in CSS pixels) is not drawn. */
const MARGIN = 40;

interface Stage { repos: CityRepo[]; maquette: Scene; night: Scene; view: View }

interface Entry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  target: LotTarget;
  theta: number;
  speed: number;
  hover: boolean;
  /** Needs drawing. Only matters under reduced motion, where nothing redraws by itself. */
  dirty: boolean;
  /** Smoke for the tick last computed, so it is rebuilt only when the 8 Hz tick changes. */
  lifeScene: Scene | null;
  lifeTarget: LotTarget | null;
  lifeTick: number;
  lifeList: LifeInstance[];
  lifeData: Float32Array | null;
}

// Scenes: rebuilt only when the repo list is a different array than last time.
let stage: Stage | null = null;

// Everything below exists only while at least one lot is acquired.
const entries: Entry[] = [];
let renderer: GLRenderer | null = null;
let offscreen: HTMLCanvasElement | null = null;
/** The stage whose scenes the renderer holds and whose view the lot canvases are sized for. */
let bound: Stage | null = null;
let dpr = 1;
let raster: { view: View; buffer: RasterBuffer; image: ImageData } | null = null;
let raf = 0;
let last = 0;
let lifeMs = 0;
let styleSeen: Scene['key'] | null = null;
let unobserveTheme: (() => void) | null = null;

function stageFor(repos: CityRepo[]): Stage {
  if (!stage || stage.repos !== repos) {
    const now = Date.now();
    const maquette = makeScene(repos, 'maquette', now);
    const night = makeScene(repos, 'night', now);
    stage = { repos, maquette, night, view: lotView(maquette, night) };
  }
  return stage;
}

/** Which thing a card shows. `park` is used only when the repo has no building. */
export function lotTargetFor(repos: CityRepo[], repoName: string | null, park: number): LotTarget {
  if (repoName) {
    const key = repoName.toLowerCase();
    const buildings = stageFor(repos).maquette.buildings;
    for (let i = 0; i < buildings.length; i++) {
      const repo = buildings[i].repo;
      if (repo && repo.name.toLowerCase() === key) return { kind: 'building', index: i };
    }
  }
  return { kind: 'park', park: ((park % PARK_COUNT) + PARK_COUNT) % PARK_COUNT };
}

/** Sizes of one lot. Needs no canvas, so a component can size itself before anything is drawn. */
export function lotLayout(repos: CityRepo[], target: LotTarget): LotLayout {
  const st = stageFor(repos);
  return {
    width: st.view.BW * LOT_K,
    height: lotHeightPx(st.view, st.maquette, target),
    canvasHeight: st.view.BH * LOT_K,
  };
}

export function lotRendererKind(): 'webgl2' | 'canvas2d' | 'none' {
  if (renderer) return 'webgl2';
  return entries.length > 0 ? 'canvas2d' : 'none';
}

function schedule(): void {
  if (!raf && entries.length > 0 && document.visibilityState === 'visible') raf = requestAnimationFrame(frame);
}

/** Backing store size of a lot canvas: device pixels for WebGL, art pixels for the software path. */
function backingSize(view: View): { w: number; h: number } {
  return renderer
    ? { w: Math.round(view.BW * LOT_K * dpr), h: Math.round(view.BH * LOT_K * dpr) }
    : { w: view.BW, h: view.BH };
}

function sizeEntry(e: Entry, view: View): void {
  const { w, h } = backingSize(view);
  if (e.canvas.width !== w) e.canvas.width = w;
  if (e.canvas.height !== h) e.canvas.height = h;
  e.canvas.classList.toggle('project-lot__canvas--pixel', !renderer);
  e.dirty = true;
}

/** Hands the scenes to the renderer and resizes the offscreen canvas and every lot canvas for `st`. */
function bind(st: Stage): void {
  bound = st;
  if (renderer) {
    renderer.setScene(st.maquette);
    renderer.setScene(st.night);
    const { w, h } = backingSize(st.view);
    renderer.resize(w, h);
  }
  for (let i = 0; i < entries.length; i++) sizeEntry(entries[i], st.view);
}

function onLost(e: Event): void {
  e.preventDefault();
  dropRenderer(false);
  bound = null; // the next frame rebinds every lot to the software path, which lasts until the last lot is released
  schedule();
}

function dropRenderer(loseContext: boolean): void {
  if (offscreen) offscreen.removeEventListener('webglcontextlost', onLost);
  if (renderer) renderer.dispose(loseContext ? { loseContext: true } : undefined);
  renderer = null;
  offscreen = null;
}

const onVisibility = (): void => {
  last = 0;
  schedule();
};

function startUp(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  const gl = createGLRenderer(canvas);
  if (gl) {
    renderer = gl;
    offscreen = canvas;
    canvas.addEventListener('webglcontextlost', onLost);
  }
  bound = null;
  styleSeen = null;
  unobserveTheme = observeTheme(schedule);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
}

function shutDown(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  last = 0;
  lifeMs = 0;
  if (unobserveTheme) unobserveTheme();
  unobserveTheme = null;
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  dropRenderer(true);
  bound = null;
  raster = null;
}

function softwareBuffer(view: View): { buffer: RasterBuffer; image: ImageData } | null {
  if (typeof ImageData !== 'function') return null;
  if (!raster || raster.view !== view) {
    const buffer = createRasterBuffer(view.BW, view.BH);
    raster = { view, buffer, image: new ImageData(new Uint8ClampedArray(buffer.buf.buffer), view.BW, view.BH) };
  }
  return raster;
}

function draw(e: Entry, st: Stage, sc: Scene, tick: number, reduce: boolean): void {
  const target = e.target;
  const it = target.kind === 'building' ? sc.buildings[target.index] : null;
  // A target from before a repo list change can be out of range for one frame, until its card re-targets it.
  if (target.kind === 'building' ? !it : target.park >= sc.parks.length) return;
  if (it && !reduce && (e.lifeScene !== sc || e.lifeTarget !== target || e.lifeTick !== tick)) {
    e.lifeScene = sc;
    e.lifeTarget = target;
    e.lifeTick = tick;
    e.lifeList = lotPuffs(sc, it, tick);
    e.lifeData = renderer ? lifeInstanceData(e.lifeList) : null;
  }
  const smoking = it && !reduce;
  if (renderer && offscreen) {
    renderer.drawLot(sc, target, e.theta, st.view, { life: smoking ? e.lifeData : null });
    e.ctx.clearRect(0, 0, e.canvas.width, e.canvas.height);
    e.ctx.drawImage(offscreen, 0, 0);
  } else {
    const soft = softwareBuffer(st.view);
    if (!soft) return;
    rasterizeLot(sc, target, e.theta, st.view, soft.buffer, { life: smoking ? e.lifeList : null });
    e.ctx.putImageData(soft.image, 0, 0);
  }
}

function frame(now: number): void {
  raf = 0;
  const st = stage;
  if (!st || entries.length === 0 || document.visibilityState !== 'visible') {
    last = 0;
    return;
  }
  const reduce = prefersReducedMotion();
  const dt = last ? Math.min(64, now - last) : 0;
  last = now;
  if (bound !== st) bind(st);
  if (!reduce) lifeMs += dt;

  const sc = currentStyle() === 'night' ? st.night : st.maquette;
  if (styleSeen !== sc.key) {
    styleSeen = sc.key;
    for (let i = 0; i < entries.length; i++) entries[i].dirty = true;
  }
  const tick = reduce ? 0 : lifeTick(lifeMs);
  applyBlink(sc, tick);

  const vh = window.innerHeight || document.documentElement.clientHeight;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!reduce) {
      e.speed += ((e.hover ? 5 : 1) - e.speed) * Math.min(1, dt / 240);
      e.theta += dt * TURN_PER_MS * e.speed;
    } else if (!e.dirty) {
      continue;
    }
    const rect = e.canvas.getBoundingClientRect();
    if (rect.bottom < -MARGIN || rect.top > vh + MARGIN) continue;
    draw(e, st, sc, tick, reduce);
    e.dirty = false;
  }
  // Under reduced motion a frame runs only when something asked for one (a new target, the theme, a scroll).
  if (!reduce) schedule();
}

/**
 * Adds a lot drawn into `canvas`. Returns null when the canvas has no 2D context (jsdom). `seed` fixes the
 * angle the lot starts at, so cards do not turn in unison.
 */
export function acquireLot(canvas: HTMLCanvasElement, repos: CityRepo[], target: LotTarget, seed: string): LotHandle | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const st = stageFor(repos);
  if (entries.length === 0) startUp();
  const entry: Entry = {
    canvas,
    ctx,
    target,
    theta: 0.62 + (hash(seed) % 628) / 100,
    speed: 1,
    hover: false,
    dirty: true,
    lifeScene: null,
    lifeTarget: null,
    lifeTick: -1,
    lifeList: [],
    lifeData: null,
  };
  entries.push(entry);
  if (bound !== st) bind(st);
  else sizeEntry(entry, st.view);
  schedule();

  return {
    setTarget(next) {
      if (entries.indexOf(entry) < 0) return;
      entry.target = next;
      if (stage) sizeEntry(entry, stage.view);
      entry.dirty = true;
      schedule();
    },
    setHover(on) {
      entry.hover = on;
    },
    release() {
      const i = entries.indexOf(entry);
      if (i < 0) return;
      entries.splice(i, 1);
      if (entries.length === 0) shutDown();
    },
  };
}
