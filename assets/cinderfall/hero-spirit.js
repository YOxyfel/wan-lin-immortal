// The uncle's soul: an ethereal golden copy of createElder() that sits up out of the body, floats upright above
// him, and comes apart from the edges into rising motes until only a small bright core is left.
//
//   import { createSpirit } from './hero-spirit.js';
//   const spirit = createSpirit(elder);          // elder = createElder() (shares his geometry, copies his pose)
//   scene.add(spirit.group);                      // any parent: it places itself in world space every update
//   spirit.update(time, { k, rise, dissolve });   // after elder.update() each frame
//     k        0..1  emergence: 0 = coincides with the body (invisible), 0..0.55 sits up out of him (turned to the
//                    boy), 0.45..1 lifts off and turns upright, floating with its feet ~0.3 m over his body
//     rise     metres the whole spirit (and its core) is lifted on top of that
//     dissolve 0..1  comes apart from the extremities toward the heart into rising gold motes; at 1 only the core
//     glow     0..1  overall brightness (default 1)
//   spirit.core()   world position of its bright heart (a shared Vector3; clone it to keep it)
//   spirit.dispose()
//
// Gold (hue ~0.12, saturated, HDR-bright) so the ink pass keeps it as its gold accent; drawn additively without
// touching the scene alpha (the post pass reads the alpha as a material marker), no depth writes, no shadows.
import * as THREE from 'three';
import { eulerQ } from './hero-rig.js';
import { clamp, lerp, smooth, rng } from './hero-util.js';

const ease = w => w * w * (3 - 2 * w);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// motes and core: additive, premultiplied colour, destination alpha untouched
const BLEND = {
  transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
};
// the body: MAX blending, so overlapping layers (robe over skin, folds) never stack up: its brightness (and so its
// gold in the ink pass, which keys on hue, saturation and a luminance band) stays where it is designed to be
const BLEND_MAX = {
  transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
};

const NOISE = `
float sh(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float sn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(sh(i), sh(i + vec3(1, 0, 0)), f.x), mix(sh(i + vec3(0, 1, 0)), sh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(sh(i + vec3(0, 0, 1)), sh(i + vec3(1, 0, 1)), f.x), mix(sh(i + vec3(0, 1, 1)), sh(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float sfbm(vec3 p){ return sn(p) * .55 + sn(p * 2.03 + 7.1) * .3 + sn(p * 4.1 + 3.7) * .15; }
`;

function bodyMaterial(U, hair, look) {
  const ink = look !== 'glow';
  return new THREE.ShaderMaterial({
    ...(ink ? BLEND_MAX : BLEND), side: ink ? THREE.DoubleSide : THREE.FrontSide, fog: false, lights: false,
    uniforms: U, defines: ink ? { INK_LOOK: 1 } : {},
    vertexShader: `
#include <common>
#include <skinning_pars_vertex>
uniform float uInflate;
${hair ? 'attribute vec4 aHair; varying vec4 vHair; varying vec2 vUv;' : ''}
varying vec3 vWP, vWN;
void main(){
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  transformed += normalize(normal) * uInflate;
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWP = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * objectNormal);
  ${hair ? 'vHair = aHair; vUv = uv;' : ''}
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `
uniform float uTime, uAlpha, uR, uDis, uGlow;
uniform vec3 uCore, uGold, uHot;
${hair ? 'uniform sampler2D uMap; varying vec4 vHair; varying vec2 vUv;' : ''}
const float LAYER = ${hair ? '.8' : '1.'};
varying vec3 vWP, vWN;
${NOISE}
void main(){
  ${hair ? 'if (vHair.x < 0.5 && texture2D(uMap, vUv).a < 0.38) discard;' : ''}
  vec3 Vd = normalize(cameraPosition - vWP);
  float ndv = abs(dot(normalize(vWN), Vd));
  float rim = pow(clamp(1. - ndv, 0., 1.), 2.4);
  // qi flowing up through it
  float n = sfbm(vWP * 5.5 - vec3(0., uTime * .85, 0.));
  float n2 = sn(vWP * 17. - vec3(0., uTime * 1.6, 0.));
  float flow = smoothstep(.42, .8, n) * (.6 + .4 * n2);
  // inner glow toward the heart
  float dc = length(vWP - uCore);
  float inner = exp(-dc * 3.2);
  // dissolving from the extremities toward the heart, along a ragged front
  float edge = dc + (n - .5) * .32 + (n2 - .5) * .06;
  if (edge > uR) discard;
  float front = smoothstep(uR - .12, uR, edge) * step(.001, uDis);
#ifdef INK_LOOK
  // HDR gold, hue ~0.12 and saturated everywhere: the body sits in the luminance band the ink pass draws as strong
  // gold, the dissolving edge and the heart go above it (gold-white)
  float E = 1.1 * (1. + .5 * flow + .6 * rim + .3 * inner);
  vec3 col = uGold * E * (1. - .35 * front) + uHot * (3.6 * front + 5. * pow(inner, 4.));
  gl_FragColor = vec4(col * uAlpha * uGlow * LAYER, 0.);
#else
  // translucent additive glow for colour scenes: rim light, rising qi, a soft heart
  vec3 col = uGold * (.12 + 1.25 * rim + .7 * flow + .8 * inner + 1.2 * front) + uHot * (front * .9 + inner * inner * .9 + rim * rim * .45);
  float a = uAlpha * LAYER * .5 * clamp(.1 + .7 * rim + .3 * flow + .55 * front + .15 * inner, 0., 1.);
  gl_FragColor = vec4(col * a * uGlow, a);
#endif
}`,
  });
}

function coreMaterial(U) {
  return new THREE.ShaderMaterial({
    ...BLEND, side: THREE.DoubleSide, fog: false, lights: false, depthTest: true,
    uniforms: U,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uCoreI, uTime; uniform vec3 uGold, uHot; varying vec2 vUv;
void main(){
  vec2 p = vUv * 2. - 1.; float r = length(p);
  float pulse = 1. + .08 * sin(uTime * 2.4) + .04 * sin(uTime * 5.3);
  float halo = exp(-r * r * 9.) * .55 + exp(-r * 4.5) * .25;
  float hot = exp(-r * r * 60. / pulse);
  float a = clamp(halo + hot, 0., 1.) * smoothstep(1., .7, r);
  vec3 c = uGold * halo * 1.6 + uHot * hot * 3.;
  gl_FragColor = vec4(c * uCoreI * pulse, a * clamp(uCoreI, 0., 1.));
}`,
  });
}

