// The main street dressed for an ordinary spring morning that is anything but plain: strings of red lanterns slung
// across it from eave to eave, tall banners on poles, market stalls spilling out of the shopfronts (oil-paper umbrellas,
// bolts of cloth, vegetables, pottery), a flagstone way down its middle, a second gate at its south end.
import * as THREE from 'three';
import { M, mul, mbox, mcyl, tube, mplane } from './geo.js';
import { roadX, heightAt, GATE_Z, VILLAGE } from './layout.js';
import * as P from './props.js';
import { buildGate } from './architecture.js';
import { lerp } from './util.js';

const REDS = [[0.85, 0.14, 0.08], [0.85, 0.14, 0.08], [0.95, 0.75, 0.3], [0.85, 0.14, 0.08], [0.7, 0.1, 0.1]];

// a string of lanterns across the street at z, between two eave-height points, sagging
function lanternString(kit, z, rand, half = 6.0, h = 4.25) {
  const xc = roadX(z), y0 = h + rand.range(-0.15, 0.15), y1 = h + rand.range(-0.15, 0.15);
  const A = new THREE.Vector3(xc - half, y0, z + rand.range(-0.3, 0.3)), B = new THREE.Vector3(xc + half, y1, z + rand.range(-0.3, 0.3));
  const sag = rand.range(0.7, 1.05), N = 18;
  const pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N; const p = A.clone().lerp(B, t); p.y -= sag * 4 * t * (1 - t); pts.push([p.x, p.y, p.z]); }
  kit.add('timber', tube(pts, 0.012, 3, N * 2), null, { burn: 0.9, vis: 3, color: 0.3 });
  const n = 7;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, p = A.clone().lerp(B, t);
    p.y -= sag * 4 * t * (1 - t);
    P.lantern(kit, M(p.x, p.y, p.z), { burn: 0.9, vis: 3, color: REDS[(k + Math.round(z)) % REDS.length], drop: 0.12 });
  }
  // little paper streamers between them
  for (let k = 0; k < n * 2; k++) {
    const t = (k + 0.25) / (n * 2), p = A.clone().lerp(B, t);
    p.y -= sag * 4 * t * (1 - t);
    kit.add('paper', mbox(0.08, 0.32, 0.005), M(p.x, p.y - 0.18, p.z, rand() * 0.6), { burn: 0.9, vis: 3, color: k % 3 ? [1, 0.95, 0.85] : [0.95, 0.5, 0.4], sway: 0.6 });
  }
}

// a tall pole with a long vertical banner (a 幡) hanging from a crossbar
function banner(kit, x, z, rand, color) {
  const y = heightAt(x, z), h = rand.range(6.5, 8);
  kit.add('stone', mbox(0.45, 0.4, 0.45), M(x, y + 0.2, z), { vis: 0, color: 0.85 });
  kit.add('lacquer', mcyl(0.06, 0.08, h, 8), M(x, y + h / 2, z), { burn: 0.7, vis: 3, color: [0.35, 0.12, 0.08] });
  kit.add('lacquer', mbox(0.9, 0.07, 0.07), M(x, y + h - 0.35, z), { burn: 0.7, vis: 3, color: [0.35, 0.12, 0.08] });
  kit.add('metal', new THREE.ConeGeometry(0.09, 0.3, 6), M(x, y + h + 0.15, z), { vis: 3, color: [1.4, 1.0, 0.45] });
  const g = mplane(0.62, 3.2, 2, 8);
  kit.add('cloth', g, M(x, y + h - 2.0, z + 0.02, rand.range(-0.4, 0.4)), { burn: 0.9, vis: 3, color, sway: (bx, by) => Math.max(0, 1.6 - by) * 0.9 });
  // its tails
  for (const sx of [-1, 1]) kit.add('cloth', mplane(0.12, 0.9, 1, 3), M(x + sx * 0.25, y + h - 4.05, z + 0.02), { burn: 0.9, vis: 3, color: color.map(v => v * 0.8), sway: 1.2 });
}

