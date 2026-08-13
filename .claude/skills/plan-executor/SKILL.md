---
name: plan-executor
description: >
  Execute a staged plan document end to end — compile its recommendation into an acceptance
  contract, implement each stage, verify every one in a fresh git clone, and on failure freeze the
  evidence, diagnose it from three independent angles, apply the best admissible fix and re-verify
  from a clean state, looping until the plan is green or the budget runs out. Use this whenever the
  user points at a plan, review, report, ADR, design doc or issue and asks to "execute it", "run
  this plan", "make this happen", "carry out the recommendation", "do §6", "make the acceptance
  tests pass", or "keep fixing and re-running until it's green" — including when they just paste a
  path to a document with a staged recommendation and say go. Also use for long unattended runs
  that must survive usage limits and resume, and for any request to auto-fix failures found while
  executing a plan rather than stopping at the first red. If no plan document exists yet, produce
  one first with the architecture-research-report skill, then execute it with this one.
---

# Plan executor

A plan of this kind — an architecture-research-report with a staged §6, a review with a
recommendation, an ADR with a migration sequence — is already most of a machine-executable
specification. It has ordered stages, an exit criterion per stage, and usually a section saying
what _not_ to do. What it lacks is a runtime that will not let itself be talked out of the exit
criteria. That is what this skill adds.

## The one rule everything else serves

**Progress is derived by re-running acceptance, never claimed by whoever did the work.**

A stage is done because a command exited as the contract said it would, in a clone that has never
seen this run's working tree. Not because an agent said so, not because a prior session's notes say
so. Everything else here — why the contract is a separate file, why the clean room is a fresh
clone, why a fix that edits a test is rejected, why resuming is cheap — follows from that one rule.

It is also the rule these plans were written about. Day 1's finding was a repository that read
green while a clone of it failed four checks, because the fix lived in an uncommitted working tree.
Day 2's was a register that would happily accept a fabricated reduction, because the rule against
it was prose. A harness that executes those plans and then reports success on its own say-so has
learned nothing from either.

## Phase 0 — Find the plan, or make one

You need a document with a staged recommendation. If the user named one, read it whole before
anything else — the stages, the exit criteria, the "what not to do" section, and the falsifiers.

If there is no such document, stop and produce one with **architecture-research-report** first. It
writes exactly the shape this skill consumes: a §6 that is staged, sequenced and costed, a §5 of
prohibitions, a §7 of what would change the answer. Executing an unstaged wish is how a run ends up
optimising something nobody agreed to.

If the document exists but its recommendation is one undifferentiated paragraph, say so and offer
to stage it. Do not silently invent stage boundaries; the ordering in these plans is usually
load-bearing.

## Phase 1 — Frame the run

Three things, all cheap, all worth doing before any model spends anything.

**Branch.** These runs commit. Never run on the default branch — create `plan/<slug>` and work
there, so the whole run is one `git checkout` away from undone.

**Workspace.** `.plan-runs/<slug>/`, inside the repository, gitignored (add `.plan-runs/` to
`.gitignore` if it is not there). Not the scratchpad: that is session-scoped, and a run parked
overnight for a usage window resumes in a different session.

```
.plan-runs/<slug>/
├── contract.md        the acceptance contract — the only thing that decides "done"
├── ledger/*.md        one per verification: what ran, what it exited, what it printed
├── freeze/<stage>-a<n>/  the failing state, preserved before anything touched it
├── clones/            disposable clean rooms
├── REPORT.md          the handoff
└── RESUME.md          written only when parked
```

**Check the plan is still worth executing.** If it was written against an older HEAD, look at
whether its §7 falsifiers have fired. A plan whose premise expired is a plan to re-open, not to
run.

## Phase 2 — Compile the contract

Read `references/contract-format.md`, then write `<workdir>/contract.md` from the plan.

This is a reading task and it is yours, not a subagent's: you have the plan in context and the
judgement calls are small but consequential. For each stage in the plan's recommendation:

- Copy its instructions into the stage section **verbatim**. Not a summary. The agent that
  implements it sees this and the acceptance rows, nothing else, and a summary is where the detail
  that mattered goes missing.
- Copy the plan's `Exit:` line into `**Exit criterion:**`, then turn it into one or more acceptance
  rows. `references/contract-format.md` has the table of weak-versus-meaningful rows; the short
  version is that `npm test` exiting 0 also passes on a suite that silently ran 790 of the 1244
  checks it was supposed to.
- Copy the plan's "what deliberately not to do" bullets into `## Guardrails` verbatim. These bind
  the fixing agents later, and paraphrasing them is how a prohibition loses the clause that made it
  one.
- Chain `depends_on` to the previous stage unless the plan says otherwise, and mark optional
  stages optional.

Record `plan_sha256` so a later run can tell the plan has drifted underneath the contract.

## Phase 3 — Self-check before spending anything

Walk the contract yourself and refuse to start if any of this is true:

- **A non-optional stage has no acceptance command.** It would be marked green by default. This is
  the single check worth more than the rest of the run.
- **A row still carries a `review` note.** It cannot run as written — most often a command copied
  from the plan that clones its own repository, when the harness has already put you inside a clone.
- **Acceptance writes outward.** No `git push`, `npm publish`, `gh pr create`. Checks read.
- **`fresh_state: head` with `commit_per_stage: false`.** Acceptance would never see the work.
- **The plan's own ordering constraints are missing from `## Guardrails`.** Day 1's plan says
  wiring §48 first takes a clone from 4 failures to 10. A run that has not been told that will
  discover it the expensive way.

