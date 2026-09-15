// Convert parsed parts into a compact GLB (welded, simplified if huge, meshopt-compressed).
import { Document, NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, meshopt, dedup, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const MAX_TRIANGLES = 400_000;
const DEFAULT_COLOR = '#A7A9AC';

function hexToLinear(hex) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex ?? '') ?? [null, DEFAULT_COLOR.slice(1)];
  const n = parseInt(m[1], 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  return srgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
}

export async function partsToGlb(parts) {
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const materials = new Map();
  let triangles = 0;

  for (const part of parts) {
    const src = part.positions;
    if (!src.length) continue;
    triangles += src.length / 9;
    // Printer space is Z-up; glTF is Y-up.
    const pos = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      pos[i] = src[i];
      pos[i + 1] = src[i + 2];
      pos[i + 2] = -src[i + 1];
    }
    const color = (part.color ?? DEFAULT_COLOR).toUpperCase().slice(0, 7);
    if (!materials.has(color)) {
      materials.set(color, doc.createMaterial(color)
        .setBaseColorFactor([...hexToLinear(color), 1])
        .setRoughnessFactor(0.6).setMetallicFactor(0));
    }
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setMaterial(materials.get(color));
    const mesh = doc.createMesh(part.name).addPrimitive(prim);
    scene.addChild(doc.createNode(part.name).setMesh(mesh));
  }

  const ratio = triangles > MAX_TRIANGLES ? MAX_TRIANGLES / triangles : 1;
  await doc.transform(
    weld(),
    ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 })] : []),
    dedup(),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
  });
  return { glb: await io.writeBinary(doc), triangles };
}
