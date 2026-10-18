// The war above the clouds, close to: the two who fight there, as people, and what they throw at each other.
//
// The gold one: white robes and a gold sash, his hair bound up, a straight sword; over him, as he gathers himself, a
// sword of light a quarter of a kilometre long. The masked one of Fen Tian Zong: the sect's black robes, deep hood and
// mantle, the angular iron mask with violet slits, a glaive; round him the sect's violet lightning.
// They face each other over the sea of clouds; they meet, and the shock of it tears a ring out of the sea; he cuts, and
// the crescent of light his great sword throws is split on the glaive, its halves carving two trenches into the sea
// behind; the masked one calls the storm down on him and the bell of light he raises breaks under it; they lock, and the
// light pressed out of the lock blows the sea down under them; it bursts, and the glaive comes down.
//
// Everything here is laid on the story (u): where the two are, how they stand, what they throw, where the lens is
// (shot). The engine fires the blows as the story crosses them (BLOWS), and plays them on the clock.
import * as THREE from 'three';
import { makePerson } from './people3d.js';
import { sectGarb, SECT_ROBES } from './sect.js';
import { aimQuat } from './hero-rig.js';
import { createQi } from './qi.js';
import { U } from './materials.js';
import { clamp, lerp, smooth, band, curveMono } from './util.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// the war, close to: from the cut to the two of them facing each other, to the smash
export const WAR = [49.35, 52.47];
// the frame it is laid out in: its centre, the line from the gold one to the masked one, and across it, away from the
// lens that first sees them (toward the far peaks)
export const W0 = V3(-1302, 2950, 713);
const AX = V3(0.43, 0, 0.9).normalize(), NX = V3(-0.9, 0, 0.43).normalize(), UPV = V3(0, 1, 0);
export const L = (a, y, n, out = V3()) => out.copy(W0).addScaledVector(AX, a).addScaledVector(UPV, y).addScaledVector(NX, n);
// the sea's top under the fight, about (relative to the centre)
const SEA_Y = 2440 - W0.y;
const RATE = 0.2;   // story a second while the war plays (Watch's pace here, timeline.js PACE)

// ------------------------------------------------------------------ where the two are
// [u, along the line, up, across]
const path = keys => {
  const fa = curveMono(keys.map(k => [k[0], k[1]])), fy = curveMono(keys.map(k => [k[0], k[2]])), fn = curveMono(keys.map(k => [k[0], k[3]]));
  return (u, out = V3()) => L(fa(u), fy(u), fn(u), out);
};
// (the meetings: the two a weapon's length apart, the dash to them all but instant)
const GOLD = path([
  [49.0, -150, 0, 0], [50.17, -150, 4, 0], [50.205, -157, 2, 0], [50.25, -1.25, 1, 0],
  [50.3, -70, 14, 14], [50.45, -138, 22, 26], [50.63, -150, 22, 28], [51.5, -146, 18, 22], [51.525, -151, 16, 22],
  [51.555, -1.15, 40, 0], [52.08, -1.4, 46, -12], [52.12, -30, 30, -8], [52.3, -34, 14, -6], [52.47, -30, 5, -5], [53, -30, 5, -5]]);
const MASKED = path([
  [49.0, 150, 8, 0], [50.17, 150, 9, 0], [50.205, 157, 9, 0], [50.25, 1.25, 1, 0],
  [50.3, 64, 24, -12], [50.45, 136, 30, -24], [50.63, 150, 30, -25], [51.15, 150, 30, -25], [51.3, 142, 86, -14], [51.5, 138, 98, -12],
  [51.525, 143, 100, -12], [51.555, 1.15, 42, 0], [52.08, 1.4, 50, -12], [52.12, 22, 96, -10], [52.33, -24, 150, -6], [52.43, -28, 60, -5],
  [52.47, -29, 17, -5], [52.9, -40, 160, 10]]);
// (each hangs in the air, rising and falling a little, never quite still)
const bob = (t, s) => V3(Math.sin(t * 0.7 + s) * 0.35, Math.sin(t * 1.1 + s * 2) * 0.55, Math.cos(t * 0.6 + s) * 0.35);
export const goldAt = (u, out = V3()) => GOLD(u, out);
export const maskedAt = (u, out = V3()) => MASKED(u, out);

// ------------------------------------------------------------------ the blows: [u, kind, where, size]
// kind: the duel's (duel.js BLOW) and the war's own: 6 the crescent thrown, 7 the crescent split, 8 lightning on the bell
export const BLOWS = [
  { u: 50.25, kind: 5, at: u => L(0, 1.5, 0), crater: [0, 0, 1.9, 2.2], frame: 0.06, bolts: 3, shake: 1.6 },
  { u: 50.742, kind: 6, at: u => GOLD(50.742).addScaledVector(AX, 14).add(V3(0, 2, 0)), shake: 0.4 },
  { u: 50.95, kind: 7, at: u => MASKED(50.95).addScaledVector(AX, -5).add(V3(0, 1.2, 0)), frame: 0.045, bolts: 1, shake: 1.2 },
  ...[51.262, 51.292, 51.322, 51.354, 51.384, 51.418, 51.448, 51.47].map((u, i) => ({ u, kind: 8, i, at: () => boltHit(i), shake: 0.35 + (i === 7 ? 0.4 : 0) })),
  { u: 51.555, kind: 5, at: u => L(0, 41, 0), crater: [0, 0, 1.6, 6.0], frame: 0.06, bolts: 2, shake: 1.5 },
  ...[51.62, 51.69, 51.76, 51.83, 51.9, 51.97, 52.03].map(u => ({ u, kind: 4, at: v => GOLD(v).lerp(MASKED(v), 0.5).add(V3(0, 1.3, 0)), shake: 0.25 })),
  { u: 52.1, kind: 5, at: u => L(0, 48, -12), crater: [0, -12, 2.4, 2.4], frame: 0.07, bolts: 3, shake: 2.0 },
];
// (the bolts the masked one calls down: from the dark over the fight onto the bell about the gold one)
const BELL_R = 30;
const BOLT_DIRS = [[-0.3, 0.9, -0.3], [0.5, 0.8, 0.3], [0.1, 0.95, 0.4], [-0.6, 0.7, 0.2], [0.7, 0.6, -0.3], [-0.2, 0.85, -0.5], [0.3, 0.9, -0.1], [0, 1, 0.1]].map(d => V3(...d).normalize());
const BOLT_U = [51.262, 51.292, 51.322, 51.354, 51.384, 51.418, 51.448, 51.47];
function boltHit(i, out = V3()) {
  const g = GOLD(BOLT_U[i]).add(V3(0, 1.1, 0)), d = BOLT_DIRS[i];
  return out.copy(g).addScaledVector(AX, d.x * BELL_R).addScaledVector(UPV, d.y * BELL_R).addScaledVector(NX, d.z * BELL_R);
}
// (first the storm answers his raised glaive, three bolts down onto its head; then it comes down on the bell)
export const GATHER_U = [51.172, 51.2, 51.232];
export const BOLTS = [
  ...GATHER_U.map((u, i) => ({ u, from: () => MASKED(u).add(V3((i - 1) * 150, 660, (i % 2 ? 1 : -1) * 110)), to: () => MASKED(u).add(V3(0, 2.4, 0)) })),
  ...BOLT_U.map((u, i) => ({ u, from: () => boltHit(i).addScaledVector(BOLT_DIRS[i], 700).add(V3((i % 3 - 1) * 120, 260, ((i * 7) % 5 - 2) * 90)), to: () => boltHit(i) })),
];
// the crescent: thrown out of the great sword's swing, flying down the line at the masked one; split on his glaive, its
// halves past him either side and down into the sea behind, where they cut two trenches
const CRES = { born: 50.735, hit: 50.95, R: 70, W: 18, tilt: 0.62 };
const cresAlong = u => lerp(-136, 145, smooth(CRES.born, CRES.hit, u) * 0.35 + clamp((u - CRES.born) / (CRES.hit - CRES.born)) * 0.65);
// (each half comes down into the sea a couple of hundred metres beyond him, off to its side, and runs on through it)
export const TRENCH = [1, -1].map(s => ({ a: L(345, SEA_Y, -s * 200), b: L(1900, SEA_Y, -s * 760), u0: 51.088, u1: 51.2 }));

