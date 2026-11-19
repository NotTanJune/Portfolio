const HASHED_BUILD_ASSET = /\/static\/.*\.[a-f0-9]{8}\.(?:js|css)(?:\.map)?$/i;
// Link-preview images carry a version in the filename (og-v2.jpg), so a new image always gets a new URL.
const VERSIONED_OG_IMAGE = /\/og\/[^/]+-v\d+\.(?:jpe?g|png)$/i;

function cacheControlFor(pathname) {
  if (HASHED_BUILD_ASSET.test(pathname) || VERSIONED_OG_IMAGE.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }

  if (pathname.includes('/images/') || pathname.includes('/fonts/')) {
    return 'public, max-age=86400, stale-while-revalidate=604800, s-maxage=2592000';
  }

  // max-age=0 keeps browsers revalidating; s-maxage lets the Cloudflare edge hold HTML for 7 days (purge on deploy).
  if (pathname.endsWith('.html') || pathname === '/') {
    return 'public, max-age=0, must-revalidate, s-maxage=604800';
  }

  return 'public, max-age=3600, stale-while-revalidate=86400';
}

function setStaticCacheHeaders(response, filePath) {
  response.setHeader('Cache-Control', cacheControlFor(filePath));
}

module.exports = { cacheControlFor, setStaticCacheHeaders };
