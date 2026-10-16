// Procedural textures for the flora: generated once at runtime (tileable value/cellular noise), cached.
//  ancientBark(): albedo + normal + low-res height (also used to displace the hero trunk so geometry and texture agree)
//  pineBark(), rockTex(), mossTex(), floorTex(), culmTex(), cliffTex()
//  foliageAtlas(): 2048² DATA texture: R shade, G per-leaf random, B leaf(1)/twig(0), A coverage; cells via ATLAS.
import * as THREE from 'three';
import { rng } from './util.js';

const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const TAUX = Math.PI * 2;
const hex = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// ------------------------------------------------------------------ tileable noise
function tnoise(seed) {
  const N = 256, g = new Float32Array(N * N), r = rng(seed);
  for (let i = 0; i < N * N; i++) g[i] = r();
  const at = (x, y, px, py) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = g[y0 * N + x0], b = g[y0 * N + x1], c = g[y1 * N + x0], d = g[y1 * N + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (u, v, fx, fy, oct = 4, gain = 0.5) => {
    let s = 0, a = 1, n = 0;
    for (let o = 0; o < oct; o++) { s += at(u * fx, v * fy, fx, fy) * a; n += a; a *= gain; fx *= 2; fy *= 2; }
    return s / n;
  };
  return { at, fbm };
}
function worley(seed, cx, cy) {
  const r = rng(seed), pts = new Float32Array(cx * cy * 2);
  for (let i = 0; i < cx * cy; i++) { pts[i * 2] = 0.1 + r() * 0.8; pts[i * 2 + 1] = 0.1 + r() * 0.8; }
  const out = [0, 0, 0];
  return (u, v) => {
    const x = u * cx, y = v * cy, xi = Math.floor(x), yi = Math.floor(y);
    let f1 = 1e9, f2 = 1e9, id = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gx = xi + dx, gy = yi + dy;
      const k = (((gy % cy) + cy) % cy) * cx + (((gx % cx) + cx) % cx);
      const px = gx + pts[k * 2] - x, py = gy + pts[k * 2 + 1] - y;
      const d = px * px + py * py;
      if (d < f1) { f2 = f1; f1 = d; id = k; } else if (d < f2) f2 = d;
    }
    out[0] = Math.sqrt(f1); out[1] = Math.sqrt(f2); out[2] = id;
    return out;
  };
}
function normalFromHeight(h, W, H, strength) {
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const ym = ((y - 1 + H) % H) * W, yp = ((y + 1) % H) * W, yr = y * W;
    for (let x = 0; x < W; x++) {
      const xm = (x - 1 + W) % W, xp = (x + 1) % W;
      const dx = (h[yr + xp] - h[yr + xm]) * strength, dy = (h[yp + x] - h[ym + x]) * strength;
      const l = Math.hypot(dx, dy, 1), k = (yr + x) * 4;
      out[k] = (-dx / l * 0.5 + 0.5) * 255; out[k + 1] = (-dy / l * 0.5 + 0.5) * 255; out[k + 2] = (1 / l * 0.5 + 0.5) * 255; out[k + 3] = 255;
    }
  }
  return out;
}
function dataTex(data, W, H, srgb, aniso = 4) {
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = aniso; t.needsUpdate = true;
  return t;
}
const put = (a, k, c, al = 255) => { a[k] = clamp01(c[0]) * 255; a[k + 1] = clamp01(c[1]) * 255; a[k + 2] = clamp01(c[2]) * 255; a[k + 3] = al; };
function downsample(h, W, H, f) {
  const w = W / f, hh = H / f, o = new Float32Array(w * hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += h[(y * f + j) * W + x * f + i];
    o[y * w + x] = s / (f * f);
  }
  return { data: o, W: w, H: hh, sample(u, v) { // bilinear, wrapping
    const x = (u * w - 0.5), y = (v * hh - 0.5), xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const x0 = ((xi % w) + w) % w, x1 = (x0 + 1) % w, y0 = ((yi % hh) + hh) % hh, y1 = (y0 + 1) % hh;
    const a = o[y0 * w + x0], b = o[y0 * w + x1], c = o[y1 * w + x0], d = o[y1 * w + x1];
    return mix(mix(a, b, fx), mix(c, d, fx), fy);
  } };
}