// ------------------------------------------------------------------ the lens
// [from, to, where it is (u, k 0..1 through the shot), what it looks at, focal length]
const lerpV = (a, b, k) => a.clone().lerp(b, k);
const SHOTS = [
  // the two of them, facing each other over the sea, the far peaks beyond; his sword of light rising over him
  { id: 'standoff', u: [49.35, 49.53], pos: k => L(lerp(-4, 4, k), lerp(-36, -30, k), lerp(-560, -515, k)), look: k => L(0, lerp(52, 56, k), 0), fov: () => 40 },
  // behind the masked one, low on his right, at his shoulder: him dark against the far light of the other, the great
  // sword standing over it
  { id: 'masked', u: [49.53, 49.83], pos: (k, u) => MASKED(u).addScaledVector(AX, lerp(4.9, 4.3, k)).addScaledVector(NX, -1.4).add(V3(0, 0.25, 0)),
    look: (k, u) => MASKED(u).addScaledVector(AX, lerp(4.9, 4.3, k) - 40).addScaledVector(NX, -1.4 + 6.3).add(V3(0, 0.25 + 3.5, 0)), fov: () => 30 },
  // far below and behind him: small under the great sword as it forms over him, his blade raised before him
  { id: 'gold', u: [49.83, 50.17], pos: (k, u) => GOLD(u).addScaledVector(AX, lerp(-58, -50, k)).addScaledVector(NX, -20).add(V3(0, lerp(-26, -24, k), 0)),
    look: (k, u) => GOLD(u).addScaledVector(AX, 12).add(V3(0, 40, 0)), fov: () => 50 },
  // side on: they streak at each other and meet in front of the lens
  { id: 'charge', u: [50.17, 50.33], pos: k => L(4, lerp(9, 11, k), lerp(-118, -104, k)), look: () => L(0, 4, 0), fov: () => 46 },
  // high and far: the shock of it tearing a ring out of the sea
  { id: 'shock', u: [50.33, 50.63], pos: k => L(lerp(420, 390, k), lerp(640, 610, k), lerp(-1800, -1720, k)), look: k => L(0, lerp(-300, -320, k), 220), fov: () => 54 },
  // behind him, over his right shoulder: the great sword swings down past us, and throws its crescent down the line
  { id: 'release', u: [50.63, 50.86], pos: (k, u) => GOLD(u).addScaledVector(AX, lerp(-31, -28, k)).addScaledVector(NX, 6).add(V3(0, -4, 0)),
    look: (k, u) => GOLD(u).addScaledVector(AX, 30).add(V3(0, lerp(16, 6, smooth(0, 0.7, k)), 0)), fov: () => 50 },
  // behind the masked one, low: the crescent comes at him, at us; he splits it
  { id: 'split', u: [50.86, 51.13], pos: (k, u) => MASKED(u).addScaledVector(AX, lerp(36, 32, k)).addScaledVector(NX, -7).add(V3(0, -5, 0)), look: (k, u) => MASKED(u).addScaledVector(AX, -10).add(V3(0, 2.5, 0)), fov: () => 50 },
  // below the masked one as he rises, his glaive held up to the sky
  { id: 'summon', u: [51.13, 51.3], pos: (k, u) => MASKED(u).addScaledVector(AX, lerp(12, 10, k)).addScaledVector(NX, -9).add(V3(0, -11, 0)), look: (k, u) => MASKED(u).add(V3(0, 5, 0)), fov: () => 48 },
  // the lightning breaking on the bell of light about the gold one
  { id: 'bell', u: [51.3, 51.53], pos: k => GOLD(51.3).addScaledVector(AX, lerp(-100, -92, k)).addScaledVector(NX, lerp(-128, -118, k)).add(V3(0, -6, 0)), look: () => GOLD(51.3).add(V3(0, 26, 0)), fov: () => 48 },
  // over the gold one's left shoulder: the lock, the mask lit by the light of it
  { id: 'lock', u: [51.53, 51.83], pos: (k, u) => GOLD(u).addScaledVector(AX, lerp(-2.4, -2.1, k)).addScaledVector(NX, -1.25).add(V3(0, 0.6, 0)), look: (k, u) => MASKED(u).add(V3(0, 0.5, 0)).addScaledVector(NX, 0.35), fov: () => 34 },
  // from the far side, low: the light pressed out of the lock swelling between them, the sea blown down under it
  // (from below, so the light stands against the sky, not washed out against the sea's white)
  { id: 'lockwide', u: [51.83, 52.12], pos: k => L(36, lerp(-70, -62, k), lerp(360, 330, k)), look: () => L(0, 52, 0), fov: () => 50 },
  // below them: the masked one thrown up over him
  { id: 'thrown', u: [52.12, 52.36], pos: k => L(-70, lerp(-46, -42, k), lerp(-150, -140, k)), look: k => L(-26, lerp(60, 100, k), -5), fov: () => 52 },
  // beside the gold one, looking up: the masked one coming down on him, the glaive raised
  { id: 'smash', u: [52.36, WAR[1]], pos: (k, u) => GOLD(u).addScaledVector(NX, -4.5).addScaledVector(AX, -3.2).add(V3(0, -1.2, 0)), look: (k, u) => MASKED(u).lerp(GOLD(u), 0.25), fov: () => 52 },
];
const _sp = V3(), _sl = V3();
export function shot(u) {
  if (u < WAR[0] || u >= WAR[1]) return null;
  for (const s of SHOTS) {
    if (u < s.u[0] || u >= s.u[1]) continue;
    const k = (u - s.u[0]) / (s.u[1] - s.u[0]);
    return { id: s.id, pos: _sp.copy(s.pos(k, u)), look: _sl.copy(s.look(k, u)), fov: s.fov(k, u) };
  }
  return null;
}

