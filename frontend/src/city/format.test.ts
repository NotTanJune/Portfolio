import { daysSince, formatAge, shortLanguage } from './format';

describe('formatAge', () => {
  it('writes today, days, then months', () => {
    expect(formatAge(0)).toBe('today');
    expect(formatAge(4)).toBe('4d ago');
    expect(formatAge(59)).toBe('59d ago');
    expect(formatAge(60)).toBe('2mo ago');
    expect(formatAge(90)).toBe('3mo ago');
  });
});

describe('shortLanguage', () => {
  it('shortens only Jupyter Notebook', () => {
    expect(shortLanguage('Jupyter Notebook')).toBe('Jupyter');
    expect(shortLanguage('Rust')).toBe('Rust');
  });
});

describe('daysSince', () => {
  it('counts whole days and never goes negative', () => {
    const now = Date.parse('2026-11-21T12:00:00Z');
    expect(daysSince('2026-11-21T00:00:00Z', now)).toBe(0);
    expect(daysSince('2026-11-17T11:00:00Z', now)).toBe(4);
    expect(daysSince('2027-01-01T00:00:00Z', now)).toBe(0);
  });
});
