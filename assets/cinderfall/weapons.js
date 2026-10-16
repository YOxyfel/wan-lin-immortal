// The smith's stall: his work set out under the porch in front of the forge, the way a weapon-smith shows it. On the
// left the arms rack: spears, a guandao, a ji, a trident and a staff standing in it, their butts in the sockets of its
// sill and their shafts through its rail, the carved crest board over them; before it a low bench with a tiered stand
// of sheathed swords, and a tub of staves. On the right the sword wall: a lacquered panel under the 神兵 plaque, swords
// and sabres laid across carved pegs, a crimson sabre at its head. Before it, on a lacquered altar table under red
// silk, cradled on a stand of its own, one sword that is not like the others; beside it a table of knives, axes and
// arrowheads. Shields and banners on the porch posts, a red valance along the porch beam.
//
// To everyone else they are iron. He sees light in them: an aura round each blade, faint on most, stronger on a few,
// and on the legendary ones a blaze that climbs off the steel and throws motes into the air. The auras are drawn only
// while he looks (createAuras: set({ amt })).
import * as THREE from 'three';
import { M, mul, mbox, mcyl, tube } from './geo.js';
import { atlasQuad } from './props.js';
import { SIGN_CELLS } from './materials.js';

// tiers: 0 common (faint silver), 1 fine (jade), 2 rare (azure), 3 epic (violet), 4 legendary (gold), 5 legendary (crimson)
export const TIER = [
  { col: [0.75, 0.82, 0.95], k: 0.35 }, { col: [0.35, 1.0, 0.62], k: 0.55 }, { col: [0.32, 0.62, 1.0], k: 0.75 },
  { col: [0.72, 0.38, 1.0], k: 1.0 }, { col: [1.0, 0.72, 0.25], k: 1.7 }, { col: [1.0, 0.22, 0.12], k: 1.6 },
];

const STEEL = [1, 1, 1], DARK = [0.45, 0.42, 0.42], GOLD = [1, 1, 1], BRASS = [0.86, 0.66, 0.5], RED = [0.75, 0.1, 0.07];
// (what a fitting of a given colour is made of: dark ones plain iron, golden ones gilt, any other polished steel,
// each tinted by its colour)
const fit = c => (c === DARK || (c[0] < 0.6 && c[1] < 0.6 && c[2] < 0.6)) ? 'metal' : (c[0] >= c[1] && c[1] >= c[2] && c[0] > 0.8) ? 'gilt' : 'steel';
const WOOD = 0.6, WOOD_D = 0.44, LAQ_RED = [0.42, 0.05, 0.035], LAQ_BLACK = [0.055, 0.045, 0.045], SILK = [0.6, 0.06, 0.045];
const BURN = 0.8;

// ------------------------------------------------------------------ shapes
// a board with softened edges: w along x, h along y, d along z, centred
function slab(w, h, d, r = 0.012, bev = 0.006) {
  bev = Math.min(bev, w / 3, h / 3, d / 3);
  const x0 = -w / 2 + bev, x1 = w / 2 - bev, y0 = -h / 2 + bev, y1 = h / 2 - bev;
  const rr = Math.max(1e-4, Math.min(r, (x1 - x0) / 2 - 1e-4, (y1 - y0) / 2 - 1e-4));
  const s = new THREE.Shape();
  s.moveTo(x0 + rr, y0); s.lineTo(x1 - rr, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rr); s.lineTo(x1, y1 - rr); s.quadraticCurveTo(x1, y1, x1 - rr, y1);
  s.lineTo(x0 + rr, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rr); s.lineTo(x0, y0 + rr); s.quadraticCurveTo(x0, y0, x0 + rr, y0);
  const depth = Math.max(1e-3, d - 2 * bev);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -depth / 2);
  return g;
}
// a shape (in its own x, y) extruded d deep along z, centred on z, edges softened
function plate(shape, d, bev = 0.004, curve = 6) {
  const depth = Math.max(1e-3, d - 2 * bev);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  return g;
}
function lathe(profile, seg = 12) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
}
// a turned post: a flared foot, a bead, the shaft, a capital
function turnedPost(h, r) {
  return lathe([[0, 0], [r * 1.55, 0], [r * 1.55, 0.035], [r * 1.25, 0.06], [r * 1.35, 0.085], [r * 1.05, 0.11], [r, 0.16], [r, h - 0.16],
    [r * 1.1, h - 0.12], [r * 1.28, h - 0.085], [r * 1.05, h - 0.06], [r * 1.35, h - 0.03], [r * 1.35, h], [0, h]], 12);
}

