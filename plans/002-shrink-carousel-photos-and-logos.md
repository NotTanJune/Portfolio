# Plan 002: Halve the carousel photo payload and shrink timeline logos ~25x

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f55a72c..HEAD -- scripts/optimize-images.ts frontend/public/images/profile frontend/public/images/logos frontend/src/components/Timeline.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" facts against the live files before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `f55a72c`, 2026-10-22

## Why this matters

The About-section photo carousel (`frontend/src/components/CircularCarousel.jsx`, lines ~389-399) waits until ALL its images have loaded and decoded (2.4s cap) before it shows anything. Those 7 photos total ~704KB because they were encoded at WebP quality 90. Re-encoding at quality 72 with unchanged dimensions measured ~358KB total, so the carousel becomes ready about twice as fast. Separately, the education/experience timeline shows logos in a 54x54px box, but `VI-solutions.jpg` is a 2048x1448 JPEG (163KB) and `NTU.svg` is a 170KB Inkscape file with 280 paths. Rasterized to 160px WebP they measured 2.7KB and 11KB. Root cause for the JPEG surviving: the image optimizer has no `logos` preset, so `frontend/public/images/logos/` is never processed.

## Current state

- `scripts/optimize-images.ts`: Bun script run by `bun run optimize-images` (and by `build:frontend`, the Heroku build, and the Husky pre-commit hook). Presets, lines ~30-33:
  ```ts
  const PRESETS: Record<string, ImagePreset> = {
    profile: { quality: 90, maxWidth: 800, maxHeight: 800 },
    projects: { quality: 85, maxWidth: 1200, maxHeight: 800 },
  };
  ```
  `convertToWebp` SKIPS files that are already `.webp` (`if (extension === ".webp" || ...) return { status: "skipped" }`) and DELETES the source after converting a non-webp file. So changing the profile quality does not re-encode existing `.webp` files; Step 2 does that one time by hand.
- `frontend/public/images/profile/` sizes in bytes (all `.webp`): `pfp` 89190, `pfp2` 154434, `pfp3` 153404, `pfp4-updated` 78334, `pfp5` 93276, `pfp6` 79620, `pfp7` 56778. Also `pfp-pixel.webp` and `pfp-pixel-twitter.webp`, which are social preview images referenced by `index.html` og/twitter meta tags.
- `frontend/public/images/logos/`: `NTU.svg` 170639, `VI-solutions.jpg` 163199 (2048x1448), `MIT.webp` 29242 (220px wide), `Bosch.svg` 2364, `Ericsson.svg` 2854.
- `frontend/src/components/Timeline.tsx`: logo paths at lines ~16 (`'/images/logos/NTU.svg'`) and ~47 (`'/images/logos/VI-solutions.jpg'`). Logos render in a 72px (56px mobile) box at 75%: `style={{ width: '75%', height: '75%', objectFit: 'contain' }}`.
- Test pattern: `scripts/optimize-images.test.ts` (bun:test) tests `convertToWebp` with its own preset; it does not read `PRESETS`.
- Tools available on the owner's machine: `magick` (ImageMagick, `/opt/homebrew/bin/magick`) and `rsvg-convert` (`/opt/homebrew/bin/rsvg-convert`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Image script tests | `bun run test:images` | all pass |
| Frontend build | `cd frontend && bun run build` | exit 0 |
| Size check | `wc -c frontend/public/images/profile/pfp*.webp frontend/public/images/logos/*` | see done criteria |

Run from repo root `/Users/nottanjune/Code-Projects/Portfolio`.

## Scope

**In scope**:
- `scripts/optimize-images.ts` (PRESETS only)
- `frontend/public/images/profile/pfp.webp`, `pfp2.webp`, `pfp3.webp`, `pfp4-updated.webp`, `pfp5.webp`, `pfp6.webp`, `pfp7.webp` (re-encode in place)
- `frontend/public/images/logos/NTU.svg` (delete, replaced by `NTU.webp`), `VI-solutions.jpg` (delete, replaced by `VI-solutions.webp`)
- `frontend/src/components/Timeline.tsx` (two logo paths)

**Out of scope**:
- `pfp-pixel.webp`, `pfp-pixel-twitter.webp`: social share images; quality matters there and they are not on the page.
- `frontend/public/images/projects/*`: lazy-loaded on other sections; not part of this plan.
- `Bosch.svg`, `Ericsson.svg`, `MIT.webp`: already small.
- `CircularCarousel.jsx` preload logic.
- `frontend/build/` (generated).

