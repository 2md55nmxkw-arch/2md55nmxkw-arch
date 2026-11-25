"""Render every README piece to SVG, once per GitHub theme, and write README.md from the template.

    python teto/build.py

Inputs: teto/config.json (what to show), teto/data.json (GitHub numbers, see fetch.py),
teto/state.json (baguettes, guests, Teto's last reply, see interact.py). Output: assets/teto/*.svg
with content-hashed names (so GitHub's image cache never serves a stale copy) and README.md.

Teto has moods (lib.mood). Hungry: nobody fed her for a few days, so she says so, the feed button
breathes and the banner loses its glow. Happy: for a day after a baguette the banner glows and
sparkles. Birthday: April 1st, with its own line, a banner with confetti and a highlighted 0401.
In December it snows in the banner, around the end of March petals fall.
TETO_NOW=2027-04-01T03:00:00Z python teto/build.py previews a date.

assets/teto/header-<repo>-dark.svg / -light.svg are headers for the projects' own READMEs, and
ribbon-<repo>-*.svg is just their first line, for a README that already has a header of its own.
Their names are stable, because those READMEs link to them from another repository.

Full-width pieces are fluid (lib.fluid): they keep their pixel height and real text size at any
column width and switch layout on their own, from wide down to phone-narrow. They share
one edge grid: content starts at x=0 and ends at 100%, so every block lines up with the others.
"""
import re
import urllib.parse

from lib import (ARROW, FIT, REPO, STAR, THEMES, anchor, avatar_uri, balance, cap_height, char_widths, ellipsize,
                 esc, fam, fluid, fonts_css, load_json, measure, mood, now, parse_time, short_hash, svg, tier_css,
                 top_feeder, wrap, wrap_after, wrap_max)

OUT = REPO / "assets" / "teto"
CFG = load_json("config.json")
DATA = load_json("data.json")
STATE = load_json("state.json")
NOW = now()
MOOD = mood(STATE, CFG, NOW)
# a configured repo that GitHub no longer returns (deleted, renamed, made private) is left out
# instead of becoming a row with a dead link; with no data at all, everything is shown
PROJECTS = [p for p in CFG["projects"] if p["repo"] in DATA["repos"]] or CFG["projects"]


# ---------------------------------------------------------------- lines Teto says
def ago(iso):
    d = (NOW - parse_time(iso)).days
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


def activity_note():
    """A remark on how the last days went, or None when nothing stands out. Today may have
    only just begun, so a day without anything yet doesn't end a run."""
    days = DATA.get("activity") or []
    if len(days) < 7:
        return None
    today, before = days[-1], days[:-1]
    big, when = max((today, "today"), (before[-1], "yesterday"))
    if big >= CFG.get("big_day", 30):
        return f"{big} contributions {when}? Go to sleep."
    quiet = next((i for i, v in enumerate(reversed(days)) if v), len(days))
    if quiet >= 4:
        return f"{quiet} quiet days in a row. I'm starting to worry."
    run = next((i for i, v in enumerate(reversed(days if today else before)) if not v), len(days))
    if run >= 5:
        return f"{run} days in a row. Somebody is on a roll."
    return None


def activity_line():
    best = None
    for p in PROJECTS:
        r = DATA["repos"].get(p["repo"])
        if r and r.get("pushedAt") and (best is None or r["pushedAt"] > best[1]["pushedAt"]):
            best = (p, r)
    if not best:
        return "Quiet times. They're probably staring at a disassembler again."
    p, r = best
    line = f"Latest push went to {p['repo']}, {ago(r['pushedAt'])}. {p['flavor']}"
    note, wc = activity_note(), DATA.get("week_contributions")
    if note:
        line += " " + note
    elif wc:
        line += f" {wc} contributions this week."
    return line


HUNGRY = ("{d} days without a baguette. I'm counting.",
          "Day {d} with no bread. My drills are starting to droop.",
          "It has been {d} days. The red button is right there.")
BIRTHDAY = "It's April 1st, my birthday. I started out as a joke and I'm still here."


