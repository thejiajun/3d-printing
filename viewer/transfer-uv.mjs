// Transfer UV coordinates from OBJ to GLB via triangle centroid matching
// Usage: node transfer-uv.mjs --obj <path> --glb <path|dir> [--out <dir>] [--texture <path>]
import fs from 'fs';
import path from 'path';

// === CLI argument parsing (no external deps) ===
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[++i];
    }
  }
  return args;
}

const args = parseArgs(process.argv);
if (!args.obj || !args.glb) {
  console.error('Usage: node transfer-uv.mjs --obj <path> --glb <path|dir> [--out <dir>] [--texture <path>]');
  process.exit(1);
}

const objPath = path.resolve(args.obj);
const glbInput = path.resolve(args.glb);
const texturePath = args.texture ? path.resolve(args.texture) : null;

// Determine GLB file list
let glbFiles;
const glbStat = fs.statSync(glbInput);
if (glbStat.isDirectory()) {
  glbFiles = fs.readdirSync(glbInput)
    .filter(f => f.endsWith('.glb'))
    .map(f => path.join(glbInput, f));
} else {
  glbFiles = [glbInput];
}

if (glbFiles.length === 0) {
  console.error('No .glb files found at:', glbInput);
  process.exit(1);
}

// Output directory: --out flag, or same directory as GLB input
const outDir = args.out ? path.resolve(args.out) : (glbStat.isDirectory() ? glbInput : path.dirname(glbInput));
fs.mkdirSync(outDir, { recursive: true });

console.log(`OBJ:     ${objPath}`);
console.log(`GLB(s):  ${glbFiles.length} file(s)`);
console.log(`Output:  ${outDir}`);
if (texturePath) console.log(`Texture: ${texturePath}`);

// === Parse OBJ ===
console.log('\nParsing OBJ...');
const objText = fs.readFileSync(objPath, 'utf-8');
const objPositions = []; // [x,y,z]
const objUVs = [];       // [u,v]
const objFaces = [];     // [{verts: [vi0,vi1,vi2], uvs: [ti0,ti1,ti2]}]

const lines = objText.split('\n');
for (const line of lines) {
  const parts = line.trim().split(/\s+/);
  if (parts[0] === 'v' && parts.length >= 4) {
    objPositions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
  } else if (parts[0] === 'vt' && parts.length >= 3) {
    objUVs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
  } else if (parts[0] === 'f') {
    const faceVerts = [];
    const faceUVs = [];
    for (let i = 1; i < parts.length; i++) {
      const indices = parts[i].split('/');
      faceVerts.push(parseInt(indices[0]) - 1);
      faceUVs.push(parseInt(indices[1]) - 1);
    }
    // Triangulate quads
    for (let i = 1; i < faceVerts.length - 1; i++) {
      objFaces.push({
        verts: [faceVerts[0], faceVerts[i], faceVerts[i+1]],
        uvs: [faceUVs[0], faceUVs[i], faceUVs[i+1]]
      });
    }
  }
}
console.log(`OBJ: ${objPositions.length} positions, ${objUVs.length} UVs, ${objFaces.length} triangles`);

// === Compute OBJ bounding box ===
let objMin = [Infinity, Infinity, Infinity];
let objMax = [-Infinity, -Infinity, -Infinity];
for (const p of objPositions) {
  for (let i = 0; i < 3; i++) {
    if (p[i] < objMin[i]) objMin[i] = p[i];
    if (p[i] > objMax[i]) objMax[i] = p[i];
  }
}
const objHeight = objMax[1] - objMin[1];
const objCenterY = (objMin[1] + objMax[1]) / 2;
console.log(`OBJ bounds: Y=[${objMin[1].toFixed(4)}, ${objMax[1].toFixed(4)}], height=${objHeight.toFixed(4)}, centerY=${objCenterY.toFixed(4)}`);