// an oil-paper umbrella, open: a shallow cone of ribs and paper, a bamboo handle
function umbrella(kit, W, col) {
  const c = new THREE.ConeGeometry(0.62, 0.32, 16, 1, true);
  kit.add('paper', c, mul(W, M(0, 0.16, 0)), { burn: 0.9, vis: 3, color: col });
  const inner = c.clone(); inner.index ? inner.index.array.reverse() : null;
  kit.add('paper', inner, mul(W, M(0, 0.15, 0)), { burn: 0.9, vis: 3, color: col.map(v => v * 0.75) });
  for (let i = 0; i < 16; i += 2) kit.add('timber', mbox(0.008, 0.008, 0.62), mul(W, M(Math.cos(i / 16 * 6.283) * 0.3, 0.15, Math.sin(i / 16 * 6.283) * 0.3, -i / 16 * 6.283 + Math.PI / 2, 0.47)), { vis: 3, color: 0.3 });
  kit.add('timber', mcyl(0.012, 0.012, 0.9, 5), mul(W, M(0, -0.3, 0)), { burn: 0.9, vis: 3, color: [0.85, 0.75, 0.5] });
}

// market stalls: a trestle table, its wares, sometimes an awning
function marketStall(kit, W, kind, rand) {
  const burn = 0.9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', mbox(0.07, 0.75, 0.07), mul(W, M(sx * 0.85, 0.37, sz * 0.32)), { burn, vis: 3, color: 0.5 });
  kit.add('plank', mbox(1.9, 0.06, 0.8), mul(W, M(0, 0.77, 0)), { burn, vis: 3, color: 0.7 });
  if (kind === 'umbrella') {
    const cols = [[0.85, 0.2, 0.15], [0.95, 0.75, 0.35], [0.25, 0.4, 0.6], [0.9, 0.86, 0.75], [0.55, 0.2, 0.35]];
    for (let i = 0; i < 4; i++) umbrella(kit, mul(W, M(-0.75 + i * 0.5, 1.75 + (i % 2) * 0.25, -0.1 + (i % 2) * 0.25, rand() * 6, rand.range(-0.25, 0.25), rand.range(-0.25, 0.25))), cols[(i + Math.floor(rand() * 5)) % cols.length]);
    for (let i = 0; i < 6; i++) kit.add('paper', mcyl(0.035, 0.035, 0.75, 6), mul(W, M(-0.7 + i * 0.12, 0.82, 0.1, 0, 0, Math.PI / 2 + rand.range(-0.1, 0.1))), { burn, vis: 3, color: cols[i % cols.length] });
  } else if (kind === 'cloth') {
    const cols = [[0.2, 0.27, 0.55], [0.75, 0.2, 0.18], [0.85, 0.8, 0.65], [0.3, 0.5, 0.42], [0.6, 0.45, 0.65], [0.85, 0.6, 0.25]];
    for (let i = 0; i < 7; i++) kit.add('cloth', mbox(0.24, 0.16, 0.6), mul(W, M(-0.75 + i * 0.25, 0.88 + (i % 2) * 0.16, 0)), { burn, vis: 3, color: cols[i % cols.length] });
    // lengths hung from a rail above the table
    kit.add('timber', mcyl(0.025, 0.025, 2.0, 5), mul(W, M(0, 2.05, -0.35, 0, 0, Math.PI / 2)), { burn, vis: 3, color: 0.5 });
    for (const sx of [-1, 1]) kit.add('timber', mbox(0.06, 2.1, 0.06), mul(W, M(sx * 0.95, 1.05, -0.35)), { burn, vis: 3, color: 0.5 });
    for (let i = 0; i < 5; i++) kit.add('cloth', mplane(0.3, 1.2, 1, 4), mul(W, M(-0.7 + i * 0.35, 1.45, -0.33)), { burn, vis: 3, color: cols[(i + 2) % cols.length], sway: (x, y) => Math.max(0, 0.6 - y) * 0.6 });
  } else if (kind === 'veg') {
    for (let i = 0; i < 4; i++) {
      const fill = [[0.5, 0.72, 0.3], [0.9, 0.85, 0.7], [0.8, 0.25, 0.12], [0.95, 0.6, 0.15]][i];
      P.basket(kit, mul(W, M(-0.7 + i * 0.47, 0.8, 0)), rand, fill, burn);
    }
    for (let i = 0; i < 3; i++) P.basket(kit, mul(W, M(-0.6 + i * 0.6, 0, 0.75)), rand, [[0.5, 0.72, 0.3], [0.85, 0.3, 0.15], [0.9, 0.9, 0.8]][i], burn);
  } else if (kind === 'pots') {
    P.jars(kit, mul(W, M(0, 0.8, 0)), rand, 4, burn);
    P.jars(kit, mul(W, M(0, 0, 0.8)), rand, 3, burn);
  }
  // a cloth awning on two poles over it
  if (kind !== 'umbrella') {
    for (const sx of [-1, 1]) kit.add('timber', mcyl(0.035, 0.035, 2.3, 5), mul(W, M(sx * 1.05, 1.15, 0.55)), { burn, vis: 3, color: 0.55 });
    const aw = mplane(2.4, 1.3, 4, 2);
    kit.add('cloth', aw, mul(W, M(0, 2.25, 0.05, 0, -1.25)), { burn, vis: 3, color: [[0.86, 0.82, 0.72], [0.55, 0.18, 0.14], [0.3, 0.38, 0.5]][Math.floor(rand() * 3)], sway: 0.25 });
  }
}

