// GPU-animated effects. Particles derive their motion from time in the vertex shader, so CPU cost stays flat.
import * as THREE from 'three';
import { U } from './materials.js';
import { rng, clamp } from './util.js';

// Blend presets. The scene's alpha channel is a side channel for the ink pass (post.js): opaque geometry leaves 1,
// open sky 0; smoke adds (ink over the sky), drifting particles pull it down (no outlines round them), fire and
// embers add 4x their coverage (alpha > 1 marks what burns, drawn in vermilion).
const ADD_NOALPHA = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
const FIRE_MARK = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
export const PX = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1.75);
// shared with post.js, which sets it every frame: how much of the frame is being drawn in ink
export const FXU = { uInkK: { value: 0 },
  // the sun as the drifting particles see it (set by post.js before the scene is drawn): pollen, motes and petals
  // light up inside the beams and fall dark in the shade
  uSunDirP: { value: new THREE.Vector3(0, 1, 0) }, uSunColP: { value: new THREE.Color(0, 0, 0) }, uAmbP: { value: new THREE.Color(0.2, 0.22, 0.25) },
  uShadowMatP: { value: new THREE.Matrix4() }, tShadowP: { value: null }, uHasShadowP: { value: 0 } };
const FOG_V = `#include <fog_pars_vertex>`;
const FOG_F = `#include <fog_pars_fragment>`;

function quadGeo() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// ------------------------------------------------------------------ flames
export function createFire(points, maxCount = 900, colors = null) {
  const r = rng(5);
  const pos = [], size = [], seed = [], start = [];
  for (const fp of points) {
    const n = Math.max(2, Math.round(fp.s * 2.4));
    for (let i = 0; i < n && pos.length / 3 < maxCount; i++) {
      pos.push(fp.p.x + r.range(-0.9, 0.9) * fp.s * 0.6, fp.p.y + r.range(-0.4, 0.3), fp.p.z + r.range(-0.9, 0.9) * fp.s * 0.6);
      const w = fp.s * r.range(0.55, 1.0);
      size.push(w, w * r.range(1.6, 2.6));
      seed.push(r() * 100);
      start.push(clamp((fp.delay ?? 0) + r.range(0, 0.12)));
    }
  }
  const g = quadGeo();
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(size), 2));
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seed), 1));
  g.setAttribute('aStart', new THREE.InstancedBufferAttribute(new Float32Array(start), 1));
  g.instanceCount = pos.length / 3;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, ...FIRE_MARK,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAmt: { value: 0 }, uFade: { value: 1 }, uC0: { value: new THREE.Color(...(colors ? colors[0] : [0.9, 0.12, 0.02])) }, uC1: { value: new THREE.Color(...(colors ? colors[1] : [1, 0.55, 0.12])) }, uC2: { value: new THREE.Color(...(colors ? colors[2] : [1, 0.8, 0.45])) } }]),
    vertexShader: `attribute vec3 aPos; attribute vec2 aSize; attribute float aSeed,aStart; uniform float uAmt,uTime; varying vec2 vUv; varying float vSeed,vGrow,vNear;
${FOG_V}
void main(){
  vUv=uv; vSeed=aSeed;
  float grow=smoothstep(aStart,aStart+.18,uAmt);
  vGrow=grow;
  vec3 toCam=cameraPosition-aPos; toCam.y=0.; vec3 right=normalize(cross(vec3(0.,1.,0.),normalize(toCam+vec3(1e-4))));
  float flick=1.+sin(uTime*7.+aSeed)*.08+sin(uTime*13.+aSeed*2.)*.05;
  // seen from above the flames turn to face the lens (screen-up), so they are never thin slivers or blocks
  vec3 camUp=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]), camRight=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
  float down=smoothstep(.35,.8,normalize(aPos-cameraPosition).y*-1.);
  vec3 upV=normalize(mix(vec3(0.,1.,0.),camUp,down)); right=normalize(mix(right,camRight,down));
  vec3 p=aPos+right*position.x*aSize.x*(.6+.4*grow)+upV*position.y*aSize.y*grow*flick;
  vec4 mvPosition=viewMatrix*vec4(p,1.);
  vNear=smoothstep(aSize.y*.25,aSize.y*1.2,length(cameraPosition-aPos));
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime,uFade; uniform vec3 uC0,uC1,uC2; uniform sampler2D uNoise; varying vec2 vUv; varying float vSeed,vGrow,vNear;
${FOG_F}
void main(){
  float x=vUv.x-.5, y=vUv.y;
  float t=uTime*(1.4+fract(vSeed)*.6);
  float n=texture2D(uNoise,vec2(x*.7+vSeed*.13,y*.55-t*.55)).r;
  float n2=texture2D(uNoise,vec2(x*1.6+vSeed,y*1.2-t*1.1)).a;
  float wob=(n-.5)*.55*y+(n2-.5)*.18;
  float w=pow(max(1.-y,0.),.75)*.5*(.75+n*.5);
  float shape=1.-smoothstep(w*.35,w,abs(x+wob));
  shape*=smoothstep(0.,.1,y)*(1.-smoothstep(.45,1.,y+(n2-.5)*.5));
  float heat=clamp(shape*(1.25-y*1.2),0.,1.);
  vec3 col=mix(uC0,uC1,smoothstep(.15,.55,heat));
  col=mix(col,uC2,smoothstep(.65,.98,heat));
  float a=shape*vGrow*uFade*vNear;
  gl_FragColor=vec4(col*a*1.15,a);
  #include <fog_fragment>
  gl_FragColor=vec4(gl_FragColor.rgb*a,a*4.);
}`,
  });
  mat.uniforms.uTime = U.uTime;
  mat.uniforms.uNoise = U.uNoise;
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  mesh.name = 'fire';
  return { mesh, uniforms: mat.uniforms };
}

