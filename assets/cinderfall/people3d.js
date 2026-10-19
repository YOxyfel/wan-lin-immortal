// Villagers for Cinderfall built from the hero character system at low detail: one skinned mesh and one material per
// person (palette slots carry the colours), a shared skeleton layout, cached variant geometry, procedural poses.
// Drop-in replacement for people.js makePerson / pose / VILLAGER_COLORS:
//   const p = makePerson({ seed, scale, robe, under, pants, sash, long, grey, beard, hat: 'straw'|'helmet'|'cloth',
//                          scarf, armor, spear, banner, basketBack, ponytail, shadow, female });
//   scene.add(p.root);  pose(p, kind, t, amt)   kind: idle walk run wave sit hang hammer sweep cower kneel lie carry
//                                               (+ 'sitwave': seated with the right hand raised, amt = wave amount)
import * as THREE from 'three';
import { Rig, jointsFor, proportions, eulerQ, aimQuat, setWorldRot } from './hero-rig.js';
import { Accum, surf, toGeometry, makeWeighter, srgb, VEC } from './hero-geo.js';
import { styleFor, tunicShape, buildTunic, buildCollar, buildSleeves, buildSash, buildTrousers, buildWrapsShoes, buildHead, buildEars, buildArmsHands, HERO_HEAD, headFrame } from './hero-body.js';
import { heroTextures } from './hero-tex.js';
import { villagerMaterial } from './hero-mat.js';
import { PoseKit } from './hero-pose.js';
import { SKULL, hairlineY, skullPoint } from './hero-hair.js';
import { rng, clamp, lerp, smooth, TAU, DEG } from './hero-util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const { sub, add, mul, norm, cross, madd, len } = VEC;

// same palette presets as people.js (world.js imports VILLAGER_COLORS next to makePerson)
export const VILLAGER_COLORS = [
  { robe: [0.22, 0.28, 0.45], sash: [0.55, 0.16, 0.12] },
  { robe: [0.62, 0.55, 0.42], sash: [0.25, 0.3, 0.42] },
  { robe: [0.5, 0.2, 0.16], sash: [0.85, 0.7, 0.35] },
  { robe: [0.3, 0.42, 0.36], sash: [0.6, 0.5, 0.3] },
  { robe: [0.42, 0.34, 0.26], sash: [0.2, 0.2, 0.25] },
  { robe: [0.75, 0.68, 0.55], sash: [0.4, 0.2, 0.18] },
];

// ------------------------------------------------------------------ shared template (rig layout, weights)
let TPL = null;
function template() {
  if (TPL) return TPL;
  const P = proportions(0);
  const J = jointsFor(P);
  const rig = new Rig(J, J);
  TPL = { P, J, rig, W: makeWeighter(rig), HF: headFrame(P), heads: new Map(), variants: new Map() };
  return TPL;
}
const WHITE = [1, 1, 1];
function villagerStyle(long, female) {
  const S = styleFor(0);
  return Object.assign(S, {
    hemY: long ? 0.17 : 0.55, slitY: long ? 0.36 : 0.8, tW: female ? 1.0 : 1.06, tD: female ? 1.02 : 1.05, flare: long ? 1.25 : 1.08,
    vY: 1.3, linen: WHITE, collar: [1.3, 1.3, 1.3], sash: WHITE, pants: WHITE, wraps: WHITE, shoe: WHITE, sole: [1.9, 1.9, 1.9], leather: WHITE, skin: WHITE,
  });
}
const FACES = {
  m: Object.assign({}, HERO_HEAD, { faceW: 0.98, jawW: 1.02, chinW: 1.0, noseL: 1.02, hollow: 0.2 }),
  f: Object.assign({}, HERO_HEAD, { faceW: 0.93, jawW: 0.86, chinW: 0.84, noseL: 0.94, cheek: 1.1, brow: 0.75, lip: 1.05, hollow: 0 }),
  o: Object.assign({}, HERO_HEAD, { faceW: 0.95, jawW: 0.98, cheek: 1.4, brow: 1.3, noseL: 1.07, hollow: 1.3, fill: 0, lip: 0.75 }),
};

// slot ids (aCloth.x): see villagerMaterial
const SLOT = { robe: 0, sash: 1, pants: 2, wraps: 3, shoes: 4, leather: 5, under: 6, hair: 7, straw: 8, metal: 9, wood: 10, banner: 11, scarf: 12, beard: 13, skin: 14 };
const slotExtra = (slot, seed = 0.3) => () => ({ aCloth: [slot, 0, 9, seed] });

