# Plan 003: Serve HTML, images and fonts from Cloudflare's edge instead of the US Heroku origin

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f55a72c..HEAD -- backend/static-cache.js backend/static-cache.test.js backend/server.js package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (largest single win)
- **Effort**: M (code part S; Cloudflare dashboard part is manual, done by the owner)
- **Risk**: MED. Cached HTML that outlives a deploy points at JS chunks the new build deleted, which gives a blank page. A cache purge on every deploy is mandatory.
- **Depends on**: none for the code. Land 001 and 002 first so their new assets are what gets cached.
- **Category**: perf
- **Planned at**: commit `f55a72c`, 2026-10-22

## Why this matters

The site runs on one Heroku Basic dyno in the `us` region behind Cloudflare. The owner and many visitors are in Singapore. Measured on 2026-10-22 from Singapore:

| Request | Cloudflare status | Time to first byte |
|---|---|---|
| `GET /` (HTML) | `DYNAMIC` (never cached) | 0.83 to 1.28s |
| `GET /robots.txt` | `MISS` | 1.24s |
| `GET /fonts/bricolage-grotesque-latin.woff2` | `MISS` | about 1.2s |
| `GET /static/js/main.<hash>.js` | `HIT` | 0.055s |

Every first visit therefore waits about 1.2s on a blank page before any JS can start, and the font or a photo can each add another ~1.2s when the edge has not cached them. Cloudflare does not cache HTML unless a Cache Rule makes it eligible. Low-traffic sites also lose cached images and fonts quickly at 1-day TTLs. After this plan, HTML is cached at the edge for 7 days and images and fonts for 30 days, with a purge on each deploy. Repeat visitors in a region then get every request answered from the edge in about 50ms.

## Current state

- `backend/static-cache.js` (whole file):
  ```js
  const HASHED_BUILD_ASSET = /\/static\/.*\.[a-f0-9]{8}\.(?:js|css)(?:\.map)?$/i;

  function cacheControlFor(pathname) {
    if (HASHED_BUILD_ASSET.test(pathname)) {
      return 'public, max-age=31536000, immutable';
    }

    if (pathname.includes('/images/') || pathname.includes('/fonts/')) {
      return 'public, max-age=86400, stale-while-revalidate=604800';
    }

    if (pathname.endsWith('.html') || pathname === '/') {
      return 'no-cache';
    }

    return 'public, max-age=3600, stale-while-revalidate=86400';
  }

  function setStaticCacheHeaders(response, filePath) {
    response.setHeader('Cache-Control', cacheControlFor(filePath));
  }

  module.exports = { cacheControlFor, setStaticCacheHeaders };
  ```
- `backend/static-cache.test.js`: bun:test file asserting the exact strings above (`'public, max-age=86400, stale-while-revalidate=604800'` for `/images/profile/pfp.webp`, `'no-cache'` for `/index.html`). Pattern to follow for new tests.
- `backend/server.js` (production branch, lines ~55-81). Line 6 imports `const { setStaticCacheHeaders } = require('./static-cache');`. SPA fallback:
  ```js
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(renderRouteMetadata(indexTemplate, req.path));
    });
  ```
  The HTML differs per path (`renderRouteMetadata` injects per-route title, meta and canonical tags). Cloudflare caches per URL, so per-path HTML is safe to cache.
- `/api/contact` is the only API route. It is POST, and Cloudflare never caches POST.
- Deploy is manual: `git push heroku heroku-deploy:main` (Heroku app `tanmay-nargas-portfolio`). There is no CI.
- Root `package.json` holds orchestration scripts (bun). Example entry: `"optimize-images": "bun scripts/optimize-images.ts frontend/public/images"`.
- Backend tests: `cd backend && bun test`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Backend tests | `cd backend && bun test` | all pass |
| Header check (after the owner deploys) | `curl -sI https://tanmaynargas.com/ \| grep -iE "cache-control\|cf-cache-status"` | see Step 6 |

## Scope

**In scope** (code, executor):
- `backend/static-cache.js`
- `backend/static-cache.test.js`
- `backend/server.js` (only the import on line 6 and the SPA fallback `Cache-Control` line)
- `package.json` (root): add one `purge-cdn` script
- `CLAUDE.md` (root): add a short "Deploy" note about the purge

**Manual, owner only** (executor must NOT attempt; list them in the final report as pending):
- Cloudflare dashboard Cache Rule and Tiered Cache (Step 5)
- Creating the Cloudflare API token and setting env vars
- Deploying, purging, and the live header check

**Out of scope**:
- The hashed `/static/` policy (already immutable and edge-cached).
- `backend/seo.js`, the canonical-redirect middleware, helmet/CSP config.
- Moving hosting off Heroku.

## Git workflow

- Current branch, working tree in place. No branches or worktrees.
- One commit, plain imperative message, e.g. `Edge-cache HTML and static assets at Cloudflare`.
- Do NOT push, deploy, or call the Cloudflare API.

## Steps

### Step 1: Update cache policy

