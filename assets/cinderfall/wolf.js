// The Ashen Wolves: big, lean, ash-dark wolves with ember-lit hackles and violet eyes. Built from lofted parts (a deep
// chest, a tucked waist, heavy haunches, a long skull and snout, thick-topped legs with real joints: shoulder, elbow,
// wrist; hip, stifle, hock), shaggy with swept spikes of fur along the spine, the ruff and the tail.
// API (as beasts.js had): makeWolf(seed, scale) -> { root, body, neck, head, jaw, tail, legs:[{hip, knee, ankle, front, side}], mouth(), seed }
// poseWolf(w, kind, t, air): kind gallop | prowl | snarl | howl | leap (air 0..1 through the jump) | stand.
// t is the gait clock: one gallop stride per 0.66, one prowl stride per 2.4 (callers drive it from ground covered).
import * as THREE from 'three';
import { U } from './materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ materials
let mats = null;
function materials() {
  if (mats) return mats;
  const rimU = { uRimCol: { value: new THREE.Color(1.0, 0.36, 0.12) }, uRimAmt: { value: 1 } };
  const fur = new THREE.MeshStandardMaterial({ color: 0x46413d, roughness: 0.96, metalness: 0, vertexColors: true });
  fur.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, rimU, { uNoise: U.uNoise, uTime: U.uTime });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz; vWn=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn; uniform vec3 uRimCol; uniform float uRimAmt,uTime; uniform sampler2D uNoise;')
      // fur: streaks of ash-grey in the dark coat, darker toward the belly
      .replace('#include <color_fragment>', `#include <color_fragment>
{ float st = texture2D(uNoise, vWp.xz * vec2(3.1, .9) + vWp.y * 2.3).r * .6 + texture2D(uNoise, vWp.xy * vec2(.8, 4.2)).g * .4;
  diffuseColor.rgb *= .72 + st * .62; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec3 Vv=normalize(cameraPosition-vWp);
float rim=pow(clamp(1.-dot(Vv,normalize(vWn)),0.,1.),4.);
float fn=texture2D(uNoise,vWp.xz*.9+vWp.y*.7).a;
float emb=smoothstep(.74,.8,fn)*(.5+.5*sin(uTime*4.+fn*30.));
totalEmissiveRadiance+=uRimCol*(rim*.45+emb*.4)*uRimAmt;`);
  };
  fur.customProgramCacheKey = () => 'cf-wolf-fur';
  mats = {
    fur,
    // (violet: the sect's colour, and only theirs; it stays violet in the ink)
    eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.9, 4.2) }),
    bone: new THREE.MeshStandardMaterial({ color: 0xd9ccb5, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 0.85 }),
    rimU,
  };
  return mats;
}

// ------------------------------------------------------------------ geometry
// A tube through rings [{p:[x,y,z], rx, ry}] (all in one x-plane: its sides face +-x). keel narrows the underside.
function loft(rings, { seg = 14, keel = 0, capA = true, capB = true, shade = null } = {}) {
  const pos = [], col = [], idx = [];
  const X = V(1, 0, 0);
  const P = rings.map(r => V(...r.p));
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const T = P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize();
    const Y = V().crossVectors(T, X).normalize();
    const Xo = V().crossVectors(Y, T).normalize();
    const r = rings[i];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU, c = Math.cos(a), s = Math.sin(a);
      const xr = r.rx * (s < 0 ? 1 - (r.keel ?? keel) * -s : 1);
      const p = P[i].clone().addScaledVector(Xo, c * xr).addScaledVector(Y, s * r.ry);
      pos.push(p.x, p.y, p.z);
      const k = shade ? shade(i / (n - 1), s) : 0.85 + 0.15 * s;
      col.push(k, k, k);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg;
    idx.push(a, c, b, b, c, d);
  }
  const cap = (i, flip) => {
    const ci = pos.length / 3;
    pos.push(P[i].x, P[i].y, P[i].z); col.push(0.8, 0.8, 0.8);
    for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
  };
  if (capA) cap(0, false);
  if (capB) cap(n - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// a swept spike of fur: base at p, pointing along dir
const _q = new THREE.Quaternion(), _up = V(0, 1, 0);
function spike(p, dir, len, rad, sides = 5) {
  const g = new THREE.ConeGeometry(rad, len, sides, 1, false);
  g.translate(0, len / 2, 0);
  g.scale(1, 1, 0.45);    // a flat clump of fur, not a quill
  _q.setFromUnitVectors(_up, dir.clone().normalize());
  g.applyQuaternion(_q);
  g.translate(p.x, p.y, p.z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const t = (g.attributes.position.getY(i) - p.y) / Math.max(len, 1e-3); const k = 0.8 + 0.25 * Math.max(0, t); c.set([k, k, k], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g.index ? g.toNonIndexed() : g;
}
const merge = list => mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g)).map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; }));
function mesh(geo, mat, parent, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; }

