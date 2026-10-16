// Village dressing. Everything is merged into the shared kit; animated cloth and lanterns use the wind attribute.
import * as THREE from 'three';
import { M, mul, mbox, mcyl, msphere, mplane, tube } from './geo.js';
import { SIGN_CELLS, SIGNS } from './materials.js';
import { lerp, rng } from './util.js';

const CLOTH = [[0.2, 0.27, 0.45], [0.86, 0.84, 0.78], [0.62, 0.2, 0.16], [0.3, 0.48, 0.42], [0.72, 0.55, 0.26], [0.42, 0.33, 0.5], [0.8, 0.72, 0.6]];

export function atlasQuad(cell, w, h, rotate = false, thick = 0.02) {
  const { W, H, cw, ch } = SIGNS;
  const col = cell % 2, row = Math.floor(cell / 2);
  const u0 = (col * cw) / W, u1 = ((col + 1) * cw) / W, v1 = 1 - (row * ch) / H, v0 = 1 - ((row + 1) * ch) / H;
  const g = new THREE.BoxGeometry(w, h, thick);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    let x = uv.getX(i), y = uv.getY(i);
    if (rotate) [x, y] = [1 - y, x];
    uv.setXY(i, lerp(u0, u1, x), lerp(v0, v1, y));
  }
  return g;
}

function lathe(profile, seg = 14) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i));
  return g;
}

const JAR = lathe([[0.0, 0], [0.16, 0.01], [0.24, 0.12], [0.27, 0.3], [0.22, 0.5], [0.13, 0.58], [0.12, 0.64], [0.15, 0.66], [0.0, 0.66]]);
const URN = lathe([[0, 0], [0.22, 0.01], [0.36, 0.25], [0.4, 0.5], [0.3, 0.82], [0.2, 0.9], [0.22, 0.95], [0, 0.95]]);
const BASKET = lathe([[0, 0], [0.18, 0.01], [0.26, 0.28], [0.27, 0.3], [0.25, 0.3], [0.17, 0.04], [0, 0.04]]);
const TRAY = lathe([[0, 0], [0.5, 0.0], [0.55, 0.07], [0.52, 0.08], [0.46, 0.02], [0, 0.02]], 18);

export function lantern(kit, W, { burn = 0.7, vis = 3, color = [0.85, 0.14, 0.08], drop = 0.55 } = {}) {
  const sway = (x, y, z) => 0.0; // whole lantern sways rigidly via wind below
  kit.add('timber', mcyl(0.012, 0.012, drop, 4), mul(W, M(0, -drop / 2, 0)), { burn, vis, color: 0.4, sway: 0.15 });
  const body = msphere(0.24, 12, 10);
  body.scale(1, 1.22, 1);
  kit.add('lantern', body, mul(W, M(0, -drop - 0.3, 0)), { burn, vis, color, sway: 0.7 });
  kit.add('timber', mcyl(0.12, 0.13, 0.06, 10), mul(W, M(0, -drop - 0.02, 0)), { burn, vis, color: 0.3, sway: 0.5 });
  kit.add('timber', mcyl(0.13, 0.12, 0.06, 10), mul(W, M(0, -drop - 0.58, 0)), { burn, vis, color: 0.3, sway: 0.8 });
  kit.add('lantern', mcyl(0.03, 0.01, 0.3, 5), mul(W, M(0, -drop - 0.76, 0)), { burn, vis, color: [0.9, 0.7, 0.2], sway: 1.0 });
}

export function couplets(kit, W, doorW, h, burn) {
  for (const sx of [-1, 1]) kit.add('sign', atlasQuad(SIGN_CELLS.couplet, 0.3, 1.5, true), mul(W, M(sx * (doorW / 2 + 0.42), 1.4, 0.16)), { burn, vis: 3 });
  kit.add('sign', atlasQuad(SIGN_CELLS.couplet, 1.5, 0.3), mul(W, M(0, h + 0.38, 0.17)), { burn, vis: 3 });
}

