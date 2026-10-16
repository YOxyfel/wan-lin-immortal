// Shan-shui backdrop: karst pillars and cliff walls (vertical runnels, ledges carrying small pines and shrubs),
// waterfall ribbons with falling water and mist at their feet, layered at 150-800 m so they read through fog.
// Also a cheap distant forest to fill the basin between the glade and the cliffs.
import * as THREE from 'three';
import { GeoBuf, card, gridNormals, gridIndex, noise3, fbm3, rng, clamp, lerp, smooth, V3, TAU, U, meshOf, instancedOf } from './flora-core.js';
import { floraMaterials } from './flora-mats.js';
import { cellRect } from './flora-tex.js';
import { FOGU } from './atmosphere.js';
import { createPineStand } from './flora-trees.js';

const UP = V3(0, 1, 0);

// a karst tower: steep walls with vertical runnels, a few ledges, a rounded vegetated top
function pillar(B, r, base, H, R, cols, rows, lean) {
  const ph = r() * 10, ledges = [], ecc = r() * 0.45, eAng = r() * TAU, domeH = 0.1 + r() * 0.28, domeR = 0.7 + r() * 0.35;
  for (let k = 0; k < 3; k++) ledges.push({ y: H * (0.3 + r() * 0.55), d: R * (0.05 + r() * 0.08) });
  const wall = 0.88;
  const rw = y => {
    let rr = R * (1 + 0.1 * Math.sin(y / H * 3.1 + ph) + 0.08 * y / H - 0.12 * Math.exp(-y / (H * 0.08)));
    for (const l of ledges) rr -= l.d * smooth(l.y - 2, l.y + 2, y);
    return rr * (1 + 0.25 * Math.exp(-y / (H * 0.06)));
  };
  const b0 = B.count, tops = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    let y, rad, domeK = 0;
    if (t < wall) { y = H * t / wall * 0.92; rad = rw(y); }
    else { const phi = (t - wall) / (1 - wall) * Math.PI / 2; y = H * 0.92 + H * domeH * Math.sin(phi); rad = rw(H * 0.92) * Math.pow(Math.cos(phi), domeR) * 1.02 + 0.5; domeK = phi / (Math.PI / 2); }
    const c = base.clone().add(V3(lean.x * y, y, lean.z * y));
    for (let j = 0; j <= cols; j++) {
      const a = (j / cols) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const big = fbm3(ca * 1.4 + ph, y / H * 2.2, sa * 1.4, 3);
      const run = 1 - Math.abs(noise3(ca * R * 0.11 + ph, y * 0.012, sa * R * 0.11));
      const el = 1 + ecc * Math.cos(2 * (a - eAng));
      const rr = rad * el * (1 + 0.3 * big) + (run - 0.55) * R * 0.15 * (1 - domeK);
      const ao = (0.62 + 0.38 * run) * (0.55 + 0.45 * smooth(0, H * 0.25, y));
      B.v(c.x + ca * rr, c.y, c.z + sa * rr, ca, domeK, sa, j / cols, y / H, ao, ao, ao, 0, 0);
    }
  }
  gridNormals(B, b0, rows, cols, true);
  gridIndex(B, b0, rows, cols);
  // collect up-facing vertices for vegetation
  const P = B.p, N = B.n;
  for (let i = b0; i < B.count; i++) if (N[i * 3 + 1] > 0.5 && r() < 0.85) tops.push(V3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
  return tops;
}

function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: U.uTime, uNoise: U.uNoise, uSnow: U.uSnow, uA: { value: 0.85 } }]),
    vertexShader: `varying vec2 vUv; varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime, uSnow, uA; uniform sampler2D uNoise; varying vec2 vUv; varying vec3 vW;
#include <fog_pars_fragment>
void main(){
  float n1 = texture2D(uNoise, vec2(vUv.x*2.3, vUv.y*.35 + uTime*.55)).r;
  float n2 = texture2D(uNoise, vec2(vUv.x*6.1 + .3, vUv.y*.9 + uTime*1.3)).g;
  float n3 = texture2D(uNoise, vec2(vUv.x*1.2 + .7, vUv.y*.12 + uTime*.2)).b;
  float edge = smoothstep(0., .22 + n3*.25, vUv.x)*smoothstep(1., .78 - n3*.25, vUv.x);
  float streak = smoothstep(.3, .8, n1*.6 + n2*.55);
  vec3 col = mix(vec3(.62, .68, .7), vec3(.97, .98, 1.), streak);
  float a = (.35 + .6*streak)*edge*smoothstep(0., .04, 1. - vUv.y)*smoothstep(0., .1, vUv.y)*uA;
  a *= 1. - uSnow*.4;
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`,
  });
}
function mistMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: U.uTime, uNoise: U.uNoise, uA: { value: 0.55 } }]),
    vertexShader: `varying vec2 vUv;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix*vec4(position, 1.); gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime, uA; uniform sampler2D uNoise; varying vec2 vUv;
#include <fog_pars_fragment>
void main(){
  vec2 p = vUv - .5;
  float n = texture2D(uNoise, vUv*.7 + vec2(uTime*.02, -uTime*.035)).r*.6 + texture2D(uNoise, vUv*1.6 + vec2(-uTime*.03, -uTime*.05)).g*.4;
  float a = smoothstep(.5, .1, length(p*vec2(1., 1.6)))*smoothstep(.25, .75, n)*uA;
  gl_FragColor = vec4(vec3(.93, .95, .97), a);
  #include <fog_fragment>
}`,
  });
}
const withFog = m => { Object.assign(m.uniforms, FOGU); return m; };

