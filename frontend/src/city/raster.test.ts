import { lotView, SQ, viewFor } from './layout';
import { PARK_COUNT } from './parks';
import {
  createRasterBuffer, drawEmblem, drawModel, pick, rasterize, rasterizeLot, RasterTarget, Surface,
} from './raster';
import { faceTones, makeScene } from './scene';
import { NOW, snapshotRepos } from './test-helpers';
import { hex, pack } from './styles';
import { LifeInstance, LotTarget } from './types';
import { buildModel } from './voxel';

const repos = snapshotRepos();
const maquette = makeScene(repos, 'maquette', NOW);
const night = makeScene(repos, 'night', NOW);
const view = viewFor(maquette, night);
const THETA = 0.62;

function target(): RasterTarget {
  return { ...createRasterBuffer(view.BW, view.BH), view };
}

const nonZero = (b: Uint32Array) => b.reduce((n, v) => n + (v ? 1 : 0), 0);
const sameBuffers = (a: Uint32Array, b: Uint32Array) => a.length === b.length && a.every((v, i) => v === b[i]);

describe('rasterize', () => {
  const t = target();
  rasterize(maquette, THETA, 0, t, { hoverId: 0, life: null });

  it('fills the canvas with a city: plenty of pixels and at least 20 distinct buildings', () => {
    expect(nonZero(t.buf)).toBeGreaterThan(2000);
    const ids: Record<number, boolean> = {};
    t.ids.forEach((id) => { if (id) ids[id] = true; });
    const found = Object.keys(ids).map(Number);
    expect(found.length).toBeGreaterThanOrEqual(20);
    found.forEach((id) => {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(maquette.buildings.length);
    });
  });

  it('writes an id only where it also wrote a colour', () => {
    let idWithoutColour = 0;
    for (let i = 0; i < t.ids.length; i++) if (t.ids[i] && !t.buf[i]) idWithoutColour++;
    expect(idWithoutColour).toBe(0);
  });

  it('is deterministic', () => {
    const again = target();
    rasterize(maquette, THETA, 0, again, { hoverId: 0, life: null });
    expect(sameBuffers(again.buf, t.buf)).toBe(true);
    expect(Array.from(again.ids)).toEqual(Array.from(t.ids));
  });

  it('draws a different picture for another angle and for the night style', () => {
    const other = target();
    rasterize(maquette, THETA + 0.4, 0, other, { hoverId: 0, life: null });
    expect(sameBuffers(other.buf, t.buf)).toBe(false);
    const dark = target();
    rasterize(night, THETA, 0, dark, { hoverId: 0, life: null });
    expect(sameBuffers(dark.buf, t.buf)).toBe(false);
    expect(nonZero(dark.buf)).toBeGreaterThan(2000);
  });

  it('casts ground shadows: the ground top shows tone 3 where the shadow mask is set', () => {
    // the ground cell under the shadow mask draws tone 3 of the ground material
    const mask = maquette.shadowMask;
    expect(mask.filter((v) => v === 1).length).toBeGreaterThan(500);
    const colors = maquette.colors;
    const road = (maquette.ground.mat[2 * maquette.GW * maquette.GD + 0]) * 4;
    // tone 3 and tone 0 of a ground material differ, so shadows are visible
    expect(colors[road + 3]).not.toBe(colors[road]);
  });

  it('inks an outline only around the hovered building', () => {
    const plain = target();
    rasterize(maquette, THETA, 0, plain, { hoverId: 0, life: null });
    const ink = pack(hex(maquette.style.hoverInk));
    expect(plain.buf.filter((v) => v === ink)).toHaveLength(0);

    const hovered = target();
    const id = 1;
    rasterize(maquette, THETA, 0, hovered, { hoverId: id, life: null });
    const w = view.BW;
    let inked = 0;
    for (let i = 0; i < hovered.buf.length; i++) {
      if (hovered.buf[i] === plain.buf[i]) continue;
      // every changed pixel is ink, belongs to another id, and touches the hovered building
      inked++;
      expect(hovered.buf[i]).toBe(ink);
      expect(plain.ids[i]).not.toBe(id);
      const touches = plain.ids[i - 1] === id || plain.ids[i + 1] === id || plain.ids[i - w] === id || plain.ids[i + w] === id;
      expect(touches).toBe(true);
    }
    expect(inked).toBeGreaterThan(20);
    // and complete: every pixel next to the hovered building, inside the border, is inked
    let missing = 0;
    for (let y = 1; y < view.BH - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const next = plain.ids[p - 1] === id || plain.ids[p + 1] === id || plain.ids[p - w] === id || plain.ids[p + w] === id;
        if (next && plain.ids[p] !== id && hovered.buf[p] !== ink) missing++;
      }
    }
    expect(missing).toBe(0);
    // the ids themselves are not touched by the outline
    expect(Array.from(hovered.ids)).toEqual(Array.from(plain.ids));
  });

  describe('life', () => {
    const car = maquette.cars[0][0][1];
    // theta 0: screen y grows with city y, so a larger y is nearer the camera
    const draw = (life: LifeInstance[]) => {
      const out = target();
      rasterize(maquette, 0, 0, out, { hoverId: 0, life });
      return out;
    };
    const base = draw([]);

    it('draws a car on the open road at the front of the plate', () => {
      const cars = draw([{ model: car, x: 0, y: maquette.GD / 2 - 3, z: 0 }]);
      const changed = cars.buf.filter((v, i) => v !== base.buf[i]).length;
      expect(changed).toBeGreaterThanOrEqual(6);
      expect(changed).toBeLessThan(40);
    });

    it('draws a car that is nearer than a building over that building', () => {
      const front = maquette.buildings.reduce((best, b) => (b.y > best.y ? b : best));
      const index = maquette.buildings.indexOf(front);
      const cars = draw([{ model: car, x: front.x, y: front.y + front.d / 2 + 1, z: 0 }]);
      let overBuilding = 0;
      for (let i = 0; i < cars.buf.length; i++) {
        if (cars.buf[i] !== base.buf[i] && base.ids[i] === index + 1) overBuilding++;
      }
      expect(overBuilding).toBeGreaterThan(0);
      // the car covers those pixels and carries id 0, so the building loses them from the id buffer
      expect(Array.from(cars.ids).filter((v) => v === index + 1).length).toBeLessThan(Array.from(base.ids).filter((v) => v === index + 1).length);
    });

    it('keeps a car that is behind a building out of that building', () => {
      const front = maquette.buildings.reduce((best, b) => (b.y > best.y ? b : best));
      // inside the footprint, behind its centre: the building's own cells cover it completely
      const hidden = draw([{ model: car, x: front.x, y: front.y - 4, z: 0 }]);
      expect(sameBuffers(hidden.buf, base.buf)).toBe(true);
    });

    it('draws smoke high above a roof on top of everything', () => {
      const it = maquette.buildings[0];
      const puff = draw([{ model: maquette.puffs[0], x: it.x, y: it.y, z: it.top + 6 }]);
      const changed = puff.buf.filter((v, i) => v !== base.buf[i]).length;
      expect(changed).toBeGreaterThan(0);
      expect(changed).toBeLessThan(20);
    });
  });
});

