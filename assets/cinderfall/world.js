// Assemble Cinderfall Hamlet and its valley from the layout.
import * as THREE from 'three';
import { Kit, M, mul, mbox, mcyl } from './geo.js';
import { applyDepth, SIGN_CELLS } from './materials.js';
import { buildHouse, buildGate, buildBridge, bridgeProfile } from './architecture.js';
import * as P from './props.js';
import * as V from './vegetation.js';
import { buildWeaponStall } from './weapons.js';
import { buildStreet } from './street.js';
import * as RS from './roadside.js';
import { createButterflies } from './butterflies.js';
import { createTerrain, createGrass, createFlowers } from './terrain.js';
import { createRiver, RIVER_ROCKS } from './river.js';
import { createClumps, createBerries } from './decor.js';
import { createPaddies, createWaterwheel, buildFarmstead, buildFishing, terraceLevel, levelY, paddyState, ox as buildOx } from './farm.js';
import { makePerson, VILLAGER_COLORS } from './people3d.js';
import { makeWolf } from './wolf.js';
import { HOUSES, housePlacement, backRow, backPlacement, heightAt, roadX, roadY, GATE_Z, BRIDGE_Z, streamZ, FOREST_EDGE_Z, GIANT_TREE, fieldMask, groundMask, riverZ, riverY, riverHalfW, riverD } from './layout.js';
import { rng, lerp, smooth, fbm } from './util.js';
import { CRAG } from './sect.js';

// where he kneels for the mushrooms and the camera looks over his shoulder at them: kept clear of tall growth
// (a capsule on the ground south of the cluster at MUSH; see engine.js mushSpot / mushCam)
const MUSH = { x: roadX(-157) + 4.2, z: -157 };
const MUSH_CLEAR = [MUSH.x - 0.4, MUSH.z + 0.9, MUSH.x + 1.15, MUSH.z + 2.45, 1.0];
function mushClear(x, z, pad = 0) {
  const [x0, z0, x1, z1, r] = MUSH_CLEAR, dx = x1 - x0, dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - x0 - dx * t, z - z0 - dz * t) < r + pad;
}

