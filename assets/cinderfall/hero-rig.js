// Skeleton, forward kinematics and inverse kinematics for the procedural characters.
// Every bone has an identity rotation in the bind pose, so a bone's local axes are the character's axes at bind time
// (x = character's left, y = up, z = forward). Proportions are authored for two ages and blended (bone offsets and
// inverse bind matrices are lerped together with the mesh morph target, so setAge is continuous).
import * as THREE from 'three';
import { DEG, clamp } from './hero-util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

// bone table: name, parent
export function boneTable() {
  const T = [['hips', null], ['spine', 'hips'], ['chest', 'spine'], ['neck', 'chest'], ['head', 'neck'], ['jaw', 'head']];
  for (const s of ['L', 'R']) {
    T.push(['clavicle' + s, 'chest'], ['upperArm' + s, 'clavicle' + s], ['foreArm' + s, 'upperArm' + s], ['hand' + s, 'foreArm' + s]);
    for (const f of FINGERS) T.push([f + '1' + s, 'hand' + s], [f + '2' + s, f + '1' + s], [f + '3' + s, f + '2' + s]);
    T.push(['thigh' + s, 'hips'], ['shin' + s, 'thigh' + s], ['foot' + s, 'shin' + s], ['toe' + s, 'foot' + s]);
  }
  return T;
}

// Joint positions (and bone end points) for a proportion set. Left side authored, right mirrored.
// P: { H, hipY, spineY, chestY, neckY, headY, topY, shX, shY, armA, lUA, lFA, hand, hipX, thighY, kneeY, ankleY, footS, zs }
export function jointsFor(P) {
  const J = {}, E = {};
  const k = P.H / 1.70;
  J.hips = V(0, P.hipY, -0.005 * k);
  J.spine = V(0, P.spineY, -0.016 * k);
  J.chest = V(0, P.chestY, -0.022 * k);
  J.neck = V(0, P.neckY, -0.034 * k);
  J.head = V(0, P.headY, -0.014 * k);
  E.head = V(0, P.topY, 0);
  J.jaw = V(0, P.headY + 0.022 * P.hs, 0.0);
  E.jaw = V(0, P.headY - 0.045 * P.hs, 0.072 * P.hs);
  const a = P.armA * DEG, sa = Math.sin(a), ca = Math.cos(a);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    J['clavicle' + s] = V(m * 0.024 * k, P.shY + 0.016 * k, 0.006 * k);
    const sh = V(m * P.shX, P.shY, -0.016 * k);
    J['upperArm' + s] = sh;
    const ad = V(m * sa, -ca, 0);
    const el = sh.clone().addScaledVector(ad, P.lUA);
    J['foreArm' + s] = el;
    const wr = el.clone().addScaledVector(ad, P.lFA);
    J['hand' + s] = wr;
    // hand frame: along a, thumb side f (+z), palm normal n (towards the body, down)
    const n = V(-m * ca, -sa, 0), f = V(0, 0, 1);
    const hs = P.hand;
    const at = (al, fo, no) => wr.clone().addScaledVector(ad, al * hs).addScaledVector(f, fo * hs).addScaledVector(n, no * hs);
    const fing = {
      index: [at(0.088, 0.021, 0.002), [0.040, 0.024, 0.020], 4],
      middle: [at(0.092, 0.003, 0.002), [0.044, 0.027, 0.021], 0],
      ring: [at(0.087, -0.014, 0.002), [0.041, 0.026, 0.020], -4],
      pinky: [at(0.079, -0.029, 0.002), [0.032, 0.019, 0.018], -9],
    };
    for (const name in fing) {
      const [base, L, spread] = fing[name];
      const d = ad.clone().applyAxisAngle(n, -m * spread * DEG * 0).addScaledVector(f, spread * 0.012).normalize();
      let p = base.clone();
      for (let i = 0; i < 3; i++) { J[name + (i + 1) + s] = p.clone(); p = p.clone().addScaledVector(d, L[i] * hs); }
      E[name + '3' + s] = p;
    }
    // thumb: from the carpal base towards the front and slightly into the palm
    const td = ad.clone().multiplyScalar(0.62).addScaledVector(f, 0.72).addScaledVector(n, 0.3).normalize();
    let tp = at(0.018, 0.016, 0.006);
    const TL = [0.042, 0.031, 0.026];
    for (let i = 0; i < 3; i++) {
      J['thumb' + (i + 1) + s] = tp.clone();
      const dd = i === 0 ? td : td.clone().addScaledVector(ad, 0.35).normalize();
      tp = tp.clone().addScaledVector(dd, TL[i] * hs);
    }
    E['thumb3' + s] = tp;
    E['hand' + s] = at(0.092, 0.003, 0.0);
    // legs
    J['thigh' + s] = V(m * P.hipX, P.thighY, -0.006 * k);
    J['shin' + s] = V(m * (P.hipX + 0.004 * k), P.kneeY, 0.008 * k);
    J['foot' + s] = V(m * (P.hipX + 0.006 * k), P.ankleY, -0.022 * k);
    J['toe' + s] = V(m * (P.hipX + 0.010 * k), 0.022 * k, 0.122 * P.footS);
    E['toe' + s] = V(m * (P.hipX + 0.012 * k), 0.018 * k, 0.19 * P.footS);
  }
  return { J, E };
}

