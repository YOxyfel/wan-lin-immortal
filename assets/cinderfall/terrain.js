// Valley terrain, stream and instanced grass/flowers.
import * as THREE from 'three';
import { heightAt, groundMask, roadX, streamZ, STREAM, VILLAGE, HOUSES, housePlacement, SETBACK, fieldMask, riverD } from './layout.js';
import { U } from './materials.js';
import { rng, smooth, clamp, lerp, fbm } from './util.js';

export function createTerrain(mats, quality) {
  const cols = quality.terrainCols, rows = quality.terrainRows;
  const X0 = -340, X1 = 340, Z0 = -620, Z1 = 300;
  const xAt = i => { const t = i / (cols - 1) * 2 - 1; return Math.sign(t) * Math.pow(Math.abs(t), 1.55) * X1; };
  const zAt = j => { const t = j / (rows - 1); const s = t * 2 - 1; const z0 = -60; return s < 0 ? lerp(Z0, z0, Math.pow(1 + s, 0.62)) : lerp(z0, Z1, Math.pow(s, 1.35)); };
  const pos = new Float32Array(cols * rows * 3), mask = new Float32Array(cols * rows * 4), uv = new Float32Array(cols * rows * 2);
  let k = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++, k++) {
    const x = xAt(i), z = zAt(j), y = heightAt(x, z);
    pos.set([x, y, z], k * 3);
    uv.set([x, z], k * 2);
    mask.set(groundMask(x, z), k * 4);
  }
  const idx = [];
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4));
  g.setIndex(idx);
  g.computeVertexNormals();

  const T = mats.textures;
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, map: T.grass });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U, {
      tGrass: { value: T.grass }, tDirt: { value: T.dirt }, tDirtN: { value: T.dirtN }, tCobble: { value: T.cobble }, tCobbleN: { value: T.cobbleN },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMask; varying vec4 vMask; varying vec3 vTW; varying vec3 vTN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask=aMask; vTN=normal;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvTW=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vMask; varying vec3 vTW; varying vec3 vTN;
uniform sampler2D tGrass,tDirt,tDirtN,tCobble,tCobbleN,uNoise; uniform float uFire,uRuin,uTime;`)
      .replace('#include <map_fragment>', `
vec2 wp=vTW.xz;
float n1=texture2D(uNoise,wp*.012).r, n2=texture2D(uNoise,wp*.07).g, n3=texture2D(uNoise,wp*.31).a;
vec3 grass=texture2D(tGrass,wp/6.).rgb*mix(.82,1.12,n1);
grass=mix(grass,grass*vec3(1.12,1.05,.72),smoothstep(.55,.8,n2)*.5);
vec3 dirt=texture2D(tDirt,wp/4.5).rgb;
vec3 cob=texture2D(tCobble,wp/2.6).rgb;
vec3 field=mix(vec3(.32,.42,.12),vec3(.45,.55,.18),n2)*(.88+.2*sin(wp.x*5.5+wp.y*.6));
vec3 forest=mix(vec3(.16,.15,.1),vec3(.26,.24,.15),n3)*mix(.8,1.1,n1);
float road=smoothstep(.15,.85,vMask.x+(n3-.5)*.5);
float pave=smoothstep(.3,.7,vMask.y+(n2-.5)*.3);
float fld=smoothstep(.2,.7,vMask.z);
float fst=smoothstep(.25,.85,vMask.w+(n1-.5)*.4);
vec3 col=grass;
col=mix(col,field,fld);
col=mix(col,forest,fst*(1.-road));
col=mix(col,dirt,road);
col=mix(col,cob,pave);
// steep slopes show rock/earth
float slope=1.-clamp(normalize(vTN).y,0.,1.);
col=mix(col,dirt*.78,smoothstep(.25,.55,slope)*.7);
// burn scars around the village at night and in the ruins
float scorch=uFire*.0+uRuin*.0;
diffuseColor.rgb=col;
`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
 vec3 dn=texture2D(tDirtN,vTW.xz/4.5).xyz*2.-1.;
 vec3 cn=texture2D(tCobbleN,vTW.xz/2.6).xyz*2.-1.;
 float pave2=smoothstep(.3,.7,vMask.y);
 float road2=smoothstep(.15,.85,vMask.x);
 vec3 tn=normalize(mix(mix(vec3(0,0,1),dn,road2*.7),cn,pave2));
 // ground is mostly horizontal: tangent frame from world axes
 vec3 Nv=normal;
 vec3 Xv=normalize((viewMatrix*vec4(1.,0.,0.,0.)).xyz);
 vec3 Tv=normalize(Xv-Nv*dot(Xv,Nv)); vec3 Bv=cross(Nv,Tv);
 normal=normalize(Tv*tn.x+Bv*tn.y+Nv*tn.z);
}`);
  };
  mat.customProgramCacheKey = () => 'cf-terrain';
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// The stream: a ribbon following streamZ(x) with a stylised water shader.
export function createStream() {
  const segs = 220, X0 = -320, X1 = 320;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const x = lerp(X0, X1, i / segs), z = streamZ(x);
    const dz = (streamZ(x + 1) - streamZ(x - 1)) / 2;
    const nx = -dz, nz = 1, l = Math.hypot(nx, nz);
    const w = STREAM.width * 0.62;
    for (const s of [-1, 1]) {
      pos.push(x + (nx / l) * w * s, -0.75, z + (nz / l) * w * s);
      uv.push(x, s);
    }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSky: { value: new THREE.Color(0.6, 0.75, 0.85) }, uDeep: { value: new THREE.Color(0.08, 0.16, 0.14) }, uGlow: { value: new THREE.Color(0, 0, 0) } }]),
    vertexShader: `varying vec2 vUv; varying vec3 vW;
#include <fog_pars_vertex>
void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uSky,uDeep,uGlow; uniform sampler2D uNoise; uniform float uTime; varying vec2 vUv; varying vec3 vW;
#include <fog_pars_fragment>
void main(){
 vec2 p=vec2(vUv.x*.18-uTime*.35,vUv.y*.9);
 float r=texture2D(uNoise,p*.5).a*.6+texture2D(uNoise,p*.21+vec2(.3,uTime*.02)).g*.4;
 vec3 V=normalize(cameraPosition-vW);
 float fres=pow(clamp(1.-V.y,0.,1.),3.);
 vec3 col=mix(uDeep,uSky,.35+fres*.55);
 col+=uSky*smoothstep(.62,.8,r)*.35;
 col+=uGlow*(.4+r*.6);
 float edge=1.-smoothstep(.75,1.,abs(vUv.y));
 gl_FragColor=vec4(col,.86*edge+.1);
#include <fog_fragment>
}`,
  });
  mat.uniforms.uNoise = U.uNoise;
  mat.uniforms.uTime = U.uTime;
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 2;
  mesh.name = 'stream';
  return mesh;
}