// ------------------------------------------------------------------ smoke / steam
export function createSmoke(emitters, { count = 400, color = [0.08, 0.075, 0.07], glow = [1, 0.35, 0.1], height = 26, spread = 5, size = [2, 9], speed = [0.03, 0.06], alpha = 0.55, wind = [5, 1.5] } = {}) {
  const r = rng(9);
  const emit = [], seed = [], life = [], start = [];
  for (let i = 0; i < count; i++) {
    const e = emitters[i % emitters.length];
    emit.push(e.p.x + r.range(-1, 1) * (e.s || 1), e.p.y, e.p.z + r.range(-1, 1) * (e.s || 1));
    seed.push(r());
    life.push(r.range(speed[0], speed[1]));
    start.push(clamp((e.delay ?? 0) + r.range(0, 0.1)));
  }
  const g = quadGeo();
  g.setAttribute('aEmit', new THREE.InstancedBufferAttribute(new Float32Array(emit), 3));
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seed), 1));
  g.setAttribute('aLife', new THREE.InstancedBufferAttribute(new Float32Array(life), 1));
  g.setAttribute('aStart', new THREE.InstancedBufferAttribute(new Float32Array(start), 1));
  g.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uAmt: { value: 0 }, uCol: { value: new THREE.Color(...color) }, uGlow: { value: new THREE.Color(...glow) }, uGlowAmt: { value: 1 }, uInkK: { value: 0 },
      uH: { value: height }, uSpread: { value: spread }, uSize: { value: new THREE.Vector2(...size) }, uAlpha: { value: alpha }, uWind: { value: new THREE.Vector2(...wind) },
    }]),
    vertexShader: `attribute vec3 aEmit; attribute float aSeed,aLife,aStart; uniform float uAmt,uTime,uH,uSpread; uniform vec2 uSize,uWind; varying vec2 vUv; varying float vAge,vSeed,vOn,vNear;
${FOG_V}
void main(){
  vUv=uv; vSeed=aSeed;
  float age=fract(uTime*aLife+aSeed);
  vAge=age;
  vOn=smoothstep(aStart,aStart+.15,uAmt);
  vec3 c=aEmit+vec3(sin(aSeed*40.)*uSpread*age+uWind.x*age*age,age*uH,cos(aSeed*30.)*uSpread*age+uWind.y*age*age);
  float s=mix(uSize.x,uSize.y,sqrt(age));
  vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
  vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
  float rot=aSeed*6.28+uTime*.1*(aSeed-.5);
  vec2 q=(position.xy-vec2(0.,.5));
  q=mat2(cos(rot),-sin(rot),sin(rot),cos(rot))*q;
  vec3 p=c+(right*q.x+up*q.y)*s;
  vec4 mvPosition=viewMatrix*vec4(p,1.);
  vNear=smoothstep(s*.35,s*1.6,-(viewMatrix*vec4(c,1.)).z);
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uCol,uGlow; uniform float uAlpha,uGlowAmt,uTime,uInkK; uniform sampler2D uNoise; varying vec2 vUv; varying float vAge,vSeed,vOn,vNear;
${FOG_F}
void main(){
  vec2 d=vUv-.5;
  float n=texture2D(uNoise,vUv*.6+vec2(vSeed,uTime*.01)).r;
  float a=smoothstep(.5,.1,length(d)+(n-.5)*.35);
  a*=smoothstep(0.,.12,vAge)*(1.-smoothstep(.55,1.,vAge))*uAlpha*vOn*vNear;
  // dense smoke: dark, ragged, lit from below by the flames only while it is young and low
  vec3 col=uCol*(.55+n*.7)+uGlow*uGlowAmt*.42*pow(1.-smoothstep(.0,.38,vAge),2.)*(.5+n*.8);
  gl_FragColor=vec4(col,a);
  #include <fog_fragment>
  // in the ink world smoke is drawn as dense black ink: unlit, unfogged, heavier
  gl_FragColor=mix(gl_FragColor,vec4(uCol*.3,clamp(a*1.7,0.,1.)),uInkK);
}`,
  });
  mat.uniforms.uTime = U.uTime;
  mat.uniforms.uNoise = U.uNoise;
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  return { mesh, uniforms: mat.uniforms };
}

