// The scroll, crystallized by time: a cluster of pale jade-and-amber crystal grown among the roots, the rolled scroll
// lying inside it, a faint gold glow in its heart; roots and moss grown over its ends.
//   const c = createScrollCrystal({ position, axis, seed, rootMaterial, mossMaterial });
//   scene.add(c.group);  // every frame: c.update(time, { glow, crack, shatter })  (a pure function of its inputs)
//   relic scroll at rest:  scroll.group.position.copy(c.scrollPose.position); scroll.group.quaternion.copy(c.scrollPose.quaternion);
// glow 0..1: the gold inside wakes. crack 0..1: lines of gold light spread from where he touches it (c.touchPoint).
// blood 0..1: his blood where it fell on it (at c.touchPoint), seeping into the seams near it as they open.
// shatter 0..1: the crystal breaks into fragments that drift outward and up, dissolve into gold light and motes, and
// leave the scroll free where it lay.
import * as THREE from 'three';
import { U } from './materials.js';
import { FOGU } from './atmosphere.js';
import { rng, clamp, lerp, V3, TAU, sweep, GeoBuf, meshOf } from './flora-core.js';

const UP = V3(0, 1, 0);
// the relic scroll (relic.js createScroll) rolled up: a roller along its local +z, 0.57 m with the knobs, its centre
// 0.043 m above the group origin
const ROLL_LIFT = 0.043, ROLL_HALF = 0.29;
const CORE_Y = 0.105;          // the crystal's axis (and the scroll's roll axis) above the ground: sunk to its waist

