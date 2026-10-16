// Cinderfall Hamlet: one valley, one road. Everything (terrain, houses, the walk, the run) is placed from this file.
import { curve1, smooth, fbm, clamp, lerp } from './util.js';

// The road, sampled by z (south = +z, north/forest = -z). [z, x, y]
const ROAD = [
  [104, 0.6, 0], [86, 0.8, 0], [70, -0.6, 0], [56, 0.9, 0], [40, 0.4, 0], [24, -0.9, 0], [8, 0.7, 0],
  [-8, 0.2, 0], [-24, -0.6, 0], [-42, 0, 0],
  [-54, -2.6, 0.15], [-68, -8.2, 0.45], [-80, -12.4, 1.0], [-86, -13.2, 1.45], [-92, -12.6, 1.1],
  [-104, -8.6, 2.9], [-116, -2.4, 5.2], [-128, 3.6, 7.6], [-140, 7.2, 9.6], [-150, 8.0, 10.5],
  [-162, 6.8, 11.5], [-178, 3.6, 12.6], [-196, 1.0, 13.6], [-212, 0.0, 14.2], [-224, 0.0, 14.4],
];
const asc = [...ROAD].reverse();
const roadXCurve = curve1(asc.map(p => [p[0], p[1]]));
export const roadY = curve1(asc.map(p => [p[0], p[2]]));

export const GATE_Z = -42;
export const BRIDGE_Z = -86;
// (straight over the bridge: the road runs onto it square, up the middle of its steps and off it again, easing back
// into its own line within a stone's throw of either end; a road that bends at the bridge led whoever walked it in
// through the side of the bridge)
const BRIDGE_X = roadXCurve(BRIDGE_Z), BRIDGE_RUN = 12.6, BRIDGE_EASE = 16;
export const roadX = z => {
  const d = Math.abs(z - BRIDGE_Z);
  return d >= BRIDGE_RUN + BRIDGE_EASE ? roadXCurve(z) : lerp(BRIDGE_X, roadXCurve(z), smooth(BRIDGE_RUN, BRIDGE_RUN + BRIDGE_EASE, d));
};
// The river: it comes out of the western hills over a fall, winds across the valley floor under the bridge, and leaves
// through the hills to the east. riverZ: its centre line; riverHalfW: half its width; riverY: its water level.
const RXB = -13;   // where the road crosses it
const rzRaw = x => 9 * Math.sin(0.016 * (x - RXB)) + 3.6 * Math.sin(0.041 * (x - RXB) + 0.7) + 1.4 * Math.sin(0.11 * x + 2.1);
const RZ0 = rzRaw(RXB);
export const riverZ = x => BRIDGE_Z + rzRaw(x) - RZ0;
export const riverHalfW = x => 6.6 + 1.3 * Math.sin(0.027 * x + 0.4) + 0.6 * Math.sin(0.09 * x);
export const FALL = { x: -86, top: 4.4, bottom: 0.3, len: 1.8 };
export function riverY(x) {
  if (x < FALL.x - FALL.len / 2) return FALL.top + (FALL.x - FALL.len / 2 - x) * 0.012;
  if (x < FALL.x + FALL.len / 2) return lerp(FALL.top, FALL.bottom, smooth(FALL.x - FALL.len / 2, FALL.x + FALL.len / 2, x));
  return FALL.bottom - (x - FALL.x - FALL.len / 2) * 0.0072;
}
// (the old names: the stream is the river now)
export const STREAM = { z: BRIDGE_Z, width: 6.6 };
export const streamZ = riverZ;
// distance from the river's bank (negative in the water), in metres
export const riverD = (x, z) => Math.abs(z - riverZ(x)) - riverHalfW(x);
// the channel: a bed under the water, banks rising out of it and leaning back into the land (only ever cuts)
function riverCut(x, z, h) {
  const hw = riverHalfW(x), d = Math.abs(z - riverZ(x));
  if (d > hw + 26) return h;
  const wy = riverY(x);
  const depth = 1.7 + 0.7 * fbm(x * 0.05 + 7, 2.3, 2);
  const prof = wy - 0.22 - depth * (1 - smooth(hw * 0.25, hw * 1.04, d)) + Math.max(0, d - hw * 0.9) * 0.42 + Math.max(0, d - hw - 2.5) * 0.75;
  return Math.min(h, prof);
}
export const FOREST_EDGE_Z = -150;
export const GIANT_TREE = { x: -1.5, z: -232 };
export const VILLAGE = { zMin: -46, zMax: 96, half: 30 };