def spoken_lines():
    """What the dialogue types: who this is, the latest push, Teto's last reply. On her birthday she
    opens with that. When she is hungry and nobody has talked to her for a day, she says so instead
    of repeating the old reply (a fresh reply stays, so a poke still shows up on the profile)."""
    first = BIRTHDAY if MOOD["birthday"] else CFG["intro"]
    last = STATE["reply"]
    event = STATE.get("last_event")
    quiet = not event or (NOW - parse_time(event["at"])).days >= 1
    if MOOD["hungry"] and quiet:
        d = MOOD["days"]
        if d is None:
            last = "Nobody has fed me yet. The red button is right there."
        elif MOOD["birthday"]:
            last = f"It's my birthday and I haven't had a baguette for {d} days."
        else:
            last = HUNGRY[d % len(HUNGRY)].format(d=d)
    return [first, activity_line(), last]


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
    lines = spoken_lines()
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
    air are sized so the three buttons still share one line in a 328px column (a 360px phone).
    While Teto is hungry the primary button breathes."""
    size, h, mx, pad = 13, 32, 2, 12
    w = round(measure(label, "ms500", size) + 2 * pad) + 2 * mx
    css = ""
    if primary:
        box, ink = f'<rect class="hp" x="{mx}" width="{w - 2 * mx}" height="{h}" rx="6" fill="{th["btn"]}"/>', th["btnFg"]
        if MOOD["hungry"]:
            css = ("@keyframes hp{0%,100%{opacity:1}50%{opacity:.62}}.hp{animation:hp 1.8s ease-in-out infinite}"
                   "@media (prefers-reduced-motion:reduce){.hp{animation:none}}")
    else:
        box = (f'<rect x="{mx + .5}" y=".5" width="{w - 2 * mx - 1}" height="{h - 1}" rx="5.5" fill="none" '
               f'stroke="{th["border"]}"/>')
        ink = th["fg"]
    body = (f'{box}<text x="{mx + pad}" y="{h / 2 + cap_height("ms500", size) / 2:.1f}" '
            f'style="{fam("ms500")};font-size:{size}px" fill="{ink}">{esc(label)}</text>')
    return svg(w, h, body, fonts_css({"ms500": label}) + css, label), label, h


def counter(th):
    """Baguettes so far and who or what is behind the number; under it, ten pips that fill up
    towards the next round baguette, with what that one brings."""
    n, who, d = STATE["baguettes"], STATE.get("last_feeder"), MOOD["days"]
    unit = f"{n} baguette{'s' if n != 1 else ''}"
    if n == 0 or d is None:
        full = short = "No baguettes yet · be the first to feed her"
    elif MOOD["birthday"] and MOOD["hungry"]:
        full, short = f"{unit} so far · it's her birthday and she's hungry", f"{unit} · birthday, and hungry"
    elif MOOD["birthday"]:
        full, short = f"{unit} so far · today is her birthday", f"{unit} · it's her birthday"
    elif MOOD["hungry"]:
        full, short = f"{unit} so far · she hasn't eaten for {d} days", f"{unit} · hungry for {d} days"
    else:
        full = f"{unit} so far · the last one came from @{who}"
        short = ellipsize(f"{unit} · last from @{who}", "ms400", 12, FIT["n"] - 8)
    h = 40
    y = 10 + cap_height("ms400", 12) / 2
    text = (f'<text class="{{c}}" x="50%" y="{y:.1f}" text-anchor="middle" style="{fam("ms400")};font-size:12px" '
            f'fill="{th["fgMuted"]}">{{t}}</text>')
    body = text.format(c="L w m s", t=esc(full)) + text.format(c="L n", t=esc(short))

    step, sing = CFG.get("milestone_every", 10), CFG.get("sing_after", 25)
    done = step if n and n % step == 0 else n % step  # a round baguette shows the scale full
    if n and n % step == 0:
        note = f"baguette {n}, a round one"
    elif n < sing:
        note = f"{sing - n} more and she sings"
    else:
        note = f"{step - done} more to baguette {n - done + step}"
    pw, gap, ph = 8, 3, 4
    scale_w = step * pw + (step - 1) * gap
    x0 = -(scale_w + 10 + measure(note, "ms400", 11)) / 2  # pips and note centred as one group
    pips = "".join(f'<rect x="{x0 + i * (pw + gap):.1f}" y="{30 - ph / 2}" width="{pw}" height="{ph}" rx="{ph / 2}" '
                   + (f'fill="{th["teto"]}"/>' if i < done else f'fill="{th["rest"]}" fill-opacity=".5"/>') for i in range(step))
    body += anchor("50%", pips + f'<text x="{x0 + scale_w + 10:.1f}" y="{30 + cap_height("ms400", 11) / 2:.1f}" '
                                 f'style="{fam("ms400")};font-size:11px" fill="{th["fgMuted"]}">{esc(note)}</text>')
    alt = f"{full}; {note}"
    return fluid(h, body, fonts_css({"ms400": full + short + note}), alt), alt, h


def mark(th, mid):
    """0401 on the right edge at height mid, and the width it takes. On Teto's birthday it is
    highlighted: page-coloured digits on a red block."""
    tw = measure("0401", "stencil", 15, 0.9) - 0.9
    y = mid + cap_height("stencil", 15) / 2
    style = f'style="{fam("stencil")};font-size:15px;letter-spacing:.9px"'
    if not MOOD["birthday"]:
        return anchor("100%", f'<text x="{-tw:.1f}" y="{y:.1f}" {style} fill="{th["teto"]}">0401</text>'), tw
    w = tw + 12
    return anchor("100%", f'<rect x="{-w:.1f}" y="{mid - 9}" width="{w:.1f}" height="18" rx="4" fill="{th["teto"]}"/>'
                          f'<text x="{-w + 6:.1f}" y="{y:.1f}" {style} fill="{th["canvas"]}">0401</text>'), w


def rule_row(th, mid, x, label):
    """Tracked label starting at x, a rule, and the 0401 mark: the line every section opens with."""
    lw = measure(label, "ms600", 11, 1.76)
    m, mw = mark(th, mid)
    r = mw + 12  # what the rule leaves free for 0401
    return (f'<text x="{x:.1f}" y="{mid + cap_height("ms600", 11) / 2:.1f}" style="{fam("ms600")};font-size:11px;letter-spacing:1.76px" '
            f'fill="{th["fgMuted"]}">{esc(label)}</text>'
            # x2 is the right edge; shifting the whole line left by r makes it stop short of 0401
            f'<line x1="{x + lw + 12 + r:.1f}" y1="{mid + .5}" x2="100%" y2="{mid + .5}" transform="translate({-r:.1f},0)" '
            f'stroke="{th["border"]}" stroke-opacity=".7"/>' + m)


def separator(th, label, pad):
    """Section label, a rule, and 0401 on the right edge. pad is the air above it."""
    h, mid = pad + 14, pad + 7
    return fluid(h, rule_row(th, mid, 0, label), fonts_css({"ms600": label, "stencil": "0401"}), label.title()), label.title(), h


# ---------------------------------------------------------------- project rows
ROW_H = 84


def meta_columns():
    """x of the language dot and the star, counted back from the right edge. One layout for every
    row (the widest language and star count decide), so the columns line up down the list."""
    rows = [DATA["repos"].get(p["repo"], {}) for p in PROJECTS]
    stw = max((measure(str(r.get("stars", 0)), "ms400", 12) for r in rows), default=8)
    lw = max((measure(r.get("language") or "—", "ms400", 12) for r in rows), default=24)
    star = -(7.5 + 16 + stw + 4 + 12)  # arrow ink, gap, count, gap, star
    lang = star - 16 - lw - 16  # gap, name, dot + its gap
    dot = star - 16 - 10  # the narrow layout has no room for the language's name: the dot moves up to the star
    return {"star": star, "lang": lang, "w": -lang, "dot": dot, "wn": -dot}


def row(th, i, p, meta):
    r = DATA["repos"].get(p["repo"], {})
    lang, stars = r.get("language") or "—", r.get("stars", 0)
    name, text = p["repo"], p["description"]
    used = {"mono": "", "ms600": "", "ms400": ""}
    parts = []
    if i > 0:
        parts.append(f'<rect width="100%" height="1" fill="{th["border"]}" fill-opacity=".5"/>')

    # a repository archived on GitHub says so, the way GitHub labels it: next to its name, or in
    # front of the description on the narrow layout, where the name needs the whole line
    tag = "archived" if r.get("archived") else None
    tag_w = measure(tag, "ms500", 10.5) + 14 if tag else 0
    if tag:
        used["ms500"] = tag

    def pill(cls, x, yc):
        return (f'<g class="L {cls}"><rect x="{x + .5:.1f}" y="{yc - 8:.1f}" width="{tag_w - 1:.1f}" height="16" rx="8" fill="none" '
                f'stroke="{th["border"]}"/><text x="{x + 7:.1f}" y="{yc + cap_height("ms500", 10.5) / 2:.1f}" '
                f'style="{fam("ms500")};font-size:10.5px" fill="{th["fgMuted"]}">{tag}</text></g>')

    # layout, text x, title size, description size, line height, title-to-description gap,
    # room for the title, description lines. From "m" down the meta sits on the title line, so
    # the description gets the full width below it and may take two lines.
    beside = tag_w + 10 if tag else 0  # the label next to the title
    before = tag_w + 6 if tag else 0  # the label in front of the description
    layouts = (
        ("w", 40, 16, 14, 20, 23, FIT["w"] - 40 - 24 - meta["w"] - beside, [ellipsize(text, "ms400", 14, FIT["w"] - 40 - 24 - meta["w"])]),
        ("m", 40, 16, 14, 20, 22, FIT["m"] - 40 - 16 - meta["w"] - beside, wrap_max(text, "ms400", 14, FIT["m"] - 40, 2)),
        ("s", 40, 16, 14, 20, 21, FIT["s"] - 40 - 16 - meta["w"] - beside, wrap_max(text, "ms400", 14, FIT["s"] - 40, 2)),
        ("n", 32, 15, 13, 18, 20, FIT["n"] - 32 - 12 - meta["wn"], wrap_after(text, "ms400", 13, FIT["n"] - 32, before, 2)),
    )
    mid = {}  # y of the title's cap centre: the index and the meta follow it on the smaller layouts
    for cls, x, ts, ds, lh, gap, room, lines in layouts:
        cap = cap_height("ms600", ts)
        y = (ROW_H - (cap + gap + (len(lines) - 1) * lh)) / 2 + cap
        title = ellipsize(name, "ms600", ts, room)
        parts.append(f'<text class="L {cls}" x="{x}" y="{y:.1f}" style="{fam("ms600")};font-size:{ts}px" fill="{th["fg"]}">{esc(title)}</text>')
        if tag and cls != "n":
            parts.append(pill(cls, x + measure(title, "ms600", ts) + 10, y - cap / 2))
        elif tag:
            parts.append(pill(cls, x, y + gap - cap_height("ms400", ds) / 2))
        for li, line in enumerate(lines):
            lx = x + before if cls == "n" and li == 0 else x
            parts.append(f'<text class="L {cls}" x="{lx:.1f}" y="{y + gap + li * lh:.1f}" style="{fam("ms400")};font-size:{ds}px" '
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
    fresh = r.get("pushedAt") and (NOW - parse_time(r["pushedAt"])).days < CFG.get("fresh_days", 7)
    if fresh:  # pushed to within the last week: a ring keeps spreading from the language dot
        css += ("@keyframes pl{0%{transform:scale(1);opacity:.7}70%,100%{transform:scale(2.3);opacity:0}}"
                ".pl{transform-box:fill-box;transform-origin:center;animation:pl 2.4s ease-out infinite}"
                "@media (prefers-reduced-motion:reduce){.pl{display:none}}")
    colour = share_color(th, lang)

    def dot(cx):
        ring = f'<circle class="pl" cx="{cx:.1f}" cy="0" r="5" fill="{colour}"/>' if fresh else ""
        return ring + f'<circle cx="{cx:.1f}" cy="0" r="5" fill="{colour}"/>'

    m = (f'<g class="L w m s">{dot(meta["lang"] + 5)}{label.format(x=meta["lang"] + 16, t=esc(lang))}</g>'
         + f'<g class="L n">{dot(meta["dot"] + 5)}</g>'  # no room for the name next to a long title: the dot alone
         + STAR.format(x=f"{meta['star']:.1f}", y="-6", s=0.75, c=th["fgMuted"])
         + label.format(x=meta["star"] + 16, t=st)
         + ARROW.format(x="-11.75", y="-8", c=th["fgMuted"]))
    parts.append(anchor("100%", f'<g class="meta">{m}</g>'))

    alt = f"{name}: {text} ({lang}, {stars} stars{', archived' if tag else ''})"
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


# ---------------------------------------------------------------- activity
STRIP_Y, STRIP_H = 24, 10


def levels(values):
    """0 for an empty cell, else 1-4 by quartile among the cells that have something."""
    busy = sorted(v for v in values if v > 0)
    if not busy:
        return [0] * len(values)
    cuts = [busy[int((len(busy) - 1) * f)] for f in (0.25, 0.5, 0.75)]
    return [0 if v == 0 else 1 + sum(v > c for c in cuts) for v in values]


def level_fill(th, level):
    """More contributions sit further from the page colour; an empty cell is a faint neutral."""
    if level == 0:
        return f'fill="{th["rest"]}" fill-opacity=".45"'
    return f'fill="{th["ramp"][4 - level]}"'


def strip(th, values, gap, mask_id):
    """A row of equal cells across the full width, cut apart by a mask like the stack bar."""
    n = len(values)
    cells = "".join(f'<rect x="{i * 100 / n:.3f}%" y="{STRIP_Y}" width="{100 / n:.3f}%" height="{STRIP_H}" {level_fill(th, lv)}/>'
                    for i, lv in enumerate(levels(values)))
    cuts = "".join(f'<rect x="{i * 100 / n:.3f}%" y="{STRIP_Y}" width="{gap}" height="{STRIP_H}" transform="translate({-gap / 2},0)"/>'
                   for i in range(1, n))
    return (f'<mask id="{mask_id}"><rect y="{STRIP_Y}" width="100%" height="{STRIP_H}" rx="3" fill="#fff"/>{cuts}</mask>'
            f'<g mask="url(#{mask_id})">{cells}</g>')


def activity(th):
    """The last 12 weeks, oldest on the left: a cell per day, or a cell per week where the column
    is too narrow for 84 of them. The caption carries the number; the key reads less to more."""
    days = (DATA.get("activity") or [])[-84:]
    weeks = [sum(days[max(0, i - 7):i]) for i in range(len(days), 0, -7)][::-1]  # counted back from today
    total = sum(days)
    h = STRIP_Y + STRIP_H + 32
    y = STRIP_Y + STRIP_H + 22
    n = f"{total:,}"
    nw = measure(n, "ms500", 12)
    tail = {"L w m s": "contributions in the last 12 weeks", "L n": "contributions · 12 weeks"}
    body = [f'<g class="L w m">{strip(th, days, 2, "d")}</g>', f'<g class="L s n">{strip(th, weeks, 3, "k")}</g>',
            f'<text x="0" y="{y}" style="{fam("ms500")};font-size:12px" fill="{th["fg"]}">{n}</text>']
    body += [f'<text class="{cls}" x="{nw + 4:.1f}" y="{y}" style="{fam("ms400")};font-size:12px" fill="{th["fgMuted"]}">{esc(t)}</text>'
             for cls, t in tail.items()]
    # key on the right edge: less, five swatches, more
    more_w = measure("more", "ms400", 12)
    x = -(more_w + 6 + 5 * 11 - 3)
    key = [f'<text x="{x - 6:.1f}" y="{y}" text-anchor="end" style="{fam("ms400")};font-size:12px" fill="{th["fgMuted"]}">less</text>']
    key += [f'<rect x="{x + i * 11:.1f}" y="{y - 8.5}" width="8" height="8" rx="2" {level_fill(th, i)}/>' for i in range(5)]
    key.append(f'<text x="{-more_w:.1f}" y="{y}" style="{fam("ms400")};font-size:12px" fill="{th["fgMuted"]}">more</text>')
    body.append(anchor("100%", "".join(key)))
    alt = f"{n} contributions in the last 12 weeks"
    return fluid(h, "".join(body), fonts_css({"ms500": n, "ms400": "".join(tail.values()) + "lessmore"}), alt), alt, h


# ---------------------------------------------------------------- guests
VERB = {"feed": "fed her", "poke": "poked her", "news": "asked what's new", "sing": "asked for a song"}


def guest_list():
    """The last visitors, newest first. Whoever has fed Teto the most always stands first, wearing a
    crown, even when their last visit is too long ago to be in the list. -> [(guest, baguettes or None)]"""
    guests = list(STATE.get("guests") or [])
    top = top_feeder(STATE)
    if not top:
        return [(g, None) for g in guests]
    first = next((g for g in guests if g["user"].lower() == top[0].lower()), {"user": top[0], "action": "feed"})
    rest = [g for g in guests if g is not first][: CFG.get("guests_shown", 8) - 1]
    return [(first, top[1])] + [(g, None) for g in rest]


def guest_title(g, most):
    if most:
        return f"@{g['user']} has fed her the most: {most} baguette{'s' if most != 1 else ''}"
    return f"@{g['user']} {VERB.get(g['action'], 'was here')}"


def guest(th, g, most=None):
    """One of the last visitors: a round avatar in a ring, Teto red if they fed her. The avatar is
    embedded from teto/guests/; until it has been fetched, the first letter of the login stands in.
    most: this is the top feeder, who gets a small crown on the ring."""
    w, h, r = 34, 38, 13
    cx, cy = w / 2, h - w / 2
    uri, css = avatar_uri(g["user"]), ""
    if uri:
        face = (f'<clipPath id="c"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>'
                f'<image href="{uri}" x="{cx - r}" y="{cy - r}" width="{2 * r}" height="{2 * r}" clip-path="url(#c)" '
                f'preserveAspectRatio="xMidYMid slice"/>')
    else:
        letter = g["user"][0].upper()
        css = fonts_css({"ms600": letter})
        face = (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{th["rest"]}" fill-opacity=".5"/>'
                f'<text x="{cx}" y="{cy + cap_height("ms600", 13) / 2:.1f}" text-anchor="middle" '
                f'style="{fam("ms600")};font-size:13px" fill="{th["fg"]}">{esc(letter)}</text>')
    ring = th["teto"] if g["action"] == "feed" else th["border"]
    body = face + f'<circle cx="{cx}" cy="{cy}" r="{r + 2.75}" fill="none" stroke="{ring}" stroke-width="1.5"/>'
    if most:
        # three points on a band, with a rim in the page colour so it reads against the ring it sits on
        body += (f'<path d="M{cx - 7} 9.5 L{cx - 7} 2.5 L{cx - 3.5} 6 L{cx} 1 L{cx + 3.5} 6 L{cx + 7} 2.5 L{cx + 7} 9.5 Z" '
                 f'fill="{th["teto"]}" stroke="{th["canvas"]}" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/>')
    alt = guest_title(g, most)
    return svg(w, h, body, css, alt), alt, h


# ---------------------------------------------------------------- headers for the projects' own READMEs
def project_line(th, i, used):
    """The profile's section line for a project: its number in the list, whose project it is, a rule, 0401."""
    idx, label = f"{i + 1:02d}", f"{CFG.get('name') or CFG['owner']} · PROJECT".upper()
    used["mono"] = used.get("mono", "") + idx
    used["ms600"] = used.get("ms600", "") + label
    used["stencil"] = "0401"
    return (f'<text x="0" y="{14 + cap_height("mono", 12) / 2:.1f}" style="{fam("mono")};font-size:12px" fill="{th["teto"]}">{idx}</text>'
            + rule_row(th, 14, measure(idx, "mono", 12) + 10, label))


