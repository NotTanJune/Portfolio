import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSeoMetadata } from '../utils/seo';

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
}

const SeoMetadata: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = getSeoMetadata(pathname);

    document.title = metadata.title;
    upsertMeta('name', 'description', metadata.description);
    upsertMeta('name', 'robots', metadata.robots);
    upsertMeta('property', 'og:title', metadata.title);
    upsertMeta('property', 'og:description', metadata.description);
    upsertMeta('property', 'og:url', metadata.canonicalUrl);
    upsertMeta('property', 'og:image', metadata.openGraphImageUrl);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('name', 'twitter:title', metadata.title);
    upsertMeta('name', 'twitter:description', metadata.description);
    upsertMeta('name', 'twitter:image', metadata.openGraphImageUrl);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertCanonical(metadata.canonicalUrl);
  }, [pathname]);

  return null;
};

export default SeoMetadata;
