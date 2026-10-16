// Procedural pose library for the hero rig. Every pose is built from root placement, spine angles and IK targets
// for hands and feet (so poses survive the age change in proportions); poses are blended per bone with slerp.
import * as THREE from 'three';
import { aimQuat, eulerQ, axisQ, twoBoneIK, setWorldRot, shareTwist } from './hero-rig.js';
import { clamp, lerp, smooth, DEG, TAU } from './hero-util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = V(), _v2 = V(), _v3 = V();
const FING = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export const GRIPS = {
  relaxed: [0.3, 0.3, 0.37, 0.44, 0.5, 0.12, 24],
  fist: [0.7, 0.92, 0.97, 0.97, 0.97, 0],
  bow: [0.62, 0.85, 0.92, 0.94, 0.95, 0],
  roller: [0.48, 0.62, 0.68, 0.72, 0.76, 0.05],
  rod: [0.55, 0.72, 0.78, 0.82, 0.86, 0.03],
  open: [0.05, 0.02, 0.02, 0.04, 0.07, 1],
  flat: [0.08, 0.03, 0.03, 0.04, 0.06, 0.55],
  hook: [0.45, 0.62, 0.66, 0.7, 0.88, 0],
  holdHand: [0.4, 0.5, 0.56, 0.6, 0.64, 0.1, 10],
  mudra: [0.18, 0.12, 0.12, 0.14, 0.18, 0.1],
  pinch: [0.45, 0.42, 0.62, 0.78, 0.88, 0.1],
  limp: [0.28, 0.32, 0.38, 0.44, 0.5, 0.2, 20],
  claw: [0.3, 0.45, 0.5, 0.55, 0.6, 0.8],
};