// ------------------------------------------------------------------ the ancient tree's bark: long braided ridges, deep furrows
// tile = 1.2 m (u) x 2.4 m (v)
export const ANCIENT_TILE = [1.2, 2.4];
export function ancientBark() {
  return once('ancientBark', () => {
    const W = 1024, H = 1024;
    const n = tnoise(101), m = tnoise(202), r = rng(4242);
    const h = new Float32Array(W * H), alb = new Uint8Array(W * H * 4);
    const cPlate = hex(0xb2a48a), cPlate2 = hex(0x958268), cWarm = hex(0xa88a5e), cFur = hex(0x3b2a1b), cLich = hex(0xb8bc9c), cDark = hex(0x5e4a36);
    // braided fissures: wandering vertical grooves (periodic in v), widths breathing so ridges merge and split
    const NF = 19, F = [];
    for (let i = 0; i < NF; i++) F.push({ x0: (i + 0.5 + (r() - 0.5) * 0.6) / NF, a1: 0.02 + r() * 0.025, k1: 1 + Math.floor(r() * 2), p1: r(), a2: 0.01 + r() * 0.012, k2: 3 + Math.floor(r() * 3), p2: r(), w: 0.014 + r() * 0.016, kw: 2 + Math.floor(r() * 3), pw: r() });
    const fx = (f, v) => f.x0 + f.a1 * Math.sin(TAUX * (v * f.k1 + f.p1)) + f.a2 * Math.sin(TAUX * (v * f.k2 + f.p2));
    const fw = (f, v) => f.w * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(TAUX * (v * f.kw + f.pw)), 0.7));
    // horizontal checks on the plates between fissures
    const checks = [];
    for (let i = 0; i < NF; i++) { const c = []; const nk = 3 + Math.floor(r() * 4); for (let k = 0; k < nk; k++) c.push({ v: r(), w: 0.005 + r() * 0.006 }); checks.push(c); }
    const xs = new Float32Array(NF), ws = new Float32Array(NF);
    // slow colour fields on a coarse grid (bilinear lookup), the expensive part of the old per-pixel loop
    const CW = 128, CH = 128, cf = new Float32Array(CW * CH * 4);
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
      const u = i / CW, v = j / CH, k = (j * CW + i) * 4;
      cf[k] = m.fbm(u + 0.5, v, 6, 2, 3); cf[k + 1] = n.fbm(u, v + 0.3, 5, 3, 3); cf[k + 2] = m.fbm(u + 0.3, v, 10, 5, 4); cf[k + 3] = n.fbm(u, v + 0.5, 3, 7, 3);
    }
    const cfAt = (u, v, c) => { const x = u * CW - 0.5, y = v * CH - 0.5, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const x0 = (xi + CW) % CW, x1 = (x0 + 1) % CW, y0 = (yi + CH) % CH, y1 = (y0 + 1) % CH; const a = cf[(y0 * CW + x0) * 4 + c], b = cf[(y0 * CW + x1) * 4 + c], cc = cf[(y1 * CW + x0) * 4 + c], d = cf[(y1 * CW + x1) * 4 + c]; return mix(mix(a, b, fx), mix(cc, d, fx), fy); };
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let i = 0; i < NF; i++) { xs[i] = fx(F[i], v); ws[i] = fw(F[i], v); }
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const wob = (n.at(u * 8, v * 6, 8, 6) - 0.5) * 0.012;
        let best = 1e9, bi = 0, prof = 1;
        const i0 = Math.floor(u * NF) - 2;
        for (let ii = i0; ii <= i0 + 4; ii++) {
          const i = (ii + NF) % NF;
          let d = u + wob - xs[i]; d -= Math.round(d);
          const ad = Math.abs(d);
          const pr = sstep(ws[i] * 0.25, ws[i] * 2.6, ad);
          if (pr < prof) prof = pr;
          if (ad < best) { best = ad; bi = d > 0 ? i : (i + NF - 1) % NF; }
        }
        let crack = 0;
        for (const c of checks[bi]) { let dv = v - c.v; dv -= Math.round(dv); crack = Math.max(crack, 1 - sstep(0, c.w, Math.abs(dv + (u - xs[bi]) * 0.25))); }
        const ridge = Math.pow(prof, 0.6);
        const bump = n.fbm(u, v, 16, 6, 2), fine = m.at(u * 96, v * 48, 96, 48);
        const hh = ridge * 0.74 * (1 - crack * 0.55) + bump * 0.14 + fine * 0.08;
        h[y * W + x] = hh;
        const tone = (bi * 0.618) % 1;
        let col = mixc(cPlate2, cPlate, sstep(0.25, 0.8, bump * 0.7 + tone * 0.5));
        col = mixc(col, cWarm, sstep(0.55, 0.8, cfAt(u, v, 1)) * 0.55);
        const lich = sstep(0.6, 0.66, cfAt(u, v, 2)) * sstep(0.5, 0.8, ridge);
        col = mixc(col, cLich, lich * 0.7);
        col = mixc(col, cDark, sstep(0.5, 0.75, cfAt(u, v, 3)) * 0.4);
        col = mixc(cFur, col, sstep(0.06, 0.5, hh));
        const k = 0.84 + fine * 0.32;
        put(alb, (y * W + x) * 4, [col[0] * k, col[1] * k, col[2] * k]);
      }
    }
    const nrm = normalFromHeight(h, W, H, 26);
    return { map: dataTex(alb, W, H, true, 8), normal: dataTex(nrm, W, H, false, 8), height: downsample(h, W, H, 8), tile: ANCIENT_TILE };
  });
}

