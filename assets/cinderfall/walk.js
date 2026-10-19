// The walk out of the village, the last ordinary morning: from the dog at the foot of his uncle's steps up the whole
// street to the gate, in one unbroken take. He walks it at a walker's pace on Watch's own clock (so a stride is a
// stride however the story is paced), stopping where the morning stops him: the smith's stall, where only he sees
// the iron burn; Auntie Mei's terrace, where the bun she holds out goes to the dog; short of the gate, where the dog
// sits down in his way.
//
// Everything here is a pure function of the story position u, through the Watch time t it is reached at (score.js
// watchT): t seconds since the walk began. The engine puts him on this path (valleyP), turns him along it (valleyHeading)
// and follows him down it with the camera (walkCam); the dog, the bun and the people of the street key to its beats.
import { watchT } from './score.js';
import { roadX } from './layout.js';
import { clamp, lerp, smooth } from './util.js';

// the walk, in story positions: from the moment he is up from the dog to the dip into the page past the gate
export const WALK = { u0: 21.85, u1: 35.75 };
export const wt = u => watchT(u) - watchT(WALK.u0);
// (and back: the story position at walk time t)
export function walkU(t) {
  let a = WALK.u0 - 2, b = WALK.u1 + 2;
  for (let i = 0; i < 44; i++) { const m = (a + b) / 2; if (wt(m) < t) a = m; else b = m; }
  return (a + b) / 2;
}

