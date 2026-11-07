# Rounds — what a round is, and why the loop stops where it does

`probe next` sequences the build and evaluate steps; this file is the rationale behind the shape the kernel
derives, so a PO question about a round can be answered from it and a suspected defect can be recognised.
None of it is a procedure to follow: if the kernel's step disagrees with this file, report the disagreement
and stop.

## A round

A round is one build phase followed by exactly one evaluation. The feature is done when an evaluation returns
PASS.

| | round 1 | round r > 1 |
|---|---|---|
| Input | every scope contract | the bugs the last verdict filed, plus every criterion it graded FAIL |
| Builds | every scope, released as its dependencies settle | only the scopes those bugs and criteria are addressed to |
| Passing areas | n/a | never touched |

**Evaluation fires once per round**, and only when the round's build gate is not red: a feature that does not
build or launch has nothing for a judge to grade, and the gate's failing step is what round r + 1 fixes. It is
never called per task, inside the build, or over a partly built board.

**Regression rule (r > 1).** A fix changes code, and a fix can break what passed. So a fix round's evaluation
is the fixed bugs' criteria, plus a full re-run of the Test Surface rows of every use case a re-opened scope
touches, plus a cheap static completeness re-check. Untouched use cases are not re-run: re-probing everything
every round would turn a cheap end-of-round check into a full-suite tax. A spec with no Test Surface anywhere
degrades to bug-criteria-only, and the verdict says `regression coverage: none (no test surface)` — honest
reporting over a silent coverage claim.

**QA** runs once, after the first PASS and never after a FAIL: a build that has not passed conformance is not
worth edge-hunting. It discovers; it has no verdict and no score. Its findings stay `~` and carry over as raw
ideas unless the PO promotes one to a must-have, which costs one focused fix round over those items only.

**`--no-eval`** skips the evaluator. The run goes from the round gate straight to the census, with the verdict
`not-evaluated` recorded and a plain note that nothing was verified beyond each worker's own evidence checks.
It is never upgraded to a pass, and the shipped report refuses to say PASS over it.

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

## Why three breakers

```
OUTER    round_budget (max rounds)    — the six-week-timebox analogue; one per round, however many scopes
INNER    attempt_budget (per scope)   — one per T0 attempt; hitting the cap without a green trips THAT scope
                                        only, queued as a proposal for GATE H, never a hard stop
         no_progress_k (default 2)    — composed into the same breaker: attempts count attempts and cannot see
                                        that the last two produced nothing, so k consecutive non-`kept` trials
                                        queue the same proposal early
DEADLINE wall_clock_budget_s          — opt-in; elapsed seconds since the run receipt
```

Both event breakers count *events*, not time: neither can see that round 1 has been running for twenty-nine
minutes, so a run can burn its whole wall clock with both untouched — and a run killed from *outside* ships
nothing, not even the scopes already green. A breaker that trips from the inside routes to GATE H, where the
census compares the shippable subset against the baseline and ships what works. Same clock, different ending.

Nesting is deliberate: a struggling scope must not freeze the others, so only running out of *rounds* stops the
whole run. A scope that trips its inner breaker is still judged at GATE H like any cut candidate — never
silently dropped, never allowed to block scopes that are working. An attempt is spent only when the attested
channels say so (a dispatch receipt plus a leg row or a WorkResult); `probe attempts` derives it, and the round
loop and the census read the same derivation so they cannot disagree.

## What a worker cannot do

A worker has no port for "I cannot decide this": a WorkResult carries no escalation field. A phase that cannot
finish leaves no artifact, the kernel's post-condition fails, and the loop sends it back once and then stops,
naming the phase. Read the phase's result to find what it could not complete and resolve it yourself — amend the
spec, widen the scope contract, answer the ambiguity with the PO — then ask `probe next` again; only the
unfinished work is dispatched.

When a post-condition abort names an exit code other than 0 or 6 for `probe resume --require`, the check never
ran: an untrusted workspace or Claude Code's own permission classifier denied the call before the kernel
started, and neither leaves a row in the hook ledger. Verify the phase's artifact by hand before trusting the
abort. If it exists, the phase is done; run the remaining kernel commands one call at a time.
