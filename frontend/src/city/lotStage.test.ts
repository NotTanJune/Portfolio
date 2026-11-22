import { createGLRenderer } from './gl';
import { LOT_K } from './layout';
import { acquireLot, LotHandle, lotLayout, lotRendererKind, lotTargetFor } from './lotStage';
import { PARK_COUNT } from './parks';
import * as raster from './raster';
import * as sceneModule from './scene';
import { NOW, snapshotRepos } from './test-helpers';
import { LotTarget } from './types';

// jsdom has no WebGL, so the renderer is replaced; everything else in the stage is real.
jest.mock('./gl', () => ({ ...jest.requireActual('./gl'), createGLRenderer: jest.fn() }));
const createGL = createGLRenderer as unknown as jest.Mock;

const repos = snapshotRepos();
const scene = sceneModule.makeScene(repos, 'maquette', NOW);
const ventIndex = scene.buildings.findIndex((b) => !!b.vent);
const plainIndex = scene.buildings.findIndex((b) => !b.vent);
const building = (index: number): LotTarget => ({ kind: 'building', index });
const park = (n: number): LotTarget => ({ kind: 'park', park: n });

describe('lotTargetFor and lotLayout', () => {
  it('picks a building by repo name, ignoring case, and otherwise a park', () => {
    const t = lotTargetFor(repos, 'locator', 0);
    expect(t.kind).toBe('building');
    expect(lotTargetFor(repos, 'LoCaToR', 0)).toEqual(t);
    expect(scene.buildings[(t as { index: number }).index].repo!.name.toLowerCase()).toBe('locator');
    expect(lotTargetFor(repos, null, 3)).toEqual(park(3));
    expect(lotTargetFor(repos, 'no-such-repo', 4)).toEqual(park(4));
    // a park number past the last design wraps
    expect(lotTargetFor(repos, null, PARK_COUNT + 1)).toEqual(park(1));
  });

  it('gives every lot the same 60 px wide canvas and a visible height that grows with the building', () => {
    const layouts = scene.buildings.map((_, i) => lotLayout(repos, building(i)));
    const parks = [0, 1, 2, 3, 4, 5].map((p) => lotLayout(repos, park(p)));
    const all = layouts.concat(parks);
    all.forEach((l) => {
      expect(l.width).toBe(60);
      expect(l.canvasHeight).toBe(all[0].canvasHeight);
      expect(l.height).toBeGreaterThan(0);
      expect(l.height).toBeLessThanOrEqual(l.canvasHeight + 4);
    });
    const tops = scene.buildings.map((b) => b.top);
    const tall = tops.indexOf(Math.max.apply(null, tops));
    const short = tops.indexOf(Math.min.apply(null, tops));
    expect(layouts[tall].height).toBeGreaterThan(layouts[short].height);
  });

  it('rebuilds its scenes only when the repo list is a different array', () => {
    const spy = jest.spyOn(sceneModule, 'makeScene');
    const list = repos.slice();
    lotLayout(list, park(0));
    expect(spy).toHaveBeenCalledTimes(2); // maquette and night
    lotLayout(list, park(1));
    lotTargetFor(list, 'locator', 0);
    expect(spy).toHaveBeenCalledTimes(2);
    lotLayout(list.slice(), park(0));
    expect(spy).toHaveBeenCalledTimes(4);
    spy.mockRestore();
  });
});