export function laundry(kit, W, len, rand, burn = 1) {
  for (const sx of [-1, 1]) kit.add('timber', mcyl(0.04, 0.05, 2.4, 6), mul(W, M(sx * len / 2, 1.2, 0)), { burn, vis: 3, color: [0.75, 0.65, 0.4] });
  kit.add('timber', mcyl(0.03, 0.03, len + 0.3, 6), mul(W, M(0, 2.3, 0, 0, 0, Math.PI / 2)), { burn, vis: 3, color: [0.78, 0.7, 0.45] });
  let x = -len / 2 + 0.25;
  while (x < len / 2 - 0.3) {
    const cw = rand.range(0.45, 1.0), ch = rand.range(0.6, 1.3);
    const g = mplane(cw, ch, 3, 5);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 6 + rand() * 3) * 0.03);
    g.computeVertexNormals();
    const c = rand.pick(CLOTH);
    kit.add('cloth', g, mul(W, M(x + cw / 2, 2.3 - ch / 2, 0)), { burn, vis: 3, color: c, sway: (px, py) => Math.max(0, (ch / 2 - py) / ch) * 1.4 });
    x += cw + rand.range(0.08, 0.3);
  }
}

export function herbRack(kit, W, rand, burn = 1) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', mcyl(0.035, 0.035, 1.7, 5), mul(W, M(sx * 0.6, 0.85, sz * 0.4, 0, sz * 0.12)), { burn, vis: 3, color: [0.7, 0.62, 0.38] });
  for (let k = 0; k < 3; k++) {
    const y = 0.45 + k * 0.48;
    kit.add('straw', TRAY, mul(W, M(0, y, 0, rand() * 6, 0, 0, 1.05, 1, 0.75)), { burn, vis: 3 });
    for (let i = 0; i < 9; i++) {
      const g = msphere(0.09, 6, 4); g.scale(1, 0.35, 1);
      const c = rand.pick([[0.42, 0.5, 0.2], [0.55, 0.42, 0.24], [0.62, 0.55, 0.3], [0.7, 0.25, 0.15]]);
      kit.add('dirtProp', g, mul(W, M(rand.range(-0.4, 0.4), y + 0.04, rand.range(-0.28, 0.28))), { burn, vis: 3, color: [c[0] * 1.6, c[1] * 1.6, c[2] * 1.6] });
    }
  }
}

// Strings of dried chilli or corn hanging from the eaves.
export function hangingString(kit, W, kind, len, rand, burn = 1) {
  kit.add('timber', mcyl(0.008, 0.008, len, 3), mul(W, M(0, -len / 2, 0)), { burn, vis: 3, color: 0.5, sway: 0.4 });
  const n = Math.floor(len / (kind === 'corn' ? 0.16 : 0.07));
  for (let i = 0; i < n; i++) {
    const g = msphere(kind === 'corn' ? 0.06 : 0.035, 6, 4);
    g.scale(kind === 'corn' ? 0.8 : 0.7, kind === 'corn' ? 1.7 : 2.0, kind === 'corn' ? 0.8 : 0.7);
    const c = kind === 'corn' ? [1.0, 0.75, 0.22] : rand() < 0.15 ? [0.55, 0.12, 0.08] : [0.85, 0.12, 0.07];
    kit.add('pottery', g, mul(W, M(rand.range(-0.05, 0.05), -0.1 - i * (len / n), rand.range(-0.05, 0.05), rand() * 6, rand.range(-0.4, 0.4))), { burn, vis: 3, color: c, sway: 0.3 + (i / n) * 0.8 });
  }
}

export function herbBundle(kit, W, rand, burn = 1) {
  const g = new THREE.ConeGeometry(0.1, 0.42, 6);
  g.rotateX(Math.PI);
  const c = rand.pick([[0.45, 0.5, 0.25], [0.55, 0.45, 0.28], [0.4, 0.42, 0.22]]);
  kit.add('dirtProp', g, mul(W, M(0, -0.3, 0)), { burn, vis: 3, color: [c[0] * 1.7, c[1] * 1.7, c[2] * 1.7], sway: 0.6 });
  kit.add('timber', mcyl(0.006, 0.006, 0.12, 3), mul(W, M(0, -0.05, 0)), { burn, vis: 3, color: 0.4, sway: 0.3 });
}

