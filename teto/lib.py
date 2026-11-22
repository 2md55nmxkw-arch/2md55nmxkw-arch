"""Shared helpers: palette, font metrics, subset font embedding, SVG bits."""
import base64
import hashlib
import io
import json
import pathlib
from xml.sax.saxutils import escape

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
FONTS = ROOT / "fonts"

# GitHub Primer dark + Teto red
P = {
    "canvas": "#0D1117", "muted": "#151B23", "btn": "#212830", "border": "#3D444D",
    "fg": "#F0F6FC", "fgMuted": "#9198A1", "teto": "#E5394A",
}
LANG_COLORS = {
    "Luau": "#00A2FF", "Lua": "#6C78E0", "TypeScript": "#3178C6", "C++": "#F34B7D",
    "JavaScript": "#F1E05A", "Python": "#3572A5", "C": "#555555", "C#": "#178600",
    "HTML": "#E34C26", "CSS": "#663399", "Rust": "#DEA584", "Go": "#00ADD8", "Shell": "#89E051",
}

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


def wrap(text, key, size, max_w):
    words, lines, cur = text.split(" "), [], ""
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
    t = f"<title>{esc(title)}</title>" if title else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'role="img">{t}<style>text{{font-kerning:none}}{css}</style>{body}</svg>')


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
