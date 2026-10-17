// Flora core: noise, geometry builders (swept limbs, cards) and the shader patch shared by every
// Forbidden Forest asset. Materials react to the same global story uniforms as materials.js (U: wind, gust,
// snow, autumn, wet, blossom, moss) but work for merged *and* instanced meshes (wind and seasons in world space).
import * as THREE from 'three';
import { U } from './materials.js';
import { rng, clamp, lerp, smooth } from './util.js';

export { U, rng, clamp, lerp, smooth };
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const TAU = Math.PI * 2;
// where moss takes over every surface of the ancient tree (xyz world centre, w radius; w = 0: off): the nook
export const MOSS_FOCUS = { value: new THREE.Vector4(0, 0, 0, 0) };
// 0 on the ground, 1 seen from the air: bark is then painted by the ink pass as masses, not outlined
export const FL_AIR = { value: 0 };

// ------------------------------------------------------------------ noise (improved Perlin, deterministic)
const PERM = new Uint8Array(512);
{
  const r = rng(1337), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
export function noise3(x, y, z) {
  let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
  const u = fade(x), v = fade(y), w = fade(z);
  const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z, B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
  const l1 = lerp(grad(PERM[AA] & 15, x, y, z), grad(PERM[BA] & 15, x - 1, y, z), u);
  const l2 = lerp(grad(PERM[AB] & 15, x, y - 1, z), grad(PERM[BB] & 15, x - 1, y - 1, z), u);
  const l3 = lerp(grad(PERM[AA + 1] & 15, x, y, z - 1), grad(PERM[BA + 1] & 15, x - 1, y, z - 1), u);
  const l4 = lerp(grad(PERM[AB + 1] & 15, x, y - 1, z - 1), grad(PERM[BB + 1] & 15, x - 1, y - 1, z - 1), u);
  return lerp(lerp(l1, l2, v), lerp(l3, l4, v), w);
}
export function fbm3(x, y, z, oct = 4, lac = 2.03, gain = 0.5) {
  let s = 0, a = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise3(x, y, z) * a; n += a; a *= gain; x *= lac; y *= lac; z *= lac; }
  return s / n;
}
export function ridged3(x, y, z, oct = 4) {
  let s = 0, a = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += (1 - Math.abs(noise3(x, y, z))) * a; n += a; a *= 0.5; x *= 2.1; y *= 2.1; z *= 2.1; }
  return s / n;
}
export const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ------------------------------------------------------------------ geometry accumulation
// Every flora geometry carries: position, normal, uv, color (AO / tint), aSway (0 base .. 1+ tips), aRnd (per card).
export class GeoBuf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.s = []; this.r = []; this.i = []; }
  get count() { return this.p.length / 3; }
  v(px, py, pz, nx, ny, nz, u, v, cr = 1, cg = 1, cb = 1, sw = 0, rn = 0) {
    this.p.push(px, py, pz); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(cr, cg, cb); this.s.push(sw); this.r.push(rn);
    return this.p.length / 3 - 1;
  }
  t(a, b, c) { this.i.push(a, b, c); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.s, 1));
    g.setAttribute('aRnd', new THREE.Float32BufferAttribute(this.r, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// Recompute normals of a (rows+1) x (cols+1) vertex grid written at `base` into buf, wrapping around columns
// (col 0 and col `cols` coincide). Normals are oriented to agree with `outward` sign hints already stored in buf.n.
export function gridNormals(buf, base, rows, cols, wrap = true) {
  const P = buf.p, N = buf.n, W = cols + 1;
  const at = (i, j) => (base + i * W + j) * 3;
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const jm = j > 0 ? j - 1 : (wrap ? cols - 1 : 0), jp = j < cols ? j + 1 : (wrap ? 1 : cols);
    const im = Math.max(0, i - 1), ip = Math.min(rows, i + 1);
    const a = at(i, jm), b = at(i, jp), c = at(im, j), d = at(ip, j);
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[d] - P[c], vy = P[d + 1] - P[c + 1], vz = P[d + 2] - P[c + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const k = at(i, j);
    if (nx * N[k] + ny * N[k + 1] + nz * N[k + 2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    N[k] = nx / l; N[k + 1] = ny / l; N[k + 2] = nz / l;
  }
}

// Index a grid so faces point along the stored (outward) normals.
export function gridIndex(buf, base, rows, cols) {
  const W = cols + 1, P = buf.p, N = buf.n;
  // decide winding from the first quad
  const a = base, b = base + 1, c = base + W;
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const flip = nx * N[a * 3] + ny * N[a * 3 + 1] + nz * N[a * 3 + 2] < 0;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const p = base + i * W + j, q = p + 1, r = p + W, s = r + 1;
    if (flip) { buf.t(p, r, q); buf.t(q, r, s); } else { buf.t(p, q, r); buf.t(q, s, r); }
  }
}

const _up = new THREE.Vector3(0, 1, 0);
// Sweep an (elliptical, displaced) cross-section along a smooth curve through `pts`.
// o: { radial, segLen | segments, radius(t, s), aspect(t) (height/width), upAlign (0..1, keep the section's
//      "height" axis vertical, for roots), displace(t, a, P, dir, s) -> metres, color(t, a, pos, dir) -> [r,g,b],
//      sway(t, pos) -> float, uRep (texture repeats around), vScale (texture units per metre along), rnd }
// Returns { base, rows, cols, curve, length }.
export function sweep(buf, pts, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const L = curve.getLength();
  const rows = o.segments || Math.max(2, Math.ceil(L / (o.segLen || 0.25)));
  const cols = o.radial || 8;
  const P = [], T = [], Nn = [], Bn = [];
  for (let i = 0; i <= rows; i++) { const t = i / rows; P.push(curve.getPointAt(t)); T.push(curve.getTangentAt(t).normalize()); }
  // frames: parallel transport, optionally pulled toward world-up
  for (let i = 0; i <= rows; i++) {
    const t = T[i];
    let n;
    if (i === 0) {
      n = _up.clone().addScaledVector(t, -t.dot(_up));
      if (n.lengthSq() < 1e-4) n = V3(1, 0, 0).addScaledVector(t, -t.x);
    } else {
      n = Nn[i - 1].clone().addScaledVector(t, -Nn[i - 1].dot(t));
    }
    n.normalize();
    if (o.upAlign) {
      const nu = _up.clone().addScaledVector(t, -t.dot(_up));
      const l = nu.length();
      if (l > 0.2) n.lerp(nu.multiplyScalar(1 / l), o.upAlign * smooth(0.2, 0.5, l)).normalize();
    }
    Nn.push(n);
    Bn.push(V3().crossVectors(t, n).normalize());
  }
  const base = buf.count;
  const uRep = o.uRep ?? 1, vScale = o.vScale ?? 1;
  const dir = V3(), pos = V3();
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, s = t * L;
    const r = o.radius ? o.radius(t, s) : 0.1;
    const asp = o.aspect ? o.aspect(t) : 1;
    for (let j = 0; j <= cols; j++) {
      const a = (j / cols) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      dir.copy(Bn[i]).multiplyScalar(ca).addScaledVector(Nn[i], sa * asp);
      const dl = dir.length();
      let rr = r;
      if (o.displace) rr += o.displace(t, a, P[i], dir, s, r) * dl;
      pos.copy(P[i]).addScaledVector(dir, rr);
      // outward hint: ellipse normal
      const hx = Bn[i].x * ca + Nn[i].x * sa / asp, hy = Bn[i].y * ca + Nn[i].y * sa / asp, hz = Bn[i].z * ca + Nn[i].z * sa / asp;
      const col = o.color ? o.color(t, a, pos, dir, s) : null;
      buf.v(pos.x, pos.y, pos.z, hx, hy, hz, (j / cols) * uRep, s * vScale,
        col ? col[0] : 1, col ? col[1] : 1, col ? col[2] : 1, o.sway ? o.sway(t, pos) : 0, o.rnd ?? 0);
    }
  }
  gridNormals(buf, base, rows, cols, true);
  gridIndex(buf, base, rows, cols);
  return { base, rows, cols, curve, length: L, P, T, N: Nn, B: Bn };
}

// One quad card. p: attach point, ax: unit across, ay: unit along (base -> tip), w,h size; rect [u0,v0,u1,v1]
// with v0 at the base. n: normal (Vector3) or function(vertexPos) -> Vector3. sw: [baseSway, tipSway].
export function card(buf, p, ax, ay, w, h, rect, n, shade, sw, rnd, center = false) {
  const ox = center ? -h / 2 : 0;
  const pts = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
  const uvs = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]];
  const base = buf.count;
  const q = V3();
  for (let k = 0; k < 4; k++) {
    q.copy(p).addScaledVector(ax, pts[k][0] * w).addScaledVector(ay, pts[k][1] * h + ox);
    const nn = typeof n === 'function' ? n(q, pts[k]) : n;
    const sh = Array.isArray(shade) ? shade : [shade, shade, shade];
    buf.v(q.x, q.y, q.z, nn.x, nn.y, nn.z, uvs[k][0], uvs[k][1], sh[0], sh[1], sh[2], lerp(sw[0], sw[1], pts[k][1]), rnd);
  }
  buf.t(base, base + 1, base + 2); buf.t(base, base + 2, base + 3);
}

