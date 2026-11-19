const fs = require('fs');
const path = require('path');

const cacheDir = path.join(__dirname, '..', 'node_modules', '.cache');
const cacheFile = path.join(cacheDir, '.eslintcache');

function removeIfExists(target) {
  try {
    if (!fs.existsSync(target)) return;
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true });
    } else {
      try {
        // Try to make it writable in case of attribute issues on Windows
        fs.chmodSync(target, 0o666);
      } catch {}
      fs.unlinkSync(target);
    }
    console.log(`[clean-eslint-cache] Removed: ${target}`);
  } catch (err) {
    console.warn(`[clean-eslint-cache] Could not remove ${target}:`, err.message);
  }
}

removeIfExists(cacheFile);
// Also nuke the whole .cache dir if it only contains ESLint cache leftovers
removeIfExists(cacheDir);
