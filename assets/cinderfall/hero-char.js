// Shared machinery for the procedural characters (Wuhen and the uncle): skeleton with age-blended bind, skinned body and
// garments (morph target between two builds), hair cards + strand simulation, sash ends, contacts, anchors.
import * as THREE from 'three';
import { Rig, jointsFor, aimQuat, eulerQ } from './hero-rig.js';
import { Accum, toGeometry, makeWeighter } from './hero-geo.js';
import { buildTunic, buildCollar, buildSleeves, buildSash, buildTrousers, buildWrapsShoes, buildBracers, buildHead, buildEars, buildArmsHands, HERO_HEAD, headFrame } from './hero-body.js';
import { heroTextures } from './hero-tex.js';
import { clothMaterial, skinMaterial, hairMaterial } from './hero-mat.js';
import { ChainSim, growCard } from './hero-hair.js';
import { HairMesh, headXform } from './hero-hairmesh.js';
import { PoseKit, yawOf } from './hero-pose.js';
import { clamp, lerp, smooth, DEG } from './hero-util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const srgbColor = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
export { srgbColor };

export function makeUniforms() {
  return {
    uTime: { value: 0 }, uWindL: { value: V() }, uFlutter: { value: 1 }, uAge: { value: 0 }, uTatter: { value: 1 },
    uGaze: { value: new THREE.Vector2() }, uLid: { value: 0 }, uIris: { value: srgbColor(0.46, 0.5, 0.54) },
    uBrow: { value: srgbColor(0.3, 0.27, 0.26) }, uLip: { value: srgbColor(0.74, 0.5, 0.46) }, uWrinkle: { value: 0 }, uMouth: { value: 0 }, uBrowW: { value: 1 },
    uEyeH: { value: 1 }, uSmile: { value: 0 }, uFade: { value: 1 }, uRim: { value: new THREE.Vector4(1, 0.45, 0.18, 0) },
    uKK: { value: new THREE.Vector4(0.34, 230, 0.32, 40) }, uKKShift: { value: V(0.1, -0.12, 0.38) }, uKKTint: { value: new THREE.Color(1, 0.97, 0.94) },
    // (how much the hair takes from the sky's light: raised at night so silver hair stays silver, not a dark blue mop)
    uHairAmb: { value: 1 },
  };
}

// Geometry, hair layout and rest shapes are generated once per character config and shared by every instance.
const TEMPLATES = new Map();
export function getTemplate(cfg) {
  const key = cfg.key || cfg.name;
  let T = TEMPLATES.get(key);
  if (T) return T;
  const P0 = cfg.props[0], P1 = cfg.props[1];
  const J0 = jointsFor(P0), J1 = jointsFor(P1);
  const morph = cfg.morph !== false;
  const rig = new Rig(J0, J1);
  const W = makeWeighter(rig);
  const NS = 7, sashBase = rig.N;
  const builds = (morph ? [0, 1] : [0]).map(a => {
    const P = cfg.props[a], J = a ? J1 : J0, S = cfg.styles[a];
    const ctx = { age: a, P, J, S, W, rig, sashBoneBase: sashBase, longSleeves: cfg.longSleeves, jaw: cfg.jaw, headA: cfg.headA };
    const skin = new Accum({ aFace: 4 }), cloth = new Accum({ aCloth: 4 });
    skin.weights = cloth.weights = a === 0;
    const HF = buildHead(skin, ctx, cfg.headA || HERO_HEAD);
    buildEars(skin, ctx, HF, cfg.headA || HERO_HEAD);
    buildArmsHands(skin, ctx);
    const T = buildTunic(cloth, ctx);
    buildCollar(cloth, ctx, T);
    buildSleeves(cloth, ctx);
    const sash = buildSash(cloth, ctx, T);
    buildTrousers(cloth, ctx);
    buildWrapsShoes(cloth, ctx);
    buildBracers(cloth, ctx);
    return { skin, cloth, sash, HF, P, S };
  });
  if (!morph) builds.push(builds[0]);
  const NP = 8;
  const cards = cfg.cards();
  for (const c of cards) {
    c.restB = growCard(c, NP, c.L0 * (morph ? 1.1 : 1), !!c.gather, cfg.tie);
    // at 15: gathered locks (not the bangs) go up into the high half-ponytail when the style has one (cfg.tail)
    c.restA = cfg.gatherAll && c.gather ? c.restB : (cfg.tail && c.gather && c.group !== 'bang') ? growCard(c, NP, c.L0, true, cfg.tail, true) : growCard(c, NP, c.L0, false);
  }
  T = {
    P0, P1, J0, J1, morph, NS, NP, cards,
    skinGeo: toGeometry(builds[0].skin, morph ? builds[1].skin : null),
    clothGeo: toGeometry(builds[0].cloth, morph ? builds[1].cloth : null),
    sashPts: [0, 1].map(e => builds[0].sash.ends[e].pts.map((p, i) => [V(...p), V(...builds[1].sash.ends[e].pts[i])])),
    hf0: headFrame(builds[0].P), hf1: headFrame(builds[1].P),
    statics: cfg.statics ? cfg.statics(cfg.headA) : null,
    hairShared: {},
  };
  TEMPLATES.set(key, T);
  return T;
}