export function proportions(age) {
  // age 0 = 15 years (1.70 m), age 1 = 21 years (1.80 m, broader shoulders)
  const k = age ? 1.80 / 1.70 : 1;
  const P = {
    H: 1.70 * k,
    hipY: 0.945 * k, spineY: 1.035 * k, chestY: 1.19 * k, neckY: 1.415 * k, headY: 1.522 * k, topY: 1.70 * k,
    shX: age ? 0.192 : 0.165, shY: 1.385 * k, armA: 35, lUA: 0.285 * k, lFA: 0.245 * k, hand: age ? 1.06 : 1.0,
    hipX: (age ? 0.093 : 0.088), thighY: 0.88 * k, kneeY: 0.475 * k, ankleY: 0.078 * k, footS: age ? 1.06 : 1.0,
    hs: age ? 1.03 : 1.0, // head scale (head grows less than the body)
  };
  if (age) { P.headY = P.topY - (1.70 - 1.522) * P.hs; P.neckY = P.headY - 0.107 * k; }
  return P;
}

export class Rig {
  constructor(J0, J1) {
    const T = boneTable();
    this.names = T.map(t => t[0]);
    this.N = T.length;
    this.idx = {};
    this.names.forEach((n, i) => (this.idx[n] = i));
    this.parent = T.map(t => (t[1] ? this.idx[t[1]] : -1));
    this.J0 = J0; this.J1 = J1;
    this.bindPos = this.names.map(() => V());
    this.endPos = this.names.map(() => V());
    this.off = this.names.map(() => V());
    this.wq = this.names.map(() => new THREE.Quaternion());
    this.wp = this.names.map(() => V());
    this.children = this.names.map(() => []);
    this.parent.forEach((p, i) => { if (p >= 0) this.children[p].push(i); });
    this.bones = this.names.map(n => { const b = new THREE.Bone(); b.name = n; return b; });
    this.parent.forEach((p, i) => { if (p >= 0) this.bones[p].add(this.bones[i]); });
    this.age = -1;
    this.setAge(0);
  }
  // world-space (character space) bind position of a joint at the current age
  setAge(a) {
    a = clamp(a);
    if (a === this.age) return;
    this.age = a;
    for (let i = 0; i < this.N; i++) {
      const n = this.names[i];
      this.bindPos[i].lerpVectors(this.J0.J[n], this.J1.J[n], a);
    }
    for (let i = 0; i < this.N; i++) {
      const n = this.names[i];
      if (this.J0.E[n]) this.endPos[i].lerpVectors(this.J0.E[n], this.J1.E[n], a);
      else if (this.children[i].length) {
        // end at the main child (first child that is not a finger for the hand, first child otherwise)
        const c = this.children[i][0];
        this.endPos[i].copy(this.bindPos[c]);
      } else this.endPos[i].copy(this.bindPos[i]);
      const p = this.parent[i];
      if (p >= 0) this.off[i].subVectors(this.bindPos[i], this.bindPos[p]); else this.off[i].copy(this.bindPos[i]);
    }
    // segment ends for a few bones whose first child is not their natural end
    for (const s of ['L', 'R']) {
      this.endPos[this.idx['hand' + s]].lerpVectors(this.J0.E['hand' + s], this.J1.E['hand' + s], a);
      this.endPos[this.idx['chest']].lerpVectors(this.J0.J.neck, this.J1.J.neck, a);
      this.endPos[this.idx['hips']].lerpVectors(this.J0.J.spine, this.J1.J.spine, a);
      this.endPos[this.idx['head']].lerpVectors(this.J0.E.head, this.J1.E.head, a);
    }
    for (let i = 0; i < this.N; i++) this.bones[i].position.copy(this.off[i]);
    if (this.skeleton) this.updateInverses();
  }
  updateInverses() {
    const inv = this.skeleton.boneInverses;
    for (let i = 0; i < this.N; i++) inv[i].makeTranslation(-this.bindPos[i].x, -this.bindPos[i].y, -this.bindPos[i].z);
  }
  newPose() {
    return { rp: this.bindPos[0].clone(), q: this.names.map(() => new THREE.Quaternion()) };
  }
  copyPose(dst, src) { dst.rp.copy(src.rp); for (let i = 0; i < this.N; i++) dst.q[i].copy(src.q[i]); return dst; }
  // blend b into a by weight w (in place on a)
  blend(a, b, w) {
    if (w <= 0) return a;
    if (w >= 1) return this.copyPose(a, b);
    a.rp.lerp(b.rp, w);
    for (let i = 0; i < this.N; i++) a.q[i].slerp(b.q[i], w);
    return a;
  }
  blendBones(a, b, w, list) {
    if (w <= 0) return a;
    for (const i of list) a.q[i].slerp(b.q[i], Math.min(w, 1));
    return a;
  }
  fk(P) {
    const { wq, wp, parent, off } = this;
    for (let i = 0; i < this.N; i++) {
      const p = parent[i];
      if (p < 0) { wq[i].copy(P.q[i]); wp[i].copy(P.rp); }
      else { wq[i].multiplyQuaternions(wq[p], P.q[i]); wp[i].copy(off[i]).applyQuaternion(wq[p]).add(wp[p]); }
    }
  }
  // world position of a point given in bind space, attached rigidly to bone i (after fk)
  pointOn(i, bindPoint, out = V()) {
    return out.subVectors(bindPoint, this.bindPos[i]).applyQuaternion(this.wq[i]).add(this.wp[i]);
  }
  // copy the pose into the three.js bones
  apply(P) {
    const b = this.bones;
    b[0].position.copy(P.rp);
    for (let i = 0; i < this.N; i++) b[i].quaternion.copy(P.q[i]);
  }
}

