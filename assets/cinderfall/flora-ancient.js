// The ancient tree: a huge, twisted, buttressed trunk (rings resampled by arc length so the fins get as many vertices
// as the round trunk), massive roots snaking over ground and stones, a nook between two roots where the scroll rests,
// and a layered canopy of foliage masses that throws dappled light.
import * as THREE from 'three';
import { GeoBuf, sweep, card, gridNormals, gridIndex, fbm3, noise3, rng, clamp, lerp, smooth, V3, TAU, meshOf, MOSS_FOCUS } from './flora-core.js';
import { floraMaterials } from './flora-mats.js';
import { cellRect } from './flora-tex.js';
import { createFerns, createLeafLitter } from './flora-ground.js';

// zipper two rings (vertex index arrays with normalized parameters) into triangles facing along the stored normals
function zipper(buf, A, tA, B, tB) {
  let i = 0, j = 0;
  const nA = A.length - 1, nB = B.length - 1, P = buf.p, N = buf.n;
  const tri = (a, b, c) => {
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * N[a * 3] + ny * N[a * 3 + 1] + nz * N[a * 3 + 2] < 0) buf.t(a, c, b); else buf.t(a, b, c);
  };
  while (i < nA || j < nB) {
    if (j >= nB || (i < nA && tA[i + 1] <= tB[j + 1])) { tri(A[i], A[i + 1], B[j]); i++; }
    else { tri(A[i], B[j + 1], B[j]); j++; }
  }
}

/**
 * createAncientTree(opts) -> { group, trunk, roots, limbs, leaves, moss, scrollSpot, scrollDir, anchors, hangers, ... }
 * opts: seed, radius (base half-width without buttresses, m), trunkH (height of the fork), lobes (buttress count),
 *       front (local angle, radians, of the root cradle; 0 = +x, PI/2 = +z), position [x,y,z], rotationY,
 *       groundAt(x,z) world ground height (roots follow it), rocks [{x,z,r,h}] world (roots climb over them),
 *       leafDensity (1), crownScale (1),
 *       detail (1: mesh resolution scale; the old wood's giants use ~0.4), nook (true: the root cradle with the moss
 *       cushion where the scroll rests; false: plain buttresses all round), materials { trunk, roots, limbs, leaves }.
 * hangers: world points under the limbs [{ p, r }] (where moss can hang).
 */
