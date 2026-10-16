// Things that grow everywhere, drawn by the thousand: clumps of blades of a few kinds (reeds and cattails along the
// river, tall silvergrass with its plumes, meadow grass), berries on the bushes. Instanced in spatial chunks so what is
// off screen is skipped, swaying in the wind like the rest of the valley.
import * as THREE from 'three';
import { U } from './materials.js';
import { rng, lerp } from './util.js';

// a clump of blades: [n blades, height range, width, lean, segments, heads (fraction with a head), head kind]
export const CLUMPS = {
  reed: { n: 7, h: [1.0, 1.9], w: [0.018, 0.03], lean: [0.05, 0.25], spread: 0.18, segs: 4, heads: 0.3, head: 'cattail' },
  tall: { n: 9, h: [0.9, 1.55], w: [0.02, 0.034], lean: [0.2, 0.55], spread: 0.22, segs: 4, heads: 0.35, head: 'plume' },
  meadow: { n: 8, h: [0.45, 0.95], w: [0.022, 0.04], lean: [0.08, 0.35], spread: 0.2, segs: 3, heads: 0.25, head: 'seed' },
  rice: { n: 6, h: [0.32, 0.55], w: [0.012, 0.02], lean: [0.1, 0.3], spread: 0.06, segs: 3, heads: 0, head: null },
};

