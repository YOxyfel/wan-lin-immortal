// Sakura in full bloom: a dark, gnarled trunk that forks low into spreading, crooked limbs, and clouds of
// pink-white blossom (alpha cards with a procedural blossom texture, the colour varying flower by flower), a
// carpet of fallen petals beneath and petals always drifting down. Wind from the shared uniforms (U.uWind, uGust).
//   createSakura(opts)              one tree
//   createSakuraStand(list, opts)   many trees in four draw calls (bark, blossom, fallen petals, drifting petals)
// opts: { seed, position:[x,y,z], height (4.5..8 m), spread (crown radius, 2.6..5 m), rotationY, density (1),
//         lean (1) }; stand opts: { name, groundAt(x,z), petals (true), falling (true), fallingPerTree (36) }
import * as THREE from 'three';
import { GeoBuf, sweep, card, noise3, fbm3, rng, clamp, lerp, smooth, V3, TAU, U, meshOf, instancedOf, fpatch, fdepth } from './flora-core.js';
import { FOGU } from './atmosphere.js';

const UP = V3(0, 1, 0);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ textures
// 1024² DATA atlas (the flora leaf convention: R shade, G per-flower random, B petal 1 / twig 0, A coverage),
// 2 x 2 cells: dense spray, open spray with buds, one petal, fallen petals.
const CELL = { sprayA: [0, 0], sprayB: [1, 0], petal: [0, 1], fallen: [1, 1] };
export function sakuraRect(name, inset = 0.004) {
  const [cx, cy] = CELL[name];
  return [(cx + inset) / 2, (cy + 1 - inset) / 2, (cx + 1 - inset) / 2, (cy + inset) / 2];
}
let _atlas = null, _bark = null, _mats = null;
const px = (lum, rnd, leaf = 1) => `rgb(${Math.round(clamp(lum) * 255)},${Math.round(clamp(rnd) * 255)},${leaf ? 255 : 0})`;

// one five-petalled flower (petals obovate with a notched tip), centre at (0,0)
function flower(x, R, lum, rnd, r, open = 1) {
  const n = 5, rot = r() * TAU;
  for (let i = 0; i < n; i++) {
    const a = rot + i * TAU / n + (r() - 0.5) * 0.18;
    const L = R * (0.9 + r() * 0.2) * open, W = R * 0.62 * open;
    x.save(); x.rotate(a);
    x.beginPath();
    x.moveTo(0, 0);
    x.bezierCurveTo(W * 0.55, -L * 0.25, W * 0.62, -L * 0.82, W * 0.18, -L);
    x.lineTo(0, -L * 0.88);                       // the notch
    x.lineTo(-W * 0.18, -L);
    x.bezierCurveTo(-W * 0.62, -L * 0.82, -W * 0.55, -L * 0.25, 0, 0);
    x.closePath();
    const g = x.createLinearGradient(0, 0, 0, -L);
    g.addColorStop(0, px(lum * 0.66, rnd)); g.addColorStop(0.35, px(lum * 0.92, rnd)); g.addColorStop(1, px(lum * 1.04, rnd));
    x.fillStyle = g; x.fill();
    x.strokeStyle = px(lum * 0.8, rnd); x.lineWidth = Math.max(0.6, R * 0.03); x.stroke();
    x.restore();
  }
  // the eye: a darker cup and a ring of stamens
  x.fillStyle = px(lum * 0.5, rnd); x.beginPath(); x.arc(0, 0, R * 0.2, 0, TAU); x.fill();
  x.strokeStyle = px(lum * 0.42, rnd); x.lineWidth = Math.max(0.6, R * 0.035);
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * TAU + r() * 0.3, l = R * (0.38 + r() * 0.18);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * l, Math.sin(a) * l); x.stroke();
    x.fillStyle = px(lum * 0.36, rnd); x.beginPath(); x.arc(Math.cos(a) * l, Math.sin(a) * l, Math.max(0.8, R * 0.05), 0, TAU); x.fill();
  }
}
function petalShape(x, L, W, lum, rnd) {
  x.beginPath(); x.moveTo(0, 0);
  x.bezierCurveTo(W * 0.55, -L * 0.25, W * 0.62, -L * 0.82, W * 0.18, -L);
  x.lineTo(0, -L * 0.87); x.lineTo(-W * 0.18, -L);
  x.bezierCurveTo(-W * 0.62, -L * 0.82, -W * 0.55, -L * 0.25, 0, 0);
  x.closePath();
  const g = x.createLinearGradient(0, 0, 0, -L);
  g.addColorStop(0, px(lum * 0.7, rnd)); g.addColorStop(1, px(lum * 1.03, rnd));
  x.fillStyle = g; x.fill();
}
function twigLine(x, pts, w0, w1, lum = 0.4) {
  x.strokeStyle = px(lum, 0.5, 0); x.lineCap = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    x.lineWidth = lerp(w0, w1, i / (pts.length - 1));
    x.beginPath(); x.moveTo(pts[i][0], pts[i][1]); x.lineTo(pts[i + 1][0], pts[i + 1][1]); x.stroke();
  }
}

