"""Procedural, tileable texture set for the Cinderfall 3D prologue.

Every texture is generated from seeded noise so the set is reproducible.
Output: WebP files in Website/Images/Cinderfall/.
"""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'Images', 'Cinderfall')
os.makedirs(OUT, exist_ok=True)


def rng(seed):
    return np.random.default_rng(seed)


def fnoise(n, beta=2.0, seed=0, m=None):
    """Tileable fractal noise in [0,1] via spectral synthesis."""
    m = m or n
    r = rng(seed)
    white = r.standard_normal((m, n))
    F = np.fft.fft2(white)
    ky = np.fft.fftfreq(m)[:, None]
    kx = np.fft.fftfreq(n)[None, :]
    k = np.sqrt(kx * kx + ky * ky)
    k[0, 0] = 1
    F = F / (k ** (beta / 2.0 + 0.5))
    F[0, 0] = 0
    out = np.real(np.fft.ifft2(F))
    out = (out - out.min()) / (out.max() - out.min() + 1e-9)
    return out


def bandnoise(n, lo, hi, seed=0, m=None):
    """Tileable noise restricted to a frequency band (cycles per texture)."""
    m = m or n
    r = rng(seed)
    F = np.fft.fft2(r.standard_normal((m, n)))
    ky = np.fft.fftfreq(m)[:, None] * m
    kx = np.fft.fftfreq(n)[None, :] * n
    k = np.sqrt(kx * kx + ky * ky)
    F *= ((k >= lo) & (k <= hi))
    out = np.real(np.fft.ifft2(F))
    return (out - out.min()) / (out.max() - out.min() + 1e-9)


def voronoi(n, count, seed=0, jitter=1.0, aspect=1.0):
    """Tileable voronoi: returns (F1, F2, cell id) for an n x n grid."""
    r = rng(seed)
    pts = r.random((count, 2))
    pts[:, 1] *= 1.0
    # tile points 3x3 for wrapping
    tiles = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            tiles.append(pts + np.array([dx, dy]))
    allp = np.concatenate(tiles)
    ids = np.tile(np.arange(count), 9)
    from scipy.spatial import cKDTree
    tree = cKDTree(allp * np.array([aspect, 1.0]))
    yy, xx = np.mgrid[0:n, 0:n]
    q = np.stack([(xx + 0.5) / n * aspect, (yy + 0.5) / n], -1).reshape(-1, 2)
    d, i = tree.query(q, k=2)
    f1 = d[:, 0].reshape(n, n)
    f2 = d[:, 1].reshape(n, n)
    cid = ids[i[:, 0]].reshape(n, n)
    return f1, f2, cid


def normal_from_height(h, strength=4.0):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nx = -gx * strength
    ny = gy * strength  # OpenGL convention (green up)
    nz = np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / l, ny / l, nz / l], -1)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def save(name, arr, q=88, lossless=False, exact=True):
    arr = np.clip(arr, 0, 1) if arr.dtype != np.uint8 else arr
    if arr.dtype != np.uint8:
        arr = (arr * 255 + 0.5).astype(np.uint8)
    mode = 'RGBA' if arr.shape[-1] == 4 else 'RGB'
    im = Image.fromarray(arr, mode)
    path = os.path.join(OUT, name + '.webp')
    im.save(path, 'WEBP', quality=q, method=6, lossless=lossless, exact=exact)
    print(f'{name:22s} {im.size} {os.path.getsize(path)//1024} KB')


def lerp(a, b, t):
    return a + (b - a) * t


def color(*c):
    return np.array(c, dtype=np.float64)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


N = 1024

