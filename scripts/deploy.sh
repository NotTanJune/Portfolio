#!/usr/bin/env bash
# Single deploy path: push to Heroku, then purge the Cloudflare cache.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

die() { echo "ERROR: $*" >&2; exit 1; }
step() { echo "==> $*"; }
deployable_changes() { git status --porcelain -- frontend backend scripts package.json bun.lock; }
require_clean() {
  local changes
  changes=$(deployable_changes)
  if [[ -n "$changes" ]]; then
    echo "$changes" >&2
    die "$1 Nothing was pushed."
  fi
}

step "Loading .env.deploy (if present)"
if [[ -f .env.deploy ]]; then
  set -a
  source .env.deploy
  set +a
fi

step "Checking Cloudflare credentials"
if [[ -z "${CLOUDFLARE_ZONE_ID:-}" || -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  die "CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN must be set. Nothing was pushed. Create .env.deploy in the repo root with those two variable names (it is gitignored), or export them in your shell."
fi
export CLOUDFLARE_ZONE_ID CLOUDFLARE_API_TOKEN

step "Verifying Cloudflare API token"
verify=$(curl -fsS https://api.cloudflare.com/client/v4/user/tokens/verify \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN") \
  || die "Cloudflare token verify request failed. Nothing was pushed."
grep -Eq '"status": *"active"' <<<"$verify" || die "Cloudflare token is not active. Nothing was pushed."

step "Checking branch"
branch=$(git rev-parse --abbrev-ref HEAD)
[[ "$branch" == "heroku-deploy" ]] || die "On branch '$branch', expected 'heroku-deploy'. Nothing was pushed."

step "Checking deployable paths are clean"
require_clean "Uncommitted or untracked changes in deployable paths (listed above): commit or stash these first."

step "Optimizing images"
bun run optimize-images
require_clean "Images were optimized; review and commit them, then re-run."

step "Running tests"
(cd backend && bun test) || die "Backend tests failed. Nothing was pushed."
bun run test:images || die "Image optimizer tests failed. Nothing was pushed."
(cd frontend && CI=true bun run test --watchAll=false) || die "Frontend tests failed. Nothing was pushed."

step "Pushing heroku-deploy to Heroku main"
git push heroku heroku-deploy:main || die "git push failed. The push did NOT happen, and no cache purge was run."

# Purge only after the push: purging earlier lets the edge re-cache the old HTML.
step "Purging Cloudflare cache"
if ! purge=$(bun run purge-cdn 2>&1) || ! grep -Eq '"success": *true' <<<"$purge"; then
  echo "!!! PURGE FAILED. The deploy IS live on Heroku, but the Cloudflare cache was NOT purged." >&2
  echo "!!! The site may render blank (cached HTML references deleted JS chunks)." >&2
  echo "!!! Run 'bun run purge-cdn' now." >&2
  exit 1
fi

step "Smoke check (waiting 5s)"
sleep 5
smoke_fail() { echo "WARNING: smoke check failed: $*. The push succeeded and the cache was purged; investigate the live site." >&2; exit 1; }
html=$(curl -fsS -H "Cache-Control: no-cache" https://tanmaynargas.com/) || smoke_fail "could not fetch homepage"
main_path=$(grep -o '/static/js/main\.[A-Za-z0-9]*\.js' <<<"$html" | head -n1 || true)
[[ -n "$main_path" ]] || smoke_fail "no main.js reference in homepage HTML"
code=$(curl -sSI -o /dev/null -w '%{http_code}' "https://tanmaynargas.com$main_path") || code=000
[[ "$code" == "200" ]] || smoke_fail "$main_path returned HTTP $code"
echo "main.js: $main_path"
echo "Deploy OK"
