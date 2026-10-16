// The story on one axis. u runs 0 → 145 across the scroll; every visual state is a pure function of u.
//
//  0  title · 4 reveal · 10 crane · 15 uncle on the porch · 19 the street · 31 the gate · 36 the old road · 42 the pines
// 46 the sky turns (the fight overhead stirs up the deck) · 48.5 up through its eye · the storm (the falling star) · 55.5 night · 58.5 smoke below
// 61.6 Cinderfall burns (the world drains to ink) · 66 the run home · 77 the house · 81 inside · 84.4 last words
// 92.4 the rise · 98 the crag · 103.5 after the light west over the fields · 105.95 it goes over the ridge
// 107.42 the sky beyond the ridge takes fire · 108 the Forbidden Forest painted on the page · 109.8 into the painting
// 112.3 the first winter · 114.6 the six cuts · 124.6 the way out · 131.7 the rim · 133 the dell · 136 the scroll
// 139.44 the pillar of light · 141 the first page
import { track, curve1, curveMono, smooth, band, clamp, lerp } from './util.js';
import { P } from './palettes.js';
export const TOTAL = 145;
// Held moments: at each [story position, scroll length] the story slows to a fifth of its pace for that much scroll,
// so the reader waits on it — the forest falls silent, the storm stands over the valley, the glow below, the boy who
// cannot move, the open door, the hand that falls, the morning he goes farther, the rim of the dell, the crystal.
export const PAUSES = [[26.45, 1.4], [46.95, 1.6], [49.35, 1.1], [58.7, 1.6], [65.45, 2.0], [80.95, 1.3], [92.15, 2.2], [124.5, 1.0], [132.15, 1.5], [136.85, 1.1], [139.18, 2.6]];
const SLOW = 0.2;
const PSEG = (() => { let u = 0, s = 0; const out = []; for (const [sp, L] of PAUSES) { u += sp - s; s = sp; out.push({ u0: u, s0: s, u1: u + L, s1: s + L * SLOW }); u += L; s += L * SLOW; } return out; })();
export const TOTAL_U = TOTAL + PAUSES.reduce((a, [, L]) => a + L * (1 - SLOW), 0);
// scroll position (u) → story position (s), and back
export function uToS(u) {
  let du = 0;
  for (const p of PSEG) {
    if (u < p.u0) return u - du;
    if (u < p.u1) return p.s0 + (u - p.u0) * SLOW;
    du += (p.u1 - p.u0) - (p.s1 - p.s0);
  }
  return Math.min(TOTAL, u - du);
}
export function sToU(s) {
  let du = 0;
  for (const p of PSEG) {
    if (s < p.s0) return s + du;
    if (s < p.s1) return p.u0 + (s - p.s0) / SLOW;
    du += (p.u1 - p.u0) - (p.s1 - p.s0);
  }
  return s + du;
}
// how far into a held moment (0..1) and which one, for the camera's slow push while it holds; w: the push's weight,
// which builds through the hold and lets go over the story that follows it (never dropping back in one frame)
const RELEASE = 1.2;
export function pauseAt(s) {
  for (let i = 0; i < PSEG.length; i++) {
    const p = PSEG[i];
    if (s >= p.s0 && s < p.s1) { const k = (s - p.s0) / (p.s1 - p.s0); return { i, k, w: smooth(0, 1, k) }; }
    if (s >= p.s1 && s < p.s1 + RELEASE) return { i, k: 1, w: 1 - smooth(p.s1, p.s1 + RELEASE, s) };
  }
  return { i: -1, k: 0, w: 0 };
}
export const BEATS = {
  title: [0, 4], reveal: [4, 10], crane: [10, 14], uncle: [15, 19], street: [19, 33], gate: [31, 36], path: [36, 42],
  edge: [42, 46.5], storm: [46.5, 55.5], night: [55.5, 61.6], burning: [61.6, 66], run: [66, 77], house: [77, 81], inside: [81, 84.4],
  words: [84.4, 92.4], rise: [92.4, 98], ridge: [98, 103.5], flight: [103.5, 108.3], forest: [108.3, 112], years: [112, 124],
  hunt: [124, 131], fall: [131, 133.4], dell: [133.4, 136], scroll: [136, 141], page: [141, 145],
};

