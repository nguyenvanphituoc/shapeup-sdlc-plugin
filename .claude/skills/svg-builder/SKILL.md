---
name: svg-builder
description: Build correct, self-contained SVG diagrams, illustrations, and animations from a description. Use this skill whenever the user asks for a diagram, flowchart, architecture or system diagram, sequence or data-flow visualization, infographic, animated explainer, or any request to "draw", "visualize", "illustrate", "show me how X works", or "make a diagram of Y" — even when they never say the word "SVG". Also use it when editing, debugging, or fixing existing SVG (overlapping boxes, clipped viewBox, text spilling out of shapes, invisible-in-dark-mode text), and when building animated or interactive SVG such as particles flowing along a path. Ships a validator script that catches the failure modes generated SVG reliably hits. Do NOT use for raster image generation or editing (PNG/JPEG), and route database ER diagrams to mermaid `erDiagram` instead.
---

# SVG Builder

Turn a description into one valid, self-contained SVG.

The failure mode here is never ugliness — it is **overlap**. Text spilling past its box,
an arrow slashing through an unrelated node, content clipped by a too-short viewBox. This
happens because coordinates get invented token-by-token with no global view of the canvas.
Every step below exists to prevent that, and the order matters: **arithmetic first,
markup second, validator third.**

## Workflow

1. **Intake** — resolve the five slots below. Ask at most two questions.
2. **Route** — pick the form from the user's verb, not their noun.
3. **Ledger** — write the coordinate table in plain text. Do not skip this.
4. **Build** — emit the markup, following the ledger.
5. **Validate** — run `scripts/check_svg.py`. Fix what it reports. Re-run.

## 1. Intake

| Slot | Question | Default if unstated |
|---|---|---|
| Subject | What entities, and how do they relate? | — must be stated |
| Intent | Reference, intuition, data, or decorative? | Infer from the verb (§2) |
| Medium | Static, animated, or interactive? | Static |
| Surface | Target width? Light, dark, or both? | 680px, both modes |
| Constraints | Brand palette, fonts, no-JS, size budget? | None |

Infer silently wherever the input implies an answer. Ask only when a wrong guess wastes
the entire render — an ambiguous subject qualifies, an unstated width does not.

**When the input is over budget:** six or more entities in one diagram produces
overlapping boxes and arrows through text, every time. Split into a sparse overview plus
one detail SVG per sub-flow, and tell the user that is what you are doing. Several
correct diagrams beat one crowded one.

## 2. Route on the verb, not the noun

The same subject wants a different picture depending on what was asked. "Transformer
architecture" wants labelled boxes; "how does attention work" wants a fan of
weight-scaled lines. Getting this wrong produces a technically valid diagram that
answers a question nobody asked.

| Input shape | Form | What you draw |
|---|---|---|
| "walk me through", "what are the steps", "what's the flow" | Flowchart | Boxes, single-direction arrows, decisions |
| "what's the architecture", "what's inside", "where does X live" | Structural | Nested containers, regions, containment |
| "how does X *actually* work", "give me intuition", "I don't get X" | Illustrative | The mechanism itself, or a spatial metaphor for it |
| "compare", "how much", "trend", "breakdown" | Chart | Axes, marks, one encoding per variable |
| "show me the schema", "the ERD" | **Not SVG** | Emit mermaid `erDiagram` — hand-placed table rows always fail |
| "make it move", "animate", "simulate" | Any of the above + motion | Pick a form, then read `references/animation.md` |

Illustrative is the default for an unqualified "how does X work", and it is the more
ambitious choice. Do not retreat to a flowchart because boxes feel safer. Abstract
subjects get invented geometry: a hash table is a funnel scattering items into buckets, a
call stack is literally a stack of frames, attention is one token with weighted lines
fanning to every other. **A good illustrative diagram still reads with every label
deleted.** If yours doesn't, the layout isn't carrying the meaning yet.

Never mix forms in one SVG. If both are needed, emit two with prose between them.

Read `references/forms.md` for the construction pattern of whichever form you picked.

## 3. The layout ledger

Write this out before any markup. It is not documentation — it is the step that makes the
output correct, because it turns invented coordinates into arithmetic you can check.

```
CANVAS   width 680, height TBD, safe area x:40..640
TIER 1   y 40..84    3 boxes w=120  x=100,280,460   gaps 60,60     ✓ 3·120+2·60=480 ≤ 600
TIER 2   y 132..176  1 box  w=180   x=250           center 340     ✓
EDGES    (160,84)->(340,132) via bus y=108    crosses: nothing     ✓
         (340,176)->(340,214)                 crosses: nothing     ✓
MAX_Y    564 (consumer box bottom)   ->   viewBox height = 584
```

Then verify, in order:

1. **Row fits:** `n·width + (n−1)·gap ≤ 600`. Four 160px boxes with 20px gaps is 700 —
   that does not fit. Shrink, wrap to a second row, or cut a box.
2. **Horizontal gap ≥ 20px** between boxes in a row; **vertical gap ≥ 40px** between
   tiers, so arrows have room to be seen.
3. **Every edge traced** against every rect already placed. If a line crosses one, route
   around it with an L-bend `M x1 y1 L x1 ymid L x2 ymid L x2 y2`. Never let it slash
   through.
