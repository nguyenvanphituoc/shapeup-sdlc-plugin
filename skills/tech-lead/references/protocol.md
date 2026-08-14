# Protocol — the round loop, the delegation shape, and the invariants behind both

Three things that only make sense together: what a round DOES, how each step is dispatched, and
which rules the code enforces so a model does not have to remember them.

On a spec with committed scope contracts all of this is CODE —
`skills/tech-lead/workflows/shapeup-run.js`. This file is the readable rationale for why that code
is shaped the way it is, plus the verbatim prose path for the lanes the script does not cover
(`--tiny`, and any spec with no `scopes/*.md` yet).

---

# Part 1 — The round loop

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
   term, default 2 — `harness compile` prints it as a JSON breaker object on stderr) →
   does NOT stop the round; queues a hammer PROPOSAL for GATE H and moves to the next scope
   in sequence. See "Three-level circuit breaker" below.
4. **wall_clock_budget (DEADLINE breaker, opt-in)** — elapsed seconds since the run receipt
   exceed `--wall-clock-budget` → do NOT start another build round or another scope; go
   straight to GATE H (`/scope-hammer --breaker deadline`). Checked with
   `harness verify budget` at every round boundary and enforced by `harness verify budget`,
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
                                       --breaker deadline. Enforced by `harness verify budget`.
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
Nesting rationale: a struggling scope should not freeze every other scope's progress
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
and the working tree moves forward only when the score strictly improves. `harness verify t0` makes
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
                                      the NEXT attempt's fresh context reads back.