export function buildWorld(mats, quality) {
  const rand = rng(2024);
  const kit = new Kit();
  const root = new THREE.Group();
  const anchors = { houses: {}, fire: [], smoke: [], firewood: [], steam: [], chimney: [], sparks: null, crystal: null, shrine: null, gate: null, forest: [] };
  const rects = [];
  const avoid = (x, z) => rects.some(r => x > r[0] && x < r[1] && z > r[2] && z < r[3]);
  const g = (x, z) => heightAt(x, z);

  // ---------------------------------------------------------------- houses
  const all = [...HOUSES.map(h => ({ ...h, place: housePlacement(h) })), ...backRow(rand).map(h => ({ ...h, place: backPlacement(h) }))];
  const collapsing = new Set(['uncle', 'tea', 'east-h', 'wine', 'south-b']);
  for (const h of all) {
    if (collapsing.has(h.id)) h.collapse = h.id === 'uncle' ? { u: 0.53, v: 0.3, r: 0.34 } : { u: rand.range(0.3, 0.7), v: rand.range(0.35, 0.6), r: rand.range(0.18, 0.28) };
    const gy = Math.min(g(h.place.x, h.place.z), g(h.place.x + 3, h.place.z), g(h.place.x - 3, h.place.z));
    const a = buildHouse(kit, h, h.place, gy, rand);
    anchors.houses[h.id] = { ...a, def: h, groundY: gy };
    const ext = h.d / 2 + 2.6, extW = h.w / 2 + 1.0;
    rects.push([h.place.x - ext, h.place.x + ext, h.place.z - extW, h.place.z + extW]);
    decorate(kit, h, a, rand, anchors);
    // fire: houses ignite in a wave rolling down from the north end of the street
    const delay = h.id === 'uncle' ? 0.05 : Math.max(0, Math.min(0.55, (h.z + 40) / 260 + rand.range(-0.08, 0.12)));
    for (const f of a.fire) anchors.fire.push({ ...f, delay, house: h.id, burn: h.burn });
    anchors.smoke.push({ p: a.roofTop.clone(), s: 2.5, delay, house: h.id });
    if (!h.back && rand() < 0.5) anchors.chimney.push({ p: a.roofTop.clone().add(new THREE.Vector3(0, 0.5, 0)), s: 0.3 });
    if (!h.back || rand() < 0.5) P.rubble(kit, a.W, rand, h.w, h.d);
  }

  // the crag east of the village stands clear of trees
  rects.push([CRAG.x - 12, CRAG.x + 12, CRAG.z - 12, CRAG.z + 12]);
  // (and the farmstead, its pens and the fishermen's huts: see below)
  for (const r of [[33, 52, -60, -47], [21, 31, -56, -48], [26, 34, -64, -58], [40, 48, -66, -60], [16, 23, -67, -61], [16, 46, -80, -68]]) rects.push(r);
  // (and the roadside: the pavilion on the climb, the signpost and the boundary rope at the edge of the pines, the
  // woodcutters' place: see below)
  const PAV = { x: roadX(-121) - 8.2, z: -121 };
  rects.push([PAV.x - 3.2, PAV.x + 3.6, PAV.z - 3.2, PAV.z + 3.2]);
  const GUSH = { x: roadX(-146.5) - 2.9, z: -146.5 };
  const ROPE = [[roadX(-153) - 5.4, -153], [roadX(-158.5) - 6.0, -158.5]];
  const WOOD = { x: roadX(-148) + 6.0, z: -148 };
  rects.push([GUSH.x - 0.6, GUSH.x + 0.6, GUSH.z - 0.6, GUSH.z + 0.6], [WOOD.x - 1.2, WOOD.x + 3.4, WOOD.z - 2.6, WOOD.z + 1.4]);
  for (const [x, z] of ROPE) rects.push([x - 0.6, x + 0.6, z - 0.6, z + 0.6]);
  // ---------------------------------------------------------------- the street dressed: lantern strings, banners, market stalls, the flagstone way, the south gate
  const street = buildStreet(kit, rand, avoid);
  rects.push(...street.rects);
  for (const f of street.southGate.fire) anchors.fire.push({ ...f, delay: 0.4, house: 'gate-s', burn: 0.8 });
  // ---------------------------------------------------------------- the street: walls, plants, lanterns on poles
  for (let z = 90; z > GATE_Z + 4; z -= 7) {
    for (const side of [-1, 1]) {
      const x = roadX(z) + side * 4.4;
      if (avoid(x + side * 1.6, z)) continue;
      if (rand() < 0.5) P.jars(kit, M(x, 0, z, rand() * 6), rand, 2);
      else if (rand() < 0.5) V.bush(kit, x + side * 0.8, 0, z, rand.range(0.7, 1.1), rand, [0.6, 0.82, 0.55]);
    }
  }
  // stone walls lining the lanes between houses
  for (const [z0, z1, side] of [[84, 80, -1], [68, 64, 1], [50, 47, -1], [33, 30, 1], [18, 15, -1], [4, 0, 1], [-25, -28, 1], [-12, -16, -1]]) {
    const x0 = roadX(z0) + side * 6.6, x1 = roadX(z1) + side * 6.6;
    P.stoneWall(kit, [x0, z0], [x1, z1], g, 0.8);
  }
  // wish tree, well and a little plaza at the south end
  const treeP = { x: roadX(70) - 7.5, z: 70 };
  kit.add('stone', mcyl(2.6, 2.8, 0.55, 20), M(treeP.x, 0.27, treeP.z), { vis: 0 });
  const wish = V.broadleaf(kit, treeP.x, 0.5, treeP.z, 1.65, rand, { vis: 0, density: 1.2 });
  V.ribbons(kit, wish.hubs, rand);
  rects.push([treeP.x - 3, treeP.x + 3, treeP.z - 3, treeP.z + 3]);
  P.well(kit, M(roadX(60) + 4.6, 0, 60));
  rects.push([roadX(60) + 3.4, roadX(60) + 5.8, 58.8, 61.2]);
  P.bench(kit, M(treeP.x + 3.1, 0, treeP.z - 1.5, Math.PI / 2), 1.8);
  // gate, guard post flag, the road beyond
  const gate = buildGate(kit, roadX(GATE_Z), 0, GATE_Z, 0);
  anchors.gate = gate;
  for (const f of gate.fire) anchors.fire.push({ ...f, delay: 0.0, house: 'gate', burn: 0.8 });
  P.flagPole(kit, M(roadX(-34) - 5, 0, -36), 7, [0.65, 0.12, 0.08]);
  // fields, fences, the shrine and the bridge
  for (let z = -54; z > -126; z -= 9) {
    const x = roadX(z) - 3.4;
    P.fence(kit, [x, z], [roadX(z - 9) - 3.4, z - 9], g);
  }
  const shrineZ = -63, shrineX = roadX(shrineZ) + 4.2;
  anchors.shrine = P.shrine(kit, M(shrineX, g(shrineX, shrineZ), shrineZ, -Math.PI / 2 - 0.3), rand);
  rects.push([shrineX - 1.5, shrineX + 1.5, shrineZ - 1.5, shrineZ + 1.5]);
  // the stone bridge where the road crosses the river (its deck is what he walks on: anchors.bridge.deckY)
  let bz = BRIDGE_Z;
  for (let k = 0; k < 4; k++) bz = riverZ(roadX(bz));
  const dirAng = Math.atan2(roadX(bz - 4) - roadX(bz + 4), -8);
  {
    // (its deck meets the road where it actually ends, at the road's own height there)
    const L0 = bridgeProfile(riverY(roadX(bz))).L;
    const bridge = buildBridge(kit, roadX(bz), 0, bz, dirAng + Math.PI, roadY(bz - L0) + 0.08, roadY(bz + L0) + 0.08, riverY(roadX(bz)));
    anchors.bridge = { ...bridge, z: bz, x: roadX(bz) };
    for (const lp of bridge.lamps) P.lantern(kit, M(lp.x, lp.y, lp.z), { burn: 0.6, vis: 0, drop: 0.2 });
    rects.push([roadX(bz) - 4, roadX(bz) + 4, bz - bridge.L - 1, bz + bridge.L + 1]);
  }
  // scarecrow-ish drying frames in the fields
  for (let i = 0; i < 4; i++) {
    const z = -70 - i * 13, x = roadX(z) - rand.range(18, 40);
    if (fieldMask(x, z) < 0.5) continue;
    kit.add('timber', mbox(0.08, 1.8, 0.08), M(x, g(x, z) + 0.9, z), { vis: 0, color: 0.6 });
    kit.add('straw', mbox(1.6, 0.8, 0.5), M(x, g(x, z) + 1.4, z), { vis: 3, color: [1.1, 1, 0.8] });
  }

  // ---------------------------------------------------------------- vegetation
  // peach blossom and broadleaf among the houses
  for (let i = 0; i < 26; i++) {
    const z = rand.range(-40, 100), side = rand.sign();
    const x = roadX(z) + side * rand.range(15, 34);
    if (avoid(x, z)) continue;
    const blossom = rand() < 0.45;
    V.broadleaf(kit, x, g(x, z), z, rand.range(0.7, 1.05), rand, { tile: blossom ? 2 : 0, density: 0.8, vis: 0 });
    rects.push([x - 1, x + 1, z - 1, z + 1]);
  }
  // sculptural pines framing the street and the road
  for (const [z, off] of [[96, -9], [92, 12], [-48, 9], [-58, -12], [-104, 10], [-118, -9], [-134, 14], [-142, -6], [-147, 15]]) {
    const x = roadX(z) + off;
    V.pine(kit, x, g(x, z), z, rand.range(0.9, 1.25), rand, { vis: 0 });
  }
  // bamboo groves behind the houses
  for (const [z, side, d] of [[80, 1, 26], [52, -1, 28], [30, 1, 30], [8, -1, 27], [-20, 1, 28]]) {
    const x = roadX(z) + side * d;
    V.bamboo(kit, x, g(x, z), z, rand, quality.lowVeg ? 8 : 14, { vis: 0 });
  }
  // hillside trees around the valley
  const hill = quality.lowVeg ? 90 : 170;
  for (let i = 0; i < hill; i++) {
    const z = rand.range(-150, 190), side = rand.sign();
    const x = roadX(z) + side * rand.range(36, 150);
    if (avoid(x, z)) continue;
    const y = g(x, z);
    if (rand() < 0.55) V.tallPine(kit, x, y, z, rand.range(0.75, 1.0), rand, { density: 0.7 });
    else V.broadleaf(kit, x, y, z, rand.range(0.8, 1.2), rand, { density: 0.55, vis: 0, tint: rand() < 0.15 ? [1.0, 0.62, 0.42] : undefined });
  }
  // the pine forest beyond the edge of the path
  const forestN = quality.lowVeg ? 160 : 300;
  for (let i = 0; i < forestN; i++) {
    const z = rand.range(-152, -330);
    const x = roadX(Math.max(z, -224)) + rand.sign() * rand.range(3.8, 120) * (z < -260 ? 1.4 : 1);
    if (Math.hypot(x - GIANT_TREE.x, z - GIANT_TREE.z) < 14) continue;
    if (Math.abs(x - roadX(z)) < 3.5 && z > -226) continue;
    const y = g(x, z);
    if (z > -166 && Math.abs(x - roadX(z)) < 9) continue; // keep the edge open where he stands
    V.tallPine(kit, x, y, z, rand.range(0.8, 1.15), rand, { density: z < -240 ? 0.5 : 0.8 });
    if (rand() < 0.25) V.fern(kit, x + rand.range(-2, 2), y, z + rand.range(-2, 2), rand.range(0.8, 1.3), rand);
  }
  // (the ground behind where he kneels for the mushrooms is kept clear for the camera there: see MUSH_CLEAR)
  for (let i = 0; i < (quality.lowVeg ? 50 : 110); i++) {
    const z = rand.range(-150, -240);
    let x = roadX(z) + rand.sign() * rand.range(2.6, 16);
    if (mushClear(x, z, 0.6)) x = 2 * roadX(z) - x;
    V.fern(kit, x, g(x, z), z, rand.range(0.7, 1.4), rand);
  }
  // the old forest road: a dense colonnade of pines on both sides
  for (let i = 0; i < (quality.lowVeg ? 60 : 130); i++) {
    const z = rand.range(-164, -238), x = roadX(Math.max(z, -224)) + rand.sign() * rand.range(4.2, 28);
    if (Math.hypot(x - GIANT_TREE.x, z - GIANT_TREE.z) < 13) continue;
    V.tallPine(kit, x, g(x, z), z, rand.range(0.85, 1.2), rand, { density: 0.75 });
  }
  for (let i = 0; i < 26; i++) {
    const z = rand.range(-165, -235), x = roadX(Math.max(z, -224)) + rand.sign() * rand.range(3, 14);
    V.bush(kit, x, g(x, z), z, rand.range(0.8, 1.5), rand, [0.45, 0.62, 0.42], 0, 0);
  }
  for (let i = 0; i < 40; i++) {
    const z = rand.range(-150, -240), x = roadX(z) + rand.sign() * rand.range(3, 20);
    P.rock(kit, M(x, g(x, z), z), rand.range(0.4, 1.4), rand);
  }
  for (let i = 0; i < 30; i++) {
    const z = rand.range(-50, -140), x = roadX(z) + rand.sign() * rand.range(2.8, 10);
    if (riverD(x, z) < 1.5) continue;
    P.rock(kit, M(x, g(x, z), z), rand.range(0.3, 0.9), rand);
  }
  // the mushrooms he came for, in a shaft of light at the edge of the pines
  const mush = MUSH;
  V.mushrooms(kit, mush.x, g(mush.x, mush.z), mush.z, rand, 11);
  V.mushrooms(kit, mush.x - 1.4, g(mush.x - 1.4, mush.z - 1), mush.z - 1, rand, 6);
  P.rock(kit, M(mush.x + 1.0, g(mush.x + 1, mush.z - 0.6), mush.z - 0.6), 0.7, rand);
  // ferns round them (none on the near side, where he kneels and the camera looks over his shoulder: those go beyond)
  for (let i = 0; i < 9; i++) {
    let a = i / 9 * 6.28;
    const r0 = rand.range(1.1, 2.6);
    if (Math.cos(a - 1.6) > 0.35) a += Math.PI;
    V.fern(kit, mush.x + Math.cos(a) * r0, g(mush.x + Math.cos(a) * r0, mush.z + Math.sin(a) * r0), mush.z + Math.sin(a) * r0, rand.range(0.8, 1.3), rand);
  }
  V.tallPine(kit, mush.x + 2.2, g(mush.x + 2.2, mush.z - 3), mush.z - 3, 1.05, rand, {});
  anchors.mushrooms = new THREE.Vector3(mush.x, g(mush.x, mush.z), mush.z);
  // the roadside: a pavilion to rest in on the climb to the pines; where the road goes in under them, the signpost
  // (古松, the old pines); across the old way west, the boundary rope and its board (禁); the woodcutters' place
  RS.pavilion(kit, PAV.x, PAV.z, Math.PI / 2, rand);
  RS.signpost(kit, GUSH.x, GUSH.z, 0.25, SIGN_CELLS['古松']);
  RS.boundary(kit, ROPE[0], ROPE[1], rand);
  RS.woodcut(kit, WOOD.x, WOOD.z, 0.4, rand);
  for (const [dz, off, r0, axe] of [[-151, -9.5, 0.34, false], [-163, 7.2, 0.4, false], [-170, -5.2, 0.3, true], [-160, 11.2, 0.36, false], [-176, 9.5, 0.45, false]]) RS.stump(kit, roadX(dz) + off, dz, r0, rand, axe);
  RS.log(kit, roadX(-166) - 8.2, -166, 6.2, 0.32, 0.9, rand);
  RS.log(kit, roadX(-173) + 9.4, -173, 5.0, 0.28, -0.4, rand);
  // the ancient tree
  const gt = { x: GIANT_TREE.x, z: GIANT_TREE.z, y: g(GIANT_TREE.x, GIANT_TREE.z) };
  V.giantTree(kit, gt.x, gt.y, gt.z, rand);
  anchors.giantTree = new THREE.Vector3(gt.x, gt.y, gt.z);
  // bushes along the road outside the village
  const berryBushes = [];
  for (let i = 0; i < 50; i++) {
    const z = rand.range(-46, -150), x = roadX(z) + rand.sign() * rand.range(3, 12);
    if (fieldMask(x, z) > 0.3 || avoid(x, z) || riverD(x, z) < 2) continue;
    const s = rand.range(0.6, 1.1);
    V.bush(kit, x, g(x, z), z, s, rand, [0.62, 0.8, 0.52], 0, 0);
    // (about half of them bearing: raspberries, blueberries, mulberries)
    if (rand() < 0.55) berryBushes.push({ x, z, y: g(x, z), r: 0.82 * s, h: g(x, z) + 0.5 * s + 0.7 * s, kind: rand.pick(['red', 'red', 'blue', 'black', 'orange']) });
  }

  // ---------------------------------------------------------------- the river's banks
  // boulders standing in the stream (the water's foam rings them: see RIVER_ROCKS), more along the banks, pebbles
  // at the waterline
  for (const [x, f, r0] of RIVER_ROCKS) {
    const z = riverZ(x) + f * riverHalfW(x);
    P.rock(kit, M(x, riverY(x) - r0 * 0.55, z), r0 * 1.15, rand, true);
  }
  for (let i = 0; i < 70; i++) {
    const x = rand.range(-150, 160), side = rand.sign(), hw = riverHalfW(x);
    if (Math.abs(x - roadX(BRIDGE_Z)) < 9) continue;
    const z = riverZ(x) + side * (hw + rand.range(-0.6, 2.0));
    P.rock(kit, M(x, g(x, z) - 0.15, z), rand.range(0.35, 1.0), rand, rand() < 0.6);
  }
  for (let i = 0; i < 220; i++) {
    const x = rand.range(-120, 140), side = rand.sign(), hw = riverHalfW(x);
    const z = riverZ(x) + side * (hw + rand.range(-0.9, 0.5));
    if (Math.abs(x - roadX(BRIDGE_Z)) < 4) continue;
    P.rock(kit, M(x, Math.max(g(x, z), riverY(x) - 0.12) - 0.05, z), rand.range(0.1, 0.24), rand, false);
  }
  // stepping stones across the slack water downstream
  for (let k = 0; k < 9; k++) {
    const x = 50 + Math.sin(k * 1.3) * 0.6, hw = riverHalfW(x), z = riverZ(x) - hw + (k + 0.5) * (2 * hw / 9);
    kit.add('stone', new THREE.CylinderGeometry(0.42, 0.5, 0.5, 9), M(x, riverY(x) - 0.05, z, rand() * 6), { vis: 0, color: [0.82, 0.8, 0.74] });
  }

  // ---------------------------------------------------------------- the farmstead east of the road, the fishermen below the bridge
  const farmstead = buildFarmstead(kit, rand);
  const fishing = buildFishing(kit, rand);
  anchors.chimney.push(...farmstead.chimney.map(p => ({ p, s: 0.35 })), ...fishing.chimney.map(p => ({ p, s: 0.25 })));
  // a water buffalo at the plough in a flooded paddy beside the road
  {
    let spot = null;
    for (let z = -60; z > -80 && !spot; z -= 1) for (let x = roadX(z) - 16; x > roadX(z) - 30 && !spot; x -= 1) {
      const L = terraceLevel(x, z);
      if (L >= 0 && paddyState(L) === 0 && terraceLevel(x + 2.5, z) === L && terraceLevel(x - 2.5, z) === L && terraceLevel(x, z + 2) === L && terraceLevel(x, z - 2) === L) spot = [x, levelY(L), z];
    }
    if (spot) {
      buildOx(kit, M(spot[0], spot[1] - 0.25, spot[2], 0.3), rand);
      // the plough behind it
      kit.add('timber', mbox(0.08, 0.08, 2.4), M(spot[0] - 1.9, spot[1] + 0.7, spot[2] - 0.55, 0.3, 0.35), { vis: 0, color: 0.5 });
      kit.add('timber', mbox(0.1, 0.9, 0.1), M(spot[0] - 2.9, spot[1] + 0.35, spot[2] - 0.85, 0.3, -0.4), { vis: 0, color: 0.5 });
      anchors.plough = new THREE.Vector3(spot[0] - 3.4, spot[1], spot[2] - 1.0);
    }
  }

  // ---------------------------------------------------------------- uncle's interior and the night's collapse
  const U0 = anchors.houses.uncle;
  buildUncleInterior(kit, U0, rand);

  const meshes = kit.build(mats);
  applyDepth(meshes, mats);
  for (const m of meshes) root.add(m);
  const terrain = createTerrain(mats, quality);
  root.add(terrain);
  const river = createRiver(quality);
  root.add(river.group);
  const stream = river.water;
  const grass = createGrass(quality, avoid);
  root.add(grass);
  for (const f of createFlowers(quality, avoid)) root.add(f);
  // butterflies over the flower drifts by the road, in the gardens, round the wish tree and in the glade by the pines
  let butterflies = null;
  {
    const br = rng(808), spots = [];
    for (let t = 0; t < 4000 && spots.length < (quality.lowVeg ? 30 : 64); t++) {
      const z = br.range(-150, 95), x = roadX(z) + br.sign() * br.range(2.8, 16);
      const m = groundMask(x, z);
      if (m[0] > 0.3 || m[1] > 0.1 || avoid(x, z) || riverD(x, z) < 1.5) continue;
      if (fbm(x * 0.08, z * 0.08, 2) < 0.5) continue;
      spots.push({ x, y: g(x, z), z });
    }
    spots.push({ x: treeP.x + 2, y: 0.4, z: treeP.z + 1 }, { x: mush.x - 1.8, y: g(mush.x - 1.8, mush.z + 0.6), z: mush.z + 0.6 });
    const bf = createButterflies(spots);
    root.add(bf.mesh);
    butterflies = bf.mesh;
  }

  // ---------------------------------------------------------------- the paddies and the waterwheel that waters them
  const paddies = createPaddies(quality);
  root.add(paddies.mesh);
  root.add(createClumps('rice', paddies.near, { seed: 5, name: 'rice' }));
  root.add(createClumps('meadow', paddies.bund, { seed: 41, name: 'bund' }));
  const waterwheel = createWaterwheel(mats);
  root.add(waterwheel.group);

  // ---------------------------------------------------------------- everywhere: reeds, tall grass, meadow grass, berries
  {
    const dr = rng(515);
    const low = quality.lowVeg;
    const ok = (x, z, pad = 0) => { const m = groundMask(x, z); return m[0] < 0.3 && m[1] < 0.1 && !avoid(x, z) && riverD(x, z) > pad && !mushClear(x, z, 0.4); };
    // reeds and cattails crowding the banks (not at the bridge, not under the fall)
    const reeds = [];
    for (let i = 0; i < (low ? 1400 : 3200) * 3 && reeds.length < (low ? 1400 : 3200); i++) {
      const x = dr.range(-140, 170);
      if (Math.abs(x - roadX(BRIDGE_Z)) < 6.5) continue;
      const hw = riverHalfW(x), side = dr.sign();
      const d = dr.range(-1.3, 1.6);
      // (in stands, thinning out where the current runs fast)
      if (Math.sin(x * 0.09 + side * 2.1) + Math.sin(x * 0.23) * 0.5 < -0.2) continue;
      const z = riverZ(x) + side * (hw + d);
      reeds.push({ x, z, y: Math.max(g(x, z), riverY(x) - 0.25), s: dr.range(0.75, 1.25), c: dr() < 0.3 ? [0.5, 0.52, 0.22] : [0.3, 0.44, 0.16] });
    }
    root.add(createClumps('reed', reeds, { seed: 11 }));
    // tall silvergrass: field edges, the slopes, the meadow by the pines, along the river above its banks
    const tall = [];
    for (let i = 0; i < (low ? 1600 : 4200) * 4 && tall.length < (low ? 1600 : 4200); i++) {
      const z = dr.range(-200, 130), x = roadX(z) + dr.sign() * dr.range(4, 90);
      if (!ok(x, z, 1.6)) continue;
      // (in drifts)
      if (fbm(x * 0.045 + 3, z * 0.045, 2) < 0.53) continue;
      if (fieldMask(x, z) > 0.2 && fieldMask(x, z) < 0.85) { /* the terraces' edges */ } else if (fieldMask(x, z) >= 0.85) continue;
      tall.push({ x, z, y: g(x, z), s: dr.range(0.7, 1.25), c: dr() < 0.35 ? [0.55, 0.55, 0.28] : [0.36, 0.5, 0.18] });
    }
    root.add(createClumps('tall', tall, { seed: 23 }));
    // meadow grass between the short turf and the tall drifts
    const meadow = [];
    for (let i = 0; i < (low ? 3000 : 8000) * 3 && meadow.length < (low ? 3000 : 8000); i++) {
      const z = dr.range(-215, 125), x = roadX(z) + dr.sign() * (dr() < 0.7 ? dr.range(2.4, 24) : dr.range(24, 80));
      if (!ok(x, z, 0.8) || fieldMask(x, z) > 0.5) continue;
      if (fbm(x * 0.07 + 9, z * 0.07, 2) < 0.45) continue;
      meadow.push({ x, z, y: g(x, z), s: dr.range(0.7, 1.3), c: dr() < 0.2 ? [0.6, 0.6, 0.3] : dr() < 0.6 ? [0.34, 0.54, 0.17] : [0.28, 0.47, 0.14] });
    }
    root.add(createClumps('meadow', meadow, { seed: 37 }));
    root.add(createBerries(berryBushes));
  }

  // ---------------------------------------------------------------- people
  const cast = buildCast(anchors, rand);
  for (const c of cast.all) root.add(c.root);
  const wolves = Array.from({ length: 6 }, (_, i) => makeWolf(31 + i, i === 0 ? 1.2 : 1));
  for (const w of wolves) root.add(w.root);

  return { root, anchors, meshes, terrain, grass, stream, river, paddies, waterwheel, cast, wolves, avoid, butterflies };
}

