import { emblemFor } from './emblems';
import { daysSince } from './format';
import { groundSize, LOT, PITCH, ROAD } from './layout';
import { hash, rng } from './rng';
import { groundMaterials, hex, languageStyle, litChance, luma, Materials, mix, STYLES, toHex } from './styles';
import { CityRepo, Item, Lot, Model, PropKind, RGB, StyleKey } from './types';
import { buildModel } from './voxel';

export type BuildingType = 'tower' | 'step' | 'ell';
const TYPES: BuildingType[] = ['tower', 'step', 'ell'];
/** Width of the tall part of an `ell`. */
const ELL_W = 9;

/** Height of the body, in cells, from the repo size. */
export function buildingHeight(sizeKB: number): number {
  const lg = Math.log10(sizeKB + 1);
  return Math.round(6 + 1.25 * lg * lg);
}

/** Everything decided about a building before its voxels are built. */
export interface BuildingSpec {
  repo: CityRepo;
  lot: Lot;
  type: BuildingType;
  /** Body height. */
  h: number;
  /** Footprint, 11 to 14 each. */
  w: number;
  d: number;
  prop: PropKind | null;
}

/** Decides a building's type, size and roof prop from its name, size and stars. Pure. */
export function planBuilding(repo: CityRepo, lot: Lot, style: StyleKey): BuildingSpec {
  const S = STYLES[style];
  const R = rng(hash(repo.name));
  const type = TYPES[Math.floor(R() * 3)];
  const h = buildingHeight(repo.sizeKB);
  let w = 11 + Math.floor(R() * 4);
  const d = 11 + Math.floor(R() * 4);
  if (type === 'ell') w = 14;
  const prop: PropKind | null = h > 14 && R() < 0.6
    ? S.props[Math.floor(R() * S.props.length)]
    : repo.stars > 1 ? 'antenna' : null;
  return { repo, lot, type, h, w, d, prop };
}

/**
 * Guarantees at least two buildings with a vent (the smoke needs them): when fewer than two have one,
 * the tallest buildings without a prop get one. Mutates the specs.
 */
export function ensureVents(specs: BuildingSpec[]): void {
  const vents = specs.filter((s) => s.prop === 'vent').length;
  if (vents >= 2) return;
  specs
    .filter((s) => !s.prop)
    .sort((a, b) => b.h - a.h)
    .slice(0, 2 - vents)
    .forEach((s) => { s.prop = 'vent'; });
}

export interface Building { item: Item; emblem: Uint8Array }

/**
 * The voxel model, placement and emblem of one building. `GW` and `GD` are the ground plate size, which
 * the city origin is taken from.
 */
