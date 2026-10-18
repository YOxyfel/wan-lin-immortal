// Sky: a raymarched cloud deck (3D Perlin-Worley noise generated on the GPU) rendered at reduced resolution and
// blitted behind the world, plus a cheap direction-only sky used to light the scene through a PMREM environment.
// Also: karst towers, ink-wash ranges and valley mist.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { U } from './materials.js';
import { rng, fbm, smooth as smoothstep } from './util.js';
import { heightAt } from './layout.js';
import { puppetTexture } from './puppets.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

// ------------------------------------------------------------------ tileable 3D noise, one slice per draw
const NOISE3D = `precision highp float; uniform float uZ, uKind; varying vec2 vUv;
vec3 h3(vec3 p){ p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453123); }
float worley(vec3 p, float per){
  vec3 id = floor(p), f = fract(p); float md = 9.;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 r = o + h3(mod(id + o, per)) - f; md = min(md, dot(r, r));
  }
  return clamp(1. - sqrt(md), 0., 1.);
}
float grad(vec3 i, vec3 f, vec3 o, float per){ return dot(h3(mod(i + o, per)) * 2. - 1., f - o); }
float perlin(vec3 p, float per){
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  return mix(mix(mix(grad(i, f, vec3(0., 0., 0.), per), grad(i, f, vec3(1., 0., 0.), per), u.x), mix(grad(i, f, vec3(0., 1., 0.), per), grad(i, f, vec3(1., 1., 0.), per), u.x), u.y),
             mix(mix(grad(i, f, vec3(0., 0., 1.), per), grad(i, f, vec3(1., 0., 1.), per), u.x), mix(grad(i, f, vec3(0., 1., 1.), per), grad(i, f, vec3(1., 1., 1.), per), u.x), u.y), u.z);
}
float remap(float v, float a, float b, float c, float d){ return c + (v - a) / (b - a) * (d - c); }
void main(){
  vec3 p = vec3(vUv, uZ);
  if (uKind < .5) {
    float pf = 0., a = .5, n = 0., per = 4.;
    vec3 q = p * 4.;
    for (int i = 0; i < 5; i++) { pf += perlin(q, per) * a; n += a; q *= 2.; per *= 2.; a *= .5; }
    pf = clamp(pf / n * 1.15 + .5, 0., 1.);
    float w4 = worley(p * 4., 4.), w8 = worley(p * 8., 8.), w16 = worley(p * 16., 16.), w32 = worley(p * 32., 32.);
    float wf = w4 * .625 + w8 * .25 + w16 * .125;
    float pw = clamp(remap(pf, wf - 1., 1., 0., 1.), 0., 1.);
    gl_FragColor = vec4(pw, w8 * .625 + w16 * .25 + w32 * .125, w16 * .75 + w32 * .25, w32);
  } else {
    float w2 = worley(p * 2., 2.), w4 = worley(p * 4., 4.), w8 = worley(p * 8., 8.), w16 = worley(p * 16., 16.);
    gl_FragColor = vec4(w2 * .625 + w4 * .25 + w8 * .125, w4 * .625 + w8 * .25 + w16 * .125, w8 * .75 + w16 * .25, 1.);
  }
}`;

function noise3D(renderer, size, kind) {
  const rt = new THREE.WebGL3DRenderTarget(size, size, size, { depthBuffer: false });
  const t = rt.texture;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: NOISE3D, uniforms: { uZ: { value: 0 }, uKind: { value: kind } }, depthTest: false, depthWrite: false });
  const quad = new FullScreenQuad(m);
  const prev = renderer.getRenderTarget();
  for (let z = 0; z < size; z++) {
    m.uniforms.uZ.value = (z + 0.5) / size;
    renderer.setRenderTarget(rt, z);
    quad.render(renderer);
  }
  renderer.setRenderTarget(prev);
  quad.dispose(); m.dispose();
  return { texture: t, rt };
}

// ------------------------------------------------------------------ the sea of clouds' heads, baked once
// Round heads at four sizes (each the highest sphere cap over the point among the cells round about), stacked so the
// small ones sit on the big ones: the cauliflower of a cumulus top. Tileable over SEA_P metres.
// r: height (m), g: how high on its heads the point is (the hollows between them lie in their own shade)
const SEA_P = 6400;
const SEAGEN = `precision highp float; varying vec2 vUv;
vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float h1(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float lobes(vec2 x, float C, float N, float seed){
  vec2 c0 = floor(x / C); float sum = 1., k = 3.2 / C;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 nc = c0 + vec2(float(i), float(j));
    vec2 id = mod(nc, N);
    vec2 r2 = h2(id + seed);
    vec2 ctr = (nc + .15 + .7 * r2) * C;
    float R = C * (.55 + .4 * h1(id + seed * 1.7));
    vec2 dv = x - ctr; float q = dot(dv, dv) / (R * R);
    // (a round head, each its own height, its flanks never steeper than a heightfield can hold: seen from just above
    // the sea no head's side smears into a curtain; the heads run into each other in soft folds, not creases, so the
    // texture's own grid never shows along them)
    if (q < 1.) sum += exp(k * R * (1. + .45 * h1(id + seed * 3.1)) * (1. - q) * (1. + .3 * q));
  }
  return log(sum) / k;
}
void main(){
  vec2 x = vUv * ${SEA_P}.;
  float a = lobes(x, 400., 16., 1.), b = lobes(x, 160., 40., 7.), c = lobes(x, 64., 100., 13.), d = lobes(x, 25.6, 250., 19.);
  float H = a + b * .8 + c * .6 + d * .4;
  float ao = clamp(a / 470. * .55 + b / 190. * .25 + c / 76. * .12 + d / 30. * .08, 0., 1.);
  gl_FragColor = vec4(H, ao, 0., 1.);
}`;
function bakeSea(renderer, size) {
  const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping;
  const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: SEAGEN, depthTest: false, depthWrite: false });
  const quad = new FullScreenQuad(m);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  quad.render(renderer);
  renderer.setRenderTarget(prev);
  quad.dispose(); m.dispose();
  return rt;
}

// ------------------------------------------------------------------ shared sky colour (no clouds)
export const SKYCOL = `
vec3 skyColor(vec3 rd){
  float h = rd.y, hp = max(h, 0.);
  // deep at the zenith, paling toward the horizon, with a thin bright haze band right on it
  vec3 sky = mix(uHorizon, uZenith, 1. - exp(-hp * 4.2));
  sky = mix(sky, uHorizon * 1.12, exp(-hp * 30.) * .3);
  sky = mix(sky, uGround, smoothstep(.0, -.2, h));
  float sd = max(dot(rd, uSunDir), 0.);
  sky += uSunCol * (pow(sd, 5.) * .32 * (1. - smoothstep(0., .45, h)) + pow(sd, 60.) * .7 + pow(sd, 700.) * 2.5) * uSunVis;
  vec3 fh = normalize(vec3(rd.x, 0., rd.z) + 1e-5);
  float fd = max(dot(fh, uFireDir), 0.);
  sky += uFireCol * uFireGlow * pow(fd, 3.) * (1. - smoothstep(-.02, .25, h)) * .8;
  sky += uMoonCol * pow(max(dot(rd, uMoonDir), 0.), 600.) * 3.;
  return sky;
}`;
export const SKY_UNIFORMS = `uniform vec3 uSunDir, uSunCol, uZenith, uHorizon, uGround, uCloudLit, uCloudShade, uFireDir, uFireCol, uMoonDir, uMoonCol;
uniform float uSunVis, uFireGlow;`;