def ribbon(th, i, p):
    """Only the section line: for a README that has its own logo and title."""
    used = {}
    alt = f"{p['repo']} is project {i + 1:02d} of {CFG.get('name') or CFG['owner']}"
    return fluid(28, project_line(th, i, used), fonts_css(used), alt), alt, 28


def header(th, i, p):
    """The section line, then the project's name, description and language. Fluid like the
    rest, so it fits any README column."""
    name, text = p["repo"], p["description"]
    lang = (DATA["repos"].get(p["repo"]) or {}).get("language")
    used = {"ms400": lang or ""}
    parts = [project_line(th, i, used)]
    # layouts, title size, title baseline, description size, line height, description lines
    layouts = (("w m", 30, 68, 15, 22, [ellipsize(text, "ms400", 15, FIT["m"])]),
               ("s", 26, 64, 14, 20, wrap_max(text, "ms400", 14, FIT["s"], 2)),
               ("n", 22, 60, 13, 18, wrap_max(text, "ms400", 13, FIT["n"], 2)))
    foot = {}
    for cls, ts, y, ds, lh, lines in layouts:
        title = ellipsize(name, "ms600", ts, FIT[cls.split()[-1]])
        parts.append(f'<text class="L {cls}" x="0" y="{y}" style="{fam("ms600")};font-size:{ts}px" fill="{th["fg"]}">{esc(title)}</text>')
        for li, line in enumerate(lines):
            parts.append(f'<text class="L {cls}" x="0" y="{y + ds + 11 + li * lh}" style="{fam("ms400")};font-size:{ds}px" '
                         f'fill="{th["fgMuted"]}">{esc(line)}</text>')
        used["ms600"] += title
        used["ms400"] += "".join(lines)
        for one in cls.split():
            foot[one] = y + ds + 11 + (len(lines) - 1) * lh + 24  # centre of the language line
    h = round(max(foot.values()) + 22)
    css = ""
    if lang:
        parts.append(f'<g class="lang"><circle cx="5" cy="0" r="5" fill="{share_color(th, lang)}"/>'
                     f'<text x="16" y="{cap_height("ms400", 12) / 2:.1f}" style="{fam("ms400")};font-size:12px" '
                     f'fill="{th["fgMuted"]}">{esc(lang)}</text></g>')
        css = tier_css(".lang", "transform", {c: f"translateY({v}px)" for c, v in foot.items()})
    parts.append(f'<rect y="{h - 1}" width="100%" height="1" fill="{th["border"]}" fill-opacity=".5"/>')
    alt = f"{name}: {text}"
    return fluid(h, "".join(parts), fonts_css(used) + css, alt), alt, h


