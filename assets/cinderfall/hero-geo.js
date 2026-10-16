// Geometry for the procedural characters: parametric surfaces with analytic normals, an SDF-sculpted head,
// lofted body parts and garments, and automatic smooth skin weights. Everything is authored in the bind pose
// (character space, metres, +z forward, +x = character's left) and built twice (two ages) with identical topology
// so the second build becomes a morph target.
import * as THREE from 'three';
import { clamp, lerp, smooth, band, TAU, fbm3, snoise3 } from './hero-util.js';

// ------------------------------------------------------------------ accumulation
export class Accum {
  constructor(extra = {}) {
    this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.si = []; this.sw = []; this.idx = [];
    this.extra = {};
    for (const k in extra) this.extra[k] = { size: extra[k], data: [] };
    this.count = 0;
    this.weights = true; // compute skin weights (only needed in the base build)
  }
}
const lin = c => Math.pow(c, 2.2);
export const srgb = (r, g, b) => [lin(r), lin(g), lin(b)];

// Grid surface. f(u,v) -> [x,y,z] in bind space; u wraps when wrapU. Normals by central differences of f, so
// surfaces sharing a boundary function get identical normals there.
// opts: nu, nv, wrapU, color(p,u,v,n) -> [r,g,b] linear, weights(p,u,v) -> [[bone,w],...], extra(p,u,v) -> {name: [..]},
// uv(u,v) -> [s,t], out(u,v) -> point the outward side faces away from (or flip:true), uw/vw: sample warps
export function surf(G, o) {
  const { nu, nv, f } = o;
  const wrapU = !!o.wrapU;
  const uw = o.uw || (u => u), vw = o.vw || (v => v);
  const cols = nu + 1, rows = nv + 1, base = G.count;
  const P = [], N = [];
  const e = 1e-3;
  let vote = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const u = uw(i / nu), v = vw(j / nv);
    const p = f(u, v);
    const pu1 = f(u + e, v), pu0 = f(u - e, v), pv1 = f(u, v + e), pv0 = f(u, v - e);
    const du = [pu1[0] - pu0[0], pu1[1] - pu0[1], pu1[2] - pu0[2]], dv = [pv1[0] - pv0[0], pv1[1] - pv0[1], pv1[2] - pv0[2]];
    let n = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = [n[0] / l, n[1] / l, n[2] / l];
    if (o.out && (i + j) % 7 === 0) { const c = o.out(u, v); vote += Math.sign((p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1] + (p[2] - c[2]) * n[2]); }
    P.push(p); N.push(n);
  }
  // repair degenerate normals (collapsed tips / poles) from neighbouring rows
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, n = N[k];
    if (!(Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) > 0.5) || n.some(x => !Number.isFinite(x))) {
      let rep = null;
      for (let dj = 1; dj < rows && !rep; dj++) for (const jj of [j - dj, j + dj]) {
        if (jj < 0 || jj >= rows) continue;
        const m = N[jj * cols + i];
        if (Math.abs(m[0]) + Math.abs(m[1]) + Math.abs(m[2]) > 0.5 && m.every(Number.isFinite)) { rep = m; break; }
      }
      N[k] = rep ? rep.slice() : [0, 1, 0];
      if (o.tipNormal) N[k] = o.tipNormal(i / nu, j / nv) || N[k];
    }
  }
  const flip = o.flip !== undefined ? o.flip : vote < 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i;
    const p = P[k];
    let n = N[k];
    if (flip) n = [-n[0], -n[1], -n[2]];
    const u = uw(i / nu), v = vw(j / nv);
    G.pos.push(p[0], p[1], p[2]);
    G.nrm.push(n[0], n[1], n[2]);
    const st = o.uv ? o.uv(u, v, p) : [u, v];
    G.uv.push(st[0], st[1]);
    const c = o.color ? o.color(p, u, v, n) : [1, 1, 1];
    G.col.push(c[0], c[1], c[2]);
    pushWeights(G, o.weights ? (G.weights ? o.weights(p, u, v) : null) : [[0, 1]]);
    pushExtra(G, o.extra ? o.extra(p, u, v, n) : null);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    if (!flip) G.idx.push(a, b, d, a, d, c); else G.idx.push(a, d, b, a, c, d);
  }
  G.count += cols * rows;
}