// ------------------------------------------------------------------ materials
// fpatch(material, opts) injects wind + seasons into a MeshStandardMaterial.
// kinds: 'bark' (UV-mapped map/normalMap, moss/lichen/snow/wet), 'rock' (world triplanar map/normalMap, moss/
// lichen/snow), 'leaf' (data atlas: R shade, G per-leaf random, B leaf vs twig, A coverage; seasonal palette,
// translucency, unflipped soft normals, winter leaf drop), 'plain' (seasons only).
const GLSL_V_HEAD = `
attribute float aSway; attribute float aRnd;
varying vec3 vFW; varying vec3 vFN; varying float vFRnd; varying float vFSway; varying vec3 vFO; varying vec3 vFON;
#ifdef FL_TRUNK
varying vec3 vFM0; varying vec3 vFM1; varying vec3 vFM2;
#endif
uniform float uTime, uWind, uFlutter; uniform vec2 uGust;
vec3 flWindOff(vec3 w, float s){
  float ph = uTime*1.6 + w.x*.23 + w.z*.19;
  float g = (sin(ph)*.55 + sin(ph*2.37+1.3)*.3 + sin(ph*5.3+w.y)*.15)*uWind;
  vec3 o = vec3(uGust.x, 0., uGust.y)*g*s*.32;
  o.y -= abs(g)*s*.05;
  float f = sin(uTime*6.3 + w.x*2.7 + w.y*1.9 + w.z*2.3)*uWind*uFlutter*s;
  o += vec3(f, f*.6, -f*.8)*.05;
  return o;
}`;
const GLSL_V_BODY = (wind, normals = true) => `
mat4 flM = modelMatrix;
#ifdef USE_INSTANCING
flM = modelMatrix * instanceMatrix;
#endif
vec3 flWP = (flM * vec4(transformed, 1.)).xyz;
vFRnd = aRnd;
#ifdef USE_INSTANCING
vFRnd = fract(aRnd + fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453));
#endif
vFSway = aSway; vFO = transformed;
#ifdef FL_TRUNK
vFM0 = normalize(flM[0].xyz); vFM1 = normalize(flM[1].xyz); vFM2 = normalize(flM[2].xyz);
#endif
${wind ? '{ vec3 flO = flWindOff(flWP, aSway); transformed += inverse(mat3(flM)) * flO; flWP += flO; }' : ''}
vFW = flWP;
${normals ? 'vFN = normalize(mat3(flM) * objectNormal); vFON = objectNormal;' : 'vFN = vec3(0., 1., 0.); vFON = vFN;'}`;

