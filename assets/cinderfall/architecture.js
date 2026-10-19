// Parametric Cinderfall architecture: terraced timber-and-plaster houses with curved tile roofs.
// Visibility codes (aVis): 0 always, 1 intact-only, 2 broken+ruins, 3 gone in ruins, 4 ruins-only, 6 burning-night only.
import * as THREE from 'three';
import { M, mul, mbox, mcyl, tube } from './geo.js';
import { SIGN_CELLS, SIGNS } from './materials.js';
import { lerp } from './util.js';

const V = new THREE.Vector3();

// Profile of a concave Chinese roof: steep near the ridge, flattening and flaring at the eave.
function roofDrop(t) {
  return t <= 1 ? t * 1.38 - 0.38 * t * t : 1 + (t - 1) * 0.52;
}

// Curved gable roof. Ridge along local x at y = 0, slopes toward +z (front) and -z (back).
export function roofGeometry({ L, D, H, ox = 0.9, ozF = 1.2, ozB = 1.0, lift = 0.55, segU = 26, segV = 12, hole = null, thickness = 0.16, lean = false }) {
  const halfX = L / 2 + ox;
  const P = (u, v, s) => {
    const e = Math.abs(u * 2 - 1);
    const zE = D / 2 + (s > 0 ? ozF : ozB);
    const zz = v * zE;
    let y = -H * (lean ? v * 1.25 - 0.25 * v * v : roofDrop(zz / (D / 2)));
    const corner = lift * Math.pow(e, 4.2) * Math.pow(v, 2.4) + lift * 0.28 * Math.pow(e, 2) * v;
    y += corner;
    const flare = 1 + 0.035 * v * v * Math.pow(e, 3);
    return [(u * 2 - 1) * halfX * flare, y, s * zz * (1 + 0.02 * Math.pow(e, 3) * v)];
  };
  const build = (under) => {
    const pos = [], uv = [], idx = [];
    for (const s of lean ? [1] : [1, -1]) {
      const start = pos.length / 3;
      for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) {
        const u = i / segU, v = j / segV;
        const p = P(u, v, s);
        if (under) p[1] -= thickness;
        pos.push(...p);
        const zE = D / 2 + (s > 0 ? ozF : ozB);
        uv.push(p[0], v * Math.hypot(zE, H) * 1.05);
      }
      for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
        if (hole && hole((i + 0.5) / segU, (j + 0.5) / segV, s)) continue;
        const a = start + j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
        const flip = (s > 0) !== under;
        if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // fascia strips along both eaves and the gable verges
  const fascia = [];
  const strip = (pts) => {
    const pos = [], uv = [], idx = [];
    let acc = 0;
    pts.forEach((p, k) => {
      if (k) acc += Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1], p[2] - pts[k - 1][2]);
      pos.push(p[0], p[1] + 0.02, p[2], p[0], p[1] - thickness - 0.1, p[2]);
      uv.push(acc, 0, acc, 0.26);
      if (k) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  for (const s of lean ? [1] : [1, -1]) {
    fascia.push(strip(Array.from({ length: segU + 1 }, (_, i) => P(i / segU, 1, s))));
    for (const u of [0, 1]) fascia.push(strip(Array.from({ length: segV + 1 }, (_, j) => P(u, j / segV, s))));
  }
  return { top: build(false), under: build(true), fascia, P, halfX };
}

// Wall panel with rectangular openings, built from plaster boxes. Openings: [{x0, x1, y0, y1}] in wall-local metres.
function wallPanels(len, h, openings, t = 0.14) {
  const cuts = new Set([0, len]);
  for (const o of openings) { cuts.add(Math.max(0, o.x0)); cuts.add(Math.min(len, o.x1)); }
  const xs = [...cuts].sort((a, b) => a - b);
  const boxes = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], mid = (a + b) / 2, w = b - a;
    if (w < 0.01) continue;
    const o = openings.find(op => mid > op.x0 && mid < op.x1);
    if (!o) boxes.push([mid, h / 2, w, h]);
    else {
      if (o.y0 > 0.02) boxes.push([mid, o.y0 / 2, w, o.y0]);
      if (o.y1 < h - 0.02) boxes.push([mid, (o.y1 + h) / 2, w, h - o.y1]);
    }
  }
  return boxes.map(([x, y, w, hh]) => ({ geo: mbox(w, hh, t), x, y }));
}

// A lattice window (frame + bars + paper) facing +z, origin at its centre.
function addWindow(kit, W, w, h, burn, vis, open = false) {
  const t = 0.09;
  kit.add('timber', mbox(w + 0.16, 0.12, t + 0.04), mul(W, M(0, h / 2 + 0.04, 0)), { burn, vis, color: 0.72 });
  kit.add('timber', mbox(w + 0.22, 0.1, t + 0.1), mul(W, M(0, -h / 2 - 0.05, 0.03)), { burn, vis, color: 0.72 });
  for (const sx of [-1, 1]) kit.add('timber', mbox(0.1, h, t + 0.03), mul(W, M(sx * (w / 2 + 0.03), 0, 0)), { burn, vis, color: 0.72 });
  const nx = Math.max(3, Math.round(w / 0.16)), ny = Math.max(3, Math.round(h / 0.16));
  for (let i = 1; i < nx; i++) kit.add('timber', mbox(0.026, h, 0.03), mul(W, M(-w / 2 + (i * w) / nx, 0, 0.01)), { burn, vis, color: 0.6 });
  for (let j = 1; j < ny; j++) kit.add('timber', mbox(w, 0.026, 0.03), mul(W, M(0, -h / 2 + (j * h) / ny, 0.01)), { burn, vis, color: 0.6 });
  if (!open) kit.add('paper', mbox(w, h, 0.01), mul(W, M(0, 0, -0.03)), { burn: burn * 0.8, vis });
}

