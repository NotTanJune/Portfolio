# Plan 005: Add a live pixel city of GitHub repos to Home, and a repo building to every Projects card

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a8ee935..HEAD -- backend/server.js backend/routes frontend/src/components/pages/Projects.tsx frontend/src/components/pages/Projects.test.tsx frontend/src/components/pages/Home.tsx frontend/public/index.html package.json .env.example README.md`
> If any of those files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L (9 phases; each phase leaves the app working)
- **Risk**: MED (new WebGL2 renderer and a new public API route; every Projects card gains a footer element; no existing behavior is removed)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `a8ee935`, 2026-11-21
- **Revised**: 2026-11-21, after the owner reviewed an in-page mockup. The
  revision added the Home hint, replaced the city on the Projects page with a
  building on every card, added park variety, and added phone behaviour.

## Why this matters

The portfolio lists projects as cards, like most portfolios. The owner wants a
signature piece: a small rotating pixel city in which every GitHub repo is a
building, generated from the live repo list so a newly shipped repo appears
as a new building within an hour and without a deploy. The look, the motion
and the data source were all decided with the owner using working spikes; this
plan turns those spikes into production code. The city appears on Home, with
a small animated legend under it that shows visitors what hovering and
clicking do. The Projects page does not repeat the city: each project card
shows its own repo's building, slowly rotating on a small lot.

## Decisions already made (do not reopen)

These were chosen by the owner. Do not change them, and do not add the
rejected options back.

| Topic | Decision |
|---|---|
| Technique | Sprite stacking: each building is a stack of flat pixel slices, one per unit of height, all rotated by the same angle. |
| Renderer | Raw WebGL2, no three.js and no other new runtime dependency. A Canvas 2D software rasteriser is the automatic fallback when WebGL2 is missing. |
| Motion | Smooth: slices are drawn at full screen resolution, so each art pixel is a small tile that turns with the building. Continuous slow rotation, one turn per 48 seconds. |
| Light theme look | "Maquette": the site's own greens and creams. |
| Dark theme look | "Night shift": dark blocks, lit windows, roof rim edged in the language colour. The city follows the site's existing light/dark theme. |
| Data mapping | Height is repo size, lit windows mean a recent push, colour is the primary language. |
| Labels | Pixel lettering: the Silkscreen bitmap font, square corners. |
| Rejected | Dithered shading, ink outlines around every building, stepped "click-turn" rotation, three.js, drag-to-rotate, zoom. A hover outline on the one hovered building is kept. Also rejected on 2026-11-21: repeating the whole city on the Projects page, swapping a card's screenshot for its building on hover, and a building that pops up from behind a card on hover. |
| Extras | "Small life on a slow clock" (tiny cars, chimney smoke, blinking beacons, animated at 8 ticks per second) and a rooftop emblem on every building. |
| Repo rule | Public, non-archived repos with a primary language. A fork appears only when it is in the `include` list, which holds every fork the owner has committed to (ten on 2026-11-21). An `exclude` list hides a repo. **No private repo ever gets a building** (owner decision, 2026-11-21): Kelpie and Every Round stay on the Projects page as cards only. |
| Live data | The site's Express backend fetches the repo list from GitHub and caches it for one hour. Browsers never call GitHub. A committed snapshot is the fallback. The server never holds a token that can read private repos. |
| Home placement | Inside the "Some Things I've Built" section, between its heading and its cards. |
| Home hint | A row of four animated pixel vignettes directly under the city, on the same slow clock as the cars: what hovering does, what clicking does, that taller means more code, and that lit windows mean a recent push. Touch devices get their own first two vignettes and wording: "Tap" (a finger taps, the name tag appears) and "Tap again" (a second tap opens the repo). |
| Projects page | No city. Every project card shows its repo's building, rotating on a small lot plate in the card's bottom-left corner, always visible, with the language and the last push beside it. One turn takes 26 seconds, and it spins five times faster while the card is hovered. |
| Cards without a building | A project whose repo is not in the city (private, owned by someone else, or no repo at all) shows a small park in the same spot, with no caption. There are six park designs, handed out in order so neighbouring park cards never look the same. |
| Phones | Everything works by touch and down to 320 px wide: no horizontal scrolling, the hint in a 2 by 2 grid, two-tap behaviour on the city, and card buildings that need no hover. |

## Current state

Facts verified at commit `a8ee935`.

### Repo layout and tooling

- Monorepo: root (scripts, deploy), `backend/` (Express, plain JavaScript,
  CommonJS, runs on Bun), `frontend/` (Create React App 5, React 19,
  TypeScript 4.9, no custom webpack config).
- Package manager is **bun 1.4.0** everywhere (`"packageManager": "bun@1.4.0"`
  in all three `package.json` files). The repo's `CLAUDE.md` mentions yarn;
  that is out of date. Use bun.
- `frontend/tsconfig.json` has `"target": "es5"`, `"strict": true` and no
  `downlevelIteration`. Consequence: `for...of` over a `Set`, `Map`, typed
  array or `NodeList`, and spreading any of those, is a compile error
  (TS2802). Iterate arrays only; use `Array.from(...)`, index loops or
  `.forEach`.
- The frontend test runner is Jest under jsdom (`react-scripts test`). jsdom
  has no WebGL, `canvas.getContext` returns `null`, and `fetch`,
  `IntersectionObserver` and `ResizeObserver` are undefined. All city code
  must guard for these.
- The backend test runner is `bun test`. Tests live beside the module
  (`backend/turnstile.test.js`, `backend/seo.test.js`).

### Backend

`backend/server.js` (104 lines) mounts exactly one API route:

```js
// backend/server.js:56-57
// Routes
app.use('/api/contact', require('./routes/contact'));
```

All `/api` routes sit behind a rate limiter (100 requests per 15 minutes per
client IP, `backend/server.js:35-46`). Helmet sets a content security policy
(`backend/server.js:18-33`) with `connectSrc: ["'self'"]`,
`styleSrc: ["'self'", "'unsafe-inline'"]`, `scriptSrc: ["'self'", ...]` and
`fontSrc: ["'self'", "data:", "https:"]`. Consequences: the browser cannot
call `api.github.com`, Google Fonts stylesheets are blocked, and inline
scripts are blocked. Do not loosen the policy.

The convention for a backend module that calls an external service is
`backend/turnstile.js`: a plain function that takes its dependencies as an
options object so tests can inject fakes, never throws, and uses
`AbortSignal.timeout`:

```js
// backend/turnstile.js:16
async function verifyTurnstileToken(token, remoteIp, { env = process.env, fetchImpl = fetch } = {}) {
```

Its test file starts like this; match the style:

```js
// backend/turnstile.test.js:1-12
const { describe, expect, test } = require('bun:test');
const { verifyTurnstileToken, getTurnstileSecret } = require('./turnstile');
...
function fakeFetch(result, calls = []) {
  return async (url, init) => {
    calls.push({ url, body: init.body.toString() });
    return { json: async () => result };
  };
}
```

### Frontend

- `frontend/src/App.tsx` exports `colors`, `ThemeContext`, `AnimatedSection`,
  `CARD_RADIUS`. The exported `colors` object is mutated in place when the
  theme changes. The resolved theme is also written to
  `<html data-theme="light|dark">` by `applyColorScheme` in
  `frontend/src/utils/colorScheme.ts:45-49`. **The city must read the theme
  from that attribute, not from `ThemeContext`**, because
  `Projects.test.tsx` mocks `../../App` without a `ThemeContext` and an import
  from `App` would also create an import cycle.
- Light palette (`frontend/src/App.tsx:116-149`): `mainBg #dad7cd`,
  `cardBg #f0efeb`, `primaryText #344e41`, `secondaryText #3a5a40`,
  `accentText #588157`, `mutedText #a3b18a`, `borderColor #b6b09c`.
  Dark palette (`frontend/src/App.tsx:155-`): `mainBg #1a2419`,
  `cardBg #344e41`, `primaryText #f0efeb`, `accentText #a3b18a`.
- `frontend/src/components/pages/Projects.tsx` (533 lines) holds the project
  list as a hardcoded array (`const projects = [` at line 17) inside the
  component. Each entry has `title`, `description`, `tech`, `category`,
  `featured` and optional `GitHub`, `LiveDemo`, `Twitter`. Example:

  ```tsx
  // frontend/src/components/pages/Projects.tsx:27-34
  {
    title: 'Locator (lctr)',
    description: '"lctr" is a Rust-built local metadata search CLI/TUI. ...',
    tech: ['Rust', 'ratatui', 'SQLite'],
    category: ['Rust Project', 'CLI Tool'],
    featured: true,
    GitHub: 'https://github.com/NotTanJune/locator',
  },
  ```

  Cards are keyed by index:

  ```tsx
  // frontend/src/components/pages/Projects.tsx:277-278
  {filteredProjects.map((project, index) => (
    <div key={index} style={{
  ```

  Consequence: when the filter changes, React reuses a card's DOM nodes and
  component instances for a different project. Anything placed in a card
  must follow its props on every render, not only its first.

  The card `div` (lines 278-290) has `padding: isMobile ? '20px' : '24px'`,
  `overflow: 'hidden'`, `position: 'relative'`, and its own `onMouseEnter`
  and `onMouseLeave` handlers that only change `borderColor`. Each card ends
  with a footer row that holds the link buttons, pushed right by a spacer:

  ```tsx
  // frontend/src/components/pages/Projects.tsx:418-425
  {/* Footer */}
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }}>

    <div style={{ flex: 1 }}></div>
  ```

  The link buttons that follow are 36 px tall. The page lists 18 projects.
  Thirteen link to a repo that is in the city today; five do not (Kelpie,
  Every Round, StrAIt, Social Media AI Detector, SentiStock).
- `frontend/src/components/pages/Projects.test.tsx` has two tests. It mocks
  `../AnimatedContent` and `../../App` (with a `colors` object, `CARD_RADIUS`
  and `AnimatedSection` only), renders `<Projects />`, clicks filter buttons
  and looks headings up by role.

  The filter row starts at the comment `{/* Filter Buttons */}`
  (`Projects.tsx:218`), right after the intro `AnimatedSection`.
- `frontend/src/components/pages/Home.tsx` (1094 lines): the featured section
  starts at the comment `{/* Featured Projects Preview */}` (`Home.tsx:634`).
  Its heading block ends with `</AnimatedSection>` at line 657 and the card
  grid starts with `<AnimatedContent>` at line 659.
- Fonts are self-hosted in `frontend/public/fonts/` and declared in an inline
  `<style>` in `frontend/public/index.html` (lines 70-78), not in
  webpack-processed CSS, so the stable `/fonts/...` URL is used verbatim:

  ```html
  @font-face {
    font-family: 'Bricolage Grotesque';
    src: url('/fonts/bricolage-grotesque-latin.woff2') format('woff2');
    font-weight: 200 800;
    font-style: normal;
    font-display: swap;
  }
  ```
- In development the frontend calls the backend by absolute URL. Match this
  pattern from `frontend/src/components/pages/Contact.tsx:72-74`:
  `process.env.NODE_ENV === 'production' ? '/api/contact' : 'http://localhost:3001/api/contact'`.
- Do not put city images under `frontend/public/images/`: the image optimiser
  (`scripts/optimize-images.ts`) converts everything there to lossy WebP and
  deletes the originals, which would destroy pixel art.

### The reference spike and the reference mockup

There are two references. Neither is code to ship; both are code to port
from.

**The mockup (newer, wins wherever the two differ).**
`plans/assets/005-repo-city/mockup/` holds what the owner approved on
2026-11-21: `city-inject.js` (927 lines of plain JavaScript), a small server
that injects it into the real production build, and the 30-repo list it draws
(`repos.json`, public repos only). To see it:

```
cd frontend && CI=true bun run build && cd ..
bun plans/assets/005-repo-city/mockup/server.js frontend/build 49200
```

Then open `http://127.0.0.1:49200/` and `http://127.0.0.1:49200/projects`.
Add `?touch` to the Home address to see the phone instructions on a desktop,
and `?parksheet` to the Projects address to see all six parks enlarged. Stop
the server when you are done.

| Mockup lines | What | Port to |
|---|---|---|
| 16-24 | `hash`, `rng`, `hex`, `mix`, `pack`, `litChance`, `luma` | `rng.ts`, `styles.ts` |
| 30-58 | `STYLES` (`maquette`, `night`) with the final prop lists, car and puff colours | `styles.ts` |
| 61-81 | `buildModel` with the `top` and `edge` flags | `voxel.ts` |
| 83-94 | `proceduralEmblem` | `emblems.ts` |
| 97-238 | `makeScene`: materials, ground, buildings (one-cell roof rim at line 183, vents, emblem placement), trees, cars, puffs | `models.ts`, `scene.ts` |
| 239-281 | the lot plate and the six park models | `parks.ts` |
| 285-302 | `computeLighting` | `scene.ts` |
| 305-325 | `lifeInstances` | `life.ts` |
| 328-337 | `topNeed`, `viewFor` (the framing) | `layout.ts` |
| 340-391 | GLSL: slice pass with the `uOrigin` uniform and the emblem kind, outline pass | `gl.ts` |
| 393-550 | `makeGL`: atlas, per-item instance ranges, `draw`, `drawOne`, `tonesOf` | `gl.ts`, `scene.ts` |
| 553-580 | CSS for the label, the hint and the card lot | `RepoCity.css`, `CityHint.css`, `ProjectLot.css` |
| 594-661 | the Home city: sizing, pointer handling, the two-tap rule for touch (620-631), the label | `RepoCity.tsx` |
| 664-778 | the hint: palettes, sprites, the four vignettes with their touch variants, the draw loop | `CityHint.tsx` |
| 785-907 | card lots: shared view, per-card height, one shared WebGL context blitted to each card | `lotStage.ts`, `ProjectLot.tsx` |

Things in the mockup that must **not** ship: the DOM injection and the
`MutationObserver` that finds insertion points (lines 780-783 and 909-927),
the `repos.json` fetch, the Google Fonts stylesheet link (the content
security policy blocks it; the font is self-hosted in Phase 5), the `?touch`,
`?po` and `?parksheet` switches, the unused `mode` and `onSelect` parameters
of `mount`, grid constants computed once at load instead of per scene, and
the absolute positioning of the card lot (production places the lot in the
footer's normal flow, see Phase 8).

**The spike (older).** `plans/assets/005-repo-city/spike.html` is the
self-contained page (plain JavaScript, about 600 lines) the look was first
approved on. It still matters for one thing the mockup does not contain: the
software rasteriser. Its hardcoded `REPOS` list predates the final repo
rule (two private repos were removed from it on 2026-11-22; the line
numbers below are unchanged); ignore that list and never copy it. By line:

| Spike lines | What | Port to |
|---|---|---|
| 313-337 | `drawModel` software rasteriser | `raster.ts` |
| 339-382 | `renderScene`: paint order and the one-pass hover outline | `raster.ts` |

Everything else in the spike has a newer version in the mockup. Things in the
spike that must **not** ship: the `toytown` style, the `uDither` uniform and
every dither branch, the "outline everything" option (`uOutline`), the
click-turn rotation, the two-cell roof rim, the hardcoded `REPOS` array, and
the habit of running the CPU rasteriser every frame next to the GPU one.

## Commands you will need

Run from the repo root unless a `cd` is shown. On this machine, prefix
commands with `eval "$(/opt/homebrew/bin/brew shellenv)" &&` if `bun` is not
on the PATH.

| Purpose | Command | Expected on success |
|---|---|---|
| Backend tests | `cd backend && bun test` | exit 0; baseline is 25 pass, 0 fail |
| Frontend typecheck | `cd frontend && bunx tsc --noEmit` | exit 0, no output |
| Frontend tests | `cd frontend && CI=true bun run test --watchAll=false` | exit 0; baseline is 4 suites, 10 tests passing |
| Frontend build (also runs ESLint; warnings fail under `CI=true`) | `cd frontend && CI=true bun run build` | exit 0, "Compiled successfully" |
| Dev servers | `bun run dev` | backend on 3001, frontend on 3000 (a MongoDB connection error in the log is expected locally and harmless) |
| Snapshot refresh | `bun run city:snapshot` | writes two identical JSON files (created in Phase 1) |

## Suggested executor toolkit

- `agent-browser` CLI for the browser checks in Phases 7 and 8 (headless
  Chromium; it supports WebGL2 through software rendering).
- The `pixel-emoji` skill and its CLI at
  `~/Code-Projects/pixel-emoji/bin/pixel-emoji` for Phase 9 only.
- `gh` CLI, already authenticated on the owner's machine, for Phase 1's
  snapshot script.

## Scope

**In scope** (the only files you may create or modify):

Backend and scripts
- `backend/city.js` (create)
- `backend/city.test.js` (create)
- `backend/city/config.json` (create)
- `backend/city/snapshot.json` (create, generated)
- `backend/routes/city.js` (create)
- `backend/server.js` (one added line)
- `scripts/city-snapshot.ts` (create)
- `scripts/city-emblems.ts` (create)
- `scripts/city/emblems-src/*.png` (create, Phase 9)
- `package.json` (root; two added script entries)
- `.env.example` (one added, commented variable)

Frontend
- `frontend/src/city/` (create; every file named in Phases 2 to 8)
- `frontend/src/components/pages/Projects.tsx`
- `frontend/src/components/pages/Projects.test.tsx`
- `frontend/src/components/pages/Home.tsx`
- `frontend/public/index.html` (one added `@font-face` block)
- `frontend/public/fonts/silkscreen-latin.woff2` (create, downloaded)

Docs
- `README.md` (one added section)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `scripts/deploy.sh` and any deploy, push, or Heroku or Cloudflare command.
  The owner deploys by hand with `bun run deploy`.
- The helmet content security policy in `backend/server.js`.
- `frontend/src/App.tsx`, including `ThemeContext` and `colors`.
- The project list contents in `Projects.tsx` (titles, descriptions, links).
- Any new npm dependency in any `package.json`. If you believe one is needed,
  that is a STOP condition.
- `CLAUDE.md`, `.gitignore`, `bun.lock` files.
- `frontend/public/images/`.

## Git workflow

- Work on the CURRENT branch (`main`) in the repository working tree. Do NOT
  create a branch or a worktree.
- Commit once per phase. Message style is a plain imperative sentence, as in
  the log: `Follow system colour scheme and use standard scrollbar styling`.
  Do not add any AI attribution or co-author lines.
- Do NOT push, and do NOT run `bun run deploy`.

## Shared definitions

These types are used across phases. Put the frontend ones in
`frontend/src/city/types.ts`.

```ts
export interface CityRepo {
  name: string;            // GitHub repo name, original casing
  language: string;        // primary language, never empty
  sizeKB: number;          // GitHub "size" field
  pushedAt: string;        // ISO 8601
  stars: number;
  url: string;             // repo URL on github.com
  homepage: string | null; // live site, when known
  fork: boolean;
}

export interface CityData {
  generatedAt: string;                       // ISO 8601
  source: 'live' | 'stale' | 'snapshot';
  repos: CityRepo[];
}
```

The API response body of `GET /api/city` is exactly a `CityData` object.

---

## Steps

### Phase 1: Backend data service, rules, snapshot, route

#### Step 1.1: Create the config

Create `backend/city/config.json`:

```json
{
  "user": "NotTanJune",
  "include": [
    "murmur", "pdfcraft", "strafe", "AutoRaise", "ios-simulator-skill",
    "superpowers", "spiderfoot", "espanso", "GenAI-for-Visual-Synthesis", "YTLite"
  ],
  "exclude": [],
  "maxRepos": 40
}
```

`include` and `exclude` match repo names case-insensitively. The `include`
list is every fork whose default branch carried the owner's own commits
ahead of its upstream on 2026-11-21 (checked with the GitHub compare API).
The config has no entry for private repos, by design.

#### Step 1.2: Create `backend/city.js`

CommonJS, no new dependencies, uses the global `fetch`. Export these:

1. `normalizeRepo(apiRepo)`: maps one GitHub REST repo object to a `CityRepo`:
   `name`, `language`, `sizeKB` from `size`, `pushedAt` from `pushed_at`,
   `stars` from `stargazers_count`, `url` from `html_url`, `homepage` (empty
   string becomes `null`), `fork`. Never copy the API's `private` field.

2. `applyRules(apiRepos, config)`: returns `CityRepo[]`. A repo is kept when
   ALL of these hold:
   - `private !== true` (defence in depth; the unauthenticated API never
     returns private repos, but an authenticated one could);
   - it is not in `config.exclude`;
   - `archived !== true`;
   - `language` is a non-empty string (this drops empty repos and the profile
     README repo);
   - `fork !== true`, OR its name is in `config.include`.

3. `limitRepos(repos, config)`: sort by `pushedAt` descending, cut to
   `config.maxRepos`, and return a new array.

4. `createCityService({ fetchImpl = fetch, now = Date.now, env = process.env, config, snapshot })`
   returning `{ getCity }`. `getCity()` resolves to a `CityData` and never
   rejects. Behaviour:
   - Cache time to live is `60 * 60 * 1000` ms. Within it, return the cached
     value with `source: 'live'` and do not call `fetchImpl`.
   - When the cache is empty or expired, fetch
     `https://api.github.com/users/${config.user}/repos?per_page=100&type=owner&sort=pushed&page=N`
     starting at page 1 and continuing while a page returns exactly 100
     items, up to 3 pages. Headers:
     `Accept: application/vnd.github+json`,
     `X-GitHub-Api-Version: 2022-11-28`,
     `User-Agent: portfolio-city`, plus
     `Authorization: Bearer ${env.GITHUB_TOKEN}` ONLY when `env.GITHUB_TOKEN`
     is a non-empty string, plus `If-None-Match: <etag>` when an ETag from a
     previous page-1 response is stored. Every request uses
     `signal: AbortSignal.timeout(8000)`.
   - A `304` on page 1 means "unchanged": keep the cached repos, reset the
     expiry, return `source: 'live'`.
   - A `200` result: `limitRepos(applyRules(all pages, config), config)`,
     store it with `generatedAt: new Date(now()).toISOString()`, return
     `source: 'live'`.
   - Any other status, a thrown error, a timeout, or a body that is not an
     array: if a previous live result exists, return it with
     `source: 'stale'` and retry no sooner than 5 minutes later; otherwise
     return `{ generatedAt: snapshot.generatedAt, source: 'snapshot', repos: snapshot.repos }`
     and also retry no sooner than 5 minutes later.
   - Concurrent calls during a fetch share one in-flight promise.
   - Never log the token, and never include response headers in logs.

5. `module.exports` also exposes a lazily created default service built from
   `./city/config.json` and `./city/snapshot.json`:
   `getDefaultCityService()`.

**Verify**: `cd backend && bun -e "const c=require('./city'); console.log(typeof c.applyRules, typeof c.createCityService)"` → `function function`
(this fails until Step 1.4 creates the snapshot; if it fails only because
`./city/snapshot.json` is missing, continue).

#### Step 1.3: Create the snapshot script

Create `scripts/city-snapshot.ts` (run by bun). It:

1. Reads `backend/city/config.json`.
2. Runs `gh api "users/<user>/repos?per_page=100&type=owner" --paginate` with
   `Bun.spawnSync` and parses the JSON. `gh` prints one JSON array per page
   when paginating; handle both a single array and several concatenated
   arrays (for example by collecting with `--jq '.[]'` and wrapping lines, or
   by adding `--slurp` and flattening).
3. Never requests a private repo. `gh` is authenticated as the owner, so
   keep the `users/<user>/repos` endpoint (it lists public repos only) and
   never switch to `user/repos`.
4. Builds `{ generatedAt, repos }` using `applyRules` and `limitRepos`
   required from `../backend/city.js`.
5. Writes the same pretty-printed JSON (2-space indent, trailing newline) to
   BOTH `backend/city/snapshot.json` and `frontend/src/city/snapshot.json`
   (create the directory if needed).
6. Exits non-zero with a clear message if `gh` is missing or not
   authenticated, and writes nothing in that case.

The script must never print or store a token.

Add to the root `package.json` `scripts` block:

```json
"city:snapshot": "bun scripts/city-snapshot.ts",
"city:emblems": "bun scripts/city-emblems.ts",
```

#### Step 1.4: Generate the first snapshot

Run `bun run city:snapshot`.

**Verify**:
`bun -e "const s=require('./backend/city/snapshot.json'); const n=s.repos.map(r=>r.name.toLowerCase()); console.log(s.repos.length>=25, n.includes('kelpie')||n.includes('every-round'), s.repos.some(r=>'private' in r), s.repos.every(r=>r.url.startsWith('https://github.com/NotTanJune/')), n.includes('murmur'), n.includes('openlogi'))"`
→ `true false false true true false`

`cmp backend/city/snapshot.json frontend/src/city/snapshot.json` → no output, exit 0.

#### Step 1.5: Create the route and mount it

Create `backend/routes/city.js`:

```js
const express = require('express');
const router = express.Router();
const { getDefaultCityService } = require('../city');

router.get('/', async (req, res) => {
  const city = await getDefaultCityService().getCity();
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  res.json(city);
});

module.exports = router;
```

In `backend/server.js`, directly under the existing
`app.use('/api/contact', require('./routes/contact'));` line, add:

```js
app.use('/api/city', require('./routes/city'));
```

In `.env.example`, append:

```
# Optional: GitHub token for the repo city (raises the API rate limit).
# Use a fine-grained token with read-only access to PUBLIC repositories only.
# GITHUB_TOKEN=
```

#### Step 1.6: Backend tests

Create `backend/city.test.js` following `backend/turnstile.test.js`. Use a
fake `fetchImpl` that records calls and returns
`{ status, headers: { get: (k) => ... }, json: async () => body }`, and a
fake `now`. Cover at least:

1. `applyRules` keeps a public original repo.
2. `applyRules` drops a fork that is not in `include`, and keeps one that is
   (name matched case-insensitively).
3. `applyRules` drops archived repos, repos with `language: null`, repos in
   `exclude`, and any repo with `private: true`.
4. `normalizeRepo` output has no `private` key, even when the API object
   has one.
5. `limitRepos` cuts to `maxRepos` by newest `pushedAt`.
6. Service: two `getCity()` calls inside the hour call `fetchImpl` once.
7. Service: after the hour, it fetches again and sends `If-None-Match`;
   a `304` keeps the previous repos and `source: 'live'`.
8. Service: a first fetch that throws returns `source: 'snapshot'` with the
   snapshot's repos.
9. Service: a failing refresh after a good one returns `source: 'stale'`
   with the last good repos.
10. Service: no `Authorization` header without `GITHUB_TOKEN`; a
    `Bearer` header with it.
11. Service: two concurrent `getCity()` calls trigger one fetch.

**Verify**: `cd backend && bun test` → exit 0, at least 36 tests pass, 0 fail.

**Verify the route by hand**: start `cd backend && bun server.js` in the
background, then
`curl -s http://localhost:3001/api/city | bun -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.source, d.repos.length>=25, d.repos.some(r=>/^(kelpie|every-round)$/i.test(r.name)))"`
→ `live true false` (or `snapshot true false` if GitHub is unreachable). Stop
the server afterwards.

Commit: `Add cached GitHub repo list endpoint for the repo city`.

---

### Phase 2: City model code (pure, no DOM)

Create these files in `frontend/src/city/`. Everything in this phase is pure
and deterministic: no `Math.random`, no `Date.now` (time comes in as an
argument), no DOM access. Port from the mockup (see the line table in
"Current state") and convert to strict TypeScript. The mockup computes the
grid size once from a global repo list; in production every size comes from
the repo list passed in.

#### Step 2.1: `types.ts`, `rng.ts`, `styles.ts`

- `types.ts`: `CityRepo` and `CityData` from "Shared definitions", plus:

  ```ts
  export type StyleKey = 'maquette' | 'night';
  export interface Model { w: number; d: number; H: number; mat: Uint8Array; mask: Uint8Array; z0: number; isGround?: boolean; }
  export interface Item {
    model: Model;
    x: number; y: number;        // centre, in city units, origin at the centre of the ground plate
    gx: number; gy: number;      // top-left of the footprint on the ground grid (for shadows)
    w: number; d: number;        // footprint
    h: number;                   // body height used for the shadow length
    top: number;                 // total height including props (label anchor)
    repo: CityRepo | null;       // null for trees
    roof: { x: number; y: number; z: number } | null; // emblem centre and height, null when no emblem
    vent: { x: number; y: number; z: number } | null; // top of a roof vent, where smoke starts
  }
  /** What one Projects card shows: a building from the city, or one of the parks. */
  export type LotTarget = { kind: 'building'; index: number } | { kind: 'park'; park: number };
  export interface View { BW: number; BH: number; cx: number; cy: number; } // art-pixel canvas size and the plate centre
  ```

  A building's `index` is its position in `scene.buildings` (Step 2.5).
- `rng.ts`: `hash(s: string): number` and `rng(seed: number): () => number`
  exactly as in the mockup (FNV-1a and the LCG with `Math.imul`).
- `styles.ts`: `hex`, `mix`, `pack`, `litChance`, `luma`, and `STYLES` with
  `maquette` and `night`, values copied from the mockup (lines 30-58). Add a
  `languageStyle(style, language)` function that returns the entry for a
  known language and otherwise picks deterministically from the style's
  entries with `hash(language) % entries.length` (mockup line 58).
- `format.ts`: two small pure helpers used by the city label and by the card
  captions. `formatAge(days)`: `today` for 0, `Nd ago` below 60 days, else
  `Nmo ago` with `Math.round(days / 30)`. `shortLanguage(language)`:
  `Jupyter Notebook` becomes `Jupyter`; everything else is returned
  unchanged.

#### Step 2.2: `voxel.ts`

Port `buildModel(w, d, H, kindFn, paint)` unchanged in behaviour. The face
mask rule is load-bearing, keep it exactly: a bit is set when open air is
within **2** cells in that direction (bits: 1 is -x, 2 is +x, 4 is -y,
8 is +y). The reason: a slice is squashed to 60% height on screen, so about
1.7 cells of each slice edge show, and a 1-cell rim would let interior
colour leak onto walls.

The `paint` callback receives one reused object per cell with `kind`, `x`,
`y`, `z`, `mask`, `top` (nothing above this cell), `single` (exactly one mask
bit), `edge` (at least one of the four side neighbours is open, a **1** cell
test), `t` and `tLen` (position and length along the wall). `edge` is new
since the spike; take it from mockup line 76. `paint` may clear `v.mask` to 0
to mark a flat, top-lit cell.

#### Step 2.3: `layout.ts`

Constants: `SQ = 0.6`, `LOT = 16`, `ROAD = 5`.

`gridFor(n: number): { cols: number; rows: number }` with
`cols = Math.max(4, Math.ceil(Math.sqrt(n * 1.25)))` and
`rows = Math.max(3, Math.ceil((n + 2) / cols))`. For the 30 repos the rule
selects today this gives 7 by 5 (the spike drew 25 repos on 6 by 5).

`groundSize(cols, rows)` returns `GW = cols * LOT + (cols + 1) * ROAD` and
`GD = rows * LOT + (rows + 1) * ROAD`.

`assignLots(repos, cols, rows)`: sort lots by distance from the grid centre
exactly as the mockup does (the `order` array, mockup lines 113-118), sort
repos by `sizeKB` descending then `name` ascending, give repo `i` lot `i`,
and return the remaining lots as parks.

#### Step 2.4: `models.ts`

Port the per-building code (mockup lines 136-205), the trees (208-220) and
the ground (111-134) as functions
`buildingItem(repo, lot, style, materials, nowMs)`, `treeItems(parkLot, ...)`
and `groundModel(...)`. Keep these rules exactly:

- Height: `h = Math.round(6 + 1.25 * lg * lg)` with
  `lg = Math.log10(sizeKB + 1)`.
- Lit window chance from days since push: `litChance(days)` from the spike,
  with `days = Math.max(0, Math.floor((nowMs - Date.parse(pushedAt)) / 86400000))`.
- Windows: only on cells whose mask has exactly one bit, on slices where
  `z % 4` is 1 or 2, on odd positions along the wall, never in the two end
  columns, never below `z = 2`. No dithering.

These rules, already in the mockup, make a rooftop emblem fit. Keep them:

- **Roof rim is one cell wide.** A top-facing cell (`v.top`) that is an
  `edge` cell gets the rim material. Every other top-facing cell gets the
  roof material with its mask cleared to 0. This is mockup line 183. The
  spike painted every masked top cell as rim, which made the rim two cells
  wide and swallowed the 8 by 8 emblem. Do not bring that back.
- Footprint: `w` and `d` are each `11 + Math.floor(R() * 4)` (11 to 14).
- Building types are `tower`, `step`, `ell` only.
  - `step`: a single inset of 1 for `z > h * 0.6` (never 2).
  - `ell`: force `w = 14`; the tall part is `x < ellW` with `ellW = 9`.
- The flat top roof is therefore always at least 9 by 9. Set
  `item.roof = { x, y, z }` to the centre of that top roof in city units and
  `z = h - 1 + 0.3`.
- Props sit at the roof corner, not the centre: place them at cell
  `(inset + 1, inset + 1)` of the top roof so they never cover the emblem.
- New prop `vent`: a 2 by 2 column, 3 cells tall, in the chimney material
  (`S.window` colour). Record its top position on the item as
  `vent: { x, y, z } | null` (add the field to `Item`) for the smoke in
  Phase 6. Choose the prop deterministically as the mockup does; in addition,
  guarantee at least two buildings in any city of 6 or more repos have a
  `vent` (if fewer do after generation, convert the two tallest buildings
  that have no prop).

Also export `carModels(materials, style)` (two orientations of a 4 by 2 by 2
car in 3 body colours; in the `night` style the front cell uses an emissive
headlight material `#ffe9b0` and the rear cell an emissive `#ff5a4d`) and
`puffModels(materials, style)` (three sizes: 2x2x2, 3x3x2, 2x2x1; colour
`#f0efeb` for `maquette`, `#4a5c4d` for `night`).

#### Step 2.5: `scene.ts`

`makeScene(repos: CityRepo[], styleKey: StyleKey, nowMs: number): Scene`
builds the material table (`colors: Uint32Array`, 4 tones per material:
top, lit, mid, shade), the ground, building items, trees, the life models,
and the lot plate and park models from Step 2.6. It also records `cols`,
`rows`, `GW`, `GD`, `maxTop` (tallest `item.top`), `blinkers`, `items` (all
buildings and trees) and `buildings` (the items that have a repo, in the
order `assignLots` produced, so the same repo list always gives the same
index).

`faceTones(theta): Int32Array` returns the 16 tone entries for an angle
(mockup `tonesOf`, lines 542-550; entry 0 is always 0). `applyBlink(scene,
tick)` swaps the blink colours in `scene.colors` (on for 6 life ticks, off
for 6; a life tick is 125 ms).

`computeLighting(scene, theta, timeMs)` is the mockup's function of that
name (lines 285-302): it copies `faceTones(theta)` into
`scene.tones` (`Uint8Array(16)`), stamps
`scene.shadowMask` (`Uint8Array(GW * GD)`), and calls `applyBlink`. Keep
`LIGHT = [-0.99, 0.14]`, the tone thresholds (`> 0.3` lit, `> -0.45` mid,
else shade) and shadow length `Math.round(item.h * 0.5)`.

`placeItems(scene, theta, cx, cy)` returns the items with their screen
positions (`sx`, `sy`) for the current angle:
`sx = cx + cos * x - sin * y`, `sy = cy + (sin * x + cos * y) * SQ`.

**Material ids must stay below 256** (they are stored in a `Uint8Array`).
Throw an `Error` in `makeScene` if the table would exceed 255 entries.

#### Step 2.6: `parks.ts`

A Projects card whose repo is not in the city shows a park, and a card that
has a building shows it standing on a plain lot plate. Both are single voxel
models built with `buildModel`, 18 by 18 cells, with `z0 = -2` so the top of
the plate sits at height 0. Port mockup lines 239-281; they are the approved
designs. Export `PLATE = 18` and `PARK_COUNT = 6`.

`plateModel(materials)`: 3 slices. The two lower slices are the soil
material. In the top slice the outer ring of cells (the kerb: `x` or `y`
equal to 0 or 17) is the road material and the rest is the lot material; all
top cells have their mask cleared.

`parkModels(materials, style): Model[]` returns exactly six models. Each is a
plate (same soil and kerb) whose top surface is painted per park, with solid
features above it. In the table, `zz` is the height above the plate
(`zz = z - 3`), coordinates are cells from 0 to 17, and where two solids
claim a cell the first one listed wins.

| # | Name | H | Top surface inside the kerb | Solids |
|---|---|---|---|---|
| 0 | grove | 13 | grass | trees at (6,6) radius 3, (12,9) radius 2, (6,13) radius 2 |
| 1 | pond | 11 | water where `((x-10)/4.6)^2 + ((y-9)/3.3)^2 <= 1`, else grass | tree at (4,4) radius 2; one-cell stones at `zz = 0` on (5,10), (6,11), (14,5) |
| 2 | path | 13 | lot colour on rows `y = 8` and `y = 9`, else grass | trees at (12,4) radius 3 and (4,13) radius 2; a bench: wood at `zz = 0`, `y = 6`, `x` from 5 to 7 |
| 3 | garden | 9 | soil in two beds (`y` 3 to 14, `x` 3 to 7 and `x` 10 to 14), lot colour on columns `x = 8` and `x = 9`, else grass | a flower at `zz = 0` on every bed cell where `x + y` is even; shrubs at (8.5,2) and (8.5,15) |
| 4 | fountain | 8 | with `ring = max(abs(x-8.5), abs(y-8.5))`: water where `ring < 2`, lot colour where `ring < 5`, else grass | stone at `zz = 0` where `2 <= ring < 3`; a stone column for `zz < 3` where `ring < 1`; shrubs at (3,3), (14,3), (3,14), (14,14) |
| 5 | orchard | 11 | grass | trees of radius 2 at (5,5), (12,5), (5,12), (12,12); a flower at `zz = 0` on non-kerb cells where `hash('f' + x + ':' + y) % 100 < 7` |

- A tree at `(cx, cy)` with radius `r`: wood where `zz < 3` and the cell is
  exactly `(cx, cy)`; leaf where `zz >= 2` and
  `Math.hypot(x - cx, y - cy, (zz - 2 - r) * 1.05) <= r + 0.1`.
- A shrub at `(cx, cy)`: leaf where
  `Math.hypot(x - cx, y - cy, zz - 0.5) <= 1.5`.
- Paint: wood and leaf use the tree trunk and leaf materials. Stone clears
  its mask on top cells. A flower clears its mask and takes `flowerA` or
  `flowerB` by `hash('c' + x + ':' + y) % 2`.
- New materials (light, then dark): water `#9dbfb8` / `#1f3d47`; stone
  `#b6b09c` / `#4a5c4d`; flowerA `#f6d98b` / `#b89a5a`; flowerB `#f0efeb` /
  `#7d8c84`.

`makeScene` stores them as `scene.plate` and `scene.parks`.

#### Step 2.7: `emblems.ts`

- `proceduralEmblem(name: string, color: [number, number, number]): Uint8Array`
  returns 16 * 16 * 4 RGBA bytes: a 7 by 7 grid of cells mirrored
  left-to-right (so 4 unique columns), each cell 2 by 2 pixels, centred with
  a 1 pixel transparent margin. A cell is filled when
  `hash(name + ':' + col + ':' + row) % 100 < 50`. Filled pixels use
  `color` at alpha 255; everything else is alpha 0. Always fill the centre
  cell so no emblem is empty.
- `loadEmblems(): Record<string, Uint8Array>` decodes
  `frontend/src/city/emblems.json`, a map from lower-cased repo name to a
  base64 string of 1024 RGBA bytes. Create `emblems.json` now containing
  `{}`; Phase 9 fills it. Decode base64 with `atob` (available in jsdom and
  browsers).
- `emblemFor(repo, rimColor)`: the loaded emblem when present, else the
  procedural one.

#### Step 2.8: Tests for Phase 2

Create Jest tests in `frontend/src/city/` (`*.test.ts`), covering:

1. `hash('locator')` is stable (assert it equals itself across two calls and
   is an unsigned 32-bit integer) and `rng(1)` yields the same first three
   numbers on two instances.
2. Height: `sizeKB = 2` gives 6; `sizeKB = 117411` gives 38.
3. For 40 synthetic repos, every building footprint is within 11 to 14, and
   every `item.roof` is non-null.
4. Determinism: building the same repo twice yields byte-identical `mat` and
   `mask` arrays.
5. `gridFor(27)` is `{ cols: 6, rows: 5 }`; `assignLots` gives every repo a
   distinct lot and leaves at least 2 parks.
6. `makeScene` with the committed `snapshot.json` repos works for both
   styles, has one building item per repo, and at least two items with a
   `vent`.
7. `computeLighting` leaves `tones[0] === 0`, every tone in 0 to 3, and
   `shadowMask.length === GW * GD`.
8. `proceduralEmblem` returns 1024 bytes, is left-right symmetric, is
   identical across two calls, and has at least 4 opaque pixels.
9. Roof rim: for 40 synthetic repos, the top body slice (`z = h - 1`) of
   every building has at least 40 cells whose mask is 0 (a two-cell rim
   would leave fewer on the smallest roofs).
10. `parkModels` returns `PARK_COUNT` models of 18 by 18; no two have the
    same `mat` array; two calls give byte-identical arrays; `plateModel`
    has `H === 3`.
11. `faceTones(theta)[0] === 0` for several angles; `formatAge(0)`,
    `formatAge(4)`, `formatAge(90)` give `today`, `4d ago`, `3mo ago`;
    `shortLanguage('Jupyter Notebook')` gives `Jupyter`.

**Verify**: `cd frontend && bunx tsc --noEmit` → exit 0.
**Verify**: `cd frontend && CI=true bun run test --watchAll=false` → exit 0,
all suites pass, including the new ones.

Commit: `Add deterministic voxel model generation for the repo city`.

---

### Phase 3: Software rasteriser (fallback and picking)

Create `frontend/src/city/raster.ts`.

- `drawModel(...)`: port of the spike's `drawModel` (lines 316-337), writing
  into a `Uint32Array` colour buffer and a `Uint8Array` id buffer of size
  `BW * BH`. Keep the pixel-centre sampling (`px + 0.5`, `py + 0.5`) and the
  inverse rotation exactly.
- `drawEmblem(...)`: same inverse mapping for an 8 by 8 unit quad centred on
  `item.roof`, lifted by `roof.z`; sample the 16 by 16 emblem at
  `Math.floor(localX * 2)`, `Math.floor(localY * 2)`; skip pixels with
  alpha below 128. In the `night` style draw the emblem colour unchanged; in
  `maquette` also unchanged.
- `rasterize(scene, theta, timeMs, target, opts)`: calls
  `computeLighting`, draws the ground, then items sorted by `sy` ascending
  (back to front), each followed by its emblem, then the life instances from
  Phase 6 when `opts.life` is given. Ids: 0 for ground, trees and life; a
  building writes `buildingIndex + 1`. When `opts.hoverId > 0`, finish with
  the spike's one-pass outline (lines 372-379) in the style's hover ink
  (`#1a2419` for `maquette`, `#f0efeb` for `night`).
- `pick(scene, theta, cx, cy, BW, BH, x, y): number`: rasterises ids only
  (skip colour writes and the outline) and returns the id at art-pixel
  `(x, y)`, or 0.
- `rasterizeLot(scene, target, theta, view, buffer, opts)`: the fallback for
  one Projects card. It draws the lot plate (or, for a park target, that
  park model) at the view centre, then for a building target the building,
  its emblem and `opts.life`, with every position taken relative to the
  building's centre so the building turns about its own middle. It uses
  `faceTones(theta)`, draws no ground shadows and writes no ids.

**The city's framing.** `viewFor(sceneA, sceneB)` (put it in `layout.ts`,
port of mockup lines 328-337) takes both styles' scenes so the canvas does
not change size when the theme does:

```
RAD   = Math.hypot(GW, GD) / 2
reach = (Math.hypot(item.x, item.y) + Math.hypot(item.w, item.d) / 2) * SQ + item.top + (item.vent ? 14 : 0)
need  = Math.max(RAD * SQ, the largest reach over every item of both scenes)
cy    = Math.ceil(need) + 4
BW    = Math.ceil(RAD * 2) + 6
BH    = Math.ceil(cy + RAD * SQ + 6)
cx    = BW / 2
```

`reach` is how far above the plate centre an item can ever appear at any
angle (the 14 is headroom for smoke). An earlier version of this plan sized
the canvas from the plate diagonal plus the tallest building, which left
about 180 px of empty space above the city; do not use that.

**A card lot's framing.** `lotView(sceneA, sceneB)` (mockup lines 798-807),
with `RADP = Math.hypot(PLATE, PLATE) / 2`:

```
need = Math.max(RADP * SQ,
                for every building: Math.hypot(w, d) / 2 * SQ + top + (vent ? 14 : 0),
                for every park:     RADP * SQ + park.H - 3)
cy   = Math.ceil(need) + 2
BW   = Math.ceil(RADP * 2) + 4          // 30
BH   = Math.ceil(cy + RADP * SQ + 5)
cx   = BW / 2
```

Every card shares this one view, so all lots have the same canvas size and
their plates line up. `LOT_K = 2` is the number of CSS pixels per art pixel
for a lot. `lotHeightPx(view, scene, target)` is the visible height of one
lot, from the top of its content to the bottom of the canvas (mockup lines
816-820):

```
reach  = building ? Math.hypot(w, d) / 2 * SQ + top : RADP * SQ + park.H - 3
height = view.BH * LOT_K - Math.floor((view.cy - reach) * LOT_K) + 4
```

Tests (`raster.test.ts`): rasterise the snapshot scene at `theta = 0.62`;
assert the colour buffer has more than 2000 non-zero pixels, the id buffer
contains at least 20 distinct non-zero ids, and `pick` at the screen
position of the tallest building's roof returns that building's id.
`rasterizeLot` for building 0 and for park 0 each give more than 150
non-zero pixels, and parks 0 and 1 give different buffers. `layout.test.ts`:
`lotView` gives `BW === 30`; `lotHeightPx` is larger for the tallest building
than for the shortest and never exceeds `view.BH * LOT_K + 4`.

**Verify**: typecheck and frontend tests as in Phase 2 → exit 0.

Commit: `Add software rasteriser for the repo city fallback and picking`.

---

### Phase 4: WebGL2 renderer

Create `frontend/src/city/gl.ts`, a port of the mockup's `VS`, `FS`, `VS2`,
`FS2` and `makeGL` (lines 340-540). The mockup already contains every change
listed below; the list says what must survive the port and why.

`createGLRenderer(canvas: HTMLCanvasElement): GLRenderer | null` returns
`null` when `canvas.getContext('webgl2', { antialias: false, alpha: true })`
is null or when shader compilation or linking fails (catch the error, log it
once with `console.warn`, return `null`). The renderer exposes:

```ts
interface GLRenderer {
  setScene(scene: Scene): void;                  // builds atlas, palette, shadow, emblem textures and the static instance buffer
  resize(widthPx: number, heightPx: number): void;
  draw(scene: Scene, theta: number, view: View, opts: { hoverId: number; artPx: number; life: Float32Array | null }): void;
  /** One building on its lot plate, or one park, turning about the plate centre. Used by the Projects cards. */
  drawLot(scene: Scene, target: LotTarget, theta: number, view: View, opts: { life: Float32Array | null }): void;
  dispose(): void;                               // deletes every GL object it created
}
```

`setScene` may be called for several scenes (one per style); keep the GL
resources per scene, as the mockup's `res[key]` does.

What the port must keep:

1. **Remove dithering**: delete `uDither` and the `chk` logic. Ground top:
   tone 3 when the shadow texel is set, else tone 0. Walls: `uTones[mask]`.
2. **Remove the outline-everything path**: delete `uOutline` and the `edge`
   branch. Keep the hover outline (`uHover`, `uHoverInk`).
3. **View uniforms come from the `view` argument**, not constants:
   `uView = (BW, BH)`, `uCenter = (cx, cy)`.
4. **Instance flag encoding** in `aItem.w`: integer part is the id, fraction
   is the kind. `0` normal slice, `0.5` ground top slice, `0.25` emblem.
   In the vertex shader: `vId = floor(w)`, `vKind = fract(w)`. Ids: 1 for
   ground, trees and life; a building is `buildingIndex + 2`. The hover
   uniform is `hoverBuildingIndex + 2`, or 0 for none.
5. **Emblems**: an RGBA8 texture, 16 pixels tall and `16 * buildingCount`
   wide, emblem `i` at `x = 16 * i`. One extra instance per building:
   centre `item.roof.x, item.roof.y`, `z = item.roof.z`, size `8, 8`, atlas
   origin `16 * i, 0`, kind `0.25`. In the vertex shader, when the kind is
   emblem, `vUV = aRect.zw + aCorner * 16.0`. In the fragment shader, when
   the kind is emblem, sample the emblem texture with `texelFetch`, clamp the
   texel to its 16 by 16 cell, `discard` when alpha is below 0.5, and output
   its colour with the building's id.
6. **Keep the half-step slice copies**: for every slice with `z > 0`, also
   push a copy at `z - 0.5`. Without it, one-cell-wide features (antennas,
   tree trunks) render as dotted lines.
7. **Keep the depth formula**:
   `gl_Position.z = -(0.8 * r.y + 0.6 * aItem.z) / 400.0` with
   `depthFunc(LEQUAL)`. It gives correct occlusion without sorting. If the
   ground plate grows (more than 8 columns), the divisor must stay larger
   than the largest absolute depth value; compute it as
   `Math.max(400, diag + maxTop)` and pass it as a uniform.
8. **Life instances**: a second vertex array with a `DYNAMIC_DRAW` buffer of
   the same 8-float layout. `draw` uploads `opts.life` with
   `bufferSubData` (grow with `bufferData` when it does not fit) and issues a
   second `drawArraysInstanced` with the same program. The life models'
   slices are packed into the same atlas as everything else.
9. **Atlas width**: keep 1024 and shelf packing, but assert no single model
   is wider than 1024 (`w * H`); if the ground would exceed it (more than 7
   columns at 3 slices), pack the ground's slices on separate shelves
   instead of one row.
10. Upload the shadow mask and the palette each frame with `texSubImage2D`
    as the spike does (the palette changes when beacons blink).
11. No `for...of` over typed arrays or `Object` iteration that TypeScript
    rejects under `target: es5`; use index loops. The mockup uses `Map` and
    `for...of` freely; rewrite those.
12. **`uOrigin`**: a `vec2` uniform subtracted from the instance position
    before rotation (`p = aItem.xy - uOrigin + ...`). It is `(0, 0)` for the
    city and the building's centre for `drawLot`, so a lone building turns
    about its own middle.
13. **Per-item instance ranges**: while filling the static instance buffer
    in `setScene`, record for every item the index of its first instance and
    its instance count, and the index of the first emblem instance. WebGL2
    has no base-instance draw call, so `drawLot` binds a vertex array whose
    two instanced attribute pointers start `first * 32` bytes into that same
    buffer (mockup `instVAO(buf, start)` and `vaoAt`, lines 412-420 and
    501). Create these vertex arrays on demand and cache them by `first`.
14. **Plate and parks**: pack `scene.plate` and every `scene.parks[i]` into
    the atlas next to the life models. They are not in the static instance
    buffer; `drawLot` draws one through the dynamic life buffer with id 1 at
    `z = -2`.
15. **`drawLot` order** (mockup `drawOne`, lines 488-499): set the uniforms
    with `faceTones(theta)` as the tones, draw the plate or the park, then
    for a building its slices, then its one emblem instance, then
    `opts.life`, then run the outline pass with hover 0. Draw the plate
    before the building: both have cells at height 0 and the later draw wins
    under `LEQUAL`.

There is no Jest test for this file (jsdom has no WebGL). It is verified in
the browser in Phase 5.

**Verify**: `cd frontend && bunx tsc --noEmit` → exit 0.
**Verify**: `grep -n "uDither\|uOutline" frontend/src/city/gl.ts` → no matches.

Commit: `Add WebGL2 sprite stack renderer for the repo city`.

---

### Phase 5: The component, data hook, font, and labels

#### Step 5.1: Font

Download Silkscreen (SIL Open Font License) once:

```
curl -fsSL -o frontend/public/fonts/silkscreen-latin.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/silkscreen@latest/latin-400-normal.woff2"
```

**Verify**: `file frontend/public/fonts/silkscreen-latin.woff2` → contains
`Web Open Font Format (Version 2)`; size is between 5000 and 20000 bytes
(`wc -c`).

In `frontend/public/index.html`, inside the same inline `<style>` block that
declares Bricolage Grotesque, add after that `@font-face` rule:

```css
@font-face {
  font-family: 'Silkscreen';
  src: url('/fonts/silkscreen-latin.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

Do not add a preload link for it; browsers fetch it only when a label is
shown.

#### Step 5.2: `useCityData.ts`

```ts
export function useCityData(): CityData
```

- Initial value: the bundled `./snapshot.json`, typed as `CityData` with
  `source: 'snapshot'`.
- On mount, if `typeof fetch === 'function'`, request
  `process.env.NODE_ENV === 'production' ? '/api/city' : 'http://localhost:3001/api/city'`.
  On a 200 with a `repos` array of length 1 or more, replace the state, but
  only when `JSON.stringify(next.repos) !== JSON.stringify(current.repos)`,
  so an unchanged list does not rebuild the scene.
- On any failure keep the snapshot silently. Ignore the result if the
  component unmounted.

#### Step 5.3: `RepoCity.tsx` and `RepoCity.css`

Default export, loaded lazily by Home. It takes no props. Port the behaviour
from mockup lines 594-661.

Structure:

```html
<div class="repo-city-block">
  <div class="repo-city" role="group"
       aria-label="City of my GitHub repositories"
       data-renderer="webgl2|canvas2d|none" data-buildings="{n}">
    <canvas class="repo-city__canvas" aria-hidden="true"></canvas>
    <div class="repo-city__label" hidden></div>
    <ul class="repo-city__list"> <!-- visually hidden, keyboard reachable -->
      <li><a href="{url}" target="_blank" rel="noopener noreferrer">{name}, {language}</a></li>
    </ul>
  </div>
  <CityHint />   <!-- Step 5.4; omitted when data-renderer is "none" -->
</div>
```

Behaviour:

- **Theme**: read `document.documentElement.getAttribute('data-theme')`;
  `'dark'` selects the `night` style, anything else `maquette`. Watch the
  attribute with a `MutationObserver` and switch scenes when it changes.
  Build both scenes when the data arrives (the framing needs both) and keep
  them until the repo list changes.
- **Renderer choice**: try `createGLRenderer`; if it returns `null`, use a
  2D context and `rasterize`; if that is `null` too (jsdom), render only the
  list and set `data-renderer="none"`. On a `webglcontextlost` event, call
  `preventDefault`, dispose, and switch to the 2D fallback for the rest of
  that mount.
- **Sizing**: `view = viewFor(maquetteScene, nightScene)`. Measure the
  wrapper width with a `ResizeObserver` (guarded; fall back to a `resize`
  listener). `maxH` is 520 px, or 360 px when the wrapper is narrower than
  768 px. `scale = Math.min(width / view.BW, maxH / view.BH)`. The canvas
  CSS size is `BW * scale` by `BH * scale`. For WebGL the backing store is
  that size times `Math.min(devicePixelRatio, 2)`, and
  `artPx = Math.max(1, Math.round(scale * dpr))`. For the 2D fallback the
  backing store is `BW` by `BH` and the canvas gets
  `image-rendering: pixelated`. Reserve the height before the first frame so
  the page does not shift.
- **Loop**: one `requestAnimationFrame` loop that runs only while the wrapper
  is on screen (`IntersectionObserver`, guarded) and
  `document.visibilityState === 'visible'`. `theta` starts at `0.62` and
  advances by `dt * (2 * Math.PI / 48000)` per millisecond, with `dt` capped
  at 64. Rotation pauses while a building is hovered, selected by touch, or
  a list link is focused. When `prefers-reduced-motion: reduce` matches,
  never rotate and never advance the life clock; draw once and again only on
  hover, theme or size changes.
- **Hover and picking**: on `pointermove` from a mouse or pen, convert the
  pointer to art pixels and call `pick` (at most once per animation frame).
  A non-zero result sets the hovered building. `pointerleave` clears it.
  Set `cursor: pointer` on the canvas while a building is hovered.
- **Label**: the `repo-city__label` element shows
  `{name} · {shortLanguage(language)} · pushed {formatAge(days)}` for the
  hovered, selected or focused building, positioned above its roof each
  frame from `placeItems`
  (`left = canvasLeft + sx * scale`, `top = canvasTop + (sy - item.top) * scale - 12`),
  clamped to stay inside the wrapper. The label is hidden when nothing is
  hovered, selected or focused.
- **Activation**: a click on a hovered building, or a click or Enter on a
  list link, opens `repo.url` in a new tab with `noopener`.
- **Touch** (`pointerType === 'touch'`, mockup lines 620-631): the first tap
  on a building selects it, pauses the rotation and shows the label. A
  second tap on the same building, or a tap on the label, opens it. A tap
  on another building moves the selection. A tap on empty ground clears the
  selection and resumes the rotation. Ignore `pointermove` from touch, and
  ignore the `pointerleave` that follows a touch, or the selection would
  vanish as the finger lifts. The label needs `pointer-events: auto` while a
  touch selection is active. This is the behaviour the "Tap" and "Tap
  again" hints describe; the two must stay in step.
- **Cleanup**: on unmount cancel the frame, disconnect all observers, remove
  listeners and call `dispose()`.

`RepoCity.css` (plain CSS, class names above):

- `.repo-city`: `position: relative; display: flex; justify-content: center; width: 100%;`
- `.repo-city__label`: `position: absolute; transform: translate(-50%, -100%); white-space: nowrap; pointer-events: none; font-family: 'Silkscreen', 'Courier New', monospace; font-size: 0.78rem; line-height: 1.2; padding: 5px 8px 4px; border: 2px solid #1a2419; border-radius: 0; background: #f0efeb; color: #1a2419;`
  Under `:root[data-theme="dark"]`: background `#1a2419`, color `#f0efeb`,
  border colour `#f0efeb`. Add a 2 px wide, 8 px tall stem below it with
  `::after` in the border colour.
- `.repo-city__list`: the standard visually-hidden pattern
  (`position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;`).
  Do not use `display: none`; the links must stay focusable.
- No shadows, gradients, or rounded corners on the label.

#### Step 5.4: `CityHint.tsx` and `CityHint.css`

The row of four animated vignettes under the city. It tells a visitor what
they can do, so it must describe exactly what Step 5.3 does. Port mockup
lines 664-778; the palettes, sprites and timings there are the approved art.
Do not redraw them.

Markup:

```html
<ul class="repo-city-hint">
  <li><canvas width="44" height="30" aria-hidden="true"></canvas><div>Hover<span>names the repo</span></div></li>
  <li>...</li><li>...</li><li>...</li>
</ul>
```

Wording. A device counts as touch when
`typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches`,
read once on mount (jsdom has no `matchMedia`, hence the guard).

| # | Mouse: title / line | Touch: title / line |
|---|---|---|
| 1 | Hover / names the repo | Tap / names the repo |
| 2 | Click / opens it on GitHub | Tap again / opens it on GitHub |
| 3 | Taller / more code | same |
| 4 | Lit windows / pushed lately | same |

Drawing. Each canvas is 44 by 30 art pixels, shown at 132 by 90 CSS pixels
with `image-rendering: pixelated`. Each vignette is a pure function of a
step `t` from 0 to 31 and of the touch flag:

| # | Mouse | Touch |
|---|---|---|
| 1 | An arrow cursor glides onto a tower over steps 0 to 7; the tower gets an ink outline and a name tag for steps 8 to 23; the arrow leaves over 24 to 31. | A finger arrives over steps 0 to 5 and presses for 6 to 8 with a ripple ring (6 to 9); outline and name tag show for 8 to 26; the finger withdraws over 12 to 17. |
| 2 | An outlined tower; a hand presses for steps 8 to 10 with click sparks; an open-link icon rises beside it for 11 to 27. | The name tag from the first tap is still up; the hand presses for 8 to 10 with a ripple (8 to 11); the open-link icon rises for 11 to 27, starting 5 px lower so it clears the tag. |
| 3 | Two short towers and a third that gains one slice every 4 steps, from 11 to 17 tall. | same |
| 4 | An unlit tower and one whose 8 windows light up, one every 3 steps. | same |

Colours come from `HINT_PAL` (mockup lines 664-669), one palette per theme.
Read the theme the same way `RepoCity` does.

Loop: `tick = Math.floor(timeMs / 125)`, and vignette `i` shows
`t = (tick + i * 8) % 32`, so the four are out of step with each other.
Redraw only when the tick or the theme changes. Pause while the list is off
screen (`IntersectionObserver`, guarded) or the tab is hidden. Under
`prefers-reduced-motion: reduce`, draw one still frame per vignette (`t` of
14, 16, 31 and 31) and never animate. When `getContext('2d')` returns
`null` (jsdom), render the markup and draw nothing.

`CityHint.css`, from mockup lines 565-571 and 579:

- `.repo-city-hint`: `list-style: none; margin: 16px auto 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 16px; max-width: 680px;`
- `.repo-city-hint li`: `display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; font-family: 'Silkscreen', 'Courier New', monospace; font-size: 0.75rem; line-height: 1.35; color: #1a2419;`
- `.repo-city-hint canvas`: `display: block; width: 132px; height: 90px; image-rendering: pixelated;`
- `.repo-city-hint span`: `display: block; color: #4d6650;`
- Under `:root[data-theme="dark"]`: `li` colour `#f0efeb`, `span` colour `#a3b18a`.
- `@media (max-width: 640px)`: `grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 8px;` (the 2 by 2 phone layout).

Add no heading above the hint and no extra sentence below it.

#### Step 5.5: Tests

- `useCityData.test.tsx`: (1) with `global.fetch` undefined the hook returns
  the snapshot; (2) with a mocked `fetch` resolving a different repo list the
  hook updates to it; (3) with a rejecting `fetch` it keeps the snapshot.
- `RepoCity.test.tsx`: in jsdom (no canvas context) the component renders
  one link per snapshot repo and sets `data-renderer="none"`; every link
  points at `github.com`; no `.repo-city-hint` is rendered.
- `CityHint.test.tsx`: it renders four list items; by default the first two
  titles are `Hover` and `Click`; with `window.matchMedia` replaced by a
  function that returns `{ matches: true }` for `(hover: none)`, they are
  `Tap` and `Tap again`. Restore `matchMedia` after the test.

**Verify**: typecheck → exit 0; frontend tests → exit 0.

Commit: `Add RepoCity component with live data, labels, hint and fallback rendering`.

---

### Phase 6: Small life on a slow clock

Create `frontend/src/city/life.ts`. Everything is a pure function of the
tick, so there is no accumulated state:

```ts
export const LIFE_HZ = 8;
export function lifeTick(timeMs: number): number  // Math.floor(timeMs / 125)
export function lifeInstances(scene: Scene, tick: number): LifeInstance[]
```

`LifeInstance` is `{ model: Model; x: number; y: number; z: number }` in city
units.

- **Cars**: count `Math.min(8, Math.max(3, Math.round(buildingCount / 4)))`.
  Car `k` uses `R = rng(hash('car' + k))` to pick: a road line (horizontal
  or vertical, any of the `rows + 1` or `cols + 1` lines), a lane offset of
  -1 or +1 cell from the road centre line, a direction, a start offset, and
  a body colour. Its position along the road is
  `((offset + tick * direction) mod (length + 8)) - 4` (always normalise the
  modulo to be non-negative), so it enters and leaves past the plate edge;
  do not draw it while it is outside `0..length`. It sits at `z = 0` on the
  ground top. Cars do not react to each other or to intersections.
- **Smoke**: every item with a `vent` emits 3 puffs. For puff `j`,
  `age = (tick + j * 8 + hash(repo.name) % 24) % 24`;
  `z = vent.z + 1 + Math.floor(age / 2)`; `x = vent.x + Math.floor(age / 8)`;
  model size by age: below 8 the 2x2x2, below 16 the 3x3x2, else the 2x2x1.
- **Beacons** already blink through the palette in `computeLighting`.

Also export `lotPuffs(scene: Scene, item: Item, tick: number): LifeInstance[]`,
the three puffs of one vent building (mockup `puffsFor`, lines 788-796), and
have `lifeInstances` call it for each building. The Projects cards use it in
Phase 8 so a card's building smokes exactly as it does in the city.

Wire it in: `RepoCity` computes `lifeInstances` only when the tick changes,
converts them to the 8-float instance layout for `gl.ts` (id 1, kind 0), and
passes the same list to `rasterize` in fallback mode. Life is skipped
entirely under reduced motion.

Tests (`life.test.ts`): same tick gives deep-equal output on two calls; from
tick `t` to `t + 1` no car moves more than 1 unit; every drawn car lies
within the ground plate; every vent yields exactly 3 puffs; puff `z` is
always above its vent.

**Verify**: typecheck → exit 0; frontend tests → exit 0.

Commit: `Add cars, chimney smoke and beacons to the repo city`.

---

### Phase 7: Put the city on Home

#### Step 7.1: Home

In `frontend/src/components/pages/Home.tsx`:

- Add near the other imports:
  `const RepoCity = React.lazy(() => import('../../city/RepoCity'));`
  and add `Suspense` to the existing `import React, { ... } from 'react'` line
  (the page does not import it today).
- In the "Featured Projects Preview" section, between the closing
  `</AnimatedSection>` of the heading block and the `<AnimatedContent>` that
  wraps the card grid, add:

  ```tsx
  <div style={{ marginBottom: isMobile ? '40px' : '60px', minHeight: isMobile ? 540 : 640 }}>
    <Suspense fallback={null}>
      <RepoCity />
    </Suspense>
  </div>
  ```

The `minHeight` reserves room for the city and the hint together (the mockup
measures 666 px at 1440 wide and 551 px at 390 wide), so the cards below do
not jump when the chunk loads.

Add no heading, caption or helper text of your own. The section heading
introduces the city and the hint explains it.

#### Step 7.2: Verify in a browser

Run `bun run dev`, wait for both servers, then with `agent-browser`:

1. `agent-browser set viewport 1440 900`, open `http://localhost:3000/`,
   wait 3 seconds, then evaluate:
   `(() => { const el = document.querySelector('.repo-city'); const c = el && el.querySelector('canvas'); const h = document.querySelector('.repo-city-hint'); return JSON.stringify({ renderer: el && el.dataset.renderer, buildings: el && Number(el.dataset.buildings), w: c && c.clientWidth, h: c && c.clientHeight, links: document.querySelectorAll('.repo-city__list a').length, hints: h ? h.children.length : 0, hintCols: h ? getComputedStyle(h).gridTemplateColumns.split(' ').length : 0 }); })()`
   → `renderer` is `webgl2`, `buildings` is 20 or more, `w` is above 300,
   `h` is above 200, `links` equals `buildings`, `hints` is 4, `hintCols`
   is 4.
2. `agent-browser errors` → no errors mentioning `city`, `WebGL`, or
   `shader`.
3. Take a screenshot and open it. Compare it with the mockup (run it as
   described in "Current state") in the same browser: same greens and
   creams, same building proportions, visible lit windows, solid walls with
   no horizontal gaps, an emblem clearly visible on every roof inside a thin
   rim, at least one car on a road, and little empty space between the
   section heading and the top of the city. Under the city: four vignettes
   with pixel lettering. Record what you see in your report; do not claim a
   match you have not looked at.
4. Take three more screenshots one second apart and confirm the vignettes
   change (the cursor moves, the name tag appears).
5. Evaluate
   `document.documentElement.setAttribute('data-theme','dark')`, wait 1
   second, screenshot again: dark blocks, glowing windows, coloured roof
   rims, and the hint in light lettering.
6. Move the mouse over the middle of the city canvas, screenshot, and
   confirm a pixel-font label and an outline on one building.
7. Two-tap check. Scroll the city into view, then evaluate:
   `(async () => { const c = document.querySelector('.repo-city__canvas'); const r = c.getBoundingClientRect(); const opened = []; window.open = (u) => { opened.push(u); return null; }; const wait = (ms) => new Promise(f => setTimeout(f, ms)); const tap = async (x, y) => { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: x, clientY: y })); await wait(150); c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', clientX: x, clientY: y })); c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y })); await wait(150); }; const label = () => { const l = document.querySelector('.repo-city__label'); return l.hidden ? null : l.textContent; }; const x = r.left + r.width / 2, y = r.top + r.height / 2; await tap(x, y); const first = label(), n1 = opened.length; await tap(x, y); const n2 = opened.length; await tap(r.left + 4, r.top + 4); return JSON.stringify({ first, n1, n2, url: opened[0], after: label() }); })()`
   → `first` is a label string, `n1` is 0, `n2` is 1, `url` starts with
   `https://github.com/NotTanJune/`, `after` is `null`.
8. Phone widths. Set the viewport to 390 by 844, reload, and repeat check 1:
   `hintCols` is now 2, and
   `document.documentElement.scrollWidth <= window.innerWidth` is `true`.
   Screenshot it. Repeat at 320 by 700; the same two results hold.

**Verify**: `cd frontend && CI=true bun run build` → exit 0, "Compiled
successfully", no ESLint warnings.

Commit: `Show the repo city and its hint on Home`.

---

### Phase 8: A building on every Projects card

The Projects page does not show the city. Each card's footer gets a small
lot: the card's own building turning slowly on a plate, or a park when the
project has no building. Port from mockup lines 785-907, with the two
differences called out below (footer flow layout, and React components
where the mockup uses DOM injection).

#### Step 8.1: `lotStage.ts`

All lots on a page share **one** WebGL context. Browsers cap the number of
live WebGL contexts (about 16) and the page has 18 cards, so a context per
card would fail. The stage renders each lot into one offscreen canvas and
copies the result into that card's own 2D canvas.

```ts
export interface LotLayout { width: number; height: number; canvasHeight: number; } // CSS px
export interface LotHandle { setTarget(target: LotTarget): void; setHover(on: boolean): void; release(): void; }

/** Which thing a card shows. `park` is used only when the repo has no building. */
export function lotTargetFor(repos: CityRepo[], repoName: string | null, park: number): LotTarget;
export function lotLayout(repos: CityRepo[], target: LotTarget): LotLayout;
/** Returns null when the canvas has no 2D context (jsdom). */
export function acquireLot(canvas: HTMLCanvasElement, repos: CityRepo[], target: LotTarget, seed: string): LotHandle | null;
export function lotRendererKind(): 'webgl2' | 'canvas2d' | 'none';
```

Module-level state, created on first use:

- **Scenes**: both styles' scenes and `lotView(a, b)`, built with
  `makeScene(repos, style, Date.now())`. Rebuild them only when `repos` is a
  different array object than last time (compare by reference;
  `useCityData` returns the same array until the list really changes).
- `lotTargetFor`: a building target when a building's repo name equals
  `repoName` ignoring case, else `{ kind: 'park', park: park % PARK_COUNT }`.
- `lotLayout`: `width = view.BW * LOT_K` (60), `canvasHeight = view.BH * LOT_K`,
  `height = lotHeightPx(view, scene, target)`. It needs no canvas, so a
  component can size itself before anything is drawn.
- **Renderer**: on the first `acquireLot`, create a canvas with
  `document.createElement('canvas')` that is never attached to the page and
  call `createGLRenderer` on it. If that returns `null`, use the software
  path for every lot.
  - WebGL path: the offscreen canvas and every lot canvas have a backing
    store of `width * dpr` by `canvasHeight * dpr`, with
    `dpr = Math.min(devicePixelRatio, 2)`. Per lot per frame:
    `renderer.drawLot(...)`, then on the lot's 2D context
    `clearRect` and `drawImage(offscreen, 0, 0)`.
  - Software path: every lot canvas has a backing store of `view.BW` by
    `view.BH` and the class `project-lot__canvas--pixel`; draw with
    `rasterizeLot` and `putImageData`.
  - On `webglcontextlost` for the offscreen canvas: `preventDefault`,
    dispose, and switch every lot to the software path.
- **One animation loop for all lots**, running only while at least one lot
  is acquired and `document.visibilityState === 'visible'`. Per lot:
  - `theta` starts at `0.62 + (hash(seed) % 628) / 100`, so cards do not
    turn in unison.
  - `speed += ((hover ? 5 : 1) - speed) * Math.min(1, dt / 240)` and
    `theta += dt * (2 * Math.PI / 26000) * speed`, with `dt` capped at 64.
  - Skip drawing a lot whose canvas is more than 40 px outside the viewport
    (`getBoundingClientRect`; 18 cheap calls a frame).
  - Life: `lotPuffs` for a building that has a vent, on the 8-ticks-a-second
    clock; nothing for a park. Call `applyBlink(scene, tick)` once per frame
    so beacons blink.
  - Theme: read `data-theme` each frame and draw from that style's scene.
- **Reduced motion**: never advance `theta` or the life clock. Draw a lot
  once when it is acquired and again when its target, the theme, or the
  repo list changes.
- `release()` removes the lot. When the last lot is released, cancel the
  frame and dispose the renderer and the offscreen canvas, so leaving the
  page frees the context.

#### Step 8.2: `ProjectLot.tsx` and `ProjectLot.css`

```tsx
export interface ProjectLotProps {
  repos: CityRepo[];
  repoName: string | null;  // lower-cased repo name from the card's GitHub link, or null
  park: number;             // which park to show when there is no building
  seed: string;             // the project title; fixes the starting angle
}
```

It renders a fragment of two siblings, meant to be the first children of
the card's footer row:

```html
<div class="project-lot" data-kind="building|park" data-park="{n, parks only}"
     style="width: 60px; height: {layout.height}px">
  <canvas class="project-lot__canvas" aria-hidden="true"
          style="width: 60px; height: {layout.canvasHeight}px"></canvas>
</div>
<!-- only for a building: -->
<div class="project-lot__cap">{shortLanguage(language)}<span>pushed {formatAge(days)}</span></div>
```

- Compute `target = lotTargetFor(repos, repoName, park)` and
  `layout = lotLayout(repos, target)` during render, so the footer has its
  final height on the first paint.
- In an effect keyed on `repos`, `repoName` and `park`: `acquireLot` once
  per mount, `setTarget` when the target changes afterwards, `release` on
  unmount. Cards are keyed by index, so the same component instance is
  handed a different project when the filter changes; the effect is what
  keeps the picture in step with the caption.
- Hover: in the same effect, find the card with
  `canvas.closest('[data-project-card]')` and add `mouseenter` and
  `mouseleave` listeners that call `setHover`. Remove them on cleanup. Do
  not touch the card's existing handlers. On touch screens there is no
  hover and nothing is lost: the building is always visible and turning.
- After `acquireLot`, set `data-renderer` on the lot from
  `lotRendererKind()` (`none` when `acquireLot` returned `null`).

`ProjectLot.css`:

```css
.project-lot { position: relative; flex: none; overflow: hidden; margin: 0 0 -12px -10px; pointer-events: none; }
.project-lot__canvas { position: absolute; left: 0; bottom: 0; display: block; }
.project-lot__canvas--pixel { image-rendering: pixelated; }
.project-lot__cap { flex: none; margin-bottom: 2px; white-space: nowrap; pointer-events: none;
  font-family: 'Silkscreen', 'Courier New', monospace; font-size: 0.72rem; line-height: 1.45; color: #1a2419; }
.project-lot__cap span { display: block; color: #4d6650; }
:root[data-theme="dark"] .project-lot__cap { color: #f0efeb; }
:root[data-theme="dark"] .project-lot__cap span { color: #a3b18a; }
@media (max-width: 359px) { .project-lot__cap { display: none; } }
```

The negative margins let the plate hang 10 px into the card's left padding
and 12 px into its bottom padding, which is where the mockup's absolutely
positioned lot sits. The canvas is anchored to the bottom of the lot and the
lot clips it, so a short building does not reserve the height of the tallest
one. Below 360 px wide the caption is hidden because it would run into the
link buttons on a card with two links; the language is already among the
card's tech badges.

#### Step 8.3: `Projects.tsx`

1. Do not edit the `projects` list.
2. Import statically (not with `React.lazy`): `ProjectLot` from
   `'../../city/ProjectLot'`, `useCityData` from `'../../city/useCityData'`
   and `PARK_COUNT` from `'../../city/parks'`. A lazy import would let the
   cards render first and then grow when the lots arrive. `Projects` is
   itself a lazily loaded page, so this code stays out of the first load.
3. Add a helper above the component:

   ```ts
   // Matches on the repo name whatever the owner, so the owner's fork
   // `GenAI-for-Visual-Synthesis` finds the card that links to its upstream.
   const repoKey = (project: { GitHub?: string }) => {
     const m = project.GitHub && project.GitHub.match(/github\.com\/[^/]+\/([^/#?]+)/i);
     return m ? m[1].toLowerCase() : null;
   };
   ```
4. In the component, call `const city = useCityData();` next to the other
   hooks. After the `projects` array, decide what every project shows. Work
   over the full `projects` array, not the filtered one, so a card keeps its
   park when the filter changes:

   ```ts
   const inCity: Record<string, boolean> = {};
   city.repos.forEach(r => { inCity[r.name.toLowerCase()] = true; });
   let nextPark = 0;
   const lots: Record<string, { repoName: string | null; park: number }> = {};
   projects.forEach(p => {
     const key = repoKey(p);
     lots[p.title] = key && inCity[key]
       ? { repoName: key, park: 0 }
       : { repoName: null, park: nextPark++ % PARK_COUNT };
   });
   ```

   Handing parks out in order is what makes them differ: the five projects
   without a building today get parks 0 to 4. Do not pick a park by hashing
   the title; with five cards and six parks that repeats one more often than
   not. Do not wrap this in `useMemo`: `projects` is rebuilt every render, so
   a dependency array would either be wrong or trip the ESLint rule that
   fails the CI build.
5. On the card `div` (`Projects.tsx:278`), add the attribute
   `data-project-card=""`.
6. In the footer row (`Projects.tsx:419-423`), change `alignItems` from
   `'center'` to `'flex-end'` and add the lot as the first child, before the
   spacer `div`:

   ```tsx
   <ProjectLot
     repos={city.repos}
     repoName={lots[project.title].repoName}
     park={lots[project.title].park}
     seed={project.title}
   />
   ```

   The link buttons are all 36 px tall, so `flex-end` only matters now that
   the lot makes the row taller: it keeps the buttons on the card's bottom
   line.

Add nothing else to the page: no city, no heading, no legend.

#### Step 8.4: Tests

`ProjectLot.test.tsx` (jsdom, so nothing is drawn): given the snapshot
repos and `repoName="locator"`, it renders `.project-lot` with
`data-kind="building"` and a caption that contains `Rust`; with
`repoName={null}` and `park={3}` it renders `data-kind="park"`,
`data-park="3"` and no `.project-lot__cap`; `repoName="LOCATOR"` in another
case still finds the building; re-rendering the same instance from
`locator` to `null` switches it to a park.

`Projects.test.tsx`: keep the two existing tests unchanged and do not mock
`ProjectLot` (it must work in jsdom by itself). Add:

1. Under `All`, there are 18 `.project-lot` elements; the `Locator (lctr)`
   card contains one with `data-kind="building"`; the `Kelpie` and
   `Every Round` cards each contain one with `data-kind="park"`.
2. The `data-park` values of all park lots under `All` are distinct.
3. After clicking the `iOS App` filter, the `Kelpie` card still has the same
   `data-park` value it had under `All`.

Find a card from its heading with
`screen.getByRole('heading', { name }).closest('[data-project-card]')`.
Do not assert on the "pushed" text; it depends on today's date.

#### Step 8.5: README

Append a section to `README.md` before `## License`:

```markdown
## Repo city

Home shows a small pixel city where each building is one of my GitHub repos.
Height is repo size, lit windows mean a recent push, and colour is the main
language. On the Projects page each card shows its own repo's building; a
project without a public repo of mine shows a small park.

- Which repos appear is set in `backend/city/config.json` (`include` for
  forks I have worked on, `exclude` to hide a repo). Private repos never get
  a building.
- The backend serves the list at `/api/city` and refreshes it from GitHub
  hourly. `bun run city:snapshot` refreshes the committed fallback; run it
  before a deploy.
- Rooftop emblems live in `scripts/city/emblems-src/`; `bun run city:emblems`
  rebuilds `frontend/src/city/emblems.json`. Emblems were generated with
  Tessera-small (CC BY-NC 4.0). The label font is Silkscreen (SIL OFL).
```

#### Step 8.6: Verify in a browser

With `bun run dev` running and `agent-browser` at 1440 by 900, open
`http://localhost:3000/projects` and wait 3 seconds.

1. Evaluate:
   `(() => { const lots = Array.from(document.querySelectorAll('.project-lot')); const parks = lots.filter(l => l.dataset.kind === 'park').map(l => l.dataset.park); return JSON.stringify({ lots: lots.length, buildings: lots.filter(l => l.dataset.kind === 'building').length, parks: parks.length, distinctParks: new Set(parks).size, renderers: Array.from(new Set(lots.map(l => l.dataset.renderer))), city: !!document.querySelector('.repo-city'), caps: document.querySelectorAll('.project-lot__cap').length }); })()`
   → `lots` is 18, `buildings` is 10 or more, `parks` is 1 or more,
   `distinctParks` equals `parks`, `renderers` is `["webgl2"]`, `city` is
   `false`, `caps` equals `buildings`.
2. `agent-browser errors` → no errors mentioning `city`, `lot`, `WebGL` or
   `context`. A "too many active WebGL contexts" warning means the stage is
   not shared: STOP.
3. Screenshot and open it. Every card has a building or a park in its
   bottom-left corner, the link buttons sit on the card's bottom line, and
   no building overlaps a tech badge. The Locator building is clearly the
   tallest of the first row. Compare with the mockup's Projects page.
4. Screenshot again after 2 seconds: the buildings have turned.
5. Click the `Rust Project` filter, wait 1 second, repeat check 1: `lots`
   is 2, `buildings` is 2. Click `All`: `lots` is 18 again.
6. Switch to dark
   (`document.documentElement.setAttribute('data-theme','dark')`) and
   screenshot: night-style buildings, light captions.
7. Phone widths. At 390 by 844, reload and evaluate:
   `(() => { const bad = Array.from(document.querySelectorAll('[data-project-card]')).filter(c => { const cap = c.querySelector('.project-lot__cap'); if (!cap) return false; const right = cap.getBoundingClientRect().right; return Array.from(c.querySelectorAll('a')).some(a => a.getBoundingClientRect().left < right); }).length; return JSON.stringify({ bad, fits: document.documentElement.scrollWidth <= window.innerWidth, lots: document.querySelectorAll('.project-lot').length }); })()`
   → `bad` is 0, `fits` is `true`, `lots` is 18. Screenshot one card. At 320
   by 700: `fits` is `true` and
   `getComputedStyle(document.querySelector('.project-lot__cap')).display`
   is `none`.

**Verify**: typecheck → exit 0; frontend tests → exit 0;
`cd frontend && CI=true bun run build` → exit 0, "Compiled successfully", no
ESLint warnings.

Commit: `Show each project's repo building on its card`.

---

### Phase 9: Rooftop emblems from Tessera-small

The feature is complete without this phase because every building already
has a procedural emblem. This phase replaces those with generated pixel art.

#### Step 9.1: Create the build script

Create `scripts/city-emblems.ts` (bun). For each
`scripts/city/emblems-src/<name>.png`:

1. Check it is 16 by 16 with `magick identify -format "%w %h" <file>`.
   Skip and warn on any other size.
2. Read raw RGBA with `magick <file> -depth 8 RGBA:-` (1024 bytes).
3. Store `base64(bytes)` under the lower-cased file name without extension.

Write the map, keys sorted, to `frontend/src/city/emblems.json`
(2-space indent, trailing newline). Exit non-zero if `magick` is missing.

#### Step 9.2: Generate the emblems

Follow the `pixel-emoji` skill's workflow (start the daemon, generate, look
at the sheet, pick, clean up) with these limits: one `--session` per repo
slug, at most **3 rounds** per repo, and judge by the skill's four-point
rubric. For each repo first read its description
(`gh repo view NotTanJune/<name> --json description -q .description`) and
adjust the starting prompt below if it is clearly about something else.
Export the pick's raw 16 pixel file to
`scripts/city/emblems-src/<repo name>.png` (exact repo name, original
casing).

