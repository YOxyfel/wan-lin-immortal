// World B ground: anchors, the analytic height field (the camp clearing, the stream from the waterfall at the karst wall
// down past the camp, the journey path from the camp to the dell, the basin rising toward the wall, the sunken dell at
// the wall's foot), ground masks, terrain tiles along the route and running water. North = -z, east = +x, metres, y up.
import * as THREE from 'three';
import { fbm } from './util.js';
import { U } from './materials.js';
import { FOGU } from './atmosphere.js';
import { floorMaterial, terrainGeometry } from './flora-ground.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = a - b; d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2; return d; };

// ------------------------------------------------------------------ layout (x, z)
// The dell and its tree moved as one piece (round 4) from beside the camp to the foot of the karst wall, ~410 m out.
export const DELL_SHIFT = [-216, -221];
const shifted = ([x, z]) => [x + DELL_SHIFT[0], z + DELL_SHIFT[1]];
// The journey: out along the old hunt trail, over the ford, through the bamboo thicket and the old wood, past the
// waterfall at the foot of the karst wall, to the rim of the dell and down its leaf slope (centripetal Catmull-Rom
// through these points, as THREE.CatmullRomCurve3(..., 'centripetal') draws it).
const JOURNEY = [[0, 0], [-6, -14], [-11, -30], [-16, -47], [-21, -62], [-26, -71], [-30, -78], [-38, -98], [-48, -122],
  [-57, -145.5], [-72, -166], [-92, -185], [-118, -204], [-150, -226], [-178, -246], [-204, -262], [-224, -278],
  [-238, -292], [-246, -299], [-252, -309]];
export const P = {
  CAMP: [0, 0], ROCK: [5.6, -5.4], FIRE: [1.6, -1.2], HOME: [-9, -8], TALLY: [-6.2, 6.6], TARGET: [-9.5, -2.5], RANGE: [-3.6, 5.7],
  MEDITATE: [-12, 2.5], BIGPINE: [-13.5, 0.5], MAPLE1: [-9, 5.5], POOL: [10.5, -1.5], MEMORIAL: [-4.2, -4.4],
  JOURNEY,
  FORD: [-57, -145.5], THICKET: [-92, -185], OLDWOOD: [-150, -226], CLIFF: [-224, -278], RIM: [-246, -299], LAND: [-252, -309],
  DELL: shifted([-44, -98]), ANCIENT: shifted([-43.9, -98.65]), DELL_FALL: shifted([-58, -92.5]),
  // the plunge pool under the waterfall, where the stream begins
  CLIFF_POOL: [-232.8, -267.2],
  // the foot of the karst wall (where its face meets the ground), south-east to north-west; the route runs on its
  // north-east side, the towers stand on the other
  WALL: [[-188, -222], [-214, -240], [-236.5, -262.4], [-268, -286], [-290, -307], [-304, -327], [-334, -338], [-368, -336]],
  BASIN: [-20, -40],
  // legacy (round 3 hunt): the first stretch of the journey, where he shot at the boar
  TRAIL: JOURNEY.slice(0, 7), SHOT: [-21, -62], BOAR: [-14, -72],
};
P.EDGE = P.RIM;

