---
name: orient
description: >
  Use this skill for Shape Up step 7 (Orient) — the builder-led reconnaissance pass that runs
  AFTER kick-off and BEFORE any task board exists. Triggers on: "orient on this feature",
  "scout the codebase for this pitch", "where does this pitch touch the code", "do an orient
  pass", "recon before we plan", "spike the riskiest part before mapping scopes". The tech-lead
  orchestrator invokes it at step 7 before delegating to ba-pitch-analyzer (Map Scopes, step 8).
  Use it even when the user describes "read the code first and surface the unknowns" without
  naming Orient. The Scout is a PURE worker: it reads code, spikes the single riskiest area, and
  emits four artifacts (code-surface map, spike findings, discovered-task seed, hill signal). It
  writes NO production code, builds NO scope board, keeps NO run-state, and renders NO progress
  report — those belong to ba (planner) and tech-lead (orchestrator) respectively.
---

# Orient — the Scout (Shape Up step 7)

In Shape Up, the team that builds also **orients**: after kick-off they read the real code,
spike the scary parts, and let reality generate **Discovered tasks** — which outnumber the
imagined ones. This skill is that pass, made explicit. It exists because the orchestrator
(`tech-lead`) must *delegate* orientation, and the generator (`task-executor`) can't host it:
its first gate needs a task file, and **at Orient time no board exists yet** — the board is
mapped *after* this pass, by `ba-pitch-analyzer` at step 8.

So the Scout's whole job is to make the planner's board **reality-born instead of imagined**.
It hands `ba` a map of where the pitch lands in real code, the findings from de-risking the
single scariest area, and a seed list of tasks (imagined + already-discovered). Nothing more.

```
PO: shaping → bet → kick-off ──► tech-lead ──► ORIENT (you) ──► ba (Map Scopes) ──► build
                                                  reads code, spikes, seeds
```

---

## What the Scout is and is not

| Does | Does NOT |
|------|----------|
| Read the kicked-off pitch + breadboard | Re-shape, re-bet, or question the appetite (PO already did) |
| Trace pitch elements to real files/modules | Write production code |
| Spike the **single** riskiest area, time-boxed | Build the scope board / tasks (that is `ba`, step 8) |
| Seed the discovered-task list (imagined + discovered) | Keep `run-state` (tech-lead owns it) |
| Emit raw hill **signal** (per-area unknowns) | Render the hill **report** (tech-lead renders it) |

The Scout is a **pure worker** (the harness rule: stateless workers, one stateful
orchestrator). It receives run metadata — `feature`, `spec` folder, `stack` — as **arguments**
from `tech-lead`; it never reads or writes a shared run-state file.

---

## Output — the four artifacts (the `orient → ba` contract)

All four land in the LOCAL run-trace root `.shapeup-sdlc/<feat>/orient/`. These ARE the contract `ba` Phase 1 consumes, so `ba` does
not re-scan the codebase. Keep them factual and link real `file:line` so the planner can trust
them.

| File | Purpose | Consumed by |
|------|---------|-------------|
| `orient/code-surface.md` | where the pitch lands in real code: modules, files, existing entities, seams | `ba` Phase 1 (ingest), Phase 2 (DDD) |
| `orient/spike-<area>.md` | findings from de-risking the single riskiest area | `ba` Phase 1b / contracts; tech-lead L1a |
| `orient/discovered-seed.md` | imagined + already-discovered tasks, grouped by suspected scope | `ba` Phase 6 (task gen) |
| `orient/hill-signal.md` | per-area inventory of open unknowns (raw signal, not a report) | `tech-lead` GATE L1a hill render |

---

## Workflow

```
INTAKE: kicked-off pitch (+ breadboard) + codebase + args(feature, spec, stack)
          │
⏸ GATE O-A │  Locate & validate ──► confirm pitch path, breadboard (if any), spec target, codebase root
          │
Phase 1   │  Read the shape ──────► extract elements/places/slices to ground in code
Phase 2   │  Code-surface scan ───► map each element → real file:line / module / entity
          │                         → write orient/code-surface.md
Phase 3   │  Risk triage ─────────► rank areas by unknowns × integration risk; pick the ONE riskiest
          │
⏸ GATE O-B │  Spike scope ─────────► confirm the area + question + time-box before spiking
          │                         (no-risk path: declare SPIKE-NOT-NEEDED, skip Phase 4)
          │
Phase 4   │  Spike ───────────────► time-boxed investigation in real code; answer the question
          │                         → write orient/spike-<area>.md  (or spike-not-needed.md)
Phase 5   │  Seed discovered tasks ► imagined + discovered, grouped by suspected scope
          │                         → write orient/discovered-seed.md
Phase 6   │  Emit hill signal ────► per-area open-unknown inventory
          │                         → write orient/hill-signal.md
✅ Done    └─► 4 artifacts in .shapeup-sdlc/<feat>/orient/ — hand back to tech-lead for GATE L1a
```

