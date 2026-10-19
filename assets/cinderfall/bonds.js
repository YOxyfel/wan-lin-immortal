// The morning's bonds, and what comes of them.
//
// The morning he goes for the mushrooms is the village's last, so it is given its people. His uncle lays a palm on his
// head and draws it back level over his own ("Taller than me, now."). The street's dog, Huang, dozing in the sun at the
// foot of the steps, is up and to him, sits before him to be scratched behind the ears, then is off up the street after
// the children; it comes bounding back to him past the smith's and trots at his heel. The bun Auntie Mei holds out to
// him over her terrace goes to the dog. Short of the gate the dog trots on ahead, round in front of him, and sits down
// in his way, wanting to come; he kneels to it ("Go home. Watch the old man for me."), steps round it and goes on alone,
// and it sits and watches him go.
// That night it is a wolf that stands where the dog sat, looking out through the gate; and in the house the dog is
// lying beside the old man.
//
// Everything here is a pure function of the story position u (the clock only breathes, wags and plays): before the
// walk, of u; on the walk up the street, of the walk's own time on Watch's clock (walk.js), shared by the engine's
// figures and its camera.
import * as THREE from 'three';
import { roadX } from './layout.js';
import { clamp, lerp, smooth, band, track } from './util.js';
import { poseWolf, poseWolfMix, lookWolf } from './wolf.js';
import { WALK, BEAT, walkAt, wt, inWalk, tband } from './walk.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const yawOf = d => Math.atan2(d.x, d.z);
const dirOf = yaw => V3(Math.sin(yaw), 0, Math.cos(yaw));
// shortest way round from one yaw to another, by k
const turnYaw = (a, b, k) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * k; };

// ---------------------------------------------------------------- the timing
// his uncle's palm: up onto his head, a pat, drawn back level over his own, held there while he laughs, down
// (follow: the old man's eyes going with his hand as it leaves the boy's crown, while it is still before his face)
export const MEASURE = {
  near: u => band(11.25, 11.6, 13.55, 13.95, u),       // the two of them a step closer
  arm: u => band(11.4, 11.78, 13.42, 13.82, u),        // the uncle's left arm up
  slide: u => smooth(12.35, 12.95, u),                  // from the boy's crown back over his own
  follow: u => band(12.36, 12.56, 12.66, 12.9, u),
  laugh: u => band(12.95, 13.1, 13.62, 13.92, u),
  speak: u => band(13.0, 13.08, 13.45, 13.56, u),
};
// the dog at the foot of the steps (story u): he stops for it, crouches, scratches it behind the ears; up, and on
const PET = { stop: 20.3, crouch: u => band(20.2, 20.55, 21.55, 21.85, u), pat: u => band(20.5, 20.8, 21.3, 21.62, u) };
// the walk (walk time t, walk.js BEAT): Auntie Mei's bun taken, given to the dog; the dog in his way at the gate
const M = BEAT.mei, MO = BEAT.meiOff, G0 = BEAT.gate, G1 = BEAT.gateOff;
const BUN = {
  take: t => tband(M + 0.25, M + 0.7, M + 0.85, M + 1.3, t),
  give: t => tband(M + 2.45, M + 2.9, M + 3.15, M + 3.7, t),
  bow: t => tband(M + 2.4, M + 2.9, M + 3.35, M + 3.95, t),
  inSeller: M + 0.75, inBoy: M + 3.1, eaten: M + 3.75, out: M - 2.2,
};
// (down onto his knee and up again each over more than a second (the pose eases it again): up in half of one, he was
// standing in a single frame)
const GATE = { kneel: t => tband(G0 - 0.45, G0 + 0.85, G1 - 1.35, G1 - 0.05, t), pat: t => tband(G0 + 0.9, G0 + 1.3, G1 - 1.65, G1 - 1.15, t) };
// where he stops short of the gate (a little right of the middle of the way: walk.js holds him at it), and where the
// dog sits in his way: that night the wolf stands there (village-life.js)
export const GATE_STOP = { z: -36.9, x: 0.45 };
export const DOG_GATE_AT = () => V3(roadX(GATE_STOP.z) + GATE_STOP.x + 0.05, 0, GATE_STOP.z - 0.72);

