// World B vegetation by region: the ring of trees around the camp (the big crooked pine, the red maple), the hunt
// trail (tall pines, maples, a bamboo patch, sunbeams), and the sunken dell at the foot of the karst wall (the ancient
// tree, the scroll sealed in crystal among its roots, its waterfall, bamboo, maples, ferns, rocks). Each region is its
// own group so frustum culling and distance LOD can switch it off. (The stretches between: forest-set-journey.js.)
import * as THREE from 'three';
import { GeoBuf, rng, clamp, lerp, smooth, V3, TAU, U, noise3, fbm3, card } from './flora-core.js';
import { floraMaterials } from './flora-mats.js';
import { createAncientTree } from './flora-ancient.js';
import { createPineStand, createMapleStand, createBroadleafStand } from './flora-trees.js';
import { createBambooGrove } from './flora-bamboo.js';
import { createFerns, createUndergrowth, createLeafLitter, createRockField, scatter } from './flora-ground.js';
import { createLightShafts } from './flora-cliffs.js';
import { cellRect, foliageAtlas } from './flora-tex.js';
import { FOGU } from './atmosphere.js';
import { P, S, DELL_FLOOR, DELL_SHIFT, heightAt, trailDist, streamX, waterY, streamDist, wallSide, trailPoint, waterMaterial } from './forest-set-terrain.js';
import { createScrollCrystal } from './scroll-crystal.js';

const UP = V3(0, 1, 0);
const D2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const MED_DIR = [-0.928, -0.373];   // the gap from the meditation spot toward the far waterfall
const DELL_SUN = V3(-0.5, 0.56, -0.66);      // the sun in the dell as staged (forest.js sunDirs from u 132.8)

// where no tree may stand
export function treeFree(x, z, margin = 0) {
  if (Math.hypot(x, z) < 12.5 + margin) return true;
  const tr = trailDist(x, z);
  if (tr.d < 3.4 + margin && tr.s < S.RIM + 2) return true;
  if (streamDist(x, z).d < 3.6 + margin) return true;
  if (Math.hypot(x - P.CLIFF_POOL[0], z - P.CLIFF_POOL[1]) < 7.5 + margin) return true;
  { const w = wallSide(x, z); if (w.d < 3 + margin || (w.side < 0 && !w.end && w.d < 70)) return true; }
  const mx = x - P.MEDITATE[0], mz = z - P.MEDITATE[1];
  const t = mx * MED_DIR[0] + mz * MED_DIR[1], lat = Math.abs(mx * MED_DIR[1] - mz * MED_DIR[0]);
  if (t > 2.5 && t < 85 && lat < 2.6 + t * 0.12) return true;
  if (D2([x, z], P.HOME) < 5.5 || D2([x, z], P.TARGET) < 3.5 || D2([x, z], P.TALLY) < 2.5 || D2([x, z], P.ROCK) < 4.2) return true;
  const dd = D2([x, z], P.DELL);
  if (dd < 27) return true;
  return false;
}
export function inDell(x, z, r = 27) { return D2([x, z], P.DELL) < r; }

// jittered grid scatter with a predicate
function jitter(x0, z0, x1, z1, cell, seed, accept) {
  const r = rng(seed), out = [];
  for (let z = z0; z < z1; z += cell) for (let x = x0; x < x1; x += cell) {
    const px = x + r() * cell, pz = z + r() * cell, q = r();
    if (accept(px, pz, q)) out.push([px, pz, q]);
  }
  return out;
}

