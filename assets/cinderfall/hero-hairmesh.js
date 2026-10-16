// Dynamic hair geometry: each simulated strand chain becomes a slightly arched card (3 vertices across) smoothed with
// Catmull-Rom between simulation points, plus a rigid scalp cap and an age-blended bun, all in one draw call.
import * as THREE from 'three';
import { SKULL, hairlineY, skullPoint } from './hero-hair.js';
import { clamp, lerp, smooth, rng, TAU } from './hero-util.js';

const lin = c => Math.pow(c, 2.2);

// head-space (age-0 metres) -> character space transform for the current pose
export function headXform(rig, hfFn, bone = 'head') {
  const I = rig.idx[bone];
  const off = new THREE.Vector3();
  const f = v => {
    const hf = hfFn();
    off.set(hf.O[0] - rig.bindPos[I].x + v.x * hf.s, hf.O[1] - rig.bindPos[I].y + v.y * hf.s, hf.O[2] - rig.bindPos[I].z + v.z * hf.s);
    return v.copy(off).applyQuaternion(rig.wq[I]).add(rig.wp[I]);
  };
  f.rot = v => v.applyQuaternion(rig.wq[I]);
  // 3x4 matrix of the current transform (for bulk rigid transforms)
  const M = new THREE.Matrix4(), Tq = new THREE.Matrix4(), e = new Float32Array(12);
  f.matrix = () => {
    const hf = hfFn();
    M.makeRotationFromQuaternion(rig.wq[I]);
    const ox = hf.O[0] - rig.bindPos[I].x, oy = hf.O[1] - rig.bindPos[I].y, oz = hf.O[2] - rig.bindPos[I].z;
    const m = M.elements, w = rig.wp[I];
    // p' = R*(o + v*s) + w
    e[0] = m[0] * hf.s; e[1] = m[4] * hf.s; e[2] = m[8] * hf.s; e[3] = m[0] * ox + m[4] * oy + m[8] * oz + w.x;
    e[4] = m[1] * hf.s; e[5] = m[5] * hf.s; e[6] = m[9] * hf.s; e[7] = m[1] * ox + m[5] * oy + m[9] * oz + w.y;
    e[8] = m[2] * hf.s; e[9] = m[6] * hf.s; e[10] = m[10] * hf.s; e[11] = m[2] * ox + m[6] * oy + m[10] * oz + w.z;
    return e;
  };
  return f;
}

