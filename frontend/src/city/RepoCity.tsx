import React, { useEffect, useMemo, useRef, useState } from 'react';
import './RepoCity.css';
import CityHint from './CityHint';
import { currentStyle, observeTheme, prefersReducedMotion } from './env';
import { daysSince, formatAge, shortLanguage } from './format';
import { createGLRenderer, GLRenderer, lifeInstanceData } from './gl';
import { viewFor } from './layout';
import { lifeInstances, lifeTick } from './life';
import { createRasterBuffer, pick, rasterize, RasterTarget } from './raster';
import { computeLighting, makeScene, placeItems } from './scene';
import { LifeInstance, Scene } from './types';
import { useCityData } from './useCityData';

type RendererKind = 'webgl2' | 'canvas2d' | 'none';

/** One turn takes 48 seconds. */
const TURN_PER_MS = (2 * Math.PI) / 48000;
const START_THETA = 0.62;

/**
 * The live pixel city of GitHub repos: every repo is a building, drawn with WebGL2 (or a Canvas 2D
 * rasteriser when that is missing). Hover or tap a building for its name, click or tap again to open it.
 */
const RepoCity: React.FC = () => {
  const data = useCityData();
  const repos = data.repos;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLSpanElement | null>(null);
  const metaRef = useRef<HTMLSpanElement | null>(null);
  const focusRef = useRef<(index: number) => void>(() => undefined);
  // The canvas that holds a live WebGL context, so the unmount effect can release it.
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<RendererKind>('none');
  // After a lost context or a failed GL start-up the rest of this mount draws with the 2D fallback.
  const [force2d, setForce2d] = useState(false);

  // Both styles are built up front: the framing needs both, and a theme switch must be instant.
  const scenes = useMemo(() => {
    const now = Date.now();
    const maquette = makeScene(repos, 'maquette', now);
    const night = makeScene(repos, 'night', now);
    return { maquette, night, view: viewFor(maquette, night) };
  }, [repos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const label = labelRef.current;
    const nameEl = nameRef.current;
    const metaEl = metaRef.current;
    if (!canvas || !root || !label || !nameEl || !metaEl) return undefined;
    const { maquette, night, view } = scenes;
    const reduce = prefersReducedMotion();

    let gl: GLRenderer | null = force2d ? null : createGLRenderer(canvas);
    let ctx: CanvasRenderingContext2D | null = null;
    glCanvasRef.current = gl ? canvas : null;
    if (gl) {
      gl.setScene(maquette);
      gl.setScene(night);
    } else {
      ctx = canvas.getContext('2d');
    }
    if (!gl && !ctx) {
      // A canvas that already made a GL context cannot make a 2D one: try once more on a fresh canvas.
      if (force2d) setMode('none');
      else setForce2d(true);
      return undefined;
    }
    setMode(gl ? 'webgl2' : 'canvas2d');

    let raster: RasterTarget | null = null;
    let image: ImageData | null = null;
    if (!gl) {
      canvas.width = view.BW;
      canvas.height = view.BH;
      raster = { ...createRasterBuffer(view.BW, view.BH), view };
      image = new ImageData(new Uint8ClampedArray(raster.buf.buffer), view.BW, view.BH);
    }

    let theta = START_THETA;
    let lifeMs = 0;
    let last = 0;
    let raf = 0;
    let dirty = true;
    let sized = false;
    let lastWidth = 0;
    let scale = 1;
    let artPx = 1;
    let onScreen = true;
    let pointer: { x: number; y: number } | null = null; // mouse or pen, client coordinates
    let touchMode = false;
    let hover = -1; // building index under the mouse
    let selected = -1; // building index selected by a first tap
    let focused = -1; // building index of the focused list link
    let shown = ''; // what the label currently says
    // Cars and smoke are recomputed only when the 8 Hz life tick (or the style) changes.
    let lifeScene: Scene | null = null;
    let lifeAt = -1;
    let lifeList: LifeInstance[] | null = null;
    let lifeData: Float32Array | null = null;

    const sceneNow = () => (currentStyle() === 'night' ? night : maquette);
    const active = (): number => (hover >= 0 ? hover : selected >= 0 ? selected : focused);
    const wants = (): boolean => onScreen && document.visibilityState === 'visible';

    const frame = (now: number): void => {
      raf = 0;
      if (!wants()) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(64, now - last) : 0;
      last = now;
      if (!reduce) {
        lifeMs += dt;
        if (active() < 0) theta += dt * TURN_PER_MS;
      }
      if (!reduce || dirty) {
        render();
        dirty = false;
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    const start = (): void => {
      if (!raf && wants()) raf = requestAnimationFrame(frame);
    };
    /** Under reduced motion nothing redraws by itself: anything that changes the picture asks for one frame. */
    const invalidate = (): void => {
      dirty = true;
      start();
    };

    /** The building index at a client position, or -1. */
    const pickAt = (clientX: number, clientY: number): number => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return -1;
      const ax = ((clientX - r.left) * view.BW) / r.width;
      const ay = ((clientY - r.top) * view.BH) / r.height;
      return pick(sceneNow(), theta, view.cx, view.cy, view.BW, view.BH, ax, ay) - 1;
    };

    const updateLabel = (scene: Scene, index: number): void => {
      const it = index >= 0 ? scene.buildings[index] : null;
      if (!it || !it.repo) {
        label.hidden = true;
        shown = '';
        return;
      }
      const r = it.repo;
      const text = r.name + '|' + shortLanguage(r.language) + '|' + formatAge(daysSince(r.pushedAt, Date.now()));
      if (text !== shown) {
        shown = text;
        nameEl.textContent = r.name + ' ';
        metaEl.textContent = '· ' + shortLanguage(r.language) + ' · pushed ' + formatAge(daysSince(r.pushedAt, Date.now()));
      }
      label.hidden = false;
      label.classList.toggle('repo-city__label--tap', selected >= 0 && hover < 0);
      const placed = placeItems(scene, theta, view.cx, view.cy);
      for (let i = 0; i < placed.length; i++) {
        if (placed[i].index !== index) continue;
        const half = label.offsetWidth / 2;
        const left = canvas.offsetLeft + placed[i].sx * scale;
        label.style.left = Math.max(half, Math.min(root.clientWidth - half, left)) + 'px';
        label.style.top = canvas.offsetTop + (placed[i].sy - it.top) * scale - 12 + 'px';
        break;
      }
    };

    const render = (): void => {
      if (!sized) return;
      const scene = sceneNow();
      if (pointer) hover = pickAt(pointer.x, pointer.y);
      const a = active();
      canvas.style.cursor = hover >= 0 ? 'pointer' : 'default';
      if (!reduce) {
        const tick = lifeTick(lifeMs);
        if (scene !== lifeScene || tick !== lifeAt) {
          lifeScene = scene;
          lifeAt = tick;
          lifeList = lifeInstances(scene, tick);
          lifeData = gl ? lifeInstanceData(lifeList) : null;
        }
      }
      if (gl) {
        computeLighting(scene, theta, lifeMs);
        // The GL id of building i is i + 2 (1 is ground, trees and life).
        gl.draw(scene, theta, view, { hoverId: a >= 0 ? a + 2 : 0, artPx, life: lifeData });
      } else if (raster && ctx && image) {
        // The software id of building i is i + 1 (0 is ground, trees and life).
        rasterize(scene, theta, lifeMs, raster, { hoverId: a >= 0 ? a + 1 : 0, life: lifeList });
        ctx.putImageData(image, 0, 0);
      }
      updateLabel(scene, a);
    };

    const open = (index: number): void => {
      const it = sceneNow().buildings[index];
      if (it && it.repo) window.open(it.repo.url, '_blank', 'noopener');
    };

    const fit = (): void => {
      const w = root.clientWidth;
      if (w <= 0 || w === lastWidth) return;
      lastWidth = w;
      const maxH = w < 768 ? 360 : 520;
      scale = Math.min(w / view.BW, maxH / view.BH);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = view.BW * scale + 'px';
      canvas.style.height = view.BH * scale + 'px';
      if (gl) {
        artPx = Math.max(1, Math.round(scale * dpr));
        gl.resize(Math.round(view.BW * scale * dpr), Math.round(view.BH * scale * dpr));
      }
      sized = true;
      invalidate();
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') return;
      touchMode = false;
      selected = -1;
      pointer = { x: e.clientX, y: e.clientY };
      invalidate();
    };
    const onPointerDown = (e: PointerEvent): void => {
      touchMode = e.pointerType === 'touch';
    };
    const onPointerLeave = (e: PointerEvent): void => {
      // The pointerleave that follows a touch would clear the selection as the finger lifts.
      if (e.pointerType === 'touch') return;
      pointer = null;
      hover = -1;
      invalidate();
    };
    const onClick = (e: MouseEvent): void => {
      const hit = pickAt(e.clientX, e.clientY);
      if (!touchMode) {
        if (hit >= 0) open(hit);
        return;
      }
      // Touch: the first tap selects, a second tap on the same building opens it, ground clears.
      if (hit < 0) {
        selected = -1;
        invalidate();
      } else if (hit !== selected) {
        selected = hit;
        invalidate();
      } else {
        open(hit);
      }
    };
    const onLabelClick = (): void => {
      if (selected >= 0) open(selected);
    };
    const onLost = (e: Event): void => {
      e.preventDefault();
      if (gl) gl.dispose();
      gl = null;
      glCanvasRef.current = null; // the context is already lost: nothing left to release
      setForce2d(true);
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('click', onClick);
    label.addEventListener('click', onLabelClick);
    canvas.addEventListener('webglcontextlost', onLost);
    focusRef.current = (index: number): void => {
      focused = index;
      invalidate();
    };

    let ro: ResizeObserver | null = null;
    const onWindowResize = (): void => fit();
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(fit);
      ro.observe(root);
    } else {
      window.addEventListener('resize', onWindowResize);
    }
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) invalidate();
      });
      io.observe(root);
    }
    const unobserveTheme = observeTheme(invalidate);
    const onVisibility = (): void => start();
    document.addEventListener('visibilitychange', onVisibility);

    fit();
    start();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', onWindowResize);
      if (io) io.disconnect();
      unobserveTheme();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
      label.removeEventListener('click', onLabelClick);
      canvas.removeEventListener('webglcontextlost', onLost);
      focusRef.current = () => undefined;
      if (gl) gl.dispose();
    };
  }, [scenes, force2d]);

  // Release the WebGL context on a real unmount. The effect above also cleans up when `scenes` or `force2d`
  // change, and StrictMode mounts twice; both reuse the same canvas, and a canvas whose context was
  // deliberately lost hands the lost context back. So wait one task: a canvas that is still in the
  // document was only re-mounted. The effect's own `webglcontextlost` listener is gone by then.
  useEffect(() => {
    const holder = glCanvasRef;
    return () => {
      setTimeout(() => {
        const canvas = holder.current;
        if (!canvas || canvas.isConnected) return;
        holder.current = null;
        const g = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
        const ext = g && g.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }, 0);
    };
  }, []);

  const listed = scenes.maquette.buildings;
  return (
    <div className="repo-city-block">
      <div
        className="repo-city"
        role="group"
        aria-label="City of my GitHub repositories"
        data-renderer={mode}
        data-buildings={listed.length}
        ref={rootRef}
      >
        <canvas
          key={force2d ? 'pixel' : 'gl'}
          className={'repo-city__canvas' + (mode === 'canvas2d' ? ' repo-city__canvas--pixel' : '')}
          style={mode === 'none' ? { display: 'none' } : undefined}
          aria-hidden="true"
          ref={canvasRef}
        />
        <div className="repo-city__label" hidden ref={labelRef}>
          <span className="repo-city__label-name" ref={nameRef} />
          <span className="repo-city__label-meta" ref={metaRef} />
        </div>
        <ul className="repo-city__list">
          {listed.map((it, i) => {
            const repo = it.repo;
            if (!repo) return null;
            return (
              <li key={repo.name}>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onFocus={() => focusRef.current(i)}
                  onBlur={() => focusRef.current(-1)}
                >
                  {repo.name}, {repo.language}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      {mode !== 'none' && <CityHint />}
    </div>
  );
};

export default RepoCity;
