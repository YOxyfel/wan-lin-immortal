// The crag east of Cinderfall, and the ones who stand on it the night the village burns: Fen Tian Zong (焚天宗).
// Black robes that come apart into ink, angular iron masks, violet eyes, tall banners bearing the eradication seal.
import * as THREE from 'three';
import { U } from './materials.js';
import { GLYPHS } from './glyphs.js';
import { heightAt } from './layout.js';
import { Kit, M, mcyl } from './geo.js';
import * as V from './vegetation.js';
import { createFire, createPoints } from './fx.js';
import { rng, lerp, smooth, clamp, fbm } from './util.js';
import { applyDepth } from './materials.js';
import { makePerson, pose as posePerson } from './people3d.js';

export const CRAG = { x: 64, z: 6, h: 17 };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const VIOLET = new THREE.Color(0x6b21a8);

// dissolve: discard by noise from the hem upward, leaving a violet ink edge
function dissolving(mat, dis, opts = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDis = dis; sh.uniforms.uNoise = U.uNoise; sh.uniforms.uTime = U.uTime; sh.uniforms.uBase = { value: opts.base ?? 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDW; uniform float uDis,uTime,uBase; uniform sampler2D uNoise;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float dn=texture2D(uNoise,vDW.xz*1.7+vDW.y*.9).r*.6+texture2D(uNoise,vDW.xy*.8).g*.4;
float lvl=uDis*3.2-(vDW.y-uBase)*.32;
if(dn<lvl) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance+=vec3(.42,.13,.7)*smoothstep(lvl+.08,lvl,dn)*step(.001,uDis)*3.;
${opts.rim ? 'totalEmissiveRadiance+=vec3(.42,.13,.7)*pow(clamp(1.-abs(dot(normalize(vViewPosition),normal)),0.,1.),3.)*' + opts.rim + ';' : ''}`);
  };
  mat.customProgramCacheKey = () => 'cf-dis-' + (opts.rim || 0);
  return mat;
}

function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1024;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#141016'); g.addColorStop(1, '#0a080c');
  x.fillStyle = g; x.fillRect(0, 0, 256, 1024);
  x.globalAlpha = 0.12;
  for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? '#000' : '#3a2a44'; x.fillRect(Math.random() * 256, Math.random() * 1024, 1 + Math.random() * 2, 4 + Math.random() * 18); }
  x.globalAlpha = 1;
  x.strokeStyle = '#6b21a8'; x.lineWidth = 10; x.strokeRect(12, 12, 232, 1000);
  x.strokeStyle = '#2a0f3c'; x.lineWidth = 3; x.strokeRect(26, 26, 204, 972);
  const glyph = (ch, cx, cy, size, fill) => { const gl = GLYPHS[ch]; if (!gl) return; x.save(); x.translate(cx - size / 2, cy - size * 0.5); x.scale(size / 1000, size / 1000); x.fillStyle = fill; x.fill(new Path2D(gl.d)); x.restore(); };
  // the eradication seal: a red square stamp around 焚
  x.fillStyle = '#9c1c16'; x.fillRect(38, 70, 180, 180);
  glyph('焚', 128, 166, 150, '#0c0a0d');
  glyph('天', 128, 420, 120, '#7d3fb3');
  glyph('宗', 128, 560, 120, '#7d3fb3');
  // torn hem
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) { x.beginPath(); const px = i * 10 + Math.random() * 6; x.moveTo(px, 1024); x.lineTo(px + 5, 1024 - 20 - Math.random() * 60); x.lineTo(px + 10, 1024); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function sealTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.translate(S / 2, S / 2);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff';
  const ring = (r, w) => { x.lineWidth = w; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); };
  ring(490, 10); ring(452, 4); ring(330, 8); ring(300, 3); ring(150, 6);
  const glyph = (ch, size) => { const gl = GLYPHS[ch]; if (!gl) return; x.save(); x.translate(-size / 2, -size * 0.5); x.scale(size / 1000, size / 1000); x.fill(new Path2D(gl.d)); x.restore(); };
  const chars = ['焚', '天', '宗', '敕', '令', '火', '劫', '夜', '封', '印'];
  chars.forEach((ch, i) => { x.save(); x.rotate((i / chars.length) * Math.PI * 2); x.translate(0, -392); glyph(ch, 74); x.restore(); });
  for (let i = 0; i < 24; i++) { x.save(); x.rotate((i / 24) * Math.PI * 2); x.fillRect(-3, -330, 6, 180); x.restore(); }
  for (let k = 0; k < 2; k++) { x.save(); x.rotate(k * Math.PI / 6); x.lineWidth = 5; x.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 300, Math.sin(a) * 300); } x.stroke(); x.restore(); }
  glyph('焚', 220);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function maskGeometry() {
  const s = new THREE.Shape();
  const pts = [[0, 0.17], [0.1, 0.11], [0.115, -0.01], [0.07, -0.13], [0, -0.19], [-0.07, -0.13], [-0.115, -0.01], [-0.1, 0.11]];
  pts.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: false });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const X = p.getX(i), Y = p.getY(i); p.setZ(i, p.getZ(i) + 0.035 * (1 - Math.abs(X) / 0.115) - 0.012 * (Y < -0.05 ? (-Y - 0.05) * 6 : 0)); }
  g.computeVertexNormals();
  return g;
}

export function createSect(mats, quality) {
  const group = new THREE.Group();
  group.name = 'sect';
  const r = rng(616);
  const gy = heightAt(CRAG.x, CRAG.z);
  const top = gy + CRAG.h;
  // ------------------------------------------------------------ the crag: a karst pillar with a flat crown
  const kit = new Kit();
  {
    const seg = 44, hs = 30, H = CRAG.h + 7;
    const g = new THREE.CylinderGeometry(1, 1, 1, seg, hs, false);
    const pos = g.attributes.position, uvs = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i) + 0.5, a = Math.atan2(pos.getZ(i), pos.getX(i));
      const rad = Math.hypot(pos.getX(i), pos.getZ(i));
      const capped = Math.abs(pos.getY(i)) > 0.499 && rad < 0.99;
      uvs.setXY(i, a * 7.5, py * H);
      let R = lerp(9.8, 5.8, Math.pow(py, 0.62));
      R *= 1 + (fbm(a * 2.2 + 3, py * 3, 3) - 0.5) * 0.5 + (fbm(a * 7.5 + 1, py * 1.2, 2) - 0.5) * 0.26 + Math.sin(py * 19 + a * 3) * 0.03;
      R *= 1 + Math.exp(-Math.pow((py - 0.38) / 0.04, 2)) * 0.1 + Math.exp(-Math.pow((py - 0.72) / 0.035, 2)) * 0.09;
      if (py > 0.95) R *= lerp(1, 0.9, (py - 0.95) / 0.05);
      const rr = capped ? R * rad * (0.92 + fbm(a * 3, 1, 2) * 0.1) : R;
      const y = py * H - 7 + (capped && py > 0.5 ? (fbm(pos.getX(i) * 3, pos.getZ(i) * 3, 2) - 0.5) * 0.5 : 0);
      pos.setXYZ(i, Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
    g.computeVertexNormals();
    const nrm = g.attributes.normal, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const up = nrm.getY(i), n = fbm(pos.getX(i) * 0.4, pos.getZ(i) * 0.4 + pos.getY(i) * 0.3, 2);
      const green = Math.max(0, Math.min(1, (up - 0.45) * 2.5)) * (0.6 + n * 0.5);
      const streak = 0.8 + fbm(Math.atan2(pos.getZ(i), pos.getX(i)) * 12, pos.getY(i) * 0.05, 2) * 0.35;
      col.set([lerp(0.86 * streak, 0.42, green), lerp(0.84 * streak, 0.56, green), lerp(0.8 * streak, 0.3, green)], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    kit.add('stone', g, M(CRAG.x, gy, CRAG.z), { vis: 0 });
    for (let i = 0; i < 16; i++) {
      const a = r() * 6.28, d = r.range(7, 12);
      const bg = new THREE.IcosahedronGeometry(r.range(0.8, 2.2), 1);
      bg.scale(1, r.range(0.5, 0.9), 1);
      const x = CRAG.x + Math.cos(a) * d, z = CRAG.z + Math.sin(a) * d;
      kit.add('stone', bg, M(x, heightAt(x, z), z, r() * 6), { vis: 0, color: 0.75 });
    }
    // a wind-bent pine on the crown and two clinging to the face
    V.pine(kit, CRAG.x + 3.6, top - 0.2, CRAG.z - 3.8, 0.75, r, { vis: 0 });
    V.pine(kit, CRAG.x + 6.2, gy + 9, CRAG.z + 4, 0.55, r, { vis: 0 });
    V.pine(kit, CRAG.x - 1, gy + 5, CRAG.z - 7.5, 0.6, r, { vis: 0 });
  }
  const meshes = kit.build(mats);
  applyDepth(meshes, mats);
  for (const m of meshes) group.add(m);

  // ------------------------------------------------------------ the figures
  const dis = { value: 0 };
  const night = new THREE.Group();
  night.name = 'fentian';
  group.add(night);
  const robeMat = dissolving(new THREE.MeshStandardMaterial({ color: 0x0d0b10, roughness: 0.92, side: THREE.DoubleSide }), dis, { base: top, rim: 0.55 });
  const maskMat = dissolving(new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.32, metalness: 0.88 }), dis, { base: top });
  const trimMat = dissolving(new THREE.MeshStandardMaterial({ color: 0x2a0d40, emissive: VIOLET, emissiveIntensity: 0.9, roughness: 0.6 }), dis, { base: top });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.7, 4.2) });
  // the cultivators: tall figures in black robes (the villagers' body under them), deep hoods with a peak, a
  // mantle over the shoulders, the angular iron mask with violet slits, a violet sash
  const maskG = maskGeometry();
  const slitG = new THREE.BoxGeometry(0.05, 0.009, 0.012);
  // a hood open in front (sphere segment), its peak falling back; a mantle over the shoulders
  const hoodG = new THREE.SphereGeometry(0.142, 18, 12, Math.PI / 2 + 0.78, Math.PI * 2 - 1.56, 0, Math.PI * 0.66);
  hoodG.scale(1.0, 1.12, 1.1);
  const peakG = new THREE.ConeGeometry(0.075, 0.26, 10, 1, true);
  const mantleG = new THREE.CylinderGeometry(0.17, 0.4, 0.5, 20, 3, true, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1);
  const spots = [[-1.6, 0, 1.06], [-1.0, -2.7, 1.0], [-1.0, 2.7, 0.99], [0.4, -4.8, 0.96], [0.4, 4.8, 0.97]];
  const figures = [];
  spots.forEach(([dx, dz, s], i) => {
    const p = makePerson({ seed: 701 + i * 17, robe: [0.045, 0.04, 0.05], under: [0.06, 0.05, 0.07], pants: [0.04, 0.035, 0.04], sash: [0.32, 0.08, 0.5], long: true, female: false, scale: s * 1.08, shadow: true });
    const x = CRAG.x + dx, z = CRAG.z + dz;
    p.root.position.set(x, top, z);
    // face the village
    p.root.rotation.y = Math.atan2(2 - x, 30 - z);
    const head = p.head, chest = p.spine;
    const hood = new THREE.Mesh(hoodG, robeMat); hood.position.set(0, 0.085, -0.012); hood.castShadow = true; head.add(hood);
    const peak = new THREE.Mesh(peakG, robeMat); peak.position.set(0, 0.2, -0.1); peak.rotation.x = -0.62; head.add(peak);
    const mask = new THREE.Mesh(maskG, maskMat); mask.position.set(0, 0.06, 0.068); mask.scale.setScalar(0.92); head.add(mask);
    for (const sx of [-1, 1]) { const sl = new THREE.Mesh(slitG, eyeMat); sl.position.set(sx * 0.038, 0.085, 0.112); head.add(sl); }
    const mantle = new THREE.Mesh(mantleG, robeMat); mantle.position.set(0, 0.12, -0.02); mantle.castShadow = true; chest.add(mantle);
    night.add(p.root);
    figures.push({ f: p.root, person: p, hood, mask, seed: r() * 10 });
  });
  // ink tendrils: the robes come apart into the wind
  const tendrilMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAmt: { value: 0 }, uDis: dis, uNoise: U.uNoise, uTime: U.uTime }]),
    vertexShader: `attribute float aSeed; uniform float uTime, uDis; varying vec2 vUv; varying float vSeed;
#include <fog_pars_vertex>
void main(){
  vUv = uv; vSeed = aSeed;
  vec3 p = position;
  float t = uv.y;
  p.x += sin(uTime * 1.7 + aSeed * 9. + t * 5.) * .25 * t + t * t * (1.2 + uDis * 3.);
  p.z += cos(uTime * 1.3 + aSeed * 7. + t * 4.) * .2 * t;
  p.y += t * t * (.4 + uDis * 2.5);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform float uAmt, uTime, uDis; uniform sampler2D uNoise; varying vec2 vUv; varying float vSeed;
#include <fog_pars_fragment>
void main(){
  float n = texture2D(uNoise, vec2(vUv.x * .7 + vSeed, vUv.y * 1.2 - uTime * .12)).r;
  float edge = 1. - smoothstep(.15, .5, abs(vUv.x - .5) + (n - .5) * .5);
  float a = edge * (1. - smoothstep(.35, 1., vUv.y + (n - .5) * .4)) * uAmt;
  vec3 col = mix(vec3(.02, .015, .03), vec3(.4, .12, .7), smoothstep(.3, .9, vUv.y + (n - .5) * .3) * .5);
  gl_FragColor = vec4(col, a * .85);
  #include <fog_fragment>
}`,
  });
  {
    const parts = [];
    figures.forEach((fg, k) => {
      for (let i = 0; i < 7; i++) {
        const g = new THREE.PlaneGeometry(0.16, 1.5, 1, 10);
        g.translate(0, 0.75, 0);
        const a = (i / 7) * Math.PI * 2;
        const m = new THREE.Matrix4().makeRotationY(a).premultiply(new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.4, 0.02, Math.sin(a) * 0.4));
        g.applyMatrix4(new THREE.Matrix4().makeRotationZ(-1.2));
        g.applyMatrix4(m);
        g.applyMatrix4(new THREE.Matrix4().compose(fg.f.position, fg.f.quaternion, fg.f.scale));
        const n = g.attributes.position.count;
        g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n).fill(k * 7 + i), 1));
        parts.push(g);
      }
    });
    const merged = new THREE.BufferGeometry();
    const geos = parts;
    let count = 0; geos.forEach(g => (count += g.attributes.position.count));
    const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), seed = new Float32Array(count), idx = [];
    let off = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, off * 3); uv.set(g.attributes.uv.array, off * 2); seed.set(g.attributes.aSeed.array, off);
      for (const i of g.index.array) idx.push(i + off);
      off += g.attributes.position.count;
    }
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    merged.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    merged.setIndex(idx);
    const tm = new THREE.Mesh(merged, tendrilMat);
    tm.frustumCulled = false;
    tm.renderOrder = 9;
    night.add(tm);
  }
  // banners
  const bTex = bannerTexture();
  const bannerMat = dissolving(new THREE.MeshStandardMaterial({ map: bTex, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: bTex, emissiveIntensity: 0.06 }), dis, { base: top });
  const inner = bannerMat.onBeforeCompile;
  bannerMat.onBeforeCompile = sh => {
    inner(sh);
    sh.uniforms.uWind = U.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind, uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
float hang = clamp(-position.y / 3.6, 0., 1.);
transformed.z += sin(uTime * 2.3 + position.y * 1.7) * .22 * hang * (.5 + uWind) + hang * hang * .5;
transformed.x += sin(uTime * 1.6 + position.y * 2.3) * .06 * hang;`);
  };
  bannerMat.customProgramCacheKey = () => 'cf-banner';
  const poleMat = dissolving(new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.6, metalness: 0.3 }), dis, { base: top });
  const banners = [];
  for (const [dx, dz] of [[1.2, -1.4], [1.2, 1.6], [0.2, -6.6]]) {
    const b = new THREE.Group();
    b.position.set(CRAG.x + dx, top, CRAG.z + dz);
    b.rotation.y = Math.atan2(2 - b.position.x, 30 - b.position.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 6.8, 8), poleMat);
    pole.position.y = 3.4; pole.castShadow = true; b.add(pole);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 6), poleMat);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 6.5, 0.04); b.add(bar);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 6), trimMat);
    tip.position.y = 7.0; b.add(tip);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 3.6, 4, 18).translate(0, -1.8, 0), bannerMat);
    cloth.position.set(0, 6.45, 0.06); cloth.castShadow = true;
    b.add(cloth);
    night.add(b);
    banners.push(b);
  }
  // the eradication array glowing on the crown
  const sealTex = sealTexture();
  const sealMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { tSeal: { value: sealTex }, uAmt: { value: 0 }, uTime: U.uTime, uNoise: U.uNoise },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform sampler2D tSeal, uNoise; uniform float uAmt, uTime; varying vec2 vUv;
