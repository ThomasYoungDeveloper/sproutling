"""Potion, dye and item icons from Neprosto's Mad Scientist Laboratory pack (same artist as the pets).

Potions use the pack's bottles as they are. Each dye recolors a pack bottle's liquid to match its skin
(Shadow holds shadow, Galaxy holds a starfield...) in the same flat, cel-shaded style. Bottle shape shows rarity.

Usage: python3 scripts/make_bottles2.py <lab pack png folder> assets
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
SIZE = 300

def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)

def load(n):
    im = Image.open(f'{src}/Science Icon ({n}).png').convert('RGBA')
    w, h = im.size; s = SIZE / max(w, h)
    im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    c = Image.new('RGBA', (SIZE, SIZE)); c.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    return np.asarray(c, dtype=np.float32)

def hsv(a):
    rgb = a[..., :3] / 255
    mx, mn = rgb.max(-1), rgb.min(-1); d = np.maximum(mx - mn, 1e-4)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, (mx - mn) / np.maximum(mx, 1e-4), mx

# (pack icon, liquid hue range) for each bottle shape.
SHAPES = {'round': (128, (75, 170)), 'flask': (117, (245, 315)), 'spiral': (124, (175, 245)), 'double': (121, (75, 135))}
RARITY_SHAPE = {'common': 'round', 'uncommon': 'round', 'rare': 'flask', 'epic': 'spiral', 'legendary': 'double', 'event': 'round'}

# Four cel tones per dye, dark to light, plus what floats in it.
TONES = {
    'pastel': ['#c9a0e0', '#f3b6d6', '#ffd9a8', '#fff3c4'], 'mono': ['#0a0a0e', '#1c1c24', '#34343e', '#5a5a66'],
    'retro': ['#0f380f', '#306230', '#8bac0f', '#c4d93a'], 'slime': ['#1d6a14', '#3fb422', '#7fe03a', '#d2ff86'],
    'sakura': ['#a8346a', '#e0679a', '#f7a8c6', '#ffe0ee'], 'ocean': ['#0c1c5a', '#1e48a6', '#3b86d6', '#9fdcff'],
    'ember': ['#7a0a0a', '#d81c10', '#ff7a14', '#ffd23a'], 'moonlit': ['#1a1e5a', '#3a44a8', '#6e74d6', '#c8ccff'],
    'crystal': ['#1f3aa8', '#4f7ae8', '#9ec2ff', '#eef4ff'], 'shadow': ['#050308', '#16101f', '#2c2240', '#6a4aa0'],
    'galaxy': ['#000000', '#05030f', '#130a30', '#2c1666'], 'ancient': ['#2a1046', '#4e2486', '#7a4ac0', '#b48ae8'],
    'harvest': ['#7a2e0e', '#d25c1c', '#f69832', '#ffd88a'],
}
DYES = {'pastel': 'common', 'mono': 'common', 'retro': 'common', 'slime': 'uncommon', 'sakura': 'rare', 'ocean': 'rare',
        'ember': 'rare', 'moonlit': 'rare', 'crystal': 'epic', 'shadow': 'epic', 'galaxy': 'legendary', 'ancient': 'legendary',
        'harvest': 'event'}

def specks(mask, n, seed, rmin, rmax):
    rng = np.random.default_rng(seed); h, w = mask.shape; m = np.zeros((h, w), dtype=np.float32)
    ys, xs = np.nonzero(mask > 0.5); yy, xx = np.mgrid[0:h, 0:w]
    for _ in range(n if len(ys) else 0):
        k = rng.integers(0, len(ys)); r = rng.uniform(rmin, rmax)
        m = np.maximum(m, np.clip((r - np.sqrt((yy - ys[k]) ** 2 + (xx - xs[k]) ** 2)) / 0.9, 0, 1))
    return m * mask

def dye(skin, shape):
    n, (h0, h1) = SHAPES[shape]
    a = load(n)
    h, s, v = hsv(a)
    liq = ((h >= h0) & (h <= h1) & (s > 0.3) & (v > 0.22) & (a[..., 3] > 200)).astype(np.float32)
    if not liq.any(): return Image.fromarray(a.astype(np.uint8))
    vv = v[liq > 0]
    q = np.quantile(vv, [0.25, 0.55, 0.85])
    level = np.digitize(v, q)  # 0..3, following the art's own cel shading
    tones = np.stack([hexc(c) for c in TONES[skin]])
    col = tones[np.clip(level, 0, 3)]
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    ys = np.nonzero(liq)[0]; top, bot = ys.min(), ys.max(); t = (yy - top) / max(bot - top, 1)
    if skin == 'pastel':
        band = np.floor(((xx + yy * 0.6) / 34)) % 4
        pal = np.stack([hexc(c) for c in ['#ffc2dc', '#ffe2b4', '#c8f0d8', '#cfe0ff']])
        col = pal[band.astype(int)] * np.where(level[..., None] == 0, 0.86, 1.0)
    if skin == 'ember':
        heat = np.clip(level + (t < 0.35) * 1 - (t > 0.75) * 1, 0, 3)
        col = tones[heat.astype(int)]
    if skin == 'retro':
        B = 12
        lv = np.asarray(Image.fromarray((level * 60).astype(np.uint8)).resize((SIZE // B, SIZE // B), Image.BOX).resize((SIZE, SIZE), Image.NEAREST)) / 60
        col = tones[np.clip(np.round(lv), 0, 3).astype(int)]
    if skin == 'crystal':
        rng = np.random.default_rng(7); k = 14
        py, px = rng.uniform(top, bot, k), rng.uniform(0, SIZE, k); tilt = rng.integers(-1, 2, k)
        idx = np.stack([(yy - py[i]) ** 2 + (xx - px[i]) ** 2 for i in range(k)]).argmin(0)
        col = tones[np.clip(level + tilt[idx], 0, 3)]
    add = []
    post = []
    if skin == 'galaxy':
        # Like the Galaxy skin: near-black space, soft magenta and blue nebula, lots of white stars and a few sparkles.
        from scipy import ndimage
        inside = ndimage.binary_fill_holes(ndimage.binary_closing(liq > 0, iterations=4)).astype(np.float32)
        r2 = np.random.default_rng(31)
        neb = np.zeros((SIZE, SIZE), dtype=np.float32); neb2 = neb.copy()
        for k in range(4):
            cx, cy, rr = r2.uniform(0, SIZE), r2.uniform(top, bot), r2.uniform(25, 55)
            (neb if k % 2 == 0 else neb2)[...] += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * rr * rr)))
        col = col * (1 - (neb * 0.55)[..., None]) + hexc('#c23ab8') * (neb * 0.55)[..., None] * (0.5 + level[..., None] / 6)
        col = col * (1 - (neb2 * 0.45)[..., None]) + hexc('#3f7fff') * (neb2 * 0.45)[..., None] * (0.5 + level[..., None] / 6)
        stars = (r2.random((SIZE, SIZE)) > 0.975).astype(np.float32) * inside
        big = specks(inside, 26, 3, 1.4, 2.6)
        sp = np.zeros((SIZE, SIZE), dtype=np.float32)
        ys2, xs2 = np.nonzero(inside > 0.5)
        for _ in range(5):
            k = r2.integers(0, len(ys2)); cy, cx = ys2[k], xs2[k]
            sp = np.maximum(sp, np.clip(1 - (np.abs(xx - cx) / 9 + np.abs(yy - cy) / 1.4), 0, 1))
            sp = np.maximum(sp, np.clip(1 - (np.abs(yy - cy) / 9 + np.abs(xx - cx) / 1.4), 0, 1))
        post = [(stars, '#ffffff'), (big, '#ffffff'), (specks(inside, 10, 4, 1, 1.8), '#9fe6ff'), (sp * inside, '#ffffff')]
    if skin == 'moonlit': add = [(specks(liq, 10, 5, 1.4, 2.6), '#fff3b0')]
    if skin == 'ancient':
        # Gold hieroglyphs carved into the liquid: an eye, an ankh, a feather and a zigzag (water).
        from PIL import ImageDraw
        g = Image.new('L', (SIZE, SIZE), 0); d = ImageDraw.Draw(g)
        main = liq * (xx < SIZE * 0.68)
        ys, xs = np.nonzero(main)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        cxs = [x0 + (x1 - x0) * f for f in (0.32, 0.72)]
        cys = [y0 + (y1 - y0) * f for f in (0.33, 0.72)]
        L = 6
        def eye(cx, cy):
            d.ellipse([cx - 20, cy - 10, cx + 20, cy + 10], outline=255, width=L)
            d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=255)
            d.line([cx - 2, cy + 10, cx - 8, cy + 22], fill=255, width=L)
            d.line([cx + 8, cy + 9, cx + 14, cy + 20, cx + 20, cy + 16], fill=255, width=L - 1)
        def ankh(cx, cy):
            d.ellipse([cx - 10, cy - 28, cx + 10, cy - 6], outline=255, width=L)
            d.line([cx, cy - 6, cx, cy + 25], fill=255, width=L)
            d.line([cx - 15, cy + 3, cx + 15, cy + 3], fill=255, width=L)
        def feather(cx, cy):
            d.line([cx, cy - 25, cx, cy + 25], fill=255, width=L - 1)
            d.ellipse([cx - 10, cy - 28, cx + 10, cy + 8], outline=255, width=L - 1)
        def zig(cx, cy):
            pts = [(cx - 25 + i * 8, cy + (4 if i % 2 else -4)) for i in range(7)]
            d.line(pts, fill=255, width=L, joint='curve')
        eye(cxs[0], cys[0]); ankh(cxs[1], cys[0] + 10); zig((cxs[0] + cxs[1]) / 2 - 10, cys[1] + 4)
        from scipy import ndimage
        inside = ndimage.binary_fill_holes(ndimage.binary_closing(liq > 0, iterations=4)).astype(np.float32)
        glyph = np.asarray(g, dtype=np.float32) / 255 * inside
        edge = np.clip(np.asarray(Image.fromarray((glyph * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)), dtype=np.float32) / 255 - glyph, 0, 1) * inside
        add = [(specks(liq, 24, 6, 1, 1.8), '#f0c75a')]
        post = [(edge, '#6a3a0a'), (glyph, '#f6cf55')]
    if skin in ('slime', 'ocean'): add = [(specks(liq * (t < 0.8), 9, 8, 3, 6.5), '#ffffff')]
    if skin == 'sakura': add = [(specks(liq, 8, 9, 3, 5), '#fff0f6')]
    if skin == 'shadow':
        wisp = ((np.sin(xx / 14 + np.sin(yy / 20) * 2) > 0.85) & (level >= 2)).astype(np.float32) * liq
        add = [(wisp, '#a46bff')]
    if skin == 'harvest':
        # Autumn leaves floating in the liquid: little maple and oval leaves in red, orange and gold.
        from PIL import ImageDraw
        from scipy import ndimage
        inside = ndimage.binary_fill_holes(ndimage.binary_closing(liq > 0, iterations=4)).astype(np.float32)
        ys, xs = np.nonzero(liq); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        spots = [(0.3, 0.33, 22, 25, '#b8241a'), (0.7, 0.36, 15, -30, '#ffd23a'), (0.5, 0.68, 22, 60, '#d43a14'), (0.8, 0.72, 13, 10, '#ffd23a'), (0.2, 0.7, 16, -40, '#9a1a14')]
        for k, (fx, fy, r, ang, c) in enumerate(spots):
            cx, cy = x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy
            g = Image.new('L', (SIZE, SIZE), 0); d = ImageDraw.Draw(g)
            if k % 2 == 0:
                # maple: 5 points
                # maple: three big lobes up and two side lobes, each with small teeth, plus a stem
                prof = [1.0, 0.55, 0.8, 0.5, 0.95, 0.35, 0.9, 0.5, 0.75, 0.55, 0.62, 0.3, 0.2, 0.3, 0.62, 0.55, 0.75, 0.5, 0.9, 0.35, 0.95, 0.5, 0.8, 0.55]
                prof = prof[12:] + prof[:12]
                pts = [(cx + r * 1.3 * q * np.cos(np.radians(ang - 90 + i * 15)), cy + r * 1.3 * q * np.sin(np.radians(ang - 90 + i * 15))) for i, q in enumerate(prof)]
                d.polygon(pts, fill=255)
                tb = np.radians(ang + 90)
                d.line([cx, cy, cx + r * 1.1 * np.cos(tb), cy + r * 1.1 * np.sin(tb)], fill=255, width=3)
            else:
                t = np.radians(ang)
                w2 = lambda u: 0.42 * abs(np.sin(u)) ** 0.8 * np.sign(np.sin(u))
                pts = [(cx + r * np.cos(t) * np.cos(u) - r * w2(u) * np.sin(t), cy + r * np.sin(t) * np.cos(u) + r * w2(u) * np.cos(t)) for u in np.linspace(0, 2 * np.pi, 32)]
                d.polygon(pts, fill=255)
            m = np.asarray(g, dtype=np.float32) / 255 * inside
            edge = np.clip(np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)), dtype=np.float32) / 255 - m, 0, 1) * inside
            vein = np.zeros((SIZE, SIZE), dtype=np.float32)
            vg = Image.new('L', (SIZE, SIZE), 0); ImageDraw.Draw(vg).line([cx - r * 0.6 * np.cos(np.radians(ang)), cy - r * 0.6 * np.sin(np.radians(ang)), cx + r * 0.8 * np.cos(np.radians(ang)), cy + r * 0.8 * np.sin(np.radians(ang))], fill=255, width=2)
            vein = np.asarray(vg, dtype=np.float32) / 255 * m
            post += [(edge, '#5a200a'), (m, c), (vein * 0.6, '#5a200a')]
    for m, c in add:
        col = col * (1 - m[..., None]) + hexc(c) * m[..., None]
    # The pack's shine on the liquid keeps a hint of its original color: make those highlights neutral.
    ys2, xs2 = np.nonzero(liq)
    box = np.zeros_like(liq); box[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1] = 1
    shine = ((h >= h0 - 15) & (h <= h1 + 15) & (s > 0.08) & (v > 0.6) & (liq == 0) & (box > 0) & (a[..., 3] > 200)).astype(np.float32)
    grey = a[..., :3].mean(-1, keepdims=True)
    a[..., :3] = a[..., :3] * (1 - shine[..., None]) + np.clip(grey * 1.08, 0, 255) * shine[..., None]
    rgb = a[..., :3] * (1 - liq[..., None]) + col * liq[..., None]
    for m, c in post:
        rgb = rgb * (1 - m[..., None]) + hexc(c) * m[..., None]
    return Image.fromarray(np.dstack([rgb, a[..., 3]]).astype(np.uint8), 'RGBA')

os.makedirs(f'{out}/dyes', exist_ok=True); os.makedirs(f'{out}/potions', exist_ok=True)
for k, r in DYES.items():
    dye(k, RARITY_SHAPE[r]).save(f'{out}/dyes/{k}.png', optimize=True)
for name, n in (('small', 128), ('full', 126)):
    Image.fromarray(load(n).astype(np.uint8), 'RGBA').save(f'{out}/potions/{name}.png', optimize=True)
print('made', len(DYES), 'dyes and 2 potions')
