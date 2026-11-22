const { describe, expect, test } = require('bun:test');
const { normalizeRepo, applyRules, limitRepos, createCityService } = require('./city');

const HOUR = 60 * 60 * 1000;
const config = { user: 'someone', include: ['Forked-Mine'], exclude: ['hidden'], maxRepos: 40 };
const snapshot = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  repos: [{ name: 'from-snapshot', language: 'Rust', sizeKB: 1, pushedAt: '2026-01-01T00:00:00Z', stars: 0, url: 'https://github.com/someone/from-snapshot', homepage: null, fork: false }],
};

function apiRepo(overrides = {}) {
  return {
    name: 'alpha',
    language: 'TypeScript',
    size: 120,
    pushed_at: '2026-11-01T00:00:00Z',
    stargazers_count: 3,
    html_url: 'https://github.com/someone/alpha',
    homepage: '',
    fork: false,
    archived: false,
    private: false,
    ...overrides,
  };
}

function response(status, body, etag) {
  return {
    status,
    headers: { get: (key) => (key.toLowerCase() === 'etag' ? etag || null : null) },
    json: async () => body,
  };
}

function recordingFetch(handler, calls) {
  return async (url, init) => {
    calls.push({ url, headers: init.headers });
    return handler(calls.length);
  };
}

function names(city) {
  return city.repos.map((r) => r.name);
}

describe('normalizeRepo', () => {
  test('maps the API fields and turns an empty homepage into null', () => {
    expect(normalizeRepo(apiRepo())).toEqual({
      name: 'alpha',
      language: 'TypeScript',
      sizeKB: 120,
      pushedAt: '2026-11-01T00:00:00Z',
      stars: 3,
      url: 'https://github.com/someone/alpha',
      homepage: null,
      fork: false,
    });
    expect(normalizeRepo(apiRepo({ homepage: 'https://example.com' })).homepage).toBe('https://example.com');
  });

  test('never copies the private field', () => {
    expect('private' in normalizeRepo(apiRepo({ private: true }))).toBe(false);
    expect('private' in normalizeRepo(apiRepo({ private: false }))).toBe(false);
  });
});

describe('applyRules', () => {
  test('keeps a public original repo', () => {
    const out = applyRules([apiRepo()], config);
    expect(names({ repos: out })).toEqual(['alpha']);
  });

  test('drops a fork unless it is in include, matched case-insensitively', () => {
    const out = applyRules([
      apiRepo({ name: 'some-fork', fork: true }),
      apiRepo({ name: 'forked-mine', fork: true }),
    ], config);
    expect(names({ repos: out })).toEqual(['forked-mine']);
  });

  test('drops archived, languageless, excluded and private repos', () => {
    const out = applyRules([
      apiRepo({ name: 'old', archived: true }),
      apiRepo({ name: 'empty', language: null }),
      apiRepo({ name: 'blank', language: '' }),
      apiRepo({ name: 'Hidden' }),
      apiRepo({ name: 'secret', private: true }),
      apiRepo({ name: 'kept' }),
    ], config);
    expect(names({ repos: out })).toEqual(['kept']);
  });

  test('drops a private repo even when it is in include', () => {
    const out = applyRules([apiRepo({ name: 'forked-mine', fork: true, private: true })], config);
    expect(out).toEqual([]);
  });
});

describe('limitRepos', () => {
  test('keeps the newest repos by pushedAt', () => {
    const repos = [
      { name: 'old', pushedAt: '2024-01-01T00:00:00Z' },
      { name: 'newest', pushedAt: '2026-06-01T00:00:00Z' },
      { name: 'mid', pushedAt: '2025-01-01T00:00:00Z' },
    ];
    const out = limitRepos(repos, { maxRepos: 2 });
    expect(out.map((r) => r.name)).toEqual(['newest', 'mid']);
    expect(repos.map((r) => r.name)).toEqual(['old', 'newest', 'mid']);
  });
});

