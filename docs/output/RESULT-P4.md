# Phase 4 — the run graph, closed

What the plan asked for, what shipped, and what closing it directly turned up. Companion to
`PLAN.md` §"Phase 4 — The run graph" and to `RESULT-P3.5.md`, which this phase was gated on: a graph
built over a system that could silently skip dispatching a scope would have been confidently wrong,
not just incomplete. That gate cleared before this phase started.

Executed via the repo's own `plan-executor` skill — an acceptance contract compiled from this
phase's text (plus its own §0 spec, which names `GateDecision` as part of the work-lineage family),
verified in a fresh clone, never against a run's own say-so. Branch `plan/phase4-run-graph`,
fast-forward merged into `v2` at `eae33f9`.

---

## 1 · What was already true before this phase started

Most of this phase's own text had already shipped, chronologically, before Phase 3.5 even closed
(commit `94acc4b`, "feat(graph): make the run's provenance a query instead of a grep",
2026-08-14 — Phase 3.5 closed 2026-08-19). Confirmed by reading the code directly, not by trusting a
commit message, before compiling this phase's contract:

| Item | Verdict | The evidence |
|---|---|---|
| `reduce` appends typed nodes/edges to `graph.jsonl` | **already shipped** | `kernel/reduce/graph.mjs`'s `project()`/`appendGraph()`, tested for DERIVED/IDEMPOTENT/BACKFILLED in `tests/structural/20-run-graph.mjs` |
| `--subgraph run` answers the fast-forward as a query | **already shipped** | `shapeup-run.js`'s BUILD round loop already calls `reduce graph --slug <slug> --subgraph run` and uses `green_scopes_by_round` to build the `alreadyGreen` set that skips completed scopes on relaunch — this **is** the kill/resume mechanism, wired, not stubbed |
| Migration shim for a v1 tree | **already shipped, by a simpler path than the plan described** | `appendGraph()`'s backfill is generic — `backfilled` is true whenever no graph exists yet, covering a genuine v1-vintage tree through the exact same code path as a fresh v2 run. No separate "probe falls back to a directory walk once" path was needed or built; there is no second implementation of the projection to drift from the first |
| `session-rehydrate` + `compact-snapshot` hooks retired | **already shipped** | Both files confirmed absent from `hooks/`; `README.md`, `tests/structural/03-hooks.mjs`, and `tests/structural/11-is-main.mjs` already document/assert the replacement |

## 2 · The one real gap, and what closed it

Gate crossings (⏸ L0…L4) were never durably recorded anywhere on disk. `kernel/gate.mjs`'s
`resolve()` computed a `ledger_row` string on every call but nothing wrote it — the only two hits
for `ledger_row` anywhere in the repo were its own construction and one test asserting the field is
present in the CLI's JSON *output*, never persisted. `shapeup-run.js`'s `crossGate()` called it and
branched on `exit_code`/`decision` but wrote nothing either. So `graph.mjs`'s `project()` — which
only ever reads artifacts already on disk — had nothing to project a gate decision from, and the
phase's own Done-when line ("…walk edges back to objective/plan/artifact/**T0/gate** in one query")
was unmet: no `GateDecision` node type existed anywhere.

