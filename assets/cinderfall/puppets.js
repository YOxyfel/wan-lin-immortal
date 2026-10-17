// The war, first seen as a shadow play. From under the cloud in the eye's well the lens looks up at a sheet of cloud
// lit from above, a screen, and on it two giant silhouettes clash like shadow puppets (皮影) on a paper screen: the gold
// cultivator in flowing robes with a straight sword, and the one in the sect's black robes, peaked hood, mantle and
// angular iron mask, with a glaive. Drawn here once into an atlas the sky's march reads (sky.js). As the puppets are,
// each figure is a body and an arm jointed at the shoulder: the arm, with its weapon, turns on its own.
//
// Atlas (W = 2S by S): [0, S/2) the gold body, [S/2, S) the masked body (x -0.5..0.5, feet y 0 to crown y 1, facing
// each other: gold to +x, masked to -x); [S, 1.5S) by [0, S/2) the gold arm, by [S/2, S) the masked arm (shoulder at the
// centre, x and y -0.6..0.6; gold along +x, masked along -x). Red: the silhouette. Green: what is cut out of it and
// glows with the figure's own light (the eye slits in the mask, the pattern in the hem).
import * as THREE from 'three';

export function drawPuppets(S = 512) {
  const cv = document.createElement('canvas');
  cv.width = 2 * S; cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  // puppet units to canvas pixels, for a body region (ox: its left edge) and an arm region (ox, oy: its corner)
  const B = ox => (x, y) => [ox + (x + 0.5) * S / 2, (1 - y) * S];
  const A = (ox, oy) => (x, y) => [ox + (x + 0.6) / 1.2 * S / 2, oy + (0.6 - y) / 1.2 * S / 2];
  // a closed outline of [x, y] points, curved through them (soft cloth), except at points marked [x, y, 1], which are
  // sharp corners (a blade's point, the mask's edge, a torn hem)
  const shape = (T, pts, fill) => {
    const P = pts.map(([x, y, k]) => [...T(x, y), k]);
    const n = P.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    g.beginPath();
    // (start on a sharp point if there is one, so the path closes cleanly)
    let i0 = P.findIndex(p => p[2]);
    if (i0 < 0) { const m = mid(P[0], P[1]); g.moveTo(m[0], m[1]); i0 = 0; } else g.moveTo(P[i0][0], P[i0][1]);
    for (let j = 1; j <= n; j++) {
      const p = P[(i0 + j) % n], q = P[(i0 + j + 1) % n];
      if (p[2]) g.lineTo(p[0], p[1]);
      else { const m = q[2] ? q : mid(p, q); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); if (q[2]) j++; }
    }
    g.closePath();
    g.fillStyle = fill; g.fill();
  };
  const ell = (T, x, y, rx, ry, fill) => { const [cx, cy] = T(x, y); g.beginPath(); g.ellipse(cx, cy, rx * S / 2, ry * S, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };
  const RED = '#ff0000', GLOW = '#00ff00';
  // (what is cut out of a figure glows with its own light: punched out of the red, drawn into the green)
  const cut = fn => { g.globalCompositeOperation = 'destination-out'; fn('#fff'); g.globalCompositeOperation = 'source-over'; fn(GLOW); };

  // ---------------------------------------------------------------- the gold cultivator: leaping in, leaning into it
  {
    const T = B(0);
    // the robe from the shoulders to the hem: the front edge down to the striding foot, the skirt billowing back in
    // the wind of the leap into tails like flames
    shape(T, [[0.1, 0.79], [0.12, 0.72], [0.1, 0.62], [0.07, 0.5], [0.11, 0.36], [0.19, 0.2], [0.26, 0.07], [0.3, 0.03, 1],
      [0.2, 0.04], [0.12, 0.0, 1], [0.02, 0.05], [-0.1, 0.02, 1], [-0.17, 0.08], [-0.3, 0.04, 1], [-0.36, 0.12], [-0.48, 0.13, 1],
      [-0.38, 0.2], [-0.47, 0.27, 1], [-0.3, 0.29], [-0.36, 0.37, 1], [-0.18, 0.38], [-0.1, 0.48], [-0.06, 0.62], [-0.02, 0.76]], RED);
    // the far sleeve, the long water sleeve, flung back and rippling
    shape(T, [[0.0, 0.77], [-0.08, 0.74], [-0.18, 0.72], [-0.3, 0.74], [-0.42, 0.7], [-0.49, 0.64, 1], [-0.41, 0.63], [-0.47, 0.56, 1],
      [-0.34, 0.6], [-0.22, 0.62], [-0.1, 0.66], [-0.02, 0.7]], RED);
    // the sash and its two ribbons streaming back
    shape(T, [[-0.07, 0.52], [0.09, 0.53], [0.08, 0.48], [-0.08, 0.47]], RED);
    shape(T, [[-0.06, 0.51], [-0.2, 0.49], [-0.33, 0.52], [-0.47, 0.47, 1], [-0.32, 0.47], [-0.18, 0.45], [-0.06, 0.48]], RED);
    shape(T, [[-0.06, 0.49], [-0.16, 0.42], [-0.28, 0.4], [-0.42, 0.33, 1], [-0.27, 0.36], [-0.15, 0.38], [-0.05, 0.47]], RED);
    // the neck and the head in profile, leaning forward: the brow, the nose, the lips, the chin
    shape(T, [[0.05, 0.79], [0.1, 0.8], [0.115, 0.83], [0.14, 0.845], [0.15, 0.86, 1], [0.165, 0.87, 1], [0.152, 0.88, 1], [0.155, 0.9, 1],
      [0.168, 0.915, 1], [0.155, 0.925], [0.15, 0.95], [0.12, 0.975], [0.08, 0.98], [0.04, 0.96], [0.03, 0.91], [0.04, 0.84]], RED);
    // the topknot and the crown pinned through it; the hair down his back, and a ribbon from the crown, both streaming
    shape(T, [[0.07, 0.975], [0.075, 1.0], [0.1, 1.0], [0.115, 0.98], [0.1, 0.97]], RED);
    shape(T, [[0.12, 0.995, 1], [0.03, 1.0, 1], [0.035, 0.99, 1], [0.125, 0.985, 1]], RED);
    shape(T, [[0.04, 0.95], [-0.04, 0.93], [-0.14, 0.88], [-0.22, 0.83], [-0.3, 0.8, 1], [-0.2, 0.86], [-0.1, 0.9], [-0.02, 0.92], [0.03, 0.9]], RED);
    shape(T, [[0.07, 0.99], [-0.06, 0.98], [-0.2, 0.95], [-0.34, 0.97], [-0.46, 0.93, 1], [-0.33, 0.93], [-0.19, 0.92], [-0.05, 0.955], [0.06, 0.97]], RED);
    // cut through: cloud scrolls along the hem, a band of them up the back of the robe
    cut(f => {
      for (let i = 0; i < 5; i++) { const x = -0.22 + i * 0.075, y = 0.1 + i * 0.012; ell(T, x, y, 0.02, 0.012, f); ell(T, x + 0.022, y + 0.018, 0.011, 0.007, f); }
      for (let i = 0; i < 3; i++) ell(T, -0.07 - i * 0.04, 0.62 - i * 0.07, 0.012, 0.009, f);
    });
  }
  // ---------------------------------------------------------------- the masked one: braced, wide, leaning into the swing
  {
    const T = B(S / 2);
    // the robe, long and heavy, wide-legged, its hem torn into tatters like running ink
    shape(T, [[0.06, 0.78], [-0.07, 0.76], [-0.11, 0.62], [-0.12, 0.48], [-0.18, 0.3], [-0.26, 0.1], [-0.3, 0.02, 1], [-0.2, 0.06],
      [-0.16, 0.0, 1], [-0.1, 0.07], [-0.04, 0.12], [0.03, 0.07], [0.08, 0.0, 1], [0.13, 0.06], [0.2, 0.01, 1], [0.24, 0.08],
      [0.31, 0.02, 1], [0.3, 0.14], [0.22, 0.32], [0.16, 0.5], [0.14, 0.66]], RED);
    // the mantle: stiff, flaring back from the shoulders like a wing, its lower edge cut in teeth
    shape(T, [[-0.08, 0.8], [-0.13, 0.75], [-0.12, 0.68], [-0.02, 0.64], [0.12, 0.6, 1], [0.16, 0.53, 1], [0.22, 0.58, 1], [0.28, 0.49, 1],
      [0.33, 0.55, 1], [0.41, 0.45, 1], [0.44, 0.54, 1], [0.5, 0.47, 1], [0.46, 0.6], [0.34, 0.7], [0.18, 0.78], [0.04, 0.81]], RED);
    // the head under the hood, the hood's peak falling back to a point
    shape(T, [[0.05, 0.79], [-0.05, 0.8], [-0.085, 0.83], [-0.1, 0.88], [-0.095, 0.94], [-0.06, 0.975], [0.0, 0.99], [0.08, 0.995],
      [0.17, 0.98], [0.3, 0.92, 1], [0.18, 0.925], [0.1, 0.9], [0.08, 0.84]], RED);
    // the mask: a flat iron plate standing out from the face, sheer from the brow to the pointed chin
    shape(T, [[-0.09, 0.955, 1], [-0.135, 0.94, 1], [-0.145, 0.88, 1], [-0.132, 0.82, 1], [-0.11, 0.79, 1], [-0.09, 0.82, 1]], RED);
    cut(f => {
      // the eye slit, burning violet; the sash; a row of teeth cut along the mantle
      shape(T, [[-0.143, 0.902, 1], [-0.1, 0.9, 1], [-0.088, 0.906, 1], [-0.1, 0.912, 1], [-0.142, 0.912, 1]], f);
      shape(T, [[-0.11, 0.535, 1], [0.15, 0.53, 1], [0.15, 0.505, 1], [-0.11, 0.51, 1]], f);
      for (let i = 0; i < 4; i++) { const x = 0.06 + i * 0.085, y = 0.66 - i * 0.03; shape(T, [[x, y + 0.025, 1], [x + 0.02, y - 0.02, 1], [x - 0.02, y - 0.02, 1]], f); }
    });
  }
  // ---------------------------------------------------------------- the arms, jointed at the shoulder
  {
    // gold: the sleeve along the arm, drooping under it; the fist; the straight sword (jian) held out along +x, its
    // guard, its blade tapering to the point, a tassel swinging from the pommel
    const T = A(S, 0);
    shape(T, [[-0.02, 0.04], [0.08, 0.04], [0.17, 0.025], [0.22, 0.022], [0.22, -0.018], [0.16, -0.035], [0.1, -0.08], [0.04, -0.13, 1],
      [0.0, -0.09], [-0.04, -0.03]], RED);
    shape(T, [[0.21, 0.03], [0.255, 0.028], [0.265, 0.0], [0.255, -0.025], [0.21, -0.022]], RED);
    shape(T, [[0.262, 0.055, 1], [0.278, 0.055, 1], [0.278, -0.055, 1], [0.262, -0.055, 1]], RED);
    shape(T, [[0.278, 0.012, 1], [0.53, 0.01, 1], [0.59, 0.0, 1], [0.53, -0.01, 1], [0.278, -0.012, 1]], RED);
    shape(T, [[0.215, -0.02], [0.2, -0.06], [0.17, -0.11, 1], [0.19, -0.07], [0.205, -0.03]], RED);
  }
  {
    // the masked one: a heavy arm in the mantle's sleeve along -x, the fist round a glaive's haft, the haft running
    // back past the shoulder, the long blade at its far end curving up to a point
    const T = A(S, S / 2);
    shape(T, [[0.02, 0.05], [-0.07, 0.045], [-0.15, 0.035], [-0.19, 0.03], [-0.19, -0.025], [-0.13, -0.05], [-0.06, -0.085], [0.02, -0.08],
      [0.05, -0.02]], RED);
    shape(T, [[-0.18, 0.04], [-0.225, 0.038], [-0.235, 0.0], [-0.225, -0.032], [-0.18, -0.03]], RED);
    shape(T, [[0.2, 0.01, 1], [-0.42, 0.01, 1], [-0.42, -0.01, 1], [0.2, -0.01, 1]], RED);
    shape(T, [[-0.41, 0.014, 1], [-0.47, 0.03], [-0.53, 0.06], [-0.585, 0.11, 1], [-0.55, 0.05], [-0.5, 0.012], [-0.44, -0.02, 1], [-0.47, -0.045, 1], [-0.42, -0.012, 1]], RED);
  }
  return cv;
}

// the atlas as a texture for the sky's march (mipmapped: the screen's silhouettes are softened by distance, as a
// shadow on a paper screen is)
export function puppetTexture(S = 512) {
  const tex = new THREE.CanvasTexture(drawPuppets(S));
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