export function sakuraAtlas() {
  if (_atlas) return _atlas;
  const S = 1024, C = 512;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const x = cv.getContext('2d', { willReadFrequently: true });
  const r = rng(4417);
  const cell = (name, fn) => { const [cx, cy] = CELL[name]; x.save(); x.translate(cx * C, cy * C); x.beginPath(); x.rect(2, 2, C - 4, C - 4); x.clip(); fn(C, C); x.restore(); };
  // a spray: dark twigs from the bottom, umbels of 3-5 flowers on short stalks crowding into a rounded cloud
  const spray = (W, H, umbels, perUmbel, buds, open) => {
    const tips = [];
    const main = [[W * 0.5, H], [W * 0.47, H * 0.74], [W * 0.53, H * 0.48], [W * 0.49, H * 0.2]];
    twigLine(x, main, 10, 3.5, 0.32);
    for (let i = 0; i < 7; i++) {
      const t = 0.22 + i * 0.1, s = i % 2 ? 1 : -1;
      const y0 = H * (1 - t * 0.92), x0 = W * 0.5 + (r() - 0.5) * 10;
      const x1 = x0 + s * W * (0.18 + r() * 0.2), y1 = y0 - H * (0.06 + r() * 0.14);
      twigLine(x, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 + 5], [x1, y1]], 5.5, 2, 0.32);
      tips.push([x1, y1]);
    }
    tips.push([W * 0.49, H * 0.2]);
    const fl = [];
    for (let k = 0; k < umbels; k++) {
      const [tx, ty] = tips[k % tips.length];
      const cx = tx + (r() - 0.5) * W * 0.32, cy = ty + (r() - 0.5) * H * 0.26;
      if (Math.hypot(cx - W / 2, cy - H * 0.5) > W * 0.47) continue;
      for (let j = 0; j < perUmbel; j++) {
        const a = r() * TAU, d = 14 + r() * 26;
        const fx = cx + Math.cos(a) * d, fy = cy + Math.sin(a) * d;
        x.strokeStyle = px(0.38, 0.5, 0); x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx, cy); x.lineTo(fx, fy); x.stroke();
        fl.push([fx, fy, 15 + r() * 9]);
      }
    }
    // buds: small closed ovals, deeper coloured (dark shade)
    for (let k = 0; k < buds; k++) {
      const [tx, ty] = tips[Math.floor(r() * tips.length)];
      const bx = tx + (r() - 0.5) * 90, by = ty + (r() - 0.5) * 70;
      x.save(); x.translate(bx, by); x.rotate(r() * TAU);
      x.fillStyle = px(0.45 + r() * 0.12, 0.92 + r() * 0.08); x.beginPath(); x.ellipse(0, 0, 4.5, 7.5, 0, 0, TAU); x.fill();
      x.restore();
    }
    fl.sort(() => r() - 0.5);
    for (const [fx, fy, R] of fl) { x.save(); x.translate(fx, fy); flower(x, R, 0.66 + r() * 0.34, r(), r, open); x.restore(); }
  };
  cell('sprayA', (W, H) => spray(W, H, 30, 5, 10, 1));
  cell('sprayB', (W, H) => spray(W, H, 20, 4, 26, 0.9));
  cell('petal', (W, H) => { x.save(); x.translate(W * 0.5, H * 0.88); petalShape(x, H * 0.76, W * 0.66, 0.92, 0.5); x.restore(); });
  cell('fallen', (W, H) => {
    for (let k = 0; k < 150; k++) {
      const a = r() * TAU, d = Math.pow(r(), 0.7) * W * 0.44;
      x.save(); x.translate(W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d); x.rotate(r() * TAU);
      petalShape(x, 15 + r() * 9, 11 + r() * 6, 0.62 + r() * 0.38, r());
      x.restore();
    }
  });
  // transparent texels take their cell's mean colour (clean mips without a dilation pass)
  const img = x.getImageData(0, 0, S, S).data;
  const d = new Uint8Array(img.buffer, img.byteOffset, img.length);
  const G = 8, gs = S / G, sum = new Float64Array(G * G * 4);
  for (let y = 0; y < S; y++) { const gy = (y / gs) | 0; for (let xx = 0; xx < S; xx++) { const i = (y * S + xx) * 4; if (d[i + 3] > 128) { const c = (gy * G + ((xx / gs) | 0)) * 4; sum[c] += d[i]; sum[c + 1] += d[i + 1]; sum[c + 2] += d[i + 2]; sum[c + 3]++; } } }
  for (let y = 0; y < S; y++) { const gy = (y / gs) | 0; for (let xx = 0; xx < S; xx++) { const i = (y * S + xx) * 4; if (d[i + 3] <= 8) { const c = (gy * G + ((xx / gs) | 0)) * 4, n = sum[c + 3] || 1; d[i] = sum[c] / n; d[i + 1] = sum[c + 1] / n; d[i + 2] = sum[c + 2] / n; } } }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.needsUpdate = true;
  _atlas = t;
  return t;
}