Starting prompts (subject first, colours next; keep under 22 tokens):

| Repo | Starting prompt |
|---|---|
| locator | magnifying glass over a yellow folder, orange handle |
| pdfcraft | red document page with folded corner |
| espanso | grey keyboard key with a blue lightning bolt |
| spiderfoot | black spider on a green radar circle |
| YTLite | red play button on a white rounded square |
| AutoRaise | two overlapping grey windows with a white cursor arrow |
| GenAI-for-Visual-Synthesis | red sports car, side view |
| superpowers | yellow lightning bolt on a purple shield |
| strafe | white arrow keys pointing left and right on dark blue |
| ios-simulator-skill | grey smartphone with a green check mark |
| murmur | purple speech bubble with white sound waves |
| Portfolio | cream browser window with green header bar |
| anglerfish | dark blue anglerfish with glowing yellow lure, side view |
| branch-to-the-future | orange lightning bolt over a grey clock |
| AI6101 | grey robot head with green eyes, front view |
| AI6102-ML | blue brain with yellow sparks |
| AI6103-Deep-Learning-and-Applications | purple brain with white dots |
| AI6131-3D-Deep-Learning | blue wireframe cube, three quarter view |
| GrAD | black graduation cap with yellow tassel |
| fixpath | yellow road sign with black arrow |
| cycleit | green bicycle, side view |
| crack-detection | grey concrete wall with a black crack |
| ProfileQuest | golden trophy with a blue star |
| Nightingale | brown songbird with orange chest, side view |
| DevDex | red handheld scanner with blue lens |
| pdocf | white paper sheet with red corner |
| BookMyTicket | red cinema ticket with yellow star |
| juice | orange juice glass with green straw |
| Harbour | red and white lighthouse on blue waves |
| RemoteControlRobot | small grey robot on wheels with red antenna |

