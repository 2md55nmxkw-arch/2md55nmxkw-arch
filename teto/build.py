"""Render every README piece to SVG, once per GitHub theme, and write README.md from the template.

    python teto/build.py

Inputs: teto/config.json (what to show), teto/data.json (GitHub numbers, see fetch.py),
teto/state.json (Teto's mood, see interact.py). Output: assets/teto/*.svg with content-hashed
names (so GitHub's image cache never serves a stale copy) and README.md.

Full-width pieces are fluid (lib.fluid): they keep their pixel height and real text size at any
column width and switch layout on their own, from wide down to phone-narrow. They share
one edge grid: content starts at x=0 and ends at 100%, so every block lines up with the others.
"""
import datetime as dt
import re
import urllib.parse

from lib import (ARROW, FIT, REPO, STAR, THEMES, anchor, balance, cap_height, char_widths, ellipsize,
                 esc, fam, fluid, fonts_css, load_json, measure, short_hash, svg, tier_css, wrap, wrap_max)

OUT = REPO / "assets" / "teto"
CFG = load_json("config.json")
DATA = load_json("data.json")
STATE = load_json("state.json")
NOW = dt.datetime.now(dt.timezone.utc)


# ---------------------------------------------------------------- lines Teto says
def ago(iso):
    d = (NOW - dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))).days
    if d <= 0:
        return "today"
    if d == 1:
        return "yesterday"
    if d < 7:
        return f"{d} days ago"
    if d < 14:
        return "a week ago"
    if d < 60:
        return f"{d // 7} weeks ago"
    return f"{d // 30} months ago"


def activity_line():
    best = None
    for p in CFG["projects"]:
        r = DATA["repos"].get(p["repo"])
        if r and r.get("pushedAt") and (best is None or r["pushedAt"] > best[1]["pushedAt"]):
            best = (p, r)
    if not best:
        return "Quiet times. They're probably staring at a disassembler again."
    p, r = best
    line = f"Latest push went to {p['repo']}, {ago(r['pushedAt'])}. {p['flavor']}"
    wc = DATA.get("week_contributions")
    if wc:
        line += f" {wc} contributions this week."
    return line


# ---------------------------------------------------------------- language shares
def shares():
    """[(name, percent)] in bar order, the remainder as "Other", and the total they add up to."""
    parts = [(name, pct) for name, pct in DATA["languages"]]
    total = max(100, sum(pct for _, pct in parts))
    if total > sum(pct for _, pct in parts):
        parts.append(("Other", total - sum(pct for _, pct in parts)))
    return parts, total


def share_color(th, name):
    """A language keeps one step of the ramp everywhere it shows: bar, legend, project rows, banner."""
    names = [n for n, _ in DATA["languages"]]
    if name in names:
        return th["ramp"][min(names.index(name), len(th["ramp"]) - 1)]
    return th["rest"]


# ---------------------------------------------------------------- dialogue
# layouts it shows on, font size, line height, longest line
DIALOGUE = (("w", 22, 32, 660), ("m", 20, 30, FIT["m"] - 40), ("s", 19, 28, FIT["s"] - 40), ("n", 16, 24, FIT["n"] - 16))


