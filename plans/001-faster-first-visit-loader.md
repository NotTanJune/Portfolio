# Plan 001: Cut the first-visit loader to a ~400ms floor and stop gating it on a below-the-fold image

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f55a72c..HEAD -- frontend/public/index.html frontend/src/App.tsx frontend/src/components/LoadingScreen.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `f55a72c`, 2026-10-22

## Why this matters

On a first visit the site shows a "0% to 100%" counter (`LoadingScreen`) that has a hard-coded minimum of about 1000ms (420ms count, 180ms hold at 99, 120ms finish, 60ms hold at 100, 220ms fade). It also holds at 99% until `/images/profile/pfp.webp` has downloaded and decoded. That image is NOT above the fold: the hero section is text only and fills `100vh`, the skills section after it also has `minHeight: 100vh`, and the photo carousel sits in the About section below both. `index.html` additionally preloads that image with `fetchpriority="high"`, so it competes with the JS bundle and font on the critical path. The owner chose to keep the loader but shorten it to roughly 400ms. After this plan, the loader's fixed floor is ~420ms and it waits only on things that are actually visible at reveal (route chunk, route commit, fonts).

## Current state

- `frontend/public/index.html`: static HTML shell (CRA template). Lines 33-34:
  ```html
      <!-- Preload first profile carousel image for faster above-the-fold rendering -->
      <link rel="preload" as="image" href="/images/profile/pfp.webp" fetchpriority="high" />
  ```
- `frontend/src/App.tsx`: root component. The loader "ready" promise, lines ~808-840:
  ```tsx
    // Real readiness signal the loader holds at 99% for: first-paint route chunk,
    // web fonts, and the above-the-fold hero image. Each task fails open so a slow
    // or missing asset can never deadlock the loader (a hard cap also exists there).
    const whenReady = useMemo<Promise<unknown>>(() => {
      if (!initialIsLoading) return Promise.resolve();
      const tasks: Promise<unknown>[] = [];
      ...
      // Decode the hero image before reveal (it is also preloaded in index.html).
      tasks.push(
        new Promise<void>((resolve) => {
          try {
            const img = new Image();
            const done = () => resolve();
            img.onload = done;
            img.onerror = done;
            img.src = '/images/profile/pfp.webp';
            if (img.complete) resolve();
          } catch {
            resolve();
          }
        })
      );
      return Promise.all(tasks);
  ```
- `frontend/src/components/LoadingScreen.tsx`: the counter overlay. Timing constants, lines 11-15:
  ```tsx
  const FAST_DURATION = 420;   // 0 -> 99, quick
  const MIN_HOLD_99 = 180;     // the "kink": always pause at 99% at least this long
  const MAX_HOLD_99 = 4000;    // hard cap so a slow/failed asset can never hang the loader
  const FINISH_DURATION = 120; // 99 -> 100
  const HOLD_AT_100 = 60;      // brief beat on 100 before reveal
  ```
  Exit fade, lines ~27-31:
  ```tsx
      exit: {
        opacity: 0,
        transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
      }
  ```
- Where the image actually renders: `frontend/src/components/pages/Home.tsx` passes `profileImages` (pfp.webp first) to `<CircularCarousel>` inside the "About Section" (around line 544-592), after the hero section (line ~284, `minHeight: 100vh`) and the skills section (line ~498, `minHeight: '100vh'`).
- Conventions: comments are short `//` lines explaining why; keep that style.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build (also typechecks) | `cd frontend && bun run build` | exit 0, "Compiled successfully" (warnings OK if they existed before) |
| Frontend tests | `cd frontend && CI=true bun run test --watchAll=false` | all pass |

Run commands from the repo root `/Users/nottanjune/Code-Projects/Portfolio` unless a `cd` is shown. Package manager is bun (not yarn, despite older docs).

## Scope

**In scope** (the only files you should modify):
- `frontend/public/index.html`
- `frontend/src/App.tsx` (only the `whenReady` block)
- `frontend/src/components/LoadingScreen.tsx` (only timing constants and exit duration)

