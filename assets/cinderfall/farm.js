// The farmland round the river: rice terraces up the western hillside, flooded from the river by a great waterwheel
// and its flume; a farmstead east of the road with its animals; fishermen's huts on the bank below the bridge.
import * as THREE from 'three';
import { M, mul, mbox, mcyl, tube, Kit } from './geo.js';
import { heightAt, fieldMask, roadX, riverZ, riverY, riverHalfW, riverD, BRIDGE_Z } from './layout.js';
import { U } from './materials.js';
import { rng, lerp, smooth, clamp, fbm } from './util.js';

const TERRACE = 1.3;
export const terraceLevel = (x, z) => fieldMask(x, z) > 0.6 ? Math.round((heightAt(x, z) - 0.25) / TERRACE) : -1;
export const levelY = L => L * TERRACE + 0.25;
// each terrace its own state: flooded and bare (0), young rice (1), or rice grown thick (2)
export const paddyState = L => [1, 2, 0, 2, 1, 1, 2, 0, 1, 2, 1, 2, 0, 1, 2, 1][((L % 16) + 16) % 16];

// ------------------------------------------------------------------ the paddies' water
const PADDY_VS = `attribute float aState; varying vec3 vW; varying float vState;
#include <fog_pars_vertex>
void main(){ vState = aState; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const PADDY_FS = `uniform float uTime, uSunVis, uNight; uniform sampler2D uNoise; uniform vec3 uZenith, uHorizon, uSunDir, uSunCol, uGlow;
varying vec3 vW; varying float vState;
#include <fog_pars_fragment>
void main(){
  vec2 p = vW.xz;
  float n = texture2D(uNoise, p * .05 + uTime * .004).r, n2 = texture2D(uNoise, p * .19 - uTime * .006).g;
  vec3 N = normalize(vec3((n - .5) * .06, 1., (n2 - .5) * .06));
  vec3 V = normalize(cameraPosition - vW);
  float fres = .03 + .97 * pow(clamp(1. - dot(N, V), 0., 1.), 5.);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0., .6, R.y)) * mix(1., .3, uNight);
  vec3 mud = vec3(.16, .14, .08);
  vec3 col = mix(mud, sky, clamp(fres * 1.15 + .12, 0., 1.));
  col += uSunCol * uSunVis * pow(max(dot(R, uSunDir), 0.), 300.) * 5.;
  // rice in rows: young shoots in a grid of tufts, or a sward of it nearly closed over the water
  vec2 rp = vec2(p.x * .7 + p.y * .7, p.y * .7 - p.x * .7) / .42;
  vec2 cell = fract(rp) - .5;
  float tuft = smoothstep(.3, .12, length(cell * vec2(1., 1.6)));
  float young = step(.5, vState) * (1. - step(1.5, vState));
  float lush = step(1.5, vState);
  vec3 rice = mix(vec3(.3, .5, .12), vec3(.45, .62, .18), n2);
  float cover = young * tuft * .85 + lush * smoothstep(.15, .45, n * .6 + tuft * .6 + .2);
  col = mix(col, rice * (.75 + .5 * n), clamp(cover, 0., 1.));
  col += uGlow * (.3 + fres * .6) * (1. - cover);
  gl_FragColor = vec4(col, 1.);
  #include <fog_fragment>
}`;

export function createPaddies(quality) {
  const step = quality.low ? 0.8 : 0.5;
  const X0 = -100, X1 = -18, Z0 = -124, Z1 = -50;
  const nx = Math.round((X1 - X0) / step) + 1, nz = Math.round((Z1 - Z0) / step) + 1;
  const lv = new Int16Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) lv[j * nx + i] = terraceLevel(X0 + i * step, Z0 + j * step);
  const stateOf = paddyState;
  const pos = [], st = [], idx = [];
  const vid = new Int32Array(nx * nz).fill(-1);
  const vert = (i, j) => {
    const k = j * nx + i;
    if (vid[k] < 0) { vid[k] = pos.length / 3; const L = lv[k]; pos.push(X0 + i * step, levelY(L) + 0.06, Z0 + j * step); st.push(stateOf(L)); }
    return vid[k];
  };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = lv[j * nx + i], b = lv[j * nx + i + 1], c = lv[(j + 1) * nx + i], d = lv[(j + 1) * nx + i + 1];
    if (a >= 0 && a === b && a === c) idx.push(vert(i, j), vert(i, j + 1), vert(i + 1, j));
    if (d >= 0 && d === b && d === c) idx.push(vert(i + 1, j), vert(i, j + 1), vert(i + 1, j + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aState', new THREE.Float32BufferAttribute(st, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color() }, uSunVis: { value: 1 }, uNight: { value: 0 }, uGlow: { value: new THREE.Color() },
  }]);
  u.uTime = U.uTime; u.uNoise = U.uNoise;
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: PADDY_VS, fragmentShader: PADDY_FS, fog: true }));
  mesh.name = 'paddies';
  mesh.receiveShadow = false;
  // where rice grows near the road (instanced tufts for the near terraces), and the bunds' grass
  const near = [], bund = [];
  const r = rng(808);
  for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const L = lv[j * nx + i];
    if (L < 0) continue;
    const x = X0 + i * step, z = Z0 + j * step;
    const edge = lv[j * nx + i - 1] !== L || lv[j * nx + i + 1] !== L || lv[(j - 1) * nx + i] !== L || lv[(j + 1) * nx + i] !== L;
    if (edge) { if (r() < 0.55) bund.push({ x: x + r.range(-0.2, 0.2), z: z + r.range(-0.2, 0.2), y: levelY(L) - 0.05, s: r.range(0.6, 1.0), c: [0.34, 0.5, 0.17] }); continue; }
    if (stateOf(L) === 0 || x < roadX(z) - 40) continue;
    if (r() < (stateOf(L) === 2 ? 0.75 : 0.45)) near.push({ x: x + r.range(-0.12, 0.12), z: z + r.range(-0.12, 0.12), y: levelY(L) + 0.02, s: r.range(0.75, 1.2), c: stateOf(L) === 2 ? [0.4, 0.58, 0.16] : [0.36, 0.55, 0.14] });
  }
  return {
    mesh, near, bund,
    update({ sky, night = 0, glow = null }) {
      const S = sky.uniforms;
      u.uZenith.value.copy(S.uZenith.value); u.uHorizon.value.copy(S.uHorizon.value);
      u.uSunDir.value.copy(S.uSunDir.value); u.uSunCol.value.copy(S.uSunCol.value); u.uSunVis.value = S.uSunVis.value;
      u.uNight.value = night;
      if (glow) u.uGlow.value.copy(glow); else u.uGlow.value.setRGB(0, 0, 0);
    },
  };
}

// ------------------------------------------------------------------ the waterwheel and its flume
// A great wheel of timber and bamboo standing in the river by its south bank: paddles on the current turn it, bamboo
// buckets round its rim fill below and spill at the top into a trough, and a flume on trestles carries the water off
// to the terraces. Built as its own pieces so the wheel turns.
export function createWaterwheel(mats, { x = -40, R = 3.2 } = {}) {
  const hw = riverHalfW(x), rz = riverZ(x), wy = riverY(x);
  const C = new THREE.Vector3(x, wy + R - 0.7, rz + hw - 1.3);
  const group = new THREE.Group();
  group.name = 'waterwheel';
  // the wheel (turns about its axle, which runs across the river: local z)
  const wk = new Kit();
  const N = 16, W = 0.9;
  for (const sz of [-1, 1]) {
    // two rims of short planks
    for (let i = 0; i < N * 2; i++) {
      const a = (i / (N * 2)) * Math.PI * 2, len = 2 * Math.PI * R / (N * 2) * 1.04;
      wk.add('timber', mbox(len, 0.16, 0.1), M(Math.cos(a) * R, Math.sin(a) * R, sz * W / 2, 0, 0, a + Math.PI / 2), { color: [0.62, 0.52, 0.42] });
    }
    // and an inner ring
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, len = 2 * Math.PI * R * 0.55 / N * 1.05;
      wk.add('timber', mbox(len, 0.12, 0.08), M(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, sz * W / 2, 0, 0, a + Math.PI / 2), { color: [0.55, 0.46, 0.38] });
    }
  }
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    // spokes, paddles, and a bamboo bucket lashed to the rim, tilted so it fills below and spills at the top
    for (const sz of [-1, 1]) wk.add('timber', mbox(R, 0.09, 0.09), M(Math.cos(a) * R / 2, Math.sin(a) * R / 2, sz * W / 2, 0, 0, a), { color: [0.58, 0.48, 0.4] });
    wk.add('plank', mbox(0.75, 0.05, W + 0.1), M(Math.cos(a) * (R + 0.3), Math.sin(a) * (R + 0.3), 0, 0, 0, a), { color: [0.78, 0.68, 0.55] });
    const ab = a + Math.PI / N;
    wk.add('straw', mcyl(0.09, 0.09, 0.55, 8), M(Math.cos(ab) * (R + 0.05), Math.sin(ab) * (R + 0.05), W / 2 + 0.22, 0, 0, ab + 0.5), { color: [0.95, 0.85, 0.5] });
  }
  wk.add('timber', mcyl(0.32, 0.32, W + 0.3, 12), M(0, 0, 0, 0, Math.PI / 2), { color: 0.5 });
  const wheel = new THREE.Group();
  for (const m of wk.build(mats)) wheel.add(m);
  wheel.position.copy(C);
  group.add(wheel);
  // the axle, its trestles, the trough at the top and the flume away to the terraces (static)
  const sk = new Kit();
  sk.add('timber', mcyl(0.12, 0.12, W + 2.6, 10), M(C.x, C.y, C.z, 0, Math.PI / 2), { color: 0.45 });
  for (const sz of [-1, 1]) {
    const zz = C.z + sz * (W / 2 + 1.0), gy = Math.min(wy - 0.6, heightAt(C.x, zz));
    for (const sx of [-1, 1]) {
      const fx = C.x + sx * 1.3, top = C.y + 0.1;
      const len = Math.hypot(1.3, top - gy);
      sk.add('timber', mbox(0.2, len, 0.2), M((fx + C.x) / 2, (gy + top) / 2, zz, 0, 0, sx * Math.atan2(1.3, top - gy)), { color: 0.5 });
    }
    sk.add('timber', mbox(2.8, 0.18, 0.2), M(C.x, (C.y + gy) / 2, zz), { color: 0.48 });
  }
  // the flume: from the top of the wheel, south and up the slope to the lowest terrace it can feed
  const top = new THREE.Vector3(C.x - 0.2, C.y + R + 0.2, C.z + W / 2 + 0.25);
  const path = [top.clone()];
  let pz = top.z, px = top.x, py = top.y;
  for (let k = 0; k < 14; k++) {
    pz += 1.6; px -= 0.55;
    py -= 0.09;
    path.push(new THREE.Vector3(px, py, pz));
    if (fieldMask(px, pz) > 0.6 && heightAt(px, pz) > py - 0.6 && k > 3) break;
  }
  for (let k = 0; k < path.length - 1; k++) {
    const a = path[k], b = path[k + 1], mid = a.clone().lerp(b, 0.5), len = a.distanceTo(b);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z), pitch = -Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
    // a U of planks
    sk.add('plank', mbox(0.42, 0.05, len + 0.04), mul(M(mid.x, mid.y - 0.14, mid.z, yaw, pitch)), { color: [0.75, 0.66, 0.52] });
    for (const sx of [-1, 1]) sk.add('plank', mbox(0.05, 0.25, len + 0.04), mul(M(mid.x, mid.y, mid.z, yaw, pitch), M(sx * 0.2, 0, 0)), { color: [0.7, 0.6, 0.48] });
    // water in it
    sk.add('glow', mbox(0.32, 0.02, len), mul(M(mid.x, mid.y - 0.06, mid.z, yaw, pitch)), { color: [0.06, 0.1, 0.12] });
    // trestles
    if (k % 2 === 0) {
      const gy = heightAt(mid.x, mid.z);
      if (mid.y - gy > 0.4) for (const sx of [-1, 1]) sk.add('timber', mbox(0.1, mid.y - gy + 0.1, 0.1), mul(M(mid.x, (mid.y + gy) / 2 - 0.15, mid.z, yaw), M(sx * 0.25, 0, 0)), { color: 0.5 });
    }
  }
  for (const m of sk.build(mats)) group.add(m);
  // water spilling from the buckets at the top into the trough, and churned at the foot
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.0), new THREE.MeshBasicMaterial({ color: 0xdfe8ea, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  spill.position.copy(top).add(new THREE.Vector3(0, 0.45, -0.25));
  group.add(spill);
  return {
    group, center: C, wheel,
    update(time) { wheel.rotation.z = -time * 0.42; },
  };
}

// ------------------------------------------------------------------ animals (low, rounded, a little stylised)
const ell = (rx, ry, rz, ws = 10, hs = 7) => { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); return g; };
export function pig(kit, W, rand, spotted = false) {
  const skin = spotted ? [0.3, 0.26, 0.26] : [0.92, 0.66, 0.6];
  kit.add('plaster', ell(0.55, 0.36, 0.36), mul(W, M(0, 0.52, 0)), { color: skin });
  if (spotted) kit.add('plaster', ell(0.3, 0.3, 0.37), mul(W, M(0.12, 0.55, 0)), { color: [0.95, 0.9, 0.86] });
  kit.add('plaster', ell(0.24, 0.22, 0.22), mul(W, M(0.58, 0.58, 0)), { color: skin });
  kit.add('plaster', mcyl(0.09, 0.1, 0.12, 10), mul(W, M(0.82, 0.55, 0, 0, 0, Math.PI / 2)), { color: [0.95, 0.6, 0.58] });
  for (const sz of [-1, 1]) {
    kit.add('plaster', new THREE.ConeGeometry(0.07, 0.14, 4), mul(W, M(0.62, 0.8, sz * 0.13, 0, sz * 0.4, -0.5)), { color: skin });
    for (const sx of [-1, 1]) kit.add('plaster', mcyl(0.06, 0.05, 0.3, 6), mul(W, M(sx * 0.32, 0.17, sz * 0.18)), { color: skin });
  }
}
export function chicken(kit, W, rand, kind = 0) {
  const col = [[0.96, 0.94, 0.9], [0.62, 0.36, 0.18], [0.16, 0.14, 0.13]][kind % 3];
  const peck = rand() < 0.4;
  kit.add('plaster', ell(0.17, 0.14, 0.12), mul(W, M(0, 0.24, 0)), { color: col });
  kit.add('plaster', new THREE.ConeGeometry(0.09, 0.2, 6), mul(W, M(-0.16, 0.32, 0, 0, 0, 0.9)), { color: col.map(v => v * 0.85) });
  const hy = peck ? 0.14 : 0.42, hx = peck ? 0.2 : 0.14;
  kit.add('plaster', ell(0.07, 0.075, 0.065, 8, 6), mul(W, M(hx, hy, 0)), { color: col });
  kit.add('plaster', mbox(0.02, 0.06, 0.07), mul(W, M(hx, hy + 0.08, 0)), { color: [0.85, 0.1, 0.08] });
  kit.add('plaster', new THREE.ConeGeometry(0.022, 0.06, 4), mul(W, M(hx + 0.08, hy - 0.01, 0, 0, 0, -Math.PI / 2)), { color: [0.95, 0.7, 0.2] });
  for (const sz of [-1, 1]) kit.add('timber', mcyl(0.01, 0.01, 0.13, 4), mul(W, M(0.02, 0.07, sz * 0.05)), { color: [0.9, 0.65, 0.2] });
}
export function duck(kit, W, rand) {
  kit.add('plaster', ell(0.2, 0.11, 0.12), mul(W, M(0, 0.07, 0)), { color: [0.92, 0.9, 0.84] });
  kit.add('plaster', ell(0.075, 0.08, 0.07, 8, 6), mul(W, M(0.17, 0.22, 0)), { color: rand() < 0.5 ? [0.92, 0.9, 0.84] : [0.16, 0.36, 0.22] });
  kit.add('plaster', mbox(0.09, 0.02, 0.05), mul(W, M(0.27, 0.2, 0)), { color: [0.95, 0.62, 0.15] });
  kit.add('plaster', new THREE.ConeGeometry(0.06, 0.12, 5), mul(W, M(-0.2, 0.12, 0, 0, 0, 1.1)), { color: [0.9, 0.88, 0.8] });
}
export function goat(kit, W, rand) {
  const col = rand() < 0.5 ? [0.92, 0.9, 0.84] : [0.55, 0.38, 0.24];
  kit.add('plaster', ell(0.42, 0.24, 0.2), mul(W, M(0, 0.72, 0)), { color: col });
  kit.add('plaster', mcyl(0.08, 0.1, 0.3, 8), mul(W, M(0.4, 0.92, 0, 0, 0, -0.6)), { color: col });
  kit.add('plaster', ell(0.16, 0.1, 0.09), mul(W, M(0.55, 1.05, 0, 0, 0, -0.5)), { color: col });
  for (const sz of [-1, 1]) {
    kit.add('timber', tube([[0.5, 1.12, sz * 0.05], [0.42, 1.28, sz * 0.09], [0.32, 1.3, sz * 0.12]], 0.025, 5, 6), W, { color: [0.4, 0.34, 0.28] });
    for (const sx of [-1, 1]) kit.add('plaster', mcyl(0.035, 0.03, 0.5, 6), mul(W, M(sx * 0.27, 0.25, sz * 0.12)), { color: col });
  }
  kit.add('plaster', new THREE.ConeGeometry(0.04, 0.12, 5), mul(W, M(0.62, 0.95, 0, 0, 0, Math.PI)), { color: col.map(v => v * 0.8) });
}
export function ox(kit, W, rand) {
  const col = [0.26, 0.24, 0.24];
  kit.add('plaster', ell(0.95, 0.55, 0.48), mul(W, M(0, 1.05, 0)), { color: col });
  kit.add('plaster', ell(0.36, 0.3, 0.28), mul(W, M(1.05, 1.0, 0, 0, 0, -0.4)), { color: col });
  kit.add('plaster', ell(0.18, 0.15, 0.16), mul(W, M(1.32, 0.86, 0)), { color: [0.35, 0.3, 0.3] });
  for (const sz of [-1, 1]) {
    // the water buffalo's great swept horns
    kit.add('pottery', tube([[1.08, 1.25, sz * 0.18], [1.0, 1.32, sz * 0.5], [0.8, 1.42, sz * 0.66], [0.66, 1.58, sz * 0.56]], 0.06, 6, 8, 0.7), W, { color: [0.7, 0.66, 0.58] });
    for (const sx of [-1, 1]) kit.add('plaster', mcyl(0.11, 0.09, 0.85, 7), mul(W, M(sx * 0.58, 0.42, sz * 0.25)), { color: col });
  }
  kit.add('timber', tube([[-0.92, 1.15, 0], [-1.05, 0.8, 0.05], [-1.08, 0.5, 0.02]], 0.035, 5, 6), W, { color: col });
}

// ------------------------------------------------------------------ the farmstead and the fishermen's huts
// a timber shed: posts, plank walls on three sides (open to the front, +z), a gabled thatch roof
function shed(kit, W, w, d, h, { open = true, stilts = 0 } = {}) {
  const base = stilts;
  if (stilts > 0) {
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) kit.add('timber', mcyl(0.09, 0.1, stilts + 1.2, 6), mul(W, M(sx * w / 2, stilts / 2 - 0.6, sz * d / 2)), { color: 0.45 });
    kit.add('plank', mbox(w + 0.6, 0.1, d + 1.4), mul(W, M(0, base, 0.35)), { color: [0.75, 0.64, 0.5] });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', mbox(0.16, h, 0.16), mul(W, M(sx * w / 2, base + h / 2, sz * d / 2)), { color: 0.55 });
  kit.add('plank', mbox(w, h, 0.07), mul(W, M(0, base + h / 2, -d / 2)), { color: [0.72, 0.6, 0.46] });
  for (const sx of [-1, 1]) kit.add('plank', mbox(0.07, h, d), mul(W, M(sx * w / 2, base + h / 2, 0)), { color: [0.7, 0.58, 0.45] });
  if (!open) kit.add('plank', mbox(w * 0.35, h, 0.07), mul(W, M(-w * 0.3, base + h / 2, d / 2)), { color: [0.72, 0.6, 0.46] });
  // the roof: two thick thatch slopes and a ridge
  const rise = w * 0.32, slope = Math.atan2(rise, w / 2 + 0.5), len = Math.hypot(w / 2 + 0.6, rise);
  for (const sx of [-1, 1]) kit.add('straw', mbox(len, 0.28, d + 1.0), mul(W, M(sx * (w / 4 + 0.15), base + h + rise / 2, 0, 0, 0, -sx * slope)), { color: [0.62, 0.55, 0.42] });
  kit.add('straw', mcyl(0.2, 0.2, d + 1.1, 8), mul(W, M(0, base + h + rise + 0.05, 0, 0, Math.PI / 2)), { color: [0.5, 0.44, 0.34] });
  for (const sz of [-1, 1]) {
    const tri = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
    const g = new THREE.ShapeGeometry(tri);
    kit.add('plank', g, mul(W, M(0, base + h, sz * d / 2, sz < 0 ? Math.PI : 0)), { color: [0.68, 0.56, 0.42] });
  }
}
function haystack(kit, x, y, z, s, rand) {
  kit.add('straw', new THREE.ConeGeometry(1.2 * s, 2.4 * s, 12), M(x, y + 1.6 * s, z, rand() * 6), { color: [1.0, 0.88, 0.55] });
  kit.add('straw', mcyl(1.25 * s, 1.15 * s, 0.9 * s, 12), M(x, y + 0.45 * s, z, rand() * 6), { color: [0.95, 0.82, 0.5] });
  kit.add('timber', mcyl(0.04, 0.04, 1, 4), M(x, y + 2.9 * s, z), { color: 0.5 });
}
function trough(kit, W) {
  kit.add('plank', mbox(1.6, 0.35, 0.5), mul(W, M(0, 0.2, 0)), { color: 0.62 });
  kit.add('glow', mbox(1.45, 0.02, 0.36), mul(W, M(0, 0.36, 0)), { color: [0.05, 0.08, 0.1] });
}
function wattle(kit, pts, g, h = 0.9) {
  // a woven fence: stakes and bands of twigs following the ground
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 0.6));
    for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; kit.add('timber', mcyl(0.03, 0.035, h + 0.25, 4), M(x, g(x, z) + h / 2, z), { color: [0.62, 0.52, 0.4] }); }
    for (const hh of [0.25, 0.45, 0.65, 0.82]) {
      const p = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; return [x, g(x, z) + hh * h, z]; });
      kit.add('straw', tube(p, 0.035, 4, n * 2), null, { color: [0.62, 0.52, 0.36] });
    }
  }
}

export function buildFarmstead(kit, rand, { person = null } = {}) {
  const g = (x, z) => heightAt(x, z);
  const out = { people: [], chimney: [] };
  // the barn, open to the yard and the road
  const bx = 40, bz = -54, by = g(bx, bz);
  const BW = M(bx, by, bz, -Math.PI / 2 + 0.15);
  kit.add('stone', mbox(9.4, 0.4, 7.4), mul(BW, M(0, 0.05, 0)), { color: 0.85 });
  shed(kit, mul(BW, M(0, 0.2, 0)), 9, 7, 3.2, { open: true });
  for (let i = 0; i < 3; i++) haystack(kit, bx + 6 + i * 2.6, g(bx + 6 + i * 2.6, bz + 3 - i), bz + 3 - i, rand.range(0.8, 1.05), rand);
  // inside: bales, a cart, tools
  for (let i = 0; i < 5; i++) kit.add('straw', mbox(1.1, 0.5, 0.6), mul(BW, M(-2.5 + (i % 3) * 1.2, 0.5 + Math.floor(i / 3) * 0.5, -2.2)), { color: [1, 0.86, 0.55] });
  // the yard: chickens loose round the coop, a rooster on the fence
  const cx = 26, cz = -52;
  wattle(kit, [[cx - 4, cz - 3], [cx + 4, cz - 3], [cx + 4, cz + 3], [cx - 4, cz + 3], [cx - 4, cz + 0.8]], g, 0.8);
  shed(kit, M(cx + 2.4, g(cx + 2.4, cz - 1.6), cz - 1.6, Math.PI), 1.8, 1.4, 1.0, { stilts: 0.6 });
  for (let i = 0; i < 12; i++) {
    const x = cx + rand.range(-3.4, 3.4), z = cz + rand.range(-2.4, 2.4);
    chicken(kit, M(x, g(x, z), z, rand() * 6), rand, i % 3);
  }
  for (let i = 0; i < 4; i++) { const x = cx + 5 + rand.range(0, 3), z = cz + rand.range(-2, 3); chicken(kit, M(x, g(x, z), z, rand() * 6), rand, i % 3); }
  // the sty: low stone walls, a lean-to, pigs
  const px = 30, pz = -61;
  const sty = [[px - 3, pz - 2], [px + 3, pz - 2], [px + 3, pz + 2], [px - 3, pz + 2]];
  for (let k = 0; k < 4; k++) if (k !== 3) { const [ax, az] = sty[k], [bx2, bz2] = sty[(k + 1) % 4]; const len = Math.hypot(bx2 - ax, bz2 - az), ang = Math.atan2(bx2 - ax, bz2 - az); kit.add('stone', mbox(0.4, 0.8, len), M((ax + bx2) / 2, g((ax + bx2) / 2, (az + bz2) / 2) + 0.3, (az + bz2) / 2, ang), { color: [0.82, 0.8, 0.74] }); }
  kit.add('straw', mbox(6.4, 0.2, 2.2), M(px, g(px, pz - 1.2) + 1.7, pz - 1.2, 0, 0.35), { color: [0.85, 0.75, 0.55] });
  for (const sx of [-1, 1]) kit.add('timber', mbox(0.12, 1.6, 0.12), M(px + sx * 2.9, g(px + sx * 2.9, pz) + 0.8, pz - 0.2), { color: 0.5 });
  for (let i = 0; i < 5; i++) { const x = px + rand.range(-2.2, 2.2), z = pz + rand.range(-1, 1.4); pig(kit, M(x, g(x, z), z, rand() * 6), rand, i === 2); }
  trough(kit, M(px, g(px, pz + 1.6), pz + 1.6));
  // goats in their pen, the hay rack
  const gx = 44, gz = -63;
  P_fence(kit, [[gx - 3.5, gz - 2.5], [gx + 3.5, gz - 2.5], [gx + 3.5, gz + 2.5], [gx - 3.5, gz + 2.5], [gx - 3.5, gz - 2.5]], g);
  for (let i = 0; i < 4; i++) { const x = gx + rand.range(-2.6, 2.6), z = gz + rand.range(-1.6, 1.6); goat(kit, M(x, g(x, z), z, rand() * 6, 0, 0, rand.range(0.85, 1.05)), rand); }
  kit.add('timber', mbox(1.8, 1.2, 0.5), M(gx + 2.2, g(gx + 2.2, gz - 2) + 0.6, gz - 2), { color: 0.6 });
  kit.add('straw', mbox(1.6, 0.4, 0.45), M(gx + 2.2, g(gx + 2.2, gz - 2) + 1.3, gz - 2), { color: [1, 0.88, 0.55] });
  // a water buffalo grazing, tied by the yard; ducks on the river
  ox(kit, M(20, g(20, -64), -64, 2.4), rand);
  kit.add('timber', mcyl(0.06, 0.07, 1.3, 6), M(18.2, g(18.2, -65) + 0.65, -65), { color: 0.5 });
  for (let i = 0; i < 9; i++) {
    const x = 34 + i * 0.7 + rand.range(-0.2, 0.2), z = riverZ(x) + riverHalfW(x) * 0.35 + Math.sin(i) * 0.4;
    duck(kit, M(x, riverY(x) - 0.03, z, Math.PI + rand.range(-0.3, 0.3), 0, 0, i > 6 ? 0.6 : 1), rand);
  }
  out.chimney.push(new THREE.Vector3(bx + 1, by + 5.5, bz));
  return out;
}
function P_fence(kit, pts, g) {
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) { const t = i / n, x = ax + dx * t, z = az + dz * t; kit.add('timber', mbox(0.1, 1.1, 0.1), M(x, g(x, z) + 0.5, z), { color: [0.7, 0.62, 0.5] }); }
    for (const hh of [0.45, 0.9]) { const p = Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = ax + dx * t, z = az + dz * t; return [x, g(x, z) + hh, z]; }); kit.add('timber', tube(p, 0.035, 4, n * 2), null, { color: [0.72, 0.65, 0.48] }); }
  }
}

// a boat: a narrow hull swept up at both ends, thwarts, and (sometimes) a bamboo canopy amidships
function sampan(kit, W, rand, canopy = true) {
  const L = 5.2, B = 1.15;
  const shape = [];
  const prof = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16 * 2 - 1; prof.push([t * L / 2, 0.42 + Math.pow(Math.abs(t), 3) * 0.55, B / 2 * Math.sqrt(1 - Math.pow(Math.abs(t), 2.4))]); }
  void shape;
  const pos = [], idx = [];
  // the hull as a ring of strips: keel up both sides to the gunwale
  const ring = 7;
  prof.forEach(([x, top, hw]) => {
    for (let k = 0; k < ring; k++) { const a = (k / (ring - 1)) * Math.PI; pos.push(x, top - Math.sin(a) * 0.42 * (hw / (B / 2) * 0.6 + 0.4), Math.cos(a) * hw); }
  });
  for (let i = 0; i < prof.length - 1; i++) for (let k = 0; k < ring - 1; k++) { const a = i * ring + k, b = a + ring; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hull.setIndex(idx);
  hull.computeVertexNormals();
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = pos[i * 3]; uv[i * 2 + 1] = pos[i * 3 + 2]; }
  hull.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const dbl = hull.clone(); dbl.index.array.reverse();
  kit.add('plank', hull, W, { color: [0.6, 0.48, 0.36] });
  kit.add('plank', dbl, W, { color: [0.45, 0.36, 0.27] });
  for (const x of [-1.4, 0, 1.4]) kit.add('plank', mbox(0.18, 0.05, B * 0.9), mul(W, M(x, 0.36, 0)), { color: 0.7 });
  if (canopy) {
    const c = new THREE.CylinderGeometry(0.62, 0.62, 1.8, 10, 1, true, -Math.PI / 2, Math.PI);
    c.rotateZ(Math.PI / 2);
    kit.add('straw', c, mul(W, M(0.2, 0.55, 0)), { color: [0.75, 0.62, 0.42] });
  }
  kit.add('timber', mcyl(0.03, 0.03, 4.2, 5), mul(W, M(-1.6, 0.9, 0.5, 0, 0, 1.25)), { color: 0.55 });
}

export function buildFishing(kit, rand) {
  const g = (x, z) => heightAt(x, z);
  const out = { chimney: [], boats: [] };
  // two huts on stilts at the edge of the south bank, their decks out over the water
  for (const [x, w, d] of [[26, 4.2, 3.4], [41, 3.4, 3.0]]) {
    const hw = riverHalfW(x), rz = riverZ(x);
    const z = rz + hw + 0.6, deck = Math.max(g(x, z + 2), riverY(x) + 1.3) + 0.25;
    const W = M(x, 0, z, Math.PI + rand.range(-0.15, 0.15));
    // stilts down into the riverbed, the deck, the hut on it
    for (const sx of [-1, -0.33, 0.33, 1]) for (const sz of [-1, 0.2, 1.3]) kit.add('timber', mcyl(0.09, 0.11, deck + 2.4, 6), mul(W, M(sx * (w / 2 + 0.3), deck / 2 - 1.1, sz * (d / 2 + 0.6))), { color: 0.42 });
    kit.add('plank', mbox(w + 1.2, 0.12, d + 2.6), mul(W, M(0, deck, 0.7)), { color: [0.74, 0.62, 0.48] });
    shed(kit, mul(W, M(0, deck + 0.06, -0.1)), w, d, 2.1, { open: false });
    // a ladder down to the water, a mooring post
    for (const sx of [-1, 1]) kit.add('timber', mbox(0.07, 2.4, 0.07), mul(W, M(sx * 0.3 + 1.2, deck - 1.0, d / 2 + 1.95, 0, 0.3)), { color: 0.5 });
    for (let k = 0; k < 5; k++) kit.add('timber', mbox(0.66, 0.05, 0.06), mul(W, M(1.2, deck - 0.2 - k * 0.45, d / 2 + 1.8 + k * 0.13)), { color: 0.55 });
    // nets drying on a pole frame beside it, fish on a line
    const rx = x - w / 2 - 2.2, rzz = z + 2.2, ry = g(rx, rzz);
    for (const sx of [-1, 1]) kit.add('timber', mbox(0.08, 2.2, 0.08), M(rx + sx * 1.3, ry + 1.1, rzz), { color: 0.5 });
    kit.add('timber', mcyl(0.04, 0.04, 2.9, 5), M(rx, ry + 2.1, rzz, 0, 0, Math.PI / 2), { color: 0.5 });
    const net = new THREE.PlaneGeometry(2.4, 1.8, 6, 5);
    const np = net.attributes.position;
    for (let i = 0; i < np.count; i++) np.setZ(i, Math.sin(np.getX(i) * 2.1) * 0.12 + (np.getY(i) < 0 ? -np.getY(i) * 0.15 : 0));
    net.computeVertexNormals();
    kit.add('cloth', net, M(rx, ry + 1.15, rzz + 0.05), { color: [0.32, 0.3, 0.24], sway: 0.3 });
    for (let k = 0; k < 7; k++) {
      const fx = rx - 1.1 + k * 0.36;
      kit.add('timber', mcyl(0.004, 0.004, 0.3, 3), M(fx, ry + 1.95, rzz - 0.3), { color: 0.3 });
      const f = new THREE.SphereGeometry(1, 7, 5); f.scale(0.04, 0.16, 0.025);
      kit.add('metal', f, M(fx, ry + 1.7, rzz - 0.3), { color: [0.9, 0.9, 0.85], sway: 0.4 });
    }
    // baskets and a coil of rope by the door
    for (let k = 0; k < 3; k++) kit.add('straw', mcyl(0.22, 0.16, 0.35, 10), mul(W, M(-w / 2 + 0.6 + k * 0.5, deck + 0.24, d / 2 + 0.8)), { color: [0.85, 0.7, 0.45] });
    out.chimney.push(new THREE.Vector3(x, deck + 3.6, z));
  }
  // the great lift net: a square of net hung from two crossed arching bamboos at the end of a long boom that pivots
  // on a post at the water's edge, half lowered into the river
  {
    const x = 33.5, hw = riverHalfW(x), rz = riverZ(x);
    const post = new THREE.Vector3(x, g(x, rz + hw + 0.8), rz + hw + 0.8);
    kit.add('timber', mcyl(0.16, 0.2, 2.6, 8), M(post.x, post.y + 1.3, post.z), { color: 0.45 });
    const tip = new THREE.Vector3(x + 0.3, riverY(x) + 3.4, rz - 0.5);
    const boomA = post.clone().add(new THREE.Vector3(0, 2.4, 2.6)), boomB = tip;
    kit.add('timber', tube([[boomA.x, boomA.y, boomA.z], [post.x, post.y + 2.6, post.z], [(post.x + tip.x) / 2, (post.y + 2.6 + tip.y) / 2 + 0.4, (post.z + tip.z) / 2], [tip.x, tip.y, tip.z]], 0.08, 6, 16, 0.4), null, { color: [0.82, 0.74, 0.5] });
    kit.add('stone', new THREE.IcosahedronGeometry(0.45, 0), M(boomA.x, boomA.y - 0.4, boomA.z), { color: 0.8 });
    // the frame: two bamboos bent into arches, crossed under the tip, their ends holding the net's corners
    const S = 3.6, ny = riverY(x) + 0.15;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3(tip.x + a * S / 2, ny, tip.z + b * S / 2));
    for (const [i, j] of [[0, 2], [1, 3]]) {
      const A = corners[i], B = corners[j], mid = A.clone().lerp(B, 0.5).setY(tip.y - 0.3);
      kit.add('straw', tube([[A.x, A.y, A.z], [(A.x + mid.x) / 2, (A.y + mid.y) / 2 + 0.6, (A.z + mid.z) / 2], [mid.x, mid.y, mid.z], [(B.x + mid.x) / 2, (B.y + mid.y) / 2 + 0.6, (B.z + mid.z) / 2], [B.x, B.y, B.z]], 0.04, 5, 16), null, { color: [0.85, 0.78, 0.5] });
    }
    // the net: a sagging grid of cords
    for (let k = 0; k <= 8; k++) {
      const t = k / 8 * 2 - 1;
      const line = (dir) => Array.from({ length: 9 }, (_, i) => { const s = i / 8 * 2 - 1; const xx = dir ? t : s, zz = dir ? s : t; return [tip.x + xx * S / 2, ny - (1 - xx * xx) * (1 - zz * zz) * 0.9, tip.z + zz * S / 2]; });
      kit.add('timber', tube(line(0), 0.012, 3, 12), null, { color: [0.25, 0.22, 0.18] });
      kit.add('timber', tube(line(1), 0.012, 3, 12), null, { color: [0.25, 0.22, 0.18] });
    }
    for (const c of corners) kit.add('timber', tube([[c.x, c.y, c.z], [tip.x, tip.y - 0.2, tip.z]], 0.008, 3, 4), null, { color: 0.3 });
  }
  // a little pier, a boat moored at it and another out on the water with its fisherman
  {
    const x = 19, hw = riverHalfW(x), rz = riverZ(x);
    const z0 = rz + hw + 1.2, z1 = rz + hw * 0.25, y = riverY(x) + 0.55;
    for (let k = 0; k <= 4; k++) { const zz = lerp(z0, z1, k / 4); for (const sx of [-1, 1]) kit.add('timber', mcyl(0.08, 0.09, 2.6, 6), M(x + sx * 0.6, y - 1.0, zz), { color: 0.42 }); }
    kit.add('plank', mbox(1.5, 0.08, Math.abs(z1 - z0) + 0.6), M(x, y + 0.3, (z0 + z1) / 2), { color: [0.74, 0.62, 0.48] });
    sampan(kit, M(x + 1.8, riverY(x) - 0.35, z1 + 0.6, 0.1), rand, true);
    out.boats.push(new THREE.Vector3(x + 1.8, riverY(x), z1 + 0.6));
  }
  {
    const x = 60, rz = riverZ(x);
    sampan(kit, M(x, riverY(x) - 0.35, rz - 1.0, 0.4), rand, false);
    out.boats.push(new THREE.Vector3(x, riverY(x), rz - 1.0));
    out.fisher = new THREE.Vector3(x - 0.6, riverY(x) + 0.05, rz - 1.0);
  }
  return out;
}