def dialogue(th):
    lines = [CFG["intro"], activity_line(), STATE["reply"]]
    laid = [(cls, size, lh, [wrap(t, "ms500", size, max_w) for t in lines]) for cls, size, lh, max_w in DIALOGUE]
    # one height for every layout: fewer, longer lines when wide; more, shorter ones when narrow
    H = round(max((max(len(g) for g in groups) - 1) * lh + size for _, size, lh, groups in laid) + 30)

    # timing depends on the text only, so every layout types in step
    dt_char, lead, tail = 0.032, 0.25, 3.6
    windows, starts, t = [], [], lead
    for text in lines:
        win = max(7.0, len(text) * dt_char + tail)
        starts.append(t)
        windows.append(win)
        t += win
    T = t
    css = [f".t{{{fam('ms500')};fill:{th['fg']}}}",
           "@keyframes b{0%{opacity:1}50%{opacity:0}100%{opacity:1}}.blink{animation:b 1s steps(1) infinite}"]
    for gi in range(len(lines)):
        win, s0 = windows[gi], starts[gi]
        fade_a = (win - 0.35) / T * 100
        vis = win / T * 100
        css.append(f"@keyframes g{gi}{{0%{{opacity:1}}{fade_a:.3f}%{{opacity:1}}{vis:.3f}%{{opacity:0}}100%{{opacity:0}}}}"
                   f".g{gi}{{opacity:0;animation:g{gi} {T:.2f}s linear infinite;animation-delay:{s0:.2f}s}}")
        css.append(f"@keyframes c{gi}{{0%{{fill-opacity:1}}{vis - 0.001:.3f}%{{fill-opacity:1}}{vis:.3f}%{{fill-opacity:0}}"
                   f"100%{{fill-opacity:0}}}}.c{gi}{{fill-opacity:0;animation:c{gi} {T:.2f}s linear infinite}}")

    body = []
    for cls, size, lh, groups in laid:
        max_lines = max(len(g) for g in groups)
        cap = cap_height("ms500", size)
        y_first = (H - (max_lines - 1) * lh) / 2 + cap / 2
        tier = []
        for gi, g in enumerate(groups):
            s0 = starts[gi]
            off = (max_lines - len(g)) * lh / 2
            parts, k, end = [], 0, (0, 0)
            for li, line in enumerate(g):
                y = y_first + off + li * lh
                ws = char_widths(line, "ms500", size)
                x = -sum(ws) / 2  # relative to the centre anchor
                spans = []
                for ch, cw in zip(line, ws):
                    if ch != " ":
                        spans.append(f'<tspan x="{x:.1f}" class="c{gi}" style="animation-delay:{s0 + k * dt_char:.3f}s">{esc(ch)}</tspan>')
                    x += cw
                    k += 1
                k += 1  # the wrapped space
                parts.append(f'<text class="t" y="{y:.1f}" style="font-size:{size}px">{"".join(spans)}</text>')
                end = (x, y)
            cx, cy = end
            parts.append(f'<g class="blink"><rect x="{cx + 3:.1f}" y="{cy - cap - 3:.1f}" width="2" height="{cap + 7:.1f}" '
                         f'rx="1" fill="{th["teto"]}" class="c{gi}" style="animation-delay:{s0 + k * dt_char:.3f}s"/></g>')
            tier.append(f'<g class="g{gi}">{"".join(parts)}</g>')
        body.append(f'<g class="L {cls}">{anchor("50%", "".join(tier))}</g>')

    css.append("@media (prefers-reduced-motion:reduce){.g0{animation:none;opacity:1}.g1,.g2{animation:none;opacity:0}"
               ".c0{animation:none;fill-opacity:1}.blink{animation:none}}")
    alt = " / ".join(lines)
    return fluid(H, "".join(body), fonts_css({"ms500": "".join(lines)}) + "".join(css), "Kasane Teto: " + alt), alt, H


# ---------------------------------------------------------------- small pieces
def button(th, label, primary=False):
    """The primary button is filled Teto red, the others are outlines. 2px of air on each side is
    part of the image, which with the space between the <img> tags makes an 8px gap. Padding and
    air are sized so the three buttons still share one line in a 328px column (a 360px phone)."""
    size, h, mx, pad = 13, 32, 2, 12
    w = round(measure(label, "ms500", size) + 2 * pad) + 2 * mx
    if primary:
        box, ink = f'<rect x="{mx}" width="{w - 2 * mx}" height="{h}" rx="6" fill="{th["btn"]}"/>', th["btnFg"]
    else:
        box = (f'<rect x="{mx + .5}" y=".5" width="{w - 2 * mx - 1}" height="{h - 1}" rx="5.5" fill="none" '
               f'stroke="{th["border"]}"/>')
        ink = th["fg"]
    body = (f'{box}<text x="{mx + pad}" y="{h / 2 + cap_height("ms500", size) / 2:.1f}" '
            f'style="{fam("ms500")};font-size:{size}px" fill="{ink}">{esc(label)}</text>')
    return svg(w, h, body, fonts_css({"ms500": label}), label), label, h


def counter(th):
    n, who = STATE["baguettes"], STATE.get("last_feeder")
    if n == 0:
        full = short = "No baguettes yet · be the first to feed her"
    else:
        unit = f"{n} baguette{'s' if n != 1 else ''}"
        full = f"{unit} so far · the last one came from @{who}"
        short = ellipsize(f"{unit} · last from @{who}", "ms400", 12, FIT["n"] - 8)
    h = 20
    y = h / 2 + cap_height("ms400", 12) / 2
    text = (f'<text class="{{c}}" x="50%" y="{y:.1f}" text-anchor="middle" style="{fam("ms400")};font-size:12px" '
            f'fill="{th["fgMuted"]}">{{t}}</text>')
    body = text.format(c="L w m s", t=esc(full)) + text.format(c="L n", t=esc(short))
    return fluid(h, body, fonts_css({"ms400": full + short}), full), full, h