describe('the lot stage', () => {
  // A hand-driven animation frame clock, so every test says exactly how much time passes.
  let queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
  let clock = 1000;
  let nextId = 1;
  const realRaf = window.requestAnimationFrame;
  const realCaf = window.cancelAnimationFrame;
  const step = (frames = 1, ms = 16): void => {
    for (let i = 0; i < frames; i++) {
      clock += ms;
      const run = queue;
      queue = [];
      run.forEach((q) => q.cb(clock));
    }
  };

  interface FakeCtx { clearRect: jest.Mock; drawImage: jest.Mock; putImageData: jest.Mock; image: Uint8ClampedArray | null }
  const contexts = new WeakMap<HTMLCanvasElement, FakeCtx>();
  const ctxOf = (canvas: HTMLCanvasElement): FakeCtx => contexts.get(canvas) as FakeCtx;
  let rect = { top: 100, bottom: 200 };
  const realImageData = (global as { ImageData?: unknown }).ImageData;
  const realMatchMedia = window.matchMedia;
  const realDpr = window.devicePixelRatio;
  const handles: LotHandle[] = [];

  const lotCanvas = (): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    return canvas;
  };
  const add = (target: LotTarget, seed: string): { canvas: HTMLCanvasElement; handle: LotHandle } => {
    const canvas = lotCanvas();
    const handle = acquireLot(canvas, repos, target, seed) as LotHandle;
    handles.push(handle);
    return { canvas, handle };
  };
  const opaque = (image: Uint8ClampedArray | null): number => {
    let n = 0;
    for (let i = 3; i < (image as Uint8ClampedArray).length; i += 4) if ((image as Uint8ClampedArray)[i]) n++;
    return n;
  };
  const same = (a: Uint8ClampedArray | null, b: Uint8ClampedArray | null): boolean => {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  beforeEach(() => {
    queue = [];
    clock = 1000;
    nextId = 1;
    rect = { top: 100, bottom: 200 };
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => { queue.push({ id: nextId, cb }); return nextId++; }) as never;
    window.cancelAnimationFrame = ((id: number) => { queue = queue.filter((q) => q.id !== id); }) as never;
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function ctx(this: HTMLCanvasElement, type: string) {
      if (type !== '2d') return null;
      if (!contexts.has(this)) {
        const c: FakeCtx = { clearRect: jest.fn(), drawImage: jest.fn(), putImageData: jest.fn(), image: null };
        c.putImageData.mockImplementation((image: { data: Uint8ClampedArray }) => { c.image = Uint8ClampedArray.from(image.data as unknown as number[]); });
        contexts.set(this, c);
      }
      return contexts.get(this) as never;
    } as never);
    jest.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation((() => ({
      top: rect.top, bottom: rect.bottom, left: 0, right: 60, width: 60, height: rect.bottom - rect.top, x: 0, y: rect.top, toJSON: () => ({}),
    })) as never);
    (global as { ImageData?: unknown }).ImageData = class {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, w: number, h: number) { this.data = data; this.width = w; this.height = h; }
    };
    createGL.mockReset();
    createGL.mockReturnValue(null);
  });
  afterEach(() => {
    handles.splice(0).forEach((h) => h.release());
    jest.restoreAllMocks();
    window.requestAnimationFrame = realRaf;
    window.cancelAnimationFrame = realCaf;
    window.matchMedia = realMatchMedia;
    (global as { ImageData?: unknown }).ImageData = realImageData;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: realDpr });
    document.documentElement.removeAttribute('data-theme');
    document.body.innerHTML = '';
  });

  it('returns null for a canvas with no 2D context (jsdom)', () => {
    (HTMLCanvasElement.prototype.getContext as jest.Mock).mockReturnValue(null);
    expect(acquireLot(document.createElement('canvas'), repos, park(0), 's')).toBeNull();
    expect(lotRendererKind()).toBe('none');
    expect(queue).toHaveLength(0);
  });

  describe('without WebGL (the software path)', () => {
    it('draws a building on its plate into a pixel canvas sized in art pixels', () => {
      const layout = lotLayout(repos, building(ventIndex));
      const { canvas } = add(building(ventIndex), 'seed');
      expect(lotRendererKind()).toBe('canvas2d');
      expect(canvas.width).toBe(layout.width / LOT_K);
      expect(canvas.height).toBe(layout.canvasHeight / LOT_K);
      expect(canvas.classList.contains('project-lot__canvas--pixel')).toBe(true);
      expect(ctxOf(canvas).putImageData).not.toHaveBeenCalled();
      step();
      expect(ctxOf(canvas).putImageData).toHaveBeenCalledTimes(1);
      expect(opaque(ctxOf(canvas).image)).toBeGreaterThan(150);
    });

    it('turns every lot from its own starting angle, and five times faster while hovered', () => {
      const a = add(building(plainIndex), 'alpha');
      const b = add(building(plainIndex), 'alpha');
      const c = add(building(plainIndex), 'beta');
      step();
      // the same seed starts at the same angle, another seed does not
      expect(same(ctxOf(a.canvas).image, ctxOf(b.canvas).image)).toBe(true);
      expect(same(ctxOf(a.canvas).image, ctxOf(c.canvas).image)).toBe(false);
      step(30);
      expect(same(ctxOf(a.canvas).image, ctxOf(b.canvas).image)).toBe(true);
      const before = ctxOf(a.canvas).image;
      step(3);
      expect(same(before, ctxOf(a.canvas).image)).toBe(false); // it keeps turning
      b.handle.setHover(true);
      step(30);
      expect(same(ctxOf(a.canvas).image, ctxOf(b.canvas).image)).toBe(false);
      b.handle.setHover(false);
    });

    it('gives a building with a vent its three smoke puffs and a park none', () => {
      const spy = jest.spyOn(raster, 'rasterizeLot');
      add(building(ventIndex), 'v');
      add(building(plainIndex), 'p');
      add(park(2), 'k');
      step();
      expect(spy).toHaveBeenCalledTimes(3);
      expect((spy.mock.calls[0][5].life as unknown[]).length).toBe(3);
      expect((spy.mock.calls[1][5].life as unknown[]).length).toBe(0);
      expect(spy.mock.calls[2][5].life).toBeNull();
      expect(spy.mock.calls[2][1]).toEqual(park(2));
    });

    it('draws something else after setTarget', () => {
      const { canvas, handle } = add(building(plainIndex), 's');
      step();
      const first = ctxOf(canvas).image;
      handle.setTarget(park(1));
      step();
      expect(ctxOf(canvas).putImageData).toHaveBeenCalledTimes(2);
      expect(same(first, ctxOf(canvas).image)).toBe(false);
      expect(opaque(ctxOf(canvas).image)).toBeGreaterThan(150);
    });

    it('skips a lot that is more than 40 px outside the viewport, and draws it again once it is close', () => {
      const { canvas } = add(building(plainIndex), 's');
      rect = { top: -400, bottom: -41 };
      step(3);
      expect(ctxOf(canvas).putImageData).not.toHaveBeenCalled();
      rect = { top: -400, bottom: -39 };
      step();
      expect(ctxOf(canvas).putImageData).toHaveBeenCalledTimes(1);
      rect = { top: window.innerHeight + 41, bottom: window.innerHeight + 200 };
      step(3);
      expect(ctxOf(canvas).putImageData).toHaveBeenCalledTimes(1);
    });

    it('stops its loop when the last lot is released and draws nothing afterwards', () => {
      const a = add(park(0), 'a');
      const b = add(park(1), 'b');
      step(2);
      a.handle.release();
      expect(queue).toHaveLength(1); // b is still turning
      const puts = ctxOf(b.canvas).putImageData.mock.calls.length;
      step();
      expect(ctxOf(b.canvas).putImageData.mock.calls.length).toBe(puts + 1);
      b.handle.release();
      expect(queue).toHaveLength(0);
      expect(lotRendererKind()).toBe('none');
      step(3);
      expect(ctxOf(b.canvas).putImageData.mock.calls.length).toBe(puts + 1);
      a.handle.release(); // releasing twice is harmless
      a.handle.setTarget(park(2));
      expect(queue).toHaveLength(0);
    });

    it('pauses while the tab is hidden and resumes when it shows again', () => {
      const { canvas } = add(park(0), 'a');
      step(2);
      const hidden = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      step();
      expect(queue).toHaveLength(0);
      const puts = ctxOf(canvas).putImageData.mock.calls.length;
      step(3);
      expect(ctxOf(canvas).putImageData.mock.calls.length).toBe(puts);
      hidden.mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(queue).toHaveLength(1);
      step();
      expect(ctxOf(canvas).putImageData.mock.calls.length).toBe(puts + 1);
    });

    it('under reduced motion draws once, never turns, and redraws only for a new target, theme or scroll', async () => {
      window.matchMedia = ((q: string) => ({ matches: q.indexOf('reduce') >= 0 })) as never;
      const spy = jest.spyOn(raster, 'rasterizeLot');
      const { canvas, handle } = add(building(ventIndex), 'seed');
      step();
      const ctx = ctxOf(canvas);
      expect(ctx.putImageData).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][5].life).toBeNull(); // no smoke
      const still = ctx.image;
      expect(queue).toHaveLength(0); // no loop is left running
      step(60);
      handle.setHover(true);
      step(60);
      expect(ctx.putImageData).toHaveBeenCalledTimes(1);

      handle.setTarget(park(3));
      expect(queue).toHaveLength(1);
      step();
      expect(ctx.putImageData).toHaveBeenCalledTimes(2);
      expect(same(still, ctx.image)).toBe(false);

      const light = ctx.image;
      document.documentElement.setAttribute('data-theme', 'dark');
      await Promise.resolve(); // MutationObserver callbacks run as microtasks
      step();
      expect(ctx.putImageData).toHaveBeenCalledTimes(3);
      expect(same(light, ctx.image)).toBe(false);

      window.dispatchEvent(new Event('scroll'));
      step();
      expect(ctx.putImageData).toHaveBeenCalledTimes(3); // nothing was waiting to be drawn
    });

    it('draws a lot that was off screen when it was acquired once it scrolls into view, under reduced motion', () => {
      window.matchMedia = ((q: string) => ({ matches: q.indexOf('reduce') >= 0 })) as never;
      rect = { top: 2000, bottom: 2100 };
      const { canvas } = add(park(0), 'a');
      step();
      expect(ctxOf(canvas).putImageData).not.toHaveBeenCalled();
      rect = { top: 300, bottom: 400 };
      window.dispatchEvent(new Event('scroll'));
      step();
      expect(ctxOf(canvas).putImageData).toHaveBeenCalledTimes(1);
    });
  });

  describe('with WebGL (a fake renderer, the one context for every lot)', () => {
    const fakeRenderer = () => ({
      setScene: jest.fn(), resize: jest.fn(), draw: jest.fn(), drawLot: jest.fn(), dispose: jest.fn(),
    });

    it('creates exactly one context for 18 lots and copies each lot out of the offscreen canvas', () => {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
      const gl = fakeRenderer();
      createGL.mockReturnValue(gl);
      const canvases: HTMLCanvasElement[] = [];
      for (let i = 0; i < 18; i++) canvases.push(add(i < 12 ? building(i) : park(i - 12), 'lot' + i).canvas);
      expect(createGL).toHaveBeenCalledTimes(1);
      const offscreen = createGL.mock.calls[0][0] as HTMLCanvasElement;
      expect(offscreen.isConnected).toBe(false);
      expect(canvases.indexOf(offscreen)).toBe(-1);
      expect(lotRendererKind()).toBe('webgl2');

      // both styles' scenes were handed over, and everything is sized for device pixels, capped at 2x
      expect(gl.setScene.mock.calls.map((c) => c[0].key).sort()).toEqual(['maquette', 'night']);
      const layout = lotLayout(repos, park(0));
      const w = layout.width * 2;
      const h = layout.canvasHeight * 2;
      expect(gl.resize).toHaveBeenLastCalledWith(w, h);
      canvases.forEach((c) => {
        expect(c.width).toBe(w);
        expect(c.height).toBe(h);
        expect(c.classList.contains('project-lot__canvas--pixel')).toBe(false);
      });

      step();
      expect(gl.drawLot).toHaveBeenCalledTimes(18);
      canvases.forEach((c) => {
        expect(ctxOf(c).clearRect).toHaveBeenCalledTimes(1);
        expect(ctxOf(c).drawImage).toHaveBeenCalledWith(offscreen, 0, 0);
      });
      // the first twelve are buildings, the rest are parks; a vent building brings its smoke, a park none
      expect(gl.drawLot.mock.calls[12][1]).toEqual(park(0));
      expect(gl.drawLot.mock.calls[12][4].life).toBeNull();
      const ventCall = gl.drawLot.mock.calls.filter((c) => c[1].kind === 'building' && scene.buildings[c[1].index].vent)[0];
      expect(ventCall[4].life).toBeInstanceOf(Float32Array);
      expect(ventCall[4].life.length).toBeGreaterThan(0);
      expect(gl.drawLot.mock.calls[0][0].key).toBe('maquette');
    });

    it('draws from the night scene when the site is dark', () => {
      const gl = fakeRenderer();
      createGL.mockReturnValue(gl);
      add(park(0), 'a');
      step();
      expect(gl.drawLot.mock.calls[0][0].key).toBe('maquette');
      document.documentElement.setAttribute('data-theme', 'dark');
      step();
      expect(gl.drawLot.mock.calls[1][0].key).toBe('night');
    });

    it('frees the context only when the last lot goes, and makes a new one for the next visit', () => {
      const first = fakeRenderer();
      const second = fakeRenderer();
      createGL.mockReturnValueOnce(first).mockReturnValueOnce(second);
      const a = add(park(0), 'a');
      const b = add(park(1), 'b');
      a.handle.release();
      expect(first.dispose).not.toHaveBeenCalled();
      b.handle.release();
      expect(first.dispose).toHaveBeenCalledTimes(1);
      expect(first.dispose).toHaveBeenCalledWith({ loseContext: true });
      expect(lotRendererKind()).toBe('none');
      expect(queue).toHaveLength(0);

      add(park(2), 'c');
      expect(createGL).toHaveBeenCalledTimes(2);
      step();
      expect(second.drawLot).toHaveBeenCalledTimes(1);
      expect(first.drawLot).not.toHaveBeenCalled();
    });

    it('switches every lot to the software path when the context is lost', () => {
      const gl = fakeRenderer();
      createGL.mockReturnValue(gl);
      const a = add(building(plainIndex), 'a');
      const b = add(park(1), 'b');
      step();
      expect(gl.drawLot).toHaveBeenCalledTimes(2);
      const offscreen = createGL.mock.calls[0][0] as HTMLCanvasElement;
      const lost = new Event('webglcontextlost', { cancelable: true });
      offscreen.dispatchEvent(lost);
      expect(lost.defaultPrevented).toBe(true);
      expect(gl.dispose).toHaveBeenCalledTimes(1);
      expect(gl.dispose).toHaveBeenCalledWith(undefined);
      expect(lotRendererKind()).toBe('canvas2d');
      step();
      const layout = lotLayout(repos, park(0));
      [a, b].forEach((l) => {
        expect(l.canvas.width).toBe(layout.width / LOT_K);
        expect(l.canvas.height).toBe(layout.canvasHeight / LOT_K);
        expect(l.canvas.classList.contains('project-lot__canvas--pixel')).toBe(true);
        expect(ctxOf(l.canvas).putImageData).toHaveBeenCalledTimes(1);
        expect(opaque(ctxOf(l.canvas).image)).toBeGreaterThan(150);
      });
      expect(gl.drawLot).toHaveBeenCalledTimes(2);
      a.handle.release();
      b.handle.release();
      expect(gl.dispose).toHaveBeenCalledTimes(1); // nothing left to free
    });

    it('rebuilds the scenes in the renderer, and resizes, when the repo list changes', () => {
      const gl = fakeRenderer();
      createGL.mockReturnValue(gl);
      const { handle } = add(park(0), 'a');
      step();
      const fewer = repos.slice(0, 12);
      lotLayout(fewer, park(0)); // a card rendering with the new list builds the new scenes first
      handle.setTarget(park(1));
      step();
      expect(gl.setScene).toHaveBeenCalledTimes(4);
      expect(gl.drawLot.mock.calls[1][0]).not.toBe(gl.drawLot.mock.calls[0][0]);
      expect(gl.drawLot).toHaveBeenCalledTimes(2);
      gl.resize.mock.calls.forEach((c) => expect(c.length).toBe(2));
    });
  });
});
