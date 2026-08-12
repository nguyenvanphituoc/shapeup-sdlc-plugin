# Round Protocol

The orchestration loop in detail. A "round" is one BUILD phase followed by exactly one
EVAL phase. The feature is done when an EVAL round returns PASS.

> `tasks/_index.md` referenced throughout this file lives in the LOCAL gitignored root
> (`.shapeup/<slug>/tasks/`, v3.2), not the
> SHARED spec dir. See tech-lead SKILL.md GATE L1b for the bootstrap step that regenerates it
> when missing.

**On a spec with committed scope contracts, this loop is now CODE, not prose** —
`skills/tech-lead/workflows/shapeup-run.js`'s own `while (round <= args.budgets.maxRounds)` loop
implements exactly the shape below (PASS → ship; `max_rounds` exceeded → GATE H `breaker: outer`;
else the next round builds bugs only), with the EVAL-timing rule, the regression rule, and the
three-level breaker all enforced as branches in that script rather than described here for a model
to follow. Read that script's own comments for the mechanics; this file keeps the historical
rationale and the parts of the protocol the script does not cover (ESCALATE adjudication,
discovered-task reconciliation mid-BUILD — see its banner
for the full list) — and, unchanged, the loop below for a `--tiny` run or a spec with no scope
contracts, which `shapeup-run.js` is out of scope for by design.

```
round r = 1
loop:
    BUILD(r)                          # see r=1 vs r>1 below
    assert board 100% done            # GATE L2 — advisory: the hook warns, you decide
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
| Command | compile-order `--next` → task-executor `--order` → ingest, looped | compile-order `--task <id> --operation fix` → dispatch → ingest, per bug |
| Passing areas | n/a | never touched |
| SPIKEs | resolved first (they block) | only if a bug is a SPIKE finding |

Re-opening tasks in r>1: the fix order's WorkResult reports the task `partial` while failing
and `done` when re-verified; ingest-result flips the board accordingly. The board reflects the
churn so the next EVAL sees a green board again.

Discovered Tasks:
If WorkResults carry `discoveries[]` during BUILD, ingest-result appends them to the discovery
ledger (`.shapeup/<slug>/discovery/ledger.md`) and the build loop pauses after the current
tasks are done. Compile + dispatch a reconcile order (ba-pitch-analyzer, operation: reconcile).
This reconciles them into new tasks and invariants and updates the board; the tech lead bumps
`discovered_rounds` in harness-run.md, then routes back to GATE L1b (Board Review) for PO
approval of the new tasks and estimates before resuming the BUILD loop.

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
2. **max_rounds (OUTER breaker)** — r would exceed `--max-rounds` (default 3) without PASS →
   ESCALATE: print the residual bug list, the rounds used, and hand the decision to the PO
   (scope contracts present: also `/scope-hammer --breaker outer`). Do not start another
   build round automatically.
3. **attempt_budget (INNER breaker, scope contracts only)** — a single scope's T0 attempt
   loop exhausts `--attempts` (default 5) without reaching a trial that is both `kept` and
   T0-green, **or** `no_progress_k` consecutive trials come back non-`kept` (the stagnation
   term, default 2 — `compile-order.mjs` prints it as a JSON breaker object on stderr) →
   does NOT stop the round; queues a hammer PROPOSAL for GATE H and moves to the next scope
   in sequence. See "Three-level circuit breaker" below.
4. **wall_clock_budget (DEADLINE breaker, opt-in)** — elapsed seconds since the run receipt
   exceed `--wall-clock-budget` → do NOT start another build round or another scope; go
   straight to GATE H (`/scope-hammer --breaker deadline`). Checked with
   `scripts/budget-check.mjs` at every round boundary and enforced by `hooks/gate-deadline.mjs`,
   which denies a `task-executor` dispatch past the deadline while leaving `spec-evaluator`,
   `scope-hammer` and `qa-edge-hunter` reachable — a run past its deadline
   must still be able to judge, hammer, and close. Off unless configured.
5. **Hard error** — a sub-skill fails irrecoverably (e.g. spec folder gone, app won't
   build at all) → stop and report; do not retry blindly.
6. **User halt** — at any L-gate the user can stop the run; the ledger preserves state for
   `--from` resume.

## Three-level circuit breaker

```
OUTER    round_budget (max_rounds)  — the six-week-timebox analog. Decremented once per
                                       round at GATE L2, regardless of how many scopes it
                                       covered. Hitting 0 → GATE H immediately (§ above).
INNER    attempt_budget (per scope) — decremented once per T0 attempt inside BUILD round r.
                                       Hitting its cap WITHOUT a T0-green result trips the
                                       inner breaker for that scope only: the scope is queued
                                       as a hammer PROPOSAL (not a hard stop) and the round
                                       moves on to the next scope in the L1b sequence.
                                       no_progress_k (default 2) is COMPOSED INTO this same
                                       breaker rather than added beside it as a fourth budget:
                                       attempt_budget counts attempts and cannot see that the
                                       last two produced nothing, so k consecutive non-`kept`
                                       trials queue the same GATE H proposal early.
DEADLINE wall_clock_budget_s        — elapsed seconds since the run receipt. Opt-in; off
                                       unless set at L0. Tripping routes to GATE H with
                                       --breaker deadline. Enforced by hooks/gate-deadline.mjs.
