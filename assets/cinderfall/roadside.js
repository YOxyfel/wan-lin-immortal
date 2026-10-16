// Along the road north out of the village and at the edge of the pines: a pavilion to rest in on the climb, a signpost
// where the road goes in under the old pines (古松), a boundary rope across the old way west with its paper streamers
// and its board (禁: no one goes over the ridges), and what the woodcutters leave behind them (stumps, a felled trunk,
// the split pile, the axe left standing in the block).
import * as THREE from 'three';
import { M, mul, mbox, mcyl, tube } from './geo.js';
import { roofGeometry } from './architecture.js';
import { atlasQuad, firewood } from './props.js';
import { SIGN_CELLS } from './materials.js';
import { heightAt } from './layout.js';

const RED = [0.62, 0.13, 0.08], WOOD = [0.55, 0.45, 0.34];

// a roadside pavilion (亭): a stone plinth with steps to the road, four red columns, a curved tiled roof, benches
// between the columns; its open front (+z) to the road
export function pavilion(kit, x, z, rotY, rand) {
  const y = Math.max(heightAt(x, z), heightAt(x + 1.6, z), heightAt(x - 1.6, z), heightAt(x, z + 1.6), heightAt(x, z - 1.6)) + 0.12;
  const W = M(x, y, z, rotY);
  const L = 3.0, D = 3.0, colH = 2.55, base = 0.36;
  kit.add('stone', mbox(L + 1.1, 1.8, D + 1.1), mul(W, M(0, base - 0.9, 0)), { vis: 0, color: 0.84 });
  kit.add('stone', mbox(L + 1.2, 0.1, D + 1.2), mul(W, M(0, base - 0.02, 0)), { vis: 0, color: 0.95 });
  for (let k = 0; k < 3; k++) kit.add('stone', mbox(1.5, 0.12 + k * 0.12, 0.34), mul(W, M(0, (0.12 + k * 0.12) / 2 - 0.02 + (base - 0.36), D / 2 + 0.55 + 0.34 * (2 - k))), { vis: 0, color: 0.9 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kit.add('stone', mcyl(0.2, 0.22, 0.16, 10), mul(W, M(sx * L / 2, base + 0.08, sz * D / 2)), { vis: 0, color: 0.9 });
    kit.add('lacquer', mcyl(0.105, 0.115, colH, 12), mul(W, M(sx * L / 2, base + colH / 2, sz * D / 2)), { burn: 0.3, vis: 0, color: RED });
  }
  const top = base + colH;
  for (const sz of [-1, 1]) kit.add('timber', mbox(L + 0.5, 0.24, 0.2), mul(W, M(0, top + 0.02, sz * D / 2)), { vis: 0, color: [0.5, 0.2, 0.12] });
  for (const sx of [-1, 1]) kit.add('timber', mbox(0.2, 0.24, D + 0.5), mul(W, M(sx * L / 2, top + 0.02, 0)), { vis: 0, color: [0.5, 0.2, 0.12] });
  // (a painted frieze under the beams: dark green with a gold line)
  for (const sz of [-1, 1]) kit.add('timber', mbox(L - 0.2, 0.2, 0.06), mul(W, M(0, top - 0.2, sz * (D / 2 + 0.06))), { vis: 0, color: [0.16, 0.3, 0.26] });
  for (const sz of [-1, 1]) kit.add('metal', mbox(L - 0.2, 0.025, 0.07), mul(W, M(0, top - 0.11, sz * (D / 2 + 0.07))), { vis: 0, color: [1.2, 0.95, 0.5] });
  // the roof
  const H = 1.45;
  const r = roofGeometry({ L, D, H, ox: 0.85, ozF: 0.95, ozB: 0.95, lift: 0.8, segU: 18, segV: 10, thickness: 0.14 });
  const RW = mul(W, M(0, top + 0.16 + H, 0));
  kit.add('roof', r.top, RW, { vis: 0, color: [0.9, 0.92, 0.96] });
  kit.add('roofUnder', r.under, RW, { vis: 0, color: 0.55 });
  for (const f of r.fascia) kit.add('timber', f, RW, { vis: 0, color: [0.42, 0.18, 0.12] });
  const rl = r.halfX * 1.84;
  kit.add('roof', mbox(rl, 0.28, 0.32), mul(RW, M(0, 0.09, 0)), { vis: 0, color: [0.8, 0.8, 0.84] });
  for (const sx of [-1, 1]) {
    const x0 = sx * rl / 2;
    kit.add('roof', tube([[x0 - sx * 0.22, 0.1, 0], [x0, 0.36, 0], [x0 + sx * 0.06, 0.7, 0], [x0 - sx * 0.1, 0.78, 0], [x0 - sx * 0.2, 0.66, 0]], 0.09, 6, 10, 0.5), RW, { vis: 0, color: [0.7, 0.7, 0.74] });
  }
  for (const s of [1, -1]) for (const u of [0, 1]) {
    const pts = Array.from({ length: 7 }, (_, j) => { const p = r.P(u, j / 6, s); return [p[0] * 0.995, p[1] + 0.07, p[2]]; });
    kit.add('roof', tube(pts, 0.075, 6, 12), RW, { vis: 0, color: [0.78, 0.78, 0.82] });
  }
  // benches on three sides, between the columns
  for (const [bx, bz, ry] of [[0, -D / 2 + 0.28, 0], [-L / 2 + 0.28, 0, Math.PI / 2], [L / 2 - 0.28, 0, Math.PI / 2]]) {
    kit.add('plank', mbox(L - 0.45, 0.07, 0.36), mul(W, M(bx, base + 0.45, bz, ry)), { vis: 0, color: 0.75 });
    for (const sx of [-1, 1]) kit.add('timber', mbox(0.07, 0.42, 0.3), mul(W, mul(M(bx, base + 0.21, bz, ry), M(sx * (L / 2 - 0.5), 0, 0))), { vis: 0, color: 0.5 });
  }
  // a lantern under the eave, a stone table with a tea set left on it
  kit.add('stone', mcyl(0.42, 0.36, 0.08, 14), mul(W, M(0, base + 0.68, 0)), { vis: 0, color: 0.9 });
  kit.add('stone', mcyl(0.16, 0.22, 0.62, 10), mul(W, M(0, base + 0.31, 0)), { vis: 0, color: 0.86 });
  kit.add('pottery', mcyl(0.07, 0.09, 0.13, 10), mul(W, M(0.1, base + 0.79, 0.05)), { vis: 0, color: [0.4, 0.55, 0.5] });
  for (let k = 0; k < 3; k++) kit.add('pottery', mcyl(0.035, 0.028, 0.045, 8), mul(W, M(-0.18 + k * 0.09, base + 0.745, -0.14)), { vis: 0, color: [0.85, 0.85, 0.8] });
  return { top: new THREE.Vector3(x, y + top, z) };
}

// a signpost: a post, a crossbar, the board (from the sign atlas) facing +z, a little plank roof over it
export function signpost(kit, x, z, rotY, cell, { h = 2.25, w = 1.05, bh = 0.52 } = {}) {
  const y = heightAt(x, z);
  const W = M(x, y, z, rotY);
  kit.add('timber', mcyl(0.07, 0.09, h + 0.45, 7), mul(W, M(0, (h + 0.45) / 2 - 0.4, 0)), { vis: 0, color: WOOD });
  kit.add('timber', mbox(w + 0.24, 0.08, 0.08), mul(W, M(0, h - 0.05, 0.08)), { vis: 0, color: 0.5 });
  kit.add('sign', atlasQuad(cell, w, bh, false, 0.035), mul(W, M(0, h - bh / 2 - 0.13, 0.1)), { vis: 0 });
  kit.add('plank', mbox(w + 0.4, 0.05, 0.34), mul(W, M(0, h + 0.1, 0.07, 0, 0.12)), { vis: 0, color: 0.42 });
  // (a straw rope and a strip of red cloth tied round the post)
  kit.add('straw', mcyl(0.1, 0.1, 0.07, 8), mul(W, M(0, 1.15, 0)), { vis: 0 });
  kit.add('cloth', mbox(0.07, 0.42, 0.01), mul(W, M(0.08, 0.92, 0.08)), { vis: 0, color: [0.75, 0.12, 0.08], sway: 0.8 });
}

// a boundary rope between two posts (a, b: [x, z]), sagging, hung with zigzag paper streamers, and in its middle the
// board that says no one goes on
export function boundary(kit, a, b, rand, cell = SIGN_CELLS['禁']) {
  const ya = heightAt(a[0], a[1]), yb = heightAt(b[0], b[1]);
  const ph = 1.75;
  for (const [x, z, y] of [[a[0], a[1], ya], [b[0], b[1], yb]]) {
    kit.add('timber', mcyl(0.08, 0.1, ph + 0.3, 7), M(x, y + (ph + 0.3) / 2 - 0.3, z, rand() * 6, rand.range(-0.06, 0.06)), { vis: 0, color: [0.42, 0.36, 0.3] });
    kit.add('stone', mcyl(0.16, 0.2, 0.18, 8), M(x, y + 0.05, z), { vis: 0, color: 0.8 });
  }
  const A = new THREE.Vector3(a[0], ya + ph - 0.1, a[1]), B = new THREE.Vector3(b[0], yb + ph - 0.1, b[1]);
  const N = 16, sag = 0.45, pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N; const p = A.clone().lerp(B, t); p.y -= sag * 4 * t * (1 - t); pts.push([p.x, p.y, p.z]); }
  kit.add('straw', tube(pts, 0.045, 6, N * 2), null, { vis: 0, color: [1.05, 0.95, 0.75] });
  const dir = B.clone().sub(A).setY(0).normalize(), ry = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  const len = A.distanceTo(B), n = Math.floor(len / 0.42);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (Math.abs(t - 0.5) < 0.09) continue;
    const p = A.clone().lerp(B, t);
    p.y -= sag * 4 * t * (1 - t);
    // (a paper streamer folded in a zigzag: three short strips, offset)
    for (let j = 0; j < 3; j++) kit.add('paper', mbox(0.07, 0.13, 0.004), M(p.x + dir.x * (j % 2 ? 0.035 : -0.035), p.y - 0.1 - j * 0.12, p.z + dir.z * (j % 2 ? 0.035 : -0.035), ry), { vis: 0, color: [1, 0.98, 0.92], sway: 0.5 + j * 0.35 });
  }
  const m = A.clone().lerp(B, 0.5);
  m.y -= sag;
  kit.add('sign', atlasQuad(cell, 0.62, 0.31, false, 0.03), M(m.x, m.y - 0.28, m.z, ry), { vis: 0, sway: 0.25 });
  kit.add('timber', mcyl(0.006, 0.006, 0.14, 4), M(m.x, m.y - 0.07, m.z), { vis: 0, color: 0.3 });
}

