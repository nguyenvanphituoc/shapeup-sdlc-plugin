#!/usr/bin/env python3
"""Validate generated SVG against the failure modes it reliably hits.

Usage:
    python check_svg.py diagram.svg
    python check_svg.py page.html --json
    python check_svg.py diagram.svg --strict     # warnings also exit non-zero
    python check_svg.py foreign.svg --allow-static   # skip the motion checks

Exit codes: 0 clean (or warnings only), 1 errors found, 2 could not parse.

Stdlib only. Text widths are estimated from character counts, so text-overflow
findings are warnings, not errors -- check them, don't obey them blindly.
"""

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
NS = {"svg": SVG_NS}

# px per character, by font size and weight. Matches references/layout.md.
CHAR_W = {(14, 500): 8.5, (14, 400): 8.0, (12, 400): 7.0, (11, 400): 6.5}
WIDE_GLYPH = re.compile(r"[\u3000-\u9fff\uff00-\uffef\u0370-\u03ff\u2200-\u22ff₀-₉⁰-⁹]")

CONNECTOR_HINTS = ("edge", "arr", "conn", "link", "route", "flow", "leader", "path")


def classes_setting_fill(style_text):
    """Class names whose CSS rule sets `fill`, so the element is already styled.

    Without this, any connector styled by class -- the idiomatic way -- gets
    false-flagged as missing fill="none".
    """
    found = set()
    for selector, body in re.findall(r"([^{}]+)\{([^{}]*)\}", style_text):
        if not re.search(r"(^|[;\s])fill\s*:", body):
            continue
        for cls in re.findall(r"\.([A-Za-z_][-\w]*)", selector):
            found.add(cls)
    return found


def resting_css(style_text):
    """The CSS that still applies when no animation ever plays.

    Two things are dropped because neither reaches a reader who gets the still
    diagram: @keyframes bodies, where a `from { opacity: 0 }` is exactly right,
    and the prefers-reduced-motion: no-preference block, whose rules are opt-in by
    construction. What survives is the resting state, and that is what a
    screenshot shows.
    """
    block = r"(?:[^{}]*\{[^{}]*\})*[^{}]*\}"
    text = re.sub(r"@keyframes[^{]*\{" + block, "", style_text)
    text = re.sub(
        r"@media[^{]*prefers-reduced-motion\s*:\s*no-preference[^{]*\{" + block,
        "",
        text,
    )
    return text


def tag(el):
    return el.tag.split("}")[-1] if "}" in el.tag else el.tag


def fnum(v, default=None):
    """Parse a possibly-unit-suffixed SVG number."""
    if v is None:
        return default
    m = re.match(r"\s*(-?\d*\.?\d+)", str(v))
    return float(m.group(1)) if m else default


def extract_svg(text):
    """Pull the first <svg>...</svg> out of a file that may be HTML."""
    m = re.search(r"<svg\b.*?</svg\s*>", text, re.S | re.I)
    return m.group(0) if m else None


def char_width(size, weight):
    key = (int(size), 500 if weight >= 500 else 400)
    if key in CHAR_W:
        return CHAR_W[key]
    return size * 0.58


class Report:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.notes = []

    def error(self, code, msg, line=None):
        self.errors.append({"code": code, "message": msg, "line": line})

    def warn(self, code, msg, line=None):
        self.warnings.append({"code": code, "message": msg, "line": line})

    def note(self, code, msg, line=None):
        self.notes.append({"code": code, "message": msg, "line": line})


def inherited(el, parents, attr):
    """Walk up the parent chain looking for an attribute or a class."""
    cur = el
    while cur is not None:
        if cur.get(attr) or cur.get("class"):
            return True
        cur = parents.get(id(cur))
    return False


def collect(root, parents, parent=None):
    for child in root:
        parents[id(child)] = parent if parent is not None else root
        collect(child, parents, child)


