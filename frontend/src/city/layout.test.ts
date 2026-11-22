import {
  assignLots, gridFor, groundSize, LOT_K, lotHeightPx, lotView, PITCH, ROAD, SQ, viewFor,
} from './layout';
import { PARK_COUNT, PLATE } from './parks';
import { makeScene } from './scene';
import { NOW, snapshotRepos, syntheticRepos } from './test-helpers';

describe('grid', () => {
  it('sizes the grid from the repo count', () => {
    expect(gridFor(27)).toEqual({ cols: 6, rows: 5 });
    expect(gridFor(30)).toEqual({ cols: 7, rows: 5 });
    expect(gridFor(1)).toEqual({ cols: 4, rows: 3 });
    expect(groundSize(7, 5)).toEqual({ GW: 7 * 16 + 8 * 5, GD: 5 * 16 + 6 * 5 });
  });

  it('always leaves at least two lots for parks', () => {
    for (let n = 0; n <= 60; n++) {
      const { cols, rows } = gridFor(n);
      expect(cols * rows - n).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('assignLots', () => {
  const repos = syntheticRepos(27);
  const { cols, rows } = gridFor(27);
  const a = assignLots(repos, cols, rows);

  it('gives every repo a distinct lot and leaves at least 2 parks', () => {
    expect(a.lots).toHaveLength(27);
    const keys = a.lots.concat(a.parks).map((l) => l.c + ',' + l.r);
    expect(new Set(keys).size).toBe(cols * rows);
    expect(a.parks.length).toBeGreaterThanOrEqual(2);
    a.lots.forEach((l) => {
      expect(l.x).toBe(ROAD + l.c * PITCH);
      expect(l.y).toBe(ROAD + l.r * PITCH);
    });
  });

  it('sorts the repos by size and puts the biggest nearest the grid centre', () => {
    for (let i = 1; i < a.repos.length; i++) expect(a.repos[i - 1].sizeKB).toBeGreaterThanOrEqual(a.repos[i].sizeKB);
    const dist = (l: { c: number; r: number }) => Math.hypot(l.c - (cols - 1) / 2, (l.r - (rows - 1) / 2) * 1.15);
    const first = dist(a.lots[0]);
    a.lots.concat(a.parks).forEach((l) => expect(dist(l)).toBeGreaterThanOrEqual(first));
    a.parks.forEach((p) => a.lots.forEach((l) => expect(dist(p)).toBeGreaterThanOrEqual(dist(l))));
  });

  it('breaks a size tie by name and does not mutate its input', () => {
    const tie = [
      { ...repos[0], name: 'b-repo', sizeKB: 5 },
      { ...repos[1], name: 'a-repo', sizeKB: 5 },
    ];
    const t = assignLots(tie, 4, 3);
    expect(t.repos.map((r) => r.name)).toEqual(['a-repo', 'b-repo']);
    expect(tie.map((r) => r.name)).toEqual(['b-repo', 'a-repo']);
  });

  it('is deterministic', () => {
    const b = assignLots(repos, cols, rows);
    expect(b.lots.map((l) => l.c + ',' + l.r)).toEqual(a.lots.map((l) => l.c + ',' + l.r));
  });

  it('throws when there are more repos than lots', () => {
    expect(() => assignLots(syntheticRepos(13), 4, 3)).toThrow();
  });
});

describe('framing', () => {
  const repos = snapshotRepos();
  const maquette = makeScene(repos, 'maquette', NOW);
  const night = makeScene(repos, 'night', NOW);

  it('viewFor keeps every item on the canvas at every angle', () => {
    const view = viewFor(maquette, night);
    [maquette, night].forEach((scene) => {
      for (let step = 0; step < 24; step++) {
        const theta = (step / 24) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        scene.items.forEach((it) => {
          const sx = view.cx + cos * it.x - sin * it.y;
          const sy = view.cy + (sin * it.x + cos * it.y) * SQ;
          expect(sx).toBeGreaterThanOrEqual(0);
          expect(sx).toBeLessThanOrEqual(view.BW);
          expect(sy - it.top - (it.vent ? 14 : 0)).toBeGreaterThanOrEqual(0);
          expect(sy).toBeLessThanOrEqual(view.BH);
        });
      }
    });
    expect(view.cx).toBe(view.BW / 2);
  });

  it('viewFor is not much taller than the tallest building needs', () => {
    const view = viewFor(maquette, night);
    // the plate alone needs RAD * SQ above and below its centre
    const plateOnly = Math.hypot(maquette.GW, maquette.GD) * SQ;
    expect(view.BH).toBeGreaterThan(plateOnly);
    expect(view.BH).toBeLessThan(plateOnly + maquette.maxTop * 3);
  });

  it('lotView is 30 art pixels wide and shared by both styles', () => {
    const view = lotView(maquette, night);
    expect(view.BW).toBe(30);
    expect(view.cx).toBe(15);
    const heights = [maquette, night].map((s) => s.parks.map((p) => p.H));
    expect(heights[0]).toEqual(heights[1]);
    expect(PARK_COUNT).toBe(6);
    expect(PLATE).toBe(18);
  });

  it('lotHeightPx grows with the building and never exceeds the canvas', () => {
    const view = lotView(maquette, night);
    const tops = maquette.buildings.map((b) => b.top);
    const tall = tops.indexOf(Math.max.apply(null, tops));
    const short = tops.indexOf(Math.min.apply(null, tops));
    const hTall = lotHeightPx(view, maquette, { kind: 'building', index: tall });
    const hShort = lotHeightPx(view, maquette, { kind: 'building', index: short });
    expect(hTall).toBeGreaterThan(hShort);
    const limit = view.BH * LOT_K + 4;
    maquette.buildings.forEach((_, index) => {
      expect(lotHeightPx(view, maquette, { kind: 'building', index })).toBeLessThanOrEqual(limit);
    });
    for (let park = 0; park < PARK_COUNT; park++) {
      const h = lotHeightPx(view, maquette, { kind: 'park', park });
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(limit);
    }
  });
});