// ------------------------------------------------------------------ polylines: dense samples, nearest-point queries
// three.js CatmullRomCurve3 'centripetal' (initNonuniformCatmullRom) in x/z, sampled ~perMetre per metre
function catmull2(pts, perMetre = 1) {
  const n = pts.length, X = [], Z = [];
  const poly = (x0, x1, x2, x3, dt0, dt1, dt2) => {
    let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
    let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
    t1 *= dt1; t2 *= dt1;
    const c1 = t1, c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2, c3 = 2 * x1 - 2 * x2 + t1 + t2;
    return t => x1 + c1 * t + c2 * t * t + c3 * t * t * t;
  };
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  for (let i = 0; i < n - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const p0 = i > 0 ? pts[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
    const p3 = i + 2 < n ? pts[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
    let dt0 = Math.pow(d2(p0, p1), 0.25), dt1 = Math.pow(d2(p1, p2), 0.25), dt2 = Math.pow(d2(p2, p3), 0.25);
    if (dt1 < 1e-4) dt1 = 1;
    if (dt0 < 1e-4) dt0 = dt1;
    if (dt2 < 1e-4) dt2 = dt1;
    const fx = poly(p0[0], p1[0], p2[0], p3[0], dt0, dt1, dt2), fz = poly(p0[1], p1[1], p2[1], p3[1], dt0, dt1, dt2);
    const m = Math.max(2, Math.ceil(Math.sqrt(d2(p1, p2)) * perMetre));
    for (let k = 0; k < m; k++) { X.push(fx(k / m)); Z.push(fz(k / m)); }
  }
  X.push(pts[n - 1][0]); Z.push(pts[n - 1][1]);
  return withArc({ X, Z });
}
function withArc(L) {
  const S = [0];
  for (let i = 1; i < L.X.length; i++) S.push(S[i - 1] + Math.hypot(L.X[i] - L.X[i - 1], L.Z[i] - L.Z[i - 1]));
  L.S = S; L.length = S[S.length - 1];
  return L;
}
// a uniform grid listing, per cell, the segments that come within `reach` of it
function gridOf(L, cell, reach) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < L.X.length; i++) { x0 = Math.min(x0, L.X[i]); x1 = Math.max(x1, L.X[i]); z0 = Math.min(z0, L.Z[i]); z1 = Math.max(z1, L.Z[i]); }
  x0 -= reach + cell; z0 -= reach + cell; x1 += reach + cell; z1 += reach + cell;
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const cells = new Array(nx * nz);
  for (let i = 0; i < L.X.length - 1; i++) {
    const ia = Math.floor((Math.min(L.X[i], L.X[i + 1]) - reach - x0) / cell), ib = Math.floor((Math.max(L.X[i], L.X[i + 1]) + reach - x0) / cell);
    const ja = Math.floor((Math.min(L.Z[i], L.Z[i + 1]) - reach - z0) / cell), jb = Math.floor((Math.max(L.Z[i], L.Z[i + 1]) + reach - z0) / cell);
    for (let j = ja; j <= jb; j++) for (let k = ia; k <= ib; k++) { const c = j * nx + k; (cells[c] || (cells[c] = [])).push(i); }
  }
  return { x0, z0, nx, nz, cell, cells, reach };
}
const FAR = Object.freeze({ d: Infinity, s: 0, i: -1, t: 0 });
function nearestOn(L, G, x, z) {
  const ci = Math.floor((x - G.x0) / G.cell), cj = Math.floor((z - G.z0) / G.cell);
  if (ci < 0 || cj < 0 || ci >= G.nx || cj >= G.nz) return FAR;
  const list = G.cells[cj * G.nx + ci];
  if (!list) return FAR;
  const X = L.X, Z = L.Z;
  let best = Infinity, bi = 0, bt = 0;
  for (let k = 0; k < list.length; k++) {
    const i = list[k], ax = X[i], az = Z[i], ex = X[i + 1] - ax, ez = Z[i + 1] - az, L2 = ex * ex + ez * ez || 1e-9;
    let t = ((x - ax) * ex + (z - az) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - ax - ex * t, dz = z - az - ez * t, d = dx * dx + dz * dz;
    if (d < best) { best = d; bi = i; bt = t; }
  }
  return { d: Math.sqrt(best), s: lerp(L.S[bi], L.S[bi + 1], bt), i: bi, t: bt };
}
function pointAt(L, s) {
  const S = L.S;
  s = clamp(s, 0, L.length);
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
  const t = (s - S[lo]) / Math.max(1e-9, S[hi] - S[lo]);
  return [lerp(L.X[lo], L.X[hi], t), lerp(L.Z[lo], L.Z[hi], t), lo, t];
}
function sampleArr(L, A, s) { const [, , i, t] = pointAt(L, s); return lerp(A[i], A[Math.min(A.length - 1, i + 1)], t); }
// exact distance to a short polyline (no grid; for coarse questions far from it)
function polyDist(pts, x, z) {
  let best = Infinity, bi = 0, bt = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], ex = pts[i + 1][0] - ax, ez = pts[i + 1][1] - az, L2 = ex * ex + ez * ez;
    const t = clamp(((x - ax) * ex + (z - az) * ez) / L2);
    const d = Math.hypot(x - ax - ex * t, z - az - ez * t);
    if (d < best) { best = d; bi = i; bt = t; }
  }
  return { d: best, i: bi, t: bt };
}