# ---------------------------------------------------------------- roof tiles
# U runs along the eave (across the channels), V runs down the slope.
def roof():
    n = N
    channels = 8                  # pan+cover pairs across the texture
    rows = 7                      # tile courses down the slope
    yy, xx = np.mgrid[0:n, 0:n] / n
    u = (xx * channels) % 1.0     # position inside one channel pair
    v = (yy * rows)
    course = np.floor(v)
    fv = v - course
    cell = np.floor(xx * channels)
    # cover tiles occupy the band around u=0 (wrapping), pan tiles the rest
    du = np.minimum(u, 1 - u)     # 0 at cover centre, 0.5 at pan centre
    cover_w = 0.17
    cover = du < cover_w
    hc = np.sqrt(np.clip(1 - (du / cover_w) ** 2, 0, 1))          # convex bump
    pan_t = np.clip((du - cover_w) / (0.5 - cover_w), 0, 1)
    hp = 0.18 - 0.16 * np.sin(pan_t * math.pi * 0.5)                  # shallow concave
    # overlapping courses: each tile rises toward its lower edge, then steps
    # curved lower edge of each tile course (tiles are slightly rounded at the bottom)
    curve = 0.10 * (np.cos(np.clip(du / 0.5, 0, 1) * math.pi) * 0.5 + 0.5)
    fvc = (fv + np.where(cover, curve * 0.6, -curve * 0.4)) % 1.0
    lip = smooth(0.0, 0.9, fvc) * 0.18
    h = np.where(cover, 0.45 + hc * 0.75 + lip * 0.5, hp + lip)
    step = smooth(0.0, 0.05, fvc)
    h = h * (0.6 + 0.4 * step)
    fv = fvc
    rn = fnoise(n, 2.4, 11)
    h = h + (rn - 0.5) * 0.05
    # colour: dark fired clay with per-tile variation
    r = rng(5)
    tile_id = (course * 97 + cell * 13 + cover * 7).astype(int)
    var = r.random(4096)[tile_id % 4096]
    base = lerp(color(0.29, 0.30, 0.32), color(0.37, 0.37, 0.38), var[..., None])
    base = np.where(cover[..., None], base * 1.12, base * 0.92)
    warm = fnoise(n, 2.0, 12)[..., None]
    base = lerp(base, base * color(1.08, 1.0, 0.92), warm)
    # lichen / moss collects in the pan channels near overlaps
    moss_mask = (~cover) * smooth(0.55, 1.0, fv) * smooth(0.45, 0.75, fnoise(n, 2.2, 13))
    moss = color(0.36, 0.40, 0.22)
    base = lerp(base, moss, (moss_mask * 0.75)[..., None])
    lichen = smooth(0.82, 0.92, bandnoise(n, 60, 140, 14)) * (cover * 0.6 + 0.2)
    base = lerp(base, color(0.62, 0.60, 0.48), (lichen * 0.35)[..., None])
    # ambient occlusion from height
    ao = 0.78 + 0.22 * smooth(0.0, 0.7, h)
    alb = base * ao[..., None] * 1.15
    grime = fnoise(n, 1.6, 15)[..., None]
    alb *= lerp(0.85, 1.05, grime)
    save('roof-albedo', alb)
    save('roof-normal', normal_from_height(h, 12.0))


# ---------------------------------------------------------------- wood planks
def wood():
    n = N
    yy, xx = np.mgrid[0:n, 0:n] / n
    planks = 8
    pv = yy * planks
    pid = np.floor(pv)
    fv = pv - pid
    r = rng(21)
    off = r.random(64)[pid.astype(int) % 64]
    warp = fnoise(n, 2.2, 22) * 0.6
    grain_x = xx * 2 + off
    rings = np.sin((fv * 6 + warp * 8 + np.sin(grain_x * 6.283 * 2 + off * 9) * 0.6) * 6.283 * 2.0)
    fine = bandnoise(n, 120, 380, 23)
    streak = np.sin((yy * 180 + fnoise(n, 2.0, 24) * 25)) * 0.5 + 0.5
    tone = r.random(64)[pid.astype(int) % 64]
    c_dark = color(0.24, 0.14, 0.08)
    c_light = color(0.50, 0.33, 0.19)
    t = 0.35 + 0.25 * rings + 0.25 * (fine - 0.5) + 0.15 * (streak - 0.5)
    t = np.clip(t * 0.8 + tone * 0.35, 0, 1)
    alb = lerp(c_dark, c_light, t[..., None])
    gap = smooth(0.0, 0.03, fv) * smooth(0.0, 0.03, 1 - fv)
    alb *= (0.35 + 0.65 * gap)[..., None]
    # end joints
    joint_u = (xx * 2 + off * 1.0) % 1.0
    joint = smooth(0.0, 0.006, joint_u) * smooth(0.0, 0.006, 1 - joint_u)
    alb *= (0.45 + 0.55 * joint)[..., None]
    weather = smooth(0.4, 0.9, fnoise(n, 1.8, 25))[..., None]
    alb = lerp(alb, alb * color(0.85, 0.88, 0.9) + 0.06, weather * 0.5)
    h = gap * joint * (0.7 + 0.15 * rings + 0.15 * fine)
    save('wood-albedo', alb)
    save('wood-normal', normal_from_height(h, 5.0))


