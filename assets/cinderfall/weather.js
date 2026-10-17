// Weather: branching lightning bolts that strike the peaks, the storm that schedules them, rain streaks and a
// bank of cloud the camera can fly through.
import * as THREE from 'three';
import { U } from './materials.js';
import { rng, clamp, lerp } from './util.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const MAXSEG = 1000;

// ------------------------------------------------------------------ lightning
export const BOLT_VS = `attribute vec3 aB; attribute vec4 aInfo; attribute float aBright; varying float vSide, vBright, vAlong;
void main(){
  vec3 P = mix(position, aB, aInfo.x);
  vec3 dir = normalize(aB - position);
  vec3 toCam = normalize(cameraPosition - P);
  vec3 side = normalize(cross(dir, toCam));
  // wide enough to hold a few pixels of core and a soft halo at any distance
  float w = aInfo.z * (1. + length(cameraPosition - P) * .0042);
  P += side * aInfo.y * w;
  vSide = aInfo.y; vBright = aBright; vAlong = aInfo.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.);
  gl_Position.z = min(gl_Position.z, gl_Position.w * .99999);
}`;
export const BOLT_FS = `uniform float uAmt, uReveal; uniform vec3 uCol; varying float vSide, vBright, vAlong;
void main(){
  if (vAlong > uReveal) discard;
  // graded like an electric arc: white-blue core, an ice-blue sheath, a deep blue halo
  float core = exp(-vSide * vSide * 60.), sheath = exp(-vSide * vSide * 9.), halo = exp(-vSide * vSide * 2.2);
  float head = 1. + smoothstep(uReveal - .05, uReveal, vAlong) * 2.5 * step(uReveal, .999);
  vec3 c = mix(vec3(1.), uCol, .26) * core * 15. + mix(vec3(.62, .84, 1.), uCol, .72) * sheath * 3.6 + uCol * uCol * halo * 1.15;
  // the scene alpha marks the channel itself (as the flames are marked) so the ink can draw it in electric blue
  gl_FragColor = vec4(c * vBright * vBright * uAmt * head, min((core + sheath * .6) * 6. * vBright, 4.) * smoothstep(.02, .15, uAmt));
}`;

export function perp(d, r) {
  const a = V3(r() - 0.5, r() - 0.5, r() - 0.5);
  return a.sub(d.clone().multiplyScalar(a.dot(d))).normalize();
}
export function jag(a, b, disp, levels, r) {
  let pts = [a.clone(), b.clone()];
  let d = a.distanceTo(b) * disp;
  for (let l = 0; l < levels; l++) {
    const out = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const p = pts[k], q = pts[k + 1];
      const dir = q.clone().sub(p).normalize();
      const mid = p.clone().lerp(q, 0.5).addScaledVector(perp(dir, r), d * (r() - 0.5) * 2);
      out.push(mid, q);
    }
    pts = out;
    d *= 0.56;
  }
  return pts;
}