function pushWeights(G, W) {
  if (!W) { G.si.push(0, 0, 0, 0); G.sw.push(1, 0, 0, 0); return; }
  W = W.filter(w => w[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  let s = 0;
  for (const w of W) s += w[1];
  for (let i = 0; i < 4; i++) {
    if (i < W.length) { G.si.push(W[i][0]); G.sw.push(W[i][1] / s); } else { G.si.push(0); G.sw.push(0); }
  }
}
function pushExtra(G, ex) {
  for (const k in G.extra) {
    const E = G.extra[k];
    const v = ex && ex[k] !== undefined ? ex[k] : null;
    for (let i = 0; i < E.size; i++) E.data.push(v ? (Array.isArray(v) ? v[i] : v) : 0);
  }
}

// Build a BufferGeometry from a base accumulation and a second (morph) accumulation with the same topology.
export function toGeometry(A, B) {
  if (B && B.count !== A.count) throw new Error('hero: morph topology mismatch ' + A.count + ' vs ' + B.count);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(A.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(A.sw, 4));
  for (const k in A.extra) g.setAttribute(k, new THREE.Float32BufferAttribute(A.extra[k].data, A.extra[k].size));
  g.setIndex(A.count > 65535 ? new THREE.Uint32BufferAttribute(A.idx, 1) : new THREE.Uint16BufferAttribute(A.idx, 1));
  if (B) {
    g.morphAttributes.position = [new THREE.Float32BufferAttribute(B.pos, 3)];
    g.morphAttributes.normal = [new THREE.Float32BufferAttribute(B.nrm, 3)];
    g.morphAttributes.color = [new THREE.Float32BufferAttribute(B.col, 3)];
  }
  g.computeBoundingSphere();
  g.boundingSphere.radius += 0.6;
  return g;
}

// ------------------------------------------------------------------ math helpers
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const madd = (p, d, s) => [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s];
const v3 = v => [v.x, v.y, v.z];
export const VEC = { sub, add, mul, dot, cross, len, norm, madd };

// Catmull-Rom through a table of [key, ...values] rows (keys ascending); returns the values at x (clamped ends)
export function table(rows) {
  if (rows[0][0] > rows[rows.length - 1][0]) rows = rows.slice().reverse();
  const K = rows.map(r => r[0]);
  return x => {
    const n = rows.length;
    if (x <= K[0]) return rows[0].slice(1);
    if (x >= K[n - 1]) return rows[n - 1].slice(1);
    let i = 0;
    while (i < n - 2 && x > K[i + 1]) i++;
    const t = (x - K[i]) / (K[i + 1] - K[i]);
    const r0 = rows[Math.max(0, i - 1)], r1 = rows[i], r2 = rows[i + 1], r3 = rows[Math.min(n - 1, i + 2)];
    const out = [];
    for (let c = 1; c < r1.length; c++) {
      const p0 = r0[c], p1 = r1[c], p2 = r2[c], p3 = r3[c];
      const t2 = t * t, t3 = t2 * t;
      out.push(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3));
    }
    return out;
  };
}
// superellipse radius factor in direction angle a (e = 2 ellipse, >2 boxier)
const sup = (a, e) => Math.pow(Math.pow(Math.abs(Math.sin(a)), e) + Math.pow(Math.abs(Math.cos(a)), e), -1 / e);

// ------------------------------------------------------------------ skin weights
// smooth partition along a chain: keys = [[bone, t_start]], blend half-width bw; returns weights at t
function chainW(t, keys, bw) {
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const a = i === 0 ? -1e9 : keys[i][1], b = i === keys.length - 1 ? 1e9 : keys[i + 1][1];
    const bwa = Array.isArray(bw) ? bw[i] : bw, bwb = Array.isArray(bw) ? bw[i + 1] ?? bw[i] : bw;
    const w = smooth(a - bwa, a + bwa, t) * (1 - smooth(b - bwb, b + bwb, t));
    if (w > 0) out.push([keys[i][0], w]);
  }
  return out;
}
function segDist(p, A, B) {
  const ab = sub(B, A), ap = sub(p, A);
  const t = clamp(dot(ap, ab) / Math.max(dot(ab, ab), 1e-9));
  return len(sub(p, madd(A, ab, t)));
}

