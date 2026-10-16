// The flock that bursts out of the old pines when the forest falls silent. Hundreds of small birds, each perched
// somewhere in the crowns, take off one after another (a ripple running through the trees), climb steeply with fast
// wingbeats and stream away east, out of the storm's way, until the sky is empty. A few cross close to the lens.
// All on the GPU: each bird is a body and two jointed wings, flown along its own curve as a pure function of the
// story position (scrubbing back puts them back in the trees) plus the clock (the wingbeat).
import * as THREE from 'three';
import { rng } from './util.js';

const VS = `
attribute vec4 aPart;                 // x: 0 body, 1 inner wing, 2 wing tip; y: side (-1, 1)
attribute vec3 aS, aC, aE;            // perch, climb, far away
attribute vec4 aT;                    // x: take-off (u), y: flight length (u), z: wingbeat phase, w: size
uniform float uU, uTime, uAmt;
varying float vShade;
vec3 bez(float t){ float r = 1. - t; return r * r * aS + 2. * r * t * aC + t * t * aE; }
void main(){
  float t = clamp((uU - aT.x) / aT.y, 0., 1.);
  // (they leap, then pull away ever faster)
  float te = t * t * (2.2 - 1.2 * t);
  vec3 P = bez(te);
  vec3 F = normalize(bez(min(te + .02, 1.)) - bez(max(te - .02, 0.)) + vec3(0., 1e-4, 0.));
  vec3 Rt = normalize(cross(F, vec3(0., 1., 0.)) + 1e-4);
  vec3 Up = cross(Rt, F);
  // the wingbeat: fast as they climb, slower and with glides once they are away
  float rate = mix(15., 9., smoothstep(.15, .6, t));
  float ph = uTime * rate + aT.z * 6.2831;
  float glide = smoothstep(.55, .9, sin(uTime * 1.3 + aT.z * 17.)) * smoothstep(.4, .7, t);
  float beat = sin(ph) * (1. - glide * .85);
  float ang = beat * 1.05 + .15;
  vec3 local = position;               // x across, y up, z along
  if (aPart.x > .5) {
    // wings hinge at the body; the tips bend further
    float a = ang * aPart.y;
    float ax = abs(local.x);
    vec2 r1 = vec2(cos(a), sin(a));
    vec2 wing = vec2(min(ax, .45) * r1.x, min(ax, .45) * r1.y);
    if (aPart.x > 1.5) { float a2 = a * 1.5; wing += vec2(cos(a2), sin(a2)) * (ax - .45); }
    local.x = wing.x * aPart.y; local.y = wing.y;
  }
  local.y += beat * .06;                 // the body bobs against the beat
  float size = aT.w * uAmt * step(.0005, t) * step(t, .9995);
  vec3 W = P + (Rt * local.x + Up * local.y + F * local.z) * size;
  gl_Position = projectionMatrix * viewMatrix * vec4(W, 1.);
  vShade = .7 + .3 * aPart.x * .5;
}`;
const FS = `
uniform vec3 uCol;
varying float vShade;
void main(){ gl_FragColor = vec4(uCol * vShade, 1.); }`;

