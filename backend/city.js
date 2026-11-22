const CACHE_TTL_MS = 60 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const REQUEST_TIMEOUT_MS = 8000;

function normalizeRepo(apiRepo) {
  return {
    name: apiRepo.name,
    language: apiRepo.language,
    sizeKB: apiRepo.size,
    pushedAt: apiRepo.pushed_at,
    stars: apiRepo.stargazers_count,
    url: apiRepo.html_url,
    homepage: apiRepo.homepage ? apiRepo.homepage : null,
    fork: Boolean(apiRepo.fork),
  };
}

function lowerSet(list) {
  const set = new Set();
  (Array.isArray(list) ? list : []).forEach((name) => set.add(String(name).toLowerCase()));
  return set;
}

function applyRules(apiRepos, config) {
  const include = lowerSet(config.include);
  const exclude = lowerSet(config.exclude);
  return apiRepos
    .filter((repo) => {
      if (!repo || typeof repo.name !== 'string') return false;
      const key = repo.name.toLowerCase();
      if (repo.private === true) return false;
      if (exclude.has(key)) return false;
      if (repo.archived === true) return false;
      if (typeof repo.language !== 'string' || repo.language === '') return false;
      if (repo.fork === true && !include.has(key)) return false;
      return true;
    })
    .map(normalizeRepo);
}

function limitRepos(repos, config) {
  return repos
    .slice()
    .sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt))
    .slice(0, config.maxRepos);
}

function createCityService({ fetchImpl = fetch, now = Date.now, env = process.env, config, snapshot }) {
  let cached = null; // { data: CityData, expiresAt }
  let etag = null;
  let retryAt = 0;
  let inflight = null;

  function headers() {
    const h = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'portfolio-city',
    };
    if (typeof env.GITHUB_TOKEN === 'string' && env.GITHUB_TOKEN !== '') {
      h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }
    return h;
  }

  function snapshotData() {
    return { generatedAt: snapshot.generatedAt, source: 'snapshot', repos: snapshot.repos };
  }

  function fallback() {
    retryAt = now() + RETRY_DELAY_MS;
    if (cached) return { ...cached.data, source: 'stale' };
    return snapshotData();
  }

  async function refresh() {
    try {
      const all = [];
      let pageOneEtag = null;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const url = `https://api.github.com/users/${config.user}/repos?per_page=${PAGE_SIZE}&type=owner&sort=pushed&page=${page}`;
        const reqHeaders = headers();
        if (page === 1 && etag && cached) reqHeaders['If-None-Match'] = etag;
        const res = await fetchImpl(url, { headers: reqHeaders, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (page === 1 && res.status === 304 && cached) {
          cached.expiresAt = now() + CACHE_TTL_MS;
          return { ...cached.data, source: 'live' };
        }
        if (res.status !== 200) return fallback();
        const body = await res.json();
        if (!Array.isArray(body)) return fallback();
        if (page === 1) {
          const tag = res.headers && typeof res.headers.get === 'function' ? res.headers.get('etag') : null;
          pageOneEtag = tag || null;
        }
        body.forEach((repo) => all.push(repo));
        if (body.length !== PAGE_SIZE) break;
      }
      const data = {
        generatedAt: new Date(now()).toISOString(),
        source: 'live',
        repos: limitRepos(applyRules(all, config), config),
      };
      cached = { data, expiresAt: now() + CACHE_TTL_MS };
      etag = pageOneEtag;
      return data;
    } catch (err) {
      return fallback();
    }
  }

  async function getCity() {
    const t = now();
    if (cached && t < cached.expiresAt) return { ...cached.data, source: 'live' };
    if (t < retryAt) return cached ? { ...cached.data, source: 'stale' } : snapshotData();
    if (!inflight) {
      inflight = refresh().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  return { getCity };
}

let defaultService = null;

function getDefaultCityService() {
  if (!defaultService) {
    defaultService = createCityService({
      config: require('./city/config.json'),
      snapshot: require('./city/snapshot.json'),
    });
  }
  return defaultService;
}

module.exports = {
  normalizeRepo,
  applyRules,
  limitRepos,
  createCityService,
  getDefaultCityService,
};