// Door frame with two leaves. open: [leftAngle, rightAngle] in radians (inward swing).
function addDoor(kit, W, w, h, burn, vis, open = [0.15, 0.1], leafColor = 0.75) {
  kit.add('timber', mbox(w + 0.5, 0.24, 0.3), mul(W, M(0, h + 0.12, 0)), { burn, vis: 0, color: 0.62 });
  for (const sx of [-1, 1]) kit.add('timber', mbox(0.18, h, 0.28), mul(W, M(sx * (w / 2 + 0.09), h / 2, 0)), { burn, vis: 0, color: 0.62 });
  kit.add('stone', mbox(w + 0.3, 0.14, 0.42), mul(W, M(0, 0.07, 0.02)), { vis: 0 });
  const lw = w / 2;
  [-1, 1].forEach((sx, k) => {
    const hinge = mul(W, M(sx * w / 2, 0, -0.06, -sx * open[k]));
    kit.add('plank', mbox(lw, h - 0.04, 0.07), mul(hinge, M(-sx * lw / 2, h / 2, 0)), { burn, vis, color: leafColor * 0.8 });
    for (const yy of [0.35, h / 2, h - 0.4]) kit.add('timber', mbox(lw - 0.06, 0.08, 0.03), mul(hinge, M(-sx * lw / 2, yy, 0.05)), { burn, vis, color: 0.55 });
    kit.add('metal', mbox(0.05, 0.16, 0.05), mul(hinge, M(-sx * (lw - 0.12), h * 0.48, 0.07)), { vis });
    // the 福 diamond pasted on each leaf, swinging with it
    const fu = signGeometry(SIGN_CELLS['福'], 0.4, 0.4); fu.scale(1, 1, 0.2);
    kit.add('sign', fu, mul(hinge, M(-sx * lw / 2, h * 0.64, 0.05, 0, 0, Math.PI / 4)), { burn, vis });
  });
}

function addRoof(kit, W, cfg, { burn, vis, tint = 1, hole = null }) {
  const r = roofGeometry({ ...cfg, hole });
  const tileTint = [0.95 * tint, 0.97 * tint, 1.0 * tint];
  kit.add('roof', r.top, W, { burn: burn * 0.9, vis, color: tileTint });
  kit.add('roofUnder', r.under, W, { burn, vis, color: 0.55 });
  for (const f of r.fascia) kit.add('timber', f, W, { burn, vis, color: 0.45 });
  // ridge with curling end ornaments
  const rl = r.halfX * 1.84;
  kit.add('roof', mbox(rl, 0.32, 0.36), mul(W, M(0, 0.1, 0)), { burn: burn * 0.6, vis, color: [0.8, 0.8, 0.84] });
  kit.add('plaster', mbox(rl * 0.98, 0.1, 0.26), mul(W, M(0, 0.3, 0)), { burn: burn * 0.4, vis, color: 0.55 });
  for (const sx of [-1, 1]) {
    const x0 = sx * rl / 2;
    kit.add('roof', tube([[x0 - sx * 0.25, 0.12, 0], [x0, 0.4, 0], [x0 + sx * 0.06, 0.78, 0], [x0 - sx * 0.12, 0.86, 0], [x0 - sx * 0.22, 0.72, 0]], 0.1, 6, 10, 0.5), W, { burn: burn * 0.6, vis, color: [0.7, 0.7, 0.74] });
  }
  // verge rolls and eave tile ends
  for (const s of [1, -1]) {
    for (const u of [0, 1]) {
      const pts = Array.from({ length: 7 }, (_, j) => { const p = r.P(u, j / 6, s); return [p[0] * 0.995, p[1] + 0.07, p[2]]; });
      kit.add('roof', tube(pts, 0.085, 6, 12), W, { burn: burn * 0.7, vis, color: [0.78, 0.78, 0.82] });
    }
    const n = Math.floor(r.halfX * 2 / 0.27);
    const cap = mcyl(0.075, 0.075, 0.07, 8);
    for (let i = 1; i < n; i++) {
      const u = i / n;
      if (hole && hole(u, 0.97, s)) continue;
      const p = r.P(u, 1, s), q = r.P(u, 0.94, s);
      const ang = Math.atan2(p[1] - q[1], Math.abs(p[2] - q[2]));
      kit.add('roof', cap, mul(W, M(p[0], p[1] + 0.03, p[2] + s * 0.02, 0, s * (Math.PI / 2) - s * ang * 0, 0)), { burn: burn * 0.6, vis, color: [0.62, 0.62, 0.66] });
    }
  }
  return r;
}

