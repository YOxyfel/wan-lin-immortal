// Geometry kit: metre-scaled primitives and a merge bucket that carries burn/visibility flags per vertex.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export function M(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
export const mul = (...ms) => ms.reduce((a, b) => a.clone().multiply(b));

// Box whose UVs are in metres (so textures keep real-world scale on every face).
export function mbox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
  }
  return g;
}

export function mcyl(rt, rb, h, seg = 10, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv, circ = Math.PI * (rt + rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
  return g;
}

export function msphere(r, ws = 10, hs = 8) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * Math.PI * r);
  return g;
}

// Plane in XY facing +Z with metre UVs.
export function mplane(w, h, sx = 1, sy = 1) {
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}

// Tube along a list of points.
export function tube(points, radius = 0.1, radial = 6, tubular = 12, taper = 0) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, tubular, radius, radial, false);
  if (taper) {
    const pos = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i <= tubular; i++) {
      const t = i / tubular, c = curve.getPointAt(t), s = 1 - taper * t;
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * s, c.y + (pos.getY(k) - c.y) * s, c.z + (pos.getZ(k) - c.z) * s);
      }
    }
    g.computeVertexNormals();
  }
  const uv = g.attributes.uv, len = curve.getLength();
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * Math.PI * 2 * radius);
  return g;
}

const KEEP = ['position', 'normal', 'uv', 'color', 'aBurn', 'aVis', 'aSway'];

// Collects geometry per material key and merges it into one mesh per key.
export class Kit {
  constructor() { this.parts = new Map(); this.count = 0; this.forceVis = null; this.cell = 48; }
  add(key, geometry, matrix, { color = null, burn = 0, vis = 0, sway = 0 } = {}) {
    if (this.forceVis != null) vis = this.forceVis;
    const g = geometry.clone();
    const n = g.attributes.position.count;
    // wind weight is evaluated in the part's local space, before placement
    if (!g.attributes.aSway) {
      const as = new Float32Array(n);
      if (typeof sway === 'function') { const p = g.attributes.position; for (let i = 0; i < n; i++) as[i] = sway(p.getX(i), p.getY(i), p.getZ(i)); }
      else as.fill(sway);
      g.setAttribute('aSway', new THREE.BufferAttribute(as, 1));
    }
    if (matrix) g.applyMatrix4(matrix);
    if (!g.index) {
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    const col = new Float32Array(n * 3);
    const src = g.attributes.color;
    const c = color ? (color.isColor ? color : new THREE.Color(...(Array.isArray(color) ? color : [color, color, color]))) : null;
    for (let i = 0; i < n; i++) {
      let r = src ? src.getX(i) : 1, gg = src ? src.getY(i) : 1, b = src ? src.getZ(i) : 1;
      if (c) { r *= c.r; gg *= c.g; b *= c.b; }
      col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aBurn', new THREE.BufferAttribute(new Float32Array(n).fill(burn), 1));
    g.setAttribute('aVis', new THREE.BufferAttribute(new Float32Array(n).fill(vis), 1));
    for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name);
    g.morphAttributes = {};
    g.clearGroups();
    // bucket by material and by 48 m world cell so each chunk can be frustum-culled
    g.computeBoundingBox();
    const ctr = g.boundingBox.getCenter(new THREE.Vector3());
    const big = g.boundingBox.getSize(new THREE.Vector3()).length() > 120;
    const cell = big ? 'all' : `${Math.floor(ctr.x / this.cell)},${Math.floor(ctr.z / this.cell)}`;
    const bucket = key + '|' + cell;
    if (!this.parts.has(bucket)) this.parts.set(bucket, []);
    this.parts.get(bucket).push(g);
    this.count += n;
    return this;
  }
  build(materials, { shadows = true } = {}) {
    const meshes = [];
    for (const [bucket, list] of this.parts) {
      const key = bucket.split('|')[0];
      const material = materials[key];
      if (!material) { console.warn('missing material', key); continue; }
      const geo = mergeGeometries(list, false);
      list.forEach(g => g.dispose());
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = bucket;
      mesh.castShadow = shadows && !material.transparent && key !== 'water';
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}