def separator(th, label, pad):
    """Section label, a rule, and 0401 on the right edge. pad is the air above it."""
    h, mid = pad + 14, pad + 7
    lw = measure(label, "ms600", 11, 1.76)
    r = measure("0401", "stencil", 15, 0.9) + 12  # what the rule leaves free for 0401
    body = (f'<text x="0" y="{mid + cap_height("ms600", 11) / 2:.1f}" style="{fam("ms600")};font-size:11px;letter-spacing:1.76px" '
            f'fill="{th["fgMuted"]}">{esc(label)}</text>'
            # x2 is the right edge; shifting the whole line left by r makes it stop short of 0401
            f'<line x1="{lw + 12 + r:.1f}" y1="{mid + .5}" x2="100%" y2="{mid + .5}" transform="translate({-r:.1f},0)" '
            f'stroke="{th["border"]}" stroke-opacity=".7"/>'
            f'<text x="100%" dx=".9" y="{mid + cap_height("stencil", 15) / 2:.1f}" text-anchor="end" '
            f'style="{fam("stencil")};font-size:15px;letter-spacing:.9px" fill="{th["teto"]}">0401</text>')
    return fluid(h, body, fonts_css({"ms600": label, "stencil": "0401"}), label.title()), label.title(), h


# ---------------------------------------------------------------- project rows
ROW_H = 84


def meta_columns():
    """x of the language dot and the star, counted back from the right edge. One layout for every
    row (the widest language and star count decide), so the columns line up down the list."""
    rows = [DATA["repos"].get(p["repo"], {}) for p in CFG["projects"]]
    stw = max((measure(str(r.get("stars", 0)), "ms400", 12) for r in rows), default=8)
    lw = max((measure(r.get("language") or "—", "ms400", 12) for r in rows), default=24)
    star = -(7.5 + 16 + stw + 4 + 12)  # arrow ink, gap, count, gap, star
    lang = star - 16 - lw - 16  # gap, name, dot + its gap
    return {"star": star, "lang": lang, "w": -lang}


def row(th, i, p, meta):
    r = DATA["repos"].get(p["repo"], {})
    lang, stars = r.get("language") or "—", r.get("stars", 0)
    name, text = p["repo"], p["description"]
    used = {"mono": "", "ms600": "", "ms400": ""}
    parts = []
    if i > 0:
        parts.append(f'<rect width="100%" height="1" fill="{th["border"]}" fill-opacity=".5"/>')

    # layout, text x, title size, description size, line height, title-to-description gap,
    # air between title and meta, description lines. From "m" down the meta sits on the title
    # line, so the description gets the full width below it and may take two lines.
    layouts = (
        ("w", 40, 16, 14, 20, 23, 24, [ellipsize(text, "ms400", 14, FIT["w"] - 40 - 24 - meta["w"])]),
        ("m", 40, 16, 14, 20, 22, 16, wrap_max(text, "ms400", 14, FIT["m"] - 40, 2)),
        ("s", 40, 16, 14, 20, 21, 16, wrap_max(text, "ms400", 14, FIT["s"] - 40, 2)),
        ("n", 32, 15, 13, 18, 20, 12, wrap_max(text, "ms400", 13, FIT["n"] - 32, 2)),
    )
    mid = {}  # y of the title's cap centre: the index and the meta follow it on the smaller layouts
    for cls, x, ts, ds, lh, gap, air, lines in layouts:
        cap = cap_height("ms600", ts)
        y = (ROW_H - (cap + gap + (len(lines) - 1) * lh)) / 2 + cap
        title = ellipsize(name, "ms600", ts, FIT[cls] - x - air - meta["w"])
        parts.append(f'<text class="L {cls}" x="{x}" y="{y:.1f}" style="{fam("ms600")};font-size:{ts}px" fill="{th["fg"]}">{esc(title)}</text>')
        for li, line in enumerate(lines):
            parts.append(f'<text class="L {cls}" x="{x}" y="{y + gap + li * lh:.1f}" style="{fam("ms400")};font-size:{ds}px" '
                         f'fill="{th["fgMuted"]}">{esc(line)}</text>')
        used["ms600"] += title
        used["ms400"] += "".join(lines)
        mid[cls] = y - cap / 2
    mid["w"] = ROW_H / 2  # wide: centred on the whole row, like a list number
    css = tier_css(".ix,.meta", "transform", {c: f"translateY({v:.1f}px)" for c, v in mid.items()})

    idx = f"{i + 1:02d}"
    used["mono"] += idx
    parts.append(f'<text class="ix" x="0" y="{cap_height("mono", 12) / 2:.1f}" style="{fam("mono")};font-size:12px" '
                 f'fill="{th["teto"]}">{idx}</text>')

    st, ty = str(stars), cap_height("ms400", 12) / 2
    used["ms400"] += st + lang
    label = f'<text x="{{x:.1f}}" y="{ty:.1f}" style="{fam("ms400")};font-size:12px" fill="{th["fgMuted"]}">{{t}}</text>'
    m = (f'<circle cx="{meta["lang"] + 5:.1f}" cy="0" r="5" fill="{share_color(th, lang)}"/>'
         + label.format(x=meta["lang"] + 16, t=esc(lang))
         + STAR.format(x=f"{meta['star']:.1f}", y="-6", s=0.75, c=th["fgMuted"])
         + label.format(x=meta["star"] + 16, t=st)
         + ARROW.format(x="-11.75", y="-8", c=th["fgMuted"]))
    parts.append(anchor("100%", f'<g class="meta">{m}</g>'))

    alt = f"{name}: {text} ({lang}, {stars} stars)"
    return fluid(ROW_H, "".join(parts), fonts_css(used) + css, alt), alt, ROW_H