def rects_of(svg, parents):
    out = []
    for el in svg.iter():
        if tag(el) != "rect":
            continue
        x, y = fnum(el.get("x"), 0), fnum(el.get("y"), 0)
        w, h = fnum(el.get("width")), fnum(el.get("height"))
        if w is None or h is None:
            continue
        out.append({"el": el, "x": x, "y": y, "w": w, "h": h})
    return out


def text_extent(el):
    """Estimate (width, size) for a <text> element from its full string content."""
    size = fnum(el.get("font-size"))
    cls = el.get("class") or ""
    if size is None:
        size = 12.0 if "ts" in cls.split() else 14.0
    weight = fnum(el.get("font-weight"), 400) or 400
    if "th" in cls.split():
        weight = 500

    tspans = [t for t in el.iter() if tag(t) == "tspan"]
    if tspans:
        lines = ["".join(t.itertext()).strip() for t in tspans]
    else:
        lines = ["".join(el.itertext()).strip()]
    lines = [ln for ln in lines if ln]
    if not lines:
        return 0.0, size, ""

    cw = char_width(size, weight)
    widest, longest = 0.0, ""
    for ln in lines:
        wide = len(WIDE_GLYPH.findall(ln))
        w = (len(ln) - wide) * cw + wide * cw * 1.8
        if w > widest:
            widest, longest = w, ln
    return widest, size, longest