// Terrain height. The village floor is flat, the road climbs north to the pines, hills wrap the valley.
export function heightAt(x, z) {
  const px = roadX(z), py = roadY(z);
  const dx = x - px, ax = Math.abs(dx);
  let h = 0;
  h += smooth(-48, -175, z) * 11 + smooth(-175, -330, z) * 26 + smooth(-330, -560, z) * 70;
  h += smooth(26, 120, ax) * 20 + smooth(110, 320, Math.abs(x)) * 60;
  h += smooth(98, 210, z) * 38 + smooth(210, 420, z) * 80;
  const wild = smooth(14, 70, ax) + smooth(-60, -150, z) * 0.4;
  h += (fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 5) - 0.45) * 26 * clamp(wild, 0, 1.2);
  h += (fbm(x * 0.06, z * 0.06, 3) - 0.5) * 1.1 * smooth(6, 20, ax);
  // terraced fields west of the road beyond the gate
  const field = fieldMask(x, z);
  // (each terrace dead flat across its middle: a paddy holds its water)
  if (field > 0) h = lerp(h, Math.round(h / 1.3) * 1.3 + 0.25, smooth(0.04, 0.55, field));
  // flatten the village floor and the road corridor
  const inVillage = smooth(VILLAGE.zMin - 18, VILLAGE.zMin, z) * smooth(VILLAGE.zMax + 30, VILLAGE.zMax, z);
  const flatW = lerp(4.5, 34, inVillage);
  const t = smooth(flatW, flatW + lerp(12, 22, inVillage), ax);
  h = lerp(py, h, t);
  // the river cuts its channel across the valley under the bridge
  return riverCut(x, z, h);
}

export function fieldMask(x, z) {
  const px = roadX(z);
  const left = smooth(px - 12, px - 22, x) * smooth(px - 95, px - 70, x);
  const along = smooth(-48, -58, z) * smooth(-128, -112, z);
  const notStream = smooth(2, 7, riverD(x, z));
  return left * along * notStream;
}

// Ground masks used for splatting the terrain: [road dirt, paving, field, forest floor].
export function groundMask(x, z) {
  const px = roadX(z), ax = Math.abs(x - px);
  const inStreet = smooth(GATE_Z - 3, GATE_Z + 2, z) * smooth(VILLAGE.zMax + 6, VILLAGE.zMax - 4, z);
  const paving = (1 - smooth(2.6, 3.6, ax)) * inStreet;
  const roadW = lerp(1.7, 6.5, inStreet);
  const road = (1 - smooth(roadW, roadW + 2.2 + fbm(x * 0.3, z * 0.3, 2) * 2, ax)) * (1 - paving * 0.9);
  const field = fieldMask(x, z);
  const forest = smooth(-140, -165, z) * (1 - road) + smooth(60, 120, Math.abs(x)) * 0.6;
  return [road, paving, field, clamp(forest)];
}

