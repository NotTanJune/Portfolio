import { emblemFor, loadEmblems, proceduralEmblem } from './emblems';
import { snapshotRepos } from './test-helpers';

const alpha = (e: Uint8Array, x: number, y: number) => e[(y * 16 + x) * 4 + 3];

describe('proceduralEmblem', () => {
  const e = proceduralEmblem('locator', [10, 20, 30]);

  it('is 16 by 16 RGBA with at least 4 opaque pixels, all in the given colour', () => {
    expect(e).toHaveLength(1024);
    let opaque = 0;
    for (let i = 0; i < 256; i++) {
      if (e[i * 4 + 3] === 0) continue;
      opaque++;
      expect(e[i * 4 + 3]).toBe(255);
      expect([e[i * 4], e[i * 4 + 1], e[i * 4 + 2]]).toEqual([10, 20, 30]);
    }
    expect(opaque).toBeGreaterThanOrEqual(4);
  });

  it('is symmetric left to right and keeps a 1 pixel transparent margin', () => {
    ['locator', 'murmur', 'a', 'AI6103-Deep-Learning-and-Applications'].forEach((name) => {
      const em = proceduralEmblem(name, [1, 2, 3]);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) expect(alpha(em, x, y)).toBe(alpha(em, 15 - x, y));
      }
      for (let k = 0; k < 16; k++) {
        expect([alpha(em, k, 0), alpha(em, k, 15), alpha(em, 0, k), alpha(em, 15, k)]).toEqual([0, 0, 0, 0]);
      }
      // the centre cell (pixels 7 and 8 on both axes) is always filled
      expect([alpha(em, 7, 7), alpha(em, 8, 7), alpha(em, 7, 8), alpha(em, 8, 8)]).toEqual([255, 255, 255, 255]);
    });
  });

  it('is identical across calls and differs between names', () => {
    expect(Array.from(proceduralEmblem('locator', [10, 20, 30]))).toEqual(Array.from(e));
    const other = proceduralEmblem('murmur', [10, 20, 30]);
    expect(Array.from(other)).not.toEqual(Array.from(e));
  });

  it('fills cells in 2 by 2 blocks', () => {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        const x = 1 + col * 2;
        const y = 1 + row * 2;
        const a = alpha(e, x, y);
        expect([alpha(e, x + 1, y), alpha(e, x, y + 1), alpha(e, x + 1, y + 1)]).toEqual([a, a, a]);
      }
    }
  });
});

describe('emblems.json', () => {
  const repoNamed = (name: string) => ({ name, language: 'Rust', sizeKB: 1, pushedAt: '2026-01-01T00:00:00Z', stars: 0, url: 'u', homepage: null, fork: false });

  it('holds well-formed emblems for snapshot repos only, and falls back to procedural ones otherwise', () => {
    const loaded = loadEmblems();
    const keys = Object.keys(loaded);
    const snapshotNames = snapshotRepos().map((r) => r.name.toLowerCase());

    keys.forEach((key) => {
      expect(key).toBe(key.toLowerCase());
      expect(loaded[key]).toBeInstanceOf(Uint8Array);
      expect(loaded[key]).toHaveLength(1024);
      expect(snapshotNames).toContain(key);
    });

    // a repo that is not in the file gets exactly its procedural emblem
    const unknown = repoNamed('no-such-repo-zzz-made-up');
    expect(loaded[unknown.name.toLowerCase()]).toBeUndefined();
    expect(Array.from(emblemFor(unknown, [1, 2, 3]))).toEqual(Array.from(proceduralEmblem(unknown.name, [1, 2, 3])));

    // a repo that is in the file gets the loaded bytes, whatever the casing of its name
    if (keys.length > 0) {
      const key = keys[0];
      const mixed = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
      [key, key.toUpperCase(), mixed].forEach((name) => {
        const got = emblemFor(repoNamed(name), [1, 2, 3]);
        expect(Array.from(got)).toEqual(Array.from(loaded[key]));
        expect(Array.from(got)).not.toEqual(Array.from(proceduralEmblem(name, [1, 2, 3])));
      });
    }
  });

  it('decodes base64 entries by lower-cased name and drops entries of the wrong size', () => {
    const bytes = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) bytes[i] = (i * 7) % 256;
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    jest.isolateModules(() => {
      jest.doMock('./emblems.json', () => ({ __esModule: true, default: { Demo: btoa(bin), short: btoa('abc') } }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('./emblems') as typeof import('./emblems');
      const loaded = mod.loadEmblems();
      expect(Object.keys(loaded)).toEqual(['demo']);
      expect(Array.from(loaded.demo)).toEqual(Array.from(bytes));
      const repo = { name: 'DEMO', language: 'Rust', sizeKB: 1, pushedAt: '2026-01-01T00:00:00Z', stars: 0, url: 'u', homepage: null, fork: false };
      expect(Array.from(mod.emblemFor(repo, [1, 2, 3]))).toEqual(Array.from(bytes));
    });
    jest.dontMock('./emblems.json');
  });
});