// ------------------------------------------------------------------ the cloud deck
const CLOUDS = `precision highp float; precision highp sampler3D;
uniform sampler3D tShape, tDetail;
uniform mat4 uProjInv, uCamWorld; uniform vec3 uCamPos;
${SKY_UNIFORMS}
uniform float uCover, uStorm, uStormGrow, uTime, uDensity, uFlash, uClash, uStarK, uDebug, uSharp;
uniform vec3 uStormC, uFireC, uFlashPos, uFlashCol, uC1, uC2, uStarPos, uStarTail; uniform vec2 uWind; uniform vec3 uT1[4], uT2[4]; uniform vec4 uImpact;
// the eye torn in the deck over the fight (xyz: centre, w: how open); the two fighters' own amounts (gold, violet); where the
// star came down (xyz) and how long ago (w, 0..1 over the flash and the ring, -1 none); the dark that runs out from it
// (xy: origin, z: radius of the front, w: amount)
uniform vec4 uEye, uHit, uDark; uniform vec2 uClashGV; uniform vec3 uHitCol;
// blasts punched into the cloud tops by the fight (xyz: where, w: how long ago 0..1, -1 none); the distance to what the
// eye is following (the fight), for the transmittance up to it; the ground drawn far below when the eye is up among
// the clouds; how far the fair-weather layer has thickened into a floor of cloud
uniform vec4 uCrater[3]; uniform float uCraterS[3]; uniform vec4 uTrench[2]; uniform vec2 uTrenchK[2]; uniform float uFocus, uGroundK, uSeaK, uDive;
// the sheets of cloud across the well that the launch bursts up through (x: how much, yzw: their heights) and their
// thicknesses (xyz, metres); the well itself while the eye climbs it (x: how ragged its walls are, 1 as they are)
uniform vec4 uBands, uBandT, uWell;
uniform sampler2D tSea;
// the war's shadow play on the first sheet (puppets.js): the stage (xy: its centre, z: the figures' height in metres,
// w: how much), its axes (xy: right, zw: up, both across the ground), each figure (xy: where its feet are in the
// stage's units, z: its lean, w: its arm's angle; 0 gold, 1 the masked one), and the flare where their weapons meet
// (xy, z: how bright)
uniform sampler2D tPuppet; uniform vec4 uStage, uStageR, uPup0, uPup1, uPupFx;
// the charge gathering in the cloud (xyz, w: how bright), and the great bolt's channel lighting it from within
// (A: its top and how bright, B: where its leader has come to)
uniform vec4 uCharge, uChanA, uChanB, uHole, uArena;
// the gathering the fight stirs up (xy: the eye under it, z: how far the cloud has wound round it, w: how far the deck
// has formed out from it, 1 = everywhere); the light of the fight pouring down the eye (rgb, w: how bright)
uniform vec4 uVort, uBeam;
// (how far the fight's steady light carries through the cloud: all the way over the sea, less in the forming deck,
// where its light is in the eye and in each blow)
uniform float uClashFar;
varying vec2 vUv;
// (two more targets: the cloud alone in front of the world, and where it begins and how clear the way to the focus is)
layout(location = 1) out highp vec4 pc_fragData1;
layout(location = 2) out highp vec4 pc_fragData2;
#define STEPS __STEPS__
#define LSTEPS __LSTEPS__
#define SEASTEPS __SEASTEPS__
#define SHSTEPS __SHSTEPS__
${SKYCOL}
float remap(float v, float a, float b, float c, float d){ return c + (v - a) / (b - a) * (d - c); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
float hg(float mu, float g){ float g2 = g * g; return (1. - g2) / pow(1. + g2 - 2. * g * mu, 1.5); }
// one puppet at stage point st: its silhouette (x), what is cut out of it and glows (y), its blurred shape (z, for its
// aura); its body in atlas column bx, its arm (jointed at sh) in the rows starting at av
vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec3 puppet(vec2 st, vec4 P, float bx, vec2 sh, float av){
  vec2 q = rot2(st - P.xy, -P.z);
  vec3 o = vec3(0.);
  // (the aura is read from the blurred atlas, fading out toward the edge of the figure's own part of it, so no edge
  // of the part shows)
  if (q.x > -.5 && q.x < .5 && q.y > 0. && q.y < 1.) {
    vec2 uv = vec2(bx + (q.x + .5) * .25, q.y);
    vec2 a = texture(tPuppet, uv).rg;
    float e = smoothstep(0., .07, min(min(q.x + .5, .5 - q.x), min(q.y, 1. - q.y)));
    o = vec3(a, textureLod(tPuppet, uv, 4.6).r * e);
  }
  vec2 qa = rot2(q - sh, -P.w);
  if (abs(qa.x) < .6 && abs(qa.y) < .6) {
    vec2 uv = vec2(.5 + (qa.x + .6) / 1.2 * .25, av + (qa.y + .6) / 1.2 * .5);
    vec2 a = texture(tPuppet, uv).rg;
    float e = smoothstep(0., .07, .6 - max(abs(qa.x), abs(qa.y)));
    o = max(o, vec3(a, textureLod(tPuppet, uv, 4.6).r * e));
  }
  return o;
}
// The storm is a front sweeping in from far beyond the north-western ridges (O), its upper half leaning out ahead
// of the base like an anvil; uStormGrow moves the front (0.3: some 3.5 km out from the forest edge, 0.7: overhead).
vec2 stormO(){ vec2 dir = normalize(uStormC.xz - vec2(0., -150.)); return uStormC.xz + dir * 6500.; }
float stormAt(vec2 xz, float h){
  float R = uStormGrow * 13000.;
  float n = texture(tShape, vec3(xz * .00006, .3)).r;
  float d = length(xz - stormO()) + (n - .5) * 2200. - clamp(h, 0., 1.) * 1500.;
  return uStorm * smoothstep(R, R - 1900., d);
}
// a Worley value (1 - distance to the nearest point, in cells) turned into a round head (a dome, not a cone)
float dome(float w, float k){ float d = clamp((1. - w) * k, 0., 1.); return sqrt(1. - d * d); }
// The sea of clouds: long swells, the baked heads on them, and here and there a tower of cumulus standing up out of
// it, its own head the same heads made big (height of the top, in metres; ao: how high on its heads)
// the gap in the sea the eye goes up through, out of the pines into the light: a ragged well with walls of cloud
// (uHole: xy its centre, z how open it is: it closes again once the eye is through; w: how much wider than a well,
// the eye of the gathering)
float holeS(){ return uHole.z * (1. + uHole.w); }
float seaHoleDk(vec2 xz, float k){
  float d = length(xz - uHole.xy);
  if (d > 900. * (1. + uHole.w)) return d;
  float n = texture(tShape, vec3(xz * .0011 + .2, .45)).r, n2 = texture(tShape, vec3(xz * .0037 + .7, .15)).g;
  return d + ((n - .5) * 260. + (n2 - .5) * 90.) * holeS() * k;
}
float seaHoleD(vec2 xz){ return seaHoleDk(xz, 1.); }
float seaHole(vec2 xz){ return uHole.z < .01 ? 1. : smoothstep(320. * holeS(), 470. * holeS(), seaHoleD(xz)); }
// (inside the well its walls bulge and billow with the height, not drawn straight down; the eye of the gathering
// opens wider as it goes up, a funnel)
float seaHole3(vec3 p){
  if (uHole.z < .01 || length(p.xz - uHole.xy) > 900. * (1. + uHole.w)) return 1.;
  float n3 = texture(tShape, p * vec3(.0034, .0026, .0034) + vec3(.31, .17, .53)).r;
  float n4 = texture(tDetail, p * .0095 + vec3(.2, .6, .1)).g;
  float wid = 1. + .32 * uHole.w * smoothstep(1100., 2600., p.y);
  // (while the eye climbs it, the well's walls above its ragged mouth are calmer and sheer: billows, not crags or
  // slopes)
  float hk = smoothstep(640., 820., p.y);
  float kw = mix(1., uWell.x, hk), outer = mix(470., 360., uWell.y * hk);
  return smoothstep(320. * holeS() * wid, outer * holeS() * wid, seaHoleDk(p.xz, kw) + ((n3 - .5) * 230. + (n4 - .5) * 70.) * holeS() * kw);
}
// the gathering: what the fight stirs up winds round the eye under it, fastest close to it, so the cloud is drawn
// out into arms (the noise is read from where it was before it was wound)
vec2 vortex(vec2 xz){
  if (uVort.z == 0.) return xz;
  vec2 r = xz - uVort.xy;
  float d = length(r);
  float a = uVort.z * 1100. / (d + 1100.) * (1. - smoothstep(6000., 15000., d));
  float c = cos(a), s = sin(a);
  return uVort.xy + mat2(c, s, -s, c) * r;
}
// how far the deck has formed out from the eye: its edge ragged, wound into arms with the rest
float formed(vec2 pv, vec2 xz){
  if (uVort.w >= .999) return 1.;
  vec2 r = xz - uVort.xy;
  float d = length(r);
  float R = uVort.w * uVort.w * 15000. + 60000. * smoothstep(.85, 1., uVort.w);
  float n = texture(tShape, vec3(pv * .00031 + .41, .62)).r;
  float f = smoothstep(R + 500., R - 700., d + (n - .5) * 2400.);
  // (wound into three arms with sky between them, turning as it winds; the gaps fill as the deck thickens)
  float arm = .5 + .5 * sin(3. * atan(r.y, r.x + 1e-3) - 2.6 * log(max(d, 200.) / 600.) + uVort.z * 1.6);
  float gap = (1. - smoothstep(.5, .9, uVort.w)) * smoothstep(300., 900., d);
  return f * mix(1., smoothstep(.22, .62, arm + (n - .5) * .7), gap);
}
// (the war's arena, war.js: no great tower of cloud rises within it, so the two fight over open sea and the lens can
// go low over it anywhere there; set by each caller for the point it asks about)
float gArena = 1.;
float arenaAt(vec2 xz){ return 1. - uArena.w * (1. - smoothstep(uArena.z * .55, uArena.z, length(xz - uArena.xy))); }
float seaAt(vec2 xz, out float ao){
  vec2 w = xz + vec2(6., 2.) * uTime;
  float sw = texture(tShape, vec3(w * .000045 + .17, .13)).r;
  float tc = texture(tDetail, vec3(w * .00009 + .5, .27)).r;
  vec2 lb = texture(tSea, w / ${SEA_P}.).rg;
  // (the towers' flanks are heads too: their edge scalloped by them)
  // (the heads' relief a cloud sea's, rolling: a heightfield cannot hold the cliffs of a mountain range without
  // smearing them; the towers' flanks as steep as it can hold)
  float tw = smoothstep(.6, .86, tc + (lb.g - .5) * .06) * gArena;
  float top = 2040. + 340. * (sw - .5) + lb.r * .62;
  ao = lb.g;
  if (tw > 0.) {
    // (a great head of cumulus: the same heads made four times bigger, swelling up out of the sea)
    vec2 lt = texture(tSea, w / ${(SEA_P * 4.1).toFixed(1)} + .37).rg;
    float tw2 = tw * tw * (3. - 2. * tw);
    top += tw2 * (430. + lt.r * .75);
    ao = mix(ao, max(ao, lt.g), tw2);
  }
  return top;
}
float seaTop(vec2 xz, bool fine){ float a; return seaAt(xz, a); }
// (how deep under the top of the sea the last sample was: for the light that reaches into the hollows)
float gDepth = 0.;
// (and, for the light from below: how thick the formed deck is over the last sample, metres, 0 where there is none)
float gSeaThick = 0.;
bool gNoSea = false;
// (and how much of the last sample's cloud is one of the launch's sheets, which one, and how far up through it)
float gSheetW = 0., gSheetLit = 1., gSheetK = 0., gSheetN = .5;
float density(vec3 p, float sk, bool detail, out float hf){
  gSheetW = 0.;
  // storm cells and the storm's ragged base: scud hanging low under the deck in places, torn by the wind
  vec4 cn = vec4(0.);
  if (sk > .003) cn = texture(tShape, vec3(p.xz * .00011 + .3 + uWind * uTime * .35, .7));
  float scud = smoothstep(.42, .82, cn.b) * (.6 + .4 * cn.a);
  // (where the great bolt came down, the blast has torn the low scud away)
  if (uHit.w >= 0.) scud *= smoothstep(450., 1250., length(p.xz - uHit.xz));
  float base = mix(mix(1150., 950., uSharp), 620. - 430. * scud, sk), top = mix(mix(2650., 2300., uSharp) + 420. * uSeaK, 4700., sk);
  hf = (p.y - base) / (top - base);
  // (where this cloud was before the gathering wound it round the eye)
  vec2 pv = vortex(p.xz);
  // the sea of clouds: dense under its billowed top, down to its base
  float cSea = 0.;
  gDepth = 1e4;
  gSeaThick = 0.;
  if (uSeaK > 0. && !gNoSea && sk < .995 && p.y > 600. && p.y < 4000.) {
    gArena = arenaAt(p.xz);
    float tS = mix(980., seaTop(pv, detail), seaHole3(p));
    gDepth = tS - p.y;
    // (its underside uneven, its inside torn into wisps and denser veils: something to fly through)
    float bY = 1120. + 260. * (texture(tShape, vec3(pv * .00035 + .6, .25)).g - .5);
    float wsp = .5 + .5 * smoothstep(.3, .68, texture(tShape, vec3(pv.x, p.y, pv.y) * vec3(.0021, .0034, .0021) + vec3(.13, .4, .71)).r);
    cSea = smoothstep(tS + 12., tS - 70., p.y) * smoothstep(bY - 60., bY + 170., p.y) * uSeaK * (1. - sk) * mix(1., wsp, smoothstep(60., 170., gDepth));
    float fk = formed(pv, p.xz);
    cSea *= fk;
    // (the sun's way up through the deck from here: through all of it from under its base)
    gSeaThick = max(tS - max(p.y, bY + 60.), 0.) * fk * uSeaK * (1. - sk);
  }
  if ((hf <= 0. || hf >= 1.) && cSea <= 0.) return 0.;
  float hfr = hf;
  hf = clamp(hf, 0., 1.);
  vec2 rel = pv - uStormC.xz;
  float sw = sk * (uTime * .012 + 2.2 * (1. - clamp(length(rel) / 9000., 0., 1.)));
  rel = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * rel;
  vec3 q = vec3(rel.x, p.y, rel.y) * mix(.00024, .00036, uSharp) + vec3(uWind.x, 0., uWind.y) * uTime;
  vec4 s = texture(tShape, q);
  float wf = s.g * .625 + s.b * .25 + s.a * .125;
  float n = s.r * .78 + wf * .22;
  // fair-weather cloud thins out ahead of the storm (so the front reads behind it)
  float cov = mix(mix(uCover * (1. - uStorm * .75), .56, uSeaK), .985, sk);
  // (inside the storm it is whole: no holes to see the ground through until under its base)
  float thr = mix(mix(.75, .47, cov), mix(.43, .3, smoothstep(.04, .16, hf) * (1. - smoothstep(.6, .8, hf))), sk);
  // fair-weather cumulus have crisp, cauliflower edges; the storm deck is soft and total
  float sharp = uSharp * (1. - sk);
  thr += sharp * .07;
  float c = clamp((n - thr) / mix(.86 - thr, .075, sharp), 0., 1.);
  c *= smoothstep(0., mix(.1, .05, sharp), hf) * smoothstep(1., mix(mix(.4, .93, sk), .25, sharp), hf + (1. - c) * mix(.25, .05, sk));
  // storm cells: towers of different heights under a spreading anvil
  float cell = cn.g;
  float towerTop = mix(.42, 1., smoothstep(.35, .7, cell));
  float anvil = smoothstep(.76, .86, hf) * (1. - smoothstep(.95, 1., hf));
  c *= mix(1., max(smoothstep(towerTop, towerTop - .14, hf), anvil * .85), sk * sk);
  // (outside the fair-weather layer it has no cloud of its own; over the sea drawn as a surface, only the storm)
  if (hfr <= 0. || hfr >= 1.) c = 0.;
  if (gNoSea) c *= smoothstep(.0, .3, sk);
  // (the eye of the gathering is clear all the way up)
  if (uVort.z > 0. && c > 0.) c *= seaHole3(p);
  // the sea of clouds under it all
  c = max(c, cSea);
  // the sheets across the well: thin and dense (far denser than the rest, so bursting up through one the eye is lost in
  // it for a moment). The first is whole, a screen glowing with the light above it (the fight's shadows play on it);
  // the next two are torn here and there, so the light above shows through before the eye is in them.
  float shD = 0.;
  gSheetW = 0.; gSheetLit = 1.; gSheetK = 0.;
  if (uBands.x > 0. && uHole.z > .01) {
    float inW = 1. - seaHole3(p);
    if (inW > .01) {
      float torn = smoothstep(.32, .62, texture(tShape, vec3(pv * .0013 + .37, .81)).r * .7 + n * .45);
      for (int k = 0; k < 3; k++) {
        float hy = k == 0 ? uBands.y : (k == 1 ? uBands.z : uBands.w);
        float th = (k == 0 ? uBandT.x : (k == 1 ? uBandT.y : uBandT.z)) * (.75 + .5 * n);
        float yy = p.y - hy + (n - .5) * 60.;
        // (the first denser: a whole screen, nothing of what is above showing through it)
        float dk = smoothstep(th * .5, th * .12, abs(yy)) * (k == 0 ? 2. : mix(.18, 1., torn));
        if (dk > shD) {
          shD = dk;
          gSheetK = float(k);
          gSheetLit = clamp(yy / th + .5, 0., 1.);
          gSheetN = texture(tShape, vec3(pv * .0045 + .21, .63)).r * .4 + texture(tDetail, vec3(pv * .016 + .4, .37)).g * .35 + texture(tDetail, vec3(pv * .05 + .7, .61)).r * .25;
        }
      }
      shD *= uBands.x * inW * 10.;
    }
  }
  // blasts from the fight punch round holes into the cloud tops and throw the cloud outward
  for (int k = 0; k < 3; k++) {
    vec4 cr = uCrater[k];
    if (cr.w >= 0. && cr.w < 1.) {
      vec3 dc = p - cr.xyz; dc.y *= 1.5;
      float R = mix(60., 760., sqrt(cr.w)) * uCraterS[k];
      float dd = length(dc) + (n - .5) * 180.;
      c *= 1. - smoothstep(R, R * .55, dd) * (1. - cr.w * cr.w);
    }
  }
  // the eye over the fight: a funnel torn through the deck, ragged, wider as it goes up
  if (uEye.w > 0.) {
    float hr = mix(1250., 1750., clamp((p.y - 600.) / 2600., 0., 1.));
    float de = length(p.xz - uEye.xz) + (n - .5) * 700.;
    c *= 1. - uEye.w * (1. - smoothstep(hr * .6, hr, de));
  }
  // (the storm's heart is dense: little is seen far inside it)
  float skD = mix(1.6, 2.4, smoothstep(.06, .2, hf) * (1. - smoothstep(.55, .8, hf)));
  // (diving through it, it is whole: dense billows all the way down, the ground lost until under its base)
  float dv = uDive * sk * smoothstep(.012, .05, hf) * (1. - smoothstep(.72, .86, hf));
  if (dv > 0.) c = max(c, dv * (.1 + .38 * smoothstep(.28, .62, n)));
  if (c <= 0. || !detail) { float cf = c * mix(1., skD, sk); gSheetW = shD / max(shD + cf, 1e-4); return max(cf, shD); }
  vec4 d = texture(tDetail, q * 4.7 + vec3(uTime * .0011, 0., 0.));
  float df = d.r * .625 + d.g * .25 + d.b * .125;
  df = mix(df, 1. - df, clamp(hf * 3.5, 0., 1.));
  c = clamp(c - (1. - c) * df * mix(mix(.6, .9, sharp), 1.1, sk) * (1. - .5 * dv), 0., 1.);
  float cf = c * mix(1., skD, sk) * mix(1., 1.5, sharp);
  gSheetW = shD / max(shD + cf, 1e-4);
  return max(cf, shD);
}
// The sea's top as a surface (when the eye is above it): the same heads and towers, the blasts of the fight
// punched into it (a bowl with its rim thrown up, filling back in), sinking away under the storm.
// ao: how high on its heads a point is (the hollows between them are in their own shade)
float seaSurf(vec2 xz, out float ao){
  // (the well: a smooth fall from its rim, its heads only on the rim, never drawn down its walls)
  float hk = seaHole(xz);
  gArena = arenaAt(xz);
  float top = seaAt(vortex(xz), ao);
  top = mix(mix(980., 2280., hk), top, smoothstep(.82, 1., hk));
  for (int k = 0; k < 3; k++) {
    vec4 cr = uCrater[k];
    if (cr.w >= 0. && cr.w < 1.) {
      float cs = uCraterS[k];
      float R = mix(90., 700., sqrt(cr.w)) * cs, dd = length(xz - cr.xz) / R + (ao - .5) * .2;
      float fill = 1. - cr.w * cr.w;
      top -= 430. * sqrt(cs) * fill * (1. - smoothstep(.25, 1., dd));
      top += 110. * cs * (1. - cr.w) * exp(-pow((dd - 1.) / .2, 2.));
      ao *= 1. - .5 * fill * (1. - smoothstep(.3, 1., dd));
    }
  }
  // the trenches cut into it by the halves of the crescent (war.js): run out along their line, the cloud thrown up
  // along their lips, filling back in
  for (int k = 0; k < 2; k++) {
    vec2 tk = uTrenchK[k];
    if (tk.x <= 0. || tk.y >= 1.) continue;
    vec4 T = uTrench[k];
    vec2 a = T.xy, ab = T.zw - T.xy;
    float h = clamp(dot(xz - a, ab) / dot(ab, ab), 0., 1.);
    float dl = length(xz - a - ab * h) + (ao - .5) * 26.;
    float head = smoothstep(tk.x * 1.04, tk.x * 1.04 - .05, h), w = mix(34., 85., h), fill = 1. - tk.y * tk.y;
    top -= 320. * fill * head * (1. - smoothstep(w * .45, w, dl));
    top += 50. * fill * head * exp(-pow((dl - w) / (w * .32), 2.));
    ao *= 1. - .45 * fill * head * (1. - smoothstep(w * .5, w, dl));
  }
  return top;
}
float seaH(vec2 xz){ float a; return seaSurf(xz, a); }
// its colour: warm sun on the heads with a soft edge to the shade, the blue of the sky in the shade (deeper down in
// the hollows), a warm band where the light goes over the edge, a silver rim against the light, and the light of the
// fight on it
vec3 seaShade(vec3 hp, vec3 rd, float tS, float ao){
  // (the light spreads inside a cloud: its shading follows the big forms, so the normal is taken wide)
  float e = 24. + tS * .004;
  vec3 n = normalize(vec3(seaH(hp.xz - vec2(e, 0.)) - seaH(hp.xz + vec2(e, 0.)), 2. * e, seaH(hp.xz - vec2(0., e)) - seaH(hp.xz + vec2(0., e))));
  // (close to, the heads break up into smaller billows: their shading lumpy; and down the steep side of a tower the
  // shading is the billows of its own wall, in three dimensions, never the heads' shade drawn down it in streaks)
  float kc = 1. - smoothstep(350., 1800., tS);
  float steep = 1. - smoothstep(.35, .75, n.y);
  float lump = .5, dk = max(kc, steep);
  if (dk > 0.) {
    vec3 d1 = texture(tDetail, hp * .011 + vec3(.13, .37, .71)).rgb - .5;
    vec3 d2 = texture(tDetail, hp * .033 + vec3(.53, .11, .29)).rgb - .5;
    n = normalize(n + (d1 * .6 + d2 * .28) * kc * vec3(1., .35, 1.) + (d1 * 1.1 + d2 * .5) * steep * (1. - .5 * kc));
    lump = .5 + (d1.r + d2.g * .5) * .7 * dk;
    ao = mix(ao, clamp(.62 + d1.g * 1.2 + d2.b * .6, 0., 1.), steep * .85);
  }
  // the sun's way through the cloud from here: how deep under the top it runs, and how far (soft, as in cloud: the
  // thin parts let the light through, the deep ones shade)
  float od = 0.;
  for (int j = 0; j < SHSTEPS; j++) {
    float dj = 16. * pow(2.25, float(j));
    vec3 q = hp + uSunDir * dj + n * 3.;
    od += max(seaH(q.xz) - q.y, 0.) * dj * .45;
  }
  float sh = mix(exp(-od * .00011), 1., .06);
  float ndl = dot(n, uSunDir);
  float lit = smoothstep(-.45, .8, ndl) * sh * uSunVis;
  vec3 sunL = uCloudLit * mix(vec3(1.), uSunCol * 1.15, .55);
  vec3 skyL = uZenith * .95 + uHorizon * .18;
  skyL = mix(skyL, vec3(dot(skyL, vec3(.2126, .7152, .0722))), .5);
  float occ = mix(.45, 1., ao) * mix(1., .85 + .3 * lump, dk);
  // sun on the heads; in the shade the sky's blue, and the light that has gone into the cloud and come out again
  // (a cloud is bright all through: its shade is pale)
  vec3 col = sunL * lit * 2.1 + (skyL * (.55 + .45 * n.y) * 1.15 + sunL * (.3 + .32 * sh) * uSunVis) * occ;
  // a warm band where the light goes over the edge into the shade
  col += sunL * .32 * exp(-pow(ndl / .26, 2.)) * sh * uSunVis * occ;
  // the silver rim: edges seen against the light glow
  float fres = pow(clamp(1. - dot(n, -rd), 0., 1.), 3.);
  col += sunL * fres * (.18 + 1.8 * pow(max(dot(rd, uSunDir), 0.), 3.)) * mix(.35, 1., sh) * uSunVis * .7;
  if (uClash > 0.) {
    vec3 g = vec3(1., .66, .22), v = vec3(.62, .26, 1.);
    vec3 l1 = uC1 - hp, l2 = uC2 - hp; float r1 = length(l1), r2 = length(l2);
    float f1 = (exp(-r1 / 420.) * 1.3 + exp(-r1 * r1 / (160. * 160.)) * 5.) * (.35 + .65 * max(dot(n, l1 / r1), 0.));
    float f2 = (exp(-r2 / 420.) * 1.6 + exp(-r2 * r2 / (160. * 160.)) * 6.) * (.35 + .65 * max(dot(n, l2 / r2), 0.));
    col += (g * f1 * uClashGV.x + v * f2 * uClashGV.y) * uClash;
    float ia = uImpact.w;
    if (ia >= 0. && ia < 1.) {
      vec3 dI = hp - uImpact.xyz; float rI = length(dI.xz), ring = mix(60., 2400., sqrt(ia));
      float eR = exp(-pow((rI - ring) / mix(40., 260., ia), 2.)) * (1. - ia) * (1. - ia);
      col += mix(vec3(1., .85, .6), vec3(.75, .55, 1.), .45) * uClash * (eR * 3. + exp(-dot(dI, dI) / (480. * 480.)) * exp(-ia * 3.) * 9.);
    }
  }
  return col;
}
vec3 glowAt(vec3 p, vec3 c, vec3 col, float r){ vec3 d = p - c; float q = dot(d, d) / (r * r); return col * (exp(-q) * 1.6 + .25 / (1. + q * 6.)); }
float segDist(vec3 p, vec3 a, vec3 b){ vec3 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-3), 0., 1.); return length(p - a - ab * t); }
// distance from a view ray to a segment (sampled: cheap and good enough for glows)
float rayDist(vec3 ro, vec3 rd, vec3 a, vec3 b){
  vec3 ab = b - a; float best = 1e9;
  for (int i = 0; i < 4; i++) { vec3 q = a + ab * (float(i) / 3.); vec3 v = q - ro; float t = max(dot(v, rd), 0.); best = min(best, length(v - rd * t)); }
  return best;
}
// The immortal mountains: far spires standing up out of the sea of clouds (seen only from above it), karst pillars
// with sheer, fluted sides, tiers and waists, crowned with pines: a cluster of them beyond the fight, others far off
// round about. xz: foot, z: radius (m), w: top (m)
const vec4 PK[9] = vec4[9](
  vec4(-8900., 4300., 480., 6200.), vec4(-9700., 5550., 330., 5100.), vec4(-8350., 3420., 290., 4600.),
  vec4(-11300., 3900., 420., 5500.), vec4(-14245., 17586., 650., 6400.), vec4(-18067., 18233., 480., 5500.),
  vec4(-17635., -1232., 460., 5800.), vec4(-3478., 16007., 380., 5100.), vec4(13088., -11320., 540., 5800.));
float peakHit(vec3 ro, vec3 rd, out vec3 pn, out float pv){
  float best = 1e9;
  float a = max(dot(rd.xz, rd.xz), 1e-6), ia = inversesqrt(a);
  for (int i = 0; i < 9; i++) {
    vec4 P = PK[i];
    float fi = float(i);
    vec2 oc = ro.xz - P.xy;
    float tc = -dot(oc, rd.xz) / a;
    if (tc <= 0. || tc > best) continue;
    vec2 m2 = oc + rd.xz * tc;
    float miss = length(m2);
    if (miss > P.z * 1.6) continue;
    float y = ro.y + rd.y * tc;
    vec2 u2 = m2 / max(miss, 1e-3);
    // (a crown that leans a little)
    float h = (y - 1600. + dot(u2, vec2(cos(fi * 2.3), sin(fi * 2.3))) * P.z * .25) / (P.w - 1600.);
    if (h < 0. || h > 1.) continue;
    float rug = texture(tShape, vec3(u2 * .55 + fi * .137, h * 1.4 + fi * .29)).r;
    float tier = texture(tDetail, vec3(fi * .31, h * 3.2 + fi * .17, .5)).r;
    float crown = smoothstep(.86, .98, h) * (texture(tDetail, vec3(u2 * 1.7 + fi * .21, h * 9.)).r - .5) * .55;
    float r = P.z * (1. + .16 * sin(h * 5.5 + fi * 2.1)) * (.72 + .55 * tier) * sqrt(max(1. - pow(h, 14.), 0.)) * (.7 + .55 * rug + crown);
    if (miss < r) {
      float th = tc - sqrt(r * r - miss * miss) * ia;
      if (th > 0. && th < best) {
        best = th;
        vec3 hp = ro + rd * th;
        pn = normalize(vec3(hp.x - P.x, r * 2.5 * pow(h, 10.), hp.z - P.y));
        // (h, and the flutes for the shading, packed)
        pv = h + floor(texture(tShape, vec3(u2 * 2.2 + fi * .4, h * 6.)).g * 8.) * 2.;
      }
    }
  }
  return best < 1e8 ? best : -1.;
}
void main(){
  if (uDebug > 1.5 && uDebug < 2.5) { vec4 n = texture(tShape, vec3(vUv, fract(vUv.x * 7.))); vec4 m = texture(tDetail, vec3(vUv, fract(vUv.y * 5.))); gl_FragColor = vec4(n.r, n.g * .625 + n.b * .25 + n.a * .125, m.r * .625 + m.g * .25 + m.b * .125, 1.); return; }
  if (uDebug > .5 && uDebug < 1.5) { vec4 n = texture(tShape, vec3(vUv * 2., .5)); vec4 m = texture(tDetail, vec3(vUv * 2., .5)); gl_FragColor = vec4(vUv.x < .5 ? n.rgb : m.rgb, 1.); return; }
  vec4 cp = vec4(vUv * 2. - 1., 1., 1.);
  vec4 vv = uProjInv * cp;
  vec3 rd = normalize((uCamWorld * vec4(vv.xyz / vv.w, 0.)).xyz);
  vec3 ro = uCamPos;
  vec3 sky = skyColor(rd);
  // up above the sea of clouds (the eye among or over it): its own light, the far peaks, the high streaks of ice
  float aloftK = uSeaK * smoothstep(1500., 2300., ro.y);
  if (aloftK > 0. && rd.y > 0.) {
    vec2 cp = rd.xz / (rd.y + .07);
    vec2 cr = mat2(.82, -.57, .57, .82) * cp;
    float cw = texture(tShape, vec3(cr * .02 + .7, .21)).r;
    float ci = texture(tShape, vec3(cr * vec2(.03, .26) + vec2(cw * .35 + uTime * .0005, 0.), .55)).r;
    float cj = texture(tDetail, vec3(cr * vec2(.1, .8) + .3, .35)).g;
    float cm = smoothstep(.62, .86, ci * .8 + cj * .3) * smoothstep(.55, .75, cw) * smoothstep(.03, .2, rd.y) * (1. - smoothstep(.5, .9, rd.y)) * aloftK;
    float sdc = max(dot(rd, uSunDir), 0.);
    vec3 cc = mix(uHorizon * 1.15, uSunCol * 1.7, .2 + .8 * pow(sdc, 6.)) * (.75 + .5 * cj) * uSunVis + uHorizon * .2 * (1. - uSunVis);
    sky = mix(sky, cc, cm * .3);
  }
  vec3 pnrm; float pvh;
  float tP = aloftK > .01 ? peakHit(ro, rd, pnrm, pvh) : -1.;
  if (tP > 0.) {
    vec3 hp = ro + rd * tP;
    float dif = max(dot(pnrm, uSunDir), 0.), rim = pow(max(dot(normalize(vec3(pnrm.x, 0., pnrm.z)), normalize(vec3(uSunDir.x, 0., uSunDir.z))), 0.), 6.);
    // grey rock, green on the crown and the ledges
    float flute = floor(pvh * .5) / 8.; pvh = fract(pvh * .5) * 2.;
    vec3 rock = mix(vec3(.12, .125, .13), vec3(.035, .06, .035), smoothstep(.86, .93, pvh)) * (.65 + .7 * flute);
    vec3 pc = rock * (uSunCol * (dif * 2.6 + rim * 1.1) * uSunVis + uZenith * .5 + uHorizon * .18);
    // the thin high air between: far ones are ghosts of themselves, their feet lost in the sea's own mist
    vec3 hz = skyColor(normalize(vec3(rd.x, .015, rd.z)));
    float fa = 1. - exp(-tP / 34000.);
    fa = max(fa, smoothstep(3100., 2400., hp.y) * .8);
    sky = mix(pc, hz, fa);
  }
  if (uDebug > 2.5 && uDebug < 3.5) { float tb = (1500. - ro.y) / max(rd.y, .01); vec3 pb = ro + rd * tb; gl_FragColor = vec4(stormAt(pb.xz, .2) * 2., step(length(pb.xz - stormO()), 6000.) * .5, 0., 1.); return; }
  float T = 1.; vec3 L = vec3(0.);
  float Tr = 1.; vec3 rc = vec3(0.);
  float strike = pow(max(sin(uTime * 7.3) * sin(uTime * 3.1), 0.), 4.);
  vec3 gold = vec3(1., .66, .22), violet = vec3(.62, .26, 1.);
  float stS = step(.005, uStorm);
  float b0 = mix(mix(1150., 950., uSharp), 190., stS), b1 = max(mix(mix(2650., 2300., uSharp), 4700., stS), mix(2300., 3950., uSeaK));
  // the layer along the ray: up into it from below, down into it from above, or out of it from inside
  float t0 = 0., t1 = -1.;
  if (abs(rd.y) > 1e-4) { float tA = (b0 - ro.y) / rd.y, tB = (b1 - ro.y) / rd.y; t0 = max(min(tA, tB), 0.); t1 = max(tA, tB); }
  else if (ro.y > b0 && ro.y < b1) t1 = 1e5;
  // (from above it, the sea runs on to the horizon)
  t1 = min(t1, t0 + mix(mix(16000., 10000., uSharp), 70000., aloftK));
  // (nothing is seen through a mountain)
  if (tP > 0.) t1 = min(t1, tP);
  bool fromBelow = ro.y <= b0;
  // over the sea of clouds: find where the ray meets its top (relaxed steps, then halving); the march stops there
  float tS = -1.; float aoS = 1.;
  // (down in the well the walls are drawn as cloud, not as a surface)
  gArena = arenaAt(ro.xz);
  if (aloftK > .5 && ro.y > seaTop(ro.xz, false) + 4.) {
    gNoSea = true;
    float tEnd = rd.y < 0. ? min(70000., (1400. - ro.y) / rd.y) : (rd.y > 1e-4 ? min(70000., (4100. - ro.y) / rd.y) : 70000.);
    if (tP > 0.) tEnd = min(tEnd, tP);
    float t = 0., tPrev = 0.;
    for (int i = 0; i < SEASTEPS; i++) {
      vec3 q = ro + rd * t;
      float hg = q.y - seaH(q.xz);
      if (hg < 0.) {
        float a = tPrev, b = t;
        for (int j = 0; j < 6; j++) { float m = (a + b) * .5; vec3 qm = ro + rd * m; if (qm.y - seaH(qm.xz) < 0.) b = m; else a = m; }
        tS = (a + b) * .5;
        break;
      }
      tPrev = t;
      t += max(hg * .45, 3. + t * .02);
      if (t > tEnd) break;
      // (out of steps going down: the far sea, lost in the haze at the rim of the world)
      if (i == SEASTEPS - 1 && rd.y < 0.) tS = t;
    }
    if (tS > 0.) { seaSurf((ro + rd * tS).xz, aoS); t1 = min(t1, tS); }
  }
  bool marching = t1 > t0 && (rd.y > .004 || !fromBelow);
  float dFront = 6e4, Tf = 1.;
  // (seen from among the clouds: the ground far below, under the shadows of the clouds, lost in haze toward the horizon)
  if (uGroundK > 0. && rd.y < -.002 && tP < 0.) {
    float gy = 90., tg = (gy - ro.y) / rd.y;
    if (tg > 0.) {
      vec3 pg = ro + rd * tg;
      float n1 = texture(tShape, vec3(pg.xz * .00055, .21)).r, n2 = texture(tDetail, vec3(pg.xz * .0031, .43)).g;
      vec3 gc = mix(vec3(.028, .048, .024), vec3(.075, .088, .042), smoothstep(.35, .7, n1)) * (.72 + .56 * n2);
      float hh, skg = stormAt(pg.xz, .3);
      float shd = density(pg + uSunDir * (((b0 + b1) * .5 - gy) / max(uSunDir.y, .12)), skg, false, hh);
      float lit = (1. - smoothstep(.0, .45, shd)) * uSunVis;
      vec3 gl = gc * (uSunCol * lit * max(uSunDir.y, 0.) * 2.4 + uZenith * .7 + uHorizon * .3);
      vec3 hzc = skyColor(normalize(vec3(rd.x, .015, rd.z)));
      sky = mix(sky, mix(gl, hzc, 1. - exp(-tg * .00009)), uGroundK);
    }
  }
  float crowd = 0.;
  if (marching && !fromBelow) {
    // from among the clouds: look ahead coarsely for where the ray first meets cloud, then march finely from there
    // (crisp surfaces, no grain), the samples crowding near the eye when it is inside one
    float span = t1 - t0, hit = -1.;
    for (int i = 0; i < 40; i++) {
      float g = (float(i) + .5) / 40.;
      float tt = t0 + span * g * g;
      vec3 pp = ro + rd * tt;
      float hh;
      if (density(pp, stormAt(pp.xz, (pp.y - 620.) / 4080.), false, hh) > .015) { hit = tt; break; }
    }
    // (the launch's sheets are thin: never stepped over, wherever the ray crosses one inside the well)
    if (uBands.x > 0. && abs(rd.y) > .02) {
      for (int k = 0; k < 3; k++) {
        float hy = k == 0 ? uBands.y : (k == 1 ? uBands.z : uBands.w);
        float tk = (hy - ro.y) / rd.y;
        if (tk > t0 && tk < t1 && (hit < 0. || tk < hit) && seaHole3(ro + rd * tk) < .99) hit = max(t0, tk - 90. / abs(rd.y));
      }
    }
    if (hit < 0.) marching = false;
    else {
      float back = span * (2. * sqrt((hit - t0) / max(span, 1.)) + .05) / 40.;
      t0 = max(t0, hit - back);
      t1 = min(t1, t0 + 1300. + back);
      crowd = hit - t0 < 40. ? 1. : 0.;
    }
  }
  // the shadow play: read once for the ray, where it meets the screen's underside (the same for every sample in the
  // screen, so the figures stay crisp however obliquely it is seen)
  vec3 pupH = vec3(0.), pupG = vec3(0.); float pupS = 0.;
  if (uStage.w > 0. && rd.y > .05) {
    vec3 ps = ro + rd * ((uBands.y - 42. - ro.y) / rd.y);
    vec2 d = ps.xz - uStage.xy;
    vec2 st = vec2(dot(d, uStageR.xy), dot(d, uStageR.zw)) / uStage.z;
    vec3 g0 = puppet(st, uPup0, 0., vec2(.1, .76), .5), g1 = puppet(st, uPup1, .25, vec2(-.02, .76), 0.);
    vec3 goldL = vec3(1., .66, .26), violL = vec3(.55, .24, 1.);
    // (the aura only round each figure, not under it)
    pupH = (goldL * g0.z * (1. - g0.x) + violL * g1.z * (1. - g1.x)) * 1.3 * uStage.w;
    pupS = max(g0.x, g1.x) * uStage.w;
    pupG = (goldL * g0.y + violL * g1.y) * 2.6 * uStage.w;
    vec2 fq = st - uPupFx.xy;
    pupG += vec3(1., .9, .7) * uPupFx.z * (exp(-dot(fq, fq) / .003) * 5. + exp(-dot(fq, fq) / .05) * .9);
  }
  if (marching) {
    // (interleaved gradient noise: the steps' offsets vary evenly across the screen, no salt-and-pepper edges)
    float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
    float mu = dot(rd, uSunDir);
    float phase = mix(hg(mu, .6), hg(mu, -.25), .35);
    float sigma = .0028 * uDensity;
    for (int i = 0; i < STEPS; i++) {
      float f = (float(i) + jit) / float(STEPS);
      float t = t0 + (t1 - t0) * mix(f, f * f, crowd);
      float dt = max((t1 - t0) * mix(1., 2. * f, crowd) / float(STEPS), 3.);
      vec3 p = ro + rd * t;
      float sk = stormAt(p.xz, (p.y - 620.) / 4080.);
      float hf;
      float c = density(p, sk, true, hf);
      float dep = gDepth, sTh = gSeaThick, sW = gSheetW, sL = gSheetLit, sK = gSheetK, sN = gSheetN;
      if (c > .002) {
        // (over the sea: crisper, denser heads, the light marched farther for the long shadows of the towers)
        float aS = aloftK * (1. - sk);
        float sg = sigma * mix(1., 1.7, aS);
        float od = 0.;
        for (int j = 1; j <= LSTEPS; j++) {
          float fj = float(j);
          float hh;
          float ls = mix(mix(110., 70., uSharp), 340., sk);
          // (over the sea: 30, 120, 480, 1920 m, each standing for the stretch before it)
          float dA = (LSTEPS > 2 ? 30. * pow(4., fj - 1.) : 70. * pow(7., fj - 1.));
          float dj = mix(fj * fj * ls, dA, aS), wj = mix((fj * 2. - 1.) * ls, dA * .75, aS);
          od += density(p + uSunDir * dj, sk, false, hh) * wj;
        }
        float Ts = max(exp(-od * sg), exp(-od * sg * .22) * mix(mix(mix(.62, .32, uSharp), .06, uSeaK), .022, aS) * (1. - sk * .8));
        // (seen from under it, the formed deck stands between every cloud and the sun: its whole depth, not just the
        // few hundred metres the light steps reach, so its underside and what hangs under it go grey)
        Ts *= mix(exp(-sg * .55 * sTh / max(uSunDir.y, .2)), 1., aloftK);
        float powder = 1. - exp(-c * 2.2);
        // thick storm cloud does not glow when the sun is behind it: only its tops keep the silver edge
        float ph = mix(phase, 1., sk * .85 * (1. - hf * hf));
        vec3 lit = mix(uCloudLit * mix(vec3(1.), uSunCol * 1.15, .55 * uSeaK), uSunCol * vec3(1., .9, .78) * 1.25, sk * hf);
        vec3 S = lit * Ts * ph * uSunVis * (.6 + powder * .8) * mix(mix(2.4, 3.4, uSharp), 2.5, aS) * (1. - sk * .55 * (1. - hf)) * (1. - uStorm * .55 * (1. - sk) * (1. - aS));
        // the storm is slate-dark in any light; only what the sun can reach directly (tops, edges) is lit
        // (deep under a thick deck, none of the blue of the sky above it)
        float under = smoothstep(250., 900., sTh) * (1. - aloftK);
        vec3 amb = mix(mix(uCloudShade, uZenith * 2. + uHorizon * .25, .55 * uSeaK * smoothstep(.35, .85, hf) * (1. - under)), vec3(.03, .034, .048), sk) * (.38 + .62 * hf) * mix(1.05, .7, sk);
        // over the sea the shade is the blue of the sky above, deepening down into the hollows between the heads
        vec3 ambA = (uZenith * .8 + uHorizon * .12) * (.28 + .72 * exp(-max(dep, 0.) / 240.));
        // (diving down through the storm: the light from above dies away with depth, slate grey to near black)
        amb += uDive * sk * (vec3(.085, .094, .125) * (.35 + .65 * smoothstep(.16, .56, hf)) + vec3(.32, .33, .37) * smoothstep(1900., 2750., p.y) * uSunVis);
        // (under a thick deck less of the sky's light gets in)
        S += mix(amb * mix(1., .6, under), ambA, aS);
        // (the launch's sheets, each lit by what is above it: the first a screen glowing pearl-grey over the dark of the
        // well, the next pearl, the last gold in the sun; each a little darker underneath)
        // (the launch: inside the eye's well its walls are slate low down, lighter as they rise toward the light)
        if (uWell.z > 0.) {
          float inWl = uWell.z * (1. - smoothstep(900., 1400., length(p.xz - uHole.xy)));
          S *= mix(1., mix(.13, 1., smoothstep(750., 2300., p.y)), inWl);
        }
        vec3 shC = sK < .5 ? vec3(.6, .58, .6) * (.62 + .5 * sL) : (sK < 1.5 ? vec3(.86, .86, .9) * (.72 + .5 * sL) : vec3(1.25, 1.02, .7) * (.85 + .7 * sL));
        // (mottled underneath, as a real deck is: thicker and darker in its billows, lighter where it thins)
        shC *= (.35 + .65 * uSunVis) * (.45 + 1.1 * smoothstep(.36, .64, sN));
        // (the shadow play on the screen: each figure ringed by its own light, dark against it, its cut-outs burning;
        // the screen itself dimmed a little round them, as a lamp-lit paper is)
        if (sK < .5 && uStage.w > 0.) shC = (shC * (1. - .35 * uStage.w) + pupH) * (1. - .9 * pupS) + pupG;
        S = mix(S, shC, sW);
        // the storm's belly takes the colour of the low light at the horizon (amber, then red)
        // (only far off, toward the horizon: no glowing band with a hard top under the deck)
        S += uHorizon * sk * (1. - hf) * (1. - hf) * .1 * smoothstep(5000., 22000., length(p.xz - ro.xz));
        // lightning inside the deck: a hot core around the channel and a broad pulse through the whole cloud
        float fl = length(p - uFlashPos);
        S += uFlashCol * uFlash * (exp(-fl * fl / (420. * 420.)) * 2.2 + exp(-fl / 1600.) * .3);
        if (uClash > 0.) {
          // two cultivators: hot heads, streaks along their recent path, and the light of each meeting
          float h1 = length(p - uC1), h2 = length(p - uC2);
          float s1 = 0., s2 = 0.;
          for (int k = 0; k < 3; k++) {
            float fk = 1. - float(k) * .3;
            s1 += exp(-pow(segDist(p, uT1[k], uT1[k + 1]) / 70., 2.)) * fk;
            s2 += exp(-pow(segDist(p, uT2[k], uT2[k + 1]) / 70., 2.)) * fk;
          }
          S += gold * uClash * uClashGV.x * (exp(-h1 * h1 / (300. * 300.)) * 7. + (exp(-h1 / 700.) * .55 + exp(-h1 / 2600.) * .06) * uClashFar + s1 * 1.6);
          S += violet * uClash * uClashGV.y * (exp(-h2 * h2 / (300. * 300.)) * 11. + (exp(-h2 / 700.) * .8 + exp(-h2 / 2600.) * .08) * uClashFar + s2 * 2.6);
          float ia = uImpact.w;
          if (ia >= 0. && ia < 1.) {
            vec3 dI = p - uImpact.xyz;
            float rr = length(dI.xz), ring = mix(60., 2400., sqrt(ia));
            float e = exp(-pow((rr - ring) / mix(50., 320., ia), 2.)) * exp(-abs(dI.y) / 1600.) * (1. - ia) * (1. - ia);
            vec3 ic = mix(vec3(1., .85, .6), vec3(.75, .55, 1.), .45);
            S += ic * uClash * uClashGV.x * (e * 4. + exp(-dot(dI, dI) / (520. * 520.)) * exp(-ia * 3.) * 11. + exp(-length(dI) / 2200.) * exp(-ia * 6.) * .5 * uClashFar);
          }
        }
        // the falling star: a burning head and the hot trail it drags through the deck
        if (uStarK > 0.) {
          float hs = length(p - uStarPos);
          float ts = segDist(p, uStarPos, uStarPos + (uStarTail - uStarPos) * 2.4);
          S += vec3(1., .78, .45) * uStarK * (exp(-hs * hs / (260. * 260.)) * 4. + exp(-hs / 900.) * .6 + exp(-ts * ts / (160. * 160.)) * 1.4);
        }
        // where it came down: the deck lit from beneath, far off, and a ring of light running out through it
        if (uHit.w >= 0. && uHit.w < 1.) {
          vec3 dH = p - uHit.xyz;
          float rH = length(dH.xz), aH = uHit.w;
          float ringH = mix(200., 9000., sqrt(aH));
          float eH = exp(-pow((rH - ringH) / mix(160., 900., aH), 2.)) * (1. - aH) * (1. - aH);
          S += uHitCol * exp(-rH / 900.) * exp(-aH * 9.) * 1.6 * (1. - hf * .5) + uHitCol * vec3(.85, .95, 1.08) * eH * .55;
        }
        if (uCharge.w > 0.) {
          float dk = length(p - uCharge.xyz);
          S += vec3(.42, .55, 1.) * uCharge.w * (exp(-dk * dk / (140. * 140.)) * 2.2 + exp(-dk / 600.) * .16) * (.8 + .2 * sin(uTime * 37.) * sin(uTime * 23.));
        }
        if (uChanA.w > 0.) {
          float dc = segDist(p, uChanA.xyz, uChanB.xyz);
          S += vec3(.6, .68, 1.) * uChanA.w * (exp(-dc * dc / (110. * 110.)) * 2. + exp(-dc / 600.) * .35);
        }
        float fd = length(p.xz - uFireC.xz) / 2200.;
        S += uFireCol * uFireGlow * 1.5 * exp(-max(p.y - mix(1150., 620., sk), 0.) / 520.) * exp(-fd * fd);
        if (uDebug > 3.5 && uDebug < 4.5) S = vec3(sk * 3., hf * 3., 0.);
        if (uDebug > 4.5 && uDebug < 5.5) S = vec3(Ts * 2., exp(-od * sg) * 2., clamp(dep / 300., 0., 1.) * 2.);
        // the dark running out from where it fell: the deck goes black behind its front
        if (uDark.w > 0.) S *= 1. - uDark.w * .8 * smoothstep(uDark.z + 600., uDark.z - 600., length(p.xz - uDark.xy));
        float st = c * dt * sigma * mix(1., 1.7, aloftK * (1. - sk));
        float Tst = exp(-st);
        L += T * S * (1. - Tst);
        T *= Tst;
        if (dFront > 5e4 && T < .88) dFront = t;
        if (T < .015) break;
      }
      if (t < uFocus) Tf = T;
    }
  }
  // the sea's top, behind whatever cloud was marched in front of it
  if (tS > 0.) {
    vec3 hp = ro + rd * tS;
    vec3 sc = seaShade(hp, rd, tS, aoS);
    float fa = 1. - exp(-max(tS - 1200., 0.) / 15000.);
    sc = mix(sc, skyColor(normalize(vec3(rd.x, .02, rd.z))), fa);
    L += T * sc;
    if (dFront > 5e4) dFront = tS;
    if (tS < uFocus) Tf = 0.;
    T = 0.;
  }
  // (what the world behind it sees: the cloud alone)
  vec3 Lc = L; float Tc = T;
  if (marching && fromBelow) {
    // beyond the march: the deck's base seen far off, sinking toward the horizon into its own haze (no clear band
    // of sky under a storm that covers the whole valley; only a thin glow where the base meets the horizon)
    float underS = stormAt(ro.xz, 0.);
    if (uStorm > .01 && T > .02) {
      float tb = (560. - ro.y) / max(rd.y, .0015);
      if (tb > t1) {
        vec3 pb = ro + rd * tb;
        float skb = stormAt(pb.xz, 0.);
        float haze = 1. - exp(-tb / 36000.);
        float rag = texture(tShape, vec3(pb.xz * .00009 + uWind * uTime * .35, .37)).r;
        vec3 baseCol = mix(mix(uCloudShade, vec3(.03, .034, .048), .6) * (.7 + rag * .6) + uFlashCol * uFlash * .25, uHorizon * .6, haze * haze * haze);
        float cover = skb * (1. - haze * haze * .6);
        L += T * baseCol * cover;
        T *= 1. - cover;
      }
    }
    float fade = (1. - exp(-t0 / 26000.) * smoothstep(.004, .06, rd.y)) * (1. - .8 * underS);
    L = mix(L, sky * (1. - T), fade);
  } else if (marching) {
    // seen from among the clouds: the floor of cloud fades into the haze toward the horizon (over the sea, the thin
    // high air: the near heads crisp, the far ones paling and bluing away to the rim of the world)
    float fadeA = mix(smoothstep(9000., 26000., dFront), 1. - exp(-max(dFront - 1200., 0.) / 15000.), aloftK);
    L = mix(L, skyColor(normalize(vec3(rd.x, .02, rd.z))) * (1. - T), fadeA);
  }
  // rain hanging under the storm: grey curtains between the base and the ground, streaked, lit by the flashes
  if (uStorm > .01 && rd.y > .004 && rd.y < .3 && fromBelow) {
    float tr = 350. + 650. * fract(sin(dot(gl_FragCoord.xy, vec2(7.13, 41.7))) * 913.7);
    float az = atan(rd.z, rd.x);
    float streak = texture(tDetail, vec3(az * 9., .3, .5)).r * .6 + texture(tDetail, vec3(az * 23., .7, .2)).g * .4;
    for (int k = 0; k < 10; k++) {
      vec3 q = ro + rd * tr;
      if (q.y > 0. && q.y < 700.) {
        float sk = stormAt(q.xz, 0.);
        float rpatch = smoothstep(.42, .72, texture(tShape, vec3(q.xz * .00042 + vec2(uTime * .002, 0.), .1)).r);
        float dr = sk * rpatch * (.55 + streak * .9) * smoothstep(0., 120., q.y + 60.) * smoothstep(700., 450., q.y);
        Tr *= exp(-dr * 650. * .0008);
      }
      tr += 650.;
    }
    rc = (uCloudShade * 1.6 + uHorizon * .35) + uFlashCol * uFlash * .5;
  }
  // the light of the fight pouring down the eye of the gathering: a column of it standing in the well
  if (uBeam.w > 0. && uHole.z > .01) {
    vec2 oc = uHole.xy - ro.xz;
    float a2 = max(dot(rd.xz, rd.xz), 1e-5);
    float tb = max(dot(oc, rd.xz) / a2, 0.);
    float db = length(ro.xz + rd.xz * tb - uHole.xy), yb = ro.y + rd.y * tb;
    float hk = smoothstep(800., 1350., yb) * (1. - smoothstep(2500., 3500., yb));
    float fl = .75 + .25 * sin(yb * .011 - uTime * 7.) * sin(yb * .004 + uTime * 3.1);
    L += uBeam.rgb * uBeam.w * hk * fl * (exp(-db * db / (190. * 190.)) * .5 + exp(-db / 520.) * .1) * (.12 + Tf * .88);
  }
  // the lights themselves and their streaks, seen through whatever cloud is in front of them
  if (uClash > 0.) {
    float k1 = 0., k2 = 0.;
    for (int k = 0; k < 3; k++) {
      float fk = (1. - float(k) * .33);
      float r1 = rayDist(ro, rd, uT1[k], uT1[k + 1]), r2 = rayDist(ro, rd, uT2[k], uT2[k + 1]);
      k1 += (exp(-r1 * r1 / 50.) * 3. + exp(-r1 / 35.) * .25) * fk;
      k2 += (exp(-r2 * r2 / 50.) * 3. + exp(-r2 / 35.) * .25) * fk;
    }
    vec3 d1 = normalize(uC1 - ro), d2 = normalize(uC2 - ro);
    float g1 = pow(max(dot(rd, d1), 0.), 2500.) * .7 + pow(max(dot(rd, d1), 0.), 300.) * .25;
    float g2 = pow(max(dot(rd, d2), 0.), 2500.) * .7 + pow(max(dot(rd, d2), 0.), 300.) * .25;
    float vis = .12 + Tf * .88;
    // (a light seen from far off; close to one, it is a person, drawn in the world with the light about them, war.js,
    // and its glow here would only be a haze over everything)
    float n1 = smoothstep(25., 140., length(uC1 - ro)), n2 = smoothstep(25., 140., length(uC2 - ro));
    L += (gold * (g1 + k1 * .3) * uClashGV.x * n1 + violet * (g2 + k2 * .3) * 1.9 * uClashGV.y * n2) * uClash * vis;
    L += (gold * g1 * uClashGV.x * n1 + violet * g2 * uClashGV.y * n2) * .5 * uClash * vis * .6;
    float ia = uImpact.w;
    if (ia >= 0. && ia < .25) {
      vec3 di = normalize(uImpact.xyz - ro);
      float fI = pow(max(dot(rd, di), 0.), 3000.) * 18. + pow(max(dot(rd, di), 0.), 900.) * .5;
      L += vec3(1., .92, 1.) * fI * (1. - ia * 4.) * uClash * (.25 + T * .75);
    }
  }
  vec3 col = (sky * T + L) * Tr + rc * (1. - Tr);
  gl_FragColor = vec4(col, T * Tr);
  pc_fragData1 = vec4(Lc, Tc);
  pc_fragData2 = vec4(dFront, Tf, 0., 0.);
}`;

