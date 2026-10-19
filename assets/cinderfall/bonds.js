// The morning's bonds, and what comes of them.
//
// The morning he goes for the mushrooms is the village's last, so it is given its people. His uncle lays a palm on his
// head and draws it back level over his own ("Taller than me, now."). The street's dog, Huang, dozing in the sun at the
// foot of the steps, is up and to him, sits to be scratched behind the ears, then is off after the children. The bun
// the seller holds out to him over her terrace goes to the dog. At the gate the dog trots round in front of him and
// sits down in his way, wanting to come; he kneels to it ("Go home. Watch the old man for me."), steps round it and
// goes on alone, and it sits and watches him go.
// That night it is a wolf that stands where the dog sat, looking out through the gate; and in the house the dog is
// lying beside the old man.
//
// Everything here is a pure function of the story position u (the clock only breathes and wags), shared by the
// engine's figures and its camera. The shots are world-space keys round where the figures are put.
import * as THREE from 'three';
import { roadX } from './layout.js';
import { clamp, lerp, smooth, band, track } from './util.js';
import { poseWolf, poseWolfMix, lookWolf } from './wolf.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const yawOf = d => Math.atan2(d.x, d.z);
const dirOf = yaw => V3(Math.sin(yaw), 0, Math.cos(yaw));
// shortest way round from one yaw to another, by k
const turnYaw = (a, b, k) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * k; };

