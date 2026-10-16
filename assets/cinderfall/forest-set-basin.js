// The basin seen from the air: a ring of fluted limestone towers (ledges with pines and shrubs, waterfalls, mist),
// a mid forest of cheap instanced trees (trunk + crown cards) and, beyond, a canopy "shell": one heightfield whose
// shader paints individual crowns (Worley cells: species, dome shading, dark gaps, seasonal colour, snow).
import * as THREE from 'three';
import { GeoBuf, card, gridNormals, gridIndex, noise3, fbm3, rng, clamp, lerp, smooth, V3, TAU, U, meshOf, instancedOf } from './flora-core.js';
import { floraMaterials } from './flora-mats.js';
import { cellRect } from './flora-tex.js';
import { FOGU } from './atmosphere.js';

const UP = V3(0, 1, 0);
const withFog = m => { Object.assign(m.uniforms, FOGU); return m; };

// ------------------------------------------------------------------ karst towers
// a limestone tower: an irregular radius profile (necks, bulges, ledges), a drifting axis, narrow vertical cracks,
// horizontal bedding planes, a rounded crown; haystack (wide base, tapering) to pillar shapes
function tower(B, r, base, H, R, cols, rows) {
  const ph = r() * 100, ecc = r() * 0.38, eAng = r() * TAU;
  const shape = Math.pow(r(), 1.6);
  // silhouettes that read as karst from afar (and in ink, where only the outline survives): sugarloaf crowns,
  // taper toward the top, a slight lean
  const domeH = lerp(0.34, 0.17, shape) + r() * 0.08;
  const taperK = lerp(0.3, 0.78, shape);
  const leanA = r() * TAU, lean = R * (0.15 + r() * 0.35);
  const K = 18, prof = [];
  let pv = 1;
  for (let k = 0; k <= K; k++) { pv += (r() - 0.5) * 0.22; pv = clamp(pv, 0.72, 1.22); prof.push(pv); }
  const profAt = t => { const f = clamp(t) * K, i = Math.min(K - 1, Math.floor(f)), u = f - i; return lerp(prof[i], prof[i + 1], u * u * (3 - 2 * u)); };
  const ledges = [];
  for (let k = 0; k < 1 + Math.floor(r() * 3); k++) ledges.push({ y: H * (0.2 + r() * 0.6), d: R * (0.025 + r() * 0.05) });
  const rw = y => {
    const t = y / H;
    let rr = R * profAt(t) * lerp(1, taperK, Math.pow(t, 1.15));
    for (const l of ledges) rr -= l.d * smooth(l.y - 3, l.y + 3, y);
    return rr * (1 + 0.35 * Math.exp(-y / (H * 0.05)));
  };
  const axis = y => { const t = y / H; return V3(R * 0.45 * noise3(ph, t * 1.7, 0.5) + Math.cos(leanA) * lean * t * t, 0, R * 0.45 * noise3(0.5, t * 1.7, ph) + Math.sin(leanA) * lean * t * t); };
  const b0 = B.count, tops = [], walls = [];
  const wall = 0.88;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    let y, rad, dk = 0;
    if (t < wall) { y = H * Math.pow(t / wall, 1.05) * (1 - domeH); rad = rw(y); }
    else { const phi = (t - wall) / (1 - wall) * Math.PI / 2; y = H * (1 - domeH) + H * domeH * Math.sin(phi); rad = rw(H * (1 - domeH)) * Math.pow(Math.cos(phi), 0.85) + 0.4; dk = phi / (Math.PI / 2); }
    const c = base.clone().add(axis(y)).setY(base.y + y);
    for (let j = 0; j <= cols; j++) {
      const a = (j / cols) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const big = fbm3(ca * 1.15 + ph, y / H * 2.6, sa * 1.15, 3);
      const crack = Math.pow(1 - Math.abs(noise3(ca * 2.4 + ph, y * 0.0045, sa * 2.4)), 5);
      const crack2 = Math.pow(1 - Math.abs(noise3(ca * 5.5 - ph, y * 0.009, sa * 5.5)), 7);
      const bed = Math.pow(Math.abs(Math.sin(y * 0.29 + 2.2 * noise3(ca * 2, y * 0.01, sa * 2))), 10);
      const el = 1 + ecc * Math.cos(2 * (a - eAng));
      const rr = rad * el * (1 + 0.26 * big) - (crack * 0.13 + crack2 * 0.05) * R * (1 - dk) - bed * R * 0.018 * (1 - dk);
      const streak = smooth(0.55, 0.8, fbm3(ca * 5 + ph, y * 0.0025, sa * 5, 2));
      const ao = (1 - crack * 0.55 - crack2 * 0.3) * (1 - bed * 0.25) * (1 - streak * 0.35) * (0.55 + 0.45 * smooth(0, H * 0.25, y)) * (0.85 + 0.3 * big);
      B.v(c.x + ca * rr, c.y, c.z + sa * rr, ca, dk, sa, j / cols, y / H, ao * 0.97, ao, ao * 1.02, 0, 0);
    }
  }
  gridNormals(B, b0, rows, cols, true);
  gridIndex(B, b0, rows, cols);
  const Pp = B.p, N = B.n;
  for (let i = b0; i < B.count; i++) {
    const ny = N[i * 3 + 1];
    if (ny > 0.36 && r() < 0.9) tops.push(V3(Pp[i * 3], Pp[i * 3 + 1], Pp[i * 3 + 2]));
    else if (ny > -0.05 && ny < 0.42 && r() < 0.035) walls.push({ p: V3(Pp[i * 3], Pp[i * 3 + 1], Pp[i * 3 + 2]), n: V3(N[i * 3], ny, N[i * 3 + 2]) });
  }
  return { tops, walls, top: base.clone().add(axis(H)).setY(base.y + H), R, b0, b1: B.count };
}
// move a tower already written into B (vertices b0..b1, its tops and walls) by v
function shiftTower(B, T, v) {
  for (let k = T.b0; k < T.b1; k++) { B.p[k * 3] += v.x; B.p[k * 3 + 1] += v.y; B.p[k * 3 + 2] += v.z; }
  for (const t of T.tops) t.add(v);
  for (const w of T.walls) w.p.add(v);
  T.top.add(v);
}

