// Copied from magmafy-pro/assets/js/world.js (buildShape + rand), unchanged except for TypeScript types.
export function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function buildShape(name: string, n: number, r: () => number): Float32Array {
  const out = new Float32Array(n * 3);
  const set = (i: number, x: number, y: number, z: number) => { out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z; };
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;

  // Uniform points on the surface of an axis-aligned box.
  const boxes = (list: number[][]) => {
    const faces: [number, (u: number, v: number) => number[]][] = [];
    list.forEach(([x0, x1, y0, y1, z0, z1]) => {
      const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
      faces.push([dx * dy, (u, v) => [x0 + u * dx, y0 + v * dy, z0]], [dx * dy, (u, v) => [x0 + u * dx, y0 + v * dy, z1]],
        [dx * dz, (u, v) => [x0 + u * dx, y0, z0 + v * dz]], [dx * dz, (u, v) => [x0 + u * dx, y1, z0 + v * dz]],
        [dy * dz, (u, v) => [x0, y0 + u * dy, z0 + v * dz]], [dy * dz, (u, v) => [x1, y0 + u * dy, z0 + v * dz]]);
    });
    const total = faces.reduce((a, f) => a + f[0], 0);
    return () => {
      let k = r() * total, i = 0;
      while (k > faces[i][0] && i < faces.length - 1) k -= faces[i++][0];
      return faces[i][1](r(), r());
    };
  };

  if (name === 'volcano') {
    // Magmafy's mark: a cone with a glowing crater, lava streams and an erupting plume.
    const base = -2.2, rim = 0.35, R0 = 2.7, R1 = 0.55;
    for (let i = 0; i < n; i++) {
      const k = i % 20;
      if (k < 10) {
        const t = 1 - Math.sqrt(r()), th = r() * Math.PI * 2;
        const rad = (R0 + (R1 - R0) * t) * (1 + 0.05 * Math.sin(th * 9 + t * 7));
        set(i, Math.cos(th) * rad, base + t * (rim - base) + gauss() * 0.03, Math.sin(th) * rad);
      } else if (k < 12) {
        const th = r() * Math.PI * 2, rad = R1 * (0.55 + r() * 0.5);
        set(i, Math.cos(th) * rad, rim + gauss() * 0.05 - (rad < R1 * 0.8 ? 0.1 : 0), Math.sin(th) * rad);
      } else if (k < 14) {
        const s = Math.floor(r() * 4), t = r(), th = s * 1.6 + 0.4 + Math.sin(t * 7 + s) * 0.18;
        const rad = (R1 + (R0 - R1) * t) * 1.02 + 0.03;
        set(i, Math.cos(th) * rad + gauss() * 0.04, rim - t * (rim - base) + 0.02, Math.sin(th) * rad + gauss() * 0.04);
      } else if (k < 19) {
        const hgt = Math.pow(r(), 0.8), y = rim + 0.1 + hgt * 2.9;
        const puff = Math.floor(hgt * 6), ang = puff * 2.1, spread = 0.12 + hgt * 0.7;
        const cx = Math.sin(hgt * 3) * 0.35 + Math.cos(ang) * spread * 0.5, cz = Math.sin(ang) * spread * 0.5;
        set(i, cx + gauss() * spread, y + gauss() * 0.12, cz + gauss() * spread);
      } else {
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rad = 1.2 + r() * 1.8;
        set(i, rad * Math.sin(ph) * Math.cos(th), rim + 1.4 + rad * Math.cos(ph) * 0.8, rad * Math.sin(ph) * Math.sin(th) * 0.6);
      }
    }
    for (let i = 0; i < n; i++) out[i * 3 + 1] -= 0.25;
  } else if (name === 'websites') {
    // A sofa: base, seat cushions, back, arms and legs, the way our 3D showrooms show it.
    const pick = boxes([
      [-1.9, 1.9, -0.55, 0.0, -0.85, 0.85],
      [-1.62, -0.02, 0.0, 0.32, -0.55, 0.85], [0.02, 1.62, 0.0, 0.32, -0.55, 0.85],
      [-1.9, 1.9, 0.0, 1.25, -0.85, -0.5],
      [-2.25, -1.9, -0.55, 0.62, -0.85, 0.85], [1.9, 2.25, -0.55, 0.62, -0.85, 0.85],
      [-1.4, -0.4, 0.32, 1.0, -0.5, -0.28], [0.4, 1.4, 0.32, 1.0, -0.5, -0.28]
    ]);
    const legs = [[-1.95, -0.6], [1.95, -0.6], [-1.95, 0.6], [1.95, 0.6]];
    for (let i = 0; i < n; i++) {
      if (i % 25 === 0) {
        const [lx, lz] = legs[i % 4], th = r() * Math.PI * 2;
        set(i, lx + Math.cos(th) * 0.07, -0.55 - r() * 0.4, lz + Math.sin(th) * 0.07);
      } else {
        const p = pick();
        set(i, p[0] + gauss() * 0.012, p[1] + gauss() * 0.012, p[2] + gauss() * 0.012);
      }
    }
  } else if (name === 'research') {
    // A magnifying glass over a rising bar chart: research before spending.
    const cx = -0.35, cy = 0.35, R = 1.55;
    for (let i = 0; i < n; i++) {
      const k = i % 10;
      if (k < 4) {
        const u = r() * Math.PI * 2, v = r() * Math.PI * 2, tube = 0.13;
        set(i, cx + (R + tube * Math.cos(v)) * Math.cos(u), cy + (R + tube * Math.cos(v)) * Math.sin(u), tube * Math.sin(v));
      } else if (k < 6) {
        const t = r(), a = -Math.PI / 4, th = r() * Math.PI * 2, rad = 0.16;
        const L = R + 0.15 + t * 1.6;
        set(i, cx + Math.cos(a) * L + Math.cos(th) * rad * 0.7, cy + Math.sin(a) * L + Math.sin(th) * rad * 0.7, Math.sin(th) * rad);
      } else if (k < 9) {
        const b = Math.floor(r() * 4), hgt = 0.45 + b * 0.38, x0 = cx - 0.95 + b * 0.55;
        const face = r(); let x = x0 + (r() - 0.5) * 0.3, y = cy - 0.8 + r() * hgt, z = (r() - 0.5) * 0.3;
        if (face < 0.25) x = x0 - 0.15; else if (face < 0.5) x = x0 + 0.15; else if (face < 0.7) y = cy - 0.8 + hgt; else z = r() < 0.5 ? -0.15 : 0.15;
        set(i, x, y, z);
      } else {
        const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * R * 0.95;
        set(i, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, gauss() * 0.05 - 0.2);
      }
    }
  } else if (name === 'core') {
    // Fibonacci sphere shell with an inner glowing nucleus.
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      if (i % 5 === 0) {
        const rad = Math.pow(r(), 2) * 0.9;
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
        set(i, rad * Math.sin(ph) * Math.cos(th), rad * Math.sin(ph) * Math.sin(th), rad * Math.cos(ph));
      } else {
        const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = golden * i;
        const k = 2.2 + gauss() * 0.04;
        set(i, Math.cos(th) * rad * k, y * k, Math.sin(th) * rad * k);
      }
    }
  } else if (name === 'lattice') {
    // A 3x3x3 lattice of cube edges.
    const g = 3, size = 3.6, step = size / g;
    for (let i = 0; i < n; i++) {
      const axis = Math.floor(r() * 3);
      const a = Math.round(r() * g) * step - size / 2;
      const b = Math.round(r() * g) * step - size / 2;
      const c = r() * size - size / 2;
      const j = 0.015;
      const p = axis === 0 ? [c, a, b] : axis === 1 ? [a, c, b] : [a, b, c];
      set(i, p[0] + gauss() * j, p[1] + gauss() * j, p[2] + gauss() * j);
    }
  } else if (name === 'consulting') {
    // Neural network: nodes connected by synapse lines.
    const nodes: number[][] = [];
    const nr = rand(7);
    for (let k = 0; k < 46; k++) {
      const th = nr() * Math.PI * 2, ph = Math.acos(2 * nr() - 1), rad = 0.8 + nr() * 1.7;
      nodes.push([rad * Math.sin(ph) * Math.cos(th), rad * Math.cos(ph) * 0.8, rad * Math.sin(ph) * Math.sin(th)]);
    }
    const edges: number[][][] = [];
    nodes.forEach((a, i) => nodes.forEach((b, j) => {
      if (j <= i) return;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (d < 1.25) edges.push([a, b]);
    }));
    for (let i = 0; i < n; i++) {
      if (i % 3 === 0) {
        const c = nodes[i % nodes.length];
        set(i, c[0] + gauss() * 0.09, c[1] + gauss() * 0.09, c[2] + gauss() * 0.09);
      } else {
        const [a, b] = edges[Math.floor(r() * edges.length)];
        const u = r();
        set(i, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
      }
    }
  } else if (name === 'content') {
    // A rising 3D bar chart.
    const cols = 6, rows = 4, w = 0.34, gap = 0.62;
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(r() * cols), cz = Math.floor(r() * rows);
      const height = 0.6 + (cx / (cols - 1)) * 2.6 + Math.sin(cx * 1.7 + cz) * 0.35;
      const x0 = (cx - (cols - 1) / 2) * gap, z0 = (cz - (rows - 1) / 2) * gap;
      const face = Math.floor(r() * 5);
      let x = (r() - 0.5) * w, z = (r() - 0.5) * w, y = r() * height;
      if (face === 0) x = -w / 2; else if (face === 1) x = w / 2;
      else if (face === 2) z = -w / 2; else if (face === 3) z = w / 2; else y = height;
      set(i, x0 + x, y - 1.6, z0 + z);
    }
  } else if (name === 'stack') {
    // A stack of server slabs with a data column through the middle.
    const slabs = 5, sw = 3, sd = 1.8, sh = 0.32, gap = 0.62;
    for (let i = 0; i < n; i++) {
      if (i % 7 === 0) {
        set(i, gauss() * 0.06, (r() - 0.5) * slabs * gap * 1.3, gauss() * 0.06);
        continue;
      }
      const s = Math.floor(r() * slabs), y0 = (s - (slabs - 1) / 2) * gap;
      const face = Math.floor(r() * 3);
      let x = (r() - 0.5) * sw, y = (r() - 0.5) * sh, z = (r() - 0.5) * sd;
      if (face === 0) y = r() < 0.5 ? -sh / 2 : sh / 2;
      else if (face === 1) z = r() < 0.5 ? -sd / 2 : sd / 2;
      else x = r() < 0.5 ? -sw / 2 : sw / 2;
      set(i, x, y0 + y, z);
    }
  } else if (name === 'globe') {
    // Earth: dense procedural continents, faint latitude lines and a thin atmosphere.
    const land = (la: number, lo: number) => Math.sin(3 * lo) * Math.cos(2 * la) + 0.55 * Math.sin(5 * lo + 1) * Math.sin(3 * la) + 0.4 * Math.cos(2 * lo - 4 * la) > 0.3;
    const R = 2.15;
    const onSphere = (la: number, lo: number, rad: number) => [rad * Math.cos(la) * Math.cos(lo), rad * Math.sin(la), rad * Math.cos(la) * Math.sin(lo)];
    for (let i = 0; i < n; i++) {
      const kind = i % 10;
      let la = 0, lo = 0, rad = R;
      if (kind < 7) {
        do { la = Math.asin(2 * r() - 1); lo = r() * Math.PI * 2; } while (!land(la, lo));
      } else if (kind < 9) {
        la = (Math.round((r() * 2 - 1) * 6) / 6) * 1.3; lo = r() * Math.PI * 2;
      } else { la = Math.asin(2 * r() - 1); lo = r() * Math.PI * 2; rad = R * (1.12 + r() * 0.05); }
      const p = onSphere(la, lo, rad);
      set(i, p[0], p[1], p[2]);
    }
  } else if (name === 'dna') {
    // Double helix with rungs.
    for (let i = 0; i < n; i++) {
      const y = (r() * 2 - 1) * 3, a = y * 2.1;
      if (i % 4 === 0) {
        const t = r() * 2 - 1, yy = Math.round(y * 3) / 3, aa = yy * 2.1;
        set(i, Math.cos(aa) * t, yy, Math.sin(aa) * t);
      } else {
        const strand = i % 2 ? 0 : Math.PI;
        set(i, Math.cos(a + strand) * 1 + gauss() * 0.05, y, Math.sin(a + strand) * 1 + gauss() * 0.05);
      }
    }
  } else if (name === 'saturn') {
    // A planet with a tilted ring system.
    for (let i = 0; i < n; i++) {
      if (i % 5 < 2) {
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rad = 1.25;
        set(i, rad * Math.sin(ph) * Math.cos(th), rad * Math.cos(ph), rad * Math.sin(ph) * Math.sin(th));
      } else {
        const th = r() * Math.PI * 2, rad = 1.8 + Math.pow(r(), 0.8) * 1.4;
        const x = Math.cos(th) * rad, z = Math.sin(th) * rad, y = gauss() * 0.02;
        const tilt = 0.45;
        set(i, x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt));
      }
    }
  } else if (name === 'wave') {
    // A flowing silk ribbon, used to sweep projects in and out on the portfolio page.
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, v = r() * 2 - 1;
      set(i, u * 4.2, Math.sin(u * 3.1 + v * 1.4) * 0.85 + v * 0.55 + gauss() * 0.03, Math.cos(u * 2.3) * 0.9 + v * 1.1);
    }
  } else if (name === 'galaxy') {
    for (let i = 0; i < n; i++) {
      const arm = i % 3, rad = Math.pow(r(), 0.7) * 3.2;
      const th = rad * 1.5 + (arm / 3) * Math.PI * 2;
      const spread = 0.25 * (1 - rad / 3.6);
      set(i, Math.cos(th) * rad + gauss() * spread, gauss() * 0.12, Math.sin(th) * rad + gauss() * spread);
    }
  } else {
    // ring: a torus portal.
    for (let i = 0; i < n; i++) {
      const u = r() * Math.PI * 2, v = r() * Math.PI * 2, R = 2.2, tube = 0.12 + Math.pow(r(), 3) * 0.35;
      set(i, (R + tube * Math.cos(v)) * Math.cos(u), (R + tube * Math.cos(v)) * Math.sin(u), tube * Math.sin(v));
    }
  }
  return out;
}
