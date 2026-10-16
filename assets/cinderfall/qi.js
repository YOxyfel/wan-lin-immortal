// Qi: motes of gold light, all on the GPU and a pure function of their inputs (story position and clock).
// One system serves three things: the uncle's soul flying west (a cluster around a moving heart), the old wood where
// the air begins to glow (motes drifting about a moving field), and the dell, where they gather into streams that
// spiral into the nook and burst when the crystal breaks.
import * as THREE from 'three';

const VS = `
attribute vec4 aSeed;      // x,y,z: random unit-ish offsets, w: random 0..1
uniform float uTime, uSize, uAmt, uDrift, uOrg, uSpiral, uBurst, uPx;
uniform vec3 uCenter, uTarget, uFlow;
uniform float uRadius, uTail, uFlat;
varying float vA, vHot;
float h(float n){ return fract(sin(n * 91.345) * 47453.31); }
void main(){
  float w = aSeed.w;
  float t = uTime * (.12 + w * .2) + w * 40.;
  // drifting in a soft cloud about the centre
  vec3 o = aSeed.xyz * uRadius;
  o += vec3(sin(t * 1.3 + w * 9.), sin(t * .9 + w * 4.) * .6 + sin(t * .37) * .4, cos(t * 1.1 + w * 7.)) * uRadius * .22 * uDrift;
  o.y *= uFlat;
  vec3 p = uCenter + o;
  // a comet: motes left behind along the way it came
  p -= uFlow * w * w * uTail;
  // organised: they find a stream toward the target and spiral into it
  float lane = fract(w * 7.31 + uTime * (.035 + h(w) * .05));
  vec3 a = p, b = uTarget;
  vec3 d = b - a; float L = length(d);
  vec3 up = vec3(0., 1., 0.);
  vec3 sd = normalize(cross(d, up) + 1e-4);
  float ang = lane * 9.4 + w * 6.28;
  vec3 curl = (sd * cos(ang) + cross(normalize(d + 1e-4), sd) * sin(ang)) * (1. - lane) * L * .18;
  vec3 s = mix(a, b, lane * lane * (3. - 2. * lane)) + curl * uSpiral;
  p = mix(p, s, uOrg);
  // the burst: outward from the target, rising, fading
  vec3 bd = normalize(aSeed.xyz + vec3(0., .6, 0.));
  p = mix(p, uTarget + bd * (.4 + w * 2.6) * uBurst + vec3(0., uBurst * uBurst * 1.2, 0.), step(.001, uBurst) * smoothstep(0., .15, uBurst));
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float near = smoothstep(.15, 1.2, -mv.z);
  float tw = .55 + .45 * sin(uTime * (2. + w * 5.) + w * 30.);
  vA = uAmt * near * tw * step(w, uAmt * 1.2 + .02) * (1. - smoothstep(.6, 1., uBurst) * .9);
  vHot = smoothstep(.85, 1., w);
  gl_PointSize = clamp(uSize * (.6 + w * .9) * uPx / max(-mv.z, .1), 1., 9.);
}`;
const FS = `
varying float vA, vHot;
uniform vec3 uCol;
void main(){
  vec2 q = gl_PointCoord - .5;
  float r = length(q);
  float a = smoothstep(.5, .0, r) * vA;
  float core = smoothstep(.22, .0, r);
  if (a < .003) discard;
  gl_FragColor = vec4(mix(uCol, vec3(1., .95, .8), core * .6 + vHot * .3) * (1. + core * 1.5), a);
}`;