export class PoseKit {
  constructor(rig) {
    this.rig = rig;
    const I = rig.idx;
    this.I = I;
    this.side = {};
    const ca = Math.cos(35 * DEG), sa = Math.sin(35 * DEG);
    for (const s of ['L', 'R']) {
      const m = s === 'L' ? 1 : -1;
      this.side[s] = {
        m,
        a: V(m * sa, -ca, 0),            // bind arm / hand direction
        n: V(-m * ca, -sa, 0),           // bind palm normal
        f: V(0, 0, 1),                   // thumb side
        hElbow: V(-ca, -m * sa, 0),      // elbow hinge (flexion positive)
        hFinger: V(0, 0, -m),            // finger curl axis
        hKnee: V(1, 0, 0),
      };
    }
    this.footFwd0 = {}; this.footUp0 = V(0, 1, 0);
    this.armBones = {}; this.legBones = {};
    for (const s of ['L', 'R']) {
      this.armBones[s] = [I['clavicle' + s], I['upperArm' + s], I['foreArm' + s], I['hand' + s], ...FING.flatMap(f => [I[f + '1' + s], I[f + '2' + s], I[f + '3' + s]])];
      this.legBones[s] = [I['thigh' + s], I['shin' + s], I['foot' + s], I['toe' + s]];
    }
    this.spineBones = [I.spine, I.chest, I.neck, I.head];
  }
  // geometry of the current age
  dims() {
    const r = this.rig, I = this.I, b = r.bindPos;
    return {
      hipY: b[I.hips].y, thighY: b[I.thighL].y, kneeY: b[I.shinL].y, ankY: b[I.footL].y, hipX: b[I.thighL].x,
      lThigh: r.off[I.shinL].length(), lShin: r.off[I.footL].length(), lUA: r.off[I.foreArmL].length(), lFA: r.off[I.handL].length(),
      shY: b[I.upperArmL].y, shX: b[I.upperArmL].x, k: b[I.head].y / 1.522, ankZ: b[I.footL].z, heelZ: -0.075 * (b[I.head].y / 1.522), ballZ: b[I.toeL].z, toeY: b[I.toeL].y,
    };
  }
  base(P) { this.rig.copyPose(P, this.rest || (this.rest = this.rig.newPose())); P.rp.copy(this.rig.bindPos[0]); for (const q of P.q) q.identity(); return P; }
  e(P, name, x, y, z, order = 'YXZ') { eulerQ(P.q[this.I[name]], x, y, z, order); return this; }
  root(P, x, y, z, rx, ry, rz) { P.rp.set(x, y, z); eulerQ(P.q[0], rx, ry, rz, 'YXZ'); return P; }
  // leg IK: ankle target (group space), knee pole direction, foot orientation (forward, up)
  // level: fwd/up describe the sole (fwd horizontal + up vertical = foot flat on the ground). Without it the bind
  // ankle->toe direction (which slopes down ~22 deg) is aimed along fwd, as the older seated/kneeling poses expect.
  leg(P, s, T, pole, fwd, up, toe = 0, level = false) {
    const I = this.I, r = this.rig;
    twoBoneIK(r, P, I['thigh' + s], I['shin' + s], I['foot' + s], T, pole, this.side[s].hKnee);
    const f0 = _v.subVectors(r.bindPos[I['toe' + s]], r.bindPos[I['foot' + s]]);
    if (level) f0.y = 0;
    f0.normalize();
    aimQuat(_q, f0, this.footUp0, fwd, up);
    setWorldRot(r, P, I['foot' + s], _q);
    eulerQ(P.q[I['toe' + s]], toe, 0, 0);
    return P;
  }
  // arm IK: grip point target (palm centre), elbow pole, hand orientation (finger direction, palm normal)
  arm(P, s, grip, pole, fingerDir, palmDir, twist = 0.55) {
    const I = this.I, r = this.rig, S = this.side[s];
    aimQuat(_q2, S.a, S.n, fingerDir, palmDir);
    const hs = r.bindPos[I['hand' + s]].distanceTo(r.endPos[I['hand' + s]]) / 0.092;
    // wrist = grip - R*(a*0.058 + n*0.02)
    _v3.copy(S.a).multiplyScalar(0.058 * hs).addScaledVector(S.n, 0.02 * hs).applyQuaternion(_q2);
    const W = _v2.copy(grip).sub(_v3);
    twoBoneIK(r, P, I['upperArm' + s], I['foreArm' + s], I['hand' + s], W, pole, S.hElbow);
    setWorldRot(r, P, I['hand' + s], _q2);
    if (twist) shareTwist(P, I['foreArm' + s], I['hand' + s], S.a, twist);
    return P;
  }
  // arm FK: upper arm (flex forward, abduct out, twist), elbow flex, hand (flex, deviation)
  armFK(P, s, flex, abd, tw, elbow, wflex = 0, wdev = 0, pron = 0) {
    const I = this.I, S = this.side[s], m = S.m;
    // bring arm from the A-pose: abduction about z, flexion about x
    eulerQ(P.q[I['upperArm' + s]], -flex, m * tw, m * (abd - 35), 'XYZ');
    axisQ(P.q[I['foreArm' + s]], S.hElbow, elbow);
    if (pron) { _q.setFromAxisAngle(S.a, pron * DEG * m); P.q[I['foreArm' + s]].multiply(_q); }
    axisQ(P.q[I['hand' + s]], S.hFinger, wflex);
    if (wdev) { _q.setFromAxisAngle(S.n, wdev * DEG); P.q[I['hand' + s]].multiply(_q); }
    return P;
  }
  fingers(P, s, g, w = 1) {
    if (typeof g === 'string') g = GRIPS[g];
    const I = this.I, S = this.side[s];
    const ax = S.hFinger;
    for (let i = 1; i < 5; i++) {
      const c = g[i] * w, sp = (g[5] || 0) * w;
      const f = FING[i];
      axisQ(P.q[I[f + '1' + s]], ax, c * 72);
      _q.setFromAxisAngle(S.n, (i - 2.2) * sp * 7 * DEG * -S.m);
      P.q[I[f + '1' + s]].premultiply(_q);
      axisQ(P.q[I[f + '2' + s]], ax, c * 92);
      axisQ(P.q[I[f + '3' + s]], ax, c * 62);
    }
    const t = g[0] * w;
    // thumb: opposition (swing across the palm) + flexion
    const ta = _v.copy(S.a).multiplyScalar(0.2).addScaledVector(S.f, -0.25).addScaledVector(S.n, 0.2).normalize();
    eulerQ(P.q[I['thumb1' + s]], 0, 0, 0);
    P.q[I['thumb1' + s]].setFromAxisAngle(S.a, -S.m * t * 30 * DEG);
    _q.setFromAxisAngle(V(0, 0, 0).copy(S.f).cross(S.a).normalize(), S.m * t * 12 * DEG);
    P.q[I['thumb1' + s]].multiply(_q);
    // adduction (g[6], degrees): a resting thumb lies along the index finger instead of sticking forward
    if (g[6]) { _q.setFromAxisAngle(S.n, -S.m * g[6] * w * DEG); P.q[I['thumb1' + s]].premultiply(_q); }
    const tax = V().crossVectors(S.n, S.f).normalize().multiplyScalar(-1).applyAxisAngle(S.a, 0.6 * S.m);
    axisQ(P.q[I['thumb2' + s]], tax, t * 38);
    axisQ(P.q[I['thumb3' + s]], tax, t * 55);
    return P;
  }
}