const GLSL_F_HEAD = `
varying vec3 vFW; varying vec3 vFN; varying float vFRnd; varying float vFSway; varying vec3 vFO; varying vec3 vFON;
uniform vec2 uTrunkTile; uniform float uTrunkShear;
#ifdef FL_TRUNK
varying vec3 vFM0; varying vec3 vFM1; varying vec3 vFM2;
#endif
uniform float uTime, uSnow, uAutumn, uWet, uBlossom, uMoss; uniform sampler2D uNoise;
uniform float uMossAmt, uSnowAmt, uLichen, uTriScale, uWetAmt; uniform vec3 uMossA, uMossB; uniform vec4 uMossH, uMossF;
uniform sampler2D tMoss; uniform float uFlAir;
uniform vec3 uLeafA, uLeafB, uAutA, uAutB, uAutC, uBlossomC, uTwig; uniform float uAutAmt, uBlossomAmt, uDrop, uTrans, uAtlas, uSnowLeaf;
uniform vec3 uTransCol; uniform float uLitter, uBare;
float flMoss = 0., flSnow = 0.;
float flNz(vec2 p){ return texture2D(uNoise, p).r; }
`;

const GLSL_LEAF_MAP = `
vec4 flT = texture2D(map, vMapUv);
float flLR = fract(flT.g + vFRnd*.61803);
float flTurn = smoothstep(flLR*.6, flLR*.6 + .4, uAutumn*uAutAmt);
vec3 flCol = mix(uLeafA, uLeafB, smoothstep(.1, .9, fract(flLR*1.7)));
vec3 flAut = mix(uAutA, uAutB, smoothstep(.2, .8, fract(flLR*3.7)));
flAut = mix(flAut, uAutC, step(.82, fract(flLR*7.3)));
flCol = mix(flCol, flAut, flTurn);
flCol = mix(flCol, uBlossomC, uBlossom*uBlossomAmt*step(.72, fract(flLR*5.1)));
flCol *= (.3 + flT.r*1.25);
flCol = mix(uTwig*(.45 + flT.r*.8), flCol, smoothstep(.3, .7, flT.b));
diffuseColor.rgb *= flCol;
float flA = flT.a;
{ vec2 flD1 = dFdx(vMapUv*uAtlas), flD2 = dFdy(vMapUv*uAtlas); float flMip = .5*log2(max(max(dot(flD1,flD1), dot(flD2,flD2)), 1e-6)); flA *= 1. + max(flMip, 0.)*.22; }
diffuseColor.a = clamp((flA - .5)/max(fwidth(flA), 1e-4) + .5, 0., 1.);
float flDrop = uDrop * clamp(uSnow*1.15 + smoothstep(.8, 1., uAutumn)*.12, 0., 1.);
if (uLitter > .5) flDrop = 1. - (.28 + .72*uAutumn)*(1. - uSnow*.92);
if (fract(vFRnd*7.13 + flLR*.2) < flDrop*.97) {
  if (uBare < .5 || fract(flLR*13.7 + vFRnd*3.1) > .17) discard;
  diffuseColor.rgb = uTwig*(.45 + flT.r*.5);
}
`;

