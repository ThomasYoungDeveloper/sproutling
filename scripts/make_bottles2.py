"""Potion, dye and item icons from Neprosto's Mad Scientist Laboratory pack (same artist as the pets).

Potions use the pack's bottles as they are. Each dye recolors a pack bottle's liquid to match its skin
(Shadow holds shadow, Galaxy holds a starfield...) in the same flat, cel-shaded style. Bottle shape shows rarity.

Usage: python3 scripts/make_bottles2.py <lab pack png folder> assets
"""
import sys, os
import numpy as np
from PIL import Image

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
    'pastel': ['#c9a0e0', '#f3b6d6', '#ffd9a8', '#fff3c4'], 'mono': ['#3a3a42', '#7c7c88', '#c4c4cc', '#f4f4f4'],
    'retro': ['#0f380f', '#306230', '#8bac0f', '#c4d93a'], 'slime': ['#1d6a14', '#3fb422', '#7fe03a', '#d2ff86'],
    'sakura': ['#a8346a', '#e0679a', '#f7a8c6', '#ffe0ee'], 'ocean': ['#0c1c5a', '#1e48a6', '#3b86d6', '#9fdcff'],
    'ember': ['#7a0a0a', '#d81c10', '#ff7a14', '#ffd23a'], 'moonlit': ['#1a1e5a', '#3a44a8', '#6e74d6', '#c8ccff'],
    'crystal': ['#1f3aa8', '#4f7ae8', '#9ec2ff', '#eef4ff'], 'shadow': ['#050308', '#16101f', '#2c2240', '#6a4aa0'],
    'galaxy': ['#05030f', '#1a0f40', '#3a1f7a', '#7e4fd6'], 'ancient': ['#2a1046', '#4e2486', '#7a4ac0', '#b48ae8'],
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
    if skin in ('galaxy',): add = [(specks(liq, 34, 3, 1.2, 2.4), '#ffffff'), (specks(liq, 10, 4, 1, 1.8), '#9fe6ff')]
    if skin == 'moonlit': add = [(specks(liq, 10, 5, 1.4, 2.6), '#fff3b0')]
    if skin == 'ancient': add = [(specks(liq, 40, 6, 1, 2), '#f0c75a')]
    if skin in ('slime', 'ocean'): add = [(specks(liq * (t < 0.8), 9, 8, 3, 6.5), '#ffffff')]
    if skin == 'sakura': add = [(specks(liq, 8, 9, 3, 5), '#fff0f6')]
    if skin == 'shadow':
        wisp = ((np.sin(xx / 14 + np.sin(yy / 20) * 2) > 0.85) & (level >= 2)).astype(np.float32) * liq
        add = [(wisp, '#a46bff')]
    for m, c in add:
        col = col * (1 - m[..., None]) + hexc(c) * m[..., None]
    rgb = a[..., :3] * (1 - liq[..., None]) + col * liq[..., None]
    return Image.fromarray(np.dstack([rgb, a[..., 3]]).astype(np.uint8), 'RGBA')

os.makedirs(f'{out}/dyes', exist_ok=True); os.makedirs(f'{out}/potions', exist_ok=True)
for k, r in DYES.items():
    dye(k, RARITY_SHAPE[r]).save(f'{out}/dyes/{k}.png', optimize=True)
for name, n in (('small', 128), ('full', 126)):
    Image.fromarray(load(n).astype(np.uint8), 'RGBA').save(f'{out}/potions/{name}.png', optimize=True)
print('made', len(DYES), 'dyes and 2 potions')
