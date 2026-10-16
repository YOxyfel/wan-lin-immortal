// Cloud rushing past the eye.
//
// The sky's march draws the cloud whole, at half the resolution; what it cannot draw is the shreds of cloud at arm's
// length, and those are what show how fast the eye is going. When the eye flies through cloud, wisps of it stream
// by: soft torn shapes in a box round the eye (each wrapping to the far side when it passes), drawn out along the way
// they cross the frame, fading as they near the lens. Each takes the light of the cloud behind it (read from the
// sky's own drawing), a little of the light at its height, and the flashes.
import * as THREE from 'three';

const VS = `attribute vec4 aSeed, aSeed2;
uniform vec3 uCam, uVel; uniform float uBox, uTime, uAmt, uExpo;
varying vec2 vUv; varying float vA; varying vec3 vW; varying vec2 vSeed;
void main(){
  vec3 drift = vec3(5., -2., 3.) * uTime * (aSeed2.y - .5);
  vec3 rel = mod(aSeed.xyz * uBox + drift - uCam, uBox) - uBox * .5;
  vec3 p = uCam + rel;
  float dist = length(rel);
  float size = mix(35., 120., aSeed2.x);
  vec4 c = viewMatrix * vec4(p, 1.);
  // (drawn out along its way across the frame: the eye's speed against it, seen from where it is)
  vec3 w = -(viewMatrix * vec4(uVel, 0.)).xyz;
  float z = max(-c.z, 1.);
  vec2 sv = (w.xy * z + c.xy * w.z) / (z * z);
  float sl = length(sv);
  vec2 dir = sl > 1e-5 ? sv / sl : vec2(1., 0.);
  float stretch = 1. + min(sl * uExpo * z / size, 5.);
  vec2 q = position.xy;
  c.xy += dir * q.x * size * stretch + vec2(-dir.y, dir.x) * q.y * size;
  vUv = uv;
  vW = p;
  vSeed = aSeed2.zw;
  vA = uAmt * smoothstep(18., 70., dist) * (1. - smoothstep(uBox * .3, uBox * .46, dist)) * mix(.5, 1., aSeed.w) / sqrt(stretch);
  gl_Position = projectionMatrix * c;
}`;
const FS = `uniform sampler2D tNoise, tBg; uniform vec2 uScreen; uniform vec3 uLow, uHigh, uFlashCol, uFlashPos; uniform float uY0, uY1, uFlash, uTime, uOwn;
varying vec2 vUv; varying float vA; varying vec3 vW; varying vec2 vSeed;
void main(){
  vec2 q = vUv * 2. - 1.;
  float r2 = dot(q, q);
  if (r2 > 1.) discard;
  // (soft, torn only at large scale: fine noise would be painted into blotches)
  float n = texture2D(tNoise, vUv * .22 + vSeed * 7.3 + vec2(uTime * .006, 0.)).r * .7 + texture2D(tNoise, vUv * .5 + vSeed.yx * 3.1).g * .3;
  float a = smoothstep(.25, .8, n * (1. - r2 * .7) + (1. - r2) * .25) * (1. - r2) * (1. - r2);
  vec3 bg = texture2D(tBg, gl_FragCoord.xy / uScreen).rgb;
  vec3 col = mix(bg, mix(uLow, uHigh, smoothstep(uY0, uY1, vW.y)), uOwn);
  // (darker in their thick middles, brighter at the thin edges)
  col *= .76 + .5 * (1. - a);
  float fl = length(vW - uFlashPos);
  col += uFlashCol * uFlash * (exp(-fl * fl / (380. * 380.)) * 1.6 + exp(-fl / 1500.) * .25);
  gl_FragColor = vec4(col, a * vA);
}`;

export function createCloudRush({ count = 70, noise }) {
  const base = new THREE.PlaneGeometry(2, 2, 1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  const s1 = new Float32Array(count * 4), s2 = new Float32Array(count * 4);
  let s = 424242;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) { s1.set([r(), r(), r(), r()], i * 4); s2.set([r(), r(), r(), r()], i * 4); }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(s1, 4));
  g.setAttribute('aSeed2', new THREE.InstancedBufferAttribute(s2, 4));
  g.instanceCount = count;
  const uniforms = {
    uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() }, uBox: { value: 700 }, uTime: { value: 0 }, uAmt: { value: 0 }, uExpo: { value: 0.03 },
    tNoise: { value: noise }, tBg: { value: null }, uScreen: { value: new THREE.Vector2(1, 1) }, uOwn: { value: 0.35 },
    uLow: { value: new THREE.Color(0.1, 0.11, 0.14) }, uHigh: { value: new THREE.Color(0.8, 0.82, 0.86) }, uY0: { value: 0 }, uY1: { value: 1 },
    uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(0.75, 0.72, 1) }, uFlashPos: { value: new THREE.Vector3() },
  };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: true, fog: false }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 16;
  mesh.name = 'cloud-rush';
  mesh.visible = false;
  const last = new THREE.Vector3(), vel = new THREE.Vector3(), v1 = new THREE.Vector3();
  let has = false;
  return {
    mesh, uniforms,
    // amt: how thick the wisps are (0 hides them); bg: the sky's drawing and its size on screen; low/high: the light
    // low and high in the cloud (y0..y1 m) mixed in by own; flash: the lightning's light; dt: the frame's time (the
    // eye's speed is measured from it)
    set({ camera, time, dt, amt, bg, screen, own = 0.35, low, high, y0 = 0, y1 = 1, flash = 0, flashPos = null, flashCol = null }) {
      const p = camera.position;
      if (has && dt > 1e-4) vel.lerp(v1.copy(p).sub(last).divideScalar(Math.max(dt, 1 / 120)).clampLength(0, 3000), 0.35);
      last.copy(p); has = true;
      mesh.visible = amt > 0.003 && !!bg;
      if (!mesh.visible) return;
      uniforms.uCam.value.copy(p); uniforms.uVel.value.copy(vel);
      uniforms.uTime.value = time; uniforms.uAmt.value = amt;
      uniforms.tBg.value = bg; uniforms.uScreen.value.copy(screen); uniforms.uOwn.value = own;
      if (low) uniforms.uLow.value.copy(low);
      if (high) uniforms.uHigh.value.copy(high);
      uniforms.uY0.value = y0; uniforms.uY1.value = y1;
      uniforms.uFlash.value = flash;
      if (flashPos) uniforms.uFlashPos.value.copy(flashPos);
      if (flashCol) uniforms.uFlashCol.value.copy(flashCol);
    },
  };
}