// ------------------------------------------------------------------ the journey path
const JP = catmull2(JOURNEY, 1);
const JG = gridOf(JP, 16, 44), JGn = gridOf(JP, 8, 12);
/** nearest point of the journey path: { d (Infinity beyond ~44 m), s (arc length from the camp) } */
export function trailDist(x, z) { return nearestOn(JP, JG, x, z); }
export const JOURNEY_LEN = JP.length;
export const TRAIL_LEN = JP.length;
export function trailPoint(s) { const p = pointAt(JP, s); return [p[0], p[1]]; }
/** the path's direction at s (unit [x, z]) */
export function trailDir(s) { const a = trailPoint(s - 1), b = trailPoint(s + 1); const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
const sOf = p => nearestOn(JP, JG, p[0], p[1]).s;
export const S = {
  FORD: sOf(P.FORD), THICKET: sOf(P.THICKET), OLDWOOD: sOf(P.OLDWOOD), CLIFF: sOf(P.CLIFF), RIM: sOf(P.RIM), LAND: JP.length,
  EDGE_OLD: sOf([-30, -78]),
};
/** distance to the route (control polyline, exact at any range) */
export function routeDist(x, z) { return polyDist(JOURNEY, x, z).d; }

// ------------------------------------------------------------------ the basin climbs toward the karst wall
// (~10 m from the camp to the dell over 400 m: unnoticed underfoot, it lets the stream run down from the waterfall)
const RISE_DIR = [-0.628, -0.778];
export const riseT = (x, z) => x * RISE_DIR[0] + z * RISE_DIR[1];
// (and a broad swell under the ford, so the crossing lies in a shallow valley of its own)
const rise = (x, z) => 10 * smooth(20, 430, riseT(x, z)) + 1.0 * Math.exp(-((x + 50) ** 2 + (z + 140) ** 2) / 6000);
// how far into the old forest (0 near the camp, 1 from the old wood on)
export const oldK = (x, z) => smooth(175, 275, riseT(x, z));

function baseH(x, z) {
  let h = (fbm(x * 0.0065 + 11.3, z * 0.0065 - 4.1, 4) - 0.5) * 7;
  h += (fbm(x * 0.035 + 2.2, z * 0.035 + 7.7, 3) - 0.5) * 1.6;
  const rb = Math.hypot(x - P.BASIN[0], z - P.BASIN[1]);
  // the basin floor rises gently toward the ring (gently: from the air the towers must stand on the horizon from
  // their misty feet, not be cut off by a raised rim of forest)
  h += smooth(250, 620, rb) * 9 + smooth(520, 950, rb) * 12;
  return h + rise(x, z);
}

// ------------------------------------------------------------------ the karst wall's foot: a talus ramp
/** { d: distance to the wall's foot line, side: +1 on the route's side, -1 under the wall, end: 0..1 past its ends } */
export function wallSide(x, z) {
  const W = P.WALL, q = polyDist(W, x, z);
  const a = W[q.i], b = W[q.i + 1];
  const cr = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const ext = (q.i === 0 && q.t === 0) || (q.i === W.length - 2 && q.t === 1);
  return { d: q.d, side: cr > 0 ? 1 : -1, end: ext ? 1 : 0 };
}
function talus(x, z) {
  const w = wallSide(x, z);
  if (w.d > 40) return 0;
  const k = w.end ? 1 - smooth(4, 26, w.d) : 1;
  if (w.side > 0) return 2.4 * Math.pow(1 - smooth(0, 15, w.d), 1.4) * k;
  return (2.4 + Math.min(w.d, 24) * 0.3) * k;
}

// ------------------------------------------------------------------ the dell: a bowl with a long leaf slope to the SE
const DC = P.DELL;
// the dell sits in the ground around it: its floor and rim heights are relative to the mean ground there
const H0 = (() => { let s = 0, n = 0; for (let a = 0; a < 12; a++) for (const rr of [26, 34, 42]) { s += baseH(DC[0] + Math.cos(a / 12 * 6.283) * rr, DC[1] + Math.sin(a / 12 * 6.283) * rr); n++; } return s / n; })();
export const DELL_FLOOR = H0 - 8;
const DPOOL = (() => { const dx = DC[0] - P.DELL_FALL[0], dz = DC[1] - P.DELL_FALL[1], l = Math.hypot(dx, dz); return [P.DELL_FALL[0] + dx / l * 5.2, P.DELL_FALL[1] + dz / l * 5.2]; })();
export const DELL_POOL = DPOOL;
const SE = Math.atan2(P.EDGE[1] - DC[1], P.EDGE[0] - DC[0]);
// the waterfall's bay in the west wall: the wall pulled in and raised into a short limestone cliff
const BAY = Math.atan2(P.DELL_FALL[1] - DC[1], P.DELL_FALL[0] - DC[0]);
function dell(x, z) {
  const dx = x - DC[0], dz = z - DC[1], r = Math.hypot(dx, dz);
  if (r > 70) return null;
  const th = Math.atan2(dz, dx);
  const se = Math.exp(-Math.pow(angDiff(th, SE) / 0.6, 2));
  const bay = Math.exp(-Math.pow(angDiff(th, BAY) / 0.3, 2));
  const wob = fbm(Math.cos(th) * 1.6 + 3.1, Math.sin(th) * 1.6 + 9.4, 3) - 0.5;
  const rFloor = lerp(19.5, 14.2, se) + wob * 3.5 * (1 - se) * (1 - bay) - bay * 7.5;
  const rRim = lerp(25.5, 24.6, se) + wob * 3.0 * (1 - se) * (1 - bay) - bay * 10.5;
  const hRim = H0 + Math.max(0, 3.4 - 3.3 * Math.sin(th)) * (1 - se) + wob * 1.5 * (1 - se) + bay * 3.8;
  let h, w;
  if (r <= rFloor) {
    h = DELL_FLOOR + 0.5 * (fbm(x * 0.09 + 2, z * 0.09 - 1, 3) - 0.5) + 0.6 * smooth(rFloor - 6, rFloor, r) * (1 - se);
    w = 1;
  } else if (r <= rRim) {
    const t = (r - rFloor) / (rRim - rFloor);
    const steep = Math.pow(t, 0.75) * (1 - se) + t * se;
    const prof = lerp(smooth(0, 1, steep), t, se * 0.6);
    h = DELL_FLOOR + 0.6 * (1 - se) + (hRim - DELL_FLOOR - 0.6 * (1 - se)) * prof + (1 - se) * 0.9 * (fbm(th * 4 + 7, r * 0.3, 3) - 0.5) * Math.sin(Math.PI * t);
    w = 1;
  } else {
    h = hRim + (1 - se) * 1.2 * (fbm(x * 0.05 + 4, z * 0.05 + 4, 3) - 0.5);
    w = 1 - smooth(rRim, rRim + 28, r);
  }
  if (r < rRim + 2) { const pd = Math.hypot(x - DPOOL[0], z - DPOOL[1]); h -= 1.1 * Math.exp(-pd * pd / 5.5) * (1 - smooth(rRim - 4, rRim, r) * 0.5); }
  return { h, w, r, rFloor, rRim, se };
}

// the ground before the path, the camp and the stream are worked into it
function preH(x, z) {
  let h = baseH(x, z) + talus(x, z);
  const D = dell(x, z);
  if (D) h = lerp(h, D.h, D.w);
  return h;
}

// ------------------------------------------------------------------ the path's own height along its length
// near the camp the old hunt trail (an undulating way around y 0); further out it follows the ground, smoothed so
// that a camera carried 1.6 m above it glides; into the dell it hands over to the dell's leaf slope
const PATH_Y = (() => {
  const n = JP.X.length, raw = new Float32Array(n), out = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = preH(JP.X[i], JP.Z[i]);
  const sig = 9, R = 24;
  for (let i = 0; i < n; i++) {
    let a = 0, w = 0;
    for (let k = -R; k <= R; k++) { const j = clamp(i + k, 0, n - 1), g = Math.exp(-(k * k) / (2 * sig * sig)); a += raw[j] * g; w += g; }
    const s = JP.S[i];
    const prof = a / w + 0.3 * Math.sin(s * 0.085) * smooth(90, 110, s);
    const old = 0.45 * Math.sin(s * 0.085) * smooth(4, 20, s);
    out[i] = lerp(old, prof, smooth(66, 104, s));
  }
  return out;
})();
const pathW = s => 1 - smooth(S.RIM - 14, S.RIM - 2, s);

// ------------------------------------------------------------------ the stream: from the plunge pool under the waterfall,
// down the upper course beside the route, over the ford, east and then south past the camp (the old course, unchanged
// from z -40 on)
export const streamX = z => 10 + 2.5 * Math.sin(z / 14);
const ZJ = -118;
const oldBed = z => z >= -40 ? -0.75 - 0.012 * z : -0.27 + 0.002 * (-40 - z);
const ST = (() => {
  // (an S-bend before the ford, so the water crosses the way square on)
  const up = [P.CLIFF_POOL, [-215, -252], [-190, -239], [-160, -216], [-130, -200], [-100, -180], [-81, -159], [-74, -146.5],
    [-66, -141.5], P.FORD, [-49, -149.9], [-35, -146], [-18, -138.5], [-2, -132], [streamX(ZJ), ZJ], [streamX(ZJ + 10), ZJ + 10]];
  const C = catmull2(up, 1);
  const X = [], Z = [];
  for (let i = 0; i < C.X.length && C.Z[i] < ZJ - 0.5; i++) { X.push(C.X[i]); Z.push(C.Z[i]); }
  const iJ = X.length;
  for (let z = ZJ; z <= 96.01; z += 1) { X.push(streamX(z)); Z.push(z); }
  const L = withArc({ X, Z });
  L.iJ = iJ;
  return L;
})();
const SG = gridOf(ST, 16, 44), SGn = gridOf(ST, 8, 13);
export const STREAM_Z = [-128, 66];      // (legacy: the old course's extent)
export const STREAM_LEN = ST.length;
/** nearest point of the stream's centre line: { d (Infinity beyond ~44 m), s (from the source), i } */
export function streamDist(x, z) { return nearestOn(ST, SG, x, z); }
export function streamPoint(s) { const p = pointAt(ST, s); return [p[0], p[1]]; }

// the ground along the path once the path and the camp are worked in (what the stream's bed must stay under)
function heightNoStream(x, z) {
  let h = preH(x, z);
  const tr = nearestOn(JP, JGn, x, z);
  if (tr.d < 11) h = lerp(h, sampleArr(JP, PATH_Y, tr.s), (1 - smooth(2.5, 11, tr.d)) * 0.92 * pathW(tr.s));
  const dc = Math.hypot(x - P.CAMP[0], z - P.CAMP[1]);
  if (dc < 20) h = lerp(h, 0.12 * (fbm(x * 0.2 + 5, z * 0.2, 2) - 0.5), 1 - smooth(12.5, 20, dc));
  return h;
}
// the bed: never rising downstream, under the banks (the lowest ground across the channel), meeting the old course
const BED = (() => {
  const n = ST.X.length, bed = new Float32Array(n), iJ = ST.iJ;
  const low = i => {
    const x = ST.X[i], z = ST.Z[i], j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1);
    const tx = ST.X[j] - ST.X[k], tz = ST.Z[j] - ST.Z[k], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
    let m = heightNoStream(x, z);
    for (const o of [-3, 3]) m = Math.min(m, heightNoStream(x + nx * o, z + nz * o));
    return m;
  };
  bed[0] = low(0) - 1.7;
  for (let i = 1; i < iJ; i++) bed[i] = Math.min(bed[i - 1] - 0.0012 * (ST.S[i] - ST.S[i - 1]), low(i) - 0.85);
  let f = oldBed(ZJ);
  for (let i = iJ - 1; i >= 0; i--) { f += 0.0012 * (ST.S[i + 1] - ST.S[i]); bed[i] = Math.max(bed[i], f); }
  for (let i = iJ; i < n; i++) bed[i] = oldBed(ST.Z[i]);
  // a gentle cascade where the water leaves the pool
  return bed;
})();
const bedAt = s => sampleArr(ST, BED, s);
const S_FORD_ST = nearestOn(ST, SG, P.FORD[0], P.FORD[1]).s;
const depthAt = s => 0.38 - 0.12 * Math.exp(-Math.pow((s - S_FORD_ST) / 5, 2));
/** the water surface at arc length s along the stream */
export const waterAt = s => bedAt(s) + depthAt(s);
/** legacy: the water surface on the old course (z >= -118) by z */
export const waterY = z => oldBed(z) + 0.38;
const POOL_R = 4.6;

