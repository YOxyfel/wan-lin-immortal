// A pillar of light down from the sky onto one spot: a column turned to face the eye (a blinding core, a soft sheath,
// streaks of light running up it, two threads of light winding round its foot), the thin thread that runs down ahead
// of it and the white-hot head it comes down behind; a pool of light where it stands on the ground, light running out
// over the ground from it in cracks, a ring of light thrown out across the ground and a low wall of light standing on
// that ring; the flare where it strikes; and the knot of light in the leaves overhead where it comes through, which
// gathers before it falls. Additive light that leaves the scene alpha alone (the ink pass reads it as gold).
import * as THREE from 'three';

const ADD = {
  transparent: true, depthWrite: false, fog: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
};
// a camera-facing quad of radius uR about the object's origin
const SPRITE_VS = `uniform float uR; varying vec2 vQ;
void main(){ vQ = position.xy; vec4 mv = viewMatrix * vec4((modelMatrix * vec4(0., 0., 0., 1.)).xyz, 1.); mv.xy += position.xy * uR; gl_Position = projectionMatrix * mv; }`;

export function createBeam({ height = 160, color = [1.0, 0.8, 0.46], hot = [1.0, 0.97, 0.9] } = {}) {
  const group = new THREE.Group();
  group.name = 'beam';
  const col = new THREE.Color(...color), hotC = new THREE.Color(...hot);

  // ---- the column: a strip up the height, turned about its axis to face the eye
  const N = 96;
  const pos = new Float32Array((N + 1) * 2 * 3), at = new Float32Array((N + 1) * 2 * 2);
  for (let i = 0; i <= N; i++) for (let k = 0; k < 2; k++) {
    const j = i * 2 + k;
    // (rows packed toward the foot, where the helix and the head need them)
    const f = Math.pow(i / N, 1.6);
    pos.set([0, f * height, 0], j * 3);
    at.set([k ? 1 : -1, f], j * 2);
  }
  const idx = [];
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aAt', new THREE.BufferAttribute(at, 2));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height / 2, 0), height);
  const cu = {
    uI: { value: 0 }, uW: { value: 1.2 }, uTime: { value: 0 }, uCol: { value: col }, uHot: { value: hotC }, uDrop: { value: 1 },
    uPilot: { value: 0 }, uReach: { value: 0 }, uFrom: { value: 0.3 }, uHelix: { value: 0 }, uFlare: { value: 0 }, uH: { value: height }, uCamD: { value: 10 },
  };
  // (its light added; the scene alpha pulled down under it where it is bright, so the painted pass and the ink lines
  // of what stands behind it do not cut through the light)
  const column = new THREE.Mesh(g, new THREE.ShaderMaterial({
    ...ADD, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide, uniforms: cu,
    vertexShader: `attribute vec2 aAt; uniform float uW, uFlare; varying vec2 vAt; varying float vH;
void main(){
  vAt = aAt;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vec3 toCam = cameraPosition - wp.xyz; toCam.y = 0.;
  vec3 side = normalize(cross(vec3(0., 1., 0.), normalize(toCam + vec3(1e-4, 0., 0.))));
  // (narrow where it stands on the ground, wider up where it comes through the leaves; flung wide the instant it strikes)
  float w = uW * mix(1., 2.4, aAt.y) * (1. + uFlare * .9);
  wp.xyz += side * aAt.x * w;
  vH = aAt.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `uniform float uI, uTime, uDrop, uPilot, uReach, uFrom, uHelix, uFlare, uH, uCamD; uniform vec3 uCol, uHot; varying vec2 vAt; varying float vH;
float lumA(vec3 c){ return clamp(dot(c, vec3(.3, .5, .2)) * .9, 0., .95); }
float h1(float x){ return fract(sin(x * 127.13) * 43758.5453); }
void main(){
  float x = vAt.x;
  // where its head has come down to (as a fraction of the height: it comes down from uFrom, above the leaves)
  float edge = (1. - uDrop) * uFrom;
  if (vH < edge) {
    // below its head: only the thin thread that runs down ahead of it to the ground (as far as it has run),
    // flickering, brightest at its own tip and under the head
    float tip = (1. - uReach) * uFrom;
    if (vH < tip) discard;
    float th = exp(-x * x * 2600.) * uPilot * (.55 + .45 * sin(vH * 300. - uTime * 40.)) * (.45 + 1.4 * exp(-(edge - vH) * 14.) + 2.5 * exp(-(vH - tip) * 160.));
    if (th < .002) discard;
    gl_FragColor = vec4(uHot * th * 2.6, lumA(uHot * th * 2.6));
    return;
  }
  // (from close by, inside its glow, the sheath thins so the eye can still see what is in the light)
  float nk = smoothstep(.6, 3.5, uCamD);
  float core = exp(-x * x * 110. / (1. + uFlare * 2.5)) * (1. + uFlare * 1.6) * mix(.35, 1., nk);
  float sheath = (exp(-x * x * 22.) * .55 + exp(-x * x * 3.5) * .2) * mix(.12, 1., nk);
  // (a shimmer of heat in the sheath)
  sheath *= .82 + .18 * sin(vH * 260. - uTime * 7. + x * 5.);
  // streaks running up it, each at its own pace
  float lane = floor((x * .5 + .5) * 14.);
  float st = fract(vH * (3. + h1(lane) * 4.) * 2.2 - uTime * (.35 + h1(lane + 7.) * .5) + h1(lane + 3.));
  float streak = smoothstep(.0, .05, st) * (1. - smoothstep(.12, .5, st)) * exp(-x * x * 12.) * .8;
  // two threads of light winding up round its foot, dissolving as they rise (the near side brighter than the far)
  float hm = vH * uH;
  float hx = 0.;
  for (int k = 0; k < 2; k++) {
    float th = hm * .9 - uTime * 2.2 + float(k) * 3.1416;
    float xs = (.26 + .08 * sin(hm * .7 + float(k) * 2.)) * sin(th) * (1. + hm * .015);
    float d = (x - xs) / (.035 + hm * .001);
    // (in dashes that run up it, not one unbroken thread)
    float dash = smoothstep(.0, .25, fract(hm * .16 - uTime * .9 + float(k) * .37)) * (1. - smoothstep(.45, .8, fract(hm * .16 - uTime * .9 + float(k) * .37)));
    hx += exp(-d * d) * (.3 + .7 * max(cos(th), 0.)) * dash;
  }
  hx *= .6 * uHelix * smoothstep(.4, 2.5, hm) * (1. - smoothstep(8., 22., hm));
  // brightest at its foot, thinning out up in the sky; the white-hot head as it comes down, its glow running ahead
  float fall = mix(1., .35, smoothstep(.0, 1., vH)) * smoothstep(1., .9, vH);
  float lead = exp(-(vH - edge) * 26.) * 2.5;
  float coming = step(.0005, edge);
  float hq = (vH - edge) * uH / 3.2;
  float head = exp(-hq * hq) * exp(-x * x * 6.) * 2.2 * coming;
  vec3 c = uCol * (sheath + streak + head * .6) + uHot * (core * 2.2 + lead * core * (1. + 2. * coming) + head + hx * 2.4);
  c *= fall * uI;
  gl_FragColor = vec4(c, lumA(c));
}`,
  }));
  column.frustumCulled = false;
  column.renderOrder = 9;

  // ---- on the ground: the pool of light at its foot, light running out in cracks, the ring thrown out from it
  const gu = { uI: { value: 0 }, uRing: { value: 0 }, uRingA: { value: 0 }, uTime: { value: 0 }, uCol: { value: col }, uHot: { value: hotC }, uCrack: { value: 0 }, uScale: { value: 4 } };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    ...ADD, uniforms: gu, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: `varying vec2 vQ; void main(){ vQ = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uI, uRing, uRingA, uTime, uCrack, uScale; uniform vec3 uCol, uHot; varying vec2 vQ;
float h1(float x){ return fract(sin(x * 127.13) * 43758.5453); }
void main(){
  float r = length(vQ);
  // (the pool in metres: the plane grows with the ring, the pool at its foot does not)
  float rm = r * uScale;
  float pool = exp(-rm * rm * 3.75) * 2.2 + exp(-rm * rm * .5625) * .5;
  float rq = (r - uRing) / (.025 + .05 * uRing); float ring = exp(-rq * rq) * uRingA;
  // (the ground the ring has passed over still glows a moment behind it)
  float wake = smoothstep(uRing + .01, uRing - .02, r) * exp(-max(uRing - r, 0.) * 7.) * .45 * uRingA;
  // light running out over the ground in cracks, jagged, out to where the ring has reached
  float a = atan(vQ.y, vQ.x);
  float seg = floor(a * 2.5465 + 8.);            // 16 sectors
  float ca = (seg + .5 + (h1(seg) - .5) * .6 - 8.) / 2.5465;
  float bend = sin(r * 23. + seg * 1.7) * .03 + sin(r * 61. + seg) * .012;
  float dl = abs(a - ca - bend) * rm;
  float crack = exp(-dl * dl * 300.) * step(h1(seg + 11.), .8) * smoothstep(uRing * (.55 + .4 * h1(seg + 5.)), 0., r) * exp(-rm * .3) * uCrack;
  vec3 c = uHot * pool * uI + uCol * (ring * 1.6 + wake) + uHot * crack * 2.2;
  gl_FragColor = vec4(c * smoothstep(1., .9, r), 1.);
}`,
  }));
  ground.rotation.x = -Math.PI / 2;
  ground.frustumCulled = false;
  ground.renderOrder = 9;

  // ---- the low wall of light standing on the ring as it runs out
  const wu = { uI: { value: 0 }, uTime: { value: 0 }, uCol: { value: col }, uHot: { value: hotC } };
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).translate(0, 0.5, 0), new THREE.ShaderMaterial({
    ...ADD, side: THREE.DoubleSide, uniforms: wu,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uI, uTime; uniform vec3 uCol, uHot; varying vec2 vUv;
void main(){
  float y = vUv.y;
  // ragged along the top, as if torn out of the ground
  float tear = .55 + .25 * sin(vUv.x * 113. + uTime * 3.) + .2 * sin(vUv.x * 41. - uTime * 1.7);
  float v = exp(-y * 3.2 / tear);
  float lines = .75 + .25 * sin(vUv.x * 640. + y * 9.);
  gl_FragColor = vec4((uCol * .9 + uHot * exp(-y * 14.) * .8) * v * lines * uI, 1.);
}`,
  }));
  wall.frustumCulled = false;
  wall.renderOrder = 9;

  // ---- where it strikes: a flare at its foot (a disc of light, a long flat streak, a fan of short rays)
  const fu = { uI: { value: 0 }, uR: { value: 6 }, uTime: { value: 0 }, uCol: { value: col }, uHot: { value: hotC } };
  const flare = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    ...ADD, depthTest: false, uniforms: fu, vertexShader: SPRITE_VS,
    fragmentShader: `uniform float uI, uTime; uniform vec3 uCol, uHot; varying vec2 vQ;
void main(){
  float r = length(vQ); if (r > 1.) discard;
  float a = atan(vQ.y, vQ.x);
  float disc = exp(-r * r * 30.) * 1.6 + exp(-r * r * 6.) * .4;
  float streak = exp(-vQ.y * vQ.y * 900.) * exp(-abs(vQ.x) * 2.2) * 1.4;
  float rays = pow(.5 + .5 * sin(a * 7. + uTime * .5), 18.) * exp(-r * 3.) * .8;
  gl_FragColor = vec4((uHot * disc + uCol * (streak + rays)) * smoothstep(1., .8, r) * uI, 1.);
}`,
  }));
  flare.frustumCulled = false;
  flare.renderOrder = 11;

  // ---- where it breaks through the leaves overhead (gathering first: light drawn in from all round, then the burst)
  const bu = { uI: { value: 0 }, uR: { value: 8 }, uTime: { value: 0 }, uCol: { value: col }, uHot: { value: hotC }, uGather: { value: 0 } };
  const burst = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    ...ADD, uniforms: bu, vertexShader: SPRITE_VS,
    fragmentShader: `uniform float uI, uTime, uGather; uniform vec3 uCol, uHot; varying vec2 vQ;
void main(){
  float r = length(vQ); if (r > 1.) discard;
  float a = atan(vQ.y, vQ.x);
  // (turning one way while it gathers; flung out the other once it falls)
  float spin = uTime * mix(.3, -1.4, uGather);
  float rays = pow(.5 + .5 * sin(a * 11. + spin), 8.) * .5 + pow(.5 + .5 * sin(a * 17. - spin * .7 + 1.3), 10.) * .4;
  float g = exp(-r * r * 8.) + rays * exp(-r * 2.5) * (1. - exp(-r * r * 60.));
  // the light being drawn in: rings closing on the heart
  float inr = fract(r * 2.2 + uTime * 1.6);
  float drawn = smoothstep(.0, .1, inr) * (1. - smoothstep(.1, .5, inr)) * exp(-r * 1.4) * (1. - exp(-r * r * 40.)) * uGather * .7;
  gl_FragColor = vec4((uCol * (g + drawn) + uHot * exp(-r * r * 60.) * (2. + 3. * uGather)) * smoothstep(1., .7, r) * uI, 1.);
}`,
  }));
  burst.frustumCulled = false;
  burst.renderOrder = 9;

  group.add(column, ground, wall, flare, burst);
  group.visible = false;
  const _o = new THREE.Vector3();
  return {
    group,
    // at: where it stands; amt: its light (0..); drop: how far it has come down (0..1); pilot: the thread ahead of it;
    // flare: the instant it strikes (0..1); helix: the threads winding round its foot; ring: radius of the ring thrown
    // out over the ground (m) and its strength; wall: the wall of light on the ring and its height; crack: light run out
    // in cracks over the ground; canopy: height above `at` where it comes through the leaves, gather: the light
    // gathering there before it falls
    // (from: the height, m, its head starts down from; pilot / reach: the thread's light and how far down it has run)
    set({ at, amt, drop = 1, from = 45, width = 1.2, ring = 0, ringA = 0, canopy = 30, burstR = 9, time, pilot = 0, reach = 1, helix = 0, flare: fl = 0, wall: wA = 0, wallH = 1.5, crack = 0, gather = 0, gatherA = 0, eye = null }) {
      group.visible = amt > 0.002 || ringA > 0.002 || gatherA > 0.002 || pilot > 0.002;
      if (!group.visible) return;
      column.position.copy(at);
      column.visible = amt > 0.002 || pilot > 0.002;
      cu.uI.value = amt; cu.uW.value = width; cu.uDrop.value = drop; cu.uTime.value = time;
      cu.uPilot.value = pilot; cu.uReach.value = reach; cu.uFrom.value = Math.min(1, from / height); cu.uHelix.value = helix; cu.uFlare.value = fl;
      cu.uCamD.value = eye ? Math.hypot(eye.x - at.x, eye.z - at.z) : 10;
      ground.position.copy(at).add(_o.set(0, 0.09, 0));
      const gs = Math.max(4, ring * 1.15);
      ground.scale.set(gs, gs, 1);
      ground.visible = amt > 0.002 || ringA > 0.002;
      gu.uI.value = amt * drop; gu.uRing.value = ring / gs; gu.uRingA.value = ringA; gu.uTime.value = time; gu.uCrack.value = crack; gu.uScale.value = gs;
      wall.visible = wA > 0.002;
      if (wall.visible) { wall.position.copy(at).add(_o.set(0, 0.02, 0)); wall.scale.set(Math.max(ring, 0.3), wallH, Math.max(ring, 0.3)); wu.uI.value = wA; wu.uTime.value = time; }
      flare.visible = fl > 0.002;
      if (flare.visible) { flare.position.copy(at).add(_o.set(0, 0.5, 0)); fu.uI.value = fl; fu.uR.value = 3 + 9 * fl; fu.uTime.value = time; }
      burst.position.copy(at).add(_o.set(0, canopy, 0));
      bu.uI.value = Math.max(amt * smooth01(drop), gatherA); bu.uR.value = burstR; bu.uTime.value = time; bu.uGather.value = gather;
      burst.visible = bu.uI.value > 0.002;
    },
  };
}
const smooth01 = x => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