// ------------------------------------------------------------------ the wolf
const BODY_Y = 0.86;
export function makeWolf(seed = 1, scale = 1) {
  const r = rng(seed);
  const M = materials();
  const root = new THREE.Group();
  root.name = 'wolf';
  const body = new THREE.Group(); body.position.y = BODY_Y; root.add(body);
  const y = v => v - BODY_Y;   // the parts are designed in standing coordinates; the body group sits at BODY_Y

  // torso: chest deep and narrow-keeled, a tucked waist, heavy haunches
  const shadeTorso = (k, s) => (s < 0 ? 0.62 + 0.25 * (1 + s) : 0.9 + 0.1 * s) * (0.95 + 0.05 * Math.sin(k * 9));
  const torso = loft([
    { p: [0, y(0.86), -0.72], rx: 0.09, ry: 0.09 },
    { p: [0, y(0.885), -0.63], rx: 0.19, ry: 0.19 },
    { p: [0, y(0.87), -0.47], rx: 0.225, ry: 0.235 },
    { p: [0, y(0.875), -0.27], rx: 0.185, ry: 0.19, keel: 0.35 },
    { p: [0, y(0.86), -0.05], rx: 0.205, ry: 0.245, keel: 0.4 },
    { p: [0, y(0.845), 0.18], rx: 0.225, ry: 0.31, keel: 0.45 },
    { p: [0, y(0.885), 0.37], rx: 0.215, ry: 0.305, keel: 0.4 },
    { p: [0, y(0.86), 0.52], rx: 0.17, ry: 0.245, keel: 0.35 },
    { p: [0, y(0.85), 0.6], rx: 0.09, ry: 0.13 },
  ], { seg: 18, shade: shadeTorso });
  // hackles along the spine, shaggy flanks and haunches
  const fur = [];
  for (let i = 0; i < 26; i++) {
    const t = i / 25, z = lerp(0.46, -0.6, t);
    const top = y(0.885 + 0.3 * Math.sin(Math.PI * clamp((z + 0.6) / 1.1)) * (z > 0.2 ? 1 : z > -0.2 ? 0.75 : 0.72) + (z > 0.2 ? 0.02 : 0));
    const len = lerp(0.15, 0.08, t) * (0.8 + r() * 0.4) * (t < 0.3 ? 1.25 : 1);
    for (const sx of [-1, 0, 1]) {
      if (sx && r() < 0.45) continue;
      fur.push(spike(V(sx * 0.06 + (r() - 0.5) * 0.04, top - 0.03 - Math.abs(sx) * 0.03, z), V(sx * 0.45 + (r() - 0.5) * 0.2, 0.35, -1), len * (sx ? 0.75 : 1), 0.038 + r() * 0.012));
    }
  }
  for (let i = 0; i < 22; i++) {
    const sx = i % 2 ? 1 : -1, z = lerp(0.42, -0.62, r()), a = lerp(-0.2, 0.9, r());
    const ry = z > 0 ? 0.29 : 0.22, rx = z > 0 ? 0.21 : 0.2;
    fur.push(spike(V(sx * rx * Math.cos(a) * 0.93, y(0.86) + ry * Math.sin(a) * 0.88, z), V(sx * 0.45, -0.3 + r() * 0.3, -1), 0.07 + r() * 0.05, 0.035));
  }
  mesh(merge([torso, ...fur]), M.fur, body);

  // neck: up and forward from the shoulders, a heavy ruff
  const neck = new THREE.Group(); neck.position.set(0, y(1.0), 0.36); body.add(neck);
  const ny = v => v - 1.0, nz = v => v - 0.36;
  const neckG = loft([
    { p: [0, ny(0.96), nz(0.26)], rx: 0.16, ry: 0.22 },
    { p: [0, ny(1.03), nz(0.42)], rx: 0.15, ry: 0.19 },
    { p: [0, ny(1.11), nz(0.58)], rx: 0.13, ry: 0.155 },
    { p: [0, ny(1.18), nz(0.72)], rx: 0.115, ry: 0.125 },
    { p: [0, ny(1.21), nz(0.8)], rx: 0.1, ry: 0.105 },
  ], { seg: 14 });
  const ruff = [];
  for (let ring = 0; ring < 3; ring++) {
    const zc = lerp(0.42, 0.68, ring / 2), yc = lerp(1.03, 1.16, ring / 2), rr = lerp(0.17, 0.13, ring / 2);
    for (let j = 0; j < 16; j++) {
      const a = (j / 16) * TAU + ring * 0.2, c = Math.cos(a), s = Math.sin(a);
      ruff.push(spike(V(c * rr * 0.92, ny(yc) + s * rr * 1.05, nz(zc)), V(c * 0.7, s * 0.5 + 0.1, -1.1), (0.11 + r() * 0.07) * (s < -0.3 ? 0.75 : 1), 0.045 + r() * 0.01));
    }
  }
  mesh(merge([neckG, ...ruff]), M.fur, neck);

  // head: broad skull, a stop, the long snout; ears up; violet eyes
  const head = new THREE.Group(); head.position.set(0, ny(1.21), nz(0.8)); neck.add(head);
  const skull = loft([
    { p: [0, 0.0, -0.05], rx: 0.09, ry: 0.09 },
    { p: [0, 0.025, 0.03], rx: 0.135, ry: 0.125 },
    { p: [0, 0.03, 0.11], rx: 0.13, ry: 0.115 },
    { p: [0, 0.005, 0.19], rx: 0.095, ry: 0.085 },
    { p: [0, -0.02, 0.28], rx: 0.072, ry: 0.067 },
    { p: [0, -0.035, 0.37], rx: 0.058, ry: 0.052 },
    { p: [0, -0.042, 0.43], rx: 0.04, ry: 0.038 },
  ], { seg: 14, keel: 0.2 });
  const cheeks = [];
  for (let i = 0; i < 10; i++) { const sx = i % 2 ? 1 : -1; cheeks.push(spike(V(sx * 0.11, -0.02 + r() * 0.05, 0.05 + r() * 0.06), V(sx * 0.7, -0.2, -1), 0.09 + r() * 0.05, 0.025)); }
  const ears = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.ConeGeometry(0.06, 0.17, 4, 1); e.translate(0, 0.085, 0);
    e.rotateZ(sx * -0.22); e.rotateX(-0.35); e.translate(sx * 0.07, 0.1, 0.02);
    ears.push(e.index ? e.toNonIndexed() : e);
  }
  mesh(merge([skull, ...cheeks, ...ears.map(g => { const n = g.attributes.position.count; g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.8), 3)); return g; })]), M.fur, head);
  mesh(new THREE.SphereGeometry(0.03, 8, 6).scale(1.2, 0.9, 1).translate(0, -0.03, 0.445), M.dark, head, false);
  for (const sx of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.022, 8, 6).scale(1.3, 0.75, 1).translate(sx * 0.07, 0.035, 0.16), M.eye, head, false);
    mesh(new THREE.ConeGeometry(0.011, 0.05, 4).rotateX(Math.PI).translate(sx * 0.036, -0.07, 0.32), M.bone, head, false);
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.065, 0.06); head.add(jaw);
  const jawG = loft([
    { p: [0, -0.005, 0.0], rx: 0.075, ry: 0.035 },
    { p: [0, -0.02, 0.14], rx: 0.06, ry: 0.032 },
    { p: [0, -0.025, 0.27], rx: 0.045, ry: 0.026 },
    { p: [0, -0.024, 0.35], rx: 0.03, ry: 0.02 },
  ], { seg: 10 });
  mesh(jawG, M.fur, jaw);
  for (const sx of [-1, 1]) mesh(new THREE.ConeGeometry(0.01, 0.042, 4).translate(sx * 0.028, 0.012, 0.27), M.bone, jaw, false);

  // tail: bushy, carried low behind
  const tail = new THREE.Group(); tail.position.set(0, y(0.87), -0.66); body.add(tail);
  const tailG = loft([
    { p: [0, 0.0, -0.02], rx: 0.06, ry: 0.065 },
    { p: [0, -0.07, -0.22], rx: 0.095, ry: 0.1 },
    { p: [0, -0.2, -0.4], rx: 0.105, ry: 0.11 },
    { p: [0, -0.34, -0.52], rx: 0.08, ry: 0.085 },
    { p: [0, -0.43, -0.58], rx: 0.03, ry: 0.03 },
  ], { seg: 10 });
  const tailFur = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15, a = r() * TAU;
    const c = V(0, lerp(-0.02, -0.4, t * t), lerp(-0.05, -0.55, t));
    tailFur.push(spike(c.clone().add(V(Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0)), V(Math.cos(a) * 0.5, Math.sin(a) * 0.5 - 0.5, -1), 0.12 + r() * 0.07, 0.03));
  }
  mesh(merge([tailG, ...tailFur]), M.fur, tail);

  // legs: [x, hip pivot (standing coords), knee pivot (rel. to hip), ankle pivot (rel. to knee), paw (rel. to ankle), radii]
  const legs = [];
  const LEGS = [
    { front: 1, x: 0.13, hip: [0.93, 0.37], knee: [-0.38, -0.1], ankle: [-0.41, 0.02], paw: [-0.105, 0.07], r: [[0.105, 0.16], [0.07, 0.078], [0.06, 0.066], [0.04, 0.043], [0.036, 0.034]] },
    { front: 0, x: 0.125, hip: [0.885, -0.46], knee: [-0.33, 0.16], ankle: [-0.31, -0.22], paw: [-0.205, 0.08], r: [[0.125, 0.18], [0.075, 0.088], [0.064, 0.07], [0.042, 0.048], [0.038, 0.036]] },
  ];
  for (const L of LEGS) for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * L.x, y(L.hip[0]), L.hip[1]); body.add(hip);
    const knee = new THREE.Group(); knee.position.set(0, L.knee[0], L.knee[1]); hip.add(knee);
    const ankle = new THREE.Group(); ankle.position.set(0, L.ankle[0], L.ankle[1]); knee.add(ankle);
    const [ra, rb, rc, rd, re] = L.r;
    // upper: from above the pivot (inside the body) to just past the knee
    const kv = V(0, L.knee[0], L.knee[1]), av = V(0, L.ankle[0], L.ankle[1]), pv = V(0, L.paw[0], L.paw[1]);
    const up = loft([
      { p: [0, 0.16, -0.02], rx: ra[0] * 0.7, ry: ra[1] * 0.75 },
      { p: [0, 0.08, -0.01], rx: ra[0] * 0.95, ry: ra[1] * 0.95 },
      { p: [0, 0.0, 0.0], rx: ra[0], ry: ra[1] },
      { p: [0, kv.y * 0.55, kv.z * 0.55], rx: lerp(ra[0], rb[0], 0.5), ry: lerp(ra[1], rb[1], 0.5) },
      { p: [0, kv.y + 0.01, kv.z], rx: rb[0], ry: rb[1] },
      { p: [0, kv.y - 0.03, kv.z + av.z * 0.08], rx: rb[0] * 0.8, ry: rb[1] * 0.8 },
    ], { seg: 10 });
    const furLeg = [];
    for (let i = 0; i < 6; i++) furLeg.push(spike(V(side * ra[0] * 0.6, kv.y * (0.15 + i * 0.13), kv.z * (0.15 + i * 0.13) - ra[1] * 0.7), V(side * 0.3, -0.7, -1), 0.08 + r() * 0.04, 0.034));
    // a tuft over the joint below (hides the seam where the lower leg turns)
    for (let i = 0; i < 4; i++) furLeg.push(spike(V(side * rb[0] * (i % 2 ? 0.6 : -0.2), kv.y + 0.02, kv.z - rb[1] * 0.4), V(side * 0.2 * (i - 1.5), -0.5, -1), 0.07 + r() * 0.03, 0.035));
    mesh(merge([up, ...furLeg]), M.fur, hip);
    const lo = loft([
      { p: [0, 0.03, 0.0], rx: rb[0] * 0.85, ry: rb[1] * 0.85 },
      { p: [0, 0.0, 0.0], rx: rc[0], ry: rc[1] },
      { p: [0, av.y * 0.5, av.z * 0.5], rx: lerp(rc[0], rd[0], 0.5), ry: lerp(rc[1], rd[1], 0.5) },
      { p: [0, av.y, av.z], rx: rd[0], ry: rd[1] },
      { p: [0, av.y - 0.02, av.z], rx: rd[0] * 0.7, ry: rd[1] * 0.7 },
    ], { seg: 8 });
    mesh(lo, M.fur, knee);
    const foot = loft([
      { p: [0, 0.02, 0.0], rx: rd[0] * 0.9, ry: rd[1] * 0.9 },
      { p: [0, 0.0, 0.0], rx: rd[0], ry: rd[1] },
      { p: [0, pv.y * 0.6, pv.z * 0.6], rx: re[0], ry: re[1] },
      { p: [0, pv.y + 0.01, pv.z], rx: re[0] * 1.15, ry: re[1] * 1.1 },
    ], { seg: 8 });
    const paw = new THREE.SphereGeometry(1, 10, 7).scale(0.056, 0.034, 0.08).translate(0, pv.y - 0.004, pv.z + 0.025);
    const pawC = paw.attributes.position.count; paw.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pawC * 3).fill(0.55), 3));
    mesh(merge([foot, paw]), M.fur, ankle);
    for (let k = -1; k <= 1; k++) mesh(new THREE.ConeGeometry(0.008, 0.04, 4).rotateX(Math.PI / 2 + 0.6).translate(k * 0.022, pv.y - 0.015, pv.z + 0.1), M.dark, ankle, false);
    legs.push({ hip, knee, ankle, front: L.front, side, rest: { kx: 0, ax: 0 } });
  }

  root.scale.setScalar(scale * 1.15);
  const w = { root, body, neck, head, jaw, tail, legs, seed: r() * 10, rimU: M.rimU };
  w.mouth = () => head.localToWorld(V(0, -0.06, 0.42));
  poseWolf(w, 'stand', 0);
  return w;
}

