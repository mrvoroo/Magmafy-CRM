// The Magmafy particle world, ported from magmafy-pro/assets/js/world.js.
// Same shapes, same shaders, same morph()/burst() API. Additions for the CRM:
// light-theme blending, following a DOM element (the «O» in WORKSPACE), a frame-time guard, and dispose().
import * as THREE from 'three';
import { buildShape, rand } from './shapes';

export const SHAPES = ['volcano', 'core', 'research', 'content', 'websites', 'consulting', 'galaxy', 'ring', 'wave', 'globe', 'dna', 'saturn'] as const;
export type Shape = (typeof SHAPES)[number];
export type Scene = { shape: Shape; x?: number; y?: number; scale?: number; opacity?: number; anchor?: HTMLElement | null; anchorFit?: number; corner?: 'end-bottom' | 'center' };

const MORPH_SECONDS = 1.8;
const CAM_Z = 9, FOV = 45;
const HALF_H = CAM_Z * Math.tan((FOV / 2) * Math.PI / 180);
// The volcano spans about y -2.45 … 3.3: its height and centre, for fitting it into a box on screen.
const SHAPE_H = 5.6, SHAPE_CY = 0.4;

const vertex = /* glsl */`
  attribute float aRand;
  attribute vec3 aTo;
  uniform float uProgress;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixel;
  uniform float uBurst;
  varying float vRand;
  varying float vDepth;
  void main() {
    float k = clamp((uProgress - aRand * 0.35) / 0.65, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 p = mix(position, aTo, k);
    float t = uTime * 0.6 + aRand * 20.0;
    p += vec3(sin(t), cos(t * 1.3), sin(t * 0.7)) * 0.025;
    p += normalize(p + vec3(0.0001)) * uBurst * (0.6 + aRand * 1.8) * 2.8;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = uSize * (0.55 + aRand * 0.9);
    gl_PointSize = s * uPixel * (10.0 / -mv.z);
    vRand = aRand;
    vDepth = clamp((-mv.z - 4.0) / 8.0, 0.0, 1.0);
  }
`;
const fragment = /* glsl */`
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform vec3 uD;
  uniform float uOpacity;
  varying float vRand;
  varying float vDepth;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float glow = pow(1.0 - d * 2.0, 1.8);
    vec3 col = mix(uA, uB, smoothstep(0.0, 0.3, vRand));
    col = mix(col, uC, smoothstep(0.3, 0.62, vRand));
    col = mix(col, uD, smoothstep(0.62, 1.0, vRand));
    gl_FragColor = vec4(col, glow * uOpacity * (1.0 - vDepth * 0.6));
  }
`;

export type World = {
  morph: (s: Scene) => void;
  burst: () => void;
  setTheme: (t: 'dark' | 'light') => void;
  setDimmed: (d: boolean) => void;
  dispose: () => void;
};