# ---------------------------------------------------------------- lime plaster
def plaster():
    n = N
    base = color(0.86, 0.81, 0.70)
    mott = fnoise(n, 2.0, 31)
    fine = bandnoise(n, 80, 300, 32)
    alb = base * (0.9 + 0.12 * mott[..., None] + 0.05 * (fine[..., None] - 0.5))
    # vertical water stains
    yy, xx = np.mgrid[0:n, 0:n] / n
    stains = fnoise(n, 2.2, 33, m=n)
    stains = ndimage.uniform_filter1d(stains, 90, axis=0, mode='wrap')
    st = smooth(0.55, 0.75, stains)
    alb = lerp(alb, alb * color(0.80, 0.78, 0.72), st[..., None] * 0.45)
    # fine cracks
    cr = bandnoise(n, 10, 40, 34)
    crack = 1 - smooth(0.0, 0.012, np.abs(cr - 0.5))
    crack *= smooth(0.55, 0.7, fnoise(n, 2.0, 35))
    alb *= (1 - crack[..., None] * 0.45)
    # patches of fallen plaster showing straw-clay underneath
    patch = smooth(0.86, 0.88, fnoise(n, 2.4, 36)) * 0.85
    alb = lerp(alb, color(0.55, 0.43, 0.30) * (0.8 + 0.3 * fine[..., None]), patch[..., None])
    h = 0.6 + 0.1 * mott + 0.05 * fine - crack * 0.3 - patch * 0.25
    save('plaster-albedo', alb)
    save('plaster-normal', normal_from_height(h, 3.0))


# ---------------------------------------------------------------- field-stone wall
def stone(name='stone', count=46, seed=41, moss_amt=0.55, aspect=1.7):
    n = N
    f1, f2, cid = voronoi(n, count, seed, aspect=aspect)
    edge = f2 - f1
    r = rng(seed + 1)
    tones = r.random((count, 3))
    base = lerp(color(0.46, 0.44, 0.40), color(0.72, 0.68, 0.61), tones[cid][..., :1])
    base = base * (0.9 + 0.2 * tones[cid][..., 1:2] * color(1.0, 0.97, 0.92))
    rough = fnoise(n, 2.2, seed + 2)
    fine = bandnoise(n, 90, 320, seed + 3)
    pillow = smooth(0.0, 0.11, edge) ** 0.45
    h = pillow * (0.8 + 0.12 * rough + 0.08 * fine)
    alb = base * (0.82 + 0.25 * rough[..., None] + 0.12 * (fine[..., None] - 0.5))
    alb = alb * (0.72 + 0.28 * pillow[..., None])
    mortar = 1 - smooth(0.004, 0.012, edge)
    alb = lerp(alb, color(0.25, 0.22, 0.17), mortar[..., None] * 0.85)
    # moss on upper faces (positive height gradient towards -y)
    gy = np.roll(h, 2, 0) - h
    top = smooth(0.0, 0.02, -gy)
    mossn = smooth(0.45, 0.8, fnoise(n, 2.0, seed + 4))
    moss = np.clip(top * 0.6 + mossn * 0.5, 0, 1) * moss_amt
    alb = lerp(alb, color(0.30, 0.38, 0.16) * (0.8 + 0.4 * fine[..., None]), moss[..., None])
    save(name + '-albedo', alb)
    save(name + '-normal', normal_from_height(h, 7.0))


