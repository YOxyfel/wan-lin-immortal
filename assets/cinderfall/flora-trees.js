// Chinese pines (crooked trunks, plated reddish-grey bark, horizontal limbs carrying flat "cloud pads" of needles)
// and maples (delicate layered branching, palmate leaves that blaze in autumn and fall in winter).
// Single trees: createPine(opts) / createMaple(opts). Many trees merged into two meshes: createPineStand(list) /
// createMapleStand(list) (list items are opts objects with position etc.).
import * as THREE from 'three';
import { GeoBuf, sweep, card, noise3, fbm3, rng, clamp, lerp, smooth, V3, TAU, meshOf } from './flora-core.js';
import { floraMaterials } from './flora-mats.js';
import { cellRect } from './flora-tex.js';

const UP = V3(0, 1, 0);
const crooked = (r, p0, dir, len, n, jitter, bias = V3()) => {
  const pts = [p0.clone()];
  const d = dir.clone().normalize();
  let p = p0.clone();
  for (let i = 1; i <= n; i++) {
    d.add(V3((r() - 0.5) * jitter, (r() - 0.5) * jitter * 0.5, (r() - 0.5) * jitter)).add(bias).normalize();
    p = p.clone().addScaledVector(d, len / n);
    pts.push(p);
  }
  return pts;
};
const barkColor = (k = 1) => (t, a, pos, dir) => { const dl = dir.length() || 1; const ao = (0.62 + 0.38 * clamp((dir.y / dl) * 0.5 + 0.6)) * k; return [ao, ao * 0.97, ao * 0.95]; };

