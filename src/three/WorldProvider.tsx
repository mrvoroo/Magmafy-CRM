import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Scene, World } from './world';
import { useTheme } from '../app/theme';
import { store } from '../lib/storage';

type Ctx = { setScene: (s: Scene) => void; burst: () => void; setDimmed: (d: boolean) => void };
const WorldCtx = createContext<Ctx>({ setScene: () => {}, burst: () => {}, setDimmed: () => {} });

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

/**
 * One canvas and one renderer for the whole app, behind everything (NFR-61).
 * three.js loads lazily after the first paint (NFR-60). Reduced motion, «off», no WebGL
 * or a device that keeps dropping frames get the static SVG volcano instead (NFR-63/64).
 */
export function WorldProvider({ children }: { children: ReactNode }) {
  const { theme, motion } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const pending = useRef<Scene | null>(null);
  const [slow, setSlow] = useState(() => store.get('mg-crm-3d-slow') === '1');
  const fallback = motion === 'off' || slow || reducedMotion() || !hasWebGL();
  const [scene, setSceneState] = useState<Scene | null>(null);

  useEffect(() => {
    if (fallback || !canvasRef.current) return;
    let alive = true;
    const boot = () => import('./world').then(({ createWorld }) => {
      if (!alive || !canvasRef.current) return;
      world.current = createWorld(canvasRef.current, {
        reduced: motion === 'calm', light: document.documentElement.getAttribute('data-theme') === 'light',
        onSlow: () => { store.set('mg-crm-3d-slow', '1'); setSlow(true); }
      });
      if (!world.current) { setSlow(true); return; }
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

/** Static volcano for reduced motion / no WebGL. Sits where the 3D one would. */
function VolcanoFallback({ scene }: { scene: Scene | null }) {
  const [box, setBox] = useState<{ left: number; top: number; size: number; opacity: number }>({ left: -999, top: -999, size: 0, opacity: 0 });
  useEffect(() => {
    if (!scene) return;
    const place = () => {
      if (scene.anchor) {
        const r = scene.anchor.getBoundingClientRect();
        const size = r.height * (scene.anchorFit || 2.2);
        setBox({ left: r.left + r.width / 2 - size / 2, top: r.top + r.height / 2 - size * 0.55, size, opacity: 1 });
      } else if (scene.corner === 'end-bottom') {
        const size = 260;
        const rtl = document.documentElement.dir === 'rtl';
        setBox({ left: rtl ? 24 : window.innerWidth - size - 24, top: window.innerHeight - size - 24, size, opacity: Math.min(0.5, (scene.opacity ?? 0.2) * 2.5) });
      } else {
        const size = Math.min(window.innerWidth, window.innerHeight) * 0.6 * (scene.scale ?? 1);
        setBox({ left: window.innerWidth / 2 - size / 2 + (scene.x ?? 0) * 60, top: window.innerHeight / 2 - size / 2, size, opacity: scene.opacity ?? 0.9 });
      }
    };
    place();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place); window.removeEventListener('resize', place); };
  }, [scene]);
  return (
    <svg className="world-fallback" aria-hidden="true" viewBox="0 0 200 200" style={{ left: box.left, top: box.top, width: box.size, height: box.size, opacity: box.opacity }}>
      <defs>
        <linearGradient id="vg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#4f5bd5" /><stop offset=".35" stopColor="#962fbf" /><stop offset=".65" stopColor="#d62976" /><stop offset=".85" stopColor="#fa7e1e" /><stop offset="1" stopColor="#feda75" /></linearGradient>
        <radialGradient id="vp" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#feda75" stopOpacity=".9" /><stop offset="1" stopColor="#d62976" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="100" cy="48" rx="46" ry="40" fill="url(#vp)" />
      <circle cx="92" cy="38" r="10" fill="#fa7e1e" opacity=".55" /><circle cx="110" cy="26" r="7" fill="#feda75" opacity=".6" /><circle cx="100" cy="60" r="8" fill="#d62976" opacity=".5" />
      <path d="M22 178 L84 88 Q100 78 116 88 L178 178 Z" fill="url(#vg)" />
      <path d="M84 88 Q100 96 116 88" stroke="#feda75" strokeWidth="4" fill="none" />
      <path d="M96 92 C94 120 104 140 92 176" stroke="#feda75" strokeWidth="2.5" fill="none" opacity=".8" />
      <path d="M108 92 C114 118 106 150 122 176" stroke="#fa7e1e" strokeWidth="2" fill="none" opacity=".7" />
    </svg>
  );
}
