import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Scene, World } from './world';
import { useTheme } from '../app/theme';
import { store } from '../lib/storage';
import { buildShape, rand } from './shapes';

type Ctx = { setScene: (s: Scene) => void; burst: () => void; setDimmed: (d: boolean) => void };
const WorldCtx = createContext<Ctx>({ setScene: () => {}, burst: () => {}, setDimmed: () => {} });

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

/**
 * One canvas and one renderer for the whole app, behind everything (NFR-61).
 * three.js loads lazily after the first paint (NFR-60). Reduced motion, «off», no WebGL
 * Slow devices get fewer particles; reduced motion freezes the frame; «off» / no WebGL get a static 2D-canvas render of the same particles.
 */
export function WorldProvider({ children }: { children: ReactNode }) {
  const { theme, motion } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const pending = useRef<Scene | null>(null);
  // The real particle volcano runs everywhere. Only «off» or no WebGL get the static (2D canvas) particles.
  const [noGL, setNoGL] = useState(() => !hasWebGL());
  const fallback = motion === 'off' || noGL;
  useEffect(() => { store.del('mg-crm-3d-slow'); }, []); // old sticky flag from v1 builds
  const [scene, setSceneState] = useState<Scene | null>(null);

  useEffect(() => {
    if (fallback || !canvasRef.current) return;
    let alive = true;
    const boot = () => import('./world').then(({ createWorld }) => {
      if (!alive || !canvasRef.current) return;
      world.current = createWorld(canvasRef.current, {
        reduced: motion === 'calm' || reducedMotion(), light: document.documentElement.getAttribute('data-theme') === 'light'
      });
      if (!world.current) { setNoGL(true); return; }
      if (pending.current) world.current.morph(pending.current);
    });
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(boot, { timeout: 1200 }); else setTimeout(boot, 200);
    return () => { alive = false; world.current?.dispose(); world.current = null; };
  }, [fallback, motion]);

  useEffect(() => { world.current?.setTheme(theme); }, [theme]);

  const setScene = useCallback((s: Scene) => {
    pending.current = s;
    setSceneState(s);
    world.current?.morph(s);
  }, []);
  const burst = useCallback(() => world.current?.burst(), []);
  const setDimmed = useCallback((d: boolean) => world.current?.setDimmed(d), []);

  return (
    <WorldCtx.Provider value={{ setScene, burst, setDimmed }}>
      {fallback ? <VolcanoFallback scene={scene} /> : <canvas ref={canvasRef} className="world" aria-hidden="true" />}
      {children}
    </WorldCtx.Provider>
  );
}

export const useWorld = () => useContext(WorldCtx);

/** Pages declare the shape they want; the anchor (if any) is re-measured every frame by the world. */
export function useWorldScene(scene: Scene, deps: unknown[] = []) {
  const { setScene } = useContext(WorldCtx);
  useLayoutEffect(() => {
    setScene(scene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setScene, scene.shape, scene.opacity, scene.scale, scene.anchor, scene.corner, ...deps]);
}

/** Same particle volcano, drawn once on a 2D canvas (no WebGL / motion off). Sits where the 3D one would. */
let cached: Float32Array | null = null;
function VolcanoFallback({ scene }: { scene: Scene | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !scene) return;
    const draw = () => {
      const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = w * dpr; c.height = h * dpr;
      const g = c.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      let cx: number, cy: number, size: number, opacity = scene.opacity ?? 0.9;
      if (scene.anchor) {
        const r = scene.anchor.getBoundingClientRect();
        size = r.height * (scene.anchorFit || 2.2); cx = r.left + r.width / 2; cy = r.top + r.height / 2 - size * 0.07;
      } else if (scene.corner === 'end-bottom') {
        size = 300 * (scene.scale ?? 0.5) * 2; const rtl = document.documentElement.dir === 'rtl';
        cx = rtl ? size * 0.55 : w - size * 0.55; cy = h - size * 0.55; opacity = Math.min(0.6, opacity * 2.5);
      } else {
        size = h * 0.9 * (scene.scale ?? 1); cx = w / 2 + (scene.x ?? 0) * h * 0.12; cy = h / 2 - (scene.y ?? 0) * h * 0.12;
      }
      const n = 7000;
      const pts = cached || (cached = buildShape('volcano', n, rand(101)));
      const rr = rand(42);
      const cols = ['#feda75', '#fa7e1e', '#d62976', '#962fbf'];
      const k = size / 5.6, ax = 0.18, ay = 0.6;
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      g.globalCompositeOperation = light ? 'source-over' : 'lighter';
      for (let i = 0; i < n; i++) {
        const x0 = pts[i * 3], y0 = pts[i * 3 + 1], z0 = pts[i * 3 + 2], q = rr();
        const x1 = x0 * Math.cos(ay) + z0 * Math.sin(ay), z1 = -x0 * Math.sin(ay) + z0 * Math.cos(ay);
        const y2 = y0 * Math.cos(ax) - z1 * Math.sin(ax), z2 = y0 * Math.sin(ax) + z1 * Math.cos(ax);
        const persp = 9 / (9 - z2);
        g.globalAlpha = opacity * (0.35 + q * 0.5);
        g.fillStyle = cols[Math.min(3, Math.floor(q * 4))];
        g.fillRect(cx + x1 * k * persp, cy - (y2 + 0.4) * k * persp, 1.6, 1.6);
      }
    };
    draw();
    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', draw);
    return () => { window.removeEventListener('scroll', draw); window.removeEventListener('resize', draw); };
  }, [scene]);
  return <canvas ref={ref} className="world" aria-hidden="true" />;
}
