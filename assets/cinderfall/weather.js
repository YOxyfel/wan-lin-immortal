// Weather: branching lightning bolts that strike the peaks, the storm that schedules them, rain streaks and a
// bank of cloud the camera can fly through.
import * as THREE from 'three';
import { U } from './materials.js';
import { rng, clamp, lerp } from './util.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const MAXSEG = 1000;

// ------------------------------------------------------------------ lightning
export const BOLT_VS = `attribute vec3 aB; attribute vec4 aInfo; attribute float aBright; varying float vSide, vBright, vAlong;
void main(){
  vec3 P = mix(position, aB, aInfo.x);
  vec3 dir = normalize(aB - position);
  vec3 toCam = normalize(cameraPosition - P);
  vec3 side = normalize(cross(dir, toCam));
  // wide enough to hold a few pixels of core and a soft halo at any distance
  float w = aInfo.z * (1. + length(cameraPosition - P) * .0042);
  // (each stroke run on a little past its ends, so the joints between them close: square-ended, they left a notch at
  // every turn of the channel; run on by half its width, they doubled into a knot of light at each)
  P += dir * (aInfo.x * 2. - 1.) * w * .18;
  P += side * aInfo.y * w;
  vSide = aInfo.y; vBright = aBright; vAlong = aInfo.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.);
  gl_Position.z = min(gl_Position.z, gl_Position.w * .99999);
}`;
export const BOLT_FS = `uniform float uAmt, uReveal; uniform vec3 uCol; varying float vSide, vBright, vAlong;
void main(){
  if (vAlong > uReveal) discard;
  // graded like an electric arc: white-blue core, an ice-blue sheath, a deep blue halo; never the same brightness along
  // its length (evenly lit, it was a neon tube)
  float core = exp(-vSide * vSide * 60.), sheath = exp(-vSide * vSide * 9.), halo = exp(-vSide * vSide * 2.2);
  float along = .62 + .38 * sin(vAlong * 173. + vBright * 31.) * sin(vAlong * 61. + 1.7);
  float head = (1. + smoothstep(uReveal - .05, uReveal, vAlong) * 2.5 * step(uReveal, .999)) * mix(.25, 1., smoothstep(1., .975, vAlong));
  vec3 c = (mix(vec3(1.), uCol, .26) * core * 15. + mix(vec3(.62, .84, 1.), uCol, .72) * sheath * 3.6 * along + uCol * uCol * halo * 1.15 * along) * mix(1., along, .5);
  // the scene alpha marks the channel itself (as the flames are marked) so the ink can draw it in electric blue
  // (all or nothing: a little, and the ink took the pixel for a figure's and outlined it, a hollow tube)
  float aM = min((core + sheath * .6) * 6. * vBright, 4.) * smoothstep(.02, .15, uAmt);
  gl_FragColor = vec4(c * vBright * vBright * uAmt * head, aM > .25 ? max(aM, 1.5) : 0.);
}`;

export function perp(d, r) {
  const a = V3(r() - 0.5, r() - 0.5, r() - 0.5);
  return a.sub(d.clone().multiplyScalar(a.dot(d))).normalize();
}
export function jag(a, b, disp, levels, r, decay = 0.56) {
  let pts = [a.clone(), b.clone()];
  let d = a.distanceTo(b) * disp;
  for (let l = 0; l < levels; l++) {
    const out = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const p = pts[k], q = pts[k + 1];
      const dir = q.clone().sub(p).normalize();
      const mid = p.clone().lerp(q, 0.5).addScaledVector(perp(dir, r), d * (r() - 0.5) * 2);
      out.push(mid, q);
    }
    pts = out;
    d *= decay;
  }
  return pts;
}

// (jagged for the lens that sees it: each kink turned across the stroke as the lens sees it, and no deeper than the
// stroke is long in the frame. Kinked every way in the world, a stroke seen end-on doubled back on itself in the frame,
// a lasso, a box of wire; one kinked only toward and away from the lens was a ruler-straight rod)
const _jv = new THREE.Vector3(), _js = new THREE.Vector3();
function across(ax, at, eye, r) {
  _jv.copy(at).sub(eye).normalize();
  _js.crossVectors(ax, _jv);
  const fs = _js.length();
  if (fs < 1e-4) return [perp(ax, r), 0.08];
  return [_js.divideScalar(fs).clone(), Math.max(0.08, fs)];
}
export function jagLens(a, b, disp, levels, r, decay, eye) {
  const ax = b.clone().sub(a).normalize();
  let pts = [a.clone(), b.clone()];
  let d = a.distanceTo(b) * disp;
  for (let l = 0; l < levels; l++) {
    const out = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const p = pts[k], q = pts[k + 1];
      const mid = p.clone().lerp(q, 0.5);
      const [s, fs] = across(ax, mid, eye, r);
      // (and a little in depth, which the lens does not see)
      mid.addScaledVector(s, d * (r() - 0.5) * 2 * fs).addScaledVector(_jv, d * (r() - 0.5) * 0.6);
      out.push(mid, q);
    }
    pts = out;
    d *= decay;
  }
  return pts;
}

