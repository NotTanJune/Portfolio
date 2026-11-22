import { PARK_COUNT } from './parks';
import { applyBlink, computeLighting, faceTones, makeScene, placeItems } from './scene';
import { NOW, snapshotRepos, syntheticRepos } from './test-helpers';
import { Scene, StyleKey } from './types';

const repos = snapshotRepos();

describe('makeScene', () => {
  (['maquette', 'night'] as StyleKey[]).forEach((style) => {
    describe(`${style} scene`, () => {
      const scene = makeScene(repos, style, NOW);

      it('has one building item per repo, in lot order, plus trees', () => {
        expect(scene.buildings).toHaveLength(repos.length);
        expect(scene.emblems).toHaveLength(repos.length);
        scene.emblems.forEach((e) => expect(e).toHaveLength(1024));
        expect(scene.items.length).toBeGreaterThan(scene.buildings.length);
        // buildings are the items that have a repo, in the same order
        const withRepo = scene.items.filter((it) => it.repo);
        expect(withRepo).toEqual(scene.buildings);
        expect(scene.items.slice(0, scene.buildings.length)).toEqual(scene.buildings);
        const names = scene.buildings.map((b) => b.repo!.name).sort();
        expect(names).toEqual(repos.map((r) => r.name).sort());
        scene.items.filter((it) => !it.repo).forEach((t) => expect(t.roof).toBeNull());
      });

      it('has at least two items with a vent', () => {
        expect(scene.items.filter((it) => it.vent).length).toBeGreaterThanOrEqual(2);
      });

      it('gives the biggest repo the lot nearest the centre', () => {
        const biggest = repos.slice().sort((a, b) => b.sizeKB - a.sizeKB)[0];
        expect(scene.buildings[0].repo!.name).toBe(biggest.name);
      });

      it('uses only material ids that exist in the colour table', () => {
        const count = scene.colors.length / 4;
        expect(count).toBeLessThanOrEqual(256);
        const all = [scene.ground, scene.plate].concat(scene.parks, scene.puffs, scene.items.map((i) => i.model));
        scene.cars.forEach((c) => c.forEach((o) => o.forEach((m) => all.push(m))));
        all.forEach((m) => {
          for (let i = 0; i < m.mat.length; i++) expect(m.mat[i]).toBeLessThan(count);
        });
      });

      it('exposes the models the renderers need', () => {
        expect(scene.parks).toHaveLength(PARK_COUNT);
        expect(scene.cars).toHaveLength(3);
        expect(scene.puffs).toHaveLength(3);
        expect(scene.plate.H).toBe(3);
        expect(scene.maxTop).toBe(Math.max.apply(null, scene.items.map((i) => i.top)));
        expect(scene.shadowMask).toHaveLength(scene.GW * scene.GD);
        expect(scene.ground.w).toBe(scene.GW);
        expect(scene.ground.d).toBe(scene.GD);
      });
    });
  });

  it('builds the same city in both styles', () => {
    const a = makeScene(repos, 'maquette', NOW);
    const b = makeScene(repos, 'night', NOW);
    expect(a.buildings.map((i) => i.repo!.name)).toEqual(b.buildings.map((i) => i.repo!.name));
    expect([a.GW, a.GD, a.cols, a.rows]).toEqual([b.GW, b.GD, b.cols, b.rows]);
    a.buildings.forEach((it, i) => {
      expect([it.x, it.y, it.w, it.d]).toEqual([b.buildings[i].x, b.buildings[i].y, b.buildings[i].w, b.buildings[i].d]);
    });
  });

  it('is deterministic for the same repos, style and time', () => {
    const a = makeScene(repos, 'night', NOW);
    const b = makeScene(repos, 'night', NOW);
    expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
    expect(Array.from(a.ground.mat)).toEqual(Array.from(b.ground.mat));
    a.items.forEach((it, i) => expect(Array.from(it.model.mat)).toEqual(Array.from(b.items[i].model.mat)));
  });

  it('lights windows according to the time it is given', () => {
    // emissive materials have one colour in all four tones: lit windows and the roof rim at night
    const emissiveCells = (scene: Scene) => {
      const emissive: Record<number, boolean> = {};
      for (let id = 1; id < scene.colors.length / 4; id++) {
        const c = scene.colors.slice(id * 4, id * 4 + 4);
        if (c[0] === c[1] && c[1] === c[2] && c[2] === c[3]) emissive[id] = true;
      }
      let n = 0;
      scene.buildings.forEach((b) => {
        for (let i = 0; i < b.model.mat.length; i++) if (emissive[b.model.mat[i]]) n++;
      });
      return n;
    };
    const recent = makeScene(repos, 'night', NOW);
    const old = makeScene(repos, 'night', NOW + 5 * 365 * 86400000);
    expect(emissiveCells(recent)).toBeGreaterThan(emissiveCells(old));
  });

  it('builds a 40 repo city of every language without passing 255 materials', () => {
    const scene = makeScene(syntheticRepos(40), 'night', NOW);
    expect(scene.buildings).toHaveLength(40);
    expect(scene.colors.length / 4).toBeLessThanOrEqual(256);
    expect(scene.cols).toBe(8);
    expect(scene.rows).toBe(6);
  });
});