function buildHairStatic(cards, NP, o, SH) {
    const NR = NP * 2 - 1;
    const R = rng(911);
    const cRoot = o.colors.root.map(lin), cMid = o.colors.mid.map(lin), cTip = o.colors.tip.map(lin);
    // ---- static parts (head space)
    const st = { pos: [], nrm: [], tan: [], uv: [], col: [], hair: [], idx: [] };
    const pushV = (p, n, t, uv, c, h) => { st.pos.push(...p); st.nrm.push(...n); st.tan.push(...t); st.uv.push(...uv); st.col.push(...c); st.hair.push(...h); };
    const nCardV = cards.length * NR * 3;
    if (o.cap) {
      const C = 40, Rw = 16;
      const base = nCardV;
      for (let j = 0; j <= Rw; j++) for (let i = 0; i <= C; i++) {
        const th = -180 + 360 * i / C;
        const yh = hairlineY(th) - 0.004;
        const top = SKULL.c[1] + SKULL.r[1] - 1e-4;
        const v = j / Rw;
        const y = lerp(yh, top, 1 - Math.pow(1 - v, 1.3));
        const off = 0.0042 * smooth(yh + 0.002, yh + 0.014, y) - 0.0018 + (o.capOff || 0);
        const p = skullPoint(th, y, off);
        const n = (() => { const c = SKULL.c, r = SKULL.r; const q = [(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])]; const l = Math.hypot(...q); return q.map(x => x / l); })();
        const pd = skullPoint(th, y - 0.002, off);
        const t = [pd[0] - p[0], pd[1] - p[1], pd[2] - p[2]]; const tl = Math.hypot(...t) || 1;
        const shade = lerp(0.7, 0.95, v);
        pushV(p, n, t.map(x => x / tl), [0.01 + 0.23 * (i / C), 0.05 + 0.6 * (1 - v)], cRoot.map((x, k) => lerp(x, cMid[k], 0.7) * shade), [1, 0, 0.35, R()]);
      }
      for (let j = 0; j < Rw; j++) for (let i = 0; i < C; i++) {
        const a = base + j * (C + 1) + i, b = a + 1, c = a + C + 1, d = c + 1;
        st.idx.push(a, b, d, a, d, c);
      }
    }
    SH.capCount = st.pos.length / 3;
    // static strand cards (beard, moustache): head-space polylines, optionally riding the jaw
    SH.jawFlag = [];
    if (o.statics) for (const sc of o.statics) {
      const base = nCardV + st.pos.length / 3;
      const P = sc.pts, n = P.length;
      const col = sc.color.map(lin);
      for (let j = 0; j < n; j++) {
        const a = P[Math.max(0, j - 1)], b = P[Math.min(n - 1, j + 1)];
        let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const tl = Math.hypot(...t) || 1; t = t.map(x => x / tl);
        let out = [P[j][0], P[j][1] + 0.02, P[j][2] + 0.01]; const ol = Math.hypot(...out) || 1; out = out.map(x => x / ol);
        let sd = [t[1] * out[2] - t[2] * out[1], t[2] * out[0] - t[0] * out[2], t[0] * out[1] - t[1] * out[0]]; const sl = Math.hypot(...sd) || 1; sd = sd.map(x => x / sl);
        const u = j / (n - 1), w = sc.w * (1 - 0.6 * u) * 0.5;
        for (let k = 0; k < 3; k++) {
          const off = (k - 1) * w;
          const p = [P[j][0] + sd[0] * off + out[0] * (k === 1 ? w * 0.15 : 0), P[j][1] + sd[1] * off, P[j][2] + sd[2] * off + out[2] * (k === 1 ? w * 0.15 : 0)];
          pushV(p, out, t, [(sc.col + (k === 1 ? 0.5 : k === 0 ? 0.05 : 0.95)) / 4, 0.02 + 0.96 * u], col.map(x => x * (0.85 + 0.15 * (k === 1))), [0, u, 0.5, R()]);
          SH.jawFlag.push(sc.bone === 'jaw' ? 1 : 0);
        }
      }
      for (let j = 0; j < n - 1; j++) {
        const a = base + j * 3, b = a + 3;
        st.idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      }
    }
    SH.nStaticCards = SH.jawFlag.length;
    // the dark cord that ties the age-15 half-ponytail (collapses into the tie as the bun grows in)
    SH.cordStart = nCardV + st.pos.length / 3;
    if (o.cord) {
      const T = o.cord, NU = 10, NV = 4, base = SH.cordStart;
      const ax = [0, -0.35, -1], al = Math.hypot(...ax); ax.forEach((x, k) => (ax[k] = x / al));
      const e1 = [1, 0, 0], e2 = [ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]];
      const cc = [0.035, 0.03, 0.04].map(lin);
      for (let j = 0; j <= NU; j++) {
        const a = j / NU * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const rc = 0.0105;
        const ctr = [T[0] + (e1[0] * ca + e2[0] * sa) * rc, T[1] + (e1[1] * ca + e2[1] * sa) * rc - 0.004, T[2] + (e1[2] * ca + e2[2] * sa) * rc - 0.014];
        const out = [e1[0] * ca + e2[0] * sa, e1[1] * ca + e2[1] * sa, e1[2] * ca + e2[2] * sa];
        for (let i = 0; i <= NV; i++) {
          const b = i / NV * TAU, rt = 0.0032;
          const n = [out[0] * Math.cos(b) + ax[0] * Math.sin(b), out[1] * Math.cos(b) + ax[1] * Math.sin(b), out[2] * Math.cos(b) + ax[2] * Math.sin(b)];
          pushV([ctr[0] + n[0] * rt, ctr[1] + n[1] * rt, ctr[2] + n[2] * rt], n, [-sa * e1[0] + ca * e2[0], -sa * e1[1] + ca * e2[1], -sa * e1[2] + ca * e2[2]], [0.125, 0.03], cc, [1, 0.5, 0.9, R()]);
        }
      }
      for (let j = 0; j < NU; j++) for (let i = 0; i < NV; i++) {
        const a = base + j * (NV + 1) + i, b = a + 1, c = a + NV + 1, d = c + 1;
        st.idx.push(a, d, b, a, c, d);
      }
    }
    SH.cordEnd = nCardV + st.pos.length / 3;
    SH.bunStart = nCardV + st.pos.length / 3;
    if (o.bun) {
      const T = o.tie, NU = 44, NV = 8;
      const base = SH.bunStart;
      const cb = [T[0], T[1] + 0.012, T[2] - 0.004];
      const path = u => { const a = u * 3 * TAU, r = 0.025 - 0.013 * u; return [cb[0] + r * Math.cos(a), cb[1] + u * 0.024, cb[2] + r * Math.sin(a) * 0.85]; };
      for (let j = 0; j <= NU; j++) {
        const u = j / NU;
        const c0 = path(u), c1 = path(Math.min(1, u + 0.01)), c2 = path(Math.max(0, u - 0.01));
        const tg = [c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]]; const tl = Math.hypot(...tg); tg.forEach((x, k) => (tg[k] = x / tl));
        const out = [c0[0] - cb[0], 0, c0[2] - cb[2]]; const ol = Math.hypot(...out) || 1; out.forEach((x, k) => (out[k] = x / ol));
        const bn = [tg[1] * out[2] - tg[2] * out[1], tg[2] * out[0] - tg[0] * out[2], tg[0] * out[1] - tg[1] * out[0]];
        const rt = 0.0118 * (1 - 0.4 * u) * (u < 0.04 ? 0.6 + u * 10 : 1);
        for (let i = 0; i <= NV; i++) {
          const a = i / NV * TAU;
          const n = [out[0] * Math.cos(a) + bn[0] * Math.sin(a), out[1] * Math.cos(a) + bn[1] * Math.sin(a), out[2] * Math.cos(a) + bn[2] * Math.sin(a)];
          pushV([c0[0] + n[0] * rt, c0[1] + n[1] * rt, c0[2] + n[2] * rt], n, tg, [(1 + 0.05 + 0.9 * (i / NV)) / 4, 0.05 + 0.85 * u], cMid.map(x => x * (0.85 + 0.15 * Math.cos(a))), [1, 0.5, 0.8, R()]);
        }
      }
      for (let j = 0; j < NU; j++) for (let i = 0; i < NV; i++) {
        const a = base + j * (NV + 1) + i, b = a + 1, c = a + NV + 1, d = c + 1;
        st.idx.push(a, d, b, a, c, d);
      }
    }
    SH.nStatic = st.pos.length / 3;
    SH.stPos = new Float32Array(st.pos); SH.stNrm = new Float32Array(st.nrm); SH.stTan = new Float32Array(st.tan);
    SH.stScaled = new Float32Array(st.pos);
    const NV = nCardV + SH.nStatic;
    const uv = new Float32Array(NV * 2), col = new Float32Array(NV * 3), hair = new Float32Array(NV * 4);
    const idx = [];
    // ---- cards
    cards.forEach((c, ci) => {
      const flip = R() < 0.5;
      // every lock its own value (light catches some, others sit in shade); inner layers and roots darker
      const cv = (0.72 + 0.42 * c.rnd) * (o.colorVar ? 1 + o.colorVar * (R() * 2 - 1) : 1) * (c.group === 'fly' ? 1.15 : c.group === 'nape' ? 0.78 : 1);
      const lay = 0.6 + 0.4 * c.layer;
      // root tone and root occlusion over the first few centimetres of the strand (not a fraction of its length):
      // a lock drawn up into the tie or the bun shows only its first 5-15 cm, which must not read as a dark cap
      // (loose hair keeps a longer dark-to-light run down the upper back, which reads as depth under the outer locks)
      const Lc = Math.max(0.05, c.L0 || 0.3);
      const up = c.gather && c.group !== 'bang';
      const gL = up ? 0.045 : 0.11, aL = up ? 0.025 : 0.05;
      // the age-15 tail is squeezed and self-shadowed just below the cord: a darker neck that brightens down the
      // tail, so the ponytail reads as its own bundle from behind (at 21 that part is tucked inside the bun)
      const tieT = up && c.tieA !== undefined ? Math.max(c.tieA, c.tieB ?? 0) : -1;
      for (let j = 0; j < NR; j++) {
        const t = j / (NR - 1);
        const g = smooth(0, Math.min(0.4, gL / Lc), t), g2 = smooth(0.45, 1, t);
        let cc = [0, 1, 2].map(k => lerp(lerp(cRoot[k], cMid[k], g), cTip[k], g2));
        const ao = lerp(up ? 0.66 : 0.6, 1, smooth(0, Math.min(0.25, aL / Lc), t));
        const tk = tieT > 0 && t > tieT - 0.01 ? lerp(0.6, 1, smooth(tieT, tieT + 0.24, t)) : 1;
        cc = cc.map(x => x * cv * lay * ao * tk);
        for (let s = 0; s < 3; s++) {
          const v = (ci * NR + j) * 3 + s;
          const uu = s === 1 ? 0.5 : (s === 0) !== flip ? 0.03 : 0.97;
          uv[v * 2] = (c.col + uu) / 4; uv[v * 2 + 1] = 0.01 + t * 0.98;
          col.set(cc.map(x => x * (s === 1 ? 1 : 0.84)), v * 3);
          hair.set([0, t, c.layer, c.rnd], v * 4);
        }
      }
      for (let j = 0; j < NR - 1; j++) {
        const a = (ci * NR + j) * 3;
        const b = a + 3;
        idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      }
    });
    uv.set(st.uv, nCardV * 2); col.set(st.col, nCardV * 3); hair.set(st.hair, nCardV * 4);
    for (const i of st.idx) idx.push(i);
    SH.nCardV = nCardV;
    SH.uvA = new THREE.BufferAttribute(uv, 2); SH.colA = new THREE.BufferAttribute(col, 3); SH.hairA = new THREE.BufferAttribute(hair, 4);
    SH.index = new THREE.BufferAttribute(idx.length > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1);
    SH.built = true;
}

