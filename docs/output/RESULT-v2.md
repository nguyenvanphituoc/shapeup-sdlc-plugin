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
adjusted. Roughly forty identifiers carry across unchanged — every schema (`CMD`, `ORIENT`,
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
