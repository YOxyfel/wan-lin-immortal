// Jiang Wuhen — fully procedural 3D hero for the Cinderfall prologue (createElder: the dying uncle).
// One skeleton (hips-rooted, identity bind rotations), skinned body + garments with an age morph (15 → 21), alpha-tested
// hair cards driven by a follow-the-leader strand simulation, simulated sash ends, and a procedural pose system
// (gait with planted feet, kneel, crouch, sit, push-up, archery, fall / lie / get-up, wave / reach / hold overlays).
// API and tuning notes: lab/hero-notes.md.
import * as THREE from 'three';
import { proportions, eulerQ } from './hero-rig.js';
import { styleFor, HERO_HEAD } from './hero-body.js';
import { wuhenCards } from './hero-hair.js';
import { idlePose, gaitPose, crouchPose, kneelPose, sitPose, pushupPose, drawPose, fallPose, liePose, getUpKey, waveArm, reachArm, reachArmL, holdArms, holdUpArm, carveArms, palmArm, measureArm } from './hero-pose.js';
import { buildCharacter } from './hero-char.js';
import { clamp, lerp, smooth, DEG } from './hero-util.js';

export { createElder } from './hero-elder.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = w => w * w * (3 - 2 * w);

export function createHero({ age = 0 } = {}) {
  const C = buildCharacter({
    name: 'wuhen', props: [proportions(0), proportions(1)], styles: [styleFor(0), styleFor(1)], headA: HERO_HEAD,
    cards: wuhenCards, tie: [0, 0.104, -0.038], tail: [0, 0.1, -0.075],
    hairColors: { root: [0.42, 0.41, 0.43], mid: [0.68, 0.68, 0.7], tip: [0.78, 0.78, 0.8] },
  });
  const { group, rig, K, U, Pc, Pt, Pi, st, contactMin, setAge } = C;
  // ---------------------------------------------------------------- update
  const defaults = { speed: 0, run: 0, wave: 0, crouch: 0, kneel: 0, reach: 0, grief: 0, draw: 0, release: 0, fall: 0, lie: 0, getUp: 0, sit: 0, pushup: 0, hold: 0, holdWidth: 0, lookAt: null, lookW: 1, wind: null, gripL: null, gripR: null, raise: 0, raiseTarget: null, lookUp: 0, carve: 0, carveTarget: null, carveMode: null, braceTarget: null, palm: 0, palmTarget: null, measure: 0, measureTarget: null, measureSlide: 0, reachL: 0, reachLTarget: null, lift: 0 };
  const _look = V(), _hp = V(), _lq = new THREE.Quaternion(), _cvK = V(), _cvB = V(), _cvP = V(), _cvM = V();
  function computePose(dt, time, s) {
    const d = K.dims();
    const speed = Math.max(0, s.speed || 0), run = clamp(s.run || 0);
    const k = d.k;
    // stride (two steps) grows with speed: 1.3 m/s walks at ~1.9 steps/s, 4.5 m/s runs at ~3.1 steps/s
    const cycle = lerp(clamp(0.9 + 0.36 * speed, 1.0, 1.8), clamp(1.25 + 0.36 * speed, 1.6, 3.2), run) * k;
    if (s.phase !== undefined && s.phase !== null) st.phase = s.phase;
    else st.phase = (st.phase + speed * dt / cycle) % 1;
    const c = { t: time, d, speed, run, phase: st.phase, cycle, release: clamp(s.release || 0), holdWidth: s.holdWidth || 0 };
    idlePose(K, Pc, c);
    const mv = smooth(0.0, 0.35, speed + run * 0.5);
    if (mv > 0) { gaitPose(K, Pt, c); rig.blend(Pc, Pt, mv); }
    const full = [
      [s.draw || 0, drawPose], [s.crouch || 0, crouchPose], [s.kneel || 0, kneelPose], [s.sit || 0, sitPose],
      [s.pushup || 0, pushupPose], [s.fall || 0, fallPose],
    ];
    for (const [w, fn] of full) if (w > 0) { fn(K, Pt, c); rig.blend(Pc, Pt, ease(clamp(w))); }
    // ground group: lying, then the get-up sequence (0 lie → 1 sit up → 2 hands and knees → 3 one knee → stand)
    const gu = clamp(s.getUp || 0), lw = clamp(s.lie || 0);
    const gw = Math.max(lw, gu > 0 && gu < 1 ? 1 : 0);
    if (gw > 0) {
      if (gu <= 0) liePose(K, Pt, c);
      else {
        const x = gu * 4, i = Math.min(3, Math.floor(x)), f = ease(x - i);
        if (i < 3) { getUpKey(K, Pt, c, i); getUpKey(K, Pi, c, i + 1); rig.blend(Pt, Pi, f); }
        else { getUpKey(K, Pt, c, 3); idlePose(K, Pi, c); rig.blend(Pt, Pi, f); }
      }
      rig.blend(Pc, Pt, ease(gw));
    }
    // overlays
    const wv = clamp(s.wave || 0);
    if (wv > 0) { rig.copyPose(Pt, Pc); waveArm(K, Pt, c, wv); rig.blendBones(Pc, Pt, ease(wv), K.armBones.R); }
    const rc = clamp(s.reach || 0);
    if (rc > 0) {
      let T = null;
      if (s.reachTarget) { T = group.worldToLocal(_look.copy(s.reachTarget)); }
      rig.copyPose(Pt, Pc); reachArm(K, Pt, c, T); rig.blendBones(Pc, Pt, ease(rc), K.armBones.R);
    }
    // the left hand out to something (taking the basket by its handle)
    const rl = clamp(s.reachL || 0);
    if (rl > 0 && s.reachLTarget) {
      group.updateWorldMatrix(true, false);
      rig.copyPose(Pt, Pc); reachArmL(K, Pt, c, group.worldToLocal(_look.copy(s.reachLTarget))); rig.blendBones(Pc, Pt, ease(rl), K.armBones.L);
    }
    // something held up before the eyes in the right fist (over any reach: the hand comes up out of it)
    const rz = clamp(s.raise || 0);
    if (rz > 0 && s.raiseTarget) {
      group.updateWorldMatrix(true, false);
      rig.copyPose(Pt, Pc); holdUpArm(K, Pt, c, group.worldToLocal(_look.copy(s.raiseTarget))); rig.blendBones(Pc, Pt, ease(rz), K.armBones.R);
    }
    // carving: the knife drawn down the bark, the other palm braced on the trunk
    const cv = clamp(s.carve || 0);
    if (cv > 0 && s.carveTarget) {
      group.updateWorldMatrix(true, false);
      const bT = s.braceTarget && !(s.measure > 0) ? group.worldToLocal(_cvB.copy(s.braceTarget)) : null;
      rig.copyPose(Pt, Pc); carveArms(K, Pt, c, group.worldToLocal(_cvK.copy(s.carveTarget)), bT, s.carveMode);
      rig.blendBones(Pc, Pt, ease(cv), bT ? [...K.armBones.R, ...K.armBones.L] : K.armBones.R);
    }
    // his height marked on the bark: the left palm on his crown, laid forward level to the bark
    const ms = clamp(s.measure || 0);
    if (ms > 0 && s.measureTarget) {
      group.updateWorldMatrix(true, false);
      rig.copyPose(Pt, Pc); measureArm(K, Pt, c, group.worldToLocal(_cvM.copy(s.measureTarget)), clamp(s.measureSlide || 0)); rig.blendBones(Pc, Pt, ease(ms), K.armBones.L);
    }
    // a palm laid flat on something (the cuts in the bark)
    const pm = clamp(s.palm || 0);
    if (pm > 0 && s.palmTarget) {
      group.updateWorldMatrix(true, false);
      rig.copyPose(Pt, Pc); palmArm(K, Pt, c, group.worldToLocal(_cvP.copy(s.palmTarget))); rig.blendBones(Pc, Pt, ease(pm), K.armBones.R);
    }
    const hd = clamp(s.hold || 0);
    if (hd > 0) { rig.copyPose(Pt, Pc); holdArms(K, Pt, c); rig.blendBones(Pc, Pt, ease(hd), [...K.armBones.L, ...K.armBones.R]); }
    // hand grips for props (e.g. gripL: 'hook' for a basket handle, 'bow' for a bow carried at the side)
    if (s.gripL) K.fingers(Pc, 'L', s.gripL);
    if (s.gripR) K.fingers(Pc, 'R', s.gripR);
    // grief: head bows, shoulders curl
    const gr = ease(clamp(s.grief || 0));
    if (gr > 0) {
      const add = (n, x, y, z) => { eulerQ(_lq, x * gr, y * gr, z * gr); Pc.q[rig.idx[n]].multiply(_lq); };
      add('spine', 6, 0, 0); add('chest', 12, 0, 0); add('neck', 20, 0, 0); add('head', 18, 0, 0);
      add('clavicleL', 0, -9, -4); add('clavicleR', 0, 9, 4);
    }
    // looking up at the sky: the chest opens and the back arches a little, so the head can go farther back
    const lu = ease(clamp(s.lookUp || 0));
    if (lu > 0) {
      const add = (n, x) => { eulerQ(_lq, x * lu, 0, 0); Pc.q[rig.idx[n]].multiply(_lq); };
      add('spine', -4); add('chest', -9); add('neck', -4);
    }
    // look at
    let lyaw = 0, lpitch = 0;
    if (s.lookAt) {
      rig.fk(Pc);
      group.updateWorldMatrix(true, false);
      group.worldToLocal(_look.copy(s.lookAt));
      rig.pointOn(rig.idx.head, _hp.set(0, rig.bindPos[rig.idx.head].y + 0.07 * k, 0.05 * k), _hp);
      _look.sub(_hp);
      // into the chest frame
      _lq.copy(rig.wq[rig.idx.chest]).invert();
      _look.applyQuaternion(_lq);
      lyaw = Math.atan2(_look.x, _look.z) / DEG;
      lpitch = -Math.atan2(_look.y, Math.hypot(_look.x, _look.z)) / DEG;
      if (_look.z < 0 && Math.abs(lyaw) > 100) lyaw = Math.sign(lyaw) * 100;
    }
    // lookW (0..1) fades the look in and out; without a target the head eases back to neutral
    const lkw = s.lookAt ? clamp(s.lookW ?? 1) : 0;
    st.lookT.set(clamp(lyaw, -70, 70) * lkw, clamp(lpitch, -35 - 22 * lu, 45) * lkw);
    const kk = dt > 0 ? 1 - Math.exp(-dt * 5) : 1;
    if (!st.settled) st.look.copy(st.lookT); else st.look.lerp(st.lookT, kk);
    const ly = st.look.x, lp = st.look.y;
    if (Math.abs(ly) + Math.abs(lp) > 0.02) {
      eulerQ(_lq, lp * 0.35, ly * 0.4, 0); Pc.q[rig.idx.neck].premultiply(_lq);
      eulerQ(_lq, lp * 0.5, ly * 0.55, 0); Pc.q[rig.idx.head].premultiply(_lq);
    }
    if (lkw > 0) U.uGaze.value.set(clamp((lyaw * lkw - st.look.x) * 0.00006 + ly * 0.00002, -0.0028, 0.0028), clamp(-(lpitch * lkw - st.look.y) * 0.00005 - lp * 0.00001, -0.0018, 0.0018));
    else U.uGaze.value.multiplyScalar(0.9);
    // eyelids: blink, closed while meditating, heavy while grieving
    const blink = Math.pow(Math.max(0, Math.sin(time * 0.9) * Math.sin(time * 2.3 + 0.4)), 40);
    U.uLid.value = clamp(Math.max(blink, (s.sit || 0) * 0.97, gr * 0.55, (s.lie || 0) * (1 - (s.getUp || 0)) * 0.2, s.eyes !== undefined ? 1 - s.eyes : 0));
    // ground contact
    const mn = contactMin();
    const grounded = Math.max(s.crouch || 0, s.kneel || 0, s.sit || 0, s.pushup || 0, lw, gu > 0 && gu < 1 ? 1 : 0, (s.fall || 0) * 0.6);
    const corr = mn < 0 ? -mn : -mn * clamp(grounded);
    Pc.rp.y += corr;
    st.corr = corr;
    rig.apply(Pc);
    rig.fk(Pc);
  }


  const api = {
    group, bones: {}, anchors: {}, rig, uniforms: U, skinMesh: C.skinMesh, clothMesh: C.clothMesh, hairMesh: C.hairMesh, state: st,
    update(dt, time, state = {}) {
      dt = clamp(dt || 0, 0, 0.1);
      const s = Object.assign({}, defaults, state);
      st.lastState = s;
      U.uTime.value = time;
      computePose(dt, time, s);
      if (!st.settled) { C.settle(s); return; }
      if (dt > 0) C.stepSecondary(dt, time, s);
      else C.refresh();
    },
    // big jumps re-settle the hair / sash; small steps (an age track animating) just let the simulation follow
    setAge(a) { const d = Math.abs(clamp(a) - (st.age ?? 0)); if (d < 1e-4) return; setAge(a); if (st.settled && d > 0.12) C.settle(st.lastState); },
    setPhase(p) { st.phase = p; },
    settle() { C.settle(st.lastState); },
    attach: C.attach,
    setFade: C.setFade,
    dispose: C.dispose,
    // (debug/measurement handles: the strand and sash simulations)
    _hairSim: C.hairSim, _sashSim: C.sashSim, _K: K, _C: C,
  };
  for (const b of C.bones) api.bones[b.name] = b;
  for (const n of ['handR', 'handL', 'head', 'back', 'hipL', 'hipR']) api.anchors[n] = () => C.anchorPos(n);
  setAge(age);
  api.update(0, 0, {});
  return api;
}
