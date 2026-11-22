import { useEffect, useState } from 'react';
import snapshot from './snapshot.json';
import { CityData, CityRepo } from './types';

const SNAPSHOT: CityData = {
  generatedAt: snapshot.generatedAt,
  source: 'snapshot',
  repos: (snapshot.repos as unknown) as CityRepo[],
};

const ENDPOINT = process.env.NODE_ENV === 'production' ? '/api/city' : 'http://localhost:3001/api/city';

/**
 * The repo list for the city. Starts as the bundled snapshot, so the first paint never waits for the
 * network, then swaps in the live list from `/api/city` when it differs. Any failure keeps what is shown.
 * The returned `repos` array keeps its identity until the list really changes.
 */
export function useCityData(): CityData {
  const [data, setData] = useState<CityData>(SNAPSHOT);

  useEffect(() => {
    if (typeof fetch !== 'function') return undefined;
    let cancelled = false;
    fetch(ENDPOINT)
      .then((res) => (res.ok ? res.json() : null))
      .then((next: CityData | null) => {
        if (cancelled || !next || !Array.isArray(next.repos) || next.repos.length < 1) return;
        setData((cur) => (JSON.stringify(next.repos) === JSON.stringify(cur.repos) ? cur : next));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return data;
}
