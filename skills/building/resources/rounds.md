# Rounds — what a round is, and why the loop stops where it does

The phase table in `SKILL.md` is the procedure; this file is the rationale behind the shape of a round, so a PO question
about one can be answered from it. If a file on disk disagrees with it, report the disagreement and stop.

## A round

A round is one build phase followed by exactly one evaluation. The feature is done when an evaluation returns
PASS.

| | round 1 | round r > 1 |
|---|---|---|
| Input | every scope contract | the bugs the last verdict filed, plus every criterion it graded FAIL |
| Builds | every scope, released as its dependencies settle | only the scopes those bugs and criteria are addressed to |
| Passing areas | n/a | never touched |

**Evaluation fires once per round.** It is never called per task, inside the build, or over a partly built board. Before you
dispatch it, build and launch the feature yourself with the project profile's run command: a feature that does not build or
launch has nothing for a judge to grade, and the failing step is what round r + 1 fixes — skip the evaluation and go to the next
round with that failure as the bug.

**Regression rule (r > 1).** A fix changes code, and a fix can break what passed. So a fix round's evaluation
is the fixed bugs' criteria, plus a full re-run of the Test Surface rows of every use case a re-opened scope
touches, plus a cheap static completeness re-check. Untouched use cases are not re-run: re-probing everything
every round would turn a cheap end-of-round check into a full-suite tax. A spec with no Test Surface anywhere
degrades to bug-criteria-only, and the verdict says `regression coverage: none (no test surface)` — honest
reporting over a silent coverage claim.

**QA** runs once, after the first PASS and never after a FAIL: a build that has not passed conformance is not
worth edge-hunting. It discovers; it has no verdict and no score. Its findings stay `~` and carry over as raw
ideas for the next cycle. The census at GATE H weighs them against the baseline; nothing in the loop turns a hunt finding
back into a build round, so a finding the PO wants fixed now is a decision to stop the run and shape that fix.

**`--no-eval`** skips the evaluator: GATE L3 is crossed over the verdict `not-evaluated` with no judge dispatched, and a
plain note says nothing was verified beyond each worker's own evidence checks. It is never upgraded to a pass,
and the ship report says so in its first line.

## The attempt loop, per scope

Each attempt is scored against the last kept one, and the tree moves forward only when the score strictly
improves. `verify t0` makes that decision and acts on the tree itself; its caller reads the decision.

| `status` | Meaning | Tree |
|---|---|---|
| `kept` | strictly better, **including red-but-improved** (2/5 fixtures → 4/5 — the whole point of the ratchet). A tie on a GREEN score keeps too: a spec-conformance fix cannot raise a score already at full marks, and reverting it would discard the work a fix round exists to do | snapshotted; green ends the scope's loop, red loops and the next attempt builds ON this one |
| `reverted` | not better (a tie on a RED score is not) | restored from the last kept snapshot |
| `rebased` | the baseline was reset; not a verdict, not a failure | kept |
| `crash` | a fixture command failed to spawn or timed out — fix the fixture, not the code | restored |

**The exit code is not the branch selector.** `verify t0` exits 0 on green and 1 on red, so a `kept`
red-but-improved attempt, the exact case the ratchet exists for, exits 1. Read `status` from the JSON, never
`$?`, and never chain the call under `set -e` or `&&`. On any red, the digested errors fold into the next
attempt's order; no separate dispatch is needed.

## Why two breakers

```
OUTER    maxRounds (launch record)    — the six-week-timebox analogue; one per round, however many scopes
INNER    attemptBudget (per scope)    — one per T0 attempt; hitting the cap without a green trips THAT scope
                                        only, queued as a proposal for GATE H, never a hard stop
```

Both count *events*, not time. A run killed from *outside* ships nothing, not even the scopes already green; a breaker that
trips from the inside routes to GATE H, where the census compares the shippable subset against the baseline and ships what
works. Same budget, different ending.

Nesting is deliberate: a struggling scope must not freeze the others, so only running out of *rounds* stops the
whole run. A scope that trips its inner breaker is still judged at GATE H like any cut candidate — never silently dropped,
never allowed to block scopes that are working. An attempt counts only when the dispatch receipt attests it, and the receipt
is in `<run>/receipts/dispatch.jsonl`: a compiled order and a T0 verdict are both writable by the scope being judged.

## What a worker cannot do

A worker has no port for "I cannot decide this": a WorkResult carries no escalation field. A phase that cannot finish leaves
no artifact, and you stop the run at that phase, naming it. A worker that left its artifacts and no WorkResult is dispatched
again once, told its artifacts stand, and a result that fails the envelope check goes back once with the reason. Read the
phase's result to find what it could not complete and resolve it yourself — amend the spec, widen the scope contract, answer
the ambiguity with the PO — then dispatch again; only the unfinished work is dispatched.