// ------------------------------------------------------------------ point particles (embers, ash, pollen, sparks, petals, vapour, leaves, snow, motes)
export function createPoints({ count, mode, emitters = null, box = [60, 30, 60], color = [1, 0.5, 0.15], size = 4, additive = true, speed = 0.1, height = 20 }) {
  const r = rng(13 + count);
  const a = new Float32Array(count * 4), e = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    a.set([r(), r(), r(), r()], i * 4);
    if (emitters) { const em = emitters[i % emitters.length]; e.set([em.p.x + r.range(-1, 1) * (em.s || 1), em.p.y, em.p.z + r.range(-1, 1) * (em.s || 1)], i * 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(e, 3));
  g.setAttribute('aRand', new THREE.BufferAttribute(a, 4));
  const modes = { embers: 0, ash: 1, pollen: 2, sparks: 3, petals: 4, vapor: 5, leaves: 6, snow: 7, motes: 8 };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    // colour blends as usual; the scene alpha is pulled down under each particle so the ink pass draws no outlines
    // around them (it reads alpha < 1 over geometry as "particle here")
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    ...(['embers', 'sparks', 'vapor'].includes(mode) ? FIRE_MARK : {}),
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uAmt: { value: 0 }, uCol: { value: new THREE.Color(...color) }, uSize: { value: size }, uBox: { value: new THREE.Vector3(...box) },
      uCenter: { value: new THREE.Vector3() }, uSpeed: { value: speed }, uH: { value: height }, uMode: { value: modes[mode] }, uScale: { value: 1 }, uGustK: { value: 1 },
      uMark: { value: ['embers', 'sparks', 'vapor'].includes(mode) ? 1 : 0 }, uPx: { value: PX },
    }]),
    vertexShader: `#include <packing>
attribute vec4 aRand; uniform float uAmt,uTime,uSize,uSpeed,uH,uMode,uScale,uGustK,uPx,uInkK; uniform vec3 uBox,uCenter; varying float vA; varying vec4 vR; varying vec3 vLit;
uniform vec3 uSunDirP,uSunColP,uAmbP; uniform mat4 uShadowMatP; uniform sampler2D tShadowP; uniform float uHasShadowP;
${FOG_V}
void main(){
  vR=aRand; vLit=vec3(1.);
  int mode=int(uMode+.5);
  vec3 p; float alpha=1.;
  float t=uTime*uSpeed*(.6+aRand.w*.8);
  if(mode==0){ // embers rise from fires
    float age=fract(t+aRand.x);
    p=position+vec3(sin(age*9.+aRand.y*30.)*1.6*age+age*age*6.,age*uH*(.5+aRand.z),cos(age*7.+aRand.x*20.)*1.6*age+age*age*2.);
    alpha=(1.-age)*smoothstep(0.,.05,age);
  } else if(mode==3){ // sparks burst from the anvil
    float c=fract(uTime*.7+aRand.w*.15);
    float age=fract(c*2.+aRand.x*.2);
    vec3 v=vec3((aRand.x-.5)*4.,2.5+aRand.y*3.,(aRand.z-.5)*4.);
    p=position+v*age*.6+vec3(0.,-4.9*age*age*.36,0.);
    alpha=(1.-age)*step(c,.5);
  } else if(mode==5){ // vapour at the fangs: short rising wisps
    float age=fract(t*4.+aRand.x);
    p=position+vec3((aRand.y-.5)*.4,age*.7,(aRand.z-.5)*.4);
    alpha=(1.-age)*smoothstep(0.,.1,age);
  } else { // drifting in a box around the camera
    vec3 drift=mode==1?vec3(1.2,-1.4,.6):mode==2?vec3(.25,.12,.18):mode==4?vec3(.9,-.55,.35):mode==6?vec3(4.2,-.9,1.8)*uGustK:mode==7?vec3(.45,-1.15,.2):vec3(.04,.1,.03);
    float wob=mode==6?2.2:mode==7?1.3:.8;
    // pollen and motes crowd the space in front of the lens (a tighter box pushed ahead of the camera, lifted off
    // the ground) so the few that catch a beam are seen, instead of being spread over the whole valley
    vec3 bx=uBox*(mode==2?vec3(.55,.5,.55):vec3(1.));
    vec3 cc=uCenter;
    if(mode==2||mode==8){ vec3 fw=-vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2]); fw.y=0.; cc+=normalize(fw+1e-5)*bx.x*.3+vec3(0.,bx.y*.2,0.); }
    vec3 q=aRand.xyz*bx+drift*uTime*(.6+aRand.w)+vec3(sin(uTime*.7+aRand.x*40.),sin(uTime*.5+aRand.y*30.)*.5,cos(uTime*.6+aRand.z*20.))*wob;
    q=mod(q-cc+bx*.5,bx)-bx*.5;
    // a few of the pollen motes are midges: they dart in small loops round a slowly drifting point
    if(mode==2&&aRand.y>.47&&aRand.y<.55){ float ti=uTime*(5.+aRand.w*4.); q*=.6; q.y=q.y*.5-bx.y*.25; q+=vec3(sin(ti+aRand.x*20.),sin(ti*1.3+aRand.z*9.)*.5,cos(ti*.9+aRand.y*30.))*(.35+.3*aRand.z); }
    p=cc+q;
    alpha=1.-smoothstep(.3,.5,length(q/bx));
    if(mode==8) alpha*=.5+.5*sin(uTime*2.+aRand.x*30.);
  }
  vA=alpha*uAmt*step(aRand.w,uAmt*1.4+.001);
  vec4 mvPosition=viewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mvPosition;
  float big=(mode==4||mode==6)?1.6:mode==7?1.25:1.;
  // (ash near the lens stays a fleck: a big soft disc reads as dirt on the glass)
  float cap=mode==0?7.:mode==7?18.:mode==1?6.:14.;
  // pollen and petals: small sunlit motes and petals in the air, never blurred discs on the lens
  if(mode==2){ cap=3.2; vA*=smoothstep(2.5,7.,-mvPosition.z)*step(.47,aRand.y); }
  if(mode==4){ cap=7.; vA*=smoothstep(2.,5.,-mvPosition.z)*step(.35,aRand.y); big=1.1; }
  if(mode==6){ cap=9.; vA*=smoothstep(1.5,4.5,-mvPosition.z); }
  if(mode==8){ cap=3.5; vA*=smoothstep(1.2,3.5,-mvPosition.z); }
  // sunlight on the motes, petals and midges: through the shadow map, much brighter seen against the light
  if(mode==2||mode==4||mode==6||mode==8){
    float lit=1.;
    if(uHasShadowP>.5){ vec4 sc=uShadowMatP*vec4(p,1.); vec3 s=sc.xyz/sc.w;
      if(s.x>0.&&s.x<1.&&s.y>0.&&s.y<1.&&s.z<1.) lit=step(s.z-.002,unpackRGBAToDepth(texture2D(tShadowP,s.xy))); }
    float mu=max(dot(normalize(p-cameraPosition),uSunDirP),0.);
    float ph=mode==4||mode==6?.55+1.4*pow(mu,3.):.7+.6*mu+3.2*pow(mu,6.);
    vLit=uAmbP*(mode==4||mode==6?.9:mode==8?.6:.35)+uSunColP*lit*ph;
    if(mode==2&&aRand.y<.55){ vLit*=lit*(.15+5.*pow(.5+.5*sin(uTime*(19.+aRand.x*9.)+aRand.z*50.),14.)); }
  }
  // in the ink world drifting ash and snow are small brush flecks, never discs
  if(mode==1||mode==2||mode==4||mode==6||mode==7) cap=mix(cap,mode==7?4.5:3.,uInkK);
  if(mode==0) cap=mix(cap,4.,uInkK);
  gl_PointSize=min(uSize*(.5+aRand.z)*uScale*big/max(-mvPosition.z,.5)*60.,cap)*uPx;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uCol; uniform float uMode,uTime,uMark,uInkK; varying float vA; varying vec4 vR; varying vec3 vLit;
${FOG_F}
void main(){
  vec2 d=gl_PointCoord-.5;
  int mode=int(uMode+.5);
  float a;
  vec3 col=uCol;
  if(mode==4||mode==6){
    float ang=vR.x*6.28+uTime*(vR.y-.5)*(mode==6?7.:3.);
    mat2 R=mat2(cos(ang),-sin(ang),sin(ang),cos(ang)); vec2 q=R*d;
    a=smoothstep(.5,.35,length(q*vec2(1.,mode==6?2.4:2.2)));
    if(mode==4) col=mix(uCol,vec3(1.,.95,.95),vR.z*.5);
    else col=mix(mix(vec3(.36,.42,.16),vec3(.62,.5,.2),vR.z),vec3(.5,.24,.1),step(.82,vR.y))*(.7+vR.w*.5);
  }
  else if(mode==1){ a=smoothstep(.5,.25,length(d*vec2(1.,1.8))); col=mix(uCol*(.6+vR.y*.6),vec3(.03),uInkK); }
  else if(mode==7){ a=smoothstep(.5,.15,length(d)); col=uCol*(.85+vR.y*.2); }
  else if(mode==2){ float r=length(d); a=smoothstep(.5,.12,r)*.6+smoothstep(.18,.0,r); col=uCol*(1.4+1.2*sin(uTime*3.+vR.x*40.)*.5+.6); }
  else a=smoothstep(.5,0.,length(d));
  if(mode==0||mode==3) col=mix(uCol,vec3(1.,.85,.4),vR.y)*2.2;
  if(mode==8) col=uCol*(1.5+vR.y*2.);
  if(mode==2) col=uCol*(.7+.6*sin(uTime*3.+vR.x*40.)*.5+.3);
  // lit by the sun where it reaches them (ink frames keep the plain flecks)
  if(mode==2||mode==4||mode==6||mode==8) col*=mix(vLit,vec3(1.),uInkK);
  gl_FragColor=vec4(col,a*vA);
  #include <fog_fragment>
  if(uMark>.5) gl_FragColor=vec4(gl_FragColor.rgb*gl_FragColor.a,gl_FragColor.a*4.);
}`,
  });
  mat.uniforms.uTime = U.uTime;
  mat.uniforms.uInkK = FXU.uInkK;
  for (const k of ['uSunDirP', 'uSunColP', 'uAmbP', 'uShadowMatP', 'tShadowP', 'uHasShadowP']) mat.uniforms[k] = FXU[k];
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 10;
  pts.name = mode;
  return { points: pts, uniforms: mat.uniforms, geometry: g };
}