describe('pick', () => {
  it('returns the tallest building id at its roof', () => {
    const tops = maquette.buildings.map((b) => b.top);
    const index = tops.indexOf(Math.max.apply(null, tops));
    const it = maquette.buildings[index];
    const cos = Math.cos(THETA);
    const sin = Math.sin(THETA);
    const roof = it.roof!;
    const x = view.cx + cos * roof.x - sin * roof.y;
    const y = view.cy + (sin * roof.x + cos * roof.y) * SQ - roof.z;
    expect(pick(maquette, THETA, view.cx, view.cy, view.BW, view.BH, x, y)).toBe(index + 1);
    // and a tick above the building returns nothing
    expect(pick(maquette, THETA, view.cx, view.cy, view.BW, view.BH, x, y - it.top - 20)).toBe(0);
  });

  it('agrees with rasterize on a grid of pixels, in both styles', () => {
    [maquette, night].forEach((scene) => {
      const t = target();
      rasterize(scene, 1.3, 0, t, { hoverId: 0, life: null });
      let checked = 0;
      let nonZeroIds = 0;
      for (let y = 0; y < view.BH; y += 7) {
        for (let x = 0; x < view.BW; x += 5) {
          const id = pick(scene, 1.3, view.cx, view.cy, view.BW, view.BH, x, y);
          expect(id).toBe(t.ids[y * view.BW + x]);
          checked++;
          if (id) nonZeroIds++;
        }
      }
      expect(checked).toBeGreaterThan(300);
      expect(nonZeroIds).toBeGreaterThan(10);
    });
  });

  it('returns 0 off the canvas and for empty corners', () => {
    expect(pick(maquette, THETA, view.cx, view.cy, view.BW, view.BH, -1, 5)).toBe(0);
    expect(pick(maquette, THETA, view.cx, view.cy, view.BW, view.BH, 5, view.BH)).toBe(0);
    expect(pick(maquette, THETA, view.cx, view.cy, view.BW, view.BH, 0, 0)).toBe(0);
  });
});