```

**Why the third one exists — and it corrects an earlier diagnosis.** A run killed at an external
time cap looks like a stall from outside: no verdict, nothing to show. The natural reading is that
it hung at a gate. Often the transcript says otherwise — steady turns, steady writes, gate markers
advancing, zero stall signals. The run was working when the clock ran out.

Both existing breakers count *events*, not time: `round_budget` moves once per round,
`attempt_budget` once per T0 attempt. Neither can observe that round 1 has been running for
twenty-nine minutes, so a run can burn its entire wall clock with both breakers untouched. The
cost is not the missing verdict — it is that a run killed from *outside* ships nothing, not even the
scopes that were already green. A breaker that trips from the inside routes to GATE H, where
scope-hammer compares the shippable subset against the baseline and ships what works. Same clock,
different ending.
Nesting rationale (DD-9): a struggling scope should not freeze every other scope's progress
in the same round — only running out of *rounds* (the real six-week analog) stops the whole
run. A scope that trips its inner breaker still gets judged fairly at GATE H: scope-hammer
compares "ship without this scope" against the baseline, same as any other cut candidate — it
is never silently dropped, and it is never allowed to block scopes that ARE working.

## Isolated attempt loop — one T0 attempt, in detail (scope contracts only)

**This is `shapeup-run.js`'s inner per-scope loop, as code**, with one addition the prose below
never had: before opening a scope's attempt loop, the script checks whether THIS round already
has a green T0 verdict for that scope on disk, and skips it when it does — the resumability a
mid-BUILD kill needs, that a session narrating this loop from memory could never guarantee.

Whichever runs it, the loop is a **ratchet**: every attempt is scored against the last kept one,
and the working tree moves forward only when the score strictly improves. `t0-verify.mjs` makes
that decision and acts on the tree itself, inside the runtime — its caller reads the decision, it
never makes it.

```
compile-order --scope … --round N --attempt M
                                   → zero-memory WorkOrder (scope contract + this scope's
                                      tasks + digested errors + ledger decisions +
                                      trial_history: the last 8 trials for this scope, each
                                      with score, status, delta and top-3 digest, CROSSING the
                                      round boundary — compiled facts, no chat history by
                                      construction)
dispatch task-executor --order …   → code within substrate; WorkResult in results/
ingest-result <result>             → board/ledger writes
(a worker cannot escalate)         → WorkResult carries no escalates field. A phase that
                                      cannot finish leaves no artifact, the post-condition
                                      fails, and the run ABORTS naming the phase. Resolve it
                                      yourself and record the answer in round-ledger.md, which
                                      the NEXT attempt's fresh context reads back (DD-8).
t0-verify.mjs                      → fixtures + DB probe + (on green) seesaw, then scores the
                                      attempt against the baseline trial and snapshots or
                                      restores the tree. Branch on `status` from its stdout
                                      JSON — the tree action has ALREADY happened:
  kept      strictly better, INCLUDING red-but-improved (2/5 → 4/5 fixtures — the whole point
              of the ratchet). Tree snapshotted to refs/shapeup/<scope_id>/kept.
              overall=green → the attempt loop breaks; scope reaches DOWNHILL_EXECUTION.
              Still red → loop, and attempt M+1 now builds ON attempt M.
  reverted  not better — and a tie is not better. Tree already restored from the last kept
              snapshot. Subsumes the retired stash-and-retry branch: a FINISHED scope's broken
              fixture (PA5) raises score.regressions and reverts through this same rule, which
              is why seesaw runs before anything is declared green.
              rather than the code. Tree kept, baseline reset. Not a verdict, not a failure.
  crash     a fixture command failed to spawn or timed out; tree restored. Fix the fixture,
              not the code.
  (on any red, `discovered_tasks` carries the AEGIS {file, line, core_message} triples, which
   compile-order folds into the NEXT attempt's order as digested_errors — no separate dispatch)
```

**The exit code is not the branch selector.** `t0-verify.mjs` exits 0 on T0-green and 1 on
T0-red (2 on bad argv), mirroring the `oracles/*` convention — so a `kept` red-but-improved
attempt, the exact case the ratchet exists for, exits 1. Branch on `status` from the stdout
JSON; never on `$?`, and never wire this call into a `set -e` / `&&` chain that would read a
non-zero exit as "stop".

This replaces the old flat per-task loop for any scope that has a contract;
scopes/specs without one keep the v0.2.6 behavior verbatim (see BUILD(r) table above).

## --no-eval (skip evaluation)
A tech-lead judgment, surfaced at GATE L2: if the feature is clearly within what the model
builds reliably solo, the evaluator is optional overhead. With `--no-eval`, after GATE L2
the run goes straight to SHIP with verdict `not-evaluated` recorded in the ledger and a
clear note that nothing was verified beyond the build's own task-executor GATE D checks.

## Round-cost intuition
Build dominates; eval is cheap. Expect each EVAL round to cost a small fraction of a BUILD
round. This is why running eval once per round (not per task) is the right trade: you pay a
little QA at the end of each build and keep the expensive build coherent in between.

<!-- test requirement -->
kept|reverted|rebased|crash, decided in t0-verify.mjs decideStatus()