// Build one house. Returns anchor points (world space) for props, fire and characters.
export function buildHouse(kit, h, place, groundY, rand) {
  const W = M(place.x, groundY, place.z, place.rotY);
  const { w, d, plat } = h;
  const burn = h.burn ?? 1;
  const tall = h.floors > 1;
  const pd = h.style === 'guard' ? 0.6 : 1.7;          // porch depth
  const H1 = h.style === 'forge' ? 3.1 : 3.0, H2 = 2.5;
  const y0 = plat, y1 = plat + H1;
  const anchors = { W, fire: [], lanterns: [], door: null, porch: [], frame: { w, d, pd, plat, y1, H1, tall } };
  const local = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(W);
  const collapse = h.collapse;
  const roofVis = collapse ? 1 : 3;

  // --- stone terrace and steps
  const dp = d + pd + 1.3, zc = pd / 2 + 0.05;
  kit.add('stone', mbox(w + 1.3, plat + 1.4, dp), mul(W, M(0, (plat - 1.4) / 2, zc)), { burn: 0.15, vis: 0 });
  kit.add('stone', mbox(w + 1.45, 0.14, dp + 0.12), mul(W, M(0, plat - 0.04, zc)), { burn: 0.2, vis: 0, color: [1.12, 1.1, 1.06] });
  const n = Math.max(1, Math.ceil(plat / 0.19));
  const front = zc + dp / 2;
  for (let i = 1; i <= n; i++) {
    const top = plat - (i * plat) / (n + 0.0001) + 0.001;
    if (top < 0.02) break;
    kit.add('stone', mbox(2.5, top + 0.4, 0.4), mul(W, M(h.stepX || 0, (top - 0.4) / 2, front + 0.4 * (i - 0.5))), { vis: 0, color: [1.08, 1.06, 1.02] });
  }
  kit.add('plank', mbox(w - 0.1, 0.06, d - 0.1), mul(W, M(0, y0 + 0.03, 0)), { burn: burn * 0.35, vis: 0, color: 0.62 });

  if (h.style === 'guard') return buildPavilion(kit, h, W, anchors, burn, rand);

  // --- frame: sill, posts, beams
  const postT = 0.27;
  const sideXs = [-w / 2, w / 2];
  const along = (len) => { const k = Math.max(2, Math.ceil(len / 2.7)); return Array.from({ length: k + 1 }, (_, i) => -len / 2 + (i * len) / k); };
  const frontPosts = along(w), sidePosts = along(d);
  for (const z of [-d / 2, d / 2]) for (const x of frontPosts) kit.add('timber', mbox(postT, H1, postT), mul(W, M(x, y0 + H1 / 2, z)), { burn, vis: 0, color: 0.62 });
  for (const x of sideXs) for (const z of sidePosts.slice(1, -1)) kit.add('timber', mbox(postT, H1, postT), mul(W, M(x, y0 + H1 / 2, z)), { burn, vis: 0, color: 0.62 });
  for (const z of [-d / 2, d / 2]) {
    kit.add('timber', mbox(w + 0.5, 0.32, 0.3), mul(W, M(0, y1 - 0.16, z)), { burn, vis: 3, color: 0.58 });
    kit.add('timber', mbox(w, 0.2, 0.28), mul(W, M(0, y0 + 0.1, z)), { burn, vis: 0, color: 0.58 });
  }
  for (const x of sideXs) {
    kit.add('timber', mbox(0.3, 0.32, d + 0.5), mul(W, M(x, y1 - 0.16, 0)), { burn, vis: 3, color: 0.58 });
    kit.add('timber', mbox(0.28, 0.2, d), mul(W, M(x, y0 + 0.1, 0)), { burn, vis: 0, color: 0.58 });
    kit.add('timber', mbox(0.2, 0.14, d), mul(W, M(x, y0 + 1.0, 0)), { burn, vis: 0, color: 0.55 });
  }

  // --- walls (front has door and windows unless it is an open shop or forge)
  const wallH = H1 - 0.5, wy = y0 + 0.2;
  const openFront = h.style === 'forge' || h.style === 'shop';
  const dw = h.style === 'herbal' ? 2.0 : 1.75, dh = 2.35;
  const openings = [{ x0: w / 2 - dw / 2, x1: w / 2 + dw / 2, y0: 0, y1: dh }];
  const winW = 1.25, winH = 1.05, winY = 0.95;
  const winX = [];
  if (w > 7.5) for (const sx of [-1, 1]) { const cx = w / 2 + sx * (dw / 2 + 0.75 + winW / 2); if (cx > 0.6 && cx < w - 0.6) { winX.push(cx - w / 2); openings.push({ x0: cx - winW / 2, x1: cx + winW / 2, y0: winY, y1: winY + winH }); } }
  const lowerVis = 0;
  const addWall = (len, ops, frameM, inner = false) => {
    for (const p of wallPanels(len, wallH, ops)) {
      const vis = p.y > 1.6 ? 3 : lowerVis;
      kit.add('plaster', p.geo, mul(frameM, M(p.x - len / 2, p.y, 0)), { burn: burn * 0.85, vis, color: inner ? 0.7 : [1, 0.98, 0.95] });
    }
  };
  if (!openFront) addWall(w, openings, mul(W, M(0, wy, d / 2)));
  addWall(w, [{ x0: w * 0.3, x1: w * 0.3 + 1.0, y0: 1.0, y1: 1.9 }], mul(W, M(0, wy, -d / 2, Math.PI)));
  for (const sx of [-1, 1]) addWall(d, sx > 0 ? [{ x0: d / 2 - 0.6, x1: d / 2 + 0.6, y0: 1.0, y1: 1.85 }] : [], mul(W, M(sx * w / 2, wy, 0, sx * Math.PI / 2)));
  if (!openFront) {
    const doorW = mul(W, M(0, y0, d / 2 + 0.02));
    const open = h.uncle ? [1.55, 1.5] : rand() < 0.45 ? [rand.range(0.3, 1.1), rand.range(0.05, 0.4)] : [0.02, 0.02];
    addDoor(kit, doorW, dw, dh, burn, 3, open);
    anchors.door = local(0, y0, d / 2 + 0.3);
    for (const x of winX) addWindow(kit, mul(W, M(x, wy + winY + winH / 2, d / 2 + 0.05)), winW, winH, burn, 3);
    anchors.windows = winX.map(x => local(x, wy + winY + winH / 2, d / 2 + 0.3));
  }
  // back & side windows
  addWindow(kit, mul(W, M(-w / 2 + w * 0.3 + 0.5, wy + 1.45, -d / 2 - 0.05, Math.PI)), 1.0, 0.9, burn, 3);
  addWindow(kit, mul(W, M(w / 2 + 0.05, wy + 1.42, 0, Math.PI / 2)), 1.2, 0.85, burn, 3);

  // --- porch posts with bracket blocks
  const porchZ = d / 2 + pd - 0.15;
  const porchXs = along(w).filter((_, i, a) => i % (a.length > 4 ? 2 : 1) === 0 || i === a.length - 1);
  let roofTop = y1 + 0.2;
  let mainRoof;
  if (!tall) {
    const Hd = 0.34 * d + 0.5;
    const cfg = { L: w + 0.2, D: d, H: Hd, ox: 0.95, ozF: pd + 0.85, ozB: 1.05, lift: 0.62 };
    const ridgeY = y1 + 0.16 + Hd;
    const RW = mul(W, M(0, ridgeY, 0));
    mainRoof = addRoof(kit, RW, cfg, { burn, vis: roofVis });
    if (collapse) addRoof(kit, RW, cfg, { burn, vis: 6, hole: (u, v, s) => s > 0 && Math.hypot((u - collapse.u) * 1.6, v - collapse.v) < collapse.r });
    roofTop = ridgeY;
    // gable infill under the roof
    for (const sx of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(-d / 2, 0);
      for (let k = 0; k <= 12; k++) { const z = -d / 2 + (k / 12) * d; shape.lineTo(z, Hd - Hd * roofDrop(Math.abs(z) / (d / 2)) + 0.02); }
      shape.lineTo(d / 2, 0);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
      g.translate(0, 0, -0.07);
      const uvs = g.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i), uvs.getY(i));
      kit.add('plaster', g, mul(W, M(sx * w / 2, y1, 0, Math.PI / 2)), { burn, vis: 3, color: [0.95, 0.93, 0.9] });
      kit.add('timber', mbox(0.16, Hd * 0.82, 0.2), mul(W, M(sx * (w / 2 + 0.08), y1 + Hd * 0.41, 0)), { burn, vis: 3, color: 0.55 });
    }
    const roofYAt = z => ridgeY - Hd * roofDrop(Math.abs(z) / (d / 2)) - 0.18;
    for (const x of porchXs) {
      const top = roofYAt(porchZ);
      kit.add('timber', mcyl(0.13, 0.15, top - y0, 10), mul(W, M(x, y0 + (top - y0) / 2, porchZ)), { burn, vis: 0, color: 0.6 });
      kit.add('stone', mcyl(0.22, 0.25, 0.22, 10), mul(W, M(x, y0 + 0.11, porchZ)), { vis: 0 });
      kit.add('timber', mbox(0.42, 0.22, 0.42), mul(W, M(x, top - 0.02, porchZ)), { burn, vis: 3, color: 0.5 });
      anchors.porch.push(local(x, top - 0.25, porchZ));
    }
    kit.add('timber', mbox(w + 0.6, 0.2, 0.22), mul(W, M(0, roofYAt(porchZ) + 0.12, porchZ)), { burn, vis: 3, color: 0.5 });
    for (const x of frontPosts) kit.add('timber', mbox(0.14, 0.14, pd), mul(W, M(x, roofYAt(porchZ) + 0.05, d / 2 + pd / 2)), { burn, vis: 3, color: 0.5 });
    anchors.eave = z => roofYAt(z);
  } else {
    // waist eave around the first floor
    const wy2 = y1 + 0.14;
    const leanCfg = (len) => ({ L: len, D: 0.01, H: 0.0, ox: 0.4, ozF: 1.25, ozB: 0.001, lift: 0.35, segV: 6, lean: true });
    for (const [rx, rz, len, dd] of [[0, d / 2, w, 0], [0, -d / 2, w, Math.PI], [w / 2, 0, d, Math.PI / 2], [-w / 2, 0, d, -Math.PI / 2]]) {
      if (h.balcony && rz > 0) continue;
      const r = roofGeometry({ ...leanCfg(len), H: 0.55 });
      const LW = mul(W, M(rx, wy2 + 0.55, rz, dd));
      kit.add('roof', r.top, LW, { burn, vis: 3 });
      kit.add('roofUnder', r.under, LW, { burn, vis: 3, color: 0.5 });
      for (const f of r.fascia) kit.add('timber', f, LW, { burn, vis: 3, color: 0.45 });
    }
    // porch roof posts (shorter, under the balcony)
    for (const x of porchXs) {
      kit.add('timber', mcyl(0.13, 0.15, H1 + 0.1, 10), mul(W, M(x, y0 + (H1 + 0.1) / 2, porchZ)), { burn, vis: 0, color: 0.6 });
      kit.add('stone', mcyl(0.22, 0.25, 0.22, 10), mul(W, M(x, y0 + 0.11, porchZ)), { vis: 0 });
      anchors.porch.push(local(x, y1 - 0.1, porchZ));
    }
    // balcony floor and railing
    if (h.balcony) {
      kit.add('plank', mbox(w + 0.3, 0.16, pd + 0.2), mul(W, M(0, y1 + 0.08, d / 2 + pd / 2)), { burn, vis: 3, color: 0.6 });
      kit.add('timber', mbox(w + 0.3, 0.12, 0.12), mul(W, M(0, y1 + 1.05, porchZ + 0.05)), { burn, vis: 3, color: 0.5 });
      kit.add('timber', mbox(w + 0.3, 0.08, 0.1), mul(W, M(0, y1 + 0.45, porchZ + 0.05)), { burn, vis: 3, color: 0.5 });
      for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.32) kit.add('timber', mbox(0.05, 0.9, 0.05), mul(W, M(x, y1 + 0.6, porchZ + 0.05)), { burn, vis: 3, color: 0.48 });
      // lean-to over the porch below the balcony is the balcony itself; add a short drip eave
      const r = roofGeometry({ L: w, D: 0.01, H: 0.3, ox: 0.45, ozF: 0.7, ozB: 0.001, lift: 0.3, segV: 5, lean: true });
      const LW = mul(W, M(0, y1 + 0.05, d / 2 + pd + 0.05));
      kit.add('roof', r.top, LW, { burn, vis: 3 });
      kit.add('roofUnder', r.under, LW, { burn, vis: 3, color: 0.5 });
    }
    // second floor
    const w2 = w - 0.4, d2 = d - 0.4, ya = y1 + 0.16, yb = ya + H2;
    for (const z of [-d2 / 2, d2 / 2]) for (const x of along(w2)) kit.add('timber', mbox(0.24, H2, 0.24), mul(W, M(x, ya + H2 / 2, z)), { burn, vis: 3, color: 0.6 });
    for (const x of [-w2 / 2, w2 / 2]) for (const z of along(d2).slice(1, -1)) kit.add('timber', mbox(0.24, H2, 0.24), mul(W, M(x, ya + H2 / 2, z)), { burn, vis: 3, color: 0.6 });
    // lattice facade on the front, plaster elsewhere
    const bays = along(w2);
    for (let i = 0; i < bays.length - 1; i++) {
      const cx = (bays[i] + bays[i + 1]) / 2, bw = bays[i + 1] - bays[i] - 0.3;
      addWindow(kit, mul(W, M(cx, ya + H2 * 0.55, d2 / 2)), bw, H2 * 0.62, burn, 3);
      kit.add('plank', mbox(bw + 0.3, H2 * 0.22, 0.1), mul(W, M(cx, ya + H2 * 0.11, d2 / 2)), { burn, vis: 3, color: 0.7 });
      kit.add('plank', mbox(bw + 0.3, H2 * 0.14, 0.1), mul(W, M(cx, yb - H2 * 0.07, d2 / 2)), { burn, vis: 3, color: 0.7 });
    }
    for (const p of wallPanels(w2, H2, [])) kit.add('plaster', p.geo, mul(W, M(p.x - w2 / 2, ya + p.y, -d2 / 2, Math.PI)), { burn, vis: 3 });
    for (const sx of [-1, 1]) for (const p of wallPanels(d2, H2, [{ x0: d2 / 2 - 0.5, x1: d2 / 2 + 0.5, y0: 0.9, y1: 1.7 }])) kit.add('plaster', p.geo, mul(W, M(sx * w2 / 2, ya + p.y, p.x - d2 / 2, sx * Math.PI / 2)), { burn, vis: 3 });
    kit.add('timber', mbox(w2 + 0.4, 0.28, 0.26), mul(W, M(0, yb - 0.14, d2 / 2)), { burn, vis: 3, color: 0.55 });
    kit.add('timber', mbox(w2 + 0.4, 0.28, 0.26), mul(W, M(0, yb - 0.14, -d2 / 2)), { burn, vis: 3, color: 0.55 });
    const Hd = 0.34 * d2 + 0.45;
    const ridgeY = yb + 0.14 + Hd;
    const cfg = { L: w2 + 0.2, D: d2, H: Hd, ox: 1.0, ozF: 1.25, ozB: 1.1, lift: 0.7 };
    mainRoof = addRoof(kit, mul(W, M(0, ridgeY, 0)), cfg, { burn, vis: roofVis });
    if (collapse) addRoof(kit, mul(W, M(0, ridgeY, 0)), cfg, { burn, vis: 6, hole: (u, v, s) => s > 0 && Math.hypot((u - collapse.u) * 1.6, v - collapse.v) < collapse.r });
    for (const sx of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(-d2 / 2, 0);
      for (let k = 0; k <= 12; k++) { const z = -d2 / 2 + (k / 12) * d2; shape.lineTo(z, Hd - Hd * roofDrop(Math.abs(z) / (d2 / 2)) + 0.02); }
      shape.lineTo(d2 / 2, 0);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
      g.translate(0, 0, -0.07);
      kit.add('plaster', g, mul(W, M(sx * w2 / 2, yb, 0, Math.PI / 2)), { burn, vis: 3, color: [0.95, 0.93, 0.9] });
    }
    roofTop = ridgeY;
    anchors.eave = () => y1 - 0.05;
    anchors.upper = local(0, ya + 1.2, d2 / 2 + 0.4);
  }

  // --- sign board above the door
  // (on a house of one floor, between the door's head and the eave: its top inside the roof's thickness, never through
  // it; the roof comes down to y1 at the wall and lower beyond, and a full-height board stood up out of the tiles)
  if (h.sign && SIGN_CELLS[h.sign] !== undefined) {
    const g = tall ? signGeometry(SIGN_CELLS[h.sign], 1.9, 0.95) : signGeometry(SIGN_CELLS[h.sign], 1.6, 0.8);
    const sy = tall ? y1 + 0.75 : y1 - 0.38;
    const sz = tall ? d / 2 + pd + 0.12 : d / 2 + 0.2;
    kit.add('sign', g, mul(W, M(0, sy, sz, 0, -0.12)), { burn: burn * 0.9, vis: 3 });
  }

  // --- fire points (world) used by the fire system at night
  const fp = (x, y, z, s) => anchors.fire.push({ p: local(x, y, z), s });
  const top = roofTop;
  for (let i = 0; i < 5; i++) fp(lerp(-w / 2, w / 2, (i + 0.5) / 5) + rand.range(-0.6, 0.6), top - rand.range(0.2, 1.2), rand.range(-d / 3, d / 3), rand.range(1.8, 3.2));
  fp(rand.range(-w / 3, w / 3), y0 + 1.2, d / 2 + 0.4, 1.6);
  for (const x of winX) fp(x, y0 + 1.6, d / 2 + 0.35, 1.2);
  fp(-w / 2 - 0.2, y0 + 2.0, rand.range(-d / 3, d / 3), 1.6);
  fp(w / 2 + 0.2, y0 + 2.2, rand.range(-d / 3, d / 3), 1.6);
  anchors.roofTop = local(0, top, 0);
  anchors.center = local(0, y0 + 1.5, 0);
  anchors.porchFront = local(0, y0, d / 2 + pd);
  anchors.mainRoof = mainRoof;
  return anchors;
}

