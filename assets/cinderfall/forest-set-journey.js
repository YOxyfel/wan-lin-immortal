// World B, the journey (round 4): the stretches of the way between the hunt trail and the dell, each a region the set
// can switch off as a whole. The FORD (stepping stones over the stream, mossy boulders, a fallen trunk across the
// water), the THICKET (a tunnel of bamboo, ground mist), the OLD WOOD (colossal buttressed giants furred with moss,
// moss hanging from their limbs, giant ferns, faintly glowing fungi in the shade, fallen trunks, mist, soft shafts)
// and the CLIFF (the plunge pool under the waterfall at the foot of the karst wall: talus blocks, wet stone, ferns).
// The forest ages along the way: bigger trees, more moss and mist, less sky.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeoBuf, sweep, card, rng, clamp, lerp, smooth, V3, TAU, U, noise3, meshOf, instancedOf, fpatch, fdepth } from './flora-core.js';
import { floraMaterials } from './flora-mats.js';
import { createAncientTree } from './flora-ancient.js';
import { createPineStand, createMapleStand, createBroadleafStand } from './flora-trees.js';
import { createBambooGrove } from './flora-bamboo.js';
import { createFerns, createUndergrowth, createLeafLitter, createRockField, scatter } from './flora-ground.js';
import { createLightShafts } from './flora-cliffs.js';
import { createMistPuffs } from './forest-set-basin.js';
import { P, S, heightAt, trailDist, trailPoint, trailDir, streamDist, streamPoint, waterAt, wallSide, FORD_W } from './forest-set-terrain.js';
import { treeFree } from './forest-set-wood.js';

const UP = V3(0, 1, 0);
/** the glow of the old wood's fungi (the story can breathe it): FUNGI.glow.value 0..2, FUNGI.color */
export const FUNGI = { glow: { value: 1 }, color: { value: new THREE.Color(0x5ef0c4) } };

/** a point beside the path: arc length s, lateral offset (+ = left of the way out: the stream / wall side) */
export function beside(s, off) { const [x, z] = trailPoint(s), [dx, dz] = trailDir(s); return [x + dz * off, z - dx * off]; }
const at = (x, z, dy = 0) => V3(x, heightAt(x, z) + dy, z);

// jittered grid in (arc length, offset) along a stretch of the path
function along({ s0, s1, cell, width, seed, accept }) {
  const r = rng(seed), out = [];
  for (let s = s0; s < s1; s += cell) for (let off = -width; off < width; off += cell) {
    const ss = s + r() * cell, oo = off + r() * cell, u = r();
    const [x, z] = beside(ss, oo);
    const tr = trailDist(x, z);
    if (tr.s < s0 || tr.s > s1) continue;          // (the grid folds on the inside of bends)
    if (accept(x, z, tr, u)) out.push({ x, z, tr, u, off: oo });
  }
  return out;
}
// a disc around a stretch of the path, for scatter()
function stretchDisc(s0, s1, width) { const [x, z] = trailPoint((s0 + s1) / 2); return { center: [x, z], radius: (s1 - s0) / 2 + width + 4 }; }

// the near trees as [x, z, kind, height] for the card forest that stands in for them from the air
function cardsOf(lists) {
  const out = [];
  for (const [kind, list, k] of lists) for (const t of list) out.push([t.position[0], t.position[2], kind, t.height * (k || 1)]);
  return out;
}
function standsOf(name, { pines = [], maples = [], gold = [], rust = [] }) {
  const g = new THREE.Group(); g.name = name + '-trees';
  if (pines.length) g.add(createPineStand(pines, { name: name + '-pines' }).group);
  if (maples.length) g.add(createMapleStand(maples, { name: name + '-maples' }).group);
  if (gold.length) g.add(createBroadleafStand(gold, { name: name + '-gold' }).group);
  if (rust.length) g.add(createBroadleafStand(rust, { name: name + '-rust', leaf: 'rust' }).group);
  return { group: g, cardList: cardsOf([['pine', pines], ['maple', maples, 1.1], ['gold', gold], ['rust', rust]]) };
}

// ------------------------------------------------------------------ hanging moss (old man's beard)
let _hang = null;
function hangMoss() {
  if (_hang) return _hang;
  const W = 128, H = 512, r = rng(8801);
  const cov = new Float32Array(W * H), sh = new Float32Array(W * H), rn = new Float32Array(W * H);
  const dot = (x, y, a, s, g) => { const i = Math.round(x), j = Math.round(y); if (i < 0 || j < 0 || i >= W || j >= H) return; const k = j * W + i; if (a > cov[k]) { cov[k] = a; sh[k] = s; rn[k] = g; } };
  // a few clumps hanging from the limb, each a tangle of thin wavy strands, long ones few, side fibres
  const clumps = [22, 50, 76, 104].map(x => [x + (r() - 0.5) * 10, 0.6 + r() * 0.4]);
  for (let k = 0; k < 46; k++) {
    const [cx, ck] = clumps[k % clumps.length];
    const x0 = cx + (r() - 0.5) * 18, L = H * ck * (0.2 + 0.8 * Math.pow(r(), 1.4)), w0 = 0.35 + r() * 0.45, ph = r() * 6, amp = 1.5 + r() * 4, g = r(), y0 = r() * H * 0.04;
    for (let y = y0; y < y0 + L && y < H; y += 0.6) {
      const t = (y - y0) / L, xx = x0 + Math.sin(y * 0.035 + ph) * amp + Math.sin(y * 0.15 + ph * 2) * 0.8, w = w0 * (1 - 0.5 * t);
      for (let i = -2; i <= 2; i++) { const a = 1 - Math.abs(i * 0.5) / (w + 0.45); if (a > 0) dot(xx + i * 0.5, y, a, 0.6 + 0.4 * (1 - t * 0.6), g); }
      if (r() < 0.03) { const dir = r() < 0.5 ? -1 : 1, l = 4 + r() * 10; for (let q = 0; q < l; q += 0.6) dot(xx + dir * q * 0.55, y + q, 0.75 - q / l * 0.35, 0.58, g); }
    }
  }
  const d = new Uint8Array(W * H * 4);
  for (let k = 0; k < W * H; k++) {
    const on = cov[k] > 0.3;
    d[k * 4] = Math.round((on ? sh[k] : 0.75) * 255); d[k * 4 + 1] = Math.round((on ? rn[k] : 0.5) * 255); d[k * 4 + 2] = 255; d[k * 4 + 3] = on ? 255 : 0;
  }
  const tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  const mat = fpatch(new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.85, metalness: 0 }), {
    kind: 'leaf', wind: true, leafA: 0x7f8c5c, leafB: 0xaab384, autA: 0x8e9462, autB: 0x9c9a6a, autC: 0x7a8456, autAmt: 0.2, drop: 0, trans: 0.75,
    transCol: 0xe6eebc, flutter: 0.7, snowLeaf: 0.35, atlasSize: 512, twig: 0x5a5a48, key: 'hangMoss',
  });
  mat.shadowSide = THREE.DoubleSide;
  _hang = { tex, mat, depth: fdepth(mat, { wind: true }) };
  return _hang;
}
// clumps of hanging moss under limbs: two crossed cards each, swaying from the limb
function hangingMoss(points, seed, name = 'hangingMoss') {
  const H = hangMoss(), r = rng(seed), B = new GeoBuf();
  for (const h of points) {
    const len = h.len ?? 1.0 + r() * 2.2, w = 0.45 + r() * 0.5, yaw = r() * Math.PI;
    const top = h.p.clone().add(V3(0, -(h.r ?? 0.2) * 0.5, 0));
    const base = top.clone().add(V3(0, -len, 0));
    for (const a of [yaw, yaw + Math.PI / 2]) {
      const ax = V3(Math.cos(a), 0, Math.sin(a)), n = V3(-Math.sin(a), 0.35, Math.cos(a)).normalize();
      const shade = 0.75 + r() * 0.3;
      card(B, base, ax, UP, w, len, [0.02, 1, 0.98, 0], n, [shade, shade, shade * 0.95], [0.9, 0.12], r());
    }
  }
  const m = meshOf(B.build(), H.mat, H.depth, { name, cast: true, receive: true });
  return m;
}