// ------------------------------------------------------------------ direction-only sky for the environment light
const ENVSKY = `${SKY_UNIFORMS}
uniform float uCover, uStorm, uFlash; uniform vec3 uFlashCol; uniform sampler2D uNoise; uniform float uTime;
varying vec3 vDir;
${SKYCOL}
void main(){
  vec3 rd = normalize(vDir);
  vec3 sky = skyColor(rd);
  float h = max(rd.y, .02);
  vec2 p = rd.xz / (h + .12) * 1.4;
  float n = texture2D(uNoise, p * .11 + uTime * .002).r * .6 + texture2D(uNoise, p * .31).g * .4;
  float cov = mix(uCover, 1., uStorm);
  float dens = smoothstep(1. - cov, 1. - cov + .3, n) * smoothstep(-.05, .1, rd.y);
  vec3 cl = mix(uCloudShade, uCloudLit, clamp(.45 + (n - .5) * 1.4 + max(dot(rd, uSunDir), 0.) * .5, 0., 1.) * uSunVis + .2 * (1. - uSunVis));
  cl += uFireCol * uFireGlow * .35 * (1. - smoothstep(.0, .6, rd.y));
  vec3 col = mix(sky, cl, dens * .92);
  // light from a clear sky is bluer than it looks: keep the fill cool but not saturated
  col = mix(vec3(dot(col, vec3(.2126, .7152, .0722))), col, .72);
  // ground bounce below the horizon
  col = mix(col, uGround * (.35 + uSunVis * .35) + uFireCol * uFireGlow * .12, smoothstep(.02, -.15, rd.y));
  col += uFlashCol * uFlash * .25;
  gl_FragColor = vec4(col, 1.);
}`;