export function createBirdBurst({ count = 240, at = 46.55 } = {}) {
  // one bird: a body and two wings of two segments each (wingspan 1, length .5 at size 1)
  const pos = [], part = [], idx = [];
  const tri = (a, b, c, p) => { const i = pos.length / 3; pos.push(...a, ...b, ...c); part.push(...p, ...p, ...p); idx.push(i, i + 1, i + 2); };
  tri([0, 0.02, 0.26], [-0.07, 0, -0.04], [0.07, 0, -0.04], [0, 0]);
  tri([-0.07, 0, -0.04], [0.07, 0, -0.04], [0, 0.01, -0.24], [0, 0]);
  for (const sd of [-1, 1]) {
    // (x is laid out as positive; the side flips it in the shader)
    const inner = [[0.04, 0, 0.08], [0.45, 0, 0.04], [0.45, 0, -0.1], [0.04, 0, -0.06]];
    tri(inner[0], inner[1], inner[2], [1, sd]);
    tri(inner[0], inner[2], inner[3], [1, sd]);
    tri([0.45, 0, 0.04], [0.98, 0, -0.08], [0.45, 0, -0.1], [2, sd]);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part.flatMap((v, i) => (i % 2 ? [v, 0, 0] : [v])), 4));
  g.setIndex(idx);
  const r = rng(733);
  const S = new Float32Array(count * 3), C = new Float32Array(count * 3), E = new Float32Array(count * 3), T = new Float32Array(count * 4);
  g.setAttribute('aS', new THREE.InstancedBufferAttribute(S, 3));
  g.setAttribute('aC', new THREE.InstancedBufferAttribute(C, 3));
  g.setAttribute('aE', new THREE.InstancedBufferAttribute(E, 3));
  g.setAttribute('aT', new THREE.InstancedBufferAttribute(T, 4));
  g.instanceCount = count;
  const seeds = Array.from({ length: count }, () => [r(), r(), r(), r(), r(), r(), r(), r(), r()]);
  const uniforms = { uU: { value: 0 }, uTime: { value: 0 }, uAmt: { value: 1 }, uCol: { value: new THREE.Color(0.035, 0.032, 0.03) } };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  mesh.name = 'bird-burst';
  mesh.visible = false;
  let placed = false;
  return {
    mesh, uniforms,
    // lens: the camera when they go up; view: its gaze (up into the crowns); away: the way they flee
    place(lens, view, away, perchY = null) {
      const V = view.clone().normalize();
      const side = new THREE.Vector3().crossVectors(V, new THREE.Vector3(0, 1, 0)).normalize();
      const vUp = new THREE.Vector3().crossVectors(side, V).normalize();
      const aw = away.clone().setY(0).normalize(), aside = new THREE.Vector3(-aw.z, 0, aw.x);
      seeds.forEach((q, i) => {
        const near = i < count * 0.08;
        let s, c, e, delay;
        if (!near) {
          // perched through the crowns in front of his gaze, scattered across it
          const along = 9 + q[1] * 18;
          if (perchY) {
            // perched all round the lens through the crowns it is rising through
            const a = q[0] * Math.PI * 2, rr = 4 + Math.pow(q[1], 0.8) * 26;
            s = lens.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr));
            s.y = perchY[0] + q[6] * (perchY[1] - perchY[0]);
          } else s = lens.clone().addScaledVector(V, along).addScaledVector(side, (q[0] - 0.5) * along * 1.15).addScaledVector(vUp, (q[6] - 0.5) * along * 0.75);
          // the ripple runs out from the nearest trees
          delay = 0.05 + (along - 9) / 18 * 0.3 + q[3] * 0.32;
          c = s.clone().add(new THREE.Vector3(0, 5 + q[4] * 6, 0)).addScaledVector(aw, 5 + q[5] * 7).addScaledVector(aside, (q[6] - 0.5) * 12);
          e = s.clone().addScaledVector(aw, 160 + q[7] * 160).addScaledVector(aside, (q[8] - 0.5) * 200).add(new THREE.Vector3(0, 60 + q[4] * 70, 0));
        } else {
          // these come down out of the crowns straight at him and flash past the lens
          s = lens.clone().addScaledVector(V, 6 + q[1] * 5).addScaledVector(side, (q[0] - 0.5) * 6);
          c = lens.clone().addScaledVector(side, (q[0] < 0.5 ? -1 : 1) * (0.9 + q[2] * 1.2)).add(new THREE.Vector3(0, 0.5 + q[6], 0));
          e = c.clone().addScaledVector(c.clone().sub(s).setY(0).normalize(), 70).add(new THREE.Vector3(0, 28, 0));
          delay = 0.12 + q[3] * 0.5;
        }
        S.set([s.x, s.y, s.z], i * 3); C.set([c.x, c.y, c.z], i * 3); E.set([e.x, e.y, e.z], i * 3);
        T.set([at + delay, near ? 1.0 + q[5] * 0.6 : 2.6 + q[5] * 1.8, q[3], near ? 0.42 + q[2] * 0.12 : 0.55 + q[2] * 0.3], i * 4);
      });
      for (const a of ['aS', 'aC', 'aE', 'aT']) g.attributes[a].needsUpdate = true;
      placed = true;
    },
    get placed() { return placed; },
    update({ u, time, amt = 1 }) {
      mesh.visible = placed && amt > 0.001 && u > at - 0.05 && u < at + 5.4;
      uniforms.uU.value = u; uniforms.uTime.value = time; uniforms.uAmt.value = amt;
    },
  };
}
