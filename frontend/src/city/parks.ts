import { hash } from './rng';
import { groundMaterials, Materials } from './styles';
import { Model, StyleKey } from './types';
import { buildModel } from './voxel';

/** Side of a lot plate or park, in cells. */
export const PLATE = 18;
export const PARK_COUNT = 6;

const kerb = (x: number, y: number): boolean => x === 0 || y === 0 || x === PLATE - 1 || y === PLATE - 1;

/**
 * A card whose repo has a building shows it on this plate: 3 slices, soil below, the kerb ring in the
 * road material and the lot colour inside. `z0` is -2 so the top of the plate sits at height 0.
 */
export function plateModel(materials: Materials): Model {
  const gm = groundMaterials(materials);
  const model = buildModel(PLATE, PLATE, 3, () => 1, (v) => {
    if (v.z < 2) return gm.soil;
    v.mask = 0;
    return kerb(v.x, v.y) ? gm.road : gm.lot;
  });
  model.z0 = -2;
  return model;
}

// Solid kinds: 1 plate, 2 wood, 3 leaf, 4 stone, 5 flower.
const tree = (x: number, y: number, zz: number, cx: number, cy: number, r: number): number =>
  zz < 3 && x === cx && y === cy ? 2 : zz >= 2 && Math.hypot(x - cx, y - cy, (zz - 2 - r) * 1.05) <= r + 0.1 ? 3 : 0;
const shrub = (x: number, y: number, zz: number, cx: number, cy: number): number =>
  Math.hypot(x - cx, y - cy, zz - 0.5) <= 1.5 ? 3 : 0;
/** Where two solids claim a cell, the first one listed wins. */
const any = (...kinds: number[]): number => {
  for (let i = 0; i < kinds.length; i++) if (kinds[i]) return kinds[i];
  return 0;
};
const inPond = (x: number, y: number): boolean => Math.pow((x - 10) / 4.6, 2) + Math.pow((y - 9) / 3.3, 2) <= 1;
const inBed = (x: number, y: number): boolean => y >= 3 && y <= 14 && ((x >= 3 && x <= 7) || (x >= 10 && x <= 14));
const ring = (x: number, y: number): number => Math.max(Math.abs(x - 8.5), Math.abs(y - 8.5));

/** Material ids a park is painted with. */
interface ParkMaterials {
  grass: number;
  /** The kerb ring. */
  kerb: number;
  /** The two soil slices of the plate. */
  soil: number;
  /** Paved path, plaza and garden walk. */
  paved: number;
  /** Flower bed soil. */
  bed: number;
  water: number;
  stone: number;
  wood: number;
  leaf: number;
  flowerA: number;
  flowerB: number;
}

/**
 * Night parks sit on a card of about `#1a2419`, not on the dark city ground, so they get lighter, moonlit
 * colours of their own. The city's night ground, trees and lot plate keep `STYLES.night`.
 */
export const NIGHT_PARK = {
  grass: '#3f6043', kerb: '#667662', soil: '#2b3a2d', paved: '#8e9d85', bed: '#4a3b2a',
  water: '#55b0d2', stone: '#d3ddd5', wood: '#9a7f55', leaf: '#78b87a', flowerA: '#ffd98a', flowerB: '#f4f3ef',
};

function parkMaterials(materials: Materials, style: StyleKey): ParkMaterials {
  if (style === 'night') {
    const N = NIGHT_PARK;
    return {
      grass: materials.get(N.grass), kerb: materials.get(N.kerb), soil: materials.get(N.soil),
      paved: materials.get(N.paved), bed: materials.get(N.bed), water: materials.get(N.water),
      stone: materials.get(N.stone), wood: materials.get(N.wood), leaf: materials.get(N.leaf),
      flowerA: materials.get(N.flowerA), flowerB: materials.get(N.flowerB),
    };
  }
  // The light style shares the ground materials; keep this order so its material ids stay as they were.
  const gm = groundMaterials(materials);
  const water = materials.get('#9dbfb8');
  const stone = materials.get('#b6b09c');
  const wood = materials.get(materials.style.trunk);
  const leaf = materials.get(materials.style.leaf);
  const flowerA = materials.get('#f6d98b');
  const flowerB = materials.get('#f0efeb');
  return {
    grass: gm.grass, kerb: gm.road, soil: gm.soil, paved: gm.lot, bed: gm.soil,
    water, stone, wood, leaf, flowerA, flowerB,
  };
}

