// The war above the clouds, close to: the two who fight there, as people, and what they throw at each other.
//
// The gold one: white robes and a gold sash, his hair bound up, a straight sword; over him, as he gathers himself, a
// sword of light a quarter of a kilometre long. The masked one of Fen Tian Zong: the sect's black robes, deep hood and
// mantle, the angular iron mask with violet slits, a glaive; round him the sect's violet lightning.
// They face each other over the sea of clouds; they meet, and the shock of it tears a ring out of the sea; he cuts, and
// the crescent of light his great sword throws is split on the glaive, its halves carving two trenches into the sea
// behind; the masked one calls the storm down on him and the bell of light he raises breaks under it; they lock, and the
// light pressed out of the lock blows the sea down under them; it bursts, and throws the masked one back and up. There he
// hangs, shaking, gathering his fury, and the storm comes down into him, bolt after bolt; and he lets it go: the storm
// down through him and out of the glaive in a blade of violet lightning as great as the other's sword of light, down
// onto him; the bell he throws up shatters under it, and he falls.
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
const GOLD0 = path([
  [49.0, -150, 0, 0], [50.17, -150, 4, 0], [50.19, -157, 2, 0], [50.25, -1.25, 1, 0],
  [50.3, -70, 14, 14], [50.45, -138, 22, 26], [50.63, -150, 22, 28], [51.5, -146, 18, 22], [51.525, -151, 16, 22],
  [51.555, -0.59, 40.67, 0], [52.08, -1.4, 46, -12], [52.12, -30, 30, -8], [52.3, -34, 14, -6], [52.445, -31.5, 8.2, -5.3],
  // (smashed down out of the bell as it shatters: falling, faster and faster, into the dive; eased into a slower fall after
  // it, he slowed as he went, and the lens tipping down after him caught him up and he rose in its frame)
  [52.47, -30.5, -3, -5], [53, -29, -300, -5]]);
const MASKED0 = path([
  [49.0, 150, 8, 0], [50.17, 150, 9, 0], [50.19, 157, 9, 0], [50.25, 1.25, 1, 0],
  [50.3, 64, 24, -12], [50.45, 136, 30, -24], [50.63, 150, 30, -25], [51.15, 150, 30, -25], [51.3, 142, 86, -14], [51.5, 138, 98, -12],
  [51.525, 143, 100, -12], [51.555, 0.59, 41.33, 0], [52.08, 1.4, 50, -12], [52.12, 22, 96, -10], [52.2, 45, 112, -8], [52.26, 54, 118, -6],
  [52.36, 56, 119, -6], [52.43, 55, 117, -6], [52.47, 54, 116, -6], [52.9, 70, 172, 10]]);
// (locked, they stay face to face: each is put about the middle of the two, the one from the other easing from how
// they met to how the lock bursts. On their own paths the gold one's dash carried on through the lock and the masked
// one's did not, so they slid apart sideways, out of the frame of the lens over his shoulder)
const LOCK = [51.555, 52.08];
// (blade on shaft until the lens has left them: then the light pressed out between them forces them apart)
const LOCK_HOLD = 51.8;
// (the one from the other as they meet, and as the lock bursts)
const LOCK_A = MASKED0(LOCK[0]).sub(GOLD0(LOCK[0])), LOCK_B = MASKED0(LOCK[1]).sub(GOLD0(LOCK[1]));
const _lr0 = V3(), _lr1 = V3(), _lm = V3(), _ld = V3();
const lockAt = (u, out, side) => {
  const g = GOLD0(u, _lr0), m = MASKED0(u, _lr1), mid = _lm.copy(g).add(m).multiplyScalar(0.5);
  return out.copy(mid).addScaledVector(_ld.copy(LOCK_A).lerp(LOCK_B, smooth(LOCK_HOLD, LOCK[1], u)), 0.5 * side);
};
const GOLD = (u, out = V3()) => (u > LOCK[0] && u < LOCK[1] ? lockAt(u, out, -1) : GOLD0(u, out));
// (where his blade meets the shaft of the glaive, locked: off him as their poses put it, war.js P_* lock)
const lockContact = (u, out = V3()) => GOLD(u, out).addScaledVector(AX, 0.64).addScaledVector(UPV, 0.88).addScaledVector(NX, -0.2);
// (the glaive's head, this frame: set as the masked one is posed; the storm comes down into it and out of it)
const GLAIVE_HEAD = V3();
const MASKED = (u, out = V3()) => (u > LOCK[0] && u < LOCK[1] ? lockAt(u, out, 1) : MASKED0(u, out));
// (each hangs in the air, rising and falling a little, never quite still)
const bob = (t, s) => V3(Math.sin(t * 0.7 + s) * 0.35, Math.sin(t * 1.1 + s * 2) * 0.55, Math.cos(t * 0.6 + s) * 0.35);
export const goldAt = (u, out = V3()) => GOLD(u, out);
export const maskedAt = (u, out = V3()) => MASKED(u, out);