function fallMaterial() {
  return withFog(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: U.uTime, uNoise: U.uNoise, uSnow: U.uSnow, uA: { value: 0.9 } }]),
    vertexShader: `varying vec2 vUv;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix*vec4(position, 1.); gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime, uSnow, uA; uniform sampler2D uNoise; varying vec2 vUv;
#include <fog_pars_fragment>
void main(){
  float n1 = texture2D(uNoise, vec2(vUv.x*2.1, vUv.y*.3 + uTime*.35)).r, n2 = texture2D(uNoise, vec2(vUv.x*5.3 + .3, vUv.y*.8 + uTime*.8)).g;
  float n3 = texture2D(uNoise, vec2(vUv.x*1.1 + .7, vUv.y*.1 + uTime*.1)).b;
  float edge = smoothstep(0., .25 + n3*.25, vUv.x)*smoothstep(1., .75 - n3*.25, vUv.x);
  float streak = smoothstep(.3, .8, n1*.6 + n2*.55);
  vec3 col = mix(vec3(.66, .7, .72), vec3(1.), streak);
  float a = (.4 + .6*streak)*edge*smoothstep(0., .04, 1. - vUv.y)*uA*(1. - uSnow*.5);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`,
  }));
}
function puffMaterial(alpha = 0.5) {
  return withFog(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: U.uTime, uNoise: U.uNoise, uA: { value: alpha } }]),
    vertexShader: `varying vec2 vUv;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix*vec4(position, 1.); gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime, uA; uniform sampler2D uNoise; varying vec2 vUv;
#include <fog_pars_fragment>
void main(){
  vec2 p = vUv - .5;
  float n = texture2D(uNoise, vUv*.7 + vec2(uTime*.02, -uTime*.035)).r*.6 + texture2D(uNoise, vUv*1.6 + vec2(-uTime*.03, -uTime*.05)).g*.4;
  float a = smoothstep(.5, .1, length(p*vec2(1., 1.5)))*smoothstep(.25, .75, n)*uA;
  gl_FragColor = vec4(vec3(.93, .95, .97), a);
  #include <fog_fragment>
}`,
  }));
}

/**
 * createKarstRing({ center, radii:[min,max], massifs, seed, groundAt, north:[x,z] (taller side), falls:[[x,z],...],
 *   pines, quality }) -> { group, towers, waterfalls:[{top, bottom, mesh}] }
 */