// cherry bark: dark grey-brown, smooth between horizontal lenticels and peeling bands, rough cracks low down.
// tile 0.8 m around x 1.2 m along
export function cherryBark() {
  if (_bark) return _bark;
  const W = 256, H = 384, r = rng(7313);
  const h = new Float32Array(W * H), col = new Uint8Array(W * H * 4);
  const lent = [];
  for (let i = 0; i < 260; i++) lent.push([r() * W, r() * H, 6 + r() * 16, 1 + r() * 1.6, r() < 0.7 ? 1 : -1]);
  const bands = []; for (let i = 0; i < 9; i++) bands.push([r() * H, 3 + r() * 7]);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const u = xx / W, v = y / H;
    let n = 0, a = 1, f = 3;
    for (let o = 0; o < 4; o++) { n += a * (Math.sin((u * f + o * 0.37) * TAU + Math.sin(v * f * 2.1 + o) * 1.7) * 0.5 + 0.5) * (Math.sin((v * f * 1.3 + o * 0.61) * TAU) * 0.5 + 0.5); a *= 0.5; f *= 2; }
    let hh = n * 0.5;
    for (const [by, bw] of bands) { const dy = Math.abs(((y - by + H * 1.5) % H) - H / 2); hh += Math.exp(-dy * dy / (bw * bw)) * 0.12; }
    h[y * W + xx] = hh;
  }
  for (const [lx, ly, lw, lh, s] of lent) {
    for (let yy = -3; yy <= 3; yy++) for (let dx = -lw; dx <= lw; dx++) {
      const X = ((Math.round(lx + dx) % W) + W) % W, Y = ((Math.round(ly + yy) % H) + H) % H;
      const k = Math.exp(-(dx * dx) / (lw * lw * 0.5) - (yy * yy) / (lh * lh));
      h[Y * W + X] += k * 0.22 * s;
    }
  }
  let mn = 1e9, mx = -1e9; for (const v of h) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let i = 0; i < W * H; i++) {
    const t = (h[i] - mn) / (mx - mn);
    const c = [lerp(0.11, 0.3, t), lerp(0.085, 0.22, t), lerp(0.08, 0.21, t)];
    col[i * 4] = c[0] * 255; col[i * 4 + 1] = c[1] * 255; col[i * 4 + 2] = c[2] * 255; col[i * 4 + 3] = 255;
  }
  const nrm = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const xm = (xx - 1 + W) % W, xp = (xx + 1) % W, ym = (y - 1 + H) % H, yp = (y + 1) % H;
    const dx = (h[y * W + xp] - h[y * W + xm]) * 6, dy = (h[yp * W + xx] - h[ym * W + xx]) * 6, l = Math.hypot(dx, dy, 1), k = (y * W + xx) * 4;
    nrm[k] = (-dx / l * 0.5 + 0.5) * 255; nrm[k + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[k + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[k + 3] = 255;
  }
  const mk = (data, srgb) => { const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true; return t; };
  _bark = { map: mk(col, true), normal: mk(nrm, false), tile: [0.8, 1.2] };
  return _bark;
}

