// Hair cards and secondary-motion chains (hair strands, sash ends) for the procedural characters.
// Chains are simulated in the character's local space (group space): pinned roots follow bones, inner points are
// pulled towards a styled rest shape (head space) with stiffness fading towards the tips, gravity, quadratic air drag
// against the wind (the character's own speed appears as a headwind), follow-the-leader length constraints,
// soft bending, capsule/sphere collisions with the body and the ground.
import * as THREE from 'three';
import { clamp, lerp, smooth, rng, TAU, DEG } from './hero-util.js';

// ------------------------------------------------------------------ generic chain simulation
// Frame-rate independent: every frame is split into substeps of at most 1/60 s, the targets (pinned roots and rest
// shape) are interpolated across the substeps, and all stiffness / damping terms are rates per second, so the hair
// moves the same at 30, 60, 120 or 144 fps.
//  * style pull: points still on the scalp (k >= 0.2, "per 1/60 s" fraction) relax toward the styled shape at that
//    rate; hanging points (k < 0.2) feel a weak spring (Ks = k * 3600 * springScale, in 1/s^2) so they swing like a
//    pendulum with weight instead of ringing at the frame rate;
//  * bending: a spring toward the straight continuation (Kb = bend * 3600 * bendScale, 1/s^2);
//  * damping: velocity decays as exp(-damp * h) (damp in 1/s), plus contact friction against the body;
//  * follow-the-leader length constraints with the dynamic FTL velocity correction (Mueller et al. 2012), which
//    removes the energy plain FTL injects (the whip / vibration at the tips).
export class ChainSim {
  // chains: [{ n, seg: [n-1 lengths], k: [n] style stiffness, r: collision radius, pin: number of pinned points }]
  constructor(chains, o = {}) {
    this.chains = chains;
    let N = 0;
    for (const c of chains) { c.o = N; N += c.n; }
    this.N = N;
    this.x = new Float32Array(N * 3); this.p = new Float32Array(N * 3); this.t = new Float32Array(N * 3);
    this.t0 = new Float32Array(N * 3); this.tc = new Float32Array(N * 3); this.d = new Float32Array(N * 3);
    this.k = new Float32Array(N); this.r = new Float32Array(N); this.l = new Float32Array(N); this.pin = new Uint8Array(N);
    this.bend = new Float32Array(N); this.hit = new Uint8Array(N); this.dm = new Float32Array(N);
    for (const c of chains) for (let i = 0; i < c.n; i++) {
      const j = c.o + i;
      this.k[j] = c.k[i]; this.r[j] = c.r; this.l[j] = i ? c.seg[i - 1] : 0; this.pin[j] = i < c.pin ? 1 : 0;
      this.bend[j] = c.bend ?? 0.12; this.dm[j] = c.damp ?? 1;
    }
    this.drag = o.drag ?? 0.55; this.damp = o.damp ?? 2.0; this.grav = o.grav ?? 9.8;
    this.springScale = o.springScale ?? 0.25; this.bendScale = o.bendScale ?? 0.35;
    this.friction = o.friction ?? 6; this.dftl = o.dftl ?? 0.85; this.hMax = o.hMax ?? 1 / 60;
    this.ground = 0.008;
    this.primed = false;
  }
  // targets must be written to this.t (local space) before stepping; dt is the real frame time
  step(dt, bodies, wind) {
    if (!(dt > 0)) return;
    const n = Math.max(1, Math.ceil(dt / this.hMax - 1e-3)), h = dt / n;
    const { t, t0, tc } = this;
    if (!this.primed) { t0.set(t); this.primed = true; }
    tc.set(t);
    for (let s = 1; s <= n; s++) {
      // roots and rest shape move smoothly through the frame instead of jumping on the first substep
      const a = s / n;
      if (n > 1) for (let i = 0; i < t.length; i++) t[i] = t0[i] + (tc[i] - t0[i]) * a;
      this.sub(h, bodies, wind);
    }
    t.set(tc); t0.set(tc);
  }
  sub(h, bodies, wind) {
    const { x, p, t, k, l, pin, bend, d, hit, dm } = this;
    const dr = this.drag, h2 = h * h;
    const wx = wind.x, wy = wind.y, wz = wind.z;
    const rel60 = h * 60, sK = this.springScale * 3600 * h2, bK = Math.min(0.5, this.bendScale * 3600 * h2);
    const fr = Math.exp(-this.friction * h);
    for (const c of this.chains) {
      const o = c.o, n = c.n;
      const ret = Math.exp(-this.damp * dm[o + n - 1] * h);
      // bodies this chain can reach (root distance to capsule < chain length + radius)
      const near = this.near || (this.near = []);
      near.length = 0;
      {
        const j = o * 3, rx0 = t[j], ry0 = t[j + 1], rz0 = t[j + 2];
        let Lc = 0; for (let i = 1; i < n; i++) Lc += l[o + i];
        for (let b = 0; b < bodies.length; b++) {
          const B = bodies[b];
          const abx = B.bx - B.ax, aby = B.by - B.ay, abz = B.bz - B.az, L2 = abx * abx + aby * aby + abz * abz;
          let tt = L2 > 1e-9 ? ((rx0 - B.ax) * abx + (ry0 - B.ay) * aby + (rz0 - B.az) * abz) / L2 : 0;
          tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
          const dx = rx0 - B.ax - abx * tt, dy = ry0 - B.ay - aby * tt, dz = rz0 - B.az - abz * tt;
          const R = Lc + B.r + 0.03;
          if (dx * dx + dy * dy + dz * dz < R * R) near.push(B);
        }
      }
      for (let i = 0; i < n; i++) {
        const j = (o + i) * 3;
        if (pin[o + i]) { p[j] = x[j]; p[j + 1] = x[j + 1]; p[j + 2] = x[j + 2]; x[j] = t[j]; x[j + 1] = t[j + 1]; x[j + 2] = t[j + 2]; continue; }
        // velocity (with contact friction from the last substep)
        let vx = (x[j] - p[j]) / h, vy = (x[j + 1] - p[j + 1]) / h, vz = (x[j + 2] - p[j + 2]) / h;
        const keep = hit[o + i] ? ret * fr : ret;
        vx *= keep; vy *= keep; vz *= keep;
        const rx = wx - vx, ry = wy - vy, rz = wz - vz;
        const rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
        const ax = dr * rl * rx, ay = dr * rl * ry - this.grav, az = dr * rl * rz;
        p[j] = x[j]; p[j + 1] = x[j + 1]; p[j + 2] = x[j + 2];
        x[j] += vx * h + ax * h2; x[j + 1] += vy * h + ay * h2; x[j + 2] += vz * h + az * h2;
        const kk = k[o + i];
        if (kk > 0) {
          // on the scalp: relax toward the styled shape (rate per second); hanging: a weak spring (an acceleration)
          const f = kk >= 0.2 ? 1 - Math.pow(1 - kk, rel60) : Math.min(0.5, kk * sK);
          x[j] += (t[j] - x[j]) * f; x[j + 1] += (t[j + 1] - x[j + 1]) * f; x[j + 2] += (t[j + 2] - x[j + 2]) * f;
        }
      }
      // soft bending toward the straight continuation (a spring, so its frequency does not follow the frame rate)
      for (let i = 2; i < n; i++) {
        const a = (o + i - 2) * 3, b = (o + i - 1) * 3, cc = (o + i) * 3, bb = bend[o + i] * bK;
        if (bb <= 0 || pin[o + i]) continue;
        const ex = 2 * x[b] - x[a], ey = 2 * x[b + 1] - x[a + 1], ez = 2 * x[b + 2] - x[a + 2];
        x[cc] += (ex - x[cc]) * bb; x[cc + 1] += (ey - x[cc + 1]) * bb; x[cc + 2] += (ez - x[cc + 2]) * bb;
      }
      // constraints; d collects each point's correction for the velocity fix
      for (let i = 0; i < n; i++) { const j = (o + i) * 3; d[j] = x[j]; d[j + 1] = x[j + 1]; d[j + 2] = x[j + 2]; hit[o + i] = 0; }
      this.ftl(o, n);
      for (let i = 1; i < n; i++) this.collide(o + i, near);
      this.ftl(o, n);
      if (near.length) for (let i = 1; i < n; i++) this.collide(o + i, near);
      for (let i = 0; i < n; i++) { const j = (o + i) * 3; d[j] = x[j] - d[j]; d[j + 1] = x[j + 1] - d[j + 1]; d[j + 2] = x[j + 2] - d[j + 2]; }
      // dynamic FTL: each point's velocity loses the correction its child needed
      const sD = this.dftl;
      if (sD > 0) for (let i = 1; i < n - 1; i++) {
        if (pin[o + i]) continue;
        const j = (o + i) * 3, jc = (o + i + 1) * 3;
        p[j] += sD * d[jc]; p[j + 1] += sD * d[jc + 1]; p[j + 2] += sD * d[jc + 2];
      }
    }
  }
  constrain(o, n, bodies) {
    this.ftl(o, n);
    for (let i = 1; i < n; i++) this.collide(o + i, bodies);
    this.ftl(o, n);
  }
  ftl(o, n) {
    const { x, l, pin } = this;
    for (let i = 1; i < n; i++) {
      const a = (o + i - 1) * 3, b = (o + i) * 3;
      if (pin[o + i]) continue;
      let dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const s = l[o + i] / d;
      x[b] = x[a] + dx * s; x[b + 1] = x[a + 1] + dy * s; x[b + 2] = x[a + 2] + dz * s;
    }
  }
  collide(i, bodies) {
    const { x, r, pin } = this;
    if (pin[i]) return;
    const j = i * 3;
    let px = x[j], py = x[j + 1], pz = x[j + 2];
    const rr = r[i];
    let touched = 0;
    for (let b = 0; b < bodies.length; b++) {
      const B = bodies[b];
      // capsule a->b radius R (sphere when a==b)
      const abx = B.bx - B.ax, aby = B.by - B.ay, abz = B.bz - B.az;
      const apx = px - B.ax, apy = py - B.ay, apz = pz - B.az;
      const L2 = abx * abx + aby * aby + abz * abz;
      let tt = L2 > 1e-9 ? (apx * abx + apy * aby + apz * abz) / L2 : 0;
      tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
      const cx = B.ax + abx * tt, cy = B.ay + aby * tt, cz = B.az + abz * tt;
      let dx = px - cx, dy = py - cy, dz = pz - cz;
      const d2 = dx * dx + dy * dy + dz * dz, R = B.r + rr;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1e-6;
        const s = (R - d) / d;
        px += dx * s; py += dy * s; pz += dz * s;
        touched = 1;
      } else if (d2 < (R + 0.006) * (R + 0.006)) touched = 1;
    }
    if (py < this.ground + rr * 0.5) { py = this.ground + rr * 0.5; touched = 1; }
    x[j] = px; x[j + 1] = py; x[j + 2] = pz;
    if (touched) this.hit[i] = 1;
  }
  // relax to rest: many damped steps with the current targets/bodies/wind, then zero velocity
  settle(bodies, wind, steps = 160) {
    const sd = this.damp;
    this.damp = 15;
    this.t0.set(this.t); this.primed = true;
    for (let s = 0; s < steps; s++) this.sub(1 / 60, bodies, wind);
    this.damp = sd;
    this.p.set(this.x);
  }
  snapToTargets() { this.x.set(this.t); this.p.set(this.t); this.t0.set(this.t); this.primed = true; }
}