# ---------------------------------------------------------------- ground set
def ground():
    n = N
    g1 = fnoise(n, 2.0, 51)
    g2 = bandnoise(n, 60, 250, 52)
    g3 = bandnoise(n, 250, 500, 53)
    grass = lerp(color(0.20, 0.33, 0.09), color(0.42, 0.52, 0.18), g1[..., None])
    grass = grass * (0.85 + 0.3 * g2[..., None]) * (0.9 + 0.2 * g3[..., None])
    dry = smooth(0.6, 0.85, fnoise(n, 2.2, 54))
    grass = lerp(grass, color(0.55, 0.52, 0.27), dry[..., None] * 0.6)
    clover = smooth(0.7, 0.8, bandnoise(n, 30, 70, 55))
    grass = lerp(grass, color(0.16, 0.30, 0.10), clover[..., None] * 0.5)
    save('grass-albedo', grass)

    d1 = fnoise(n, 2.0, 61)
    d1 = smooth(0.0, 1.0, fnoise(n, 1.5, 66))
    dirt = lerp(color(0.52, 0.43, 0.31), color(0.63, 0.54, 0.40), d1[..., None])
    dirt *= (0.85 + 0.3 * bandnoise(n, 80, 300, 62))[..., None]
    f1, f2, cid = voronoi(n, 900, 63)
    pebble = 1 - smooth(0.0, 0.006, f1)
    r = rng(64)
    keep = r.random(900)[cid] > 0.55
    pebble = pebble * keep
    tone = r.random(900)[cid]
    dirt = lerp(dirt, lerp(color(0.45, 0.42, 0.38), color(0.75, 0.72, 0.66), tone[..., None]), pebble[..., None])
    ruts = smooth(0.4, 0.6, bandnoise(n, 4, 12, 65))
    dirt *= (0.92 + 0.12 * ruts[..., None])
    h = 0.5 + 0.2 * d1 + pebble * 0.4
    save('dirt-albedo', dirt)
    save('dirt-normal', normal_from_height(h, 4.0))


def cobble():
    stone('cobble', count=150, seed=71, moss_amt=0.18, aspect=1.0)