export function createKarstRing(opts = {}) {
  const o = { center: [0, 0], radii: [320, 900], massifs: 30, seed: 9, groundAt: () => 0, north: [0, -1], falls: [], pines: 8, quality: {}, ...opts };
  const M = floraMaterials();
  const r = rng(o.seed);
  const group = new THREE.Group(); group.name = 'karstRing';
  const bands = [new GeoBuf(), new GeoBuf(), new GeoBuf()];
  const low = !!o.quality.low;
  const allTops = [];
  const sites = [];
  for (const [fx, fz] of o.falls) sites.push({ x: fx, z: fz, fall: true });
  for (let i = 0; i < o.massifs; i++) {
    const a = (i + r() * 0.8) / o.massifs * TAU;
    let d = lerp(o.radii[0], o.radii[1], Math.pow(r(), 0.85));
    // (a site in a keep-out zone moves out along its radius: the random sequence, and every other tower, stay put)
    while (o.avoid && d < o.radii[1] + 200 && o.avoid(o.center[0] + Math.cos(a) * d, o.center[1] + Math.sin(a) * d, d)) d += 25;
    sites.push({ x: o.center[0] + Math.cos(a) * d, z: o.center[1] + Math.sin(a) * d });
  }
  const falls = [];
  for (const st of sites) {
    const dx = st.x - o.center[0], dz = st.z - o.center[1], d = Math.hypot(dx, dz);
    const nf = clamp(0.5 + 0.5 * (dx * o.north[0] + dz * o.north[1]) / d);
    const band = d < 470 ? 0 : d < 680 ? 1 : 2;
    const cols = low ? [28, 20, 14][band] : [36, 26, 18][band], rows = low ? [22, 15, 10][band] : [30, 20, 12][band];
    // heights grow with distance (as seen from the basin the crowns line up on the horizon, and from the air at
    // the start of the descent they stay inside the frame), a little taller to the north
    // (the outer band a little lower, so from the air its crowns stand clear of the nearer ones, against the sky)
    const Hm = (115 + 0.1 * d) * (0.8 + 0.4 * r()) * (0.92 + 0.16 * nf) * (band === 2 ? 0.82 : 1);
    const n = st.fall ? 3 : 1 + Math.floor(r() * 2.6);
    const toC = V3(-dx, 0, -dz).normalize();
    let main = null;
    for (let k = 0; k < n; k++) {
      const R = lerp(24, 46, r()) * (k ? 0.7 : 1);
      const off = k ? V3((r() - 0.5) * 2, 0, (r() - 0.5) * 2).normalize().multiplyScalar(R * (0.8 + r() * 0.7)) : V3();
      const x = st.x + off.x, z = st.z + off.z;
      const base = V3(x, o.groundAt(x, z) - 10, z);
      const T = tower(bands[band], r, base, Hm * (k ? 0.45 + r() * 0.45 : 1), R, cols, rows);
      for (const p of T.tops) allTops.push({ p, band });
      for (const w of T.walls) allTops.push({ p: w.p.clone().addScaledVector(w.n, 1.5), band, wall: true });
      if (!k) main = { base, H: Hm, R: T.R };
    }
    if (st.fall && main) {
      const w = 9 + r() * 7, top = main.H * 0.72, bot = 8;
      const g = new THREE.PlaneGeometry(1, 1, 1, 30);
      const pp = g.attributes.position;
      const sideV = V3(-toC.z, 0, toC.x);
      for (let i = 0; i < pp.count; i++) {
        const u = pp.getX(i) + 0.5, v = pp.getY(i) + 0.5;
        const y = lerp(bot, top, v);
        const out = main.R * 1.18 + 4 + (1 - v) * 7 + Math.pow(1 - v, 3) * 9;
        const p0 = main.base.clone().addScaledVector(toC, out).addScaledVector(sideV, (u - 0.5) * w * (1 + (1 - v) * 0.7)).add(V3(0, y + 10, 0));
        pp.setXYZ(i, p0.x, p0.y, p0.z);
      }
      g.computeBoundingSphere();
      const fall = new THREE.Mesh(g, fallMaterial());
      fall.renderOrder = 3; fall.name = 'karstFall';
      group.add(fall);
      const mm = puffMaterial(0.5);
      for (let k = 0; k < 4; k++) {
        const s = 34 + r() * 26;
        const mist = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.7, s), mm);
        mist.position.copy(main.base).addScaledVector(toC, main.R * 1.2 + 10 + k * 5).add(V3((r() - 0.5) * 18, 12 + s * 0.3 + k * 3, (r() - 0.5) * 18));
        mist.lookAt(mist.position.clone().add(toC));
        mist.renderOrder = 4; group.add(mist);
      }
      falls.push({ top: main.base.clone().addScaledVector(toC, main.R * 1.18 + 4).add(V3(0, top + 10, 0)), bottom: main.base.clone().addScaledVector(toC, main.R * 1.18 + 15).add(V3(0, bot + 10, 0)), mesh: fall });
    }
  }
  const towers = bands.map((b, i) => meshOf(b.build(), M.cliff, null, { name: 'karst' + i, cast: false, receive: false }));
  towers.forEach(t => group.add(t));
  // vegetation: pads of pine and shrub on ledges and crowns
  const tuft = new GeoBuf();
  {
    const rr = rng(o.seed + 5), rect = cellRect('pineTop'), rect2 = cellRect('broadB');
    for (let i = 0; i < 6; i++) {
      const a = rr() * TAU, d = rr() * 0.45;
      const c = V3(Math.cos(a) * d, rr() * 0.3, Math.sin(a) * d);
      const yaw = rr() * TAU, ax = V3(Math.cos(yaw), 0, Math.sin(yaw)), ay = V3(-Math.sin(yaw), 0.3 + rr() * 0.5, Math.cos(yaw)).normalize();
      card(tuft, c.clone().addScaledVector(ay, -0.5), ax, ay, 1.1, 1.1, i < 4 ? rect : rect2, V3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4).normalize(), [0.8, 0.85, 0.75], [0, 0], rr());
    }
  }
  const tg = tuft.build();
  const lists = [[], []];
  const step = low ? 4 : 2;
  allTops.forEach((t, i) => { if (i % step) return; const s = (t.wall ? 3 + r() * 6 : 10 + r() * 13) * (t.band ? 1.5 : 1); lists[t.band ? 1 : 0].push(new THREE.Matrix4().compose(t.p.clone().add(V3(0, -s * 0.12, 0)), new THREE.Quaternion().setFromAxisAngle(UP, r() * TAU), V3(s, s * 0.55, s))); });
  lists.forEach((l, i) => { if (l.length) group.add(instancedOf(tg, M.pineNeedleFar, null, l, { name: 'karstVeg' + i, cast: false, receive: false })); });
  return { group, towers, waterfalls: falls };
}

// ------------------------------------------------------------------ mist: soft horizontal sheets drifting over the canopy
// all sheets of a set are merged into one mesh (one draw call); uA can be faded by the caller (e.g. by camera height)
export function createMistLayers({ items = [], alpha = 0.5 } = {}) {
  const mat = withFog(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: U.uTime, uNoise: U.uNoise, uA: { value: alpha }, uSnow: U.uSnow }]),
    vertexShader: `varying vec2 vUv; varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime, uA, uSnow; uniform sampler2D uNoise; varying vec2 vUv; varying vec3 vW;
#include <fog_pars_fragment>
void main(){
  vec2 p = vUv - .5;
  float n = texture2D(uNoise, vW.xz*.0021 + vec2(uTime*.002, uTime*.001)).r*.6 + texture2D(uNoise, vW.xz*.0071 - vec2(uTime*.003, 0.)).g*.4;
  float edge = smoothstep(.5, .2, length(p));
  float a = smoothstep(.42, .78, n)*edge*uA*(1. + uSnow*.4);
  vec3 V = normalize(cameraPosition - vW);
  a *= .35 + .65*(1. - abs(V.y));
  gl_FragColor = vec4(vec3(.94, .95, .97), a);
  #include <fog_fragment>
}`,
  }));
  const group = new THREE.Group(); group.name = 'mist';
  const pos = [], uv = [], idx = [];
  for (const it of items) {
    const c = Math.cos(it.ry || 0), sn = Math.sin(it.ry || 0), b = pos.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const lx = (u - 0.5) * it.w, lz = (v - 0.5) * it.d;
      pos.push(it.x + lx * c + lz * sn, it.y, it.z - lx * sn + lz * c);
      uv.push(u, v);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  if (pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 5; m.name = 'mistSheets';
    group.add(m);
  }
  return { group, material: mat };
}

