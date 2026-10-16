// Shared materials and global shader uniforms. All surfaces react to the same story state:
// uFire chars and ember-lights the village, uBroken/uRuin swap intact and destroyed geometry, uWind moves foliage.
import * as THREE from 'three';
import { GLYPHS } from './glyphs.js';

export const U = {
  uTime: { value: 0 },
  uFire: { value: 0 },
  uBroken: { value: 0 },
  uRuin: { value: 0 },
  uWind: { value: 0.35 },
  uNoise: { value: null },
  uGust: { value: new THREE.Vector2(0.8, 0.6) },
  // a ring of light running out over the grass (x, z, radius m, strength): the blades thrown flat and lit gold
  uRing: { value: new THREE.Vector4(0, 0, 0, 0) },
  // the Forbidden Forest: camp stage, tally years, seasons, the ground giving way
  uStage: { value: 0 },
  uYears: { value: 0 },
  uSnow: { value: 0 },
  uAutumn: { value: 0 },
  uWet: { value: 0 },
  uBlossom: { value: 0 },
  uMoss: { value: 0 },
  uCollapse: { value: 0 },
};

// The painted (toon) light: every lit surface takes the sun as a soft-edged step at the terminator with only a gentle
// slope across its lit side, so forms read as flat planes of light and shade, the way they are painted in animation.
// Patched into three's own lighting before anything compiles, so it holds for every standard and lambert material.
// (?toon=0 turns it off, for comparison)
const QS = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(''); } })();
export const TOON = QS.get('toon') !== '0';
const TOON_E = +(QS.get('toonE') ?? 0.05);
if (TOON) {
  // (its strength is a shared uniform, cfToonK, given to every fogged material with the atmosphere's: see FOGU)
  const fn = `
#ifndef CF_TOON_FN
#define CF_TOON_FN
uniform float cfToonK;
float cfToonNL( float x ) {
  float s = smoothstep( 0.0, ${TOON_E.toFixed(3)}, x );
  return mix( saturate( x ), s * ( 0.58 + 0.42 * saturate( x ) ), cfToonK );
}
#endif
`;
  const line = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
  for (const k of ['lights_physical_pars_fragment', 'lights_lambert_pars_fragment']) {
    if (THREE.ShaderChunk[k].includes(line)) THREE.ShaderChunk[k] = fn + THREE.ShaderChunk[k].replace(line, 'float dotNL = cfToonNL( dot( geometryNormal, directLight.direction ) );');
  }
}

// Images are copied verbatim into the build, so resolve them from the page rather than the bundle.
const base = new URL('Images/Cinderfall/', document.baseURI).href;
export const texURL = name => base + name + '.webp';

const VIS = `float cfVis=1.;
 if(aVis>.5&&aVis<1.5)cfVis=1.-uBroken;
 else if(aVis>1.5&&aVis<2.5)cfVis=uBroken;
 else if(aVis>2.5&&aVis<3.5)cfVis=1.-uRuin;
 else if(aVis>3.5&&aVis<4.5)cfVis=uRuin;
 else if(aVis>4.5&&aVis<5.5)cfVis=(1.-uBroken)*(1.-uRuin);
 else if(aVis>5.5&&aVis<6.5)cfVis=uBroken*(1.-uRuin);
 else if(aVis>6.5&&aVis<7.5)cfVis=step(.001,uCollapse);
 else if(aVis>7.5&&aVis<8.5)cfVis=1.-step(.001,uCollapse);
 else if(aVis>9.5&&aVis<19.5)cfVis=clamp(uStage-(aVis-10.)+1.,0.,1.);
 else if(aVis>19.5&&aVis<29.5)cfVis=clamp(uYears-(aVis-20.)+1.,0.,1.);
 else if(aVis>29.5&&aVis<39.5)cfVis=clamp((aVis-30.)-uStage,0.,1.);
 else if(aVis>39.5&&aVis<49.5)cfVis=clamp(uStage+1.,0.,1.)*clamp((aVis-40.)-uStage,0.,1.);
 if(uRuin>.5&&aBurn>.45&&aVis<.5){ float cfCap=.9+2.6*texture2D(uNoise,transformed.xz*.05).r*texture2D(uNoise,transformed.xz*.21).g*1.6; transformed.y=min(transformed.y,cfCap); }
 vCfVis=cfVis;
 transformed*=step(.001,cfVis);`;

