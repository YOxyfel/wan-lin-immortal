// Body and garment builders for Jiang Wuhen (and parts reused by the elder). Each builder appends a surface to an
// accumulator; it is called once per age with identical topology (age-1 build becomes the morph target).
import { surf, table, tubeF, pathTubeF, headSurface, headSDF, VEC, sup, srgb } from './hero-geo.js';
import { clamp, lerp, smooth, band, TAU, fbm3, snoise3 } from './hero-util.js';

const { sub, add, mul, dot, cross, len, norm, madd } = VEC;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scl = (c, s) => [c[0] * s, c[1] * s, c[2] * s];

export function styleFor(age) {
  const k = age ? 1.80 / 1.70 : 1;
  return {
    age, k,
    hemY: age ? 0.47 : 0.70, slitY: age ? 0.80 * k : 0.875,
    tW: age ? 1.1 : 1.0, tD: age ? 1.06 : 1.0, flare: age ? 1.2 : 1.0,
    vY: age ? 1.30 * k : 1.262,
    linen: age ? srgb(0.64, 0.585, 0.49) : srgb(0.79, 0.73, 0.61),
    collar: age ? srgb(0.54, 0.53, 0.5) : srgb(0.7, 0.68, 0.63),
    sash: age ? srgb(0.27, 0.31, 0.42) : srgb(0.3, 0.35, 0.49),
    pants: age ? srgb(0.34, 0.35, 0.38) : srgb(0.42, 0.43, 0.47),
    wraps: age ? srgb(0.62, 0.58, 0.51) : srgb(0.78, 0.74, 0.66),
    shoe: age ? srgb(0.2, 0.17, 0.15) : srgb(0.12, 0.12, 0.13),
    sole: age ? srgb(0.36, 0.32, 0.28) : srgb(0.66, 0.62, 0.55),
    leather: srgb(0.22, 0.17, 0.13),
    skin: age ? srgb(0.87, 0.73, 0.64) : srgb(0.9, 0.77, 0.68),
    hide: age ? 0 : 1, // bracers hidden inside the forearm at 15
  };
}

// context helpers
function C(ctx) {
  const J = n => { const v = ctx.J.J[n]; return [v.x, v.y, v.z]; };
  const E = n => { const v = ctx.J.E[n]; return [v.x, v.y, v.z]; };
  return { J, E };
}
const cloth = (type, hem, edge, seed) => ({ aCloth: [type, hem, edge, seed] });
// level of detail: scale a resolution by ctx.lod (villagers) with a floor
const L = (ctx, n, min = 3) => Math.max(min, Math.round(n * (ctx.lod || 1)));
const uvTile = (s, t, k = 9) => [s * k, t * k];

// ================================================================== TUNIC
export function tunicShape(ctx) {
  const S = ctx.S, k = S.k;
  const up = table([
    [0.985, 0.148, 0.106, 0.098, 0.0, 2.3],
    [1.0, 0.142, 0.102, 0.095, 0.0, 2.3],
    [1.06, 0.14, 0.1, 0.093, -0.002, 2.3],
    [1.115, 0.145, 0.104, 0.095, -0.004, 2.3],
    [1.145, 0.16, 0.112, 0.101, -0.006, 2.3],
    [1.2, 0.171, 0.117, 0.106, -0.008, 2.3],
    [1.27, 0.177, 0.118, 0.107, -0.011, 2.3],
    [1.335, 0.181, 0.112, 0.104, -0.014, 2.25],
    [1.37, 0.162, 0.1, 0.099, -0.016, 2.12],
    [1.398, 0.14, 0.088, 0.092, -0.019, 2.08],
    [1.426, 0.108, 0.073, 0.079, -0.023, 2.05],
    [1.446, 0.078, 0.061, 0.066, -0.026, 2.1],
    [1.456, 0.066, 0.057, 0.062, -0.028, 2.05],
  ]);
  const sk = table([
    [0, 0.148, 0.106, 0.098],
    [0.18, 0.168, 0.116, 0.12],
    [0.38, 0.19, 0.126, 0.14],
    [0.65, 0.2, 0.13, 0.143],
    [1, 0.212, 0.136, 0.146],
  ]);
  const yS0 = 0.985 * k, yCol = 1.456 * k, hemY = S.hemY;
  // base cross-section (no folds): returns [x, z] for angle ph (0 = front, +pi/2 = left)
  const xs = (ph, y) => {
    let Wd, Df, Db, z0, e;
    if (y >= yS0) [Wd, Df, Db, z0, e] = up(y / k);
    else {
      const s = clamp((yS0 - y) / (yS0 - hemY));
      [Wd, Df, Db] = sk(s);
      const fl = lerp(1, S.flare, s);
      Wd *= fl; Df *= fl; Db *= fl; z0 = 0; e = 2.25;
    }
    Wd *= S.tW; Df *= S.tD; Db *= S.tD;
    const r = sup(ph, e);
    const c = Math.cos(ph);
    const D = lerp(Db, Df, smooth(-0.35, 0.35, c));
    return [Wd * r * Math.sin(ph), z0 * k + D * r * c];
  };
  // fold displacement (radial)
  const folds = (ph, y) => {
    let d = 0;
    if (y < yS0) {
      const s = clamp((yS0 - y) / (yS0 - hemY));
      const A = (0.013 * Math.pow(s, 1.1)) * S.flare;
      d += A * (0.55 * Math.sin(8 * ph + 0.7 + s * 0.8) + 0.35 * Math.sin(13 * ph + 2.1 - s) + 0.3 * Math.sin(5 * ph + 4.0));
      d += 0.004 * s * fbm3(Math.cos(ph) * 2, Math.sin(ph) * 2, y * 9) + 0.0026 * fbm3(Math.cos(ph) * 2.5, Math.sin(ph) * 2.5, y * 11) * smooth(0.25, 0.0, s);
    } else {
      const bl = band(1.1 * k, 1.13 * k, 1.16 * k, 1.24 * k, y);
      d += bl * (0.0035 * Math.sin(11 * ph + 1.3) + 0.0025 * Math.sin(6 * ph + 0.4));
      d += 0.0026 * fbm3(Math.cos(ph) * 2.5, Math.sin(ph) * 2.5, y * 11) * (1 - smooth(1.0 * k, 1.08 * k, y) + smooth(1.13 * k, 1.2 * k, y));
      // diagonal drape from the sash towards the shoulders
      // soft diagonal drape from the sash towards the shoulders
      d += 0.0032 * Math.sin(4 * ph + y * 34) * band(1.12 * k, 1.17 * k, 1.3 * k, 1.37 * k, y) + 0.002 * Math.sin(7 * ph - y * 40) * band(1.13 * k, 1.2 * k, 1.27 * k, 1.33 * k, y);
    }
    return d;
  };
  const point = (ph, y, withFolds = true) => {
    const [x, z] = xs(ph, y);
    const d = withFolds ? folds(ph, y) : 0;
    const zc = -0.01 * k;
    const rl = Math.hypot(x, z - zc) || 1;
    return [x + (x / rl) * d, y, z + ((z - zc) / rl) * d];
  };
  // V neckline: opening between two lines on the chest, from the V bottom to the sides of the neck
  const vB = [-0.012 * k, S.vY], nL = 0.052 * k, nR = -0.05 * k;
  const xL = y => lerp(vB[0], nL, clamp((y - vB[1]) / (yCol - vB[1]))), xR = y => lerp(vB[0], nR, clamp((y - vB[1]) / (yCol - vB[1])));
  const inside = (ph, y) => {
    const [x, z] = xs(ph, y);
    return z > 0 && x < xL(y) && x > xR(y);
  };
  const yTopCache = new Map();
  const yTop = ph => {
    ph = Math.atan2(Math.sin(ph), Math.cos(ph));
    const key = Math.round(ph * 1e5);
    if (yTopCache.has(key)) return yTopCache.get(key);
    let r = yCol;
    if (Math.cos(ph) > 0.05 && inside(ph, yCol - 1e-4)) {
      let a = vB[1], b = yCol - 1e-4;
      if (inside(ph, a)) r = a;
      else { for (let i = 0; i < 28; i++) { const m = (a + b) / 2; if (inside(ph, m)) b = m; else a = m; } r = b; }
    }
    yTopCache.set(key, r);
    return r;
  };
  return { xs, folds, point, yTop, yS0, yCol, hemY, inside, xL, xR, vB };
}

