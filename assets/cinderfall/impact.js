// Where the great bolt comes down: the blast of it and what it throws up.
//
// A ball of fire swells out of the ground where it struck (white-hot, then orange, then the dull red of what burns
// there), torn at its edge by the air it churns. The shock runs out over the land from it: a front of light along the
// ground and, right behind it, a ring of dust thrown up, rising and thinning, lit from beneath by the fire. A blaze at
// the foot of the bolt sinks to the glow of what fell there, and a fountain of embers is thrown up and out, slowing in
// the air and falling back. (All of it marks the scene alpha as the lightning does, so the painted look leaves it be.)
import * as THREE from 'three';

const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
// the dust: ordinary see-through cloud over what is behind it (its alpha leaves the scene's marks as they are)
const OVER = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

const SPRITE_VS = `uniform float uSize; varying vec2 vUv;
void main(){ vUv = uv; vec4 c = modelViewMatrix * vec4(0., 0., 0., 1.); c.xy += position.xy * uSize; gl_Position = projectionMatrix * c; }`;
// the fireball: a churning ball of light, its edge eaten by noise that boils outward
const FIRE_FS = `uniform float uAmt, uAge, uTime; uniform sampler2D tNoise; varying vec2 vUv;
void main(){
  vec2 q = vUv * 2. - 1.; float r = length(q);
  float ang = atan(q.y, q.x);
  float n = texture2D(tNoise, vec2(ang * .48 + uTime * .04, r * .7 - uTime * .3 - uAge * .5)).r;
  float n2 = texture2D(tNoise, vec2(ang * 1.27 - uTime * .07, r * 1.6 - uTime * .55)).g;
  float n3 = texture2D(tNoise, vec2(ang * 2.9 + uTime * .11, r * 3.1 - uTime * .9)).b;
  float edge = .5 + .3 * n + .14 * n2;
  float body = smoothstep(edge, edge * .4, r) * (.55 + .7 * n3);
  float core = exp(-r * r * 10.);
  float heat = exp(-uAge * 2.2);
  vec3 hot = vec3(1., .96, .88), mid = vec3(1., .58, .2), cool = vec3(.5, .13, .04);
  vec3 col = mix(mix(cool, mid, smoothstep(.0, .45, heat + core * .35 + n3 * .15)), hot, smoothstep(.5, 1., heat + core * .3));
  float I = (body * (1. + 2. * heat) + core * 4. * heat) * uAmt * smoothstep(1., .85, r);
  gl_FragColor = vec4(col * I, step(.03, I) * .5);
}`;
const FLARE_FS = `uniform float uAmt, uHot, uTime; varying vec2 vUv;
void main(){
  vec2 q = vUv * 2. - 1.; float r = length(q);
  float fl = .85 + .15 * sin(uTime * 23.) * sin(uTime * 9.);
  float core = exp(-r * r * 60.) * 6. + exp(-r * r * 8.) * 1.2 + exp(-r * 3.) * .25;
  float flat_ = exp(-q.y * q.y * 900.) * exp(-abs(q.x) * 2.5) * .9;
  vec3 col = mix(vec3(1., .62, .25), vec3(.95, .97, 1.), uHot);
  vec3 o = col * (core + flat_ * uHot) * uAmt * fl * smoothstep(1., .8, r);
  gl_FragColor = vec4(o, step(.03, max(o.r, max(o.g, o.b))) * .5);
}`;
const EMBER_VS = `attribute vec4 aDir; attribute vec4 aRnd; uniform float uAge, uScale; uniform vec3 uC;
varying float vA; varying float vHot;
vec3 at(vec3 v, float t){ float k = 1.4; return uC + v * (1. - exp(-k * t)) / k + vec3(0., -60., 0.) * t * t * .5; }
void main(){
  float life = mix(1.2, 3.2, aRnd.x);
  float t = uAge - aRnd.y * .15;
  vA = 0.;
  if (t < 0. || t > life) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec3 v = aDir.xyz * aDir.w * uScale;
  vec3 p1 = at(v, t), p0 = at(v, max(t - .05, 0.));
  vec4 c1 = viewMatrix * vec4(p1, 1.), c0 = viewMatrix * vec4(p0, 1.);
  // (none at or behind the lens: a streak with an end behind it is thrown across the whole frame)
  if (c1.z > -.6 || c0.z > -.6) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec2 d = c1.xy - c0.xy; float L = length(d); d = L > 1e-4 ? d / L : vec2(1., 0.);
  vec2 n = vec2(-d.y, d.x);
  float w = -c1.z * .0022 * mix(.7, 1.5, aRnd.z);
  vec4 c = position.x > 0. ? c1 : c0;
  c.xy += n * position.y * w;
  float k = 1. - t / life;
  vA = k * k * (1.4 + 2. * exp(-t * 3.));
  vHot = exp(-t * 2.5);
  gl_Position = projectionMatrix * c;
}`;
const EMBER_FS = `uniform float uAmt; varying float vA, vHot;
void main(){ vec3 o = mix(vec3(1., .45, .12), vec3(1., .92, .75), vHot) * vA * uAmt; gl_FragColor = vec4(o, step(.03, max(o.r, max(o.g, o.b))) * .5); }`;