// ------------------------------------------------------------------ mid forest: instanced trees with a trunk and a crown of cards
function cardTree(kind, seed) {
  const r = rng(seed), F = new GeoBuf();
  // trunk: a few cards pointing at the twig line of the atlas (solid bark-coloured strip)
  const tw = cellRect('pineSide');
  const tu = (tw[0] + tw[2]) / 2, tv0 = tw[1] - 0.004, tv1 = tw[1] - 0.006;
  const trunkH = kind === 'pine' ? 0.78 : 0.62, tr = kind === 'pine' ? 0.022 : 0.03;
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI, ax = V3(Math.cos(a), 0, Math.sin(a));
    card(F, V3(0, -0.02, 0), ax, UP, tr * 2, trunkH, [tu - 0.0005, tv0, tu + 0.0005, tv1], V3(Math.cos(a + 1.57), 0.3, Math.sin(a + 1.57)).normalize(), [0.55, 0.5, 0.45], [0, 0.05], 0.5);
  }
  if (kind === 'pine') {
    const rect = cellRect('pineTop'), side = cellRect('pineSide');
    const pads = 4 + Math.floor(r() * 2);
    for (let p = 0; p < pads; p++) {
      const t = p / (pads - 1);
      const y = lerp(0.48, 0.98, t), rad = lerp(0.2, 0.12, t) * (0.8 + r() * 0.4);
      const off = t > 0.9 ? V3() : V3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
      for (let i = 0; i < 4; i++) {
        const a = r() * TAU, d = r() * rad * 0.6;
        const c = off.clone().add(V3(Math.cos(a) * d, y + (r() - 0.5) * 0.03, Math.sin(a) * d));
        const yaw = r() * TAU, ax = V3(Math.cos(yaw), 0, Math.sin(yaw)), ay = V3(-Math.sin(yaw), (r() - 0.5) * 0.25, Math.cos(yaw)).normalize();
        card(F, c.clone().addScaledVector(ay, -rad), ax, ay, rad * 2, rad * 2, rect, V3(Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3).normalize(), [0.85, 0.9, 0.82], [0.25, 0.4], r());
      }
      for (let i = 0; i < 2; i++) {
        const a = r() * TAU, out = V3(Math.cos(a), 0, Math.sin(a));
        const ay = out.clone().multiplyScalar(0.6).add(V3(0, 0.8, 0)).normalize(), ax = V3().crossVectors(ay, UP).normalize();
        card(F, off.clone().add(V3(out.x * rad * 0.6, y - rad * 0.25, out.z * rad * 0.6)), ax, ay, rad * 1.3, rad * 1.5, side, out.clone().add(V3(0, 0.7, 0)).normalize(), [0.8, 0.85, 0.78], [0.25, 0.4], r());
      }
    }
  } else {
    const rects = kind === 'maple' ? [cellRect('mapleA'), cellRect('mapleB')] : [cellRect('broadA'), cellRect('broadB')];
    const cy = 0.66, rad = 0.27;
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, cz = r() * 2 - 1, sz = Math.sqrt(1 - cz * cz);
      const d = V3(Math.cos(a) * sz, cz * 0.7 + 0.15, Math.sin(a) * sz).normalize();
      const c = V3(d.x * rad * 0.75, cy + d.y * rad * 0.7, d.z * rad * 0.75);
      const yaw = r() * TAU, ay = V3(Math.cos(yaw), 0.3 + r() * 0.5, Math.sin(yaw)).lerp(d, 0.4).normalize();
      const ax = V3().crossVectors(ay, UP).normalize();
      if (ax.lengthSq() < 0.01) ax.set(1, 0, 0);
      const sh = 0.6 + 0.4 * clamp(d.y * 0.5 + 0.55);
      card(F, c.clone().addScaledVector(ay, -0.2), ax, ay, 0.4, 0.4, rects[i & 1], d.clone().multiplyScalar(0.7).add(V3(0, 0.6, 0)).normalize(), [sh * 0.95, sh, sh * 0.9], [0.25, 0.45], r());
    }
  }
  return F.build();
}

/**
 * createCardForest(points [[x,z,kind,height]], { groundAt }) kinds: pine | gold | rust | maple
 * -> { group } (one InstancedMesh per kind)
 */
