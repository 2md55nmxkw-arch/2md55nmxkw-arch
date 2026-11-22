"""Animated README banner: keyed Teto loop over floating project cards, GitHub-dark style.

usage: python teto/banner/render.py <looped_frames_dir> <out_frames_dir>
Every motion is periodic with the loop length, so the WebP loops seamlessly.
The banner background is GitHub's canvas colour and its edges dissolve into it.
"""
import glob
import io
import json
import math
import os
import pathlib
import sys

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
TETO = HERE.parent
SRC_DIR, OUT_DIR = sys.argv[1], sys.argv[2]
W, H, S = 1500, 500, 2
CW, CH = W * S, H * S
CANVAS = np.array([13, 17, 23], np.float32)
os.makedirs(OUT_DIR, exist_ok=True)
files = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
T = len(files)


# ---------------- fonts (woff2 -> in-memory ttf for PIL) ----------------
def pil_font(fname):
    f = TTFont(str(TETO / "fonts" / fname))
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    return buf.getvalue()


_FB = {w: pil_font(f"mona-sans-latin-{w}-normal.woff2") for w in (400, 500, 600)}


def font(weight, size):
    return ImageFont.truetype(io.BytesIO(_FB[weight]), int(size * S))


# ---------------- data ----------------
cfg = json.loads((TETO / "config.json").read_text())
data = json.loads((TETO / "data.json").read_text())
desc = {"tzar-hub": "Roblox script hub · keyless", "endfield-il2dump": "offline IL2CPP metadata dumper",
        "LuauEmu": "Luau emulator outside Roblox", "Loliland-ModLoader": "mod loader for builds",
        "tzar-admin": "in-game command panel", "WindUI": "UI library fork · markdown"}
lang = {"tzar-admin": "Luau", "WindUI": "Lua"}
stars = {"tzar-admin": 0, "WindUI": 1}
for name, r in data["repos"].items():
    lang[name], stars[name] = r.get("language") or "—", r.get("stars", 0)
LANG = {"Luau": (0, 162, 255), "C++": (243, 75, 125), "TypeScript": (49, 120, 198), "Lua": (108, 120, 224)}

# (name, x, y, scale, blur, opacity, amplitude, phase) — back layer first
LAYOUT = [
    ("tzar-admin", 960, 34, 0.72, 2.2, 0.45, 4, 0.1), ("WindUI", 180, 300, 0.72, 2.2, 0.45, 4, 0.6),
    ("endfield-il2dump", 130, 70, 1.0, 0, 1.0, 9, 0.0), ("LuauEmu", 1050, 150, 1.0, 0, 1.0, 9, 0.5),
    ("tzar-hub", 210, 205, 0.92, 0.6, 0.9, 7, 0.25), ("Loliland-ModLoader", 1010, 330, 0.88, 0.8, 0.85, 7, 0.75),
]


def star(dr, cx, cy, r, fill):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    dr.polygon(pts, fill=fill)