describe('faceTones', () => {
  it('leaves entry 0 empty and uses only tones 1 to 3', () => {
    [0, 0.62, 1.5, 3.1, 4.7, 6].forEach((theta) => {
      const t = faceTones(theta);
      expect(t).toHaveLength(16);
      expect(t[0]).toBe(0);
      for (let m = 1; m < 16; m++) {
        expect(t[m]).toBeGreaterThanOrEqual(1);
        expect(t[m]).toBeLessThanOrEqual(3);
      }
    });
  });

  it('lights the face that points at the light and shades the one that points away', () => {
    // theta = 0: the -x face (mask 1) points toward the light at screen left, the +x face (mask 2) away from it
    const t = faceTones(0);
    expect(t[1]).toBe(1);
    expect(t[2]).toBe(3);
    // after half a turn the two swap
    const half = faceTones(Math.PI);
    expect(half[1]).toBe(3);
    expect(half[2]).toBe(1);
  });

  it('follows the brightness thresholds 0.3 and -0.45 for the screen-space light (-0.99, 0.14)', () => {
    const normals = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const seen: Record<number, boolean> = {};
    for (let step = 0; step < 40; step++) {
      const theta = (step / 40) * Math.PI * 2;
      const t = faceTones(theta);
      const bright = normals.map(([nx, ny]) => {
        const rx = Math.cos(theta) * nx - Math.sin(theta) * ny;
        const ry = Math.sin(theta) * nx + Math.cos(theta) * ny;
        return { b: rx * -0.99 + ry * 0.14, ry };
      });
      for (let f = 0; f < 4; f++) {
        const b = bright[f].b;
        if (Math.abs(b - 0.3) < 1e-9 || Math.abs(b + 0.45) < 1e-9) continue; // exactly on a threshold
        const expected = b > 0.3 ? 1 : b > -0.45 ? 2 : 3;
        expect(t[1 << f]).toBe(expected);
        seen[expected] = true;
      }
      // with several open faces, the one facing the camera most (largest rotated y) decides
      let best = 0;
      for (let f = 1; f < 4; f++) if (bright[f].ry > bright[best].ry) best = f;
      expect(t[1 | 2 | 4 | 8]).toBe(t[1 << best]);
    }
    expect(Object.keys(seen).sort()).toEqual(['1', '2', '3']);
  });
});

describe('computeLighting', () => {
  const scene = makeScene(repos, 'night', NOW);

  it('stamps tones, shadows and blink', () => {
    computeLighting(scene, 0.62, 0);
    expect(scene.tones[0]).toBe(0);
    for (let m = 0; m < 16; m++) {
      expect(scene.tones[m]).toBeGreaterThanOrEqual(0);
      expect(scene.tones[m]).toBeLessThanOrEqual(3);
    }
    expect(Array.from(scene.tones)).toEqual(Array.from(faceTones(0.62)));
    expect(scene.shadowMask.length).toBe(scene.GW * scene.GD);
    const shadowed = scene.shadowMask.filter((v) => v === 1).length;
    expect(shadowed).toBeGreaterThan(500);
    expect(shadowed).toBeLessThan(scene.GW * scene.GD);
  });

  it('moves the shadows when the angle changes', () => {
    computeLighting(scene, 0.62, 0);
    const a = Array.from(scene.shadowMask);
    computeLighting(scene, 2.4, 0);
    expect(Array.from(scene.shadowMask)).not.toEqual(a);
  });

  it('blinks the beacon on a 12 tick cycle: on for 6 ticks, off for 6', () => {
    expect(scene.blinkers).toHaveLength(1);
    const n = scene.blinkers[0].n;
    const colorAt = (timeMs: number) => {
      computeLighting(scene, 0.62, timeMs);
      return scene.colors[n * 4];
    };
    const on = colorAt(0);
    expect(on).toBe(scene.blinkers[0].on);
    expect(colorAt(125 * 5)).toBe(on);
    const off = colorAt(125 * 6);
    expect(off).toBe(scene.blinkers[0].off);
    expect(off).not.toBe(on);
    expect(colorAt(125 * 11)).toBe(off);
    expect(colorAt(125 * 12)).toBe(on);
  });

  it('applyBlink writes all four tones of the material', () => {
    applyBlink(scene, 6);
    const n = scene.blinkers[0].n;
    expect(Array.from(scene.colors.slice(n * 4, n * 4 + 4))).toEqual(new Array(4).fill(scene.blinkers[0].off));
  });

  it('the day style has no blinking material', () => {
    expect(makeScene(repos, 'maquette', NOW).blinkers).toHaveLength(0);
  });
});

describe('placeItems', () => {
  it('projects the item centre: sx = cx + cos * x - sin * y, sy = cy + (sin * x + cos * y) * 0.6', () => {
    const scene = makeScene(repos, 'maquette', NOW);
    const theta = 0.62;
    const placed = placeItems(scene, theta, 100, 200);
    expect(placed).toHaveLength(scene.items.length);
    placed.forEach((p) => {
      expect(p.sx).toBeCloseTo(100 + Math.cos(theta) * p.item.x - Math.sin(theta) * p.item.y, 9);
      expect(p.sy).toBeCloseTo(200 + (Math.sin(theta) * p.item.x + Math.cos(theta) * p.item.y) * 0.6, 9);
    });
    // building indices count up in order; trees are -1
    const indices = placed.filter((p) => p.index >= 0).map((p) => p.index);
    expect(indices).toEqual(scene.buildings.map((_, i) => i));
    placed.filter((p) => !p.item.repo).forEach((p) => expect(p.index).toBe(-1));
    placed.filter((p) => p.index >= 0).forEach((p) => expect(scene.buildings[p.index]).toBe(p.item));
  });
});
