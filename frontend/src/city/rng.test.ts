import { hash, rng } from './rng';

describe('hash', () => {
  it('is stable and an unsigned 32-bit integer', () => {
    const a = hash('locator');
    expect(hash('locator')).toBe(a);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
    expect(hash('locatoR')).not.toBe(a);
  });

  it('is FNV-1a: the empty string is the offset basis and "a" is the published value', () => {
    expect(hash('')).toBe(2166136261);
    expect(hash('a')).toBe(0xe40c292c);
  });
});

describe('rng', () => {
  it('gives the same first three numbers for the same seed', () => {
    const a = rng(1);
    const b = rng(1);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    first.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    });
  });

  it('gives a different sequence for a different seed', () => {
    const a = rng(1);
    const b = rng(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });
});
