// The great bolt: the charge gathered in the storm comes down at once, a channel a kilometre long with a crown of
// forks, from the cloud to the ground beyond the western ridges. Its leader is drawn by the story position (the
// camera rides down with its tip), then the return stroke: blinding, re-striking, fading. Built from the same arcs as
// the storm's lightning.
import * as THREE from 'three';
import { BOLT_VS, jag, perp } from './weather.js';
import { rng, clamp, lerp } from './util.js';

const MAXSEG = 2600;
// the arc's own shader, with the cloud it runs through: what is deep in the cloud (between it and the eye) is lost in it
// (each segment's quad runs on a little past its ends, so the bends leave no gaps; drawn with MAX, the overlaps leave
// no seams either: seen from close by, the channel is one body of light, not a stack of pieces)
const VS = BOLT_VS.replace('varying float vSide, vBright, vAlong;', 'varying float vSide, vBright, vAlong; varying vec3 vW;').replace('vSide = aInfo.y;', 'vW = P; vSide = aInfo.y;')
  .replace('P += side * aInfo.y * w;', 'P += side * aInfo.y * w + dir * (aInfo.x * 2. - 1.) * w * .6;');
const FS = `uniform float uAmt, uReveal; uniform vec3 uCol; uniform vec3 uCam; uniform float uBase, uVis; varying float vSide, vBright, vAlong; varying vec3 vW;
float cloudAtt(vec3 p){
  vec3 d = p - uCam; float L = length(d);
  float y0 = uCam.y, y1 = p.y, inL;
  if (y0 >= uBase && y1 >= uBase) inL = L;
  else if (y0 < uBase && y1 < uBase) inL = 0.;
  else inL = L * (max(y0, y1) - uBase) / max(abs(y1 - y0), 1e-3);
  return exp(-inL / uVis);
}
void main(){
  if (vAlong > uReveal) discard;
  float core = exp(-vSide * vSide * 60.), sheath = exp(-vSide * vSide * 9.), halo = exp(-vSide * vSide * 2.2);
  float head = 1. + smoothstep(uReveal - .05, uReveal, vAlong) * 2.5 * step(uReveal, .999);
  vec3 c = mix(vec3(1.), uCol, .26) * core * 15. + mix(vec3(.62, .84, 1.), uCol, .72) * sheath * 3.6 + uCol * uCol * halo * 1.15;
  float at = cloudAtt(vW);
  // (deep in the cloud only its glow comes through: the core goes first)
  c = mix(c * vec3(.35, .45, .8) * .5, c, at) * mix(.12, 1., at);
  gl_FragColor = vec4(c * vBright * vBright * uAmt * head, min((core + sheath * .6) * 6. * vBright, 4.) * smoothstep(.02, .15, uAmt) * at);
}`;