Then run the acceptance yourself, with Bash, in a clean room:

```bash
CLONE=.plan-runs/<slug>/clones/preflight
rm -rf "$CLONE" && git clone --local --no-hardlinks --quiet . "$CLONE" && cd "$CLONE"
[ -f package.json ] && [ ! -d node_modules ] && npm install --silent --no-audit --no-fund
# then every row of the acceptance table
```

This costs no model tokens and answers two questions at once: whether the commands actually run,
and how much of the plan is already done. On a resumed run it frequently answers "most of it".

## Phase 4 — Run the workflow

`workflows/execute-plan.js`, invoked by path. It needs the control-flow facts only; the agents read
`contract.md` for everything else, so there is no second copy of the plan to drift.

```
Workflow({
  scriptPath: ".claude/skills/plan-executor/workflows/execute-plan.js",
  args: {
    repo: "<absolute repo path>",
    workdir: "<absolute>/.plan-runs/<slug>",
    contractPath: "<absolute>/.plan-runs/<slug>/contract.md",
    stages: [ {id:"S1", title:"…", depends_on:[], optional:false}, … ],
    freshState: "head", commitPerStage: true,
    attemptBudget: 3, noProgressRounds: 2, reserveTokens: 60000,
    executeModel: "sonnet", diagnoseModel: "fable", verifyModel: "sonnet"
  }
})
```

Per stage it runs: **execute → verify in a fresh clone → (on red) freeze → three diagnoses → an
adjudicator → fix → re-verify**, until green, until the attempt budget is spent, or until two
attempts produce an identical failure.

**Why three diagnoses and an adjudicator rather than one debugger.** The three lenses are
_what changed_, _what the check actually asserts_, and _what the plan forbade_. They are blind to
each other on purpose — a single agent that has already decided the bug is in the diff will keep
finding it there, and the third lens exists because in plans of this shape the failure was often
predicted in §5 and the run simply did it in the wrong order.

**The rejection rule is the load-bearing part.** Every diagnosis must declare whether its fix would
alter, relax, skip or delete an acceptance command or what it exercises. If it would, the
adjudicator must reject it, and if all three are inadmissible the stage escalates to you rather than
proceeding. A run that reaches green by editing its own acceptance has produced nothing, and this is
the mechanism that makes that outcome unreachable rather than merely discouraged.

### Model policy

| Job                                           | Model    | Why                                                                                                                                               |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implement a stage, apply a fix                | `sonnet` | Real code changes against a spec — the floor for work that gets committed. Raise to the session model for a stage the plan itself calls hard.     |
| Diagnose a failure, adjudicate, break a stall | `fable`  | Where the run is stuck is where reasoning depth pays for itself. Effort escalates to `max` automatically once a failure has survived one attempt. |
| Build a clean room and run acceptance         | `sonnet` | Mostly mechanical — clone, run the listed commands, transcribe exit codes — but not entirely, which is why this is not the cheapest tier. A verifier has to notice when a command exits 0 having measured nothing, and report a red it was clearly hoped not to find. That is the one judgement the contract cannot make in advance, and the whole run's value rests on it. |

**Sonnet here is deliberate and operator-approved — do not "upgrade" it.** These are the defaults in
`workflows/execute-plan.js`, so a caller who omits a model field gets exactly this table. If you have
met a rule requiring a different model, check what it governs before applying it here: a model
policy for eval or benchmark runs constrains **what is measured**, not what does the
measuring, and it does not reach this workflow. Raise a tier
only for a stage the plan itself calls hard, and say so in the run report when you do.

## Phase 5 — Do not take the run's word for it

When the workflow returns, **re-run the full acceptance yourself with Bash**, in a fresh clone,
over every stage. It costs no tokens and it is the only verification in the whole pipeline that no
agent participated in. A run should not be the last word on itself — that is the same claim the
plans you are executing were written to refuse.

Then write `<workdir>/REPORT.md`: what is green, verified how; what is not and why; the freeze
directory for each unfinished stage; every escalation with the fix that was refused and the reason;
and what it cost. Compare against where the repository was when the run started, not against the
plan's ideal — four of six stages landed is a result, not a failure.

Surface escalations to the user directly. An escalation means the run found a fix it was not
willing to make, and that is usually the most interesting thing it learned.

## Phase 6 — Long runs

Read `references/long-runs.md` when the run is unattended, hits a usage limit, or stops incomplete.
The short version:

- **Success stops the run.** So does the token target, and it is a ceiling, not a suggestion.
- **A usage limit is not a plan failure.** Agents returning nothing several times in a row means
  park, wait for the window, resume. Write `RESUME.md` first.
- **Resuming is cheap** because Phase 3's preflight re-derives what is done. Never resume from a
  prior run's claim about its own progress.
- **Set a token target for anything unattended.** Without one the only limits are the per-stage
  attempt budget and the no-progress breaker.

## What not to do

- **Do not let the run edit its own acceptance.** Everything else here is negotiable.
- **Do not accept a stage on `worktree` mode.** It cannot see the defect Day 1 was written about.
- **Do not widen a stage.** A diff bigger than the stage cannot be reviewed against it, and the
  plan's costing no longer applies to it.
- **Do not push, publish, or open a pull request.** The run commits to a branch. Shipping is a
  decision someone else makes after reading `REPORT.md`.
- **Do not paraphrase the plan into the contract.** Copy it. The stage section is the whole brief.
- **Do not keep attempting a stage that fails identically.** That is what the no-progress breaker
  exists for; overriding it spends the budget to learn nothing.
