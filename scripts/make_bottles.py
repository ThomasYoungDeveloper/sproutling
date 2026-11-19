"""(Replaced by make_bottles2.py.) Builds potion and dye bottle icons from the 2D Potion Icon Pack (MiMU STUDIO, Unity Asset Store).

Each dye keeps the pack's glass, cork and shine, and swaps the liquid for one that matches its skin
(Shadow dye holds shadow, Galaxy dye holds a starfield, and so on). The bottle shape shows the rarity.

Usage: python3 scripts/make_bottles.py <pack sprites folder> assets
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
SCALE = 2  # 150px art upscaled to 300px for crisp large icons

def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
def ramp(v, stops):
    xs = np.array([p for p, _ in stops], dtype=np.float32); cs = np.stack([hexc(c) for _, c in stops])
    o = np.zeros(v.shape + (3,), dtype=np.float32)
    for k in range(3): o[..., k] = np.interp(v, xs, cs[:, k])
    return o

def load(name):
    im = Image.open(f'{src}/{name}.png').convert('RGBA')
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32)

def liquid_of(shape):
    """The red version of a bottle gives us where the liquid is and how it's shaded."""
    a = load(f'pot{shape}red')
    e = load(f'pot{shape}empty')
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    # Liquid = reddish pixels that differ from the empty bottle (so the cork and glass stay as they are).
    diff = np.abs(a[..., :3] - e[..., :3]).sum(-1) + np.abs(al - e[..., 3])
    red = np.clip((r - np.maximum(g, b) - 25) / 40, 0, 1) * (al > 40) * np.clip((diff - 30) / 40, 0, 1)
    shade = np.clip(r / 255, 0, 1)
    return a, red, shade

def dots(h, w, n, seed, rmin, rmax, mask):
    rng = np.random.default_rng(seed); m = np.zeros((h, w), dtype=np.float32)
    ys, xs = np.nonzero(mask > 0.5)
    yy, xx = np.mgrid[0:h, 0:w]
    for _ in range(n if len(ys) else 0):
        k = rng.integers(0, len(ys)); r = rng.uniform(rmin, rmax)
        m = np.maximum(m, np.clip((r - np.sqrt((yy - ys[k]) ** 2 + (xx - xs[k]) ** 2)) / 1.2, 0, 1))
    return m

def blobs(h, w, n, seed, lo, hi):
    rng = np.random.default_rng(seed); m = np.zeros((h, w), dtype=np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    for _ in range(n):
        cx, cy, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(w * lo, w * hi)
        m += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)))
    return np.clip(m / max(m.max(), 1e-3), 0, 1)

