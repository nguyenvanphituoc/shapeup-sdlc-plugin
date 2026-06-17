# Delegation

The tech lead invokes the build-phase skills and reads their handoff files. It never
reimplements their logic. Each sub-skill keeps its own gates; pass `--auto` to a sub-skill
only when the run's auto level is `--auto` or `--unattended`.

The order is **Orient (7) → Map Scopes (8) → Build (9) → Eval**, faithful to Shape Up: the
team orients before any board exists, so the planner's board is reality-born. The tech lead
is the **sole writer of run-state** (`harness-run.md`) — it passes each worker the run
metadata it needs (`feature`, `spec`, `stack`, `discovered_rounds`, `--auto`) as **args**;
workers keep only their own product-idempotency key and emit domain artifacts.

## 0. LANGUAGE GATE → translator (GATE L0, only if non-English)
```
Invoke: /translator --check "<intake path>"     # detect-only, writes nothing
  English      → skip; ORIENT against the original.
  non-English  → /translator "<intake path>" [--auto]   # full pass
                 Writes: <name>.en.md (English copy; original untouched) + glossary.md
                         + translation-report.md.
                 ORIENT against the <name>.en.md copy.
Read back: the detect table (--check) / the .en.md path + residual scan result (full pass).
Authority: translator normalizes language only — it does not orient/plan/build/judge. The tech
lead never translates itself; it only detects and sequences this step before ORIENT.
```

## 1. ORIENT → orient (the Scout, step 7) — runs BEFORE planning
```
Invoke: /orient --pitch "<kicked-off pitch path>" --spec <path> --stack "<hint>" [--auto]
Owns:   its own GATE O-A/O-B (or runs straight through under --auto)
Writes: .shapeup-sdlc/<slug>/orient/ → code-surface.md, spike-<area>.md, discovered-seed.md, hill-signal.md (LOCAL run-trace)
Read back: hill-signal.md (render the area-level Hill at GATE L1a) + the spiked area/result.
Why first: at Orient time NO board exists; the Scout's map + discovered seed make the planner's
        board reality-born instead of imagined. The four artifacts are the orient→ba contract.
Authority: pure worker — no code, no board, no run-state, no reporting.
```

## 2. MAP SCOPES → ba-pitch-analyzer (step 8, orient-informed)
```
Invoke: /ba-pitch-analyzer "<pitch text or path>" --lens <lens> [--auto]
Hand it: .shapeup-sdlc/<slug>/orient/ artifacts as input — code-surface.md (Phase 1 ingest consumes it,
        does not re-scan), discovered-seed.md (Phase 6 task gen), spike-<area>.md (Phase 1b).
Owns:   its own GATE 1–7 (or runs straight through under --auto)
Writes: spec_folder (= docs/shapeup-sdlc/<slug>/spec/) → _index.md, domain-model.md, ux-behavior.md, usecases/*,
        contracts/*.contract.md, tasks/TASK-NNN*.md, tasks/_index.md,
        scope-summary.md, (api-feasibility.md if third-party APIs detected)
        (run-trace — run-state.md, spikes/ — goes to the LOCAL root .shapeup-sdlc/<slug>/;
         the tech lead's .shapeup-sdlc/<slug>/harness-run.md is the authoritative run record)
Read back: tasks/_index.md (the board) and scope-summary.md (Done-when statements).
Pass-through rule: do not coach it to over-specify implementation — keep tech high-level.
```

## 2b. RECONCILE SCOPES → ba-pitch-analyzer (discovered task reconciliation)
```
Invoke: /ba-pitch-analyzer --tasks-only --from-discovered .shapeup-sdlc/<slug>/discovery/ledger.md
Effect: reconciles raw ledger discoveries into full board tasks, appends new invariants and
        TS-INV-* rows to use cases, and updates tasks/_index.md + scope-summary.md.
Owns:   Appetite Guard (Phase 7b).
Writes: updates spec_folder/tasks/*, spec_folder/tasks/_index.md, spec_folder/scope-summary.md,
        and spec_folder/usecases/*.md. Updates local run-state: discovered_rounds += 1.
Read back: updated tasks/_index.md and scope-summary.md before routing back to GATE L1b.
```

## 3. BUILD → task-executor
```
r=1 loop:
  Invoke: /task-executor --spec <path> --next [--auto-close]
  Effect: picks the lowest-priority ready task, runs GATE A–E, writes code, marks done,
          updates tasks/_index.md + run-state.md, propagates unblocks.
  Repeat until tasks/_index.md has no ready/blocked tasks (board all ✅).

r>1 (fix) per bug:
  Invoke: /task-executor --spec <path> --task <id> --force [--auto-close]
  Effect: re-executes a specific task to fix the bug; scope the change to the bug only.

Read back: tasks/_index.md status column after each call to know when the board is green.
SPIKE tasks: task-executor handles them as decision docs; they must close before the tasks
they block can build.
```

## 4. EVAL → spec-evaluator (once per round)
```
Invoke (ONCE, after GATE L2): 
  /spec-evaluator --spec <path> --feature <slug> --single-pass --dimensions <active>
Effect: one feature-level pass over the running app against all AC + Done-when across the
        board; writes evaluation/EVAL-FEATURE-<slug>.md (verdict + bug list); sets
        eval_verdict on affected tasks; never sets status: done.
Read back: EVAL-FEATURE-<slug>.md → verdict (pass|fail) + the bug list (each bug has
        task ref, severity, file:line, expected vs actual).
```

> Dependency note: this uses spec-evaluator's **feature-level** pass (`--feature <slug>`),
> which evaluates the whole board in one session rather than one task at a time. If your
> installed spec-evaluator is the per-task v0.1, add the `--feature` mode (a small v0.2
> patch: iterate the board's AC/Done-when in one probe+grade session, emit one
> EVAL-FEATURE report) before wiring the tech lead to it. The per-task invocation still
> works for ad-hoc checks, but the round loop expects one feature pass.

## Authority boundaries (do not cross)
- The Scout orients; it never plans, builds, or judges — it hands raw material to the planner.
- The planner decides scope; the tech lead confirms it with the PO at GATE L1b.
- The generator owns `status: done` per task (its GATE E). The tech lead confirms the
  feature-level close at GATE L4.
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
| `tasks/_index.md` | planner / generator | tech lead (board status, Hill), generator (next task) |
| `scope-summary.md` | planner | tech lead (Done-when), evaluator (Done-when criteria) |
| `evaluation/EVAL-FEATURE-<slug>.md` | evaluator | tech lead (verdict), generator (bug list) |
| `harness-run.md` | **tech lead (sole writer)** | tech lead (round ledger + Hill + run-state), PO (audit) |

> `run-state.md`: still written by planner/generator/evaluator until their D6 cleanup lands,
> but it is no longer the authoritative run record — `harness-run.md` is, and the tech lead is
> its sole writer. Don't read run-state for orchestration decisions; read the ledger + board.