const WIND = `{
 vec3 cfW=(modelMatrix*vec4(transformed,1.)).xyz;
 float ph=uTime*1.6+cfW.x*.23+cfW.z*.19;
 float g=(sin(ph)*.55+sin(ph*2.37+1.3)*.3+sin(ph*5.3+cfW.y)*.15)*uWind;
 transformed.xz+=uGust*g*aSway*.32;
 transformed.y-=abs(g)*aSway*.05;
}`;

// Inject the story uniforms into a MeshStandardMaterial.
// burn: char and embers at night · wind: foliage sway · flags: visibility codes · seasons: snow, rain-wet, moss
// foliage: autumn colour and blossom
export function patch(material, { burn = true, wind = false, flags = true, seasons = false, foliage = false } = {}) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    let v = shader.vertexShader, f = shader.fragmentShader;
    v = v.replace('#include <common>', `#include <common>
attribute float aBurn; attribute float aVis; attribute float aSway;
varying float vBurn; varying vec3 vWPos; varying vec3 vWNrm; varying float vCfVis;
uniform float uBroken,uRuin,uTime,uWind,uStage,uYears,uCollapse; uniform vec2 uGust; uniform sampler2D uNoise;`);
    v = v.replace('#include <begin_vertex>', `#include <begin_vertex>
vCfVis=1.;
${flags ? VIS : ''}
${wind ? WIND : ''}
vBurn=aBurn;`);
    v = v.replace('#include <project_vertex>', `#include <project_vertex>
vWPos=(modelMatrix*vec4(transformed,1.)).xyz;
vWNrm=normalize(mat3(modelMatrix)*objectNormal);`);
    f = f.replace('#include <common>', `#include <common>
varying float vBurn; varying vec3 vWPos; varying vec3 vWNrm; varying float vCfVis;
uniform float uFire,uRuin,uTime,uSnow,uAutumn,uWet,uBlossom,uMoss; uniform sampler2D uNoise;`);
    let mapExtra = '';
    if (flags) mapExtra += `
if(vCfVis<.999){ float cfD=texture2D(uNoise,vWPos.xz*.9+vWPos.y*.7).r*.85+.1; if(cfD>vCfVis) discard; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.03),smoothstep(vCfVis-.1,vCfVis,cfD)); }`;
    if (burn) mapExtra += `
float cfNA=texture2D(uNoise,vWPos.xz*.045+vWPos.y*.031).r;
float cfNB=texture2D(uNoise,vWPos.xz*.06+vec2(vWPos.y*.05,-vWPos.y*.03)).g;
float cfBurn=vBurn*max(uFire,uRuin*.92);
float cfChar=smoothstep(.22,.68,cfBurn*1.22+(cfNA-.5)*.85);
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.085+vec3(.021,.018,.016),cfChar);
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.86,.9,.8)+vec3(.02,.035,.012),uRuin*smoothstep(.55,.7,cfNA)*(1.-cfChar*.5));`;
    if (foliage) mapExtra += `
float cfLeaf=texture2D(uNoise,vWPos.xz*.035+vWPos.y*.011).r;
float cfLum=dot(diffuseColor.rgb,vec3(.33));
vec3 cfAut=mix(vec3(1.,.36,.08),vec3(.98,.7,.16),texture2D(uNoise,vWPos.xz*.11).g)*(.42+cfLum*1.1);
diffuseColor.rgb=mix(diffuseColor.rgb,cfAut,uAutumn*smoothstep(.2,.5,cfLeaf+.15));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.8,.88)*(.62+cfLum*.6),uBlossom*smoothstep(.55,.7,cfLeaf));`;
    if (seasons) mapExtra += `
float cfNs=texture2D(uNoise,vWPos.xz*.21+vWPos.y*.13).g;
float cfUp=clamp(normalize(vWNrm).y,0.,1.);
float cfMossK=uMoss*smoothstep(.35,.8,cfUp*.75+cfNs*.55);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.13,.2,.07)*(.7+cfNs*.7),cfMossK);
float cfSnow=uSnow*smoothstep(.42,.78,cfUp+(cfNs-.5)*.55);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.9,.93,.97),cfSnow);
diffuseColor.rgb*=1.-uWet*.34*(1.-cfSnow);`;
    f = f.replace('#include <map_fragment>', '#include <map_fragment>' + mapExtra);
    if (seasons) f = f.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.3,uWet*(1.-cfSnow));');
    if (burn) {
      f = f.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float cfPatch=smoothstep(.74,.84,texture2D(uNoise,vWPos.xz*.11+vec2(vWPos.y*.13)).r);
float cfGlow=cfPatch*(.35+.65*texture2D(uNoise,vWPos.xz*.7+vWPos.y*.5).a)*cfChar*uFire*(1.-uRuin);
float cfFlick=.62+.38*sin(uTime*2.6+cfNA*31.)*sin(uTime*1.27+cfNB*17.);
totalEmissiveRadiance+=vec3(1.,.27,.04)*cfGlow*cfFlick*1.3;`);
    }
    shader.vertexShader = v;
    shader.fragmentShader = f;
  };
  material.customProgramCacheKey = () => `cf-${burn}-${wind}-${flags}-${seasons}-${foliage}`;
  return material;
}

// Depth material that honours the same visibility flags (and alpha test) so hidden parts cast no shadow.
export function depthFor(material, { wind = false } = {}) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: material.alphaTest ? material.map : null, alphaTest: material.alphaTest || 0 });
  d.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aVis; attribute float aSway; attribute float aBurn; uniform float uBroken,uRuin,uTime,uWind,uStage,uYears,uCollapse; uniform vec2 uGust; uniform sampler2D uNoise; float vCfVis;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${VIS}
${wind ? WIND : ''}`);
  };
  d.customProgramCacheKey = () => `cfdepth-${wind}-${!!material.alphaTest}`;
  return d;
}

