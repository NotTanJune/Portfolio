import { carCount, carInstance, LIFE_HZ, lifeInstances, lifeTick, lotPuffs } from './life';
import { makeScene } from './scene';
import { NOW, snapshotRepos, syntheticRepos } from './test-helpers';

const repos = snapshotRepos();
const maquette = makeScene(repos, 'maquette', NOW);
const night = makeScene(repos, 'night', NOW);

describe('the life clock', () => {
  it('runs at 8 ticks a second', () => {
    expect(LIFE_HZ).toBe(8);
    expect(lifeTick(0)).toBe(0);
    expect(lifeTick(124)).toBe(0);
    expect(lifeTick(125)).toBe(1);
    expect(lifeTick(1000)).toBe(8);
  });

  it('puts 3 to 8 cars on the road, scaling with the number of buildings', () => {
    expect(carCount(2)).toBe(3);
    expect(carCount(12)).toBe(3);
    expect(carCount(20)).toBe(5);
    expect(carCount(30)).toBe(8);
    expect(carCount(200)).toBe(8);
  });
});

describe('lifeInstances', () => {
  it('is a pure function of the tick', () => {
    [0, 1, 37, 4000].forEach((t) => {
      expect(lifeInstances(maquette, t)).toEqual(lifeInstances(maquette, t));
    });
    // and it differs from one tick to the next
    expect(lifeInstances(maquette, 5)).not.toEqual(lifeInstances(maquette, 6));
  });

  it('drives the same cars in both styles; only the smoke follows each style\'s own vent buildings', () => {
    // Cars come from hash('car' + k), so their route does not depend on the style. Vents come from each style's
    // prop list ('night' has beacons too), so the buildings that smoke can differ between the styles.
    const n = carCount(maquette.buildings.length);
    expect(carCount(night.buildings.length)).toBe(n);
    let compared = 0;
    for (let t = 0; t < 200; t += 3) {
      for (let k = 0; k < n; k++) {
        const a = carInstance(maquette, k, t);
        const b = carInstance(night, k, t);
        expect(a === null).toBe(b === null);
        if (a && b) {
          expect([b.x, b.y, b.z]).toEqual([a.x, a.y, a.z]);
          expect(b.model.w).toBe(a.model.w);
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(100);
    [maquette, night].forEach((scene) => {
      const vents = scene.buildings.filter((b) => b.vent).length;
      expect(vents).toBeGreaterThanOrEqual(2);
      const smoke = lifeInstances(scene, 90).filter((l) => scene.puffs.indexOf(l.model) >= 0);
      expect(smoke).toHaveLength(vents * 3);
    });
  });

  it('holds exactly the cars that are on the plate plus 3 puffs per vent', () => {
    const vents = maquette.buildings.filter((b) => b.vent).length;
    expect(vents).toBeGreaterThanOrEqual(2);
    for (let t = 0; t < 50; t++) {
      let onPlate = 0;
      for (let k = 0; k < carCount(maquette.buildings.length); k++) if (carInstance(maquette, k, t * 13)) onPlate++;
      expect(lifeInstances(maquette, t * 13)).toHaveLength(onPlate + vents * 3);
    }
  });

  it('only uses car models for cars and puff models for smoke', () => {
    const flatCars: typeof maquette.puffs = [];
    maquette.cars.forEach((c) => c.forEach((o) => o.forEach((m) => flatCars.push(m))));
    expect(flatCars).toHaveLength(maquette.cars.length * 4);
    const list = lifeInstances(maquette, 321);
    expect(list.length).toBeGreaterThan(6);
    list.forEach((l) => {
      const isCar = flatCars.indexOf(l.model) >= 0;
      const isPuff = maquette.puffs.indexOf(l.model) >= 0;
      expect(isCar !== isPuff).toBe(true);
    });
  });
});

describe('cars', () => {
  const n = carCount(maquette.buildings.length);

  it('move exactly one unit a tick while on the plate, so they never jump', () => {
    let steps = 0;
    for (let k = 0; k < n; k++) {
      for (let t = 0; t < 1500; t++) {
        const a = carInstance(maquette, k, t);
        const b = carInstance(maquette, k, t + 1);
        if (!a || !b) continue;
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(1, 9);
        steps++;
      }
    }
    expect(steps).toBeGreaterThan(1000);
  });

  it('stay on the plate: the whole car, at every tick', () => {
    let drawn = 0;
    for (let k = 0; k < n; k++) {
      for (let t = 0; t < 1500; t++) {
        const c = carInstance(maquette, k, t);
        if (!c) continue;
        drawn++;
        expect(c.x - c.model.w / 2).toBeGreaterThanOrEqual(-maquette.GW / 2);
        expect(c.x + c.model.w / 2).toBeLessThanOrEqual(maquette.GW / 2);
        expect(c.y - c.model.d / 2).toBeGreaterThanOrEqual(-maquette.GD / 2);
        expect(c.y + c.model.d / 2).toBeLessThanOrEqual(maquette.GD / 2);
        expect(c.z).toBe(0);
      }
    }
    expect(drawn).toBeGreaterThan(1000);
  });

  it('leave the plate and come back: every car is absent for some ticks and present for others', () => {
    for (let k = 0; k < n; k++) {
      let present = 0;
      let absent = 0;
      const span = maquette.GW + maquette.GD + 16;
      for (let t = 0; t < span; t++) (carInstance(maquette, k, t) ? present++ : absent++);
      expect(present).toBeGreaterThan(20);
      expect(absent).toBeGreaterThan(0);
    }
  });

  it('keep to the lanes of a road: across the road they are 1 or 4 cells into the 5 cell road', () => {
    for (let k = 0; k < n; k++) {
      for (let t = 0; t < 400; t++) {
        const c = carInstance(maquette, k, t);
        if (!c) continue;
        const along = c.model.w === 4 ? c.y + maquette.GD / 2 : c.x + maquette.GW / 2;
        const across = along % 21;
        expect([1, 4]).toContain(across);
      }
    }
  });

  it('a small city has fewer cars than a big one', () => {
    const small = makeScene(syntheticRepos(8), 'maquette', NOW);
    expect(carCount(small.buildings.length)).toBe(3);
    expect(carCount(small.buildings.length)).toBeLessThan(n);
    const vents = small.buildings.filter((b) => b.vent).length;
    for (let t = 0; t < 400; t += 9) {
      let onPlate = 0;
      for (let k = 0; k < 3; k++) if (carInstance(small, k, t)) onPlate++;
      expect(lifeInstances(small, t)).toHaveLength(onPlate + vents * 3);
    }
  });
});

describe('smoke', () => {
  const vented = maquette.buildings.filter((b) => b.vent);

  it('is 3 puffs for every building with a vent, none for one without', () => {
    expect(vented.length).toBeGreaterThanOrEqual(2);
    maquette.buildings.forEach((b) => {
      for (let t = 0; t < 30; t += 7) expect(lotPuffs(maquette, b, t)).toHaveLength(b.vent ? 3 : 0);
    });
  });

  it('always rises above its vent, drifts only to the +x side, and grows then thins', () => {
    vented.forEach((b) => {
      const sizes: Record<number, boolean> = {};
      for (let t = 0; t < 48; t++) {
        lotPuffs(maquette, b, t).forEach((p) => {
          expect(p.z).toBeGreaterThan(b.vent!.z);
          expect(p.x).toBeGreaterThanOrEqual(b.vent!.x);
          expect(p.x).toBeLessThanOrEqual(b.vent!.x + 2);
          expect(p.y).toBe(b.vent!.y);
          sizes[maquette.puffs.indexOf(p.model)] = true;
        });
      }
      expect(Object.keys(sizes).sort()).toEqual(['0', '1', '2']);
    });
  });

  it('repeats every 24 ticks, and each building has its own phase', () => {
    const b = vented[0];
    expect(lotPuffs(maquette, b, 5)).toEqual(lotPuffs(maquette, b, 5 + 24));
    const phases = vented.map((v) => lotPuffs(maquette, v, 0).map((p) => p.z - v.vent!.z).join(','));
    expect(phases.filter((p, i) => phases.indexOf(p) === i).length).toBeGreaterThan(1);
  });
});
