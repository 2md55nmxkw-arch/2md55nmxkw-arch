"""Render every README piece to SVG and write README.md from the template.

    python teto/build.py

Inputs: teto/config.json (what to show), teto/data.json (GitHub numbers, see fetch.py),
teto/state.json (Teto's mood, see interact.py). Output: assets/teto/*.svg with content-hashed
names (so GitHub's image cache never serves a stale copy) and README.md.
"""
import datetime as dt
import re
import urllib.parse

from lib import (ARROW, LANG_COLORS, P, REPO, STAR, cap_height, char_widths, ellipsize, esc, fam, fonts_css,
                 load_json, measure, short_hash, svg, wrap)

OUT = REPO / "assets" / "teto"
W = 848
CFG = load_json("config.json")
DATA = load_json("data.json")
STATE = load_json("state.json")
NOW = dt.datetime.now(dt.timezone.utc)
KEEP = {"banner.webp", "banner-static.png"}


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


# ---------------------------------------------------------------- dialogue
def dialogue():
    lines = [CFG["intro"], activity_line(), STATE["reply"]]
    size, lh, max_w = 22, 32, 660
    groups = [wrap(t, "ms500", size, max_w) for t in lines]
    max_lines = max(len(g) for g in groups)
    y_first = 34
    H = y_first + (max_lines - 1) * lh + 16
    cap = cap_height("ms500", size)

    # timing
    dt_char, lead, tail = 0.032, 0.25, 3.6
    windows, starts, t = [], [], lead
    for g in groups:
        n = sum(len(l) for l in g)
        win = max(7.0, n * dt_char + tail)
        starts.append(t)
        windows.append(win)
        t += win
    T = t
    css = [f".t{{{fam('ms500')};font-size:{size}px;fill:{P['fg']}}}",
           "@keyframes b{0%{opacity:1}50%{opacity:0}100%{opacity:1}}.blink{animation:b 1s steps(1) infinite}"]
    body = []

    for gi, g in enumerate(groups):
        win, s0 = windows[gi], starts[gi]
        fade_a = (win - 0.35) / T * 100
        vis = win / T * 100
        css.append(f"@keyframes g{gi}{{0%{{opacity:1}}{fade_a:.3f}%{{opacity:1}}{vis:.3f}%{{opacity:0}}100%{{opacity:0}}}}"
                   f".g{gi}{{opacity:0;animation:g{gi} {T:.2f}s linear infinite;animation-delay:{s0:.2f}s}}")
        css.append(f"@keyframes c{gi}{{0%{{fill-opacity:1}}{vis - 0.001:.3f}%{{fill-opacity:1}}{vis:.3f}%{{fill-opacity:0}}"
                   f"100%{{fill-opacity:0}}}}.c{gi}{{fill-opacity:0;animation:c{gi} {T:.2f}s linear infinite}}")
        off = (max_lines - len(g)) * lh / 2
        parts, k, end = [], 0, (0, 0)
        for li, line in enumerate(g):
            y = y_first + off + li * lh
            ws = char_widths(line, "ms500", size)
            x = (W - sum(ws)) / 2
            spans = []
            for ch, cw in zip(line, ws):
                if ch != " ":
                    spans.append(f'<tspan x="{x:.1f}" class="c{gi}" style="animation-delay:{s0 + k * dt_char:.3f}s">{esc(ch)}</tspan>')
                x += cw
                k += 1
            k += 1  # the wrapped space
            parts.append(f'<text class="t" y="{y:.1f}">{"".join(spans)}</text>')
            end = (x, y)
        cx, cy = end
        parts.append(f'<g class="blink"><rect x="{cx + 3:.1f}" y="{cy - cap - 3:.1f}" width="2" height="{cap + 7:.1f}" '
                     f'rx="1" fill="{P["teto"]}" class="c{gi}" style="animation-delay:{s0 + k * dt_char:.3f}s"/></g>')
        body.append(f'<g class="g{gi}">{"".join(parts)}</g>')

    css.append("@media (prefers-reduced-motion:reduce){.g0{animation:none;opacity:1}.g1,.g2{animation:none;opacity:0}"
               ".c0{animation:none;fill-opacity:1}.blink{animation:none}}")
    chars = {"ms500": "".join(lines)}
    alt = " / ".join(lines)
    return svg(W, int(H), "".join(body), fonts_css(chars) + "".join(css), "Kasane Teto: " + alt), alt


# ---------------------------------------------------------------- small pieces
def button(label):
    size, h = 13, 32
    tw = measure(label, "ms500", size)
    w = round(tw + 28)
    body = (f'<rect width="{w}" height="{h}" rx="6" fill="{P["btn"]}"/>'
            f'<text x="14" y="{h / 2 + cap_height("ms500", size) / 2:.1f}" style="{fam("ms500")};font-size:{size}px" '
            f'fill="{P["fg"]}">{esc(label)}</text>')
    return svg(w, h, body, fonts_css({"ms500": label}), label)