# ---------------------------------------------------------------- footer
def footer(th):
    t = CFG["credits"]
    segs = t.split(" · ")
    size, lh, top = 12, 18, 40
    laid = [(cls, balance(segs, " · ", "ms400", size, max_w))
            for cls, max_w in (("w m", 520), ("s", FIT["s"] - 40), ("n", FIT["n"] - 16))]
    cap = cap_height("stencil", 30)
    big = f'style="{fam("stencil")};font-size:30px;letter-spacing:1.8px"'
    used = {"stencil": "0401", "ms400": t}
    if MOOD["birthday"]:
        # the day the number stands for: 0401 on a red block, and a line under it
        wish = "HAPPY BIRTHDAY, TETO"
        bw = measure("0401", "stencil", 30, 1.8) - 1.8 + 32
        y0 = top + 22 + cap / 2
        body = [anchor("50%", f'<rect x="{-bw / 2:.1f}" y="{top}" width="{bw:.1f}" height="44" rx="8" fill="{th["teto"]}"/>'),
                f'<text x="50%" dx=".9" y="{y0:.1f}" text-anchor="middle" {big} fill="{th["canvas"]}">0401</text>',
                f'<text x="50%" dx=".9" y="{top + 44 + 24}" text-anchor="middle" style="{fam("ms600")};font-size:11px;letter-spacing:1.76px" '
                f'fill="{th["fg"]}">{wish}</text>']
        used["ms600"] = wish
        y1 = top + 44 + 24 + 26
    else:
        y0 = top + cap
        body = [f'<text x="50%" dx=".9" y="{y0:.1f}" text-anchor="middle" {big} fill="{th["teto"]}">0401</text>']
        y1 = y0 + 28
    h = round(y1 + (max(len(lines) for _, lines in laid) - 1) * lh + 10)
    for cls, lines in laid:
        for li, line in enumerate(lines):
            body.append(f'<text class="L {cls}" x="50%" y="{y1 + li * lh:.1f}" text-anchor="middle" '
                        f'style="{fam("ms400")};font-size:{size}px" fill="{th["fgMuted"]}">{esc(line)}</text>')
    return fluid(h, "".join(body), fonts_css(used), t), t, h


