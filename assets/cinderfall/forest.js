// The Forbidden Forest (world B): the set (forest-set.js) and what happens in it, as pure functions of u.
// Out of the painting the eye comes down through the snowy pines to the clearing as he comes out of the trees and sinks
// down against the boulder. The first winter at the camp; then six winters at the pale tree: each winter he draws his
// knife down its bark (close on the blade and the chips), and the year turns round the tree while the camp grows past
// it, a year older each time; in the sixth autumn he lays his hand on the six cuts and turns away. No game near the camp,
// not one track, as if by fate: he goes farther than he ever has — a shot to each stretch of the way, cut straight from
// one to the next: over the ford, through the bamboo, into the old wood where the air begins to glow — until the motes
// of gold gather into streams and lead him down into the dell of the ancient tree. There, sealed in crystal among the
// roots for six years, what fell from the sky the night his village burned has waited for him; as it opens in his hands
// he looks up: the light gathers in the crown of the great tree, sends a thread of itself down to him, and a pillar of
// light comes down out of the sky onto him, throwing a ring of light out over the dell and the leaves up off its floor.
import * as THREE from 'three';
import { U } from './materials.js';
import { buildForestSet } from './forest-set.js';
import { createBow, createScroll } from './relic.js';
import { createGoldTrail } from './trail.js';
import { createQi } from './qi.js';
import { createBeam } from './beam.js';
import { createLeafBlast } from './blast.js';
import { cam, forest as FT, CUTS, STRIKE_B } from './timeline.js';
import { clamp, lerp, smooth, band } from './util.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const flatDir = (a, b) => { const d = b.clone().sub(a).setY(0); return d.lengthSq() > 1e-8 ? d.normalize() : V3(0, 0, 1); };
const yawLerp = (a, b, t) => { const ya = Math.atan2(a.x, a.z); let d = Math.atan2(b.x, b.z) - ya; d = Math.atan2(Math.sin(d), Math.cos(d)); const y = ya + d * t; return V3(Math.sin(y), 0, Math.cos(y)); };
const rightOf = h => V3().crossVectors(h, UP).normalize();
const slerpDir = (a, b, w) => {
  const ang = Math.acos(clamp(a.dot(b), -1, 1));
  if (ang < 1e-4 || w <= 0) return a.clone();
  if (w >= 1) return b.clone();
  const s0 = Math.sin((1 - w) * ang) / Math.sin(ang), s1 = Math.sin(w * ang) / Math.sin(ang);
  return a.clone().multiplyScalar(s0).addScaledVector(b, s1).normalize();
};

// The journey in shots: [u0, u1, metres along the way at u0, at u1, kind]. One shot to each stretch of the way, cut
// straight from one to the next (the hours between are not shown): the empty snare; out of the camp's woods, farther
// than ever; over the ford; through the bamboo; into the old wood, where the air begins to glow; after the streams of
// light toward the falls; to the rim of the dell; down into it.
const STAGES = [
  [124.6, 125.9, 0, 6, 'snare'],
  [125.9, 127.0, 23, 32, 'leave'],
  [127.0, 128.05, 150.5, 161.5, 'ford'],
  [128.05, 129.1, 213, 222, 'thicket'],
  [129.1, 130.45, 274.5, 283.5, 'oldwood'],
  [130.45, 131.65, 360, 370.5, 'streams'],
  [131.65, 132.3, 396.6, 401.8, 'rim'],
  [132.3, 133.3, 401.8, 413.5, 'slide'],
];
const CAM_BACK = 3.0;
// the pillar of light: the cut to the lens looking up the tree as he looks up; (the strike, STRIKE_B, cuts across the
// dell); the cut back over his shoulder, down into the page
const UP_CUT = 139.22, WIDE_CUT = 139.6, BACK_CUT = 139.95;