export function firewood(kit, W, rand, burn = 0.8, n = 26) {
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 7), col = i % 7;
    const g = mcyl(0.07, 0.075, 1.0, 6);
    kit.add('bark', g, mul(W, M(col * 0.15 - 0.45 + (row % 2) * 0.07, 0.08 + row * 0.13, 0, rand.range(-0.05, 0.05), Math.PI / 2, 0)), { burn, vis: 3, color: [0.9, 0.82, 0.7] });
  }
  kit.add('straw', mbox(1.3, 0.04, 1.2), mul(W, M(0, 0.15 + Math.ceil(n / 7) * 0.13, 0, 0, 0.1)), { burn, vis: 3 });
}

export function jars(kit, W, rand, n = 3, burn = 0.4) {
  for (let i = 0; i < n; i++) {
    const big = rand() < 0.4;
    const g = big ? URN : JAR;
    const s = rand.range(0.8, 1.25) * (big ? 1 : 1.1);
    const c = rand.pick([[0.32, 0.2, 0.12], [0.18, 0.15, 0.13], [0.45, 0.32, 0.18], [0.24, 0.3, 0.26]]);
    kit.add('pottery', g, mul(W, M(rand.range(-0.6, 0.6), 0, rand.range(-0.4, 0.4), rand() * 6, 0, 0, s)), { burn, vis: 3, color: c });
    if (big && rand() < 0.6) kit.add('cloth', new THREE.CircleGeometry(0.26, 10), mul(W, M(0, 0.96 * s, 0, 0, -Math.PI / 2)), { burn, vis: 3, color: [0.75, 0.14, 0.1] });
  }
}

export function basket(kit, W, rand, fill = null, burn = 0.9) {
  kit.add('straw', BASKET, W, { burn, vis: 3 });
  if (fill) for (let i = 0; i < 7; i++) {
    const g = msphere(0.06, 6, 5);
    kit.add('pottery', g, mul(W, M(rand.range(-0.12, 0.12), 0.24 + rand() * 0.04, rand.range(-0.12, 0.12))), { burn, vis: 3, color: fill });
  }
}

export function barrel(kit, W, burn = 0.8) {
  kit.add('plank', mcyl(0.32, 0.29, 0.8, 14), mul(W, M(0, 0.4, 0)), { burn, vis: 3, color: [0.85, 0.7, 0.55] });
  for (const y of [0.12, 0.68]) kit.add('metal', mcyl(0.325, 0.325, 0.05, 14, true), mul(W, M(0, y, 0)), { vis: 3 });
}

export function bench(kit, W, len = 1.6, burn = 0.9) {
  kit.add('plank', mbox(len, 0.07, 0.36), mul(W, M(0, 0.45, 0)), { burn, vis: 3, color: 0.85 });
  for (const sx of [-1, 1]) kit.add('timber', mbox(0.08, 0.42, 0.3), mul(W, M(sx * (len / 2 - 0.15), 0.21, 0)), { burn, vis: 3, color: 0.6 });
}

