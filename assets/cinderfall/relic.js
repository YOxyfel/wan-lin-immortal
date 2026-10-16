// What fell from the sky: a hand scroll in silk and paper, gold ink that wakes as it unrolls. Also his bow and arrow.
import * as THREE from 'three';
import { GLYPHS } from './glyphs.js';
import { U } from './materials.js';
import { rng, lerp, clamp, smooth } from './util.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// the paper: aged, mounted in silk, columns of text; alpha marks the gold that glows
function scrollCanvas() {
  const W = 2048, H = 520;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const r = rng(1999);
  // paper
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#d9c9a3'); g.addColorStop(0.5, '#e8dbbb'); g.addColorStop(1, '#d4c29a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.globalAlpha = 0.07;
  for (let i = 0; i < 2400; i++) { x.fillStyle = r() < 0.5 ? '#6b5434' : '#fff8e6'; x.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2); }
  x.globalAlpha = 0.12;
  for (let i = 0; i < 26; i++) { const rr = 20 + r() * 90; const gr = x.createRadialGradient(0, 0, 0, 0, 0, rr); gr.addColorStop(0, '#8a6a3a'); gr.addColorStop(1, 'rgba(138,106,58,0)'); x.save(); x.translate(r() * W, r() * H); x.fillStyle = gr; x.fillRect(-rr, -rr, rr * 2, rr * 2); x.restore(); }
  x.globalAlpha = 1;
  // silk mounting at the start: deep indigo with a gold lattice
  x.fillStyle = '#1d2240'; x.fillRect(0, 0, 230, H);
  x.strokeStyle = 'rgba(214,170,80,.7)'; x.lineWidth = 2;
  for (let i = -10; i < 30; i++) { x.beginPath(); x.moveTo(i * 26, 0); x.lineTo(i * 26 + H * 0.5, H); x.stroke(); x.beginPath(); x.moveTo(i * 26 + H * 0.5, 0); x.lineTo(i * 26, H); x.stroke(); }
  x.fillStyle = '#c9a24a'; x.fillRect(226, 0, 8, H);
  x.fillStyle = '#8b6b2c'; x.fillRect(0, 0, W, 10); x.fillRect(0, H - 10, W, 10);
  const glyph = (ch, cx, cy, size, fill) => { const gl = GLYPHS[ch]; if (!gl) return; x.save(); x.translate(cx - size / 2, cy - size * 0.5); x.scale(size / 1000, size / 1000); x.fillStyle = fill; x.fill(new Path2D(gl.d)); x.restore(); };
  // title column on the silk
  x.fillStyle = '#e8dbbb'; x.fillRect(150, 40, 54, 300);
  ['玄', '天', '道', '經'].forEach((ch, i) => glyph(ch, 177, 82 + i * 70, 50, '#1b1611'));
  // body text: columns right to left after the mounting, then the great sign in gold
  const pool = '道經神仙靈心劍古星墜封印天玄命劫火夜無痕江之一'.split('').filter(ch => GLYPHS[ch]);
  const gold = [];
  let col = 0;
  for (let cx = 300; cx < W - 120; cx += 56) {
    if (cx > 430 && cx < 800) continue;
    for (let j = 0; j < 8; j++) {
      const ch = pool[(col * 7 + j * 3) % pool.length];
      const isGold = (col + j) % 5 === 0;
      glyph(ch, cx, 58 + j * 56, 40, isGold ? '#a8792a' : '#1b1611');
      if (isGold) gold.push([cx, 58 + j * 56, 40]);
    }
    col++;
  }
  // the great sign, early on the scroll, so it is the first thing that opens between his hands
  glyph('玄', 614, 252, 300, '#b0802e');
  gold.push([614, 252, 300]);
  // a cinnabar seal
  x.fillStyle = '#a3201a'; x.fillRect(742, 352, 96, 96);
  glyph('印', 790, 402, 74, '#ead7b8');
  // alpha: where gold ink lies (for the glow)
  const a = document.createElement('canvas');
  a.width = W; a.height = H;
  const y = a.getContext('2d');
  y.fillStyle = '#000'; y.fillRect(0, 0, W, H);
  // simplest: derive the gold mask from the painted colour
  const img = x.getImageData(0, 0, W, H), d = img.data;
  const out = y.getImageData(0, 0, W, H), o = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    const isGold = R > 140 && R < 200 && G > 95 && G < 150 && B < 70 && R - B > 90;
    const v = isGold ? 255 : 0;
    o[i] = o[i + 1] = o[i + 2] = v; o[i + 3] = 255;
  }
  y.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const glow = new THREE.CanvasTexture(a);
  glow.colorSpace = THREE.NoColorSpace;
  return { tex, glow };
}

