// The charge: lightning gathering in the storm before the great bolt.
//
// All through the dark of the storm, sparks crackle into being: small jagged arcs of blue-white light, each redrawn
// many times a second as it goes, drawn down and in along spiralling lanes to one point under the cloud's base,
// faster and thicker as they close. There a knot of light swells: a white-hot core in a seething corona, throbbing as
// the charge comes in, until it collapses into the bolt. Inside the cloud, what is far off is lost in it (each spark
// and the knot fade with the thickness of cloud between them and the eye).
import * as THREE from 'three';

// (added light; the scene alpha marked as the lightning marks it, so the painted look leaves it alone)
const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
// (how much cloud lies between the eye and a point: the part of the way above the cloud's base, through cloud of a
// given clarity)
const CLOUD_ATT = `uniform vec3 uCam; uniform float uBase, uVis;
float cloudAtt(vec3 p){
  vec3 d = p - uCam; float L = length(d);
  float y0 = uCam.y, y1 = p.y, inL;
  if (y0 >= uBase && y1 >= uBase) inL = L;
  else if (y0 < uBase && y1 < uBase) inL = 0.;
  else inL = L * (max(y0, y1) - uBase) / max(abs(y1 - y0), 1e-3);
  return exp(-inL / uVis);
}`;
const NP = 7;   // points along each spark (a zigzag of NP - 1 strokes)
const SPARK_VS = `attribute float aT, aSide; attribute vec4 aSeed, aSeed2;
uniform float uTime, uAmt, uOrg, uR, uH, uPx; uniform vec3 uC;
varying float vA, vHot, vSide;
${CLOUD_ATT}
float h1(float n){ return fract(sin(n) * 43758.5453); }
float a0, rf, hq, turns, spin;
// a lane in from far out and high up, round and down into the point (drawn in faster as it closes)
vec3 lane(float s){
  float e = pow(s, 1.5);
  float r = uR * rf * pow(clamp(1. - e, 0., 1.), 1.15);
  float h = uH * mix(-.25, 1., hq) * pow(clamp(1. - e, 0., 1.), 1.7);
  float a = a0 + e * turns * spin * 6.2832;
  return uC + vec3(cos(a) * r, h, sin(a) * r);
}
void main(){
  // (as the charge comes in, the sparks fall into streams: a dozen rivers of them winding down into the point; a few
  // stay loose to the end)
  float K = 13., si = floor(aSeed.x * K), j = aSeed.x * K - si - .5;
  float og = smoothstep(.12, .8, uOrg) * (1. - step(.74, aSeed2.z));
  float sa = h1(si * 7.31 + 1.7), sr = h1(si * 3.77 + 4.1), sh = h1(si * 5.13 + 9.2), st = h1(si * 2.91 + 3.3);
  a0 = mix(aSeed.x * 6.2832, (sa + j * .022) * 6.2832, og);
  rf = mix(aSeed.y, mix(.5, 1., sr) * (1. + (aSeed.y - .5) * .1), og);
  hq = mix(aSeed.z, mix(.15, 1., sh) * (1. + (aSeed.z - .5) * .12), og);
  turns = mix(mix(.8, 2.4, aSeed2.y), mix(1., 1.6, st), og);
  spin = mix(h1(aSeed.w * 13.7) < .5 ? 1. : -1., 1., og);
  float speed = mix(.05, .12, aSeed2.w) * mix(.75, 2.6, uOrg);
  float s = fract(uTime * speed + aSeed.w);
  float laneLen = 3.1416 * uR * rf * turns + uH * hq + 1.;
  float L = mix(16., 42., h1(aSeed.w * 51.3)) * mix(1., 1.4, uOrg) / laneLen;
  float sv = max(s - L * (1. - aT), 0.);
  vec3 p = lane(sv);
  vec4 c = viewMatrix * vec4(p, 1.), cn = viewMatrix * vec4(lane(min(sv + .0015, 1.)), 1.);
  vec4 ch = viewMatrix * vec4(lane(s), 1.), ct = viewMatrix * vec4(lane(max(s - L, 0.)), 1.);
  vec2 d = cn.xy - c.xy; float dl = length(d); d = dl > 1e-5 ? d / dl : vec2(1., 0.);
  vec2 n = vec2(-d.y, d.x);
  // (it crackles: its zigzag redrawn many times a second, the ends fixed)
  float k = floor(uTime * 26. + aSeed.w * 7.);
  float inner = step(.01, aT) * step(aT, .99);
  float jg = (h1(k * 3.17 + aSeed.w * 91.7 + aT * 17.3) - .5) * inner;
  float len = length(ch.xyz - ct.xyz);
  c.xy += n * jg * len * mix(.42, .22, og);
  c.xy += n * aSide * max(-c.z, 1.) * uPx * mix(.9, 1.8, aT);
  // more of them as the charge grows; each flickers on and off; swallowed at the point; the near ones fade before
  // the lens
  // (fewer, in their streams, as it closes: the loose ones die away)
  float on = step(aSeed2.x, uAmt * mix(1., .45, uOrg)) * step(.28, h1(floor(uTime * 19. + aSeed.w * 13.) + aSeed2.y * 5.)) * mix(1., .3, uOrg * step(.74, aSeed2.z));
  float e = pow(s, 1.5);
  float dist = length(p - uCam);
  vA = on * smoothstep(0., .08, s) * (1. - smoothstep(.86, .97, e)) * cloudAtt(p) * smoothstep(6., 45., dist)
     * (.25 + .75 * aT) * (.55 + 1.5 * e) * (1. + og * .4);
  vHot = aT * aT;
  vSide = aSide;
  gl_Position = projectionMatrix * c;
}`;
const SPARK_FS = `varying float vA, vHot, vSide;
void main(){
  float prof = exp(-vSide * vSide * 2.6);
  // (a pale electric blue: a saturated one turns violet in the film's response)
  vec3 col = mix(vec3(.46, .74, 1.), vec3(.9, .97, 1.), vHot);
  gl_FragColor = vec4(col * vA * prof * 2.4, step(.015, vA * prof) * .5);
}`;
const KNOT_VS = `uniform float uSize, uStretch; varying vec2 vUv;
void main(){ vUv = uv; vec4 c = modelViewMatrix * vec4(0., 0., 0., 1.); c.xy += position.xy * uSize * vec2(1. + uStretch, 1.); gl_Position = projectionMatrix * c; }`;
const KNOT_FS = `uniform float uAmt, uTime, uPulse, uStretch; uniform sampler2D tNoise; varying vec2 vUv;
${CLOUD_ATT}
uniform vec3 uKnot;
void main(){
  vec2 q = vUv * 2. - 1.; q.x *= 1. + uStretch; float r = length(q);
  float ang = atan(q.y, q.x);
  // a ball of light: a white-hot core in a seething shell, arcs flicking out of it, the whole of it throbbing
  float n = texture2D(tNoise, vec2(ang * .32 + uTime * .9, r * 1.4 - uTime * 2.3)).r;
  float n2 = texture2D(tNoise, vec2(ang * .71 - uTime * 1.7, r * 2.2 + uTime * 1.1)).g;
  float n3 = texture2D(tNoise, vec2(ang * 1.13 + uTime * 2.9, r * .7 - uTime * 3.7)).b;
  float core = exp(-r * r * 160.) * 12. + exp(-r * r * 34.) * 2.6;
  float shell = exp(-pow((r - .17 - .07 * (n - .5)) / .028, 2.)) * (1. + n3) * .9;
  float arcs = pow(max(0., 1. - abs(n2 - .5) * 9.), 6.) * smoothstep(.8, .14, r) * 2.8;
  float halo = exp(-r * 4.) * .5 + exp(-r * 1.6) * .08;
  // (at its height, a flat streak of light across it, out to the ends of the quad)
  float ex = abs(vUv.x * 2. - 1.);
  float streak = exp(-q.y * q.y * 700.) * exp(-abs(q.x) * 2.2) * uStretch * 1.6 * smoothstep(1., .7, ex);
  float I = (core + shell + arcs + halo) * (.75 + .25 * sin(uTime * 31.) * sin(uTime * 13.)) * (1. + uPulse * 2.) * smoothstep(1., .8, r) + streak;
  vec3 col = mix(vec3(.36, .52, 1.), vec3(.95, .98, 1.), smoothstep(.0, 3., core + arcs + streak * 2.));
  vec3 o = col * I * uAmt * cloudAtt(uKnot);
  gl_FragColor = vec4(o, step(.05, max(o.r, max(o.g, o.b))) * .5);
}`;