// ------------------------------------------------------------------ Wuhen in the village (road z)
export const mcZ = curveMono([
  [0, 66], [12, 66], [14, 63.5], [16.2, 50], [17.6, 46.4], [19.2, 41.6], [21.5, 35], [24, 25], [25.8, 18.6], [26.9, 15.6], [29, 2.2], [31, -12], [33, -27],
  [35.6, -43.5], [37.5, -66], [39.2, -90], [40.8, -118], [42.3, -146], [43.6, -151.6], [56, -152], [62, -152],
  [66, -152], [68, -136], [70, -104], [71.6, -72], [72.8, -46], [74.2, -20], [75.6, 6], [77, 30], [78.4, 40.5], [80, 43], [145, 43.2],
]);
export const porchBlend = track([[77.6, 0], [79.4, 0.55], [80.8, 1.0]]);
// inside the uncle's house: 0 door → 1 the spot where he finds him, then the rush and the kneel
export const enterK = track([[80.8, 0], [82.6, 1]], t => t);
export const rushK = track([[82.7, 0], [83.5, 1]]);
export const kneelK = track([[83.4, 0], [84.55, 1]]);
export const handDrop = track([[91.4, 0], [92.1, 1]]);
// yaw from facing north (into the pines): toward the storm in the west-south-west, then down to the village
// (the storm, and the great bolt when it comes down: on the slope west of the village, a little south of west)
export const turnYaw = track([[47.2, 0], [49.2, 1.98], [56.4, 1.98], [59.4, Math.PI]]);

// ------------------------------------------------------------------ the six winters at the tally tree
// He came to the forest at the start of a winter. Every winter after, one cut in the pale bark: the knife drawn down
// it (these are the moments the cut is made). Between the cuts the year turns round the tree (snow, spring rain and
// blossom, summer, the red of autumn, snow again) while the camp grows beyond it; after the sixth winter, the sixth
// autumn, when he lays his hand on the six cuts and turns away.
export const CUTS = [115.15, 116.75, 118.35, 119.95, 121.55, 123.0];
const NEXT = k => (k < CUTS.length - 1 ? CUTS[k + 1] : 124.6);
// a season track over the montage: the first winter, then for each year keys relative to its cut (c) and the next (n)
const yearKeys = (first, each, last) => {
  const out = [...first];
  CUTS.forEach((c, k) => { for (const [f, v] of each(c, NEXT(k), k)) out.push([f, v]); });
  return out.concat(last).sort((a, b) => a[0] - b[0]);
};
const SEASONS = yearKeys([], (c, n, k) => k < 5
  ? [[c - 0.45, 'winter'], [c + 0.38, 'winter'], [c + 0.62, 'rain'], [c + 0.82, 'summer'], [c + 1.0, 'summer'], [n - 0.62, 'autumn'], [n - 0.5, 'autumn']]
  : [[c - 0.45, 'winter'], [c + 0.3, 'winter'], [c + 0.5, 'rain'], [c + 0.68, 'summer'], [c + 0.85, 'autumn'], [n - 0.05, 'autumn']], []);