| Item | Verdict | The evidence |
|---|---|---|
| Gate crossings not persisted | **fixed** | `kernel/gate.mjs` now appends every resolved crossing (`ok`/`ask`/`abort`) to `.shapeup/<slug>/gates.jsonl` — same tier, same append-only-JSONL shape as `trials.jsonl` (`verify/t0.mjs`) and `decisions.jsonl` (`hooks/dispatch-receipt.mjs`), one small file, one writer, best-effort so a ledger write can never fail a gate crossing |
| No `GateDecision` node in the graph | **fixed** | `graph.mjs` reads `gates.jsonl` and emits one `GateDecision` node per row, added to `WORK_NODES`. Keyed on gate id **+ occurrence ordinal**, not gate id alone — the same fix this file already applied once to a trial-id collision (four scopes' trials had been projecting onto two nodes before that fix), generalized correctly this time on the first attempt |
| Orphaned gate nodes | **avoided by design** | Each `GateDecision` is wired via `DEPENDS_ON` to its round's T0 `Verdict` node when one exists (L2/L3 — the gate that actually consults that verdict), else to the `Run` node, so no gate decision is ever unreachable |
| The reachability claim untested | **fixed** | `tests/structural/20-run-graph.mjs`'s one-line-test `want` map gained a literal `gate: "GateDecision"` entry; watched red first (the entry temporarily removed, confirmed `npm test` reports "never reached gate (GateDecision) — the invariant is still prose"), then restored and confirmed green — this repo's own standing method, applied here too |

## 3 · The live run (S3)

A genuine live run, executed inside exactly one dedicated `git worktree` — per the run's own
constraint on worktree concurrency — never the main tree, never a plain clone, torn down once
evidence was copied out.

Fixture: two scopes reused from the Phase 3.5 / S9 fixture (`env-parsing`, `schema-rules`), run with
`maxParallelScopes: 1` so BUILD dispatched sequentially — turning "kill after scope A is green,
before scope B has a result" into a condition observable by polling the filesystem rather than a
race against two concurrent legs.

```
kill        genuine kill -9 on a held PID, mid-round: env-parsing had a green T0 verdict and an
            ingested result on disk; schema-rules had a dispatched order and NO result yet
relaunch    a fresh claude -p process (new session id, no --resume) against the same
            .shapeup/envlint-s3/ tree; init run returned exit 3 ("already open") and read
            resume state rather than restarting from nothing
fast-fwd    the round-open graph query returned green_scopes_by_round: {"1": ["env-parsing"]} —
            alreadyGreen took the resumed:true branch for env-parsing; no new order, no new
            task-executor dispatch, no new T0 attempt for it anywhere in the relaunch
byte check  env-parsing's order and result: identical sha256 AND identical mtime, before-kill vs.
            after-relaunch — a re-dispatch would have changed at least one
trace       from schema-rules' own real, final green T0 verdict (verdict:envlint-s3:r1-a2-t1),
            `reduce graph --trace` (the shipped CLI, not the structural test's fixture) reaches TWO
            GateDecision nodes — gate:envlint-s3:L2:1 and gate:envlint-s3:L3:1 — both at hop 1,
            both DEPENDS_ON the verdict, both carrying round: 1 matching the verdict's own round
```

`models.exec`/`models.eval`/`models.qa` all `"sonnet"` throughout, confirmed against the run's own
`run-args.json`. Full evidence — `graph.jsonl` and `gates.jsonl` at-kill and after-relaunch, every
order/result, the byte-identity comparison, the full trace query output, both launches' native
per-dispatch journals, the EVAL report, and a `SUMMARY.md` walking all of it — is preserved at
`.plan-runs/phase4-run-graph/ledger/S3-live-run/` (gitignored; not shipped, not committed, kept as
the run's own record).

## 4 · A finding, surfaced rather than smoothed over

Reading the live run's own `gates.jsonl` turned up something the new instrumentation made visible
for the first time — it isn't new behavior, nothing could observe it before this phase gave gate
crossings a durable trace: **a relaunch re-crosses `L1a`/`L1a.5`/`L1b` a second time**, even though
those phases' actual *work* was correctly fast-forwarded, not re-dispatched. The orchestrator script
re-executes from the top on every fresh launch and calls `crossGate()` at each of those points
regardless of whether `probe resume`'s artifact-based fast-forward skipped the phase's work — so the
gate ledger now records two `proceed` rows for each of those three gates across one kill+relaunch.

Not a regression from this phase — `crossGate()` was already called at those points on every launch
before this phase existed; this phase only made the calls durable, which is what let the duplication
be seen at all. Doesn't affect this phase's own Done-when (specifically about BUILD-round dispatch,
proven correct above) or the `GateDecision` node design (keyed on occurrence ordinal precisely so
repeated crossings accumulate honestly instead of colliding or losing data). Left as a fact on
record for whoever next touches `kernel/probe/resume.mjs`'s phase-level fast-forward, or for a
long-running unattended run that relaunches many times: the gate ledger grows one row per relaunch
for every round-independent gate already crossed. No code changed for it here — out of this phase's
own scope, which was projection, not phase-resume semantics.

## 5 · Suite

| | Before this phase | Now |
|---|---|---|
| Structural checks | 1199 | **1200** |
| New structural assertions | — | 1 (`gate: "GateDecision"` reachability, inside the existing one-line-test in module `20`) |
| Files touched (source) | — | 4: `kernel/gate.mjs`, `kernel/lib/paths.mjs`, `kernel/reduce/graph.mjs`, `skills/tech-lead/workflows/shapeup-run.js` |

Confirmed independently after the fact, from a fresh clone with no agent involved: the same 1200,
every acceptance-table row re-run by hand and passing, the byte-identity and trace-query claims in
the live-run evidence read and cross-checked against their own captured files rather than trusted
from the summary alone.

## 6 · What's deferred, on purpose

- **`probe --check` comparing projections to the graph in CI** — named in the plan's own §3 risk
  mitigations, but not part of this phase's bullets or Done-when. Belongs more naturally to Phase
  7's verification gauntlet, which already plans to turn today's live probes into committed CI
  checks. Not attempted here.
- **`kernel/probe/resume.mjs`'s phase-level fast-forward** (ORIENT/WIRE/MAP-SCOPES) staying a
  directory walk rather than a graph query. Phase 4's Done-when is specifically about mid-BUILD
  kill/resume, which already routes through the graph; the phase-level check is a reasonable,
  defensible choice as-is (simple existence checks, not the multi-file provenance-grep problem the
  graph solves) — see §4 for the one place this leaves a visible seam.

Phase 5 — hook diet & enforcement honesty — is next; nothing in it is gated on anything this phase
found.
