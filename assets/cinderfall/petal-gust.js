// The gust of blossom at the opening: as the ink drains out of the valley and the camera comes down to him, a wind
// full of cherry petals blows across the frame from one side to the other. Thousands of petals laid out in the
// camera's own space so the gust always fills the view however fast the camera falls; nearer petals cross faster
// (parallax), the stream rushes toward the lens as the camera dives, and the whole cloud is a pure function of the
// story position (scrubbing back blows it back) plus the clock (it keeps fluttering while the reader waits).
//
// Each petal is a real one: cupped (a small curved sheet, nine points, so it foreshortens and shades across itself
// as it tumbles), the sakura's outline (narrow at the claw, full toward the tip, the notch in the tip), rose at the
// base paling to white, faint veins fanning from the claw. Lit by the sun on whichever face it turns to it, glowing
// pink when the light comes through it from behind, a glint as it flips through the sun. The nearest few pass the
// lens soft and out of focus; the farthest are fine sparks in the streams.
import * as THREE from 'three';
import { rng } from './util.js';
import { FXU } from './fx.js';

const VS = `#include <packing>
attribute vec2 aCorner;      // grid point on the petal, -1..1 (x across, y from the claw to the tip)
attribute vec4 aSeed, aSeed2;
uniform float uTime, uAmt, uU, uTanH, uTanV, uTravel, uPx, uMinD;
uniform vec3 uSunDirP;       // the sun as the drifting things see it (world)
uniform mat4 uShadowMatP; uniform sampler2D tShadowP; uniform float uHasShadowP;
varying vec2 vQ; varying float vA; varying vec3 vTint, vN, vL, vP; varying float vNear, vSeed, vSun;
mat3 axisAngle(vec3 a, float t){ float c = cos(t), s = sin(t), k = 1. - c;
  return mat3(c + a.x*a.x*k, a.y*a.x*k + a.z*s, a.z*a.x*k - a.y*s,  a.x*a.y*k - a.z*s, c + a.y*a.y*k, a.z*a.y*k + a.x*s,  a.x*a.z*k + a.y*s, a.y*a.z*k - a.x*s, c + a.z*a.z*k); }
void main(){
  // depth in front of the lens: the stream rushes toward it as the camera dives, wrapping far again
  float D = 2. + 68. * pow(aSeed.x, .9);
  float d = 2. + mod(D - 2. - uTravel * (.45 + .55 * aSeed.y), 68.);
  // (a few drift right past the lens, big, soft and out of focus: the depth of the gust)
  bool lensP = aSeed.x < .022 * clamp(uTanH / .75, .3, 1.) && uMinD < 3.;
  if (lensP) d = .85 + 1.3 * fract(aSeed.y * 7.3 + uTravel * .015);
  float hw = d * uTanH, hh = d * uTanV;
  // across the frame (in half-widths): every petal enters from the left and leaves to the right, nearer ones faster
  float sp = (.3 + .38 * aSeed.z) * (1. + 4. / (d + 2.));
  float sx = -1.35 - aSeed.w * 2.4 + (uU - 8.45) * sp + .05 * sin(uTime * (.7 + aSeed.y) + aSeed.x * 40.);
  // three streams of wind and loose petals between them; the streams wave and curl, and the whole gust arcs up
  // through the middle
  float sy;
  if (aSeed2.y < .84) {
    float k = floor(aSeed2.y / .84 * 3.);
    float c = k < .5 ? -.42 : k < 1.5 ? .12 : .58;
    // (a stream is a twisting rope of petals: tight at its core, loose at its edge, rolling as it goes)
    float core = (aSeed2.x - .5);
    core *= .16 + .62 * core * core;
    float roll = sx * 3.1 + k * 2.1 + uTime * .5 + aSeed.y * 6.28;
    sy = c + .2 * sin(sx * 2.2 + k * 2.1 + uTime * .35) + core * (1. + .45 * sin(roll));
  } else sy = (aSeed2.x * 2. - 1.) * 1.1;
  sy += .14 - .2 * sx * sx;
  vec3 C = vec3(sx * hw, sy * hh, -d);
  // in the sun or in the shade of the street and the roofs (the shadow map, at the petal's place in the world)
  vSun = 1.;
  if (uHasShadowP > .5) {
    vec3 Cw = transpose(mat3(viewMatrix)) * (C - viewMatrix[3].xyz);
    vec4 sc = uShadowMatP * vec4(Cw, 1.); vec3 s3 = sc.xyz / sc.w;
    if (s3.x > 0. && s3.x < 1. && s3.y > 0. && s3.y < 1. && s3.z < 1.) vSun = step(s3.z - .002, unpackRGBAToDepth(texture2D(tShadowP, s3.xy)));
  }
  // flutter: a petal never falls straight
  float ft = uTime * (1.6 + aSeed2.z * 2.4) + aSeed2.w * 30.;
  C += vec3(sin(ft) * .06, sin(ft * 1.3 + 1.) * .09 - .05 * fract(uTime * .1 + aSeed.y), cos(ft * .9) * .05) * (1. + d * .02);
  // tumbling: a random axis, a random rate, turned on by the wind
  vec3 ax = normalize(vec3(aSeed2.z - .5, aSeed.y - .5, aSeed2.w - .5) + vec3(0., 0., .2));
  mat3 R = axisAngle(ax, uTime * (1.4 + aSeed2.x * 3.2) + aSeed.w * 6.28 + uU * 2.3);
  float size = (.042 + d * .0024) * (.7 + aSeed.z * .6);
  // the cup: curved across its width and a little along it, toward one face or the other
  float cupS = aSeed2.w < .5 ? 1. : -1.;
  float cx = aCorner.x, cy = aCorner.y;
  vec3 loc = vec3(cx * .62, cy, cupS * (cx * cx * .26 + (cy + 1.) * (cy + 1.) * .045));
  vec3 off = R * loc * size;
  vec3 P = C + off;
  gl_Position = projectionMatrix * vec4(P, 1.);
  vQ = aCorner;
  vN = normalize(R * normalize(vec3(-cupS * .84 * cx, -cupS * .09 * (cy + 1.), 1.)));
  vL = normalize((viewMatrix * vec4(uSunDirP, 0.)).xyz);
  vP = P;
  // fade in far, out right at the lens and off the frame's edges; only as many as the gust carries
  float edge = (1. - smoothstep(1.25, 1.5, abs(sx))) * (1. - smoothstep(1.05, 1.35, abs(sy)));
  vA = uAmt * edge * (lensP ? .85 : smoothstep(uMinD, uMinD + 1.4, d)) * (1. - smoothstep(56., 70., d)) * step(aSeed2.z * .999, uAmt * 1.15);
  // never a blot on the glass: very near petals stay small, and soften
  float px = size / d * uPx;
  vA *= 1. - smoothstep(lensP ? 170. : 70., lensP ? 260. : 120., px);
  vNear = smoothstep(5.5, 2.2, d);
  vSeed = aSeed2.w;
  // white, blush and rose petals
  vTint = aSeed.z < .22 ? vec3(.99, .84, .89) : aSeed.z < .82 ? vec3(.97, .64, .77) : vec3(.92, .48, .64);
}`;