// ------------------------------------------------------------------ height field
export function heightAt(x, z) {
  let h = preH(x, z);
  // the journey path: a worn way through the trees
  const tr = nearestOn(JP, JGn, x, z);
  if (tr.d < 11) h = lerp(h, sampleArr(JP, PATH_Y, tr.s), (1 - smooth(2.5, 11, tr.d)) * 0.92 * pathW(tr.s));
  // camp clearing: flat within ~12 m
  const dc = Math.hypot(x - P.CAMP[0], z - P.CAMP[1]);
  if (dc < 20) h = lerp(h, 0.12 * (fbm(x * 0.2 + 5, z * 0.2, 2) - 0.5), 1 - smooth(12.5, 20, dc));
  // the stream valley, the camp's pool and the plunge pool under the waterfall
  const st = nearestOn(ST, SGn, x, z);
  if (st.d < 12.5) {
    const end = 1 - smooth(STREAM_Z[1], STREAM_Z[1] + 30, z);
    const b = bedAt(st.s), d = st.d;
    const pr = Math.hypot(x - P.POOL[0], z - P.POOL[1]);
    const tgt = b + 0.75 * smooth(0.7, 2.4, d) + Math.max(0, d - 6) * 0.07 - 0.75 * Math.exp(-pr * pr / 6.5);
    const wgt = (1 - smooth(3.5, 12, d)) * end;
    h = lerp(h, tgt, Math.max(wgt, (1 - smooth(2.5, 4.5, pr))));
  }
  const cp = Math.hypot(x - P.CLIFF_POOL[0], z - P.CLIFF_POOL[1]);
  if (cp < 12) {
    const b = BED[0];
    const bowl = cp < POOL_R ? -0.5 * (1 - (cp / POOL_R) ** 2) : 0;
    h = lerp(h, b + bowl + 1.1 * smooth(POOL_R - 0.8, POOL_R + 2.5, cp), 1 - smooth(POOL_R + 2, 12, cp));
  }
  return h;
}
export const groundY = heightAt;