export function makeWeighter(rig) {
  const I = rig.idx, bp = n => v3(rig.bindPos[I[n]]), ep = n => v3(rig.endPos[I[n]]);
  const W = {};
  const yN = bp('neck')[1], yH = bp('head')[1], yC = bp('chest')[1], yS = bp('spine')[1];
  W.torso = p => {
    const y = p[1], ax = Math.abs(p[0]), s = p[0] >= 0 ? 'L' : 'R';
    let w = chainW(y, [[I.hips, 0], [I.spine, yS + 0.005], [I.chest, yC + 0.03], [I.neck, yN + 0.02], [I.head, yH - 0.01]], [0, 0.045, 0.06, 0.025, 0.02]);
    const cl = smooth(0.07, 0.165, ax) * smooth(yC + 0.06, yN - 0.035, y);
    const ua = smooth(0.11, 0.185, ax) * smooth(yC + 0.02, yN - 0.06, y) * 0.75;
    if (cl + ua > 0) {
      const k = Math.min(1, cl + ua);
      w = w.map(q => [q[0], q[1] * (1 - k)]);
      w.push([I['clavicle' + s], cl * (1 - ua)], [I['upperArm' + s], ua]);
    }
    return w;
  };
  W.skirt = (p, hemY) => {
    const y = p[1];
    const g = 0.62 * smooth(0.99 * yS, hemY, y);
    const l = smooth(-0.09, 0.09, p[0]);
    const w = W.torso(p).map(q => [q[0], q[1] * (1 - g)]);
    w.push([I.thighL, g * l], [I.thighR, g * (1 - l)]);
    return w;
  };
  W.arm = (p, s) => {
    const S = bp('upperArm' + s), E = bp('foreArm' + s), Wr = bp('hand' + s);
    const d = norm(sub(Wr, S));
    const t = dot(sub(p, S), d), lU = len(sub(E, S)), lF = len(sub(Wr, E));
    return chainW(t, [[I['clavicle' + s], -1], [I['upperArm' + s], -0.012], [I['foreArm' + s], lU], [I['hand' + s], lU + lF]], [0, 0.045, 0.04, 0.018]);
  };
  W.leg = (p, s, top = true) => {
    const y = p[1];
    const yT = bp('thigh' + s)[1], yK = bp('shin' + s)[1], yA = bp('foot' + s)[1];
    const inner = smooth(0.06, 0.0, Math.abs(p[0]));
    // chain runs downward: parameter -y
    return chainW(-y, [[I.hips, -1e9], [I['thigh' + s], -(yT + 0.05 - inner * 0.06)], [I['shin' + s], -yK], [I['foot' + s], -yA]], [0, 0.085, 0.05, 0.02]);
  };
  W.foot = (p, s) => {
    const zT = bp('toe' + s)[2], yA = bp('foot' + s)[1];
    const w = chainW(p[2], [[I['foot' + s], -1], [I['toe' + s], zT + 0.004]], 0.022);
    const sh = smooth(yA - 0.01, yA + 0.05, p[1]);
    if (sh > 0) { for (const q of w) q[1] *= 1 - sh; w.push([I['shin' + s], sh]); }
    return w;
  };
  W.seg = (p, names, pow = 8, r0 = 0.002) => {
    const out = [];
    for (const n of names) {
      const d = Math.max(segDist(p, bp(n), ep(n)), r0);
      out.push([I[n], Math.pow(1 / d, pow)]);
    }
    let s = 0; for (const q of out) s += q[1];
    return out.map(q => [q[0], q[1] / s]);
  };
  W.bone = n => () => [[I[n], 1]];
  return W;
}