// falling maple leaves under a crown: instanced quads animated in the vertex shader (no CPU work)
export function createFallingLeaves({ centers = [], count = 70, seed = 3 } = {}) {
  const atlas = foliageAtlas();
  const r = rng(seed);
  const rect = cellRect('mapleLeaf', 0.01);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([rect[0], rect[1], rect[2], rect[1], rect[2], rect[3], rect[0], rect[3]], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const n = centers.length * count;
  const a0 = new Float32Array(n * 4), a1 = new Float32Array(n * 4);
  let k = 0;
  for (const c of centers) for (let i = 0; i < count; i++, k++) {
    const ang = r() * TAU, d = Math.sqrt(r()) * c.r;
    a0.set([c.x + Math.cos(ang) * d, c.top - r() * c.h, c.z + Math.sin(ang) * d, c.ground], k * 4);
    a1.set([r() * 50, 7 + r() * 7, 0.11 + r() * 0.06, r()], k * 4);
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(a0, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(a1, 4));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tAtlas: { value: atlas }, uSunD: FOGU.cfFogSunDir, uSunC: FOGU.cfFogSunCol }]),
    vertexShader: `attribute vec4 aA, aB; uniform float uTime, uAutumn, uWind; varying vec2 vUv; varying float vSh; varying float vR; varying float vOn;
#include <fog_pars_vertex>
void main(){
  float T = aB.y; float ph = fract((uTime + aB.x)/T);
  vec3 p0 = aA.xyz; float drop = (p0.y - aA.w)*ph;
  vec3 w = vec3(p0.x + sin(uTime*1.7 + aB.x)*.6 + ph*2.2*uWind, p0.y - drop, p0.z + cos(uTime*1.3 + aB.x*1.7)*.6 + ph*1.4*uWind);
  float a = uTime*(2. + aB.w*3.) + aB.x;
  mat3 R = mat3(cos(a), 0., sin(a), 0., 1., 0., -sin(a), 0., cos(a));
  float t2 = sin(uTime*2.3 + aB.x)*1.2;
  mat3 Rx = mat3(1., 0., 0., 0., cos(t2), sin(t2), 0., -sin(t2), cos(t2));
  vOn = step(aB.w, smoothstep(.25, .9, uAutumn))*smoothstep(0., .04, ph)*(1. - smoothstep(.96, 1., ph));
  vec3 lp = Rx*R*(position*aB.z)*vOn;
  vec4 mvPosition = viewMatrix*vec4(w + lp, 1.);
  gl_Position = projectionMatrix*mvPosition;
  vUv = uv; vSh = .55 + .45*abs((Rx*R*vec3(0., 1., 0.)).y); vR = aB.w;
#include <fog_vertex>
}`,
    fragmentShader: `uniform sampler2D tAtlas; uniform vec3 uSunC; varying vec2 vUv; varying float vSh; varying float vR; varying float vOn;
#include <fog_pars_fragment>
void main(){
  vec4 t = texture2D(tAtlas, vUv);
  if (t.a < .5 || vOn < .5) discard;
  vec3 c = mix(vec3(.62, .05, .02), vec3(.95, .38, .05), fract(vR*3.7))*(.45 + t.r*.9);
  gl_FragColor = vec4(c*vSh*(.6 + .5*uSunC), 1.);
  gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1./2.2));
  #include <fog_fragment>
}`,
  });
  Object.assign(mat.uniforms, { uTime: U.uTime, uAutumn: U.uAutumn, uWind: U.uWind }, FOGU);
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.name = 'fallingLeaves';
  return { mesh };
}

// the near trees as [x, z, kind, height] for the card forest that stands in for them from the air
function cardsOf(pines, maples, gold, rust) {
  const out = [];
  for (const t of pines) out.push([t.position[0], t.position[2], 'pine', t.height]);
  for (const t of maples) out.push([t.position[0], t.position[2], 'maple', t.height * 1.1]);
  for (const t of gold) out.push([t.position[0], t.position[2], 'gold', t.height]);
  for (const t of rust) out.push([t.position[0], t.position[2], 'rust', t.height]);
  return out;
}

function groundCover(name, o, q) {
  const k = q.low ? 0.5 : 1;
  const group = new THREE.Group(); group.name = name + '-cover';
  if (o.ferns) group.add(createFerns({ ...o.ferns, count: Math.round(o.ferns.count * k) }, { groundAt: heightAt, scale: o.ferns.scale || [0.65, 1.3], seed: o.seed + 1, variants: 2 }).group);
  if (o.under) group.add(createUndergrowth({ ...o.under, count: Math.round(o.under.count * k), groundAt: heightAt, seed: o.seed + 2, cast: { shrub: true } }).group);
  if (o.litter) group.add(createLeafLitter(o.litter, Math.round(o.litter.count * k), { groundAt: heightAt, seed: o.seed + 3 }).group);
  return group;
}

