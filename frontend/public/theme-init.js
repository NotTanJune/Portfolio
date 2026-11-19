// Applies the stored colour-scheme override before first paint, so dark-mode
// visitors never see a light flash. Loaded as a classic blocking script from
// <head>; kept external because the CSP disallows inline scripts.
// Must stay in step with src/utils/colorScheme.ts.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('color-scheme');
    // The old 'theme' key pinned whatever scheme the OS had on the first visit.
    localStorage.removeItem('theme');
  } catch (e) {}
  if (stored !== 'light' && stored !== 'dark') stored = null;

  var meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.content = stored || 'light dark';

  var dark = stored
    ? stored === 'dark'
    : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
