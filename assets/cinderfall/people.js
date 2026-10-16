// Jiang Wuhen (a lit, rigged painted card seen over his shoulder) and the procedural people of Cinderfall.
import * as THREE from 'three';
import { U, texURL } from './materials.js';
import { rng, lerp, clamp, smooth } from './util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake every joint's child meshes that share a material into a single mesh (one draw call per joint).
export function bakeJoints(root, unify = null) {
  const groups = [];
  root.traverse(o => { if (!o.isMesh) groups.push(o); });
  for (const g of groups) {
    const kids = g.children.filter(c => c.isMesh && c.children.length === 0);
    if (kids.length < 2 && !unify) continue;
    const byMat = new Map();
    for (const k of kids) {
      let mat = k.material, geo = k.geometry.clone();
      k.updateMatrix();
      geo.applyMatrix4(k.matrix);
      geo = geo.index ? geo.toNonIndexed() : geo;
      if (unify) {
        const n = geo.attributes.position.count;
        if (!geo.attributes.color) { const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([mat.color.r, mat.color.g, mat.color.b], i * 3); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
        if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
        mat = unify;
      }
      for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name);
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push({ geo, k });
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2 && !unify) continue;
      const hasColor = list.some(l => l.geo.attributes.color);
      if (hasColor) for (const l of list) if (!l.geo.attributes.color) { const n = l.geo.attributes.position.count; l.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); }
      const merged = mergeGeometries(list.map(l => l.geo));
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = list[0].k.castShadow; m.receiveShadow = true;
      for (const l of list) g.remove(l.k);
      g.add(m);
    }
  }
}
let unified = null;
export function unifiedMat() {
  if (unified) return unified;
  const t = new THREE.TextureLoader().load(texURL('cloth-albedo'));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace;
  unified = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.92, side: THREE.DoubleSide });
  return unified;
}

// ------------------------------------------------------------------ Wuhen
const CARD = { w: 0.795, h: 1.06, bottom: 0.7, px: 1086, py: 1448, fore: { x: 802, y: 958, w: 149, h: 457, pivot: [76, 32] } };

