# Color and theming

## Contents

- [Encode meaning, not sequence](#encode-meaning-not-sequence)
- [A default palette](#a-default-palette)
- [Text on colored fills](#text-on-colored-fills)
- [Dark mode: pick one strategy](#dark-mode-pick-one-strategy)
- [Contrast targets](#contrast-targets)
- [Never color alone](#never-color-alone)
- [Brand palettes](#brand-palettes)

## Encode meaning, not sequence

Never cycle a rainbow across steps — step 1 blue, step 2 amber, step 3 red implies a
progression that does not exist, and the reader spends attention decoding it.

Assign by category instead:

- **Group by type.** Every node of one kind shares one hue. In a request-flow diagram:
  all clients gray, all services teal, all data stores purple.
- **Illustrative diagrams map hue to physical property.** Warm (amber, coral, red) for
  heat, energy, pressure, high weight, active. Cool (blue, teal) for cold, calm, dormant.
  Gray for inert structure. Someone should see *where the action is* without reading a
  label.
- **Gray for neutral** — start, end, generic steps, containers, the substrate.

**Two hues plus gray. Never six.** A diagram in gray + teal + coral is more legible than
one using nine ramps, and the constraint forces you to decide what actually differs.

Blue, green, amber, and red carry strong UI conventions (info, success, warning, error).
Reserve them for those meanings; reach for teal, purple, coral, and pink for ordinary
categories. Illustrative diagrams are exempt — there, red means hot.

## A default palette

Seven stops per ramp, light to dark. Use when the user gave you no brand colors.

| Ramp | 50 | 100 | 200 | 400 | 600 | 800 | 900 |
|---|---|---|---|---|---|---|---|
| Gray | `#F1EFE8` | `#D3D1C7` | `#B4B2A9` | `#888780` | `#5F5E5A` | `#444441` | `#2C2C2A` |
| Teal | `#E1F5EE` | `#9FE1CB` | `#5DCAA5` | `#1D9E75` | `#0F6E56` | `#085041` | `#04342C` |
| Purple | `#EEEDFE` | `#CECBF6` | `#AFA9EC` | `#7F77DD` | `#534AB7` | `#3C3489` | `#26215C` |
| Coral | `#FAECE7` | `#F5C4B3` | `#F0997B` | `#D85A30` | `#993C1D` | `#712B13` | `#4A1B0C` |
| Pink | `#FBEAF0` | `#F4C0D1` | `#ED93B1` | `#D4537E` | `#993556` | `#72243E` | `#4B1528` |
| Blue | `#E6F1FB` | `#B5D4F4` | `#85B7EB` | `#378ADD` | `#185FA5` | `#0C447C` | `#042C53` |
| Green | `#EAF3DE` | `#C0DD97` | `#97C459` | `#639922` | `#3B6D11` | `#27500A` | `#173404` |
| Amber | `#FAEEDA` | `#FAC775` | `#EF9F27` | `#BA7517` | `#854F0B` | `#633806` | `#412402` |
| Red | `#FCEBEB` | `#F7C1C1` | `#F09595` | `#E24B4A` | `#A32D2D` | `#791F1F` | `#501313` |

Standard assignments:

- **Light mode:** 50 fill, 600 stroke, 800 title, 600 subtitle
- **Dark mode:** 800 fill, 200 stroke, 100 title, 200 subtitle
- **Connectors and hairlines:** the 400 stop of gray (`#888780`) — legible on white and on
  near-black, so it needs no mode handling at all
- **Accent marks (dots, active states):** the 400 stop of your accent ramp

## Text on colored fills

Take the darkest stop of **the same family** as the fill. Never black, never a generic
gray — both read as a rendering mistake against a tinted background.

When a box carries both a title and a subtitle they must use **different stops**: title at
800, subtitle at 600 in light mode (100 and 200 in dark). Identical stops read flat no
matter what you do with the font weight.

```svg
<rect x="100" y="20" width="200" height="56" rx="8" fill="#E1F5EE"
      stroke="#0F6E56" stroke-width="0.5"/>
<text x="200" y="38" text-anchor="middle" dominant-baseline="central"
      fill="#085041" font-size="14" font-weight="500">Kafka producer</text>
<text x="200" y="56" text-anchor="middle" dominant-baseline="central"
      fill="#0F6E56" font-size="12">Batches and partitions</text>
```

## Dark mode: pick one strategy

Assume both modes unless the user rules one out. **Half-inverting is the worst outcome** —
a theme-reactive background under a hardcoded foreground produces black text on black.
Choose one strategy and hold it across the whole file.

### Strategy A — theme-reactive

Drive every color through a custom property, override the properties in one media query.
Use when the diagram is UI-adjacent and should feel native to its page.

```svg
<style>
  :root {
    --surface: #E1F5EE; --edge: #0F6E56; --ink: #085041; --hair: #888780;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --surface: #085041; --edge: #5DCAA5; --ink: #9FE1CB; --hair: #888780;
    }
  }
  .box  { fill: var(--surface); stroke: var(--edge); stroke-width: .5; }
  .t    { fill: var(--ink); font-size: 14px; font-weight: 500; }
  .ts   { fill: var(--ink); font-size: 12px; }
  .edge { fill: none; stroke: var(--hair); stroke-width: .5; }
</style>
```

Caveat: `prefers-color-scheme` inside a standalone `.svg` file follows the *system*
setting, not the host page's theme toggle. If the diagram must follow a page toggle,
inline the SVG into the HTML and let the page's variables cascade in.

### Strategy B — mode-stable

Pick mid-ramp values that clear contrast against both white and near-black, and let the
drawing look identical in both modes. Simpler, fewer failure modes, and mandatory for
physical-realism scenes — a sunset that inverts is broken.

Reliable mid stops: gray `#888780`, teal `#1D9E75`, purple `#7F77DD`, coral `#D85A30`,
amber `#EF9F27`.

**Mental test either way:** if the page were near-black, is every glyph still readable?
Run it against every `<text>`, not just the ones you remember styling. An unstyled `<text>`
inherits black and vanishes.

## Contrast targets

| Element | Ratio against its background |
|---|---|
| Body and label text | 4.5 : 1 |
| Large text (≥18px, or ≥14px bold) | 3 : 1 |
| Meaningful strokes, icon shapes, marks | 3 : 1 |
| Decorative hairlines | no minimum, but keep visible in both modes |

The 400 stops above sit near 3:1 on white and on `#0b0b0b` — fine for strokes and marks,
**not** for body text. Text needs a 600+ stop on a light fill, or a 100–200 stop on a dark
one.

## Never color alone

Roughly 8% of men have a color vision deficiency, and any diagram may be printed, pasted
into a grayscale doc, or screenshotted through a filter. Every distinction carried by hue
needs a second cue:

- **Dash pattern** — `stroke-dasharray="4 4"` for the secondary path, solid for the primary
- **Stroke weight** — 0.5px default, 1.5px for the highlighted route
- **Shape** — circles for messages, squares for batches, diamonds for decisions
- **Sparse hatching or dot patterns** via `<pattern>`, kept subtle
- **A direct label** on the thing itself

Red/green is the pairing to avoid outright. Amber/blue survives every common deficiency.

Grayscale test: convert your chosen fills to luminance. If two categories land within ~10%
of each other, they are the same color to a meaningful slice of your readers.

## Brand palettes

When the user supplies brand colors, keep the **structure** above and swap the hues:

1. Map their primary to your accent ramp, their neutral to gray.
2. Derive the stops you need — lighten toward white for fills, darken toward black for
   text. You need at minimum a light fill, a mid stroke, and a dark text stop per hue.
3. Check each derived text stop against its fill for 4.5:1. Brand palettes are tuned for
   large marks and frequently fail at 12px.
4. If their palette has only one color, use it for the accent category and keep everything
   else gray. One brand hue against neutrals looks deliberate; a brand hue stretched across
   six categories looks broken.
