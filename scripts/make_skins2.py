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

SKINS = ['ancient', 'sakura', 'moonlit', 'ocean', 'ember', 'frost', 'harvest', 'spooky', 'galaxy', 'crystal', 'shadow', 'pastel', 'retro', 'ink']


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


def eye_mask(lum, alpha):
    """Rough iris finder for the Shadow dye. An iris is a small mid-tone blob in the upper part of the pet
    that is ringed by the white of the eye, or ringed by a dark outline with a shine dot inside it."""
    from scipy import ndimage
    h, w = lum.shape
    mid = (lum >= 0.22) & (lum < 0.72) & (alpha > 0.5)
    lab, n = ndimage.label(mid)
    m = np.zeros((h, w), dtype=bool)
    if n == 0:
        return m.astype(np.float32)
    ys = np.nonzero(alpha > 0.5)[0]
    top, bot = ys.min(), ys.max()
    objs = ndimage.find_objects(lab)
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        y0, y1 = max(sl[0].start - 4, 0), min(sl[0].stop + 4, h)
        x0, x1 = max(sl[1].start - 4, 0), min(sl[1].stop + 4, w)
        comp = lab[y0:y1, x0:x1] == (i + 1)
        area = comp.sum()
        if not (10 <= area <= h * w * 0.01):
            continue
        cy = (sl[0].start + sl[0].stop) / 2
        if not (top <= cy <= top + (bot - top) * 0.62):
            continue
        filled = ndimage.binary_fill_holes(comp)
        holes = filled & ~comp
        ring = ndimage.binary_dilation(filled, iterations=2) & ~filled
        L = lum[y0:y1, x0:x1]
        white_ring = (L[ring] > 0.88).mean() if ring.any() else 0
        dark_ring = (L[ring] < 0.22).mean() if ring.any() else 0
        shine = (holes & (L > 0.85)).sum()
        if white_ring >= 0.3 or (dark_ring >= 0.55 and shine >= 2):
            m[y0:y1, x0:x1] |= comp
    return m.astype(np.float32)


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
    elif skin == 'ancient':
        # Ancient relic card: speckled royal purple with rainbow holo patches, gold glitter,
        # carved gold glyphs, and gold outlines in place of black.
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        l2 = np.clip(lum / max(hi, 1e-3) * 0.85, 0, 1)
        res = ramp(l2, [(0, '#1a0a33'), (0.35, '#3c1a6e'), (0.65, '#6a3aa8'), (0.9, '#9a6ad0'), (1, '#c8a0f0')])
        def blobs(n, sd):
            m = np.zeros((h, w), dtype=np.float32); r2 = np.random.default_rng(sd)
            for _ in range(n):
                cx, cy, r = r2.uniform(0, w), r2.uniform(0, h), r2.uniform(w * 0.08, w * 0.2)
                m += np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)))
            return np.clip(m / max(m.max(), 1e-3), 0, 1) ** 1.5
        line = np.clip((0.2 - lum) / 0.1, 0, 1) * alpha
        body = alpha * (1 - line)
        for col, sd in (('#e0403a', 41), ('#2fbfa8', 43), ('#3a7ae0', 47)):
            b = blobs(3, seed + sd) * 0.32 * body
            res = res * (1 - b[..., None]) + hexc(col) * b[..., None] * (0.5 + l2[..., None] * 0.6)
        # Glitter speckle: gold and dark flecks like the foil card.
        r3 = np.random.default_rng(seed + 53)
        n = r3.random((h, w)).astype(np.float32)
        gold = (n > 0.93).astype(np.float32) * body
        dark = (n < 0.05).astype(np.float32) * body
        res = res * (1 - gold[..., None] * 0.7) + hexc('#f0c75a') * gold[..., None] * 0.7
        res = res * (1 - dark[..., None] * 0.5) + hexc('#140826') * dark[..., None] * 0.5
        # Carved glyphs in gold.
        gly = np.zeros((h, w), dtype=np.float32)
        G = 22
        for gy in range(G // 2, h, G):
            for gx in range(G // 2, w, G):
                if r3.random() < 0.5:
                    continue
                kind = r3.integers(0, 4)
                ox, oy = gx + r3.integers(-3, 4), gy + r3.integers(-3, 4)
                if kind == 0: pts = [(ox - 4 + k, oy) for k in range(9)] + [(ox, oy - 4 + k) for k in range(9)]
                elif kind == 1: pts = [(ox - 4 + k // 2, oy + 4 - k) for k in range(9)] + [(ox + k // 2, oy - 4 + k) for k in range(9)] + [(ox - 2 + k, oy + 4) for k in range(5)]
                elif kind == 2: pts = [(ox + int(4 * np.cos(a)), oy + int(3 * np.sin(a))) for a in np.linspace(np.pi, 2 * np.pi, 16)] + [(ox, oy)]
                else: pts = [(ox - 3, oy - 4 + k) for k in range(9)] + [(ox + 3, oy - 4 + k) for k in range(9)] + [(ox - 3 + k, oy - 4) for k in range(7)]
                for (x2, y2) in pts:
                    for dx in (0, 1):
                        if 0 <= x2 + dx < w and 0 <= y2 < h:
                            gly[y2, x2 + dx] = 1
        gly = gly * body * np.clip((l2 - 0.15) * 3, 0, 1)
        res = res * (1 - gly[..., None] * 0.75) + hexc('#f0c75a') * gly[..., None] * 0.75
        # Gold outlines, shaded a little darker at the very edge.
        res = res * (1 - line[..., None]) + hexc('#d9a83a') * line[..., None]
        edge = np.clip((0.1 - lum) / 0.08, 0, 1) * alpha
        res = res * (1 - edge[..., None] * 0.5) + hexc('#7a5214') * edge[..., None] * 0.5
    elif skin == 'ocean':
        # Jellyfish: a see-through deep-sea body with a glowing cyan-to-pink rim on the inside of the
        # outline, soft bioluminescent spots, and faint trailing ribs on the lower half.
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        l2 = np.clip(lum / max(hi, 1e-3) * 0.85, 0, 1)
        res = ramp(l2, [(0, '#050a30'), (0.3, '#0e2266'), (0.55, '#1d4aa6'), (0.78, '#3b86d6'), (1, '#9fdcff')])
        line = np.clip((0.22 - lum) / 0.1, 0, 1)
        body = alpha * (1 - line)
        def blur(m, r):
            return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255
        # Inner rim: bright just inside the outer edge and along the inner lines.
        edge = np.clip(1 - blur(body, 6) * 1.05, 0, 1) * body
        edge = np.maximum(edge, blur(line, 3.0) * 1.8 * body)
        edge = np.clip(edge * 2.4, 0, 1) ** 0.8
        t = np.clip(yy / max(h - 1, 1), 0, 1)
        rimc = ramp(t, [(0, '#8ff8ff'), (0.45, '#7fdcff'), (0.75, '#c09aff'), (1, '#ff9ade')])
        res = res * (1 - edge[..., None] * 0.95) + rimc * edge[..., None] * 0.95
        # Trailing ribs on the lower half, like tentacles seen through the bell.
        ribs = (0.5 + 0.5 * np.sin(xx / 3.2 + np.sin(yy / 11.0) * 1.4)) ** 6
        ribs = ribs * np.clip((t - 0.45) * 2.5, 0, 1) * body * 0.35
        res = res * (1 - ribs[..., None]) + hexc('#a9e8ff') * ribs[..., None]
        # Bioluminescent spots.
        r2 = np.random.default_rng(seed + 9)
        ys, xs = np.nonzero(body > 0.6)
        spots = np.zeros((h, w), dtype=np.float32)
        for _ in range(22 if len(ys) else 0):
            k = r2.integers(0, len(ys)); cy, cx = ys[k], xs[k]; rr = r2.uniform(1.5, 3.2)
            spots = np.maximum(spots, np.clip(1 - np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / rr, 0, 1))
        spots = blur(spots, 0.8) * body
        spc = ramp(t, [(0, '#e6fdff'), (1, '#ffd4f2')])
        res = res * (1 - spots[..., None] * 0.9) + spc * spots[..., None] * 0.9
        # Soft gloss near the top.
        gloss = np.clip((l2 - 0.7) * 4, 0, 1) * np.clip(1 - t * 2.2, 0, 1) * body
        res = res * (1 - blur(gloss, 1.5)[..., None] * 0.6) + 255 * blur(gloss, 1.5)[..., None] * 0.6
        res = res * (1 - line[..., None]) + hexc('#050a2a') * line[..., None]
        # See-through bell: the middle is a little translucent, the glowing rim and lines stay solid.
        alpha = alpha * np.clip(0.86 + edge * 0.14 + line, 0, 1)
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
        # Keep the outlines and inner lines solid black so the character's design reads clearly.
        dark = np.clip((0.26 - lum) / 0.12, 0, 1)[..., None]
        res = res * (1 - dark) + hexc('#0a0000') * dark
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
        # Stretch each pet's own light range so dark-colored pets get the same depth as light ones
        # (otherwise a dark pet turns into a flat black shape). The body never drops below deep violet;
        # only the real outlines go black.
        inner = (alpha > 0.8) & (lum > 0.14)
        lo = np.percentile(lum[inner], 8) if inner.any() else 0.0
        hi = np.percentile(lum[inner], 92) if inner.any() else 1.0
        gl = np.clip((lum - lo) / max(hi - lo, 0.15), 0, 1) * 0.8 + 0.08
        base = ramp(gl, [(0, '#000000'), (0.2, '#07041a'), (0.45, '#140b38'), (0.7, '#241258'), (0.88, '#3a2290'), (1, '#5a3cc0')])
        shade = (0.35 + 0.9 * gl)[..., None]
        res = base * (1 - pink[..., None] * 0.5) + hexc('#c23ab8') * pink[..., None] * 0.5 * shade
        res = res * (1 - cyan[..., None] * 0.35) + hexc('#3fb8ff') * cyan[..., None] * 0.35 * shade
        # Keep the outlines dark so the pet still reads clearly.
        dark = np.clip((0.14 - lum) / 0.08, 0, 1)[..., None]
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
        # Cut gemstone: the body is split into flat, angular facets (Voronoi cells). Each facet tilts toward
        # or away from the light so it gets one flat tone, the facet edges catch a thin light or dark bevel,
        # and a diagonal band of facets flashes bright like a reflection.
        rng = np.random.default_rng(seed)
        n = max(40, int(h * w / 520))
        py, px = rng.uniform(0, h, n), rng.uniform(0, w, n)
        d1 = np.full((h, w), 1e9, dtype=np.float32); d2 = d1.copy(); idx = np.zeros((h, w), dtype=np.int32)
        for i in range(n):
            d = (yy - py[i]) ** 2 + (xx - px[i]) ** 2
            closer = d < d1
            d2 = np.where(closer, d1, np.minimum(d2, d)); d1 = np.where(closer, d, d1); idx = np.where(closer, i, idx)
        gap = np.sqrt(d2) - np.sqrt(d1)
        tilt = rng.uniform(-1, 1, n).astype(np.float32)
        # Reflection band: facets whose centers sit on a diagonal strip get a strong flash.
        band = np.abs(((px + py) / (w + h)) - 0.42) < 0.07
        flash = np.where(band, rng.uniform(0.3, 0.5, n), 0).astype(np.float32)
        ft = tilt[idx]; ff = flash[idx]
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        l2 = np.clip(lum / max(hi, 1e-3) * 0.62 + ft * 0.2 + ff, 0, 1)
        res = ramp(l2, [(0, '#0d1652'), (0.25, '#1f3aa8'), (0.48, '#3f6ae0'), (0.68, '#7fa6ff'), (0.86, '#cddcff'), (1, '#ffffff')])
        # Bevels: a thin edge between facets, light on the lit side and dark on the shaded side.
        bev = np.clip(1 - gap / 1.6, 0, 1)
        lit = (ft > 0).astype(np.float32)
        res = res * (1 - bev[..., None] * 0.55) + (hexc('#eef3ff') * lit[..., None] + hexc('#1a2670') * (1 - lit[..., None])) * bev[..., None] * 0.55
        # A few four-point sparkles on the brightest facets.
        line = np.clip((0.2 - lum) / 0.1, 0, 1)
        body = alpha * (1 - line)
        ys, xs = np.nonzero((body > 0.5) & (l2 > 0.75))
        for _ in range(5 if len(ys) else 0):
            k = rng.integers(0, len(ys)); cy, cx = ys[k], xs[k]
            for d in range(-6, 7):
                a = max(0.0, 1 - abs(d) / 7)
                for (y2, x2) in ((cy + d, cx), (cy, cx + d)):
                    if 0 <= y2 < h and 0 <= x2 < w and body[y2, x2] > 0:
                        res[y2, x2] = res[y2, x2] * (1 - a) + 255 * a
        # Keep the outlines dark navy so the pet's design reads.
        res = res * (1 - line[..., None]) + hexc('#0c1446') * line[..., None]
        halo, halo_color = glow(alpha, 3, 1.3), hexc('#cfe0ff')
    elif skin == 'shadow':
        # A dark body with the outlines glowing violet.
        res = ramp(lum, [(0, '#000000'), (0.6, '#141018'), (0.85, '#2a2236'), (1, '#3a3050')])
        lines = np.clip((0.22 - lum) / 0.12, 0, 1) * alpha
        res = res * (1 - lines[..., None]) + hexc('#b86bff') * lines[..., None]
        # Eyes always glow purple too. Colored eyes (red, blue, lavender...) would otherwise sink into the
        # dark body, so find small enclosed shapes in the face that hold a white shine dot and fill them.
        eyes = eye_mask(lum, alpha)
        res = res * (1 - eyes[..., None]) + hexc('#b86bff') * eyes[..., None]
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
        pal = [(0, '#ff7fb6'), (25, '#ff9cc6'), (45, '#ffc27a'), (62, '#ffe466'), (110, '#7de8b0'), (175, '#7cccff'), (225, '#9aa0ff'), (275, '#c296ff'), (320, '#ff8fd6'), (360, '#ff7fb6')]
        hs = np.array([x for x, _ in pal], dtype=np.float32)
        cs = np.stack([hexc(c) for _, c in pal])
        col = np.zeros(hue.shape + (3,), dtype=np.float32)
        for k in range(3):
            col[..., k] = np.interp(hue, hs, cs[:, k])
        t = (yy / max(h - 1, 1))[..., None]
        wash = np.where(t < 0.5, hexc('#ffb0d6') * (1 - t * 2) + hexc('#c9aaff') * (t * 2), hexc('#c9aaff') * (2 - t * 2) + hexc('#9ee0ff') * (t * 2 - 1))
        wash = wash * 0.92 + 255 * 0.08
        grey = np.clip((0.22 - sat) / 0.12, 0, 1)[..., None]
        col = col * (1 - grey) + wash * grey
        # Dark clothes and hair turn soft lavender instead of grey.
        mid = (np.clip((0.5 - lum) / 0.2, 0, 1) * np.clip((lum - 0.2) / 0.06, 0, 1))[..., None]
        col = col * (1 - mid) + hexc('#b08ef0') * mid
        hi = np.percentile(lum[alpha > 0.8], 90) if (alpha > 0.8).any() else 1.0
        ln = np.clip(lum / max(hi, 1e-3), 0, 1)[..., None]
        res = col * (0.82 + 0.2 * ln)
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
