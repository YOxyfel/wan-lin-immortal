// Trees, bamboo, shrubs, ferns and mushrooms built from bark tubes and alpha foliage cards.
import * as THREE from 'three';
import { M, mul, mcyl, msphere, tube } from './geo.js';
import { rng, lerp, smooth, clamp } from './util.js';

// atlas tiles: 0 broadleaf, 1 pine, 2 blossom, 3 bamboo
const TILE = [[0, 0.5], [0.5, 0.5], [0, 0], [0.5, 0]];

// One foliage card built directly in world space with a soft spherical normal around `hub`.
export function card(kit, c, hub, size, tile, rot, color, sway, burn = 0.4, vis = 3) {
  const [u0, v0] = TILE[tile];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  const ax = new THREE.Vector3(size / 2, 0, 0).applyQuaternion(q), ay = new THREE.Vector3(0, size / 2, 0).applyQuaternion(q);
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3().copy(c).addScaledVector(ax, a).addScaledVector(ay, b));
  const pos = [], nor = [], uv = [];
  pts.forEach((p, k) => {
    pos.push(p.x, p.y, p.z);
    const n = p.clone().sub(hub).normalize().multiplyScalar(0.75).add(new THREE.Vector3(0, 0.55, 0)).normalize();
    nor.push(n.x, n.y, n.z);
    const [a, b] = [[0, 0], [1, 0], [1, 1], [0, 1]][k];
    uv.push(u0 + 0.004 + a * 0.492, v0 + 0.004 + b * 0.492);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  kit.add('foliage', g, null, { color, burn, vis, sway });
}

export function cluster(kit, hub, radius, count, tile, rand, tint, swayBase, flat = 0, opts = {}) {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, e = (rand() - 0.35) * Math.PI * (flat ? 0.18 : 0.7), r = radius * Math.cbrt(rand());
    const p = new THREE.Vector3(hub.x + Math.cos(a) * Math.cos(e) * r, hub.y + Math.sin(e) * r * (flat ? 0.35 : 0.8), hub.z + Math.sin(a) * Math.cos(e) * r);
    const size = radius * rand.range(0.85, 1.35) * (opts.size || 1);
    const rot = flat ? [-Math.PI / 2 + rand.range(-0.45, 0.45), rand() * 6.28, rand.range(-0.3, 0.3)] : [rand.range(-1.2, 1.2), rand() * 6.28, rand.range(-0.6, 0.6)];
    const shade = 0.82 + rand() * 0.3 + (p.y - hub.y) / (radius * 3);
    card(kit, p, hub, size, tile, rot, [tint[0] * shade, tint[1] * shade, tint[2] * shade], swayBase + rand() * 0.25, opts.burn ?? 0.4, opts.vis ?? 3);
  }
}

// Sculptural tiered pine (the classic painted pine with flat pads).
export function pine(kit, x, y, z, s, rand, opts = {}) {
  const h = 9 * s, lean = rand.range(-1, 1) * 1.6 * s, leanZ = rand.range(-1, 1) * 1.2 * s;
  const trunk = [[x, y - 0.3, z], [x + lean * 0.2, y + h * 0.3, z + leanZ * 0.2], [x + lean * 0.65, y + h * 0.65, z + leanZ * 0.6], [x + lean, y + h, z + leanZ]];
  kit.add('bark', tube(trunk, 0.32 * s, 8, 12, 0.7), null, { burn: 0.4, vis: opts.vis ?? 0, sway: (px, py) => clamp((py - y) / h) * 0.15, color: [0.9, 0.85, 0.8] });
  const tint = opts.tint || [0.62, 0.78, 0.6];
  const tiers = rand.int(4, 6);
  for (let t = 0; t < tiers; t++) {
    const f = lerp(0.42, 0.98, t / (tiers - 1));
    const base = new THREE.Vector3(x + lean * f, y + h * f, z + leanZ * f);
    const ang = rand() * Math.PI * 2, len = (1 - f * 0.55) * rand.range(2.0, 3.4) * s;
    const tip = base.clone().add(new THREE.Vector3(Math.cos(ang) * len, rand.range(0.1, 0.8) * s, Math.sin(ang) * len));
    const mid = base.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.4 * s, 0));
    kit.add('bark', tube([base.toArray(), mid.toArray(), tip.toArray()], 0.12 * s * (1 - f * 0.4), 5, 6, 0.6), null, { burn: 0.4, vis: opts.vis ?? 0, sway: 0.2 + f * 0.2, color: [0.85, 0.8, 0.75] });
    cluster(kit, tip, (1.5 - f * 0.4) * s, Math.round(10 * (opts.density || 1)), 1, rand, tint, 0.35 + f * 0.3, 1, opts);
  }
  cluster(kit, new THREE.Vector3(x + lean, y + h + 0.3 * s, z + leanZ), 1.4 * s, Math.round(10 * (opts.density || 1)), 1, rand, tint, 0.6, 1, opts);
}

