# Round Protocol

The orchestration loop in detail. A "round" is one BUILD phase followed by exactly one
EVAL phase. The feature is done when an EVAL round returns PASS.

```
round r = 1
loop:
    BUILD(r)                          # see r=1 vs r>1 below
    assert board 100% done            # GATE L2 — hard precondition for EVAL
    verdict, bugs = EVAL(r)           # ONE spec-evaluator --feature pass
    if verdict == PASS:
        SHIP; break
    if r >= max_rounds:
        ESCALATE(bugs); break         # honest stop — no infinite loop
    r = r + 1                         # next round builds bugs only
```

## BUILD(r) semantics

| | r = 1 (initial build) | r > 1 (fix build) |
|--|----------------------|-------------------|
| Input | the whole task board | the bug list from EVAL(r-1) |
| Scope | every ready task, dependency/layer order, until board all ✅ | only the tasks/areas named by bugs |
| Command | `task-executor --next` looped to completion | `task-executor --task <id> --force` per bug |
| Passing areas | n/a | never touched |
| SPIKEs | resolved first (they block) | only if a bug is a SPIKE finding |

Re-opening tasks in r>1: set the affected task `status: in-progress`, fix, re-close via
task-executor GATE E. The board reflects the churn so the next EVAL sees a green board again.

## The EVAL timing rule (the core constraint)

EVAL fires **once** per round and **only** when GATE L2 has confirmed the board is 100% done.
It is never:
- called per task,
- called inside the BUILD loop,
- called on a partial board.

## Regression rule (r > 1) — QA-meeting Bước 1c

A fix round changes code; a fix can break what passed. Therefore EVAL(r>1) scope is **not**
just the fixed bugs:

```
EVAL(r) for r > 1:
  touched_UCs = every UC referenced (use_case_refs) by a task re-opened in BUILD(r)
  scope = fixed bugs' criteria
        + FULL re-run of `## Test Surface` rows for every touched UC
          (test-surface-conformance dimension, when active)
        + completeness re-check (cheap, static)
  untouched UCs' surfaces: NOT re-run (their code didn't change; re-probing everything
  every round would turn cheap end-of-round QA into a full-suite tax)
```

Pre-v2.9 specs (no Test Surface anywhere): the rule degrades to bug-criteria-only, as
before — and the verdict report notes `regression coverage: none (no test surface)`.
Honest reporting over silent coverage claims.

## QA edge hunt (post-PASS, pre-ship)

When EVAL(r) returns PASS for the **first** time in a run, the orchestrator delegates one
`/qa-edge-hunter` pass before SHIP (skippable via `--no-qa`, same spirit as `--no-eval`).
QA is a pure worker: no verdict, no score, no gate — it writes `~` findings to
`discovery/ledger.md` and a `qa/hunt-report.md`. Triage happens at SHIP/GATE L4:
- all findings stay `~` → SHIP; findings carry over as raw ideas (debt-free).
- PO/TL promote any to must-have → a fix round r+1 (those items only) → EVAL
  `--single-pass` on them → `/qa-edge-hunter --recheck` (re-probe ONLY the promoted items;
  never a second full hunt) → back to L4.
- Circuit breaker applies: out of rounds/appetite → ship with `~` findings recorded.
QA never runs on a FAIL round — a build that hasn't passed conformance isn't worth
edge-hunting yet.

Rationale (from the long-running harness work): a single end-of-round QA pass over the
running feature is cheap relative to the build (minutes vs hours) and catches the
last-mile defects, whereas grading every task multiplies evaluator cost for little gain
once the generator is competent. If the build round didn't finish, there is nothing
coherent to evaluate yet.

## Stop conditions
1. **PASS** — EVAL(r) verdict is PASS → SHIP.
2. **max_rounds** — r would exceed `--max-rounds` (default 3) without PASS → ESCALATE:
   print the residual bug list, the rounds used, and hand the decision to the PO. Do not
   start another build round automatically.
3. **Hard error** — a sub-skill fails irrecoverably (e.g. spec folder gone, app won't
   build at all) → stop and report; do not retry blindly.
4. **User halt** — at any L-gate the user can stop the run; the ledger preserves state for
   `--from` resume.

## --no-eval (skip evaluation)
A tech-lead judgment, surfaced at GATE L2: if the feature is clearly within what the model
builds reliably solo, the evaluator is optional overhead. With `--no-eval`, after GATE L2
the run goes straight to SHIP with verdict `not-evaluated` recorded in the ledger and a
clear note that nothing was verified beyond the build's own task-executor GATE D checks.

## Round-cost intuition
Build dominates; eval is cheap. Expect each EVAL round to cost a small fraction of a BUILD
round. This is why running eval once per round (not per task) is the right trade: you pay a
little QA at the end of each build and keep the expensive build coherent in between.
