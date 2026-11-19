import routePages from '../seo-pages.json';

export const SITE_URL = 'https://tanmaynargas.com';
// Versioned filename: crawlers cache images by URL, so bump it whenever the image changes.
export const OPEN_GRAPH_IMAGE_URL = `${SITE_URL}/og/og-v2.jpg`;

type SeoPage = {
  title: string;
  description: string;
};

type SeoPageTable = Record<string, SeoPage>;

const pages = routePages as SeoPageTable;

export type SeoMetadata = SeoPage & {
  canonicalPath: string;
  canonicalUrl: string;
  robots: string;
  openGraphImageUrl: string;
};

export function normalizePathname(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || '/';
  const trimmed = pathOnly.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '/';
}

export function getSeoMetadata(pathname: string): SeoMetadata {
  const normalizedPath = normalizePathname(pathname);
  const page = pages[normalizedPath] ?? pages['/'];
  const isKnownRoute = Boolean(pages[normalizedPath]);
  const canonicalPath = isKnownRoute ? normalizedPath : '/';

  return {
    ...page,
    canonicalPath,
    canonicalUrl: `${SITE_URL}${canonicalPath}`,
    robots: isKnownRoute ? 'index, follow, max-image-preview:large' : 'noindex, follow',
    openGraphImageUrl: OPEN_GRAPH_IMAGE_URL,
  };
}
