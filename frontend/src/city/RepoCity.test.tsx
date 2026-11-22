/* The city is a canvas plus a label: there are no roles or text to query it by, so these tests read the DOM directly. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as glModule from './gl';
import RepoCity from './RepoCity';
import { viewFor } from './layout';
import { makeScene } from './scene';
import { NOW, snapshotRepos } from './test-helpers';
import { SQ } from './layout';

const repos = snapshotRepos();

describe('RepoCity without any canvas context (jsdom)', () => {
  beforeEach(() => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    (global as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('offline')));
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders one list link per repo, all to github.com, and no hint', async () => {
    const { container } = render(<RepoCity />);
    const city = container.querySelector('.repo-city') as HTMLElement;
    await waitFor(() => expect(city.dataset.renderer).toBe('none'));
    const links = Array.from(container.querySelectorAll('.repo-city__list a')) as HTMLAnchorElement[];
    expect(links).toHaveLength(repos.length);
    expect(Number(city.dataset.buildings)).toBe(repos.length);
    links.forEach((a) => {
      expect(a.href.indexOf('https://github.com/')).toBe(0);
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
    });
    expect(links.map((a) => a.textContent).sort()).toEqual(repos.map((r) => r.name + ', ' + r.language).sort());
    expect(container.querySelector('.repo-city-hint')).toBeNull();
    expect(screen.getByRole('group', { name: 'City of my GitHub repositories' })).toBe(city);
  });
});

describe('RepoCity with a 2D context (the software fallback)', () => {
  const maquette = makeScene(repos, 'maquette', NOW);
  const night = makeScene(repos, 'night', NOW);
  const view = viewFor(maquette, night);
  const THETA = 0.62;
  const putImageData = jest.fn();
  let opened: string[] = [];
  const realMatchMedia = window.matchMedia;
  const realImageData = (global as { ImageData?: unknown }).ImageData;
  const realPointerEvent = (window as { PointerEvent?: unknown }).PointerEvent;

  beforeEach(() => {
    putImageData.mockClear();
    opened = [];
    const ctx = { putImageData, clearRect: jest.fn(), fillRect: jest.fn(), fillStyle: '' };
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) => (type === '2d' ? ctx : null)) as never);
    jest.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLCanvasElement) {
      const w = parseFloat(this.style.width) || 0;
      const h = parseFloat(this.style.height) || 0;
      return { left: 0, top: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 });
    jest.spyOn(window, 'open').mockImplementation(((url: string) => { opened.push(url); return null; }) as never);
    (global as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('offline')));
    // A device that cannot hover, with reduced motion: the angle stays at its start value.
    window.matchMedia = ((q: string) => ({ matches: q.indexOf('reduce') >= 0 || q.indexOf('hover: none') >= 0 })) as never;
    (global as { ImageData?: unknown }).ImageData = class {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, w: number, h: number) { this.data = data; this.width = w; this.height = h; }
    };
    (window as { PointerEvent?: unknown }).PointerEvent = class extends MouseEvent {
      pointerType: string;
      constructor(type: string, init: MouseEventInit & { pointerType?: string }) { super(type, init); this.pointerType = init.pointerType || 'mouse'; }
    };
  });
  afterEach(() => {
    jest.restoreAllMocks();
    window.matchMedia = realMatchMedia;
    (global as { ImageData?: unknown }).ImageData = realImageData;
    (window as { PointerEvent?: unknown }).PointerEvent = realPointerEvent;
    delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
  });

  /** Client coordinates of the roof of the tallest building at the start angle. */
  const roofOfTallest = (scale: number) => {
    const tops = maquette.buildings.map((b) => b.top);
    const index = tops.indexOf(Math.max.apply(null, tops));
    const roof = maquette.buildings[index].roof!;
    const x = view.cx + Math.cos(THETA) * roof.x - Math.sin(THETA) * roof.y;
    const y = view.cy + (Math.sin(THETA) * roof.x + Math.cos(THETA) * roof.y) * SQ - roof.z;
    return { index, x: x * scale, y: y * scale };
  };

  it('draws the city with the rasteriser, shows the hint, and sizes the canvas from the wrapper', async () => {
    const { container } = render(<RepoCity />);
    const city = container.querySelector('.repo-city') as HTMLElement;
    const canvas = container.querySelector('.repo-city__canvas') as HTMLCanvasElement;
    await waitFor(() => expect(putImageData).toHaveBeenCalled());
    expect(city.dataset.renderer).toBe('canvas2d');
    expect(canvas.className).toContain('repo-city__canvas--pixel');
    expect(canvas.width).toBe(view.BW);
    expect(canvas.height).toBe(view.BH);
    // 1000 px wide wrapper: the height cap of 520 px decides the scale
    const scale = Math.min(1000 / view.BW, 520 / view.BH);
    expect(parseFloat(canvas.style.width)).toBeCloseTo(view.BW * scale, 3);
    expect(parseFloat(canvas.style.height)).toBeCloseTo(view.BH * scale, 3);
    const image = putImageData.mock.calls[0][0] as { data: Uint8ClampedArray };
    let opaque = 0;
    for (let i = 3; i < image.data.length; i += 4) if (image.data[i]) opaque++;
    expect(opaque).toBeGreaterThan(2000);
    expect(container.querySelectorAll('.repo-city-hint li')).toHaveLength(4);
  });

  it('follows the touch rule: first tap names the building, second tap opens it, ground clears', async () => {
    const { container } = render(<RepoCity />);
    const canvas = container.querySelector('.repo-city__canvas') as HTMLCanvasElement;
    const label = container.querySelector('.repo-city__label') as HTMLElement;
    await waitFor(() => expect(putImageData).toHaveBeenCalled());
    const scale = Math.min(1000 / view.BW, 520 / view.BH);
    const { index, x, y } = roofOfTallest(scale);
    const repo = maquette.buildings[index].repo!;
    const tap = (cx: number, cy: number) => {
      fireEvent.pointerDown(canvas, { pointerType: 'touch', clientX: cx, clientY: cy });
      fireEvent.pointerUp(canvas, { pointerType: 'touch', clientX: cx, clientY: cy });
      fireEvent.click(canvas, { clientX: cx, clientY: cy });
    };

    expect(label.hidden).toBe(true);
    tap(x, y);
    await waitFor(() => expect(label.hidden).toBe(false));
    expect(label.textContent).toContain(repo.name);
    expect(label.textContent).toContain('pushed');
    expect(opened).toHaveLength(0);

    // the pointerleave that follows a finger lifting must not clear the selection
    fireEvent(canvas, new (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent('pointerleave', { pointerType: 'touch' } as never));
    expect(label.hidden).toBe(false);

    tap(x, y);
    expect(opened).toEqual([repo.url]);

    tap(2, 2);
    await waitFor(() => expect(label.hidden).toBe(true));
    expect(opened).toHaveLength(1);
  });

  it('opens a building on one mouse click and names it while hovered', async () => {
    window.matchMedia = ((q: string) => ({ matches: q.indexOf('reduce') >= 0 })) as never;
    const { container } = render(<RepoCity />);
    const canvas = container.querySelector('.repo-city__canvas') as HTMLCanvasElement;
    const label = container.querySelector('.repo-city__label') as HTMLElement;
    await waitFor(() => expect(putImageData).toHaveBeenCalled());
    const scale = Math.min(1000 / view.BW, 520 / view.BH);
    const { index, x, y } = roofOfTallest(scale);
    const repo = maquette.buildings[index].repo!;
    fireEvent.pointerMove(canvas, { pointerType: 'mouse', clientX: x, clientY: y });
    await waitFor(() => expect(label.hidden).toBe(false));
    expect(label.textContent).toContain(repo.name);
    expect(canvas.style.cursor).toBe('pointer');
    fireEvent.pointerDown(canvas, { pointerType: 'mouse', clientX: x, clientY: y });
    fireEvent.click(canvas, { clientX: x, clientY: y });
    expect(opened).toEqual([repo.url]);
    fireEvent(canvas, new (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent('pointerleave', { pointerType: 'mouse' } as never));
    await waitFor(() => expect(label.hidden).toBe(true));
  });
});

