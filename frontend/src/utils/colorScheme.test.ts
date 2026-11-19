import { COLOR_SCHEME_KEY, applyColorScheme, nextOverride, readOverride, writeOverride } from './colorScheme';

describe('nextOverride', () => {
  it('stores the opposite of the system scheme', () => {
    expect(nextOverride('light', 'light')).toBe('dark');
    expect(nextOverride('dark', 'dark')).toBe('light');
  });

  it('clears the override when toggling back to the system scheme', () => {
    expect(nextOverride('dark', 'light')).toBeNull();
    expect(nextOverride('light', 'dark')).toBeNull();
  });
});

describe('override storage', () => {
  afterEach(() => localStorage.clear());

  it('round-trips a stored override and ignores junk values', () => {
    writeOverride('dark');
    expect(readOverride()).toBe('dark');
    writeOverride(null);
    expect(localStorage.getItem(COLOR_SCHEME_KEY)).toBeNull();
    localStorage.setItem(COLOR_SCHEME_KEY, 'sepia');
    expect(readOverride()).toBeNull();
  });
});

describe('applyColorScheme', () => {
  it('sets data-theme and the color-scheme meta', () => {
    const meta = document.createElement('meta');
    meta.name = 'color-scheme';
    meta.content = 'light dark';
    document.head.appendChild(meta);

    applyColorScheme('dark', 'dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(meta.content).toBe('dark');

    applyColorScheme('light', null);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(meta.content).toBe('light dark');

    meta.remove();
  });
});
