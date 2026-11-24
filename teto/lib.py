"""Shared helpers: palettes, layout breakpoints, font metrics, subset font embedding, SVG bits."""
import base64
import hashlib
import io
import json
import pathlib
import re
from xml.sax.saxutils import escape

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
FONTS = ROOT / "fonts"

# GitHub Primer + Teto red, one palette per GitHub theme. "ramp" is the single-hue scale for
# language shares, biggest share first: each step sits closer to the page colour than the one
# before it, and the last one still clears 2:1 against the canvas.
THEMES = {
    "dark": {"canvas": "#0D1117", "border": "#3D444D", "fg": "#F0F6FC", "fgMuted": "#9198A1",
             "teto": "#E5394A", "btn": "#C42B3D", "btnFg": "#FFFFFF", "rest": "#3D444D", "sheen": 0.22,
             "ramp": ["#FD5862", "#E34450", "#C33843", "#A42D36", "#86222A"]},
    "light": {"canvas": "#FFFFFF", "border": "#D1D9E0", "fg": "#1F2328", "fgMuted": "#59636E",
              "teto": "#D1293B", "btn": "#C42B3D", "btnFg": "#FFFFFF", "rest": "#AFB8C1", "sheen": 0.4,
              "ramp": ["#C41934", "#D93A48", "#E55D62", "#EE7D7D", "#F39C9A"]},
}

# The README column is ~830px on a wide desktop profile, 560-760px in a smaller window and
# ~330px on a phone. Fluid pieces switch layout on their own rendered width. Each layout is
# drawn to fit the narrowest column it can get: (name, that width), widest first.
LAYOUTS = (("w", 760), ("m", 600), ("s", 460), ("n", 300))
FIT = dict(LAYOUTS)

FONT_FILES = {
    "ms400": ("Mona Sans", 400, "mona-sans-latin-400-normal.woff2"),
    "ms500": ("Mona Sans", 500, "mona-sans-latin-500-normal.woff2"),
    "ms600": ("Mona Sans", 600, "mona-sans-latin-600-normal.woff2"),
    "stencil": ("Teto Stencil", 700, "big-shoulders-stencil-display-latin-700-normal.woff2"),
    "mono": ("Teto Mono", 400, "geist-mono-latin-400-normal.woff2"),
}
_cache = {}


def font(key):
    if key not in _cache:
        _cache[key] = TTFont(str(FONTS / FONT_FILES[key][2]))
    return _cache[key]


def measure(text, key, size, letter_spacing=0.0):
    """Advance width in px (no kerning; SVGs set font-kerning:none to match)."""
    f = font(key)
    upm = f["head"].unitsPerEm
    cmap, hmtx = f.getBestCmap(), f["hmtx"]
    w = 0.0
    for ch in text:
        g = cmap.get(ord(ch))
        adv = hmtx[g][0] if g else upm * 0.55
        w += adv * size / upm + letter_spacing
    return w


def char_widths(text, key, size, letter_spacing=0.0):
    return [measure(c, key, size, letter_spacing) for c in text]


def cap_height(key, size):
    f = font(key)
    ch = getattr(f["OS/2"], "sCapHeight", 0) or int(f["head"].unitsPerEm * 0.7)
    return ch * size / f["head"].unitsPerEm


def _fit(word, key, size, max_w):
    """A word wider than a whole line (a long @login on a phone) is cut after a hyphen,
    or wherever it has to be if there is none."""
    if measure(word, key, size) <= max_w:
        return [word]
    parts, cur = [], ""
    for piece in re.split(r"(?<=-)", word):
        while measure(piece, key, size) > max_w:
            n = len(piece)
            while n > 1 and measure(piece[:n], key, size) > max_w:
                n -= 1
            if cur:
                parts.append(cur)
                cur = ""
            parts.append(piece[:n])
            piece = piece[n:]
        if cur and measure(cur + piece, key, size) > max_w:
            parts.append(cur)
            cur = piece
        else:
            cur += piece
    if cur:
        parts.append(cur)
    return parts