// ------------------------------------------------------------------ geometry: convex pieces with per-piece attributes
class Pieces {
  constructor() { this.p = []; this.c = []; this.d = []; this.s = []; this.k = []; }
  // one triangle of piece `pc` ({ c: centre, d: drift, s: [axis xyz, spin], k: [delay, core] })
  tri(a, b, c, pc, inner = 0) {
    for (const v of [a, b, c]) {
      this.p.push(v.x, v.y, v.z);
      this.c.push(pc.c.x, pc.c.y, pc.c.z); this.d.push(pc.d.x, pc.d.y, pc.d.z);
      this.s.push(...pc.s); this.k.push(pc.k[0], pc.k[1], inner);
    }
  }
  // a closed convex piece from rings of points (each ring: same vertex count), capped at both ends (fan)
  rings(R, pc, capA = true, capB = true, innerA = 0, innerB = 0) {
    const n = R[0].length;
    for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < n; j++) {
      const a = R[i][j], b = R[i][(j + 1) % n], c = R[i + 1][(j + 1) % n], d = R[i + 1][j];
      this.tri(a, b, c, pc); this.tri(a, c, d, pc);
    }
    const fan = (ring, flip, inner) => { const cen = ring.reduce((s, v) => s.add(v), V3()).multiplyScalar(1 / n); for (let j = 0; j < n; j++) flip ? this.tri(cen, ring[(j + 1) % n], ring[j], pc, inner) : this.tri(cen, ring[j], ring[(j + 1) % n], pc, inner); };
    if (capA) fan(R[0], true, innerA);
    if (capB) fan(R[R.length - 1], false, innerB);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('aC', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aD', new THREE.Float32BufferAttribute(this.d, 3));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(this.s, 4));
    g.setAttribute('aK', new THREE.Float32BufferAttribute(this.k, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
const ringAt = (o, ax, u, v, r, n, rot, jit) => { const out = []; for (let j = 0; j < n; j++) { const a = rot + j / n * TAU; const rr = r * (jit ? jit[j] : 1); out.push(o.clone().addScaledVector(u, Math.cos(a) * rr).addScaledVector(v, Math.sin(a) * rr)); } return out; };
const basisOf = ax => { const a = ax.clone().normalize(); const t = Math.abs(a.y) > 0.9 ? V3(1, 0, 0) : UP; const u = V3().crossVectors(a, t).normalize(); const v = V3().crossVectors(a, u).normalize(); return { a, u, v }; };

function buildCrystal(r) {
  const P = new Pieces();
  const piece = (c, d, core) => { const ax = V3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(); return { c, d: d.clone(), s: [ax.x, ax.y, ax.z, (r() < 0.5 ? -1 : 1) * (1.5 + r() * 3)], k: [r() * 0.28 * (core ? 0.5 : 1), core ? 1 : 0] }; };
  // the core: a long six-sided crystal lying along x around the scroll, pointed at both ends, split into wedges
  const half = 0.31, rad = 0.12, cy = CORE_Y, tip = 0.09, n = 6, rot = r() * TAU;
  const jit = Array.from({ length: n }, () => 0.8 + r() * 0.4);
  const xs = [-half, -half / 3 + (r() - 0.5) * 0.06, half / 3 + (r() - 0.5) * 0.06, half];
  const bow = [0, (r() - 0.5) * 0.02, (r() - 0.5) * 0.02, 0];
  for (let s = 0; s < 3; s++) for (let j = 0; j < n; j++) {
    const a0 = rot + j / n * TAU, a1 = rot + (j + 1) / n * TAU;
    const x0 = xs[s], x1 = xs[s + 1];
    const q = (x, a, k) => { const i = x === x0 ? s : s + 1; return V3(x, cy + bow[i] + Math.sin(a) * rad * k * (1 + 0.06 * Math.sin(i * 2.3 + j)), Math.cos(a) * rad * k); };
    const A0 = V3(x0, cy, 0), A1 = V3(x1, cy, 0), B0 = q(x0, a0, jit[j]), C0 = q(x0, a1, jit[(j + 1) % n]), B1 = q(x1, a0, jit[j]), C1 = q(x1, a1, jit[(j + 1) % n]);
    const cen = A0.clone().add(A1).add(B0).add(C0).add(B1).add(C1).multiplyScalar(1 / 6);
    const out = cen.clone().sub(V3(cen.x * 0.4, cy, 0)).normalize().add(V3(0, 0.55, 0)).normalize();
    const pc = piece(cen, out, true);
    P.tri(B0, B1, C1, pc); P.tri(B0, C1, C0, pc);                 // outer facet
    P.tri(A0, C0, B0, pc, 1); P.tri(A1, B1, C1, pc, 1);           // ends of the wedge (fracture planes)
    P.tri(A0, B1, A1, pc, 1); P.tri(A0, B0, B1, pc, 1);           // radial planes
    P.tri(A0, C1, C0, pc, 1); P.tri(A0, A1, C1, pc, 1);
  }
  for (const sx of [-1, 1]) for (let j = 0; j < n; j++) {
    const a0 = rot + j / n * TAU, a1 = rot + (j + 1) / n * TAU, x0 = sx * half;
    const T = V3(sx * (half + tip), cy + (r() - 0.5) * 0.02, (r() - 0.5) * 0.02), A0 = V3(x0, cy, 0);
    const B = V3(x0, cy + Math.sin(a0) * rad * jit[j], Math.cos(a0) * rad * jit[j]), C = V3(x0, cy + Math.sin(a1) * rad * jit[(j + 1) % n], Math.cos(a1) * rad * jit[(j + 1) % n]);
    const cen = T.clone().add(A0).add(B).add(C).multiplyScalar(0.25);
    const pc = piece(cen, V3(sx, 0.5, (r() - 0.5)).normalize(), true);
    if (sx > 0) { P.tri(B, T, C, pc); P.tri(A0, B, C, pc, 1); P.tri(A0, T, B, pc, 1); P.tri(A0, C, T, pc, 1); }
    else { P.tri(B, C, T, pc); P.tri(A0, C, B, pc, 1); P.tri(A0, B, T, pc, 1); P.tri(A0, T, C, pc, 1); }
  }
  // points growing out of it and out of the ground around it: six-sided prisms with pyramid tips
  const pts = [];
  for (let i = 0; i < 11; i++) {
    const x = (r() - 0.5) * half * 1.75, a = lerp(0.1, Math.PI - 0.1, r());
    const o = V3(x, cy + Math.sin(a) * rad * 0.5, Math.cos(a) * rad * 0.5);
    const dir = V3((r() - 0.5) * 1.1, Math.sin(a) * 0.9 + 0.3, Math.cos(a) * 1.2).normalize();
    pts.push({ o, dir, r: 0.026 + r() * 0.04, L: 0.08 + r() * 0.17 });
  }
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, d = 0.15 + r() * 0.13;
    const o = V3(Math.cos(a) * (half * 0.8 + d * 0.35), -0.035, Math.sin(a) * d);
    const dir = V3(Math.cos(a) * (0.5 + r() * 0.9), 1, Math.sin(a) * (0.5 + r() * 0.9)).normalize();
    pts.push({ o, dir, r: 0.015 + r() * 0.025, L: 0.04 + r() * 0.1 });
  }
  for (const pt of pts) {
    const { a, u, v } = basisOf(pt.dir);
    const m = 6, rr = pt.r, j2 = Array.from({ length: m }, () => 0.85 + r() * 0.3), ro = r() * TAU;
    const R0 = ringAt(pt.o.clone().addScaledVector(a, -0.03), a, u, v, rr, m, ro, j2);
    const R1 = ringAt(pt.o.clone().addScaledVector(a, pt.L * 0.55), a, u, v, rr * 0.98, m, ro, j2);
    const R2 = ringAt(pt.o.clone().addScaledVector(a, pt.L), a, u, v, rr * 0.95, m, ro, j2);
    const T = pt.o.clone().addScaledVector(a, pt.L + rr * 1.9);
    const body = pt.o.clone().addScaledVector(a, pt.L * 0.3), top = pt.o.clone().addScaledVector(a, pt.L * 0.85);
    const drift = pt.dir.clone().add(V3(0, 0.6, 0)).normalize();
    P.rings([R0, R1], piece(body, drift, false), true, true, 0, 1);
    const pc2 = piece(top, drift, false);
    P.rings([R1, R2], pc2, true, false, 1, 0);
    for (let j = 0; j < m; j++) P.tri(R2[j], R2[(j + 1) % m], T, pc2);
  }
  return P.build();
}

// ------------------------------------------------------------------ the crystal's material
// three passes: the back faces and the front faces multiply what lies behind and inside (the scroll) by jade and
// amber (the crystal's body colour without a transmission pass); a lit pass on the front faces adds the facets'
// reflections, the fresnel sheen, the gold glow inside, the cracks, time's dust and moss on the upper facets.
const VERT_HEAD = `
attribute vec3 aC; attribute vec3 aD; attribute vec4 aS; attribute vec3 aK;
uniform float uShatter;
varying vec3 vOP; varying float vDis; varying float vCore; varying float vInner;
mat3 flRot(vec3 ax, float a){ ax = normalize(ax); float s = sin(a), c = cos(a), oc = 1. - c;
  return mat3(oc*ax.x*ax.x + c, oc*ax.x*ax.y + ax.z*s, oc*ax.z*ax.x - ax.y*s,
              oc*ax.x*ax.y - ax.z*s, oc*ax.y*ax.y + c, oc*ax.y*ax.z + ax.x*s,
              oc*ax.z*ax.x + ax.y*s, oc*ax.y*ax.z - ax.x*s, oc*ax.z*ax.z + c); }`;
const VERT_BODY = `
vOP = position; vCore = aK.y; vInner = aK.z;
float flK = clamp((uShatter - aK.x)/(1. - aK.x), 0., 1.);
vDis = smoothstep(.5, 1., flK);
vec3 transformed = aC + flRot(aS.xyz, aS.w*flK*flK*2.2)*(position - aC)*(1. - smoothstep(.62, 1., flK))
  + aD*(.1*flK + .6*flK*flK) + vec3(0., .42*flK*flK, 0.);`;
const FRAG_COMMON = `
uniform float uGlow, uCrack, uShatter, uTime, uDust, uBlood; uniform vec3 uTouch; uniform sampler2D uNoise;
varying vec3 vOP; varying float vDis; varying float vCore; varying float vInner;
float flHeart(vec3 p){ return (1. - smoothstep(.02, .17, length(p.yz - vec2(${CORE_Y.toFixed(3)}, 0.))))*(1. - smoothstep(.26, .42, abs(p.x))); }
vec3 flTint(vec3 p){
  float v = texture2D(uNoise, p.xz*2.3 + p.y*1.7).r;
  return mix(vec3(.62, .86, .7), vec3(1., .74, .38), clamp(flHeart(p)*vCore*.85 + v*.3 - .08, 0., 1.));
}
// fragments burn away; fracture planes inside show only as it cracks and breaks
bool flCull(){
  float n = texture2D(uNoise, vOP.xy*5.3 + vOP.z*3.1).b;
  if (n < vDis*.98) return true;
  float show = max(smoothstep(.3, 1., uCrack)*.6, step(.001, uShatter));
  return vInner > .5 && show < .01;
}`;

function tintMaterial(side, uni, strength) {
  return new THREE.ShaderMaterial({
    uniforms: uni, side, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true,
    vertexShader: VERT_HEAD + '\nvoid main(){' + VERT_BODY + '\ngl_Position = projectionMatrix*modelViewMatrix*vec4(transformed, 1.);\n}',
    fragmentShader: FRAG_COMMON + `
void main(){
  if (flCull()) discard;
  float k = ${strength.toFixed(2)}*(1. - vDis)*mix(1., .45, vInner);
  gl_FragColor = vec4(mix(vec3(1.), flTint(vOP), k), 1.);
}`,
  });
}

function surfaceMaterial(uni) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.06, metalness: 0, flatShading: true, transparent: true, depthWrite: false, side: THREE.FrontSide, envMapIntensity: 1.6,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_HEAD).replace('#include <begin_vertex>', VERT_BODY);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
${FRAG_COMMON}
vec3 flH3(vec3 p){ p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p)*43758.5453); }
float flCells(vec3 p){
  vec3 ip = floor(p), fp = fract(p); float f1 = 8., f2 = 8.;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k)); vec3 o = g + flH3(ip + g) - fp; float d = dot(o, o);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
  return sqrt(f2) - sqrt(f1);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (flCull()) discard;