In `backend/static-cache.js`:
- images/fonts branch returns `'public, max-age=86400, stale-while-revalidate=604800, s-maxage=2592000'`
- HTML branch returns `'public, max-age=0, must-revalidate, s-maxage=604800'`

`max-age=0, must-revalidate` keeps browsers checking for new HTML on every visit, and that check is answered by the edge. `s-maxage` applies only to Cloudflare.

**Verify**: `cd backend && bun test` → the two existing assertions for images and HTML now FAIL (expected). Go to Step 2.

### Step 2: Update tests

In `backend/static-cache.test.js` update the two expected strings to the new values. Add one test: `cacheControlFor('/')` returns the same HTML policy string.

**Verify**: `cd backend && bun test` → all pass.

### Step 3: Use the shared policy in the SPA fallback

In `backend/server.js` change the import to `const { cacheControlFor, setStaticCacheHeaders } = require('./static-cache');` and the fallback line to `res.setHeader('Cache-Control', cacheControlFor('/'));`.

**Verify**: `grep -n "'no-cache'" backend/server.js` → no output. `cd backend && node -e "require('./static-cache')"` → exit 0. (Do not start the server; it connects to MongoDB.)

### Step 4: Add a purge script

Add to root `package.json` `scripts`:
```json
"purge-cdn": "curl -fsS -X POST \"https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache\" -H \"Authorization: Bearer $CLOUDFLARE_API_TOKEN\" -H \"Content-Type: application/json\" --data '{\"purge_everything\":true}'"
```
Add to root `CLAUDE.md` under "Build & Deploy":
```
Deploy: `git push heroku heroku-deploy:main`, then ALWAYS `bun run purge-cdn` (needs CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN with Zone > Cache Purge permission in the shell env, never committed). Cloudflare caches HTML for 7 days; skipping the purge serves HTML that references deleted JS chunks, which renders a blank page.
```

**Verify**: `bun -e "JSON.parse(require('fs').readFileSync('package.json','utf8')).scripts['purge-cdn'] || process.exit(1)"` → exit 0. Do NOT run `bun run purge-cdn`.

### Step 5 (OWNER, manual): Cloudflare dashboard

1. Caching > Cache Rules > Create rule "Cache site HTML and assets". Expression: `(http.host eq "tanmaynargas.com" and not starts_with(http.request.uri.path, "/api/"))`. Action: Eligible for cache. Edge TTL: "Use cache-control header if present, bypass cache if not". Browser TTL: "Respect origin". Deploy.
2. Caching > Tiered Cache: enable Smart Tiered Caching (free). On an edge miss, the Singapore edge then asks a nearer upper-tier Cloudflare data center before going to Heroku.
3. My Profile > API Tokens: create a token with only `Zone > Cache Purge` for this zone. Store it with the Zone ID in your shell profile or password manager as `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID`.

### Step 6 (OWNER, manual): deploy and confirm

`git push heroku heroku-deploy:main`, then `bun run purge-cdn` (expect `"success":true`). Then run twice:
```sh
curl -sI https://tanmaynargas.com/ | grep -iE "cache-control|cf-cache-status"
curl -s -o /dev/null -w "%{time_starttransfer}\n" https://tanmaynargas.com/
```
Expected: first `cf-cache-status: MISS`, second `HIT`, and the second time to first byte under 0.15s. `cache-control` shows the new HTML policy.

## Test plan

- `backend/static-cache.test.js`: updated image and HTML expectations, plus a new `/` case (Step 2). Pattern: the existing tests in that file.
- No server integration test (the server needs MongoDB). The live curl check in Step 6 is the end-to-end check.

## Done criteria

Executor (code):
- [ ] `cd backend && bun test` exits 0, including the new `/` test
- [ ] `grep -n "s-maxage=604800" backend/static-cache.js` and `grep -n "s-maxage=2592000" backend/static-cache.js` each match once
- [ ] `grep -n "'no-cache'" backend/server.js` returns nothing
- [ ] `purge-cdn` script exists; CLAUDE.md deploy note added
- [ ] `git status --short` shows only in-scope files (plus `plans/README.md`)
- [ ] Report lists Steps 5 and 6 as PENDING OWNER ACTION, and the status row reads `DONE (code) / owner steps pending`

Owner (after deploy): the Step 6 curl results.

## STOP conditions

- `backend/server.js` sets `Cache-Control` for HTML anywhere other than the SPA fallback (for example new routes rendering HTML): report.
- The project uses Cloudflare Pages/Workers or another CDN in front instead of a proxied Cloudflare zone (for example, the response `server` header is not `cloudflare`). Then the dashboard steps do not apply.
- Any step would require a real Cloudflare token or zone ID value: never write one into a file. Stop and report.

## Maintenance notes

- **Purge after every deploy.** This is the cost of edge-caching HTML. If deploys ever move to CI, call the purge from the pipeline.
- Changing an image or font without renaming it also needs a purge, because the edge holds those for 30 days.
- If an `/admin` page or any per-user HTML is added, exclude it from the Cache Rule, or caches will leak it across users.
- Reviewer: confirm no secret values appear in `package.json` or `CLAUDE.md`, only env var names.