export function buildingItem(spec: BuildingSpec, materials: Materials, GW: number, GD: number, nowMs: number): Building {
  const { repo, lot, type, h, w, d, prop } = spec;
  const S = materials.style;
  const M = materials.get;
  const night = materials.key === 'night';
  const L = languageStyle(S, repo.language);
  const H = h + (prop ? 6 : 0);
  const wallC = hex(L.wall);
  const roofC = L.roof ? hex(L.roof) : mix(wallC, materials.shadow, 0.35);

  const winDark = M(S.window);
  const winLit = M(S.windowLit, { emissive: true });
  const winLitAlt = S.windowLitAlt ? M(S.windowLitAlt, { emissive: true }) : winLit;
  const metal = M(night ? '#4a5c4d' : '#6f7469');
  const chimney = M(S.window);
  const beacon = M('#ff5a4d', { emissive: true, blink: night });
  const wall = M(L.wall);
  const trim = M(toHex(mix(wallC, materials.shadow, S.trimMix)));
  const roof = M(toHex(roofC));
  const rim = L.rim ? M(L.rim, { emissive: true }) : trim;

  const days = daysSince(repo.pushedAt, nowMs);
  const pLit = litChance(days);
  const seed = hash(repo.name);
  const inset = type === 'step' ? 1 : 0;
  const podium = Math.max(4, Math.round(h * 0.42));
  const stepZ = h * 0.6;
  // The top roof, in cells, and the corner where props stand (so they never cover the emblem).
  const rx0 = inset;
  const ry0 = inset;
  const rx1 = type === 'ell' ? ELL_W : w - inset;
  const ry1 = d - inset;
  const pcx = rx0 + 1;
  const pcy = ry0 + 1;

  const kindFn = (x: number, y: number, z: number): number => {
    if (z >= h) {
      const pz = z - h;
      if (prop === 'antenna') return x === pcx && y === pcy && pz < 5 ? (pz === 4 ? 4 : 3) : 0;
      if (prop === 'beacon') return x === pcx && y === pcy && pz < 4 ? (pz === 3 ? 4 : 3) : 0;
      if (prop === 'vent') return x >= pcx && x < pcx + 2 && y >= pcy && y < pcy + 2 && pz < 3 ? 2 : 0;
      return 0;
    }
    if (type === 'ell') return z < podium || x < ELL_W ? 1 : 0;
    const ins = type === 'step' && z > stepZ ? 1 : 0;
    return x >= ins && y >= ins && x < w - ins && y < d - ins ? 1 : 0;
  };
  const model = buildModel(w, d, H, kindFn, (v) => {
    if (v.kind === 3) return metal;
    if (v.kind === 4) return beacon;
    if (v.kind === 2) return chimney;
    if (v.mask === 0) return roof;
    // A one cell rim leaves the rest of the roof free for the emblem.
    if (v.top) {
      if (v.edge) return rim;
      v.mask = 0;
      return roof;
    }
    if (v.z < 2) return trim;
    const floor = Math.floor(v.z / 4);
    if (v.single && (v.z % 4 === 1 || v.z % 4 === 2) && v.t % 2 === 1 && v.t > 0 && v.t < v.tLen - 1) {
      const hv = hash(seed + ':' + v.mask + ':' + floor + ':' + v.t) / 4294967296;
      if (hv < pLit) return (hv * 97) % 1 < 0.22 ? winLitAlt : winLit;
      return winDark;
    }
    return wall;
  });

  const gx = lot.x + Math.floor((LOT - w) / 2);
  const gy = lot.y + Math.floor((LOT - d) / 2);
  const ox = gx - GW / 2;
  const oy = gy - GD / 2;
  const rw = rx1 - rx0;
  const rd = ry1 - ry0;
  // The emblem slides away from the prop corner when the roof has room for it.
  const ex = (rx0 + rx1) / 2 + Math.max(0, Math.min(1.5, (rw - 9) / 2));
  const ey = (ry0 + ry1) / 2 + Math.max(0, Math.min(1.5, (rd - 9) / 2));
  const emblemColor: RGB = L.rim
    ? mix(hex(L.rim), [255, 255, 255], 0.6)
    : luma(roofC) > 0.55 ? hex('#344e41') : hex('#f0efeb');
  const item: Item = {
    model,
    x: ox + w / 2,
    y: oy + d / 2,
    gx,
    gy,
    w,
    d,
    h,
    top: H,
    repo,
    roof: { x: ox + ex, y: oy + ey, z: h - 1 + 0.3 },
    vent: prop === 'vent' ? { x: ox + pcx + 1, y: oy + pcy + 1, z: h + 3 } : null,
  };
  return { item, emblem: emblemFor(repo, emblemColor) };
}

