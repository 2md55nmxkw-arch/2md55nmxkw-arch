"""Animated README banner: keyed Teto loop between floating project cards, one set of frames per GitHub theme.

usage: python teto/banner/render.py <looped_frames_dir> <out_dir>      -> <out_dir>/dark/b000.png ..., <out_dir>/light/b000.png ...
       python teto/banner/render.py <looped_frames_dir> <out_dir> 30   -> only frame 30 (to check a layout change quickly)
Every motion is periodic with the loop length, so the WebP loops seamlessly.
Each theme's banner sits on that theme's canvas colour and its lower edge dissolves into it.
(Transparent frames would melt into any theme, but every frame then has to be stored whole and
the file grows from ~2 MB to ~6 MB.)
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
sys.path.insert(0, str(TETO))
from lib import THEMES  # noqa: E402

SRC_DIR, OUT_DIR = sys.argv[1], sys.argv[2]
ONLY = int(sys.argv[3]) if len(sys.argv) > 3 else None
W, H, S = 1500, 500, 2
CW, CH = W * S, H * S
files = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
T = len(files)

# what differs between the two themes; text and language colours come from lib.THEMES
LOOK = {
    "dark": {"card": (21, 27, 35, 235), "edge": (48, 54, 61, 255), "glow": (150, 24, 48), "glow_a": 0.42,
             "shadow": (0, 0, 0), "shadow_a": 0.45, "glare": True},
    "light": {"card": (255, 255, 255, 245), "edge": (209, 217, 224, 255), "glow": (229, 57, 74), "glow_a": 0.26,
              "shadow": (110, 20, 36), "shadow_a": 0.3, "glare": False},
}


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


def rgb(hex_):
    return tuple(int(hex_[i:i + 2], 16) for i in (1, 3, 5))


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
RANK = [n for n, _ in data["languages"]]  # a language wears the same ramp step as in the README's stack bar

# (name, x, y, scale, blur, opacity, amplitude, phase), back layer first.
# Two cards are in focus: big enough to read at README size and flush with the column's edges,
# so the banner is as wide as the project list under it. The rest are out-of-focus shapes.
LAYOUT = [
    ("tzar-admin", 1030, 22, 0.8, 7, 0.5, 4, 0.1), ("WindUI", 236, 318, 0.8, 7, 0.5, 4, 0.6),
    ("tzar-hub", 286, 14, 0.9, 5, 0.6, 5, 0.25), ("Loliland-ModLoader", 1000, 336, 0.9, 5, 0.6, 5, 0.75),
    ("endfield-il2dump", 0, 104, 1.5, 0, 1.0, 7, 0.0), ("LuauEmu", 1050, 172, 1.5, 0, 1.0, 7, 0.5),
]


def star(dr, cx, cy, r, fill):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    dr.polygon(pts, fill=fill)


def card(name, sc, th, look):
    title, text = rgb(th["fg"]) + (255,), rgb(th["fgMuted"]) + (255,)
    dot = rgb(th["ramp"][min(RANK.index(lang[name]), len(th["ramp"]) - 1)] if lang[name] in RANK else th["fgMuted"]) + (255,)
    cw, ch = int(300 * sc * S), int(96 * sc * S)
    im = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle([0, 0, cw - 1, ch - 1], int(12 * sc * S), fill=look["card"], outline=look["edge"], width=S)
    pad = int(16 * sc * S)
    dr.text((pad, pad - int(2 * sc * S)), name, font=font(600, 19 * sc), fill=title)
    dr.text((pad, pad + int(27 * sc * S)), desc[name], font=font(400, 13 * sc), fill=text)
    y = ch - pad - int(13 * sc * S)
    rr = int(5 * sc * S)
    dr.ellipse([pad, y + rr // 2, pad + 2 * rr, y + rr // 2 + 2 * rr], fill=dot)
    f = font(500, 12 * sc)
    dr.text((pad + 3 * rr, y - int(sc * S)), lang[name], font=f, fill=text)
    st = str(stars[name])
    tw = dr.textlength(st, font=f)
    dr.text((cw - pad - tw, y - int(sc * S)), st, font=f, fill=text)
    star(dr, cw - pad - tw - int(10 * sc * S), y + int(7 * sc * S), int(5.5 * sc * S), text)
    return im


def soften(im, radius):
    """Blur with premultiplied alpha and room to spread, so soft edges don't pick up a dark fringe."""
    m = int(radius * 3)
    big = Image.new("RGBA", (im.width + 2 * m, im.height + 2 * m), (0, 0, 0, 0))
    big.paste(im, (m, m))
    return big.convert("RGBa").filter(ImageFilter.GaussianBlur(radius)).convert("RGBA"), m


