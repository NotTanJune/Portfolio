import { renderHook, waitFor } from '@testing-library/react';
import { snapshotRepos } from './test-helpers';
import { CityData } from './types';
import { useCityData } from './useCityData';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

const other: CityData = {
  generatedAt: '2026-11-22T00:00:00Z',
  source: 'live',
  repos: [
    { name: 'only-repo', language: 'Rust', sizeKB: 120, pushedAt: '2026-11-20T00:00:00Z', stars: 0, url: 'https://github.com/NotTanJune/only-repo', homepage: null, fork: false },
  ],
};

const respond = (body: unknown, ok = true) =>
  jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response));

describe('useCityData', () => {
  it('returns the bundled snapshot when fetch does not exist', () => {
    (global as { fetch?: unknown }).fetch = undefined;
    const { result } = renderHook(() => useCityData());
    expect(result.current.source).toBe('snapshot');
    expect(result.current.repos).toEqual(snapshotRepos());
  });

  it('switches to the live list when it differs, asking the dev backend by absolute URL', async () => {
    const fetchMock = respond(other);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useCityData());
    expect(result.current.source).toBe('snapshot');
    await waitFor(() => expect(result.current.repos).toEqual(other.repos));
    expect(result.current.source).toBe('live');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/city');
  });

  it('keeps the same repos array when the live list is identical', async () => {
    const fetchMock = respond({ ...other, repos: JSON.parse(JSON.stringify(snapshotRepos())), source: 'live' });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useCityData());
    const first = result.current.repos;
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Promise.resolve();
    await Promise.resolve();
    expect(result.current.repos).toBe(first);
    expect(result.current.source).toBe('snapshot');
  });

  it('keeps the snapshot when the request fails, answers an error status, or returns no repos', async () => {
    const cases: Array<jest.Mock> = [
      jest.fn(() => Promise.reject(new Error('offline'))),
      respond({ error: 'nope' }, false),
      respond({ ...other, repos: [] }),
    ];
    for (let i = 0; i < cases.length; i++) {
      global.fetch = cases[i] as unknown as typeof fetch;
      const { result, unmount } = renderHook(() => useCityData());
      await waitFor(() => expect(cases[i]).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 0));
      expect(result.current.source).toBe('snapshot');
      expect(result.current.repos).toEqual(snapshotRepos());
      unmount();
    }
  });
});