// ------------------------------------------------------------------ fungi: pale caps and bracket shelves that glow faintly
let _fungusMat = null;
function fungusMaterial() {
  if (_fungusMat) return _fungusMat;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uFungi: FUNGI.glow, uFungiCol: FUNGI.color, uTime: U.uTime });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSway; varying float vFG; varying float vFPh;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFG = aSway;\n#ifdef USE_INSTANCING\nvFPh = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719)))*43758.5453)*6.283;\n#else\nvFPh = 0.;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uFungi, uTime; uniform vec3 uFungiCol; varying float vFG; varying float vFPh;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uFungiCol*vFG*uFungi*(.72 + .28*sin(uTime*.9 + vFPh));');
  };
  m.customProgramCacheKey = () => 'flora-fungus';
  _fungusMat = m;
  return m;
}
// a cluster of little capped mushrooms (local: on the ground, y up) or a stack of bracket shelves (local +z = out of
// the bark, y up). aSway carries the glow mask (gills and undersides glow, caps a little).
function fungusGeometry(seed, kind) {
  const r = rng(seed), B = new GeoBuf();
  const dome = (c, rad, h, cols, rows, topCol, glowTop, glowUnder) => {
    const b0 = B.count;
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
      const t = i / rows, a = j / cols * TAU, rr = rad * Math.sin(t * Math.PI / 2) * (1 + 0.08 * Math.sin(a * 3 + seed));
      const y = h * Math.cos(t * Math.PI / 2);
      const k = 0.85 + 0.15 * (1 - t);
      B.v(c.x + Math.cos(a) * rr, c.y + y, c.z + Math.sin(a) * rr, Math.cos(a) * t, 1 - t * 0.6, Math.sin(a) * t, 0, 0, topCol[0] * k, topCol[1] * k, topCol[2] * k, glowTop * (0.4 + 0.6 * t), 0);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const p = b0 + i * (cols + 1) + j; B.t(p, p + 1, p + cols + 1); B.t(p + 1, p + cols + 2, p + cols + 1); }
    // the underside (gills): a flat disc a little under the rim, glowing
    const cI = B.count;
    B.v(c.x, c.y + 0.002, c.z, 0, -1, 0, 0, 0, 0.9, 0.95, 0.85, glowUnder, 0);
    for (let j = 0; j <= cols; j++) { const a = j / cols * TAU; B.v(c.x + Math.cos(a) * rad * 0.98, c.y - 0.003, c.z + Math.sin(a) * rad * 0.98, 0, -1, 0, 0, 0, 0.85, 0.9, 0.8, glowUnder * 0.8, 0); }
    for (let j = 0; j < cols; j++) B.t(cI, cI + 2 + j, cI + 1 + j);
  };
  const stem = (p, h, rad) => {
    const b0 = B.count, cols = 4;
    for (let i = 0; i <= 1; i++) for (let j = 0; j <= cols; j++) { const a = j / cols * TAU; B.v(p.x + Math.cos(a) * rad, p.y + h * i, p.z + Math.sin(a) * rad, Math.cos(a), 0, Math.sin(a), 0, 0, 0.82, 0.84, 0.76, 0.25, 0); }
    for (let j = 0; j < cols; j++) { const a = b0 + j, b = a + cols + 1; B.t(a, b, a + 1); B.t(a + 1, b, b + 1); }
  };
  if (kind === 'caps') {
    const n = 4 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.13, h = 0.025 + r() * 0.08, cr = 0.012 + r() * 0.035;
      const p = V3(Math.cos(a) * d, 0, Math.sin(a) * d);
      stem(p, h, cr * 0.22);
      dome(p.clone().add(V3(0, h, 0)), cr, cr * (0.5 + r() * 0.4), 7, 2, [0.86, 0.85, 0.74], 0.3, 1.0);
    }
  } else {
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      // a half-disc shelf out of the bark, a little lumpy
      const y = i * (0.05 + r() * 0.06), rad = 0.06 + r() * 0.1, cols = 10, b0 = B.count, th = rad * 0.22;
      const cx = (r() - 0.5) * 0.12;
      for (const side of [1, -1]) for (let j = 0; j <= cols; j++) {
        const a = Math.PI * j / cols;
        for (const rr of [0, 1]) {
          const rad2 = rad * rr * (1 + 0.1 * Math.sin(a * 4 + i));
          B.v(cx + Math.cos(a) * rad2, y + (side > 0 ? th * (1 - rr * 0.7) : 0), Math.sin(a) * rad2 * 0.8, 0, side, 0, 0, 0,
            side > 0 ? 0.74 : 0.9, side > 0 ? 0.7 : 0.93, side > 0 ? 0.6 : 0.84, side > 0 ? 0.25 + 0.3 * rr : 1.0, 0);
        }
      }
      const W2 = (cols + 1) * 2;
      for (let s2 = 0; s2 < 2; s2++) for (let j = 0; j < cols; j++) {
        const p = b0 + s2 * W2 + j * 2;
        if (s2 === 0) { B.t(p, p + 2, p + 1); B.t(p + 1, p + 2, p + 3); } else { B.t(p, p + 1, p + 2); B.t(p + 1, p + 3, p + 2); }
      }
      // the rim
      const top = b0, bot = b0 + W2;
      for (let j = 0; j < cols; j++) { const a = top + j * 2 + 1, b = top + j * 2 + 3, c = bot + j * 2 + 1, d = bot + j * 2 + 3; B.t(a, c, b); B.t(b, c, d); }
    }
  }
  return B.build();
}
function fungi(groundItems, barkItems, seed) {
  const r = rng(seed), mat = fungusMaterial(), group = new THREE.Group(); group.name = 'fungi';
  const caps = [fungusGeometry(seed + 1, 'caps'), fungusGeometry(seed + 2, 'caps')], shelves = [fungusGeometry(seed + 3, 'shelf'), fungusGeometry(seed + 4, 'shelf')];
  const add = (geos, items, tag) => {
    const lists = geos.map(() => []);
    for (const it of items) {
      const q = it.n ? new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), V3(it.n.x, 0, it.n.z).normalize()) : new THREE.Quaternion().setFromAxisAngle(UP, r() * TAU);
      lists[Math.floor(r() * geos.length)].push(new THREE.Matrix4().compose(it.p, q, V3(1, 1, 1).multiplyScalar(it.s ?? 1)));
    }
    geos.forEach((g, i) => { if (lists[i].length) { const m = instancedOf(g, mat, null, lists[i], { name: 'fungi-' + tag + i, cast: false }); const c = new THREE.Color(); for (let k = 0; k < lists[i].length; k++) m.setColorAt(k, c.setHSL(0.12 + r() * 0.06, 0.25, 0.65 + r() * 0.25)); m.instanceColor.needsUpdate = true; group.add(m); } });
  };
  add(caps, groundItems, 'caps');
  add(shelves, barkItems, 'shelf');
  return group;
}