export function createSky(renderer, quality) {
  const shape = noise3D(renderer, quality.low ? 48 : 64, 0);
  const detail = noise3D(renderer, 32, 1);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const seaRT = bakeSea(renderer, quality.low ? 1024 : 2048);
  const uniforms = {
    tShape: { value: shape.texture }, tDetail: { value: detail.texture }, tSea: { value: seaRT.texture }, tPuppet: { value: puppetTexture(512) },
    uStage: { value: new THREE.Vector4(0, 0, 100, 0) }, uStageR: { value: new THREE.Vector4(1, 0, 0, 1) }, uPup0: { value: new THREE.Vector4(-0.5, 0, 0, 0) }, uPup1: { value: new THREE.Vector4(0.5, 0, 0, 0) }, uPupFx: { value: new THREE.Vector4(0, 0, 0, 0) },
    uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: V3(0, 0, 0) },
    uSunDir: { value: V3(0.5, 0.3, 0.8).normalize() }, uSunCol: { value: new THREE.Color(1, 0.8, 0.55) }, uSunVis: { value: 1 },
    uZenith: { value: new THREE.Color(0.25, 0.48, 0.82) }, uHorizon: { value: new THREE.Color(0.85, 0.86, 0.82) }, uGround: { value: new THREE.Color(0.5, 0.52, 0.5) },
    uCloudLit: { value: new THREE.Color(1, 0.97, 0.92) }, uCloudShade: { value: new THREE.Color(0.62, 0.66, 0.74) },
    uCover: { value: 0.42 }, uStorm: { value: 0 }, uStormGrow: { value: 0 }, uStormC: { value: V3(-420, 0, -1500) },
    uFireDir: { value: V3(0, 0, 1) }, uFireGlow: { value: 0 }, uFireCol: { value: new THREE.Color(1.0, 0.28, 0.08) }, uFireC: { value: V3(2, 0, 30) },
    uFlash: { value: 0 }, uFlashPos: { value: V3(0, 1000, -900) }, uFlashCol: { value: new THREE.Color(0.75, 0.72, 1.0) },
    uClash: { value: 0 }, uC1: { value: V3(0, 0, 0) }, uC2: { value: V3(0, 0, 0) },
    uStarK: { value: 0 }, uStarPos: { value: V3(0, -9999, 0) }, uStarTail: { value: V3(0, -9999, 0) },
    uT1: { value: [V3(), V3(), V3(), V3()] }, uT2: { value: [V3(), V3(), V3(), V3()] }, uImpact: { value: new THREE.Vector4(0, 0, 0, -1) },
    uEye: { value: new THREE.Vector4(0, 0, 0, 0) }, uHit: { value: new THREE.Vector4(0, 0, 0, -1) }, uHitCol: { value: new THREE.Color(1, 0.86, 0.74) }, uDark: { value: new THREE.Vector4(0, 0, 0, 0) }, uClashGV: { value: new THREE.Vector2(1, 1) },
    uCrater: { value: [new THREE.Vector4(0, 0, 0, -1), new THREE.Vector4(0, 0, 0, -1), new THREE.Vector4(0, 0, 0, -1)] }, uCraterS: { value: [1, 1, 1] },
    uTrench: { value: [new THREE.Vector4(), new THREE.Vector4()] }, uTrenchK: { value: [new THREE.Vector2(), new THREE.Vector2()] }, uFocus: { value: 0 }, uGroundK: { value: 0 }, uSeaK: { value: 0 }, uDive: { value: 0 }, uBands: { value: new THREE.Vector4(0, 1300, 1650, 2000) }, uBandT: { value: new THREE.Vector4(150, 170, 210, 0) }, uWell: { value: new THREE.Vector4(1, 0, 0, 0) },
    uCharge: { value: new THREE.Vector4(0, 0, 0, 0) }, uHole: { value: new THREE.Vector4(-250, -40, 1, 0) }, uArena: { value: new THREE.Vector4(0, 0, 1, 0) }, uChanA: { value: new THREE.Vector4(0, 0, 0, 0) }, uChanB: { value: new THREE.Vector4(0, 0, 0, 0) },
    uVort: { value: new THREE.Vector4(0, 0, 0, 1) }, uBeam: { value: new THREE.Vector4(0, 0, 0, 0) }, uClashFar: { value: 1 },
    uMoonDir: { value: V3(-0.4, 0.5, -0.75).normalize() }, uMoonCol: { value: new THREE.Color(0, 0, 0) },
    uTime: U.uTime, uWind: { value: new THREE.Vector2(0.0009, 0.0003) }, uDensity: { value: 1 }, uDebug: { value: 0 }, uSharp: { value: 0 },
    uNoise: U.uNoise,
  };
  // low-resolution cloud target
  const div = quality.low ? 3 : 2;
  // (three targets: the sky as seen, the cloud alone in front of the world, where the cloud begins and how clear the way to the focus is)
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, count: 3 });
  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: CLOUDS.replace('__STEPS__', quality.low ? '18' : '30').replace('__LSTEPS__', quality.low ? '2' : '4')
      .replace('__SEASTEPS__', quality.low ? '64' : '110').replace('__SHSTEPS__', quality.low ? '4' : '6'),
    uniforms, depthTest: false, depthWrite: false,
  });
  const quad = new FullScreenQuad(cloudMat);

  // the dome in the main scene: samples the cloud target, adds a crisp sun disc
  const domeU = { tSky: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uTexel: { value: new THREE.Vector2(1, 1) }, uSunDir: uniforms.uSunDir, uSunCol: uniforms.uSunCol, uSunVis: uniforms.uSunVis };
  const domeMat = new THREE.ShaderMaterial({
    uniforms: domeU, depthWrite: false, depthTest: true, fog: false, side: THREE.BackSide,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.); gl_Position = p.xyww; }`,
    // (the march's per-pixel jitter is smoothed out here, over a texel of the sky's own grid each way, so the painted
    // pass downstream never turns it into a pattern of cells)
    fragmentShader: `uniform sampler2D tSky; uniform vec2 uRes, uTexel; uniform vec3 uSunDir, uSunCol; uniform float uSunVis; varying vec3 vDir;