// ------------------------------------------------------------------ materials (once)
export function sakuraMaterials() {
  if (_mats) return _mats;
  const atlas = sakuraAtlas(), bk = cherryBark();
  const bark = fpatch(new THREE.MeshStandardMaterial({ map: bk.map, normalMap: bk.normal, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.82, metalness: 0 }),
    { kind: 'bark', wind: true, moss: 0.25, lichen: 0.3, key: 'sakuraBark' });
  const blossom = fpatch(new THREE.MeshStandardMaterial({ map: atlas, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.66, metalness: 0 }),
    { kind: 'leaf', wind: true, leafA: 0xfde6e8, leafB: 0xf2a4b4, autA: 0xf2a4b4, autB: 0xf2a4b4, autC: 0xf2a4b4, autAmt: 0, drop: 0, trans: 0.9,
      transCol: 0xffdcdc, flutter: 1.1, snowLeaf: 0, atlasSize: 1024, twig: 0x3a2826, key: 'sakuraBlossom' });
  blossom.shadowSide = THREE.DoubleSide;
  _mats = { atlas, bark, blossom, barkDepth: fdepth(bark, { wind: true }), blossomDepth: fdepth(blossom, { wind: true }) };
  return _mats;
}

// ------------------------------------------------------------------ one tree into the stand's buffers
const crooked = (r, p0, dir, len, n, jitter, bias = V3()) => {
  const pts = [p0.clone()], d = dir.clone().normalize();
  let p = p0.clone();
  for (let i = 1; i <= n; i++) {
    d.add(V3((r() - 0.5) * jitter, (r() - 0.5) * jitter * 0.6, (r() - 0.5) * jitter)).add(bias).normalize();
    p = p.clone().addScaledVector(d, len / n);
    pts.push(p);
  }
  return pts;
};
const barkAO = (k = 1) => (t, a, pos, dir) => { const dl = dir.length() || 1; const ao = (0.58 + 0.42 * clamp((dir.y / dl) * 0.5 + 0.62)) * k; return [ao, ao * 0.97, ao * 0.96]; };