interface ParkDef {
  H: number;
  /** Material of the top surface inside the kerb. */
  top: (x: number, y: number) => number;
  /** Solid kind at `zz` cells above the plate. */
  solid: (x: number, y: number, zz: number) => number;
}

function parkDefs(gm: ParkMaterials): ParkDef[] {
  return [
    { // 0 grove
      H: 13,
      top: () => gm.grass,
      solid: (x, y, zz) => any(tree(x, y, zz, 6, 6, 3), tree(x, y, zz, 12, 9, 2), tree(x, y, zz, 6, 13, 2)),
    },
    { // 1 pond
      H: 11,
      top: (x, y) => (inPond(x, y) ? gm.water : gm.grass),
      solid: (x, y, zz) => any(
        tree(x, y, zz, 4, 4, 2),
        zz === 0 && ((x === 5 && y === 10) || (x === 6 && y === 11) || (x === 14 && y === 5)) ? 4 : 0,
      ),
    },
    { // 2 path
      H: 13,
      top: (x, y) => (y === 8 || y === 9 ? gm.paved : gm.grass),
      solid: (x, y, zz) => any(
        tree(x, y, zz, 12, 4, 3),
        tree(x, y, zz, 4, 13, 2),
        zz === 0 && y === 6 && x >= 5 && x <= 7 ? 2 : 0,
      ),
    },
    { // 3 garden
      H: 9,
      top: (x, y) => (inBed(x, y) ? gm.bed : x === 8 || x === 9 ? gm.paved : gm.grass),
      solid: (x, y, zz) => any(
        zz === 0 && inBed(x, y) && (x + y) % 2 === 0 ? 5 : 0,
        shrub(x, y, zz, 8.5, 2),
        shrub(x, y, zz, 8.5, 15),
      ),
    },
    { // 4 fountain
      H: 8,
      top: (x, y) => (ring(x, y) < 2 ? gm.water : ring(x, y) < 5 ? gm.paved : gm.grass),
      solid: (x, y, zz) => any(
        zz === 0 && ring(x, y) >= 2 && ring(x, y) < 3 ? 4 : 0,
        zz < 3 && ring(x, y) < 1 ? 4 : 0,
        shrub(x, y, zz, 3, 3),
        shrub(x, y, zz, 14, 3),
        shrub(x, y, zz, 3, 14),
        shrub(x, y, zz, 14, 14),
      ),
    },
    { // 5 orchard
      H: 11,
      top: () => gm.grass,
      solid: (x, y, zz) => any(
        tree(x, y, zz, 5, 5, 2),
        tree(x, y, zz, 12, 5, 2),
        tree(x, y, zz, 5, 12, 2),
        tree(x, y, zz, 12, 12, 2),
        zz === 0 && !kerb(x, y) && hash('f' + x + ':' + y) % 100 < 7 ? 5 : 0,
      ),
    },
  ];
}

/**
 * The six park designs: grove, pond, path, garden, fountain, orchard. Each is a plate (same soil and
 * kerb) with a painted top and solid features above it.
 */
export function parkModels(materials: Materials, style: StyleKey): Model[] {
  const pm = parkMaterials(materials, style);
  return parkDefs(pm).map((p) => {
    const model = buildModel(PLATE, PLATE, p.H, (x, y, z) => (z < 3 ? 1 : p.solid(x, y, z - 3)), (v) => {
      if (v.kind === 2) return pm.wood;
      if (v.kind === 3) return pm.leaf;
      if (v.kind === 4) {
        if (v.top) v.mask = 0;
        return pm.stone;
      }
      if (v.kind === 5) {
        v.mask = 0;
        return hash('c' + v.x + ':' + v.y) % 2 ? pm.flowerA : pm.flowerB;
      }
      if (v.z < 2) return pm.soil;
      v.mask = 0;
      return kerb(v.x, v.y) ? pm.kerb : p.top(v.x, v.y);
    });
    model.z0 = -2;
    return model;
  });
}
