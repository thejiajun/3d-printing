// Scan ../models, convert every printable mesh to GLB, merge Bambu print history,
// and write data/catalog.json + data/assets/* (content-addressed, safe to re-run).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMesh } from './lib/mesh-readers.mjs';
import { partsToGlb } from './lib/to-glb.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = resolve(ROOT, '../models');
const DATA = join(ROOT, 'data');
const ASSETS = join(DATA, 'assets');
// Folders where every file is an unrelated model rather than versions of one project.
const LOOSE_FOLDERS = new Set(['downloads']);
const FILES = join(DATA, 'files');
// MakerWorld pages for downloaded designs, keyed by the DesignModelId stored in the 3MF.
const SOURCES = JSON.parse(readFileSync(join(ROOT, 'makerworld-sources.json'), 'utf8'));
// Licenses that allow re-sharing the file with attribution. MakerWorld's
// "Standard Digital File License" forbids redistribution, so those link out instead.
const REDISTRIBUTABLE = /^(CC0|BY|BY-SA|BY-NC|BY-NC-SA|BY-ND|BY-NC-ND)$/i;
const LICENSE_LABEL = { CC0: 'CC0', 'Standard Digital File License': 'Standard Digital File License' };
const licenseLabel = (l) => LICENSE_LABEL[l] ?? (l ? `CC ${l}` : null);

mkdirSync(ASSETS, { recursive: true });
mkdirSync(FILES, { recursive: true });

const sha = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 16);
const norm = (s) => (s ?? '').toLowerCase().replace(/\.(3mf|stl)$/, '').replace(/[^a-z0-9]+/g, '');
const humanize = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const versionNum = (name) => +(name.match(/v(\d+)/i)?.[1] ?? 0);

function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? walkFiles(p) : [p];
  });
}

function readmeTitle(folder) {
  const p = join(folder, 'README.md');
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8').match(/^#\s+(.+)$/m)?.[1].trim() ?? null;
}

// Pick up side-by-side preview images, e.g. foo-preview.png or renders/*.png.
function sidecarImage(file, allFiles) {
  const stem = basename(file, extname(file));
  return allFiles.find((f) => /\.(png|jpe?g|webp)$/i.test(f) && basename(f).startsWith(stem))
    ?? null;
}

async function convert(file, allFiles) {
  const raw = readFileSync(file);
  const hash = sha(raw);
  const glbKey = `assets/${hash}.glb`;
  const metaPath = join(ASSETS, `${hash}.v3.json`);
  if (existsSync(join(DATA, glbKey)) && existsSync(metaPath)) {
    return JSON.parse(readFileSync(metaPath, 'utf8'));
  }
  const mesh = readMesh(file);
  const { glb, triangles } = await partsToGlb(mesh.parts);
  writeFileSync(join(DATA, glbKey), glb);

  let cover = null;
  const image = mesh.thumbnail ?? (sidecarImage(file, allFiles) && readFileSync(sidecarImage(file, allFiles)));
  if (image) {
    cover = `assets/${hash}.png`;
    writeFileSync(join(DATA, cover), image);
  }
  const info = {
    hash,
    glb: glbKey,
    cover,
    triangles,
    colors: [...new Set(mesh.parts.map((p) => p.color).filter(Boolean))],
    title: mesh.meta.Title || null,
    designer: mesh.meta.Designer || null,
    designModelId: mesh.meta.DesignModelId || null,
    license: mesh.meta.License || null,
  };
  writeFileSync(metaPath, JSON.stringify(info));
  return info;
}