// where the walker's feet go: the ground, or the stepping stones over the ford
export const FORD_W = 3.2;
export function walkY(x, z) {
  const h = heightAt(x, z);
  const tr = nearestOn(JP, JGn, x, z);
  if (Math.abs(tr.s - S.FORD) < 6 && tr.d < 1.6) {
    const st = nearestOn(ST, SGn, x, z);
    if (st.d < FORD_W) return Math.max(h, waterAt(st.s) + 0.1 * (1 - smooth(FORD_W - 0.6, FORD_W, st.d)));
  }
  return h;
}

// path / moss / litter / rock masks for the floor shader
const NOOK = (() => { const dx = P.LAND[0] - P.ANCIENT[0], dz = P.LAND[1] - P.ANCIENT[1], l = Math.hypot(dx, dz); return [P.ANCIENT[0] + dx / l * 3.2, P.ANCIENT[1] + dz / l * 3.2]; })();
const WORN = [[NOOK[0], NOOK[1], 2.3, 0.55], [P.FIRE[0], P.FIRE[1], 3.2, 0.8], [P.ROCK[0] - 2, P.ROCK[1] + 2, 3, 0.55], [P.HOME[0] + 1.5, P.HOME[1] + 2.6, 3, 0.6], [P.RANGE[0], P.RANGE[1], 2.2, 0.4], [P.MEDITATE[0], P.MEDITATE[1], 1.6, 0.45], [8.2, -1.2, 2.6, 0.45], [P.TALLY[0] + 1, P.TALLY[1] - 1, 1.5, 0.4], [P.MEMORIAL[0] + 0.6, P.MEMORIAL[1] + 0.6, 1.4, 0.4]];
export function maskAt(x, z) {
  const tr = nearestOn(JP, JGn, x, z);
  const old = oldK(x, z);
  // the worn way: plain near the camp, fainter (moss creeping over it) in the old wood, gone on the dell's slope
  let path = tr.d < 11 ? (1 - smooth(0.55, 1.35 - 0.25 * old, tr.d)) * (0.85 - 0.3 * old) * (1 - smooth(S.RIM - 6, S.RIM + 2, tr.s)) : 0;
  const dc = Math.hypot(x, z);
  if (dc < 6) path = Math.max(path, (1 - smooth(1.2, 4.2, dc)) * (0.35 + 0.3 * fbm(x * 0.3, z * 0.3, 2)));
  for (const [wx, wz, r, k] of WORN) { const dd = Math.hypot(x - wx, z - wz); if (dd < r) path = Math.max(path, (1 - smooth(r * 0.45, r, dd)) * k); }
  const st = nearestOn(ST, SGn, x, z);
  let moss = 0.3 + 0.45 * (st.d < 9 ? 1 - smooth(2, 9, st.d) : 0);
  // the old forest: moss over everything, less leaf litter
  moss = Math.max(moss, 0.3 + 0.42 * old * (1 - path * 0.6));
  moss = Math.max(moss, (1 - smooth(10, 15, dc)) * (0.62 - path * 0.5));
  let litter = (0.3 + 0.35 * (tr.d < 14 ? 1 - smooth(3, 14, tr.d) : 0)) * (1 - 0.45 * old);
  let rock = 0;
  const D = dell(x, z);
  if (D && D.r < D.rRim + 4) {
    const inside = 1 - smooth(D.rFloor - 2, D.rFloor + 1, D.r);
    moss = Math.max(moss, 0.55 * inside + 0.25);
    litter = Math.max(litter, 0.55 * inside + 0.35 * D.se);
    rock = (1 - D.se) * smooth(D.rFloor, D.rFloor + 2, D.r) * (1 - smooth(D.rRim, D.rRim + 3, D.r)) * 0.6;
  }
  // scree and wet stone at the wall's foot and around the plunge pool
  const w = wallSide(x, z);
  if (w.d < 14) rock = Math.max(rock, 0.75 * (1 - smooth(1, 12, w.d)) * (w.end ? 1 - smooth(2, 10, w.d) : 1));
  const cp = Math.hypot(x - P.CLIFF_POOL[0], z - P.CLIFF_POOL[1]);
  if (cp < 10) { rock = Math.max(rock, 0.6 * (1 - smooth(POOL_R, 9, cp))); moss = Math.max(moss, 0.8 * (1 - smooth(POOL_R + 1, 10, cp))); }
  return [path, clamp(moss), clamp(litter), rock];
}