/**
 * createKarstCliffs({ center:[x,z], radii:[min,max], count, seed, groundAt, gap:{angle,width} (keep a view open),
 *   waterfalls:[{angle, dist}] , pines })
 * -> { group, cliffs (meshes), waterfalls [], mist [] }
 */
export function createKarstCliffs(opts = {}) {
  const o = { center: [0, 0], radii: [170, 760], count: 34, seed: 9, groundAt: () => 0, waterfalls: [{ angle: -2.2, dist: 230 }], pines: 10, ...opts };
  const M = floraMaterials();
  const r = rng(o.seed);
  const group = new THREE.Group(); group.name = 'karst';
  const bands = [new GeoBuf(), new GeoBuf(), new GeoBuf()];
  const tops = [];
  const towers = [];
  // waterfall towers first, at requested places
  for (const wf of o.waterfalls) towers.push({ a: wf.angle, d: wf.dist, H: 150 + r() * 60, R: 42 + r() * 12, wf });
  for (let i = 0; i < o.count; i++) {
    const a = r() * TAU, d = lerp(o.radii[0], o.radii[1], Math.pow(r(), 0.9));
    towers.push({ a, d, H: lerp(70, 260, r()) * (0.7 + d / o.radii[1] * 0.5), R: lerp(18, 48, r()) });
  }
  const falls = [], mists = [];
  for (const T of towers) {
    const x = o.center[0] + Math.cos(T.a) * T.d, z = o.center[1] + Math.sin(T.a) * T.d;
    const band = T.d < 320 ? 0 : T.d < 520 ? 1 : 2;
    const cols = [40, 28, 20][band], rows = [32, 22, 14][band];
    const lean = V3((r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.06);
    const base = V3(x, o.groundAt(x, z) - 8, z);
    const tp = pillar(bands[band], r, base, T.H, T.R, cols, rows, lean);
    for (const p of tp) tops.push({ p, band });
    if (T.wf) {
      // a ribbon falling from a notch facing the glade
      const toC = V3(o.center[0] - x, 0, o.center[1] - z).normalize();
      const w = 7 + r() * 5, top = T.H * 0.78, bot = 4;
      const g = new THREE.PlaneGeometry(1, 1, 1, 24);
      const pp = g.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const u = pp.getX(i) + 0.5, v = pp.getY(i) + 0.5;
        const y = lerp(bot, top, v);
        const out = T.R * 1.12 + 3 + (1 - v) * 4 + Math.pow(1 - v, 3) * 6;
        const sideV = V3(-toC.z, 0, toC.x);
        const p0 = base.clone().addScaledVector(toC, out).addScaledVector(sideV, (u - 0.5) * w * (1 + (1 - v) * 0.6)).add(V3(0, y + 8, 0));
        pp.setXYZ(i, p0.x, p0.y, p0.z);
      }
      const fall = new THREE.Mesh(g, withFog(waterMaterial()));
      fall.renderOrder = 3; fall.name = 'waterfall'; fall.frustumCulled = false;
      group.add(fall); falls.push(fall);
      const mm = withFog(mistMaterial());
      for (let k = 0; k < 4; k++) {
        const s = 26 + r() * 22;
        const mg = new THREE.PlaneGeometry(s * 1.6, s);
        const mist = new THREE.Mesh(mg, mm);
        mist.position.copy(base).addScaledVector(toC, T.R * 1.15 + 8 + k * 4).add(V3((r() - 0.5) * 14, 8 + s * 0.3 + k * 2, (r() - 0.5) * 14));
        mist.lookAt(mist.position.clone().add(toC));
        mist.renderOrder = 4; group.add(mist); mists.push(mist);
      }
    }
  }
  const cliffs = bands.map((b, i) => meshOf(b.build(), M.cliff, null, { name: 'karst' + i, cast: false, receive: false }));
  cliffs.forEach(c => group.add(c));
  // vegetation on tops and ledges: dark tufts of pine pads and shrubs
  const tuft = new GeoBuf();
  {
    const rr = rng(o.seed + 5), rect = cellRect('pineTop'), rect2 = cellRect('broadB');
    for (let i = 0; i < 7; i++) {
      const a = rr() * TAU, d = rr() * 0.5;
      const c = V3(Math.cos(a) * d, rr() * 0.35, Math.sin(a) * d);
      const yaw = rr() * TAU, ax = V3(Math.cos(yaw), 0, Math.sin(yaw)), ay = V3(-Math.sin(yaw), 0.35 + rr() * 0.5, Math.cos(yaw)).normalize();
      card(tuft, c.clone().addScaledVector(ay, -0.5), ax, ay, 1.1, 1.1, i < 4 ? rect : rect2, V3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4).normalize(), [0.85, 0.9, 0.8], [0, 0], rr());
    }
  }
  const tg = tuft.build();
  const lists = [[], []];
  for (const t of tops) {
    const s = (7 + r() * 11) * (t.band ? 1.5 : 1);
    lists[t.band ? 1 : 0].push(new THREE.Matrix4().compose(t.p.clone().add(V3(0, -s * 0.15, 0)), new THREE.Quaternion().setFromAxisAngle(UP, r() * TAU), V3(s, s * 0.6, s)));
  }
  lists.forEach((l, i) => { if (l.length) group.add(instancedOf(tg, M.pineNeedle, null, l, { name: 'karstVeg' + i, cast: false, receive: false })); });
  // a few crooked pines on the nearest crests (the painted silhouette)
  const near = tops.filter(t => t.band === 0).sort(() => r() - 0.5).slice(0, o.pines);
  if (near.length) {
    const stand = createPineStand(near.map((t, i) => ({ seed: 900 + i, height: 9 + r() * 7, position: t.p.toArray(), padScale: 1.3, density: 0.6, lean: 1.6 })), { name: 'karstPines' });
    stand.group.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
    group.add(stand.group);
  }
  return { group, cliffs, waterfalls: falls, mist: mists };
}

