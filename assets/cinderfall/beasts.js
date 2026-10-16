// Ashen Wolves: lean, oversized, ash-coated beasts with ember-lit fur and crimson vapour at the fangs.
import * as THREE from 'three';
import { U } from './materials.js';
import { rng, lerp } from './util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeJoints } from './people.js';

let furMat = null;
const rimU = { uRimCol: { value: new THREE.Color(1.0, 0.35, 0.12) }, uRimAmt: { value: 1 } };
function fur() {
  if (furMat) return furMat;
  furMat = new THREE.MeshStandardMaterial({ color: 0x2a2522, roughness: 1, metalness: 0 });
  furMat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, rimU, { uNoise: U.uNoise, uTime: U.uTime });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz; vWn=normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn; uniform vec3 uRimCol; uniform float uRimAmt,uTime; uniform sampler2D uNoise;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec3 V=normalize(cameraPosition-vWp);
float rim=pow(clamp(1.-dot(V,normalize(vWn)),0.,1.),2.4);
float fn=texture2D(uNoise,vWp.xz*.9+vWp.y*.7).a;
float emb=smoothstep(.72,.8,fn)*(.5+.5*sin(uTime*4.+fn*30.));
totalEmissiveRadiance+=uRimCol*(rim*1.6+emb*.6)*uRimAmt;`);
  };
  furMat.customProgramCacheKey = () => 'cf-fur';
  return furMat;
}
const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 0.6, 0.15) });
const boneMat = new THREE.MeshStandardMaterial({ color: 0xd8cbb4, roughness: 0.5 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x120f0e, roughness: 1 });

function m(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z); o.scale.set(sx, sy, sz);
  o.castShadow = true;
  parent.add(o);
  return o;
}

export function makeWolf(seed = 1, scale = 1) {
  const r = rng(seed);
  const F = fur();
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 1.05; root.add(body);
  m(new THREE.SphereGeometry(0.5, 14, 10), F, body, 0, 0.02, 0.15, 0.82, 0.8, 1.35);
  m(new THREE.SphereGeometry(0.5, 14, 10), F, body, 0, 0.08, 0.55, 0.95, 0.95, 0.85);
  m(new THREE.SphereGeometry(0.42, 12, 8), F, body, 0, 0.0, -0.45, 0.85, 0.75, 1.1);
  // jagged mane and spine ridge, merged into one mesh
  const spikes = [];
  const spike = (geo, x, y, z, rx, rz) => { const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.updateMatrix(); spikes.push(geo.applyMatrix4(o.matrix)); };
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    spike(new THREE.ConeGeometry(0.07 + (1 - t) * 0.05, 0.42 + r() * 0.25 - t * 0.15, 4), (r() - 0.5) * 0.18, 0.38 + Math.sin(t * Math.PI) * 0.08, 0.85 - t * 1.5, -0.9 - r() * 0.4, (r() - 0.5) * 0.6);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    spike(new THREE.ConeGeometry(0.06, 0.38, 4), Math.cos(a) * 0.36, 0.1 + Math.sin(a) * 0.32, 0.75, -1.3, Math.cos(a) * 0.5);
  }
  m(mergeGeometries(spikes.map(g => g.toNonIndexed())), darkMat, body);
  // neck and head
  const neck = new THREE.Group(); neck.position.set(0, 0.25, 0.9); body.add(neck);
  m(new THREE.CylinderGeometry(0.22, 0.3, 0.55, 10), F, neck, 0, 0.12, 0.08).rotation.x = 1.05;
  const head = new THREE.Group(); head.position.set(0, 0.3, 0.38); neck.add(head);
  m(new THREE.SphereGeometry(0.24, 12, 10), F, head, 0, 0.02, 0, 0.95, 0.8, 1.05);
  const snout = m(new THREE.CylinderGeometry(0.09, 0.15, 0.42, 8), F, head, 0, -0.03, 0.3);
  snout.rotation.x = Math.PI / 2;
  m(new THREE.SphereGeometry(0.05, 6, 5), darkMat, head, 0, 0.0, 0.52);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.1, 0.06); head.add(jaw);
  const jm = m(new THREE.CylinderGeometry(0.06, 0.11, 0.36, 8), F, jaw, 0, -0.02, 0.22);
  jm.rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) {
    m(new THREE.ConeGeometry(0.018, 0.1, 4), boneMat, head, sx * 0.07, -0.1, 0.44).rotation.x = Math.PI;
    m(new THREE.ConeGeometry(0.016, 0.08, 4), boneMat, jaw, sx * 0.05, 0.04, 0.34);
    const ear = m(new THREE.ConeGeometry(0.08, 0.3, 4), F, head, sx * 0.13, 0.24, -0.08);
    ear.rotation.set(-0.35, 0, sx * -0.25);
    m(new THREE.SphereGeometry(0.035, 8, 6), eyeMat, head, sx * 0.11, 0.08, 0.17, 1.3, 0.7, 1);
  }
  // tail
  const tail = new THREE.Group(); tail.position.set(0, 0.15, -0.95); body.add(tail);
  let seg = tail;
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); g.position.z = i ? -0.32 : 0; seg.add(g);
    const c = m(new THREE.ConeGeometry(0.13 - i * 0.03, 0.4, 6), F, g, 0, 0, -0.18);
    c.rotation.x = -Math.PI / 2;
    seg = g;
  }
  // legs: front (z>0) and hind
  const legs = [];
  for (const [lx, lz, front] of [[-0.24, 0.62, 1], [0.24, 0.62, 1], [-0.25, -0.62, 0], [0.25, -0.62, 0]]) {
    const hip = new THREE.Group(); hip.position.set(lx, -0.05, lz); body.add(hip);
    m(new THREE.CylinderGeometry(front ? 0.12 : 0.15, 0.09, 0.55, 8), F, hip, 0, -0.27, 0);
    const knee = new THREE.Group(); knee.position.y = -0.55; hip.add(knee);
    m(new THREE.CylinderGeometry(0.075, 0.06, 0.5, 7), F, knee, 0, -0.25, 0);
    const paw = m(new THREE.SphereGeometry(0.09, 8, 6), darkMat, knee, 0, -0.5, 0.05, 1, 0.6, 1.4);
    legs.push({ hip, knee, front, side: Math.sign(lx) });
  }
  root.scale.setScalar(scale * 1.15);
  bakeJoints(root);
  return { root, body, neck, head, jaw, tail, legs, mouth: () => head.localToWorld(new THREE.Vector3(0, -0.08, 0.5)), seed: r() * 10 };
}

// kind: gallop | prowl | howl | snarl | leap(air)
export function poseWolf(w, kind, t, air = 0) {
  const ph = t + w.seed;
  for (const l of w.legs) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
  w.body.rotation.set(0, 0, 0); w.body.position.y = 1.05; w.neck.rotation.set(0, 0, 0); w.head.rotation.set(0, 0, 0); w.jaw.rotation.set(0, 0, 0);
  if (kind === 'gallop') {
    const f = ph * 9.5;
    for (const l of w.legs) {
      const off = (l.front ? 0 : Math.PI * 0.9) + (l.side > 0 ? 0.35 : 0);
      const s = Math.sin(f + off);
      l.hip.rotation.x = s * (l.front ? 0.85 : 0.75);
      l.knee.rotation.x = (l.front ? -1 : 1) * Math.max(0, Math.cos(f + off)) * 0.9;
    }
    w.body.rotation.x = Math.sin(f + 0.5) * 0.12;
    w.body.position.y = 1.05 + Math.abs(Math.sin(f)) * 0.14;
    w.neck.rotation.x = Math.sin(f + 1.2) * 0.12 + 0.1;
    w.jaw.rotation.x = 0.25 + Math.sin(f) * 0.08;
    w.tail.rotation.x = 0.4 + Math.sin(f) * 0.25;
  } else if (kind === 'prowl') {
    const f = ph * 2.6;
    for (const l of w.legs) {
      const off = (l.front ? 0 : Math.PI) + (l.side > 0 ? Math.PI : 0);
      l.hip.rotation.x = Math.sin(f + off) * 0.38;
      l.knee.rotation.x = (l.front ? -1 : 1) * Math.max(0, Math.cos(f + off)) * 0.5;
    }
    w.body.position.y = 0.92;
    w.neck.rotation.x = 0.55;
    w.head.rotation.x = -0.25;
    w.jaw.rotation.x = 0.35 + Math.sin(ph * 3) * 0.08;
    w.tail.rotation.x = -0.3;
  } else if (kind === 'howl') {
    w.neck.rotation.x = -0.9; w.head.rotation.x = -0.4; w.jaw.rotation.x = 0.5 + Math.sin(ph * 2) * 0.05;
    w.body.rotation.x = -0.25;
    for (const l of w.legs) if (!l.front) { l.hip.rotation.x = 0.5; l.knee.rotation.x = 0.6; }
    w.tail.rotation.x = -0.6;
  } else if (kind === 'snarl') {
    w.body.position.y = 0.86;
    w.neck.rotation.x = 0.7; w.head.rotation.x = -0.45; w.jaw.rotation.x = 0.6 + Math.sin(ph * 11) * 0.05;
    for (const l of w.legs) { l.hip.rotation.x = l.front ? -0.4 : 0.6; l.knee.rotation.x = l.front ? 0.4 : 0.5; }
    w.tail.rotation.x = -0.8;
  } else if (kind === 'leap') {
    for (const l of w.legs) { l.hip.rotation.x = l.front ? -1.2 + air * 0.6 : 1.1 - air * 0.4; l.knee.rotation.x = l.front ? 0.6 : -0.3; }
    w.body.rotation.x = -0.35 + air * 0.6;
    w.neck.rotation.x = -0.1; w.jaw.rotation.x = 0.8;
    w.tail.rotation.x = 0.7;
  }
}

// ------------------------------------------------------------------ Stonehide Boar: a hulking boar whose back is armoured in slabs of rock
const boarFur = new THREE.MeshStandardMaterial({ color: 0x3b2e25, roughness: 1 });
const boarHide = new THREE.MeshStandardMaterial({ color: 0x6d675e, roughness: 0.9, flatShading: true });
const tuskMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.45 });
const boarEye = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.3) });
export function makeBoar(seed = 7, scale = 1.45) {
  const r = rng(seed);
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.95; root.add(body);
  m(new THREE.SphereGeometry(0.6, 16, 12), boarFur, body, 0, 0, -0.1, 0.9, 0.85, 1.45);
  m(new THREE.SphereGeometry(0.62, 16, 12), boarFur, body, 0, 0.12, 0.45, 1.0, 1.05, 0.9);
  // the stone slabs along the back and flanks, merged
  const slabs = [];
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const z = lerp(0.75, -0.95, t) + (r() - 0.5) * 0.1;
    const side = i % 3 === 0 ? 0 : (i % 3 === 1 ? 1 : -1);
    const g = new THREE.DodecahedronGeometry(lerp(0.2, 0.32, r()), 0);
    g.scale(lerp(0.9, 1.4, r()), 0.45, lerp(0.8, 1.2, r()));
    const o = new THREE.Object3D();
    o.position.set(side * lerp(0.28, 0.42, r()), 0.5 + Math.sin(t * Math.PI) * 0.12 - Math.abs(side) * 0.12, z);
    o.rotation.set((r() - 0.5) * 0.5, r() * 6, side * -0.5 + (r() - 0.5) * 0.3);
    o.updateMatrix();
    slabs.push(g.toNonIndexed().applyMatrix4(o.matrix));
  }
  m(mergeGeometries(slabs), boarHide, body);
  // bristles along the spine
  const bristle = [];
  for (let i = 0; i < 16; i++) { const g = new THREE.ConeGeometry(0.035, 0.26, 4); const o = new THREE.Object3D(); o.position.set((r() - 0.5) * 0.08, 0.72, lerp(0.95, -0.4, i / 15)); o.rotation.set(-0.7, 0, (r() - 0.5) * 0.4); o.updateMatrix(); bristle.push(g.toNonIndexed().applyMatrix4(o.matrix)); }
  m(mergeGeometries(bristle), darkMat, body);
  // head
  const neck = new THREE.Group(); neck.position.set(0, 0.0, 0.95); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, -0.08, 0.2); neck.add(head);
  m(new THREE.SphereGeometry(0.36, 14, 10), boarFur, head, 0, 0.02, 0.02, 0.95, 0.9, 1.1);
  const snout = m(new THREE.CylinderGeometry(0.16, 0.26, 0.5, 12), boarFur, head, 0, -0.08, 0.36);
  snout.rotation.x = Math.PI / 2 + 0.25;
  m(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 12), darkMat, head, 0, -0.14, 0.62).rotation.x = Math.PI / 2 + 0.25;
  m(new THREE.DodecahedronGeometry(0.2, 0), boarHide, head, 0, 0.26, 0.05, 1.2, 0.5, 1.1);
  for (const sx of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx * 0.05, 0.08, 0.1), new THREE.Vector3(sx * 0.1, 0.22, 0.12), new THREE.Vector3(sx * 0.08, 0.32, 0.04)]), 8, 0.03, 6), tuskMat);
    tusk.position.set(sx * 0.14, -0.2, 0.42); tusk.castShadow = true; head.add(tusk);
    const ear = m(new THREE.ConeGeometry(0.08, 0.22, 5), boarFur, head, sx * 0.24, 0.26, -0.08); ear.rotation.set(-0.6, 0, sx * -0.7);
    m(new THREE.SphereGeometry(0.03, 8, 6), boarEye, head, sx * 0.19, 0.1, 0.24);
  }
  // legs: short and thick
  const legs = [];
  for (const [lx, lz, front] of [[-0.34, 0.6, 1], [0.34, 0.6, 1], [-0.34, -0.72, 0], [0.34, -0.72, 0]]) {
    const hip = new THREE.Group(); hip.position.set(lx, -0.28, lz); body.add(hip);
    m(new THREE.CylinderGeometry(0.17, 0.12, 0.4, 8), boarFur, hip, 0, -0.18, 0);
    const knee = new THREE.Group(); knee.position.y = -0.38; hip.add(knee);
    m(new THREE.CylinderGeometry(0.09, 0.075, 0.3, 7), boarFur, knee, 0, -0.14, 0);
    m(new THREE.CylinderGeometry(0.085, 0.1, 0.08, 7), darkMat, knee, 0, -0.3, 0.02);
    legs.push({ hip, knee, front, side: Math.sign(lx) });
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.25, -1.0); body.add(tail);
  m(new THREE.CylinderGeometry(0.025, 0.012, 0.3, 5), boarFur, tail, 0, -0.14, 0).rotation.x = 0.4;
  root.scale.setScalar(scale);
  bakeJoints(root);
  return { root, body, neck, head, legs, tail, seed: r() * 10 };
}

// kind: root (snuffling at the ground) | alert | charge | turn
export function poseBoar(b, kind, t, amt = 1) {
  const ph = t + b.seed;
  for (const l of b.legs) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
  b.body.rotation.set(0, 0, 0); b.body.position.y = 0.95; b.neck.rotation.set(0, 0, 0); b.head.rotation.set(0, 0, 0); b.tail.rotation.set(0, 0, 0);
  if (kind === 'root') {
    b.neck.rotation.x = 0.55 + Math.sin(ph * 3.1) * 0.08;
    b.head.rotation.y = Math.sin(ph * 1.3) * 0.2;
    b.body.rotation.x = 0.05;
    b.tail.rotation.z = Math.sin(ph * 6) * 0.5;
    for (const l of b.legs) if (l.front) l.hip.rotation.x = 0.15;
  } else if (kind === 'alert') {
    b.neck.rotation.x = -0.15 * amt;
    b.head.rotation.x = -0.1 * amt;
    b.body.rotation.x = -0.06 * amt;
    for (const l of b.legs) { l.hip.rotation.x = l.front ? -0.1 : 0.2; l.knee.rotation.x = l.front ? 0.1 : 0.15; }
  } else if (kind === 'charge') {
    const f = ph * 8.5;
    for (const l of b.legs) {
      const off = (l.front ? 0 : Math.PI * 0.85) + (l.side > 0 ? 0.4 : 0);
      l.hip.rotation.x = Math.sin(f + off) * 0.75;
      l.knee.rotation.x = (l.front ? -1 : 1) * Math.max(0, Math.cos(f + off)) * 0.8;
    }
    b.body.rotation.x = Math.sin(f + 0.4) * 0.08 + 0.06;
    b.body.position.y = 0.95 + Math.abs(Math.sin(f)) * 0.1;
    b.neck.rotation.x = 0.28;
    b.tail.rotation.x = 0.6;
  }
}