// ------------------------------------------------------------------ fallen trunks
function logInto(B, a, b, rad, seed, { bridge = false } = {}) {
  const r = rng(seed), n = Math.max(6, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.2));
  const ya = heightAt(a[0], a[1]) + rad * 0.62, yb = heightAt(b[0], b[1]) + rad * 0.62;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = lerp(a[0], b[0], t) + (r() - 0.5) * 0.15, z = lerp(a[1], b[1], t) + (r() - 0.5) * 0.15;
    const g = heightAt(x, z) + rad * 0.62;
    pts.push(V3(x, bridge ? Math.max(lerp(ya, yb, t), g) : Math.max(g, lerp(ya, yb, t) - 0.25), z));
  }
  const ph = r() * 10;
  const sw = sweep(B, pts, {
    radial: 14, segLen: 0.3, upAlign: 0,
    radius: t => rad * (1 - 0.18 * t) * (1 - 0.3 * smooth(0.96, 1, t)) * (1 - 0.3 * (1 - smooth(0, 0.04, t))),
    displace: (t, aa, p, dir, s, rr) => rr * (0.07 * noise3(p.x * 0.9 + ph, p.y * 0.9, p.z * 0.9) + 0.05 * (1 - Math.abs(noise3(Math.cos(aa) * 2, s * 0.4, Math.sin(aa) * 2 + ph)))),
    color: (t, aa, pos, dir) => { const up = dir.y / (dir.length() || 1); const ao = 0.5 + 0.5 * clamp(up * 0.6 + 0.6); return [ao, ao * 0.98, ao * 0.95]; },
    uRep: Math.max(1, Math.round(TAU * rad / 1.2)), vScale: 1 / 2.4,
  });
  // the broken ends, closed (an open tube end reads as a hoop): a dark, rotten face, a little sunk
  for (const [ring, sgn] of [[0, -1], [sw.rows, 1]]) {
    const b0 = sw.base + ring * (sw.cols + 1), c = sw.P[ring], t = sw.T[ring].clone().multiplyScalar(sgn);
    const ci = B.v(c.x - t.x * 0.04, c.y - t.y * 0.04, c.z - t.z * 0.04, t.x, t.y, t.z, 0.5, 0, 0.32, 0.27, 0.22, 0, 0);
    // (the ring runs from the frame's binormal toward its normal: clockwise seen from +T)
    for (let j = 0; j < sw.cols; j++) { if (sgn > 0) B.t(ci, b0 + j + 1, b0 + j); else B.t(ci, b0 + j, b0 + j + 1); }
  }
  // broken branch stubs
  for (let k = 0; k < 3; k++) {
    const i = 1 + Math.floor(r() * (pts.length - 2)), p = pts[i];
    const d = V3((r() - 0.5) * 2, 0.6 + r() * 0.6, (r() - 0.5) * 2).normalize();
    sweep(B, [p.clone(), p.clone().addScaledVector(d, rad * 1.1 + 0.4 + r() * 0.6)], { radial: 6, segLen: 0.25, radius: t => rad * 0.28 * (1 - 0.6 * t), color: () => [0.7, 0.68, 0.66], uRep: 1, vScale: 1 / 2.4 });
  }
  return pts;
}

