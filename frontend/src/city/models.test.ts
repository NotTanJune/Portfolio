import { assignLots, gridFor, groundSize } from './layout';
import {
  buildingHeight, buildingItem, BuildingSpec, carModels, ensureVents, groundModel, planBuilding, puffModels, treeItems,
} from './models';
import { createMaterials, hex, pack, STYLES } from './styles';
import { CityRepo, StyleKey } from './types';
import { NOW, syntheticRepos } from './test-helpers';

function buildAll(repos: CityRepo[], style: StyleKey) {
  const { cols, rows } = gridFor(repos.length);
  const { GW, GD } = groundSize(cols, rows);
  const lots = assignLots(repos, cols, rows);
  const materials = createMaterials(style);
  const specs = lots.repos.map((r, i) => planBuilding(r, lots.lots[i], style));
  ensureVents(specs);
  return { specs, materials, GW, GD, built: specs.map((s) => buildingItem(s, materials, GW, GD, NOW)) };
}

describe('buildingHeight', () => {
  it('follows 6 + 1.25 * log10(size + 1) squared', () => {
    expect(buildingHeight(2)).toBe(6);
    expect(buildingHeight(117411)).toBe(38);
  });
});

describe('buildings', () => {
  const repos = syntheticRepos(40);

  it('have footprints of 11 to 14 cells and always carry a roof emblem position', () => {
    (['maquette', 'night'] as StyleKey[]).forEach((style) => {
      const { built } = buildAll(repos, style);
      expect(built).toHaveLength(40);
      built.forEach(({ item }) => {
        expect(item.w).toBeGreaterThanOrEqual(11);
        expect(item.w).toBeLessThanOrEqual(14);
        expect(item.d).toBeGreaterThanOrEqual(11);
        expect(item.d).toBeLessThanOrEqual(14);
        expect(item.model.w).toBe(item.w);
        expect(item.model.d).toBe(item.d);
        expect(item.roof).not.toBeNull();
        expect(item.h).toBe(buildingHeight(item.repo!.sizeKB));
        expect(item.top).toBeGreaterThanOrEqual(item.h);
      });
    });
  });

  it('only use the three building types, with the ell forced to 14 wide', () => {
    const { specs } = buildAll(repos, 'maquette');
    const types: Record<string, number> = {};
    specs.forEach((s) => { types[s.type] = (types[s.type] || 0) + 1; });
    expect(Object.keys(types).sort()).toEqual(['ell', 'step', 'tower']);
    const ellWidths = specs.filter((s) => s.type === 'ell').map((s) => s.w);
    expect(ellWidths.length).toBeGreaterThan(0);
    expect(ellWidths.every((w) => w === 14)).toBe(true);
  });

  it('build byte-identical models from the same input', () => {
    const a = buildAll(repos, 'night').built;
    const b = buildAll(repos, 'night').built;
    a.forEach((x, i) => {
      expect(Array.from(x.item.model.mat)).toEqual(Array.from(b[i].item.model.mat));
      expect(Array.from(x.item.model.mask)).toEqual(Array.from(b[i].item.model.mask));
      expect(x.item.roof).toEqual(b[i].item.roof);
      expect(Array.from(x.emblem)).toEqual(Array.from(b[i].emblem));
    });
  });

  it('keep a one cell roof rim: the top body slice leaves at least 40 flat cells', () => {
    const { built, materials } = buildAll(repos, 'maquette');
    built.forEach(({ item }) => {
      const m = item.model;
      const z = item.h - 1;
      let flat = 0;
      let rimmed = 0;
      for (let y = 0; y < m.d; y++) {
        for (let x = 0; x < m.w; x++) {
          const i = (z * m.d + y) * m.w + x;
          if (m.mat[i] && m.mask[i] === 0) flat++;
          if (m.mat[i] && m.mask[i] !== 0) rimmed++;
        }
      }
      expect(flat).toBeGreaterThanOrEqual(40);
      expect(rimmed).toBeGreaterThan(0);
    });
    expect(materials.colors.length / 4).toBeLessThanOrEqual(256);
  });

  it('put windows only on slices 1 and 2 of every 4, from z = 2, and light some of them', () => {
    const { built, materials } = buildAll(repos, 'night');
    const dark = materials.get(STYLES.night.window);
    const lit = materials.get(STYLES.night.windowLit, { emissive: true });
    let litCount = 0;
    built.forEach(({ item }) => {
      const m = item.model;
      for (let z = 0; z < item.h; z++) {
        for (let k = 0; k < m.w * m.d; k++) {
          const id = m.mat[z * m.w * m.d + k];
          if (id !== dark && id !== lit) continue;
          expect(z).toBeGreaterThanOrEqual(2);
          expect([1, 2]).toContain(z % 4);
          if (id === lit) litCount++;
        }
      }
    });
    expect(litCount).toBeGreaterThan(0);
  });

  it('light more windows on a repo pushed today than on one pushed years ago', () => {
    const lots = assignLots(syntheticRepos(1), 4, 3);
    const base: CityRepo = { ...syntheticRepos(1)[0], name: 'lit-test', sizeKB: 50000 };
    const countLit = (pushedAt: string) => {
      const materials = createMaterials('maquette');
      const spec = planBuilding({ ...base, pushedAt }, lots.lots[0], 'maquette');
      const { item } = buildingItem(spec, materials, 100, 100, NOW);
      const lit = materials.get(STYLES.maquette.windowLit, { emissive: true });
      return Array.from(item.model.mat).filter((id) => id === lit).length;
    };
    expect(countLit(new Date(NOW).toISOString())).toBeGreaterThan(countLit('2020-01-01T00:00:00Z'));
  });

  it('put the vent on the roof corner and its top above the roof', () => {
    const { built } = buildAll(repos, 'maquette');
    const vented = built.filter((b) => b.item.vent);
    expect(vented.length).toBeGreaterThanOrEqual(2);
    vented.forEach(({ item }) => {
      expect(item.vent!.z).toBe(item.h + 3);
      expect(item.top).toBe(item.h + 6);
      // the emblem sits away from the vent
      expect(Math.hypot(item.vent!.x - item.roof!.x, item.vent!.y - item.roof!.y)).toBeGreaterThan(2);
    });
  });
});

