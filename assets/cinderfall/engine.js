// Cinderfall engine: renders the story for any position u (see timeline.js).
// Two places: the valley of Cinderfall (u < 108) and, beyond the ridges, the Forbidden Forest.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { installFog, injectFog, FOGU } from './atmosphere.js';
import { createMaterials, U, TOON, liteAll } from './materials.js';
import { buildWorld } from './world.js';
import { createSky, createMist } from './sky.js';
import { createRanges, groundAt } from './ranges.js';
import { createFire, createSmoke, createPoints, createBirds, createFallingStar, createStrands } from './fx.js';
import { createLightning, createRain, createCloudBank, createGroundStrikes } from './weather.js';
import { makePerson } from './people3d.js';
import { createHero, createElder } from './hero.js';
import { createSpirit } from './hero-spirit.js';
import { createQi, createOrb } from './qi.js';
import { createBurst } from './burst.js';
import { createGoldTrail } from './trail.js';
import { createVillageLife } from './village-life.js';
import { createBonds } from './bonds.js';
import { createPetalGust } from './petal-gust.js';
import { WAKE } from './decor.js';
import { createBirdBurst } from './bird-burst.js';
import { createFighters } from './fighters.js';
import { createDuel, DUEL_P } from './duel.js';
import { createWar, WAR, shot as warShotAt, goldAt as warGold, BLOWS as WAR_BLOWS, BOLTS as WAR_BOLTS, TRENCH as WAR_TRENCH, W0 as WAR_C } from './war.js';
import { createMegaBolt } from './mega-bolt.js';
import { createCharge } from './charge.js';
import { createImpact } from './impact.js';
import { createCloudRush } from './cloud-rush.js';
import { createAuras } from './weapons.js';
import { addValleySakura } from './valley-flora.js';
import { createSect, CRAG } from './sect.js';
import { createPost } from './post.js';
import { pauseAt, sToU, env, cam, fx, mcZ, porchBlend, morningK, enterK, rushK, kneelK, handDrop, turnYaw, brokenAt, worldBAt, STRIKES, STAR, STRIKE_B, inkfx, forest as FT, barsAt, SILENCE } from './timeline.js';
import { roadX, roadY, heightAt, streamZ, BRIDGE_Z } from './layout.js';
import { clamp, lerp, smooth, band, rng, track } from './util.js';