// ------------------------------------------------------------------ the blows: [u, kind, where, size]
// kind: the duel's (duel.js BLOW) and the war's own: 6 the crescent thrown, 7 the crescent split, 8 lightning on the bell
export const BLOWS = [
  { u: 50.25, kind: 5, at: u => L(0, 1.5, 0), crater: [0, 0, 1.9, 2.2], frame: 0.06, bolts: 3, shake: 1.6 },
  { u: 50.742, kind: 6, at: u => GOLD(50.742).addScaledVector(AX, 14).add(V3(0, 2, 0)), shake: 0.4 },
  { u: 50.95, kind: 7, at: u => CRES_HIT(), frame: 0.045, bolts: 1, shake: 1.2 },
  ...[51.306, 51.322, 51.343, 51.364, 51.388, 51.418, 51.448, 51.47].map((u, i) => ({ u, kind: 8, i, at: () => boltHit(i), shake: 0.35 + (i === 7 ? 0.4 : 0) })),
  { u: 51.555, kind: 5, at: u => L(0, 41, 0), crater: [0, 0, 1.6, 6.0], frame: 0.06, bolts: 2, shake: 1.5 },
  ...[51.62, 51.69, 51.76, 51.83, 51.9, 51.97, 52.03].map(u => ({ u, kind: 9, at: v => lockContact(v), shake: 0.25 })),
  { u: 52.085, kind: 5, at: u => L(0, 48, -12), crater: [0, -12, 2.4, 2.4], frame: 0.07, bolts: 3, shake: 2.0 },
  // (the storm let go out of him as its blade is born out of the glaive's head, seen close behind him: the frame struck,
  // the air bent round it, lightning thrown out of him across the sky; the blade had only switched on, a beam)
  // (and the air it bends goes out past the frame's edges, the lightning out of him thrown far across it: its ring stopped
  // half way out from the glaive's head in the corner of the frame, and the burst was a flash in that corner)
  { u: 52.347, kind: 5, at: () => GLAIVE_HEAD.clone(), frame: 0.05, bolts: 7, shake: 2.0, shockR: 1.45, shockK: 2.2 },
  // (and from afar as he swings it: a shell of violet light racing out of him, lightning thrown out across the sky)
  // (no wider than the space between them: wider, it swelled past the lens and laid a violet ball over the whole frame)
  // (and only in the wide: on into the cut in close to the other, it lay over half that frame, a violet ball)
  { u: 52.39, kind: 5, at: () => GLAIVE_HEAD.clone(), crater: [0, 0, 0.18, 1.6], dome: [0.62, 0.32, 1.0], domeK: 0.6, domeTo: 52.425, bolts: 3, shake: 1.2 },
  // (the storm's blade on the bell about him)
  // (its point of light a blink: the light that goes on from it is his, falling)
  { u: 52.445, kind: 5, at: u => GOLD(52.445).add(V3(0, 1.1, 0)), crater: [-30, -5, 2.2, 3.2], frame: 0.07, bolts: 3, shake: 2.4, star: 0.1 },
];
// (the bolts the masked one calls down: from the dark over the fight onto the bell about the gold one)
const BELL_R = 30;
const BOLT_DIRS = [[-0.3, 0.9, -0.3], [0.5, 0.8, 0.3], [0.1, 0.95, 0.4], [-0.6, 0.7, 0.2], [0.7, 0.6, -0.3], [-0.2, 0.85, -0.5], [0.3, 0.9, -0.1], [0, 1, 0.1]].map(d => V3(...d).normalize());
// (the first as the bell is cut to: struck while the lens was still under the masked one, it crossed his frame from a star
// of its own forks in the empty sky, a bolt meant for the bell seen end-on from the wrong place)
const BOLT_U = [51.306, 51.322, 51.343, 51.364, 51.388, 51.418, 51.448, 51.47];
// (where it strikes the shell now, as the bell moves with him)
const _bh = V3();
let BELL_NOW_U = 51.3;
const boltHitNow = i => { const g = GOLD(BELL_NOW_U).add(V3(0, 1.1, 0)), d = BOLT_DIRS[i]; return _bh.copy(g).addScaledVector(AX, d.x * BELL_R).addScaledVector(UPV, d.y * BELL_R).addScaledVector(NX, d.z * BELL_R); };
function boltHit(i, out = V3()) {
  const g = GOLD(BOLT_U[i]).add(V3(0, 1.1, 0)), d = BOLT_DIRS[i];
  return out.copy(g).addScaledVector(AX, d.x * BELL_R).addScaledVector(UPV, d.y * BELL_R).addScaledVector(NX, d.z * BELL_R);
}
// (first the storm answers his raised glaive, three bolts down onto its head; then it comes down on the bell)
export const GATHER_U = [51.172, 51.2, 51.232];
// (and again, thrown back up over him, while he hangs there gathering his fury: the storm pours down into him, faster and
// faster, until he lets it go)
export const FURY_U = [52.258, 52.279, 52.297, 52.312, 52.325, 52.335, 52.344, 52.351];
export const FURY = { gather: [52.24, 52.27, 52.34, 52.36], raise: [52.342, 52.388], swing: [52.39, 52.445], hit: 52.445 };
// (the bell he throws up in haste over himself as it comes: small, close about him)
// (small enough that close to, he is a man in it: seven metres across from under twenty, it filled the frame)
const BELL2_R = 5;
// (and from afar, from where the whole of the blade's sweep is seen, larger, so it is a shell about his light and not a
// halo on it: five metres across three hundred and forty, it was a soft blur round the star; twelve, a gold disc no
// bigger than his own light)
const bellR = u => BELL2_R * (u < 52.425 ? 4.5 : 1);
// (and as the blade of the storm comes down, the storm out of him with it: a volley of bolts from the glaive onto the
// bell the gold one throws up, the last as it breaks)
const VOLLEY_U = [52.396, 52.402, 52.408, 52.414, 52.42, 52.428, 52.435, 52.441];
// (where the storm comes down into the glaive from as he gathers his fury: ahead of him toward the other, up, and to
// the side, in metres)
// (steep, all of them, so each comes down into the frame from over it: from low ahead, its far reach ran on toward the
// lens's own line, its kinks heaped up into a scribble)
const FURY_FROM = [[120, 460, -80], [60, 480, 70], [150, 440, 110], [90, 500, -40], [140, 470, -150], [70, 450, 120], [110, 520, 20], [50, 480, -110]];
function furyFrom(i, u) {
  const M = MASKED(u), G = GOLD(u), to = G.sub(M).setY(0).normalize(), sd = V3().crossVectors(to, UPV).normalize();
  const [a, h, sw] = FURY_FROM[i % FURY_FROM.length];
  return GLAIVE_HEAD.clone().addScaledVector(to, a).add(V3(0, h, 0)).addScaledVector(sd, sw);
}
const volleyTo = (i, out = V3(), u = VOLLEY_U[i]) => {
  const G = GOLD(FURY.hit).add(V3(0, 1.1, 0)), d = MASKED(FURY.hit).sub(G).normalize();
  d.add(V3(((i * 5) % 3 - 1) * 0.35, ((i * 2) % 3 - 1) * 0.25, ((i * 7) % 3 - 1) * 0.35)).normalize();
  return out.copy(G).addScaledVector(d, bellR(u) * 0.98);
};
// (each kept on the shell where it strikes it, as the shell is seen in the shot: struck from afar and still burning in the
// cut in close to him, it ended in the air beside the smaller shell)
const _vf = V3();
export const BOLTS = [
  // (fine: the lens is under him, twenty metres off; three metres wide they came down past it as a column of glass panes)
  // (sky: down out of the dark over the fight, from beyond the frame, engine.js)
  // (four branches: from under him, close, seven crossed into a net of cells over the top of the frame)
  ...GATHER_U.map((u, i) => ({ u, sky: 1, width: 0.5, levels: 7, branches: 4, brK: [0.45, 0.85], dur: 0.7, near: 2, wmax: 0.04, follow: () => GLAIVE_HEAD, from: () => MASKED(u).add(V3((i - 1) * 150, 660, (i % 2 ? 1 : -1) * 110)), to: () => GLAIVE_HEAD.clone() })),
  // (into the glaive's head itself, thin and finely jagged, each a quick stroke, forking just over it: channels three
  // metres wide a metre or two from the lens were flat panes of glass, and ended in the air over him. Out of the dark
  // ahead of him and over him: from behind they came down past the lens, great searchlight beams)
  // (its forks within a metre or so of the head: struck a few metres up the channel, from a lens three metres off they
  // ran the height of the frame beside it, a second channel twisted round the first, a cable)
  ...FURY_U.map((u, i) => ({ u, sky: 1, width: 0.18, levels: 8, branches: 6, dur: 0.5, disp: 0.15, near: 3, nearM: 1.4, wmax: 0.03, follow: () => GLAIVE_HEAD, from: () => furyFrom(i, u), to: () => GLAIVE_HEAD.clone() })),
  // (kept on the shell where each strikes as he moves in it: left where it struck, it ended in the air short of it)
  ...BOLT_U.map((u, i) => ({ u, sky: 1, width: 1.6, levels: 7, follow: () => boltHitNow(i), from: () => boltHit(i).addScaledVector(BOLT_DIRS[i], 700).add(V3((i % 3 - 1) * 120, 260, ((i * 7) % 5 - 2) * 90)), to: () => boltHit(i) })),
  // (each quick, so no more than two at once: a second's worth, they crossed into a net of cells over the bell)
  ...VOLLEY_U.map((u, i) => ({ u, width: 0.4, levels: 7, fineEnd: 16, dur: 0.55, disp: 0.13, follow: () => volleyTo(i, _vf, BELL_NOW_U), from: () => GLAIVE_HEAD.clone(), to: () => volleyTo(i) })),
];
// the crescent: thrown out of the great sword's swing, flying down the line at the masked one; split on his glaive, its
// halves past him either side and down into the sea behind, where they cut two trenches
const CRES = { born: 50.735, hit: 50.95, R: 70, W: 18, tilt: -0.6 };
// (the great sword's angle from the upright in the plane across the line, + to his right: wound up over his right
// shoulder, then cut down across to his left; the crescent is born in the plane of that cut, its middle the cut's)
const swingAng = u => lerp(0, -2.05, smooth(50.7, 50.742, u)) + 0.55 * smooth(50.66, 50.7, u) * (1 - smooth(50.7, 50.742, u));
// (across the view of the lens behind him as he cuts, which looks a little to his right of the line: across the line
// itself, the cut ran on round behind the lens)
const SWING_E1 = NX.clone().multiplyScalar(0.92).addScaledVector(AX, -0.39).normalize();
// (born in the plane of the swing that threw it, it rights itself as it flies, so it comes at him upright, its middle
// on his glaive, and is cleaved there into a half each side of him: tilted all the way, it passed over his left
// shoulder and broke up there, the halves going off together along its own line)
const cresTilt = u => CRES.tilt * (1 - smooth(50.76, 50.9, u));
// (where his glaive's edge meets it, out in front of him and over his head as he swings it up through it)
const CRES_HIT = () => MASKED(CRES.hit).addScaledVector(AX, -2.0).addScaledVector(NX, 0.4).add(V3(0, 2.0, 0));
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
  // (him in the lower left third, the great sword rising out of the frame over him, the caption clear of him on the
  // right: looking straight up at him, he stood on the frame's bottom edge by its buttons, and then beside the caption)
  { id: 'gold', u: [49.83, 50.105], pos: (k, u) => GOLD(u).addScaledVector(AX, lerp(-58, -50, k)).addScaledVector(NX, -20).add(V3(0, lerp(-26, -24, k), 0)),
    look: (k, u) => GOLD(u).addScaledVector(AX, 12).addScaledVector(NX, 30).add(V3(0, 30, 0)), fov: () => 50 },
  // side on and wide: the two lights at either edge of it, drawing back; they streak in at each other and meet in the
  // middle of it, and the page goes white with it (engine.js WHITE_CUTS: the cut is made inside that white). (Closer, it
  // had been empty for most of a second and the meeting a single frame)
  { id: 'charge', u: [50.105, 50.265], pos: k => L(2, lerp(10, 12, k), lerp(-178, -150, smooth(0, 1, k))), look: () => L(0, 4, 0), fov: () => 54 },
  // cut in the white of their meeting to him, close, as he is thrown back out of it: the lens rides with him, behind him
  // over his left shoulder (on the side of the line the wide and the reverse are seen from: over his right, the crescent
  // went off left to right and came in at the other right to left), his arms flung out, the sea and the far peaks rushing past and slowing, the light of the
  // meeting falling away ahead of him; as he steadies it draws back and down, he gathers himself, and the great sword
  // swings down past us and throws its crescent down the line. (Seen from where he would stop he was a speck in the
  // white, a violet light at his hip; the shock before it was only the white of the sea; and the cut missed the flash)
  // (out of the white he is hurled back at the lens out of the distance, and it is dragged along with him: riding with
  // him from the first, his flight was only the sky going on behind him, and he seemed to change his pose in place)
  { id: 'release', u: [50.265, 50.86],
    pos: (k, u) => GOLD(u).addScaledVector(AX, lerp(-4.6, -7.0, smooth(50.265, 50.6, u)) + 0.8 * smooth(50.66, 50.86, u) - 19 * (1 - smooth(50.288, 50.336, u))).addScaledVector(NX, lerp(-2.0, -5.0, smooth(50.3, 50.6, u))).add(V3(0, lerp(1.2, -0.6, smooth(50.4, 50.66, u)), 0)),
    // (steadied, he is in the right third of the frame and the other's violet light far off in the left: from closer
    // behind him the light stood at his hip; and low enough that his feet stay in the frame)
    look: (k, u) => GOLD(u).addScaledVector(AX, 20).add(V3(0, 0.6, 0)).lerp(GOLD(u).addScaledVector(AX, 29.8).addScaledVector(NX, 10.6).add(V3(0, lerp(9, 3.5, smooth(50.66, 50.8, u)), 0)), smooth(50.45, 50.66, u)),
    fov: (k, u) => lerp(50, 54, smooth(50.4, 50.66, u)) },
  // behind the masked one, low: the crescent comes at him, at us; he splits it
  { id: 'split', u: [50.86, 51.13], pos: (k, u) => MASKED(u).addScaledVector(AX, lerp(36, 32, k)).addScaledVector(NX, -7).add(V3(0, -5, 0)), look: (k, u) => MASKED(u).addScaledVector(AX, -10).add(V3(0, 2.5, 0)), fov: () => 50 },
  // below the masked one as he rises, his glaive held up to the sky
  { id: 'summon', u: [51.13, 51.3], pos: (k, u) => MASKED(u).addScaledVector(AX, lerp(12, 10, k)).addScaledVector(NX, -9).add(V3(0, -11, 0)), look: (k, u) => MASKED(u).add(V3(0, 5, 0)), fov: () => 48 },
  // the lightning breaking on the bell of light about the gold one
  // (from under it, so it stands against the sky with the storm coming down onto it: level with it, its lower half lay
  // on the white of the sea, a cream ball with nobody in it)
  { id: 'bell', u: [51.3, 51.556], pos: k => GOLD(51.3).addScaledVector(AX, lerp(-100, -92, k)).addScaledVector(NX, lerp(-128, -118, k)).add(V3(0, -40, 0)), look: () => GOLD(51.3).add(V3(0, 18, 0)), fov: () => 48 },
  // over the gold one's left shoulder, close, at its height: the lock, blade on shaft between them, the white heart of it
  // where they cross, the mask over it lit by it, his head dark in the lower right; creeping in (from when they have
  // met: riding with him on his dash to it, the lens swung round at five hundred degrees a second). Locked, the two keep
  // face to face (LOCK), so nothing's settling after the dash swings the lens. (They had hung two and three metres
  // apart, the masked one high over him, neither weapon near the other: two men near each other with light round them)
  { id: 'lock', u: [51.556, 51.83], pos: (k, u) => GOLD(u).addScaledVector(AX, lerp(-1.8, -1.6, k)).addScaledVector(NX, -0.9).add(V3(0, 0.6, 0)),
    look: (k, u) => lockContact(u), fov: () => 40 },
  // from the far side, low: the light pressed out of the lock swelling between them, the sea blown down under it
  // (from below, so the light stands against the sky, not washed out against the sea's white)
  { id: 'lockwide', u: [51.83, 52.13], pos: k => L(-30, lerp(-70, -62, k), lerp(-360, -330, k)), look: () => L(0, 52, 0), fov: () => 50 },
  // from where the burst flung the masked one, the lens left there as he is flung on back and up away from it, tumbling,
  // smaller and smaller (riding beside him, the sky stood still behind him: he spun in place); on the side he is flung
  // from, so he goes away from it, not across it (from his side, close, it whipped round after him at 250 degrees a
  // second)
  { id: 'thrown', u: [52.13, 52.24], pos: () => MASKED(52.13).addScaledVector(NX, -5).addScaledVector(AX, -11).add(V3(0, -3.5, 0)),
    look: (k, u) => MASKED(u).addScaledVector(AX, 1.5).add(V3(0, 0.6, 0)), fov: () => 46 },
  // close behind the masked one and a little under him, as he hangs there shaking, gathering his fury: his back dark
  // against the sky, the storm coming down into him bolt after bolt (the lens creeping in; looking up past him, never
  // down onto the white of the sea, where light laid on light does not show)
  // (behind his right shoulder, at its height, so he is a man and not a stack of shapes: under him, his soles and a
  // disc of hood; as he raises the glaive the lens goes up with it, and the blade of the storm rises out of it)
  { id: 'fury', u: [52.24, 52.385], pos: (k, u) => furyLens(u, lerp(3.0, 2.4, k) + 0.45 * smooth(FURY.raise[0], FURY.raise[1], u), -1.5, lerp(-0.4, -0.25, k) - 0.2 * smooth(FURY.raise[0], FURY.raise[1], u)),
    look: (k, u) => furyAhead(u, 9, lerp(4.5, 5.5, k)).lerp(furyAhead(u, 1.2, 3.0), smooth(FURY.raise[0], FURY.raise[1], u)), fov: k => lerp(48, 52, k) },
  // (and on as he lets it go: the blade of the storm rises up out of the glaive over him into the dark; then the cut, on
  // the swing, to) the side, wide and low, the dark sky behind them both: the blade sweeping down the sky from him onto
  // the bell the other throws up over himself, the storm in a volley of bolts with it
  // (far enough off for the whole of it, the blade standing over the violet star and the gold one's light under it to
  // the right, his small bell, the sweep of it down the sky onto him: closer, under the masked one, the blade came down
  // onto an empty frame's edge and he was never seen)
  { id: 'swing', u: [52.385, 52.425], pos: (k, u) => SWING_MID().addScaledVector(NX, -340).addScaledVector(AX, -10 * k).add(V3(0, -20, 0)),
    look: (k, u) => SWING_MID().addScaledVector(AX, lerp(10, -50, smooth(52.395, 52.425, u))).add(V3(0, lerp(75, 20, smooth(52.395, 52.425, u)), 0)), fov: () => 62 },
  // (the cut in on the gold one as it comes down: close to him, a little under him, the dark sky over him: the blade out
  // of the top of the frame onto the bell, it shatters, and he is smashed down out of the frame. From afar he had been a
  // dot, the bell a dim disc lost on the white of the sea, and the blade sat on it for a second)
  // (close enough that he is a man in it, in white, his bell about him: from twenty-four metres, through its glow, he
  // was a few strokes of ink, a scratch on the glass)
  { id: 'impact', u: [52.425, WAR[1]], pos: k => GOLD(FURY.hit).addScaledVector(NX, lerp(-13.2, -12.6, k)).addScaledVector(AX, lerp(-4.3, -4.0, k)).add(V3(0, -2.5, 0)),
    // (and the lens tips down after his light as it goes, so it is seen going: held where the bell was, he was out of the
    // bottom of the frame in a fifth of a second, and the frame was left to the pieces)
    // (and comes to rest a moment before the cut into the dive: still tipping as the cut came, it was a whip, or a cut
    // made in the middle of a move for no reason)
    look: (k, u) => GOLD(FURY.hit).addScaledVector(AX, 2.2).add(V3(0, lerp(3.4, 0.4, smooth(FURY.hit, WAR[1] - 0.005, u)), 0)).lerp(GOLD(Math.min(u, WAR[1] - 0.005)).add(V3(0, 1, 0)), 0.42 * smooth(FURY.hit + 0.002, WAR[1] - 0.005, u)), fov: () => 54 },
];
// (between the two as he swings the storm's blade)
const SWING_MID = () => MASKED(52.385).lerp(GOLD(52.385), 0.5);
// (behind the masked one, away from the other along the ground, a little to his right: back, side, up in metres)
function furyLens(u, back, side, up) {
  const M = MASKED(u), G = GOLD(u), away = M.clone().sub(G).setY(0).normalize(), sd = V3().crossVectors(away, UPV).normalize();
  return M.addScaledVector(away, back).addScaledVector(sd, side).add(V3(0, up, 0));
}
// (ahead of him toward the other along the ground, and up: where the storm comes down into him from)
function furyAhead(u, ahead, up) {
  const M = MASKED(u), G = GOLD(u), to = G.clone().sub(M).setY(0).normalize();
  return M.addScaledVector(to, ahead).add(V3(0, up, 0));
}
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
  // (his blade down and out to his right: pointing on ahead of him, from behind it went end-on, a stub, and seemed to
  // vanish from his hand)
  hover: { root: [4, 0, 0], spine: [3, 0, 0], chest: [-2, 0, 0], neck: [6, 0, 0], legs: [12, 26, 4, 12, 30, 36],
    R: { grip: [-0.3, 0.93, 0.17], B: [-0.38, -0.84, 0.38], pn: [1, 0, 0], pole: [-1, -0.3, -0.6] }, L: { fk: [58, 18, 0, 118] }, gripL: 'fist' },
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
  // (braced under the other's weight, both hands on the hilt, the blade up across his face into the glaive's shaft)
  lock: { root: [-4, 0, 0], spine: [-4, 0, 0], chest: [-6, 0, 0], neck: [-14, 0, 0], legs: [20, 40, -10, 26, 30, 36],
    R: { grip: [-0.03, 1.55, 0.36], B: [0.45, 0.62, 0.64], pn: [1, 0, 0], pole: [-1, -0.5, -0.4] }, L: { two: -0.095, pn: [-1, 0, 0], pole: [1, -0.5, -0.4] }, gripL: 'fist' },
  struck: { root: [-24, 0, 6], spine: [-16, 0, 0], chest: [-20, 0, 0], neck: [-26, 0, 0], legs: [32, 52, 20, 30, 40, 40],
    R: { fk: [125, 70, 0, 30] }, L: { fk: [104, 80, 0, 40] }, gripL: 'open' },
  // (blown back out of their meeting: arched back hard, the chin down, the legs thrown on ahead, the arms flung back,
  // not as one another)
  blasted: { root: [-38, 6, 10], spine: [-18, 4, 0], chest: [-20, 8, 0], neck: [8, -8, 0], legs: [40, 66, 22, 48, 30, 30],
    R: { fk: [150, 100, -20, 55] }, L: { fk: [118, 70, 25, 72] }, gripL: 'open' },
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
  // (come down on him out of his dash: bent over the lock, his legs still trailing, the shaft across in both fists)
  lock: { root: [16, 0, 0], spine: [8, 0, 0], chest: [6, 0, 0], neck: [-10, 0, 0], legs: [-18, 64, -24, 70, 40, 40],
    R: { grip: [-0.3, 1.32, 0.38], B: [0.92, 0.32, 0.22], pn: [0, -0.6, -0.8], pole: [-1, -0.5, -0.4] }, L: { two: 0.55, th: -1, pn: [0, -0.6, -0.8], pole: [1, -0.5, -0.4] }, gripL: 'fist' },
  gather: { root: [18, 0, 0], spine: [16, 0, 0], chest: [12, 0, 0], neck: [10, 0, 0], legs: [44, 74, 34, 70, 30, 30],
    R: { grip: [-0.26, 1.02, 0.3], B: [0.96, 0.08, 0.26], pn: [0, -1, 0.1], pole: [-1, -0.5, -0.3] }, L: { two: 0.52, pn: [0, -1, 0.1], pole: [1, -0.5, -0.3] }, gripL: 'fist' },
  // (the glaive raised straight up over him, the storm's blade rising out of its head: raised back over his shoulder, its
  // head had come at the lens behind him)
  smashup: { root: [-8, 0, 0], spine: [-8, 0, 0], chest: [-10, 0, 0], neck: [-16, 0, 0], legs: [-6, 30, 10, 24, 40, 40],
    R: { grip: [-0.06, 1.9, 0.1], B: [0.02, 1, 0.06], pn: [0.7, -0.1, -0.7], pole: [-1, 0.2, -0.4] }, L: { two: 0.42, pn: [0.7, -0.1, -0.7], pole: [1, 0.2, -0.4] }, gripL: 'fist' },
  // (between: the glaive coming up from across him, and coming over from straight up into the stroke: each turn a
  // small one, so the hands do not whirl it the long way round, down and back, as they go from one hold to the next)
  lift: { root: [4, 0, 0], spine: [2, 0, 0], chest: [-2, 0, 0], neck: [-6, 0, 0], legs: [20, 50, 22, 46, 35, 35],
    R: { grip: [-0.16, 1.5, 0.3], B: [0.62, 0.75, 0.22], pn: [0.4, -0.6, -0.7], pole: [-1, -0.2, -0.4] }, L: { two: 0.48, pn: [0.4, -0.6, -0.7], pole: [1, -0.2, -0.4] }, gripL: 'fist' },
  over: { root: [10, 0, 0], spine: [8, 0, 0], chest: [6, 0, 0], neck: [-12, 0, 0], legs: [-12, 40, 4, 26, 42, 42],
    R: { grip: [-0.05, 1.75, 0.42], B: [0, 0.55, 0.84], pn: [0.7, -0.1, -0.7], pole: [-1, 0, -0.2] }, L: { two: 0.42, pn: [0.7, -0.1, -0.7], pole: [1, 0, -0.2] }, gripL: 'fist' },
  // (flung back and up out of the lock's burst: arched, the arms thrown out, the glaive flung wide)
  blasted: { root: [-34, 4, -8], spine: [-16, -4, 0], chest: [-18, -6, 0], neck: [10, 6, 0], legs: [36, 60, 18, 44, 40, 40],
    R: { fk: [140, 95, -10, 45] }, L: { fk: [118, 70, 25, 72] }, gripL: 'open' },
  smash: { root: [30, 0, 0], spine: [18, 0, 0], chest: [14, 0, 0], neck: [-12, 0, 0], legs: [-20, 50, 6, 30, 45, 45],
    R: { grip: [-0.04, 1.25, 0.5], B: [0, -0.55, 0.83], pn: [1, 0, 0], pole: [-1, -0.2, 0.2] }, L: { two: 0.45, pn: [-1, 0, 0], pole: [1, -0.2, 0.2] }, gripL: 'fist' },
};
// which pose when: [u, pose] (eased between neighbours over the span between them)
const SCHED_GOLD = [[49.0, 'hover'], [49.86, 'hover'], [50.02, 'raise'], [50.17, 'raise'], [50.2, 'dash'], [50.25, 'dash'], [50.29, 'blasted'], [50.36, 'blasted'], [50.47, 'hover'],
  [50.66, 'hover'], [50.71, 'windup'], [50.735, 'slash'], [50.86, 'slash'], [51.0, 'hover'], [51.16, 'hover'], [51.21, 'bell'], [51.5, 'bell'], [51.53, 'dash'],
  [51.555, 'lock'], [52.08, 'lock'], [52.13, 'struck'], [52.3, 'hover'], [52.384, 'hover'], [52.4, 'bell'], [52.445, 'bell'], [52.456, 'struck']];