// ------------------------------------------------------------------ terrain: tiles along the route + a coarse basin
// 64 m tiles wherever the route, the camp, the dell or the wall's foot can be seen from the ground, each with a fine and
// a coarse mesh (switched by distance, update(camera)); one coarse sheet for the rest of the basin with holes under them
const TILE = 64, TO = -448;
export function buildTerrain(quality = {}) {
  const mat = floorMaterial();
  const group = new THREE.Group(); group.name = 'terrain';
  const lo = !!quality.low;
  const tiles = [], keys = new Set();
  for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) {
    const x0 = TO + i * TILE, z0 = TO + j * TILE, cx = x0 + TILE / 2, cz = z0 + TILE / 2;
    const dr = routeDist(cx, cz), dcamp = Math.hypot(cx, cz), dd = Math.hypot(cx - DC[0], cz - DC[1]);
    if (!(dr < 80 || dcamp < 84 || dd < 78)) continue;
    keys.add(i + ',' + j);
    const near = dr < 50 || dcamp < 60 || dd < 56;
    const res = (near ? 0.82 : 1.5) * (lo ? 1.5 : 1);
    const n = Math.round(TILE / res);
    const fine = new THREE.Mesh(terrainGeometry(x0, z0, x0 + TILE, z0 + TILE, n, n, heightAt, maskAt, { skirt: 3 }), mat);
    const nc = lo ? 12 : 18;
    const coarse = new THREE.Mesh(terrainGeometry(x0, z0, x0 + TILE, z0 + TILE, nc, nc, heightAt, maskAt, { skirt: 4, yOff: -0.05 }), mat);
    fine.receiveShadow = coarse.receiveShadow = true;
    fine.name = `terrain-${i}-${j}`; coarse.name = `terrainC-${i}-${j}`;
    coarse.visible = false;
    group.add(fine, coarse);
    tiles.push({ fine, coarse, cx, cz, cy: heightAt(cx, cz) });
  }
  const inTiles = (x, z) => keys.has(Math.floor((x - TO) / TILE) + ',' + Math.floor((z - TO) / TILE));
  const span = 2600, N = lo ? 110 : 160;
  const cx = P.BASIN[0], cz = P.BASIN[1];
  const hc = span / N / 2 + 0.6;
  const keep = (x, z) => !(inTiles(x - hc, z - hc) && inTiles(x + hc, z - hc) && inTiles(x - hc, z + hc) && inTiles(x + hc, z + hc));
  const far = terrainGeometry(cx - span / 2, cz - span / 2, cx + span / 2, cz + span / 2, N, N, heightAt, (x, z) => [0, 0.4 + 0.3 * oldK(x, z), 0.3, 0], { keep, yOff: -0.3 });
  const fm = new THREE.Mesh(far, mat);
  fm.receiveShadow = true; fm.name = 'terrain-far';
  group.add(fm);
  const update = (camera, flying = false) => {
    if (!camera) return;
    const p = camera.position;
    for (const t of tiles) {
      const d = Math.hypot(p.x - t.cx, p.z - t.cz, (p.y - t.cy) * 0.5);
      const fine = d < (flying ? 170 : 210);
      t.fine.visible = fine; t.coarse.visible = !fine;
    }
  };
  return { group, tiles, far: fm, material: mat, update };
}