export async function buildForest(mats, quality, ctx) {
  const set = await buildForestSet(mats, quality, { renderer: ctx.renderer, gate: ctx.gate || null });
  const root = set.root;
  root.name = 'forestB';
  const A = set.anchors, hB = set.heightAt;
  const G = (x, z, dy = 0) => V3(x, hB(x, z) + dy, z);
  const onG = p => V3(p.x, hB(p.x, p.z), p.z);
  const path = pts => new THREE.CatmullRomCurve3(pts.map(onG), false, 'centripetal');
  const J = A.journey;
  const jAt = s => J.at(clamp(s, 0, J.length));

  // ------------------------------------------------------------ the camp
  const face = A.rockFace;
  const ROCKSIT = onG(face.center.clone().addScaledVector(face.normal, 0.5));
  const rockOut = face.normal.clone().setY(0).normalize();
  const ARRIVE = path([V3(-13.5, 0, -36), V3(-8.5, 0, -19), V3(-4, 0, -9), V3(0.6, 0, -4.4), ROCKSIT]);
  // ------------------------------------------------------------ the tally: six cuts in the pale bark, one each winter
  // (on the side of the tree away from the camp, so the eye that watches him cut them looks past the tree at the camp
  // growing through the years: the fire, the shelter against the rock, the hut, his uncle's stone)
  const TALLY = A.TALLY.clone();
  const tGy = hB(TALLY.x, TALLY.z);
  const tn = flatDir(V3(-1.5, 0, -4.75), TALLY);           // the way the cuts face (away from the camp)
  const tFace = tn.clone().negate();                        // the way he faces as he cuts
  const tRight = rightOf(tFace);                            // his right as he faces the tree
  const TRUNK_R = 0.238;
  // the trunk's axis at a height above the ground (it leans a little)
  const trunkAt = h => V3(TALLY.x + 0.05 * (h + 0.3) / 4, tGy + h, TALLY.z + 0.04 * (h + 0.3) / 4);
  const tA = Math.atan2(tn.x, tn.z);
  const cuts = CUTS.map((C, i) => {
    const a = tA + (i - 2.5) * 0.175, n = V3(Math.sin(a), 0, Math.cos(a));
    // (a little higher each year: he was growing)
    const hc = 1.15 + i * 0.017 + ((i * 7) % 3 - 1) * 0.008, H = 0.21 + ((i * 5) % 3) * 0.012;
    const at = h => trunkAt(h).addScaledVector(n, TRUNK_R + 0.009);
    const top = at(hc + H / 2), bottom = at(hc - H / 2), mid = at(hc);
    // where he stands for it (the cut a little right of his middle, so his right hand is at it), a little taller each year
    const stand = onG(TALLY.clone().addScaledVector(tn, 0.56).addScaledVector(tRight, tRight.dot(n) * TRUNK_R - 0.5));
    return { C, i, a, n, hc, H, top, bottom, mid, stand };
  });
  const sixMid = trunkAt(1.2).addScaledVector(tn, TRUNK_R + 0.03);
  const TALLYSTAND = cuts[5].stand.clone();
  // his left palm braced on the trunk beside the cuts
  const braceAt = trunkAt(1.42).addScaledVector(V3(Math.sin(tA - 0.95), 0, Math.cos(tA - 0.95)), TRUNK_R + 0.035);
  // the empty snare, beside the way just out of camp (round the tree from where he stands, and on toward the way)
  const SNARE = jAt(6);
  const snareSpot = SNARE.pos.clone().addScaledVector(rightOf(SNARE.dir), -0.75);
  // (after each cut: back round the tree toward the camp)
  const BACK_WAY = path([TALLY.clone().addScaledVector(tn, 0.6), TALLY.clone().addScaledVector(tRight, 1.15).addScaledVector(tn, 0.3), TALLY.clone().addScaledVector(tRight, 1.1).addScaledVector(tn, -1.5), V3(-1.6, 0, 1.4)]);
  const TO_SNARE = path([TALLYSTAND, TALLY.clone().addScaledVector(tRight, 1.15).addScaledVector(tn, 0.35), TALLY.clone().addScaledVector(tRight, 1.2).addScaledVector(tn, -1.6), SNARE.pos]);

  // ------------------------------------------------------------ the dell
  const LAND = A.LAND.clone();
  const SCROLL = A.scrollPose.position.clone();
  const TOUCH = (A.crystalTouch || SCROLL).clone();
  const toLand = flatDir(SCROLL, LAND);
  const KNEEL = onG(SCROLL.clone().addScaledVector(toLand, 1.08));
  const APPROACH = path([LAND, LAND.clone().lerp(KNEEL, 0.5).addScaledVector(V3().crossVectors(UP, toLand), 0.6), KNEEL]);
  const TA = A.treeAnchors;
  const crownAt = A.ANCIENT.clone().add(V3(0, 14, 0));

  // ------------------------------------------------------------ the gold thread down into the dell (the descent)
  const trailB = createGoldTrail([V3(-420, 760, -560), V3(-330, 420, -440), V3(-288, 150, -370), V3(-266, 34, -334), SCROLL.clone().add(V3(0, 0.25, 0))], { width: 16, intensity: 8, head: 2.2 });
  root.add(trailB.mesh);

  // ------------------------------------------------------------ qi: far streams and near motes
  const qiFar = createQi({ count: quality.low ? 1300 : 2400, size: 0.2, seed: 11 });
  const qiNear = createQi({ count: quality.low ? 400 : 800, size: 0.075, seed: 23, intensity: 2.6 });
  root.add(qiFar.points, qiNear.points);

  // ------------------------------------------------------------ his bow (in his hand on the way, on his back from the rim)
  const bow = createBow();
  const bowBack = createBow();
  root.add(bow.group, bow.arrow);
  bow.arrow.visible = false;
  let bowMounted = false;

  // ------------------------------------------------------------ the cuts: drawn down the bark as the knife goes, pale fresh wood
  // greying over the years (a V groove: one face to the light, one in shadow, a dark seam where they meet, the torn lip
  // of the bark along its edges)
  const notchMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  const notchGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
  const notches = cuts.map(c => {
    const m = notchMat.clone();
    const uni = { uProg: { value: 0 }, uFresh: { value: 1 }, uSeed: { value: c.i * 0.137 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uni, { uNoise: U.uNoise });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vNUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvNUv = uv;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vNUv; uniform float uProg, uFresh, uSeed; uniform sampler2D uNoise;`)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );
  {
    vec2 q = vec2(vNUv.x * 2. - 1., 1. - vNUv.y);
    float n1 = texture2D(uNoise, vec2(q.y * 2.3 + uSeed, .31 + uSeed)).r, n2 = texture2D(uNoise, vec2(q.y * 7.1 + uSeed, .71)).g;
    // a long lens, ragged where the bark tore, sharper at the end the knife finished
    float hw = pow(max(sin(3.1416 * clamp(q.y, 0., 1.)), 0.), mix(.45, .7, q.y)) * (.8 + .32 * (n1 - .5) + .12 * (n2 - .5));
    if (abs(q.x) > hw || q.y > uProg) discard;
    float sd = q.x / max(hw, 1e-3);
    vec3 fresh = vec3(1., .9, .66), old = vec3(.5, .44, .36);
    vec3 wood = mix(old, fresh, uFresh);
    // the face toward the light, the face in shadow, the seam
    wood *= mix(1.15, .5, smoothstep(-.3, .4, sd));
    wood = mix(wood, vec3(.1, .07, .05), smoothstep(.22, .03, abs(sd)) * .95);
    // the bark's torn lip, the grain of the wood, the knife marks across it
    wood = mix(wood, vec3(.16, .11, .08), smoothstep(.62, .97, abs(sd)) * .85);
    wood *= .86 + .22 * texture2D(uNoise, vec2(vNUv.x * 1.3 + uSeed, vNUv.y * 9.)).b;
    wood *= .94 + .08 * sin(q.y * 70. + n1 * 6.);
    // the end the blade is at, fresh and bright
    wood += vec3(.12, .1, .06) * exp(-(uProg - q.y) * 40.) * step(uProg, .999) * uFresh;
    diffuseColor.rgb = wood;
  }`)
        // (marked like a figure, so the ink draws it from its own light, outlined, and the painted pass leaves it alone:
        // small as it is, it is what the eye is on)
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a = 1.1;');
    };
    m.customProgramCacheKey = () => 'cf-notch';
    const mesh = new THREE.Mesh(notchGeo, m);
    mesh.scale.set(0.046, c.H, 1);
    mesh.position.copy(c.mid);
    mesh.lookAt(c.mid.clone().add(c.n));
    mesh.receiveShadow = true;
    mesh.visible = false;
    root.add(mesh);
    return { mesh, uni };
  });
  // his knife (the one he cuts them with): a short blade, a bound grip
  const knife = new THREE.Group();
  {
    const steel = new THREE.MeshStandardMaterial({ color: 0xdfe2e6, metalness: 0.55, roughness: 0.3, emissive: 0x2a2c30 });
    const wrap = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.9 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.125, 0.026), steel);
    blade.position.set(0, -0.095, 0.002);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0135, 0.034, 4), steel);
    tip.rotation.set(Math.PI, 0, Math.PI / 4); tip.scale.set(0.35, 1, 1);
    tip.position.set(0, -0.174, 0.002);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.013, 0.1, 8), wrap);
    grip.position.set(0, 0.0, 0);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.034), wrap);
    guard.position.set(0, -0.052, 0.002);
    knife.add(blade, tip, grip, guard);
    knife.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  let knifeMounted = false;
  // the chips the knife throws out of the cut (a pure function of the story position: out, down into the snow, gone)
  const chips = (() => {
    const per = 36, N = per * cuts.length;
    const g = new THREE.BufferGeometry();
    const sd = new Float32Array(N * 4), kk = new Float32Array(N);
    let r = 991;
    const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) { sd.set([rnd(), rnd(), rnd(), rnd()], i * 4); kk[i] = Math.floor(i / per); }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
    g.setAttribute('aK', new THREE.BufferAttribute(kk, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const uniforms = { uU: { value: 0 }, uPx: { value: 900 }, uTop: { value: cuts.map(c => new THREE.Vector4(c.top.x, c.top.y, c.top.z, c.C)) },
      uBot: { value: cuts.map(c => new THREE.Vector4(c.bottom.x, c.bottom.y, c.bottom.z, tGy)) }, uN: { value: cuts.map(c => c.n.clone()) }, uR: { value: tRight.clone() }, uLight: { value: 1 } };
    const material = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec4 aSeed; attribute float aK; uniform float uU, uPx; uniform vec4 uTop[6], uBot[6]; uniform vec3 uN[6], uR; varying float vA, vS;
void main(){
  int k = int(aK + .5);
  vec4 T = uTop[k], Bt = uBot[k]; vec3 n = uN[k];
  // thrown out from where the blade was at that moment, as it went down the cut
  float f = aSeed.x, ts = T.w - .15 + f * .35;
  float t = (uU - ts) * 2.4;
  vec3 p0 = mix(T.xyz, Bt.xyz, f) + n * .01;
  vec3 v = n * (.55 + .9 * aSeed.y) + uR * (aSeed.z - .5) * 1.5 + vec3(0., .35 + .9 * aSeed.w, 0.);
  // (until it lands in the snow at the foot of the tree)
  float dy = p0.y - Bt.w;
  float tl = (v.y + sqrt(v.y * v.y + 19.6 * max(dy, 0.))) / 9.8;
  float tc = min(max(t, 0.), tl);
  vec3 p = p0 + v * tc + vec3(0., -4.9 * tc * tc, 0.);
  p.y = max(p.y, Bt.w + .01);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  vA = step(0., t) * (1. - smoothstep(tl + .4, tl + 2.2, t));
  vS = aSeed.w;
  gl_PointSize = clamp((.011 + .012 * aSeed.y) * uPx / max(-mv.z, .05), 1., 7.);
}`,
      fragmentShader: `varying float vA, vS; uniform float uLight;
void main(){
  vec2 q = gl_PointCoord - .5;
  // a flake: a little chip of pale wood, longer one way
  float r = length(q * vec2(1., 1.8 - vS));
  if (r > .5 || vA < .01) discard;
  vec3 c = mix(vec3(.93, .82, .6), vec3(.7, .58, .4), vS) * uLight;
  gl_FragColor = vec4(c, .9 * vA);
}`,
    });
    const pts = new THREE.Points(g, material);
    pts.frustumCulled = false;
    pts.visible = false;
    root.add(pts);
    return { pts, uniforms };
  })();

  // ------------------------------------------------------------ what fell from the sky: sealed in crystal, then in his hands
  const scroll = createScroll();
  root.add(scroll.group);
  // as it opens all the way in his hands: the pillar of light down out of the sky onto him and the page
  const beam = createBeam({ height: 150 });
  root.add(beam.group);
  const scrollRest = A.scrollPose.quaternion.clone();
  const scrollRestPos = SCROLL.clone();
  // where it comes through the leaves overhead; its ring over the dell's floor
  const CANOPY_H = 18;
  const ringAt = u => 2 + 26 * Math.pow(FT.beamRing(u), 0.6);
  // the leaves the ring tears up off the floor and the ones it shakes out of the crown
  const leafBlast = createLeafBlast({ center: onG(SCROLL), groundAt: hB, ringAt, u0: STRIKE_B, u1: STRIKE_B + 0.56, count: quality.low ? 300 : 560, crown: quality.low ? 90 : 180, radius: 9.5, crownH: [6, 15], avoid: [[A.ANCIENT.x, A.ANCIENT.z, 3.3]] });
  root.add(leafBlast.points);
  // what the engine needs of it each frame (its light on the lens: the flash, the shock, the beams through the leaves)
  const light = { foot: onG(SCROLL), canopy: onG(SCROLL).add(V3(0, CANOPY_H, 0)), gather: 0, beam: 0, strike: -1 };

  // ------------------------------------------------------------ time-lapse ghosts of the years at the camp
  const fireP = A.FIRE;
  // (the first winter by the fire; then, in the years the tally counts, beyond the tree while the year turns: building
  // against the rock, the bow, his strength, his uncle's stone once he has set it up)
  const [C1, C2, C3, C4, C5, C6] = CUTS;
  const ghostSpots = [
    { a: 112.55, b: 114.75, p: onG(fireP.clone().add(V3(-1.15, 0, 1.0))), face: fireP, kind: 'huddle' },
    { a: C1 + 0.3, b: C2 - 0.3, p: onG(face.center.clone().addScaledVector(face.normal, 1.15).add(V3(-0.8, 0, 0.5))), face: face.center, kind: 'build' },
    { a: C2 + 0.3, b: C3 - 0.3, p: onG(A.TARGET.clone().lerp(A.CAMP, 0.62)), face: A.TARGET, kind: 'archery' },
    { a: C3 + 0.3, b: C4 - 0.3, p: G(-2.6, 3.4), face: G(2.5, 4.2), kind: 'pushup' },
    { a: C4 + 0.3, b: C5 - 0.3, p: A.MEDITATE.clone(), face: A.MEDITATE.clone().addScaledVector(A.meditateGap, 4), kind: 'meditate' },
    { a: C5 + 0.3, b: C6 - 0.3, p: onG(A.MEMORIAL.clone().add(V3(0.75, 0, 1.05))), face: A.MEMORIAL, kind: 'mourn' },
  ];

  // ------------------------------------------------------------ the journey: where he is, where the camera is
  const stageAt = u => { for (let i = 0; i < STAGES.length; i++) { const [a, b] = STAGES[i]; if (u >= a && u <= b) return i; } return -1; };
  const stageS = (i, u) => { const [a, b, s0, s1] = STAGES[i]; return lerp(s0, s1, clamp((u - a) / (b - a))); };
  // where he is along the way (metres)
  function heroS(u) {
    if (u <= STAGES[0][0]) return STAGES[0][2];
    const i = stageAt(u);
    return i >= 0 ? stageS(i, u) : STAGES[STAGES.length - 1][3];
  }

  // ------------------------------------------------------------ camera paths
  // (out of the painting: just over the trees south-east of the clearing, the gold thread going down beyond it into the
  // forest; then down over the clearing in the falling snow to the boulder he comes to)
  const descent = new THREE.CatmullRomCurve3([V3(27, 8.5, 43), V3(19, 6.6, 31), V3(10.5, 5.0, 20), V3(3.6, 3.9, 12.8), V3(-2.6, 3.0, 9.2)], false, 'centripetal');
  const descentLook = new THREE.CatmullRomCurve3([V3(-150, 30, -230), V3(-80, 12, -120), V3(-16, 2, -36), V3(0.5, 1.3, -6), ROCKSIT.clone().add(V3(0, 0.75, 0))], false, 'centripetal');
  const campC = V3(0.4, 1.1, -1.4);

  // ------------------------------------------------------------ Wuhen here: pose state for the engine's 3D hero
  function wuhen(u) {
    const o = { P: null, heading: null, run: 0, speed: null, kneel: 0, draw: 0, release: 0, fall: 0, lie: 0, getUp: 0, hold: 0, holdWidth: 0, sit: 0, grief: 0, crouch: 0, reach: 0, reachTarget: null, gripL: null, gripR: null, lookAt: null, lookW: 1, age: 1, scale: 1, visible: true, fade: 1 };
    if (u < 112.9) {
      // arrival: out of the trees, through the snow, down against the boulder
      const k = FT.arrive(u);
      const w = clamp(k / 0.82);
      o.P = ARRIVE.getPointAt(w * 0.999);
      o.heading = w < 0.97 ? flatDir(o.P, ARRIVE.getPointAt(Math.min(1, w + 0.02))) : rockOut.clone();
      if (w > 0.85) o.heading = yawLerp(flatDir(ARRIVE.getPointAt(0.95), ROCKSIT), rockOut, smooth(0.85, 1, w));
      o.sit = smooth(0.84, 1, k);
      o.grief = smooth(0.6, 1, k) * 0.9;
      o.age = 0;
      o.speed = k < 0.82 ? 0.9 : 0;
      o.visible = u > 110.6;
      o.fade = 1 - smooth(112.45, 112.9, u);
      o.lookAt = u < 111.75 ? ROCKSIT.clone().add(V3(0, 1, 0)) : null;
      return o;
    }
    if (u < 124.6) {
      // the six winters at the tally tree: each winter he is at it (a year older), draws the knife down the bark, and
      // goes back round the tree to the camp while the year turns; the sixth time he stays, and in the sixth autumn lays
      // his hand on the six cuts and turns for the way out
      let k = 0;
      while (k < 5 && u > CUTS[k] + 0.8) k++;
      const cut = cuts[k], C = cut.C, last = k === 5;
      o.age = k / 5;
      o.speed = 0;
      o.P = cut.stand.clone();
      o.heading = tFace.clone();
      // (from the cut in to the eye until he is out of sight behind the tree on his way back to the camp)
      o.visible = u > C - 0.4 && (last || u < C + 0.9);
      o.fade = last ? 1 : 1 - smooth(C + 0.8, C + 0.9, u);
      // the knife: up to the top of the cut, drawn down it, away
      const down = smooth(C - 0.15, C + 0.2, u);
      o.carve = band(C - 0.38, C - 0.2, C + 0.2, C + 0.34, u);
      o.carveTarget = cut.top.clone().lerp(cut.bottom, down).addScaledVector(cut.n, 0.04).addScaledVector(tRight, -0.012).add(V3(0, 0.125, 0)).add(V3(0, 0.02 * Math.sin(u * 90) * band(C - 0.15, C - 0.1, C + 0.15, C + 0.2, u), 0));
      o.braceTarget = braceAt.clone();
      o.gripR = o.carve > 0.05 ? 'rod' : null;
      o.lookAt = cut.mid.clone();
      o.lookW = 1 - smooth(C + 0.25, C + 0.4, u) * (last ? 0 : 1);
      if (!last && u > C + 0.42) {
        // back round the tree toward the camp
        const t = smooth(C + 0.42, C + 0.9, u);
        o.P = cut.stand.clone().lerp(BACK_WAY.getPointAt(Math.min(t, 0.999)), smooth(0, 0.08, t));
        o.heading = flatDir(o.P, BACK_WAY.getPointAt(Math.min(1, t + 0.06)));
        if (t < 0.1) o.heading = yawLerp(tFace, o.heading, t / 0.1);
        o.speed = 1.2;
      }
      if (last) {
        // (the sixth autumn: his palm on the six; then he turns from the tree for the way out)
        o.palm = band(123.66, 123.9, 124.08, 124.25, u);
        o.palmTarget = sixMid.clone().addScaledVector(tn, 0.012);
        o.lookAt = sixMid.clone();
        o.lookW = 1 - smooth(124.05, 124.4, u);
        o.heading = yawLerp(tFace, flatDir(TALLYSTAND, TO_SNARE.getPointAt(0.12)), smooth(124.18, 124.6, u));
      }
      return o;
    }
    if (u < 133.3) {
      o.gripL = u > 125.9 && u < 132.0 ? 'bow' : null;
      const i = Math.max(0, stageAt(u));
      const [a, b, , , kind] = STAGES[i];
      o.fade = 1;
      if (kind === 'snare') {
        // to the snare by the way: he crouches, looks — nothing; stands
        const t = smooth(124.6, 125.15, u);
        o.P = t < 1 ? TO_SNARE.getPointAt(t) : SNARE.pos.clone();
        o.heading = t < 0.98 ? flatDir(o.P, TO_SNARE.getPointAt(Math.min(1, t + 0.03))) : SNARE.dir.clone();
        o.speed = t > 0 && t < 1 ? 1.25 : 0;
        o.crouch = band(125.15, 125.35, 125.6, 125.8, u);
        o.reach = o.crouch * 0.8;
        o.reachTarget = snareSpot.clone().add(V3(0, 0.05, 0));
        o.lookAt = snareSpot.clone();
        o.lookW = o.crouch;
        return o;
      }
      const s = stageS(i, u);
      const w = jAt(s);
      o.P = w.pos;
      o.heading = w.dir.clone();
      o.speed = kind === 'slide' ? 0 : kind === 'ford' ? 1.15 : 1.3;
      // (in the old wood he looks up at the giants as he goes; after the streams, ahead where they go)
      if (kind === 'oldwood') { o.lookAt = w.pos.clone().addScaledVector(w.dir, 6).add(V3(0, 4.5, 0)); o.lookW = 0.6 * band(129.5, 129.8, 130.1, 130.4, u); }
      if (kind === 'streams') { o.lookAt = w.pos.clone().addScaledVector(w.dir, 10).add(V3(0, 1.8, 0)); o.lookW = 0.5 * smooth(130.6, 130.9, u); }
      if (kind === 'rim') {
        // at the rim he stops: below, the streams of light go down into the dell
        o.speed = 1.2 * (1 - smooth(131.95, 132.15, u));
        o.lookAt = A.DELL.clone().add(V3(0, 2, 0));
        o.lookW = smooth(131.9, 132.15, u);
      }
      if (kind === 'slide') { o.crouch = 0.55 * band(132.3, 132.45, 133.0, 133.3, u); o.lookAt = SCROLL.clone(); o.lookW = smooth(132.9, 133.3, u); }
      return o;
    }
    // the dell: he stands in the leaves and looks up at it; goes to it; kneels; touches the crystal; it breaks
    const t = FT.approach(u);
    o.P = t > 0 ? APPROACH.getPointAt(t) : LAND.clone();
    o.heading = t <= 0 ? flatDir(LAND, SCROLL) : t < 0.98 ? flatDir(o.P, APPROACH.getPointAt(Math.min(1, t + 0.03))) : flatDir(KNEEL, SCROLL);
    if (t > 0.85) o.heading = yawLerp(o.heading, flatDir(KNEEL, SCROLL), smooth(0.85, 1, t));
    o.speed = t > 0 && t < 1 ? 1.1 : 0;
    o.lookAt = u < 134.4 ? crownAt.clone() : SCROLL.clone();
    o.lookW = u < 134.4 ? band(133.3, 133.6, 134.0, 134.4, u) : 1;
    o.kneel = smooth(136.0, 136.6, u);
    // his right hand on the crystal while it cracks; then down for the scroll it leaves
    const touch = band(136.35, 136.7, 137.15, 137.45, u);
    const take = band(137.75, 137.95, 138.2, 138.4, u);
    o.reach = Math.max(touch, take);
    o.reachTarget = touch > take ? TOUCH.clone() : SCROLL.clone().add(V3(0, 0.03, 0));
    o.hold = smooth(138.15, 138.45, u);
    o.holdWidth = lerp(0.34, 0.72, smooth(138.45, 139.15, u));
    if (o.hold > 0.5) { o.gripL = 'rod'; o.gripR = 'rod'; o.lookAt = null; }
    // as it opens all the way, the light it wakes goes up out of the page and he looks up after it, into the leaves
    // overhead, where it gathers; then down at the page again in the pillar of light
    const up = smooth(139.02, 139.2, u) * (1 - smooth(139.8, 139.95, u));
    if (up > 0) { o.lookAt = light.canopy.clone(); o.lookW = up; o.lookUp = up; }
    // the gust as it strikes: hair and sash thrown back from it, then a wind rising up round him in the light
    const gust = band(STRIKE_B - 0.005, STRIKE_B + 0.01, STRIKE_B + 0.12, STRIKE_B + 0.4, u), rise = smooth(139.25, 139.42, u) * (1 - smooth(140.2, 140.8, u));
    if (gust + rise > 0.01) o.wind = flatDir(SCROLL, KNEEL).multiplyScalar(7 * gust).add(V3(0, 2.6 * rise + 3 * gust, 0)).addScaledVector(rightOf(flatDir(KNEEL, SCROLL)), 0.8 * rise);
    return o;
  }

  // ------------------------------------------------------------ the ghosts: [{ i, P, heading, kind, fade, age, reachTarget }]
  function ghosts(u) {
    const out = [];
    ghostSpots.forEach((g, i) => {
      const k = band(g.a, g.a + 0.28, g.b - 0.28, g.b, u);
      if (k <= 0.01) return;
      const P = g.p.clone();
      out.push({ i, P, heading: flatDir(P, g.face), kind: g.kind, fade: k * 0.86, age: clamp((u - 112.6) / 10.6), reachTarget: g.kind === 'build' ? face.center.clone().add(V3(0, 0.9, 0)) : null });
    });
    return out;
  }

  // ------------------------------------------------------------ the shots that belong to this place
  // the shots of the way out (between the snare and the rim)
  function wayShot(i, u) {
    const [a, b, s0, s1, kind] = STAGES[i];
    const k = clamp((u - a) / (b - a));
    const w = jAt(lerp(s0, s1, k)), P = w.pos, d = w.dir, r = rightOf(d);
    const cp = V3(), lk = V3();
    if (kind === 'leave') {
      // (the lens stays where it is: he walks away from it, out of the woods he knows, smaller and smaller)
      const w0 = jAt(s0 - 1.4);
      cp.copy(w0.pos).addScaledVector(w0.dir, -2.2).addScaledVector(rightOf(w0.dir), 0.6).add(V3(0, 1.55, 0));
      lk.copy(P).addScaledVector(d, 3).add(V3(0, 1.1, 0));
    } else if (kind === 'ford') {
      // (low by the water off his left shoulder: the stream across the frame, the stones, the far bank)
      cp.copy(P).addScaledVector(d, -2.1).addScaledVector(r, -2.9).add(V3(0, 0.55, 0));
      lk.copy(P).addScaledVector(d, 2.6).addScaledVector(r, 0.4).add(V3(0, 0.95, 0));
    } else if (kind === 'thicket') {
      // (beside him and a little behind, through the bamboo, the stems going by between)
      // (low behind him, down the way between the culms into the mist)
      cp.copy(P).addScaledVector(d, -2.7).addScaledVector(r, 0.55).add(V3(0, 0.95, 0));
      lk.copy(P).addScaledVector(d, 6).add(V3(0, 1.6, 0));
    } else if (kind === 'oldwood') {
      // (low behind him, looking up the giants, the air beginning to hold light)
      cp.copy(P).addScaledVector(d, -3.3).addScaledVector(r, 0.75).add(V3(0, 0.6, 0));
      lk.copy(P).addScaledVector(d, 6).add(V3(0, 3.0, 0));
    } else {
      // (up behind him: the motes running together into streams ahead of him, toward the falls)
      cp.copy(P).addScaledVector(d, -2.3).addScaledVector(r, 0.7).add(V3(0, 1.15, 0));
      lk.copy(P).addScaledVector(d, 7).add(V3(0, 2.4, 0));
    }
    cp.y = Math.max(cp.y, hB(cp.x, cp.z) + 0.4);
    return { cp, lk };
  }
  const xuanAt = V3(), xuanN = V3(0, 1, 0);
  function shots(u, pos, look) {
    // the descent: out of the white over the basin, down the gold thread, into the clearing where he arrives
    const dw = cam.descent(u);
    if (dw > 0) {
      const t = smooth(109.6, 112.3, u);
      const e = 1 - Math.pow(1 - t, 1.35);
      pos.lerp(descent.getPointAt(e), dw);
      look.lerp(descentLook.getPointAt(e), dw);
    }
    // the first winter: a slow arc round the camp in the snow, coming round to the tally tree
    const yw = cam.years(u);
    if (yw > 0) {
      const t = smooth(112.3, 114.95, u);
      const th = lerp(0.95, -0.42, t), rr = lerp(11.5, 8.6, t), hh = lerp(5.4, 2.6, t);
      const o = V3(campC.x + Math.sin(th) * rr, 0, campC.z + Math.cos(th) * rr);
      o.y = hB(o.x, o.z) + hh;
      pos.lerp(o, yw);
      look.lerp(campC.clone().add(V3(0, lerp(0.2, 0.0, t), 0)), yw);
    }
    // the tally: wide on the tree and the camp past it while the year turns; for each cut, a cut in close to the bark,
    // the knife going down it and the chips flying, his fist coming in from the side (never his face); out again as he
    // goes; the last time, behind him at the tree while the year turns round him, his hand on the six
    const tw = cam.tally(u);
    if (tw > 0) {
      let k = 0;
      while (k < 5 && u > CUTS[k] + 0.8) k++;
      const cut = cuts[k], C = cut.C, last = k === 5;
      const yr = clamp((u - 114.3) / (CUTS[5] - 114.3));
      let cp, lk;
      if (u > C - 0.38 && u < C + 0.42) {
        // (in close: the cut in the middle of the frame, a little from his right, the earlier cuts beside it)
        // (across the bark from his right, low against it: the blade biting in, the chips coming toward the eye)
        const drift = smooth(C - 0.38, C + 0.42, u);
        cp = cut.mid.clone().addScaledVector(tn, lerp(0.74, 0.8, drift)).addScaledVector(tRight, lerp(0.26, 0.3, drift)).add(V3(0, lerp(0.22, 0.19, drift), 0));
        lk = cut.mid.clone().addScaledVector(tRight, -0.05).add(V3(0, -0.03, 0));
      } else if (last) {
        // (the last: behind him and off his right shoulder, the tree before him, while the year turns round him to the
        // sixth autumn and his hand comes to rest on the six cuts)
        const fin = smooth(C + 0.42, 124.15, u);
        cp = TALLYSTAND.clone().addScaledVector(tn, lerp(2.1, 1.45, fin)).addScaledVector(tRight, lerp(1.05, 0.82, fin)).add(V3(0, lerp(1.72, 1.6, fin), 0));
        lk = sixMid.clone().addScaledVector(tRight, 0.05).add(V3(0, 0.06, 0));
      } else {
        // (out: the whole tree and the camp past it, a little further round each year, drifting)
        const sw = V3().copy(tn).applyAxisAngle(UP, lerp(0.34, -0.1, yr) + 0.05 * Math.sin(u * 1.7));
        cp = trunkAt(0).addScaledVector(sw, 4.4 - 0.25 * smooth(C - 1.1, C - 0.4, u)).add(V3(0, 2.05, 0));
        lk = trunkAt(1.25).addScaledVector(tn, -2.6).add(V3(0, -0.15, 0));
      }
      pos.lerp(cp, tw);
      look.lerp(lk, tw);
    }
    // the journey: a shot to each stretch of the way, cut straight from one to the next
    const jw = smooth(124.35, 124.75, u) * (1 - smooth(133.05, 133.45, u));
    if (jw > 0) {
      const i = Math.max(0, stageAt(u));
      const kind = STAGES[i][4];
      let cp, lk;
      if (kind === 'snare' || kind === 'rim' || kind === 'slide') {
        const sc = heroS(u) - CAM_BACK;
        const c = jAt(sc), ahead = jAt(sc + CAM_BACK + 8);
        const side = rightOf(c.dir);
        const rim = band(131.8, 132.1, 132.35, 132.7, u);
        cp = c.pos.clone().addScaledVector(side, 0.65).add(V3(0, 1.62 + rim * 1.6, 0));
        // in the snare beat the camera stays nearer and lower, at his side
        const sn = band(125.12, 125.38, 125.62, 125.82, u);
        if (sn > 0) cp.lerp(snareSpot.clone().addScaledVector(SNARE.dir, -1.6).addScaledVector(rightOf(SNARE.dir), 1.4).add(V3(0, 1.25, 0)), sn);
        lk = ahead.pos.clone().add(V3(0, 1.15, 0));
        lk.lerp(A.DELL.clone().add(V3(0, 3, 0)), rim);
        // first: behind him and off his right shoulder as he turns from the tally and goes round the tree and out to
        // the snare (his face is never seen), the way ahead of him
        const ap = band(124.3, 124.62, 125.15, 125.38, u);
        if (ap > 0) {
          const tt = smooth(124.6, 125.15, u) * 0.999;
          const hp = u < 124.6 ? TALLYSTAND.clone() : TO_SNARE.getPointAt(tt);
          const w = flatDir(hp, TO_SNARE.getPointAt(Math.min(1, tt + 0.2))), sw = rightOf(w);
          cp.lerp(hp.clone().addScaledVector(w, -2.4).addScaledVector(sw, 1.0).add(V3(0, 1.7, 0)), ap);
          lk.lerp(hp.addScaledVector(w, 5).addScaledVector(sw, -0.5).add(V3(0, 1.0, 0)), ap);
        }
        if (sn > 0) lk.lerp(snareSpot, sn);
      } else ({ cp, lk } = wayShot(i, u));
      pos.lerp(cp, jw);
      look.lerp(lk, jw);
    }
    // in the dell: low behind him as he stands in the leaves; the reveal of the tree
    const rw = cam.reveal(u);
    if (rw > 0) {
      const k = smooth(133.3, 134.4, u);
      const low = LAND.clone().addScaledVector(flatDir(SCROLL, LAND), 2.6).addScaledVector(rightOf(flatDir(LAND, SCROLL)), 0.9).add(V3(0, 1.3, 0));
      pos.lerp(low.lerp(TA.hero.pos.clone(), k), rw);
      look.lerp(LAND.clone().add(V3(0, 1.4, 0)).lerp(TA.hero.target.clone(), k), rw);
    }
    // the crystal and the scroll: behind him as he kneels, close as it breaks, over his shoulder onto the page; as it
    // opens all the way he looks up, and the lens draws back and lifts with his eyes. Cut: high on the dell's side, the
    // great tree across it, the light gathering in its crown, a thread of it down to him, then the pillar down out of
    // the sky onto him and its ring of light running out over the whole floor. Cut: low across the dell, the pillar
    // standing on him, the leaves coming down through it. Cut: over his shoulder in its light again, down into the page
    // and the sign.
    const sw = cam.scroll(u);
    if (sw > 0) {
      const sp = scroll.group.position;
      const k1 = smooth(135.9, 136.9, u), k2 = smooth(138.2, 139.0, u), k3 = smooth(BACK_CUT, 140.95, u);
      const hk = flatDir(KNEEL, SCROLL), rk = rightOf(hk);
      const s0 = KNEEL.clone().addScaledVector(hk, -2.6).addScaledVector(rk, 1.1).add(V3(0, 1.65, 0));
      const s1 = KNEEL.clone().addScaledVector(hk, -1.25).addScaledVector(rk, 0.95).add(V3(0, 1.3, 0));
      const s2 = KNEEL.clone().addScaledVector(hk, -0.45).addScaledVector(rk, 0.52).add(V3(0, 1.38, 0));
      const s3 = xuanAt.clone().addScaledVector(xuanN, 0.17);
      let cp, lk;
      if (u < UP_CUT) {
        cp = s0.lerp(s1, k1).lerp(s2, k2);
        lk = SCROLL.clone().add(V3(0, 0.1, 0)).lerp(sp, smooth(138.0, 138.6, u)).lerp(xuanAt, k2 * 0.55);
        // (the lens draws back a little and lifts with his eyes as he looks up)
        const lu = smooth(139.04, 139.22, u);
        if (lu > 0) {
          cp.addScaledVector(hk, -0.45 * lu).add(V3(0, 0.12 * lu, 0));
          const d = lk.clone().sub(cp).normalize();
          lk.copy(cp).addScaledVector(slerpDir(d, light.canopy.clone().sub(cp).normalize(), lu * 0.1), 3);
        }
      } else if (u < WIDE_CUT) {
        // (from high on the dell's side, across it: the great tree, the light gathering in its crown, him kneeling at
        // its foot; the pillar coming down onto him and its ring of light running out over the whole floor; pushing in)
        const t = smooth(UP_CUT, WIDE_CUT, u);
        const a = Math.atan2(hk.z, hk.x) + Math.PI - 0.32, R = lerp(22, 21.1, t);
        cp = onG(SCROLL.clone().add(V3(Math.cos(a) * R, 0, Math.sin(a) * R))).add(V3(0, lerp(1.7, 1.5, t), 0));
        lk = SCROLL.clone().add(V3(0, lerp(9, 8.2, t), 0));
      } else if (u < BACK_CUT) {
        // (across the dell from in front of him and to his right, low, between the bamboo: the great tree and the pillar
        // on him, kneeling small in its light at its foot, the leaves coming down through it; pushing in slowly)
        const t = smooth(WIDE_CUT, BACK_CUT, u);
        const a = Math.atan2(hk.z, hk.x) + Math.PI - 0.4, R = lerp(16, 14.6, t);
        cp = onG(SCROLL.clone().add(V3(Math.cos(a) * R, 0, Math.sin(a) * R))).add(V3(0, lerp(2.1, 1.85, t), 0));
        lk = SCROLL.clone().add(V3(0, lerp(6.0, 5.6, t), 0));
      } else {
        // (over his shoulder in the light, down into the page and the sign)
        cp = s2.clone().add(V3(0, 0.12, 0)).lerp(s3, k3);
        const dl = sp.clone().lerp(xuanAt, 0.55).sub(cp).normalize(), dX = xuanAt.clone().sub(cp).normalize();
        lk = cp.clone().addScaledVector(slerpDir(dl, dX, k3), 3);
      }
      pos.lerp(cp, sw);
      look.lerp(lk, sw);
    }
  }

  // ------------------------------------------------------------ the sun through the day
  // (the morning he comes: low ahead and to the right of the way the eye comes in, long shadows over the snow)
  const sunDirs = [[108, V3(0.36, 0.2, -0.91)], [111.5, V3(0.36, 0.24, -0.9)], [112.6, V3(-0.62, 0.55, 0.56)], [123.6, V3(-0.62, 0.55, 0.56)],
    [124.6, V3(-0.5, 0.42, -0.76)], [128.6, V3(-0.58, 0.36, -0.73)], [131.4, V3(-0.62, 0.3, -0.72)], [133.0, V3(-0.5, 0.56, -0.66)], [145, V3(-0.5, 0.56, -0.66)]];
  function sunDir(u) {
    let i = 0;
    while (i < sunDirs.length - 2 && u > sunDirs[i + 1][0]) i++;
    const [u0, a] = sunDirs[i], [u1, b] = sunDirs[i + 1];
    return a.clone().lerp(b, smooth(u0, u1, u)).normalize();
  }

  // ------------------------------------------------------------ per frame
  const _hl = V3(), _hr = V3(), _hd = V3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
  const heldPos = V3(), heldQ = new THREE.Quaternion();
  let heldOpen = 0, heldOnce = false;
  let px = 900;
  function update(u, time, camera, { inB, sample, hero, pxScale, lamp }) {
    trailB.uniforms.uTime.value = time;
    if (pxScale) px = pxScale;
    if (!inB) { bow.group.visible = false; bowBack.group.visible = false; qiFar.points.visible = qiNear.points.visible = false; return; }
    U.uSnow.value = sample('snowCover');
    U.uWet.value = sample('wet');
    U.uAutumn.value = sample('autumn');
    U.uBlossom.value = sample('blossom');
    U.uMoss.value = 0.8;
    U.uStage.value = FT.stage(u);
    // (the old tally marks of the camp kit stay hidden: the cuts are made in front of the eye now)
    U.uYears.value = 0;
    // the cuts: each drawn down the bark with the knife, then greying through the years after
    notches.forEach((nt, i) => {
      const C = CUTS[i];
      nt.uni.uProg.value = smooth(C - 0.15, C + 0.2, u);
      nt.uni.uFresh.value = 1 - 0.85 * smooth(C + 0.6, C + 4.2, u);
      nt.mesh.visible = u > C - 0.16 && u < 124.8;
    });
    chips.uniforms.uU.value = u;
    chips.uniforms.uPx.value = px;
    chips.uniforms.uLight.value = lerp(0.85, 1.15, sample('snowCover'));
    chips.pts.visible = u > CUTS[0] - 0.2 && u < CUTS[5] + 1.2;
    U.uCollapse.value = 0;
    // the camp fire through the years, cold once he has gone
    set.fx.setFire(u > 112.4 && u < 124.6 ? 1 : 0, time);
    // light through the canopy along the way and in the dell
    set.shafts.setIntensity(smooth(124.4, 125.2, u) * 1.1 + smooth(132.2, 133.4, u) * 0.5);
    // the thread of gold races down into the forest, then fades into the trees
    // (out of the painting it runs on: down the sky beyond the towers and into the forest, toward the dell)
    trailB.uniforms.uProg.value = lerp(0.35, 1, smooth(109.55, 110.9, u));
    trailB.uniforms.uTail.value = smooth(110.7, 111.9, u) * 0.94;
    trailB.uniforms.uAlpha.value = 1 - smooth(111.3, 111.95, u);
    trailB.mesh.visible = u > 109.5 && u < 111.95;
    // the bow: in his left fist on the way, on his back from the rim
    // the knife in his right fist while he cuts
    if (hero && !knifeMounted) { knife.rotation.set(0, 0, 0); knife.position.set(0, 0, 0); hero.attach('handR', knife); knifeMounted = true; }
    {
      let k = 0;
      while (k < 5 && u > CUTS[k] + 0.8) k++;
      const C = CUTS[k];
      knife.visible = knifeMounted && u > C - 0.42 && u < C + (k === 5 ? 0.42 : 0.5) && u < 124.6;
    }
    if (hero && !bowMounted) {
      bow.group.rotation.set(0, Math.PI, 0); bow.group.position.set(0, 0, -0.2); hero.attach('handL', bow.group);
      bowBack.group.rotation.set(0.25, 0, Math.PI * 0.5 + 0.35); bowBack.group.position.set(0.02, 0.05, -0.12); hero.attach('back', bowBack.group);
      bowBack.arrow.visible = false;
      bowMounted = true;
    }
    // (on his back from the years he has had it, while he cuts and through the snare; in his left fist on the way out;
    // on his back again from the rim)
    bow.group.visible = bowMounted && u > 125.9 && u < 132.0;
    bowBack.group.visible = bowMounted && u >= 132.0 && u < 141;
    bow.update(0); bowBack.update(0);
    // the old wood: the fungi wake with the qi
    const qk = FT.qi(u);
    if (set.fungi && set.fungi.glow) set.fungi.glow.value = 0.5 + qk * 1.5;
    // qi: around him on the way, gathering into streams toward the dell; spiralling into the crystal; the burst
    const target = SCROLL.clone().add(V3(0, 0.15, 0));
    const inDell = u >= 133.2;
    const s = clamp(heroS(u), 0, J.length);
    const here = inDell ? A.DELL.clone().add(V3(0, 3.2, 0)) : jAt(s + 7).pos.add(V3(0, 2.0, 0));
    // (as the page opens all the way its light goes up out of it into the leaves overhead; then up the pillar)
    const bQ = Math.max(FT.beam(u), FT.gather(u));
    if (bQ > 0.01) qiFar.set({ time, amt: Math.max(qk, bQ), center: here, radius: 10, target: target.clone().add(V3(0, 18, 0)), org: 1, spiral: 1.4, burst: 0, px });
    else qiFar.set({ time, amt: qk, center: here, radius: inDell ? 10 : 15, target, org: FT.org(u), spiral: 1, burst: FT.shatter(u), px });
    qiNear.set({ time, amt: qk * 0.9 * (1 - smooth(138.6, 139.6, u)), center: (hero ? hero.group.position.clone() : here).add(V3(0, 1.4, 0)), radius: 3.2, target, org: FT.org(u) * 0.35, px });
    // the crystal: waking, cracking with light under his hand, breaking into motes
    const glow = FT.glow(u);
    if (set.crystal) set.crystal.update(time, { glow: clamp(glow), crack: FT.crack(u), shatter: FT.shatter(u) });
    // the scroll: sealed in the crystal, lifted, opened between his hands (the stave in his left, the roller in his right)
    const holdK = smooth(138.05, 138.45, u);
    if (holdK > 0.999 && hero && !hero.group.visible && heldOnce) {
      // (he is out of shot or the lens is at his eyes: the scroll stays where his hands last held it)
      scroll.group.position.copy(heldPos); scroll.group.quaternion.copy(heldQ); scroll.update(heldOpen, glow);
    } else if (hero && holdK > 0 && hero.group.visible) {
      hero.group.updateMatrixWorld(true);
      _hl.copy(hero.anchors.handL()); _hr.copy(hero.anchors.handR());
      const X = _hr.clone().sub(_hl); const span = X.length(); X.normalize();
      // the page faces his eyes
      _hd.copy(hero.anchors.head()).sub(_hl.clone().lerp(_hr, 0.5));
      const Y = _hd.addScaledVector(X, -_hd.dot(X)).normalize();
      const Z = V3().crossVectors(X, Y).normalize();
      _m.makeBasis(X, Y, Z);
      _q.setFromRotationMatrix(_m);
      scroll.group.position.copy(scrollRestPos).lerp(_hl, holdK);
      scroll.group.quaternion.copy(scrollRest).slerp(_q, holdK);
      scroll.update(clamp(span / 1.5) * holdK, glow);
      heldPos.copy(scroll.group.position); heldQ.copy(scroll.group.quaternion); heldOpen = clamp(span / 1.5) * holdK; heldOnce = true;
    } else {
      scroll.group.position.copy(scrollRestPos);
      scroll.group.quaternion.copy(scrollRest);
      scroll.update(0, glow);
    }
    scroll.group.updateMatrixWorld(true);
    // the pillar of light: the light gathering in the leaves overhead, the thread it sends down ahead of it, then down
    // out of the sky onto the page in his hands; the flare of the strike, its ring of light running out across the dell
    // with a low wall of light on it and light in cracks over the ground behind it, the threads winding round its foot;
    // its light on him and the roots and the leaves (the scene's spare lamp)
    const bA = FT.beam(u), gth = FT.gather(u);
    // (it stands where the page is, in his hands)
    const sp = scroll.group.position;
    light.foot.set(sp.x, hB(sp.x, sp.z), sp.z);
    light.canopy.copy(light.foot).add(V3(0, CANOPY_H, 0));
    const bAt = light.foot;
    const ringK = FT.beamRing(u);
    const age = u - STRIKE_B;
    const hit = age >= 0 ? Math.exp(-age / 0.035) : 0;
    const ring = ringAt(u);
    beam.set({ at: bAt, amt: bA * (1.1 + 1.8 * Math.exp(-Math.max(0, age) / 0.05)), drop: FT.beamDrop(u), from: 30, width: 1.7, pilot: FT.pilot(u), reach: smooth(139.35, 139.385, u),
      flare: hit, helix: smooth(STRIKE_B + 0.04, STRIKE_B + 0.3, u) * (1 - smooth(140.6, 141.1, u)),
      ring, ringA: 1.6 * band(STRIKE_B - 0.01, STRIKE_B + 0.04, 139.75, 140.05, u),
      wall: 1.25 * band(STRIKE_B, STRIKE_B + 0.02, STRIKE_B + 0.12, 139.86, u) * (1 - 0.6 * ringK), wallH: lerp(2.6, 0.5, ringK),
      crack: band(STRIKE_B, STRIKE_B + 0.03, 139.8, 140.3, u),
      canopy: CANOPY_H, burstR: lerp(5, 11, Math.max(gth, smooth(STRIKE_B - 0.01, STRIKE_B + 0.1, u))) * (1 + 0.5 * hit), gather: gth, gatherA: gth * 1.6, time, eye: camera.position });
    leafBlast.set({ u, ts: 9, amt: 1 - smooth(140.6, 141.0, u), beam: Math.min(1.2, bA), px });
    if (lamp) {
      // (first the gathering light in the crown, lighting the leaves and the trunk from above; then the pillar's own, on
      // him and the page and the roots, blinding the instant it strikes; softer once the lens is back by his shoulder)
      if (bA > 0.001 && age > -0.01) { lamp.color.setRGB(1, 0.8, 0.5); lamp.position.copy(bAt).add(V3(0, 2.2, 0)); lamp.distance = 18; lamp.decay = 1.5; lamp.intensity = 80 * bA * (1 + 2.5 * Math.exp(-Math.max(0, age) / 0.06)) * (1 - 0.85 * smooth(BACK_CUT - 0.01, BACK_CUT + 0.05, u)); }
      else if (gth > 0.001) { lamp.color.setRGB(1, 0.78, 0.45); lamp.position.copy(light.canopy).add(V3(0, -4, 0)); lamp.distance = 40; lamp.decay = 1.1; lamp.intensity = 90 * gth * gth; }
    }
    light.gather = gth; light.beam = bA; light.strike = age;
    // the great sign painted on it
    xuanAt.set(scroll.xuanX || 0.45, 0.004, 0).applyMatrix4(scroll.group.matrixWorld);
    xuanN.set(0, 1, 0).transformDirection(scroll.group.matrixWorld);
    set.update(time, camera);
  }

  // (the lens may come close by him without hiding him: in close on the knife at the bark, where his head is out of the frame)
  const allowNear = u => CUTS.some(C => u > C - 0.4 && u < C + 0.44);
  return { root, set, anchors: A, fogFloor: 0, sunDir, wuhen, ghosts, shots, update, scroll, trail: trailB, allowNear, tally: { cuts, sixMid, tn, tRight, knife }, dell: { KNEEL, SCROLL, LAND }, light };
}