void main(){
  vec2 q = vUv - .5; float a = uTime * .06; q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
  float s = texture2D(tSeal, q + .5).r;
  float n = texture2D(uNoise, vUv * 2. + uTime * .02).r;
  float pulse = .75 + .25 * sin(uTime * 2.4 + length(q) * 12.);
  vec3 col = vec3(.9, .28, 1.7) * s * pulse * (.6 + n * .6) + vec3(.25, .06, .45) * smoothstep(.5, .0, length(q)) * .35;
  gl_FragColor = vec4(col * uAmt, 1.);
}`,
  });
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 9.4), sealMat);
  seal.rotation.x = -Math.PI / 2;
  seal.position.set(CRAG.x - 0.4, top + 0.06, CRAG.z);
  seal.renderOrder = 6;
  night.add(seal);
  // violet fire in two braziers
  const brz = [V3(CRAG.x - 2.6, top, CRAG.z - 5.6), V3(CRAG.x - 2.6, top, CRAG.z + 5.6)];
  const brMat = dissolving(new THREE.MeshStandardMaterial({ color: 0x24201e, roughness: 0.5, metalness: 0.6 }), dis, { base: top });
  for (const p of brz) {
    const bowl = new THREE.Mesh(mcyl(0.42, 0.26, 0.3, 14), brMat); bowl.position.copy(p).add(V3(0, 1.0, 0)); night.add(bowl);
    for (let i = 0; i < 3; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), brMat); const a = i / 3 * 6.28; leg.position.copy(p).add(V3(Math.cos(a) * 0.25, 0.5, Math.sin(a) * 0.25)); leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); night.add(leg); }
  }
  const fire = createFire(brz.map(p => ({ p: p.clone().add(V3(0, 1.15, 0)), s: 0.9 })), 60, [[0.35, 0.05, 0.6], [0.7, 0.3, 1.0], [0.95, 0.85, 1.0]]);
  night.add(fire.mesh);
  const wisps = createPoints({ count: 160, mode: 'vapor', emitters: figures.map(fg => ({ p: fg.f.position.clone().add(V3(0, 0.2, 0)), s: 0.5 })), color: [0.5, 0.16, 0.85], size: 2.2, speed: 0.25 });
  night.add(wisps.points);
  // (the light stays in the scene while the night group comes and goes: a light coming and going recompiles every lit
  // material)
  const light = new THREE.PointLight(0x9a4bff, 0, 26, 1.6);
  light.position.set(CRAG.x - 1.5, top + 1.2, CRAG.z);
  group.add(light);

  const center = V3(CRAG.x - 1, top + 1.2, CRAG.z);
  return {
    group, night, top, center, figures, banners, dis, light,
    // amt: on the crag (0..1), dissolve: coming apart (0..1); look: a point their masks turn to follow, lookK how far
    update(u, time, amt, dissolve, look = null, lookK = 0) {
      night.visible = amt > 0.001;
      if (!night.visible) { light.intensity = 0; return; }
      dis.value = dissolve;
      tendrilMat.uniforms.uAmt.value = amt * (1 - smooth(0.6, 1, dissolve));
      sealMat.uniforms.uAmt.value = amt * (1 - dissolve) * (0.8 + Math.sin(time * 3.1) * 0.08);
      fire.uniforms.uAmt.value = amt * (1 - dissolve);
      fire.mesh.visible = amt > 0.01 && dissolve < 0.98;
      wisps.uniforms.uAmt.value = amt * (0.6 + dissolve * 1.5) * (1 - smooth(0.85, 1, dissolve));
      light.intensity = amt * (1 - dissolve) * (38 + Math.sin(time * 7) * 6);
      figures.forEach((fg, i) => {
        posePerson(fg.person, 'idle', time * 0.6 + fg.seed);
        if (!look || lookK <= 0) return;
        // (the heads turn together, the leader first: neck and head share the turn, a little lift toward it)
        const k = clamp((lookK - (i === 0 ? 0 : 0.12 + i * 0.05)) / 0.6);
        if (k <= 0) return;
        const dx = look.x - fg.f.position.x, dz = look.z - fg.f.position.z, dy = look.y - fg.f.position.y - 1.7;
        let yaw = Math.atan2(dx, dz) - fg.f.rotation.y;
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        yaw = clamp(yaw, -1.25, 1.25) * k;
        const pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.3, 0.45) * k;
        fg.person.neck.rotateY(yaw * 0.4);
        fg.person.head.rotateY(yaw * 0.6);
        fg.person.head.rotateX(-pitch * 0.8);
      });
    },
  };
}