// ------------------------------------------------------------------ SDF head
const sdEll = (x, y, z, cx, cy, cz, rx, ry, rz) => {
  const a = (x - cx) / rx, b = (y - cy) / ry, c = (z - cz) / rz;
  const k0 = Math.hypot(a, b, c), k1 = Math.hypot(a / rx, b / ry, c / rz);
  return k0 * (k0 - 1) / Math.max(k1, 1e-9);
};
const sdSph = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;
function sdCone(x, y, z, a, b, r1, r2) {
  const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], pa = [x - a[0], y - a[1], z - a[2]];
  const h = clamp(dot(pa, ba) / dot(ba, ba));
  return len([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - lerp(r1, r2, h);
}
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);

// head space: origin between the eyes' centres at eye level, metres at age-0 scale. A: shape params per character.
export function headSDF(x, y, z, A) {
  const ax = Math.abs(x);
  let d = sdEll(ax, y, z, 0, 0.022, -0.01, 0.073 * A.skullW, 0.092, 0.092 * A.skullD);
  // face mass: forehead and cheeks, receding below the nose so the mouth does not protrude
  d = smin(d, sdEll(ax, y, z, 0, -0.006, 0.026, 0.0625 * A.faceW, 0.079, 0.064), 0.024);
  d = smax(d, -sdEll(ax, y, z, 0.083 * A.skullW, 0.028, 0.052, 0.016, 0.03, 0.026), 0.012);
  const jw = A.jawW;
  // mandible: gonion to chin, narrowing into a V
  d = smin(d, sdCone(ax, y, z, [0.047 * jw, -0.047, -0.018], [0.0105 * jw, -0.087 * A.chinL, 0.058], 0.0142 * A.jawT, 0.0112), 0.021);
  d = smin(d, sdEll(ax, y, z, 0, -0.0845 * A.chinL, 0.07, 0.0145 * A.chinW, 0.0132, 0.0158), 0.016);
  // maxilla / mouth barrel
  d = smin(d, sdEll(ax, y, z, 0, -0.049, 0.054, 0.026, 0.02, 0.024), 0.022);
  d = smin(d, sdEll(ax, y, z, 0.048 * A.faceW, -0.009, 0.044, 0.0175, 0.0105, 0.018), 0.015 * A.cheek);
  d = smin(d, sdEll(ax, y, z, 0.0, 0.026, 0.076, 0.05, 0.0115, 0.0165), 0.02 * A.brow);
  // youthful buccal fill between cheekbone and jaw (keeps the cheek plane smooth), hollows under the cheekbones (age)
  if (A.fill) d = smin(d, sdEll(ax, y, z, 0.037, -0.034, 0.036, 0.021, 0.024, 0.026), 0.018 * A.fill);
  if (A.hollow) { const h = A.hollow; d = smax(d, -sdEll(ax, y, z, 0.044, -0.044, 0.054 + 0.002 * h, 0.012 + 0.003 * h, 0.014 + 0.003 * h, 0.008 + 0.003 * h), 0.008 + 0.004 * h); }
  // eye sockets and eyeballs
  d = smax(d, -sdEll(ax, y, z, 0.031, 0.003, 0.093 - (A.socket || 0) * 0.003, 0.0185, 0.0118 + (A.socket || 0) * 0.0015, 0.0155 + (A.socket || 0) * 0.002), 0.0095);
  d = smin(d, sdSph(ax, y, z, 0.031, 0.0005, 0.0688, 0.0124), 0.0035);
  // nose: bridge, tip, wings, nostrils
  d = smin(d, sdCone(ax, y, z, [0, 0.016, 0.087], [0, -0.022, 0.1105 * A.noseL], 0.0058, 0.0085), 0.0105);
  d = smin(d, sdSph(ax, y, z, 0, -0.0245, 0.1085 * A.noseL, 0.0094), 0.006);
  d = smin(d, sdEll(ax, y, z, 0.0118, -0.0305, 0.0955, 0.0072, 0.006, 0.0074), 0.0065);
  d = smax(d, -sdEll(ax, y, z, 0.006, -0.0362, 0.1012, 0.0032, 0.002, 0.0038), 0.002);
  // lips (set back under the nose) and a soft mouth line
  const lp = A.lip || 1;
  d = smin(d, sdEll(ax, y, z, 0, -0.0476, 0.0812 - (1 - lp) * 0.004, 0.0176, 0.0052 * lp, 0.0084), 0.0095);
  d = smin(d, sdEll(ax, y, z, 0, -0.0584, 0.0782 - (1 - lp) * 0.004, 0.015, 0.0058 * lp, 0.0082), 0.0095);
  d = smax(d, -sdEll(ax, y, z, 0, -0.0532, 0.092, 0.019, 0.0007, 0.006), 0.0022);
  // neck and trapezius / upper chest
  d = smin(d, sdCone(ax, y, z, [0, -0.06, -0.026], [0, -0.27, -0.032], A.neckR, A.neckR * 1.08), 0.013);
  d = smin(d, sdEll(ax, y, z, 0, -0.335, -0.022, A.trapW, 0.07, 0.098), 0.05);
  return d;
}