const SCHED_MASKED = [[49.0, 'hover'], [50.16, 'hover'], [50.195, 'dash'], [50.25, 'dash'], [50.32, 'hover'], [50.9, 'hover'], [50.935, 'cutwind'], [50.955, 'cut'],
  [51.1, 'cut'], [51.18, 'raise'], [51.48, 'raise'], [51.53, 'dash'], [51.555, 'lock'], [52.08, 'lock'], [52.11, 'blasted'], [52.19, 'blasted'], [52.248, 'gather'], [52.342, 'gather'], [52.365, 'lift'], [52.386, 'smashup'],
  [52.392, 'smashup'], [52.42, 'over'], [52.44, 'smash'], [52.9, 'smash']];
function scheduleAt(S, u) {
  if (u <= S[0][0]) return [S[0][1], S[0][1], 0];
  for (let i = 0; i < S.length - 1; i++) if (u < S[i + 1][0]) return [S[i][1], S[i + 1][1], smooth(S[i][0], S[i + 1][0], u)];
  const l = S[S.length - 1][1];
  return [l, l, 0];
}

// ------------------------------------------------------------------ the weapons
// a straight sword along +y from the hand (the grip about y 0): the blade a flattened diamond tapering to a point,
// the guard, the grip, the pommel; uv.x across the blade (-1 edge, 0 ridge, 1 edge), uv.y along it (0 guard, 1 tip)
function swordGeometry({ L: len = 0.78, w = 0.022, t = 0.0045, guard = 0.1, grip = 0.19, rings = 18, root = 0 } = {}) {
  const pos = [], uv = [];
  const y0 = 0.085;
  const ring = k => {
    const s = k / rings, y = y0 + s * len;
    // (root: how much of its length a blade of light takes to swell out of a point at its root)
    const ww = w * (1 - 0.22 * s) * (s > 0.9 ? Math.sqrt(Math.max(0, 1 - (s - 0.9) / 0.1)) : 1) * (root > 0 && s < root ? Math.sqrt(0.04 + 0.96 * s / root) : 1);
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
  // (face by face: an extruded shape is already)
  const flat = g => (g.index ? g.toNonIndexed() : g);
  const m = [shaft, butt, collar].map(flat);
  const b = flat(blade);
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
// (the storm's: the same blade, with the storm in it, uStorm: veins of lightning crawling up through it, its edges torn
// and flickering; clean, it was a capsule of glass)
const PHANTOM_FS = `uniform float uAmt, uForm, uTime, uHot, uStorm, uFar, uNearK; uniform vec3 uCol; uniform sampler2D uNoise, tSky; uniform vec2 uRes, uNear;
varying vec2 vQ; varying vec3 vN, vV, vL;
void main(){
  float s = vQ.x, v = vQ.y;
  float n = texture2D(uNoise, vec2(s * .3 + .1, v * 2.4 - uTime * .04)).r;
  float front = uForm * 1.14 - .07 + (n - .5) * .1;
  float vv = v < 0. ? 0. : v;
  if (vv > front) discard;
  float seam = exp(-pow((front - vv) / .014, 2.)) * 7. * step(uForm, .995);
  if (uStorm > .5) {
    // (the storm's blade: violet storm light boiling up it, a white-hot heart down its middle, lightning crawling up
    // through it, its edges torn, its point dying into the dark. Lit pale all through, with a fine crackle in it, it was
    // an icicle; one even white band, a searchlight's beam)
    float n1 = texture2D(uNoise, vec2(s * .22 + uTime * .06, v * 1.1 - uTime * .8)).r;
    float n2 = texture2D(uNoise, vec2(s * .5 - uTime * .09, v * 2.6 - uTime * 1.6)).g;
    float boil = .4 + .6 * smoothstep(.3, .78, n1 * .6 + n2 * .4);
    float heart = exp(-s * s * 70.) * (1.15 + .45 * sin(uTime * 41. + v * 13.));
    float body = exp(-s * s * 1.6) * boil;
    float a1 = texture2D(uNoise, vec2(s * .3 + uTime * .8, v * 1.9 - uTime * 2.4)).r;
    float a2 = texture2D(uNoise, vec2(s * .45 - uTime * 1.2, v * 2.5 + uTime * 1.7)).b;
    float fl = .45 + .55 * step(.35, fract(uTime * 6.1 + v * .5));
    float vein = (exp(-pow((a1 - .5) / .016, 2.)) * 1.6 + exp(-pow((a2 - .5) / .012, 2.))) * fl * smoothstep(1., .55, abs(s));
    float torn = smoothstep(0., .3, 1. - abs(s) - .28 * texture2D(uNoise, vec2(v * 7. - uTime * 2.2, s * .4 + .3)).r);
    float tipF = smoothstep(1., .9, vv);
    float Is = (body * 1.05 + heart * (1. + uHot * 2.2) + vein * 1.8) * torn * tipF * uAmt + seam * uAmt;
    vec3 cs = mix(vec3(.46, .17, 1.), vec3(.97, .93, 1.), clamp(heart * .55 + vein * .45 + uHot * .3, 0., 1.));
    float Ts = texture2D(tSky, gl_FragCoord.xy / uRes).g;
    float nks = uNear.y > 0. ? smoothstep(uNear.x, uNear.y, length(vV)) : 1.;
    gl_FragColor = vec4(cs * Is * (.5 + .5 * Ts) * nks, 1.);
    return;
  }
  float fr = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.);
  float ridge = exp(-s * s * 160.) * 2.6;
  // (its edges, close by, only where its glow ends: drawn as bright lines, ruled from corner to corner of the frame, they
  // made it a plank, a glass ruler)
  float edge = exp(-pow((1. - abs(s)) / mix(mix(.05, .14, uNearK), .32, uFar), 2.)) * mix(mix(4.2, .45, uNearK), 2.2, uFar) + exp(-pow((1. - abs(s)) / .3, 2.)) * .45 * (1. - .75 * uNearK);
  float runes = smoothstep(.64, .74, texture2D(uNoise, vec2(s * .9 + .37, v * 7. - uTime * .55)).g) * (1. - abs(s) * .7) * .9;
  float flow = .65 + .35 * sin(v * 46. - uTime * 10.);
  // (the blade's own body is nearly clear: only its edges, its ridge and the runes in it burn)
  // (the storm's is light, not ice: a violet glow through its body, its frost and its facets' glint let go; mottled and
  // glinting it was a frosted crystal, quartz)
  // (its heat a white-hot line down its middle, not a fill: spread over its breadth, swung close by the lens, it was a
  // cream slab, a card)
  float body = v < 0. ? .03 + fr * 1.0 : .06 + .025 * n + uFar * (.2 + .07 * n) + uHot * exp(-s * s * 45.) * 1.1;
  // (swung close by the lens, uNearK: a glow hottest down its middle and fading out to its edges, so it is a breadth of
  // light going by: its glow laid even across it, between edges ruled from corner to corner of the frame, it was a cream
  // plank; narrower, between its ridge and its edges two dark grooves ran along it)
  // (and its light running along it as it swings, in streaks: even all along, it was a solid thing)
  float run = texture2D(uNoise, vec2(s * .35 + .2, v * 3.1 - uTime * 1.9)).g;
  body += uNearK * exp(-s * s * 2.2) * (.12 + .22 * smoothstep(.3, .8, run)) * step(0., v);
  float vein = 0.;
  if (uStorm > 0.) {
    float n1 = texture2D(uNoise, vec2(s * .42 + uTime * .7, v * 3.3 - uTime * 2.1)).r;
    float n2 = texture2D(uNoise, vec2(s * .9 - uTime * 1.1, v * 7.1 + uTime * 1.5)).g;
    float fl = .55 + .45 * sin(uTime * 53. + v * 23.) * sin(uTime * 29. + s * 4.);
    vein = (exp(-pow((n1 - .5) / .02, 2.)) * 3.4 + exp(-pow((n2 - .5) / .014, 2.)) * 2.2) * fl * uStorm;
    // (its edges torn: burning in patches, the runes gone to static; softer, not ruled)
    edge = mix(edge, (exp(-pow((1. - abs(s)) / .16, 2.)) * 1.6 + exp(-pow((1. - abs(s)) / .4, 2.)) * .35) * (.35 + 1.3 * texture2D(uNoise, vec2(s * .2 + .5, v * 11. - uTime * 3.)).b), uStorm);
    runes *= 1. - uStorm;
    ridge *= mix(1., .6 + .8 * fl, uStorm);
  }
  // (its light rising out of the burst of its hilt over the first few metres: begun at once at its root, swung close
  // by the lens, the root was a square end of light standing in the burst)
  float rootF = smoothstep(0., .035, v);
  float I = ((v < 0. ? body : body * rootF) + (fr * .4 * (1. - .7 * uStorm) + ridge + edge * flow + runes + vein) * rootF) * uAmt + seam * uAmt;
  vec3 c = mix(uCol, vec3(1., .92, .72), clamp((ridge * .3 + edge * .12) * (1. - .75 * uFar) + seam * .2 + uHot * exp(-s * s * 45.) * .5, 0., 1.));
  // (dimmed only by the cloud between it and the lens, where the cloud begins, sk.r, short of it: dimmed by all the cloud
  // as far as the lens's focus, the wisps beyond it laid dark blots along it as it went by)
  vec4 sk = texture2D(tSky, gl_FragCoord.xy / uRes);
  float T = mix(1., sk.g, smoothstep(sk.r - 30., sk.r + 80., length(vV)));
  // (uNear: what of it is close to the lens let go, so its swing past is the sweep of its length across the sky: whole,
  // swung down past the lens, its root there was a flat cream pane over half the frame)
  float nk = uNear.y > 0. ? smoothstep(uNear.x, uNear.y, length(vV)) : 1.;
  gl_FragColor = vec4(c * I * (.35 + .65 * T) * nk, 1.);
}`;
// (the crescent: its leading edge white-hot, its body gold with streaks running back along it; one half or both)
const CRES_FS = `uniform float uAmt, uTime, uHalf, uSeed; uniform vec3 uCol; uniform sampler2D uNoise, tSky; uniform vec2 uRes, uNear;
varying vec2 vQ; varying vec3 vN, vV, vL;
void main(){
  float x = vQ.x, y = vQ.y;
  if (uHalf * y < 0.) discard;
  float ends = 1. - smoothstep(.55, 1., abs(y));
  float lead = exp(-pow((x - .6) / .16, 2.)) * 3.2;
  float body = exp(-pow((x + .1) / .55, 2.)) * .35;
  float n = texture2D(uNoise, vec2(y * 1.7 + uSeed, x * .4 - uTime * 1.6)).r;
  float st = smoothstep(.5, .85, texture2D(uNoise, vec2(y * 5.3 + uSeed, x * .12 + uTime * .4)).g) * smoothstep(.95, -.6, x) * .8;
  // (where it was split: the broken end torn, going to nothing at the break and burning white just behind it; cut
  // square across its breadth, each half had been a pane of glass)
  float rg = .05 + .08 * texture2D(uNoise, vec2(x * .7 + uSeed * 1.3, uTime * .5)).r;
  float cut = uHalf != 0. ? smoothstep(.0, rg, abs(y)) : 1.;
  float I = (lead + body * (.55 + .7 * n) + st) * ends * uAmt * cut;
  vec3 c = mix(uCol, vec3(1., .98, .93), clamp(lead * .22, 0., 1.));
  c = mix(c, vec3(1.), step(.001, abs(uHalf)) * exp(-max(abs(y) - rg, 0.) * 14.) * .8);
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).g;
  // (uNear: a half going by the lens let go: one goes apart past him on the lens's side, its arc a hundred metres
  // across, and a few metres off it would have been a pane over the frame)
  float nk = uNear.y > 0. ? smoothstep(uNear.x, uNear.y, length(vV)) : 1.;
  gl_FragColor = vec4(c * I * (.4 + .6 * T) * nk, 1.);
}`;
// (the bell: a shell of gold light, a lattice of runes over it, rings running out over it from each bolt, cracking; the
// same shell, split gold and violet, is the light pressed out of the lock: mode 1)
const BELL_FS = `uniform float uAmt, uTime, uCrack, uMode, uBreak; uniform vec3 uCol, uCol2, uAxis; uniform vec4 uHit[4]; uniform sampler2D uNoise, tSky; uniform vec2 uRes;
varying vec2 vQ; varying vec3 vN, vV, vL;
void main(){
  vec3 n = normalize(vN), v = normalize(vV), p = normalize(vL);
  // (breaking: falling away in pieces along its cracks, their edges burning)
  float shard = texture2D(uNoise, p.xz * 1.6 + p.y * .9 + .41).r;
  if (uBreak > 0. && shard < uBreak) discard;
  float rim = uBreak > 0. ? exp(-pow((shard - uBreak) / .03, 2.)) * 6. * uBreak : 0.;
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
  if (uMode > 1.5) {
    // (thrown up in haste: a thin shell, its rim burning, its lattice only a ghost, so the one inside it shows)
    grid *= .22; rune *= .15; fr *= 1.35;
  } else if (uMode > .5) {
    // (split down the middle between them, gold and violet, churning; veins of lightning crawling over it)
    float sd = dot(p, uAxis);
    col = mix(uCol2, uCol, smoothstep(-.12, .12, sd + (texture2D(uNoise, vec2(lat * .6, uTime * .2)).r - .5) * .3));
    grid *= 0.; rune *= 0.;
    float sw = texture2D(uNoise, vec2(lon * .5 + uTime * .3, lat * .8 - uTime * .2)).g;
    float vn = texture2D(uNoise, vec2(lon * 1.3 - uTime * .05, lat * 1.9 + uTime * .07)).r;
    // (let go where the shell is near the lens: racing out past it, its veins were a net of cells over the whole frame)
    float vein = exp(-pow((vn - .5) / .018, 2.)) * 2.6 * (.6 + .4 * sin(uTime * 37. + lon * 5.)) * smoothstep(80., 400., length(vV));
    // (its body thin, its rim and its veins burning: a shell of force, not a moon)
    fr = fr * 2.1 + .14 * sw + .04 + vein;
  }
  // (its lattice thinning toward the middle of it as seen, so the one inside shows through)
  if (uMode < .5) { float th = mix(.3, 1., smoothstep(.0, .3, fr)); grid *= th; rune *= th; }
  // (the one thrown up in haste clear in its middle but for its cracks: there he is, in white, behind it; washed with
  // its light all over, he had been a few strokes of ink on the glass)
  if (uMode > 1.5) { float th = smoothstep(.02, .45, fr); grid *= th; rune *= th; flash *= mix(.3, 1., th); ring *= mix(.25, 1., th); crack *= mix(.4, 1., th); }
  float I = (fr * 1.0 + grid * (.32 + .6 * fr) + rune * .7 + ring + flash * .8 + crack + rim) * flick * uAmt;
  vec3 c = mix(col, vec3(1., .95, .85), clamp(ring * .15 + flash * .12 + crack * .2 + fr * .08, 0., 1.));
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).g;
  gl_FragColor = vec4(c * I * (.4 + .6 * T), 1.);
}`;
// (the bell broken: its pieces flung out from under the blade, tumbling, their edges burning, going out as they go; it
// had only melted away where it was, whole and then gone)
const SHARD_VS = `attribute vec3 aC, aB; attribute vec4 aR; uniform float uAge; uniform vec3 uPush; varying vec3 vB, vL; varying float vA, vNear, vR;
vec3 rot(vec3 p, vec3 ax, float a){ return p * cos(a) + cross(ax, p) * sin(a) + ax * dot(ax, p) * (1. - cos(a)); }
void main(){
  vB = aB; vL = position * 2.7 + aR.xyz * 5.; vR = aR.w;
  float t = uAge;
  vec3 ax = normalize(aR.xyz - .5 + vec3(1e-3));
  vec3 q = rot(position - aC, ax, t * (3. + 9. * aR.w)) * (1. - .35 * t);
  vec3 c = aC * (1. + t * (.5 + .9 * aR.x)) + uPush * t * (.6 + .8 * aR.y) + vec3(0., -1.4, 0.) * t * t;
  vec4 wp = modelMatrix * vec4(c + q, 1.);
  vA = (1. - smoothstep(.45, 1., t)) * step(0., t);
  vNear = smoothstep(2.5, 9., length(cameraPosition - wp.xyz));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
// (each a piece of the shell's glass: all but clear, its broken edge ragged and burning in from the break as it flies, now
// and then catching the light as it turns: lit only along their straight edges, they were outlined triangles, paper
// confetti; filled with the shell's light, they were the same confetti, solid)
const SHARD_FS = `uniform vec3 uCol; uniform float uAmt, uAge; uniform sampler2D uNoise; varying vec3 vB, vL; varying float vA, vNear, vR;
void main(){
  float e = min(vB.x, min(vB.y, vB.z)) * 3.;
  float n = texture2D(uNoise, vL.xy * .21 + vL.z * .13).r, n2 = texture2D(uNoise, vL.yz * .47 + .3).g;
  float k = e + (n - .5) * 1.1 + (n2 - .5) * .35;
  float th = .18 + .6 * smoothstep(.15, 1., uAge);
  float body = smoothstep(th, th + .14, k), rim = exp(-pow((k - th - .03) / .045, 2.));
  // (their edges burning gold, a glow going in from them, the glass between faintly lit: a white line round each, with
  // nothing in it, they were outlined triangles, clip-art)
  float glow = exp(-pow((k - th - .03) / .16, 2.)) * body;
  float glint = pow(.5 + .5 * sin(uAge * 23. + vR * 41.), 8.);
  vec3 c = mix(uCol, vec3(1., .96, .86), clamp(rim * .25 + glint * .7, 0., 1.));
  gl_FragColor = vec4(c * (body * (.12 + .9 * glint) + glow * .55 + rim * 2.1) * vA * vNear * uAmt, 1.);
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
// (the storm's blade's own glow about it in the dark, broad and soft, so it is light and not a solid: a plane in the
// blade's own frame, its flat to the lens)
const SAURA_VS = `varying vec2 vQ; void main(){ vQ = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const SAURA_FS = `uniform vec3 uCol; uniform float uAmt, uTime, uNearK; uniform sampler2D uNoise; varying vec2 vQ;
void main(){
  float x = vQ.x * 2. - 1., y = vQ.y;
  float n = texture2D(uNoise, vec2(x * .3 + uTime * .05, y * 1.4 - uTime * .6)).r;
  // (gone to nothing before the plane's own edge: a twenty-fifth of it left there, the edge rode the blade's flank
  // across the sky as a pane of glass with a ruler-straight side)
  // (close by the lens, uNearK, only its broad haze: its core is the blade's own breadth, and laid over the blade swung
  // past the lens it filled it even, a plank)
  float g = (exp(-x * x * 9.) * .9 * (1. - .85 * uNearK) + exp(-x * x * 2.2) * .35 * (1. - .4 * uNearK)) * smoothstep(1., .62, abs(x)) * smoothstep(0., .06, y) * smoothstep(1.02, .82, y) * (.75 + .5 * n);
  gl_FragColor = vec4(uCol * g * uAmt, 1.);
}`;
// (the wake of the great sword's cut: a fan from its hilt over the angle its length has just swept, brightest just
// behind the blade and fading back; laid out in the plane of the cut)
const SMEAR_VS = `uniform vec3 uPivot, uE0, uE1; uniform float uA0, uA1, uL; varying vec2 vQ;
void main(){
  vQ = uv;
  float a = mix(uA0, uA1, uv.x), r = mix(.12, 1., uv.y) * uL;
  gl_Position = projectionMatrix * viewMatrix * vec4(uPivot + (uE0 * cos(a) + uE1 * sin(a)) * r, 1.);
}`;
const SMEAR_FS = `uniform vec3 uCol; uniform float uAmt, uTime; uniform sampler2D uNoise; varying vec2 vQ;
void main(){
  float a = vQ.x, r = vQ.y;
  float n = texture2D(uNoise, vec2(r * 2.3 - uTime * .2, a * .9 + .3)).r;
  float g = pow(1. - a, 2.4) * smoothstep(0., .3, r) * smoothstep(1., .84, r) * (.5 + .5 * n) * (.55 + .45 * r);
  float lead = exp(-a * 16.) * smoothstep(.15, .45, r) * smoothstep(1., .9, r);
  gl_FragColor = vec4(mix(uCol, vec3(1., .95, .82), lead * .45) * (g * .8 + lead) * uAmt, 1.);
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
const RIBBON_FS = `uniform vec3 uCol, uSun, uSunCol, uSky, uGlow; uniform sampler2D uNoise; uniform float uSeed, uTorn; varying float vT, vX; varying vec3 vNw;
void main(){
  float e = abs(vX - .5) * 2.;
  // (the masked one's torn along its edges and at its end, and folded down its length: cut clean and lit even, his long
  // streamer from behind was a flat violet board with ruler-straight sides hung under his mantle)
  float tear = texture2D(uNoise, vec2(vT * 2.3 + uSeed * .13, (vX > .5 ? .27 : .71) + uSeed * .05)).r;
  if (e > 1. - vT * .55 - uTorn * (tear - .35) * .4 * smoothstep(0., .25, vT) || vT > .985 - uTorn * tear * .14) discard;
  float l = abs(dot(normalize(vNw), uSun));
  float fold = mix(1., .76 + .24 * sin(vX * 11. + vT * 2.4 + uSeed) * sin(vX * 4.3 - uSeed), uTorn);
  vec3 c = (uCol * (uSunCol * (.25 + .75 * l) * 1.3 + uSky * .45) + uGlow * (1. - vT) * .5) * fold;
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
  const mantle = garb.dress(masked).mantle;
  const mantle0 = mantle.position.clone(), MANTLE_TOP = V3(0, 0.29, 0);
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
  // (the glaive's head, its mark given as the update says: while the storm's blade burns out of it, light and not a solid
  // thing, so no line is drawn round it; outlined, it was a hollow shape with the blade's glow showing through it)
  const glaiveFigA = { value: 1.1 };
  const figMark = (m, aU = null) => {
    const prev = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      if (aU) { sh.uniforms.uFigA = aU; sh.fragmentShader = 'uniform float uFigA;\n' + sh.fragmentShader; }
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = ' + (aU ? 'uFigA' : '1.1') + ';');
    };
    m.customProgramCacheKey = () => key + (aU ? '-figmarkU' : '-figmark');
  };
  for (const m of [bladeMat, shaftMat, crownMat, garb.robeMat, garb.maskMat, garb.trimMat, garb.eyeMat]) figMark(m);
  figMark(glaiveMat, glaiveFigA);
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
      uniforms: { uFlow: { value: V3(0, 0, -1) }, uLen: { value: len }, uTime: U.uTime, uSeed: { value: seed }, uFlap: { value: 7 }, uSag: { value: 0.35 }, uCol: { value: new THREE.Color(...col) }, uGlow: { value: new THREE.Color(...(glow || [0, 0, 0])) }, uNoise: U.uNoise, uTorn: { value: p === masked ? 1 : 0 }, ...sun },
    }));
    m.frustumCulled = false;
    holder.add(m);
    ribbons.push({ m, p, len });
  };
  // (his sash's ends no longer than to his knees: hanging still, they dangled a stray pair of gold wires under his feet)
  ribbon(gold, 'hips', [0.06, 0.06, 0.13], [1, 0, 0], 0.72, 0.07, [0.86, 0.6, 0.16], 1, [0.4, 0.25, 0.05]);
  ribbon(gold, 'hips', [-0.05, 0.06, 0.13], [1, 0, 0], 0.58, 0.06, [0.86, 0.6, 0.16], 2.7, [0.4, 0.25, 0.05]);
  ribbon(gold, 'head', [0, -0.1, -0.13], [1, 0, 0], 0.7, 0.05, [0.06, 0.05, 0.05], 4.1);
  // (his sleeves short and broad, the cloth of them: seventy centimetres long and narrowing to a point, the one off his
  // raised hand was taken for a curved blade in it, then a spike, then a flag)
  ribbon(gold, 'foreArmL', [0.05, -0.18, 0], [0, 0, 1], 0.4, 0.24, [0.88, 0.86, 0.81], 5.3);
  ribbon(gold, 'foreArmR', [-0.05, -0.18, 0], [0, 0, 1], 0.4, 0.24, [0.88, 0.86, 0.81], 6.9);
  ribbon(masked, 'chest', [0, 0.1, -0.16], [1, 0, 0], 1.7, 0.42, [0.04, 0.035, 0.045], 8.2, [0.035, 0.01, 0.07]);
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
  // (full-bladed right out of the burst of its hilt: swelling out of a point there, even over the first few metres, it
  // was pointed at both ends)
  const phantom = new THREE.Mesh(swordGeometry({ L: 1, w: 0.042, t: 0.007, guard: 0, grip: 0.07, rings: 44, root: 0 }), new THREE.ShaderMaterial({
    vertexShader: LIGHT_VS, fragmentShader: PHANTOM_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uForm: { value: 0 }, uHot: { value: 0 }, uStorm: { value: 0 }, uFar: { value: 0 }, uNearK: { value: 0 }, uNear: { value: new THREE.Vector2(9, 28) }, uCol: { value: new THREE.Color(1, 0.6, 0.2) }, ...shared },
  }));
  phantom.frustumCulled = false; phantom.renderOrder = 21; phantom.visible = false;
  group.add(phantom);
  const phantomAura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 8).translate(0, 0.5, 0), new THREE.ShaderMaterial({ vertexShader: SAURA_VS, fragmentShader: SAURA_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uNearK: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.62, 0.22) }, uTime: U.uTime, uNoise: shared.uNoise } }));
  phantomAura.frustumCulled = false; phantomAura.renderOrder = 20; phantomAura.visible = false;
  group.add(phantomAura);
  const smear = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 28, 6).translate(0.5, 0.5, 0), new THREE.ShaderMaterial({ vertexShader: SMEAR_VS, fragmentShader: SMEAR_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.66, 0.26) }, uPivot: { value: V3() }, uE0: { value: V3() }, uE1: { value: V3() }, uA0: { value: 0 }, uA1: { value: 0 }, uL: { value: 1 }, uTime: U.uTime, uNoise: shared.uNoise } }));
  smear.frustumCulled = false; smear.renderOrder = 20; smear.visible = false;
  group.add(smear);
  // ---- the storm's blade: the masked one's answer, the same light in violet (the same program as the sword of light)
  const stormBlade = new THREE.Mesh(swordGeometry({ L: 1, w: 0.042, t: 0.007, guard: 0, grip: 0.07, rings: 48, root: 0.12 }), new THREE.ShaderMaterial({
    vertexShader: LIGHT_VS, fragmentShader: PHANTOM_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uForm: { value: 0 }, uHot: { value: 0 }, uStorm: { value: 1 }, uFar: { value: 0 }, uNearK: { value: 0 }, uNear: { value: new THREE.Vector2(0, 0) }, uCol: { value: new THREE.Color(0.62, 0.3, 1.0) }, ...shared },
  }));
  stormBlade.frustumCulled = false; stormBlade.renderOrder = 21; stormBlade.visible = false;
  group.add(stormBlade);
  const stormAura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 8).translate(0, 0.5, 0), new THREE.ShaderMaterial({ vertexShader: SAURA_VS, fragmentShader: SAURA_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uNearK: { value: 0 }, uCol: { value: new THREE.Color(0.5, 0.2, 1.0) }, uTime: U.uTime, uNoise: shared.uNoise } }));
  stormAura.frustumCulled = false; stormAura.renderOrder = 20; stormAura.visible = false;
  group.add(stormAura);
  // (and the wake of its sweep down the sky, from afar: the breadth of sky it has just cut through, burning behind it, so
  // the sweep is the size of the sky and not a stick turning over the star)
  const stormSmear = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 28, 6).translate(0.5, 0.5, 0), new THREE.ShaderMaterial({ vertexShader: SMEAR_VS, fragmentShader: SMEAR_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uCol: { value: new THREE.Color(0.55, 0.24, 1.0) }, uPivot: { value: V3() }, uE0: { value: V3() }, uE1: { value: V3() }, uA0: { value: 0 }, uA1: { value: 0 }, uL: { value: 1 }, uTime: U.uTime, uNoise: shared.uNoise } }));
  stormSmear.frustumCulled = false; stormSmear.renderOrder = 20; stormSmear.visible = false;
  group.add(stormSmear);
  const stormHilt = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: AURA_VS, fragmentShader: AURA_FS, ...ADD, depthTest: true,
    uniforms: { uSize: { value: 14 }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(0.68, 0.36, 1.0) }, uTime: U.uTime } }));
  stormHilt.frustumCulled = false; stormHilt.renderOrder = 21; stormHilt.visible = false; group.add(stormHilt);
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
    uniforms: { uAmt: { value: 0 }, uHalf: { value: h }, uSeed: { value: h * 3.1 + 0.4 }, uNear: { value: new THREE.Vector2(h ? 12 : 0, h ? 30 : 0) }, uCol: { value: new THREE.Color(1, 0.72, 0.32) }, ...shared } });
  const cres = [cresMat(0), cresMat(1), cresMat(-1)].map(m => { const x = new THREE.Mesh(cresGeo, m); x.frustumCulled = false; x.renderOrder = 21; x.visible = false; group.add(x); return x; });
  // ---- the bell, and the light of the lock
  // (fine enough that filling the frame its outline is round: coarser, it was faceted down both sides)
  const bellGeo = new THREE.IcosahedronGeometry(1, 9);
  const bellMat = mode => new THREE.ShaderMaterial({ vertexShader: LIGHT_VS, fragmentShader: BELL_FS, side: THREE.DoubleSide, ...ADD,
    uniforms: { uAmt: { value: 0 }, uCrack: { value: 0 }, uMode: { value: mode }, uBreak: { value: 0 }, uCol: { value: new THREE.Color(1, 0.74, 0.34) }, uCol2: { value: new THREE.Color(0.62, 0.28, 1.0) }, uAxis: { value: AX.clone() },
      uHit: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 1, 0, -1)) }, ...shared } });
  const bell = new THREE.Mesh(bellGeo, bellMat(0)), press = new THREE.Mesh(bellGeo, bellMat(1));
  press.material.uniforms.uCol.value.setRGB(1, 0.58, 0.14); press.material.uniforms.uCol2.value.setRGB(0.5, 0.14, 1);
  for (const m of [bell, press]) { m.frustumCulled = false; m.renderOrder = 21; m.visible = false; group.add(m); }
  const shards = (() => {
    // (pieces of every size and shape, and not every piece of it: all alike, a full set of triangles, they were a
    // shower of paper confetti)
    // (a polyhedron is drawn face by face already: each face its own three corners)
    const g0 = new THREE.IcosahedronGeometry(1, 3), P = g0.attributes.position, n = P.count;
    const C = new Float32Array(n * 3), B = new Float32Array(n * 3), R = new Float32Array(n * 4), r = (k => () => (k = (k * 16807) % 2147483647) / 2147483647)(91);
    for (let f = 0; f < n; f += 3) {
      const cx = (P.getX(f) + P.getX(f + 1) + P.getX(f + 2)) / 3, cy = (P.getY(f) + P.getY(f + 1) + P.getY(f + 2)) / 3, cz = (P.getZ(f) + P.getZ(f + 1) + P.getZ(f + 2)) / 3;
      const rr = [r(), r(), r(), r()];
      const keep = r() > 0.45, sz = keep ? lerp(0.35, 1.05, r() * r()) : 0;
      for (let j = 0; j < 3; j++) {
        const x = cx + (P.getX(f + j) - cx) * sz * lerp(0.7, 1.3, r()), y = cy + (P.getY(f + j) - cy) * sz * lerp(0.7, 1.3, r()), z = cz + (P.getZ(f + j) - cz) * sz * lerp(0.7, 1.3, r());
        P.setXYZ(f + j, x, y, z);
        C.set([cx, cy, cz], (f + j) * 3); B.set([j === 0 ? 1 : 0, j === 1 ? 1 : 0, j === 2 ? 1 : 0], (f + j) * 3); R.set(rr, (f + j) * 4);
      }
    }
    g0.setAttribute('aC', new THREE.BufferAttribute(C, 3)); g0.setAttribute('aB', new THREE.BufferAttribute(B, 3)); g0.setAttribute('aR', new THREE.BufferAttribute(R, 4));
    const m = new THREE.Mesh(g0, new THREE.ShaderMaterial({ vertexShader: SHARD_VS, fragmentShader: SHARD_FS, side: THREE.DoubleSide, ...ADD,
      uniforms: { uAge: { value: -1 }, uAmt: { value: 0 }, uPush: { value: V3() }, uCol: { value: new THREE.Color(1, 0.72, 0.3) }, ...shared } }));
    m.frustumCulled = false; m.renderOrder = 21; m.visible = false; group.add(m);
    return m;
  })();
  // (the shock of the hardest blows: a shell of light thrown out from where they met, racing out and thinning)
  const domes = [0, 1].map(() => { const m = new THREE.Mesh(bellGeo, bellMat(1)); m.frustumCulled = false; m.renderOrder = 21; m.visible = false;
    m.material.uniforms.uCol.value.setRGB(1, 0.9, 0.75); m.material.uniforms.uCol2.value.setRGB(0.85, 0.75, 1); group.add(m); return m; });
  // (the lights' own cue clock, given by the engine: how long since the story crossed a moment, on the clock)
  const _a = V3(), _b = V3(), _c = V3(), _gx = V3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const _qc = new THREE.Quaternion(), _qh = new THREE.Quaternion(), _hy = V3(), _ht = V3();

  // pose a figure: the pose blended between two of its poses, the root placed and turned to face the other
  // (tremble: shaking with the fury he gathers, 0..1)
  let tremble = 0;
  function poseFigure(p, P0, which, name0, name1, w, time) {
    const S = p._, rig = S.rig, K = S.K;
    const hand = hands[which];
    if (!S.PA) { S.PA = rig.newPose(); S.PB = rig.newPose(); }
    const build = (D, P) => {
      K.base(P);
      P.rp.set(0, rig.bindPos[0].y, 0);
      const trm = which === 'masked' ? tremble : tremble < 0.6 ? tremble : 0;
      const br = Math.sin(time * 1.4 + (which === 'gold' ? 0 : 2)) * 1.2 + trm * (Math.sin(time * 41) * 2.8 + Math.sin(time * 27 + 1.3) * 1.9);
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
    const D0 = P0[name0], D1 = P0[name1];
    // (between two holds of the weapon, the hands go from the one to the other along the way between them, the weapon
    // turning the short way: its grip, its heading and the palm eased, and the arm put there; the bones' own blend turned
    // the glaive the long way round, down through his legs and back, on its way up)
    if (w > 0.001 && name1 !== name0 && sameHold(D0, D1)) build(mixPose(D0, D1, w), S.PA);
    else {
      build(D0, S.PA);
      if (w > 0.001 && name1 !== name0) { build(D1, S.PB); rig.blend(S.PA, S.PB, w); }
    }
    rig.apply(S.PA);
    return S.PA;
  }
  const kindOf = H => (H.fk ? 'fk' : H.two != null ? 'two' : 'grip');
  const sameHold = (D0, D1) => kindOf(D0.R) === kindOf(D1.R) && kindOf(D0.L) === kindOf(D1.L) && kindOf(D0.R) !== 'fk';
  const mixA = (a, b, w) => a.map((x, i) => lerp(x, b[i], w));
  // (a heading turned the short way round: eased straight, two headings nearly opposite pass through nothing halfway and
  // the blade flips in a frame)
  const _s0 = V3(), _s1 = V3();
  const slerpA = (a, b, w) => {
    _s0.set(...a).normalize(); _s1.set(...b).normalize();
    const d = clamp(_s0.dot(_s1), -1, 1), th = Math.acos(d);
    if (th < 1e-3) return mixA(a, b, w);
    if (Math.PI - th < 1e-3) { const p = V3(1, 0, 0).addScaledVector(_s0, -_s0.x); if (p.lengthSq() < 1e-6) p.set(0, 1, 0).addScaledVector(_s0, -_s0.y); p.normalize(); return _s0.clone().multiplyScalar(Math.cos(w * Math.PI)).addScaledVector(p, Math.sin(w * Math.PI)).toArray(); }
    const k0 = Math.sin((1 - w) * th) / Math.sin(th), k1 = Math.sin(w * th) / Math.sin(th);
    return [_s0.x * k0 + _s1.x * k1, _s0.y * k0 + _s1.y * k1, _s0.z * k0 + _s1.z * k1];
  };
  const HEADINGS = new Set(['B', 'pn', 'fd', 'pd', 'pole']);
  const mixH = (A, B, w) => {
    const H = {};
    for (const key of Object.keys(A)) H[key] = Array.isArray(A[key]) ? (HEADINGS.has(key) ? slerpA(A[key], B[key], w) : mixA(A[key], B[key], w)) : typeof A[key] === 'number' && typeof B[key] === 'number' ? lerp(A[key], B[key], w) : (w < 0.5 ? A[key] : B[key]);
    return H;
  };
  const mixPose = (D0, D1, w) => ({ root: mixA(D0.root, D1.root, w), spine: mixA(D0.spine, D1.spine, w), chest: mixA(D0.chest, D1.chest, w), neck: mixA(D0.neck, D1.neck, w),
    legs: mixA(D0.legs, D1.legs, w), R: mixH(D0.R, D1.R, w), L: mixH(D0.L, D1.L, w), gripL: w < 0.5 ? D0.gripL : D1.gripL });
  const lean = (D0, D1, w) => [lerp(D0.root[0], D1.root[0], w), lerp(D0.root[1], D1.root[1], w), lerp(D0.root[2], D1.root[2], w)];
  const _face = V3(), _e = new THREE.Euler();
  function place(p, P0, which, at, toward, sched, u, time) {
    const [n0, n1, w] = scheduleAt(sched, u);
    poseFigure(p, P0, which, n0, n1, w, time);
    const [rx, , rz] = lean(P0[n0], P0[n1], w);
    _face.copy(toward).sub(at).setY(0);
    const yaw = Math.atan2(_face.x, _face.z);
    // (flung back out of the burst: over backwards and round, righting himself to hang there; a twenty-degree roll had
    // not been a tumble)
    const tk = which === 'masked' ? smooth(52.09, 52.235, u) : 0, tum = Math.sin(Math.PI * tk);
    _e.set((rx - 360 * tk) * Math.PI / 180, yaw + 0.4 * tum, (rz + 25 * tum) * Math.PI / 180, 'YXZ');
    p.root.quaternion.setFromEuler(_e);
    // (the path is where the figure's middle is: the root put so)
    p.root.position.copy(at).add(_a.set(0, -1.05 * p.root.scale.y, 0).applyQuaternion(p.root.quaternion));
  }

  return {
    group, gold, masked, sword, glaive, phantom, phantomAura, smear, stormBlade, stormAura, stormSmear, bell, press, cres, qiG, qiM,
    shared, sun,
    // u: the story; time: the clock; cueAge(at): seconds since the story crossed `at` (Infinity if not yet);
    // camera; k: how much of the war is in view (0..1); env: { sunDir, sunCol, sky }
    update(u, time, camera, k, cueAge, env = null) {
      BELL_NOW_U = u;
      const on = k > 0.001 && u > WAR[0] - 0.3 && u < 53.0;
      group.visible = on;
      if (!on) return;
      if (env) { sun.uSun.value.copy(env.sunDir); sun.uSunCol.value.copy(env.sunCol); sun.uSky.value.copy(env.sky); }
      // (still while they are locked together, or meet)
      const free = 1 - Math.max(band(51.54, 51.556, 52.08, 52.1, u), band(50.235, 50.25, 50.25, 50.265, u));
      const G = GOLD(u, V3()).addScaledVector(bob(time, 0.3), free), M = MASKED(u, V3()).addScaledVector(bob(time + 7, 2.1), free);
      // (locked, never still: the two rock together, shivering with the strain, the blade grinding along the shaft; a
      // posed photograph otherwise)
      const strain = band(51.556, 51.57, 52.06, 52.1, u);
      if (strain > 0) {
        const rock = _c.set(Math.sin(time * 5.1) * 0.035, Math.sin(time * 3.7 + 1) * 0.025, 0).multiplyScalar(strain);
        const jit = _b.set(Math.sin(time * 43), Math.sin(time * 37 + 1), Math.cos(time * 41)).multiplyScalar(0.01 * strain);
        G.addScaledVector(AX, rock.x).add(_a.set(0, rock.y, 0)).add(jit); M.addScaledVector(AX, rock.x).add(_a.set(0, rock.y, 0)).add(jit);
        const grind = Math.sin(time * 2.3) * 0.02 * strain;
        G.addScaledVector(NX, grind); M.addScaledVector(NX, -grind);
      }
      // (the masked one shaking with the fury he gathers, the storm pouring into him; then letting it go)
      const fury = band(...FURY.gather, u), loose = band(FURY.raise[0], FURY.raise[1], FURY.hit, FURY.hit + 0.03, u);
      tremble = Math.max(fury, 0.5 * strain);
      if (fury > 0) M.add(_c.set(Math.sin(time * 47) * 0.055, Math.sin(time * 39 + 1) * 0.045, Math.cos(time * 43) * 0.055).multiplyScalar(fury));
      // (the figures only where the lens is near enough to see them)
      const dG = camera.position.distanceTo(G), dM = camera.position.distanceTo(M);
      // (smashed out of the shattered bell he is his light, falling: drawn as well, he was a dashed ghost in it, a hollow
      // outline, and his light hid behind him)
      gold.root.visible = dG < 260 && u < WAR[1] + 0.02 && u < FURY.hit + 0.003;
      masked.root.visible = dM < 260 && u < WAR[1] + 0.4;
      if (gold.root.visible) place(gold, P_GOLD, 'gold', G, M, SCHED_GOLD, u, time);
      if (masked.root.visible) {
        place(masked, P_MASKED, 'masked', M, G, SCHED_MASKED, u, time);
        masked.root.updateMatrixWorld(true);
        // (his mantle hangs from his shoulders, about its collar: carried stiff with his chest, as he bent over the
        // glaive it stood up off his back, from behind the canopy of an umbrella over a box)
        {
          mantle.parent.getWorldQuaternion(_qc);
          const yW = _hy.set(0, 1, 0).applyQuaternion(_qc), tgt = _ht.copy(yW).lerp(UPV, 0.45).normalize();
          _qh.setFromUnitVectors(yW, tgt);
          mantle.quaternion.copy(_qc).invert().multiply(_qh).multiply(_qc);
          mantle.position.copy(mantle0).add(MANTLE_TOP).sub(_ht.copy(MANTLE_TOP).applyQuaternion(mantle.quaternion));
          mantle.updateMatrixWorld(true);
        }
        GLAIVE_HEAD.set(0, 1.5, 0).applyMatrix4(glaive.matrixWorld);
      } else GLAIVE_HEAD.copy(M).add(_a.set(0, 2.4, 0));
      // (the light about each, a little behind them from the lens: they stand against it)
      for (const [i, P, vis, amt] of [[0, G, gold.root.visible, 0.9], [1, M, masked.root.visible, 0.6 + 1.8 * fury + 2.2 * loose]]) {
        const A2 = aura[i];
        A2.visible = vis;
        if (!vis) continue;
        const d = camera.position.distanceTo(P);
        A2.position.copy(P).addScaledVector(_c.copy(P).sub(camera.position).normalize(), 1.4).add(_b.set(0, 0.25, 0));
        A2.material.uniforms.uSize.value = 0.85 + 0.011 * d;
        A2.material.uniforms.uAmt.value = amt * (1 + 0.6 * band(51.553, 51.56, 52.08, 52.12, u)) * smooth(260, 120, d) * smooth(1.5, 6, d);
      }
      // (the blade lit with his qi as he gathers himself, blazing in the lock; the glaive's edge with the masked one's)
      bladeMat.emissiveIntensity = 0.4 + 2.2 * band(49.86, 50.0, 50.2, 50.26, u) + 2.4 * band(50.66, 50.7, 50.76, 50.82, u) + 1.1 * band(51.53, 51.56, 52.08, 52.12, u);
      glaiveMat.emissiveIntensity = 0.35 + 1.6 * band(50.9, 50.93, 50.97, 51.02, u) + 2.2 * band(51.15, 51.2, 51.46, 51.5, u) + 0.5 * band(51.53, 51.56, 52.08, 52.12, u) + 3.6 * band(52.25, 52.33, 52.44, 52.47, u);
      // streamers: back along the way the air goes past them, harder the faster they go
      const vG = GOLD(u + 0.004, _b).sub(GOLD(u - 0.004, _c)).divideScalar(0.008 / RATE);
      const vM = MASKED(u + 0.004, _b.clone()).sub(MASKED(u - 0.004, _c)).divideScalar(0.008 / RATE);
      const hang = Math.max(fury, loose), lockK = band(51.55, 51.56, 52.06, 52.1, u);
      for (const r of ribbons) {
        const v = r.p === gold ? vG : vM;
        const sp = v.length();
        const U2 = r.m.material.uniforms;
        // (hanging, a breeze across them; streaming straight back when they fly)
        U2.uFlow.value.set(0.25, -0.15, 0.2).addScaledVector(v, -1 / Math.max(sp, 1) * Math.min(1, sp / 30) * 2.2);
        // (his, while the storm pours into him: hanging, a little toward the other, never back at the lens behind him)
        if (r.p === masked && hang > 0) U2.uFlow.value.lerp(_c.copy(G).sub(M).setY(0).normalize().multiplyScalar(0.15).add(_b.set(0, -1, 0)), hang);
        U2.uLen.value = r.p === masked ? r.len * (1 - 0.45 * hang) : r.len;
        // (and locked, still streaming back from his dash down onto the other: hanging under him, his mantle had been a
        // board below his feet)
        if (r.p === masked && lockK > 0) U2.uFlow.value.lerp(_c.copy(M).sub(G).setY(0).normalize().add(_b.set(0, 0.25, 0)), lockK);
        U2.uSag.value = lerp(0.9, 0.12, Math.min(1, sp / 40));
        U2.uFlap.value = lerp(5, 16, Math.min(1, sp / 60));
      }
      // their qi: a haze of motes about each, swept back as they fly
      const qa = k * (1 - smooth(52.47, 52.6, u));
      // (close over his shoulder in the lock the motes had filled the frame like snow)
      const closeLock = 1 - 0.75 * band(51.55, 51.56, 51.82, 51.84, u);
      qiG.set({ time, amt: qa * (gold.root.visible ? 1 : 0) * 0.9 * closeLock, center: G, radius: 2.6, flow: vG.clone().multiplyScalar(0.02), tail: 3, px: 900, flat: 0.9 });
      // (the masked one's drawn in about the glaive's head as he gathers the storm into it)
      qiM.set({ time, amt: k * (masked.root.visible ? 1 : 0) * (0.9 + 1.2 * fury + 1.2 * loose) * closeLock, center: _c.copy(M).lerp(GLAIVE_HEAD, 0.75 * Math.max(fury, loose)), radius: lerp(2.4, 1.3, fury), flow: vM.clone().multiplyScalar(0.02), tail: 3, px: 900, flat: 0.9 });
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
        // (wound up over his right shoulder, then cut down across the sky to his left, across the lens's view: swung down
        // the line, away from the lens behind him, it went end-on as it came down and was a hairline before it was done)
        const sw = smooth(50.7, 50.742, u), up = smooth(50.66, 50.7, u) * (1 - sw);
        const ang = swingAng(u);
        // (it stands behind him and over him, where he stood, while he goes at the other; then, as he steadies, it comes
        // to him, over his right shoulder, away from the lens riding at his left: it had jumped to him in a frame, and
        // over the lens it swung down past it as a pane of white)
        const back = smooth(50.52, 50.64, u);
        // (come to him, it stands out there ahead of him to his right and over him, where it stood over his shoulder in
        // the lens's view but half again as far from it: its cut went by sixteen metres from the lens, and nearly seven
        // metres broad its blade crossed the frame as a cream plank a third of its height)
        const pivot = GOLD(u < 50.17 ? u : 50.17, V3()).addScaledVector(AX, -6).add(_a.set(0, 16, 0))
          .lerp(GOLD(u, _c).addScaledVector(AX, 10.5).addScaledVector(NX, 22.2).add(_a.set(0, 11.6, 0)), back);
        const dir = _b.copy(UPV).multiplyScalar(Math.cos(ang)).addScaledVector(SWING_E1, Math.sin(ang)).normalize();
        // (its flat turned to the lens, so it reads as a blade, never as a line)
        const toC = _c.copy(camera.position).sub(pivot);
        const flatN = toC.addScaledVector(dir, -toC.dot(dir)).normalize();
        const across = V3().crossVectors(dir, flatN).normalize();
        _m.makeBasis(across, dir, flatN);
        phantom.quaternion.setFromRotationMatrix(_m);
        // (come to him, it swings about its own hilt, there over his shoulder: about a point eighteen metres under it, the
        // hilt itself flew round in an arc)
        phantom.position.copy(pivot).addScaledVector(dir, -0.085 * 210 * back);
        // (and slenderer, close to the lens: at its full breadth a few tens of metres off it was a sheet over half the frame)
        // (its cut across the lens's view in a plane fifteen metres before it: in his own plane, three metres from it, it
        // would have swept the frame from edge to edge)
        // (nearK: how near the lens its length passes. Close by it is slenderer still, and drawn as a glow going by: swung
        // past eighteen metres off, nearly seven metres broad, it was a cream plank over half the frame)
        const toL = V3().subVectors(camera.position, pivot);
        const nearK = 1 - smooth(22, 50, toL.addScaledVector(dir, -clamp(toL.dot(dir), 0, 200)).length());
        U2.uNearK.value = nearK;
        phantomAura.material.uniforms.uNearK.value = nearK;
        phantom.scale.set(lerp(210, 80, back) * lerp(1, 0.68, nearK), 210, lerp(210, 80, back) * lerp(1, 0.68, nearK));
        // (its glow about it, gold, and the wake of the cut: the sweep of its length across the sky behind it as it goes)
        phantomAura.visible = true;
        phantomAura.quaternion.copy(phantom.quaternion);
        phantomAura.position.copy(pivot);
        phantomAura.scale.set(0.042 * phantom.scale.x * 2 * 3.0, 210 * 0.97, 1);
        phantomAura.material.uniforms.uAmt.value = pk * (0.32 + 0.4 * band(50.68, 50.72, 50.75, 50.8, u)) * U2.uForm.value;
        const sk = smooth(50.703, 50.71, u) * (1 - smooth(50.742, 50.758, u));
        smear.visible = sk > 0.002;
        if (smear.visible) {
          const Us = smear.material.uniforms;
          Us.uPivot.value.copy(pivot); Us.uE0.value.copy(UPV); Us.uE1.value.copy(SWING_E1);
          Us.uA0.value = ang; Us.uA1.value = swingAng(Math.max(50.7, u - 0.012)); Us.uL.value = 210;
          Us.uAmt.value = 0.55 * sk;
        }
        // (its hilt a burst of light where the blade begins, flaring as he swings it)
        hilt.position.copy(phantom.position).addScaledVector(dir, 0.085 * 210);
        hilt.material.uniforms.uSize.value = Math.min(20 + 14 * band(50.68, 50.72, 50.75, 50.8, u), 0.35 * camera.position.distanceTo(hilt.position));
        hilt.material.uniforms.uAmt.value = form * (1 - gone) * (1.45 + 0.8 * band(50.68, 50.72, 50.75, 50.8, u));
      }
      hilt.visible = phantom.visible;
      if (!phantom.visible) { phantomAura.visible = false; smear.visible = false; }
      // ---- the storm's blade: up out of the glaive's head into the dark over him, then down the sky onto the other's bell,
      // gathering speed all the way, and gone in its burst as the bell breaks (it had swung down and sat on the bell a
      // second; and so wide at its root, a few metres from the lens, it was a slab of glass)
      {
        // (lit at once as he begins to raise it, and shooting up out of its head into the dark, a beam of the storm, before it
        // is a blade: grown slowly, short and broad, it was born a frosted crystal, quartz)
        const form = smooth(FURY.raise[0], FURY.raise[0] + 0.02, u), gone = smooth(FURY.hit, FURY.hit + 0.012, u);
        const shoot = Math.pow(smooth(FURY.raise[0] + 0.004, FURY.raise[0] + 0.022, u), 1.4);
        // (born out of the glaive's head along its shaft, a flame of it, and lengthening as he raises it: it had stood
        // there at once, its whole length, across the shaft)
        _gx.set(0, 1, 0).applyQuaternion(glaive.getWorldQuaternion(_q)).normalize();
        const pk = form * (1 - gone);
        // (a flare on the glaive's head where each bolt of the storm strikes it, dying in a breath: as a meeting's burst,
        // a lens's width off, its sparks had been a starburst of white rods across the frame)
        let flare = 0;
        if (cueAge) for (const fu of GATHER_U.concat(FURY_U)) { const a = cueAge(fu); if (a >= 0 && a < 0.6) flare = Math.max(flare, Math.exp(-a / 0.08)); }
        stormBlade.visible = pk > 0.002;
        stormAura.visible = stormBlade.visible;
        stormSmear.visible = false;
        // (the glaive's head charged with the storm it lets out: dark against the blade's light, it was a hollow outline)
        // (and at rest only a little lit from within, so its steel shows: lit at a third, it was a flat violet cut-out, a flag)
        glaiveMat.emissiveIntensity = 0.16 + 2.8 * pk + 1.3 * flare;
        // (marked as no thing at all while it burns, so no line is drawn round it or through its edge: marked as light,
        // the edge between it and the sky fell among the figures, and was drawn round it as a dotted line)
        glaiveFigA.value = pk > 0.02 ? 0.0 : 1.1;
        stormHilt.visible = pk > 0.002 || flare > 0.003;
        if (!stormBlade.visible && stormHilt.visible) {
          stormHilt.position.copy(GLAIVE_HEAD);
          stormHilt.material.uniforms.uSize.value = 0.16 * camera.position.distanceTo(GLAIVE_HEAD);
          stormHilt.material.uniforms.uAmt.value = 1.5 * flare;
        }
        if (stormBlade.visible) {
          const U2 = stormBlade.material.uniforms, strike = band(FURY.swing[0], FURY.swing[0] + 0.012, FURY.hit, FURY.hit + 0.01, u);
          const hot = band(FURY.hit - 0.008, FURY.hit, FURY.hit + 0.002, FURY.hit + 0.012, u);
          // (lit, not blown out: close to, at full burn it was a white slab with nothing of the storm in it)
          U2.uAmt.value = pk * (1.0 + 0.45 * strike + 0.9 * hot);
          U2.uForm.value = 1;
          U2.uHot.value = 0.12 + 0.45 * hot + 0.8 * band(FURY.raise[0], FURY.raise[0] + 0.004, FURY.raise[0] + 0.012, FURY.raise[0] + 0.03, u);
          const pivot = _a.copy(GLAIVE_HEAD);
          const toG = _c.copy(G).add(_b.set(0, 1.1, 0)).sub(pivot), dg = toG.length(); toG.divideScalar(dg);
          // (raised: its point to the sky, a little back over him; swung down the sky through the other, faster and faster)
          const up = _b.copy(UPV).addScaledVector(toG, -0.12).normalize().lerp(_gx, 1 - smooth(FURY.raise[0] + 0.03, FURY.raise[1], u)).normalize();
          // (on down the sky until it is all but on him as the wide gives way to the close: still a third of the way short of
          // him at the cut, it never landed from afar)
          const swAt = v => Math.pow(smooth(FURY.swing[0], FURY.hit - 0.004, v), 1.15), sw = swAt(u);
          const dir = up.clone().lerp(toG, sw).normalize(), up0 = up.clone().normalize(), toG0 = toG.clone();
          const toC = V3().copy(camera.position).sub(pivot);
          const flatN = toC.addScaledVector(dir, -toC.dot(dir)).normalize();
          const across = V3().crossVectors(dir, flatN).normalize();
          _m.makeBasis(across, dir, flatN);
          stormBlade.quaternion.setFromRotationMatrix(_m);
          // (rising out of the glaive a pillar a couple of metres across, seen close behind him; from afar, after the cut,
          // the storm's own breadth: from the far side of the sky a pillar two metres wide is a thread)
          // (and close to the other again, as it comes down on him, a breadth the frame can hold)
          // (from afar, the storm's own breadth and more, twenty metres across and running on out of the frame over him: two
          // hundred metres of it, ten across, it was a slender spike over the star, an icicle, and its sweep a stick turning)
          // (and three times that again: from afar, twenty metres of it was a spike thirty pixels thick over the star, a laser,
          // nothing the size of the sky)
          const wide = u < FURY.raise[1] - 0.003 ? lerp(1.4, 14, smooth(FURY.raise[0] + 0.004, FURY.raise[0] + 0.03, u)) : u < 52.425 ? lerp(1200, 1440, smooth(FURY.swing[0], FURY.swing[0] + 0.03, u)) : 120;
          // (it grows up out of the glaive's head as it forms: there at once, its whole length cut off by the frame)
          // (from afar, long enough to cleave on down through the bell: stopping at it, it was a stick over him; close to the
          // other, after the cut, it ends in the bell, short of the lens beyond it)
          const len = lerp(1.4, dg * (u < FURY.raise[1] - 0.003 ? 1.45 : u < 52.425 ? 2.4 : 1.0), shoot);
          stormBlade.scale.set(wide, len, wide);
          // (its root on the glaive's head: the blade begins 0.085 up its own length)
          stormBlade.position.copy(pivot).addScaledVector(dir, -0.085 * len);
          stormHilt.position.copy(pivot);
          U2.uFar.value = smooth(60, 260, camera.position.distanceTo(_b.copy(pivot).addScaledVector(dir, 0.5 * len)));
          stormAura.quaternion.copy(stormBlade.quaternion);
          stormAura.position.copy(pivot);
          stormAura.scale.set(0.042 * wide * 2 * (u < 52.425 && u > FURY.raise[1] - 0.003 ? 2.2 : 3.2), len * 0.97, 1);
          stormAura.material.uniforms.uAmt.value = pk * (0.5 + 0.35 * strike + 0.6 * hot) * lerp(0.55, 1, U2.uFar.value);
          // (the wake of the sweep, from afar: over the angle it has swept in the last moment, in the plane it sweeps)
          const sk = u < 52.425 && u > FURY.raise[1] - 0.003 ? smooth(FURY.swing[0] + 0.003, FURY.swing[0] + 0.012, u) : 0;
          if (sk > 0.002) {
            const E0 = up0, E1 = V3().copy(toG0).addScaledVector(E0, -toG0.dot(E0)).normalize();
            const angAt = k => { const d = V3().copy(E0).lerp(toG0, k); return Math.atan2(d.dot(E1), d.dot(E0)); };
            const Us = stormSmear.material.uniforms;
            stormSmear.visible = true;
            Us.uPivot.value.copy(pivot); Us.uE0.value.copy(E0); Us.uE1.value.copy(E1);
            Us.uA0.value = angAt(sw); Us.uA1.value = angAt(swAt(Math.max(FURY.swing[0], u - 0.016))); Us.uL.value = len;
            Us.uAmt.value = 0.6 * sk * pk;
          }
          const dh = camera.position.distanceTo(stormHilt.position);
          // (as the storm goes out of him, its light at the glaive's head swells past the frame's edges and dies away:
          // a small light on the head, the burst of it all was a flash in a corner of the frame)
          const burst = band(FURY.raise[0] + 0.003, FURY.raise[0] + 0.0055, FURY.raise[0] + 0.01, FURY.raise[0] + 0.04, u);
          stormHilt.material.uniforms.uSize.value = Math.min(10 + 12 * strike, 0.3 * dh) * (1 + 4.5 * burst);
          stormHilt.material.uniforms.uAmt.value = pk * (1.2 + 1.2 * strike) + 2.6 * burst;
        }
      }
      // ---- the crescent
      const cb = u >= CRES.born ? 1 : 0;
      const split = u >= CRES.hit;
      const ca = cb * smooth(CRES.born, CRES.born + 0.01, u) * (1 - smooth(51.05, 51.12, u));
      const tl = cresTilt(u), CF = AX, CT = _a.copy(UPV).multiplyScalar(Math.cos(tl)).addScaledVector(NX, Math.sin(tl)).normalize();
      const CS = V3().crossVectors(CT, CF).normalize();
      for (let h = 0; h < 3; h++) {
        const m = cres[h];
        m.visible = ca > 0.002 && (h === 0 ? !split : split);
        if (!m.visible) continue;
        // (along the line from in front of him to the glaive's edge, its apex on that line; on past it once split)
        const S0 = GOLD(CRES.born, _b).addScaledVector(AX, 14).add(_c.set(0, 3, 0)), E0 = CRES_HIT();
        const D = E0.clone().sub(S0), dl = D.length(); D.divideScalar(dl);
        const f = 0.35 * smooth(CRES.born, CRES.hit, u) + 0.65 * clamp((u - CRES.born) / (CRES.hit - CRES.born));
        // (split, the halves go apart slowly at first, in the frame, either side of him, then gather speed away down to
        // the sea: going on at the crescent's own speed and flung apart at once, they were out of the frame in a frame
        // or two, and he seemed to have swallowed it)
        const dq = u - CRES.hit, slow = Math.min(dq, 0.04) * 0.2 + Math.max(0, dq - 0.04);
        const sc = CRES.R * (split ? 1 : lerp(0.35, 1, smooth(CRES.born, CRES.born + 0.03, u)));
        const c = split ? E0.clone().addScaledVector(D, dl * slow / (CRES.hit - CRES.born)) : S0.clone().lerp(E0, f);
        // (the middle of its leading edge on the line: its middle runs ahead of its ends and its edge is out from its
        // spine, and unallowed for, it had gone ten metres past him, out over the lens, by the time it struck)
        c.addScaledVector(CT, -sc * (1 + 0.6 * 0.5 * (CRES.W / CRES.R) - Math.cos(1.15))).addScaledVector(CF, -0.22 * sc);
        const sideK = split ? (h === 1 ? 1 : -1) * lerp(0, 260, Math.pow(clamp(dq / 0.15), 1.5)) : 0;
        const dropK = split ? 520 * Math.pow(clamp((dq - 0.02) / 0.12), 1.7) : 0;
        c.addScaledVector(CS, sideK).add(_b.set(0, -dropK, 0));
        _m.makeBasis(CS, CT, CF);
        m.quaternion.setFromRotationMatrix(_m);
        // (the halves turn down toward the sea as they go)
        if (split) { _q.setFromAxisAngle(CS, 0.5 * clamp((u - CRES.hit) / 0.12)); m.quaternion.premultiply(_q); }
        m.position.copy(c);
        m.scale.setScalar(sc);
        m.material.uniforms.uAmt.value = ca * (split ? 1.2 * (1 - smooth(51.0, 51.12, u)) + 0.3 : 1.0);
      }
      // ---- the bell about him, the lightning breaking on it; and the light of the lock
      const bk1 = band(51.19, 51.235, 51.51, 51.552, u);
      // (and once more, thrown up in haste over himself as the storm's blade comes down; it shatters under it)
      const bk2 = band(52.392, 52.405, FURY.hit + 0.004, FURY.hit + 0.013, u);
      const bk = Math.max(bk1, bk2);
      bell.visible = bk > 0.002;
      if (bell.visible && bk2 > bk1) {
        bell.position.copy(G).add(_a.set(0, 1.1, 0));
        bell.scale.setScalar(bellR(u) * lerp(0.35, 1, smooth(52.392, 52.408, u)) * (1 + 0.4 * smooth(FURY.hit, FURY.hit + 0.012, u)));
        const U2 = bell.material.uniforms;
        U2.uMode.value = 2;
        U2.uBreak.value = 0.85 * smooth(FURY.hit, FURY.hit + 0.011, u);
        U2.uAmt.value = bk2 * (0.95 + 1.2 * band(FURY.hit - 0.004, FURY.hit, FURY.hit + 0.002, FURY.hit + 0.01, u));
        U2.uCrack.value = smooth(52.42, FURY.hit, u);
        // (the volley's rings on it, where each bolt struck)
        let last = -1;
        for (let j = 0; j < VOLLEY_U.length; j++) if (u >= VOLLEY_U[j]) last = j;
        for (let i = 0; i < 4; i++) {
          const j = last - i, H = U2.uHit.value[i];
          const age = j >= 0 && cueAge ? cueAge(VOLLEY_U[j]) : Infinity;
          if (j >= 0 && age < 0.6) { volleyTo(j, _c).sub(bell.position).normalize(); H.set(_c.x, _c.y, _c.z, age / 0.6); }
          else H.w = -1;
        }
      } else if (bell.visible) {
        bell.material.uniforms.uMode.value = 0;
        // (and broken by him, coming through it at the other)
        bell.material.uniforms.uBreak.value = 0.9 * smooth(51.49, 51.55, u);
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
      // (its pieces, from the moment the blade breaks it)
      // (and the first bell's, as he breaks out of it at the other: it had only been gone between one moment and the next)
      {
        const age = (u - FURY.hit) / 0.024, age1 = (u - 51.503) / 0.05;
        shards.visible = (age > 0 && age < 1) || (age1 > 0 && age1 < 1);
        if (shards.visible) {
          const first = age1 > 0 && age1 < 1;
          // (from where the bell was as it broke: about him, they fell with him, or went with him through the air)
          GOLD(first ? 51.503 : FURY.hit, shards.position).add(_a.set(0, 1.1, 0));
          shards.scale.setScalar((first ? BELL_R : BELL2_R) * 1.05);
          const Us = shards.material.uniforms;
          Us.uAge.value = first ? age1 : age;
          Us.uAmt.value = first ? 0.9 : 1.15;
          // (flung on the way the blade came down, away from the masked one; the first's, the way he goes through it)
          if (first) Us.uPush.value.copy(MASKED(51.555)).sub(G).normalize().multiplyScalar(0.8);
          else Us.uPush.value.copy(G).sub(MASKED(FURY.hit)).normalize().multiplyScalar(1.2);
        }
      }
      const pr = band(51.553, 51.565, 52.085, 52.145, u);
      press.visible = pr > 0.002;
      core.visible = false;
      if (press.visible) {
        lockContact(u, press.position);
        const grow = smooth(51.555, 52.08, u), burst = smooth(52.085, 52.145, u);
        press.scale.setScalar(lerp(4, 72, Math.pow(grow, 0.7)) + 170 * burst);
        const U2 = press.material.uniforms;
        // (from inside it, nothing of it: it would only be a haze over them)
        const inside = smooth(0.9, 1.5, camera.position.distanceTo(press.position) / press.scale.x);
        U2.uAmt.value = pr * inside * (1.0 + 0.3 * Math.sin(time * 31) * Math.sin(time * 17) + 1.4 * burst);
        // (and the white heart of it, where blade and glaive meet)
        core.visible = true; core.position.copy(press.position);
        const dc = camera.position.distanceTo(core.position);
        // (close over his shoulder it is a point of white where blade and shaft cross, not a burst over the two of them)
        core.material.uniforms.uSize.value = Math.min(3 + press.scale.x * 0.55, 0.065 * dc);
        core.material.uniforms.uAmt.value = pr * (1.6 + 0.4 * Math.sin(time * 23) + 2 * burst) * lerp(1.1, 1, smooth(4, 30, dc));
        U2.uAxis.value.copy(AX).negate();
        U2.uCrack.value = 0;
        for (const H of U2.uHit.value) H.w = -1;
      }
      // ---- the shock of the hardest blows: a shell of light racing out from where they met
      let di = 0;
      for (const b of BLOWS) {
        if (!b.crater || di > 1) continue;
        const age = cueAge ? cueAge(b.u) : Infinity;
        if (!(age >= 0 && age < 1.6) || (b.domeTo && u >= b.domeTo)) continue;
        const x = age / 1.6, m = domes[di++];
        m.visible = true;
        m.position.copy(b.at(u));
        // (in the colour of whose light it is: gold and lilac where they meet, violet out of him alone)
        if (b.dome) { m.material.uniforms.uCol.value.setRGB(...b.dome); m.material.uniforms.uCol2.value.setRGB(...b.dome); }
        else { m.material.uniforms.uCol.value.setRGB(1, 0.9, 0.75); m.material.uniforms.uCol2.value.setRGB(0.85, 0.75, 1); }
        const R = 30 + 1050 * (1 - Math.pow(1 - x, 2.2)) * (b.crater[2] / 1.9);
        m.scale.setScalar(R);
        // (once it has swept past the lens it is gone: seen from inside, its light lay over the whole frame like a
        // cracked lens)
        const inside = camera ? (R - camera.position.distanceTo(m.position)) / R : -1;
        m.material.uniforms.uAmt.value = Math.pow(1 - x, 1.6) * 1.3 * (b.domeK ?? 1) * (1 - smooth(0, 0.18, inside));
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