const GLSL_ROCK_MAP = `
vec3 flTW = pow(abs(normalize(vFN)), vec3(4.)); flTW /= dot(flTW, vec3(1.));
vec3 flTP = vFW * uTriScale;
vec4 flTx = texture2D(map, flTP.zy)*flTW.x + texture2D(map, flTP.xz)*flTW.y + texture2D(map, flTP.xy)*flTW.z;
diffuseColor *= flTx;
`;

const GLSL_TRUNK_MAP = `
vec3 flTN = normalize(vFON);
vec2 flTWt = pow(abs(flTN.xz) + 1e-4, vec2(10.)); flTWt /= (flTWt.x + flTWt.y);
float flSX = flTN.x < 0. ? -1. : 1., flSZ = flTN.z < 0. ? -1. : 1.;
vec2 flUX = vec2((vFO.z - flSX*uTrunkShear*vFO.y)*flSX, vFO.y)*uTrunkTile;
vec2 flUZ = vec2((vFO.x + flSZ*uTrunkShear*vFO.y)*-flSZ, vFO.y)*uTrunkTile;
diffuseColor *= texture2D(map, flUX)*flTWt.x + texture2D(map, flUZ)*flTWt.y;
`;
const GLSL_TRUNK_NORMAL = `
#ifdef USE_NORMALMAP
{
  vec3 wn = flTN;
  vec3 tx = texture2D(normalMap, flUX).xyz*2. - 1.;
  vec3 tz = texture2D(normalMap, flUZ).xyz*2. - 1.;
  float flFlat = 1. - .8*max(flMoss, flSnow);
  tx.xy *= normalScale*flFlat; tz.xy *= normalScale*flFlat;
  tx.x *= flSX; tz.x *= -flSZ;
  tx = vec3(tx.xy + wn.zy, abs(tx.z)*wn.x);
  tz = vec3(tz.xy + wn.xy, abs(tz.z)*wn.z);
  vec3 flON = normalize(tx.zyx*flTWt.x + tz.xyz*flTWt.y);
  normal = normalize((viewMatrix*vec4(normalize(mat3(vFM0, vFM1, vFM2)*flON), 0.)).xyz);
}
#endif
`;