def check(svg_src, report, allow_static=False):
    try:
        svg = ET.fromstring(svg_src)
    except ET.ParseError as exc:
        report.error("PARSE", f"SVG is not well-formed XML: {exc}")
        return None

    parents = {}
    collect(svg, parents)

    style_text = " ".join("".join(s.itertext()) for s in svg.iter() if tag(s) == "style")
    fill_classes = classes_setting_fill(style_text)

    # --- accessibility block -------------------------------------------------
    if svg.get("role") != "img":
        report.error("A11Y_ROLE", 'Root <svg> is missing role="img".')
    kids = [tag(c) for c in list(svg)]
    head = [k for k in kids if k in ("title", "desc")]
    if "title" not in kids:
        report.error("A11Y_TITLE", "Root <svg> has no <title>.")
    if "desc" not in kids:
        report.warn("A11Y_DESC", "Root <svg> has no <desc>.")
    if head and kids[: len(head)] != head:
        report.warn(
            "A11Y_ORDER",
            "<title>/<desc> are present but not the first children of <svg>; "
            "some screen readers only announce them in that position.",
        )

    # --- viewBox -------------------------------------------------------------
    vb = svg.get("viewBox")
    vb_w = vb_h = None
    if not vb:
        report.error("VIEWBOX_MISSING", "Root <svg> has no viewBox.")
    else:
        parts = [fnum(p) for p in re.split(r"[,\s]+", vb.strip()) if p != ""]
        if len(parts) != 4 or any(p is None for p in parts):
            report.error("VIEWBOX_MALFORMED", f'viewBox="{vb}" is malformed.')
        else:
            _, _, vb_w, vb_h = parts
            if svg.get("width") == "100%" and vb_w and abs(vb_w - 680) > 1:
                report.note(
                    "VIEWBOX_WIDTH",
                    f"viewBox width is {vb_w:g}, not the 680 default. With "
                    'width="100%" every unit scales by 680/%g, so text renders '
                    "larger than authored. Intentional?" % vb_w,
                )

    # --- geometry sweep ------------------------------------------------------
    max_y = 0.0
    max_x = 0.0
    for el in svg.iter():
        t = tag(el)
        # An element carrying <animateMotion> is placed by its path: the motion is a
        # transform applied on top of its own coordinates, so the idiom is to author
        # it at the origin. Reading that origin as geometry reports a phantom.
        if any(tag(c) == "animateMotion" for c in el):
            continue
        if t == "rect":
            x, y = fnum(el.get("x"), 0), fnum(el.get("y"), 0)
            w, h = fnum(el.get("width"), 0), fnum(el.get("height"), 0)
            max_y, max_x = max(max_y, y + h), max(max_x, x + w)
            if x < 0 or y < 0:
                report.error("NEG_COORD", f"<rect> at negative coordinate ({x:g},{y:g}).")
        elif t == "circle":
            cx, cy = fnum(el.get("cx"), 0), fnum(el.get("cy"), 0)
            r = fnum(el.get("r"), 0)
            max_y, max_x = max(max_y, cy + r), max(max_x, cx + r)
            if cx - r < 0 or cy - r < 0:
                report.error("NEG_COORD", f"<circle> extends past 0 at ({cx:g},{cy:g}).")
        elif t == "text":
            y = fnum(el.get("y"), 0)
            x = fnum(el.get("x"), 0)
            max_y = max(max_y, y + 4)
            max_x = max(max_x, x)
            if x < 0 or y < 0:
                report.error("NEG_COORD", f"<text> at negative coordinate ({x:g},{y:g}).")
        elif t in ("line",):
            for a in ("y1", "y2"):
                max_y = max(max_y, fnum(el.get(a), 0))
            for a in ("x1", "x2"):
                max_x = max(max_x, fnum(el.get(a), 0))
        elif t in ("path", "polyline", "polygon"):
            d = el.get("d") or el.get("points") or ""
            nums = [float(n) for n in re.findall(r"-?\d*\.?\d+(?:e-?\d+)?", d)]
            if nums:
                max_x = max([max_x] + nums[0::2])
                max_y = max([max_y] + nums[1::2])

    if vb_h:
        if max_y > vb_h + 0.5:
            report.error(
                "CLIPPED",
                f"Content reaches y={max_y:g} but viewBox height is {vb_h:g}. "
                f"The bottom {max_y - vb_h:.0f}px is clipped. Set height to "
                f"{max_y + 20:.0f}.",
            )
        elif vb_h - max_y > 60:
            report.warn(
                "DEAD_SPACE",
                f"{vb_h - max_y:.0f}px of empty space below the lowest element "
                f"(y={max_y:g}). Set viewBox height to {max_y + 20:.0f}.",
            )
    if vb_w and max_x > vb_w + 0.5:
        report.error(
            "OVERFLOW_X",
            f"Content reaches x={max_x:g}, past the viewBox width of {vb_w:g}.",
        )

    # --- connector paths without fill="none" ---------------------------------
    for el in svg.iter():
        if tag(el) not in ("path", "polyline"):
            continue
        fill = el.get("fill")
        raw_cls = (el.get("class") or "").split()
        cls = " ".join(raw_cls).lower()
        if any(c in fill_classes for c in raw_cls):
            continue
        has_stroke = bool(el.get("stroke") or "stroke" in (el.get("style") or ""))
        parent_fill = None
        p = parents.get(id(el))
        while p is not None and parent_fill is None:
            parent_fill = p.get("fill")
            p = parents.get(id(p))
        if fill is None and parent_fill is None:
            style = el.get("style") or ""
            if "fill" in style:
                continue
            looks_like_connector = has_stroke or any(h in cls for h in CONNECTOR_HINTS)
            if looks_like_connector:
                d = (el.get("d") or "")[:48]
                report.error(
                    "PATH_FILL",
                    f'<{tag(el)}> has no fill="none" (d="{d}..."). SVG defaults to '
                    "black fill, so this renders as a filled blob, not a line.",
                )

    # --- text styling --------------------------------------------------------
    texts = []
    for el in svg.iter():
        if tag(el) != "text":
            continue
        texts.append(el)
        content = "".join(el.itertext()).strip()
        if not content:
            continue

        styled = el.get("fill") or el.get("class") or "fill" in (el.get("style") or "")
        if not styled and not inherited(parents.get(id(el)), parents, "fill"):
            report.error(
                "TEXT_UNSTYLED",
                f'<text> "{content[:34]}" has no fill and no class. It inherits '
                "black and disappears in dark mode.",
            )

        size = fnum(el.get("font-size"))
        if size is not None and size < 11:
            report.error(
                "TEXT_TINY", f'<text> "{content[:34]}" is {size:g}px; minimum is 11px.'
            )

        if content.isupper() and len(content) > 3 and content.isalpha():
            report.note(
                "TEXT_CAPS",
                f'<text> "{content[:34]}" is ALL CAPS. Sentence case is the default.',
            )

    # --- text vs its containing box ------------------------------------------
    boxes = rects_of(svg, parents)
    for el in texts:
        x, y = fnum(el.get("x")), fnum(el.get("y"))
        if x is None or y is None:
            continue
        width, size, longest = text_extent(el)
        if not longest:
            continue

        anchor = el.get("text-anchor", "start")
        if anchor == "middle":
            x0, x1 = x - width / 2, x + width / 2
        elif anchor == "end":
            x0, x1 = x - width, x
        else:
            x0, x1 = x, x + width

        if x0 < 0:
            report.error(
                "TEXT_OFF_CANVAS",
                f'<text anchor="{anchor}"> "{longest[:30]}" starts at x={x0:.0f}, '
                "off the left edge. Estimated width "
                f"{width:.0f}px against x={x:g}.",
            )

        # smallest rect containing the anchor point
        container = None
        for b in boxes:
            if b["x"] <= x <= b["x"] + b["w"] and b["y"] <= y <= b["y"] + b["h"]:
                if container is None or b["w"] * b["h"] < container["w"] * container["h"]:
                    container = b
        if container and container["w"] < 560:  # skip full-width bands
            pad = 12
            if x0 < container["x"] + pad or x1 > container["x"] + container["w"] - pad:
                need = width + 24
                report.warn(
                    "TEXT_OVERFLOW",
                    f'"{longest[:30]}" is ~{width:.0f}px in a {container["w"]:g}px box; '
                    f"needs ~{need:.0f}px. Shorten the label or widen the box.",
                )

        if size >= 13 and el.get("dominant-baseline") is None and container:
            report.warn(
                "TEXT_BASELINE",
                f'"{longest[:30]}" sits inside a box without '
                'dominant-baseline="central"; it will render ~4px high.',
            )

    # --- rect overlap --------------------------------------------------------
    def contains(a, b):
        return (
            a["x"] <= b["x"]
            and a["y"] <= b["y"]
            and a["x"] + a["w"] >= b["x"] + b["w"]
            and a["y"] + a["h"] >= b["y"] + b["h"]
        )

    for i, a in enumerate(boxes):
        for b in boxes[i + 1 :]:
            ox = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
            oy = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
            if ox > 1 and oy > 1 and not contains(a, b) and not contains(b, a):
                report.error(
                    "RECT_OVERLAP",
                    f'Rects overlap by {ox:.0f}x{oy:.0f}px: '
                    f'({a["x"]:g},{a["y"]:g},{a["w"]:g},{a["h"]:g}) and '
                    f'({b["x"]:g},{b["y"]:g},{b["w"]:g},{b["h"]:g}).',
                )

    # --- horizontal gaps within a tier ---------------------------------------
    tiers = {}
    for b in boxes:
        if b["w"] > 400:
            continue
        tiers.setdefault(round(b["y"] / 4) * 4, []).append(b)
    for y, row in tiers.items():
        row.sort(key=lambda b: b["x"])
        for a, c in zip(row, row[1:]):
            gap = c["x"] - (a["x"] + a["w"])
            if 1 < gap < 20:
                report.warn(
                    "TIGHT_GAP",
                    f"Only {gap:.0f}px between boxes at y={y:g}; minimum is 20px.",
                )

    # --- animation -----------------------------------------------------------
    has_css_anim = "@keyframes" in style_text or "animation:" in style_text
    has_smil = any(
        tag(e) in ("animate", "animateTransform", "animateMotion") for e in svg.iter()
    )
    animated = has_css_anim or has_smil

    if not animated and not allow_static:
        report.error(
            "NO_MOTION",
            "No animation found. Motion is the default output: pick the pattern that "
            "carries this diagram's meaning -- flow along the edges, a staged reveal, "
            "a state change. Pass --allow-static for a deliberately still SVG.",
        )

    if animated and "prefers-reduced-motion" not in style_text:
        report.error(
            "MOTION_PREF",
            "Animation present with no prefers-reduced-motion guard. Declare it "
            "inside @media (prefers-reduced-motion: no-preference).",
        )
    elif animated and "no-preference" not in style_text:
        report.warn(
            "MOTION_PREF_INVERTED",
            "Motion looks declared globally and switched off under `reduce`. A reader "
            "whose preference is unspecified still gets it. Declare the animation "
            "inside @media (prefers-reduced-motion: no-preference) instead.",
        )

    # A diagram can declare motion and still not move: keyframes whose class no
    # element carries, or an animation naming a keyframe nobody defined. NO_MOTION
    # cannot see either -- the markup does contain animation, it just does nothing.
    if has_css_anim and not has_smil:
        used_classes = set()
        for el in svg.iter():
            used_classes.update((el.get("class") or "").split())
        kf_names = set(re.findall(r"@keyframes\s+([A-Za-z_][-\w]*)", style_text))
        animated_classes, opaque_selector, undefined = set(), False, set()
        for selector, body in re.findall(r"([^{}]+)\{([^{}]*)\}", style_text):
            decls = re.findall(r"(?:^|[;\s])animation(?:-name)?\s*:([^;]*)", body)
            if not decls:
                continue
            tokens = set(re.findall(r"[A-Za-z_][-\w]*", " ".join(decls)))
            if tokens and not (tokens & kf_names) and not (
                tokens & {"none", "inherit", "initial", "unset", "revert"}
            ):
                undefined.add(" ".join(d.strip() for d in decls))
            cls = re.findall(r"\.([A-Za-z_][-\w]*)", selector)
            if cls:
                animated_classes.update(cls)
            else:
                opaque_selector = True

        for value in sorted(undefined):
            report.error(
                "MOTION_UNDEFINED",
                f"`animation: {value}` names no @keyframes that exists, so nothing "
                "plays. Define the keyframe or fix the name.",
            )
        if animated_classes and not opaque_selector and not (
            animated_classes & used_classes
        ):
            report.error(
                "MOTION_INERT",
                "Animation is declared for "
                + ", ".join("." + c for c in sorted(animated_classes))
                + ", but no element carries that class -- the diagram is still. "
                "Put the class on the elements the motion is about.",
            )

    # A reveal that never arrives. With a `from`-only keyframe the terminal value is
    # implicit -- it resolves from the element's own style -- so a rule that also
    # sets `opacity: 0` animates 0 to 0 and the element stays invisible for good.
    # Nothing else here can see it: the animation runs, it just renders nothing.
    if has_css_anim:
        kf_bodies = {
            m.group(1): m.group(2)
            for m in re.finditer(
                r"@keyframes\s+([A-Za-z_][-\w]*)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}",
                style_text,
            )
        }
        for selector, body in re.findall(r"([^{}]+)\{([^{}]*)\}", style_text):
            if not re.search(r"(^|[;\s])opacity\s*:\s*0(\.0+)?\s*(;|$)", body):
                continue
            decls = re.findall(r"(?:^|[;\s])animation(?:-name)?\s*:([^;]*)", body)
            for name in set(re.findall(r"[A-Za-z_][-\w]*", " ".join(decls))) & set(kf_bodies):
                if not re.search(r"(to|100%)[^{}]*\{[^{}]*opacity", kf_bodies[name]):
                    report.error(
                        "REVEAL_STUCK",
                        f"`{selector.strip()}` sets opacity 0 and runs @keyframes "
                        f"{name}, which has no explicit `to`. The implicit end value "
                        "reads back that same 0, so the element never appears. Give "
                        f"@keyframes {name} an explicit `to {{ opacity: 1 }}`.",
                    )

    # Motion by default makes the resting state load-bearing: a screenshot, a PDF
    # export and a reduced-motion reader all get exactly what the markup says.
    # An element hidden at rest and revealed by the animation hands them a blank.
    if animated:
        hidden_at_rest = re.compile(r"(^|[;\s])opacity\s*:\s*0(\.0+)?\s*(;|$)")
        for el in svg.iter():
            if tag(el) in ("svg", "defs", "style", "title", "desc", "marker"):
                continue
            op = fnum(el.get("opacity"))
            if (op is not None and op < 0.05) or el.get("visibility") == "hidden" or (
                el.get("style") and hidden_at_rest.search(el.get("style"))
            ):
                ident = el.get("id") or el.get("class") or ""
                report.error(
                    "STATIC_BLANK",
                    f'<{tag(el)}{" " + ident if ident else ""}> is invisible at rest '
                    "and only the animation brings it in. Leave the finished state in "
                    "the markup and animate `from { opacity: 0 }` instead.",
                )
        for selector, body in re.findall(
            r"([^{}]+)\{([^{}]*)\}", resting_css(style_text)
        ):
            if hidden_at_rest.search(body):
                report.error(
                    "STATIC_BLANK",
                    f"`{selector.strip()}` rests at opacity 0, so the diagram is blank "
                    "until the motion plays. Animate `from { opacity: 0 }` and let the "
                    "rule hold the finished state.",
                )

    banned = re.findall(r"\b(filter|box-shadow|backdrop-filter)\s*:", style_text)
    for b in set(banned):
        report.note("EFFECT", f"CSS `{b}` in <style>; effects are off by default.")

    return {"max_y": max_y, "max_x": max_x, "viewbox": (vb_w, vb_h)}