// where the uncle sits by day: a bench against the front wall under the window, right of the door (house-local x,
// and z from the front wall)
const UNCLE_SEAT = { x: 2.55, z: 0.55 };
// the eater's bench at the bun stall (house-local, z from the front wall: the stall stands at d/2 + 0.2)
const EATER_SEAT = { x: -3.5, z: 1.0 };

function decorate(kit, h, a, rand, anchors) {
  const { W, frame } = a;
  const { w, d, pd, plat } = frame;
  const L = (x, y, z) => mul(W, M(x, y, z));
  const burn = h.burn ?? 1;
  if (h.style === 'guard') { anchors.crystal = a.crystal; return; }
  const eaveY = a.eave ? a.eave(d / 2 + pd - 0.1) : plat + 3;
  // (the smith's porch is his stall: the usual things on a porch would stand in the middle of his wares, so they go
  // nowhere there; the draws are still made, so every other house keeps what it had)
  const dk = h.style === 'forge' ? { add() { return this; } } : kit;
  // lanterns
  if (!h.back || rand() < 0.3) for (const sx of [-1, 1]) P.lantern(dk, L(sx * (w / 2 - 0.4), eaveY - 0.05, d / 2 + pd - 0.25), { burn, color: rand() < 0.15 ? [0.95, 0.8, 0.5] : [0.85, 0.14, 0.08] });
  if (h.style === 'forge') for (const sx of [-1, 1]) P.lantern(kit, L(sx * 0.62, eaveY - 0.05, d / 2 + pd - 0.3), { burn, color: [0.85, 0.14, 0.08] });
  if (!h.back && h.style !== 'forge' && h.style !== 'shop') P.couplets(kit, L(0, plat, d / 2 + 0.07), h.style === 'herbal' ? 2.0 : 1.75, 2.35, burn);
  if (h.back) {
    if (h.laundry) P.laundry(kit, L(0, 0, d / 2 + pd + 1.25), w * 0.6, rand, burn);
    if (rand() < 0.5) P.firewood(kit, L(w / 2 + 0.6, plat, -d / 4), rand, burn, 14);
    return;
  }
  // chilli and corn strings, herb bundles
  for (let i = 0; i < 4; i++) {
    const x = lerp(-w / 2 + 0.6, w / 2 - 0.6, rand());
    if (Math.abs(x) < 1.3) continue;
    P.hangingString(dk, L(x, eaveY - 0.08, d / 2 + pd - 0.5), rand() < 0.6 ? 'chilli' : 'corn', rand.range(0.7, 1.3), rand, burn);
  }
  if (h.herbs) {
    P.herbRack(kit, L(-w / 2 + 1.3, plat, d / 2 + pd * 0.55), rand, burn);
    for (let i = 0; i < 6; i++) P.herbBundle(kit, L(lerp(1.4, w / 2 - 0.5, rand()), eaveY - 0.1, d / 2 + 0.6 + rand() * 0.5), rand, burn);
  }
  // (the line stands in the street in front of the terrace; its posts clear of the steps)
  if (h.laundry) P.laundry(kit, L(0, 0, d / 2 + pd + 1.45), Math.min(w - 1.5, 5.5), rand, burn);
  P.firewood(kit, L(w / 2 + 0.75, plat, -d / 4), rand, burn);
  P.jars(dk, L(w / 2 - 0.9, plat, d / 2 + pd - 0.5), rand, 3);
  P.basket(dk, L(-w / 2 + 0.7, plat, d / 2 + 0.6), rand, rand() < 0.5 ? [0.85, 0.35, 0.15] : [0.55, 0.7, 0.3]);
  const benchHere = rand() < 0.6;
  if (h.uncle) P.bench(kit, mul(W, M(UNCLE_SEAT.x, plat, d / 2 + UNCLE_SEAT.z)), 1.5, burn);
  else if (benchHere) P.bench(dk, mul(W, M(w / 2 - 1.6, plat, d / 2 + 0.55)), 1.5, burn);
  if (rand() < 0.5) P.barrel(kit, L(-w / 2 - 0.5, plat, d / 3), burn);
  // flower pots along the terrace edge
  for (let i = 0; i < 3; i++) {
    const x = lerp(-w / 2 + 0.5, w / 2 - 0.5, (i + 0.5) / 3) + rand.range(-0.3, 0.3);
    if (Math.abs(x) < 1.6) continue;
    dk.add('pottery', mcyl(0.2, 0.15, 0.3, 10), L(x, plat + 0.15, d / 2 + pd + 0.35), { vis: 3, color: [0.55, 0.3, 0.2] });
    const bp = new THREE.Vector3(x, plat + 0.05, d / 2 + pd + 0.35).applyMatrix4(W);
    const blossom = rand() < 0.5;
    V.bush(dk, bp.x, bp.y, bp.z, 0.42, rand, blossom ? [1, 1, 1] : [0.75, 0.95, 0.65], blossom ? 2 : 0, 3);
  }
  if (h.style === 'forge') {
    anchors.sparks = P.forge(kit, mul(W, M(0, plat, 0.6)), rand);
    // the smith's wares set out under the porch in front of the forge (only he sees what is in them: see weapons.js)
    const porchZ = d / 2 + pd - 0.15;
    const beamY = (a.eave ? a.eave(porchZ) : plat + 2.43) + 0.02 - plat;
    const stall = buildWeaponStall(kit, mul(W, M(0, plat, d / 2)), rand, { beamY, porchZ: porchZ - d / 2, posts: [-w / 2, 0, w / 2] });
    anchors.auras = stall.auras;
    anchors.stall = stall.anchor;
    anchors.stallWall = stall.wall;
    anchors.stallFill = stall.fill;
  }
  if (h.style === 'shop') { P.stall(kit, mul(W, M(0, plat, d / 2 + 0.2)), rand, burn); anchors.steam.push({ p: new THREE.Vector3(-0.1, plat + 1.7, d / 2 + 0.2).applyMatrix4(W), s: 0.5 }); }
  if (h.sign === '酒') { P.wineJars(kit, mul(W, M(-w / 2 + 2, plat, d / 2 + pd * 0.5)), rand); P.flagPole(kit, mul(W, M(w / 2 + 0.6, plat, d / 2 + pd)), 6.5, [0.85, 0.75, 0.55]); }
  if (h.sign === '茶') P.flagPole(kit, mul(W, M(-w / 2 - 0.4, plat, d / 2 + pd)), 6, [0.25, 0.4, 0.35]);
}

