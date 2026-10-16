// The mountains around Cinderfall, painted for the story's backdrops.
//
// A forest of stone pillars stands in clusters round the valley (Zhangjiajie columns: faceted walls stepped by their
// bedding, split by vertical cracks, each crowned with a cap of forest and edged with umbrella pines, a few pines
// leaning out of the cliffs). Behind them, broad ridged massifs with their own pillars at their feet; behind those,
// four painted ranges of pillars and ridges fading into the sky. Banks of mist lie round the feet of every layer and
// thin belts of cloud wrap the pillars' waists, drifting.
//
// The ranges have their own air: near the valley it is the scene's fog, farther out it turns to the clear sky's own
// colour toward the horizon, so each layer sinks a little further into the sky behind it. They take the light of
// whatever the sky is doing: lightning in the deck, the two cultivators fighting above the western ridges, the
// falling star, the burning village.
//
// Placed so every shot has its backdrop: a tall cluster framed by the street to the north, the western ridges (lower,
// so the sky above them is the storm's stage), the ranges behind the village to the south, the towers beyond the crag
// to the east.
import * as THREE from 'three';
import { rng, fbm, smooth, clamp, lerp } from './util.js';
import { heightAt } from './layout.js';
import { U } from './materials.js';
import { SKYCOL, SKY_UNIFORMS } from './sky.js';
import { FOGU } from './atmosphere.js';

const TAU = Math.PI * 2;
const VC = { x: 0, z: -40 };   // the middle of the valley

// the ground the towers stand on: the valley's hills, and the rolling wooded country beyond them (as far-ground)
export function groundAt(x, z) {
  const rr = Math.hypot(x, z + 120);
  return heightAt(x, z) - 1 + (fbm(x * 0.004 + 9, z * 0.004, 3) - 0.5) * 50 * smooth(400, 900, rr);
}

// a growing mesh: positions, colours, indices
function builder() {
  const pos = [], col = [], idx = [];
  return {
    pos, col, idx,
    count: () => pos.length / 3,
    v(x, y, z, c) { pos.push(x, y, z); col.push(c[0], c[1], c[2]); },
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    },
  };
}

// the radius of a polygon (corners sorted by angle) along a ray at angle th
function polyRadius(cs, th) {
  th = ((th % TAU) + TAU) % TAU;
  let k = cs.length - 1;
  for (let i = 0; i < cs.length; i++) if (cs[i].a > th) { k = i - 1; break; }
  if (k < 0) k = cs.length - 1;
  const A = cs[k], Bc = cs[(k + 1) % cs.length];
  const ax = Math.cos(A.a) * A.r, az = Math.sin(A.a) * A.r, bx = Math.cos(Bc.a) * Bc.r, bz = Math.sin(Bc.a) * Bc.r;
  const dx = Math.cos(th), dz = Math.sin(th), ex = bx - ax, ez = bz - az;
  const den = dx * ez - dz * ex;
  return Math.abs(den) < 1e-6 ? A.r : (ax * ez - az * ex) / den;
}
const angDiff = (a, b) => Math.abs((((a - b + Math.PI) % TAU) + TAU) % TAU - Math.PI);