export function buildTunic(G, ctx) {
  const S = ctx.S, k = S.k, W = ctx.W;
  const T = tunicShape(ctx);
  const NU = 2 * L(ctx, 28, 8);
  const seed = 0.31;
  const col = (p, u, v, n) => {
    // gentle occlusion under the sash and in the armpits, a little grime near the hem
    const y = p[1];
    let ao = 1 - 0.22 * band(1.08 * k, 1.12 * k, 1.15 * k, 1.19 * k, y) - 0.18 * smooth(1.0 * k, 0.985 * k, y) * smooth(0.9 * k, 0.97 * k, y);
    ao *= 1 - 0.25 * smooth(0.16, 0.2, Math.abs(p[0])) * band(1.15 * k, 1.22 * k, 1.3 * k, 1.34 * k, y);
    const g = 1 - (0.1 + 0.15 * S.age) * smooth(T.hemY + 0.15, T.hemY, y);
    return scl(S.linen, ao * g);
  };
  // upper shell: closed ring from the slit top to the collar; seam at the back (u=0)
  const rowY = (ph, v) => {
    const top = T.yTop(ph);
    const vv = 1 - Math.pow(1 - v, 1.25);
    return lerp(S.slitY, top, vv);
  };
  surf(G, {
    nu: NU, nv: L(ctx, 28), wrapU: true,
    f: (u, v) => { const ph = TAU * u + Math.PI; return T.point(ph, rowY(ph, clamp(v, -0.05, 1.05))); },
    out: (u, v) => [0, T.point(TAU * u + Math.PI, rowY(TAU * u + Math.PI, v))[1], -0.01],
    color: col,
    weights: p => W.skirt(p, T.hemY),
    uv: (u, v) => [u * 11, rowY(TAU * u + Math.PI, v) * 8.5],
    extra: (p, u, v) => cloth(0, clamp((T.yS0 - p[1]) / (T.yS0 - T.hemY)) ** 1.5, 9, seed),
  });
  // skirt panels below the slit top: front (ph in [-pi/2, pi/2]) and back, opening slightly towards the hem
  for (const back of [0, 1]) {
    const gap = v => 0.045 * Math.pow(Math.max(v, 0), 1.3);
    const php = (u, v) => back ? lerp(Math.PI / 2 + gap(v), 1.5 * Math.PI - gap(v), u) : lerp(-Math.PI / 2 + gap(v), Math.PI / 2 - gap(v), u);
    const yv = v => lerp(S.slitY, T.hemY, v);
    surf(G, {
      nu: NU / 2, nv: L(ctx, 12),
      f: (u, v) => T.point(php(u, v), yv(v)),
      out: (u, v) => [0, yv(v), -0.01],
      color: col,
      weights: p => W.skirt(p, T.hemY),
      uv: (u, v) => [11 * ((back ? 0.75 : 0.25) + 0.5 * u), yv(v) * 8.5],
      extra: (p, u, v) => {
        const s = clamp((T.yS0 - p[1]) / (T.yS0 - T.hemY));
        const edge = Math.min(p[1] - T.hemY + 0.004, Math.min(u, 1 - u) * 0.6 + (1 - v) * 0.3);
        return cloth(0, Math.pow(s, 1.5), edge, seed + back * 0.2);
      },
    });
  }
  return T;
}