# ---------------- static layers ----------------
yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)


def layer(alpha, colour):
    """A flat colour with per-pixel alpha."""
    o = np.zeros((CH, CW, 4), np.uint8)
    o[..., :3] = colour
    o[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(o, "RGBA")


# red glow behind Teto, strongest at the bottom centre
d = np.sqrt(((xx - CW / 2) / (1350 * S / 2)) ** 2 + ((yy - 475 * S) / (900 * S / 2)) ** 2)
GLOW = np.clip(1 - d, 0, 1)
# grain keeps the glow from banding; it fades out with the glow, so the image edges stay exactly canvas-coloured
GRAIN = np.random.default_rng(1).normal(0, 1.6, GLOW.shape).astype(np.float32) * np.clip(GLOW * 6, 0, 1)
# everything dissolves into the canvas towards the bottom edge, where the README text starts (and over the top few pixels)
KEEP = ((1 - np.clip((yy - 330 * S) / (170 * S), 0, 1) ** 1.3) * np.clip(yy / (14 * S), 0, 1))[..., None]
# the glass glare dies out before the image edges
EDGE = np.clip((1 - np.sqrt(((xx - CW / 2) / (CW / 2)) ** 2 + ((yy - CH / 2) / (CH / 2)) ** 2)) / 0.35, 0, 1)


def glare(offset):
    u = xx * 0.55 - yy - CW * offset
    a = np.exp(-((u - CW * 0.18) / (CW * 0.06)) ** 2) * 0.02 + np.exp(-((u - CW * 0.27) / (CW * 0.015)) ** 2) * 0.035
    return layer(a * EDGE, (255, 255, 255))


scenes = {}
for theme, look in LOOK.items():
    sprites = []
    for name, x, y, sc, blur, op, amp, ph in LAYOUT:
        c, m = card(name, sc, THEMES[theme], look), 0
        if blur:
            c, m = soften(c, blur * S)
        if op < 1:
            c.putalpha(c.getchannel("A").point(lambda v, op=op: int(v * op)))
        sprites.append((c, x, y, m, amp, ph, blur > 0))
    canvas = np.array(rgb(THEMES[theme]["canvas"]), np.float32)
    bg = canvas + (GLOW * look["glow_a"])[..., None] * (np.array(look["glow"], np.float32) - canvas) + GRAIN[..., None]
    background = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    scenes[theme] = (look, canvas, background, sprites)
    os.makedirs(os.path.join(OUT_DIR, theme), exist_ok=True)

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
    return im.convert("RGBa").resize((round(im.width * k), TARGET_H), Image.LANCZOS).convert("RGBA")


for t, path in enumerate(files):
    if ONLY is not None and t != ONLY:
        continue
    phase = 2 * math.pi * t / T
    ch = key(path)
    x0, y0 = (CW - ch.width) // 2, CH - ch.height
    small = ch.getchannel("A").resize((ch.width // 4, ch.height // 4)).filter(ImageFilter.GaussianBlur(9)).resize(ch.size)
    for theme, (look, canvas, background, sprites) in scenes.items():
        frame = background.copy()
        for c, x, y, m, amp, ph, drifts in sprites:
            dx = amp * 0.6 * math.sin(phase + 2 * math.pi * ph) if drifts else 0  # the cards in focus stay on their edge
            dy = amp * math.sin(2 * phase + 2 * math.pi * ph)
            frame.alpha_composite(c, (max(0, round((x + dx) * S) - m), max(0, round((y + dy) * S) - m)))
        shadow = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        shadow.paste(look["shadow"] + (255,), (x0, y0), small.point(lambda v, a=look["shadow_a"]: int(v * a)))
        frame = Image.alpha_composite(frame, shadow)
        frame.alpha_composite(ch, (x0, y0))
        if look["glare"]:
            frame = Image.alpha_composite(frame, glare(0.015 * math.sin(phase)))
        px = canvas + (np.asarray(frame)[..., :3].astype(np.float32) - canvas) * KEEP
        out = Image.fromarray(np.clip(px + 0.5, 0, 255).astype(np.uint8), "RGB").resize((W, H), Image.LANCZOS)
        out.save(os.path.join(OUT_DIR, theme, f"b{t:03d}.png"))
    if t % 20 == 0:
        print("frame", t, "/", T, flush=True)
print("done", T if ONLY is None else 1, "frames per theme")