export function createCardForest(points, { groundAt = () => 0, seed = 17, shadows = true } = {}) {
  const M = floraMaterials();
  const r = rng(seed);
  const kinds = {
    pine: { geo: cardTree('pine', seed), mat: M.pineNeedleFar, depth: M.depth.pineNeedle },
    gold: { geo: cardTree('broad', seed + 1), mat: M.ancientLeafBare, depth: M.depth.ancientLeaf },
    rust: { geo: cardTree('broad', seed + 2), mat: M.rustLeafBare, depth: M.depth.rustLeaf },
    maple: { geo: cardTree('maple', seed + 3), mat: M.mapleLeafBare, depth: M.depth.mapleLeaf },
  };
  const lists = {};
  for (const [x, z, kind, h] of points) {
    (lists[kind] = lists[kind] || []).push(new THREE.Matrix4().compose(V3(x, groundAt(x, z) - 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.06, r() * TAU, (r() - 0.5) * 0.06)), V3(h * (kind === 'pine' ? 0.95 : 1) * (0.85 + r() * 0.3), h, h * (0.85 + r() * 0.3))));
  }
  const group = new THREE.Group(); group.name = 'cardForest';
  for (const k in lists) group.add(instancedOf(kinds[k].geo, kinds[k].mat, kinds[k].depth, lists[k], { name: 'cards-' + k, cast: shadows }));
  return { group };
}

// ------------------------------------------------------------------ canopy shell
export function createCanopyShell({ center = [0, 0], size = 2400, segments = 150, groundAt = () => 0, presence = () => 1, height = () => 20, conifer = null } = {}) {
  const N = segments, d = size / N, x0 = center[0] - size / 2, z0 = center[1] - size / 2;
  const Hs = new Float32Array((N + 3) * (N + 3)), Pr = new Float32Array((N + 1) * (N + 1));
  const W = N + 3;
  for (let j = -1; j <= N + 1; j++) for (let i = -1; i <= N + 1; i++) {
    const x = x0 + i * d, z = z0 + j * d;
    const p = presence(x, z);
    Hs[(j + 1) * W + i + 1] = groundAt(x, z) + height(x, z) * p - 1.5 * (1 - p);
    if (i >= 0 && j >= 0 && i <= N && j <= N) Pr[j * (N + 1) + i] = p;
  }
  const pos = [], nor = [], idx = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = (j + 1) * W + i + 1;
    pos.push(x0 + i * d, Hs[k], z0 + j * d);
    const gx = (Hs[k + 1] - Hs[k - 1]) / (2 * d), gz = (Hs[k + W] - Hs[k - W]) / (2 * d), l = Math.hypot(gx, 1, gz);
    nor.push(-gx / l, 1 / l, -gz / l);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, e = c + 1;
    if (Pr[a] + Pr[b] + Pr[c] + Pr[e] < 0.05) continue;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  // conifer share baked from the same function the mid forest uses (128 x 128 over the shell)
  const GN = 128, gd = new Uint8Array(GN * GN * 4);
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
    const v = conifer ? conifer(x0 + (i + 0.5) / GN * size, z0 + (j + 0.5) / GN * size) : 0.4;
    gd.set([Math.round(clamp(v) * 255), 0, 0, 255], (j * GN + i) * 4);
  }
  const grove = new THREE.DataTexture(gd, GN, GN, THREE.RGBAFormat);
  grove.magFilter = grove.minFilter = THREE.LinearFilter; grove.needsUpdate = true;
  const uni = { uCell: { value: 8.5 }, uGrove: { value: grove }, uGroveO: { value: new THREE.Vector2(x0, z0) }, uGroveS: { value: size } };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFW; varying vec3 vFN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFW = (modelMatrix*vec4(transformed,1.)).xyz; vFN = normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vFW; varying vec3 vFN;
uniform sampler2D uNoise, uGrove; uniform float uAutumn, uSnow, uWet, uTime, uCell; uniform vec2 uGroveO; uniform float uGroveS;
float flH1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
vec2 flH2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))))*43758.5453); }
vec3 flCrownN = vec3(0., 1., 0.);`)
      .replace('#include <map_fragment>', `