function clumpGeometry(kind, seed) {
  const C = CLUMPS[kind];
  const r = rng(seed);
  const pos = [], tip = [], hd = [], idx = [];
  for (let b = 0; b < C.n; b++) {
    const ang = r() * Math.PI * 2, off = r() * C.spread, h = r.range(C.h[0], C.h[1]), w = r.range(C.w[0], C.w[1]), lean = r.range(C.lean[0], C.lean[1]);
    const ox = Math.cos(ang) * off, oz = Math.sin(ang) * off;
    const dx = Math.cos(ang + 1.57), dz = Math.sin(ang + 1.57);
    const base = pos.length / 3, segs = C.segs;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, ww = w * (1 - t * 0.85), bend = lean * t * t;
      for (const side of [-1, 1]) {
        pos.push(ox + dx * ww * side + Math.cos(ang) * bend, h * t, oz + dz * ww * side + Math.sin(ang) * bend);
        tip.push(t); hd.push(0);
      }
      if (s) { const a = base + (s - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    // a head on some: a cattail's brown spike, a plume of silvergrass, a meadow grass's seed spray
    if (C.head && r() < C.heads) {
      const hx = ox + Math.cos(ang) * lean, hz = oz + Math.sin(ang) * lean;
      const len = C.head === 'cattail' ? 0.24 : C.head === 'plume' ? 0.24 : 0.12;
      const wid = C.head === 'cattail' ? 0.03 : C.head === 'plume' ? 0.03 : 0.022;
      const y0 = h * (C.head === 'cattail' ? 0.82 : 0.96);
      // two crossed spindles, not cards: a cattail's spike blunt at both ends, a plume of silvergrass and a seed spray
      // narrow at the stem, full in the middle, drawn out to a point and nodding over (their colour from the stem's
      // up into the head's)
      const prof = C.head === 'cattail' ? [[0, 0.55], [0.15, 1], [0.85, 1], [1, 0.4]] : [[0, 0.2], [0.3, 1], [0.7, 0.62], [1, 0]];
      const nod = C.head === 'plume' ? len * 0.45 : C.head === 'seed' ? len * 0.3 : 0.02;
      // (a plume is three strands fanned a little apart, so it reads as a soft spray, not a paddle)
      const nq = C.head === 'plume' ? 3 : 2;
      for (let q = 0; q < nq; q++) {
        const qa = ang + q * Math.PI / nq, qx = Math.cos(qa) * wid, qz = Math.sin(qa) * wid;
        const fan = C.head === 'plume' ? (q - 1) * 0.35 : 0, fx = Math.cos(ang + 1.57) * fan, fz = Math.sin(ang + 1.57) * fan;
        const k = pos.length / 3;
        for (const [t, wk] of prof) {
          const by = y0 + len * t * (1 - 0.25 * t * (nod / len)), bx = hx + Math.cos(ang) * nod * t * t + fx * len * t, bz = hz + Math.sin(ang) * nod * t * t + fz * len * t;
          pos.push(bx - qx * wk, by, bz - qz * wk, bx + qx * wk, by, bz + qz * wk);
          tip.push(1, 1); hd.push(0.45 + 0.55 * Math.min(1, t * 1.6), 0.45 + 0.55 * Math.min(1, t * 1.6));
        }
        for (let s = 0; s < prof.length - 1; s++) { const a = k + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
  g.setAttribute('aHead', new THREE.Float32BufferAttribute(hd, 1));
  g.setIndex(idx);
  return g;
}

// a light passing low over the grass (xyz: where, w: how strong): the blades bow away from it and catch its gold
export const WAKE = { value: new THREE.Vector4(0, -1e4, 0, 0) };
const mats = new Map();
function clumpMaterial(headCol) {
  const key = headCol.join(',');
  if (mats.has(key)) return mats.get(key);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U, { uHeadCol: { value: new THREE.Color(...headCol) }, uWake: WAKE });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aOffset; attribute vec3 aColor; attribute float aTip, aHead; varying vec3 vGC; varying float vTip, vHead, vWake;
uniform float uTime, uWind; uniform vec2 uGust; uniform vec4 uWake, uRing;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0., 1., 0.);')
      .replace('#include <begin_vertex>', `
float a = fract(sin(dot(aOffset.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
vec3 transformed = position * aOffset.w; transformed.xz = R * transformed.xz;
float ph = uTime * 1.7 + aOffset.x * .29 + aOffset.z * .23;
float g = (sin(ph) * .6 + sin(ph * 2.3 + 1.1) * .3 + sin(ph * 4.7) * .1) * uWind;
transformed.xz += uGust * g * aTip * aTip * .34 * aOffset.w;
transformed += aOffset.xyz;
vWake = 0.;
if (uWake.w > 0.) {
  // (bowed away from the light as it goes over, and lit by it)
  vec2 wd = aOffset.xz - uWake.xz; float wl = length(wd);
  float wk = exp(-wl * wl / 30.) * uWake.w * smoothstep(14., 2., abs(uWake.y - aOffset.y));
  transformed.xz += (wl > 1e-3 ? wd / wl : vec2(0.)) * wk * aTip * aTip * .55 * aOffset.w;
  transformed.y -= wk * aTip * aTip * .18 * aOffset.w;
  vWake = wk;
}
if (uRing.w > 0.) {
  // (a ring of light running out over the grass: thrown flat, lit gold)
  vec2 rd = aOffset.xz - uRing.xy; float rl = length(rd);
  float rq = (rl - uRing.z) / 3.2; float rk = exp(-rq * rq) * uRing.w;
  transformed.xz += (rl > 1e-3 ? rd / rl : vec2(0.)) * rk * aTip * aTip * .55 * aOffset.w;
  transformed.y -= rk * aTip * aTip * .2 * aOffset.w;
  vWake = max(vWake, rk);
}
vGC = aColor; vTip = aTip; vHead = aHead;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGC; varying float vTip, vHead, vWake; uniform vec3 uHeadCol;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4(mix(vGC * mix(.45, 1.15, vTip), uHeadCol, vHead), 1.);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1., .72, .36) * vWake * vTip * vTip * 1.6;');
  };
  mat.customProgramCacheKey = () => 'cf-clump-' + key;
  mats.set(key, mat);
  return mat;
}

const HEAD_COL = { cattail: [0.32, 0.2, 0.11], plume: [0.76, 0.69, 0.58], seed: [0.72, 0.66, 0.42], none: [0.5, 0.5, 0.3] };

// points: [{x, y, z, s, c: [r, g, b]}]; returns a group of chunked instanced meshes
export function createClumps(kind, points, { seed = 7, cell = 40, name = kind } = {}) {
  const group = new THREE.Group();
  group.name = 'clumps-' + name;
  if (!points.length) return group;
  const base = clumpGeometry(kind, seed);
  const mat = clumpMaterial(HEAD_COL[CLUMPS[kind].head || 'none']);
  const cells = new Map();
  for (const p of points) {
    const k = Math.floor(p.x / cell) + ',' + Math.floor(p.z / cell);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(p);
  }
  for (const list of cells.values()) {
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    for (const a of ['position', 'aTip', 'aHead']) g.setAttribute(a, base.attributes[a]);
    const off = new Float32Array(list.length * 4), col = new Float32Array(list.length * 3);
    let cx = 0, cz = 0, cy = 0;
    list.forEach((p, i) => { off.set([p.x, p.y, p.z, p.s], i * 4); col.set(p.c, i * 3); cx += p.x; cy += p.y; cz += p.z; });
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 4));
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    g.instanceCount = list.length;
    cx /= list.length; cy /= list.length; cz /= list.length;
    let rad = 0;
    for (const p of list) rad = Math.max(rad, Math.hypot(p.x - cx, p.y - cy, p.z - cz));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), rad + 3);
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.name = 'clumps-' + name;
    group.add(m);
  }
  return group;
}

// Berries: small glossy beads in bunches over a bush's crown. bushes: [{x, y, z, r (crown radius), h (crown top), kind}]
const BERRY = { red: [0.75, 0.06, 0.06], blue: [0.18, 0.22, 0.55], black: [0.12, 0.05, 0.14], orange: [0.95, 0.42, 0.06], white: [0.92, 0.9, 0.86] };
export function createBerries(bushes, seed = 3) {
  const r = rng(seed);
  const geo = new THREE.IcosahedronGeometry(0.03, 1);
  const list = [];
  for (const b of bushes) {
    const n = Math.round(lerp(14, 34, r()) * (b.r / 0.8));
    const col = BERRY[b.kind] || BERRY.red;
    for (let i = 0; i < n; i++) {
      // (in little bunches over the outside of the crown)
      const a = r() * Math.PI * 2, el = r.range(0.15, 1.2), rr = b.r * r.range(0.85, 1.05);
      const x = b.x + Math.cos(a) * Math.cos(el) * rr, z = b.z + Math.sin(a) * Math.cos(el) * rr, y = b.h - b.r + Math.sin(el) * rr * 0.9;
      for (let k = 0; k < 3; k++) list.push([x + r.range(-0.04, 0.04), y + r.range(-0.05, 0.02), z + r.range(-0.04, 0.04), r.range(0.8, 1.25), col]);
    }
  }
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0 }), Math.max(1, list.length));
  const m4 = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion();
  list.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p[0], p[1], p[2]), q, new THREE.Vector3(p[3], p[3], p[3]));
    mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, c.setRGB(...p[4]).multiplyScalar(r.range(0.8, 1.15)));
  });
  mesh.count = list.length;
  mesh.name = 'berries';
  mesh.computeBoundingSphere();
  return mesh;
}