// ---------------------------------------------------------------- one pillar
// A stack of beds: each bed has its own outline (the corners of the column jut and retreat from bed to bed), the
// walls step at every bedding plane, deep clefts run down through several beds, and the summit is uneven. Green
// clings wherever it can: in streaks down the walls, along every step, thick over the summit.
// o: { x, z, H (above its ground), R, seed, seg, rows, near (0 near, 1 mid, 2 far), tone [r,g,b], trees, treeSize }
// F: the foliage lists { puffs, umbrellas, cones } (instances: x, y, z, sx, sy, dir, tilt, c)
function tower(B, F, o) {
  const q = rng(Math.floor(o.seed * 7919) + 17);
  const K = 6 + Math.floor(q() * 4);
  const angs = Array.from({ length: K }, (_, k) => ((((k + q.range(-0.28, 0.28)) / K) * TAU) % TAU + TAU) % TAU).sort((a, b) => a - b);
  const r0 = angs.map(() => q.range(0.78, 1.05));
  const el = q.range(0, 0.35), elA = q() * TAU;
  // beds: [t0, t1), each with its own outline, a little narrower going up
  const nb = 3 + Math.floor(q() * 4);
  const cuts = [0];
  for (let i = 1; i < nb; i++) cuts.push(q.range(0.12, 0.92));
  cuts.sort((a, b) => a - b);
  cuts.push(1);
  const taper = q.range(0.02, 0.22);
  const beds = cuts.slice(0, -1).map((t0, b) => {
    const tm = (t0 + cuts[b + 1]) / 2;
    const w = (1 - taper * tm) * (b === 0 ? 1 : q.range(0.9, 1.04));
    return { t0, t1: cuts[b + 1], cs: angs.map((a, k) => ({ a, r: r0[k] * w * q.range(0.8, 1.15) })), shelf: b > 0 && q() < 0.55 };
  });
  // clefts: deep narrow notches running down through several beds
  const clefts = Array.from({ length: 2 + Math.floor(q() * 4) }, () => ({ a: q() * TAU, w: q.range(0.04, 0.09), d: q.range(0.12, 0.32), t0: q.range(0, 0.5), t1: q.range(0.55, 1.02) }));
  // the summit: rounded, uneven, lower on one side
  const crown = q.range(0.045, 0.09), crownP = q() * TAU, crownA = q.range(0.3, 1.2);
  const leanA = q() * TAU, lean = q.range(0, 0.04) * o.H;
  let lo = Infinity;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; lo = Math.min(lo, groundAt(o.x + Math.cos(a) * o.R * 1.2, o.z + Math.sin(a) * o.R * 1.2)); }
  const base = lo - 25, Htot = o.H + 25;
  const STEP = 0.009;
  const bedAt = t => { let b = 0; while (b < beds.length - 1 && t >= beds[b].t1) b++; return b; };
  const tcAt = th => 1 - crown * (1 + crownA * (0.5 + 0.5 * Math.cos(th - crownP)));
  // the outline's radius (in R) at an angle and a height
  const rAt = (th, t) => {
    const b = bedAt(t), B0 = beds[b];
    let r = polyRadius(B0.cs, th);
    // the step into the next bed is sharp, the beds' outlines otherwise hold
    if (b > 0 && t < B0.t0 + STEP) r = lerp(polyRadius(beds[b - 1].cs, th), r, smooth(B0.t0, B0.t0 + STEP, t));
    const ca = Math.cos(th - elA);
    r *= 1 + el * (ca * ca - 0.5);
    for (const c of clefts) if (t > c.t0 && t < c.t1) r *= 1 - c.d * Math.exp(-((angDiff(th, c.a) / c.w) ** 2)) * smooth(c.t0, c.t0 + 0.04, t) * (1 - smooth(c.t1 - 0.04, c.t1, t));
    r *= 1 + (fbm(th * 2.3 + o.seed, t * 4 + o.seed, 2) - 0.5) * 0.1;
    r *= 1 + Math.max(0, 0.06 - t) * 1.5;
    const tc = tcAt(th);
    if (t > tc) { const u = (t - tc) / (1 - tc); r *= Math.sqrt(Math.max(0, 1 - u * u)); }
    return r;
  };
  let ts = [];
  for (let j = 0; j < o.rows; j++) ts.push(Math.pow(j / (o.rows - 1), 0.9));
  for (const B0 of beds) if (B0.t0 > 0) ts.push(B0.t0 - 0.002, B0.t0 + STEP + 0.001);
  const cTop = 1 - crown * (1 + crownA);
  for (let k = 0; k <= 5; k++) ts.push(cTop + (1 - cTop) * (k / 5) ** 0.7);
  ts = ts.map(t => clamp(t)).sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > 0.0015);
  const seg = o.seg, v0 = B.count(), tone = o.tone;
  const green = [0.035, 0.062, 0.03], moss = [0.07, 0.09, 0.045];
  for (const t of ts) {
    const py = base + t * Htot;
    const b = bedAt(t), B0 = beds[b];
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * TAU;
      const rr = o.R * rAt(th, t);
      const px = o.x + Math.cos(th) * rr + Math.cos(leanA) * lean * t * t;
      const pz = o.z + Math.sin(th) * rr + Math.sin(leanA) * lean * t * t;
      // rock: streaks of wet dark and pale dry stone
      const streak = fbm(th * 5.1 + o.seed * 3, t * 0.9 + o.seed, 3);
      let c = tone.map(v => v * (0.62 + streak * 0.62));
      // green: streaks down the walls, a band along each step, thick over the summit and at the foot
      let veg = smooth(0.5, 0.66, fbm(th * 3.1 + o.seed, t * 6.5 + o.seed * 0.7, 3)) * 0.85;
      veg = Math.max(veg, smooth(0.58, 0.7, fbm(th * 9.7 + o.seed * 1.3, t * 1.4, 2)) * 0.7);
      if (b > 0 && t > B0.t0 && t < B0.t0 + 0.035 + (B0.shelf ? 0.03 : 0)) veg = Math.max(veg, 0.9 * smooth(0.25, 0.5, fbm(th * 6 + o.seed, b * 3.1, 2)));
      if (t > cTop - 0.05) veg = Math.max(veg, smooth(cTop - 0.05, cTop + 0.01, t) * (0.7 + 0.3 * fbm(th * 8, o.seed, 2)));
      if (t < 0.1) veg = Math.max(veg, smooth(0.1, 0.02, t));
      if (veg > 0) {
        const g2 = fbm(th * 7 + o.seed, t * 9, 2);
        const gc = veg > 0.75 ? green : moss;
        c = c.map((v, n) => v + (gc[n] * (0.75 + g2 * 0.55) - v) * veg);
      }
      B.v(px, py, pz, c);
    }
  }
  for (let j = 0; j < ts.length - 1; j++) for (let i = 0; i < seg; i++) {
    const a = v0 + j * seg + i, bb = v0 + j * seg + ((i + 1) % seg), c = a + seg, d = bb + seg;
    B.idx.push(a, c, bb, bb, c, d);
  }
  const top = base + Htot;
  if (!o.trees) return { top, x: o.x, z: o.z, H: o.H };
  // the forest on the summit: crowns over it following its uneven top, smaller ones along the rim (so the outline is
  // tufted, never a hat); umbrella pines leaning out at the edge, a few tall pines standing out of the mass
  const ts0 = o.treeSize, ps = ts0 * 0.8;
  const surfY = (a, f) => { const tc = tcAt(a); return base + (tc + (1 - tc) * Math.sqrt(Math.max(0, 1 - f * f))) * Htot; };
  const rTop = a => o.R * rAt(a, cTop - 0.004);
  const nIn = clamp(Math.round(((o.R * o.R) / (ps * ps)) * 1.7 * o.trees), 3, 44);
  for (let i = 0; i < nIn; i++) {
    const a = q() * TAU, f = Math.sqrt(q()) * 0.85, rho = f * rTop(a);
    const s = ps * q.range(0.8, 1.35);
    // (the canopy domes over the summit)
    F.puffs.push({ x: o.x + Math.cos(a) * rho, y: surfY(a, f) + s * (q.range(-0.05, 0.35) + (1 - f * f) * 0.55), z: o.z + Math.sin(a) * rho, sx: s, sy: s * q.range(0.75, 1.0), dir: q() * TAU, tilt: 0, c: q() });
  }
  const nRim = clamp(Math.round(((TAU * o.R) / (ps * 1.15)) * o.trees), 5, 44);
  for (let i = 0; i < nRim; i++) {
    const a = ((i + q.range(-0.35, 0.35)) / nRim) * TAU, f = q.range(0.84, 1.0), rho = f * rTop(a);
    const s = ps * q.range(0.6, 0.95);
    // (spilling over the edge)
    F.puffs.push({ x: o.x + Math.cos(a) * rho, y: surfY(a, 0.9) - s * q.range(0, 0.55), z: o.z + Math.sin(a) * rho, sx: s, sy: s * q.range(0.75, 1.0), dir: q() * TAU, tilt: 0, c: q() });
  }
  const nU = clamp(Math.round(((TAU * o.R) / (ts0 * 2.6)) * o.trees), 2, 12);
  for (let i = 0; i < nU; i++) {
    const a = q() * TAU, rho = rTop(a) * q.range(0.78, 0.95);
    F.umbrellas.push({ x: o.x + Math.cos(a) * rho, y: surfY(a, 0.85) - ts0 * 0.3, z: o.z + Math.sin(a) * rho, sx: ts0 * q.range(1.0, 1.5), sy: ts0 * q.range(1.0, 1.6), dir: a, tilt: q.range(0.15, 0.6), c: q() });
  }
  const nC = clamp(Math.round(((o.R * o.R) / (ps * ps)) * 0.45 * o.trees), 1, 14);
  for (let i = 0; i < nC; i++) {
    const a = q() * TAU, f = Math.sqrt(q()) * 0.8, rho = f * rTop(a);
    const s = ts0 * q.range(1.2, 2.0);
    F.cones.push({ x: o.x + Math.cos(a) * rho, y: surfY(a, f) - ts0 * 0.15, z: o.z + Math.sin(a) * rho, sx: s * 0.75, sy: s, dir: q() * TAU, tilt: q.range(-0.06, 0.06), c: q() });
  }
  // shrubs along the steps (where a bed is narrower than the one below it, the step is a shelf)
  for (let b = 1; b < beds.length; b++) {
    const B0 = beds[b], t1 = B0.t0 + STEP + 0.002;
    const n = Math.round(((TAU * o.R) / (ps * 2.2)) * o.trees * (B0.shelf ? 1 : 0.45));
    for (let i = 0; i < n; i++) {
      const a = q() * TAU, rIn = o.R * rAt(a, t1), rOut = o.R * rAt(a, B0.t0 - 0.003);
      if (rOut - rIn < ps * 0.12) continue;
      const rho = rIn + (rOut - rIn) * q.range(0.35, 0.8);
      const s = ps * q.range(0.45, 0.8) * (B0.shelf ? 1 : 0.75);
      F.puffs.push({ x: o.x + Math.cos(a) * rho, y: base + t1 * Htot + s * 0.25, z: o.z + Math.sin(a) * rho, sx: s, sy: s * 0.9, dir: q() * TAU, tilt: 0, c: q() * 0.8 });
    }
    if (B0.shelf) for (let i = 0; i < 1 + Math.floor(q() * 2); i++) {
      const a = q() * TAU, rho = o.R * rAt(a, B0.t0 - 0.003) * 0.97;
      F.umbrellas.push({ x: o.x + Math.cos(a) * rho, y: base + t1 * Htot, z: o.z + Math.sin(a) * rho, sx: ts0 * q.range(0.8, 1.2), sy: ts0 * q.range(0.8, 1.2), dir: a, tilt: q.range(0.3, 0.75), c: q() });
    }
  }
  // pines growing straight out of the cliff, the near pillars only
  if (o.near === 0) {
    const nCl = Math.floor(q() * 3.4);
    for (let i = 0; i < nCl; i++) {
      const t = q.range(0.35, 0.85), a = q() * TAU, rho = o.R * rAt(a, t) * 0.95;
      F.umbrellas.push({ x: o.x + Math.cos(a) * rho, y: base + t * Htot, z: o.z + Math.sin(a) * rho, sx: ts0 * q.range(0.8, 1.2), sy: ts0 * q.range(0.8, 1.2), dir: a, tilt: q.range(0.8, 1.3), c: q() });
    }
  }
  return { top, x: o.x, z: o.z, H: o.H };
}