export class HairMesh {
  constructor(cards, NP, mats, o = {}) {
    this.cards = cards; this.NP = NP; this.NR = NP * 2 - 1;
    this.o = o;
    const SH = o.shared || {};
    if (!SH.built) buildHairStatic(cards, NP, o, SH);
    for (const k of ['jawFlag', 'nStaticCards', 'capCount', 'cordStart', 'cordEnd', 'bunStart', 'nStatic', 'stPos', 'stNrm', 'stTan', 'nCardV']) this[k] = SH[k];
    this.stScaled = SH.stPos.slice();
    const NV = this.nCardV + this.nStatic;
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(NV * 3), 3); this.aNrm = new THREE.BufferAttribute(new Float32Array(NV * 3), 3); this.aTan = new THREE.BufferAttribute(new Float32Array(NV * 3), 3);
    for (const a of [this.aPos, this.aNrm, this.aTan]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('normal', this.aNrm); g.setAttribute('aHairT', this.aTan);
    g.setAttribute('uv', SH.uvA); g.setAttribute('color', SH.colA); g.setAttribute('aHair', SH.hairA);
    g.setIndex(SH.index);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.2);
    const m = new THREE.Mesh(g, mats.mat);
    m.customDepthMaterial = mats.depth; m.customDistanceMaterial = mats.dist;
    m.castShadow = m.receiveShadow = true;
    this.mesh = m;
    this.widthK = 1;
    this.cr = new Float32Array(this.NR * 3);
    this.headC = new THREE.Vector3(); this.spineA = new THREE.Vector3(); this.spineB = new THREE.Vector3();
  }
  setAge(a, hf) {
    this.widthK = lerp(1, 1.08, a) * hf.s;
    this.hs = hf.s;
    // bun grows in; collapses into the tie point at 15
    if (this.o.bun) {
      const k = this.o.bunAlways ? 1 : smooth(0.25, 0.85, a), T = this.o.tie;
      for (let i = this.bunStart - this.nCardV; i < this.nStatic; i++) {
        for (let c = 0; c < 3; c++) this.stScaled[i * 3 + c] = T[c] + (this.stPos[i * 3 + c] - T[c]) * Math.max(k, 0.001);
      }
      if (this.o.cord) {
        const C = this.o.cord, kc = Math.max(1 - k, 0.001);
        for (let i = this.cordStart - this.nCardV; i < this.cordEnd - this.nCardV; i++) {
          for (let c = 0; c < 3; c++) this.stScaled[i * 3 + c] = C[c] + (this.stPos[i * 3 + c] - C[c]) * kc;
        }
      }
    }
  }
  update(sim, rig, headX, jawX) {
    const { NP, NR, cards, cr } = this;
    const pos = this.aPos.array, nrm = this.aNrm.array, tan = this.aTan.array;
    const x = sim.x;
    const hc = this.headC.set(0, 0.0, -0.01); headX(hc);
    const sa = this.spineA.copy(rig.wp[rig.idx.neck]), sb = this.spineB.copy(rig.wp[rig.idx.hips]);
    const abx = sb.x - sa.x, aby = sb.y - sa.y, abz = sb.z - sa.z, L2 = abx * abx + aby * aby + abz * abz;
    for (let ci = 0; ci < cards.length; ci++) {
      const c = cards[ci], o = sim.chains[ci].o;
      // Catmull-Rom resample
      for (let j = 0; j < NR; j++) {
        const i = j >> 1, t = (j & 1) * 0.5;
        const i0 = Math.max(0, i - 1), i1 = i, i2 = Math.min(NP - 1, i + 1), i3 = Math.min(NP - 1, i + 2);
        for (let k = 0; k < 3; k++) {
          const p0 = x[(o + i0) * 3 + k], p1 = x[(o + i1) * 3 + k], p2 = x[(o + i2) * 3 + k], p3 = x[(o + i3) * 3 + k];
          cr[j * 3 + k] = t === 0 ? p1 : 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
        }
      }
      const W = c.w * this.widthK;
      const prof = c.prof || (c.prof = Float32Array.from({ length: NR }, (_, j) => { const t = j / (NR - 1); return c.group === 'bang' ? lerp(0.9, 1.05, smooth(0, 0.3, t)) * (1 - 0.7 * smooth(0.45, 1, t)) : lerp(0.75, 1.1, smooth(0, 0.3, t)) * (1 - 0.62 * smooth(0.5, 1, t)); }));
      const hs12 = this.hs;
      for (let j = 0; j < NR; j++) {
        const ja = Math.max(0, j - 1), jb = Math.min(NR - 1, j + 1);
        let tx = cr[jb * 3] - cr[ja * 3], ty = cr[jb * 3 + 1] - cr[ja * 3 + 1], tz = cr[jb * 3 + 2] - cr[ja * 3 + 2];
        let tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        const px = cr[j * 3], py = cr[j * 3 + 1], pz = cr[j * 3 + 2];
        // outward: from the head centre near the head, from the neck-hips axis further down
        let hx = px - hc.x, hy = py - hc.y, hz = pz - hc.z;
        const hd = Math.hypot(hx, hy, hz) || 1;
        hx /= hd; hy /= hd; hz /= hd;
        let tt = L2 > 0 ? ((px - sa.x) * abx + (py - sa.y) * aby + (pz - sa.z) * abz) / L2 : 0;
        tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
        let bx = px - (sa.x + abx * tt), by = py - (sa.y + aby * tt), bz = pz - (sa.z + abz * tt);
        const bd = Math.hypot(bx, by, bz) || 1;
        bx /= bd; by /= bd; bz /= bd;
        let w = (hd - 0.12 * hs12) / (0.08 * hs12); w = w < 0 ? 0 : w > 1 ? 1 : w; w = w * w * (3 - 2 * w);
        let ox = hx + (bx - hx) * w, oy = hy + (by - hy) * w, oz = hz + (bz - hz) * w;
        // side = t x o, then o = side x t
        let sx = ty * oz - tz * oy, sy = tz * ox - tx * oz, sz = tx * oy - ty * ox;
        const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
        ox = sy * tz - sz * ty; oy = sz * tx - sx * tz; oz = sx * ty - sy * tx;
        const hw = W * prof[j] * 0.5, bulge = W * prof[j] * 0.08;
        const v9 = (ci * NR + j) * 9;
        const ql = 1 / Math.sqrt(1 + 0.2025);
        // left, centre (bulged out), right
        pos[v9] = px - sx * hw; pos[v9 + 1] = py - sy * hw; pos[v9 + 2] = pz - sz * hw;
        pos[v9 + 3] = px + ox * bulge; pos[v9 + 4] = py + oy * bulge; pos[v9 + 5] = pz + oz * bulge;
        pos[v9 + 6] = px + sx * hw; pos[v9 + 7] = py + sy * hw; pos[v9 + 8] = pz + sz * hw;
        nrm[v9] = (ox - sx * 0.45) * ql; nrm[v9 + 1] = (oy - sy * 0.45) * ql; nrm[v9 + 2] = (oz - sz * 0.45) * ql;
        nrm[v9 + 3] = ox; nrm[v9 + 4] = oy; nrm[v9 + 5] = oz;
        nrm[v9 + 6] = (ox + sx * 0.45) * ql; nrm[v9 + 7] = (oy + sy * 0.45) * ql; nrm[v9 + 8] = (oz + sz * 0.45) * ql;
        tan[v9] = tan[v9 + 3] = tan[v9 + 6] = tx; tan[v9 + 1] = tan[v9 + 4] = tan[v9 + 7] = ty; tan[v9 + 2] = tan[v9 + 5] = tan[v9 + 8] = tz;
      }
    }
    // rigid parts follow the head
    const base = this.nCardV;
    const p = new THREE.Vector3();
    const capN = this.capCount || 0;
    const Mh = headX.matrix().slice(), Mj = jawX ? jawX.matrix().slice() : Mh;
    const sp = this.stScaled, sn = this.stNrm, sT = this.stTan, ih = 1 / Math.max(this.hs || 1, 1e-6);
    for (let i = 0; i < this.nStatic; i++) {
      const e = (jawX && i >= capN && i < capN + this.nStaticCards && this.jawFlag[i - capN]) ? Mj : Mh;
      const i3 = i * 3, o3 = (base + i) * 3;
      const x = sp[i3], y = sp[i3 + 1], z = sp[i3 + 2];
      pos[o3] = e[0] * x + e[1] * y + e[2] * z + e[3]; pos[o3 + 1] = e[4] * x + e[5] * y + e[6] * z + e[7]; pos[o3 + 2] = e[8] * x + e[9] * y + e[10] * z + e[11];
      const nx = sn[i3], ny = sn[i3 + 1], nz = sn[i3 + 2];
      nrm[o3] = (e[0] * nx + e[1] * ny + e[2] * nz) * ih; nrm[o3 + 1] = (e[4] * nx + e[5] * ny + e[6] * nz) * ih; nrm[o3 + 2] = (e[8] * nx + e[9] * ny + e[10] * nz) * ih;
      const tx = sT[i3], ty = sT[i3 + 1], tz = sT[i3 + 2];
      tan[o3] = (e[0] * tx + e[1] * ty + e[2] * tz) * ih; tan[o3 + 1] = (e[4] * tx + e[5] * ty + e[6] * tz) * ih; tan[o3 + 2] = (e[8] * tx + e[9] * ty + e[10] * tz) * ih;
    }
    this.aPos.needsUpdate = this.aNrm.needsUpdate = this.aTan.needsUpdate = true;
  }
}
