"""Generates the second wave of skins for every pet image.

Habit skins: sakura, moonlit, ocean, ember. Seasonal: frost, harvest, spooky.
Rare loot: galaxy, crystal, shadow. Style: pastel, retro, ink.

Usage: python3 scripts/make_skins2.py assets/pets assets/skins [p01,p02] [skin1,skin2]
"""
import sys, os, math
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
only = sys.argv[3].split(',') if len(sys.argv) > 3 and sys.argv[3] else None
which = sys.argv[4].split(',') if len(sys.argv) > 4 else None

SKINS = ['sakura', 'moonlit', 'ocean', 'ember', 'frost', 'harvest', 'spooky', 'galaxy', 'crystal', 'shadow', 'pastel', 'retro', 'ink']


def hexc(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)


def ramp(lum, stops):
    """Maps luminance (0..1) through color stops [(pos, '#hex'), ...]."""
    xs = np.array([p for p, _ in stops], dtype=np.float32)
    cs = np.stack([hexc(c) for _, c in stops])
    outc = np.zeros(lum.shape + (3,), dtype=np.float32)
    for k in range(3):
        outc[..., k] = np.interp(lum, xs, cs[:, k])
    return outc


def stars(h, w, n, seed, size=1):
    rng = np.random.default_rng(seed)
    m = np.zeros((h, w), dtype=np.float32)
    ys, xs = rng.integers(0, h, n), rng.integers(0, w, n)
    for y, x in zip(ys, xs):
        m[max(0, y - size + 1):y + size, max(0, x - size + 1):x + size] = 1.0
    return m