// ---------------------------------------------------------------- a broad ridged massif (a heightfield along its axis)
function massif(B, o) {
  const q = rng(Math.floor(o.seed * 7919) + 5);
  const peaks = Array.from({ length: 3 + Math.floor(q() * 4) }, () => ({ a: q.range(-0.75, 0.75), h: q.range(0.45, 0.95), w: q.range(0.07, 0.22) }));
  peaks[0].h = 1;
  const crest = a => {
    let h = 0.32 * (1 - a * a);
    for (const p of peaks) h = Math.max(h, p.h * Math.exp(-(((a - p.a) / p.w) ** 2)));
    h += (1 - Math.abs(fbm(a * 5 + o.seed, o.seed, 3) * 2 - 1)) * 0.1;
    return h * (1 - Math.pow(Math.abs(a), 6));
  };
  const ca = Math.cos(o.ang), sa = Math.sin(o.ang);
  let lo = Infinity;
  for (let k = 0; k < 9; k++) { const a = (k / 8) * 2 - 1; lo = Math.min(lo, groundAt(o.x + ca * a * o.L * 0.5, o.z + sa * a * o.L * 0.5)); }
  const base = lo - 40;
  const v0 = B.count();
  for (let j = 0; j < o.nc; j++) {
    const c = (j / (o.nc - 1)) * 2 - 1;
    for (let i = 0; i < o.na; i++) {
      const a = (i / (o.na - 1)) * 2 - 1;
      const prof = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(c), 1.5)), 0.65);
      const wob = 1 + (fbm(a * 3 + o.seed, c * 2 + 4, 2) - 0.5) * 0.35;
      const y = base + (40 + o.H * crest(a)) * prof;
      const along = a * o.L * 0.5, across = c * o.W * 0.5 * wob;
      const g = fbm(a * 9 + o.seed, c * 4, 2);
      B.v(o.x + ca * along - sa * across, y, o.z + sa * along + ca * across, [0.06 + g * 0.05, 0.085 + g * 0.06, 0.055 + g * 0.03]);
    }
  }
  for (let j = 0; j < o.nc - 1; j++) for (let i = 0; i < o.na - 1; i++) {
    const a = v0 + j * o.na + i, b = a + 1, c = a + o.na, d = c + 1;
    B.idx.push(a, b, c, b, d, c);
  }
}

// ---------------------------------------------------------------- the colours of the forests far off
// Stands of different trees, each its own green, so the hills read from far away instead of going to one grey-green:
// dark pine, the blue-green of firs, the fresh green of broadleaves in spring, the bright yellow-green of new leaves;
// and, in clumps, the season's colour among them: a grove in blossom, white pear, a red-leaved maple. Linear colours.
const LEAF = [[0.055, 0.125, 0.03], [0.09, 0.17, 0.035], [0.14, 0.23, 0.045], [0.07, 0.115, 0.045]];
const ACCENT = [[0.62, 0.3, 0.38], [0.56, 0.52, 0.47], [0.34, 0.06, 0.035], [0.22, 0.3, 0.05]];
const mixC = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
function crownTint(t, kind) {
  const n = fbm(t.x * 0.0055 + 3.1, t.z * 0.0055 - 1.7, 2), j = t.c;
  if (kind === 'pine') return mixC([0.026, 0.066, 0.03], [0.04, 0.09, 0.034], j);
  if (kind === 'fir') return mixC([0.024, 0.06, 0.05], [0.036, 0.082, 0.066], j);
  // (which stand it is in: the noise of where it grows; then a little of its own)
  const f = n * 3.2, i = Math.min(LEAF.length - 2, Math.floor(f));
  let c = mixC(LEAF[i], LEAF[i + 1], Math.min(1, f - i));
  c = mixC(c, LEAF[Math.floor(j * 3.99)], 0.25);
  const g = fbm(t.x * 0.021 - 7.3, t.z * 0.021 + 2.9, 2);
  if (g > 0.66 && j > 0.35) c = mixC(c, ACCENT[Math.floor(((g - 0.66) * 30 + j * 7) % ACCENT.length)], 0.85);
  return c;
}
function groundTint(x, z, v) {
  const n = fbm(x * 0.0035 + 5.3, z * 0.0035 - 2.1, 3);
  let c = mixC(mixC([0.04, 0.085, 0.032], [0.08, 0.15, 0.035], smooth(0.35, 0.65, n)), [0.12, 0.2, 0.045], smooth(0.68, 0.85, n) * 0.6);
  c = mixC(c, [0.03, 0.07, 0.045], smooth(0.55, 0.3, v) * 0.5);
  const g = fbm(x * 0.013 - 4.4, z * 0.013 + 8.8, 2);
  if (g > 0.7) c = mixC(c, [0.42, 0.22, 0.28], smooth(0.7, 0.8, g) * 0.5);
  return c;
}