// ------------------------------------------------------------------ blades and their fittings
// a blade: a flattened diamond section (a ridge down the middle) tapering to a point (len along +y from the guard)
function bladeGeo(len, w, t, curve = 0, tipLen = 0.12, seg = 14) {
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const v = i / seg, y = v * len;
    const k = v < 1 - tipLen / len ? 1 : (1 - v) / (tipLen / len);
    // (the point drawn in along a curve, not a straight cut)
    const tw = w * (k < 1 ? Math.sqrt(Math.max(k, 0)) * k ** 0.4 : 1) * (1 - 0.12 * v);
    const off = curve * v * v * len;
    pos.push(off - tw / 2, y, 0, off, y, t / 2, off + tw / 2, y, 0, off, y, -t / 2);
    if (i) for (let q = 0; q < 4; q++) { const a = (i - 1) * 4 + q, b = (i - 1) * 4 + ((q + 1) % 4); idx.push(a, b, a + 4, b, b + 4, a + 4); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
}
// a scabbard: an elliptical section following the blade (curving with it), the chape rounded off
function sheathGeo(len, w, t, curve = 0, seg = 16) {
  const ring = 10, pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const v = i / seg, y = v * len;
    const k = v > 0.9 ? Math.sqrt(Math.max(0, 1 - ((v - 0.9) / 0.1) ** 2)) * 0.6 + 0.4 : 1;
    const off = curve * v * v * len;
    for (let j = 0; j < ring; j++) {
      const a = (j / ring) * Math.PI * 2;
      pos.push(off + Math.cos(a) * w / 2 * k * (1 - 0.15 * v), y, Math.sin(a) * t / 2 * k);
    }
    if (i) for (let j = 0; j < ring; j++) { const a = (i - 1) * ring + j, b = (i - 1) * ring + ((j + 1) % ring); idx.push(a, a + ring, b, b, a + ring, b + ring); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
}
// the guard of a jian: wings swept down toward the blade from a raised middle (a lens seen from the side)
const JIAN_GUARD = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.068, -0.006); s.quadraticCurveTo(-0.05, 0.02, -0.018, 0.026); s.quadraticCurveTo(0, 0.034, 0.018, 0.026); s.quadraticCurveTo(0.05, 0.02, 0.068, -0.006);
  s.quadraticCurveTo(0.05, 0.004, 0.02, 0.0); s.quadraticCurveTo(0, -0.014, -0.02, 0.0); s.quadraticCurveTo(-0.05, 0.004, -0.068, -0.006);
  return s;
})();
// a tassel: a cord, a knot, a skirt of silk that swings (whatever it hangs from, it hangs straight down)
function tassel(kit, Wfrom, color, len = 0.2) {
  const p = new THREE.Vector3().setFromMatrixPosition(Wfrom);
  const W = M(p.x, p.y, p.z);
  kit.add('cloth', tube([[0, 0, 0], [0.004, -len * 0.25, 0.006], [0, -len * 0.45, 0]], 0.0035, 4, 6), W, { color, sway: 0.4, burn: BURN });
  kit.add('cloth', new THREE.SphereGeometry(0.014, 8, 6), mul(W, M(0, -len * 0.47, 0)), { color, sway: 0.5, burn: BURN });
  const sk = mcyl(0.006, 0.032, len * 0.5, 9, true);
  kit.add('cloth', sk, mul(W, M(0, -len * 0.75, 0)), { color, sway: 0.75, burn: BURN });
}
// jian: straight double-edged sword, its guard, a bound grip, the pommel, a tassel. W: at the guard, blade along +y
function jian(kit, W, { len = 0.78, steel = STEEL, hilt = DARK, tasselCol = RED, guard = GOLD, wide = 1, inlay = null } = {}) {
  kit.add('steel', bladeGeo(len, 0.04 * wide, 0.011), W, { color: steel });
  if (inlay) kit.add('glow', bladeGeo(len * 0.86, 0.006, 0.0125, 0, 0.1), mul(W, M(0, 0.04, 0)), { color: inlay });
  kit.add(fit(guard), plate(JIAN_GUARD, 0.026 * wide, 0.003), mul(W, M(0, -0.012, 0, 0, 0, 0, wide)), { color: guard });
  kit.add('lacquer', lathe([[0.017, 0], [0.019, 0.05], [0.0195, 0.1], [0.018, 0.16], [0.016, 0.19]], 8), mul(W, M(0, -0.215, 0)), { color: hilt, burn: 0.4 });
  // (the binding on the grip)
  for (let i = 0; i < 6; i++) kit.add('cloth', mcyl(0.0205, 0.0205, 0.012, 8, true), mul(W, M(0, -0.045 - i * 0.028, 0)), { color: [0.18, 0.14, 0.12], burn: 0.5 });
  kit.add(fit(guard), lathe([[0, 0], [0.018, 0.005], [0.027, 0.02], [0.022, 0.04], [0.012, 0.05], [0, 0.052]], 10), mul(W, M(0, -0.213, 0, 0, Math.PI)), { color: guard });
  if (tasselCol) tassel(kit, mul(W, M(0, -0.268, 0.0)), tasselCol, 0.22);
}
// dao: a single-edged sabre, widening and curving toward the tip, a disc guard, a ringed pommel
function dao(kit, W, { len = 0.72, steel = STEEL, hilt = DARK, guard = GOLD, tasselCol = null } = {}) {
  kit.add('steel', bladeGeo(len, 0.056, 0.013, 0.13, 0.17, 18), W, { color: steel });
  kit.add(fit(guard), lathe([[0, 0], [0.055, 0], [0.06, 0.006], [0.058, 0.014], [0.02, 0.018], [0, 0.018]], 16), mul(W, M(0, -0.016, 0)), { color: guard });
  kit.add('lacquer', lathe([[0.018, 0], [0.02, 0.07], [0.019, 0.15], [0.017, 0.21]], 8), mul(W, M(0, -0.228, 0)), { color: hilt, burn: 0.4 });
  kit.add(fit(guard), new THREE.TorusGeometry(0.026, 0.006, 6, 14), mul(W, M(0, -0.255, 0)), { color: guard });
  if (tasselCol) tassel(kit, mul(W, M(0, -0.28, 0)), tasselCol, 0.2);
}
// a scabbard with its mouth, middle band and chape in metal (W at its mouth, running along +y)
function sheath(kit, W, { len = 0.8, w = 0.05, t = 0.024, curve = 0, color = LAQ_BLACK, fit: fit_ = GOLD } = {}) {
  kit.add('lacquer', sheathGeo(len, w, t, curve), W, { color, burn: BURN });
  const band = (v, h) => { const off = curve * v * v * len; kit.add(fit(fit_), sheathGeo(h, w * 1.12 * (1 - 0.15 * v), t * 1.25, 0, 2), mul(W, M(off, v * len, 0)), { color: fit_ }); };
  band(0, 0.05); band(0.4, 0.025); band(0.9, 0.07);
}
// a sword in its scabbard, as it lies on a stand: the hilt out of the mouth (W at the mouth, along +y)
function sheathedJian(kit, W, opts = {}) {
  const len = opts.len ?? 0.78;
  sheath(kit, W, { len: len + 0.02, color: opts.color ?? LAQ_BLACK, fit: opts.guard ?? GOLD });
  jian(kit, W, { ...opts, len: 0.001 });
}
function sheathedDao(kit, W, opts = {}) {
  const len = opts.len ?? 0.72;
  sheath(kit, W, { len: len + 0.02, w: 0.068, t: 0.028, curve: 0.13, color: opts.color ?? [0.32, 0.12, 0.07], fit: opts.guard ?? BRASS });
  dao(kit, W, { ...opts, len: 0.001 });
}