function loadTex(loader, name, { srgb = true, repeat = 1 } = {}) {
  const t = loader.load(texURL(name));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.repeat.set(1 / repeat, 1 / repeat);
  return t;
}

// Sign boards and the gate plaque are painted at runtime from vector glyphs.
export const SIGN_CELLS = { '藥': 0, '茶': 1, '鐵': 2, '包': 3, '酒': 4, '守': 5, gate: 6, '福': 7, couplet: 8, talisman: 9, '神兵': 10, '劍': 11, '古松': 12, '禁': 13, '漁': 14, '米': 15 };
function signAtlas() {
  const W = 1024, H = 2048, cw = 512, ch = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const glyph = (ch0, cx, cy, size, fill) => {
    const g = GLYPHS[ch0];
    if (!g) return;
    x.save();
    x.translate(cx - size / 2, cy - size * 0.5);
    x.scale(size / 1000, size / 1000);
    x.fillStyle = fill;
    x.fill(new Path2D(g.d));
    x.restore();
  };
  const board = (i, bg, edge) => {
    const ox = (i % 2) * cw, oy = Math.floor(i / 2) * ch;
    const grd = x.createLinearGradient(ox, oy, ox, oy + ch);
    grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]);
    x.fillStyle = grd; x.fillRect(ox, oy, cw, ch);
    // wood grain
    x.globalAlpha = 0.18;
    for (let k = 0; k < 40; k++) {
      x.strokeStyle = k % 2 ? '#000' : '#fff';
      x.beginPath();
      const yy = oy + Math.random() * ch;
      x.moveTo(ox, yy);
      x.bezierCurveTo(ox + cw * 0.3, yy + Math.random() * 8 - 4, ox + cw * 0.6, yy + Math.random() * 8 - 4, ox + cw, yy + Math.random() * 6 - 3);
      x.stroke();
    }
    x.globalAlpha = 1;
    x.strokeStyle = edge; x.lineWidth = 14; x.strokeRect(ox + 10, oy + 10, cw - 20, ch - 20);
    x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 4; x.strokeRect(ox + 22, oy + 22, cw - 44, ch - 44);
    return [ox, oy];
  };
  const shops = ['藥', '茶', '鐵', '包', '酒', '守'];
  shops.forEach((s, i) => {
    const [ox, oy] = board(i, i === 5 ? ['#3b2a20', '#21160f'] : ['#5a2f1c', '#3a1d10'], i === 5 ? '#8a6a3a' : '#b48a3c');
    glyph(s, ox + cw / 2, oy + ch / 2 + 8, 190, i === 5 ? '#d9c08a' : '#e7c46c');
  });
  {
    const [ox, oy] = board(6, ['#20262a', '#111517'], '#a38245');
    ['烬', '落', '村'].forEach((s, k) => glyph(s, ox + cw / 2 + (k - 1) * 150, oy + ch / 2 + 6, 150, '#e2c27a'));
  }
  { // 福 on red diamond paper
    const ox = cw, oy = 3 * ch;
    x.fillStyle = '#b3261e'; x.fillRect(ox, oy, cw, ch);
    x.fillStyle = 'rgba(0,0,0,.15)'; for (let k = 0; k < 300; k++) x.fillRect(ox + Math.random() * cw, oy + Math.random() * ch, 2, 2);
    glyph('福', ox + cw / 2, oy + ch / 2 + 6, 200, '#1a1210');
  }
  { // couplet strips: red paper with dark calligraphy-like marks
    const ox = 0, oy = 4 * ch;
    x.fillStyle = '#b02a20'; x.fillRect(ox, oy, cw, ch);
    ['福', '命', '夜', '火', '江'].forEach((s, k) => glyph(s, ox + 52 + k * 102, oy + ch / 2 + 6, 86, '#1b1311'));
  }
  { // talisman: yellow paper, cinnabar strokes
    const ox = cw, oy = 4 * ch;
    x.fillStyle = '#d8b660'; x.fillRect(ox, oy, cw, ch);
    ['敕', '令', '雷'].forEach((s, k) => glyph(s, ox + 120 + k * 140, oy + ch / 2 + 6, 120, '#a3201a'));
  }
  { // 神兵: divine arms, gold on black lacquer
    const [ox, oy] = board(10, ['#141010', '#060404'], '#b08a3a');
    ['神', '兵'].forEach((s, k) => glyph(s, ox + cw / 2 + (k - 0.5) * 190, oy + ch / 2 + 8, 180, '#e6c06a'));
  }
  { // 劍 on a red banner
    const ox = cw, oy = 5 * ch;
    x.fillStyle = '#8c1410'; x.fillRect(ox, oy, cw, ch);
    glyph('劍', ox + cw / 2, oy + ch / 2 + 6, 210, '#e8c470');
  }
  { // 古松: the old pines, weathered wood with dark letters
    const [ox, oy] = board(12, ['#6a5440', '#4a3a2a'], '#3a2c1e');
    ['古', '松'].forEach((s, k) => glyph(s, ox + cw / 2 + (k - 0.5) * 190, oy + ch / 2 + 8, 170, '#1d1510'));
  }
  { // 禁: forbidden, red on pale wood
    const [ox, oy] = board(13, ['#b8a07a', '#9c845e'], '#5a1a12');
    glyph('禁', ox + cw / 2, oy + ch / 2 + 8, 200, '#8a1612');
  }
  { // 漁: the fishermen's
    const [ox, oy] = board(14, ['#3a4a50', '#22303a'], '#8a9a9a');
    glyph('漁', ox + cw / 2, oy + ch / 2 + 8, 190, '#e6e2d4');
  }
  { // 米: rice
    const [ox, oy] = board(15, ['#5a2f1c', '#3a1d10'], '#b48a3c');
    glyph('米', ox + cw / 2, oy + ch / 2 + 8, 190, '#e7c46c');
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { texture: t, W, H, cw, ch };
}
export let SIGNS = null;