const FS = `
uniform vec3 uSunColP, uAmbP; uniform float uTime;
varying vec2 vQ; varying float vA; varying vec3 vTint, vN, vL, vP; varying float vNear, vSeed, vSun;
void main(){
  vec2 p = vQ;
  // the sakura petal: narrow at the claw, full toward the tip, the notch cut into the tip
  float w = mix(.3, 1., smoothstep(-1., .15, p.y)) * mix(1., .84, smoothstep(.45, 1., p.y));
  float r = length(vec2(p.x / w, p.y * (p.y > 0. ? .94 : 1.)));
  float soft = fwidth(r) * 1.5 + vNear * .38;
  float a = 1. - smoothstep(1. - soft, 1., r);
  a *= smoothstep(.07, .2 + vNear * .12, length(vec2(p.x * 2.5, (p.y - 1.04) * 1.2)));
  a *= vA * (1. - .25 * vNear);
  if (a < .01) discard;
  // rose at the claw, paling to white toward the tip, a blush along the rim; veins fanning out from the claw
  float base = smoothstep(.1, -.95, p.y);
  vec3 col = mix(vec3(1., .87, .91), vTint, clamp(.3 + base * .9 + smoothstep(.55, 1., r) * .42, 0., 1.));
  float vein = .5 + .5 * cos(atan(p.x, p.y + 1.15) * 30.);
  col *= 1. - .07 * vein * smoothstep(-.9, .5, p.y) * (1. - vNear);
  // light: the sun on whichever face is turned to it, the sky's light all round, the sun coming through the petal
  // from behind it (pink), and a glint off its sheen as it flips through the sun
  vec3 N = normalize(vN), V = normalize(-vP), L = normalize(vL);
  if (dot(N, V) < 0.) N = -N;
  float ndl = dot(N, L);
  float lit = .3 + .7 * max(ndl, 0.);
  float through = max(-ndl, 0.) * (.35 + .65 * pow(max(dot(-V, L), 0.), 2.));
  float glint = pow(max(dot(reflect(-L, N), V), 0.), 28.) * (.5 + .5 * vSeed);
  vec3 light = uAmbP * .95 + uSunColP * vSun * (lit * .82 + through * .95 * vec3(1., .72, .8) + glint * 1.5);
  // (the ones right past the lens are lit through and glow: soft bright discs of blossom)
  light *= 1. + .45 * vNear;
  gl_FragColor = vec4(col * light, a);
}`;