## Git workflow

- Current branch, working tree in place. No new branches or worktrees.
- One commit, plain imperative message, e.g. `Re-encode carousel photos and shrink timeline logos`.
- The Husky pre-commit hook runs the image optimizer on staged images; that is expected. If it changes files, re-run the size checks.
- Do NOT push or deploy.

## Steps

### Step 1: Update presets

In `scripts/optimize-images.ts` change `PRESETS` to:
```ts
const PRESETS: Record<string, ImagePreset> = {
  profile: { quality: 72, maxWidth: 800, maxHeight: 800 },
  projects: { quality: 85, maxWidth: 1200, maxHeight: 800 },
  logos: { quality: 85, maxWidth: 160, maxHeight: 160 },
};
```

**Verify**: `bun run test:images` → all pass.

### Step 2: Re-encode the 7 carousel photos in place

```sh
cd frontend/public/images/profile
for f in pfp pfp2 pfp3 pfp4-updated pfp5 pfp6 pfp7; do
  magick "$f.webp" -quality 72 "$f.tmp.webp" && mv "$f.tmp.webp" "$f.webp"
done
cd -
```

**Verify**: `wc -c frontend/public/images/profile/pfp.webp frontend/public/images/profile/pfp[2-7]*.webp | tail -1` → total under 400000 (measured ~358000). Open 2 of them (e.g. `open frontend/public/images/profile/pfp2.webp`) only if you can view images; otherwise skip visual check and say so in your report.

### Step 3: Convert the two oversized logos

```sh
cd frontend/public/images/logos
rsvg-convert -w 160 NTU.svg -o NTU.png
magick NTU.png -quality 85 NTU.webp && rm NTU.png NTU.svg
magick VI-solutions.jpg -resize 160x160 -quality 85 VI-solutions.webp && rm VI-solutions.jpg
cd -
```

**Verify**: `wc -c frontend/public/images/logos/NTU.webp frontend/public/images/logos/VI-solutions.webp` → each under 20000. `ls frontend/public/images/logos/` → no `NTU.svg`, no `VI-solutions.jpg`.

### Step 4: Point Timeline at the new files

In `frontend/src/components/Timeline.tsx` replace `'/images/logos/NTU.svg'` with `'/images/logos/NTU.webp'` and `'/images/logos/VI-solutions.jpg'` with `'/images/logos/VI-solutions.webp'`.

**Verify**: `grep -rn "NTU.svg\|VI-solutions.jpg" frontend/src frontend/public backend` → no output.

### Step 5: Build

**Verify**: `cd frontend && bun run build` → exit 0. `ls frontend/build/images/logos/` → contains `NTU.webp` and `VI-solutions.webp`.

## Test plan

No new tests. The preset table is data; `bun run test:images` covers the conversion function. Visual check is for the reviewer: run the site, scroll to the About carousel and the timeline, confirm photos look clean at card size and logos are crisp.

## Done criteria

- [ ] `bun run test:images` exits 0
- [ ] 7 carousel photos total < 400000 bytes
- [ ] `NTU.webp` and `VI-solutions.webp` each < 20000 bytes; `NTU.svg` and `VI-solutions.jpg` deleted
- [ ] `grep -rn "NTU.svg\|VI-solutions.jpg" frontend/src frontend/public backend` returns nothing
- [ ] `cd frontend && bun run build` exits 0
- [ ] `git status --short` shows only in-scope paths (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `magick` or `rsvg-convert` is not installed: report; do not install anything and do not substitute another tool.
- Any re-encoded photo is LARGER than its original (byte count): restore it with `git checkout -- <file>` and report.
- `NTU.svg` or `VI-solutions.jpg` is referenced anywhere other than `Timeline.tsx` (check with the Step 4 grep before deleting).
- The rasterized NTU logo is visibly wrong (blank or cropped) if you can view it.

## Maintenance notes

- New logos dropped into `frontend/public/images/logos/` as JPG/PNG will now be auto-resized to 160px WebP by the optimizer. SVGs are not processed by the script; keep SVG logos small or rasterize them.
- New profile photos will be encoded at quality 72. If someone sees artifacts, raise to 78 rather than back to 90.
- Edge caching: these files keep their URLs, so Cloudflare may serve old bytes until cache expiry. If plan 003 has landed, purge the cache after deploying.