export function buildCharacter(cfg) {
  const TP = getTemplate(cfg);
  const { P0, P1, J0, J1, morph, NS } = TP;
  const K1 = P1.H / P0.H;
  const rig = new Rig(J0, J1);
  const sashBase = rig.N;
  const skinGeo = TP.skinGeo, clothGeo = TP.clothGeo;

  const U = makeUniforms();
  if (cfg.uniforms) cfg.uniforms(U);
  const tex = heroTextures();
  const skinMat = skinMaterial(U);
  const cloth = clothMaterial(tex, U);
  const hair = hairMaterial(tex, U);

  // skeleton: rig bones + dynamic sash bones
  const sashBones = [], sashBind = TP.sashPts;
  for (let e = 0; e < 2; e++) for (let i = 0; i < NS; i++) { const b = new THREE.Bone(); b.name = 'sash' + 'AB'[e] + i; sashBones.push(b); }
  const bones = [...rig.bones, ...sashBones];
  const skeleton = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  rig.skeleton = skeleton;
  rig.updateInverses();
  const group = new THREE.Group();
  group.name = cfg.name;
  const sashHolder = new THREE.Object3D();
  sashHolder.name = 'sashBones';
  for (const b of sashBones) sashHolder.add(b);
  group.add(rig.bones[0], sashHolder);
  const mk = (geo, mat) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    if (morph) m.morphTargetInfluences = [0];
    group.add(m);
    m.bind(skeleton, new THREE.Matrix4());
    // generous fixed culling sphere (skinned bounds are not recomputed per pose)
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, 0), 1.9);
    return m;
  };
  const skinMesh = mk(skinGeo, skinMat);
  skinMesh.name = cfg.name + '-skin';
  skinMesh.customDepthMaterial = skinMat.cf.depth;
  skinMesh.customDistanceMaterial = skinMat.cf.dist;
  const clothMesh = mk(clothGeo, cloth.mat);
  clothMesh.name = cfg.name + '-cloth';
  clothMesh.customDepthMaterial = cloth.depth;
  clothMesh.customDistanceMaterial = cloth.dist;

  // ---------------------------------------------------------------- hair
  const hf0 = TP.hf0, hf1 = TP.hf1;
  let hfA = -1;
  const hfV = { O: [0, 0, 0], s: 1 };
  const HF = a => {
    if (a !== hfA) { hfA = a; for (let i = 0; i < 3; i++) hfV.O[i] = lerp(hf0.O[i], hf1.O[i], a); hfV.s = lerp(hf0.s, hf1.s, a); }
    return hfV;
  };
  const cards = TP.cards;
  const NP = TP.NP;
  const TIE = cfg.tie;
  const hairMesh = new HairMesh(cards, NP, hair, { tie: TIE, cap: true, bun: true, colors: cfg.hairColors, colorVar: cfg.hairVar || 0, statics: TP.statics, shared: TP.hairShared, bunAlways: !!cfg.gatherAll, cord: cfg.tail || null });
  hairMesh.mesh.name = cfg.name + '-hair';
  group.add(hairMesh.mesh);
  // (damp: rate per second; the age-15 tail rubs on the loose hair under it, flyaways are light and lively)
  const hairSim = new ChainSim(cards.map(c => ({ n: NP, seg: new Array(NP - 1).fill(0.05), k: new Array(NP).fill(0), r: 0.004 + c.layer * 0.008, pin: 2, bend: c.group === 'bang' ? 0.3 : c.group === 'frame' ? 0.15 : 0.1, damp: cfg.tail && c.gather && c.group !== 'bang' ? 2 : c.group === 'fly' ? 0.7 : 1 })), { drag: 0.55, damp: 3.5 });

  // sash ends
  const sashSim = new ChainSim([0, 1].map(e => ({ n: NS, seg: new Array(NS - 1).fill(0.08), k: [1, 0.12, 0.05, 0.02, 0.01, 0, 0], r: 0.014, pin: 1, bend: 0.06 })), { drag: 1.3, damp: 3.0 });

  // ---------------------------------------------------------------- pose machinery
  const K = new PoseKit(rig);
  const Pc = rig.newPose(), Pt = rig.newPose(), Pi = rig.newPose();
  const st = { phase: 0, look: new THREE.Vector2(), lookT: new THREE.Vector2(), lookV: new THREE.Vector2(), yaw: null, t: 0, age: -1, lastState: {}, settled: false };

  // contact points (bone, bind point at age 0/1)
  const contacts = [];
  const addC = (bone, f) => contacts.push({ i: rig.idx[bone], p0: V(...f(J0, P0.H / 1.7)), p1: V(...f(J1, P1.H / 1.7)) });
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    addC('foot' + s, (J, k) => [J.J['foot' + s].x, 0.002, -0.075 * k]);
    addC('foot' + s, (J, k) => [J.J['foot' + s].x + m * 0.03, 0.002, 0.0]);
    addC('toe' + s, (J, k) => [J.J['toe' + s].x, 0.002, J.J['toe' + s].z]);
    addC('toe' + s, (J, k) => [J.J['toe' + s].x, 0.004, 0.2 * k]);
    addC('foot' + s, (J, k) => [J.J['foot' + s].x, 0.07 * k, 0.04 * k]);
    addC('toe' + s, (J, k) => [J.J['toe' + s].x, 0.036 * k, 0.17 * k]);
    addC('foot' + s, (J, k) => [J.J['foot' + s].x, 0.075 * k, -0.07 * k]);
    addC('shin' + s, (J, k) => [J.J['shin' + s].x, J.J['shin' + s].y - 0.02 * k, 0.075 * k]);
    addC('shin' + s, (J, k) => [J.J['shin' + s].x, (J.J['shin' + s].y + J.J['foot' + s].y) / 2, 0.05 * k]);
    addC('shin' + s, (J, k) => [J.J['shin' + s].x, J.J['shin' + s].y - 0.1 * k, -0.07 * k]);
    addC('thigh' + s, (J, k) => [J.J['thigh' + s].x + m * 0.03, J.J['thigh' + s].y - 0.2 * k, -0.11 * k]);
    addC('hand' + s, (J, k) => { const a = J.J['hand' + s]; return [a.x - m * 0.02 * 0.82, a.y - 0.06 * 0.82 - 0.012, a.z]; });
    addC('middle3' + s, (J, k) => { const e = J.E['middle3' + s]; return [e.x, e.y, e.z]; });
    addC('upperArm' + s, (J, k) => [J.J['upperArm' + s].x, J.J['upperArm' + s].y, -0.08 * k]);
    addC('foreArm' + s, (J, k) => [J.J['foreArm' + s].x, J.J['foreArm' + s].y, -0.045 * k]);
  }
  addC('hips', (J, k) => [0.07, 0.86 * k, -0.125 * k]);
  addC('hips', (J, k) => [-0.07, 0.86 * k, -0.125 * k]);
  addC('hips', (J, k) => [0, 0.82 * k, -0.05 * k]);
  addC('spine', (J, k) => [0, 1.06 * k, -0.11 * k]);
  addC('chest', (J, k) => [0, 1.27 * k, -0.12 * k]);
  addC('chest', (J, k) => [0.1, 1.3 * k, -0.11 * k]);
  addC('chest', (J, k) => [-0.1, 1.3 * k, -0.11 * k]);
  addC('head', (J, k) => [0, J.J.head.y + 0.08 * k, -0.105 * k]);
  addC('head', (J, k) => [0.06 * k, J.J.head.y + 0.07 * k, -0.07 * k]);
  addC('head', (J, k) => [-0.06 * k, J.J.head.y + 0.07 * k, -0.07 * k]);
  addC('chest', (J, k) => [0, 1.25 * k, 0.12 * k]);
  addC('head', (J, k) => [0, J.J.head.y + 0.0, 0.1 * k]);
  const _cp = V();
  const contactMin = () => {
    rig.fk(Pc);
    let mn = 1e9, ci = 0;
    for (const c of contacts) {
      _cp.lerpVectors(c.p0, c.p1, rig.age);
      rig.pointOn(c.i, _cp, _cp);
      if (_cp.y < mn) { mn = _cp.y; st.minC = ci; }
      ci++;
    }
    return mn;
  };

  // anchors for props
  const anchorObjs = {};
  const anchorSpec = {
    handL: { bone: 'handL' }, handR: { bone: 'handR' },
    back: { bone: 'chest', p: (J, k) => [0, 1.29 * k, -0.15 * k] },
    hipL: { bone: 'hips', p: (J, k) => [0.18 * k, 0.9 * k, 0.0] }, hipR: { bone: 'hips', p: (J, k) => [-0.18 * k, 0.9 * k, 0.0] },
    head: { bone: 'head' },
  };
  const placeAnchors = () => {
    for (const name in anchorObjs) {
      const o = anchorObjs[name], sp = anchorSpec[name];
      const bi = rig.idx[sp.bone];
      if (name === 'handL' || name === 'handR') {
        const S = K.side[name.slice(-1)];
        const hs = rig.bindPos[bi].distanceTo(rig.endPos[bi]) / 0.092;
        o.position.copy(S.a).multiplyScalar(0.058 * hs).addScaledVector(S.n, 0.02 * hs);
        aimQuat(o.quaternion, V(0, 1, 0), V(0, 0, 1), S.f, S.a);
      } else if (name === 'head') {
        const f = HF(rig.age);
        o.position.set(f.O[0], f.O[1], f.O[2]).sub(rig.bindPos[bi]);
      } else {
        const a = V(...sp.p(J0, P0.H / 1.7)), b = V(...sp.p(J1, P1.H / 1.7));
        o.position.lerpVectors(a, b, rig.age).sub(rig.bindPos[bi]);
      }
    }
  };

  // ---------------------------------------------------------------- age
  function setAge(a) {
    a = clamp(a);
    rig.setAge(a);
    rig.updateInverses();
    for (let e = 0; e < 2; e++) for (let i = 0; i < NS; i++) {
      const [p0, p1] = sashBind[e][i];
      const p = V().lerpVectors(p0, p1, a);
      skeleton.boneInverses[sashBase + e * NS + i].makeTranslation(-p.x, -p.y, -p.z);
    }
    if (morph) { skinMesh.morphTargetInfluences[0] = a; clothMesh.morphTargetInfluences[0] = a; U.uAge.value = a; }
    const hf = HF(a);
    hairMesh.setAge(a, hf);
    // strand lengths and stiffness for this age
    const ga = cfg.gatherAll ? 1 : smooth(0.25, 0.85, a);
    cards.forEach((c, ci) => {
      const ch = hairSim.chains[ci];
      for (let i = 0; i < NP; i++) {
        const A = c.restA[i], B = c.restB[i];
        if (i) {
          const pa = c.restA[i - 1], pb = c.restB[i - 1];
          const la = Math.hypot(A[0] - pa[0], A[1] - pa[1], A[2] - pa[2]), lb = Math.hypot(B[0] - pb[0], B[1] - pb[1], B[2] - pb[2]);
          hairSim.l[ch.o + i] = lerp(la, lb, c.gather ? ga : a) * hf.s;
        }
        hairSim.k[ch.o + i] = lerp(c.kA[i], c.gather ? 0.9 : c.kA[i], c.gather ? ga : 0);
      }
    });
    for (let e = 0; e < 2; e++) {
      const ch = sashSim.chains[e];
      for (let i = 1; i < NS; i++) sashSim.l[ch.o + i] = sashBind[e][i][0].distanceTo(sashBind[e][i - 1][0]) * lerp(1, K1, a);
    }
    placeAnchors();
    st.age = a;
  }
  // stiffness profiles from the rest shapes (points still on the scalp are styled, the hanging part is free)
  for (const c of cards) {
    c.kA = c.restA.map((p, i) => {
      if (i < 2) return 1;
      if (c.group === 'bang') return [1, 1, 0.55, 0.42, 0.32, 0.24, 0.16, 0.1][i];
      if (c.group === 'frame') return [1, 1, 0.3, 0.12, 0.05, 0.02, 0.01, 0][i];
      if (c.group === 'fly') return [1, 1, 0.3, 0.16, 0.1, 0.07, 0.05, 0.04][i];
      // the age-15 tail hangs free from the tie (only the part drawn over the scalp to the tie is styled)
      const tieI = cfg.tail && !cfg.gatherAll && c.gather && c.tieA !== undefined ? Math.round(c.tieA * (NP - 1)) : -1;
      const onScalp = tieI >= 0 ? i <= tieI : p[1] > -0.035 && i < 5;
      return onScalp ? 0.4 * (1 - i / NP * 0.6) : i < 4 ? 0.03 : 0.012;
    });
  }

  // ---------------------------------------------------------------- secondary motion helpers
  const bodies = [], sashBodies = [];
  const mkB = () => ({ ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0 });
  for (let i = 0; i < 10; i++) bodies.push(mkB());
  for (let i = 0; i < 6; i++) sashBodies.push(mkB());
  const _a = V(), _b = V(), _hq = new THREE.Quaternion();
  const setB = (B, a, b, r) => { B.ax = a.x; B.ay = a.y; B.az = a.z; B.bx = b.x; B.by = b.y; B.bz = b.z; B.r = r; };
  const k_ = () => lerp(P0.H / 1.7, P1.H / 1.7, rig.age);
  const headX = headXform(rig, () => HF(rig.age));
  function updateBodies() {
    const I = rig.idx, k = k_();
    const hf = HF(rig.age);
    // head: two spheres (cranium, face/jaw)
    headX(_a.set(0, 0.026, -0.012)); setB(bodies[0], _a, _a, 0.083 * hf.s);
    headX(_a.set(0, -0.04, 0.02)); setB(bodies[1], _a, _a, 0.068 * hf.s);
    headX(_a.set(0, 0.02, -0.03)); headX(_b.set(0, -0.02, -0.035)); setB(bodies[9], _a, _b, 0.072 * hf.s);
    // neck
    rig.pointOn(I.neck, _a.set(0, rig.bindPos[I.neck].y, -0.035 * k), _a); rig.pointOn(I.head, _b.set(0, rig.bindPos[I.head].y, -0.03 * k), _b);
    setB(bodies[2], _a, _b, 0.056 * k);
    // torso (two capsules give an oval back)
    for (const s of [1, -1]) {
      rig.pointOn(I.chest, _a.set(s * 0.065 * k, 1.33 * k, -0.01 * k), _a);
      rig.pointOn(I.hips, _b.set(s * 0.06 * k, 0.93 * k, -0.005 * k), _b);
      setB(bodies[s > 0 ? 3 : 4], _a, _b, 0.112 * k);
    }
    // shoulders / upper arms
    for (const s of ['L', 'R']) {
      rig.pointOn(I['upperArm' + s], _a.copy(rig.bindPos[I['upperArm' + s]]), _a);
      rig.pointOn(I['foreArm' + s], _b.copy(rig.bindPos[I['foreArm' + s]]), _b);
      setB(bodies[s === 'L' ? 5 : 6], _a, _b, 0.074 * k);
    }
    // thighs (for sitting / lying)
    for (const s of ['L', 'R']) {
      rig.pointOn(I['thigh' + s], _a.copy(rig.bindPos[I['thigh' + s]]), _a);
      rig.pointOn(I['shin' + s], _b.copy(rig.bindPos[I['shin' + s]]), _b);
      setB(bodies[s === 'L' ? 7 : 8], _a, _b, 0.11 * k);
      setB(sashBodies[s === 'L' ? 0 : 1], _a, _b, 0.118 * k);
      rig.pointOn(I['foot' + s], _b.copy(rig.bindPos[I['foot' + s]]), _b);
      rig.pointOn(I['shin' + s], _a.copy(rig.bindPos[I['shin' + s]]), _a);
      setB(sashBodies[s === 'L' ? 2 : 3], _a, _b, 0.1 * k);
    }
    rig.pointOn(I.hips, _a.set(0.0, 1.0 * k, 0.0), _a); rig.pointOn(I.hips, _b.set(0, 0.8 * k, 0.0), _b);
    setB(sashBodies[4], _a, _b, 0.15 * k);
    rig.pointOn(I.spine, _a.set(0.0, 1.12 * k, -0.005), _a); rig.pointOn(I.hips, _b.set(0, 0.98 * k, 0.0), _b);
    setB(sashBodies[5], _a, _b, 0.14 * k);
  }
  const _t = V();
  function updateTargets() {
    const hf = HF(rig.age);
    const ga = smooth(0.25, 0.85, rig.age);
    cards.forEach((c, ci) => {
      const o = hairSim.chains[ci].o;
      const w = c.gather ? ga : 0;
      for (let i = 0; i < NP; i++) {
        const A = c.restA[i], B = c.restB[i];
        _t.set(lerp(A[0], B[0], w), lerp(A[1], B[1], w), lerp(A[2], B[2], w));
        headX(_t);
        hairSim.t[(o + i) * 3] = _t.x; hairSim.t[(o + i) * 3 + 1] = _t.y; hairSim.t[(o + i) * 3 + 2] = _t.z;
      }
    });
    // sash: knot follows the hips; the rest of the targets hang from the bind path
    for (let e = 0; e < 2; e++) {
      const o = sashSim.chains[e].o;
      for (let i = 0; i < NS; i++) {
        const [p0, p1] = sashBind[e][i];
        _t.lerpVectors(p0, p1, rig.age);
        rig.pointOn(rig.idx.hips, _t, _t);
        sashSim.t[(o + i) * 3] = _t.x; sashSim.t[(o + i) * 3 + 1] = _t.y; sashSim.t[(o + i) * 3 + 2] = _t.z;
      }
    }
  }
  const _side = V(), _tan = V(), _out = V(), _s0 = V(), _t0 = V(), _o0 = V();
  function writeSashBones() {
    for (let e = 0; e < 2; e++) {
      const o = sashSim.chains[e].o;
      for (let i = 0; i < NS; i++) {
        const j = (o + i) * 3;
        const b = sashBones[e * NS + i];
        b.position.set(sashSim.x[j], sashSim.x[j + 1], sashSim.x[j + 2]);
        const ia = Math.max(0, i - 1), ib = Math.min(NS - 1, i + 1);
        _tan.set(sashSim.x[(o + ib) * 3] - sashSim.x[(o + ia) * 3], sashSim.x[(o + ib) * 3 + 1] - sashSim.x[(o + ia) * 3 + 1], sashSim.x[(o + ib) * 3 + 2] - sashSim.x[(o + ia) * 3 + 2]).normalize();
        // outward from the hips axis
        rig.pointOn(rig.idx.hips, _out.set(0, b.position.y, 0), _out);
        _out.subVectors(b.position, _out); _out.y *= 0.2; _out.normalize();
        _side.crossVectors(_tan, _out).normalize();
        const p = (k) => sashBind[e][k][0].clone().lerp(sashBind[e][k][1], rig.age);
        _t0.subVectors(p(ib), p(ia)).normalize();
        const pi = p(i);
        _o0.set(pi.x, 0, pi.z + 0.01).normalize();
        _s0.crossVectors(_t0, _o0).normalize();
        aimQuat(b.quaternion, _t0, _s0, _tan, _side);
      }
    }
  }
  const windL = V(), _wq = new THREE.Quaternion(), _wv = V();
  function computeWind(s, time, dt = 0) {
    const w = s.wind;
    // the headwind follows a smoothed ground speed (a speed that jumps from frame to frame must not shake the hair)
    const sp = s.speed || 0;
    st.windSpeed = dt > 0 && st.windSpeed !== undefined ? st.windSpeed + (sp - st.windSpeed) * (1 - Math.exp(-dt * 6)) : sp;
    windL.set(w ? w.x : 0, 0, w ? w.y : 0);
    // world wind into local space (group rotation)
    group.getWorldQuaternion(_wq);
    windL.applyQuaternion(_wq.invert());
    const gust = 1 + 0.35 * Math.sin(time * 1.7) * Math.sin(time * 0.63 + 1.1);
    windL.multiplyScalar(gust);
    windL.z -= st.windSpeed * 0.92;
    // (an updraft: the hair and sash lifted, as when the storm's eye draws breath over him)
    if (s.lift) windL.y += s.lift;
    // breathing air / idle drift so hair never looks frozen
    windL.x += 0.12 * Math.sin(time * 0.9); windL.z += 0.1 * Math.sin(time * 0.71 + 2);
    U.uWindL.value.copy(windL);
  }
  // rotate sim state about the vertical axis when the group turns in the world (hair lags behind)
  function groupYawInertia() {
    group.getWorldQuaternion(_wq);
    const yaw = yawOf(_wq);
    if (st.yaw !== null) {
      let d = yaw - st.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 1e-5 && Math.abs(d) < 0.6) {
        const c = Math.cos(-d), s = Math.sin(-d);
        for (const S of [hairSim, sashSim]) for (const arr of [S.x, S.p]) for (let j = 0; j < arr.length; j += 3) {
          const x = arr[j], z = arr[j + 2];
          arr[j] = x * c + z * s; arr[j + 2] = -x * s + z * c;
        }
      }
    }
    st.yaw = yaw;
  }

  const jawX = headXform(rig, () => HF(rig.age), 'jaw');
  function stepSecondary(dt, time, s) {
    computeWind(s, time, dt);
    updateBodies();
    updateTargets();
    groupYawInertia();
    // (each simulation substeps itself: frame-rate independent, see ChainSim)
    hairSim.step(dt, bodies, windL); sashSim.step(dt, sashBodies, windL);
    writeSashBones();
    hairMesh.update(hairSim, rig, headX, jawX);
  }


  const C = {
    cfg, group, rig, K, U, Pc, Pt, Pi, st, skeleton, bones, skinMesh, clothMesh, hairMesh, hairSim, sashSim, cards,
    contactMin, setAge, placeAnchors, anchorObjs, anchorSpec, HF, headX, jawX,
    computeWind, updateBodies, updateTargets, writeSashBones, groupYawInertia, windL, bodies, sashBodies,
    geos: [skinGeo, clothGeo, hairMesh.mesh.geometry], mats: [skinMat, skinMat.cf.depth, skinMat.cf.dist, cloth.mat, cloth.depth, cloth.dist, hair.mat, hair.depth, hair.dist],
  };
  C.stepSecondary = stepSecondary;
  C.setFade = k => {
    k = clamp(k);
    U.uFade.value = k;
    group.visible = k > 0.002;
  };
  C.refresh = () => { updateBodies(); updateTargets(); writeSashBones(); hairMesh.update(hairSim, rig, headX, jawX); };
  C.settle = (s) => {
    st.settled = true;
    st.look.copy(st.lookT); st.lookV.set(0, 0);
    computeWind(s || {}, U.uTime.value);
    updateBodies();
    updateTargets();
    group.getWorldQuaternion(_wq); st.yaw = yawOf(_wq);
    hairSim.snapToTargets(); sashSim.snapToTargets();
    hairSim.settle(bodies, windL, 150); sashSim.settle(sashBodies, windL, 120);
    writeSashBones();
    hairMesh.update(hairSim, rig, headX, jawX);
  };
  C.attach = (name, obj) => {
    if (!anchorSpec[name]) throw new Error('attach: unknown anchor ' + name);
    if (!anchorObjs[name]) {
      const o = new THREE.Object3D(); o.name = 'anchor-' + name;
      rig.bones[rig.idx[anchorSpec[name].bone]].add(o);
      anchorObjs[name] = o;
      placeAnchors();
    }
    anchorObjs[name].add(obj);
    return anchorObjs[name];
  };
  C.anchorPos = name => { const o = anchorObjs[name] || C.attach(name, new THREE.Object3D()); o.updateWorldMatrix(true, false); return o.getWorldPosition(V()); };
  C.dispose = () => {
    group.removeFromParent();
    for (const g of C.geos) g.dispose();
    for (const m of C.mats) m.dispose();
    skeleton.dispose();
  };
  return C;
}
