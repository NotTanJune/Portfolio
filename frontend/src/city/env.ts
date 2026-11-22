import { StyleKey } from './types';

/** True when the visitor asked the system for less motion. Guarded: jsdom has no `matchMedia`. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True on phones and tablets (no hover). Guarded: jsdom has no `matchMedia`. */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: none)').matches;
}

/**
 * The style that matches the site's theme. The theme is read from `<html data-theme>`, not from
 * `ThemeContext`, so the city has no dependency on `App`.
 */
export function currentStyle(): StyleKey {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'night' : 'maquette';
}

/** Calls `onChange` whenever `<html data-theme>` changes. Returns the function that stops watching. */
export function observeTheme(onChange: () => void): () => void {
  if (typeof MutationObserver !== 'function') return () => undefined;
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => mo.disconnect();
}