// ------------------------------------------------------------------ pine
function pineInto(B, F, o) {
  const r = rng(o.seed);
  const Hh = o.height;
  const s = Hh / 14;
  const base = V3(...o.position);
  const rot = o.rotationY ?? r() * TAU;
  const tf = p => p.clone().applyAxisAngle(UP, rot).add(base);
  // crooked trunk with a lean
  const lean = V3((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5).multiplyScalar(o.lean ?? 1);
  const tpts = [V3(0, -0.4, 0)];
  let p = V3(0, 0, 0);
  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    p = p.clone().add(V3((r() - 0.5) * 0.9 * s + lean.x * Hh / segs * 0.6, Hh / segs, (r() - 0.5) * 0.9 * s + lean.z * Hh / segs * 0.6));
    tpts.push(p.clone());
  }
  const rTr = (0.022 * Hh + 0.08) * (o.girth ?? 1);
  const tw = tpts.map(tf);
  const trunkCurve = new THREE.CatmullRomCurve3(tw);
  sweep(B, tw, {
    radial: Hh > 10 ? 10 : 8, segLen: 0.4,
    radius: (t) => rTr * (1 - t * 0.82) * (1 + 0.55 * Math.exp(-t * Hh / 0.6)),
    displace: (t, a, P) => 0.08 * rTr * noise3(P.x * 2.5, P.y * 0.8, P.z * 2.5),
    color: (t, a, pos, dir) => { const c = barkColor()(t, a, pos, dir); const red = smooth(0.25, 0.8, t); return [c[0] * (1 + red * 0.12), c[1] * (1 - red * 0.03), c[2] * (1 - red * 0.08)]; },
    uRep: Math.max(1, Math.round(TAU * rTr / 0.6)), vScale: 1 / 1.2,
    sway: t => Math.pow(t, 2) * 0.12 * s,
  });
  // limbs carrying flat pads
  const pads = [];
  const nB = o.limbs ?? (5 + Math.floor(r() * 3) + Math.floor(Hh / 7));
  let az = r() * TAU;
  for (let k = 0; k < nB; k++) {
    const t = lerp(o.crownStart ?? 0.45, 0.92, Math.pow((k + r() * 0.6) / nB, 0.8));
    az += 2.39996 + (r() - 0.5) * 0.6;
    const start = trunkCurve.getPointAt(t);
    const len = (0.26 + r() * 0.24) * Hh * (1 - (t - 0.45) * 0.75);
    const dir = V3(Math.cos(az), 0.05 + (r() - 0.6) * 0.25, Math.sin(az));
    const bpts = crooked(r, start, dir, len, 4, 0.55, V3(0, 0.03, 0));
    const br = rTr * (0.42 - t * 0.2);
    sweep(B, bpts, { radial: 6, segLen: 0.45, radius: tt => br * (1 - tt * 0.75), color: barkColor(0.95), uRep: 1, vScale: 1 / 1.2, sway: tt => 0.15 + tt * 0.35 });
    const end = bpts[bpts.length - 1];
    pads.push({ c: end.clone().add(V3(0, 0.15 * s, 0)), r: (1.35 + r() * 0.7) * s * (o.padScale ?? 1), sw: 0.55 });
    if (len > 3 * s && r() < 0.8) {
      const mid = bpts[2];
      const sd = V3(Math.cos(az + (r() < 0.5 ? 1 : -1) * 0.9), 0.15, Math.sin(az + (r() < 0.5 ? 1 : -1) * 0.9));
      const sp = crooked(r, mid, sd, len * 0.35, 2, 0.4);
      sweep(B, sp, { radial: 4, segLen: 0.5, radius: tt => br * 0.5 * (1 - tt * 0.7), color: barkColor(0.95), uRep: 1, vScale: 1 / 1.2, sway: tt => 0.25 + tt * 0.25 });
      pads.push({ c: sp[sp.length - 1].clone().add(V3(0, 0.1 * s, 0)), r: (1.0 + r() * 0.5) * s * (o.padScale ?? 1), sw: 0.5 });
      pads.push({ c: bpts[1].clone().lerp(bpts[2], 0.5).add(V3(0, 0.2 * s, 0)), r: (0.8 + r() * 0.4) * s * (o.padScale ?? 1), sw: 0.4 });
    }
  }
  const top = tw[tw.length - 1];
  pads.push({ c: top.clone().add(V3(0, 0.2 * s, 0)), r: (1.7 + r() * 0.6) * s * (o.padScale ?? 1), sw: 0.4 });
  pads.push({ c: trunkCurve.getPointAt(0.93).add(V3((r() - 0.5) * 2 * s, 0, (r() - 0.5) * 2 * s)), r: 1.4 * s * (o.padScale ?? 1), sw: 0.4 });
  pads.push({ c: trunkCurve.getPointAt(0.85).add(V3((r() - 0.5) * 2.4 * s, 0, (r() - 0.5) * 2.4 * s)), r: 1.2 * s * (o.padScale ?? 1), sw: 0.4 });
  // pads: a flat layer of needle tufts on top, bristling side cards on the rim, twigs inside
  const rTop = cellRect('pineTop'), rSide = cellRect('pineSide');
  for (const pd of pads) {
    const rx = pd.r * (1.15 + r() * 0.3), rz = pd.r * (0.95 + r() * 0.25), ry = pd.r * 0.32;
    const ang = r() * TAU;
    const n = Math.round(pd.r * pd.r * 9 * (o.density ?? 1)) + 6;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r());
      const lx = Math.cos(a) * d * rx, lz = Math.sin(a) * d * rz;
      const x = lx * Math.cos(ang) - lz * Math.sin(ang), z = lx * Math.sin(ang) + lz * Math.cos(ang);
      const hy = ry * (1 - d * d) * (0.3 + r() * 0.9) - ry * 0.25;
      const c = pd.c.clone().add(V3(x, hy, z));
      const size = (0.85 + r() * 0.5) * Math.min(1.6, 0.7 + pd.r * 0.3);
      const nrm = V3(x / (rx * rx), (hy + ry * 0.4) / (ry * ry) * 0.45 + 1.2, z / (rz * rz)).normalize();
      const shade = 0.6 + 0.4 * clamp((hy / ry) * 0.5 + 0.6);
      // flat-ish tuft card
      const yaw = r() * TAU, tilt = (r() - 0.5) * 0.5;
      const ax = V3(Math.cos(yaw), 0, Math.sin(yaw));
      const ay = V3(-Math.sin(yaw), 0, Math.cos(yaw)).applyAxisAngle(ax, tilt).normalize();
      card(F, c.clone().addScaledVector(ay, -size / 2), ax, ay, size, size, rTop, nrm, [shade * 0.92, shade, shade * 0.88], [pd.sw, pd.sw + 0.15], r());
    }
    const nr = Math.round(pd.r * 6 * (o.density ?? 1)) + 4;
    for (let i = 0; i < nr; i++) {
      const a = (i / nr) * TAU + r() * 0.4;
      const lx = Math.cos(a) * rx * 0.78, lz = Math.sin(a) * rz * 0.78;
      const x = lx * Math.cos(ang) - lz * Math.sin(ang), z = lx * Math.sin(ang) + lz * Math.cos(ang);
      const out = V3(x, 0, z).normalize();
      const c = pd.c.clone().add(V3(x, -ry * 0.1, z));
      const ay = out.clone().multiplyScalar(0.75).add(V3(0, 0.55 + r() * 0.3, 0)).normalize();
      const ax = V3().crossVectors(ay, UP).normalize();
      const size = (0.8 + r() * 0.4) * Math.min(1.5, 0.7 + pd.r * 0.3);
      const nrm = out.clone().multiplyScalar(0.8).add(V3(0, 0.6, 0)).normalize();
      card(F, c.clone().addScaledVector(ay, -size * 0.35), ax, ay, size * 0.8, size, rSide, nrm, [0.85, 0.9, 0.82], [pd.sw, pd.sw + 0.2], r());
    }
    for (let i = 0; i < 4; i++) {
      const a = r() * TAU, d = pd.r * (0.5 + r() * 0.4);
      sweep(B, [pd.c.clone().add(V3(0, -ry * 0.4, 0)), pd.c.clone().add(V3(Math.cos(a) * d, -ry * 0.25, Math.sin(a) * d))], { radial: 3, segments: 2, radius: tt => 0.04 * s * (1 - tt * 0.7), color: barkColor(0.8), uRep: 1, vScale: 1, sway: () => pd.sw });
    }
  }
  return { top, height: Hh, pads: pads.map(p => p.c) };
}