export function buildStreet(kit, rand, avoid) {
  // lanterns across the street, every dozen paces, from the south gate to the north gate
  for (let z = 88; z > GATE_Z + 6; z -= rand.range(11, 14)) lanternString(kit, z, rand);
  const rects = [];
  // banners on poles at the street's edge, where the lanes run off between the houses
  const bcols = [[0.62, 0.1, 0.07], [0.12, 0.1, 0.1], [0.2, 0.25, 0.42], [0.62, 0.1, 0.07], [0.5, 0.38, 0.12], [0.12, 0.1, 0.1]];
  [[82, -1], [66, 1], [48.5, -1], [31.5, 1], [-14, -1], [-26.5, 1]].forEach(([z, s], k) => {
    const x = roadX(z) + s * 4.2;
    banner(kit, x, z, rand, bcols[k % bcols.length]);
    rects.push([x - 0.6, x + 0.6, z - 0.6, z + 0.6]);
  });
  // market stalls along its edges, where the terraces leave room (clear of the doors)
  const stalls = [[78.5, 1, 'umbrella'], [64, -1, 'veg'], [52, 1, 'cloth'], [33.5, -1, 'pots'], [2, -1, 'umbrella'], [-24, 1, 'veg'], [19.5, 1, 'cloth']];
  for (const [z, s, kind] of stalls) {
    const x = roadX(z) + s * 4.35;
    marketStall(kit, M(x, heightAt(x, z), z, s < 0 ? Math.PI / 2 : -Math.PI / 2), kind, rand);
    rects.push([x - 1.4, x + 1.4, z - 1.4, z + 1.4]);
  }
  // a flagstone way down the middle of the cobbles
  for (let z = VILLAGE.zMax - 2; z > GATE_Z + 1; z -= 0.92) {
    const x = roadX(z) + rand.range(-0.05, 0.05);
    kit.add('stone', mbox(rand.range(1.05, 1.25), 0.12, 0.84), M(x, heightAt(x, z) + 0.02, z, Math.atan2(roadX(z - 1) - roadX(z + 1), -2) + rand.range(-0.04, 0.04)), { vis: 0, color: [0.86 + rand() * 0.1, 0.84 + rand() * 0.1, 0.8 + rand() * 0.08] });
  }
  // the south gate, where the morning comes in
  const gs = buildGate(kit, roadX(95), 0, 95, Math.PI);
  rects.push([roadX(95) - 6, roadX(95) + 6, 93.5, 96.5]);
  return { southGate: gs, rects };
}