4. **viewBox height = max_y + 20**, where max_y is the lowest `y+height` or the lowest
   text baseline plus 4px of descender. Never guess; never leave dead space.
5. **No negative coordinates.** The viewBox starts at 0,0.
6. **Keep viewBox width at 680** even when content is naturally narrow — center the
   content instead. With `width="100%"` the browser scales the whole coordinate space, so
   a 476-wide viewBox silently renders your 14px text at 20px.

Detailed arithmetic — text width tables, tier packing, collision routing, tree layout —
is in `references/layout.md`. Read it before laying out anything with more than one tier.

## 4. Build

Start from `assets/scaffold.svg`, which has the accessibility block and the arrow marker
already correct.

**The five rules that break the most output:**

- **`fill="none"` on every connector path.** SVG defaults to black fill; a curved
  connector without it renders as a large black blob. This is the single most common bug
  in generated SVG.
- **`dominant-baseline="central"` on every in-box label**, with `y` at the center of its
  own row — not the center of the whole box. Without it, SVG treats `y` as the baseline
  and glyphs sit ~4px high with descenders landing on the line below.
- **`<text>` never wraps.** Every line break is an explicit
  `<tspan x="..." dy="1.2em">`. If a label needs wrapping, it is too long — cut it.
- **Every `<text>` carries an explicit fill or class.** An unstyled one inherits black and
  disappears in dark mode.
- **Lines stop at component edges.** Compute the stop coordinate from the target's
  position and size. Never draw through and hide the overshoot under a fill — that bets
  on a background color you do not control.

**Craft defaults:** stroke `0.5px` for borders and edges (1px reads heavy); `rx="4"` for
subtle corners, `rx="8"` for emphasis, `rx ≥ height/2` only when you mean a pill; two font
sizes only (14px labels, 12px subtitles, never below 11px); two weights only (400, 500);
sentence case everywhere; no rotated text, no emoji, no hand-drawn icon paths.

**No gradients, shadows, blur, or glow.** One `<linearGradient>` between two stops of one
ramp is permitted in an illustrative diagram, and only for a genuinely continuous physical
quantity — thermal stratification, pressure drop, concentration. If two flat rects say the
same thing, use two flat rects.

**Cycles are not drawn as rings.** All the spacing arithmetic here is Cartesian; there is
no collision check for boxes orbiting a circle, so satellites land on the stages they
feed. Lay stages out linearly and convey the loop with a return path or a `↻` glyph. If
the cycle has per-stage detail, build a stepper instead.

Color and dark mode have their own failure modes — read `references/color.md` before
picking any fill. Animation has its own — read `references/animation.md`.

## 5. Validate

```bash
python scripts/check_svg.py path/to/diagram.svg
```

It parses the emitted markup and reports, with line numbers: connector paths missing
`fill="none"`, text estimated to overflow its container, unclassed `<text>`, content
clipped by the viewBox or floating in dead space, partially overlapping rects, negative
coordinates, sub-11px type, and a missing accessibility block.

Fix what it reports and run it again. `--json` gives machine-readable output; `--strict`
exits non-zero on warnings as well as errors. The script also accepts an HTML file and
will pull the `<svg>` out of it.

Treat its warnings as questions, not verdicts. It estimates text width from character
counts, so a warning on a short label in a wide box is worth a look but may be fine. An
*error* is not negotiable.

## Output contract

- **One `<svg>` per response.** Never leave a broken attempt above a corrected one —
  replace it entirely.
- **Self-contained.** No external fetches, no build step, no framework. Inline the CSS.
  Reach for a library only when the user asked for one.
- **Prose lives outside the SVG.** No titles, captions, or explanatory paragraphs inside
  the markup — explain in the message, draw in the file.
- **Name what you simplified.** When the diagram drops something real — replication from a
  system diagram, error branches from a flow, the failure path from a lifecycle — say so
  in one line. A diagram that quietly omits the hard part teaches the wrong model, and the
  reader has no way to know it happened.
- When you deviate from a rule here, say which rule and why, in one line.

## Pre-flight

Do not hand over the file until every line is true. The validator checks the starred ones.

```
[ ] Ledger written; every row's total width ≤ 600
[ ] Every edge traced against every rect — zero unintended crossings   *
[ ] Every label: chars × 8 + 24 ≤ its box width                        *
[ ] Every in-box label has dominant-baseline="central"                 *
[ ] viewBox height = lowest element + 20; nothing clipped              *
[ ] Every connector <path> has fill="none"                             *
[ ] Every <text> has an explicit fill or class                         *
[ ] Readable on a near-black background
[ ] No distinction carried by color alone
[ ] role="img" + <title> + <desc> as first children                    *
[ ] Animations respect prefers-reduced-motion; static state still reads
[ ] Exactly one <svg>; no orphaned partial attempt
```

## Files

- `references/layout.md` — text metrics, tier packing, collision routing, tree layout
- `references/color.md` — palette selection, dark mode, contrast, colorblind safety
- `references/animation.md` — CSS vs SMIL vs JS, path sampling, reduced motion
- `references/forms.md` — construction patterns per diagram form
- `scripts/check_svg.py` — validator
- `assets/scaffold.svg` — starting skeleton with the accessibility block and arrow marker