// ---------------------------------------------------------------- foliage shapes
function merge(parts) {
  const pos = [], col = [], idx = [];
  let off = 0;
  for (const [g, colorAt] of parts) {
    const p = g.attributes.position, id = g.index.array;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(...colorAt(p.getX(i), p.getY(i), p.getZ(i)));
    }
    for (let i = 0; i < id.length; i++) idx.push(id[i] + off);
    off += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}
// a lumpy crown of foliage, flat underneath, darker below
function puffGeometry(low) {
  const g = new THREE.SphereGeometry(1, low ? 6 : 8, low ? 4 : 5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (fbm(x * 1.7 + 3, z * 1.7 + y * 1.3, 2) - 0.5) * 0.5;
    p.setXYZ(i, x * k, Math.max(y * k, -0.35), z * k);
  }
  return merge([[g, (x, y) => { const k = 0.5 + 0.5 * clamp((y + 0.35) / 1.35); return [k, k, k]; }]]);
}
// the pine of the painted mountains: a crooked trunk and flat pads of needles in tiers
function umbrellaGeometry(low) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.025, 0.05, 1, 5, 3, true);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) + 0.5; tp.setXYZ(i, tp.getX(i) + Math.sin(y * 2.6) * 0.09, y * 0.92, tp.getZ(i)); }
  parts.push([trunk, () => [0.55, 0.42, 0.32]]);
  const pads = [[0.14, 0.92, 0.0, 0.62], [-0.2, 0.74, 0.08, 0.5], [0.22, 0.58, -0.06, 0.42], [0.02, 1.04, 0.02, 0.36]];
  for (const [x, y, z, r] of pads) {
    const g = new THREE.SphereGeometry(1, low ? 6 : 8, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, x + p.getX(i) * r * (1 + (fbm(p.getX(i) * 2 + y * 9, p.getZ(i) * 2, 2) - 0.5) * 0.5), y + p.getY(i) * r * 0.24, z + p.getZ(i) * r * 0.8);
    parts.push([g, (px, py) => { const k = py > y ? 1 : 0.55; return [k, k, k]; }]);
  }
  return merge(parts);
}
// a tall pine standing out of the cap: three tiers and a trunk
function coneGeometry() {
  const parts = [];
  const tier = (y0, y1, r) => { const g = new THREE.ConeGeometry(r, y1 - y0, 7, 1, false); g.translate(0, (y0 + y1) / 2, 0); return g; };
  parts.push([new THREE.CylinderGeometry(0.035, 0.05, 0.42, 5, 1, true).translate(0, 0.21, 0), () => [0.5, 0.4, 0.32]]);
  for (const [y0, y1, r] of [[0.18, 0.62, 0.34], [0.42, 0.86, 0.26], [0.64, 1.06, 0.17]]) parts.push([tier(y0, y1, r), (x, y) => { const k = 0.55 + 0.45 * clamp((y - y0) / (y1 - y0)); return [k, k, k]; }]);
  return merge(parts);
}

// ---------------------------------------------------------------- the air and the light the ranges share
// uRangeAir: x: haze per metre beyond the valley, y: haze per square kilometre, z: haze ceiling, w: distance by which
// the clear sky's colour has taken over the haze. uRangeMist: x: the mist's top (world y), y: its depth (m), z: how
// thick, w: how much the burning village lights the inner walls
const RANGE_U = {
  uRangeAir: { value: new THREE.Vector4(0.00022, 0.11, 0.93, 1700) },
  uRangeMist: { value: new THREE.Vector4(225, 70, 0.85, 0.5) },
  uRangeMistC: { value: new THREE.Color(0.8, 0.82, 0.86) },
};
const EVENTS = `
uniform vec3 uFlashPos, uFlashCol, uC1, uC2, uStarPos, uFireC, uRangeMistC; uniform float cfTimeR; uniform float uFlash, uClash, uStarK; uniform vec4 uRangeAir, uRangeMist;
// the light the sky throws on the ranges (irradiance; n: the surface's world normal)
vec3 rangeEvents(vec3 p, vec3 n){
  vec3 L = vec3(0.);
  vec3 d = uFlashPos - p; float l = max(length(d), 1.);
  L += uFlashCol * uFlash * exp(-l / 2600.) * max(dot(n, d / l), 0.) * .9;
  if (uClash > 0.) {
    d = uC1 - p; l = max(length(d), 1.); L += vec3(1., .66, .22) * uClash * exp(-l / 3000.) * max(dot(n, d / l), 0.) * .5;
    d = uC2 - p; l = max(length(d), 1.); L += vec3(.62, .26, 1.) * uClash * exp(-l / 3000.) * max(dot(n, d / l), 0.) * .7;
  }
  if (uStarK > 0.) { d = uStarPos - p; l = max(length(d), 1.); L += vec3(1., .78, .45) * uStarK * exp(-l / 2600.) * max(dot(n, d / l), 0.) * .9; }
  if (uFireGlow > 0.) { vec3 f = vec3(uFireC.x, p.y * .3, uFireC.z) - p; float lf = max(length(f), 1.); L += uFireCol * uFireGlow * uRangeMist.w * exp(-lf / 1500.) * (.1 + .9 * max(dot(n, f / lf), 0.)); }
  return L;
}
// the ring of light the strike drives out over the land: a thin bright front, a glow fading behind it
float cfRingRagR( vec2 d ) { float t = atan( d.y, d.x ); return 40.0 * ( sin( 3.0 * t + 1.3 ) * 0.5 + sin( 7.0 * t + 0.2 ) * 0.3 + sin( 13.0 * t + 2.1 ) * 0.2 ); }
vec3 cfRingLight(float x, float amt, float n){
  // (a thin hot line along the ground with a softer glow about it, and a warm afterglow fading behind)
  float front = exp(-x * x / (9. * 9.)) + exp(-x * x / (38. * 38.)) * .22;
  float trail = x < 0. ? exp(x / 70.) * .14 : 0.;
  return (vec3(1., .82, .6) * front * (.7 + .5 * n) + vec3(1., .55, .25) * trail) * amt * .32;
}
// the mist lying in the country round the valley, out of which the pillars rise: a drifting, uneven top
float rangeMistK(vec3 p){
  float n = texture2D(uNoise, p.xz * .00042 + vec2(cfTimeR * .00035, 0.)).r;
  float n2 = texture2D(uNoise, p.xz * .0017 - vec2(0., cfTimeR * .0005)).g;
  float n3 = texture2D(uNoise, p.xz * .0051 + vec2(cfTimeR * .0008, 0.)).a;
  float top = uRangeMist.x + (n - .5) * uRangeMist.y * 2.6 + (n2 - .5) * uRangeMist.y * 1.1 + (n3 - .5) * uRangeMist.y * .35;
  float k = smoothstep(top + uRangeMist.y * .25, top - uRangeMist.y * .8, p.y);
  return k * uRangeMist.z * smoothstep(420., 900., length(p.xz - vec2(0., -40.)));
}
// aerial perspective: the scene's fog near the valley, then the clear sky's own colour toward the horizon
vec3 rangeAir(vec3 col, vec3 p, float sceneOD, vec3 sceneCol){
  vec3 rd = p - cameraPosition; float dist = length(rd); rd /= max(dist, 1e-3);
  float mk = rangeMistK(p);
  // (at night the mist glows with the burning village under it)
  vec3 mcol = uRangeMistC * (.86 + .14 * mk) + uFireCol * uFireGlow * .3 * exp(-length(p.xz - uFireC.xz) / 1100.);
  col = mix(col, mcol, mk);
  float km = dist * .001;
  float od = mix(sceneOD, uRangeAir.x * dist + uRangeAir.y * km * km, smoothstep(350., 1100., dist));
  float k = (1. - exp(-od)) * uRangeAir.z;
  vec3 hz = skyColor(normalize(vec3(rd.x, max(rd.y, .015), rd.z)));
  return mix(col, mix(sceneCol, hz, smoothstep(300., uRangeAir.w, dist)), k);
}`;
const SKY_KEYS = ['uSunDir', 'uSunCol', 'uZenith', 'uHorizon', 'uGround', 'uCloudLit', 'uCloudShade', 'uFireDir', 'uFireCol', 'uMoonDir', 'uMoonCol', 'uSunVis', 'uFireGlow',
  'uFlashPos', 'uFlashCol', 'uC1', 'uC2', 'uStarPos', 'uFireC', 'uFlash', 'uClash', 'uStarK'];
