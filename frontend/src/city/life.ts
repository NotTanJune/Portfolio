import { PITCH } from './layout';
import { hash, rng } from './rng';
import { Item, LifeInstance, Scene } from './types';

/**
 * Small life on a slow clock: tiny cars on the roads and chimney smoke. Everything is a pure function of
 * the tick, so there is no accumulated state to keep or to reset. Beacons blink through the palette in
 * `computeLighting` and `applyBlink`.
 */

/** Life ticks per second. */
export const LIFE_HZ = 8;
const TICK_MS = 1000 / LIFE_HZ;

export function lifeTick(timeMs: number): number {
  return Math.floor(timeMs / TICK_MS);
}

/** How many cars drive in a city of `buildingCount` buildings. */
export function carCount(buildingCount: number): number {
  return Math.min(8, Math.max(3, Math.round(buildingCount / 4)));
}

/**
 * Car `k` at `tick`, or null while it is off the plate. Its road, lane, direction, start offset and colour
 * come from `rng(hash('car' + k))`. It enters and leaves past the plate edge, and is only drawn while the whole
 * car lies on the plate. `lane` is -1 or +1: the lane it drives in and, with it, its direction.
 */
export function carInstance(scene: Scene, k: number, tick: number): LifeInstance | null {
  const { cols, rows, GW, GD } = scene;
  const R = rng(hash('car' + k));
  const horiz = R() < 0.5;
  const line = Math.floor(R() * ((horiz ? rows : cols) + 1));
  const lane = R() < 0.5 ? -1 : 1;
  const offset = Math.floor(R() * 400);
  const colour = Math.floor(R() * scene.cars.length);
  const length = horiz ? GW : GD;
  const span = length + 8;
  const pos = ((((offset + tick * lane) % span) + span) % span) - 4;
  if (pos < 2 || pos > length - 2) return null;
  const across = line * PITCH + (lane < 0 ? 1 : 4);
  return {
    model: scene.cars[colour][horiz ? 0 : 1][lane > 0 ? 1 : 0],
    x: (horiz ? pos : across) - GW / 2,
    y: (horiz ? across : pos) - GD / 2,
    z: 0,
  };
}

/** The three smoke puffs of one building with a vent (none for a building without one). */
export function lotPuffs(scene: Scene, item: Item, tick: number): LifeInstance[] {
  if (!item.vent || !item.repo) return [];
  const out: LifeInstance[] = [];
  const phase = hash(item.repo.name) % 24;
  for (let j = 0; j < 3; j++) {
    const age = (tick + j * 8 + phase) % 24;
    out.push({
      model: scene.puffs[age < 8 ? 0 : age < 16 ? 1 : 2],
      x: item.vent.x + Math.floor(age / 8),
      y: item.vent.y,
      z: item.vent.z + 1 + Math.floor(age / 2),
    });
  }
  return out;
}

/** Every car and every puff of the city at `tick`, in city units. */
export function lifeInstances(scene: Scene, tick: number): LifeInstance[] {
  const out: LifeInstance[] = [];
  const n = carCount(scene.buildings.length);
  for (let k = 0; k < n; k++) {
    const car = carInstance(scene, k, tick);
    if (car) out.push(car);
  }
  for (let i = 0; i < scene.buildings.length; i++) {
    const puffs = lotPuffs(scene, scene.buildings[i], tick);
    for (let j = 0; j < puffs.length; j++) out.push(puffs[j]);
  }
  return out;
}
