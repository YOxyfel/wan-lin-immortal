// Render pipeline: scene → HDR target with depth → bloom, ambient occlusion and sun shafts → one composite pass that
// grades, tone maps and, when the story asks for it, redraws the world as ink on paper (depth-aware lines and washes,
// distance fading into the paper, cinnabar / gold / violet accents kept in colour).
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { U } from './materials.js';
import { FXU } from './fx.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const IGN = `float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }`;
const VIEWPOS = `vec3 viewPos(vec2 uv, float d){ vec4 c = vec4(uv * 2. - 1., d * 2. - 1., 1.); vec4 v = uProjInv * c; return v.xyz / v.w; }`;

const mat = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

// ------------------------------------------------------------------ bloom (13-tap down / tent up, Karis average on the first level)
const DOWN = `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst, uThreshold, uKnee; varying vec2 vUv;
vec3 s(vec2 o){ vec3 c = texture2D(tSrc, vUv + o * uTexel).rgb; return (any(isnan(c)) || any(isinf(c))) ? vec3(0.) : max(c, 0.); }
float kw(vec3 c){ return 1. / (1. + dot(c, vec3(.2126, .7152, .0722))); }
vec3 pre(vec3 c){ float br = max(c.r, max(c.g, c.b)); float soft = clamp(br - uThreshold + uKnee, 0., 2. * uKnee); soft = soft * soft / (4. * uKnee + 1e-4); return c * max(soft, br - uThreshold) / max(br, 1e-4); }
void main(){
  vec3 a = s(vec2(-2., 2.)), b = s(vec2(0., 2.)), c = s(vec2(2., 2.)), d = s(vec2(-2., 0.)), e = s(vec2(0.)), f = s(vec2(2., 0.)), g = s(vec2(-2., -2.)), h = s(vec2(0., -2.)), i = s(vec2(2., -2.));
  vec3 j = s(vec2(-1., 1.)), k = s(vec2(1., 1.)), l = s(vec2(-1., -1.)), m = s(vec2(1., -1.));
  vec3 col;
  if (uFirst > .5) {
    vec3 g0 = pre((a + b + d + e) * .25), g1 = pre((b + c + e + f) * .25), g2 = pre((d + e + g + h) * .25), g3 = pre((e + f + h + i) * .25), g4 = pre((j + k + l + m) * .25);
    float w0 = kw(g0) * .125, w1 = kw(g1) * .125, w2 = kw(g2) * .125, w3 = kw(g3) * .125, w4 = kw(g4) * .5;
    col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  } else col = e * .125 + (a + c + g + i) * .03125 + (b + d + f + h) * .0625 + (j + k + l + m) * .125;
  gl_FragColor = vec4(min(col, vec3(60.)), 1.);
}`;
const UP = `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius, uWeight; varying vec2 vUv;
void main(){
  vec2 o = uTexel * uRadius;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.;
  c += (texture2D(tSrc, vUv + vec2(o.x, 0.)).rgb + texture2D(tSrc, vUv - vec2(o.x, 0.)).rgb + texture2D(tSrc, vUv + vec2(0., o.y)).rgb + texture2D(tSrc, vUv - vec2(0., o.y)).rgb) * 2.;
  c += texture2D(tSrc, vUv + o).rgb + texture2D(tSrc, vUv - o).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb;
  gl_FragColor = vec4(c / 16. * uWeight, 1.);
}`;

// ------------------------------------------------------------------ ambient occlusion (scalable AO from depth only)
const AO = `#include <packing>
uniform sampler2D tDepth; uniform mat4 uProjInv; uniform float uProjScale, uRadius, uIntensity, uBias, uAspect, uFade; varying vec2 vUv;
${IGN}
${VIEWPOS}
#define SAMPLES __AO__
void main(){
  float d = texture2D(tDepth, vUv).x;
  if (d >= .99999) { gl_FragColor = vec4(1.); return; }
  vec3 P = viewPos(vUv, d);
  vec3 cr = cross(dFdx(P), dFdy(P));
  if (dot(cr, cr) < 1e-14) { gl_FragColor = vec4(1.); return; }
  vec3 N = normalize(cr);
  float r = uRadius * uProjScale / max(-P.z, .1);
  r = min(r, .12);
  float a0 = ign(gl_FragCoord.xy) * 6.2831;
  float sum = 0.;
  for (int i = 0; i < SAMPLES; i++) {
    float t = (float(i) + .5) / float(SAMPLES);
    float a = a0 + float(i) * 2.39996;
    vec2 off = vec2(cos(a) / uAspect, sin(a)) * r * t;
    vec2 su = vUv + off;
    float sd = texture2D(tDepth, su).x;
    vec3 S = viewPos(su, sd);
    vec3 v = S - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    float rr = uRadius * uRadius;
    if (vv < rr * 4.) sum += max(0., vn - uBias * -P.z) / (vv + .02) * (1. - vv / (rr * 4.));
  }
  float ao = clamp(1. - 2. * uIntensity * sum / float(SAMPLES), 0., 1.);
  if (isnan(ao)) ao = 1.;
  ao = mix(1., ao, 1. - smoothstep(uFade * .6, uFade, -P.z));
  gl_FragColor = vec4(ao, ao, ao, 1.);
}`;

// ------------------------------------------------------------------ sun shafts: marched through the sun's shadow map
const SHAFTS = `precision highp sampler3D;
#include <packing>
uniform sampler2D tDepth, tShadow; uniform sampler3D tN3; uniform mat4 uProjInv, uCamWorld, uShadowMat; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol;
uniform float uDensity, uMaxDist, uG, uFall, uBase, uBias, uHasShadow, uSS, uTime, uHasN3; uniform vec3 uSunUV, uSSCol; uniform vec2 uWind;
uniform vec4 uAir;   // x: wisp amount, y: wisp scale (1/m), z: ambient share, w: isotropic share of the haze's phase
uniform vec4 uMistP; // x: ground-mist density, y: mist height (m), z: ground under the camera (world y), w: haze scale height
varying vec2 vUv;
${IGN}
${VIEWPOS}
#define STEPS __STEPS__
float n3(vec3 q){ return uHasN3 > .5 ? texture(tN3, q).r : .5; }
void main(){
  float d = texture2D(tDepth, vUv).x;
  vec3 vp = viewPos(vUv, min(d, .99999));
  vec3 wp = (uCamWorld * vec4(vp, 1.)).xyz;
  vec3 rd = wp - uCamPos; float dist = length(rd); rd /= max(dist, 1e-4);
  // the ground under the view: from the camera's own ground to the surface the ray meets (or the camera's, at sky)
  float gEnd = d >= .99999 ? uMistP.z : min(wp.y, uMistP.z + 3.);
  dist = min(dist, uMaxDist);
  float stepL = dist / float(STEPS);
  float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float mu = dot(rd, uSunDir), g2 = uG * uG;
  // forward scattering (beams toward the light) plus a little everywhere it is lit
  float ph = min((1. - g2) / pow(1. + g2 - 2. * uG * mu, 1.5), 4.) * smoothstep(-.2, .5, mu) + uAir.w;
  // mist droplets scatter much more to the side and back than the fine haze does
  float phM = .45 + .55 * ph;
  // wind in metres per second; the two octaves travel at different speeds so the air churns instead of sliding
  vec3 drift = vec3(uWind.x, .03, uWind.y) * uTime;
  vec3 sq = vec3(1., 2.4, 1.) * uAir.y;   // stratified: the air lies in layers and waves, not blobs
  vec3 acc = vec3(0.); float T = 1.;
  for (int i = 0; i < STEPS; i++) {
    float tt = (float(i) + j) * stepL;
    vec3 p = uCamPos + rd * tt;
    float hg = p.y - mix(uMistP.z, gEnd, clamp(tt / max(dist, 1.), 0., 1.));
    // air that moves: slow wisps and waves in the haze, a low mist drifting over the ground
    float n = n3((p - drift) * sq) * .62 + n3((p - drift * 1.7) * sq * 2.7 + vec3(3.1, 1.7, .4)) * .38;
    // sparse wisps: thin air between them, sheets of brighter haze where the noise crests (mean density kept)
    float haze = uDensity * exp(-max(p.y - uBase, 0.) * uFall) * mix(1., .2 + 2.7 * smoothstep(.42, .8, n), uAir.x);
    float mist = uMistP.x * exp(-max(hg, 0.) / uMistP.y) * smoothstep(.4, .78, n);
    float lit = 1.;
    if (uHasShadow > .5) {
      vec4 sc = uShadowMat * vec4(p, 1.);
      vec3 s = sc.xyz / sc.w;
      if (s.x > 0. && s.x < 1. && s.y > 0. && s.y < 1. && s.z < 1.) lit = step(s.z - uBias, unpackRGBAToDepth(texture2D(tShadow, s.xy)));
    }
    acc += T * (uSunCol * lit * (haze * ph + mist * phM) + uAmbCol * uAir.z * (haze + mist)) * stepL;
    T *= exp(-(haze + mist) * stepL * .8);
  }
  vec3 o = acc;
  // crepuscular beams: open sky seen through the canopy, smeared toward the sun on screen
  if (uSS > 0. && uSunUV.z > 0.) {
    vec2 dv = (uSunUV.xy - vUv) / 26.;
    vec2 sp = vUv + dv * j;
    float beam = 0., w = 1., wsum = 0.;
    for (int i = 0; i < 26; i++) {
      float sk = step(.99999, texture2D(tDepth, clamp(sp, 0., 1.)).x);
      beam += sk * w; wsum += w; w *= .955; sp += dv;
    }
    beam /= wsum;
    float toward = pow(max(mu, 0.), 5.);
    o += uSSCol * vec3(1., .8, .52) * beam * uSS * (.25 + toward * 2.) * mix(.3, 1., 1. - step(.99999, d));
  }
  gl_FragColor = vec4(o, T);
}`;