describe('ensureVents', () => {
  function spec(sizeKB: number, i: number): BuildingSpec {
    const repo: CityRepo = { ...syntheticRepos(1)[0], name: 'quiet-' + i, sizeKB, stars: 0 };
    return planBuilding(repo, { c: 0, r: 0, x: 5, y: 5 }, 'maquette');
  }

  it('gives a vent to the two tallest buildings that have no prop', () => {
    const specs = [1, 10, 100, 300, 5, 30].map(spec);
    specs.forEach((s) => expect(s.prop).toBeNull());
    ensureVents(specs);
    const vented = specs.filter((s) => s.prop === 'vent').map((s) => s.repo.sizeKB).sort((a, b) => a - b);
    expect(vented).toEqual([100, 300]);
  });

  it('leaves the specs alone when two vents already exist', () => {
    const specs = [1, 10, 100].map(spec);
    specs[0].prop = 'vent';
    specs[1].prop = 'vent';
    ensureVents(specs);
    expect(specs.map((s) => s.prop)).toEqual(['vent', 'vent', null]);
  });
});

describe('groundModel and trees', () => {
  it('make a 3 slice ground whose top is flat, with grass only in park lots', () => {
    const { cols, rows } = gridFor(10);
    const { GW, GD } = groundSize(cols, rows);
    const lots = assignLots(syntheticRepos(10), cols, rows);
    const materials = createMaterials('maquette');
    const ground = groundModel(materials, cols, rows, lots.parks);
    expect(ground.w).toBe(GW);
    expect(ground.d).toBe(GD);
    expect(ground.H).toBe(3);
    expect(ground.isGround).toBe(true);
    const grass = materials.get(STYLES.maquette.ground.grass);
    const top = 2 * GW * GD;
    for (let k = 0; k < GW * GD; k++) expect(ground.mask[top + k]).toBe(0);
    const park = lots.parks[0];
    const inPark = top + (park.y + 8) * GW + park.x + 8;
    expect(ground.mat[inPark]).toBe(grass);
    const lot = lots.lots[0];
    expect(ground.mat[top + (lot.y + 8) * GW + lot.x + 8]).not.toBe(grass);
  });

  it('plant two or three trees per park lot with no repo and no roof', () => {
    const { cols, rows } = gridFor(10);
    const { GW, GD } = groundSize(cols, rows);
    const lots = assignLots(syntheticRepos(10), cols, rows);
    const materials = createMaterials('night');
    lots.parks.forEach((lot) => {
      const trees = treeItems(lot, materials, GW, GD);
      expect(trees.length).toBeGreaterThanOrEqual(2);
      expect(trees.length).toBeLessThanOrEqual(3);
      trees.forEach((t) => {
        expect(t.repo).toBeNull();
        expect(t.roof).toBeNull();
        expect(t.vent).toBeNull();
      });
    });
  });
});

describe('life models', () => {
  it('builds cars for every colour, orientation and direction, with the right shape', () => {
    const cars = carModels(createMaterials('maquette'), 'maquette');
    expect(cars).toHaveLength(STYLES.maquette.cars.length);
    cars.forEach((colour) => {
      expect(colour).toHaveLength(2);
      expect([colour[0][0].w, colour[0][0].d, colour[0][0].H]).toEqual([4, 2, 2]);
      expect([colour[1][0].w, colour[1][0].d, colour[1][0].H]).toEqual([2, 4, 2]);
    });
  });

  it('puts an emissive headlight at the front and a tail light at the rear at night only', () => {
    const night = createMaterials('night');
    const cars = carModels(night, 'night');
    const m = cars[0][0][1]; // along x, driving +x: front is x = 3
    const at = (x: number) => m.mat[x];
    const tones = (id: number) => night.colors.slice(id * 4, id * 4 + 4);
    expect(tones(at(3))).toEqual(new Array(4).fill(pack(hex('#ffe9b0'))));
    expect(tones(at(0))).toEqual(new Array(4).fill(pack(hex('#ff5a4d'))));
    const day = createMaterials('maquette');
    const dayCar = carModels(day, 'maquette')[0][0][1];
    expect(dayCar.mat[3]).toBe(dayCar.mat[0]);
  });

  it('builds the three puff sizes', () => {
    const puffs = puffModels(createMaterials('maquette'), 'maquette');
    expect(puffs.map((p) => [p.w, p.d, p.H])).toEqual([[2, 2, 2], [3, 3, 2], [2, 2, 1]]);
  });
});