// ------------------------------------------------------------------ ground cover along a stretch
function cover(name, o, q) {
  const k = q.low ? 0.5 : 1;
  const group = new THREE.Group(); group.name = name + '-cover';
  const disc = stretchDisc(o.s0, o.s1, o.width);
  const band = (x, z, dMin) => { const tr = trailDist(x, z); if (tr.s < o.s0 || tr.s > o.s1 || tr.d > o.width || tr.d < dMin) return false; const st = streamDist(x, z); if (st.d < 2.3) return false; const w = wallSide(x, z); if (w.d < 1.5 || (w.side < 0 && !w.end && w.d < 60)) return false; return !o.inside || o.inside(x, z); };
  if (o.ferns) group.add(createFerns({ ...disc, count: Math.round(o.ferns.count * k), seed: o.seed + 1, inside: (x, z) => band(x, z, o.ferns.dMin ?? 1.8), density: o.ferns.density, avoid: o.avoid || [] }, { groundAt: heightAt, scale: o.ferns.scale || [0.65, 1.3], seed: o.seed + 1, variants: 2 }).group);
  if (o.giantFerns) group.add(createFerns({ ...disc, count: Math.round(o.giantFerns.count * k), seed: o.seed + 4, inside: (x, z) => band(x, z, o.giantFerns.dMin ?? 3.2), density: o.giantFerns.density, avoid: o.avoid || [], minDist: 1.6 }, { groundAt: heightAt, scale: o.giantFerns.scale || [1.5, 2.5], seed: o.seed + 4, variants: 2 }).group);
  if (o.under) group.add(createUndergrowth({ ...disc, count: Math.round(o.under.count * k), groundAt: heightAt, seed: o.seed + 2, inside: (x, z) => band(x, z, o.under.dMin ?? 1.2), mix: o.under.mix, density: o.under.density, avoid: o.avoid || [], cast: { shrub: true } }).group);
  if (o.litter) group.add(createLeafLitter({ ...disc, inside: (x, z) => band(x, z, 0), avoid: o.avoid || [] }, Math.round(o.litter.count * k), { groundAt: heightAt, seed: o.seed + 3, material: o.litter.material, mapleShare: o.litter.mapleShare ?? 0.72 }).group);
  return group;
}
function rocksAlong(o, seed) {
  const r = rng(seed), items = [];
  for (const p of along({ ...o, seed, accept: (x, z, tr, u) => u < o.p && tr.d > (o.dMin ?? 2.6) && streamDist(x, z).d > (o.stream ?? 2.6) && wallSide(x, z).d > 2 && (!o.inside || o.inside(x, z)) })) {
    const s = o.size[0] + r() * (o.size[1] - o.size[0]);
    items.push({ x: p.x, z: p.z, size: [s, s * (0.55 + r() * 0.35), s * (0.7 + r() * 0.4)], shape: r() < 0.3 ? 'slab' : 'boulder', sink: 0.22 });
  }
  return items;
}
function mistAlong(o, seed) {
  const r = rng(seed), items = [];
  let tries = 0;
  while (items.length < o.count && tries++ < o.count * 30) {
    const s = o.s0 + r() * (o.s1 - o.s0), off = (r() < 0.5 ? -1 : 1) * (o.dMin + r() * (o.dMax - o.dMin));
    const [x, z] = beside(s, off);
    if (o.inside && !o.inside(x, z)) continue;
    items.push({ x, y: heightAt(x, z) - 0.4 + (o.lift || 0) * r(), z, w: o.w[0] + r() * (o.w[1] - o.w[0]), h: o.h[0] + r() * (o.h[1] - o.h[0]), a: 0.55 + r() * 0.45, seed: r() });
  }
  return items;
}
function shaftsAlong(o, sunDir, seed) {
  const r = rng(seed), sd = sunDir.clone().normalize(), pts = [];
  for (let i = 0; i < o.count; i++) {
    const s = o.s0 + r() * (o.s1 - o.s0), [x, z] = beside(s, (r() - 0.5) * o.spread);
    const L = (o.top[0] + r() * (o.top[1] - o.top[0])) / Math.max(0.2, sd.y);
    pts.push([x + sd.x * L, heightAt(x, z) + sd.y * L, z + sd.z * L]);
  }
  return createLightShafts({ sunDir: sd, points: pts, length: o.length, width: o.width, intensity: o.intensity, along: o.along });
}
const kindOf = (r, mix) => { let u = r(), k; for (k in mix) { u -= mix[k]; if (u <= 0) return k; } return k; };
function treeLists(name, pts, r, mixAt, sizes, seedBase) {
  const L = { pines: [], maples: [], gold: [], rust: [] };
  for (const p of pts) {
    const kind = kindOf(r, mixAt(p));
    const [h0, h1] = sizes[kind];
    const ht = h0 + r() * (h1 - h0), pos = [p.x, heightAt(p.x, p.z), p.z];
    if (kind === 'pine') L.pines.push({ seed: seedBase + L.pines.length * 13, height: ht, position: pos, density: 0.7, crownStart: 0.5 + r() * 0.1 });
    else if (kind === 'maple') L.maples.push({ seed: seedBase + 100 + L.maples.length * 11, height: ht, position: pos, stems: r() < 0.4 ? 2 : 1 });
    else if (kind === 'gold') L.gold.push({ seed: seedBase + 200 + L.gold.length * 7, height: ht, position: pos, density: 0.8 });
    else L.rust.push({ seed: seedBase + 300 + L.rust.length * 5, height: ht, position: pos, density: 0.8 });
  }
  return L;
}
// where the kinds may stand relative to the way (crowns clear of a camera 2-4 m behind him at 1.6 m)
const CLEAR = { pine: 3.8, gold: 4.6, rust: 4.6, maple: 5.4 };