// Tall straight forest pine with a full, layered crown.
export function tallPine(kit, x, y, z, s, rand, opts = {}) {
  const h = rand.range(15, 22) * s;
  const bend = rand.range(-0.6, 0.6);
  const top = [x + bend, y + h, z + bend * 0.4];
  kit.add('bark', tube([[x, y - 0.4, z], [x + bend * 0.3, y + h * 0.5, z], top], 0.38 * s, 7, 8, 0.8), null, { burn: 0.4, vis: 0, sway: (px, py) => clamp((py - y) / h) * 0.12, color: [0.85, 0.78, 0.72] });
  const tint = opts.tint || [0.5, 0.66, 0.5];
  const d = opts.density || 1;
  const tiers = Math.max(4, Math.round(rand.int(6, 9) * Math.min(1, d + 0.2)));
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const f = lerp(0.36, 1.0, k);
    const hub = new THREE.Vector3(x + bend * f, y + h * f, z + bend * 0.4 * f);
    const r = lerp(3.3, 0.9, k) * s;
    const arms = k > 0.85 ? 1 : 3;
    for (let a = 0; a < arms; a++) {
      const ang = rand() * Math.PI * 2;
      const tip = hub.clone().add(new THREE.Vector3(Math.cos(ang) * r * 0.62, -0.2 * s, Math.sin(ang) * r * 0.62));
      if (k < 0.7 && rand() < 0.6) kit.add('bark', tube([hub.toArray(), tip.toArray()], 0.07 * s, 4, 2, 0.5), null, { burn: 0.4, vis: 0, sway: 0.25, color: [0.75, 0.7, 0.65] });
      cluster(kit, tip, r * 0.72, Math.max(4, Math.round(9 * d)), 1, rand, tint, 0.3 + f * 0.25, 1, opts);
    }
  }
}

// Broad-leafed tree (camphor / chestnut). Returns the canopy top for placing ribbons, etc.
export function broadleaf(kit, x, y, z, s, rand, opts = {}) {
  const h = 6 * s;
  const tile = opts.tile ?? 0;
  const tint = opts.tint || (tile === 2 ? [1, 1, 1] : [0.72, 0.86, 0.66]);
  kit.add('bark', tube([[x, y - 0.3, z], [x + rand.range(-0.3, 0.3) * s, y + h * 0.5, z], [x, y + h * 0.75, z + rand.range(-0.3, 0.3) * s]], 0.36 * s, 8, 8, 0.45), null, { burn: 0.4, vis: opts.vis ?? 0, sway: 0.05, color: [0.75, 0.72, 0.68] });
  const branches = rand.int(4, 6);
  const hubs = [];
  for (let b = 0; b < branches; b++) {
    const a = (b / branches) * Math.PI * 2 + rand.range(-0.4, 0.4);
    const start = new THREE.Vector3(x, y + h * rand.range(0.55, 0.75), z);
    const end = start.clone().add(new THREE.Vector3(Math.cos(a) * 2.3 * s, rand.range(1.4, 2.6) * s, Math.sin(a) * 2.3 * s));
    kit.add('bark', tube([start.toArray(), start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.4 * s, 0)).toArray(), end.toArray()], 0.16 * s, 5, 6, 0.6), null, { burn: 0.4, vis: opts.vis ?? 0, sway: 0.25, color: [0.75, 0.72, 0.68] });
    hubs.push(end);
    cluster(kit, end, 1.7 * s, Math.round(16 * (opts.density || 1)), tile, rand, tint, 0.45, 0, opts);
  }
  const top = new THREE.Vector3(x, y + h + 1.8 * s, z);
  cluster(kit, top, 2.0 * s, Math.round(18 * (opts.density || 1)), tile, rand, tint, 0.5, 0, opts);
  return { top, hubs };
}

export function bamboo(kit, x, y, z, rand, n = 14, opts = {}) {
  for (let i = 0; i < n; i++) {
    const bx = x + rand.range(-1.6, 1.6), bz = z + rand.range(-1.6, 1.6), h = rand.range(6, 10);
    const lean = [rand.range(-0.8, 0.8), rand.range(-0.8, 0.8)];
    const pts = [[bx, y - 0.2, bz], [bx + lean[0] * 0.2, y + h * 0.5, bz + lean[1] * 0.2], [bx + lean[0], y + h, bz + lean[1]]];
    kit.add('bark', tube(pts, 0.055, 6, 10, 0.35), null, { burn: 0.6, vis: opts.vis ?? 3, color: [0.9, 1.25, 0.6], sway: (px, py) => clamp((py - y) / h) * 0.9 });
    for (let k = 0; k < 6; k++) {
      const t = rand.range(0.45, 1);
      const p = new THREE.Vector3(bx + lean[0] * t * t, y + h * t, bz + lean[1] * t * t);
      card(kit, p.clone().add(new THREE.Vector3(rand.range(-0.6, 0.6), 0, rand.range(-0.6, 0.6))), p, rand.range(1.2, 1.9), 3, [rand.range(-0.4, 0.4), rand() * 6.28, rand.range(-0.5, 0.5)], [0.8, 0.95, 0.75], 0.6 + t * 0.6, 0.6, opts.vis ?? 3);
    }
  }
}

