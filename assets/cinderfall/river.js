// The river: out of the western hills over a fall, across the valley floor under the bridge, away east.
//
// Its water is one ribbon down the channel the terrain cuts for it (see layout.js), drawn with ripples carried
// downstream (faster in the middle and down the fall), the sky and the sun on them, the bed showing through the
// shallows, foam along the banks, round the rocks that stand in it and churned white under the fall. Spray hangs at
// the fall's foot. Along its banks: reeds and cattails, lily pads and lotus in the slack water, pebbles at the line.
import * as THREE from 'three';
import { riverZ, riverHalfW, riverY, riverD, FALL, roadX, BRIDGE_Z } from './layout.js';
import { U } from './materials.js';
import { rng, lerp, smooth, clamp } from './util.js';

const X0 = -290, X1 = 290;
// rocks standing in the water: [x, offset across (fraction of the half width), radius]
export const RIVER_ROCKS = [[-80, 0.25, 1.1], [-77, -0.4, 0.8], [-71, 0.55, 0.9], [-60, -0.15, 0.7], [-46, 0.62, 0.8],
  [16, -0.58, 0.9], [27, 0.4, 0.6], [44, -0.2, 1.0], [58, 0.66, 0.7], [72, -0.5, 1.2], [90, 0.1, 0.9], [-120, 0.3, 1.3]];