// ------------------------------------------------------------------ light and air: named palettes, keyed along u
// [u, palette] — the night holds from the turn until the flight, then the forest's seasons run, accelerating
const KEYS = [
  [0, 'day'], [46.6, 'day'], [47.35, 'gather'], [48.3, 'gather'], [48.95, 'aloft'], [53.03, 'aloft'], [53.3, 'tempest'], [55.6, 'tempest'], [57.6, 'night'], [104.3, 'night'], [105.15, 'soulnight'], [107.7, 'soulnight'],
  [108.1, 'arrive'], [112.45, 'arrive'], [113.2, 'winter'], ...SEASONS, [124.6, 'trail'], [128.9, 'trail'], [129.9, 'oldwood'], [131.4, 'oldwood'], [132.6, 'dell'], [139.05, 'dell'], [139.38, 'pillar'], [140.25, 'pillar'], [140.7, 'gold'], [145, 'gold'],
];
const KEYS_N = Object.keys(P.day);
export const env = {};
for (const k of KEYS_N) env[k] = track(KEYS.map(([u, p]) => [u, P[p][k]]));
const T = keys => track(keys);
Object.assign(env, {
  // the storm: a wall of towers far off in the south-west while the fight goes on above the clouds, then it comes on
  // all at once and the camera goes down into it
  storm: T([[0, 0], [45, 0], [47.4, 0.45], [52.2, 0.55], [53.2, 1], [103.5, 1], [105.3, 0.35], [107.5, 0.2], [108, 0]]),
  stormGrow: T([[0, 0], [45, 0], [46.6, 0.3], [48.4, 0.33], [52.2, 0.4], [53.2, 0.68], [54.6, 0.95], [55.4, 1.15], [103.5, 1.15], [108, 0]]),
  // a cloud's shadow passes over him as the forest falls silent; the sun is back for the view, then the storm takes it
  sunVis: T([[0, 1], [46.15, 1], [46.6, 0.85], [47.0, 0.65], [47.35, 0.45], [47.95, 0.5], [48.55, 1], [53.03, 1], [53.3, 0], [108, 0], [108.2, 1], [145, 1]]),
  fire: T([[0, 0], [55, 0], [58, 0.55], [63, 0.85], [72, 1], [107.9, 1], [108, 0]]),
  fireGlow: T([[0, 0], [53, 0], [57, 0.8], [62, 1], [104, 1], [107.5, 0.3], [108, 0]]),
  // the fight: low in the eye of the gathering it stirs up over the valley, then above the clouds
  clash: T([[0, 0], [45.55, 0], [46.15, 0.8], [49.0, 0.9], [49.6, 1], [52.5, 1], [52.9, 0]]),
  pollen: T([[0, 0.9], [46, 0.9], [49, 0], [124.4, 0], [125.4, 0.8], [131, 0.8], [131.4, 0]]),
  embers: T([[0, 0], [56, 0], [60, 1], [104, 1], [106, 0.3], [107.9, 0]]),
  ash: T([[0, 0], [54, 0], [60, 0.7], [70, 1], [94, 1], [96.4, 0.55], [103.4, 0.45], [104.6, 0.1], [106, 0.05], [107, 0]]),
  snow: T([[0, 0], [107.95, 0], [108.3, 0.7], [110.8, 0.7], [112.8, 0.6], [114.2, 0.5], ...yearKeys([], (c, n, k) => [[c - 0.42, 0.75], [c + 0.25, 0.75], [c + 0.42, 0], [n - 0.55, 0]], []).filter(([f]) => f < 123.5), [123.42, 0], [145, 0]]),
  rain: T([[0, 0], [49.6, 0], [51, 0.5], [55.4, 0.6], [57.6, 0], ...yearKeys([], (c, n, k) => [[c + 0.48, 0], [c + 0.6, 0.85], [c + 0.74, 0]], []), [124, 0], [145, 0]]),
  leaves: T([[0, 0], [46.0, 0], [47.0, 1], [55, 1], [58, 0.3], [62, 0], ...yearKeys([], (c, n, k) => k < 5 ? [[n - 0.72, 0], [n - 0.6, 0.55], [n - 0.46, 0.55], [n - 0.4, 0]] : [[c + 0.8, 0], [c + 0.92, 0.5]], []), [124.4, 0.5], [125, 0.35], [131, 0.35], [131.3, 0]]),
  birds: T([[0, 1], [47, 1], [52, 1], [53, 0], [124.6, 0], [125.4, 0.6], [131, 0.6], [131.2, 0]]),
  birdFlee: T([[0, 0], [46.35, 0], [47.6, 0.35], [50.5, 1], [124, 1], [124.1, 0]]),
  // the morning sun: from behind his left shoulder in the village and along the old road (so the valley on his left
  // is lit across, not a glare of haze), swinging ahead of him as he comes off the bridge toward the pines (beams
  // through the trunks), low in the west where the storm will swallow it
  sunDir: T([[0, [-0.72, 0.36, 0.5]], [39.4, [-0.72, 0.36, 0.5]], [41.4, [-0.62, 0.34, -0.71]], [145, [-0.62, 0.34, -0.71]]]),
  // the street's morning air is thicker (dust, cooking smoke): side-lit by the sun behind him it softens the depth
  shaftK: T([[0, 1], [11, 1], [13.5, 2.6], [31, 2.6], [34.5, 1], [41.2, 1], [42.2, 3.5], [46.4, 3.5], [47.5, 1]]),
  // under the pines the low sun is blocked: lift the sky fill so the floor reads (mushrooms, path)
  fillK: T([[0, 1], [41.4, 1], [42.6, 1.7], [46.4, 1.7], [47.2, 1]]),
  // screen-space beams (sky through the canopy, smeared toward the sun)
  beams: T([[0, 0], [41.2, 0], [42.2, 1], [46.4, 1], [47.4, 0], [124.6, 0], [125.4, 0.3], [131, 0.3], [131.4, 0]]),
  mist: T([[0, 0.2], [46, 0.2], [52, 0.15], [103.5, 0.1], [107, 0.2], [108, 0.6], [131, 0.6], [131.4, 0]]),
  // low ground mist in the air pass (× the palette's mistG): a breath of it in the street, lying in the meadows
  // and between the pines, thin under the ink, thick in the forest's hollows and the dell
  mistK: T([[0, 0.5], [12, 0.5], [14, 0.8], [31, 0.8], [34.5, 1.0], [41, 1.0], [42.4, 1.3], [46.4, 1.3], [48, 1.1], [56, 1.1], [61.4, 0.9], [61.7, 0.35], [103.5, 0.35], [105.2, 0.9], [108, 1], [124.4, 1], [125, 1.15], [131, 1.15], [133, 1], [145, 1]]),
  // blood-red strands of qi: [high over the village, along the road home, near the lens]
  strands: T([[0, [0, 0, 0]], [61.6, [0, 0, 0]], [62.6, [1, 0, 0]], [65.4, [1, 0, 0]], [66.4, [1, 1, 1]], [77, [1, 1, 1]], [78.6, [1, 0.4, 0]], [93, [1, 0.4, 0]], [94.2, [1, 0.4, 0.7]], [97.4, [1, 0.4, 0.7]], [98.6, [0, 0, 0]], [145, [0, 0, 0]]]),
  // seasons of the Forbidden Forest (0..1 each)
  snowCover: T([[0, 0], [107.6, 0], [108.2, 0.62], [112.2, 0.66], [112.6, 1], [114.6, 1], ...yearKeys([], (c, n, k) => k < 5 ? [[c + 0.36, 1], [c + 0.56, 0.1], [c + 0.66, 0], [n - 0.5, 0], [n - 0.4, 0.95]] : [[c + 0.3, 1], [c + 0.48, 0.1], [c + 0.56, 0]], []), [145, 0]]),
  wet: T([[0, 0], ...yearKeys([], (c, n, k) => [[c + 0.42, 0], [c + 0.6, 1], [c + 0.82, 0.3], [c + 0.95, 0]], []), [145, 0]]),
  autumn: T([[0, 0], ...yearKeys([], (c, n, k) => k < 5 ? [[c + 0.95, 0], [n - 0.62, 1], [n - 0.42, 1], [n - 0.3, 0.3], [n + 0.1, 0]] : [[c + 0.7, 0], [c + 0.86, 1]], []), [145, 1]]),
  blossom: T([[0, 0], ...yearKeys([], (c, n, k) => [[c + 0.46, 0], [c + 0.62, 1], [c + 0.8, 0.5], [c + 0.92, 0]], []), [145, 0]]),
});

