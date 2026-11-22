import { NIGHT_PARK, PARK_COUNT, PLATE, parkModels, plateModel } from './parks';
import { makeScene } from './scene';
import { createMaterials, groundMaterials, STYLES } from './styles';
import { NOW, snapshotRepos } from './test-helpers';
import { Model, StyleKey } from './types';

/** FNV-1a over a byte array, as 8 hex digits. */
function checksum(a: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < a.length; i++) {
    h ^= a[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}

const channel = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (h: string): number =>
  0.2126 * channel(parseInt(h.slice(1, 3), 16)) + 0.7152 * channel(parseInt(h.slice(3, 5), 16)) +
  0.0722 * channel(parseInt(h.slice(5, 7), 16));
/** WCAG contrast ratio of two flat colours. */
const contrast = (a: string, b: string): number => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** The plate's top surface (slice 2), under any solid feature. */
const top = (m: Model, x: number, y: number) => m.mat[(2 * m.d + y) * m.w + x];

describe('plateModel', () => {
  it('has 3 slices, sits with its top at height 0, and rings the lot with a kerb', () => {
    const mats = createMaterials('maquette');
    const gm = groundMaterials(mats);
    const plate = plateModel(mats);
    expect([plate.w, plate.d, plate.H, plate.z0]).toEqual([PLATE, PLATE, 3, -2]);
    expect(plate.mat[0]).toBe(gm.soil);
    expect(plate.mat[(1 * PLATE + 5) * PLATE + 5]).toBe(gm.soil);
    expect(top(plate, 0, 0)).toBe(gm.road);
    expect(top(plate, 17, 9)).toBe(gm.road);
    expect(top(plate, 9, 17)).toBe(gm.road);
    expect(top(plate, 8, 8)).toBe(gm.lot);
    for (let k = 0; k < PLATE * PLATE; k++) expect(plate.mask[2 * PLATE * PLATE + k]).toBe(0);
  });
});

describe('parkModels', () => {
  (['maquette', 'night'] as StyleKey[]).forEach((style) => {
    it('builds six distinct 18 by 18 parks for ' + style, () => {
      const parks = parkModels(createMaterials(style), style);
      expect(parks).toHaveLength(PARK_COUNT);
      expect(parks.map((p) => [p.w, p.d, p.z0])).toEqual(parks.map(() => [18, 18, -2]));
      expect(parks.map((p) => p.H)).toEqual([13, 11, 13, 9, 8, 11]);
      for (let a = 0; a < parks.length; a++) {
        for (let b = a + 1; b < parks.length; b++) {
          const same = parks[a].mat.length === parks[b].mat.length &&
            parks[a].mat.every((v, i) => v === parks[b].mat[i]);
          expect(same).toBe(false);
        }
      }
    });
  });

  it('is deterministic', () => {
    const a = parkModels(createMaterials('night'), 'night');
    const b = parkModels(createMaterials('night'), 'night');
    a.forEach((p, i) => {
      expect(Array.from(p.mat)).toEqual(Array.from(b[i].mat));
      expect(Array.from(p.mask)).toEqual(Array.from(b[i].mask));
    });
  });

  it('paints the features the design table asks for', () => {
    const mats = createMaterials('maquette');
    const gm = groundMaterials(mats);
    const water = mats.get('#9dbfb8');
    const stone = mats.get('#b6b09c');
    const wood = mats.get(STYLES.maquette.trunk);
    const leaf = mats.get(STYLES.maquette.leaf);
    const parks = parkModels(mats, 'maquette');
    const [grove, pond, path, garden, fountain, orchard] = parks;
    const trunk = (m: Model, x: number, y: number) => m.mat[(3 * 18 + y) * 18 + x] === wood;
    const ids = (m: Model) => Array.from(new Set(Array.from(m.mat)));

    expect(top(grove, 3, 3)).toBe(gm.grass);
    expect(ids(grove)).toEqual(expect.arrayContaining([wood, leaf]));
    expect(ids(grove)).not.toContain(water);

    [[6, 6], [12, 9], [6, 13]].forEach(([x, y]) => expect(trunk(grove, x, y)).toBe(true));
    expect(trunk(grove, 7, 7)).toBe(false);
    expect(trunk(pond, 4, 4)).toBe(true);
    expect(trunk(path, 12, 4) && trunk(path, 4, 13)).toBe(true);
    [[5, 5], [12, 5], [5, 12], [12, 12]].forEach(([x, y]) => expect(trunk(orchard, x, y)).toBe(true));

    expect(top(pond, 10, 9)).toBe(water);   // pond centre
    expect(top(pond, 2, 15)).toBe(gm.grass);
    expect(pond.mat[(3 * 18 + 10) * 18 + 5]).toBe(stone); // stone at (5,10), zz = 0

    expect(top(path, 9, 8)).toBe(gm.lot);
    expect(top(path, 9, 9)).toBe(gm.lot);
    expect(top(path, 9, 11)).toBe(gm.grass);
    expect(path.mat[(3 * 18 + 6) * 18 + 6]).toBe(wood);   // bench at y = 6, x 5 to 7

    expect(top(garden, 4, 5)).toBe(gm.soil);
    expect(top(garden, 8, 5)).toBe(gm.lot);

    expect(top(fountain, 8, 8)).toBe(water);
    expect(top(fountain, 8, 4)).toBe(gm.lot);   // ring 4.5 is below 5
    expect(top(fountain, 8, 1)).toBe(gm.grass);
    expect(fountain.mat[(3 * 18 + 9) * 18 + 9]).toBe(stone); // stone column, zz = 0
    expect(fountain.mat[(0 * 18 + 8) * 18 + 8]).toBe(gm.soil);
  });

  it('clears the mask on every flat top cell so a park top is evenly lit', () => {
    const mats = createMaterials('maquette');
    const gm = groundMaterials(mats);
    parkModels(mats, 'maquette').forEach((p) => {
      let grassCells = 0;
      let lit = 0;
      for (let y = 1; y < 17; y++) {
        for (let x = 1; x < 17; x++) {
          const i = (2 * p.d + y) * p.w + x;
          if (p.mat[i] !== gm.grass) continue;
          grassCells++;
          if (p.mask[i] !== 0) lit++;
        }
      }
      expect(grassCells).toBeGreaterThan(0);
      expect(lit).toBe(0);
    });
  });

  it('leaves the light parks exactly as they were built before the night palette', () => {
    // [mat, mask] checksums captured from the light parks before the night colours were added.
    const expected = [
      ['25614e42', 'd2fedac0'], ['0c643c26', '7803f337'], ['222094ce', '718cfba8'],
      ['4f0f2c2a', 'e5fdf1ac'], ['650afe09', 'c1941cf9'], ['3ca8374d', 'f73c4705'],
    ];
    const parks = parkModels(createMaterials('maquette'), 'maquette');
    expect(parks.map((p) => [checksum(p.mat), checksum(p.mask)])).toEqual(expected);
  });

  it('paints night parks with their own colours, not the night city ground', () => {
    const mats = createMaterials('night');
    const gm = groundMaterials(mats);
    const cityIds = [gm.grass, gm.road, gm.lot, gm.soil, mats.get(STYLES.night.leaf), mats.get(STYLES.night.trunk)];
    const parks = parkModels(mats, 'night');
    parks.forEach((p) => {
      const used = Array.from(new Set(Array.from(p.mat)));
      cityIds.forEach((id) => expect(used).not.toContain(id));
    });
    expect(top(parks[0], 3, 3)).toBe(mats.get(NIGHT_PARK.grass));
    expect(top(parks[0], 3, 3)).not.toBe(gm.grass);
    expect(top(parks[0], 0, 0)).toBe(mats.get(NIGHT_PARK.kerb));
    expect(top(parks[1], 10, 9)).toBe(mats.get(NIGHT_PARK.water));
    expect(top(parks[2], 9, 8)).toBe(mats.get(NIGHT_PARK.paved));
    expect(top(parks[3], 4, 5)).toBe(mats.get(NIGHT_PARK.bed));
    expect(top(parks[3], 4, 5)).not.toBe(top(parks[3], 8, 5));
  });

  it('keeps the night ground, leaf and trunk of the city as they were', () => {
    expect(STYLES.night.ground).toEqual({
      lot: '#202c22', road: '#141c15', dash: '#3d4f40', grass: '#243524', soil: '#0f1810', lamp: '#ffd98a',
    });
    expect(STYLES.night.leaf).toBe('#2f4a33');
    expect(STYLES.night.trunk).toBe('#1c241c');
  });

  it('keeps the night palette legible against the card, with the contrast floors', () => {
    const card = '#1a2419';
    expect(contrast(NIGHT_PARK.grass, card)).toBeGreaterThanOrEqual(2);
    expect(contrast(NIGHT_PARK.leaf, NIGHT_PARK.grass)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(NIGHT_PARK.water, NIGHT_PARK.grass)).toBeGreaterThanOrEqual(1.6);
    expect(contrast(NIGHT_PARK.kerb, card)).toBeGreaterThanOrEqual(2.5);
  });

  it('has the same geometry in both styles: same occupied cells, same face masks', () => {
    const light = parkModels(createMaterials('maquette'), 'maquette');
    const night = parkModels(createMaterials('night'), 'night');
    light.forEach((p, i) => {
      const n = night[i];
      expect([n.w, n.d, n.H, n.z0]).toEqual([p.w, p.d, p.H, p.z0]);
      expect(Array.from(n.mat).map((v) => (v ? 1 : 0))).toEqual(Array.from(p.mat).map((v) => (v ? 1 : 0)));
      expect(Array.from(n.mask)).toEqual(Array.from(p.mask));
    });
  });

  it('colours each feature the same way in both styles (a night colour never stands for two light ones)', () => {
    const light = parkModels(createMaterials('maquette'), 'maquette');
    const night = parkModels(createMaterials('night'), 'night');
    light.forEach((p, i) => {
      const map: Record<number, number> = {};
      for (let k = 0; k < p.mat.length; k++) {
        const nid = night[i].mat[k];
        if (map[nid] === undefined) map[nid] = p.mat[k];
        expect(map[nid]).toBe(p.mat[k]);
      }
    });
  });

  it('keeps the 30-repo night scene under the 255 material limit', () => {
    const scene = makeScene(snapshotRepos(), 'night', NOW);
    expect(scene.colors.length / 4).toBeLessThanOrEqual(255);
  });
});