// ------------------------------------------------------------------ birds
export function createBirds(count = 36) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, -0.5, 0.02, -0.05, 0, 0, -0.1, 0, 0, 0.18, 0.5, 0.02, -0.05, 0, 0, -0.1], 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0], 1));
  const mat = new THREE.MeshBasicMaterial({ color: 0x1d1a18, side: THREE.DoubleSide, fog: true });
  mat.onBeforeCompile = s => {
    s.uniforms.uTime = U.uTime;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWing; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float ph=uTime*11.+float(gl_InstanceID)*1.7;
transformed.y+=aWing*sin(ph)*.32;`);
  };
  const im = new THREE.InstancedMesh(g, mat, count);
  im.frustumCulled = false;
  const r = rng(21);
  const birds = Array.from({ length: count }, () => ({ a: r() * 6.28, rad: r.range(20, 70), h: r.range(18, 40), sp: r.range(0.15, 0.3), off: [r.range(-30, 30), r.range(-6, 6), r.range(-30, 30)], flee: [r.range(-1, 1), r.range(0.4, 1), r.range(-1.2, -0.3)] }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    mesh: im,
    update(time, center, flee, visible) {
      im.visible = visible > 0.01;
      birds.forEach((b, i) => {
        const a = b.a + time * b.sp;
        p.set(center.x + Math.cos(a) * b.rad + b.off[0], center.y + b.h + Math.sin(time * 0.7 + i) * 2, center.z + Math.sin(a) * b.rad + b.off[2]);
        p.x += b.flee[0] * flee * 160; p.y += b.flee[1] * flee * 70; p.z += b.flee[2] * flee * 220;
        const dir = Math.atan2(-Math.sin(a), Math.cos(a));
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), flee > 0.05 ? Math.atan2(b.flee[0], b.flee[2]) : dir);
        s.setScalar(1.4 * visible);
        m4.compose(p, q, s);
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ light shafts through the pines
export function createShafts(list) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, ...ADD_NOALPHA, side: THREE.DoubleSide,
    uniforms: { uAmt: { value: 1 }, uCol: { value: new THREE.Color(1, 0.85, 0.55) }, uTime: U.uTime, uNoise: U.uNoise },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uAmt,uTime; uniform vec3 uCol; uniform sampler2D uNoise; varying vec2 vUv; varying vec3 vW;
void main(){
  float n=texture2D(uNoise,vec2(vUv.x*.8+uTime*.01,.2)).r;
  float a=smoothstep(0.,.25,vUv.x)*smoothstep(1.,.75,vUv.x)*smoothstep(0.,.35,vUv.y)*smoothstep(1.,.6,vUv.y);
  a*=.35+n*.65;
  gl_FragColor=vec4(uCol*a*uAmt*.22,1.);
}`,
  });
  for (const s of list) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
    m.position.copy(s.p);
    m.rotation.set(s.rx ?? 0, s.ry ?? 0, s.rz ?? -0.45);
    group.add(m);
  }
  group.renderOrder = 11;
  return { group, uniforms: mat.uniforms };
}

