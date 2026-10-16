// The uncle: a ~60-year-old man lying on his back, dying. Same character system as Wuhen (skeleton, skinned robe,
// hair cards with a topknot, beard on the jaw, procedural face with wrinkles). Group origin = floor under his hips,
// head toward -x, body along +x, his right side (where Wuhen kneels) toward +z.
// update(dt, time, { speak, reach, drop, eyes, reachTarget })
import * as THREE from 'three';
import { proportions, eulerQ, axisQ } from './hero-rig.js';
import { styleFor, HERO_HEAD } from './hero-body.js';
import { srgb } from './hero-geo.js';
import { elderCards, elderStatics } from './hero-hair.js';
import { buildCharacter, srgbColor } from './hero-char.js';
import { clamp, lerp, smooth, DEG } from './hero-util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = w => w * w * (3 - 2 * w);

function elderProps() {
  const P = proportions(0);
  const k = 1.66 / 1.70;
  for (const key of ['hipY', 'spineY', 'chestY', 'neckY', 'headY', 'topY', 'shY', 'lUA', 'lFA', 'thighY', 'kneeY', 'ankleY']) P[key] *= k;
  Object.assign(P, { H: 1.66, shX: 0.163, hand: 1.04, hs: 0.95 });
  // an old man's shorter neck: the head sits a little lower on the shoulders
  P.topY -= 0.016;
  P.headY = P.topY - (1.70 - 1.522) * k * P.hs; P.neckY = P.headY - 0.1 * k;
  return P;
}
function elderStyle() {
  const S = styleFor(0);
  const k = 1.66 / 1.70;
  return Object.assign(S, {
    k, hemY: 0.13, slitY: 0.58, tW: 1.13, tD: 1.1, flare: 1.32, vY: 1.285 * k,
    // a dark, well-worn robe (in the ink drawing he must separate from the pale floorboards; his face stays light)
    linen: srgb(0.27, 0.215, 0.17), collar: srgb(0.52, 0.48, 0.42), sash: srgb(0.13, 0.115, 0.1), pants: srgb(0.2, 0.18, 0.16),
    wraps: srgb(0.3, 0.27, 0.24), shoe: srgb(0.1, 0.09, 0.085), sole: srgb(0.24, 0.22, 0.2), skin: srgb(0.74, 0.56, 0.45),
  });
}
// gaunt, but a natural old face: short chin, broad cheekbones over hollow cheeks, a thin neck
const ELDER_HEAD = Object.assign({}, HERO_HEAD, { skullW: 0.95, faceW: 0.9, jawW: 0.88, jawT: 0.9, chinL: 0.93, chinW: 0.9, cheek: 2.1, brow: 1.5, noseL: 1.06, neckR: 0.039, trapW: 0.14, hollow: 2.3, fill: 0, lip: 0.55, socket: 1.2 });