// ------------------------------------------------------------------ polearms (W at the butt, along +y)
function pole(kit, W, h, r0 = 0.024, r1 = 0.019, color = [0.5, 0.34, 0.2]) {
  kit.add('timber', lathe([[r0 * 0.6, 0], [r0, 0.02], [r0, 0.3], [(r0 + r1) / 2, h * 0.6], [r1, h]], 8), W, { color, burn: 0.6 });
  // the iron shoe at the butt
  kit.add('metal', lathe([[0, -0.07], [r0 * 0.5, -0.05], [r0 * 1.1, 0.0], [r0 * 1.1, 0.05], [r0, 0.06]], 8), W, { color: DARK });
}
function horsehair(kit, W, color = RED, s = 1) {
  // a full skirt of dyed horsehair under the head, hanging in locks
  const g = new THREE.CylinderGeometry(0.018 * s, 0.07 * s, 0.24 * s, 14, 3, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)), y = p.getY(i);
    const lock = 1 + 0.18 * Math.sin(a * 7) * (0.5 - y / (0.24 * s));
    p.setXYZ(i, p.getX(i) * lock, y + Math.sin(a * 5) * 0.012 * (0.5 - y / (0.24 * s)), p.getZ(i) * lock);
  }
  g.computeVertexNormals();
  kit.add('cloth', g, mul(W, M(0, -0.12 * s, 0)), { color, sway: (x, y) => Math.max(0, -y) * 2.2, burn: BURN });
}
function spearHead(kit, W, { steel = STEEL, len = 0.3, w = 0.062 } = {}) {
  kit.add('gilt', lathe([[0.017, 0], [0.021, 0.02], [0.019, 0.08], [0.012, 0.1]], 8), W, { color: BRASS });
  kit.add('steel', bladeGeo(len, w, 0.015, 0, len * 0.55), mul(W, M(0, 0.1, 0)), { color: steel });
}
function spear(kit, W, { h = 2.15, tasselCol = RED, steel = STEEL } = {}) {
  pole(kit, W, h);
  spearHead(kit, mul(W, M(0, h, 0)), { steel });
  if (tasselCol) horsehair(kit, mul(W, M(0, h + 0.02, 0)), tasselCol);
}
// the guandao: a broad crescent blade with a notched spine, set in a dragon-mouth socket on a long red pole
const GUAN = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.03, 0); s.quadraticCurveTo(0.2, 0.08, 0.2, 0.42); s.quadraticCurveTo(0.2, 0.56, 0.12, 0.64);
  s.quadraticCurveTo(0.1, 0.5, -0.02, 0.48); s.lineTo(-0.035, 0.4); s.lineTo(-0.012, 0.37); s.lineTo(-0.04, 0.32); s.lineTo(-0.015, 0.29);
  s.quadraticCurveTo(-0.045, 0.12, -0.03, 0);
  return s;
})();
function guandao(kit, W, { h = 1.95, steel = STEEL } = {}) {
  pole(kit, W, h, 0.025, 0.022, [0.4, 0.1, 0.07]);
  kit.add('gilt', lathe([[0.024, 0], [0.034, 0.03], [0.03, 0.09], [0.038, 0.12], [0.022, 0.15]], 10), mul(W, M(0, h - 0.02, 0)), { color: GOLD });
  kit.add('steel', plate(GUAN, 0.016, 0.003, 8), mul(W, M(0.0, h + 0.12, 0)), { color: steel });
  horsehair(kit, mul(W, M(0, h + 0.03, 0)), RED, 1.15);
}
// the ji: a spear point with a crescent blade beside it
const JI = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.02); s.quadraticCurveTo(0.12, -0.03, 0.17, 0.06); s.quadraticCurveTo(0.12, 0.03, 0.1, 0.06); s.quadraticCurveTo(0.06, 0.09, 0, 0.1); s.lineTo(0, -0.02);
  return s;
})();
function ji(kit, W, { h = 2.1 } = {}) {
  pole(kit, W, h, 0.022, 0.018, [0.46, 0.3, 0.18]);
  spearHead(kit, mul(W, M(0, h, 0)), { len: 0.28 });
  kit.add('steel', plate(JI, 0.014, 0.003), mul(W, M(0.012, h + 0.1, 0)), { color: STEEL });
  horsehair(kit, mul(W, M(0, h + 0.02, 0)), [0.12, 0.1, 0.1]);
}
// the trident: three prongs off a crossbar
function trident(kit, W, { h = 2.05 } = {}) {
  pole(kit, W, h, 0.022, 0.019, [0.48, 0.32, 0.2]);
  kit.add('gilt', lathe([[0.019, 0], [0.026, 0.03], [0.02, 0.08]], 8), mul(W, M(0, h, 0)), { color: BRASS });
  const bar = new THREE.Shape();
  bar.moveTo(-0.11, 0.0); bar.quadraticCurveTo(-0.12, 0.06, -0.1, 0.1); bar.lineTo(-0.085, 0.1); bar.quadraticCurveTo(-0.09, 0.05, 0, 0.04); bar.quadraticCurveTo(0.09, 0.05, 0.085, 0.1);
  bar.lineTo(0.1, 0.1); bar.quadraticCurveTo(0.12, 0.06, 0.11, 0); bar.quadraticCurveTo(0, -0.02, -0.11, 0);
  kit.add('steel', plate(bar, 0.016, 0.003), mul(W, M(0, h + 0.07, 0)), { color: STEEL });
  for (const x of [-0.092, 0.092]) kit.add('steel', bladeGeo(0.17, 0.024, 0.012, 0, 0.08), mul(W, M(x, h + 0.165, 0)), { color: STEEL });
  kit.add('steel', bladeGeo(0.28, 0.03, 0.013, 0, 0.12), mul(W, M(0, h + 0.1, 0)), { color: STEEL });
}
// a staff: hardwood with iron caps and a red band
function staff(kit, W, { h = 2.2 } = {}) {
  kit.add('timber', mcyl(0.019, 0.021, h, 9), mul(W, M(0, h / 2, 0)), { color: [0.32, 0.2, 0.12], burn: 0.6 });
  for (const y of [0.04, h - 0.04]) kit.add('metal', mcyl(0.023, 0.023, 0.08, 9), mul(W, M(0, y, 0)), { color: DARK });
  kit.add('cloth', mcyl(0.022, 0.022, 0.1, 9), mul(W, M(0, h * 0.62, 0)), { color: RED, burn: BURN });
}
function axe(kit, W, { h = 0.62 } = {}) {
  kit.add('timber', lathe([[0.018, 0], [0.02, 0.1], [0.017, h * 0.7], [0.019, h]], 8), W, { color: [0.45, 0.3, 0.18], burn: 0.6 });
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.06, -0.02); s.quadraticCurveTo(0.17, -0.08, 0.2, -0.04); s.quadraticCurveTo(0.24, 0.08, 0.2, 0.2);
  s.quadraticCurveTo(0.16, 0.22, 0.06, 0.16); s.lineTo(0, 0.14); s.lineTo(0, 0);
  kit.add('steel', plate(s, 0.022, 0.004), mul(W, M(0.016, h - 0.18, 0)), { color: STEEL });
  kit.add('metal', mbox(0.045, 0.15, 0.04), mul(W, M(0, h - 0.11, 0)), { color: DARK });
}
function dagger(kit, W, { steel = STEEL, guard = BRASS } = {}) {
  kit.add('steel', bladeGeo(0.2, 0.032, 0.009, 0, 0.07), W, { color: steel });
  kit.add(fit(guard), plate(JIAN_GUARD, 0.018, 0.002), mul(W, M(0, -0.008, 0, 0, 0, 0, 0.6)), { color: guard });
  kit.add('lacquer', mcyl(0.012, 0.013, 0.1, 7), mul(W, M(0, -0.06, 0)), { color: [0.12, 0.07, 0.05] });
  kit.add(fit(guard), new THREE.SphereGeometry(0.015, 8, 6), mul(W, M(0, -0.115, 0)), { color: guard });
}
function bow(kit, W) {
  const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14 * 2 - 1; pts.push([Math.sin(t * 1.3) * 0.03 + (1 - t * t) * 0.16 - Math.pow(Math.abs(t), 5) * 0.09, t * 0.66, 0]); }
  kit.add('timber', tube(pts, 0.013, 6, 28), W, { color: [0.32, 0.16, 0.09], burn: 0.6 });
  kit.add('cloth', mcyl(0.016, 0.016, 0.12, 8), mul(W, M(pts[7][0], 0, 0)), { color: [0.55, 0.42, 0.25], burn: 0.6 });
  kit.add('timber', tube([pts[0], pts[14]], 0.0025, 3, 2), W, { color: [0.9, 0.88, 0.8] });
}
function quiver(kit, W, rand) {
  kit.add('cloth', lathe([[0.055, 0], [0.068, 0.04], [0.07, 0.4], [0.075, 0.5], [0.07, 0.52]], 12), W, { color: [0.36, 0.17, 0.09], burn: BURN });
  kit.add('gilt', mcyl(0.077, 0.077, 0.03, 12, true), mul(W, M(0, 0.49, 0)), { color: BRASS });
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * 6.28 + rand() * 0.3, r = 0.035 + rand() * 0.02, L = 0.78 + rand() * 0.05;
    const Wa = mul(W, M(Math.cos(a) * r, 0.05, Math.sin(a) * r, 0, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.08));
    kit.add('timber', mcyl(0.0045, 0.0045, L, 4), mul(Wa, M(0, L / 2, 0)), { color: [0.78, 0.66, 0.46] });
    const fl = new THREE.PlaneGeometry(0.03, 0.09);
    for (const ry of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) kit.add('cloth', fl, mul(Wa, M(0, L - 0.06, 0, ry + a, 0, 0)), { color: rand() < 0.5 ? [0.92, 0.9, 0.84] : [0.62, 0.12, 0.08], burn: BURN });
  }
}
function shield(kit, W, motif, rim = DARK) {
  kit.add('plank', lathe([[0, 0.055], [0.2, 0.05], [0.33, 0.03], [0.37, 0.0], [0.375, -0.012], [0.36, -0.016], [0, -0.012]], 28), mul(W, M(0, 0, 0, 0, Math.PI / 2)), { color: [0.52, 0.28, 0.16], burn: BURN });
  kit.add(fit(rim), new THREE.TorusGeometry(0.37, 0.016, 6, 40), W, { color: rim });
  kit.add('lacquer', new THREE.RingGeometry(0.2, 0.29, 36), mul(W, M(0, 0, 0.034)), { color: motif });
  kit.add('lacquer', new THREE.RingGeometry(0.1, 0.13, 30), mul(W, M(0, 0, 0.049)), { color: motif });
  kit.add('gilt', new THREE.SphereGeometry(0.065, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mul(W, M(0, 0, 0.05, 0, Math.PI / 2)), { color: GOLD });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; kit.add('gilt', new THREE.SphereGeometry(0.014, 6, 4), mul(W, M(Math.cos(a) * 0.335, Math.sin(a) * 0.335, 0.03)), { color: BRASS }); }
}