// ------------------------------------------------------------------ variant geometry
function variantKey(v) { return JSON.stringify(v); }
function buildVariant(v) {
  const T = template();
  const key = variantKey(v);
  if (T.variants.has(key)) return T.variants.get(key);
  const { P, J, W, rig } = T;
  const I = rig.idx;
  const S = villagerStyle(v.long, v.female);
  const ctx = { age: 0, P, J, S, W, rig, sashBoneBase: rig.N, lod: 0.5, mitten: true, noSashEnds: true, longSleeves: true, headA: FACES[v.face] };
  // skin parts (head, ears, forearms, mitten hands) are cached per face
  let skin = T.heads.get(v.face);
  if (!skin) {
    skin = new Accum({ aFace: 4 });
    const HF = buildHead(skin, ctx, FACES[v.face]);
    buildEars(skin, Object.assign({}, ctx, { lod: 0.5 }), HF, FACES[v.face]);
    buildArmsHands(skin, ctx);
    T.heads.set(v.face, skin);
  }
  const cl = new Accum({ aCloth: 4 });
  const Tn = buildTunic(cl, ctx);
  buildCollar(cl, Object.assign({}, ctx, { lod: 0.5 }), Tn);
  buildSleeves(cl, ctx);
  buildSash(cl, ctx, Tn);
  buildTrousers(cl, ctx);
  buildWrapsShoes(cl, ctx);
  const HF = T.HF;
  const hs = (x, y, z) => [HF.O[0] + x * HF.s, HF.O[1] + y * HF.s, HF.O[2] + z * HF.s];
  const rigid = bone => () => [[I[bone], 1]];
  // ---- hair: cap + style
  if (v.hat !== 'helmet') {
    surf(cl, {
      nu: 20, nv: 8, wrapU: true,
      f: (u, w) => {
        const th = -180 + 360 * (((u % 1) + 1) % 1);
        const yh = hairlineY(th) - 0.004, top = SKULL.c[1] + SKULL.r[1] - 1e-4;
        const y = lerp(yh, top, 1 - Math.pow(1 - clamp(w, 0, 1), 1.3));
        const off = (v.female ? 0.011 : 0.008) * smooth(yh, yh + 0.016, y) - 0.002;
        const p = skullPoint(th, y, off);
        return hs(p[0], p[1], p[2]);
      },
      out: () => hs(0, 0.02, -0.01), color: () => WHITE, weights: rigid('head'), uv: (u, w) => [u * 3, 1 - w], extra: slotExtra(SLOT.hair, 0.2),
    });
    const blob = (c, r, n = 10, m = 7, slot = SLOT.hair, bone = 'head', tw = 0) => surf(cl, {
      nu: n, nv: m, wrapU: true,
      f: (u, w) => { const a = u * TAU, b = Math.PI * clamp(w, 0, 1); const wob = 1 + 0.08 * Math.sin(a * 3 + b * 2 + tw); return hs(c[0] + r[0] * Math.sin(b) * Math.cos(a) * wob, c[1] + r[1] * Math.cos(b), c[2] + r[2] * Math.sin(b) * Math.sin(a) * wob); },
      out: () => hs(...c), color: () => WHITE, weights: rigid(bone), uv: (u, w) => [u * 2, w], extra: slotExtra(slot, 0.4),
    });
    if (v.female) blob([0, 0.012, -0.112], [0.044, 0.036, 0.032], 12, 8);
    else if (!v.hat) blob([0, 0.114, -0.018], [0.026, 0.022, 0.026], 9, 6);
    if (v.female && !v.hat) blob([0.03, 0.03, -0.11], [0.004, 0.004, 0.05], 5, 3, SLOT.wood, 'head', 1);
    if (v.ponytail) {
      surf(cl, {
        nu: 7, nv: 8, wrapU: true,
        f: (u, w) => { const t = clamp(w, 0, 1), a = u * TAU, r = lerp(0.026, 0.008, t); const c = [0, lerp(0.07, -0.33, t), lerp(-0.09, -0.15, Math.sqrt(t))]; return hs(c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)); },
        out: (u, w) => hs(0, lerp(0.07, -0.33, w), lerp(-0.09, -0.15, Math.sqrt(w))), color: () => WHITE, weights: rigid('head'), uv: (u, w) => [u, w], extra: slotExtra(SLOT.hair, 0.6),
      });
      blob([0, 0.075, -0.09], [0.02, 0.016, 0.02], 7, 5);
    }
  }
  // ---- beard + moustache
  if (v.beard) {
    surf(cl, {
      nu: 12, nv: 6,
      f: (u, w) => {
        const t = u * 2 - 1, at = Math.abs(t);
        const root = [0.049 * Math.sin(t * Math.PI / 2 * 0.92), lerp(-0.088, -0.045, Math.pow(at, 1.5)), lerp(0.074, 0.012, Math.pow(at, 1.2))];
        const L = lerp(0.075, 0.02, Math.pow(at, 0.8));
        const s = clamp(w, 0, 1) * 2;
        const down = norm([root[0] * 0.3, -1, 0.35 - at * 0.2]);
        const outv = norm([root[0], 0.0, root[2] + 0.02]);
        const k = s < 1 ? s : 2 - s;
        const bulge = s < 1 ? 0.011 * Math.sin(Math.PI * s) : -0.003;
        return hs(root[0] + down[0] * L * k + outv[0] * bulge, root[1] + down[1] * L * k * (1 - 0.15 * k), root[2] + down[2] * L * k + outv[2] * bulge);
      },
      flip: false, color: () => WHITE, weights: rigid('head'), uv: (u, w) => [u * 2, w], extra: slotExtra(SLOT.beard, 0.7),
    });
    for (const sd of [1, -1]) surf(cl, {
      nu: 4, nv: 5,
      f: (u, w) => { const t = clamp(w, 0, 1); const x = sd * lerp(0.003, 0.025, t), y = -0.04 - 0.02 * t * t, z = lerp(0.098, 0.083, t); const th = (u - 0.5) * 0.007 * (1 - t * 0.6); return hs(x, y + th, z + 0.004); },
      flip: false, color: () => WHITE, weights: rigid('head'), uv: (u, w) => [u, w], extra: slotExtra(SLOT.beard, 0.8),
    });
  }
  // ---- hats
  if (v.hat === 'straw') {
    surf(cl, {
      nu: 22, nv: 5, wrapU: true,
      f: (u, w) => { const a = u * TAU, r = clamp(w, 0, 1); const R = 0.265 * r; return hs(Math.sin(a) * R, 0.205 - 0.125 * r - 0.018 * Math.pow(r, 5), Math.cos(a) * R - 0.006); },
      out: () => hs(0, 0, 0), color: (p, u, w) => [1 - 0.15 * w, 1 - 0.15 * w, 1 - 0.15 * w], weights: rigid('head'), uv: (u, w) => [u * 3, w], extra: slotExtra(SLOT.straw, 0.1),
    });
  } else if (v.hat === 'helmet') {
    const prof = [[0.0, 0.205], [0.018, 0.19], [0.05, 0.172], [0.08, 0.145], [0.098, 0.11], [0.104, 0.07], [0.106, 0.04], [0.124, 0.026]];
    surf(cl, {
      nu: 18, nv: prof.length - 1, wrapU: true,
      f: (u, w) => { const a = u * TAU, t = clamp(w, 0, 1) * (prof.length - 1); const i = Math.min(prof.length - 2, Math.floor(t)), f = t - i; const r = lerp(prof[i][0], prof[i + 1][0], f), y = lerp(prof[i][1], prof[i + 1][1], f); return hs(Math.sin(a) * r, y, Math.cos(a) * r - 0.01); },
      out: () => hs(0, 0.05, -0.01), color: () => WHITE, weights: rigid('head'), uv: (u, w) => [u * 1.5, w * 0.4], extra: slotExtra(SLOT.metal, 0.2),
    });
    // neck guard of plates around the back and sides
    surf(cl, {
      nu: 14, nv: 3,
      f: (u, w) => { const a = lerp(0.35 * Math.PI, 1.65 * Math.PI, u), t = clamp(w, 0, 1); const r = lerp(0.108, 0.128, t); return hs(Math.sin(a) * r, lerp(0.045, -0.06, t), Math.cos(a) * r - 0.012); },
      flip: false, color: () => WHITE, weights: rigid('head'), uv: (u, w) => [u, w * 0.25], extra: slotExtra(SLOT.metal, 0.3),
    });
  } else if (v.hat === 'cloth') {
    surf(cl, {
      nu: 18, nv: 7, wrapU: true,
      f: (u, w) => {
        const th = -180 + 360 * (((u % 1) + 1) % 1);
        const yh = Math.max(hairlineY(th), -0.03) - 0.006, top = SKULL.c[1] + SKULL.r[1];
        const y = lerp(yh, top, 1 - Math.pow(1 - clamp(w, 0, 1), 1.4));
        const p = skullPoint(th, y, 0.017 + 0.004 * Math.sin(th * DEG * 5));
        return hs(p[0], p[1], p[2]);
      },
      out: () => hs(0, 0.02, -0.01), color: () => WHITE, weights: rigid('head'), uv: (u, w) => [u * 4, w], extra: slotExtra(SLOT.scarf, 0.5),
    });
    const knot = [0, -0.005, -0.112];
    surf(cl, { nu: 8, nv: 5, wrapU: true, f: (u, w) => { const a = u * TAU, b = Math.PI * clamp(w, 0, 1); return hs(knot[0] + 0.022 * Math.sin(b) * Math.cos(a), knot[1] + 0.018 * Math.cos(b), knot[2] + 0.016 * Math.sin(b) * Math.sin(a)); }, out: () => hs(...knot), color: () => WHITE, weights: rigid('head'), extra: slotExtra(SLOT.scarf, 0.6) });
    for (const sd of [1, -1]) surf(cl, { nu: 3, nv: 4, f: (u, w) => { const t = clamp(w, 0, 1); return hs(sd * (0.008 + 0.02 * t) + (u - 0.5) * 0.03, -0.01 - 0.11 * t, -0.118 - 0.02 * t); }, flip: false, color: () => WHITE, weights: rigid('head'), extra: slotExtra(SLOT.scarf, 0.7) });
  }
  // ---- lamellar armour vest with tassets and shoulder guards
  if (v.armor) {
    const wv = (p) => W.torso(p);
    surf(cl, {
      nu: 26, nv: 8, wrapU: true,
      f: (u, w) => { const ph = TAU * u + Math.PI; const y = lerp(0.9, 1.39, clamp(w, -0.05, 1.05)); const q = Tn.point(ph, y, false); const c = [0, y, -0.01]; const o = norm([q[0], 0, q[2] + 0.01]); const ex = 0.016 + 0.012 * smooth(1.13, 1.0, y) * smooth(0.95, 1.0, y) + 0.008 * smooth(1.2, 1.36, y); return [q[0] + o[0] * ex, y, q[2] + o[2] * ex]; },
      out: (u, w) => [0, lerp(0.9, 1.39, w), -0.01], color: () => WHITE, weights: wv, uv: (u, w) => [u, w * 0.5], extra: slotExtra(SLOT.metal, 0.1),
    });
    for (const back of [0, 1]) surf(cl, {
      nu: 10, nv: 3,
      f: (u, w) => { const ph = back ? lerp(0.62 * Math.PI, 1.38 * Math.PI, u) : lerp(-0.38 * Math.PI, 0.38 * Math.PI, u); const y = lerp(0.92, 0.72, clamp(w, 0, 1)); const q = Tn.point(ph, y, false); const o = norm([q[0], 0, q[2] + 0.01]); return [q[0] + o[0] * 0.02, y, q[2] + o[2] * 0.02]; },
      flip: false, color: () => WHITE, weights: p => W.skirt(p, 0.6), uv: (u, w) => [u * 0.4, w * 0.2], extra: slotExtra(SLOT.metal, 0.15),
    });
    for (const s of ['L', 'R']) {
      const m = s === 'L' ? 1 : -1;
      const c = [J.J['upperArm' + s].x, J.J['upperArm' + s].y, J.J['upperArm' + s].z];
      surf(cl, {
        nu: 8, nv: 4,
        f: (u, w) => { const a = lerp(-0.9, 0.9, u), b = lerp(0.15, 1.25, clamp(w, 0, 1)); const r = 0.085; return [c[0] + m * Math.sin(b) * r * 1.05, c[1] + Math.cos(b) * r + 0.01, c[2] + Math.sin(a) * r * 0.95 * Math.sin(b) + 0.0]; },
        flip: false, color: () => WHITE, weights: p => W.arm(p, s), uv: (u, w) => [u * 0.3, w * 0.25], extra: slotExtra(SLOT.metal, 0.25),
      });
    }
  }
  // ---- spear (+ banner) in the right hand, along the grip axis
  if (v.spear) {
    const s = 'R', m = -1;
    const ca = Math.cos(35 * DEG), sa = Math.sin(35 * DEG);
    const a = [m * sa, -ca, 0], n = [-m * ca, -sa, 0], f = [0, 0, 1];
    const wr = [J.J.handR.x, J.J.handR.y, J.J.handR.z];
    const G = madd(madd(wr, a, 0.058), n, 0.02);
    const shaft = (t0, t1, r0, r1, slot, nu = 6) => surf(cl, {
      nu, nv: 2, wrapU: true,
      f: (u, w) => { const t = lerp(t0, t1, clamp(w, 0, 1)), r = lerp(r0, r1, clamp(w, 0, 1)), ang = u * TAU; return add(madd(madd(G, f, t), a, Math.cos(ang) * r), mul(n, Math.sin(ang) * r)); },
      out: (u, w) => madd(G, f, lerp(t0, t1, w)), color: () => WHITE, weights: rigid('handR'), uv: (u, w) => [u, w * (t1 - t0) * 4], extra: slotExtra(slot, 0.9),
    });
    shaft(-0.75, 1.5, 0.015, 0.013, SLOT.wood);
    shaft(1.5, 1.53, 0.019, 0.019, SLOT.metal);
    // blade: flat leaf
    surf(cl, {
      nu: 2, nv: 5,
      f: (u, w) => { const t = clamp(w, 0, 1); const wd = 0.034 * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - t * 0.2); return add(madd(G, f, 1.53 + t * 0.24), mul(a, (u - 0.5) * 2 * wd)); },
      flip: false, color: () => WHITE, weights: rigid('handR'), uv: (u, w) => [u * 0.1, w * 0.1], extra: slotExtra(SLOT.metal, 0.95),
    });
    // red tassel
    surf(cl, { nu: 6, nv: 2, wrapU: true, f: (u, w) => { const t = clamp(w, 0, 1), ang = u * TAU, r = lerp(0.02, 0.045, t); return add(madd(madd(G, f, 1.5 - t * 0.12), a, Math.cos(ang) * r), mul(n, Math.sin(ang) * r)); }, out: (u, w) => madd(G, f, 1.5 - w * 0.12), color: () => WHITE, weights: rigid('handR'), extra: slotExtra(SLOT.banner, 0.5) });
    if (v.banner) {
      const side = mul(n, -1);
      surf(cl, {
        nu: 4, nv: 6,
        f: (u, w) => { const x = u * 0.42, t = clamp(w, 0, 1); return add(madd(G, f, 1.42 - t * 0.78), mul(side, x + 0.015 * Math.sin(t * 6 + u * 2))); },
        flip: false, color: () => WHITE, weights: rigid('handR'), uv: (u, w) => [u * 0.5, w * 0.8], extra: slotExtra(SLOT.banner, 0.2),
      });
    }
  }
  // ---- basket on the back
  if (v.basketBack) {
    surf(cl, {
      nu: 12, nv: 5, wrapU: true,
      f: (u, w) => { const a = u * TAU, t = clamp(w, 0, 1); const r = lerp(0.12, 0.17, t) * (t > 0.96 ? 0.97 : 1); return [Math.sin(a) * r, lerp(1.0, 1.42, t), -0.25 + Math.cos(a) * r * 0.8]; },
      out: (u, w) => [0, lerp(1.0, 1.42, w), -0.25], color: (p, u, w) => [1 - 0.2 * (1 - w), 1 - 0.2 * (1 - w), 1 - 0.2 * (1 - w)], weights: rigid('chest'), uv: (u, w) => [u * 2, w * 0.6], extra: slotExtra(SLOT.straw, 0.3),
    });
  }
  // ---- merge skin (+ slot) and clothing into one skinned geometry
  const G = mergeAccums(skin, cl);
  T.variants.set(key, G);
  return G;
}

