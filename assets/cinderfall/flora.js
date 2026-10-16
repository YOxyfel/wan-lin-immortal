// Flora: high-quality procedural vegetation and landscape for the Forbidden Forest (Cinderfall prologue).
// Every creator returns THREE objects whose materials follow the shared story uniforms (U in materials.js):
// wind/gust sway, snow on upper surfaces, rain-wet darkening, moss, autumn colour, spring blossom.
// Look-dev: lab/flora.html. API, budgets and limitations: lab/flora-notes.md.
export { floraMaterials } from './flora-mats.js';
export { createAncientTree } from './flora-ancient.js';
export { createPine, createPineStand, createMaple, createMapleStand } from './flora-trees.js';
export { createBambooGrove } from './flora-bamboo.js';
export {
  createForestFloor, createMossyRock, createRockField, rockGeometry, createFerns, createUndergrowth,
  createLeafLitter, createStonePath, scatter,
} from './flora-ground.js';
export { createKarstCliffs, createDistantForest, createLightShafts } from './flora-cliffs.js';
export { fpatch, fdepth, noise3, fbm3, ridged3, smooth, clamp, lerp, rng, stats } from './flora-core.js';