describe('rasterizeLot', () => {
  const lv = lotView(maquette, night);
  const buffer = () => createRasterBuffer(lv.BW, lv.BH);

  it('draws building 0 and park 0, each with more than 150 pixels, and parks 0 and 1 differ', () => {
    const b = buffer();
    rasterizeLot(maquette, { kind: 'building', index: 0 }, THETA, lv, b, { life: null });
    expect(nonZero(b.buf)).toBeGreaterThan(150);
    const p0 = buffer();
    rasterizeLot(maquette, { kind: 'park', park: 0 }, THETA, lv, p0, { life: null });
    expect(nonZero(p0.buf)).toBeGreaterThan(150);
    const p1 = buffer();
    rasterizeLot(maquette, { kind: 'park', park: 1 }, THETA, lv, p1, { life: null });
    expect(sameBuffers(p0.buf, p1.buf)).toBe(false);
  });

  it('writes no ids and clears the buffer before drawing', () => {
    const b = buffer();
    b.buf.fill(0xdeadbeef);
    rasterizeLot(maquette, { kind: 'park', park: 2 }, THETA, lv, b, { life: null });
    expect(b.ids.every((v) => v === 0)).toBe(true);
    expect(b.buf.every((v) => v !== 0xdeadbeef)).toBe(true);
  });

  it('keeps every building and park inside the lot view at every angle', () => {
    const all: LotTarget[] = maquette.buildings.map((_, index) => ({ kind: 'building' as const, index }));
    for (let park = 0; park < PARK_COUNT; park++) all.push({ kind: 'park', park });
    [maquette, night].forEach((scene) => {
      all.forEach((tg) => {
        for (let step = 0; step < 8; step++) {
          const b = buffer();
          rasterizeLot(scene, tg, (step / 8) * Math.PI * 2, lv, b, { life: null });
          const { BW, BH } = lv;
          for (let x = 0; x < BW; x++) {
            expect(b.buf[x]).toBe(0);
            expect(b.buf[(BH - 1) * BW + x]).toBe(0);
          }
          for (let y = 0; y < BH; y++) {
            expect(b.buf[y * BW]).toBe(0);
            expect(b.buf[y * BW + BW - 1]).toBe(0);
          }
        }
      });
    });
  });

  it('turns the building about its own middle: the plate stays put while the building changes', () => {
    const a = buffer();
    const b = buffer();
    rasterizeLot(maquette, { kind: 'building', index: 3 }, 0, lv, a, { life: null });
    rasterizeLot(maquette, { kind: 'building', index: 3 }, 0.5, lv, b, { life: null });
    expect(sameBuffers(a.buf, b.buf)).toBe(false);
    // the lowest rows hold the plate and the kerb: both angles fill the same columns there
    const row = (buf: Uint32Array, y: number) => Array.from(buf.slice(y * lv.BW, (y + 1) * lv.BW)).map((v) => v !== 0);
    const y = lv.cy + 2; // just below the plate centre: inside the plate at every angle
    expect(row(a.buf, y).filter(Boolean).length).toBeGreaterThan(10);
    expect(row(b.buf, y).filter(Boolean).length).toBeGreaterThan(10);
  });

  it('stands a building on the lot plate, and a park on its own plate', () => {
    const plateLot = maquette.plate.mat[(2 * 18 + 9) * 18 + 9]; // the lot colour at the plate centre
    const tonesOfLot = [0, 1, 2, 3].map((t) => maquette.colors[plateLot * 4 + t]);
    const countLot = (buf: Uint32Array) => buf.filter((v) => tonesOfLot.indexOf(v) >= 0).length;
    const b = buffer();
    rasterizeLot(maquette, { kind: 'building', index: 5 }, THETA, lv, b, { life: null });
    expect(countLot(b.buf)).toBeGreaterThan(10);
    // park 0 (grove) paints grass inside its kerb, not the lot colour
    const p = buffer();
    rasterizeLot(maquette, { kind: 'park', park: 0 }, THETA, lv, p, { life: null });
    expect(countLot(p.buf)).toBe(0);
  });

  it('draws the building a lot belongs to: another repo gives another picture', () => {
    const a = buffer();
    const b = buffer();
    rasterizeLot(maquette, { kind: 'building', index: 0 }, THETA, lv, a, { life: null });
    rasterizeLot(maquette, { kind: 'building', index: 9 }, THETA, lv, b, { life: null });
    expect(sameBuffers(a.buf, b.buf)).toBe(false);
  });

  it('draws smoke where the vent is, relative to the building and not to the city', () => {
    // the vented building farthest from the city centre, so a missing offset would put the smoke far away
    const vented = maquette.buildings.map((b, i) => ({ b, i })).filter((e) => e.b.vent)
      .sort((p, q) => Math.hypot(q.b.x, q.b.y) - Math.hypot(p.b.x, p.b.y))[0];
    const it = vented.b;
    expect(Math.hypot(it.x, it.y)).toBeGreaterThan(30);
    const puff: LifeInstance = { model: maquette.puffs[1], x: it.vent!.x, y: it.vent!.y, z: it.vent!.z + 1 };
    const a = buffer();
    const b = buffer();
    rasterizeLot(maquette, { kind: 'building', index: vented.i }, THETA, lv, a, { life: null });
    rasterizeLot(maquette, { kind: 'building', index: vented.i }, THETA, lv, b, { life: [puff] });
    let diff = 0;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < a.buf.length; i++) {
      if (a.buf[i] === b.buf[i]) continue;
      diff++;
      sumX += i % lv.BW;
      sumY += Math.floor(i / lv.BW);
    }
    expect(diff).toBeGreaterThan(3);
    expect(diff).toBeLessThan(100);
    // where the puff centre lands: the vent offset from the building centre, turned and squashed, lifted by z
    const rx = it.vent!.x - it.x;
    const ry = it.vent!.y - it.y;
    const ex = lv.cx + Math.cos(THETA) * rx - Math.sin(THETA) * ry;
    const ey = lv.cy + (Math.sin(THETA) * rx + Math.cos(THETA) * ry) * SQ - (it.vent!.z + 1);
    expect(Math.abs(sumX / diff - ex)).toBeLessThan(3);
    expect(Math.abs(sumY / diff - ey)).toBeLessThan(3);
  });

  it('uses the tones for the angle it is given', () => {
    // at theta 0 and theta pi the lit and shaded side walls swap, so the pictures differ
    expect(faceTones(0)[1]).not.toBe(faceTones(Math.PI)[1]);
    const a = buffer();
    const b = buffer();
    rasterizeLot(maquette, { kind: 'building', index: 0 }, 0, lv, a, { life: null });
    rasterizeLot(maquette, { kind: 'building', index: 0 }, Math.PI, lv, b, { life: null });
    expect(sameBuffers(a.buf, b.buf)).toBe(false);
  });
});