export function createWanderer() {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(texURL('wuhen-back'));
  const fore = loader.load(texURL('wuhen-forearm'));
  const nrm = loader.load(texURL('wuhen-normal'));
  const hairTex = loader.load(texURL('wuhen-hair'));
  hairTex.colorSpace = THREE.NoColorSpace;
  for (const t of [tex, fore]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  nrm.colorSpace = THREE.NoColorSpace;
  const uniforms = { uRim: { value: new THREE.Color(1, 0.4, 0.15) }, uRimAmt: { value: 0 }, uSelf: { value: 0.3 }, uHair: { value: 1 }, uTime: U.uTime, uWindAmt: U.uWind, uHairMask: { value: hairTex } };
  const mk = (map, hair) => {
    const m = new THREE.MeshStandardMaterial({ map, normalMap: hair ? nrm : null, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform vec3 uRim; uniform float uRimAmt,uSelf,uTime,uWindAmt; uniform sampler2D uHairMask;`)
        .replace('#include <map_fragment>', hair ? `
vec2 cfUv=vMapUv;
float hm=texture2D(uHairMask,vMapUv).r;
float hang=smoothstep(.86,.35,vMapUv.y);
cfUv.x+=hm*hang*(sin(uTime*1.9+vMapUv.y*9.)*.0035+sin(uTime*3.7+vMapUv.y*21.)*.0015)*(.6+uWindAmt);
vec4 sampledDiffuseColor=texture2D(map,cfUv);
diffuseColor*=sampledDiffuseColor;` : '#include <map_fragment>')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec2 cfPx=vec2(.0075,.0056);
float cfA=texture2D(map,vMapUv+vec2(cfPx.x,0.)).a+texture2D(map,vMapUv-vec2(cfPx.x,0.)).a+texture2D(map,vMapUv+vec2(0.,cfPx.y)).a+texture2D(map,vMapUv-vec2(0.,cfPx.y)).a;
float cfRim=clamp(1.-cfA*.25,0.,1.);
totalEmissiveRadiance+=uRim*uRimAmt*(cfRim*2.4+.12)*(diffuseColor.rgb+.2);
totalEmissiveRadiance+=diffuseColor.rgb*uSelf;`);
    };
    m.customProgramCacheKey = () => 'cf-card-' + hair;
    return m;
  };
  const group = new THREE.Group();
  group.name = 'wuhen';
  const body = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h), mk(tex, true));
  body.position.y = CARD.bottom + CARD.h / 2;
  const k = CARD.h / CARD.py;
  const F = CARD.fore;
  const fg = new THREE.PlaneGeometry(F.w * k, F.h * k);
  fg.translate((F.w / 2 - F.pivot[0]) * k, -(F.h / 2 - F.pivot[1]) * k, 0);
  const forearm = new THREE.Mesh(fg, mk(fore, false));
  const pivot = new THREE.Group();
  pivot.position.set((878 / CARD.px - 0.5) * CARD.w, CARD.bottom + (1 - 990 / CARD.py) * CARD.h, -0.014);
  pivot.add(forearm);
  const sway = new THREE.Group();
  sway.add(body, pivot);
  group.add(sway);
  // the painting ends at mid-thigh: 3D trousers, shin wraps and cloth shoes carry him on the ground
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2f3138, roughness: 0.95 });
  const wrapMat = new THREE.MeshStandardMaterial({ color: 0x6e665a, roughness: 0.95 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.8 });
  const legs = new THREE.Group();
  const legParts = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.105, 0.86, 0); legs.add(hip);
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.085, 0.5, 9), legMat); th.position.y = -0.25; hip.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.48; hip.add(knee);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.34, 8), wrapMat); sh.position.y = -0.17; knee.add(sh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.24), shoeMat); foot.position.set(0, -0.35, 0.05); knee.add(foot);
    for (const m of [th, sh, foot]) { m.castShadow = true; m.receiveShadow = true; }
    legParts.push({ hip, knee, side: sx });
  }
  group.add(legs);
  // kneeling: shins and soles folded on the floor behind him
  const kneelLegs = new THREE.Group();
  for (const sx of [-1, 1]) {
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.4, 8), wrapMat);
    shin.rotation.x = Math.PI / 2; shin.position.set(sx * 0.11, 0.07, -0.2);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.07), shoeMat);
    foot.position.set(sx * 0.11, 0.1, -0.42); foot.rotation.x = -0.25;
    for (const m of [shin, foot]) { m.castShadow = true; m.receiveShadow = true; kneelLegs.add(m); }
  }
  kneelLegs.visible = false;
  legs.add(kneelLegs);
  body.castShadow = true;
  body.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  // soft contact shadow
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.03;
  sh.scale.set(1, 0.7, 1);
  group.add(sh);
  body.renderOrder = forearm.renderOrder = 3;
  const state = { walk: 0, run: 0, wave: 0, phase: 0 };
  return {
    group, uniforms, state, body, forearm: pivot,
    // speed: metres per second of travel for gait; wave 0..1; run 0..1
    update(dt, time, camera, { speed = 0, wave = 0, run = 0, rim = 0, heading = null, self = 0.3, kneel = 0, reach = 0, draw = 0, scale = 1 }) {
      state.phase += dt * (speed * (run > 0.5 ? 1.15 : 1.7));
      const p = state.phase;
      const moving = clamp(speed / 1.2) * (1 - kneel);
      group.scale.setScalar(scale);
      state.heading = heading;
      this.face(camera);
      const bob = Math.abs(Math.sin(p * Math.PI)) * (0.025 + run * 0.05) * moving;
      sway.position.y = bob - run * 0.06 - kneel * 0.56;
      sway.rotation.z = Math.sin(p * Math.PI) * 0.012 * moving;
      sway.rotation.x = -run * 0.12 + kneel * 0.07;
      sway.position.x = Math.sin(p * Math.PI) * 0.012 * moving;
      const swing = Math.sin(p * Math.PI) * (0.07 + run * 0.35) * moving;
      const waveAngle = wave * (2.55 + Math.sin(time * 9) * 0.22 * smooth(0.6, 1, wave));
      pivot.rotation.z = waveAngle + swing * (1 - wave) - reach * (0.55 + Math.sin(time * 1.3) * 0.03) + draw * 2.05;
      uniforms.uRimAmt.value = rim;
      uniforms.uSelf.value = self;
      const A = (0.42 + run * 0.4) * moving;
      for (const l of legParts) {
        const ph2 = p * Math.PI + (l.side > 0 ? Math.PI : 0);
        l.hip.rotation.x = Math.sin(ph2) * A;
        l.knee.rotation.x = Math.max(0, -Math.cos(ph2)) * A * 1.5;
        l.hip.visible = kneel < 0.5;
      }
      kneelLegs.visible = kneel >= 0.5;
      legs.position.set(0, bob - run * 0.06, -0.09);
      sh.scale.set(1 + kneel * 0.3, 0.7 + kneel * 0.5, 1);
    },
    // turn the painting to the camera (call once the camera is placed for this frame)
    face(camera) {
      const dx = camera.position.x - group.position.x, dz = camera.position.z - group.position.z;
      group.rotation.y = Math.atan2(dx, dz);
      const h = state.heading;
      legs.rotation.y = h ? Math.atan2(h.x, h.z) - group.rotation.y : Math.PI;
    },
  };
}