function sakuraInto(B, F, o) {
  const r = rng(o.seed);
  const H = o.height, R = o.spread, dens = o.density ?? 1;
  const base = V3(...o.position), rot = o.rotationY ?? r() * TAU;
  const tf = p => p.clone().applyAxisAngle(UP, rot).add(base);
  // trunk: short, leaning, twisting, with a flared foot
  const forkH = H * (0.24 + r() * 0.08);
  const lean = V3((r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7).multiplyScalar(o.lean ?? 1);
  const rT = 0.11 + H * 0.027;
  const tl = [V3(0, -0.35, 0)];
  for (let i = 1; i <= 5; i++) { const t = i / 5; tl.push(V3(lean.x * forkH * t * t + (r() - 0.5) * 0.12, forkH * t, lean.z * forkH * t * t + (r() - 0.5) * 0.12)); }
  const trunkW = tl.map(tf);
  const ph = r() * 10;
  sweep(B, trunkW, {
    radial: 12, segLen: 0.18,
    radius: (t) => rT * (1 + 0.7 * Math.exp(-t * forkH / 0.3)) * (1 - 0.2 * t) * (1 + 0.25 * smooth(0.75, 1, t)),
    displace: (t, a, P) => rT * (0.22 * noise3(P.x * 3 + ph, P.y * 1.4, P.z * 3) + 0.3 * Math.exp(-t * forkH / 0.4) * Math.max(0, Math.sin(a * 4 + ph))),
    color: barkAO(), uRep: 2, vScale: 1 / 1.2, sway: () => 0,
  });
  const fork = trunkW[trunkW.length - 1];
  const clumps = [];
  // main limbs: spreading wide and low, rising, the tips drooping a little
  const nL = 3 + Math.floor(r() * 2.6);
  let az = r() * TAU;
  const tips = [];
  for (let k = 0; k < nL; k++) {
    az += TAU / nL + (r() - 0.5) * 0.7;
    const el = 0.42 + r() * 0.45;
    const dir = V3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const len = R * (0.72 + r() * 0.35);
    const pts = crooked(r, fork.clone().add(V3(Math.cos(az) * rT * 0.4, -0.05, Math.sin(az) * rT * 0.4)), dir, len, 6, 0.55, V3(0, -0.035, 0));
    const r0 = rT * (0.62 - k * 0.04);
    sweep(B, pts, { radial: 8, segLen: 0.32, radius: t => lerp(r0, 0.045, Math.pow(t, 0.85)), displace: (t, a, P) => r0 * 0.15 * noise3(P.x * 2.5, P.y * 2.5 + ph, P.z * 2.5), color: barkAO(0.96), uRep: 1, vScale: 1 / 1.2, sway: t => 0.08 + t * 0.3 });
    tips.push(pts[pts.length - 1]);
    clumps.push({ c: pts[pts.length - 1].clone().add(V3(0, 0.25, 0)), r: 1.0 + r() * 0.45 });
    // branches off the limb: up and out, each ending in blossom
    const nb = 2 + Math.floor(r() * 2.5);
    for (let b = 0; b < nb; b++) {
      const t = 0.35 + 0.55 * (b + r() * 0.6) / nb;
      const i0 = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      const p = pts[i0].clone().lerp(pts[i0 + 1], r());
      const tan = pts[i0 + 1].clone().sub(pts[i0]).normalize();
      const sideV = V3(-tan.z, 0, tan.x).normalize().multiplyScalar(b % 2 ? 1 : -1);
      const bd = tan.clone().multiplyScalar(0.5).add(sideV.multiplyScalar(0.7)).add(V3(0, 0.45 + r() * 0.4, 0));
      const bl = R * (0.3 + r() * 0.25);
      const bp = crooked(r, p, bd, bl, 3, 0.6, V3(0, 0.02, 0));
      const br = lerp(r0, 0.045, t) * 0.55;
      sweep(B, bp, { radial: 5, segLen: 0.35, radius: tt => lerp(br, 0.02, tt), color: barkAO(0.94), uRep: 1, vScale: 1 / 1.2, sway: tt => 0.25 + tt * 0.35 });
      clumps.push({ c: bp[bp.length - 1].clone().add(V3(0, 0.12, 0)), r: 0.75 + r() * 0.4 });
      clumps.push({ c: bp[1].clone().lerp(bp[2], 0.5).add(V3(0, 0.25, 0)), r: 0.55 + r() * 0.3 });
    }
    // blossom along the limb's upper half
    for (let s = 0; s < 2; s++) { const i1 = 3 + s; clumps.push({ c: pts[i1].clone().add(V3(0, 0.35, 0)), r: 0.6 + r() * 0.3 }); }
  }
  // a leader rising from the fork carries the crown's top
  const lead = crooked(r, fork, V3((r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3), H - forkH - 0.9, 4, 0.4);
  sweep(B, lead, { radial: 6, segLen: 0.35, radius: t => lerp(rT * 0.48, 0.03, Math.pow(t, 0.8)), color: barkAO(0.96), uRep: 1, vScale: 1 / 1.2, sway: t => 0.1 + t * 0.35 });
  clumps.push({ c: lead[lead.length - 1].clone().add(V3(0, 0.1, 0)), r: 1.2 + r() * 0.3 });
  clumps.push({ c: lead[2].clone().add(V3(0, 0.2, 0)), r: 0.9 + r() * 0.3 });
  // fill the cloud between the limbs (sky gaps stay where it is thinnest)
  const top = lead[lead.length - 1];
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU, d = R * (0.3 + r() * 0.45);
    clumps.push({ c: V3(fork.x + Math.cos(a) * d, lerp(fork.y + 0.9, top.y - 0.4, r()), fork.z + Math.sin(a) * d), r: 0.8 + r() * 0.4 });
  }
  // twigs inside the clumps, then the blossom cards
  const rA = sakuraRect('sprayA'), rB = sakuraRect('sprayB');
  const cy = (fork.y + top.y) / 2;
  for (const cl of clumps) {
    for (let i = 0; i < 2; i++) {
      const a = r() * TAU, d = cl.r * (0.5 + r() * 0.4);
      sweep(B, [cl.c.clone().add(V3(0, -cl.r * 0.45, 0)), cl.c.clone().add(V3(Math.cos(a) * d, -cl.r * 0.1, Math.sin(a) * d))], { radial: 3, segments: 2, radius: tt => 0.025 * (1 - tt * 0.6), color: barkAO(0.85), uRep: 1, vScale: 1, sway: () => 0.4 });
    }
    const n = Math.round((cl.r * cl.r * 30 + 10) * dens);
    const ry = cl.r * 0.68;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, cz = r() * 2 - 1, sz = Math.sqrt(1 - cz * cz);
      const dv = V3(Math.cos(a) * sz, cz * 0.85 + 0.12, Math.sin(a) * sz).normalize();
      const sh = Math.pow(r(), 0.35);
      const p = cl.c.clone().add(V3(dv.x * cl.r * sh, dv.y * ry * sh, dv.z * cl.r * sh));
      const size = 0.55 + r() * 0.42;
      const yaw = r() * TAU, tilt = 0.25 + r() * 0.7;
      const ay = V3(Math.cos(yaw) * Math.cos(tilt), Math.sin(tilt) * (r() < 0.2 ? -1 : 1), Math.sin(yaw) * Math.cos(tilt)).lerp(dv, 0.45).normalize();
      let ax = V3().crossVectors(ay, UP).normalize();
      if (ax.lengthSq() < 0.01) ax = V3(1, 0, 0);
      // soft shading: whole-crown normals (a lit dome), the inside and the underside darker
      const out = p.clone().sub(V3(fork.x, cy, fork.z)).normalize();
      const nrm = out.multiplyScalar(0.8).add(V3(0, 0.55, 0)).normalize();
      const shade = clamp(0.62 + 0.28 * sh + 0.22 * (dv.y * 0.5 + 0.5) - 0.12 * smooth(0, 1, (cl.c.y - p.y) / cl.r), 0.42, 1.08);
      card(F, p.clone().addScaledVector(ay, -size * 0.5), ax, ay, size, size, r() < 0.62 ? rA : rB, nrm, [shade, shade * 0.97, shade * 0.98], [0.3, 0.55], r());
    }
  }
  return { top, fork, crown: R, height: H, base };
}