/**
 * createDistantForest({ center, inner, outer, count, seed, groundAt, avoid }) -> { group }
 * Cheap instanced trees (conifers and broadleaves in seasonal colours) to fill the basin up to the cliffs.
 */
export function createDistantForest(opts = {}) {
  const o = { center: [0, 0], inner: 60, outer: 190, count: 1600, seed: 13, groundAt: () => 0, avoid: [], ...opts };
  const M = floraMaterials();
  const r = rng(o.seed);
  const mk = (rect, layers, conifer) => {
    const F = new GeoBuf(), rr = rng(o.seed + layers);
    for (let l = 0; l < layers; l++) {
      const y = conifer ? 0.35 + l * 0.2 : 0.55 + (rr() - 0.3) * 0.35;
      const rad = conifer ? 0.42 - l * 0.08 : 0.38;
      const n = conifer ? 5 : 7;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + rr();
        const c = V3(Math.cos(a) * rad * 0.6, y + (rr() - 0.5) * 0.12, Math.sin(a) * rad * 0.6);
        const yaw = rr() * TAU, ax = V3(Math.cos(yaw), 0, Math.sin(yaw)), ay = V3(-Math.sin(yaw), conifer ? 0.15 : 0.6, Math.cos(yaw)).normalize();
        const s = conifer ? rad * 1.5 : 0.5;
        card(F, c.clone().addScaledVector(ay, -s / 2), ax, ay, s, s, rect, V3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize(), [0.8, 0.85, 0.8], [0.2, 0.4], rr());
      }
    }
    return F.build();
  };
  const kinds = [[mk(cellRect('pineTop'), 4, true), M.pineNeedle], [mk(cellRect('broadA'), 2, false), M.ancientLeaf], [mk(cellRect('mapleA'), 2, false), M.mapleLeaf]];
  const lists = kinds.map(() => []);
  let tries = 0, n = 0;
  while (n < o.count && tries++ < o.count * 10) {
    const a = r() * TAU, d = Math.sqrt(lerp(o.inner * o.inner, o.outer * o.outer, r()));
    const x = o.center[0] + Math.cos(a) * d, z = o.center[1] + Math.sin(a) * d;
    if (o.avoid.some(c => (x - c[0]) ** 2 + (z - c[1]) ** 2 < c[2] * c[2])) continue;
    const k = r() < 0.5 ? 0 : r() < 0.7 ? 1 : 2;
    const s = (k === 0 ? 18 : 17) * (0.75 + r() * 0.6);
    lists[k].push(new THREE.Matrix4().compose(V3(x, o.groundAt(x, z) - 0.5, z), new THREE.Quaternion().setFromAxisAngle(UP, r() * TAU), V3(s * (k ? 0.9 : 0.6), s, s * (k ? 0.9 : 0.6))));
    n++;
  }
  const group = new THREE.Group(); group.name = 'distantForest';
  kinds.forEach(([g, mat], i) => { if (lists[i].length) group.add(instancedOf(g, mat, null, lists[i], { name: 'distant' + i, cast: false })); });
  return { group };
}

