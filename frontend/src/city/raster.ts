import { SQ } from './layout';
import { computeLighting, faceTones, placeItems } from './scene';
import { hex, pack } from './styles';
import { Item, LifeInstance, LotTarget, Model, Scene, View } from './types';

/**
 * Software sprite-stack rasteriser: nearest neighbour, whole art pixels. It is the Canvas 2D fallback when
 * WebGL2 is missing and the picker for the hover label, so it must agree with the GL renderer.
 *
 * Ids written to the id buffer: 0 for ground, trees and life, `buildingIndex + 1` for a building and its
 * emblem. (The GL renderer uses `buildingIndex + 2`, because id 1 is ground there.)
 */

export interface RasterBuffer {
  /** Packed RGBA, `BW * BH`. 0 is transparent. */
  buf: Uint32Array;
  /** One id per pixel, `BW * BH`. */
  ids: Uint8Array;
}

export interface RasterTarget extends RasterBuffer { view: View }

export interface RasterOpts {
  /** Building index + 1 of the hovered building, or 0 for none. */
  hoverId: number;
  life: LifeInstance[] | null;
}

export function createRasterBuffer(BW: number, BH: number): RasterBuffer {
  return { buf: new Uint32Array(BW * BH), ids: new Uint8Array(BW * BH) };
}

/** Where pixels go. `buf` or `ids` may be null; `x0..x1`, `y0..y1` (inclusive) clip every write. */
export interface Surface {
  buf: Uint32Array | null;
  ids: Uint8Array | null;
  BW: number;
  BH: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function fullSurface(buf: Uint32Array | null, ids: Uint8Array | null, BW: number, BH: number): Surface {
  return { buf, ids, BW, BH, x0: 0, y0: 0, x1: BW - 1, y1: BH - 1 };
}

/**
 * Draws one model, slice by slice from the bottom, with its centre at screen (`sx`, `sy`). Every pixel
 * centre is mapped back into model space through the inverse rotation. Like the GL renderer, every slice
 * above the first is also drawn half a cell lower, so one cell wide features do not turn into dots.
 * `shadowMask` (the ground only) makes the top slice show tone 3 where a shadow falls.
 */
export function drawModel(
  s: Surface,
  m: Model,
  sx: number,
  sy: number,
  cos: number,
  sin: number,
  tones: ArrayLike<number>,
  colors: Uint32Array,
  id: number,
  shadowMask: Uint8Array | null,
): void {
  const r = Math.ceil(Math.hypot(m.w, m.d) / 2) + 1;
  const ry = Math.ceil(r * SQ) + 1;
  const hw = m.w / 2;
  const hd = m.d / 2;
  const x0 = Math.max(s.x0, Math.floor(sx - r));
  const x1 = Math.min(s.x1, Math.ceil(sx + r));
  for (let z = 0; z < m.H; z++) {
    const zo = z * m.d;
    for (let step = z > 0 ? 0 : 1; step < 2; step++) {
      const cyz = sy - (step ? z : z - 0.5) - m.z0;
      const y0 = Math.max(s.y0, Math.floor(cyz - ry));
      const y1 = Math.min(s.y1, Math.ceil(cyz + ry));
      const groundTop = step === 1 && shadowMask !== null && z === m.H - 1;
      for (let py = y0; py <= y1; py++) {
        const dy = (py + 0.5 - cyz) / SQ;
        const row = py * s.BW;
        for (let px = x0; px <= x1; px++) {
          const dx = px + 0.5 - sx;
          const mx = Math.floor(cos * dx + sin * dy + hw);
          const my = Math.floor(-sin * dx + cos * dy + hd);
          if (mx < 0 || my < 0 || mx >= m.w || my >= m.d) continue;
          const i = (zo + my) * m.w + mx;
          const mat = m.mat[i];
          if (!mat) continue;
          if (s.buf) {
            const tone = groundTop ? (shadowMask![my * m.w + mx] ? 3 : 0) : tones[m.mask[i]];
            s.buf[row + px] = colors[mat * 4 + tone];
          }
          if (s.ids) s.ids[row + px] = id;
        }
      }
    }
  }
}

/**
 * Draws a 16 by 16 emblem as a flat 8 by 8 cell quad at (`ex`, `ey`) from the origin that sits at screen
 * (`cx`, `cy`), lifted by `ez`. Texels with alpha below 128 are skipped.
 */
export function drawEmblem(
  s: Surface,
  emblem: Uint8Array,
  ex: number,
  ey: number,
  ez: number,
  cx: number,
  cy: number,
  cos: number,
  sin: number,
  id: number,
): void {
  const sx = cx + cos * ex - sin * ey;
  const sy = cy + (sin * ex + cos * ey) * SQ - ez;
  const r = Math.ceil(Math.hypot(8, 8) / 2) + 1;
  const ry = Math.ceil(r * SQ) + 1;
  const x0 = Math.max(s.x0, Math.floor(sx - r));
  const x1 = Math.min(s.x1, Math.ceil(sx + r));
  const y0 = Math.max(s.y0, Math.floor(sy - ry));
  const y1 = Math.min(s.y1, Math.ceil(sy + ry));
  for (let py = y0; py <= y1; py++) {
    const dy = (py + 0.5 - sy) / SQ;
    const row = py * s.BW;
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - sx;
      const lx = cos * dx + sin * dy + 4;
      const ly = -sin * dx + cos * dy + 4;
      if (lx < 0 || ly < 0 || lx >= 8 || ly >= 8) continue;
      const o = (Math.floor(ly * 2) * 16 + Math.floor(lx * 2)) * 4;
      if (emblem[o + 3] < 128) continue;
      if (s.buf) s.buf[row + px] = pack([emblem[o], emblem[o + 1], emblem[o + 2]]);
      if (s.ids) s.ids[row + px] = id;
    }
  }
}

