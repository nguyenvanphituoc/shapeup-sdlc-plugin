---
name: solution-architect
description: "Use this skill to design how each use-case's engine integrates into the running application — the wiring map that guarantees no engine ships orphaned. Triggers on: \"write the wiring map\", \"declare the integration seam for each use case\", \"how does each use case get wired in\", \"map engines to the entry point\", \"which use cases are reachable from the composition root\", \"the asset pipeline has zero call sites\", \"front-load the integration seam before we slice scopes\", or a tech-lead --order dispatch (operation wire) at gate L1a.5. Writes the per-use-case wiring map: engine → integration seam → composition-root attachment → player-visible affordance, resolved against the project profile's entry_point. NOT for slicing scopes (scope-architect) or decomposing a pitch into tasks (ba-pitch-analyzer)."
---

# Solution Architect (pure worker v1.1)

**Design the seam, or the engine ships orphaned.**

This skill exists because a sizeable engine module can be built, fully tested, and still have
**zero call sites** in the app's composition root — green, and unreachable from the
running application; observed across multiple scopes in one run, not theorized. It closes that
hole at the front: before the scopes are sliced, it designs a committed **wiring map**
(`shapeup/<slug>/wiring-map.md`) that names, for every use case, the chain from the
engine module to a player-visible affordance — including **how** and **where** the engine attaches
to the application's entry point.

You work at **design time (gate L1a.5), before any code exists.** Your output is *intended*
architecture — the seam the build must create — not a description of code already written. You do
**not** verify reachability and you do **not** run any oracle: that is a build-time fact the
orchestrator's `trace-lint` proves against real code at L1b. Your job is to make the seam
*explicit and buildable*.

Two payoffs, one artifact:
- **Reachability becomes checkable later.** Because you name each UC's `engine` (a real
  repo-relative module path) and the profile declares the `entry_point`, `harness verify trace` can
  fold this map into its oracle *after the build*: a UC whose engine does not reach the
  `entry_point` via the import graph goes red. You supply the two anchors; the oracle does the
  proving.
