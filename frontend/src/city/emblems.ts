import { hash } from './rng';
import { CityRepo, RGB } from './types';
import emblemData from './emblems.json';

const SIZE = 16;
const BYTES = SIZE * SIZE * 4;

/**
 * A 16 by 16 RGBA emblem: a 7 by 7 grid mirrored left to right (4 unique columns), each cell 2 by 2
 * pixels, with a 1 pixel transparent margin. The centre cell is always filled.
 */
export function proceduralEmblem(name: string, color: ArrayLike<number>): Uint8Array {
  const px = new Uint8Array(BYTES);
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      const mc = Math.min(col, 6 - col);
      if (!((mc === 3 && row === 3) || hash(name + ':' + mc + ':' + row) % 100 < 50)) continue;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const o = ((1 + row * 2 + dy) * SIZE + 1 + col * 2 + dx) * 4;
          px[o] = color[0];
          px[o + 1] = color[1];
          px[o + 2] = color[2];
          px[o + 3] = 255;
        }
      }
    }
  }
  return px;
}

let loaded: Record<string, Uint8Array> | null = null;

/** Decodes `emblems.json`: lower-cased repo name to 1024 RGBA bytes. Entries of the wrong size are dropped. */
export function loadEmblems(): Record<string, Uint8Array> {
  if (loaded) return loaded;
  const out: Record<string, Uint8Array> = {};
  const src = emblemData as Record<string, string>;
  Object.keys(src).forEach((name) => {
    const bin = atob(src[name]);
    if (bin.length !== BYTES) return;
    const bytes = new Uint8Array(BYTES);
    for (let i = 0; i < BYTES; i++) bytes[i] = bin.charCodeAt(i);
    out[name.toLowerCase()] = bytes;
  });
  loaded = out;
  return out;
}

/** The generated emblem for a repo when there is one, otherwise the procedural one in `rimColor`. */
export function emblemFor(repo: CityRepo, rimColor: RGB): Uint8Array {
  const found = loadEmblems()[repo.name.toLowerCase()];
  return found || proceduralEmblem(repo.name, rimColor);
}