Under `--auto` (passed by `tech-lead` when its run level is `--auto`/`--unattended`), run
straight through, auto-confirming O-A and O-B with sensible defaults.

---

## GATE O-A — Locate & validate

```
Confirm (do not guess):
  - kicked-off pitch path (shaping.md / pitch.md)
      Shaped signal: frontmatter status: shaped AND bet: <S1|S2|...> (or equivalent).
      If the pitch lacks appetite AND solution boundaries → STOP and tell tech-lead:
        "Orient runs on a kicked-off pitch, not a raw idea. Shape/bet first (PO upstream)."
  - breadboard.md path — read it if it exists; record "no breadboard" if absent
  - spec folder target (create orient/ if absent)
  - codebase root
```

---

## Phase 1 — Read the shape

Read the pitch and breadboard (if present). Extract the concrete things to find in code:

- **With breadboard**: the **places** and **affordances** (U[N]/N[N] IDs), **slices** (if B5
  named them), named entities, third-party mentions.
- **No breadboard**: extract the pitch's *problem statement*, *solution shape* (the key
  verbs/nouns), and any named entities or actions. These become your elements to ground.

You are listing *what to look for* — not solutions.

## Phase 2 — Code-surface scan → `code-surface.md`

For each element, locate where it lands in the real codebase. Bias toward breadth over depth —
the goal is a reliable **map**, not a deep read.

```
Useful sweeps (adapt to the stack arg):
  find . -path "*/schema*"  -o -path "*/domain*"      # existing entities / aggregates
  find . -path "*/repository*" -o -path "*/usecase*"  # seams to extend
  find . -path "*<feature-keyword>*"                  # prior art for this feature
  grep -rn "<entity or affordance keyword>" <src dirs>
```

