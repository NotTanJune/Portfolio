# Plan 004: Self-host the 37 skill icons instead of hot-linking 5 third-party hosts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f55a72c..HEAD -- frontend/src/components/pages/Home.tsx frontend/public/index.html`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: 001 also edits `frontend/public/index.html` (a different region). Run after 001 to avoid conflicts.
- **Category**: perf
- **Planned at**: commit `f55a72c`, 2026-10-22

## Why this matters

The skills section on the home page renders 37 icons loaded from five third-party hosts: `cdn.jsdelivr.net`, `cdn.simpleicons.org`, `langfuse.com`, `www.svgrepo.com`, `cdn.brandfetch.io`. Each host costs a DNS lookup and TLS handshake. Many jsdelivr paths are unpinned (`gh/devicons/devicon/icons/...` with no version), so the icons can change or break without notice, and the code already has an `onError` that hides broken icons. Self-hosting puts all 37 on the site's own origin. They then share one HTTP/2 connection and get edge-cached alongside the other images (see plan 003). It also lets `index.html` drop three preconnect/dns-prefetch hints that compete with critical requests.

## Current state

- `frontend/src/components/pages/Home.tsx`:
  - `skillsData` object, lines ~22-71, groups `Languages`, `Frameworks`, `Databases`, `Tools`. Each entry looks like:
    ```tsx
        { name: 'C++', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg' },
    ```
    `grep -c "icon: 'http" Home.tsx` = 37 at planning time. One is PNG: `{ name: 'Groq', icon: 'https://cdn.brandfetch.io/idxygbEPCQ/w/201/h/201/theme/dark/icon.png?c=...&t=...'}` (note: no space before `}`).
  - Renderer, lines ~232-252:
    ```tsx
                  {skill.icon.startsWith('http') ? (
                    <img
                      src={skill.icon}
                      alt={`${skill.name} logo`}
                      loading="lazy"
                      decoding="async"
                      width={isMobile ? 18 : 20}
                      height={isMobile ? 18 : 20}
                      ...
                      onError={(e) => {
                        // CDN icon unavailable: hide the broken image rather than show a placeholder glyph
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: isMobile ? '18px' : '20px' }}>{skill.icon}</span>
                  )}
    ```
- `frontend/public/index.html` lines ~36-40:
  ```html
      <!-- Warm up connections to the icon CDNs used on the skills section -->
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
      <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
      <link rel="dns-prefetch" href="https://cdn.brandfetch.io" />
      <link rel="dns-prefetch" href="https://www.svgrepo.com" />
  ```
- Static files in `frontend/public/` are served at the site root (CRA). Existing image folders: `frontend/public/images/{profile,projects,logos}`. The image optimizer (`scripts/optimize-images.ts`) only processes `profile`, `projects` and `logos`, so a new `skills` folder is left untouched (wanted: SVGs stay SVG).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `cd frontend && bun run build` | exit 0 |
| Frontend tests | `cd frontend && CI=true bun run test --watchAll=false` | all pass |

Run from repo root `/Users/nottanjune/Code-Projects/Portfolio`.

## Scope

**In scope**:
- `frontend/public/images/skills/` (create; 37 icon files)
- `frontend/src/components/pages/Home.tsx` (only the `icon:` URL strings, the `startsWith('http')` check, and the `onError` comment)
- `frontend/public/index.html` (only the icon-CDN preconnect/dns-prefetch block)

**Out of scope**:
- Icon sizes, layout, or the skills list contents (do not add, remove or rename skills).
- The CSP `imgSrc` in `backend/server.js`: leave it (other external images may exist).
- Any other `index.html` lines.

## Git workflow

- Current branch, working tree in place. No branches or worktrees.
- One commit, plain imperative message, e.g. `Self-host skill icons`.
- Do NOT commit the temporary download script. Do NOT push or deploy.

## Steps

### Step 1: Download icons and rewrite URLs

Write this one-off script OUTSIDE the repo (for example `$TMPDIR/fetch-icons.ts`) and run it from the repo root with `bun $TMPDIR/fetch-icons.ts`:

