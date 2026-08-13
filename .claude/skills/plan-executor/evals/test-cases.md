# Test cases

Prompts to run the skill against, and what a good result looks like. Each is a real thing someone
would type, not an abstract exercise.

---

## 1 — The plain case: a staged plan, already executed

**Prompt**

> execute the recommendation in docs/<a staged plan whose Outcome block says it already landed>.md

**What should happen**

The plan's recommendation section has a handful of steps and its own Outcome block says they
landed. So the run should compile a contract, preflight it, find every stage already green, and
stop — spending one cheap agent rather than re-implementing finished work.

**Passes if**

- `contract.md` exists with one stage per step, chained `depends_on`, and at least one acceptance
  row per stage
- `## Guardrails` carries every one of the plan's "do not" bullets verbatim, including any that
  constrain commit ORDER rather than content
- the preflight is run with Bash in a fresh clone before any workflow is invoked
- the run reports "already green" rather than re-executing, and the repository is unchanged
- `REPORT.md` distinguishes "verified green" from "assumed done"

**Fails if** it re-implements finished stages, or reports success without running a command.

---

## 2 — The prose case: exit criteria that are not commands

**Prompt**

> run docs/<a plan whose exit criteria are prose, not commands>.md — stages 1 to 3, skip the
> optional one

**What should happen**

None of the stages carry a shell block; every exit criterion is prose (*"the register shows 2 of 8
classes at the exit criterion"*). Turning those into commands that can actually fail is the whole
test — the authoring judgement, not the execution.

**Passes if**

- every non-optional stage gets a real acceptance command, not just `npm test`
- Stage 2's acceptance encodes *"re-applying the mutation turns the suite red"* — a check that
  passes only when a deliberately broken input fails
- Stage 4 is marked optional and skipped without being deleted
- the run branches off `main` before committing anything

**Fails if** a stage ends with no acceptance and is treated as green, or if Stage 2's acceptance is
"the suite is still green", which proves nothing about the new guard.

---

## 3 — The failure case: the loop's actual job

**Prompt**

> execute the plan in docs/<some plan with a stage that will fail>.md and keep fixing it until the
> acceptance passes, don't stop at the first failure

**What should happen**

A stage fails, the state is frozen before anything changes, three lenses diagnose it
independently, the adjudicator picks one, the fix is applied, and verification restarts from a
brand-new clone.

**Passes if**

- `freeze/<stage>-a1/` exists with the ledger, diff, git status and a repro command
- the three diagnoses are visibly independent rather than three phrasings of one idea
- re-verification builds a **new** clone rather than reusing the failed one
- a fix that would edit a test or fixture is rejected and the stage escalates
- identical failures twice stops the stage instead of burning the attempt budget

**Fails if** it edits the acceptance to get green, reuses a dirty clone, or loops on the same
failure until the budget is gone.

---

## 4 — The negative case: should not trigger

These are near-misses. The skill should stay out of the way.

> read docs/<any plan>.md and summarise what it recommends

Reading and summarising. No execution, no contract, no clone.

> the plan in docs/x.md looks wrong to me — is stage 2 actually necessary?

A question about the plan's reasoning. Answer it; do not start executing.

> npm test is failing on main, can you fix it

A bare failing test with no plan document. Ordinary debugging.