// a ring wall round the strike (x, z on the unit circle; y from -.5 to .5): the front of light and the dust behind it
// (its foot follows the ground under it: aG, the ground's height there, is set from the land each frame)
const RING_VS = `attribute float aG, aR; varying vec3 vW, vN; varying float vH, vD, vA; uniform float uR, uY0, uY1; uniform vec3 uC;
void main(){ vH = position.y + .5; vA = mix(uY0, uY1, vH); float R = uR + aR; vec3 p = vec3(uC.x + position.x * R, aG + vA, uC.z + position.z * R); vW = p; vN = normalize(vec3(position.x, 0., position.z)); vD = length(p - cameraPosition); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`;
// the front: bright where it runs along the ground, torn by the air above
const FRONT_FS = `uniform float uAmt, uTime, uHot, uY1, uR; uniform sampler2D tNoise; varying vec3 vW, vN; varying float vH, vD, vA;
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float s = atan(vN.z, vN.x) * uR;   // along the front (m)
  float h = max(vA, 0.);
  float n = texture2D(tNoise, vec2(s * .0045 + uTime * .03, h * .012 - uTime * .25)).r;
  float n2 = texture2D(tNoise, vec2(s * .014 - uTime * .05, h * .032 - uTime * .6)).g;
  // (brightest where it runs along the ground, a ragged glow over it)
  // (soft at its foot: the hot line itself is drawn on the ground by the land's own light, see cfRingLight)
  float foot = (exp(-h / 9.) * .9 + exp(-h / 26.) * .35) * smoothstep(-10., 4., vA);
  float torn = smoothstep(.25, .7, n * .7 + n2 * .45 - h / uY1 * .5);
  float edge = .4 + .6 * pow(clamp(1. - abs(dot(V, vN)), 0., 1.), 2.);
  vec3 col = mix(vec3(1., .6, .28), vec3(1., .92, .8), clamp(exp(-h / 8.) * .6 + uHot, 0., 1.));
  // (far off it thins into the haze; at arm's length it fades so it never fills the lens)
  vec3 o = col * foot * torn * edge * uAmt * smoothstep(20., 90., vD) * (1. - smoothstep(2200., 3400., vD));
  gl_FragColor = vec4(o, step(.03, max(o.r, max(o.g, o.b))) * .5);
}`;
// the dust: soft billows thrown up along the ring behind the front, rising and swelling, dark, lit from beneath by
// the fire and the front (aP: centre and size; aQ: opacity, seed, light)
const PUFF_VS = `attribute vec4 aP, aQ; varying vec2 vUv; varying float vA, vLit, vY; varying vec2 vSeed;
void main(){
  vUv = uv; vLit = aQ.z; vSeed = vec2(aQ.y, fract(aQ.y * 7.31)); vY = position.y;
  vec4 c = viewMatrix * vec4(aP.xyz, 1.);
  // (thinning before the lens: no billow fills the frame)
  vA = aQ.x * smoothstep(aP.w * .6, aP.w * 3., -c.z);
  c.xy += position.xy * aP.w;
  gl_Position = projectionMatrix * c;
}`;
const PUFF_FS = `uniform sampler2D tNoise; uniform vec3 uLit; uniform float uTime; varying vec2 vUv; varying float vA, vLit, vY; varying vec2 vSeed;
void main(){
  vec2 q = vUv * 2. - 1.; float r2 = dot(q, q);
  if (r2 > 1. || vA < .002) discard;
  float n = texture2D(tNoise, vUv * .45 + vSeed + vec2(0., -uTime * .015)).r * .65 + texture2D(tNoise, vUv * 1.1 + vSeed.yx * 3.) .g * .35;
  float a = smoothstep(.22, .72, n * (1. - r2 * .8) + (1. - r2) * .32) * (1. - r2);
  vec3 dust = mix(vec3(.045, .04, .04), vec3(.12, .105, .1), n);
  vec3 col = dust + uLit * vLit * (.3 + .7 * smoothstep(.5, -1., vY)) * (.55 + .7 * n);
  gl_FragColor = vec4(col, a * vA);
}`;