// ------------------------------------------------------------------ poses
// a leg's swing: hip angle (+ = back), knee flex, ankle flex for a gait phase (0..1; stance first)
function gaitLeg(l, ph, A, duty) {
  const st = ph < duty;
  const k = st ? ph / duty : (ph - duty) / (1 - duty);
  const hip = st ? lerp(-A.fwd, A.back, k) : lerp(A.back, -A.fwd, sm(k));
  const lift = st ? 0 : Math.sin(Math.PI * k);
  const comp = st ? Math.sin(Math.PI * k) : 0;
  if (l.front) {
    l.hip.rotation.x = hip;
    l.knee.rotation.x = lift * A.fold + comp * 0.12 - hip * 0.25;
    l.ankle.rotation.x = lift * A.fold * 0.85 - comp * 0.15;
  } else {
    l.hip.rotation.x = hip;
    l.knee.rotation.x = lift * A.fold * 0.55 + comp * 0.18 + 0.05;
    l.ankle.rotation.x = -lift * A.fold * 0.75 - comp * 0.2 - 0.05;
  }
}
export function poseWolf(w, kind, t, air = 0) {
  const ph0 = t + (w.seed || 0);
  for (const l of w.legs) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); l.ankle.rotation.set(0, 0, 0); }
  w.body.rotation.set(0, 0, 0); w.body.position.set(0, BODY_Y, 0);
  w.neck.rotation.set(0, 0, 0); w.head.rotation.set(0, 0, 0); w.jaw.rotation.set(0, 0, 0); w.tail.rotation.set(0, 0, 0);
  const [LF, RF, LH, RH] = [w.legs.find(l => l.front && l.side < 0), w.legs.find(l => l.front && l.side > 0), w.legs.find(l => !l.front && l.side < 0), w.legs.find(l => !l.front && l.side > 0)];
  if (kind === 'gallop') {
    // a rotary gallop: hind left, hind right, front right, front left, then the gathered flight
    const c = ((ph0 * 1.51) % 1 + 1) % 1;
    const A = { fwd: 0.62, back: 0.62, fold: 1.25 };
    gaitLeg(LH, (c + 0.0) % 1, A, 0.36); gaitLeg(RH, (c + 0.92) % 1, A, 0.36);
    gaitLeg(RF, (c + 0.6) % 1, A, 0.34); gaitLeg(LF, (c + 0.5) % 1, A, 0.34);
    const s = Math.sin(TAU * c);
    w.body.rotation.x = 0.08 * Math.sin(TAU * c + 1.2);
    w.body.position.y = BODY_Y - 0.04 + 0.07 * Math.max(0, Math.sin(TAU * c - 1.0));
    w.neck.rotation.x = 0.18 + 0.1 * Math.sin(TAU * c + 2.2);
    w.head.rotation.x = -0.12 - 0.06 * s;
    w.jaw.rotation.x = 0.35 + 0.08 * Math.sin(TAU * c * 2);
    w.tail.rotation.x = -0.55 + 0.12 * s;
  } else if (kind === 'prowl') {
    // stalking: low, a lateral walk, the head carried low and the eyes up
    const c = ((ph0 * 0.41) % 1 + 1) % 1;
    const A = { fwd: 0.32, back: 0.3, fold: 0.7 };
    gaitLeg(LH, c, A, 0.62); gaitLeg(LF, (c + 0.25) % 1, A, 0.62); gaitLeg(RH, (c + 0.5) % 1, A, 0.62); gaitLeg(RF, (c + 0.75) % 1, A, 0.62);
    for (const l of w.legs) { l.knee.rotation.x += l.front ? 0.28 : 0.3; l.ankle.rotation.x += l.front ? -0.25 : -0.32; }
    w.body.position.y = BODY_Y - 0.07 + 0.012 * Math.sin(TAU * c * 2);
    w.body.rotation.x = 0.06;
    w.neck.rotation.x = 0.62;
    w.head.rotation.x = -0.45;
    w.jaw.rotation.x = 0.22 + 0.05 * Math.sin(ph0 * 3);
    w.tail.rotation.x = 0.1;
  } else if (kind === 'snarl') {
    // braced, low in front, hackles up, the jaw wide
    for (const l of w.legs) {
      if (l.front) { l.hip.rotation.x = -0.25; l.knee.rotation.x = 0.55; l.ankle.rotation.x = -0.35; }
      else { l.hip.rotation.x = 0.35; l.knee.rotation.x = 0.4; l.ankle.rotation.x = -0.45; }
    }
    w.body.position.y = BODY_Y - 0.12;
    w.body.rotation.x = 0.1 + 0.015 * Math.sin(ph0 * 9);
    w.neck.rotation.x = 0.55;
    w.head.rotation.x = -0.42;
    w.jaw.rotation.x = 0.62 + 0.06 * Math.sin(ph0 * 11);
    w.tail.rotation.x = 0.35;
  } else if (kind === 'howl') {
    // sitting back on its haunches, muzzle to the sky
    for (const l of w.legs) {
      if (l.front) { l.hip.rotation.x = 0.45; l.knee.rotation.x = -0.1; }
      else { l.hip.rotation.x = -1.35; l.knee.rotation.x = 2.1; l.ankle.rotation.x = -1.6; }
    }
    w.body.rotation.x = -0.62;
    w.body.position.y = BODY_Y - 0.2;
    w.neck.rotation.x = -0.75;
    w.head.rotation.x = -0.55;
    w.jaw.rotation.x = 0.45 + 0.05 * Math.sin(ph0 * 2);
    w.tail.rotation.x = 0.9;
  } else if (kind === 'leap') {
    // push off with the hind legs, stretch out, reach down with the front for the landing
    const a = clamp(air);
    const push = 1 - sm(a / 0.35), reach = sm((a - 0.6) / 0.4);
    for (const l of w.legs) {
      if (l.front) { l.hip.rotation.x = lerp(-0.9, -1.15, sm(a / 0.5)) + reach * 0.6; l.knee.rotation.x = lerp(0.9, 0.15, sm(a / 0.6)) + reach * 0.1; l.ankle.rotation.x = lerp(0.8, 0.1, sm(a / 0.6)); }
      else { l.hip.rotation.x = lerp(1.0, 0.75, a) - reach * 0.9; l.knee.rotation.x = lerp(-0.1, 0.5, reach) + push * 0.05; l.ankle.rotation.x = lerp(0.3, -0.6, reach); }
    }
    w.body.rotation.x = lerp(-0.28, 0.0, sm(a / 0.5)) + reach * 0.22;
    w.neck.rotation.x = 0.05 + reach * 0.2;
    w.head.rotation.x = -0.1;
    w.jaw.rotation.x = 0.55;
    w.tail.rotation.x = -0.75 + a * 0.2;
  } else {
    // standing, breathing
    const b = Math.sin(ph0 * 1.7);
    w.body.position.y = BODY_Y + 0.006 * b;
    w.neck.rotation.x = 0.12 + 0.02 * b;
    w.jaw.rotation.x = 0.15;
    w.tail.rotation.x = -0.1;
  }
}