// ------------------------------------------------------------------ drifting petals: a pure function of time
function fallingPetals(centers, count, seed) {
  const atlas = sakuraAtlas(), rect = sakuraRect('petal', 0.01), r = rng(seed);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([rect[0], rect[1], rect[2], rect[1], rect[2], rect[3], rect[0], rect[3]], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const n = centers.length * count, a0 = new Float32Array(n * 4), a1 = new Float32Array(n * 4);
  let k = 0;
  for (const c of centers) for (let i = 0; i < count; i++, k++) {
    const ang = r() * TAU, d = Math.sqrt(r()) * c.r;
    a0.set([c.x + Math.cos(ang) * d, c.top - r() * c.h, c.z + Math.sin(ang) * d, c.ground], k * 4);
    a1.set([r() * 60, 9 + r() * 9, 0.045 + r() * 0.03, r()], k * 4);
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(a0, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(a1, 4));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tAtlas: { value: atlas } }]),
    vertexShader: `attribute vec4 aA, aB; uniform float uTime, uWind; uniform vec2 uGust; varying vec2 vUv; varying float vSh; varying float vR;
#include <fog_pars_vertex>
void main(){
  float ph = fract((uTime + aB.x)/aB.y);
  vec3 p0 = aA.xyz; float drop = (p0.y - aA.w)*ph;
  float sw = sin(uTime*1.3 + aB.x)*.8 + sin(uTime*2.9 + aB.x*1.7)*.25;
  vec3 w = vec3(p0.x + sw + ph*3.*uWind*uGust.x, p0.y - drop, p0.z + cos(uTime*1.1 + aB.x*1.3)*.8 + ph*3.*uWind*uGust.y);
  float a = uTime*(2.5 + aB.w*3.5) + aB.x;
  mat3 R = mat3(cos(a), 0., sin(a), 0., 1., 0., -sin(a), 0., cos(a));
  float t2 = sin(uTime*3.1 + aB.x)*1.4;
  mat3 Rx = mat3(1., 0., 0., 0., cos(t2), sin(t2), 0., -sin(t2), cos(t2));
  float on = smoothstep(0., .05, ph)*(1. - smoothstep(.95, 1., ph));
  vec3 lp = Rx*R*(position*aB.z)*on;
  vec4 mvPosition = viewMatrix*vec4(w + lp, 1.);
  gl_Position = projectionMatrix*mvPosition;
  vUv = uv; vSh = .6 + .4*abs((Rx*R*vec3(0., 1., 0.)).y); vR = aB.w;
#include <fog_vertex>
}`,
    fragmentShader: `uniform sampler2D tAtlas; uniform vec3 uSunC; varying vec2 vUv; varying float vSh; varying float vR;
#include <fog_pars_fragment>
void main(){
  vec4 t = texture2D(tAtlas, vUv);
  if (t.a < .5) discard;
  vec3 c = mix(vec3(.98, .86, .9), vec3(.93, .6, .73), fract(vR*3.7))*(.55 + t.r*.6);
  gl_FragColor = vec4(c*vSh*(.55 + .55*uSunC), 1.);
  gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1./2.2));
  #include <fog_fragment>
}`,
  });
  Object.assign(mat.uniforms, { uTime: U.uTime, uWind: U.uWind, uGust: U.uGust, uSunC: FOGU.cfFogSunCol }, FOGU);
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.name = 'sakuraPetalsFalling';
  return mesh;
}