function mergeAccums(skin, cl) {
  const n = skin.count + cl.count;
  const g = new THREE.BufferGeometry();
  const cat = (a, b) => { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
  g.setAttribute('position', new THREE.BufferAttribute(cat(skin.pos, cl.pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(cat(skin.nrm, cl.nrm), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(cat(skin.uv, cl.uv), 2));
  g.setAttribute('color', new THREE.BufferAttribute(cat(skin.col, cl.col), 3));
  const si = new Uint16Array(n * 4); si.set(skin.si); si.set(cl.si, skin.count * 4);
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(cat(skin.sw, cl.sw), 4));
  const ac = new Float32Array(n * 4);
  for (let i = 0; i < skin.count; i++) ac.set([SLOT.skin, 0, 9, 0], i * 4);
  ac.set(cl.extra.aCloth.data, skin.count * 4);
  g.setAttribute('aCloth', new THREE.BufferAttribute(ac, 4));
  const af = new Float32Array(n * 4); af.set(skin.extra.aFace.data);
  g.setAttribute('aFace', new THREE.BufferAttribute(af, 4));
  const idx = new Uint32Array(skin.idx.length + cl.idx.length); idx.set(skin.idx);
  for (let i = 0; i < cl.idx.length; i++) idx[skin.idx.length + i] = cl.idx[i] + skin.count;
  g.setIndex(new THREE.BufferAttribute(n > 65535 ? idx : Uint16Array.from(idx), 1));
  return g;
}

// ------------------------------------------------------------------ palette
// the old people.js colours were linear vertex colours; deepen them a little so robes read rich under ACES
const linC = a => new THREE.Color(Math.pow(a[0], 1.3), Math.pow(a[1], 1.3), Math.pow(a[2], 1.3));
const sC = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
function palette(opts, R, v) {
  const skinTones = [[0.88, 0.72, 0.6], [0.84, 0.66, 0.52], [0.78, 0.6, 0.47], [0.9, 0.76, 0.65], [0.72, 0.53, 0.4]];
  const st = skinTones[Math.floor(R() * skinTones.length)];
  const hairDark = [[0.07, 0.06, 0.055], [0.1, 0.08, 0.06], [0.05, 0.05, 0.05], [0.13, 0.1, 0.07]][Math.floor(R() * 4)];
  const hair = opts.grey ? [0.52 + R() * 0.15, 0.5 + R() * 0.15, 0.48 + R() * 0.15] : hairDark;
  const scarfs = [[0.75, 0.3, 0.25], [0.3, 0.42, 0.6], [0.85, 0.82, 0.75], [0.6, 0.2, 0.2], [0.35, 0.5, 0.4]];
  const P = new Array(15);
  P[SLOT.robe] = linC(opts.robe || [0.25, 0.3, 0.45]);
  P[SLOT.sash] = linC(opts.sash || [0.55, 0.15, 0.12]);
  P[SLOT.pants] = linC(opts.pants || [0.28, 0.25, 0.22]);
  P[SLOT.wraps] = sC(0.66, 0.62, 0.55);
  P[SLOT.shoes] = sC(0.13, 0.12, 0.12);
  P[SLOT.leather] = sC(0.24, 0.17, 0.12);
  P[SLOT.under] = linC(opts.under || [0.85, 0.8, 0.7]);
  P[SLOT.hair] = sC(...hair);
  P[SLOT.straw] = sC(0.74, 0.62, 0.38);
  P[SLOT.metal] = sC(0.36, 0.34, 0.32);
  P[SLOT.wood] = sC(0.38, 0.27, 0.17);
  P[SLOT.banner] = sC(0.72, 0.1, 0.07);
  P[SLOT.scarf] = linC(opts.scarf || scarfs[Math.floor(R() * scarfs.length)]);
  P[SLOT.beard] = opts.grey ? sC(0.62, 0.6, 0.57) : sC(...hair);
  P[SLOT.skin] = sC(...st);
  return P;
}

// ------------------------------------------------------------------ person
export function makePerson(opts = {}) {
  const T = template();
  const seed = opts.seed || 1;
  const R = rng(seed * 7919 + 13);
  const long = !!opts.long;
  const female = opts.female !== undefined ? !!opts.female : (long && !opts.beard && !opts.armor && !opts.grey && seed % 5 !== 0);
  const face = female ? 'f' : (opts.grey || opts.beard) ? 'o' : 'm';
  const v = { long, female, face, hat: opts.hat || null, beard: !!opts.beard, armor: !!opts.armor, spear: !!opts.spear, banner: !!opts.banner, basketBack: !!opts.basketBack, ponytail: !!opts.ponytail };
  const geo = buildVariant(v);
  const rig = new Rig(T.J, T.J);
  const skeleton = new THREE.Skeleton(rig.bones, rig.bones.map(() => new THREE.Matrix4()));
  rig.skeleton = skeleton;
  rig.updateInverses();
  const U = { uPal: { value: palette(opts, R, v) }, uFade: { value: 1 }, uKid: { value: 0 } };
  const mat = villagerMaterial(heroTextures(), U);
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.customDepthMaterial = mat.cf.depth; mesh.customDistanceMaterial = mat.cf.dist;
  mesh.castShadow = !!opts.shadow; mesh.receiveShadow = true;
  const root = new THREE.Group();
  root.name = 'villager';
  root.add(rig.bones[0], mesh);
  mesh.bind(skeleton, new THREE.Matrix4());
  mesh.boundingSphere = new THREE.Sphere(V(0, 0.9, 0), 2.6);
  const scale = (opts.scale || 1) * (female ? 0.95 : 1) * (0.97 + R() * 0.06);
  root.scale.setScalar(scale);
  const kid = (opts.scale || 1) < 0.8;
  const K = new PoseKit(rig);
  const P = rig.newPose();
  const p = {
    root, seed: R() * 100, mesh, person: null,
    _: { rig, K, P, U, kid, female, spear: v.spear, basket: v.basketBack, contacts: contactList(rig, T.J) },
    setFade(k) { U.uFade.value = clamp(k); root.visible = k > 0.002; },
    dispose() { root.removeFromParent(); mat.dispose(); mat.cf.depth.dispose(); mat.cf.dist.dispose(); skeleton.dispose(); },
  };
  // legacy handles (the old rigs exposed groups; these are the matching bones)
  const b = n => rig.bones[rig.idx[n]];
  Object.assign(p, { hips: b('hips'), spine: b('chest'), neck: b('neck'), head: b('head'), prop: null,
    legs: [{ thigh: b('thighR'), knee: b('shinR') }, { thigh: b('thighL'), knee: b('shinL') }],
    arms: [{ shoulder: b('upperArmR'), elbow: b('foreArmR') }, { shoulder: b('upperArmL'), elbow: b('foreArmL') }] });
  p.person = p;
  pose(p, 'idle', 0, 1);
  return p;
}

function contactList(rig, J) {
  const I = rig.idx, c = [];
  const at = (bone, x, y, z) => c.push({ i: I[bone], p: V(x, y, z) });
  for (const s of ['L', 'R']) {
    const fx = J.J['foot' + s].x;
    at('foot' + s, fx, 0.002, -0.075); at('toe' + s, fx, 0.002, J.J['toe' + s].z); at('toe' + s, fx, 0.004, 0.2);
    at('foot' + s, fx, 0.07, 0.04); at('toe' + s, fx, 0.036, 0.17);
    at('shin' + s, J.J['shin' + s].x, J.J['shin' + s].y - 0.02, 0.07); at('shin' + s, J.J['shin' + s].x, 0.28, 0.05);
    at('hand' + s, J.J['hand' + s].x, J.J['hand' + s].y - 0.05, 0.0);
    at('upperArm' + s, J.J['upperArm' + s].x, J.J['upperArm' + s].y, -0.08);
  }
  at('hips', 0.07, 0.84, -0.12); at('hips', -0.07, 0.84, -0.12); at('chest', 0, 1.27, -0.12); at('head', 0, 1.6, -0.105);
  return c;
}

// ------------------------------------------------------------------ poses (FK, cheap)
const _cp = V();
export function pose(p, kind, t, amt = 1) {
  const S = p._ || (p.person && p.person._);
  if (!S) return;
  const { rig, K, P } = S;
  const I = rig.idx;
  const ph = t + p.seed;
  K.base(P);
  const br = Math.sin(ph * 1.6);
  let lean = 0, grounded = true;
  P.rp.set(0, rig.bindPos[0].y, 0);
  const arms = (fl, ab, el, flR = fl, abR = ab, elR = el, prL = 8, prR = 8) => { K.armFK(P, 'L', fl, ab, 0, el, 6, 0, prL); K.armFK(P, 'R', flR, abR, 0, elR, 6, 0, prR); };
  const legs = (tl, kl, tr, kr, al = 0, ar = 0) => {
    K.e(P, 'thighL', -tl, 0, 1.5).e(P, 'shinL', kl, 0, 0).e(P, 'footL', -al, 0, 0);
    K.e(P, 'thighR', -tr, 0, -1.5).e(P, 'shinR', kr, 0, 0).e(P, 'footR', -ar, 0, 0);
  };
  K.e(P, 'spine', 1 + br * 0.5, 0, 0).e(P, 'chest', -1 - br, 0, 0);
  arms(6 + br * 0.5, 9, 14);
  legs(0, 1, 0, 1);
  if (kind === 'walk' || kind === 'run' || kind === 'carry') {
    const run = kind === 'run';
    const w = ph * (run ? 9.5 : 5.4), A = run ? 40 : 24;
    const sL = Math.sin(w), cL = Math.cos(w);
    const kneeL = Math.max(0, -cL) * A * (run ? 2.0 : 1.5) + 4, kneeR = Math.max(0, cL) * A * (run ? 2.0 : 1.5) + 4;
    legs(sL * A, kneeL, -sL * A, kneeR, sL * A * 0.5 - kneeL * 0.6, -sL * A * 0.5 - kneeR * 0.6);
    lean = run ? 14 : 3;
    eulerQ(P.q[0], lean * 0.5, -sL * (run ? 9 : 6), 0);
    K.e(P, 'spine', lean * 0.3, sL * (run ? 5 : 3), 0).e(P, 'chest', lean * 0.2, sL * 3, 0).e(P, 'neck', -lean * 0.5, 0, 0);
    if (kind === 'carry') arms(55, 14, 75, 55, 14, 75, 40, 40);
    else arms(-sL * A * 0.75 + 4, 10, run ? 85 : 16, sL * A * 0.75 + 4, 10, run ? 85 : 16);
  } else if (kind === 'wave') {
    const osc = Math.sin(ph * 9) * amt;
    K.armFK(P, 'R', 20 * amt, 10 + 145 * amt, 0, 30 * amt + 18 * osc, 0, 0, 30 * amt);
    K.e(P, 'neck', -3, -5, 0);
  } else if (kind === 'give') {
    // holding something out in the right hand, palm up, leaning a little to it (amt 0..1)
    K.armFK(P, 'R', lerp(6, 58, amt), lerp(9, 16, amt), 0, lerp(14, 34, amt), lerp(0, -12, amt), 0, lerp(8, -75, amt));
    K.e(P, 'spine', 5 * amt, 0, 0).e(P, 'chest', 3 * amt, 0, 0).e(P, 'neck', 4 * amt, 0, 0);
  } else if (kind === 'laugh') {
    // a hand on her hip, her head back a little, shaking with it (amt 0..1)
    const sh = Math.sin(ph * 13) * amt;
    K.armFK(P, 'L', 20 * amt, 38 * amt, 0, 95 * amt, 0, 0, 40 * amt);
    K.e(P, 'chest', -4 * amt + sh * 1.2, 0, 0).e(P, 'neck', -10 * amt + sh * 2, 0, 0);
  } else if (kind === 'sit' || kind === 'sitwave') {
    P.rp.y = 0.52;
    legs(88, 86, 86, 90, -4, -2);
    K.e(P, 'spine', 10, 0, 0).e(P, 'chest', 6 + br, 0, 0).e(P, 'neck', 10, Math.sin(ph * 0.4) * 15, 0);
    arms(38, 14, 55, 38, 14, 55, 30, 30);
    if (kind === 'sitwave' && amt > 0) {
      // seated, the right hand raised in greeting (amt 0..1)
      const osc = Math.sin(ph * 8) * amt;
      K.armFK(P, 'R', lerp(38, 22, amt), lerp(14, 150, amt), 0, lerp(55, 32, amt) + 16 * osc, 0, 0, lerp(30, 32, amt));
      K.e(P, 'neck', -10 * amt, 0, 0);
    }
    grounded = false;
  } else if (kind === 'hang') {
    const s2 = Math.sin(ph * 1.3) * 8;
    arms(150 + s2, 20, 20, 150 - s2, 20, 20, 60, 60);
    K.e(P, 'neck', -14, 0, 0).e(P, 'chest', -6, 0, 0);
  } else if (kind === 'hammer') {
    const c = (ph * 1.4) % 1, up = c < 0.6 ? c / 0.6 : 1 - (c - 0.6) / 0.4;
    K.armFK(P, 'R', 35 + up * 120, 12, 0, 90 - up * 40, 10, 0, 20);
    K.armFK(P, 'L', 45, 10, 0, 70, 6, 0, 40);
    K.e(P, 'spine', 14 - up * 5, 0, 0).e(P, 'chest', 6, -6, 0).e(P, 'neck', 10, 0, 0);
    legs(6, 10, -4, 6);
  } else if (kind === 'sweep') {
    const s2 = Math.sin(ph * 2.2);
    K.armFK(P, 'L', 45 + s2 * 15, 8, 0, 35, 6, 0, 30); K.armFK(P, 'R', 30 + s2 * 15, 8, 0, 25, 6, 0, 30);
    K.e(P, 'spine', 16, s2 * 12, 0).e(P, 'chest', 8, s2 * 6, 0).e(P, 'neck', 10, 0, 0);
    legs(8, 14, 2, 10);
  } else if (kind === 'cower') {
    legs(105, 125, 100, 128, -30, -30);
    eulerQ(P.q[0], 30, 0, Math.sin(ph * 14) * 0.6);
    K.e(P, 'spine', 22, 0, 0).e(P, 'chest', 18, 0, 0).e(P, 'neck', 18, 0, 0);
    arms(150, 30, 120, 150, 30, 120, 40, 40);
  } else if (kind === 'kneel') {
    legs(-5, 95, -5, 95, 45, 45);
    K.e(P, 'spine', 20 + br, 0, 0).e(P, 'chest', 10, 0, 0).e(P, 'neck', 20, 0, 0);
    arms(40, 10, 30, 40, 10, 30, 30, 30);
  } else if (kind === 'lie') {
    eulerQ(P.q[0], -88, 0, 8);
    K.e(P, 'neck', 6 + Math.sin(ph * 0.8) * 2, 25, 0).e(P, 'chest', br * 0.8, 0, 0);
    K.armFK(P, 'R', 160, 20, 0, 12, 0, 0, 0); K.armFK(P, 'L', 6, 30, 0, 20, 0, 0, 0);
    legs(10, 20, 2, 4, -30, -30);
  } else {
    K.e(P, 'neck', 0, Math.sin(ph * 0.4) * 17, 0).e(P, 'head', 0, Math.sin(ph * 0.4) * 8, 0);
    eulerQ(P.q[0], 0, Math.sin(ph * 0.31) * 2, Math.sin(ph * 0.27) * 1.2);
  }
  // soldiers keep the spear upright in the right fist; basket carriers hold the straps
  if (S.spear && kind !== 'lie' && kind !== 'cower' && kind !== 'wave' && kind !== 'hang') {
    const sw = kind === 'walk' ? Math.sin(ph * 5.4) * 6 : kind === 'run' ? Math.sin(ph * 9.5) * 10 : 0;
    K.armFK(P, 'R', 14 + sw, 12, -6, 86, 0, 0, 0);
    // fist grip axis exactly vertical, knuckles forward along the body heading
    rig.fk(P);
    const hq = rig.wq[0];
    _fw.set(0, 0, 1).applyQuaternion(hq); _fw.y = 0; _fw.normalize();
    aimQuat(_kq, K.side.R.f, K.side.R.a, _up.set(0, 1, 0), _fw);
    setWorldRot(rig, P, I.handR, _kq);
  }
  if (S.basket && (kind === 'idle' || kind === 'walk')) K.armFK(P, 'L', 28, 16, 0, 110, 10, 0, 60);
  for (const s of ['L', 'R']) K.fingers(P, s, 'relaxed');
  if (S.kid) P.q[I.head].multiply(_kq.setFromAxisAngle(_ax.set(1, 0, 0), 0.0));
  // ground contact: lowest contact point on y = 0 (sitting keeps the feet down; the bench is implied)
  rig.fk(P);
  let mn = 1e9;
  for (const c of S.contacts) { rig.pointOn(c.i, c.p, _cp); if (_cp.y < mn) mn = _cp.y; }
  P.rp.y -= mn;
  rig.apply(P);
  if (S.kid) rig.bones[I.head].scale.setScalar(1.16);
}
const _kq = new THREE.Quaternion(), _ax = V(), _fw = V(), _up = V();