export function createLightning(count = 3) {
  const group = new THREE.Group();
  group.name = 'lightning';
  const bolts = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.BufferGeometry();
    const n = MAXSEG * 4;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aB', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    g.setAttribute('aBright', new THREE.BufferAttribute(new Float32Array(n), 1));
    const idx = new Uint32Array(MAXSEG * 6);
    for (let s = 0; s < MAXSEG; s++) idx.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4 + 1, s * 4 + 3, s * 4 + 2], s * 6);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      vertexShader: BOLT_VS, fragmentShader: BOLT_FS, transparent: true, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { uAmt: { value: 0 }, uReveal: { value: 1 }, uCol: { value: new THREE.Color(0.85, 0.86, 1.0) } },
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 20;
    group.add(mesh);
    bolts.push({ mesh, g, m, t0: -1e9, top: V3(), target: V3(), strength: 1 });
  }
  let next = 0;

  function build(b, from, to, seed, width, branches = 0, levels = 6) {
    const r = rng(seed);
    const segs = [];
    const main = jag(from, to, 0.17, levels, r);
    const total = main.length - 1;
    for (let k = 0; k < total; k++) segs.push([main[k], main[k + 1], width, k / total, 1]);
    const nb = branches || 5 + Math.floor(r() * 5);
    for (let i = 0; i < nb; i++) {
      const k = Math.floor(lerp(0.08, 0.75, r()) * total);
      const start = main[k];
      const dir = main[Math.min(total, k + 4)].clone().sub(start).normalize();
      dir.addScaledVector(perp(dir, r), lerp(0.5, 1.2, r())).normalize();
      const len = from.distanceTo(to) * lerp(0.12, 0.34, r()) * (1 - k / total * 0.6);
      const sub = jag(start, start.clone().addScaledVector(dir, len), 0.24, levels > 6 ? 5 : 4, r);
      for (let j = 0; j < sub.length - 1; j++) segs.push([sub[j], sub[j + 1], width * 0.5 * (1 - j / sub.length * 0.5), k / total + (j / (sub.length - 1)) * 0.3, 0.62 * (1 - j / sub.length * 0.4)]);
      if (r() < 0.6) {
        const j0 = Math.floor(sub.length * lerp(0.3, 0.6, r()));
        const d2 = sub[Math.min(sub.length - 1, j0 + 2)].clone().sub(sub[j0]).normalize().addScaledVector(perp(dir, r), 0.9).normalize();
        const sub2 = jag(sub[j0], sub[j0].clone().addScaledVector(d2, len * 0.4), 0.26, 3, r);
        for (let j = 0; j < sub2.length - 1; j++) segs.push([sub2[j], sub2[j + 1], width * 0.3, k / total + 0.15 + j / (sub2.length - 1) * 0.15, 0.42]);
      }
    }
    const P = b.g.attributes.position, B = b.g.attributes.aB, I = b.g.attributes.aInfo, Br = b.g.attributes.aBright;
    const ns = Math.min(MAXSEG, segs.length);
    for (let s = 0; s < ns; s++) {
      const [a, c, w, along, br] = segs[s];
      for (let v = 0; v < 4; v++) {
        const i = s * 4 + v;
        P.setXYZ(i, a.x, a.y, a.z);
        B.setXYZ(i, c.x, c.y, c.z);
        I.setXYZW(i, v >> 1, (v & 1) ? 1 : -1, w, Math.min(1, along));
        Br.setX(i, br);
      }
    }
    for (const at of [P, B, I, Br]) at.needsUpdate = true;
    b.g.setDrawRange(0, ns * 6);
  }

  // envelope of one strike: leader, return stroke, a re-strike, then the fade
  // stepped leader, return stroke, flicker, two re-strikes down the same channel, then the afterglow
  const envelope = s => {
    if (s < 0 || s > 1.1) return [0, 0];
    const reveal = clamp(s / 0.07);
    let amt;
    if (s < 0.07) amt = 0.3 + 0.15 * Math.sin(s * 400);
    else if (s < 0.12) amt = 1.25;
    else if (s < 0.2) amt = lerp(1, 0.15, (s - 0.12) / 0.08) * (0.75 + 0.25 * Math.sin(s * 300));
    else if (s < 0.26) amt = 1.0;
    else if (s < 0.36) amt = lerp(0.8, 0.12, (s - 0.26) / 0.1);
    else if (s < 0.41) amt = 0.75;
    else amt = 0.75 * Math.exp(-(s - 0.41) * 6.5);
    return [reveal, amt];
  };

  return {
    group,
    // strike from a point in the cloud base down to `target`
    strike(time, top, target, { seed = Math.random() * 1e6, width = 2.2, color = null, strength = 1, branches = 0, levels = 6 } = {}) {
      const b = bolts[next++ % bolts.length];
      b.t0 = time; b.strength = strength;
      b.top.copy(top); b.target.copy(target);
      build(b, top, target, seed | 0, width, branches, levels);
      b.m.uniforms.uCol.value.copy(color || new THREE.Color(0.32, 0.56, 1.0));
    },
    // returns the brightest flash this frame
    update(time) {
      let flash = 0, pos = null, col = null;
      for (const b of bolts) {
        const [reveal, amt] = envelope(time - b.t0);
        b.mesh.visible = amt > 0.003;
        b.m.uniforms.uAmt.value = amt * b.strength;
        b.m.uniforms.uReveal.value = reveal;
        if (amt * b.strength > flash) { flash = amt * b.strength; pos = b.top; col = b.m.uniforms.uCol.value; }
      }
      return { flash, pos, col };
    },
    reset() { for (const b of bolts) { b.t0 = -1e9; b.mesh.visible = false; } },
  };
}

