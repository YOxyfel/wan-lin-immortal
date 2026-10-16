// Shared flora materials (built once): every material reacts to U (wind, gust, snow, autumn, wet, blossom, moss).
import * as THREE from 'three';
import { fpatch, fdepth, setMossTexture } from './flora-core.js';
import * as TX from './flora-tex.js';

let M = null;
const std = o => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
const v2 = (a, b = a) => new THREE.Vector2(a, b);

export function floraMaterials() {
  if (M) return M;
  const moss = TX.mossTex();
  setMossTexture(moss);
  const ab = TX.ancientBark(), pb = TX.pineBark(), rk = TX.rockTex(), atlas = TX.foliageAtlas(), cl = TX.cliffTex(), culm = TX.culmTex();
  const leaf = (o, opts) => fpatch(std({ map: atlas, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.78, ...o }), { kind: 'leaf', wind: true, ...opts });
  M = {
    textures: { ancientBark: ab, pineBark: pb, rock: rk, atlas, cliff: cl, culm, moss },
    // the ancient tree: pale furrowed bark, heavy moss low down
    ancientTrunk: fpatch(std({ map: ab.map, normalMap: ab.normal, normalScale: v2(1.7), roughness: 0.93 }), { kind: 'trunk', moss: 1, lichen: 0.25, mossH: [11, 2.5, 0, 0.04], trunkTile: [1 / ab.tile[0], 1 / ab.tile[1]], trunkShear: 0.045, mossFocus: true, key: 'ancientTrunk' }),
    ancientBark: fpatch(std({ map: ab.map, normalMap: ab.normal, normalScale: v2(1.6), roughness: 0.93 }), { kind: 'bark', moss: 1, lichen: 0.25, mossH: [11, 2.5, 0, 0.04], mossFocus: true, key: 'ancient' }),
    ancientLimb: fpatch(std({ map: ab.map, normalMap: ab.normal, normalScale: v2(1.4), roughness: 0.93 }), { kind: 'bark', wind: true, moss: 0.8, lichen: 0.3, key: 'ancientLimb' }),
    ancientLeaf: leaf({}, { leafA: 0x355e1a, leafB: 0x6a8c2e, autA: 0xe0a826, autB: 0xc8861e, autC: 0xa8501a, autAmt: 0.6, drop: 0.55, trans: 0.55, transCol: 0xf0f0a0, flutter: 0.6, snowLeaf: 0.55, key: 'ancientLeaf' }),
    rustLeaf: leaf({}, { leafA: 0x3a5e1e, leafB: 0x5f7e2a, autA: 0xb0581a, autB: 0x8e3e14, autC: 0xc8862a, autAmt: 0.85, drop: 0.85, trans: 0.55, transCol: 0xf0e0a0, flutter: 0.6, snowLeaf: 0.55, key: 'rustLeaf' }),
    // pines: reddish-grey plates; dark, dense needle pads that hold snow
    pineBark: fpatch(std({ map: pb.map, normalMap: pb.normal, normalScale: v2(1.3), roughness: 0.9 }), { kind: 'bark', wind: true, moss: 0.35, lichen: 0.2, key: 'pine' }),
    pineNeedle: leaf({ roughness: 0.7 }, { leafA: 0x1f3a1a, leafB: 0x3c5a26, autA: 0x5a6a26, autB: 0x4a5a22, autC: 0x6a6a2a, autAmt: 0.15, drop: 0, trans: 0.3, transCol: 0xd0f080, flutter: 0.25, snowLeaf: 0.8, key: 'needle' }),
    // maples: smooth grey bark, palmate leaves blazing in autumn, bare in winter
    mapleBark: fpatch(std({ map: ab.map, normalMap: ab.normal, normalScale: v2(0.6), color: 0xb8b0a4, roughness: 0.85 }), { kind: 'bark', wind: true, moss: 0.35, lichen: 0.3, key: 'maple' }),
    mapleLeaf: leaf({ roughness: 0.72 }, { leafA: 0x3f6a1c, leafB: 0x76962e, autA: 0x9c120c, autB: 0xd8361a, autC: 0xec8a1e, autAmt: 1, blossomC: 0xb8402a, blossom: 0.6, drop: 1, trans: 0.95, transCol: 0xffe0c0, flutter: 1.0, snowLeaf: 0.6, key: 'maple' }),
    // bamboo
    culm: fpatch(std({ map: culm, roughness: 0.55 }), { kind: 'bark', wind: true, moss: 0, lichen: 0, snow: 0.3, key: 'culm' }),
    bambooLeaf: leaf({ roughness: 0.6 }, { leafA: 0x3a5e1c, leafB: 0x6f8c30, autA: 0x9a9a38, autB: 0x8a8a30, autC: 0xb0a040, autAmt: 0.3, drop: 0, trans: 0.7, transCol: 0xf0ffb0, flutter: 1.4, snowLeaf: 0.7, key: 'bamboo' }),
    // understorey
    fern: leaf({ roughness: 0.75 }, { leafA: 0x2e5a18, leafB: 0x5e8426, autA: 0x8a5418, autB: 0xa87424, autC: 0x6e6424, autAmt: 0.5, drop: 0.45, trans: 0.6, transCol: 0xe8ffa0, flutter: 0.5, snowLeaf: 0.8, key: 'fern' }),
    grass: leaf({ roughness: 0.85 }, { leafA: 0x4c6e22, leafB: 0x84983c, autA: 0xa8904a, autB: 0x8e7438, autC: 0xb8a060, autAmt: 0.8, drop: 0.8, trans: 0.5, transCol: 0xf0ffb0, flutter: 0.7, snowLeaf: 0.9, key: 'grass' }),
    shrub: leaf({ roughness: 0.75 }, { leafA: 0x355a1c, leafB: 0x58782a, autA: 0x9a2a14, autB: 0xc8641e, autC: 0xd0a02a, autAmt: 0.75, blossomC: 0xf4e4ec, blossom: 1, drop: 0.6, trans: 0.5, transCol: 0xf0ffb0, flutter: 0.6, snowLeaf: 0.8, key: 'shrub' }),
    litter: leaf({ roughness: 0.9 }, { leafA: 0x6a4a28, leafB: 0x8a6232, autA: 0xa4180e, autB: 0xd8421a, autC: 0xe8961e, autAmt: 1, drop: 0, trans: 0.2, transCol: 0xffd0a0, flutter: 0, snowLeaf: 1.0, litter: true, key: 'litter' }),
    // stone and moss
    rock: fpatch(std({ map: rk.map, normalMap: rk.normal, normalScale: v2(1.2), roughness: 0.88 }), { kind: 'rock', moss: 1, lichen: 0.6, tri: 0.42, key: 'rock' }),
    stone: fpatch(std({ map: rk.map, normalMap: rk.normal, normalScale: v2(1.0), roughness: 0.85 }), { kind: 'rock', moss: 0.16, lichen: 0.6, tri: 0.5, key: 'stone' }),
    mossCushion: fpatch(std({ map: rk.map, roughness: 1 }), { kind: 'rock', moss: 1.2, mossH: [0, 0, 0, 0.9], tri: 0.4, key: 'mossCushion' }),
    cliff: fpatch(std({ map: cl.map, normalMap: cl.normal, normalScale: v2(1.0), roughness: 0.95 }), { kind: 'rock', moss: 0.9, mossA: 0x4a5c2a, mossB: 0x22341a, lichen: 0.0, tri: 1 / 36, wet: 0.5, airMass: false, key: 'cliff' }),
  };
  // old leaves in the nook between the roots: browned, a few still red
  M.litterOld = leaf({ roughness: 0.95 }, { leafA: 0x5a3e24, leafB: 0x6e4a2a, autA: 0x6a2a14, autB: 0x7a4a24, autC: 0x9a3a16, autAmt: 1, drop: 0, trans: 0.12, transCol: 0xffd0a0, flutter: 0, snowLeaf: 1.0, litter: true, key: 'litterOld' });
  // distant conifers stay dark under snow (snow on their shoulders only): the dark masses of a winter forest
  M.pineNeedleFar = leaf({ roughness: 0.7 }, { leafA: 0x152c16, leafB: 0x2a4620, autA: 0x5a6a26, autB: 0x4a5a22, autC: 0x6a6a2a, autAmt: 0.12, drop: 0, trans: 0.25, transCol: 0xd0f080, flutter: 0.2, snowLeaf: 0.24, key: 'needleFar' });
  // distant crowns that stay as a grey-brown haze of twigs in winter instead of vanishing
  M.ancientLeafBare = leaf({}, { leafA: 0x355e1a, leafB: 0x6a8c2e, autA: 0xe0a826, autB: 0xc8861e, autC: 0xa8501a, autAmt: 0.8, drop: 0.9, bare: true, twig: 0x5a5048, trans: 0.4, transCol: 0xf0f0a0, flutter: 0.3, snowLeaf: 0.5, key: 'ancientLeafBare' });
  M.rustLeafBare = leaf({}, { leafA: 0x3a5e1e, leafB: 0x5f7e2a, autA: 0xb0581a, autB: 0x8e3e14, autC: 0xc8862a, autAmt: 0.85, drop: 0.95, bare: true, twig: 0x52463e, trans: 0.4, transCol: 0xf0e0a0, flutter: 0.3, snowLeaf: 0.5, key: 'rustLeafBare' });
  M.mapleLeafBare = leaf({ roughness: 0.72 }, { leafA: 0x3f6a1c, leafB: 0x76962e, autA: 0x9c120c, autB: 0xd8361a, autC: 0xec8a1e, autAmt: 1, drop: 1, bare: true, twig: 0x4e4440, trans: 0.6, transCol: 0xffe0c0, flutter: 0.4, snowLeaf: 0.5, key: 'mapleLeafBare' });
  // the old wood: colossal evergreen giants, darker bark furred with moss far up the trunk, roots under a pelt of it
  M.giantTrunk = fpatch(std({ map: ab.map, normalMap: ab.normal, normalScale: v2(1.8), color: 0x9c9284, roughness: 0.94 }), { kind: 'trunk', moss: 1, lichen: 0.35, mossH: [19, 6, 0, 0.17], mossA: 0x8f9c3c, mossB: 0x3a4c18, trunkTile: [1 / ab.tile[0], 1 / ab.tile[1]], trunkShear: 0.03, key: 'giantTrunk' });
  M.giantRoots = fpatch(std({ map: ab.map, normalMap: ab.normal, normalScale: v2(1.6), color: 0x9c9284, roughness: 0.94 }), { kind: 'bark', moss: 1.25, lichen: 0.3, mossH: [7, 2, 0, 0.24], mossA: 0x93a03e, mossB: 0x3c4e1a, key: 'giantRoots' });
  M.giantLimb = fpatch(std({ map: ab.map, normalMap: ab.normal, normalScale: v2(1.4), color: 0x9c9284, roughness: 0.94 }), { kind: 'bark', wind: true, moss: 1.0, lichen: 0.4, mossH: [0, 0, 0, 0.1], key: 'giantLimb' });
  M.giantLeaf = leaf({}, { leafA: 0x22401a, leafB: 0x47622a, autA: 0x6a6a22, autB: 0x8a7a26, autC: 0x5a5a20, autAmt: 0.22, drop: 0.12, trans: 0.4, transCol: 0xd8f0a0, flutter: 0.4, snowLeaf: 0.7, key: 'giantLeaf' });
  // the karst wall seen up close (the ring's material tiles every 36 m for towers seen from afar)
  M.cliffNear = fpatch(std({ map: rk.map, normalMap: rk.normal, normalScale: v2(1.25), color: 0xc4c2ba, roughness: 0.93 }), { kind: 'rock', moss: 1.0, mossA: 0x5e6c2c, mossB: 0x26381a, mossH: [46, 14, 0, 0.12], lichen: 0.5, tri: 0.17, wet: 0.6, airMass: false, key: 'cliffNear' });
  M.depth = {
    static: fdepth(M.ancientBark, { wind: false }),
    limb: fdepth(M.ancientLimb, { wind: true }),
    ancientLeaf: fdepth(M.ancientLeaf, { wind: true }),
    rustLeaf: fdepth(M.rustLeaf, { wind: true }),
    pineBark: fdepth(M.pineBark, { wind: true }),
    pineNeedle: fdepth(M.pineNeedle, { wind: true }),
    mapleBark: fdepth(M.mapleBark, { wind: true }),
    mapleLeaf: fdepth(M.mapleLeaf, { wind: true }),
    culm: fdepth(M.culm, { wind: true }),
    bambooLeaf: fdepth(M.bambooLeaf, { wind: true }),
    fern: fdepth(M.fern, { wind: true }),
    grass: fdepth(M.grass, { wind: true }),
    shrub: fdepth(M.shrub, { wind: true }),
    litter: fdepth(M.litter, { wind: false }),
    rock: fdepth(M.rock, { wind: false }),
    giantLeaf: fdepth(M.giantLeaf, { wind: true }),
  };
  for (const k of ['rustLeaf', 'ancientLeaf', 'pineNeedle', 'mapleLeaf', 'bambooLeaf', 'fern', 'grass', 'shrub', 'litter', 'giantLeaf']) M[k].shadowSide = THREE.DoubleSide;
  return M;
}