export function createPineStand(list, { name = 'pines' } = {}) {
  const M = floraMaterials();
  const B = new GeoBuf(), F = new GeoBuf();
  const info = list.map((o, i) => pineInto(B, F, { seed: 100 + i * 17, height: 14, position: [0, 0, 0], ...o }));
  const group = new THREE.Group(); group.name = name;
  const bark = meshOf(B.build(), M.pineBark, M.depth.pineBark, { name: name + '-bark' });
  const needles = meshOf(F.build(), M.pineNeedle, M.depth.pineNeedle, { name: name + '-needles' });
  group.add(bark, needles);
  return { group, bark, needles, info };
}
/** createPine({ seed, height (6..25 m), position, rotationY, lean, girth, padScale, density, limbs, crownStart }) */
export function createPine(opts = {}) { const s = createPineStand([opts], { name: 'pine' }); return { ...s, ...s.info[0] }; }

// ------------------------------------------------------------------ maple
function mapleInto(B, F, o) {
  const r = rng(o.seed);
  const Hh = o.height;
  const s = Hh / 8;
  const base = V3(...o.position);
  const rot = o.rotationY ?? r() * TAU;
  const tf = p => p.clone().applyAxisAngle(UP, rot).add(base);
  const twigTips = [];
  const grow = (p0, dir, len, rad, depth, swayBase) => {
    const n = depth === 0 ? 5 : 3;
    const pts = crooked(r, p0, dir, len, n, depth === 0 ? 0.25 : 0.5, V3(0, depth >= 2 ? -0.05 : 0.02, 0));
    sweep(B, pts.map(tf), {
      radial: depth === 0 ? 9 : depth === 1 ? 6 : 4, segLen: depth === 0 ? 0.3 : 0.4,
      radius: tt => rad * (1 - tt * 0.6) * (depth === 0 ? 1 + 0.4 * Math.exp(-tt * len / 0.3) : 1),
      color: barkColor(), uRep: 1, vScale: 1 / 2.4,
      displace: depth === 0 ? (t, a, P) => 0.06 * rad * noise3(P.x * 4, P.y * 2, P.z * 4) : null,
      sway: tt => swayBase + tt * (0.12 + depth * 0.12),
    });
    if (depth >= (o.depth ?? 3)) { twigTips.push({ p: pts[pts.length - 1], d: dir.clone(), sw: swayBase + 0.3 }); twigTips.push({ p: pts[pts.length - 2], d: dir.clone(), sw: swayBase + 0.2 }); return; }
    const kids = depth === 0 ? 3 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2);
    for (let k = 0; k < kids; k++) {
      const t = depth === 0 ? 0.45 + 0.55 * (k + r() * 0.5) / kids : 0.35 + 0.65 * (k + 0.5) / kids;
      const ii = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      const pp = pts[ii].clone().lerp(pts[ii + 1], r());
      const az = r() * TAU;
      const spread = depth === 0 ? 0.75 : 0.95;
      const nd = dir.clone().multiplyScalar(0.8).add(V3(Math.cos(az) * spread, depth === 0 ? 0.1 : -0.05, Math.sin(az) * spread)).normalize();
      grow(pp, nd, len * (0.55 + r() * 0.2), rad * 0.55, depth + 1, swayBase + 0.12);
    }
  };
  const stems = o.stems ?? (1 + Math.floor(r() * 3));
  const rad = (0.08 + 0.03 * Hh / 8) * (o.girth ?? 1);
  for (let k = 0; k < stems; k++) {
    const az = r() * TAU;
    const tilt = stems > 1 ? 0.25 + r() * 0.2 : 0.08;
    const dir = V3(Math.cos(az) * tilt, 1, Math.sin(az) * tilt);
    grow(V3(Math.cos(az) * 0.1, -0.2, Math.sin(az) * 0.1), dir, Hh * (0.5 + r() * 0.12), rad / Math.sqrt(stems), 0, 0);
  }
  // leaves: sprays at twig tips, layered (mostly horizontal, tips drooping a little)
  const rects = [cellRect('mapleA'), cellRect('mapleB')];
  for (const tw of twigTips) {
    const n = Math.round((5 + r() * 4) * (o.density ?? 1));
    for (let i = 0; i < n; i++) {
      const c = tf(tw.p.clone().add(V3((r() - 0.5) * 0.7 * s, (r() - 0.3) * 0.4 * s, (r() - 0.5) * 0.7 * s)));
      const yaw = r() * TAU;
      const out = V3(Math.cos(yaw), 0, Math.sin(yaw));
      const ay = out.clone().multiplyScalar(Math.cos(0.3)).add(V3(0, (r() - 0.45) * 0.7, 0)).normalize();
      const ax = V3().crossVectors(ay, UP).normalize();
      // tilt the spray plane toward horizontal
      const tilt = (r() - 0.5) * 0.8;
      ax.applyAxisAngle(ay, tilt);
      const size = (0.75 + r() * 0.35) * Math.min(1.3, s);
      const nrm = V3().subVectors(c, tf(V3(0, Hh * 0.6, 0))).normalize().multiplyScalar(0.7).add(V3(0, 0.6, 0)).normalize();
      const shade = 0.65 + 0.35 * clamp((c.y - base.y) / Hh);
      card(F, c.clone().addScaledVector(ay, -size * 0.3), ax, ay, size, size, rects[r() < 0.6 ? 0 : 1], nrm, [shade, shade * 0.97, shade * 0.95], [tw.sw, tw.sw + 0.35], r());
    }
  }
  return { top: tf(V3(0, Hh, 0)), height: Hh };
}