// scale: the size of the fireball (1: for a strike seen from kilometres off; less for one close by); throw: how far
// the embers are flung
export function createImpact({ noise, embers = 900, groundAt = null, scale = 1, throw: throwK = 1 }) {
  const group = new THREE.Group();
  group.name = 'impact';
  // the fireball
  const fiU = { uSize: { value: 40 }, uAmt: { value: 0 }, uAge: { value: 0 }, uTime: { value: 0 }, tNoise: { value: noise } };
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: fiU, vertexShader: SPRITE_VS, fragmentShader: FIRE_FS, transparent: true, depthWrite: false, depthTest: true, fog: false, ...ADD }));
  fire.frustumCulled = false;
  fire.renderOrder = 18;
  group.add(fire);
  // the blaze at the foot of the bolt (drawn over everything: it is the brightest thing there is)
  const fu = { uSize: { value: 60 }, uAmt: { value: 0 }, uHot: { value: 1 }, uTime: { value: 0 } };
  const flare = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: fu, vertexShader: SPRITE_VS, fragmentShader: FLARE_FS, transparent: true, depthWrite: false, depthTest: false, fog: false, ...ADD }));
  flare.frustumCulled = false;
  flare.renderOrder = 22;
  group.add(flare);
  // embers: instanced streaks thrown up and out
  const base = new THREE.PlaneGeometry(2, 2, 1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  const dir = new Float32Array(embers * 4), rnd = new Float32Array(embers * 4);
  let s = 99991;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < embers; i++) {
    const a = r() * Math.PI * 2, el = Math.acos(1 - r() * 0.95);   // up and outward, more of them low
    const up = Math.cos(el) * 0.9 + 0.1, out = Math.sin(el);
    dir.set([Math.cos(a) * out, up, Math.sin(a) * out, 60 + 260 * Math.pow(r(), 1.4)], i * 4);
    rnd.set([r(), r(), r(), 0], i * 4);
  }
  g.setAttribute('aDir', new THREE.InstancedBufferAttribute(dir, 4));
  g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4));
  g.instanceCount = embers;
  const eu = { uAge: { value: 0 }, uScale: { value: 1 }, uC: { value: new THREE.Vector3() }, uAmt: { value: 0 } };
  const em = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: eu, vertexShader: EMBER_VS, fragmentShader: EMBER_FS, transparent: true, depthWrite: false, depthTest: true, fog: false, ...ADD }));
  em.frustumCulled = false;
  em.renderOrder = 18;
  group.add(em);
  // the shock: its front of light and the ring of dust behind it
  // (each wall its own copy of the ring, for the ground under its own radius)
  // (and the front wanders round its circle as the ring of light on the land does: see cfRingRag)
  const ringGeo = () => {
    const c = new THREE.CylinderGeometry(1, 1, 1, 240, 1, true), n = c.attributes.position.count;
    c.setAttribute('aG', new THREE.BufferAttribute(new Float32Array(n), 1));
    c.setAttribute('aR', new THREE.BufferAttribute(new Float32Array(n), 1));
    return c;
  };
  const cylF = ringGeo();
  const settle = (geo, at, R) => {
    const P = geo.attributes.position, G = geo.attributes.aG, A = geo.attributes.aR;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), t = Math.atan2(z, x);
      const off = -40 * (Math.sin(3 * t + 1.3) * 0.5 + Math.sin(7 * t + 0.2) * 0.3 + Math.sin(13 * t + 2.1) * 0.2) * Math.min(1, R / 300);
      A.setX(i, off);
      G.setX(i, groundAt ? groundAt(at.x + x * (R + off), at.z + z * (R + off)) : at.y);
    }
    G.needsUpdate = true; A.needsUpdate = true;
  };
  const wu = { uR: { value: 100 }, uY0: { value: -40 }, uY1: { value: 60 }, uC: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uHot: { value: 0 }, uTime: { value: 0 }, tNoise: { value: noise } };
  const front = new THREE.Mesh(cylF, new THREE.ShaderMaterial({ uniforms: wu, vertexShader: RING_VS, fragmentShader: FRONT_FS, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: false, ...ADD }));
  front.frustumCulled = false;
  front.renderOrder = 17;
  group.add(front);
  // the dust: billows strung round the ring
  const NP = 170;
  const pg = new THREE.InstancedBufferGeometry();
  pg.index = base.index;
  pg.setAttribute('position', base.attributes.position);
  pg.setAttribute('uv', base.attributes.uv);
  const aP = new THREE.InstancedBufferAttribute(new Float32Array(NP * 4), 4), aQ = new THREE.InstancedBufferAttribute(new Float32Array(NP * 4), 4);
  aP.setUsage(THREE.DynamicDrawUsage); aQ.setUsage(THREE.DynamicDrawUsage);
  pg.setAttribute('aP', aP); pg.setAttribute('aQ', aQ);
  pg.instanceCount = NP;
  const puffs = Array.from({ length: NP }, (_, i) => ({ t: (i + r() * 0.8) / NP * Math.PI * 2, lag: 0.78 + 0.2 * r(), size: 18 + 30 * r(), rise: 0.25 + r(), seed: r(), tier: r() }));
  const du = { uTime: { value: 0 }, uLit: { value: new THREE.Color() }, tNoise: { value: noise } };
  const dust = new THREE.Mesh(pg, new THREE.ShaderMaterial({ uniforms: du, vertexShader: PUFF_VS, fragmentShader: PUFF_FS, transparent: true, depthWrite: false, depthTest: true, fog: false, ...OVER }));
  dust.frustumCulled = false;
  dust.renderOrder = 16;
  group.add(dust);
  const _v = new THREE.Vector3();
  return {
    group,
    // at: where; age: seconds of story since it came down (scaled from u by the caller); amt: overall; ring: how far
    // the shock has run (m); camera
    set({ at, age, amt, time, camera, ring = 0, frontAmt = amt }) {
      front.userData.amt = frontAmt;
      group.visible = (amt > 0.003 || frontAmt > 0.003) && age >= 0 && age < 12;
      if (!group.visible) return;
      const hot = Math.exp(-age * 2.2);
      // the fireball swells fast and slows, rising a little as it cools
      const Rf = (26 + 120 * (1 - Math.exp(-age * 3.2))) * scale;
      fire.position.copy(at).add(_v.set(0, Rf * 0.3 + 12 * age * scale, 0));
      fiU.uSize.value = Rf; fiU.uAge.value = age; fiU.uTime.value = time;
      fiU.uAmt.value = amt * (0.25 + 0.75 * Math.exp(-age * 0.9)) * smoothstep01(age / 0.04);
      fire.visible = age < 5;
      // the blaze at the foot of the bolt sinks to the glow of what fell there
      flare.position.copy(at).add(_v.set(0, 8, 0));
      const d = camera.position.distanceTo(flare.position);
      fu.uHot.value = hot; fu.uAmt.value = amt * (0.3 + 1.3 * hot); fu.uTime.value = time;
      fu.uSize.value = d * (0.045 + 0.11 * hot);
      eu.uAge.value = age; eu.uC.value.copy(at); eu.uAmt.value = amt; eu.uScale.value = throwK;
      // the shock: its front of light runs on over the land, bright while it is young; the dust thrown up behind it
      // rises and thins, and is left behind
      const dustK = 1 - smoothstep01((ring - 420) / 480), R0 = ring;
      front.visible = ring > 1 && front.userData.amt > 0.003;
      dust.visible = ring > 1 && dustK > 0.003;
      if (front.visible) {
        settle(cylF, at, ring);
        wu.uC.value.copy(at); wu.uR.value = ring; wu.uY0.value = -14; wu.uY1.value = 40 + 30 * Math.min(1, age);
        wu.uAmt.value = front.userData.amt * (0.55 + 1.3 * hot); wu.uHot.value = hot; wu.uTime.value = time;
      }
      if (dust.visible) {
        // each billow lags the front by its own share, rises and swells as it is left behind, and thins away
        const k0 = Math.min(1, R0 / 300), grow = Math.min(1, age / 1.4);
        for (let i = 0; i < NP; i++) {
          const pf = puffs[i], t = pf.t;
          const off = -40 * (Math.sin(3 * t + 1.3) * 0.5 + Math.sin(7 * t + 0.2) * 0.3 + Math.sin(13 * t + 2.1) * 0.2) * k0;
          const R = Math.max(4, ring * pf.lag + off - 6);
          const x = at.x + Math.cos(t) * R, z = at.z + Math.sin(t) * R;
          const gy = groundAt ? groundAt(x, z) : at.y;
          const sz = pf.size * (0.55 + 0.9 * grow) * (pf.tier > 0.7 ? 1.5 : 1);
          aP.setXYZW(i, x, gy + sz * 0.45 + pf.rise * 70 * grow * (pf.tier > 0.7 ? 1.6 : 1), z, sz);
          aQ.setXYZW(i, amt * dustK * smoothstep01(age / 0.12) * (0.55 + 0.35 * pf.seed) * (1 - 0.5 * grow * pf.tier), pf.seed * 13.7, (1 - 0.6 * (1 - pf.lag) / 0.22) * Math.exp(-R / 520), 0);
        }
        aP.needsUpdate = true; aQ.needsUpdate = true;
        du.uTime.value = time;
        du.uLit.value.setRGB(1, 0.55, 0.22).multiplyScalar(0.2 + 1.3 * hot);
      }
    },
  };
}
const smoothstep01 = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