const GLSL_SEASONS = (kind) => `
{
  vec3 flWN = normalize(vFN);
  float flUp = flWN.y;
  float flN1 = texture2D(uNoise, vFW.xz*.11 + vFW.y*.07).g;
  float flN2 = texture2D(uNoise, vFW.xz*.83 + vFW.y*.61).r;
  float flN3 = texture2D(uNoise, vec2(vFW.x + vFW.z, vFW.y)*.045 + .3).b;
  float flAO = clamp(dot(vColor, vec3(.3333)), 0., 1.2);
  ${kind === 'leaf' ? `
  flSnow = uSnow*uSnowLeaf*smoothstep(.25, .7, flUp + (flN2 - .5)*.6)*(.45 + .55*step(.3, fract(vFRnd*5.31)));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.86, .89, .93)*(.55 + .45*flAO), flSnow);
  diffuseColor.rgb *= 1. - uWet*.25*(1. - flSnow);` : `
  float flH = uMossH.x > 0. ? 1. - smoothstep(uMossH.y, uMossH.x, vFW.y - uMossH.z) : 1.;
  float flMK = flUp*.7 + flN1*.45 + (1. - flAO)*.18 + uMossH.w;
  flMoss = uMoss*uMossAmt*smoothstep(.6, .8, flMK)*flH;
  float flFocus = 0.;
  if (uMossF.w > 0.) {
    // the nook: a deep, soft pelt of moss over roots and trunk foot, a little bark showing at its ragged edge
    float flF = 1. - smoothstep(uMossF.w*.45, uMossF.w, length((vFW - uMossF.xyz)*vec3(1., 1.9, 1.)));
    float flFP = smoothstep(.36, .56, flN1*.5 + flN3*.3 + flUp*.35 + flF*.35);
    flFocus = flF*flFP;
    flMoss = max(flMoss, min(1., uMoss*1.25)*flFocus);
  }
  vec3 flAN = abs(flWN);
  vec3 flMT = texture2D(tMoss, (flAN.y > .62 ? vFW.xz : flAN.x > flAN.z ? vFW.zy : vFW.xy)*4.3 + .37).rgb;
  float flGr = texture2D(uNoise, vFW.xz*13.7 + vFW.y*9.1).a;
  vec3 flMC = mix(uMossB, uMossA, smoothstep(.2, .85, flN2*.45 + flMT.g*.45 + flUp*.25 + flGr*.2 - .12))*(.66 + flMT.r*.32 + flGr*.3);
  // deep green where the moss is thick (the nook), with light tips catching the light
  flMC = mix(flMC, mix(uMossB*.85, uMossA*.85, smoothstep(.2, 1.1, flMT.g*.6 + flGr*.4 + flN2*.3))*(.66 + flMT.r*.42), flFocus*.45);
  diffuseColor.rgb = mix(diffuseColor.rgb, flMC*(.45 + .55*flAO), flMoss);
  float flLi = smoothstep(.66, .7, texture2D(uNoise, vFW.xz*1.7 + vFW.y*1.3 + .5).a) * uLichen * (1. - flMoss);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.5, .54, .46)*(.6 + .4*flAO), flLi*.7);
  flSnow = uSnow*uSnowAmt*smoothstep(.42, .72, flUp + (flN2 - .5)*.35);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.88, .91, .95)*(.6 + .4*flAO), flSnow);
  diffuseColor.rgb *= 1. - uWet*uWetAmt*.38*(1. - flSnow);`}
}
`;

const GLSL_ROCK_NORMAL = `
#ifdef USE_NORMALMAP
{
  vec3 wn = normalize(vFN);
  vec3 tx = texture2D(normalMap, flTP.zy).xyz*2. - 1.;
  vec3 ty = texture2D(normalMap, flTP.xz).xyz*2. - 1.;
  vec3 tz = texture2D(normalMap, flTP.xy).xyz*2. - 1.;
  float flFlat = 1. - .75*max(flMoss, flSnow);
  tx.xy *= normalScale*flFlat; ty.xy *= normalScale*flFlat; tz.xy *= normalScale*flFlat;
  tx = vec3(tx.xy + wn.zy, abs(tx.z)*wn.x);
  ty = vec3(ty.xy + wn.xz, abs(ty.z)*wn.y);
  tz = vec3(tz.xy + wn.xy, abs(tz.z)*wn.z);
  vec3 flWN2 = normalize(tx.zyx*flTW.x + ty.xzy*flTW.y + tz.xyz*flTW.z);
  normal = normalize((viewMatrix*vec4(flWN2, 0.)).xyz);
}
#endif
`;

