// The camp, built season by season (ported from forest.js camp() onto the forest-set layout). Stage-gated props use
// the shared VIS codes of materials.js: aVis 10+N appears at camp stage N (noise dissolve), 30+N is visible while
// stage < N, 20+N is the tally notch of year N. Materials come from createSeasonalMaterials(mats).
import * as THREE from 'three';
import { Kit, M, mul, mbox, mcyl, msphere, tube } from './geo.js';
import { createSeasonalMaterials, applyDepth, patch } from './materials.js';
import * as PR from './props.js';
import * as V from './vegetation.js';
import { GLYPHS } from './glyphs.js';
import { rng } from './util.js';
import { GeoBuf, sweep, card, fpatch, fdepth, noise3, V3, TAU, meshOf } from './flora-core.js';
import { floraMaterials } from './flora-mats.js';
import { rockGeometry } from './flora-ground.js';
import { cellRect } from './flora-tex.js';
import { P } from './forest-set-terrain.js';

function plaqueTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#8a7a62'; x.fillRect(0, 0, 128, 256);
  x.globalAlpha = 0.25; for (let i = 0; i < 60; i++) { x.fillStyle = Math.random() < 0.5 ? '#5a4c38' : '#b0a080'; x.fillRect(0, Math.random() * 256, 128, 1 + Math.random() * 2); }
  x.globalAlpha = 1;
  const glyph = (ch, cx, cy, size) => { const gl = GLYPHS[ch]; if (!gl) return; x.save(); x.translate(cx - size / 2, cy - size * 0.5); x.scale(size / 1000, size / 1000); x.fillStyle = '#1e1812'; x.fill(new Path2D(gl.d)); x.restore(); };
  glyph('叔', 64, 52, 74); glyph('之', 64, 130, 74); glyph('墓', 64, 208, 74);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCamp(mats, gy, quality = {}) {
  const rand = rng(8128);
  const B = createSeasonalMaterials(mats);
  B.plaque = patch(new THREE.MeshStandardMaterial({ map: plaqueTexture(), roughness: 0.9 }), { burn: false, seasons: true });
  const F = floraMaterials();
  const group = new THREE.Group(); group.name = 'camp';
  const kit = new Kit();
  kit.cell = 60;
  const L = (x, y, z, ry = 0, rx = 0, rz = 0) => M(x, gy(x, z) + y, z, ry, rx, rz);
  const [rx0, rz0] = P.ROCK;

  // ---------------------------------------------------------------- the boulder he sheltered against (flat face toward the camp)
  const f = V3(P.CAMP[0] - rx0, 0, P.CAMP[1] - rz0).normalize();
  const side = V3(-f.z, 0, f.x);
  const rockRY = Math.atan2(-f.z, f.x);
  {
    const g = rockGeometry(4077, 'boulder', 20);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x > 0.5) p.setX(i, 0.5 + (x - 0.5) * 0.07 + 0.015 * noise3(p.getY(i) * 6, p.getZ(i) * 6, 1)); }
    g.computeVertexNormals();
    const m = meshOf(g, F.rock, F.depth.rock, { name: 'campBoulder' });
    m.scale.set(2.7, 2.35, 2.5);
    m.position.set(rx0, gy(rx0, rz0) - 0.35, rz0);
    m.rotation.y = rockRY;
    group.add(m);
  }
  const face = V3(rx0, 0, rz0).addScaledVector(f, 1.35);
  const fy = gy(face.x, face.z);

  // ---------------------------------------------------------------- stage 0: lean-to of branches against the rock, bedroll
  // (not there before he comes: it appears with the first winter, and is gone when the hut is built)
  kit.forceVis = 43;
  for (let i = 0; i < 9; i++) {
    const s = -1.6 + i * 0.4 + rand.range(-0.05, 0.05);
    const g0 = face.clone().addScaledVector(f, 2.5 + rand.range(-0.1, 0.1)).addScaledVector(side, s);
    const t0 = face.clone().addScaledVector(f, 0.12).addScaledVector(side, s * 0.95);
    const m0 = g0.clone().lerp(t0, 0.5).add(V3(0, 0, 0));
    kit.add('bark', tube([[g0.x, gy(g0.x, g0.z) - 0.1, g0.z], [m0.x, fy + 1.2, m0.z], [t0.x, fy + 2.35, t0.z]], 0.045, 5, 4), null, { color: [0.7, 0.62, 0.52] });
  }
  kit.add('bark', tube([[face.x + side.x * -1.9 + f.x * 0.2, fy + 2.3, face.z + side.z * -1.9 + f.z * 0.2], [face.x + side.x * 1.9 + f.x * 0.2, fy + 2.3, face.z + side.z * 1.9 + f.z * 0.2]], 0.05, 5, 3), null, { color: [0.62, 0.55, 0.45] });
  for (let i = 0; i < 26; i++) {
    const s = rand.range(-1.6, 1.6), t = rand.range(0.1, 0.95);
    const c = face.clone().addScaledVector(f, 2.45 * (1 - t) + 0.12 * t).addScaledVector(side, s);
    V.card(kit, V3(c.x, gy(c.x, c.z) * (1 - t) + (fy + 2.35) * t + 0.1, c.z), V3(face.x + f.x * 4, fy - 1, face.z + f.z * 4), 0.95, 1, [-0.75 + rand() * 0.4, rockRY + Math.PI / 2 + rand.range(-0.4, 0.4), 0], [0.5, 0.48, 0.34], 0.1, 0, 43);
  }
  {
    const bed = face.clone().addScaledVector(f, 1.1);
    kit.add('cloth', mbox(1.8, 0.12, 0.72), M(bed.x, gy(bed.x, bed.z) + 0.06, bed.z, Math.atan2(side.x, side.z)), { color: [0.42, 0.36, 0.3] });
  }

  // ---------------------------------------------------------------- stage 0+: the fire ring
  const [fx, fz] = P.FIRE;
  kit.forceVis = 10;
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * TAU + rand.range(-0.1, 0.1);
    const g = rockGeometry(500 + i, 'round', 3);
    const x = fx + Math.cos(a) * 0.66, z = fz + Math.sin(a) * 0.66;
    kit.add('stone', g, M(x, gy(x, z) + 0.04, z, a, 0, 0, 0.17, 0.11, 0.14), { color: [0.62, 0.6, 0.56] });
  }
  kit.forceVis = 10;
  for (let i = 0; i < 4; i++) kit.add('bark', mcyl(0.05, 0.06, 0.82, 6), L(fx, 0.12, fz, i * 0.8, Math.PI / 2 - 0.25, 0), { color: [0.28, 0.22, 0.18] });
  kit.add('glow', new THREE.CircleGeometry(0.44, 12), L(fx, 0.04, fz, 0, -Math.PI / 2), { color: [0.9, 0.3, 0.08] });
  kit.add('dirtProp', new THREE.CircleGeometry(0.62, 16), L(fx, 0.02, fz, 0, -Math.PI / 2), { color: [0.18, 0.15, 0.13] });

  // ---------------------------------------------------------------- stage 1: snares at the edge of the clearing, a drying rack
  kit.forceVis = 11;
  for (const [x, z] of [[-11.5, -3.5], [7.6, 9.4], [-2.6, -12.4]]) {
    kit.add('bark', mcyl(0.02, 0.025, 0.7, 4), L(x, 0.3, z, 0, 0.2), { color: [0.6, 0.52, 0.4] });
    kit.add('bark', mcyl(0.015, 0.015, 0.6, 4), L(x + 0.2, 0.35, z, 0, 0, 1.0), { color: [0.6, 0.52, 0.4] });
    kit.add('timber', new THREE.TorusGeometry(0.14, 0.006, 3, 10), L(x + 0.35, 0.16, z, 0, 0.3), { color: [0.75, 0.68, 0.5] });
  }
  {
    // (by the fire's side of the camp, clear of the way the eye looks across it)
    const rx = 3.4, rz = 2.4;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('bark', mcyl(0.035, 0.04, 1.9, 5), L(rx + sx * 0.9, 0.92, rz + sz * 0.38, 0, sz * 0.2), { color: [0.62, 0.55, 0.44] });
    kit.add('bark', mcyl(0.03, 0.03, 2.1, 5), L(rx, 1.78, rz, 0, 0, Math.PI / 2), { color: [0.6, 0.52, 0.42] });
    for (let i = 0; i < 7; i++) { const g = new THREE.PlaneGeometry(0.12, rand.range(0.4, 0.7)); g.translate(0, -0.28, 0); kit.add('cloth', g, L(rx - 0.8 + i * 0.26, 1.76, rz, rand.range(-0.3, 0.3)), { color: i % 3 ? [0.42, 0.16, 0.12] : [0.5, 0.4, 0.3], sway: 0.6 }); }
  }

  // ---------------------------------------------------------------- stage 2: an archery target of bound straw, arrows, a quiver on a peg
  // (it faces the place he shoots from, so the lens behind him sees the face of it beyond him)
  const [tx, tz] = P.TARGET;
  const tA = Math.atan2(P.RANGE[0] - tx, P.RANGE[1] - tz);
  kit.forceVis = 12;
  kit.add('bark', mcyl(0.35, 0.4, 0.5, 10), L(tx, 0.25, tz), { color: [0.6, 0.52, 0.42] });
  for (const sx of [-1, 1]) kit.add('bark', mcyl(0.04, 0.05, 1.5, 5), L(tx + Math.cos(tA) * sx * 0.45, 0.75, tz - Math.sin(tA) * sx * 0.45, tA, -0.12, 0), { color: [0.55, 0.47, 0.38] });
  kit.add('straw', mcyl(0.52, 0.52, 0.38, 16), L(tx, 1.0, tz, tA, Math.PI / 2), {});
  kit.add('cloth', new THREE.RingGeometry(0.12, 0.23, 16), L(tx + Math.sin(tA) * 0.2, 1.0, tz + Math.cos(tA) * 0.2, tA), { color: [0.55, 0.12, 0.08] });
  kit.add('cloth', new THREE.CircleGeometry(0.06, 10), L(tx + Math.sin(tA) * 0.2, 1.0, tz + Math.cos(tA) * 0.2, tA), { color: [0.2, 0.15, 0.1] });
  // (the arrows left in it come after the first that found its heart, in the fourth year)
  kit.forceVis = 15;
  for (let i = 0; i < 4; i++) { const a = rand() * TAU, rr = 0.16 + rand() * 0.24; kit.add('timber', mcyl(0.006, 0.006, 0.6, 3), L(tx + Math.sin(tA) * 0.46 + Math.cos(tA) * Math.cos(a) * rr, 1.0 + Math.sin(a) * rr, tz + Math.cos(tA) * 0.46 - Math.sin(tA) * Math.cos(a) * rr, tA + rand.range(-0.12, 0.12), Math.PI / 2 + rand.range(-0.08, 0.08)), { color: [0.72, 0.58, 0.4] }); }
  kit.forceVis = 12;
  const target = { bull: V3(tx + Math.sin(tA) * 0.205, gy(tx, tz) + 1.0, tz + Math.cos(tA) * 0.205), normal: V3(Math.sin(tA), 0, Math.cos(tA)) };
  {
    const q = face.clone().addScaledVector(side, -2.1).addScaledVector(f, 0.05);
    kit.add('timber', mcyl(0.03, 0.03, 0.4, 5), M(q.x + f.x * 0.2, fy + 1.6, q.z + f.z * 0.2, rockRY, Math.PI / 2), { color: 0.6 });
    kit.add('cloth', mcyl(0.07, 0.06, 0.62, 8), M(q.x + f.x * 0.3, fy + 1.15, q.z + f.z * 0.3, 0, 0.15), { color: [0.4, 0.3, 0.22] });
  }

  // ---------------------------------------------------------------- stage 3: a hut of posts and a gabled thatch roof (HOME), door toward the camp
  const [hx, hz] = P.HOME;
  const hRY = Math.atan2(P.CAMP[0] - hx, P.CAMP[1] - hz);
  const HW = M(hx, gy(hx, hz), hz, hRY);
  const H = (x, y, z, ry = 0, rx = 0, rz = 0) => mul(HW, M(x, y, z, ry, rx, rz));
  kit.forceVis = 13;
  for (const [dx, dz] of [[-1.8, 1.4], [1.8, 1.4], [-1.8, -1.3], [1.8, -1.3], [0, 1.45], [0, -1.35]]) kit.add('bark', mcyl(0.08, 0.095, dx === 0 ? 3.2 : 2.3, 7), H(dx, dx === 0 ? 1.55 : 1.12, dz), { color: [0.62, 0.55, 0.45] });
  for (const dz of [1.4, -1.3]) kit.add('bark', mcyl(0.07, 0.07, 4.0, 7), H(0, 2.25, dz, 0, 0, Math.PI / 2), { color: [0.58, 0.5, 0.4] });
  kit.add('bark', mcyl(0.075, 0.075, 3.6, 7), H(0, 3.15, 0.05, 0, Math.PI / 2, 0), { color: [0.55, 0.47, 0.38] });
  for (const sx of [-1, 1]) {
    // rafters
    for (const dz of [-1.35, -0.45, 0.45, 1.4]) kit.add('bark', tube([[sx * 2.25, 2.0, dz], [0, 3.18, dz]], 0.04, 4, 2), HW, { color: [0.6, 0.52, 0.42] });
    // three overlapping thatch courses per slope
    for (let k = 0; k < 3; k++) {
      const t0 = 0.28 + k * 0.3;
      const x = sx * (2.35 - t0 * 2.2), y = 2.0 + t0 * 1.15 + 0.12;
      kit.add('straw', mbox(1.08, 0.2, 3.7 + (k === 0 ? 0.2 : 0)), H(x, y, 0.05, 0, 0, sx * -0.53), { color: [1.0 - k * 0.05, 0.95 - k * 0.05, 0.85 - k * 0.03] });
    }
  }
  kit.add('straw', mcyl(0.16, 0.16, 3.9, 8), H(0, 3.3, 0.05, 0, Math.PI / 2, 0), { color: [0.85, 0.8, 0.7] });
  // stage 4: woven walls, a door curtain, woodpile, jars, a garden fence
  kit.forceVis = 14;
  kit.add('plank', mbox(0.08, 1.95, 2.6), H(-1.8, 0.98, 0.05), { color: [0.68, 0.6, 0.48] });
  kit.add('plank', mbox(0.08, 1.95, 2.6), H(1.8, 0.98, 0.05), { color: [0.68, 0.6, 0.48] });
  kit.add('plank', mbox(3.6, 1.95, 0.08), H(0, 0.98, -1.3), { color: [0.66, 0.58, 0.46] });
  kit.add('plank', mbox(1.25, 1.95, 0.08), H(-1.15, 0.98, 1.42), { color: [0.68, 0.6, 0.48] });
  kit.add('plank', mbox(1.0, 1.95, 0.08), H(1.25, 0.98, 1.42), { color: [0.68, 0.6, 0.48] });
  kit.add('plank', mbox(3.6, 1.05, 0.06), H(0, 2.6, 1.4), { color: [0.62, 0.55, 0.44] });
  for (const sx of [-1, 1]) kit.add('plank', new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-1.8, 0), new THREE.Vector2(1.8, 0), new THREE.Vector2(0, 1.1)])), H(0, 2.2, sx * 1.33, sx > 0 ? 0 : Math.PI), { color: [0.62, 0.55, 0.44] });
  kit.add('cloth', mbox(0.9, 1.75, 0.03), H(0.12, 0.95, 1.46), { color: [0.5, 0.38, 0.28], sway: 0.15 });
  {
    const old = kit.forceVis;
    kit.forceVis = 14; PR.firewood(kit, H(2.65, 0, 0.3, Math.PI / 2), rand, 0, 21);
    kit.forceVis = 14; PR.jars(kit, H(-2.5, 0, 1.6), rand, 2, 0);
    kit.forceVis = old;
  }
  for (let i = 0; i < 6; i++) { const dx = -3.2 + i * 0.75; kit.add('bark', mcyl(0.04, 0.05, 1.0, 5), H(dx, 0.5, 3.6 + Math.sin(i) * 0.1), { color: [0.6, 0.52, 0.42] }); }
  kit.add('bark', tube([[-3.2, 0.75, 3.6], [0.55, 0.75, 3.6]], 0.03, 4, 4), HW, { color: [0.6, 0.52, 0.42] });
  kit.add('bark', tube([[-3.2, 0.4, 3.6], [0.55, 0.4, 3.6]], 0.03, 4, 4), HW, { color: [0.6, 0.52, 0.42] });

  // ---------------------------------------------------------------- stage 5: a stone for the uncle with incense, herbs at the rock, a training post
  kit.forceVis = 15;
  {
    const [mx, mz] = P.MEMORIAL;
    const ma = Math.atan2(P.CAMP[0] - mx, P.CAMP[1] - mz);
    const g = new THREE.BoxGeometry(0.42, 0.72, 0.15, 2, 3, 1);
    const gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) if (gp.getY(i) > 0.3) gp.setY(i, gp.getY(i) - Math.abs(gp.getX(i)) * 0.25);
    g.computeVertexNormals();
    kit.add('stone', g, L(mx, 0.34, mz, ma), { color: [0.85, 0.85, 0.82] });
    kit.add('plaque', new THREE.PlaneGeometry(0.26, 0.46), L(mx + Math.sin(ma) * 0.078, 0.36, mz + Math.cos(ma) * 0.078, ma), {});
    for (let i = 0; i < 3; i++) kit.add('glow', mcyl(0.005, 0.005, 0.26, 3), L(mx + Math.sin(ma) * 0.36 + (i - 1) * 0.04, 0.13, mz + Math.cos(ma) * 0.36, 0, (i - 1) * 0.1), { color: [0.9, 0.35, 0.1] });
    kit.add('stone', mcyl(0.08, 0.06, 0.06, 8), L(mx + Math.sin(ma) * 0.36, 0.03, mz + Math.cos(ma) * 0.36), { color: 0.6 });
    for (let i = 0; i < 3; i++) kit.add('pottery', msphere(0.035, 6, 4), L(mx + Math.sin(ma) * 0.3 + (i - 1) * 0.09, 0.03, mz + Math.cos(ma) * 0.3 + 0.08), { color: [0.75, 0.2, 0.12] });
  }
  for (let i = 0; i < 3; i++) { const old = kit.forceVis; const q = face.clone().addScaledVector(side, 0.6 + i * 0.5).addScaledVector(f, 0.12); PR.herbBundle(kit, M(q.x, fy + 2.15, q.z), rand, 0); kit.forceVis = old; }
  {
    const px = 7.0, pz = 4.6;
    kit.add('bark', mcyl(0.16, 0.18, 1.9, 9), L(px, 0.95, pz), { color: [0.58, 0.5, 0.4] });
    for (const [y, a] of [[1.35, 0.4], [1.0, -1.2], [0.6, 2.2]]) kit.add('bark', mcyl(0.035, 0.035, 0.6, 5), L(px + Math.cos(a) * 0.3, y, pz + Math.sin(a) * 0.3, -a, 0, Math.PI / 2), { color: [0.55, 0.47, 0.38] });
  }
  // stage 6: a bench by the fire, a herb rack at the hut, pelts drying on the wall
  kit.forceVis = 16;
  { const bx = fx - 1.2, bz = fz + 1.6; PR.bench(kit, L(bx, 0, bz, Math.atan2(fx - bx, fz - bz) + Math.PI / 2), 1.4, 0); }
  kit.forceVis = 16;
  PR.herbRack(kit, H(2.9, 0, 2.2, 0.3), rand, 0);
  kit.forceVis = 16;
  for (let i = 0; i < 2; i++) kit.add('cloth', new THREE.PlaneGeometry(0.7, 0.9), H(-0.7 + i * 1.3, 1.35, 1.5), { color: [0.45, 0.33, 0.22] });
  kit.forceVis = null;

  // ---------------------------------------------------------------- the tally tree: one cut in the pale bark each winter
  const [lx, lz] = P.TALLY;
  const tallyFace = Math.atan2(P.CAMP[0] - lx, P.CAMP[1] - lz);
  const tallyR = 0.25;
  const notches = [];
  for (let i = 1; i <= 6; i++) {
    // one upright cut per winter, side by side around the face toward the camp (a tally: | | | | | |),
    // flush with the bark: the pale lip of fresh wood and the dark slit of the cut inside it
    const a = tallyFace + (i - 3.5) * 0.19;
    const r = 0.236;
    const x = lx + Math.sin(a) * r, z = lz + Math.cos(a) * r;
    const hy = gy(lx, lz) + 1.36 + ((i * 7) % 3 - 1) * 0.012;
    const h = 0.12 + ((i * 5) % 3) * 0.012;
    const tilt = ((i * 3) % 5 - 2) * 0.04;
    kit.add('plank', mbox(0.024, h, 0.012), M(x, hy, z, a, 0, tilt), { vis: 20 + i, color: [1.45, 1.3, 1.02] });
    kit.add('timber', mbox(0.007, h * 0.86, 0.014), M(x + Math.sin(a) * 0.002, hy, z + Math.cos(a) * 0.002, a, 0, tilt), { vis: 20 + i, color: 0.06 });
    notches.push({ pos: V3(x + Math.sin(a) * 0.008, hy, z + Math.cos(a) * 0.008), normal: V3(Math.sin(a), 0, Math.cos(a)) });
  }
  const meshes = kit.build(B);
  applyDepth(meshes, B);
  for (const m of meshes) { m.receiveShadow = true; group.add(m); }

  // the tally tree itself (flora): straight pale trunk, a modest crown of broad leaves
  {
    const T = new GeoBuf(), Lf = new GeoBuf();
    const base = V3(lx, gy(lx, lz) - 0.3, lz);
    const pts = [base, base.clone().add(V3(0.05, 4, 0.04)), base.clone().add(V3(0.12, 8, -0.05)), base.clone().add(V3(0.2, 12.5, 0.1))];
    sweep(T, pts, { radial: 16, segLen: 0.3, radius: t => tallyR * (1 - t * 0.7) * (1 + 0.35 * Math.exp(-t * 12 / 0.5)), displace: (t, a, Pp) => 0.008 * noise3(Pp.x * 9, Pp.y * 2, Pp.z * 9), color: () => [1, 1, 1], uRep: 2, vScale: 1 / 2.4, sway: t => t * t * 0.1 });
    const r2 = rng(66), rect = [cellRect('broadA'), cellRect('broadB')];
    for (let k = 0; k < 7; k++) {
      const y0 = 6.5 + k * 0.85, az = k * 2.4 + r2();
      const st = base.clone().add(V3(0.1, y0, 0));
      const tip = st.clone().add(V3(Math.cos(az) * (2.5 - k * 0.15), 1.6 + r2(), Math.sin(az) * (2.5 - k * 0.15)));
      sweep(T, [st, st.clone().lerp(tip, 0.5).add(V3(0, 0.3, 0)), tip], { radial: 5, segLen: 0.5, radius: t => 0.08 * (1 - t * 0.7), color: () => [0.9, 0.9, 0.9], uRep: 1, vScale: 0.4, sway: t => 0.1 + t * 0.3 });
      for (let i = 0; i < 16; i++) {
        const c = tip.clone().add(V3((r2() - 0.5) * 2.4, (r2() - 0.3) * 1.4, (r2() - 0.5) * 2.4));
        const yaw = r2() * TAU, ay = V3(Math.cos(yaw), 0.3 + r2() * 0.4, Math.sin(yaw)).normalize(), ax = V3().crossVectors(ay, V3(0, 1, 0)).normalize();
        const n = c.clone().sub(base.clone().add(V3(0, 9, 0))).normalize().add(V3(0, 0.6, 0)).normalize();
        card(Lf, c, ax, ay, 1.3, 1.3, rect[i % 2], n, [0.95, 1, 0.9], [0.4, 0.8], r2(), true);
      }
    }
    const pale = fpatch(new THREE.MeshStandardMaterial({ map: F.textures.ancientBark.map, normalMap: F.textures.ancientBark.normal, normalScale: new THREE.Vector2(0.35, 0.35), color: 0xf2ece2, roughness: 0.75 }), { kind: 'bark', wind: true, moss: 0.25, lichen: 0.5, key: 'paleBark' });
    group.add(meshOf(T.build(), pale, F.depth.mapleBark, { name: 'tallyTree' }));
    group.add(meshOf(Lf.build(), F.ancientLeaf, F.depth.ancientLeaf, { name: 'tallyLeaves' }));
  }
  return { group, tallyFace, notches, target, rockFace: { center: face.clone().setY(fy), normal: f.clone() }, materials: B };
}