/**
 * createSakuraStand(list, { name, groundAt, petals, falling, fallingPerTree }) -> { group, bark, blossom, petals,
 * falling, info } : every tree of the list merged (bark, blossom), fallen petals instanced, drifting petals animated.
 */
export function createSakuraStand(list, o = {}) {
  const opts = { name: 'sakura', groundAt: null, petals: true, falling: true, fallingPerTree: 36, ...o };
  const M = sakuraMaterials();
  const B = new GeoBuf(), F = new GeoBuf();
  const info = list.map((t, i) => sakuraInto(B, F, { seed: 500 + i * 31, height: 6, spread: 3.8, position: [0, 0, 0], ...t }));
  const group = new THREE.Group(); group.name = opts.name;
  const bark = meshOf(B.build(), M.bark, M.barkDepth, { name: opts.name + '-bark' });
  const blossom = meshOf(F.build(), M.blossom, M.blossomDepth, { name: opts.name + '-blossom' });
  group.add(bark, blossom);
  let petals = null, falling = null;
  const gAt = opts.groundAt || ((x, z) => 0);
  if (opts.petals) {
    // fallen petals: flat cards of scattered petals, thickest under the drip line
    const geo = new GeoBuf(), rf = sakuraRect('fallen');
    card(geo, V3(0, 0.012, -0.5), V3(1, 0, 0), V3(0, 0, 1), 1, 1, rf, V3(0, 1, 0), [0.92, 0.92, 0.92], [0, 0], 0);
    const g = geo.build();
    const mats = [], r = rng(9071);
    for (const t of info) {
      const n = Math.round(t.crown * t.crown * 3.2 * (o.petalDensity ?? 1));
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = t.crown * Math.sqrt(lerp(0.02, 1.15, r()));
        const x = t.base.x + Math.cos(a) * d, z = t.base.z + Math.sin(a) * d;
        if (opts.keepOut && opts.keepOut(x, z)) continue;
        const s = 0.8 + r() * 0.9;
        const y = gAt(x, z);
        // follow the ground's slope a little
        const sx = (gAt(x + 0.5, z) - gAt(x - 0.5, z)), sz = (gAt(x, z + 0.5) - gAt(x, z - 0.5));
        mats.push(new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.atan(sz) * 0.9, r() * TAU, -Math.atan(sx) * 0.9, 'YXZ')), V3(s, 1, s)));
      }
    }
    petals = instancedOf(g, M.blossom, null, mats, { name: opts.name + '-fallen', cast: false });
    group.add(petals);
  }
  if (opts.falling) {
    falling = fallingPetals(info.map(t => ({ x: t.fork.x, z: t.fork.z, top: t.top.y - 0.4, h: Math.max(1, t.top.y - t.fork.y - 0.8), r: t.crown * 0.85, ground: gAt(t.fork.x, t.fork.z) })), opts.fallingPerTree, 77);
    group.add(falling);
  }
  return { group, bark, blossom, petals, falling, info };
}

/** createSakura(opts) -> { group, ...info }: one tree (same four meshes as a stand) */
export function createSakura(opts = {}) {
  const s = createSakuraStand([opts], { name: 'sakura', groundAt: opts.groundAt, petals: opts.petals ?? true, falling: opts.falling ?? true });
  return { ...s, ...s.info[0] };
}
