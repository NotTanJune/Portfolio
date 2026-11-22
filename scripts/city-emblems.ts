// Builds frontend/src/city/emblems.json from the 16 by 16 sprites in
// scripts/city/emblems-src/. Run with: bun run city:emblems
//
// Each entry maps the lower-cased file name (the repo name) to the base64 of
// the sprite's 1024 raw RGBA bytes, which is what frontend/src/city/emblems.ts
// decodes. Sprites that are not exactly 16 by 16 are skipped with a warning.
import { existsSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dir, '..');
const srcDir = join(root, 'scripts', 'city', 'emblems-src');
const outFile = join(root, 'frontend', 'src', 'city', 'emblems.json');

function fail(message: string): never {
  console.error(`city:emblems: ${message}`);
  process.exit(1);
}

function magick(args: string[]): { ok: boolean; out: Buffer } {
  let result;
  try {
    result = Bun.spawnSync(['magick', ...args], { stdout: 'pipe', stderr: 'pipe' });
  } catch (err) {
    fail('ImageMagick (`magick`) is not installed or not on PATH.');
  }
  return { ok: result.exitCode === 0, out: Buffer.from(result.stdout) };
}

if (!magick(['-version']).ok) fail('ImageMagick (`magick`) is not installed or not on PATH.');
if (!existsSync(srcDir)) fail(`${srcDir} does not exist.`);

const emblems: Record<string, string> = {};
const files = readdirSync(srcDir)
  .filter((f) => f.toLowerCase().endsWith('.png'))
  .sort();

files.forEach((file) => {
  const path = join(srcDir, file);
  const name = file.slice(0, -'.png'.length).toLowerCase();

  const size = magick(['identify', '-format', '%w %h', path]);
  if (!size.ok || size.out.toString().trim() !== '16 16') {
    console.warn(`city:emblems: skipping ${file}: expected 16 by 16, got "${size.out.toString().trim()}"`);
    return;
  }

  // Force RGBA so a sprite saved without an alpha channel still yields 1024 bytes.
  const raw = magick([path, '-alpha', 'on', '-depth', '8', 'RGBA:-']);
  if (!raw.ok || raw.out.length !== 1024) {
    console.warn(`city:emblems: skipping ${file}: could not read 1024 RGBA bytes`);
    return;
  }
  emblems[name] = raw.out.toString('base64');
});

const sorted: Record<string, string> = {};
Object.keys(emblems)
  .sort()
  .forEach((key) => {
    sorted[key] = emblems[key];
  });

writeFileSync(outFile, JSON.stringify(sorted, null, 2) + '\n');
console.log(`city:emblems: wrote ${Object.keys(sorted).length} emblems to ${outFile}`);