// ---------------------------------------------------------------------------------------------- poses
// All pose functions: (K, P, ctx) -> P, ctx = { t (time), dims, ... }
export function idlePose(K, P, c) {
  const d = c.d;
  K.base(P);
  const br = Math.sin(c.t * 1.55);
  const sway = Math.sin(c.t * 0.42);
  P.rp.set(0.006 * sway, d.hipY - 0.008, -0.004);
  eulerQ(P.q[0], 0.5, 1.5 * sway, 0.6 * sway);
  K.e(P, 'spine', 1.0 + br * 0.4, -0.8 * sway, -0.4 * sway).e(P, 'chest', -1.5 - br * 1.0, 0, 0).e(P, 'neck', 3, 0, 0).e(P, 'head', -2 + br * 0.3, 0, 0);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    K.e(P, 'clavicle' + s, 0, 0, -m * (2 + br * 0.6));
    K.leg(P, s, V(m * (d.hipX + 0.012), d.ankY, d.ankZ + (m > 0 ? 0.015 : -0.01)), V(m * 0.12, 0, 1), V(m * 0.14, 0, 1), V(0, 1, 0), 0, true);
    K.armFK(P, s, 6 + br * 0.5, 9.5, 0, 14 + br, 6, 0, 8);
    K.fingers(P, s, 'relaxed');
  }
  return P;
}

// gait: speed m/s, run 0..1, phase (cycles). Feet are planted: the stance foot slides back at exactly `speed`.
export function gaitPose(K, P, c) {
  const d = c.d, run = c.run, ph = c.phase, t = c.t;
  K.base(P);
  const mv = smooth(0.0, 0.5, c.speed);
  const L = c.cycle;
  const beta = lerp(0.62, 0.36, run);
  const k = d.k;
  const heelZ = d.heelZ, ballZ = d.ballZ, ankZ = d.ankZ, ankY = d.ankY, toeY = d.toeY;
  const ankles = {}, pitches = {}, toes = {};
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const u = ((ph + (m > 0 ? 0 : 0.5)) % 1 + 1) % 1;
    const stride = L * beta;
    // the stance sits a little behind the hips (heel strike ~0.3 m ahead, toe-off further behind with the heel high),
    // so a straight-ish leg reaches the ground at both ends of the stance
    const shift = lerp(0.16, 0.06, run) * stride;
    let zH, alpha, pivot, y = 0;
    const aHS = lerp(16, 8, run) * DEG, aTO = lerp(46, 50, run) * DEG;
    const ankleFrom = (pz, py, a, piv) => {
      // ankle position for a foot pitched by a (positive = toe up) about pivot (heel or ball), pivot at (pz, py).
      // The ball pivot is the toe joint itself (toeY above the ground): the toes stay flat on the ground and the
      // foot rolls about their root, so the ball neither sinks nor slides.
      const rel = piv === 'heel' ? [ankY, ankZ - heelZ] : [ankY - toeY, ankZ - ballZ];
      const ca = Math.cos(a), sa = Math.sin(a);
      return [py + (piv === 'heel' ? 0 : toeY) + rel[0] * ca + rel[1] * sa, pz + rel[1] * ca - rel[0] * sa];
    };
    let ay, az;
    if (u < beta) {
      const s0 = u / beta;
      zH = stride * (0.5 - s0) - shift;
      if (s0 < 0.16) { alpha = aHS * (1 - smooth(0, 0.16, s0)); [ay, az] = ankleFrom(zH, 0, alpha, 'heel'); }
      else if (s0 < 0.62) { alpha = 0; [ay, az] = ankleFrom(zH, 0, 0, 'heel'); }
      else { alpha = -aTO * smooth(0.62, 1, s0); [ay, az] = ankleFrom(zH + (ballZ - heelZ), 0, alpha, 'ball'); }
    } else {
      const s1 = (u - beta) / (1 - beta);
      const [y0, z0] = ankleFrom(-stride * 0.5 - shift + (ballZ - heelZ), 0, -aTO, 'ball');
      const [y1, z1] = ankleFrom(stride * 0.5 - shift, 0, aHS, 'heel');
      const e = s1 * s1 * (3 - 2 * s1);
      az = lerp(z0, z1, e);
      ay = lerp(y0, y1, s1);
      const lift = lerp(0.075, 0.2, run) * k * Math.pow(Math.sin(Math.PI * s1), 1.2);
      ay += lift;
      // running: heel recovers high behind the body
      az -= run * 0.16 * k * Math.sin(Math.PI * Math.min(1, s1 * 1.4)) * (1 - s1);
      ay += run * 0.12 * k * Math.sin(Math.PI * Math.min(1, s1 * 1.6)) * (1 - s1);
      alpha = lerp(-aTO, aHS, smooth(0.15, 0.95, s1)) + 10 * DEG * Math.sin(Math.PI * s1);
      // the swinging foot clears the ground: never lower than the ankle height at which its heel (toe up), ball or
      // toe tip (toe down) would touch (otherwise the ground contact lifts the whole body for part of every step)
      const ca = Math.cos(alpha), sa = Math.sin(alpha), clr = 0.004 * Math.sin(Math.PI * s1);
      ay = Math.max(ay, ankY * ca + (ankZ - heelZ) * sa + clr, ankY * ca + (ankZ - ballZ) * sa + clr, ankY * ca + (ankZ - 0.2 * k) * sa + clr);
    }
    // blend with standing for low speeds
    const sx = m * (d.hipX + lerp(0.008, -0.022, run) + 0.012 * (1 - mv));
    ankles[s] = V(sx, lerp(ankY, ay, mv), lerp(ankZ + (m > 0 ? 0.01 : -0.01), az, mv));
    pitches[s] = alpha * mv;
    // toes stay on the ground through the roll-off, then relax early in the swing (no snap at toe-off)
    toes[s] = (u < beta ? (alpha < 0 ? -alpha / DEG : 0) : aTO / DEG * (1 - smooth(0, 0.3, (u - beta) / (1 - beta)))) * mv;
  }
  // pelvis
  const bob = lerp(-0.012 - 0.017 * Math.cos(4 * Math.PI * (ph - beta / 2) + Math.PI), -0.06 - 0.032 * Math.cos(4 * Math.PI * (ph - beta / 2)), run) * k;
  const yaw = -lerp(6, 9, run) * Math.cos(TAU * ph) * mv;
  const roll = lerp(3.5, 2, run) * Math.cos(TAU * (ph - beta / 2) * 2) * mv;
  const lean = lerp(3, 14, run) * mv + 1.5;
  // (walking: the hips ride ~3 cm lower than standing, knees soft through the stance)
  P.rp.set(0.016 * Math.sin(TAU * ph) * mv * (1 - run * 0.5), d.hipY + bob * mv - 0.008 * (1 - mv) - lerp(0.03, 0, run) * k * mv, 0.01 * mv);
  eulerQ(P.q[0], lean * 0.6, yaw, roll);
  K.e(P, 'spine', lean * 0.3, -yaw * 0.55, -roll * 0.6).e(P, 'chest', lean * 0.2 - 1.5, -yaw * 0.6, -roll * 0.3);
  // the head stays nearly level and facing ahead (vestibular stabilisation): it takes ~10% of the pelvis yaw and
  // ~20% of its roll, so the hair is not shaken sideways at every step
  K.e(P, 'neck', 2 - lean * 0.45, yaw * 0.12, roll * 0.05).e(P, 'head', -lean * 0.35, yaw * 0.13, roll * 0.05);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const a = pitches[s];
    const fwd = V(m * 0.12 * (1 - run * 0.6), Math.sin(a), Math.cos(a)).normalize();
    const up = V(0, Math.cos(a), -Math.sin(a));
    K.leg(P, s, ankles[s], V(m * 0.08, 0, 1), fwd, up, -toes[s], true);
    // arms swing opposite to the legs
    const sw = -m * Math.cos(TAU * ph) * mv;
    const A = lerp(17, 42, run);
    const elbow = lerp(16 + 10 * Math.max(0, sw), 88 + 12 * sw, run);
    K.armFK(P, s, 4 + sw * A, lerp(10, 16, run), lerp(0, -10, run), elbow, lerp(4, 0, run), 0, lerp(10, 40, run));
    K.e(P, 'clavicle' + s, 0, m * sw * lerp(3, 8, run), -m * 2);
    K.fingers(P, s, run > 0.5 ? 'fist' : 'relaxed', run > 0.5 ? 0.85 : 1);
  }
  return P;
}