// collar band: along the neckline (outer lapel edge continues down to the right side under the sash)
export function buildCollar(G, ctx, T) {
  const S = ctx.S, k = S.k, W = ctx.W;
  const pts = [];
  // shell surface normal (numerical)
  const nrm = (ph, y) => {
    const e = 1e-3;
    const a = T.point(ph + e, y, false), b = T.point(ph - e, y, false), c = T.point(ph, y + e, false), d = T.point(ph, y - e, false);
    let n = cross(sub(a, b), sub(c, d));
    n = norm(n);
    const p = T.point(ph, y, false);
    if (dot(n, [p[0], 0, p[2] + 0.01]) < 0) n = mul(n, -1);
    return n;
  };
  // find ph on the front shell at height y with given x
  const phAt = (x, y) => {
    let a = -Math.PI / 2, b = Math.PI / 2;
    for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (T.xs(m, y)[0] < x) a = m; else b = m; }
    return (a + b) / 2;
  };
  // 1) from the right waist up to the V bottom (outer lapel, continued)
  const yW = 1.09 * k;
  for (let i = 0; i <= 10; i++) {
    const y = lerp(yW, T.vB[1], i / 10);
    const x = lerp(-0.125 * k * S.tW, T.vB[0], Math.pow(i / 10, 0.9));
    pts.push({ ph: phAt(x, y), y, stand: 0 });
  }
  // 2) up the left edge to the neck
  for (let i = 1; i <= 16; i++) {
    const y = lerp(T.vB[1], T.yCol - 0.001, i / 16);
    pts.push({ ph: phAt(T.xL(y) + 0.004, y), y, stand: smooth(T.yCol - 0.03, T.yCol, y) });
  }
  // 3) around the back of the neck
  const p0 = pts[pts.length - 1].ph, p1 = phAt(T.xR(T.yCol - 0.001) - 0.004, T.yCol - 0.001) + TAU;
  for (let i = 1; i < 22; i++) pts.push({ ph: lerp(p0, p1, i / 22), y: T.yCol - 0.001, stand: 1 });
  // 4) down the right edge to the V bottom (inner lapel), tucked under the outer one
  for (let i = 0; i <= 14; i++) {
    const y = lerp(T.yCol - 0.001, T.vB[1] + 0.012, i / 14);
    pts.push({ ph: phAt(T.xR(y) - 0.004, y), y, stand: smooth(T.yCol - 0.03, T.yCol, y) });
  }
  const path = pts.map(q => {
    const p = T.point(q.ph, q.y, false);
    let n = nrm(q.ph, q.y);
    const rad = norm([p[0], 0, p[2] + 0.02]);
    n = norm(add(mul(n, 1 - q.stand), mul(rad, q.stand)));
    return { p, n, stand: q.stand };
  });
  const N = path.length;
  // tangents and consistently oriented in-surface side vectors (propagated along the path)
  for (let i = 0; i < N; i++) {
    const a = path[Math.max(0, i - 1)].p, b = path[Math.min(N - 1, i + 1)].p;
    path[i].tg = norm(sub(b, a));
    let sd = norm(cross(path[i].tg, path[i].n));
    if (i > 0 && dot(sd, path[i - 1].side) < 0) sd = mul(sd, -1);
    path[i].side = sd;
  }
  const mid = path[Math.floor(N * 0.6)];
  if (dot(mid.side, [0, 1, 0]) < 0) for (const q of path) q.side = mul(q.side, -1);
  for (const q of path) if (q.stand > 0) q.side = norm(add(mul(q.side, 1 - q.stand), mul([0, 1, 0], q.stand)));
  const at = (v) => {
    const t = clamp(v, 0, 1) * (N - 1);
    const i = Math.min(N - 2, Math.floor(t)), f = t - i;
    const a = path[i], b = path[i + 1];
    return { p: add(mul(a.p, 1 - f), mul(b.p, f)), n: norm(add(mul(a.n, 1 - f), mul(b.n, f))), stand: lerp(a.stand, b.stand, f), side: norm(add(mul(a.side, 1 - f), mul(b.side, f))) };
  };
  const wid = 0.0122 * k, th = 0.0022;
  surf(G, {
    nu: L(ctx, 6, 4), nv: Math.max(12, Math.round(N * (ctx.lod || 1))),
    f: (u, v) => {
      const q = at(v);
      const side = q.side;
      const ph = u * TAU;
      const c = madd(madd(q.p, q.n, th * 0.9), side, -0.004 + q.stand * 0.012);
      const s = Math.sin(ph), cc = Math.cos(ph);
      return madd(madd(c, side, wid * s), q.n, th * cc * (cc > 0 ? 1 : 0.5));
    },
    out: (u, v) => { const q = at(v); return madd(q.p, q.n, -0.05); },
    color: () => S.collar,
    weights: p => ctx.W.torso(p),
    uv: (u, v) => uvTile(u * 0.1, v * 2.2),
    extra: () => cloth(6, 0, 9, 0.77),
  });
}

// ================================================================== SLEEVES
export function buildSleeves(G, ctx) {
  const S = ctx.S, k = S.k, W = ctx.W;
  const { J } = C(ctx);
  const R = table([
    [-0.03, 0.064], [0.03, 0.064], [0.1, 0.063], [0.17, 0.061], [0.215, 0.06], [0.245, 0.059],
    [0.262, 0.058], [0.272, 0.064], [0.284, 0.067], [0.298, 0.066], [0.31, 0.06], [0.322, 0.05], [0.333, 0.043], [0.348, 0.041],
  ]);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const A = J('upperArm' + s), E = J('foreArm' + s);
    const lUA = len(sub(E, A));
    const long = !!ctx.longSleeves;
    const lF = len(sub(J('hand' + s), E));
    const t0 = -0.05 * k, t1 = long ? lUA + lF * 0.94 : lUA + 0.063 * k;
    const d = norm(sub(E, A));
    const f = tubeF(madd(A, d, t0), madd(A, d, t1), [0, 0, 1], (ph, v) => {
      const t = lerp(t0, t1, v) / k;
      if (long) {
        const u = clamp(t / (t1 / k));
        let r = lerp(0.064, 0.094, smooth(0.25, 1, u)) * k * lerp(0.55, 1, smooth(-0.05, 0.0, t));
        r += 0.005 * Math.sin(3 * ph + t * 22 + m) * smooth(0.0, 0.3, u) + 0.004 * Math.sin(t * 2 * Math.PI / 0.05 + 2 * Math.sin(ph)) * band(0.35, 0.45, 0.55, 0.65, u);
        r += 0.004 * fbm3(Math.cos(ph) * 2, Math.sin(ph) * 2, t * 12 + m * 3);
        const sag = 0.012 * Math.max(0, Math.sin(ph)) * smooth(0.3, 0.9, u);
        return [r * Math.cos(ph), (r + sag) * Math.sin(ph) * (m > 0 ? 1 : -1)];
      }
      let r = R(t * 0.285 / (lUA / k))[0] * k * (S.age ? 1.07 : 1) * lerp(0.55, 1, smooth(-0.05, 0.0, t));
      // gathered folds and bunching towards the roll
      // soft diagonal drape folds along the sleeve, a little compression just above the cuff
      r += 0.0032 * Math.sin(2 * ph + t * 22 + m) * smooth(0.02, 0.12, t) * (1 - smooth(0.24, 0.26, t));
      r += 0.0022 * Math.sin(3 * ph - t * 35 + 1.3 * m) * band(0.08, 0.14, 0.22, 0.25, t);
      r += 0.0018 * Math.sin(t * 2 * Math.PI / 0.03 + 3 * ph) * band(0.2, 0.23, 0.25, 0.26, t);
      r += 0.0014 * Math.sin(4 * ph + 1.7) * band(0.262, 0.27, 0.31, 0.32, t);
      r += 0.0016 * fbm3(Math.cos(ph) * 2, Math.sin(ph) * 2, t * 12 + m * 3);
      // sag: the underside hangs a little
      const sag = 0.0045 * Math.max(0, Math.sin(ph)) * smooth(0.02, 0.15, t) * (1 - smooth(0.2, 0.25, t));
      return [r * Math.cos(ph) * 1.02, (r + sag) * Math.sin(ph) * (m > 0 ? 1 : -1) * 0.97];
    });
    surf(G, {
      nu: L(ctx, 22), nv: L(ctx, 24), wrapU: true, f,
      out: (u, v) => madd(A, d, lerp(t0, t1, v)),
      color: (p, u, v) => {
        const t = lerp(t0, t1, v) / k;
        const ao = 1 - 0.12 * band(0.25, 0.26, 0.264, 0.27, t) - 0.12 * smooth(0.33, 0.348, t);
        return scl(S.linen, ao * (1 - 0.06 * S.age));
      },
      weights: p => W.arm(p, s),
      uv: (u, v) => uvTile(u * 0.5, v * 0.36),
      extra: (p, u, v) => cloth(0, 0, (1 - v) * (t1 - t0) + 0.0, 0.5 + m * 0.1),
    });
  }
}

