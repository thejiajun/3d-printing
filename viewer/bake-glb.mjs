// Bake transferred UVs + texture into a self-contained GLB
// Usage: node bake-glb.mjs --glb <path> --uv <uvfix.bin> --texture <png> [--out <path>]
// Output: A single GLB with non-indexed geometry, baked UVs, embedded texture, skeleton + animation
import fs from 'fs';
import path from 'path';

// === Parse CLI args ===
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
if (!args.glb || !args.uv || !args.texture) {
  console.error('Usage: node bake-glb.mjs --glb <path> --uv <uvfix.bin> --texture <png> [--out <path>]');
  process.exit(1);
}

const glbPath = path.resolve(args.glb);
const uvPath = path.resolve(args.uv);
const texturePath = path.resolve(args.texture);
const outPath = args.out ? path.resolve(args.out) : glbPath.replace('.glb', '_baked.glb');

console.log(`GLB:     ${glbPath}`);
console.log(`UV bin:  ${uvPath}`);
console.log(`Texture: ${texturePath}`);
console.log(`Output:  ${outPath}`);

// === Read inputs ===
const glbBuf = Buffer.from(fs.readFileSync(glbPath));
const uvData = new Float32Array(fs.readFileSync(uvPath).buffer.slice(0)); // uvfix.bin
const textureData = fs.readFileSync(texturePath);

// Parse original GLB
const jsonLen = glbBuf.readUInt32LE(12);
const origJson = JSON.parse(glbBuf.slice(20, 20 + jsonLen).toString());
const binChunkStart = 20 + jsonLen;
const binData = glbBuf.slice(binChunkStart + 8);

console.log(`\nOriginal: ${origJson.accessors.length} accessors, ${origJson.bufferViews.length} bufferViews`);

// === Helper: read typed array from accessor ===
function readAccessor(accIdx) {
  const acc = origJson.accessors[accIdx];
  const bv = origJson.bufferViews[acc.bufferView];
  const offset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const elemSize = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type];
  const count = acc.count * elemSize;

  switch (acc.componentType) {
    case 5126: return new Float32Array(binData.buffer, binData.byteOffset + offset, count);
    case 5125: return new Uint32Array(binData.buffer, binData.byteOffset + offset, count);
    case 5123: return new Uint16Array(binData.buffer, binData.byteOffset + offset, count);
    case 5121: return new Uint8Array(binData.buffer, binData.byteOffset + offset, count);
    default: throw new Error(`Unknown componentType: ${acc.componentType}`);
  }
}

// === Read original mesh data ===
const prim = origJson.meshes[0].primitives[0];
const origPositions = readAccessor(prim.attributes.POSITION);    // vec3 float
const origNormals = readAccessor(prim.attributes.NORMAL);        // vec3 float
const origJoints = readAccessor(prim.attributes.JOINTS_0);       // vec4 uint8
const origWeights = readAccessor(prim.attributes.WEIGHTS_0);     // vec4 float
const indices = readAccessor(prim.indices);                       // uint32

const vertexCount = origJson.accessors[prim.attributes.POSITION].count;
const indexCount = indices.length;
console.log(`Vertices: ${vertexCount}, Indices: ${indexCount} (${indexCount / 3} triangles)`);
console.log(`UV data: ${uvData.length} floats (${uvData.length / 2} corners)`);

if (uvData.length !== indexCount * 2) {
  console.error(`UV count mismatch! Expected ${indexCount * 2}, got ${uvData.length}`);
  process.exit(1);
}

// === De-index: expand all attributes ===
console.log('\nExpanding indexed geometry...');
const newCount = indexCount; // Each index becomes a unique vertex
const newPositions = new Float32Array(newCount * 3);
const newNormals = new Float32Array(newCount * 3);
const newJoints = new Uint8Array(newCount * 4);
const newWeights = new Float32Array(newCount * 4);
// newUVs = uvData (already per-corner)

for (let i = 0; i < indexCount; i++) {
  const vi = indices[i];
  newPositions[i * 3]     = origPositions[vi * 3];
  newPositions[i * 3 + 1] = origPositions[vi * 3 + 1];
  newPositions[i * 3 + 2] = origPositions[vi * 3 + 2];
  newNormals[i * 3]       = origNormals[vi * 3];
  newNormals[i * 3 + 1]   = origNormals[vi * 3 + 1];
  newNormals[i * 3 + 2]   = origNormals[vi * 3 + 2];
  newJoints[i * 4]        = origJoints[vi * 4];
  newJoints[i * 4 + 1]    = origJoints[vi * 4 + 1];
  newJoints[i * 4 + 2]    = origJoints[vi * 4 + 2];
  newJoints[i * 4 + 3]    = origJoints[vi * 4 + 3];
  newWeights[i * 4]       = origWeights[vi * 4];
  newWeights[i * 4 + 1]   = origWeights[vi * 4 + 1];
  newWeights[i * 4 + 2]   = origWeights[vi * 4 + 2];
  newWeights[i * 4 + 3]   = origWeights[vi * 4 + 3];
}

