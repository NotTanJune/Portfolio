const { describe, expect, test } = require('bun:test');
const {
  getCanonicalRedirect,
  getSeoMetadata,
  isKnownRoute,
  renderRouteMetadata,
} = require('./seo');

function request({ protocol, hostname, forwardedProtocol, originalUrl }) {
  return {
    protocol,
    hostname,
    originalUrl,
    get(header) {
      if (header === 'x-forwarded-proto') return forwardedProtocol;
      return undefined;
    },
  };
}

describe('route SEO metadata', () => {
  test('normalizes and describes a known route', () => {
    expect(getSeoMetadata('/contact/')).toMatchObject({
      title: 'Contact | Tanmay Nargas',
      canonicalPath: '/contact',
      canonicalUrl: 'https://tanmaynargas.com/contact',
      robots: 'index, follow, max-image-preview:large',
    });
  });

  test('renders one route-specific head for a fallback document', () => {
    const template = `<!doctype html><html><head>
      <title>Home</title>
      <meta name="description" content="Home">
      <meta name="robots" content="index, follow">
      <meta property="og:title" content="Home">
      <meta property="og:description" content="Home">
      <meta property="og:image" content="https://tanmaynargas.com/old.webp">
      <meta property="og:url" content="https://tanmaynargas.com/">
      <meta property="og:type" content="website">
      <meta name="twitter:title" content="Home">
      <meta name="twitter:description" content="Home">
      <meta name="twitter:image" content="https://tanmaynargas.com/old.webp">
      <meta name="twitter:card" content="summary_large_image">
      <link rel="canonical" href="https://tanmaynargas.com/">
    </head><body></body></html>`;

    const rendered = renderRouteMetadata(template, '/projects');

    expect(rendered).toContain('<title>Projects | Tanmay Nargas</title>');
    expect(rendered).toContain('href="https://tanmaynargas.com/projects"');
    expect(rendered).toContain('content="index, follow, max-image-preview:large"');
    expect(rendered).toContain('<meta property="og:image" content="https://tanmaynargas.com/og/og-v2.jpg" />');
    expect(rendered).toContain('<meta name="twitter:image" content="https://tanmaynargas.com/og/og-v2.jpg" />');
    expect(rendered).not.toContain('old.webp');
    expect((rendered.match(/rel="canonical"/g) || []).length).toBe(1);
    expect((rendered.match(/name="description"/g) || []).length).toBe(1);
  });
});

describe('isKnownRoute', () => {
  test('recognizes app routes, with or without a trailing slash', () => {
    expect(isKnownRoute('/')).toBe(true);
    expect(isKnownRoute('/projects/')).toBe(true);
  });

  test('rejects unknown paths and prototype keys', () => {
    expect(isKnownRoute('/does-not-exist')).toBe(false);
    expect(isKnownRoute('/constructor')).toBe(false);
  });
});

describe('canonical host redirects', () => {
  test('redirects HTTP requests to HTTPS on the canonical host', () => {
    expect(getCanonicalRedirect(request({
      protocol: 'http',
      hostname: 'tanmaynargas.com',
      forwardedProtocol: 'http',
      originalUrl: '/?ref=old',
    }))).toBe('https://tanmaynargas.com/?ref=old');
  });

  test('redirects the www host to the canonical host', () => {
    expect(getCanonicalRedirect(request({
      protocol: 'https',
      hostname: 'www.tanmaynargas.com',
      forwardedProtocol: 'https',
      originalUrl: '/contact',
    }))).toBe('https://tanmaynargas.com/contact');
  });

  test('does not redirect an already canonical HTTPS request', () => {
    expect(getCanonicalRedirect(request({
      protocol: 'https',
      hostname: 'tanmaynargas.com',
      forwardedProtocol: 'https',
      originalUrl: '/projects',
    }))).toBeNull();
  });
});
