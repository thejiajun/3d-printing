// Push data/ to the R2 bucket. Assets are content-addressed, so only new files are uploaded;
// catalog.json is always re-uploaded. Auth comes from the wrangler profile bound to this repo.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const BUCKET = 'print-library';
const MANIFEST = join(DATA, '.uploaded.json');
const TYPES = { glb: 'model/gltf-binary', png: 'image/png', json: 'application/json', '3mf': 'model/3mf', stl: 'model/stl' };

const uploaded = new Set(existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : []);
const put = (key, file, downloadName) => {
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file,
    '--content-type', TYPES[key.split('.').pop()] ?? 'application/octet-stream', '--remote',
    ...(downloadName ? ['--content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`] : [])],
  { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
};

// Only files referenced by the catalog; the per-file .json caches stay local.
const catalog = JSON.parse(readFileSync(join(DATA, 'catalog.json'), 'utf8'));
const names = new Map(catalog.projects.flatMap((p) => p.versions.filter((v) => v.file).map((v) => [v.file, v.fileName])));
const keys = new Set(catalog.projects.flatMap((p) => [p.cover, ...p.versions.flatMap((v) => [v.glb, v.cover, v.file])])
  .filter((k) => /^(assets|files)\//.test(k ?? '')));
const todo = [...keys].filter((k) => !uploaded.has(k) && existsSync(join(DATA, k)));

console.log(`${todo.length} new assets (${keys.size - todo.length} already uploaded)`);
for (const [i, key] of todo.entries()) {
  put(key, join(DATA, key), names.get(key));
  uploaded.add(key);
  writeFileSync(MANIFEST, JSON.stringify([...uploaded]));
  process.stdout.write(`\r${i + 1}/${todo.length}`);
}
// Owner-only backup: mirror every file under ../models (sources included), skipping unchanged ones.
const REPO = resolve(ROOT, '..');
const BACKUP_MANIFEST = join(DATA, '.backup.json');
const backedUp = existsSync(BACKUP_MANIFEST) ? JSON.parse(readFileSync(BACKUP_MANIFEST, 'utf8')) : {};
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.name.startsWith('.') ? [] : d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
const changed = walk(join(REPO, 'models')).map((f) => [relative(REPO, f), f])
  .filter(([rel, f]) => backedUp[rel] !== createHash('sha1').update(readFileSync(f)).digest('hex'));
console.log(`\n${changed.length} files to back up`);
for (const [i, [rel, f]] of changed.entries()) {
  put(`private/backup/${rel}`, f, basename(f));
  backedUp[rel] = createHash('sha1').update(readFileSync(f)).digest('hex');
  writeFileSync(BACKUP_MANIFEST, JSON.stringify(backedUp, null, 2));
  process.stdout.write(`\r${i + 1}/${changed.length}`);
}

put('catalog.json', join(DATA, 'catalog.json'));
console.log('\ncatalog.json uploaded');