// Compute new bounding box for POSITION accessor
let posMin = [Infinity, Infinity, Infinity];
let posMax = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < newCount; i++) {
  for (let j = 0; j < 3; j++) {
    const v = newPositions[i * 3 + j];
    if (v < posMin[j]) posMin[j] = v;
    if (v > posMax[j]) posMax[j] = v;
  }
}

// === Copy skin + animation data verbatim from original ===
// Accessor 6 = inverse bind matrices, Accessors 7-80 = animation
// We copy raw bytes for each buffer view (6 through end)
const keepBufferViews = []; // { origBvIdx, data: Buffer }
for (let bvIdx = 6; bvIdx < origJson.bufferViews.length; bvIdx++) {
  const bv = origJson.bufferViews[bvIdx];
  const start = bv.byteOffset || 0;
  const len = bv.byteLength;
  keepBufferViews.push({
    origBvIdx: bvIdx,
    data: Buffer.from(binData.buffer, binData.byteOffset + start, len),
  });
}

// === Build new binary buffer ===
function align4(n) { return (n + 3) & ~3; }

const sections = [];
let offset = 0;
const bvMeta = []; // New buffer view metadata: { byteOffset, byteLength }

// BV 0: Positions
const posBuf = Buffer.from(newPositions.buffer);
bvMeta.push({ byteOffset: offset, byteLength: posBuf.length });
sections.push(posBuf);
offset += align4(posBuf.length);

// BV 1: Normals
const normBuf = Buffer.from(newNormals.buffer);
bvMeta.push({ byteOffset: offset, byteLength: normBuf.length });
sections.push(normBuf);
offset += align4(normBuf.length);

// BV 2: UVs
const uvBuf = Buffer.from(uvData.buffer);
bvMeta.push({ byteOffset: offset, byteLength: uvBuf.length });
sections.push(uvBuf);
offset += align4(uvBuf.length);

// BV 3: Joints
const jointsBuf = Buffer.from(newJoints.buffer);
bvMeta.push({ byteOffset: offset, byteLength: jointsBuf.length });
sections.push(jointsBuf);
offset += align4(jointsBuf.length);

// BV 4: Weights
const weightsBuf = Buffer.from(newWeights.buffer);
bvMeta.push({ byteOffset: offset, byteLength: weightsBuf.length });
sections.push(weightsBuf);
offset += align4(weightsBuf.length);

// BV 5..N: Skin + animation data (copied from original BV 6..end)
const keepBvStartIdx = 5;
for (const kbv of keepBufferViews) {
  bvMeta.push({ byteOffset: offset, byteLength: kbv.data.length });
  sections.push(kbv.data);
  offset += align4(kbv.data.length);
}

// BV last: Texture image
const texBvIdx = bvMeta.length;
bvMeta.push({ byteOffset: offset, byteLength: textureData.length });
sections.push(textureData);
offset += align4(textureData.length);

// Assemble binary with padding
const totalBinLen = offset;
const newBin = Buffer.alloc(totalBinLen);
for (let i = 0; i < sections.length; i++) {
  sections[i].copy(newBin, bvMeta[i].byteOffset);
}

console.log(`New binary: ${(totalBinLen / 1024 / 1024).toFixed(1)} MB`);