def wrap(text, key, size, max_w):
    words, lines, cur = [w for word in text.split(" ") for w in _fit(word, key, size, max_w)], [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if cur and measure(trial, key, size) > max_w:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def ellipsize(text, key, size, max_w):
    if measure(text, key, size) <= max_w:
        return text
    while text and measure(text + "…", key, size) > max_w:
        text = text[:-1]
    return text.rstrip() + "…"


def font_face(key, chars):
    """@font-face with a woff2 subset that holds only the glyphs this SVG uses."""
    family, weight, fname = FONT_FILES[key]
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = []
    opts.name_IDs = []
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    f = TTFont(str(FONTS / fname), recalcTimestamp=False)  # stable bytes -> stable file hashes
    sub.populate(text="".join(sorted(set(chars))) or " ")
    sub.subset(f)
    buf = io.BytesIO()
    f.flavor = "woff2"
    f.save(buf)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return (f"@font-face{{font-family:'{family}';font-weight:{weight};"
            f"src:url(data:font/woff2;base64,{b64}) format('woff2')}}")


def fonts_css(usage):
    """usage: {font_key: set_of_chars}"""
    return "".join(font_face(k, v) for k, v in usage.items() if v)


def fam(key):
    family, weight, _ = FONT_FILES[key]
    return f"font-family:'{family}';font-weight:{weight}"


def esc(s):
    return escape(s, {'"': "&quot;"})


def svg(w, h, body, css="", title=""):
    """Fixed-size piece (buttons, legend chips): scales as one image."""
    t = f"<title>{esc(title)}</title>" if title else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'role="img">{t}<style>text{{font-kerning:none}}{css}</style>{body}</svg>')


def _upper(i):
    """A layout ends just below the minimum width of the next wider one."""
    return f"(max-width:{LAYOUTS[i - 1][1] - .02}px)"


def _tiers():
    # an element tagged class="L w m" shows on the w and m layouts only
    css = []
    for i, (name, lo) in enumerate(LAYOUTS):
        cond = [_upper(i)] if i else []
        if i < len(LAYOUTS) - 1:
            cond.insert(0, f"(min-width:{lo}px)")
        css.append(f"@media {' and '.join(cond)}{{.L:not(.{name}){{display:none}}}}")
    return "".join(css)


TIERS = _tiers()


def tier_css(selector, prop, values):
    """One CSS property with a value per layout: values = {layout name: value}."""
    css = [f"{selector}{{{prop}:{values[LAYOUTS[0][0]]}}}"]
    for i, (name, _) in enumerate(LAYOUTS[1:], 1):
        css.append(f"@media {_upper(i)}{{{selector}{{{prop}:{values[name]}}}}}")
    return "".join(css)


def fluid(h, body, css="", title=""):
    """Full-width piece: a fixed pixel height and no viewBox, so it fills the README column at any
    width and its text stays at its real size instead of shrinking with the image. Horizontal
    positions are percentages or sit in an <svg x="100%"> / <svg x="50%"> anchor."""
    t = f"<title>{esc(title)}</title>" if title else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" height="{h}" role="img">{t}'
            f'<style>text{{font-kerning:none}}{TIERS}{css}</style>{body}</svg>')


def anchor(x, body):
    """Children are positioned relative to x ("100%" = right edge, "50%" = centre)."""
    return f'<svg x="{x}" overflow="visible">{body}</svg>'


def wrap_max(text, key, size, max_w, max_lines):
    """wrap(), but never more than max_lines: the last line is ellipsized instead."""
    lines = wrap(text, key, size, max_w)
    if len(lines) > max_lines:
        lines = lines[:max_lines - 1] + [ellipsize(" ".join(lines[max_lines - 1:]), key, size, max_w)]
    return lines


def balance(segments, sep, key, size, max_w):
    """Join segments into as few lines as fit max_w, then pick the split with the shortest longest line."""
    def width(group):
        return measure(sep.join(group), key, size)

    def splits(n, k):
        if k == 1:
            yield [n]
            return
        for first in range(1, n - k + 2):
            for rest in splits(n - first, k - 1):
                yield [first] + rest

    for k in range(1, len(segments) + 1):
        best = None
        for sizes in splits(len(segments), k):
            groups, i = [], 0
            for n in sizes:
                groups.append(segments[i:i + n])
                i += n
            worst = max(width(g) for g in groups)
            if worst <= max_w and (best is None or worst < best[0]):
                best = (worst, groups)
        if best:
            return [sep.join(g) for g in best[1]]
    return [ellipsize(s, key, size, max_w) for s in segments]


STAR = ('<path transform="translate({x},{y}) scale({s})" fill="{c}" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 '
        '4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 '
        '1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>')
ARROW = ('<path transform="translate({x},{y})" d="M5 11L11 5M6.5 5H11V9.5" stroke="{c}" stroke-width="1.5" '
         'stroke-linecap="round" stroke-linejoin="round" fill="none"/>')


def load_json(name, default=None):
    p = ROOT / name
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return default


def save_json(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def short_hash(data):
    return hashlib.sha1(data.encode() if isinstance(data, str) else data).hexdigest()[:7]