export function crouchPose(K, P, c) {
  const d = c.d, k = d.k;
  K.base(P);
  P.rp.set(0.0, 0.43 * k, -0.06 * k);
  eulerQ(P.q[0], 28, -6, 0);
  K.e(P, 'spine', 14, -4, 0).e(P, 'chest', 12, -6, -4).e(P, 'neck', 6, 0, 0).e(P, 'head', 14, -10, 0);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    K.leg(P, s, V(m * 0.17 * k, d.ankY + 0.012, (m > 0 ? 0.06 : -0.02) * k), V(m * 0.55, 0.15, 1), V(m * 0.3, -0.05, 1), V(0, 1, 0.12), 8, true);
  }
  K.e(P, 'clavicleR', 0, -6, 4).e(P, 'clavicleL', 0, 0, -3);
  // right hand to the ground in front-right (picking), left forearm resting on the knee
  const pick = Math.sin(c.t * 2.1) * 0.012;
  K.arm(P, 'R', V(-0.13 * k, 0.03 + pick, 0.36 * k), V(-0.6, 0.2, -0.6), V(-0.1, -0.85, 0.5).normalize(), V(0.3, -0.2, -0.9).normalize());
  K.arm(P, 'L', V(0.2 * k, 0.42 * k, 0.33 * k), V(0.6, -0.4, -0.4), V(-0.35, -0.6, 0.7).normalize(), V(-0.3, -0.75, -0.2).normalize());
  K.fingers(P, 'R', 'pinch'); K.fingers(P, 'L', 'limp');
  return P;
}

