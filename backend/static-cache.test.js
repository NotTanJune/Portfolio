const { describe, expect, test } = require('bun:test');
const { cacheControlFor } = require('./static-cache');

describe('cacheControlFor', () => {
  test('caches hashed build assets immutably', () => {
    expect(cacheControlFor('/static/js/main.cbc4eebe.js')).toBe(
      'public, max-age=31536000, immutable'
    );
  });

  test('caches versioned link-preview images immutably', () => {
    expect(cacheControlFor('/app/frontend/build/og/og-v2.jpg')).toBe(
      'public, max-age=31536000, immutable'
    );
  });

  test('does not cache an unversioned link-preview image immutably', () => {
    expect(cacheControlFor('/app/frontend/build/og/og.jpg')).not.toContain('immutable');
  });

  test('caches stable image paths with background revalidation and edge caching', () => {
    expect(cacheControlFor('/images/profile/pfp.webp')).toBe(
      'public, max-age=86400, stale-while-revalidate=604800, s-maxage=2592000'
    );
  });

  test('requires browser HTML revalidation and edge-caches HTML', () => {
    expect(cacheControlFor('/index.html')).toBe(
      'public, max-age=0, must-revalidate, s-maxage=604800'
    );
  });

  test('applies the HTML policy to the root path', () => {
    expect(cacheControlFor('/')).toBe(cacheControlFor('/index.html'));
  });
});