float flVar = texture2D(uNoise, vOP.xz*2.3 + vOP.y*1.7).r;
vec3 flWN = normalize(cross(dFdx(vOP), dFdy(vOP)));
// time's dust and moss on the upper facets, until the light wakes inside
float flDust = smoothstep(.3, .8, flWN.y)*smoothstep(.3, .65, flVar + .12)*uDust*(1. - uGlow*.75)*(1. - vInner);
// a jade body (pale green, amber about the heart) that holds its colour in strong light instead of going white
diffuseColor.rgb = mix(flTint(vOP)*mix(.34, .2, uGlow)*(.85 + flVar*.3), vec3(.3, .35, .17)*(.8 + flVar*.5), flDust);
// his blood where the drop of it landed (from his palm, torn on the way down into the dell): a splash, ragged-edged
float flPrint = (1. - smoothstep(.03, .056, length((vOP - uTouch)*vec3(.75, 1., 1.25)) + (texture2D(uNoise, vOP.xz*7.3 + vOP.y*3.).r - .5)*.034))*uBlood*(1. - vInner)*(1. - vDis);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.3, .018, .012), flPrint*.9);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// the heart: the scroll's gold through the crystal, the glow shifting a little with the view (a hint of refraction)
vec3 flPar = vOP - flWN*.02;
float flIn = flHeart(flPar);
float flPulse = .85 + .15*sin(uTime*1.7 + vOP.x*9.);
totalEmissiveRadiance += vec3(1., .66, .26)*flIn*(.05 + uGlow*.5*flPulse)*mix(.35, 1., vCore)*(1. - vInner*.7)*(1. - step(.001, uShatter)*.6);
// a milky inner light: the crystal catching the dell's light, warmer as the gold wakes
totalEmissiveRadiance += flTint(vOP)*(.085 + uGlow*.03)*(1. - flDust);
// cracks: thin gold seams spreading from where he touches it, brightest at their front
float flC = flCells(vOP*15.);
float flDist = length(vOP - uTouch) + (texture2D(uNoise, vOP.xy*3.1).g - .5)*.12;
float flFront = uCrack*.62;
float flLine = (1. - smoothstep(.0, .035 + .025*uCrack, flC))*(1. - smoothstep(flFront - .02, flFront, flDist))*step(.001, uCrack)*(1. - vDis)*(1. - smoothstep(0., .3, uShatter));
// (his blood seeps into the seams from where it fell, like ink in water, behind the gold running ahead of it)
float flRed = uBlood*(1. - smoothstep(flFront*.5 - .05, flFront*.5 + .03, flDist + (texture2D(uNoise, vOP.yz*5.1 + .6).b - .5)*.06));
totalEmissiveRadiance += mix(vec3(1., .7, .26), vec3(.55, .035, .02), flRed)*flLine*(1.3 + 2.2*smoothstep(flFront - .1, flFront, flDist))*mix(1., .7, flRed);
totalEmissiveRadiance += vec3(.32, .02, .012)*flPrint*.5;
// dissolving fragments burn gold
totalEmissiveRadiance += vec3(1., .66, .24)*vDis*.9;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
{
  float fres = pow(clamp(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 0., 1.), 2.5);
  float a = mix(.3, .82, fres)*mix(1., .8, uGlow);
  a = max(a, flDust*.92);
  a = max(a, flLine*.8);
  a = max(a, flPrint*.92);
  // fracture planes inside: faint while it cracks, whole once it breaks into pieces
  float flShow = mix(1., max(smoothstep(.3, 1., uCrack)*.25, step(.001, uShatter)), vInner);
  // premultiplied: the reflections and the glow add, the surface itself covers by a
  gl_FragColor = vec4(totalDiffuse*a + totalSpecular*(1. - flDust*.8) + totalEmissiveRadiance, a*(1. - vDis*.5))*flShow;
}`);
  };
  m.customProgramCacheKey = () => 'scroll-crystal-surface';
  return m;
}

// ------------------------------------------------------------------ gold motes (glow: a few lazy ones; shatter: a burst)
function motes(n, r, uni) {
  const pos = new Float32Array(n * 3), a0 = new Float32Array(n * 4), a1 = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    a0.set([(r() - 0.5) * 0.7, 0.04 + r() * 0.2, (r() - 0.5) * 0.3, r()], i * 4);     // start, rnd
    const d = V3(r() - 0.5, 0.35 + r() * 0.8, r() - 0.5).normalize();
    a1.set([d.x, d.y, d.z, 0.6 + r() * 1.4], i * 4);                                    // drift dir, speed
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aA', new THREE.Float32BufferAttribute(a0, 4));
  g.setAttribute('aB', new THREE.Float32BufferAttribute(a1, 4));
  const mat = new THREE.ShaderMaterial({
    // (additive light; the scene alpha left alone: plain additive blending wrote 2 into it under every mote, seen or
    // not, which the ink pass reads as flame)
    uniforms: uni, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: `attribute vec4 aA, aB; uniform float uShatter, uGlow, uTime, uPx; varying float vA;
