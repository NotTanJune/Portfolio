import snapshot from './snapshot.json';
import { CityRepo } from './types';

/** The committed snapshot's repos. */
export function snapshotRepos(): CityRepo[] {
  return (snapshot.repos as unknown) as CityRepo[];
}

const LANGUAGES = ['Rust', 'Swift', 'TypeScript', 'Python', 'JavaScript', 'C++', 'HTML', 'Jupyter Notebook', 'Shell', 'Logos'];

/** `n` deterministic repos with sizes from a few KB to a few hundred MB, so every height shows up. */
export function syntheticRepos(n: number): CityRepo[] {
  const out: CityRepo[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      name: 'synthetic-' + i,
      language: LANGUAGES[i % LANGUAGES.length],
      sizeKB: Math.round(Math.pow(10, (i * 5.3) / Math.max(1, n - 1))) + (i % 3),
      pushedAt: new Date(Date.UTC(2026, 10, 21) - i * i * 86400000).toISOString(),
      stars: i % 4 === 0 ? 3 : 0,
      url: 'https://github.com/NotTanJune/synthetic-' + i,
      homepage: null,
      fork: false,
    });
  }
  return out;
}

/** A fixed "now" so lit windows never depend on the day the tests run. */
export const NOW = Date.UTC(2026, 10, 21, 12);
