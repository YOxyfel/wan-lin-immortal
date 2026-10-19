// The great bolt: the charge gathered in the storm comes down at once, a channel a kilometre long with a crown of
// forks, from the cloud to the ground beyond the western ridges. Its leader is drawn by the story position (the
// camera rides down with its tip), then the return stroke: blinding, re-striking, fading. Built from the same arcs as
// the storm's lightning.
import * as THREE from 'three';
import { BOLT_VS, jag, perp } from './weather.js';
import { rng, clamp, lerp } from './util.js';

const MAXSEG = 4096;
// the arc's own shader, with the cloud it runs through: what is deep in the cloud (between it and the eye) is lost in it
// (each segment's quad runs on a little past its ends, so the bends leave no gaps; drawn with MAX, the overlaps leave
// no seams either: seen from close by, the channel is one body of light, not a stack of pieces)
// (and its pieces round-ended: square-ended, a broad channel's edge stepped at every joint, a stack of white boxes)
// (coming down, its leader half as broad as the stroke, and its breadth grown less with the distance: from the land, a
// kilometre and more off, grown as the storm's far bolts are, it was a white tube thirty pixels across with a round
// bright end coming down the sky, a capsule)
const VS = BOLT_VS.replace('varying float vSide, vBright, vAlong;', 'uniform float uLead; varying float vSide, vBright, vAlong; varying vec3 vW; varying float vCap, vHalf;').replace('vSide = aInfo.y;', 'vW = P; vHalf = length(aB - position) * .5 / max(w, 1e-4); vCap = (aInfo.x * 2. - 1.) * (vHalf + .78); vSide = aInfo.y;')
  .replace('float w = aInfo.z * (1. + length(cameraPosition - P) * .0042);', 'float w = aInfo.z * (1. + length(cameraPosition - P) * .0018) * mix(1., .5, uLead);')
  .replace('P += side * aInfo.y * w;', 'P += side * aInfo.y * w + dir * (aInfo.x * 2. - 1.) * w * .6;');
