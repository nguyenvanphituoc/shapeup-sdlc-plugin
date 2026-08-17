# Animation

Animate to show **behavior** — flow, propagation, rotation, convection, state change.
Never to decorate. If the motion could be removed without losing information, remove it.

Every animated diagram must still communicate in its static state, because a screenshot,
a PDF export, and a reduced-motion reader all get exactly that.

## Contents

- [Choosing a mechanism](#choosing-a-mechanism)
- [What to animate](#what-to-animate)
- [Reduced motion](#reduced-motion)
- [CSS keyframes](#css-keyframes)
- [SMIL](#smil)
- [JS: particles along a route](#js-particles-along-a-route)
- [Interactive controls](#interactive-controls)
- [Performance](#performance)

## Choosing a mechanism

| Need | Mechanism | Why |
|---|---|---|
| Dash march, pulse, fade, simple transform | CSS `@keyframes` | No JS, works in a standalone `.svg`, respects media queries |
| One object traversing a defined route | SMIL `<animateMotion>` | Declarative, no JS, follows a `<path>` exactly |
| Playback control, spawning, state, physics | JS + `requestAnimationFrame` | The only option once you need pause, rate, or object lifecycles |

Take the cheapest one that does the job. Reach for JS only when the diagram needs state.

**Standalone `.svg` files:** CSS and SMIL both work. Script does not run when the file is
loaded via `<img src="…">` — if the diagram needs JS, it must be inlined into HTML, and
you should tell the user that.

## What to animate

**`transform` and `opacity` only.** These composite on the GPU. Animating `x`, `y`, `cx`,
`cy`, `width`, or `r` forces layout on every frame and stutters as soon as the object count
rises past a few dozen.

The exception is `stroke-dashoffset`, which is cheap and is the standard way to march a
flow along a line or draw a path on.

Loops under ~2s. Longer than that and the reader stops perceiving it as a loop and starts
waiting for something to happen.

## Reduced motion

Wrap every animation so motion is opt-out by default:

```css
@media (prefers-reduced-motion: no-preference) {
  .flow { animation: march 1.6s linear infinite; }
}
```

Note the direction: the animation is declared *inside* `no-preference`, so a reader who has
not expressed a preference — or who has asked for less motion — gets the static diagram.
Declaring the animation globally and disabling it in a `reduce` query is the common
inversion and it fails for anyone whose preference is unspecified.

For JS-driven motion, check the same signal and render one static frame:

```js
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (still) { drawStaticFrame(); } else { requestAnimationFrame(frame); }
```

## CSS keyframes

Flow along a connector — the workhorse. Dashes marching along a path read as directional
movement with no moving objects at all:

```svg
<style>
  @keyframes march { to { stroke-dashoffset: -20; } }
  @media (prefers-reduced-motion: no-preference) {
    .flow { animation: march 1.6s linear infinite; }
  }
  .flow { stroke-dasharray: 5 5; }
</style>
<path class="flow" d="M120 76 L120 100 L340 100 L340 132"
      fill="none" stroke="#1D9E75" stroke-width="1"/>
```

Stagger identical elements with a delay rather than writing several keyframe blocks:

```css
.node:nth-child(2) { animation-delay: .15s; }
.node:nth-child(3) { animation-delay: .30s; }
```

**`transform-box: fill-box`** is essential for rotating or scaling an SVG child. By default
`transform-origin` resolves against the whole SVG viewport, so `center` is the canvas
center and your element orbits it:

```css
.spin { transform-box: fill-box; transform-origin: center; }
```

## SMIL

Best when one object follows one route and you want zero script:

```svg
<path id="r1" d="M160 84 V108 H340 V214" fill="none" stroke="none"/>
<circle r="5" fill="#1D9E75">
  <animateMotion dur="3s" repeatCount="indefinite">
    <mpath href="#r1"/>
  </animateMotion>
</circle>
```

Stagger with `begin="0s"`, `begin="0.8s"`, `begin="1.6s"` on sibling copies.
`keyPoints`/`keyTimes` with `calcMode="linear"` control pacing along the route.

SMIL cannot be paused or re-rated from a control without script, and it has no concept of
object lifecycle. At that point, switch to JS.

## JS: particles along a route

The pattern for pipelines, networks, and message-flow diagrams. Draw invisible routes, then
sample positions along them each frame.

```js
const routes = [...svg.querySelectorAll('.route')].map(el => ({
  el, len: el.getTotalLength()
}));

const SPEED = 180;              // px per second, not per frame
let prev = 0, live = [];

function frame(t) {
  if (!prev) prev = t;
  const dt = Math.min((t - prev) / 1000, 0.05);   // clamp: tab-switch returns a huge dt
  prev = t;

  for (let i = live.length - 1; i >= 0; i--) {
    const m = live[i];
    m.d += SPEED * dt;
    if (m.d >= m.route.len) { m.el.remove(); live.splice(i, 1); continue; }
    const p = m.route.el.getPointAtLength(m.d);
    m.el.setAttribute('transform', `translate(${p.x} ${p.y})`);
    m.el.setAttribute('opacity', hidden(p.y) ? '0' : '1');
  }
  requestAnimationFrame(frame);
}
```

Four things that matter here:

1. **Drive from the frame delta, not the frame count.** `d += SPEED * dt` runs at the same
   speed on 60Hz and 144Hz displays. `d += 3` does not.
2. **Clamp `dt`.** A backgrounded tab returns a delta of several seconds on resume, and
   every particle teleports to the end of its route.
3. **Move with `transform`, not `cx`/`cy`.** Same reason as above.
4. **Hide, don't reroute.** Where a route passes behind a filled node, set `opacity: 0` for
   that coordinate range. The particle then reads as entering the node and emerging from
   it, which is what the diagram means, and you avoid routing around every box.

`getTotalLength()` and `getPointAtLength()` need the path to be in the document — call them
after the SVG is parsed, not while building it as a string.

For a fixed cast of objects, reuse elements rather than creating and removing them. For a
continuous stream, spawn on an accumulator:

```js
acc += dt;
const gap = 1 / rate;
while (acc >= gap) { acc -= gap; spawn(); }
```

## Interactive controls

Use real HTML controls next to the inline SVG — `<button>`, `<input type="range">`. They
are keyboard-reachable and screen-reader-labelled for free. A bare `onclick` on a `<g>` is
neither.

- Every control needs a visible label or an `aria-label`.
- A play/pause toggle must update both its icon and its accessible name in the same handler.
- Reset `prev = 0` when resuming from pause, or the first frame after resume gets the
  entire paused duration as its delta.
- Round every number you display. `0.1 + 0.2` renders as `0.30000000000000004` otherwise.

## Performance

- Under ~50 moving objects, none of this matters. Past a few hundred, SVG is the wrong
  tool — move to `<canvas>`.
- Batch reads and writes. Interleaving `getPointAtLength()` (a read) with
  `setAttribute()` (a write) inside one loop is fine; querying the DOM inside the loop is
  not. Hoist selectors out.
- One `requestAnimationFrame` loop for the whole diagram, never one per object.
- Never animate `filter`, `box-shadow`, or anything that triggers a repaint of a large
  region.