/** One thing to paint, with the screen y that orders it back to front. */
interface Entry {
  key: number;
  sx: number;
  sy: number;
  item: Item | null;
  index: number;
  life: LifeInstance | null;
}

/**
 * Paints the ground, then every tree, building and life instance back to front by screen y, a building's
 * emblem right after the building. `drawLife` is off for `pick`.
 */
function paintCity(
  s: Surface,
  scene: Scene,
  theta: number,
  view: View,
  tones: ArrayLike<number>,
  life: LifeInstance[] | null,
): void {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const entries: Entry[] = placeItems(scene, theta, view.cx, view.cy).map((p) => ({
    key: p.sy, sx: p.sx, sy: p.sy, item: p.item, index: p.index, life: null,
  }));
  if (life) {
    for (let i = 0; i < life.length; i++) {
      const li = life[i];
      const sx = view.cx + cos * li.x - sin * li.y;
      const sy = view.cy + (sin * li.x + cos * li.y) * SQ;
      // Higher things are nearer the camera, as in the GL depth formula (0.8 * y + 0.6 * z, in squashed units).
      entries.push({ key: sy + 0.45 * li.z, sx, sy: sy - li.z, item: null, index: -1, life: li });
    }
  }
  entries.sort((a, b) => a.key - b.key);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.life) {
      drawModel(s, e.life.model, e.sx, e.sy, cos, sin, tones, scene.colors, 0, null);
    } else if (e.item) {
      const it = e.item;
      drawModel(s, it.model, e.sx, e.sy, cos, sin, tones, scene.colors, e.index + 1, null);
      if (it.roof && e.index >= 0) {
        drawEmblem(s, scene.emblems[e.index], it.roof.x, it.roof.y, it.roof.z, view.cx, view.cy, cos, sin, e.index + 1);
      }
    }
  }
}

