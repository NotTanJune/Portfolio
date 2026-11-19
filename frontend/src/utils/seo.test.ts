import { getSeoMetadata, normalizePathname } from './seo';

test('normalizes route paths for canonical URLs', () => {
  expect(normalizePathname('/contact/')).toBe('/contact');
  expect(normalizePathname('/projects?filter=all')).toBe('/projects');
  expect(normalizePathname('/')).toBe('/');
});

test('returns route-specific indexable metadata', () => {
  expect(getSeoMetadata('/projects')).toMatchObject({
    title: 'Projects | Tanmay Nargas',
    canonicalPath: '/projects',
    canonicalUrl: 'https://tanmaynargas.com/projects',
    robots: 'index, follow, max-image-preview:large',
  });
});

test('marks unknown client routes as non-indexable', () => {
  expect(getSeoMetadata('/missing')).toMatchObject({
    canonicalUrl: 'https://tanmaynargas.com/',
    robots: 'noindex, follow',
  });
});