describe('createCityService', () => {
  test('fetches once for two calls inside the hour', async () => {
    const calls = [];
    let time = 1_000_000;
    const service = createCityService({
      config,
      snapshot,
      env: {},
      now: () => time,
      fetchImpl: recordingFetch(() => response(200, [apiRepo()], 'W/"1"'), calls),
    });
    const first = await service.getCity();
    time += HOUR - 1;
    const second = await service.getCity();
    expect(calls.length).toBe(1);
    expect(first.source).toBe('live');
    expect(second.source).toBe('live');
    expect(names(second)).toEqual(['alpha']);
    expect(first.generatedAt).toBe(new Date(1_000_000).toISOString());
  });

  test('requests the public user endpoint with the GitHub headers and a timeout', async () => {
    const calls = [];
    const service = createCityService({
      config,
      snapshot,
      env: {},
      now: () => 0,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return response(200, [apiRepo()]);
      },
    });
    await service.getCity();
    expect(calls[0].url).toBe('https://api.github.com/users/someone/repos?per_page=100&type=owner&sort=pushed&page=1');
    expect(calls[0].init.headers.Accept).toBe('application/vnd.github+json');
    expect(calls[0].init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    expect(calls[0].init.headers['User-Agent']).toBe('portfolio-city');
    expect(calls[0].init.signal).toBeDefined();
  });

  test('fetches again after the hour with If-None-Match and keeps the repos on 304', async () => {
    const calls = [];
    let time = 0;
    const service = createCityService({
      config,
      snapshot,
      env: {},
      now: () => time,
      fetchImpl: recordingFetch((n) => (n === 1 ? response(200, [apiRepo()], 'W/"abc"') : response(304, null)), calls),
    });
    await service.getCity();
    time += HOUR + 1;
    const again = await service.getCity();
    expect(calls.length).toBe(2);
    expect(calls[0].headers['If-None-Match']).toBeUndefined();
    expect(calls[1].headers['If-None-Match']).toBe('W/"abc"');
    expect(again.source).toBe('live');
    expect(names(again)).toEqual(['alpha']);
    // The 304 reset the expiry, so the next call inside the hour does not fetch.
    time += HOUR - 1;
    await service.getCity();
    expect(calls.length).toBe(2);
  });

  test('falls back to the snapshot when the first fetch throws, and waits 5 minutes to retry', async () => {
    const calls = [];
    let time = 0;
    const service = createCityService({
      config,
      snapshot,
      env: {},
      now: () => time,
      fetchImpl: recordingFetch(() => { throw new Error('network down'); }, calls),
    });
    const city = await service.getCity();
    expect(city.source).toBe('snapshot');
    expect(city.repos).toEqual(snapshot.repos);
    expect(city.generatedAt).toBe(snapshot.generatedAt);
    time += 4 * 60 * 1000;
    await service.getCity();
    expect(calls.length).toBe(1);
    time += 2 * 60 * 1000;
    await service.getCity();
    expect(calls.length).toBe(2);
  });

  test('falls back to the snapshot on a non-200 status or a non-array body', async () => {
    const statusService = createCityService({
      config, snapshot, env: {}, now: () => 0,
      fetchImpl: async () => response(403, { message: 'rate limited' }),
    });
    expect((await statusService.getCity()).source).toBe('snapshot');

    const bodyService = createCityService({
      config, snapshot, env: {}, now: () => 0,
      fetchImpl: async () => response(200, { message: 'not an array' }),
    });
    expect((await bodyService.getCity()).source).toBe('snapshot');
  });

  test('returns stale data with the last good repos when a refresh fails', async () => {
    let time = 0;
    let fail = false;
    const service = createCityService({
      config,
      snapshot,
      env: {},
      now: () => time,
      fetchImpl: async () => {
        if (fail) throw new Error('boom');
        return response(200, [apiRepo({ name: 'last-good' })], 'W/"1"');
      },
    });
    const good = await service.getCity();
    expect(good.source).toBe('live');
    fail = true;
    time += HOUR + 1;
    const stale = await service.getCity();
    expect(stale.source).toBe('stale');
    expect(names(stale)).toEqual(['last-good']);
    expect(stale.generatedAt).toBe(good.generatedAt);
  });

  test('sends no Authorization header without GITHUB_TOKEN', async () => {
    const calls = [];
    for (const env of [{}, { GITHUB_TOKEN: '' }]) {
      const service = createCityService({
        config, snapshot, env, now: () => 0,
        fetchImpl: recordingFetch(() => response(200, [apiRepo()]), calls),
      });
      await service.getCity();
    }
    expect(calls.length).toBe(2);
    calls.forEach((call) => expect(call.headers.Authorization).toBeUndefined());
  });

  test('sends a Bearer header when GITHUB_TOKEN is set', async () => {
    const calls = [];
    const service = createCityService({
      config, snapshot, env: { GITHUB_TOKEN: 'test-token-value' }, now: () => 0,
      fetchImpl: recordingFetch(() => response(200, [apiRepo()]), calls),
    });
    await service.getCity();
    expect(calls[0].headers.Authorization).toBe('Bearer test-token-value');
  });

  test('shares one fetch between concurrent calls', async () => {
    const calls = [];
    const service = createCityService({
      config, snapshot, env: {}, now: () => 0,
      fetchImpl: recordingFetch(() => response(200, [apiRepo()]), calls),
    });
    const [a, b] = await Promise.all([service.getCity(), service.getCity()]);
    expect(calls.length).toBe(1);
    expect(names(a)).toEqual(['alpha']);
    expect(names(b)).toEqual(['alpha']);
  });

  test('reads a second page only when the first holds 100 repos', async () => {
    const calls = [];
    const page1 = Array.from({ length: 100 }, (_, i) => apiRepo({ name: `r${i}`, pushed_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z` }));
    const service = createCityService({
      config: { ...config, maxRepos: 500 }, snapshot, env: {}, now: () => 0,
      fetchImpl: recordingFetch((n) => response(200, n === 1 ? page1 : [apiRepo({ name: 'page-two' })]), calls),
    });
    const city = await service.getCity();
    expect(calls.length).toBe(2);
    expect(calls[1].url).toContain('page=2');
    expect(names(city)).toContain('page-two');
    expect(city.repos.length).toBe(101);
  });
});