// Open guard pavilion: the garrison's post, deserted at night.
function buildPavilion(kit, h, W, anchors, burn, rand) {
  const { w, d, plat } = h;
  const y0 = plat, H = 3.0, y1 = y0 + H;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kit.add('lacquer', mcyl(0.15, 0.17, H, 12), mul(W, M(sx * (w / 2 - 0.5), y0 + H / 2, sz * (d / 2 - 0.4))), { burn, vis: 0, color: [0.45, 0.1, 0.07] });
    kit.add('stone', mcyl(0.25, 0.28, 0.24, 10), mul(W, M(sx * (w / 2 - 0.5), y0 + 0.12, sz * (d / 2 - 0.4))), { vis: 0 });
  }
  for (const sz of [-1, 1]) kit.add('lacquer', mbox(w - 0.6, 0.26, 0.24), mul(W, M(0, y1 - 0.1, sz * (d / 2 - 0.4))), { burn, vis: 3, color: [0.42, 0.1, 0.07] });
  for (const sx of [-1, 1]) kit.add('lacquer', mbox(0.24, 0.26, d - 0.5), mul(W, M(sx * (w / 2 - 0.5), y1 - 0.1, 0)), { burn, vis: 3, color: [0.42, 0.1, 0.07] });
  const Hd = 1.6;
  addRoof(kit, mul(W, M(0, y1 + 0.1 + Hd, 0)), { L: w - 1.0, D: d - 0.8, H: Hd, ox: 1.0, ozF: 1.0, ozB: 1.0, lift: 0.8 }, { burn, vis: 3 });
  // the captain's desk and the glowing crystal (the order to withdraw)
  kit.add('timber', mbox(1.8, 0.08, 0.9), mul(W, M(0, y0 + 0.82, -0.6)), { burn, vis: 3, color: 0.55 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', mbox(0.08, 0.8, 0.08), mul(W, M(sx * 0.8, y0 + 0.4, -0.6 + sz * 0.38)), { burn, vis: 3, color: 0.5 });
  kit.add('glow', new THREE.OctahedronGeometry(0.11, 0), mul(W, M(0.4, y0 + 0.99, -0.6, 0.3, 0, 0, 1, 1.6, 1)), { vis: 0, color: [0.35, 0.95, 0.9] });
  kit.add('sign', signGeometry(SIGN_CELLS['守'], 1.5, 0.75), mul(W, M(0, y1 + 0.35, d / 2 - 0.25)), { burn, vis: 3 });
  // weapon rack, emptied
  kit.add('timber', mbox(1.6, 0.1, 0.1), mul(W, M(-w / 2 + 1.0, y0 + 1.6, -d / 2 + 0.6)), { burn, vis: 3, color: 0.5 });
  kit.add('timber', mbox(1.6, 0.1, 0.1), mul(W, M(-w / 2 + 1.0, y0 + 0.4, -d / 2 + 0.6)), { burn, vis: 3, color: 0.5 });
  anchors.crystal = new THREE.Vector3(0.4, y0 + 1.0, -0.6).applyMatrix4(W);
  anchors.fire.push({ p: new THREE.Vector3(0, y1 + 1.0, 0).applyMatrix4(W), s: 2.4 });
  anchors.center = new THREE.Vector3(0, y0 + 1.5, 0).applyMatrix4(W);
  anchors.roofTop = new THREE.Vector3(0, y1 + Hd, 0).applyMatrix4(W);
  anchors.porch = [];
  anchors.frame = { w, d, pd: 0.6, plat, y1, H1: H, tall: false };
  return anchors;
}

// Plane mapped onto a cell of the runtime sign atlas.
export function signGeometry(cell, w, h) {
  const { W, H, cw, ch } = SIGNS;
  const col = cell % 2, row = Math.floor(cell / 2);
  const u0 = (col * cw) / W, u1 = ((col + 1) * cw) / W, v1 = 1 - (row * ch) / H, v0 = 1 - ((row + 1) * ch) / H;
  const g = new THREE.BoxGeometry(w, h, 0.08);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    if (face === 4) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
    else uv.setXY(i, u0 + 0.01, v0 + 0.01);
  }
  return g;
}

