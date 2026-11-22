export interface CityRepo {
  name: string;            // GitHub repo name, original casing
  language: string;        // primary language, never empty
  sizeKB: number;          // GitHub "size" field
  pushedAt: string;        // ISO 8601
  stars: number;
  url: string;             // repo URL on github.com
  homepage: string | null; // live site, when known
  fork: boolean;
}

export interface CityData {
  generatedAt: string;                       // ISO 8601
  source: 'live' | 'stale' | 'snapshot';
  repos: CityRepo[];
}

export type StyleKey = 'maquette' | 'night';

export type RGB = [number, number, number];

/**
 * One voxel model: `H` slices of `w` by `d` cells. `mat` holds a material id per cell (0 is empty),
 * `mask` holds the open-air face bits (1 is -x, 2 is +x, 4 is -y, 8 is +y) that pick a tone.
 */
export interface Model {
  w: number;
  d: number;
  H: number;
  mat: Uint8Array;
  mask: Uint8Array;
  z0: number;
  isGround?: boolean;
  /** Atlas origin in texels. Written by the GL atlas packer (gl.ts); 0 until then. */
  ax: number;
  ay: number;
}

export interface Item {
  model: Model;
  x: number; y: number;        // centre, in city units, origin at the centre of the ground plate
  gx: number; gy: number;      // top-left of the footprint on the ground grid (for shadows)
  w: number; d: number;        // footprint
  h: number;                   // body height used for the shadow length
  top: number;                 // total height including props (label anchor)
  repo: CityRepo | null;       // null for trees
  roof: { x: number; y: number; z: number } | null; // emblem centre and height, null when no emblem
  vent: { x: number; y: number; z: number } | null; // top of a roof vent, where smoke starts
}

/** What one Projects card shows: a building from the city, or one of the parks. */
export type LotTarget = { kind: 'building'; index: number } | { kind: 'park'; park: number };

export interface View { BW: number; BH: number; cx: number; cy: number; } // art-pixel canvas size and the plate centre

/** One life model (a car or a puff) at a position in city units; `z` is its base height. */
export interface LifeInstance { model: Model; x: number; y: number; z: number }

/** A beacon colour that blinks: `n` is the material id, `on` and `off` are packed colours. */
export interface Blinker { n: number; on: number; off: number }

export type PropKind = 'antenna' | 'vent' | 'beacon';

export interface LangStyle { wall: string; roof?: string; rim?: string }

export interface StyleDef {
  shadow: string;
  highlight: string;
  ground: { lot: string; road: string; dash: string; grass: string; soil: string; lamp: string | null };
  lang: Record<string, LangStyle>;
  window: string;
  windowLit: string;
  windowLitAlt?: string;
  trimMix: number;
  props: PropKind[];
  leaf: string;
  trunk: string;
  cars: string[];
  puff: string;
  hoverInk: string;
}

export interface Lot { c: number; r: number; x: number; y: number }

/**
 * Everything the renderers need for one style. Both styles are built from the same repo list,
 * so `buildings[i]` is the same repo in both and `GW`, `GD`, `cols` and `rows` are equal.
 */
export interface Scene {
  key: StyleKey;
  style: StyleDef;
  cols: number;
  rows: number;
  GW: number;
  GD: number;
  /** Packed RGBA, 4 tones per material (top, lit, mid, shade). Material 0 is empty. Mutated by applyBlink. */
  colors: Uint32Array;
  blinkers: Blinker[];
  ground: Model;
  /** Every building and tree. */
  items: Item[];
  /** The items that have a repo, in lot order. A building's index is its position here. */
  buildings: Item[];
  /** One 16 by 16 RGBA emblem (1024 bytes) per building, same order as `buildings`. */
  emblems: Uint8Array[];
  /** cars[colour][orientation 0=x 1=y][direction 0=-1 1=+1] */
  cars: Model[][][];
  /** Smoke puffs: 2x2x2, 3x3x2, 2x2x1. */
  puffs: Model[];
  /** The lot plate a card's building stands on. */
  plate: Model;
  /** The six park models, in the order they are handed out. */
  parks: Model[];
  maxTop: number;
  /** GW * GD, one byte per ground cell; stamped by computeLighting. */
  shadowMask: Uint8Array;
  /** 16 tone entries indexed by face mask; stamped by computeLighting. Entry 0 is always 0. */
  tones: Uint8Array;
}