// ================================================================== SASH
export function sashPath(ctx) {
  const S = ctx.S, k = S.k;
  const Wd = 0.152 * S.tW * k, Df = 0.108 * S.tD * k, Db = 0.1 * S.tD * k, z0 = -0.004 * k;
  const C0 = (ph, y) => { const r = sup(ph, 2.3); return [Wd * r * Math.sin(ph), y, z0 + lerp(Db, Df, smooth(-0.35, 0.35, Math.cos(ph))) * r * Math.cos(ph)]; };
  const N0 = (ph, y) => { const a = C0(ph + 1e-3, y), b = C0(ph - 1e-3, y); const t = norm(sub(a, b)); return norm([t[2], 0, -t[0]]); };
  return { C0, N0 };
}

export function buildSash(G, ctx, T) {
  const S = ctx.S, k = S.k, W = ctx.W;
  const { C0, N0 } = sashPath(ctx);
  const col = S.sash;
  for (const wrap of [0, 1]) {
    const yc = wrap ? 1.077 * k : 1.03 * k, hh = (wrap ? 0.031 : 0.035) * k, grow = wrap ? 0.007 : 0;
    surf(G, {
      nu: L(ctx, 56), nv: L(ctx, 8), wrapU: true,
      f: (u, v) => {
        const ph = TAU * u + Math.PI;
        const yy = yc + (wrap ? 0.01 * Math.sin(ph - 0.6) : 0);
        const c = C0(ph, yy), n = N0(ph, yy);
        const ps = TAU * v;
        const cs = Math.cos(ps), sn = Math.sin(ps);
        const r = sup(ps, 3.2);
        let off = 0.0062 * r * cs + grow;
        // lengthwise creases on the outer face
        if (cs > 0) off += cs * (0.0022 * Math.sin(sn * 7.5 + ph * 1.5 + wrap * 2) + 0.0012 * snoise3(ph * 3, sn * 4, wrap * 5));
        return [c[0] + n[0] * off, c[1] + hh * r * sn * (1 + 0.04 * Math.sin(ph * 3 + wrap)), c[2] + n[2] * off];
      },
      out: (u, v) => [0, yc, -0.004 * k],
      color: (p, u, v) => scl(col, 1 - 0.18 * Math.max(0, -Math.cos(TAU * v)) - (wrap ? 0 : 0.12)),
      weights: p => W.torso(p),
      uv: (u, v) => uvTile(u * 1.0, v * 0.18),
      extra: () => cloth(1, 0, 9, 0.2 + wrap * 0.3),
    });
  }
  // knot at the front-left
  const phK = 0.62;
  const kc = madd(C0(phK, 1.055 * k), N0(phK, 1.055 * k), 0.022);
  for (const lump of [0, 1]) {
    const c = lump ? madd(kc, [0.015, -0.012, 0.004], k) : kc;
    const rx = (lump ? 0.022 : 0.028) * k, ry = (lump ? 0.026 : 0.03) * k, rz = (lump ? 0.016 : 0.019) * k;
    surf(G, {
      nu: L(ctx, 12), nv: L(ctx, 8), wrapU: true,
      f: (u, v) => {
        const ph = TAU * u, th = Math.PI * clamp(v, 0, 1);
        const w = 1 + 0.12 * Math.sin(ph * 3 + th * 2 + lump) + 0.08 * snoise3(u * 4, v * 4, lump * 3);
        return [c[0] + rx * w * Math.sin(th) * Math.cos(ph), c[1] + ry * w * Math.cos(th), c[2] + rz * w * Math.sin(th) * Math.sin(ph)];
      },
      out: () => c,
      color: () => scl(col, 0.95 - lump * 0.08),
      weights: p => W.torso(p),
      uv: (u, v) => uvTile(u * 0.15, v * 0.08),
      extra: () => cloth(1, 0, 9, 0.6),
    });
  }
  // hanging ends: rest path along the skirt surface from below the knot; skinned to dynamic bones
  const ends = [];
  for (const e of (ctx.noSashEnds ? [] : [0, 1])) {
    const Lr = (e ? 0.43 : 0.5) * k, wid = (e ? 0.072 : 0.085) * k;
    const ph = phK + (e ? 0.2 : -0.04);
    const y0 = 1.025 * k;
    const NB = 7;
    const pathAt = s => {
      const y = y0 - s * Lr;
      let p;
      if (y > T.yS0) { const c = C0(ph, y), n = N0(ph, y); p = madd(c, n, 0.026 + e * 0.004); }
      else { const q = T.point(ph, y, false); const n = norm([q[0], 0, q[2] + 0.01]); p = madd(q, n, 0.018 + e * 0.006 + 0.012 * s); }
      return p;
    };
    const bonePts = [];
    for (let i = 0; i < NB; i++) bonePts.push(pathAt(i / (NB - 1)));
    const sideAt = s => { const p = pathAt(s); const n = norm([p[0], 0, p[2] + 0.01]); return norm(cross([0, 1, 0], n)); };
    const nrmAt = s => { const p = pathAt(s); return norm([p[0], 0, p[2] + 0.01]); };
    const base = ctx.sashBoneBase + e * NB;
    surf(G, {
      nu: L(ctx, 5), nv: L(ctx, 18),
      f: (u, v) => {
        const s = clamp(v, -0.1, 1.1);
        const p = pathAt(s), sd = sideAt(s), n = nrmAt(s);
        const x = (u - 0.5) * wid * (1 - 0.1 * s);
        const curl = 0.006 * (1 - Math.pow(2 * u - 1, 2)) + 0.003 * Math.sin(s * 19 + u * 3 + e) * smooth(0, 0.2, s);
        return add(madd(p, sd, x), mul(n, curl));
      },
      flip: false,
      color: (p, u, v) => scl(col, 0.92 - 0.1 * e),
      weights: (p, u, v) => {
        const t = clamp(v) * (NB - 1);
        const i = Math.min(NB - 2, Math.floor(t)), f = t - i;
        return [[base + i, 1 - f], [base + i + 1, f]];
      },
      uv: (u, v) => uvTile(u * wid * 1.2, v * Lr),
      extra: (p, u, v) => cloth(1, 0, (1 - v) * Lr * 0.9 + Math.min(u, 1 - u) * 0.02 + 0.002, 0.4 + e * 0.3),
    });
    ends.push({ pts: bonePts, L: Lr, width: wid });
  }
  return { ends };
}