function buildUncleInterior(kit, A, rand) {
  const { W, frame } = A;
  const { w, d, plat } = frame;
  const L = (x, y, z, ry = 0, rx = 0, rz = 0) => mul(W, M(x, y, z, ry, rx, rz));
  // medicine cabinet: a wall of small drawers
  const cw = 3.6, ch = 2.3;
  kit.add('timber', mbox(cw, ch, 0.5), L(-0.6, plat + ch / 2, -d / 2 + 0.45), { burn: 1, vis: 0, color: 0.55 });
  for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) {
    kit.add('plank', mbox(0.36, 0.29, 0.04), L(-0.6 - cw / 2 + 0.22 + i * 0.395, plat + 0.25 + j * 0.31, -d / 2 + 0.72), { burn: 1, vis: 0, color: 0.78 });
    kit.add('metal', mbox(0.05, 0.03, 0.04), L(-0.6 - cw / 2 + 0.22 + i * 0.395, plat + 0.25 + j * 0.31, -d / 2 + 0.76), { vis: 0, color: [0.8, 0.6, 0.3] });
  }
  // counter with scales, shelves with jars, hanging herbs
  kit.add('plank', mbox(2.6, 0.95, 0.7), L(1.6, plat + 0.47, -0.4, 0.1), { burn: 1, vis: 0, color: 0.6 });
  kit.add('plank', mbox(2.8, 0.06, 0.8), L(1.6, plat + 0.96, -0.4, 0.1), { burn: 1, vis: 0, color: 0.8 });
  kit.add('metal', mcyl(0.12, 0.12, 0.02, 10), L(1.2, plat + 1.05, -0.4), { vis: 0, color: [0.8, 0.6, 0.3] });
  for (let s = 0; s < 3; s++) {
    kit.add('plank', mbox(1.6, 0.05, 0.4), L(w / 2 - 1.1, plat + 0.9 + s * 0.6, -d / 2 + 0.6), { burn: 1, vis: 0, color: 0.7 });
    P.jars(kit, L(w / 2 - 1.1, plat + 0.93 + s * 0.6, -d / 2 + 0.6, 0, 0, 0), rand, 3, 1);
  }
  for (let i = 0; i < 10; i++) P.herbBundle(kit, L(rand.range(-w / 2 + 0.6, w / 2 - 0.6), plat + 2.75, rand.range(-d / 2 + 1, d / 2 - 1)), rand, 1);
  kit.add('straw', mbox(2.0, 0.05, 1.2), L(-2.2, plat + 0.05, 1.0, 0.2), { burn: 1, vis: 0 });
  // the night: the roof gave way over the room; a beam came down across him
  const beamAt = (a, b, t, color = 0.45) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const m = new THREE.Matrix4().lookAt(A, B, new THREE.Vector3(0, 1, 0));
    m.setPosition(A.clone().lerp(B, 0.5));
    kit.add('timber', mbox(t, t * 0.92, len), mul(W, m), { burn: 1, vis: 6, color });
  };
  beamAt([-1.35, plat + 0.16, 2.0], [0.55, plat + 1.62, -1.45], 0.34);
  beamAt([-2.6, plat + 0.12, -0.4], [-0.9, plat + 0.3, -2.9], 0.24, 0.4);
  beamAt([2.9, plat + 0.1, 0.2], [1.8, plat + 0.9, -3.2], 0.22, 0.38);
  // broken tiles and splinters, kept clear of where he lies and where the boy kneels
  for (let i = 0; i < 26; i++) {
    let x = rand.range(-3.6, 3.4), z = rand.range(-2.6, 3.4);
    if (x > -0.2 && x < 1.6 && z > 0.4 && z < 2.9) continue;
    const gg = new THREE.IcosahedronGeometry(rand.range(0.14, 0.32), 0); gg.scale(1.3, 0.3, 1);
    kit.add(i % 3 ? 'roof' : 'timber', gg, L(x, plat + 0.08, z, rand() * 6, rand() * 0.4), { burn: 1, vis: 6, color: 0.55 });
  }
  // a heap over his legs
  for (let i = 0; i < 9; i++) {
    const gg = new THREE.IcosahedronGeometry(0.26, 0); gg.scale(rand.range(1, 1.6), rand.range(0.35, 0.6), rand.range(0.8, 1.3));
    kit.add(i % 2 ? 'roof' : 'timber', gg, L(rand.range(-1.5, -0.7), plat + 0.12 + rand() * 0.18, rand.range(0.6, 1.5), rand() * 6, rand() * 0.5), { burn: 1, vis: 6, color: 0.5 });
  }
  A.elderMatrix = mul(W, M(-0.35, plat, 1.05));
  A.uncleSpot = new THREE.Vector3(0.45, plat + 0.2, 1.08).applyMatrix4(W);
  A.handSpot = new THREE.Vector3(0.3, plat + 0.5, 1.85).applyMatrix4(W);
  A.kneelSpot = new THREE.Vector3(0.38, plat, 2.2).applyMatrix4(W);
  A.insideSpot = new THREE.Vector3(0.2, plat, 3.15).applyMatrix4(W);
  A.inside = new THREE.Vector3(0.0, plat + 1.6, d / 2 - 0.5).applyMatrix4(W);
  A.beam = new THREE.Vector3(-0.4, plat + 0.6, 1.1).applyMatrix4(W);
  A.local = (x, y, z) => new THREE.Vector3(x, plat + y, z).applyMatrix4(W);
  A.interiorFire = [
    { p: new THREE.Vector3(-1.8, plat + 0.6, -d / 2 + 1.2).applyMatrix4(W), s: 1.3 },
    { p: new THREE.Vector3(2.4, plat + 1.4, -d / 2 + 0.9).applyMatrix4(W), s: 1.2 },
    { p: new THREE.Vector3(-2.6, plat + 1.7, 0.6).applyMatrix4(W), s: 0.9 },
    { p: new THREE.Vector3(w / 2 - 0.6, plat + 2.2, 0.0).applyMatrix4(W), s: 1.1 },
    { p: new THREE.Vector3(0.55, plat + 1.5, -1.3).applyMatrix4(W), s: 0.6 },
  ];
}