if (!VS.includes('.0018')) throw new Error('mega-bolt: BOLT_VS width line not found');
const FS = `uniform float uAmt, uReveal, uLead; uniform vec3 uCol; uniform vec3 uCam; uniform float uBase, uVis; varying float vSide, vBright, vAlong; varying vec3 vW; varying float vCap, vHalf;
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
  float ex = max(abs(vCap) - vHalf, 0.), r2 = vSide * vSide + ex * ex;
  float core = exp(-r2 * 60.), sheath = exp(-r2 * 9.), halo = exp(-r2 * 2.2) * smoothstep(.78, .45, ex);
  // (the leader's tip a short bright point: over the last twentieth of its length, fifty metres of it by the lens riding
  // down with it, the whole of what was seen of it was blown out white, a capsule, neon)
  float head = 1. + smoothstep(uReveal - .012, uReveal, vAlong) * 1.4 * step(uReveal, .999);
  // (and the channel behind its tip only a glow until the stroke comes up it: lit whole as it came, the leader was the
  // stroke itself, a white beam let down out of the cloud)
  head *= mix(1., .3 + .7 * smoothstep(uReveal - .06, uReveal, vAlong), uLead);
  vec3 c = mix(vec3(1.), uCol, .26) * core * 15. + mix(vec3(.62, .84, 1.), uCol, .72) * sheath * 3.6 + uCol * uCol * halo * 1.15;
  float at = cloudAtt(vW);
  // (deep in the cloud only its glow comes through: the core goes first)
  c = mix(c * vec3(.35, .45, .8) * .5, c, at) * mix(.12, 1., at);
  // (its mark in the scene alpha all or nothing: a little of it, and the ink took it for a figure's and outlined it)
  float aM = min((core + sheath * .6) * 6. * vBright, 4.) * smoothstep(.02, .15, uAmt) * at;
  gl_FragColor = vec4(c * vBright * vBright * uAmt * head, aM > .25 ? max(aM, 1.5) : 0.);
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
    uniforms: { uAmt: { value: 0 }, uReveal: { value: 0 }, uLead: { value: 1 }, uCol: { value: new THREE.Color(0.55, 0.55, 1.0) }, uCam: { value: new THREE.Vector3() }, uBase: { value: 620 }, uVis: { value: 260 } },
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 21;
  mesh.name = 'mega-bolt';
  let main = [], mainC = [];
  return {
    mesh, uniforms: mat.uniforms,
    // crawlY: the height of the cloud's base, along which its arms crawl out
    build(top, bottom, seed = 9137, crawlY = 600) {
      const r = rng(seed);
      // (broken finer, two metres a stroke, and narrower, so close by its white core is a jagged line of light in its
      // glow: in eight-metre strokes seven and a half metres wide, from a hundred metres off it was a smooth tube, neon)
      main = jag(top, bottom, 0.1, 9, r);
      // (the leader's tip, that the lens rides down with, along the channel's coarse course: every fourth point, its
      // seven-level shape; along the fine one the lens would shake with each kink)
      mainC = main.filter((p, i) => i % 4 === 0);
      const total = main.length - 1, segs = [];
      for (let k = 0; k < total; k++) segs.push([main[k], main[k + 1], 6, k / total, 1]);
      // the crown of forks: long ones from high on the channel reaching out through the cloud, shorter ones lower
      for (let i = 0; i < 22; i++) {
        const k = Math.floor(lerp(0.02, 0.8, Math.pow(r(), 1.3)) * total);
        const start = main[k];
        const dir = main[Math.min(total, k + 6)].clone().sub(start).normalize();
        dir.addScaledVector(perp(dir, r), lerp(0.7, 1.6, r())).normalize();
        if (k < total * 0.25) dir.y = Math.max(dir.y, -0.2);       // high up they run sideways through the cloud
        const len = top.distanceTo(bottom) * lerp(0.12, 0.42, r()) * (1 - (k / total) * 0.55);
        // (its branches kinked less, and less at the fine end: kinked as hard all the way down, they closed into boxes)
        // (thinner and finer broken: three and a half metres broad, from the lens riding down with the leader the forks of
        // its crown were straight glowing rods round a hub)
        const sub = jag(start, start.clone().addScaledVector(dir, len), 0.16, 6, r, 0.55);
        for (let j = 0; j < sub.length - 1; j++) segs.push([sub[j], sub[j + 1], 2.4 * (1 - (j / sub.length) * 0.55), k / total + (j / (sub.length - 1)) * 0.22, 0.75 * (1 - (j / sub.length) * 0.35)]);
        if (r() < 0.7) {
          const j0 = Math.floor(sub.length * lerp(0.25, 0.6, r()));
          const d2 = sub[Math.min(sub.length - 1, j0 + 2)].clone().sub(sub[j0]).normalize().addScaledVector(perp(dir, r), 0.9).normalize();
          const sub2 = jag(sub[j0], sub[j0].clone().addScaledVector(d2, len * 0.45), 0.17, 4, r, 0.5);
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
          const sub2 = jag(sub[j0], sub[j0].clone().addScaledVector(d2, len * lerp(0.12, 0.3, r())), 0.17, 4, r, 0.5);
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
      if (mainC.length < 2) return out.set(0, 0, 0);
      const x = clamp(f) * (mainC.length - 1), i = Math.min(mainC.length - 2, Math.floor(x));
      return out.copy(mainC[i]).lerp(mainC[i + 1], x - i);
    },
    // reveal: how far down the leader has come; amt: brightness (the stroke and its re-strikes); the eye and the cloud
    set(reveal, amt, camera = null, base = 620, vis = 260) {
      mat.uniforms.uReveal.value = reveal;
      mat.uniforms.uAmt.value = amt;
      // (the leader until it is down: the stroke goes up the channel at once)
      const lk = clamp((reveal - 0.97) / 0.03);
      mat.uniforms.uLead.value = 1 - lk * lk * (3 - 2 * lk);
      if (camera) mat.uniforms.uCam.value.copy(camera.position);
      mat.uniforms.uBase.value = base; mat.uniforms.uVis.value = vis;
      mesh.visible = amt > 0.003 && reveal > 0.001;
    },
  };
}