// ------------------------------------------------------------------ the ford
export function buildFord(q = {}, sunDir = V3(-0.7, 0.3, -0.65)) {
  const s0 = 104, s1 = 190, r = rng(501), lo = q.low ? 0.55 : 1;
  const group = new THREE.Group(); group.name = 'ford';
  // where the way crosses the water
  let sc = S.FORD, best = Infinity;
  for (let s = S.FORD - 12; s <= S.FORD + 12; s += 0.1) { const [x, z] = trailPoint(s), d = streamDist(x, z).d; if (d < best) { best = d; sc = s; } }
  const cross = trailPoint(sc), stC = streamDist(cross[0], cross[1]);
  const pts = along({ s0, s1, cell: 7.6, width: 30, seed: 503, accept: (x, z, tr, u) => !treeFree(x, z, 0.4) && tr.d > 3.8 && u < 0.6 * lo && Math.hypot(x - cross[0], z - cross[1]) > 7 });
  const wet = p => streamDist(p.x, p.z).d < 13;
  const L = treeLists('ford', pts, r, p => wet(p) ? { maple: 0.32, gold: 0.38, rust: 0.3 } : { pine: 0.46, gold: 0.26, rust: 0.14, maple: 0.14 },
    { pine: [20, 29], gold: [16, 23], rust: [15, 21], maple: [7, 10.5] }, 11000);
  for (const k of ['maples', 'gold', 'rust']) L[k] = L[k].filter(t => trailDist(t.position[0], t.position[2]).d > CLEAR[k === 'maples' ? 'maple' : k]);
  // an old pine leaning out over the ford: the first of the old trees
  { const [x, z] = beside(sc + 9, -6.5); L.pines.push({ seed: 11991, height: 31, position: [x, heightAt(x, z), z], lean: 2.4, girth: 1.9, padScale: 1.6, crownStart: 0.42, rotationY: 2.2 }); }
  const stands = standsOf('ford', L);
  group.add(stands.group);
  // stepping stones across the water along the way, boulders on the banks
  const stones = [], rocks = [];
  for (let k = -5; k <= 5; k++) {
    const s = sc + k * 0.74, [x0, z0] = trailPoint(s), st = streamDist(x0, z0);
    if (st.d > FORD_W - 0.35) continue;
    const [dx, dz] = trailDir(s), j = (k % 2 ? 1 : -1) * (0.08 + r() * 0.08);
    const x = x0 + dz * j, z = z0 - dx * j;
    stones.push({ x, z, y: waterAt(st.s) - 0.05, size: [0.52 + r() * 0.14, 0.62, 0.44 + r() * 0.1], rotY: Math.atan2(dx, dz) + (r() - 0.5) * 0.5, shape: 'flat', sink: 0.16 });
  }
  for (let i = 0; i < 16; i++) {
    const ds = (r() - 0.5) * 40, side = r() < 0.5 ? -1 : 1, off = side * (2.6 + r() * 4.5);
    const s = stC.s + ds, [sx, sz] = streamPointAt(s), [tx, tz] = streamDirAt(s);
    const x = sx + tz * off, z = sz - tx * off;
    if (trailDist(x, z).d < 2.4) continue;
    const sz2 = 0.7 + r() * 1.5;
    rocks.push({ x, z, size: [sz2, sz2 * (0.5 + r() * 0.3), sz2 * (0.7 + r() * 0.4)], shape: r() < 0.3 ? 'slab' : 'boulder', sink: 0.25 });
  }
  rocks.push(...rocksAlong({ s0, s1, cell: 9, width: 30, p: 0.22, size: [0.5, 1.6] }, 521));
  const rf = createRockField([...stones, ...rocks], { groundAt: heightAt, detail: 7, seed: 531 });
  group.add(rf.group);
  // a trunk fallen across the water below the ford
  const logB = new GeoBuf();
  {
    const s = stC.s + 15, [sx, sz] = streamPointAt(s), [tx, tz] = streamDirAt(s);
    const a = [sx + tz * 5.2 + tx * 1.2, sz - tx * 5.2 + tz * 1.2], b = [sx - tz * 5.6 - tx * 1.0, sz + tx * 5.6 - tz * 1.0];
    logInto(logB, a, b, 0.42, 541, { bridge: true });
    const [lx, lz] = beside(sc - 14, 9.5); const [mx, mz] = beside(sc - 23, 13);
    logInto(logB, [lx, lz], [mx, mz], 0.5, 543);
  }
  const M = floraMaterials();
  group.add(meshOf(logB.build(), M.giantRoots, M.depth.static, { name: 'ford-logs' }));
  // ferns thick on the banks, undergrowth, litter
  const nearWater = (x, z) => 0.3 + 0.7 * (1 - smooth(3, 12, streamDist(x, z).d));
  const coverG = cover('ford', {
    s0, s1, width: 30, seed: 560,
    ferns: { count: 380, density: nearWater, dMin: 1.9 },
    under: { count: 520, mix: { grass: 0.35, shrub: 0.2, clover: 0.2, moss: 0.25 } },
    litter: { count: 1600 },
    avoid: [[cross[0], cross[1], 1.6]],
  }, q);
  group.add(coverG);
  // mist lying on the water
  const mist = [];
  for (let i = 0; i < 12; i++) { const s = stC.s + (r() - 0.5) * 60, [x, z] = streamPointAt(s); mist.push({ x, y: waterAt(s) - 0.3, z, w: 6 + r() * 6, h: 1.6 + r() * 1.6, a: 0.5 + r() * 0.5, seed: r() }); }
  const mistM = createMistPuffs(mist, { alpha: 0.32, near: [3, 9], name: 'ford-mist' });
  group.add(mistM.mesh);
  const shafts = shaftsAlong({ s0: s0 + 6, s1: s1 - 6, count: 10, spread: 14, top: [24, 32], length: 40, width: 1.2, intensity: 0.7 }, sunDir, 571);
  group.add(shafts.mesh);
  // the stones' tops, for the walker
  const stoneTops = stones.map(s => V3(s.x, s.y + 0.6 * 0.04 + 0.12, s.z));
  return { group, cover: coverG, rocks: rf.group, trees: stands.group, cardList: stands.cardList, shafts, mist: mistM, crossing: { s: sc, point: at(cross[0], cross[1]), stones: stoneTops } };
}
// the stream's centre line and direction at its own arc length (from the source)
function streamPointAt(s) { return streamPoint(s); }
function streamDirAt(s) { const a = streamPoint(s - 1), b = streamPoint(s + 1); const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }

// ------------------------------------------------------------------ the bamboo thicket
export function buildThicket(q = {}, sunDir = V3(-0.7, 0.3, -0.65)) {
  const s0 = 188, s1 = 252, r = rng(601), lo = q.low ? 0.6 : 1;
  const group = new THREE.Group(); group.name = 'thicket';
  const mid = (s0 + s1) / 2, [cx, cz] = trailPoint(mid);
  const inBand = (x, z, dMin, dMax) => { const tr = trailDist(x, z); return tr.s > s0 + 3 && tr.s < s1 - 3 && tr.d > dMin && tr.d < dMax && streamDist(x, z).d > 2.6; };
  // the tunnel: dense either side, the culms 2.3 m from the way at their nearest, thinning out away from it
  const bamboo = createBambooGrove({
    center: [cx, cz], radius: (s1 - s0) / 2 + 16, count: Math.round(430 * lo), seed: 611, groundAt: heightAt, minDist: 0.42,
    inside: (x, z) => inBand(x, z, 2.3, 15) && r() < 1 - 0.6 * smooth(6, 15, trailDist(x, z).d), heights: [10, 16.5],
    detailNear: trailPoint(mid - 8), detailRadius: q.low ? 0 : 3.6, ringStep: 0.85, culmShadows: false,
  });
  group.add(bamboo.group);
  // old pines standing over it
  const pts = along({ s0, s1, cell: 11, width: 30, seed: 613, accept: (x, z, tr, u) => !treeFree(x, z, 0.5) && tr.d > 9 && u < 0.4 * lo });
  const L = treeLists('thicket', pts, r, () => ({ pine: 0.75, gold: 0.25 }), { pine: [24, 32], gold: [20, 25], rust: [18, 22], maple: [8, 10] }, 12000);
  const stands = standsOf('thicket', L);
  group.add(stands.group);
  const coverG = cover('thicket', {
    s0, s1, width: 26, seed: 640,
    ferns: { count: 140, dMin: 2.0, density: (x, z) => 0.5 },
    under: { count: 380, dMin: 1.3, mix: { grass: 0.25, shrub: 0.1, clover: 0.15, moss: 0.5 } },
    litter: { count: 2600, mapleShare: 0.12 },
  }, q);
  group.add(coverG);
  const rocks = createRockField(rocksAlong({ s0, s1, cell: 10, width: 24, p: 0.18, size: [0.5, 1.3] }, 651), { groundAt: heightAt, detail: 7, seed: 652 });
  group.add(rocks.group);
  // ground mist among the culms, and banks of it across the way ahead
  const mist = [
    ...mistAlong({ s0, s1, count: Math.round(34 * lo), dMin: 2.8, dMax: 14, w: [6, 11], h: [3, 6.5] }, 661),
    ...mistAlong({ s0: s0 + 8, s1, count: Math.round(10 * lo), dMin: 0, dMax: 2, w: [8, 13], h: [2.5, 4.5] }, 662),
  ];
  const mistM = createMistPuffs(mist, { alpha: 0.3, near: [4.5, 13], color: 0xe9eeee, name: 'thicket-mist' });
  group.add(mistM.mesh);
  const shafts = shaftsAlong({ s0: s0 + 4, s1: s1 - 4, count: 9, spread: 10, top: [16, 22], length: 28, width: 0.55, intensity: 0.6, along: [0.3, 0.9] }, sunDir, 671);
  group.add(shafts.mesh);
  const cardList = [...stands.cardList, ...bamboo.positions.filter((p, i) => i % 6 === 0).map(p => [p.x, p.z, 'gold', 13])];
  return { group, cover: coverG, rocks: rocks.group, trees: stands.group, bamboo, cardList, shafts, mist: mistM };
}