// ------------------------------------------------------------------ the light that falls into the forest
// A burning head with a glare, a hot trail along a curved path (quadratic Bezier A→B→C) and the long streak
// it leaves in the sky. Dimmed where the cloud deck is in front (cloud transmittance from the sky target).
export function createFallingStar() {
  const group = new THREE.Group();
  group.frustumCulled = false;
  const N = 96;
  const pos = [], aS = [], aSide = [], idx = [];
  for (let i = 0; i <= N; i++) for (const sd of [-1, 1]) { pos.push(0, 0, 0); aS.push(i / N); aSide.push(sd); }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
  g.setIndex(idx);
  const U2 = {
    uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() },
    uHead: { value: 0 }, uLen: { value: 0.18 }, uW: { value: 22 }, uAmt: { value: 1 }, uAfter: { value: 1 },
    tSky: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: U.uTime, uNoise: U.uNoise,
  };
  const BEZ = `uniform vec3 uA, uB, uC; vec3 bez(float s){ float r = 1. - s; return r * r * uA + 2. * r * s * uB + s * s * uC; }`;
  const trail = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, ...ADD_NOALPHA, fog: false, side: THREE.DoubleSide,
    uniforms: U2,
    vertexShader: `attribute float aS, aSide; uniform float uHead, uLen, uW; varying float vK, vSide, vS;
${BEZ}
void main(){
  float s = aS * uHead;
  vec3 P = bez(s);
  vec3 T = normalize(bez(min(s + .003, 1.)) - bez(max(s - .003, 0.)) + 1e-5);
  vec3 toCam = normalize(cameraPosition - P);
  vec3 side = normalize(cross(T, toCam) + 1e-5);
  float k = uHead - s;
  float w = uW * mix(1., .3, smoothstep(0., uLen * 2.5, k)) * (1. + length(cameraPosition - P) * .0022);
  P += side * aSide * w;
  vK = k; vSide = aSide; vS = s;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.);
  // it falls kilometres away, beyond the far plane: pin it just inside (still hidden by nearer mountains)
  gl_Position.z = min(gl_Position.z, gl_Position.w * .99999);
}`,
    fragmentShader: `uniform float uLen, uAmt, uAfter, uTime; uniform sampler2D tSky, uNoise; uniform vec2 uRes; varying float vK, vSide, vS;
void main(){
  float hot = exp(-vK / (uLen * .18));
  float tail = exp(-vK / uLen);
  float n = texture2D(uNoise, vec2(vS * 9. - uTime * .05, vSide * .15 + .3)).r;
  float core = exp(-vSide * vSide * 9.), halo = exp(-vSide * vSide * 2.2);
  vec3 c = mix(vec3(1., .36, .08), vec3(1., .78, .42), tail);
  c = mix(c, vec3(1., .97, .9), hot * .8);
  float I = core * (hot * 14. + tail * 3.2) + halo * tail * (.6 + n * .8);
  // the streak it leaves: a dim, ragged afterglow along the whole path
  I += halo * (.18 + n * .3) * uAfter * smoothstep(0., .04, vK);
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).a;
  gl_FragColor = vec4(c * I * uAmt * (.5 + T * .5), 1.);
}`,
  }));
  trail.frustumCulled = false;
  trail.renderOrder = 21;
  // the head: a hard white core with a glare and four-point spikes, always facing the lens
  const hg = new THREE.PlaneGeometry(1, 1);
  const head = new THREE.Mesh(hg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, ...ADD_NOALPHA, fog: false,
    uniforms: { uAmt: U2.uAmt, tSky: U2.tSky, uRes: U2.uRes, uTime: U.uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 c = modelViewMatrix * vec4(0., 0., 0., 1.); float s = length(modelMatrix[0].xyz); c.xy += position.xy * s; gl_Position = projectionMatrix * c; gl_Position.z = min(gl_Position.z, gl_Position.w * .99999); }`,
    fragmentShader: `uniform float uAmt, uTime; uniform sampler2D tSky; uniform vec2 uRes; varying vec2 vUv;
void main(){
  vec2 q = vUv * 2. - 1.; float r = length(q);
  float fl = .85 + .15 * sin(uTime * 37.) * sin(uTime * 23.);
  // a fireball: white-hot core, a broad gold corona, a ragged burning rim
  float rim = texture2D(tSky, vec2(.5)).a * 0. + .5 + .5 * sin(atan(q.y, q.x) * 7. + uTime * 9.);
  float g = exp(-r * r * 26.) * 18. + exp(-r * r * 5.) * 3. * (.8 + rim * .4) + exp(-r * 2.6) * .5;
  g += (exp(-abs(q.x) * 70.) * exp(-abs(q.y) * 2.6) + exp(-abs(q.y) * 70.) * exp(-abs(q.x) * 2.6)) * 1.2;
  vec3 c = mix(vec3(1., .72, .38), vec3(1., .98, .92), smoothstep(.2, .02, r));
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).a;
  gl_FragColor = vec4(c * g * fl * uAmt * (.6 + T * .4) * smoothstep(1., .7, r), 1.);
}`,
  }));
  head.frustumCulled = false;
  head.renderOrder = 22;
  group.add(trail, head);
  group.visible = false;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), tmp = new THREE.Vector3();
  // the path lives in the uniforms (so it can be restaged live: star.uniforms.uA/uB/uC)
  const bez = (s, out) => { const r = 1 - s; return out.copy(U2.uA.value).multiplyScalar(r * r).addScaledVector(U2.uB.value, 2 * r * s).addScaledVector(U2.uC.value, s * s); };
  return {
    group, head, trail, uniforms: U2,
    // the head's glare, as a share of its distance (1: a fireball seen from far off)
    headK: 1,
    setPath(a, b, c) { A.copy(a); B.copy(b); C.copy(c); U2.uA.value.copy(a); U2.uB.value.copy(b); U2.uC.value.copy(c); },
    at: (s, out = new THREE.Vector3()) => bez(s, out),
    // s: head position along the path (0..1), amt: brightness, after: how much of the streak remains
    update(s, amt, after, camera, skyTex, w, h) {
      U2.uHead.value = Math.max(s, 1e-3); U2.uAmt.value = amt; U2.uAfter.value = after;
      U2.tSky.value = skyTex; U2.uRes.value.set(w, h);
      bez(s, tmp);
      head.position.copy(tmp);
      const d = tmp.distanceTo(camera.position);
      head.scale.setScalar(d * 0.13 * this.headK * (0.6 + amt * 0.4));
      head.visible = s < 0.999 && amt > 0.01;
    },
  };
}

// ------------------------------------------------------------------ strands of blood-red qi over the burning valley
// Thin ribbons that drift, curl and twist about their length, in three layers: long ones high over the burning
// village, others along the road home, and a few near the lens around the camera. A pure function of time (their
// motion) and of u (how much of each layer shows: uLayer). In the ink they are marked like the flames, so the ink
// draws them as vermilion brush strokes.
export function createStrands({ village = 8, road = 6, near = 4, seg = 72 } = {}) {
  const r = rng(616);
  const strands = [];
  for (let i = 0; i < village; i++) strands.push([0, r.range(-75, 75), r.range(16, 48), r.range(-50, 105), r.range(45, 110), r.range(0, 6.28), r.range(1.8, 3.6)]);
  for (let i = 0; i < road; i++) {
    const z = r.range(-160, 40), side = r() < 0.5 ? -1 : 1;
    strands.push([1, side * r.range(10, 36), r.range(6, 20), z, r.range(30, 60), r.range(-0.6, 0.6) + (r() < 0.5 ? 0 : Math.PI), r.range(0.8, 1.6)]);
  }
  for (let i = 0; i < near; i++) strands.push([2, r.range(-1, 1), r.range(-1, 1), r.range(-1, 1), r.range(7, 14), r.range(0, 6.28), r.range(0.16, 0.32)]);
  const n = strands.length, V = (seg + 1) * 2;
  const aS = new Float32Array(n * V * 4), aP = new Float32Array(n * V * 4), aQ = new Float32Array(n * V * 4), pos = new Float32Array(n * V * 3);
  const idx = [];
  strands.forEach(([layer, x, y, z, L, yaw, w], k) => {
    const ph = r() * 50, sp = r.range(0.6, 1.4);
    for (let i = 0; i <= seg; i++) for (let sd = 0; sd < 2; sd++) {
      const v = k * V + i * 2 + sd;
      aS.set([i / seg, sd ? 1 : -1, k, layer], v * 4);
      aP.set([x, y, z, L], v * 4);
      aQ.set([yaw, w, ph, sp], v * 4);
    }
    for (let i = 0; i < seg; i++) { const a = k * V + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(aS, 4));
  g.setAttribute('aP', new THREE.BufferAttribute(aP, 4));
  g.setAttribute('aQ', new THREE.BufferAttribute(aQ, 4));
  g.setIndex(idx);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uLayer: { value: new THREE.Vector3(0, 0, 0) }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0.42, 0.02, 0.016) },
  }]);
  uniforms.uTime = U.uTime;
  uniforms.uNoise = U.uNoise;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, ...FIRE_MARK,
    uniforms,
    vertexShader: `attribute vec4 aS, aP, aQ; uniform float uTime; uniform vec3 uLayer, uCam; varying vec2 vV; varying float vA, vFace; varying vec4 vR;