// ------------------------------------------------------------------ pine bark: reddish-grey plates. tile = 0.6 x 1.2 m
export function pineBark() {
  return once('pineBark', () => {
    const W = 512, H = 512, n = tnoise(303), w = worley(31, 5, 5), w2 = worley(37, 9, 11);
    const h = new Float32Array(W * H), alb = new Uint8Array(W * H * 4);
    const cA = hex(0x84705f), cB = hex(0x9a7058), cC = hex(0x6e6258), cCrack = hex(0x22180f);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const wu = (n.fbm(u, v, 4, 4, 3) - 0.5) * 0.08, wv = (n.fbm(u + 0.5, v, 4, 4, 3) - 0.5) * 0.08;
        const A = w(u + wu, v + wv), e = A[1] - A[0];
        const B = w2(u + wu, v + wv), e2 = B[1] - B[0];
        const plate = sstep(0.0, 0.16, e), flake = sstep(0.0, 0.1, e2);
        const fine = n.fbm(u, v, 48, 48, 3);
        const hh = plate * (0.7 + 0.2 * flake) + fine * 0.1 + (A[0]) * 0.12;
        h[y * W + x] = hh;
        const tone = (A[2] * 0.7548) % 1;
        let c = mixc(cA, cB, sstep(0.3, 0.9, tone));
        c = mixc(c, cC, sstep(0.55, 0.75, n.fbm(u, v, 3, 3, 3)) * 0.6);
        c = mixc(cCrack, c, sstep(0.05, 0.55, plate * (0.75 + 0.25 * flake)));
        const k = 0.8 + fine * 0.4;
        put(alb, (y * W + x) * 4, [c[0] * k, c[1] * k, c[2] * k]);
      }
    }
    return { map: dataTex(alb, W, H, true), normal: dataTex(normalFromHeight(h, W, H, 14), W, H, false), tile: [0.6, 1.2] };
  });
}

// ------------------------------------------------------------------ rock: weathered grey stone with cracks. tile 2.5 m (triplanar)
export function rockTex() {
  return once('rock', () => {
    const W = 512, H = 512, n = tnoise(404), w = worley(41, 6, 6), w2 = worley(43, 15, 15);
    const h = new Float32Array(W * H), alb = new Uint8Array(W * H * 4);
    const cA = hex(0x8f8c84), cB = hex(0xa6a093), cC = hex(0x737872), cK = hex(0x3e3a35);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const wu = (n.fbm(u, v, 5, 5, 3) - 0.5) * 0.1, wv = (n.fbm(u + 0.4, v + 0.2, 5, 5, 3) - 0.5) * 0.1;
        const A = w(u + wu, v + wv), e = A[1] - A[0];
        const B = w2(u + wu, v + wv), e2 = B[1] - B[0];
        const crack = 1 - sstep(0.0, 0.05, e), crack2 = 1 - sstep(0.0, 0.035, e2);
        const big = n.fbm(u, v, 4, 4, 5), fine = n.fbm(u, v, 64, 64, 2);
        const hh = big * 0.65 + fine * 0.15 - crack * 0.22 - crack2 * 0.08 * sstep(0.4, 0.6, big) + (1 - A[0]) * 0.06;
        h[y * W + x] = hh;
        let c = mixc(cA, cB, sstep(0.35, 0.7, big));
        c = mixc(c, cC, sstep(0.5, 0.7, n.fbm(u + 0.7, v, 8, 8, 3)) * 0.7);
        c = mixc(c, cK, crack * 0.4 + crack2 * 0.15);
        const speck = sstep(0.72, 0.8, n.fbm(u, v, 128, 128, 1));
        const k = 0.86 + fine * 0.28 - speck * 0.15;
        put(alb, (y * W + x) * 4, [c[0] * k, c[1] * k, c[2] * k]);
      }
    }
    return { map: dataTex(alb, W, H, true), normal: dataTex(normalFromHeight(h, W, H, 9), W, H, false) };
  });
}

// ------------------------------------------------------------------ cliff limestone: vertical runnels and water staining (tile 24 x 48 m)
export function cliffTex() {
  return once('cliff', () => {
    const W = 512, H = 512, n = tnoise(505), w = worley(51, 12, 3);
    const h = new Float32Array(W * H), alb = new Uint8Array(W * H * 4);
    const cA = hex(0x9a9d9a), cB = hex(0x7c807e), cStain = hex(0x3e4240), cWarm = hex(0x9a8a72);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const wu = (n.fbm(u, v, 3, 6, 3) - 0.5) * 0.06;
        const A = w(u + wu, v), e = A[1] - A[0];
        const runnel = n.fbm(u + wu, v, 40, 3, 4);
        const big = n.fbm(u, v, 3, 2, 4);
        const hh = sstep(0.0, 0.3, e) * 0.5 + runnel * 0.4 + big * 0.2;
        h[y * W + x] = hh;
        let c = mixc(cB, cA, sstep(0.3, 0.7, big + runnel * 0.3));
        c = mixc(c, cWarm, sstep(0.55, 0.75, n.fbm(u + 0.2, v, 4, 3, 3)) * 0.45);
        c = mixc(c, cStain, sstep(0.45, 0.8, n.fbm(u, v * 0.5, 24, 2, 3)) * 0.55 + (1 - sstep(0, 0.12, e)) * 0.4);
        put(alb, (y * W + x) * 4, c);
      }
    }
    return { map: dataTex(alb, W, H, true), normal: dataTex(normalFromHeight(h, W, H, 6), W, H, false) };
  });
}