// ------------------------------------------------------------------ water
export function waterMaterial({ fall = false } = {}) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: !fall, fog: true, side: fall ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uDeep: { value: new THREE.Color(0x0b1a16) }, uShallow: { value: new THREE.Color(0x3d5a4a) }, uSky: { value: new THREE.Color(0xb8c8cc) } }]),
    vertexShader: `varying vec2 vUv; varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: fall ? `uniform float uTime, uSnow, uFogK; uniform sampler2D uNoise; varying vec2 vUv; varying vec3 vW;
#include <fog_pars_fragment>
void main(){
  float n1 = texture2D(uNoise, vec2(vUv.x*1.7, vUv.y*.5 + uTime*.9)).r, n2 = texture2D(uNoise, vec2(vUv.x*4.3 + .3, vUv.y*1.3 + uTime*1.9)).g;
  float n3 = texture2D(uNoise, vec2(vUv.x*.9 + .7, vUv.y*.2 + uTime*.25)).b;
  float edge = smoothstep(0., .3 + n3*.2, vUv.x)*smoothstep(1., .7 - n3*.2, vUv.x);
  float streak = smoothstep(.3, .8, n1*.6 + n2*.55);
  vec3 col = mix(vec3(.6, .66, .68), vec3(.97, .98, 1.), streak);
  float a = (.3 + .65*streak)*edge*smoothstep(0., .05, 1. - vUv.y)*(.6 + .4*smoothstep(0., .25, vUv.y));
  a *= 1. - uSnow*.55;
  col = mix(col, vec3(.85, .9, .95), uSnow*.6);
  gl_FragColor = vec4(col, a);
  vec3 flPre = gl_FragColor.rgb;
  #include <fog_fragment>
  // white water carries through the haze better than the rock around it
  gl_FragColor.rgb = mix(flPre, gl_FragColor.rgb, uFogK);
}` : `uniform float uTime, uSnow, uAutumn; uniform sampler2D uNoise; uniform vec3 uDeep, uShallow, uSky, uSunDirW, uSunColW; varying vec2 vUv; varying vec3 vW;
#include <fog_pars_fragment>
void main(){
  vec3 V = normalize(cameraPosition - vW);
  vec2 p = vec2(vUv.x*.6, vUv.y*.35 - uTime*.45*(1. - uSnow*.9));
  float r1 = texture2D(uNoise, p*.5).a, r2 = texture2D(uNoise, p*1.3 + .37).g, r3 = texture2D(uNoise, vW.xz*.6 + uTime*.03).r;
  vec3 N = normalize(vec3((r1 - .5)*.35 + (r3 - .5)*.2, 1., (r2 - .5)*.35));
  float fres = pow(clamp(1. - dot(N, V), 0., 1.), 4.)*.85 + .06;
  float edge = abs(vUv.x*2. - 1.);
  vec3 col = mix(uDeep, uShallow, smoothstep(.55, 1., edge)*.7 + r1*.15);
  col = mix(col, uSky, fres);
  vec3 L = normalize(uSunDirW);
  float spec = pow(max(dot(reflect(-V, N), L), 0.), 120.)*2.5 + pow(max(dot(reflect(-V, N), L), 0.), 18.)*.25;
  col += uSunColW*spec*(1. - uSnow*.8);
  col += smoothstep(.72, .9, r2*.6 + r1*.5)*.08*(1. - uSnow);
  // winter: ice along the banks, the current open and dark down the middle (a line of ink through the snow)
  col = mix(col, vec3(.82, .87, .92)*(.85 + .15*r1), uSnow*.85*smoothstep(.5, .92, edge + (r2 - .5)*.25));
  col *= 1. - uSnow*.35*(1. - smoothstep(.4, .8, edge));
  float a = mix(.9, 1., uSnow)*smoothstep(1., .82, edge);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`,
  });
  Object.assign(m.uniforms, FOGU, { uTime: U.uTime, uNoise: U.uNoise, uSnow: U.uSnow, uAutumn: U.uAutumn, uSunDirW: FOGU.cfFogSunDir, uSunColW: FOGU.cfFogSunCol, uFogK: { value: fall ? 0.55 : 1 } });
  return m;
}

function ribbon(points, widthFn) {
  const pos = [], uv = [], idx = [];
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[Math.min(points.length - 1, i + 1)], o = points[Math.max(0, i - 1)];
    const dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l, w = widthFn(i, p);
    if (i) s += p.distanceTo(points[i - 1]);
    for (const sd of [-1, 1]) { pos.push(p.x + nx * w * sd, p.y, p.z + nz * w * sd); uv.push(sd < 0 ? 0 : 1, s / 4); }
    // (wound to face up: the stream is front-face only)
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export function buildWater() {
  const group = new THREE.Group(); group.name = 'water';
  const pts = [], ss = [];
  for (let s = 0; s <= ST.length; s += 1.1) {
    const [x, z] = streamPoint(s);
    if (z > STREAM_Z[1]) break;
    const pk = z > -20 ? Math.exp(-Math.pow((z - P.POOL[1]) / 2.8, 2)) : 0;
    pts.push(new THREE.Vector3(lerp(x, P.POOL[0], pk * 0.8), waterAt(s) - pk * 0.02, z));
    ss.push(s);
  }
  const g = ribbon(pts, (i, p) => {
    const z = p.z, s = ss[i], pk = z > -20 ? Math.exp(-Math.pow((z - P.POOL[1]) / 2.8, 2)) : 0;
    const ends = 1 - smooth(STREAM_Z[1] - 8, STREAM_Z[1], z);
    const ford = Math.exp(-Math.pow((s - S_FORD_ST) / 6, 2));
    const src = 1 - smooth(2, 12, s);
    return (1.75 + 0.35 * Math.sin(s * 0.17) + pk * 1.6 + ford * 0.7 + src * 1.2) * (0.4 + 0.6 * ends);
  });
  const mat = waterMaterial();
  const stream = new THREE.Mesh(g, mat);
  stream.renderOrder = 2; stream.name = 'stream'; stream.receiveShadow = false;
  group.add(stream);
  // the plunge pool
  const pool = new THREE.Mesh(new THREE.CircleGeometry(POOL_R + 0.6, 40).rotateX(-Math.PI / 2), mat);
  pool.position.set(P.CLIFF_POOL[0], waterAt(0) + 0.005, P.CLIFF_POOL[1]);
  const puv = pool.geometry.attributes.uv;
  for (let i = 0; i < puv.count; i++) puv.setXY(i, 0.5, puv.getY(i) * 3);
  pool.renderOrder = 2; pool.name = 'cliffPool';
  group.add(pool);
  return { group, stream, pool, material: mat };
}

// ------------------------------------------------------------------ debugging / tools
export const _debug = { JP, ST, BED, PATH_Y, H0, preH, heightNoStream, S_FORD_ST };