def counter():
    n, who = STATE["baguettes"], STATE.get("last_feeder")
    if n == 0:
        t = "No baguettes yet · be the first to feed her"
    else:
        t = f"{n} baguette{'s' if n != 1 else ''} so far · the last one came from @{who}"
    cap = cap_height("ms400", 12)
    body = (f'<text x="{W / 2}" y="{10 + cap / 2:.1f}" text-anchor="middle" style="{fam("ms400")};font-size:12px" '
            f'fill="{P["fgMuted"]}">{esc(t)}</text>')
    return svg(W, 20, body, fonts_css({"ms400": t}), t), t


def separator(label):
    # GitHub puts its disclosure triangle on the text baseline, i.e. the image's bottom edge,
    # so the label and line sit low (centre at y=15) to line up with the triangle.
    w, h, mid = 806, 20, 15
    lw = measure(label, "ms600", 11, 1.76)
    tw = measure("0401", "stencil", 15, 0.9)
    body = (f'<text x="2" y="{mid + cap_height("ms600", 11) / 2:.1f}" style="{fam("ms600")};font-size:11px;letter-spacing:1.76px" '
            f'fill="{P["fgMuted"]}">{esc(label)}</text>'
            f'<rect x="{2 + lw + 12:.1f}" y="{mid}" width="{w - tw - 12 - (2 + lw + 12):.1f}" height="1" fill="{P["border"]}" fill-opacity=".7"/>'
            f'<text x="{w - tw:.1f}" y="{mid + cap_height("stencil", 15) / 2:.1f}" style="{fam("stencil")};font-size:15px;letter-spacing:.9px" '
            f'fill="{P["teto"]}" fill-opacity=".4">0401</text>')
    return svg(w, h, body, fonts_css({"ms600": label, "stencil": "0401"}), label.title())


def row(i, p):
    r = DATA["repos"].get(p["repo"], {})
    lang, stars = r.get("language") or "—", r.get("stars", 0)
    h, cy = 78, 39
    used = {"mono": "", "ms600": "", "ms400": ""}
    parts = []
    if i > 0:
        parts.append(f'<rect width="{W}" height="1" fill="{P["border"]}" fill-opacity=".5"/>')
    idx = f"{i + 1:02d}"
    used["mono"] += idx
    parts.append(f'<text x="4" y="{cy + cap_height("mono", 12) / 2:.1f}" style="{fam("mono")};font-size:12px" '
                 f'fill="{P["fgMuted"]}" fill-opacity=".6">{idx}</text>')
    # meta, right to left
    x = W - 8 - 16
    parts.append(ARROW.format(x=f"{x:.1f}", y=f"{cy - 8}", c=P["fgMuted"]))
    st = str(stars)
    stw = measure(st, "ms400", 12)
    x -= 16 + stw
    parts.append(f'<text x="{x:.1f}" y="{cy + cap_height("ms400", 12) / 2:.1f}" style="{fam("ms400")};font-size:12px" fill="{P["fgMuted"]}">{st}</text>')
    x -= 4 + 12
    parts.append(STAR.format(x=f"{x:.1f}", y=f"{cy - 6}", s=0.75, c=P["fgMuted"]))
    lw = measure(lang, "ms400", 12)
    x -= 16 + lw
    parts.append(f'<text x="{x:.1f}" y="{cy + cap_height("ms400", 12) / 2:.1f}" style="{fam("ms400")};font-size:12px" fill="{P["fgMuted"]}">{esc(lang)}</text>')
    x -= 6 + 10
    parts.append(f'<circle cx="{x + 5:.1f}" cy="{cy}" r="5" fill="{LANG_COLORS.get(lang, P["fgMuted"])}"/>')
    used["ms400"] += st + lang
    # name + description
    desc = ellipsize(p["description"], "ms400", 14, x - 44 - 24)
    used["ms600"] += p["repo"]
    used["ms400"] += desc
    parts.append(f'<text x="44" y="33" style="{fam("ms600")};font-size:16px" fill="{P["fg"]}">{esc(p["repo"])}</text>')
    parts.append(f'<text x="44" y="56" style="{fam("ms400")};font-size:14px" fill="{P["fgMuted"]}">{esc(desc)}</text>')
    alt = f"{p['repo']}: {p['description']} ({lang}, {stars} stars)"
    return svg(W, h, "".join(parts), fonts_css(used), alt), alt