// ------------------------------------------------------------------ the camp ring
export function buildCampWood(q = {}) {
  const r = rng(101);
  const group = new THREE.Group(); group.name = 'campWood';
  const lo = q.low ? 0.55 : 1;
  const pts = jitter(-46, -46, 46, 46, 8.2, 11, (x, z, u) => {
    const d = Math.hypot(x, z);
    return d > 15 && d < 44 && !treeFree(x, z, 0.6) && u < 0.62 * lo && !(trailDist(x, z).d < 22 && trailDist(x, z).s > 16);
  });
  const pines = [{ seed: 7001, height: 17, position: [P.BIGPINE[0], heightAt(...P.BIGPINE), P.BIGPINE[1]], lean: 2.2, girth: 1.6, padScale: 1.5, crownStart: 0.35, rotationY: 0.8 }];
  const maples = [{ seed: 7101, height: 7.5, position: [P.MAPLE1[0], heightAt(...P.MAPLE1), P.MAPLE1[1]], stems: 2, rotationY: 1.1, density: 1.2 }];
  const gold = [], rust = [];
  for (const [x, z, u] of pts) {
    if (D2([x, z], P.BIGPINE) < 7 || D2([x, z], P.MAPLE1) < 5) continue;
    const y = heightAt(x, z), sp = r(), inner = Math.hypot(x, z) < 23;
    if (sp < (inner ? 0.18 : 0.42)) pines.push({ seed: 7000 + pines.length * 13, height: (inner ? 11 : 15) + r() * 9, position: [x, y, z], density: 0.75 });
    else if (sp < (inner ? 0.62 : 0.6)) maples.push({ seed: 7100 + maples.length * 11, height: 6.5 + r() * 3, position: [x, y, z] });
    else if (sp < 0.82) gold.push({ seed: 7200 + gold.length * 7, height: 13 + r() * 7, position: [x, y, z], density: 0.8 });
    else rust.push({ seed: 7300 + rust.length * 5, height: 12 + r() * 6, position: [x, y, z], density: 0.8 });
  }
  const trees = new THREE.Group(); trees.name = 'camp-trees';
  trees.add(createPineStand(pines, { name: 'camp-pines' }).group);
  trees.add(createMapleStand(maples, { name: 'camp-maples' }).group);
  if (gold.length) trees.add(createBroadleafStand(gold, { name: 'camp-gold' }).group);
  if (rust.length) trees.add(createBroadleafStand(rust, { name: 'camp-rust', leaf: 'rust' }).group);
  group.add(trees);
  const cardList = cardsOf(pines, maples, gold, rust);
  const avoid = [[P.FIRE[0], P.FIRE[1], 2.2], [P.HOME[0], P.HOME[1], 4.2], [P.ROCK[0], P.ROCK[1], 3.6], [P.TARGET[0], P.TARGET[1], 1.8], [P.MEMORIAL[0], P.MEMORIAL[1], 1.2], [P.TALLY[0], P.TALLY[1], 1.0], [P.MEDITATE[0], P.MEDITATE[1], 1.3]];
  const notStream = (x, z) => Math.abs(x - streamX(z)) > 2.2;
  const cover = groundCover('camp', {
    seed: 140,
    ferns: { center: [0, 0], radius: 40, count: 230, avoid, inside: (x, z) => notStream(x, z) && trailDist(x, z).d > 1.5, density: (x, z) => smooth(9, 14, Math.hypot(x, z)) * 0.9 + 0.05 },
    under: { center: [0, 0], radius: 40, count: 560, avoid, inside: (x, z) => notStream(x, z) && trailDist(x, z).d > 1.1, density: (x, z) => 0.35 + 0.5 * smooth(5, 13, Math.hypot(x, z)), mix: { grass: 0.55, shrub: 0.16, clover: 0.2, moss: 0.09 } },
    litter: { center: [P.MAPLE1[0], P.MAPLE1[1]], radius: 9, count: 700, avoid: [[P.MEDITATE[0], P.MEDITATE[1], 0.3]] },
  }, q);
  group.add(cover);
  cover.add(createUndergrowth({ center: [0, 0], radius: 12.5, count: Math.round(420 * lo), seed: 145, groundAt: heightAt, avoid: [...avoid, [P.CAMP[0], P.CAMP[1], 2.2], [P.FIRE[0], P.FIRE[1], 2.8], [8.2, -1.2, 2.2]], inside: (x, z) => notStream(x, z) && trailDist(x, z).d > 1.0, mix: { grass: 0.8, clover: 0.2 }, cast: {} }).group);
  const litter2 = createLeafLitter({ center: [0, 0], radius: 38, avoid: [[P.FIRE[0], P.FIRE[1], 1.2]], inside: notStream }, Math.round(900 * lo), { groundAt: heightAt, seed: 151 }).group;
  cover.add(litter2);
  // stones: a few at the clearing's edge, stepping stones over the stream
  const rocks = [];
  for (const [x, z] of jitter(-40, -40, 40, 40, 11, 161, (x, z, u) => u < 0.35 && Math.hypot(x, z) > 13 && !treeFree(x, z, 0.5))) rocks.push({ x, z, size: [0.6 + r() * 1.2, 0.4 + r() * 0.5, 0.6 + r() * 0.9], shape: r() < 0.3 ? 'slab' : 'boulder' });
  for (let i = 0; i < 5; i++) { const z = 3.2 + (r() - 0.5) * 0.4, x = 8.4 + i * 0.95; rocks.push({ x, z, y: waterY(z) - 0.05, size: [0.48 + r() * 0.12, 0.6, 0.42 + r() * 0.1], shape: 'flat', sink: 0.18 }); }
  const campRocks = createRockField(rocks, { groundAt: heightAt, detail: 7, seed: 171 });
  group.add(campRocks.group);
  const leaves = createFallingLeaves({ centers: [{ x: P.MAPLE1[0], z: P.MAPLE1[1], top: heightAt(...P.MAPLE1) + 6.5, h: 3, r: 3.5, ground: heightAt(...P.MAPLE1) }], count: q.low ? 30 : 60, seed: 5 });
  group.add(leaves.mesh);
  return { group, cover, rocks: campRocks.group, trees, cardList, leaves: leaves.mesh };
}