// ---------------------------------------------------------------- the timing (story u)
// his uncle's palm: up onto his head, a pat, drawn back level over his own, held there while he laughs, down
export const MEASURE = {
  near: u => band(11.25, 11.6, 13.55, 13.95, u),       // the two of them a step closer
  arm: u => band(11.4, 11.78, 13.42, 13.82, u),        // the uncle's left arm up
  slide: u => smooth(12.35, 12.95, u),                  // from the boy's crown back over his own
  look: u => band(12.88, 13.04, 13.2, 13.4, u),         // the old man's eyes up to his hand
  laugh: u => band(12.95, 13.1, 13.62, 13.92, u),
  speak: u => band(13.0, 13.08, 13.45, 13.56, u),
};
// the dog at the foot of the steps: he stops for it, crouches, scratches it behind the ears; up, and on
const PET = { stop: 20.3, crouch: u => band(20.2, 20.55, 21.55, 21.85, u), pat: u => band(20.5, 20.8, 21.3, 21.62, u) };
// the bun: across to the stall, the seller's bun taken, given to the dog; away
const BUN = {
  toward: track([[28.05, 0.62], [28.95, 1], [30.45, 1], [31.0, 0.45]]),
  take: u => band(28.98, 29.22, 29.3, 29.5, u),
  give: u => band(29.82, 30.02, 30.16, 30.34, u),
  bow: u => band(29.84, 30.04, 30.2, 30.42, u),
  inSeller: 29.26, inBoy: 30.14, eaten: 30.3,
};
// the gate: the dog round in front of him, sat in his way; he kneels to it; round it, and on
const GATE = { kneel: u => band(32.55, 32.95, 33.72, 34.04, u), pat: u => band(32.9, 33.15, 33.55, 33.85, u), out: 34.05 };
// where he stops short of the gate (a little right of the middle of the way: timeline.js mcZ holds him at its z), and
// where the dog sits in his way: that night the wolf stands there (village-life.js)
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
  const GATE_X = GATE_STOP.x;
  let K = null;
  const anchors = () => {
    if (K) return K;
    // (the dog at his right, a little ahead: over his right shoulder its face is seen, turned up to him)
    const PET_BOY = valleyP(21.0).setY(0);
    const DOG_PET = PET_BOY.clone().add(V3(0.42, 0, -0.62));
    const STOP = valleyP(33.2).setY(0);
    const DOG_GATE = DOG_GATE_AT();
    K = { PET_BOY, DOG_PET, STOP, DOG_GATE };
    return K;
  };

  // ---------------------------------------------------------------- his feet, his heading, where he looks
  // (applied to his place on the road: valleyP)
  function feet(u, P, mo) {
    // a step closer to his uncle while the old man measures him
    if (mo > 0.999) P.x += 0.16 * MEASURE.near(u);
    // down the steps on their noses, not a straight glide through the air
    if (mo > 0 && mo < 1 && P.x > STEP_BOT - 0.3 && Math.abs(P.z - UH.porchFront.z) < 1.4) P.y = PLAT * clamp((P.x - STEP_BOT) / (STEP_TOP - STEP_BOT));
    // across to the bun stall and back to the road
    if (u > 28.0 && u < 31.0) { const k = BUN.toward(u); P.x = lerp(P.x, BUN_BOY.x, k); P.z = lerp(P.z, BUN_BOY.z, k); }
    // at the gate: stopped a little right of the middle of the way; round the dog to the west of it, and on
    if (u >= 31.0 && u < 35.75) P.x += lerp(GATE_X, -0.2, smooth(33.95, 34.45, u)) + 0.22 * smooth(34.9, 35.6, u);
    // the night: round the wolf where the dog sat (it snarls at him as he goes by)
    if (u > 72.5 && u < 73.6) P.x -= 0.55 * band(72.55, 72.9, 73.25, 73.55, u);
    return P;
  }
  // (applied after the road's own heading: valleyHeading. turnTo: (h, toward, k))
  function heading(u, P, h, turnTo) {
    const K = anchors();
    // half round to the dog as it comes, crouched to it
    turnTo(h, K.DOG_PET.clone().sub(P).setY(0).normalize(), 0.45 * band(19.85, 20.2, 21.6, 21.9, u));
    // the way he walks: to the stall, away from it; round the dog at the gate
    const walk = Math.max(band(28.0, 28.01, 28.8, 29.0, u), band(30.45, 30.6, 31.0, 31.01, u), band(33.95, 34.1, 35.2, 35.6, u));
    if (walk > 0) { const d = valleyP(u + 0.04).sub(valleyP(u - 0.04)).setY(0); if (d.lengthSq() > 1e-8) turnTo(h, d.normalize(), walk); }
    // to her at the stall; a little round to the dog to give it the bun
    turnTo(h, V3(-1, 0, 0), band(28.8, 29.0, 30.42, 30.6, u));
    turnTo(h, DOG_BEG.clone().sub(P).setY(0).normalize(), 0.6 * band(29.72, 29.95, 30.3, 30.5, u));
    return h;
  }
  // [weight, () => target]: the dog as it comes and while he scratches it; the seller; the dog at the stall, at the gate
  const _dh = V3();
  const dogHead = () => { dog.root.updateMatrixWorld(true); return dog.head.getWorldPosition(_dh).clone(); };
  function looks(u) {
    return [
      [band(18.75, 19.2, 21.55, 21.9, u), dogHead],
      [band(28.3, 28.6, 29.55, 29.78, u), () => (world.cast.seller.root.visible ? world.cast.seller.root.position.clone().add(V3(0, 1.45, 0)) : BUN_BOY.clone().add(V3(-1.4, 1.9, 0)))],
      [band(29.72, 29.92, 30.3, 30.5, u), dogHead],
      [band(32.0, 32.25, 33.9, 34.08, u), dogHead],
    ];
  }

  // ---------------------------------------------------------------- what his hands do (the hero's state)
  const _pt = V3();
  function hero(u, time, hs) {
    const K = anchors();
    const cr = PET.crouch(u);
    if (cr > 0) hs.crouch = Math.max(hs.crouch || 0, cr);
    const pt = Math.max(PET.pat(u), GATE.pat(u));
    if (pt > 0) {
      // his palm on its head, behind the ears, scratching
      const h = dogHead(), sc = 0.018;
      hs.pat = pt;
      hs.patTarget = _pt.copy(h).add(V3(Math.sin(time * 6.2) * sc, 0.075 + Math.abs(Math.sin(time * 3.1)) * 0.012, Math.cos(time * 6.2) * sc * 0.6)).clone();
    }
    // the bun: up to her hand for it; down to the dog with it, bowing to it
    const tk = BUN.take(u), gv = BUN.give(u);
    if (tk > 0 && world.cast.seller.root.visible) { hs.reach = Math.max(hs.reach || 0, tk); hs.reachTarget = life().handR(world.cast.seller); }
    else if (gv > 0) { hs.reach = Math.max(hs.reach || 0, gv); hs.reachTarget = DOG_BEG_HEAD.clone().add(V3(0, 0.05, 0)); }
    const bw = BUN.bow(u);
    if (bw > 0) hs.lean = Math.max(hs.lean || 0, 0.55 * bw);
    return hs;
  }
  // kneeling to the dog at the gate (with the house's own kneel: the engine takes the larger)
  const kneel = u => GATE.kneel(u);

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
      // (his eyes go up to his hand over his head)
      if (es.lookAt) es.lookAt = es.lookAt.clone().lerp(_m.clone().add(V3(0, 0.05, 0)), MEASURE.look(u) * 0.85);
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
  // beside him: to his right (side), ahead (ahead), on the ground
  const beside = (u, side, ahead) => {
    const P = valleyP(u), h = valleyHeading(u, P), r = V3(-h.z, 0, h.x);
    return P.addScaledVector(r, side).addScaledVector(h, ahead).setY(0);
  };
  const kids = world.cast.kids;
  const loopAt = (time, lag) => {
    const L = kids[0].loop, a = time * L.sp + (L.off || 0) - lag, rx = L.r, rz = L.r * 0.7;
    return { p: V3(L.c.x + Math.cos(a) * rx, 0, L.c.z + Math.sin(a) * rz), yaw: Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz) };
  };
  const along3 = (a, b, c, t) => { const ab = a.clone().lerp(b, t), bc = b.clone().lerp(c, t); return ab.lerp(bc, t); };
  const toward = (from, to) => yawOf(to.clone().sub(from));
  function morning(u, time) {
    const K = anchors(), s = st;
    s.on = true; s.b = null; s.k = 0; s.look = null; s.lookK = 0; s.moving = 0;
    const himHead = () => valleyP(u).add(V3(0, PET.crouch(u) > 0.5 || GATE.kneel(u) > 0.5 ? 1.0 : 1.55, 0));
    if (u < 19.6) {
      // dozing, head down on its paws; the head up as he comes down the steps; up on its feet, the tail going
      s.p.copy(DOG_BED);
      s.yaw = turnYaw(DOG_BED_YAW, toward(DOG_BED, valleyP(u)), smooth(18.9, 19.4, u) * 0.6);
      s.a = ['lie', time, 1 - smooth(18.45, 18.85, u)];
      s.b = ['wag', time]; s.k = smooth(19.0, 19.32, u);
      s.look = himHead(); s.lookK = smooth(18.5, 18.9, u);
    } else if (u < 20.05) {
      // to him, trotting
      const t = smooth(19.6, 20.05, u);
      s.p.copy(along3(DOG_BED, DOG_BED.clone().lerp(K.DOG_PET, 0.5).add(V3(0.35, 0, -0.1)), K.DOG_PET, t));
      s.yaw = turnYaw(toward(DOG_BED, K.DOG_PET), toward(K.DOG_PET, K.PET_BOY), smooth(19.85, 20.05, u));
      s.a = ['trot', 0]; s.moving = 1;
      s.look = himHead(); s.lookK = 0.5;
    } else if (u < 21.85) {
      // at his feet: the tail going; sits to be scratched, its head up into his hand; up again as he stands
      s.p.copy(K.DOG_PET); s.yaw = toward(K.DOG_PET, K.PET_BOY);
      const sit = band(20.35, 20.6, 21.4, 21.6, u);
      s.a = ['wag', time]; s.b = ['sit', time, 0.8]; s.k = sit;
      s.look = himHead(); s.lookK = 0.9;
    } else if (u < 22.15) {
      // beside him as he walks on, looking up at him
      s.p.copy(K.DOG_PET.clone().lerp(beside(u, 0.55, 0.3), smooth(21.85, 22.05, u)));
      s.yaw = turnYaw(toward(K.DOG_PET, K.PET_BOY), yawOf(valleyHeading(u, valleyP(u))), smooth(21.85, 22.0, u));
      s.a = ['trot', 0]; s.moving = 1; s.look = himHead(); s.lookK = 0.6;
    } else if (u < 25.35 + 2.7) {
      // off ahead of him after the children, and round with them in their game
      const run = Math.max(0, u - 22.15);
      const lead = beside(u, 0.55 - 0.35 * smooth(22.15, 22.6, u), 0.3 + 4.4 * run);
      const L = loopAt(time, 0.95), k = smooth(22.95, 23.5, u);
      s.p.copy(lead.lerp(L.p, k));
      s.yaw = turnYaw(yawOf(valleyHeading(u, valleyP(u))), L.yaw, k);
      s.a = ['gallop', 0]; s.moving = 1;
    } else if (u < 31.0) {
      // at his heel to the stall; round in front of him and sat, begging; the bun; after him again
      const heel = beside(u, -0.5, 0.15);
      if (u < 28.7) { s.p.copy(heel); s.yaw = yawOf(valleyHeading(u, valleyP(u))); s.a = ['trot', 0]; s.moving = 1; }
      else if (u < 29.02) {
        const t = smooth(28.7, 29.02, u), h0 = beside(28.7, -0.5, 0.15);
        s.p.copy(along3(h0, DOG_BEG.clone().add(V3(0.3, 0, 0.35)), DOG_BEG, t));
        s.yaw = turnYaw(yawOf(valleyHeading(28.7, valleyP(28.7))), DOG_BEG_YAW, smooth(28.85, 29.02, u)); s.a = ['trot', 0]; s.moving = 1;
      } else if (u < 30.5) {
        s.p.copy(DOG_BEG); s.yaw = DOG_BEG_YAW;
        // (sat, begging, its eyes on the bun; up on its feet as it comes down to it; the bun gone)
        s.a = ['wag', time]; s.b = ['sit', time, 0.5]; s.k = band(28.98, 29.2, 29.92, 30.06, u);
        s.look = bunAt(u) || himHead(); s.lookK = 0.9;
      } else {
        const t = smooth(30.5, 31.0, u);
        s.p.copy(DOG_BEG.clone().lerp(beside(u, -0.45, -0.35), t)); s.yaw = turnYaw(DOG_BEG_YAW, yawOf(valleyHeading(u, valleyP(u))), smooth(30.5, 30.7, u));
        s.a = ['trot', 0]; s.moving = 1; s.look = himHead(); s.lookK = 0.4;
      }
    } else if (u < 32.05) {
      // to the gate at his side
      s.p.copy(beside(u, 0.5, 0.1)); s.yaw = yawOf(valleyHeading(u, valleyP(u))); s.a = ['trot', 0]; s.moving = 1;
    } else if (u < 32.5) {
      // round in front of him, and turned to face him
      const t = smooth(32.05, 32.5, u), h0 = beside(32.05, 0.5, 0.1);
      s.p.copy(along3(h0, K.DOG_GATE.clone().add(V3(0.3, 0, -0.55)), K.DOG_GATE, t));
      s.yaw = turnYaw(yawOf(valleyHeading(32.05, valleyP(32.05))), 0, smooth(32.25, 32.5, u)); s.a = ['trot', 0]; s.moving = 1;
      s.look = himHead(); s.lookK = smooth(32.3, 32.5, u);
    } else {
      // sat in his way, looking up at him; home, where he means; at him again. Turned round on its haunches as he steps
      // past it, watching him go; half up once to follow, and down again
      s.p.copy(K.DOG_GATE);
      s.yaw = lerp(0, -Math.PI, smooth(33.98, 34.5, u));
      const halfUp = band(34.82, 34.98, 35.08, 35.3, u) * 0.6;
      s.a = ['wag', time]; s.b = ['sit', time, 0.35 + 0.4 * band(32.6, 32.8, 33.6, 34.2, u)]; s.k = smooth(32.45, 32.65, u) * (1 - halfUp);
      const home = K.DOG_GATE.clone().add(V3(0, 1.2, 30));
      s.look = u < 33.98 ? himHead().lerp(home, band(33.25, 33.4, 33.52, 33.68, u)) : valleyP(u).add(V3(0, 1.4, 0));
      s.lookK = 0.9;
    }
    return s;
  }
  // the night: lying by the old man, between him and the door, its nose to the door. Its head comes up at the boy in
  // the doorway, and its tail thumps the boards; it follows him in to his knees; down on its paws while the old man
  // speaks, its eyes on him; up as the hand falls; after the light as it rises out of him; down
  function night(u, time, N) {
    const s = st;
    s.on = u > 80.4 && u < 99.6; s.b = null; s.k = 0; s.moving = 0; s.tail = 0;
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
    const A = s.a[0] === 'trot' || s.a[0] === 'gallop' ? [s.a[0], gt] : s.a;
    dog.root.position.copy(s.p);
    dog.root.rotation.y = s.yaw;
    if (s.b && s.k > 0.001) poseWolfMix(dog, A, s.b, s.k); else poseWolf(dog, ...A);
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
    if (u < 28.7 || u > BUN.eaten) return null;
    if (u < BUN.inSeller) return world.cast.seller.root.visible ? life().handR(world.cast.seller).add(V3(0.05, 0.03, 0)) : null;
    if (u < BUN.inBoy) return heroHandR ? heroHandR.clone().add(V3(0, 0.02, 0)) : null;
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

  // ---------------------------------------------------------------- the shots
  // [u, lens, look, fov] keys, a Catmull-Rom through them; each a take of its own, cut to and cut from
  let SHOTS = null;
  const shots = () => {
    if (SHOTS) return SHOTS;
    const K = anchors();
    const B = K.PET_BOY, D = K.DOG_PET, f = V3(0, 0, -1), r = V3(1, 0, 0);
    const at = (o, x, y, z) => o.clone().addScaledVector(r, x).addScaledVector(f, z).add(V3(0, y, 0));
    const dHead = D.clone().add(V3(0, 0.4, 0)).addScaledVector(D.clone().sub(B).setY(0).normalize(), -0.12);
    const G = K.DOG_GATE, S = K.STOP;
    const list = [
      // the dog: over his right shoulder as he crouches to it, down onto its face turned up into his hand; down behind
      // them as he stands, and the two of them away up the street, the dog off ahead
      { a: 20.25, b: 22.4, keys: [
        [20.25, at(B, 1.0, 1.4, -1.0), dHead.clone().add(V3(0, 0.05, 0)), 34], [21.55, at(B, 0.9, 1.32, -0.9), dHead.clone().add(V3(0, 0.07, 0)), 31],
        [21.95, at(B, 0.95, 0.98, -1.15), at(B, -0.05, 0.75, 2.6), 37], [22.4, at(B, 1.0, 1.1, -1.1), at(B, -0.2, 0.85, 8), 42]] },
      // the bun: in after him as he crosses to the stall, round behind his left shoulder: her face at the terrace's
      // edge, the bun held out, the dog sat at his feet looking up; he turns away from us, up the street
      { a: 28.05, b: 31.0, keys: [
        [28.05, V3(-0.36, 1.75, -4.95), V3(-3.7, 1.3, -7.6), 44],
        [29.0, BUN_BOY.clone().add(V3(2.3, 1.75, 1.7)), V3(-3.7, 1.3, -7.75), 42],
        [30.45, BUN_BOY.clone().add(V3(2.2, 1.72, 1.6)), V3(-3.65, 1.2, -7.7), 42],
        [31.0, BUN_BOY.clone().add(V3(2.3, 1.72, 1.75)), V3(-2.6, 1.2, -9.3), 43]] },
      // the gate: over his right shoulder as he kneels, down onto the dog's face turned up to him, the gate beyond it
      { a: 32.6, b: 34.05, keys: [
        [32.6, S.clone().add(V3(0.95, 1.6, 1.0)), G.clone().add(V3(0, 0.45, 0)), 33], [34.05, S.clone().add(V3(0.85, 1.52, 0.9)), G.clone().add(V3(0, 0.47, 0)), 30]] },
      // low behind the dog: he stands, steps round it and goes out under the gate; it sits and watches him go
      { a: 34.05, b: 35.75, keys: [
        [34.05, G.clone().add(V3(0.5, 0.6, 1.9)), V3(G.x - 0.2, 1.15, G.z - 7), 38], [35.75, G.clone().add(V3(0.42, 0.56, 1.5)), V3(G.x - 0.3, 1.2, G.z - 7), 35]] },
      // that night, the same lens: the wolf where the dog sat, and him coming in out of the dark through the burning gate
      { a: 72.5, b: 73.28, keys: [
        [72.5, G.clone().add(V3(0.8, 1.15, 2.9)), V3(G.x - 0.35, 1.0, G.z - 7), 37], [73.28, G.clone().add(V3(0.85, 1.1, 3.5)), V3(G.x - 0.45, 1.05, G.z - 6), 39]] },
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
  const RUN = [
    { a: 68.3, b: 70.4, at: (P, h, r, u, t) => ({ pos: P.clone().addScaledVector(r, 4.6).addScaledVector(h, lerp(-6.2, -5.4, t)).add(V3(0, lerp(4.4, 3.8, t), 0)), look: P.clone().addScaledVector(h, 7).add(V3(0, 0.6, 0)), fov: 46 }) },
    { a: 70.4, b: 72.5, at: (P, h, r, u, t, time) => ({ pos: P.clone().addScaledVector(r, -0.85).addScaledVector(h, -1.7).add(V3(Math.sin(time * 9.4) * 0.03, 0.42 + Math.abs(Math.sin(time * 4.7)) * 0.04, 0)), look: P.clone().addScaledVector(h, 14).add(V3(0, 1.6, 0)), fov: 52 }) },
    { a: 73.28, b: 75.0, at: (P, h, r, u, t, time) => ({ pos: P.clone().addScaledVector(r, -2.0).addScaledVector(h, -1.6).add(V3(Math.sin(time * 8.8) * 0.025, 1.05 + Math.abs(Math.sin(time * 4.4)) * 0.03, 0)), look: P.clone().addScaledVector(h, 4.5).addScaledVector(r, 0.7).add(V3(0, 1.3, 0)), fov: 48 }) },
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

  return { UNCLE_AT, BOY_AT, anchors, feet, heading, looks, hero, kneel, elder, updateDog, updateBun, shot, dog };
}