// ================================================================== TROUSERS
export function buildTrousers(G, ctx) {
  const S = ctx.S, k = S.k, W = ctx.W;
  const Tb = table([
    // y, cx, rxo, rxi, rzf, rzb, cz
    [1.05, 0.045, 0.118, 0.105, 0.098, 0.104, -0.006],
    [0.95, 0.058, 0.118, 0.098, 0.108, 0.118, -0.01],
    [0.86, 0.074, 0.11, 0.078, 0.11, 0.116, -0.005],
    [0.78, 0.094, 0.108, 0.066, 0.108, 0.108, 0.0],
    [0.68, 0.106, 0.11, 0.062, 0.108, 0.102, 0.004],
    [0.56, 0.112, 0.114, 0.063, 0.11, 0.102, 0.008],
    [0.46, 0.115, 0.12, 0.068, 0.116, 0.108, 0.008],
    [0.41, 0.114, 0.116, 0.066, 0.112, 0.104, 0.006],
    [0.37, 0.108, 0.1, 0.064, 0.098, 0.094, 0.004],
    [0.34, 0.098, 0.074, 0.062, 0.073, 0.07, 0.0],
    [0.325, 0.097, 0.058, 0.052, 0.057, 0.057, -0.004],
    [0.3, 0.097, 0.053, 0.049, 0.051, 0.053, -0.006],
  ]);
  const yTop = 1.05, yBot = 0.3;
  const ymap = v => { // denser near the gather
    const a = 0.62;
    return v < a ? lerp(yTop, 0.42, v / a) : lerp(0.42, yBot, (v - a) / (1 - a));
  };
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const sd = m > 0 ? 0 : 7.3;
    const f = (u, v) => {
      const y = ymap(clamp(v, -0.05, 1.05));
      const ph = TAU * u;
      const [cx, rxo, rxi, rzf, rzb, cz] = Tb(y);
      const l = Math.sin(ph), c = Math.cos(ph);
      const rx = lerp(rxi, rxo, smooth(-0.45, 0.45, l)) * (S.age ? 1.04 : 1), rz = lerp(rzb, rzf, smooth(-0.45, 0.45, c)) * (S.age ? 1.03 : 1);
      const r = sup(ph, 2.15);
      let d = 0;
      d += 0.0075 * Math.sin(4 * ph + 7 * y + sd) * band(0.98, 0.85, 0.55, 0.45, y);
      d += 0.006 * Math.sin(3 * ph + 1 + sd) * band(0.5, 0.44, 0.38, 0.36, y);
      const g = band(0.43, 0.385, 0.345, 0.33, y);
      d += g * 0.012 * Math.sin(9 * ph + 3 * Math.sin(2 * ph + sd) + 30 * y);
      d += 0.0032 * fbm3(c * 2 + sd, l * 2, y * 10);
      d += 0.008 * Math.sin(2 * ph + 9 * y + sd) * band(0.9, 0.8, 0.6, 0.5, y);
      const x = m * (cx * k + l * (rx * r * k + d));
      const z = cz * k + c * (rz * r * k + d);
      return [x, y * k, z];
    };
    surf(G, {
      nu: L(ctx, 28), nv: L(ctx, 26), wrapU: true, f, vw: v => v,
      out: (u, v) => { const y = ymap(v); const t = Tb(y); return [m * t[0] * k, y * k, t[5] * k]; },
      color: (p, u, v) => {
        const y = p[1] / k;
        const inner = Math.pow(Math.max(0, -Math.sin(u * TAU)), 2) * smooth(0.88, 0.62, y);
        const ao = (1 - 0.3 * band(0.36, 0.345, 0.33, 0.31, y) - 0.1 * smooth(0.95, 1.02, y)) * (1 - 0.5 * inner);
        const dust = 1 - (0.08 + 0.12 * S.age) * smooth(0.5, 0.33, y);
        return scl(S.pants, ao * dust);
      },
      weights: p => W.leg(p, s),
      uv: (u, v) => uvTile(u * 0.75, ymap(v) * k * 1.1),
      extra: (p) => cloth(2, 0.12 * band(0.5, 0.42, 0.37, 0.34, p[1] / k), 9, 0.1 + m * 0.05),
    });
  }
}

