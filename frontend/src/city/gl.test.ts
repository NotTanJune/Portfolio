import { createGLRenderer, INSTANCE_FLOATS, lifeInstanceData } from './gl';
import { buildModel } from './voxel';
import { Model } from './types';

/** There is no WebGL in jsdom, so the renderer itself is checked in a browser; the pure parts are checked here. */
describe('createGLRenderer', () => {
  it('returns null when the canvas has no WebGL2 context', () => {
    const spy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(createGLRenderer(document.createElement('canvas'))).toBeNull();
    spy.mockRestore();
  });

  it('returns null, quietly, when asking for a context throws', () => {
    const spy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => { throw new Error('nope'); });
    expect(createGLRenderer(document.createElement('canvas'))).toBeNull();
    spy.mockRestore();
  });
});

describe('lifeInstanceData', () => {
  const model: Model = buildModel(4, 2, 3, () => 1, () => 1);
  model.ax = 100;
  model.ay = 7;

  it('lays out 8 floats per instance with a half step copy under every slice above the first', () => {
    const data = lifeInstanceData([{ model, x: 5, y: -6, z: 10 }]);
    // 3 slices: 1 + 2 + 2 instances
    expect(INSTANCE_FLOATS).toBe(8);
    expect(data.length).toBe(5 * 8);
    const rows: number[][] = [];
    for (let i = 0; i < 5; i++) rows.push(Array.prototype.slice.call(data, i * 8, i * 8 + 8));
    expect(rows).toEqual([
      [5, -6, 10, 1, 4, 2, 100, 7], // slice 0
      [5, -6, 10.5, 1, 4, 2, 104, 7], // slice 1, half a cell lower
      [5, -6, 11, 1, 4, 2, 104, 7], // slice 1
      [5, -6, 11.5, 1, 4, 2, 108, 7], // slice 2, half a cell lower
      [5, -6, 12, 1, 4, 2, 108, 7], // slice 2
    ]);
  });

  it('does not apply the model z0 (the caller passes the base height)', () => {
    const plate: Model = { ...model, z0: -2, ax: 0, ay: 0 };
    const data = lifeInstanceData([{ model: plate, x: 0, y: 0, z: -2 }]);
    expect(data[2]).toBe(-2);
    expect(data[2 + 8 * 4]).toBe(0);
  });

  it('is empty for no instances and concatenates several in order', () => {
    expect(lifeInstanceData([]).length).toBe(0);
    const two = lifeInstanceData([{ model, x: 1, y: 1, z: 0 }, { model, x: 2, y: 2, z: 0 }]);
    expect(two.length).toBe(10 * 8);
    expect(two[0]).toBe(1);
    expect(two[5 * 8]).toBe(2);
  });
});