export function createMegaBolt() {
  const g = new THREE.BufferGeometry();
  const n = MAXSEG * 4;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aB', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  g.setAttribute('aBright', new THREE.BufferAttribute(new Float32Array(n), 1));
  const idx = new Uint32Array(MAXSEG * 6);
  for (let s = 0; s < MAXSEG; s++) idx.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4 + 1, s * 4 + 3, s * 4 + 2], s * 6);
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uAmt: { value: 0 }, uReveal: { value: 0 }, uCol: { value: new THREE.Color(0.55, 0.55, 1.0) }, uCam: { value: new THREE.Vector3() }, uBase: { value: 620 }, uVis: { value: 260 } },
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 21;
  mesh.name = 'mega-bolt';
  let main = [];
  return {
    mesh, uniforms: mat.uniforms,
    // crawlY: the height of the cloud's base, along which its arms crawl out
    build(top, bottom, seed = 9137, crawlY = 600) {
      const r = rng(seed);
      main = jag(top, bottom, 0.1, 7, r);
      const total = main.length - 1, segs = [];
      for (let k = 0; k < total; k++) segs.push([main[k], main[k + 1], 7.5, k / total, 1]);
      // the crown of forks: long ones from high on the channel reaching out through the cloud, shorter ones lower
      for (let i = 0; i < 22; i++) {
        const k = Math.floor(lerp(0.02, 0.8, Math.pow(r(), 1.3)) * total);
        const start = main[k];
        const dir = main[Math.min(total, k + 6)].clone().sub(start).normalize();
        dir.addScaledVector(perp(dir, r), lerp(0.7, 1.6, r())).normalize();
        if (k < total * 0.25) dir.y = Math.max(dir.y, -0.2);       // high up they run sideways through the cloud
        const len = top.distanceTo(bottom) * lerp(0.12, 0.42, r()) * (1 - (k / total) * 0.55);
        const sub = jag(start, start.clone().addScaledVector(dir, len), 0.22, 5, r);
        for (let j = 0; j < sub.length - 1; j++) segs.push([sub[j], sub[j + 1], 3.6 * (1 - (j / sub.length) * 0.55), k / total + (j / (sub.length - 1)) * 0.22, 0.75 * (1 - (j / sub.length) * 0.35)]);
        if (r() < 0.7) {
          const j0 = Math.floor(sub.length * lerp(0.25, 0.6, r()));
          const d2 = sub[Math.min(sub.length - 1, j0 + 2)].clone().sub(sub[j0]).normalize().addScaledVector(perp(dir, r), 0.9).normalize();
          const sub2 = jag(sub[j0], sub[j0].clone().addScaledVector(d2, len * 0.45), 0.25, 4, r);
          for (let j = 0; j < sub2.length - 1; j++) segs.push([sub2[j], sub2[j + 1], 1.8, k / total + 0.1 + (j / (sub2.length - 1)) * 0.15, 0.5]);
        }
      }
      // the spider: long arms crawling out along the underside of the cloud from where the channel leaves it,
      // twigs off them, so the whole base of the storm is drawn in light for a moment
      const kb = main.reduce((best, p, i) => (Math.abs(p.y - crawlY) < Math.abs(main[best].y - crawlY) ? i : best), 0);
      for (let i = 0; i < 9; i++) {
        const k = Math.max(0, Math.min(total - 1, kb + Math.floor((r() - 0.5) * 6)));
        const start = main[k];
        const a = (i / 9) * Math.PI * 2 + r() * 0.6;
        const dir = new THREE.Vector3(Math.cos(a), lerp(-0.05, 0.03, r()), Math.sin(a)).normalize();
        const len = lerp(500, 1500, r());
        const sub = jag(start, start.clone().addScaledVector(dir, len), 0.12, 6, r);
        const n1 = sub.length - 1;
        for (let j = 0; j < n1; j++) segs.push([sub[j], sub[j + 1], 3.0 * (1 - (j / n1) * 0.6), k / total + (j / n1) * 0.35, 0.85 * (1 - (j / n1) * 0.45)]);
        for (let t = 0; t < 3; t++) {
          const j0 = Math.floor(n1 * lerp(0.2, 0.9, r()));
          const d2 = sub[Math.min(n1, j0 + 2)].clone().sub(sub[j0]).normalize().addScaledVector(perp(dir, r), 1.1).normalize();
          d2.y = Math.min(d2.y, 0.05);
          const sub2 = jag(sub[j0], sub[j0].clone().addScaledVector(d2, len * lerp(0.12, 0.3, r())), 0.25, 4, r);
          const n2 = sub2.length - 1;
          for (let j = 0; j < n2; j++) segs.push([sub2[j], sub2[j + 1], 1.5, k / total + (j0 / n1) * 0.35 + (j / n2) * 0.1, 0.55]);
        }
      }
      const P = g.attributes.position, B = g.attributes.aB, I = g.attributes.aInfo, Br = g.attributes.aBright;
      const ns = Math.min(MAXSEG, segs.length);
      for (let s = 0; s < ns; s++) {
        const [a, c, w, along, br] = segs[s];
        for (let v = 0; v < 4; v++) {
          const i = s * 4 + v;
          P.setXYZ(i, a.x, a.y, a.z);
          B.setXYZ(i, c.x, c.y, c.z);
          I.setXYZW(i, v >> 1, (v & 1) ? 1 : -1, w, Math.min(1, along));
          Br.setX(i, br);
        }
      }
      for (const at of [P, B, I, Br]) at.needsUpdate = true;
      g.setDrawRange(0, ns * 6);
    },
    // where the leader's tip is at reveal fraction f (0 top .. 1 ground)
    tip(f, out = new THREE.Vector3()) {
      if (!main.length) return out.set(0, 0, 0);
      const x = clamp(f) * (main.length - 1), i = Math.min(main.length - 2, Math.floor(x));
      return out.copy(main[i]).lerp(main[i + 1], x - i);
    },
    // reveal: how far down the leader has come; amt: brightness (the stroke and its re-strikes); the eye and the cloud
    set(reveal, amt, camera = null, base = 620, vis = 260) {
      mat.uniforms.uReveal.value = reveal;
      mat.uniforms.uAmt.value = amt;
      if (camera) mat.uniforms.uCam.value.copy(camera.position);
      mat.uniforms.uBase.value = base; mat.uniforms.uVis.value = vis;
      mesh.visible = amt > 0.003 && reveal > 0.001;
    },
  };
}