vec2 wq = vec2(texture2D(uNoise, vFW.xz*.013).r, texture2D(uNoise, vFW.xz*.013 + .5).g) - .5;
vec2 cp = vFW.xz/uCell + wq*1.6;
vec2 ip = floor(cp), fp = fract(cp);
float f1 = 9., f2 = 9., cid = 0., csz = 1.; vec2 co = vec2(0.);
for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
  vec2 gg = vec2(float(i), float(j));
  vec2 hh = flH2(ip + gg);
  float s = .75 + .55*flH1(ip + gg + 3.1);
  vec2 o = gg + .12 + .76*hh - fp;
  float dd = dot(o, o)/(s*s);
  if (dd < f1) { f2 = f1; f1 = dd; cid = flH1(ip + gg + 7.7); co = o/s; csz = s; } else if (dd < f2) f2 = dd;
}
float rr = sqrt(f1);
float gap = smoothstep(0., .22, sqrt(f2) - rr);
float reg2 = texture2D(uNoise, vFW.xz*.0047 + .7).g;
float pine = smoothstep(.3, .7, texture2D(uGrove, (vFW.xz - uGroveO)/uGroveS).r + (cid - .5)*.4);
float leafT = texture2D(uNoise, vFW.xz*.23 + cid).a*.5 + texture2D(uNoise, vFW.xz*.71).r*.3 + texture2D(uNoise, (vFW.xz + co*9.)*.11).g*.2;
// deciduous palette per crown
float turn = smoothstep(cid*.45, cid*.45 + .45, uAutumn);
vec3 summer = mix(vec3(.05, .1, .03), vec3(.1, .16, .045), fract(cid*5.3));
vec3 aut = cid < .42 ? vec3(.5, .3, .05) : cid < .68 ? vec3(.36, .12, .03) : cid < .86 ? vec3(.5, .06, .02) : vec3(.42, .38, .08);
aut = mix(aut, vec3(.12, .17, .05), step(.6, fract(cid*11.7))*.6);
vec3 dec = mix(summer, aut, turn);
vec3 bare = mix(vec3(.055, .047, .04), vec3(.42, .44, .48), .2 + .3*leafT);
dec = mix(dec, bare, smoothstep(.2, .8, uSnow));
vec3 pc = mix(vec3(.02, .045, .025), vec3(.04, .07, .035), fract(cid*7.1));
vec3 col = mix(dec, pc, pine);
col = mix(col, vec3(.13, .2, .06), smoothstep(.72, .8, reg2)*(1. - pine)*.7*(1. - uSnow));
// crown dome, gaps, clumps
float dome = clamp(1. - rr, 0., 1.);
flCrownN = normalize(vec3(-co.x*1.1, .9 + dome*.6 - pine*.25, -co.y*1.1) + (vec3(leafT, .5, texture2D(uNoise, vFW.xz*.47).g) - .5)*.5);
col *= mix(.62, 1., gap)*(.66 + .34*dome)*(.55 + .9*leafT)*(.8 + .4*fract(cid*13.1));
float sn = uSnow*smoothstep(.5, .8, leafT*.8 + flCrownN.y*.35 - .1)*mix(.75, .55, pine);
col = mix(col, vec3(.86, .89, .93)*(.8 + .2*dome), sn);
col *= 1. - uWet*.25;
diffuseColor.rgb = col;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize((viewMatrix*vec4(normalize(normalize(vFN)*.45 + flCrownN), 0.)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'flora-canopyShell';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'canopyShell'; mesh.receiveShadow = false; mesh.castShadow = false;
  return { mesh, material: mat };
}

// ------------------------------------------------------------------ mist puffs: soft upright sheets turned to the camera
// (ground mist among trunks and bamboo, spray at a waterfall's foot). items: [{ x, y (bottom), z, w, h, a }].
// One draw call; fades out within a few metres of the camera so it never smears across the lens.
export function createMistPuffs(items, { alpha = 0.5, color = 0xeef1f2, near = [2.5, 8], drift = 1, name = 'mistPuffs' } = {}) {
  const n = items.length;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const c = new Float32Array(n * 3), sz = new Float32Array(n * 4);
  items.forEach((it, i) => { c.set([it.x, it.y, it.z], i * 3); sz.set([it.w, it.h, it.a ?? 1, it.seed ?? (i * 0.6180339) % 1], i * 4); });
  g.setAttribute('aC', new THREE.InstancedBufferAttribute(c, 3));
  g.setAttribute('aS', new THREE.InstancedBufferAttribute(sz, 4));
  g.instanceCount = n;
  const mat = withFog(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uA: { value: alpha }, uCol: { value: new THREE.Color(color) }, uNear: { value: new THREE.Vector2(...near) }, uDrift: { value: drift } }]),
    vertexShader: `attribute vec3 aC; attribute vec4 aS; uniform vec2 uNear; varying vec2 vUv; varying vec4 vS; varying float vFade;
#include <fog_pars_vertex>
void main(){
  vec3 tc = cameraPosition - aC; tc.y = 0.;
  vec3 rt = normalize(vec3(tc.z, 0., -tc.x) + vec3(1e-4, 0., 0.));
  vec3 P = aC + rt*position.x*aS.x + vec3(0., position.y*aS.y, 0.);
  vUv = vec2(position.x + .5, position.y); vS = aS;
  vFade = smoothstep(uNear.x, uNear.y, length(cameraPosition - P));
  vec4 mvPosition = viewMatrix*vec4(P, 1.); gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime, uA, uDrift; uniform vec3 uCol; uniform sampler2D uNoise; varying vec2 vUv; varying vec4 vS; varying float vFade;
#include <fog_pars_fragment>
void main(){
  vec2 q = vUv*vec2(vS.x, vS.y)*.045 + vec2(vS.w*7.3, vS.w*3.1);
  float n = texture2D(uNoise, q + vec2(uTime*.011, -uTime*.006)*uDrift).r*.62 + texture2D(uNoise, q*2.7 + vec2(-uTime*.017, uTime*.004)*uDrift).g*.38;
  vec2 p = (vUv - vec2(.5, .42))*vec2(2., 2.3);
  float a = smoothstep(1., .25, length(p))*smoothstep(.0, .3, vUv.y)*smoothstep(.12, .98, n + .1)*(1. - .35*smoothstep(.3, .9, vUv.y))*vS.z*uA*vFade;
  gl_FragColor = vec4(uCol, a);
  #include <fog_fragment>
}`,
  }));
  mat.uniforms.uTime = U.uTime; mat.uniforms.uNoise = U.uNoise;
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.name = name;
  return { mesh, material: mat };
}

