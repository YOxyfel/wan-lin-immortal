// Ground-level flora: forest floor, mossy rocks, ferns, undergrowth (soft grass tufts, shrubs, moss cushions,
// clover), fallen leaves and stepping stones. Repeats are InstancedMesh; materials react to the season uniforms.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeoBuf, card, gridNormals, gridIndex, fbm3, noise3, rng, clamp, lerp, smooth, V3, TAU, U, meshOf, instancedOf } from './flora-core.js';
import { floraMaterials } from './flora-mats.js';
import { floorTex, mossTex, cellRect } from './flora-tex.js';

// ------------------------------------------------------------------ forest floor
// One shared material: humus/needles/twigs, moss carpets, packed-earth paths, autumn leaf colour, snow on flats,
// rain darkening, rock on steep ground (world triplanar), a quiet dark tone far away.
// Geometry attribute aMask = [path, moss, litter, rockBias] (0..1 each).
let _floorMat = null;
export function floorMaterial() {
  if (_floorMat) return _floorMat;
  const M = floraMaterials();
  const fl = floorTex(), moss = mossTex();
  const uni = {
    tFloor: { value: fl.map }, tFloorN: { value: fl.normal }, tMossF: { value: moss }, tRock: { value: M.textures.rock.map },
    uMossA: { value: new THREE.Color(0x98a440) }, uMossB: { value: new THREE.Color(0x40521c) },
    uPathC: { value: new THREE.Color(0x6e5b44) }, uFloorScale: { value: 1 / 3.2 }, uFarDark: { value: 0.9 },
  };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMask; varying vec4 vMask; varying vec3 vFW; varying vec3 vFN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask; vFW = (modelMatrix*vec4(transformed,1.)).xyz; vFN = normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vMask; varying vec3 vFW; varying vec3 vFN;
uniform sampler2D tFloor, tFloorN, tMossF, tRock, uNoise; uniform vec3 uMossA, uMossB, uPathC; uniform float uFloorScale, uFarDark;
uniform float uSnow, uAutumn, uWet, uMoss, uTime;
float flSnowF = 0., flMossF = 0., flRockF = 0.;`)
      .replace('#include <map_fragment>', `
vec2 wp = vFW.xz;
float n1 = texture2D(uNoise, wp*.017).r, n2 = texture2D(uNoise, wp*.071).g, n3 = texture2D(uNoise, wp*.29).a, n4 = texture2D(uNoise, wp*.0043 + .5).b;
float n5 = texture2D(uNoise, wp*.53 + .2).r, n6 = texture2D(uNoise, wp*1.7 + .7).g;
vec2 wr = mat2(.8, -.6, .6, .8)*wp;
float n7 = texture2D(uNoise, wr*.043 + .61).r;
vec3 fc = mix(texture2D(tFloor, wp*uFloorScale).rgb, texture2D(tFloor, wr*uFloorScale*.71 + .37).rgb, smoothstep(.35, .65, n2));
fc = mix(fc, texture2D(tFloor, wp*uFloorScale*.23 + .3).rgb, .3);
fc *= mix(.72, 1.12, n1)*mix(.85, 1.08, n4);
float flFar = smoothstep(30., 110., length(vFW.xz - cameraPosition.xz));
fc = mix(fc, vec3(.075, .07, .04)*mix(.75, 1.25, n1), flFar*uFarDark);
vec3 mt = texture2D(tMossF, wr*1.37).rgb;
vec3 mossC = mix(uMossB, uMossA, smoothstep(.2, .8, n2*.5 + mt.g*.4 + n6*.2 - .05))*(.78 + mt.r*.32);
flMossF = uMoss*smoothstep(.56, .76, n1*.35 + n7*.45 + n2*.2 + vMask.y*.7 - .22 + (n5 - .5)*.1 + (n6 - .5)*.06);
vec3 col = mix(fc, mossC, flMossF);
float pathK = smoothstep(.15, .6, vMask.x + (n3 - .5)*.35);
vec3 pathC = uPathC*(.75 + .45*n3)*mix(.85, 1.1, n2);
col = mix(col, pathC*mix(vec3(1.), fc*2.2, .5), pathK);
vec3 lit = mix(vec3(.42, .07, .025), vec3(.78, .3, .05), smoothstep(.3, .8, n3))*(.65 + .5*n2);
lit = mix(lit, vec3(.62, .45, .12), step(.75, fract(n3*7.)));
float litK = (uAutumn*.55 + .1)*smoothstep(.5, .75, n7*.5 + n3*.35 + n6*.12 + vMask.z*.4 - .1)*(1. - flMossF*.8)*(1. - pathK*.6);
col = mix(col, lit*mix(vec3(.55, .45, .35), vec3(1.), uAutumn), litK*(1. - flFar*.85));
// steep ground is rock (world triplanar), with moss settling on its ledges
vec3 flFN = normalize(vFN);
float flSlope = 1. - clamp(flFN.y, 0., 1.);
flRockF = smoothstep(.3, .52, flSlope + (n3 - .5)*.22 + vMask.w*.4);
vec2 flTW = pow(abs(flFN.xz) + 1e-3, vec2(4.)); flTW /= flTW.x + flTW.y;
vec3 rk = texture2D(tRock, vFW.zy*.31).rgb*flTW.x + texture2D(tRock, vFW.xy*.31).rgb*flTW.y;
rk *= mix(.75, 1.1, n2);
rk = mix(rk, mossC*.9, uMoss*smoothstep(.55, .8, n5*.5 + n7*.4 + (1. - flSlope)*.35)*.8);
col = mix(col, rk, flRockF);
col *= 1. - uWet*.36;
flSnowF = uSnow*smoothstep(.2, .55, flFN.y*.8 + n1*.35 - .05 + n4*.2 - flRockF*.5);
col = mix(col, vec3(.9, .92, .96)*(.92 + .08*n2), flSnowF);
diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .38, uWet*(1. - flSnowF));')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 tn = texture2D(tFloorN, vFW.xz*uFloorScale).xyz*2. - 1.;
  float k = 1.1*(1. - flSnowF*.8)*(1. - flMossF*.5)*(1. - flRockF*.6);
  vec3 wn = normalize(normalize(vFN) + vec3(tn.x, 0., tn.y)*k);
  normal = normalize((viewMatrix*vec4(wn, 0.)).xyz);
}`);
  };
  mat.customProgramCacheKey = () => 'flora-floor2';
  mat.userData.uniforms = uni;
  _floorMat = mat;
  return mat;
}

// A terrain tile: (nx x nz) cells over [x0,x1]x[z0,z1]; normals from a padded height grid (seamless across tiles),
// optional skirt (hides cracks against coarser neighbours) and a cell filter keep(x,z) for holes.
export function terrainGeometry(x0, z0, x1, z1, nx, nz, heightAt, mask, { skirt = 0, keep = null, yOff = 0 } = {}) {
  const dx = (x1 - x0) / nx, dz = (z1 - z0) / nz, W = nx + 3;
  const H = new Float32Array((nx + 3) * (nz + 3));
  for (let j = -1; j <= nz + 1; j++) for (let i = -1; i <= nx + 1; i++) H[(j + 1) * W + (i + 1)] = heightAt(x0 + i * dx, z0 + j * dz);
  const nv = (nx + 1) * (nz + 1);
  const pos = [], nor = [], msk = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * dx, z = z0 + j * dz, k = (j + 1) * W + (i + 1);
    pos.push(x, H[k] + yOff, z);
    const gx = (H[k + 1] - H[k - 1]) / (2 * dx), gz = (H[k + W] - H[k - W]) / (2 * dz);
    const l = Math.hypot(gx, 1, gz);
    nor.push(-gx / l, 1 / l, -gz / l);
    const m = mask ? mask(x, z) : [0, 0.5, 0.5, 0];
    msk.push(m[0], m[1], m[2], m[3] || 0);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (keep && !keep(x0 + (i + 0.5) * dx, z0 + (j + 0.5) * dz)) continue;
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  if (skirt > 0) {
    // a vertical curtain under the outer border
    const ring = [];
    for (let i = 0; i <= nx; i++) ring.push(i);
    for (let j = 1; j <= nz; j++) ring.push(j * (nx + 1) + nx);
    for (let i = nx - 1; i >= 0; i--) ring.push(nz * (nx + 1) + i);
    for (let j = nz - 1; j >= 0; j--) ring.push(j * (nx + 1));
    const base = pos.length / 3;
    for (const v of ring) { pos.push(pos[v * 3], pos[v * 3 + 1] - skirt, pos[v * 3 + 2]); nor.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); msk.push(msk[v * 4], msk[v * 4 + 1], msk[v * 4 + 2], msk[v * 4 + 3]); }
    for (let k = 0; k < ring.length - 1; k++) { const a = ring[k], b = ring[k + 1], c = base + k, d = base + k + 1; idx.push(a, c, b, b, c, d, a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aMask', new THREE.Float32BufferAttribute(msk, 4));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

// opts: { size, segments, center:[x,z], heightAt(x,z), mask(x,z) -> [path, moss, litter, rock], focus:[x,z], warp }
export function createForestFloor(opts = {}) {
  const o = { size: 200, segments: 200, center: [0, 0], heightAt: () => 0, mask: null, focus: null, warp: 1.7, ...opts };
  const N = o.segments, half = o.size / 2;
  const [cx, cz] = o.center;
  const [fx, fz] = o.focus || o.center;
  const axis = (i, c, f) => { const t = i / N * 2 - 1; const w = Math.sign(t) * Math.pow(Math.abs(t), o.warp); return c + w * half + (f - c) * (1 - Math.abs(w)); };
  const pos = new Float32Array((N + 1) * (N + 1) * 3), mask = new Float32Array((N + 1) * (N + 1) * 4);
  let k = 0;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++, k++) {
    const x = axis(i, cx, fx), z = axis(j, cz, fz);
    pos[k * 3] = x; pos[k * 3 + 1] = o.heightAt(x, z); pos[k * 3 + 2] = z;
    const m = o.mask ? o.mask(x, z) : [0, 0.5, 0.5, 0];
    mask.set([m[0], m[1], m[2], m[3] || 0], k * 4);
  }
  const idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = floorMaterial();
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'forestFloor';
  mesh.userData.uniforms = mat.userData.uniforms;
  return { mesh, heightAt: o.heightAt, material: mat };
}

// ------------------------------------------------------------------ rocks
// Noise-displaced, facet-cut boulders. shape: 'round' | 'boulder' | 'slab' | 'flat' (stepping stone)
export function rockGeometry(seed = 1, shape = 'boulder', detail = 14) {
  const r = rng(seed);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const off = [r() * 50, r() * 50, r() * 50];
  const cuts = [];
  const nc = shape === 'round' ? 2 : 5;
  for (let i = 0; i < nc; i++) { const n = V3(r() - 0.5, (r() - 0.5) * (shape === 'slab' || shape === 'flat' ? 0.4 : 1), r() - 0.5).normalize(); cuts.push({ n, d: 0.62 + r() * 0.3 }); }
  const col = new Float32Array(p.count * 3), v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const w = fbm3(v.x * 0.8 + off[0], v.y * 0.8 + off[1], v.z * 0.8 + off[2], 2) * 0.5;
    let k = 1 + 0.28 * fbm3(v.x * 1.3 + off[0] + w, v.y * 1.3 + off[1], v.z * 1.3 + off[2] - w, 4);
    k += 0.06 * (1 - Math.abs(noise3(v.x * 4 + off[1], v.y * 4, v.z * 4))) - 0.03;
    if (shape === 'round') k = 1 + (k - 1) * 0.6;
    v.multiplyScalar(k);
    for (const c of cuts) { const dd = v.dot(c.n) - c.d; if (dd > 0) v.addScaledVector(c.n, -dd * 0.85); }
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.4;
    if (shape === 'slab') { v.y *= 0.42; v.y += 0.025 * Math.sin(v.y * 40 + noise3(v.x * 2, 0, v.z * 2) * 3); }
    if (shape === 'flat') { v.y = v.y * 0.22 + 0.04; v.x *= 1.0; }
    p.setXYZ(i, v.x, v.y, v.z);
    const ao = clamp(0.55 + (k - 0.9) * 1.6) * (0.55 + 0.45 * smooth(-0.25, 0.35, v.y));
    col.set([ao, ao, ao], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const n = p.count;
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aRnd', new THREE.BufferAttribute(new Float32Array(n), 1));
  return g;
}

/** createMossyRock({ seed, shape, size:[x,y,z] (m), position:[x,y,z], rotationY, detail, sink }) -> Mesh */
export function createMossyRock(opts = {}) {
  const o = { seed: 3, shape: 'boulder', size: [1.6, 1.1, 1.3], position: [0, 0, 0], rotationY: 0, detail: 18, sink: 0.15, ...opts };
  const M = floraMaterials();
  const g = rockGeometry(o.seed, o.shape, o.detail);
  const m = meshOf(g, M.rock, M.depth.rock, { name: 'mossyRock' });
  m.scale.set(...o.size);
  m.position.set(o.position[0], o.position[1] + o.size[1] * (0.2 - o.sink), o.position[2]);
  m.rotation.y = o.rotationY;
  return m;
}

/**
 * createRockField(items, { variants, detail }) items: [{ x, z, y?, size:[sx,sy,sz] | s, rotY, shape }]
 * Instanced boulders (a few shape variants per shape kind). -> { group, meshes }
 */
export function createRockField(items, opts = {}) {
  const o = { variants: 3, detail: 12, groundAt: () => 0, seed: 21, ...opts };
  const M = floraMaterials();
  const r = rng(o.seed);
  const kinds = {};
  for (const it of items) {
    const shape = it.shape || 'boulder';
    if (!kinds[shape]) kinds[shape] = [];
    kinds[shape].push(it);
  }
  const group = new THREE.Group(); group.name = 'rocks';
  const meshes = [];
  for (const shape in kinds) {
    const geos = [];
    for (let v = 0; v < o.variants; v++) geos.push(rockGeometry(o.seed * 7 + v * 13 + shape.length, shape, shape === 'flat' ? 8 : o.detail));
    const lists = geos.map(() => []);
    for (const it of kinds[shape]) {
      const sz = it.size || [it.s || 1, (it.s || 1) * 0.7, (it.s || 1) * 0.85];
      const y = (it.y ?? o.groundAt(it.x, it.z)) + sz[1] * (0.2 - (it.sink ?? 0.18));
      const m = new THREE.Matrix4().compose(V3(it.x, y, it.z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.12, it.rotY ?? r() * TAU, (r() - 0.5) * 0.12)), V3(...sz));
      lists[Math.floor(r() * geos.length)].push(m);
    }
    geos.forEach((g, i) => { if (lists[i].length) { const mesh = instancedOf(g, shape === 'flat' ? M.stone : M.rock, M.depth.rock, lists[i], { name: 'rocks-' + shape + i, cast: shape !== 'flat' }); group.add(mesh); meshes.push(mesh); } });
  }
  return { group, meshes };
}

// ------------------------------------------------------------------ scatter helper
// returns [[x, z, rand], ...] inside a disc (or custom predicate), avoiding circles
export function scatter({ center = [0, 0], radius = 10, count = 100, seed = 1, avoid = [], inside = null, minDist = 0, density = null }) {
  const r = rng(seed), out = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 40) {
    const a = r() * TAU, d = Math.sqrt(r()) * radius;
    const x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d;
    if (inside && !inside(x, z)) continue;
    if (avoid.some(c => (x - c[0]) ** 2 + (z - c[1]) ** 2 < c[2] * c[2])) continue;
    if (density && r() > density(x, z)) continue;
    if (minDist > 0 && out.some(p => (p[0] - x) ** 2 + (p[1] - z) ** 2 < minDist * minDist)) continue;
    out.push([x, z, r()]);
  }
  return out;
}

// ------------------------------------------------------------------ ferns
// one fern plant: arching fronds as folded ribbons with the pinnate frond texture
function fernGeometry(seed, fronds = 9, len = 0.95) {
  const r = rng(seed), F = new GeoBuf();
  const [u0, v0, u1, v1] = cellRect('fern');
  for (let k = 0; k < fronds; k++) {
    const az = (k / fronds) * TAU + (r() - 0.5) * 0.5;
    const L = len * (0.7 + r() * 0.4);
    const elev = 1.15 + r() * 0.25, droop = 0.9 + r() * 0.5;
    const out = V3(Math.cos(az), 0, Math.sin(az)), side = V3(-out.z, 0, out.x);
    const W = L * 0.36;
    const N = 6, b0 = F.count;
    const P = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // arc: rises steeply then droops over
      const ang = elev - droop * t * 1.25;
      const prev = P.length ? P[P.length - 1] : V3(0, 0.02, 0);
      P.push(i === 0 ? prev.clone() : prev.clone().addScaledVector(out, Math.cos(ang) * L / N).add(V3(0, Math.sin(ang) * L / N, 0)));
    }
    for (let i = 0; i <= N; i++) {
      const t = i / N, c = P[i];
      const tg = P[Math.min(N, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize();
      const nrm = V3().crossVectors(side, tg).normalize();
      if (nrm.y < 0) nrm.negate();
      const fold = 0.12 * W * Math.sin(Math.PI * t);
      for (const [sx, uu] of [[-1, u0], [0, (u0 + u1) / 2], [1, u1]]) {
        const p = c.clone().addScaledVector(side, sx * W * 0.5 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1))));
        if (sx) p.y -= fold;
        const n2 = nrm.clone().addScaledVector(side, sx * 0.35).normalize().lerp(V3(0, 1, 0), 0.25).normalize();
        const sh = 0.55 + 0.45 * t;
        F.v(p.x, p.y, p.z, n2.x, n2.y, n2.z, uu, lerp(v0, v1, t), sh, sh, sh * 0.95, Math.pow(t, 1.5) * 0.7, r());
      }
      if (i) { const a = b0 + (i - 1) * 3, b = a + 3; F.t(a, b, a + 1); F.t(a + 1, b, b + 1); F.t(a + 1, b + 1, a + 2); F.t(a + 2, b + 1, b + 2); }
    }
  }
  return F.build();
}

/** createFerns(points | { center, radius, count, seed, avoid, inside }, { groundAt, scale:[min,max], variants }) */
export function createFerns(src, opts = {}) {
  const o = { groundAt: () => 0, scale: [0.6, 1.25], variants: 3, seed: 41, ...opts };
  const M = floraMaterials();
  const pts = Array.isArray(src) ? src : scatter({ seed: o.seed, ...src });
  const r = rng(o.seed);
  const geos = []; for (let v = 0; v < o.variants; v++) geos.push(fernGeometry(o.seed + v * 7, 7 + v * 2, 0.9 + v * 0.1));
  const lists = geos.map(() => []);
  for (const p of pts) {
    const s = lerp(o.scale[0], o.scale[1], p[2] ?? r());
    lists[Math.floor(r() * geos.length)].push(new THREE.Matrix4().compose(V3(p[0], o.groundAt(p[0], p[1]) - 0.03, p[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, r() * TAU, (r() - 0.5) * 0.2)), V3(s, s * (0.85 + r() * 0.3), s)));
  }
  const group = new THREE.Group(); group.name = 'ferns';
  geos.forEach((g, i) => { if (lists[i].length) group.add(instancedOf(g, M.fern, M.depth.fern, lists[i], { name: 'ferns' + i })); });
  return { group, count: pts.length };
}

// ------------------------------------------------------------------ undergrowth: soft grass tufts, shrubs, clover, moss cushions
function tuftGeometry(seed, cardsN, rectName, w, h, spread) {
  const r = rng(seed), F = new GeoBuf();
  const [u0, v0, u1, v1] = cellRect(rectName);
  for (let k = 0; k < cardsN; k++) {
    const az = (k / cardsN) * Math.PI + r() * 0.4;
    const ax = V3(Math.cos(az), 0, Math.sin(az)), out = V3(-ax.z, 0, ax.x);
    const lean = (r() - 0.5) * spread;
    const b0 = F.count;
    for (let i = 0; i <= 2; i++) {
      const t = i / 2;
      const c = out.clone().multiplyScalar(lean * t * t * h).add(V3(0, h * t * (1 - 0.15 * t), 0));
      for (const sx of [-0.5, 0.5]) {
        const p = c.clone().addScaledVector(ax, sx * w * (0.7 + 0.3 * t));
        const n = V3(p.x * 0.6, 1, p.z * 0.6).normalize();
        const sh = 0.45 + 0.55 * t;
        F.v(p.x, p.y, p.z, n.x, n.y, n.z, sx < 0 ? u0 : u1, lerp(v0, v1, t), sh, sh, sh, t * t * 0.45, r());
      }
      if (i) { const a = b0 + (i - 1) * 2; F.t(a, a + 1, a + 2); F.t(a + 1, a + 3, a + 2); }
    }
  }
  return F.build();
}
function bushGeometry(seed, n, rad, rectName) {
  const r = rng(seed), F = new GeoBuf(), rect = cellRect(rectName);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, e = r() * 0.9 + 0.1;
    const d = V3(Math.cos(a) * Math.sqrt(1 - e * e), e * 0.8, Math.sin(a) * Math.sqrt(1 - e * e)).normalize();
    const p = d.clone().multiplyScalar(rad * (0.45 + 0.5 * r())).add(V3(0, rad * 0.55, 0));
    const ay = d.clone().add(V3((r() - 0.5), 0.3, (r() - 0.5))).normalize();
    const ax = V3().crossVectors(ay, V3(0, 1, 0)).normalize();
    if (ax.lengthSq() < 0.01) ax.set(1, 0, 0);
    const size = rad * (0.8 + r() * 0.5);
    const sh = 0.5 + 0.5 * clamp(p.y / (rad * 1.4));
    card(F, p.clone().addScaledVector(ay, -size * 0.5), ax, ay, size, size, rect, d.clone().add(V3(0, 0.6, 0)).normalize(), [sh, sh, sh * 0.95], [0.1, 0.45], r());
  }
  return F.build();
}
function cushionGeometry(seed) {
  const r = rng(seed), B = new GeoBuf();
  const rows = 4, cols = 12;
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const t = i / rows, a = j / cols * TAU, rr = Math.sin(t * Math.PI / 2);
    const nn = 1 + 0.3 * noise3(Math.cos(a) * 2.2 + seed, t * 2.5, Math.sin(a) * 2.2);
    B.v(Math.cos(a) * rr * nn, (Math.cos(t * Math.PI / 2) * nn - 0.15) * 0.5, Math.sin(a) * rr * nn, Math.cos(a) * rr, 1, Math.sin(a) * rr, 0, 0, 1, 1, 1, 0, 0);
  }
  gridNormals(B, 0, rows, cols, true); gridIndex(B, 0, rows, cols);
  return B.build();
}

/**
 * createUndergrowth({ center, radius, count, seed, avoid, inside, groundAt, mix:{grass, shrub, clover, moss} })
 * -> { group } (instanced: 2 grass tufts, 2 shrubs, clover patches, moss cushions)
 */
export function createUndergrowth(opts = {}) {
  const o = { center: [0, 0], radius: 20, count: 800, seed: 61, avoid: [], inside: null, groundAt: () => 0, mix: { grass: 0.45, shrub: 0.15, clover: 0.2, moss: 0.2 }, density: null, ...opts };
  const M = floraMaterials();
  const pts = scatter({ center: o.center, radius: o.radius, count: o.count, seed: o.seed, avoid: o.avoid, inside: o.inside, density: o.density });
  const r = rng(o.seed + 1);
  const kinds = [
    ['grass', [tuftGeometry(o.seed, 4, 'grassA', 0.62, 0.5, 1.2), tuftGeometry(o.seed + 3, 3, 'grassB', 0.55, 0.42, 1.6)], M.grass, M.depth.grass, [0.6, 1.3]],
    ['shrub', [bushGeometry(o.seed + 5, 16, 0.55, 'shrub'), bushGeometry(o.seed + 6, 11, 0.42, 'broadB')], M.shrub, M.depth.shrub, [0.6, 1.5]],
    ['clover', [tuftGeometry(o.seed + 9, 3, 'clover', 0.5, 0.12, 0.2)], M.shrub, M.depth.shrub, [0.6, 1.2]],
    ['moss', [cushionGeometry(o.seed + 11), cushionGeometry(o.seed + 12)], M.mossCushion, M.depth.rock, [0.15, 0.42]],
  ];
  const total = Object.values(o.mix).reduce((a, b) => a + b, 0);
  const lists = kinds.map(k => k[1].map(() => []));
  for (const p of pts) {
    let u = r() * total, ki = 0;
    for (; ki < kinds.length - 1; ki++) { u -= o.mix[kinds[ki][0]] || 0; if (u <= 0) break; }
    const [name, geos, , , sc] = kinds[ki];
    const s = lerp(sc[0], sc[1], r());
    const y = o.groundAt(p[0], p[1]) - (name === 'moss' ? 0.02 : 0.02);
    const sy = name === 'moss' ? s * (0.25 + r() * 0.3) : s;
    lists[ki][Math.floor(r() * geos.length)].push(new THREE.Matrix4().compose(V3(p[0], y, p[1]), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), r() * TAU), V3(s, sy, s * (0.8 + r() * 0.4))));
  }
  const group = new THREE.Group(); group.name = 'undergrowth';
  const casts = o.cast || { grass: true, shrub: true, clover: false, moss: true };
  kinds.forEach(([name, geos, mat, depth], ki) => geos.forEach((g, gi) => { if (lists[ki][gi].length) group.add(instancedOf(g, mat, depth, lists[ki][gi], { name: name + gi, cast: !!casts[name] })); }));
  return { group };
}

// ------------------------------------------------------------------ fallen leaves
function leafQuad(rectName, size) {
  const F = new GeoBuf();
  const [u0, v0, u1, v1] = cellRect(rectName, 0.01);
  // a gently curled leaf: 3 x 2 vertices, the midrib raised
  for (let i = 0; i <= 1; i++) for (let j = 0; j <= 2; j++) {
    const x = (j / 2 - 0.5) * size, z = (i - 0.5) * size;
    const y = j === 1 ? size * 0.07 : 0.0;
    F.v(x, y + 0.012, z, 0, 1, 0, lerp(u0, u1, j / 2), lerp(v0, v1, i), 1, 1, 1, 0, 0);
  }
  F.t(0, 3, 1); F.t(1, 3, 4); F.t(1, 4, 2); F.t(2, 4, 5);
  return F.build();
}
/**
 * createLeafLitter(area, count, opts) area: { center, radius, avoid, inside } ; opts: { groundAt, seed, mapleShare }
 * Instanced fallen maple / broad leaves; density follows autumn, snow hides them. -> { group }
 */
export function createLeafLitter(area = {}, count = 2000, opts = {}) {
  const o = { groundAt: () => 0, seed: 77, mapleShare: 0.72, sizes: [0.15, 0.24], ...opts };
  const M = floraMaterials();
  const pts = scatter({ seed: o.seed, count, ...area });
  const r = rng(o.seed + 2);
  const geos = [leafQuad('mapleLeaf', 1), leafQuad('broadLeaf', 1)];
  const lists = [[], []];
  for (const p of pts) {
    const k = r() < o.mapleShare ? 0 : 1;
    const s = lerp(o.sizes[0], o.sizes[1], r()) * (k ? 0.9 : 1.25);
    lists[k].push(new THREE.Matrix4().compose(V3(p[0], o.groundAt(p[0], p[1]), p[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.35, r() * TAU, (r() - 0.5) * 0.35, 'YXZ')), V3(s, s, s)));
  }
  const group = new THREE.Group(); group.name = 'leafLitter';
  geos.forEach((g, i) => { if (lists[i].length) group.add(instancedOf(g, o.material || M.litter, null, lists[i], { name: 'litter' + i, cast: false })); });
  return { group, count: pts.length };
}

/** createStonePath(points [[x,z],...], { groundAt, width, spacing, seed }) -> { group } flat mossy stepping stones */
export function createStonePath(points, opts = {}) {
  const o = { groundAt: () => 0, width: 0.62, spacing: 0.78, seed: 91, ...opts };
  const r = rng(o.seed);
  const curve = new THREE.CatmullRomCurve3(points.map(p => V3(p[0], 0, p[1])));
  const L = curve.getLength(), n = Math.floor(L / o.spacing);
  const items = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const side = V3(-tg.z, 0, tg.x);
    const off = (r() - 0.5) * o.width * 0.5;
    const x = p.x + side.x * off, z = p.z + side.z * off;
    const w = o.width * (0.75 + r() * 0.45);
    items.push({ x, z, y: o.groundAt(x, z) - 0.01, size: [w * 0.5, 0.5 + r() * 0.3, w * (0.38 + r() * 0.15)], rotY: Math.atan2(tg.x, tg.z) + (r() - 0.5) * 0.6, shape: 'flat', sink: 0.25 });
  }
  return createRockField(items, { seed: o.seed, variants: 3, groundAt: o.groundAt });
}