export function kneelPose(K, P, c) {
  const d = c.d, k = d.k;
  K.base(P);
  P.rp.set(0, 0.33 * k, -0.035 * k);
  eulerQ(P.q[0], 8, 0, 0);
  K.e(P, 'spine', 4, 0, 0).e(P, 'chest', 2, 0, 0).e(P, 'neck', 4, 0, 0).e(P, 'head', 6, 0, 0);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    // shin flat on the ground behind the knee, foot pointing back with the sole up
    K.leg(P, s, V(m * 0.085 * k, 0.075 * k, -0.07 * k), V(m * 0.05, -0.2, 1), V(0, -0.12, -1).normalize(), V(0, -1, 0.1).normalize(), 20);
    K.arm(P, s, V(m * 0.12 * k, 0.33 * k, 0.17 * k), V(m * 0.5, -0.3, -0.6), V(-m * 0.15, -0.35, 1).normalize(), V(m * 0.15, -1, 0.1).normalize());
    K.fingers(P, s, 'relaxed');
  }
  return P;
}

export function sitPose(K, P, c) {
  const d = c.d, k = d.k;
  K.base(P);
  const br = Math.sin(c.t * 1.2);
  P.rp.set(0, 0.165 * k, -0.06 * k);
  eulerQ(P.q[0], 12, 0, 0);
  K.e(P, 'spine', -4 + br * 0.4, 0, 0).e(P, 'chest', -4 - br * 0.8, 0, 0).e(P, 'neck', 6, 0, 0).e(P, 'head', 10, 0, 0);
  // crossed legs: each ankle tucked under the opposite knee
  K.leg(P, 'L', V(-0.13 * k, 0.075 * k, 0.21 * k), V(1, 0.6, 0.35), V(-1, -0.05, -0.15).normalize(), V(-0.15, 0.25, 1).normalize(), 0);
  K.leg(P, 'R', V(0.12 * k, 0.085 * k, 0.15 * k), V(-1, 0.6, 0.35), V(1, -0.05, -0.15).normalize(), V(0.15, 0.25, 1).normalize(), 0);
  // hands in the lap, right over left, thumbs touching
  K.arm(P, 'L', V(0.035 * k, 0.215 * k, 0.17 * k), V(0.6, -0.5, -0.4), V(-0.75, 0.05, 0.6).normalize(), V(0, 1, 0.15).normalize());
  K.arm(P, 'R', V(-0.035 * k, 0.235 * k, 0.175 * k), V(-0.6, -0.5, -0.4), V(0.75, 0.05, 0.6).normalize(), V(0, 1, 0.15).normalize());
  K.fingers(P, 'L', 'mudra'); K.fingers(P, 'R', 'mudra');
  return P;
}

export function pushupPose(K, P, c) {
  const d = c.d, k = d.k;
  K.base(P);
  const cyc = c.t / 2.3;
  const u = 0.5 + 0.5 * Math.cos(TAU * cyc);       // 1 = arms extended
  const hs = lerp(0.2, 0.56, Math.pow(u, 0.8)) * k;  // shoulder height
  const Lb = 1.37 * k, toeZ = -0.86 * k;
  const th = Math.asin(clamp(hs / Lb, 0, 1));
  const hipL = 0.86 * k;
  P.rp.set(0, Math.sin(th) * hipL + 0.03, toeZ + Math.cos(th) * hipL);
  eulerQ(P.q[0], 90 - th / DEG, 0, 0);
  K.e(P, 'spine', -2, 0, 0).e(P, 'chest', -2, 0, 0).e(P, 'neck', -18, 0, 0).e(P, 'head', -12, 0, 0);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    K.e(P, 'thigh' + s, 0, 0, m * -2).e(P, 'shin' + s, 2, 0, 0);
    eulerQ(P.q[K.I['foot' + s]], -(90 - th / DEG) + 18, 0, 0);
    eulerQ(P.q[K.I['toe' + s]], -50, 0, 0);
    K.arm(P, s, V(m * 0.2 * k, 0.012, toeZ + 1.3 * k), V(m * 0.55, 0.3, -1), V(m * 0.2, 0, 1).normalize(), V(0, -1, 0));
    K.fingers(P, s, 'flat');
  }
  return P;
}