def stack():
    langs = DATA["languages"]
    w, h, col, tr_h = 600, 160, 120, 104
    top = max(p for _, p in langs) or 1
    parts, css, used = [], [], {"ms500": "", "ms400": ""}
    durs = [1.3, 1.7, 1.1, 1.9, 1.5]
    depth = [0.86, 0.9, 0.82, 0.92, 0.88]
    x0 = (w - col * len(langs)) / 2
    for i, (name, pct) in enumerate(langs):
        cx = x0 + col * i + col / 2
        lvl = max(6, round(tr_h * pct / top))
        c = LANG_COLORS.get(name, P["fgMuted"])
        parts.append(f'<clipPath id="k{i}"><rect x="{cx - 6:.1f}" y="8" width="12" height="{tr_h}" rx="6"/></clipPath>')
        parts.append(f'<rect x="{cx - 6:.1f}" y="8" width="12" height="{tr_h}" rx="6" fill="{P["muted"]}"/>')
        parts.append(f'<g clip-path="url(#k{i})"><rect class="b{i}" x="{cx - 6:.1f}" y="{8 + tr_h - lvl}" width="12" height="{lvl}" rx="6" fill="{c}"/></g>')
        css.append(f"@keyframes b{i}{{0%,100%{{transform:scaleY(1)}}50%{{transform:scaleY({depth[i % 5]})}}}}"
                   f".b{i}{{transform-box:fill-box;transform-origin:50% 100%;animation:b{i} {durs[i % 5]}s ease-in-out infinite}}")
        label = f"{pct}%"
        parts.append(f'<text x="{cx:.1f}" y="134" text-anchor="middle" style="{fam("ms500")};font-size:12px" fill="{P["fg"]}">{esc(name)}</text>')
        parts.append(f'<text x="{cx:.1f}" y="152" text-anchor="middle" style="{fam("ms400")};font-size:12px" fill="{P["fgMuted"]}">{label}</text>')
        used["ms500"] += name
        used["ms400"] += label
    css.append("@media (prefers-reduced-motion:reduce){[class^=b]{animation:none}}")
    alt = ", ".join(f"{n} {p}%" for n, p in langs)
    return svg(w, h, "".join(parts), fonts_css(used) + "".join(css), alt), alt


def footer():
    t = CFG["credits"]
    sw = measure("0401", "stencil", 30, 1.8)
    body = (f'<text x="{(W - sw) / 2:.1f}" y="32" style="{fam("stencil")};font-size:30px;letter-spacing:1.8px" '
            f'fill="{P["teto"]}" fill-opacity=".4">0401</text>'
            f'<text x="{W / 2}" y="58" text-anchor="middle" style="{fam("ms400")};font-size:11px" fill="{P["fgMuted"]}">{esc(t)}</text>')
    return svg(W, 66, body, fonts_css({"stencil": "0401", "ms400": t}), t), t


# ---------------------------------------------------------------- write
def issue_url(action, prompt):
    body = (f"{prompt}\n\nJust press **Create**. Teto answers here and on the profile in about a minute.\n\n"
            "Please don't change the title.")
    q = urllib.parse.urlencode({"title": f"teto|{action}", "body": body})
    return f"https://github.com/{CFG['owner']}/{CFG['repo']}/issues/new?{q}"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files, ctx = {}, {}

    def put(key, name, content):
        fname = f"{name}-{short_hash(content)}.svg"
        files[fname] = content
        ctx[key] = f"./assets/teto/{fname}"

    d, ctx["alt_dialogue"] = dialogue()
    put("dialogue", "dialogue", d)
    for key, label in (("feed", "Feed her a baguette"), ("news", "What's new?"), ("poke", "Poke")):
        put(f"btn_{key}", f"btn-{key}", button(label))
        ctx[f"alt_btn_{key}"] = label
    ctx["issue_feed"] = issue_url("feed", "🥖 A baguette for Teto.")
    ctx["issue_news"] = issue_url("news", "Teto, what's new?")
    ctx["issue_poke"] = issue_url("poke", "*poke*")
    c, ctx["alt_counter"] = counter()
    put("counter", "counter", c)
    put("sep_projects", "sep-projects", separator("PROJECTS"))
    put("sep_stack", "sep-stack", separator("STACK"))
    rows = []
    for i, p in enumerate(CFG["projects"]):
        s, alt = row(i, p)
        name = f"row-{re.sub(r'[^a-z0-9]+', '-', p['repo'].lower())}"
        fname = f"{name}-{short_hash(s)}.svg"
        files[fname] = s
        rows.append(f'<a href="https://github.com/{CFG["owner"]}/{p["repo"]}"><img src="./assets/teto/{fname}" width="100%" alt="{esc(alt)}"></a>')
    ctx["rows"] = "<br>\n".join(rows)
    s, ctx["alt_stack"] = stack()
    put("stack", "stack", s)
    f, ctx["alt_footer"] = footer()
    put("footer", "footer", f)

    for old in OUT.glob("*.svg"):
        if old.name not in files:
            old.unlink()
    for name, content in files.items():
        (OUT / name).write_text(content, encoding="utf-8")

    tpl = (REPO / "teto" / "README.template.md").read_text(encoding="utf-8")
    readme = re.sub(r"\{\{(\w+)\}\}", lambda m: esc(ctx[m.group(1)]) if m.group(1).startswith("alt_") else ctx[m.group(1)], tpl)
    (REPO / "README.md").write_text(readme, encoding="utf-8")
    print(f"built {len(files)} svgs, README.md ({len(readme)} bytes)")


if __name__ == "__main__":
    main()