// Houses along the street. side: -1 west (faces +x), +1 east (faces -x). Units in metres.
// burn: how strongly the house burns at night. sign: glyph on the signboard.
export const HOUSES = [
  { id: 'south-a', z: 88, side: -1, w: 9, d: 7, floors: 1, plat: 0.5, burn: 0.8, style: 'home', laundry: false },
  { id: 'south-b', z: 76, side: 1, w: 10, d: 7.5, floors: 1, plat: 0.9, burn: 0.9, style: 'home', herbs: true },
  { id: 'shrine-side', z: 62, side: 1, w: 9, d: 8, floors: 2, plat: 1.2, burn: 1.0, style: 'tall', balcony: true },
  { id: 'west-c', z: 58, side: -1, w: 11, d: 8, floors: 1, plat: 0.7, burn: 1.0, style: 'home', laundry: true },
  { id: 'uncle', z: 44, side: 1, w: 11.5, d: 8.5, floors: 1, plat: 1.1, burn: 1.0, style: 'herbal', sign: '藥', herbs: true, uncle: true },
  { id: 'laundry', z: 38, side: -1, w: 9.5, d: 7.5, floors: 1, plat: 0.6, burn: 1.0, style: 'home', laundry: true },
  { id: 'east-e', z: 28, side: 1, w: 9, d: 8, floors: 2, plat: 0.9, burn: 0.9, style: 'tall', balcony: true },
  { id: 'tea', z: 22, side: -1, w: 12, d: 8.5, floors: 2, plat: 0.8, burn: 1.0, style: 'tall', sign: '茶', balcony: true },
  { id: 'smith', z: 12, side: 1, w: 10, d: 8, floors: 1, plat: 0.4, burn: 0.8, style: 'forge', sign: '鐵' },
  { id: 'west-g', z: 6, side: -1, w: 9, d: 7, floors: 1, plat: 0.6, burn: 1.0, style: 'home', herbs: true },
  { id: 'east-h', z: -2, side: 1, w: 9.5, d: 7.5, floors: 1, plat: 0.9, burn: 1.0, style: 'home', laundry: true },
  { id: 'buns', z: -8, side: -1, w: 10, d: 7.5, floors: 1, plat: 0.5, burn: 1.0, style: 'shop', sign: '包' },
  { id: 'wine', z: -16, side: 1, w: 12, d: 9, floors: 2, plat: 1.0, burn: 1.0, style: 'tall', sign: '酒', balcony: true },
  { id: 'west-i', z: -22, side: -1, w: 9, d: 7, floors: 1, plat: 0.7, burn: 0.9, style: 'home', laundry: false },
  { id: 'east-j', z: -30, side: 1, w: 9, d: 7, floors: 1, plat: 0.8, burn: 0.9, style: 'home', herbs: true },
  { id: 'guard', z: -32, side: -1, w: 8, d: 6.5, floors: 1, plat: 0.5, burn: 0.7, style: 'guard', sign: '守' },
];
export const SETBACK = 6.4;   // distance from road centre to the house platform edge

export function housePlacement(h) {
  const px = roadX(h.z);
  const x = px + h.side * (SETBACK + h.d / 2);
  return { x, z: h.z, rotY: h.side < 0 ? Math.PI / 2 : -Math.PI / 2 };
}

// Second-row and hillside houses that thicken the village silhouette.
export function backRow(rand) {
  const out = [];
  for (let z = 92; z > -40; z -= rand.range(9, 14)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.2) continue;
      const d = rand.range(6, 8.5), w = rand.range(7.5, 11);
      const off = SETBACK + 10 + rand.range(4, 9) + d / 2;
      out.push({ id: `back-${z | 0}-${side}`, z: z + rand.range(-3, 3), side, w, d, floors: rand() < 0.3 ? 2 : 1,
        plat: rand.range(0.4, 1.4), burn: rand.range(0.5, 1), style: rand() < 0.3 ? 'tall' : 'home', back: true, off,
        laundry: rand() < 0.25, herbs: rand() < 0.3 });
    }
  }
  return out;
}

export function backPlacement(h) {
  const px = roadX(h.z);
  return { x: px + h.side * h.off, z: h.z, rotY: h.side < 0 ? Math.PI / 2 : -Math.PI / 2 };
}