export function cart(kit, W, rand, burn = 0.8, load = true) {
  kit.add('plank', mbox(1.3, 0.08, 2.1), mul(W, M(0, 0.62, 0)), { burn, vis: 3, color: 0.8 });
  for (const sx of [-1, 1]) kit.add('plank', mbox(0.06, 0.35, 2.1), mul(W, M(sx * 0.65, 0.82, 0)), { burn, vis: 3, color: 0.75 });
  for (const sx of [-1, 1]) {
    const wheel = new THREE.TorusGeometry(0.48, 0.05, 6, 18);
    kit.add('timber', wheel, mul(W, M(sx * 0.78, 0.5, 0.15, Math.PI / 2)), { burn, vis: 3, color: 0.6 });
    for (let k = 0; k < 6; k++) kit.add('timber', mbox(0.04, 0.92, 0.04), mul(W, M(sx * 0.78, 0.5, 0.15, Math.PI / 2, 0, (k * Math.PI) / 6)), { burn, vis: 3, color: 0.6 });
  }
  for (const sx of [-1, 1]) kit.add('timber', mcyl(0.035, 0.035, 2.2, 5), mul(W, M(sx * 0.4, 0.55, 1.9, 0, Math.PI / 2 + 0.1)), { burn, vis: 3, color: 0.6 });
  if (load) for (let i = 0; i < 14; i++) {
    const g = msphere(0.13, 7, 5);
    kit.add('pottery', g, mul(W, M(rand.range(-0.45, 0.45), 0.8 + rand() * 0.15, rand.range(-0.8, 0.8))), { burn, vis: 3, color: rand() < 0.5 ? [0.5, 0.7, 0.3] : [0.75, 0.8, 0.45] });
  }
}

export function rock(kit, W, s, rand, moss = true) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    v.multiplyScalar(0.75 + rand() * 0.45);
    v.y *= 0.6;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  kit.add('stone', g, mul(W, M(0, s * 0.15, 0, rand() * 6, 0, 0, s)), { vis: 0, color: moss ? [0.85, 0.92, 0.75] : 1 });
}

export function well(kit, W) {
  const ring = new THREE.CylinderGeometry(0.9, 0.95, 0.8, 18, 1, true);
  kit.add('stone', ring, mul(W, M(0, 0.4, 0)), { vis: 0 });
  kit.add('stone', new THREE.TorusGeometry(0.9, 0.12, 6, 18), mul(W, M(0, 0.82, 0, 0, Math.PI / 2)), { vis: 0, color: 1.1 });
  kit.add('glow', new THREE.CircleGeometry(0.85, 16), mul(W, M(0, 0.5, 0, 0, -Math.PI / 2)), { vis: 0, color: [0.0, 0.0, 0.0] });
  for (const sx of [-1, 1]) kit.add('timber', mbox(0.14, 2.2, 0.14), mul(W, M(sx * 1.0, 1.1, 0)), { burn: 0.7, vis: 3, color: 0.55 });
  kit.add('timber', mcyl(0.06, 0.06, 2.2, 6), mul(W, M(0, 1.8, 0, 0, 0, Math.PI / 2)), { burn: 0.7, vis: 3, color: 0.5 });
  kit.add('plank', mbox(0.4, 0.35, 0.4), mul(W, M(0, 1.3, 0)), { burn: 0.7, vis: 3, color: 0.7 });
  const r = (cfg) => cfg;
  const roof = new THREE.ConeGeometry(1.6, 0.9, 4, 1);
  roof.rotateY(Math.PI / 4);
  kit.add('roof', roof, mul(W, M(0, 2.6, 0, 0, 0, 0, 1, 1, 0.75)), { burn: 0.7, vis: 3 });
}