const WATER_VS = `attribute vec2 aRiv; varying vec3 vW; varying vec2 vRiv; varying float vSlope;
#include <fog_pars_vertex>
void main(){
  vRiv = aRiv;
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  vSlope = normal.x;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FS = `uniform float uTime, uSunVis, uNight; uniform sampler2D uNoise;
uniform vec3 uZenith, uHorizon, uSunDir, uSunCol, uGlow, uDeep, uShallow; uniform vec4 uRocks[12];
varying vec3 vW; varying vec2 vRiv; varying float vSlope;
#include <fog_pars_fragment>
float hgt(vec2 q, float v){
  vec2 p1 = vec2(q.x * .085 - uTime * v * .085, q.y * .9);
  vec2 p2 = vec2(q.x * .23 - uTime * v * .22 + .37, q.y * 2.1 + .2);
  return texture2D(uNoise, p1).r * .65 + texture2D(uNoise, p2).g * .35;
}
void main(){
  float t = vRiv.y, at = abs(t);
  float fall = smoothstep(.15, .6, vSlope);
  // (quick in the middle, slack at the edges, racing down the fall)
  float v = mix(.5, 1.7, 1. - at * at) + fall * 9.;
  float e = .35;
  float h0 = hgt(vRiv, v), hx = hgt(vRiv + vec2(e, 0.), v), hz = hgt(vRiv + vec2(0., e * .12), v);
  vec3 N = normalize(vec3((h0 - hx) * 1.6, 1., (h0 - hz) * 1.6 * .6));
  vec3 V = normalize(cameraPosition - vW);
  float fres = .03 + .97 * pow(clamp(1. - dot(N, V), 0., 1.), 5.);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(.0, .55, R.y)) * mix(1., .35, uNight);
  // the body: dark green in the deep middle, the bed showing through the shallows by the banks
  float depthK = 1. - smoothstep(.35, 1., at);
  vec3 body = mix(uShallow, uDeep, depthK);
  vec3 col = mix(body, sky, fres * .9);
  // the sun on the ripples
  float sp = max(dot(R, uSunDir), 0.);
  col += uSunCol * uSunVis * (pow(sp, 260.) * 7. + pow(sp, 24.) * .18);
  // foam: along the banks, round the rocks and behind them, down the fall and below it
  float fn = texture2D(uNoise, vec2(vRiv.x * .3 - uTime * v * .3, t * 3.1)).b;
  float fn2 = texture2D(uNoise, vec2(vRiv.x * .9 - uTime * v * .8, t * 7.3 + .5)).a;
  float foam = smoothstep(.86, 1.04, at + (fn - .5) * .3) * .8;
  for (int i = 0; i < 12; i++) {
    vec4 rk = uRocks[i];
    vec2 d = vW.xz - rk.xy;
    float r = length(d);
    foam += exp(-pow((r - rk.z * 1.05) / .45, 2.)) * .9;
    // (the wake: a tail of churned water downstream)
    float wake = exp(-pow(d.y / (rk.z * (.6 + max(d.x, 0.) * .06)), 2.)) * step(0., d.x) * exp(-d.x / 7.);
    foam += wake * .55;
  }
  float below = exp(-max(vRiv.x - ${FALL.x.toFixed(1)}, 0.) / 9.) * step(${(FALL.x - 0.5).toFixed(1)}, vRiv.x);
  foam += fall * 1.4 + below * (1.1 - at * .4);
  float fm = clamp(foam, 0., 1.4) * smoothstep(.3, .75, fn * .6 + fn2 * .55 + foam * .25);
  col = mix(col, vec3(.92, .95, .96) * mix(1., .3, uNight) + uGlow * .4, clamp(fm, 0., 1.) * .9);
  // the fires of the night on the water
  col += uGlow * (.25 + .75 * fres) * (.6 + .5 * h0);
  float a = mix(.9, .55, smoothstep(.8, 1.15, at)) + fm * .1;
  gl_FragColor = vec4(col, clamp(a, 0., 1.));
  #include <fog_fragment>
}`;

// spray at the foot of the fall: soft billboards drifting up and out
const SPRAY_VS = `attribute vec4 aS; uniform float uTime; varying float vA; varying vec2 vUv;
void main(){
  vUv = uv;
  float life = 2.2 + aS.w * 1.6, t = mod(uTime + aS.w * 17., life) / life;
  vec3 p = vec3(aS.x + t * 4.5 * (aS.w - .3), aS.y + t * (2.8 + aS.w * 2.), aS.z + (aS.w - .5) * t * 3.);
  vec4 c = viewMatrix * vec4(p, 1.);
  c.xy += position.xy * (1.2 + t * 3.);
  vA = sin(3.1416 * t) * .22;
  gl_Position = projectionMatrix * c;
}`;
const SPRAY_FS = `uniform sampler2D uNoise; uniform vec3 uCol; varying float vA; varying vec2 vUv;
void main(){ vec2 q = vUv * 2. - 1.; float r = dot(q, q); if (r > 1.) discard; float n = texture2D(uNoise, vUv * .5 + vA).r; gl_FragColor = vec4(uCol, vA * (1. - r) * (.5 + n)); }`;

export function createRiver(quality) {
  const group = new THREE.Group();
  group.name = 'river';
  // ---------------------------------------------------------------- the water
  const ACROSS = 9;
  const xs = [];
  for (let x = X0; x <= X1;) { xs.push(x); x += Math.abs(x - FALL.x) < FALL.len ? 0.15 : 1.4; }
  const pos = [], riv = [], nrm = [], idx = [];
  xs.forEach((x, i) => {
    const z = riverZ(x), hw = riverHalfW(x) + 1.6, y = riverY(x);
    const dz = (riverZ(x + 0.5) - riverZ(x - 0.5));
    const nx = -dz, nz = 1, l = Math.hypot(nx, nz);
    const slope = Math.abs(riverY(x + 0.3) - riverY(x - 0.3)) / 0.6;
    for (let j = 0; j < ACROSS; j++) {
      const s = j / (ACROSS - 1) * 2 - 1;
      pos.push(x + (nx / l) * hw * s, y, z + (nz / l) * hw * s);
      riv.push(x, s * hw / riverHalfW(x));
      nrm.push(slope, 0, 0);
    }
    if (i) for (let j = 0; j < ACROSS - 1; j++) {
      const a = (i - 1) * ACROSS + j, b = a + ACROSS;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aRiv', new THREE.Float32BufferAttribute(riv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const rocks = RIVER_ROCKS.map(([x, f, r]) => new THREE.Vector4(x, riverZ(x) + f * riverHalfW(x), r, 0));
  const wu = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uZenith: { value: new THREE.Color(0.25, 0.48, 0.82) }, uHorizon: { value: new THREE.Color(0.8, 0.84, 0.86) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.7) }, uSunCol: { value: new THREE.Color(1, 0.9, 0.7) }, uSunVis: { value: 1 },
    uDeep: { value: new THREE.Color(0.035, 0.085, 0.075) }, uShallow: { value: new THREE.Color(0.2, 0.24, 0.16) },
    uGlow: { value: new THREE.Color(0, 0, 0) }, uNight: { value: 0 }, uRocks: { value: rocks },
  }]);
  wu.uNoise = U.uNoise; wu.uTime = U.uTime;
  const mat = new THREE.ShaderMaterial({ uniforms: wu, vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false, fog: true });
  const water = new THREE.Mesh(g, mat);
  water.renderOrder = 2;
  water.name = 'river-water';
  group.add(water);

  // ---------------------------------------------------------------- spray under the fall
  const NS = quality.low ? 40 : 90, r = rng(404);
  const sg = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(2, 2);
  sg.index = base.index; sg.setAttribute('position', base.attributes.position); sg.setAttribute('uv', base.attributes.uv);
  const aS = new Float32Array(NS * 4);
  for (let i = 0; i < NS; i++) {
    const x = FALL.x + 1 + r() * 4, z = riverZ(FALL.x) + (r() * 2 - 1) * riverHalfW(FALL.x) * 0.8;
    aS.set([x, riverY(FALL.x + 2) + 0.2, z, r()], i * 4);
  }
  sg.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 4));
  sg.instanceCount = NS;
  const su = { uTime: U.uTime, uNoise: U.uNoise, uCol: { value: new THREE.Color(0.9, 0.93, 0.95) } };
  const spray = new THREE.Mesh(sg, new THREE.ShaderMaterial({ uniforms: su, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false }));
  spray.frustumCulled = false;
  spray.renderOrder = 3;
  group.add(spray);

  // ---------------------------------------------------------------- lily pads and lotus in the slack water
  const pads = [];
  for (let i = 0; i < 900 && pads.length < (quality.low ? 120 : 260); i++) {
    const x = r.range(-70, 120);
    if (Math.abs(x - roadX(BRIDGE_Z)) < 9) continue;
    const hw = riverHalfW(x), side = r.sign();
    const off = hw * r.range(0.62, 0.95) * side;
    // in drifts, out of the current
    if (Math.sin(x * 0.11 + side * 1.7) < 0.35) continue;
    pads.push([x, riverZ(x) + off, r.range(0.22, 0.48), r() * 6.28, r()]);
  }
  const padGeo = new THREE.CircleGeometry(1, 14, 0.25, Math.PI * 2 - 0.3);
  padGeo.rotateX(-Math.PI / 2);
  const padM = new THREE.InstancedMesh(padGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), pads.length);
  const lotusGeo = new THREE.ConeGeometry(0.16, 0.2, 7, 1, true);
  lotusGeo.translate(0, 0.1, 0);
  const flowers = pads.filter(p => p[4] < 0.14);
  const lotusM = new THREE.InstancedMesh(lotusGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x401820 }), Math.max(1, flowers.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  pads.forEach((p, i) => {
    const y = riverY(p[0]) + 0.02;
    m4.compose(new THREE.Vector3(p[0], y, p[1]), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p[3]), new THREE.Vector3(p[2], 1, p[2]));
    padM.setMatrixAt(i, m4);
    padM.setColorAt(i, c.setRGB(0.16 + p[4] * 0.08, 0.32 + p[4] * 0.1, 0.1));
  });
  flowers.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p[0] + 0.1, riverY(p[0]) + 0.03, p[1]), q.identity(), new THREE.Vector3(1, 1, 1));
    lotusM.setMatrixAt(i, m4);
    lotusM.setColorAt(i, c.setRGB(1, 0.7 + p[4], 0.78));
  });
  lotusM.count = flowers.length;
  for (const m of [padM, lotusM]) { m.receiveShadow = true; m.name = 'river-pads'; group.add(m); }

  return {
    group, water, rocks,
    // the sky's light on it, and the night's
    update({ sky, night = 0, glow = null }) {
      const S = sky.uniforms;
      wu.uZenith.value.copy(S.uZenith.value); wu.uHorizon.value.copy(S.uHorizon.value);
      wu.uSunDir.value.copy(S.uSunDir.value); wu.uSunCol.value.copy(S.uSunCol.value); wu.uSunVis.value = S.uSunVis.value;
      wu.uNight.value = night;
      if (glow) wu.uGlow.value.copy(glow); else wu.uGlow.value.setRGB(0, 0, 0);
      su.uCol.value.setRGB(0.9, 0.93, 0.95).multiplyScalar(1 - night * 0.75);
    },
  };
}

// Reeds and cattails along the banks, pebbles at the waterline, boulders: placed into the world's kit and instanced.
export function riverBankPoints(rand, n, { from = X0 + 10, to = X1 - 10, band = [-0.6, 2.2], skip = null } = {}) {
  const out = [];
  for (let i = 0; i < n * 4 && out.length < n; i++) {
    const x = rand.range(from, to);
    if (skip && skip(x)) continue;
    const side = rand.sign(), hw = riverHalfW(x);
    const d = rand.range(band[0], band[1]);
    const z = riverZ(x) + side * (hw + d);
    out.push({ x, z, side, d });
  }
  return out;
}
