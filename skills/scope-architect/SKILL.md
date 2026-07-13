---
name: scope-architect
description: >
  Use this skill to map, remap, or split the vertical scopes of a feature — Shape Up's "map
  the scopes" (step 8) as committed, mechanically enforceable contracts. Triggers on: "map the
  scopes", "write the scope contracts", "scope contract", "remap this scope", "split this
  stuck scope", "the discovered tasks don't fit any scope", "re-slice the substrate", or a
  WorkOrder dispatch (--order, operations map-scopes | remap | split-scope) from the tech-lead
  orchestrator. The SOLE writer of docs/shapeup-sdlc/<slug>/scopes/*.json: import-graph
  slicing by business flow (never by directory), write-whitelist substrates for the sandbox
  hook, affordance manifests, e2e verification fixtures. A pure worker — returns a WorkResult;
  never touches tasks, spec docs, boards, or run-state. NOT for decomposing a pitch into
  tasks (ba-pitch-analyzer) or cutting scope at ship time (scope-hammer).
---

# Scope Architect (pure worker v1.0)

**Slice by flow, never by directory — and write it as a contract a hook can enforce.**

Groups a feature's tasks into independent, vertically-sliced **scopes** and writes each as a
committed contract (`docs/shapeup-sdlc/<slug>/scopes/<scope-id>.json`) the rest of the
harness enforces mechanically: the sandbox hook denies writes outside a substrate, t0-verify
runs the fixtures, the evaluator asserts only against the affordance manifest. This skill is
the **sole writer** of scope contracts — a distinct authority from the planner (task
decomposition) and a distinct failure mode (directory-thinking, PA1) deserving its own
anti-rationalization table.

## Input contract — the WorkOrder

| Field | What it is |
|---|---|
| `operation` | `map-scopes` (first slicing after the board exists) · `remap` (fold discovered items into scope contracts) · `split-scope` (re-slice one stuck scope) |
| `payload.feature` / `payload.spec_folder` | Slug + committed spec (read ux-behavior.md for manifests; usecases for flows) |
| `payload.tasks[]` | The board's tasks with their touched files — the slicing input |
| `payload.discovered_ledger` | (remap) items that fit no existing substrate |
| `payload.scope_id` | (split-scope) the stuck scope (`rounds_at_position ≥ 3`, or an approved substrate-expansion) |
| `substrate.allowed` | `scopes/*.json` + `scope-board.md` — your ONLY write surface |

## Core process

```
1 SLICE    build an import/business-flow graph over the tasks' touched files (grep heuristic
           is fine; AST is an optimization). One scope = one call chain: the UI screen + the
           API route + the use case + the repository it drives. Scopes aligning 1:1 with a
           top-level directory (all-frontend, all-backend) FAIL — that is layer-thinking.
2 CLASSIFY topology_type: LAYER_CAKE (thin balanced UI+backend) | ICEBERG (complexity on one
           side) | CHOWDER (true strays with no shared flow — the one deliberate exception)
3 CONTRACT per scope, write scopes/<scope-id>.json:
             scope_id, topology_type, tasks[]                — the stable join key is the scope
             allowed_file_substrate[]                        — exact globs; the sandbox hook's
                                                               write-whitelist; wrong here =
                                                               a legitimate ESCALATE later
             shared_substrate[]                              — files ≥2 scopes both touch;
                                                               every write there forces a full
                                                               seesaw run at the next gate
             affordance_manifest                             — from ux-behavior.md state
                                                               tables: every interactive
                                                               element as {test_id, role} +
                                                               required_states [idle, loading,
                                                               success, error, empty]
             e2e_verification_fixtures[]                     — the command(s)/spec file(s)
                                                               that drive this scope
                                                               end-to-end (T0 layer); too
                                                               speculative to fixture → mark
                                                               TBD and flag it, never invent
                                                               a fixture for unbuilt behavior
             hill_phase: "UPHILL_UNKNOWN"                    — ALWAYS; phase is derived from
                                                               T0/T1/seesaw facts later,
                                                               never authored (DD-10)
4 LINT     node skills/ba-pitch-analyzer/scripts/spec-lint.mjs --slug <slug>
           → PA1 (directory alignment), PA2 (>~15 files), DISJOINT (undeclared overlap).
           Fix reds by re-slicing, not by silencing.
5 BOARD    regenerate scope-board.md (scope_id, topology, task count, substrate size, lint)
```

**remap:** a discovered item joins the nearest scope only if the flow matches (extend that
substrate minimally); otherwise propose a NEW scope — never silently widen an existing one.
**split-scope:** re-run step 1 on just that scope's task+file set → N new contracts; mark the
old one `superseded_by: [ids]` — never delete (branch and T0 history stay attributable).

## Anti-rationalization table

| Excuse | Reality |
|---|---|
| "The discovered item obviously fits scope A" | Run the flow match. 'Obviously' is how substrates silently widen. |
| "One scope per directory is cleaner" | That's PA1 — a layer, not a flow. A scope must ship something a user can do. |
| "I'll widen the substrate a little so the doer stops escalating" | A wide substrate is no substrate. Split or add a shared_substrate entry, deliberately. |
| "This scope looks downhill, I'll set the phase" | hill_phase is UPHILL_UNKNOWN at write, always. Facts move dots, not authors. |
| "The old contract is superseded, delete it" | supersede-never-delete. History must stay attributable. |
| "Fixtures can come later, leave the field empty" | Fixture at contract time or an explicit TBD flag — silence is how T0 goes blind. |

## Output contract — the WorkResult

`scopes/*.json` + `scope-board.md` in your substrate, then
`.shapeup-sdlc/<slug>/results/<order-suffix>.json`: `status`, `artifacts[]` (the contracts
written/superseded), `escalates[]` (e.g. a discovered item implying a new UC — the planner's
territory), `deviations[]` (any lint warn left standing and why). You never touch task files,
`tasks/_index.md`, spec docs, or run-state.

## Verification checklist

- [ ] Every scope crosses layers or is declared CHOWDER; spec-lint PA1 = 0 red
- [ ] Substrates disjoint except declared shared_substrate (DISJOINT = 0 red)
- [ ] Every interactive element in scope screens appears in exactly one affordance_manifest
- [ ] Every scope has fixtures or an explicit TBD flag
- [ ] Every hill_phase written is UPHILL_UNKNOWN; superseded contracts kept
- [ ] The WorkResult validates against `work-result.schema.json`

## Invocation

```bash
# Orchestrated — compile-order --operation map-scopes|remap|split-scope --worker scope-architect …
/scope-architect --order .shapeup-sdlc/checkout-vnpay/orders/map-scopes.json

# Standalone shims (compile the same envelope)
/scope-architect --map docs/shapeup-sdlc/checkout-vnpay/
/scope-architect --split cart-creation docs/shapeup-sdlc/checkout-vnpay/
```

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-13 | Extracted from ba-pitch-analyzer Phase 6b + `--remap`/`--split` (plan §8.4): a distinct skill because it holds a distinct authority (sole writer of scope contracts) and a distinct failure mode (PA1 directory-thinking). Craft: import-graph slicing by flow, topology classification, affordance-manifest derivation, fixture authoring, supersede-never-delete. PA1/PA2/disjointness linting is mechanical (`spec-lint.mjs`); hill_phase is never authored (DD-10). Pure worker: WorkOrder in, contracts + WorkResult out. |