def fill(skin, shade, mask, h, w):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ys = np.nonzero(mask > 0.5)[0]
    top, bot = (ys.min(), ys.max()) if len(ys) else (0, h)
    t = np.clip((yy - top) / max(bot - top, 1), 0, 1)  # 0 at the liquid's surface, 1 at the bottom
    s = shade
    W = 255
    if skin == 'pastel':
        hue = (xx / w + t * 0.6) % 1
        c = ramp(hue, [(0, '#ffb0d4'), (0.2, '#ffd2a8'), (0.4, '#ffeb98'), (0.6, '#b4ecc8'), (0.8, '#b4d6ff'), (1, '#d4c0ff')])
        return c * (0.72 + 0.3 * s[..., None] ** 1.5)
    if skin == 'mono':
        return ramp(s * 0.9 + (1 - t) * 0.1, [(0, '#2a2a30'), (0.5, '#8a8a94'), (1, '#f2f2f2')])
    if skin == 'retro':
        B = 4 * SCALE
        bx, by = np.floor(xx / B) * B, np.floor(yy / B) * B
        sb = np.asarray(Image.fromarray((s * 255).astype(np.uint8)).resize((w // B, h // B), Image.BOX).resize((w, h), Image.NEAREST), dtype=np.float32) / 255
        tb = np.clip((by - top) / max(bot - top, 1), 0, 1)
        v = np.floor(np.clip(sb * 0.7 + (1 - tb) * 0.35, 0, 0.999) * 4)
        return np.stack([hexc('#0f380f'), hexc('#306230'), hexc('#8bac0f'), hexc('#c4d93a')])[v.astype(int)]
    if skin == 'slime':
        c = ramp(s * 0.7 + (1 - t) * 0.3, [(0, '#1d6a14'), (0.4, '#3fb422'), (0.75, '#7fe03a'), (1, '#d2ff86')])
        b = dots(h, w, 16, 3, 1.5 * SCALE, 4 * SCALE, mask * (t < 0.85))
        return c * (1 - b[..., None] * 0.8) + W * b[..., None] * 0.8
    if skin == 'sakura':
        c = ramp(s * 0.7 + (1 - t) * 0.3, [(0, '#9a2a5a'), (0.45, '#e0679a'), (0.8, '#f7a8c6'), (1, '#fff0f6')])
        p = dots(h, w, 9, 5, 2 * SCALE, 3.5 * SCALE, mask)
        return c * (1 - p[..., None] * 0.85) + hexc('#fff4f8') * p[..., None] * 0.85
    if skin == 'ocean':
        c = ramp(s * 0.6 + (1 - t) * 0.4, [(0, '#050a30'), (0.35, '#12317a'), (0.65, '#2a68c0'), (1, '#7fdcff')])
        glow = blobs(h, w, 5, 9, 0.05, 0.12) * mask
        c = c * (1 - glow[..., None] * 0.5) + ramp(t, [(0, '#8ff8ff'), (1, '#ff9ade')]) * glow[..., None] * 0.5
        b = dots(h, w, 10, 11, 1.2 * SCALE, 2.5 * SCALE, mask)
        return c * (1 - b[..., None] * 0.7) + hexc('#e6fdff') * b[..., None] * 0.7
    if skin == 'ember':
        n = blobs(h, w, 14, 13, 0.04, 0.1)
        heat = np.clip(n * 0.6 + (1 - t) * 0.5 + (s - 0.5) * 0.3, 0, 1)
        return ramp(heat, [(0, '#1a0000'), (0.25, '#8a0a0a'), (0.45, '#d81c10'), (0.65, '#ff6a14'), (0.85, '#ffb21e'), (1, '#ffe25a')])
    if skin == 'moonlit':
        c = ramp(s * 0.6 + (1 - t) * 0.3, [(0, '#12164a'), (0.5, '#3a44a8'), (1, '#a8b0ff')])
        st = dots(h, w, 14, 17, 0.6 * SCALE, 1.1 * SCALE, mask)
        return c * (1 - st[..., None]) + hexc('#fff6c8') * st[..., None]
    if skin == 'crystal':
        rng = np.random.default_rng(19); n = 18
        py, px = rng.uniform(0, h, n), rng.uniform(0, w, n); tilt = rng.uniform(-1, 1, n)
        d = np.stack([(yy - py[i]) ** 2 + (xx - px[i]) ** 2 for i in range(n)]); idx = d.argmin(0)
        v = np.clip(s * 0.5 + 0.3 + tilt[idx] * 0.25, 0, 1)
        return ramp(v, [(0, '#0d1652'), (0.3, '#1f3aa8'), (0.55, '#4f7ae8'), (0.8, '#b8ccff'), (1, '#ffffff')])
    if skin == 'shadow':
        c = ramp(s * 0.5 + (1 - t) * 0.2, [(0, '#000000'), (0.6, '#160f22'), (1, '#3a2a58')])
        wisp = blobs(h, w, 6, 23, 0.06, 0.14) ** 2 * mask
        return c * (1 - wisp[..., None] * 0.7) + hexc('#b86bff') * wisp[..., None] * 0.7
    if skin == 'galaxy':
        neb = blobs(h, w, 5, 29, 0.08, 0.2) ** 1.5
        cy = blobs(h, w, 4, 31, 0.06, 0.15) ** 1.8
        c = ramp(s * 0.4, [(0, '#000000'), (0.6, '#0a0620'), (1, '#24124e')])
        c = c * (1 - neb[..., None] * 0.55) + hexc('#c23ab8') * neb[..., None] * 0.55
        c = c * (1 - cy[..., None] * 0.4) + hexc('#3fb8ff') * cy[..., None] * 0.4
        st = dots(h, w, 40, 37, 0.5 * SCALE, 0.9 * SCALE, mask)
        return c * (1 - st[..., None]) + W * st[..., None]
    if skin == 'ancient':
        c = ramp(s * 0.6 + (1 - t) * 0.2, [(0, '#1a0a33'), (0.5, '#5a2e98'), (1, '#a878e0')])
        holo = blobs(h, w, 5, 41, 0.06, 0.14) ** 1.5
        c = c * (1 - holo[..., None] * 0.3) + ramp(xx / w, [(0, '#e0403a'), (0.5, '#2fbfa8'), (1, '#3a7ae0')]) * holo[..., None] * 0.3
        g = (np.random.default_rng(43).random((h, w)) > 0.93).astype(np.float32)
        return c * (1 - g[..., None] * 0.8) + hexc('#f0c75a') * g[..., None] * 0.8
    if skin == 'harvest':
        return ramp(s * 0.7 + (1 - t) * 0.3, [(0, '#5a200a'), (0.4, '#c24e14'), (0.75, '#f69832'), (1, '#ffd88a')])
    if skin == 'potion_small':
        return ramp(s ** 1.6, [(0, '#2a8a18'), (0.5, '#4fc22a'), (1, '#9cec5a')])
    if skin == 'potion_full':
        return ramp(s ** 1.6, [(0, '#8a0e1c'), (0.5, '#e0283a'), (1, '#ff6a6a')])
    raise ValueError(skin)

# Bottle shape for each rarity (pack numbering).
SHAPE = {'common': 3, 'uncommon': 11, 'rare': 15, 'epic': 14, 'legendary': 17, 'event': 20}
DYES = {'pastel': 'common', 'mono': 'common', 'retro': 'common', 'slime': 'uncommon', 'sakura': 'rare', 'ocean': 'rare',
        'ember': 'rare', 'moonlit': 'rare', 'crystal': 'epic', 'shadow': 'epic', 'galaxy': 'legendary', 'ancient': 'legendary',
        'harvest': 'event'}
POTIONS = {'potion_small': 5, 'potion_full': 4}

def _blur(m, r):
    return np.asarray(Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255
def _grow(m, px):
    return np.asarray(Image.fromarray((m > 0.5).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(px * 2 + 1)), dtype=np.float32) / 255

def chibi(a, liquid, col, kind=''):
    """Restyles a pack bottle to match the pets: flat cel-shaded colors, simple shine and a thick dark outline."""
    h, w = liquid.shape
    al = a[..., 3] / 255
    sil = (al > 0.45).astype(np.float32)
    rgb = a[..., :3]
    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    cork = ((r > g + 12) & (g > b + 6) & (liquid < 0.3) & (sil > 0)).astype(np.float32)
    cork = (_blur(cork, 1.2) > 0.5).astype(np.float32)
    from scipy import ndimage
    lm = _blur(liquid, 1.0) > 0.5
    lm = ndimage.binary_closing(lm, iterations=6)
    lm = ndimage.binary_fill_holes(lm)
    liq = lm.astype(np.float32) * sil * (1 - cork)
    glass = sil * (1 - liq) * (1 - cork)
    # Liquid: smooth away the fine detail, then 3 flat tones that keep each pixel's own hue.
    speckled = kind in ('galaxy', 'ancient', 'moonlit', 'sakura', 'slime', 'ocean')
    c = np.clip(col, 0, 255).astype(np.float32) if speckled else np.asarray(Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5)), dtype=np.float32)
    cl = np.maximum(c.mean(-1, keepdims=True), 1)
    sm = _blur(lum, 2.0)
    lv = np.where(sm < 0.33, 0.72, np.where(sm < 0.62, 0.9, 1.08))[..., None]
    liq_rgb = np.clip(c * lv, 0, 255)
    # Glass: a pale blue with a slightly darker inner edge.
    glass_rgb = np.broadcast_to(hexc('#dcf1fb'), (h, w, 3))
    cork_rgb = np.where((_blur(lum, 2) < 0.42)[..., None], hexc('#9a5f30'), hexc('#cf9256'))
    out = glass_rgb * glass[..., None] + liq_rgb * liq[..., None] + cork_rgb * cork[..., None]
    # Shine: one clean rounded highlight on the upper left of the bottle's body, plus a small dot,
    # like the soft shine on the pets.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ys, xs = np.nonzero(liq > 0.5) if liq.sum() > 50 else np.nonzero(sil > 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    cy, cx = y0 + (y1 - y0) * 0.3, x0 + (x1 - x0) * 0.27
    ry, rx = (y1 - y0) * 0.16, (x1 - x0) * 0.075
    th = -0.5
    u = ((xx - cx) * np.cos(th) + (yy - cy) * np.sin(th)) / max(rx, 1)
    v = (-(xx - cx) * np.sin(th) + (yy - cy) * np.cos(th)) / max(ry, 1)
    interior = (_blur(sil, 4) > 0.97).astype(np.float32)
    shine = ((u * u + v * v) < 1).astype(np.float32)
    dot = (((xx - (cx + rx * 1.6)) ** 2 + (yy - (cy - ry * 0.9)) ** 2) < (rx * 0.75) ** 2).astype(np.float32)
    shine = np.maximum(shine, dot) * interior * (1 - cork)
    out = out * (1 - shine[..., None] * 0.92) + 255 * shine[..., None] * 0.92
    # Outline color: the liquid's own color, darkened (like the pets' tinted lines).
    if liq.sum() > 0:
        mean = (liq_rgb * liq[..., None]).sum((0, 1)) / liq.sum()
    else:
        mean = hexc('#5a6a7a')
    ink = mean * 0.22 + hexc('#141826') * 0.78
    inner = np.zeros((h, w), dtype=np.float32)
    for m in (liq, cork):
        inner = np.maximum(inner, _grow(m, 2) * (1 - m) * sil)
    out = out * (1 - inner[..., None]) + ink * inner[..., None]
    outer = _grow(sil, 6)
    ring = outer * (1 - sil)
    final = out * sil[..., None] + ink * ring[..., None]
    alpha = np.clip(_blur(outer, 0.7) * 1.15, 0, 1)
    return Image.fromarray(np.dstack([final, alpha * 255]).astype(np.uint8), 'RGBA')

def make(kind, shape):
    a, mask, shade = liquid_of(shape)
    h, w = mask.shape
    col = fill(kind, shade, mask, h, w)
    return chibi(a, mask, col, kind)

os.makedirs(f'{out}/dyes', exist_ok=True); os.makedirs(f'{out}/potions', exist_ok=True)
for d, r in DYES.items():
    make(d, SHAPE[r]).save(f'{out}/dyes/{d}.png', optimize=True)
# Potions use the pack's own green and red bottles as they are.
for name, shape, kind in (('small', 5, 'potion_small'), ('full', 4, 'potion_full')):
    make(kind, shape).save(f'{out}/potions/{name}.png', optimize=True)
print('made', len(DYES), 'dyes and', len(POTIONS), 'potions')