// ---- 1. Group local files into projects ------------------------------------
const groups = [];
for (const entry of readdirSync(MODELS, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const folder = join(MODELS, entry.name);
  const all = walkFiles(folder);
  const meshes = all.filter((f) => /\.(3mf|stl)$/i.test(f));
  if (LOOSE_FOLDERS.has(entry.name)) {
    for (const f of meshes) groups.push({ id: `${entry.name}-${norm(basename(f))}`, folder, all, files: [f], loose: true });
  } else if (meshes.length) {
    groups.push({ id: entry.name, folder, all, files: meshes, loose: false });
  }
}

const projects = [];
for (const g of groups) {
  // Same stem in .3mf and .stl -> keep the 3MF (it carries colors + thumbnail).
  const byStem = new Map();
  for (const f of g.files) {
    const stem = relative(g.folder, f).replace(/\.(3mf|stl)$/i, '');
    if (!byStem.has(stem) || /\.3mf$/i.test(f)) byStem.set(stem, f);
  }
  const seen = new Set();
  const versions = [];
  for (const [stem, file] of byStem) {
    const info = await convert(file, g.all);
    if (seen.has(info.hash)) continue; // identical copies, e.g. final/ vs iterations/
    seen.add(info.hash);
    const format = extname(file).slice(1).toLowerCase();
    versions.push({
      name: basename(stem),
      path: relative(resolve(ROOT, '..'), file),
      format,
      file: `files/${info.hash}.${format}`,
      // Owner-only mirror of the original, uploaded by upload-r2.mjs.
      backup: `private/backup/${relative(resolve(ROOT, '..'), file)}`,
      fileName: basename(file),
      updatedAt: statSync(file).mtime.toISOString(),
      ...info,
    });
    process.stdout.write('.');
  }
  // Newest design first: final/ folder, then highest vN, then mtime.
  versions.sort((a, b) =>
    (b.path.includes('/final/') - a.path.includes('/final/'))
    || versionNum(b.name) - versionNum(a.name)
    || b.updatedAt.localeCompare(a.updatedAt));

  const lead = versions[0];
  // Attribution comes from whichever file carries MakerWorld metadata
  // (for remixes that is the untouched source file, not the edited versions).
  const credited = versions.find((v) => v.designModelId) ?? versions.find((v) => v.designer);
  const sourceUrl = credited?.designModelId ? SOURCES[credited.designModelId] ?? null : null;
  const licenses = versions.map((v) => v.license).filter(Boolean);
  const downloadable = licenses.every((l) => REDISTRIBUTABLE.test(l));
  for (const v of versions) {
    if (downloadable) copyFileSync(join(resolve(ROOT, '..'), v.path), join(DATA, v.file));
    else v.file = null;
  }
  projects.push({
    id: g.id,
    title: (g.loose ? lead.title : readmeTitle(g.folder)) ?? lead.title ?? humanize(g.loose ? lead.name : basename(g.folder)),
    source: g.loose ? 'download' : 'original',
    designer: credited?.designer ?? null,
    license: licenseLabel(credited?.license),
    sourceUrl,
    remix: !g.loose && Boolean(credited),
    downloadable,
    cover: versions.find((v) => v.cover)?.cover ?? null,
    updatedAt: versions.map((v) => v.updatedAt).sort().at(-1),
    versions,
    prints: [],
  });
}
console.log(`\n${projects.length} projects, ${projects.reduce((n, p) => n + p.versions.length, 0)} versions`);

// ---- 2. Merge Bambu Cloud print history ------------------------------------
const tasksPath = join(DATA, 'bambu-tasks.json');
const tasks = existsSync(tasksPath) ? JSON.parse(readFileSync(tasksPath, 'utf8')) : [];

const matchProject = (t) =>
  projects.find((p) => t.modelId && p.versions.some((v) => v.designModelId === t.modelId))
  ?? projects.find((p) => [t.title, t.designTitle].some((s) => norm(s) && (
    norm(s) === norm(p.title) || p.versions.some((v) => norm(v.name) === norm(s)))));

for (const t of tasks) {
  const print = {
    id: t.id,
    title: t.title,
    startTime: t.startTime,
    endTime: t.endTime,
    status: t.status, // 2 = finished, 3 = failed/cancelled (per community API docs)
    weight: t.weight,
    costTime: t.costTime,
    cover: t.cover,
    device: t.deviceName || t.deviceModel || null,
    plate: t.plateName || (t.plateIndex ? `Plate ${t.plateIndex}` : null),
  };
  let project = matchProject(t);
  if (!project) {
    // Printed from the cloud with no local file: still list it, just without 3D.
    const id = `cloud-${t.designId || t.modelId || norm(t.designTitle || t.title)}`;
    project = projects.find((p) => p.id === id);
    if (!project) {
      project = {
        id, title: t.designTitle || t.title, source: 'cloud', designer: null,
        cover: t.cover, updatedAt: t.startTime, versions: [], prints: [],
      };
      projects.push(project);
    }
  }
  if (t.designId) project.sourceUrl ??= `https://makerworld.com/en/models/${t.designId}`;
  project.prints.push(print);
}

for (const p of projects) {
  p.prints.sort((a, b) => b.startTime.localeCompare(a.startTime));
  p.lastPrintedAt = p.prints[0]?.startTime ?? null;
  // Remote Bambu cover images expire; prefer our own stored thumbnail.
  p.cover ??= p.prints[0]?.cover ?? null;
}
projects.sort((a, b) => (b.lastPrintedAt ?? b.updatedAt).localeCompare(a.lastPrintedAt ?? a.updatedAt));

writeFileSync(join(DATA, 'catalog.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  printsSynced: tasks.length,
  projects,
}, null, 2));
console.log(`catalog.json written (${tasks.length} Bambu prints merged)`);
