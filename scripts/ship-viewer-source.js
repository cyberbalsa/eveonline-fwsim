// Browser renderer for actual, locally hosted EVE hull geometry.
// Build with scripts/build-ship-viewer.mjs; the checked-in bundle needs no CDN.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const viewers = new WeakMap();
const hulls = new Set(['rifter', 'catalyst', 'caracal', 'drake', 'dominix', 'venture', 'providence', 'astrahus']);
const finishes = { rifter: 0x9b8066, catalyst: 0x82918a, caracal: 0x8298ae, drake: 0x6e879b, dominix: 0x81988c, venture: 0xc9a255, providence: 0xb0a082, astrahus: 0x939ca6 };
const asset = path => new URL(path, document.baseURI).href;

function disposeObject(object) {
  const geometries = new Set(), materials = new Set();
  object.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export function createShipViewer(container) {
  if (!(container instanceof HTMLElement)) throw new TypeError('A ship preview container is required.');
  viewers.get(container)?.destroy();
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const canvas = document.createElement('canvas');
  canvas.className = 'ship-viewer-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '3D EVE ship preview. Drag or use arrow keys to rotate.');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;';
  const fallback = document.createElement('img');
  fallback.className = 'ship-viewer-fallback';
  fallback.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;';
  fallback.alt = 'EVE ship render';
  const status = document.createElement('span');
  status.className = 'ship-viewer-status';
  status.style.cssText = 'position:absolute;left:10px;bottom:8px;font-size:9px;letter-spacing:1px;color:#b9cbd9;pointer-events:none;text-shadow:0 1px 3px #000;';
  container.append(canvas, fallback, status);
  container.dataset.modelState = 'loading';
  canvas.hidden = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const loader = new GLTFLoader();
  const cache = new Map();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(3.8, 2.4, 4.7);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xd0e9ff, 0x34403f, 2));
  const key = new THREE.DirectionalLight(0xffefd9, 3.3);
  key.position.set(-4, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x78c4ff, 2);
  rim.position.set(4, 1, -4); scene.add(rim);
  let renderer = null, environment = null, current = null;
  let disposed = false, failed = false, explicitVisible = true, intersects = true, dirty = true;
  let frame = 0, lastFrame = 0, loadVersion = 0, currentName = '', yaw = -0.35, pitch = 0;
  let drag = null, width = 0, height = 0;
  const metrics = { frames: 0, modelsLoaded: 0 };

  function visible() { return !disposed && !failed && explicitVisible && intersects && !document.hidden && container.isConnected; }
  function setState(state) {
    container.dataset.modelState = state;
    // Explicit display values also work when a host stylesheet styles images.
    canvas.hidden = state !== 'ready';
    canvas.style.display = state === 'ready' ? 'block' : 'none';
    fallback.hidden = state === 'ready';
    fallback.style.display = state === 'ready' ? 'none' : 'block';
    status.textContent = state === 'ready' ? 'CCP HULL · DRAG TO ROTATE' : state === 'loading' ? 'LOADING SHIP MODEL' : 'CCP SHIP RENDER';
  }
  function stop() { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = 0; }
  function schedule() { if (visible() && renderer && !frame) frame = requestAnimationFrame(draw); }
  function refresh() { dirty = true; if (visible()) schedule(); else stop(); }
  function resize() {
    const rect = container.getBoundingClientRect();
    width = Math.round(rect.width); height = Math.round(rect.height);
    if (renderer && width > 0 && height > 0) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Preserve comfortable framing on narrow preview cards.
      camera.fov = width < height ? 35 * height / Math.max(width, height / 2) : 35;
      camera.updateProjectionMatrix();
    }
    refresh();
  }
  function draw(time) {
    frame = 0;
    if (!visible() || !renderer || !width || !height || !current) return;
    const moving = !reduced.matches && !drag;
    if (dirty || moving) {
      if (!lastFrame || time - lastFrame >= 1000 / 24) {
        const elapsed = lastFrame ? Math.min((time - lastFrame) / 1000, 0.1) : 0;
        if (moving) yaw += elapsed * 0.045;
        lastFrame = time; dirty = false;
        current.rotation.set(pitch, yaw, 0);
        renderer.render(scene, camera);
        metrics.frames++;
      }
      if (moving || dirty) schedule();
    }
  }
  function unavailable() { failed = true; stop(); setState('fallback'); }
  function onLost(event) { event.preventDefault(); unavailable(); }
  function onRestored() { if (disposed) return; failed = false; setState(current ? 'ready' : 'fallback'); refresh(); }
  function onDown(event) {
    if (!current || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
  }
  function onMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    yaw += (event.clientX - drag.x) * .009;
    pitch = THREE.MathUtils.clamp(pitch + (event.clientY - drag.y) * .006, -1.2, 1.2);
    drag.x = event.clientX; drag.y = event.clientY; refresh();
  }
  function onUp(event) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.id)) return;
    drag = null; canvas.style.cursor = 'grab'; refresh();
  }
  function onKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') yaw -= .15;
    if (event.key === 'ArrowRight') yaw += .15;
    if (event.key === 'ArrowUp') pitch = Math.max(-1.2, pitch - .1);
    if (event.key === 'ArrowDown') pitch = Math.min(1.2, pitch + .1);
    refresh();
  }
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    environment = new THREE.CubeTextureLoader().load(
      ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(face => asset(`assets/backgrounds/c01-${face}.jpg`)),
      texture => {
        if (disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        scene.background = texture;
        scene.environment = texture;
        scene.backgroundIntensity = .65;
        scene.environmentIntensity = .65;
        refresh();
      }, undefined, () => { /* CSS EVE nebula and model remain usable. */ }
    );
  } catch { unavailable(); }
  const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => { intersects = entries[0].isIntersecting; refresh(); }) : null;
  const resizer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(container); resizer?.observe(container);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);
  canvas.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('resize', resize);
  reduced.addEventListener('change', refresh);
  resize();

  const api = {
    metrics,
    async setModel(name, faction = 'caldari') {
      if (disposed) return false;
      name = String(name).toLowerCase();
      if (!hulls.has(name)) name = faction === 'gallente' ? 'catalyst' : 'caracal';
      if (name === currentName && current) { refresh(); return !failed; }
      const version = ++loadVersion;
      currentName = name;
      fallback.src = asset(`assets/ships/${name}.png`);
      fallback.alt = `${name[0].toUpperCase() + name.slice(1)} — official EVE ship render`;
      container.dataset.model = name;
      if (failed || !renderer) { setState('fallback'); return false; }
      setState('loading');
      if (!cache.has(name)) {
        cache.set(name, loader.loadAsync(asset(`assets/models/${name}.glb`)).then(gltf => {
          const hull = new THREE.Group();
          const bounds = new THREE.Box3().setFromObject(gltf.scene);
          const size = bounds.getSize(new THREE.Vector3());
          gltf.scene.position.sub(bounds.getCenter(new THREE.Vector3()));
          hull.add(gltf.scene);
          hull.scale.setScalar(3.1 / Math.max(size.x, size.y, size.z));
          hull.traverse(node => {
            if (!node.isMesh) return;
            if (!node.geometry.attributes.normal) node.geometry.computeVertexNormals();
            for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
              material.color?.setHex(finishes[name]);
              material.metalness = .62; material.roughness = .37;
            }
          });
          metrics.modelsLoaded++;
          return hull;
        }));
      }
      try {
        const hull = await cache.get(name);
        if (disposed || version !== loadVersion) return false;
        if (current) scene.remove(current);
        current = hull; scene.add(current);
        yaw = -.35; pitch = 0;
        setState(failed ? 'fallback' : 'ready');
        resize();
        return !failed;
      } catch {
        cache.delete(name);
        if (!disposed && version === loadVersion) setState('fallback');
        return false;
      }
    },
    setVisible(value) { explicitVisible = Boolean(value); refresh(); },
    destroy() {
      if (disposed) return;
      disposed = true; loadVersion++; stop();
      observer?.disconnect(); resizer?.disconnect();
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('resize', resize);
      reduced.removeEventListener('change', refresh);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('lostpointercapture', onUp);
      canvas.removeEventListener('keydown', onKey);
      // Each cached promise owns one hull, including loads still in flight.
      for (const pending of cache.values()) pending.then(hull => disposeObject(hull), () => {});
      cache.clear();
      environment?.dispose();
      renderer?.dispose(); renderer?.forceContextLoss();
      scene.clear(); current = null; environment = null; renderer = null;
      canvas.remove(); fallback.remove(); status.remove();
      if (viewers.get(container) === api) viewers.delete(container);
    }
  };
  viewers.set(container, api);
  return api;
}
