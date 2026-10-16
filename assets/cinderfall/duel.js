// The duel above the clouds: two cultivators, gold and violet, trading blows at lightning speed.
//
// It runs on the clock in exchanges of DUEL_P seconds, in a phrase that keeps changing its rhythm:
//   dash    they streak at each other (all but instantly), meet in a blow, are thrown apart, circle for a breath
//   flurry  four blows in half a second, apart and together again between them, zigzagging
//   chase   the gold one breaks away in a corkscrew, the violet one on its heels, their trails twisting round each
//           other, until it is caught
//   lock    they meet and hold, grinding, the light pulsing out of the lock, until it bursts and throws them apart
//   knock   the gold one is smashed down into the cloud tops (a crater), and bursts back up out of it
// Everything is relative to a centre the story moves (in from far off, in front of the lens, torn away toward the
// horizon); `fl` is the height of the cloud tops relative to that centre.
import * as THREE from 'three';
import { rng } from './util.js';

export const DUEL_P = 1.15;         // seconds per exchange
const DASH = 0.12;                  // the dash ends in the blow
const RECOIL = 0.45;                // thrown apart until here, then they circle
const PHRASE = ['dash', 'flurry', 'dash', 'chase', 'lock', 'dash', 'knock', 'flurry', 'dash', 'chase', 'dash', 'lock', 'knock', 'flurry'];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// blow kinds: 0 a blow, 1 one of a flurry, 2 the blow that smashes the gold one down, 3 the gold one hitting the cloud,
// 4 a pulse out of the lock, 5 the lock bursting
export const BLOW = { hit: 0, flurry: 1, smash: 2, crater: 3, grind: 4, burst: 5 };