const GLSL_LEAF_LIGHT = `
void RE_Direct_Flora(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
  float bk = saturate(dot(-geometryNormal, directLight.direction)*.6 + .4);
  float fw = pow(saturate(dot(-geometryViewDir, directLight.direction)), 5.);
  reflectedLight.directDiffuse += directLight.color*material.diffuseColor*uTransCol*uTrans*(bk*.35 + fw*1.6);
}
#undef RE_Direct
#define RE_Direct RE_Direct_Flora
`;

let _mossTex = null;
export function setMossTexture(t) { _mossTex = t; }

const col = (c) => (c && c.isColor) ? c : new THREE.Color(c ?? 0xffffff);

export function fpatch(mat, o = {}) {
  const kind = o.kind || 'bark', wind = !!o.wind;
  const uni = {
    uMossAmt: { value: o.moss ?? 0 }, uMossA: { value: col(o.mossA ?? 0xa3ad44) }, uMossB: { value: col(o.mossB ?? 0x4a5c1e) },
    uMossH: { value: new THREE.Vector4(...(o.mossH || [0, 0, 0, 0])) },
    uSnowAmt: { value: o.snow ?? 1 }, uLichen: { value: o.lichen ?? 0 }, uTriScale: { value: o.tri ?? 0.5 }, uWetAmt: { value: o.wet ?? 1 },
    uFlutter: { value: o.flutter ?? 0 },
    tMoss: { value: o.mossTex || _mossTex },
    uLeafA: { value: col(o.leafA ?? 0x3f6a22) }, uLeafB: { value: col(o.leafB ?? 0x6b8a2c) },
    uAutA: { value: col(o.autA ?? 0xb02a12) }, uAutB: { value: col(o.autB ?? 0xe0731c) }, uAutC: { value: col(o.autC ?? 0xd9a62a) },
    uAutAmt: { value: o.autAmt ?? 1 }, uBlossomC: { value: col(o.blossomC ?? 0xf2c2cf) }, uBlossomAmt: { value: o.blossom ?? 0 },
    uTrunkTile: { value: new THREE.Vector2(...(o.trunkTile || [1 / 1.2, 1 / 2.4])) }, uTrunkShear: { value: o.trunkShear ?? 0.045 },
    uTwig: { value: col(o.twig ?? 0x4a3a2c) }, uDrop: { value: o.drop ?? 0 }, uTrans: { value: o.trans ?? 0.5 },
    uTransCol: { value: col(o.transCol ?? 0xc8d070) }, uAtlas: { value: o.atlasSize ?? 2048 }, uSnowLeaf: { value: o.snowLeaf ?? 0.6 }, uLitter: { value: o.litter ? 1 : 0 }, uBare: { value: o.bare ? 1 : 0 },
    uMossF: o.mossFocus ? MOSS_FOCUS : { value: new THREE.Vector4(0, 0, 0, 0) }, uFlAir: FL_AIR,
  };
  mat.userData.flora = { kind, uniforms: uni };
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  const transform = (v, f) => {
    const defs = kind === 'trunk' ? '#define FL_TRUNK\n' : '';
    v = v.replace('#include <common>', '#include <common>\n' + defs + GLSL_V_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLSL_V_BODY(wind, true));
    f = f.replace('#include <common>', '#include <common>\n' + defs + GLSL_F_HEAD);
    if (kind === 'leaf') {
      f = f.replace('#include <map_fragment>', GLSL_LEAF_MAP)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal); nonPerturbedNormal = normal;')
        .replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + GLSL_LEAF_LIGHT);
    } else if (kind === 'rock') {
      f = f.replace('#include <map_fragment>', GLSL_ROCK_MAP)
        .replace('#include <normal_fragment_maps>', GLSL_ROCK_NORMAL);
    } else if (kind === 'trunk') {
      f = f.replace('#include <map_fragment>', GLSL_TRUNK_MAP)
        .replace('#include <normal_fragment_maps>', GLSL_TRUNK_NORMAL);
    } else if (kind === 'bark') {
      f = f.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, .8*max(flMoss, flSnow)));');
    }
    if (kind !== 'plain' || o.seasons !== false) f = f.replace('#include <color_fragment>', '#include <color_fragment>\n' + GLSL_SEASONS(kind));
    f = f.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .32, uWet*(1. - flSnow)*.8); roughnessFactor = mix(roughnessFactor, 1., flMoss*.8);');
    // seen from the air the ink paints trunks, branches and stones as masses (scene alpha 0.97), not outlines
    if (kind !== 'leaf' && o.airMass !== false) f = f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n#ifdef OPAQUE\nif (uFlAir > .5) gl_FragColor.a = .97;\n#endif');
    if (o.fragExtra) f = o.fragExtra(f);
    if (o.vertExtra) v = o.vertExtra(v);
    return [v, f];
  };
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    Object.assign(sh.uniforms, U, uni);
    [sh.vertexShader, sh.fragmentShader] = transform(sh.vertexShader, sh.fragmentShader);
  };
  // (keyed by the code it makes, not by its name: on Windows each program takes the driver a fraction of a second
  // to compile, and kinds that differ only in their uniforms — pine and maple bark, fern and bamboo leaves — were
  // compiled once each, 53 programs for identical code)
  let key = null;
  mat.customProgramCacheKey = () => {
    if (key === null) {
      const lib = THREE.ShaderLib[SHADER_LIB[mat.type] || 'physical'];
      const [v, f] = transform(lib.vertexShader, lib.fragmentShader);
      key = codeKey('flora', v, f) + '|' + prevKey;
    }
    return key;
  };
  if (!mat.vertexColors) mat.vertexColors = true;
  return mat;
}