export function createWorld(canvas: HTMLCanvasElement, opts: { reduced: boolean; light: boolean; onSlow?: () => void }): World | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const small = window.matchMedia('(max-width: 960px)').matches;
  let N = small ? 4500 : 11000;
  const pixel = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.75);
  renderer.setPixelRatio(pixel);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  const shapes = {} as Record<Shape, Float32Array>;
  SHAPES.forEach((s, i) => { shapes[s] = buildShape(s, N, rand(101 + i * 17)); });

  const from = new Float32Array(N * 3);
  const start = rand(3);
  for (let i = 0; i < from.length; i++) from[i] = (start() - 0.5) * 18;
  let target = shapes.volcano;
  const to = new Float32Array(target);
  const geometry = new THREE.BufferGeometry();
  const fromAttr = new THREE.BufferAttribute(from, 3);
  const toAttr = new THREE.BufferAttribute(to, 3);
  geometry.setAttribute('position', fromAttr);
  geometry.setAttribute('aTo', toAttr);
  const rnd = new Float32Array(N);
  const rr = rand(42);
  for (let i = 0; i < N; i++) rnd[i] = rr();
  geometry.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

  const baseSize = small ? 3.4 : 3.0;
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uProgress: { value: 0 }, uSize: { value: baseSize }, uPixel: { value: pixel }, uBurst: { value: 0 }, uOpacity: { value: 0.9 },
      uA: { value: new THREE.Color('#feda75') }, uB: { value: new THREE.Color('#fa7e1e') }, uC: { value: new THREE.Color('#d62976') }, uD: { value: new THREE.Color('#962fbf') }
    }
  });
  const points = new THREE.Points(geometry, material);
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  let light = opts.light;
  let dimmed = false;
  let opacityMul = 1;
  function setTheme(t: 'dark' | 'light') {
    light = t === 'light';
    // Additive light vanishes on a light background: blend normally and lift the opacity there.
    material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    opacityMul = light ? 1.2 : 1;
    material.needsUpdate = true;
    if (opts.reduced) render();
  }
  setTheme(light ? 'light' : 'dark');

  const state = { x: 0, y: 0, scale: 1, opacity: 0, spin: 0, size: baseSize };
  const goal = { x: 0, y: 0, scale: 1, opacity: 0.9, size: baseSize };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let anchor: HTMLElement | null = null;
  let anchorFit = 2.2;

  let vw = 1, vh = 1;
  let last: Scene | null = null;
  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    if (last) place(last);
    if (opts.reduced) render();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(document.documentElement);
  const onMove = (e: PointerEvent) => { mouse.tx = (e.clientX / vw - 0.5) * 2; mouse.ty = (e.clientY / vh - 0.5) * 2; };
  window.addEventListener('pointermove', onMove, { passive: true });

  /** Screen box → world position + scale so the volcano sits in that box. */
  function fitTo(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ndcX = (cx / vw) * 2 - 1, ndcY = 1 - (cy / vh) * 2;
    const scale = ((r.height * anchorFit) / vh) * 2 * HALF_H / SHAPE_H;
    goal.x = ndcX * HALF_H * camera.aspect;
    goal.y = ndcY * HALF_H - SHAPE_CY * scale;
    goal.scale = scale;
    goal.size = baseSize * Math.max(0.8, Math.min(1, scale * 1.8));
  }

  /** Where a scene sits. Phones: every shape centred behind the content, sized to the screen width. */
  function place(s: Scene) {
    const narrow = vw < 760;
    const r = s.anchor?.getBoundingClientRect();
    anchor = s.anchor && r && r.width > 0 && r.height > 0 ? s.anchor : null;
    anchorFit = s.anchorFit || 2.2;
    if (anchor) return;
    const sc = s.scale ?? 1;
    if (narrow) {
      const fit = (2 * HALF_H * camera.aspect * 0.92) / 5.4; // the widest shapes are ~5.4 units across
      const k = Math.min(fit, 1.15);
      goal.x = 0;
      goal.y = HALF_H * 0.12 - SHAPE_CY * k;
      goal.scale = k;
      goal.size = baseSize;
      return;
    }
    if (s.corner === 'end-bottom') {
      // A small shape tucked in the end-bottom corner (mirrors with the page direction).
      const rtl = document.documentElement.dir === 'rtl';
      goal.x = (rtl ? -1 : 1) * (HALF_H * camera.aspect - 1.9 * sc);
      goal.y = -HALF_H + 2.2 * sc;
    } else { goal.x = s.x ?? 0; goal.y = s.y ?? 0; }
    goal.scale = sc;
    goal.size = baseSize;
  }

  function retarget(next: Float32Array) {
    const p = material.uniforms.uProgress.value as number;
    for (let i = 0, j = 0; i < N; i++, j += 3) {
      let k = Math.min(1, Math.max(0, (p - rnd[i] * 0.35) / 0.65));
      k = k * k * (3 - 2 * k);
      from[j] += (to[j] - from[j]) * k;
      from[j + 1] += (to[j + 1] - from[j + 1]) * k;
      from[j + 2] += (to[j + 2] - from[j + 2]) * k;
    }
    to.set(next);
    target = next;
    fromAttr.needsUpdate = true;
    toAttr.needsUpdate = true;
    material.uniforms.uProgress.value = opts.reduced ? 1 : 0;
  }

  function render() { renderer.render(scene, camera); }

  const clock = new THREE.Clock();
  let running = !opts.reduced;
  let raf = 0;
  let slowFor = 0, cuts = 0, lastFrame = 0;
  function frame(t: number) {
    if (!running) return;
    // Cap at 30 fps while a dialog or drawer is open.
    if (dimmed && t - lastFrame < 33) { raf = requestAnimationFrame(frame); return; }
    lastFrame = t;
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    material.uniforms.uTime.value = clock.elapsedTime;

    // Performance guard: on a struggling device thin the particles (down to a quarter),
    // but never stop: the volcano keeps animating everywhere (owner's request).
    if (raw > 0.024 && raw < 1) slowFor += raw; else slowFor = Math.max(0, slowFor - dt);
    if (slowFor > 2) {
      slowFor = 0;
      if (cuts < 2) { cuts++; N = Math.floor(N / 2); geometry.setDrawRange(0, N); opts.onSlow?.(); }
    }

    const b = material.uniforms.uBurst;
    if (b.value > 0.001) b.value *= Math.pow(0.9, Math.min(raw, 0.1) * 60); else b.value = 0;
    const u = material.uniforms.uProgress;
    if (u.value < 1) u.value = Math.min(1, u.value + Math.min(raw, 0.25) / MORPH_SECONDS);

    if (anchor) fitTo(anchor);
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    const ease = anchor ? 0.18 : 0.06;
    state.x += (goal.x - state.x) * ease;
    state.y += (goal.y - state.y) * ease;
    state.scale += (goal.scale - state.scale) * ease;
    state.size += (goal.size - state.size) * 0.1;
    state.opacity += (goal.opacity * (dimmed ? 0.5 : 1) - state.opacity) * 0.06;
    state.spin += dt * 0.12;

    group.position.set(state.x, state.y, 0);
    group.scale.setScalar(state.scale);
    group.rotation.y = state.spin + mouse.x * (anchor ? 0.15 : 0.35);
    group.rotation.x = 0.18 + mouse.y * (anchor ? 0.08 : 0.2);
    material.uniforms.uSize.value = state.size;
    material.uniforms.uOpacity.value = Math.min(1, state.opacity * opacityMul);
    render();
    raf = requestAnimationFrame(frame);
  }
  if (running) raf = requestAnimationFrame(frame);
  else { material.uniforms.uProgress.value = 1; group.rotation.x = 0.18; render(); }

  const onVis = () => {
    const was = running;
    running = !document.hidden && !opts.reduced;
    if (running && !was) { clock.getDelta(); raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', onVis);

  return {
    burst() { if (!opts.reduced) material.uniforms.uBurst.value = 1; },
    setTheme,
    setDimmed(d) { dimmed = d; },
    morph(s) {
      if (shapes[s.shape] && shapes[s.shape] !== target) retarget(shapes[s.shape]);
      last = s;
      place(s);
      goal.opacity = s.opacity ?? 0.9;
      if (opts.reduced) {
        if (anchor) fitTo(anchor);
        Object.assign(state, goal);
        group.position.set(state.x, state.y, 0); group.scale.setScalar(state.scale);
        material.uniforms.uSize.value = state.size;
        material.uniforms.uOpacity.value = Math.min(1, state.opacity * opacityMul);
        material.uniforms.uProgress.value = 1;
        render();
      }
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      geometry.dispose(); material.dispose(); renderer.dispose();
    }
  };
}