// ------------------------------------------------------------------ ink washes: a quarter-res, blurred copy of the lit scene
// rgb: light (not thresholded), a: view distance (log-averaged; open sky = 4000 m)
const INKPREP = `#include <packing>
uniform sampler2D tSrc, tDepth; uniform vec2 uTexel; uniform float uNear, uFar; varying vec2 vUv;
float vd(vec2 uv){ float d = texture2D(tDepth, uv).x; return d >= .999999 ? 4000. : -perspectiveDepthToViewZ(d, uNear, uFar); }
vec3 sc(vec2 uv){ vec3 s = texture2D(tSrc, uv).rgb; return (any(isnan(s)) || any(isinf(s))) ? vec3(0.) : clamp(s, 0., 40.); }
void main(){
  vec2 a = vec2(-1., -1.) * uTexel, b = vec2(1., -1.) * uTexel, c = vec2(-1., 1.) * uTexel, d = vec2(1., 1.) * uTexel;
  vec3 col = (sc(vUv + a) + sc(vUv + b) + sc(vUv + c) + sc(vUv + d)) * .25;
  float z = log(vd(vUv + a * 1.5) + 1.) + log(vd(vUv + b * 1.5) + 1.) + log(vd(vUv + c * 1.5) + 1.) + log(vd(vUv + d * 1.5) + 1.);
  gl_FragColor = vec4(col, exp(z * .25) - 1.);
}`;
// what each pixel is (from the scene alpha): r flame, g figure, b leaves/grass/cloth, a smoke over open sky
const INKMARK = `uniform sampler2D tSrc, tDepth; uniform vec2 uTexel; varying vec2 vUv;
vec4 mk(vec2 uv){
  float a = texture2D(tSrc, uv).a, d = texture2D(tDepth, uv).x;
  return vec4(smoothstep(1.25, 2.1, a), smoothstep(1.03, 1.07, a) * (1. - smoothstep(1.2, 1.25, a)),
    smoothstep(.95, .962, a) * (1. - smoothstep(.978, .99, a)), d >= .999999 ? clamp(a, 0., 1.) : 0.);
}
void main(){
  vec2 a = vec2(-1., -1.) * uTexel, b = vec2(1., -1.) * uTexel, c = vec2(-1., 1.) * uTexel, d = vec2(1., 1.) * uTexel;
  gl_FragColor = (mk(vUv + a) + mk(vUv + b) + mk(vUv + c) + mk(vUv + d)) * .25;
}`;
const GAUSS = `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec4 c = texture2D(tSrc, vUv) * .2270270270;
  c += (texture2D(tSrc, vUv + uDir * 1.3846153846) + texture2D(tSrc, vUv - uDir * 1.3846153846)) * .3162162162;
  c += (texture2D(tSrc, vUv + uDir * 3.2307692308) + texture2D(tSrc, vUv - uDir * 3.2307692308)) * .0702702703;
  gl_FragColor = c;
}`;

// ------------------------------------------------------------------ the painted look (toon), at half resolution
// A generalised Kuwahara filter: four overlapping quadrants around the pixel, the flattest one preferred, so texture
// noise and small detail settle into flat painted patches while every edge stays crisp. Colours are compared with
// their highlights compressed (a sunlit edge must not win just for being bright).
const PAINT = `uniform sampler2D tColor; uniform vec2 uTexel; uniform float uStride; varying vec2 vUv;
float lum(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
vec3 kwC(vec3 c){ return c / (1. + lum(c)); }
void main(){
  vec3 m0 = vec3(0.), m1 = vec3(0.), m2 = vec3(0.), m3 = vec3(0.), s0 = vec3(0.), s1 = vec3(0.), s2 = vec3(0.), s3 = vec3(0.);
  for (int j = -TOON_R; j <= TOON_R; j++) for (int i = -TOON_R; i <= TOON_R; i++) {
    vec3 c = texture2D(tColor, vUv + vec2(float(i), float(j)) * uTexel * uStride).rgb;
    c = (any(isnan(c)) || any(isinf(c))) ? vec3(0.) : kwC(clamp(c, 0., 60.));
    vec3 cc = c * c;
    if (i <= 0 && j <= 0) { m0 += c; s0 += cc; }
    if (i >= 0 && j <= 0) { m1 += c; s1 += cc; }
    if (i <= 0 && j >= 0) { m2 += c; s2 += cc; }
    if (i >= 0 && j >= 0) { m3 += c; s3 += cc; }
  }
  float n = float((TOON_R + 1) * (TOON_R + 1));
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  vec3 v0 = s0 / n - m0 * m0, v1 = s1 / n - m1 * m1, v2 = s2 / n - m2 * m2, v3 = s3 / n - m3 * m3;
  // (a sharp preference for the flattest quadrant: patches stay crisp instead of averaging into a blur)
  float e0 = v0.r + v0.g + v0.b + 2e-4, e1 = v1.r + v1.g + v1.b + 2e-4, e2 = v2.r + v2.g + v2.b + 2e-4, e3 = v3.r + v3.g + v3.b + 2e-4;
  float em = min(min(e0, e1), min(e2, e3));
  float w0 = pow(em / e0, 6.), w1 = pow(em / e1, 6.), w2 = pow(em / e2, 6.), w3 = pow(em / e3, 6.);
  vec3 m = (m0 * w0 + m1 * w1 + m2 * w2 + m3 * w3) / (w0 + w1 + w2 + w3);
  gl_FragColor = vec4(m / max(1. - lum(m), .02), 1.);
}`;