// ------------------------------------------------------------------ procedural people
const skinMat = new THREE.MeshStandardMaterial({ color: 0xb48c74, roughness: 0.8 });
let clothMat = null;
function getCloth() {
  if (clothMat) return clothMat;
  const t = new THREE.TextureLoader().load(texURL('cloth-albedo'));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  clothMat = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.95 });
  return clothMat;
}
const hairMat = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.6 });
const greyHairMat = new THREE.MeshStandardMaterial({ color: 0x8d8984, roughness: 0.7 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.45, metalness: 0.7 });
let strawMat = null;
function getStraw() {
  if (strawMat) return strawMat;
  const t = new THREE.TextureLoader().load(texURL('straw-albedo'));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace;
  strawMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  return strawMat;
}

function colored(geo, c) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set(c, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function lathe(profile, seg = 12) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg); }

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function makePerson(opts = {}) {
  const r = rng(opts.seed || 1);
  const s = opts.scale || 1;
  const robe = opts.robe || [0.25, 0.3, 0.45];
  const under = opts.under || [0.85, 0.8, 0.7];
  const pants = opts.pants || [0.28, 0.25, 0.22];
  const long = opts.long ?? false;
  const cloth = getCloth();
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  const legs = [];
  for (const sx of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(sx * 0.1, 0, 0); hips.add(thigh);
    mesh(colored(new THREE.CylinderGeometry(0.075, 0.062, 0.44, 7), pants), cloth, thigh, 0, -0.22, 0);
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
    mesh(colored(new THREE.CylinderGeometry(0.058, 0.045, 0.42, 7), pants), cloth, knee, 0, -0.21, 0);
    mesh(colored(new THREE.BoxGeometry(0.09, 0.06, 0.22), [0.12, 0.1, 0.09]), cloth, knee, 0, -0.44, 0.04);
    legs.push({ thigh, knee });
  }
  const spine = new THREE.Group(); hips.add(spine);
  // torso: robe top, sash
  mesh(colored(lathe([[0.0, 0], [0.18, 0.0], [0.2, 0.18], [0.19, 0.36], [0.2, 0.5], [0.12, 0.58], [0.0, 0.6]]), robe), cloth, spine, 0, -0.02, 0);
  mesh(colored(new THREE.CylinderGeometry(0.205, 0.205, 0.1, 12), opts.sash || [0.55, 0.15, 0.12]), cloth, spine, 0, 0.06, 0);
  mesh(colored(new THREE.BoxGeometry(0.06, 0.32, 0.02), under), cloth, spine, 0.02, 0.38, 0.19).rotation.z = 0.35;
  // skirt
  const skirtLen = long ? 0.8 : 0.42;
  mesh(colored(lathe([[0.2, 0], [0.24, -skirtLen * 0.5], [0.3 + (long ? 0.06 : 0), -skirtLen], [0.0, -skirtLen]], 12), robe), cloth, hips, 0, 0.04, 0).material.side = THREE.DoubleSide;
  // head
  const neck = new THREE.Group(); neck.position.y = 0.6; spine.add(neck);
  mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 6), skinMat, neck, 0, 0.03, 0);
  const head = new THREE.Group(); head.position.y = 0.16; neck.add(head);
  const face = mesh(new THREE.SphereGeometry(0.105, 12, 10), skinMat, head);
  face.scale.set(0.92, 1.08, 1);
  const hm = opts.grey ? greyHairMat : hairMat;
  const cap = mesh(new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hm, head, 0, 0.012, -0.012);
  cap.rotation.x = -0.25;
  if (!opts.hat) mesh(new THREE.SphereGeometry(0.055, 8, 6), hm, head, 0, 0.1, -0.06);
  if (opts.beard) { const b = mesh(new THREE.ConeGeometry(0.05, 0.14, 6), greyHairMat, head, 0, -0.12, 0.06); b.rotation.x = Math.PI + 0.3; }
  if (opts.hat === 'straw') { mesh(new THREE.ConeGeometry(0.3, 0.16, 16, 1, true), getStraw(), head, 0, 0.1, 0).material.side = THREE.DoubleSide; }
  if (opts.hat === 'helmet') { mesh(new THREE.ConeGeometry(0.15, 0.2, 10), metalMat, head, 0, 0.14, 0); mesh(new THREE.TorusGeometry(0.12, 0.02, 4, 12), metalMat, head, 0, 0.05, 0).rotation.x = Math.PI / 2; }
  if (opts.hat === 'cloth') { mesh(colored(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), opts.scarf || [0.75, 0.3, 0.25]), cloth, head, 0, 0.02, -0.01); }
  // arms with wide sleeves
  const arms = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(sx * 0.215, 0.5, 0); spine.add(shoulder);
    mesh(colored(new THREE.CylinderGeometry(0.065, 0.085, 0.3, 7), robe), cloth, shoulder, 0, -0.15, 0);
    const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
    mesh(colored(new THREE.CylinderGeometry(0.085, 0.11, 0.26, 7, 1, true), robe), cloth, elbow, 0, -0.12, 0).material.side = THREE.DoubleSide;
    mesh(new THREE.SphereGeometry(0.042, 7, 6), skinMat, elbow, 0, -0.29, 0);
    arms.push({ shoulder, elbow });
  }
  if (opts.armor) {
    mesh(colored(new THREE.CylinderGeometry(0.23, 0.24, 0.42, 10), [0.2, 0.18, 0.17]), cloth, spine, 0, 0.3, 0);
    for (const sx of [-1, 1]) mesh(colored(new THREE.BoxGeometry(0.16, 0.06, 0.2), [0.3, 0.27, 0.24]), cloth, spine, sx * 0.21, 0.55, 0);
  }
  let prop = null;
  if (opts.spear) {
    prop = new THREE.Group(); arms[1].elbow.add(prop); prop.position.y = -0.28;
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x5a4030 }), prop, 0, 0.6, 0);
    mesh(new THREE.ConeGeometry(0.04, 0.24, 4), metalMat, prop, 0, 1.9, 0);
    if (opts.banner) { const b = mesh(colored(new THREE.PlaneGeometry(0.5, 0.9), [0.7, 0.12, 0.09]), cloth, prop, 0.26, 1.45, 0); b.material.side = THREE.DoubleSide; }
  }
  if (opts.basketBack) mesh(lathe([[0.0, 0], [0.15, 0], [0.2, 0.45], [0.18, 0.47], [0, 0.47]]), getStraw(), spine, 0, 0.15, -0.26);
  if (opts.ponytail) { const t = mesh(new THREE.ConeGeometry(0.045, 0.5, 6), hm, head, 0, -0.16, -0.11); t.rotation.x = Math.PI + 0.12; mesh(new THREE.SphereGeometry(0.03, 6, 5), hm, head, 0, 0.06, -0.1); }
  root.scale.setScalar(s);
  root.traverse(o => { if (o.isMesh) { o.castShadow = !!opts.shadow; o.receiveShadow = true; } });
  bakeJoints(root, opts.unify || unifiedMat());
  return { root, hips, spine, neck, head, legs, arms, prop, seed: r() * 100 };
}

