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
        res = ramp(lum, [(0, '#070b24'), (0.4, '#24306e'), (0.75, '#6f7fd6'), (1, '#e4e8ff')])
        sp = stars(h, w, 60, seed, 1) * alpha
        res = res * (1 - sp[..., None]) + hexc('#fff6c8') * sp[..., None]
        halo, halo_color = glow(alpha, 6, 1.4), hexc('#8fa0ff')
    elif skin == 'ocean':
        res = ramp(lum, [(0, '#03314a'), (0.4, '#0f7fa8'), (0.75, '#5fd6e8'), (1, '#e6fbff')])
        wave = (np.sin(xx / 9 + yy / 14) * 0.5 + 0.5) * 0.15
        res = np.clip(res + wave[..., None] * 255, 0, 255)
        alpha = alpha * 0.85
    elif skin == 'ember':
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        l2 = np.clip(lum / max(hi, 1e-3) * 0.8, 0, 1)
        res = ramp(l2, [(0, '#1a0000'), (0.35, '#8c0c12'), (0.62, '#e2302a'), (0.85, '#ff7b3a'), (1, '#ffd36b')])
        halo, halo_color = glow(alpha, 5, 1.8), hexc('#ff8a2a')
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
        base = ramp(gl, [(0, '#030208'), (0.3, '#0e0628'), (0.55, '#2a0f63'), (0.8, '#4b1fa0'), (1, '#7a4fe0')])
        shade = (0.35 + 0.9 * gl)[..., None]
        res = base * (1 - pink[..., None] * 0.85) + hexc('#e03fc8') * pink[..., None] * 0.85 * shade
        res = res * (1 - cyan[..., None] * 0.75) + hexc('#3fd8ff') * cyan[..., None] * 0.75 * shade
        # Keep the outlines dark so the pet still reads clearly.
        dark = np.clip((0.2 - lum) / 0.12, 0, 1)[..., None]
        res = res * (1 - dark) + hexc('#030208') * dark
        body = alpha * (lum > 0.14)
        w1 = stars(h, w, 220, seed + 1, 1) * body
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
        shine = ((xx - yy) % 40 < 4).astype(np.float32) * 0.35
        res = np.clip(res + shine[..., None] * 255, 0, 255)
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
        small = Image.fromarray((arr * 255).astype(np.uint8)).resize((w // 5, h // 5), Image.NEAREST).resize((w, h), Image.NEAREST)
        sarr = np.asarray(small, dtype=np.float32) / 255
        slum = 0.299 * sarr[..., 0] + 0.587 * sarr[..., 1] + 0.114 * sarr[..., 2]
        lv = np.clip(np.floor(slum * 4), 0, 3)
        pal = np.stack([hexc('#0f380f'), hexc('#306230'), hexc('#8bac0f'), hexc('#9bbc0f')])
        res = pal[lv.astype(int)]
        alpha = (sarr[..., 3] > 0.5).astype(np.float32)
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