${FOG_V}
vec3 cl(float s, vec3 base, float L, float yaw, float ph, float sp){
  float t = uTime * sp;
  vec3 dir = vec3(cos(yaw + sin(t * .05 + ph) * .35), 0., sin(yaw + sin(t * .05 + ph) * .35));
  vec3 side = vec3(-dir.z, 0., dir.x);
  // the hot wind carries it along its length; waves travel down it and it curls about itself
  vec3 c = base + dir * ((s - .5) * L + sin(t * .11 + ph) * L * .25);
  // long, slow curves (a few broad turns along the length, not a scribble)
  c += side * (sin(s * 6.8 - t * .6 + ph) * L * .045 + sin(s * 3.4 - t * .23 + ph * 3.) * L * .13);
  c.y += sin(s * 5.1 - t * .5 + ph * 1.3) * L * .035 + sin(s * 2.3 + t * .31 + ph) * L * .07 + sin(t * .17 + ph) * L * .04;
  return c;
}
void main(){
  float s = aS.x, sd = aS.y, layer = aS.w, L = aP.w, yaw = aQ.x, ph = aQ.z, sp = aQ.w;
  vec3 base = aP.xyz;
  float amt = layer < .5 ? uLayer.x : layer < 1.5 ? uLayer.y : uLayer.z;
  if (layer > 1.5) {
    // near the lens: wrapped in a box that travels with the camera
    vec3 box = vec3(36., 12., 36.);
    vec3 q = base * box * .5 + vec3(sin(uTime * .07 + ph), 0., cos(uTime * .05 + ph)) * 6.;
    q = mod(q - uCam + box * .5, box) - box * .5;
    base = uCam + q + vec3(0., 1.5, 0.);
    amt *= 1. - smoothstep(.3, .5, length(q.xz / box.xz));
  }
  vec3 c = cl(s, base, L, yaw, ph, sp);
  vec3 T = normalize(cl(min(s + .01, 1.), base, L, yaw, ph, sp) - cl(max(s - .01, 0.), base, L, yaw, ph, sp) + 1e-5);
  // the ribbon twists about its length: its width turns toward and away from the lens
  float tw = s * 4.6 + uTime * .3 * sp + ph;
  vec3 N1 = normalize(cross(T, vec3(0., 1., 0.)) + 1e-5), N2 = cross(N1, T);
  vec3 W = N1 * cos(tw) + N2 * sin(tw);
  float w = aQ.y * pow(max(sin(3.14159 * s), 0.), .5) * (.55 + .3 * sin(s * 13. + ph) + .25 * sin(s * 5.3 - ph));
  vec3 P = c + W * sd * w * .5;
  vec3 toCam = normalize(cameraPosition - c);
  vFace = abs(dot(normalize(cross(T, W)), toCam));
  vV = vec2(s, sd); vR = vec4(ph, sp, L, layer);
  float dCam = length(cameraPosition - c);
  vA = amt * smoothstep(1.5, 5., dCam);
  vec4 mvPosition = viewMatrix * vec4(P, 1.);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uCol; uniform float uTime; uniform sampler2D uNoise; varying vec2 vV; varying float vA, vFace; varying vec4 vR;
${FOG_F}
void main(){
  float s = vV.x, v = vV.y;
  // dry-brush striations along the length, frayed edges, thinning where it turns edge-on
  float st = texture2D(uNoise, vec2(s * vR.z * .09 + vR.x, v * .35 + .5)).r;
  float fr = texture2D(uNoise, vec2(s * vR.z * .4 - uTime * .01, vR.x * .1)).g;
  float edge = smoothstep(1., .55 - fr * .35, abs(v));
  float a = edge * (.45 + .75 * smoothstep(.25, .75, st)) * smoothstep(0., .08, s) * smoothstep(1., .9, s) * (.55 + .45 * vFace) * vA;
  vec3 col = uCol * (.75 + .5 * st) * (.7 + .5 * vFace);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * gl_FragColor.a, gl_FragColor.a * 4.);
}`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 13;
  mesh.name = 'strands';
  return { mesh, uniforms: mat.uniforms };
}