export function createElder() {
  const C = buildCharacter({
    name: 'elder', props: [elderProps(), elderProps()], styles: [elderStyle(), elderStyle()], morph: false, headA: ELDER_HEAD,
    longSleeves: true, jaw: true, gatherAll: true,
    cards: elderCards, statics: elderStatics, tie: [0, 0.1, -0.03],
    hairColors: { root: [0.11, 0.105, 0.1], mid: [0.2, 0.195, 0.19], tip: [0.32, 0.315, 0.31] }, hairVar: 0.5,
    uniforms: U => {
      U.uWrinkle.value = 1; U.uBrow.value = srgbColor(0.5, 0.48, 0.46); U.uIris.value = srgbColor(0.3, 0.22, 0.16);
      U.uLip.value = srgbColor(0.6, 0.44, 0.41); U.uBrowW.value = 0.85; U.uAge.value = 1; U.uTatter.value = 0.35;
      U.uKK.value.set(0.18, 90, 0.2, 20); U.uEyeH.value = 0.72; U.uSmile.value = 1;
    },
  });
  const { group, rig, K, U, Pc, Pt, st, contactMin } = C;
  C.setAge(0);
  const I = rig.idx;
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion();
  const _sh = V(), _t = V(), _d = V();

  function restPose(P, t, s) {
    K.base(P);
    // supine with the head toward -x: yaw +90 after pitching back -90, rolled slightly towards his right (+z)
    eulerQ(P.q[0], -90, 90, 0);
    qA.setFromAxisAngle(V(0, 1, 0), -10 * DEG); P.q[0].multiply(qA);
    P.rp.set(0, 0.12, 0);
    const br = Math.sin(t * (1.1 + s.speak * 0.6)) * (0.6 + 0.6 * s.speak) * (1 - s.drop * 0.85);
    K.e(P, 'spine', -2 + br * 0.6, 0, 0).e(P, 'chest', -1 - br * 1.6, 0, 0);
    // head turned toward Wuhen (his right), slackening when he dies
    const dr = ease(s.drop);
    // (neck flexed a little, as if his head rests on a folded cloth: keeps the throat short in close-ups)
    K.e(P, 'neck', 12 - dr * 6, -22 - dr * 10, -4 - dr * 6).e(P, 'head', 7 + dr * 2, -28 - dr * 14, -6 - dr * 10);
    eulerQ(P.q[I.jaw], clamp(s.speak * (0.3 + 0.7 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1 + 0.5))) * 3.5 + dr * 3, 0, 8), 0, 0);
    // legs long, the left knee slightly raised
    eulerQ(P.q[I.thighL], -14, 4, 4); eulerQ(P.q[I.shinL], 22, 0, 0); eulerQ(P.q[I.footL], 18, 0, 0);
    eulerQ(P.q[I.thighR], -3, -6, -3); eulerQ(P.q[I.shinR], 6, 0, 0); eulerQ(P.q[I.footR], 28, -10, 0);
    // left hand resting on the wound at his belly (placed with IK below)
    K.fingers(P, 'L', 'limp');
    // right arm along his side on the floor
    K.armFK(P, 'R', 8, 16, 0, 14, 10, 0, 0);
    K.fingers(P, 'R', 'limp');
    return P;
  }
  function computePose(dt, t, s) {
    restPose(Pc, t, s);
    rig.fk(Pc);
    {
      const hp = rig.wp[I.spine];
      const br = Math.sin(t * (1.1 + s.speak * 0.6)) * 0.004;
      K.arm(Pc, 'L', V(hp.x - 0.02, hp.y + 0.12 + br, hp.z + 0.02), V(0.1, -0.2, -1), V(0.1, -0.15, 1).normalize(), V(0, -1, 0.1).normalize(), 0.5);
    }
    const k = 1.66 / 1.70;
    rig.pointOn(I.upperArmR, _sh.copy(rig.bindPos[I.upperArmR]), _sh);
    const rc = ease(clamp(s.reach)), dp = ease(clamp(s.drop));
    if (rc > 0) {
      // the hand lifts toward Wuhen: up off the floor and out to his right (+z), palm open to be held
      rig.copyPose(Pt, Pc);
      const tr = Math.sin(t * 9.0) * 0.004 * (1 - dp);
      if (s.reachTarget) {
        // toward a point in the world (where the hands meet), kept just inside his reach
        group.updateWorldMatrix(true, false);
        group.worldToLocal(_t.copy(s.reachTarget));
        _d.subVectors(_t, _sh);
        const L = _d.length(), maxL = 0.55 * k;
        if (L > maxL) _t.copy(_sh).addScaledVector(_d, maxL / L);
        _t.y += tr;
      } else _t.copy(_sh).add(V(0.13 * k, 0.29 * k + tr, 0.27 * k));
      K.arm(Pt, 'R', _t, V(-0.2, -0.6, 0.8), V(0.35, 0.25, 1).normalize(), V(-0.15, 0.55, -0.85).normalize(), 0.5);
      K.fingers(Pt, 'R', 'holdHand');
      rig.blendBones(Pc, Pt, rc * (1 - dp), K.armBones.R);
    }
    if (dp > 0 && rc > 0) {
      // lifeless: the arm drops to the floor beside him, fingers loose
      rig.copyPose(Pt, Pc);
      _t.copy(_sh).add(V(0.2 * k, -0.2, 0.3 * k)); _t.y = 0.035;
      K.arm(Pt, 'R', _t, V(0, 1, 0.4), V(0.45, -0.1, 1).normalize(), V(0, 1, 0.1).normalize(), 0.5);
      K.fingers(Pt, 'R', 'limp');
      rig.blendBones(Pc, Pt, dp * rc, K.armBones.R);
    }
    U.uMouth.value = clamp(s.speak) * (0.25 + 0.75 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1 + 0.5))) * (1 - dp) + dp * 0.25;
    const blink = Math.pow(Math.max(0, Math.sin(t * 0.7) * Math.sin(t * 1.9 + 0.4)), 30);
    // eyes: 1 = his tired half-open look, 0 = closed
    const eyes = (s.eyes === undefined ? 1 : clamp(s.eyes)) * (1 - dp);
    U.uLid.value = clamp(1 - eyes * 0.58 + blink * eyes * 0.5);
    U.uGaze.value.set(-0.0016, 0.0006);
    const mn = contactMin();
    Pc.rp.y -= mn;
    rig.apply(Pc);
    rig.fk(Pc);
  }
  const defaults = { speak: 0, reach: 0, drop: 0, eyes: 1, reachTarget: null };
  const api = {
    group, rig, bones: {}, uniforms: U, state: st, skinMesh: C.skinMesh, clothMesh: C.clothMesh, hairMesh: C.hairMesh, _K: K,
    anchors: { handR: () => C.anchorPos('handR'), handL: () => C.anchorPos('handL'), head: () => C.anchorPos('head') },
    update(dt, time, state = {}) {
      dt = clamp(dt || 0, 0, 0.1);
      const s = Object.assign({}, defaults, state);
      st.lastState = s;
      U.uTime.value = time;
      computePose(dt, time, s);
      if (!st.settled) { C.settle(s); return; }
      if (dt > 0) C.stepSecondary(dt, time, s); else C.refresh();
    },
    settle() { C.settle(st.lastState); },
    attach: C.attach,
    setFade: C.setFade,
    dispose: C.dispose,
  };
  for (const b of C.bones) api.bones[b.name] = b;
  api.update(0, 0, {});
  return api;
}
