// Colour scheme override, kept in step with public/theme-init.js (which applies
// the stored value before first paint).
//
// Data model: no stored value means "follow the system". A stored 'light' or
// 'dark' pins the scheme. The toggle only ever stores the opposite of the
// system preference; toggling back to the system's scheme clears the override.
export type Theme = 'light' | 'dark';

export const COLOR_SCHEME_KEY = 'color-scheme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function getSystemTheme(): Theme {
  try {
    return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function readOverride(): Theme | null {
  try {
    const value = localStorage.getItem(COLOR_SCHEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

// Returns the override to keep after a toggle: null when the target matches the system.
export function nextOverride(rendered: Theme, system: Theme): Theme | null {
  const target: Theme = rendered === 'dark' ? 'light' : 'dark';
  return target === system ? null : target;
}

export function writeOverride(override: Theme | null): void {
  try {
    if (override) localStorage.setItem(COLOR_SCHEME_KEY, override);
    else localStorage.removeItem(COLOR_SCHEME_KEY);
  } catch {
    // Storage blocked: the scheme still applies for this page view.
  }
}

// Reflects the resolved theme on <html> and the override on <meta name="color-scheme">.
export function applyColorScheme(theme: Theme, override: Theme | null): void {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) meta.content = override ?? 'light dark';
}

export function onSystemThemeChange(callback: (theme: Theme) => void): () => void {
  const mql = window.matchMedia?.(DARK_QUERY);
  if (!mql?.addEventListener) return () => {};
  const handler = (event: MediaQueryListEvent) => callback(event.matches ? 'dark' : 'light');
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