// ---------------------------------------------------------------- rotation helpers
const _m0 = new THREE.Matrix4(), _m1 = new THREE.Matrix4();
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _f = V();
const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _eul = new THREE.Euler();
// rotation mapping orthonormal-ised (a0,b0) onto (a1,b1)
export function aimQuat(out, a0, b0, a1, b1) {
  _a.copy(a0).normalize(); _b.copy(b0).addScaledVector(_a, -_b.copy(b0).dot(_a)).normalize(); _c.crossVectors(_a, _b);
  _m0.makeBasis(_a, _b, _c);
  _d.copy(a1).normalize(); _e.copy(b1).addScaledVector(_d, -_e.copy(b1).dot(_d));
  if (_e.lengthSq() < 1e-10) _e.set(_d.y, -_d.x, 0.3).addScaledVector(_d, -_e.dot(_d));
  _e.normalize(); _f.crossVectors(_d, _e);
  _m1.makeBasis(_d, _e, _f);
  _m1.multiply(_m0.transpose());
  return out.setFromRotationMatrix(_m1);
}
export function eulerQ(out, x, y, z, order = 'YXZ') {
  return out.setFromEuler(_eul.set(x * DEG, y * DEG, z * DEG, order));
}
export const axisQ = (out, axis, deg) => out.setFromAxisAngle(axis, deg * DEG);