```ts
const homePath = "frontend/src/components/pages/Home.tsx";
const outDir = "frontend/public/images/skills";
let source = await Bun.file(homePath).text();
const entry = /\{ name: '([^']+)', icon: '(https?:\/\/[^']+)'\s*\}/g;
const matches = [...source.matchAll(entry)];
console.log(`found ${matches.length} icons`);
for (const [, name, url] of matches) {
  // Browser-like headers: cdn.brandfetch.io redirects plain requests to an HTML page.
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8",
      Referer: "https://tanmaynargas.com/",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${name} ${url}`);
  const type = res.headers.get("content-type") ?? "";
  const ext = type.includes("png") ? "png" : type.includes("svg") ? "svg" : null;
  if (!ext) throw new Error(`unexpected content-type ${type} for ${name}`);
  const slug = name.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = `${outDir}/${slug}.${ext}`;
  await Bun.write(file, await res.arrayBuffer());
  source = source.replace(url, `/images/skills/${slug}.${ext}`);
}
await Bun.write(homePath, source);
```

**Verify**:
- Script prints `found 37 icons` and exits 0.
- `ls frontend/public/images/skills | wc -l` → `37`
- `grep -c "icon: 'http" frontend/src/components/pages/Home.tsx` → `0`
- `grep -c "icon: '/images/skills/" frontend/src/components/pages/Home.tsx` → `37`
- `ls frontend/public/images/skills | sort | uniq -d` → no output (no slug collisions)

### Step 2: Update the renderer check

In `Home.tsx` change `skill.icon.startsWith('http')` to `skill.icon.startsWith('/')`, and change the `onError` comment to `// Icon file missing: hide the broken image rather than show a placeholder glyph`.

**Verify**: `grep -n "startsWith('http')" frontend/src/components/pages/Home.tsx` → no output.

### Step 3: Remove the CDN connection hints

Delete the 5-line block in `frontend/public/index.html` starting at `<!-- Warm up connections to the icon CDNs used on the skills section -->` (the comment plus the preconnect and three dns-prefetch lines).

**Verify**: `grep -cE "jsdelivr|brandfetch|svgrepo" frontend/public/index.html` → `0`

### Step 4: Build and test

**Verify**: `cd frontend && bun run build` → exit 0; `ls frontend/build/images/skills | wc -l` → `37`; `cd frontend && CI=true bun run test --watchAll=false` → all pass.

## Test plan

No new automated tests (data and URL change only). Reviewer visual check: run the site, scroll to the skills section, confirm all 37 icons show (none hidden by `onError`) in both light and dark theme. Check the browser network tab: no requests to the five former hosts.

## Done criteria

- [ ] 37 files in `frontend/public/images/skills/`, each non-empty (`find frontend/public/images/skills -empty` prints nothing)
- [ ] `grep -rnE "cdn.jsdelivr|simpleicons|brandfetch|svgrepo|langfuse.com" frontend/src frontend/public` returns nothing
- [ ] `cd frontend && bun run build` exits 0
- [ ] `cd frontend && CI=true bun run test --watchAll=false` exits 0
- [ ] `git status --short` shows only in-scope paths (plus `plans/README.md`); no fetch script inside the repo
- [ ] `plans/README.md` status row updated

## STOP conditions

- The script finds a count other than 37, or any download fails or returns an unexpected content-type: report the failing names and URLs. Do not hand-pick replacement icons.
- Any downloaded `.svg` file starts with `<!DOCTYPE html` or `<html` (an error page served as 200). Check with `grep -l "<html" frontend/public/images/skills/*.svg`.
- Network access is unavailable in your environment.

## Maintenance notes

- New skills now need their icon file added to `frontend/public/images/skills/` and referenced by path. Hot-linking still works (the CSP allows `https:` images), but avoid it to keep this benefit.
- Icons are now frozen at today's versions. Upstream brand refreshes will not appear automatically, which is intended.