// ------------------------------------------------------------------ the old wood
const GIANTS = [
  // [arc length, offset (+ left, beyond the stream), radius, fork height, crown scale, seed]
  [257, -11.5, 2.5, 22, 1.5, 801], [268, 22.5, 2.8, 24, 1.6, 802], [280, -13.5, 3.0, 26, 1.75, 803], [292, 23.5, 2.6, 23, 1.55, 804],
  [302, -11.5, 2.7, 25, 1.6, 805], [314, 21.5, 2.9, 27, 1.7, 806], [325, -13, 2.6, 24, 1.6, 807], [339, -11.5, 2.4, 22, 1.5, 808],
];
export function buildOldwood(q = {}, sunDir = V3(-0.7, 0.3, -0.65)) {
  const s0 = 250, s1 = 348, r = rng(701), lo = q.low ? 0.55 : 1;
  const M = floraMaterials();
  const group = new THREE.Group(); group.name = 'oldwood';
  // the giants: merged per material, in two batches along the way (so the half behind the camera can drop out)
  const batches = [{ trunk: [], roots: [], limbs: [], leaves: [] }, { trunk: [], roots: [], limbs: [], leaves: [] }];
  const giants = [], hangers = [], barkSpots = [];
  const list = q.low ? GIANTS.filter((g, i) => i % 3 !== 2) : GIANTS;
  for (const [s, off, rad, th, cs, seed] of list) {
    const [x, z] = beside(s, off);
    if (wallSide(x, z).d < 12 || streamDist(x, z).d < rad + 3.5) continue;
    const [px, pz] = trailPoint(s), front = Math.atan2(pz - z, px - x);
    const T = createAncientTree({
      seed, position: [x, heightAt(x, z), z], front, groundAt: heightAt, radius: rad, trunkH: th, crownScale: cs, lobes: 8,
      leafDensity: q.low ? 0.32 : 0.44, leafSize: 1.4, detail: q.low ? 0.26 : 0.32, nook: false, buttress: 1.3, buttressH: 1.35, rootScale: 0.62,
      limbs: 6, limbDetail: 0.55, smallRoots: 5,
      materials: { trunk: M.giantTrunk, roots: M.giantRoots, limbs: M.giantLimb, leaves: M.giantLeaf },
    });
    T.group.updateMatrixWorld(true);
    const parts = batches[s < 300 ? 0 : 1];
    for (const [k, mesh] of [['trunk', T.trunk], ['roots', T.roots], ['limbs', T.limbs], ['leaves', T.leaves]]) parts[k].push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    giants.push({ x, z, r: rad + 4.5, h: th + 9 * cs, tree: T });
    for (const h of T.hangers) if (r() < 0.55 && h.p.y - heightAt(h.p.x, h.p.z) > 5 && trailDist(h.p.x, h.p.z).d > 3.2) hangers.push(h);
    // bracket fungi on the buttresses, in the shade low down
    for (let k = 0; k < 7; k++) {
      const a = r() * TAU, y = 0.3 + r() * 2.2, p = T.surfaceAt(a, y);
      barkSpots.push({ p, n: V3(Math.cos(a), 0, Math.sin(a)), s: 0.8 + r() * 0.7 });
    }
  }
  const giantG = new THREE.Group(); giantG.name = 'oldwood-giants';
  const mats = { trunk: [M.giantTrunk, M.depth.static], roots: [M.giantRoots, M.depth.static], limbs: [M.giantLimb, M.depth.limb], leaves: [M.giantLeaf, M.depth.giantLeaf] };
  batches.forEach((parts, b) => { for (const k in parts) if (parts[k].length) { const g = mergeGeometries(parts[k], false); g.computeBoundingSphere(); giantG.add(meshOf(g, mats[k][0], mats[k][1], { name: 'giant-' + k + b, cast: k !== 'roots' })); parts[k].forEach(p => p.dispose()); } });
  group.add(giantG);
  // moss low on the giants: the band starts at the old wood's ground, not at the camp's
  const gy = heightAt(...trailPoint(290));
  for (const m of [M.giantTrunk, M.giantRoots]) m.userData.flora.uniforms.uMossH.value.z = gy - 0.5;
  const notGiant = (x, z, pad = 0) => giants.every(g => Math.hypot(x - g.x, z - g.z) > g.r + pad);
  // the other trees: old pines and broadleaves, tall and sparse under the giants
  const pts = along({ s0, s1, cell: 10, width: 32, seed: 703, accept: (x, z, tr, u) => !treeFree(x, z, 0.5) && tr.d > 3.8 && u < 0.5 * lo && notGiant(x, z, 3) && wallSide(x, z).d > 7 });
  const L = treeLists('oldwood', pts, r, () => ({ pine: 0.5, gold: 0.3, rust: 0.2 }), { pine: [26, 34], gold: [21, 27], rust: [19, 25], maple: [8, 11] }, 13000);
  for (const k of ['gold', 'rust']) L[k] = L[k].filter(t => trailDist(t.position[0], t.position[2]).d > CLEAR[k]);
  const stands = standsOf('oldwood', L);
  group.add(stands.group);
  // fallen giants
  const logB = new GeoBuf(), logs = [];
  for (const [sa, oa, sb, ob, rad] of [[262, -6.5, 274, -15, 0.85], [306, 6.5, 297, 9.5, 0.7], [331, -6, 344, -9.5, 0.75]]) {
    const a = beside(sa, oa), b = beside(sb, ob);
    if (streamDist(...a).d < 2.5 || streamDist(...b).d < 2.5) continue;
    logs.push(logInto(logB, a, b, rad, 711 + logs.length));
  }
  group.add(meshOf(logB.build(), M.giantRoots, M.depth.static, { name: 'oldwood-logs' }));
  // moss hanging from the giants' limbs
  if (hangers.length) group.add(hangingMoss(hangers.filter((h, i) => !q.low || i % 2 === 0), 721, 'oldwood-hangingMoss'));
  // ground: giant ferns at the giants' feet and along the water, ferns, moss, old leaves
  const giantFoot = (x, z) => giants.reduce((m, g) => Math.max(m, 1 - smooth(g.r, g.r + 9, Math.hypot(x - g.x, z - g.z))), 0);
  const avoid = giants.map(g => [g.x, g.z, g.r - 1.2]);
  const coverG = cover('oldwood', {
    s0, s1, width: 32, seed: 740, avoid,
    giantFerns: { count: 95, dMin: 3.3, scale: [1.5, 2.6], density: (x, z) => 0.25 + 0.75 * Math.max(giantFoot(x, z), 1 - smooth(3, 10, streamDist(x, z).d)) },
    ferns: { count: 300, dMin: 1.9, density: (x, z) => 0.4 + 0.6 * giantFoot(x, z) },
    under: { count: 640, dMin: 1.2, mix: { grass: 0.12, shrub: 0.12, clover: 0.16, moss: 0.6 } },
    litter: { count: 900, material: M.litterOld, mapleShare: 0.35 },
  }, q);
  group.add(coverG);
  const rocks = createRockField(rocksAlong({ s0, s1, cell: 9, width: 30, p: 0.25, size: [0.6, 2.0], inside: (x, z) => notGiant(x, z, 1) }, 751), { groundAt: heightAt, detail: 7, seed: 752 });
  group.add(rocks.group);
  // fungi: shelves on the buttresses, little capped clusters among roots, by the fallen trunks, in the moss
  const ground = [];
  for (const g of giants) for (let k = 0; k < 6; k++) { const a = r() * TAU, d = g.r - 1 + r() * 4; const x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d; if (trailDist(x, z).d > 1.6) ground.push({ p: at(x, z, -0.01), s: 0.9 + r() * 0.8 }); }
  for (const pts2 of logs) for (let k = 0; k < 5; k++) { const p = pts2[Math.floor(r() * pts2.length)]; const a = r() * TAU; const x = p.x + Math.cos(a) * 1.1, z = p.z + Math.sin(a) * 1.1; ground.push({ p: at(x, z, -0.01), s: 0.8 + r() * 0.7 }); }
  for (let k = 0; k < 30 * lo; k++) { const s = s0 + r() * (s1 - s0), [x, z] = beside(s, (r() < 0.5 ? -1 : 1) * (2.2 + r() * 12)); if (streamDist(x, z).d > 2.2) ground.push({ p: at(x, z, -0.01), s: 0.7 + r() * 0.8 }); }
  group.add(fungi(ground, barkSpots, 761));
  // mist between the trunks, soft shafts through the high canopy
  const mist = mistAlong({ s0, s1, count: Math.round(38 * lo), dMin: 3, dMax: 26, w: [8, 16], h: [4, 9] }, 771);
  mist.push(...mistAlong({ s0: s0 + 10, s1, count: Math.round(8 * lo), dMin: 0, dMax: 2, w: [10, 16], h: [3, 5.5] }, 772));
  const mistM = createMistPuffs(mist, { alpha: 0.4, near: [4, 12], color: 0xe6ebe9, name: 'oldwood-mist' });
  group.add(mistM.mesh);
  const shafts = shaftsAlong({ s0: s0 + 6, s1: s1 - 6, count: 12, spread: 22, top: [30, 40], length: 52, width: 2.2, intensity: 0.45, along: [0.35, 0.8] }, sunDir, 781);
  group.add(shafts.mesh);
  const cardList = [...stands.cardList, ...giants.map(g => [g.x, g.z, 'gold', g.h * 1.1])];
  return { group, cover: coverG, rocks: rocks.group, trees: stands.group, giants: giantG, giantList: giants, cardList, shafts, mist: mistM };
}