// The paifang gate at the north end of the street.
export function buildGate(kit, x, y, z, rotY = 0) {
  const W = M(x, y, z, rotY);
  const red = [0.5, 0.12, 0.08];
  const posts = [[-2.7, 6.2], [2.7, 6.2], [-4.9, 4.6], [4.9, 4.6]];
  for (const [px, ph] of posts) {
    kit.add('lacquer', mcyl(0.2, 0.22, ph, 12), mul(W, M(px, ph / 2, 0)), { burn: 0.7, vis: 0, color: red });
    kit.add('stone', mbox(0.75, 0.9, 0.75), mul(W, M(px, 0.45, 0)), { vis: 0 });
    kit.add('stone', mbox(0.3, 0.8, 1.6), mul(W, M(px, 0.55, 0)), { vis: 0, color: 0.9 });
  }
  kit.add('lacquer', mbox(6.0, 0.36, 0.34), mul(W, M(0, 5.1, 0)), { burn: 0.7, vis: 3, color: red });
  kit.add('lacquer', mbox(6.0, 0.3, 0.3), mul(W, M(0, 3.75, 0)), { burn: 0.7, vis: 3, color: red });
  kit.add('sign', signGeometry(SIGN_CELLS.gate, 2.8, 1.05), mul(W, M(0, 4.45, 0.12)), { burn: 0.5, vis: 3 });
  kit.add('sign', signGeometry(SIGN_CELLS.gate, 2.8, 1.05), mul(W, M(0, 4.45, -0.12, Math.PI)), { burn: 0.5, vis: 3 });
  for (const sx of [-1, 1]) kit.add('lacquer', mbox(2.4, 0.26, 0.28), mul(W, M(sx * 3.8, 3.6, 0)), { burn: 0.7, vis: 3, color: red });
  addRoof(kit, mul(W, M(0, 7.2, 0)), { L: 5.6, D: 1.2, H: 0.75, ox: 0.6, ozF: 0.8, ozB: 0.8, lift: 0.6, segU: 18, segV: 6 }, { burn: 0.6, vis: 3 });
  for (const sx of [-1, 1]) addRoof(kit, mul(W, M(sx * 3.8, 5.25, 0)), { L: 2.2, D: 1.0, H: 0.55, ox: 0.4, ozF: 0.6, ozB: 0.6, lift: 0.5, segU: 10, segV: 5 }, { burn: 0.6, vis: 3 });
  return { center: new THREE.Vector3(0, 4, 0).applyMatrix4(W), fire: [{ p: new THREE.Vector3(-2, 6.8, 0).applyMatrix4(W), s: 1.8 }, { p: new THREE.Vector3(1.5, 6.9, 0).applyMatrix4(W), s: 1.6 }] };
}

