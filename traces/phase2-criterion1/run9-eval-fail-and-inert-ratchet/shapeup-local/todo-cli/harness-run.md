---
type: harness-run
feature: todo-cli
spec_folder: shapeup/todo-cli/spec/
lens: standard
eval_dimensions: [spec-conformance]
max_rounds: 2
attempt_budget: 3
wall_clock_budget_s: ~
auto_level: unattended
gate_answers: ci
lane: full
status: building
final_verdict: NO EVAL VERDICT — spec-evaluator never dispatched (blocked both rounds by kernel bug, see below)
rounds_used: 2
discovered_rounds: 0
deploy: ~
started_at: 2026-08-15T17:15:21.930Z
closed_at: ~
---

# Harness run — todo-cli

Opened by ``harness init run`` (GATE L0.1). The tech lead is the sole writer from here on.

## Rounds

| Phase | Round | Result | Duration | Notes |
|-------|-------|--------|----------|-------|
| Init  | —     | run opened | — | intake recorded, receipt written |
| ORIENT/ANALYZE/WIRE/MAP SCOPES | — | done | — | 6 scopes cut: foundation, add-todo, list-todos, complete-todo, remove-todo, cli-integration-test |
| BUILD | 1 | mixed | — | list-todos, cli-integration-test → T0-green. foundation 1/3, add-todo 2/4, complete-todo 1/4, remove-todo 1/4 fixtures — each got only 1 of 3 allotted attempts: `compile --attempt 2` failed schema validation (bug #2, below), not attempt-budget exhaustion |
| EVAL | 1 | **never ran** | — | `compile --operation evaluate --round 1` failed the same schema validation (bug #2) before spec-evaluator could be dispatched |
| BUILD | 2 | mixed | — | list-todos, cli-integration-test re-verified green (reverted/no-change). foundation/add-todo/complete-todo/remove-todo: `compile --round 2` failed identically for all four — no further attempts possible |
| EVAL | 2 | **never ran** | — | same compile failure; round_budget (2) then hit 0 → outer breaker → GATE H |
| GATE H | — | done | ~6.5m | scope-hammer census: 4 must-have carry candidates (foundation/add-todo/complete-todo/remove-todo), 0 ship-blocking (H1.2), 1 nice-to-have cut proposed (`npm test` dir-form MODULE_NOT_FOUND, pre-existing, unrelated to any fixture). Verdict text: "SHIP after fixing ship-blocking items" *(recharacterized in its own report: no product must-have is ship-blocking; the run's own mechanical certification is what's blocked — see Escalation below)* |

## Escalation — why this run stops here instead of closing SHIP

Two bugs in the shared harness plugin (`/Volumes/LibertyMobi/workspace/proj-harness-plugin`), both independently reproduced, blocked this run's own judge/verification pipeline — **not** the todo-cli feature itself:

1. **T0 fixture scoring bug** — `kernel/verify/t0.mjs:79` `runCommand` scores `pass: r.status === 0` unconditionally, with no parsing of fixtures whose own comment declares an intentionally non-zero expected exit (e.g. `# E_MISSING_TEXT, exit 1`). Every scope's error-path fixtures (required by idea.md: "behave sanely at the edges — bad index") exit 1 by design and can never score `pass` under this checker. Evidence: `.shapeup/todo-cli/t0/verdicts/r1-a1-t2.json` shows a fixture that exited exactly 1 as its own comment specifies, scored `pass: false`.
2. **compile-order producer/schema mismatch** — `kernel/probe/digest.mjs:73,78` legitimately emits `{file: null, line: null}` for location-less error signals (by design, per its own JSDoc). `skills/tech-lead/schemas/domain.schema.json:551-557` (`AegisTriple`) declares `file`/`line` as non-nullable string/integer, contradicting its own `description` field ("null/absent when the log line carried no location"). Any WorkOrder whose `trial_history`/`digested_errors` carries a location-less entry — i.e. any scope round 2+, and any `evaluate` order once round 1 has a red trial — fails to compile. This is why 4 of 6 scopes got exactly 1 of 3 allotted attempts, and why `spec-evaluator` was never dispatched in either round.

Net effect: `foundation`, `add-todo`, `complete-todo`, `remove-todo` are independently re-verified (by two separate agent dispatches, including a live re-run of every fixture command and test suite by GATE H's own agent) as AC-complete and spec-correct, but the harness's own mechanical gates (T0-green, spec-evaluator PASS) could never certify them — the certification tooling is what's broken, not the build.

**Per `references/gates.md` SHIP step S.1 ("confirm board green + latest eval verdict = PASS")**: this cannot be confirmed — no `EVAL-FEATURE-todo-cli.md` exists; spec-evaluator never ran. The `ci` gate-answers preset mechanically resolves `H → accept-cut-list` and `L4 → ship` (see Decisions log), but that resolution answers the *cut-list* and *sign-off* questions — it does not manufacture an EVAL verdict that was never produced. Per `references/protocol.md`'s stop conditions ("Hard error — a sub-skill fails irrecoverably → stop and report; do not retry blindly") and L0.7's own unattended definition ("stop only on PASS, max_rounds, or hard error"), the tech lead is stopping here rather than mechanically declaring SHIP over a missing judge pass. This is reported to the PO as an escalation, per the human GATE L4 in `SKILL.md` (distinct from the mechanically-resolved mirror row below).

## Decisions log

| Gate | Decision | Source | Note |
|------|----------|--------|------|
| H | accept-cut-list | preset:ci | Scope-hammer's cut list is accepted as proposed; baseline comparison still runs and is still recorded. Cut: `npm test` dir-form MODULE_NOT_FOUND (nice-to-have, pre-existing, unrelated to any fixture). No ship-blocking must-have found (H1.2). |
| L4 | ship (mechanical preset mirror only — NOT acted on) | preset:ci | Ship sign-off pre-approved by the ci preset's lookup table; the tech lead did not act on it because SHIP step S.1 (latest eval verdict = PASS) cannot be satisfied — no EVAL ever ran. Escalated to the PO instead; see Escalation above. |
