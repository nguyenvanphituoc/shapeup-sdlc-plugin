# Delegation

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
breaks the isolation the zero-memory-handoff design (`round-protocol.md`, the compiled
WorkOrder in `orders/r<N>-a<M>.json`) already assumes every worker below has.

Standard shape (pure-skill architecture v1.0 — the envelope port):
```
1. node "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/compile-order.mjs" <mode flags>      # → orders/<id>.json
2. Agent({
     description: "<short task description>",
     subagent_type: "general-purpose",
     model: "<role model resolved at GATE L0.8>",
     prompt: "Call Skill(shapeup-sdlc-plugin:<skill>) --order <orders/<id>.json>.
              Report back: the WorkResult path (.shapeup/<slug>/results/<id>.json)."
   })
3. node "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/ingest-result.mjs" .shapeup/<slug>/results/<id>.json
```
The WorkOrder carries everything the worker may rely on (payload, decisions, digested errors,
substrate write-contract); the WorkResult carries everything the worker used to write into
shared files. `validate-envelope.mjs` runs as a PreToolUse hook on Skill|Agent and DENIES a
dispatch whose `--order` file is missing or schema-invalid. Workers write only their own
domain artifacts inside their substrate — never boards, ledgers, or run-state (D6, closed).

Role → model, resolved once at GATE L0.8 from the `orch`/`exec`/`eval`/`qa` matrix
(`t0-verify.mjs` is mechanical tooling run directly via Bash, never an Agent — DD-7, zero LLM
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
    writer. Lint mechanically: node "${CLAUDE_PLUGIN_ROOT}/skills/ba-pitch-analyzer/scripts/spec-lint.mjs" <slug> (PA1/PA2 +
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
        prose). Appetite Guard runs mechanically: node "${CLAUDE_PLUGIN_ROOT}/skills/ba-pitch-analyzer/scripts/board-derive.mjs".
Returns: WorkResult → ingest-result (which updates the board and bumps discovered_rounds in
        harness-run.md — the worker holds no counter).
Read back: updated tasks/_index.md + scope-summary.md before routing back to GATE L1b.
```

  Agent (model: exec): Skill(shapeup-sdlc-plugin:ba-pitch-analyzer) --order <path>
Effect: regenerates the LOCAL task board fresh from the committed usecases/domain-model/scopes
        — no ledger, no reconciliation. Status bootstraps from committed T0/hill facts at
        SCOPE granularity; unlocks recomputed by node "${CLAUDE_PLUGIN_ROOT}/skills/ba-pitch-analyzer/scripts/board-derive.mjs" --write.
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

Read back: ingest-result's summary line (tasks updated, unblocked, escalates) — not raw board
files. SPIKE tasks close before the tasks they block can build (compile-order enforces the
dependency order).
```

## 3b. A worker that cannot finish (scope contracts present, mid-attempt)
```
There is NO adjudication dispatch. A worker has no port for "I cannot decide this": WorkResult
        carries no escalates field, so the question never reaches you as data.
What you see: the phase produces no artifact. The workflow's post-condition
        (resume-state.mjs --require <phase>) fails and the run ABORTS, naming the phase.
Do: read the phase's result file to find what it could not complete, resolve it yourself —
        by amending the spec, widening the scope contract, or answering the ambiguity in the
        round-ledger "Decisions" table — then relaunch. The fast-forward re-dispatches only
        what is still unfinished.
Why it aborts rather than pauses: nothing persists an answer between launches, so a pause
        would relaunch into the same order and hit the same wall. Aborting puts the question
        in front of a human once instead of looping silently.
```

## 3c. T0 verify → scripts/t0-verify.mjs (skill-local; scope contracts present, every attempt)
```
Invoke via Bash directly — NOT an Agent, this is deterministic tooling, not a worker (DD-7):
  node "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/t0-verify.mjs" shapeup/<slug>/scopes/<scope-id>.md
        --round <N> --attempt <M> --seesaw-registry .shapeup/<slug>/seesaw/registry.json
Effect: runs the scope's e2e fixtures + DB probe, then (on green) the seesaw regression check
        over every FINISHED scope's fixtures. Writes the verdict artifact spec-evaluator's
        GATE V0.7 will require a citation to, appends one row to t0/trials.jsonl, and — this
        is the ratchet — scores the attempt against the last kept trial and snapshots or
        restores the working tree ITSELF. Zero LLM tokens — deterministic tooling, not a
        judge (this is what keeps "T1 once per round" true even though verification runs
        every attempt, DD-7).
Read back: the stdout JSON — {path, sha256, trial, overall, regression, score, status,
        baseline_trial, delta, tree_ref}. `status` (kept|reverted|rebased|crash) is what
        drives the attempt-loop branch in round-protocol.md "Isolated attempt loop"; by the
        time you read it the tree action has already happened. Never branch on the process
        exit code: it carries the T0 binary (0 green / 1 red / 2 bad argv, the oracles/*
        convention), so a `kept` red-but-improved attempt, the ratchet's own signature case,
        exits 1. On red, its `discovered_tasks` field is
        the AEGIS digest to fold into the next brief — no separate digester dispatch needed
        (t0-verify.mjs calls its sibling aegis-digest.mjs internally on failure).
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
- The generator reports task outcomes in its WorkResult; `ingest-result.mjs` flips `status:
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
| `orders/<id>.json` (WorkOrder) | **compile-order.mjs (mechanical)** | every worker (its ONLY pipeline input), validate-envelope hook |
| `results/<id>.json` (WorkResult) | the dispatched worker (its ONLY pipeline output) | ingest-result.mjs (the single writer of everything below it) |
| `.shapeup/<slug>/tasks/*` (LOCAL board, v3.2) | **ingest-result.mjs** (status, AC ticks, unblocks) + planner orders (task bodies) | tech lead (board status), compile-order (next task, ACs) |
| `discovery/ledger.md` | **ingest-result.mjs** (from workers' `discoveries[]`) | reconcile orders (ba), scope-hammer (H0 census) |
| `scope-summary.md` | planner (analyze/reconcile orders) | tech lead (Done-when), evaluator (Done-when criteria) |
| `evaluation/EVAL-FEATURE-<slug>.md` + `.verdicts-*.jsonl` | evaluator (report) / **ingest-result.mjs** (verdict ledger, un-ticks) | tech lead (verdict), next fix order (bug list) |
| `harness-run.md` | **tech lead (sole writer)** | tech lead (round ledger + Hill + run-state), PO (audit) |
| `scopes/<scope-id>.md` | `scope-architect` (sole writer) | tech lead (substrate/sequence), sandbox hook (write-whitelist), compile-order (inlined into orders) |
| `t0/verdicts/r<N>-a<M>-t<T>.json` | `scripts/t0-verify.mjs` (skill-local, mechanical — not a worker) | spec-evaluator (required citation), tech lead (hill derivation), compile-order (digested errors) |
| `t0/trials.jsonl` (the ratchet ledger, append-only, `baseline_trial` as the parent link) | `scripts/t0-verify.mjs` (one row per attempt: score, status, delta, tree_ref) | compile-order (`trial_history` into the next order), ship-report (T0 + Ratchet sections), `stats.mjs --ratchet` |
| `round-ledger.md` | **tech lead (sole writer)** | compile-order (decisions into every order), PO (audit) |
| `hill/<scope-id>.yml` + `hill-chart.md` | **tech lead (sole writer)** | PO ("status without asking"), scope-hammer (H0 census) |

> D6 is closed (v1.0): no worker writes `run-state.md`, the board, or the ledger. A worker
> performing a shared-state write is a defect — route it back through its WorkResult.
