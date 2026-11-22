# Tanmay Nargas: Portfolio

Source for my personal portfolio at **[tanmaynargas.com](https://tanmaynargas.com)**: projects, experience, resume, and a contact form.

## Stack

- **Frontend:** React 19 and TypeScript (Create React App), Tailwind CSS, Framer Motion and GSAP for animation
- **Backend:** Express on Bun, MongoDB through Mongoose, Nodemailer for contact notifications
- **Hosting:** Heroku (heroku-26 stack, Bun buildpack) behind Cloudflare

## Features

- Route-level code splitting, with a first-visit loader that waits for the first route and web fonts
- Light and dark themes that follow the system setting; the toggle overrides it and toggling back returns to the system setting
- Server-rendered route metadata (title, description, canonical, Open Graph, Twitter Card) for link previews
- Contact form with Cloudflare Turnstile, a honeypot field, per-IP rate limiting, and a cooldown
- Images converted to WebP at build time with Bun's native image pipeline
- Respects `prefers-reduced-motion` across page and scroll animations

## Project layout

```
backend/    Express server: /api/contact, SEO rendering, static file cache headers
frontend/   React app (pages in src/components/pages)
scripts/    deploy.sh and the WebP image optimizer
plans/      Write-ups of past performance and caching changes
```

## Local development

Requires Bun `1.4.0` (pinned in `.bun-version`).

```
bun run install:all
bun run dev
```

The backend runs on port 3001 and the React dev server on port 3000. Copy `.env.example` to `backend/.env` and fill in the values before starting the backend.

### Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | backend | MongoDB connection string |
| `CLIENT_URL` | backend | Allowed CORS origin, `https://tanmaynargas.com` in production |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | backend | Gmail account that sends contact notifications |
| `TURNSTILE_SECRET_KEY` | backend | Cloudflare Turnstile server-side verification |
| `REACT_APP_TURNSTILE_SITE_KEY` | frontend (build time) | Turnstile widget site key |
| `PORT`, `NODE_ENV` | backend | Set by Heroku in production |

## Tests

```
cd backend && bun test
bun run test:images
cd frontend && CI=true bun run test --watchAll=false
```

## Deployment

Deploys run from the `heroku-deploy` branch with a single command:

```
bun run deploy
```

`scripts/deploy.sh` checks the Cloudflare API token, confirms the branch and a clean tree, optimizes images, runs all three test suites, pushes `heroku-deploy` to Heroku `main`, purges the Cloudflare cache, and smoke-checks the live site. Cloudflare credentials (`CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`) live in a gitignored `.env.deploy`.

Do not push to Heroku by hand. Cloudflare holds HTML at the edge for 7 days, so a push without the purge serves old HTML that points at deleted JavaScript chunks and renders a blank page.

### Caching

- Hashed JavaScript and CSS, and versioned Open Graph images (`og-v2.jpg`): one year, `immutable`
- Images and fonts: one day in the browser, 30 days at the edge, stale-while-revalidate for 7 days
- HTML: browsers always revalidate; Cloudflare caches it for 7 days until the deploy purge

HTTP/3 terminates at Cloudflare, which connects to the Heroku origin over HTTPS. The `tanmaynargas.com` records must be proxied, with SSL/TLS mode set to Full (strict).

### Image optimization

`bun run optimize-images` converts images under `frontend/public/images` to WebP in place and removes each original only after its WebP output is verified. The Heroku build runs it before the React build, and a Husky pre-commit hook runs it on staged images. JPEG, PNG, WebP, BMP, and GIF work on Linux; HEIC, AVIF, and TIFF do not.

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

## License

MIT

## Contact

Found a bug? Open an issue, or reach me through [tanmaynargas.com/contact](https://tanmaynargas.com/contact).