// The stone bridge over the river: one high arch (a moon bridge), its body of dressed stone with the voussoirs picked
// out round the arch, stepped up and over the hump, carved balustrades with capped posts, wing walls into the banks and
// lanterns at its ends. Local frame: z along the road (the span), x across, y up from the water. Returns the deck's
// height along the road (local z → y) for whoever walks over it.
export const BRIDGE = { R: 9.6, rise: 4.6, width: 4.4, approach: 3.6 };
export function bridgeProfile(wy) {
  const { R, rise, approach } = BRIDGE;
  const yc = wy + rise - R;                                      // the arch's centre, below the water
  const half = Math.sqrt(R * R - (wy + 0.15 - yc) ** 2);          // where it springs, just above the water
  const L = half + approach;                                       // the deck runs out this far either side
  const top = wy + rise + 0.95;
  return { yc, half, L, top };
}
export function buildBridge(kit, x, y, z, rotY, endA, endB, wy) {
  const W = M(x, 0, z, rotY);
  const { R, width } = BRIDGE;
  const P = bridgeProfile(wy);
  const { yc, half, L, top } = P;
  // the deck: a hump of shallow steps from the road at either end (local -z: endA, +z: endB) up over the crown
  const deckY = zz => { const t = Math.min(1, Math.abs(zz) / L), b = lerp(endA, endB, Math.min(1, Math.max(0, (zz + L) / (2 * L)))); return b + (top - b) * Math.pow(1 - t * t, 0.8); };
  const endY = Math.min(endA, endB);
  const STEP = 0.2;
  const outline = [];
  const zs = [];
  for (let zz = -L; zz <= L + 1e-6; zz += 0.05) zs.push(zz);
  // (stepped: the height held, then up by a riser)
  let last = null;
  for (const zz of zs) {
    const h = Math.round(deckY(zz) / STEP) * STEP;
    if (last === null) outline.push([zz, h]);
    else if (h !== last) { outline.push([zz, last], [zz, h]); }
    last = h;
  }
  outline.push([L, last]);
  const bottom = wy - 1.4;
  const shape = new THREE.Shape();
  shape.moveTo(-L, bottom);
  for (const [zz, h] of outline) shape.lineTo(zz, h);
  shape.lineTo(L, bottom);
  shape.lineTo(half + 0.2, bottom);
  // the arch's opening
  const a0 = Math.acos(Math.min(1, half / R));
  for (let i = 0; i <= 48; i++) {
    const a = a0 + (Math.PI - 2 * a0) * (i / 48);
    shape.lineTo(Math.cos(a) * R, yc + Math.sin(a) * R);
  }
  shape.lineTo(-half - 0.2, bottom);
  shape.lineTo(-L, bottom);
  const body = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1, steps: 1 });
  // (shape x is our z, extrusion is across: turn it so z runs along the road, x across)
  // (turned the other way, the shape's x had come out as -z: the deck was its own mirror image, a metre higher than
  // deckY at the end on the village side and a metre lower at the other, while his feet, the balustrade and the lens
  // all keep to deckY: running down its last steps he was waist deep in them, only his head over their edges)
  body.rotateY(-Math.PI / 2);
  body.translate(width / 2, 0, 0);
  kit.add('stone', body, W, { vis: 0, color: [0.92, 0.9, 0.86] });
  // the voussoirs: dressed blocks round the arch on both faces, a little proud of the wall
  const NV = 27;
  for (const sx of [-1, 1]) for (let i = 0; i < NV; i++) {
    const a = a0 + (Math.PI - 2 * a0) * ((i + 0.5) / NV);
    const rr = R + 0.36;
    const bx = Math.cos(a) * rr, by = yc + Math.sin(a) * rr;
    const len = (Math.PI - 2 * a0) / NV * R * 0.96;
    const key = i === (NV - 1) / 2 ? 1.12 : 1;
    kit.add('stone', mbox(0.16, 0.8 * key, len), mul(W, M(sx * (width / 2 + 0.06), by, bx, 0, -(a - Math.PI / 2))), { vis: 0, color: (i % 2 ? [0.82, 0.8, 0.76] : [0.74, 0.72, 0.69]) });
  }
  // a string course along the deck edge, and the balustrade above it
  const NP = Math.round(L * 2 / 1.45);
  const post = (zz, big) => {
    const h = deckY(zz), ph = big ? 1.3 : 1.02;
    for (const sx of [-1, 1]) {
      const px = sx * (width / 2 - 0.16);
      kit.add('stone', mbox(big ? 0.4 : 0.24, ph, big ? 0.4 : 0.24), mul(W, M(px, h + ph / 2, zz)), { vis: 0, color: [0.95, 0.94, 0.9] });
      // (capped: a lotus bud on the posts, a lion's ball on the end posts)
      kit.add('stone', mcyl(big ? 0.25 : 0.15, big ? 0.22 : 0.13, 0.08, 10), mul(W, M(px, h + ph + 0.04, zz)), { vis: 0, color: 0.95 });
      const bud = new THREE.SphereGeometry(big ? 0.21 : 0.12, 10, 7);
      bud.scale(1, big ? 1 : 1.35, 1);
      kit.add('stone', bud, mul(W, M(px, h + ph + (big ? 0.27 : 0.2), zz)), { vis: 0, color: 0.97 });
    }
  };
  for (let i = 0; i <= NP; i++) {
    const zz = -L + 0.3 + (L * 2 - 0.6) * (i / NP);
    post(zz, i === 0 || i === NP);
    if (i < NP) {
      const z1 = -L + 0.3 + (L * 2 - 0.6) * ((i + 1) / NP), zm = (zz + z1) / 2;
      const h0 = deckY(zz), h1 = deckY(z1), hm = (h0 + h1) / 2, tilt = Math.atan2(h1 - h0, z1 - zz);
      const len = Math.hypot(z1 - zz, h1 - h0) - 0.22;
      for (const sx of [-1, 1]) {
        const px = sx * (width / 2 - 0.16);
        // the panel with its carved frame, and the rail along the top
        kit.add('stone', mbox(0.09, 0.62, len), mul(W, M(px, hm + 0.42, zm, 0, -tilt)), { vis: 0, color: [0.9, 0.89, 0.85] });
        kit.add('stone', mbox(0.13, 0.07, len * 0.8), mul(W, M(px, hm + 0.42, zm, 0, -tilt)), { vis: 0, color: [0.8, 0.79, 0.75] });
        kit.add('stone', mbox(0.17, 0.12, len + 0.1), mul(W, M(px, hm + 0.86, zm, 0, -tilt)), { vis: 0, color: [0.97, 0.96, 0.92] });
        kit.add('stone', mbox(0.26, 0.12, len + 0.2), mul(W, M(sx * (width / 2 + 0.04), hm - 0.02, zm, 0, -tilt)), { vis: 0, color: [0.8, 0.78, 0.74] });
      }
    }
  }
  // wing walls splaying into the banks
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const wz = sz * (L - 0.6), wx = sx * (width / 2 + 1.0), ey = sz < 0 ? endA : endB;
    kit.add('stone', mbox(0.6, 2.6, 3.0), mul(W, M(wx, ey - 0.9, wz, sx * sz * 0.5)), { vis: 0, color: [0.86, 0.84, 0.8] });
  }
  // lanterns on tall posts at both ends
  const lamps = [];
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const lz = sz * (L + 0.7), lx = sx * (width / 2 + 0.55), ey = sz < 0 ? endA : endB;
    kit.add('stone', mbox(0.5, 0.35, 0.5), mul(W, M(lx, ey + 0.17, lz)), { vis: 0, color: 0.85 });
    kit.add('lacquer', mcyl(0.07, 0.08, 3.1, 8), mul(W, M(lx, ey + 1.85, lz)), { vis: 0, color: [0.32, 0.1, 0.07], burn: 0.6 });
    kit.add('lacquer', mbox(0.95, 0.08, 0.1), mul(W, M(lx - sx * 0.3, ey + 3.3, lz)), { vis: 0, color: [0.32, 0.1, 0.07], burn: 0.6 });
    lamps.push(new THREE.Vector3(lx - sx * 0.62, ey + 3.3, lz).applyMatrix4(W));
  }
  const toLocal = new THREE.Matrix4().copy(W).invert();
  return { deckY, L, top, W, toLocal, lamps };
}
