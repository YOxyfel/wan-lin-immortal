// The two lights fighting above the clouds, drawn at full resolution over the cloud deck.
//
// Each fighter is a white-hot head drawn out along its motion (a streak while it dashes, a star while it hangs), with
// a corona in its colour and a trail along the path it has just flown: the gold one's smooth and burning, the violet
// one's crackling (close to, the war's own figures are drawn instead, war.js, and the heads fade). Where they meet: a blink of white, a shock ring racing out, anime impact lines flicked out at odd
// angles and lengths (gold on the gold one's side, violet on the other), and a shower of sparks thrown out and falling.
// Hidden by the mountains (depth-tested), dimmed where the cloud is thick in front of them (the cloud target's
// transmittance to the fight).
import * as THREE from 'three';

const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
const N = 48;                // samples along a trail
const SPAN = 0.62;           // seconds of flight a trail shows
const BURSTS = 3;            // the last few meetings
const SPARKS = 56;           // sparks thrown out of each
// by the kind of blow (see duel.js): a blow, a flurry's, the smash down, the crater, a pulse out of the lock, its burst
// (and the war's own, war.js: the crescent thrown, the crescent split on the glaive, lightning breaking on the bell, and
// the lock's grinding, close to the lens: a small ring, sparks off blade and shaft at a smith's speed, not a cannon's)
const KSIZE = [0.42, 0.3, 0.5, 0.5, 0.2, 0.62, 0.34, 0.56, 0.26, 0.07], KSPARK = [1, 0.6, 1.2, 1.3, 0.35, 1.5, 0.5, 1.35, 0.55, 0.03], KAMT = [1, 0.85, 1.15, 1.2, 0.6, 1.4, 0.9, 1.3, 0.75, 0.55];