// === Helper: parse GLB positions and indices ===
function parseGLB(filePath) {
  const buf = Buffer.from(fs.readFileSync(filePath));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
  const binChunkStart = 20 + jsonLen;
  const binData = buf.slice(binChunkStart + 8);

  const prim = json.meshes[0].primitives[0];

  // Read positions
  const posAcc = json.accessors[prim.attributes.POSITION];
  const posBV = json.bufferViews[posAcc.bufferView];
  const posOff = (posBV.byteOffset || 0) + (posAcc.byteOffset || 0);
  const positions = new Float32Array(binData.buffer, binData.byteOffset + posOff, posAcc.count * 3);

  // Read index buffer
  const idxAcc = json.accessors[prim.indices];
  const idxBV = json.bufferViews[idxAcc.bufferView];
  const idxOff = (idxBV.byteOffset || 0) + (idxAcc.byteOffset || 0);
  let indices;
  if (idxAcc.componentType === 5123) { // UNSIGNED_SHORT
    indices = new Uint16Array(binData.buffer, binData.byteOffset + idxOff, idxAcc.count);
  } else { // UNSIGNED_INT
    indices = new Uint32Array(binData.buffer, binData.byteOffset + idxOff, idxAcc.count);
  }

  return { positions, indices, vertexCount: posAcc.count, triCount: indices.length / 3 };
}

// === Compute GLB bounding box from first file (all share same mesh) ===
console.log('\nComputing GLB bounding box...');
const firstGLB = parseGLB(glbFiles[0]);
let glbMin = [Infinity, Infinity, Infinity];
let glbMax = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < firstGLB.positions.length; i += 3) {
  for (let j = 0; j < 3; j++) {
    const v = firstGLB.positions[i + j];
    if (v < glbMin[j]) glbMin[j] = v;
    if (v > glbMax[j]) glbMax[j] = v;
  }
}
const glbHeight = glbMax[1] - glbMin[1];
const glbCenterY = (glbMin[1] + glbMax[1]) / 2;
console.log(`GLB bounds: Y=[${glbMin[1].toFixed(4)}, ${glbMax[1].toFixed(4)}], height=${glbHeight.toFixed(4)}, centerY=${glbCenterY.toFixed(4)}`);

// === Auto coordinate alignment ===
const SCALE = objHeight / glbHeight;
const Y_OFFSET = objCenterY - glbCenterY * SCALE;
console.log(`\nAuto alignment: scale=${SCALE.toFixed(6)}, Y_offset=${Y_OFFSET.toFixed(6)}`);

function glbToObjSpace(x, y, z) {
  return [x * SCALE, y * SCALE + Y_OFFSET, z * SCALE];
}

// === Precompute OBJ triangle centroids and build spatial hash ===
const CELL_SIZE = 0.02;
const centroidHash = new Map();

function centroidKey(cx, cy, cz) {
  return `${Math.floor(cx / CELL_SIZE)},${Math.floor(cy / CELL_SIZE)},${Math.floor(cz / CELL_SIZE)}`;
}

const objCentroids = []; // [cx, cy, cz] for each OBJ face
for (let f = 0; f < objFaces.length; f++) {
  const face = objFaces[f];
  const p0 = objPositions[face.verts[0]];
  const p1 = objPositions[face.verts[1]];
  const p2 = objPositions[face.verts[2]];
  const cx = (p0[0] + p1[0] + p2[0]) / 3;
  const cy = (p0[1] + p1[1] + p2[1]) / 3;
  const cz = (p0[2] + p1[2] + p2[2]) / 3;
  objCentroids.push([cx, cy, cz]);

  const key = centroidKey(cx, cy, cz);
  if (!centroidHash.has(key)) centroidHash.set(key, []);
  centroidHash.get(key).push(f);
}
console.log(`Centroid hash: ${centroidHash.size} cells`);

// Find nearest OBJ face by centroid
function findNearestOBJFace(gcx, gcy, gcz) {
  const hx = Math.floor(gcx / CELL_SIZE);
  const hy = Math.floor(gcy / CELL_SIZE);
  const hz = Math.floor(gcz / CELL_SIZE);
  let bestDist = Infinity, bestIdx = -1;

  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++)
      for (let dz = -2; dz <= 2; dz++) {
        const bucket = centroidHash.get(`${hx+dx},${hy+dy},${hz+dz}`);
        if (!bucket) continue;
        for (const fi of bucket) {
          const [ox, oy, oz] = objCentroids[fi];
          const d = (gcx-ox)**2 + (gcy-oy)**2 + (gcz-oz)**2;
          if (d < bestDist) { bestDist = d; bestIdx = fi; }
        }
      }

  return { idx: bestIdx, dist: Math.sqrt(bestDist) };
}