// ------------------------------------------------------------------ moss: granular yellow-green cushion (tile 0.5 m)
export function mossTex() {
  return once('moss', () => {
    const W = 256, H = 256, n = tnoise(606);
    const alb = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const a = n.fbm(u, v, 32, 32, 3), b = n.fbm(u, v, 6, 6, 3), c = n.at(u * 128, v * 128, 128, 128);
      // stored as data: R brightness, G hue shift, B unused
      const k = (y * W + x) * 4;
      alb[k] = clamp01(a * 0.8 + c * 0.45 - 0.15) * 255;
      alb[k + 1] = clamp01(b * 1.2 - 0.1) * 255;
      alb[k + 2] = clamp01(c) * 255;
      alb[k + 3] = 255;
    }
    return dataTex(alb, W, H, false, 4);
  });
}

// ------------------------------------------------------------------ forest floor: humus, needles, twigs, leaf bits (tile 4 m)
export function floorTex() {
  return once('floor', () => {
    const W = 1024, H = 1024, n = tnoise(707), r = rng(708);
    const h = new Float32Array(W * H), alb = new Uint8Array(W * H * 4);
    const cDirt = hex(0x5a4733), cHum = hex(0x2c2219), cDry = hex(0x7a6448), cGreen = hex(0x4a5226);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const a = n.fbm(u, v, 8, 8, 5), b = n.fbm(u + 0.3, v, 32, 32, 3), f = n.at(u * 256, v * 256, 256, 256);
      let c = mixc(cHum, cDirt, sstep(0.3, 0.7, a));
      c = mixc(c, cDry, sstep(0.55, 0.8, b) * 0.5);
      c = mixc(c, cGreen, sstep(0.62, 0.75, n.fbm(u, v + 0.5, 6, 6, 3)) * 0.35);
      const k = 0.8 + f * 0.35;
      h[y * W + x] = a * 0.4 + f * 0.2;
      put(alb, (y * W + x) * 4, [c[0] * k, c[1] * k, c[2] * k]);
    }
    // strokes: needles, twigs, leaf fragments, pebbles (drawn on a canvas over the base, wrapped)
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.putImageData(new ImageData(new Uint8ClampedArray(alb.buffer), W, H), 0, 0);
    let cx0 = 0, cy0 = 0;
    const wrapDraw = (fn) => { for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { if ((ox < 0 && cx0 < W - 40) || (ox > 0 && cx0 > 40) || (oy < 0 && cy0 < H - 40) || (oy > 0 && cy0 > 40)) continue; x.save(); x.translate(ox, oy); fn(); x.restore(); } };
    for (let i = 0; i < 2600; i++) {
      const px = r() * W, py = r() * H, a = r() * Math.PI * 2, L = 6 + r() * 18; cx0 = px; cy0 = py;
      const tone = r();
      const col = tone < 0.5 ? `rgba(${120 + r() * 50},${90 + r() * 30},${55 + r() * 20},0.85)` : `rgba(${50 + r() * 30},${38 + r() * 20},${26 + r() * 14},0.8)`;
      wrapDraw(() => { x.strokeStyle = col; x.lineWidth = 0.8 + r() * 0.8; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.3) * L * 0.5, py + Math.sin(a + 0.3) * L * 0.5, px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke(); });
    }
    for (let i = 0; i < 260; i++) {
      const px = r() * W, py = r() * H, a = r() * Math.PI, L = 6 + r() * 12, wd = L * (0.35 + r() * 0.2); cx0 = px; cy0 = py;
      const col = r() < 0.6 ? `rgba(${95 + r() * 50},${60 + r() * 30},${30 + r() * 15},0.9)` : `rgba(${60 + r() * 20},${45 + r() * 15},${30 + r() * 10},0.9)`;
      wrapDraw(() => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, L, wd, a, 0, Math.PI * 2); x.fill(); });
    }
    for (let i = 0; i < 340; i++) {
      const px = r() * W, py = r() * H, s = 1.2 + r() * 3.5, g = 90 + r() * 70; cx0 = px; cy0 = py;
      wrapDraw(() => { x.fillStyle = `rgba(${g},${g * 0.96},${g * 0.9},0.95)`; x.beginPath(); x.ellipse(px, py, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); x.fill(); });
    }
    const img = x.getImageData(0, 0, W, H).data;
    const out = new Uint8Array(img.buffer.slice(0));
    for (let i = 0; i < W * H; i++) { const l = (img[i * 4] + img[i * 4 + 1] + img[i * 4 + 2]) / 765; h[i] = h[i] * 0.6 + l * 0.5; }
    return { map: dataTex(out, W, H, true, 8), normal: dataTex(normalFromHeight(h, W, H, 7), W, H, false, 8) };
  });
}

// ------------------------------------------------------------------ bamboo culm: one internode per v unit (node at v = 0)
export function culmTex() {
  return once('culm', () => {
    const W = 128, H = 512, n = tnoise(808);
    const alb = new Uint8Array(W * H * 4);
    const cG = hex(0x5c7a2c), cG2 = hex(0x7d8f3a), cDark = hex(0x2f3f17), cWax = hex(0xb4b9a0), cOld = hex(0x8c8350);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const streak = n.fbm(u, v, 32, 1, 3), blot = n.fbm(u, v, 4, 2, 3);
      let c = mixc(cG, cG2, sstep(0.3, 0.75, streak * 0.6 + blot * 0.5));
      c = mixc(c, cOld, sstep(0.6, 0.8, n.fbm(u + 0.5, v, 3, 2, 3)) * 0.5);
      // node ridge (v ~ 0 / 1) dark, waxy ring just below the node
      const dn = Math.min(v, 1 - v);
      c = mixc(c, cWax, sstep(0.06, 0.02, Math.abs(v - 0.94)) * 0.6);
      c = mixc(c, cDark, sstep(0.025, 0.0, dn) * 0.85);
      const k = 0.85 + streak * 0.3;
      put(alb, (y * W + x) * 4, [c[0] * k, c[1] * k, c[2] * k]);
    }
    return dataTex(alb, W, H, true, 8);
  });
}