// ---------------------------------------------------------------- the way he goes (x, z), leg by leg, stop to stop
// A: up the street past the laundry and the children, to the smith's stall on the right (he stops facing the sword on
// its stand). B: on up the street, drifting across it to Auntie Mei's terrace on the left (he stops facing her).
// C: on to the gate, back to the middle of the way (stops where the dog sits down in front of him, GATE_STOP).
// D: round the dog to its left, out under the gate and on along the road.
const GATE_STOP = { z: -36.9, x: 0.45 };
const gx = roadX(GATE_STOP.z) + GATE_STOP.x;
const LEGS = [
  { id: 'A', pts: [[0.48, 41.4], [0.56, 38.6], [0.95, 34.0], [1.6, 29.0], [2.05, 24.5], [2.12, 20.6], [2.3, 17.2], [2.95, 14.75]], v: 1.6, ta: 1.0, td: 1.6 },
  { id: 'B', pts: [[2.95, 14.75], [2.6, 12.6], [1.95, 8.8], [1.15, 3.6], [-0.1, -1.5], [-1.65, -5.6], [-2.95, -7.9]], v: 1.6, ta: 1.3, td: 1.5 },
  { id: 'C', pts: [[-2.95, -7.9], [-2.35, -10.4], [-1.1, -14.4], [-0.1, -20.5], [0.3, -27.5], [gx, -33.4], [gx, GATE_STOP.z]], v: 1.65, ta: 1.3, td: 1.7 },
  { id: 'D', pts: [[gx, GATE_STOP.z], [gx - 0.55, -37.35], [gx - 0.72, -38.3], [gx - 0.55, -39.8], [roadX(-42) - 0.15, -42.0], [roadX(-45) - 0.3, -45.0], [roadX(-49) - 0.5, -49.0]], v: 1.35, ta: 1.6, td: 0 },
];
// how long he stays at each stop (s): the smith's stall, the terrace, the dog in his way
const STOPS = { S: 8.6, M: 6.2, G: 5.2 };
// centripetal Catmull-Rom through 2D points, sampled into an arc-length table
function chain(pts) {
  const P = [pts[0].map((v, i) => 2 * v - pts[1][i]), ...pts, pts[pts.length - 1].map((v, i) => 2 * v - pts[pts.length - 2][i])];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const N = 60;
    for (let k = i === 1 ? 0 : 1; k <= N; k++) {
      const t = t1 + (t2 - t1) * k / N;
      const L = (a, b, ta, tb) => a.map((v, j) => ((tb - t) * v + (t - ta) * b[j]) / (tb - ta));
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      out.push(L(B1, B2, t1, t2));
    }
  }
  const s = [0];
  for (let i = 1; i < out.length; i++) s.push(s[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { xy: out, s, len: s[s.length - 1] };
}
function onChain(c, s) {
  s = clamp(s, 0, c.len);
  let lo = 0, hi = c.s.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c.s[m] < s) lo = m; else hi = m; }
  const k = c.s[hi] > c.s[lo] ? (s - c.s[lo]) / (c.s[hi] - c.s[lo]) : 0;
  const a = c.xy[lo], b = c.xy[hi];
  const dx = b[0] - a[0], dz = b[1] - a[1], dl = Math.hypot(dx, dz) || 1;
  return { x: lerp(a[0], b[0], k), z: lerp(a[1], b[1], k), dx: dx / dl, dz: dz / dl };
}
// a leg's distance covered t seconds into it: up to its pace over ta, at it, and down to a stop over td (each ramp an
// ease, so he never lurches into a stride or out of one)
function profile(len, v, ta, td) {
  const T = len / v + (ta + td) / 2, dt = 0.01, s = [0];
  for (let t = dt; t <= T + 1e-9; t += dt) {
    const r = smooth(0, ta, t) * (td > 0 ? 1 - smooth(T - td, T, t) : 1);
    s.push(s[s.length - 1] + v * r * dt);
  }
  const k = len / s[s.length - 1];
  return { T, at: t => { const i = clamp(t / dt, 0, s.length - 1), i0 = Math.floor(i), i1 = Math.min(s.length - 1, i0 + 1); return lerp(s[i0], s[i1], i - i0) * k; }, v: v * k };
}
// the walk's timetable: each leg's start and end in walk time, and the stops between
export const BEAT = (() => {
  const legs = LEGS.map(L => { const c = chain(L.pts); return { ...L, c, pf: profile(c.len, L.v, L.ta, L.td) }; });
  let t = 0;
  const B = { legs };
  for (const L of legs) {
    L.t0 = t; L.t1 = t + L.pf.T; t = L.t1;
    if (L.id === 'A') { B.smith = t; t += STOPS.S; B.smithOff = t; }
    if (L.id === 'B') { B.mei = t; t += STOPS.M; B.meiOff = t; }
    if (L.id === 'C') { B.gate = t; t += STOPS.G; B.gateOff = t; }
  }
  // (leg D runs on past the dip into the page: the walk ends where it peaks, 5 s after he leaves the dog)
  B.end = B.gateOff + 5.0;
  return B;
})();
// where he is at walk time t: { x, z, dx, dz (the way he is going), speed (m/s), leg, k (how far through the leg) }
const _w = { x: 0, z: 0, dx: 0, dz: -1, speed: 0, leg: 'A', k: 0 };
export function walkAt(t) {
  const legs = BEAT.legs;
  let L = legs[0];
  for (const l of legs) if (t >= l.t0) L = l;
  const tt = clamp(t - L.t0, 0, L.pf.T + (L.id === 'D' ? 1e9 : 0));
  // (leg D goes on at its pace past its last point, along the road)
  const s = L.id === 'D' && tt > L.pf.T ? L.c.len + (tt - L.pf.T) * L.pf.v : L.pf.at(tt);
  const p = onChain(L.c, s);
  const ds = L.pf.at(tt + 0.05) - L.pf.at(Math.max(0, tt - 0.05));
  Object.assign(_w, p, { speed: tt > 0 && tt < L.pf.T ? ds / Math.min(0.1, tt + 0.05) : 0, leg: L.id, k: clamp(tt / L.pf.T) });
  return _w;
}
// beats in walk time, smooth up and down: band(a, b, c, d, t), relative to a beat
export const tband = (a, b, c, d, t) => smooth(a, b, t) * (1 - smooth(c, d, t));
// the walk on Watch's clock at story position u (null outside the walk)
export const inWalk = u => u >= WALK.u0 && u < WALK.u1;
