// Bamboo grove: instanced culms (nodes, waxy rings, a slight lean and curve) with thin side branches and drooping
// sprays of lanceolate leaves high up. A dense grove reads as a wall of vertical lines with feathery tops.
import * as THREE from 'three';
import { GeoBuf, card, gridNormals, gridIndex, rng, clamp, lerp, smooth, V3, TAU, instancedOf, sweep } from './flora-core.js';
import { floraMaterials } from './flora-mats.js';
import { cellRect } from './flora-tex.js';

const UP = V3(0, 1, 0);

// one culm variant (height H at scale 1): culm + branches in `B` (culm material), leaf sprays in `F`
function culmVariant(seed, H, rad, detailed, ringStep = 0.55) {
  const r = rng(seed);
  const B = new GeoBuf(), F = new GeoBuf();
  const bend = 0.6 + r() * 0.8, bdir = r() * TAU;
  const cl = y => { const t = y / H; const b = bend * t * t * H * 0.055; return V3(Math.cos(bdir) * b, y, Math.sin(bdir) * b); };
  const swayAt = y => Math.pow(clamp(y / H), 1.6) * 1.7;
  // nodes: short internodes at the base, longest at mid height
  const nodes = [0];
  while (nodes[nodes.length - 1] < H) { const y = nodes[nodes.length - 1]; nodes.push(y + lerp(0.16, 0.42, smooth(0, H * 0.35, y)) * lerp(1, 0.75, smooth(H * 0.6, H, y))); }
  const radAt = y => rad * (1 - 0.72 * Math.pow(clamp(y / H), 1.3)) * (1 + 0.12 * Math.exp(-y / 0.25));
  const rings = [];
  if (detailed) {
    for (let k = 0; k < nodes.length - 1; k++) {
      const a = nodes[k], b = Math.min(H, nodes[k + 1]), L = b - a;
      for (const [f, bulge] of [[0, 1.075], [0.08, 1.0], [0.9, 0.99]]) rings.push([a + L * f, bulge, k + f]);
      if (b >= H) break;
    }
  } else {
    let k = 0;
    for (let y = 0; y <= H; y += ringStep) { while (k < nodes.length - 2 && nodes[k + 1] < y) k++; rings.push([y, 1, k + (y - nodes[k]) / (nodes[k + 1] - nodes[k])]); }
  }
  rings.push([H, 1, nodes.length - 1]);
  const cols = detailed ? 8 : 6;
  const b0 = B.count;
  for (const [y, bulge, vv] of rings) {
    const c = cl(y), rr = radAt(y) * bulge;
    for (let j = 0; j <= cols; j++) {
      const a = (j / cols) * TAU;
      const cx = Math.cos(a), cz = Math.sin(a);
      const ao = 0.8 + 0.2 * smooth(0, 1.5, y);
      B.v(c.x + cx * rr, y, c.z + cz * rr, cx, 0, cz, j / cols, vv, ao, ao, ao, swayAt(y), 0);
    }
  }
  gridNormals(B, b0, rings.length - 1, cols, true);
  gridIndex(B, b0, rings.length - 1, cols);
  // branches and leaf sprays from the upper nodes
  const rects = [cellRect('bambooA'), cellRect('bambooB')];
  let side = r() * TAU;
  for (let k = 1; k < nodes.length; k++) {
    const y = nodes[k];
    if (y < H * 0.42 || y > H * 0.985) continue;
    const t = (y - H * 0.42) / (H * 0.58);
    side += Math.PI + (r() - 0.5) * 0.9;
    const nb = r() < 0.4 ? 2 : 1;
    for (let q = 0; q < nb; q++) {
      const az = side + q * 0.5;
      const len = (0.45 + 0.9 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.1))) * (0.8 + r() * 0.4);
      const p0 = cl(y);
      const out = V3(Math.cos(az), 0, Math.sin(az));
      const tip = p0.clone().addScaledVector(out, len).add(V3(0, len * (0.55 - t * 0.35), 0));
      const mid = p0.clone().lerp(tip, 0.5).add(V3(0, len * 0.08, 0));
      const sw0 = swayAt(y);
      sweep(B, [p0, mid, tip], { radial: 3, segments: 1, radius: tt => 0.006 + 0.004 * (1 - tt), color: () => [0.9, 0.9, 0.8], uRep: 0.2, vScale: 0.5, sway: tt => sw0 + tt * 0.25 });
      const nc = 2 + Math.floor(r() * 3);
      for (let i = 0; i < nc; i++) {
        const tt = 0.45 + 0.55 * i / Math.max(1, nc - 1);
        const at = p0.clone().lerp(tip, tt);
        const yaw = az + (r() - 0.5) * 1.6;
        const o2 = V3(Math.cos(yaw), 0, Math.sin(yaw));
        const ay = o2.clone().multiplyScalar(0.75).add(V3(0, -0.15 - r() * 0.55, 0)).normalize();
        const ax = V3().crossVectors(ay, UP).normalize().applyAxisAngle(ay, (r() - 0.5) * 1.0);
        const size = 0.55 + r() * 0.35;
        const nrm = o2.clone().multiplyScalar(0.6).add(V3(0, 0.75, 0)).normalize();
        const shade = 0.7 + 0.3 * t;
        card(F, at, ax, ay, size * 0.85, size, rects[r() < 0.5 ? 0 : 1], nrm, [shade * 0.95, shade, shade * 0.9], [sw0 + 0.15, sw0 + 0.45], r());
      }
    }
  }
  // the very top: a drooping plume
  const topP = cl(H);
  for (let i = 0; i < 6; i++) {
    const yaw = r() * TAU;
    const ay = V3(Math.cos(yaw) * 0.7, 0.2 - r() * 0.6, Math.sin(yaw) * 0.7).normalize();
    const ax = V3().crossVectors(ay, UP).normalize();
    card(F, topP.clone().add(V3(0, -0.3 * i / 6, 0)), ax, ay, 0.55, 0.7, rects[i % 2], V3(Math.cos(yaw) * 0.5, 0.85, Math.sin(yaw) * 0.5).normalize(), [1, 1, 0.95], [swayAt(H), swayAt(H) + 0.3], r());
  }
  return { culm: B.build(), leaves: F.build() };
}

