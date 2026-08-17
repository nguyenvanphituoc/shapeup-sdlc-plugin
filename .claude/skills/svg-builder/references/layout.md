# Layout arithmetic

Everything here is arithmetic you can do before emitting markup. Do it there, not in the
browser.

## Contents

- [Canvas and safe area](#canvas-and-safe-area)
- [Text width](#text-width)
- [Vertical placement](#vertical-placement)
- [Tier packing](#tier-packing)
- [Trees and hierarchies](#trees-and-hierarchies)
- [Edge routing](#edge-routing)
- [viewBox height](#viewbox-height)
- [Multi-line labels](#multi-line-labels)

## Canvas and safe area

Default canvas is `viewBox="0 0 680 H"` with `width="100%"`. Content lives in
`x: 40..640` — 600px usable. The 40px margins absorb leader lines, external labels, and
arrowheads.

**Keep the width at 680 even for narrow content.** `width="100%"` scales the entire
coordinate space to the container. A 476-wide viewBox in a 680px container multiplies
everything by 1.43, so 14px text renders at 20px and every width calculation below is
silently wrong. Center narrow content inside 680 instead.

Change 680 only if the user gave you a target width — then change the 600 safe-area
figure with it.

## Text width

SVG `<text>` does not wrap and does not report its own width until it is in a document.
Estimate before placing:

| Font size | Weight | Approx px per character |
|---|---|---|
| 14px | 400 | 8 |
| 14px | 500 | 8.5 |
| 12px | 400 | 7 |
| 11px | 400 | 6.5 |

Calibration points, measured:

```
"Authentication Service"     22 chars, 500, 14px  →  167px
"Background Job Processor"   24 chars, 500, 14px  →  201px
"Detects and validates …"    37 chars, 400, 14px  →  279px
"forwards request to"        19 chars, 400, 12px  →  123px
"データベースサーバー接続"        12 chars, 400, 14px  →  181px
```

**Box width from the longest label:**

```
box_width ≥ max(title_chars × 8, subtitle_chars × 7) + 24
```

A 100px box holds a 10-character subtitle and nothing more.

**Wide-glyph multiplier.** Add 30–50% for chemical formulas (C₆H₁₂O₆), math notation
(∑ ∫ √), sub/superscripts, and CJK — the example above shows 12 CJK characters occupying
what 22 Latin characters would. Subscript digits still take full horizontal space.

**`text-anchor` determines which way the string grows:**

| Anchor | Occupies | Risk |
|---|---|---|
| `start` | `x` to `x + width` | Overflows right edge |
| `middle` | `x ± width/2` | Overflows both |
| `end` | `x − width` to `x` | **Overflows into negative x** |

`text-anchor="end"` is the one that clips silently. At `x=60`, a 200px label starts at
`x=−140` and the first two thirds of it never renders. Check `chars × 8 < x`, or
right-align the column with `text-anchor="start"` instead.

## Vertical placement

SVG treats `y` as the **baseline**, not the center. A label at the arithmetic center of
its box sits ~4px high, and its descenders (g, p, y, q) collide with whatever is below.

Always:

```svg
<text x="190" y="42" text-anchor="middle" dominant-baseline="central">T-cells</text>
```

For a box at `(x, y, w, h)` with a single label: `text_x = x + w/2`, `text_y = y + h/2`.

For a box with several rows, `y` is the center of **that row**, not of the box. A 56px
two-line box at `y=20`: title at `y=38`, subtitle at `y=56` — 18px apart, each centered in
its own 28px half.

Standard box heights: **44px** single-line, **56px** two-line. Keep every box in a tier the
same height when they hold the same kind of content; ragged heights read as a mistake.

## Tier packing

Before placing a row of `n` boxes:

```
n · width + (n−1) · gap ≤ 600
```

| n | Max width at 20px gaps |
|---|---|
| 2 | 290 |
| 3 | 186 |
| 4 | 135 |
| 5 | 104 |
| 6 | 83 — too narrow for a label; wrap or split |

Worked failure and fix:

```
WRONG  4 boxes w=160 at x=40,200,360,520   → 4·160+3·20 = 700 > 600, boxes overlap
RIGHT  4 boxes w=130 at x=50,200,350,500   → 4·130+3·20 = 580 ≤ 600, right edge 630 ✓
```

Evenly spaced x positions for `n` boxes of width `w` in the safe area:

```
gap   = (600 − n·w) / (n − 1)
x[i]  = 40 + i · (w + gap)
```

Center of box `i` is `x[i] + w/2` — the anchor for every connector touching it.

At six or more boxes in one tier, stop packing and change the design: wrap to two rows,
shrink to ≤110px and drop subtitles, or split into an overview plus detail diagrams.

## Trees and hierarchies

Size **bottom-up**. Leaves determine everything.

1. Lay out the leaf tier with the packing formula above.
2. A parent's center is the mean of its children's centers.
3. A parent's width is at least the width of its own label, and never wider than the span
   of its children.
4. If two parents' spans overlap after step 2, the leaf tier is too tight — widen the gaps
   or cut a leaf.

Vertical rhythm: 40px minimum between tiers, 60px when the connector carries a label.

## Edge routing

**Trace every line against every rect already placed** before writing it. A line from A to
B that passes through C's interior will visibly slash across C — the browser will not warn
you.

Straight vertical or horizontal when the endpoints align:

```svg
<line x1="200" y1="76" x2="200" y2="120" stroke="#888780" stroke-width="0.5"
      marker-end="url(#arrow)"/>
```

L-bend when they do not, or when the direct path crosses something:

```svg
<path d="M120 76 L120 100 L340 100 L340 132" fill="none" stroke="#888780"
      stroke-width="0.5" marker-end="url(#arrow)"/>
```

`fill="none"` is mandatory on every connector path. Without it the path closes and fills
black.

**Fan-in and fan-out** — several sources converging on one target: drop each source to a
shared horizontal bus at a y between the tiers, run the bus, then take one line down to
the target. Far cleaner than N diagonals, and the bus never crosses a box.

```svg
<path d="M160 84 V108 H520" fill="none" stroke="#888780" stroke-width="0.5"/>
<path d="M340 84 V108"      fill="none" stroke="#888780" stroke-width="0.5"/>
<path d="M340 108 V132"     fill="none" stroke="#888780" stroke-width="0.5"
      marker-end="url(#arrow)"/>
```

**Leave 10px between an arrowhead and its target's edge** so the head reads as pointing at
the box rather than touching it.

**Feedback edges in a linear flow** fight the flow direction and clip at the canvas edge.
Use a `↻` glyph with a short label near the loop point instead of routing a long arrow
back across the diagram.

**Labels on arrows are usually a smell.** If an edge's meaning isn't obvious from its
source and target, fix the source and target. When a label is genuinely needed, place it
in clear space beside the line — never on the midpoint, where it collides with the stroke.

## viewBox height

```
max_y  = max over all elements of:
           rect:   y + height
           circle: cy + r
           text:   y + 4          (descender below baseline)
           path:   largest y in the d attribute
viewBox_height = max_y + 20
```

Both directions are bugs: too small clips the bottom row, too large leaves dead whitespace
that makes the diagram float in its container. The validator flags both.

## Multi-line labels

There is no automatic wrapping. Each line is an explicit `tspan`:

```svg
<text class="ts" x="200" y="120" text-anchor="middle">
  <tspan x="200">Validates the token</tspan>
  <tspan x="200" dy="1.2em">and refreshes it</tspan>
</text>
```

Every `tspan` repeats `x` — omit it and the line starts where the previous one ended.

Budget: `1.2em` at 12px is ~14px per line. A two-line subtitle needs 14px more box height
than a one-line one.

**Before reaching for a second line, cut the label instead.** Subtitles over five words are
almost always a sentence that belongs in the prose beside the diagram, not inside a box.