// The bolts. Each stroke of one (its channel, each branch) is drawn as a single ribbon along it, turned to the lens, its
// width held to the frame: laid end to end as quads, its joints were knots and notches, a string of beads; as wide as
// the world made it by the lens, a searchlight's beam; far off, a hairline broken into dots.
const MAXPTS = 2400;
const RIBBON_VS = `attribute vec3 aPrev, aNext; attribute vec2 aW; attribute float aSide, aAlong, aBright;
uniform float uWMin, uWMax, uThin, uHalfPx; uniform vec3 uShift;
varying float vSide, vBright, vAlong, vTaper, vCoreK, vPx;
void main(){
  // (its end kept on what it strikes as that moves: the glaive's head in his shaking hands)
  vec3 sh = uShift * smoothstep(.55, 1., aAlong);
  mat4 PV = projectionMatrix * viewMatrix;
  vec4 c = PV * vec4(position + sh, 1.), cp = PV * vec4(aPrev + sh, 1.), cn = PV * vec4(aNext + sh, 1.);
  // (a point behind the lens is drawn where its stroke comes through a plane just in front of it)
  const float E = .12;
  if (c.w < E) { vec4 o = cn.w >= E ? cn : cp; if (o.w >= E) c = mix(c, o, (E - c.w) / (o.w - c.w)); }
  if (cp.w < E && c.w >= E) cp = mix(cp, c, (E - cp.w) / (c.w - cp.w));
  if (cn.w < E && c.w >= E) cn = mix(cn, c, (E - cn.w) / (c.w - cn.w));
  vec2 A = vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.);
  vec2 s = c.xy / c.w * A, d1 = s - cp.xy / cp.w * A, d2 = cn.xy / cn.w * A - s;
  float l1 = length(d1), l2 = length(d2);
  d1 = l1 > 1e-7 ? d1 / l1 : (l2 > 1e-7 ? d2 / l2 : vec2(1., 0.));
  d2 = l2 > 1e-7 ? d2 / l2 : d1;
  vec2 t = d1 + d2; t = dot(t, t) > 1e-8 ? normalize(t) : d1;
  vec2 n = vec2(-t.y, t.x);
  float mit = 1. / max(dot(n, vec2(-d1.y, d1.x)), .5);
  // (wide enough to hold a few pixels of core and a soft halo at any distance, never wider than a stroke of the frame)
  // (drawn to a point by its brightness, not by narrowing below a pixel: under one its thin tips broke into dots)
  float hw = max(clamp(projectionMatrix[1][1] * aW.x * (1. / max(c.w, E) + .0042), uWMin, uWMax) * aW.y, uWMin * .45);
  // (its breadth uneven along it, as its light is: held even, a glowing tube of glass; and thinning as it dies, so its
  // afterglow is a fading thread, not a grey cable left hanging in the sky)
  hw *= (.78 + .22 * sin(aAlong * 31. + aBright * 17.) * sin(aAlong * 13. + 1.1)) * uThin;
  c.xy += n * (aSide * hw * mit) / A * c.w;
  gl_Position = c;
  gl_Position.z = min(gl_Position.z, gl_Position.w * .99999);
  vSide = aSide; vBright = aBright; vAlong = aAlong; vTaper = aW.y;
  // (its white core never under a pixel across: a third of a pixel, it fell between them, a dotted line)
  float px = hw * uHalfPx;
  vCoreK = clamp(px * px / 26., .04, 1.);
  vPx = px;
}`;
const RIBBON_FS = `uniform float uAmt, uReveal, uLead, uEnv; uniform vec3 uCol; varying float vSide, vBright, vAlong, vTaper, vCoreK, vPx;
void main(){
  if (vAlong > uReveal) discard;
  // graded like an electric arc: white-blue core, an ice-blue sheath, a deep blue halo dying out before the ribbon's
  // edge; never the same brightness along its length (evenly lit, it was a neon tube)
  float x2 = vSide * vSide;
  float core = exp(-x2 * 46. * vCoreK), sheath = exp(-x2 * 9. * max(vCoreK, .35)), halo = exp(-x2 * 2.6) * (1. - x2);
  float along = .62 + .38 * sin(vAlong * 173. + vBright * 31.) * sin(vAlong * 61. + 1.7);
  float head = 1. + smoothstep(uReveal - .05, uReveal, vAlong) * 2.5 * step(uReveal, .999);
  // (coming down, only its tip burns: the channel behind it is still dark)
  float lead = mix(1., smoothstep(uReveal - .1, uReveal, vAlong), uLead);
  // (dimming, between its strokes and dying, it goes to a soft glow, its white core and its sheath first: dimmed whole, a
  // fine line without its light, it was a grey wire across the sky, lit again where it had hung; and behind the leader's
  // tip, dark: drawn there at a twelfth, the same wire hung from the sky before the stroke came down it)
  float dimK = smoothstep(.05, .45, uEnv), coreK = dimK * lead * lead;
  // (and one a few pixels across goes dark between its strokes, its glow with its core: its glow left alone, a fine line
  // without its light, it was a thin lavender wire hung in the sky; a broad one keeps its glow)
  float haloK = mix(dimK, 1., smoothstep(4., 9., vPx));
  vec3 c = (mix(vec3(1.), uCol, .26) * core * 15. * coreK + mix(vec3(.62, .84, 1.), uCol, .72) * sheath * 3.6 * along * dimK + uCol * uCol * halo * 1.15 * along * haloK) * mix(1., along, .5);
  // the scene alpha marks the channel itself (as the flames are marked) so the ink can draw it in electric blue
  // (all or nothing: a little of it, on its soft edges or as it died, put the pixel among the figures, and the ink drew
  // the figures' outline down both sides of it, a hollow tube)
  // (the mark is 6 added to what is under it: the frame's four samples to a pixel resolve its edge to 1.5, 3 or 4.5 over
  // that, never among the figures or the smoke, and what is under it is still there for the ink to read, the remainder
  // over 1.5 (post.js). Marked from 1.5 up, a pixel three samples in was a figure's, and the ink outlined the bolt in
  // dots; and taken whole, the mark put black ink behind it as if in the thickest smoke)
  // (marked while it keeps its glow, so the ink draws it dying in its own blue: unmarked, its last glow lifted the smoke
  // it was seen through to paper, a pale grey cable across the sky)
  float aM = min((core * coreK + sheath * .6) * 6. * vBright, 4.) * smoothstep(.02, .15, uAmt) * lead * haloK;
  gl_FragColor = vec4(c * vBright * vBright * uAmt * head * pow(vTaper, .7) * lead, aM > .25 ? 6. : 0.);
}`;

