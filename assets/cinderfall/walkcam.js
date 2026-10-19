// The camera of the walk out of the village: one unbroken take from his uncle's porch to the gate (16.6 -> the dip into
// the page past the gate). Over his shoulder on the porch while the old man points at the sun; round after him down the
// steps; down over his shoulder onto the dog's face as he crouches to it, and up with him as he stands; behind him up
// the street (to his right while the laundry and the children are on his left), crossing behind him to his left before
// the smith's stall is on his right; over his shoulder on the wares, held while the world drains to ink and only the
// blades burn, closing in on the sword on its stand, and back as the colour comes back; crossing again to his right
// before Auntie Mei calls him over on the left; behind his shoulder on her and the bun; drawing back and up as he goes on
// toward the gate and the garrison's last men going out under it; in over his shoulder as he kneels to the dog in his
// way; down low behind the dog as he gets up, goes round it and out under the gate, and it watches him go.
//
// Keys on Watch's clock (seconds since 16.6): world points, or points set off him where he is at that moment (behind
// him along the way he goes, to his right, up); a centripetal spline through them, so the lens never stops dead or
// turns on a point between them.
import * as THREE from 'three';
import { watchT } from './score.js';
import { curveMono, clamp, lerp } from './util.js';
import { WALK, BEAT, walkAt, wt } from './walk.js';