// a short key for a piece of shader code (two 32-bit hashes)
const SHADER_LIB = { MeshStandardMaterial: 'physical', MeshPhysicalMaterial: 'physical', MeshLambertMaterial: 'lambert', MeshPhongMaterial: 'phong', MeshBasicMaterial: 'basic', MeshToonMaterial: 'toon' };
export function codeKey(prefix, ...parts) {
  const s = parts.join('\u0000');
  let a = 2166136261, b = 5381;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = (Math.imul(b, 33) ^ c) | 0; }
  return `${prefix}-${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}

// Shadow depth material matching fpatch's wind and leaf drop (alpha from the material's map, set by three).
export function fdepth(mat, o = {}) {
  const wind = !!o.wind, leaf = (mat.userData.flora && mat.userData.flora.kind === 'leaf');
  const uni = mat.userData.flora ? mat.userData.flora.uniforms : {};
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_V_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLSL_V_BODY(wind, false));
    if (leaf) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFRnd; varying vec3 vFW; varying vec3 vFN; varying float vFSway; uniform float uSnow, uAutumn, uDrop;')
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
#ifdef USE_MAP
{ float flLR = fract(texture2D(map, vMapUv).g + vFRnd*.61803);
  float flDrop = uDrop * clamp(uSnow*1.15 + smoothstep(.8, 1., uAutumn)*.12, 0., 1.);
  if (fract(vFRnd*7.13 + flLR*.2) < flDrop*.96) discard; }
#endif`);
    }
  };
  d.customProgramCacheKey = () => `flora-depth-${wind}-${leaf}`;
  return d;
}

// Mesh helpers ------------------------------------------------------------------
export function meshOf(geo, mat, depth, { cast = true, receive = true, name = '' } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive; m.name = name;
  if (depth) m.customDepthMaterial = depth;
  return m;
}
export function instancedOf(geo, mat, depth, matrices, { cast = true, receive = true, name = '' } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, matrices.length));
  matrices.forEach((mm, i) => m.setMatrixAt(i, mm));
  m.count = matrices.length;
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = cast; m.receiveShadow = receive; m.name = name;
  if (depth) m.customDepthMaterial = depth;
  m.computeBoundingSphere();
  return m;
}
export const compose = (x, y, z, ry = 0, s = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V3(s, s, s));

// Count triangles / draw calls in a subtree (main pass, instanced counted fully).
export function stats(root) {
  let tris = 0, calls = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    const inst = o.isInstancedMesh ? o.count : 1;
    tris += n * inst; calls++;
  });
  return { tris: Math.round(tris), calls };
}