// (leadFlash: how much the stepped leader lights the world, against the return stroke: a strike into the ground beside
// the road lit the house it struck in colour a frame before the bolt itself was there to be seen)
export function createLightning(count = 3, { leadFlash = 1 } = {}) {
  const group = new THREE.Group();
  group.name = 'lightning';
  const bolts = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.BufferGeometry();
    const n = MAXPTS * 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aPrev', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aNext', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aAlong', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aBright', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(MAXPTS * 6), 1));
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, forceSinglePass: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { uAmt: { value: 0 }, uReveal: { value: 1 }, uLead: { value: 0 }, uEnv: { value: 0 }, uCol: { value: new THREE.Color(0.85, 0.86, 1.0) }, uWMin: { value: 0.012 }, uWMax: { value: 0.06 }, uShift: { value: V3() }, uThin: { value: 1 }, uHalfPx: { value: 270 } },
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 20;
    group.add(mesh);
    bolts.push({ mesh, g, m, t0: -1e9, top: V3(), target: V3(), strength: 1, dur: 1, follow: null, req: null, eye: V3(), final: true });
  }
  let next = 0;
  const lens = V3(0, 0, 0);
  let lensKnown = false, cutPending = false;

  // (a stroke broken finer wherever it would be long in the frame: by the lens its strokes were the straight rods of a
  // wire coat hanger, a few metres each; so it is crinkled at every distance it is seen at)
  const _d = V3();
  function refine(pts, eye, maxAng, disp, r, room) {
    if (!eye) return pts.slice(0, Math.max(2, Math.min(pts.length, room)));
    const out = [pts[0]];
    // (kinked across the stroke's own line as the lens sees it, so it never doubles back: kinked across each piece of
    // it, its finest kinks closed into boxes and loops)
    const ax = pts[pts.length - 1].clone().sub(pts[0]).normalize();
    const sub = (p, q, depth) => {
      const len = p.distanceTo(q);
      const mid = p.clone().lerp(q, 0.5);
      if (depth > 10 || len < 0.02 || out.length >= room - 1 || len < maxAng * Math.max(0.25, mid.distanceTo(eye))) { out.push(q); return; }
      const [s, fs] = across(ax, mid, eye, r);
      mid.addScaledVector(s, len * disp * (r() - 0.5) * 2 * fs);
      sub(p, mid, depth + 1);
      sub(mid, q, depth + 1);
    };
    for (let k = 0; k < pts.length - 1 && out.length < room - 1; k++) sub(pts[k], pts[k + 1], 0);
    if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    return out;
  }

  // a stroke: its points, its half-width in metres, its taper (per point, 0..1), along (for the leader's reveal), brightness
  function build(b, from, to, o, eye) {
    const r = rng(o.seed), rf = rng(o.seed * 7 + 3);
    const L = from.distanceTo(to);
    const strokes = [];
    const J = (a, b2, dp, lv, rr, dc) => eye ? jagLens(a, b2, dp, lv, rr, dc || 0.56, eye) : jag(a, b2, dp, lv, rr, dc);
    // (off the channel the lens's way: off it every way, a branch could come straight at the lens, a scribble)
    const outward = (dir, at, amt) => { if (!eye) return dir.addScaledVector(perp(dir, r), amt).normalize(); const [s] = across(dir, at, eye, r); return dir.addScaledVector(s, (r() < 0.5 ? -1 : 1) * amt).addScaledVector(perp(dir, r), amt * 0.25).normalize(); };
    const coarse = J(from, to, o.disp, o.levels, r, o.decay || (o.levels > 6 ? 0.58 : 0.56));
    let main = coarse;
    // (fineEnd, with no lens to go by: its last strokes broken up finer, where it strikes close to the lens)
    if (!eye && o.fineEnd > 0) {
      const n0 = Math.max(0, main.length - 1 - o.fineEnd), out = main.slice(0, n0 + 1);
      for (let k = n0; k < main.length - 1; k++) out.push(...jag(main[k], main[k + 1], 0.3, 3, r, 0.5).slice(1));
      main = out;
    }
    // (the branches off the channel as first jagged, high up it: off the finer end they came down by the lens, in strokes
    // of six metres, a wire bracket)
    const ctot = coarse.length - 1;
    const nb = o.branches || 5 + Math.floor(r() * 5);
    const raw = [];
    for (let i = 0; i < nb; i++) {
      // (brK: how far down the channel they fork, if not the usual: struck close to the lens, its upper three quarters lie in
      // a corner of the frame, and the branches off them crossed into a net there)
      const k = Math.floor(lerp(o.brK ? o.brK[0] : 0.08, o.brK ? o.brK[1] : 0.75, r()) * ctot);
      const start = coarse[k];
      // (off at a clear angle: close beside the channel, they ran down with it, two channels twisted round each other, a cable)
      const dir = outward(coarse[Math.min(ctot, k + 4)].clone().sub(start).normalize(), start, lerp(0.78, 1.35, r()));
      const len = L * lerp(0.12, 0.34, r()) * (1 - k / ctot * 0.6);
      const sub = J(start, start.clone().addScaledVector(dir, len), 0.24, o.levels > 6 ? 5 : 4, r);
      raw.push({ pts: sub, w: o.width * 0.5, a0: k / ctot, a1: k / ctot + 0.3, br: [0.62, 0.62 * 0.6] });
      if (r() < 0.6) {
        const j0 = Math.floor(sub.length * lerp(0.3, 0.6, r()));
        const d2 = outward(sub[Math.min(sub.length - 1, j0 + 2)].clone().sub(sub[j0]).normalize(), sub[j0], 0.9);
        const sub2 = J(sub[j0], sub[j0].clone().addScaledVector(d2, len * 0.4), 0.26, 3, r);
        raw.push({ pts: sub2, w: o.width * 0.3, a0: k / ctot + 0.15, a1: k / ctot + 0.3, br: [0.42, 0.42] });
      }
    }
    // (and a few short forks close above where it strikes, where a close lens sees only the last few metres of it)
    for (let i = 0; i < (o.near || 0); i++) {
      // (nearM: no further up the channel than that many metres, for a lens a few metres from where it strikes)
      const f0 = r(), dEnd = o.nearM ? Math.min(L * lerp(0.004, 0.03, f0), o.nearM * lerp(0.35, 1, f0)) : L * lerp(0.004, 0.03, f0);
      let k = Math.max(1, Math.min(ctot - 1, Math.round((1 - dEnd / L) * ctot))), start = coarse[k];
      // (that far back along the channel itself, finer than its coarse points, which are metres apart)
      if (o.nearM) {
        let acc = 0;
        for (k = ctot; k > 1; k--) { const sg = coarse[k].distanceTo(coarse[k - 1]); if (acc + sg >= dEnd) { start = coarse[k].clone().lerp(coarse[k - 1], (dEnd - acc) / sg); break; } acc += sg; }
        k = Math.max(1, Math.min(ctot - 1, k));
      }
      const dir = outward(coarse[Math.min(ctot, k + 1)].clone().sub(coarse[k - 1]).normalize(), start, lerp(0.6, 1.3, r()));
      const len = dEnd * lerp(0.5, 1.1, r());
      raw.push({ pts: J(start, start.clone().addScaledVector(dir, len), 0.22, 4, r), w: o.width * 0.45, a0: k / ctot, a1: k / ctot + 0.02, br: [0.55, 0.4] });
    }
    // refined against the lens: the channel first, then the branches with what room is left
    let room = MAXPTS;
    const mp = refine(main, eye, o.maxAng, 0.24, rf, Math.min(room, Math.round(MAXPTS * 0.62)));
    room -= mp.length;
    {
      // (arc length along it: the leader's reveal and the taper go by the metre, not by the point)
      const cum = [0];
      for (let k = 1; k < mp.length; k++) cum.push(cum[k - 1] + mp[k].distanceTo(mp[k - 1]));
      const tot = cum[cum.length - 1] || 1;
      const f = cum.map(c => c / tot);
      // (both ends drawn out to points, unless it strikes something: then it meets it full)
      const taper = f.map(x => lerp(0.25, 1, smooth01(x / 0.04)) * (o.tip ? 1 - smooth01((x - 0.93) / 0.07) : 1));
      strokes.push({ pts: mp, w: o.width, taper, along: f, br: f.map(() => 1) });
    }
    for (const s of raw) {
      if (room < 8) break;
      const pts = refine(s.pts, eye, o.maxAng, 0.24, rf, room);
      room -= pts.length;
      const cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
      const tot = cum[cum.length - 1] || 1;
      const f = cum.map(c => c / tot);
      strokes.push({ pts, w: s.w, taper: f.map(x => Math.pow(1 - x, 0.8)), along: f.map(x => lerp(s.a0, s.a1, x)), br: f.map(x => lerp(s.br[0], s.br[1], x)) });
    }
    // written out: two vertices a point, one each side; two triangles between each point and the next along a stroke
    const P = b.g.attributes.position, Pp = b.g.attributes.aPrev, Pn = b.g.attributes.aNext, W = b.g.attributes.aW;
    const Sd = b.g.attributes.aSide, Al = b.g.attributes.aAlong, Br = b.g.attributes.aBright, I = b.g.index.array;
    let v = 0, ii = 0;
    for (const s of strokes) {
      const n = s.pts.length;
      if (n < 2) continue;
      const base = v;
      for (let k = 0; k < n; k++) {
        const p = s.pts[k], pv = s.pts[Math.max(0, k - 1)], nx = s.pts[Math.min(n - 1, k + 1)];
        for (let side = 0; side < 2; side++) {
          P.setXYZ(v, p.x, p.y, p.z); Pp.setXYZ(v, pv.x, pv.y, pv.z); Pn.setXYZ(v, nx.x, nx.y, nx.z);
          W.setXY(v, s.w, s.taper[k]); Sd.setX(v, side ? 1 : -1); Al.setX(v, Math.min(1, s.along[k])); Br.setX(v, s.br[k]);
          v++;
        }
      }
      for (let k = 0; k < n - 1; k++) {
        const a = base + k * 2;
        // (wound counter-clockwise on the screen, the left of the way it runs: wound the other way, it was culled, all
        // but where it turned back on itself, a scatter of chips)
        I[ii++] = a; I[ii++] = a + 2; I[ii++] = a + 1;
        I[ii++] = a + 1; I[ii++] = a + 2; I[ii++] = a + 3;
      }
    }
    for (const at of [P, Pp, Pn, W, Sd, Al, Br]) at.needsUpdate = true;
    b.g.index.needsUpdate = true;
    b.g.setDrawRange(0, ii);
    if (eye) b.eye.copy(eye);
  }

  // envelope of one strike: leader, return stroke, a re-strike, then the fade
  // stepped leader, return stroke, flicker, two re-strikes down the same channel, then the afterglow
  // [how far down it has come, how bright it is drawn, how much it lights the world, in its leader]
  // (drawn: dark between its strokes, its afterglow quick, its leader only the tip coming down; caught on any frame
  // between its strokes, half lit, or dying, or still coming, it was a thin grey wire across the sky. The light it
  // throws on the world keeps the gentler flicker: the frame is not strobed)
  const envelope = s => {
    if (s < 0 || s > 1.1) return [0, 0, 0, 0];
    const reveal = clamp(s / 0.07);
    let amt, lit, lead = 0;
    if (s < 0.07) { amt = 0.35; lit = 0.3 + 0.15 * Math.sin(s * 400); lead = 1; }
    else if (s < 0.12) amt = lit = 1.25;
    else if (s < 0.2) { const f = 0.75 + 0.25 * Math.sin(s * 300); lit = lerp(1, 0.15, (s - 0.12) / 0.08) * f; amt = Math.exp(-(s - 0.12) * 55) * f; }
    else if (s < 0.26) amt = lit = 1.0;
    else if (s < 0.36) { lit = lerp(0.8, 0.12, (s - 0.26) / 0.1); amt = 0.8 * Math.exp(-(s - 0.26) * 55); }
    else if (s < 0.41) amt = lit = 0.75;
    // (the afterglow quick: slow, the channel hung on in the sky for half a second, a grey cable)
    else { lit = 0.75 * Math.exp(-(s - 0.41) * 17); amt = 0.75 * Math.exp(-(s - 0.41) * 30); }
    return [reveal, amt, lit, lead];
  };

  return {
    group,
    // strike from a point in the cloud base down to `target`
    // (dur: the stroke's length against an ordinary one's: a quick stroke flashes and is gone)
    // (eye: where the lens is, to break the strokes finer by it; if none, the lens of the last frame drawn, and the bolt
    // is made again for the lens it is first seen from. maxAng: the longest a stroke may be in the frame, in radians.
    // wmin, wmax: its half-width in the frame, as a fraction of half its height. tip: it ends in the air, drawn out to a
    // point; or strikes something, full. near: forks close above where it strikes. follow: what it strikes, if it moves)
    strike(time, top, target, { seed = Math.random() * 1e6, width = 2.2, color = null, strength = 1, branches = 0, levels = 6, dur = 1, disp = 0.17, fineEnd = 0, decay = 0, eye = null, maxAng = 0.02, wmin = 0.012, wmax = 0.06, tip = 1, near = 0, nearM = 0, brK = null, follow = null } = {}) {
      const b = bolts[next++ % bolts.length];
      b.t0 = time; b.strength = strength; b.dur = dur;
      b.top.copy(top); b.target.copy(target);
      b.req = { from: top.clone(), to: target.clone(), o: { seed: seed | 0, width, branches, levels, disp, fineEnd, decay, maxAng, tip, near, nearM, brK } };
      const e = eye || (lensKnown ? lens : null);
      build(b, b.req.from, b.req.to, b.req.o, e);
      b.final = !!eye;
      b.follow = follow;
      b.m.uniforms.uShift.value.set(0, 0, 0);
      b.m.uniforms.uWMin.value = wmin; b.m.uniforms.uWMax.value = wmax;
      b.m.uniforms.uCol.value.copy(color || new THREE.Color(0.32, 0.56, 1.0));
    },
    // the lens this frame is drawn from (after it is placed): a bolt struck this frame without one is made again for it,
    // if it has moved (a cut); and an end that follows what it strikes is put on it
    // (a cut: the bolts still in the air are made again for the new lens. Made for the last one, three hundred metres
    // off, a bolt carried on into a shot close to what it strikes was a polyline of long straight strokes)
    cut() { cutPending = true; },
    lens(eye) {
      lens.copy(eye); lensKnown = true;
      const recut = cutPending; cutPending = false;
      for (const b of bolts) {
        if (!b.final && b.req) { if (b.eye.distanceTo(eye) > 0.5 || b.g.drawRange.count === 0) build(b, b.req.from, b.req.to, b.req.o, eye); b.final = true; }
        else if (recut && b.req && b.mesh.visible) build(b, b.req.from, b.req.to, b.req.o, eye);
        if (b.follow && b.mesh.visible) b.m.uniforms.uShift.value.copy(b.follow()).sub(b.target);
      }
    },
    // returns the brightest flash this frame
    update(time) {
      let flash = 0, pos = null, col = null;
      for (const b of bolts) {
        const sN = (time - b.t0) / b.dur, [reveal, amt, lit0, lead] = envelope(sN);
        b.mesh.visible = amt > 0.004;
        b.m.uniforms.uAmt.value = amt * b.strength;
        b.m.uniforms.uReveal.value = reveal;
        b.m.uniforms.uLead.value = lead;
        // (how far through its own light it is, apart from how strong a bolt it is: dim, it is drawn as a glow, RIBBON_FS)
        b.m.uniforms.uEnv.value = amt;
        b.m.uniforms.uThin.value = sN < 0.41 ? 1 : Math.max(0.55, amt / 0.75);
        const lit = lit0 * b.strength * (lead ? leadFlash : 1);
        if (lit > flash) { flash = lit; pos = b.top; col = b.m.uniforms.uCol.value; }
      }
      return { flash, pos, col };
    },
    reset() { for (const b of bolts) { b.t0 = -1e9; b.mesh.visible = false; b.follow = null; } },
    // (the frame's height in pixels: what a pixel is, for the core)
    res(h) { for (const b of bolts) b.m.uniforms.uHalfPx.value = h * 0.5; },
  };
}