// a stump, its cut face pale; sometimes the axe left in it
export function stump(kit, x, z, rad, rand, axe = false) {
  const y = heightAt(x, z), h = rand.range(0.35, 0.6);
  kit.add('bark', mcyl(rad * 0.92, rad * 1.12, h, 10), M(x, y + h / 2 - 0.05, z, rand() * 6), { vis: 0, color: [0.75, 0.66, 0.55] });
  kit.add('plank', mcyl(rad * 0.88, rad * 0.88, 0.025, 12), M(x, y + h - 0.04, z), { vis: 0, color: [1.05, 0.9, 0.66] });
  for (let k = 0; k < 4; k++) {
    const a = k * 1.57 + rand.range(-0.3, 0.3);
    kit.add('bark', tube([[x + Math.cos(a) * rad * 0.7, y + 0.18, z + Math.sin(a) * rad * 0.7], [x + Math.cos(a) * rad * 1.35, y + 0.04, z + Math.sin(a) * rad * 1.35], [x + Math.cos(a) * rad * 1.9, y - 0.06, z + Math.sin(a) * rad * 1.9]], rad * 0.28, 5, 4, 0.7), null, { vis: 0, color: [0.7, 0.62, 0.52] });
  }
  if (axe) {
    const a = rand() * 6;
    kit.add('timber', mbox(0.045, 0.045, 0.75), M(x + Math.cos(a) * 0.12, y + h + 0.22, z + Math.sin(a) * 0.12, a, -0.75), { vis: 0, color: [0.72, 0.58, 0.4] });
    kit.add('metal', mbox(0.035, 0.13, 0.2), M(x - Math.cos(a) * 0.02, y + h + 0.02, z - Math.sin(a) * 0.02, a, -0.75), { vis: 0, color: [0.55, 0.55, 0.58] });
  }
}