/**
 * createBambooGrove({ center:[x,z], radius, count, heights:[min,max] (m), seed, groundAt(x,z), inside(x,z)->bool,
 *   minDist, clump, detailNear:[x,z], detailRadius, variants })
 * -> { group, culms[], leaves[], positions[] }
 */
export function createBambooGrove(opts = {}) {
  const o = { center: [0, 0], radius: 8, count: 150, heights: [8.5, 13.5], seed: 5, groundAt: () => 0, inside: null, minDist: 0.32, detailNear: null, detailRadius: 9, variants: 3, ...opts };
  const M = floraMaterials();
  const r = rng(o.seed);
  const H0 = 12, R0 = 0.048;
  const vars = [], dvars = [];
  for (let k = 0; k < o.variants; k++) vars.push(culmVariant(o.seed * 31 + k, H0, R0, false, o.ringStep ?? 0.55));
  if (o.detailNear) for (let k = 0; k < 2; k++) dvars.push(culmVariant(o.seed * 31 + 100 + k, H0, R0, true));
  // scatter in clumps
  const pts = [];
  const clumps = [];
  for (let i = 0; i < Math.max(4, Math.round(o.count / 9)); i++) { const a = r() * TAU, d = Math.sqrt(r()) * o.radius; clumps.push([o.center[0] + Math.cos(a) * d, o.center[1] + Math.sin(a) * d]); }
  let tries = 0;
  while (pts.length < o.count && tries++ < o.count * 60) {
    const c = clumps[Math.floor(r() * clumps.length)];
    const a = r() * TAU, d = Math.abs(r() + r() - 1) * 2.4;
    const x = c[0] + Math.cos(a) * d, z = c[1] + Math.sin(a) * d;
    if (Math.hypot(x - o.center[0], z - o.center[1]) > o.radius) continue;
    if (o.inside && !o.inside(x, z)) continue;
    if (pts.some(p => (p[0] - x) ** 2 + (p[1] - z) ** 2 < o.minDist * o.minDist)) continue;
    pts.push([x, z]);
  }
  const buckets = vars.map(() => []), dbuckets = dvars.map(() => []);
  const positions = [];
  for (const [x, z] of pts) {
    const h = lerp(o.heights[0], o.heights[1], Math.pow(r(), 0.8));
    const s = h / H0;
    const m = new THREE.Matrix4().compose(V3(x, o.groundAt(x, z) - 0.05, z), new THREE.Quaternion().setFromAxisAngle(UP, r() * TAU), V3(s * (0.85 + r() * 0.3), s, s * (0.85 + r() * 0.3)));
    positions.push(V3(x, o.groundAt(x, z), z));
    const near = o.detailNear && Math.hypot(x - o.detailNear[0], z - o.detailNear[1]) < o.detailRadius;
    if (near && dvars.length) dbuckets[Math.floor(r() * dvars.length)].push(m);
    else buckets[Math.floor(r() * vars.length)].push(m);
  }
  const group = new THREE.Group(); group.name = 'bambooGrove';
  const culms = [], leaves = [];
  const add = (v, list, tag) => {
    if (!list.length) return;
    const c = instancedOf(v.culm, M.culm, M.depth.culm, list, { name: 'bamboo-culm' + tag, cast: o.culmShadows !== false || String(tag)[0] === 'd' });
    const cc = new THREE.Color();
    for (let i = 0; i < list.length; i++) { const k = r(); c.setColorAt(i, cc.setRGB(0.62 + k * 0.5, 0.7 + k * 0.35, 0.5 + k * 0.25 + (r() < 0.15 ? 0.25 : 0))); }
    c.instanceColor.needsUpdate = true;
    const l = instancedOf(v.leaves, M.bambooLeaf, M.depth.bambooLeaf, list, { name: 'bamboo-leaves' + tag });
    group.add(c, l); culms.push(c); leaves.push(l);
  };
  vars.forEach((v, i) => add(v, buckets[i], i));
  dvars.forEach((v, i) => add(v, dbuckets[i], 'd' + i));
  return { group, culms, leaves, positions };
}
