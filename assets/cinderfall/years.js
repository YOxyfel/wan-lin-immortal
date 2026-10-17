// The six winters at the camp (112.3–124.6, timeline.js YEARS), as pure functions of the story position.
//
// The first year is one slow pan across the camp from the boulder to the pale tree, a season to each thing he does,
// figures of him coming and going like ink in water as the year turns: huddled by the fire against the boulder through
// the winter; gathering the first green in the spring; shaping a bow in the summer; his first arrow in the autumn, wide
// of the target. In the first snow he stands at the tree, lays his palm on his crown, brings it forward level to the
// bark and cuts a mark there under it with his knife: his height, a year on.
// Each year after is a moment of the year and then the mark, cut from one to the next, faster and faster: a hare in
// his snare; the roof beam carried to the hut; an arrow in the target's heart; his strength, in the rain. The marks
// climb the bark, the same lens on them each time.
// In the sixth he walks across the camp he has built to the tree while the whole year turns round him, makes the sixth
// mark in the first frost of the sixth autumn, lays his palm on the six, and turns away.
//
// He is never seen in the face: the lens is beside him or behind him.
import * as THREE from 'three';
import { CUTS } from './timeline.js';
import { clamp, lerp, smooth, band } from './util.js';
import { createBow } from './relic.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const flat = (a, b) => { const d = b.clone().sub(a).setY(0); return d.lengthSq() > 1e-8 ? d.normalize() : V3(0, 0, 1); };
const rightOf = h => V3(-h.z, 0, h.x);
const leftOf = h => V3(h.z, 0, -h.x);
const yawLerp = (a, b, t) => { const ya = Math.atan2(a.x, a.z); let d = Math.atan2(b.x, b.z) - ya; d = Math.atan2(Math.sin(d), Math.cos(d)); const y = ya + d * t; return V3(Math.sin(y), 0, Math.cos(y)); };

