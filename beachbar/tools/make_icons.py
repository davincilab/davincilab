#!/usr/bin/env python3
"""Generate the PNG app icons for the two home-screen apps.

No third-party dependencies: shapes are rasterised with 4x supersampling and
written as RGBA PNGs using zlib from the standard library.

    python3 tools/make_icons.py

Guest app -> blue parasol icon, bar app -> red cocktail icon.
"""

import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "icons")
SIZES = [512, 192, 180, 32]
SS = 4  # supersampling factor


# --- tiny geometry helpers, all in unit space (0..1) -------------------------

def rounded_rect(x0, y0, x1, y1, r):
    def inside(x, y):
        if x < x0 or x > x1 or y < y0 or y > y1:
            return False
        cx = min(max(x, x0 + r), x1 - r)
        cy = min(max(y, y0 + r), y1 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    return inside


def circle(cx, cy, r):
    return lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def half_disc(cx, cy, r):
    return lambda x, y: y <= cy and (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def polygon(points):
    def inside(x, y):
        hit = False
        n = len(points)
        for i in range(n):
            xi, yi = points[i]
            xj, yj = points[(n - 1 + i) % n]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                hit = not hit
        return hit
    return inside


def union(*shapes):
    return lambda x, y: any(s(x, y) for s in shapes)


def subtract(base, *holes):
    return lambda x, y: base(x, y) and not any(h(x, y) for h in holes)


# --- the two glyphs ---------------------------------------------------------

def parasol_glyph():
    """Beach parasol: scalloped canopy, tilted pole."""
    canopy = half_disc(0.5, 0.46, 0.33)
    scallops = [circle(0.5 - 0.33 + 0.33 * (i + 0.5) / 3.0 * 2, 0.46, 0.075)
                for i in range(3)]
    canopy = subtract(canopy, *scallops)
    pole = polygon([(0.472, 0.42), (0.528, 0.42), (0.585, 0.84), (0.53, 0.84)])
    tip = circle(0.5, 0.135, 0.032)
    return union(canopy, pole, tip)


def cocktail_glyph():
    """Cocktail glass with a straw."""
    bowl = polygon([(0.20, 0.27), (0.80, 0.27), (0.53, 0.60), (0.47, 0.60)])
    stem = polygon([(0.468, 0.58), (0.532, 0.58), (0.532, 0.80), (0.468, 0.80)])
    foot = rounded_rect(0.31, 0.79, 0.69, 0.845, 0.027)
    straw = polygon([(0.60, 0.16), (0.66, 0.155), (0.575, 0.42), (0.525, 0.42)])
    cherry = circle(0.735, 0.205, 0.055)
    return union(bowl, stem, foot, straw, cherry)


# --- rasteriser -------------------------------------------------------------

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def render(size, top, bottom, glyph):
    n = size * SS
    px = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            cov = 0
            for sy in range(SS):
                for sx in range(SS):
                    ux = (x * SS + sx + 0.5) / n
                    uy = (y * SS + sy + 0.5) / n
                    if glyph(ux, uy):
                        cov += 1
            bg = lerp(top, bottom, y / max(1, size - 1))
            a = cov / (SS * SS)
            r = round(bg[0] + (255 - bg[0]) * a)
            g = round(bg[1] + (255 - bg[1]) * a)
            b = round(bg[2] + (255 - bg[2]) * a)
            i = (y * size + x) * 4
            px[i:i + 4] = bytes((r, g, b, 255))
    return px


def mask_square(size, px):
    """Punch the rounded-square silhouette (transparent outside)."""
    shape = rounded_rect(0.0, 0.0, 1.0, 1.0, 0.225)
    n = size * SS
    for y in range(size):
        for x in range(size):
            cov = 0
            for sy in range(SS):
                for sx in range(SS):
                    if shape((x * SS + sx + 0.5) / n, (y * SS + sy + 0.5) / n):
                        cov += 1
            px[(y * size + x) * 4 + 3] = round(255 * cov / (SS * SS))
    return px


def write_png(path, size, px):
    raw = b"".join(b"\x00" + bytes(px[y * size * 4:(y + 1) * size * 4])
                   for y in range(size))

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(png)


ICONS = [
    # name,        gradient top,      gradient bottom,   glyph,   maskable
    ("guest", (58, 135, 229), (26, 86, 168), parasol_glyph()),
    ("bar", (227, 73, 72), (183, 33, 32), cocktail_glyph()),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, top, bottom, glyph in ICONS:
        for size in SIZES:
            px = render(size, top, bottom, glyph)
            # full-bleed variant is used as maskable, rounded one everywhere else
            write_png(os.path.join(OUT, "icon-%s-%d-maskable.png" % (name, size)),
                      size, bytearray(px))
            write_png(os.path.join(OUT, "icon-%s-%d.png" % (name, size)),
                      size, mask_square(size, px))
            print("icon-%s-%d.png" % (name, size))