// ================================================================== LEG WRAPS, SHOES
export function buildWrapsShoes(G, ctx) {
  const S = ctx.S, k = S.k, W = ctx.W;
  const { J } = C(ctx);
  const Tw = table([
    [0.05, 0.039, 0.05, 0.052, -0.004], [0.075, 0.036, 0.042, 0.048, -0.004], [0.1, 0.033, 0.036, 0.041, -0.003],
    [0.15, 0.034, 0.035, 0.041, -0.004], [0.22, 0.039, 0.037, 0.05, -0.006], [0.28, 0.045, 0.04, 0.056, -0.008],
    [0.32, 0.047, 0.042, 0.056, -0.008], [0.345, 0.048, 0.043, 0.055, -0.008],
  ]);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const ank = J('foot' + s), kn = J('shin' + s);
    const axisX = y => lerp(ank[0], kn[0], (y - ank[1]) / (kn[1] - ank[1]));
    const axisZ = y => lerp(ank[2], kn[2], (y - ank[1]) / (kn[1] - ank[1]));
    const y0 = 0.05, y1 = 0.345;
    surf(G, {
      nu: L(ctx, 16), nv: L(ctx, 12), wrapU: true,
      f: (u, v) => {
        const y = lerp(y0, y1, v) * k;
        const ph = TAU * u;
        const [rx, rzf, rzb, cz] = Tw(y / k);
        const c = Math.cos(ph);
        const rz = lerp(rzb, rzf, smooth(-0.4, 0.4, c));
        const wrapB = 0.0016 * Math.abs(Math.sin((ph * 0.9 + y / k * 70) * 1.0)) * (S.age ? 1.3 : 1);
        return [axisX(y) + m * Math.sin(ph) * (rx * k * (S.age ? 1.06 : 1) + wrapB), y, axisZ(y) + cz * k + c * (rz * k * (S.age ? 1.06 : 1) + wrapB)];
      },
      out: (u, v) => { const y = lerp(y0, y1, v) * k; return [axisX(y), y, axisZ(y)]; },
      color: (p, u, v) => scl(S.wraps, 1 - 0.12 * smooth(0.15, 0.06, p[1] / k) - 0.2 * smooth(0.31, 0.345, p[1] / k)),
      weights: p => W.leg(p, s),
      uv: (u, v) => [u, lerp(y0, y1, v) * 10],
      extra: () => cloth(3, 0, 9, 0.3 + m * 0.1),
    });
    // shoe / boot
    const Ts = table([
      [-0.084, 0.0, 0.05, 0.0], [-0.078, 0.02, 0.06, 0.0], [-0.064, 0.03, 0.067, 0.0], [-0.035, 0.0345, 0.071, 0.0],
      [0.0, 0.0375, 0.073, 0.001], [0.04, 0.0425, 0.068, 0.002], [0.08, 0.0465, 0.058, 0.002], [0.12, 0.0495, 0.049, 0.002],
      [0.15, 0.0485, 0.042, 0.0], [0.175, 0.0425, 0.036, -0.003], [0.196, 0.031, 0.029, -0.006], [0.21, 0.0, 0.021, -0.008],
    ]);
    const fx = ank[0];
    const z0 = -0.084, z1 = 0.21;
    surf(G, {
      nu: L(ctx, 18), nv: L(ctx, 16), wrapU: true,
      f: (u, v) => {
        const zz = lerp(z0, z1, clamp(v, 0, 1));
        let [w, h, cx] = Ts(zz);
        const capA = Math.sqrt(clamp(1 - Math.pow(clamp((0.07 - v) / 0.07), 2))), capB = Math.sqrt(clamp(1 - Math.pow(clamp((v - 0.93) / 0.07), 2)));
        const cap = Math.min(capA, capB);
        w = Math.max(w, 0.012) * cap * (S.age ? 1.08 : 1);
        if (S.age) h += 0.055 * smooth(0.07, -0.02, zz) + 0.004;
        h *= lerp(0.72, 1, cap);
        const ph = TAU * u;
        const top = Math.cos(ph) >= 0;
        const r = sup(ph, top ? 2.4 : 5);
        const yc = h * 0.5;
        let x = Math.sin(ph) * r * w, y = yc + Math.cos(ph) * r * h * 0.5;
        // sole lip
        if (y < 0.013) x *= 1.06;
        y = Math.max(y, 0);
        return [fx + m * (cx * k + x) , y * k, (zz) * k * (S.age ? 1.03 : 1)];
      },
      out: (u, v) => [fx, 0.03, lerp(z0, z1, v) * k],
      color: (p, u, v) => {
        const sole = smooth(0.0135 * k, 0.009 * k, p[1]);
        const scuff = 1 + 0.15 * S.age * snoise3(p[0] * 40, p[1] * 40, p[2] * 40);
        return mixc(scl(S.shoe, scuff), S.sole, sole);
      },
      weights: p => W.foot(p, s),
      uv: (u, v) => uvTile(u * 0.3, v * 0.3),
      extra: (p) => cloth(4, 0, 9, 0.9),
    });
  }
}

// ================================================================== BRACERS (age 21; hidden inside the forearm at 15)
export const FOREARM = table([
  // t' from elbow, half-width (thumb side), half-thickness
  [-0.04, 0.041, 0.038], [0.0, 0.041, 0.038], [0.05, 0.0415, 0.0355], [0.1, 0.0365, 0.0295],
  [0.17, 0.0305, 0.0235], [0.225, 0.0283, 0.0198], [0.245, 0.0275, 0.0186], [0.26, 0.0275, 0.0186],
]);
export function buildBracers(G, ctx) {
  const S = ctx.S, k = S.k, W = ctx.W;
  const { J } = C(ctx);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const E = J('foreArm' + s), Wr = J('hand' + s);
    const lF = len(sub(Wr, E));
    const ta = lF - 0.125 * k, tb = lF - 0.006 * k;
    const d = norm(sub(Wr, E));
    const f = tubeF(madd(E, d, ta), madd(E, d, tb), [0, 0, 1], (ph, v) => {
      const t = lerp(ta, tb, v);
      const [rw, rt] = FOREARM(t / lF * 0.245);
      const fk = (S.age ? 1.1 : 1) * k;
      const strap = 0.0018 * Math.abs(Math.sin(ph * 1 + t / k * 80 * (m))) + 0.001 * Math.sin(ph * 2 + t * 300);
      const grow = S.age ? 0.0042 + strap : -0.006;
      const flare = S.age ? 0.003 * smooth(0.85, 1, v) : 0;
      return [(rw * fk + grow + flare) * Math.cos(ph), (rt * fk + grow + flare) * Math.sin(ph) * m];
    });
    surf(G, {
      nu: L(ctx, 16), nv: L(ctx, 7), wrapU: true, f,
      out: (u, v) => madd(E, d, lerp(ta, tb, v)),
      color: (p, u, v) => scl(S.leather, 1 - 0.25 * Math.abs(Math.sin(u * TAU + v * 25 * m))),
      weights: p => W.arm(p, s),
      uv: (u, v) => [u, v * 1.2],
      extra: () => cloth(5, 0, 9, 0.2),
    });
  }
}

// ================================================================== SKIN: head, ears, forearms, hands
export function headFrame(P) {
  return { O: [0, P.headY + 0.0655 * P.hs, 0.0], s: P.hs };
}
export const HERO_HEAD = { skullW: 0.98, skullD: 1.0, faceW: 0.93, jawW: 0.93, jawT: 0.95, chinL: 1.0, chinW: 0.9, cheek: 1.0, brow: 1.0, noseL: 1.02, neckR: 0.048, trapW: 0.15, hollow: 0, fill: 1 };

export function buildHead(G, ctx, HA) {
  const S = ctx.S, k = S.k, W = ctx.W;
  const HF = headFrame(ctx.P);
  const A = Object.assign({}, HA, ctx.headA || {});
  const skin = ctx.skinCol || S.skin;
  headSurface(G, HF, A, {
    nu: L(ctx, 58), nv: L(ctx, 54),
    color: (p, hp, n, ao) => {
      const y = hp[1] / HF.s, z = hp[2] / HF.s, ax = Math.abs(hp[0] / HF.s);
      // warmer, redder ears / nose tip / cheeks; slightly darker towards the neck
      let c = skin.slice();
      const red = 0.07 * Math.exp(-(((ax - 0.045) / 0.022) ** 2 + ((y + 0.025) / 0.022) ** 2)) * smooth(0.0, 0.05, z)
        + 0.08 * Math.exp(-((ax / 0.012) ** 2 + ((y + 0.026) / 0.012) ** 2 + ((z - 0.106) / 0.012) ** 2));
      c = mixc(c, [c[0] * 1.02, c[1] * 0.78, c[2] * 0.74], red * 2.2);
      const neck = smooth(-0.1, -0.2, y);
      c = scl(c, (1 - 0.06 * neck) * lerp(0.8, 1, ao));
      return c;
    },
    weights: p => {
      const w = W.torso(p);
      if (!ctx.jaw) return w;
      const hy = (p[1] - HF.O[1]) / HF.s, hz = (p[2] - HF.O[2]) / HF.s, hx = Math.abs(p[0]) / HF.s;
      const wj = smooth(-0.051, -0.063, hy) * smooth(0.0, 0.035, hz) * (1 - smooth(0.036, 0.052, hx)) * (1 - smooth(-0.1, -0.115, hy));
      if (wj <= 0) return w;
      return w.map(q => [q[0], q[1] * (1 - wj)]).concat([[ctx.rig.idx.jaw, wj]]);
    },
  });
  return HF;
}