// ------------------------------------------------------------------ rain streaks in a box around the camera
export function createRain(count = 2400) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const r = rng(404);
  const a = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) a.set([r(), r(), r(), r()], i * 4);
  g.setAttribute('aRand', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = count;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    // (uCamVel: how fast the eye itself is going, m/s; with uExpo, the time a drop is exposed for, a drop the eye flies
    // past fast is drawn out into a long streak along the way it goes by)
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAmt: { value: 0 }, uCenter: { value: V3() }, uBox: { value: V3(36, 22, 36) }, uWindV: { value: new THREE.Vector2(1.5, 0.6) }, uCol: { value: new THREE.Color(0.75, 0.8, 0.88) }, uCamVel: { value: V3() }, uExpo: { value: 0 }, uTag: { value: 0 } }]),
    vertexShader: `attribute vec4 aRand; uniform float uTime, uAmt, uExpo; uniform vec3 uCenter, uBox, uCamVel; uniform vec2 uWindV; varying float vA; varying float vX;
#include <fog_pars_vertex>
void main(){
  vec3 vel = vec3(uWindV.x, -9.5 - aRand.w * 3., uWindV.y);
  vec3 q = aRand.xyz * uBox + vel * uTime;
  q = mod(q - uCenter + uBox * .5, uBox) - uBox * .5;
  vec3 c = uCenter + q;
  vec3 rel = vel - uCamVel;
  vec3 dir = normalize(rel);
  vec3 toCam = normalize(cameraPosition - c);
  vec3 side = normalize(cross(dir, toCam));
  vec3 p = c + side * position.x * .014 + dir * position.y * ((.5 + aRand.w * .4) + length(rel) * uExpo);
  vX = position.x;
  vA = uAmt * (1. - smoothstep(.25, .5, length(q / uBox))) * step(aRand.w, uAmt * 1.2);
  vec4 mvPosition = viewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uCol; uniform float uTag; varying float vA; varying float vX;
#include <fog_pars_fragment>
void main(){ float c = vA * .32 * (1. - abs(vX) * 1.6); gl_FragColor = vec4(uCol, c);
#include <fog_fragment>
  // (marked as breaking the frame, in the cinema bars: its light added, the mark in the alpha)
  if (uTag > .5) gl_FragColor = vec4(uCol * c * 1.4, 3. + 2. * c);
}`,
  });
  m.uniforms.uTime = U.uTime;
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
  mesh.name = 'rain';
  // (breaking the frame: added light, the alpha keeping the largest mark; the blending is state, not the program)
  const setTag = on => {
    if (!!m.uniforms.uTag.value === on) return;
    m.uniforms.uTag.value = on ? 1 : 0;
    m.blendSrc = on ? THREE.OneFactor : THREE.SrcAlphaFactor; m.blendDst = on ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
    m.blendEquationAlpha = on ? THREE.MaxEquation : THREE.AddEquation;
    m.blendSrcAlpha = on ? THREE.OneFactor : THREE.ZeroFactor; m.blendDstAlpha = on ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
  };
  return { mesh, uniforms: m.uniforms, setTag };
}

// ------------------------------------------------------------------ a deck of cloud puffs that follows the camera in x/z
export function createCloudBank(count = 70) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const r = rng(808);
  const a = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) a.set([r(), r(), r(), r()], i * 4);
  g.setAttribute('aRand', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = count;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uAmt: { value: 0 }, uCenter: { value: V3() }, uBox: { value: V3(420, 90, 420) }, uBase: { value: 200 }, uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.62, 0.7) }, uNoise: U.uNoise, uTime: U.uTime },
    vertexShader: `attribute vec4 aRand; uniform vec3 uCenter, uBox; uniform float uBase, uTime; varying vec2 vUv; varying float vA; varying vec4 vR; varying float vH;
void main(){
  vec3 q = vec3(aRand.x, aRand.y, aRand.z) * uBox + vec3(uTime * 1.5, 0., uTime * .6);
  q.xz = mod(q.xz - uCenter.xz + uBox.xz * .5, uBox.xz) - uBox.xz * .5;
  vec3 c = vec3(uCenter.x + q.x, uBase + q.y, uCenter.z + q.z);
  float s = mix(70., 150., aRand.w);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = c + (right * position.x + up * position.y) * s;
  vUv = uv; vR = aRand; vH = q.y / uBox.y + .5;
  float d = length(cameraPosition - c);
  vA = smoothstep(4., 40., d) * (1. - smoothstep(.3, .5, length(q.xz / uBox.xz)));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}`,
    fragmentShader: `uniform float uAmt, uTime; uniform vec3 uLit, uShade; uniform sampler2D uNoise; varying vec2 vUv; varying float vA; varying vec4 vR; varying float vH;
void main(){
  vec2 d = vUv - .5;
  float n = texture2D(uNoise, vUv * .7 + vR.xy + uTime * .003).r * .6 + texture2D(uNoise, vUv * 1.9 + vR.zw).g * .4;
  float a = smoothstep(.5, .12, length(d) + (n - .5) * .45);
  vec3 col = mix(uShade, uLit, clamp(vUv.y * .7 + vH * .4 + (n - .5) * .4, 0., 1.));
  gl_FragColor = vec4(col, a * vA * uAmt * .75);
}`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 14;
  mesh.name = 'cloudbank';
  return { mesh, uniforms: m.uniforms };
}