function sharpenAlpha(mat) {
  const inner = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    inner(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', 'diffuseColor.a=clamp((diffuseColor.a-.38)/max(fwidth(diffuseColor.a),1e-4)+.5,0.,1.);\n#include <alphatest_fragment>');
  };
  const key = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => key + '-sharp';
  return mat;
}

// Emissive material whose glow colour comes from the vertex colour (coals, crystal, incense tips, dark water).
function glowMat() {
  const g = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1, roughness: 1, vertexColors: true });
  patch(g, { burn: false });
  const inner = g.onBeforeCompile;
  g.onBeforeCompile = sh => { inner(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance*=vColor*2.2;'); };
  g.customProgramCacheKey = () => 'cf-glow';
  return g;
}

export function createMaterials(renderer) {
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const T = (name, o) => { const t = loadTex(loader, name, o); t.anisotropy = aniso; return t; };
  const noise = T('noise', { srgb: false });
  noise.anisotropy = 1;
  U.uNoise.value = noise;

  const std = (o, opts) => patch(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }), opts);
  SIGNS = signAtlas();

  const m = {
    roof: std({ map: T('roof-albedo', { repeat: 2.0 }), normalMap: T('roof-normal', { srgb: false, repeat: 2.0 }), normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.82 }),
    roofUnder: std({ map: T('wood-albedo', { repeat: 2.2 }), color: 0x7a6a5c, roughness: 0.9 }),
    timber: std({ map: T('wood-albedo', { repeat: 2.4 }), normalMap: T('wood-normal', { srgb: false, repeat: 2.4 }), color: 0x8a6f5a, roughness: 0.78 }),
    plank: std({ map: T('wood-albedo', { repeat: 2.0 }), normalMap: T('wood-normal', { srgb: false, repeat: 2.0 }), color: 0xd0b392, roughness: 0.8 }),
    plaster: std({ map: T('plaster-albedo', { repeat: 3.2 }), normalMap: T('plaster-normal', { srgb: false, repeat: 3.2 }), roughness: 0.95 }),
    stone: std({ map: T('stone-albedo', { repeat: 3.0 }), normalMap: T('stone-normal', { srgb: false, repeat: 3.0 }), normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.92 }),
    cobble: std({ map: T('cobble-albedo', { repeat: 2.6 }), normalMap: T('cobble-normal', { srgb: false, repeat: 2.6 }), roughness: 0.9 }),
    straw: std({ map: T('straw-albedo', { repeat: 0.55 }), normalMap: T('straw-normal', { srgb: false, repeat: 0.55 }), roughness: 0.95 }),
    cloth: std({ map: T('cloth-albedo', { repeat: 0.45 }), roughness: 0.96, side: THREE.DoubleSide }, { wind: true }),
    paper: std({ color: 0xf1e6cc, roughness: 1, emissive: 0xffa040, emissiveIntensity: 0 }),
    lantern: std({ map: T('cloth-albedo', { repeat: 0.3 }), roughness: 0.7, emissive: 0xff5a1a, emissiveIntensity: 0 }, { wind: true }),
    lacquer: std({ roughness: 0.45, metalness: 0.0 }),
    metal: std({ color: 0x3a3836, roughness: 0.55, metalness: 0.75 }),
    // (the smith's work: polished blades that hold the sky even in the shade of the porch, and gilt fittings)
    steel: std({ color: 0xc4c8d0, roughness: 0.24, metalness: 0.95 }),
    gilt: std({ color: 0xd9a64a, roughness: 0.3, metalness: 0.92 }),
    pottery: std({ roughness: 0.35, metalness: 0.0 }),
    bark: std({ map: T('bark-albedo', { repeat: 1.4 }), normalMap: T('bark-normal', { srgb: false, repeat: 1.4 }), roughness: 0.95 }, { wind: true }),
    foliage: sharpenAlpha(std({ map: T('foliage-atlas'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }, { wind: true })),
    sign: std({ map: SIGNS.texture, roughness: 0.6 }),
    glow: glowMat(),
    dirtProp: std({ map: T('dirt-albedo', { repeat: 4 }), roughness: 1 }),
  };
  m.foliage.map.colorSpace = THREE.SRGBColorSpace;
  m.depth = {
    default: depthFor(new THREE.MeshStandardMaterial()),
    foliage: depthFor(m.foliage, { wind: true }),
    cloth: depthFor(m.cloth, { wind: true }),
  };
  m.textures = { grass: T('grass-albedo', { repeat: 6 }), dirt: T('dirt-albedo', { repeat: 4.5 }), dirtN: T('dirt-normal', { srgb: false, repeat: 4.5 }), cobble: T('cobble-albedo', { repeat: 2.6 }), cobbleN: T('cobble-normal', { srgb: false, repeat: 2.6 }), stone: T('stone-albedo', { repeat: 3 }), paper: T('paper', { repeat: 1 }), brush: T('brush-stroke'), noise };
  return m;
}

