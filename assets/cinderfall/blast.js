// Leaves torn up off the ground by the ring of light as it runs out from the pillar, and shaken loose from the crown
// overhead: thrown out and up, whirled round the pillar, then drifting down through it, catching its light. All on the
// GPU and a pure function of the story position (u) and the clock: scrubbing back puts every leaf back where it lay.
import * as THREE from 'three';

const VS = `
attribute vec4 aSeed; attribute vec3 aP0; attribute vec2 aK;     // aK: kind (0 ground, 1 crown), u at which it goes
uniform float uU, uTS, uPx, uAmt; uniform vec3 uC;
varying float vA, vGlowR, vAng, vS, vSide;
void main(){
  vec3 p0 = aP0;
  vec2 rel = p0.xz - uC.xz; float r0 = length(rel); vec2 dir = rel / max(r0, 1e-3);
  float t = max(uU - aK.y, 0.) * uTS;          // seconds since it went
  vec3 p;
  if (aK.x < .5) {
    // thrown out and up by the ring, harder the nearer the pillar; held back by the air, then a slow fall
    float pw = exp(-r0 / 5.5);
    vec3 v0 = vec3(dir.x, 0., dir.y) * (1.2 + 6.5 * aSeed.y) * pw + vec3(0., .9 + (2.5 + 7.5 * aSeed.z) * pw, 0.);
    float k = 1.5, g = 2.3;
    float e = (1. - exp(-k * t)) / k;
    p = p0 + v0 * e;
    p.y -= g / k * (t - e);
  } else {
    // shaken out of the crown: falling, slowly
    p = p0;
    p.y -= (.55 + .5 * aSeed.y) * t;
  }
  // tumbling: a flutter either way as they go
  float fl = 1. - exp(-t * 1.5);
  p.x += sin(t * (2. + aSeed.w * 2.4) + aSeed.x * 20.) * .4 * fl;
  p.z += cos(t * (1.7 + aSeed.y * 2.1) + aSeed.z * 20.) * .4 * fl;
  // the air round the pillar turns and rises: near it they are carried up and round
  vec2 q = p.xz - uC.xz; float rq = length(q);
  float near = exp(-rq * rq / 5.);
  p.y += near * 1.3 * t * (1. - aK.x * .6);
  float sw = t * (.25 + 1.1 * near);
  float cs = cos(sw), sn = sin(sw);
  p.xz = uC.xz + vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);
  // (never through the ground: the ground they came from, or the floor about the pillar)
  float floorY = aK.x < .5 ? p0.y + .03 : uC.y + .05;
  p.y = max(p.y, floorY);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  // seen from the moment it goes; lying still again (back among the others) once down a while
  float landed = smoothstep(floorY + .2, floorY + .05, p.y) * step(.6, t);
  vA = uAmt * step(aK.y, uU) * smoothstep(0., .08, t) * (1. - landed) * smoothstep(.15, .9, -mv.z);
  float dq = length(p.xz - uC.xz);
  vGlowR = dq;
  vAng = aSeed.x * 6.28 + t * (1.5 + aSeed.w * 4.) * (aSeed.y < .5 ? -1. : 1.);
  vS = aSeed.w;
  vSide = .35 + .65 * abs(sin(t * (3. + aSeed.z * 4.) + aSeed.y * 9.));   // the leaf turning: face on, edge on
  gl_PointSize = clamp((.16 + .14 * aSeed.y) * uPx / max(-mv.z, .05), 1.5, 30.);
}`;

const FS = `
uniform float uBeam;
varying float vA, vGlowR, vAng, vS, vSide;
void main(){
  if (vA < .004) discard;
  vec2 d = gl_PointCoord - .5;
  float cs = cos(vAng), sn = sin(vAng);
  vec2 q = mat2(cs, -sn, sn, cs) * d;
  q.y /= max(vSide, .2);
  // a leaf: pointed at both ends, a little rounder on one side
  float l = length(q * vec2(2.3, 1.)) + abs(q.x) * .3 - q.x * .15;
  float a = smoothstep(.5, .42, l) * vA;
  if (a < .01) discard;
  vec3 c = mix(vec3(.62, .09, .04), vec3(.93, .4, .08), smoothstep(.2, .7, vS));
  c = mix(c, vec3(.96, .74, .2), step(.82, vS));
  // the midrib
  c *= .85 + .2 * smoothstep(.03, .0, abs(q.x));
  // lit by the pillar: dim away from it, burning gold-white in it
  float glow = exp(-vGlowR * vGlowR / 1.4) * 2.6 + exp(-vGlowR / 3.5) * .5;
  c = c * (.32 + .6 * uBeam * (.4 + glow * .5)) + vec3(1., .78, .42) * glow * uBeam * vSide * .9;
  gl_FragColor = vec4(c, a);
}`;

// center: the pillar's foot; groundAt(x, z); ringAt(u): radius of the ring at u (m); u0..u1: when the ring runs;
// avoid: [[x, z, r]] places with no leaves (the trunk)
export function createLeafBlast({ center, groundAt, ringAt, u0, u1, count = 520, crown = 160, radius = 9, crownH = [7, 15], avoid = [], seed = 5 }) {
  let s = seed * 9973 + 17;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const N = count + crown;
  const p0 = new Float32Array(N * 3), sd = new Float32Array(N * 4), kk = new Float32Array(N * 2);
  // (when the ring reaches a radius: found once, by bisection along the story)
  const reach = r => { let a = u0, b = u1; if (ringAt(b) < r) return u1 + 0.4; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (ringAt(m) >= r) b = m; else a = m; } return b; };
  let i = 0, guard = 0;
  while (i < N && guard++ < N * 20) {
    const kind = i < count ? 0 : 1;
    const a = rnd() * Math.PI * 2;
    const r = kind === 0 ? 0.7 + Math.sqrt(rnd()) * (radius - 0.7) : Math.sqrt(rnd()) * 6.5;
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (kind === 0 && avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    const y = kind === 0 ? groundAt(x, z) + 0.03 : center.y + crownH[0] + rnd() * (crownH[1] - crownH[0]);
    p0.set([x, y, z], i * 3);
    sd.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    kk.set([kind, kind === 0 ? reach(r) : u0 + 0.01 + rnd() * 0.12], i * 2);
    i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aP0', new THREE.BufferAttribute(p0, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  g.setAttribute('aK', new THREE.BufferAttribute(kk, 2));
  g.setDrawRange(0, i);
  g.boundingSphere = new THREE.Sphere(center.clone(), 1e4);
  const uniforms = { uU: { value: 0 }, uTS: { value: 9 }, uPx: { value: 900 }, uAmt: { value: 0 }, uC: { value: center.clone() }, uBeam: { value: 0 } };
  // (colour blended as usual; the scene alpha pulled down under each leaf, so the painted pass and the ink lines leave
  // these small things alone)
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  points.renderOrder = 10;
  points.visible = false;
  return {
    points, uniforms,
    // u: story position; ts: seconds of their flight per story unit; amt: 0..1; beam: the pillar's light; px: pixels
    // per metre at distance 1
    set({ u, ts = 9, amt = 1, beam = 1, px }) {
      uniforms.uU.value = u; uniforms.uTS.value = ts; uniforms.uAmt.value = amt; uniforms.uBeam.value = beam;
      if (px) uniforms.uPx.value = px;
      points.visible = amt > 0.003 && u > u0;
    },
  };
}