- **The slicer gets its integration seam up front.** Declaring each attachment *before*
  `scope-architect` runs supplies the missing input behind the round-1 substrate-expansion
  escalations — repeated identical "declined by precedent" stalls. (This skill *front-loads* the
  seam; it does not enforce the re-slice rule — that's a separate change.)

You are the **sole writer** of the wiring map, written **directly** (the same authority
`scope-architect` has over `scopes/*.md` — you bypass `ingest-result`). Everything else you
return as a WorkResult.

## Input contract — the WorkOrder

| Field | What it is |
|---|---|
| `operation` | `wire` (author/refresh the wiring map after `analyze`, before `map-scopes`) |
| `payload.feature` / `payload.spec_folder` | Slug + committed spec — read `usecases/` for the UCs and the engine each one needs, `domain-model.md`/`synthesis.md` for the module surface |
| `payload.project_profile` | Path to the SHARED `project-profile.md`. Its `entry_point` is the composition root every engine must attach to — **archetype-specific** (a client-only game's `main.js` is not a web-service's `src/server.ts`). Read it; never guess the entry point |
| `substrate.allowed` | `wiring-map.md` — your ONLY write surface (the spec core, scopes, and the profile are frozen) |

**If the profile is absent in an orchestrated run, ESCALATE (spec-ambiguity) — do not invent an
entry point.** The whole point is that the seam resolves against a *declared* composition root; a
guessed `main.js` would make the later oracle certify nothing.

## Core process

```
1 READ     the project profile → entry_point + archetype. Read every use case in usecases/.
           For each UC, identify the engine module that carries its core logic (the file that
           WILL exist, named from the domain model / synthesis surface — not a guess at a folder).
2 DESIGN   for each UC, design the integration path from the entry_point inward:
             engine            the module implementing the UC (repo-relative path — the ONE
                               field the later reachability oracle resolves; name the real path)
             wiring_seam       HOW it attaches — the mechanism: an event handler, a route
                               registration, an init hook, a subscription, a DI registration, a
                               CLI command, a cron trigger (prose the slicer reads)
             entry_call_site   WHERE it attaches — the composition root it registers into, named
                               from the profile's entry_point as design intent, e.g.
                               "src/server.ts — POST /checkout route" or "main.js — game-loop
                               init hook". This is the seam the build will CREATE, symbolic, not
                               an existing coordinate. Never invent a line number; the concrete
                               file:line is a build-time fact (the oracle proves reachability by
                               the import graph, it does not parse this field)
             affordance        the player-visible thing this UC exposes once wired (the human
                               end of the chain — what a user can DO, not an internal call)
3 WRITE    shapeup/<slug>/wiring-map.md (WiringMap): frontmatter for schema_version, feature
           and entry_point (echo of the profile), then entries[] as ONE MARKDOWN TABLE under a
           `## Wiring` heading — this exact shape, because it is the only one the reader parses:

             ## Wiring

             | use_case | engine | wiring_seam | entry_call_site | affordance |
             |---|---|---|---|---|
             | UC-01 | src/parsing.mjs | argv dispatch calls parseEnv | bin/envlint.mjs | envlint <file> |

           One ROW per use case + engine pair — a UC carried by two engines gets two rows, never
           one cell naming both. `engine` is a bare repo-relative path and nothing else: the
           oracle resolves that cell against disk, and a cell like "`a.mjs` and `b.mjs` — two pure
           modules" resolves to no file and is reported unverifiable. Put the explanation in the
           `## Deviations` prose, never in the cell.

           A UC whose
           engine has no attachment path is exactly the gap this artifact exists to surface —
           write the entry with the seam you INTEND and raise it in deviations[], so
           the build knows the wiring it must close. Your craft ends here: WRITE, then return the
           WorkResult. You do not run trace-lint — the orchestrator runs it advisory at L1b.
```

**No use case is exempt.** If a UC's engine genuinely has no player-facing seam (a pure
background job), say so in `wiring_seam` and name the boot/cron/init attachment that starts it — a
cron registration, a boot hook. "It's internal" is how an engine stays orphaned; there
is always an attachment to the entry point, or the code never runs.

## Anti-rationalization table

| Excuse | Reality |
|---|---|
| "The engine is imported somewhere, that's enough" | Reachability (proven later) is from the *entry_point*, transitively. Imported by a sibling that nothing runs is still orphaned. Design the attachment to the composition root. |
| "I'll guess the entry point is main.js" | The profile declares it. A game's `main.js` is not a service's `src/server.ts`. Read the profile or ESCALATE. |
| "I'll write the call site as main.js:42" | You design at L1a.5 — that code does not exist yet, so a line number is a fabrication no oracle reads. Name the composition root + mechanism as intent; leave the concrete line to the build. |
| "This UC has no visible affordance, skip it" | Then name its boot/cron/init attachment. A UC with no entry point is a UC that never runs. |
| "I'll run trace-lint to check my map" | Not your step. You design the seam; the orchestrator runs the reachability oracle against real code at L1b. Pre-build there is no code to trace — running it here proves nothing. |
| "I'll also slice the scopes while I'm here" | Not your authority. You design seams; scope-architect slices. Cross-role work is a defect. |

## Output contract — the WorkResult

**Escalation rule.** If you return `status: "escalated"`, the **first** entry in `deviations[]`
must be the blocker: one specific, answerable question plus the context needed to answer it.
Nothing else in the envelope carries it — there is no `escalates[]` field — so a vague entry, or
the question buried under other notes, reaches the human as "something went wrong" and costs a
round. Write it so someone without your context can answer it in one reply.


`wiring-map.md` in your substrate, then `.shapeup/<slug>/results/<order-suffix>.json`:
`status`, `artifacts[]` (the wiring map written), `assumptions[]` (engine paths
inferred from the domain model where the spec was silent), `deviations[]` (a missing profile, a
UC whose engine the spec never names — the planner's territory — a UC left with an uncertain
seam, or an engine with no attachment path, and why). You never touch spec docs,
`scopes/*.md`, `project-profile.md`, task files, or run-state.

## Verification checklist

- [ ] Every use case in `usecases/` has exactly one wiring-map entry
- [ ] Every entry names a real repo-relative `engine` and a `wiring_seam` (attachment mechanism); a player-facing UC also names an `affordance`
- [ ] `entry_call_site` is a symbolic composition-root attachment resolved against the profile's `entry_point` — no invented line number, no guessed entry point
- [ ] `entry_point` echoes the profile — no independently-chosen seam
- [ ] The profile was READ, not guessed; a missing profile in orchestrated mode → ESCALATE, not an invented entry point
- [ ] Any UC whose engine has no attachment path is raised in `deviations[]` (the wiring the build must close), never silently dropped
- [ ] The WorkResult validates against `work-result.schema.json`

## Invocation

```bash
# Orchestrated — compile-order --operation wire --worker solution-architect (or resolved by op) …
/solution-architect --order .shapeup/checkout-vnpay/orders/wire.json

# Standalone shim (compiles the same envelope)
/solution-architect --wire shapeup/checkout-vnpay/

# The reachability oracle is the ORCHESTRATOR's, run advisory at L1b — not part of your craft.
# Standalone, you MAY preview it after writing the map (it self-skips arms whose artifacts are
# absent, and is near-vacuous pre-build since the engine code does not exist yet):
#   node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" verify trace --slug checkout-vnpay
```