// ------------------------------------------------------------------ how they stand
// Poses in the figure's own space (facing +z, its left +x, feet at y 0): the body's angles in degrees, and where the
// hands are. A hand holding a weapon: grip (the palm), B (which way the blade or the glaive's head points from it),
// pn (roughly which way the palm faces), pole (where the elbow goes). A free hand: fk [flex, abduct, twist, elbow].
// The masked one's left hand on the glaive is put on its shaft: two (metres down the shaft from the right hand).
const P_GOLD = {
  hover: { root: [4, 0, 0], spine: [3, 0, 0], chest: [-2, 0, 0], neck: [6, 0, 0], legs: [12, 26, 4, 12, 30, 36],
    R: { grip: [-0.3, 0.93, 0.17], B: [-0.25, -0.62, 0.74], pn: [1, 0, 0], pole: [-1, -0.3, -0.6] }, L: { fk: [58, 18, 0, 118] }, gripL: 'fist' },
  raise: { root: [2, 0, 0], spine: [2, 0, 0], chest: [-6, 0, 0], neck: [-12, 0, 0], legs: [10, 22, 2, 10, 30, 36],
    R: { grip: [-0.1, 1.42, 0.33], B: [0.04, 1, 0.08], pn: [1, 0, 0.1], pole: [-1, -0.6, 0.2] }, L: { grip: [0.02, 1.6, 0.37], fd: [0, 1, 0.1], pd: [-1, 0, 0], pole: [1, -0.5, 0.3] }, gripL: 'flat' },
  windup: { root: [-6, 0, 0], spine: [0, -12, 0], chest: [-8, -26, 0], neck: [2, 22, 0], legs: [16, 30, -6, 18, 30, 36],
    R: { grip: [-0.42, 1.66, -0.12], B: [-0.35, 0.56, -0.75], pn: [0.7, 0.3, 0.3], pole: [-1, 0.4, -0.5] }, L: { fk: [72, 40, 0, 60] }, gripL: 'flat' },
  slash: { root: [14, 0, 0], spine: [6, 14, 0], chest: [12, 24, 0], neck: [-10, -24, 0], legs: [30, 44, -14, 22, 30, 40],
    R: { grip: [0.3, 0.86, 0.44], B: [0.62, -0.5, 0.6], pn: [-0.4, 0.6, 0.5], pole: [-0.6, -0.6, 0.4] }, L: { fk: [-25, 52, 0, 30] }, gripL: 'flat' },
  bell: { root: [0, 0, 0], spine: [2, 0, 0], chest: [-4, 0, 0], neck: [-10, 0, 0], legs: [12, 24, 4, 12, 30, 36],
    R: { grip: [-0.38, 0.95, -0.12], B: [-0.25, -0.55, -0.8], pn: [1, 0, 0], pole: [-1, -0.2, -0.4] }, L: { grip: [0.2, 1.66, 0.42], fd: [0, 1, 0.25], pd: [0, 0.25, 1], pole: [1, -0.5, -0.3] }, gripL: 'flat' },
  dash: { root: [38, 0, 0], spine: [5, 0, 0], chest: [4, 0, 0], neck: [-28, 0, 0], legs: [-18, 42, -8, 64, 45, 50],
    R: { grip: [-0.2, 1.26, 0.5], B: [0.08, 0.1, 1], pn: [1, 0, 0], pole: [-1, -0.4, -0.2] }, L: { fk: [-42, 30, 0, 22] }, gripL: 'flat' },
  lock: { root: [10, 0, 0], spine: [10, 0, 0], chest: [8, 0, 0], neck: [-8, 0, 0], legs: [26, 42, -16, 22, 30, 36],
    R: { grip: [-0.05, 1.29, 0.42], B: [0.12, 0.45, 0.88], pn: [1, 0, -0.1], pole: [-1, -0.4, -0.3] }, L: { two: -0.095, pn: [-1, 0, 0], pole: [1, -0.4, -0.3] }, gripL: 'fist' },
  struck: { root: [-24, 0, 6], spine: [-16, 0, 0], chest: [-20, 0, 0], neck: [-26, 0, 0], legs: [32, 52, 20, 30, 40, 40],
    R: { fk: [125, 70, 0, 30] }, L: { fk: [104, 80, 0, 40] }, gripL: 'open' },
};
const P_MASKED = {
  hover: { root: [3, 0, 0], spine: [4, 0, 0], chest: [2, 0, 0], neck: [12, 0, 0], legs: [6, 10, 2, 6, 40, 40],
    R: { grip: [-0.32, 0.95, 0.05], B: [-0.25, -0.5, -0.83], pn: [1, 0, 0], pole: [-1, -0.2, -0.3] }, L: { fk: [12, 20, 0, 25] }, gripL: 'relaxed' },
  raise: { root: [-4, 0, 0], spine: [-2, 0, 0], chest: [-8, 0, 0], neck: [-16, 0, 0], legs: [8, 14, 2, 8, 40, 40],
    R: { grip: [-0.18, 2.0, 0.12], B: [0.05, 1, 0.2], pn: [1, 0, 0], pole: [-1, 0.3, -0.2] }, L: { fk: [76, 15, 0, 96] }, gripL: 'flat' },
  cutwind: { root: [4, 0, 0], spine: [6, -14, 0], chest: [4, -24, 0], neck: [0, 26, 0], legs: [14, 24, -4, 12, 40, 40],
    R: { grip: [-0.32, 1.0, -0.05], B: [-0.45, -0.55, -0.7], pn: [0.8, -0.2, 0.4], pole: [-1, -0.2, -0.4] }, L: { two: 0.46, pn: [-0.8, 0.2, -0.3], pole: [1, -0.5, 0.2] }, gripL: 'fist' },
  cut: { root: [8, 0, 0], spine: [-4, 14, 0], chest: [-6, 24, 0], neck: [-4, -22, 0], legs: [20, 30, -10, 16, 40, 40],
    R: { grip: [0.06, 1.42, 0.4], B: [0.45, 0.6, 0.66], pn: [0.6, -0.6, 0.3], pole: [-0.8, -0.6, 0.2] }, L: { two: 0.46, pn: [-0.6, 0.6, -0.3], pole: [1, -0.6, -0.2] }, gripL: 'fist' },
  dash: { root: [32, 0, 0], spine: [6, 0, 0], chest: [4, 0, 0], neck: [-24, 0, 0], legs: [-14, 40, -6, 60, 45, 50],
    R: { grip: [-0.26, 1.1, 0.38], B: [0.1, -0.08, 1], pn: [1, 0, 0], pole: [-1, -0.4, -0.2] }, L: { two: 0.46, pn: [-1, 0, 0], pole: [1, -0.5, -0.2] }, gripL: 'fist' },
  lock: { root: [10, 0, 0], spine: [10, 0, 0], chest: [8, 0, 0], neck: [-4, 0, 0], legs: [24, 40, -14, 20, 40, 40],
    R: { grip: [-0.3, 1.32, 0.38], B: [0.92, 0.32, 0.22], pn: [0, -0.6, -0.8], pole: [-1, -0.5, -0.4] }, L: { two: 0.55, th: -1, pn: [0, -0.6, -0.8], pole: [1, -0.5, -0.4] }, gripL: 'fist' },
  smashup: { root: [-12, 0, 0], spine: [-10, 0, 0], chest: [-12, 0, 0], neck: [-6, 0, 0], legs: [-10, 30, 10, 20, 40, 40],
    R: { grip: [-0.06, 2.0, -0.02], B: [0, 0.45, -0.89], pn: [1, 0, 0], pole: [-1, 0.6, 0] }, L: { two: 0.45, pn: [-1, 0, 0], pole: [1, 0.6, 0] }, gripL: 'fist' },
  smash: { root: [30, 0, 0], spine: [18, 0, 0], chest: [14, 0, 0], neck: [-12, 0, 0], legs: [-20, 50, 6, 30, 45, 45],
    R: { grip: [-0.04, 1.25, 0.5], B: [0, -0.55, 0.83], pn: [1, 0, 0], pole: [-1, -0.2, 0.2] }, L: { two: 0.45, pn: [-1, 0, 0], pole: [1, -0.2, 0.2] }, gripL: 'fist' },
};
// which pose when: [u, pose] (eased between neighbours over the span between them)
const SCHED_GOLD = [[49.0, 'hover'], [49.86, 'hover'], [50.02, 'raise'], [50.18, 'raise'], [50.215, 'dash'], [50.25, 'dash'], [50.3, 'struck'], [50.45, 'hover'],
  [50.66, 'hover'], [50.71, 'windup'], [50.735, 'slash'], [50.86, 'slash'], [51.0, 'hover'], [51.16, 'hover'], [51.21, 'bell'], [51.5, 'bell'], [51.53, 'dash'],
  [51.555, 'lock'], [52.08, 'lock'], [52.13, 'struck'], [52.3, 'hover'], [52.44, 'hover'], [52.47, 'struck']];
const SCHED_MASKED = [[49.0, 'hover'], [50.17, 'hover'], [50.21, 'dash'], [50.25, 'dash'], [50.32, 'hover'], [50.9, 'hover'], [50.935, 'cutwind'], [50.955, 'cut'],
  [51.1, 'cut'], [51.18, 'raise'], [51.48, 'raise'], [51.53, 'dash'], [51.555, 'lock'], [52.08, 'lock'], [52.2, 'smashup'], [52.42, 'smashup'], [52.47, 'smash'], [52.9, 'smash']];
function scheduleAt(S, u) {
  if (u <= S[0][0]) return [S[0][1], S[0][1], 0];
  for (let i = 0; i < S.length - 1; i++) if (u < S[i + 1][0]) return [S[i][1], S[i + 1][1], smooth(S[i][0], S[i + 1][0], u)];
  const l = S[S.length - 1][1];
  return [l, l, 0];
}