export const brokenAt = 55.2;
export const ruinAt = 1e9;            // the ruins at dawn are no longer shown
export const worldBAt = 108.3;        // the mist: the valley is left behind
// scripted lightning: [u, strength, which peak (0..1 across the view), kind: 0 storm blue, 1 violet]
// kind 2: into the ground beside the road on the run home: [u, strength, metres off the road's centre, 2, metres ahead of him]
export const STRIKES = [
  [66.6, 1, 7, 2, 26], [68.3, 1, -8, 2, 24], [70.4, 1, 6.5, 2, 28], [72.6, 1, -3.6, 2, 22], [75.0, 1, 3.6, 2, 26],
  [101.2, 1, 0.5, 1], [102.3, 0.7, 0.35, 1]];
export const STAR = [54.0, 54.42];
// the pillar of light strikes him in the dell
export const STRIKE_B = 139.44;

// ------------------------------------------------------------------ camera
export const cam = {
  aerial: T([[0, 1], [9.6, 1], [13.6, 0]]),
  // (the crane up behind him waits until the lens is through the gate, so it never rises into the gate's roof)
  montage: T([[35.75, 0], [36.95, 1], [41.2, 1], [42.6, 0]]),
  sky: T([[0, 0], [145, 0]]),
  // the storm over the valley: over his shoulder, rising and drawing back as the sky fills
  vista: T([[47.8, 0], [49.5, 1], [56.6, 1], [58.8, 0]]),
  // before he runs: low at his side, his hand, the basket it lets fall (never his face)
  face: T([[63.7, 0], [64.6, 1], [66.45, 1], [66.95, 0]]),
  // the soul: the camera's eye stays on it as it leaves him, rises and goes west
  soul: T([[92.2, 0], [93.0, 1], [108.4, 1], [108.5, 0]]),
  mushroom: T([[42.8, 0], [44, 1], [47.25, 1], [48.3, 0]]),
  rise: T([[92.2, 0], [93.4, 1], [108.4, 1], [108.5, 0]]),
  ridge: T([[0, 0], [145, 0]]),
  flight: T([[0, 0], [145, 0]]),
  // the Forbidden Forest
  descent: T([[108.2, 0], [108.3, 1], [111.9, 1], [112.9, 0]]),
  years: T([[112.35, 0], [113.3, 1], [114.15, 1], [114.75, 0]]),
  tally: T([[114.15, 0], [114.75, 1], [124.05, 1], [124.45, 0]]),
  boar: T([[127.6, 0], [128.0, 1], [128.4, 1], [128.7, 0]]),
  draw: T([[128.3, 0], [128.6, 1], [129.3, 1], [129.7, 0]]),
  tumble: T([[130.9, 0], [131.2, 1], [132.9, 1], [133.5, 0]]),
  reveal: T([[133.3, 0], [134.1, 1], [135.9, 1], [136.5, 0]]),
  scroll: T([[135.9, 0], [137.0, 1], [145, 1]]),
  shake: T([[0, 0], [47, 0], [47.6, 0.05], [52.6, 0.05], [53.4, 0.14], [54.0, 0.2], [54.36, 0.14], [54.43, 0.5], [54.55, 0.32], [54.62, 0.8], [54.8, 0.35], [55.3, 0.12], [56.6, 0.08], [57.2, 0.05], [58, 0.05], [62, 0.2], [66, 0.35], [67, 0.9], [77, 0.9], [78, 0.4], [82.5, 0.25], [84.4, 0.06], [92.4, 0.04], [93, 0], [129.5, 0], [129.9, 0.6], [131.0, 0.9], [131.3, 2.0], [132.3, 1.2], [132.8, 0], [139.22, 0], [139.38, 0.22], [139.437, 0.3], [139.443, 2.8], [139.5, 1.1], [139.62, 0.4], [139.9, 0.1], [140.3, 0], [145, 0]]),
  fov: T([[0, 46], [10, 46], [14, 50], [45.9, 50], [46.7, 59], [47.4, 62], [49.4, 60], [56.6, 60], [58.8, 50], [60.6, 48], [62.6, 21], [63.7, 22], [64.6, 36], [65.6, 38], [66.45, 44], [67.0, 54], [77, 56], [80, 50], [82.6, 50], [84.4, 42], [92.2, 38], [94, 50], [96.4, 50], [98.6, 46], [101.4, 30], [102.8, 31], [104.0, 48], [104.6, 52], [105.2, 50], [105.7, 45], [106.15, 46], [106.7, 50], [107.4, 52], [108.2, 54], [108.4, 54], [111.4, 52], [112.6, 46], [114.15, 46], ...CUTS.flatMap((c, k) => k < 5 ? [[c - 0.385, 46], [c - 0.375, 36], [c + 0.415, 40], [c + 0.425, 46]] : [[c - 0.385, 46], [c - 0.375, 36], [c + 0.415, 40], [c + 0.425, 44]]), [124.1, 40], [124.45, 48], [124.6, 50], [127.8, 46], [128.6, 36], [129.6, 52], [131.2, 62], [133, 54], [136, 48], [139, 42], [139.219, 42], [139.222, 56], [139.598, 52], [139.602, 52], [139.948, 47], [139.952, 42], [145, 40]]),
};

