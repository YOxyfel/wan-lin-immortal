// Cinderfall valley in spring: sakura in bloom beside the houses and in the courtyards, at the street's edges (never
// on the road, clear of the camera that walks it over his shoulder), by the gate, along the fields path and at the
// edge of the pines at the north end of the road.
//   import { addValleySakura } from './valley-flora.js';
//   const sakura = addValleySakura(world.root, quality, world);   // world = buildWorld(...) result (optional)
// One merged stand: 4 draw calls (bark, blossom, fallen petals, drifting petals) + 2 in the shadow pass.
import { createSakuraStand } from './flora-sakura.js';
import { roadX, heightAt, streamZ, HOUSES, housePlacement, GATE_Z, riverD } from './layout.js';
import { injectFog } from './atmosphere.js';

// [x, z, height, crown radius, seed]; positions are checked against the road, the stream and the world's
// keep-out rectangles (houses, wells, the wish tree, the shrine, trees already standing) and nudged clear
export const SAKURA_SPOTS = [
  // the street: in the gaps between the houses, crowns over the lane walls and the porch roofs
  [-9.3, 79.0, 7.6, 3.4, 1], [9.4, 86.5, 7.8, 3.6, 2], [9.4, 53.6, 8.2, 3.5, 3], [-9.4, 47.6, 7.8, 3.3, 4],
  [9.3, 35.4, 7.0, 2.6, 5], [-9.3, 30.6, 7.2, 2.6, 6], [9.4, 20.2, 7.6, 3.0, 7], [-9.4, 13.2, 7.4, 2.9, 8],
  // courtyards between the street and the back row: tall enough to rise over the roofs
  [-18.2, 64.0, 8.8, 4.2, 9], [17.8, 5.2, 8.6, 4.0, 10], [-18.0, -15.4, 8.4, 3.9, 11],
  // by the gate, just outside it
  [-9.8, GATE_Z - 3.6, 6.8, 3.6, 12], [10.2, GATE_Z - 4.8, 6.4, 3.4, 13],
  // along the fields path
  [3.0, -71.0, 6.6, 3.8, 14], [-18.6, -104.0, 7.0, 4.0, 15], [9.6, -118.0, 6.4, 3.6, 16],
  // at the edge of the pines, the north end of the road
  // (the first of them off to one side of where he looks west at the storm, so it never hides where the bolt comes down)
  [-6.1, -150.9, 7.4, 4.2, 17], [20.4, -152.0, 6.8, 3.9, 18],
];

function streetHouseRects() {
  return HOUSES.map(h => { const p = housePlacement(h); const ex = h.d / 2 + 1.2, ez = h.w / 2 + 0.6; return [p.x - ex, p.x + ex, p.z - ez, p.z + ez]; });
}

/**
 * addValleySakura(root, quality, world?) -> { group, stand, spots }
 * quality.lowVeg (or .low) -> fewer trees and blossoms, no drifting petals.
 */
export function addValleySakura(root, quality = {}, world = null) {
  const low = !!(quality && (quality.lowVeg || quality.low));
  const rects = streetHouseRects();
  const blocked = (x, z, pad = 0) => {
    if (world && world.avoid && world.avoid(x, z)) return true;
    if (rects.some(r => x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad)) return true;
    if (Math.abs(x - roadX(z)) < 7.2) return true;                 // the road and the camera walking it
    if (riverD(x, z) < 3) return true;
    return false;
  };
  const list = [];
  const spots = low ? SAKURA_SPOTS.filter((s, i) => i % 3 !== 2) : SAKURA_SPOTS;
  for (const [x0, z0, h, R, seed] of spots) {
    // nudge away from the road (and around obstacles) until the trunk stands clear
    let x = x0, z = z0, ok = !blocked(x, z, 0.6);
    const out = Math.sign(x0 - roadX(z0)) || 1;
    for (let k = 1; k <= 8 && !ok; k++) {
      for (const [dx, dz] of [[out * 0.8 * k, 0], [0, 0.8 * k], [0, -0.8 * k], [out * 0.6 * k, 0.6 * k], [out * 0.6 * k, -0.6 * k]]) {
        if (!blocked(x0 + dx, z0 + dz, 0.6)) { x = x0 + dx; z = z0 + dz; ok = true; break; }
      }
    }
    if (!ok) continue;
    list.push({ seed: 6100 + seed * 13, height: h, spread: R, position: [x, heightAt(x, z), z], density: low ? 0.65 : 1, rotationY: seed * 2.3 });
  }
  const stand = createSakuraStand(list, {
    name: 'valleySakura', groundAt: heightAt, petals: true, falling: !low, fallingPerTree: 34,
    keepOut: (x, z) => Math.abs(x - roadX(z)) < 2.6,                // fallen petals stop at the road's packed earth
  });
  injectFog(stand.group);
  root.add(stand.group);
  return { group: stand.group, stand, spots: list.map(t => t.position) };
}
