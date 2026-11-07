# Execution record — the native-first plan

| | |
|---|---|
| **Date** | 2026-11-08 |
| **Plan** | [`plan-2026-11-07-native-first.md`](plan-2026-11-07-native-first.md) |
| **Branch** | `plan/single-loop`, local commits only; nothing pushed |
| **Baseline** | 4.0.0 at `82b4da9`; `npm test` green (2512 checks); `npm run demo` verified |
| **Rule** | A stage is done when its real run shipped with the baseline gate rows, not when the suite is green. A gate that cannot be run is recorded here as unmet |

## S1 — deletion manifest, corrected by the caller map

The plan's S1 table was written from a CLI-string caller count. Reading the import graph (a walk over
every `import` in `kernel/`, `hooks/`, `bin/`) shows that several "unread" verbs are libraries other
modules import. The plan's estimate (kernel −4,600 lines) overcounted; the manifest below is what the
tree supports.

| Target | Evidence | Decision | Emitters and claims that change in the same commit |
|---|---|---|---|
| `reduce graph` (482) | no importer; emitted advisory at the ship step in `probe/next.mjs`; written by nothing else | **delete** | the `next.mjs` step; `hill-chart` stops calling it and renders from the hill shards; AGENTS.md run-graph paragraph |
| `report export` + `report/facts` (619) | imported only by `probe/resume.mjs` `closeRun` | **delete** | `closeRun` stops exporting; AGENTS.md export claims; V4-REQ-3 and V4-REQ-8 reworded to the leg ledger |
| `probe stats` (158) | no importer | **delete** | comments in `hooks/lib/decision.mjs`; AGENTS.md hook-ledger sentence |
| `verify trace` oracle (≈540 of 604) | `parseRequirements` and `coveredReqIds` are imported by `verify/spec.mjs` and `probe/requirements.mjs`; the rest (reachability, mermaid, `traceLint`) has no other caller | **delete the oracle, keep the two parsers** in `lib/` | three advisory steps in `probe/next.mjs`; AGENTS.md traceability-oracle lines; the `trace/report.json` mention |
| `probe digest`, `probe leg` | imported as libraries by `verify/t0`, `verify/build`, `compile`, `probe/attempts`, `probe/next` | **drop the CLI verb only**; the plan's "0 callers" counted the verb, not the module | `ROUTES` |
| `probe requirements` (328) | imported by `probe/eval`, `probe/next`, `reduce/ship`; read by the L4 block, the census and `/hammer` | **keep** — the plan row was wrong; it already has named readers (V4-REQ-12 is met) | none |
| `reduce hill` + `hill-chart` | `reduce hill` is the only writer of the committed hill shards behind the "hill phase is mechanical" invariant | **keep** (provisional decision, recorded here because the PO cannot be asked mid-run: Hill Chart is Shape Up's signature artifact) | `hill-chart` reads shards only |
| `gate-zerowork.mjs` (316) | 58 `allow`, 0 `block` across every ledger on file (`traces/`, consumer run) | **delete** | `hooks.json` Stop entry; AGENTS.md "stopping a run with no receipt"; the `building` skill's Stop-hook sentence; SECURITY.md and `docs/design/03` hook lists |
| `tier-guard.mjs` (162) | 37 `allow`, 0 `deny` | **fold into `sandbox-guard`** — the tier-direction refusal is a shipped claim, so the behaviour stays | `hooks.json`; hook lists in the docs |

Corrected expectation for S1: kernel and hooks −≈2,200 lines, not −5,100.

An earlier tally in `analysis/03` and `analysis/04` counted only `deny` verdicts. The Stop hook records
`block`; the recount (`grep '"verdict":"block"'` over the same ledgers) is zero, so the finding stands.

