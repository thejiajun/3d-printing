// Readers that turn 3MF / STL files into plain triangle meshes:
// { parts: [{ name, color, positions: Float32Array (non-indexed xyz), }], meta, thumbnail }
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

// 3MF transforms are 3x4 row-vector matrices: p' = [x y z 1] * M
function parseTransform(str) {
  if (!str) return IDENTITY;
  const n = str.trim().split(/\s+/).map(Number);
  return n.length === 12 ? n : IDENTITY;
}

// Returns a transform equivalent to applying `a` first, then `b`.
function compose(a, b) {
  const r = new Array(12);
  for (let i = 0; i < 4; i++) {
    const [x, y, z] = [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
    const w = i === 3 ? 1 : 0;
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = x * b[j] + y * b[3 + j] + z * b[6 + j] + w * b[9 + j];
    }
  }
  return r;
}

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

// Parse <object> elements of one .model XML into { id: { mesh?, components? } }.
function parseModelXml(xml) {
  const objects = {};
  for (const om of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const a = attrs(om[1]);
    const body = om[2];
    const obj = { type: a.type };
    const meshStart = body.indexOf('<mesh');
    if (meshStart !== -1) {
      const verts = [];
      for (const vm of body.matchAll(/<vertex\b([^>]*)\/>/g)) {
        const v = attrs(vm[1]);
        verts.push(+v.x, +v.y, +v.z);
      }
      const tris = [];
      for (const tm of body.matchAll(/<triangle\b([^>]*)\/>/g)) {
        const t = attrs(tm[1]);
        tris.push(+t.v1, +t.v2, +t.v3);
      }
      obj.mesh = { verts, tris };
    }
    const comps = [...body.matchAll(/<component\b([^>]*)\/>/g)].map((cm) => {
      const c = attrs(cm[1]);
      return { objectid: c.objectid, path: c['p:path'], transform: parseTransform(c.transform) };
    });
    if (comps.length) obj.components = comps;
    objects[a.id] = obj;
  }
  return objects;
}

function metadataOf(xml) {
  const meta = {};
  for (const m of xml.matchAll(/<metadata name="([^"]+)">([\s\S]*?)<\/metadata>/g)) {
    meta[m[1]] ??= decodeEntities(decodeEntities(m[2])).trim();
  }
  return meta;
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

// Bambu stores per-object / per-part filament slot in model_settings.config.
function extruderMap(configXml) {
  const map = { objects: {}, parts: {} };
  if (!configXml) return map;
  for (const om of configXml.matchAll(/<object id="(\d+)">([\s\S]*?)<\/object>/g)) {
    const [, id, body] = om;
    const head = body.split('<part')[0];
    const ex = head.match(/key="extruder" value="(\d+)"/);
    if (ex) map.objects[id] = +ex[1];
    for (const pm of body.matchAll(/<part id="(\d+)"[^>]*>([\s\S]*?)<\/part>/g)) {
      const pex = pm[2].match(/key="extruder" value="(\d+)"/);
      if (pex) map.parts[`${id}/${pm[1]}`] = +pex[1];
    }
  }
  return map;
}

export function read3mf(file) {
  const zip = unzipSync(readFileSync(file));
  const text = (p) => (zip[p.replace(/^\//, '')] ? strFromU8(zip[p.replace(/^\//, '')]) : null);

  const rootXml = text('3D/3dmodel.model');
  if (!rootXml) throw new Error('missing 3D/3dmodel.model');
  // Some exporters append design metadata after <build>, so scan the whole root file.
  const meta = metadataOf(rootXml);

  const modelCache = { '/3D/3dmodel.model': parseModelXml(rootXml) };
  const modelAt = (path) => (modelCache[path] ??= parseModelXml(text(path) ?? ''));

  let colors = [];
  try {
    colors = JSON.parse(text('Metadata/project_settings.config') ?? '{}').filament_colour ?? [];
  } catch { /* non-Bambu 3MF */ }
  const extruders = extruderMap(text('Metadata/model_settings.config'));
  const colorOf = (slot) => colors[(slot ?? 1) - 1] ?? null;

  const parts = [];
  const emit = (obj, transform, name, color) => {
    const { verts, tris } = obj.mesh;
    const positions = new Float32Array(tris.length * 3);
    const t = transform;
    for (let i = 0; i < tris.length; i++) {
      const k = tris[i] * 3;
      const [x, y, z] = [verts[k], verts[k + 1], verts[k + 2]];
      positions[i * 3] = x * t[0] + y * t[3] + z * t[6] + t[9];
      positions[i * 3 + 1] = x * t[1] + y * t[4] + z * t[7] + t[10];
      positions[i * 3 + 2] = x * t[2] + y * t[5] + z * t[8] + t[11];
    }
    parts.push({ name, color, positions });
  };

  // Walk build items -> components -> meshes, accumulating transforms.
  const walk = (path, id, transform, topId, color, depth = 0) => {
    const obj = modelAt(path)[id];
    if (!obj || depth > 8 || obj.type === 'support' || obj.type === 'other') return;
    if (obj.mesh?.tris.length) emit(obj, transform, `${topId}`, color);
    for (const c of obj.components ?? []) {
      const partColor = colorOf(extruders.parts[`${topId}/${c.objectid}`]) ?? color;
      walk(c.path ?? path, c.objectid, compose(c.transform, transform), topId, partColor, depth + 1);
    }
  };

  const rootModel = modelCache['/3D/3dmodel.model'];
  const build = rootXml.split('<build')[1] ?? '';
  for (const im of build.matchAll(/<item\b([^>]*)\/>/g)) {
    const a = attrs(im[1]);
    if (a.printable === '0') continue;
    walk('/3D/3dmodel.model', a.objectid, parseTransform(a.transform), a.objectid,
      colorOf(extruders.objects[a.objectid]));
  }
  // Plain 3MFs without a build section: render every top-level object.
  if (!parts.length) {
    for (const id of Object.keys(rootModel)) walk('/3D/3dmodel.model', id, IDENTITY, id, colorOf(1));
  }

  const thumbPath = ['Metadata/plate_1.png', 'Auxiliaries/.thumbnails/thumbnail_middle.png',
    'Metadata/thumbnail.png'].find((p) => zip[p]);
  return { parts, meta, thumbnail: thumbPath ? zip[thumbPath] : null };
}

export function readStl(file) {
  const buf = readFileSync(file);
  const count = buf.length >= 84 ? buf.readUInt32LE(80) : 0;
  const isBinary = buf.length === 84 + count * 50;
  let positions;
  if (isBinary) {
    positions = new Float32Array(count * 9);
    for (let i = 0; i < count; i++) {
      const o = 84 + i * 50 + 12; // skip normal
      for (let j = 0; j < 9; j++) positions[i * 9 + j] = buf.readFloatLE(o + j * 4);
    }
  } else {
    const nums = [...buf.toString('utf8').matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)]
      .flatMap((m) => [+m[1], +m[2], +m[3]]);
    positions = new Float32Array(nums);
  }
  return { parts: [{ name: 'mesh', color: null, positions }], meta: {}, thumbnail: null };
}

export function readMesh(file) {
  if (/\.3mf$/i.test(file)) return read3mf(file);
  if (/\.stl$/i.test(file)) return readStl(file);
  throw new Error(`unsupported: ${file}`);
}