// Instanced grass clumps with wind; denser near the road where the camera travels.
export function createGrass(quality, avoid) {
  const blades = 6, segs = 3;
  const pos = [], tip = [], idx = [];
  const r = rng(77);
  for (let b = 0; b < blades; b++) {
    const ang = r() * Math.PI * 2, off = r() * 0.16, h = r.range(0.28, 0.62), w = r.range(0.025, 0.045), lean = r.range(0.05, 0.3);
    const ox = Math.cos(ang) * off, oz = Math.sin(ang) * off;
    const dx = Math.cos(ang + 1.57), dz = Math.sin(ang + 1.57);
    const base = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, ww = w * (1 - t * 0.92), bend = lean * t * t;
      for (const side of [-1, 1]) {
        pos.push(ox + dx * ww * side + Math.cos(ang) * bend, h * t, oz + dz * ww * side + Math.sin(ang) * bend);
        tip.push(t);
      }
      if (s) { const a = base + (s - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
  g.setIndex(idx);
  const count = quality.grass;
  const offs = new Float32Array(count * 4), cols = new Float32Array(count * 3);
  let n = 0, tries = 0;
  while (n < count && tries < count * 8) {
    tries++;
    const z = r.range(-235, 120);
    const spread = r() < 0.75 ? r.range(1.5, 26) : r.range(26, 90);
    const x = roadX(z) + r.sign() * spread;
    const m = groundMask(x, z);
    if (m[0] > 0.35 || m[1] > 0.2) continue;
    if (avoid(x, z) || riverD(x, z) < 0.6) continue;
    const y = heightAt(x, z);
    const sc = r.range(0.7, 1.35) * (m[3] > 0.5 ? 0.75 : 1) * (m[2] > 0.4 ? 1.25 : 1);
    offs.set([x, y, z, sc], n * 4);
    const dry = r();
    const c = m[2] > 0.4 ? [0.45, 0.6, 0.18] : dry < 0.2 ? [0.62, 0.62, 0.3] : dry < 0.55 ? [0.36, 0.55, 0.16] : [0.28, 0.48, 0.13];
    cols.set(c, n * 3);
    n++;
  }
  g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offs.subarray(0, n * 4), 4));
  g.setAttribute('aColor', new THREE.InstancedBufferAttribute(cols.subarray(0, n * 3), 3));
  g.instanceCount = n;
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aOffset; attribute vec3 aColor; attribute float aTip; varying vec3 vGC; varying float vTip, vRing;
uniform float uTime,uWind,uFire,uRuin; uniform vec2 uGust; uniform vec4 uRing;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal=vec3(0.,1.,0.);')
      .replace('#include <begin_vertex>', `
float a=fract(sin(dot(aOffset.xz,vec2(12.9898,78.233)))*43758.5453)*6.2831;
mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a));
vec3 transformed=position*aOffset.w; transformed.xz=R*transformed.xz;
float ph=uTime*1.9+aOffset.x*.31+aOffset.z*.27;
float g=(sin(ph)*.6+sin(ph*2.3+1.1)*.3+sin(ph*4.7)*.1)*uWind;
transformed.xz+=uGust*g*aTip*aTip*.28*aOffset.w;
transformed.y*=mix(1.,.55,uRuin*0.)*(1.+uRuin*.35);
vRing=0.;
if(uRing.w>0.){
  vec2 rd=aOffset.xz-uRing.xy; float rl=length(rd);
  float rq=(rl-uRing.z)/3.2; float rk=exp(-rq*rq)*uRing.w;
  transformed.xz+=(rl>1e-3?rd/rl:vec2(0.))*rk*aTip*aTip*.62*aOffset.w;
  transformed.y-=rk*aTip*aTip*.22*aOffset.w;
  vRing=rk;
}
transformed+=aOffset.xyz;
vGC=aColor; vTip=aTip;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGC; varying float vTip, vRing; uniform float uFire;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor=vec4(vGC*mix(.42,1.18,vTip),1.);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.,.72,.36)*vRing*vTip*vTip*1.4;');
  };
  mat.customProgramCacheKey = () => 'cf-grass';
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.name = 'grass';
  return mesh;
}

// Wildflowers: tiny five-petal heads on stems.
export function createFlowers(quality, avoid) {
  const r = rng(91);
  const head = new THREE.IcosahedronGeometry(0.045, 0);
  head.scale(1, 0.55, 1);
  head.translate(0, 0.32, 0);
  const stem = new THREE.CylinderGeometry(0.006, 0.008, 0.32, 3);
  stem.translate(0, 0.16, 0);
  const count = quality.flowers;
  const meshes = [];
  const palette = [[0.98, 0.86, 0.28], [0.96, 0.95, 0.9], [0.66, 0.42, 0.85], [0.95, 0.38, 0.32], [0.98, 0.64, 0.72]];
  const headM = new THREE.InstancedMesh(head, new THREE.MeshLambertMaterial({ color: 0xffffff }), count);
  const stemM = new THREE.InstancedMesh(stem, new THREE.MeshLambertMaterial({ color: 0x4a6a24 }), count);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let n = 0;
  for (let t = 0; t < count * 6 && n < count; t++) {
    const z = r.range(-200, 110);
    const x = roadX(z) + r.sign() * r.range(2.2, 40);
    const m = groundMask(x, z);
    if (m[0] > 0.3 || m[1] > 0.1 || m[2] > 0.3) continue;
    if (avoid(x, z) || riverD(x, z) < 1.2) continue;
    // flowers grow in drifts
    if (fbm(x * 0.08, z * 0.08, 2) < 0.52) continue;
    const s = r.range(0.7, 1.4);
    m4.compose(new THREE.Vector3(x, heightAt(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(-0.2, 0.2), r() * 6, r.range(-0.2, 0.2))), new THREE.Vector3(s, s, s));
    headM.setMatrixAt(n, m4); stemM.setMatrixAt(n, m4);
    const p = palette[Math.floor(fbm(x * 0.03, z * 0.03, 2) * 9) % palette.length];
    headM.setColorAt(n, col.setRGB(p[0], p[1], p[2]));
    n++;
  }
  headM.count = stemM.count = n;
  for (const im of [headM, stemM]) { im.receiveShadow = true; im.name = 'flowers'; meshes.push(im); }
  return meshes;
}