export function buildEars(G, ctx, HF, HA) {
  const S = ctx.S, W = ctx.W;
  const skin = ctx.skinCol || S.skin;
  for (const m of [1, -1]) {
    const s = HF.s;
    const c = [HF.O[0] + m * 0.0695 * s, HF.O[1] - 0.006 * s, HF.O[2] - 0.016 * s];
    // ear frame: outward normal tilted forward, up axis tilted back
    const nO = norm([m * 0.93, 0.0, 0.36]), upA = norm([0, 0.97, -0.24]);
    const fw = norm(cross(upA, nO)).map(x => x * m);
    const ry = 0.027 * s, rf = 0.0165 * s;
    surf(G, {
      nu: L(ctx, 16), nv: L(ctx, 7), wrapU: true,
      f: (u, v) => {
        const ph = TAU * u, rr = clamp(v, 0, 1);
        // outline: egg shape, wider at the top
        const egg = 1 + 0.18 * Math.sin(ph);
        const px = Math.cos(ph) * rf * egg * (0.25 + 0.75 * Math.sqrt(rr)), py = Math.sin(ph) * ry * (0.25 + 0.75 * Math.sqrt(rr));
        // depth: rim raised, bowl recessed, attached to the head at the back
        const rim = 0.0035 * Math.exp(-(((rr - 0.86) / 0.12) ** 2));
        const bowl = -0.0042 * Math.exp(-(((rr - 0.25) / 0.3) ** 2)) * (Math.cos(ph) > -0.2 ? 1 : 0.6);
        const h = (0.0048 + rim + bowl) * s;
        return add(add(add(c, mul(fw, px)), mul(upA, py)), mul(nO, h - 0.004 * s));
      },
      out: () => madd(c, nO, -0.03),
      color: (p, u, v) => scl(mixc(skin, [skin[0] * 1.02, skin[1] * 0.84, skin[2] * 0.8], 0.3), lerp(0.55, 0.85, smooth(0.3, 0.9, v))),
      weights: () => [[ctx.rig.idx.head, 1]],
      extra: () => ({ aFace: [0, 0, 0, 0] }),
    });
  }
}