void main(){
  float rnd = aA.w;
  // lazy motes circling the glowing crystal
  float ph = uTime*.35 + rnd*6.2831;
  vec3 lazy = aA.xyz + vec3(sin(ph)*.12, .08 + fract(uTime*.07 + rnd)*.45, cos(ph*1.3)*.12);
  float lazyA = uGlow*(1. - uShatter)*sin(fract(uTime*.07 + rnd)*3.1416)*step(.84, rnd)*.7;
  // the burst
  float k = clamp((uShatter - rnd*.35)/(.65), 0., 1.);
  vec3 burst = aA.xyz + aB.xyz*aB.w*(.35*k + .5*k*k) + vec3(sin(k*6. + rnd*9.)*.08, .6*k*k, cos(k*5. + rnd*7.)*.08);
  float burstA = sin(k*3.1416)*step(.001, uShatter);
  vec3 p = mix(lazy, burst, step(.001, uShatter));
  vA = max(lazyA, burstA);
  vec4 mv = modelViewMatrix*vec4(p, 1.);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = uPx*(.01 + .016*fract(rnd*7.3))/max(-mv.z, .05)*(.5 + .5*vA);
}`,
    fragmentShader: `varying float vA;
void main(){ vec2 q = gl_PointCoord - .5; float d = length(q); if (d > .5 || vA < .003) discard;
  float a = smoothstep(.5, .0, d); gl_FragColor = vec4(vec3(1., .74, .34)*(1.2 + 1.8*smoothstep(.22, 0., d))*a*vA, 1.); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.name = 'crystalMotes'; pts.renderOrder = 8;
  return pts;
}