void main(){
  vec2 q = gl_FragCoord.xy / uRes, o = uTexel;
  vec4 s = texture2D(tSky, q) * .25;
  s += (texture2D(tSky, q + vec2(o.x, 0.)) + texture2D(tSky, q - vec2(o.x, 0.)) + texture2D(tSky, q + vec2(0., o.y)) + texture2D(tSky, q - vec2(0., o.y))) * .125;
  s += (texture2D(tSky, q + o) + texture2D(tSky, q - o) + texture2D(tSky, q + vec2(o.x, -o.y)) + texture2D(tSky, q + vec2(-o.x, o.y))) * .0625;
  float sd = dot(normalize(vDir), uSunDir); float disc = smoothstep(.99955, .99985, sd) * uSunVis * s.a; gl_FragColor = vec4(s.rgb + uSunCol * disc * 6., 0.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), domeMat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  mesh.name = 'sky';

  // environment: a small scene with the direction-only sky, filtered to a PMREM for image-based light
  const envMat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: ENVSKY,
  });
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), envMat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  // The environment light is rebuilt in place: one render target, camera and backdrop, kept for good. (three's
  // fromScene makes a new target, a new backdrop material and a new box on every call. A new target made every lit
  // material in the scene check its shader program again, and the backdrop's program was compiled, used once and
  // deleted: about four times a second whenever the story moved.) The steps are fromScene's own (three 0.180.0,
  // pinned in package.json): six faces into the cube-UV layout, then the generator's blur into the lower levels.
  const env = { rt: null, cam: new THREE.PerspectiveCamera(90, 1, 0.1, 100), box: null, clear: new THREE.Color(), alpha: 1 };
  const UP = [1, -1, 1, 1, 1, 1], FWD = [1, 1, 1, -1, -1, -1];
  function envInPlace() {
    const r = renderer;
    if (!env.rt) {
      pmrem._setSize(64);
      env.rt = pmrem._allocateTargets();   // (the first call also makes the generator's ping-pong target, blur and planes)
      env.rt.depthBuffer = true;
      env.box = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ name: 'env.backdrop', side: THREE.BackSide, depthWrite: false, depthTest: false }));
    }
    const rt = env.rt, cam = env.cam, size = pmrem._cubeSize;
    const oldT = r.getRenderTarget(), oldFace = r.getActiveCubeFace(), oldMip = r.getActiveMipmapLevel();
    const oldXr = r.xr.enabled, oldAuto = r.autoClear, oldTone = r.toneMapping;
    r.getClearColor(env.clear); env.alpha = r.getClearAlpha();
    r.xr.enabled = false; r.toneMapping = THREE.NoToneMapping; r.autoClear = false;
    env.box.material.color.copy(env.clear);
    // (last time's depth would otherwise be tested against: the target is not new any more)
    rt.scissorTest = false;
    r.setRenderTarget(rt);
    r.clearDepth();
    rt.scissorTest = true;
    for (let i = 0; i < 6; i++) {
      const col = i % 3;
      cam.position.set(0, 0, 0);
      if (col === 0) { cam.up.set(0, UP[i], 0); cam.lookAt(FWD[i], 0, 0); }
      else if (col === 1) { cam.up.set(0, 0, UP[i]); cam.lookAt(0, FWD[i], 0); }
      else { cam.up.set(0, UP[i], 0); cam.lookAt(0, 0, FWD[i]); }
      rt.viewport.set(col * size, i > 2 ? size : 0, size, size);
      rt.scissor.set(col * size, i > 2 ? size : 0, size, size);
      r.setRenderTarget(rt);
      r.render(env.box, cam);
      r.render(envScene, cam);
    }
    pmrem._applyPMREM(rt);
    r.setRenderTarget(oldT, oldFace, oldMip);
    r.xr.enabled = oldXr; r.toneMapping = oldTone; r.autoClear = oldAuto;
    r.setClearColor(env.clear, env.alpha);
    rt.scissorTest = false;
    rt.viewport.set(0, 0, rt.width, rt.height);
    rt.scissor.set(0, 0, rt.width, rt.height);
    return rt.texture;
  }

  let w = 1, h = 1;
  const clashOffset = new THREE.Vector3();
  const overrides = {};   // debug / restaging: uniform values forced at render time, e.g. { uStormGrow: 0.45 }
  return {
    mesh, uniforms, rt,
    setSize(W, H) { w = Math.max(1, Math.round(W / div)); h = Math.max(1, Math.round(H / div)); rt.setSize(w, h); domeU.uRes.value.set(W, H); domeU.uTexel.value.set(1 / w, 1 / h); },
    // render the cloud deck for this camera (call before the scene render)
    clashOffset, overrides,
    renderClouds(camera) {
      for (const [k, v] of Object.entries(this.overrides || {})) if (uniforms[k]) uniforms[k].value = v;
      if (clashOffset.lengthSq() > 0) {
        uniforms.uC1.value.add(clashOffset); uniforms.uC2.value.add(clashOffset);
        for (const v of uniforms.uT1.value) v.add(clashOffset);
        for (const v of uniforms.uT2.value) v.add(clashOffset);
        uniforms.uImpact.value.x += clashOffset.x; uniforms.uImpact.value.y += clashOffset.y; uniforms.uImpact.value.z += clashOffset.z;
      }
      uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
      uniforms.uCamWorld.value.copy(camera.matrixWorld);
      uniforms.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      quad.render(renderer);
      renderer.setRenderTarget(prev);
    },
    updateEnv() {
      const flash = uniforms.uFlash.value;
      uniforms.uFlash.value = 0;
      const tex = envInPlace();
      uniforms.uFlash.value = flash;
      return tex;
    },
  };
}