// ------------------------------------------------------------------ the furniture
// the curl at the ends of a crest board or an altar table (an upturned scroll), w wide (x), h high (y)
function scrollEnd(w, h) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(w * 0.55, 0); s.quadraticCurveTo(w * 0.95, 0.0, w, h * 0.55); s.quadraticCurveTo(w * 1.02, h * 0.95, w * 0.78, h);
  s.quadraticCurveTo(w * 0.55, h * 1.02, w * 0.55, h * 0.75); s.quadraticCurveTo(w * 0.6, h * 0.55, w * 0.76, h * 0.6);
  s.quadraticCurveTo(w * 0.7, h * 0.3, w * 0.45, h * 0.32); s.lineTo(0, h * 0.32); s.lineTo(0, 0);
  return s;
}
// carved peg: an S-bracket standing off a wall, its tip turned up to hold what lies across it (z out of the wall)
const PEG = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.03); s.lineTo(0.03, -0.03); s.quadraticCurveTo(0.09, -0.02, 0.11, 0.0); s.quadraticCurveTo(0.13, 0.03, 0.12, 0.05);
  s.lineTo(0.105, 0.05); s.quadraticCurveTo(0.1, 0.02, 0.07, 0.012); s.quadraticCurveTo(0.03, 0.01, 0, 0.03); s.lineTo(0, -0.03);
  return s;
})();
function peg(kit, W, color = GOLD) {
  // (the shape's x runs out from the wall: turn it so it stands off along +z)
  kit.add(fit(color), plate(PEG, 0.022, 0.003), mul(W, M(0, 0, 0, -Math.PI / 2)), { color });
  kit.add(fit(color), mcyl(0.022, 0.022, 0.012, 10), mul(W, M(0, 0, 0.004, 0, Math.PI / 2)), { color });
}
// the arm of a sword stand: reaching out from its upright, the end turned up into a cradle (in x-y, x outward)
const CRADLE_ARM = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.022); s.lineTo(0.07, -0.022); s.quadraticCurveTo(0.125, -0.02, 0.13, 0.03); s.lineTo(0.112, 0.034);
  s.quadraticCurveTo(0.106, 0.008, 0.08, 0.008); s.quadraticCurveTo(0.05, 0.008, 0.035, 0.02); s.quadraticCurveTo(0.02, 0.03, 0, 0.03); s.lineTo(0, -0.022);
  return s;
})();
// a sword stand: a lacquered base, two uprights each with arms out to cradle the swords laid across them;
// W at the middle of the base, the swords lying along x, the arms reaching toward +z (the eye)
function swordStand(kit, W, { span = 0.6, tiers = [0.16, 0.32], base = [0.86, 0.26], color = LAQ_BLACK, trim = GOLD, tall = 0.4 } = {}) {
  kit.add('lacquer', slab(base[0], 0.05, base[1], 0.02, 0.008), mul(W, M(0, 0.025, 0)), { color, burn: BURN });
  kit.add(fit(trim), slab(base[0] + 0.01, 0.008, base[1] + 0.01, 0.02, 0.002), mul(W, M(0, 0.052, 0)), { color: trim });
  for (const sx of [-1, 1]) {
    const x = sx * span / 2;
    kit.add('lacquer', slab(0.045, tall, 0.07, 0.012, 0.006), mul(W, M(x, 0.05 + tall / 2, -0.03)), { color, burn: BURN });
    kit.add(fit(trim), new THREE.SphereGeometry(0.03, 10, 8), mul(W, M(x, 0.05 + tall + 0.012, -0.03)), { color: trim });
    for (const y of tiers) kit.add('lacquer', plate(CRADLE_ARM, 0.045, 0.004), mul(W, M(x, 0.05 + y, 0.0, -Math.PI / 2)), { color, burn: BURN });
  }
  // where a sword laid across tier i rests (the cradle's floor, above the arm's crook)
  return tiers.map(y => new THREE.Vector3(0, 0.05 + y + 0.022, 0.095));
}
// cloth draped over a table top and down its sides: w along x, the top d deep (z), hanging dropF in front, dropB
// behind; colour from its own vertices (gold along the hanging edges)
function drape(w, d, dropF, dropB, { nx = 26, nz = 26, folds = 5, body = SILK, trim = [0.95, 0.68, 0.22] } = {}) {
  const L = d + dropF + dropB;
  const g = new THREE.PlaneGeometry(w, L, nx, nz);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), s = p.getY(i) + L / 2;            // s: along the cloth from the back edge
    let y, z;
    if (s < dropB) { const k = dropB - s; y = -k; z = -d / 2 - 0.006 - k * 0.02; }
    else if (s < dropB + d) { y = 0.004; z = -d / 2 + (s - dropB); }
    else { const k = s - dropB - d; y = -k; z = d / 2 + 0.006 + k * 0.03; }
    // folds where it hangs, and a weight to its hem
    const hang = Math.max(0, s - dropB - d) / Math.max(dropF, 1e-3) + Math.max(0, dropB - s) / Math.max(dropB, 1e-3);
    z += Math.sin(x / w * Math.PI * 2 * folds + 0.6) * 0.022 * hang * (s > dropB ? 1 : -1);
    y += Math.cos(x / w * Math.PI * 2 * folds + 0.6) * 0.012 * hang;
    p.setXYZ(i, x, y, z);
    const edge = Math.min(Math.abs(s), Math.abs(L - s));
    const band = (edge < 0.035 ? 1 : 0) + (edge > 0.06 && edge < 0.075 ? 0.85 : 0);
    const c = band > 0 ? trim : body;
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
// a table with everted ends (the top's ends curling up), horse-hoof legs, beaded aprons and spandrels; W at the floor
// under its middle; returns the height of its top
function altarTable(kit, W, { w = 1.15, d = 0.48, h = 0.8, color = LAQ_BLACK, trim = GOLD } = {}) {
  const t = 0.045;
  kit.add('lacquer', slab(w, t, d, 0.01, 0.008), mul(W, M(0, h - t / 2, 0)), { color, burn: BURN });
  for (const sx of [-1, 1]) kit.add('lacquer', plate(scrollEnd(0.1, 0.07), d * 0.94, 0.006), mul(W, M(sx * (w / 2 - 0.06), h - 0.004, 0, sx < 0 ? Math.PI : 0)), { color, burn: BURN });
  kit.add(fit(trim), slab(w - 0.08, 0.008, d + 0.004, 0.004, 0.002), mul(W, M(0, h - t - 0.004, 0)), { color: trim });
  const lx = w / 2 - 0.1, lz = d / 2 - 0.05;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kit.add('lacquer', slab(0.05, h - t, 0.05, 0.012, 0.006), mul(W, M(sx * lx, (h - t) / 2, sz * lz)), { color, burn: BURN });
    // the hoof: the foot turned out
    kit.add('lacquer', slab(0.07, 0.04, 0.07, 0.015, 0.008), mul(W, M(sx * (lx + 0.008), 0.02, sz * (lz + 0.008))), { color, burn: BURN });
  }
  for (const sz of [-1, 1]) {
    kit.add('lacquer', slab(2 * lx - 0.03, 0.07, 0.022, 0.01, 0.005), mul(W, M(0, h - t - 0.04, sz * (lz + 0.012))), { color, burn: BURN });
    kit.add(fit(trim), mcyl(0.006, 0.006, 2 * lx - 0.05, 6), mul(W, M(0, h - t - 0.075, sz * (lz + 0.02), 0, 0, Math.PI / 2)), { color: trim });
    // spandrels at the legs: a cloud-cut bracket in each corner
    for (const sx of [-1, 1]) {
      const sp = new THREE.Shape(); sp.moveTo(0, 0); sp.lineTo(0.12, 0); sp.quadraticCurveTo(0.06, -0.01, 0.04, -0.05); sp.quadraticCurveTo(0.03, -0.09, 0, -0.1); sp.lineTo(0, 0);
      kit.add('lacquer', plate(sp, 0.02, 0.003), mul(W, M(sx * (lx - 0.025), h - t - 0.075, sz * (lz + 0.012), sx > 0 ? Math.PI : 0)), { color, burn: BURN });
    }
  }
  for (const sx of [-1, 1]) kit.add('lacquer', slab(0.025, 0.035, 2 * lz, 0.006, 0.004), mul(W, M(sx * lx, 0.16, 0)), { color, burn: BURN });
  return h;
}