// ------------------------------------------------------------------ the hunt trail (the journey's first stretch)
export const TRAIL_END = 108;
export function buildTrailWood(q = {}, sunDir = V3(-0.7, 0.3, -0.65)) {
  const r = rng(202);
  const lo = q.low ? 0.55 : 1;
  const group = new THREE.Group(); group.name = 'trailWood';
  const BAM = [-19.5, -38.5];
  const pts = jitter(-68, -124, 14, -10, 7.6, 21, (x, z, u) => {
    const tr = trailDist(x, z);
    if (tr.d > 24 || tr.s < 14 || tr.s > TRAIL_END || Math.hypot(x, z) < 40) return false;
    if (treeFree(x, z, 0.4) || D2([x, z], BAM) < 8.5 || D2([x, z], P.BOAR) < 4) return false;
    // keep gaps on the sunny (west) side near the path so beams cross it
    const west = (x - trailPoint(tr.s)[0]) < 0;
    return u < (west && tr.d < 10 ? 0.38 : 0.66) * lo;
  });
  const pines = [], maples = [], gold = [], rust = [];
  for (const [x, z] of pts) {
    const y = heightAt(x, z), sp = r();
    if (sp < 0.44) pines.push({ seed: 8000 + pines.length * 13, height: 18 + r() * 8, position: [x, y, z], density: 0.7, crownStart: 0.55 });
    else if (sp < 0.66) maples.push({ seed: 8100 + maples.length * 11, height: 6.5 + r() * 3.5, position: [x, y, z] });
    else if (sp < 0.86) gold.push({ seed: 8200 + gold.length * 7, height: 14 + r() * 7, position: [x, y, z], density: 0.8 });
    else rust.push({ seed: 8300 + rust.length * 5, height: 13 + r() * 6, position: [x, y, z], density: 0.8 });
  }
  const trees = new THREE.Group(); trees.name = 'trail-trees';
  trees.add(createPineStand(pines, { name: 'trail-pines' }).group);
  trees.add(createMapleStand(maples, { name: 'trail-maples' }).group);
  if (gold.length) trees.add(createBroadleafStand(gold, { name: 'trail-gold' }).group);
  if (rust.length) trees.add(createBroadleafStand(rust, { name: 'trail-rust', leaf: 'rust' }).group);
  const bamboo = createBambooGrove({ center: BAM, radius: 7.5, count: Math.round(95 * lo), seed: 23, groundAt: heightAt, inside: (x, z) => trailDist(x, z).d > 3.0, heights: [9, 14], detailNear: [-14.5, -38], detailRadius: q.low ? 0 : 3.2 });
  trees.add(bamboo.group);
  group.add(trees);
  const cardList = cardsOf(pines, maples, gold, rust);
  const onTrail = (x, z) => { const tr = trailDist(x, z); return tr.d < 26 && tr.s > 6 && tr.s < TRAIL_END; };
  const cover = groundCover('trail', {
    seed: 240,
    ferns: { center: [-22, -60], radius: 60, count: 400, inside: (x, z) => onTrail(x, z) && trailDist(x, z).d > 1.6, density: (x, z) => 0.3 + 0.7 * (1 - smooth(4, 16, trailDist(x, z).d)) },
    under: { center: [-22, -60], radius: 60, count: 640, inside: (x, z) => onTrail(x, z) && trailDist(x, z).d > 1.15, mix: { grass: 0.45, shrub: 0.2, clover: 0.25, moss: 0.1 } },
    litter: { center: [-22, -60], radius: 60, count: 2700, inside: (x, z) => onTrail(x, z) },
  }, q);
  group.add(cover);
  const rocks = [];
  for (const [x, z] of jitter(-66, -122, 10, -10, 9, 261, (x, z, u) => u < 0.3 && onTrail(x, z) && trailDist(x, z).d > 2.2)) rocks.push({ x, z, size: [0.5 + r() * 1.4, 0.35 + r() * 0.6, 0.5 + r() * 1.0], shape: r() < 0.35 ? 'slab' : 'boulder' });
  const trailRocks = createRockField(rocks, { groundAt: heightAt, detail: 7, seed: 271 });
  group.add(trailRocks.group);
  // sunbeams crossing the trail from the west
  const sd = sunDir.clone().normalize(), shaft = [];
  for (let i = 0; i < 16; i++) {
    const s = 18 + r() * (TRAIL_END - 26), [tx, tz] = trailPoint(s);
    const gx = tx + (r() - 0.5) * 6, gz = tz + (r() - 0.5) * 6, gy = heightAt(gx, gz);
    const L = 26 + r() * 10;
    shaft.push([gx + sd.x * L, gy + sd.y * L, gz + sd.z * L]);
  }
  const shafts = createLightShafts({ sunDir: sd, points: shaft, length: 42, width: 1.3, intensity: 0.8 });
  group.add(shafts.mesh);
  return { group, cover, shafts, bamboo, rocks: trailRocks.group, trees, cardList };
}