// ------------------------------------------------------------------ ink and paper
export const fx = {
  // global ink amount (0 colour .. 1 ink); spread/seep masks shape where it shows
  ink: T([[0, 1], [6.0, 1], [10.8, 0], [61.5, 0], [61.6, 1], [108.25, 1], [108.3, 0], [112.35, 0], [113.4, 0.95], [123.4, 0.95], [124.6, 0], [139.95, 0], [140.6, 0.9], [145, 0.9]]),
  bleed: T([[0, -0.3], [6.4, -0.3], [10.6, 1.7], [11, 9]]),
  // the world drains into ink from the burning village outward as it is revealed (radius in screen units)
  inkSpread: T([[61.6, 0.05], [62.1, 0.75], [62.7, 1.6], [63.3, 2.8]]),
  // the ink's own exposure: night scenes are drawn relative to their light (fire-lit = paper)
  inkKey: T([[0, 1], [145, 1]]),
  // where the drawing dissolves into the paper (metres): wide for the valley shots, close in the house
  inkNear: T([[0, 18], [11, 18], [61, 90], [65.6, 90], [66.6, 10], [77, 8], [80.5, 4], [92.4, 4], [94.5, 40], [98, 60], [104, 60], [108.2, 60], [108.4, 40], [110.4, 25], [112, 14], [145, 14]]),
  inkFar: T([[0, 420], [11, 420], [61, 780], [65.6, 780], [66.6, 160], [77, 120], [80.5, 30], [92.4, 30], [94.5, 600], [98, 800], [104, 900], [108.2, 900], [108.4, 420], [110.4, 260], [112, 190], [145, 190]]),
  // brush weight of the lines: lighter over the forest from the air, where every crown would otherwise be outlined
  inkLine: T([[0, 1], [103.4, 1], [104.6, 0.6], [108.2, 0.6], [108.4, 0.3], [110.6, 0.45], [112, 1], [145, 1]]),
  // memory: the years in brown ink on yellowed paper; the red of the maples survives
  sepia: T([[0, 0], [112.2, 0], [113.8, 0.9], [122.6, 0.9], [124, 0.3], [124.8, 0]]),
  redKeep: T([[0, 0], [115.4, 0], [116.4, 1], [124, 1], [124.8, 0]]),
  // gold survives the ink where the star burns and where its trail leads (the flight), and in the forest
  goldKeep: T([[0, 1], [61, 1], [61.5, 0], [91.6, 0], [92.1, 1], [145, 1]]),
  // the uncle's soul gives the world back its colour: it seeps out from the gold as the soul rises (radius, screen)
  soulSeep: T([[0, 0], [92.5, 0], [93.1, 0.12], [93.7, 0.34], [94.3, 0.75], [94.9, 1.6], [95.4, 2.8], [108.15, 2.8], [108.3, 0]]),
  // colour returning in the forest, from the camp outward (radius)
  seep: T([[0, -0.4], [114.4, -0.4], [116, 0.25], [118, 0.55], [120, 0.85], [122, 1.2], [123.6, 1.6], [124.6, 2.8]]),
  paper: T([[0, 1], [4.9, 1], [5.5, 0], [140.95, 0], [141.4, 1], [145, 1]]),
  redInk: T([[0, 0], [61.4, 0], [62.2, 0.25], [63.6, 0.05], [65, 0]]),
  // the mist between the valley and the forest: the page goes white while the star's trail runs on across it
  white: T([[0, 0], [107.9, 0], [108.05, 1], [109.75, 1], [110.55, 0], [140.4, 0], [140.95, 0.7], [141.3, 1], [141.75, 0]]),
  black: T([[0, 0], [145, 0]]),
};
export const INK_CUTS = [[3.6, 6.0, 5.9, 8.2, 0.58]];
export function inkCut(u) {
  for (const [a, b, c, d, y] of INK_CUTS) if (u >= a && u <= d) return { flood: smooth(a, b, u), lift: smooth(c, d, u), y };
  return { flood: 0, lift: 0, y: 0.5 };
}
export const inkfx = {
  splat: track([[0, 0], [61.7, 0], [62.7, 1]]),
  splatFade: track([[0, 1], [63.4, 1], [66, 0]]),
  // as his hand falls, a tear: it lands where their hands met
  drop: track([[91.5, 0], [91.6, 1.12], [92.05, 0.58]], t => t * t),
  splash: track([[92.0, 0], [92.05, 0.001], [92.6, 1]]),
  // the last drop: the first page
  endDrop: track([[141.0, 0], [141.1, 1.12], [141.55, 0.58]], t => t * t),
  endSplash: track([[141.5, 0], [141.55, 0.001], [142.1, 1]]),
};

