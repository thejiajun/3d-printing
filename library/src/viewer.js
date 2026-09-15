// Three.js scene: load a GLB, frame it, orbit/zoom, and render card snapshots.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

function loadModel(url) {
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url).catch((err) => { cache.delete(url); throw err; }));
  }
  return cache.get(url).then((gltf) => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      // Printed parts are mostly faceted; flat shading needs no stored normals.
      o.material = o.material.clone();
      o.material.flatShading = true;
      o.material.side = THREE.DoubleSide;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return root;
  });
}

function buildStage(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun, sun.target);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
  return { scene, camera, sun };
}

// Put the model on the "bed" (y = 0), centered, and aim camera + light at it.
function frame({ scene, camera, sun }, model, pivot, grid) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  const radius = Math.max(size.length() / 2, 1);

  if (grid) {
    const cell = 10 ** Math.floor(Math.log10(radius)); // 1 / 10 / 100 mm cells
    const extent = Math.ceil((radius * 3) / cell) * cell;
    grid.geometry.dispose();
    const next = new THREE.GridHelper(extent, extent / cell, 0x000000, 0x000000);
    grid.geometry = next.geometry;
  }

  const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
  const target = new THREE.Vector3(0, size.y / 2, 0);
  camera.position.copy(target).add(new THREE.Vector3(1, 0.75, 1.25).normalize().multiplyScalar(dist));
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(target);

  sun.position.set(radius * 2, radius * 4, radius * 3);
  sun.target.position.copy(target);
  const s = sun.shadow.camera;
  s.left = s.bottom = -radius * 2;
  s.right = s.top = radius * 2;
  s.near = 0.1;
  s.far = radius * 10;
  s.updateProjectionMatrix();
  return { target, size };
}

export function createViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const stage = buildStage(renderer);
  const pivot = new THREE.Group();
  const grid = new THREE.GridHelper(100, 10);
  grid.material.transparent = true;
  grid.material.opacity = 0.08;
  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ opacity: 0.18 }),
  );
  shadowCatcher.receiveShadow = true;
  stage.scene.add(pivot, grid, shadowCatcher);

  const controls = new OrbitControls(stage.camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotateSpeed = 1.2;

  let home = null;
  let current = null;
  let token = 0;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    stage.camera.aspect = w / Math.max(h, 1);
    stage.camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(stage.scene, stage.camera);
  });
  // Stop idle spin as soon as the user grabs the model.
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  return {
    async show(url) {
      const mine = ++token;
      const model = await loadModel(url);
      if (mine !== token) return null;
      if (current) pivot.remove(current);
      current = model;
      pivot.add(model);
      const { target, size } = frame(stage, model, pivot, grid);
      shadowCatcher.scale.setScalar(Math.max(size.x, size.z) * 6);
      controls.target.copy(target);
      controls.autoRotate = true;
      home = { position: stage.camera.position.clone(), target: target.clone() };
      return size;
    },
    resetView() {
      if (!home) return;
      stage.camera.position.copy(home.position);
      controls.target.copy(home.target);
    },
    dispose() {
      ro.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

// One shared offscreen renderer turns GLBs into card thumbnails for projects with no image.
let snapper = null;
export async function snapshot(url, width = 480, height = 360) {
  snapper ??= (() => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setSize(width, height, false);
    const stage = buildStage(renderer);
    stage.camera.aspect = width / height;
    return { renderer, stage, queue: Promise.resolve() };
  })();
  const job = snapper.queue.then(async () => {
    const model = await loadModel(url);
    const { renderer, stage } = snapper;
    stage.scene.add(model);
    frame(stage, model, null, null);
    renderer.render(stage.scene, stage.camera);
    stage.scene.remove(model);
    return new Promise((r) => renderer.domElement.toBlob((b) => r(URL.createObjectURL(b))));
  });
  snapper.queue = job.catch(() => {});
  return job;
}