// ------------------------------------------------------------------ head-space scalp model (age-0 metres)
export const SKULL = { c: [0, 0.022, -0.008], r: [0.074, 0.093, 0.094] };
const HAIRLINE = [[0, 0.084], [25, 0.08], [45, 0.068], [60, 0.05], [72, 0.028], [80, 0.008], [86, -0.012], [92, 0.012], [100, 0.036], [110, 0.034], [120, 0.0], [130, -0.035], [150, -0.062], [168, -0.074], [180, -0.078]];
export function hairlineY(thDeg) {
  const a = Math.abs(((thDeg + 540) % 360) - 180);
  for (let i = 0; i < HAIRLINE.length - 1; i++) {
    const [a0, y0] = HAIRLINE[i], [a1, y1] = HAIRLINE[i + 1];
    if (a <= a1) { const t = (a - a0) / (a1 - a0); const s = t * t * (3 - 2 * t); return lerp(y0, y1, s); }
  }
  return HAIRLINE[HAIRLINE.length - 1][1];
}
// point on the (offset) skull for azimuth th (deg, 0 = front, +90 = left) and height y
export function skullPoint(thDeg, y, off = 0) {
  const { c, r } = SKULL;
  const ny = clamp((y - c[1]) / (r[1] + off), -0.999, 0.999);
  const rad = Math.sqrt(1 - ny * ny);
  const th = thDeg * DEG;
  return [c[0] + Math.sin(th) * (r[0] + off) * rad, y, c[2] + Math.cos(th) * (r[2] + off) * rad];
}
function skullProject(p, off) {
  const { c, r } = SKULL;
  const d = [(p[0] - c[0]) / (r[0] + off), (p[1] - c[1]) / (r[1] + off), (p[2] - c[2]) / (r[2] + off)];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [c[0] + d[0] / l * (r[0] + off), c[1] + d[1] / l * (r[1] + off), c[2] + d[2] / l * (r[2] + off)];
}
function skullNormal(p) {
  const { c, r } = SKULL;
  const n = [(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])];
  const l = Math.hypot(n[0], n[1], n[2]);
  return [n[0] / l, n[1] / l, n[2] / l];
}
const nrm3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ------------------------------------------------------------------ hairstyle layout (Wuhen)
// card spec: { group, root:[th(deg), y], dir (head-space flow), L0, w, layer, col, rnd, gather, end (bangs) }
export function wuhenCards() {
  const R = rng(5150);
  const C = [];
  const add = (o) => C.push(Object.assign({ col: Math.floor(R() * 4), rnd: R(), gather: 0 }, o));
  // uneven lengths: no two locks end at the same height
  const uneven = () => 0.82 + 0.36 * R();
  // top layer from a centre parting: flows to the sides and back over the crown (outer layer); at 15 it is drawn
  // back into the high half-ponytail, at 21 into the bun
  for (let i = 0; i < 22; i++) {
    const s = 0.1 + 0.9 * (i / 21);
    const side = i % 2 ? 1 : -1;
    const th = side * (4 + R() * 5) + side * Math.max(0, s - 0.68) * 80;
    const y = lerp(0.094, 0.113, Math.sin(Math.min(1, s * 1.3) * Math.PI * 0.5)) - Math.max(0, s - 0.8) * 0.07;
    add({ group: 'top', root: [th, y], side, dir: [side * lerp(0.8, 0.3, s), -0.12, -lerp(0.55, 1, s)], L0: (lerp(0.4, 0.62, s) + R() * 0.06) * uneven(), w: 0.05 + R() * 0.014, layer: 0.84 + R() * 0.12, gather: 1, lock: side * (s < 0.5 ? 2 : 1) });
  }
  // crown / whorl: covers the top-back between the parting layer and the mane
  for (let i = 0; i < 9; i++) {
    const th = lerp(128, 232, (i + R() * 0.4) / 9);
    add({ group: 'mane', root: [th, 0.104 + R() * 0.006], dir: [Math.sin(th * DEG) * 0.2, -0.6, -1], L0: (0.56 + R() * 0.06) * uneven(), w: 0.056 + R() * 0.012, layer: 0.9 + R() * 0.06, gather: 1, lock: Math.round((180 - th) / 30) });
  }
  // back of the head: long mane in 5 rows (longest in the middle of the back), gathering into five locks
  for (let row = 0; row < 5; row++) {
    const y0 = lerp(0.088, -0.032, row / 4);
    const n = row === 0 ? 9 : row < 3 ? 11 : 10;
    for (let i = 0; i < n; i++) {
      // (roots staggered in height so no row draws a straight line across the back of the head)
      const y = y0 + (R() - 0.5) * 0.02;
      const th = lerp(112, 248, (i + 0.5 * (row % 2) + R() * 0.3) / n);
      const centre = 1 - Math.abs(th - 180) / 70;
      add({ group: 'mane', root: [th, y], dir: [Math.sin(th * DEG) * 0.12, -1, Math.cos(th * DEG) * 0.2], L0: (lerp(0.5, 0.4, row / 4) + 0.12 * centre + R() * 0.06) * uneven(), w: 0.05 + R() * 0.016, layer: lerp(0.8, 0.28, row / 4) + R() * 0.05, gather: row === 0 ? 1 : 0, lock: Math.round((180 - th) / 30) });
    }
  }
  // sides over the ears, some falling in front of the shoulders
  for (const side of [1, -1]) {
    for (let i = 0; i < 8; i++) {
      const th = side * lerp(64, 110, i / 7 + R() * 0.04);
      const y = lerp(0.082, 0.042, (i % 3) / 2) + R() * 0.008;
      add({ group: 'side', root: [th, y], side, dir: [side * 0.3, -1, lerp(-0.1, -0.45, i / 7)], L0: (lerp(0.32, 0.46, R()) - (i < 2 ? 0.08 : 0)) * uneven(), w: 0.04 + R() * 0.012, layer: 0.55 + R() * 0.25, gather: y > 0.055 ? 1 : 0, lock: side * 3 });
    }
  }
  // bangs: parted at the centre, sweeping sideways over the brows and temples, framing the face
  const bangEnds = [[0.04, 0.036, 0.098], [0.056, 0.022, 0.089], [0.068, -0.004, 0.076], [0.074, -0.03, 0.06]];
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const j = i >> 1;
    const th = side * (4 + j * 8 + R() * 3);
    const e = bangEnds[j];
    add({ group: 'bang', root: [th, hairlineY(th) + 0.022 + R() * 0.006], side, end: [side * (e[0] + R() * 0.008), e[1] - R() * 0.014, e[2]], L0: 0.15, w: 0.03 + R() * 0.01, layer: 0.93 + R() * 0.05, gather: 1 });
  }
  // a couple of stray strands across the forehead
  add({ group: 'bang', root: [7, hairlineY(7) + 0.024], side: -1, end: [-0.012, 0.016, 0.104], L0: 0.15, w: 0.011, layer: 0.97, gather: 1 });
  // long face-framing strands from the temples
  for (const side of [1, -1]) for (let i = 0; i < 3; i++) {
    const th = side * (40 + i * 10 + R() * 3);
    add({ group: 'frame', root: [th, hairlineY(th) + 0.01], side, dir: [side * 0.5, -0.6, 0.2], L0: 0.13 + R() * 0.07 + i * 0.015, w: 0.022 + R() * 0.006, layer: 0.96, gather: 0 });
  }
  // nape underlayer (darker, shorter)
  for (let i = 0; i < 8; i++) {
    const th = lerp(128, 232, (i + R() * 0.4) / 8);
    add({ group: 'nape', root: [th, Math.max(hairlineY(th) + 0.016, -0.04) + R() * 0.008], dir: [0, -1, -0.35], L0: (0.24 + R() * 0.08) * uneven(), w: 0.052 + R() * 0.01, layer: 0.25 + R() * 0.1, gather: 0, lock: Math.round((180 - th) / 30) });
  }
  // flyaways: a few thin strands that lift off the mass and catch the light
  for (let i = 0; i < 6; i++) {
    const th = lerp(124, 236, (i + R() * 0.6) / 6);
    const side = th < 180 ? 1 : -1;
    add({ group: 'fly', root: [th, lerp(0.03, 0.095, R())], side, dir: [Math.sin(th * DEG) * 0.3, -1, -0.2], L0: 0.26 + R() * 0.2, w: 0.007 + R() * 0.004, layer: 1.0, gather: 0 });
  }
  return C;
}