export const ONER = { u0: 16.6, u1: WALK.u1 };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function createWalkCam({ groundY, anchors }) {
  let S = null;
  const T0 = () => watchT(ONER.u0);
  // him at walk time t: his feet, the way he goes (the path's direction, smoothed over a second either side), his right
  const him = t => {
    const w = walkAt(t), p = V3(w.x, 0, w.z);
    p.y = groundY(p.x, p.z);
    const a = walkAt(t - 1), b = walkAt(t + 1);
    let d = V3(b.x - a.x, 0, b.z - a.z);
    if (d.lengthSq() < 1e-4) { const w2 = walkAt(t); d = V3(w2.dx, 0, w2.dz); }
    d.normalize();
    return { p, d, r: V3(-d.z, 0, d.x) };
  };
  function build() {
    const K = anchors();
    const keys = [];
    // (u keys before the walk: Watch time from 16.6)
    const U = (u, pos, look, fov) => keys.push({ t: watchT(u) - T0(), pos, look, fov });
    const tw = t => t + (watchT(WALK.u0) - T0());
    const R = (t, back, side, up) => { const h = him(t); return h.p.clone().addScaledVector(h.d, -back).addScaledVector(h.r, side).add(V3(0, up, 0)); };
    const LA = (t, ahead, lat, y) => { const h = him(t); return h.p.clone().addScaledVector(h.d, ahead).addScaledVector(h.r, lat).add(V3(0, y, 0)); };
    const W = (t, pos, look, fov) => keys.push({ t: tw(t), pos, look, fov });
    // ---- the porch and the steps (the morning's last shot as it was), the dog
    U(16.6, V3(4.15, 2.92, 45.15), V3(6.35, 2.65, 44.0), 36);
    U(18.15, V3(4.25, 2.9, 45.1), V3(6.3, 2.68, 44.0), 35);
    U(18.8, V3(3.4, 2.8, 46.3), V3(4.6, 1.8, 43.2), 42);
    U(19.6, V3(2.4, 2.75, 45.6), V3(1.2, 1.4, 38.5), 44);
    U(20.25, V3(2.15, 2.3, 44.4), V3(0.75, 0.7, 40.7), 40);
    // (down over his right shoulder onto the dog sat before him, its face turned up into his hand)
    const dh = K.DOG_PET.clone().add(V3(0, 0.42, 0)), pb = K.PET_BOY;
    U(20.8, pb.clone().add(V3(1.35, 1.95, 1.0)), dh.clone().add(V3(-0.02, 0.0, 0.18)), 37);
    U(21.5, pb.clone().add(V3(1.28, 1.87, 0.92)), dh.clone().add(V3(-0.02, 0.01, 0.16)), 35);
    // (up with him as he stands, on him as he rises; then, as he walks, on to the street ahead: tilted from the dog to the
    // street in half a second as he stood, it read as a cut)
    U(21.7, pb.clone().add(V3(1.33, 1.93, 1.4)), pb.clone().add(V3(0.02, 1.05, -0.32)), 36);
    W(0.0, pb.clone().add(V3(1.4, 2.0, 2.2)), LA(0.2, 1.6, -0.05, 1.4), 38);
    W(1.0, R(1.0, 2.35, 0.5, 1.82), LA(1.0, 4.5, -0.15, 1.15), 38);
    // ---- up the street: behind his right shoulder, the laundry and the children on his left
    W(1.8, R(1.8, 2.5, 0.55, 1.8), LA(1.8, 7.5, -0.25, 1.0), 38);
    W(4.2, R(4.2, 2.9, 0.62, 1.82), LA(4.2, 8, -0.5, 1.05), 38);
    W(7.2, R(7.2, 3.3, 0.62, 1.85), LA(7.2, 8, -0.6, 1.0), 38);
    W(10.0, R(10.0, 3.4, 0.42, 1.88), LA(10.0, 8, -0.3, 1.05), 37);
    // (across behind him to his left: the stall will be on his right)
    W(12.6, R(12.6, 3.1, -0.05, 1.85), LA(12.6, 7.5, 0.1, 1.1), 37);
    W(14.9, R(14.9, 2.5, -0.55, 1.8), LA(14.9, 7, 0.45, 1.2), 36);
    // ---- the smith's stall: over his right shoulder as he turns to it and stops
    const stop = him(BEAT.smith), sp = stop.p, toL = K.legend.clone().sub(sp).setY(0).normalize(), rL = V3(-toL.z, 0, toL.x);
    const OS = (back, side, up) => sp.clone().addScaledVector(toL, -back).addScaledVector(rL, side).add(V3(0, up, 0));
    const wares = K.legend.clone().lerp(K.stallWall, 0.32).add(V3(0, -0.05, 0));
    const t0 = BEAT.smith;
    W(t0 - 1.5, R(t0 - 1.5, 1.75, -0.7, 1.72), LA(t0 - 1.5, 5, 0.9, 1.35).lerp(wares, 0.55), 35);
    W(t0, OS(1.02, 0.56, 1.6), wares, 34);
    W(t0 + 1.6, OS(0.94, 0.53, 1.58), wares, 33.5);
    // (the world drains to ink, the blades burn: held)
    W(t0 + 3.2, OS(0.88, 0.5, 1.57), wares.clone().lerp(K.legend, 0.25), 32.5);
    // (in on the one that burns brightest, past his shoulder: the lens comes up beside his head and narrows on it)
    W(t0 + 4.6, OS(0.62, 0.48, 1.56), K.legend.clone().add(V3(0, 0.02, 0)), 24);
    W(t0 + 5.7, OS(0.3, 0.46, 1.555), K.legend.clone().add(V3(0, 0.015, 0)), 14);
    W(t0 + 6.6, OS(0.26, 0.46, 1.555), K.legend.clone().add(V3(0, 0.015, -0.01)), 13);
    // (back as the colour comes back into the world)
    W(t0 + 7.5, OS(0.86, 0.54, 1.6), wares, 30);
    // ---- on up the street: behind his left shoulder, crossing behind him to his right before the terrace
    const t1 = BEAT.smithOff;
    W(t1 + 0.4, OS(1.15, 0.38, 1.66), LA(t1 + 0.4, 5.5, 0, 1.3), 34);
    W(t1 + 2.2, R(t1 + 2.2, 2.7, -0.55, 1.75), LA(t1 + 2.2, 7, 0.3, 0.85), 38);
    W(t1 + 4.8, R(t1 + 4.8, 3.5, -0.45, 1.8), LA(t1 + 4.8, 7, 0.2, 0.8), 38);
    W(t1 + 7.6, R(t1 + 7.6, 3.6, 0.05, 1.82), LA(t1 + 7.6, 7.5, -0.1, 0.85), 38);
    W(t1 + 10.3, R(t1 + 10.3, 3.3, 0.5, 1.8), LA(t1 + 10.3, 7.5, -0.4, 0.95), 38);
    // ---- Auntie Mei: she calls him over; behind his left shoulder on her, the bun, the dog at his feet
    const t2 = BEAT.mei, B = K.BUN_BOY, her = K.sellerFace;
    W(t2 - 3.8, R(t2 - 3.8, 2.6, 0.62, 1.8), LA(t2 - 3.8, 7, -0.6, 1.2).lerp(her, 0.35), 38);
    W(t2 - 1.7, R(t2 - 1.7, 2.2, 0.75, 1.78), LA(t2 - 1.7, 5, -0.8, 1.3).lerp(her, 0.7), 39);
    W(t2, B.clone().add(V3(1.9, 1.7, 1.45)), V3(-3.7, 1.3, -7.75), 40);
    W(t2 + 2.5, B.clone().add(V3(1.86, 1.62, 1.4)), V3(-3.45, 0.95, -7.7), 40);
    W(t2 + 4.7, B.clone().add(V3(1.9, 1.68, 1.45)), V3(-3.7, 1.28, -7.8), 40);
    // ---- on to the gate: drawing back and up, the gate ahead and the garrison's last men going out under it
    const t3 = BEAT.meiOff;
    W(t3, B.clone().add(V3(1.98, 1.72, 1.6)), V3(-2.4, 1.25, -12.5), 39);
    W(t3 + 2.2, R(t3 + 2.2, 2.9, 0.55, 1.8), LA(t3 + 2.2, 7.5, -0.2, 0.85), 38);
    W(t3 + 5.6, R(t3 + 5.6, 3.9, 0.65, 2.05), LA(t3 + 5.6, 11, -0.2, 0.9), 35);
    W(t3 + 10.2, R(t3 + 10.2, 4.3, 0.6, 2.2), LA(t3 + 10.2, 13, -0.1, 0.95), 33);
    // ---- the dog in his way: in over his right shoulder as he kneels to it, the gate beyond
    const t4 = BEAT.gate, St = K.STOP, G = K.DOG_GATE;
    W(t4 - 4.6, R(t4 - 4.6, 3.9, 0.7, 2.15), LA(t4 - 4.6, 6, -0.3, 0.55), 36);
    W(t4 - 1.8, R(t4 - 1.8, 2.9, 0.95, 1.95), LA(t4 - 1.8, 3, 0, 0.5).lerp(G.clone().add(V3(0, 0.4, 0)), 0.6), 35);
    W(t4, St.clone().add(V3(1.2, 1.68, 1.35)), G.clone().add(V3(-0.05, 0.42, 0)), 34);
    W(t4 + 3.2, St.clone().add(V3(1.05, 1.58, 1.15)), G.clone().add(V3(-0.04, 0.45, 0)), 32);
    // ---- drawn back as he gets up, then down low behind the dog, off its right flank, as he goes round it; it watches him
    // go out under the gate (from straight behind it, low and close, it was a tube of fur; and the lens going down where
    // he had knelt as he stood up had him filling the side of the frame)
    // (looking a little left of the gate, the way he goes round the dog: on the gate itself he went out at the frame's
    // edge)
    const t5 = BEAT.gateOff, far = V3(G.x - 1.1, 1.15, G.z - 7);
    W(t5, St.clone().add(V3(1.4, 1.55, 2.3)), G.clone().add(V3(0, 0.5, 0)).lerp(far, 0.45), 36);
    W(t5 + 1.6, G.clone().add(V3(0.95, 0.66, 1.55)), far, 38);
    W(BEAT.end, G.clone().add(V3(0.85, 0.6, 1.3)), V3(G.x - 1.0, 1.2, G.z - 7), 35);
    keys.sort((a, b) => a.t - b.t);
    const n = keys.length;
    const pos = new THREE.CatmullRomCurve3(keys.map(k => k.pos), false, 'centripetal');
    const look = new THREE.CatmullRomCurve3(keys.map(k => k.look), false, 'centripetal');
    const kt = curveMono(keys.map((k, i) => [k.t, i / (n - 1)]));
    const fov = curveMono(keys.map(k => [k.t, k.fov]));
    return { keys, pos, look, kt, fov };
  }
  const out = { pos: V3(), look: V3(), fov: 38 };
  return {
    on: u => u >= ONER.u0 && u < ONER.u1,
    at(u) {
      if (!S) S = build();
      const t = watchT(u) - T0(), k = clamp(S.kt(t));
      S.pos.getPoint(k, out.pos); S.look.getPoint(k, out.look); out.fov = S.fov(t);
      return out;
    },
    keys: () => (S || (S = build())).keys,
  };
}