// the petal's sheet: a 3x3 grid
const GRID = [];
for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) GRID.push([i - 1, j - 1]);
const TRIS = [];
for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const a = j * 3 + i; TRIS.push(a, a + 1, a + 4, a, a + 4, a + 3); }

export function createPetalGust({ count = 3200 } = {}) {
  const r = rng(907);
  const NV = GRID.length;
  const aC = new Float32Array(count * NV * 2), aS = new Float32Array(count * NV * 4), aS2 = new Float32Array(count * NV * 4), idx = new Uint32Array(count * TRIS.length);
  for (let i = 0; i < count; i++) {
    const s = [r(), r(), r(), r()], s2 = [r(), r(), r(), r()];
    for (let k = 0; k < NV; k++) {
      aC.set(GRID[k], (i * NV + k) * 2);
      aS.set(s, (i * NV + k) * 4);
      aS2.set(s2, (i * NV + k) * 4);
    }
    for (let t = 0; t < TRIS.length; t++) idx[i * TRIS.length + t] = i * NV + TRIS[t];
  }
  const g = new THREE.BufferGeometry();
  // (positions are made in the shader; three still wants a position attribute)
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * NV * 3), 3));
  g.setAttribute('aCorner', new THREE.BufferAttribute(aC, 2));
  g.setAttribute('aSeed', new THREE.BufferAttribute(aS, 4));
  g.setAttribute('aSeed2', new THREE.BufferAttribute(aS2, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const uniforms = {
    uTime: { value: 0 }, uAmt: { value: 0 }, uU: { value: 0 }, uTanH: { value: 0.8 }, uTanV: { value: 0.45 }, uTravel: { value: 0 }, uPx: { value: 1000 }, uMinD: { value: 2 },
    uSunDirP: FXU.uSunDirP, uSunColP: FXU.uSunColP, uAmbP: FXU.uAmbP, uShadowMatP: FXU.uShadowMatP, tShadowP: FXU.tShadowP, uHasShadowP: FXU.uHasShadowP,
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: false,
    // (the scene alpha is pulled down under them, like the other drifting things, so no pass outlines them)
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  mesh.name = 'petal-gust';
  return {
    mesh, uniforms,
    // u: story position, amt 0..1, travel: metres the stream has rushed toward the lens, pxPerRad: pixels per radian
    update({ u, time, amt, travel, camera, pxPerRad }) {
      mesh.visible = amt > 0.002;
      if (!mesh.visible) return;
      uniforms.uTime.value = time; uniforms.uAmt.value = amt; uniforms.uU.value = u; uniforms.uTravel.value = travel;
      const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      uniforms.uTanV.value = tv; uniforms.uTanH.value = tv * camera.aspect;
      uniforms.uPx.value = pxPerRad;
    },
  };
}