def main():
    ap = argparse.ArgumentParser(description="Validate a generated SVG.")
    ap.add_argument("path", help="Path to an .svg or .html file")
    ap.add_argument("--json", action="store_true", help="Machine-readable output")
    ap.add_argument("--strict", action="store_true", help="Warnings also exit non-zero")
    ap.add_argument(
        "--allow-static",
        action="store_true",
        help="Skip the motion checks (debugging an SVG that is meant to be still)",
    )
    args = ap.parse_args()

    try:
        with open(args.path, encoding="utf-8") as fh:
            raw = fh.read()
    except OSError as exc:
        print(f"Cannot read {args.path}: {exc}", file=sys.stderr)
        return 2

    svg_src = extract_svg(raw)
    if not svg_src:
        print(f"No <svg> element found in {args.path}", file=sys.stderr)
        return 2

    if len(re.findall(r"<svg\b", raw, re.I)) > 1:
        print("Note: more than one <svg> found; validating the first.", file=sys.stderr)

    report = Report()
    check(svg_src, report, allow_static=args.allow_static)

    if args.json:
        print(
            json.dumps(
                {
                    "file": args.path,
                    "errors": report.errors,
                    "warnings": report.warnings,
                    "notes": report.notes,
                    "ok": not report.errors,
                },
                indent=2,
            )
        )
    else:
        for label, items in (
            ("ERROR", report.errors),
            ("WARN", report.warnings),
            ("NOTE", report.notes),
        ):
            for it in items:
                print(f"{label:5} [{it['code']}] {it['message']}")
        n_e, n_w, n_n = len(report.errors), len(report.warnings), len(report.notes)
        if not (n_e or n_w or n_n):
            print("Clean: no errors, warnings, or notes.")
        else:
            print(f"\n{n_e} error(s), {n_w} warning(s), {n_n} note(s).")

    if report.errors:
        return 1
    if args.strict and report.warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
