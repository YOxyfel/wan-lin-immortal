// Small shared helpers for the hero character modules (hero*.js): math, seeded random, value noise.
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const band = (a, b, c, d, x) => smooth(a, b, x) * (1 - smooth(c, d, x));
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a0, b0) => a0 + (b0 - a0) * next();
  next.sign = () => (next() < 0.5 ? -1 : 1);
  return next;
}

function hash3(ix, iy, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// 3D value noise in [0,1]
export function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const a0 = l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), ux), a1 = l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), ux);
  const b0 = l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), ux), b1 = l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), ux);
  return l(l(a0, a1, uy), l(b0, b1, uy), uz);
}
export const snoise3 = (x, y, z) => vnoise3(x, y, z) * 2 - 1;
export function fbm3(x, y, z, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * snoise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
// periodic 2D value noise on a [0,P)x[0,Q) lattice (tileable textures)
export function pnoise2(x, y, P, Q, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const m = (v, p) => ((v % p) + p) % p;
  const h = (i, j) => hash3(m(i, P), m(j, Q), seed);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}