// ------------------------------------------------------------------ foliage atlas
// 4x4 cells of 512 px. Card UV rect for a cell (base of the card at the cell's bottom edge):
export const ATLAS = {
  broadA: [0, 0], broadB: [1, 0], mapleA: [2, 0], mapleB: [3, 0],
  pineTop: [0, 1], pineSide: [1, 1], bambooA: [2, 1], bambooB: [3, 1],
  fern: [0, 2, 1, 2], grassA: [1, 2], shrub: [2, 2], mapleLeaf: [3, 2],
  grassB: [1, 3], broadLeaf: [2, 3], clover: [3, 3],
};
export function cellRect(name, inset = 0.004) {
  const [cx, cy, w = 1, hgt = 1] = ATLAS[name];
  // DataTexture (flipY=false): canvas top = v 0. Card base -> cell bottom (larger v).
  return [(cx + inset) / 4, (cy + hgt - inset) / 4, (cx + w - inset) / 4, (cy + inset) / 4];
}

function leafColor(lum, rnd, leaf = 1) { return `rgb(${Math.round(clamp01(lum) * 255)},${Math.round(clamp01(rnd) * 255)},${leaf ? 255 : 0})`; }

// a pointed elliptic leaf from (0,0) along +y (canvas y goes down, so we draw toward -y)
function drawLeaf(x, len, wid, lum, rnd, { tip = 0.9, base = 0.35, vein = true, serr = 0, curve = 0 } = {}) {
  x.beginPath();
  x.moveTo(0, 0);
  const w = wid / 2;
  if (serr > 0) {
    const N = 14, pts = [];
    for (let i = 0; i <= N; i++) { const t = i / N; const prof = Math.sin(Math.PI * Math.pow(t, base * 1.4 + 0.3)) * (1 - Math.pow(t, 6) * 0.3); pts.push([t, prof]); }
    for (const s of [1, -1]) {
      const seq = s === 1 ? pts : pts.slice().reverse();
      for (const [t, p] of seq) { const j = (Math.round(t * N) % 2) ? serr : 0; x.lineTo(s * (w * p + j * w) + curve * t * t * len, -t * len); }
    }
  } else {
    x.bezierCurveTo(w * 1.3, -len * base, w * tip, -len * 0.8, curve * len, -len);
    x.bezierCurveTo(-w * tip + curve * len * 0.5, -len * 0.8, -w * 1.3, -len * base, 0, 0);
  }
  x.closePath();
  const g = x.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, leafColor(lum * 0.72, rnd)); g.addColorStop(0.45, leafColor(lum * 1.08, rnd)); g.addColorStop(0.55, leafColor(lum * 0.98, rnd)); g.addColorStop(1, leafColor(lum * 0.7, rnd));
  x.fillStyle = g; x.fill();
  if (vein) {
    x.strokeStyle = leafColor(lum * 0.62, rnd); x.lineWidth = Math.max(1, wid * 0.05);
    x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(curve * len * 0.4, -len * 0.5, curve * len, -len * 0.97); x.stroke();
    x.lineWidth = Math.max(0.6, wid * 0.025);
    for (let i = 1; i < 6; i++) { const t = i / 6.5; for (const s of [1, -1]) { x.beginPath(); x.moveTo(curve * len * t * t, -len * t); x.lineTo(s * w * 0.7 + curve * len * t * t, -len * (t + 0.12)); x.stroke(); } }
  }
}

