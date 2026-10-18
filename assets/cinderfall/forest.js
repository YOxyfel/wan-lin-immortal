// The Forbidden Forest (world B): the set (forest-set.js) and what happens in it, as pure functions of u.
// Out of the painting the eye comes down through the snowy pines to the clearing as he comes out of the trees and sinks
// down against the boulder. Six years at the camp (years.js): each winter he marks his height on the pale tree with his
// knife, the camp growing round it; in the sixth autumn he lays his hand on the six marks and turns away. No game near the camp,
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
import { createYears, MARK_AGE, crownOf, scoreOf } from './years.js';
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
  [125.9, 130.45, 23, 292, 'stride'],
  [130.45, 131.65, 360, 364.7, 'streams'],
  [131.65, 132.3, 401.1, 401.8, 'rim'],
  [132.3, 133.3, 401.8, 413.5, 'slide'],
];
// (the run down the bank into the dell begins once the held moment at the rim lets go, timeline.js PAUSES)
const SLIDE0 = 132.45;
const CAM_BACK = 3.0;
// The way out (125.9–130.45) as a stride-cut: the lens locked at his hip, behind him off his right shoulder on a long
// lens, his walk locked to the story. On the heel strike that ends a stretch the world cuts to the next stretch of the
// way while he walks on in the same place in the frame: the camp's woods, the ford, the bamboo, the old wood and its
// giants, bigger each time; three strides to each, then two, then one. On the next heel strike nothing changes: a mote
// of gold crosses the lens, he stops, and the lens leaves him for the first time, up the giant beside him, as the air
// begins to glow. [metres along the way where the stretch begins (null: the ford's crossing), strides, the sun]
const STRIDE_U0 = 125.9, STRIDE_DU = 0.318, STRIDE_LEN = 1.45;
const STRETCH = [
  [23, 3, [0.45, 0.42, 0.79]],      // the camp's woods, the morning sun behind him, his shadow ahead
  [null, 3, [0.15, 0.55, 0.82]],    // the ford
  [213, 2, [-0.05, 0.75, 0.66]],    // the bamboo, about noon
  [244, 2, [-0.5, 0.45, -0.74]],    // the old wood, the sun come round ahead of him
  [262, 1, [-0.66, 0.36, -0.66]],
  [287, 1, [-0.78, 0.27, -0.56]],   // low ahead, gold: he walks into it
];
const STRIDE_END = STRETCH.reduce((a, x) => a + x[1], 0);     // the missed beat: a heel strike, and nothing changes
const MISSED = STRIDE_U0 + STRIDE_END * STRIDE_DU, HALT = 0.254, CRANE = [129.9, 130.45];
// the pillar of light: the cut to the lens looking up the tree as he looks up; (the strike, STRIKE_B, cuts across the
// dell); the cut back over his shoulder, down into the page
const UP_CUT = 139.22, WIDE_CUT = 139.6, BACK_CUT = 139.95;
// blood recognition: his palm held out over the crystal (this high over where his blood falls on it); the drop gathering
// under it, falling, landing (the crystal cracks from there, timeline.js forest.crack); the insert, close on his hand
// and the crystal, his blood running into the seams (in as the drop gathers, out as it breaks)
const PALM_OVER = 0.14, DROP = [136.74, 136.86, 136.95], TOUCH_IN = [136.78, 137.3];
// what fell, waiting for him: the cut in low among the roots behind the crystal as he comes across the dell to it (in
// on the line's second half, out as he kneels)
const CRYSTAL_IN = [134.7, 135.95];

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
  // (the last few steps to the boulder: the thirty-nine metres out of the trees in under three seconds were a glide)
  const ARRIVE = path([V3(-1.6, 0, -6.6), V3(0.6, 0, -4.4), ROCKSIT]);
  // ------------------------------------------------------------ the tally: his height marked on the pale bark each winter
  // (on the side of the tree away from the camp, toward the low sun: a ladder of short level cuts, each where his palm
  // lay on his crown, a little higher each year)
  const TALLY = A.TALLY.clone();
  const tGy = hB(TALLY.x, TALLY.z);
  const tn = flatDir(V3(-1.5, 0, -4.75), TALLY);           // the way the marks face (away from the camp)
  const tFace = tn.clone().negate();                        // the way he faces as he makes them
  const tRight = rightOf(tFace);                            // his right as he faces the tree
  // the trunk's axis at a height above the ground (it leans a little), and its radius there (forest-set-camp.js)
  const trunkAt = h => V3(TALLY.x + 0.05 * (h + 0.3) / 4, tGy + h, TALLY.z + 0.04 * (h + 0.3) / 4);
  const trunkR = h => { const t = (h + 0.3) / 12.55; return 0.25 * (1 - 0.7 * t) * (1 + 0.35 * Math.exp(-24 * t)); };
  const tA = Math.atan2(tn.x, tn.z);
  // where he stands to mark it, facing the bark
  const STAND = onG(trunkAt(1.7).addScaledVector(tn, trunkR(1.7) + 0.36));
  const notch = MARK_AGE.map((age, k) => {
    const h = STAND.y - tGy + crownOf(age), R = trunkR(h) + 0.011;
    const a = tA + [0.012, -0.02, 0.006, 0.022, -0.01, 0.0][k], W = 0.12 + [0, 0.012, -0.006, 0.008, 0.015, 0.004][k];
    const at = da => trunkAt(h).add(V3(Math.sin(a + da), 0, Math.cos(a + da)).multiplyScalar(R));
    return { k, h, R, a, W, n: V3(Math.sin(a), 0, Math.cos(a)), mid: at(0), left: at(-W / (2 * R)), right: at(W / (2 * R)) };
  });
  const TALLYSTAND = STAND;
  // the empty snare, beside the way just out of camp (round the tree from where he stands, and on toward the way)
  const SNARE = jAt(6);
  const snareSpot = SNARE.pos.clone().addScaledVector(rightOf(SNARE.dir), -0.75);
  const TO_SNARE = path([TALLYSTAND, TALLY.clone().addScaledVector(tRight, 1.15).addScaledVector(tn, 0.35), TALLY.clone().addScaledVector(tRight, 1.2).addScaledVector(tn, -1.6), SNARE.pos]);
  // the walk out to it at a walker's pace: a few steps away from the tally, then a cut to the last few before the snare,
  // slowing to it (fourteen metres in under four seconds was a glide); 0..1 along the way
  const SNARE_CUT = 124.78;
  let snareLen = 0;
  const snareT = u => {
    if (!snareLen) snareLen = TO_SNARE.getLength();
    if (u <= 124.6) return 0;
    if (u >= 125.15) return 1;
    if (u < SNARE_CUT) { const k = (u - 124.6) / (SNARE_CUT - 124.6); return 1.12 * k * k / snareLen; }
    const k = (u - SNARE_CUT) / (125.15 - SNARE_CUT);
    return (snareLen - 1.5 + 1.5 * k * (2 - k)) / snareLen;
  };
  // the omen: a frost that morning, unbroken but for his own prints out to the snare, which is empty; seen once from
  // straight above (OMEN): the white, the prints, the open loop, not one other track
  const OMEN = [125.32, 125.66];
  const omen = (() => {
    const g = new THREE.Group(); g.name = 'omen'; g.visible = false;
    const dirt = new THREE.MeshStandardMaterial({ color: 0x2a2219, roughness: 1 });
    dirt.polygonOffset = true; dirt.polygonOffsetFactor = -2; dirt.polygonOffsetUnits = -4;
    const cord = new THREE.MeshStandardMaterial({ color: 0x9a8a66, roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5c4630, roughness: 0.9 });
    // a print: heel and ball pressed through the frost to the dark ground
    const printG = new THREE.CircleGeometry(0.5, 12); printG.rotateX(-Math.PI / 2); printG.scale(0.11, 1, 0.27);
    const prints = [];
    const put = (q, d, t) => { const m = new THREE.Mesh(printG, dirt); m.position.set(q.x, hB(q.x, q.z) + 0.03, q.z); m.rotation.y = Math.atan2(d.x, d.z); g.add(m); prints.push({ m, t }); };
    const L = TO_SNARE.getLength(), n = Math.floor(L / 0.36);
    for (let i = 1; i <= n; i++) {
      const t = i / n, p = TO_SNARE.getPointAt(t);
      const d = flatDir(TO_SNARE.getPointAt(Math.max(0, t - 0.01)), TO_SNARE.getPointAt(Math.min(1, t + 0.01)));
      put(p.clone().addScaledVector(rightOf(d), (i % 2 ? 1 : -1) * 0.1), d, t);
    }
    // (where he crouched by it: both feet turned toward it)
    const fd = flatDir(SNARE.pos, snareSpot);
    for (const s of [-1, 1]) put(SNARE.pos.clone().addScaledVector(rightOf(fd), s * 0.13).addScaledVector(fd, 0.08), fd, 0.999);
    // the snare: a peg, a bent sapling and the cord's loop open over the way the game would come, empty
    const sp = onG(snareSpot);
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.26, 5), wood); peg.position.copy(sp).add(V3(0, 0.1, 0)); g.add(peg);
    const bend = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.9, 5), wood);
    bend.position.copy(sp).addScaledVector(SNARE.dir, -0.3).add(V3(0, 0.38, 0)); bend.rotation.set(0.75, Math.atan2(SNARE.dir.x, SNARE.dir.z), 0); g.add(bend);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.0045, 3, 16), cord);
    loop.position.copy(sp).addScaledVector(SNARE.dir, 0.12).add(V3(0, 0.12, 0)); loop.rotation.set(-0.9, Math.atan2(SNARE.dir.x, SNARE.dir.z), 0); g.add(loop);
    root.add(g);
    return { g, prints };
  })();
  // the years at the camp (years.js)
  const yearsArgs = { anchors: A, hB, root, tally: { TALLY, tn, tRight, STAND, notch }, ROCKSIT, rockOut, wayOut: TO_SNARE.getPointAt(0.12) };
  let years = createYears(yearsArgs);

  // ------------------------------------------------------------ the dell
  const LAND = A.LAND.clone();
  const SCROLL = A.scrollPose.position.clone();
  const TOUCH = (A.crystalTouch || SCROLL).clone();
  const toLand = flatDir(SCROLL, LAND);
  // (near enough that, bowed over it, he can hold his hand out over the crystal)
  const KNEEL = onG(SCROLL.clone().addScaledVector(toLand, 0.9));
  const APPROACH = path([LAND, LAND.clone().lerp(KNEEL, 0.5).addScaledVector(V3().crossVectors(UP, toLand), 0.6), KNEEL]);
  const TA = A.treeAnchors;
  const crownAt = A.ANCIENT.clone().add(V3(0, 14, 0));
  // the drop of his blood (a plain lit material, as the props: no program of its own)
  const bloodDrop = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 12, 8), new THREE.MeshStandardMaterial({ color: 0x4a0505, emissive: 0x7a0a06, emissiveIntensity: 1, roughness: 0.2 }));
  bloodDrop.visible = false; bloodDrop.name = 'bloodDrop';
  root.add(bloodDrop);

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

  // ------------------------------------------------------------ the marks: drawn across the bark as the knife goes, pale fresh
  // wood greying over the years (a V groove: the lower face to the light, the upper in shadow, a dark seam where they
  // meet, the torn lip of the bark along its edges)
  const notchMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  const notches = notch.map(c => {
    // (a strip bent round the trunk)
    const g = new THREE.PlaneGeometry(1, 1, 12, 1), gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) { const th = gp.getX(i) * c.W / c.R; gp.setXYZ(i, c.R * Math.sin(th), gp.getY(i) * 0.014, c.R * Math.cos(th)); }
    g.computeVertexNormals();
    const m = notchMat.clone();
    // (drawn over the bark it lies on, which is a little rough)
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4;
    const uni = { uProg: { value: 0 }, uFresh: { value: 1 }, uSeed: { value: c.k * 0.137 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uni, { uNoise: U.uNoise });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vNUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvNUv = uv;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vNUv; uniform float uProg, uFresh, uSeed; uniform sampler2D uNoise;`)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );
  {
    // (x along the cut from his left, y across it)
    vec2 q = vec2(vNUv.x, vNUv.y * 2. - 1.);
    float n1 = texture2D(uNoise, vec2(q.x * 2.3 + uSeed, .31 + uSeed)).r, n2 = texture2D(uNoise, vec2(q.x * 7.1 + uSeed, .71)).g;
    // a long lens, ragged where the bark tore, deeper where the blade bit in at the start
    float hw = pow(max(sin(3.1416 * clamp(q.x, 0., 1.)), 0.), mix(.7, .45, q.x)) * (.8 + .32 * (n1 - .5) + .12 * (n2 - .5));
    if (abs(q.y) > hw || q.x > uProg) discard;
    float sd = q.y / max(hw, 1e-3);
    vec3 fresh = vec3(1., .9, .66), old = vec3(.5, .44, .36);
    vec3 wood = mix(old, fresh, uFresh);
    // the face below the seam toward the light, the face above it in shadow, the seam
    wood *= mix(1.15, .5, smoothstep(-.4, .3, sd));
    wood = mix(wood, vec3(.1, .07, .05), smoothstep(.22, .03, abs(sd)) * .95);
    // the bark's torn lip, the grain of the wood, the knife's chatter along it
    wood = mix(wood, vec3(.16, .11, .08), smoothstep(.62, .97, abs(sd)) * .85);
    wood *= .86 + .22 * texture2D(uNoise, vec2(vNUv.x * 9. + uSeed, vNUv.y * 1.3)).b;
    wood *= .94 + .08 * sin(q.x * 70. + n1 * 6.);
    // the end the blade is at, fresh and bright
    wood += vec3(.12, .1, .06) * exp(-(uProg - q.x) * 40.) * step(uProg, .999) * uFresh;
    diffuseColor.rgb = wood;
  }`)
        // (marked like a figure, so the ink draws it from its own light, outlined, and the painted pass leaves it alone:
        // small as it is, it is what the eye is on)
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a = 1.1;');
    };
    m.customProgramCacheKey = () => 'cf-notch';
    const mesh = new THREE.Mesh(g, m);
    mesh.position.copy(trunkAt(c.h));
    const x = V3().crossVectors(UP, c.n).normalize();
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, UP, c.n));
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
    // (seen only while he cuts with it: it hangs on the same hero who walks the valley, so it is never left showing)
    knife.visible = false;
  }
  let knifeMounted = false;
  // the chips the knife throws out of the cut (a pure function of the story position: out, down into the snow, gone)
  const chips = (() => {
    const per = 36, N = per * notch.length;
    const g = new THREE.BufferGeometry();
    const sd = new Float32Array(N * 4), kk = new Float32Array(N);
    let r = 991;
    const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) { sd.set([rnd(), rnd(), rnd(), rnd()], i * 4); kk[i] = Math.floor(i / per); }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
    g.setAttribute('aK', new THREE.BufferAttribute(kk, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    // (uTop: where the score starts and when; uBot: where it ends and the ground under it; uN: the bark's normal there,
    // and how many story units to a second while it is made)
    const rate = [0.225, 0.3375, 0.3825, 0.4275, 0.45, 0.2025];
    const uniforms = { uU: { value: 0 }, uPx: { value: 900 }, uTop: { value: notch.map(c => new THREE.Vector4(c.left.x, c.left.y, c.left.z, scoreOf(c.k)[0])) },
      uBot: { value: notch.map(c => new THREE.Vector4(c.right.x, c.right.y, c.right.z, tGy)) }, uN: { value: notch.map(c => new THREE.Vector4(c.n.x, c.n.y, c.n.z, rate[c.k])) },
      uDur: { value: notch.map(c => scoreOf(c.k)[1] - scoreOf(c.k)[0]) }, uR: { value: tRight.clone() }, uLight: { value: 1 } };
    const material = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec4 aSeed; attribute float aK; uniform float uU, uPx; uniform vec4 uTop[6], uBot[6], uN[6]; uniform float uDur[6]; uniform vec3 uR; varying float vA, vS;
void main(){
  int k = int(aK + .5);
  vec4 T = uTop[k], Bt = uBot[k]; vec3 n = uN[k].xyz;
  // thrown out from where the blade was at that moment, as it went across (t in seconds)
  float f = aSeed.x, ts = T.w + f * uDur[k];
  float t = (uU - ts) / uN[k].w;
  vec3 p0 = mix(T.xyz, Bt.xyz, f) + n * .01;
  vec3 v = n * (.55 + .9 * aSeed.y) + uR * (aSeed.z - .2) * 1.2 + vec3(0., .25 + .8 * aSeed.w, 0.);
  // (until it lands in the snow at the foot of the tree)
  float dy = p0.y - Bt.w;
  float tl = (v.y + sqrt(v.y * v.y + 19.6 * max(dy, 0.))) / 9.8;
  float tc = min(max(t, 0.), tl);
  vec3 p = p0 + v * tc + vec3(0., -4.9 * tc * tc, 0.);
  p.y = max(p.y, Bt.w + .01);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  vA = step(0., t) * (1. - smoothstep(tl + .3, tl + 1.4, t));
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


  // ------------------------------------------------------------ the stride-cut (125.9–130.45)
  const stretchS = STRETCH.map(x => x[0] === null ? J.s.CROSSING - 1.2 : x[0]);
  const stretchAt = STRETCH.reduce((a, x) => (a.push(a[a.length - 1] + x[1]), a), [0]);
  // strides since it began (the gait's phase: a left heel strike on each whole number), slowing to a stop after the
  // missed beat
  const stridePh = u => {
    if (u <= MISSED) return Math.max(0, (u - STRIDE_U0) / STRIDE_DU);
    const t = Math.min(u - MISSED, HALT);
    return STRIDE_END + (t - t * t / (2 * HALT)) / STRIDE_DU;
  };
  function strideAt(u) {
    const ph = stridePh(u);
    let k = 0;
    while (k < STRETCH.length - 1 && ph >= stretchAt[k + 1]) k++;
    const s = stretchS[k] + (ph - stretchAt[k]) * STRIDE_LEN;
    return { ph, k, s, speed: u <= MISSED ? 1.3 : 1.3 * Math.max(0, 1 - (u - MISSED) / HALT) };
  }
  const strideSun = u => { if (u < STRIDE_U0 || u > 130.45) return null; const { k } = strideAt(u); return V3(...STRETCH[k][2]).normalize(); };
  // the giant he stops beside (forest-set-journey.js GIANTS: 302 m along, 11.5 m to the right of the way)
  const GIANT = (() => { const w = jAt(302); return w.pos.clone().addScaledVector(rightOf(w.dir), 11.5); })();
  // a mote of gold across the lens at the missed beat (one glow, turned to the eye)
  const mote = (() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'varying vec2 vUv; uniform float uA; void main(){ float r = length(vUv - .5) * 2.; float core = exp(-r * r * 40.), c = core + .5 * exp(-r * r * 7.) + .18 * exp(-r * r * 1.6); gl_FragColor = vec4(mix(vec3(1., .74, .3), vec3(1., .97, .85), core) * c * uA * 2.6, 1.); }',
    }));
    m.frustumCulled = false; m.renderOrder = 10; m.visible = false; m.name = 'mote';
    root.add(m);
    return m;
  })();
  const _mr = V3(), _mu = V3(), _mf = V3();
  function moteAt(u, camera) {
    const t = clamp((u - MISSED + 0.01) / 0.17);
    mote.visible = t > 0 && t < 1 && !!camera;
    if (!mote.visible) return null;
    camera.updateMatrixWorld();
    _mr.setFromMatrixColumn(camera.matrixWorld, 0); _mu.setFromMatrixColumn(camera.matrixWorld, 1); _mf.setFromMatrixColumn(camera.matrixWorld, 2).negate();
    // (from the right of the frame across to the left, near the lens, over the shade of the giant's roots and past his
    // head, drifting a little up)
    mote.position.copy(camera.position).addScaledVector(_mf, 1.6).addScaledVector(_mr, lerp(0.78, -0.62, t)).addScaledVector(_mu, -0.06 + 0.1 * t + 0.03 * Math.sin(t * 9));
    mote.quaternion.copy(camera.quaternion);
    mote.scale.setScalar(0.11);
    mote.material.uniforms.uA.value = Math.sin(t * Math.PI);
    return mote.position;
  }

  // ------------------------------------------------------------ the journey: where he is, where the camera is
  const stageAt = u => { for (let i = 0; i < STAGES.length; i++) { const [a, b] = STAGES[i]; if (u >= a && u <= b) return i; } return -1; };
  // (each stage at a walker's pace, 1.45 m/s in Watch; at the rim he slows to a stop at its edge, and stands)
  const stageS = (i, u) => {
    const [a, b, s0, s1, kind] = STAGES[i];
    if (kind === 'stride') return strideAt(u).s;
    if (kind === 'rim') { const k = clamp((u - a) / (132.05 - a)); return lerp(s0, s1, k * (2 - k)); }
    // (down into the dell: he waits at the rim while the story holds there, then runs down the bank, slowing to a stop
    // at its foot: at a runner's pace, his legs running, never sliding down it crouched with them still)
    if (kind === 'slide') {
      const k = clamp((u - SLIDE0) / (b - SLIDE0)), A = 1 / 0.9;
      const f = k < 0.8 ? A * k : A * (0.8 + (k - 0.8) - (k - 0.8) * (k - 0.8) / 0.4);
      return lerp(s0, s1, f);
    }
    return lerp(s0, s1, clamp((u - a) / (b - a)));
  };
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
      // (his stride from how far he goes: the engine measures it)
      o.speed = null;
      o.visible = u > 110.25;
      o.lookAt = u < 111.75 ? ROCKSIT.clone().add(V3(0, 1, 0)) : null;
      return o;
    }
    if (u < 124.6) {
      // the six years at the camp (years.js)
      years.hero(u, o);
      return o;
    }
    if (u < 133.3) {
      // (his hands free on the way: the bow is on his back)
      o.gripL = null;
      const i = Math.max(0, stageAt(u));
      const [a, b, , , kind] = STAGES[i];
      o.fade = 1;
      if (kind === 'snare') {
        // to the snare by the way: he crouches, looks — nothing; stands
        const t = snareT(u);
        o.P = t < 1 ? TO_SNARE.getPointAt(t) : SNARE.pos.clone();
        o.heading = t < 0.98 ? flatDir(o.P, TO_SNARE.getPointAt(Math.min(1, t + 0.03))) : SNARE.dir.clone();
        o.speed = null;
        o.crouch = band(125.15, 125.35, 125.6, 125.8, u);
        o.reach = o.crouch * 0.8;
        o.reachTarget = snareSpot.clone().add(V3(0, 0.05, 0));
        o.lookAt = snareSpot.clone();
        o.lookW = o.crouch;
        return o;
      }
      if (kind === 'stride') {
        // his walk locked to the story, the world cut under his feet on the heel strikes
        const st = strideAt(u), w = jAt(st.s);
        o.P = w.pos;
        o.heading = w.dir.clone();
        o.speed = st.speed;
        o.phase = st.ph % 1;
        // (the missed beat: he looks after the mote that crossed in front of him, then up at the giant)
        const look = band(MISSED + 0.03, MISSED + 0.1, 130.1, 130.3, u);
        if (look > 0) { o.lookAt = w.pos.clone().addScaledVector(w.dir, 2).addScaledVector(rightOf(w.dir), -2.5).add(V3(0, 1.7, 0)).lerp(GIANT.clone().add(V3(0, 9, 0)), smooth(129.95, 130.3, u)); o.lookW = 0.8 * look; o.lookUp = 0.5 * smooth(129.95, 130.3, u) * (1 - smooth(130.3, 130.45, u)); }
        return o;
      }
      const s = stageS(i, u);
      const w = jAt(s);
      o.P = w.pos;
      o.heading = w.dir.clone();
      o.speed = null;
      if (kind === 'streams') { o.lookAt = w.pos.clone().addScaledVector(w.dir, 10).add(V3(0, 1.8, 0)); o.lookW = 0.5 * smooth(130.6, 130.9, u); }
      if (kind === 'rim') {
        // at the rim he stops: below, the streams of light go down into the dell
        o.lookAt = A.DELL.clone().add(V3(0, 2, 0));
        o.lookW = smooth(131.9, 132.15, u);
      }
      if (kind === 'slide') { o.run = band(SLIDE0, SLIDE0 + 0.04, 133.0, 133.22, u); o.crouch = 0.4 * band(133.05, 133.18, 133.22, 133.32, u); o.lookAt = SCROLL.clone(); o.lookW = smooth(132.9, 133.3, u); }
      return o;
    }
    // the dell: he stands in the leaves and looks up at it; goes to it; kneels; touches the crystal; it breaks
    const t = FT.approach(u);
    o.P = t > 0 ? APPROACH.getPointAt(t) : LAND.clone();
    o.heading = t <= 0 ? flatDir(LAND, SCROLL) : t < 0.98 ? flatDir(o.P, APPROACH.getPointAt(Math.min(1, t + 0.03))) : flatDir(KNEEL, SCROLL);
    if (t > 0.85) o.heading = yawLerp(o.heading, flatDir(KNEEL, SCROLL), smooth(0.85, 1, t));
    o.speed = null;
    o.lookAt = u < 134.4 ? crownAt.clone() : SCROLL.clone();
    o.lookW = u < 134.4 ? band(133.3, 133.6, 134.0, 134.4, u) : 1;
    o.kneel = smooth(136.0, 136.6, u);
    // he bows over the crystal and holds his right hand out over it, palm down (torn on the way down into the dell): a
    // drop of his blood falls from it onto the crystal, and it wakes and cracks from there; then down for the scroll
    const touch = band(136.35, 136.7, 137.15, 137.45, u);
    const take = band(137.75, 137.95, 138.2, 138.4, u);
    o.reach = Math.max(touch, take);
    o.reachTarget = touch > take ? TOUCH.clone().add(V3(0, PALM_OVER, 0)) : SCROLL.clone().add(V3(0, 0.03, 0));
    o.lean = Math.max(touch, take);
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

  // ------------------------------------------------------------ the others: him in the moments of the years, the engine's spare
  // figures ([{ i, P, heading, state, fade, age }])
  const ghosts = u => (u > 112.9 && u < 124.6 ? years.others(u) : []);

  // ------------------------------------------------------------ the shots that belong to this place
  // the shots of the way out (between the snare and the rim)
  function wayShot(i, u) {
    const [a, b, s0, s1, kind] = STAGES[i];
    const k = clamp((u - a) / (b - a));
    const w = jAt(stageS(i, u)), P = w.pos, d = w.dir, r = rightOf(d);
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
  // the stride-cut's lens: locked at his hip behind his right shoulder; at the missed beat it leaves him, up the giant
  const tune = { strideSide: -1, strideAngle: 55, strideLead: 2.2, strideD: 4.6, strideUp: 1.02, pillarR: 6.5, pillarA: 0.04, pillarLook: 2.4, pillarFov: 60, crystalBack: 0.8, crystalSide: 0, crystalUp: 0.34, crystalLook: -1.5, crystalLook2: -1.4, crystalFov: 46, crystalFov2: 52, touchR: -0.5, touchFront: 0.1, touchUp: 0.5, touchFov: 34 };
  function strideShot(u) {
    const st = strideAt(u), w = jAt(st.s), P = w.pos, d = w.dir, r = rightOf(d);
    let cp, lk;
    if (tune.strideSide) {
      // (behind him and well round to his side, level with his hip, on a long lens: he walks across the frame and stays
      // where he is in it while the world beside and ahead of him cuts from one stretch of the way to the next; never his
      // face, his hair between it and the lens)
      const th = THREE.MathUtils.degToRad(tune.strideAngle);
      cp = P.clone().addScaledVector(d, -Math.cos(th) * tune.strideD).addScaledVector(r, tune.strideSide * Math.sin(th) * tune.strideD).add(V3(0, tune.strideUp, 0));
      lk = P.clone().addScaledVector(d, tune.strideLead).add(V3(0, 0.98, 0));
      cp.y = Math.max(cp.y, hB(cp.x, cp.z) + 0.55);
    } else {
      cp = P.clone().addScaledVector(d, -3.6).addScaledVector(r, 1.2).add(V3(0, 1.05, 0));
      lk = P.clone().addScaledVector(d, 7).addScaledVector(r, 0.9).add(V3(0, 0.95, 0));
    }
    const cr = smooth(CRANE[0], CRANE[1], u);
    if (cr > 0) {
      // (rising beside him and turning to the giant's trunk, its crown, as the motes begin)
      const e = cr * cr * (3 - 2 * cr);
      // (from the profile on his left the lens rises on that side, the giant beyond him all the while)
      cp.lerp(P.clone().addScaledVector(d, tune.strideSide < 0 ? -1.0 : -2.2).addScaledVector(r, tune.strideSide < 0 ? -3.4 : 2.4).add(V3(0, 5.5, 0)), e);
      lk.lerp(GIANT.clone().lerp(P, 0.25).add(V3(0, lerp(4, 16, e), 0)), e);
    }
    return { cp, lk };
  }
  const xuanAt = V3(), xuanN = V3(0, 1, 0);
  const shotOut = { fov: 46, fovW: 0, shot: '' };
  function shots(u, pos, look) {
    shotOut.fovW = 0; shotOut.shot = '';
    // the descent: out of the white over the basin, down the gold thread, into the clearing where he arrives
    const dw = cam.descent(u);
    if (dw > 0) {
      const t = smooth(109.6, 112.3, u);
      const e = 1 - Math.pow(1 - t, 1.35);
      pos.lerp(descent.getPointAt(e), dw);
      look.lerp(descentLook.getPointAt(e), dw);
    }
    // the six years at the camp: the lens of years.js (its own focal length, and the shot it is in, so a cut is a cut)
    const yw = cam.years(u);
    if (yw > 0) {
      const c = years.camera(u);
      pos.lerp(c.pos, yw);
      look.lerp(c.look, yw);
      shotOut.fov = c.fov; shotOut.fovW = yw; shotOut.shot = c.shot;
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
          const tt = snareT(u) * 0.999;
          const hp = u < 124.6 ? TALLYSTAND.clone() : TO_SNARE.getPointAt(tt);
          const w = flatDir(hp, TO_SNARE.getPointAt(Math.min(1, tt + 0.2))), sw = rightOf(w);
          cp.lerp(hp.clone().addScaledVector(w, -2.4).addScaledVector(sw, 1.0).add(V3(0, 1.7, 0)), ap);
          lk.lerp(hp.addScaledVector(w, 5).addScaledVector(sw, -0.5).add(V3(0, 1.0, 0)), ap);
        }
        if (sn > 0) lk.lerp(snareSpot, sn);
        // the omen, once, from straight above: the frost, his prints out to it, the empty loop (his reaching hand at the
        // edge of the frame); cut in and cut out
        if (u > OMEN[0] && u < OMEN[1]) {
          // (over the last of his prints and the loop, high enough for the trail of them to come in across the frame)
          const push = smooth(OMEN[0], OMEN[1], u), mid = snareSpot.clone().lerp(TO_SNARE.getPointAt(0.78), 0.45);
          cp = mid.clone().addScaledVector(SNARE.dir, -0.25).add(V3(0, 3.3 - 0.3 * push, 0));
          lk = mid.clone().addScaledVector(SNARE.dir, 0.05);
          shotOut.fov = 48; shotOut.fovW = 1; shotOut.shot = 'omen';
        }
      } else if (kind === 'stride') {
        ({ cp, lk } = strideShot(u));
        // (a long lens on him; wider as it rises up the giant)
        shotOut.fov = lerp(30, 50, smooth(CRANE[0], CRANE[1], u)); shotOut.fovW = jw; shotOut.shot = 'stride' + strideAt(u).k;
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
    // opens all the way he looks up, and the lens draws back and lifts with his eyes. Cut: low behind him, framed as the
    // great bolt was that night, the great tree up the middle of the frame, the light gathering in its crown, then the
    // pillar down out of the sky onto him and its ring of light running out over the whole floor. Cut: low across the
    // dell, the pillar standing on him, the leaves coming down through it. Cut: over his shoulder in its light again,
    // down into the page and the sign.
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
      if (u > TOUCH_IN[0] && u < TOUCH_IN[1]) {
        // (the insert, a cut in and a cut out: level with his hand held out over the crystal, from his right: the palm,
        // the drop gathering under it and falling, the seams opening from where it lands, his blood running into them)
        // (from over his left side, looking down onto the crystal's face where it lands and the hand held out over it from
        // the far side: from its end the lens was among its points, which crossed the frame as glass sheets)
        const t = smooth(TOUCH_IN[0], TOUCH_IN[1], u);
        cp = TOUCH.clone().addScaledVector(rk, tune.touchR - 0.06 * t).addScaledVector(hk, -tune.touchFront).add(V3(0, tune.touchUp - 0.02 * t, 0));
        lk = TOUCH.clone().addScaledVector(hk, 0.02).add(V3(0, 0.075 - 0.02 * t, 0));
        shotOut.fov = tune.touchFov; shotOut.fovW = 1; shotOut.shot = 'touch';
      } else if (u < UP_CUT) {
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
        // (behind him, low, as the great bolt was framed behind him that night: him small and kneeling at the foot of the
        // frame, the great tree going up the middle of it, the light gathering in its crown; the pillar coming down onto
        // him, a column of light down the middle of the frame where the bolt was, and its ring of light running out over
        // the whole floor; pushing in)
        const t = smooth(UP_CUT, WIDE_CUT, u);
        const a = Math.atan2(hk.z, hk.x) + Math.PI - tune.pillarA, R = lerp(tune.pillarR, tune.pillarR * 0.96, t);
        cp = onG(SCROLL.clone().add(V3(Math.cos(a) * R, 0, Math.sin(a) * R))).add(V3(0, lerp(1.7, 1.5, t), 0));
        lk = SCROLL.clone().add(V3(0, lerp(tune.pillarLook, tune.pillarLook * 0.91, t), 0));
        if (tune.pillarFov) { shotOut.fov = tune.pillarFov; shotOut.fovW = 1; }
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
      // (the insert is a cut: all of it, whatever the scroll shot's weight)
      const w = shotOut.shot === 'touch' ? 1 : sw;
      pos.lerp(cp, w);
      look.lerp(lk, w);
    }
    // what fell, waiting for him: low among the roots behind the crystal, its gold heart and the shadow of the scroll in
    // it in front of the lens, his feet coming across the leaves toward it (never his face), pushing in a little; cut to
    // behind him as he kneels
    if (u > CRYSTAL_IN[0] && u < CRYSTAL_IN[1]) {
      const t = smooth(CRYSTAL_IN[0], CRYSTAL_IN[1], u), c = A.scrollSpot || SCROLL;
      const f = flatDir(c, LAND), sd = rightOf(f);
      pos.copy(c).addScaledVector(f, -(tune.crystalBack - 0.1 * t)).addScaledVector(sd, tune.crystalSide).add(V3(0, tune.crystalUp, 0));
      // (looking down at it: his feet coming to it across the leaves at the top of the frame, never his face)
      look.copy(c).addScaledVector(f, 5).addScaledVector(sd, -tune.crystalSide * 1.6).add(V3(0, lerp(tune.crystalLook, tune.crystalLook2, smooth(0.35, 1, t)), 0));
      shotOut.fov = lerp(tune.crystalFov, tune.crystalFov2, smooth(0.35, 1, t)); shotOut.fovW = 1; shotOut.shot = 'crystal';
    }
    return shotOut;
  }

  // ------------------------------------------------------------ the sun through the day
  // (the morning he comes: low ahead and to the right of the way the eye comes in, long shadows over the snow)
  const sunDirs = [[108, V3(0.36, 0.2, -0.91)], [111.5, V3(0.36, 0.24, -0.9)], [112.6, V3(-0.62, 0.55, 0.56)], [123.6, V3(-0.62, 0.55, 0.56)],
    [124.6, V3(-0.5, 0.42, -0.76)], [128.6, V3(-0.58, 0.36, -0.73)], [131.4, V3(-0.62, 0.3, -0.72)], [133.0, V3(-0.5, 0.56, -0.66)], [145, V3(-0.5, 0.56, -0.66)]];
  function sunDir(u) {
    const ss = strideSun(u);
    if (ss) return ss;
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
  function update(u, time, camera, { inB, sample, hero, ghosts: ghostFigures, pxScale, lamp }) {
    trailB.uniforms.uTime.value = time;
    if (pxScale) px = pxScale;
    // (out of the forest: nothing of it in his hands or on his back; the knife too, which the valley's hero carries mounted
    // once the forest has been seen, and which showed in his fist all the way through the village)
    if (!inB) { bow.group.visible = false; bowBack.group.visible = false; knife.visible = false; qiFar.points.visible = qiNear.points.visible = false; return; }
    U.uSnow.value = sample('snowCover');
    U.uWet.value = sample('wet');
    U.uAutumn.value = sample('autumn');
    U.uBlossom.value = sample('blossom');
    U.uMoss.value = 0.8;
    U.uStage.value = FT.stage(u);
    // (the old tally marks of the camp kit stay hidden: the marks are made in front of the eye now)
    U.uYears.value = 0;
    // the marks: each drawn across the bark with the knife, then greying through the years after
    notches.forEach((nt, k) => {
      const [a, b] = scoreOf(k);
      nt.uni.uProg.value = smooth(a, b, u);
      nt.uni.uFresh.value = 1 - 0.85 * smooth(b + 0.4, b + 4.2, u);
      nt.mesh.visible = u > a && u < 124.8;
    });
    omen.g.visible = u > 124.55 && u < 126.3;
    if (omen.g.visible) { const w = smooth(124.6, 125.15, u); for (const p of omen.prints) p.m.visible = w >= p.t - 0.002; }
    chips.uniforms.uU.value = u;
    chips.uniforms.uPx.value = px;
    chips.uniforms.uLight.value = lerp(0.85, 1.15, sample('snowCover'));
    chips.pts.visible = u > scoreOf(0)[0] - 0.02 && u < scoreOf(5)[1] + 0.6;
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
    // the knife in his right fist while he works with it (the blade out of the thumb side for the marks)
    if (hero && !knifeMounted) { knife.rotation.set(0, 0, 0); knife.position.set(0, 0, 0); hero.attach('handR', knife); knifeMounted = true; }
    {
      const w = u > 112.9 && u < 124.6 ? years.hero(u, {}) : null;
      knife.visible = knifeMounted && !!w && w.visible && (w.carve || 0) > 0.04;
      knife.rotation.z = w && w.knifeFlip ? Math.PI : 0;
    }
    // the things in his hands through the years (the engine's spare figures hold some of them)
    years.update(u, { ghosts: ghostFigures || [] });
    if (hero && !bowMounted) {
      bow.group.rotation.set(0, Math.PI, 0); bow.group.position.set(0, 0, -0.2); hero.attach('handL', bow.group);
      bowBack.group.rotation.set(0.25, 0, Math.PI * 0.5 + 0.35); bowBack.group.position.set(0.02, 0.05, -0.12); hero.attach('back', bowBack.group);
      bowBack.arrow.visible = false;
      bowMounted = true;
    }
    // (on his back the whole way out, his hands free: held low at his side the bow read as a blade; and none in the dell,
    // where the frame is his hands, the crystal and the scroll)
    bow.group.visible = false;
    bowBack.group.visible = bowMounted && u >= 124.6 && u < 132.0;
    bow.update(0); bowBack.update(0);
    // the missed beat's mote
    moteAt(u, camera);
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
    // (thinned round him while the crystal is close in front of the lens, so it is seen, not snowed over)
    qiNear.set({ time, amt: qk * 0.9 * (1 - smooth(138.6, 139.6, u)) * (1 - 0.72 * band(134.6, 134.7, 137.4, 137.8, u)), center: (hero ? hero.group.position.clone() : here).add(V3(0, 1.4, 0)), radius: 3.2, target, org: FT.org(u) * 0.35, px });
    // the crystal: waking, cracking with light from where his blood falls on it, breaking into motes
    const glow = FT.glow(u);
    // the drop of his blood: gathering under his palm, falling, gone into the crystal (drawn out a little as it falls)
    bloodDrop.visible = !!hero && u > DROP[0] && u < DROP[2];
    if (bloodDrop.visible) {
      const f = smooth(DROP[1], DROP[2], u), g = smooth(DROP[0], DROP[1], u);
      const from = hero.anchors.handR().add(V3(0, -0.014, 0));
      bloodDrop.position.copy(from).lerp(TOUCH, f * f);
      bloodDrop.scale.set(0.35 + 0.65 * g, (0.35 + 0.65 * g) * (1 + 0.7 * band(DROP[1], DROP[1] + 0.02, DROP[2] - 0.02, DROP[2], u)), 0.35 + 0.65 * g);
    }
    // (his blood in it from where the drop lands: it seeps into the seams as they open from there; blood recognition)
    if (set.crystal) set.crystal.update(time, { glow: clamp(glow), crack: FT.crack(u), shatter: FT.shatter(u), blood: smooth(DROP[2] - 0.01, DROP[2] + 0.03, u) });
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

  // (the lens may come close by him without hiding him: on the bark over his shoulder)
  const allowNear = u => years.closeNow(u);
  // (for staging: a fresh copy of years.js swapped in without loading the page again)
  const restageYears = mod => { years.dispose(); years = mod.createYears(yearsArgs); return years; };
  return { root, set, anchors: A, fogFloor: 0, sunDir, wuhen, ghosts, shots, update, scroll, trail: trailB, allowNear, get years() { return years; }, restageYears, tally: { notch, STAND, tn, tRight, knife }, dell: { KNEEL, SCROLL, LAND }, light, tune };
}