const shareSky = (target, skyU) => { for (const k of SKY_KEYS) target[k] = skyU[k]; Object.assign(target, RANGE_U); target.cfTimeR = U.uTime; target.cfDark = FOGU.cfDark; target.cfRing = FOGU.cfRing; return target; };

function rangeMaterial(kind, skyU) {
  // (the sky's light reaches them, but less than it reaches the valley: lit by the whole bright sky they turn to glass)
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.3 });
  m.onBeforeCompile = sh => {
    shareSky(sh.uniforms, skyU);
    sh.uniforms.uNoise = U.uNoise;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW; varying vec3 vRN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
#ifdef USE_INSTANCING
vRW = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz; vRN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
vRW = (modelMatrix * vec4(transformed, 1.)).xyz; vRN = normalize(mat3(modelMatrix) * objectNormal);
#endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vRW; varying vec3 vRN; uniform sampler2D uNoise;
${SKY_UNIFORMS}
${SKYCOL}
${EVENTS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${kind === 'rock' ? `
      {
        // sandstone: fine vertical flutes and dark seams down the walls, the bedding in thin level bands
        vec3 nn = normalize(vRN);
        float wx = abs(nn.x) / (abs(nn.x) + abs(nn.z) + 1e-3);
        vec2 sa = vec2(vRW.z * .03, vRW.y * .0042), sb = vec2(vRW.x * .03 + .5, vRW.y * .0042);
        float fa = texture2D(uNoise, sa).r * .6 + texture2D(uNoise, sa * vec2(3.3, 1.6) + .37).g * .4;
        float fb = texture2D(uNoise, sb).r * .6 + texture2D(uNoise, sb * vec2(3.3, 1.6) + .37).g * .4;
        float fl = clamp((mix(fb, fa, wx) - .5) * 2.4 + .5, 0., 1.);
        float up = clamp(nn.y, 0., 1.);
        float wall = 1. - smoothstep(.35, .7, up);
        diffuseColor.rgb *= mix(1., .66 + fl * .62, wall);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .42, smoothstep(.3, .14, fl) * wall * .75);
        float bed = texture2D(uNoise, vec2(vRW.y * .021, (vRW.x + vRW.z) * .0007)).a;
        diffuseColor.rgb *= 1. - smoothstep(.62, .8, bed) * .22 * wall;
        // anything flat enough holds earth and green
        float veg = smoothstep(.55, .8, up + (texture2D(uNoise, vRW.xz * .013).a - .5) * .5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.05, .09, .045) * (.8 + fl * .45), veg * .85);
        // the turning edges darker: a pillar reads as a column even lit from the front
        float fres = 1. - abs(dot(nn, normalize(cameraPosition - vRW)));
        diffuseColor.rgb *= 1. - .38 * smoothstep(.5, .95, fres) * wall;
      }` : kind === 'ground' ? `
      {
        // the wooded country: crowns of trees (dark gaps between lit tops), paler and yellower stands, rock on the steeps
        vec2 cp = vRW.xz;
        float c1 = texture2D(uNoise, cp * .043).a, c2 = texture2D(uNoise, cp * .012 + .3).g, c3 = texture2D(uNoise, cp * .0023 + .7).r;
        float crown = smoothstep(.3, .78, c1 * .55 + c2 * .45);
        // (seen close, from the air: single crowns, finer, the gaps between them less deep)
        float near = 1. - smoothstep(260., 760., length(vRW - cameraPosition));
        if (near > 0.) {
          float cf = texture2D(uNoise, cp * .17 + .19).a * .5 + texture2D(uNoise, cp * .071 + .61).g * .25 + c2 * .25;
          crown = mix(crown, smoothstep(.32, .72, cf), near * .85);
        }
        diffuseColor.rgb *= mix(.5 + .75 * crown, .66 + .5 * crown, near);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.2, 1.08, .75), smoothstep(.55, .75, c3) * .55);
        float up = clamp(normalize(vRN).y, 0., 1.);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.2, .19, .17) * (.7 + .5 * c1), smoothstep(.8, .6, up) * .55);
      }` : kind === 'pine' ? `
      // needles: lighter where they face the sky
      diffuseColor.rgb *= .78 + .4 * clamp(normalize(vRN).y, 0., 1.);` : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * rangeEvents(vRW, normalize(vRN));`)
      // (the open sky fills their shadowed faces less than it fills the valley's: they keep their form far off)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= .5;`)
      .replace('#include <fog_fragment>', `#ifdef USE_FOG
      {
        vec3 cfRd = vFogWorld - cameraPosition;
        float cfDist = length(cfRd);
        cfRd /= max(cfDist, 1e-4);
        #ifdef FOG_EXP2
          float cfOD = fogDensity * fogDensity * vFogDepth * vFogDepth;
        #else
          float cfOD = 0.;
        #endif
        cfOD += cfFogX.w * cfDist;
        vec3 cfCol = fogColor;
        if (cfFogH.w > 0.0) cfCol += cfFogSunCol * cfFogX.x * pow(max(dot(cfRd, cfFogSunDir), 0.0), cfFogH.w);
        gl_FragColor.rgb = rangeAir(gl_FragColor.rgb, vFogWorld, cfOD, cfCol);
        if (cfDark.w > 0. || cfRing.y > 0.) {
          float dd = length(vFogWorld.xz - cfDark.xy);
          float rag = (texture2D(uNoise, vFogWorld.xz * .0021 + .31).r - .5) * 240. + (texture2D(uNoise, vFogWorld.xz * .009).g - .5) * 70.;
          gl_FragColor.rgb *= 1. - cfDark.w * .45 * smoothstep(cfDark.z + 200., cfDark.z - 200., dd + rag);
          gl_FragColor.rgb += cfRingLight(dd + cfRingRagR(vFogWorld.xz - cfDark.xy) * min(1., cfRing.x / 300.) - cfRing.x, cfRing.y, texture2D(uNoise, vFogWorld.xz * .015).a);
        }
      }
#endif
${kind === 'pine' ? 'gl_FragColor.a = .97;' : ''}`);
  };
  m.customProgramCacheKey = () => 'cf-range2-' + kind;
  return m;
}

