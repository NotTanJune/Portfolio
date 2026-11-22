// Refreshes the committed fallback list of repos for the repo city.
// Run with: bun run city:snapshot
//
// Only the public endpoint `users/<user>/repos` is used, so a private repo can
// never reach the snapshot. No token is read, printed or stored here.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const root = join(import.meta.dir, '..');
const { applyRules, limitRepos } = require(join(root, 'backend', 'city.js'));

function fail(message: string): never {
  console.error(`city:snapshot: ${message}`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(join(root, 'backend', 'city', 'config.json'), 'utf8'));

let result;
try {
  result = Bun.spawnSync(
    ['gh', 'api', `users/${config.user}/repos?per_page=100&type=owner`, '--paginate', '--slurp'],
    { stdout: 'pipe', stderr: 'pipe' },
  );
} catch (err) {
  fail('the gh CLI is not installed or not on PATH. Install it and run `gh auth login`.');
}

if (result.exitCode !== 0) {
  fail('gh api failed (is gh authenticated? try `gh auth status`). Nothing was written.');
}

let pages: unknown;
try {
  pages = JSON.parse(result.stdout.toString());
} catch (err) {
  fail('gh returned output that is not JSON. Nothing was written.');
}

// --slurp wraps every page in one outer array: [[repo, ...], [repo, ...]].
// Flatten it, and also accept a plain array of repos.
const apiRepos: unknown[] = [];
(Array.isArray(pages) ? pages : []).forEach((item) => {
  if (Array.isArray(item)) item.forEach((repo) => apiRepos.push(repo));
  else apiRepos.push(item);
});

if (apiRepos.length === 0) fail('gh returned no repos. Nothing was written.');

const snapshot = {
  generatedAt: new Date().toISOString(),
  repos: limitRepos(applyRules(apiRepos, config), config),
};

const json = JSON.stringify(snapshot, null, 2) + '\n';
const targets = [
  join(root, 'backend', 'city', 'snapshot.json'),
  join(root, 'frontend', 'src', 'city', 'snapshot.json'),
];
targets.forEach((target) => {
  if (!existsSync(dirname(target))) mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, json);
});

console.log(`city:snapshot: wrote ${snapshot.repos.length} repos to ${targets.length} files`);