// Head + neck + upper chest surface by projection from a vertical capsule axis (rays horizontal along the neck,
// radial from the head centre above eye level), snapped to the SDF. Returns rows of samples.
export function headSurface(G, HF, A, opts) {
  const s = HF.s, O = HF.O;
  const F = (x, y, z) => headSDF(x / s, y / s, z / s, A) * s;
  const yBot = -0.37, zAx = y => lerp(-0.02, -0.004, clamp((y - yBot) / (-yBot)));
  const nu = opts.nu, nv = opts.nv;
  // rows: v in [0, vc] cylinder from yBot to 0; [vc, 1] hemisphere 0..90deg
  const vc = 0.58;
  const rowY = v => { // cylinder part: denser near the face (y in -0.13..0)
    const t = v / vc;
    return t < 0.3 ? lerp(yBot, -0.13, t / 0.3) : lerp(-0.13, 0, (t - 0.3) / 0.7);
  };
  const warpU = u => { const sgn = 2 * u - 1; return Math.PI * sgn * (0.42 + 0.58 * sgn * sgn); };
  const ray = (u, v) => {
    const ph = warpU(((u % 1) + 1) % 1);
    if (v <= vc) { const y = rowY(v) * s; return [[0, y, zAx(y / s) * s], [Math.sin(ph), 0, Math.cos(ph)]]; }
    const th = (v - vc) / (1 - vc) * Math.PI / 2 * 0.999;
    const th2 = th < 0.6 ? th : th; // keep
    return [[0, 0, zAx(0) * s], [Math.cos(th2) * Math.sin(ph), Math.sin(th2), Math.cos(th2) * Math.cos(ph)]];
  };
  const hit = (u, v) => {
    const [o, d] = ray(u, v);
    let t = 0.32 * s;
    for (let k = 0; k < 90; k++) {
      const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
      const dd = F(p[0], p[1], p[2]);
      if (Math.abs(dd) < 2e-6) break;
      t -= dd * 0.85;
      if (t < 0) { t = 0; break; }
    }
    return [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
  };
  const grad = p => {
    const h = 0.0004;
    return norm([F(p[0] + h, p[1], p[2]) - F(p[0] - h, p[1], p[2]), F(p[0], p[1] + h, p[2]) - F(p[0], p[1] - h, p[2]), F(p[0], p[1], p[2] + h) - F(p[0], p[1], p[2] - h)]);
  };
  // precompute hits on the grid so f(u,v) can interpolate (normals come from the SDF gradient instead)
  const cols = nu + 1, rows = nv + 1, H = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) H.push(hit(i / nu, j / nv));
  const base = G.count;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const hp = H[j * cols + i];
    const n = grad(hp);
    // ambient occlusion from the SDF
    const ao = clamp(0.35 + 0.65 * (F(hp[0] + n[0] * 0.004 * s, hp[1] + n[1] * 0.004 * s, hp[2] + n[2] * 0.004 * s) / (0.004 * s)) * 0.5 + 0.5 * clamp(F(hp[0] + n[0] * 0.012 * s, hp[1] + n[1] * 0.012 * s, hp[2] + n[2] * 0.012 * s) / (0.012 * s)));
    const p = [O[0] + hp[0], O[1] + hp[1], O[2] + hp[2]];
    G.pos.push(p[0], p[1], p[2]);
    G.nrm.push(n[0], n[1], n[2]);
    G.uv.push(i / nu, j / nv);
    const c = opts.color(p, hp, n, ao);
    G.col.push(c[0], c[1], c[2]);
    pushWeights(G, G.weights ? opts.weights(p) : null);
    pushExtra(G, { aFace: [hp[0] / s, hp[1] / s, hp[2] / s, 1] });
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    G.idx.push(a, b, d, a, d, c);
  }
  G.count += cols * rows;
  // close the crown: the last row collapses to the top; fine (degenerate tris are harmless)
  return F;
}