// ------------------------------------------------------------------ composite
const COMPOSITE = `#include <packing>
uniform sampler2D tColor, tDepth, tBloom, tAO, tShafts, tPaper, tNoise, tBlur, tMark, tPaint; uniform vec2 uBlurTexel; uniform mat4 uProjInv, uCamWorld; uniform float uInkDetail, uSkyWash;
uniform vec2 uRes; uniform float uNear, uFar, uDpr, uTime;
uniform float uExposure, uBloom, uShafts, uAOAmt;
uniform float uSat, uContrast, uVignette, uGrain, uGrainT, uGreenWarm; uniform vec3 uTint, uShadowTint, uHighTint;
uniform float uInk, uInkLine, uInkNear, uInkFar, uInkWash, uInkKey, uSepia, uFigSil, uSeepFig; uniform vec4 uInkSpread, uSeep, uAccent, uHeroBox;
uniform float uBleed, uDebugView; uniform vec2 uBleedC;
uniform float uToon, uToonR, uToonLine, uToonBand, uToonSat, uToonW;
uniform float uPaper, uRedWash, uFlash, uShock, uBlack, uWhite, uDesat; uniform vec3 uFlashTint; uniform vec2 uBoltK; uniform vec3 uWhiteCol; uniform vec4 uWhiteR;
// the clouds in front of the world, when the eye is up among them (rgb: their light, a: what of the world shows through;
// x: where they begin along the ray)
uniform sampler2D tCloudL, tCloudD; uniform float uCloudK;
// the cinema bars (x: how far in, y: their height as a fraction of the screen, z: half a pixel, w: how much glow
// bleeds over them) and their colour
uniform vec4 uBars; uniform vec3 uBarCol;
// the shock of a blow: a ring of bent light racing out from where it landed (xy: there, z: radius in screen heights,
// w: strength); the impact frame: the image struck into two tones for a blink
uniform vec4 uShockR; uniform float uImpactF;
varying vec2 vUv;
float lum(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
float n_hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fbm(vec2 p){ return texture2D(tNoise, p).r * .55 + texture2D(tNoise, p * 2.1 + .3).g * .3 + texture2D(tNoise, p * 4.3 + .7).a * .15; }
vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + .0245786) - .000090537; vec3 b = v * (.983729 * v + .4329510) + .238081; return a / b; }
vec3 aces(vec3 c){
  const mat3 I = mat3(vec3(.59719, .07600, .02840), vec3(.35458, .90834, .13383), vec3(.04823, .01566, .83777));
  const mat3 O = mat3(vec3(1.60475, -.10208, -.00327), vec3(-.53108, 1.10813, -.07276), vec3(-.07367, -.00605, 1.07602));
  c *= uExposure / .6; c = I * c; c = RRTAndODTFit(c); c = O * c; return clamp(c, 0., 1.);
}
vec3 toSRGB(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0., -1. / 3., 2. / 3., -1.); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6. * d + 1e-10)), d / (q.x + 1e-10), q.x); }
float iz(vec2 uv){ float d = texture2D(tDepth, uv).x; return d >= .999999 ? 0. : 1. / max(-perspectiveDepthToViewZ(d, uNear, uFar), 1e-3); }
vec3 blur5(sampler2D t, vec2 uv, vec2 px){ return (texture2D(t, uv).rgb * 2. + texture2D(t, uv + vec2(px.x, px.y)).rgb + texture2D(t, uv - vec2(px.x, px.y)).rgb + texture2D(t, uv + vec2(px.x, -px.y)).rgb + texture2D(t, uv + vec2(-px.x, px.y)).rgb) / 6.; }

// ---------------------------------------------------------------- sumi-e (v3)
// Painted, not filtered. The scene alpha carries what each pixel is (opaque 1, figures 1.1, burning > 1.25,
// leaves/grass/cloth 0.97, drifting particles < 1, open sky 0 + smoke over it); tMark is a blurred quarter-res copy
// of those markers, tBlur a blurred quarter-res copy of the light (a = view distance).
// - Lines: silhouettes and creases of solid things only (roof edges, eaves, beams, walls, posts), heavier near,
//   broken by a dry brush; never round leaves, grass or particles; figures always, with their features.
// - Washes from the blurred light: ink black, one light wash, paper; ragged brush-edged boundaries.
// - Far things become pale layered washes with a soft stroke along the ridge, their feet lost in mist; sky is paper.
// - Flames keep their own shape (particle alpha) in vermilion with gold-white cores, and soak a red glow into the
//   paper around them; smoke over the sky is black ink.
float gKey = .2;
float toneOf(float L){ return L / (L + gKey); }
vec3 worldRay(vec2 uv){ vec4 c = vec4(uv * 2. - 1., 1., 1.); vec4 v = uProjInv * c; return normalize((uCamWorld * vec4(v.xyz / v.w, 0.)).xyz); }
vec3 vpos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 v = uProjInv * vec4(uv * 2. - 1., d * 2. - 1., 1.); return v.xyz / v.w; }
float folOf(float a){ return smoothstep(.95, .962, a) * (1. - smoothstep(.978, .99, a)); }
float figOf(float a){ return smoothstep(1.03, 1.07, a) * (1. - smoothstep(1.2, 1.25, a)); }
// his hair where its strands are fine enough to be marked only in part (alpha to coverage leaves a fine strand's pixel
// at a fraction of the figure's mark, below the figures' band): what is neither solid, nor leaves, nor sky inside the
// box round his head and shoulders on the screen (engine.js uHeroBox; empty, z < x, when he is not in the frame)
// (unmarked, the long lens down the street laid the violet wash over half his hair, and a strike's colour seeped into it)
float heroOf(vec2 uv, float a){
  if (uHeroBox.z <= uHeroBox.x || uv.x < uHeroBox.x || uv.x > uHeroBox.z || uv.y < uHeroBox.y || uv.y > uHeroBox.w || iz(uv) <= 0.) return 0.;
  return smoothstep(.3, .45, a) * (1. - smoothstep(.945, .955, a));
}

vec3 inkOf(vec3 hdrC, vec2 uv, vec2 px, float aspect, float sceneA, out float far, out float dens, out vec4 Bq){
  vec2 nuv = uv * vec2(aspect, 1.);
  float nW = texture2D(tNoise, nuv * .8 + .17).r;
  float nM = texture2D(tNoise, nuv * 2.9 + .53).g;
  float gr = texture2D(tNoise, nuv * 9.7 + .29).a;
  vec2 sd = mat2(.93, -.36, .36, .93) * nuv;
  float stroke = texture2D(tNoise, sd * vec2(.35, 3.2) + .41).b * .6 + texture2D(tNoise, sd * vec2(.9, 8.) + .7).g * .4;
  float fib = texture2D(tNoise, sd * vec2(1.5, 21.) + .13).r;
  float c = iz(uv);
  bool sky = c <= 0.;
  Bq = texture2D(tBlur, uv);
  vec4 Mq = texture2D(tMark, uv);
  float D = Bq.a;
  far = smoothstep(uInkNear, uInkFar, D);
  float farL = (floor(far * 3.) + smoothstep(.3, .7, fract(far * 3.))) / 3.;
  far = mix(far, farL, .6);
  float fol = folOf(sceneA), fig = figOf(sceneA);
  // ---- lines
  float w = uInkLine * uDpr * mix(2.5, 1., far) * mix(.65, 1.4, nM);
  vec2 ox = vec2(px.x * w, 0.), oy = vec2(0., px.y * w);
  float l = iz(uv - ox), r = iz(uv + ox), b = iz(uv - oy), t = iz(uv + oy);
  vec4 cL = texture2D(tColor, uv - ox), cR = texture2D(tColor, uv + ox), cB = texture2D(tColor, uv - oy), cT = texture2D(tColor, uv + oy);
  float folN = max(max(folOf(cL.a), folOf(cR.a)), max(folOf(cB.a), folOf(cT.a)));
  float figN = max(max(figOf(cL.a), figOf(cR.a)), max(figOf(cB.a), figOf(cT.a)));
  float sil = sky ? step(1e-6, max(max(l, r), max(b, t))) : max(max(abs(l - c), abs(r - c)), max(abs(b - c), abs(t - c))) / c;
  float lap = sky ? 0. : abs(l + r + b + t - 4. * c) / c;
  // structure: silhouettes and creases of solid things (inverse depth is linear on a plane: creases show in its
  // Laplacian, flat textured ground never does)
  float structural = max(smoothstep(.06, .18, sil), smoothstep(.014, .045, lap) * .75);
  structural *= 1. - max(fol, folN * (1. - figN));
  structural *= 1. - smoothstep(.35, .75, far);
  // figures: always outlined, and their features drawn (eyes, mouth, folds) from the sharp light
  float figE = (abs(lum(cR.rgb) - lum(cL.rgb)) + abs(lum(cT.rgb) - lum(cB.rgb))) / (lum(hdrC) + .08);
  float figL = max(smoothstep(.04, .14, sil) * max(fig, figN), smoothstep(.35, .9, figE) * fig * .75);
  float line = max(structural, figL);
  // the brush: pressure swells and fades, dry bristles break the stroke
  line *= smoothstep(.14, .46, fib * .7 + nM * .5);
  // no outlines round snow, ash and embers
  if (!sky) line *= max(smoothstep(.55, .95, min(sceneA, 1.)), max(fol, fig));
  // ---- washes from the blurred light; figures from their own light, graded, so faces model
  float Lw = mix(lum(Bq.rgb), lum(hdrC), max(uInkDetail, fig * .9));
  float tt = .5 + (toneOf(Lw) - .5) * 1.9 + (nW - .5) * .12 + (stroke - .5) * .16 + (fib - .5) * .05;
  float kB = 1. - smoothstep(.24, .28, tt);
  float kL = 1. - smoothstep(.42, .53, tt);
  float d = max(kB, kL * .3);
  float tf = toneOf(lum(hdrC));
  d = mix(d, max(smoothstep(.66, .16, tf) * .62, .08 + nW * .05), fig);
  // long brush streaks in the washes; dry bristles where the black masses end and inside them
  d *= mix(.82 + stroke * .32, 1., kB);
  float edgeB = kB * (1. - smoothstep(.0, .06, .26 - tt));
  d *= 1. - edgeB * smoothstep(.55, .85, fib) * .55;
  d *= 1. - kB * smoothstep(.7, .9, stroke) * smoothstep(.5, .8, fib) * .28;
  // creases hold ink near the eye
  d = max(d, (1. - texture2D(tAO, uv).r) * .45 * uAOAmt * (1. - far) * (1. - fol));
  if (!sky) {
    vec2 o2 = px * 2. * uDpr;
    vec3 Pc = vpos(uv);
    // form: a light wash on what turns away from an imagined brush-light, for solid things near the eye
    vec3 N = normalize(cross(vpos(uv + vec2(o2.x, 0.)) - vpos(uv - vec2(o2.x, 0.)), vpos(uv + vec2(0., o2.y)) - vpos(uv - vec2(0., o2.y))));
    float turn = dot(N, normalize(vec3(-.55, .62, .55)));
    float form = smoothstep(.1, -.6, turn) * (1. - smoothstep(2., 14., -Pc.z)) * (1. - fol);
    d = max(d, form * (.26 + nW * .12));
    // far: pale layered washes with a soft stroke along the ridge against the sky; their feet dissolve in mist
    float wy = (uCamWorld * vec4(Pc, 1.)).y;
    float layerW = (.1 + .16 * (1. - far)) * (.75 + nW * .5);
    d = mix(d, layerW, smoothstep(.25, .6, far));
    // the ridge: a darker wash just under the skyline, fading down the slope (a brush pulled along the ridge)
    float sk1 = step(iz(uv + vec2(0., px.y * 6. * uDpr)), 1e-6), sk2 = step(iz(uv + vec2(0., px.y * 16. * uDpr)), 1e-6);
    d = max(d, (sk1 * .2 + sk2 * .1) * smoothstep(.2, .55, far) * (.7 + nM * .6) * (1. - fol * .5));
    d *= 1. - smoothstep(.3, .7, far) * (1. - smoothstep(25., 160., wy)) * .85;
  }
  if (sky) {
    // open sky is paper, a faint wash low on the horizon; smoke in front of it is ink
    vec3 rd = worldRay(uv);
    float hz = exp(-max(rd.y, 0.) * 7.) * .16 * uSkyWash * (.6 + nW * .8);
    // (under a bolt, the smoke that is there: its mark is 6 over it, its edge 1.5, 3 or 4.5 (weather.js), so the smoke is
    // the remainder over 1.5; flames, warm, keep their own. Taken whole, the mark put the bolt in front of the thickest
    // smoke: dimming, its edges were inked black, two dark lines down a pale band, a hollow tube)
    vec3 hc = max(hdrC, 0.) / max(max(hdrC.r, max(hdrC.g, hdrC.b)), 1e-4);
    float sA = sceneA >= 1.45 && hc.r - hc.b < .35 ? mod(sceneA + .01, 1.5) - .01 : sceneA;
    float smoke = clamp(sA, 0., 1.) * (1. - smoothstep(.42, .8, toneOf(lum(hdrC))));
    d = max(hz, smoke * (.9 + nM * .2));
  }
  // (for one held moment a figure is black against the light, not drawn: the boy in the doorway)
  d = mix(d, .97, fig * uFigSil);
  dens = clamp(max(d, line), 0., 1.);
  vec3 paper = texture2D(tPaper, nuv * .9).rgb * vec3(1., .965, .9) * (.97 + gr * .06);
  vec3 inkc = vec3(.028, .025, .024);
  paper = mix(paper, paper * vec3(1., .9, .7), uSepia);
  inkc = mix(inkc, vec3(.19, .1, .045), uSepia);
  vec3 wash = mix(paper, inkc, 1. - pow(1. - clamp(d, 0., 1.) * .985, 1.8));
  wash = mix(wash, wash * vec3(.96, .98, 1.03), smoothstep(.1, .45, d) * (1. - smoothstep(.55, .95, d)) * (1. - uSepia));
  return mix(wash, inkc, 1. - pow(1. - clamp(line, 0., 1.) * .97, 1.8));
}

void main(){
  vec2 uv = vUv;
  vec2 px = 1. / uRes;
  float aspect = uRes.x / uRes.y;
  uv += vec2(sin(uTime * 61.) * .004, cos(uTime * 47.) * .003) * uShock;
  if (uShockR.w > 0.) {
    vec2 dv = (uv - uShockR.xy) * vec2(aspect, 1.);
    float dl = length(dv), rr = uShockR.z;
    float wave = (dl - rr) / max(rr * .12 + .004, 1e-3);
    // (light bent outward just inside the ring, pulled in just outside it)
    uv -= dv / max(dl, 1e-4) / vec2(aspect, 1.) * wave * exp(-wave * wave) * uShockR.w * .018;
  }
  vec3 hdr = texture2D(tColor, uv).rgb;
  // (a pixel some shader broke, not a number: drawn as its good neighbours, never as a black speck or line)
  if (any(isnan(hdr)) || any(isinf(hdr))) {
    vec3 acc = vec3(0.); float nw = 0.;
    for (int k = 0; k < 8; k++) {
      vec2 o = vec2(k == 0 ? 1. : k == 1 ? -1. : k == 4 ? 1. : k == 5 ? -1. : k == 6 ? 1. : k == 7 ? -1. : 0., k == 2 ? 1. : k == 3 ? -1. : k == 4 ? 1. : k == 5 ? 1. : k == 6 ? -1. : k == 7 ? -1. : 0.) * px * (k > 3 ? 2. : 1.5);
      vec3 cn = texture2D(tColor, uv + o).rgb;
      if (!(any(isnan(cn)) || any(isinf(cn)))) { acc += cn; nw += 1.; }
    }
    hdr = nw > 0. ? acc / nw : vec3(0.);
  }
  // the painted look: flat patches with crisp edges (not on open sky, flames, or the figures)
  float toonLine = 0.;
  if (uToon > .001) {
    float dC = texture2D(tDepth, uv).x;
    float aC = texture2D(tColor, uv).a;
    if (dC < .999999) {
      vec2 ox = vec2(px.x * uDpr * uToonW, 0.), oy = vec2(0., px.y * uDpr * uToonW);
      // what each pixel is (scene alpha: solid 1, leaves .97, figures 1.1, flames > 1.25); a figure is also
      // anything right next to one (its hair's soft ends, the rims of petals and leaves drifting in front of it)
      float aL = texture2D(tColor, uv - ox).a, aR = texture2D(tColor, uv + ox).a, aB = texture2D(tColor, uv - oy).a, aT = texture2D(tColor, uv + oy).a;
      float aL2 = texture2D(tColor, uv - ox * 2.2).a, aR2 = texture2D(tColor, uv + ox * 2.2).a, aB2 = texture2D(tColor, uv - oy * 2.2).a, aT2 = texture2D(tColor, uv + oy * 2.2).a;
      #define ISFIG(a) (step(1.03, a) * step(a, 1.25))
      float fig = ISFIG(aC);
      float figNear = max(max(max(ISFIG(aL), ISFIG(aR)), max(ISFIG(aB), ISFIG(aT))), max(max(ISFIG(aL2), ISFIG(aR2)), max(ISFIG(aB2), ISFIG(aT2))));
      float figK = max(fig, figNear);
      // (painted: solid things and leaves only)
      float paintK = smoothstep(.93, .95, aC) * (1. - smoothstep(1.015, 1.03, aC)) * (1. - figK);
      if (paintK > .001) {
        vec3 pnt = texture2D(tPaint, uv).rgb;
        if (!(any(isnan(pnt)) || any(isinf(pnt)))) hdr = mix(hdr, pnt, uToon * paintK);
      }
      // ink lines: silhouettes and creases from the depth, thinner far away
      float c0 = iz(uv);
      float l = iz(uv - ox), r = iz(uv + ox), b = iz(uv - oy), t = iz(uv + oy);
      float sil = max(max(abs(l - c0), abs(r - c0)), max(abs(b - c0), abs(t - c0))) / max(c0, 1e-5);
      float lap = abs(l + r + b + t - 4. * c0) / max(c0, 1e-5);
      float dist = 1. / max(c0, 1e-5);
      float solid = smoothstep(.985, 1., aC) * (1. - smoothstep(1.015, 1.03, aC)) * (1. - figK);
      float fol = smoothstep(.95, .962, aC) * (1. - smoothstep(.978, .99, aC));
      // (only real breaks: a thing against what is well behind it, and creases close to the eye; no scribble of
      // lines over every bush and leaf; a figure outlined on its own edge where what is behind it falls away)
      float lineS = max(smoothstep(.12, .3, sil), smoothstep(.03, .08, lap) * .55 * (1. - smoothstep(8., 18., dist))) * solid * (1. - fol);
      float lineF = smoothstep(.12, .3, sil) * fig;
      toonLine = max(lineS * (1. - smoothstep(20., 90., dist)), lineF * (1. - smoothstep(40., 120., dist)));
    }
  }
  if (uShock > 0.) {
    float sr = texture2D(tColor, uv + vec2(.004, 0.) * uShock).r, sb = texture2D(tColor, uv - vec2(.004, 0.) * uShock).b;
    if (!(isnan(sr) || isinf(sr))) hdr.r = sr;
    if (!(isnan(sb) || isinf(sb))) hdr.b = sb;
  }
  float ao = (texture2D(tAO, uv).r * 2. + texture2D(tAO, uv + px * vec2(1.5, .5)).r + texture2D(tAO, uv - px * vec2(1.5, .5)).r + texture2D(tAO, uv + px * vec2(-.5, 1.5)).r + texture2D(tAO, uv - px * vec2(-.5, 1.5)).r) / 6.;
  hdr *= mix(1., ao, uAOAmt);
  // the clouds between the eye and the world (flying in and over them)
  if (uCloudK > 0.) {
    float dZ = texture2D(tDepth, uv).x;
    if (dZ < .999999) {
      float dist = length(vpos(uv));
      vec4 cl = texture2D(tCloudL, uv), cd = texture2D(tCloudD, uv);
      float k = smoothstep(cd.x - 60., cd.x + 220., dist) * uCloudK;
      if (!(any(isnan(cl)) || any(isinf(cl)))) hdr = mix(hdr, hdr * clamp(cl.a, 0., 1.) + cl.rgb, k);
    }
  }
  // the half-res air, blurred over a small disc that stops at depth breaks (no haze bleeding over near silhouettes)
  vec4 airS = vec4(0.);
  if (uShafts > 0.) {
    float zc = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar), wsum = 1.;
    airS = texture2D(tShafts, uv);
    for (int k = 0; k < 8; k++) {
      float a = float(k) * .785 + .39 + n_hash(uv) * .8, r = k - k / 2 * 2 == 0 ? 2.2 : 4.4;
      vec2 o = uv + vec2(cos(a), sin(a)) * r * px;
      float zk = -perspectiveDepthToViewZ(texture2D(tDepth, o).x, uNear, uFar);
      float w = exp(-abs(zk - zc) / (.06 * zc + .3));
      airS += texture2D(tShafts, o) * w; wsum += w;
    }
    airS /= wsum;
  }
  vec3 shf = airS.rgb;
  if (!(any(isnan(airS)) || any(isinf(airS)))) hdr = hdr * mix(1., clamp(airS.a, 0., 1.), uShafts) + shf * uShafts;
  if (uDebugView > .5 && uDebugView < 2.5) { gl_FragColor = vec4(uDebugView < 1.5 ? toSRGB(shf * uShafts * 3.) : vec3(ao), 1.); return; }
  // (a broken pixel's glow is no glow: one not-a-number in the scene, blurred into the bloom, printed a black speck)
  { vec3 bl = texture2D(tBloom, uv).rgb; if (!(any(isnan(bl)) || any(isinf(bl)))) hdr += bl * uBloom; }
  // grade in scene-linear light, then tone map
  hdr *= uTint;
  hdr.r += max(hdr.g - max(hdr.r, hdr.b), 0.) * uGreenWarm;
  float L = lum(hdr);
  hdr = max(mix(vec3(L), hdr, uSat), 0.);
  // filmic contrast around mid-grey, in log space (no clipped blacks)
  hdr = .18 * pow(max(hdr, 1e-6) / .18, vec3(uContrast));
  // split tone: cool shadows, warm light (each tint is luminance-normalised so it shifts hue, not exposure)
  float Lt = lum(hdr);
  vec3 split = mix(uShadowTint, uHighTint, smoothstep(.02, .6, Lt));
  hdr *= split / max(lum(split), 1e-3);
  float Lh = lum(hdr);
  vec3 col = aces(hdr);
  if (uToon > .001) {
    // a little more colour, light settling into soft bands, and the line drawn in a dark tone of what it outlines
    float Lc = lum(col);
    // vibrance: muted colours gain more than the already vivid ones
    vec3 hs = rgb2hsv(col);
    col = max(mix(vec3(Lc), col, 1. + uToonSat * uToon * (1.4 - hs.y)), 0.);
    // light settles into soft bands (in perceptual steps, so the shadows never crush to black)
    if (uToonBand > .001) {
      float P = sqrt(max(lum(col), 0.)), q = P * 6.;
      float Pq = (floor(q) + smoothstep(.4, .6, fract(q))) / 6.;
      float Lb = mix(P, Pq, uToonBand * uToon); Lb *= Lb;
      col *= Lb / max(P * P, 1e-4);
    }
    col = mix(col, col * vec3(.2, .18, .24), clamp(toonLine * uToonLine * uToon, 0., 1.));
  }
  col = mix(col, vec3(lum(col)), uDesat);
  // the impact frame: deep violet-black and a hot white, nothing between
  if (uImpactF > 0.) {
    float Li = smoothstep(.32, .5, lum(col));
    col = mix(col, mix(vec3(.05, .015, .11), vec3(1., .96, .9), Li), uImpactF);
  }
  // ink: drawn over the world where the ink has spread and colour has not seeped back
  float inkK = 0.;
  if (uInk > .001 || uDebugView > 2.5) {
    float lk = 0.;
    for (int i = 0; i < 4; i++) for (int j = 0; j < 3; j++) lk += log(lum(texture2D(tBlur, vec2((float(i) + .5) / 4., (float(j) + .35) / 3.2)).rgb) + 2e-3);
    gKey = exp(lk / 12.) * uInkKey;
  }
  if (uDebugView > 2.5) {
    vec4 Bd = texture2D(tBlur, uv); float tt = .5 + (toneOf(mix(lum(Bd.rgb), lum(hdr), uInkDetail)) - .5) * 1.75; float a = texture2D(tColor, uv).a;
    gl_FragColor = vec4(vec3(tt), 1.); if (tt < .28) gl_FragColor.rgb = vec3(.1, .2, .5); if (tt > .55) gl_FragColor.rgb = vec3(1., .9, .6);
    if (a > 1.02) gl_FragColor.rgb = vec3(1., 0., 0.); if (a < .98) gl_FragColor.rgb = vec3(0., 1., 0.);
    return;
  }
  if (uInk > .001) {
    vec2 q = (vUv - uInkSpread.xy) * vec2(aspect, 1.);
    float spread = smoothstep(uInkSpread.z, uInkSpread.z - uInkSpread.w, length(q) + (fbm(vUv * 1.7 + 3.1) - .5) * .45);
    vec2 q2 = (vUv - uSeep.xy) * vec2(aspect, 1.);
    // (its edge ragged with the paper's grain, the more so the wider it is: a small one stays round)
    float seep = smoothstep(uSeep.z, uSeep.z - uSeep.w, length(q2) + (fbm(vUv * 2.3 + .7) - .5) * .5 * clamp(uSeep.z / .6, .12, 1.));
    // (the people left in ink where the colour comes back round them, if asked: in it, lit blue by a strike or orange by
    // the fire, the boy's linen read as bare skin one moment and an orange tunic the next, and a grey robe between)
    // (and what is round them, from the blurred marks: his hair's fine ends are not marked, and came out pink)
    if (uSeepFig > 0.) { float sa = texture2D(tColor, uv).a; seep *= 1. - uSeepFig * max(max(figOf(sa), heroOf(uv, sa)), smoothstep(.06, .3, texture2D(tMark, uv).g)); }
    // the opening watercolour bleed: colour flows out from a point
    vec2 qb = (vUv - uBleedC) * vec2(aspect, 1.);
    float bd = length(qb) + (fbm(vUv * 1.3 + uTime * .002) - .5) * .42 + (fbm(vUv * 6.) - .5) * .08;
    float bleed = smoothstep(uBleed, uBleed - .18, bd);
    inkK = uInk * spread * (1. - seep) * (1. - bleed);
    if (inkK > .001) {
      float far, dens; vec4 Bq;
      // (what a pixel is, read at its own texel: the shake moves the frame by a fraction of a pixel, and read between two
      // texels a bolt's mark and the sky beside it averaged into a figure's, outlined in dots)
      float sceneA = texture2D(tColor, (floor(uv * uRes) + .5) / uRes).a;
      vec3 inkImg = inkOf(hdr, uv, px, aspect, sceneA, far, dens, Bq);
      float ex = uExposure / .6;
      // ---- what burns: flames and embers mark themselves in the scene alpha (> 1.25) with their own shape
      vec3 hn = max(hdr, 0.) / max(max(hdr.r, max(hdr.g, hdr.b)), 1e-4);
      float warm = smoothstep(.2, .55, hn.r - hn.b) * smoothstep(.95, .65, hn.b);
      float flame = smoothstep(1.25, 2.1, sceneA) * warm;
      float Lf = lum(hdr) * ex;
      vec3 bn = max(Bq.rgb, 0.) / max(max(Bq.r, max(Bq.g, Bq.b)), 1e-4);
      // their light soaks a red glow into the paper around them (only around real flames: the blurred marker)
      float glowF = smoothstep(.02, .35, texture2D(tMark, uv).r) * (1. - far * .6) * smoothstep(.1, .4, bn.r - bn.b);
      inkImg = mix(inkImg, inkImg * vec3(1.03, .4, .22), glowF * .75 * uAccent.x);
      inkImg += vec3(.18, .03, .0) * smoothstep(.25, .8, texture2D(tMark, uv).r) * smoothstep(.0, .3, bn.r - bn.b) * uAccent.x;
      // tongues of vermilion, orange toward the heart, gold-white where they burn hottest
      float hot = smoothstep(2.5, 9., Lf);
      vec3 flameCol = mix(vec3(.84, .07, .025), vec3(.98, .34, .06), smoothstep(.9, 3., Lf));
      flameCol = mix(flameCol, vec3(1., .88, .6), hot * .85);
      inkImg = mix(inkImg, flameCol, clamp(flame * 1.15, 0., 1.) * uAccent.x);
      // ---- lightning, marked like the flames but cold: electric-blue strokes, cyan where they burn, white-hot cores
      // (the colour comes from the hue, not the brightness: a white-hot channel would vanish into the paper)
      // (laid on like pigment, as thick as it is bright, in one blue: dimming, it thins into what is behind it, its hue
      // held; only its heart, burning, goes white. Graded from dark blue at its dim edge to white at its heart, a dim
      // stroke was a pale band between two dark-blue lines, a neon tube, its kinks crossed knots; and in the white of a
      // cut, two blue lines)
      float boltM = smoothstep(1.25, 2.1, sceneA) * smoothstep(-.02, .12, hn.b - hn.r) * smoothstep(.1, 1.1, Lf) * uBoltK.x;
      float blueness = smoothstep(.1, .45, hn.b - hn.r);
      // (and no white heart in the white of a cut: with its glow washed out there, the heart was the page and the stroke
      // two blue lines)
      vec3 boltCol = mix(vec3(.15, .56, 1.), vec3(.82, .95, 1.), (1. - blueness * .6) * smoothstep(10., 32., Lf) * (1. - smoothstep(0., .35, uWhite)));
      // their light: a cyan glow soaked round the channel, a pale cyan wash where the flash falls on the paper
      // (the people and the wolves stay ink in a bolt's blue as in the colour round a strike: in its soak and its cold
      // light, his grey hair went blue beside a bolt on the road)
      float figV = max(max(figOf(sceneA), heroOf(uv, sceneA)), smoothstep(.06, .3, texture2D(tMark, uv).g));
      float glowB = smoothstep(.02, .3, texture2D(tMark, uv).r) * smoothstep(.0, .25, bn.b - bn.r) * uBoltK.x;
      inkImg = mix(inkImg, inkImg * vec3(.42, .8, 1.04) + vec3(.0, .05, .12), glowB * .85 * uAccent.x * (1. - figV));
      float coldLit = smoothstep(.12, .4, bn.b - bn.r) * smoothstep(.3, 1.4, lum(Bq.rgb) * ex) * uBoltK.y;
      inkImg = mix(inkImg, inkImg * vec3(.6, .88, 1.05), coldLit * .65 * uAccent.x * (1. - figV));
      inkImg = mix(inkImg, boltCol, clamp(boltM * 1.3, 0., 1.) * uAccent.x);
      // the sect's violet: a wash and a bright core
      float hv = rgb2hsv(bn).x;
      float violet = smoothstep(.09, .03, abs(hv - .77)) * smoothstep(.25, .5, rgb2hsv(bn).y) * smoothstep(.08, .6, lum(Bq.rgb) * ex);
      float vcore = smoothstep(.09, .03, abs(rgb2hsv(hn).x - .77)) * smoothstep(.3, .6, rgb2hsv(hn).y) * smoothstep(.3, 1.4, Lf);
      // (and what glows violet of itself, by its own colour before the grade takes the colour out of the burning night:
      // the wolves' eyes, the sect's fires)
      vec3 rawC = max(texture2D(tColor, uv).rgb, 0.), rn = rawC / max(max(rawC.r, max(rawC.g, rawC.b)), 1e-4);
      vcore = max(vcore, smoothstep(.09, .03, abs(rgb2hsv(rn).x - .76)) * smoothstep(.45, .7, rgb2hsv(rn).y) * smoothstep(.5, 1.6, lum(rawC) * ex));
      // (its wash not over the people, nor the wolves: in a glow beside his head, the boy's grey hair went lilac)
      inkImg = mix(inkImg, inkImg * vec3(.75, .45, 1.1), violet * .8 * uAccent.z * (1. - figV));
      // (violet however bright: a small hot light, a wolf's eye, the slit of a mask, stays violet; only the very heart of
      // a great one pales)
      inkImg = mix(inkImg, mix(vec3(.5, .15, .88), vec3(.86, .72, 1.), smoothstep(4., 14., Lf) * .75), vcore * uAccent.z);
      // gold: the star, the scroll
      float gold = smoothstep(.06, .02, abs(rgb2hsv(hn).x - .12)) * smoothstep(.3, .6, rgb2hsv(hn).y) * smoothstep(.8, 1.8, Lf);
      inkImg = mix(inkImg, mix(vec3(.96, .7, .24), vec3(1., .94, .78), smoothstep(2., 6., Lf)), gold * uAccent.y);
      // memory keeps the red of the maples (and of blood)
      float hd = min(rgb2hsv(hn).x, 1. - rgb2hsv(hn).x);
      float red = smoothstep(.06, .02, hd) * smoothstep(.5, .8, rgb2hsv(hn).y) * smoothstep(.04, .25, lum(hdr) / gKey) * uAccent.w * (1. - flame);
      inkImg = mix(inkImg, mix(vec3(.66, .07, .04), vec3(.76, .13, .05), uSepia) * (.8 + n_hash(uv) * .25), clamp(red * 1.2, 0., 1.));
      // the wet edges where colour meets ink: the opening bleed and the spreading ink both leave a dark tide line
      float rim = smoothstep(uBleed - .02, uBleed - .09, bd) * (1. - smoothstep(uBleed - .12, uBleed - .24, bd));
      float sd2 = length(q) + (fbm(vUv * 1.7 + 3.1) - .5) * .45;
      float rimS = smoothstep(uInkSpread.z - uInkSpread.w * .15, uInkSpread.z - uInkSpread.w * .5, sd2) * (1. - smoothstep(uInkSpread.z - uInkSpread.w * .5, uInkSpread.z - uInkSpread.w, sd2)) * step(uInkSpread.z, 2.5);
      col = mix(col * (1. - rim * .25), inkImg, inkK);
      col = mix(col, col * .25, rimS * .6);
    }
  }
  col = mix(col, col * vec3(1.25, .55, .45) + vec3(.04, 0., 0.), uRedWash);
  vec3 paper = texture2D(tPaper, vUv * vec2(aspect, 1.) * .9).rgb * vec3(.98, .95, .88);
  col = mix(col, paper, uPaper);
  col += uFlashTint * uFlash * (.25 + lum(col));
  // the white: even, or blooming out of a point (the soul's light filling the frame)
  float wR = 1.; vec3 halo = vec3(0.);
  if (uWhiteR.z >= 0.) {
    float wd0 = length((vUv - uWhiteR.xy) * vec2(aspect, 1.));
    float wd = wd0 + (fbm(vUv * 1.6 + .37) - .5) * .1 * smoothstep(.0, .3, uWhiteR.z);
    wR = smoothstep(uWhiteR.z, uWhiteR.z - abs(uWhiteR.w), wd);
    if (uWhiteR.w < 0.) {
      // (the other way about: the white parting from the point outward, like mist, the world showing through)
      wR = 1. - smoothstep(uWhiteR.z, uWhiteR.z - abs(uWhiteR.w), wd + (fbm(vUv * 2.1 + .61) - .5) * .3);
    } else {
      // light, not smoke: a warm halo runs ahead of the white edge
      float R2 = uWhiteR.z * uWhiteR.z + .002;
      halo = uWhiteCol * vec3(1., .86, .62) * (exp(-wd0 * wd0 / (R2 * 2.2)) * 1.4 + exp(-wd0 * wd0 / (R2 * 9.)) * .45) * uWhite;
    }
  }
  vec3 lit = min(col + halo, vec3(1.));
  col = mix(lit, mix(max(uWhiteCol, lit), uWhiteCol, uWhiteR.z >= 0. && uWhiteR.w > 0. ? smoothstep(1.2, 2.4, uWhiteR.z) : 1.), uWhite * wR);
  vec2 v = (vUv - .5) * vec2(aspect, 1.);
  col *= 1. - uVignette * smoothstep(.35, 1.05, length(v)) * (1. - uPaper) * (1. - uWhite);
  // the cinema bars at the key moments: black, their inner edges always the same soft few pixels, and nothing drawn over
  // them (rain, speed lines and bolts let through them, they were bars with things falling across them, and where the
  // pillar crossed one it was a grey cut-out; the glow of the brightest things let in over their edges made them hard in
  // one frame and feathered in the next)
  if (uBars.x > 0.) {
    float by = min(vUv.y, 1. - vUv.y), edge = uBars.y * uBars.x;
    float inBar = 1. - smoothstep(edge - uBars.z * 9., edge + uBars.z * 3., by);
    col = mix(col, uBarCol, inBar);
  }
  float g = texture2D(tNoise, vUv * uRes / 512. + fract(uGrainT * vec2(17.31, 9.17))).a - .5;
  col += g * uGrain * (.3 + lum(col));
  col *= 1. - uBlack;
  gl_FragColor = vec4(toSRGB(col), 1.);
}`;

