// Butterflies over the flowers by the road and in the village gardens on the spring morning: each wanders its own
// loose loop round a patch, rising and dipping, its wings beating. One instanced draw, all on the GPU (a pure function
// of the clock), lit and fogged like the rest of the valley.
import * as THREE from 'three';
import { U } from './materials.js';
import { rng } from './util.js';

const KINDS = [
  // [wing colour, edge colour, spot colour]
  [[0.98, 0.93, 0.78], [0.25, 0.22, 0.2], [0.95, 0.75, 0.35]],   // cabbage white
  [[0.98, 0.78, 0.18], [0.2, 0.14, 0.08], [0.98, 0.95, 0.7]],    // brimstone
  [[0.95, 0.45, 0.1], [0.12, 0.08, 0.06], [0.98, 0.9, 0.75]],    // tiger
  [[0.3, 0.52, 0.95], [0.08, 0.1, 0.2], [0.85, 0.92, 1.0]],      // blue
  [[0.18, 0.16, 0.2], [0.05, 0.05, 0.06], [0.2, 0.75, 0.6]],     // swallowtail, dark with a green-blue band
];

// spots: [{x, y, z}] where they gather; n per spot on average
export function createButterflies(spots, { perSpot = 2.2, seed = 77 } = {}) {
  const r = rng(seed);
  const list = [];
  for (const s of spots) {
    const n = Math.max(1, Math.round(perSpot * r.range(0.5, 1.5)));
    const kind = Math.floor(r() * KINDS.length);
    for (let i = 0; i < n; i++) {
      const k = r() < 0.75 ? kind : Math.floor(r() * KINDS.length);
      list.push({ s, rad: r.range(0.8, 2.4), ph: r() * 100, sp: r.range(0.55, 1.0), h: r.range(0.35, 1.3), size: r.range(0.035, 0.06) * (k === 4 ? 1.35 : 1), k, flap: r.range(11, 17) });
    }
  }
  // two wings, each a quad from the body (x = 0) out to x = ±1, chord along z
  const pos = [], uv = [], idx = [];
  for (const sd of [-1, 1]) {
    const b = pos.length / 3;
    pos.push(0, 0, -0.5, sd, 0, -0.5, sd, 0, 0.5, 0, 0, 0.5);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const A = new Float32Array(list.length * 4), B = new Float32Array(list.length * 4), C1 = new Float32Array(list.length * 3), C2 = new Float32Array(list.length * 3), C3 = new Float32Array(list.length * 3);
  let cx = 0, cy = 0, cz = 0;
  list.forEach((b, i) => {
    A.set([b.s.x, b.s.y, b.s.z, b.rad], i * 4);
    B.set([b.ph, b.sp, b.h, b.size], i * 4);
    const K = KINDS[b.k];
    C1.set(K[0], i * 3); C2.set(K[1], i * 3); C3.set(K[2], i * 3);
    cx += b.s.x; cy += b.s.y; cz += b.s.z;
  });
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(B, 4));
  g.setAttribute('aC1', new THREE.InstancedBufferAttribute(C1, 3));
  g.setAttribute('aC2', new THREE.InstancedBufferAttribute(C2, 3));
  g.setAttribute('aC3', new THREE.InstancedBufferAttribute(C3, 3));
  g.instanceCount = list.length;
  const n = Math.max(1, list.length);
  const ctr = new THREE.Vector3(cx / n, cy / n, cz / n);
  let rad = 0;
  for (const b of list) rad = Math.max(rad, ctr.distanceTo(new THREE.Vector3(b.s.x, b.s.y, b.s.z)) + b.rad * 1.5 + 3);
  g.boundingSphere = new THREE.Sphere(ctr, rad);

  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aA, aB; attribute vec3 aC1, aC2, aC3; attribute vec2 aUv; varying vec3 vC1, vC2, vC3; varying vec2 vWing;
uniform float uTime;
vec3 bfPath(float t){
  float R = aA.w;
  return aA.xyz + vec3(sin(t * .71) * R + sin(t * 1.93 + 1.3) * R * .35, aB.z + sin(t * 1.27) * .32 + sin(t * 3.4 + .7) * .1 + .12 * sin(t * 5.3), cos(t * .53) * R + cos(t * 1.71 + 2.1) * R * .3);
}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0., 1., 0.);')
      .replace('#include <begin_vertex>', `
float t = uTime * aB.y + aB.x;
vec3 c = bfPath(t), c2 = bfPath(t + .06);
vec3 v = c2 - c;
float yaw = atan(v.x, v.z);
// (the wings beat, with now and then a glide: held half open)
float glide = smoothstep(.55, .85, sin(t * .37 + aB.x));
float f = mix(sin(uTime * (11. + 6. * fract(aB.x * 3.7)) + aB.x * 9.), .35, glide);
float ang = mix(.12, 1.35, f * .5 + .5);
vec3 p = position;
float s = aB.w;
float side = sign(p.x + 1e-4);
float ax = abs(p.x);
vec3 transformed = vec3(side * ax * cos(ang), ax * sin(ang), p.z) * vec3(s * 1.2, s * 1.2, s);
// (the body pitches a little with the climb)
float pitch = clamp(v.y * 6., -.5, .5);
transformed.yz = mat2(cos(pitch), -sin(pitch), sin(pitch), cos(pitch)) * transformed.yz;
transformed.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * transformed.xz;
transformed += c;
vC1 = aC1; vC2 = aC2; vC3 = aC3; vWing = aUv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vC1, vC2, vC3; varying vec2 vWing;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
// a wing's outline: the forewing (forward, longer) and the hindwing (behind, rounder)
vec2 w = vWing;
float fore = length((w - vec2(.52, .66)) / vec2(.5, .36));
float hind = length((w - vec2(.4, .26)) / vec2(.4, .3));
float d = min(fore, hind);
if (d > 1.) discard;
vec3 col = mix(vC1, vC2, smoothstep(.72, .92, d));
col = mix(col, vC3, smoothstep(.22, .08, length(w - vec2(.62, .68))) * .9);
col = mix(col, vC2, smoothstep(.12, .0, w.x) * .8);
vec4 diffuseColor = vec4(col, 1.);`);
  };
  mat.customProgramCacheKey = () => 'cf-butterflies';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'butterflies';
  mesh.frustumCulled = true;
  return { mesh, count: list.length };
}