// Villagers, the uncle, the garrison. Each entry: {root, person, role, day, night}
function buildCast(anchors, rand) {
  const all = [];
  const add = (opts, role, extra = {}) => {
    const p = makePerson({ seed: all.length * 13 + 7, ...opts });
    const c = { ...p, person: p, role, ...extra };
    all.push(c);
    return c;
  };
  const H = anchors.houses;
  const place = (c, v, rotY) => { c.root.position.copy(v); c.root.rotation.y = rotY; c.home = v.clone(); c.homeRot = rotY; };
  const faceStreet = id => (H[id].def.side < 0 ? Math.PI / 2 : -Math.PI / 2);
  const frontOf = (id, f = 0.5) => { const h = H[id]; const p = h.porchFront.clone(); p.y = h.frame.plat; return p.lerp(h.center.clone().setY(h.frame.plat), f); };
  // a point in a house's own frame: x along its front, y up from the ground it stands on, z out from its centre
  // toward the street (the front wall is at d/2, the terrace edge at d/2 + 2.4)
  const at = (id, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(H[id].W);

  const uncle = add({ robe: [0.36, 0.27, 0.2], sash: [0.22, 0.19, 0.17], grey: true, beard: true, long: true, scale: 0.97 }, 'uncle', { day: 'sit', night: 'lie' });
  {
    const h = H.uncle;
    // on his bench under the window, right of the door
    place(uncle, at('uncle', UNCLE_SEAT.x, h.frame.plat, h.frame.d / 2 + UNCLE_SEAT.z + 0.04), faceStreet('uncle'));
    uncle.nightSpot = h.uncleSpot.clone();
  }
  const laundry = add({ ...VILLAGER_COLORS[2], long: true, hat: 'cloth', scarf: [0.3, 0.42, 0.6] }, 'laundry', { day: 'hang' });
  // in the street at her line (it stands in front of the terrace), beside the steps
  place(laundry, at('laundry', 1.95, 0, H.laundry.frame.d / 2 + H.laundry.frame.pd + 1.45 + 0.42), faceStreet('laundry') + Math.PI);
  const smith = add({ ...VILLAGER_COLORS[4], pants: [0.18, 0.16, 0.15] }, 'smith', { day: 'hammer' });
  if (anchors.sparks) { const s = anchors.sparks.clone(); const dir = new THREE.Vector3(Math.sign(s.x - roadX(s.z)) * 0.9, 0, 0); s.add(dir); s.y = H.smith.frame.plat; place(smith, s, faceStreet('smith') + Math.PI); }
  const seller = add({ ...VILLAGER_COLORS[5], long: true, hat: 'cloth', scarf: [0.85, 0.82, 0.75] }, 'seller', { day: 'idle' });
  place(seller, frontOf('buns', 0.42), faceStreet('buns'));
  const eater = add({ ...VILLAGER_COLORS[3] }, 'eater', { day: 'sit' });
  // on the bench at the bun stall's table, facing the street
  place(eater, at('buns', EATER_SEAT.x, H.buns.frame.plat, H.buns.frame.d / 2 + EATER_SEAT.z + 0.03), faceStreet('buns'));
  const sweeper = add({ ...VILLAGER_COLORS[1], long: true, hat: 'cloth', scarf: [0.6, 0.2, 0.2] }, 'sweeper', { day: 'sweep' });
  // sweeping the terrace between the porch posts
  place(sweeper, at('east-h', 1.9, H['east-h'].frame.plat, H['east-h'].frame.d / 2 + 1.95), faceStreet('east-h') + 0.6);
  const kidA = add({ ...VILLAGER_COLORS[2], scale: 0.62 }, 'kid', { day: 'run', loop: { c: new THREE.Vector3(roadX(24) + 1.5, 0, 24), r: 2.6, sp: 0.9 } });
  const kidB = add({ ...VILLAGER_COLORS[0], scale: 0.58 }, 'kid', { day: 'run', loop: { c: new THREE.Vector3(roadX(24) + 1.5, 0, 24), r: 2.6, sp: 0.9, off: 1.1 } });
  const cartMan = add({ ...VILLAGER_COLORS[4], grey: true, beard: true, hat: 'straw' }, 'cartman', { day: 'walk' });
  const chatA = add({ ...VILLAGER_COLORS[0], hat: 'straw' }, 'chat', { day: 'idle' });
  place(chatA, new THREE.Vector3(roadX(60) + 3.2, 0, 58.4), -0.6);
  const chatB = add({ ...VILLAGER_COLORS[1], long: true }, 'chat', { day: 'wave' });
  place(chatB, new THREE.Vector3(roadX(60) + 2.5, 0, 57.0), 0.9);
  const farmers = [0, 1].map(i => { const f = add({ ...VILLAGER_COLORS[i + 3], hat: 'straw' }, 'farmer', { day: i ? 'sweep' : 'idle' }); const z = i ? -112 : -70; const x = roadX(z) - 22 - i * 8; place(f, new THREE.Vector3(x, heightAt(x, z), z), rand() * 6); return f; });
  const soldiers = Array.from({ length: 5 }, (_, i) => add({ robe: [0.32, 0.12, 0.1], sash: [0.2, 0.18, 0.16], armor: true, hat: 'helmet', spear: true, banner: i === 0 }, 'soldier', { day: 'walk', index: i }));
  // night: villagers fleeing through the burning street
  const fleeing = Array.from({ length: 7 }, (_, i) => add({ ...VILLAGER_COLORS[i % 6], long: i % 2 === 0, hat: i === 3 ? 'straw' : undefined, scale: i === 5 ? 0.62 : 1 }, 'flee', { night: 'run', index: i }));
  const cowering = add({ ...VILLAGER_COLORS[2], long: true, hat: 'cloth', scarf: [0.3, 0.3, 0.45] }, 'cower', { night: 'cower' });
  // crouched in the street against the terrace wall beside the steps
  place(cowering, at('west-g', 2.6, 0, H['west-g'].frame.d / 2 + 2.4 + 0.42), faceStreet('west-g') + 0.35);
  const fallen = [0, 1].map(i => { const f = add({ ...VILLAGER_COLORS[i + 1] }, 'fallen', { night: 'lie' }); const z = i ? 18 : -4; place(f, new THREE.Vector3(roadX(z) + (i ? 2.6 : -2.2), 0, z), i ? 2.2 : -0.7); return f; });
  return { all, uncle, laundry, smith, seller, eater, sweeper, kids: [kidA, kidB], cartMan, chat: [chatA, chatB], farmers, soldiers, fleeing, cowering, fallen };
}