// ------------------------------------------------------------------ tube helper
// straight tube between A and B (bind points); frame: d = B-A, n from ref, b = d x n.
// shape(phi, v) -> [offN, offB, offD]; returns f(u,v)
export function tubeF(A, B, ref, shape) {
  const d = norm(sub(B, A)), L = len(sub(B, A));
  const n = norm(sub(ref, mul(d, dot(ref, d)))), b = cross(d, n);
  const f = (u, v) => {
    const ph = u * TAU;
    const o = shape(ph, v);
    const c = madd(A, d, v * L + (o[2] || 0));
    return [c[0] + n[0] * o[0] + b[0] * o[1], c[1] + n[1] * o[0] + b[1] * o[1], c[2] + n[2] * o[0] + b[2] * o[1]];
  };
  f.frame = { d, n, b, L };
  return f;
}
// tube along a polyline of points with lengths, frame transported with a fixed reference
export function pathTubeF(pts, ref, shape) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + len(sub(pts[i], pts[i - 1])));
  const T = L[L.length - 1];
  const at = s => {
    s = clamp(s, -0.2, 1.2) * T;
    let i = 0;
    while (i < pts.length - 2 && s > L[i + 1]) i++;
    const t = (s - L[i]) / (L[i + 1] - L[i]);
    return [madd(pts[i], sub(pts[i + 1], pts[i]), t), norm(sub(pts[i + 1], pts[i])), i, t];
  };
  const f = (u, v) => {
    const [c, d0, i, t] = at(v);
    // smooth tangent across joints
    let d = d0;
    if (i > 0 && t < 0.25) d = norm(add(mul(norm(sub(pts[i], pts[i - 1])), 0.5 - t * 2), mul(d0, 0.5 + t * 2)));
    if (i < pts.length - 2 && t > 0.75) d = norm(add(mul(d0, 0.5 + (1 - t) * 2), mul(norm(sub(pts[i + 2], pts[i + 1])), 0.5 - (1 - t) * 2)));
    const n = norm(sub(ref, mul(d, dot(ref, d)))), b = cross(d, n);
    const o = shape(u * TAU, v, T);
    return [c[0] + n[0] * o[0] + b[0] * o[1], c[1] + n[1] * o[0] + b[1] * o[1], c[2] + n[2] * o[0] + b[2] * o[1]];
  };
  f.L = T;
  return f;
}

export { v3, sup, chainW };
export const noise = { fbm3, snoise3 };
export const util = { band, smooth };
