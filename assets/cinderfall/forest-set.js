// The Forbidden Forest set (world B): a basin of ancient forest ringed by karst towers and waterfalls; the camp by the
// stream where the years pass; the journey out along the hunt trail, over the ford, through the bamboo thicket and the
// old wood to the waterfall at the foot of the karst wall; the sunken dell of the ancient tree, where the scroll waits
// sealed in crystal among the roots, ~410 m from the camp.
//   const set = await buildForestSet(mats, quality, { renderer });
//   scene.add(set.root); injectFog(set.root);   // every frame: set.update(time, camera)
// Seasons follow U.uSnow / uAutumn / uWet / uBlossom / uMoss; the camp grows with U.uStage / U.uYears (materials.js).
import * as THREE from 'three';
import { U } from './materials.js';
import { FOGU } from './atmosphere.js';
import { createFire, createSmoke } from './fx.js';
import { floraMaterials } from './flora-mats.js';
import { rng, lerp, smooth, V3, TAU, FL_AIR } from './flora-core.js';
import { fbm } from './util.js';
import { P, S, heightAt, maskAt, walkY, trailDist, trailPoint, trailDir, streamX, waterY, waterAt, routeDist, wallSide, oldK, riseT, buildTerrain, buildWater, JOURNEY_LEN, DELL_FLOOR } from './forest-set-terrain.js';
import { buildCamp } from './forest-set-camp.js';
import { buildCampWood, buildTrailWood, buildDell, treeFree, inDell, MED_DIR, TRAIL_END } from './forest-set-wood.js';
import { buildFord, buildThicket, buildOldwood, buildCliffFoot, FUNGI } from './forest-set-journey.js';
import { createKarstRing, createKarstWall, createMistLayers, createCardForest, createCanopyShell } from './forest-set-basin.js';

const AC = [-20, -48];          // centre of the camp's side of the basin
const MID_R = 235;               // instanced trees out to here around it, and 150 m either side of the route
const ROUTE_R = 118, DELL_R = 140;
// between the stages of the build: let a frame be drawn first (and, given a gate, wait until it opens: the page
// holds the heavy work back while the reader is scrolling)
let gateFn = null;
// (in a background tab, where no frames come, a moment instead)
const tick = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; setTimeout(r, 0); } }; requestAnimationFrame(go); setTimeout(go, 60); }).then(() => (gateFn ? gateFn() : null));

// groves: conifer stands (dense and dark: ink masses from the air, snow on their shoulders), bare broadleaf woods
// between them (grey twig haze over snow), clearings; shared by the mid forest and the canopy shell
const groveF = (x, z) => fbm(x * 0.0072 + 41, z * 0.0072 - 13, 3) + 0.1 * (fbm(x * 0.031, z * 0.031 + 5, 2) - 0.5);
const openF = (x, z) => fbm(x * 0.0105 + 3.3, z * 0.0105 - 7.1, 3) + 0.07 * (fbm(x * 0.045 + 9, z * 0.045, 2) - 0.5);
const conifer = (x, z) => smooth(0.47, 0.57, groveF(x, z));
// signed distance to the edge of the "near" forest (the camp's side of the basin, a broad band along the route, the
// dell): mid-forest trees inside it, the canopy shell outside
// (its edge wanders, so from the air the band along the route does not read as a strip)
const innerD = (x, z) => Math.min(Math.hypot(x - AC[0], z - AC[1]) - MID_R, routeDist(x, z) - ROUTE_R, Math.hypot(x - P.DELL[0], z - P.DELL[1]) - DELL_R)
  + 70 * (fbm(x * 0.0085 + 17.2, z * 0.0085 - 3.9, 3) - 0.5);
// the sky above the dell's great crown (where the staged sun stands, N 37 W, 34 degrees) stays clear of towers
const sunSector = (x, z) => { const dx = x - P.DELL[0], dz = z - P.DELL[1], b = Math.atan2(dx, -dz) * 180 / Math.PI; return b > -66 && b < -8 && Math.hypot(dx, dz) < 440; };

