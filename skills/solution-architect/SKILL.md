---
name: solution-architect
description: >
  Use this skill to declare how each use-case's engine reaches the running application — the
  wiring map that guarantees no engine ships orphaned. Triggers on: "write the wiring map",
  "declare the entry-point call sites", "how does each use case get wired in", "map engines to
  the entry point", "which use cases are reachable from main", "the asset pipeline has zero call
  sites", "front-load the integration seam before we slice scopes", or a WorkOrder dispatch
  (--order, operation wire) from the tech-lead orchestrator at gate L1a.5. The SOLE writer of
  docs/shapeup-sdlc/<slug>/wiring-map.json: per use-case, engine → wiring seam → entry-point
  call site → player-visible affordance, resolved against the project profile's archetype-specific
  entry_point. A pure worker — returns a WorkResult; never touches spec docs, scopes, boards, the
  profile, or run-state. NOT for slicing scopes (scope-architect) or decomposing a pitch into
  tasks (ba-pitch-analyzer).
---

# Solution Architect (pure worker v1.0)

**Declare the seam, or the engine ships orphaned.**

The audit that motivated this skill found a 631-line asset pipeline with 26 passing tests and
**zero call sites** in `main.js` — built, green, and unreachable from the running app. Five more
scopes had engines never wired to a player. This skill closes that hole at the front: before the
scopes are sliced, it writes a committed **wiring map**
(`docs/shapeup-sdlc/<slug>/wiring-map.json`) that names, for every use case, the chain from the
engine module to a player-visible affordance — including the exact **entry-point call site** the
engine attaches through.

Two payoffs, one artifact:
- **Reachability becomes checkable.** `trace-lint.mjs` folds this map into its oracle: a UC whose
  engine does not reach the profile's `entry_point` via the import graph goes red. The map is
  what makes "unreachable" a machine fact instead of a code-review hope.
- **The slicer gets its integration seam up front.** Declaring each entry-point call site *before*
  `scope-architect` runs supplies the missing input behind the round-1 `main.js` substrate-expansion
  escalations — the four identical "declined by precedent" stalls. (This skill *front-loads* the
  seam; it does not enforce the re-slice rule — that's a separate change.)

You are the **sole writer** of the wiring map, written **directly** (the same authority
`scope-architect` has over `scopes/*.json` — you bypass `ingest-result`). Everything else you
return as a WorkResult.

## Input contract — the WorkOrder

| Field | What it is |
|---|---|
| `operation` | `wire` (author/refresh the wiring map after `analyze`, before `map-scopes`) |
| `payload.feature` / `payload.spec_folder` | Slug + committed spec — read `usecases/` for the UCs and the engine each one needs, `domain-model.md`/`synthesis.md` for the module surface |
| `payload.project_profile` | Path to the SHARED `project-profile.json`. Its `entry_point` is the seam every engine must reach — **archetype-specific** (`main.js` for a client-only game is not the seam for a web-service). Read it; never guess the entry point |
| `substrate.allowed` | `wiring-map.json` — your ONLY write surface (the spec core, scopes, and the profile are frozen) |

**If the profile is absent in an orchestrated run, ESCALATE (spec-ambiguity) — do not invent an
entry point.** The whole point is that reachability resolves against a *declared* seam; a guessed
`main.js` would make the oracle certify nothing.

## Core process

```
1 READ     the project profile → entry_point + archetype. Read every use case in usecases/.
           For each UC, identify the engine module that carries its core logic (the file that
           WILL exist, named from the domain model / synthesis surface — not a guess at a folder).
2 TRACE    for each UC, walk the intended integration path from the entry_point inward:
             engine            the module implementing the UC (repo-relative path)
             wiring_seam       HOW it attaches — an event handler, a route registration, an
                               init hook, a subscription (prose the slicer reads)
             entry_call_site   file:line where the entry point invokes the engine (the seam
                               declared up front; "main.js:42" — approximate line is fine, the
                               file is what matters). Unknown yet → say so in the seam, don't
                               fabricate a line
             affordance        the player-visible thing this UC exposes once wired (the human
                               end of the chain — what a user can DO, not an internal call)
3 WRITE    docs/shapeup-sdlc/<slug>/wiring-map.json (WiringMap): {schema_version:1, feature,
           entry_point (echo of the profile), entries[]}. One entry per use case. A UC with no
           reachable engine is exactly the gap this artifact exists to surface — write the entry
           with the seam you INTEND, so trace-lint can prove whether the code delivers it.
4 CHECK    node skills/tech-lead/scripts/trace-lint.mjs --slug <slug>
           → reads your map + the profile, reports reachability. Advisory here (code may not
           exist yet); the red entries are the wiring TODOs the build must close, not your bug.
```

**No use case is exempt.** If a UC's engine genuinely has no player-facing seam (a pure
background job), say so in `wiring_seam` and give the entry_call_site that starts it — a cron
registration, a boot hook. "It's internal" is how the asset pipeline stayed orphaned; there is
always an entry point, or the code never runs.

## Anti-rationalization table

| Excuse | Reality |
|---|---|
| "The engine is imported somewhere, that's enough" | Reachability is from the *entry_point*, transitively. Imported by a sibling that nothing runs is still orphaned. Name the call site. |
| "I'll guess the entry point is main.js" | The profile declares it. A game's `main.js` is not a service's `src/server.ts`. Read the profile or ESCALATE. |
| "This UC has no visible affordance, skip it" | Then name its boot/cron/init seam. A UC with no entry point is a UC that never runs. |
| "The call-site line doesn't exist yet, invent one" | Declare the seam in prose; leave the line honest. trace-lint checks the module reaches the entry, not that a fabricated line resolves. |
| "Reachability is red, I must have wired it wrong" | Pre-build, red = a wiring TODO for the doer. Your job is to declare the intended seam, not to make code that doesn't exist yet turn green. |
| "I'll also slice the scopes while I'm here" | Not your authority. You declare seams; scope-architect slices. Cross-role work is a defect. |

## Output contract — the WorkResult

`wiring-map.json` in your substrate, then `.shapeup-sdlc/<slug>/results/<order-suffix>.json`:
`status`, `artifacts[]` (the wiring map written), `escalates[]` (e.g. a missing profile, or a UC
whose engine the spec never names — the planner's territory), `assumptions[]` (engine paths
inferred from the domain model where the spec was silent), `deviations[]` (any UC left with an
uncertain seam and why). You never touch spec docs, `scopes/*.json`, `project-profile.json`,
task files, or run-state.

## Verification checklist

- [ ] Every use case in `usecases/` has exactly one wiring-map entry
- [ ] Every entry names an `engine` (repo-relative) and a `wiring_seam`; a player-facing UC also names an `affordance`
- [ ] `entry_point` echoes the profile — no independently-chosen seam
- [ ] The profile was READ, not guessed; a missing profile in orchestrated mode → ESCALATE, not an invented entry point
- [ ] `trace-lint --slug <slug>` ran; red entries are recorded as the build's wiring TODOs (not silently dropped)
- [ ] The WorkResult validates against `work-result.schema.json`

## Invocation

```bash
# Orchestrated — compile-order --operation wire --worker solution-architect (or resolved by op) …
/solution-architect --order .shapeup-sdlc/checkout-vnpay/orders/wire.json

# Standalone shim (compiles the same envelope)
/solution-architect --wire docs/shapeup-sdlc/checkout-vnpay/
```