// a tall waterfall: world-scaled streaks falling from the lip, a soft edge, spray at the foot (uv.y = metres / 10
// below the lip, vV 0 lip .. 1 foot)
function tallFallMaterial({ alpha = 0.95, speed = 1.25, veil = false } = {}) {
  return withFog(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uA: { value: alpha }, uSpeed: { value: speed } }]),
    vertexShader: `attribute float aV; varying vec2 vUv; varying float vV;
#include <fog_pars_vertex>
void main(){ vUv = uv; vV = aV; vec4 mvPosition = modelViewMatrix*vec4(position, 1.); gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime, uSnow, uA, uSpeed; uniform sampler2D uNoise; varying vec2 vUv; varying float vV;
#include <fog_pars_fragment>
void main(){
  float n1 = texture2D(uNoise, vec2(vUv.x*${veil ? '1.1' : '1.9'} + .13, vUv.y*.42 - uTime*uSpeed)).r;
  float n2 = texture2D(uNoise, vec2(vUv.x*${veil ? '2.7' : '5.3'} + .31, vUv.y*1.15 - uTime*uSpeed*1.9)).g;
  float n3 = texture2D(uNoise, vec2(vUv.x*.8 + .7, vUv.y*.11 - uTime*uSpeed*.22)).b;
  float edge = smoothstep(0., .26 + n3*.22, vUv.x)*smoothstep(1., .74 - n3*.22, vUv.x);
  float streak = smoothstep(.3, .82, n1*.6 + n2*.55);
  vec3 col = mix(vec3(.6, .66, .69), vec3(.97, .98, 1.), streak);
  float a = (${veil ? '.25 + .45' : '.38 + .6'}*streak)*edge*smoothstep(0., .03, vV)*uA;
  // the foot: the water breaks into white spray
  a = mix(a, a*.6 + .25*edge*smoothstep(.5, .9, n2 + n3*.3), smoothstep(.82, 1., vV));
  col = mix(col, vec3(.95, .97, 1.), smoothstep(.8, 1., vV)*.6);
  a *= 1. - uSnow*.45;
  col = mix(col, vec3(.86, .9, .95), uSnow*.5);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`,
  }));
}

/**
 * createKarstWall({ foot: [[x,z],...] (where the wall's face meets the ground; the open ground lies to the left of
 *   the line's direction), groundAt, seed, quality, height(s) (front-row tower height by arc length), fall: { pool:[x,z],
 *   waterY, lip (m above the water), material } })
 * -> { group, mesh, towers, fall: { top, bottom, mesh, veil } | null, tops }
 * A limestone escarpment of overlapping towers, its front row fitted so its foot lands on the line; a waterfall from
 * the tallest of them into the pool where the stream begins.
 */