export function createCharge({ count = 2400, noise }) {
  const group = new THREE.Group();
  group.name = 'charge';
  const att = { uCam: { value: new THREE.Vector3() }, uBase: { value: 620 }, uVis: { value: 260 } };
  // the sparks: instanced zigzags, NP points a side
  const g = new THREE.InstancedBufferGeometry();
  const aT = new Float32Array(NP * 2), aSide = new Float32Array(NP * 2), pos = new Float32Array(NP * 2 * 3);
  for (let i = 0; i < NP; i++) for (let sd = 0; sd < 2; sd++) { aT[i * 2 + sd] = i / (NP - 1); aSide[i * 2 + sd] = sd ? 1 : -1; }
  const idx = [];
  for (let i = 0; i < NP - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  g.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  const s1 = new Float32Array(count * 4), s2 = new Float32Array(count * 4);
  let s = 271828;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    s1.set([r(), Math.sqrt(r()), Math.pow(r(), 0.8), r()], i * 4);
    s2.set([r(), r(), r(), r()], i * 4);
  }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(s1, 4));
  g.setAttribute('aSeed2', new THREE.InstancedBufferAttribute(s2, 4));
  g.instanceCount = count;
  const su = { uTime: { value: 0 }, uAmt: { value: 0 }, uR: { value: 900 }, uH: { value: 1400 }, uOrg: { value: 0 }, uPx: { value: 0.0012 }, uC: { value: new THREE.Vector3() }, ...att };
  const sparks = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: su, vertexShader: SPARK_VS, fragmentShader: SPARK_FS, transparent: true, depthWrite: false, depthTest: true, fog: false, side: THREE.DoubleSide, ...ADD }));
  sparks.frustumCulled = false;
  sparks.renderOrder = 18;
  group.add(sparks);
  // the knot
  const ku = { uSize: { value: 40 }, uStretch: { value: 0 }, uAmt: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 }, tNoise: { value: noise }, uKnot: { value: new THREE.Vector3() }, ...att };
  const knot = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: ku, vertexShader: KNOT_VS, fragmentShader: KNOT_FS, transparent: true, depthWrite: false, depthTest: true, fog: false, ...ADD }));
  knot.frustumCulled = false;
  knot.renderOrder = 19;
  group.add(knot);
  return {
    group,
    // amt: how much of the charge there is (0..1); org: how hard it streams in (0..1); knot: the ball's light (0..1+);
    // pulse: a throb of it; R, H: how far out and how high up the lanes begin (m); base: the cloud's base (m); vis: how
    // far one sees in it (m); px: radians a pixel subtends; streak: the flat streak across the knot at its height
    set({ time, amt, org = 0, knot: kAmt = 0, pulse = 0, center, R = 900, H = 1400, camera, base = 620, vis = 260, px = 0.0012, streak = 0 }) {
      su.uTime.value = time; su.uAmt.value = amt; su.uOrg.value = org; su.uR.value = R; su.uH.value = H; su.uPx.value = px;
      if (center) { su.uC.value.copy(center); knot.position.copy(center); ku.uKnot.value.copy(center); }
      att.uCam.value.copy(camera.position); att.uBase.value = base; att.uVis.value = vis;
      ku.uAmt.value = kAmt; ku.uTime.value = time; ku.uPulse.value = pulse; ku.uStretch.value = streak;
      ku.uSize.value = 30 + 60 * Math.min(1.5, kAmt);
      sparks.visible = amt > 0.003;
      knot.visible = kAmt > 0.003;
      group.visible = sparks.visible || knot.visible;
    },
  };
}