export function createPost(renderer, scene, camera, mats, quality, sun) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  let W = size.x, H = size.y;
  const depthTexture = new THREE.DepthTexture(W, H);
  depthTexture.type = THREE.UnsignedIntType;
  const rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: quality.msaa, depthTexture, depthBuffer: true });
  rtScene.texture.minFilter = rtScene.texture.magFilter = THREE.LinearFilter;
  const halfOpts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const rtAO = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const rtShafts = new THREE.WebGLRenderTarget(1, 1, halfOpts);
  const levels = quality.low ? 5 : 6;
  const mips = Array.from({ length: levels }, () => new THREE.WebGLRenderTarget(1, 1, halfOpts));
  // the ink's washes: a quarter-resolution blurred copy of the scene (light + distance)
  const rtQ = new THREE.WebGLRenderTarget(1, 1, halfOpts), rtQ2 = new THREE.WebGLRenderTarget(1, 1, halfOpts);
  const rtM = new THREE.WebGLRenderTarget(1, 1, halfOpts), rtM2 = new THREE.WebGLRenderTarget(1, 1, halfOpts);
  // the painted look: a half-resolution flattened copy of the scene
  const rtPaint = new THREE.WebGLRenderTarget(1, 1, halfOpts);
  const paintMat = mat(PAINT.replace(/TOON_R/g, quality.low ? '2' : '3'), { tColor: { value: rtScene.texture }, uTexel: { value: new THREE.Vector2() }, uStride: { value: 1.5 } });
  const markMat = mat(INKMARK, { tSrc: { value: rtScene.texture }, tDepth: { value: depthTexture }, uTexel: { value: new THREE.Vector2() } });
  const prepMat = mat(INKPREP, { tSrc: { value: rtScene.texture }, tDepth: { value: depthTexture }, uTexel: { value: new THREE.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 1000 } });
  const gaussMat = mat(GAUSS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });

  const down = mat(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 }, uThreshold: { value: 0.92 }, uKnee: { value: 0.45 } });
  const up = mat(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uWeight: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
  const aoMat = mat(AO.replace('__AO__', quality.low ? '6' : '10'), {
    tDepth: { value: depthTexture }, uProjInv: { value: new THREE.Matrix4() }, uProjScale: { value: 1 }, uRadius: { value: 1.1 }, uIntensity: { value: 0.55 }, uBias: { value: 0.012 }, uAspect: { value: 1 }, uFade: { value: 90 },
  });
  const shaftMat = mat(SHAFTS.replace('__STEPS__', quality.low ? '8' : '24'), {
    tDepth: { value: depthTexture }, tShadow: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uShadowMat: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.85, 0.6) },
    uDensity: { value: 0.0 }, uSS: { value: 0 }, uSunUV: { value: new THREE.Vector3() }, uSSCol: { value: new THREE.Color() }, uMaxDist: { value: 70 }, uG: { value: 0.72 },
    tN3: { value: null }, uHasN3: { value: 0 }, uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.5, 0.2) }, uAmbCol: { value: new THREE.Color(0.2, 0.25, 0.35) },
    uAir: { value: new THREE.Vector4(0.8, 0.045, 0.6, 0) }, uMistP: { value: new THREE.Vector4(0, 2.5, 0, 30) }, uFall: { value: 0.05 }, uBase: { value: 0 }, uBias: { value: 0.0015 }, uHasShadow: { value: 0 },
  });
  const ink = {
    tColor: { value: rtScene.texture }, tDepth: { value: depthTexture }, tBloom: { value: null }, tAO: { value: rtAO.texture }, tShafts: { value: rtShafts.texture },
    tPaper: { value: mats.textures.paper }, tNoise: { value: U.uNoise.value },
    tBlur: { value: rtQ.texture }, tMark: { value: rtM.texture }, tPaint: { value: rtPaint.texture }, uBlurTexel: { value: new THREE.Vector2(1, 1) }, uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uInkDetail: { value: 0.08 }, uSkyWash: { value: 1 },
    uRes: { value: new THREE.Vector2(W, H) }, uNear: { value: camera.near }, uFar: { value: camera.far }, uDpr: { value: renderer.getPixelRatio() }, uTime: { value: 0 },
    uExposure: { value: 1 }, uBloom: { value: 0.12 }, uShafts: { value: 1 }, uAOAmt: { value: quality.low ? 0 : 0.85 },
    uSat: { value: 1 }, uContrast: { value: 1 }, uVignette: { value: 0.35 }, uGrain: { value: 0.035 }, uGrainT: { value: 0 }, uGreenWarm: { value: 0.2 }, uBars: { value: new THREE.Vector4(0, 0.12, 0.0005, 0.5) }, uBarCol: { value: new THREE.Color(0.009, 0.008, 0.007) },
    uTint: { value: new THREE.Color(1, 1, 1) }, uShadowTint: { value: new THREE.Color(1, 1, 1) }, uHighTint: { value: new THREE.Color(1, 1, 1) },
    uInk: { value: 0 }, uInkLine: { value: 1.1 }, uInkNear: { value: 25 }, uInkFar: { value: 260 }, uInkWash: { value: 1 }, uInkKey: { value: 0.5 }, uSepia: { value: 0 }, uFigSil: { value: 0 },
    uInkSpread: { value: new THREE.Vector4(0.5, 0.5, 3, 0.3) }, uSeep: { value: new THREE.Vector4(0.5, 0.5, -1, 0.3) }, uSeepFig: { value: 0 }, uHeroBox: { value: new THREE.Vector4(0, 0, -1, -1) }, uAccent: { value: new THREE.Vector4(1, 1, 1, 0) },
    uBleed: { value: -1 }, uBleedC: { value: new THREE.Vector2(0.5, 0.5) }, uDebugView: { value: 0 },
    uToon: { value: 0 }, uToonR: { value: 1 }, uToonLine: { value: 0.95 }, uToonBand: { value: 0.45 }, uToonSat: { value: 0.28 }, uToonW: { value: 1.6 },
    tCloudL: { value: null }, tCloudD: { value: null }, uCloudK: { value: 0 }, uShockR: { value: new THREE.Vector4(0.5, 0.5, 0, 0) }, uImpactF: { value: 0 },
    uPaper: { value: 0 }, uRedWash: { value: 0 }, uFlash: { value: 0 }, uFlashTint: { value: new THREE.Color(0.85, 0.85, 1) }, uBoltK: { value: new THREE.Vector2(0, 0) }, uShock: { value: 0 }, uBlack: { value: 0 }, uWhite: { value: 0 }, uWhiteR: { value: new THREE.Vector4(0.5, 0.5, -1, 0.5) }, uDesat: { value: 0 }, uWhiteCol: { value: new THREE.Color(1, 0.92, 0.7) },
  };
  ink.uPaperShow = ink.uPaper; // legacy alias
  const comp = mat(COMPOSITE, ink);
  const quad = new FullScreenQuad(null);
  const pass = (material, target) => { quad.material = material; renderer.setRenderTarget(target); quad.render(renderer); };

  const bloom = { strength: 0.12, threshold: 0.92, knee: 0.45, radius: 1.0 };
  // the air: sunlit haze with moving wisps (shadow-mapped beams), ground mist, screen-space beams; one half-res pass
  const shafts = { enabled: true, density: 0, color: new THREE.Color(1, 0.85, 0.6), fall: 0.05, maxDist: 70, screen: 0, sunDir: new THREE.Vector3(0, 1, 0),
    wisp: 0.8, wispScale: 0.04, iso: 0.1, amb: new THREE.Color(0.2, 0.25, 0.35), ambK: 0.5, mist: 0, mistH: 1.2, ground: 0, wind: new THREE.Vector2(0.6, 0.25), noise: null, shadows: true };
  const ao = { enabled: !quality.low };

  function setSize(w, h) {
    const pr = renderer.getPixelRatio();
    W = Math.max(1, Math.floor(w * pr)); H = Math.max(1, Math.floor(h * pr));
    rtScene.setSize(W, H);
    const w2 = Math.max(1, W >> 1), h2 = Math.max(1, H >> 1);
    rtAO.setSize(w2, h2);
    rtPaint.setSize(w2, h2);
    rtShafts.setSize(w2, h2);
    mips.forEach((m, i) => m.setSize(Math.max(1, W >> (i + 1)), Math.max(1, H >> (i + 1))));
    const w4 = Math.max(1, W >> 2), h4 = Math.max(1, H >> 2);
    rtQ.setSize(w4, h4); rtQ2.setSize(w4, h4); rtM.setSize(w4, h4); rtM2.setSize(w4, h4);
    ink.uBlurTexel.value.set(1 / w4, 1 / h4);
    ink.uRes.value.set(W, H);
    ink.uDpr.value = pr;
  }
  setSize(innerWidth, innerHeight);

  const projInv = new THREE.Matrix4();
  const _sp = new THREE.Vector3();
  function render(beforeScene) {
    ink.uTime.value = U.uTime.value;
    // (the grain on the lens runs on real time, even when the story's clock is slowed)
    ink.uGrainT.value = performance.now() / 1000 % 1000;
    const prevAuto = renderer.autoClear;
    renderer.autoClear = true;
    if (beforeScene) beforeScene();
    // the sun as the drifting particles see it (their shadow lookups read this frame's map: the matrix is shared)
    if (sun) {
      const smP = sun.shadow && sun.shadow.map;
      FXU.uSunDirP.value.copy(shafts.sunDir);
      FXU.uSunColP.value.copy(sun.color).multiplyScalar(sun.intensity * 0.4);
      FXU.uAmbP.value.copy(shafts.amb);
      FXU.uShadowMatP.value = sun.shadow.matrix;
      FXU.tShadowP.value = smP ? smP.texture : null;
      FXU.uHasShadowP.value = smP && shafts.shadows && sun.castShadow ? 1 : 0;
    }
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
    projInv.copy(camera.projectionMatrixInverse);
    ink.uProjInv.value.copy(projInv);
    FXU.uInkK.value = ink.uBleed.value > -0.5 ? 0 : ink.uInk.value;
    // the painted look: flatten the scene at half resolution (its footprint a few full-resolution pixels wide)
    if (ink.uToon.value > 0.001) {
      paintMat.uniforms.uTexel.value.set(1 / W, 1 / H);
      paintMat.uniforms.uStride.value = ink.uToonR.value * (quality.low ? 1.5 : 1.1);
      pass(paintMat, rtPaint);
    }
    ink.uCamWorld.value.copy(camera.matrixWorld);
    // ink washes: downsample (light + distance) and blur, only while the ink is drawn
    if (ink.uInk.value > 0.001 || ink.uDebugView.value > 2.5) {
      prepMat.uniforms.uTexel.value.set(1 / W, 1 / H);
      prepMat.uniforms.uNear.value = camera.near; prepMat.uniforms.uFar.value = camera.far;
      pass(prepMat, rtQ);
      gaussMat.uniforms.tSrc.value = rtQ.texture; gaussMat.uniforms.uDir.value.set(1 / rtQ.width, 0); pass(gaussMat, rtQ2);
      gaussMat.uniforms.tSrc.value = rtQ2.texture; gaussMat.uniforms.uDir.value.set(0, 1 / rtQ.height); pass(gaussMat, rtQ);
      // markers: blurred once (the red glow round the flames, figure and foliage masks)
      markMat.uniforms.uTexel.value.set(1 / W, 1 / H);
      pass(markMat, rtM);
      gaussMat.uniforms.tSrc.value = rtM.texture; gaussMat.uniforms.uDir.value.set(1.4 / rtM.width, 0); pass(gaussMat, rtM2);
      gaussMat.uniforms.tSrc.value = rtM2.texture; gaussMat.uniforms.uDir.value.set(0, 1.4 / rtM.height); pass(gaussMat, rtM);
      // a second, wider round: washes follow the big forms, not cobbles and tiles
      gaussMat.uniforms.tSrc.value = rtQ.texture; gaussMat.uniforms.uDir.value.set(1.1 / rtQ.width, 0); pass(gaussMat, rtQ2);
      gaussMat.uniforms.tSrc.value = rtQ2.texture; gaussMat.uniforms.uDir.value.set(0, 1.1 / rtQ.height); pass(gaussMat, rtQ);
    }
    // ambient occlusion
    if (ao.enabled && ink.uAOAmt.value > 0.01) {
      aoMat.uniforms.uProjInv.value.copy(projInv);
      aoMat.uniforms.uProjScale.value = camera.projectionMatrix.elements[5] * 0.5;
      aoMat.uniforms.uAspect.value = W / H;
      pass(aoMat, rtAO);
    } else { renderer.setRenderTarget(rtAO); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.setClearColor(0x000000, 0); }
    // sun shafts
    const sm = sun && sun.shadow && sun.shadow.map;
    if (shafts.enabled && (shafts.density > 0.0002 || shafts.screen > 0.001 || shafts.mist > 0.0005)) {
      const S = shaftMat.uniforms;
      S.uProjInv.value.copy(projInv);
      S.uCamWorld.value.copy(camera.matrixWorld);
      S.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      S.tShadow.value = sm ? sm.texture : null;
      S.uHasShadow.value = sm && shafts.shadows ? 1 : 0;
      S.tN3.value = shafts.noise; S.uHasN3.value = shafts.noise ? 1 : 0;
      S.uTime.value = U.uTime.value; S.uWind.value.copy(shafts.wind);
      S.uAmbCol.value.copy(shafts.amb);
      S.uAir.value.set(shafts.wisp, shafts.wispScale, shafts.ambK, shafts.iso);
      S.uMistP.value.set(shafts.mist, shafts.mistH, shafts.ground, 0);
      S.uShadowMat.value.copy(sun.shadow.matrix);
      S.uDensity.value = shafts.density;
      S.uSunDir.value.copy(shafts.sunDir);
      S.uSS.value = shafts.screen;
      _sp.copy(shafts.sunDir).multiplyScalar(1000).add(S.uCamPos.value).applyMatrix4(camera.matrixWorldInverse);
      const behind = _sp.z > 0;
      _sp.applyMatrix4(camera.projectionMatrix);
      S.uSunUV.value.set(_sp.x * 0.5 + 0.5, _sp.y * 0.5 + 0.5, behind ? 0 : 1);
      S.uFall.value = shafts.fall;
      S.uMaxDist.value = shafts.maxDist;
      S.uSunCol.value.copy(shafts.color);
      S.uSSCol.value.copy(shafts.ssColor || shafts.color);
      pass(shaftMat, rtShafts);
      ink.uShafts.value = 1;
    } else ink.uShafts.value = 0;
    // bloom
    renderer.autoClear = true;
    down.uniforms.uThreshold.value = bloom.threshold;
    down.uniforms.uKnee.value = bloom.knee;
    let src = rtScene.texture, sw = W, sh = H;
    mips.forEach((m, i) => {
      down.uniforms.tSrc.value = src;
      down.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      down.uniforms.uFirst.value = i === 0 ? 1 : 0;
      pass(down, m);
      src = m.texture; sw = m.width; sh = m.height;
    });
    renderer.autoClear = false;
    for (let i = mips.length - 1; i > 0; i--) {
      up.uniforms.tSrc.value = mips[i].texture;
      up.uniforms.uTexel.value.set(1 / mips[i].width, 1 / mips[i].height);
      up.uniforms.uRadius.value = bloom.radius;
      up.uniforms.uWeight.value = 1;
      pass(up, mips[i - 1]);
    }
    renderer.autoClear = true;
    ink.tBloom.value = mips[0].texture;
    ink.uBloom.value = bloom.strength / levels * 0.55;
    ink.uNear.value = camera.near; ink.uFar.value = camera.far;
    ink.uExposure.value = renderer.toneMappingExposure;
    pass(comp, null);
    renderer.autoClear = prevAuto;
  }

  return { ink, bloom, shafts, ao, setSize, render, depthTexture, target: rtScene };
}