// archery: the arrow flies along +z; the body turns side-on with the left shoulder to the target
export function drawPose(K, P, c) {
  const d = c.d, k = d.k, rel = c.release;
  K.base(P);
  P.rp.set(0, d.hipY - 0.025 * k, 0);
  eulerQ(P.q[0], 0, -78, 0);
  K.e(P, 'spine', 0, -4, 2).e(P, 'chest', -3, -6, 3).e(P, 'neck', 0, 40, 0).e(P, 'head', -3, 40, 4);
  // feet across the line of fire, toes facing the archer's front (-x)
  K.leg(P, 'L', V(-0.02 * k, d.ankY, 0.17 * k), V(-1, 0, 0.3), V(-1, 0, 0.35).normalize(), V(0, 1, 0), 0, true);
  K.leg(P, 'R', V(0.02 * k, d.ankY, -0.17 * k), V(-1, 0, -0.2), V(-1, 0, -0.1).normalize(), V(0, 1, 0), 0, true);
  // bow arm extended toward +z at shoulder height; grip axis vertical
  const sh = c.shoulderL || V(0, 1.38 * k, 0.17 * k);
  K.e(P, 'clavicleL', 0, 0, -4);
  K.arm(P, 'L', V(-0.035 * k, d.shY + 0.02 * k - rel * 0.03, 0.78 * k + rel * 0.02), V(-0.2, -1, 0), V(0, 0, 1), V(-1, 0, 0), 0.4);
  K.fingers(P, 'L', 'bow');
  // drawing hand anchored under the right cheekbone; on release it flies back past the ear and opens
  const anchor = V(-0.075 * k, d.shY + 0.085 * k, -0.01 * k);
  const back = V(-0.13 * k, d.shY + 0.12 * k, -0.2 * k);
  const g = anchor.lerp(back, smooth(0, 0.6, rel));
  K.e(P, 'clavicleR', 0, 12, 6);
  K.arm(P, 'R', g, V(-0.15, 0.2, -1), V(0.1, -0.15, 1).normalize(), V(1, 0.1, -0.1).normalize(), 0.4);
  K.fingers(P, 'R', rel > 0.05 ? 'open' : 'hook');
  return P;
}

export function fallPose(K, P, c) {
  const d = c.d, k = d.k, t = c.t;
  K.base(P);
  P.rp.set(0, 0.62 * k, -0.28 * k);
  eulerQ(P.q[0], -38, 6, 4);
  K.e(P, 'spine', 10, 0, 0).e(P, 'chest', 12, 0, 0).e(P, 'neck', 18, 0, 0).e(P, 'head', 14, 0, 0);
  // one foot slipping forward and up, the other still on the ground
  K.leg(P, 'R', V(-0.1 * k, 0.32 * k, 0.32 * k), V(0, 0.6, 1), V(0, 0.45, 1).normalize(), V(0, 1, -0.45).normalize());
  K.leg(P, 'L', V(0.12 * k, d.ankY, -0.02 * k), V(0.1, 0, 1), V(0.1, 0, 1).normalize(), V(0, 1, 0), 0, true);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const fl = Math.sin(t * 7.3 + m * 1.7), fl2 = Math.sin(t * 5.1 + m * 0.6);
    K.armFK(P, s, 95 + 28 * fl, 55 + 20 * fl2, 0, 40 + 25 * fl2, -10, 0, 0);
    K.fingers(P, s, 'claw');
  }
  return P;
}

export function liePose(K, P, c) {
  const d = c.d, k = d.k;
  K.base(P);
  const br = Math.sin(c.t * 1.3);
  P.rp.set(0, 0.11 * k, -0.08 * k);
  eulerQ(P.q[0], -86, 4, 14);
  K.e(P, 'spine', -2 + br, 0, 2).e(P, 'chest', -2 + br, 0, 0).e(P, 'neck', 8, 20, 0).e(P, 'head', 6, 22, 6);
  K.leg(P, 'R', V(-0.13 * k, 0.07, 0.78 * k), V(0, 1, 0.2), V(-0.25, 1, 0.2).normalize(), V(0, 0.2, -1).normalize());
  K.leg(P, 'L', V(0.16 * k, 0.075, 0.45 * k), V(0.25, 1, 0.3), V(0.15, 0, 1).normalize(), V(0, 1, 0), 0, true);
  K.arm(P, 'R', V(-0.48 * k, 0.035, -0.32 * k), V(-0.2, 1, 0.5), V(-0.6, 0, 0.6).normalize(), V(0, -1, 0));
  K.arm(P, 'L', V(0.06 * k, 0.24 * k, -0.18 * k), V(0.9, 0.4, 0), V(-1, 0, 0.1).normalize(), V(0, -1, 0.2).normalize());
  K.fingers(P, 'R', 'limp'); K.fingers(P, 'L', 'limp');
  return P;
}