// ------------------------------------------------------------------ the weapons
// a straight sword along +y from the hand (the grip about y 0): the blade a flattened diamond tapering to a point,
// the guard, the grip, the pommel; uv.x across the blade (-1 edge, 0 ridge, 1 edge), uv.y along it (0 guard, 1 tip)
function swordGeometry({ L: len = 0.78, w = 0.022, t = 0.0045, guard = 0.1, grip = 0.19, rings = 18 } = {}) {
  const pos = [], uv = [];
  const y0 = 0.085;
  const ring = k => {
    const s = k / rings, y = y0 + s * len;
    const ww = w * (1 - 0.22 * s) * (s > 0.9 ? Math.sqrt(Math.max(0, 1 - (s - 0.9) / 0.1)) : 1);
    return [[-ww, y, 0, -1, s], [0, y, t, 0, s], [ww, y, 0, 1, s], [0, y, -t, 0, s]];
  };
  const quad = (a, b, c, d) => { for (const p of [a, b, c, a, c, d]) { pos.push(p[0], p[1], p[2]); uv.push(p[3], p[4]); } };
  for (let k = 0; k < rings; k++) {
    const A = ring(k), B = ring(k + 1);
    for (let j = 0; j < 4; j++) quad(A[j], A[(j + 1) % 4], B[(j + 1) % 4], B[j]);
  }
  // the guard, the grip and the pommel: boxes (uv.y below 0: not blade)
  const box = (cx, cy, cz, hx, hy, hz) => {
    const c = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([x, y, z]) => [cx + x * hx, cy + y * hy, cz + z * hz, x * 0.5, -0.5]);
    for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) quad(c[f[0]], c[f[1]], c[f[2]], c[f[3]]);
  };
  if (guard > 0) {
    box(0, y0 - 0.012, 0, guard / 2, 0.012, 0.017);
    box(0, y0 - 0.024 - grip / 2, 0, 0.014, grip / 2, 0.016);
    box(0, y0 - 0.03 - grip, 0, 0.022, 0.012, 0.022);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
// the glaive along +y from the right hand: the shaft from its butt (y -0.75) to the head (1.12), a broad curved blade
// above it with a spike at its back; groups: 0 the shaft and fittings, 1 the blade
function glaiveGeometry() {
  const parts = [];
  const shaft = new THREE.CylinderGeometry(0.017, 0.019, 1.9, 8, 1);
  shaft.translate(0, 0.185, 0);
  const butt = new THREE.ConeGeometry(0.026, 0.12, 8); butt.rotateX(Math.PI); butt.translate(0, -0.82, 0);
  const collar = new THREE.CylinderGeometry(0.03, 0.026, 0.09, 8); collar.translate(0, 1.16, 0);
  const s = new THREE.Shape();
  // (the blade: its edge along +x, swelling and sweeping back to a point; a notch and a spike on the back)
  s.moveTo(-0.02, 0); s.lineTo(0.05, 0.02);
  s.bezierCurveTo(0.12, 0.12, 0.13, 0.32, 0.07, 0.6);
  s.lineTo(-0.01, 0.48); s.lineTo(-0.03, 0.3); s.lineTo(-0.09, 0.24); s.lineTo(-0.035, 0.17); s.lineTo(-0.04, 0.04); s.lineTo(-0.02, 0);
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 1, curveSegments: 10 });
  blade.translate(0, 1.2, -0.004);
  const m = [shaft, butt, collar].map(g => g.toNonIndexed());
  const b = blade.toNonIndexed();
  const merge = list => {
    const n = list.reduce((a, g) => a + g.attributes.position.count, 0);
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2);
    let o = 0;
    for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) UV.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
    return { P, N, UV, n };
  };
  const A = merge(m), Bm = merge([b]);
  const g = new THREE.BufferGeometry();
  const P = new Float32Array((A.n + Bm.n) * 3), N = new Float32Array((A.n + Bm.n) * 3), UV = new Float32Array((A.n + Bm.n) * 2);
  P.set(A.P); P.set(Bm.P, A.n * 3); N.set(A.N); N.set(Bm.N, A.n * 3); UV.set(A.UV); UV.set(Bm.UV, A.n * 2);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.addGroup(0, A.n, 0);
  g.addGroup(A.n, Bm.n, 1);
  return g;
}