# ---------------------------------------------------------------- write
def issue_url(action, prompt):
    body = (f"{prompt}\n\nJust press **Create**. Teto answers here and on the profile in about a minute.\n\n"
            "Please don't change the title.")
    q = urllib.parse.urlencode({"title": f"teto|{action}", "body": body})
    return f"https://github.com/{CFG['owner']}/{CFG['repo']}/issues/new?{q}"


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def banner():
    """The banner for Teto's mood and the reader's theme and motion setting. A mood whose
    banner has not been rendered yet (teto/banner/make.sh) falls back to the everyday one."""
    kind = "birthday" if MOOD["birthday"] else "happy" if MOOD["happy"] else MOOD["season"] or ("hungry" if MOOD["hungry"] else "")
    base = "banner" + (f"-{kind}" if kind else "")
    if not all((OUT / f).exists() for f in (f"{base}.webp", f"{base}-static.png", f"{base}-light.webp", f"{base}-light-static.png")):
        base = "banner"
    alt = "Kasane Teto pressed against the glass of your screen, project cards floating around her"
    alt += {"banner-birthday": ", confetti falling: it is her birthday", "banner-happy": ", sparkling: she has just been fed",
            "banner-snow": ", snow falling", "banner-sakura": ", cherry petals falling"}.get(base, "")
    at = "./assets/teto/" + base
    return (f'<picture>\n'
            f'    <source media="(prefers-color-scheme: light) and (prefers-reduced-motion: reduce)" srcset="{at}-light-static.png">\n'
            f'    <source media="(prefers-reduced-motion: reduce)" srcset="{at}-static.png">\n'
            f'    <source media="(prefers-color-scheme: light)" srcset="{at}-light.webp">\n'
            f'    <img src="{at}.webp" width="100%" alt="{esc(alt)}">\n'
            f'  </picture>')


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

    has_activity = len(DATA.get("activity") or []) >= 14
    ctx = {"banner": banner(), "dialogue": picture("dialogue", dialogue), "counter": picture("counter", counter),
           "sep_projects": picture("sep-projects", lambda th: separator(th, "PROJECTS", 42)),
           # after the project rows, which bring 25px of air of their own, a separator needs less
           # above it than after any other block; the gap between sections stays the same
           "sep_stack": picture("sep-stack", lambda th: separator(th, "STACK", 42 if has_activity else 20)),
           "stack": picture("stack", stack), "footer": picture("footer", footer)}

    buttons = [("feed", "Feed her a baguette", "🥖 A baguette for Teto."), ("news", "What's new?", "Teto, what's new?"),
               ("poke", "Poke", "*poke*")]
    if STATE.get("baguettes", 0) >= CFG.get("sing_after", 25):  # nobody is told about this one beforehand
        buttons.append(("sing", "Ask her to sing", "Teto, sing something."))
    ctx["buttons"] = "\n  ".join(
        f'<a href="{issue_url(key, prompt)}">'
        + picture(f"btn-{key}", lambda th, label=label, key=key: button(th, label, primary=key == "feed"), full_width=False)
        + "</a>" for key, label, prompt in buttons)

    # the last visitors, each linked to their profile
    guests = guest_list()
    ctx["guests"] = "" if not guests else "\n  <br>\n  " + "\n  ".join(
        f'<a href="https://github.com/{g["user"]}" title="{esc(guest_title(g, most))}">'
        + picture(f"guest-{slug(g['user'])}", lambda th, g=g, most=most: guest(th, g, most), full_width=False)
        + "</a>" for g, most in guests)

    meta = meta_columns()
    ctx["rows"] = "<br>\n  ".join(
        f'<a href="https://github.com/{CFG["owner"]}/{p["repo"]}">'
        + picture(f"row-{slug(p['repo'])}", lambda th, i=i, p=p: row(th, i, p, meta))
        + "</a>" for i, p in enumerate(PROJECTS))

    ctx["activity_section"] = "" if not has_activity else (
        "<p>\n  " + picture("sep-activity", lambda th: separator(th, "ACTIVITY", 20)) + "\n</p>\n\n"
        "<p>\n  " + picture("activity", activity) + "\n</p>\n\n")

    ctx["legend"] = "\n  ".join(
        picture(f"chip-{slug(name) or f'lang{i}'}", lambda th, name=name, pct=pct: chip(th, name, pct), full_width=False)
        for i, (name, pct) in enumerate(shares()[0]))

    # headers for the projects' own READMEs: no hash in the name, other repositories link to them
    for i, p in enumerate(PROJECTS):
        for theme, th in THEMES.items():
            files[f"header-{slug(p['repo'])}-{theme}.svg"] = header(th, i, p)[0]
            files[f"ribbon-{slug(p['repo'])}-{theme}.svg"] = ribbon(th, i, p)[0]

    for old in OUT.glob("*.svg"):
        if old.name not in files:
            old.unlink()
    for name, content in files.items():
        (OUT / name).write_text(content, encoding="utf-8")

    tpl = (REPO / "teto" / "README.template.md").read_text(encoding="utf-8")
    readme = re.sub(r"\{\{(\w+)\}\}", lambda m: ctx[m.group(1)], tpl)
    (REPO / "README.md").write_text(readme, encoding="utf-8")
    print(f"built {len(files)} svgs, README.md ({len(readme)} bytes), mood {MOOD}")


if __name__ == "__main__":
    main()
