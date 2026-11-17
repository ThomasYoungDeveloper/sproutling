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
        res = ramp(lum, [(0, '#2a0600'), (0.35, '#a3260a'), (0.65, '#ff7a1f'), (1, '#ffe08a')])
        halo, halo_color = glow(alpha, 5, 1.8), hexc('#ff8a2a')
    elif skin == 'frost':
        res = ramp(lum, [(0, '#1b3550'), (0.4, '#6fa6d6'), (0.75, '#cfe8ff'), (1, '#ffffff')])
        sp = stars(h, w, 40, seed, 1) * alpha
        res = res * (1 - sp[..., None]) + 255 * sp[..., None]
        halo, halo_color = glow(alpha, 3, 1.6), hexc('#e8f6ff')
    elif skin == 'harvest':
        res = ramp(lum, [(0, '#2b1400'), (0.35, '#7a3b0a'), (0.65, '#d9862b'), (1, '#ffe2a6')])
    elif skin == 'spooky':
        res = ramp(lum, [(0, '#140a26'), (0.45, '#6a3fb5'), (0.8, '#c7a6ff'), (1, '#f4ecff')])
        alpha = alpha * (0.62 + 0.25 * (yy < h * 0.7))
        halo, halo_color = glow(alpha, 7, 1.2), hexc('#a77bff')
    elif skin == 'galaxy':
        rng = np.random.default_rng(seed)
        neb = np.zeros((h, w), dtype=np.float32)
        for _ in range(6):
            cx, cy, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(w * 0.15, w * 0.4)
            neb += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)))
        neb = np.clip(neb / neb.max(), 0, 1)
        base = ramp(neb, [(0, '#0a0624'), (0.5, '#3b1f7a'), (0.8, '#c04fb8'), (1, '#5fc8ff')])
        shade = 0.35 + 0.65 * lum
        res = base * shade[..., None]
        sp = stars(h, w, 120, seed + 1, 1) * alpha
        res = res * (1 - sp[..., None]) + 255 * sp[..., None]
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
        res = rgb * 255 * 0.55 + 255 * 0.45
        res = res * 0.9 + hexc('#ffe6f5') * 0.1
        dark = (lum < 0.18)[..., None]
        res = np.where(dark, rgb * 255 * 0.8 + hexc('#6a5a80') * 0.2, res)
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
    if halo is not None:
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