// a monotone cubic through [x, y] (Fritsch–Carlson): it never overshoots, so the lens never stops or goes back
function monotone(pts) {
  const n = pts.length, x = pts.map(p => p[0]), y = pts.map(p => p[1]);
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return u => {
    if (u <= x[0]) return y[0];
    if (u >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (u > x[i + 1]) i++;
    const h = x[i + 1] - x[i], t = (u - x[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// one shot: keys [u, lens, look, fov]; the lens moves through them on a smooth path
function makeShot(id, keys) {
  const n = keys.length;
  const pos = new THREE.CatmullRomCurve3(keys.map(k => k[1]), false, 'centripetal');
  const look = new THREE.CatmullRomCurve3(keys.map(k => k[2]), false, 'centripetal');
  const t = monotone(keys.map((k, i) => [k[0], i / (n - 1)]));
  const fov = monotone(keys.map(k => [k[0], k[3]]));
  return { id, u0: keys[0][0], u1: keys[n - 1][0], at(u, out) { const tt = clamp(t(u)); pos.getPoint(tt, out.pos); look.getPoint(tt, out.look); out.fov = fov(u); return out; } };
}

// his age (0 at fifteen, when he came; 1 at twenty-one) at each mark, and so his height there: the marks climb
export const MARK_AGE = [0.12, 0.34, 0.54, 0.72, 0.87, 1.0];
const ageAt = monotone([[112.3, 0], ...CUTS.map((c, k) => [c, MARK_AGE[k]]), [124.6, 1.0]]);
// the top of his head above the ground he stands on (the rig's height, a little hair over the crown)
export const crownOf = a => 1.704 + 0.1 * a;

// each mark: [the palm up to his crown from, there by; laid forward from, at the bark by; the knife up from; the score
// across from, to; the hands down by]. The first and the sixth in full; the second a little quicker; for the third the
// lens comes in on the palm on his crown, for the fourth and the fifth on it at the bark already (null)
const MARKS = [
  [116.06, 116.15, 116.17, 116.27, 116.29, 116.34, 116.47, 116.58],
  [117.76, 117.82, 117.83, 117.9, 117.88, 117.94, 118.06, 118.15],
  [null, null, 119.07, 119.14, 119.12, 119.17, 119.29, 119.38],
  [null, null, null, null, 120.1, 120.16, 120.29, 120.37],
  [null, null, null, null, 120.88, 120.93, 121.06, 121.13],
  [122.68, 122.77, 122.79, 122.88, 122.9, 122.95, 123.09, 123.22],
];
// the close shots on the bark in the years between: [from, to]
const CLOSE = [null, [117.75, 118.25], [119.05, 119.45], [120.08, 120.4], [120.86, 121.15], null];
export const scoreOf = k => [MARKS[k][5], MARKS[k][6]];

export function createYears({ anchors: A, hB, root, tally, ROCKSIT, rockOut, wayOut }) {
  const onG = (x, z, dy = 0) => V3(x, hB(x, z) + dy, z);
  const { tn, tRight, STAND, notch } = tally;
  const tFace = tn.clone().negate();
  const TARGET = A.TARGET.clone(), BULL = A.BULL.clone(), RANGE = A.RANGE.clone();
  const toTarget = flat(RANGE, TARGET), rRange = rightOf(toTarget);

  // ------------------------------------------------------------ the places
  // (the first year's, each a little farther round to the left of the last as the eye pans from the boulder to the tree)
  const FIRESIDE = onG(0.45, -0.2), FIRESIDE_H = flat(onG(0.45, -0.2), A.FIRE);   // huddled by the fire, the winter
  const SPRING = onG(-1.84, 4.25), SPRING_H = V3(1, 0, 0);        // gathering the first green
  const SUMMER = onG(-3.1, 5.25), SUMMER_H = V3(1, 0, 0);         // shaping a bow (where he will shoot it from)
  const SNARE = onG(7.95, 8.72), SNARE_H = V3(0, 0, 1);           // the second year: his snare by the stream
  const LOOP = onG(7.95, 9.38, 0.1);
  const BEAM0 = onG(-4.6, -2.4), BEAM1 = onG(-6.0, -4.1);          // the third: the beam carried to the hut
  const BEAM_H = flat(BEAM0, BEAM1);
  const PUSH = onG(5.4, 6.2), PUSH_H = V3(-1, 0, 0);              // the fifth: his strength, in the rain, by the post
  // (where he looses from; the first arrow wide of the target and beyond it, in the ground; the fourth year's, home)
  const LOOSE = RANGE.clone().addScaledVector(toTarget, 0.1).addScaledVector(rRange, 0.05).add(V3(0, 1.47, 0));
  const MISS = TARGET.clone().addScaledVector(rRange, 1.25).addScaledVector(toTarget, 1.1);
  MISS.y = hB(MISS.x, MISS.z) - 0.12;
  const MISS_D = toTarget.clone().multiplyScalar(0.82).add(V3(0, -0.57, 0)).normalize();
  const HIT = BULL.clone().addScaledVector(toTarget, 0.07), HIT_D = BULL.clone().sub(LOOSE).normalize();
  // the sixth year's walk across the camp to the tree
  const WALK = new THREE.CatmullRomCurve3([onG(1.4, 6.0), onG(-0.8, 6.9), onG(-3.4, 7.9), onG(-5.4, 8.4), STAND.clone()], false, 'centripetal');
  const WALK0 = 121.18, WALK1 = 122.6;
  const walkLen = WALK.getLength();
  const SIX = notch[5].mid.clone().lerp(notch[0].mid, 0.5);

  // ------------------------------------------------------------ the marks
  const markPhase = (k, u) => {
    const [c0, c1, s0, s1, k0, sc0, sc1, rel] = MARKS[k];
    const crown = c0 === null ? 1 : smooth(c0, c1, u);
    const slide = s0 === null ? 1 : smooth(s0, s1, u);
    const knife = smooth(k0, sc0, u);
    const score = smooth(sc0, sc1, u);
    const down = smooth(sc1 + 0.01, rel, u);
    return { crown, slide, knife, score, down, sc0, sc1, rel };
  };
  // his left palm: on his crown, laid forward to the bark over the place for the mark
  const palmAt = (k, slide) => {
    const nt = notch[k];
    const crown = STAND.clone().add(V3(0, crownOf(MARK_AGE[k]) + 0.014, 0)).addScaledVector(tFace, 0.03);
    const bark = nt.mid.clone().addScaledVector(nt.n, 0.1).add(V3(0, 0.016, 0));
    return crown.lerp(bark, slide);
  };
  // his right fist with the knife: the blade out across him to the left, its point drawn along the line under the palm
  const knifeAt = (k, t) => notch[k].left.clone().lerp(notch[k].right, t).addScaledVector(tRight, 0.13).addScaledVector(notch[k].n, 0.03).add(V3(0, -0.002, 0));
  const knifeRest = () => STAND.clone().addScaledVector(tFace, 0.22).addScaledVector(tRight, 0.24).add(V3(0, 1.18, 0));
  function mark(o, k, u) {
    const ph = markPhase(k, u);
    o.P = STAND.clone();
    o.heading = tFace.clone();
    o.speed = 0;
    o.age = MARK_AGE[k];
    o.measure = ph.crown * (1 - ph.down);
    o.measureSlide = ph.slide;
    o.measureTarget = palmAt(k, ph.slide);
    o.carve = ph.knife * (1 - ph.down);
    o.carveMode = 'across';
    o.knifeFlip = true;
    o.carveTarget = knifeRest().lerp(knifeAt(k, ph.score), smooth(0, 0.6, ph.knife))
      .add(V3(0, 0.003 * Math.sin(u * 900) * band(ph.sc0, ph.sc0 + 0.01, ph.sc1 - 0.01, ph.sc1, u), 0));
    o.gripR = o.carve > 0.05 ? 'rod' : null;
    o.lookAt = notch[k].mid.clone();
    o.lookW = band(ph.sc0 - 0.25, ph.sc0 - 0.12, ph.rel, ph.rel + 0.1, u) * 0.9;
    return o;
  }

  // ------------------------------------------------------------ the lens: the shots
  const L = (x, h, z) => V3(x, Math.max(hB(x, z), 0) + h, z);
  const behind = (back, side, h) => STAND.clone().addScaledVector(tn, back).addScaledVector(tRight, side).add(V3(0, h, 0));
  // the close lens on the bark: off his right shoulder, level with the mark, the ladder of them under his fingers and the
  // blade coming across (his head at the edge of the frame, turned away to the bark)
  // (a little below the palm, so the mark under it is seen)
  const closePos = (k, push = 0) => notch[k].mid.clone().addScaledVector(tn, 0.62 - push).addScaledVector(tRight, 0.45 - push * 0.4).add(V3(0, -0.12 + push * 0.1, 0));
  const closeLook = k => notch[k].mid.clone().lerp(notch[0].mid, 0.35).addScaledVector(tRight, 0.05).add(V3(0, 0.005, 0));
  const SHOTS = [];
  // the first year: the pan from the boulder to the tree; behind him there, his palm to his crown and forward to the
  // bark; then close beside him for the knife
  SHOTS.push(makeShot('y1', [
    [112.35, V3(-2.6, 3.0, 9.2), ROCKSIT.clone().add(V3(0, 0.75, 0)), 46],
    [112.95, L(-2.2, 2.75, 8.95), ROCKSIT.clone().lerp(FIRESIDE, 0.5).add(V3(0, 0.6, 0)), 42],
    [113.5, L(-2.0, 2.55, 8.8), FIRESIDE.clone().addScaledVector(FIRESIDE_H, 0.4).add(V3(0, 0.55, 0)), 34],
    [113.95, L(-1.9, 2.4, 8.7), SPRING.clone().addScaledVector(SPRING_H, 0.3).add(V3(0, 0.45, 0)), 38],
    [114.6, L(-2.1, 2.3, 8.7), SUMMER.clone().addScaledVector(SUMMER_H, 0.3).add(V3(0, 0.5, 0)), 37],
    [115.25, L(-3.95, 1.75, 9.15), RANGE.clone().lerp(TARGET, 0.32).add(V3(0, 1.35, 0)), 40],
    [115.62, L(-4.1, 1.75, 9.25), RANGE.clone().lerp(TARGET, 0.55).lerp(MISS, 0.3).add(V3(0, 1.0, 0)), 40],
    [115.95, L(-4.6, 2.1, 9.6), STAND.clone().add(V3(0, 1.45, 0)), 42],
    [116.18, behind(1.9, 0.95, 2.0), STAND.clone().add(V3(0, 1.55, 0)).addScaledVector(tFace, 0.25), 40],
    [116.29, behind(1.72, 0.88, 1.98), STAND.clone().add(V3(0, 1.62, 0)).addScaledVector(tFace, 0.32), 39],
  ]));
  SHOTS.push(makeShot('y1b', [[116.29, closePos(0), closeLook(0), 28], [116.8, closePos(0, 0.07), closeLook(0), 27]]));
  // the years between: a moment of each, then the mark
  {
    // the second: the snare by the stream through the year, and in the autumn a hare in it
    const r = rightOf(SNARE_H);
    SHOTS.push(makeShot('y2a', [
      [116.8, SNARE.clone().addScaledVector(SNARE_H, -1.9).addScaledVector(r, 1.9).add(V3(0, 1.25, 0)), LOOP.clone().add(V3(0, 0.25, 0)), 40],
      [117.75, SNARE.clone().addScaledVector(SNARE_H, -1.2).addScaledVector(r, 2.35).add(V3(0, 1.1, 0)), LOOP.clone().add(V3(0, 0.45, 0)), 38],
    ]));
    SHOTS.push(makeShot('y2b', [[117.75, closePos(1), closeLook(1), 28], [118.25, closePos(1, 0.06), closeLook(1), 27]]));
  }
  {
    // the third: the beam on his shoulder, to the hut as it goes up
    const l = leftOf(BEAM_H), mid = BEAM0.clone().lerp(BEAM1, 0.5);
    SHOTS.push(makeShot('y3a', [
      [118.25, mid.clone().addScaledVector(l, 4.4).addScaledVector(BEAM_H, -1.2).add(V3(0, 1.7, 0)), BEAM0.clone().lerp(BEAM1, 0.2).add(V3(0, 1.5, 0)), 44],
      [119.05, mid.clone().addScaledVector(l, 4.0).addScaledVector(BEAM_H, 0.6).add(V3(0, 1.65, 0)), BEAM1.clone().addScaledVector(BEAM_H, 1.4).add(V3(0, 1.7, 0)), 44],
    ]));
    SHOTS.push(makeShot('y3b', [[119.05, closePos(2), closeLook(2), 28], [119.45, closePos(2, 0.05), closeLook(2), 27]]));
  }
  {
    // the fourth: behind him again where he missed the first time; the arrow goes home
    SHOTS.push(makeShot('y4a', [
      [119.45, RANGE.clone().addScaledVector(toTarget, -2.5).addScaledVector(rRange, 0.85).add(V3(0, 1.75, 0)), BULL.clone().lerp(RANGE, 0.25).add(V3(0, 0.25, 0)), 38],
      [119.84, RANGE.clone().addScaledVector(toTarget, -2.3).addScaledVector(rRange, 0.8).add(V3(0, 1.72, 0)), BULL.clone().lerp(RANGE, 0.12).add(V3(0, 0.12, 0)), 36],
      [120.08, RANGE.clone().addScaledVector(toTarget, -1.9).addScaledVector(rRange, 0.7).add(V3(0, 1.68, 0)), BULL.clone().add(V3(0, 0.02, 0)), 33],
    ]));
    SHOTS.push(makeShot('y4b', [[120.08, closePos(3, 0.02), closeLook(3), 28], [120.4, closePos(3, 0.07), closeLook(3), 27]]));
  }
  {
    // the fifth: low beside him, his strength in the rain
    const r = rightOf(PUSH_H);
    SHOTS.push(makeShot('y5a', [
      [120.4, PUSH.clone().addScaledVector(r, -2.5).addScaledVector(PUSH_H, 0.3).add(V3(0, 0.6, 0)), PUSH.clone().addScaledVector(PUSH_H, 0.2).add(V3(0, 0.32, 0)), 40],
      [120.86, PUSH.clone().addScaledVector(r, -2.3).addScaledVector(PUSH_H, -0.15).add(V3(0, 0.55, 0)), PUSH.clone().addScaledVector(PUSH_H, 0.05).add(V3(0, 0.3, 0)), 39],
    ]));
    SHOTS.push(makeShot('y5b', [[120.86, closePos(4, 0.02), closeLook(4), 28], [121.15, closePos(4, 0.06), closeLook(4), 27]]));
  }
  {
    // the sixth: beside him as he walks across the camp, the year turning round him; in behind him at the tree, his palm
    // to his crown and forward; close beside him for the sixth mark, and his palm laid on the six; behind him as he turns
    const wp = u => WALK.getPointAt(clamp((u - WALK0) / (WALK1 - WALK0)));
    SHOTS.push(makeShot('y6', [
      [121.15, L(2.3, 2.7, 12.4), wp(121.15).addScaledVector(V3(-1, 0, 0.15), 1.5).add(V3(0, 1.2, 0)), 46],
      [121.65, L(0.6, 2.6, 12.5), wp(121.65).addScaledVector(V3(-1, 0, 0.15), 1.5).add(V3(0, 1.2, 0)), 45],
      [122.15, L(-1.9, 2.45, 12.0), wp(122.15).addScaledVector(V3(-1, 0, 0), 1.3).add(V3(0, 1.25, 0)), 44],
      [122.5, L(-4.0, 2.3, 10.9), STAND.clone().add(V3(0, 1.5, 0)), 42],
      [122.72, behind(1.85, 0.95, 2.02), STAND.clone().add(V3(0, 1.6, 0)).addScaledVector(tFace, 0.25), 40],
      [122.9, behind(1.7, 0.88, 1.98), STAND.clone().add(V3(0, 1.66, 0)).addScaledVector(tFace, 0.32), 39],
    ]));
    SHOTS.push(makeShot('y6b', [
      [122.9, closePos(5), closeLook(5), 28],
      [123.15, closePos(5, 0.05), closeLook(5), 27],
      [123.5, closePos(5, -0.2), SIX.clone().addScaledVector(tRight, 0.05), 37],
      [124.15, closePos(5, -0.24), SIX.clone().addScaledVector(tRight, 0.04), 37],
    ]));
    SHOTS.push(makeShot('y6c', [
      [124.15, behind(1.5, 0.9, 1.82), SIX.clone().add(V3(0, -0.05, 0)), 40],
      [124.6, behind(2.3, 1.0, 1.75), STAND.clone().addScaledVector(tRight, 1.6).addScaledVector(tn, 2.4).add(V3(0, 1.15, 0)), 46],
    ]));
  }
  const _o = { pos: V3(), look: V3(), fov: 46, shot: '' };
  function camera(u) {
    let s = SHOTS[0];
    for (const x of SHOTS) if (u >= x.u0) s = x;
    s.at(u, _o);
    _o.shot = s.id;
    return _o;
  }
  // (the lens may come close by him without hiding him: on the bark over his shoulder)
  const closeNow = u => CLOSE.some(c => c && u >= c[0] && u < c[1]) || (u >= 116.29 && u < 116.8) || (u >= 122.9 && u < 124.15);

  // ------------------------------------------------------------ his own figure
  // (the stave stood upright before him as he sits, its foot on the ground: his left hand holds it near the top, the
  // knife is drawn down it, away from the hand)
  const staveAt = t => SUMMER.clone().addScaledVector(SUMMER_H, lerp(0.5, 0.4, t)).addScaledVector(rightOf(SUMMER_H), 0.04).add(V3(0, lerp(0.0, 1.3, t), 0));
  function hero(u, o) {
    o.age = ageAt(u);
    o.speed = 0;
    o.fade = 1;
    o.visible = true;
    o.knifeFlip = false;
    if (u < 113.12) {
      // where he sank against the boulder, as the shelter of branches goes up over the place
      o.P = ROCKSIT.clone(); o.heading = rockOut.clone(); o.sit = 1; o.grief = 0.88;
      o.fade = 1 - smooth(112.95, 113.12, u);
      return o;
    }
    if (u > 114.32 && u < 115.08) {
      // the first summer: a stave across his knees, shaping it into a bow
      o.P = SUMMER.clone(); o.heading = SUMMER_H.clone(); o.sit = 1;
      o.fade = band(114.32, 114.47, 114.93, 115.08, u);
      // (long strokes down the wood, the knife lifted back up between them)
      const stroke = (u * 9) % 1, down = smooth(0, 0.75, stroke), lift = smooth(0.75, 1, stroke);
      o.carve = 1;
      o.carveTarget = staveAt(lerp(0.58, 0.36, down * (1 - lift) + 0 * lift)).addScaledVector(SUMMER_H, -0.04 - 0.03 * Math.sin(lift * Math.PI)).add(V3(0, 0.12, 0));
      o.braceTarget = staveAt(0.74);
      o.gripR = 'rod'; o.gripL = 'rod';
      o.lookAt = staveAt(0.45); o.lookW = 0.85;
      return o;
    }
    if (u > 115.45 && u < 116.8) {
      // the first snow: at the tree for the first mark (come there while the eye is on the bow, before it turns)
      mark(o, 0, u);
      o.fade = smooth(115.45, 115.62, u);
      return o;
    }
    for (let k = 1; k < 5; k++) {
      const c = CLOSE[k];
      if (u >= c[0] && u < c[1]) return mark(o, k, u);
    }
    if (u >= 121.15 && u < 124.6) {
      o.age = 1;
      if (u < WALK1) {
        // the sixth: across the camp to the tree, while the year turns round him
        const t = clamp((u - WALK0) / (WALK1 - WALK0));
        o.P = WALK.getPointAt(Math.min(t, 0.999));
        o.heading = flat(o.P, WALK.getPointAt(Math.min(1, t + 0.02)));
        o.speed = walkLen / ((WALK1 - WALK0) / 0.2025) * (1 - smooth(0.93, 1, t));
        return o;
      }
      mark(o, 5, u);
      o.age = 1;
      // (round from the way he came in, to face the tree)
      o.heading = yawLerp(flat(WALK.getPointAt(0.96), STAND), tFace, smooth(WALK1, WALK1 + 0.1, u));
      if (u > 123.2) {
        // his palm laid on the six; then he turns from the tree, for the way out
        o.palm = band(123.55, 123.8, 124.05, 124.25, u);
        o.palmTarget = SIX.clone().addScaledVector(tn, 0.012);
        o.lookAt = SIX.clone(); o.lookW = 1 - smooth(124.05, 124.4, u);
        o.heading = yawLerp(tFace, flat(STAND, wayOut), smooth(124.2, 124.6, u));
      }
      return o;
    }
    o.visible = false;
    o.P = STAND.clone(); o.heading = tFace.clone();
    return o;
  }

  // ------------------------------------------------------------ the others: him in the moments of the years
  // [{ i (one id to each moment; even ids go to the engine's first spare figure), P, heading, state, fade, age }]
  function others(u) {
    const out = [];
    const add = (i, P, heading, state, fade = 1) => { if (fade > 0.005) out.push({ i, P: P.clone(), heading: heading.clone(), state, fade, age: ageAt(u) }); };
    if (u > 112.98 && u < 113.72) {
      // the first winter: huddled by the fire; gone as the snow goes
      add(1, FIRESIDE, FIRESIDE_H, { sit: 1, grief: 0.8 - 0.2 * smooth(113.1, 113.5, u) }, band(112.98, 113.15, 113.55, 113.72, u));
    }
    if (u > 113.48 && u < 114.35) {
      // the first spring: crouched in the new grass, gathering
      const pick = 0.5 + 0.5 * Math.sin(u * 26);
      add(0, SPRING, SPRING_H, { crouch: 1, reach: 0.85, reachTarget: SPRING.clone().addScaledVector(SPRING_H, 0.42).addScaledVector(rightOf(SPRING_H), 0.12).add(V3(0, 0.05 + 0.12 * pick, 0)), lookAt: SPRING.clone().addScaledVector(SPRING_H, 0.5), lookW: 0.9 },
        band(113.48, 113.64, 114.2, 114.35, u));
    }
    if (u > 115.08 && u < 116.02) {
      // the first autumn: the bow he made; his first arrow, wide
      add(2, RANGE, toTarget, { draw: smooth(115.18, 115.36, u) * (1 - smooth(115.74, 115.92, u)), release: smooth(115.495, 115.52, u), gripL: 'bow', lookAt: BULL, lookW: 0.6 },
        band(115.08, 115.22, 115.86, 116.02, u));
    }
    if (u >= 116.8 && u < 117.75) {
      // the second: at his snare by the stream through the year; in the autumn a hare in it, lifted out
      const lift = smooth(117.38, 117.62, u);
      add(4, SNARE, SNARE_H, { crouch: 1 - 0.55 * lift, reach: 0.9, reachTarget: LOOP.clone().lerp(SNARE.clone().addScaledVector(SNARE_H, 0.42).add(V3(0, 0.95, 0)), lift).add(V3(0, 0.12, 0)), lookAt: LOOP.clone().add(V3(0, 0.6 * lift, 0)), lookW: 0.85 });
    }
    if (u >= 118.25 && u < 119.05) {
      // the third: the beam on his shoulder, to the hut
      const P = BEAM0.clone().lerp(BEAM1, (u - 118.25) / 0.8);
      add(6, P, BEAM_H, { speed: BEAM0.distanceTo(BEAM1) / (0.8 / 0.3825), reach: 1, reachTarget: P.clone().addScaledVector(rightOf(BEAM_H), 0.2).add(V3(0, 1.58, 0)).addScaledVector(BEAM_H, 0.32), gripR: 'hook' });
    }
    if (u >= 119.45 && u < 120.08) {
      // the fourth: drawn, held, loosed: home
      add(8, RANGE, toTarget, { draw: smooth(119.45, 119.53, u), release: smooth(119.795, 119.82, u), gripL: 'bow', lookAt: BULL, lookW: 0.6 });
    }
    if (u >= 120.4 && u < 120.86) {
      // the fifth: push-ups in the rain
      add(10, PUSH, PUSH_H, { pushup: 1 });
    }
    return out;
  }

  // ------------------------------------------------------------ the things in his hands
  const bowB = createBow();
  bowB.group.visible = false;
  let bowMounted = false;
  const nocked = bowB.arrow;
  nocked.visible = false;
  root.add(nocked);
  const arrows = [0, 1].map(() => { const a = bowB.arrow.clone(true); a.visible = false; root.add(a); return a; });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c4630, roughness: 0.9 });
  // the stave he shapes
  const stave = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 1.0, 6), wood);
  stave.castShadow = true; stave.visible = false; root.add(stave);
  // the roof beam
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 2.7, 8), wood);
  beam.castShadow = true; beam.visible = false; root.add(beam);
  // the hare (hung by the ears from its origin, the body down along -y; the same plain material kind: no new shader)
  const hare = new THREE.Group();
  {
    const fur = new THREE.MeshStandardMaterial({ color: 0x75644f, roughness: 0.95 });
    const part = (r, s, p) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 7), fur); m.scale.set(...s); m.position.set(...p); m.castShadow = true; hare.add(m); };
    part(0.1, [0.85, 1.7, 0.8], [0, -0.28, 0]);
    part(0.055, [1, 1.05, 1.2], [0, -0.08, 0.035]);
    part(0.018, [1, 3.6, 0.55], [0.022, 0.0, -0.005]);
    part(0.018, [1, 3.6, 0.55], [-0.022, 0.0, -0.005]);
    part(0.03, [1.1, 2.6, 1], [0.045, -0.46, 0.02]);
    part(0.03, [1.1, 2.6, 1], [-0.045, -0.46, 0.02]);
    hare.visible = false;
    root.add(hare);
  }
  const _a = V3(), _b = V3(), _c = V3(), _q = new THREE.Quaternion();
  // an arrow in flight from where he looses it to where its head ends up (along dEnd there): a shallow arc
  const fly = (a, headEnd, dEnd, t, arc) => {
    const nEnd = headEnd.clone().addScaledVector(dEnd, -0.8);
    const p = LOOSE.clone().lerp(nEnd, t); p.y += Math.sin(t * Math.PI) * arc;
    const d = nEnd.clone().sub(LOOSE).add(V3(0, Math.PI * Math.cos(t * Math.PI) * arc, 0)).normalize().lerp(dEnd, smooth(0.7, 1, t)).normalize();
    a.position.copy(p);
    a.lookAt(_c.copy(p).add(d));
  };
  function update(u, { ghosts = [] } = {}) {
    // his bow, in the left fist of the first of the engine's spare figures while he shoots
    const g0 = ghosts[0];
    if (g0 && !bowMounted) { bowB.group.rotation.set(0, Math.PI, 0); bowB.group.position.set(0, 0, -0.2); g0.attach('handL', bowB.group); bowMounted = true; }
    const shooting = (u > 115.08 && u < 116.02) || (u >= 119.45 && u < 120.08);
    bowB.group.visible = !!(bowMounted && shooting);
    let draw = 0, loose = 1e9;
    if (u > 115.08 && u < 116.02) { draw = smooth(115.3, 115.46, u); loose = 115.5; }
    else if (u >= 119.45 && u < 120.08) { draw = smooth(119.46, 119.56, u); loose = 119.8; }
    const pull = bowB.update(u < loose ? draw : 0);
    // (the arrow on the string while it is drawn)
    nocked.visible = bowB.group.visible && !!g0 && g0.group.visible && u < loose && draw > 0.02;
    if (nocked.visible) {
      bowB.group.updateWorldMatrix(true, false);
      bowB.group.localToWorld(_a.set(0, 0, pull));
      bowB.group.localToWorld(_b.set(0, 0, -0.2));
      nocked.position.copy(_a);
      nocked.lookAt(_c.copy(_b).sub(_a).normalize().add(_b));
    }
    // the first arrow: wide, into the ground beyond the target, and there from then on; the fourth year's, home
    arrows[0].visible = u > 115.5 && u < 124.6;
    if (arrows[0].visible) fly(arrows[0], MISS, MISS_D, clamp((u - 115.5) / 0.075), 0.55);
    arrows[1].visible = u > 119.8 && u < 124.6;
    if (arrows[1].visible) fly(arrows[1], HIT, HIT_D, clamp((u - 119.8) / 0.035), 0.12);
    // the stave across his knees in the first summer
    stave.visible = u > 114.32 && u < 115.08;
    if (stave.visible) {
      const a = staveAt(0), b = staveAt(1);
      stave.position.copy(a).lerp(b, 0.5);
      stave.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      stave.scale.set(1, a.distanceTo(b), 1);
    }
    // the beam on his shoulder
    beam.visible = u >= 118.25 && u < 119.05;
    if (beam.visible) {
      const P = BEAM0.clone().lerp(BEAM1, (u - 118.25) / 0.8), r = rightOf(BEAM_H);
      const a = P.clone().addScaledVector(r, 0.17).add(V3(0, 1.43, 0)).addScaledVector(BEAM_H, -1.25), b = P.clone().addScaledVector(r, 0.16).add(V3(0, 1.66, 0)).addScaledVector(BEAM_H, 1.4);
      beam.position.copy(a).lerp(b, 0.48);
      beam.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    }
    // the hare: in the snare, then by its ears from his fist
    hare.visible = u >= 117.2 && u < 117.75;
    if (hare.visible) {
      const lift = smooth(117.38, 117.62, u);
      hare.position.copy(LOOP).lerp(SNARE.clone().addScaledVector(SNARE_H, 0.42).add(V3(0, 0.95, 0)), lift).add(V3(0, 0.06, 0));
      // (lying in the loop, then hanging)
      _q.setFromAxisAngle(rightOf(SNARE_H), (1 - lift) * Math.PI * 0.5);
      hare.quaternion.copy(_q);
      if (lift < 0.05) hare.position.copy(LOOP).add(V3(0, 0.07, 0)).addScaledVector(SNARE_H, -0.12);
    }
  }
  function dispose() {
    for (const o of [nocked, ...arrows, stave, beam, hare]) root.remove(o);
    if (bowB.group.parent) bowB.group.parent.remove(bowB.group);
  }
  return { camera, closeNow, hero, others, update, dispose, places: { SPRING, SUMMER, SNARE, BEAM0, BEAM1, PUSH, RANGE, MISS, WALK }, ageAt };
}