// Match 3 GLB vertices to 3 OBJ face vertices by position proximity
function matchVerticesInTriangle(glbPos, objFaceVerts) {
  const objPos = objFaceVerts.map(vi => objPositions[vi]);
  const pairs = [];
  for (let g = 0; g < 3; g++) {
    for (let o = 0; o < 3; o++) {
      const d = (glbPos[g][0]-objPos[o][0])**2 + (glbPos[g][1]-objPos[o][1])**2 + (glbPos[g][2]-objPos[o][2])**2;
      pairs.push({ g, o, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);

  const mapping = [-1, -1, -1];
  const usedG = [false, false, false];
  const usedO = [false, false, false];
  for (const { g, o } of pairs) {
    if (usedG[g] || usedO[o]) continue;
    mapping[g] = o;
    usedG[g] = true;
    usedO[o] = true;
  }

  return mapping;
}

// === Process all GLB files ===
const configModels = [];

// Copy texture if specified
let textureRelPath = null;
if (texturePath) {
  const texName = path.basename(texturePath);
  const texDest = path.join(outDir, texName);
  if (path.resolve(texturePath) !== path.resolve(texDest)) {
    fs.copyFileSync(texturePath, texDest);
    console.log(`\nCopied texture to: ${texDest}`);
  }
  textureRelPath = texName;
}

for (const glbPath of glbFiles) {
  const glbName = path.basename(glbPath, '.glb');
  console.log(`\nProcessing: ${glbName}`);

  const { positions, indices, vertexCount, triCount } = parseGLB(glbPath);
  console.log(`  Vertices: ${vertexCount}, Triangles: ${triCount}`);

  // Per-face-corner UVs: each triangle corner gets its own UV
  const cornerUVs = new Float32Array(triCount * 3 * 2);
  let faceMatched = 0, faceMissed = 0;

  for (let t = 0; t < triCount; t++) {
    const gi0 = indices[t * 3], gi1 = indices[t * 3 + 1], gi2 = indices[t * 3 + 2];

    // GLB vertex positions in OBJ space
    const p0 = glbToObjSpace(positions[gi0*3], positions[gi0*3+1], positions[gi0*3+2]);
    const p1 = glbToObjSpace(positions[gi1*3], positions[gi1*3+1], positions[gi1*3+2]);
    const p2 = glbToObjSpace(positions[gi2*3], positions[gi2*3+1], positions[gi2*3+2]);

    const cx = (p0[0] + p1[0] + p2[0]) / 3;
    const cy = (p0[1] + p1[1] + p2[1]) / 3;
    const cz = (p0[2] + p1[2] + p2[2]) / 3;

    const { idx: objFaceIdx } = findNearestOBJFace(cx, cy, cz);

    if (objFaceIdx < 0) { faceMissed++; continue; }

    const face = objFaces[objFaceIdx];
    const glbPos = [p0, p1, p2];
    const mapping = matchVerticesInTriangle(glbPos, face.verts);

    for (let j = 0; j < 3; j++) {
      const faceVertIdx = mapping[j];
      if (faceVertIdx >= 0) {
        const uvIdx = face.uvs[faceVertIdx];
        const uv = objUVs[uvIdx];
        cornerUVs[(t * 3 + j) * 2] = uv[0];
        cornerUVs[(t * 3 + j) * 2 + 1] = 1.0 - uv[1]; // Flip V for glTF
      }
    }
    faceMatched++;
  }

  console.log(`  Faces matched: ${faceMatched}/${triCount}, missed: ${faceMissed}`);

  // Write UV binary
  const binName = `${glbName}_uvfix.bin`;
  const binPath = path.join(outDir, binName);
  fs.writeFileSync(binPath, Buffer.from(cornerUVs.buffer));
  console.log(`  Saved: ${binPath} (${(cornerUVs.byteLength/1024/1024).toFixed(1)} MB)`);

  // Relative paths for config (relative to CWD / project root)
  const projectRoot = process.cwd();
  const modelEntry = {
    name: glbName.replace(/_/g, ' ').replace(/withSkin$/i, '').replace(/Meshy AI Animation /i, '').trim(),
    type: 'glb',
    path: path.relative(projectRoot, glbPath),
    uvBin: path.relative(projectRoot, binPath),
  };
  configModels.push(modelEntry);
}

// === Write config.json to project root (CWD) ===
const projectRoot = process.cwd();
const config = {
  texture: textureRelPath ? path.relative(projectRoot, path.join(outDir, textureRelPath)) : null,
  models: configModels,
};

const configPath = path.join(projectRoot, 'config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log(`\nConfig written: ${configPath}`);
console.log(JSON.stringify(config, null, 2));
console.log('\nDone!');