export function createScroll() {
  const group = new THREE.Group();
  group.name = 'scroll';
  const L = 1.5, Wd = 0.38, R = 0.03, TH = 0.0016;
  const { tex, glow } = scrollCanvas();
  const uni = { uU: { value: 0 }, uL: { value: L }, uR: { value: R }, uTh: { value: TH }, uGlow: { value: 0 }, tGlow: { value: glow }, uTime: U.uTime };
  const paperMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
  paperMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uU, uL, uR, uTh;
vec3 rollP(float s, float t){
  float cx = uU * uL;
  if (s <= cx) return vec3(s, 0., t);
  float d = s - cx;
  float wound = uL - cx;
  float rr = uR + uTh * (wound - d) / (6.2831 * uR);
  float a = d / max(rr, 1e-3);
  float rc = uR + uTh * wound / (6.2831 * uR);
  return vec3(cx + sin(a) * rr, rc - cos(a) * rr, t);
}`).replace('#include <beginnormal_vertex>', `vec3 pA = rollP(position.x, position.z), pB = rollP(position.x + .004, position.z), pC = rollP(position.x, position.z + .004);
vec3 objectNormal = normalize(cross(pC - pA, pB - pA));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(1., 0., 0.);
#endif`).replace('#include <begin_vertex>', 'vec3 transformed = pA;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow, uTime; uniform sampler2D tGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float gm = texture2D(tGlow, vMapUv).r;
totalEmissiveRadiance += vec3(1., .68, .26) * gm * uGlow * (1.3 + .3 * sin(uTime * 3. + vMapUv.x * 20.));
totalEmissiveRadiance += diffuseColor.rgb * vec3(1., .85, .6) * uGlow * .12;`);
  };
  paperMat.customProgramCacheKey = () => 'cf-scroll-paper';
  const g = new THREE.PlaneGeometry(L, Wd, 160, 2);
  g.rotateX(-Math.PI / 2);
  g.translate(L / 2, 0, 0);
  const paper = new THREE.Mesh(g, paperMat);
  paper.castShadow = true; paper.receiveShadow = true;
  paper.frustumCulled = false;
  group.add(paper);
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89b45, roughness: 0.3, metalness: 0.9, emissive: 0x3a2400, emissiveIntensity: 0.4 });
  const rod = () => { const r = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, Wd + 0.1, 12), wood); c.rotation.x = Math.PI / 2; r.add(c); for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.05, 12), gold); k.rotation.x = Math.PI / 2; k.position.z = s * (Wd / 2 + 0.07); r.add(k); } return r; };
  const stave = rod();
  group.add(stave);
  const roller = rod();
  group.add(roller);
  const light = new THREE.PointLight(0xffb070, 0, 7, 1.8);
  light.position.set(L * 0.5, 1.05, 0);
  group.add(light);
  return {
    group, light, xuanX: L * 614 / 2048,
    update(unroll, glowAmt) {
      uni.uU.value = clamp(unroll);
      uni.uGlow.value = glowAmt;
      const cx = unroll * L, wound = L - cx;
      const rc = R + TH * wound / (6.2831 * R);
      roller.position.set(cx, rc, 0);
      roller.scale.setScalar(1 + wound * 0.06);
      stave.position.set(0, 0.016, 0);
      light.intensity = glowAmt * 4.5;
      light.position.set(Math.max(0.2, cx * 0.5), 1.05, 0.25);
    },
  };
}

// a recurve bow with a string that draws back, and one arrow
export function createBow() {
  const group = new THREE.Group();
  group.name = 'bow';
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2d1a, roughness: 0.6 });
  const wrap = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9 });
  const limbPts = k => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16 * 2 - 1;
      const y = t * 0.68;
      const z = -(1 - t * t) * (0.2 + k * 0.1) - Math.pow(Math.abs(t), 5) * 0.06;
      pts.push(new THREE.Vector3(0, y, z));
    }
    return pts;
  };
  let bowMesh = null;
  const setBend = k => {
    if (bowMesh) { bowMesh.geometry.dispose(); group.remove(bowMesh); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(limbPts(k)), 40, 0.013, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const yy = p.getY(i); const s = 1 - Math.abs(yy) / 0.68 * 0.45; p.setX(i, p.getX(i) * (s + 0.3)); p.setZ(i, p.getZ(i)); }
    bowMesh = new THREE.Mesh(geo, wood);
    bowMesh.castShadow = true;
    group.add(bowMesh);
  };
  setBend(0);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), wrap);
  grip.position.z = -0.2;
  group.add(grip);
  const strMat = new THREE.LineBasicMaterial({ color: 0xd8d0c0 });
  const strGeo = new THREE.BufferGeometry().setFromPoints([V3(), V3(), V3()]);
  const string = new THREE.Line(strGeo, strMat);
  group.add(string);
  // arrow (child of the scene, positioned by the caller)
  const arrow = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.7 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.78, 5), shaftMat);
  shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.39; arrow.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 4), new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.8, roughness: 0.35 }));
  head.rotation.x = Math.PI / 2; head.position.z = 0.8; arrow.add(head);
  const fl = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, side: THREE.DoubleSide, roughness: 0.9 });
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.1), fl); f.position.set(Math.cos(i * 2.09) * 0.012, Math.sin(i * 2.09) * 0.012, 0.07); f.rotation.set(Math.PI / 2, 0, i * 2.09); arrow.add(f); }
  let lastBend = -1;
  return {
    group, arrow,
    // draw: 0..1 how far the string is pulled back (local -z)
    update(draw) {
      const k = Math.round(draw * 6) / 6;
      if (k !== lastBend) { setBend(k); lastBend = k; }
      const tipZ = -0.06 - k * 0.0;
      const pull = tipZ + draw * 0.52;
      strGeo.setFromPoints([V3(0, 0.68, tipZ), V3(0, 0, pull), V3(0, -0.68, tipZ)]);
      return pull;
    },
  };
}
