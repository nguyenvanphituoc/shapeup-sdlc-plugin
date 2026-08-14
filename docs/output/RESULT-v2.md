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