def glow(alpha, radius, strength):
    """A soft halo around the pet's outline (outside it only)."""
    a = Image.fromarray((alpha * 255).astype(np.uint8))
    blur = np.asarray(a.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255
    return np.clip(blur * strength, 0, 1) * (1 - alpha)


def make(path, skin, seed):
    im = Image.open(path).convert('RGBA')
    arr = np.asarray(im, dtype=np.float32) / 255
    rgb, alpha = arr[..., :3], arr[..., 3]
    h, w = alpha.shape
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    halo = None
    halo_color = None

    if skin == 'sakura':
        res = ramp(lum, [(0, '#5a1530'), (0.35, '#c2477a'), (0.7, '#f7a8c6'), (1, '#fff0f6')])
        petals = stars(h, w, 26, seed, 3) * alpha
        res = res * (1 - petals[..., None] * 0.7) + hexc('#ffffff') * petals[..., None] * 0.7
    elif skin == 'moonlit':
        # Royal purple with a warm gold shine along the inside of the outlines, like moonlight on the edges.
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        l2 = np.clip(lum / max(hi, 1e-3) * 0.85, 0, 1)
        res = ramp(l2, [(0, '#0c0420'), (0.3, '#2a0d5e'), (0.6, '#5a2aa8'), (0.85, '#8c5ad8'), (1, '#c4a0ff')])
        line = (lum < 0.2).astype(np.float32) * alpha
        near = np.asarray(Image.fromarray((line * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)), dtype=np.float32) / 255
        rim = np.clip(near - line, 0, 1) * alpha * np.clip((l2 - 0.2) * 3, 0, 1)
        res = res * (1 - rim[..., None] * 0.75) + hexc('#ffcf5a') * rim[..., None] * 0.75
        sp = stars(h, w, 30, seed, 1) * alpha * (1 - line)
        res = res * (1 - sp[..., None]) + hexc('#fff0b8') * sp[..., None]
    elif skin == 'ocean':
        # Living water: clear blues with light ripple patterns, glossy white highlights and a few bubbles.
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        l2 = np.clip(lum / max(hi, 1e-3) * 0.85, 0, 1)
        res = ramp(l2, [(0, '#05233f'), (0.3, '#0b4f8f'), (0.55, '#1688d0'), (0.78, '#4cc2f2'), (1, '#c8f2ff')])
        # Caustics: soft light ripples like sunlight through water.
        c1 = np.abs(np.sin(xx / 9.0 + np.sin(yy / 13.0) * 1.8))
        c2 = np.abs(np.sin(yy / 8.0 + np.sin(xx / 15.0) * 1.6))
        caust = np.clip(1 - np.minimum(c1, c2) * 4, 0, 1) * 0.45 * np.clip(l2 * 1.5, 0, 1)
        res = res * (1 - caust[..., None]) + hexc('#bff0ff') * caust[..., None]
        line = (lum < 0.2).astype(np.float32)
        body = alpha * (1 - line)
        # Glossy highlights on the brightest, upper-left parts.
        gloss = np.clip((l2 - 0.72) * 5, 0, 1) * np.clip(1.2 - (xx + yy) / (w + h) * 1.6, 0, 1) * body
        g2 = np.asarray(Image.fromarray((gloss * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32) / 255
        res = res * (1 - g2[..., None] * 0.8) + 255 * g2[..., None] * 0.8
        # Bubbles: little rings.
        r2 = np.random.default_rng(seed + 9)
        ys, xs = np.nonzero(body > 0.5)
        for _ in range(10 if len(ys) else 0):
            k = r2.integers(0, len(ys)); cy, cx = ys[k], xs[k]; rr = r2.uniform(2.5, 5)
            ring = np.clip(1 - np.abs(np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) - rr) / 1.0, 0, 1) * body
            res = res * (1 - ring[..., None] * 0.7) + hexc('#e8fbff') * ring[..., None] * 0.7
        alpha = alpha * np.where(line > 0, 1.0, 0.93)
    elif skin == 'ember':
        # Living fire: bright reds with orange and yellow hot spots, and a few charred black patches,
        # like glowing lava. Shading still follows the pet so it reads clearly.
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        l2 = np.clip(lum / max(hi, 1e-3) * 0.85, 0, 1)
        r2 = np.random.default_rng(seed + 5)
        grid = r2.random((max(2, h // 14), max(2, w // 14))).astype(np.float32)
        heat = np.asarray(Image.fromarray((grid * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float32) / 255
        t = 1 - yy / max(h - 1, 1)
        heat = np.clip(heat * 0.75 + t * 0.35 + (l2 - 0.5) * 0.4, 0, 1)
        res = ramp(heat, [(0, '#120000'), (0.18, '#3a0000'), (0.32, '#9a0a0a'), (0.5, '#d81c10'), (0.68, '#f2420f'), (0.82, '#ff7a14'), (0.93, '#ffb21e'), (1, '#ffe25a')])
        res = res * (0.55 + 0.45 * l2)[..., None] + res * 0.25
    elif skin == 'frost':
        res = ramp(lum, [(0, '#1b3550'), (0.4, '#6fa6d6'), (0.75, '#cfe8ff'), (1, '#ffffff')])
        sp = stars(h, w, 40, seed, 1) * alpha
        res = res * (1 - sp[..., None]) + 255 * sp[..., None]
        halo, halo_color = glow(alpha, 3, 1.6), hexc('#e8f6ff')
    elif skin == 'harvest':
        # Deep autumn tones; the brightest parts land on pumpkin and gold rather than cream.
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        l2 = np.clip(lum / max(hi, 1e-3) * 0.82, 0, 1)
        res = ramp(l2, [(0, '#28120a'), (0.25, '#78300e'), (0.5, '#d25c1c'), (0.75, '#f69832'), (0.9, '#ffc86e'), (1, '#ffe8b4')])
    elif skin == 'spooky':
        res = ramp(lum, [(0, '#140a26'), (0.45, '#6a3fb5'), (0.8, '#c7a6ff'), (1, '#f4ecff')])
        alpha = alpha * (0.62 + 0.25 * (yy < h * 0.7))
        halo, halo_color = glow(alpha, 7, 1.2), hexc('#a77bff')
    elif skin == 'galaxy':
        # Deep space: near-black navy and violet, with magenta and cyan nebula clouds,
        # lit by the pet's own shading, and lots of white and light-blue star specks.
        rng = np.random.default_rng(seed)
        def clouds(n, lo, hi, sd):
            m = np.zeros((h, w), dtype=np.float32)
            r2 = np.random.default_rng(sd)
            for _ in range(n):
                cx, cy, r = r2.uniform(0, w), r2.uniform(0, h), r2.uniform(w * lo, w * hi)
                m += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)))
            return np.clip(m / max(m.max(), 1e-3), 0, 1)
        pink = clouds(5, 0.10, 0.28, seed + 11) ** 1.4
        cyan = clouds(4, 0.08, 0.22, seed + 23) ** 1.8
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        gl = np.clip(lum / max(hi, 1e-3) * 0.78, 0, 1)
        base = ramp(gl, [(0, '#000000'), (0.35, '#05030f'), (0.6, '#130a30'), (0.85, '#2c1666'), (1, '#4e2fa0')])
        shade = (0.35 + 0.9 * gl)[..., None]
        res = base * (1 - pink[..., None] * 0.5) + hexc('#c23ab8') * pink[..., None] * 0.5 * shade
        res = res * (1 - cyan[..., None] * 0.35) + hexc('#3fb8ff') * cyan[..., None] * 0.35 * shade
        # Keep the outlines dark so the pet still reads clearly.
        dark = np.clip((0.2 - lum) / 0.12, 0, 1)[..., None]
        res = res * (1 - dark) + hexc('#030208') * dark
        body = alpha * (lum > 0.14)
        w1 = stars(h, w, 300, seed + 1, 1) * body
        w2 = stars(h, w, 30, seed + 2, 2) * body
        b1 = stars(h, w, 110, seed + 3, 1) * body
        res = res * (1 - w1[..., None]) + 255 * w1[..., None]
        res = res * (1 - b1[..., None]) + hexc('#9fe6ff') * b1[..., None]
        res = res * (1 - w2[..., None] * 0.9) + 255 * w2[..., None] * 0.9
        # A few four-point sparkles.
        for _ in range(6):
            ys, xs = np.nonzero(body > 0.5)
            if not len(ys):
                break
            k = rng.integers(0, len(ys))
            cy, cx = ys[k], xs[k]
            for d in range(-5, 6):
                a = max(0.0, 1 - abs(d) / 6)
                for (yy2, xx2) in ((cy + d, cx), (cy, cx + d)):
                    if 0 <= yy2 < h and 0 <= xx2 < w and body[yy2, xx2] > 0:
                        res[yy2, xx2] = res[yy2, xx2] * (1 - a) + 255 * a
        halo, halo_color = glow(alpha, 5, 1.0), hexc('#9b6bff')
    elif skin == 'crystal':
        facet = (np.floor(xx / 18) + np.floor(yy / 18) + np.floor((xx + yy) / 26)) % 3 / 2
        l2 = np.clip(lum * 0.75 + facet * 0.25, 0, 1)
        res = ramp(l2, [(0, '#1a2a6b'), (0.4, '#5f7fe0'), (0.7, '#b9c8ff'), (1, '#ffffff')])
        shine = ((xx - yy) % 90 < 3).astype(np.float32) * 0.18
        res = np.clip(res + shine[..., None] * 255, 0, 255)
        # A few four-point sparkles.
        rng = np.random.default_rng(seed)
        body = alpha * (lum > 0.2)
        ys, xs = np.nonzero(body > 0.5)
        for _ in range(6 if len(ys) else 0):
            k = rng.integers(0, len(ys)); cy, cx = ys[k], xs[k]
            for d in range(-6, 7):
                a = max(0.0, 1 - abs(d) / 7)
                for (y2, x2) in ((cy + d, cx), (cy, cx + d)):
                    if 0 <= y2 < h and 0 <= x2 < w and body[y2, x2] > 0:
                        res[y2, x2] = res[y2, x2] * (1 - a) + 255 * a
        halo, halo_color = glow(alpha, 3, 1.3), hexc('#cfe0ff')
    elif skin == 'shadow':
        # A dark body with the outlines glowing violet.
        res = ramp(lum, [(0, '#000000'), (0.6, '#141018'), (0.85, '#2a2236'), (1, '#3a3050')])
        lines = np.clip((0.22 - lum) / 0.12, 0, 1) * alpha
        res = res * (1 - lines[..., None]) + hexc('#b86bff') * lines[..., None]
        halo, halo_color = glow(alpha, 6, 1.5), hexc('#7a3cff')
    elif skin == 'pastel':
        # Candy colors like macarons: each part of the pet keeps its own color family, made soft and light
        # (pink, peach, butter, mint, baby blue, periwinkle, lavender). Whites get a pink-lavender-mint wash,
        # and outlines turn soft plum instead of black.
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        mx, mn = rgb.max(-1), rgb.min(-1)
        sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-3), 0)
        d = np.maximum(mx - mn, 1e-3)
        hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
        pal = [(0, '#ff9ec4'), (25, '#ffb8d2'), (45, '#ffd9a8'), (62, '#fff09a'), (110, '#a8f0c8'), (175, '#a8dcff'), (225, '#b8bcff'), (275, '#d6b8ff'), (320, '#ffa8e0'), (360, '#ff9ec4')]
        hs = np.array([x for x, _ in pal], dtype=np.float32)
        cs = np.stack([hexc(c) for _, c in pal])
        col = np.zeros(hue.shape + (3,), dtype=np.float32)
        for k in range(3):
            col[..., k] = np.interp(hue, hs, cs[:, k])
        t = (yy / max(h - 1, 1))[..., None]
        wash = np.where(t < 0.5, hexc('#ffd6ea') * (1 - t * 2) + hexc('#e6d8ff') * (t * 2), hexc('#e6d8ff') * (2 - t * 2) + hexc('#d2f5e4') * (t * 2 - 1))
        wash = wash * 0.8 + 255 * 0.2
        grey = np.clip((0.22 - sat) / 0.12, 0, 1)[..., None]
        col = col * (1 - grey) + wash * grey
        # Dark clothes and hair turn soft lavender instead of grey.
        mid = (np.clip((0.5 - lum) / 0.2, 0, 1) * np.clip((lum - 0.2) / 0.06, 0, 1))[..., None]
        col = col * (1 - mid) + hexc('#c9b2f2') * mid
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        ln = np.clip(lum / max(hi, 1e-3), 0, 1)[..., None]
        res = col * (0.86 + 0.14 * ln)
        dark = np.clip((0.2 - lum) / 0.1, 0, 1)[..., None]
        res = res * (1 - dark) + hexc('#7a6a96') * dark
    elif skin == 'retro':
        # Game Boy greens on a clean 4px grid. Each block averages its colors, and any block that
        # touches an outline stays darkest, so faces and edges stay readable.
        B = 4
        gw, gh = w // B, h // B
        img = Image.fromarray((arr * 255).astype(np.uint8))
        small = np.asarray(img.resize((gw, gh), Image.BOX), dtype=np.float32) / 255
        slum = 0.299 * small[..., 0] + 0.587 * small[..., 1] + 0.114 * small[..., 2]
        lumimg = Image.fromarray((np.where(alpha > 0.5, lum, 1) * 255).astype(np.uint8))
        lowest = np.asarray(lumimg.filter(ImageFilter.MinFilter(3)).resize((gw, gh), Image.NEAREST), dtype=np.float32) / 255
        lv = np.clip(np.floor(np.clip(slum / max(slum[small[..., 3] > 0.5].max() if (small[..., 3] > 0.5).any() else 1, 1e-3), 0, 0.999) * 3) + 1, 1, 3)
        lv = np.where(lowest < 0.2, 0, lv)
        pal = np.stack([hexc('#0f380f'), hexc('#306230'), hexc('#8bac0f'), hexc('#c4d93a')])
        resg = pal[lv.astype(int)]
        res = np.asarray(Image.fromarray(resg.astype(np.uint8)).resize((w, h), Image.NEAREST), dtype=np.float32)
        alpha = np.asarray(Image.fromarray(((small[..., 3] > 0.45) * 255).astype(np.uint8)).resize((w, h), Image.NEAREST), dtype=np.float32) / 255
    elif skin == 'ink':
        l2 = np.clip((lum - 0.15) * 1.5, 0, 1)
        l2 = np.round(l2 * 3) / 3
        res = ramp(l2, [(0, '#111111'), (0.34, '#4a4a4a'), (0.67, '#a8a39a'), (1, '#f6f0e3')])
        res = res * 0.92 + hexc('#f2e8d0') * 0.08
    else:
        raise ValueError(skin)

    res = np.clip(res, 0, 255)
    a_out = alpha
    # Skins only recolor the pet itself: anything around the pet is an aura's job.
    if halo is not None and os.environ.get('SKIN_HALO'):
        res = res * alpha[..., None] + halo_color * (1 - alpha[..., None])
        a_out = np.clip(alpha + halo, 0, 1)
    outarr = np.dstack([res, a_out * 255]).astype(np.uint8)
    img = Image.fromarray(outarr, 'RGBA')
    return img.quantize(colors=128, method=Image.Quantize.FASTOCTREE)


skins = which or SKINS
for skin in skins:
    os.makedirs(f'{out}/{skin}', exist_ok=True)
names = sorted(f[:-4] for f in os.listdir(src) if f.endswith('.png'))
for i, pid in enumerate(names):
    if only and pid not in only:
        continue
    for skin in skins:
        make(f'{src}/{pid}.png', skin, seed=i * 31 + 7).save(f'{out}/{skin}/{pid}.png', optimize=True)
print('made', len(only) if only else len(names), 'pets x', len(skins), 'skins')