// palmate maple leaf centred on the petiole tip, pointing along -y
function drawMaple(x, R, lum, rnd, lobes = 7) {
  const spread = lobes === 7 ? 2.35 : 2.0;
  const pts = [];
  for (let i = 0; i < lobes; i++) {
    const a = -spread / 2 + spread * i / (lobes - 1);
    const L = R * (1 - Math.pow(Math.abs(a) / (spread / 2), 2) * 0.45);
    const sinus = R * 0.28;
    const a0 = a - spread / (lobes - 1) / 2;
    if (i === 0) pts.push([Math.sin(a0 - 0.15) * sinus * 0.6, -Math.cos(a0 - 0.15) * sinus * 0.6]);
    else pts.push([Math.sin(a0) * sinus, -Math.cos(a0) * sinus]);
    // lobe: lanceolate with serrations
    const hw = 0.2;
    const N = 6;
    for (let k = 1; k <= N; k++) { const t = k / N; const ww = Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.1)) * hw * (1 - t * 0.6) + (k % 2) * 0.03; const rr = sinus + (L - sinus) * t; pts.push([Math.sin(a - ww) * rr, -Math.cos(a - ww) * rr]); }
    pts.push([Math.sin(a) * L * 1.04, -Math.cos(a) * L * 1.04]);
    for (let k = N; k >= 1; k--) { const t = k / N; const ww = Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.1)) * hw * (1 - t * 0.6) + (k % 2) * 0.03; const rr = sinus + (L - sinus) * t; pts.push([Math.sin(a + ww) * rr, -Math.cos(a + ww) * rr]); }
  }
  const aE = spread / 2 + spread / (lobes - 1) / 2;
  pts.push([Math.sin(aE + 0.15) * R * 0.17, -Math.cos(aE + 0.15) * R * 0.17]);
  x.beginPath(); x.moveTo(0, R * 0.05);
  for (const [px, py] of pts) x.lineTo(px, py);
  x.closePath();
  const g = x.createRadialGradient(0, 0, R * 0.05, 0, 0, R);
  g.addColorStop(0, leafColor(lum * 0.85, rnd)); g.addColorStop(0.5, leafColor(lum * 1.05, rnd)); g.addColorStop(1, leafColor(lum * 0.8, rnd));
  x.fillStyle = g; x.fill();
  x.strokeStyle = leafColor(lum * 0.6, rnd); x.lineWidth = Math.max(0.8, R * 0.025);
  for (let i = 0; i < lobes; i++) { const a = -spread / 2 + spread * i / (lobes - 1); const L = R * (1 - Math.pow(Math.abs(a) / (spread / 2), 2) * 0.45); x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.sin(a) * L * 0.92, -Math.cos(a) * L * 0.92); x.stroke(); }
}

function twig(x, pts, w0, w1, lum = 0.45) {
  x.strokeStyle = leafColor(lum, 0.5, 0); x.lineCap = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    x.lineWidth = mix(w0, w1, i / (pts.length - 1));
    x.beginPath(); x.moveTo(pts[i][0], pts[i][1]); x.lineTo(pts[i + 1][0], pts[i + 1][1]); x.stroke();
  }
}