// get-up keys: 0 lie, 1 sit up, 2 hands and knees, 3 kneel on one knee
export function getUpKey(K, P, c, key) {
  const d = c.d, k = d.k;
  if (key === 0) return liePose(K, P, c);
  K.base(P);
  if (key === 1) {
    P.rp.set(0, 0.16 * k, 0.0);
    eulerQ(P.q[0], -32, 0, 0);
    K.e(P, 'spine', 10, 0, 0).e(P, 'chest', 8, 0, 0).e(P, 'neck', 10, 0, 0).e(P, 'head', 8, 0, 0);
    K.leg(P, 'L', V(0.13 * k, 0.07, 0.62 * k), V(0, 1, 0.4), V(0.1, 0, 1).normalize(), V(0, 1, 0), 0, true);
    K.leg(P, 'R', V(-0.14 * k, 0.07, 0.72 * k), V(0, 1, 0.3), V(-0.1, 0.3, 1).normalize(), V(0, 1, -0.2).normalize());
    for (const s of ['L', 'R']) {
      const m = s === 'L' ? 1 : -1;
      K.arm(P, s, V(m * 0.24 * k, 0.03, -0.3 * k), V(m * 0.3, 0.2, 1), V(m * 0.2, -0.3, -1).normalize(), V(0, -1, 0), 0.4);
      K.fingers(P, s, 'flat');
    }
  } else if (key === 2) {
    P.rp.set(0, 0.56 * k, 0.12 * k);
    eulerQ(P.q[0], 78, 0, 0);
    K.e(P, 'spine', 6, 0, 0).e(P, 'chest', 2, 0, 0).e(P, 'neck', -14, 0, 0).e(P, 'head', -10, 0, 0);
    for (const s of ['L', 'R']) {
      const m = s === 'L' ? 1 : -1;
      K.leg(P, s, V(m * 0.11 * k, 0.075, -0.3 * k), V(m * 0.1, -1, 0.4), V(0, -0.2, -1).normalize(), V(0, -1, 0.15).normalize(), 15);
      K.arm(P, s, V(m * 0.2 * k, 0.012, 0.66 * k), V(m * 0.3, 0.2, -1), V(m * 0.15, 0, 1).normalize(), V(0, -1, 0));
      K.fingers(P, s, 'flat');
    }
  } else {
    P.rp.set(0, 0.5 * k, -0.02 * k);
    eulerQ(P.q[0], 10, 0, 0);
    K.e(P, 'spine', 6, 0, 0).e(P, 'chest', 4, 0, 0).e(P, 'neck', 0, 0, 0).e(P, 'head', -4, 0, 0);
    // left foot planted forward, right knee down
    K.leg(P, 'L', V(0.12 * k, d.ankY, 0.36 * k), V(0.1, 0, 1), V(0.08, 0, 1).normalize(), V(0, 1, 0), 0, true);
    K.leg(P, 'R', V(-0.1 * k, 0.11 * k, -0.34 * k), V(0, -0.6, 1), V(0, -0.55, -1).normalize(), V(0, 0.4, -0.3).normalize(), 40);
    K.arm(P, 'L', V(0.13 * k, 0.56 * k, 0.36 * k), V(0.6, -0.3, -0.5), V(-0.2, -0.5, 1).normalize(), V(0, -1, 0));
    K.arm(P, 'R', V(-0.05 * k, 0.56 * k, 0.32 * k), V(-0.6, -0.3, -0.5), V(0.4, -0.5, 1).normalize(), V(0, -1, 0));
    K.fingers(P, 'L', 'relaxed'); K.fingers(P, 'R', 'relaxed');
  }
  return P;
}

// ---------------------------------------------------------------------------------------------- overlays
export function waveArm(K, P, c, w) {
  const d = c.d, k = d.k, t = c.t;
  const r = K.rig;
  r.fk(P);
  const sh = r.wp[K.I.upperArmR];
  const osc = Math.sin(t * 9.5) * smooth(0.5, 1, w);
  // in the chest frame: up and out to the right, forearm vertical, palm forward
  const chestQ = r.wq[K.I.chest];
  const off = V(-0.16 * k + osc * 0.075, 0.33 * k, 0.12 * k).applyQuaternion(chestQ);
  const grip = off.add(sh);
  const fd = V(-0.12 + osc * 0.4, 1, 0.1).normalize().applyQuaternion(chestQ);
  const pd = V(0, 0, 1).applyQuaternion(chestQ);
  const pole = V(-0.6, -0.8, -0.1).applyQuaternion(chestQ);
  K.e(P, 'clavicleR', 0, 0, -10);
  K.arm(P, 'R', grip, pole, fd, pd, 0.45);
  K.fingers(P, 'R', 'open');
  return P;
}

export function reachArm(K, P, c, target) {
  const r = K.rig;
  r.fk(P);
  const k = c.d.k;
  let T = target;
  if (!T) {
    // forward-down from the right shoulder in body heading
    const hq = r.wq[0];
    T = V(-0.06 * k, 0, 0.5 * k).applyQuaternion(_q.setFromAxisAngle(V(0, 1, 0), yawOf(hq)));
    T.y = Math.max(0.17 * k, r.wp[K.I.upperArmR].y - 0.62 * k);
    T.x += r.wp[0].x; T.z += r.wp[0].z;
  }
  const yaw = yawOf(r.wq[0]);
  const fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
  const fd = fwd.clone().multiplyScalar(0.9).add(V(0, -0.35, 0)).normalize();
  const pd = V(0, -1, 0).addScaledVector(fwd, 0.2).add(V(Math.cos(yaw) * 0.5, 0, -Math.sin(yaw) * 0.5)).normalize();
  K.e(P, 'clavicleR', 0, -10, 0);
  K.arm(P, 'R', T, V(-1, 0.1, -0.3), fd, pd, 0.5);
  K.fingers(P, 'R', 'holdHand');
  return P;
}