// ------------------------------------------------------------------ the Forbidden Forest
export const forest = {
  // the camp grows (stage 0..6) and the tally gains a notch each winter (years 0..6)
  // (each new piece of the camp comes in the summer between two winters' cuts, while the eye is out wide)
  stage: T([[0, -1], [112.35, -1], [112.95, 0], ...[1, 2, 3, 4, 5].flatMap(n => [[CUTS[n - 1] + 0.62, n - 1], [CUTS[n - 1] + 1.0, n]]), [CUTS[5] + 0.55, 5], [CUTS[5] + 0.85, 6], [145, 6]]),
  // (the old camp-kit tally marks: no longer shown, the cuts are made before the eye)
  years: T([[0, 0], [145, 0]]),
  growth: T([[0, 0], [112, 0], [124, 1]]),
  // arrival: he comes out of the trees in the snow and sinks down against the boulder
  arrive: T([[110.75, 0], [112.25, 1]], t => t),
  // the sixth autumn: an empty snare, then farther than ever, along the journey (metres along the way)
  snare: T([[124.6, 0], [125.0, 1], [125.6, 1], [125.9, 0]]),
  way: T([[125.8, 0], [127.3, 120], [127.75, 160], [128.7, 214], [130.1, 300], [131.3, 372], [132.1, 400], [132.3, 402], [133.3, 413.5]], t => t),
  // qi: first a few motes in the old wood, then streams that gather toward the dell, then the spiral at the nook
  qi: T([[0, 0], [128.6, 0], [129.4, 0.25], [130.6, 0.55], [131.8, 0.85], [133.5, 1], [138.4, 1], [139.4, 0.4], [140.6, 0]]),
  org: T([[0, 0], [130.2, 0], [131.6, 0.45], [132.4, 0.8], [134.0, 1], [145, 1]]),
  // the dell: he stands, goes to it, kneels, touches the crystal; it cracks with light and breaks; the scroll
  getUp: T([[133.2, 0], [133.25, 0]]),
  approach: T([[134.1, 0], [136.2, 1]], t => t),
  crack: T([[136.85, 0], [137.25, 1]]),
  shatter: T([[137.3, 0], [137.85, 1]]),
  glow: T([[129.4, 0], [133.8, 0.35], [136.0, 0.55], [136.9, 1], [137.4, 1.4], [138.6, 0.9], [139.15, 1.8], [139.44, 2.4], [139.8, 2.2]]),
  unroll: T([[138.4, 0], [139.6, 1]]),
  // as it opens all the way he looks up: the light gathers in the leaves overhead, sends a thread of light down to
  // the page, and the pillar comes down out of the sky after it onto him and the page (STRIKE_B), throwing a ring of
  // light out over the dell (the gathering; the thread; the pillar's light; how far down it has come, falling faster
  // and faster; the ring)
  gather: T([[139.14, 0], [139.385, 1], [139.43, 1], [139.445, 0]]),
  pilot: T([[139.35, 0], [139.38, 1], [139.44, 1], [139.47, 0]]),
  beam: T([[139.385, 0], [139.41, 1], [139.9, 0.78], [140.5, 0.95], [141.15, 0]]),
  beamDrop: T([[139.385, 0], [139.44, 1]], t => Math.pow(t, 1.4)),
  beamRing: T([[139.44, 0], [140.0, 1]]),
  // (kept for the camp ghosts' ages and older code paths)
  walk: T([[124.8, 0], [127.8, 1]], t => t),
  drawBow: T([[0, 0], [145, 0]]),
  arrow: T([[0, 0], [145, 0]]),
  boarTurn: T([[0, 0], [145, 0]]),
  charge: T([[0, 0], [145, 0]]),
  run: T([[0, 0], [145, 0]]),
  collapse: T([[0, 0], [145, 0]]),
  tumble: T([[132.3, 0], [133.3, 1]]),
};
