"""Generates skin variants (silver, gold, rainbow; 'mono' is now the Ink style from make_skins2.py) of every pet image."""
import sys, os, colorsys
from PIL import Image, ImageOps, ImageEnhance

src, out = sys.argv[1], sys.argv[2]
only = sys.argv[3].split(',') if len(sys.argv) > 3 else None

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
def grad(stops, t):
    for i in range(len(stops) - 1):
        (a, ca), (b, cb) = stops[i], stops[i + 1]
        if t <= b:
            f = (t - a) / (b - a) if b > a else 0
            return tuple(int(ca[k] + (cb[k] - ca[k]) * f) for k in range(3))
    return stops[-1][1]

CHROME = [(0, hexc('#141a26')), (0.28, hexc('#6f7c91')), (0.48, hexc('#e8eef7')), (0.6, hexc('#8f9bb0')), (0.82, hexc('#eef3fb')), (1, hexc('#ffffff'))]
GOLD = [(0, hexc('#3a2200')), (0.3, hexc('#8a5a00')), (0.62, hexc('#f2b81e')), (0.86, hexc('#ffe27a')), (1, hexc('#fffbe0'))]
CHROME_LUT = [grad(CHROME, i / 255) for i in range(256)]
GOLD_LUT = [grad(GOLD, i / 255) for i in range(256)]

def make(path, skin):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    a = im.split()[3]
    g = ImageOps.grayscale(im.convert('RGB'))
    if skin == 'mono':
        g2 = ImageEnhance.Contrast(g).enhance(1.7)
        res = Image.merge('RGB', (g2, g2, g2))
    elif skin in ('silver', 'gold'):
        g2 = ImageEnhance.Contrast(g).enhance(1.15)
        lut = CHROME_LUT if skin == 'silver' else GOLD_LUT
        res = Image.new('RGB', (W, H))
        res.putdata([lut[v] for v in g2.get_flattened_data()])
    else:
        px = g.load()
        data = []
        for y in range(H):
            for x in range(W):
                l = px[x, y] / 255
                hue = ((x + y) / (W + H) * 1.6) % 1.0
                r, gg, b = colorsys.hls_to_rgb(hue, 0.08 + 0.84 * l, 0.85 if l > 0.15 else 0.4)
                data.append((int(r * 255), int(gg * 255), int(b * 255)))
        res = Image.new('RGB', (W, H))
        res.putdata(data)
    res = res.convert('RGBA')
    res.putalpha(a)
    # Same palette size as the originals to keep files small.
    return res.quantize(colors=128, method=Image.Quantize.FASTOCTREE)

for skin in ['silver', 'gold', 'rainbow']:
    os.makedirs(f'{out}/{skin}', exist_ok=True)
names = sorted(f[:-4] for f in os.listdir(src) if f.endswith('.png'))
for pid in names:
    if only and pid not in only:
        continue
    for skin in ['silver', 'gold', 'rainbow']:
        make(f'{src}/{pid}.png', skin).save(f'{out}/{skin}/{pid}.png', optimize=True)
print('made', len(names) if not only else len(only))