// ------------------------------------------------------------------ ground strikes: a bolt into the earth beside the road
// The bolt itself (its own channels, so the storm's strikes never steal them), the burn it leaves, a glow that dies
// in a breath and a burst of sparks. The burn belongs to the story (it fades as u runs on); the bolt, the glow and
// the sparks run in seconds from the strike.
const FIRE_MARK = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
const SPARKS = 150;
export function createGroundStrikes(groundAt, max = 2) {
  const group = new THREE.Group();
  group.name = 'groundStrikes';
  const bolts = createLightning(max);
  group.add(bolts.group);
  const slots = [];
  const R = 5.5, N = 14;
  for (let i = 0; i < max; i++) {
    // the burn: a small grid laid over the ground (heights filled in at each strike)
    const dg = new THREE.PlaneGeometry(R * 2, R * 2, N, N);
    dg.rotateX(-Math.PI / 2);
    const dm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      // premultiplied: the scorch darkens what is under it, the glow adds; the scene alpha is left alone
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      uniforms: { uGlow: { value: 0 }, uScorch: { value: 0 }, uSeed: { value: 0 }, uCol: { value: new THREE.Color(0.32, 0.56, 1.0) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform float uGlow, uScorch, uSeed; uniform vec3 uCol; varying vec2 vUv;
void main(){
  vec2 d = vUv - .5; float r = length(d) * 2., an = atan(d.y, d.x);
  // a ragged star of burnt ground, streaks thrown out from the strike
  float rag = .5 + .2 * sin(an * 5. + uSeed) * sin(an * 3. - uSeed * 1.7) + .14 * sin(an * 13. + uSeed * 3.) + .08 * sin(an * 29. - uSeed);
  float scorch = smoothstep(rag, rag * .35, r) * (.75 + .25 * sin(r * 30. + an * 4.)) * uScorch;
  float glow = exp(-r * r * 14.) * 1.6 + exp(-r * r * 3.5) * .5 + smoothstep(rag * 1.05, rag * .7, r) * smoothstep(rag * .3, rag * .7, r) * .35;
  vec3 c = (uCol * glow * 3. + vec3(.85, .93, 1.) * exp(-r * r * 60.) * 12.) * uGlow;
  gl_FragColor = vec4(c, clamp(scorch * .9, 0., .95));
}`,
    });
    const decal = new THREE.Mesh(dg, dm);
    decal.frustumCulled = false; decal.visible = false; decal.renderOrder = 6;
    group.add(decal);
    // the air where it struck: a ball of blue light standing on the ground, dying with the glow
    const bm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, ...FIRE_MARK,
      uniforms: { uGlow: { value: 0 }, uCol: { value: new THREE.Color(0.32, 0.56, 1.0) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
  vec3 c = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  gl_Position = projectionMatrix * viewMatrix * vec4(c + right * position.x + vec3(0., position.y, 0.), 1.); }`,
      fragmentShader: `uniform float uGlow; uniform vec3 uCol; varying vec2 vUv;
void main(){
  vec2 d = (vUv - vec2(.5, .12)) * vec2(1., .8); float r = length(d);
  float g = exp(-r * r * 22.) * 1.4 + exp(-r * r * 6.) * .35;
  vec3 c = (uCol * g * 2.2 + vec3(.8, .92, 1.) * exp(-r * r * 140.) * 6.) * uGlow;
  gl_FragColor = vec4(c, min(exp(-r * r * 30.) * uGlow * 2.5, 3.));
}`,
    });
    const ball = new THREE.Mesh(new THREE.PlaneGeometry(7, 7).translate(0, 3.5 - 0.84, 0), bm);
    ball.frustumCulled = false; ball.visible = false; ball.renderOrder = 22;
    group.add(ball);
    // the sparks: a burst from the strike at the return stroke, a smaller one at the re-strike
    const sg = new THREE.BufferGeometry();
    const r = rng(77 + i);
    const ra = new Float32Array(SPARKS * 4);
    for (let k = 0; k < SPARKS; k++) ra.set([r(), r(), r(), r()], k * 4);
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    sg.setAttribute('aRand', new THREE.BufferAttribute(ra, 4));
    const sm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, ...FIRE_MARK,
      uniforms: { uP: { value: V3() }, uAge: { value: -1 }, uPx: { value: Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1.75) }, uCol: { value: new THREE.Color(0.32, 0.56, 1.0) } },
      vertexShader: `attribute vec4 aRand; uniform vec3 uP; uniform float uAge, uPx; varying float vA, vHeat;
void main(){
  float late = step(.62, aRand.w);
  float s = uAge - (late > .5 ? .19 : 0.);
  float life = mix(.35, 1.25, aRand.z) * (late > .5 ? .7 : 1.);
  float th = aRand.x * 6.2832, el = mix(.15, 1.35, aRand.y);
  vec3 dir = vec3(cos(th) * cos(el), sin(el), sin(th) * cos(el));
  float sp = mix(4., 13., aRand.z * aRand.y) * (late > .5 ? .7 : 1.);
  float t = max(s, 0.);
  vec3 p = uP + dir * sp * t * (1. - .25 * t) + vec3(0., -4.9 * t * t, 0.);
  p.y = max(p.y, uP.y + .03);
  vA = step(0., s) * (1. - smoothstep(life * .55, life, s));
  vHeat = 1. - clamp(s / life, 0., 1.);
  vec4 mv = viewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(.11 / max(-mv.z, .5) * 600., 1.5, 4.) * uPx;
}`,
      fragmentShader: `uniform vec3 uCol; varying float vA, vHeat;
void main(){
  float r = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .1, r) * vA;
  vec3 c = mix(uCol * .8, mix(vec3(.55, .85, 1.), vec3(1.), vHeat * vHeat), vHeat) * (2. + 6. * vHeat);
  gl_FragColor = vec4(c * a, a * 4.);
}`,
    });
    const sparks = new THREE.Points(sg, sm);
    sparks.frustumCulled = false; sparks.visible = false; sparks.renderOrder = 21;
    group.add(sparks);
    slots.push({ decal, dm, ball, bm, sparks, sm, t0: -1e9, u0: -1e9, target: V3(), strength: 1 });
  }
  let next = 0;
  const _p = V3();
  return {
    group,
    // a bolt from `top` into the ground at `target`, struck at `time` (seconds) for the story position `u0`
    strike(time, u0, target, top, { seed = 1, strength = 1, color = null } = {}) {
      const S = slots[next++ % slots.length];
      S.t0 = time; S.u0 = u0; S.strength = strength;
      S.target.copy(target);
      bolts.strike(time, top, target, { seed, width: 0.75, strength, branches: 10, color, levels: 9 });
      // lay the burn on the ground
      const pos = S.decal.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const x = target.x + pos.getX(k), z = target.z + pos.getZ(k);
        pos.setY(k, groundAt(x, z) - target.y + 0.06);
      }
      pos.needsUpdate = true;
      S.decal.position.copy(target);
      S.ball.position.copy(target);
      S.dm.uniforms.uSeed.value = (seed % 97) * 0.37;
      S.sm.uniforms.uP.value.copy(target).add(_p.set(0, 0.1, 0));
      if (color) { S.dm.uniforms.uCol.value.copy(color); S.sm.uniforms.uCol.value.copy(color); S.bm.uniforms.uCol.value.copy(color); }
    },
    // the brightest flash this frame and where it is
    update(time, u) {
      const b = bolts.update(time);
      let glowMax = 0, gpos = null;
      for (const S of slots) {
        const s = time - S.t0;
        const live = S.t0 > -1e8 && u > -1e8 && u >= S.u0 - 0.05 && u < S.u0 + 6;
        // the ground flares with the return stroke and the re-strikes, then cools over a second or two
        const glow = !live || s < 0.05 ? 0 : (s < 0.45 ? 1 : Math.exp(-(s - 0.45) * 1.8)) * (0.55 + 0.45 * Math.max(0, b.flash)) * S.strength;
        const scorch = live && s > 0.06 ? smooth01((s - 0.06) / 0.25) * (1 - smooth01((u - S.u0 - 2.5) / 3)) : 0;
        S.dm.uniforms.uGlow.value = glow;
        S.dm.uniforms.uScorch.value = scorch;
        S.decal.visible = glow > 0.002 || scorch > 0.002;
        S.bm.uniforms.uGlow.value = glow * (0.4 + 0.6 * Math.exp(-Math.max(0, s - 0.1) * 1.5));
        S.ball.visible = glow > 0.002;
        S.sm.uniforms.uAge.value = s - 0.07;
        S.sparks.visible = live && s > 0.06 && s < 2;
        if (glow > glowMax) { glowMax = glow; gpos = S.target; }
      }
      return { flash: b.flash, pos: b.pos, col: b.col, glow: glowMax, glowPos: gpos };
    },
    reset() { bolts.reset(); for (const S of slots) { S.t0 = -1e9; S.u0 = -1e9; S.decal.visible = false; S.sparks.visible = false; } },
  };
}
const smooth01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