def card(name, sc):
    cw, ch = int(300 * sc * S), int(96 * sc * S)
    im = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle([0, 0, cw - 1, ch - 1], int(12 * sc * S), fill=(21, 27, 35, 235))
    pad = int(16 * sc * S)
    dr.text((pad, pad - int(2 * sc * S)), name, font=font(600, 19 * sc), fill=(240, 246, 252, 255))
    dr.text((pad, pad + int(27 * sc * S)), desc[name], font=font(400, 13 * sc), fill=(145, 152, 161, 255))
    y = ch - pad - int(13 * sc * S)
    rr = int(5 * sc * S)
    dr.ellipse([pad, y + rr // 2, pad + 2 * rr, y + rr // 2 + 2 * rr], fill=LANG.get(lang[name], (145, 152, 161)) + (255,))
    f = font(500, 12 * sc)
    dr.text((pad + 3 * rr, y - int(sc * S)), lang[name], font=f, fill=(145, 152, 161, 255))
    st = str(stars[name])
    tw = dr.textlength(st, font=f)
    dr.text((cw - pad - tw, y - int(sc * S)), st, font=f, fill=(145, 152, 161, 255))
    star(dr, cw - pad - tw - int(10 * sc * S), y + int(7 * sc * S), int(5.5 * sc * S), (145, 152, 161, 255))
    return im


sprites = []
for name, x, y, sc, blur, op, amp, ph in LAYOUT:
    c = card(name, sc)
    if blur:
        c = c.filter(ImageFilter.GaussianBlur(blur * S))
    if op < 1:
        c.putalpha(c.getchannel("A").point(lambda v, op=op: int(v * op)))
    sprites.append((c, x, y, amp, ph))

# ---------------- static layers ----------------
yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
d = np.sqrt(((xx - CW / 2) / (1350 * S / 2)) ** 2 + ((yy - 475 * S) / (900 * S / 2)) ** 2)
glow = np.clip(1 - d, 0, 1) * 0.42
bg = CANVAS + glow[..., None] * (np.array([150, 24, 48], np.float32) - CANVAS)
bg += np.random.default_rng(1).normal(0, 1.6, bg.shape[:2])[..., None]
background = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def overlay(alpha, rgb=(13, 17, 23)):
    o = np.zeros((CH, CW, 4), np.uint8)
    o[..., :3] = rgb
    o[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(o, "RGBA")


# canvas-coloured vignette + bottom fade: the banner melts into the README page
de = np.sqrt(((xx - CW / 2) / (CW / 2)) ** 2 + ((yy - CH / 2) / (CH / 2)) ** 2)
vig = np.interp(de, [0, 0.62, 0.9, 1.0, 2.0], [0, 0, 0.45, 0.95, 1.0])
fade = np.clip((yy - 330 * S) / (170 * S), 0, 1) ** 1.3
dissolve = overlay(np.maximum(vig, fade))


def glare(offset):
    u = xx * 0.55 - yy - CW * offset
    a = np.exp(-((u - CW * 0.18) / (CW * 0.06)) ** 2) * 0.02 + np.exp(-((u - CW * 0.27) / (CW * 0.015)) ** 2) * 0.035
    return overlay(a, (255, 255, 255))


# ---------------- character ----------------
BG = np.array([2, 173, 72], np.float32)  # screen green of the source video
TARGET_H = (H - 26) * S


def key(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    gness = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    alpha = np.clip((92 - gness) / 92, 0, 1)
    alpha[alpha < 0.08] = 0
    al = alpha[..., None]
    fg = np.clip((a - (1 - al) * BG) / np.maximum(al, 1e-3), 0, 255)  # un-mix the green
    fg[..., 1] = np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]))  # despill
    im = Image.fromarray(np.dstack([fg, alpha * 255]).astype(np.uint8), "RGBA")
    im.putalpha(im.getchannel("A").filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.8)))
    k = TARGET_H / im.height
    return im.resize((round(im.width * k), TARGET_H), Image.LANCZOS)


for t, path in enumerate(files):
    phase = 2 * math.pi * t / T
    frame = background.copy()
    for c, x, y, amp, ph in sprites:
        dx = amp * 0.6 * math.sin(phase + 2 * math.pi * ph)
        dy = amp * math.sin(2 * phase + 2 * math.pi * ph)
        frame.alpha_composite(c, (round((x + dx) * S), round((y + dy) * S)))
    ch = key(path)
    x0, y0 = (CW - ch.width) // 2, CH - ch.height
    small = ch.getchannel("A").resize((ch.width // 4, ch.height // 4)).filter(ImageFilter.GaussianBlur(9))
    shadow = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 255), (x0, y0), small.resize(ch.size).point(lambda v: int(v * 0.45)))
    frame = Image.alpha_composite(frame, shadow)
    frame.alpha_composite(ch, (x0, y0))
    frame = Image.alpha_composite(frame, glare(0.015 * math.sin(phase)))
    frame = Image.alpha_composite(frame, dissolve)
    frame.convert("RGB").resize((W, H), Image.LANCZOS).save(os.path.join(OUT_DIR, f"b{t:03d}.png"))
    if t % 20 == 0:
        print("frame", t, "/", T, flush=True)
print("done", T, "frames")