// ------------------------------------------------------------------ rain streaks in a box around the camera
export function createRain(count = 2400) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const r = rng(404);
  const a = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) a.set([r(), r(), r(), r()], i * 4);
  g.setAttribute('aRand', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = count;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    // (uCamVel: how fast the eye itself is going, m/s; with uExpo, the time a drop is exposed for, a drop the eye flies
    // past fast is drawn out into a long streak along the way it goes by)
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAmt: { value: 0 }, uCenter: { value: V3() }, uBox: { value: V3(36, 22, 36) }, uWindV: { value: new THREE.Vector2(1.5, 0.6) }, uCol: { value: new THREE.Color(0.75, 0.8, 0.88) }, uCamVel: { value: V3() }, uExpo: { value: 0 }, uTag: { value: 0 }, uResY: { value: 540 } }]),
    vertexShader: `attribute vec4 aRand; uniform float uTime, uAmt, uExpo, uResY; uniform vec3 uCenter, uBox, uCamVel; uniform vec2 uWindV; varying float vA; varying float vX;
#include <fog_pars_vertex>
void main(){
  vec3 vel = vec3(uWindV.x, -9.5 - aRand.w * 3., uWindV.y);
  vec3 q = aRand.xyz * uBox + vel * uTime;
  q = mod(q - uCenter + uBox * .5, uBox) - uBox * .5;
  vec3 c = uCenter + q;
  vec3 rel = vel - uCamVel;
  vec3 dir = normalize(rel);
  vec3 toCam = normalize(cameraPosition - c);
  vec3 side = normalize(cross(dir, toCam));
  // (never under a pixel across, fainter instead: a hair under one, each streak fell between the pixels into a row of
  // dashes, and the rain was a screen door; by the frame's own pixels, not a share of the distance, which at the film's
  // focal lengths came to six tenths of one)
  float dC = length(cameraPosition - c);
  float w = max(max(.014, dC * .0013), 2.6 * dC / (projectionMatrix[1][1] * uResY));
  vec3 p = c + side * position.x * w + dir * position.y * ((.5 + aRand.w * .4) + length(rel) * uExpo);
  vX = position.x;
  vA = uAmt * (1. - smoothstep(.25, .5, length(q / uBox))) * step(aRand.w, uAmt * 1.2) * (.014 / w);
  vec4 mvPosition = viewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uCol; uniform float uTag; varying float vA; varying float vX;
#include <fog_pars_fragment>
void main(){ float c = vA * .32 * (1. - abs(vX) * 1.6); gl_FragColor = vec4(uCol, c);
#include <fog_fragment>
  // (marked as breaking the frame, in the cinema bars: its light added, the mark in the alpha)
  if (uTag > .5) gl_FragColor = vec4(uCol * c * 1.4, 3. + 2. * c);
}`,
  });
  m.uniforms.uTime = U.uTime;
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
  mesh.name = 'rain';
  // (breaking the frame: added light, the alpha keeping the largest mark; the blending is state, not the program)
  const setTag = on => {
    if (!!m.uniforms.uTag.value === on) return;
    m.uniforms.uTag.value = on ? 1 : 0;
    m.blendSrc = on ? THREE.OneFactor : THREE.SrcAlphaFactor; m.blendDst = on ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
    m.blendEquationAlpha = on ? THREE.MaxEquation : THREE.AddEquation;
    m.blendSrcAlpha = on ? THREE.OneFactor : THREE.ZeroFactor; m.blendDstAlpha = on ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
  };
  return { mesh, uniforms: m.uniforms, setTag };
}