**Out of scope**:
- `frontend/src/components/CircularCarousel.jsx`: it preloads its own images when it mounts; leave it.
- The 4500ms reveal fallback timeout in `App.tsx` (`If the route never commits, reveal anyway`): it is a safety net; keep it.
- `MAX_HOLD_99` (4000): safety cap; keep it.
- Any change to the loader's look, font, or the `visited` localStorage logic.
- The font preload `<link rel="preload" as="font" ...>` in `index.html`: keep it.

## Git workflow

- Work on the CURRENT branch in the working tree. Do not create branches or worktrees.
- One commit. Message style matches repo history (plain imperative sentence), e.g. `Shorten first-visit loader and drop below-fold image gate`.
- Do NOT push. Do NOT deploy.

## Steps

### Step 1: Remove the image preload from index.html

Delete the comment line and the `<link rel="preload" as="image" href="/images/profile/pfp.webp" fetchpriority="high" />` line. Leave everything else, including the font preload and the CDN preconnects.

**Verify**: `grep -c "as=\"image\"" frontend/public/index.html` → `0`

### Step 2: Remove the image task from `whenReady` in App.tsx

Delete the whole `// Decode the hero image before reveal ...` comment and its `tasks.push(new Promise<void>(...))` block. Update the comment above `const whenReady` so it no longer mentions the hero image, e.g.:
```tsx
  // Real readiness signal the loader holds at 99% for: first-paint route chunk,
  // route commit, and web fonts. Each task fails open so a slow or missing asset
  // can never deadlock the loader (a hard cap also exists there).
```

**Verify**: `grep -n "pfp.webp" frontend/src/App.tsx` → no output

### Step 3: Shorten LoadingScreen timings

Set the constants to:
```tsx
const FAST_DURATION = 180;   // 0 -> 99, quick
const MIN_HOLD_99 = 40;      // the "kink": always pause at 99% at least this long
const MAX_HOLD_99 = 4000;    // hard cap so a slow/failed asset can never hang the loader
const FINISH_DURATION = 60;  // 99 -> 100
const HOLD_AT_100 = 0;       // reveal as soon as 100 is shown
```
and change the exit `duration: 0.22` to `duration: 0.14`. Floor = 180 + 40 + 60 + 0 + 140 = 420ms.

**Verify**: `grep -nE "FAST_DURATION = 180|MIN_HOLD_99 = 40|FINISH_DURATION = 60|HOLD_AT_100 = 0|duration: 0.14" frontend/src/components/LoadingScreen.tsx | wc -l` → `5`

### Step 4: Build and test

**Verify**: `cd frontend && bun run build` → exit 0. Then `cd frontend && CI=true bun run test --watchAll=false` → all pass.

## Test plan

No new automated tests: the change is constant values and removal of one promise. Manual check for the reviewer (not required of the executor): run `bun run dev` from the repo root, open http://localhost:3000 in a private window (no `visited` key), confirm the counter runs 0 to 100 in well under a second and the hero appears with no layout jump; scroll to About and confirm the carousel still appears.

## Done criteria

- [ ] `grep -c "/images/profile/pfp.webp" frontend/public/index.html` prints `0`
- [ ] `grep -c "pfp-pixel" frontend/public/index.html` prints `2` (og:image and twitter:image meta tags untouched)
- [ ] `grep -n "pfp.webp" frontend/src/App.tsx` returns nothing
- [ ] Step 3 grep prints `5`
- [ ] `cd frontend && bun run build` exits 0
- [ ] `cd frontend && CI=true bun run test --watchAll=false` exits 0
- [ ] `git status --short` lists only the three in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The `whenReady` block no longer contains the `pfp.webp` decode task, or `index.html` no longer has the image preload (someone already changed it): report what you found.
- `Home.tsx` now renders an `<img>` in the hero section (before the skills section). Then the image IS above the fold and this plan's premise is wrong.
- Build or tests fail twice after a reasonable fix attempt.

## Maintenance notes

- If a hero image is ever added above the fold, add a decode task for THAT image to `whenReady` and preload it in `index.html`.
- Reviewer: check the og/twitter meta tags in `index.html` were not touched.
- The loader still waits on `document.fonts.ready`; on an edge-cache miss the font can take ~1.2s from the US Heroku origin. Plan 003 (edge caching) addresses that.