// ------------------------------------------------------------------ the dell
export function buildDell(q = {}, sunDir = V3(-0.7, 0.3, -0.65)) {
  const r = rng(303);
  const lo = q.low ? 0.55 : 1;
  const group = new THREE.Group(); group.name = 'dell';
  // (the dell was laid out beside the camp; its pieces keep their places relative to one another)
  const D = (x, z) => [x + DELL_SHIFT[0], z + DELL_SHIFT[1]];
  const M = floraMaterials();
  const [ax, az] = P.ANCIENT;
  const front = Math.atan2(P.LAND[1] - az, P.LAND[0] - ax);
  // rocks: big blocks along the walls (the roots climb those near the tree), moss stones on the floor
  const DC = P.DELL;
  const rocks = [];
  for (let i = 0; i < (q.low ? 16 : 26); i++) {
    const a = r() * TAU;
    const toSE = Math.cos(a - Math.atan2(P.EDGE[1] - DC[1], P.EDGE[0] - DC[0]));
    if (toSE > 0.75 && r() < 0.8) continue;
    const rr = 18 + r() * 8;
    const x = DC[0] + Math.cos(a) * rr, z = DC[1] + Math.sin(a) * rr;
    const s = 1.6 + r() * 3.4;
    rocks.push({ x, z, size: [s, s * (0.6 + r() * 0.5), s * (0.7 + r() * 0.4)], shape: r() < 0.4 ? 'slab' : 'boulder', sink: 0.25 });
  }
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, rr = 6 + r() * 11;
    const x = DC[0] + Math.cos(a) * rr, z = DC[1] + Math.sin(a) * rr;
    if (Math.hypot(x - ax, z - az) < 5 || Math.hypot(x - P.LAND[0], z - P.LAND[1]) < 3) continue;
    { const ex = ax - P.LAND[0], ez = az - P.LAND[1], L2 = ex * ex + ez * ez, t = clamp(((x - P.LAND[0]) * ex + (z - P.LAND[1]) * ez) / L2); if (Math.hypot(x - P.LAND[0] - ex * t, z - P.LAND[1] - ez * t) < 3.2 + t * 2) continue; }
    const s = 0.5 + r() * 1.1;
    rocks.push({ x, z, size: [s, s * 0.6, s * 0.8], shape: r() < 0.3 ? 'slab' : 'boulder' });
  }
  // the slope from the edge: rocks and roots under the leaves
  for (let i = 0; i < 10; i++) {
    const t = 0.15 + r() * 0.75, x = lerp(P.EDGE[0], P.LAND[0], t) + (r() - 0.5) * 9, z = lerp(P.EDGE[1], P.LAND[1], t) + (r() - 0.5) * 6;
    if (Math.abs((x - P.EDGE[0]) * 0.83 - (z - P.EDGE[1]) * 0.55) < 1.2) continue;
    const s = 0.5 + r() * 1.0;
    rocks.push({ x, z, size: [s, s * 0.6, s * 0.8], shape: 'boulder' });
  }
  // the waterfall's bay: big limestone blocks make the lip and the cheeks of a short cliff
  const bayA = Math.atan2(P.DELL_FALL[1] - DC[1], P.DELL_FALL[0] - DC[0]);
  for (const [da, rr, sz, sink] of [[0.2, 16.2, [6.2, 9.5, 5.2], 0.3], [-0.19, 16.4, [5.6, 8.5, 5.0], 0.3], [0.0, 19.2, [7.5, 5.5, 5.5], 0.2], [0.42, 17.5, [5.0, 6.5, 4.5], 0.3], [-0.4, 17.8, [4.6, 6.0, 4.2], 0.3]]) {
    const a = bayA + da;
    rocks.push({ x: DC[0] + Math.cos(a) * rr, z: DC[1] + Math.sin(a) * rr, size: sz, shape: 'boulder', sink, rotY: a + 1.2 });
  }
  const minUnder = (x, z, s) => Math.min(heightAt(x, z), heightAt(x + s, z), heightAt(x - s, z), heightAt(x, z + s), heightAt(x, z - s));
  for (const k of rocks) k.y = minUnder(k.x, k.z, k.size[0] * 0.7);
  const dellRocks = createRockField(rocks, { groundAt: heightAt, detail: 7, seed: 311 });
  group.add(dellRocks.group);
  const detail = new THREE.Group(); detail.name = 'dell-detail';
  group.add(detail);
  // the moss on the tree climbs from the dell's floor, wherever that lies (the band was set for a floor at -8)
  for (const m of [M.ancientTrunk, M.ancientBark]) m.userData.flora.uniforms.uMossH.value.z = DELL_FLOOR + 8;
  const tree = createAncientTree({
    position: [ax, heightAt(ax, az), az], front, groundAt: heightAt, radius: 2.1, trunkH: 18, crownScale: q.low ? 1.3 : 1.5, leafDensity: q.low ? 0.6 : 1,
    rocks: rocks.filter(k => Math.hypot(k.x - ax, k.z - az) < 12).map(k => ({ x: k.x, z: k.z, y: heightAt(k.x, k.z), r: k.size[0] * 1.05, h: k.size[1] * 1.1 })),
  });
  group.add(tree.group);
  // the reveal (the tree's hero view): low beside the way in from where he fell, the great tree right of centre,
  // the waterfall's bay left of it, bamboo at both edges, red maples behind, the sun in the crown upper right
  const fd = tree.anchors.front, sdv = tree.anchors.side;
  const W = (f, sv, h = 0) => { const x = ax + fd.x * f + sdv.x * sv, z = az + fd.z * f + sdv.z * sv; return V3(x, heightAt(x, z) + h, z); };
  const heroPos = W(9.5, -3.4, 1.15), heroTarget = W(0, 1.3, 3.6);
  tree.anchors.hero = { pos: heroPos, target: heroTarget, fov: 50 };
  // bamboo: a small clump at the left edge of that view (clear of his way to the roots), a grove right of the tree
  const bam1 = createBambooGrove({ center: D(-41.4, -91.6), radius: 1.25, count: Math.round(10 * lo), seed: 31, groundAt: heightAt, inside: (x, z) => Math.hypot(x - P.LAND[0], z - P.LAND[1]) > 2.4, heights: [10, 13.5], detailNear: D(-41.4, -91.6), detailRadius: q.low ? 0 : 3 });
  const bam2 = createBambooGrove({ center: D(-38.0, -98.6), radius: 1.2, count: Math.round(9 * lo), seed: 37, groundAt: heightAt, inside: (x, z) => Math.hypot(x - ax, z - az) > 4.6, heights: [10, 14] });
  const bam3 = createBambooGrove({ center: D(-52.5, -87.5), radius: 3.6, count: Math.round(26 * lo), seed: 39, groundAt: heightAt, heights: [10, 14] });
  detail.add(bam1.group, bam2.group, bam3.group);
  const maples = [
    { seed: 9101, height: 8.5, position: [-45.5, 0, -108.2], stems: 2, rotationY: 2.4, density: 1.15 },
    { seed: 9102, height: 7.5, position: [-50.2, 0, -96.2], stems: 2 },
    { seed: 9106, height: 6, position: [-40.1, 0, -100.8], stems: 1, density: 1.1 },
    { seed: 9103, height: 6.5, position: [-30.5, 0, -95], stems: 1 },
    { seed: 9104, height: 7, position: [-49.5, 0, -84.5], stems: 2 },
    { seed: 9105, height: 7, position: [-65.2, 0, -89.6], stems: 1, density: 0.9 },
  ].map(m => { const [x, z] = D(m.position[0], m.position[2]); return { ...m, position: [x, heightAt(x, z), z] }; });
  detail.add(createMapleStand(maples, { name: 'dell-maples' }).group);
  const rim = [], rimPines = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, rr = 28 + r() * 10;
    const x = DC[0] + Math.cos(a) * rr, z = DC[1] + Math.sin(a) * rr;
    if (trailDist(x, z).d < 4) continue;
    { const w = wallSide(x, z); if (w.d < 6 || (w.side < 0 && !w.end)) continue; }
    if (r() < 0.45) rimPines.push({ seed: 9200 + i * 7, height: 16 + r() * 8, position: [x, heightAt(x, z), z], density: 0.7 });
    else rim.push({ seed: 9300 + i * 7, height: 13 + r() * 7, position: [x, heightAt(x, z), z], density: 0.8 });
  }
  if (rim.length) detail.add(createBroadleafStand(rim, { name: 'dell-rim' }).group);
  if (rimPines.length) detail.add(createPineStand(rimPines, { name: 'dell-pines' }).group);
  const nook = tree.anchors.scroll;
  const walk = (x, z) => { // keep LAND -> scroll walkable
    const ex = nook.x - P.LAND[0], ez = nook.z - P.LAND[1], L2 = ex * ex + ez * ez;
    const t = clamp(((x - P.LAND[0]) * ex + (z - P.LAND[1]) * ez) / L2);
    return Math.hypot(x - P.LAND[0] - ex * t, z - P.LAND[1] - ez * t) > 1.3;
  };
  const camClear = [[heroPos.x, heroPos.z, 2.3], [...D(-35.6, -91.3), 2.0]];
  const cover = groundCover('dell', {
    seed: 340,
    ferns: { center: DC, radius: 24, count: 260, avoid: [[nook.x, nook.z, 1.6], [ax, az, 3.6], ...camClear], inside: (x, z) => walk(x, z), density: (x, z) => 0.35 + 0.65 * (1 - smooth(5, 16, Math.hypot(x - ax, z - az))) },
    under: { center: DC, radius: 26, count: 320, avoid: [[nook.x, nook.z, 1.8], [ax, az, 3.6], ...camClear], inside: walk, mix: { grass: 0.3, shrub: 0.25, clover: 0.3, moss: 0.15 } },
    litter: { center: [(P.LAND[0] + nook.x) / 2, (P.LAND[1] + nook.z) / 2], radius: 13, count: 1600, avoid: [[ax, az, 2.6]] },
  }, q);
  group.add(cover);
  cover.add(createLeafLitter({ center: [lerp(P.EDGE[0], P.LAND[0], 0.5), lerp(P.EDGE[1], P.LAND[1], 0.5)], radius: 9 }, Math.round(900 * lo), { groundAt: heightAt, seed: 351 }).group);
  // the scroll, sealed in a crystal grown over it in six years among the roots: lying across the nook at the cushion's
  // front edge, the roots grown over its ends, the touch point toward where one kneels
  const fdN = tree.anchors.front, sdN = tree.anchors.side;
  const cPos = V3(nook.x, 0, nook.z).addScaledVector(fdN, 0.42);
  cPos.y = heightAt(cPos.x, cPos.z) + 0.02;
  // (its root straps in limb bark: under the nook's pelt of moss they read as green tubes)
  const crystal = createScrollCrystal({ position: cPos, axis: sdN.clone().negate(), seed: 31, rootMaterial: M.ancientLimb, mossMaterial: M.mossCushion, groundAt: heightAt });
  crystal.update(0, { glow: 0, crack: 0, shatter: 0 });
  group.add(crystal.group);
  // a few leaves fallen on the moss cushion and around the crystal
  {
    const cy = nook.y - 0.06, cr = 0.5;
    const onCushion = (x, z) => { const d = Math.hypot(x - nook.x, z - nook.z); return d < cr ? cy - 0.12 * (d / cr) * (d / cr) : heightAt(x, z); };
    group.add(createLeafLitter({ center: [nook.x, nook.z], radius: 1.15, avoid: [[nook.x, nook.z, 0.1], [cPos.x, cPos.z, 0.5], [cPos.x + sdN.x * 0.3, cPos.z + sdN.z * 0.3, 0.3], [cPos.x - sdN.x * 0.3, cPos.z - sdN.z * 0.3, 0.3]] }, 70, { groundAt: onCushion, seed: 361, sizes: [0.13, 0.19] }).group);
  }
  // the dell's waterfall: a thin fall from the north-west wall into a pool
  const [wx, wz] = P.DELL_FALL;
  const inward = V3(DC[0] - wx, 0, DC[1] - wz).normalize();
  const topY = heightAt(wx, wz) - 0.4;
  const pool = V3(wx, 0, wz).addScaledVector(inward, 5.2);
  pool.y = DELL_FLOOR - 0.25;
  const fallG = new THREE.PlaneGeometry(1, 1, 1, 30);
  {
    const p = fallG.attributes.position, sideV = V3(-inward.z, 0, inward.x);
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5;
      const y = lerp(pool.y + 0.1, topY, v);
      const out = 0.9 + (1 - v) * 1.8 + Math.pow(1 - v, 2) * 2.2;
      const w = 1.5 + (1 - v) * 1.3;
      const q2 = V3(wx, y, wz).addScaledVector(inward, out).addScaledVector(sideV, (u - 0.5) * w);
      p.setXYZ(i, q2.x, q2.y, q2.z);
    }
    fallG.computeBoundingSphere();
  }
  const fall = new THREE.Mesh(fallG, waterMaterial({ fall: true }));
  fall.renderOrder = 3; fall.name = 'dellFall';
  const poolM = new THREE.Mesh(new THREE.CircleGeometry(2.9, 28).rotateX(-Math.PI / 2), waterMaterial());
  poolM.position.copy(pool); poolM.renderOrder = 2; poolM.name = 'dellPool';
  const poolUv = poolM.geometry.attributes.uv;
  for (let i = 0; i < poolUv.count; i++) poolUv.setXY(i, 0.5, poolUv.getY(i) * 3);
  group.add(fall, poolM);
  // god rays through the great crown: the dell's sun stands behind the tree (as staged, u > 132.8), so the shafts
  // fall toward the reveal view, between it and the trunk and either side; where they leave the crown is up the sun
  const sd = DELL_SUN.clone().normalize(), shaft = [];
  {
    const vc = heroTarget.clone().sub(heroPos).setY(0).normalize(), lf = V3(vc.z, 0, -vc.x);
    for (let i = 0; i < 34; i++) {
      const a = (-0.35 + 1.1 * (i + r() * 0.8) / 34), d = 3 + Math.pow(r(), 0.8) * 20;
      const gx = heroPos.x + (vc.x * Math.cos(a) + lf.x * Math.sin(a)) * d, gz = heroPos.z + (vc.z * Math.cos(a) + lf.z * Math.sin(a)) * d;
      // not through the scroll shot: beams rising from the strip in front of the nook would pass the cameras there
      const fa = (gx - ax) * fd.x + (gz - az) * fd.z, sa = (gx - ax) * sdv.x + (gz - az) * sdv.z;
      if (fa > 1.5 && fa < 10.5 && Math.abs(sa) < 3.4) continue;
      const gy = heightAt(gx, gz), L = (17 + r() * 7) / sd.y;
      shaft.push([gx + sd.x * L, gy + sd.y * L, gz + sd.z * L]);
    }
  }
  // brightest where they cross the trunk and the shade below the crown, not up in the glare
  const shafts = createLightShafts({ sunDir: sd, points: shaft, length: 40, width: 0.5, intensity: 0.85, along: [0.42, 0.7] });
  group.add(shafts.mesh);
  const leaves = createFallingLeaves({ centers: maples.slice(0, 2).map(m => ({ x: m.position[0], z: m.position[2], top: m.position[1] + 7, h: 3, r: 3.5, ground: m.position[1] })), count: q.low ? 25 : 50, seed: 9 });
  detail.add(leaves.mesh);
  const cardList = [...maples.map(m => [m.position[0], m.position[2], 'maple', m.height * 1.1]), ...rim.map(t => [t.position[0], t.position[2], 'gold', t.height]), ...rimPines.map(t => [t.position[0], t.position[2], 'pine', t.height])];
  return { group, cover, tree, shafts, detail, cardList, crystal, rocks: dellRocks.group, fall: { top: V3(wx, topY, wz).addScaledVector(inward, 0.6), bottom: pool.clone(), mesh: fall } };
}
