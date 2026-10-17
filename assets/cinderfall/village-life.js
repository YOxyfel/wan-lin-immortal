// The village's people and the wolves, moving through it: on the ground they are standing on (street, terraces,
// steps), along paths that go around things, with their feet keeping pace with the ground they cover, and keyed to
// the story (scrubbing back and forth replays them; nobody loops or pops back to a start in view).
import * as THREE from 'three';
import { roadX, heightAt } from './layout.js';
import { mcZ } from './timeline.js';
import { pose } from './people3d.js';
import { poseWolf } from './wolf.js';
import { clamp, lerp, smooth, band } from './util.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// ground covered per unit of the pose clocks (people3d / beasts): one walk cycle ~1.4 m, a run ~3.2 m, a gallop ~4.5 m
const WALK_M = 1.2, RUN_M = 4.8, GALLOP_M = 6.8, PROWL_M = 0.66;

export function createVillageLife(world) {
  const A = world.anchors, H = A.houses, cast = world.cast, W = world.wolves;

  // ---------------------------------------------------------------- the walkable ground: terrain, terraces, steps
  const pads = Object.values(H).map(h => {
    const e = h.W.elements, f = h.frame, pd = f.pd ?? 1.7;
    const dp = f.d + pd + 1.3, zc = pd / 2 + 0.05;
    return { ox: e[12], oy: e[13], oz: e[14], ax: [e[0], e[2]], az: [e[8], e[10]], hw: (f.w + 1.3) / 2, z0: zc - dp / 2, z1: zc + dp / 2, plat: f.plat, n: Math.max(1, Math.ceil(f.plat / 0.19)), sx: h.def.stepX || 0 };
  });
  function groundY(x, z) {
    let y = heightAt(x, z);
    for (const p of pads) {
      const dx = x - p.ox, dz = z - p.oz;
      const lx = dx * p.ax[0] + dz * p.ax[1], lz = dx * p.az[0] + dz * p.az[1];
      if (lz < p.z0 || lz > p.z1 + 0.4 * p.n || Math.abs(lx) > p.hw) continue;
      if (lz <= p.z1) { y = Math.max(y, p.oy + p.plat + 0.03); continue; }
      if (Math.abs(lx - p.sx) > 1.25) continue;
      const i = Math.ceil((lz - p.z1) / 0.4), top = p.plat - (i * p.plat) / (p.n + 1e-4);
      if (top > 0.02) y = Math.max(y, p.oy + top);
    }
    return y;
  }

  // ---------------------------------------------------------------- paths (world x,z), walked at a fixed pace in u
  const local = (id, x, z) => { const v = V3(x, 0, z).applyMatrix4(H[id].W); return [v.x, v.z]; };
  const lane = (z, dx) => [roadX(z) + dx, z];
  function path(pts) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V3(x, 0, z)), false, 'centripetal', 0.5);
    const len = curve.getLength();
    return { curve, len };
  }
  // out of a house: from inside the door, across the porch, down the steps, into the street
  const fromDoor = id => {
    const f = H[id].frame, pd = f.pd ?? 1.7, n = Math.max(1, Math.ceil(f.plat / 0.19));
    return [local(id, 0, f.d / 2 - 0.4), local(id, 0, f.d / 2 + pd), local(id, 0, f.d / 2 + pd + 0.7 + 0.4 * n + 0.6)];
  };
  // a person or a wolf following a path keyed to u (m per unit of u); returns null when off its path
  const _p = V3(), _t = V3();
  function along(pa, u, u0, mPerU) {
    const s = (u - u0) * mPerU;
    if (s < 0 || s > pa.len) return null;
    const k = s / pa.len;
    pa.curve.getPointAt(k, _p); pa.curve.getTangentAt(k, _t);
    return { x: _p.x, z: _p.z, yaw: Math.atan2(_t.x, _t.z), s, k };
  }

  // ---------------------------------------------------------------- the night: who runs where
  // [house they come out of, then the way they run, start (u), pace (m per u)]. The street runs north (-z) to the
  // gate; he comes the other way. Lanes stay clear of the jars and bushes along the house fronts, the laundry
  // lines, the fallen and the woman crouched by the steps.
  const FLEE = [
    { from: 'west-i', way: [lane(-30, -2.0), lane(-40, -1.9), lane(-50, -2.4), lane(-62, -2.6)], u0: 71.4, v: 5.6 },
    { from: 'east-j', way: [lane(-36, 1.8), lane(-46, 1.6), lane(-56, 2.1), lane(-66, 2.4)], u0: 71.9, v: 5.8 },
    { from: 'buns', way: [lane(-14, -1.2), lane(-26, -1.0), lane(-38, -1.4), lane(-52, -1.6)], u0: 72.9, v: 5.6 },
    // chased across the street into the gap between the laundry house and the tea house (the wolf is behind her)
    { from: 'east-e', way: [lane(29.5, 1.0), lane(30.4, -3.5), [roadX(30.6) - 9, 30.7], [roadX(30.8) - 16, 30.8]], u0: 74.4, v: 6.0 },
    { from: 'smith', way: [lane(6, 2.2), lane(-6, 2.0), lane(-20, 2.3), lane(-36, 2.0)], u0: 74.25, v: 5.8 },
    { from: 'smith', way: [lane(7, 1.4), lane(-5, 1.3), lane(-19, 1.5), lane(-35, 1.4)], u0: 74.5, v: 4.6 },  // the child, behind her mother
    { from: 'tea', way: [lane(16, -2.2), lane(4, -2.0), lane(-10, -2.3), lane(-26, -2.0)], u0: 75.0, v: 5.6 },
  ].map(r => ({ ...r, path: path([...fromDoor(r.from), ...r.way]) }));

  // ---------------------------------------------------------------- the wolves
  // the big one runs the ridges of the west row toward him, leaping the gaps (and down the drop from the tea house),
  // then off the guard post's roof behind the houses
  const ridge = id => {
    const h = H[id], f = h.frame, tall = (h.def.floors || 1) > 1, w = f.w;
    const halfX = tall ? (w - 0.4 + 0.2) / 2 + 1.0 : h.def.style === 'guard' ? (w - 1.0) / 2 + 1.0 : (w + 0.2) / 2 + 0.95;
    const half = halfX * 0.92 - 0.75;           // clear of the curling ornaments at the ends
    const top = h.roofTop.y + (h.def.style === 'guard' ? 0.45 : 0.36);
    const e = h.W.elements, c = h.roofTop;
    const ax = V3(e[0], 0, e[2]).normalize();   // the ridge runs along the house's front (local x)
    return { a: c.clone().addScaledVector(ax, half).setY(top), b: c.clone().addScaledVector(ax, -half).setY(top) };
  };
  const ROOF_RUN = (() => {
    const segs = [];   // [p0, p1, kind: 'run'|'leap', apex]
    const order = ['tea', 'west-g', 'buns', 'west-i', 'guard'];
    let prev = null;
    for (const id of order) {
      let { a, b } = ridge(id);
      if (a.z < b.z) [a, b] = [b, a];            // run north (-z)
      if (id === 'tea') a = a.clone().lerp(b, 0.42);
      if (prev) segs.push({ p0: prev, p1: a, kind: 'leap', apex: Math.max(prev.y, a.y) + (a.distanceTo(prev) > 2.5 ? 1.35 : 0.7) });
      segs.push({ p0: a, p1: b, kind: 'run' });
      prev = b;
    }
    // off the guard post's roof, down behind the houses on the west side
    const off = prev.clone().add(V3(-9, 0, -3)); off.y = groundY(off.x, off.z);
    segs.push({ p0: prev, p1: off, kind: 'leap', apex: prev.y + 1.2 });
    let L = 0;
    for (const s of segs) { s.L0 = L; s.len = s.p0.distanceTo(s.p1); L += s.len; }
    return { segs, len: L };
  })();
  function roofAt(s) {
    const g = ROOF_RUN.segs.find(q => s <= q.L0 + q.len) || ROOF_RUN.segs[ROOF_RUN.segs.length - 1];
    const k = clamp((s - g.L0) / Math.max(g.len, 1e-3));
    const p = g.p0.clone().lerp(g.p1, k);
    // a leap: a parabola through both ends whose middle is at the apex
    if (g.kind === 'leap') p.y = lerp(g.p0.y, g.p1.y, k) + Math.max(0, g.apex - (g.p0.y + g.p1.y) / 2) * 4 * k * (1 - k);
    return { p, k, leap: g.kind === 'leap', dir: g.p1.clone().sub(g.p0).setY(0).normalize() };
  }
  // the one that chases her across the street: out of the gap beside his uncle's house, into the gap opposite
  const CHASE = path([[roadX(35.6) + 15, 35.8], [roadX(35.4) + 7, 35.4], lane(33.6, 1.5), lane(31.6, -3.0), [roadX(31.0) - 9, 30.9], [roadX(30.8) - 17, 30.8]]);
  // the one at the gate: prowls in from the guard post, then stands its ground, snarling at him
  const g = A.gate.center;
  const PROWL = path([[g.x + 2.4, g.z + 16], [g.x + 2.9, g.z + 11], [g.x + 3.2, g.z + 6.5]]);

  // ---------------------------------------------------------------- helpers
  const castFrustum = new THREE.Frustum(), castPM = new THREE.Matrix4(), castSph = new THREE.Sphere(V3(), 1.3);
  let camera = null;
  const seen = c => {
    castSph.center.copy(c.root.position); castSph.center.y += 0.9;
    return castSph.center.distanceToSquared(camera.position) < 150 * 150 && castFrustum.intersectsSphere(castSph);
  };
  const poseSeen = (c, kind, t, amt) => { if (seen(c)) pose(c, kind, t, amt); };
  const stand = (c, x, z, yaw) => { c.root.position.set(x, groundY(x, z), z); c.root.rotation.y = yaw; };
  const dayRoles = new Set(['uncle', 'laundry', 'smith', 'seller', 'eater', 'sweeper', 'kid', 'cartman', 'chat', 'farmer', 'soldier']);

  // the garrison's way out: up the road from the guard post, through the gate, then off along the track to the east
  const MARCH = path([lane(-30, 0), lane(-38, 0), lane(-46, 0), lane(-50.5, 0.6), [roadX(-53) + 6, -54.5], [16, -58.5], [32, -64], [56, -71], [86, -77]]);

  function update(u, time, broken, P, cam) {
    camera = cam;
    castFrustum.setFromProjectionMatrix(castPM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const c of cast.all) {
      const isDay = dayRoles.has(c.role) && !broken;
      const isNight = !!c.night && !!broken && c.role !== 'uncle';
      c.root.visible = (isDay || isNight) && u < 104;
      if (!c.root.visible) continue;
      if (c.role === 'uncle') {
        // (in the morning he stands at his door with the basket: the engine's own figure of him; on his bench after)
        if (u < 19.6) { c.root.visible = false; continue; }
        c.root.position.copy(c.home); c.root.rotation.y = c.homeRot;
        // seated on his bench; he raises a hand as the boy passes
        poseSeen(c, 'sitwave', time, band(15.6, 16.2, 18, 18.8, u));
      } else if (isDay) {
        if (c.role === 'laundry') {
          const w = band(20, 20.6, 21.8, 22.6, u);
          c.root.rotation.y = lerp(c.homeRot, c.homeRot + Math.PI, w);
          poseSeen(c, w > 0.5 ? 'wave' : 'hang', time, w);
        } else if (c.role === 'kid') {
          // chasing each other round in the street: feet pace the ground they cover
          const L2 = c.loop, a = time * L2.sp + (L2.off || 0), rx = L2.r, rz = L2.r * 0.7;
          const x = L2.c.x + Math.cos(a) * rx, z = L2.c.z + Math.sin(a) * rz;
          stand(c, x, z, Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz));
          const dist = a * (rx + rz) * 0.5;
          poseSeen(c, 'run', dist / (RUN_M * 0.6));
        } else if (c.role === 'cartman') {
          // up the street toward the gate's end of town, unhurried, a hand raised to the boy as they pass
          const z0 = -34, z1 = -6, k = smooth(24, 34, u), zz = lerp(z0, z1, k);
          stand(c, roadX(zz) - 1.9, zz, Math.atan2(roadX(zz + 0.5) - roadX(zz - 0.5), 1));
          const wv = band(29.4, 29.9, 30.7, 31.2, u);
          poseSeen(c, wv > 0.4 ? 'wave' : 'walk', (zz - z0) / WALK_M, wv);
        } else if (c.role === 'soldier') {
          // (once he speeds up along the road the column keeps pace: through the gate and off east along the track
          // before he reaches the turning, so he never walks through it)
          const t = clamp(u - 34.5, 0, 1), extra = 4.85 * (u > 35.5 ? u - 35.0 : t * t * t - t * t * t * t / 2);
          const i = c.index, s = Math.max(0, (u - 24) * 2.15 + extra - i * 1.7);
          const k = clamp(s / MARCH.len);
          MARCH.curve.getPointAt(k, _p); MARCH.curve.getTangentAt(k, _t);
          const side = (i % 2 ? 0.7 : -0.7);
          const x = _p.x + _t.z * side, z = _p.z - _t.x * side;
          stand(c, x, z, Math.atan2(_t.x, _t.z));
          poseSeen(c, s > 0 && s < MARCH.len ? 'walk' : 'idle', s / WALK_M + i * 0.3);
          c.root.visible = u > 20 && u < 46;
        } else {
          poseSeen(c, c.day, time);
        }
      } else if (isNight) {
        if (c.role === 'flee') {
          const r = FLEE[c.index % FLEE.length];
          const q = along(r.path, u, r.u0, r.v);
          if (!q) { c.root.visible = false; continue; }
          stand(c, q.x, q.z, q.yaw);
          poseSeen(c, 'run', q.s / (RUN_M * (c.index === 5 ? 0.62 : 1)));
        } else {
          poseSeen(c, c.night, time);
        }
      }
      // nobody brushes past the lens
      if (c.root.visible && c.root.position.distanceTo(camera.position) < 2.2) c.root.visible = false;
    }
    // ---------------------------------------------------------------- wolves
    const night = !!broken;
    W.forEach(w => (w.root.visible = false));
    if (!night || u >= 104) return;
    // on the roofs: toward him along the ridges, leaping the gaps
    {
      const s = (u - 73.0) * 16.5;
      if (s > 0 && s < ROOF_RUN.len) {
        const r = roofAt(s), w0 = W[0];
        w0.root.visible = true;
        w0.root.position.copy(r.p).add(V3(0, 0.02, 0));
        w0.root.rotation.y = Math.atan2(r.dir.x, r.dir.z);
        poseWolf(w0, r.leap && r.k > 0.08 && r.k < 0.92 ? 'leap' : 'gallop', s / GALLOP_M, r.k);
      }
    }
    // across the street, after her
    {
      const q = along(CHASE, u, 75.0, 13.5);
      if (q) {
        const w1 = W[1];
        w1.root.visible = true;
        w1.root.position.set(q.x, groundY(q.x, q.z) + 0.02, q.z);
        w1.root.rotation.y = q.yaw;
        poseWolf(w1, 'gallop', q.s / GALLOP_M);
      }
    }
    // at the gate
    if (u > 66 && u < 74.4) {
      const w2 = W[2], q = along(PROWL, u, 66.2, PROWL.len / 3.8);
      const end = PROWL.curve.getPointAt(1);
      const p = q ? V3(q.x, 0, q.z) : end;
      w2.root.visible = true;
      w2.root.position.set(p.x, groundY(p.x, p.z), p.z);
      w2.root.rotation.y = q ? q.yaw : Math.atan2(P.x - p.x, P.z - p.z);
      if (q) poseWolf(w2, 'prowl', q.s / PROWL_M); else poseWolf(w2, 'snarl', time);
    }
    {
      // howling below the crag, where the ones who sent them stand
      const x = 46, z = 18, w3 = W[3];
      w3.root.visible = true;
      w3.root.position.set(x, heightAt(x, z), z);
      w3.root.rotation.y = -1.2;
      poseWolf(w3, 'howl', time);
    }
    {
      // out of his uncle's door as he reaches it: off the porch in one leap, away down the street
      const UH = H.uncle, door = UH.door, out = UH.porchFront.clone().sub(UH.center).setY(0).normalize();
      const t = clamp((u - 78.3) / 1.6);
      if (u > 78.1 && u < 80.5) {
        const sideV = V3().crossVectors(out, V3(0, 1, 0));
        const p = door.clone().addScaledVector(out, -0.6 + t * 7).addScaledVector(sideV, t * t * 6);
        const air = Math.sin(clamp((t - 0.12) / 0.55) * Math.PI);
        p.y = lerp(groundY(p.x, p.z), UH.frame.plat + 0.03, 1 - smooth(0.25, 0.62, t)) + Math.max(0, air) * 1.25;
        const w4 = W[4];
        w4.root.visible = true;
        w4.root.position.copy(p);
        w4.root.rotation.y = Math.atan2(out.x + sideV.x * t, out.z + sideV.z * t);
        poseWolf(w4, t > 0.12 && t < 0.67 ? 'leap' : 'gallop', t * 7 / GALLOP_M, t);
      }
    }
  }

  return { update, groundY, FLEE, ROOF_RUN, roofAt };
}