/** The ground plate: soil below, then roads with dashes (and lamps at night), lots, and grass in park lots. */
export function groundModel(materials: Materials, cols: number, rows: number, parkLots: Lot[]): Model {
  const gm = groundMaterials(materials);
  const { GW, GD } = groundSize(cols, rows);
  const isPark: boolean[] = [];
  parkLots.forEach((l) => { isPark[l.r * cols + l.c] = true; });
  const ground = buildModel(GW, GD, 3, () => 1, (v) => {
    if (v.z < 2) return gm.soil;
    v.mask = 0;
    const cx = v.x % PITCH;
    const cy = v.y % PITCH;
    const onX = cx < ROAD;
    const onY = cy < ROAD;
    if (onX || onY) {
      if (gm.lamp && onX && onY && cx === 2 && cy === 2) return gm.lamp;
      if (onX && !onY && cx === 2 && v.y % 4 < 2) return gm.dash;
      if (onY && !onX && cy === 2 && v.x % 4 < 2) return gm.dash;
      return gm.road;
    }
    return isPark[Math.floor(v.y / PITCH) * cols + Math.floor(v.x / PITCH)] ? gm.grass : gm.lot;
  });
  ground.z0 = -2;
  ground.isGround = true;
  return ground;
}

/** The 2 or 3 trees standing in one park lot. */
export function treeItems(parkLot: Lot, materials: Materials, GW: number, GD: number): Item[] {
  const leaf = materials.get(materials.style.leaf);
  const trunk = materials.get(materials.style.trunk);
  const R = rng(hash('park' + parkLot.c + parkLot.r));
  const n = 2 + Math.floor(R() * 2);
  const items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const r = 2 + Math.floor(R() * 2);
    const w = r * 2 + 1;
    const H = r * 2 + 4;
    const model = buildModel(
      w,
      w,
      H,
      (x, y, z) => {
        if (z < 3) return x === r && y === r ? 2 : 0;
        return Math.hypot(x - r, y - r, (z - 3 - r) * 1.05) <= r + 0.1 ? 1 : 0;
      },
      (v) => (v.kind === 2 ? trunk : leaf),
    );
    const gx = parkLot.x + 1 + Math.floor(R() * (LOT - w - 2));
    const gy = parkLot.y + 1 + Math.floor(R() * (LOT - w - 2));
    items.push({
      model,
      x: gx + w / 2 - GW / 2,
      y: gy + w / 2 - GD / 2,
      gx: gx + r - 1,
      gy: gy + r - 1,
      w: 3,
      d: 3,
      h: H - 2,
      top: H,
      repo: null,
      roof: null,
      vent: null,
    });
  }
  return items;
}

/**
 * Cars: `[colour][orientation 0=x 1=y][direction 0=-1 1=+1]`, each 4 by 2 by 2 (2 by 4 by 2 turned).
 * At night the front cell is an emissive headlight and the rear cell an emissive tail light.
 */
export function carModels(materials: Materials, style: StyleKey): Model[][][] {
  const S = STYLES[style];
  const night = style === 'night';
  const winDark = materials.get(S.window);
  const head = night ? materials.get('#ffe9b0', { emissive: true }) : 0;
  const tail = night ? materials.get('#ff5a4d', { emissive: true }) : 0;
  return S.cars.map((col) => {
    const body = materials.get(col);
    return [0, 1].map((ori) => [0, 1].map((dir) => buildModel(
      ori ? 2 : 4,
      ori ? 4 : 2,
      2,
      (x, y, z) => {
        const a = ori ? y : x;
        return z === 0 || a === 1 || a === 2 ? 1 : 0;
      },
      (v) => {
        const a = ori ? v.y : v.x;
        const front = dir ? 3 : 0;
        if (v.top) v.mask = 0;
        if (v.z === 1) return winDark;
        if (head && a === front) return head;
        if (tail && a === 3 - front) return tail;
        return body;
      },
    )));
  });
}

/** Smoke puffs: 2x2x2, 3x3x2 and 2x2x1. */
export function puffModels(materials: Materials, style: StyleKey): Model[] {
  const puff = materials.get(STYLES[style].puff);
  return [[2, 2, 2], [3, 3, 2], [2, 2, 1]].map(([w, d, H]) => buildModel(w, d, H, () => 1, (v) => {
    if (v.top) v.mask = 0;
    return puff;
  }));
}
