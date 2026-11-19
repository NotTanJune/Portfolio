const path = require('path');

const routePages = require(path.join(__dirname, '../frontend/src/seo-pages.json'));

const SITE_URL = 'https://tanmaynargas.com';
const CANONICAL_HOST = 'tanmaynargas.com';
// Versioned filename: crawlers cache images by URL, so bump it whenever the image changes.
const OPEN_GRAPH_IMAGE_URL = `${SITE_URL}/og/og-v2.jpg`;

function normalizePathname(pathname) {
  const pathOnly = String(pathname || '/').split(/[?#]/, 1)[0] || '/';
  const trimmed = pathOnly.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '/';
}

function isKnownRoute(pathname) {
  return Object.prototype.hasOwnProperty.call(routePages, normalizePathname(pathname));
}

function getSeoMetadata(pathname) {
  const normalizedPath = normalizePathname(pathname);
  const page = routePages[normalizedPath] || routePages['/'];
  const isKnownRoute = Boolean(routePages[normalizedPath]);
  const canonicalPath = isKnownRoute ? normalizedPath : '/';

  return {
    ...page,
    canonicalPath,
    canonicalUrl: `${SITE_URL}${canonicalPath}`,
    robots: isKnownRoute ? 'index, follow, max-image-preview:large' : 'noindex, follow',
    openGraphImageUrl: OPEN_GRAPH_IMAGE_URL,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function upsertTag(html, pattern, replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return html.replace(/<\/head>/i, `${replacement}\n</head>`);
}

function metaPattern(attribute, key) {
  return new RegExp(
    `<meta\\b(?=[^>]*\\b${escapeRegExp(attribute)}\\s*=\\s*["']${escapeRegExp(key)}["'])[^>]*>`,
    'i'
  );
}

function upsertMeta(html, attribute, key, content) {
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}" />`;
  return upsertTag(html, metaPattern(attribute, key), tag);
}

function renderRouteMetadata(htmlTemplate, pathname) {
  const metadata = getSeoMetadata(pathname);
  let html = upsertTag(
    htmlTemplate,
    /<title\b[^>]*>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(metadata.title)}</title>`
  );

  [
    ['name', 'description', metadata.description],
    ['name', 'robots', metadata.robots],
    ['property', 'og:title', metadata.title],
    ['property', 'og:description', metadata.description],
    ['property', 'og:image', metadata.openGraphImageUrl],
    ['property', 'og:url', metadata.canonicalUrl],
    ['property', 'og:type', 'website'],
    ['name', 'twitter:title', metadata.title],
    ['name', 'twitter:description', metadata.description],
    ['name', 'twitter:image', metadata.openGraphImageUrl],
    ['name', 'twitter:card', 'summary_large_image'],
  ].forEach(([attribute, key, content]) => {
    html = upsertMeta(html, attribute, key, content);
  });

  html = upsertTag(
    html,
    /<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}" />`
  );

  return html;
}

function firstHeaderValue(value) {
  return String(value || '').split(',')[0].trim().toLowerCase();
}

function getRequestProtocol(request) {
  const forwardedProtocol = typeof request.get === 'function'
    ? request.get('x-forwarded-proto')
    : request.headers && request.headers['x-forwarded-proto'];

  return firstHeaderValue(forwardedProtocol || request.protocol);
}

function getRequestHostname(request) {
  if (request.hostname) return request.hostname.toLowerCase().replace(/\.$/, '');

  const hostHeader = typeof request.get === 'function'
    ? request.get('host')
    : request.headers && request.headers.host;

  return String(hostHeader || '').split(':')[0].toLowerCase().replace(/\.$/, '');
}

function getCanonicalRedirect(request) {
  const protocol = getRequestProtocol(request);
  const hostname = getRequestHostname(request);

  if (protocol === 'https' && hostname === CANONICAL_HOST) {
    return null;
  }

  const originalUrl = request.originalUrl || request.url || '/';
  const pathAndQuery = originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`;
  return `${SITE_URL}${pathAndQuery}`;
}

module.exports = {
  getCanonicalRedirect,
  getSeoMetadata,
  isKnownRoute,
  normalizePathname,
  renderRouteMetadata,
};