harness verify t0                      → fixtures + DB probe + (on green) seesaw, then scores the
                                      attempt against the baseline trial and snapshots or
                                      restores the tree. Branch on `status` from its stdout
                                      JSON — the tree action has ALREADY happened:
  kept      strictly better, INCLUDING red-but-improved (2/5 → 4/5 fixtures — the whole point
              of the ratchet). Tree snapshotted to refs/shapeup/<scope_id>/kept.
              overall=green → the attempt loop breaks; scope reaches DOWNHILL_EXECUTION.
              Still red → loop, and attempt M+1 now builds ON attempt M.
  reverted  not better — and a tie is not better. Tree already restored from the last kept
              snapshot. Subsumes the retired stash-and-retry branch: a FINISHED scope's broken
              fixture raises score.regressions and reverts through this same rule, which
              is why seesaw runs before anything is declared green.
              rather than the code. Tree kept, baseline reset. Not a verdict, not a failure.
  crash     a fixture command failed to spawn or timed out; tree restored. Fix the fixture,
              not the code.
  (on any red, `discovered_tasks` carries the AEGIS {file, line, core_message} triples, which
   compile-order folds into the NEXT attempt's order as digested_errors — no separate dispatch)
```

**The exit code is not the branch selector.** `harness verify t0` exits 0 on T0-green and 1 on
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
clear note that nothing was verified beyond task-executor's own per-AC evidence checks.

## Round-cost intuition
Build dominates; eval is cheap. Expect each EVAL round to cost a small fraction of a BUILD
round. This is why running eval once per round (not per task) is the right trade: you pay a
little QA at the end of each build and keep the expensive build coherent in between.

<!-- test requirement -->
kept|reverted|rebased|crash, decided in harness verify t0 decideStatus()

---

# Part 2 — Delegation

The tech lead invokes the build-phase skills and reads their handoff files. It never
reimplements their logic. Each sub-skill keeps its own gates; pass `--auto` to a sub-skill
only when the run's auto level is `--auto` or `--unattended`.

## Invocation mechanism — Agent, not Skill

Every "Invoke:" line below means: call the **Agent** tool — a real subagent, on its own
context and (where a role is named) its own model — whose prompt tells it to run
`Skill(shapeup-sdlc-plugin:<name>)` with the given args and report back the artifacts. It does
**not** mean the tech lead calls the `Skill` tool itself. A direct `Skill` call executes
inline, in the tech lead's own turn, on the tech lead's own model — that silently drops GATE
L0.8's model matrix (there is no per-role model left to route once the call is inline) and
breaks the isolation the zero-memory-handoff design (`protocol.md`, the compiled
WorkOrder in `orders/r<N>-a<M>.json`) already assumes every worker below has.

Standard shape (pure-skill architecture v1.0 — the envelope port):
```
1. node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" compile <mode flags>      # → orders/<id>.json
2. Agent({
     description: "<short task description>",
     subagent_type: "general-purpose",
     model: "<role model resolved at GATE L0.8>",
     prompt: "Call Skill(shapeup-sdlc-plugin:<skill>) --order <orders/<id>.json>.
              Report back: the WorkResult path (.shapeup/<slug>/results/<id>.json)."
   })
3. node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" reduce ingest .shapeup/<slug>/results/<id>.json
```
The WorkOrder carries everything the worker may rely on (payload, decisions, digested errors,
substrate write-contract); the WorkResult carries everything the worker used to write into
shared files. `harness verify envelope` runs as a PreToolUse hook on Skill|Agent and DENIES a
dispatch whose `--order` file is missing or schema-invalid. Workers write only their own
domain artifacts inside their substrate — never boards, ledgers, or run-state.

Role → model, resolved once at GATE L0.8 from the `orch`/`exec`/`eval`/`qa` matrix
(`harness verify t0` is mechanical tooling run directly via Bash, never an Agent — zero LLM
tokens):

| Skill | L0.8 role | Why this tier |
|-------|-----------|---------------|
| translator | exec | one-shot text transform — builder tier |
| orient (Scout) | exec | reads/spikes code — builder tier, not judgment |
| ba-pitch-analyzer | exec | planner — builder tier, not judgment |
| scope-architect | exec | scope-contract author (sole writer of scopes/*.md) — builder tier |
| task-executor | exec | the builder itself |
| spec-evaluator | eval | the single judge (judge ≠ doer) — keep its own matrix key even if a PO points it at the same model as `exec`, so it can be split later without a harness change |
| qa-edge-hunter | qa | cheapest tier by design — exploratory breadth over depth |
| scope-hammer | exec | census + baseline comparison, proposes only — not a verdict |
| coach | exec | categorization gate, not a verdict |

The tech lead itself is `orch` — this conversation, never delegated to.

The order is **Orient (7) → Map Scopes (8) → Build (9) → Eval**, faithful to Shape Up: the
team orients before any board exists, so the planner's board is reality-born. The tech lead
is the **sole writer of run-state** (`harness-run.md`) — it passes each worker the run
metadata it needs (`feature`, `spec`, `stack`, `discovered_rounds`, `--auto`) as **args**;
workers keep only their own product-idempotency key and emit domain artifacts.

## 0. LANGUAGE GATE → translator (GATE L0, only if non-English)
```
Invoke via Agent (model: exec): Skill(shapeup-sdlc-plugin:translator) --check "<intake path>"
                 # detect-only, writes nothing
  English      → skip; ORIENT against the original.
  non-English  → Agent (model: exec): Skill(shapeup-sdlc-plugin:translator) "<intake path>" [--auto]
                 # full pass
                 Writes: <name>.en.md (English copy; original untouched) + glossary.md
                         + translation-report.md.
                 ORIENT against the <name>.en.md copy.
Read back: the detect table (--check) / the .en.md path + residual scan result (full pass).
Authority: translator normalizes language only — it does not orient/plan/build/judge. The tech
lead never translates itself; it only detects and sequences this step before ORIENT.
```

## 1. ORIENT → orient (the Scout, step 7) — runs BEFORE planning
```
Invoke via Agent (model: exec): Skill(shapeup-sdlc-plugin:orient)
        --pitch "<kicked-off pitch path>" --spec <path> --stack "<hint>" [--auto]
Owns:   its own GATE O-A/O-B (or runs straight through under --auto)
Writes: .shapeup/<slug>/orient/ → code-surface.md, spike-<area>.md, discovered-seed.md, hill-signal.md (LOCAL run-trace)
Read back: hill-signal.md (render the area-level Hill at GATE L1a) + the spiked area/result.
Why first: at Orient time NO board exists; the Scout's map + discovered seed make the planner's
        board reality-born instead of imagined. The four artifacts are the orient→ba contract.
Authority: pure worker — no code, no board, no run-state, no reporting.
```

## 2. MAP SCOPES → ba-pitch-analyzer + scope-architect (step 8, orient-informed)
```
Order A (the spec tree + board):
  compile-order --operation analyze --slug <slug> --worker ba-pitch-analyzer
    --payload '{"pitch": "<path>", "lens": "<lens>", "orient_dir": ".shapeup/<slug>/orient/"}'
  Agent (model: exec): Skill(shapeup-sdlc-plugin:ba-pitch-analyzer) --order <path>
  The order hands it code-surface.md (Phase-1 ingest, no re-scan), discovered-seed.md (task
  gen from reality), spike-<area>.md (feasibility/contracts).
  Writes (its substrate): spec_folder → _index.md, domain-model.md, ux-behavior.md, usecases/*,
    contracts/*.contract.md, scope-summary.md (+ api-feasibility.md if third-party) and the
  Returns: WorkResult (artifacts list + discoveries) → ingest-result.
Order B (the scope contracts):
  compile-order --operation map-scopes --slug <slug> --worker scope-architect
  Agent (model: exec): Skill(shapeup-sdlc-plugin:scope-architect) --order <path>
  Writes (its substrate): shapeup/<slug>/scopes/*.md + scope-board.md — sole
    writer. Lint mechanically: node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" verify spec <slug> (PA1/PA2 +
    substrate disjointness) before GATE L1b.
Read back: .shapeup/<slug>/tasks/_index.md (the board) + scope-summary.md (Done-when)
  + the spec-lint verdict.
Pass-through rule: do not coach the planner to over-specify implementation — keep tech high-level.
```

## 2b. RECONCILE → ba-pitch-analyzer (discovered task reconciliation, operation: reconcile)
```
compile-order --operation reconcile --slug <slug> --worker ba-pitch-analyzer
  --payload '{"discovered_ledger": ".shapeup/<slug>/discovery/ledger.md"}'
Agent (model: exec): Skill(shapeup-sdlc-plugin:ba-pitch-analyzer) --order <path>
Effect: reconciles raw ledger discoveries into board tasks + appended UC invariants/TS rows,
        inside the reconcile write-contract (frozen zone enforced by the sandbox hook, not
        prose). Appetite Guard runs mechanically: node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" reduce board.
Returns: WorkResult → ingest-result (which updates the board and bumps discovered_rounds in
        harness-run.md — the worker holds no counter).
Read back: updated tasks/_index.md + scope-summary.md before routing back to GATE L1b.
```

  Agent (model: exec): Skill(shapeup-sdlc-plugin:ba-pitch-analyzer) --order <path>
Effect: regenerates the LOCAL task board fresh from the committed usecases/domain-model/scopes
        — no ledger, no reconciliation. Status bootstraps from committed T0/hill facts at
        SCOPE granularity; unlocks recomputed by node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" reduce board --write.
Read back: the freshly regenerated tasks/_index.md before entering BUILD.
```

## 3. BUILD → task-executor (always through the envelope port)
```
r=1 loop:
  compile-order --next --slug <slug> [--test-cmd "<cmd>"]        # exit 2 = no ready task
  Agent (model: exec), one fresh subagent per order:
    Skill(shapeup-sdlc-plugin:task-executor) --order <path>
  ingest-result <results/<id>.json>   # ticks ACs, marks done, updates board, propagates unblocks
  Repeat until compile-order --next reports no ready task (board all ✅).

r>1 (fix) per bug:
  compile-order --task <id> --slug <slug> --operation fix --payload '{"bugs": [<entries>]}'
  → dispatch + ingest as above. Scope the change to the bug only.

Scope contracts present (isolated attempt loop, per scope, per attempt):
  compile-order --scope shapeup/<slug>/scopes/<id>.md --round <N> --attempt <M>
  → orders/r<N>-a<M>.json inlines the scope contract, this scope's tasks, promoted ledger
    decisions, the previous attempt's AEGIS triples, and `trial_history` — the last 8 trials
    for this scope (score, status, delta, top-3 digest), CROSSING the round boundary so a fix
    round cannot re-propose a change the build round already reverted. The zero-memory
    handoff, compiled from facts only. Dispatch a fresh Agent per attempt (the isolation
    boundary):
    Skill(shapeup-sdlc-plugin:task-executor) --order <path>
  ingest-result — a WorkResult with status "escalated" leaves its artifact unwritten → see 3b below.

Read back: ingest-result's summary line (tasks updated, ACs ticked, unblocked, discoveries) — not raw board
files. SPIKE tasks close before the tasks they block can build (compile-order enforces the
dependency order).
```

## 3b. A worker that cannot finish (scope contracts present, mid-attempt)
```
There is NO adjudication dispatch. A worker has no port for "I cannot decide this": WorkResult
        carries no escalates field, so the question never reaches you as data.
What you see: the phase produces no artifact. The workflow's post-condition
        (harness probe resume --require <phase>) fails and the run ABORTS, naming the phase.
Do: read the phase's result file to find what it could not complete, resolve it yourself —
        by amending the spec, widening the scope contract, or answering the ambiguity in the
        round-ledger "Decisions" table — then relaunch. The fast-forward re-dispatches only
        what is still unfinished.
Why it aborts rather than pauses: nothing persists an answer between launches, so a pause
        would relaunch into the same order and hit the same wall. Aborting puts the question
        in front of a human once instead of looping silently.
```

## 3c. T0 verify → `harness verify t0` (skill-local; scope contracts present, every attempt)
```
Invoke via Bash directly — NOT an Agent, this is deterministic tooling, not a worker:
  node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" verify t0 shapeup/<slug>/scopes/<scope-id>.md
        --round <N> --attempt <M> --seesaw-registry .shapeup/<slug>/seesaw/registry.json
Effect: runs the scope's e2e fixtures + DB probe, then (on green) the seesaw regression check
        over every FINISHED scope's fixtures. Writes the verdict artifact spec-evaluator's
        T0-citation rule will require a citation to, appends one row to t0/trials.jsonl, and — this
        is the ratchet — scores the attempt against the last kept trial and snapshots or
        restores the working tree ITSELF. Zero LLM tokens — deterministic tooling, not a
        judge (this is what keeps "T1 once per round" true even though verification runs
        every attempt).
Read back: the stdout JSON — {path, sha256, trial, overall, regression, score, status,
        baseline_trial, delta, tree_ref}. `status` (kept|reverted|rebased|crash) is what
        drives the attempt-loop branch in protocol.md "Isolated attempt loop"; by the
        time you read it the tree action has already happened. Never branch on the process
        exit code: it carries the T0 binary (0 green / 1 red / 2 bad argv, the oracles/*
        convention), so a `kept` red-but-improved attempt, the ratchet's own signature case,
        exits 1. On red, its `discovered_tasks` field is
        the AEGIS digest to fold into the next brief — no separate digester dispatch needed
        (harness verify t0 calls its sibling harness probe digest internally on failure).
```

## 4. EVAL → spec-evaluator (once per round)
```
compile-order --operation evaluate --slug <slug> --worker spec-evaluator --round <r>
  --payload '{"dimensions": ["spec-conformance"], "run_cmd": "<cmd>", "t0_artifacts": [...]}'
Invoke via Agent (model: eval), ONCE, after GATE L2:
  Skill(shapeup-sdlc-plugin:spec-evaluator) --order <path>
Effect: one feature-level pass over the running app against all AC + Done-when; writes
        evaluation/EVAL-FEATURE-<slug>.md (verdict + bug list) + its WorkResult (criteria
        verdicts, refuted boxes, T0 citations). It touches NO task file and NO board.
ingest-result <results/evaluate-r<r>.json>: appends the .verdicts JSONL ledger, un-ticks the
        refuted AC boxes, sets eval_verdict frontmatter — the judge returns data, ingest writes.
Read back: EVAL-FEATURE-<slug>.md → verdict (pass|fail) + the bug list (each bug has
        task ref, severity, file:line, expected vs actual).
```

> Dependency note: this uses spec-evaluator's **feature-level** pass (`--feature <slug>`),
> which evaluates the whole board in one session rather than one task at a time. If your
> installed spec-evaluator is the per-task v0.1, add the `--feature` mode (a small v0.2
> patch: iterate the board's AC/Done-when in one probe+grade session, emit one
> EVAL-FEATURE report) before wiring the tech lead to it. The per-task invocation still
> works for ad-hoc checks, but the round loop expects one feature pass.

## 5. SHIP / GATE H → scope-hammer
```
Invoke via Agent (model: exec): Skill(shapeup-sdlc-plugin:scope-hammer)
        --slug <slug> [--baseline <path>] [--breaker outer|inner --scope <id>]
Effect: GATE H0 census (scopes + QA findings + discovered ledger + advisor-overflow flags) →
        H1 baseline comparison (never vs. a perfect ideal) → H2 cut list + verdict.
Read back: the proposed cut list + verdict (SHIP now | SHIP after fixing ship-blocking items |
        CANNOT SHIP). The tech lead records the PO's decision in round-ledger.md and performs
        the actual close (SHIP S.1 onward) — scope-hammer proposes, it never ships.
```

## Authority boundaries (do not cross)
- The Scout orients; it never plans, builds, or judges — it hands raw material to the planner.
- The planner decides scope; the tech lead confirms it with the PO at GATE L1b.
- The generator reports task outcomes in its WorkResult; `harness reduce ingest` flips `status:
  done` from that report. The tech lead confirms the feature-level close at GATE L4.
- The evaluator issues verdicts only; it never closes tasks. Judge ≠ doer.
- The tech lead decides *when* and *whether* each skill runs and how rounds proceed, owns
  run-state + the Hill report — it does not decide *what* a task contains or *whether* a
  single AC passes.

## Handoff files (the shared state)
| File | Written by | Read by |
|------|-----------|---------|
| `<name>.en.md` + `glossary.md` | translator (L0, if non-English) | tech lead (ORIENT input), Scout, planner |
| `orient/code-surface.md` | Scout (step 7) | planner Phase 1 (ingest, no re-scan) |
| `orient/spike-<area>.md` | Scout (step 7) | planner Phase 1b/contracts; tech lead (L1a) |
| `orient/discovered-seed.md` | Scout (step 7) | planner Phase 6 (task gen) |
| `orient/hill-signal.md` | Scout (step 7) | tech lead (renders L1a Hill) |
| `orders/<id>.json` (WorkOrder) | **harness compile (mechanical)** | every worker (its ONLY pipeline input), validate-envelope hook |
| `results/<id>.json` (WorkResult) | the dispatched worker (its ONLY pipeline output) | harness reduce ingest (the single writer of everything below it) |
| `.shapeup/<slug>/tasks/*` (LOCAL board, v3.2) | **harness reduce ingest** (status, AC ticks, unblocks) + planner orders (task bodies) | tech lead (board status), compile-order (next task, ACs) |
| `discovery/ledger.md` | **harness reduce ingest** (from workers' `discoveries[]`) | reconcile orders (ba), scope-hammer (H0 census) |
| `scope-summary.md` | planner (analyze/reconcile orders) | tech lead (Done-when), evaluator (Done-when criteria) |
| `evaluation/EVAL-FEATURE-<slug>.md` + `.verdicts-*.jsonl` | evaluator (report) / **harness reduce ingest** (verdict ledger, un-ticks) | tech lead (verdict), next fix order (bug list) |
| `harness-run.md` | **tech lead (sole writer)** | tech lead (round ledger + Hill + run-state), PO (audit) |
| `scopes/<scope-id>.md` | `scope-architect` (sole writer) | tech lead (substrate/sequence), sandbox hook (write-whitelist), compile-order (inlined into orders) |
| `t0/verdicts/r<N>-a<M>-t<T>.json` | `harness verify t0` (skill-local, mechanical — not a worker) | spec-evaluator (required citation), tech lead (hill derivation), compile-order (digested errors) |
| `t0/trials.jsonl` (the ratchet ledger, append-only, `baseline_trial` as the parent link) | `harness verify t0` (one row per attempt: score, status, delta, tree_ref) | compile-order (`trial_history` into the next order), ship-report (T0 + Ratchet sections), `harness probe stats --ratchet` |
| `round-ledger.md` | **tech lead (sole writer)** | compile-order (decisions into every order), PO (audit) |
| `hill/<scope-id>.yml` + `hill-chart.md` | **tech lead (sole writer)** | PO ("status without asking"), scope-hammer (H0 census) |

> The single-writer rule is closed mechanically: no worker writes `run-state.md`, the board, or the ledger. A worker
> performing a shared-state write is a defect — route it back through its WorkResult.

---

# Part 3 — The invariants

Moved out of `SKILL.md` when the round loop became a launchable script:
most of what this table used to guard against — a partial board reaching EVAL, a gate crossed
on the model's own authority, an evaluator called mid-BUILD — is now a property of
`skills/tech-lead/workflows/shapeup-run.js`'s code, not a rule a model has to remember to obey.
The table stays as the readable rationale for WHY the code is shaped the way it is; the runtime
guarantee lives in the script and, where noted, in a hook.

| Rule | Rationale |
|------|-----------|
| Orchestrates Building only (steps 7–11); shaping/betting/kick-off are PO-personal, upstream | Intake is a kicked-off pitch, not a raw idea — the tech lead does no shaping/planning-authority work |
| ORIENT (step 7) runs before MAP SCOPES (step 8) | Roadmap: no pre-divided tasks at kick-off; the team orients first so the board is reality-born |
| Intake must be English before ORIENT; tech lead does NOT translate — it delegates to `translator` at GATE L0 | Translation is a separate single-purpose skill; the intake conversation only detects + sequences it, before RunArgs is ever compiled |
| Every worker dispatch goes through the envelope port: compile-order → `--order` → ingest-result; shared state is written ONLY by ingest | The single-writer rule is mechanically true: a worker that writes boards/ledgers/run-state is a defect, and a malformed envelope is denied by the validate-envelope hook before it can corrupt run truth. `shapeup-run.js` uses this same shape for every operation in the central registry — orient, wire, analyze, map-scopes, evaluate, hunt, hammer alike |
| Progress is reported by Hill position, never by counting tasks | The roadmap forbids task-counting; a 90%-done slice can still be stuck uphill on the one unknown that matters |
| Evaluator runs once per round, only after GATE L2 (board 100% done) | The whole point: cheap end-of-round QA, never per task. `shapeup-run.js`'s round loop dispatches spec-evaluator exactly once per iteration, after the GATE L2 resolution — there is no code path that calls it from inside the scope attempt loop |
| Evaluator never called inside the BUILD loop | Keeps the build coherent and the run cheap |
| r>1 builds bugs only, never the whole board | Don't re-do passing work; minimize churn — see protocol.md's regression rule for what DOES re-run (touched UCs' full Test Surface) |
| Stop at max_rounds; escalate honestly | No infinite fix loops; `shapeup-run.js` returns `{status: "gate_h", breaker: "outer"}` rather than looping past the budget |
| Tech lead delegates, never reimplements a sub-skill | Stays thin; each skill keeps its own gates and authority |
| Every delegation to a sub-skill (except the mechanical `harness verify t0`/`harness compile`/`harness reduce ingest`) is a fresh Agent on the L0.8-resolved model | Isolation the zero-memory-handoff design assumes; a direct inline call would silently drop the model matrix — see references/protocol.md "Invocation mechanism" |
| Planner stays high-level on tech | Spec errors cascade into every build round |
| Never auto-deploy; "shipped" never silently means "deployed" | Deploy is outward-facing, PO-gated; record "deploy pending (PO)" otherwise |
| "Shipped" names the dims NOT evaluated | `RunReturn`'s `dims_not_evaluated` field carries this; the L4 sign-off block shows it, never silently drops it |
| Every gate emits the canonical `⏸ GATE LN — Title` block before any narrative | Composed by the workflow (`gateBlock()`), emitted VERBATIM by the skill — conversational re-summary is not a gate |
| In interactive/--auto: a `paused` return stops and waits for PO confirmation | Never auto-proceed past a gate; the PO must cross each threshold explicitly — see "The pause protocol" in SKILL.md |
| At GATE L3 FAIL: name scope (task + failed criterion), never prescribe fix options | Root cause analysis and fix paths belong to the implementer, not the orchestrator |
| SHIP harvest records facts only — copies existing structured output, never computes a new verdict/score | A self-computed score = a second judge behind spec-evaluator (breaks single-judge, invites Goodhart); the eval suite interprets, harvest records |
| Three-level circuit breaker: attempt_budget (inner, per scope) nests inside round_budget (outer), with an opt-in wall_clock_budget_s deadline | An exhausted scope queues a GATE H hammer proposal, it never blocks the round; only round_budget hitting 0 stops the whole run; the deadline breaker (checked every round boundary in `shapeup-run.js`) routes to GATE H so a run out of clock still ships what is green instead of being killed from outside |
| The tech lead never hand-edits a scope contract | scope-architect is its sole writer (single-writer-per-file) |
| Substrate-disjointness + PA1/PA2 lints are re-asserted at GATE L1b (harness verify spec) even when scope-architect already checked them | A human may have hand-approved past a 🔴 at the architect's checkpoint; `shapeup-run.js` runs spec-lint itself, in code, before resolving L1b |
| Hill phase is read from mechanical facts (T0/T1/seesaw), never declared by a worker | Closes the self-reported-confidence risk outright — facts move dots, not authors |
| GATE H is delegated to scope-hammer, never adjudicated inline by the tech lead | Keeps the orchestrator thin; census/baseline-comparison/cut-list logic has one owner |