const TRAIL_VS = `attribute float aK, aSide; varying float vK, vSide;
void main(){ vK = aK; vSide = aSide; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }`;
const TRAIL_FS = `uniform vec3 uCol; uniform float uAmt, uHot; uniform sampler2D tSky; uniform vec2 uRes; varying float vK, vSide;
void main(){
  float core = exp(-vSide * vSide * 9.), halo = exp(-vSide * vSide * 1.8);
  float hot = exp(-vK * 7.), tail = pow(clamp(1. - vK, 0., 1.), 1.4);
  vec3 c = mix(uCol, vec3(1., .97, .92), core * (hot * .9 + .25));
  float I = core * (hot * 10. + tail * 2.6) * uHot + halo * tail * .5;
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).g;
  gl_FragColor = vec4(c * I * uAmt * (.3 + .7 * T), 1.);
}`;
// a sprite drawn out along a direction in view space: x along it (stretched), y across
const STREAK_VS = `uniform float uSize, uStretch; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 c = modelViewMatrix * vec4(0., 0., 0., 1.);
  vec2 d = uDir, n = vec2(-d.y, d.x);
  c.xy += (d * position.x * (1. + uStretch) + n * position.y) * uSize;
  gl_Position = projectionMatrix * c;
}`;
const HEAD_FS = `uniform vec3 uCol; uniform float uAmt, uTime, uKind, uStretch; uniform sampler2D tSky; uniform vec2 uRes; varying vec2 vUv;
void main(){
  vec2 q = vUv * 2. - 1.;
  // (distance from the line the head has just drawn: a capsule, in units of the head's size)
  float X = q.x * (1. + uStretch);
  float r = length(vec2(max(abs(X) - uStretch, 0.), q.y));
  float fl = .85 + .15 * sin(uTime * 41. + uKind * 3.) * sin(uTime * 17.);
  float g = exp(-r * r * 90.) * 14. + exp(-r * r * 12.) * 2.6 + exp(-r * 3.6) * .45;
  // four-point glints, turning slowly (only while it hangs: a streak has none)
  float a = uTime * (.6 + uKind * .3);
  vec2 qr = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
  g += (exp(-abs(qr.x) * 70.) * exp(-abs(qr.y) * 3.2) + exp(-abs(qr.y) * 70.) * exp(-abs(qr.x) * 3.2)) * 1.5 / (1. + uStretch * 3.);
  vec3 c = mix(uCol, vec3(1., .98, .95), smoothstep(.28, .02, r));
  // (far off, a cultivator is a light: the people in it are seen only close to, war.js)
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).g;
  // (round to the sprite's edge: cut square, the glow of a far light was a pale square patch about it)
  float edge = smoothstep(1., .72, length(q));
  gl_FragColor = vec4(c * g * fl * uAmt * (.4 + .6 * T) * edge, 1.);
}`;
const BURST_FS = `uniform float uAmt, uAge, uSeed, uKind; uniform vec2 uAxis; uniform sampler2D tSky; uniform vec2 uRes; varying vec2 vUv;
float hs(float n){ return fract(sin(n * 12.9898 + uSeed * 78.233) * 43758.5453); }
void main(){
  vec2 q = vUv * 2. - 1.; float r = length(q);
  float a = uAge;
  vec3 gold = vec3(1., .7, .28), violet = vec3(.7, .38, 1.);
  // which side of the meeting: the gold one's or the violet one's
  float side = dot(q, uAxis) / max(r, 1e-4);
  vec3 tint = mix(violet, gold, smoothstep(-.35, .35, side));
  // a blink of white, gone almost at once; a glow a little longer
  float core = exp(-r * r * mix(520., 110., a)) * exp(-a * 12.) * 9.;
  float glow = exp(-r * r * 30.) * exp(-a * 6.) * .8;
  // the shock ring: thin, racing out and slowing, thinning away
  float R = mix(.04, .82, 1. - pow(clamp(1. - a, 0., 1.), 3.));
  // (squared, not pow: pow of a negative number is not a number on some machines, inside the ring)
  float rk = (r - R) / mix(.007, .04, a);
  float ring = exp(-rk * rk) * pow(clamp(1. - a, 0., 1.), 1.6) * 1.9;
  // impact lines: thin spikes flicked out at odd angles, each its own length, there and gone
  float lines = 0.;
  // (never atan of nothing: undefined at its very middle)
  float ang = atan(q.y, abs(q.x) > 1e-6 ? q.x : 1e-6);
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float an = hs(fi) * 6.2832;
    float len = mix(.3, 1., hs(fi + 31.));
    float t0 = hs(fi + 57.) * .06, t1 = t0 + mix(.1, .26, hs(fi + 73.));
    float on = smoothstep(t0, t0 + .02, a) * (1. - smoothstep(t1 - .05, t1, a));
    float c = cos(ang - an), s = sin(ang - an);
    float d = abs(s) * r, along = c * r;
    // (drawn outward from just off the centre; the far end thins to nothing)
    float w = mix(.006, .0015, clamp(along / len, 0., 1.));
    lines += exp(-d * d / (w * w)) * step(0., along) * smoothstep(.04, .1, along) * smoothstep(len, len * .5, along) * on;
  }
  vec3 col = vec3(1., .97, 1.) * core + tint * (glow + ring) + mix(tint, vec3(1.), .55) * lines * 2.;
  float T = texture2D(tSky, gl_FragCoord.xy / uRes).g;
  float edge = smoothstep(1., .9, r);
  gl_FragColor = vec4(col * uAmt * (.45 + .55 * T) * edge, 1.);
}`;
// sparks: thrown out of each meeting along their own directions, slowing in the air, falling; drawn as short streaks
const SPARK_VS = `attribute vec4 aDir; attribute vec4 aRnd; uniform vec4 uBlow[${BURSTS}]; uniform float uTime, uScale[${BURSTS}];
varying float vA, vS, vH; varying vec3 vC;
vec3 at(vec3 p0, vec3 v, float t){ float k = 2.6; return p0 + v * (1. - exp(-k * t)) / k + vec3(0., -9.8 * 9., 0.) * t * t * .5; }
void main(){
  int b = int(aRnd.w);
  vec4 B = uBlow[b];
  float age = uTime - B.w, life = mix(.5, 1.25, aRnd.x);
  vA = 0.;
  vC = mix(vec3(1., .72, .32), vec3(.72, .42, 1.), step(.5, aRnd.y));
  if (age < 0. || age > life || B.w < -1e3) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec3 v = aDir.xyz * aDir.w * uScale[b];
  vec3 p1 = at(B.xyz, v, age), p0 = at(B.xyz, v, max(age - .035, 0.));
  vec4 c1 = viewMatrix * vec4(p1, 1.), c0 = viewMatrix * vec4(p0, 1.);
  // (a spark at or behind the lens is not drawn: a streak with an end behind it was thrown across the whole frame, a
  // great pale pane, close to a meeting)
  if (c1.z > -.6 || c0.z > -.6) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec2 d = c1.xy - c0.xy; float L = length(d); d = L > 1e-4 ? d / L : vec2(1., 0.);
  vec2 n = vec2(-d.y, d.x);
  float w = -c1.z * .0028 * mix(.6, 1.4, aRnd.z);
  vec4 c = position.x > 0. ? c1 : c0;
  // (wider than the streak itself, to hold its soft edge, and run on a little past its ends)
  c.xy += n * position.y * w * 1.8 + d * position.x * w;
  vS = position.y; vH = position.x * .5 + .5;
  vA = (1. - age / life) * (1. - age / life) * 2.2;
  gl_Position = projectionMatrix * c;
}`;
// (a soft streak, white-hot at its head and fading back along it into its colour: flat and square-cut, they were chips
// of white paper, confetti)
const SPARK_FS = `uniform float uAmt; varying float vA, vS, vH; varying vec3 vC;
void main(){
  float a = exp(-vS * vS * 4.5) * (.12 + .88 * vH * vH);
  vec3 c = mix(vC, vec3(1.), .55 * exp(-vS * vS * 16.) * vH);
  gl_FragColor = vec4(c * vA * uAmt * a, 1.);
}`;