# ---------------------------------------------------------------- stack
BAR_Y, BAR_H = 24, 8


def stack(th):
    """One thin bar split by language share. Parts are separated by 2px gaps cut with a mask, so
    they stay transparent on any GitHub theme. The names and numbers live in the legend chips."""
    parts, total = shares()
    h = BAR_Y + BAR_H + 12
    segs, gaps, x = [], [], 0.0
    for i, (name, pct) in enumerate(parts):
        w = pct * 100 / total
        segs.append(f'<rect x="{x:.3f}%" y="{BAR_Y}" width="{w:.3f}%" height="{BAR_H}" fill="{share_color(th, name)}"/>')
        x += w
        if i < len(parts) - 1:
            gaps.append(f'<rect x="{x:.3f}%" y="{BAR_Y}" width="2" height="{BAR_H}" transform="translate(-1,0)"/>')
    body = (f'<mask id="bar"><rect y="{BAR_Y}" width="100%" height="{BAR_H}" rx="{BAR_H / 2}" fill="#fff"/>{"".join(gaps)}</mask>'
            f'<linearGradient id="sg"><stop offset="0" stop-color="#fff" stop-opacity="0"/>'
            f'<stop offset=".5" stop-color="#fff" stop-opacity="{th["sheen"]}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            f'<g mask="url(#bar)">{"".join(segs)}<rect class="sh" y="{BAR_Y}" width="30%" height="{BAR_H}" fill="url(#sg)"/></g>')
    # a highlight crosses the bar every few seconds; it waits off the left edge in between
    css = ("@keyframes sh{0%,78%{transform:translateX(-100%)}100%{transform:translateX(334%)}}"
           ".sh{transform-box:fill-box;transform:translateX(-100%);animation:sh 9s ease-in-out infinite}"
           "@media (prefers-reduced-motion:reduce){.sh{display:none}}")
    alt = ", ".join(f"{n} {p}%" for n, p in parts)
    return fluid(h, body, css, alt), alt, h


def chip(th, name, pct):
    """Legend entry. The 18px of air on the right is the gap to the next chip; they wrap like words."""
    h, size = 22, 12
    label = f"{pct}%"
    nw = measure(name, "ms500", size)
    w = round(14 + nw + 6 + measure(label, "ms400", size) + 18)
    y = h / 2 + cap_height("ms500", size) / 2
    body = (f'<circle cx="4" cy="{h / 2}" r="4" fill="{share_color(th, name)}"/>'
            f'<text x="14" y="{y:.1f}" style="{fam("ms500")};font-size:{size}px" fill="{th["fg"]}">{esc(name)}</text>'
            f'<text x="{14 + nw + 6:.1f}" y="{y:.1f}" style="{fam("ms400")};font-size:{size}px" fill="{th["fgMuted"]}">{label}</text>')
    alt = f"{name} {label}"
    return svg(w, h, body, fonts_css({"ms500": name, "ms400": label}), alt), alt, h


# ---------------------------------------------------------------- footer
def footer(th):
    t = CFG["credits"]
    segs = t.split(" · ")
    size, lh, top = 12, 18, 40
    laid = [(cls, balance(segs, " · ", "ms400", size, max_w))
            for cls, max_w in (("w m", 520), ("s", FIT["s"] - 40), ("n", FIT["n"] - 16))]
    y0 = top + cap_height("stencil", 30)
    y1 = y0 + 28
    h = round(y1 + (max(len(lines) for _, lines in laid) - 1) * lh + 10)
    body = [f'<text x="50%" dx=".9" y="{y0:.1f}" text-anchor="middle" style="{fam("stencil")};font-size:30px;letter-spacing:1.8px" '
            f'fill="{th["teto"]}">0401</text>']
    for cls, lines in laid:
        for li, line in enumerate(lines):
            body.append(f'<text class="L {cls}" x="50%" y="{y1 + li * lh:.1f}" text-anchor="middle" '
                        f'style="{fam("ms400")};font-size:{size}px" fill="{th["fgMuted"]}">{esc(line)}</text>')
    return fluid(h, "".join(body), fonts_css({"stencil": "0401", "ms400": t}), t), t, h


# ---------------------------------------------------------------- write
def issue_url(action, prompt):
    body = (f"{prompt}\n\nJust press **Create**. Teto answers here and on the profile in about a minute.\n\n"
            "Please don't change the title.")
    q = urllib.parse.urlencode({"title": f"teto|{action}", "body": body})
    return f"https://github.com/{CFG['owner']}/{CFG['repo']}/issues/new?{q}"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {}

    def picture(name, render, full_width=True):
        """Render a piece for both themes and return the <picture> that shows the right one.
        Dark is the default, as in GitHub's own docs for theme-specific images."""
        src = {}
        for theme, th in THEMES.items():
            content, alt, h = render(th)
            fname = f"{name}-{theme}-{short_hash(content)}.svg"
            files[fname] = content
            src[theme] = f"./assets/teto/{fname}"
        size = f'width="100%" height="{h}"' if full_width else f'height="{h}"'
        return (f'<picture><source media="(prefers-color-scheme: dark)" srcset="{src["dark"]}">'
                f'<source media="(prefers-color-scheme: light)" srcset="{src["light"]}">'
                f'<img src="{src["dark"]}" {size} alt="{esc(alt)}"></picture>')

    ctx = {"dialogue": picture("dialogue", dialogue), "counter": picture("counter", counter),
           "sep_projects": picture("sep-projects", lambda th: separator(th, "PROJECTS", 42)),
           # the last project row brings its own 25px of air, the section gap stays the same
           "sep_stack": picture("sep-stack", lambda th: separator(th, "STACK", 20)),
           "stack": picture("stack", stack), "footer": picture("footer", footer)}

    buttons = (("feed", "Feed her a baguette", "🥖 A baguette for Teto."), ("news", "What's new?", "Teto, what's new?"),
               ("poke", "Poke", "*poke*"))
    ctx["buttons"] = "\n  ".join(
        f'<a href="{issue_url(key, prompt)}">'
        + picture(f"btn-{key}", lambda th, label=label, key=key: button(th, label, primary=key == "feed"), full_width=False)
        + "</a>" for key, label, prompt in buttons)

    meta = meta_columns()
    ctx["rows"] = "<br>\n  ".join(
        f'<a href="https://github.com/{CFG["owner"]}/{p["repo"]}">'
        + picture(f"row-{re.sub(r'[^a-z0-9]+', '-', p['repo'].lower())}", lambda th, i=i, p=p: row(th, i, p, meta))
        + "</a>" for i, p in enumerate(CFG["projects"]))

    ctx["legend"] = "\n  ".join(
        picture(f"chip-{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') or f'lang{i}'}",
                lambda th, name=name, pct=pct: chip(th, name, pct), full_width=False)
        for i, (name, pct) in enumerate(shares()[0]))

    for old in OUT.glob("*.svg"):
        if old.name not in files:
            old.unlink()
    for name, content in files.items():
        (OUT / name).write_text(content, encoding="utf-8")

    tpl = (REPO / "teto" / "README.template.md").read_text(encoding="utf-8")
    readme = re.sub(r"\{\{(\w+)\}\}", lambda m: ctx[m.group(1)], tpl)
    (REPO / "README.md").write_text(readme, encoding="utf-8")
    print(f"built {len(files)} svgs, README.md ({len(readme)} bytes)")


if __name__ == "__main__":
    main()