export function buildArmsHands(G, ctx) {
  const S = ctx.S, k = S.k, W = ctx.W;
  const { J, E } = C(ctx);
  const skin = ctx.skinCol || S.skin;
  const fk = (S.age ? 1.1 : 1) * k * (ctx.armScale || 1);
  for (const s of ['L', 'R']) {
    const m = s === 'L' ? 1 : -1;
    const El = J('foreArm' + s), Wr = J('hand' + s);
    const lF = len(sub(Wr, El));
    const d = norm(sub(Wr, El));
    const t0 = -0.04 * k, t1 = lF + 0.012 * k;
    // forearm: width along +z (thumb side), thickness along the palm normal
    const f = tubeF(madd(El, d, t0), madd(El, d, t1), [0, 0, 1], (ph, v) => {
      const t = lerp(t0, t1, v);
      const [rw, rt] = FOREARM(t / lF * 0.245);
      // muscle bulge on the thumb-side top near the elbow
      const mus = 0.0035 * Math.exp(-((((t / lF) - 0.18) / 0.15) ** 2)) * Math.max(0, Math.cos(ph + 0.6));
      return [(rw * fk + mus) * Math.cos(ph), (rt * fk + mus * 0.5) * Math.sin(ph) * m];
    });
    surf(G, {
      nu: L(ctx, 18), nv: L(ctx, 12), wrapU: true, f,
      out: (u, v) => madd(El, d, lerp(t0, t1, v)),
      color: () => skin,
      weights: p => W.arm(p, s),
      extra: () => ({ aFace: [0, 0, 0, 0] }),
    });
    // palm
    const n = [-m * Math.cos(35 * Math.PI / 180), -Math.sin(35 * Math.PI / 180), 0];
    const fz = [0, 0, 1];
    const hs = ctx.P.hand;
    const Tp = table([
      // t, half-width (thumb dir), half-thickness, shift thumb-ward, shift palm-ward
      [-0.006, 0.0272, 0.0182, 0.0, 0.0], [0.015, 0.0305, 0.0192, 0.0015, 0.0006], [0.045, 0.035, 0.0182, 0.0005, 0.001],
      [0.072, 0.0382, 0.0158, -0.0012, 0.0008], [0.088, 0.0388, 0.014, -0.0018, 0.0002], [0.1, 0.0345, 0.011, -0.002, -0.0004],
      [0.108, 0.022, 0.006, -0.002, -0.0006], [0.112, 0.008, 0.003, -0.002, -0.0006],
    ]);
    const pa = (ctx.mitten ? 0.142 : 0.112) * hs;
    const fp = tubeF(madd(Wr, d, -0.006 * hs), madd(Wr, d, pa), fz, (ph, v) => {
      const t = ctx.mitten ? (v < 0.7 ? lerp(-0.006, 0.088, v / 0.7) : lerp(0.088, 0.112, Math.pow((v - 0.7) / 0.3, 1.6))) : lerp(-0.006, 0.112, v);
      let [w, th, sh, sp] = Tp(t);
      // ph: 0 = thumb side, pi/2 = palm side (left hand; mirrored for right)
      const r = sup(ph, 2.7);
      let x = Math.cos(ph) * w * r, y = Math.sin(ph) * th * r;
      const palmSide = Math.max(0, Math.sin(ph)), thumbSide = Math.max(0, Math.cos(ph));
      // thenar and hypothenar pads
      y += 0.0078 * palmSide * Math.exp(-(((t - 0.028) / 0.03) ** 2)) * Math.exp(-(((Math.cos(ph) - 0.55) / 0.45) ** 2));
      y += 0.0028 * palmSide * Math.exp(-(((t - 0.045) / 0.03) ** 2)) * Math.exp(-(((Math.cos(ph) + 0.6) / 0.4) ** 2));
      // knuckles on the back
      const back = Math.max(0, -Math.sin(ph));
      y -= 0.0018 * back * Math.exp(-(((t - 0.089) / 0.009) ** 2)) * (0.6 + 0.4 * Math.cos(x / 0.0095 * Math.PI));
      return [(x + sh) * hs, (y + sp) * hs * m];
    });
    surf(G, {
      nu: L(ctx, 20), nv: L(ctx, 10), wrapU: true, f: fp,
      out: (u, v) => madd(Wr, d, lerp(-0.006, 0.1, v) * hs),
      color: (p, u, v) => {
        const palm = Math.max(0, Math.sin(u * TAU));
        return mixc(skin, [skin[0] * 1.02, skin[1] * 0.86, skin[2] * 0.82], palm * 0.35);
      },
      weights: p => {
        const t = dot(sub(p, Wr), d);
        return [[ctx.rig.idx['foreArm' + s], 1 - smooth(-0.02, 0.012, t)], [ctx.rig.idx['hand' + s], smooth(-0.02, 0.012, t)]];
      },
      extra: () => ({ aFace: [0, 0, 0, 0] }),
    });
    // fingers and thumb
    const FR = { thumb: [0.0138, 0.0097, 0.0084], index: [0.0089, 0.0076, 0.0063], middle: [0.0093, 0.0079, 0.0065], ring: [0.0088, 0.0075, 0.0062], pinky: [0.0078, 0.0067, 0.0057] };
    for (const fn of (ctx.mitten ? ['thumb'] : ['thumb', 'index', 'middle', 'ring', 'pinky'])) {
      const P0 = J(fn + '1' + s), P1 = J(fn + '2' + s), P2 = J(fn + '3' + s), P3 = E(fn + '3' + s);
      const dir0 = norm(sub(P1, P0));
      const start = madd(P0, dir0, fn === 'thumb' ? -0.012 * hs : -0.006 * hs);
      const pts = [start, P0, P1, P2, P3];
      // dorsal reference: fingers' nails face away from the palm; the thumb's nail faces out and forward
      const dors = fn === 'thumb' ? norm(add(mul(n, -0.35), [0, 0, 0.0]).map((x, i) => x + [m * Math.cos(35 * Math.PI / 180) * -0.2, 0.25, 0.35][i])) : mul(n, -1);
      const radii = FR[fn].map(r => r * hs * (S.age ? 1.05 : 1) * (ctx.fingerScale || 1));
      const f2 = pathTubeF(pts, dors, (ph, v, T) => {
        const sd = v * T; // distance along
        const L0 = len(sub(P0, start)), L1 = L0 + len(sub(P1, P0)), L2 = L1 + len(sub(P2, P1));
        let r = sd < L1 ? lerp(radii[0], radii[1], smooth(L0, L1, sd)) : sd < L2 ? lerp(radii[1], radii[2], smooth(L1, L2, sd)) : radii[2];
        // fingertip cap
        const tipR = radii[2] * 1.05;
        const fromTip = T - sd;
        if (fromTip < tipR) r *= Math.sqrt(clamp(1 - ((tipR - fromTip) / tipR) ** 2, 0, 1));
        // knuckle bumps (dorsal = cos(ph) > 0)
        const dors1 = Math.max(0, Math.cos(ph));
        const kn = 0.0012 * (Math.exp(-(((sd - L1) / 0.004) ** 2)) + Math.exp(-(((sd - L2) / 0.0035) ** 2))) * dors1;
        // palm-side creases
        const cr = -0.0007 * (Math.exp(-(((sd - L1) / 0.002) ** 2)) + Math.exp(-(((sd - L2) / 0.002) ** 2))) * Math.max(0, -Math.cos(ph));
        // nail flattening
        const nailZone = smooth(L2 + 0.002, L2 + 0.006, sd) * smooth(0.25, 0.75, Math.cos(ph));
        const rr = r + kn + cr - nailZone * 0.0008;
        return [Math.cos(ph) * rr * 0.94, Math.sin(ph) * rr * 1.06];
      });
      const T = f2.L;
      // rows: the last 4 (2 at low LOD) are packed into the rounded fingertip so it is a cap, not a cone
      const nvF = L(ctx, fn === 'thumb' ? 13 : 14), nTip = ctx.lod && ctx.lod < 0.8 ? 2 : 4;
      const vTip = 1 - Math.min(0.3, (radii[2] * 1.05 * 1.35) / T), jTip = (nvF - nTip) / nvF;
      const wv = v => v <= jTip ? v / jTip * vTip : vTip + (1 - vTip) * Math.sin((v - jTip) / (1 - jTip) * Math.PI / 2);
      surf(G, {
        nu: L(ctx, 8, 5), nv: nvF, wrapU: true, f: f2, vw: wv, tipNormal: () => norm(sub(P3, P2)),
        out: (u, v) => { const sd = clamp(v) * T; let acc = 0; for (let i = 1; i < pts.length; i++) { const l = len(sub(pts[i], pts[i - 1])); if (sd <= acc + l) return madd(pts[i - 1], norm(sub(pts[i], pts[i - 1])), sd - acc); acc += l; } return P3; },
        color: (p, u, v) => {
          const sd = v * T;
          const L2 = len(sub(P0, start)) + len(sub(P1, P0)) + len(sub(P2, P1));
          const nail = smooth(L2 + 0.0025, L2 + 0.006, sd) * smooth(0.35, 0.8, Math.cos(u * TAU)) * (1 - smooth(T - 0.0025, T - 0.0005, sd));
          // knuckle creases slightly darker, fingertips a touch redder, nails pale pink
          const crease = Math.exp(-(((sd - L2) / 0.004) ** 2)) * 0.6 + Math.exp(-(((sd - len(sub(P0, start)) - len(sub(P1, P0))) / 0.004) ** 2)) * 0.6;
          let c = mixc(skin, [skin[0] * 1.03, skin[1] * 0.85, skin[2] * 0.82], 0.25 * Math.max(0, -Math.cos(u * TAU)) + 0.18 * smooth(T - 0.012, T, sd));
          c = scl(c, 1 - 0.07 * crease);
          c = mixc(c, [Math.min(1, skin[0] * 1.1), skin[1] * 0.93, skin[2] * 0.95], nail * 0.95);
          return c;
        },
        weights: p => ctx.W.seg(p, ['hand' + s, fn + '1' + s, fn + '2' + s, fn + '3' + s], 7, 0.003),
        extra: (p, u, v) => {
          const sd = v * T, L2 = len(sub(P0, start)) + len(sub(P1, P0)) + len(sub(P2, P1));
          const nail = smooth(L2 + 0.0025, L2 + 0.006, sd) * smooth(0.35, 0.8, Math.cos(u * TAU));
          return { aFace: [0, 0, nail, -1] };
        },
      });
    }
  }
}
