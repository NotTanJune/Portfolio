import { Model } from './types';

/** The per-cell object handed to `paint`. One instance is reused for every cell. */
export interface Cell {
  kind: number;
  x: number;
  y: number;
  z: number;
  /** Open-air face bits: 1 is -x, 2 is +x, 4 is -y, 8 is +y. `paint` may set it to 0 to mark a flat, top-lit cell. */
  mask: number;
  /** Nothing above this cell. */
  top: boolean;
  /** Exactly one mask bit. */
  single: boolean;
  /** At least one of the four side neighbours is open (a 1 cell test). */
  edge: boolean;
  /** Position and length along the wall. */
  t: number;
  tLen: number;
}

/**
 * Builds a model of `H` slices. `kindFn` returns a non-zero kind for a solid cell; `paint` returns the
 * material id for it and may clear `cell.mask`.
 *
 * A face bit is set when open air is within 2 cells in that direction. A slice is squashed to 60% height
 * on screen, so about 1.7 cells of each slice edge show; a 1 cell rim would let interior colour leak
 * onto walls.
 */
export function buildModel(
  w: number,
  d: number,
  H: number,
  kindFn: (x: number, y: number, z: number) => number | boolean,
  paint: (v: Cell) => number,
): Model {
  const n = w * d;
  const kind = new Uint8Array(H * n);
  const mat = new Uint8Array(H * n);
  const mask = new Uint8Array(H * n);
  for (let z = 0; z < H; z++) {
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < w; x++) kind[(z * d + y) * w + x] = (kindFn(x, y, z) as number) | 0;
    }
  }
  const at = (x: number, y: number, z: number): number =>
    x < 0 || y < 0 || x >= w || y >= d || z >= H ? 0 : kind[(z * d + y) * w + x];
  const v: Cell = { kind: 0, x: 0, y: 0, z: 0, mask: 0, top: false, single: false, edge: false, t: 0, tLen: 0 };
  for (let z = 0; z < H; z++) {
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < w; x++) {
        const i = (z * d + y) * w + x;
        const k = kind[i];
        if (!k) continue;
        let m = 0;
        if (!at(x - 1, y, z) || !at(x - 2, y, z)) m |= 1;
        if (!at(x + 1, y, z) || !at(x + 2, y, z)) m |= 2;
        if (!at(x, y - 1, z) || !at(x, y - 2, z)) m |= 4;
        if (!at(x, y + 1, z) || !at(x, y + 2, z)) m |= 8;
        v.kind = k;
        v.x = x;
        v.y = y;
        v.z = z;
        v.mask = m;
        v.top = !at(x, y, z + 1);
        v.single = m === 1 || m === 2 || m === 4 || m === 8;
        v.edge = !at(x - 1, y, z) || !at(x + 1, y, z) || !at(x, y - 1, z) || !at(x, y + 1, z);
        v.t = m & 3 ? y : x;
        v.tLen = m & 3 ? d : w;
        mat[i] = paint(v);
        mask[i] = v.mask;
      }
    }
  }
  return { w, d, H, mat, mask, z0: 0, ax: 0, ay: 0 };
}