export function createQi({ count = 1200, color = [1.0, 0.72, 0.3], intensity = 3.2, size = 0.12, seed = 7 } = {}) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), sd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // a ball, denser toward the middle
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6);
    const q = Math.sqrt(1 - u * u);
    sd.set([Math.cos(th) * q * r, u * r * 0.8, Math.sin(th) * q * r, rnd()], i * 4);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const uniforms = {
    uTime: { value: 0 }, uSize: { value: size }, uAmt: { value: 0 }, uDrift: { value: 1 }, uOrg: { value: 0 }, uSpiral: { value: 1 }, uBurst: { value: 0 },
    uPx: { value: 900 }, uCenter: { value: new THREE.Vector3() }, uTarget: { value: new THREE.Vector3() }, uFlow: { value: new THREE.Vector3() },
    uRadius: { value: 4 }, uTail: { value: 0 }, uFlat: { value: 1 }, uCol: { value: new THREE.Color(...color).multiplyScalar(intensity) },
  };
  // additive light (the ink pass reads it as gold); the scene alpha is pulled down under each mote, as under the other
  // particles, so the painted pass and the ink lines leave it alone (painted over, a mote of gold came out pink)
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return {
    points, uniforms,
    // amt: how many show (0..1); center, radius: the cloud; org: 0 drifting .. 1 streaming to target; burst: 0..1
    set({ time, amt = 1, center, radius, target, org = 0, spiral = 1, burst = 0, drift = 1, flow, tail = 0, px, flat = 1 }) {
      uniforms.uFlat.value = flat;
      uniforms.uTime.value = time;
      uniforms.uAmt.value = amt;
      if (center) uniforms.uCenter.value.copy(center);
      if (radius != null) uniforms.uRadius.value = radius;
      if (target) uniforms.uTarget.value.copy(target);
      uniforms.uOrg.value = org; uniforms.uSpiral.value = spiral; uniforms.uBurst.value = burst; uniforms.uDrift.value = drift;
      if (flow) uniforms.uFlow.value.copy(flow);
      uniforms.uTail.value = tail;
      if (px) uniforms.uPx.value = px;
      points.visible = amt > 0.003;
    },
  };
}

// The soul as a light seen from afar: a bright heart, a soft halo and a faint cross of glints, never smaller on the
// screen than a few pixels (so it reads as a star over the valley); it lights what is below it.
export function createOrb({ color = [1.0, 0.68, 0.28], light = 0xffb060, range = 46, lamp: shared = null } = {}) {
  const uniforms = { uI: { value: 0 }, uCol: { value: new THREE.Color(...color) }, uTime: { value: 0 }, uSize: { value: 1.1 }, uMinPx: { value: 30 }, uPx: { value: 900 } };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: true, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: `uniform float uSize, uMinPx, uPx; varying vec2 vQ;
void main(){
  vQ = position.xy;
  vec4 mv = viewMatrix * vec4((modelMatrix * vec4(0., 0., 0., 1.)).xyz, 1.);
  float d = max(-mv.z, .1);
  mv.xy += position.xy * max(uSize, uMinPx * d / uPx);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform float uI, uTime; uniform vec3 uCol; varying vec2 vQ;
void main(){
  float r = length(vQ);
  float flick = .9 + .1 * sin(uTime * 7.3) * sin(uTime * 3.1 + 1.);
  float core = exp(-r * r * 70.) * 4.;
  float halo = exp(-r * r * 10.) * .75 + exp(-r * 3.4) * .22;
  float glint = (exp(-abs(vQ.y) * 70.) * exp(-abs(vQ.x) * 2.6) + exp(-abs(vQ.x) * 70.) * exp(-abs(vQ.y) * 4.2)) * .4;
  float a = (core + halo + glint) * smoothstep(1., .72, r) * uI * flick;
  gl_FragColor = vec4(mix(uCol, vec3(1., .96, .86), clamp(core * .3, 0., 1.)) * a, 1.);
}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  // (a light already in the scene can be lent: one more light would cost every lit pixel in the valley)
  const lamp = shared || new THREE.PointLight(light, 0, range, 1.6);
  const lampCol = new THREE.Color(light);
  return {
    mesh, light: lamp, uniforms,
    // amt 0..1, pos world, lightI candela at full
    set({ pos, amt, time, px, size, lightI = 90, reach = range }) {
      uniforms.uI.value = amt; uniforms.uTime.value = time;
      if (px) uniforms.uPx.value = px;
      if (size) uniforms.uSize.value = size;
      mesh.position.copy(pos);
      mesh.visible = amt > 0.003;
      // (the lamp stays in the scene: toggling a light's visibility recompiles every lit material)
      if (amt > 0.003) { lamp.position.copy(pos); lamp.color.copy(lampCol); lamp.distance = reach; lamp.decay = 1.6; lamp.intensity = amt * lightI; }
      else if (!shared) lamp.intensity = 0;
    },
  };
}