function moteMaterial(U) {
  return new THREE.ShaderMaterial({
    ...BLEND, fog: false, lights: false,
    uniforms: U,
    vertexShader: `attribute float aA, aS; uniform float uPx; varying float vA;
void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aS * uPx / max(.05, -mv.z), 1., 48.); if (aA < .002) gl_PointSize = 0.; }`,
    fragmentShader: `uniform vec3 uGold, uHot; varying float vA;
void main(){ vec2 p = gl_PointCoord * 2. - 1.; float r = dot(p, p); if (r > 1.) discard;
  float g = exp(-r * 3.5); float a = g * vA;
  gl_FragColor = vec4((uGold * 2.4 + uHot * g * 2.2) * a, a); }`,
  });
}

export function createSpirit(elder, opts = {}) {
  const find = suf => elder.group.children.find(o => o.name && o.name.endsWith(suf));
  const srcSkin = elder.skinMesh || find('-skin'), srcCloth = elder.clothMesh || find('-cloth');
  const srcHair = elder.hairMesh ? (elder.hairMesh.mesh || elder.hairMesh) : find('-hair');
  const skel = srcSkin.skeleton;
  const src = skel.bones, NB = src.length;
  const byName = {}; src.forEach((b, i) => (byName[b.name] = i));

  const group = new THREE.Group(); group.name = 'elder-spirit';
  const body = new THREE.Object3D(); body.name = 'spirit-body'; body.matrixAutoUpdate = false;
  group.add(body);
  // a copy of his skeleton (same bind), posed every frame from his bones and blended toward the floating pose
  const map = new Map();
  const bones = src.map(b => { const c = new THREE.Bone(); c.name = b.name; c.position.copy(b.position); c.quaternion.copy(b.quaternion); map.set(b, c); return c; });
  src.forEach((b, i) => { const p = b.parent; if (p && map.has(p)) map.get(p).add(bones[i]); else body.add(bones[i]); });
  const skeleton = new THREE.Skeleton(bones, skel.boneInverses);

  // (linear RGB; hue ~0.13 before the night grade, ~0.12 after it, where the ink pass looks for gold)
  const gold = new THREE.Color(1.0, 0.84, 0.22), hot = new THREE.Color(1.0, 0.9, 0.36);
  const U = {
    uTime: { value: 0 }, uAlpha: { value: 0 }, uR: { value: 9 }, uDis: { value: 0 }, uGlow: { value: 1 },
    uCore: { value: V() }, uGold: { value: gold }, uHot: { value: hot }, uInflate: { value: 0.006 },
    uCoreI: { value: 0 }, uPx: { value: 400 }, uMap: { value: null },
  };
  // look: 'ink' (default; the prologue's ink world: solid HDR gold the ink pass keeps) or 'glow' (translucent, colour)
  const look = opts.look || 'ink';
  const matBody = bodyMaterial(U, false, look);
  const matHair = bodyMaterial(U, true, look);
  // the hair cards keep their strand alpha
  const hm = srcHair && srcHair.material;
  if (hm && hm.map) U.uMap.value = hm.map;
  const mk = geo => { const m = new THREE.SkinnedMesh(geo, matBody); m.bind(skeleton, new THREE.Matrix4()); m.frustumCulled = false; m.renderOrder = 5; body.add(m); return m; };
  const meshes = [mk(srcSkin.geometry), mk(srcCloth.geometry)];
  let hairM = null;
  if (srcHair && U.uMap.value) {
    hairM = new THREE.Mesh(srcHair.geometry, matHair); hairM.matrixAutoUpdate = false; hairM.frustumCulled = false; hairM.renderOrder = 5;
    body.add(hairM);
  }
  // the heart: a camera-facing glow
  const core = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), coreMaterial(U));
  core.frustumCulled = false; core.renderOrder = 6;
  core.onBeforeRender = (r, s, cam) => { core.quaternion.copy(cam.quaternion); if (core.parent) { core.parent.getWorldQuaternion(_q); core.quaternion.premultiply(_q.invert()); } core.updateMatrix(); core.updateMatrixWorld(); };
  group.add(core);

  // motes: born on the spirit's skin (random vertices, skinned on the CPU), rising and fading
  const NM = opts.motes ?? 420;
  const R = rng(31);
  const geoS = srcSkin.geometry, gc = srcCloth.geometry;
  const anchors = [];
  for (let i = 0; i < NM; i++) {
    const g = R() < 0.55 ? gc : geoS;
    const vi = Math.floor(R() * g.attributes.position.count);
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    anchors.push({
      p: V().fromBufferAttribute(g.attributes.position, vi),
      j: [si.getX(vi), si.getY(vi), si.getZ(vi), si.getW(vi)], w: [sw.getX(vi), sw.getY(vi), sw.getZ(vi), sw.getW(vi)],
      T: 1.3 + R() * 1.4, ph: R() * 10, cyc: -1, on: 0, spawn: V(), v: V(), sz: 0.012 + R() * 0.022, sw: R() * 6.28, rr: R(), nz: (R() - 0.5) * 0.3,
    });
  }
  const mg = new THREE.BufferGeometry();
  const mPos = new Float32Array(NM * 3), mA = new Float32Array(NM), mS = new Float32Array(NM);
  mg.setAttribute('position', new THREE.BufferAttribute(mPos, 3)); mg.setAttribute('aA', new THREE.BufferAttribute(mA, 1)); mg.setAttribute('aS', new THREE.BufferAttribute(mS, 1));
  const motes = new THREE.Points(mg, moteMaterial(U));
  motes.frustumCulled = false; motes.renderOrder = 7;
  // point size in pixels per metre at unit distance
  motes.onBeforeRender = (r, sc, cam) => { U.uPx.value = r.getDrawingBufferSize(_v2).y * cam.projectionMatrix.elements[5] * 0.5; };
  group.add(motes);
  // optional warm light from the heart (adds a light to the scene: create the spirit before the first render)
  const light = opts.light ? new THREE.PointLight(0xffc060, 0, 7, 2) : null;
  if (light) group.add(light);

  // the floating pose (local rotations per bone), built once with his own pose kit
  const I = byName;
  const NR = elder.rig ? elder.rig.N : NB;
  const upQ = bones.map(() => new THREE.Quaternion()), sitQ = bones.map(() => new THREE.Quaternion());
  const K = elder._K;
  if (K && elder.rig) {
    const P = elder.rig.newPose();
    K.base(P);
    K.e(P, 'spine', -3, 0, 0).e(P, 'chest', -4, 0, 0).e(P, 'neck', -4, 0, 0).e(P, 'head', -10, 0, 0);
    for (const s of ['L', 'R']) {
      const m = s === 'L' ? 1 : -1;
      K.armFK(P, s, 12, 24, -30, 24, 6, 0, 0);
      K.fingers(P, s, 'relaxed', 0.8);
      eulerQ(P.q[I['thigh' + s]], -14, m * 4, m * 3);
      eulerQ(P.q[I['shin' + s]], 26 + (m > 0 ? 6 : 0), 0, 0);
      eulerQ(P.q[I['foot' + s]], 32, 0, 0);
    }
    for (let i = 0; i < NR; i++) upQ[i].copy(P.q[i]);
    // sitting up on the floor: hips flexed, legs along the floor, arms loose
    K.base(P);
    K.e(P, 'spine', 6, 0, 0).e(P, 'chest', 4, 0, 0).e(P, 'neck', 2, 0, 0).e(P, 'head', -4, 0, 0);
    for (const s of ['L', 'R']) {
      const m = s === 'L' ? 1 : -1;
      K.armFK(P, s, 18, 16, 0, 30, 0, 0, 0);
      K.fingers(P, s, 'relaxed', 0.8);
      eulerQ(P.q[I['thigh' + s]], -84, m * 4, 0);
      eulerQ(P.q[I['shin' + s]], 8, 0, 0);
      eulerQ(P.q[I['foot' + s]], 10, 0, 0);
    }
    for (let i = 0; i < NR; i++) sitQ[i].copy(P.q[i]);
  }
  const qSitRoot = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2);   // upright, facing his feet (+x)
  const qUpRoot = new THREE.Quaternion();                                               // upright, facing the boy (+z)
  const hipY = elder.rig ? elder.rig.bindPos[0].y : 0.92;
  const _m3 = new THREE.Matrix4(), _one = V(1, 1, 1), _sc = V();
  const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = V(), _v2 = new THREE.Vector2(), _w = V(), _inv = new THREE.Matrix4();
  const corePos = V();
  const chestI = I.chest, headI = I.head;

  function update(time, s = {}) {
    const k = clamp(s.k ?? 0), rise = s.rise || 0, dis = clamp(s.dissolve || 0), glow = s.glow ?? 1;
    group.visible = k > 0.001 || dis > 0;
    // world placement: the spirit body sits exactly where his group is
    elder.group.updateWorldMatrix(true, true);
    group.updateWorldMatrix(true, false);
    _inv.copy(group.matrixWorld).invert();
    body.matrix.multiplyMatrices(_inv, elder.group.matrixWorld);
    // pose: his bones, sitting up (0..0.55), then lifting off and turning upright to face the boy (0.45..1)
    const s1 = ease(clamp(k / 0.55)), s2 = ease(clamp((k - 0.45) / 0.55));
    const limbs = ease(clamp((k - 0.05) / 0.7));
    const sway = Math.sin(time * 1.3) * 0.035 * s2, bob = Math.sin(time * 0.9) * 0.02 * s2;
    for (let i = 0; i < NB; i++) { bones[i].position.copy(src[i].position); bones[i].quaternion.copy(src[i].quaternion); }
    if (K) {
      for (let i = 1; i < NR; i++) {
        // (head and neck stay half turned to the boy while he sits up)
        bones[i].quaternion.slerp(sitQ[i], i === headI || i === I.neck ? s1 * 0.5 : Math.min(s1, limbs)).slerp(upQ[i], s2);
      }
      // root: lying -> sitting up facing his feet -> upright facing the boy, gently swaying
      const r = bones[0];
      r.quaternion.slerp(qSitRoot, s1);
      _q2.copy(qUpRoot); _q.setFromAxisAngle(_v.set(0, 0, 1), sway); _q2.multiply(_q);
      r.quaternion.slerp(_q2, s2);
      _v.copy(src[0].position);
      _v.y = lerp(_v.y, 0.1, s1);
      _v.lerp(_w.set(-0.12, hipY + 0.32 + bob, 0.02), s2);
      _v.y += rise;
      r.position.copy(_v);
    } else bones[0].position.y += rise + lerp(0, 1.2, ease(k));
    // the sash bones (simulated in his group space) ride along with the spirit's hips
    _m.compose(bones[0].position, bones[0].quaternion, _one).multiply(_m2.compose(src[0].position, src[0].quaternion, _one).invert());
    for (let i = NR; i < NB; i++) {
      _m3.compose(src[i].position, src[i].quaternion, _one).premultiply(_m);
      _m3.decompose(bones[i].position, bones[i].quaternion, _sc);
    }
    body.updateMatrixWorld(true);
    // hair rides the spirit's head
    if (hairM) {
      _m.copy(bones[headI].matrixWorld).multiply(_m2.copy(src[headI].matrixWorld).invert()).multiply(srcHair.matrixWorld);
      _inv.copy(body.matrixWorld).invert();
      hairM.matrix.multiplyMatrices(_inv, _m);
      hairM.updateMatrixWorld(true);
    }
    // the heart: in front of the chest, a little above
    corePos.set(0.0, 0.11, 0.08).applyQuaternion(bones[chestI].getWorldQuaternion(_q)).add(bones[chestI].getWorldPosition(_v));
    const hs = Math.abs(elder.group.matrixWorld.getMaxScaleOnAxis());
    if (!group.visible) return;
    // uniforms
    const fadeIn = smooth(0.0, 0.12, k);
    U.uTime.value = time; U.uAlpha.value = fadeIn; U.uGlow.value = glow; U.uDis.value = dis;
    U.uR.value = dis > 0 ? lerp(1.5, 0.02, Math.pow(dis, 0.8)) * hs : 9;
    U.uCore.value.copy(corePos);
    U.uInflate.value = 0.006 + 0.01 * s2;
    U.uCoreI.value = glow * fadeIn * lerp(0.45, 2.2, smooth(0.2, 1, dis)) * (1 + 0.6 * s2);
    group.updateWorldMatrix(true, false);
    _inv.copy(group.matrixWorld).invert();
    core.position.copy(corePos).applyMatrix4(_inv);
    core.scale.setScalar(lerp(0.16, 0.26, dis) * hs * (0.8 + 0.2 * fadeIn));
    if (light) { light.position.copy(core.position); light.intensity = (opts.lightI ?? 4) * glow * fadeIn * (1 - 0.5 * dis); }
    // motes
    const front = U.uR.value;
    for (let i = 0; i < NM; i++) {
      const a = anchors[i];
      const tt = (time + a.ph) / a.T, cyc = Math.floor(tt), age = (tt - cyc) * a.T;
      if (cyc !== a.cyc) {
        a.cyc = cyc;
        // where its anchor is now (skinned on the CPU)
        _w.set(0, 0, 0);
        for (let j = 0; j < 4; j++) {
          if (a.w[j] <= 0) continue;
          _m.multiplyMatrices(bones[a.j[j]].matrixWorld, skeleton.boneInverses[a.j[j]]);
          _w.addScaledVector(_v.copy(a.p).applyMatrix4(_m), a.w[j]);
        }
        const rC = _w.distanceTo(corePos) + a.nz;
        // ambient sparkle while whole; a burst where the dissolving front passes; a trickle from the core at the end
        const edgeAct = dis > 0.001 ? Math.exp(-Math.pow((front - rC) / (0.14 * hs), 2)) * (rC < front + 0.1 ? 1 : 0.4) : 0;
        const amb = 0.16 * fadeIn * (1 - dis) * (rC < front ? 1 : 0);
        const fromCore = dis > 0.7 ? smooth(0.7, 1, dis) * 0.35 : 0;
        const fr = R2(i, cyc);
        if (fr < fromCore) { a.on = 1; a.spawn.copy(corePos).add(_v.set((R2(i, cyc + 3) - 0.5) * 0.08, (R2(i, cyc + 5) - 0.5) * 0.08, (R2(i, cyc + 7) - 0.5) * 0.08)); }
        else if (fr < fromCore + edgeAct + amb) { a.on = 1; a.spawn.copy(_w); }
        else a.on = 0;
        a.v.set((R2(i, cyc + 11) - 0.5) * 0.12, 0.22 + 0.35 * R2(i, cyc + 13), (R2(i, cyc + 17) - 0.5) * 0.12);
      }
      let alpha = 0;
      if (a.on && group.visible) {
        const u = age / a.T;
        alpha = smooth(0, 0.12, u) * (1 - smooth(0.45, 1, u)) * glow * (0.6 + 0.4 * fadeIn);
        _v.copy(a.spawn).addScaledVector(a.v, age);
        _v.x += Math.sin(a.sw + age * 2.1) * 0.04 * u; _v.z += Math.cos(a.sw + age * 1.7) * 0.04 * u;
        _v.applyMatrix4(_inv);
      } else _v.set(0, -1e4, 0);
      mPos[i * 3] = _v.x; mPos[i * 3 + 1] = _v.y; mPos[i * 3 + 2] = _v.z;
      mA[i] = alpha; mS[i] = a.sz * hs;
    }
    mg.attributes.position.needsUpdate = true; mg.attributes.aA.needsUpdate = true; mg.attributes.aS.needsUpdate = true;
  }
  const R2 = (i, c) => { const x = Math.sin(i * 127.1 + c * 311.7) * 43758.5453; return x - Math.floor(x); };

  group.visible = false;
  return {
    group, update,
    core: () => corePos,
    meshes, motes, coreMesh: core, uniforms: U, light,
    dispose() {
      group.removeFromParent();
      matBody.dispose(); matHair.dispose(); core.material.dispose(); core.geometry.dispose(); motes.material.dispose(); mg.dispose();
      skeleton.dispose();
    },
  };
}