export function bush(kit, x, y, z, s, rand, tint = [0.7, 0.85, 0.6], tile = 0, vis = 3) {
  cluster(kit, new THREE.Vector3(x, y + 0.5 * s, z), 0.9 * s, 9, tile, rand, tint, 0.3, 0, { vis, size: 1.1 });
}

export function fern(kit, x, y, z, s, rand) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand() * 0.5;
    const p = new THREE.Vector3(x + Math.cos(a) * 0.35 * s, y + 0.25 * s, z + Math.sin(a) * 0.35 * s);
    card(kit, p, new THREE.Vector3(x, y, z), 0.9 * s, 3, [-0.9 + rand() * 0.3, -a + Math.PI / 2, 0], [0.42, 0.55, 0.34], 0.4, 0.4, 0);
  }
}

export function mushrooms(kit, x, y, z, rand, n = 9, glow = false) {
  for (let i = 0; i < n; i++) {
    const mx = x + rand.range(-0.7, 0.7), mz = z + rand.range(-0.5, 0.5), s = rand.range(0.6, 1.4);
    kit.add('plaster', mcyl(0.025 * s, 0.035 * s, 0.14 * s, 6), M(mx, y + 0.07 * s, mz, 0, rand.range(-0.2, 0.2)), { vis: 0, color: [1.05, 1.0, 0.92] });
    const cap = msphere(0.07 * s, 10, 6);
    cap.scale(1, 0.55, 1);
    kit.add(glow ? 'pottery' : 'pottery', cap, M(mx, y + 0.15 * s, mz, 0, rand.range(-0.2, 0.2)), { vis: 0, color: rand() < 0.7 ? [0.72, 0.36, 0.14] : [0.86, 0.62, 0.32] });
  }
}

// The ancient tree in the deep forest whose roots hold what fell from the sky.
export function giantTree(kit, x, y, z, rand) {
  const s = 2.4;
  // moss and stones gathered at the foot
  for (let i = 0; i < 14; i++) { const a = rand() * 6.28, r = rand.range(3, 7); bush(kit, x + Math.cos(a) * r, y - 0.2, z + Math.sin(a) * r, rand.range(0.6, 1.1), rand, [0.42, 0.6, 0.36], 0, 0); }
  kit.add('bark', tube([[x, y - 1, z], [x + 0.6, y + 6, z + 0.4], [x - 0.3, y + 13, z], [x + 0.4, y + 19, z - 0.3]], 1.9, 14, 14, 0.62), null, { vis: 0, color: [0.7, 0.66, 0.62] });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand.range(-0.2, 0.2), L = rand.range(5, 9);
    const pts = [[x, y + 2.2, z], [x + Math.cos(a) * 1.8, y + 1.0, z + Math.sin(a) * 1.8], [x + Math.cos(a) * L * 0.55, y + 0.15, z + Math.sin(a) * L * 0.55], [x + Math.cos(a) * L, y - 0.3, z + Math.sin(a) * L]];
    kit.add('bark', tube(pts, 0.55, 8, 12, 0.8), null, { vis: 0, color: [0.66, 0.62, 0.56] });
  }
  for (let b = 0; b < 7; b++) {
    const a = (b / 7) * Math.PI * 2 + rand.range(-0.3, 0.3);
    const start = new THREE.Vector3(x, y + rand.range(12, 17), z);
    const end = start.clone().add(new THREE.Vector3(Math.cos(a) * rand.range(6, 9), rand.range(2, 6), Math.sin(a) * rand.range(6, 9)));
    kit.add('bark', tube([start.toArray(), start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 1.5, 0)).toArray(), end.toArray()], 0.6, 7, 8, 0.7), null, { vis: 0, color: [0.66, 0.62, 0.56] });
    cluster(kit, end, 5.2, 34, 0, rand, [0.5, 0.68, 0.46], 0.35, 0, { vis: 0, size: 1.25 });
  }
  cluster(kit, new THREE.Vector3(x, y + 24, z), 8, 48, 0, rand, [0.56, 0.72, 0.5], 0.35, 0, { vis: 0, size: 1.3 });
}

// Red prayer ribbons tied to the wish tree.
export function ribbons(kit, hubs, rand) {
  for (const hub of hubs) for (let i = 0; i < 4; i++) {
    const len = rand.range(0.8, 1.6);
    const g = new THREE.PlaneGeometry(0.09, len, 1, 4);
    g.translate(0, -len / 2, 0);
    kit.add('cloth', g, M(hub.x + rand.range(-1.2, 1.2), hub.y - rand.range(1.2, 2.2), hub.z + rand.range(-1.2, 1.2), rand() * 6), { color: [0.85, 0.12, 0.08], vis: 3, burn: 0.8, sway: (px, py) => Math.min(1.6, -py / len * 1.6) });
  }
}