// ---------------------------------------------------------------- the painted ranges beyond (unlit, cut from the sky)
const FAR_VS = `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FAR_FS = `uniform sampler2D uNoise; uniform vec3 uTone, uMistC; uniform float uSeed, uCells, uTall, uHazeL, uMist; uniform vec4 cfDark, cfRing;
varying vec2 vUv; varying vec3 vW;
${SKY_UNIFORMS}
${SKYCOL}
${EVENTS}
float h1(float n){ return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
// a forest of pillars in clumps (one per cell, some cells empty); returns the tallest at x and where across it x is
vec2 pillars(float x, float cells, float seed, float tall){
  vec2 best = vec2(0.);
  float c = floor(x * cells);
  for (int k = -2; k <= 2; k++) {
    float id = c + float(k), idm = mod(id, cells);
    float grp = smoothstep(.4, .62, texture2D(uNoise, vec2(idm / cells * 4., seed * .071 + .5)).r);
    float cx = (id + .2 + .6 * h1(idm * 2.11 + seed)) / cells;
    float w = (.14 + .3 * h1(idm * 3.7 + seed)) / cells;
    float th = tall * grp * (.3 + .7 * pow(h1(idm * 1.37 + seed), 1.3));
    float s = (x - cx) / w;
    float a = abs(s);
    if (a < 1.) {
      float hh = th * (1. - .07 * a * a) * clamp((1. - a) * 9., 0., 1.);
      if (hh > best.x) best = vec2(hh, s);
    }
  }
  return best;
}
void main(){
  float x = vUv.x, y = vUv.y;
  // a long range behind: big swells, a ridged crest, a few great peaks
  float rg = .12 + .06 * sin(6.2831853 * x * 3. + uSeed) + .05 * sin(6.2831853 * x * 8. + uSeed * 1.7)
    + (texture2D(uNoise, vec2(x * 13., uSeed * .13)).r - .5) * .24
    + (1. - abs(texture2D(uNoise, vec2(x * 41., uSeed * .29 + .3)).g * 2. - 1.)) * .05;
  float pk = texture2D(uNoise, vec2(x * 6., uSeed * .19 + .6)).r;
  rg += pow(max(pk - .56, 0.) / .44, 1.4) * uTall * .75;
  vec2 pa = pillars(x, uCells, uSeed, uTall), pb = pillars(x, uCells * 2.3, uSeed + 7., uTall * .62);
  vec2 pl = pa.x > pb.x ? pa : pb;
  float r = max(rg, pl.x);
  float onP = step(rg, pl.x);
  // the forest on the crowns: a fine tufted edge, coarser on the pillars' caps
  r += (texture2D(uNoise, vec2(x * 640., uSeed * .17)).a - .5) * .009 + (texture2D(uNoise, vec2(x * 230., .7 + uSeed * .01)).g - .5) * (.01 + .012 * onP);
  float aa = fwidth(y) * 1.2;
  float a = 1. - smoothstep(r - aa, r + aa, y);
  if (a < .003) discard;
  float up = clamp(y / max(r, .03), 0., 1.);
  vec3 rd = normalize(vW - cameraPosition);
  vec3 hz = skyColor(normalize(vec3(rd.x, .015 + .08 * y, rd.z)));
  // this layer's distance in the air, more toward the foot (the mist it stands in)
  float hk = clamp(uHazeL + (1. - up) * .1, 0., 1.);
  vec3 rad = normalize(vec3(vW.x, 0., vW.z)), tg = vec3(rad.z, 0., -rad.x);
  vec3 sunH = normalize(vec3(uSunDir.x, 0., uSunDir.z) + 1e-4);
  float sunT = dot(tg, sunH), front = max(-dot(rad, sunH), 0.), back = max(dot(rad, sunH), 0.);
  // the pillars are lit on the side toward the sun, the ridges on the slopes facing it
  float side = onP * smoothstep(.0, .85, pl.y * sign(sunT)) * abs(sunT);
  vec3 body = uTone * (1. + (side * 1.4 + front * .6) * uSunVis);
  body += uTone * rangeEvents(vec3(vW.x, y * 500., vW.z), -rad) * .6;
  vec3 col = mix(body, hz, hk);
  // a darker top edge (each layer reads against the one behind), a bright rim when the sun is behind them
  float edge = smoothstep(r - .04, r - .004, y);
  col *= 1. - edge * .1 * (1. - hk);
  col += uSunCol * uSunVis * edge * back * back * .35 * (1. - hk * .5);
  // the mist at its feet
  col = mix(col, uMistC, (1. - smoothstep(.0, .5, up)) * uMist);
  if (cfDark.w > 0. || cfRing.y > 0.) {
    float dd = length(vW.xz - cfDark.xy);
    col *= 1. - cfDark.w * .62 * smoothstep(cfDark.z + 260., cfDark.z - 260., dd);
    col += cfRingLight(dd + cfRingRagR(vW.xz - cfDark.xy) * min(1., cfRing.x / 300.) - cfRing.x, cfRing.y, .5) * .6;
  }
  gl_FragColor = vec4(col, a);
}`;

export function createRanges(quality, skyU) {
  const low = quality.low;
  const r = rng(4242);
  const group = new THREE.Group();
  group.name = 'ranges';
  group.userData.U = RANGE_U;
  // (in sectors round the valley, so whatever is behind the camera is culled)
  const NS = 8, tops = [];
  const sectorOf = (x, z) => Math.floor((((Math.atan2(z - VC.z, x - VC.x) / TAU) % 1) + 1) % 1 * NS) % NS;
  const Bs = Array.from({ length: NS }, builder);
  const Fs = Array.from({ length: NS }, () => ({ puffs: [], umbrellas: [], cones: [] }));
  const TONES = [[0.25, 0.23, 0.195], [0.23, 0.225, 0.205], [0.27, 0.24, 0.195], [0.215, 0.21, 0.195]];

  // clusters: [x, z, count, spread, hMin, hMax, rMin, rMax, layer]
  const CL = [
    // north: behind the gate and the pines, a tall cluster framed by the street, others to either side
    [-420, -980, 13, 170, 170, 340, 18, 44, 0], [380, -1060, 14, 190, 190, 370, 18, 46, 0],
    [-60, -1520, 18, 270, 280, 540, 26, 64, 1], [700, -1720, 13, 230, 250, 470, 28, 62, 1], [-780, -1680, 13, 230, 250, 470, 28, 62, 1],
    // west: the ridges the storm and the falling star come over, kept lower so the sky above them is the stage
    [-760, -420, 11, 160, 130, 260, 18, 40, 0], [-1250, -140, 14, 250, 200, 330, 26, 54, 1],
    // south-west
    [-700, 540, 12, 200, 150, 290, 18, 42, 0], [-1320, 1180, 14, 270, 230, 420, 28, 58, 1],
    // south: behind the village, seen from the pines
    [-280, 920, 11, 170, 160, 320, 18, 42, 0], [330, 1000, 12, 180, 170, 350, 18, 44, 0], [0, 1580, 16, 290, 280, 520, 28, 64, 1],
    // east: beyond the crag
    [780, -340, 12, 190, 160, 330, 18, 44, 0], [920, 320, 11, 180, 150, 300, 18, 42, 0], [1280, -780, 14, 250, 240, 440, 28, 58, 1], [1520, 220, 13, 240, 240, 420, 28, 56, 1],
  ];
  const placeTower = (p, layer, extra = {}) => tower(Bs[sectorOf(p.x, p.z)], Fs[sectorOf(p.x, p.z)], {
    x: p.x, z: p.z, H: p.H, R: p.R, seed: r() * 1000, near: layer,
    seg: layer === 0 ? (low ? 18 : 28) : layer === 1 ? (low ? 14 : 20) : low ? 10 : 14,
    rows: layer === 0 ? (low ? 12 : 20) : layer === 1 ? (low ? 9 : 14) : low ? 7 : 9,
    tone: TONES[Math.floor(r() * TONES.length)], trees: low ? 0.55 : 1, treeSize: layer === 0 ? r.range(9, 12) : layer === 1 ? r.range(14, 19) : r.range(22, 28),
    ...extra,
  });
  for (const [cx, cz, n, spread, hMin, hMax, rMin, rMax, layer] of CL) {
    const placed = [];
    const count = low ? Math.ceil(n * 0.7) : n;
    let tries = 0;
    while (placed.length < count && tries < 500) {
      tries++;
      const a = r() * TAU, d = Math.sqrt(r()) * spread;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * 0.8;
      // slender needles and broad columns side by side
      const R = (r() < 0.3 ? r.range(rMin * 0.7, rMin * 1.2) : r.range(rMin, rMax)) * (1 - 0.25 * d / spread);
      if (placed.some(p => Math.hypot(p.x - x, p.z - z) < (p.R + R) * 0.82)) continue;
      // taller toward the cluster's heart, with a few spires
      const H = (hMin + (hMax - hMin) * (1 - 0.6 * d / spread) * r.range(0.4, 1.05)) * (r() < 0.2 ? 1.25 : 1);
      placed.push({ x, z, R, H });
      // sometimes a pillar splits near the top into two (a lesser spire grown against it)
      for (let k = 0; k < 2; k++) if (r() < 0.3) {
        const a2 = r() * TAU, R2 = R * r.range(0.4, 0.68);
        placed.push({ x: x + Math.cos(a2) * (R + R2) * 0.6, z: z + Math.sin(a2) * (R + R2) * 0.6, R: R2, H: H * r.range(0.55, 0.9) });
      }
    }
    let best = null;
    for (const p of placed) {
      const t = placeTower(p, layer);
      if (!best || t.top > best.top) best = t;
    }
    if (best) tops.push(new THREE.Vector3(best.x, best.top, best.z));
  }
  // behind everything: great table mountains (the same stacked beds, broad as plateaus), their edges broken into
  // pillars standing at their feet
  const nM = low ? 9 : 14;
  for (let i = 0; i < nM; i++) {
    const a = (i / nM) * TAU + r.range(-0.15, 0.15), d = r.range(2100, 2450);
    const x = Math.cos(a) * d + VC.x, z = Math.sin(a) * d + VC.z;
    // (lower in the west, where the storm and the star are the show)
    const west = smooth(-600, -1800, x) * smooth(-900, 900, z);
    const H = r.range(380, 620) * (1 - west * 0.4), R = r.range(110, 190);
    placeTower({ x, z, R, H }, 2, { seg: low ? 18 : 30, rows: low ? 10 : 16, treeSize: r.range(28, 36) });
    for (let k = 0; k < (low ? 3 : 6); k++) {
      const off = r.range(-1, 1) * R * 2.2, inward = R * r.range(1.0, 1.9);
      const px = x - Math.cos(a) * inward - Math.sin(a) * off, pz = z - Math.sin(a) * inward + Math.cos(a) * off;
      placeTower({ x: px, z: pz, R: r.range(24, 55), H: H * r.range(0.45, 0.85) }, 2);
    }
  }
  const rockMat = rangeMaterial('rock', skyU);
  const rock = [];
  for (const B of Bs) {
    if (!B.count()) continue;
    const m = new THREE.Mesh(B.geometry(), rockMat);
    m.name = 'ranges-rock';
    group.add(m);
    rock.push(m);
  }

  // the forest on and around them
  const pineMat = rangeMaterial('pine', skyU);
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), q2 = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), cc = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), ax = new THREE.Vector3();
  const instanced = (geo, list, name, tint) => {
    const mesh = new THREE.InstancedMesh(geo, pineMat, Math.max(1, list.length));
    mesh.count = list.length;
    list.forEach((t, i) => {
      // tilt outward (cliff pines lean out over the drop), then a turn about their own axis
      ax.set(-Math.sin(t.dir), 0, Math.cos(t.dir));
      qt.setFromAxisAngle(ax, -t.tilt);
      q2.setFromAxisAngle(up, t.dir * 1.7 + t.c * 6);
      qt.multiply(q2);
      ps.set(t.x, t.y, t.z); sc.set(t.sx, t.sy, t.sx);
      m4.compose(ps, qt, sc);
      mesh.setMatrixAt(i, m4);
      cc.setRGB(...tint(t));
      mesh.setColorAt(i, cc);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };
  const puffGeo = puffGeometry(low), umbrellaGeo = umbrellaGeometry(low), coneGeo = coneGeometry();
  const puffs = [], umbrellas = [], cones = [];
  for (const F of Fs) {
    if (F.puffs.length) puffs.push(instanced(puffGeo, F.puffs, 'ranges-crowns', t => crownTint(t, 'leaf')));
    if (F.umbrellas.length) umbrellas.push(instanced(umbrellaGeo, F.umbrellas, 'ranges-pines', t => crownTint(t, 'pine')));
    if (F.cones.length) cones.push(instanced(coneGeo, F.cones, 'ranges-firs', t => crownTint(t, 'fir')));
  }

  // the rolling wooded country between the valley and the ranges
  {
    const NR = low ? 30 : 46, NA = low ? 200 : 320, pos = [], col = [], idx = [];
    for (let j = 0; j < NR; j++) {
      const rr = 260 * Math.pow(3500 / 260, j / (NR - 1));
      for (let i = 0; i < NA; i++) {
        const a = (i / NA) * TAU, x = Math.cos(a) * rr, z = Math.sin(a) * rr - 120;
        const inside = Math.abs(x) < 330 && z > -610 && z < 290;
        const y = heightAt(x, z) - (inside ? 6 : 1) + (fbm(x * 0.004 + 9, z * 0.004, 3) - 0.5) * 50 * smooth(400, 900, rr);
        pos.push(x, y, z);
        const v = fbm(x * 0.012, z * 0.012, 3);
        col.push(...groundTint(x, z, v));
      }
    }
    for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NA; i++) {
      const a0 = j * NA + i, a1 = j * NA + ((i + 1) % NA), b0 = a0 + NA, b1 = a1 + NA;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, rangeMaterial('ground', skyU));
    ground.name = 'far-ground';
    group.add(ground);
  }

  // the painted ranges beyond: four rings of pillars and ridges, each farther into the air
  const layers = [];
  [[2780, 330, 1, 34, 1.0, 0.5], [3020, 420, 2, 26, 0.95, 0.6], [3260, 500, 3, 20, 0.9, 0.7], [3480, 560, 4, 15, 0.85, 0.78]].forEach(([dist, h, i, cells, tall, haze]) => {
    const g = new THREE.CylinderGeometry(dist, dist, h, 384, 1, true);
    g.translate(0, h / 2 - 40, 0);
    const uniforms = shareSky({
      uTone: { value: new THREE.Color(0.1, 0.11, 0.1) }, uMistC: { value: new THREE.Color(0.8, 0.8, 0.82) }, uSeed: { value: i * 7.31 }, uCells: { value: cells }, uTall: { value: tall },
      uHazeL: { value: haze }, uMist: { value: 0.5 }, uNoise: U.uNoise,
    }, skyU);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms, vertexShader: FAR_VS, fragmentShader: FAR_FS,
    });
    const m = new THREE.Mesh(g, mat);
    m.name = 'range-' + i;
    m.frustumCulled = false;
    m.userData.haze = haze;
    m.userData.dist = dist;
    group.add(m);
    layers.push(m);
  });
  layers.slice().reverse().forEach((m, k) => (m.renderOrder = -9 + k));

  const hor = new THREE.Color(), tmp = new THREE.Color();
  const air = RANGE_U.uRangeAir.value, mistU = RANGE_U.uRangeMist.value;
  return {
    group, layers, tops, rock, pines: umbrellas, puffs, cones,
    counts: { verts: rock.reduce((n, m) => n + m.geometry.attributes.position.count, 0), puffs: Fs.reduce((n, F) => n + F.puffs.length, 0), umbrellas: Fs.reduce((n, F) => n + F.umbrellas.length, 0), cones: Fs.reduce((n, F) => n + F.cones.length, 0) },
    // per frame: the air and the light of the moment
    update({ fog, horizon, sunVis, mist, fireGlow, storm, night }) {
      // thicker air in the storm and at night (the ranges go to silhouettes against the sky)
      // (by day clear enough that the forests keep their colours far out and the ranges stand along the horizon)
      air.set(lerp(lerp(0.00012, 0.00032, storm), 0.0004, night), lerp(0.05, 0.16, Math.max(storm, night)), lerp(0.84, 0.93, Math.max(storm, night)), lerp(1900, 1300, storm));
      hor.setRGB(horizon[0], horizon[1], horizon[2]);
      // the mist: the clouds' own light (warm white by day, the storm's slate, the fire's red at night)
      const mc = RANGE_U.uRangeMistC.value;
      mc.copy(skyU.uCloudLit.value).multiplyScalar(0.62 + 0.38 * sunVis).lerp(hor, 0.3);
      if (fireGlow > 0) mc.add(tmp.copy(skyU.uFireCol.value).multiplyScalar(fireGlow * 0.05));
      mistU.set(225 + 25 * storm, 70, clamp(0.55 + mist * 1.6) * (1 - night * 0.3), 0.5);
      // the painted ranges: dark rock and forest, as hazed as their distance; mist at their feet
      layers.forEach(l => {
        const u2 = l.material.uniforms, d = l.userData.dist, km = d * 0.001;
        u2.uTone.value.setRGB(0.05, 0.095, 0.055).multiplyScalar(1 - night * 0.6).lerp(tmp.setRGB(fog[0], fog[1], fog[2]), 0.12);
        u2.uHazeL.value = (1 - Math.exp(-(air.x * d + air.y * km * km))) * air.z;
        u2.uMistC.value.copy(mc).lerp(hor, 0.3);
        u2.uMist.value = clamp(0.45 + mist) * (1 - night * 0.4);
      });
    },
  };
}