For any repo in the snapshot that is not in this table, write a prompt from
its description in the same form. If no sprite passes within 3 rounds, do not
export one for that repo; it keeps its procedural emblem. List those repos in
your report.

Always finish with the skill's cleanup (`pixel-emoji clean`, then confirm
`status` shows `running: false`).

#### Step 9.3: Build and check

Run `bun run city:emblems`.

**Verify**:
`bun -e "const e=require('./frontend/src/city/emblems.json'); const k=Object.keys(e); console.log(k.length>=10, k.every(n=>Buffer.from(e[n],'base64').length===1024))"`
→ `true true`

**Verify**: typecheck → exit 0; frontend tests → exit 0;
`cd frontend && CI=true bun run build` → exit 0.

Reload `http://localhost:3000/` and `http://localhost:3000/projects` and
screenshot both: the roofs now carry the generated sprites, in the city and
on the cards.

Commit: `Add generated rooftop emblems to the repo city`.

---

## Test plan

Summary of the tests this plan adds (details are in each phase):

| File | Pattern to follow | Cases |
|---|---|---|
| `backend/city.test.js` | `backend/turnstile.test.js` | rules (4 groups), repo limit, service cache, ETag, snapshot fallback, stale fallback, token header, in-flight sharing |
| `frontend/src/city/rng.test.ts`, `models.test.ts`, `layout.test.ts`, `scene.test.ts`, `emblems.test.ts`, `parks.test.ts`, `format.test.ts` | `frontend/src/utils/colorScheme.test.ts` | determinism, height formula, footprint bounds, one-cell roof rim, grid sizing, lot view and lot height, lighting invariants, emblem shape, six distinct parks, age and language formatting |
| `frontend/src/city/raster.test.ts` | same | non-empty render, distinct ids, picking, single-lot render |
| `frontend/src/city/life.test.ts` | same | purity, speed bound, bounds, puff count |
| `frontend/src/city/useCityData.test.tsx`, `RepoCity.test.tsx`, `CityHint.test.tsx`, `ProjectLot.test.tsx` | `frontend/src/components/pages/Projects.test.tsx` | fetch success, failure, absence; list rendering; mouse and touch hint wording; building, park and re-targeted lots |
| `frontend/src/components/pages/Projects.test.tsx` | itself | a lot on every card; building and park cards; distinct parks; a park survives a filter change |