function buildBasin(q) {
  const r = rng(404);
  const lo = q.low;
  // ---- mid forest: groves and woods, clearings, the stream's open banks; no plantation rows
  const pts = [];
  const cell = lo ? 9.4 : 6.6;
  const deci = ['gold', 'gold', 'rust', 'rust', 'maple'];
  for (let z = -500; z < AC[1] + MID_R; z += cell) for (let x = -440; x < AC[0] + MID_R; x += cell) {
    const px = x + r() * cell, pz = z + r() * cell, u = r();
    const ind = innerD(px, pz);
    if (ind > 12) continue;
    if (Math.hypot(px, pz) < 44 || inDell(px, pz, 40)) continue;
    const tr = trailDist(px, pz);
    if (tr.d < 24 && tr.s > 12 && tr.s < S.RIM + 4) continue;
    if (treeFree(px, pz, 1.5)) continue;
    { const w = wallSide(px, pz); if (w.d < 7 || (w.side < 0 && !w.end && w.d < 95)) continue; }
    const m = openF(px, pz);
    if (m < 0.355) continue;
    const con = conifer(px, pz), edge = smooth(0.355, 0.43, m);
    if (u > (0.5 + 0.5 * con) * (0.45 + 0.55 * edge)) continue;
    // bigger toward the edge of the near forest, and in the old forest toward the wall
    const scaleD = (0.85 + 0.3 * smooth(-120, 0, ind)) * (1 + 0.32 * oldK(px, pz));
    const pine = r() < con * 0.92 + 0.05;
    const kind = pine ? 'pine' : deci[Math.floor(r() * deci.length)];
    const ht = pine ? 15 + r() * 10 : kind === 'maple' ? 9 + r() * 4 : 14 + r() * 9;
    pts.push([px, pz, kind, ht * scaleD]);
    // close the conifer stands: a second, younger pine in the same cell
    if (pine && con > 0.6 && edge > 0.8 && r() < 0.55) {
      const qx = px + (r() - 0.5) * cell * 0.9, qz = pz + (r() - 0.5) * cell * 0.9;
      if (!treeFree(qx, qz, 1.5)) pts.push([qx, qz, 'pine', (11 + r() * 8) * scaleD]);
    }
  }
  // in three bands across the basin, so that from the ground the bands behind the camera drop out of the frustum
  const cards = { group: new THREE.Group() };
  cards.group.name = 'cardForest';
  [[-110, 1e9], [-235, -110], [-1e9, -235]].forEach(([z0, z1], i) => {
    const sub = pts.filter(p => p[1] > z0 && p[1] <= z1);
    if (sub.length) cards.group.add(createCardForest(sub, { groundAt: heightAt, seed: 17 + i, shadows: false }).group);
  });
  // ---- canopy shell out to the cliffs
  const presence = (x, z) => {
    let p = smooth(-18, 22, innerD(x, z));
    const rb = Math.hypot(x - P.BASIN[0], z - P.BASIN[1]);
    p *= 1 - smooth(1040, 1100, rb);
    p *= smooth(0.33, 0.39, openF(x, z));
    const mx = x - P.MEDITATE[0], mz = z - P.MEDITATE[1];
    const t = mx * MED_DIR[0] + mz * MED_DIR[1], lat = Math.abs(mx * MED_DIR[1] - mz * MED_DIR[0]);
    if (t > 0 && t < 420) p *= smooth(4 + t * 0.1, 10 + t * 0.14, lat);
    return p;
  };
  const shell = createCanopyShell({ center: P.BASIN, size: 2200, segments: lo ? 110 : 160, groundAt: heightAt, presence, conifer, height: (x, z) => 15 + 9 * fbm(x * 0.01 + 1, z * 0.01 + 2, 3) });
  // ---- the karst ring with three waterfalls (north: over the stream's old head; west-north-west: seen from the
  // meditation spot; north-north-west: far behind the dell, below its sun); no towers on the route or over the dell
  const karst = createKarstRing({
    center: P.BASIN, radii: [330, 900], massifs: lo ? 16 : 26, seed: 9, groundAt: heightAt, north: [0, -1], quality: q, pines: lo ? 3 : 5,
    falls: [[22, -470], [-396, -150], [-449, -668]],
    avoid: (x, z) => routeDist(x, z) < 130 || Math.hypot(x - P.DELL[0], z - P.DELL[1]) < 160 || sunSector(x, z),
  });
  // ---- the karst wall at the end of the way: the waterfall where the stream begins, the dell at its foot
  const M = floraMaterials();
  const wallH = s => lerp(48, 112, smooth(0, 60, s)) * (1 - 0.25 * smooth(150, 225, s)) + 14 * Math.exp(-Math.pow((s - 125) / 30, 2));
  const wall = createKarstWall({
    foot: P.WALL, groundAt: heightAt, seed: 77, quality: q, height: wallH, material: M.cliffNear,
    fall: { pool: P.CLIFF_POOL, waterY: waterAt(0), lip: 54 },
  });
  // ---- mist. Banks lying in the hollows (the stream valley, the sunken dell, low ground), seen from the air only
  // (the set fades them as the camera comes down), and banks at the feet of the towers, always there.
  const lowAt = (x, z) => heightAt(x, z);
  const banks = [];
  const bank = (x, z, w, d, ry, dy = 6) => {
    const y = lowAt(x, z) + dy;
    banks.push({ x, z, y, w, d, ry });
    banks.push({ x: x + (r() - 0.5) * w * 0.2, z: z + (r() - 0.5) * d * 0.2, y: y + 5 + r() * 3, w: w * 0.7, d: d * 0.7, ry: ry + 0.4 });
  };
  bank(28, -66, 28, 110, 0.05, 5);          // the stream valley north of the camp (beside the water, not over it)
  bank(-6, -104, 26, 70, -0.15, 5);
  bank(24, 58, 26, 80, -0.1, 4.5);          // and south of it
  bank(-120, -192, 34, 90, 0.95, 5);        // the upper stream, along the way
  bank(-196, -238, 30, 70, 0.85, 5);
  bank(P.DELL[0], P.DELL[1], 46, 42, 0.3, 6);   // the dell holds a pool of mist
  for (const [x, z, w, d, ry] of [[-92, -152, 150, 90, 0.5], [-138, -42, 120, 80, 1.3], [24, -196, 160, 80, 0.2], [112, -84, 110, 70, 0.9], [138, 44, 96, 64, 2.2], [-190, -268, 230, 120, 0.6], [-60, 120, 140, 70, 0.1], [70, 170, 130, 70, 2.6]]) bank(x, z, w, d, ry, 7 + r() * 5);
  const lowMist = createMistLayers({ items: banks, alpha: 0.55 });
  lowMist.group.name = 'mistLow';
  const mi = [];
  for (let i = 0; i < (lo ? 10 : 18); i++) {   // banks of mist at the feet of the towers
    const a = (i + r() * 0.6) / (lo ? 10 : 18) * TAU, d = 380 + r() * 420;
    const x = P.BASIN[0] + Math.cos(a) * d, z = P.BASIN[1] + Math.sin(a) * d;
    mi.push({ x, z, y: heightAt(x, z) + 14 + r() * 22, w: 360 + r() * 300, d: 260 + r() * 200, ry: a });
    mi.push({ x, z, y: heightAt(x, z) + 34 + r() * 16, w: 260 + r() * 200, d: 200 + r() * 150, ry: a + 0.5 });
  }
  const mist = createMistLayers({ items: mi, alpha: 0.4 });
  mist.group.add(lowMist.group);
  return { cards, shell, karst, wall, mist, lowMist, nCards: pts.length };
}