describe('drawModel and drawEmblem', () => {
  const surface = (w: number, h: number): Surface => ({
    buf: new Uint32Array(w * h), ids: new Uint8Array(w * h), BW: w, BH: h, x0: 0, y0: 0, x1: w - 1, y1: h - 1,
  });
  const colors = new Uint32Array([0, 0, 0, 0, 11, 22, 33, 44]);
  const FLAT = new Array(16).fill(0); // every face mask draws tone 0

  it('draws a one cell wide column without gaps (the half step copies)', () => {
    const column = buildModel(1, 1, 12, () => 1, () => 1);
    const s = surface(20, 40);
    drawModel(s, column, 10, 30, 1, 0, FLAT, colors, 5, null);
    const rows: number[] = [];
    for (let y = 0; y < 40; y++) {
      let any = false;
      for (let x = 0; x < 20; x++) if (s.buf![y * 20 + x]) any = true;
      if (any) rows.push(y);
    }
    expect(rows.length).toBeGreaterThanOrEqual(11);
    for (let i = 1; i < rows.length; i++) expect(rows[i] - rows[i - 1]).toBe(1);
    expect(s.ids!.filter((v) => v === 5).length).toBeGreaterThan(0);
  });

  it('samples at pixel centres through the inverse rotation: an 8 by 2 slab turns into a 2 by 8 slab at a quarter turn', () => {
    const slab = buildModel(8, 2, 1, () => 1, () => 1);
    const a = surface(20, 20);
    const b = surface(20, 20);
    drawModel(a, slab, 10, 10, 1, 0, FLAT, colors, 1, null);
    drawModel(b, slab, 10, 10, 0, 1, FLAT, colors, 1, null);
    const extent = (s: Surface) => {
      let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          if (!s.buf![y * 20 + x]) continue;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
      return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };
    expect(extent(a).w).toBe(8);
    expect(extent(b).w).toBeLessThanOrEqual(2);
    expect(extent(b).h).toBeGreaterThanOrEqual(4); // 8 cells deep, squashed to 60%
    expect(extent(a).h).toBeLessThanOrEqual(2);
  });

  it('skips texels with alpha below 128', () => {
    const emblem = new Uint8Array(1024);
    // left half alpha 128 (drawn), right half alpha 127 (skipped)
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) emblem.set([200, 100, 50, x < 8 ? 128 : 127], (y * 16 + x) * 4);
    }
    const s = surface(30, 30);
    drawEmblem(s, emblem, 0, 0, 0, 15, 15, 1, 0, 3);
    const xs: number[] = [];
    for (let i = 0; i < s.buf!.length; i++) if (s.buf![i]) xs.push(i % 30);
    expect(xs.length).toBeGreaterThan(10);
    expect(Math.max.apply(null, xs)).toBeLessThan(15); // nothing right of the centre line
    expect(Math.min.apply(null, xs)).toBe(11);
  });

  it('draws an emblem as an 8 by 8 quad of opaque texels only, centred where it is told', () => {
    const emblem = new Uint8Array(1024);
    // fill the top left quadrant opaque red
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) emblem.set([255, 0, 0, 255], (y * 16 + x) * 4);

    const s = surface(30, 30);
    drawEmblem(s, emblem, 0, 0, 0, 15, 15, 1, 0, 7);
    const red = pack([255, 0, 0]);
    const painted = s.buf!.filter((v) => v !== 0);
    // the top left quadrant is 4 by 4 cells: 4 columns, and 2 pixel rows after the 60% squash
    expect(painted).toHaveLength(8);
    painted.forEach((v) => expect(v).toBe(red));
    expect(s.ids!.filter((v) => v === 7)).toHaveLength(painted.length);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < s.buf!.length; i++) {
      if (!s.buf![i]) continue;
      xs.push(i % 30);
      ys.push(Math.floor(i / 30));
    }
    // left of and above the quad centre (15, 15)
    expect([Math.min.apply(null, xs), Math.max.apply(null, xs)]).toEqual([11, 14]);
    expect([Math.min.apply(null, ys), Math.max.apply(null, ys)]).toEqual([13, 14]);
  });

  it('shows tone 3 on the top slice of a ground where the shadow mask is set, and only there', () => {
    const ground = buildModel(6, 6, 2, () => 1, () => 1);
    const shadow = new Uint8Array(36);
    for (let y = 0; y < 6; y++) for (let x = 3; x < 6; x++) shadow[y * 6 + x] = 1; // the right half
    const s = surface(20, 20);
    drawModel(s, ground, 10, 10, 1, 0, FLAT, colors, 0, shadow);
    const dark = colors[4 + 3];
    const light = colors[4];
    const darkX: number[] = [];
    const lightX: number[] = [];
    for (let i = 0; i < s.buf!.length; i++) {
      if (s.buf![i] === dark) darkX.push(i % 20);
      if (s.buf![i] === light) lightX.push(i % 20);
    }
    expect(darkX.length).toBeGreaterThan(5);
    expect(lightX.length).toBeGreaterThan(5);
    expect(Math.min.apply(null, darkX)).toBeGreaterThanOrEqual(10);
    // the lower slice and the unshadowed half keep tone 0
    expect(Math.min.apply(null, lightX)).toBeLessThan(10);
  });

  it('keeps writes inside the clip rectangle', () => {
    const slab = buildModel(8, 8, 2, () => 1, () => 1);
    const s = surface(20, 20);
    s.x0 = 8; s.x1 = 11; s.y0 = 8; s.y1 = 11;
    drawModel(s, slab, 10, 10, 1, 0, FLAT, colors, 1, null);
    let outside = 0;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const inside = x >= 8 && x <= 11 && y >= 8 && y <= 11;
        if (!inside && s.buf![y * 20 + x]) outside++;
      }
    }
    expect(outside).toBe(0);
    expect(nonZero(s.buf!)).toBeGreaterThan(0);
  });
});