/**
 * createLightShafts({ sunDir: Vector3 (towards the sun), points: [[x,y,z],...] (where shafts leave the canopy),
 *   length, width, color, intensity, seed }) -> { mesh, uniforms }
 * Additive, axis-aligned billboards along the light direction: warm god rays through canopy gaps.
 */
export function createLightShafts(opts = {}) {
  const o = { sunDir: V3(0.6, 0.5, -0.6), points: [], length: 26, width: 1.6, color: 0xffd9a0, intensity: 0.5, seed: 3, ...opts };
  const r = rng(o.seed);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const n = o.points.length;
  const st = new Float32Array(n * 3), prm = new Float32Array(n * 4);
  o.points.forEach((p, i) => { st.set(p, i * 3); prm.set([o.length * (0.7 + r() * 0.6), o.width * (0.5 + r()), r() * 10, 0.6 + r() * 0.6], i * 4); });
  g.setAttribute('aStart', new THREE.InstancedBufferAttribute(st, 3));
  g.setAttribute('aPrm', new THREE.InstancedBufferAttribute(prm, 4));
  g.instanceCount = n;
  const uniforms = { uDir: { value: o.sunDir.clone().normalize().negate() }, uCol: { value: new THREE.Color(o.color) }, uI: { value: o.intensity }, uTime: U.uTime, uNoise: U.uNoise, uAlong: { value: new THREE.Vector2(...(o.along || [0.18, 1.3])) } };
  const mat = new THREE.ShaderMaterial({
    // (additive light; the scene alpha pulled down where it is bright, so the painted pass and the ink lines leave the
    // light alone as before; plain additive blending wrote 2 into it, which the ink pass reads as flame)
    uniforms, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute vec3 aStart; attribute vec4 aPrm; uniform vec3 uDir; varying vec2 vUv; varying float vSeed; varying float vK; varying float vFade;
void main(){
  vec3 P = aStart + uDir*position.y*aPrm.x;
  vec3 toCam = normalize(cameraPosition - P);
  // (never a zero-length side: looking straight up a shaft it would collapse into a wild sliver)
  vec3 sc = cross(uDir, toCam); float sl = length(sc);
  vec3 side = sl > 1e-4 ? sc/sl : vec3(1., 0., 0.);
  float w = aPrm.y*(1. + position.y*.8);
  P += side*position.x*w;
  vUv = vec2(position.x, position.y); vSeed = aPrm.z; vK = aPrm.w;
  vFade = smoothstep(1.5, 6., length(cameraPosition - P));
  gl_Position = projectionMatrix*viewMatrix*vec4(P, 1.);
}`,
    fragmentShader: `uniform vec3 uCol; uniform float uI, uTime; uniform vec2 uAlong; uniform sampler2D uNoise; varying vec2 vUv; varying float vSeed; varying float vK; varying float vFade;
void main(){
  // (clamped: at a multisampled edge the shader runs just outside the card, where 1 - |x| goes negative and the
  // power of it is not a number, drawn as a black line along every shaft's edge)
  float across = pow(clamp(1. - abs(vUv.x), 0., 1.), 2.2);
  float along = smoothstep(0., uAlong.x, vUv.y)*pow(clamp(1. - vUv.y, 0., 1.), uAlong.y);
  float flick = .65 + .35*texture2D(uNoise, vec2(vSeed*.13 + vUv.x*.08, vUv.y*.15 - uTime*.01)).r;
  float dust = .8 + .4*texture2D(uNoise, vec2(vUv.x*.6 + vSeed, vUv.y*2.5 - uTime*.02)).g;
  vec3 c = uCol*across*along*flick*dust*uI*vK*vFade;
  gl_FragColor = vec4(c, clamp(dot(c, vec3(.3, .5, .2)) * 3., 0., 1.));
}`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.name = 'lightShafts';
  return { mesh, uniforms };
}