/**
 * buildForestSet(mats, quality, { renderer }) -> { root, heightAt, walkY, anchors, update(time, camera), groups, fx,
 *   shafts, crystal, fungi, regions, ... }
 * mats: createMaterials(renderer) result. quality.low builds about half the vegetation.
 */
export async function buildForestSet(mats, quality = {}, { renderer, gate = null } = {}) {
  gateFn = gate;
  const T0 = performance.now(), times = {};
  const mark = k => { times[k] = Math.round(performance.now() - T0); };
  const q = { low: !!(quality && (quality.low || quality.lowVeg)) };
  const sunDir = V3(-0.7, 0.3, -0.65).normalize();
  floraMaterials(); mark('textures'); await tick();
  const root = new THREE.Group(); root.name = 'forestSet';
  const terrain = buildTerrain(q); root.add(terrain.group); mark('terrain'); await tick();
  const water = buildWater();
  const camp = buildCamp(mats, heightAt, q); mark('camp'); await tick();
  const campWood = buildCampWood(q); mark('campWood'); await tick();
  const trail = buildTrailWood(q, sunDir); mark('trail'); await tick();
  const ford = buildFord(q, sunDir); mark('ford'); await tick();
  const thicket = buildThicket(q, sunDir); mark('thicket'); await tick();
  const oldwood = buildOldwood(q, sunDir); mark('oldwood'); await tick();
  const cliff = buildCliffFoot(q, sunDir); mark('cliff'); await tick();
  const dell = buildDell(q, sunDir); mark('dell'); await tick();
  const basin = buildBasin(q); mark('basin');

  const G = name => { const g = new THREE.Group(); g.name = name; return g; };
  // the near woods as cards, standing in for the full trees from the air
  const lodOf = (list, seed, name) => { const g = createCardForest(list, { groundAt: heightAt, seed, shadows: false }).group; g.name = 'lodCards-' + name; g.visible = false; return g; };
  const lod = {
    camp: lodOf(campWood.cardList, 23, 'camp'), dell: lodOf(dell.cardList, 31, 'dell'),
    // the whole way (trail, ford, thicket, old wood, cliff) as one card forest, shown from the air
    way: lodOf([...trail.cardList, ...ford.cardList, ...thicket.cardList, ...oldwood.cardList, ...cliff.cardList], 29, 'way'),
  };
  const groups = {
    camp: G('set-camp'), trail: G('set-trail'), ford: G('set-ford'), thicket: G('set-thicket'), oldwood: G('set-oldwood'), cliff: G('set-cliff'), dell: G('set-dell'),
    water: G('set-water'), canopy: G('set-canopy'), backdrop: G('set-backdrop'), terrain: terrain.group,
  };
  groups.camp.add(camp.group, campWood.group);
  groups.water.add(water.group);
  groups.trail.add(trail.group);
  groups.ford.add(ford.group);
  groups.thicket.add(thicket.group);
  groups.oldwood.add(oldwood.group);
  groups.cliff.add(cliff.group);
  groups.dell.add(dell.group);
  groups.canopy.add(basin.cards.group, basin.shell.mesh, basin.mist.group, ...Object.values(lod));
  groups.backdrop.add(basin.karst.group, basin.wall.group);
  for (const k of ['camp', 'water', 'trail', 'ford', 'thicket', 'oldwood', 'cliff', 'dell', 'canopy', 'backdrop']) root.add(groups[k]);

  // the camp fire (driven by the engine: fx.setFire(0..1))
  const fireP = V3(P.FIRE[0], heightAt(...P.FIRE) + 0.12, P.FIRE[1]);
  let fire = null, smoke = null;
  try {
    fire = createFire([{ p: fireP, s: 0.55 }, { p: fireP.clone().add(V3(0.15, 0, -0.1)), s: 0.4 }], 40);
    smoke = createSmoke([{ p: fireP.clone().add(V3(0, 0.5, 0)), s: 0.2 }], { count: 50, color: [0.62, 0.62, 0.64], glow: [1, 0.4, 0.1], height: 9, spread: 1.2, size: [0.4, 3.0], speed: [0.04, 0.08], alpha: 0.28, wind: [1.5, 0.5] });
    groups.camp.add(fire.mesh, smoke.mesh);
  } catch (e) { console.warn('forest-set: fire fx unavailable', e); }
  // (in the root, not the camp's group, which is hidden by distance: a light coming and going recompiles every lit
  // material)
  const light = new THREE.PointLight(0xff8a3a, 0, 14, 1.6);
  light.position.copy(fireP).add(V3(0, 0.6, 0));
  root.add(light);
  const fx = {
    fire, smoke, light,
    setFire(k, time = 0) {
      if (fire) { fire.uniforms.uAmt.value = k; fire.mesh.visible = k > 0.01; }
      if (smoke) { smoke.uniforms.uAmt.value = k > 0 ? 1 : 0; smoke.mesh.visible = k > 0.01; }
      light.intensity = k * (6 + Math.sin(time * 9) * 1.5);
    },
  };
  fx.setFire(0);

  // anchors (world space)
  const at = (xz, dy = 0) => V3(xz[0], heightAt(xz[0], xz[1]) + dy, xz[1]);
  const tree = dell.tree, crystal = dell.crystal;
  const journeyAt = s => { const [x, z] = trailPoint(s), [dx, dz] = trailDir(s); return { pos: V3(x, walkY(x, z), z), dir: V3(dx, 0, dz) }; };
  const anchors = {
    CAMP: at(P.CAMP), ROCK: at(P.ROCK), FIRE: at(P.FIRE), HOME: at(P.HOME), TALLY: at(P.TALLY), tallyFace: camp.tallyFace,
    notch: i => { const n = camp.notches[Math.max(1, Math.min(6, Math.round(i))) - 1]; return { pos: n.pos.clone(), normal: n.normal.clone() }; },
    TARGET: at(P.TARGET), RANGE: at(P.RANGE), BULL: camp.target.bull.clone(), targetN: camp.target.normal.clone(), MEDITATE: at(P.MEDITATE), BIGPINE: at(P.BIGPINE), MAPLE1: at(P.MAPLE1), POOL: V3(P.POOL[0], waterY(P.POOL[1]), P.POOL[1]), MEMORIAL: at(P.MEMORIAL),
    rockFace: camp.rockFace,
    // the journey: control points (ground) of a centripetal Catmull-Rom, its length, a ground-true sampler, waypoints
    JOURNEY: P.JOURNEY.map(p => at(p)),
    journey: { length: JOURNEY_LEN, at: journeyAt, s: { FORD: S.FORD, CROSSING: ford.crossing.s, THICKET: S.THICKET, OLDWOOD: S.OLDWOOD, CLIFF: S.CLIFF, RIM: S.RIM, LAND: S.LAND } },
    FORD: at(P.FORD), THICKET: at(P.THICKET), OLDWOOD: at(P.OLDWOOD), CLIFF: at(P.CLIFF), RIM: at(P.RIM), LAND: at(P.LAND),
    fordStones: ford.crossing.stones,
    CLIFF_POOL: V3(P.CLIFF_POOL[0], waterAt(0), P.CLIFF_POOL[1]),
    // the dell
    EDGE: at(P.EDGE), DELL: at(P.DELL), ANCIENT: at(P.ANCIENT), treeAnchors: tree.anchors,
    // the scroll in its crystal: rest pose for relic.js's scroll (group position + quaternion; roll axis), the point
    // his hand goes to, the crystal's middle
    scrollPose: { position: crystal.scrollPose.position.clone(), quaternion: crystal.scrollPose.quaternion.clone(), axis: crystal.scrollPose.axis.clone(), center: crystal.scrollPose.center.clone() },
    scrollSpot: crystal.scrollPose.center.clone(), scrollDir: crystal.scrollPose.axis.clone(), crystalTouch: crystal.touchPoint.clone(),
    waterfalls: [
      { name: 'cliff', top: basin.wall.fall.top.clone(), bottom: basin.wall.fall.bottom.clone() },
      { name: 'dell', top: dell.fall.top.clone(), bottom: dell.fall.bottom.clone() },
      ...basin.karst.waterfalls.map((w, i) => ({ name: ['north', 'wnw', 'nnw'][i] || 'karst' + i, top: w.top.clone(), bottom: w.bottom.clone() })),
    ],
    // legacy (round 3: the hunt beside the camp)
    TRAIL: P.TRAIL.map(p => at(p)), SHOT: at(P.SHOT), BOAR: at(P.BOAR),
    streamX, meditateGap: V3(MED_DIR[0], 0, MED_DIR[1]), walkY,
  };

  // regions along the way: [group, near trees, lod cards, arc-length window in which they are drawn from the ground,
  // centre (for distance tests)]
  const mid = s => at(trailPoint(s));
  const R = {
    trail: { g: groups.trail, win: [-80, TRAIL_END + 72], c: mid(60) },
    ford: { g: groups.ford, win: [40, 232], c: mid(150) },
    thicket: { g: groups.thicket, win: [128, 300], c: mid(220) },
    oldwood: { g: groups.oldwood, win: [200, 430], c: mid(300) },
    cliff: { g: groups.cliff, win: [285, 1e9], c: mid(372) },
  };
  // per-frame: distance LOD of the small ground cover, sunbeams follow the sun
  const covers = [
    { g: campWood.cover, c: anchors.CAMP, r: 95 }, { g: trail.cover, c: mid(60), r: 110 }, { g: ford.cover, c: mid(150), r: 105 },
    { g: thicket.cover, c: mid(220), r: 95 }, { g: oldwood.cover, c: mid(300), r: 110 }, { g: cliff.cover, c: mid(372), r: 95 }, { g: dell.cover, c: anchors.DELL, r: 85 },
    { g: campWood.rocks, c: anchors.CAMP, r: 170 }, { g: trail.rocks, c: mid(60), r: 170 }, { g: ford.rocks, c: mid(150), r: 170 },
    { g: thicket.rocks, c: mid(220), r: 150 }, { g: oldwood.rocks, c: mid(300), r: 170 }, { g: cliff.rocks, c: mid(372), r: 200 }, { g: dell.rocks, c: anchors.DELL, r: 220 },
  ];
  const shaftSets = [[trail.shafts, 0.35], [dell.shafts, 0.85], [ford.shafts, 0.32], [thicket.shafts, 0.3], [oldwood.shafts, 0.42], [cliff.shafts, 0.36]];
  const trailMid = mid(60);
  // everything that casts a shadow: switched off from the air (the sun's shadow box then covers a speck of the view)
  const casters = [];
  root.traverse(o => { if (o.isMesh && o.castShadow) casters.push(o); });
  let castOn = true;
  const dellRimY = DELL_FLOOR + 6.5;
  const update = (time, camera) => {
    if (camera) {
      const cp = camera.position;
      for (const c of covers) c.g.visible = cp.distanceTo(c.c) < c.r;
      const agl = cp.y - heightAt(cp.x, cp.z);
      const flying = agl > 16;
      // where along the way the camera is (when it is near the way at all)
      const tr = trailDist(cp.x, cp.z), onWay = tr.d < 60, sc = tr.s;
      // down in the dell: nothing but the dell, the cliff and the sky over the rim
      const inBowl = !flying && Math.hypot(cp.x - P.DELL[0], cp.z - P.DELL[1]) < 27 && cp.y < dellRimY;
      groups.dell.visible = flying || cp.distanceTo(anchors.DELL) < 80 || (onWay && sc > 362);
      groups.camp.visible = flying || cp.distanceTo(anchors.CAMP) < 115;
      // the regions of the way: drawn whole within their window along it, as one card forest from the air
      for (const k in R) {
        const g = R[k];
        g.g.visible = !flying && !inBowl && (onWay ? sc > g.win[0] && sc < g.win[1] : cp.distanceTo(g.c) < 150);
      }
      lod.way.visible = flying;
      if (inBowl) { groups.camp.visible = false; groups.trail.visible = false; }
      terrain.update(camera, flying);
      // from the air: bark and stone painted as masses by the ink pass, mist lying in the hollows, no shadow pass,
      // the near woods as cards (the ancient tree stays itself: it is where the gold thread falls)
      FL_AIR.value = smooth(22, 40, agl);
      basin.lowMist.material.uniforms.uA.value = 0.55 * smooth(16, 42, agl);
      basin.lowMist.group.visible = agl > 16;
      const cast = agl < 28;
      if (cast !== castOn) { castOn = cast; for (const m of casters) m.castShadow = cast; }
      const cardsCamp = agl > 30 && cp.distanceTo(anchors.CAMP) > 42;
      campWood.trees.visible = !cardsCamp; lod.camp.visible = cardsCamp && groups.camp.visible;
      const cardsDell = agl > 24 && cp.distanceTo(anchors.DELL) > 60;
      dell.detail.visible = !cardsDell; lod.dell.visible = cardsDell && groups.dell.visible;
    }
    for (const [s] of shaftSets) s.uniforms.uDir.value.copy(FOGU.cfFogSunDir.value).normalize().negate();
  };
  mark('total');
  console.log('[forest-set] built in', times.total, 'ms', JSON.stringify(times));
  return {
    root, heightAt, walkY, maskAt, anchors, update, groups, fx, times, crystal, fungi: FUNGI,
    shafts: { trail: trail.shafts, dell: dell.shafts, ford: ford.shafts, thicket: thicket.shafts, oldwood: oldwood.shafts, cliff: cliff.shafts, setIntensity(k) { for (const [s, b] of shaftSets) s.uniforms.uI.value = b * k; } },
    // the height fog's floor under the camera: the ground rises ~10 m from the camp to the dell (whose floor then
    // lies 8 m under it, as it did beside the camp)
    fogFloorAt: (x, z) => 10 * smooth(20, 430, riseT(x, z)) + 2.2 * Math.exp(-((x - P.DELL[0]) ** 2 + (z - P.DELL[1]) ** 2) / 7200),
    // how deep into the old forest a point is (0 by the camp, 1 from the old wood on): for palettes along the way
    oldK,
    regions: R, lod, tree, fogFloor: 0, sunDirHint: sunDir, wall: basin.wall,
  };
}
