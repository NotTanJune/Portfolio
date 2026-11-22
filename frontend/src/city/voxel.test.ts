import { buildModel, Cell } from './voxel';

describe('buildModel', () => {
  // a solid 8 by 6 block, 3 slices high
  const cells: Record<string, Cell> = {};
  const model = buildModel(8, 6, 3, () => 1, (v) => {
    cells[v.x + ',' + v.y + ',' + v.z] = { ...v };
    return 1;
  });
  const maskAt = (x: number, y: number, z: number) => model.mask[(z * 6 + y) * 8 + x];

  it('sets a face bit when open air is within 2 cells in that direction', () => {
    // x = 0 and x = 1 are within 2 of the -x side; x = 2 is not
    expect(maskAt(0, 3, 0) & 1).toBe(1);
    expect(maskAt(1, 3, 0) & 1).toBe(1);
    expect(maskAt(2, 3, 0) & 1).toBe(0);
    // +x side: x = 7 and x = 6 are within 2, x = 5 is not
    expect(maskAt(7, 3, 0) & 2).toBe(2);
    expect(maskAt(6, 3, 0) & 2).toBe(2);
    expect(maskAt(5, 3, 0) & 2).toBe(0);
    // -y and +y use bits 4 and 8
    expect(maskAt(4, 1, 0) & 4).toBe(4);
    expect(maskAt(4, 2, 0) & 4).toBe(0);
    expect(maskAt(4, 4, 0) & 8).toBe(8);
    expect(maskAt(4, 3, 0) & 8).toBe(0);
  });

  it('marks edge cells with a 1 cell test and top cells as those with nothing above', () => {
    expect(cells['0,3,1'].edge).toBe(true);
    expect(cells['1,3,1'].edge).toBe(false);
    expect(cells['4,3,1'].edge).toBe(false);
    expect(cells['4,3,1'].top).toBe(false);
    expect(cells['4,3,2'].top).toBe(true);
  });

  it('flags a single open face and reports the position along the wall', () => {
    const c = cells['0,3,1']; // only the -x face is open
    expect(c.mask).toBe(1);
    expect(c.single).toBe(true);
    expect([c.t, c.tLen]).toEqual([3, 6]); // along y, the depth
    const f = cells['4,0,1']; // only the -y face is open
    expect(f.single).toBe(true);
    expect([f.t, f.tLen]).toEqual([4, 8]); // along x, the width
    expect(cells['0,0,1'].single).toBe(false); // a corner has two open faces
  });

  it('keeps the mask the paint callback leaves, so paint can clear it', () => {
    const m = buildModel(4, 4, 2, () => 1, (v) => {
      if (v.top) v.mask = 0;
      return 2;
    });
    expect(m.mask[(1 * 4 + 0) * 4 + 0]).toBe(0);
    expect(m.mask[(0 * 4 + 0) * 4 + 0]).not.toBe(0);
    expect(Array.from(m.mat).every((id) => id === 2)).toBe(true);
  });

  it('leaves cells with kind 0 empty and reports the model shape', () => {
    const m = buildModel(3, 3, 2, (x, y) => (x === 1 && y === 1 ? 1 : 0), () => 5);
    expect([m.w, m.d, m.H, m.z0]).toEqual([3, 3, 2, 0]);
    expect(Array.from(m.mat).filter((v) => v !== 0)).toHaveLength(2);
    expect(m.mat[(0 * 3 + 1) * 3 + 1]).toBe(5);
    expect(m.mat[0]).toBe(0);
  });
});