// Karst towers ringing the valley, with green caps and grey rock faces.
export function createMountains(quality) {
  const r = rng(303);
  const group = new THREE.Group();
  const geos = [], tops = [];
  // Karst massifs (references: village-peace, WideIntro): a few clustered mountains rather than a fence of towers.
  // Each massif is a main spire with lesser peaks of different heights and widths around it, low ridges joining
  // them, and a forested skirt that buries their feet. Three layers in depth: near (green-grey), mid (blue-grey
  // through the haze), far (pale).
  const piece = (x, z, R, H0, seed, kind, layer, rot = 0, ax = 1) => {
    const H = H0 + (kind === 'hill' ? 30 : 55);
    const lod = layer === 0 ? 1 : layer === 1 ? 0.75 : 0.55;
    const seg = Math.round((kind === 'spire' ? 40 : 28) * lod), hs = Math.round((kind === 'spire' ? 26 : 10) * lod);
    const g = new THREE.CylinderGeometry(1, 1, 1, seg, hs, false);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const q = rng(Math.floor(seed * 1000) + 7);
    const leanA = q() * 6.28, lean = q.range(-0.25, 0.25);
    const flutes = 4 + Math.floor(q() * 7), topExp = q.range(2.5, 9), taper = q.range(0.12, 0.38), waist = q.range(0, 0.12);
    const mesa = q() < 0.25 ? q.range(0.15, 0.35) : 0;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i) + 0.5, pz = pos.getZ(i);
      const a = Math.atan2(pz, px);
      let prof, green, rough;
      const fl = Math.abs(Math.sin(a * flutes * 0.5 + fbm(py * 2.2 + seed, seed, 2) * 2.4));
      const fl2 = Math.abs(Math.sin(a * 13 + seed + fbm(py * 4 + seed, 1.3, 2) * 2));
      const veg = fbm(a * 4 + seed, py * 7, 3);
      if (kind === 'spire') {
        // cliffs: near-vertical, tapering, sometimes a waist; a rounded, pointed or flat crown
        const crown = Math.pow(Math.max(0, 1 - Math.pow(py, topExp)), mesa ? 0.18 : 0.5);
        prof = ((1 - py * taper) * crown + mesa * (py > 0.97 ? 1 : 0)) * 0.82 + 0.03;
        prof *= 1 + Math.sin(py * Math.PI * 1.3 + seed) * waist;
        prof += Math.max(0, 0.12 - py) * 2.2;
        const deep = layer === 0 ? 1.4 : layer === 1 ? 1.15 : 1;
        rough = ((fl - 0.62) * 0.26 + (fl2 - 0.62) * 0.1) * deep + (fbm(a * 2.2 + seed, py * 0.8 + seed, 3) - 0.5) * 0.32
          + Math.sin(py * 26 + fbm(a * 2 + seed, seed, 2) * 6) * 0.025;
        const ledge = Math.sin(py * 26 + fbm(a * 2 + seed, seed, 2) * 6);
        const vegK = layer === 0 ? 0.48 : layer === 1 ? 0.58 : 0.7;
        green = py > 0.84 - mesa || ledge > 0.6 || (veg > vegK && py < 0.55) || py < 0.12;
      } else {
        // ridges and the wooded skirt: rounded, lumpy, green
        // a lumpy wooded slope: concave, falling away from a few knolls (no flat discs)
        prof = (kind === 'hill' ? Math.pow(Math.max(0, 1 - py), 1.6) : Math.pow(Math.max(0, 1 - py * py), 0.5) * 0.95) + 0.02;
        rough = (fbm(a * 3 + seed, py * 2 + seed, 3) - 0.5) * 0.55 + (fbm(a * 9 + seed, py * 5, 2) - 0.5) * 0.2;
        green = kind === 'hill' ? veg > 0.25 || py > 0.3 : py > 0.55 || veg > 0.5;
      }
      const rr = R * prof * (1 + rough);
      let lx = Math.cos(a) * rr, lz = Math.sin(a) * rr * ax;
      const c0 = Math.cos(rot), s0 = Math.sin(rot);
      const rx = lx * c0 - lz * s0, rz = lx * s0 + lz * c0;
      const ly = H * py;
      const lean2 = kind === 'spire' ? lean * R * py * py : 0;
      pos.setXYZ(i, x + rx + Math.cos(leanA) * lean2, ly, z + rz + Math.sin(leanA) * lean2);
      const streak = fbm(a * 22 + seed, py * 0.7, 2) * (0.7 + fl * 0.5);
      // near: greener; far: barer rock
      const gK = layer === 0 ? 1 : layer === 1 ? 0.8 : 0.6;
      const rockK = layer === 2 ? 1.08 : 1;
      const dark = 0.55 + fl * 0.6;   // striations: water-streaked flutes, darker in the grooves
      const c = green ? [0.06 + veg * 0.05 * gK, 0.12 * gK + veg * 0.07, 0.05] : [(0.24 + streak * 0.2) * rockK * dark, (0.24 + streak * 0.18) * rockK * dark, (0.23 + streak * 0.13) * rockK * dark];
      col.set(c, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    // grounded: the foot sits below the lowest ground anywhere under the footprint, and reaches down into it
    let lo = heightAt(x, z);
    for (let k = 0; k < 10; k++) { const aa = k / 10 * Math.PI * 2; lo = Math.min(lo, heightAt(x + Math.cos(aa) * R * 1.3, z + Math.sin(aa) * R * 1.3)); }
    const base = lo - (kind === 'hill' ? 30 : 55);
    g.translate(0, base, 0);
    geos.push(g);
    return base;
  };
  const massif = (cx, cz, scale, layer, seed) => {
    const q = rng(Math.floor(seed * 977) + 3);
    const mainH = scale * q.range(0.85, 1.15), mainR = mainH * q.range(0.2, 0.28);
    const peaks = [[cx, cz, mainR, mainH]];
    const n = 2 + Math.floor(q() * 4);
    for (let i = 0; i < n; i++) {
      const a = q() * 6.28, d = mainR * q.range(1.0, 2.4);
      const h = mainH * q.range(0.32, 0.86), rr = h * q.range(0.2, 0.34);
      peaks.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d, rr, h]);
    }
    let reach = 0;
    peaks.forEach(([x, z, R, H], i) => {
      const base = piece(x, z, R, H, seed * 10 + i, 'spire', layer);
      if (i === 0 && layer < 2) tops.push(new THREE.Vector3(x, base + H * 0.96, z));
      reach = Math.max(reach, Math.hypot(x - cx, z - cz) + R);
    });
    // ridges joining the main spire to its neighbours
    for (let i = 1; i < peaks.length; i++) {
      const [x0, z0] = peaks[0], [x1, z1, , h1] = peaks[i];
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0);
      piece(mx, mz, len * 0.62, Math.min(mainH, h1) * q.range(0.32, 0.5), seed * 10 + 20 + i, 'ridge', layer, Math.atan2(z1 - z0, x1 - x0), 0.38);
    }
    // the wooded skirt burying the feet
    piece(cx, cz, reach * 1.35, mainH * q.range(0.16, 0.24), seed * 10 + 40, 'hill', layer);
  };
  // [distance band, count, height scale, layer]; the street looks north: keep the near layer out of that sector
  const layers3 = [[[600, 860], 7, 310, 0], [[1100, 1500], 8, 520, 1], [[1800, 2400], 9, 760, 2]];
  for (const [[d0, d1], count, sc, layer] of layers3) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r.range(-0.25, 0.25) + layer * 0.4;
      const north = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.6;  // a ≈ -π/2: -z
      if (layer === 0 && north) continue;
      const dd = r.range(d0, d1);
      const x = Math.cos(a) * dd, z = Math.sin(a) * dd - 40;
      // south-west of the valley is where the storm comes up and the star falls (seen from the pines): keep the
      // mountains there lower so the sky above them is the stage
      const sw = smoothstep(-200, -900, x) * smoothstep(-300, 400, z);
      massif(x, z, sc * r.range(0.8, 1.2) * (1 - sw * [0.5, 0.38, 0.25][layer]), layer, r() * 100 + i);
    }
  }
  // the western mountains the storm and the falling star come over (south-west of the valley, seen from the pines)
  massif(-1050, 640, 190, 0, 71.3);
  massif(-1700, 1500, 330, 1, 72.9);
  {
    const NR = 26, NA = 160, pos = [], col = [], idx = [];
    for (let j = 0; j < NR; j++) {
      const rr = 260 * Math.pow(3500 / 260, j / (NR - 1));
      for (let i = 0; i < NA; i++) {
        const a = i / NA * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr - 120;
        // inside the valley it hides under the terrain mesh; outside, rolling wooded hills
        const inside = Math.abs(x) < 330 && z > -610 && z < 290;
        const y = heightAt(x, z) - (inside ? 6 : 1) + (fbm(x * 0.004 + 9, z * 0.004, 3) - 0.5) * 50 * smoothstep(400, 900, rr);
        pos.push(x, y, z);
        const v = fbm(x * 0.012, z * 0.012, 3);
        col.push(0.05 + v * 0.05, 0.085 + v * 0.06, 0.045 + v * 0.02);
      }
    }
    for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NA; i++) {
      const a0 = j * NA + i, a1 = j * NA + (i + 1) % NA, b0 = a0 + NA, b1 = a1 + NA;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    ground.name = 'far-ground';
    group.add(ground);
  }
  const merged = mergeAll(geos);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false, color: 0x8e979a });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uNoise = U.uNoise;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW; varying vec3 vKN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvKW = (modelMatrix * vec4(transformed, 1.)).xyz; vKN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW; varying vec3 vKN; uniform sampler2D uNoise;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        // limestone: vertical flutes and dark seams; green on ledges, crowns and the scree
        float wx = abs(vKN.x) / (abs(vKN.x) + abs(vKN.z) + 1e-3);
        vec2 sa = vec2(vKW.z * .021, vKW.y * .0032), sb = vec2(vKW.x * .021 + .5, vKW.y * .0032);
        float fa = texture2D(uNoise, sa).r * .6 + texture2D(uNoise, sa * vec2(3.1, 1.7) + .37).g * .4;
        float fb = texture2D(uNoise, sb).r * .6 + texture2D(uNoise, sb * vec2(3.1, 1.7) + .37).g * .4;
        float fl = clamp((mix(fb, fa, wx) - .5) * 2.6 + .5, 0., 1.);
        float seam = smoothstep(.36, .2, fl);
        float up = clamp(vKN.y, 0., 1.);
        float veg = smoothstep(.45, .7, up + (texture2D(uNoise, vKW.xz * .011).a - .5) * .7);
        diffuseColor.rgb *= .55 + fl * .8;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .3, seam * (1. - veg));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.075, .12, .05) * (.8 + fl * .5), veg * .85);
      }`);
  };
  mat.customProgramCacheKey = () => 'cf-karst';
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'mountains';
  group.add(mesh);

  // far ink-wash ranges: unlit layered silhouettes
  const layers = [];
  const layerMat = (seed, dist, height) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uCol: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uSeed: { value: seed }, uH: { value: height }, uNoise: U.uNoise, uMist: { value: 0.5 } },
    vertexShader: `varying vec2 vUv; varying float vY; void main(){ vUv=uv; vY=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uCol,uTop; uniform float uSeed,uH,uMist; uniform sampler2D uNoise; varying vec2 vUv; varying float vY;
void main(){
  float x=vUv.x*6.2831*3.+uSeed;
  float ridge=.42+.22*sin(x*1.3)+.12*sin(x*3.7+uSeed)+.07*sin(x*9.1)+ (texture2D(uNoise,vec2(vUv.x*4.,uSeed)).r-.5)*.35;
  float peaks=pow(max(0.,sin(x*2.2+uSeed*2.)),18.)*.35;
  ridge+=peaks;
  float a=1.-smoothstep(ridge-.004,ridge+.004,vUv.y);
  float wash=smoothstep(0.,ridge,vUv.y);
  vec3 c=mix(uCol,uTop,wash);
  float mist=smoothstep(.0,.35,vUv.y)*uMist;
  c=mix(uCol*1.2,c,mist+.3);
  gl_FragColor=vec4(c,a);
}`,
  });
  [[2750, 300, 1], [3000, 380, 2], [3250, 460, 3]].forEach(([dist, h, i]) => {
    const g = new THREE.CylinderGeometry(dist, dist, h, 128, 1, true);
    g.translate(0, h / 2 - 40, 0);
    const m = new THREE.Mesh(g, layerMat(i * 7.3, dist, h));
    m.name = 'range-' + i;
    group.add(m);
    layers.push(m);
  });
  layers.reverse().forEach((m, k) => (m.renderOrder = -9 + k));
  return { group, peaks: mesh, layers, tops };
}

function mergeAll(list) {
  const pos = [], nor = [], col = [], idx = [];
  let off = 0;
  for (const g of list) {
    const p = g.attributes.position.array, n = g.attributes.normal.array, c = g.attributes.color.array, id = g.index.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); col.push(c[i]); }
    for (let i = 0; i < id.length; i++) idx.push(id[i] + off);
    off += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}

// Soft mist sheets lying in the valley and between the ranges; they drift and take the light of the moment.
export function createMist() {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uCol: { value: new THREE.Color(0.9, 0.9, 0.88) }, uAlpha: { value: 0.5 }, uNoise: U.uNoise, uTime: U.uTime, uGlow: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCol,uGlow; uniform float uAlpha,uTime; uniform sampler2D uNoise; varying vec2 vUv; varying vec3 vW;
void main(){
 vec2 p=vW.xz;
 float n=texture2D(uNoise,p*.0022+vec2(uTime*.002,0.)).r*.65+texture2D(uNoise,p*.007-vec2(uTime*.003,0.)).g*.35;
 n+=texture2D(uNoise,p*.019+vec2(0.,uTime*.004)).a*.18-.09;
 float edge=smoothstep(0.,.25,vUv.x)*smoothstep(1.,.75,vUv.x)*smoothstep(0.,.25,vUv.y)*smoothstep(1.,.75,vUv.y);
 float a=smoothstep(.35,.8,n)*edge*uAlpha;
 float gl=exp(-pow(length(p-vec2(2.,30.))/160.,2.));
 gl_FragColor=vec4(uCol+uGlow*gl*(.6+n),a);
}`,
  });
  const sheets = [[0, 6, -330, 900, 380], [0, 22, -470, 1200, 300], [-300, 14, 60, 400, 600], [300, 14, 60, 400, 600], [0, 30, 330, 900, 300]];
  for (const [x, y, z, w, d] of sheets) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 5;
    group.add(m);
  }
  return { group, material: mat };
}