// a felled trunk lying along the ground (dir: its yaw), its cut end pale, a few broken branch stubs
export function log(kit, x, z, len, rad, yaw, rand) {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const y0 = heightAt(x - dx * len / 2, z - dz * len / 2), y1 = heightAt(x + dx * len / 2, z + dz * len / 2);
  const y = (y0 + y1) / 2 + rad * 0.82, pitch = Math.atan2(y1 - y0, len);
  const W = mul(M(x, y, z, yaw), M(0, 0, 0, 0, Math.PI / 2 - pitch));
  kit.add('bark', mcyl(rad * 0.86, rad, len, 12), W, { vis: 0, color: [0.72, 0.64, 0.54] });
  kit.add('plank', mcyl(rad * 0.84, rad * 0.84, 0.02, 12), mul(W, M(0, -len / 2 - 0.005, 0)), { vis: 0, color: [1.0, 0.86, 0.62] });
  for (let k = 0; k < 3; k++) {
    const t = rand.range(-0.35, 0.4) * len, a = rand.range(-1.2, 1.2);
    kit.add('bark', mcyl(rad * 0.18, rad * 0.24, rad * 1.4, 6), mul(W, M(Math.cos(a) * rad * 0.9, t, Math.sin(a) * rad * 0.9, -a, 0, -Math.PI / 2)), { vis: 0, color: [0.66, 0.58, 0.5] });
  }
}

// the woodcutters' place at the edge of the pines: the split pile, the block with the axe in it, a stump or two
export function woodcut(kit, x, z, rotY, rand) {
  const y = heightAt(x, z);
  firewood(kit, M(x, y, z, rotY), rand, 0.2, 28);
  stump(kit, x + Math.cos(rotY) * 1.6, z - Math.sin(rotY) * 1.6, 0.3, rand, true);
  for (let k = 0; k < 7; k++) {
    const a = rand() * 6, r0 = rand.range(1.0, 2.2);
    const cx = x + Math.cos(rotY) * 1.6 + Math.cos(a) * r0, cz = z - Math.sin(rotY) * 1.6 + Math.sin(a) * r0;
    kit.add('plank', mbox(0.09, 0.09, 0.42), M(cx, heightAt(cx, cz) + 0.05, cz, rand() * 6, 0, Math.PI / 2 * (k % 2)), { vis: 0, color: [1.0, 0.86, 0.66] });
  }
}