const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function createFighters() {
  const group = new THREE.Group();
  group.name = 'fighters';
  const shared = { tSky: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } };
  const mkTrail = (col, hot) => {
    const pos = new Float32Array(N * 2 * 3), k = new Float32Array(N * 2), side = new Float32Array(N * 2), idx = [];
    for (let i = 0; i < N; i++) { k[i * 2] = k[i * 2 + 1] = i / (N - 1); side[i * 2] = -1; side[i * 2 + 1] = 1; }
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aK', new THREE.BufferAttribute(k, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(...col) }, uAmt: { value: 0 }, uHot: { value: hot }, ...shared }, vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: false, ...ADD,
    }));
    m.frustumCulled = false;
    m.renderOrder = 19;
    group.add(m);
    return m;
  };
  const mkSprite = (fs, uniforms) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { uSize: { value: 1 }, uStretch: { value: 0 }, uDir: { value: new THREE.Vector2(1, 0) }, uAmt: { value: 0 }, uTime: { value: 0 }, ...shared, ...uniforms },
      vertexShader: STREAK_VS, fragmentShader: fs,
      transparent: true, depthWrite: false, depthTest: true, fog: false, ...ADD,
    }));
    m.frustumCulled = false;
    m.renderOrder = 20;
    group.add(m);
    return m;
  };
  const GOLD = [1, 0.66, 0.22], VIOLET = [0.62, 0.26, 1];
  const trails = [mkTrail(GOLD, 1), mkTrail(VIOLET, 1.15)];
  const heads = [mkSprite(HEAD_FS, { uCol: { value: new THREE.Color(...GOLD) }, uKind: { value: 0 } }), mkSprite(HEAD_FS, { uCol: { value: new THREE.Color(...VIOLET) }, uKind: { value: 1 } })];
  const bursts = Array.from({ length: BURSTS }, () => mkSprite(BURST_FS, { uAge: { value: 1 }, uSeed: { value: 0 }, uKind: { value: 0 }, uAxis: { value: new THREE.Vector2(1, 0) } }));
  // the sparks: one instanced streak per spark, each knowing which meeting it belongs to
  const sparkMesh = (() => {
    const base = new THREE.PlaneGeometry(2, 2, 1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    const n = SPARKS * BURSTS, dir = new Float32Array(n * 4), rnd = new Float32Array(n * 4);
    let s = 1234567;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      dir.set([q * Math.cos(a), u * 0.8 + 0.12, q * Math.sin(a), 140 + 520 * Math.pow(r(), 1.6)], i * 4);
      rnd.set([r(), r(), r(), Math.floor(i / SPARKS)], i * 4);
    }
    g.setAttribute('aDir', new THREE.InstancedBufferAttribute(dir, 4));
    g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4));
    g.instanceCount = n;
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uBlow: { value: Array.from({ length: BURSTS }, () => new THREE.Vector4(0, 0, 0, -1e4)) }, uScale: { value: new Array(BURSTS).fill(1) }, uTime: { value: 0 }, uAmt: { value: 0 } },
      vertexShader: SPARK_VS, fragmentShader: SPARK_FS, transparent: true, depthWrite: false, depthTest: true, fog: false, ...ADD,
    }));
    m.frustumCulled = false;
    m.renderOrder = 20;
    group.add(m);
    return m;
  })();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), pts = [[], []];
  for (let i = 0; i < N; i++) { pts[0].push(new THREE.Vector3()); pts[1].push(new THREE.Vector3()); }
  // (the trail's last seconds sampled finely by time, then laid evenly along the way it went: laid by time, where the
  // light slowed its points crowded together and their added light heaped up there, beads along the trail)
  const M = N * 4, fine = [[], []], cum = new Float32Array(M), ks = [new Float32Array(N), new Float32Array(N)];
  for (let j = 0; j < M; j++) { fine[0].push(new THREE.Vector3()); fine[1].push(new THREE.Vector3()); }
  const t0 = new THREE.Vector3(), toCam = new THREE.Vector3(), sd = new THREE.Vector3(), v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
  const g1 = new THREE.Vector3(), g2 = new THREE.Vector3();
  return {
    group,
    // flight(t, outGold, outViolet): where the two are at time t; amts: [gold, violet] 0..1; blows: the last meetings,
    // newest first [{ pos (world), t, kind, amt }]; pull: [point, weight] drawing the gold one's last stretch to a point
    // (trailS: how much of the span each one's trail shows; headS: how big each one's head is)
    update({ time, flight, amts, blows = [], camera, skyTex, res, pull = null, headK = [1, 1], trailK = [1, 1], trailW = [1, 1], trailS = [1, 1], headS = [1, 1] }) {
      const anyBurst = blows.some(bl => bl && time - bl.t >= 0 && time - bl.t < 1.3);
      group.visible = amts[0] > 0.003 || amts[1] > 0.003 || anyBurst;
      if (!group.visible) return;
      shared.tSky.value = skyTex; shared.uRes.value.copy(res);
      const V = camera.matrixWorldInverse;
      for (let j = 0; j < M; j++) {
        flight(time - (j / (M - 1)) * SPAN * trailS[0], a, b);
        fine[0][j].copy(a);
        if (trailS[1] !== trailS[0]) flight(time - (j / (M - 1)) * SPAN * trailS[1], a, b);
        fine[1][j].copy(b);
        if (pull && pull[1] > 0) fine[0][j].lerp(pull[0], pull[1] * (1 - j / (M - 1) * 0.6));
      }
      for (let f = 0; f < 2; f++) {
        const F = fine[f];
        cum[0] = 0;
        for (let j = 1; j < M; j++) cum[j] = cum[j - 1] + F[j].distanceTo(F[j - 1]);
        const L = cum[M - 1];
        for (let i = 0, j = 0; i < N; i++) {
          const sL = (i / (N - 1)) * L;
          while (j < M - 2 && cum[j + 1] < sL) j++;
          const seg = cum[j + 1] - cum[j], x = seg > 1e-9 ? Math.min(1, Math.max(0, (sL - cum[j]) / seg)) : 0;
          pts[f][i].copy(F[j]).lerp(F[j + 1], x);
          // (how far back in its time it is: the trail cools along that)
          ks[f][i] = L > 1e-6 ? (j + x) / (M - 1) : 0;
        }
      }
      for (let f = 0; f < 2; f++) {
        const P = pts[f], g = trails[f].geometry.attributes.position, gk = trails[f].geometry.attributes.aK;
        for (let i = 0; i < N; i++) {
          t0.copy(P[Math.max(0, i - 1)]).sub(P[Math.min(N - 1, i + 1)]);
          if (t0.lengthSq() < 1e-6) t0.set(0, 1, 0);
          t0.normalize();
          toCam.copy(camera.position).sub(P[i]);
          const d = toCam.length();
          toCam.divideScalar(Math.max(d, 1e-3));
          sd.crossVectors(t0, toCam).normalize();
          const k = ks[f][i];
          gk.setX(i * 2, k); gk.setX(i * 2 + 1, k);
          // wide enough to read at any distance, narrowing toward the tail; the violet one crackles
          const w = d * 0.0042 * trailW[f] * (0.3 + 0.7 * Math.pow(1 - k, 0.8));
          // (its crackle slight: at twice this its width swelled and pinched at even steps along it, a string of beads)
          // (and a wave along it a few samples long, not a kink at every sample: kinked at every other one, the trail
          // folded over itself at each kink, and its glow heaped up there into evenly spaced beads)
          const jit = f === 1 ? Math.sin(i * 0.62 + time * 61) * Math.sin(i * 0.29 - time * 37) * d * 0.0018 * k : 0;
          g.setXYZ(i * 2, P[i].x - sd.x * (w - jit), P[i].y - sd.y * (w - jit), P[i].z - sd.z * (w - jit));
          g.setXYZ(i * 2 + 1, P[i].x + sd.x * (w + jit), P[i].y + sd.y * (w + jit), P[i].z + sd.z * (w + jit));
        }
        g.needsUpdate = true; gk.needsUpdate = true;
        trails[f].material.uniforms.uAmt.value = amts[f] * trailK[f];
        trails[f].visible = amts[f] * trailK[f] > 0.003;
        // the head: drawn out along the way it is going (in view space), the faster the longer
        const h = heads[f], U = h.material.uniforms;
        h.position.copy(P[0]);
        const dist = P[0].distanceTo(camera.position);
        U.uSize.value = dist * 0.045 * headS[f];
        v0.copy(P[0]).applyMatrix4(V); v1.copy(P[2]).applyMatrix4(V);
        const dx = v0.x - v1.x, dy = v0.y - v1.y, dl = Math.hypot(dx, dy);
        U.uDir.value.set(dl > 1e-4 ? dx / dl : 1, dl > 1e-4 ? dy / dl : 0);
        U.uStretch.value = Math.min(9, dl / (U.uSize.value * 0.9));
        U.uAmt.value = amts[f] * headK[f];
        U.uTime.value = time;
        h.visible = amts[f] * headK[f] > 0.003;
      }
      // the meetings: a burst each (newest first), and their sparks
      const SU = sparkMesh.material.uniforms;
      SU.uTime.value = time;
      SU.uAmt.value = Math.max(amts[0], amts[1]);
      for (let i = 0; i < BURSTS; i++) {
        const bl = blows[i], m = bursts[i], U = m.material.uniforms;
        const age = bl ? (time - bl.t) / 0.55 : 9;
        m.visible = !!bl && age >= 0 && age < 1;
        if (bl) {
          SU.uBlow.value[i].set(bl.pos.x, bl.pos.y, bl.pos.z, bl.t);
          SU.uScale.value[i] = KSPARK[bl.kind] ?? 1;
        } else SU.uBlow.value[i].w = -1e4;
        if (!m.visible) continue;
        m.position.copy(bl.pos);
        const dist = bl.pos.distanceTo(camera.position);
        // (the size of the blow's light on the screen, but never a ring a kilometre across: far off it is a flash)
        U.uSize.value = Math.min(dist * (KSIZE[bl.kind] ?? 0.42), 240);
        U.uStretch.value = 0;
        U.uDir.value.set(1, 0);
        U.uAge.value = age;
        // (a meeting at the lens is not drawn as a ring round it: there its ring was an arc across the frame)
        U.uAmt.value = (bl.amt ?? 1) * (KAMT[bl.kind] ?? 1) * (bl.kind === 9 ? 1 : smooth01(5, 18, dist));
        U.uSeed.value = (Math.floor(bl.t * 1000) % 977) * 0.731;
        U.uKind.value = bl.kind;
        // (which way the gold one stands from the meeting, on the screen)
        flight(bl.t - 0.03, g1, g2);
        v0.copy(g1).applyMatrix4(V); v1.copy(g2).applyMatrix4(V);
        const ax = v0.x - v1.x, ay = v0.y - v1.y, al = Math.hypot(ax, ay);
        U.uAxis.value.set(al > 1e-4 ? ax / al : 1, al > 1e-4 ? ay / al : 0);
      }
      sparkMesh.visible = blows.some(bl => bl && time - bl.t >= 0 && time - bl.t < 1.3);
    },
  };
}