export function stall(kit, W, rand, burn = 1) {
  // counter, bamboo steamers, awning, stools: the bun shop
  kit.add('plank', mbox(3.2, 0.9, 0.8), mul(W, M(0, 0.45, 0)), { burn, vis: 3, color: 0.7 });
  kit.add('plank', mbox(3.3, 0.06, 0.9), mul(W, M(0, 0.92, 0)), { burn, vis: 3, color: 0.85 });
  for (let s = 0; s < 3; s++) for (let k = 0; k < 4 - s; k++) kit.add('straw', mcyl(0.3, 0.3, 0.16, 14), mul(W, M(-0.9 + s * 0.8, 1.03 + k * 0.165, 0)), { burn, vis: 3, color: [1.1, 1.05, 0.9] });
  kit.add('straw', mcyl(0.32, 0.25, 0.1, 14), mul(W, M(1.1, 1.0, 0)), { burn, vis: 3 });
  kit.add('metal', mcyl(0.35, 0.3, 0.3, 14), mul(W, M(1.1, 0.75, 0)), { vis: 3 });
  // awning
  const aw = mplane(3.8, 2.0, 6, 4);
  const pos = aw.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) + 1.9) * 2.4) * 0.04);
  aw.computeVertexNormals();
  kit.add('cloth', aw, mul(W, M(0, 2.55, 0.6, 0, -1.15)), { burn, vis: 3, color: [0.86, 0.82, 0.72], sway: 0.25 });
  for (const sx of [-1, 1]) kit.add('timber', mcyl(0.05, 0.05, 2.4, 6), mul(W, M(sx * 1.8, 1.2, 1.45)), { burn, vis: 3, color: 0.6 });
  // a table and benches on the terrace beside the counter (clear of the porch posts, the steps and the pots)
  const seats = [[-3.5, 0.8], [3.5, 0.8], [3.5, 1.45]];
  for (let i = 0; i < 3; i++) bench(kit, mul(W, M(seats[i][0], 0, seats[i][1], rand.range(-0.2, 0.2) * 0.25)), 0.9, burn);
  kit.add('plank', mbox(1.2, 0.06, 0.62), mul(W, M(-3.5, 0.78, 1.3)), { burn, vis: 3, color: 0.85 });
  for (const sx of [-1, 1]) kit.add('timber', mbox(0.06, 0.76, 0.06), mul(W, M(-3.5 + sx * 0.5, 0.38, 1.3)), { burn, vis: 3, color: 0.6 });
}

export function forge(kit, W, rand) {
  kit.add('stone', mbox(1.6, 0.9, 1.2), mul(W, M(-1.4, 0.45, -1.2)), { vis: 0 });
  kit.add('glow', mbox(1.0, 0.08, 0.7), mul(W, M(-1.4, 0.93, -1.2)), { vis: 3, color: [1.0, 0.36, 0.08] });
  kit.add('stone', mcyl(0.32, 0.45, 2.6, 10), mul(W, M(-1.4, 2.2, -1.5)), { vis: 0, color: 0.8 });
  kit.add('metal', mbox(0.7, 0.22, 0.28), mul(W, M(0.6, 0.78, 0.2)), { vis: 0 });
  kit.add('metal', new THREE.ConeGeometry(0.14, 0.4, 6), mul(W, M(1.05, 0.8, 0.2, 0, 0, -Math.PI / 2)), { vis: 0 });
  kit.add('bark', mcyl(0.3, 0.34, 0.65, 10), mul(W, M(0.6, 0.33, 0.2)), { vis: 0 });
  kit.add('plank', mbox(1.4, 0.5, 0.6), mul(W, M(1.9, 0.25, -1.2)), { burn: 0.8, vis: 3, color: 0.6 });
  kit.add('glow', mbox(1.3, 0.04, 0.5), mul(W, M(1.9, 0.48, -1.2)), { vis: 3, color: [0.02, 0.05, 0.06] });
  for (let i = 0; i < 6; i++) kit.add('metal', mbox(0.04, 0.7, 0.04), mul(W, M(-0.8 + i * 0.3, 2.0, -3.3, 0, 0, rand.range(-0.1, 0.1))), { vis: 3 });
  return new THREE.Vector3(0.6, 0.95, 0.2).applyMatrix4(W);
}

export function wineJars(kit, W, rand) {
  for (let i = 0; i < 6; i++) {
    kit.add('pottery', URN, mul(W, M((i % 3) * 0.9 - 0.9, 0, Math.floor(i / 3) * 0.9, rand() * 6, 0, 0, 1.2)), { burn: 0.4, vis: 3, color: [0.22, 0.16, 0.12] });
    kit.add('cloth', new THREE.CircleGeometry(0.3, 10), mul(W, M((i % 3) * 0.9 - 0.9, 1.15, Math.floor(i / 3) * 0.9, 0, -Math.PI / 2)), { burn: 0.8, vis: 3, color: [0.78, 0.13, 0.1] });
  }
}