// Assign custom depth materials so visibility flags apply to shadows too.
export function applyDepth(meshes, m) {
  for (const mesh of meshes) {
    mesh.customDepthMaterial = mesh.material === m.foliage ? m.depth.foliage : mesh.material === m.cloth ? m.depth.cloth : m.depth.default;
  }
}

// The Forbidden Forest's materials: the same textures, with snow, rain, moss, autumn and the camp's drawn-in stages.
export function createSeasonalMaterials(m) {
  const std = (o, opts) => patch(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }), { burn: false, seasons: true, ...opts });
  const B = {
    bark: std({ map: m.bark.map, normalMap: m.bark.normalMap, roughness: 0.95 }, { wind: true }),
    foliage: sharpenAlpha(std({ map: m.foliage.map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }, { wind: true, foliage: true })),
    stone: std({ map: m.stone.map, normalMap: m.stone.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.92 }),
    timber: std({ map: m.timber.map, normalMap: m.timber.normalMap, color: 0x8a6f5a, roughness: 0.8 }),
    plank: std({ map: m.plank.map, normalMap: m.plank.normalMap, color: 0xd0b392, roughness: 0.82 }),
    straw: std({ map: m.straw.map, normalMap: m.straw.normalMap, roughness: 0.95 }),
    cloth: std({ map: m.cloth.map, roughness: 0.96, side: THREE.DoubleSide }, { wind: true }),
    pottery: std({ roughness: 0.4 }),
    metal: std({ color: 0x3a3836, roughness: 0.5, metalness: 0.75 }),
    dirtProp: std({ map: m.dirtProp.map, roughness: 1 }),
    paper: std({ color: 0xf1e6cc, roughness: 1 }),
    plaster: std({ map: m.plaster.map, normalMap: m.plaster.normalMap, roughness: 0.95 }),
    roof: std({ map: m.straw.map, normalMap: m.straw.normalMap, roughness: 0.95 }),
    glow: m.glow,
  };
  B.depth = {
    default: depthFor(new THREE.MeshStandardMaterial()),
    foliage: depthFor(B.foliage, { wind: true }),
    cloth: depthFor(B.cloth, { wind: true }),
  };
  B.textures = m.textures;
  return B;
}