export function createDuel() {
  const cache = new Map();
  const ex = k => {
    let e = cache.get(k);
    if (e) return e;
    const q = rng(((k * 7919) ^ 0x5bd1) + 13);
    const type = PHRASE[((k % PHRASE.length) + PHRASE.length) % PHRASE.length];
    const M = V(q.range(-200, 200), q.range(-60, 90), q.range(-200, 200));
    const a = q() * Math.PI * 2, el = q.range(-0.35, 0.4);
    const dir = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    const r = q.range(170, 300);
    const side = q() < 0.5 ? -1 : 1, orbit = q.range(14, 26), spin = q() * Math.PI * 2;
    // the flurry's meetings, zigzagging away from the first
    const perp = V(-dir.z, 0.3, dir.x).normalize();
    const F = [M.clone()];
    for (let j = 1; j < 4; j++) F.push(F[j - 1].clone().addScaledVector(dir, q.range(-40, 40)).addScaledVector(perp, (j % 2 ? 1 : -1) * q.range(35, 70)).add(V(0, q.range(-25, 30), 0)));
    // the chase: a corkscrew from the meeting to where the gold one is caught
    const E = M.clone().add(V(q.range(-280, 280), q.range(-70, 120), q.range(-280, 280)));
    const ax = E.clone().sub(M), axL = ax.length();
    ax.divideScalar(axL);
    const h1 = V(-ax.z, 0, ax.x).normalize(), h2 = ax.clone().cross(h1).normalize();
    const helix = { R: q.range(55, 95), turns: q.range(1.4, 2.4), ph0: q() * Math.PI * 2, axL };
    // the knock: where on the cloud tops the gold one comes down (its height given at the time)
    const Gxz = V(M.x + q.range(-120, 120), 0, M.z + q.range(-120, 120));
    e = { k, type, M, A: M.clone().addScaledVector(dir, r), B: M.clone().addScaledVector(dir, -r), dir, side, orbit, spin, F, E, ax, h1, h2, helix, Gxz };
    cache.set(k, e);
    if (cache.size > 80) cache.delete(cache.keys().next().value);
    return e;
  };
  const bez = (a, b, c, t, out) => { const r = 1 - t; return out.copy(a).multiplyScalar(r * r).addScaledVector(b, 2 * r * t).addScaledVector(c, t * t); };
  const _c = V(0, 0, 0), _d = V(0, 0, 0), _g = V(0, 0, 0);
  const G = (E, fl) => _g.set(E.Gxz.x, fl, E.Gxz.z);
  const helixAt = (E, s, out) => {
    const H = E.helix, an = H.ph0 + s * H.turns * Math.PI * 2, rr = H.R * Math.sin(Math.PI * Math.min(1, s * 1.15));
    return out.copy(E.M).addScaledVector(E.ax, s * H.axL).addScaledVector(E.h1, Math.cos(an) * rr).addScaledVector(E.h2, Math.sin(an) * rr);
  };
  // thrown apart from a point to the next exchange's starts, then circling there
  function apart(E, N, from, x0, ph, o1, o2) {
    if (ph < RECOIL + (x0 - DASH)) {
      const x = (ph - x0) / (RECOIL - DASH), e = 1 - Math.pow(1 - Math.min(1, x), 3);
      _c.copy(from).lerp(N.A, 0.35).add(V(0, 70 * E.side, 0));
      bez(from, _c, N.A, e, o1);
      _d.copy(from).lerp(N.B, 0.35).add(V(0, -50 * E.side, 0));
      bez(from, _d, N.B, e, o2);
      return;
    }
    const x = Math.min(1, (ph - (RECOIL + x0 - DASH)) / Math.max(1e-3, 1 - (RECOIL + x0 - DASH)));
    const s = Math.sin(Math.PI * x), a = E.spin + x * 4.2;
    o1.copy(N.A).add(V(Math.cos(a) * E.orbit * s, Math.sin(a * 1.3) * E.orbit * 0.5 * s, Math.sin(a) * E.orbit * s));
    o2.copy(N.B).add(V(Math.cos(a + 2.2) * E.orbit * s, Math.sin(a * 0.9) * E.orbit * 0.6 * s, Math.sin(a + 2.2) * E.orbit * s));
  }
  // the two at time t (relative to the centre): o1 gold, o2 violet
  function at(t, o1, o2, fl = -800) {
    const k = Math.floor(t / DUEL_P), ph = t / DUEL_P - k;
    const E = ex(k), N = ex(k + 1);
    const approach = () => {
      const x = ph / DASH;
      o1.lerpVectors(E.A, E.M, Math.pow(x, 2.4));
      o2.lerpVectors(E.B, E.M, Math.pow(x, 2.1));
    };
    if (E.type === 'chase') {
      if (ph < 0.1) {
        // the gold one breaks for the corkscrew, the violet one after it
        const x = ph / 0.1;
        o1.lerpVectors(E.A, E.M, Math.pow(x, 1.6));
        helixAt(E, 0, _c);
        o2.lerpVectors(E.B, E.M, Math.pow(x, 1.6) * 0.75);
      } else if (ph < 0.7) {
        const s = (ph - 0.1) / 0.6, lag = 0.16 * (1 - s);
        helixAt(E, s, o1);
        if (s - lag < 0) o2.lerpVectors(E.B.clone().lerp(E.M, 0.75), E.M, Math.min(1, s / Math.max(lag, 1e-3)));
        else helixAt(E, s - lag, o2);
      } else apart(E, N, E.E, 0.7, ph, o1, o2);
      return { k, ph, type: E.type };
    }
    if (ph < DASH) { approach(); return { k, ph, type: E.type }; }
    if (E.type === 'flurry') {
      if (ph < DASH + 0.27) {
        // four meetings, apart and together between them
        const y = (ph - DASH) / 0.09, j = Math.min(2, Math.floor(y)), f = y - j;
        const P0 = E.F[j], P1 = E.F[j + 1];
        const sep = Math.sin(Math.PI * f) * 42;
        _d.subVectors(P1, P0).normalize();
        _c.set(-_d.z, 0.35, _d.x).normalize();
        o1.lerpVectors(P0, P1, f).addScaledVector(_c, sep);
        o2.lerpVectors(P0, P1, f).addScaledVector(_c, -sep);
      } else apart(E, N, E.F[3], DASH + 0.27, ph, o1, o2);
    } else if (E.type === 'lock') {
      if (ph < 0.62) {
        // locked, grinding: pressed together, trembling, the pair driven a little across the sky
        const x = (ph - DASH) / (0.62 - DASH), tr = Math.sin(t * 93) * 2.2 + Math.sin(t * 57) * 1.6;
        _c.copy(E.M).addScaledVector(E.dir, -26 * x);
        o1.copy(_c).addScaledVector(E.dir, 5 + tr).add(V(0, Math.sin(t * 71) * 2, 0));
        o2.copy(_c).addScaledVector(E.dir, -5 - tr).add(V(0, Math.cos(t * 67) * 2, 0));
      } else {
        _c.copy(E.M).addScaledVector(E.dir, -26);
        apart(E, N, _c, 0.62, ph, o1, o2);
      }
    } else if (E.type === 'knock') {
      if (ph < 0.42) {
        // smashed down into the cloud tops (the violet one follows it part of the way)
        const x = (ph - DASH) / (0.42 - DASH), g = G(E, fl);
        o1.lerpVectors(E.M, g, x * x);
        o2.lerpVectors(E.M, _c.copy(E.M).lerp(g, 0.3), 1 - Math.pow(1 - x, 2));
      } else if (ph < 0.55) {
        // buried in the crater; the violet one hangs over it
        o1.copy(G(E, fl)).add(V(0, -30, 0));
        o2.copy(E.M).lerp(G(E, fl), 0.3);
      } else {
        // bursting back up out of it
        const x = (ph - 0.55) / 0.45, e = 1 - Math.pow(1 - x, 2.2), g = G(E, fl).clone();
        _c.copy(g).lerp(N.A, 0.5).add(V(0, 160, 0));
        bez(g, _c, N.A, e, o1);
        _d.copy(E.M).lerp(g, 0.3);
        o2.lerpVectors(_d, N.B, 1 - Math.pow(1 - x, 3));
      }
    } else apart(E, N, E.M, DASH, ph, o1, o2);
    return { k, ph, type: E.type };
  }
  // the blows struck up to time t, newest first: [{ pos (relative), t (when), kind }]
  function blows(t, n = 3, fl = -800) {
    const out = [];
    const k0 = Math.floor(t / DUEL_P);
    for (let k = k0; k > k0 - 6 && out.length < n * 3; k--) {
      const E = ex(k), tk = (k + DASH) * DUEL_P, list = [];
      if (E.type === 'dash') list.push([E.M, tk, 0]);
      else if (E.type === 'flurry') for (let j = 0; j < 4; j++) list.push([E.F[j], tk + j * 0.09 * DUEL_P, 1]);
      else if (E.type === 'chase') list.push([E.E, (k + 0.7) * DUEL_P, 0]);
      else if (E.type === 'lock') {
        list.push([E.M, tk, 0]);
        for (let j = 1; j <= 4; j++) list.push([E.M.clone().addScaledVector(E.dir, -26 * (j * 0.11 / ((0.62 - DASH) * DUEL_P))), tk + j * 0.11, 4]);
        list.push([E.M.clone().addScaledVector(E.dir, -26), (k + 0.62) * DUEL_P, 5]);
      } else if (E.type === 'knock') { list.push([E.M, tk, 2]); list.push([G(E, fl).clone(), (k + 0.42) * DUEL_P, 3]); }
      for (const [pos, tb, kind] of list) if (tb <= t) out.push({ pos, t: tb, kind });
    }
    return out.sort((a, b) => b.t - a.t).slice(0, n);
  }
  return { at, blows, ex };
}