// ------------------------------------------------------------------ a deck of cloud puffs that follows the camera in x/z
export function createCloudBank(count = 70) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const r = rng(808);
  const a = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) a.set([r(), r(), r(), r()], i * 4);
  g.setAttribute('aRand', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = count;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uAmt: { value: 0 }, uCenter: { value: V3() }, uBox: { value: V3(420, 90, 420) }, uBase: { value: 200 }, uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.62, 0.7) }, uNoise: U.uNoise, uTime: U.uTime },
    vertexShader: `attribute vec4 aRand; uniform vec3 uCenter, uBox; uniform float uBase, uTime; varying vec2 vUv; varying float vA; varying vec4 vR; varying float vH;
void main(){
  vec3 q = vec3(aRand.x, aRand.y, aRand.z) * uBox + vec3(uTime * 1.5, 0., uTime * .6);
  q.xz = mod(q.xz - uCenter.xz + uBox.xz * .5, uBox.xz) - uBox.xz * .5;
  vec3 c = vec3(uCenter.x + q.x, uBase + q.y, uCenter.z + q.z);
  float s = mix(70., 150., aRand.w);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = c + (right * position.x + up * position.y) * s;
  vUv = uv; vR = aRand; vH = q.y / uBox.y + .5;
  float d = length(cameraPosition - c);
  vA = smoothstep(4., 40., d) * (1. - smoothstep(.3, .5, length(q.xz / uBox.xz)));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}`,
    fragmentShader: `uniform float uAmt, uTime; uniform vec3 uLit, uShade; uniform sampler2D uNoise; varying vec2 vUv; varying float vA; varying vec4 vR; varying float vH;
void main(){
  vec2 d = vUv - .5;
  float n = texture2D(uNoise, vUv * .7 + vR.xy + uTime * .003).r * .6 + texture2D(uNoise, vUv * 1.9 + vR.zw).g * .4;
  float a = smoothstep(.5, .12, length(d) + (n - .5) * .45);
  vec3 col = mix(uShade, uLit, clamp(vUv.y * .7 + vH * .4 + (n - .5) * .4, 0., 1.));
  gl_FragColor = vec4(col, a * vA * uAmt * .75);
}`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 14;
  mesh.name = 'cloudbank';
  return { mesh, uniforms: m.uniforms };
}