describe('RepoCity releases its WebGL context only when it really unmounts', () => {
  const loseContext = jest.fn();
  const dispose = jest.fn();
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  let created: HTMLCanvasElement[] = [];

  beforeEach(() => {
    loseContext.mockClear();
    dispose.mockClear();
    created = [];
    const fakeContext = { getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null) };
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) => (type === 'webgl2' ? fakeContext : null)) as never);
    jest.spyOn(glModule, 'createGLRenderer').mockImplementation((canvas: HTMLCanvasElement) => {
      created.push(canvas);
      return { setScene: jest.fn(), resize: jest.fn(), draw: jest.fn(), drawLot: jest.fn(), dispose };
    });
    (global as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('offline')));
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loses the context exactly once after the canvas leaves the document', async () => {
    const { container, unmount } = render(<RepoCity />);
    const city = container.querySelector('.repo-city') as HTMLElement;
    await waitFor(() => expect(city.dataset.renderer).toBe('webgl2'));
    expect(loseContext).not.toHaveBeenCalled();
    unmount();
    await settle();
    expect(loseContext).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalled();
  });

  it('keeps the context through a StrictMode mount, cleanup and mount, then releases it on unmount', async () => {
    const { container, unmount } = render(<React.StrictMode><RepoCity /></React.StrictMode>);
    const city = container.querySelector('.repo-city') as HTMLElement;
    await waitFor(() => expect(city.dataset.renderer).toBe('webgl2'));
    await settle();
    expect(created.length).toBeGreaterThanOrEqual(2);
    expect(created.every((c) => c === created[0])).toBe(true);
    expect(loseContext).not.toHaveBeenCalled();
    expect(city.dataset.renderer).toBe('webgl2');
    unmount();
    await settle();
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('keeps the context when live data replaces the scenes on the same canvas', async () => {
    const live = { generatedAt: 'now', source: 'live', repos: repos.slice(1) };
    (global as { fetch?: unknown }).fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(live) }));
    const { container, unmount } = render(<RepoCity />);
    const city = container.querySelector('.repo-city') as HTMLElement;
    await waitFor(() => expect(Number(city.dataset.buildings)).toBe(repos.length - 1));
    await settle();
    expect(created.length).toBeGreaterThanOrEqual(2); // the effect re-ran with the new scenes
    expect(created.every((c) => c === created[0])).toBe(true);
    expect(loseContext).not.toHaveBeenCalled();
    expect(city.dataset.renderer).toBe('webgl2');
    unmount();
    await settle();
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
});
