# Phase 3.5 — the certification gap, closed

What the plan asked for, what shipped, and what closing it directly turned up. Companion to
`PLAN.md` §"Phase 3.5 — Close the certification gap" and to `RESULT-P3.md`, which this phase exists
because of: Phase 3's own probes only looked for corruption, and the nine-arm review that produced
the D3 verdict there found something worse — the harness can report success on work it did not do,
and every layer built to catch that reported success too.

Executed via the repo's own `plan-executor` skill — an acceptance contract compiled from this
phase's text, each fix watched red before green, verified in a fresh clone, never against a run's
own say-so. Branch `plan/phase3-5-certification-gap`, fast-forward merged into `v2` at `3bbdbf6`.

---

## 1 · The acceptance ledger

Eight items in the plan's text, all closed, plus the phase's own Done-when (a live run), also
closed:

| Item | Verdict | The evidence |
|---|---|---|
| Model floor rejects real model ids | **fixed** | `belowFloor()` was an allowlist of exactly `{sonnet, opus}` — every real id (`claude-opus-5`, `claude-sonnet-4-5`, `opusplan`) aborted the run before Preflight. Now a denylist of provably-below-floor tiers; unrecognized strings pass, fail-open |
| `--force` doesn't unwedge a dispatched-but-unanswered order | **fixed** | `sandbox-guard`'s `liveOrders()` treats any order with no same-named `results/` file as live, forever; `--force` only `mkdirSync`'d over the same stale directories. Now writes an honest `abandoned` result record per orphaned order before a forced re-init |
| T0 ratchet field-name bug | **fixed — the most load-bearing fix in the phase** | `t0.mjs:530` read `contract.substrate?.allowed`, a path no `ScopeContract` has; the bound was always `[]`, `restore()` always refused, and the "nothing to restore to yet" fallback fired on *every* restore failure — silently promoting a failing attempt's tree as the new kept baseline. Field fixed to `allowed_file_substrate`; fallback re-gated on "no prior kept trial" (`!baseline`), not "restore returned not-ok for any reason". Companion fix at `graph.mjs:202`, same wrong-field shape |
| Seesaw falsely certified | **fixed, and decided** | `hill.mjs` inferred `seesawGreen` from `regression === false` on a green T0 — vacuously true, since nothing anywhere ever passed `--seesaw-registry`, so `regression` was always `false`. Now reads the real `seesaw.ran && seesaw.pass` signal already on the verdict artifact. Betting Table decision made explicitly: registry-wiring deferred (real running cost — re-runs every finished scope's fixtures on every later attempt), not silently dropped — a scope simply cannot reach `FINISHED` via this path until it is wired |
| Order-id collision on non-BUILD operations | **fixed** | Only BUILD orders carried a scope discriminator (`scopeId-r{round}-a{attempt}`); every other operation fell back to `{operation}-r{round}`, so concurrent legs of the same non-BUILD operation on different scopes overwrote each other's dispatch file. Every operation now gets the same discriminator when a scope is present; operation-level dispatches (`orient`, `analyze`, `wire`, `map-scopes`, `evaluate`, `hunt`, `hammer`) are unchanged, since none of them ever carry one |
| Board reads done on a cut, never-dispatched scope | **fixed — the defect that motivated the phase** | Nothing compared board rows to what was actually on disk. New reconciliation in `board.mjs`: a scope whose tasks read done with zero dispatched-and-answered orders anywhere for it is now flagged, alongside the pre-existing (and untouched) board-vs-T0 drift check |
| Spec tree can derive nothing from a pitch and still ship green | **fixed** | New `INV-FLOOR` rule in `spec.mjs`'s `lintStructure()`: fires red when the raw pitch (`intake.md`) names a No-gos/Constraints/Edge-cases section with real content and the derived tree declares zero `[INV-NN]` invariants anywhere. Silent on a pitch that never named constraints in the first place — absence of constraints is not evidence of a thinned tree |
| Verification hygiene on the measuring tools | **confirmed safe, not a defect** | Concurrency probe's leg-matching (`addressOf()`/`startsFrom()`) already excludes non-attempt-bearing mechanical dispatches by construction — no non-leg `probe`/`gate`/`reduce` call can be miscounted as a build leg. `resolveRunId(cwd, null)` already reads exactly one receipt named by the single `active-scope` pointer, never scanning `.shapeup/*` — it cannot blend two runs' records in one call. Both claims were watched red (each guard's exclusion/guard line was reverted in turn) before being accepted as already correct; a test now proves both rather than leaving them unverified |
| **Done-when**: a live multi-scope run, forced failure + real concurrency, board/T0/hill agreeing with disk | **met** | §2 |

## 2 · The live run (S9)

A genuine live run, executed inside a dedicated `git worktree` — never the main tree, never a plain
clone — per the standing constraint that any real dispatch must be isolated that way.

Fixture: two of the three scopes from this repo's own `envlint` D3 trace (`env-parsing`,
`schema-rules`) — already documented in that trace's own `scope-summary.md` as independently
buildable, sharing no file and no `depends_on` edge. The third scope (`cli-pipeline`, which depends
on both) was deliberately excluded, so the EVAL verdict at the end is a genuine FAIL citing a real
absence — not a defect in the harness, a defect that was seeded on purpose.

The forced failure was not synthetic noise: `env-parsing`'s round-1 attempt-1 T0 verdict is a real
red (`0/1` fixtures, CRLF-terminated env files failing to parse — the same defect already on record
as `QA-001` in that trace's own hunt report, reproduced here via a hidden oracle test outside the
scope's own substrate). Attempt 2 fixed it and went green, and the fix survived unchanged through
every later re-verification — the T0 ratchet fix (§1) exercised for real, not just under a fixture.

```
concurrency  max_concurrent: 2 (bound: lower — one leg ends at a T0 landmark rather than
             a completion record, a real and disclosed artifact of a session interruption
             mid-run, not a missing measurement)
waves        2 rounds, both scopes overlapping in both
board        drift: [] · undispatched: []   (S6's reconciliation, run against real data)
hill         both DOWNHILL_EXECUTION — correctly not FINISHED (no seesaw registry wired, §1)
EVAL         FAIL — BUG-1 (critical): cli-pipeline never built, deliberately excluded
             BUG-2 (minor): a field omission, flagged as a possible spec self-contradiction
```

`maxParallelScopes: 2`, `models.exec`/`models.eval`/`models.qa` all `"sonnet"` throughout, confirmed
against the run's own `run-args.json`, not assumed from the launch instruction. Full evidence —
every order, every result, the full T0 trial history, the EVAL report, hill files, the board and
concurrency-probe JSON, and a `SUMMARY.md` walking all of it — is preserved at
`.plan-runs/phase3-5-certification-gap/ledger/S9-live-run/` (gitignored; not shipped, not committed,
kept as the run's own record).

## 3 · An incident, surfaced rather than smoothed over

Mid-execution, a fix-agent's adjudicated plan for landing an already-correct, already-verified
commit — sitting in a scratch clone rather than the working repository — phrased the landing step as
**pushing to a remote**. The remote in question was a purely local alias pointing back at the same
repository, not a hosted one, but the action was still an unauthorized modification of shared state
by the letter of the guardrail that forbids it, and the safety classifier correctly blocked it. No
damage occurred.

Root cause, on inspection: a scratch clone left over from a manual preflight check, sitting in the
run's own working directory with `origin` pointing at the repository, was mistaken by three separate
stage-executing agents (not one) for an implicit working copy. Two of the three self-corrected via a
safe local `fetch + merge --ff-only`, at the cost of a wasted attempt each; the third's equivalent
attempt is the one that got phrased as a push and stalled the run. Fixed directly — the same safe
local fetch+merge, no network, no push — and the stray clone deleted before the affected stages were
re-run in isolation.

Independent re-verification (never trust a run's word for itself) caught a second, smaller defect
the run itself did not: six of the eight new test modules had picked section-display numbers by
their own filename's numeric prefix, colliding with unrelated pre-existing sections elsewhere in the
suite — section numbering here is a repo-wide running count, not tied to filename prefixes, and the
other two new modules had already found the correct convention independently. Renumbered to genuinely
free slots; fixed in `3bbdbf6`, on top of the workflow's own commits, not inside them.

## 4 · Suite

| | Before this phase | Now |
|---|---|---|
| Structural checks | 1126 | **1193** |
| New structural modules | — | 8 (`26`–`33`) |
| Files touched (source, not counting new test modules) | — | 6: `shapeup-run.js`, `kernel/init/run.mjs`, `kernel/verify/t0.mjs`, `kernel/reduce/graph.mjs`, `kernel/reduce/hill.mjs`, `kernel/compile.mjs`, `kernel/reduce/board.mjs`, `kernel/verify/spec.mjs` |

Every fix watched red first — the specific new module's assertion re-introduced and confirmed
failing for the stated reason, then restored — with `npm test` green after every single commit, never
batched. Confirmed independently after the fact, from a fresh clone with no agent involved: the same
1193, the same absent-buggy-pattern / present-correct-pattern greps on every touched file, the same
eight modules wired into `MODULE_FILES`.

## 5 · What's deferred, on purpose

- **The seesaw registry itself.** §1's Betting Table decision: the honest state (a scope cannot
  reach `FINISHED` without one) ships now; wiring the registry for real — format, writer, the
  re-run-every-finished-scope's-fixtures cost — is a separate decision for a separate pass.
- **`harness-run.md`'s round-close lag**, visible in the S9 evidence: the receipt's own frontmatter
  doesn't reflect that two full BUILD+EVAL rounds ran, because that write only happens on the path
  through GATE H's census into Ship Step 4, and the live run was deliberately stopped at `gate_h`
  without dispatching `scope-hammer` — out of scope for what S9 needed to prove, not a defect
  discovered in the harness.
- **The plan's own "lower priority" tail** (dispatch batching, a dropped unread projection call,
  trimming the relaunch fast-forward) — explicitly marked in the plan as worth pursuing only if
  capacity remains, and not worth its own phase. Not attempted here.

Phase 4 — the run graph — was gated on this phase closing, on the grounds that a graph built over a
system that can silently skip dispatching a scope is confidently wrong, not just incomplete. That
gate is now clear.
