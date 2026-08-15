# v2.0 — what moved, measured

HEAD `b9d044f` · version 2.0.0

| Metric | v1 baseline | v2.0 |
|---|---|---|
| Pipeline entry points | 21 (16 scripts + 5 lib, 3 skills) | 1 (`kernel/harness.mjs`) + 3 libs |
| Permission grant lines written by init | 40 Bash rules, regenerated per script | 2 Bash rules + 1 optional `Workflow` — proven 9/9 by execution |
| Hand-rolled runtime | `run-workflow.mjs`, 400 lines | 0 — the native `Workflow` tool |
| Orchestrator | 911 lines, courier-defended | 771 lines, zero couriers (gained fan-out + refute wave + graph query) |
| Hooks | 10 | 4 walls + 1 blocking Stop hook, in 4 files |
| Scope build | sequential | `pipeline()`, `args.maxParallelScopes` (default 4) |
| Resume | directory re-scan per launch | one bounded graph query |
| tech-lead references | 8 files, 1348 lines | 4 files, 1332 lines |
| CHANGELOG | 1428 lines / 106 KB | 172 lines / 16 KB (v1 history at the tag) |
| Structural checks | 943 | 879 |
| Tracked lines (code + docs) | ~38,300 | ~36,700 |

## Two plan targets not met, and why

**≤ 15,000 lines.** Not met, and it was not reachable: 21,940 of the ~36,700 are `skills/` +
`kernel/`, which is the product itself — worker craft prose and the deterministic code beneath it —
and 6,900 are the test suite. The consolidation mostly RE-HOMED executable code rather than deleting
it (`skills/` fell 21,775 → 13,790 because the scripts moved to `kernel/`). What actually went:
the hand-rolled runtime (−400), the courier defenses (−230), six hooks (−880), the changelog
(−1,250), four references (−16 net, but eight files became four). Reaching 15,000 would mean
deleting the skills or the suite.

**Orchestrator ≤ 600 lines.** 771. It lost every courier defense and gained the fan-out pipeline,
the opt-in refute wave, the graph query and a JSDoc block on each helper. The 600 figure came from a
draft that had none of those.

## The orchestrator had never been launched, and did not load

Everything above was measured from the artifacts. Nothing had ever *run* the file the whole rebuild
is about, and when it was finally launched on the `Workflow` tool it was refused before its body
executed:

```
Invalid workflow script: meta must be a pure literal: non-literal node type in meta: BinaryExpression
```

`meta.description` was three string literals joined with `+`. The runtime parses `meta` statically
and rejects the whole script on any node it would have to evaluate, so `shapeup-run.js` could not
start — under any lane, interactive or headless. It shipped that way, tagged 2.0.0, under a green
suite: v2.0's central claim ("runs on the native Workflow runtime") was false for the entire life of
the branch. The defect came in with the draft — `docs/output/shapeuprun.native.js` writes its
description the same way, so neither file was ever runnable — which is the cost of adopting a
companion draft that had also never been executed.

A second one, in the SHIPPED set, from the same cause. `commands/build.md` and `commands/ship.md`
both documented the launch as `node "…/kernel/harness.mjs" run "…/shapeup-run.js" --args-file …`.
The kernel has no `run` verb and never has; the documented front door to a whole feature build exits
2 on `unknown_verb`. `ship.md` contradicted itself three paragraphs later ("**The launch is the
`Workflow` tool**") — the bash block was v1 residue Phase 2 replaced in SKILL.md and left in
`commands/`.

Both are fixed, and both now have a guard that fails on the original defect and passes on the fix
(each verified by re-introducing the defect and watching the suite go red):

- **#16 (f)** — every workflow script's `meta` is a pure literal carrying `name` + `description`.
  The suite checked the orchestrator's SHAPE exhaustively and never whether it LOADS, because that
  property is visible only to a parse.
- **#43** — the invocation census now reads `commands/*.md` as well as `skills/`. Its verb check was
  already correct and derived from `ROUTES`; it was pointed one directory short of the defect.

The general lesson, and the reason both survived a fully green suite: **a static suite cannot tell
you that a thing runs.** Only an execution can, and until this session nothing had executed it.

## What is now proven by execution

Two live launches on the `Workflow` tool, after the fix:

| Probe | Result |
|---|---|
| The shipped `shapeup-run.js` loads and runs on the native runtime | Returned the `aborted` member of `RunReturn` with all six expected arg problems, incl. the model floor rejecting a below-floor tier. 0 agents, 11 ms |
| A native worker leg dispatches, with a real shell and the real kernel | `{ok: true, exit_code: 0}`, schema-validated |
| **A non-zero exit survives the boundary with no courier** | `{ok: false, exit_code: 2}` — the exact fact the deleted courier layer existed to carry |
| A JSON document crosses schema-validated (`query()`) | The `RESUME` doc came back field-for-field identical to the kernel's own stdout |
| `pipeline()` dispatches legs in parallel | 3/3 legs green. **Max 2 ran simultaneously**, not 3: two started 198 ms apart and overlapped, the third began after the second finished. Parallel dispatch is proven; a 3-wide fan-out is not, and the probe that reported it only counted greens — it never measured overlap. |

The smoke script is `scratchpad`-only and not committed: it costs real sub-agents, so it cannot be a
`npm test` check. What is committed is the pair of static guards above.

This closes the *loadability* half of G2 below. It does not close the run half — see G2.

## Two probes not run

**G2 — a full unattended run with zero prompts.** The grant half is proven by execution
(`npm run test:grant`, 9/9 real CLI sessions); the "a real `--unattended` run completes" half needs
a live feature, a live model and real money. Unproven.

**G6 — cost and wall-clock against a v1 baseline.** Needs two live runs of the same feature. The
Phase-0 baseline recorded here is structural (line counts, inventories, a green suite), not a run,
so there is nothing to compare against. **No number about v2.0's cost or wall-clock appears anywhere
in this repo** — the fan-out and the warm sub-agents are reasons to expect an improvement, not a
measurement of one.

## Provenance of `skills/tech-lead/workflows/shapeup-run.js`

It is the review's companion draft, `docs/output/shapeuprun.native.js`, adopted in Phase 2 and then
adjusted. **59 of the draft's 73 top-level identifiers carry across** (measured, not estimated; an
earlier revision of this section said "roughly forty" and understated it). Every one of the 14 that
did not is a rename (`R`→`KERNEL`, `QA`→`QA_REPORT`, `VERDICT_REFUTE`→`REFUTATION`, `gx`→`rs`,
`p`→`problems`, `scopeResults`→`settled`) or a deviation below. The carried set is every schema (`CMD`, `ORIENT`,
`PHASE_OK`, `MAPSCOPES`, `SCOPE_RESULT`, `EVAL`, `HAMMER`), the dispatch helpers (`worker`, `cmd`,
`nullFail`), the whole gate layer (`crossGate`, `TITLES`, `gateBlock`, `paused`, `aborted`,
`diedAt`), `validateArgs` and the model floor, `buildScope`, and the refute wave. The draft is why
the courier layer could be deleted in one commit rather than designed.