export function flagPole(kit, W, h, color, burn = 0.8) {
  kit.add('timber', mcyl(0.05, 0.07, h, 6), mul(W, M(0, h / 2, 0)), { burn, vis: 3, color: 0.55 });
  const g = mplane(0.9, 1.9, 4, 6);
  kit.add('cloth', g, mul(W, M(0.5, h - 1.1, 0)), { burn, vis: 3, color, sway: (x) => Math.max(0, x + 0.45) * 1.4 });
}

export function fence(kit, a, b, groundY, burn = 0.5) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  const n = Math.max(1, Math.round(len / 1.8));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + dx * t, z = a[1] + dz * t, y = groundY(x, z);
    kit.add('timber', mbox(0.1, 1.15, 0.1), M(x, y + 0.55, z, ang), { burn, vis: 0, color: [0.7, 0.62, 0.5] });
  }
  for (const hh of [0.45, 0.95]) {
    const pts = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = a[0] + dx * t, z = a[1] + dz * t; return [x, groundY(x, z) + hh, z]; });
    kit.add('timber', tube(pts, 0.035, 4, n * 2), null, { burn, vis: 0, color: [0.72, 0.65, 0.48] });
  }
}

export function stoneWall(kit, a, b, groundY, h = 0.9) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  const n = Math.max(1, Math.round(len / 3));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, y = groundY(x, z);
    kit.add('stone', mbox(0.7, h + 0.4, len / n + 0.05), M(x, y + h / 2 - 0.2, z, ang), { vis: 0 });
    kit.add('stone', mbox(0.8, 0.12, len / n + 0.05), M(x, y + h, z, ang), { vis: 0, color: 1.1 });
  }
}

export function shrine(kit, W, rand) {
  kit.add('stone', mbox(1.6, 0.5, 1.2), mul(W, M(0, 0.25, 0)), { vis: 0 });
  kit.add('stone', mbox(1.0, 1.0, 0.8), mul(W, M(0, 1.0, -0.1)), { vis: 0, color: 0.9 });
  kit.add('roof', new THREE.ConeGeometry(1.15, 0.6, 4), mul(W, M(0, 1.8, -0.1, Math.PI / 4)), { vis: 0, color: 0.8 });
  kit.add('metal', mcyl(0.16, 0.12, 0.2, 10), mul(W, M(0, 0.6, 0.35)), { vis: 0, color: [0.6, 0.45, 0.25] });
  kit.add('sign', atlasQuad(SIGN_CELLS.talisman, 0.5, 0.3), mul(W, M(0, 1.2, 0.31)), { vis: 3 });
  for (let i = 0; i < 3; i++) kit.add('glow', mcyl(0.006, 0.006, 0.3, 3), mul(W, M(-0.05 + i * 0.05, 0.85, 0.35)), { vis: 3, color: [0.8, 0.3, 0.1] });
  return new THREE.Vector3(0, 1.0, 0.35).applyMatrix4(W);
}

export function rubble(kit, W, rand, w, d) {
  // charred beams and broken tiles left after the fire (ruins only)
  for (let i = 0; i < 6; i++) kit.add('timber', mbox(0.25, 0.25, rand.range(2, 4.5)), mul(W, M(rand.range(-w / 2, w / 2), 0.3 + rand() * 0.6, rand.range(-d / 2, d / 2), rand() * 6, rand.range(-0.5, 0.5), rand.range(-0.3, 0.3))), { burn: 1, vis: 4, color: 0.4 });
  for (let i = 0; i < 5; i++) {
    const g = new THREE.IcosahedronGeometry(1, 0); g.scale(rand.range(0.8, 1.6), rand.range(0.25, 0.5), rand.range(0.8, 1.6));
    kit.add('roof', g, mul(W, M(rand.range(-w / 2, w / 2), 0.1, rand.range(-d / 2, d / 2), rand() * 6)), { burn: 1, vis: 4, color: 0.7 });
  }
}