// === Build new JSON ===
const newJson = {
  asset: { version: '2.0', generator: 'transfer-uv bake tool' },
  scene: 0,
  scenes: [{ nodes: origJson.scenes[0].nodes }],
  nodes: origJson.nodes,
  skins: origJson.skins.map(skin => ({
    ...skin,
    inverseBindMatrices: keepBvStartIdx, // Points to accessor index for IBM
  })),
  animations: origJson.animations.map(anim => ({
    ...anim,
    // Remap sampler accessor indices: original N → new N-1 (for N >= 7)
    samplers: anim.samplers.map(s => ({
      ...s,
      input: s.input - 2,   // Original acc 7 → new acc 5, etc.
      output: s.output - 2,
    })),
  })),
  meshes: [{
    primitives: [{
      attributes: {
        POSITION: 0,
        NORMAL: 1,
        TEXCOORD_0: 2,
        JOINTS_0: 3,
        WEIGHTS_0: 4,
      },
      // No indices — non-indexed draw
      material: 0,
    }],
  }],
  // New accessors
  accessors: [
    // 0: POSITION
    { bufferView: 0, componentType: 5126, count: newCount, type: 'VEC3', max: posMax, min: posMin },
    // 1: NORMAL
    { bufferView: 1, componentType: 5126, count: newCount, type: 'VEC3' },
    // 2: TEXCOORD_0
    { bufferView: 2, componentType: 5126, count: newCount, type: 'VEC2' },
    // 3: JOINTS_0
    { bufferView: 3, componentType: 5121, count: newCount, type: 'VEC4' },
    // 4: WEIGHTS_0
    { bufferView: 4, componentType: 5126, count: newCount, type: 'VEC4' },
  ],
  bufferViews: [],
  buffers: [{ byteLength: totalBinLen }],
  // Material + texture
  materials: [{
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0 },
      metallicFactor: 0.05,
      roughnessFactor: 0.6,
    },
    doubleSided: true,
  }],
  textures: [{ source: 0, sampler: 0 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  images: [{ bufferView: texBvIdx, mimeType: texturePath.endsWith('.jpg') ? 'image/jpeg' : 'image/png' }],
};

// Add kept accessors (IBM + animation): original accessors 6..80 → new 5..79
// IBM accessor (original 6)
const ibmOrig = origJson.accessors[6];
newJson.accessors.push({
  bufferView: keepBvStartIdx,
  byteOffset: ibmOrig.byteOffset || 0,
  componentType: ibmOrig.componentType,
  count: ibmOrig.count,
  type: ibmOrig.type,
});

// Animation accessors (original 7..80 → new 6..79)
for (let i = 7; i < origJson.accessors.length; i++) {
  const orig = origJson.accessors[i];
  const newBvIdx = keepBvStartIdx + (orig.bufferView - 6); // Remap buffer view
  const entry = {
    bufferView: newBvIdx,
    componentType: orig.componentType,
    count: orig.count,
    type: orig.type,
  };
  if (orig.byteOffset) entry.byteOffset = orig.byteOffset;
  if (orig.max) entry.max = orig.max;
  if (orig.min) entry.min = orig.min;
  newJson.accessors.push(entry);
}

// Build buffer views
for (const bvm of bvMeta) {
  newJson.bufferViews.push({ buffer: 0, byteOffset: bvm.byteOffset, byteLength: bvm.byteLength });
}

// Fix skin: inverseBindMatrices should point to accessor 5 (the IBM accessor)
newJson.skins[0].inverseBindMatrices = 5;

console.log(`New JSON: ${newJson.accessors.length} accessors, ${newJson.bufferViews.length} bufferViews`);

// === Pack GLB ===
const jsonStr = JSON.stringify(newJson);
const jsonBuf = Buffer.from(jsonStr);
// JSON chunk must be padded to 4-byte alignment with spaces
const jsonPadLen = align4(jsonBuf.length);
const jsonPadded = Buffer.alloc(jsonPadLen, 0x20); // 0x20 = space
jsonBuf.copy(jsonPadded);

const glbHeader = Buffer.alloc(12);
const jsonChunkHeader = Buffer.alloc(8);
const binChunkHeader = Buffer.alloc(8);

const totalLen = 12 + 8 + jsonPadLen + 8 + totalBinLen;
// GLB header
glbHeader.writeUInt32LE(0x46546C67, 0); // 'glTF' magic
glbHeader.writeUInt32LE(2, 4);           // version
glbHeader.writeUInt32LE(totalLen, 8);    // total length
// JSON chunk
jsonChunkHeader.writeUInt32LE(jsonPadLen, 0);
jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'
// BIN chunk
binChunkHeader.writeUInt32LE(totalBinLen, 0);
binChunkHeader.writeUInt32LE(0x004E4942, 4);   // 'BIN\0'

const output = Buffer.concat([glbHeader, jsonChunkHeader, jsonPadded, binChunkHeader, newBin]);
fs.writeFileSync(outPath, output);

console.log(`\nBaked GLB: ${outPath} (${(output.length / 1024 / 1024).toFixed(1)} MB)`);
console.log('Done! This GLB is self-contained — load it in any 3D engine.');