// ------------------------------------------------------------------ the stall
// W at the terrace floor in front of the house's open front (the house front line), +z toward the street, +x along
// the front; opts.beamY: the underside of the porch beam (over z = opts.porchZ), the posts of the porch at
// opts.posts (x). Returns the auras to draw: [{ base, dir, len, width, tier }] in world space, and the anchor where
// he stops to look (anchor).
export function buildWeaponStall(kit, W, rand, { beamY = 2.45, porchZ = 1.55, posts = [-5, 0, 5] } = {}) {
  const auras = [];
  const add = (Wb, len, width, tier) => {
    const base = new THREE.Vector3(0, 0, 0).applyMatrix4(Wb), tip = new THREE.Vector3(0, len, 0).applyMatrix4(Wb);
    auras.push({ base, dir: tip.clone().sub(base).normalize(), len: base.distanceTo(tip), width, tier });
  };
  const L = (x, y, z, ry = 0, rx = 0, rz = 0) => mul(W, M(x, y, z, ry, rx, rz));
  const H = Math.PI / 2;

  // ---- left: the arms rack, its polearms standing in it
  {
    const R = L(-3.15, 0, 0.42);
    const RW = 2.6, rx = RW / 2;
    // the sill on its feet, the posts, the rails, the crest
    kit.add('timber', slab(RW + 0.2, 0.1, 0.4, 0.03, 0.012), mul(R, M(0, 0.08, 0)), { color: WOOD_D, burn: BURN });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', slab(0.12, 0.05, 0.1, 0.025, 0.01), mul(R, M(sx * (rx + 0.02), 0.025, sz * 0.13)), { color: WOOD_D, burn: BURN });
    for (const sx of [-1, 1]) {
      kit.add('timber', turnedPost(2.26, 0.042), mul(R, M(sx * rx, 0.13, 0)), { color: WOOD, burn: BURN });
      // (feet braced front and back with carved cloud brackets)
      for (const sz of [-1, 1]) kit.add('timber', plate(scrollEnd(0.12, 0.13), 0.04, 0.005), mul(R, M(sx * rx, 0.13, sz * 0.03, sz > 0 ? -H : H)), { color: WOOD, burn: BURN });
    }
    // the lower rail with its sockets; the upper rail with its rings the shafts pass through
    kit.add('timber', slab(RW, 0.08, 0.3, 0.02, 0.01), mul(R, M(0, 0.36, 0)), { color: WOOD, burn: BURN });
    kit.add('timber', slab(RW, 0.07, 0.16, 0.02, 0.01), mul(R, M(0, 1.62, 0)), { color: WOOD, burn: BURN });
    kit.add('timber', slab(RW, 0.05, 0.12, 0.015, 0.008), mul(R, M(0, 1.1, -0.04)), { color: WOOD_D, burn: BURN });
    // the crest board: a red lacquer panel framed in dark wood, its ends curled up into scrolls
    kit.add('timber', slab(RW + 0.12, 0.06, 0.09, 0.02, 0.01), mul(R, M(0, 2.0, 0)), { color: WOOD, burn: BURN });
    kit.add('lacquer', slab(RW - 0.3, 0.2, 0.05, 0.02, 0.008), mul(R, M(0, 2.14, 0)), { color: LAQ_RED, burn: BURN });
    kit.add('gilt', slab(RW - 0.26, 0.24, 0.04, 0.02, 0.004), mul(R, M(0, 2.14, -0.006)), { color: GOLD });
    kit.add('timber', slab(RW - 0.1, 0.05, 0.08, 0.015, 0.008), mul(R, M(0, 2.27, 0)), { color: WOOD, burn: BURN });
    for (const sx of [-1, 1]) kit.add('timber', plate(scrollEnd(0.26, 0.26), 0.07, 0.008), mul(R, M(sx * (rx - 0.24), 2.03, 0, sx < 0 ? Math.PI : 0)), { color: WOOD, burn: BURN });
    // a row of gold studs along the crest
    for (let i = 0; i < 9; i++) kit.add('gilt', new THREE.SphereGeometry(0.014, 8, 6), mul(R, M(-1.0 + i * 0.25, 2.14, 0.03)), { color: GOLD });
    // the weapons in it: [x, kind, tier]
    const items = [[-1.05, 'spear', 0], [-0.75, 'staff', 0], [-0.43, 'ji', 2], [-0.08, 'guandao', 3], [0.3, 'trident', 1], [0.62, 'spear', 0], [0.92, 'spear', 1]];
    for (const [x, kind, tier] of items) {
      const lean = rand.range(-0.012, 0.012);
      const Wb = mul(R, M(x, 0.385, 0.02, rand.range(-0.4, 0.4), 0, lean));
      // (the socket it stands in, the ring it passes through)
      kit.add('metal', mcyl(0.032, 0.032, 0.02, 10), mul(R, M(x, 0.405, 0.02)), { color: DARK });
      kit.add('gilt', new THREE.TorusGeometry(0.03, 0.007, 6, 14), mul(R, M(x, 1.66, 0.02, 0, H)), { color: BRASS });
      if (kind === 'spear') { const h = rand.range(1.84, 1.94); spear(kit, Wb, { h, tasselCol: tier ? RED : [0.82, 0.62, 0.2] }); add(mul(Wb, M(0, h + 0.1, 0)), 0.3, 0.08, tier); }
      else if (kind === 'staff') { staff(kit, Wb, { h: 2.12 }); }
      else if (kind === 'ji') { ji(kit, Wb, { h: 1.9 }); add(mul(Wb, M(0, 2.0, 0)), 0.28, 0.16, tier); }
      else if (kind === 'trident') { trident(kit, Wb, { h: 1.88 }); add(mul(Wb, M(0, 1.96, 0)), 0.36, 0.2, tier); }
      else { guandao(kit, Wb, { h: 1.64 }); add(mul(Wb, M(0.08, 1.76, 0)), 0.62, 0.3, tier); }
    }
  }
  // ---- left, in front: a low bench with a tiered stand of sheathed swords on it; a tub of staves
  {
    const B = L(-3.05, 0, 1.85);
    kit.add('timber', slab(1.3, 0.06, 0.42, 0.02, 0.01), mul(B, M(0, 0.42, 0)), { color: WOOD, burn: BURN });
    for (const sx of [-1, 1]) {
      kit.add('timber', slab(0.06, 0.39, 0.36, 0.015, 0.008), mul(B, M(sx * 0.56, 0.195, 0)), { color: WOOD_D, burn: BURN });
      kit.add('timber', plate(scrollEnd(0.12, 0.1), 0.05, 0.005), mul(B, M(sx * 0.53, 0.39, 0.0, sx < 0 ? 0 : Math.PI, 0, Math.PI)), { color: WOOD_D, burn: BURN });
    }
    const S = mul(B, M(0, 0.45, -0.02));
    const rests = swordStand(kit, S, { span: 0.62, tiers: [0.1, 0.24, 0.38], base: [0.9, 0.3], tall: 0.44 });
    const kinds = [['jian', LAQ_BLACK, GOLD, 1], ['dao', [0.34, 0.13, 0.08], BRASS, 0], ['jian', [0.12, 0.2, 0.3], [1.3, 1.35, 1.45], 2]];
    rests.forEach((r, i) => {
      const [kind, col, fit, tier] = kinds[i];
      // (laid across the cradles: the scabbard's mouth to the left, the hilt out past the left arm)
      const Ws = mul(S, M(-0.28, r.y + 0.012, r.z, 0, 0, -H));
      if (kind === 'jian') { sheathedJian(kit, Ws, { len: 0.74, color: col, guard: fit, tasselCol: i === 0 ? RED : [0.85, 0.7, 0.2] }); add(Ws, 0.74, 0.07, tier); }
      else { sheathedDao(kit, Ws, { len: 0.68, color: col, guard: fit }); add(Ws, 0.68, 0.09, tier); }
    });
    // the tub: staves and spears stood in it, leaning as they fall
    const T = L(-4.42, 0, 1.92);
    kit.add('plank', lathe([[0.0, 0], [0.24, 0], [0.27, 0.06], [0.28, 0.3], [0.26, 0.56], [0.24, 0.58], [0.22, 0.56], [0.24, 0.3], [0.0, 0.3]], 18), T, { color: 0.62, burn: BURN });
    for (const y of [0.1, 0.48]) kit.add('metal', mcyl(0.275 + (y > 0.3 ? -0.012 : 0.004), 0.28, 0.035, 18, true), mul(T, M(0, y, 0)), { color: DARK });
    const lean = [[0.08, 0.05, 0.18, 0.4, 'staff'], [-0.07, 0.06, -0.14, 0.2, 'spear'], [0.02, -0.09, 0.08, -0.22, 'staff'], [-0.1, -0.04, -0.2, -0.1, 'staff'], [0.1, -0.03, 0.12, 0.05, 'spear']];
    for (const [x, z, rz, rx, kind] of lean) {
      const Wl = mul(T, M(x, 0.04, z, 0, rx * 0.5, rz * 0.6));
      if (kind === 'staff') staff(kit, Wl, { h: rand.range(1.7, 1.95) });
      else { spear(kit, Wl, { h: rand.range(1.6, 1.75), tasselCol: RED }); }
    }
  }
  // ---- right: the sword wall under the 神兵 plaque
  let wall;
  {
    const S = L(2.9, 0, 0.2);
    wall = new THREE.Vector3(0, 1.6, 0.1).applyMatrix4(S);
    const PW = 3.5, y0 = 0.62, y1 = 2.36, PH = y1 - y0;
    // the panel: dark lacquer in a wooden frame, a gold bead inside the frame, on two stout feet
    kit.add('lacquer', slab(PW, PH, 0.05, 0.02, 0.01), mul(S, M(0, y0 + PH / 2, 0)), { color: [0.11, 0.06, 0.045], burn: BURN });
    kit.add('timber', slab(PW + 0.14, 0.1, 0.09, 0.03, 0.012), mul(S, M(0, y1 + 0.03, 0.01)), { color: WOOD_D, burn: BURN });
    kit.add('timber', slab(PW + 0.1, 0.1, 0.09, 0.03, 0.012), mul(S, M(0, y0 - 0.03, 0.01)), { color: WOOD_D, burn: BURN });
    for (const sx of [-1, 1]) {
      kit.add('timber', slab(0.1, PH + 0.18, 0.09, 0.03, 0.012), mul(S, M(sx * (PW / 2 + 0.02), y0 + PH / 2, 0.01)), { color: WOOD_D, burn: BURN });
      kit.add('timber', slab(0.16, y0, 0.22, 0.03, 0.012), mul(S, M(sx * (PW / 2 - 0.25), y0 / 2, 0.04)), { color: WOOD_D, burn: BURN });
    }
    for (const [w, h, y] of [[PW - 0.16, 0.012, y1 - 0.06], [PW - 0.16, 0.012, y0 + 0.06]]) kit.add('gilt', slab(w, h, 0.012, 0.004, 0.002), mul(S, M(0, y, 0.03)), { color: GOLD });
    for (const sx of [-1, 1]) kit.add('gilt', slab(0.012, PH - 0.12, 0.012, 0.004, 0.002), mul(S, M(sx * (PW / 2 - 0.08), y0 + PH / 2, 0.03)), { color: GOLD });
    // the plaque over it: 神兵, gold on black, in a carved frame with scrolls either side
    // (at the head of the panel, inside it: from the street the porch beam would hide anything higher)
    kit.add('timber', slab(1.12, 0.56, 0.07, 0.03, 0.012), mul(S, M(0, y1 - 0.33, 0.05)), { color: WOOD_D, burn: BURN });
    kit.add('sign', atlasQuad(SIGN_CELLS['神兵'], 1.0, 0.5), mul(S, M(0, y1 - 0.33, 0.09)), { burn: BURN, vis: 3 });
    for (const sx of [-1, 1]) kit.add('gilt', plate(scrollEnd(0.2, 0.2), 0.03, 0.004), mul(S, M(sx * 0.54, y1 - 0.58, 0.06, sx < 0 ? Math.PI : 0)), { color: GOLD });
    // what lies on the pegs: [y, x, kind, tier, len]
    const rows = [
      [1.92, -1.12, 'jian', 1, 0.68], [1.92, 1.2, 'jian', 0, 0.68],
      [1.62, 0, 'crimson', 5, 0.76],
      [1.33, -0.95, 'dao', 0, 0.7], [1.33, 0.95, 'dao', 2, 0.74],
      [1.04, -1.05, 'jian', 0, 0.74], [1.04, 0.0, 'jian', 3, 0.8], [1.04, 1.05, 'jian', 0, 0.72],
      [0.78, -0.95, 'dagger', 0], [0.78, -0.5, 'dagger', 1], [0.78, 0.5, 'dagger', 0], [0.78, 0.95, 'dagger', 0],
    ];
    for (const [y, x, kind, tier, len] of rows) {
      if (kind === 'dagger') {
        for (const sx of [-1, 1]) peg(kit, mul(S, M(x + sx * 0.12, y, 0.025)), BRASS);
        const Wd = mul(S, M(x - 0.1, y + 0.028, 0.09, 0, 0, -H));
        dagger(kit, Wd); add(Wd, 0.2, 0.04, tier);
        continue;
      }
      const span = kind === 'crimson' ? 0.6 : 0.5;
      for (const sx of [-1, 1]) peg(kit, mul(S, M(x + sx * span / 2, y, 0.025)), kind === 'crimson' ? GOLD : BRASS);
      // (laid across its pegs: the hilt to the left, the blade to the right; a little proud of the panel)
      const hl = (len || 0.78) * 0.5;
      const Wb = mul(S, M(x - hl + 0.06, y + 0.03, 0.095, 0, 0, -H));
      if (kind === 'jian') { jian(kit, Wb, { len, tasselCol: tier ? RED : [0.85, 0.7, 0.2], steel: tier === 3 ? [1.25, 1.2, 1.55] : STEEL, guard: tier === 3 ? [1.2, 0.6, 1.4] : GOLD }); add(Wb, len, 0.07, tier); }
      else if (kind === 'dao') { dao(kit, Wb, { len, tasselCol: RED }); add(Wb, len, 0.09, tier); }
      else {
        // the crimson sabre at the head of the wall, its scabbard on the pegs below it
        dao(kit, Wb, { len, steel: [0.78, 0.3, 0.26], guard: [0.32, 0.3, 0.3], hilt: [0.25, 0.04, 0.03], tasselCol: [0.9, 0.12, 0.08] });
        kit.add('glow', bladeGeo(len * 0.8, 0.005, 0.014, 0.13 * 1.25, 0.1, 16), mul(Wb, M(0.006, 0.05, 0)), { color: [1.0, 0.25, 0.1] });
        add(Wb, len, 0.11, tier);
      }
    }
  }
  // ---- before the wall: the altar table under red silk, the stand, and on it the sword that is not like the others
  let anchor;
  {
    const T = L(2.2, 0, 1.96);
    const top = altarTable(kit, T, { w: 1.36, d: 0.5, h: 0.8 });
    kit.add('cloth', drape(1.08, 0.5, 0.42, 0.16, { folds: 4 }), mul(T, M(0, top + 0.002, 0)), { burn: BURN, sway: (x, y) => Math.max(0, -y) * 0.25 });
    const S = mul(T, M(0, top + 0.008, -0.03));
    const rests = swordStand(kit, S, { span: 0.56, tiers: [0.12, 0.27], base: [0.82, 0.24], color: LAQ_BLACK, trim: GOLD, tall: 0.32 });
    // the lower cradle: its scabbard, black lacquer bound in gold
    sheath(kit, mul(S, M(-0.4, rests[0].y + 0.014, rests[0].z, 0, 0, -H)), { len: 0.94, w: 0.056, t: 0.026, color: [0.05, 0.03, 0.03], fit: GOLD });
    // the upper: the blade itself, bare, dark steel with a line of gold down it
    const Wb = mul(S, M(-0.3, rests[1].y + 0.012, rests[1].z, 0, 0.18, -H));
    jian(kit, Wb, { len: 0.92, steel: [0.4, 0.38, 0.44], guard: [1.15, 1.0, 0.85], hilt: [0.1, 0.06, 0.05], tasselCol: [1.0, 0.75, 0.2], wide: 1.15, inlay: [1.0, 0.62, 0.18] });
    add(Wb, 0.95, 0.12, 4);
    anchor = new THREE.Vector3(0, top + 0.3, 0.2).applyMatrix4(T);
    // a censer beside it, a curl of smoke the eye does not see (it is the light that he sees)
    kit.add('gilt', lathe([[0, 0], [0.05, 0], [0.06, 0.03], [0.07, 0.07], [0.055, 0.1], [0.06, 0.11], [0, 0.11]], 14), mul(T, M(0.5, top + 0.01, 0.13)), { color: BRASS });
  }
  // ---- right, in front: the table of knives, axes and arrowheads; the bow and quiver by it
  {
    const T = L(4.0, 0, 1.92);
    kit.add('timber', slab(1.12, 0.05, 0.56, 0.02, 0.01), mul(T, M(0, 0.76, 0)), { color: WOOD, burn: BURN });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', slab(0.05, 0.73, 0.05, 0.012, 0.006), mul(T, M(sx * 0.5, 0.365, sz * 0.22)), { color: WOOD_D, burn: BURN });
    for (const sx of [-1, 1]) kit.add('timber', slab(0.03, 0.03, 0.44, 0.008, 0.005), mul(T, M(sx * 0.5, 0.15, 0)), { color: WOOD_D, burn: BURN });
    kit.add('cloth', drape(1.0, 0.56, 0.3, 0.1, { folds: 5, body: [0.12, 0.16, 0.3], trim: [0.86, 0.8, 0.66] }), mul(T, M(0, 0.786, 0)), { burn: BURN, sway: (x, y) => Math.max(0, -y) * 0.25 });
    // the box of knives: lacquered, lined in red, the knives in a row
    const K = mul(T, M(-0.24, 0.79, 0.02, 0.12));
    kit.add('lacquer', slab(0.42, 0.06, 0.3, 0.012, 0.006), mul(K, M(0, 0.03, 0)), { color: LAQ_BLACK, burn: BURN });
    kit.add('cloth', mbox(0.38, 0.01, 0.26), mul(K, M(0, 0.058, 0)), { color: [0.55, 0.05, 0.04], burn: BURN });
    kit.add('lacquer', slab(0.42, 0.26, 0.02, 0.012, 0.005), mul(K, M(0, 0.17, -0.16, 0, -0.35)), { color: LAQ_BLACK, burn: BURN });
    kit.add('cloth', mbox(0.38, 0.22, 0.005), mul(K, M(0, 0.17, -0.148, 0, -0.35)), { color: [0.55, 0.05, 0.04], burn: BURN });
    for (let i = 0; i < 5; i++) { const Wd = mul(K, M(-0.15 + i * 0.075, 0.072, 0.1, 0, -H)); dagger(kit, Wd); add(Wd, 0.2, 0.035, i === 2 ? 2 : 0); }
    // two hand axes crossed on a small stand
    const A = mul(T, M(0.28, 0.79, -0.05));
    kit.add('timber', slab(0.3, 0.03, 0.12, 0.01, 0.005), mul(A, M(0, 0.015, 0)), { color: WOOD_D, burn: BURN });
    for (const s of [-1, 1]) { const Wa = mul(A, M(s * 0.07, 0.03, 0, 0, 0, s * 0.42)); axe(kit, Wa, { h: 0.5 }); add(mul(Wa, M(0.1, 0.38, 0)), 0.18, 0.18, s > 0 ? 1 : 0); }
    // a dish of arrowheads, a whetstone
    kit.add('pottery', lathe([[0, 0], [0.09, 0], [0.12, 0.03], [0.125, 0.04], [0, 0.03]], 16), mul(T, M(0.32, 0.79, 0.18)), { color: [0.42, 0.35, 0.3] });
    for (let i = 0; i < 9; i++) kit.add('steel', new THREE.ConeGeometry(0.012, 0.05, 4), mul(T, M(0.32 + rand.range(-0.07, 0.07), 0.83, 0.18 + rand.range(-0.07, 0.07), rand() * 6, H, rand() * 6)), { color: STEEL });
    kit.add('stone', slab(0.18, 0.04, 0.06, 0.01, 0.006), mul(T, M(0.05, 0.81, 0.2, 0.3)), { color: [0.55, 0.52, 0.5] });
    // the quiver standing at the table's end, the bow hung on the post above the shield
    quiver(kit, L(4.75, 0, 2.2), rand);
  }
  // ---- the porch: shields and the bow on its posts, banners off them, a red valance along the beam
  {
    const pl = posts[0], pr = posts[posts.length - 1];
    shield(kit, L(pl, 1.5, porchZ + 0.2), [0.7, 0.55, 0.15]); add(L(pl, 1.15, porchZ + 0.26), 0.7, 0.5, 0);
    shield(kit, L(pr, 1.62, porchZ + 0.2), [0.15, 0.22, 0.4], BRASS);
    const Wb = L(pr - 0.3, 0.7, porchZ + 0.3, 0.5, 0, -0.16); bow(kit, Wb); add(mul(Wb, M(0.12, -0.6, 0)), 1.2, 0.16, 2);
    // banners: red, gold-edged, hung off arms from the end posts
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? pl : pr, bx = x - sx * 0.45;
      kit.add('timber', mcyl(0.018, 0.018, 0.62, 8), L(x - sx * 0.3, beamY - 0.06, porchZ + 0.18, 0, 0, H), { color: WOOD_D, burn: BURN });
      const bw = 0.42, bh = 1.15;
      const g = new THREE.PlaneGeometry(bw, bh, 3, 10);
      const p = g.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const ex = Math.abs(p.getX(i)) > bw / 2 - 0.03, ey = p.getY(i) < -bh / 2 + 0.04 || p.getY(i) > bh / 2 - 0.03;
        col.set(ex || ey ? [0.95, 0.7, 0.22] : [0.62, 0.07, 0.05], i * 3);
        // (the hem cut in a swallow-tail)
        if (p.getY(i) < -bh / 2 + 0.01) p.setY(i, p.getY(i) + (1 - Math.abs(p.getX(i)) / (bw / 2)) * 0.12);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      kit.add('cloth', g, L(bx, beamY - 0.1 - bh / 2, porchZ + 0.18), { burn: BURN, sway: (xx, yy) => Math.max(0, 0.3 - yy) * 0.35 });
      kit.add('sign', atlasQuad(SIGN_CELLS['劍'], 0.36, 0.18), L(bx, beamY - 0.42, porchZ + 0.19), { burn: BURN, vis: 3 });
    }
    // the valance: scalloped red silk along the porch beam, gold at its head, a tassel at each point
    const VW = (pr - pl) - 0.3, vh = 0.2, n = Math.round(VW / 0.42);
    const g = new THREE.PlaneGeometry(VW, vh, n * 6, 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const ph = ((x + VW / 2) / VW) * n;
      if (y < -vh / 2 + 0.01) p.setY(i, y + 0.07 * (1 - Math.abs(Math.sin(ph * Math.PI))));
      // (gathered: it bellies out a little between the points it is pinned at)
      p.setZ(i, 0.025 * Math.abs(Math.sin(ph * Math.PI)));
      col.set(y > vh / 2 - 0.05 ? [0.95, 0.72, 0.25] : [0.62, 0.06, 0.05], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    kit.add('cloth', g, L((pl + pr) / 2, beamY - vh / 2 + 0.01, porchZ + 0.18), { burn: BURN, sway: (xx, yy) => Math.max(0, -yy) * 0.3 });
    for (let k = 0; k <= n; k++) {
      const x = pl + 0.15 + (k / n) * VW;
      tassel(kit, L(x, beamY - vh + 0.03, porchZ + 0.19), k % 2 ? [0.95, 0.72, 0.25] : RED, 0.16);
    }
  }
  // (where the light that lies on the wares hangs: under the porch roof, over the middle of the stall)
  const fill = new THREE.Vector3(0.6, 2.05, 1.2).applyMatrix4(W);
  return { auras, anchor, wall, fill };
}

// ------------------------------------------------------------------ the auras
// One axis-aligned billboard per blade (turned about the blade to face the eye): a hot line along the steel, tongues
// of light licking up off it, the tier's colour; the legendary ones blaze, throw a halo and shed motes.
const AURA_VS = `attribute vec3 aBase, aDir; attribute vec4 aShape; attribute vec3 aCol;
uniform float uTime;
varying vec2 vQ; varying vec3 vCol; varying float vK, vSeed;
void main(){
  float len = aShape.x, wid = aShape.y;
  vec3 V = normalize(cameraPosition - aBase);
  vec3 side = normalize(cross(aDir, V));
  // (a little past both ends, wider for the strong ones)
  float t = position.y * (len + wid * 2.) - wid;
  vec3 p = aBase + aDir * t + side * position.x * wid * (1.2 + aShape.z * .45);
  vQ = vec2(position.x, t / len);
  vCol = aCol; vK = aShape.z; vSeed = aShape.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}`;
const AURA_FS = `uniform float uTime, uAmt; uniform sampler2D tNoise;
varying vec2 vQ; varying vec3 vCol; varying float vK, vSeed;
void main(){
  float s = vQ.x, t = vQ.y, as = abs(s);
  float inside = smoothstep(-.12, .05, t) * smoothstep(1.2, .92, t);
  float n = texture2D(tNoise, vec2(s * .35 + vSeed, t * 1.2 - uTime * (.35 + vK * .25))).r;
  float n2 = texture2D(tNoise, vec2(s * .9 - vSeed * .7, t * 2.6 - uTime * (.8 + vK * .4))).g;
  // a line of light along each edge of the steel (the blade itself stays dark between them)
  float es = .35 / (1.2 + vK * .45);
  float eq = (as - es) / (es * .45);
  float edge = exp(-eq * eq) * (.65 + .35 * n2);
  // tongues of it licking up off the blade, taller and wilder the higher the tier
  float reach = .22 + .4 * vK;
  float flame = smoothstep(reach * (.4 + .9 * n) + es, es * .8, as) * smoothstep(.32, .78, n2 + t * .15) * smoothstep(es * .7, es * 1.1, as);
  float glow = exp(-s * s * 4.) * .16 * smoothstep(es * .6, es * 1.2, as);
  float pulse = .85 + .15 * sin(uTime * (2. + vK) + vSeed * 9.);
  float I = (edge * 1.1 + flame * (.55 + vK * .55) + glow) * inside * pulse;
  vec3 col = mix(vCol, vec3(1.), clamp(edge * .45, 0., 1.));
  vec3 c = col * I * uAmt * (.5 + vK * .45);
  gl_FragColor = vec4(c, clamp(dot(c, vec3(.3, .5, .2)) * 2., 0., .9));
}`;
// motes shed by the legendary blades: sparks of their colour rising, drifting, going out
const MOTE_VS = `attribute vec4 aM; attribute vec3 aBase, aDir, aCol; uniform float uTime, uAmt;
varying vec3 vCol; varying float vA; varying vec2 vUv;
void main(){
  vUv = uv;
  float life = 1.6 + aM.w * 1.4, t = fract((uTime + aM.w * 9.) / life);
  vec3 p = aBase + aDir * aM.x + vec3(sin(aM.w * 40. + uTime * .9) * .12, t * (.9 + aM.w * .6), cos(aM.w * 31. + uTime * .7) * .12) * (.4 + t);
  vec4 c = viewMatrix * vec4(p, 1.);
  c.xy += position.xy * .025 * (1. - t * .6);
  vCol = aCol; vA = sin(3.14159 * t) * uAmt;
  gl_Position = projectionMatrix * c;
}`;
const MOTE_FS = `varying vec3 vCol; varying float vA; varying vec2 vUv;
void main(){ vec2 q = vUv * 2. - 1.; float r = dot(q, q); if (r > 1.) discard; vec3 c = vCol * (exp(-r * 4.) * 2.5) * vA; gl_FragColor = vec4(c, clamp(dot(c, vec3(.3, .5, .2)) * 2., 0., .9)); }`;

// (additive light; the scene alpha pulled down where it is bright, so the painted pass leaves the light smooth: plain
// additive blending wrote 2 into it over the whole of each card)
const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };

