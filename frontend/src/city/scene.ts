import { assignLots, gridFor, groundSize, SQ } from './layout';
import {
  buildingItem, BuildingSpec, carModels, ensureVents, groundModel, planBuilding, puffModels, treeItems,
} from './models';
import { parkModels, plateModel } from './parks';
import { createMaterials, STYLES } from './styles';
import { CityRepo, Item, Scene, StyleKey } from './types';

/** A life tick is 125 ms (8 per second). */
const LIFE_TICK_MS = 125;

/** Screen-space light: from the left, a touch toward the viewer. */
export const LIGHT = [-0.99, 0.14];
/** Face normals in model space, in mask bit order: -x, +x, -y, +y. */
const NORMALS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/**
 * Builds the whole city for one style from a repo list. Pure: the same repos, style and `nowMs` always
 * give the same scene (`nowMs` only decides how many windows are lit).
 */
export function makeScene(repos: CityRepo[], styleKey: StyleKey, nowMs: number): Scene {
  const style = STYLES[styleKey];
  const { cols, rows } = gridFor(repos.length);
  const { GW, GD } = groundSize(cols, rows);
  const lots = assignLots(repos, cols, rows);
  const materials = createMaterials(styleKey);

  const ground = groundModel(materials, cols, rows, lots.parks);

  // Decide every spec first so two vents can be guaranteed.
  const specs: BuildingSpec[] = lots.repos.map((repo, i) => planBuilding(repo, lots.lots[i], styleKey));
  ensureVents(specs);
  const built = specs.map((spec) => buildingItem(spec, materials, GW, GD, nowMs));
  const buildings: Item[] = built.map((b) => b.item);
  const emblems = built.map((b) => b.emblem);

  const items: Item[] = buildings.slice();
  lots.parks.forEach((lot) => {
    treeItems(lot, materials, GW, GD).forEach((t) => items.push(t));
  });

  const cars = carModels(materials, styleKey);
  const puffs = puffModels(materials, styleKey);
  const plate = plateModel(materials);
  const parks = parkModels(materials, styleKey);

  let maxTop = 0;
  items.forEach((it) => { maxTop = Math.max(maxTop, it.top); });

  // Material ids are stored in a Uint8Array.
  if (materials.colors.length / 4 > 256) throw new Error('Repo city: the material table exceeds 255 entries');

  return {
    key: styleKey,
    style,
    cols,
    rows,
    GW,
    GD,
    colors: new Uint32Array(materials.colors),
    blinkers: materials.blinkers,
    ground,
    items,
    buildings,
    emblems,
    cars,
    puffs,
    plate,
    parks,
    maxTop,
    shadowMask: new Uint8Array(GW * GD),
    tones: new Uint8Array(16),
  };
}

/**
 * The 16 tone entries for an angle, indexed by face mask: 1 is lit, 2 is mid, 3 is shade. Where a mask has
 * several open faces, the one facing the camera most wins. Entry 0 is always 0.
 */
export function faceTones(theta: number): Int32Array {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const faceTone: number[] = [];
  const faceCam: number[] = [];
  for (let n = 0; n < NORMALS.length; n++) {
    const nx = NORMALS[n][0];
    const ny = NORMALS[n][1];
    const rx = cos * nx - sin * ny;
    const ry = sin * nx + cos * ny;
    const b = rx * LIGHT[0] + ry * LIGHT[1];
    faceTone.push(b > 0.3 ? 1 : b > -0.45 ? 2 : 3);
    faceCam.push(ry);
  }
  const out = new Int32Array(16);
  for (let m = 1; m < 16; m++) {
    let best = -9;
    let t = 2;
    for (let f = 0; f < 4; f++) {
      if (m & (1 << f) && faceCam[f] > best) {
        best = faceCam[f];
        t = faceTone[f];
      }
    }
    out[m] = t;
  }
  return out;
}

/** Swaps the blinking colours in `scene.colors`: on for 6 life ticks, off for 6. */
export function applyBlink(scene: Scene, tick: number): void {
  for (let i = 0; i < scene.blinkers.length; i++) {
    const b = scene.blinkers[i];
    const c = tick % 12 < 6 ? b.on : b.off;
    scene.colors[b.n * 4] = scene.colors[b.n * 4 + 1] = scene.colors[b.n * 4 + 2] = scene.colors[b.n * 4 + 3] = c;
  }
}

/** Per-frame lighting: face tones, ground shadows stamped away from the light, and the beacon blink. */
export function computeLighting(scene: Scene, theta: number, timeMs: number): void {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  scene.tones.set(faceTones(theta));
  const { GW, GD, shadowMask: sm } = scene;
  sm.fill(0);
  const sdx = cos * -LIGHT[0] + sin * -LIGHT[1];
  const sdy = -sin * -LIGHT[0] + cos * -LIGHT[1];
  for (let i = 0; i < scene.items.length; i++) {
    const it = scene.items[i];
    const len = Math.round(it.h * 0.5);
    for (let t = 1; t <= len; t++) {
      const ox = Math.round(it.gx + sdx * t);
      const oy = Math.round(it.gy + sdy * t);
      for (let y = Math.max(0, oy); y < Math.min(GD, oy + it.d); y++) {
        for (let x = Math.max(0, ox); x < Math.min(GW, ox + it.w); x++) sm[y * GW + x] = 1;
      }
    }
  }
  applyBlink(scene, Math.floor(timeMs / LIFE_TICK_MS));
}

/** An item with its screen position for one angle. `index` is the building index, or -1 for a tree. */
export interface Placed { item: Item; index: number; sx: number; sy: number }

/** Screen positions of every item: `sx = cx + cos * x - sin * y`, `sy = cy + (sin * x + cos * y) * SQ`. */
export function placeItems(scene: Scene, theta: number, cx: number, cy: number): Placed[] {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  let b = 0;
  return scene.items.map((item) => ({
    item,
    index: item.repo ? b++ : -1,
    sx: cx + cos * item.x - sin * item.y,
    sy: cy + (sin * item.x + cos * item.y) * SQ,
  }));
}