// ---------------------------------------------------------------- limb solvers (operate on pose P with rig fk state)
const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
const _t = V(), _dir = V(), _perp = V(), _u1 = V(), _u2 = V(), _hD = V(), _J = V(), _d1 = V(), _d2 = V(), _hb = V();
const _R1 = new THREE.Quaternion(), _R2 = new THREE.Quaternion(), _inv = new THREE.Quaternion();

// two-bone IK. i1: upper bone, i2: lower bone, i3: end bone. T: target for the joint of i3 (world).
// pole: direction the middle joint should point to. hBind: bind hinge axis (positive rotation = flexion).
export function twoBoneIK(rig, P, i1, i2, i3, T, pole, hBind, minBend = 0.02) {
  rig.fk(P);
  const A = rig.wp[i1];
  const l1 = rig.off[i2].length(), l2 = rig.off[i3].length();
  _dir.subVectors(T, A);
  let dist = _dir.length();
  _dir.multiplyScalar(1 / Math.max(dist, 1e-6));
  const maxD = (l1 + l2) * Math.cos(minBend), minD = Math.abs(l1 - l2) * 1.05 + 1e-3;
  dist = clamp(dist, minD, maxD);
  _perp.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_perp.lengthSq() < 1e-8) _perp.set(_dir.y, -_dir.x, 0.1).addScaledVector(_dir, -_perp.dot(_dir));
  _perp.normalize();
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _u1.copy(_dir).multiplyScalar(cosA).addScaledVector(_perp, sinA);
  _J.copy(A).addScaledVector(_u1, l1);
  _u2.copy(A).addScaledVector(_dir, dist).sub(_J).normalize();
  _hD.crossVectors(_perp, _dir).normalize();
  _d1.copy(rig.off[i2]).normalize(); _d2.copy(rig.off[i3]).normalize(); _hb.copy(hBind);
  aimQuat(_R1, _d1, _hb, _u1, _hD);
  aimQuat(_R2, _d2, _hb, _u2, _hD);
  const p = rig.parent[i1];
  _inv.copy(rig.wq[p]).invert();
  P.q[i1].multiplyQuaternions(_inv, _R1);
  _inv.copy(_R1).invert();
  P.q[i2].multiplyQuaternions(_inv, _R2);
  return _R2;
}

// set bone i so that its world rotation equals W (given the parent's current fk world rotation)
export function setWorldRot(rig, P, i, W) {
  rig.fk(P);
  const p = rig.parent[i];
  _inv.copy(rig.wq[p]).invert();
  P.q[i].multiplyQuaternions(_inv, W);
}

// move part of the twist of bone c (about bind axis ax) into its parent bone b
export function shareTwist(P, b, c, ax, k = 0.55) {
  const q = P.q[c];
  const d = q.x * ax.x + q.y * ax.y + q.z * ax.z;
  const ang = 2 * Math.atan2(d, q.w);
  _q0.setFromAxisAngle(ax, ang * k);
  P.q[b].multiply(_q0);
  _q0.invert();
  P.q[c].premultiply(_q0);
}

export { X, Y, Z, FINGERS };