const thOf = p => Math.atan2(p[0] - SKULL.c[0], p[2] - SKULL.c[2]) / DEG;

// grow a card's rest polyline in head space (age-0 metres). gathered: pull to the tie point and tuck into the bun.
// tail: with gathered, the strand passes through the tie and hangs from it (the age-15 half-ponytail) instead of
// being tucked into the bun.
export function growCard(cd, n, L, gathered, tie, tail = false) {
  const pts = [];
  const off = 0.006 + cd.layer * 0.016;
  let p = skullPoint(cd.root[0], cd.root[1], off * 0.4);
  pts.push(p);
  const seg = L / (n - 1);
  const tang = (q, dd) => { const nn = skullNormal(q); const k = dd[0] * nn[0] + dd[1] * nn[1] + dd[2] * nn[2]; return nrm3([dd[0] - nn[0] * k, dd[1] - nn[1] * k, dd[2] - nn[2] * k]); };
  if (gathered) {
    let tailed = false, reached = false;
    for (let i = 1; i < n; i++) {
      const q = pts[i - 1];
      if (tailed) {
        // the tail: back over the head from the tie, then down, gathered into one narrow lock behind the neck
        const pr = pts[i - 2];
        let d = nrm3([q[0] - pr[0], q[1] - pr[1], q[2] - pr[2]]);
        // the first segments arc out behind the head, so the tail stands off the loose hair beneath it
        const out = q[1] > 0.06 ? -0.5 : -0.18;
        d = nrm3([d[0] * 0.35 - q[0] * 5 + (cd.rnd - 0.5) * 0.08, d[1] * 0.35 - 1, d[2] * 0.35 + out]);
        let np = [q[0] + d[0] * seg, q[1] + d[1] * seg, q[2] + d[2] * seg];
        // clear of the skull and the neck
        const { c, r } = SKULL;
        const e = Math.hypot((np[0] - c[0]) / (r[0] + 0.02), (np[1] - c[1]) / (r[1] + 0.02), (np[2] - c[2]) / (r[2] + 0.02));
        if (e < 1) np = skullProject(np, 0.02);
        const nz = np[2] + 0.03, ndst = Math.hypot(np[0], nz);
        if (np[1] < 0 && ndst < 0.1) { np[2] = -0.03 - Math.sqrt(Math.max(0, 0.1 * 0.1 - np[0] * np[0])); }
        pts.push(np);
        continue;
      }
      const to = [tie[0] - q[0], tie[1] - q[1], tie[2] - q[2]];
      const dl = Math.hypot(to[0], to[1], to[2]);
      if (dl < seg * 1.1) {
        // remember where along the card the tie is (tieA: the age-15 tail, tieB: the bun) for the mesh colours
        if (tail) { cd.tieA = i / (n - 1); tailed = true; pts.push([tie[0] + (cd.rnd - 0.5) * 0.008, tie[1] - 0.004, tie[2] - 0.016]); continue; }
        if (!reached) { reached = true; cd.tieB = i / (n - 1); }
        pts.push([tie[0] + (i % 2 ? 0.004 : -0.004), tie[1] + 0.012 + i * 0.0015, tie[2] - 0.002 * i]);
        continue;
      }
      pts.push(skullProject([q[0] + to[0] / dl * seg, q[1] + to[1] / dl * seg, q[2] + to[2] / dl * seg], off * 0.5));
    }
    return pts;
  }
  if (cd.group === 'bang') {
    // quadratic arc from the root, bowed out from the forehead, to the end point beside the face
    const E = cd.end;
    const mid = [(p[0] + E[0]) / 2 + cd.side * 0.012, (p[1] + E[1]) / 2 + 0.012, Math.max(p[2], E[2]) + 0.028];
    const Lb = [];
    let prev = p, acc = 0;
    const B = t => [0, 1, 2].map(k => (1 - t) * (1 - t) * p[k] + 2 * (1 - t) * t * mid[k] + t * t * E[k]);
    for (let i = 1; i <= 40; i++) { const q = B(i / 40); acc += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]); prev = q; Lb.push(acc); }
    for (let i = 1; i < n; i++) {
      const target = acc * i / (n - 1);
      let j = 0; while (j < 39 && Lb[j] < target) j++;
      pts.push(B((j + 1) / 40));
    }
    cd.L0 = acc;
    return pts;
  }
  let d = tang(p, nrm3(cd.dir));
  const release = cd.group === 'frame' ? 0.03 : cd.group === 'side' ? 0.0 : cd.group === 'nape' ? -0.1 : -0.035;
  let free = false;
  for (let i = 1; i < n; i++) {
    const q = pts[i - 1];
    if (!free) {
      let np = skullProject([q[0] + d[0] * seg, q[1] + d[1] * seg, q[2] + d[2] * seg], off + (i / n) * 0.004);
      const thn = thOf(np);
      // never fall over the face: at the front hairline steer sideways and back over the scalp
      if (Math.abs(thn) < 78 && np[1] < hairlineY(thn) + 0.016) {
        const sd = cd.side || Math.sign(np[0]) || 1;
        d = tang(q, nrm3([d[0] + sd * 0.5, Math.max(d[1], 0.05), d[2] - 0.9]));
        np = skullProject([q[0] + d[0] * seg, q[1] + d[1] * seg, q[2] + d[2] * seg], off + (i / n) * 0.004);
        pts.push(np);
        continue;
      }
      // leave the scalp (test before committing): below the release height, past the hairline at the sides/back,
      // or where the scalp turns under towards the neck
      if (np[1] < release || np[1] < hairlineY(thn) + 0.006 || skullNormal(np)[1] < -0.28) free = true;
      else {
        const nd = nrm3([np[0] - q[0], np[1] - q[1], np[2] - q[2]]);
        d = tang(np, nrm3([nd[0], nd[1] - 0.3, nd[2]]));
        pts.push(np);
        continue;
      }
    }
    // fall: mostly down, a little of the previous direction; long hair converges into locks over the back
    // locks: strands of a lock converge as they fall, so the mass narrows toward the tips with gaps between locks
    const lockX = cd.lock !== undefined ? cd.lock * 0.038 : q[0];
    const conv = (cd.group === 'mane' || cd.group === 'top' || cd.group === 'nape') ? (lockX - q[0]) * 2.4 : 0;
    const fwd = cd.group === 'frame' ? 0.12 : (cd.group === 'side' ? -0.32 : cd.group === 'nape' ? -0.3 : cd.group === 'fly' ? -0.55 : -0.2);
    const sideOut = cd.group === 'frame' ? cd.side * 0.12 : cd.group === 'fly' ? cd.side * 0.18 : 0;
    d = nrm3([d[0] * 0.45 + conv + sideOut, d[1] * 0.45 - 1, d[2] * 0.35 + fwd]);
    // keep clear of the neck: push outward from the neck axis while close to it
    const nx = q[0], nz = q[2] + 0.03, ndst = Math.hypot(nx, nz);
    if (q[1] < -0.02 && ndst < 0.09) { const k = (0.09 - ndst) / 0.09 * 2.0; d = nrm3([d[0] + nx / (ndst || 1) * k, d[1], d[2] + nz / (ndst || 1) * k]); }
    pts.push([q[0] + d[0] * seg, q[1] + d[1] * seg, q[2] + d[2] * seg]);
  }
  return pts;
}