Six deliberate deviations, and the first two are the ones that matter:

| # | Draft | Shipped | Why |
|---|---|---|---|
| 1 | A phase is complete when the worker's report says `artifact_written: true` (lines 314, 336, 351, 371) | `requirePhase()` — the artifact is on disk, or the run aborts | The draft trusts a worker's own boolean. A WorkResult may legitimately report `escalated` with an empty artifacts list, which satisfies ingest; the run then walks to the next gate as though the phase landed, and every relaunch re-dispatches it. That loop is unbounded and was measured once already. Adopting the draft verbatim would have re-introduced it. |
| 2 | Drops `setRunStatus` and the state warnings entirely | Both kept, and the warning travels in the `RunReturn` | Those two writes failed silently for two entire runs — 46 dispatched agents with the ledger pinned at `orienting`. A headless stdout carries only the final message, so a diagnostic that only reaches `log()` is a diagnostic nobody can read. |
| 3 | `graphProbe()` is the fast-forward from the start, needing new `graph-query.mjs` + `graph-reduce.mjs` (`[ADD]`) | `probe resume` stays the fast-forward; the graph is additive, and answers the round's green-scope set | The plan sequences the graph into Phase 4, and Phase 2 was one change class. `probe resume` also has a 370-line structural fixture behind it that a wholesale replacement would have discarded. Both `[ADD]` scripts exist, folded into one `kernel/reduce/graph.mjs` — a reducer and its query, single-writer by file placement. |
| 4 | The per-phase graph append is FATAL | `advisory()` — it logs and the run continues | The graph is a projection of the artifacts. Making a projection fatal inverts which of the two is authoritative; `requirePhase` is the fatal check, and it reads the artifact. |
| 5 | `isolation: 'worktree'` on build legs (`[REQ]`, and the draft's own closing note says it is not actually wired) | Not used; disjoint substrates plus a pointer-free `sandbox-guard` are the isolation | A fresh worktree does not carry the gitignored `.shapeup/` run state every leg reads and writes, so it would break the legs it was meant to isolate. Stated in the Phase 3 commit rather than left as a `[REQ]`. |
| 6 | Two pipeline stages: build, then reduce | Three: check, build, **confirm** | The worker reports green; `probe t0` has to find the verdict artifact before the round believes it. Measured, not claimed — and it is the artifact the evaluator is required to cite. |

Plus: every script path re-routed through the kernel (Phase 1 postdates the draft), and
`args.maxParallelScopes` added, which the draft leaves to the runtime's own cap.

### Four defects in the draft the adoption fixed without recording it

The six above are choices. These are cases where the draft is simply wrong against the shipped
contract, found by comparing the two files field by field rather than by re-reading this section:

| Draft | Consequence had it been adopted verbatim |
|---|---|
| No reference to `args.noQa` anywhere (0 occurrences) — the QA gate branches only on `qaG.decision` | `--no-qa` is documented in AGENTS.md as the switch that skips the Hunt ("QA is a level-up, not a gate"). It would have been accepted and ignored. |
| GATE H payload is `{ feature: slug }` | `scope-hammer`'s census is "QA findings + discovered ledger + attempt-budget proposals". Two of its three inputs never reach it, so the cut list is drawn from a census that cannot see them. |
| No `report export` step | SHIP S.7 exports the run's records as fact tables under `.shapeup/exports/<run_id>/` before the trace is superseded. The run would ship without them. |
| Resume filter is `eval_rounds_done.includes(round) ? green_scope_ids : []` | `green_scope_ids` is not round-keyed, so a scope green in round 1 reads as green in round 2 and is skipped. The shipped file asks the graph for `green_scopes_by_round[round]`. |

### One thing the draft did that the shipped file deliberately does not

The draft appends the graph **per scope, inside the pipeline** (line 420), where the shipped file
appends once per round. That looks like lost resume fidelity and is not: `harness reduce graph` calls
`appendGraph` unconditionally before answering any query (`kernel/reduce/graph.mjs:368`), so the
round-opening `--subgraph run` re-derives from the T0 verdict artifacts on disk first. A kill
mid-BUILD is still recovered, and the round boundary is the only writer — which is what keeps
parallel legs from contending for one append-only file. The graph is derived, never authored; that
property is what makes the cheaper cadence safe.
