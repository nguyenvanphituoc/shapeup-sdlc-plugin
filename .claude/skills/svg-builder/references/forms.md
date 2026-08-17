# Construction patterns per form

Read the section for the form you routed to. Each assumes the ledger from SKILL.md §3 is
already written.

## Contents

- [Flowchart](#flowchart)
- [Structural](#structural)
- [Illustrative](#illustrative)
- [Chart](#chart)
- [Stepper (for cycles and stages)](#stepper-for-cycles-and-stages)

## Flowchart

Sequential process, cause and effect, decision branches.

**Rules specific to this form:**

- One direction only — all top-down or all left-to-right. Mixed axes read as two diagrams
  fighting.
- Four to five nodes maximum per diagram. More than that, split.
- Uniform box heights within a tier: 44px single-line, 56px two-line.
- Decisions are diamonds only if you have more than one in the diagram; a lone diamond
  among rects is noise. A rect with two labelled exits is usually clearer.

Single-line node:

```svg
<g>
  <rect x="100" y="20" width="180" height="44" rx="8"
        fill="#E1F5EE" stroke="#0F6E56" stroke-width="0.5"/>
  <text x="190" y="42" text-anchor="middle" dominant-baseline="central"
        fill="#085041" font-size="14" font-weight="500">Validate token</text>
</g>
```

Two-line node — note the two different fill stops on title and subtitle:

```svg
<g>
  <rect x="100" y="20" width="200" height="56" rx="8"
        fill="#E1F5EE" stroke="#0F6E56" stroke-width="0.5"/>
  <text x="200" y="38" text-anchor="middle" dominant-baseline="central"
        fill="#085041" font-size="14" font-weight="500">Auth service</text>
  <text x="200" y="56" text-anchor="middle" dominant-baseline="central"
        fill="#0F6E56" font-size="12">Verifies the JWT</text>
</g>
```

Connector, unlabelled — the meaning comes from source and target:

```svg
<line x1="200" y1="76" x2="200" y2="120" stroke="#888780" stroke-width="0.5"
      marker-end="url(#arrow)"/>
```

**Decision branches** need their exits labelled, and those labels are the exception to the
no-arrow-labels rule. Put them beside the line, offset 8px, never on the stroke:

```svg
<text x="212" y="98" fill="#5F5E5A" font-size="12">yes</text>
```

## Structural

Things inside other things — where something *lives* is the point.

- Outermost container: large rounded rect, `rx="16"` to `rx="24"`, lightest fill, 0.5px
  stroke, label inside at top-left or top-center.
- Inner regions: `rx="8"` to `rx="12"`, a **different ramp** from the parent. The same ramp
  on parent and child produces identical fills and flattens the hierarchy you are trying to
  show.
- 20px minimum padding inside every container. Text and inner regions must never touch a
  container edge.
- Two to three nesting levels maximum. Deeper is unreadable at 680px.
- External inputs sit *outside* the container with arrows pointing in; outputs outside with
  arrows pointing out.

**The container-label collision** is this form's signature bug. A label at the top-left of a
container gets crossed by the first vertical connector entering the container. Fix by
placing the label in a gap *between* two entry points — compute the entry x-positions
first, find the widest gap, center the label there — or by shortening it until it clears.

```svg
<rect x="40" y="282" width="600" height="196" rx="16"
      fill="none" stroke="#888780" stroke-width="0.5" stroke-dasharray="4 4"/>
<text x="244" y="304" text-anchor="middle" fill="#5F5E5A" font-size="12">Kafka cluster</text>
```

A dashed rect with a label reads as "a boundary" far better than a drawn cloud, server
tower, or rack icon. Draw the schema, not a picture of the hardware.

## Illustrative

Build intuition. The spatial arrangement carries the meaning; labels only annotate.

**Physical subjects** get simplified versions of themselves — cross-sections and cutaways.
A water heater is a tall rounded rect with a burner bar beneath it. A lung is a branching
tree in a cavity.

**Abstract subjects** get invented geometry. You are giving shape to something that has
none, and the shape *is* the explanation:

| Concept | Geometry |
|---|---|
| Hash table | Funnel scattering items into a row of buckets |
| Call stack | Literal stack of frames, growing and shrinking |
| Attention | One token, weight-scaled lines fanning to every other |
| Gradient descent | Contour surface, a ball, a trail of steps |
| Embeddings | Dots clustering in 2D space |
| TCP | Two endpoints, numbered packets in flight, an ACK returning |

**What changes from the other forms:**

- Freeform shapes are expected — `<path>`, `<ellipse>`, `<polygon>`, curves. You are not
  limited to rounded rects.
- Layout follows the subject's proportions, not a grid. A thermometer is tall and narrow;
  a geological section is wide and flat.
- **Shapes may overlap deliberately** for depth — a pipe entering a tank, lines fanning
  through layers. Use source order as z-order.
- **Text may never overlap.** The overlap permission is for shapes only. Every label needs
  8px of clear air from the nearest stroke, and you solve a collision by *moving the label*,
  not by putting a background rect behind it.
- Color encodes intensity, not category. See `color.md`.

**Fidelity ceiling:** these are schematics. If a `<path>` needs more than ~6 segments,
simplify it. A flame is three triangles, not a fire. Recognisable silhouette beats accurate
contour every time — carefully tracing an outline means you have overshot.

**Label placement:** pick one side and put all labels there. At 680px there is no room for
a drawing plus label columns on both sides. Default to the right with
`text-anchor="start"`, reserving 140px, and connect with a 0.5px dashed leader plus a 2px
dot at the anchor point.

```svg
<line x1="440" y1="250" x2="468" y2="300" stroke="#888780" stroke-width="0.5"
      stroke-dasharray="2 2"/>
<circle cx="440" cy="250" r="2" fill="#888780"/>
<text x="474" y="304" fill="#5F5E5A" font-size="12">Thermostat</text>
```

**Prefer interactive.** If the real system has a control, give the diagram that control — a
thermostat becomes a slider, a cache hit rate becomes a drag, input tokens become
clickable. A cross-section you can operate teaches far more than one you can only look at.

## Chart

One encoding per variable. Position first, then length, then area — never area alone for
quantities, since readers systematically underestimate it.

- Start bar axes at zero. Line charts may crop, and should say so on the axis.
- Label axes with units. A number without a unit is not data.
- Direct-label series at their right end rather than shipping a legend the reader has to
  cross-reference.
- Gridlines at the 100-stop of gray, 0.5px, behind the marks — visible but never competing.
- Round every printed number.

If the data is genuinely large or needs interaction, say so and recommend a plotting
library instead of hand-placing hundreds of marks.

## Stepper (for cycles and stages)

When the last stage feeds back into the first — Krebs cycle, event loop, mark-and-sweep,
TCP retransmit — the instinct is a ring. **Do not draw a ring.** All the spacing arithmetic
in this skill is Cartesian; there is no collision check for boxes orbiting a circle, so
per-stage inputs land on the stages they feed and labels sit on the ring itself.

Build an HTML stepper with inline SVG: one panel per stage, dots showing position
(● ○ ○ ○), Next wrapping from the last stage back to the first. **The wrap is the loop.**
Each panel owns its own inputs and products, so nothing collides because nothing shares a
canvas.

Fall back to a linear SVG — stages in a row, one curved return path — only when there is a
single input and a single output overall and no per-stage detail to show.