Final verification: `cd backend && bun test` and
`cd frontend && CI=true bun run test --watchAll=false` both exit 0.

## Done criteria

ALL must hold:

- [ ] `cd backend && bun test` exits 0 with at least 36 passing tests.
- [ ] `cd frontend && bunx tsc --noEmit` exits 0.
- [ ] `cd frontend && CI=true bun run test --watchAll=false` exits 0; the 10 baseline tests still pass and the new suites exist and pass.
- [ ] `cd frontend && CI=true bun run build` exits 0 with no warnings.
- [ ] `cmp backend/city/snapshot.json frontend/src/city/snapshot.json` exits 0.
- [ ] `grep -rn "from 'three'\|uDither\|uOutline\|toytown\|parksheet\|fonts.googleapis" frontend/src/city/` returns no matches.
- [ ] `grep -rn "api.github.com" frontend/src/` returns no matches (only the backend calls GitHub).
- [ ] `grep -n "RepoCity" frontend/src/components/pages/Projects.tsx` returns no matches (the Projects page shows lots, not the city).
- [ ] `grep -rn "getContext('webgl2'" frontend/src/city/ | grep -v '\.test\.'` matches twice: in `gl.ts`, the only place a context is created (the Home city and the lot stage each call it once), and in `RepoCity.tsx`'s unmount effect, which fetches the existing context to release it (added in review, commit `2fdb1b6`).
- [ ] `git diff a8ee935 --stat -- frontend/package.json backend/package.json` shows no changes; the root `package.json` diff contains only the two `city:` script lines.
- [ ] `curl -s http://localhost:3001/api/city` (backend running) returns JSON with `repos` of length 25 or more, in which no repo has a `private` key, none is named `kelpie` or `Every-Round`, and every `url` starts with `https://github.com/NotTanJune/`.
- [ ] The browser checks in Step 7.2 (Home) and Step 8.6 (Projects) pass, including the two-tap check and the 390 px and 320 px phone widths, with screenshots of Home and Projects in light and dark and at phone width attached to the report.
- [ ] No files outside the in-scope list are modified (`git status`, `git diff --stat a8ee935`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt does not match the live file.
- `gh` is missing or not authenticated when you run `bun run city:snapshot`.
  Do not hand-write a snapshot.
- The snapshot or the API response would contain any private repo.
- A shader fails to compile or link in the browser and two fix attempts do
  not resolve it. Report the exact info log.
- `data-renderer` is `canvas2d` or `none` in headless Chromium on Home in
  Step 7.2 or on any card lot in Step 8.6 (the WebGL2 path is the product;
  the fallback working is not completion).
- The browser reports too many WebGL contexts on the Projects page, or you
  find you need a WebGL context per card.
- A card lot cannot be placed in the footer without overlapping a tech
  badge or a link button at 390 px wide, or without the page scrolling
  sideways at 320 px.
- The hint would have to describe behaviour the city does not have (for
  example, the two-tap rule was not implemented). Fix the behaviour; never
  reword the hint to match a shortcut.
- You believe a new dependency, a change to the content security policy, or
  an edit to `frontend/src/App.tsx` is required.
- The material table exceeds 255 entries.
- `CI=true bun run build` fails on a warning in a file you did not touch.
- A step's verification fails twice after a reasonable fix attempt.
- The `pixel-emoji` daemon cannot be stopped during cleanup.

Never substitute a different approach for a blocked step and report the
result as equivalent.

## Maintenance notes

- **Deploying**: this plan does not deploy. `scripts/deploy.sh` requires the
  `heroku-deploy` branch; today `main` and `heroku-deploy` have the same
  tree, so the owner fast-forwards `heroku-deploy` to `main` and runs
  `bun run deploy`. Running `bun run city:snapshot` and committing the result
  before a deploy keeps the fallback fresh.
- **Rate limits**: the backend calls GitHub unauthenticated, which allows 60
  requests an hour per IP address. Heroku dynos share outbound addresses
  with other apps, so that budget can be used up by strangers; when it is,
  the city serves stale or snapshot data, which is safe. Setting an optional
  `GITHUB_TOKEN` config var (fine-grained, public repositories, read-only)
  raises the limit. Never use a token that can read private repos.
- **What is public**: `snapshot.json` is committed and served. It holds
  only data GitHub already shows publicly for public repos. Private repos
  are never fetched, stored or drawn; the owner ruled that out on
  2026-11-21, so do not add a private override later without asking.
- **Forks**: a fork needs an `include` entry to appear. When the owner
  starts committing to a new fork, add its name there; nothing detects it
  automatically.
- **Mixed pixel density**: emblems are drawn at twice the pixel density of
  the buildings (a 16 by 16 sprite on an 8 by 8 patch of roof). This was
  chosen so the approved building proportions did not have to grow to fit a
  16 pixel roof. The roof rim is one cell wide for the same reason.
- **The hint and the behaviour are a pair**: the "Hover", "Click", "Tap" and
  "Tap again" vignettes describe what `RepoCity` does. Change one and you
  must change the other. The hint's "Taller" and "Lit windows" likewise
  restate the data mapping in `models.ts`.
- **Contexts are released on leaving a page**: the lot stage disposes its context when the last card unmounts, and `RepoCity` loses its context one task after a real unmount (never in its main effect's cleanup, which also runs when the repo list changes and under StrictMode, and reuses the same canvas).
- **Card lots share one WebGL context** through `lotStage.ts`. Adding
  project cards costs nothing; giving each card its own context would break
  the page past about 16 cards.
- **Parks**: a project gets a park when its GitHub link is missing or names
  a repo that is not in the city. Parks are handed out in list order from
  six designs, so reordering the `projects` array or publishing a repo can
  change which park a card shows. A seventh park-less project repeats the
  first design; add a design to `parks.ts` and raise `PARK_COUNT` if that
  matters.
- **A card's building is its repo's building**: `ProjectLot` and the Home
  city both use `makeScene` on the same repo list, so they always match.
  The match is by repo name whatever the owner, so a card that links to an
  upstream repo shows the owner's fork of it.
- **Licences**: Tessera-small output is CC BY-NC 4.0, fine for a personal
  portfolio and not for commercial reuse. Silkscreen is SIL OFL.
- **Scaling**: the grid grows with the repo count up to `maxRepos` (40).
  Past roughly 60 buildings the 8-bit ids, the 255-material limit and the
  1024-wide atlas all need revisiting.
- **Reviewer focus**: the content security policy is untouched; no browser
  request goes to GitHub; `applyRules` can never emit a private repo; the
  render loops (city, hint, card lots) stop when off screen or when the tab
  is hidden; reduced motion disables rotation, life and the hint animation;
  the 2D fallback really runs when `getContext('webgl2')` returns null (test
  by temporarily forcing it), on Home and on the cards; leaving the Projects
  page releases the lot stage's context; no card's footer overlaps at phone
  widths.
- **Deferred**: window lights that flicker over time, cars that stop at
  junctions, drag to rotate, tapping a card's building to open its repo, and
  running the snapshot refresh from `scripts/deploy.sh` automatically.