const _auraCol = new THREE.Color(0xffb850), _fillCol = new THREE.Color(0xffdcb0);
const clamp01 = x => Math.min(1, Math.max(0, x));
export function createAuras(list, noise, fillAt = null) {
  const group = new THREE.Group();
  group.name = 'auras';
  const base = new THREE.PlaneGeometry(2, 1);
  base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  const n = list.length;
  const aB = new Float32Array(n * 3), aD = new Float32Array(n * 3), aS = new Float32Array(n * 4), aC = new Float32Array(n * 3);
  list.forEach((a, i) => {
    const T = TIER[a.tier];
    aB.set(a.base.toArray(), i * 3); aD.set(a.dir.toArray(), i * 3);
    aS.set([a.len, a.width, T.k, i * 0.137], i * 4);
    aC.set(T.col, i * 3);
  });
  g.setAttribute('aBase', new THREE.InstancedBufferAttribute(aB, 3));
  g.setAttribute('aDir', new THREE.InstancedBufferAttribute(aD, 3));
  g.setAttribute('aShape', new THREE.InstancedBufferAttribute(aS, 4));
  g.setAttribute('aCol', new THREE.InstancedBufferAttribute(aC, 3));
  g.instanceCount = n;
  const u = { uTime: { value: 0 }, uAmt: { value: 0 }, tNoise: { value: noise } };
  // (the legendary one also throws a soft halo of its light into the air round it)
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: AURA_VS, fragmentShader: AURA_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...ADD }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 15;
  group.add(mesh);
  // motes from the legendary ones (and a few from the epic)
  const src = list.filter(a => a.tier >= 3);
  const NM = 90;
  const mg = new THREE.InstancedBufferGeometry();
  const mb = new THREE.PlaneGeometry(2, 2);
  mg.index = mb.index; mg.setAttribute('position', mb.attributes.position); mg.setAttribute('uv', mb.attributes.uv);
  const mM = new Float32Array(NM * 4), mB = new Float32Array(NM * 3), mD = new Float32Array(NM * 3), mC = new Float32Array(NM * 3);
  let sd = 77;
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < NM; i++) {
    const a = src.length ? src[i % src.length] : list[0];
    const legend = a.tier >= 4 ? 1 : 0.3;
    if (r() > legend && i % 3) { mM.set([0, 0, 0, r()], i * 4); }
    else mM.set([r() * a.len, 0, 0, r()], i * 4);
    mB.set(a.base.toArray(), i * 3); mD.set(a.dir.toArray(), i * 3); mC.set(TIER[a.tier].col, i * 3);
  }
  mg.setAttribute('aM', new THREE.InstancedBufferAttribute(mM, 4));
  mg.setAttribute('aBase', new THREE.InstancedBufferAttribute(mB, 3));
  mg.setAttribute('aDir', new THREE.InstancedBufferAttribute(mD, 3));
  mg.setAttribute('aCol', new THREE.InstancedBufferAttribute(mC, 3));
  mg.instanceCount = NM;
  const mu = { uTime: u.uTime, uAmt: { value: 0 } };
  const motes = new THREE.Mesh(mg, new THREE.ShaderMaterial({ uniforms: mu, vertexShader: MOTE_VS, fragmentShader: MOTE_FS, transparent: true, depthWrite: false, ...ADD }));
  motes.frustumCulled = false;
  motes.renderOrder = 15;
  group.add(motes);
  // a soft halo of its light in the air round the legendary blade
  const halos = list.filter(a => a.tier >= 4).map(a => {
    const hu = { uAmt: { value: 0 }, uTime: u.uTime, uCol: { value: new THREE.Color(...TIER[a.tier].col) } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: hu, transparent: true, depthWrite: false, ...ADD,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 c = modelViewMatrix * vec4(0., 0., 0., 1.); c.xy += position.xy * vec2(.55, 1.); gl_Position = projectionMatrix * c; }`,
      fragmentShader: `uniform float uAmt, uTime; uniform vec3 uCol; varying vec2 vUv; void main(){ vec2 q = vUv * 2. - 1.; float r = length(q); float I = exp(-r * r * 4.) * .5 + exp(-r * 9.) * .5; I *= .85 + .15 * sin(uTime * 2.3); vec3 c = uCol * I * uAmt; gl_FragColor = vec4(c, clamp(dot(c, vec3(.3, .5, .2)) * 2., 0., .9)); }`,
    }));
    m.position.copy(a.base).addScaledVector(a.dir, a.len * 0.5);
    m.frustumCulled = false; m.renderOrder = 14;
    group.add(m);
    return hu;
  });
  // a warm light from the legendary blade on the stall while it blazes (kept out of the group, which is hidden while
  // the auras are out: a light coming and going would recompile every lit material; the caller adds it to the scene)
  const lightAt = (list.find(a => a.tier === 4) || list[0]);
  const light = new THREE.PointLight(0xffb850, 0, 8.5, 1.4);
  const swordAt = lightAt.base.clone().addScaledVector(lightAt.dir, lightAt.len * 0.5).add(new THREE.Vector3(0, 0.25, 0));
  const fillPos = fillAt ? fillAt.clone() : swordAt.clone();
  light.position.copy(swordAt);
  group.visible = false;
  return {
    group, list, light,
    set({ time, amt, fill = 0 }) {
      group.visible = amt > 0.003;
      u.uTime.value = time; u.uAmt.value = amt; mu.uAmt.value = amt;
      for (const h of halos) h.uAmt.value = amt * 0.32;
      // (the warm light over the stall while he comes up to it; the sword's own gold once he sees it burn)
      const k = clamp01(amt * 1.6);
      light.position.copy(fillPos).lerp(swordAt, k);
      light.color.copy(_fillCol).lerp(_auraCol, k);
      light.intensity = Math.max(amt * 6 * (0.85 + 0.15 * Math.sin(time * 3.1)), fill * 5.5 * (1 - k * 0.4));
    },
  };
}