export function detectQuality() {
  const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const q = new URLSearchParams(location.search).get('q');
  const low = q === 'low' || (mobile && q !== 'high');
  const cores = navigator.hardwareConcurrency || 4;
  return {
    low, mobile,
    dpr: Math.min(devicePixelRatio || 1, low ? 1.25 : cores >= 8 ? 1.75 : 1.5),
    shadows: true, shadowSize: low ? 1024 : 2048,
    grass: low ? 8000 : 20000, flowers: low ? 800 : 2200,
    terrainCols: low ? 180 : 260, terrainRows: low ? 200 : 300,
    embers: low ? 700 : 1800, smoke: low ? 160 : 360,
    bloom: true, msaa: low ? 0 : 4, lowVeg: low,
  };
}

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const DEBUG = new URLSearchParams(location.search).has('debug');
const along = (pts, t) => { const n = pts.length - 1, f = clamp(t) * n, i = Math.min(n - 1, Math.floor(f)), k = f - i, kk = k * k * (3 - 2 * k); return pts[i].clone().lerp(pts[i + 1], kk); };
// Catmull-Rom through points (smooth camera paths)
const spline = (pts, t) => { const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); return c.getPointAt(clamp(t)); };
// a look point from `from` that turns evenly from looking at a to looking at b (w 0..1): the eye's angular speed is the
// turn's, never a whip when a near and a far target trade places
function turnTo3(from, a, b, w) {
  const da = a.clone().sub(from).normalize(), db = b.clone().sub(from).normalize();
  const ang = Math.acos(clamp(da.dot(db), -1, 1));
  if (ang < 1e-4 || w <= 0) return from.clone().addScaledVector(da, 30);
  const s0 = Math.sin((1 - w) * ang) / Math.sin(ang), s1 = Math.sin(w * ang) / Math.sin(ang);
  return from.clone().addScaledVector(da.multiplyScalar(s0).addScaledVector(db, s1).normalize(), 30);
}
// a smooth, monotone ease through [u, value] keys: passes every key without stopping or overshooting, eases in and out
// at the ends (piecewise cubic Hermite with Fritsch-Butland slopes)
function monoKeys(keys) {
  const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue;
    const h0 = xs[i] - xs[i - 1], h1 = xs[i + 1] - xs[i], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

export async function createEngine(canvas) {
  // (?cold, for measuring a first visit: every shader made slightly different, so neither the browser's cache of
  // compiled programs nor the driver's knows any of them)
  if (/[?&]cold\b/.test(location.search)) THREE.ShaderChunk.common = THREE.ShaderChunk.common.replace('#define PI 3.141592653589793', `#define PI ${(3.14159265 + Math.random() * 1e-6).toFixed(10)}`);
  installFog();
  const quality = detectQuality();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(quality.dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xcdd6d4, 0.0015);
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.08, 3400);

  // (where the build's time goes, for measuring: window.__cf.engine.marks)
  const marks = [];
  const mark = n => marks.push([n, Math.round(performance.now())]);
  mark('start');
  const mats = createMaterials(renderer);
  mark('materials');
  const world = buildWorld(mats, quality);
  mark('world');
  scene.add(world.root);
  // blooming sakura through the village and along the road
  try { addValleySakura(world.root, quality, world); } catch (e) { console.warn('sakura unavailable', e); }
  const sect = createSect(mats, quality);
  world.root.add(sect.group);
  // (its light in the scene itself: the valley is hidden from high up and in the forest, and a light coming and going
  // with it would recompile every lit material)
  scene.add(sect.light);
  mark('sakura+sect');
  const sky = createSky(renderer, quality);
  mark('sky');
  scene.add(sky.mesh);
  // the fight above the clouds and what comes of it: the charge gathering in the storm's base over the valley, the
  // great bolt down from it onto the western slope a stone's throw from Cinderfall, before him where he stands at the
  // edge of the pines; and what fell in it, thrown up out of the fire and away west over the ridges, to come down
  // beyond them in the forest where no one goes (where he finds it, six years on)
  const CLASH_C = V3(-1170, 2650, 1070);
  const S_HIT = V3(-190, 0, -40);
  S_HIT.y = heightAt(S_HIT.x, S_HIT.z);
  const C_F = V3(-176, 760, -52);
  const S_FAR = V3(-1450, 200, 150);
  // the eye of the gathering the fight stirs up over the valley, west-south-west of the old pines (xz; its width: the
  // sky's uHole.w)
  const EYE = V3(-1165, 0, 395);
  // (what fell, thrown out of the fire: up over the ridges and down beyond them) [u0, u1]
  const GOLD = [55.15, 56.55];
  const duel = createDuel();
  const mountains = createRanges(quality, sky.uniforms);
  scene.add(mountains.group);
  const mist = createMist();
  mark('ranges+mist');
  scene.add(mist.group);
  const A = world.anchors, H = A.houses, UH = H.uncle;

  // ---------------------------------------------------------------- lights
  const sun = new THREE.DirectionalLight(0xffd29a, 3.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  const sc = sun.shadow.camera;
  sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 1; sc.far = 420;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const sunDirA = V3(-0.72, 0.36, 0.5).normalize();
  const airFire = new THREE.Color();
  const hemi = new THREE.HemisphereLight(0xa9c4ef, 0x6b5a3c, 1);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8e9cc8, 0);
  moon.position.set(-60, 120, -40);
  scene.add(moon);
  const flashLight = new THREE.DirectionalLight(0xc9c8ff, 0);
  flashLight.position.set(-80, 200, -300);
  scene.add(flashLight, flashLight.target);
  const fireLights = Array.from({ length: quality.low ? 5 : 8 }, () => { const l = new THREE.PointLight(0xff6424, 0, 60, 1.6); scene.add(l); return l; });
  const interior = new THREE.PointLight(0xff9a48, 0, 12, 1.8);
  const interior2 = new THREE.PointLight(0xff7a30, 0, 9, 1.8);
  const faceLight = new THREE.PointLight(0xff9a50, 0, 4.5, 1.6);
  scene.add(interior, interior2, faceLight);
  const crystalLight = new THREE.PointLight(0x58e0d8, 0, 6, 1.5);
  if (A.crystal) crystalLight.position.copy(A.crystal).add(V3(0, 0.3, 0));
  scene.add(crystalLight);
  // ---------------------------------------------------------------- the lights, pooled
  // On Windows the browser prepares each lit material's shader the first time it is drawn, one at a time, and every
  // point light in the scene adds ~11 ms to each (measured on an RTX 4080 desktop: 356 ms a material with the story's
  // 16 point lights, 241 ms with 6). The story's lights (eight fires, two in the house, his face, the crystal, the
  // blade, the crag, the camp fire and the scroll) are kept as they are, for the story to drive, but three does not
  // see them: each frame the few that light most of what is on screen are given to POOL real lights, fading as they
  // swap, so nothing pops (at a cut they are set at once); and the number three compiles for never changes, in the
  // valley or the forest.
  const POOL = quality.low ? 4 : 5;
  const pool = Array.from({ length: POOL }, () => { const light = new THREE.PointLight(0xffffff, 0, 1, 2); light.name = 'pool'; scene.add(light); return { light, v: null, want: null, w: 0 }; });
  const virtual = [];
  // (every point light found is taken over: called once the valley is built, and again once the forest is)
  function poolLights() {
    scene.traverse(o => { if (o.isPointLight && o.name !== 'pool' && !o.userData.cfVirtual) { o.userData.cfVirtual = true; o.userData.cfWP = new THREE.Vector3(); virtual.push(o); } });
    for (const l of virtual) l.visible = false;
  }
  const _frus = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere(), _cand = [];
  const _fwd = V3(), _sp = V3(), _lastCam = V3(1e9, 0, 0), _lastFwd = V3();
  // (points along the view, metres ahead of the camera, where each light's worth is taken)
  const VIEW_D = [0, 2.5, 6, 12, 24];
  let poolT = performance.now();
  function syncPool() {
    const now = performance.now(), raw = Math.max(0, (now - poolT) / 1000), dt = Math.min(0.1, raw);
    poolT = now;
    camera.updateMatrixWorld();
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frus.setFromProjectionMatrix(_pm);
    camera.getWorldDirection(_fwd);
    // a cut (the camera somewhere else from one frame to the next) or a long gap: the lights are set at once, no fading
    const cut = raw > 0.3 || _lastCam.distanceTo(camera.position) > 4 || _lastFwd.dot(_fwd) < 0.87;
    _lastCam.copy(camera.position); _lastFwd.copy(_fwd);
    // what each light is worth on screen: how brightly it lights what is in front of the camera (its strength and
    // three's own falloff, at the brightest of a few points along the view)
    _cand.length = 0;
    for (const l of virtual) {
      l.userData.cfOn = false;
      if (!(l.intensity > 0)) continue;
      let p = l.parent;
      while (p && p !== scene && p.visible) p = p.parent;
      if (p !== scene) continue;
      l.updateWorldMatrix(true, false);
      const wp = l.userData.cfWP.setFromMatrixPosition(l.matrixWorld);
      const range = l.distance > 0 ? l.distance : Infinity;
      if (!_frus.intersectsSphere(_sph.set(wp, Math.min(range, 400)))) continue;
      let lit = 0;
      for (const d of VIEW_D) {
        const r = Math.max(0.5, _sp.copy(camera.position).addScaledVector(_fwd, d).distanceTo(wp));
        let f = 1 / Math.max(Math.pow(r, l.decay), 0.01);
        if (range < Infinity) { const x = Math.min(1, r / range); f *= (1 - x ** 4) ** 2; }
        lit = Math.max(lit, f);
      }
      let score = l.intensity * (0.3 * l.color.r + 0.59 * l.color.g + 0.11 * l.color.b) * lit;
      if (!cut && pool.some(sl => sl.v === l)) score *= 1.5;   // (a light already shown keeps its place unless clearly beaten)
      l.userData.cfOn = true; l.userData.cfScore = score;
      _cand.push(l);
    }
    _cand.sort((a, b) => b.userData.cfScore - a.userData.cfScore);
    const best = _cand.slice(0, POOL);
    for (const sl of pool) sl.want = best.includes(sl.v) ? sl.v : null;
    for (const l of best) if (!pool.some(sl => sl.want === l)) { const sl = pool.find(x => x.want === null && x.w <= 0) || pool.find(x => x.want === null); if (sl) sl.want = l; }
    // fade: out before a slot changes hands, then in (at a cut, straight to where they should be)
    for (const sl of pool) {
      if (cut) { sl.v = sl.want; sl.w = sl.v ? 1 : 0; }
      else if (sl.v !== sl.want) { sl.w -= dt * 8; if (sl.w <= 0) { sl.w = 0; sl.v = sl.want; } }
      else if (sl.v) sl.w = Math.min(1, sl.w + dt * 8);
      const L = sl.light, v = sl.v;
      if (!v || !v.userData.cfOn) { L.intensity = 0; continue; }
      L.position.copy(v.userData.cfWP);
      L.color.copy(v.color); L.distance = v.distance; L.decay = v.decay;
      L.intensity = v.intensity * sl.w;
    }
  }
  const fireClusters = Object.values(H).map(h => ({ p: h.roofTop.clone().lerp(h.porchFront || h.center, 0.35).add(V3(0, 1.2, 0)), delay: Math.max(0, Math.min(0.55, (h.def.z + 40) / 260)), burn: h.def.burn ?? 1 }));

  // ---------------------------------------------------------------- effects
  // keep the column the light rises up through the broken roof clear (the flames either side of it stay)
  const riseCol = UH.local(-0.07, 0, 1.11);
  const roofFire = A.fire.filter(f => !(f.house === 'uncle' && Math.hypot(f.p.x - riseCol.x, f.p.z - riseCol.z) < 2.3 && f.p.y > riseCol.y + 2.2));
  // (and where the great bolt came down on the slope west of the village: the hillside burns there from the strike on)
  // (not a disc of flame: a ragged burn, drawn out along the slope, hotter in the crater, broken patches of burning
  // grass round it with dark ground between, smaller flames the farther out)
  const craterFire = [];
  {
    const q = rng(4417);
    for (let i = 0; i < 30; i++) {
      const a = q() * Math.PI * 2, lobe = 0.62 + 0.38 * Math.sin(a * 3 + 1.3) * Math.sin(a * 2 - 0.4);
      const f = i < 5 ? q() * 0.25 : 0.25 + Math.pow(q(), 0.7) * 0.75, rr = 2 + f * 21 * lobe;
      const x = S_HIT.x + Math.cos(a) * rr * 1.25, z = S_HIT.z + Math.sin(a) * rr * 0.8;
      craterFire.push({ p: V3(x, heightAt(x, z) + 0.5, z), s: lerp(6.5, 2.2, f) * q.range(0.8, 1.15), delay: 0.02 + f * 0.12, house: 'crater', burn: 1 });
    }
  }
  const firePoints = [...craterFire, ...roofFire, ...(UH.interiorFire || []).map(f => ({ ...f, delay: 0.05 }))];
  mark('lights');
  const fire = createFire(firePoints, quality.low ? 760 : 1180);
  scene.add(fire.mesh);
  // (the uncle's house smokes from the back of its roof, so the light rises clear of the column, in front of it)
  const smokeAt = A.smoke.map(e => e.house === 'uncle' ? { ...e, p: UH.local(4.2, e.p.y - UH.frame.plat - 0.9, -0.6) } : e);
  const smoke = createSmoke(smokeAt, { count: quality.smoke, height: 34, spread: 7, size: [3, 13], speed: [0.025, 0.05], alpha: 0.6, wind: [7, 3] });
  scene.add(smoke.mesh);
  const embers = createPoints({ count: quality.embers, mode: 'embers', emitters: roofFire, color: [1, 0.42, 0.12], size: 2.2, speed: 0.12, height: 26 });
  scene.add(embers.points);
  const ash = createPoints({ count: quality.low ? 900 : 2200, mode: 'ash', box: [70, 34, 70], color: [0.62, 0.58, 0.54], size: 1.5, additive: false });
  scene.add(ash.points);
  const snow = createPoints({ count: quality.low ? 1400 : 3200, mode: 'snow', box: [60, 30, 60], color: [0.95, 0.96, 1.0], size: 1.25, additive: false });
  scene.add(snow.points);
  const leaves = createPoints({ count: quality.low ? 240 : 560, mode: 'leaves', box: [44, 18, 44], color: [0.5, 0.6, 0.3], size: 1.5, additive: false });
  scene.add(leaves.points);
  const pollen = createPoints({ count: quality.low ? 500 : 1300, mode: 'pollen', box: [46, 18, 46], color: [1, 0.86, 0.5], size: 0.9 });
  scene.add(pollen.points);
  const petals = createPoints({ count: quality.low ? 220 : 520, mode: 'petals', box: [40, 14, 40], color: [1, 0.74, 0.82], size: 1.3, additive: false });
  scene.add(petals.points);
  // the opening's gust of blossom, blown across the frame as the camera comes down to him
  const gust = createPetalGust({ count: quality.low ? 2000 : 5200 });
  // (and when the light from the hit runs over the edge of the pines, the wind behind it tears the blossom off the tree)
  const gust2 = createPetalGust({ count: quality.low ? 900 : 2400 });
  gust2.uniforms.uMinD.value = 9;
  scene.add(gust.mesh, gust2.mesh);
  const motes = createPoints({ count: 420, mode: 'motes', box: [14, 8, 14], color: [1, 0.72, 0.3], size: 0.7 });
  scene.add(motes.points);
  const rain = createRain(quality.low ? 1200 : 2600);
  scene.add(rain.mesh);
  const cloudBank = createCloudBank(quality.low ? 50 : 80);
  scene.add(cloudBank.mesh);
  const sparks = A.sparks ? createPoints({ count: 120, mode: 'sparks', emitters: [{ p: A.sparks, s: 0.05 }], color: [1, 0.6, 0.2], size: 1.2 }) : null;
  if (sparks) scene.add(sparks.points);
  const houseSmoke = createSmoke((UH.interiorFire || []).slice(0, 4).map(f => ({ p: f.p.clone().add(V3(0, 0.9, 0)), s: 0.5 })), { count: 70, color: [0.06, 0.05, 0.05], glow: [1, 0.3, 0.08], height: 2.6, spread: 1.2, size: [0.8, 2.6], speed: [0.05, 0.1], alpha: 0.28, wind: [0.3, -0.4] });
  scene.add(houseSmoke.mesh);
  const steam = A.steam.length ? createSmoke(A.steam, { count: 40, color: [0.92, 0.92, 0.9], glow: [0, 0, 0], height: 4, spread: 0.6, size: [0.4, 1.8], speed: [0.12, 0.22], alpha: 0.32, wind: [0.6, 0.2] }) : null;
  if (steam) scene.add(steam.mesh);
  const chimney = createSmoke(A.chimney, { count: 90, color: [0.7, 0.7, 0.7], glow: [0, 0, 0], height: 14, spread: 1.2, size: [0.6, 4], speed: [0.03, 0.06], alpha: 0.22, wind: [4, 1] });
  scene.add(chimney.mesh);
  const incense = createSmoke([{ p: A.shrine, s: 0.02 }], { count: 16, color: [0.85, 0.85, 0.85], glow: [0, 0, 0], height: 3, spread: 0.3, size: [0.08, 0.6], speed: [0.08, 0.14], alpha: 0.35, wind: [0.4, 0.1] });
  scene.add(incense.mesh);
  const vapor = createPoints({ count: 6 * 24, mode: 'vapor', emitters: world.wolves.map(() => ({ p: V3(), s: 0 })), color: [0.85, 0.08, 0.06], size: 1.0, speed: 0.4 });
  scene.add(vapor.points);
  const birds = createBirds(quality.low ? 18 : 34);
  scene.add(birds.mesh);
  // the flock that bursts out of the old pines when the forest falls silent
  // (the flock in the pines over the mushrooms, still through the held breath, bursts up with the launch)
  const BURST_AT = 47.47;
  const birdBurst = createBirdBurst({ count: quality.low ? 120 : 260, at: BURST_AT });
  scene.add(birdBurst.mesh);
  const star = createFallingStar();
  // what fell: the gold one, struck down inside the great bolt onto the slope beside the village; then, out of the
  // fire there, thrown up and away west over the ridges, burning, to come down in the forest beyond them
  const STAR_A = C_F.clone(), STAR_B = C_F.clone().lerp(S_HIT, 0.5).add(V3(-12, 0, 8)), STAR_C = S_HIT.clone();
  const GOLD_A = S_HIT.clone().add(V3(0, 14, 0)), GOLD_B = V3(-760, 1150, -380), GOLD_C = S_FAR.clone();
  star.setPath(STAR_A, STAR_B, STAR_C);
  let starPhase = 1;
  const goldK = u => clamp((u - GOLD[0]) / (GOLD[1] - GOLD[0]));
  const goldAt = (u, out = V3()) => { const s = goldK(u), r = 1 - s; return out.copy(GOLD_A).multiplyScalar(r * r).addScaledVector(GOLD_B, 2 * r * s).addScaledVector(GOLD_C, s * s); };
  const megaBolt = createMegaBolt();
  megaBolt.build(C_F, S_HIT.clone().add(V3(0, 2, 0)), 9137, 610);
  scene.add(megaBolt.mesh);
  // where it comes down: the shock dome, the blaze, the embers
  const impact = createImpact({ noise: U.uNoise.value, embers: quality.low ? 500 : 1100, groundAt, scale: 0.58, throw: 0.8 });
  scene.add(impact.group);
  // the charge: sparks of lightning gathering in the cloud into one point, a knot of light there
  const charge = createCharge({ count: quality.low ? 1300 : 2800, noise: U.uNoise.value });
  // what only he sees in the smith's wares
  const auras = A.auras ? createAuras(A.auras, U.uNoise.value, A.stallFill) : null;
  // (lights live in the scene itself, never in a group that is hidden and shown: see sect.light)
  if (auras) { world.root.add(auras.group); scene.add(auras.light); }
  // (the one that is not like the others, and where he stops to look at it: a step off the road toward the stall)
  const legendAura = A.auras ? (A.auras.find(x => x.tier === 4) || A.auras[0]) : null;
  const legend = legendAura ? legendAura.base.clone().addScaledVector(legendAura.dir, legendAura.len * 0.45) : null;
  // (done stepping back into the middle of the street before the cut ahead at 28.05: mcZ)
  const stallK = u => band(25.4, 26.15, 27.4, 28.0, u);
  scene.add(charge.group);
  // the shreds of cloud rushing past the eye as it dives through the sea's top and the storm
  const rush = createCloudRush({ count: quality.low ? 40 : 70, noise: U.uNoise.value });
  scene.add(rush.mesh);
  const _rl = new THREE.Color(), _rh = new THREE.Color(), _rc = new THREE.Color(), _scr = new THREE.Vector2();
  scene.add(star.group);
  // the uncle's soul: motes of gold about its heart, a comet's tail as it goes west
  const soulQi = createQi({ count: quality.low ? 500 : 900, size: 0.15, seed: 5 });
  scene.add(soulQi.points);
  // ...and the light it is from afar: a star over the burning valley that leads him west
  const soulOrb = createOrb({ lamp: crystalLight, light: 0xffd2a0 });
  scene.add(soulOrb.mesh);
  // that night in the fields: a ribbon of its light streaming back to him as he runs after it, and the fireflies the
  // grass gives up as it goes over
  const leadQi = createQi({ count: quality.low ? 260 : 480, color: [1.0, 0.78, 0.42], intensity: 4.2, size: 0.1, seed: 11 });
  scene.add(leadQi.points);
  const flies = createQi({ count: quality.low ? 320 : 640, color: [0.55, 1.0, 0.72], intensity: 2.6, size: 0.075, seed: 13 });
  scene.add(flies.points);
  const lightning = createLightning(12);
  // the two lights fighting above the clouds, drawn crisp over the deck
  const fighters = createFighters();
  scene.add(fighters.group);
  // the war, close to: the two as people, what they throw at each other, the lens among them (war.js)
  const war = createWar();
  scene.add(war.group);
  scene.add(lightning.group);
  // the strikes that hunt him down the road on the run home (their own channels, burns and sparks)
  const gStrikes = createGroundStrikes(heightAt, 2);
  scene.add(gStrikes.group);
  // blood-red qi drifting over the burning village and along the road home (drawn as vermilion strokes in the ink)
  const strands = createStrands(quality.low ? { village: 6, road: 4, near: 3, seg: 48 } : {});
  lightning.group.add(strands.mesh);

  // ---------------------------------------------------------------- Wuhen, near and far, and the uncle
  // the 3D hero (hero.js): origin at his feet, faces +Z; the engine yaws him to `heading` and drives his pose state.
  // Built in idle time once the valley is on screen (prepareForest), or on demand when he is first needed.
  let wuhen = null, heldAnchor = null, wPrev = null, lastSpeed = 0;
  const basketGeo = new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.18, 0.2], [0.17, 0.22], [0, 0.22]].map(p => new THREE.Vector2(p[0], p[1])), 12);
  const basketMat = new THREE.MeshStandardMaterial({ map: mats.straw.map, roughness: 0.95 });
  const held = new THREE.Group();
  const hb = new THREE.Mesh(basketGeo, basketMat);
  hb.castShadow = true;
  held.add(hb);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 4, 16, Math.PI), basketMat);
  handle.position.y = 0.2;
  handle.castShadow = true;
  held.add(handle);
  // the mushroom he picks and holds up to look at: by its stem in his right fist, the cap standing up above the thumb
  // (the hand anchor's +Y). A brown cap rolled over at the rim, pale gills under it, a stem flaring a little at its foot.
  const heldMush = new THREE.Group();
  {
    const lathe = (pts, n = 18) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), n);
    const capTop = lathe([[0.047, 0.051], [0.049, 0.056], [0.046, 0.064], [0.039, 0.071], [0.029, 0.077], [0.016, 0.081], [0, 0.082]]);
    const capUnder = lathe([[0.0105, 0.047], [0.024, 0.049], [0.038, 0.05], [0.046, 0.0505], [0.047, 0.051]].reverse());
    const stem = lathe([[0, -0.052], [0.0125, -0.052], [0.0135, -0.04], [0.0115, -0.01], [0.0104, 0.025], [0.0102, 0.048], [0, 0.048]], 12);
    const capM = new THREE.MeshStandardMaterial({ color: 0x7a3d1a, roughness: 0.55 });
    const paleM = new THREE.MeshStandardMaterial({ color: 0xe6d9bf, roughness: 0.8, side: THREE.DoubleSide });
    for (const [g, m] of [[capTop, capM], [capUnder, paleM], [stem, paleM]]) { const me = new THREE.Mesh(g, m); me.castShadow = true; heldMush.add(me); }
    // (a crumb of the soil it grew in, on its foot)
    const soil = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 1 }));
    soil.position.set(0.004, -0.05, 0.002); soil.scale.set(1.2, 0.6, 1);
    heldMush.add(soil);
    heldMush.position.set(0, 0.012, 0);
    heldMush.scale.setScalar(1.3);
    heldMush.visible = false;
  }
  // the basket hangs from his left hand by the top of its handle (kept upright, see hangBasket)
  const getWuhen = () => {
    if (!wuhen) {
      wuhen = createHero({ age: 0 });
      wuhen.group.name = 'wuhen';
      wuhen.stale = true;
      scene.add(wuhen.group);
      injectFog(wuhen.group);
      heldAnchor = wuhen.attach('handL', held);
      wuhen.attach('handR', heldMush);
      debug.hero = wuhen;
    }
    return wuhen;
  };
  const _hq = new THREE.Quaternion(), _hq2 = new THREE.Quaternion(), _hv = V3(), _hy = V3();
  function hangBasket() {
    heldAnchor.updateWorldMatrix(true, false);
    heldAnchor.getWorldQuaternion(_hq);
    // yaw from the grip axis (anchor +Y) projected on the ground, so the handle runs through the fist
    _hv.set(0, 1, 0).applyQuaternion(_hq).setY(0);
    if (_hv.lengthSq() < 1e-6) _hv.set(1, 0, 0);
    _hv.normalize();
    _hq2.setFromUnitVectors(V3(1, 0, 0), _hv);
    held.quaternion.copy(_hq).invert().multiply(_hq2);
    // the top of the handle (0, 0.35, 0) sits in the grip
    held.position.set(0, -0.35, 0).applyQuaternion(held.quaternion);
  }
  // the basket when his fingers open: it falls from his hand, lands, tips on its side, and the caps spill out of its
  // mouth (+x of the group, turned toward his left and ahead); a pure function of u (see dropBasket)
  const dropped = new THREE.Group();
  const db = new THREE.Mesh(basketGeo, basketMat);
  db.castShadow = true;
  dropped.add(db);
  // (its handle, so on the ground it is still a basket)
  { const dh = new THREE.Mesh(handle.geometry, basketMat); dh.position.y = 0.2; dh.castShadow = true; db.add(dh); }
  const capGeo = new THREE.SphereGeometry(0.05, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), capMat = new THREE.MeshStandardMaterial({ color: 0xa65a26, roughness: 0.6 });
  // (each spilled one a mushroom, not a ball: a cap and its pale stem, rolled onto its side)
  const stemGeo = new THREE.CylinderGeometry(0.011, 0.016, 0.07, 6); stemGeo.translate(0, -0.03, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xe2d4b6, roughness: 0.8 });
  const caps = [[0.36, -0.05, 0.0], [0.5, 0.08, 0.6], [0.62, -0.12, 1.1], [0.44, 0.17, 1.9], [0.78, 0.02, 2.6], [0.3, 0.1, 3.0]].map(([x, z, r]) => {
    const m = new THREE.Mesh(capGeo, capMat);
    m.add(new THREE.Mesh(stemGeo, stemMat));
    m.rotation.order = 'YXZ';
    m.userData.to = V3(x, 0.045, z);
    m.userData.r = r;
    dropped.add(m);
    return m;
  });
  dropped.visible = false;
  world.root.add(dropped);
  // the mushrooms he picked, in the basket in his hand from when he has picked them (the same caps that spill from it)
  const heldCaps = new THREE.Group();
  [[0.05, 0.19, 0.03, 0.3, 1.05], [-0.06, 0.185, 0.04, 1.4, 0.95], [0.0, 0.2, -0.06, 2.2, 1.1], [-0.03, 0.205, -0.01, 0.9, 0.9], [0.07, 0.185, -0.05, 2.9, 0.85]].forEach(([x, y, z, r, s]) => {
    const m = new THREE.Mesh(capGeo, capMat);
    m.position.set(x, y, z); m.rotation.set(0.25 * Math.sin(r * 3), r, 0.2 * Math.cos(r * 2)); m.scale.setScalar(s);
    heldCaps.add(m);
  });
  heldCaps.visible = false;
  held.add(heldCaps);
  const dropStart = V3();
  let dropStartOK = false, dropSpot = null;
  // the small figure seen from far above: kneeling as the camera rises, then fleeing for the trees (a second hero)
  let far = null;
  const getFar = () => {
    if (!far) { far = createHero({ age: 0 }); far.group.name = 'wuhen-far'; far.group.visible = false; far.stale = true; world.root.add(far.group); injectFog(far.group); }
    return far;
  };
  // the uncle (hero.js createElder: head toward -X, face turned to +Z, his reaching hand on the +Z side).
  // The old figure lay along +x with the head at +x and +z toward the kneeling boy: mirrored on x he matches it,
  // and shifted so his head lies where the old head was (UH.uncleSpot), under the beam, the heap over his legs.
  let elder = null, spirit = null;
  // where their hands are, his and his uncle's (the tear lands there; the insert looks there)
  const _hm = V3(), _hm2 = V3();
  const handsMeet = out => {
    if (!elder || !wuhen) return out.copy(UH.handSpot);
    return out.copy(elder.anchors.handR()).lerp(wuhen.anchors.handR(), 0.5);
  };
  const getElder = () => {
    if (!elder) {
      elder = createElder();
      const p = V3(), q = new THREE.Quaternion(), s = V3();
      UH.elderMatrix.decompose(p, q, s);
      elder.group.quaternion.copy(q);
      elder.group.scale.set(-1, 1, 1);
      elder.group.position.copy(p).add(V3(0.17, 0, 0).applyQuaternion(q));
      elder.group.visible = false;
      elder.stale = true;
      world.root.add(elder.group);
      debug.elder = elder;
      // his soul: a golden copy of him that sits up out of him, rises, and comes apart into light
      spirit = createSpirit(elder);
      world.root.add(spirit.group);
      injectFog(elder.group);
    }
    return elder;
  };
  // drive a hero instance: skip the work while hidden, re-settle hair and sash after a jump or when it reappears
  function driveHero(h, visible, dt, time, state, jumped) {
    h.group.visible = visible;
    if (!visible) { h.stale = true; return; }
    if (h.stale || jumped) { h.update(0, time, state); h.settle(); h.stale = false; }
    else h.update(dt, time, state);
  }

  // ---------------------------------------------------------------- the Forbidden Forest (built after the valley is on screen)
  let B = null, bPromise = null, ghosts = [];
  // (gate: an async function the build waits on between its stages; idle: one waited on while its programs compile in
  // the browser's threads, before they are asked about)
  function prepareForest({ gate = null, idle = null } = {}) {
    if (!bPromise) bPromise = import('./forest.js').then(async m => {
      // the characters first, then the forest
      getWuhen(); getElder(); getFar();
      if (gate) await gate();
      return m.buildForest(mats, quality, { renderer, scene, camera, wuhen, makePerson, gate });
    }).then(async b => {
      if (!b) return null;
      // the years at the camp: two more hero instances take turns as his ghosts (dissolving in and out)
      const gh = [0, 1].map(() => { const g = createHero({ age: 0 }); g.group.name = 'wuhen-ghost'; g.group.visible = false; g.stale = true; scene.add(g.group); injectFog(g.group); return g; });
      b.root.visible = false;
      scene.add(b.root);
      injectFog(b.root);
      // its lights to the pool, then the shader programs of everything new (the characters, the forest), compiled in
      // the browser's threads: with one light count everywhere, the whole scene at once (a group compiled on its own
      // has its lights counted twice by three). Started first, and only asked about once the page has had its turn
      // (`idle`: each question is a round trip to the GPU process).
      poolLights(); liteAll(b.root); for (const g of [wuhen, elder, far, ...gh]) if (g && g.group) liteAll(g.group);
      try { onTarget(() => renderer.compile(scene, camera)); } catch (e) { console.warn('forest precompile', e); }
      if (idle) await idle();
      await onTarget(() => renderer.compileAsync(scene, camera));
      ghosts = gh;
      B = b;
      return B;
    }).catch(e => { console.error('forest failed', e); });
    return bPromise;
  }

  // ---------------------------------------------------------------- post
  mark('effects');
  const post = createPost(renderer, scene, camera, mats, quality, sun);
  mark('post');
  // Shader programs are compiled for where they are drawn: the scene is drawn into the post pipeline's target, and
  // three gives a program drawn into a render target no tone mapping and linear output, so a program compiled for
  // the canvas is another program, one nothing draws. (Measured on Windows: compiled against the canvas, all 133
  // programs compiled ahead went unused, and the 161 the story draws were compiled during the rehearsal instead, each
  // waited for on the page's thread: 20 of its 23 s.)
  function onTarget(fn) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(post.target);
    try { return fn(); } finally { renderer.setRenderTarget(prev); }
  }
  sky.setSize(renderer.getDrawingBufferSize(new THREE.Vector2()).x, renderer.getDrawingBufferSize(new THREE.Vector2()).y);

  // ---------------------------------------------------------------- the road
  // (over the bridge he walks on its deck: up the steps of its hump and down again)
  const BR = world.anchors.bridge;
  const _brl = V3();
  const roadPoint = z => {
    let y = roadY(z);
    const x = roadX(z);
    // (where he is along the bridge and across it, in its own frame)
    _brl.set(x, 0, z).applyMatrix4(BR.toLocal);
    if (Math.abs(_brl.z) < BR.L && Math.abs(_brl.x) < 2.4) y = Math.max(y, BR.deckY(_brl.z) + 0.02);
    else y = Math.max(y, heightAt(x, z));
    return V3(x, y, z);
  };
  const northDir = z => V3(roadX(z - 1.5) - roadX(z + 1.5), 0, -3).normalize();
  // the old road and the bridge: where the lens stands off him (back, to his right, up) and where it looks (ahead,
  // to his left, up); it keeps clear of the shrine by the road and of the lanterns at the bridge's ends (on a long lens,
  // 32°, from farther off: earth is long-lens; the land beyond him stacks up behind him)
  const ROAD_SHOT = {
    back: track([[36.9, 7.8], [37.75, 7.4], [38.3, 5.4], [39.95, 5.4], [40.5, 7.0]]),
    side: track([[36.9, -2.6], [37.75, -2.6], [38.3, 6.4], [39.95, 6.4], [40.5, 0.7]]),
    up: track([[36.9, 2.0], [37.75, 2.1], [38.3, 4.2], [39.95, 4.2], [40.5, 2.3]]),
    fwd: track([[36.9, 16], [37.75, 15], [38.3, 9], [39.95, 9], [40.5, 14]]),
    left: track([[36.9, 3], [37.75, 3.5], [38.3, 13], [39.95, 13], [40.5, 4]]),
    lookUp: track([[36.9, 1.9], [37.75, 1.7], [38.3, 0.4], [39.95, 0.4], [40.5, 1.6]]),
  };
  const shake = (t, amt) => V3(Math.sin(t * 13.1) * 0.6 + Math.sin(t * 29.7) * 0.4, Math.sin(t * 17.3) * 0.5 + Math.sin(t * 41.1) * 0.3, Math.sin(t * 11.7) * 0.5).multiplyScalar(amt * 0.06);

  const metrics = { frames: 0, u: 0, wind: 0.4, crossUV: [0.4, 0.58], bellToll: 0, ripples: [] };
  const debug = { noInk: false, noPost: false, hero: null };
  // (for measuring his walk: where he is at each story position, valley or forest, without drawing anything)
  debug.heroPath = us => us.map(u => { const p = u < 108.3 || !B ? valleyP(u) : B.wuhen(u).P; return p ? [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)] : null; });
  debug.where = () => ({ sect: sect.center.toArray(), top: sect.top, uncle: UH.uncleSpot.toArray(), kneel: UH.kneelSpot.toArray(), door: UH.door.toArray(), mush: A.mushrooms.toArray(), cam: camera.position.toArray(), dir: camera.getWorldDirection(V3()).toArray(), soul: soulP.toArray(), orbVis: soulOrb.mesh.visible, orbI: soulOrb.uniforms.uI.value, scr: soulP.clone().project(camera).toArray(), far: far ? far.group.position.toArray() : null, farVis: far ? far.group.visible : null, fov: camera.fov, P: metrics.P ? metrics.P.toArray() : null, gate: A.gate ? A.gate.center.toArray() : null });
  debug.uncleFire = () => A.fire.filter(f => f.house === 'uncle').map(f => [+f.p.x.toFixed(2), +f.p.y.toFixed(2), +f.p.z.toFixed(2), f.s]);
  const aerialPos = [V3(70, 118, 250), V3(34, 78, 168), V3(6, 30, 100), V3(1.5, 6.5, 58)];
  const aerialLook = [V3(-8, 6, -80), V3(-4, 4, -30), V3(3, 2.5, 46), V3(5.8, 2.2, 44.3)];
  // ---------------------------------------------------------------- after he dies: one continuous move
  // 1 the rise: it sits up out of him and stands over the boy; the camera backs past his shoulder, out of the open door
  //   and the porch into the street (92.4-95.4), and up in front of the house as it comes up out of the broken roof
  // 2 on up, round behind the light over the burning roofs, looking where it looks: the crag (96.4-98.9)
  // 3 across the valley to the crag, to the masked ones watching the village burn (98.9-101.6), held on them
  // 4 the light goes west and their masks turn after it: round them to their backs, the burning village and the light
  //   over their shoulders (102.1-103.75); up over the banners, off the crag after it, over the village and down to
  //   the boy running beneath it (103.75-105.8), then low behind him up the fields toward it
  const L = (x, y, z) => UH.local(x, y, z);
  let choreo = null;
  const getChoreo = () => {
    if (choreo) return choreo;
    const hover = soulHover(98.4), cragV = V3(CRAG.x, sect.top, CRAG.z);
    const toCrag = cragV.clone().sub(hover).setY(0).normalize(), side = V3(-toCrag.z, 0, toCrag.x);
    const hoverCam = hover.clone().addScaledVector(toCrag, -8.2).add(V3(0, -2.6, 0)).addScaledVector(side, -2.4);
    // (close, low, a little to their right: the leader's mask a few metres away)
    const sectFront = V3(58.3, sect.top + 0.55, 9.7);
    const drift = V3(0.35, 0.08, -0.25);
    const leave0 = sectFront.clone().add(drift);
    choreo = {
      hoverCam, sectFront, drift, cragFocus: cragV.clone().add(V3(-1, 2.2, 0)), emerge: L(-0.07, 6.4, 1.1),
    };
    // the rise: from beside him, round behind his shoulder as it sits up out of the man under the beam, then backing
    // out through the open door (the room, the boy and the light framed in it) and the porch into the street, and up
    // in front of the house as the light comes up out of the broken roof; on up and round behind it, over the street
    // (each point with the moment the camera passes it: one unbroken move that never stops at a point)
    const ride = [
      [92.4, L(2.4, 1.48, 3.2)], [93.2, L(1.65, 1.3, 2.8)], [93.9, L(0.75, 1.32, 2.95)], [94.25, L(0.25, 1.36, 3.6)],
      [94.55, L(0.0, 1.4, 4.45)], [94.95, L(0.0, 1.45, 6.0)], [95.35, L(0.02, 1.6, 7.6)], [95.8, L(0.15, 3.4, 8.8)],
      [96.4, L(0.5, 6.6, 9.6)], [97.3, L(1.6, 10.8, 9.6)], [98.9, hoverCam],
    ];
    const curve = new THREE.CatmullRomCurve3(ride.map(r => r[1]), false, 'centripetal');
    const segs = ride.length - 1, lens = curve.getLengths(segs * 60);
    choreo.ride = curve;
    choreo.rideK = monoKeys(ride.map((r, j) => [r[0], lens[j * 60] / lens[segs * 60]]));
    Object.assign(choreo, {
      // (cut to from where the light looks: already near enough for them to be seen as people on the crown, the array
      // glowing under them; then in on the leader)
      pushPath: [hoverCam.clone().lerp(sectFront, 0.6).add(V3(0, 1.5, 0)), hoverCam.clone().lerp(sectFront, 0.82).add(V3(0, 1.0, 0)), sectFront],
      // the light goes: round them through the south (wide of the brazier) to their backs, the leader held in the
      // frame, until the eye is over their shoulders on the burning village and the light going west above it
      orbit: new THREE.CatmullRomCurve3([leave0, V3(58.4, sect.top + 1.6, 14.6), V3(64.2, sect.top + 2.3, 15.4), V3(68.7, sect.top + 2.9, 10.6), V3(69.8, sect.top + 3.4, 5.2)], false, 'centripetal'),
      leader: V3(CRAG.x - 1.6, sect.top + 1.95, CRAG.z),
      // then up over the banners' tips and off the crag after it, over the village (south of the light's wake, so
      // the lens never flies through its comet of motes), down to the boy running beneath it
      leavePath: [V3(69.8, sect.top + 3.4, 5.2), V3(68.9, sect.top + 9.0, 5.8), V3(58, sect.top + 9.6, 12.5), V3(42, sect.top + 8.4, 23.5), V3(24, 26, 38), V3(4, 21, 50), V3(-18, 14, 50), V3(-33, 8.5, 46)],
    });
    return choreo;
  };
  // (he gets up and runs out of the house after it: out of the door, across the street, through the gap beside the
  // laundry house, out across the fields west; the first part unseen, while the eye is on the crag)
  const runPathA = () => [UH.door.clone().setY(UH.frame.plat), UH.porchFront.clone().setY(UH.frame.plat), UH.porchFront.clone().lerp(V3(roadX(44.6), 0, 44.6), 0.62), V3(roadX(44.6) + 0.3, 0, 44.8), V3(-5.2, 0, 45.2), V3(-12, 0, 45.4), V3(-20, 0, 44.9), V3(-30, 0, 42.8), V3(-40, 0, 40.5)];
  const runPath = [V3(-40, 0, 40.5), V3(-51, 0, 39), V3(-62, 0, 36.6), V3(-73, 0, 33.4), V3(-84, 0, 29.6)].map(p => p.setY(heightAt(p.x, p.z)));
  let runCurveA = null, runCurveB = null, roomIn = null;
  // (up the fields after it at a run; when the sky beyond the ridge takes fire he slows and stops on the slope)
  const runB = monoKeys([[103.0, -0.15], [103.6, 0], [107.3, 0.925], [107.75, 1]]);
  const runnerAt = (u, out) => {
    if (u < 103.6) {
      if (!runCurveA) runCurveA = new THREE.CatmullRomCurve3(runPathA(), false, 'centripetal');
      runCurveA.getPointAt(clamp((u - 99.3) / 4.3), out);
    } else {
      if (!runCurveB) runCurveB = new THREE.CatmullRomCurve3(runPath, false, 'centripetal');
      runCurveB.getPointAt(clamp(runB(u)), out);
    }
    out.y = life.groundY(out.x, out.z);
    return out;
  };

  let lastU = 0, lastZ = mcZ(0), nextStrike = 0, nextSheet = 0, sheetT0 = -9, envT = -9, envU = -99;
  // cues fired when the story crosses them going forward, then played on the story's clock: a reader who stops on one
  // is never left on a lit frame, one who scrolls back before it re-arms it, one who arrives past it by a jump never
  // sees it
  const cueT = new Map();
  function cueAge(at, u, time) {
    if (u < at) { cueT.delete(at); return Infinity; }
    if (!cueT.has(at)) cueT.set(at, lastU < at && u - lastU < 0.3 ? time : -Infinity);
    // (a clock set back, as test frames do: the cue is long over)
    if (time < cueT.get(at)) cueT.set(at, -Infinity);
    return time - cueT.get(at);
  }
  // the duel's centre along the story: in from far off in the south-west, fighting in front of the lens until the
  // violet one smashes the gold one down (SMASH); then the violet one is torn away west into the storm
  const D0 = V3(-1150, 3260, 560), D1 = V3(-1320, 3280, 680), D_FAR = V3(-7600, 3700, 3700);
  // the gold one's fall, from the smash in front of the lens down through the storm into the knot of the charge, which
  // it becomes: the eye tips over and chases its light down (the dive)
  const SMASH = 52.47;
  // the cut in on the wolf at the gate as he comes through it
  // the cut in on the burning blade at the smith's (see the camera)
  const SMITH_IN = [26.3, 26.76];
  // (held until he is past it: running in at the lens, his face would be seen)
  const WOLF_IN = [72.86, 73.28];
  // the cut to the room from inside it, from the prints at the door until he kneels (see the camera)
  const REVERSE = [80.98, 83.5];
  // the cut in on their hands as the old man's falls, the tear (see the camera)
  const HANDS_IN = [91.3, 92.32];
  // "Forget this place.": the cut to the place, high over the two of them (see the camera)
  const WORDS_WIDE = [87.0, 89.1];
  // "Cinderfall was burning.": the cut to what he sees as the ink falls (see the camera); its lens, a little above and
  // beside where he stands at the edge of the pines, and where it looks (the village below, its gate in front)
  const BURN_IN = [61.6, 63.7];
  const BURN = { pos: V3(7.5, 14.0, -153), pos2: V3(7.4, 13.9, -151), look: V3(0, 4.6, -8), fov: [17.5, 15.8] };
  const GOLD_FALL = (() => {
    const K = [[SMASH, warGold(SMASH)], [52.6, V3(-1266, 2800, 660)], [52.75, V3(-1120, 2640, 610)], [53.0, V3(-850, 2380, 500)], [53.25, V3(-690, 1930, 300)],
      [53.5, V3(-490, 1440, 90)], [53.75, V3(-262, 900, -80)], [53.97, C_F.clone()]];
    const c = new THREE.CatmullRomCurve3(K.map(k => k[1]), false, 'centripetal');
    const t = monoKeys(K.map((k, i) => [k[0], i / (K.length - 1)]));
    return (u, out) => c.getPoint(clamp(t(u)), out);
  })();
  // the eye of the gathering: the two fight low in it while the deck forms round them (seen from the pines, west-south-
  // west and high), then go up out of it over the sea, where the eye follows them up through it
  const D_EYE = V3(EYE.x, 1500, EYE.z);
  const _dc = V3(), _gf = V3(), _wg = V3(), _wm = V3();
  let lastBlowT = 0, lastArc = -1, lastBlowBolt = -9;
  const duelUp = u => Math.pow(smooth(47.9, 48.8, u), 0.8);
  function duelCentre(u, out) {
    return out.copy(D_EYE).lerp(D0, duelUp(u)).lerp(D1, smooth(49.9, 52.2, u)).lerp(D_FAR, Math.pow(smooth(SMASH, 53.1, u), 1.8));
  }
  // where the two are at time t (about the centre of this moment)
  // (the cloud tops the gold one is smashed down into, relative to the centre; in the eye, the floor of the well)
  const DUEL_FLOOR = 2440;
  let duelFloor = DUEL_FLOOR;
  function duelFlight(t, o1, o2) { duel.at(t, o1, o2, duelFloor - _dc.y); o1.add(_dc); o2.add(_dc); }
  const sheetPos = V3(), vortexPos = V3();
  let vortexViolet = false;
  const stormC = V3(-980, 0, 840);
  const strikeTmp = V3();
  function strikeAt(which, strength, violet, time) {
    // a peak in view, picked across the frame by `which`
    camera.updateMatrixWorld();
    const fwd = V3(0, 0, -1).applyQuaternion(camera.quaternion);
    // looking up into the storm: the bolt crawls across the cloud base and forks down through the frame
    if (!violet && fwd.y > 0.3) {
      const right = V3().crossVectors(fwd, UP).normalize();
      const alt = 760 + Math.random() * 160;
      const c0 = camera.position.clone().addScaledVector(fwd, (alt - camera.position.y) / fwd.y);
      c0.addScaledVector(right, (which - 0.5) * 900);
      const span = 900 + Math.random() * 500;
      const a = c0.clone().addScaledVector(right, -span * 0.5).add(V3(0, 60 + Math.random() * 80, 0));
      const b = c0.clone().addScaledVector(right, span * 0.5).add(V3((Math.random() - 0.5) * 300, -260 - Math.random() * 200, (Math.random() - 0.5) * 300));
      lightning.strike(time, a, b, { strength, width: 3.2, branches: 9 });
      return;
    }
    const cands = [];
    const tops = violet ? [sect.center.clone().add(fwd.clone().setY(0).normalize().multiplyScalar(160)).add(V3(0, 10, 0))] : mountains.tops;
    for (const t of tops) {
      const d = strikeTmp.copy(t).sub(camera.position);
      const dist = d.length();
      if (dist < 250 || dist > 1900) continue;
      d.divideScalar(dist);
      if (d.dot(fwd) < 0.72) continue;
      const sx = strikeTmp.copy(t).project(camera).x;
      if (Math.abs(sx) > 0.95) continue;
      cands.push({ t, sx });
    }
    let target;
    if (cands.length) { cands.sort((a, b) => a.sx - b.sx); target = cands[Math.min(cands.length - 1, Math.floor(which * cands.length))].t.clone(); }
    else { target = camera.position.clone().addScaledVector(fwd.setY(0).normalize(), 900); target.y = heightAt(target.x, target.z) + 20; }
    const top = target.clone().add(V3((Math.random() - 0.5) * 360, 0, (Math.random() - 0.5) * 360));
    top.y = violet ? target.y + 420 : 640 + Math.random() * 180;
    lightning.strike(time, top, target, { strength, width: violet ? 1.6 : 2.2, color: violet ? new THREE.Color(0.78, 0.45, 1.0) : null });
  }

  // a strike into the ground beside the road, `ahead` metres in front of him, `side` metres off the road's centre
  const gsTint = new THREE.Color(0.5, 0.82, 1.0);
  function groundStrikeAt(at, strength, side, ahead, time) {
    // ahead of him on the road (the camera chases him along it), `side` metres to its right (+) or left (-) as he
    // runs, kept to the road's corridor in the street between the houses. A function of the story alone.
    const z0 = mcZ(at) + ahead;
    const f = V3(roadX(z0 + 2) - roadX(z0 - 2), 0, 4).normalize();
    const p = V3(roadX(z0), 0, z0).addScaledVector(V3(-f.z, 0, f.x), side);
    const inStreet = p.z > -46 && p.z < 96, rx = roadX(p.z), lim = inStreet ? 4.2 : 9;
    p.x = clamp(p.x, rx - lim, rx + lim);
    const target = V3(p.x, heightAt(p.x, p.z), p.z);
    // from the storm deck far ahead of him, so the channel stands in the frame instead of leaning out of it
    const k = Math.round(at * 10);
    const top = target.clone().addScaledVector(f, 110 + (k % 5) * 12).addScaledVector(V3(-f.z, 0, f.x), side * 2.5 + Math.sin(k * 1.7) * 25);
    top.y += 560 + (k % 7) * 20;
    gStrikes.strike(time, at, target, top, { seed: k * 131 + 7, strength });
  }

  // world B is rendered from the cloud pass on
  const inForest = u => u >= worldBAt && !!B;

  // ---------------------------------------------------------------- Wuhen's way through the valley (pure functions of u)
  const windV = new THREE.Vector2();
  // turn a heading toward another by w (shortest way round, stays unit length)
  const turnTo = (h, t, w) => {
    if (w <= 0) return h;
    const a = Math.atan2(h.x, h.z);
    let d = Math.atan2(t.x, t.z) - a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const y = a + d * Math.min(1, w);
    return h.set(Math.sin(y), 0, Math.cos(y));
  };
  // the mushrooms by the old pines: he leaves the road, squats before them with his back to the camera, picks, returns
  // (on the near side of the cluster, the second cluster to his left and the rock beyond on his right; the ground
  // behind him is kept clear of tall growth for the camera: world.js MUSH_CLEAR)
  const mushSpot = A.mushrooms.clone().add(V3(-0.55, 0, 0.75));
  mushSpot.y = heightAt(mushSpot.x, mushSpot.z);
  const mushFace = V3(0, 0, -1);
  const mushPick = A.mushrooms.clone().add(V3(-0.27, 0.06, 0.33));
  // (he goes back to the road once the eye has left him for the sky)
  // (off the road to them from the cut onto its last stretch, at a walk: mcZ)
  const mushK = u => smooth(40.7, 43.85, u) * (1 - smooth(48.0, 49.2, u));
  // where he looks when the sky turns: the fight low in the eye of the gathering, west-south-west and high
  const SKYFIGHT = V3(EYE.x, 1450, EYE.z);
  const toEye = EYE.clone().sub(mushSpot).setY(0).normalize();
  // where his right fist holds the mushroom: before his eyes; then lower, at his chest, while he looks up at the sky
  function mushRaise(u, P, h) {
    const r = V3(-h.z, 0, h.x), lo = smooth(45.95, 46.6, u);
    return P.clone().addScaledVector(h, lerp(0.45, 0.3, lo)).addScaledVector(r, lerp(0.13, 0.16, lo)).add(V3(0, lerp(1.42, 1.12, lo), 0));
  }
  // ---------------------------------------------------------------- the morning at his uncle's door (9.6–19.6)
  // The crane comes down to the herb shop: his uncle stands at the door in the morning sun, the basket in his hand; his
  // face (the only face the film holds on); the basket passes from his hand to the boy's, both on the handle for a
  // moment; he points at the sun ("Home before dark."); the boy goes down into the street.
  const PLAT = UH.frame.plat;
  const UNCLE_AT = V3(6.5, PLAT, 44.0), BOY_AT = V3(5.62, PLAT, 44.06);
  const BASKET_TOP = V3(6.08, PLAT + 0.98, 43.84);
  // (where he points: up at the morning sun, on his left as he faces the street)
  const SUN_UP = V3(-0.25, 0.62, 0.74).normalize();
  // (the shots: the crane comes down to the two of them at the door, behind the boy's right shoulder, his uncle's face
  // turned to him, the marks of his height on the door post beside them, while the old man's hand measures him; cut in
  // over his shoulder on the old man's face (the only face the film holds on), slowly in; close on the hands at the
  // handle; wider over his shoulder as the old man points at the sun (a little to the right of him, so the 福 on the
  // door leaf is not on his head); round after the boy as he goes down the steps to the dog in the street, until he
  // crouches to it (bonds.js has the next shot)) [u, lens, look, fov]
  const MORNING_SHOTS = [
    [[9.6, V3(-0.4, 8.0, 56.0), V3(5.6, 2.3, 44.4), 44], [11.3, V3(0.7, 3.5, 49.0), V3(6.0, 2.45, 44.1), 39], [12.6, V3(3.6, 2.85, 47.0), V3(6.03, 2.52, 44.06), 36], [13.95, V3(4.6, 2.75, 46.2), V3(6.05, 2.55, 44.05), 34]],
    [[13.95, V3(4.58, 2.8, 44.52), V3(6.45, 2.64, 44.0), 30], [15.45, V3(4.8, 2.76, 44.42), V3(6.5, 2.63, 44.0), 26]],
    [[15.45, V3(5.96, 2.3, 42.9), BASKET_TOP.clone().add(V3(0, 0.07, 0)), 35], [16.6, V3(5.96, 2.26, 43.0), BASKET_TOP.clone().add(V3(-0.12, -0.02, 0)), 36]],
    [[16.6, V3(4.15, 2.92, 45.15), V3(6.35, 2.65, 44.0), 36], [18.15, V3(4.25, 2.9, 45.1), V3(6.3, 2.68, 44.0), 35], [18.8, V3(3.4, 2.8, 46.3), V3(4.6, 1.8, 43.2), 42], [19.6, V3(2.4, 2.75, 45.6), V3(1.2, 1.4, 38.5), 44], [20.25, V3(1.85, 2.3, 44.9), V3(0.75, 0.6, 40.6), 40]],
  ];
  const morningShot = (() => {
    const shots = MORNING_SHOTS.map(keys => ({ u0: keys[0][0], u1: keys[keys.length - 1][0], pos: new THREE.CatmullRomCurve3(keys.map(k => k[1]), false, 'centripetal'), look: new THREE.CatmullRomCurve3(keys.map(k => k[2]), false, 'centripetal'), t: monoKeys(keys.map((k, i) => [k[0], i / (keys.length - 1)])), fov: monoKeys(keys.map(k => [k[0], k[3]])) }));
    const out = { pos: V3(), look: V3(), fov: 46 };
    return u => { let s = shots[0]; for (const x of shots) if (u >= x.u0) s = x; const t = clamp(s.t(u)); s.pos.getPoint(t, out.pos); s.look.getPoint(t, out.look); out.fov = s.fov(u); return out; };
  })();
  // the morning's bonds: his uncle's hand measuring him, the dog, the bun, the dog sent home at the gate; that night the
  // wolf where the dog sat, the dog by the old man (bonds.js)
  const bonds = createBonds({ world, life: () => life, valleyP, valleyHeading, groundY: (x, z) => life.groundY(x, z) });
  // that night the dog is lying by the old man, between him and the door, its nose to the door (bonds.js)
  const dogNight = { p: UH.local(-0.3, 0, 2.0).setY(0), yaw: Math.atan2(UH.door.x - UH.center.x, UH.door.z - UH.center.z),
    boy: () => (wuhen && wuhen.group.visible ? wuhen.anchors.head() : UH.door.clone().add(V3(0, 1.5, 0))), old: () => (elder ? elder.anchors.head() : UH.uncleSpot.clone()), soul: () => soulP.clone() };
  // the basket: in his uncle's hand, then the boy's (his left takes the handle beside the old man's right)
  const uncleBasket = held.clone(true);
  uncleBasket.visible = false;
  world.root.add(uncleBasket);
  // his height marked on the door frame each year since he was small (the right-hand post, facing the street; one mesh)
  const _mm = new THREE.Matrix4(), _me = new THREE.Euler();
  const placed = (geo, x, y, z, rx = 0, ry = 0) => geo.clone().applyMatrix4(_mm.makeRotationFromEuler(_me.set(rx, ry, 0)).setPosition(x, y, z));
  {
    const markM = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.9 });
    const g = new THREE.BoxGeometry(0.008, 0.007, 0.075);
    const parts = [0.94, 1.03, 1.12, 1.2, 1.28, 1.35, 1.42, 1.49, 1.55, 1.6, 1.66].map((h, i) => placed(g, 6.862, PLAT + h, 45.09 + ((i * 7) % 3 - 1) * 0.008, ((i * 5) % 3 - 1) * 0.04));
    world.root.add(new THREE.Mesh(mergeGeometries(parts), markM));
  }
  // after the fire: a wolf's sooty prints up the porch beside his way to the door, over the sill and in toward the
  // room, fainter as the soot wears off its pads (one mesh)
  const pawPrints = (() => {
    // (soot-dark: on the porch, lit by the fire through the door, they read as the ink's black)
    const ash = new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 1 });
    ash.polygonOffset = true; ash.polygonOffsetFactor = -2; ash.polygonOffsetUnits = -4;
    const pad = new THREE.CircleGeometry(0.05, 10); pad.rotateX(-Math.PI / 2); pad.scale(1, 1, 1.15);
    const toe = new THREE.CircleGeometry(0.019, 8); toe.rotateX(-Math.PI / 2);
    // [x, z, height, size] in the house's own frame: z 4.25 is the front wall; each on what it lies on, the porch's stone
    // (0.03), the sill's timber (0.2: one step on it, a long one over the stone threshold before it), the planks (0.06)
    const T = [[0.78, 5.75, 0.03, 1], [0.66, 5.43, 0.03, 1], [0.6, 5.11, 0.03, 1], [0.5, 4.79, 0.03, 1], [0.47, 4.28, 0.2, 1],
      [0.44, 3.95, 0.06, 1], [0.47, 3.63, 0.06, 0.95], [0.5, 3.31, 0.06, 0.88], [0.53, 2.99, 0.06, 0.78], [0.55, 2.67, 0.06, 0.66]];
    const TOES = [[-0.046, 0.074], [-0.016, 0.096], [0.016, 0.096], [0.046, 0.074]];
    const parts = [];
    T.forEach(([x, z, y, s], i) => {
      const n = T[Math.min(i + 1, T.length - 1)], b = T[Math.max(i - 1, 0)];
      const p = L(x + (i % 2 ? 1 : -1) * 0.045, y + 0.004, z);
      const d = L(n[0], 0, n[1]).sub(L(b[0], 0, b[1])).setY(0).normalize();
      const yaw = Math.atan2(d.x, d.z) + Math.sin(i * 2.3) * 0.12, dd = V3(Math.sin(yaw), 0, Math.cos(yaw)), rr = V3(-dd.z, 0, dd.x);
      parts.push(placed(s === 1 ? pad : pad.clone().scale(s, 1, s), p.x, p.y, p.z, 0, yaw));
      // (the last only half there)
      TOES.forEach(([tx, tz], j) => {
        if (i === T.length - 1 && j % 2) return;
        const q = p.clone().addScaledVector(rr, tx * s).addScaledVector(dd, tz * s);
        parts.push(placed(s === 1 ? toe : toe.clone().scale(s, 1, s), q.x, q.y, q.z));
      });
    });
    const m = new THREE.Mesh(mergeGeometries(parts), ash);
    m.visible = false; m.name = 'paws';
    world.root.add(m);
    return m;
  })();
  // the alarm bell hung under the gate's beam: still in the morning as he goes out under it; the night the village
  // burns it swings by itself, nobody at its rope, and tolls at one end of each swing (the sound's toll and the ink's
  // ripple: metrics.bellToll, metrics.ripples); one mesh, a plain lit material
  const gateBell = (() => {
    const bronze = new THREE.MeshStandardMaterial({ color: 0x3a2f20, roughness: 0.45, metalness: 0.3 });
    const prof = [[0, -0.52], [0.2, -0.52], [0.205, -0.5], [0.172, -0.43], [0.152, -0.27], [0.146, -0.14], [0.122, -0.075], [0.065, -0.045], [0, -0.04]];
    const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20);
    const loop = new THREE.TorusGeometry(0.034, 0.011, 6, 12); loop.translate(0, -0.035, 0);
    const rope = new THREE.CylinderGeometry(0.011, 0.011, 0.18, 6); rope.translate(0, 0.07, 0);
    const g = new THREE.Group(); g.name = 'gateBell';
    const m = new THREE.Mesh(mergeGeometries([body.toNonIndexed(), loop.toNonIndexed(), rope.toNonIndexed()]), bronze);
    m.position.y = -0.18; m.castShadow = true;
    g.add(m);
    // (hung from the underside of the lower beam, over the middle of the way)
    g.position.copy(A.gate.center).add(V3(0, -0.4, 0));
    world.root.add(g);
    return g;
  })();
  let bellN = null;
  const ripples = [];
  function valleyP(u) {
    let P = roadPoint(mcZ(u));
    // (on the porch in the morning; down the steps into the street)
    const mo = morningK(u);
    if (mo > 0) P.lerp(BOY_AT, mo);
    const mk = mushK(u);
    if (mk > 0) {
      const y0 = P.y;
      P.lerp(mushSpot, mk);
      P.y = lerp(y0, heightAt(P.x, P.z), smooth(0, 0.2, mk));
    }
    // (at the smith's stall he steps off the middle of the street toward it, and stops to look)
    const sk = stallK(u);
    if (sk > 0 && A.stall) {
      const T = A.stall.clone().lerp(P, 0.62);
      P.lerp(T.setY(P.y), sk * 0.5);
    }
    bonds.feet(u, P, mo);
    const pb = porchBlend(u);
    if (pb > 0) {
      const door = UH.door.clone();
      const pf = UH.porchFront.clone();
      pf.y = UH.frame.plat;
      P = P.clone().lerp(pb < 0.55 ? pf : pf.clone().lerp(door.setY(pf.y), (pb - 0.55) / 0.45), Math.min(1, pb / 0.55));
    }
    const ek = enterK(u), rk = rushK(u);
    if (ek > 0) {
      const door = UH.door.clone().setY(UH.frame.plat);
      const ins = UH.insideSpot.clone().setY(UH.frame.plat);
      P = door.lerp(ins, ek);
      if (rk > 0) P.lerp(UH.kneelSpot.clone().setY(UH.frame.plat), rk);
    }
    return P;
  }
  function valleyHeading(u, P) {
    const z = mcZ(u);
    let yaw = turnYaw(u);
    if (u >= 61.2) yaw = Math.PI;
    const h = northDir(z).applyAxisAngle(UP, yaw);
    // to the mushrooms and back: he faces the way he walks, and the camera's side while he picks
    const walk = Math.max(band(40.7, 40.9, 43.65, 43.9, u), band(47.95, 48.2, 48.9, 49.2, u));
    if (walk > 0) { const d = valleyP(u + 0.04).sub(valleyP(u - 0.04)).setY(0); if (d.lengthSq() > 1e-8) turnTo(h, d.normalize(), walk); }
    turnTo(h, mushFace, smooth(43.65, 44.0, u) * (1 - smooth(47.9, 48.2, u)));
    // (the sky turns: he turns round to it, to his left, away from the lens)
    turnTo(h, toEye, smooth(45.95, 46.75, u) * (1 - smooth(47.9, 48.2, u)));
    if (A.stall && stallK(u) > 0) turnTo(h, A.stall.clone().sub(P).setY(0).normalize(), smooth(25.6, 26.3, u) * (1 - smooth(27.3, 27.9, u)) * 0.75);
    const pb = porchBlend(u);
    if (pb > 0.05) turnTo(h, UH.center.clone().sub(P).setY(0).normalize(), Math.min(1, pb * 1.6));
    bonds.heading(u, P, h, turnTo);
    // (in the morning, to his uncle at the door; then round to the street)
    const mo = morningK(u);
    if (mo > 0) turnTo(h, V3(1, 0, 0), smooth(0.35, 1, mo));
    const ek = enterK(u);
    if (ek > 0) turnTo(h, UH.uncleSpot.clone().sub(P).setY(0).normalize(), smooth(0, 0.6, ek));
    return h;
  }
  // where he looks: the people he greets, the mushrooms, the sky, the burning village, the uncle -> [target, weight]
  function valleyLook(u, P) {
    const C = world.cast;
    const at = (who, y) => who.root.position.clone().add(V3(0, y, 0));
    const looks = [
      [band(9.6, 11.0, 18.1, 18.6, u), () => (elder && elder.group.visible ? elder.anchors.head() : UNCLE_AT.clone().add(V3(0, 1.52, 0)))],
      [band(16.62, 16.85, 17.75, 18.0, u) * 0.6, () => BOY_AT.clone().addScaledVector(SUN_UP, 30)],
      ...bonds.looks(u),
      [band(22.6, 23.6, 24.4, 25.4, u), () => at(C.kids[0], 0.85)],
      [band(25.3, 26.0, 27.4, 28.0, u), () => (A.stall ? A.stall.clone() : at(C.smith, 1.5))],
      [band(43.7, 44.2, 44.8, 45.15, u), () => mushPick.clone()],
      // the one he picked, held up before his eyes
      [band(44.95, 45.3, 45.75, 46.05, u), () => mushRaise(u, P, valleyHeading(u, P)).add(V3(0, 0.07, 0))],
      // the sky turns: his eyes go up to it, to the light fighting low in the eye of the gathering
      [band(45.8, 46.25, 47.9, 48.4, u), () => SKYFIGHT.clone()],
      [band(48.3, 48.9, 55.6, 56.8, u), () => P.clone().add(valleyHeading(u, P).multiplyScalar(60)).add(V3(0, 22, 0))],
      [band(58.5, 59.5, 65.4, 66.4, u), () => V3(0, 4, 30)],
      // (when the light sits up out of him, his eyes go to it and follow it up through the roof)
      [band(92.55, 93.35, 99.0, 99.4, u), () => soulP.clone()],
      [smooth(81.6, 83.4, u) * (1 - smooth(92.5, 93.3, u)), () => (elder ? elder.anchors.head() : UH.uncleSpot.clone())],
    ];
    let best = 0, f = null;
    for (const [w, fn] of looks) if (w > best) { best = w; f = fn; }
    return best > 0.02 ? [f(), best] : null;
  }
  // the basket's fall (65.6 →): from where his hand let it go, down onto the road beside him; it tips, the caps spill
  function getDrop() {
    if (!dropSpot) {
      const P0 = valleyP(65.62), h0 = valleyHeading(65.62, P0).clone();
      const r0 = V3().crossVectors(h0, UP).normalize();
      const land = P0.clone().addScaledVector(r0, -0.36).addScaledVector(h0, 0.3);
      land.y = heightAt(land.x, land.z);
      // (its mouth toward the lens, low at his left side behind him: the caps spill toward it, so it reads as a basket)
      const sp = r0.clone().multiplyScalar(-0.64).addScaledVector(h0, -1.9).normalize();
      dropSpot = { land, yaw: Math.atan2(-sp.z, sp.x), from: land.clone().add(V3(0, 0.42, 0)), P0, h0, r0 };
    }
    return dropSpot;
  }
  function dropBasket(u) {
    const D = getDrop();
    const from = dropStartOK && dropStart.distanceTo(D.from) < 0.8 ? dropStart : D.from;
    const t = clamp((u - 65.6) / 0.075), tip = smooth(65.665, 65.74, u);
    // (the fall speeds up; a small turn and swing as it goes; on the ground it rolls onto its side)
    dropped.position.lerpVectors(from, D.land, t * t);
    dropped.rotation.set(0, D.yaw + (1 - t) * 0.5, 0);
    db.rotation.set(0.25 * t * (1 - tip), 0, -1.4 * tip - Math.sin(tip * Math.PI) * 0.12);
    db.position.set(0, 0.15 * tip, 0);
    caps.forEach((m, i) => {
      const k = smooth(65.7 + i * 0.012, 65.83 + i * 0.012, u);
      m.visible = k > 0;
      const to = m.userData.to;
      m.position.set(lerp(0.2, to.x, k), lerp(0.12, to.y, k) + Math.sin(k * Math.PI) * 0.03, lerp(0, to.z, k));
      m.rotation.set(1.3 * k, m.userData.r * k, 0);
    });
  }
  // a ghost's pose from what he was doing that year
  function ghostState(d) {
    // (a full pose given by the place: years.js)
    if (d.state) return { wind: windV, ...d.state };
    const s = { wind: windV };
    if (d.kind === 'huddle') { s.sit = 1; s.grief = 0.75; }
    else if (d.kind === 'build') { s.crouch = 0.7; s.reach = 1; s.reachTarget = d.reachTarget || d.P.clone().addScaledVector(d.heading, 0.6).add(V3(0, 0.9, 0)); }
    else if (d.kind === 'archery') s.draw = 1;
    else if (d.kind === 'pushup') s.pushup = 1;
    else if (d.kind === 'meditate') s.sit = 1;
    else if (d.kind === 'mourn') { s.kneel = 1; s.grief = 0.6; }
    return s;
  }

  // the soul's path: up out of him (the spirit), a breath above the burning roofs, then west after the light that fell
  const _run0 = V3(), _run1 = V3(), _fRes = new THREE.Vector2();
  const soulP = V3(), _sp0 = V3(), _sp1 = V3(), _ss = V3(), _dbs = new THREE.Vector2(), _wc = new THREE.Color(), _wc2 = new THREE.Color(), _rvGate = V3(), _rvBasket = V3(), _wh = V3();
  const _rvGlow = new THREE.Color();
  // the room, in colour, from the moment he sees his uncle under the beam until the words begin
  const roomReveal = u => band(81.95, 83.1, 84.3, 85.6, u);
  const PUSH = [0.05, 0.012, 0.035, 0, 0.07, 0.13, 0.1, 0.12, 0.06, 0.05, 0.09, 0.05];
  const soulBase = () => UH.uncleSpot.clone().add(V3(0, 1.15, 0));
  // (it hangs over the house while the crag is seen, then goes west low over the fields ahead of him, pulling away)
  const soulHover = u => soulBase().add(V3(Math.sin(u * 3.1) * 0.3, 15.5 + smooth(98.4, 102.6, u) * 3.5, Math.cos(u * 2.3) * 0.3));
  const soulWest = () => new THREE.CatmullRomCurve3([soulHover(102.6), soulBase().add(V3(-10, 22.5, 1.5)), V3(-50, 38, 42), V3(-130, 60, 30), V3(-260, 96, 10), V3(-420, 140, 15), V3(-700, 200, 60), V3(-1400, 340, 300)], false, 'centripetal');
  let soulCurve = null;
  function soulAt(u, out) {
    if (u < 98.4 && spirit && spirit.group.visible) return out.copy(spirit.core()).lerp(soulHover(u), smooth(97.4, 98.4, u));
    const base = soulBase();
    if (u < 98.4) return out.copy(base).add(V3(0, 0.23 + 0.35 * smooth(93.6, 95.0, u) + 14.92 * smooth(95.2, 98.4, u), 0)).lerp(soulHover(u), smooth(97.4, 98.4, u));
    if (u < 102.6) return out.copy(soulHover(u));
    // then it goes: up off the fields ahead of him, over the ridge and down beyond it
    if (u >= LAUNCH[0]) return getLaunch().getPointAt(clamp(launchK(Math.min(u, LAUNCH[1]))), out);
    if (!soulCurve) soulCurve = soulWest();
    out.copy(soulCurve.getPointAt(Math.pow(smooth(102.6, 109.5, u), 1.6)));
    // that night: it comes down out of the sky ahead of him and leads him low over the fields, close enough to light
    // his way
    const ld = smooth(104.75, 105.35, u);
    if (ld > 0) out.lerp(leadAt(u, _ldA), ld * ld * (3 - 2 * ld));
    return out;
  }
  const _ldA = V3(), _ldR = V3();
  const RUN_AHEAD = runPath[runPath.length - 1].clone().sub(runPath[0]).setY(0).normalize();
  function leadAt(u, out) {
    runnerAt(u, _ldR);
    const rt = V3(-RUN_AHEAD.z, 0, RUN_AHEAD.x);
    return out.copy(_ldR).addScaledVector(RUN_AHEAD, lerp(23, 18, smooth(105.2, 105.9, u))).addScaledVector(rt, -2.2 + Math.sin(u * 7.3) * 1.6)
      .add(V3(0, lerp(9.5, 6.2, smooth(105.2, 105.9, u)) + Math.sin(u * 11.7) * 0.7, 0));
  }
  // ---------------------------------------------------------------- the light leaves him (105.95 → 107.42)
  // It checks over the fields ahead of him, swells, and goes: steeply up off the field, over the ridge he is running
  // toward and down beyond it, a comet dragging a ribbon of gold, to where what fell that night came down. The sky
  // beyond the ridge takes fire from it, and its light floods the world white (the crossing).
  const LAUNCH = [105.95, 107.42];
  const CROSS_L = S_FAR.clone();
  const launchK = monoKeys([[105.95, 0], [106.2, 0.03], [106.5, 0.13], [106.9, 0.43], [107.18, 0.74], [107.42, 1], [107.6, 1.08]]);
  let launchCurve = null;
  function launchPts() {
    const p0 = leadAt(LAUNCH[0], V3());
    const rgt = V3(-RUN_AHEAD.z, 0, RUN_AHEAD.x);
    const c1 = p0.clone().addScaledVector(RUN_AHEAD, 130).addScaledVector(rgt, 120).add(V3(0, 150, 0));
    const c2 = CROSS_L.clone().add(V3(540, 420, -40)).addScaledVector(rgt, 160);
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64, r = 1 - t;
      pts.push(p0.clone().multiplyScalar(r * r * r).addScaledVector(c1, 3 * r * r * t).addScaledVector(c2, 3 * r * t * t).addScaledVector(CROSS_L, t * t * t));
    }
    return pts;
  }
  const getLaunch = () => launchCurve || (launchCurve = new THREE.CatmullRomCurve3(launchPts(), false, 'centripetal'));
  // the sky beyond the ridge on fire: 0..1 (it lands at 107.42)
  const crossFlash = u => band(107.4, 107.47, 107.78, 107.98, u);
  // (how far the lens has fallen back behind where it let him go, metres)
  const craneBack = monoKeys([[106.1, 2.9], [106.5, 6.4], [107.0, 10.6], [107.45, 13.8], [107.95, 15.0]]);
  const _cr0 = V3(), _cr1 = V3(), _lp0 = V3(), _xUp = V3(), _xsCol = new THREE.Color();

  // ---------------------------------------------------------------- the storm's camera (46.2 → 58.9)
  const slerpDir = (a, b, w) => {
    const ang = Math.acos(clamp(a.dot(b), -1, 1));
    if (ang < 1e-4 || w <= 0) return a.clone();
    if (w >= 1) return b.clone();
    const s0 = Math.sin((1 - w) * ang) / Math.sin(ang), s1 = Math.sin(w * ang) / Math.sin(ang);
    return a.clone().multiplyScalar(s0).addScaledVector(b, s1).normalize();
  };
  // the mushrooms: behind him as he walks in off the road, then (as he squats) off his right shoulder, the cluster at
  // his right hand in its shaft of light, drifting in a little as he picks (his face is never seen: his back, his hair,
  // his hand among the caps). Relative to him and the way he faces, so he is never left behind the lens.
  // Then low behind his right shoulder, looking up past the mushroom he holds up before his eyes; as the sky turns he
  // turns round to it and the lens goes round behind him (it stays at his back), tilting up to the gathering, and holds
  // there, rising a little, while the deck forms over the valley.
  const _msA = V3(), _msB = V3();
  const mushShot = (uu, portrait = 0) => {
    const P = valleyP(uu), h = valleyHeading(uu, P).clone(), r = V3(-h.z, 0, h.x);
    const cr = smooth(44, 46.3, uu), sq = smooth(43.55, 44.15, uu);
    // (on a tall screen: further back and less to the side, so he and the cluster both fit across it)
    const pos = P.clone().addScaledVector(h, -lerp(1.5, 1.3, cr) - 0.7 * portrait).addScaledVector(r, lerp(lerp(0.45, 1.5, sq), 1.3, cr) * (1 - 0.45 * portrait)).add(V3(0, lerp(1.9, 1.75, cr) + 0.3 * portrait, 0));
    const look = P.clone().addScaledVector(h, lerp(6, 0.47, sq)).addScaledVector(r, 0.5 * sq).add(V3(0, lerp(1.0, 0.22, sq), 0));
    const ik = smooth(44.85, 45.5, uu);
    if (ik <= 0) return { pos, look };
    // (low behind his right shoulder; then, as he turns, round behind him and back a little; then up a little)
    const tk = smooth(45.95, 46.75, uu), hk = smooth(46.75, 47.45, uu);
    const back = lerp(lerp(1.2, 1.5, tk), 2.0, hk) + 0.6 * portrait, side = lerp(lerp(0.62, 0.5, tk), 0.38, hk) * (1 - 0.45 * portrait);
    const pB = P.clone().addScaledVector(h, -back).addScaledVector(r, side).add(V3(0, lerp(lerp(1.02, 0.95, tk), 1.25, hk) + 0.2 * portrait, 0));
    // (the eye: up past the mushroom held before his eyes; then round and up to the gathering, a little under the fight
    // so he stays at the foot of the frame)
    const dA = mushRaise(uu, P, h).addScaledVector(h, 1.8).add(V3(0, 1.45, 0)).sub(pB).normalize();
    const el = THREE.MathUtils.degToRad(lerp(29, 34, hk) + 4 * portrait);
    // (the way he faces, so he stays in the frame while he turns; once round, that is the way to the gathering)
    const dS = _msB.copy(h).multiplyScalar(Math.cos(el)).add(_msA.set(0, Math.sin(el), 0)).normalize();
    const dir = slerpDir(dA, dS.clone(), smooth(45.85, 46.7, uu));
    const lB = pB.clone().addScaledVector(dir, 30);
    // (in from the picking shot: the position eased, the eye turned evenly)
    const d0 = look.clone().sub(pos), L0 = d0.length();
    const p2 = pos.clone().lerp(pB, ik);
    return { pos: p2, look: p2.clone().addScaledVector(slerpDir(d0.divideScalar(L0), dir, ik), lerp(L0, 30, ik)) };
  };
  const mushCam = uu => mushShot(uu).pos;
  const mushLook = uu => mushShot(uu).look;
  // the flight (47.4 → 58.9): up from him at the edge of the pines into the eye of the gathering, up through it and out over the sea to the fight,
  // down into the storm with the charge, down the great bolt to the ground beyond the western ridges, and back low over
  // the land with the light it throws out, to him at the edge of the pines as the dark comes
  // (up, away from the sun: deep blue overhead, the clouds lit from the side)
  const SKY_UP = V3(0.12, 0.92, 0.36).normalize();
  // the sheets of cloud across the well the launch bursts up through: [when the eye is in it, its height (m), how thick]
  // (a whole one first, a screen glowing with the light over it; then pearl; the last gold, at the top of the sea)
  const SHEETS = [[48.215, 1300, 110], [48.345, 1700, 120], [48.455, 2040, 150]];
  let FLIGHT = null;
  const _fl1 = V3(), _fl2 = V3(), _chB = V3(), _hitGold = new THREE.Color();
  const _rainP = V3(), _rainV = V3();
  let lastShot = "";
  let STAGE = null;
  function flightPath() {
    if (FLIGHT) return FLIGHT;
    const E = valleyP(49.5).clone();
    // (his place at the edge of the pines, facing the strike: behind him, to his right)
    const toHit = S_HIT.clone().sub(E).setY(0).normalize(), bk = toHit.clone().negate(), rt = V3(-toHit.z, 0, toHit.x);
    const atHim = (b, r, h) => E.clone().addScaledVector(bk, b).addScaledVector(rt, r).add(V3(0, h, 0));
    // (in the well: round its axis from the side the pines are on, a, at r metres from it, at height y)
    const inWell = (a, r, y) => EYE.clone().addScaledVector(toEye, -r * Math.cos(a)).addScaledVector(V3(-toEye.z, 0, toEye.x), r * Math.sin(a)).setY(y);
    const c0 = mushCam(47.4);
    // (the pine over the mushrooms: the lens goes up beside its trunk on the side away from the eye, out through its crown)
    const pine = A.mushPine, L = V3(toEye.x, 0, toEye.z).normalize();
    // (along the edge of its crown, the branches sweeping past one side of the frame, the sky on the other)
    const rise = (y, r = 2.2) => pine.base.clone().addScaledVector(L, -r).addScaledVector(V3(-L.z, 0, L.x), 0.4 * Math.min(r, 3)).setY(y);
    // (in through the middle of its ragged mouth; then up the well close to its wall, about 150 m in from it, the well
    // widening as it goes up)
    const up = (a, y) => inWell(a, lerp(455, 530, smooth(730, 1150, y)) * (1 + 0.32 * smooth(1100, 2600, y)), y);
    const K = [
      // The launch. Behind him at the edge of the pines, looking up at the gathering as the forest holds its breath;
      // the lens draws back behind the pine's trunk, like a spring loaded; lifts, slowly at first, a look down at him;
      // then bursts up through the crown with the birds and on, faster and faster, toward the eye under the deck. Into
      // its mouth, one flash of lightning showing the walls; up the well close to its wall, winding round its axis;
      // slowing under the first sheet across it, a screen glowing with the light above it where the fight's shadows
      // play; bursting through it, and up through the pearl and the gold (SHEETS), out over the sea into the sun,
      // slowing, to hang there.
      [47.4, c0],
      [47.47, c0.clone().lerp(rise(c0.y - 0.45), 0.8)],
      [47.5, rise(c0.y + 0.5)],
      [47.535, rise(c0.y + 4.2)],
      [47.55, rise(pine.base.y + 9.5, 3.4)],
      [47.565, rise(pine.base.y + 16, 3.0)],
      [47.58, rise(pine.top.y + 1.5, 2.2)],
      [47.6, rise(pine.top.y + 14, 0).addScaledVector(L, 3)],
      [47.64, mushSpot.clone().addScaledVector(toEye, 22).add(V3(0, 64, 0))],
      // (from here at an even speed, about 3 km a unit of the story, so the climb never slows going into the well)
      [47.73, mushSpot.clone().addScaledVector(toEye, 140).add(V3(0, 205, 0))],
      [47.833, mushSpot.clone().addScaledVector(toEye, 370).add(V3(0, 450, 0))],
      [47.92, inWell(-0.04, 700, 590)],
      [48.0, up(0.0, 730)],
      [48.05, up(0.12, 905)],
      [48.1, up(0.22, 1050)],
      [48.15, up(0.29, 1135)],
      [48.195, up(0.33, 1182)],
      [SHEETS[0][0], up(0.4, SHEETS[0][1])],
      [48.24, up(0.47, 1392)],
      [48.3, up(0.63, 1585)],
      [SHEETS[1][0], up(0.73, SHEETS[1][1])],
      [48.38, up(0.83, 1815)],
      [48.425, up(0.97, 1955)],
      [SHEETS[2][0], up(1.06, SHEETS[2][1])],
      // (bursting out over the sea: quicker for a moment, then slowing to hang in the sun)
      [48.49, up(1.16, 2190)],
      // (and then, in the silence, slower and slower: hanging in the sun over the sea)
      [48.53, V3(-1152, 2303, -264)],
      [48.62, V3(-1095, 2503, -115)],
      [48.8, V3(-1005, 2816, 119)],
      [49.05, V3(-935, 3060, 300)],
      [49.35, V3(-705, 3150, 225)],
      // (round the fight, slowly, the peaks and the sea turning behind it)
      [49.9, V3(-560, 3080, 170)],
      [51.0, V3(-656, 3110, 445)],
      [52.2, V3(-760, 3130, 680)],
      // (the dive: up a little as the fight is torn away west, slowing, weightless for a moment as the lens tips over;
      // then falling, faster and faster, down through the storm toward the valley under it, to its base beside the
      // knot of the charge)
      [52.52, V3(-805, 3172, 700)],
      [52.75, V3(-850, 3050, 690)],
      [53.0, V3(-760, 2620, 560)],
      [53.25, V3(-610, 2150, 360)],
      [53.5, V3(-420, 1650, 140)],
      [53.75, V3(-210, 1100, -80)],
      [53.92, V3(-10, 600, -230)],
      // (the leader comes down; the eye falls with it, down to him at the edge of the pines, there as it strikes)
      [54.02, V3(8, 470, -222)],
      [54.12, V3(18, 330, -205)],
      [54.22, V3(24, 195, -186)],
      [54.31, V3(26, 88, -166)],
      [54.37, V3(21, 36, -154)],
      [54.42, atHim(3.4, 0.9, 1.35)],
      // (braced behind him as the light runs over the land at him and past; then after what is thrown out of the fire)
      [54.6, atHim(3.1, 0.8, 1.4)],
      [54.9, atHim(3.3, 1.0, 1.55)],
      // (round to his left as the light goes up out of the fire and away to the right, so he stays in the frame)
      [55.4, atHim(3.6, -0.6, 1.8)],
      [56.15, atHim(3.8, -0.8, 1.85)],
      [56.95, atHim(3.2, -0.3, 1.9)],
      [57.4, atHim(2.5, 0.3, 1.95)],
      [57.9, atHim(1.9, 0.7, 1.85)],
    ];
    const curve = new THREE.CatmullRomCurve3(K.map(k => k[1]), false, 'centripetal');
    // (60 divisions to each span between keys, so key j sits at lens[j * 60]; the same fineness for getPointAt)
    curve.arcLengthDivisions = (K.length - 1) * 60;
    const lens = curve.getLengths((K.length - 1) * 60);
    const total = lens[lens.length - 1];
    FLIGHT = { curve, keys: monoKeys(K.map((k, j) => [k[0], lens[j * 60] / total])), E, rt, bk };
    return FLIGHT;
  }
  const flightAt = (u, out) => { const F = flightPath(); return out.copy(F.curve.getPointAt(clamp(F.keys(u)))); };
  const tangentAt = (u, du) => flightAt(u + du, V3()).sub(flightAt(u, V3()));
  // the great bolt's leader: how far down it has come
  const BOLT0 = 54.0, BOLT1 = 54.42;
  const boltReveal = u => Math.pow(clamp((u - BOLT0) / (BOLT1 - BOLT0)), 1.25);
  // (the lens: tighter as it sinks before the launch, wide as it bursts up, wider still each time it goes through a
  // sheet of cloud, widest bursting out over the sea; then it eases as it slows and hangs there)
  const FLIGHT_FOV = monoKeys([[47.4, 62], [47.47, 57], [47.5, 58], [47.535, 64], [47.6, 72], [47.75, 74], [48.1, 72], [48.19, 70], [48.215, 76], [48.25, 74], [48.33, 74], [48.345, 78], [48.38, 74], [48.44, 74], [48.455, 80], [48.5, 76], [48.62, 66], [48.95, 60], [49.35, 60], [50.0, 56], [52.2, 56], [52.52, 52], [52.75, 64], [53.6, 70], [54.0, 72], [54.3, 70], [54.42, 66], [54.7, 62], [55.4, 60], [56.2, 58], [57.0, 53], [57.9, 50]]);
  // (and its motion: a rumble shaking the eye as it bursts up and at each sheet, still once it is out in the sun; a
  // slow sway of the frame as it winds up the well, in degrees)
  // (out over the sea it stops dead: in one frame, nothing shakes)
  const RUMBLE = monoKeys([[47.44, 0], [47.47, 0.3], [47.5, 0.5], [47.54, 1.3], [47.6, 0.9], [47.75, 0.5], [47.99, 0.7], [48.08, 0.35], [48.19, 0.12], [48.212, 1.6], [48.24, 0.5], [48.33, 0.5], [48.343, 1.4], [48.37, 0.5], [48.44, 0.6], [48.455, 1.9], [48.462, 1.2], [SILENCE, 0], [49.0, 0],
    // (the dive: still for a moment as it tips over, then shaking harder and harder down through the storm)
    [52.6, 0], [52.85, 0.15], [53.1, 0.7], [53.5, 1.0], [53.9, 1.35], [54.0, 0.9], [54.12, 0.5], [54.3, 0.2], [54.42, 0]]);
  // (and down through the storm the frame turns as it falls, a slow corkscrew, unwinding as it comes down to him)
  const DIVE_ROLL = monoKeys([[52.8, 0], [53.2, 10], [53.6, 26], [53.92, 38], [54.08, 18], [54.3, 0]]);
  const SWAY = monoKeys([[47.5, 0], [47.65, 1.2], [48.05, 2.6], [48.19, 1.0], [48.25, 2.8], [48.45, 3.2], [48.5, 0.6], [48.7, 0], [49.0, 0]]);
  // where the eye looks, phase by phase (blended where they overlap)
  const AIMS = [
    // (on from the look up at the gathering behind him; up to its eye as the lens rises toward it; then on the two
    // lights, up the eye after them and out over the sea, round the fight)
    // (as a direction: from the lens as it bursts up, a point 30 m off would swing the eye down to the ground)
    [47.0, 47.4, 47.49, 47.51, () => _fl1.copy(mushLook(47.4)).sub(mushCam(47.4))],
    // (lifting: a look down at him, small among the ferns at the foot of the pine; then up again into its crown)
    [47.49, 47.51, 47.522, 47.545, (u, p) => _fl1.copy(mushSpot).add(V3(0, 0.9, 0)).sub(p)],
    [47.522, 47.545, 47.96, 48.0, (u, p) => _fl1.copy(EYE).setY(1600).sub(p)],
    // (up the well along its wall, the way it winds, and steeper under the screen where the shadows play)
    [47.96, 48.0, 48.44, 48.47, (u, p) => wellAim(u, p)],
    // (out over the sea: down from the sun to the horizon, the fight off to one side; then on it)
    [48.44, 48.47, 49.0, 49.35, (u, p) => hangAim(u, p)],
    [49.0, 49.35, SMASH, SMASH + 0.08, (u, p) => _fl1.copy(_dc).sub(p)],
    // (the dive: on the gold one as it is smashed down, then chasing its light down through the storm, a little ahead of
    // it, into the knot of the charge)
    [SMASH, SMASH + 0.08, 53.97, 54.05, (u, p) => GOLD_FALL(u + 0.03, _fl1).sub(p)],
    // (falling with it: on the leader's tip as it comes down ahead of the eye)
    [53.97, 54.05, 54.3, 54.4, (u, p) => megaBolt.tip(clamp(boltReveal(u + 0.04) + 0.08), _fl1).sub(p)],
    // (behind him: the stroke, the fire swelling on the slope, the light running at him over the land)
    [54.3, 54.4, 55.1, 55.35, (u, p) => _fl1.copy(S_HIT).add(V3(0, 34, 0)).sub(p)],
    // (after what is thrown up out of the fire, as it goes over the ridges: a little ahead of it)
    // (never so high that he leaves the frame: the light goes over the top of it, he stays at its foot)
    [55.1, 55.35, 56.4, 56.8, (u, p) => { const d = goldAt(u + 0.08, _fl1).lerp(S_HIT, 0.5).sub(p); d.y = Math.min(d.y, Math.hypot(d.x, d.z) * 0.27); return d; }],
    // (then on the burning slope and the dark coming over the land, past him)
    [56.4, 56.8, 59, 60, (u, p) => _fl1.copy(S_HIT).add(V3(0, 16, 0)).lerp(flightPath().E, 0.35).sub(p)],
  ];
  // (up the well: along the way the path winds, and up; under the screen, up at it)
  const _wa = V3(), _wr = V3();
  function wellAim(u, p) {
    _wr.set(p.x - EYE.x, 0, p.z - EYE.z).normalize();
    const along = tangentAt(u, 0.03).normalize();
    const steep = band(48.07, 48.12, 48.18, 48.205, u);
    return _wa.copy(along).add(V3(0, lerp(0.55, 1.6, steep), 0)).addScaledVector(_wr, -lerp(0.25, 0.4, steep));
  }
  // (out over the sea: from looking up at the sun, down to the horizon, the fight high and off to one side)
  const HANG_PITCH = monoKeys([[48.44, 62], [48.5, 50], [48.62, 22], [48.8, 8], [49.0, 6]]);
  function hangAim(u, p) {
    const f = _fl1.copy(_dc).sub(p).setY(0).normalize();
    const yaw = THREE.MathUtils.degToRad(24 * smooth(48.5, 48.8, u));
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const h = V3(f.x * c - f.z * sn, 0, f.x * sn + f.z * c);
    const pt = THREE.MathUtils.degToRad(HANG_PITCH(u));
    return _wa.copy(h).multiplyScalar(Math.cos(pt)).add(V3(0, Math.sin(pt), 0));
  }
  // (the war's own shots, cut on its beats; jolted by each blow, harder the nearer)
  const _wsd = V3();
  function warShot(u, time) {
    const ws = warShotAt(u);
    if (!ws) return null;
    const dir = _wsd.copy(ws.look).sub(ws.pos);
    const dl = dir.length(); dir.divideScalar(Math.max(dl, 1e-3));
    let jolt = 0;
    for (const b of WAR_BLOWS) { if (!b.shake) continue; const age = cueAge(b.u, u, time); if (age < 0.9) jolt += b.shake * Math.exp(-age / 0.11); }
    jolt = Math.min(jolt, 3) * THREE.MathUtils.degToRad(1);
    let roll = 0;
    if (jolt > 1e-5) {
      const jx = Math.sin(time * 41.3) * 0.6 + Math.sin(time * 23.1 + 1.3) * 0.4, jy = Math.sin(time * 37.7 + 2.1) * 0.6 + Math.sin(time * 19.9 + 0.4) * 0.4;
      const rgt = V3().crossVectors(dir, UP).normalize(), upv = V3().crossVectors(rgt, dir);
      dir.addScaledVector(rgt, jx * jolt).addScaledVector(upv, jy * jolt).normalize();
      roll = jolt * 0.6 * Math.sin(time * 29.3);
    }
    return { pos: ws.pos.clone(), look: ws.pos.clone().addScaledVector(dir, Math.max(dl, 1)), fov: ws.fov, roll, war: ws.id };
  }
  function flightShot(u, portrait = 0, time = 0) {
    const wsh = warShot(u, time);
    if (wsh) return wsh;
    const pos = flightAt(u, V3());
    // (on a tall screen, while the eye is behind him at the edge of the pines, closer in behind him: he stays in it)
    const pk = portrait * band(54.3, 54.42, 57.9, 58.9, u);
    if (pk > 0) { const F = flightPath(); pos.addScaledVector(F.rt, -0.75 * pk).addScaledVector(F.bk, -0.5 * pk); }
    const dir = V3();
    for (const [a, b, c, d, f] of AIMS) { const w = band(a, b, c, d, u); if (w > 0) dir.addScaledVector(f(u, pos).normalize(), w); }
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    // the rumble: the eye jolted off its aim and back, quickly (a shake of the position would not show with everything
    // a kilometre away); the sway: the frame rolling slowly as it winds up the well, with the scroll
    const rb = THREE.MathUtils.degToRad(RUMBLE(u));
    let roll = THREE.MathUtils.degToRad(SWAY(u)) * Math.sin(u * 7.3) + THREE.MathUtils.degToRad(DIVE_ROLL(u));
    if (rb > 1e-5) {
      const jx = Math.sin(time * 17.3) * 0.5 + Math.sin(time * 9.1 + 1.3) * 0.35 + Math.sin(time * 31.7 + 0.6) * 0.15;
      const jy = Math.sin(time * 13.7 + 2.1) * 0.5 + Math.sin(time * 7.9 + 0.4) * 0.35 + Math.sin(time * 27.1 + 1.9) * 0.15;
      const rgt = V3().crossVectors(dir, UP).normalize(), upv = V3().crossVectors(rgt, dir);
      dir.addScaledVector(rgt, jx * rb).addScaledVector(upv, jy * rb).normalize();
      roll += rb * 0.5 * Math.sin(time * 11.3 + 0.7);
    }
    return { pos, look: pos.clone().addScaledVector(dir, 100), fov: FLIGHT_FOV(u), roll };
  }
  // (for checking the flight without drawing it)
  debug.flight = u => { const s = flightShot(u, 0, 0); return { pos: s.pos.toArray().map(v => +v.toFixed(1)), fov: +s.fov.toFixed(1), roll: +THREE.MathUtils.radToDeg(s.roll).toFixed(2), r: +Math.hypot(s.pos.x - EYE.x, s.pos.z - EYE.z).toFixed(0), mush: mushSpot.toArray().map(v => +v.toFixed(1)), look: s.look.clone().sub(s.pos).normalize().toArray().map(v => +v.toFixed(2)) }; };
  debug.launchRefs = () => ({ c0: mushCam(47.4).toArray(), l0: mushLook(47.4).toArray(), pine: A.mushPine, eye: EYE.toArray(), toEye: toEye.toArray(), dc: duelCentre(48.6, V3()).toArray(), dc50: duelCentre(50.5, V3()).toArray() });

  function update(u, time, dt) {
    metrics.u = u;
    U.uTime.value = time;
    const sample = key => (debug.pal && debug.pal[key] !== undefined ? debug.pal[key] : env[key](u));
    const inB = inForest(u);
    world.root.visible = !inB;
    if (B) B.root.visible = inB;
    mountains.group.visible = !inB;
    const fireAmt = inB ? 0 : sample('fire');
    U.uFire.value = fireAmt;
    const broken = u >= brokenAt ? 1 : 0;
    U.uBroken.value = broken;
    U.uRuin.value = 0;
    // (the blast behind the ring of light, as it runs over him)
    const blast = inB ? 0 : band(54.56, 54.64, 55.1, 56.0, u);
    // (and the wind that comes over the ridge with the light where it came down)
    const xWind = inB ? 0 : band(107.47, 107.6, 107.95, 108.2, u);
    // (in the dell: the air stirring as the light gathers in the crown, the gust as the pillar strikes)
    const bWind = inB ? 0.6 * band(139.2, 139.38, 139.43, 139.45, u) + 2.6 * band(STRIKE_B, STRIKE_B + 0.01, STRIKE_B + 0.1, STRIKE_B + 0.45, u) : 0;
    U.uWind.value = sample('wind') + 2.4 * blast + 1.9 * xWind + bWind;
    metrics.wind = U.uWind.value;

    // ------------------------------------------------------------ sky & light
    const S = sky.uniforms;
    S.uZenith.value.setRGB(...sample('zenith'));
    S.uHorizon.value.setRGB(...sample('horizon'));
    // below the horizon the environment sees sunlit earth, not sky: warm bounce in daylight
    S.uGround.value.setRGB(...sample('hemiGround')).multiplyScalar(0.8).lerp(S.uHorizon.value, 0.25);
    S.uCloudLit.value.setRGB(...sample('cloudLit'));
    S.uCloudShade.value.setRGB(...sample('cloudShade'));
    S.uCover.value = debug.cover ?? sample('cloudCover');
    S.uSharp.value = inB ? 0 : sample('cloudSharp');
    const stormAmt = sample('storm');
    S.uStorm.value = inB ? 0 : stormAmt;
    S.uStormGrow.value = inB ? 0 : sample('stormGrow');
    S.uStormC.value.copy(stormC);
    const sunVis = sample('sunVis');
    S.uSunVis.value = sunVis;
    const fireGlow = inB ? 0 : sample('fireGlow');
    S.uFireGlow.value = fireGlow;
    S.uClash.value = sample('clash');
    S.uWind.value.set(lerp(0.0009, 0.0042, stormAmt), lerp(0.0003, 0.0012, stormAmt)).multiplyScalar(inB && u > 111 && u < 124.4 ? 3.5 : 1);
    const sunCol = sample('sunCol');
    S.uSunCol.value.setRGB(...sunCol);
    const sd = inB ? B.sunDir(u) : debug.sunA ? V3(...debug.sunA).normalize() : sunDirA.set(...env.sunDir(u)).normalize();
    S.uSunDir.value.copy(sd);
    S.uMoonCol.value.setRGB(0.5, 0.55, 0.7).multiplyScalar(sample('moon') * (1 - stormAmt * 0.8));
    // the clash above the storm: gold and violet circle a drifting centre, tear apart and slam together
    const clashK = inB ? 0 : S.uClash.value;
    // the duel above the clouds: where it is (coming in from far off, fighting in front of us, tearing away west)
    duelCentre(u, _dc);
    duelFloor = lerp(1150, DUEL_FLOOR, duelUp(u));
    duelFlight(time, S.uC1.value, S.uC2.value);
    for (let k = 0; k < 4; k++) duelFlight(time - (k + 1) * 0.06, S.uT1.value[k], S.uT2.value[k]);
    // (the war, close to: the two where war.js has them, from the cut to the two of them facing each other until the
    // violet one is gone)
    const inWar = !inB && u >= WAR[0] && u < 53.1;
    const warFlight = inWar ? war.flight(u, time) : null;
    if (inWar) {
      warFlight(time, S.uC1.value, S.uC2.value);
      for (let k = 0; k < 4; k++) warFlight(time - (k + 1) * 0.06, S.uT1.value[k], S.uT2.value[k]);
      // (the fight's centre is between the two of them now)
      _dc.copy(S.uC1.value).lerp(S.uC2.value, 0.5);
    }
    const falling = inB ? 0 : smooth(SMASH - 0.02, SMASH + 0.04, u) * (u < 54.02 ? 1 : 0);
    if (falling > 0) {
      S.uC1.value.lerp(GOLD_FALL(u, _gf), falling);
      for (let k = 0; k < 4; k++) S.uT1.value[k].lerp(GOLD_FALL(u - 0.014 * (k + 1), _gf), falling);
      // (the light stays lit for the gold one only: the shader's clash level up, the violet one faded)
      S.uClash.value = Math.max(S.uClash.value, falling);
    }
    const smashAge = inB ? Infinity : cueAge(SMASH, u, time);
    // (and down through the storm the lightning reaches for the falling light, three times, fired as the story crosses
    // them; violet, the sect's)
    if (!inB) for (const [at, side] of [[53.06, 1], [53.4, -1], [53.72, 1]]) {
      if (cueAge(at, u, time) !== 0) continue;
      const g = GOLD_FALL(u, V3()), q = Math.floor(at * 97);
      lightning.strike(time, g.clone().add(V3(side * 340, 260 + (q % 3) * 60, -side * 180)), g, { seed: q, strength: 0.85, width: 2.4, branches: 6, levels: 6, color: new THREE.Color(0.7, 0.48, 1.0) });
    }
    const blows = inWar && u < SMASH ? [] : duel.blows(time, 3, duelFloor - _dc.y);
    const lastBlow = blows[0];
    const blowAge = lastBlow ? time - lastBlow.t : 9;
    if (lastBlow) S.uImpact.value.set(lastBlow.pos.x + _dc.x, lastBlow.pos.y + _dc.y, lastBlow.pos.z + _dc.z, clashK > 0.01 && blowAge < 0.8 ? blowAge / 0.8 : -1);
    if (smashAge < 0.8) S.uImpact.value.set(GOLD_FALL(SMASH, _gf).x, _gf.y, _gf.z, smashAge / 0.8);
    // the light of the fight pouring down the eye of the gathering, brighter with each blow
    // (cut off by the sheets as they form across the well: from inside it, end-on, it would only be a glare)
    S.uBeam.value.set(1.0, 0.8, 0.56, (inB ? 0 : band(45.75, 46.5, 47.55, 47.72, u)) * (0.4 + 1.0 * Math.exp(-blowAge / 0.18)));
    // (under the screen the fight is only its shadows: its own light, glaring through the cloud, drawn back)
    { const scr = 1; S.uClashGV.value.set(scr * (1 - 0.92 * band(52.64, 52.82, 53.9, 54.0, u)), scr * (1 - smooth(SMASH + 0.08, SMASH + 0.4, u))); }
    S.uEye.value.set(0, 0, 0, 0);
    // the blows punch holes in the cloud tops under them
    for (let i = 0; i < 3; i++) {
      const b = blows[i], c = S.uCrater.value[i];
      if (b && clashK > 0.01 && b.kind === 3) { const age = (time - b.t) / 1.8; c.set(b.pos.x + _dc.x, duelFloor + 10, b.pos.z + _dc.z, age < 1 ? age : -1); }
      else c.w = -1;
    }
    // the war's blows (war.js BLOWS): fired as the story crosses them, played on the clock
    const warBw = [];
    if (inWar && u < SMASH) {
      for (const b of WAR_BLOWS) { const age = cueAge(b.u, u, time); if (age < 1.8) warBw.push({ b, age }); }
      warBw.sort((x, y) => x.age - y.age);
      // (the light of the newest running out over the sea)
      const nb = warBw.find(w => w.b.kind !== 4 && w.b.kind !== 8);
      // (the hardest run out over the sea for longer: the ring of light crossing it)
      if (nb) { const L0 = nb.b.crater ? 3.2 : 0.8; if (nb.age < L0) { const p = nb.b.at(u); S.uImpact.value.set(p.x, p.y, p.z, nb.age / L0); } }
      // (the hardest tear a ring out of the sea under them: its cloud thrown out and up, filling back in)
      let ci = 0;
      for (const w of warBw) {
        if (!w.b.crater || ci > 2) continue;
        const age = w.age / w.b.crater[3];
        if (age >= 1) continue;
        const p = w.b.at(u);
        S.uCrater.value[ci].set(p.x, DUEL_FLOOR + 10, p.z, age); S.uCraterS.value[ci] = w.b.crater[2]; ci++;
      }
      for (; ci < 3; ci++) { S.uCrater.value[ci].w = -1; S.uCraterS.value[ci] = 1; }
      // (each throws lightning out of it, gold and violet, as it strikes)
      for (const w of warBw) {
        const b = w.b;
        if (!b.bolts || w.age !== 0) continue;
        const M = b.at(u), q = Math.floor(b.u * 97);
        for (let i = 0; i < b.bolts; i++) {
          const a1 = (q * 2.399 + i * 2.1) % (Math.PI * 2), r = 460 + i * 70;
          lightning.strike(time + i * 0.02, M, M.clone().add(V3(Math.cos(a1) * r, (i % 2 ? 1 : -1) * (180 + (q % 5) * 50), Math.sin(a1) * r)), { seed: q * 31 + i * 7, strength: 0.9, width: 2.6, branches: 8, levels: 6, color: i % 2 ? new THREE.Color(1.0, 0.82, 0.5) : new THREE.Color(0.66, 0.5, 1.0) });
        }
      }
    } else if (!inWar) for (let i = 0; i < 3; i++) S.uCraterS.value[i] = 1;
    // (the storm the masked one calls down on the bell about the gold one, war.js BOLTS)
    if (inWar) for (const Bt of WAR_BOLTS) if (cueAge(Bt.u, u, time) === 0) lightning.strike(time, Bt.from(), Bt.to(), { seed: Math.floor(Bt.u * 131), strength: 1.0, width: 3.0, branches: 7, levels: 6, color: new THREE.Color(0.72, 0.46, 1.0) });
    // (the trenches the crescent's halves cut into the sea behind the masked one, filling back in)
    for (let k = 0; k < 2; k++) {
      const T = WAR_TRENCH[k];
      S.uTrench.value[k].set(T.a.x, T.a.z, T.b.x, T.b.z);
      S.uTrenchK.value[k].set(inB ? 0 : smooth(T.u0, T.u1, u), smooth(51.6, 52.6, u));
    }
    // each blow throws lightning: down into the cloud tops and out through the air
    if (lastBlow && clashK > 0.5 && u < SMASH && lastBlow.t > lastBlowT && lastBlow.kind !== 4 && time - lastBlowBolt > 0.34) {
      lastBlowBolt = time;
      const M = V3(lastBlow.pos.x + _dc.x, lastBlow.pos.y + _dc.y, lastBlow.pos.z + _dc.z);
      const q = Math.floor(lastBlow.t * 7.3);
      const a1 = (q * 2.399) % (Math.PI * 2), a2 = a1 + 2.1;
      lightning.strike(time, M, M.clone().add(V3(Math.cos(a1) * 420, -380 - (q % 5) * 40, Math.sin(a1) * 420)), { seed: q * 31 + 7, strength: 0.9, width: 2.6, branches: 8, levels: 6, color: new THREE.Color(0.66, 0.5, 1.0) });
      if (lastBlow.kind !== 1) lightning.strike(time + 0.02, M, M.clone().add(V3(Math.cos(a2) * 520, 90 + (q % 3) * 60, Math.sin(a2) * 520)), { seed: q * 17 + 3, strength: 0.65, width: 2.0, branches: 6, levels: 6, color: new THREE.Color(1.0, 0.82, 0.5) });
    }
    // (and for the score: a count of the blows struck, the last one's kind, how much of the fight is in view)
    if (lastBlow && lastBlow.t > lastBlowT && u < SMASH) { metrics.blowN = (metrics.blowN || 0) + 1; metrics.blowKind = lastBlow.kind; }
    if (smashAge === 0) { metrics.blowN = (metrics.blowN || 0) + 1; metrics.blowKind = 2; }
    metrics.duelK = clashK;
    if (lastBlow) lastBlowT = lastBlow.t;
    // where it came down beyond the ridges: the flash under the deck and the ring through it
    S.uHit.value.set(STAR_C.x, 0, STAR_C.z, !inB && u >= STAR[1] && u < STAR[1] + 2.4 ? (u - STAR[1]) / 2.4 : -1);
    S.uHitCol.value.setRGB(1, 0.86, 0.74);
    // (where the light comes down beyond the ridge: the cloud over it lit gold from beneath, a ring running out through it)
    if (!inB && !debug.noXH && u >= LAUNCH[1] && u < LAUNCH[1] + 2.0) { S.uHit.value.set(CROSS_L.x, 0, CROSS_L.z, (u - LAUNCH[1]) / 2.0); S.uHitCol.value.setRGB(1, 0.74, 0.4); }
    // (and over the land: a ring of light running out from the strike, the dark right behind it; it reaches him as
    // the camera does)
    // (it outruns the eye racing home: over the land and into the valley ahead of it)
    const ringR = u >= STAR[1] ? 60 + 1000 * (u - STAR[1]) : 0;
    const darkR = Math.max(0, ringR - 160), darkAmt = inB ? 0 : band(STAR[1], STAR[1] + 0.3, 57.5, 58.3, u);
    S.uDark.value.set(STAR_C.x, STAR_C.z, darkR, darkAmt);
    FOGU.cfDark.value.set(STAR_C.x, STAR_C.z, darkR, darkAmt);
    FOGU.cfRing.value.set(ringR, inB ? 0 : band(STAR[1], STAR[1] + 0.1, 57.0, 57.6, u) * 2.0, 60, 0);
    const fog = sample('fog');
    scene.fog.color.setRGB(...fog);
    scene.fog.density = sample('fogD');
    // (up the eye's well the light is low: the screen glows over a dark well, the sheets brighten one by one; at the
    // breach the white of the page covers the eye's adjusting to the sun)
    // (darker up the well of the launch; and dark inside the storm in the dive, so the falling light and the lightning
    // reaching for it are what is seen)
    renderer.toneMappingExposure = sample('exposure') * (inB ? 1 : lerp(1, 0.56, band(47.85, 48.0, 48.44, SILENCE, u)) * lerp(1, 0.3, band(52.95, 53.15, 53.84, 53.98, u)));
    sun.color.setRGB(...sunCol);
    sun.intensity = sample('sunI') * sunVis;
    hemi.intensity = sample('hemiI') * (inB ? 1 : env.fillK(u));
    hemi.color.setRGB(...sample('hemiSky'));
    hemi.groundColor.setRGB(...sample('hemiGround'));
    moon.intensity = sample('moon');
    scene.environmentIntensity = sample('envI') * (inB ? 1 : lerp(1, env.fillK(u), 0.6));
    mist.material.uniforms.uAlpha.value = sample('mist');
    mist.material.uniforms.uCol.value.setRGB(...fog).lerp(new THREE.Color(1, 1, 1), 0.25);
    mist.material.uniforms.uGlow.value.setRGB(1, 0.3, 0.08).multiplyScalar(fireGlow * 0.5);
    // atmosphere for every surface: ground-hugging fog that glows toward the sun, red over the burning village
    FOGU.cfFogSunDir.value.copy(sd);
    FOGU.cfFogSunCol.value.setRGB(...sunCol).multiplyScalar(sunVis);
    FOGU.cfFogH.value.set(sample('fogFall'), inB ? (B.set && B.set.fogFloorAt ? B.set.fogFloorAt(camera.position.x, camera.position.z) : B.fogFloor) : 0, sample('fogH'), inB ? 6 : 10);
    FOGU.cfFogX.value.set(sample('sunGlow'), 0, fireGlow * 0.5 * (u > 61.5 && u < 108 ? 0.35 : 1), inB ? 0 : sample('aerial'));
    FOGU.cfFogGlow.value.set(2, 0, 30, 170);
    // the far low fog lies in drifting banks (valley floors, the forest's hollows)
    FOGU.cfFogT.value.set(time, inB ? 0.7 : 0.85, inB ? 0.01 : 0.0045, 0);

    // ------------------------------------------------------------ lightning: the scripted strikes and the storm's own
    // [u, strength, which, kind (0 white, 1 violet, 2 into the ground beside the road), metres ahead of him]
    if (!DEBUG) for (const [at, s, which, kind, ahead] of STRIKES) if (lastU < at && u >= at && u - at < 1.2) {
      if (kind === 2) groundStrikeAt(at, s, which, ahead, time); else strikeAt(which, s, kind, time);
    }
    const stormLive = !DEBUG && !inB && stormAmt > 0.55 && u > 55.2 && u < 104;
    if (stormLive && time > nextStrike) {
      const ridgeK = u > 98 && u < 104;
      strikeAt(Math.random(), 0.3 + Math.random() * 0.45, ridgeK && Math.random() < 0.6 ? 1 : 0, time);
      nextStrike = time + (u < 60 ? 1.6 + Math.random() * 2.8 : 4 + Math.random() * 6);
    }
    if (stormLive && time > nextSheet) {
      sheetT0 = time;
      sheetPos.set(stormC.x + (Math.random() - 0.5) * 3000, 900 + Math.random() * 900, stormC.z + (Math.random() - 0.5) * 3000).lerp(camera.position.clone().setY(1200), 0.4);
      nextSheet = time + 0.5 + Math.random() * 2.2;
    }
    if (debug.clearBolts) { lightning.reset(); gStrikes.reset(); debug.clearBolts = false; }
    if (debug.gstrike) { const [i, age] = debug.gstrike, e = STRIKES.filter(x => x[3] === 2)[i]; gStrikes.reset(); if (e) groundStrikeAt(e[0], e[1], e[2], e[4], time - age); debug.gstrike = null; }
    const bolt = lightning.update(time);
    const gs = gStrikes.update(time, inB ? -1e9 : u);
    const strandK = inB ? [0, 0, 0] : env.strands(u);
    strands.uniforms.uLayer.value.set(...strandK);
    strands.uniforms.uCam.value.copy(camera.position);
    strands.mesh.visible = Math.max(...strandK) > 0.003;
    // (diving through the storm: lightning flickering through the cloud all round, lighting it from within)
    // (seeded by the clock, so the same at every look)
    const diveLive = !inB && u > 53.12 && u < 53.97;
    let diveFlash = 0;
    if (diveLive) {
      // (a smooth pulse, no strobe inside it, and no more than about two and a half a second)
      const slot = Math.floor(time / 0.42), q = rng(slot * 7 + 3), ts = slot * 0.42 + q() * 0.12, age = time - ts;
      if (age > 0 && age < 0.5) {
        diveFlash = Math.exp(-age * 8) * 0.8;
        const fw = V3(0, 0, -1).applyQuaternion(camera.quaternion);
        sheetPos.copy(camera.position).addScaledVector(fw, 250 + q() * 500).add(V3((q() - 0.5) * 900, (q() - 0.6) * 500, (q() - 0.5) * 900));
      }
    }
    // (the launch: into the eye's mouth, one flash of lightning in its wall, the walls of the well lit for a moment)
    let climbFlash = 0;
    if (!inB) {
      const age = cueAge(48.0, u, time);
      if (age < 0.7) {
        climbFlash = (Math.exp(-age * 7) + (age > 0.13 ? 0.55 * Math.exp(-(age - 0.13) * 9) : 0)) * 0.9;
        const cp = camera.position;
        _fl2.set(cp.x - EYE.x, 0, cp.z - EYE.z).normalize();
        sheetPos.copy(cp).addScaledVector(_fl2, 170).add(V3(0, 160, 0));
      }
    }
    // (the gathering: the light of the fight flickering through the deck forming round the eye, gold and violet;
    // seeded by the clock)
    let vortexFlash = 0;
    if (!inB && u > 45.75 && u < 48.7) {
      const slot = Math.floor(time / 0.62), q = rng(slot * 11 + 5), ts = slot * 0.62 + q() * 0.3, age = time - ts;
      if (age > 0 && age < 0.55) {
        vortexFlash = Math.exp(-age * 7.5) * 0.85 * smooth(45.75, 46.4, u) * (1 - smooth(48.4, 48.7, u));
        const a = q() * Math.PI * 2, r = q.range(250, 1400);
        vortexPos.set(EYE.x + Math.cos(a) * r, q.range(1250, 2300), EYE.z + Math.sin(a) * r);
        vortexViolet = q() < 0.45;
      }
    }
    const sheetAge = time - sheetT0;
    const sheet = Math.max(stormLive && sheetAge > 0 && sheetAge < 0.5 ? Math.exp(-sheetAge * 9) * 0.7 : 0, diveFlash, climbFlash);
    // the great bolt: its leader comes down (the camera rides with its tip), then the stroke and its re-strikes
    const rvB = inB ? 0 : boltReveal(u), sAge = u - BOLT1;
    const strokeB = inB || u < BOLT0 ? 0 : (sAge < 0 ? 0.6 * smooth(BOLT0, BOLT0 + 0.05, u) : Math.exp(-sAge / 0.35) * (2.6 + 0.8 * Math.sin(sAge * 60)) + 0.6 * Math.exp(-Math.pow((sAge - 0.25) / 0.05, 2)) + 0.5 * Math.exp(-Math.pow((sAge - 0.5) / 0.06, 2))) * (1 - smooth(54.95, 55.2, u));
    megaBolt.set(rvB, strokeB, camera, 615, 240);
    // (its channel lights the cloud it comes down through)
    if (strokeB > 0.003) { S.uChanA.value.set(C_F.x, C_F.y, C_F.z, Math.min(2.5, strokeB) * 1.4); megaBolt.tip(rvB, _chB); S.uChanB.value.set(_chB.x, _chB.y, _chB.z, 0); }
    else S.uChanA.value.w = 0;
    let flash = bolt.flash, flashPos = bolt.pos;
    // (its light on the cloud and the land: the leader's glow, then a blink at the stroke and each re-strike)
    const mbF = u < BOLT1 ? strokeB * 0.35 : Math.min(1.3, strokeB * strokeB * 0.22);
    if (mbF > flash) { flash = mbF; flashPos = megaBolt.tip(u < BOLT1 ? rvB : rvB * 0.5, V3()); }
    if (sheet > flash) { flash = sheet; flashPos = sheetPos; }
    const vxOn = vortexFlash > flash;
    if (vxOn) { flash = vortexFlash; flashPos = vortexPos; }
    const gsOn = !inB && gs.flash > flash;
    if (gsOn) { flash = gs.flash; flashPos = gs.pos; }
    S.uFlash.value = flash * (inB ? 0 : 1);
    if (flashPos) S.uFlashPos.value.copy(flashPos);
    if (gsOn && gs.col) S.uFlashCol.value.copy(gs.col);
    else if (vxOn) { if (vortexViolet) S.uFlashCol.value.setRGB(0.74, 0.5, 1.0); else S.uFlashCol.value.setRGB(1.0, 0.78, 0.46); }
    else if (bolt.col && bolt.flash >= sheet) S.uFlashCol.value.copy(bolt.col); else S.uFlashCol.value.setRGB(0.75, 0.72, 1.0);
    // each meeting of the two lights flashes over the valley too
    // (and harder while the fight is low in the eye of the gathering over the valley: its light on him and the pines)
    const impactFlash = inB ? 0 : clashK * Math.exp(-blowAge / 0.08) * 0.9 * clamp(lerp(900, 2100, band(45.6, 46.2, 48.2, 48.6, u)) / Math.max(camera.position.distanceTo(_dc), 1));
    const hitFlash = inB || u < STAR[1] ? 0 : Math.exp(-(u - STAR[1]) / 0.07) * 2.2;
    if (!inB) mountains.update({ fog, horizon: sample('horizon'), sunVis, mist: sample('mist'), fireGlow, storm: stormAmt, night: clamp(sample('moon') * 4) });
    // the river takes the sky, and the fires of the night
    if (!inB) {
      const nightK = clamp(sample('moon') * 4 + stormAmt * 0.4);
      _rvGlow.setRGB(1, 0.32, 0.09).multiplyScalar(fireGlow * 0.35);
      world.river.update({ sky, night: nightK, glow: _rvGlow });
      world.paddies.update({ sky, night: nightK, glow: _rvGlow });
      world.waterwheel.update(time);
    }
    let boltLight = flash * (gsOn ? 3.4 : vxOn ? 2.2 : bolt.flash >= sheet ? 2.8 : 1.2) * (inB ? 0 : 1);
    // (the great bolt lights the land for a blink at its stroke and each re-strike, not a lingering wash)
    if (flash === mbF && mbF > 0) boltLight = strokeB * strokeB * 0.55;
    flashLight.intensity = Math.max(boltLight, impactFlash * 1.6, hitFlash);
    if (hitFlash > Math.max(boltLight, impactFlash * 1.6)) { flashLight.color.setRGB(0.82, 0.86, 1).lerp(_hitGold.setRGB(1, 0.7, 0.4), clamp((u - STAR[1]) / 0.25)); flashLight.position.copy(STAR_C).setY(600); }
    else if (impactFlash * 1.6 > boltLight) { flashLight.color.setRGB(1, 0.8, 0.95); flashLight.position.set(S.uImpact.value.x, S.uImpact.value.y, S.uImpact.value.z); }
    else { flashLight.color.copy(S.uFlashCol.value); if (flashPos) flashLight.position.copy(flashPos); }
    // the sky beyond the ridge on fire where the light came down: its gold over the land from beyond the ridge
    const xFl = inB || debug.noXL ? 0 : crossFlash(u);
    if (xFl * 0.16 > flashLight.intensity) { flashLight.intensity = xFl * 0.16; flashLight.color.setRGB(1, 0.74, 0.42); flashLight.position.copy(CROSS_L).setY(CROSS_L.y + 160); }
    flashLight.target.position.copy(camera.position);
    flashLight.target.updateMatrixWorld();
    post.ink.uFlash.value = bolt.flash * 0.07 + impactFlash * 0.05 + (inB ? 0 : gs.flash * 0.1);
    post.ink.uFlashTint.value.setRGB(0.85, 0.85, 1).lerp(gsTint, clamp(gs.flash * 3));
    // (the moment it comes down: one beat of gold over everything)
    const xHit = inB || u < LAUNCH[1] ? 0 : Math.exp(-(u - LAUNCH[1]) / 0.035) * smooth(LAUNCH[1], LAUNCH[1] + 0.012, u);
    if (xHit > 0.002) { post.ink.uFlash.value += xHit * 0.16; post.ink.uFlashTint.value.setRGB(1, 0.78, 0.45); }
    // the ink's electric blue only while a bolt is in the air (x), its cold wash only while a strike lights the ground (y)
    post.ink.uBoltK.value.set(inB ? 0 : clamp((bolt.flash + gs.flash + gs.glow) * 30), inB ? 0 : clamp(gs.flash * 3 + gs.glow));

    // fire point lights near the camera
    const fireOn = fireAmt > 0.01;
    fireClusters.forEach(c => (c.d = c.p.distanceToSquared(camera.position)));
    const near = fireOn ? [...fireClusters].sort((a, b) => a.d - b.d) : [];
    const insideK = smooth(80.6, 82.0, u) * (1 - smooth(94.3, 95.4, u));
    const gsLit = !inB && gs.glowPos && (gs.flash > 0.01 || gs.glow > 0.01);
    // (the glow of what fell, where the bolt came down: lent the last of the fire lights while it burns)
    const fellGlow = inB || u < STAR[1] ? 0 : (1 - smooth(56.6, 57.6, u)) * (0.6 + 1.6 * Math.exp(-(u - STAR[1]) / 0.35));
    fireLights.forEach((l, i) => {
      if (fellGlow > 0.01 && i === fireLights.length - 1) {
        l.position.copy(S_HIT).add(V3(0, 26, 0));
        l.color.setRGB(1, 0.62, 0.3);
        l.distance = 300; l.decay = 1.6;
        l.color.setRGB(1, 0.5, 0.2);
        l.intensity = fellGlow * 1500 * (0.85 + 0.15 * Math.sin(time * 13));
        return;
      }
      l.distance = 60; l.decay = 1.6;
      if (gsLit && i === fireLights.length - 1) {
        l.position.copy(gs.glowPos); l.position.y += 2.2;
        l.color.setRGB(0.42, 0.64, 1.0);
        l.intensity = gs.flash * 420 + gs.glow * 70;
        return;
      }
      l.color.setHex(0xff6424);
      const c = near[i];
      if (!c) { l.intensity = 0; return; }
      l.position.copy(c.p);
      const grow = smooth(c.delay, c.delay + 0.2, fireAmt) * c.burn;
      l.intensity = grow * (95 + Math.sin(time * 9 + i * 3) * 24 + Math.sin(time * 23 + i) * 14) * (1 - insideK * 0.85);
    });
    const insideAmt = band(76, 79, 97, 99, u) * (fireOn ? 1 : 0);
    interior.position.copy(UH.interiorFire[1].p).add(V3(0, 0.4, 0));
    interior.intensity = insideAmt * (10 + Math.sin(time * 11) * 3 + Math.sin(time * 27) * 1.5);
    interior2.position.copy(UH.interiorFire[2].p).add(V3(0.3, 0.2, 0));
    interior2.intensity = insideAmt * (7 + Math.sin(time * 13 + 1) * 2.5 + Math.sin(time * 31) * 1.2);
    // (after the crystal breaks its light is lent to the uncle's soul: see soulOrb)
    if (u < brokenAt) { crystalLight.color.setHex(0x58e0d8); crystalLight.distance = 6; crystalLight.decay = 1.5; if (A.crystal) crystalLight.position.copy(A.crystal).add(V3(0, 0.3, 0)); }
    crystalLight.intensity = (u < brokenAt ? 1.4 : 0) * (0.8 + Math.sin(time * 2) * 0.2);
    faceLight.position.copy(UH.local(1.2, 1.1, 2.1));
    // (brighter while the room is seen in colour, so his face reads in the firelight)
    faceLight.intensity = band(82.4, 83.6, 96, 97, u) * (fireOn ? 1 : 0) * (5 + Math.sin(time * 7.3) * 1.2 + Math.sin(time * 17) * 0.6) * (1 + 2.2 * roomReveal(u));

    // ------------------------------------------------------------ Wuhen (and the uncle, whose hand he takes)
    // a jump in the story (seeking) re-settles hair and sash; fast scrubbing uses the path's own speed for the gait
    const du = Math.abs(u - lastU);
    const jumped = du > 1.5 || !(dt > 0) || dt > 0.25, scrub = jumped || du > 0.5;
    let P, heading, speed = 0, run = 0, kneel = 0, reach = 0, draw = 0, scale = 1, wVis = true, lie = 0, wave = 0;
    const indoorK = smooth(80.4, 81.4, u) * (1 - smooth(92.4, 93, u));
    // wind on hair and sash: the valley's breeze, a gale while the storm comes in, still air inside the house
    windV.set(0.92, 0.38).normalize().multiplyScalar(U.uWind.value * 2.2 * (1 + 1.3 * band(46.0, 46.9, 58, 60, u)) * (1 - 0.85 * indoorK));
    const hs = { crouch: 0, grief: 0, lookAt: null, lookW: 1, reachTarget: null, gripL: null, release: 0, fall: 0, getUp: 0, hold: 0, wind: windV,
      // (the storm's eye drawing breath over him at the edge of the pines: his hair lifts toward it; and once more as his
      // uncle's soul rises out of him, its breath lifting the boy's hair: the old man's last touch)
      lift: inB ? 0 : 3.2 * band(47.34, 47.44, 47.8, 48.6, u) + 2.2 * band(92.95, 93.15, 93.4, 93.95, u) };
    const elderOn = !inB && u > 80 && u < 99;
    const morningOn = !inB && u < 19.6;
    if (morningOn) {
      // his uncle at the door in the morning
      const e = getElder();
      if (e.mode !== 'morning') { if (!e.night) e.night = { p: e.group.position.clone(), q: e.group.quaternion.clone(), s: e.group.scale.clone() }; e.group.position.copy(UNCLE_AT); e.group.rotation.set(0, -Math.PI / 2, 0); e.group.scale.set(1, 1, 1); e.stale = true; }
      const give = smooth(16.12, 16.24, u);
      const boyHead = wuhen && wuhen.group.visible ? wuhen.anchors.head() : BOY_AT.clone().add(V3(0, 1.58, 0));
      const es = { stand: 1, hold: (1 - give) * smooth(9.0, 9.5, u), holdTarget: BASKET_TOP.clone().add(V3(0.06, 0, 0)), point: band(16.65, 16.95, 17.75, 18.05, u), pointDir: SUN_UP,
        lookAt: boyHead.clone(), speak: band(15.6, 15.8, 17.85, 18.0, u) * 0.8, wind: windV };
      // (his hand on the boy's head, drawn back over his own: bonds.js)
      bonds.elder(u, es, e, wuhen && wuhen.group.visible ? boyHead : null);
      driveHero(e, true, dt, time, es, jumped || e.mode !== 'morning');
      e.mode = 'morning';
      // (the basket in his hand until the boy has it)
      uncleBasket.visible = u < 16.16;
      if (uncleBasket.visible) {
        e.group.updateMatrixWorld(true);
        uncleBasket.position.copy(e.anchors.handR()).add(V3(-0.06, -0.35, 0));
        uncleBasket.quaternion.identity();
      }
    } else uncleBasket.visible = false;
    if (!morningOn && (elderOn || elder)) {
      const e = getElder();
      if (e.mode === 'morning' && e.night) { e.group.position.copy(e.night.p); e.group.quaternion.copy(e.night.q); e.group.scale.copy(e.night.s); e.stale = true; }
      e.mode = 'night';
      // speaking: he turns to the boy, then talks while the captions run; the hand lifts, holds, falls
      const es = { speak: smooth(83.2, 84.6, u) * 0.3 + band(85, 85.4, 91.2, 91.6, u) * 0.7, reach: smooth(84.6, 85.8, u), drop: handDrop(u), eyes: 1, reachTarget: UH.handSpot, wind: windV };
      driveHero(e, elderOn, dt, time, es, jumped);
      if (spirit) {
        const on = !inB && u > 91.95 && u < 100.5;
        spirit.group.visible = on;
        // (it stands over him while the camera backs out of the door, then goes up through the roof, to where the light hangs)
        spirit.update(time, on ? { k: smooth(92.2, 93.6, u), rise: 0.35 * smooth(93.6, 95.0, u) + 14.92 * smooth(95.2, 98.4, u), dissolve: smooth(96.6, 98.4, u) } : { k: 0, dissolve: 0 });
      }
    }
    // (where the light is, before anyone looks at it)
    soulAt(u, soulP);
    // the dog, before him: his hand goes to its head, his eyes to it; that night, by the old man
    bonds.updateDog(u, time, inB, dogNight);
    if (!inB) {
      P = valleyP(u);
      heading = valleyHeading(u, P);
      // (from how far he went this frame; across a cut, where the road jumps ahead under him, his stride goes on as it was)
      const moved = P.distanceTo(wPrev || P);
      speed = scrub ? Math.min(6, valleyP(u + 0.05).distanceTo(valleyP(u - 0.05)) / 0.1 * 0.6) : moved > 1.2 ? lastSpeed : Math.min(6, moved / dt);
      // (a jog down off the porch into the street, eager to be off; the run home; the rush to his uncle)
      run = Math.max(band(18.35, 18.8, 19.5, 19.95, u) * 0.45, band(65.5, 66.5, 78.6, 79.6, u), band(82.6, 82.8, 83.4, 83.6, u) * 0.7);
      kneel = Math.max(kneelK(u), bonds.kneel(u));
      reach = smooth(84.6, 85.8, u) * (1 - handDrop(u) * 0.6);
      // (in the morning his left hand goes to the basket's handle beside his uncle's)
      hs.reachL = band(15.72, 15.98, 16.2, 16.5, u);
      hs.reachLTarget = BASKET_TOP.clone().add(V3(-0.07, 0, 0));
      wVis = u < 96.2;
      // by the old pines he squats and picks one of the mushrooms he came for, stands and holds it up before his eyes;
      // then the sky turns, and he turns with it, the mushroom forgotten in his fist at his chest
      hs.crouch = band(43.75, 44.2, 44.95, 45.55, u);
      const pickK = band(43.95, 44.35, 44.85, 45.25, u);
      if (pickK > 0) { hs.reachTarget = mushPick; reach = Math.max(reach, pickK * (0.8 + 0.2 * Math.sin(time * 1.7) * (1 - smooth(44.7, 44.85, u)))); }
      else if (reach > 0 && elder) { elder.group.updateMatrixWorld(true); hs.reachTarget = elder.anchors.handR(); }
      const raiseK = band(44.9, 45.4, 47.8, 48.4, u);
      if (raiseK > 0) { hs.raise = raiseK; hs.raiseTarget = mushRaise(u, P, heading); }
      if (u > 44.82 && u < 48.4) hs.gripR = 'rod';
      hs.lookUp = band(45.8, 46.3, 47.9, 48.4, u);
      // the last words, then the hand drops
      hs.grief = Math.max(band(84.4, 85.4, 91.4, 92.4, u) * 0.3, handDrop(u) * (1 - 0.65 * smooth(92.7, 93.7, u)));
      hs.gripL = u < 65.6 ? 'hook' : null;
      // (the dog scratched behind the ears; the bun taken and given; bonds.js)
      if (u < 36) bonds.hero(u, time, hs);
      const lk = valleyLook(u, P);
      if (lk) { hs.lookAt = lk[0]; hs.lookW = lk[1]; }
      if (wuhen) { wuhen.setAge(0); wuhen.setFade(1); }
    } else {
      const w = B.wuhen(u);
      P = w.P; heading = w.heading; run = w.run; kneel = w.kneel || 0; draw = w.draw || 0; scale = w.scale; wVis = w.visible; lie = w.lie || 0;
      reach = w.reach || 0;
      const movedB = P.distanceTo(wPrev || P);
      speed = w.speed != null ? w.speed : scrub ? Math.min(7, B.wuhen(u + 0.05).P.distanceTo(B.wuhen(u - 0.05).P) / 0.1 * 0.45) : movedB > 1.2 ? lastSpeed : Math.min(7, movedB / dt);
      Object.assign(hs, { fall: w.fall || 0, getUp: w.getUp || 0, hold: w.hold || 0, holdWidth: w.holdWidth || 0, release: w.release || 0, gripL: w.gripL || null, gripR: w.gripR || null, sit: w.sit || 0, grief: w.grief || 0, crouch: w.crouch || 0, reachTarget: w.reachTarget || null,
        carve: w.carve || 0, carveTarget: w.carveTarget || null, carveMode: w.carveMode || null, braceTarget: w.braceTarget || null, palm: w.palm || 0, palmTarget: w.palmTarget || null, lookUp: w.lookUp || 0,
        measure: w.measure || 0, measureTarget: w.measureTarget || null, measureSlide: w.measureSlide || 0, pushup: w.pushup || 0, phase: w.phase ?? null, lean: w.lean || 0 });
      if (w.lookAt) { hs.lookAt = w.lookAt; hs.lookW = w.lookW ?? 1; }
      // (a wind of its own where something happens to him: the gust as the pillar of light strikes)
      if (w.wind) hs.wind = windV.clone().add(w.wind);
      getWuhen().setAge(w.age ?? 1);
      getWuhen().setFade(w.fade ?? 1);
    }
    lastZ = mcZ(u);
    metrics.P = P;
    // (where the boy's and his uncle's hands met, on the screen: the tear lands there)
    if (!inB && u > 91.3 && u < 92.7) { const hp = handsMeet(_hm).project(camera); metrics.tearUV = [hp.x * 0.5 + 0.5, hp.y * 0.5 + 0.5]; } else metrics.tearUV = null;
    const right = V3().crossVectors(heading, UP).normalize();
    wPrev = P.clone();
    lastSpeed = speed;
    // a warm rim from the fires behind him (real lights do most of the work)
    const facingFire = smooth(57, 61, u) * (u < 96 ? 1 : 0);
    // (and from the fire on the slope where the bolt came down, before him while the dark comes on)
    const rimAmt = inB ? (u > 124 && u < 131.5 ? 0.2 : 0) : Math.max(fireAmt * 0.45 * (0.3 + facingFire * 0.7), flash * 0.4, 0.42 * band(54.45, 54.75, 57.9, 58.8, u));
    // (by firelight the silver hair's highlights are held down: a hot white highlight would be drawn as flame in ink)
    const kk = 1 - 0.75 * smooth(56, 60, u) * (inB ? 0 : 1);
    held.visible = !inB && u >= 16.16 && u < 65.6;
    heldCaps.visible = u > 48.4;
    // (the last colour in the world, the basket and what is in it: lit a little from within while it is, so it reads as
    // colour, not as the shadow of a basket against the fire)
    const lastK = inB ? 0 : band(62.9, 63.5, 65.5, 65.64, u);
    basketMat.emissive.setRGB(0.3, 0.19, 0.08).multiplyScalar(lastK);
    capMat.emissive.setRGB(0.42, 0.16, 0.05).multiplyScalar(lastK);
    pawPrints.visible = !inB && u > 61.6 && u < 108.3;
    // the bell: a slow swing by itself while the village burns, a toll at one end of each (every 4.2 s of the story's
    // clock); where it is seen, each toll an ink ripple out across the page from it
    {
      const bk = inB ? 0 : smooth(61.0, 62.5, u) * (1 - smooth(76.5, 78, u));
      const ph = time * (2 * Math.PI / 4.2);
      gateBell.rotation.z = 0.34 * bk * Math.sin(ph);
      const n = Math.floor((ph - Math.PI / 2) / (2 * Math.PI));
      if (n !== bellN) {
        if (bellN !== null && bk > 0.5) {
          metrics.bellToll = (metrics.bellToll || 0) + 1;
          const sp = gateBell.localToWorld(V3(0, -0.5, 0)).project(camera);
          if (sp.z < 1 && Math.abs(sp.x) < 1.15 && Math.abs(sp.y) < 1.15) ripples.push({ x: sp.x * 0.5 + 0.5, y: sp.y * 0.5 + 0.5, t: time });
        }
        bellN = n;
      }
      while (ripples.length && (time - ripples[0].t > 2.4 || time < ripples[0].t)) ripples.shift();
      metrics.ripples = ripples.map(r => [r.x, r.y, (time - r.t) / 2.4]);
    }
    // (the one he picked: in his fist from the moment his fingers close on it, turned in them as he looks at it, into
    // the basket once the eye has left him)
    heldMush.visible = !inB && u > 44.82 && u < 48.4;
    heldMush.rotation.set(0, 1.4 * smooth(45.4, 46.0, u), 0);
    dropped.visible = !inB && u >= 65.6;
    if (dropped.visible) dropBasket(u);

    // ------------------------------------------------------------ camera: over his shoulder, then the story's shots
    const portrait = smooth(1.1, 0.55, camera.aspect);
    const indoor = smooth(80.4, 81.4, u) * (1 - smooth(93.6, 94.2, u));
    let dist = lerp(1.62, 2.15, run) + portrait * 0.75, side = lerp(lerp(0.5, 0.42, run), 0.12, portrait), height = lerp(1.74, 1.6, run) + portrait * 0.12;
    dist = lerp(dist, lerp(1.45, 1.22, kneel) + portrait * 0.4, indoor);
    side = lerp(side, lerp(0.42, 0.52, kneel), indoor);
    height = lerp(height, lerp(1.62, 1.16, kneel), indoor);
    if (inB) { dist *= scale; height *= scale; }
    // (down the street to the gate in the morning: one long-lens take from farther back, the street stacking up beyond
    // him, him a third of the frame: earth is long-lens; the lens opens only at the launch)
    // (and the run home down the same street, the morning rewound: on the same long lens from the gate, the burning
    // street stacking up beyond him, until the house)
    const lng = inB ? 0 : Math.max(band(19.45, 20.7, 34.8, 35.75, u) * (1 - 0.6 * band(25.35, 26.15, 27.35, 28.05, u)), band(72.5, 72.505, 76.6, 77.6, u));
    if (lng > 0) { dist = lerp(dist, 5.2 + portrait * 1.2, lng); side = lerp(side, 0.62 * (1 - 0.6 * portrait), lng); height = lerp(height, 1.6, lng); }
    let pos = P.clone().addScaledVector(heading, -dist).addScaledVector(right, side).add(V3(0, height, 0));
    let look = P.clone().addScaledVector(heading, lerp(9, 16, lng)).add(V3(0, lerp(lerp(1.42, 1.25, run), 1.32, lng), 0)).addScaledVector(right, -0.4 * (1 - portrait) * (1 - lng));
    if (!inB) {
      const greet = (who, a, b, c, d, w = 0.35) => { const k2 = band(a, b, c, d, u) * w; if (k2 > 0 && who) look.lerp(who.clone().add(V3(0, 1.3, 0)), k2); };
      greet(world.cast.kids[0].root.position, 22.6, 23.6, 24.4, 25.4, 0.25);
      // the smith's stall: his eyes go to the weapons; the camera comes round close behind his shoulder to see them
      // with him: the sword on its stand, the wall of blades behind it
      const sk = band(25.35, 25.3501, 27.35, 28.05, u);
      if (sk > 0 && A.stall) {
        const toS = (legend || A.stall).clone().sub(P).setY(0).normalize();
        const camS = P.clone().addScaledVector(toS, -0.95).add(V3(-toS.z, 0, toS.x).multiplyScalar(0.72)).add(V3(0, 1.52, 0));
        pos.lerp(camS, sk * 0.95);
        const lk = (legend || A.stall).clone().add(V3(0, -0.05, 0));
        if (A.stallWall) lk.lerp(A.stallWall, 0.32);
        look.lerp(lk, sk);
      }
      // at the door his eyes go down first, to the prints over the sill and in (then the cut to the room, REVERSE)
      const thr = band(80.3, 80.75, 80.9, 81.0, u);
      if (thr > 0) look.lerp(L(0.5, 0.05, 3.7), thr * 0.85);
      look.lerp(UH.uncleSpot.clone().add(V3(0, 0.15, 0)), smooth(81.6, 83.4, u) * indoor);
      // kneeling beside him: three-quarters from behind his right shoulder, drifting closer as he speaks
      const kw = smooth(83.0, 84.6, u) * indoor;
      if (kw > 0) {
        const push = smooth(84.6, 92.2, u);
        // (in after him past the swung-open leaf of the door, never through it: straight in behind him until past its
        // edge, then round to his right as he drops to his knees; then the slow push while his uncle speaks)
        if (u < 85.0) {
          if (!roomIn) { const r = [[82.85, L(0.47, 1.62, 4.55)], [83.25, L(0.55, 1.62, 3.7)], [83.8, L(0.6, 1.66, 3.45)], [84.3, L(0.85, 1.78, 2.85)], [84.65, L(1.9, 1.72, 2.95)], [85.0, L(2.85, 1.66, 3.55)]]; roomIn = { c: new THREE.CatmullRomCurve3(r.map(x => x[1]), false, 'centripetal') }; const lens = roomIn.c.getLengths(r.length * 40); roomIn.k = monoKeys(r.map((x, j) => [x[0], lens[j * 40] / lens[(r.length - 1) * 40]])); }
          pos.lerp(roomIn.c.getPointAt(clamp(roomIn.k(u))), smooth(82.85, 83.1, u) * indoor);
          look.lerp(L(lerp(0.2, 0.5, push), lerp(0.42, 0.26, push), lerp(1.3, 1.1, push)), kw);
        } else {
          // the last words: one locked setup low by his uncle's head, his face the size it was at his door that
          // morning, lit by the fire; the boy is only his hands, holding the old man's; pushing in, slowly
          const lw = smooth(84.6, 85.0, u) > 0 ? 1 : 0;
          const ws = smooth(85.0, 92.1, u);
          // (beside the boy's head, over his right shoulder, down onto the old man's face turned up to him, their
          // hands between)
          pos.lerp(V3(lerp(9.42, 9.52, ws), lerp(1.98, 1.9, ws), lerp(44.92, 44.8, ws)), kw * lw);
          look.lerp(V3(lerp(9.92, 9.95, ws), lerp(1.37, 1.35, ws), 44.37), kw * lw);
        }
      }
    }
    // reveal: after the turn the eye falls on the burning village below
    look.lerp(V3(0, 4, 30), band(58.5, 61.5, 65.4, 66.4, u) * 0.85);
    // (no dolly zoom: held still on a long lens from farther back while the ink climbs the world toward him, until the
    // only colour left is in the basket in his hand)
    const zoomK = 0, holdK = inB ? 0 : band(59.6, 60.8, 63.4, 63.9, u);
    if (holdK > 0) pos.addScaledVector(heading, -2.8 * holdK).add(V3(0, 0.3 * holdK, 0));
    // the opening: aerial, then the crane down
    const aw = cam.aerial(u);
    if (aw > 0) { const t = clamp(u / 13.6); pos.lerp(along(aerialPos, t), aw); look.lerp(along(aerialLook, t), aw); }
    // the morning at his uncle's door
    const mnw = inB ? 0 : cam.morning(u);
    const mShot = mnw > 0 ? morningShot(u) : null;
    if (mShot) { pos.lerp(mShot.pos, mnw); look.lerp(mShot.look, mnw); }
    // the old road: low behind him off his left shoulder, the fields opening out on the left; as he steps up onto the
    // bridge the lens swings round behind him and rises outside its right-hand parapet, above the water, and looks
    // back over his shoulder upstream: the river valley, the mill, the hills beyond the crown; off the bridge it
    // settles behind him again for the pines
    const mw = cam.montage(u);
    if (mw > 0) {
      const R = ROAD_SHOT;
      const cp = P.clone().addScaledVector(heading, -R.back(u)).addScaledVector(right, R.side(u)).add(V3(0, R.up(u), 0));
      const lk = P.clone().addScaledVector(heading, R.fwd(u)).addScaledVector(right, -R.left(u)).add(V3(0, R.lookUp(u), 0));
      pos.lerp(cp, mw); look.lerp(lk, mw);
    }
    const muw = cam.mushroom(u);
    if (muw > 0) {
      const ms = mushShot(u, portrait);
      pos.lerp(ms.pos, muw);
      look.lerp(ms.look, muw);
    }
    // the storm, from the silence in the pines to the dark running over the land: one continuous camera
    const stw = inB ? 0 : band(47.4, 47.5, 57.8, 58.9, u);
    let stormFov = 50, stormRoll = 0;
    if (stw > 0) {
      const st = flightShot(u, portrait, time);
      pos.lerp(st.pos, stw);
      look.lerp(st.look, stw);
      stormFov = st.fov;
      stormRoll = st.roll * stw;
    }
    // before he runs: never his face. Low at his left side, his hand with the basket hooked on its fingers, the burning
    // village beyond; the fingers open, and the eye goes down with the basket to the ground as the caps spill; he runs
    const fcw = cam.face(u);
    if (fcw > 0) {
      // (where he stands as his fingers open: the camera stays there with the basket as he runs)
      const D = getDrop(), P0 = D.P0, h0 = D.h0, r0 = D.r0;
      const dk = smooth(65.58, 65.8, u), gk = smooth(65.95, 66.45, u);
      const cp = P0.clone().addScaledVector(r0, -lerp(0.92, 1.0, dk) * (1 - 0.5 * portrait)).addScaledVector(h0, -lerp(1.2, 1.6, dk) - 0.9 * portrait).add(V3(0, lerp(0.95, 0.78, dk) + 0.4 * gk + 0.25 * portrait, 0));
      const lp = P0.clone().addScaledVector(r0, -0.1).addScaledVector(h0, 2.7).add(V3(0, 0.52, 0)).lerp(D.land.clone().addScaledVector(h0, 0.35).add(V3(0, 0.12, 0)), dk);
      // (then he is gone from beside it, running: the eye lifts from the basket after him, toward the fire)
      lp.lerp(P.clone().addScaledVector(h0, 7).add(V3(0, 1.1, 0)), gk);
      // (blend the look as a direction, so the far village and the near hand turn into each other evenly)
      const d0 = look.clone().sub(pos), L0 = d0.length(), d1 = lp.clone().sub(cp), L1 = d1.length();
      pos.lerp(cp, fcw);
      look.copy(pos).addScaledVector(slerpDir(d0.normalize(), d1.normalize(), fcw), lerp(L0, L1, fcw));
    }
    // "Cinderfall was burning.": cut from behind him to what he sees, the moment the ink falls on the world: the village
    // below on a long lens, its roofs and its gate black against the fire, the smoke going up into the paper of the sky,
    // as the ink climbs out of it over everything; held, pushing in a little; then cut back to him (the face shot), the
    // basket in his hand the last colour left
    const burnIn = !inB && u > BURN_IN[0] && u < BURN_IN[1];
    if (burnIn) {
      const t = smooth(BURN_IN[0], BURN_IN[1], u);
      pos.copy(debug.burn ? V3(...debug.burn.pos) : BURN.pos).lerp(debug.burn ? V3(...debug.burn.pos2) : BURN.pos2, t);
      look.copy(debug.burn ? V3(...debug.burn.look) : BURN.look);
    }
    // the morning's bonds, each a take of its own (bonds.js): the dog at the foot of the steps; the bun; the dog in his
    // way at the gate, and watching him go. And the run home is the morning rewound: at the gate the lens is low where
    // the dog sat that morning, looking out the way it watched him go; now he comes at it out of the dark through the
    // burning gate, and a wolf stands there, snarling as he goes by (cut in; cut to behind him as he reaches the lens)
    const bs = inB ? null : bonds.shot(u, time);
    if (bs) { pos.copy(bs.pos); look.copy(bs.look); }
    // (cut in on the wolf waiting inside the gate, from where he is running at it: its head, snarling, the violet eyes,
    // the crimson breath at its fangs; held as he goes by it, then cut to behind him in the street)
    const wolfIn = !inB && u > WOLF_IN[0] && u < WOLF_IN[1] && world.wolves[2] && world.wolves[2].root.visible;
    if (wolfIn) {
      const w2 = world.wolves[2];
      w2.root.updateMatrixWorld(true);
      const hp = w2.head.localToWorld(_wh.set(0, 0.06, 0.1));
      const toHim = P.clone().sub(hp).setY(0).normalize(), l = V3(toHim.z, 0, -toHim.x);
      const t = smooth(WOLF_IN[0], WOLF_IN[1], u);
      pos.copy(hp).addScaledVector(toHim, 1.2 - 0.12 * t).addScaledVector(l, 0.32).add(V3(0, 0.06, 0));
      look.copy(hp).addScaledVector(toHim, 0.06).add(V3(0, -0.02, 0));
    }
    // the smith's stall: cut in close on the one blade that burns brightest, while the world is ink and only the blades'
    // light is gold (his eyes on it; the line on it)
    if (!inB && legend && u > SMITH_IN[0] && u < SMITH_IN[1]) {
      const t = smooth(SMITH_IN[0], SMITH_IN[1], u), toS = legend.clone().sub(P).setY(0).normalize(), sd = V3(-toS.z, 0, toS.x);
      const along = legendAura.dir.clone().normalize();
      pos.copy(legend).addScaledVector(along, 0.05 - 0.08 * t).addScaledVector(toS, -1.05 + 0.1 * t).addScaledVector(sd, 0.2).add(V3(0, 0.1, 0));
      look.copy(legend).addScaledVector(along, 0.02 - 0.06 * t);
    }
    // the room, cut to from the prints: low beside his uncle's head, looking out at the door: the old man pinned under
    // the beam in front, the boy black in the doorway against the burning street (the held moment on it; the ink draws
    // him black, not drawn: uFigSil); he comes in, sees him, the colour comes back into the room, and he runs to him and
    // drops to his knees beside him; cut back behind him as he kneels
    if (!inB && u > REVERSE[0] && u < REVERSE[1]) {
      const t = smooth(REVERSE[0], REVERSE[1], u), rk = smooth(82.65, 83.45, u), dn = smooth(82.3, 82.95, u);
      // (on the line from the door through the old man's head, a little beyond it: his head at the foot of the frame,
      // the door above it; easing in toward him. As the boy comes in the lens tips down with him to the old man: his
      // legs come to him, never his face, which the colour coming back would show)
      pos.copy(L(0.58, 0.81, 0.06)).lerp(L(0.56, 0.77, 0.36), t);
      look.copy(L(0.0, lerp(0.2, -0.75, dn), 4.55)).lerp(L(0.3, -0.25, 2.3), rk);
    }
    // the hand falls: cut in on the same line, close on their hands as the old man's slips out of the boy's, and the
    // tear falls onto them in the frozen moment; then the rise
    if (!inB && u > HANDS_IN[0] && u < HANDS_IN[1]) {
      const t = smooth(HANDS_IN[0], HANDS_IN[1], u), hs = handsMeet(_hm2);
      pos.copy(hs).add(V3(0.04, 0.3 - 0.03 * t, 0.46 - 0.05 * t));
      look.copy(hs).add(V3(0.0, -0.03, 0.0));
    }
    // "Forget this place. Forget me.": cut to the place, high over them: the beam across him, the boy on his knees beside
    // him, their hands, the room fallen in round them; cut back in on his face for the last line
    const wordsWide = !inB && u > WORDS_WIDE[0] && u < WORDS_WIDE[1];
    if (wordsWide) {
      const t = smooth(WORDS_WIDE[0], WORDS_WIDE[1], u);
      pos.set(lerp(8.4, 8.52, t), lerp(3.6, 3.48, t), lerp(41.6, 41.78, t));
      look.set(10.1, 1.4, 44.0);
    }
    // the soul: where the light that left him is (a pure function of u)
    soulAt(u, soulP);
    const sw = cam.soul(u);
    // after he dies (see getChoreo): the rise, the light over the roofs, the crag, after the light to the boy
    const rw = cam.rise(u);
    const runner = runnerAt(u, _run0);
    if (rw > 0 && !inB) {
      const C = getChoreo();
      // the eye: on his uncle, up with the light as it leaves him, then where the light looks (the crag)
      // (on the soul's heart while it sits up and stands, then a little above it as it goes, so it leads the eye up
      // through the hole; once over the roofs, where it looks: the crag)
      // (a little below its heart while it stands over him, so he stays in the frame; a little above it as it goes up)
      const lkA = UH.uncleSpot.clone().add(V3(0, 0.1, 0)).lerp(soulP.clone().add(V3(0, -0.22 * band(92.6, 93.4, 95.0, 95.5, u) + 0.6 * smooth(95.4, 96.2, u), 0)), smooth(92.5, 93.6, u)).lerp(soulP.clone().lerp(C.cragFocus, debug.cragLook ?? 0.82), smooth(97.8, 98.9, u));
      // (while the porch roof hides it, the eye goes up the roof to the hole it will come out of)
      lkA.lerp(C.emerge, band(95.2, 95.5, 95.85, 96.2, u));
      const sectFocus = sect.center.clone().add(V3(-0.6, 0.55, 0)).lerp(sect.center.clone().add(V3(-1, 1.4, 0.2)), smooth(100.4, 102.6, u));
      let cp, lk;
      if (u < 98.9) {
        // back past his shoulder and out of the house, up in front of it after the light, round behind it
        cp = C.ride.getPointAt(clamp(C.rideK(u))); lk = lkA;
      } else if (u < 102.1) {
        cp = spline(C.pushPath, smooth(98.9, 101.6, u)).addScaledVector(C.drift, smooth(101.6, 102.1, u));
        lk = sectFocus.clone();
      } else if (u < 103.75) {
        // the light goes and their masks turn after it: round them to their backs with the leader held in the frame,
        // then (an even turn, never a whip) past him to the burning village and the light going west above it
        cp = C.orbit.getPointAt(smooth(102.1, 103.75, u));
        lk = turnTo3(cp, sectFocus.lerp(C.leader, smooth(102.1, 102.7, u)), soulP, 0.5 * smooth(103.15, 103.9, u));
      } else {
        // up over the banners and off the crag after it, over the village, down to him running beneath it
        cp = spline(C.leavePath, smooth(103.75, 105.45, u));
        // (from the way the eye looked as it left them, evenly round to the light: no near point to swing past)
        if (!C.leaveDir) { const o4 = C.orbit.getPointAt(1); C.leaveDir = turnTo3(o4, C.leader, soulAt(103.75, V3()), 0.5 * smooth(103.15, 103.9, 103.75)).sub(o4).normalize(); }
        lk = turnTo3(cp, cp.clone().add(C.leaveDir), soulP, smooth(103.75, 104.6, u));
        const ahead = RUN_AHEAD, rgt = V3(-ahead.z, 0, ahead.x);
        // (down out of the sky behind him as the light comes down ahead of him; then running with him, low and close
        // behind his right shoulder, his hair and sash streaming, the light he runs after a little above him, ahead,
        // lighting his way; as it goes up and away into the white the lens lifts after it)
        const tk = smooth(105.4, 106.05, u), up = smooth(106.05, 106.45, u);
        const chase = runner.clone().addScaledVector(ahead, -lerp(3.6, 2.7, tk) - 1.1 * portrait).addScaledVector(rgt, lerp(1.0, 0.72, tk) * (1 - 0.7 * portrait))
          .add(V3(0, lerp(1.45, 1.22, tk) + 0.25 * up + 0.25 * portrait, 0));
        // (a runner's lens: it bobs and sways with the stride)
        chase.add(V3(Math.sin(time * 9.4) * 0.035, Math.abs(Math.sin(time * 4.7)) * 0.05, Math.sin(time * 6.1 + 1) * 0.03).multiplyScalar(tk));
        chase.y = Math.max(chase.y, heightAt(chase.x, chase.z) + 0.8);
        const ck = smooth(105.0, 105.5, u);
        cp.lerp(chase, ck);
        // (the eye between the way ahead and the light, turned as directions: a light far off never drags it up off him)
        const dA = runner.clone().addScaledVector(ahead, 16).add(V3(0, 2.3, 0)).sub(chase).normalize(), dS = soulP.clone().sub(chase).normalize();
        const ahd = chase.clone().addScaledVector(slerpDir(dA, dS, lerp(0.3, 0.38, up)), 20);
        lk.lerp(ahd, ck);
        // (as the light goes up from him the lens lets him go: it falls back and sinks to the grass, looking up after
        // it as it climbs the sky and goes over the ridge; he runs on up the slope onto the skyline, small against the
        // night, and stops there as the sky beyond the ridge takes fire)
        const fb = smooth(106.1, 106.95, u);
        if (fb > 0) {
          const R0 = runnerAt(106.1, _cr0), back = craneBack(u);
          const fp = R0.addScaledVector(ahead, -back).addScaledVector(rgt, lerp(0.72, 1.7, fb) * (1 - 0.6 * portrait));
          fp.y = heightAt(fp.x, fp.z) + lerp(1.35, 1.5, smooth(106.1, 106.8, u)) + 0.35 * portrait;
          const cpF = chase.clone().lerp(fp, fb);
          // the eye: up after the light, then settled on the ridge where it went down, him on the skyline below it
          const frame = runnerAt(107.6, _cr1).addScaledVector(ahead, 6).add(V3(0, 2.2, 0));
          const dF = frame.sub(cpF).normalize(), dL = CROSS_L.clone().sub(cpF).normalize();
          const dRest = slerpDir(dF, dL, 0.42 + 0.06 * portrait);
          dRest.y += 0.075;
          dRest.normalize();
          const dC = soulP.clone().sub(cpF).normalize();
          const follow = band(106.15, 106.5, 106.95, 107.3, u) * 0.55;
          const dLook = slerpDir(slerpDir(ahd.clone().sub(chase).normalize(), dRest, smooth(106.1, 106.9, u)), dC, follow);
          cp.copy(cpF);
          lk.copy(cpF).addScaledVector(dLook, 30);
        }
      }
      pos.lerp(cp, rw);
      look.lerp(lk, rw);
    }
    const gw = 0, fw = 0;
    const bShot = inB ? B.shots(u, pos, look, { P, heading, right, portrait, time }) : null;
    // held moments: while the story waits the camera keeps drifting in, slowly
    const pz = pauseAt(u);
    if (pz.i >= 0 && pz.w > 0) { const d = pos.distanceTo(look); pos.lerp(look, Math.min(d * PUSH[pz.i], 1.4) / Math.max(d, 1e-3) * pz.w); }
    const shk = cam.shake(u) + (inB ? 0 : impactFlash * 0.22 + hitFlash * 0.28);
    pos.add(shake(time, shk));
    look.add(shake(time * 0.8 + 3, shk * 1.6));
    if (debug.cam) { pos.set(...debug.cam.pos); look.set(...debug.cam.look); }
    camera.position.copy(pos);
    camera.lookAt(look);
    if (stormRoll && !debug.cam) camera.rotateZ(stormRoll);
    // (on a phone the rise keeps a little of its width while it is still in the room, so the light fits the frame)
    // (the forest's shots may keep their own focal lengths)
    const fov0 = wordsWide ? 48 : burnIn ? lerp(...(debug.burn ? debug.burn.fov : BURN.fov), smooth(BURN_IN[0], BURN_IN[1], u)) : bShot && bShot.fovW > 0 ? lerp(cam.fov(u), bShot.fov, bShot.fovW) : wolfIn ? 44 : bs ? bs.fov : mShot ? lerp(cam.fov(u), mShot.fov, mnw) : cam.fov(u);
    camera.fov = lerp(fov0, stormFov, stw) + portrait * 12 * (1 - zoomK) * (1 - rw * (1 - 0.7 * band(92.0, 92.6, 94.8, 95.6, u))) * (1 - gw) + portrait * 14 * fcw;
    // (at the stall the lens narrows on the weapons)
    if (!inB) camera.fov = lerp(camera.fov, 33 + portrait * 10, band(25.45, 26.25, 27.3, 28.0, u) * 0.85);
    if (debug.fov) camera.fov = debug.fov;
    // up among the clouds: the eye sees farther, the ground far below is drawn with the sky, the clouds lie over the world
    const alt = inB ? 0 : camera.position.y;
    camera.far = 3400 + 2200 * smooth(300, 1600, alt);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    S.uGroundK.value = smooth(380, 900, alt);
    S.uFocus.value = camera.position.distanceTo(_dc);
    // the gathering: the deck forms out from under the fight, winding round the eye it leaves open under it (the eye
    // goes up through it, and it closes behind it)
    S.uSeaK.value = inB ? 0 : band(45.9, 47.0, 53.05, 53.4, u);
    S.uDive.value = inB ? 0 : band(52.95, 53.08, 53.8, 53.94, u);
    S.uHole.value.set(EYE.x, EYE.z, smooth(45.8, 46.6, u) * (1 - smooth(49.05, 49.75, u)), 1.0);
    // (the war's arena: open sea under it, no tower of cloud rising into the fight)
    S.uArena.value.set(WAR_C.x, WAR_C.z, 2900, 1);
    // (the sheets across the well: there while the eye goes up it, gone once it is out over the sea)
    // (they form across it as the eye rushes up toward its mouth)
    S.uBands.value.set(inB ? 0 : band(47.72, 47.96, 48.62, 48.8, u), SHEETS[0][1], SHEETS[1][1], SHEETS[2][1]);
    S.uBandT.value.set(SHEETS[0][2], SHEETS[1][2], SHEETS[2][2], 0);
    // the war's first sight: a shadow play on the screen above the lens as it slows under it (puppets.js). The gold one
    // leaps in, the masked one winds up its glaive and brings it down on his sword; the flare where they meet; he is
    // driven back; and the lens bursts up through them all.
    {
      if (!STAGE) {
        const sh = flightShot(48.15, 0, 0), dir = sh.look.clone().sub(sh.pos).normalize();
        const t = (SHEETS[0][1] - 35 - sh.pos.y) / Math.max(dir.y, 0.2);
        // (looking up at it, the top of the frame is the ceiling behind the way the lens faces; its right is the lens's)
        const f = V3(dir.x, 0, dir.z).normalize();
        STAGE = { c: sh.pos.clone().addScaledVector(dir, t), up: f.clone().negate(), r: V3().crossVectors(f, UP).normalize() };
      }
      // (no longer: the light of the fight itself glares through the screen, flaring with each blow)
      const on = 0;
      S.uStage.value.set(STAGE.c.x, STAGE.c.z, 82, on);
      S.uStageR.value.set(STAGE.r.x, STAGE.r.z, STAGE.up.x, STAGE.up.z);
      if (on > 0) {
        const a = smooth(48.08, 48.13, u), wind = smooth(48.1, 48.142, u), sw = smooth(48.143, 48.155, u), rec = smooth(48.156, 48.195, u);
        // (gold, from the left: leaping in, leaning into it, the sword up to take the blow; then driven back)
        const g = [lerp(-0.9, -0.36, a) - 0.3 * rec, lerp(-0.62, -0.5, a) + 0.1 * Math.sin(a * Math.PI) - 0.04 * rec, lerp(-0.3, -0.12, a) + 0.32 * rec, lerp(0.15, 1.05, smooth(48.12, 48.15, u)) - 0.5 * rec];
        // (the masked one, from the right: the glaive wound up behind, brought down over the top; then pressing on)
        const m = [lerp(0.9, 0.36, a) - 0.05 * sw - 0.08 * rec, -0.5, lerp(0.18, 0.06, a) - 0.22 * sw + 0.08 * rec, lerp(-0.3, -2.4, wind) + 1.7 * sw + 0.5 * rec];
        S.uPup0.value.set(...g);
        S.uPup1.value.set(...m);
        // (the flare where they meet, at the glaive's blade, fired as the story crosses it)
        const age = cueAge(48.155, u, time);
        const rot = (x, y, ang) => [x * Math.cos(ang) - y * Math.sin(ang), x * Math.sin(ang) + y * Math.cos(ang)];
        const [ax, ay] = rot(-0.5, 0.05, m[3]), [bx, by] = rot(-0.02 + ax, 0.76 + ay, m[2]);
        S.uPupFx.value.set(m[0] + bx, m[1] + by, age < 1.5 ? 1.6 * Math.exp(-age * 5) : 0, 0);
      }
    }
    // (and while the eye climbs the well its walls are calmer, so it can fly close along them)
    const wk = inB ? 0 : band(47.6, 47.85, 48.55, 49.3, u);
    S.uWell.value.x = lerp(1, 0.35, wk);
    S.uWell.value.y = wk;
    S.uWell.value.z = inB ? 0 : band(47.7, 47.95, 48.47, 48.62, u);
    S.uVort.value.set(EYE.x, EYE.z, 4.6 * smooth(45.5, 48.7, u), smooth(46.2, 48.5, u));
    S.uClashFar.value = lerp(0.15, 1, smooth(48.3, 49.0, u));
    post.ink.uCloudK.value = smooth(140, 420, alt);
    post.ink.tCloudL.value = sky.rt.textures[1];
    post.ink.tCloudD.value = sky.rt.textures[2];
    // (the painted ranges are a backdrop for eyes on the ground; up over the sea of clouds the land is hidden by it)
    for (const l of mountains.layers) l.visible = alt < 450;
    if (!inB) mountains.group.visible = alt < 2000;
    // (nor the valley itself: from up there its edges would show; the sky draws the land below)
    if (!inB && alt >= 2000) world.root.visible = false;
    // (the valley's mist sheets are for eyes on the ground: from above they would show as cards)
    mist.material.uniforms.uAlpha.value *= 1 - smooth(25, 70, alt);
    // nobody's head fills the lens: hide him only when the camera is right at his head
    const headAt = wuhen && wuhen.group.visible ? wuhen.anchors.head() : P.clone().add(V3(0, 1.55, 0));
    const camToMC = camera.position.distanceTo(headAt) + 0.3;
    const fromAbove = rw > 0.5 && u > 96.2;
    // (at the end the lens goes past his eyes into the page in his hands: he stays, so the scroll stays in them)
    const wShow = wVis && !debug.noHero && aw < 0.995 && (camToMC > 0.75 || (inB && u > 138.9) || (inB && B.allowNear && B.allowNear(u))) && !fromAbove;
    metrics.step = null;
    if (wShow || wuhen) {
      const h = getWuhen();
      h.group.position.copy(P);
      h.group.rotation.y = Math.atan2(heading.x, heading.z);
      if (inB) h.uniforms.uRim.value.set(1, 0.62, 0.3, rimAmt * (debug.rim ?? 1)); else h.uniforms.uRim.value.set(1, 0.4, 0.15, rimAmt * (debug.rim ?? 1));
      // (at night, in colour, his hair takes more of the sky's light, so it stays silver: before the ink takes the world,
      // and in the fields after the light)
      h.uniforms.uHairAmb.value = debug.hairAmb ?? (inB ? 1 : 1 + 2.1 * Math.max(band(55.4, 56.6, 61.5, 61.6, u), band(104.4, 105.2, 107.6, 108.0, u)));
      h.uniforms.uKK.value.x = 0.34 * kk; h.uniforms.uKK.value.z = 0.32 * kk;
      if (!inB) h.setAge(0);
      driveHero(h, wShow, dt, time, { speed, wave, run, kneel, reach, draw, lie, ...hs }, jumped);
      if (!inB) bonds.updateBun(u, h.group.visible ? h.anchors.handR() : null);
      // (his gait, for his footsteps: the left heel strikes at phase 0, the right at 0.5; near: how close the lens is to
      // where he is this frame — his head's anchor is still where the last frame left it, a world away on a cut)
      if (h.group.visible && h.state.lastState) metrics.step = { phase: h.state.phase, speed: Math.max(0, h.state.lastState.speed || 0), run: h.state.lastState.run || 0, near: clamp(1 - (camera.position.distanceTo(P) - 3) / 30) };
      if (held.visible && h.group.visible) {
        hangBasket();
        // (where it hangs as his fingers are about to open: the basket falls from there)
        if (u > 65.3) { held.getWorldPosition(dropStart); dropStartOK = true; }
      }
    }
    // seen from far: kneeling as the camera rises, then a small figure fleeing for the trees (a second hero)
    const kneelingFar = !inB && fromAbove && u < 99.3;
    const fleeing = !inB && u >= 99.3 && u < 107.9;
    if (kneelingFar || fleeing || far) {
      const f = getFar();
      if (kneelingFar) {
        f.group.position.copy(UH.kneelSpot).setY(UH.frame.plat);
        const toU = UH.uncleSpot.clone().sub(UH.kneelSpot);
        f.group.rotation.y = Math.atan2(toU.x, toU.z);
      } else if (fleeing) {
        // (the way he runs; as he stops, toward the light beyond the ridge)
        const nxt = runnerAt(Math.min(u, 107.3) + 0.04, _run1).sub(runnerAt(Math.min(u, 107.3), _cr1)).setY(0).normalize();
        const hd = turnTo(nxt, CROSS_L.clone().sub(runner).setY(0).normalize(), smooth(107.3, 107.7, u));
        f.group.position.copy(runner);
        f.group.rotation.y = Math.atan2(hd.x, hd.z);
      }
      // (the double takes the same pose he had: kneeling, his hand still on his uncle's, his eyes on the light)
      if (kneelingFar && elder) elder.group.updateMatrixWorld(true);
      const kneelS = { kneel: 1, grief: 0.35, lookAt: soulP, lookW: 1, reach: 0.4, reachTarget: elder ? elder.anchors.handR() : null, wind: windV };
      // (running after the light: the red of the fires behind him on his back and his hair, the light ahead on the rest;
      // when the sky beyond the ridge takes fire, its gold all round his edges)
      const xf = fleeing ? crossFlash(u) : 0;
      if (xf > 0.02) f.uniforms.uRim.value.set(1, 0.74, 0.4, 1.6 * xf);
      else f.uniforms.uRim.value.set(1, 0.42, 0.16, fleeing ? 0.9 * band(104.9, 105.3, 106.4, 106.9, u) : 0);
      // (as the light goes up and away from him, his hand goes up after it as he runs; he runs on, slows on the slope,
      // and stops, his hand up against the light)
      const after = fleeing ? band(105.95, 106.2, 106.55, 106.8, u) : 0;
      const halt = fleeing ? smooth(107.28, 107.7, u) : 0, shield = fleeing ? smooth(107.42, 107.62, u) : 0;
      const runS = { speed: 4.6 * (1 - halt), run: 1 - smooth(107.3, 107.66, u), wind: windV };
      if (after > 0) { runS.reach = after * 0.9; runS.reachTarget = runner.clone().add(V3(0, 1.45, 0)).addScaledVector(soulP.clone().sub(runner).normalize(), 0.75); runS.lookAt = soulP; runS.lookW = after; }
      if (shield > 0) {
        const toL = CROSS_L.clone().sub(runner).setY(0).normalize();
        runS.reach = shield * 0.85; runS.reachTarget = runner.clone().add(V3(0, 1.62, 0)).addScaledVector(toL, 0.55);
        runS.lookAt = CROSS_L; runS.lookW = shield;
      }
      driveHero(f, kneelingFar || fleeing, dt, time, kneelingFar ? kneelS : runS, jumped);
    }
    // his ghosts at the camp through the years (world B)
    if (ghosts.length) {
      const gs = inB && B.ghosts ? B.ghosts(u) : [];
      ghosts.forEach((g, i) => {
        const d = gs.find(x => x.i % 2 === i);
        if (!d) { driveHero(g, false); return; }
        g.group.position.copy(d.P);
        g.group.rotation.y = Math.atan2(d.heading.x, d.heading.z);
        g.setAge(d.age);
        g.setFade(d.fade);
        driveHero(g, true, dt, time, ghostState(d), jumped || g.slot !== d.i);
        g.slot = d.i;
      });
    }

    // shadows follow the action (wider for the wide shots)
    const wide = Math.max(aw, rw * smooth(94, 96, u), gw, fw);
    const ext = lerp(46, 130, wide);
    if (Math.abs(sc.right - ext) > 0.5) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
    const focus = aw > 0.5 ? V3(0, 0, 40) : wide > 0.5 ? look.clone() : P.clone();
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sd, 200);
    sun.target.updateMatrixWorld();

    // ------------------------------------------------------------ the valley's people, the uncle, the crag
    if (!inB) animateCast(u, time, broken, P);
    // (they stay, watching, as the light goes: no more coming apart into ink in front of the lens)
    sect.update(u, time, inB ? 0 : band(96.5, 98.2, 104.6, 105.4, u), 0, soulP, smooth(102.55, 103.3, u));

    // ------------------------------------------------------------ effects
    fire.uniforms.uAmt.value = fireOn ? fireAmt : 0;
    fire.mesh.visible = fireOn;
    // (thinner while the eye flies over the village after the light, so the burning street reads below)
    // (thinned where the eye has to see through it: the crag across the valley, and the light going west over the fields)
    smoke.uniforms.uAmt.value = fireOn ? fireAmt * (1 - 0.5 * band(98.6, 99.3, 100.3, 100.9, u)) * (1 - 0.45 * band(103.4, 103.9, 104.8, 105.3, u)) : 0;
    const inkNow = inB ? 0 : (debug.noInk ? 0 : fx.ink(u)) * (u > 61.5 ? 1 : 0) * (1 - smooth(93.6, 95.2, u)) * (1 - roomReveal(u));
    smoke.uniforms.uInkK.value = inkNow;
    houseSmoke.uniforms.uInkK.value = inkNow;
    smoke.mesh.visible = fireOn;
    houseSmoke.uniforms.uAmt.value = fireOn ? band(76, 78, 97, 99, u) : 0;
    houseSmoke.mesh.visible = houseSmoke.uniforms.uAmt.value > 0.01;
    embers.uniforms.uAmt.value = inB ? 0 : sample('embers');
    embers.points.visible = embers.uniforms.uAmt.value > 0.01;
    // (the motes, leaves and ash that drift about the lens stay down in the valley: none up among the clouds)
    const lowAlt = 1 - smooth(60, 160, inB ? 0 : camera.position.y);
    const box = (p, amt) => { amt *= lowAlt; p.uniforms.uAmt.value = amt; p.uniforms.uCenter.value.copy(camera.position); p.points.visible = amt > 0.01; };
    box(ash, inB ? 0 : sample('ash'));
    box(snow, sample('snow'));
    box(leaves, sample('leaves'));
    leaves.uniforms.uGustK.value = lerp(1, 2.2, stormAmt);
    box(pollen, sample('pollen'));
    box(petals, (u < 46 ? sample('pollen') : 0) + (inB ? sample('blossom') * 0.8 : 0));
    // (butterflies only while it is an ordinary morning)
    if (world.butterflies) world.butterflies.visible = !inB && u < 46.4 && lowAlt > 0.5;
    // (as the colour floods back into the valley the wind gets up, a cloud of petals rushes across and past the lens
    // while the camera falls to him, and the last of them blow on past him in the street)
    gust.update({ u, time, amt: inB ? 0 : smooth(8.35, 9.3, u) * (1 - smooth(14.4, 15.6, u)), travel: 34 * smooth(8.4, 14.6, u), camera,
      pxPerRad: renderer.getDrawingBufferSize(_dbs).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) });
    gust2.update({ u: 8.45 + (u - 56.7) * 1.7, time, amt: 0, travel: 46 * smooth(56.7, 57.9, u), camera,
      pxPerRad: renderer.getDrawingBufferSize(_dbs).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) });
    // (gone as the light gathers overhead: from then on the motes are the light's own, going up into it)
    box(motes, inB ? band(132.6, 134, 139.0, 139.3, u) : 0);
    // (and up the eye's well in the launch, rain all the way: drawn out into long streaks going by as the eye bursts
    // up through it, until in one frame it is gone, out over the sea)
    const climbRain = inB ? 0 : band(47.62, 47.75, SILENCE - 0.002, SILENCE, u);
    // (and down through the storm in the dive: the rain rising past the lens as the eye falls through it)
    const diveRain = inB ? 0 : band(52.92, 53.12, 54.3, 54.44, u);
    rain.uniforms.uAmt.value = Math.max(sample('rain') * (1 - smooth(500, 900, inB ? 0 : camera.position.y)), 0.85 * climbRain, 0.8 * diveRain);
    rain.uniforms.uCenter.value.copy(camera.position);
    // the cinema bars at the key moments, a little thinner on a tall screen; the rain going by breaks over them
    {
      const bk = barsAt(u), asp = camera.aspect;
      const bh = asp < 1 ? 0.09 : clamp((1 - asp / 2.39) / 2, 0.06, 0.13);
      post.ink.uBars.value.set(bk, bh, 0.5 / renderer.getDrawingBufferSize(_dbs).y, 0.55);
      rain.setTag(bk > 0.01);
      metrics.bars = bk * bh;
    }
    {
      // (the eye's own motion this frame, for the streaks; a jump of the eye is a cut, not a flight, and so is a change
      // of shot in the forest)
      const d = _rainV.copy(camera.position).sub(_rainP), dl = d.length();
      const shotCut = !!(bShot && bShot.shot && bShot.shot !== lastShot);
      lastShot = bShot ? bShot.shot : '';
      if (dt > 1e-4 && dl < 60 && !shotCut) rain.uniforms.uCamVel.value.copy(d).divideScalar(dt), rain.uniforms.uExpo.value = dt;
      else rain.uniforms.uCamVel.value.set(0, 0, 0), rain.uniforms.uExpo.value = 0;
      _rainP.copy(camera.position);
    }
    rain.mesh.visible = rain.uniforms.uAmt.value > 0.01;
    const cb = band(105.4, 107.0, 109.0, 110.6, u);
    cloudBank.uniforms.uAmt.value = cb;
    cloudBank.mesh.visible = cb > 0.01;
    cloudBank.uniforms.uCenter.value.copy(camera.position);
    cloudBank.uniforms.uBase.value = 205;
    cloudBank.uniforms.uLit.value.setRGB(...sample('cloudLit')).multiplyScalar(1.1);
    cloudBank.uniforms.uShade.value.setRGB(...sample('cloudShade'));
    const dayOn = u < brokenAt ? 1 : 0;
    if (sparks) { sparks.uniforms.uAmt.value = dayOn * (u < 40 ? 1 : 0); sparks.points.visible = dayOn > 0 && u < 40; }
    if (steam) { steam.uniforms.uAmt.value = dayOn; steam.mesh.visible = !!dayOn && u < 40; }
    chimney.uniforms.uAmt.value = dayOn * (u < 46 ? 1 : 0.4);
    chimney.mesh.visible = u < brokenAt;
    incense.uniforms.uAmt.value = u < brokenAt ? 1 : 0;
    incense.mesh.visible = u < brokenAt;
    const birdAmt = sample('birds');
    // (over the village by day; drifting north with him to the old pines, where they burst out of the canopy)
    const birdC = inB ? V3(-10, 30, -40) : V3(0, 0, -40).lerp(A.mushrooms.clone().add(V3(-4, -4, -12)), smooth(36, 42.5, u));
    birds.update(time, birdC, inB ? 0 : sample('birdFlee'), birdAmt);
    // (their flight runs on the scroll, not the story: they stream away through the held moment instead of hanging)
    // (out of the crowns round him as the sky turns, scattering south-east across the valley, away from the eye)
    if (!birdBurst.placed) {
      // (perched all round the lens through the crowns it goes up through, flying up and away toward the eye with it)
      const bl = A.mushPine.base.clone().addScaledVector(toEye, -2.2).setY(mushCam(47.4).y);
      birdBurst.place(bl, V3(toEye.x, 1.4, toEye.z), toEye.clone(), [A.mushPine.base.y + 8, A.mushPine.base.y + 21]);
    }
    birdBurst.update({ u: BURST_AT + sToU(u) - sToU(BURST_AT), time, amt: inB ? 0 : 1 });
    // the light that falls from the battle, west, beyond the ridge
    // it drops out of the meeting of the two lights, arcs west and falls beyond the ridge; the streak it burns
    // into the sky lingers and fades
    // the fighters: their heads and trails, the burst of each meeting, the death blow
    {
      const div = quality.low ? 3 : 2;
      // (after the smash the fight is over: no more meetings but the smash's own, the violet one fading away above, the
      // gold one's head and trail falling with it down through the storm, its trail laid back along the fall)
      const over = !inB && u > SMASH;
      const bw = inWar && !over ? warBw.filter(w => w.age < 1.3).slice(0, 3).map(w => ({ pos: w.b.at(u), t: time - w.age, kind: w.b.kind, amt: 1.25 }))
        : clashK > 0.01 && !inB && !over ? blows.map(bl => ({ pos: V3(bl.pos.x + _dc.x, bl.pos.y + _dc.y, bl.pos.z + _dc.z), t: bl.t, kind: bl.kind, amt: clashK * (bl.kind === 3 ? 0.9 : 1.25) })) : [];
      if (over && smashAge < 1.3) bw.unshift({ pos: GOLD_FALL(SMASH, V3()), t: time - smashAge, kind: 2, amt: 1.3 });
      const fl0 = inWar ? warFlight : duelFlight;
      const flight = falling > 0 ? (t, o1, o2) => { fl0(t, o1, o2); o1.lerp(GOLD_FALL(u - Math.max(0, time - t) * 0.15, _gf), falling); } : fl0;
      const violetK = clashK * (1 - smooth(SMASH + 0.08, SMASH + 0.4, u));
      // (close to, the two are people: their lights are only the haze about them, not stars over them)
      let heads = [1, 1];
      if (inWar) { flight(time, _wg, _wm); heads = [smooth(45, 170, camera.position.distanceTo(_wg)), smooth(45, 170, camera.position.distanceTo(_wm))]; }
      fighters.update({
        time, flight, amts: inB ? [0, 0] : [Math.max(clashK, falling), violetK], blows: bw, camera, headK: heads,
        skyTex: sky.rt.textures[2], res: _fRes.set(sky.rt.width * div, sky.rt.height * div),
      });
      // the two as people, and what they throw at each other
      war.shared.tSky.value = sky.rt.textures[2]; war.shared.uRes.value.copy(_fRes);
      war.update(u, time, camera, inB ? 0 : 1, at => cueAge(at, u, time), { sunDir: S.uSunDir.value, sunCol: S.uSunCol.value, sky: S.uZenith.value });
      // the shock of the newest blow bends the light round it; the hardest ones strike the frame into two tones
      const I2 = post.ink;
      I2.uShockR.value.w = 0; I2.uImpactF.value = 0;
      const nb = bw[0];
      if (nb) {
        const age = (time - nb.t) / 0.45;
        _ss.copy(nb.pos).project(camera);
        if (age >= 0 && age < 1 && _ss.z < 1 && Math.abs(_ss.x) < 1.3 && Math.abs(_ss.y) < 1.3) {
          const near = clamp(700 / Math.max(camera.position.distanceTo(nb.pos), 1));
          I2.uShockR.value.set(_ss.x * 0.5 + 0.5, _ss.y * 0.5 + 0.5, lerp(0.02, 0.55, 1 - Math.pow(1 - age, 3)), Math.pow(1 - age, 2) * clashK * near * (nb.kind === 1 ? 0.6 : 1));
          if (!inWar && (nb.kind === 3 || nb.kind === 2 || nb.kind === 5) && time - nb.t < 0.07) I2.uImpactF.value = 0.85 * clashK * near;
        }
      }
      // (the war's hardest blows strike the frame into two tones, a few frames)
      for (const w of warBw) if (w.b.frame && w.age < w.b.frame) I2.uImpactF.value = Math.max(I2.uImpactF.value, 0.85);
    }
    // (the instant it strikes, the frame is struck into two tones)
    if (!inB) { const ca = cueAge(STAR[1], u, time); post.ink.uImpactF.value = Math.max(post.ink.uImpactF.value, band(STAR[1], STAR[1] + 0.006, STAR[1] + 0.022, STAR[1] + 0.04, u) * 0.85, ca < 0.06 ? 0.85 : 0); }
    // (and the smash that sends the gold one down: the dive's first, as the strike is its last)
    if (smashAge < 0.07) post.ink.uImpactF.value = Math.max(post.ink.uImpactF.value, 0.8);
    impact.set({ at: S_HIT, age: (u - STAR[1]) * 3.2, amt: inB ? 0 : 1 - smooth(56.3, 57.4, u), time, camera, ring: ringR, frontAmt: inB ? 0 : band(STAR[1], STAR[1] + 0.02, 56.9, 57.5, u) });
    // what fell: down inside the bolt onto the slope; then out of the fire, up over the ridges and down beyond them,
    // burning out as it goes (its streak lingers, and shows again when the light of the dead goes west after it)
    const phase = u < GOLD[0] - 0.05 ? 1 : 2;
    if (phase !== starPhase) { starPhase = phase; if (phase === 1) star.setPath(STAR_A, STAR_B, STAR_C); else star.setPath(GOLD_A, GOLD_B, GOLD_C); }
    let sh = 0, amt = 0, after = 0;
    if (phase === 1) {
      const st = clamp((u - STAR[0]) / (STAR[1] - STAR[0]));
      sh = clamp(st * st * 0.55 + st * 0.45);
      amt = st > 0 && st < 1 ? smooth(0, 0.04, st) * (1 - smooth(0.82, 1, st)) : 0;
      after = st > 0 ? 1 - smooth(STAR[1], STAR[1] + 0.5, u) : 0;
      star.uniforms.uW.value = 9; star.headK = 0.7;
    } else {
      const gt = goldK(u);
      sh = gt;
      amt = gt > 0 && gt < 1 ? smooth(0, 0.05, gt) * (1 - smooth(0.86, 1, gt)) : 0;
      after = gt > 0 ? Math.max(1 - smooth(GOLD[1], GOLD[1] + 2.4, u), 0.8 * band(103.4, 105.2, 107.8, 108.3, u)) : 0;
      star.uniforms.uW.value = 3.2; star.headK = 0.6;
    }
    star.group.visible = !inB && sh > 0 && (amt > 0.001 || after > 0.001);
    S.uStarK.value = 0;
    if (star.group.visible) {
      star.update(sh, amt, after, camera, sky.rt.texture, sky.rt.width * (quality.low ? 3 : 2), sky.rt.height * (quality.low ? 3 : 2));
      star.uniforms.uRes.value.copy(post.ink.uRes.value);
      star.at(sh, S.uStarPos.value);
      star.at(Math.max(0, sh - 0.1), S.uStarTail.value);
      S.uStarK.value = amt;
    }
    // the charge: sparks crackling out of the dark cloud and streaming into one point, a knot of light there that
    // swells and throbs until it goes into the bolt; small arcs leaping between
    {
      const ck = inB ? 0 : band(53.05, 53.4, 54.0, 54.06, u);
      const kn = inB ? 0 : smooth(53.3, 53.98, u) * (1 - smooth(54.0, 54.04, u)) + (u >= 54.0 && u < 54.05 ? 0.9 * (1 - (u - 54.0) / 0.05) : 0);
      const throb = Math.pow(Math.max(0, Math.sin(time * 9.0)), 6) * smooth(53.6, 53.95, u);
      const fovR = THREE.MathUtils.degToRad(camera.fov);
      charge.set({ time, amt: ck, org: smooth(53.2, 53.95, u), knot: kn, pulse: throb, center: C_F,
        R: lerp(1150, 520, smooth(53.1, 54.0, u)), H: lerp(1900, 650, smooth(53.1, 54.0, u)), camera, base: 615, vis: 320,
        px: 2 * Math.tan(fovR / 2) / renderer.getDrawingBufferSize(_dbs).y, streak: smooth(53.88, 54.0, u) * (1 - smooth(54.0, 54.05, u)) * 2.5 });
      S.uCharge.value.set(C_F.x, C_F.y, C_F.z, kn * (0.9 + throb * 1.5));
      const slot = Math.floor(time / lerp(0.15, 0.06, smooth(53.4, 53.97, u)));
      if (ck > 0.25 && slot !== lastArc) {
        const q = rng(slot * 13 + 5), rr = lerp(520, 110, smooth(53.3, 54.0, u));
        const a0 = C_F.clone().add(V3(q.range(-1, 1) * rr, q.range(-0.5, 0.5) * rr, q.range(-1, 1) * rr));
        lightning.strike(time, a0, a0.clone().lerp(C_F, q.range(0.55, 1.0)).add(V3(q.range(-50, 50), q.range(-50, 50), q.range(-50, 50))), { seed: slot, strength: 0.45 + ck * 0.45, width: 1.3, branches: 3, levels: 5, color: new THREE.Color(0.62, 0.78, 1.0) });
      }
      lastArc = slot;
    }
    // what only he sees: the light in the smith's wares, while his eyes are on them
    const auraK = inB ? 0 : band(25.55, 26.25, 27.3, 27.95, u);
    // (and while he comes up to the stall and stands at it, a warm light on the wares under the porch roof, which the
    // houses across the street keep in shade all morning)
    if (auras) auras.set({ time, amt: auraK, fill: inB ? 0 : band(24.3, 25.2, 28.3, 29.2, u) });
    // the shreds of cloud rushing past as the eye goes down through the sea's top, the storm, and out of its base
    {
      // (up through the well in the sea of clouds, shreds of it streaming down past; down through its bright top into
      // the storm; in the dark of the storm the sparks show how fast it is going)
      // (and the launch: from under the deck up the well, thicker going through each sheet)
      let sheetK = 0;
      for (const [su] of SHEETS) sheetK = Math.max(sheetK, band(su - 0.05, su - 0.015, su + 0.015, su + 0.05, u));
      const climb = inB ? 0 : Math.min(1.25, band(47.62, 47.8, 48.45, SILENCE, u) * (1 + 0.6 * sheetK));
      // (and on down through the dark of the storm: shreds of it rushing up past the lens, lit by the flashes)
      const ra = inB ? 0 : band(52.88, 52.98, 53.82, 53.96, u);
      const dk = smooth(52.98, 53.16, u);
      // (up the well: small shreds whipping past close to the lens, slate low down, pearl and gold higher; gone in one
      // frame out over the sea)
      // (thinned under the screen, so the shadow play is seen clear)
      if (climb > ra) rush.set({ camera, time, dt, amt: climb * 0.55 * (u < SILENCE ? 1 : 0) * (1 - 0.85 * band(48.07, 48.1, 48.19, 48.2, u)), bg: sky.rt.textures[0], screen: renderer.getDrawingBufferSize(_scr), own: 0.55,
        low: _rl.setRGB(0.34, 0.37, 0.43), high: _rh.setRGB(1.3, 1.2, 1.0), y0: 800, y1: 2100, size: 0.15, box: 160, near: 4 });
      else rush.set({ camera, time, dt, amt: ra, bg: sky.rt.textures[0], screen: renderer.getDrawingBufferSize(_scr), own: 0.06,
        low: _rl.setRGB(0.5, 0.54, 0.62).lerp(_rc.setRGB(0.018, 0.021, 0.03), dk),
        high: _rh.setRGB(1.5, 1.45, 1.38).lerp(_rc.setRGB(0.1, 0.11, 0.14), dk),
        y0: 700, y1: 2700, flash: S.uFlash.value, flashPos: S.uFlashPos.value, flashCol: S.uFlashCol.value });
    }
    const vp = vapor.geometry.attributes.position;
    world.wolves.forEach((w, i) => {
      const m = w.root.visible && !inB ? w.mouth() : V3(0, -999, 0);
      for (let k = 0; k < 24; k++) vp.setXYZ(i * 24 + k, m.x, m.y, m.z);
    });
    vp.needsUpdate = true;
    vapor.uniforms.uAmt.value = broken && !inB ? 1 : 0;
    // the forest itself
    // gold motes: pixels per world unit at distance 1 (for their point size)
    const pxS = renderer.getDrawingBufferSize(_dbs).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    {
      const sk = !inB ? band(92.3, 93.2, 107.9, 108.4, u) : 0;
      soulAt(u - 0.12, _sp0);
      // (a small cloud about its heart that leaves a thread of motes behind it as it goes up, not a burst)
      // (as it goes over the ridge, a long comet of motes behind it)
      const flying = smooth(106.1, 106.6, u);
      soulQi.set({ time, amt: sk * (0.22 + 0.78 * smooth(102.4, 103.8, u)), center: soulP, radius: lerp(0.32, 1.0, smooth(92.3, 99.5, u)) * (1 + 2.2 * flying), target: soulP, org: 0, drift: 1, flow: _sp1.copy(soulP).sub(_sp0).normalize(), tail: u > 102.6 ? lerp(34, 150, flying) : lerp(0.4, 6, smooth(95.2, 96.6, u)) * (1 - 0.5 * smooth(98.4, 99.6, u)), px: pxS });
      const ok = !inB ? smooth(96.2, 97.9, u) * (1 - smooth(107.36, 107.48, u)) : 0;
      // (low over the fields ahead of him, it lights the land round him: brighter, farther; it checks and swells before it goes)
      const lead = !inB ? band(104.75, 105.35, 105.95, 106.3, u) : 0;
      const swell = band(105.8, 106.02, 106.08, 106.3, u);
      soulOrb.uniforms.uMinPx.value = lerp(30, 44, flying);
      soulOrb.set({ pos: soulP, amt: ok * (1 + 1.6 * smooth(105.6, 106.4, u) + 1.4 * swell), time, px: pxS, size: lerp(0.55, 1.2, smooth(97, 99, u)) * (1 + 2.5 * smooth(105.8, 106.6, u)) * (1 + 0.25 * lead + 0.8 * swell), lightI: lerp(120, 170, lead) * (1 + 1.2 * swell), reach: lerp(46, 40, lead) * (1 + 0.6 * swell) });
      // its comet's tail: a ribbon of gold along the way it goes, drying away behind it
      const lk = launchK(clamp(u, LAUNCH[0], LAUNCH[1]));
      cometTrail.uniforms.uTime.value = time;
      cometTrail.uniforms.uProg.value = lk;
      cometTrail.uniforms.uTail.value = Math.max(0, lk - 0.42);
      cometTrail.uniforms.uAlpha.value = smooth(106.0, 106.25, u) * (1 - smooth(107.45, 107.7, u));
      cometTrail.mesh.visible = !inB && u > 106.0 && u < 107.7;
      // where it comes down: the sky beyond the ridge takes fire (a dome of gold behind the ridge, rays, the light
      // spreading flat along the land), and its light floods out over everything
      const xb = !inB && !debug.noXB ? crossFlash(u) : 0, xAge = Math.max(0, u - LAUNCH[1]);
      crossBurst.set({ pos: CROSS_L, amt: xb * (1.3 + 2.4 * Math.exp(-xAge / 0.05)), radius: lerp(800, 2900, Math.pow(smooth(LAUNCH[1], 107.95, u), 0.5)), time, rays: 1, band: 1 });
      // (the grass round where it leaves him thrown flat in a ring of its light)
      const lp0 = getLaunch().getPointAt(0, _lp0), ringA = clamp((u - 105.98) / 0.42);
      U.uRing.value.set(lp0.x, lp0.z, 2 + 38 * Math.pow(ringA, 0.7), !inB && u > 105.98 && u < 106.4 ? (1 - ringA) * 1.4 : 0);
      // (a ribbon of its light streaming back to him, winding; the fireflies risen out of the grass all round)
      runnerAt(u, _run1);
      leadQi.set({ time, amt: lead * 0.9, center: soulP, radius: 1.6, target: _run1.clone().add(V3(0, 1.25, 0)), org: 0.9, spiral: 1.2, drift: 0.6, px: pxS });
      // (the grass under it bows away from it and catches its gold as it goes over)
      if (lead > 0.01) { const gy = heightAt(soulP.x, soulP.z); WAKE.value.set(soulP.x, gy, soulP.z, lead * clamp(1 - (soulP.y - gy - 5) / 9)); } else WAKE.value.w = 0;
      flies.set({ time, amt: !inB ? band(104.9, 105.4, 106.6, 107.0, u) : 0, center: V3(-64, heightAt(-64, 35) + 1.6, 35), radius: 30, flat: 0.07, drift: 1, px: pxS });
    }
    if (B) B.update(u, time, camera, { inB, wuhenP: P, sample, hero: wuhen, ghosts, pxScale: pxS, lamp: inB ? crystalLight : null });

    // ------------------------------------------------------------ environment light from the sky (refreshed as the sky changes)
    if ((Math.abs(time - envT) > 0.25 && (Math.abs(u - envU) > 0.04 || Math.abs(time - envT) > 2.5)) || Math.abs(u - envU) > 1.0) {
      scene.environment = sky.updateEnv();
      envT = time; envU = u;
    }

    // ------------------------------------------------------------ post
    const I = post.ink;
    I.uSat.value = sample('sat');
    I.uContrast.value = sample('contrast');
    I.uTint.value.setRGB(...sample('tint'));
    I.uShadowTint.value.setRGB(...sample('toneS'));
    I.uHighTint.value.setRGB(...sample('toneH'));
    I.uInk.value = debug.noInk ? 0 : fx.ink(u);
    // the painted look over the whole world in colour (lines a little finer on a phone); the painted light on the
    // surfaces only while the world is not drawn in ink (after the soul's light floods the colour back, it is)
    I.uToon.value = debug.toon ?? (TOON ? 1 : 0);
    FOGU.cfToonK.value = (debug.toon ?? 1) * clamp(1 - (debug.noInk ? 0 : fx.ink(u)) * (inB ? 1 : 1 - smooth(1.0, 2.6, fx.soulSeep(u))));
    I.uToonR.value = (debug.toonR ?? 1.35) * Math.max(1, renderer.getPixelRatio() * 0.9);
    if (debug.toonBand != null) I.uToonBand.value = debug.toonBand;
    if (debug.toonSat != null) I.uToonSat.value = debug.toonSat;
    if (debug.toonLine != null) I.uToonLine.value = debug.toonLine;
    if (debug.toonW != null) I.uToonW.value = debug.toonW;
    I.uBleed.value = u < 12 ? fx.bleed(u) : -1;
    I.uBleedC.value.set(0.5, 0.42);
    const spreading = u > 61.5 && u < 108;
    I.uInkSpread.value.set(0.5, 0.5, spreading ? fx.inkSpread(u) : 3, 0.4);
    I.uInkKey.value = fx.inkKey(u);
    // (the boy black in the doorway, seen from the room: see the camera, REVERSE)
    I.uFigSil.value = !inB && u > REVERSE[0] && u < REVERSE[1] ? 1 : 0;
    I.uSepia.value = inB ? fx.sepia(u) : 0;
    // (in the valley: colour seeps back out from the uncle's soul as it rises; in the forest, from the camp)
    const sSeep = inB ? 0 : fx.soulSeep(u);
    // colour shows through the ink in a few places: around each strike as it lands on the road, the burning gate
    // as he runs under it, the room when he first sees his uncle (then the ink takes it back for the words)
    let rvP = null, rvR = 0, rvW = 0.3;
    if (!inB && u > 61.7 && u < 92.4) {
      if (gs.glow > 0.02 && gs.glowPos) { rvP = gs.glowPos; rvR = 0.1 + 0.55 * Math.min(1, gs.glow); rvW = 0.3; }
      const gateK = band(72.25, 72.7, 73.2, 73.75, u);
      if (gateK * 0.8 > rvR) { rvP = _rvGate.copy(A.gate.center).add(V3(0, -1.2, 0)); rvR = 0.8 * gateK; rvW = 0.42; }
      const roomK = roomReveal(u);
      if (roomK > 0.01 && roomK * 1.5 > rvR) { rvP = UH.uncleSpot; rvR = 1.5 * roomK; rvW = 0.5; }
      // (the last colour in the world: the mushrooms in the basket in his hand, until his fingers open; the whole basket,
      // however near or far it is: its size on the screen)
      const bk = band(62.9, 63.5, 65.5, 65.64, u);
      if (bk > 0.01 && held.visible) {
        const bc = held.localToWorld(_rvBasket.set(0, 0.12, 0)), sr = 0.26 / (2 * Math.max(0.2, camera.position.distanceTo(bc)) * Math.tan(camera.fov * Math.PI / 360));
        if (sr * bk > rvR) { rvP = bc; rvR = sr * bk; rvW = Math.max(0.025, sr * 0.3); }
      }
    }
    if (rvP && rvR > 0.01) {
      _ss.copy(rvP).project(camera);
      const on = _ss.z < 1 && Math.abs(_ss.x) < 1.4 && Math.abs(_ss.y) < 1.4;
      if (on) I.uSeep.value.set(_ss.x * 0.5 + 0.5, _ss.y * 0.5 + 0.5, rvR, rvW);
      else I.uSeep.value.set(0.5, 0.42, -1, 0.4);
    } else if (sSeep > 0) {
      _ss.copy(soulP).project(camera);
      const onScreen = _ss.z < 1 && Math.abs(_ss.x) < 1.6 && Math.abs(_ss.y) < 1.6;
      I.uSeep.value.set(onScreen ? _ss.x * 0.5 + 0.5 : 0.5, onScreen ? _ss.y * 0.5 + 0.5 : 0.5, sSeep, lerp(0.16, 0.45, smooth(0.05, 0.9, sSeep)));
    } else I.uSeep.value.set(0.5, 0.42, inB ? fx.seep(u) : -1, 0.4);
    I.uPaper.value = fx.paper(u);
    I.uRedWash.value = fx.redInk(u);
    I.uWhite.value = debug.noWhite ? 0 : fx.white(u);
    // the breach: the white of the last sheet becomes the white of the page, and the sea of clouds settles out of it
    const breachW = inB ? 0 : smooth(48.44, SILENCE, u) * (1 - smooth(SILENCE, 48.54, u));
    if (breachW > 0) I.uWhite.value = Math.max(I.uWhite.value, 0.9 * breachW);
    // the crossing: the light that came down beyond the ridge floods out over everything, from where it fell, until it
    // fills the frame (hot gold-white first, settling to the warm white of the page the forest is painted on)
    if (!inB && u > 107.48 && u < 108.35) {
      // (from the heart of the light over the ridge, not from where it came down behind it)
      _ss.copy(CROSS_L).add(_xUp.set(0, 380, 0)).project(camera);
      const on = _ss.z < 1 && Math.abs(_ss.x) < 1.3 && Math.abs(_ss.y) < 1.3;
      metrics.crossUV = [on ? _ss.x * 0.5 + 0.5 : 0.5, on ? _ss.y * 0.5 + 0.5 : 0.55];
      I.uWhite.value = Math.max(I.uWhite.value, smooth(107.5, 107.6, u));
      I.uWhiteR.value.set(on ? _ss.x * 0.5 + 0.5 : 0.5, on ? _ss.y * 0.5 + 0.5 : 0.55, lerp(0.02, 2.9, Math.pow(smooth(107.52, 108.12, u), 1.55)), 0.55);
    } else if (inB && u > 109.7 && u < 110.62) {
      // out of the painting: the white parts from where the eye goes in (where the gold thread went down into the trees),
      // a little ahead of the painting clearing over it
      const aspY = innerHeight / Math.min(innerWidth, innerHeight);
      I.uWhite.value = 1;
      I.uWhiteR.value.set(0.62, 0.5 - 0.19 / aspY, 0.2 + 2.7 * Math.pow(smooth(109.72, 110.55, u), 1.2), -0.4);
    } else I.uWhiteR.value.z = -1;
    if (u > 48.4 && u < 48.6) _wc.setRGB(0.98, 0.955, 0.89);
    else if (u < 107.4) _wc.setRGB(0.93, 0.94, 0.96);
    else if (u < 110.8) _wc.setRGB(1.0, 0.84, 0.56).lerp(_wc2.setRGB(0.97, 0.935, 0.86), smooth(107.62, 108.2, u));
    else _wc.setRGB(...(u < 120 ? [0.93, 0.94, 0.96] : [1.0, 0.88, 0.6]));
    I.uWhiteCol.value.copy(_wc);
    I.uBlack.value = fx.black(u);
    // ink drawn finer indoors, bolder and farther over the valley
    const vast = Math.max(rw * smooth(94, 96.5, u), gw, fw);
    I.uInkNear.value = fx.inkNear(u);
    I.uInkFar.value = fx.inkFar(u);
    I.uInkLine.value = lerp(1.15, 0.9, vast) * fx.inkLine(u);
    I.uAccent.value.set(1, fx.goldKeep(u), 1, inB ? fx.redKeep(u) : 0);
    // (the pillar of light coming down onto him in the dell: the frame struck into two tones the instant it lands, then
    // one blinding beat of its gold, the frame shaken, the shock of it running out over the frame from where it stands)
    const bAge = u - STRIKE_B, bCue = inB ? cueAge(STRIKE_B, u, time) : Infinity;
    const bStrike = inB && bAge >= 0 ? Math.max(Math.exp(-bAge / 0.04), bCue < 0.5 ? Math.exp(-bCue / 0.09) : 0) : 0;
    I.uShock.value = Math.max(band(61.6, 62, 62.4, 63.4, u), band(78.6, 79, 79.3, 80, u) * 0.8, band(131.3, 131.5, 131.7, 132, u), bolt.flash * 0.18, bStrike * 0.9);
    if (bStrike > 0.002) { I.uFlash.value += bStrike * 0.55; I.uFlashTint.value.setRGB(1, 0.88, 0.62); }
    if (inB && B.light) {
      I.uImpactF.value = Math.max(I.uImpactF.value, band(STRIKE_B - 0.0005, STRIKE_B, STRIKE_B + 0.009, STRIKE_B + 0.015, u) * 0.9, bCue < 0.05 ? 0.9 : 0);
      const sa = bAge / 0.22;
      if (sa >= 0 && sa < 1) {
        _ss.copy(B.light.foot).add(_xUp.set(0, 1.0, 0)).project(camera);
        if (_ss.z < 1 && Math.abs(_ss.x) < 1.4 && Math.abs(_ss.y) < 1.4) I.uShockR.value.set(_ss.x * 0.5 + 0.5, _ss.y * 0.5 + 0.5, lerp(0.02, 0.95, 1 - Math.pow(1 - sa, 3)), (1 - sa) * (1 - sa) * 1.3);
      }
    }
    I.uVignette.value = lerp(0.32, 0.55, smooth(54, 60, u) * (inB ? 0.3 : 1));
    // (while he looks at the weapons the world round them dims a little and loses some colour: it is his sight)
    if (!inB) { const ak = band(25.6, 26.3, 27.25, 27.9, u); I.uVignette.value += ak * 0.28; I.uSat.value *= 1 - ak * 0.3; }
    I.uGrain.value = lerp(0.03, 0.05, smooth(54, 60, u) * (inB ? 0.4 : 1));
    // sun shafts through whatever casts a shadow
    // (the march now scatters only forward, much stronger toward the sun: the forest's palettes were tuned for the old lobe)
    post.shafts.density = sample('shafts') * sunVis * (sun.intensity > 0.05 ? 1 : 0) * 0.9 * (inB ? 0.4 : env.shaftK(u));
    post.shafts.color.setRGB(...sunCol).multiplyScalar(sample('sunI') * 0.28);
    I.uDebugView.value = debug.view || 0;
    post.shafts.fall = inB ? 0.05 : lerp(0.05, 0.012, band(41.2, 42.2, 46.4, 47.5, u));
    post.shafts.sunDir.copy(sd);
    post.shafts.screen = sample('beams') * sunVis * 0.55;
    // (the crossing: beams of its gold through the trees on the ridge, out of the sky beyond it)
    if (xFl > 0.01 && !debug.noXS) {
      post.shafts.sunDir.copy(CROSS_L).sub(camera.position).normalize();
      post.shafts.screen = 0.55 * xFl;
      // (the beams only: the mist on the ground is not lit by it, so the land stays dark against the light)
      post.shafts.ssColor = _xsCol.setRGB(1, 0.72, 0.38).multiplyScalar(1.1 * xFl);
    } else if (inB && B.light && (B.light.gather > 0.01 || B.light.beam > 0.01)) {
      // (the dell: beams of gold out of the knot of light gathering in the crown, through the leaves, and on out of
      // where the pillar comes through them)
      const L = B.light, k = Math.max(L.gather, L.beam * 0.55);
      post.shafts.sunDir.copy(L.canopy).sub(camera.position).normalize();
      post.shafts.screen = 0.6 * k;
      post.shafts.ssColor = _xsCol.setRGB(1, 0.78, 0.45).multiplyScalar(1.15 * k);
    } else post.shafts.ssColor = null;
    post.shafts.maxDist = inB ? 70 : lerp(70, 110, band(11, 13.5, 31, 34.5, u));
    // the air itself: wisps and waves in the sunlit haze, a low mist drifting over the ground (palette × scene)
    const air = post.shafts, cp = camera.position;
    air.noise = S.tShape.value;
    air.ground = inB ? (B.set?.heightAt ? B.set.heightAt(cp.x, cp.z) : B.fogFloor) : heightAt(cp.x, cp.z);
    air.mist = sample('mistG') * env.mistK(u);
    air.mistH = sample('mistH');
    air.wisp = sample('wisp');
    air.ambK = sample('airAmb');
    // with the sun behind him in the village the beams between the houses are side-lit: more of the haze's light goes sideways
    air.iso = inB ? 0.12 : lerp(0.24, 0.1, band(41.2, 42.2, 46.4, 47.5, u));
    air.amb.setRGB(...sample('hemiSky')).multiplyScalar(sample('hemiI') * (inB ? 1 : env.fillK(u)))
      .add(airFire.setRGB(1, 0.3, 0.08).multiplyScalar(fireGlow * 0.22));
    air.wind.set(0.92, 0.38).normalize().multiplyScalar(0.4 + sample('wind') * 1.2);
    post.bloom.strength = lerp(0.42, 0.62, Math.max(fireOn ? fireAmt : 0, inB ? smooth(136, 139.6, u) : 0)) + 0.5 * bStrike;
    post.bloom.threshold = lerp(fireOn ? 1.15 : inB ? 0.95 : lerp(1.45, 0.95, smooth(46.5, 50, u)), 2.6, inB ? 0 : band(48.3, 48.9, 52.4, 53.0, u));
    // (debugging: a probe may change anything after the story has set it)
    if (debug.after) debug.after({ u, S, rush, post, sky, camera, scene });
    lastU = u;
  }

  // People and wolves react to the story position u and to real time.
  const cast = world.cast;
  // the villagers and the wolves: on real ground, along paths, keyed to the story (village-life.js)
  const life = createVillageLife(world);
  function animateCast(u, time, broken, P) {
    life.update(u, time, broken, P, camera);
  }
  // the light leaving him: its comet's tail of gold, and the sky beyond the ridge on fire where it comes down
  // (built here, where the ground the run follows is known, and before the shader programs are compiled)
  const cometTrail = createGoldTrail(launchPts(), { width: 7, intensity: 5, head: 1.6, color: [1, 0.74, 0.34] });
  cometTrail.mesh.visible = false;
  scene.add(cometTrail.mesh);
  const crossBurst = createBurst();
  scene.add(crossBurst.mesh);

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    post.setSize(innerWidth, innerHeight);
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    sky.setSize(s.x, s.y);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  function render() {
    syncPool();
    post.render(() => sky.renderClouds(camera));
    metrics.frames++;
  }

  // debugging: put a bolt in the sky at a given age (seconds)
  function forceStrike(which = 0.5, age = 0.1, violet = 0) {
    lightning.reset();
    strikeAt(which, 1, violet, U.uTime.value - age);
  }

  mark('cast');
  injectFog(scene);
  update(0, 0, 0.016);
  mark('first update');
  // the valley's shader programs: their compiling is started here and goes on in the browser's own threads while the
  // page draws (the first drop falls meanwhile); compiled() waits for them afterwards. (Asking whether each is done is
  // a round trip to the GPU process, so it is not asked while the drop falls.) The first draw of every look the story
  // takes is the rehearsal's (warmUp).
  poolLights(); liteAll(scene);
  try { onTarget(() => renderer.compile(scene, camera)); } catch (e) { console.warn('precompile', e); }
  mark('compile started');
  const compiled = () => onTarget(() => renderer.compileAsync(scene, camera)).catch(e => console.warn('precompile', e));

  // ---------------------------------------------------------------- the rehearsal
  // Every look the story takes, drawn once behind the loading screen. Measured on a desktop GPU (Chromium on
  // Windows), first uses froze the page for 0.1–0.6 s at a time at nearly every key moment of a first read: the driver
  // compiles a program again for each way it is first drawn, and textures and buffers go up on their first draw. Paid
  // here they never recur. What is paid is per program, texture and buffer, not per pixel, so the rehearsal is drawn
  // small; at a few positions everything shown is drawn whatever the camera faces (frustum culling off), so every mesh
  // goes up, not only those in view. Each position is drawn twice a moment apart, so the strikes and bursts fired on
  // the way have their shapes. The story's own clock is used, and what the storm keeps of it is reset afterwards.
  const WARM_US = [
    0, 1.5, 1.95, 4, 5.5, 7, 10, 14, 18, 22, 26.5, 30, 34, 38, 42, 44, 46, 46.8, 47.5, 48.15, 48.5, 49.7, 50, 50.8, 51.4, 51.75, 51.95, 53,
    53.75, 54.02, 54.1, 54.45, 54.6, 55.3, 56, 57.5, 58.8, 60.5, 62, 62.65, 64, 65.5, 66.7, 68.4, 70.5, 72.7, 75.1,
    77, 78.6, 79.5, 81, 83, 84.5, 86, 88, 90, 91.5, 92.1, 92.5, 93.5, 95, 96.5, 98, 100, 101.3, 102.4, 103.6, 105,
    106.5, 107.5, 108.05, 108.2, 108.3, 108.4, 109, 110, 110.7, 111.5, 112.5, 112.6, 114, 115.5, 116.4, 117, 117.1, 118.5,
    118.7, 120, 120.3, 121.5, 121.9, 123, 123.35, 124.5, 126, 128, 129.1, 129.6, 129.8, 130.5, 131.1, 132.5, 134, 136,
    137.5, 139.3, 139.45, 139.7, 140.2, 141.2, 141.8, 143, 144.5,
  ];
  const SWEEP_US = new Set([4, 48.5, 54.6, 64, 79.5, 98, 105, 112.5, 131.1, 139.45]);
  // (what each position costs, in multiples of a plain one, measured on a Windows desktop: where the story first shows
  // something, its shaders are first drawn there. The progress reported goes by these, so the page's beats come at
  // even times rather than bunched up behind the burning village.)
  // (the war, war.js: the masked one close to at 49.7, the gold one under his great sword at 50, the crescent at 50.8,
  // the bell at 51.4, the lock at 51.75, its light from below at 51.95: each drawn here first, not mid-fight)
  const WARM_COST = { 0: 12, 10: 16, 46: 6, 49.7: 4, 50: 4, 50.8: 3, 51.95: 3, 58.8: 4, 72.7: 10, 75.1: 15, 77: 7, 78.6: 6, 79.5: 10, 81: 6, 84.5: 5, 88: 4,
    91.5: 8, 92.1: 8, 92.5: 5, 93.5: 10, 95: 7, 98: 30, 100: 12, 101.3: 8, 102.4: 7, 103.6: 9, 105: 7, 108.3: 10, 115.5: 7,
    128: 3, 129.1: 4, 130.5: 4, 132.5: 6 };
  function renderUnculled() {
    const flipped = [];
    scene.traverseVisible(o => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.frustumCulled) { o.frustumCulled = false; flipped.push(o); } });
    try { render(); } finally { for (const o of flipped) o.frustumCulled = true; }
  }
  // wait (without blocking the page) until the GPU has done everything asked of it so far
  async function gpuDone(maxMs = 8000) {
    const gl = renderer.getContext();
    if (!gl.fenceSync) return;
    const f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const t0 = performance.now();
    try {
      while (performance.now() - t0 < maxMs) {
        const st = gl.clientWaitSync(f, 0, 0);
        if (st === gl.ALREADY_SIGNALED || st === gl.CONDITION_SATISFIED || st === gl.WAIT_FAILED) break;
        await new Promise(r => setTimeout(r, 4));
      }
    } finally { gl.deleteSync(f); }
  }
  // (pause: { due(), play() } — the page's turn: when it has something to show, the GPU is let finish everything asked
  // of it first, then the page has the screen to itself until play() resolves. stats: each position's own cost, the
  // GPU waited for after every one, for measuring)
  async function warmUp({ onProgress = null, pause = null, stats = null, us = WARM_US, sweep = SWEEP_US, scale = 0.35 } = {}) {
    const nextFrame = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 60); });
    poolLights();
    const pr = renderer.getPixelRatio();
    renderer.setPixelRatio(Math.min(pr, scale));
    resize();
    let slice = performance.now(), tPrev = 0, done = 0;
    const total = us.reduce((a, u) => a + (WARM_COST[u] || 1), 0);
    try {
      for (let i = 0; i < us.length; i++) {
        // (the story's clock, never running backwards: each position's second look is a moment after its first)
        const u = us[i], t = Math.max(performance.now() / 1000, tPrev + 0.4);
        tPrev = t + 0.35;
        const t0 = performance.now(), p0 = renderer.info.programs.length;
        try {
          // (drawn, not compiled ahead: compiling "the scene" prepares every material, seen or not, for this position's
          // light, hundreds of programs nothing would ever draw; drawing compiles exactly what the reader will see)
          update(u, t, 0.016);
          if (sweep.has(u)) renderUnculled(); else render();
          update(u + 0.01, t + 0.35, 0.016);
          render();
        } catch (e) { console.warn('rehearsal', u, e); }
        if (stats) { const t1 = performance.now(); await gpuDone(30000); stats.push({ u, cpu: t1 - t0, all: performance.now() - t0, programs: renderer.info.programs.length - p0 }); }
        done += WARM_COST[u] || 1;
        if (onProgress) onProgress(done / total, u);
        // (a slice of work, then a frame for the page; every so often the GPU is let catch up)
        if (pause && pause.due()) { await gpuDone(); await pause.play(); slice = performance.now(); }
        else if (i % 12 === 11) { await gpuDone(); slice = performance.now(); }
        else if (performance.now() - slice > 28) { await nextFrame(); slice = performance.now(); }
      }
    } finally {
      renderer.setPixelRatio(pr);
      resize();
    }
    // what the storm keeps of its clock (the rehearsal's ran ahead of the real one), and where the story was
    const fresh = () => { lightning.reset(); gStrikes.reset(); nextStrike = 0; nextSheet = 0; sheetT0 = -9; envT = -9; envU = -99; lastU = 0; };
    fresh();
    // the first frame at full size (its targets are made here), then wait for the GPU to finish everything
    update(0, performance.now() / 1000, 0.016);
    render();
    await gpuDone();
    fresh();
  }

  return { renderer, scene, camera, update, render, resize, metrics, quality, world, post, sky, prepareForest, warmUp, forceStrike, debug, compiled, marks, get forest() { return B; } };
}