// ------------------------------------------------------------------ the uncle: grey-black hair tied in a small topknot
export function elderCards() {
  const R = rng(808);
  const C = [];
  const add = (o) => C.push(Object.assign({ col: Math.floor(R() * 4), rnd: R(), gather: 1 }, o));
  for (let i = 0; i < 14; i++) {
    const s = 0.1 + 0.9 * (i / 13), side = i % 2 ? 1 : -1;
    add({ group: 'top', root: [side * (4 + R() * 6), lerp(0.09, 0.112, s)], side, dir: [side * 0.3, 0, -1], L0: 0.3, w: 0.05, layer: 0.8 });
  }
  for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
    const th = lerp(100, 260, (i + 0.5 * (row % 2)) / 9);
    add({ group: 'mane', root: [th, lerp(0.07, -0.04, row / 2)], dir: [0, 1, 0], L0: 0.3, w: 0.055, layer: lerp(0.7, 0.4, row / 2) });
  }
  for (const side of [1, -1]) for (let i = 0; i < 5; i++) add({ group: 'side', root: [side * lerp(60, 98, i / 4), lerp(0.07, 0.02, (i % 2))], side, dir: [0, 1, -0.3], L0: 0.3, w: 0.045, layer: 0.6 });
  // a few short loose strands escaping the knot at the nape
  for (let i = 0; i < 4; i++) {
    const th = lerp(150, 210, i / 3);
    add({ group: 'nape', root: [th, hairlineY(th) + 0.015], dir: [0, -1, -0.2], L0: 0.05 + R() * 0.03, w: 0.026, layer: 0.2, gather: 0 });
  }
  return C;
}
// static head-space cards ({ pts, w, color, bone: 'head'|'jaw', col }) for the uncle. His grey stubble, chin tuft and
// moustache are painted in the skin shader instead: short cards read as solid bars in firelit close-ups.
export function elderStatics() { return []; }