export function createAncientTree(opts = {}) {
  const o = {
    seed: 11, radius: 1.85, trunkH: 17, lobes: 7, front: 0,
    position: [0, 0, 0], rotationY: 0, groundAt: null, rocks: [], leafDensity: 1, crownScale: 1, detail: 1, nook: true, materials: {}, ...opts,
  };
  const cs = o.crownScale, det = o.detail, hasNook = o.nook !== false;
  const M = floraMaterials();
  const MT = { trunk: M.ancientTrunk, roots: M.ancientBark, limbs: M.ancientLimb, leaves: M.ancientLeaf, ...o.materials };
  const hangers = [];
  const tileW = 1.2, tileH = 2.4;
  const r = rng(o.seed);
  const group = new THREE.Group();
  group.name = 'ancientTree';
  group.position.set(...o.position);
  group.rotation.y = o.rotationY;
  group.updateMatrixWorld(true);
  const base = V3(...o.position);
  const toWorld = (x, z) => V3(x, 0, z).applyMatrix4(group.matrixWorld);
  const ground = (x, z) => { if (!o.groundAt) return 0; const w = toWorld(x, z); return o.groundAt(w.x, w.z) - base.y; };
  const rocks = o.rocks.map(k => { const p = V3(k.x, 0, k.z).sub(base).applyAxisAngle(V3(0, 1, 0), -o.rotationY); return { x: p.x, z: p.z, r: k.r, h: k.h + (k.y ?? 0) - base.y }; });
  const rockTop = (x, z) => { let y = -1e9; for (const k of rocks) { const d = Math.hypot(x - k.x, z - k.z) / k.r; if (d < 1) y = Math.max(y, k.h * Math.sqrt(1 - d * d)); } return y; };

  // ---------------------------------------------------------------- trunk profile
  const R0 = o.radius, R1 = R0 * 0.7, TH = o.trunkH;
  const Rb = y => (R1 + (R0 - R1) * Math.exp(-Math.max(0, y) / 3.4)) * (1 - 0.012 * Math.max(0, y));
  const twist = 0.034;
  const center = y => V3(0.6 * Math.sin(y * 0.09 + 0.3) - 0.6 * Math.sin(0.3) + 0.028 * y, y, 0.45 * Math.sin(y * 0.07 + 2.1) - 0.45 * Math.sin(2.1));
  const front = o.front;
  const lobes = [];
  // the cradle: two great roots either side of the nook, opened enough that the scroll is seen from behind a
  // kneeling figure; low buttresses there, not walls
  const cradleHalf = o.cradleHalf ?? 0.74;
  if (hasNook) {
    lobes.push({ th: front - cradleHalf, A: 2.0, h: 0.85, t: 0.6, ph: r() * 6, cradle: -1 });
    lobes.push({ th: front + cradleHalf, A: 1.75, h: 0.8, t: 0.55, ph: r() * 6, cradle: 1 });
  }
  // the nook's share of a surface direction/height: flutes, ridges and dark furrows smooth out under the moss there
  const nookK = hasNook ? (theta, y) => { let d = theta - front; d -= Math.round(d / TAU) * TAU; return Math.exp(-(d * d) / 0.3) * (1 - smooth(1.0, 3.4, y)); } : () => 0;
  const rest = o.lobes - (hasNook ? 2 : 0);
  for (let k = 0; k < rest; k++) {
    const th = hasNook ? front + cradleHalf + 0.6 + (TAU - 2 * cradleHalf - 1.2) * (k + 0.5) / rest + (r() - 0.5) * 0.35 : front + TAU * (k + 0.3 + r() * 0.4) / rest;
    lobes.push({ th, A: (1.4 + r() * 1.4) * (o.buttress ?? 1), h: (1.6 + r() * 1.8) * (o.buttressH ?? 1), t: 0.45 + r() * 0.3, ph: r() * 6, cradle: 0 });
  }
  const lobeAt = (L, y) => {
    const yy = Math.max(0, y);
    return {
      amp: L.A * (0.78 * Math.exp(-yy / L.h) + 0.22 * Math.exp(-yy / (L.h * 3.8))),
      th: L.th + twist * yy + 0.07 * Math.sin(yy * 0.45 + L.ph),
      thick: L.t * (0.62 + 0.38 * Math.exp(-yy / 2.2)),
    };
  };
  const topClose = y => 1 - smooth(TH - 1.6, TH + 0.5, y) * 0.75;
  const profile = (theta, y) => {
    const yy = Math.max(0, y);
    const rb = Rb(yy);
    let rad = rb;
    for (const L of lobes) {
      const l = lobeAt(L, yy);
      let d = theta - l.th; d -= Math.round(d / TAU) * TAU;
      const sig = l.thick / (rb + l.amp * 0.5);
      rad += l.amp * Math.exp(-(d * d) / (sig * sig));
    }
    // big twisted flutes and burls (softened in the nook, where moss fills them)
    const nk = 1 - 0.75 * nookK(theta, y);
    rad += rb * nk * (0.08 * Math.sin(5 * theta + 1.3 + 0.2 * yy) + 0.055 * Math.sin(9 * theta - 0.3 * yy + 2.0) + 0.03 * Math.sin(14 * theta + 0.45 * yy));
    rad += rb * 0.2 * fbm3(Math.cos(theta) * 1.2 + 5, yy * 0.16, Math.sin(theta) * 1.2, 3);
    return rad * topClose(y);
  };

  const buf = new GeoBuf();
  const seamTh = front + Math.PI;
  const K = Math.round(1200 * Math.max(0.4, det));
  const ringVerts = (y, cols) => {
    const c = center(y);
    const th = new Float32Array(K + 1), rr = new Float32Array(K + 1), s = new Float32Array(K + 1);
    let px = 0, pz = 0;
    for (let k = 0; k <= K; k++) {
      th[k] = seamTh + (k / K) * TAU;
      rr[k] = profile(th[k], y);
      const x = Math.cos(th[k]) * rr[k], z = Math.sin(th[k]) * rr[k];
      s[k] = k ? s[k - 1] + Math.hypot(x - px, z - pz) : 0;
      px = x; pz = z;
    }
    const Wn = 45, rs = new Float32Array(K + 1);
    let acc = 0;
    for (let k = -Wn; k <= Wn; k++) acc += rr[(k + K) % K];
    for (let k = 0; k <= K; k++) { rs[k] = acc / (2 * Wn + 1); acc += rr[(k + Wn + 1) % K] - rr[(k - Wn + K) % K]; }
    const L = s[K];
    const idx = [], tt = [];
    let k = 0;
    const yy = Math.max(0, y);
    for (let j = 0; j <= cols; j++) {
      const sj = (j / cols) * L;
      while (k < K - 1 && s[k + 1] < sj) k++;
      const f = clamp((sj - s[k]) / Math.max(1e-6, s[k + 1] - s[k]));
      const theta = lerp(th[k], th[k + 1], f), rad = lerp(rr[k], rr[k + 1], f), rsm = lerp(rs[k], rs[k + 1], f);
      const cx = Math.cos(theta), cz = Math.sin(theta);
      const x0 = cx * rad, z0 = cz * rad;
      // macro bark: vertical ridges a few decimetres wide (the texture carries the finer furrows)
      const ridge = 1 - Math.abs(noise3(x0 * 1.6 + 7, yy * 0.22, z0 * 1.6));
      const knob = fbm3(x0 * 0.9, yy * 0.6 + 4, z0 * 0.9, 2);
      const nk = nookK(theta, y);
      const disp = (ridge - 0.6) * 0.11 * (0.7 + 0.3 * Math.exp(-yy / 3)) * (1 - 0.85 * nk) + knob * 0.06 * (1 + nk);
      const rr2 = rad + disp;
      const conc = clamp((rsm - rad) / 0.9);
      const gnd = smooth(-0.35, 1.5, y);
      const ao = lerp(0.72 + 0.28 * clamp(ridge * 1.3 - 0.2), 0.9, nk) * (1 - conc * lerp(0.42, 0.25, nk)) * (0.42 + 0.58 * gnd);
      const tint = 0.95 + 0.08 * smooth(2, 12, y);
      idx.push(buf.v(c.x + cx * rr2, y, c.z + cz * rr2, cx, 0, cz, 0, 0, ao * tint, ao * tint * 0.985, ao * tint * 0.96, 0, 0));
      tt.push(j / cols);
    }
    return { idx, tt };
  };
  const section = (y0, y1, rows, cols, ease) => {
    const b0 = buf.count, rings = [];
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      rings.push(ringVerts(y0 + (y1 - y0) * (ease ? (0.3 * t + 0.7 * t * t) : t), cols));
    }
    gridNormals(buf, b0, rows, cols, true);
    gridIndex(buf, b0, rows, cols);
    return rings;
  };
  const rs = v => Math.max(6, Math.round(v * det));
  const low = section(-0.8, 3.8, rs(62), rs(380), true);
  const high = section(3.8, TH + 0.7, rs(96 * (0.6 + 0.4 * TH / 18)), rs(176), false);
  zipper(buf, low[low.length - 1].idx, low[low.length - 1].tt, high[0].idx, high[0].tt);
  const trunk = meshOf(buf.build(), MT.trunk, M.depth.static, { name: 'ancientTrunk' });
  group.add(trunk);

  // ---------------------------------------------------------------- roots
  // the nook (where the scroll rests): in front of the trunk between the two cradle roots
  const fdir = V3(Math.cos(front), 0, Math.sin(front));
  const side = V3(-fdir.z, 0, fdir.x);
  const c0 = center(0);
  const frontR = profile(front, 0.25);
  const nook = c0.clone().addScaledVector(fdir, frontR + 0.7);
  nook.y = ground(nook.x, nook.z);
  const nearNook = P => 1 - smooth(1.2, 3.4, Math.hypot(P.x - nook.x, P.z - nook.z));
  const rbuf = new GeoBuf();
  const rootDisp = (t, a, P, dir, s, rad) => {
    const ridge = 1 - Math.abs(noise3(Math.cos(a) * 1.8 + P.x * 0.2, s * 0.35, Math.sin(a) * 1.8 + P.z * 0.2));
    return rad * ((ridge - 0.6) * 0.16 * (1 - 0.8 * nearNook(P)) + 0.12 * noise3(P.x * 0.8, P.y * 0.8 + 3, P.z * 0.8));
  };
  const rootColor = (t, a, pos, dir) => {
    const dl = dir.length() || 1, up = dir.y / dl;
    const gy = ground(pos.x, pos.z);
    const ao = (0.42 + 0.58 * clamp(up * 0.6 + 0.55)) * (0.4 + 0.6 * smooth(-0.08, 0.5, pos.y - gy));
    return [ao, ao * 0.985, ao * 0.96];
  };
  const groundPath = (x0, z0, ang, len, rad0, wob, ph, lift, step = 0.8) => {
    const pts = [];
    let x = x0, z = z0, a = ang;
    const n = Math.max(2, Math.ceil(len / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      a += (noise3(i * 0.31 + ph, ph, 0.5) * 0.55 + Math.sin(i * 0.7 + ph) * 0.1) * wob;
      x += Math.cos(a) * step; z += Math.sin(a) * step;
      const rad = rad0 * (1 - t * 0.85);
      let y = ground(x, z) + rad * (lift + 0.3 * Math.sin(i * 0.8 + ph * 2) - 0.25 * t);
      const rt = rockTop(x, z);
      if (rt > -1e8) y = Math.max(y, rt + rad * 0.45);
      pts.push(V3(x, y, z));
    }
    return pts;
  };
  const addRoot = (pts, radiusFn, aspectFn, radial, rUV, ph = 0) => sweep(rbuf, pts, {
    radial: Math.max(5, Math.round(radial * Math.min(1, 0.35 + 0.65 * det))), segLen: (0.13 + rUV * 0.12) / Math.min(1, 0.3 + 0.7 * det), upAlign: 1,
    radius: (t, s) => radiusFn(t) * (1 + 0.12 * noise3(s * 0.55 + ph, ph, 1.7)),
    aspect: aspectFn, displace: rootDisp, color: rootColor,
    uRep: Math.max(1, Math.round(TAU * rUV / tileW)), vScale: 1 / tileH,
  });
  const plen = pts => { let l = 0; for (let i = 1; i < pts.length; i++) l += pts[i].distanceTo(pts[i - 1]); return l; };
  const cradle = {};
  for (const L of lobes) {
    const pts = [];
    for (const [y, inset] of [[1.9, -1], [1.25, 0.55], [0.7, 0.32]]) {
      const l = lobeAt(L, y), cc = center(y);
      const rr = inset < 0 ? Rb(y) * 0.55 : Rb(y) + l.amp - inset;
      pts.push(V3(cc.x + Math.cos(l.th) * rr, y, cc.z + Math.sin(l.th) * rr));
    }
    const l0 = lobeAt(L, 0), c0 = center(0);
    const dirA = l0.th, edge0 = Rb(0) + l0.amp;
    const sx = c0.x + Math.cos(dirA) * (edge0 - 0.05), sz = c0.z + Math.sin(dirA) * (edge0 - 0.05);
    const rad0 = ((L.cradle ? 0.34 : 0.4) + L.A * 0.1) * (o.rootScale ?? 1);
    const ang = dirA + (L.cradle ? L.cradle * 0.16 : (r() - 0.5) * 0.4);
    const len = L.cradle ? 7.5 : (5 + r() * 6) * (o.rootScale ?? 1);
    const lift = L.cradle ? 0.12 : 0.0;
    const finPts = [...pts, V3(sx, ground(sx, sz) + rad0 * (L.cradle ? 0.55 : 0.25), sz)];
    const gp = groundPath(sx, sz, ang, len, rad0, L.cradle ? 0.3 : 0.75, L.ph, lift);
    const all = [...finPts, ...gp];
    const tg = plen(finPts) / plen(all);
    const aspG = L.cradle ? 0.72 : 0.6, rFin = 0.3 + L.t * 0.15;
    const tube = addRoot(all,
      t => t < tg ? lerp(rFin, rad0, smooth(0, tg, t)) : lerp(rad0, 0.03, Math.pow((t - tg) / (1 - tg), 0.5)),
      t => t < tg ? lerp(2.0, aspG, smooth(0, tg, t)) : aspG, 22, rad0, L.ph);
    if (L.cradle) cradle[L.cradle] = { pts: all, tube, rad0 };
    const nsub = 1 + Math.floor(r() * 3);
    for (let k = 0; k < nsub; k++) {
      const t = 0.4 + r() * 0.4;
      const ii = Math.min(all.length - 2, Math.max(finPts.length, Math.floor(t * (all.length - 1))));
      const p = all[ii], q = all[ii + 1];
      const da = Math.atan2(q.z - p.z, q.x - p.x) + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7);
      const rr = rad0 * (1 - t * 0.8) * 0.7;
      const sp = groundPath(p.x, p.z, da, 2 + r() * 4, rr, 1.0, r() * 9, 0.0, 0.55);
      addRoot([p.clone().add(V3(0, -rr * 0.4, 0)), ...sp], t2 => lerp(rr, 0.025, Math.pow(t2, 0.8)), () => 0.7, 12, rr, r() * 9);
    }
  }
  for (let k = 0; k < (o.smallRoots ?? 12); k++) {
    const a = r() * TAU;
    const c0 = center(0), rad = profile(a, 0.3) - 0.25;
    const x0 = c0.x + Math.cos(a) * rad, z0 = c0.z + Math.sin(a) * rad;
    const rr = 0.1 + r() * 0.14;
    const sp = groundPath(x0, z0, a + (r() - 0.5) * 0.6, 2.5 + r() * 4, rr, 1.2, r() * 9, -0.05, 0.5);
    addRoot([V3(x0, 0.3, z0), ...sp], t => lerp(rr, 0.02, Math.pow(t, 0.8)), () => 0.75, 9, rr, r() * 9);
  }
  // the nook: a low root crossing under the scroll, moss cushion between the cradle roots
  if (hasNook) {
    const a = nook.clone().addScaledVector(side, -1.2).addScaledVector(fdir, -0.3);
    const b = nook.clone().addScaledVector(side, 1.25).addScaledVector(fdir, 0.05);
    const m = nook.clone().addScaledVector(fdir, -0.42);
    a.y = ground(a.x, a.z) + 0.02; b.y = ground(b.x, b.z) - 0.02; m.y = nook.y + 0.04;
    addRoot([a, m, b], t => 0.14 - 0.05 * t, () => 0.8, 12, 0.14, 3);
  }
  const roots = meshOf(rbuf.build(), MT.roots, M.depth.static, { name: 'ancientRoots' });
  group.add(roots);

  const mbuf = new GeoBuf();
  const mound = (p, rx, rz, h, ang) => {
    const rows = 16, cols = 48, b0 = mbuf.count;
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
      const t = i / rows, a = j / cols * TAU;
      const rim = 1 + 0.16 * noise3(Math.cos(a) * 1.8 + p.x, 0.3, Math.sin(a) * 1.8 + p.z);
      const lx = Math.cos(a) * rx * t * rim, lz = Math.sin(a) * rz * t * rim;
      const x = p.x + lx * Math.cos(ang) - lz * Math.sin(ang), z = p.z + lx * Math.sin(ang) + lz * Math.cos(ang);
      const lump = 0.022 * noise3(x * 9, 1.3, z * 9) + 0.03 * noise3(x * 3.5, 4.1, z * 3.5);
      const y = ground(x, z) + h * Math.pow(Math.max(0, 1 - t * t), 0.85) + lump * (1 - t * 0.6) - 0.03 * t * t;
      mbuf.v(x, y, z, Math.cos(a) * t, 1, Math.sin(a) * t, j / cols, t, 1, 1, 1, 0, 0);
    }
    gridNormals(mbuf, b0, rows, cols, true);
    // the pole ring collapses to one point: its grid normal is undefined (was a black spot), point it up
    for (let j = 0; j <= cols; j++) { const k = (b0 + j) * 3; mbuf.n[k] = 0; mbuf.n[k + 1] = 1; mbuf.n[k + 2] = 0; }
    gridIndex(mbuf, b0, rows, cols);
  };
  let moss = null;
  if (hasNook) {
    mound(nook, 0.62, 0.46, 0.15, Math.atan2(side.z, side.x));
    moss = meshOf(mbuf.build(), M.mossCushion, M.depth.static, { name: 'ancientMoss' });
    group.add(moss);
  }
  const scrollSpot = nook.clone().add(V3(0, 0.145 + 0.045, 0));
  // the nook's floor: small ferns against the roots and the trunk foot, old leaves, cushions of moss; the scroll's
  // resting place (in front of the cushion), and where one kneels before it, stay clear
  const dressing = new THREE.Group(); dressing.name = 'ancientNook';
  if (hasNook && o.dressNook !== false) {
    const L = (f, s) => nook.clone().addScaledVector(fdir, f).addScaledVector(side, s);
    const rest = L(0.4, 0), kneel = L(1.25, 0);
    const outsideTrunk = (x, z) => { const dx = x - c0.x, dz = z - c0.z; return Math.hypot(dx, dz) > profile(Math.atan2(dz, dx), 0.1) + 0.12; };
    const fernPts = [[-0.5, 0.95], [-0.55, -1.0], [-0.15, 1.5], [0.25, -1.55], [0.85, 1.8], [1.25, -1.95], [-0.05, -1.4], [0.6, 1.3], [1.7, 2.2], [-0.35, 1.95], [1.05, -2.35], [2.2, -2.5]]
      .map(([f, s], i) => { const p = L(f, s); return [p.x, p.z, 0.15 + 0.7 * ((i * 0.618) % 1)]; })
      .filter(p => outsideTrunk(p[0], p[1]));
    dressing.add(createFerns(fernPts, { groundAt: ground, scale: [0.28, 0.52], seed: o.seed + 71 }).group);
    const avoid = [[rest.x, rest.z, 0.32], [kneel.x, kneel.z, 0.45], [nook.x, nook.z, 0.5]];
    const inside = (x, z) => outsideTrunk(x, z);
    const ctr = L(0.45, 0);
    dressing.add(createLeafLitter({ center: [ctr.x, ctr.z], radius: 2.3, avoid, inside }, 150, { groundAt: ground, seed: o.seed + 73, sizes: [0.11, 0.19], material: M.litterOld, mapleShare: 0.4 }).group);
  }
  group.add(dressing);

  // ---------------------------------------------------------------- limbs, branches, canopy
  const lbuf = new GeoBuf(), fbuf = new GeoBuf();
  const clumps = [];
  const limbDisp = (t, a, P, dir, s, rad) => rad * (0.1 * noise3(P.x * 0.7, P.y * 0.7, P.z * 0.7) + 0.06 * (1 - Math.abs(noise3(Math.cos(a) * 2, s * 0.4, Math.sin(a) * 2))));
  const limbColor = (t, a, pos, dir) => { const dl = dir.length() || 1; const ao = 0.6 + 0.4 * clamp((dir.y / dl) * 0.5 + 0.6); return [ao, ao * 0.985, ao * 0.96]; };
  const gnarl = (p0, dir, len, n, jitter, rise) => {
    const pts = [p0.clone()];
    const d = dir.clone().normalize();
    let p = p0.clone();
    for (let i = 1; i <= n; i++) {
      d.add(V3((r() - 0.5) * jitter, (r() - 0.5) * jitter * 0.6 + rise, (r() - 0.5) * jitter)).normalize();
      p = p.clone().addScaledVector(d, len / n);
      pts.push(p);
    }
    return pts;
  };
  const branch = (pts, r0, r1, radial, swayK) => sweep(lbuf, pts, {
    radial: Math.max(4, Math.round(radial * Math.min(1, 0.45 + 0.55 * det) * (o.limbDetail ?? 1))), segLen: (0.3 + r0 * 0.4) / Math.min(1, 0.4 + 0.6 * det) / (o.limbDetail ?? 1), radius: t => lerp(r0, r1, Math.pow(t, 0.8)),
    displace: limbDisp, color: limbColor, uRep: Math.max(1, Math.round(TAU * r0 / tileW)), vScale: 1 / tileH,
    sway: t => swayK * Math.pow(t, 1.4),
  });
  const addClump = (c, rad, n) => clumps.push({ c, rad, n });
  const top = center(TH);
  const nLimbs = o.limbs ?? Math.round(6 + (cs - 1) * 5);
  for (let k = 0; k < nLimbs; k++) {
    const az = front + 0.5 + (k / nLimbs) * TAU + (r() - 0.5) * 0.5;
    const elev = 0.28 + r() * 0.3;
    const y0 = TH - 3.4 + r() * 2.4;
    const start = center(y0).add(V3(Math.cos(az) * 0.3, 0, Math.sin(az) * 0.3));
    const dir = V3(Math.cos(az) * Math.cos(elev), Math.sin(elev) + 0.3, Math.sin(az) * Math.cos(elev));
    const len = (14 + r() * 6) * cs;
    const pts = gnarl(start, dir, len, 7, 0.5, -0.07 / Math.sqrt(cs));
    const r0 = (0.74 + r() * 0.12) * Math.sqrt(cs);
    branch(pts, r0, 0.14, 18, 0.22);
    for (let i = 2; i < pts.length - 1; i++) hangers.push({ p: pts[i].clone(), r: lerp(r0, 0.14, i / (pts.length - 1)) });
    const nSec = 4 + Math.floor(r() * 3);
    for (let s = 0; s < nSec; s++) {
      const t = 0.3 + 0.65 * (s + r() * 0.5) / nSec;
      const ii = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      const p = pts[ii].clone().lerp(pts[ii + 1], r());
      const pd = pts[ii + 1].clone().sub(pts[ii]).normalize();
      const sideV = V3(-pd.z, 0, pd.x).normalize().multiplyScalar(s % 2 ? -1 : 1);
      const sd = pd.clone().multiplyScalar(0.6).add(sideV).add(V3(0, 0.1 + r() * 0.3, 0));
      const slen = (4.5 + r() * 4.5) * Math.sqrt(cs);
      const sp = gnarl(p, sd, slen, 4, 0.6, -0.05);
      const sr = lerp(r0, 0.14, t) * 0.5;
      branch(sp, sr, 0.04, 9, 0.5);
      addClump(sp[sp.length - 1].clone().add(V3(0, 0.5, 0)), (3.2 + r() * 1.4) * Math.sqrt(cs), 1);
      addClump(sp[2].clone().add(V3(0, 0.9, 0)), (2.0 + r() * 0.8) * Math.sqrt(cs), 0.8);
      for (let q = 0; q < 2; q++) {
        const tp = sp[1 + Math.floor(r() * (sp.length - 2))];
        const td = sd.clone().add(V3((r() - 0.5) * 1.6, 0.35, (r() - 0.5) * 1.6));
        const tpts = gnarl(tp, td, 2 + r() * 2.5, 3, 0.7, 0);
        branch(tpts, sr * 0.45, 0.02, 5, 0.8);
        addClump(tpts[tpts.length - 1].clone().add(V3(0, 0.4, 0)), 1.8 + r() * 1.0, 0.8);
      }
    }
    addClump(pts[pts.length - 1].clone().add(V3(0, 0.8, 0)), (3.2 + r() * 1.0) * Math.sqrt(cs), 1.1);
  }
  // two great low limbs reaching out over the glade
  for (const [daz, y0, len0] of [[-1.25, 7.8, 13], [1.5, 10.2, 11]]) {
    const len = len0 * cs;
    const az = front + daz;
    const start = center(y0);
    const dir = V3(Math.cos(az), 0.38, Math.sin(az));
    const pts = gnarl(start, dir, len, 8, 0.32, -0.03);
    branch(pts, 0.6, 0.1, 16, 0.3);
    for (let i = 2; i < pts.length; i++) hangers.push({ p: pts[i].clone(), r: lerp(0.6, 0.1, i / (pts.length - 1)) });
    for (let s = 0; s < 5; s++) {
      const p = pts[2 + s];
      const pd = pts[3 + s].clone().sub(p).normalize();
      const sd = V3(-pd.z, 0.45, pd.x).multiplyScalar(s % 2 ? 1 : -1).add(pd);
      const sp = gnarl(p, sd, 3 + r() * 3, 3, 0.6, 0);
      branch(sp, 0.18, 0.03, 7, 0.6);
      addClump(sp[sp.length - 1].clone().add(V3(0, 0.3, 0)), 2.2 + r() * 1.2, 0.9);
    }
    addClump(pts[pts.length - 1].clone().add(V3(0, 0.5, 0)), 2.8, 1);
  }
  addClump(top.clone().add(V3(0, 7 * cs, 0)), 4.2 * cs, 1.2);
  addClump(top.clone().add(V3(2.5, 5, -2)), 3.5 * cs, 1.0);
  const limbs = meshOf(lbuf.build(), MT.limbs, M.depth.limb, { name: 'ancientLimbs' });
  group.add(limbs);

  const rectA = cellRect('broadA'), rectB = cellRect('broadB');
  const up = V3(0, 1, 0);
  for (const cl of clumps) {
    const n = Math.round(cl.rad * cl.rad * 5.5 * cl.n * o.leafDensity);
    const ry = cl.rad * 0.55;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, cz = r() * 2 - 1, sz = Math.sqrt(1 - cz * cz);
      const dirv = V3(Math.cos(a) * sz, cz * 0.8 + 0.15, Math.sin(a) * sz).normalize();
      const sh = 0.5 + 0.5 * Math.sqrt(r());
      const p = cl.c.clone().add(V3(dirv.x * cl.rad * sh, dirv.y * ry * sh, dirv.z * cl.rad * sh));
      const size = (1.3 + r() * 0.9) * (o.leafSize ?? 1);
      const yaw = r() * TAU, tilt = 0.2 + r() * 0.55;
      const ay = V3(Math.cos(yaw) * Math.cos(tilt), Math.sin(tilt) * (r() < 0.25 ? -1 : 1), Math.sin(yaw) * Math.cos(tilt)).normalize();
      ay.lerp(V3(dirv.x, dirv.y * 0.4, dirv.z).normalize(), 0.5).normalize();
      const ax = V3().crossVectors(ay, up).normalize();
      if (ax.lengthSq() < 0.01) ax.set(1, 0, 0);
      const nrm = dirv.clone().multiplyScalar(0.75).add(V3(0, 0.55, 0)).normalize();
      const shade = clamp(0.5 + 0.5 * (dirv.y * 0.5 + 0.5) * sh, 0.32, 1.05);
      card(fbuf, p.clone().addScaledVector(ay, -size * 0.5), ax, ay, size, size, r() < 0.5 ? rectA : rectB, nrm, [shade * 0.95, shade, shade * 0.9], [0.35, 0.75], r());
    }
  }
  const leaves = meshOf(fbuf.build(), MT.leaves, M.depth.ancientLeaf, { name: 'ancientLeaves' });
  group.add(leaves);

  // ---------------------------------------------------------------- anchors (world space)
  const Wp = p => p.clone().applyMatrix4(group.matrixWorld);
  const rotY = v => v.clone().applyAxisAngle(V3(0, 1, 0), o.rotationY).normalize();
  const worldSpot = Wp(scrollSpot);
  // moss over every surface of roots and trunk foot around the nook (shared uniform of the ancient bark materials)
  if (hasNook && o.mossFocus !== false) { const wn = Wp(nook.clone().addScaledVector(fdir, -0.2)); MOSS_FOCUS.value.set(wn.x, wn.y + 0.3, wn.z, o.mossFocusR ?? 2.7); }
  const anchors = {
    scroll: worldSpot.clone(),
    hero: { pos: Wp(nook.clone().addScaledVector(fdir, 4.1).addScaledVector(side, -0.75).add(V3(0, 0.85, 0))), target: Wp(nook.clone().addScaledVector(fdir, -1.6).addScaledVector(side, -0.15).add(V3(0, 1.75, 0))), fov: 64 },
    nook: { pos: Wp(nook.clone().addScaledVector(fdir, 2.3).addScaledVector(side, -0.5).add(V3(0, 1.0, 0))), target: worldSpot.clone().add(V3(0, 0.15, 0)).addScaledVector(fdir, -0.3), fov: 48 },
    lookUp: { pos: Wp(nook.clone().addScaledVector(fdir, 3.0).add(V3(0, 1.3, 0))), target: Wp(top.clone().add(V3(0, 3, 0))), fov: 62 },
    wide: { pos: Wp(nook.clone().addScaledVector(fdir, 30).addScaledVector(side, -7).add(V3(0, 5, 0))), target: Wp(c0.clone().add(V3(0, 10, 0))), fov: 50 },
    front: rotY(fdir), side: rotY(side),
  };
  return {
    group, trunk, roots, limbs, leaves, moss,
    scrollSpot: worldSpot, scrollDir: rotY(side), anchors, hangers: hangers.map(h => ({ p: Wp(h.p), r: h.r })),
    radiusAt: (theta, y) => profile(theta, y),
    // a point on the bark (theta: local angle, y: height above the base), world space
    surfaceAt: (theta, y) => { const c = center(y), rr = profile(theta, y); return Wp(V3(c.x + Math.cos(theta) * rr, y, c.z + Math.sin(theta) * rr)); },
    footprint: R0 + 3, crownTop: Wp(top.clone().add(V3(0, 9 * cs, 0))).y, nook: Wp(nook),
  };
}