Write `code-surface.md`: one row per pitch element → `file:line` it touches (or "NEW — no
existing home"), the seam it extends, and whether it's new vs. existing. Flag every place the
map is uncertain — uncertainty is signal for Phase 3, not something to hide.

> **Output location.** All four orient artifacts are run-trace (recon scratch), so they
> go to the **LOCAL** root `.shapeup-sdlc/<feat>/orient/` (hidden, gitignorable) — *not*
> into the shared `--spec` dir. `<feat>` is the feature slug (parent of the `--spec`
> deliverable dir). The bare filenames below are all relative to `.shapeup-sdlc/<feat>/orient/`.

## Phase 3 — Risk triage

Rank candidate areas by **(open unknowns) × (integration risk)**. The riskiest is usually
where the pitch meets an unproven seam: a third-party API, a data-shape you can't confirm from
code, a cross-layer contract, a performance assumption. Pick the **single** highest — the
Scout spikes one thing well, not five things shallowly. List the rest as known unknowns (they
feed the hill signal and `ba`'s rabbit-hole handling).

## GATE O-B — Spike scope

```
No-spike path: if every area has confirmed prior art and no genuine unknown (Phase 3
  returned rank 0 risk), declare SPIKE-NOT-NEEDED. Write orient/spike-not-needed.md
  (one paragraph: why no spike is needed + what prior art covers the riskiest seam).
  Then skip Phase 4 and proceed to Phase 5.

Spike path: if a risky area exists, confirm before spiking:
  Area      : [the one riskiest area]
  Question  : [the single question — phrased so the answer is checkable]
  Time-box  : [hard cap, e.g. 30–60 min of investigation]
  Fallback  : [what ba plans around if spike can't resolve it]
```

## Phase 4 — Spike → `spike-<area>.md`

Investigate in the **real code** — read the actual library/SDK, trace the actual data shape,
write a throwaway probe if needed. This is `shapeup /spike` technique, but build-time and
code-grounded rather than shaped-solution-time. Answer the question or declare it
`SPIKE-UNRESOLVED` with the fallback. Cite `file:line` and any external source. Stay inside
the time-box; a partial answer with a clear residual unknown is a valid result.

## Phase 5 — Seed discovered tasks → `discovered-seed.md`

Write the task seed `ba` Phase 6 will turn into the board. Two kinds, clearly labelled:
- **Imagined** — what you'd expect from the pitch alone.
- **Discovered** — what the code-surface scan and spike actually surfaced (the higher-value
  set; in Shape Up these dominate). **Every discovered task must cite `file:line` or seam.**
  If you can't cite a real location, it belongs in Imagined, not Discovered.

Group by **suspected scope** so `ba` can map scopes naturally. Do **not** assign IDs, order,
or dependencies — that is the planner's job. You are handing over raw material, not a plan.

> This is the seed for the planner's first board. The *in-build* discovered-task loop
> (`task-executor` P3.7 appending to the live ledger, reconciled by `ba --from-discovered`) is
> a separate, later mechanism — don't conflate the two.

## Phase 6 — Emit hill signal → `hill-signal.md`

For each suspected scope/area, list its **open unknowns** (unresolved spike question, `⏳ TBD`
data shape, unproven seam, ambiguous requirement). This is the raw input `tech-lead` renders
into the Hill at GATE L1a — a scope with open unknowns sits **uphill**; one whose approach the
spike proved sits toward the **crest**. Emit the *facts*; let `tech-lead` position the dots.
Keep it per-area (not per-slice) — slices don't exist until `ba` maps them at step 8.

---

## Done — completion output

When all four artifacts are written, emit this summary (to tech-lead or directly to the user
in standalone mode):

```
✅ Orient complete — .shapeup-sdlc/<feat>/orient/

  Artifacts:
    code-surface.md   — <N> pitch elements mapped; <M> NEW / <K> EXISTING seams
    spike-<area>.md   — [RESOLVED | SPIKE-NOT-NEEDED | SPIKE-UNRESOLVED: <fallback>]
    discovered-seed.md — <N imagined> + <M discovered> tasks seeded across <K> scopes
    hill-signal.md    — <summary line from hill, e.g. "No uphill areas; spike at crest.">

  Ready for ba (step 8):
    Pass --orient-dir .shapeup-sdlc/<feat>/orient/ to ba-pitch-analyzer.
    ba Phase 1 skips its own codebase scan and reads code-surface.md as its authoritative map.
```

Tech-lead uses this to render the GATE L1a Hill and confirm the spike before handing to `ba`.

---

## Hard rules

| Rule | Why |
|------|-----|
| Runs on a kicked-off (shaped + bet) pitch only | Shaping/betting are PO-personal, upstream of Orient |
| Writes the four artifacts, nothing else | The Scout is a pure worker; no code, no board, no run-state, no report |
| Spike exactly one area OR declare SPIKE-NOT-NEEDED | Depth on the scariest unknown beats shallow coverage; don't spike for its own sake |
| Every Discovered task in the seed cites `file:line` | If no real location exists, it belongs in Imagined, not Discovered |
| Never assign task IDs/order/deps in the seed | Mapping scopes is `ba`'s job (step 8) — the Scout hands over raw material |
| Receives `feature`/`spec`/`stack` as args; never touches run-state | `tech-lead` is the sole run-state writer |
| Emits hill *signal*, never a hill *report* | `tech-lead` renders progress; workers emit facts |

---

## Invocation

```bash
# Invoked by tech-lead at step 7 (typical)
/orient --pitch docs/shapeup-sdlc/<feat>/shaping/shaping.md --spec docs/shapeup-sdlc/<feat>/spec/ --stack "pnpm, Next 16 web :3000"

# Standalone recon (no orchestrator) — still writes only the four artifacts
/orient --pitch docs/shapeup-sdlc/<feat>/shaping/shaping.md --spec docs/shapeup-sdlc/<feat>/spec/

# Auto (tech-lead passes this under --auto/--unattended): run straight through
/orient --pitch ... --spec ... --auto
```

### Flags
| Flag | Effect |
|------|--------|
| `--pitch <path>` | The kicked-off pitch (+ sibling `breadboard.md` if present) |
| `--spec <path>` | SHARED spec deliverable dir (docs/shapeup-sdlc/<feat>/spec/); orient *artifacts* are written to the LOCAL root `.shapeup-sdlc/<feat>/orient/` |
| `--stack <hint>` | Stack hint to aim the code-surface sweeps |
| `--auto` | Auto-confirm O-A and O-B; run straight through |

---

## Changelog
| Version | Date | Changes |
|---------|------|---------|
| 0.2 | 2026-06-16 | GATE O-A: explicit shaped-pitch signals (frontmatter check). Phase 1: no-breadboard fallback. GATE O-B: SPIKE-NOT-NEEDED path for all-prior-art pitches. Phase 5: Discovered tasks require `file:line` citation. New "Done — completion output" section with ba handoff note (`--orient-dir`). Hard rules updated. |
| 0.1 | 2026-06-10 | Initial Scout. Shape Up step 7 as a pure worker: code-surface map, single time-boxed spike, discovered-task seed, hill signal. Defines the `orient → ba` handoff contract. No code / no board / no run-state / no reporting. |