// Pose a person. kind: idle | walk | run | wave | sit | hang | hammer | cower | lie | sweep | carry
export function pose(p, kind, t, amt = 1) {
  const ph = t + p.seed;
  const [L, R] = p.legs, [AL, AR] = p.arms;
  const reset = () => {
    for (const l of p.legs) { l.thigh.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
    for (const a of p.arms) { a.shoulder.rotation.set(0, 0, 0); a.elbow.rotation.set(0, 0, 0); }
    p.spine.rotation.set(0, 0, 0); p.neck.rotation.set(0, 0, 0); p.hips.position.y = 0.92; p.hips.rotation.set(0, 0, 0); p.root.rotation.x = 0; p.root.rotation.z = 0;
  };
  reset();
  const breathe = Math.sin(ph * 1.6) * 0.015;
  p.spine.rotation.x = breathe;
  for (const a of p.arms) a.shoulder.rotation.z = (a === AL ? -1 : 1) * 0.08;
  if (kind === 'walk' || kind === 'run' || kind === 'carry') {
    const run = kind === 'run';
    const f = run ? 9 : 5.2, A = run ? 0.75 : 0.42;
    const w = ph * f;
    L.thigh.rotation.x = Math.sin(w) * A; R.thigh.rotation.x = -Math.sin(w) * A;
    L.knee.rotation.x = Math.max(0, -Math.cos(w)) * A * 1.4; R.knee.rotation.x = Math.max(0, Math.cos(w)) * A * 1.4;
    if (kind !== 'carry') { AL.shoulder.rotation.x = -Math.sin(w) * A * 0.8; AR.shoulder.rotation.x = Math.sin(w) * A * 0.8; }
    else { AL.shoulder.rotation.x = AR.shoulder.rotation.x = -1.1; AL.elbow.rotation.x = AR.elbow.rotation.x = -0.6; }
    AL.elbow.rotation.x = AR.elbow.rotation.x = run ? -1.2 : -0.25;
    p.hips.position.y = 0.92 + Math.abs(Math.sin(w)) * (run ? 0.06 : 0.025);
    p.spine.rotation.x = run ? 0.32 : 0.05;
    if (run) p.neck.rotation.x = -0.2;
  } else if (kind === 'wave') {
    AR.shoulder.rotation.z = 2.6 * amt; AR.shoulder.rotation.x = -0.2;
    AR.elbow.rotation.z = (0.5 + Math.sin(ph * 9) * 0.45) * amt;
    p.neck.rotation.x = -0.05;
  } else if (kind === 'sit') {
    p.hips.position.y = 0.5;
    L.thigh.rotation.x = R.thigh.rotation.x = -1.45; L.knee.rotation.x = R.knee.rotation.x = 1.45;
    AL.shoulder.rotation.x = AR.shoulder.rotation.x = -0.9; AL.elbow.rotation.x = AR.elbow.rotation.x = -0.6;
    p.spine.rotation.x = 0.25 + Math.sin(ph * 0.7) * 0.03;
    p.neck.rotation.x = 0.35;
  } else if (kind === 'hang') {
    AL.shoulder.rotation.x = AR.shoulder.rotation.x = -2.6 + Math.sin(ph * 1.3) * 0.15;
    AL.shoulder.rotation.z = -0.3; AR.shoulder.rotation.z = 0.3;
    AL.elbow.rotation.x = AR.elbow.rotation.x = -0.3;
    p.neck.rotation.x = -0.3;
  } else if (kind === 'hammer') {
    const c = (ph * 1.4) % 1, up = c < 0.6 ? c / 0.6 : 1 - (c - 0.6) / 0.4;
    AR.shoulder.rotation.x = -0.6 - up * 2.0; AR.elbow.rotation.x = -0.9 + up * 0.4;
    AL.shoulder.rotation.x = -0.8; AL.elbow.rotation.x = -0.9;
    p.spine.rotation.x = 0.25 - up * 0.1;
  } else if (kind === 'sweep') {
    AL.shoulder.rotation.x = -0.9 + Math.sin(ph * 2.2) * 0.3; AR.shoulder.rotation.x = -0.6 + Math.sin(ph * 2.2) * 0.3;
    AL.elbow.rotation.x = AR.elbow.rotation.x = -0.5;
    p.spine.rotation.x = 0.3; p.spine.rotation.y = Math.sin(ph * 2.2) * 0.25;
  } else if (kind === 'cower') {
    p.hips.position.y = 0.42;
    L.thigh.rotation.x = R.thigh.rotation.x = -1.8; L.knee.rotation.x = R.knee.rotation.x = 2.2;
    p.spine.rotation.x = 0.7;
    AL.shoulder.rotation.x = AR.shoulder.rotation.x = -2.4; AL.elbow.rotation.x = AR.elbow.rotation.x = -1.6;
    p.root.rotation.z = Math.sin(ph * 14) * 0.01;
  } else if (kind === 'kneel') {
    p.hips.position.y = 0.47;
    L.knee.rotation.x = R.knee.rotation.x = Math.PI / 2;
    p.spine.rotation.x = 0.42 + Math.sin(ph * 1.3) * 0.02;
    p.neck.rotation.x = 0.45;
    AL.shoulder.rotation.x = AR.shoulder.rotation.x = -0.75; AL.elbow.rotation.x = AR.elbow.rotation.x = -0.5;
  } else if (kind === 'lie') {
    p.hips.position.y = 0.14;
    p.hips.rotation.x = -Math.PI / 2;
    AR.shoulder.rotation.x = -2.8; AR.elbow.rotation.x = -0.2;
    AL.shoulder.rotation.z = -0.4;
    L.thigh.rotation.x = -0.2; L.knee.rotation.x = 0.4;
    p.neck.rotation.x = -0.25 + Math.sin(ph * 0.8) * 0.04;
    p.spine.rotation.x = Math.sin(ph * 1.2) * 0.02;
  } else {
    p.neck.rotation.y = Math.sin(ph * 0.4) * 0.3;
  }
}

export const VILLAGER_COLORS = [
  { robe: [0.22, 0.28, 0.45], sash: [0.55, 0.16, 0.12] },
  { robe: [0.62, 0.55, 0.42], sash: [0.25, 0.3, 0.42] },
  { robe: [0.5, 0.2, 0.16], sash: [0.85, 0.7, 0.35] },
  { robe: [0.3, 0.42, 0.36], sash: [0.6, 0.5, 0.3] },
  { robe: [0.42, 0.34, 0.26], sash: [0.2, 0.2, 0.25] },
  { robe: [0.75, 0.68, 0.55], sash: [0.4, 0.2, 0.18] },
];

// ------------------------------------------------------------------ the uncle, pinned under the fallen beam (a close-up model)
// Local frame: lying along +x (head at +x), face up, +z toward whoever kneels beside him.
const gauss = (v, c, w) => Math.exp(-((v - c) / w) * ((v - c) / w));
function faceGeometry() {
  const g = new THREE.SphereGeometry(1, 56, 40);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const front = smooth(0.0, 0.5, z);
    let sx = 0.084, sy = 0.11, sz = 0.098;
    const low = smooth(0.05, -0.75, y);
    sx *= 1 - low * 0.24;
    sz *= 1 - low * 0.06 * (z < 0 ? 1 : 0);
    let X = x * sx, Y = y * sy, Z = z * sz;
    let d = 0, shade = 1;
    // nose: bridge to tip
    const nose = gauss(x, 0, 0.085) * smooth(0.18, -0.08, y) * (1 - smooth(-0.34, -0.42, y)) * front;
    d += 0.024 * nose * smooth(0.2, -0.32, y);
    // brow ridge, sockets, cheekbones, mouth line, chin
    d += 0.007 * gauss(y, 0.24, 0.07) * gauss(x, 0, 0.45) * front;
    for (const sxx of [-1, 1]) {
      const sock = gauss(x, sxx * 0.33, 0.13) * gauss(y, 0.11, 0.085) * front;
      d -= 0.011 * sock; shade -= 0.42 * sock;
      d += 0.006 * gauss(x, sxx * 0.5, 0.15) * gauss(y, -0.06, 0.12) * front;
      shade -= 0.18 * gauss(x, sxx * 0.42, 0.12) * gauss(y, -0.25, 0.14) * front;
    }
    const mouth = gauss(y, -0.5, 0.035) * gauss(x, 0, 0.26) * front;
    d -= 0.004 * mouth; shade -= 0.35 * mouth;
    d += 0.009 * gauss(y, -0.73, 0.12) * gauss(x, 0, 0.3) * front;
    const len = Math.hypot(X, Y, Z) || 1;
    X += (X / len) * d; Y += (Y / len) * d; Z += (Z / len) * d;
    pos.setXYZ(i, X, Y, Z);
    const k = Math.max(0.35, shade);
    col.set([0.72 * k, 0.52 * k, 0.42 * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
export function makeElder() {
  const root = new THREE.Group();
  root.name = 'elder';
  const cloth = getCloth();
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x9c958d, roughness: 0.62 });
  const darkCloth = (g, c) => colored(g, c);
  const robe = [0.36, 0.27, 0.2];
  // torso lying along +x
  const torso = mesh(darkCloth(lathe([[0.0, 0], [0.2, 0.0], [0.22, 0.2], [0.21, 0.38], [0.2, 0.5], [0.13, 0.58], [0.0, 0.6]], 14), robe), cloth, root, 0, 0.17, 0);
  torso.rotation.z = -Math.PI / 2; torso.scale.set(1, 1, 0.78);
  const sash = mesh(darkCloth(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 14), [0.22, 0.19, 0.17]), cloth, root, 0.08, 0.17, 0);
  sash.rotation.z = Math.PI / 2; sash.scale.set(1, 1, 0.8);
  const collar = mesh(darkCloth(new THREE.TorusGeometry(0.1, 0.03, 6, 14), [0.78, 0.72, 0.6]), cloth, root, 0.6, 0.19, 0);
  collar.rotation.y = Math.PI / 2;
  // legs, mostly lost under the debris
  for (const sz of [-1, 1]) { const l = mesh(darkCloth(new THREE.CylinderGeometry(0.08, 0.065, 0.9, 8), [0.28, 0.24, 0.2]), cloth, root, -0.45, 0.1, sz * 0.1); l.rotation.z = Math.PI / 2; }
  // head: turned toward the one beside him
  const head = new THREE.Group();
  head.position.set(0.79, 0.14, 0.03);
  root.add(head);
  const neck = mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.14, 8), skin, root, 0.68, 0.18, 0.01);
  neck.rotation.z = Math.PI / 2;
  colored(neck.geometry, [0.62, 0.45, 0.36]);
  const face = new THREE.Group();
  face.rotation.set(-Math.PI / 2, -Math.PI / 2, 0, 'YXZ');
  head.add(face);
  const fm = mesh(faceGeometry(), skin, face, 0, 0, 0);
  // ears
  for (const sx of [-1, 1]) { const e = mesh(colored(new THREE.SphereGeometry(0.022, 8, 6), [0.66, 0.46, 0.38]), skin, face, sx * 0.083, 0.005, -0.005); e.scale.set(0.5, 1.2, 0.9); }
  // hair: grey cap, topknot and pin
  const cap = mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hair, face, 0, 0.016, -0.014);
  cap.rotation.x = -0.42; cap.scale.set(0.98, 1.05, 1.06);
  mesh(new THREE.SphereGeometry(0.04, 12, 8), hair, face, 0, 0.1, -0.07);
  const pin = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 5), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.4, metalness: 0.4 }), face, 0, 0.11, -0.07);
  pin.rotation.z = Math.PI / 2;
  // brows, moustache and the long beard
  const strands = [];
  const strand = (pts, r0) => strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 10, r0, 5, false));
  for (const sx of [-1, 1]) {
    strand([[sx * 0.012, 0.028, 0.092], [sx * 0.035, 0.034, 0.088], [sx * 0.06, 0.028, 0.072]], 0.006);
    strand([[sx * 0.008, -0.048, 0.1], [sx * 0.03, -0.056, 0.094], [sx * 0.046, -0.078, 0.08], [sx * 0.05, -0.1, 0.07]], 0.006);
  }
  for (let i = 0; i < 9; i++) {
    const t = i / 8 - 0.5;
    const x0 = t * 0.09;
    strand([[x0, -0.07, 0.085 - Math.abs(t) * 0.04], [x0 * 1.1, -0.12, 0.09], [x0 * 0.8 + Math.sin(i) * 0.01, -0.2, 0.075], [x0 * 0.5, -0.29 - (i % 3) * 0.02, 0.05]], 0.011 - Math.abs(t) * 0.006);
  }
  const beard = new THREE.Mesh(mergeGeometries(strands.map(g => { g.deleteAttribute('uv'); return g; })), hair);
  beard.castShadow = true;
  face.add(beard);
  // the arm that reaches out
  const shoulder = new THREE.Group();
  shoulder.position.set(0.5, 0.2, 0.17);
  root.add(shoulder);
  const upper = mesh(darkCloth(new THREE.CylinderGeometry(0.06, 0.075, 0.3, 8), robe), cloth, shoulder, 0, -0.15, 0);
  const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
  mesh(darkCloth(new THREE.CylinderGeometry(0.075, 0.1, 0.22, 8, 1, true), robe), cloth, elbow, 0, -0.1, 0).material.side = THREE.DoubleSide;
  const fore = mesh(colored(new THREE.CylinderGeometry(0.03, 0.036, 0.22, 7), [0.62, 0.45, 0.36]), skin, elbow, 0, -0.17, 0);
  const hand = new THREE.Group(); hand.position.y = -0.3; elbow.add(hand);
  mesh(colored(new THREE.BoxGeometry(0.075, 0.09, 0.03), [0.64, 0.46, 0.37]), skin, hand, 0, -0.02, 0);
  for (let f = 0; f < 4; f++) {
    const fg = new THREE.Group(); fg.position.set(-0.027 + f * 0.018, -0.065, 0); fg.rotation.x = 0.25 + f * 0.08; hand.add(fg);
    mesh(colored(new THREE.CylinderGeometry(0.008, 0.007, 0.05 - Math.abs(f - 1.5) * 0.006, 5), [0.62, 0.45, 0.36]), skin, fg, 0, -0.024, 0);
    const tip = new THREE.Group(); tip.position.y = -0.048; tip.rotation.x = 0.5; fg.add(tip);
    mesh(colored(new THREE.CylinderGeometry(0.007, 0.006, 0.035, 5), [0.62, 0.45, 0.36]), skin, tip, 0, -0.017, 0);
  }
  const thumb = mesh(colored(new THREE.CylinderGeometry(0.009, 0.008, 0.05, 5), [0.62, 0.45, 0.36]), skin, hand, 0.045, -0.035, 0.01);
  thumb.rotation.z = 0.7;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const state = { look: 0 };
  return {
    root, head, shoulder, elbow, hand,
    // speak 0..1 (alive, turning to him), drop 0..1 (the hand falls), time in seconds
    update(time, speak, drop) {
      const breath = Math.sin(time * 1.4) * 0.006 * (1 - drop);
      torso.scale.set(1, 1 + breath, 0.78 + breath);
      head.rotation.set(0, 0, 0);
      head.rotation.x = lerp(0.1, 0.62, speak) * (1 - drop * 0.35) + Math.sin(time * 0.9) * 0.02 * (1 - drop);
      head.rotation.z = Math.sin(time * 2.3) * 0.012 * speak * (1 - drop);
      // reaching up toward the kneeling boy, trembling; then it falls to the floor
      shoulder.rotation.set(lerp(-1.95, -1.45, drop), 0, lerp(0.28, 0.08, drop));
      elbow.rotation.set(lerp(-0.55, -0.04, drop) + Math.sin(time * 9) * 0.02 * (1 - drop), 0, 0);
      hand.rotation.set(lerp(0.35, 0.55, drop), 0, 0);
    },
  };
}