// ------------------------------------------------------------------ ground strikes: a bolt into the earth beside the road
// The bolt itself (its own channels, so the storm's strikes never steal them), the burn it leaves, a glow that dies
// in a breath and a burst of sparks. The burn belongs to the story (it fades as u runs on); the bolt, the glow and
// the sparks run in seconds from the strike.
const FIRE_MARK = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
const SPARKS = 150;
export function createGroundStrikes(groundAt, max = 2) {
  const group = new THREE.Group();
  group.name = 'groundStrikes';
  const bolts = createLightning(max, { leadFlash: 0 });
  group.add(bolts.group);
  const slots = [];
  const R = 5.5, N = 14;
  for (let i = 0; i < max; i++) {
    // the burn: a small grid laid over the ground (heights filled in at each strike)
    const dg = new THREE.PlaneGeometry(R * 2, R * 2, N, N);
    dg.rotateX(-Math.PI / 2);
    const dm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      // premultiplied: the scorch darkens what is under it, the glow adds; the scene alpha is left alone
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      uniforms: { uGlow: { value: 0 }, uScorch: { value: 0 }, uSeed: { value: 0 }, uCol: { value: new THREE.Color(0.32, 0.56, 1.0) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform float uGlow, uScorch, uSeed; uniform vec3 uCol; varying vec2 vUv;
void main(){
  vec2 d = vUv - .5; float r = length(d) * 2., an = atan(d.y, d.x);
  // a ragged star of burnt ground, streaks thrown out from the strike
  float rag = .5 + .2 * sin(an * 5. + uSeed) * sin(an * 3. - uSeed * 1.7) + .14 * sin(an * 13. + uSeed * 3.) + .08 * sin(an * 29. - uSeed);
  float scorch = smoothstep(rag, rag * .35, r) * (.75 + .25 * sin(r * 30. + an * 4.)) * uScorch;
  float glow = exp(-r * r * 14.) * 1.6 + exp(-r * r * 3.5) * .5 + smoothstep(rag * 1.05, rag * .7, r) * smoothstep(rag * .3, rag * .7, r) * .35;
  vec3 c = (uCol * glow * 3. + vec3(.85, .93, 1.) * exp(-r * r * 60.) * 12.) * uGlow;
  gl_FragColor = vec4(c, clamp(scorch * .9, 0., .95));
}`,
    });
    const decal = new THREE.Mesh(dg, dm);
    decal.frustumCulled = false; decal.visible = false; decal.renderOrder = 6;
    group.add(decal);
    // the air where it struck: a ball of blue light standing on the ground, dying with the glow
    const bm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, ...FIRE_MARK,
      uniforms: { uGlow: { value: 0 }, uCol: { value: new THREE.Color(0.32, 0.56, 1.0) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
  vec3 c = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  gl_Position = projectionMatrix * viewMatrix * vec4(c + right * position.x + vec3(0., position.y, 0.), 1.); }`,
      fragmentShader: `uniform float uGlow; uniform vec3 uCol; varying vec2 vUv;
void main(){
  vec2 d = (vUv - vec2(.5, .12)) * vec2(1., .8); float r = length(d);
  float g = exp(-r * r * 22.) * 1.4 + exp(-r * r * 6.) * .35;
  vec3 c = (uCol * g * 2.2 + vec3(.8, .92, 1.) * exp(-r * r * 140.) * 6.) * uGlow;
  // (its light only, unmarked: marked in the scene alpha as it fell off, up to 3, its dim outer air against the sky was
  // taken for smoke and inked black, a dark dome where it struck, and where the mark ran through the figures' values the
  // ink drew a hard-edged arc round it)
  gl_FragColor = vec4(c, 0.);
}`,
    });
    const ball = new THREE.Mesh(new THREE.PlaneGeometry(7, 7).translate(0, 3.5 - 0.84, 0), bm);
    ball.frustumCulled = false; ball.visible = false; ball.renderOrder = 22;
    group.add(ball);
    // the sparks: a burst from the strike at the return stroke, a smaller one at the re-strike
    const sg = new THREE.BufferGeometry();
    const r = rng(77 + i);
    const ra = new Float32Array(SPARKS * 4);
    for (let k = 0; k < SPARKS; k++) ra.set([r(), r(), r(), r()], k * 4);
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    sg.setAttribute('aRand', new THREE.BufferAttribute(ra, 4));
    const sm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, ...FIRE_MARK,
      uniforms: { uP: { value: V3() }, uAge: { value: -1 }, uPx: { value: Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1.75) }, uCol: { value: new THREE.Color(0.32, 0.56, 1.0) } },
      vertexShader: `attribute vec4 aRand; uniform vec3 uP; uniform float uAge, uPx; varying float vA, vHeat;
void main(){
  float late = step(.62, aRand.w);
  float s = uAge - (late > .5 ? .19 : 0.);
  float life = mix(.35, 1.25, aRand.z) * (late > .5 ? .7 : 1.);
  float th = aRand.x * 6.2832, el = mix(.15, 1.35, aRand.y);
  vec3 dir = vec3(cos(th) * cos(el), sin(el), sin(th) * cos(el));
  float sp = mix(4., 13., aRand.z * aRand.y) * (late > .5 ? .7 : 1.);
  float t = max(s, 0.);
  vec3 p = uP + dir * sp * t * (1. - .25 * t) + vec3(0., -4.9 * t * t, 0.);
  p.y = max(p.y, uP.y + .03);
  vA = step(0., s) * (1. - smoothstep(life * .55, life, s));
  vHeat = 1. - clamp(s / life, 0., 1.);
  vec4 mv = viewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(.11 / max(-mv.z, .5) * 600., 1.5, 4.) * uPx;
}`,
      fragmentShader: `uniform vec3 uCol; varying float vA, vHeat;
void main(){
  float r = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .1, r) * vA;
  vec3 c = mix(uCol * .8, mix(vec3(.55, .85, 1.), vec3(1.), vHeat * vHeat), vHeat) * (2. + 6. * vHeat);
  gl_FragColor = vec4(c * a, a * 4.);
}`,
    });
    const sparks = new THREE.Points(sg, sm);
    sparks.frustumCulled = false; sparks.visible = false; sparks.renderOrder = 21;
    group.add(sparks);
    slots.push({ decal, dm, ball, bm, sparks, sm, t0: -1e9, u0: -1e9, target: V3(), strength: 1 });
  }
  let next = 0;
  const _p = V3();
  return {
    group,
    // a bolt from `top` into the ground at `target`, struck at `time` (seconds) for the story position `u0`
    strike(time, u0, target, top, { seed = 1, strength = 1, color = null } = {}) {
      const S = slots[next++ % slots.length];
      S.t0 = time; S.u0 = u0; S.strength = strength;
      S.target.copy(target);
      bolts.strike(time, top, target, { seed, width: 0.75, strength, branches: 10, color, levels: 9, tip: 0 });
      // lay the burn on the ground
      const pos = S.decal.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const x = target.x + pos.getX(k), z = target.z + pos.getZ(k);
        pos.setY(k, groundAt(x, z) - target.y + 0.06);
      }
      pos.needsUpdate = true;
      S.decal.position.copy(target);
      S.ball.position.copy(target);
      S.dm.uniforms.uSeed.value = (seed % 97) * 0.37;
      S.sm.uniforms.uP.value.copy(target).add(_p.set(0, 0.1, 0));
      if (color) { S.dm.uniforms.uCol.value.copy(color); S.sm.uniforms.uCol.value.copy(color); S.bm.uniforms.uCol.value.copy(color); }
    },
    // the brightest flash this frame and where it is
    update(time, u) {
      const b = bolts.update(time);
      let glowMax = 0, gpos = null;
      for (const S of slots) {
        const s = time - S.t0;
        const live = S.t0 > -1e8 && u > -1e8 && u >= S.u0 - 0.05 && u < S.u0 + 6;
        // the ground flares with the return stroke and the re-strikes, then cools over a second or two
        // (from the return stroke, with the bolt there: from inside its leader, the struck house was lit before it came)
        const glow = !live || s < 0.07 ? 0 : (s < 0.45 ? 1 : Math.exp(-(s - 0.45) * 1.8)) * (0.55 + 0.45 * Math.max(0, b.flash)) * S.strength;
        const scorch = live && s > 0.07 ? smooth01((s - 0.06) / 0.25) * (1 - smooth01((u - S.u0 - 2.5) / 3)) : 0;
        S.dm.uniforms.uGlow.value = glow;
        S.dm.uniforms.uScorch.value = scorch;
        S.decal.visible = glow > 0.002 || scorch > 0.002;
        S.bm.uniforms.uGlow.value = glow * (0.4 + 0.6 * Math.exp(-Math.max(0, s - 0.1) * 1.5));
        S.ball.visible = glow > 0.002;
        S.sm.uniforms.uAge.value = s - 0.07;
        S.sparks.visible = live && s > 0.07 && s < 2;
        if (glow > glowMax) { glowMax = glow; gpos = S.target; }
      }
      return { flash: b.flash, pos: b.pos, col: b.col, glow: glowMax, glowPos: gpos };
    },
    lens(eye) { bolts.lens(eye); },
    res(h) { bolts.res(h); },
    reset() { bolts.reset(); for (const S of slots) { S.t0 = -1e9; S.u0 = -1e9; S.decal.visible = false; S.sparks.visible = false; } },
  };
}
const smooth01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