/** Inks a one pixel outline around the finished stack of the hovered building, once. */
function outline(buf: Uint32Array, ids: Uint8Array, BW: number, BH: number, hoverId: number, ink: number): void {
  for (let y = 1; y < BH - 1; y++) {
    for (let x = 1; x < BW - 1; x++) {
      const p = y * BW + x;
      if (ids[p] !== hoverId && (ids[p - 1] === hoverId || ids[p + 1] === hoverId || ids[p - BW] === hoverId || ids[p + BW] === hoverId)) {
        buf[p] = ink;
      }
    }
  }
}

/**
 * Draws the whole city into `target`: lighting for this angle and time, the ground, then items back to
 * front, then the life instances merged in by depth, then the hover outline.
 */
export function rasterize(scene: Scene, theta: number, timeMs: number, target: RasterTarget, opts: RasterOpts): void {
  const { buf, ids, view } = target;
  buf.fill(0);
  ids.fill(0);
  computeLighting(scene, theta, timeMs);
  const s = fullSurface(buf, ids, view.BW, view.BH);
  drawModel(s, scene.ground, view.cx, view.cy, Math.cos(theta), Math.sin(theta), scene.tones, scene.colors, 0, scene.shadowMask);
  paintCity(s, scene, theta, view, scene.tones, opts.life);
  if (opts.hoverId > 0) outline(buf, ids, view.BW, view.BH, opts.hoverId, pack(hex(scene.style.hoverInk)));
}

let scratchIds: Uint8Array | null = null;

/**
 * The id under art pixel (`x`, `y`): `buildingIndex + 1` for a building or its emblem, 0 for ground, a
 * tree or nothing. Draws ids only, for that one pixel, with no colour writes and no outline.
 */
export function pick(
  scene: Scene,
  theta: number,
  cx: number,
  cy: number,
  BW: number,
  BH: number,
  x: number,
  y: number,
): number {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= BW || py >= BH) return 0;
  if (!scratchIds || scratchIds.length < BW * BH) scratchIds = new Uint8Array(BW * BH);
  const ids = scratchIds;
  ids[py * BW + px] = 0;
  const s: Surface = { buf: null, ids, BW, BH, x0: px, y0: py, x1: px, y1: py };
  paintCity(s, scene, theta, { BW, BH, cx, cy }, scene.tones, null);
  return ids[py * BW + px];
}

/**
 * The fallback for one Projects card: the lot plate (or a park) at the view centre, and for a building
 * its model, emblem and `opts.life`, with every position taken relative to the building's centre so the
 * building turns about its own middle. Uses `faceTones(theta)`, casts no ground shadows and writes no ids.
 * The caller applies the beacon blink.
 */
export function rasterizeLot(
  scene: Scene,
  target: LotTarget,
  theta: number,
  view: View,
  buffer: RasterBuffer,
  opts: { life: LifeInstance[] | null },
): void {
  buffer.buf.fill(0);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const tones = faceTones(theta);
  const s = fullSurface(buffer.buf, null, view.BW, view.BH);
  if (target.kind === 'park') {
    drawModel(s, scene.parks[target.park], view.cx, view.cy, cos, sin, tones, scene.colors, 0, null);
    return;
  }
  const it = scene.buildings[target.index];
  drawModel(s, scene.plate, view.cx, view.cy, cos, sin, tones, scene.colors, 0, null);
  drawModel(s, it.model, view.cx, view.cy, cos, sin, tones, scene.colors, 0, null);
  if (it.roof) {
    drawEmblem(s, scene.emblems[target.index], it.roof.x - it.x, it.roof.y - it.y, it.roof.z, view.cx, view.cy, cos, sin, 0);
  }
  const life = opts.life;
  if (life) {
    for (let i = 0; i < life.length; i++) {
      const li = life[i];
      const rx = li.x - it.x;
      const ry = li.y - it.y;
      const sx = view.cx + cos * rx - sin * ry;
      const sy = view.cy + (sin * rx + cos * ry) * SQ - li.z;
      drawModel(s, li.model, sx, sy, cos, sin, tones, scene.colors, 0, null);
    }
  }
}