/**
 * createScrollCrystal({ position: Vector3 (ground point under the cluster's middle), axis: Vector3 (the scroll's roll
 *   axis, horizontal), seed, rootMaterial, mossMaterial, groundAt(x,z) }) -> { group, crystal, update(time, s),
 *   scrollPose: { position, quaternion, axis, center }, touchPoint, size }
 */
export function createScrollCrystal(opts = {}) {
  const o = { position: V3(), axis: V3(0, 0, 1), seed: 31, rootMaterial: null, mossMaterial: null, groundAt: null, ...opts };
  const r = rng(o.seed);
  const group = new THREE.Group(); group.name = 'scrollCrystal';
  // local frame: x along the scroll (the roll axis), y up, z across
  const ax = o.axis.clone().setY(0).normalize();
  group.position.copy(o.position);
  group.quaternion.setFromUnitVectors(V3(1, 0, 0), ax);
  group.updateMatrixWorld(true);
  const uni = {
    uShatter: { value: 0 }, uGlow: { value: 0 }, uCrack: { value: 0 }, uBlood: { value: 0 }, uDust: { value: 0.36 }, uTouch: { value: V3(0.06, 0.2, 0.11) },
    uTime: U.uTime, uNoise: U.uNoise, uPx: { value: 900 },
  };
  const geo = buildCrystal(r);
  const back = new THREE.Mesh(geo, tintMaterial(THREE.BackSide, uni, 0.8));
  const tint = new THREE.Mesh(geo, tintMaterial(THREE.FrontSide, uni, 0.55));
  const front = new THREE.Mesh(geo, surfaceMaterial(uni));
  back.renderOrder = 6; tint.renderOrder = 7; front.renderOrder = 8;
  back.name = 'crystalBack'; tint.name = 'crystalTint'; front.name = 'crystal';
  for (const m of [back, tint, front]) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; }
  front.receiveShadow = true;
  group.add(back, tint, front);
  const mo = motes(150, r, uni);
  group.add(mo);
  // roots grown over its ends (beyond the scroll's knobs, so it lifts straight out), moss where it meets the ground
  if (o.rootMaterial) {
    const B = new GeoBuf();
    const straps = [
      // over the end tips: low, wide arches, thick where they enter the ground
      [V3(0.47, -0.06, -0.36), V3(0.43, 0.08, -0.2), V3(0.4, 0.17, -0.02), V3(0.42, 0.1, 0.18), V3(0.5, -0.06, 0.34)],
      [V3(-0.5, -0.06, 0.33), V3(-0.44, 0.09, 0.17), V3(-0.41, 0.18, 0.0), V3(-0.43, 0.1, -0.2), V3(-0.47, -0.06, -0.38)],
      // along its back, half sunk, the crystal grown against it
      [V3(-0.62, -0.05, -0.24), V3(-0.3, 0.03, -0.2), V3(0.0, 0.06, -0.19), V3(0.3, 0.03, -0.22), V3(0.62, -0.06, -0.3)],
    ];
    straps.forEach((pts, i) => sweep(B, pts, { radial: 8, segLen: 0.035, upAlign: 1, aspect: () => 0.8,
      radius: t => (i === 2 ? 0.05 : 0.038) * (1 + 0.55 * Math.pow(Math.abs(t - 0.5) * 2, 2)), color: () => [0.82, 0.8, 0.76], uRep: 1, vScale: 2 }));
    const roots = meshOf(B.build(), o.rootMaterial, null, { name: 'crystalRoots' });
    group.add(roots);
  }
  if (o.mossMaterial) {
    const B = new GeoBuf();
    // low moss cushions hugging the crystal's foot
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + r() * 0.4, rx = 0.37 + r() * 0.06, rz = 0.17 + r() * 0.05;
      const cx = Math.cos(a) * rx, cz = Math.sin(a) * rz, s = 0.07 + r() * 0.06;
      const rows = 4, cols = 10, b0 = B.count;
      for (let iy = 0; iy <= rows; iy++) for (let j = 0; j <= cols; j++) {
        const t = iy / rows, aa = j / cols * TAU, rr = Math.sin(t * Math.PI / 2);
        B.v(cx + Math.cos(aa) * rr * s * 1.4, (Math.cos(t * Math.PI / 2) - 0.25) * s * 0.7, cz + Math.sin(aa) * rr * s, Math.cos(aa) * rr, 1, Math.sin(aa) * rr, 0, 0, 1, 1, 1, 0, 0);
      }
      for (let iy = 0; iy < rows; iy++) for (let j = 0; j < cols; j++) { const p = b0 + iy * (cols + 1) + j; B.t(p, p + cols + 1, p + 1); B.t(p + 1, p + cols + 1, p + cols + 2); }
    }
    const g = B.build(); g.computeVertexNormals();
    const moss = meshOf(g, o.mossMaterial, null, { name: 'crystalMoss' });
    group.add(moss);
  }
  // where the relic scroll lies: its roller centred on the crystal's axis (local +z of the scroll group = roll axis)
  const center = V3(0, CORE_Y, 0).applyMatrix4(group.matrixWorld);
  const scrollPose = {
    center: center.clone(),
    position: center.clone().addScaledVector(UP, -ROLL_LIFT),
    axis: ax.clone(),
    quaternion: new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), ax),
  };
  const touchPoint = V3(0.06, 0.2, 0.11).applyMatrix4(group.matrixWorld);
  return {
    group, crystal: front, motes: mo, uniforms: uni, scrollPose, touchPoint, size: V3(0.78, 0.4, 0.42), rollHalf: ROLL_HALF,
    update(time, s = {}) {
      uni.uGlow.value = clamp(s.glow ?? 0);
      uni.uCrack.value = clamp(s.crack ?? 0);
      uni.uShatter.value = clamp(s.shatter ?? 0);
      uni.uBlood.value = clamp(s.blood ?? 0);
      const live = uni.uShatter.value < 0.999;
      back.visible = tint.visible = front.visible = live;
      mo.visible = uni.uGlow.value > 0.01 || (uni.uShatter.value > 0.001 && live);
    },
  };
}
