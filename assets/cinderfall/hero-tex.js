// Procedural textures for the hero: tileable cloth detail (weave / twill / grain / wear), a cloth normal map and a
// hair-strand atlas. Generated once into DataTextures (no image files), mipmapped.
import * as THREE from 'three';
import { rng, pnoise2, clamp, lerp } from './hero-util.js';

function dataTex(data, w, h, srgb) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

let cache = null;
export function heroTextures() {
  if (cache) return cache;
  const cd = clothDetail();
  cache = { cloth: cd.tex, clothN: clothNormal(cd.H), hair: hairAtlas() };
  return cache;
}

// R: linen plain weave with slubs, G: diagonal twill, B: leather grain / felted wrap, A: soft wear noise.
// All channels are tileable over the 512px tile.
function clothDetail() {
  const S = 512, d = new Uint8Array(S * S * 4);
  const r = rng(11);
  // slub thickness per thread
  const slubX = Float32Array.from({ length: S }, () => r()), slubY = Float32Array.from({ length: S }, () => r());
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    // linen: threads every 4px, over/under alternation
    const tx = x / 4, ty = y / 4;
    const cx = Math.floor(tx), cy = Math.floor(ty);
    const fx = tx - cx, fy = ty - cy;
    const over = (cx + cy) & 1;
    const warp = Math.sin(Math.PI * fx), weft = Math.sin(Math.PI * fy);
    const sx = 0.75 + 0.5 * slubX[cx % S], sy = 0.75 + 0.5 * slubY[cy % S];
    let lin = over ? warp * sx * (0.6 + 0.4 * weft) : weft * sy * (0.6 + 0.4 * warp);
    const n1 = pnoise2(x / 16, y / 16, S / 16, S / 16, 3), n2 = pnoise2(x / 64, y / 64, S / 64, S / 64, 4);
    lin = 0.62 + 0.28 * lin + 0.12 * (n1 - 0.5) + 0.1 * (n2 - 0.5);
    // twill: diagonal ribs
    const dg = ((x + y) % 8) / 8;
    let tw = 0.7 + 0.22 * Math.sin(dg * Math.PI * 2) * (0.7 + 0.3 * Math.sin(Math.PI * (x % 3) / 3)) + 0.14 * (n1 - 0.5) + 0.12 * (n2 - 0.5);
    // grain
    const g1 = pnoise2(x / 3, y / 3, S / 3 | 0, S / 3 | 0, 5);
    const g2 = pnoise2(x / 9, y / 9, S / 9 | 0, S / 9 | 0, 6);
    let gr = 0.7 + 0.18 * (g1 - 0.5) + 0.22 * (g2 - 0.5) + 0.1 * (n2 - 0.5);
    const wear = pnoise2(x / 32, y / 32, 16, 16, 7) * 0.6 + pnoise2(x / 8, y / 8, 64, 64, 8) * 0.4;
    d[i * 4] = clamp(lin) * 255; d[i * 4 + 1] = clamp(tw) * 255; d[i * 4 + 2] = clamp(gr) * 255; d[i * 4 + 3] = clamp(wear) * 255;
    // height for the normal map: weave relief plus soft crinkles
    const cr = pnoise2(x / 24, y / 40, S / 24 | 0, S / 40 | 0, 9);
    H[i] = lin * 0.5 + tw * 0.12 + cr * 0.32 + n2 * 0.2;
  }
  const t = dataTex(d, S, S, false);
  t.name = 'hero-cloth-detail';
  return { tex: t, H };
}

function clothNormal(H) {
  const S = 512, d = new Uint8Array(S * S * 4);
  const at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * S + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  const t = dataTex(d, S, S, false);
  t.name = 'hero-cloth-normal';
  return t;
}