export function foliageAtlas() {
  return once('atlas', () => {
    const S = 2048, C = 512;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const x = cv.getContext('2d', { willReadFrequently: true });
    const r = rng(9091);
    const cell = (name, fn) => {
      const [cx, cy, w = 1, h = 1] = ATLAS[name];
      x.save(); x.translate(cx * C, cy * C); x.beginPath(); x.rect(2, 2, w * C - 4, h * C - 4); x.clip();
      fn(w * C, h * C); x.restore();
    };
    // --- broadleaf sprays (camphor-like): branching twig, glossy ovate leaves
    const broad = (W, H, dense) => {
      const main = [[W * 0.5, H], [W * 0.48, H * 0.7], [W * 0.52, H * 0.4], [W * 0.5, H * 0.12]];
      twig(x, main, 9, 3);
      const sub = [];
      for (let i = 0; i < (dense ? 7 : 5); i++) {
        const t = 0.25 + i * 0.1, s = i % 2 ? 1 : -1;
        const y0 = H * (1 - t * 0.95), x0 = W * 0.5 + (r() - 0.5) * 6;
        const x1 = x0 + s * W * (0.22 + r() * 0.15), y1 = y0 - H * (0.12 + r() * 0.1);
        twig(x, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 + 6], [x1, y1]], 5, 2);
        sub.push([x1, y1, s]);
      }
      const leaves = [];
      for (const [sx, sy, s] of sub) for (let k = 0; k < (dense ? 7 : 5); k++) leaves.push([sx + (r() - 0.5) * 70, sy + (r() - 0.5) * 60, s * (0.3 + r() * 1.2) + (r() - 0.5)]);
      for (let k = 0; k < (dense ? 18 : 12); k++) { const t = r(); leaves.push([W * 0.5 + (r() - 0.5) * 60, H * (0.95 - t * 0.85), (r() - 0.5) * 3]); }
      leaves.sort(() => r() - 0.5);
      for (const [lx, ly, a] of leaves) {
        x.save(); x.translate(lx, ly); x.rotate(a);
        drawLeaf(x, 70 + r() * 55, 30 + r() * 18, 0.55 + r() * 0.35, r(), { tip: 0.7, base: 0.42, curve: (r() - 0.5) * 0.15 });
        x.restore();
      }
    };
    cell('broadA', (W, H) => broad(W, H, false));
    cell('broadB', (W, H) => broad(W, H, true));
    // --- maple sprays: slender twig, long petioles, 5-7 lobed leaves layered
    const maple = (W, H, n) => {
      const main = [[W * 0.5, H], [W * 0.46, H * 0.72], [W * 0.54, H * 0.45], [W * 0.5, H * 0.2]];
      twig(x, main, 7, 2.5, 0.35);
      const L = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const bx = W * 0.5 + (r() - 0.5) * 30, by = H * (0.92 - t * 0.7);
        const a = (i % 2 ? 1 : -1) * (0.5 + r() * 0.9) + (r() - 0.5) * 0.4;
        const pl = 40 + r() * 50;
        const tx = bx + Math.sin(a) * pl, ty = by - Math.cos(a) * pl;
        x.strokeStyle = leafColor(0.5, r(), 0); x.lineWidth = 2.2; x.beginPath(); x.moveTo(bx, by); x.lineTo(tx, ty); x.stroke();
        L.push([tx, ty, a + (r() - 0.5) * 0.5, 62 + r() * 46]);
      }
      L.push([W * 0.5, H * 0.18, (r() - 0.5) * 0.3, 70]);
      for (const [tx, ty, a, R] of L) { x.save(); x.translate(tx, ty); x.rotate(a); drawMaple(x, R, 0.6 + r() * 0.35, r(), r() < 0.7 ? 7 : 5); x.restore(); }
    };
    cell('mapleA', (W, H) => maple(W, H, 9));
    cell('mapleB', (W, H) => maple(W, H, 6));
    // --- pine: top view tuft (radial bursts) and side twig (bottle brush)
    const needle = (x0, y0, a, len, lum, rnd) => {
      x.strokeStyle = leafColor(lum, rnd); x.lineWidth = 1.6 + r() * 1.0; x.lineCap = 'round';
      const bend = (r() - 0.5) * 0.25;
      x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(x0 + Math.sin(a + bend) * len * 0.5, y0 - Math.cos(a + bend) * len * 0.5, x0 + Math.sin(a + bend * 2) * len, y0 - Math.cos(a + bend * 2) * len); x.stroke();
    };
    cell('pineTop', (W, H) => {
      const cx = W / 2, cy = H / 2;
      // a few sub-bursts around the centre so the pad reads as clustered fascicles
      const bursts = [[cx, cy, 1]];
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + r() * 0.4, d = 95 + r() * 60; bursts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.62]); }
      for (const b of bursts.slice(1)) twig(x, [[cx, cy], [b[0], b[1]]], 5, 2.5, 0.35);
      for (const [bx, by, s] of bursts) for (let k = 0; k < 70 * s; k++) { const a = r() * Math.PI * 2; needle(bx, by, a, (70 + r() * 90) * s + 30, 0.45 + r() * 0.5, r()); }
    });
    cell('pineSide', (W, H) => {
      const main = [[W * 0.5, H], [W * 0.5, H * 0.08]];
      twig(x, main, 8, 4, 0.35);
      for (let k = 0; k < 260; k++) { const t = Math.pow(r(), 0.8); const y0 = H * (0.96 - t * 0.86); const a = (r() < 0.5 ? -1 : 1) * (0.3 + r() * 1.1) - 0.0; needle(W * 0.5 + (r() - 0.5) * 8, y0, a * (1 - t * 0.4), 90 + r() * 110 * (1 - t * 0.5), 0.45 + r() * 0.5, r()); }
      for (let k = 0; k < 40; k++) needle(W * 0.5, H * 0.1, (r() - 0.5) * 1.2, 60 + r() * 60, 0.6 + r() * 0.3, r());
    });
    // --- bamboo sprays: thin twig, 5-9 lanceolate leaves fanning out
    const bamboo = (W, H, n) => {
      const path = [[W * 0.5, H], [W * 0.47, H * 0.75], [W * 0.52, H * 0.5], [W * 0.5, H * 0.3]];
      twig(x, path, 5, 2, 0.4);
      for (let i = 0; i < n; i++) {
        const t = 0.35 + 0.65 * i / (n - 1);
        const p = [W * 0.5 + (r() - 0.5) * 12, H * (1 - t * 0.72)];
        const a = (i % 2 ? 1 : -1) * (0.35 + r() * 0.9) + (r() - 0.5) * 0.3;
        x.save(); x.translate(p[0], p[1]); x.rotate(a);
        drawLeaf(x, 210 + r() * 110, 34 + r() * 14, 0.6 + r() * 0.35, r(), { tip: 0.45, base: 0.25, curve: (r() - 0.5) * 0.2 });
        x.restore();
      }
    };
    cell('bambooA', (W, H) => bamboo(W, H, 8));
    cell('bambooB', (W, H) => bamboo(W, H, 6));
    // --- fern frond (512 x 1024): rachis with paired pinnae, longest a third of the way up
    cell('fern', (W, H) => {
      const N = 30;
      const rach = t => [W * 0.5 + Math.sin(t * 2.2) * 14 * t, H * (0.985 - t * 0.96)];
      x.strokeStyle = leafColor(0.42, 0.5, 0); x.lineCap = 'round';
      for (let i = 0; i < 40; i++) { const a = rach(i / 40), b = rach((i + 1) / 40); x.lineWidth = mix(7, 2, i / 40); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
      for (let i = 0; i < N; i++) {
        const t = 0.06 + 0.92 * i / (N - 1);
        const env = Math.sin(Math.PI * Math.pow(Math.min(1, t * 1.05), 0.7)) * (1 - t * 0.25);
        const L = 225 * env + 12;
        const p = rach(t);
        for (const s of [1, -1]) {
          x.save(); x.translate(p[0], p[1] + s * 3); x.rotate(s * (1.1 - t * 0.35) + (r() - 0.5) * 0.08);
          drawLeaf(x, L, 22 + 10 * env, 0.55 + r() * 0.3, r(), { tip: 0.5, base: 0.3, vein: true, serr: 0.18, curve: s * -0.06 });
          x.restore();
        }
      }
    });
    // --- soft grass tufts: many slim arching blades, rounded soft tips
    const grass = (W, H, n, spread) => {
      for (let i = 0; i < n; i++) {
        const bx = W * 0.5 + (r() - 0.5) * 70, by = H - 4;
        const a = (r() - 0.5) * spread, L = H * (0.45 + r() * 0.5);
        const ex = bx + Math.sin(a) * L * 1.05, ey = by - Math.cos(a) * L * 0.9 + Math.abs(a) * L * 0.35;
        const cx1 = bx + Math.sin(a) * L * 0.35, cy1 = by - L * 0.85;
        const w0 = 9 + r() * 7, lum = 0.4 + r() * 0.55, rr = r();
        // blade as a filled tapered quad strip
        const N = 12, left = [], right = [];
        for (let k = 0; k <= N; k++) {
          const t = k / N, it = 1 - t;
          const px = it * it * bx + 2 * it * t * cx1 + t * t * ex, py = it * it * by + 2 * it * t * cy1 + t * t * ey;
          const dx = 2 * it * (cx1 - bx) + 2 * t * (ex - cx1), dy = 2 * it * (cy1 - by) + 2 * t * (ey - cy1);
          const l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, ww = w0 * 0.5 * (1 - Math.pow(t, 1.6) * 0.92);
          left.push([px + nx * ww, py + ny * ww]); right.push([px - nx * ww, py - ny * ww]);
        }
        x.beginPath(); x.moveTo(left[0][0], left[0][1]);
        for (const p of left) x.lineTo(p[0], p[1]);
        for (let k = right.length - 1; k >= 0; k--) x.lineTo(right[k][0], right[k][1]);
        x.closePath();
        const g = x.createLinearGradient(bx, by, ex, ey);
        g.addColorStop(0, leafColor(lum * 0.45, rr)); g.addColorStop(0.5, leafColor(lum * 0.9, rr)); g.addColorStop(1, leafColor(lum * 1.1, rr));
        x.fillStyle = g; x.fill();
      }
    };
    cell('grassA', (W, H) => grass(W, H, 46, 2.2));
    cell('grassB', (W, H) => grass(W, H, 34, 2.8));
    // --- shrub spray: many small rounded leaves
    cell('shrub', (W, H) => {
      twig(x, [[W * 0.5, H], [W * 0.5, H * 0.5], [W * 0.45, H * 0.15]], 6, 2);
      for (let i = 0; i < 6; i++) { const y0 = H * (0.85 - i * 0.12), s = i % 2 ? 1 : -1; twig(x, [[W * 0.5, y0], [W * 0.5 + s * W * 0.3, y0 - H * 0.1]], 3.5, 1.5); }
      for (let k = 0; k < 75; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * W * 0.4; x.save(); x.translate(W * 0.5 + Math.cos(a) * d, H * 0.5 + Math.sin(a) * d * 0.95); x.rotate(r() * 6.28); drawLeaf(x, 42 + r() * 30, 26 + r() * 10, 0.5 + r() * 0.45, r(), { tip: 0.9, base: 0.5 }); x.restore(); }
    });
    // --- single leaves for the ground
    cell('mapleLeaf', (W, H) => { x.save(); x.translate(W * 0.5, H * 0.66); x.strokeStyle = leafColor(0.5, 0.5, 0); x.lineWidth = 6; x.beginPath(); x.moveTo(0, 0); x.lineTo(4, H * 0.3); x.stroke(); drawMaple(x, W * 0.36, 0.85, 0.5, 7); x.restore(); });
    cell('broadLeaf', (W, H) => { x.save(); x.translate(W * 0.5, H * 0.92); drawLeaf(x, H * 0.84, W * 0.42, 0.85, 0.5, { tip: 0.75, base: 0.42, curve: 0.04 }); x.restore(); });
    cell('clover', (W, H) => {
      for (let k = 0; k < 22; k++) {
        const bx = W * (0.15 + r() * 0.7), by = H * (0.2 + r() * 0.7), s = 0.6 + r() * 0.5;
        for (let j = 0; j < 3; j++) { x.save(); x.translate(bx, by); x.rotate(j * 2.09 + r() * 0.3); drawLeaf(x, 46 * s, 44 * s, 0.6 + r() * 0.35, r(), { tip: 1.3, base: 0.6, vein: false }); x.restore(); }
      }
    });
    // ---- read back; transparent texels take their cell's mean leaf colour (clean mips without a dilation pass)
    const img = x.getImageData(0, 0, S, S).data;
    const d = new Uint8Array(img.buffer, img.byteOffset, img.length);
    const G = 16, gs = S / G, sum = new Float64Array(G * G * 4);
    for (let y = 0; y < S; y++) { const gy = (y / gs) | 0; for (let xx = 0; xx < S; xx++) { const i = (y * S + xx) * 4; if (d[i + 3] > 128) { const c = (gy * G + ((xx / gs) | 0)) * 4; sum[c] += d[i]; sum[c + 1] += d[i + 1]; sum[c + 2] += d[i + 2]; sum[c + 3]++; } } }
    for (let y = 0; y < S; y++) { const gy = (y / gs) | 0; for (let xx = 0; xx < S; xx++) { const i = (y * S + xx) * 4; if (d[i + 3] <= 8) { const c = (gy * G + ((xx / gs) | 0)) * 4, n = sum[c + 3] || 1; d[i] = sum[c] / n; d[i + 1] = sum[c + 1] / n; d[i + 2] = sum[c + 2] / n; } } }
    const t = dataTex(d, S, S, false, 4);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}