export function createMapleStand(list, { name = 'maples' } = {}) {
  const M = floraMaterials();
  const B = new GeoBuf(), F = new GeoBuf();
  const info = list.map((o, i) => mapleInto(B, F, { seed: 300 + i * 29, height: 8, position: [0, 0, 0], ...o }));
  const group = new THREE.Group(); group.name = name;
  const bark = meshOf(B.build(), M.mapleBark, M.depth.mapleBark, { name: name + '-bark' });
  const leaves = meshOf(F.build(), M.mapleLeaf, M.depth.mapleLeaf, { name: name + '-leaves' });
  group.add(bark, leaves);
  return { group, bark, leaves, info };
}
/** createMaple({ seed, height (4..12 m), position, rotationY, stems, girth, density, depth }) */
export function createMaple(opts = {}) { const s = createMapleStand([opts], { name: 'maple' }); return { ...s, ...s.info[0] }; }

// ------------------------------------------------------------------ broadleaf (chestnut / beech / zelkova-like)
function broadleafInto(B, F, o) {
  const r = rng(o.seed);
  const Hh = o.height, s = Hh / 16;
  const base = V3(...o.position);
  const rot = o.rotationY ?? r() * TAU;
  const tf = p => p.clone().applyAxisAngle(UP, rot).add(base);
  const lean = V3((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12).normalize();
  const tpts = crooked(r, V3(0, -0.4, 0), lean, Hh * 0.62, 5, 0.18, V3(0, 0.06, 0));
  const rTr = (0.018 * Hh + 0.08) * (o.girth ?? 1);
  sweep(B, tpts.map(tf), {
    radial: 10, segLen: 0.45, radius: t => rTr * (1 - t * 0.55) * (1 + 0.45 * Math.exp(-t * Hh / 0.7)),
    displace: (t, a, Pp) => 0.07 * rTr * noise3(Pp.x * 2, Pp.y * 0.7, Pp.z * 2), color: barkColor(), uRep: Math.max(1, Math.round(TAU * rTr / 1.2)), vScale: 1 / 2.4,
    sway: t => t * t * 0.06,
  });
  const crownC = tpts[tpts.length - 1].clone();
  const nL = o.limbs ?? (4 + Math.floor(r() * 3));
  const ends = [];
  for (let k = 0; k < nL; k++) {
    const t = 0.5 + 0.5 * (k + r() * 0.5) / nL;
    const ii = Math.min(tpts.length - 2, Math.floor(t * (tpts.length - 1)));
    const p0 = tpts[ii].clone().lerp(tpts[ii + 1], r());
    const az = k / nL * TAU + r() * 0.6;
    const dir = V3(Math.cos(az), 0.75 + r() * 0.5, Math.sin(az));
    const len = Hh * (0.3 + r() * 0.15);
    const lp = crooked(r, p0, dir, len, 4, 0.45, V3(0, -0.03, 0));
    sweep(B, lp.map(tf), { radial: 6, segLen: 0.5, radius: tt => rTr * 0.48 * (1 - tt * 0.8), color: barkColor(), uRep: 1, vScale: 1 / 2.4, sway: tt => 0.08 + tt * 0.3 });
    ends.push(lp[lp.length - 1], lp[2]);
  }
  ends.push(crownC.clone().add(V3(0, Hh * 0.18, 0)));
  const rects = [cellRect('broadA'), cellRect('broadB')];
  const cr = (o.crown ?? 1) * s;
  for (const e of ends) {
    const rad = (2.0 + r() * 1.2) * cr;
    const n = Math.round(rad * rad * 3.2 * (o.density ?? 1)) + 6;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, cz = r() * 2 - 1, sz = Math.sqrt(1 - cz * cz);
      const d = V3(Math.cos(a) * sz, cz * 0.75 + 0.2, Math.sin(a) * sz).normalize();
      const p = e.clone().add(V3(d.x * rad * (0.5 + 0.5 * Math.sqrt(r())), d.y * rad * 0.6, d.z * rad * (0.5 + 0.5 * Math.sqrt(r()))));
      const size = (1.1 + r() * 0.7) * Math.min(1.4, cr);
      const yaw = r() * TAU;
      const ay = V3(Math.cos(yaw), 0.2 + r() * 0.6, Math.sin(yaw)).lerp(V3(d.x, d.y * 0.4, d.z), 0.5).normalize();
      const ax = V3().crossVectors(ay, UP).normalize();
      if (ax.lengthSq() < 0.01) ax.set(1, 0, 0);
      const nrm = d.clone().multiplyScalar(0.75).add(V3(0, 0.55, 0)).normalize().applyAxisAngle(UP, rot);
      const shade = 0.55 + 0.45 * clamp(d.y * 0.5 + 0.55);
      card(F, tf(p).addScaledVector(ay.clone().applyAxisAngle(UP, rot), -size * 0.5), ax.clone().applyAxisAngle(UP, rot), ay.clone().applyAxisAngle(UP, rot), size, size, rects[i & 1], nrm, [shade * 0.95, shade, shade * 0.9], [0.3, 0.7], r());
    }
  }
  return { top: tf(crownC.clone().add(V3(0, Hh * 0.38, 0))), height: Hh };
}

/** createBroadleafStand(list, { name, leaf: 'gold' | 'rust' }) — list items: { seed, height (8..24 m), position, rotationY, girth, crown, density, limbs } */
export function createBroadleafStand(list, { name = 'broadleaves', leaf = 'gold' } = {}) {
  const M = floraMaterials();
  const B = new GeoBuf(), F = new GeoBuf();
  const info = list.map((o, i) => broadleafInto(B, F, { seed: 500 + i * 37, height: 16, position: [0, 0, 0], ...o }));
  const group = new THREE.Group(); group.name = name;
  const bark = meshOf(B.build(), M.ancientLimb, M.depth.limb, { name: name + '-bark' });
  const lm = leaf === 'rust' ? M.rustLeaf : M.ancientLeaf, ld = leaf === 'rust' ? M.depth.rustLeaf : M.depth.ancientLeaf;
  const leaves = meshOf(F.build(), lm, ld, { name: name + '-leaves' });
  group.add(bark, leaves);
  return { group, bark, leaves, info };
}