// Hair atlas: 4 columns (u), each a card's worth of hair running along v (v = 0 root .. 1 tip): two or three locks with
// gaps between them, strands converging and thinning toward uneven tips, a darker under-lock and a few strays.
// RGB = strand luminance, A = coverage. Strands are a few pixels wide so they survive mipmapping.
function hairAtlas() {
  const W = 512, Hh = 1024, d = new Uint8Array(W * Hh * 4);
  const cov = new Float32Array(W * Hh), lum = new Float32Array(W * Hh).fill(0.7);
  const r = rng(77);
  const COLS = 4, CW = W / COLS;
  const LOCKS = [[0.3, 0.72], [0.22, 0.52, 0.8], [0.34, 0.68], [0.2, 0.47, 0.76]];
  const strand = (c, x0, cx, yStart, yEnd, w0, b, conv, wav, wa, wf, drift) => {
    for (let y = yStart; y < yEnd; y++) {
      const t = y / Hh, tl = (y - yStart) / Math.max(1, yEnd - yStart);
      // the lock gathers toward its centre as it falls, with a gentle wave
      const x = cx + (x0 - cx) * (1 - conv * Math.pow(tl, 0.8)) + Math.sin(wav + t * wf * 6.28) * wa + drift * tl;
      const taper = tl < 0.7 ? 1 : 1 - (tl - 0.7) / 0.3 * 0.75;
      const hw = w0 * taper;
      const xa = Math.floor(x - hw - 1), xb = Math.ceil(x + hw + 1);
      for (let xi = xa; xi <= xb; xi++) {
        if (xi < c * CW + 1 || xi >= (c + 1) * CW - 1) continue;
        const dd = Math.abs(xi + 0.5 - x) / hw;
        if (dd > 1.25) continue;
        // soft, staggered start at the root (no straight edge where a card begins) and a fading tip
        const a = clamp(1.25 - dd) * (tl > 0.9 ? (1 - tl) / 0.1 * 0.8 + 0.2 : 1) * Math.min(1, 0.35 + (y - yStart) / 40);
        const i = y * W + xi;
        // near the root every lock has the same combed value; the lock-to-lock differences grow along the length
        const bb = lerp(0.8, b, Math.min(1, t / 0.2));
        if (a > cov[i]) lum[i] = bb * (0.8 + 0.2 * (1 - dd));
        cov[i] = Math.max(cov[i], a);
      }
    }
  };
  for (let c = 0; c < COLS; c++) {
    const locks = LOCKS[c];
    locks.forEach((lc, li) => {
      const span = (locks.length === 3 ? 0.17 : 0.23) * CW;
      const cx = c * CW + lc * CW;
      // each lock its own length and value: one darker lock per card reads as depth between the locks
      const lockEnd = 0.7 + 0.3 * r();
      const lockB = li === 1 && locks.length === 3 ? 0.55 + 0.15 * r() : 0.72 + 0.28 * r();
      const n = 44 + Math.floor(r() * 12);
      for (let k = 0; k < n; k++) {
        const g = r() + r() - 1;
        const x0 = cx + g * span;
        // strands toward the lock's edges end sooner: the lock tapers to an uneven point
        const yEnd = Math.floor(Hh * lockEnd * (0.66 + 0.34 * Math.pow(r(), 0.5)) * (1 - 0.18 * Math.abs(g)));
        const yStart = Math.floor(Math.pow(r(), 1.6) * 0.1 * Hh);
        strand(c, x0, cx, yStart, yEnd, 1.4 + r() * 1.7, lockB * (0.86 + 0.26 * r()) * (1 - 0.12 * Math.abs(g)), 0.42 + 0.2 * r(), r() * 6.28, 0.6 + r() * 1.6, 0.6 + r() * 1.6, (r() - 0.5) * 3);
      }
    });
    // a few strays that wander off the locks
    for (let k = 0; k < 3; k++) {
      const x0 = c * CW + (0.1 + 0.8 * r()) * CW;
      strand(c, x0, x0, Math.floor(r() * 0.1 * Hh), Math.floor(Hh * (0.55 + 0.4 * r())), 0.9 + r() * 0.5, 0.85 + 0.15 * r(), 0, r() * 6.28, 2 + r() * 4, 0.5 + r(), (r() - 0.5) * 22);
    }
  }
  for (let i = 0; i < W * Hh; i++) {
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = clamp(lum[i]) * 255;
    d[i * 4 + 3] = clamp(cov[i]) * 255;
  }
  const t = dataTex(d, W, Hh, false);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.name = 'hero-hair-atlas';
  return t;
}
