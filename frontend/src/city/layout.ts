import { hash } from './rng';
import { PLATE } from './parks';
import { CityRepo, LotTarget, Lot, Scene, View } from './types';

/** Vertical squash of the ground plane on screen. */
export const SQ = 0.6;
/** A lot is 16 by 16 cells, a road 5 cells wide. */
export const LOT = 16;
export const ROAD = 5;
export const PITCH = LOT + ROAD;
/** CSS pixels per art pixel for a Projects card lot. */
export const LOT_K = 2;
/** Headroom above a building with a vent, for its smoke. */
const SMOKE_ROOM = 14;

export function gridFor(n: number): { cols: number; rows: number } {
  const cols = Math.max(4, Math.ceil(Math.sqrt(n * 1.25)));
  const rows = Math.max(3, Math.ceil((n + 2) / cols));
  return { cols, rows };
}

export function groundSize(cols: number, rows: number): { GW: number; GD: number } {
  return { GW: cols * LOT + (cols + 1) * ROAD, GD: rows * LOT + (rows + 1) * ROAD };
}

export interface LotAssignment {
  /** The repos sorted by size, largest first, then by name. */
  repos: CityRepo[];
  /** `lots[i]` is the lot of `repos[i]`. */
  lots: Lot[];
  /** The lots left over, which become parks. */
  parks: Lot[];
}

/** The biggest repo gets the lot nearest the grid centre; the lots left over are parks. */
export function assignLots(repos: CityRepo[], cols: number, rows: number): LotAssignment {
  const lots: Lot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) lots.push({ c, r, x: ROAD + c * PITCH, y: ROAD + r * PITCH });
  }
  if (repos.length > lots.length) throw new Error('Repo city: more repos than lots on the grid');
  const order = lots.slice().sort((a, b) => {
    const da = Math.hypot(a.c - (cols - 1) / 2, (a.r - (rows - 1) / 2) * 1.15);
    const db = Math.hypot(b.c - (cols - 1) / 2, (b.r - (rows - 1) / 2) * 1.15);
    return da - db || hash('lot' + a.c + a.r) - hash('lot' + b.c + b.r);
  });
  const sorted = repos.slice().sort((a, b) => b.sizeKB - a.sizeKB || a.name.localeCompare(b.name, 'en'));
  return { repos: sorted, lots: order.slice(0, sorted.length), parks: order.slice(sorted.length) };
}

/** How far above the plate centre an item can appear, at any angle. */
function reachOf(scene: Scene): number {
  let need = 0;
  for (let i = 0; i < scene.items.length; i++) {
    const it = scene.items[i];
    const reach = (Math.hypot(it.x, it.y) + Math.hypot(it.w, it.d) / 2) * SQ + it.top + (it.vent ? SMOKE_ROOM : 0);
    need = Math.max(need, reach);
  }
  return need;
}

/**
 * The city's art-pixel canvas, sized from both styles' scenes so the canvas does not change size when
 * the theme does.
 */
export function viewFor(a: Scene, b: Scene): View {
  const RAD = Math.hypot(a.GW, a.GD) / 2;
  const need = Math.max(RAD * SQ, reachOf(a), reachOf(b));
  const cy = Math.ceil(need) + 4;
  const BW = Math.ceil(RAD * 2) + 6;
  return { BW, BH: Math.ceil(cy + RAD * SQ + 6), cx: BW / 2, cy };
}

const RADP = Math.hypot(PLATE, PLATE) / 2;

/** The one view every Projects card lot shares: wide enough for the plate, tall enough for the tallest building and its smoke. */
export function lotView(a: Scene, b: Scene): View {
  let need = RADP * SQ;
  const scenes = [a, b];
  for (let s = 0; s < scenes.length; s++) {
    const sc = scenes[s];
    for (let i = 0; i < sc.buildings.length; i++) {
      const it = sc.buildings[i];
      need = Math.max(need, (Math.hypot(it.w, it.d) / 2) * SQ + it.top + (it.vent ? SMOKE_ROOM : 0));
    }
    for (let i = 0; i < sc.parks.length; i++) need = Math.max(need, RADP * SQ + sc.parks[i].H - 3);
  }
  const cy = Math.ceil(need) + 2;
  const BW = Math.ceil(RADP * 2) + 4;
  return { BW, BH: Math.ceil(cy + RADP * SQ + 5), cx: BW / 2, cy };
}

/** CSS height of the visible part of one lot: from the top of its content to the bottom of the canvas. */
export function lotHeightPx(view: View, scene: Scene, target: LotTarget): number {
  let reach: number;
  if (target.kind === 'building') {
    const it = scene.buildings[target.index];
    reach = (Math.hypot(it.w, it.d) / 2) * SQ + it.top;
  } else {
    reach = RADP * SQ + scene.parks[target.park].H - 3;
  }
  return view.BH * LOT_K - Math.floor((view.cy - reach) * LOT_K) + 4;
}
