"""Prepare Jiang Wuhen's over-the-shoulder card from Images/Prologue/shoulder.png.

Outputs (Images/Cinderfall/):
  wuhen-back.webp     torso with the right forearm removed and the hem behind it inpainted
  wuhen-forearm.webp  the forearm + hand, rotated at runtime about the elbow so he can wave
  wuhen-normal.webp   a soft bulge normal map from the hole-filled silhouette (no alpha: WebP drops colour under alpha 0)
  wuhen-hair.webp     hair mask that drives the ponytail sway
Requires: pillow, numpy, scipy, opencv-python.
"""
import os
import numpy as np, cv2
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = os.path.join(os.path.dirname(__file__), '..', 'Images', 'Prologue', 'shoulder.png')
OUT = os.path.join(os.path.dirname(__file__), '..', 'Images', 'Cinderfall')

a = np.asarray(Image.open(SRC).convert('RGBA')).copy()
H, W = a.shape[:2]
alpha = a[..., 3]
poly = [(806, 990), (850, 968), (905, 962), (944, 972), (940, 1060), (930, 1160), (932, 1250), (946, 1320), (942, 1395), (915, 1440), (872, 1440), (846, 1400), (842, 1330), (838, 1250), (828, 1160), (812, 1070)]
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255); poly_m = np.asarray(m) > 0
hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV).astype(float)
S = ndimage.gaussian_filter(hsv[..., 1], 2.0); Hh = ndimage.gaussian_filter(hsv[..., 0], 2.0)
skin = (S > 57) & (Hh < 14.5) & (alpha > 100)
skin = ndimage.binary_opening(ndimage.binary_closing(skin, iterations=4), iterations=2)
fore = skin & poly_m
lab, _ = ndimage.label(fore); sizes = ndimage.sum(fore, lab, range(1, lab.max() + 1)); fore = lab == (np.argmax(sizes) + 1)
fore = ndimage.binary_dilation(ndimage.binary_fill_holes(fore), iterations=2) & (alpha > 40) & poly_m
soft = ndimage.gaussian_filter(fore.astype(float), 0.8)
fa = a.copy(); fa[..., 3] = (np.minimum(alpha / 255.0, soft) * 255).astype(np.uint8)
ys, xs = np.where(fore); x0, x1, y0, y1 = xs.min() - 4, xs.max() + 5, ys.min() - 4, min(H, ys.max() + 5)
Image.fromarray(fa[y0:y1, x0:x1]).save(os.path.join(OUT, 'wuhen-forearm.webp'), 'WEBP', quality=92, method=6)
print('forearm crop', x0, y0, 'pivot (elbow) at', 878 - x0, 990 - y0)
hole = fore & (np.arange(H)[:, None] > 1240)
mask = ndimage.binary_dilation(hole, iterations=5).astype(np.uint8) * 255
inp = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2BGR), mask, 11, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
torso = a.copy(); torso[..., :3] = np.where(mask[..., None] > 0, inp, a[..., :3])
na = alpha.astype(float); na[fore & ~hole] = 0
hem = np.zeros_like(fore)
for y in range(1240, H):
    row = np.where((alpha[y] > 128) & ~fore[y])[0]; row = row[row < 870]
    if len(row): hem[y, :row.max() + 1] = True
na[hole & ~ndimage.binary_dilation(hem, iterations=2)] = 0
torso[..., 3] = np.clip(ndimage.gaussian_filter(na, 0.6), 0, 255).astype(np.uint8)
al = torso[..., 3] > 20
lab, n = ndimage.label(al); sizes = ndimage.sum(al, lab, range(1, n + 1))
small = np.isin(lab, np.where(sizes < 1500)[0] + 1); region = np.zeros_like(al); region[900:, 700:] = True
torso[..., 3][small & region] = 0
Image.fromarray(torso).save(os.path.join(OUT, 'wuhen-back.webp'), 'WEBP', quality=90, method=6)
al = ndimage.binary_opening(ndimage.binary_fill_holes(ndimage.binary_closing(torso[..., 3] > 60, iterations=6)), iterations=3)
dist = ndimage.gaussian_filter(ndimage.distance_transform_edt(al), 12)
hgt = ndimage.gaussian_filter(np.sqrt(np.clip(dist / 90.0, 0, 1)), 6)
gx = np.gradient(hgt, axis=1); gy = np.gradient(hgt, axis=0)
nx = -gx * 22; ny = gy * 22; nz = np.ones_like(hgt); l = np.sqrt(nx * nx + ny * ny + nz * nz)
nrm = np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5
Image.fromarray((nrm * 255).astype(np.uint8), 'RGB').resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(OUT, 'wuhen-normal.webp'), 'WEBP', quality=92)
hsv2 = cv2.cvtColor(torso[..., :3], cv2.COLOR_RGB2HSV).astype(float)
yy = np.arange(H)[:, None] / H; xx = np.arange(W)[None, :] / W
hair = (hsv2[..., 1] < 40) & (hsv2[..., 2] > 150) & (torso[..., 3] > 100) & (yy < 0.78) & (xx > 0.18) & (xx < 0.62)
hair = np.clip(ndimage.gaussian_filter(hair.astype(float), 4) * 1.6, 0, 1)
hair = np.maximum(hair, ((yy < 0.3) & (xx > 0.3) & (xx < 0.62) & (torso[..., 3] > 100)).astype(float) * 0.8)
Image.fromarray((hair * 255).astype(np.uint8), 'L').resize((W // 4, H // 4), Image.LANCZOS).save(os.path.join(OUT, 'wuhen-hair.webp'), 'WEBP', quality=85)
print('done')