# ---------------------------------------------------------------- tree bark
def bark():
    n = 512
    f = fnoise(n, 2.0, 81)
    strands = fnoise(n, 1.6, 82, m=n // 16)
    strands = np.array(Image.fromarray((strands * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)) / 255.0
    strands = (strands + np.roll(strands, n // 2, 0)) * 0.5   # keep it tileable after resize
    fiss = smooth(0.30, 0.55, np.abs(np.sin(strands * math.pi * 7)))
    plates = fiss * (0.85 + 0.15 * f)
    fine = bandnoise(n, 60, 200, 83)
    alb = lerp(color(0.16, 0.12, 0.09), color(0.44, 0.38, 0.31), (plates * 0.85 + fine * 0.15)[..., None])
    lichen = smooth(0.72, 0.86, fnoise(n, 2.2, 84))
    alb = lerp(alb, color(0.55, 0.58, 0.45), lichen[..., None] * 0.4)
    h = plates * 0.8 + fine * 0.2
    save('bark-albedo', alb)
    save('bark-normal', normal_from_height(h, 6.0))


# ---------------------------------------------------------------- cloth & straw
def cloth():
    n = 512
    yy, xx = np.mgrid[0:n, 0:n]
    weave = (np.sin(xx * math.pi / 2.0) * np.sin(yy * math.pi / 2.0))
    warp = (np.sin(xx * math.pi / 2.0) > 0) ^ (np.sin(yy * math.pi / 2.0) > 0)
    f = fnoise(n, 2.0, 91)
    slub = ndimage.uniform_filter1d(bandnoise(n, 40, 160, 92), 25, axis=1, mode='wrap')
    v = 0.78 + 0.1 * warp + 0.06 * weave + 0.1 * (f - 0.5) + 0.12 * (slub - 0.5)
    alb = np.repeat(v[..., None], 3, -1)
    save('cloth-albedo', alb)


def straw():
    n = 512
    yy, xx = np.mgrid[0:n, 0:n]
    s = 16
    a = ((xx // s + yy // s) % 2) == 0
    fib_h = np.sin(yy / s * math.pi * 6 + bandnoise(n, 30, 90, 101) * 3) * 0.5 + 0.5
    fib_v = np.sin(xx / s * math.pi * 6 + bandnoise(n, 30, 90, 102) * 3) * 0.5 + 0.5
    fib = np.where(a, fib_v, fib_h)
    cellu = (xx % s) / s
    cellv = (yy % s) / s
    pillow = np.sin(cellu * math.pi) * np.sin(cellv * math.pi)
    t = 0.45 + 0.35 * fib * pillow + 0.2 * fnoise(n, 2, 103)
    alb = lerp(color(0.42, 0.31, 0.15), color(0.80, 0.66, 0.40), t[..., None])
    save('straw-albedo', alb)
    save('straw-normal', normal_from_height(pillow * 0.7 + fib * 0.3, 3.0))


# ---------------------------------------------------------------- rice paper
def paper():
    n = 1024
    base = color(0.925, 0.900, 0.835)
    f = fnoise(n, 1.8, 111)
    alb = base * (0.95 + 0.07 * f[..., None])
    im = Image.fromarray((np.clip(alb, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(im, 'RGBA')
    r = rng(112)
    for i in range(2600):
        x, y = r.random(2) * n
        ang = r.random() * math.pi
        L = 6 + r.random() * 30
        pts = []
        for k in range(6):
            t = k / 5
            pts.append((x + math.cos(ang) * L * t + math.sin(t * 6 + i) * 2, y + math.sin(ang) * L * t + math.cos(t * 5 + i) * 2))
        shade = int(170 + r.random() * 70)
        alpha = int(20 + r.random() * 45)
        d.line(pts, fill=(shade, shade - 6, shade - 18, alpha), width=1)
    alb = np.asarray(im).astype(np.float64) / 255
    save('paper', alb, q=82)


# ---------------------------------------------------------------- noise RGBA for shaders
def noise_rgba():
    n = 512
    R = fnoise(n, 2.0, 121)
    G = bandnoise(n, 8, 64, 122)
    f1, f2, _ = voronoi(n, 120, 123)
    B = np.clip(f1 / f1.max(), 0, 1)
    A = bandnoise(n, 40, 200, 124)
    save('noise', np.stack([R, G, B, A], -1), lossless=True)


# ---------------------------------------------------------------- foliage atlas
def leaf_poly(cx, cy, L, W, ang):
    pts = []
    for k in range(9):
        t = k / 8
        w = math.sin(t * math.pi) * W
        pts.append((t * L, w))
    for k in range(8, -1, -1):
        t = k / 8
        w = math.sin(t * math.pi) * W
        pts.append((t * L, -w))
    ca, sa = math.cos(ang), math.sin(ang)
    return [(cx + px * ca - py * sa, cy + px * sa + py * ca) for px, py in pts]


def foliage():
    S = 512
    atlas = Image.new('RGBA', (S * 2, S * 2), (0, 0, 0, 0))
    r = rng(131)

    def cluster(kind):
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        c = S / 2
        if kind == 'broad':
            for i in range(900):
                a = r.random() * 2 * math.pi
                rad = (r.random() ** 0.6) * S * 0.42
                x = c + math.cos(a) * rad
                y = c + math.sin(a) * rad * 0.82 + 10
                shade = 1 - (y - c) / S * 0.9 - (rad / S) * 0.1
                shade = max(0.35, min(1.2, shade + r.normal() * 0.08))
                g = np.array([0.20, 0.38, 0.10]) * shade + r.normal(0, 0.03, 3)
                if r.random() < 0.18:
                    g = np.array([0.40, 0.52, 0.16]) * shade
                col = tuple(int(np.clip(v, 0, 1) * 255) for v in g) + (255,)
                L = 18 + r.random() * 16
                d.polygon(leaf_poly(x, y, L, L * 0.33, r.random() * 2 * math.pi), fill=col)
        elif kind == 'pine':
            # flat tiered pine pad seen from the side
            for i in range(1400):
                x = c + r.normal() * S * 0.2
                y = c + r.normal() * S * 0.07 + (abs(x - c) / S) ** 2 * 60
                L = 26 + r.random() * 20
                a = -math.pi / 2 + r.normal() * 0.9
                shade = 1.0 - (y - c) / (S * 0.15) * 0.35 + r.normal() * 0.08
                g = np.array([0.12, 0.25, 0.12]) * max(0.4, shade)
                col = tuple(int(np.clip(v, 0, 1) * 255) for v in g) + (255,)
                d.line([(x, y), (x + math.cos(a) * L, y + math.sin(a) * L)], fill=col, width=2)
        elif kind == 'blossom':
            for i in range(700):
                a = r.random() * 2 * math.pi
                rad = (r.random() ** 0.6) * S * 0.42
                x = c + math.cos(a) * rad
                y = c + math.sin(a) * rad * 0.8 + 10
                if r.random() < 0.3:
                    g = np.array([0.30, 0.42, 0.16])
                    L = 16 + r.random() * 10
                    col = tuple(int(np.clip(v, 0, 1) * 255) for v in g) + (255,)
                    d.polygon(leaf_poly(x, y, L, L * 0.33, r.random() * 6.28), fill=col)
                else:
                    shade = 1 - (y - c) / S * 0.6
                    pink = np.array([0.96, 0.66, 0.74]) * max(0.55, shade) + r.normal(0, 0.03, 3)
                    if r.random() < 0.25:
                        pink = np.array([1.0, 0.86, 0.88]) * max(0.6, shade)
                    col = tuple(int(np.clip(v, 0, 1) * 255) for v in pink) + (255,)
                    R = 5 + r.random() * 5
                    for p in range(5):
                        pa = p / 5 * 6.283 + r.random()
                        d.ellipse([x + math.cos(pa) * R * 0.6 - R * 0.5, y + math.sin(pa) * R * 0.6 - R * 0.5,
                                   x + math.cos(pa) * R * 0.6 + R * 0.5, y + math.sin(pa) * R * 0.6 + R * 0.5], fill=col)
        elif kind == 'bamboo':
            for i in range(260):
                x = c + r.normal() * S * 0.18
                y = c + r.normal() * S * 0.2
                L = 50 + r.random() * 40
                a = math.pi * 0.5 + r.normal() * 0.6 + (0.6 if x > c else -0.6)
                shade = 1 - (y - c) / S * 0.6 + r.normal() * 0.1
                g = np.array([0.26, 0.42, 0.14]) * max(0.45, shade)
                col = tuple(int(np.clip(v, 0, 1) * 255) for v in g) + (255,)
                d.polygon(leaf_poly(x, y, L, 6 + r.random() * 3, a), fill=col)
        return im

    tiles = [cluster('broad'), cluster('pine'), cluster('blossom'), cluster('bamboo')]
    for i, t in enumerate(tiles):
        atlas.paste(t, ((i % 2) * S, (i // 2) * S))
    arr = np.asarray(atlas).astype(np.float64) / 255
    # premultiplied-safe bleed: spread colour into transparent texels to avoid dark fringes
    rgb = arr[..., :3]
    a = arr[..., 3]
    mask = a > 0.5
    idx = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
    rgb = rgb[idx[0], idx[1]]
    out = np.concatenate([rgb, a[..., None]], -1)
    save('foliage-atlas', out, q=90)


# ---------------------------------------------------------------- ink brush strokes (alpha)
def brush():
    W, H = 1024, 256
    r = rng(141)
    yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W])[:, None, None][:, :, 0:1] if False else np.mgrid[0:H, 0:W]
    u = xx / W
    v = yy / H
    width = 0.32 + 0.12 * np.sin(u * 3.0 + 0.6) - 0.18 * smooth(0.75, 1.0, u)
    center = 0.5 + 0.04 * np.sin(u * 5.0)
    d = np.abs(v - center) / np.maximum(width, 0.02)
    bristles = bandnoise(W, 1, 1, 142)  # placeholder to keep rng order stable
    streak = np.sin((v * 90 + fnoise(W, 2.0, 143, m=H)[:H, :W] * 12))
    dry = smooth(0.55, 1.0, u) * smooth(-0.2, 0.9, streak * 0.5 + 0.5 + (fnoise(W, 2.2, 144, m=H) - 0.5))
    a = (1 - smooth(0.75, 1.0, d)) * smooth(0.0, 0.04, u) * (1 - smooth(0.96, 1.0, u))
    a = a * (1 - dry * 0.85)
    edge = fnoise(W, 1.4, 145, m=H)
    a = np.clip(a + (edge - 0.5) * 0.25 * (d > 0.6), 0, 1)
    rgb = np.zeros((H, W, 3)) + 0.06
    save('brush-stroke', np.concatenate([rgb, a[..., None]], -1), q=90)


if __name__ == '__main__':
    which = sys.argv[2:] or ['roof', 'wood', 'plaster', 'stone', 'ground', 'cobble', 'bark', 'cloth', 'straw', 'paper', 'noise', 'foliage', 'brush']
    for w in which:
        globals()[{'noise': 'noise_rgba'}.get(w, w)]()