// something small held up before the eyes in the right fist (a mushroom by its stem): the forearm rising, the wrist
// straight, the fingers wrapped toward the body's midline and the thumb on top, so what is held stands upright above
// the fist (the hand anchor's +Y, the thumb side, points up). target: the grip point in the group's frame.
export function holdUpArm(K, P, c, target) {
  const r = K.rig;
  r.fk(P);
  const yaw = yawOf(r.wq[K.I.chest]);
  const fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), left = V(Math.cos(yaw), 0, -Math.sin(yaw));
  // (fingers forward and in toward the midline, a little up; thumb up: the palm turned in toward the face)
  const fd = fwd.clone().multiplyScalar(0.62).addScaledVector(left, 0.74).add(V(0, 0.12, 0)).normalize();
  const pd = V(0, 1, 0).cross(fd).normalize();
  K.e(P, 'clavicleR', 0, -6, 5);
  // (the elbow down and out to his right)
  K.arm(P, 'R', target, V(-0.75, -0.65, 0.05), fd, pd, 0.5);
  K.fingers(P, 'R', 'rod');
  return P;
}

// carving a notch in a trunk: the knife in the right fist, the blade out of its little-finger side and its edge to the
// bark, drawn down; the left palm braced flat on the trunk beside the cuts. knife: the fist's grip point; brace: where
// the left palm lies (group space; null leaves the left arm alone)
export function carveArms(K, P, c, knife, brace) {
  const r = K.rig;
  r.fk(P);
  const yaw = yawOf(r.wq[K.I.chest]);
  const fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), left = V(Math.cos(yaw), 0, -Math.sin(yaw));
  // (knuckles toward the bark and a little down, the thumb on top, the palm turned in toward his middle: the blade
  // comes out of the bottom of the fist)
  const fd = fwd.clone().multiplyScalar(0.82).addScaledVector(left, 0.18).add(V(0, -0.38, 0)).normalize();
  const pd = V(0, 1, 0).cross(fd).normalize();
  K.e(P, 'clavicleR', 0, -8, 4);
  K.arm(P, 'R', knife, V(-0.85, -0.45, -0.25), fd, pd, 0.5);
  K.fingers(P, 'R', 'rod');
  if (brace) {
    const fdL = V(0, 1, 0).addScaledVector(fwd, 0.15).addScaledVector(left, -0.2).normalize();
    K.e(P, 'clavicleL', 0, 6, 0);
    K.arm(P, 'L', brace, V(0.85, -0.45, -0.25), fdL, fwd.clone(), 0.5);
    K.fingers(P, 'L', 'flat');
  }
  return P;
}

// the right palm laid flat on something before him, fingers up
export function palmArm(K, P, c, target) {
  const r = K.rig;
  r.fk(P);
  const yaw = yawOf(r.wq[K.I.chest]);
  const fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), left = V(Math.cos(yaw), 0, -Math.sin(yaw));
  const fd = V(0, 1, 0).addScaledVector(fwd, 0.2).addScaledVector(left, 0.25).normalize();
  K.e(P, 'clavicleR', 0, -6, 2);
  K.arm(P, 'R', target, V(-0.8, -0.55, -0.2), fd, fwd.clone(), 0.5);
  K.fingers(P, 'R', 'flat');
  return P;
}

export function holdArms(K, P, c) {
  const r = K.rig, k = c.d.k;
  r.fk(P);
  const cq = r.wq[K.I.chest], cp = r.wp[K.I.chest];
  // keep the scroll level: use only the chest's yaw and a little of its pitch
  const yaw = yawOf(cq);
  const hq = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
  // holdWidth: metres between the two grips (a handscroll held open); wider holds come a little further forward
  const half = (c.holdWidth > 0 ? c.holdWidth : 0.34 * k) / 2;
  const fwd = 0.32 * k + Math.max(0, half - 0.17 * k) * 0.3;
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const grip = V(m * half, 0.0, fwd).applyQuaternion(hq).add(cp);
    grip.y = cp.y + 0.07 * k;
    const fd = V(-m * 0.25, 0.1, 1).normalize().applyQuaternion(hq);
    const pd = V(-m, 0, 0.15).normalize().applyQuaternion(hq);
    K.arm(P, s, grip, V(m * 0.6, -0.7, -0.3).applyQuaternion(hq), fd, pd, 0.5);
    K.fingers(P, s, 'roller');
  }
  return P;
}

export function yawOf(q) {
  const f = _v3.set(0, 0, 1).applyQuaternion(q);
  return Math.atan2(f.x, f.z);
}