// ------------------------------------------------------------------ light: the great sword, the crescent, the bell
const ADD = { transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
const LIGHT_VS = `varying vec2 vQ; varying vec3 vN, vV, vL;
void main(){
  vQ = uv; vL = position;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
// (a sword of light: a seam of white running up it as it forms, its edges and ridge blazing, runes running up it)
const PHANTOM_FS = `uniform float uAmt, uForm, uTime, uHot; uniform vec3 uCol; uniform sampler2D uNoise, tSky; uniform vec2 uRes;
varying vec2 vQ; varying vec3 vN, vV, vL;
void main(){
  float s = vQ.x, v = vQ.y;
  float n = texture2D(uNoise, vec2(s * .3 + .1, v * 2.4 - uTime * .04)).r;
  float front = uForm * 1.14 - .07 + (n - .5) * .1;
  float vv = v < 0. ? 0. : v;
  if (vv > front) discard;
  float seam = exp(-pow((front - vv) / .014, 2.)) * 7. * step(uForm, .995);
  float fr = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.);
  float ridge = exp(-s * s * 160.) * 2.6;
  float edge = exp(-pow((1. - abs(s)) / .05, 2.)) * 4.2 + exp(-pow((1. - abs(s)) / .3, 2.)) * .45;
  float runes = smoothstep(.64, .74, texture2D(uNoise, vec2(s * .9 + .37, v * 7. - uTime * .55)).g) * (1. - abs(s) * .7) * .9;
  float flow = .65 + .35 * sin(v * 46. - uTime * 10.);
  // (the blade's own body is nearly clear: only its edges, its ridge and the runes in it burn)
  float body = v < 0. ? .03 + fr * 1.0 : .06 + .07 * n;
  float I = (body + fr * .4 * step(0., v) + (ridge + edge * flow + runes) * step(0., v)) * uAmt + seam * uAmt;
  vec3 c = mix(uCol, vec3(1., .92, .72), clamp(ridge * .3 + edge * .18 + seam * .2 + uHot * .6, 0., 1.));
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).g;
  gl_FragColor = vec4(c * I * (.35 + .65 * T), 1.);
}`;
// (the crescent: its leading edge white-hot, its body gold with streaks running back along it; one half or both)
const CRES_FS = `uniform float uAmt, uTime, uHalf, uSeed; uniform vec3 uCol; uniform sampler2D uNoise, tSky; uniform vec2 uRes;
varying vec2 vQ; varying vec3 vN, vV, vL;
void main(){
  float x = vQ.x, y = vQ.y;
  if (uHalf * y < 0.) discard;
  float ends = 1. - smoothstep(.55, 1., abs(y));
  float lead = exp(-pow((x - .6) / .16, 2.)) * 3.2;
  float body = exp(-pow((x + .1) / .55, 2.)) * .35;
  float n = texture2D(uNoise, vec2(y * 1.7 + uSeed, x * .4 - uTime * 1.6)).r;
  float st = smoothstep(.5, .85, texture2D(uNoise, vec2(y * 5.3 + uSeed, x * .12 + uTime * .4)).g) * smoothstep(.95, -.6, x) * .8;
  float cut = uHalf != 0. ? 1. - smoothstep(.0, .12, abs(y)) * 0. : 1.;
  float I = (lead + body * (.55 + .7 * n) + st) * ends * uAmt * cut;
  vec3 c = mix(uCol, vec3(1., .98, .93), clamp(lead * .22, 0., 1.));
  // (where it was split: the broken end burns white)
  c = mix(c, vec3(1.), step(.001, abs(uHalf)) * exp(-abs(y) * 14.) * .8);
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).g;
  gl_FragColor = vec4(c * I * (.4 + .6 * T), 1.);
}`;
// (the bell: a shell of gold light, a lattice of runes over it, rings running out over it from each bolt, cracking; the
// same shell, split gold and violet, is the light pressed out of the lock: mode 1)
const BELL_FS = `uniform float uAmt, uTime, uCrack, uMode; uniform vec3 uCol, uCol2, uAxis; uniform vec4 uHit[4]; uniform sampler2D uNoise, tSky; uniform vec2 uRes;
varying vec2 vQ; varying vec3 vN, vV, vL;
void main(){
  vec3 n = normalize(vN), v = normalize(vV), p = normalize(vL);
  float fr = pow(1. - abs(dot(n, v)), 2.6);
  float lat = asin(clamp(p.y, -1., 1.)), lon = atan(p.z, p.x);
  vec2 g = vec2(lon * 3.8, lat * 7.6) / 3.14159 * 1.6;
  g.x += floor(g.y) * .5;
  vec2 f = abs(fract(g) - .5);
  float grid = smoothstep(.43, .5, max(f.x, f.y)) * .9;
  float rune = smoothstep(.58, .7, texture2D(uNoise, floor(g * 2.) / 14. + .31).r) * (1. - grid) * smoothstep(.36, .2, max(f.x, f.y)) * .9;
  float ring = 0., flash = 0.;
  for (int i = 0; i < 4; i++) {
    vec4 H = uHit[i];
    if (H.w < 0. || H.w >= 1.) continue;
    float d = acos(clamp(dot(p, H.xyz), -1., 1.));
    float R = H.w * 2.4;
    ring += exp(-pow((d - R) / (.07 + H.w * .2), 2.)) * (1. - H.w) * (1. - H.w) * 4.;
    flash += exp(-d * d * 10.) * exp(-H.w * 7.) * 8.;
  }
  float cr = texture2D(uNoise, p.xz * .9 + p.y * .4 + .17).r;
  float crack = uCrack * exp(-pow((cr - .5) / .012, 2.)) * 3.5 * smoothstep(.9, .3, uCrack * .0 + abs(p.y - .2));
  float flick = .85 + .15 * sin(uTime * 23. + lat * 9.);
  vec3 col = uCol;
  if (uMode > .5) {
    // (split down the middle between them, gold and violet, churning; veins of lightning crawling over it)
    float sd = dot(p, uAxis);
    col = mix(uCol2, uCol, smoothstep(-.12, .12, sd + (texture2D(uNoise, vec2(lat * .6, uTime * .2)).r - .5) * .3));
    grid *= 0.; rune *= 0.;
    float sw = texture2D(uNoise, vec2(lon * .5 + uTime * .3, lat * .8 - uTime * .2)).g;
    float vn = texture2D(uNoise, vec2(lon * 1.3 - uTime * .05, lat * 1.9 + uTime * .07)).r;
    float vein = exp(-pow((vn - .5) / .018, 2.)) * 2.6 * (.6 + .4 * sin(uTime * 37. + lon * 5.));
    // (its body thin, its rim and its veins burning: a shell of force, not a moon)
    fr = fr * 2.1 + .14 * sw + .04 + vein;
  }
  float I = (fr * 1.0 + grid * (.32 + .6 * fr) + rune * .7 + ring + flash * .8 + crack) * flick * uAmt;
  vec3 c = mix(col, vec3(1., .95, .85), clamp(ring * .15 + flash * .12 + crack * .2 + fr * .08, 0., 1.));
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).g;
  gl_FragColor = vec4(c * I * (.4 + .6 * T), 1.);
}`;
// the light about each of them close to: a glow behind the figure (it stands dark or bright against it)
const AURA_VS = `uniform float uSize; varying vec2 vQ;
void main(){ vQ = position.xy; vec4 mv = viewMatrix * vec4((modelMatrix * vec4(0., 0., 0., 1.)).xyz, 1.); mv.xy += position.xy * uSize; gl_Position = projectionMatrix * mv; }`;
const AURA_FS = `uniform vec3 uCol; uniform float uAmt, uTime; varying vec2 vQ;
void main(){
  float r = length(vQ), a = atan(vQ.y, vQ.x);
  float fl = .88 + .12 * sin(uTime * 13. + r * 9.) * sin(uTime * 7. + a * 3.);
  float rays = .75 + .25 * sin(a * 9. + uTime * 1.3) * sin(a * 5. - uTime * .9);
  float g = (exp(-r * r * 6.) * 1.2 + exp(-r * 2.8) * .45 * rays) * smoothstep(1., .7, r);
  gl_FragColor = vec4(uCol * g * uAmt * fl, 1.);
}`;
// streamers: the ends of a sash, a sleeve, the hair, trailing in the wind of their flight (laid out in the world from
// where they hang: along the way the air goes past, sagging, flapping)
const RIBBON_VS = `uniform vec3 uFlow; uniform float uLen, uTime, uSeed, uFlap, uSag; varying float vT, vX; varying vec3 vNw;
void main(){
  float t = uv.y; vT = t; vX = uv.x;
  vec3 base = (modelMatrix * vec4(position.x, 0., position.z, 1.)).xyz;
  vec3 d = normalize(uFlow + vec3(0., -uSag, 0.) + vec3(1e-4, 0., 0.));
  vec3 sd = normalize(cross(d, vec3(0., 1., 0.)) + vec3(0., 0., 1e-4));
  vec3 u2 = normalize(cross(sd, d));
  float ph = uTime * uFlap + t * 5.5 + uSeed;
  vec3 w = (sd * sin(ph) * .55 + u2 * cos(ph * .83 + 1.3) * .4) * t * t * uLen * .22;
  vec3 wp = base + d * uLen * t + w + vec3(0., -uSag * uLen * t * t * .25, 0.);
  vNw = normalize(cross(sd * cos(ph) + u2 * .3, d));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const RIBBON_FS = `uniform vec3 uCol, uSun, uSunCol, uSky, uGlow; varying float vT, vX; varying vec3 vNw;
void main(){
  float e = abs(vX - .5) * 2.;
  if (e > 1. - vT * .55 || vT > .985) discard;
  float l = abs(dot(normalize(vNw), uSun));
  vec3 c = uCol * (uSunCol * (.25 + .75 * l) * 1.3 + uSky * .45) + uGlow * (1. - vT) * .5;
  gl_FragColor = vec4(c, 1.1);
}`;

// ------------------------------------------------------------------ build
export function createWar() {
  const group = new THREE.Group();
  group.name = 'war';
  const shared = { tSky: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNoise: U.uNoise, uTime: U.uTime };
  const sun = { uSun: { value: V3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(0.4, 0.5, 0.7) } };
  // ---- the two
  const gold = makePerson({ seed: 4242, robe: [0.86, 0.84, 0.79], under: [0.92, 0.9, 0.85], pants: [0.8, 0.78, 0.73], sash: [0.86, 0.6, 0.16], long: true, female: false, ponytail: true, scale: 1.04, shadow: false });
  const masked = makePerson({ seed: 911, ...SECT_ROBES, long: true, female: false, scale: 1.1, shadow: false });
  // (by day the violet at the robe's edges is a glint, not the whole of him: the crag's is for the night)
  const garb = sectGarb({ value: 0 }, -1e4, 0.2);
  garb.dress(masked);
  for (const p of [gold, masked]) { p.root.visible = false; group.add(p.root); p.mesh.frustumCulled = false; }
  // (his hair bound up under a small crown of gold)
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xc89a3a, metalness: 0.85, roughness: 0.32, envMapIntensity: 0.2 });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.04, 10), crownMat);
  crown.position.set(0, 0.165, -0.03); crown.rotation.x = -0.35;
  gold.head.add(crown);
  // ---- their weapons, in their right hands
  // (the world's light in them is the valley's, far below: little of it)
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd9dee8, metalness: 0.9, roughness: 0.22, emissive: new THREE.Color(1, 0.66, 0.26), emissiveIntensity: 0, envMapIntensity: 0.15 });
  const sword = new THREE.Mesh(swordGeometry(), bladeMat);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1b1418, metalness: 0.2, roughness: 0.6, envMapIntensity: 0.1 });
  const glaiveMat = new THREE.MeshStandardMaterial({ color: 0x3c3c44, metalness: 0.88, roughness: 0.3, emissive: new THREE.Color(0.55, 0.2, 1.0), emissiveIntensity: 0.35, side: THREE.DoubleSide, envMapIntensity: 0.15 });
  const glaive = new THREE.Mesh(glaiveGeometry(), [shaftMat, glaiveMat]);
  // (all of what they wear and hold is part of the figure for the painted look: outlined as a figure is, never flattened
  // into patches with the world, which turned the glaive's thin shaft green against the glare; the scene alpha 1.1 is
  // the figures' mark, post.js)
  const figMark = m => {
    const prev = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = 1.1;');
    };
    m.customProgramCacheKey = () => key + '-figmark';
  };
  for (const m of [bladeMat, shaftMat, glaiveMat, crownMat, garb.robeMat, garb.maskMat, garb.trimMat, garb.eyeMat]) figMark(m);
  const hands = {};
  for (const [p, w] of [[gold, sword], [masked, glaive]]) {
    const rig = p._.rig, I = rig.idx;
    const ca = Math.cos(35 * Math.PI / 180), sa = Math.sin(35 * Math.PI / 180);
    const a = V3(-sa, -ca, 0), n = V3(ca, -sa, 0), f = V3(0, 0, 1);
    const hs = rig.bindPos[I.handR].distanceTo(rig.endPos[I.handR]) / 0.092;
    w.position.copy(a).multiplyScalar(0.058 * hs).addScaledVector(n, 0.02 * hs);
    w.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, f, V3().crossVectors(a, f)));
    w.frustumCulled = false;
    rig.bones[I.handR].add(w);
    hands[p === gold ? 'gold' : 'masked'] = { a, n, f, hs };
  }
  // ---- streamers: his sash ends and sleeves and hair; the masked one's mantle and sash, torn and black
  const ribbons = [];
  const ribbon = (p, bone, off, across, len, width, col, seed, glow) => {
    const g = new THREE.PlaneGeometry(1, 1, 1, 14);
    const pa = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pa.count; i++) {
      const x = uv.getX(i) - 0.5;
      pa.setXYZ(i, off[0] + across[0] * x * width, 0, off[2] + across[2] * x * width);
    }
    // (the root's height in the bone's frame: carried in the position's y only through the model matrix, so put it
    // into a holder)
    const holder = new THREE.Object3D();
    holder.position.set(0, off[1], 0);
    p._.rig.bones[p._.rig.idx[bone]].add(holder);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, side: THREE.DoubleSide, fog: false,
      uniforms: { uFlow: { value: V3(0, 0, -1) }, uLen: { value: len }, uTime: U.uTime, uSeed: { value: seed }, uFlap: { value: 7 }, uSag: { value: 0.35 }, uCol: { value: new THREE.Color(...col) }, uGlow: { value: new THREE.Color(...(glow || [0, 0, 0])) }, ...sun },
    }));
    m.frustumCulled = false;
    holder.add(m);
    ribbons.push({ m, p, len });
  };
  ribbon(gold, 'hips', [0.06, 0.06, 0.13], [1, 0, 0], 1.25, 0.07, [0.86, 0.6, 0.16], 1, [0.4, 0.25, 0.05]);
  ribbon(gold, 'hips', [-0.05, 0.06, 0.13], [1, 0, 0], 1.0, 0.06, [0.86, 0.6, 0.16], 2.7, [0.4, 0.25, 0.05]);
  ribbon(gold, 'head', [0, -0.1, -0.13], [1, 0, 0], 0.7, 0.05, [0.06, 0.05, 0.05], 4.1);
  ribbon(gold, 'foreArmL', [0.05, -0.18, 0], [0, 0, 1], 0.7, 0.16, [0.88, 0.86, 0.81], 5.3);
  ribbon(gold, 'foreArmR', [-0.05, -0.18, 0], [0, 0, 1], 0.7, 0.16, [0.88, 0.86, 0.81], 6.9);
  ribbon(masked, 'chest', [0, 0.1, -0.16], [1, 0, 0], 1.7, 0.42, [0.04, 0.035, 0.045], 8.2, [0.12, 0.03, 0.25]);
  ribbon(masked, 'hips', [0.05, 0.05, 0.13], [1, 0, 0], 1.2, 0.07, [0.32, 0.08, 0.5], 9.6, [0.2, 0.05, 0.4]);
  ribbon(masked, 'foreArmL', [0.05, -0.18, 0], [0, 0, 1], 0.8, 0.18, [0.05, 0.04, 0.05], 11.1, [0.1, 0.03, 0.2]);
  // ---- the light about each
  const aura = [[1, 0.66, 0.26], [0.6, 0.24, 1.0]].map(col => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: AURA_VS, fragmentShader: AURA_FS, ...ADD, depthTest: true,
      uniforms: { uSize: { value: 2.4 }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(...col) }, uTime: U.uTime } }));
    m.frustumCulled = false; m.renderOrder = 18; m.visible = false; group.add(m);
    return m;
  });
  // (the great sword's hilt: a burst of gold light where its blade begins)
  const hilt = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: AURA_VS, fragmentShader: AURA_FS, ...ADD, depthTest: true,
    uniforms: { uSize: { value: 20 }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(1, 0.72, 0.32) }, uTime: U.uTime } }));
  hilt.frustumCulled = false; hilt.renderOrder = 21; hilt.visible = false; group.add(hilt);
  // (the white heart of the lock)
  const core = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: AURA_VS, fragmentShader: AURA_FS, ...ADD, depthTest: true,
    uniforms: { uSize: { value: 4 }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(1, 0.88, 0.72) }, uTime: U.uTime } }));
  core.frustumCulled = false; core.renderOrder = 22; core.visible = false; group.add(core);
  // ---- the motes of their qi about them
  const qiG = createQi({ count: 360, color: [1.0, 0.72, 0.3], intensity: 3.4, size: 0.05, seed: 31 });
  const qiM = createQi({ count: 360, color: [0.62, 0.26, 1.0], intensity: 3.6, size: 0.05, seed: 57 });
  group.add(qiG.points, qiM.points);
  // ---- the great sword
  // (a blade of light only: its hilt is a burst of light, `hilt` below, not a sword's fittings drawn in glass)
  const phantom = new THREE.Mesh(swordGeometry({ L: 1, w: 0.042, t: 0.007, guard: 0, grip: 0.07, rings: 40 }), new THREE.ShaderMaterial({
    vertexShader: LIGHT_VS, fragmentShader: PHANTOM_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uForm: { value: 0 }, uHot: { value: 0 }, uCol: { value: new THREE.Color(1, 0.6, 0.2) }, ...shared },
  }));
  phantom.frustumCulled = false; phantom.renderOrder = 21; phantom.visible = false;
  group.add(phantom);
  // ---- the crescent (two meshes: whole, or a half each once it is split)
  const cresGeo = (() => {
    const Th = 1.15, nu = 48, nv = 4, pos = [], uv = [], idx = [];
    for (let i = 0; i <= nu; i++) {
      const th = -Th + 2 * Th * i / nu, y = th / Th, wd = Math.pow(Math.cos(y * Math.PI / 2), 0.6);
      for (let j = 0; j <= nv; j++) {
        const x = -1 + 2 * j / nv, r = 1 + x * 0.5 * wd * (CRES.W / CRES.R);
        // (in its own plane: x across the line, y up it; z, the way it flies: its middle a little ahead)
        pos.push(Math.sin(th) * r, Math.cos(th) * r - Math.cos(Th), 0.22 * (Math.cos(th) - Math.cos(Th)) / (1 - Math.cos(Th)));
        uv.push(x, y);
      }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();
  const cresMat = h => new THREE.ShaderMaterial({ vertexShader: LIGHT_VS, fragmentShader: CRES_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uHalf: { value: h }, uSeed: { value: h * 3.1 + 0.4 }, uCol: { value: new THREE.Color(1, 0.72, 0.32) }, ...shared } });
  const cres = [cresMat(0), cresMat(1), cresMat(-1)].map(m => { const x = new THREE.Mesh(cresGeo, m); x.frustumCulled = false; x.renderOrder = 21; x.visible = false; group.add(x); return x; });
  // ---- the bell, and the light of the lock
  const bellGeo = new THREE.IcosahedronGeometry(1, 5);
  const bellMat = mode => new THREE.ShaderMaterial({ vertexShader: LIGHT_VS, fragmentShader: BELL_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uCrack: { value: 0 }, uMode: { value: mode }, uCol: { value: new THREE.Color(1, 0.74, 0.34) }, uCol2: { value: new THREE.Color(0.62, 0.28, 1.0) }, uAxis: { value: AX.clone() },
      uHit: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 1, 0, -1)) }, ...shared } });
  const bell = new THREE.Mesh(bellGeo, bellMat(0)), press = new THREE.Mesh(bellGeo, bellMat(1));
  press.material.uniforms.uCol.value.setRGB(1, 0.58, 0.14); press.material.uniforms.uCol2.value.setRGB(0.5, 0.14, 1);
  for (const m of [bell, press]) { m.frustumCulled = false; m.renderOrder = 21; m.visible = false; group.add(m); }
  // (the shock of the hardest blows: a shell of light thrown out from where they met, racing out and thinning)
  const domes = [0, 1].map(() => { const m = new THREE.Mesh(bellGeo, bellMat(1)); m.frustumCulled = false; m.renderOrder = 21; m.visible = false;
    m.material.uniforms.uCol.value.setRGB(1, 0.9, 0.75); m.material.uniforms.uCol2.value.setRGB(0.85, 0.75, 1); group.add(m); return m; });
  // (the lights' own cue clock, given by the engine: how long since the story crossed a moment, on the clock)
  const _a = V3(), _b = V3(), _c = V3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

  // pose a figure: the pose blended between two of its poses, the root placed and turned to face the other
  function poseFigure(p, P0, which, name0, name1, w, time) {
    const S = p._, rig = S.rig, K = S.K;
    const hand = hands[which];
    if (!S.PA) { S.PA = rig.newPose(); S.PB = rig.newPose(); }
    const build = (name, P) => {
      const D = P0[name];
      K.base(P);
      P.rp.set(0, rig.bindPos[0].y, 0);
      const br = Math.sin(time * 1.4 + (which === 'gold' ? 0 : 2)) * 1.2;
      K.e(P, 'spine', D.spine[0] + br * 0.5, D.spine[1], D.spine[2]).e(P, 'chest', D.chest[0] - br * 0.6, D.chest[1], D.chest[2]).e(P, 'neck', D.neck[0], D.neck[1], D.neck[2]);
      const [tl, kl, tr, kr, al, ar] = D.legs;
      const sw = Math.sin(time * 0.9 + (which === 'gold' ? 1 : 3)) * 3;
      K.e(P, 'thighL', -(tl + sw), 0, 1.5).e(P, 'shinL', kl + sw, 0, 0).e(P, 'footL', -al, 0, 0);
      K.e(P, 'thighR', -(tr - sw), 0, -1.5).e(P, 'shinR', kr - sw * 0.5, 0, 0).e(P, 'footR', -ar, 0, 0);
      // (the hands: a free one by its angles; one on the weapon put there, the hand turned so the weapon points its way)
      rig.fk(P);
      const R = D.R;
      let gripR = null, Bv = null;
      if (R.fk) K.armFK(P, 'R', ...R.fk, 6, 0, 0);
      else {
        Bv = V3(...R.B).normalize();
        const n = V3(...R.pn); n.addScaledVector(Bv, -n.dot(Bv)).normalize();
        const a = V3().crossVectors(n, Bv).normalize();
        gripR = V3(...R.grip);
        K.arm(P, 'R', gripR, V3(...R.pole), a, n);
      }
      const Ld = D.L;
      if (Ld.fk) K.armFK(P, 'L', ...Ld.fk, 6, 0, 0);
      else if (Ld.two != null && gripR) {
        // (on the weapon's grip or shaft, `two` metres from the right hand along it, the thumb toward its head)
        const g = gripR.clone().addScaledVector(Bv, Ld.two);
        const fdir = (Ld.th || 1) < 0 ? Bv.clone().negate() : Bv;
        const n = V3(...Ld.pn); n.addScaledVector(fdir, -n.dot(fdir)).normalize();
        const a = V3().crossVectors(fdir, n).normalize();
        K.arm(P, 'L', g, V3(...Ld.pole), a, n);
      } else if (Ld.grip) K.arm(P, 'L', V3(...Ld.grip), V3(...Ld.pole), V3(...Ld.fd), V3(...Ld.pd));
      K.fingers(P, 'R', 'fist');
      K.fingers(P, 'L', D.gripL || 'relaxed');
      return P;
    };
    build(name0, S.PA);
    if (w > 0.001 && name1 !== name0) { build(name1, S.PB); rig.blend(S.PA, S.PB, w); }
    rig.apply(S.PA);
    return S.PA;
  }
  const lean = (D0, D1, w) => [lerp(D0.root[0], D1.root[0], w), lerp(D0.root[1], D1.root[1], w), lerp(D0.root[2], D1.root[2], w)];
  const _face = V3(), _e = new THREE.Euler();
  function place(p, P0, which, at, toward, sched, u, time) {
    const [n0, n1, w] = scheduleAt(sched, u);
    poseFigure(p, P0, which, n0, n1, w, time);
    const [rx, , rz] = lean(P0[n0], P0[n1], w);
    _face.copy(toward).sub(at).setY(0);
    const yaw = Math.atan2(_face.x, _face.z);
    _e.set(rx * Math.PI / 180, yaw, rz * Math.PI / 180, 'YXZ');
    p.root.quaternion.setFromEuler(_e);
    // (the path is where the figure's middle is: the root put so)
    p.root.position.copy(at).add(_a.set(0, -1.05 * p.root.scale.y, 0).applyQuaternion(p.root.quaternion));
  }

  return {
    group, gold, masked, sword, glaive, phantom, bell, press, cres, qiG, qiM,
    shared, sun,
    // u: the story; time: the clock; cueAge(at): seconds since the story crossed `at` (Infinity if not yet);
    // camera; k: how much of the war is in view (0..1); env: { sunDir, sunCol, sky }
    update(u, time, camera, k, cueAge, env = null) {
      const on = k > 0.001 && u > WAR[0] - 0.3 && u < 53.0;
      group.visible = on;
      if (!on) return;
      if (env) { sun.uSun.value.copy(env.sunDir); sun.uSunCol.value.copy(env.sunCol); sun.uSky.value.copy(env.sky); }
      // (still while they are locked together, or meet)
      const free = 1 - Math.max(band(51.54, 51.556, 52.08, 52.1, u), band(50.235, 50.25, 50.25, 50.265, u));
      const G = GOLD(u, V3()).addScaledVector(bob(time, 0.3), free), M = MASKED(u, V3()).addScaledVector(bob(time + 7, 2.1), free);
      // (the figures only where the lens is near enough to see them)
      const dG = camera.position.distanceTo(G), dM = camera.position.distanceTo(M);
      gold.root.visible = dG < 260 && u < WAR[1] + 0.02;
      masked.root.visible = dM < 260 && u < WAR[1] + 0.4;
      if (gold.root.visible) place(gold, P_GOLD, 'gold', G, M, SCHED_GOLD, u, time);
      if (masked.root.visible) place(masked, P_MASKED, 'masked', M, G, SCHED_MASKED, u, time);
      // (the light about each, a little behind them from the lens: they stand against it)
      for (const [i, P, vis, amt] of [[0, G, gold.root.visible, 0.9], [1, M, masked.root.visible, 0.6]]) {
        const A2 = aura[i];
        A2.visible = vis;
        if (!vis) continue;
        const d = camera.position.distanceTo(P);
        A2.position.copy(P).addScaledVector(_c.copy(P).sub(camera.position).normalize(), 1.4).add(_b.set(0, 0.25, 0));
        A2.material.uniforms.uSize.value = 0.85 + 0.011 * d;
        A2.material.uniforms.uAmt.value = amt * (1 + 0.6 * band(51.553, 51.56, 52.08, 52.12, u)) * smooth(260, 120, d) * smooth(1.5, 6, d);
      }
      // (the blade lit with his qi as he gathers himself, blazing in the lock; the glaive's edge with the masked one's)
      bladeMat.emissiveIntensity = 0.4 + 2.2 * band(49.86, 50.0, 50.2, 50.26, u) + 2.4 * band(50.66, 50.7, 50.76, 50.82, u) + 2.8 * band(51.53, 51.56, 52.08, 52.12, u);
      glaiveMat.emissiveIntensity = 0.35 + 1.6 * band(50.9, 50.93, 50.97, 51.02, u) + 2.2 * band(51.15, 51.2, 51.46, 51.5, u) + 1.8 * band(51.53, 51.56, 52.08, 52.12, u) + 2.6 * band(52.3, 52.4, 52.47, 52.5, u);
      // streamers: back along the way the air goes past them, harder the faster they go
      const vG = GOLD(u + 0.004, _b).sub(GOLD(u - 0.004, _c)).divideScalar(0.008 / RATE);
      const vM = MASKED(u + 0.004, _b.clone()).sub(MASKED(u - 0.004, _c)).divideScalar(0.008 / RATE);
      for (const r of ribbons) {
        const v = r.p === gold ? vG : vM;
        const sp = v.length();
        const U2 = r.m.material.uniforms;
        // (hanging, a breeze across them; streaming straight back when they fly)
        U2.uFlow.value.set(0.25, -0.15, 0.2).addScaledVector(v, -1 / Math.max(sp, 1) * Math.min(1, sp / 30) * 2.2);
        U2.uSag.value = lerp(0.9, 0.12, Math.min(1, sp / 40));
        U2.uFlap.value = lerp(5, 16, Math.min(1, sp / 60));
      }
      // their qi: a haze of motes about each, swept back as they fly
      const qa = k * (1 - smooth(52.47, 52.6, u));
      qiG.set({ time, amt: qa * (gold.root.visible ? 1 : 0) * 0.9, center: G, radius: 2.6, flow: vG.clone().multiplyScalar(0.02), tail: 3, px: 900, flat: 0.9 });
      qiM.set({ time, amt: k * (masked.root.visible ? 1 : 0) * 0.9, center: M, radius: 2.4, flow: vM.clone().multiplyScalar(0.02), tail: 3, px: 900, flat: 0.9 });
      // ---- the great sword: forming over him as they face each other; swung with his blade; thrown as the crescent
      // (it forms while the two of them hang there, the story held: from the hilt up, a seam of white running up it)
      const form = smooth(49.36, 49.49, u), gone = smooth(50.745, 50.8, u);
      const pk = form * (1 - gone);
      phantom.visible = pk > 0.002;
      if (phantom.visible) {
        const U2 = phantom.material.uniforms;
        U2.uAmt.value = pk * (0.8 + 0.5 * band(50.0, 50.1, 50.2, 50.25, u) + 0.7 * band(50.68, 50.72, 50.75, 50.8, u));
        U2.uForm.value = form;
        U2.uHot.value = 0.15 + 0.5 * band(50.68, 50.72, 50.75, 50.8, u);
        // (standing over him, its point to the sky; swung down the line through the arc his blade cuts)
        const sw = smooth(50.7, 50.742, u), up = smooth(50.66, 50.7, u) * (1 - sw);
        const ang = lerp(0, -1.95, sw) + 0.35 * up;
        // (it stands behind him and over him, where he stood, while he goes at the other; then over him again)
        const ua = u < 50.17 ? u : u < 50.63 ? 50.17 : u;
        const pivot = GOLD(ua, V3()).addScaledVector(AX, -6).addScaledVector(NX, -5 * smooth(50.6, 50.66, u)).add(_a.set(0, 16, 0));
        const dir = _b.copy(UPV).multiplyScalar(Math.cos(ang)).addScaledVector(AX, -Math.sin(ang)).normalize();
        // (its flat turned to the lens, so it reads as a blade, never as a line)
        const toC = _c.copy(camera.position).sub(pivot);
        const flatN = toC.addScaledVector(dir, -toC.dot(dir)).normalize();
        const across = V3().crossVectors(dir, flatN).normalize();
        _m.makeBasis(across, dir, flatN);
        phantom.quaternion.setFromRotationMatrix(_m);
        phantom.position.copy(pivot);
        phantom.scale.setScalar(210);
        // (its hilt a burst of light where the blade begins, flaring as he swings it)
        hilt.position.copy(pivot).addScaledVector(dir, 0.085 * 210);
        hilt.material.uniforms.uSize.value = 20 + 14 * band(50.68, 50.72, 50.75, 50.8, u);
        hilt.material.uniforms.uAmt.value = form * (1 - gone) * (1.1 + 0.8 * band(50.68, 50.72, 50.75, 50.8, u));
      }
      hilt.visible = phantom.visible;
      // ---- the crescent
      const cb = u >= CRES.born ? 1 : 0;
      const split = u >= CRES.hit;
      const ca = cb * smooth(CRES.born, CRES.born + 0.01, u) * (1 - smooth(51.05, 51.12, u));
      const CF = AX, CT = _a.copy(UPV).multiplyScalar(Math.cos(CRES.tilt)).addScaledVector(NX, Math.sin(CRES.tilt)).normalize();
      const CS = V3().crossVectors(CT, CF).normalize();
      for (let h = 0; h < 3; h++) {
        const m = cres[h];
        m.visible = ca > 0.002 && (h === 0 ? !split : split);
        if (!m.visible) continue;
        // (along the line from in front of him to the glaive's edge, its apex on that line; on past it once split)
        const S0 = GOLD(CRES.born, _b).addScaledVector(AX, 14).add(_c.set(0, 3, 0)), E0 = MASKED(CRES.hit, V3()).addScaledVector(AX, -5).add(_c.set(0, 1.5, 0));
        const D = E0.clone().sub(S0), dl = D.length(); D.divideScalar(dl);
        const f = 0.35 * smooth(CRES.born, CRES.hit, u) + 0.65 * clamp((u - CRES.born) / (CRES.hit - CRES.born));
        const c = split ? E0.clone().addScaledVector(D, dl * (u - CRES.hit) / (CRES.hit - CRES.born)) : S0.clone().lerp(E0, f);
        c.addScaledVector(CT, -CRES.R * (1 - Math.cos(1.15)) * 0.92);
        const sideK = split ? (h === 1 ? 1 : -1) * lerp(0, 260, Math.pow(clamp((u - CRES.hit) / 0.15), 0.8)) : 0;
        const dropK = split ? 520 * Math.pow(clamp((u - CRES.hit) / 0.14), 1.7) : 0;
        c.addScaledVector(CS, sideK).add(_b.set(0, -dropK, 0));
        _m.makeBasis(CS, CT, CF);
        m.quaternion.setFromRotationMatrix(_m);
        // (the halves turn down toward the sea as they go)
        if (split) { _q.setFromAxisAngle(CS, 0.5 * clamp((u - CRES.hit) / 0.12)); m.quaternion.premultiply(_q); }
        m.position.copy(c);
        const sc = CRES.R * (split ? 1 : lerp(0.35, 1, smooth(CRES.born, CRES.born + 0.03, u)));
        m.scale.setScalar(sc);
        m.material.uniforms.uAmt.value = ca * (split ? 1.2 * (1 - smooth(51.0, 51.12, u)) + 0.3 : 1.0);
      }
      // ---- the bell about him, the lightning breaking on it; and the light of the lock
      const bk = band(51.19, 51.235, 51.47, 51.52, u);
      bell.visible = bk > 0.002;
      if (bell.visible) {
        bell.position.copy(G).add(_a.set(0, 1.1, 0));
        bell.scale.setScalar(BELL_R * lerp(0.6, 1, smooth(51.19, 51.235, u)) * (1 + 0.25 * smooth(51.47, 51.52, u)));
        const U2 = bell.material.uniforms;
        U2.uAmt.value = bk * 0.8;
        let crack = 0, last = -1;
        for (let j = 0; j < BOLT_U.length; j++) if (u >= BOLT_U[j]) last = j;
        for (let i = 0; i < 4; i++) {
          // (the last four bolts' rings, on the shell where each struck)
          const j = last - i, H = U2.uHit.value[i];
          const age = j >= 0 && cueAge ? cueAge(BOLT_U[j]) : Infinity;
          if (j >= 0 && age < 0.8) { const d = BOLT_DIRS[j]; _c.set(0, 0, 0).addScaledVector(AX, d.x).addScaledVector(UPV, d.y).addScaledVector(NX, d.z).normalize(); H.set(_c.x, _c.y, _c.z, age / 0.8); }
          else H.w = -1;
        }
        for (const b of BOLT_U) if (u >= b) crack += 0.11;
        U2.uCrack.value = clamp(crack);
      }
      const pr = band(51.553, 51.565, 52.1, 52.16, u);
      press.visible = pr > 0.002;
      core.visible = false;
      if (press.visible) {
        press.position.copy(G).lerp(M, 0.5).add(_a.set(0, 1.3, 0));
        const grow = smooth(51.555, 52.08, u), burst = smooth(52.1, 52.16, u);
        press.scale.setScalar(lerp(4, 72, Math.pow(grow, 0.7)) + 170 * burst);
        const U2 = press.material.uniforms;
        // (from inside it, nothing of it: it would only be a haze over them)
        const inside = smooth(0.9, 1.5, camera.position.distanceTo(press.position) / press.scale.x);
        U2.uAmt.value = pr * inside * (1.0 + 0.3 * Math.sin(time * 31) * Math.sin(time * 17) + 1.4 * burst);
        // (and the white heart of it, where blade and glaive meet)
        core.visible = true; core.position.copy(press.position);
        const dc = camera.position.distanceTo(core.position);
        core.material.uniforms.uSize.value = Math.min(3 + press.scale.x * 0.55, 0.35 * dc);
        core.material.uniforms.uAmt.value = pr * (1.6 + 0.4 * Math.sin(time * 23) + 2 * burst) * lerp(0.25, 1, smooth(4, 30, dc));
        U2.uAxis.value.copy(AX).negate();
        U2.uCrack.value = 0;
        for (const H of U2.uHit.value) H.w = -1;
      }
      // ---- the shock of the hardest blows: a shell of light racing out from where they met
      let di = 0;
      for (const b of BLOWS) {
        if (!b.crater || di > 1) continue;
        const age = cueAge ? cueAge(b.u) : Infinity;
        if (!(age >= 0 && age < 1.6)) continue;
        const x = age / 1.6, m = domes[di++];
        m.visible = true;
        m.position.copy(b.at(u));
        m.scale.setScalar(30 + 1050 * (1 - Math.pow(1 - x, 2.2)) * (b.crater[2] / 1.9));
        m.material.uniforms.uAmt.value = Math.pow(1 - x, 1.6) * 1.3;
        m.material.uniforms.uAxis.value.copy(AX);
      }
      for (; di < 2; di++) domes[di].visible = false;
      return { G, M };
    },
    // the light of their trails (for the engine's fighters): where the two were a moment ago, on the clock
    flight(u, time) {
      return (t, o1, o2) => { const uu = u - Math.max(0, time - t) * RATE; GOLD(uu, o1); MASKED(uu, o2); };
    },
  };
}