// ------------------------------------------------------------------ the foot of the cliff
export function buildCliffFoot(q = {}, sunDir = V3(-0.7, 0.3, -0.65)) {
  const s0 = 346, s1 = 400, r = rng(901), lo = q.low ? 0.55 : 1;
  const group = new THREE.Group(); group.name = 'cliffFoot';
  const pool = P.CLIFF_POOL;
  const poolClear = (x, z, pad) => Math.hypot(x - pool[0], z - pool[1]) > 5.2 + pad;
  // talus: great blocks fallen from the wall along its foot, smaller stones among them, wet stones about the pool
  const blocks = [];
  for (let i = 0; i < 70 && blocks.length < (q.low ? 14 : 24); i++) {
    const s = s0 - 30 + r() * 80, [x0, z0] = beside(s, 18 + r() * 10);
    const w = wallSide(x0, z0);
    if (w.side < 0 && !w.end) continue;
    if (w.d > 9 || !poolClear(x0, z0, 1.5) || streamDist(x0, z0).d < 2.8 || trailDist(x0, z0).d < 5) continue;
    const sz = w.d < 4 ? 2.5 + r() * 3.5 : 1 + r() * 2;
    blocks.push({ x: x0, z: z0, size: [sz, sz * (0.6 + r() * 0.35), sz * (0.75 + r() * 0.3)], shape: r() < 0.45 ? 'slab' : 'boulder', sink: 0.25 });
  }
  for (let i = 0; i < 12; i++) { const a = r() * TAU, d = 5.3 + r() * 2.2; const x = pool[0] + Math.cos(a) * d, z = pool[1] + Math.sin(a) * d; if (streamDist(x, z).d < 2.4 && Math.hypot(x - pool[0], z - pool[1]) > 4) continue; const s = 0.6 + r() * 1.3; blocks.push({ x, z, size: [s, s * 0.6, s * 0.85], shape: 'boulder', sink: 0.3 }); }
  blocks.push(...rocksAlong({ s0, s1, cell: 9, width: 26, p: 0.2, size: [0.5, 1.4], inside: (x, z) => poolClear(x, z, 0.5) }, 911));
  const rocks = createRockField(blocks, { groundAt: heightAt, detail: 8, seed: 912 });
  group.add(rocks.group);
  // trees: old pines and red maples against the grey wall, gold broadleaves, a giant
  const pts = along({ s0, s1, cell: 8.5, width: 30, seed: 913, accept: (x, z, tr, u) => !treeFree(x, z, 0.5) && tr.d > 3.8 && u < 0.55 * lo && poolClear(x, z, 3) && wallSide(x, z).d > 8 && !(wallSide(x, z).side < 0) });
  const L = treeLists('cliff', pts, r, p => streamDist(p.x, p.z).d < 10 ? { maple: 0.5, gold: 0.3, pine: 0.2 } : { pine: 0.5, gold: 0.25, rust: 0.1, maple: 0.15 }, { pine: [24, 32], gold: [19, 25], rust: [18, 23], maple: [7.5, 10.5] }, 14000);
  for (const k of ['maples', 'gold', 'rust']) L[k] = L[k].filter(t => trailDist(t.position[0], t.position[2]).d > CLEAR[k === 'maples' ? 'maple' : k]);
  // red maples by the pool
  for (const [a, d] of [[2.2, 8.6], [3.4, 9.2], [0.9, 9.5]]) { const x = pool[0] + Math.cos(a) * d, z = pool[1] + Math.sin(a) * d; if (trailDist(x, z).d > 5.4 && streamDist(x, z).d > 3) L.maples.push({ seed: 14900 + L.maples.length, height: 7 + r() * 2.5, position: [x, heightAt(x, z), z], stems: 2, density: 1.1 }); }
  const stands = standsOf('cliff', L);
  group.add(stands.group);
  const coverG = cover('cliff', {
    s0: s0 - 6, s1, width: 30, seed: 940,
    giantFerns: { count: 40, dMin: 3.2, scale: [1.4, 2.3], density: (x, z) => 0.2 + 0.8 * (1 - smooth(5, 16, Math.hypot(x - pool[0], z - pool[1]))) },
    ferns: { count: 300, dMin: 1.9, density: (x, z) => 0.35 + 0.65 * Math.max(1 - smooth(5, 15, Math.hypot(x - pool[0], z - pool[1])), 1 - smooth(2.5, 9, streamDist(x, z).d)) },
    under: { count: 420, dMin: 1.2, mix: { grass: 0.2, shrub: 0.15, clover: 0.15, moss: 0.5 } },
    litter: { count: 700, mapleShare: 0.8 },
    inside: (x, z) => poolClear(x, z, 0.3),
  }, q);
  group.add(coverG);
  const mist = mistAlong({ s0: s0 - 10, s1, count: Math.round(14 * lo), dMin: 4, dMax: 20, w: [8, 14], h: [3, 7], inside: (x, z) => wallSide(x, z).d > 3 }, 971);
  const mistM = createMistPuffs(mist, { alpha: 0.32, near: [4, 12], name: 'cliff-mist' });
  group.add(mistM.mesh);
  const shafts = shaftsAlong({ s0, s1: s1 - 6, count: 8, spread: 18, top: [26, 34], length: 46, width: 1.8, intensity: 0.5, along: [0.3, 0.9] }, sunDir, 981);
  group.add(shafts.mesh);
  return { group, cover: coverG, rocks: rocks.group, trees: stands.group, cardList: stands.cardList, shafts, mist: mistM };
}