export function createKarstWall(opts = {}) {
  const o = { foot: [], groundAt: () => 0, seed: 77, quality: {}, height: () => 90, fall: null, ...opts };
  const M = floraMaterials();
  const r = rng(o.seed);
  const lo = !!o.quality.low;
  const group = new THREE.Group(); group.name = 'karstWall';
  const B = new GeoBuf();
  const F = o.foot, cum = [0];
  for (let i = 0; i < F.length - 1; i++) cum.push(cum[i] + Math.hypot(F[i + 1][0] - F[i][0], F[i + 1][1] - F[i][1]));
  const L = cum[cum.length - 1];
  const at = s => {
    let i = 0; while (i < F.length - 2 && cum[i + 1] < s) i++;
    const t = clamp((s - cum[i]) / (cum[i + 1] - cum[i]));
    const dx = F[i + 1][0] - F[i][0], dz = F[i + 1][1] - F[i][1], l = Math.hypot(dx, dz);
    return { p: [lerp(F[i][0], F[i + 1][0], t), lerp(F[i][1], F[i + 1][1], t)], out: [dz / l, -dx / l] };
  };
  const towers = [];
  const place = (s, R, H, row) => {
    const { p, out } = at(s);
    const back = row ? R * (1.7 + r() * 0.6) : R * 1.05;
    const cx = p[0] + out[0] * back, cz = p[1] + out[1] * back;
    const base = V3(cx, o.groundAt(cx, cz) - 10, cz);
    const cols = lo ? 34 : row ? 40 : 52, rows = lo ? 26 : row ? 30 : 42;
    const T = tower(B, r, base, H, R, cols, rows);
    if (!row) {
      // fit: the tower's reach toward the open ground, near the ground and beside its placement, lands on the line
      let e = -Infinity;
      for (let k = T.b0; k < T.b1; k++) {
        const y = B.p[k * 3 + 1] - base.y;
        if (y < 8 || y > 20) continue;
        const rx = B.p[k * 3] - p[0], rz = B.p[k * 3 + 2] - p[1];
        if (Math.abs(rx * out[1] - rz * out[0]) > R * 0.55) continue;
        e = Math.max(e, -(rx * out[0] + rz * out[1]));
      }
      if (e > -Infinity) { const v = V3(out[0] * (e + 0.4), 0, out[1] * (e + 0.4)); shiftTower(B, T, v); base.add(v); }
    }
    const t = { s, base, H, R, T, row };
    towers.push(t);
    return t;
  };
  // the fall's tower first (so the rest of the wall's random draws do not move it)
  let fallT = null;
  if (o.fall) {
    let best = Infinity, sf = 0;
    for (let s = 0; s <= L; s += 0.5) { const q = at(s).p, d = Math.hypot(q[0] - o.fall.pool[0], q[1] - o.fall.pool[1]); if (d < best) { best = d; sf = s; } }
    fallT = place(sf, 27, o.height(sf) * 1.08, 0);
  }
  for (let s = 4; s < L - 2; s += 19 + r() * 7) {
    if (fallT && Math.abs(s - fallT.s) < 16) continue;
    place(s, 19 + r() * 11, o.height(s) * (0.82 + r() * 0.3), 0);
  }
  for (let s = 14; s < L; s += 34 + r() * 14) place(s, 26 + r() * 12, o.height(s) * (1.15 + r() * 0.3), 1);
  const mesh = meshOf(B.build(), o.material || M.cliff, null, { name: 'karstWall', cast: false, receive: true });
  group.add(mesh);
  // tufts of pine and shrub on its ledges and crowns
  const tops = [];
  for (const t of towers) { for (const p of t.T.tops) tops.push(p); for (const w of t.T.walls) tops.push(w.p.clone().addScaledVector(w.n, 1.2)); }
  {
    const tuft = new GeoBuf(), rr = rng(o.seed + 5), rect = cellRect('pineTop'), rect2 = cellRect('broadB');
    for (let i = 0; i < 6; i++) {
      const a = rr() * TAU, d = rr() * 0.45;
      const c = V3(Math.cos(a) * d, rr() * 0.3, Math.sin(a) * d);
      const yaw = rr() * TAU, ax = V3(Math.cos(yaw), 0, Math.sin(yaw)), ay = V3(-Math.sin(yaw), 0.3 + rr() * 0.5, Math.cos(yaw)).normalize();
      card(tuft, c.clone().addScaledVector(ay, -0.5), ax, ay, 1.1, 1.1, i < 4 ? rect : rect2, V3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4).normalize(), [0.8, 0.85, 0.75], [0, 0], rr());
    }
    const list = [];
    tops.forEach((p, i) => { if (i % (lo ? 6 : 4)) return; const s = 5 + r() * 10; list.push(new THREE.Matrix4().compose(p.clone().add(V3(0, -s * 0.12, 0)), new THREE.Quaternion().setFromAxisAngle(UP, r() * TAU), V3(s, s * 0.55, s))); });
    if (list.length) group.add(instancedOf(tuft.build(), M.pineNeedleFar, null, list, { name: 'karstWallVeg', cast: false, receive: false }));
  }
  // the waterfall: from a lip on the face of the fall's tower down into the pool, clear of every bulge below the lip
  let fall = null;
  if (fallT) {
    const c = fallT.base, pool = o.fall.pool, wy = o.fall.waterY;
    const dir = V3(pool[0] - c.x, 0, pool[1] - c.z).normalize(), side = V3(-dir.z, 0, dir.x);
    const lipY = wy + (o.fall.lip ?? 52);
    const bin = 1.5, nb = Math.ceil((lipY - wy) / bin) + 1, face = new Float32Array(nb).fill(-1);
    for (let k = fallT.T.b0; k < fallT.T.b1; k++) {
      const x = B.p[k * 3] - c.x, y = B.p[k * 3 + 1], z = B.p[k * 3 + 2] - c.z;
      if (y < wy - 1 || y > lipY + bin) continue;
      const along = x * dir.x + z * dir.z, perp = Math.abs(x * side.x + z * side.z);
      if (along <= 0 || perp > 4.5) continue;
      const b = clamp(Math.round((lipY - y) / bin), 0, nb - 1);
      face[b] = Math.max(face[b], along);
    }
    for (let b = 0; b < nb; b++) if (face[b] < 0) { let k = 1; while (k < nb && face[Math.max(0, b - k)] < 0 && face[Math.min(nb - 1, b + k)] < 0) k++; face[b] = Math.max(face[Math.max(0, b - k)], face[Math.min(nb - 1, b + k)], fallT.R * 0.8); }
    for (let b = 1; b < nb; b++) face[b] = Math.max(face[b], face[b - 1]);
    const mk = (w0, w1, gap0, gap1, alpha, veil) => {
      const rows = nb - 1, pos = [], uv = [], av = [], idx = [];
      for (let i = 0; i <= rows; i++) {
        const v = i / rows, y = lerp(lipY, wy + 0.05, v);
        const d = face[i] + lerp(gap0, gap1, v * v);
        const w = lerp(w0, w1, Math.pow(v, 0.8));
        for (const u of [0, 1]) {
          const p = V3(c.x, y, c.z).addScaledVector(dir, d).addScaledVector(side, (u - 0.5) * w);
          pos.push(p.x, p.y, p.z); uv.push(u, (lipY - y) / 10); av.push(v);
        }
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('aV', new THREE.Float32BufferAttribute(av, 1));
      g.setIndex(idx); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, tallFallMaterial({ alpha, veil }));
      m.renderOrder = 3; m.name = veil ? 'cliffFallVeil' : 'cliffFall';
      return m;
    };
    const core = mk(3.4, 6.8, 0.7, 2.0, 0.95, false), veil = mk(6.5, 11, 1.3, 3.4, 0.4, true);
    group.add(core, veil);
    const top = V3(c.x, lipY, c.z).addScaledVector(dir, face[0] + 0.7), bottom = V3(c.x, wy, c.z).addScaledVector(dir, face[nb - 1] + 2);
    // spray drifting off the foot of the fall over the pool
    const puffs = [];
    for (let i = 0; i < 9; i++) {
      const a = (r() - 0.5) * 2.4, d = 1 + r() * 7;
      const q = bottom.clone().addScaledVector(dir, d * Math.cos(a) * 0.8).addScaledVector(side, d * Math.sin(a));
      puffs.push({ x: q.x, y: wy - 0.4 + r() * 2.5, z: q.z, w: 6 + r() * 6, h: 4 + r() * 5, a: 0.5 + r() * 0.5, seed: r() });
    }
    const spray = createMistPuffs(puffs, { alpha: 0.42, color: 0xf2f5f6, near: [3, 9], drift: 2.5, name: 'cliffSpray' });
    group.add(spray.mesh);
    fall = { top, bottom, mesh: core, veil, spray: spray.mesh, dir };
  }
  return { group, mesh, towers, fall, tops };
}