export function createBonds({ world, life, valleyP, valleyHeading, groundY }) {
  const A = world.anchors, UH = A.houses.uncle, PLAT = UH.frame.plat;
  const dog = world.huang;
  dog.root.visible = false;

  // ---------------------------------------------------------------- where everyone is
  const UNCLE_AT = V3(6.5, PLAT, 44.0), BOY_AT = V3(5.62, PLAT, 44.06);
  // (the uncle's steps: down from the porch's front edge to the street, six of them; his feet on a ramp along their
  // noses)
  const STEP_TOP = UH.porchFront.x, STEP_N = Math.max(1, Math.ceil(PLAT / 0.19)), STEP_BOT = STEP_TOP - 0.4 * STEP_N;
  // where the dog dozes, in the sun at the foot of the steps, its nose toward the door
  const DOG_BED = V3(2.0, 0, 41.0), DOG_BED_YAW = 1.0;
  // the bun stall: he stands in the street at the foot of her terrace (its edge is at x -3.8), she near its edge; the
  // dog sits before him on his left, in the street, its face up to him
  const BUN_BOY = V3(-2.95, 0, -7.9);
  const DOG_BEG = BUN_BOY.clone().add(V3(-0.55, 0, 0.3)), DOG_BEG_YAW = Math.atan2(0.55, -0.3);
  const DOG_BEG_HEAD = DOG_BEG.clone().add(dirOf(DOG_BEG_YAW).multiplyScalar(0.28)).add(V3(0, 0.42, 0));
  let K = null;
  const anchors = () => {
    if (K) return K;
    // (the dog sat before him and a little to his right, its face turned up to him and to the lens over his right
    // shoulder: square before him, his arm and shoulder hid it from the lens)
    const PET_BOY = valleyP(21.0).setY(0);
    const fw = valleyHeading(21.0, valleyP(21.0)).clone().setY(0).normalize();
    const DOG_PET = PET_BOY.clone().addScaledVector(fw, 0.85).addScaledVector(V3(-fw.z, 0, fw.x), 0.18);
    const STOP = V3(roadX(GATE_STOP.z) + GATE_STOP.x, 0, GATE_STOP.z);
    const DOG_GATE = DOG_GATE_AT();
    K = { PET_BOY, DOG_PET, DOG_PET_YAW: yawOf(PET_BOY.clone().sub(DOG_PET)), STOP, DOG_GATE, BUN_BOY, DOG_BEG,
      legend: null, stallWall: A.stallWall ? A.stallWall.clone() : null, sellerFace: V3(-4.1, 2.02, -8.0) };
    return K;
  };

  // ---------------------------------------------------------------- his feet, his heading, where he looks
  // (applied to his place on the road: valleyP)
  function feet(u, P, mo) {
    // a step closer to his uncle while the old man measures him
    if (mo > 0.999) P.x += 0.16 * MEASURE.near(u);
    // down the steps on their noses, not a straight glide through the air
    if (mo > 0 && mo < 1 && P.x > STEP_BOT - 0.3 && Math.abs(P.z - UH.porchFront.z) < 1.4) P.y = PLAT * clamp((P.x - STEP_BOT) / (STEP_TOP - STEP_BOT));
    // the night: round the wolf where the dog sat (it snarls at him as he goes by)
    if (u > 72.5 && u < 73.6) P.x -= 0.55 * band(72.55, 72.9, 73.25, 73.55, u);
    return P;
  }
  // (applied after the road's own heading: valleyHeading; on the walk the engine turns him: walkHeading)
  function heading(u, P, h) { return h; }
  // [weight, () => target]: the dog as it comes and while he scratches it (on the walk the engine has the rest)
  const _dh = V3();
  const dogHead = () => { dog.root.updateMatrixWorld(true); return dog.head.getWorldPosition(_dh).clone(); };
  function looks(u) {
    return [[u < WALK.u0 ? band(18.55, 19.3, 30, 31, u) : 0, dogHead]];
  }

  // ---------------------------------------------------------------- what his hands do (the hero's state)
  const _pt = V3();
  function hero(u, time, hs) {
    const cr = PET.crouch(u);
    if (cr > 0) hs.crouch = Math.max(hs.crouch || 0, cr);
    const t = inWalk(u) ? wt(u) : -1e9;
    const pt = Math.max(PET.pat(u), GATE.pat(t));
    if (pt > 0) {
      // his palm on its head, behind the ears, scratching
      const h = dogHead(), sc = 0.018;
      hs.pat = pt;
      hs.patTarget = _pt.copy(h).add(V3(Math.sin(time * 6.2) * sc, 0.075 + Math.abs(Math.sin(time * 3.1)) * 0.012, Math.cos(time * 6.2) * sc * 0.6)).clone();
    }
    // the laundry: a hand raised to her as she waves to him from her line
    hs.wave = Math.max(hs.wave || 0, 0.8 * tband(3.9, 4.45, 5.4, 6.1, t));
    // the bun: up to her hand for it; down to the dog with it, bowing to it
    const tk = BUN.take(t), gv = BUN.give(t);
    if (tk > 0 && world.cast.seller.root.visible) { hs.reach = Math.max(hs.reach || 0, tk); hs.reachTarget = life().handR(world.cast.seller); }
    else if (gv > 0) { hs.reach = Math.max(hs.reach || 0, gv); hs.reachTarget = DOG_BEG_HEAD.clone().add(V3(0, 0.05, 0)); }
    const bw = BUN.bow(t);
    if (bw > 0) hs.lean = Math.max(hs.lean || 0, 0.55 * bw);
    return hs;
  }
  // kneeling to the dog at the gate (with the house's own kneel: the engine takes the larger)
  const kneel = u => (inWalk(u) ? GATE.kneel(wt(u)) : 0);

  // ---------------------------------------------------------------- his uncle's hand
  const _m = V3();
  function elder(u, es, e, boyHead) {
    const nr = MEASURE.near(u), arm = MEASURE.arm(u);
    // (a step closer: his group's place, and the basket's handle with him)
    e.group.position.copy(UNCLE_AT).add(V3(-0.14 * nr, 0, 0));
    if (es.holdTarget) es.holdTarget.x -= 0.14 * nr;
    es.lean = 0.8 * nr;
    if (arm > 0 && boyHead) {
      // on the crown of the boy's head; drawn back level over his own (the boy is the taller now): the palm stays at
      // the height of the boy's crown
      const crownB = boyHead.clone().add(V3(0, 0.125, 0)), own = e.anchors.head();
      const over = V3(own.x + 0.02, crownB.y + 0.012, own.z);
      _m.copy(crownB).lerp(over, MEASURE.slide(u));
      _m.y += 0.012 * Math.abs(Math.sin(u * 140)) * band(11.8, 11.9, 12.25, 12.35, u);
      es.pat = arm; es.patTarget = _m.clone();
      // (his eyes go a little way with his hand as it leaves the boy's crown, and are back on the boy before it is over
      // his own head: nobody looks at a point straight over his own head)
      const fl = MEASURE.follow(u);
      if (es.lookAt && fl > 0) es.lookAt = es.lookAt.clone().lerp(_m.clone(), fl * 0.45);
    }
    es.laugh = MEASURE.laugh(u);
    es.speak = Math.max(es.speak || 0, MEASURE.speak(u) * 0.6);
    return es;
  }

  // ---------------------------------------------------------------- Huang
  // (its gait from the ground it covers: a trot ~0.5 m a stride, a gallop ~0.9)
  const TROT_K = 1.9, GAL_K = 0.74;
  let odo = 0, lastP = null, lastU = -1;
  const st = { p: V3(), yaw: 0, a: null, b: null, k: 0, look: null, lookK: 0, on: false, moving: 0 };
  // him on the walk at walk time t: his feet, the way he goes, his left
  const himAt = t => { const w = walkAt(t), p = V3(w.x, 0, w.z), d = V3(w.dx, 0, w.dz); return { p, d, l: V3(d.z, 0, -d.x) }; };
  // at his left heel as he walks (a little behind his stride)
  const heel = t => { const h = himAt(t); return h.p.clone().addScaledVector(h.l, 0.58).addScaledVector(h.d, -0.12); };
  const kids = world.cast.kids;
  const loopAt = (time, lag) => {
    const L = kids[0].loop, a = time * L.sp + (L.off || 0) - lag, rx = L.r, rz = L.r * 0.7;
    return { p: V3(L.c.x + Math.cos(a) * rx, 0, L.c.z + Math.sin(a) * rz), yaw: Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz) };
  };
  const along3 = (a, b, c, t) => { const ab = a.clone().lerp(b, t), bc = b.clone().lerp(c, t); return ab.lerp(bc, t); };
  // (and the way along it, for its heading)
  const along3d = (a, b, c, t) => { const d = b.clone().sub(a).multiplyScalar(2 * (1 - t)).addScaledVector(c.clone().sub(b), 2 * t); return d.lengthSq() > 1e-8 ? yawOf(d) : null; };
  const toward = (from, to) => yawOf(to.clone().sub(from));
  function morning(u, time) {
    const K = anchors(), s = st;
    s.on = true; s.b = null; s.k = 0; s.look = null; s.lookK = 0; s.moving = 0;
    const t = u >= WALK.u0 ? wt(u) : -1;
    const himHead = () => valleyP(u).add(V3(0, PET.crouch(u) > 0.5 || GATE.kneel(t) > 0.5 ? 1.0 : 1.55, 0));
    if (u < 19.6) {
      // dozing, head down on its paws; the head up as he comes down the steps; up on its feet, the tail going
      s.p.copy(DOG_BED);
      s.yaw = turnYaw(DOG_BED_YAW, toward(DOG_BED, valleyP(u)), smooth(18.9, 19.4, u) * 0.6);
      s.a = ['lie', time, 1 - smooth(18.45, 18.85, u)];
      s.b = ['wag', time]; s.k = smooth(19.0, 19.32, u);
      s.look = himHead(); s.lookK = smooth(18.5, 18.9, u);
    } else if (u < 20.05) {
      // to him, trotting, round in front of him
      const k = smooth(19.6, 20.05, u);
      const mid = DOG_BED.clone().lerp(K.DOG_PET, 0.55).add(V3(0.15, 0, -0.55));
      s.p.copy(along3(DOG_BED, mid, K.DOG_PET, k));
      s.yaw = turnYaw(toward(DOG_BED, mid), K.DOG_PET_YAW, smooth(19.8, 20.05, u));
      s.a = ['trot', 0]; s.moving = 1;
      s.look = himHead(); s.lookK = 0.5;
    } else if (u < WALK.u0) {
      // before him: the tail going; sits to be scratched, its head up into his hand; up again as he stands
      s.p.copy(K.DOG_PET); s.yaw = K.DOG_PET_YAW;
      const sit = band(20.35, 20.6, 21.4, 21.6, u);
      s.a = ['wag', time]; s.b = ['sit', time, 0.8]; s.k = sit;
      s.look = himHead(); s.lookK = 0.9;
    } else if (t < 3.0) {
      // round, and off up the street after the children, and into their game with them
      const k = smooth(0.15, 3.0, t), L = loopAt(time, 0.95);
      const mid = K.DOG_PET.clone().add(V3(-0.7, 0, -7.5));
      s.p.copy(along3(K.DOG_PET, mid, L.p, k));
      const d = along3d(K.DOG_PET, mid, L.p, k);
      s.yaw = turnYaw(K.DOG_PET_YAW, d ?? K.DOG_PET_YAW, smooth(0.0, 0.5, t));
      s.a = [t < 0.45 ? 'trot' : 'gallop', 0]; s.moving = 1;
    } else if (t < BEAT.smithOff + 1.0) {
      // round and round with them
      const L = loopAt(time, 0.95);
      s.p.copy(L.p); s.yaw = L.yaw; s.a = ['gallop', 0]; s.moving = 1;
    } else if (t < BEAT.smithOff + 4.6) {
      // back to him as he goes on past the smith's, bounding up from behind on his left, and in at his heel
      const t0 = BEAT.smithOff + 1.0, k = smooth(t0, BEAT.smithOff + 4.6, t), L = loopAt(time, 0.95);
      const h = himAt(t), mid = h.p.clone().addScaledVector(h.l, 1.3).addScaledVector(h.d, -2.2);
      s.p.copy(along3(L.p, mid, heel(t), k));
      const d = along3d(L.p, mid, heel(t), k);
      s.yaw = turnYaw(L.yaw, d ?? yawOf(h.d), smooth(t0, t0 + 0.6, t));
      s.a = [k < 0.8 ? 'gallop' : 'trot', 0]; s.moving = 1;
      s.look = himHead(); s.lookK = 0.5 * smooth(0.6, 0.9, k);
    } else if (t < M - 1.7) {
      // at his heel up the street, looking up at him now and then
      const h = himAt(t);
      s.p.copy(heel(t)); s.yaw = yawOf(h.d); s.a = ['trot', 0]; s.moving = 1;
      s.look = himHead(); s.lookK = 0.45 * tband(BEAT.smithOff + 9, BEAT.smithOff + 9.6, BEAT.smithOff + 11, BEAT.smithOff + 11.8, t);
    } else if (t < MO + 0.6) {
      if (t < M - 0.1) {
        // round in front of him as he turns to her terrace, and sat at his feet, begging
        const k = smooth(M - 1.7, M - 0.1, t), h0 = heel(M - 1.7);
        const mid = DOG_BEG.clone().add(V3(0.35, 0, 0.6));
        s.p.copy(along3(h0, mid, DOG_BEG, k));
        s.yaw = turnYaw(yawOf(himAt(M - 1.7).d), DOG_BEG_YAW, smooth(M - 0.9, M - 0.1, t));
        s.a = ['trot', 0]; s.moving = 1;
        s.look = himHead(); s.lookK = 0.5;
      } else {
        // (sat, begging, its eyes on the bun; up on its feet as it comes down to it; the bun gone; sat again, licking its
        // chops, its eyes on him)
        s.p.copy(DOG_BEG); s.yaw = DOG_BEG_YAW;
        s.a = ['wag', time]; s.b = ['sit', time, 0.5]; s.k = tband(M - 0.25, M + 0.15, M + 2.75, M + 2.95, t) + 0.8 * tband(M + 4.0, M + 4.4, MO + 0.1, MO + 0.5, t);
        s.look = bunAt(u) || himHead(); s.lookK = 0.9;
      }
    } else if (t < MO + 2.4) {
      // up and after him as he goes on
      const k = smooth(MO + 0.6, MO + 2.4, t), h = himAt(t);
      const mid = DOG_BEG.clone().lerp(heel(t), 0.5).addScaledVector(h.l, 0.4);
      s.p.copy(along3(DOG_BEG, mid, heel(t), k));
      const d = along3d(DOG_BEG, mid, heel(t), k);
      s.yaw = turnYaw(DOG_BEG_YAW, d ?? yawOf(h.d), smooth(MO + 0.6, MO + 1.1, t));
      s.a = ['trot', 0]; s.moving = 1; s.look = himHead(); s.lookK = 0.35;
    } else if (t < G0 - 4.4) {
      const h = himAt(t);
      s.p.copy(heel(t)); s.yaw = yawOf(h.d); s.a = ['trot', 0]; s.moving = 1;
      s.look = himHead(); s.lookK = 0.45 * tband(MO + 3.0, MO + 3.6, MO + 4.6, MO + 5.4, t);
    } else if (t < G0 - 1.5) {
      // on ahead of him, out on his left, round in front of him and turned to face him, and down in his way
      const k = smooth(G0 - 4.4, G0 - 1.5, t), h0 = heel(G0 - 4.4);
      const mid = K.DOG_GATE.clone().add(V3(-0.75, 0, -1.6));
      s.p.copy(along3(h0, mid, K.DOG_GATE, k));
      const d = along3d(h0, mid, K.DOG_GATE, k);
      s.yaw = turnYaw(d ?? 0, 0, smooth(G0 - 2.4, G0 - 1.5, t));
      s.a = ['trot', 0]; s.moving = 1;
      s.look = himHead(); s.lookK = smooth(G0 - 2.6, G0 - 1.6, t) * 0.8;
    } else {
      // sat in his way, looking up at him; home, where he means; at him again. Turned round on its haunches as he steps
      // past it, watching him go; half up once to follow, and down again
      s.p.copy(K.DOG_GATE);
      s.yaw = lerp(0, -Math.PI, smooth(G1 + 0.25, G1 + 1.5, t));
      const halfUp = tband(G1 + 2.6, G1 + 2.9, G1 + 3.1, G1 + 3.6, t) * 0.6;
      s.a = ['wag', time]; s.b = ['sit', time, 0.35 + 0.4 * tband(G0, G0 + 0.4, G1 - 1.6, G1 - 0.6, t)]; s.k = smooth(G0 - 1.7, G0 - 1.15, t) * (1 - halfUp);
      const home = K.DOG_GATE.clone().add(V3(0, 1.2, 30));
      s.look = t < G1 + 0.25 ? himHead().lerp(home, tband(G0 + 2.2, G0 + 2.5, G0 + 2.8, G0 + 3.1, t)) : valleyP(u).add(V3(0, 1.4, 0));
      s.lookK = 0.9;
    }
    return s;
  }
  // the night: lying by the old man, between him and the door, its nose to the door. Its head comes up at the boy in
  // the doorway, and its tail thumps the boards; it follows him in to his knees; down on its paws while the old man
  // speaks, its eyes on him; up as the hand falls; after the light as it rises out of him; down
  function night(u, time, N) {
    const s = st;
    // (there since it went home that morning: on before the house is in sight, so it is never seen to appear)
    s.on = u > 61.6 && u < 99.6; s.b = null; s.k = 0; s.moving = 0; s.tail = 0;
    if (!s.on) return s;
    s.p.copy(N.p); s.yaw = N.yaw;
    const up = Math.max(band(81.15, 81.55, 83.3, 83.9, u), band(91.45, 91.75, 92.4, 93.2, u) * 0.85, band(92.6, 93.2, 95.6, 96.6, u) * 0.7);
    s.a = ['lie', time, 1 - up];
    // (whom it looks at: the boy in the door and coming in; the old man; the light leaving him)
    const boy = N.boy(), old = N.old(), soul = N.soul();
    const toBoy = band(81.15, 81.5, 83.5, 84.2, u), toSoul = band(92.6, 93.0, 96.6, 97.4, u);
    s.look = old.clone().lerp(boy, toBoy).lerp(soul, toSoul); s.lookK = 0.85;
    // (a thump of the tail on the boards, and another)
    s.tail = -0.55 * (Math.exp(-Math.pow((u - 81.72) / 0.035, 2)) + 0.7 * Math.exp(-Math.pow((u - 81.9) / 0.035, 2)));
    return s;
  }
  function updateDog(u, time, inB, nightPlace) {
    st.tail = 0;
    const s = !inB && u < 36.9 ? morning(u, time) : !inB && nightPlace ? night(u, time, nightPlace) : (st.on = false, st);
    dog.root.visible = s.on;
    if (!s.on) { lastP = null; return; }
    s.p.y = groundY(s.p.x, s.p.z);
    // (the gait from the ground covered, a frame at a time; not across a jump)
    if (lastP && Math.abs(u - lastU) < 0.3) odo += Math.min(0.5, lastP.distanceTo(s.p));
    lastP = (lastP || V3()).copy(s.p); lastU = u;
    const gt = s.a[0] === 'gallop' ? odo * GAL_K : odo * TROT_K;
    const Aa = s.a[0] === 'trot' || s.a[0] === 'gallop' ? [s.a[0], gt] : s.a;
    dog.root.position.copy(s.p);
    dog.root.rotation.y = s.yaw;
    if (s.b && s.k > 0.001) poseWolfMix(dog, Aa, s.b, s.k); else poseWolf(dog, ...Aa);
    if (s.tail) dog.tail.rotation.x += s.tail;
    if (s.look && s.lookK > 0) lookWolf(dog, s.look, s.lookK);
  }

  // ---------------------------------------------------------------- the bun
  const bun = (() => {
    const g = new THREE.SphereGeometry(0.045, 12, 8);
    g.scale(1, 0.72, 1); g.translate(0, 0.012, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xf2ebdc, roughness: 0.85 }));
    m.castShadow = true; m.visible = false; m.name = 'bun';
    world.root.add(m);
    return m;
  })();
  let heroHandR = null;
  function bunAt(u) {
    if (!inWalk(u)) return null;
    const t = wt(u);
    if (t < BUN.out || t > BUN.eaten) return null;
    if (t < BUN.inSeller) return world.cast.seller.root.visible ? life().handR(world.cast.seller).add(V3(0.05, 0.03, 0)) : null;
    if (t < BUN.inBoy) return heroHandR ? heroHandR.clone().add(V3(0, 0.02, 0)) : null;
    // (in its jaws)
    dog.root.updateMatrixWorld(true);
    return dog.head.localToWorld(V3(0, -0.07, 0.31));
  }
  function updateBun(u, handR) {
    heroHandR = handR;
    const p = bunAt(u);
    bun.visible = !!p;
    if (p) bun.position.copy(p);
  }
  // Auntie Mei's face, at her terrace's edge (for his eyes and the lens)
  const sellerFace = () => (world.cast.seller.root.visible ? world.cast.seller.root.position.clone().add(V3(0, 1.45, 0)) : anchors().sellerFace.clone());

  // ---------------------------------------------------------------- the shots (that night)
  // [u, lens, look, fov] keys, a Catmull-Rom through them; each a take of its own, cut to and cut from
  let SHOTS = null;
  const shots = () => {
    if (SHOTS) return SHOTS;
    const K = anchors();
    const G = K.DOG_GATE;
    const list = [
      // that night, the morning's last look turned round: from the road outside, behind him as he runs at the burning
      // gate, and in its way, where the dog sat, a wolf, snarling at him; pushing in after him as he swerves round it and
      // on into the street (from behind: never his face as he runs at the lens)
      { a: 72.5, b: 73.28, keys: [
        [72.5, V3(G.x + 0.55, 1.5, -49.6), V3(G.x - 0.1, 0.95, G.z), 40], [72.9, V3(G.x + 0.52, 1.47, -47.8), V3(G.x - 0.2, 0.95, G.z + 0.6), 41],
        [73.28, V3(G.x + 0.45, 1.44, -45.4), V3(G.x - 0.6, 1.15, G.z + 6.5), 42]] },
    ];
    SHOTS = list.map(s => {
      const ks = s.keys, n = ks.length;
      const pos = new THREE.CatmullRomCurve3(ks.map(k => k[1]), false, 'centripetal'), look = new THREE.CatmullRomCurve3(ks.map(k => k[2]), false, 'centripetal');
      const t = track(ks.map((k, i) => [k[0], i / (n - 1)]), x => x), fov = track(ks.map(k => [k[0], k[3]]), x => x);
      return { a: s.a, b: s.b, pos, look, t, fov, n };
    });
    return SHOTS;
  };
  const out = { pos: V3(), look: V3(), fov: 40 };
  // the run home, cut on the bolts that come down beside the road, a different lens each time: high behind his right
  // shoulder, small on the road across the dark fields with the fire at its end; low behind his left heel, the road
  // pouring under the lens, the burning village standing over him; (the gate, from where the dog sat); through the gate
  // into the street, close at his left side, the terraces burning past (then the long lens down the street to the house)
  // (high behind him three and a half metres out, not six: six out, the lens went through the roadside pavilion, its
  // beams a flat grey card over half the frame as the shot opened)
  // (and on the bridge, over its balustrade; it sinks low behind his heel only as it comes off the end: low beside it,
  // the balustrade towered over the lens, a flat black slab over a quarter of the frame, wiped off its edge as the lens
  // passed the end post)
  // (and never into the bridge's steps behind him: sunk as it came off the end, where the deck falls steeply to the
  // road, the lens went in under the treads, a frame of black bars)
  const offBridge = (P, h) => { const B = A.bridge, lz = P.z - 2.6 * h.z; return B ? smooth(B.z + B.L + 0.2, B.z + B.L + 3.4, lz) : 1; };
  const overDeck = (pos, gap) => { const B = A.bridge; if (!B || !B.deckY) return pos; const lz = pos.z - B.z; if (Math.abs(lz) <= B.L && Math.abs(pos.x - B.x) < 2.6) pos.y = Math.max(pos.y, B.deckY(lz) + gap); return pos; };
  const RUN = [
    // (and farther back and higher, so he is small on the road, the fields round him: four metres back and five up, he
    // was much the size he is in the high lens over the bridge after the cut, the two a jump cut on the same heading)
    { a: 68.3, b: 70.4, at: (P, h, r, u, t) => ({ pos: P.clone().addScaledVector(r, 3.4).addScaledVector(h, lerp(-7.6, -7.0, t)).add(V3(0, lerp(7.6, 7.0, t), 0)), look: P.clone().addScaledVector(h, 9).add(V3(0, 0.4, 0)), fov: 46 }) },
    // (looking down the road a little while it is high, and farther back, so he is in the frame from the waist: looking
    // level from just over his head, only its crown was, at the foot of the frame)
    { a: 70.4, b: 72.5, at: (P, h, r, u, t, time) => { const ob = offBridge(P, h); return { pos: overDeck(P.clone().addScaledVector(r, lerp(-0.35, -0.85, ob)).addScaledVector(h, lerp(-2.6, -1.7, ob)).add(V3(Math.sin(time * 9.4) * 0.03, lerp(2.3, 0.42, ob) + Math.abs(Math.sin(time * 4.7)) * 0.04, 0)), 0.6), look: P.clone().addScaledVector(h, 14).add(V3(0, lerp(0.2, 1.6, ob), 0)), fov: 52 }; } },
    { a: 73.28, b: 75.0, at: (P, h, r, u, t, time) => ({ pos: P.clone().addScaledVector(r, -2.0).addScaledVector(h, -1.6).add(V3(Math.sin(time * 8.8) * 0.025, 1.05 + Math.abs(Math.sin(time * 4.4)) * 0.03, 0)), look: P.clone().addScaledVector(h, 3.0).addScaledVector(r, 1.2).add(V3(0, 1.3, 0)), fov: 48 }) },
  ];
  function shot(u, time = 0) {
    for (const s of shots()) {
      if (u < s.a || u >= s.b) continue;
      const t = clamp(s.t(u));
      s.pos.getPoint(t, out.pos); s.look.getPoint(t, out.look); out.fov = s.fov(u);
      return out;
    }
    for (const s of RUN) {
      if (u < s.a || u >= s.b) continue;
      const P = valleyP(u), h = valleyHeading(u, P).clone(), r = V3(-h.z, 0, h.x);
      const o = s.at(P, h, r, u, (u - s.a) / (s.b - s.a), time);
      out.pos.copy(o.pos); out.look.copy(o.look); out.fov = o.fov;
      return out;
    }
    return null;
  }

  return { UNCLE_AT, BOY_AT, anchors, feet, heading, looks, hero, kneel, elder, updateDog, updateBun, shot, dog, dogHead, sellerFace };
}
