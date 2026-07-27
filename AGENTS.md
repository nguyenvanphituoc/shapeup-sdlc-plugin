<!-- HARNESS_START -->
# Shape Up SDLC Local Harness

This project is scaffolded with the Shape Up SDLC Harness for coding agents.

## mechanism instruction

The harness follows a **three-phase Shape Up SDLC loop** orchestrated by `/tech-lead`.

**The organising idea: every invariant that matters lives in the runtime, not in a prompt.**
Three consequences, in the order a reader should meet them:

1. **Gates are enforced, not requested.** A `PreToolUse` hook (`hooks/gate-l2.mjs`) hard-denies
   the once-per-round EVAL delegation while the board is not green — the tool call never reaches
   the evaluator. *Prevents: EVAL run on a half-green board, reported as PASS.*
   Sign-off itself is a file, not prose: `scripts/gate-answers.mjs` resolves each gate from a
   schema-validated answer set (`ci` / `guarded` / `interactive`) and the orchestrator branches on
   its exit code — 0 cross, 4 stop for the PO, 5 abort. Gates still emit their blocks and still
   record a decision; what changes is that the decision's **source** is named in the ledger.
   *Prevents: consent carried in a prompt paragraph, which gets paraphrased instead of acted on.*
2. **Progress is derived, never claimed.** Hill phase comes only from T0/T1/seesaw artifacts on
   disk, and the evaluator must cite a T0 artifact it re-hashes itself. *Prevents: a worker
   asserting "done" with nothing behind it.*
   And **starting** is itself a fact on disk: `scripts/init-run.mjs` writes
   `.shapeup-sdlc/<slug>/receipt.json` as the run's first tool call, so a session that dispatched
   the orchestrator and left no receipt is blocked at `Stop` by `hooks/gate-zerowork.mjs`.
   *Prevents: the orchestrator describing its own pipeline in future tense and stopping — measured
   at 29% acceptance with 10 escaped defects while reading like a clean run.*
3. **Parallel work cannot corrupt shared state.** Per-scope substrate write-whitelists are hook-
   enforced, and exactly one script (`ingest-result.mjs`) performs every board/ledger/verdict
   write. *Prevents: two executors rewriting the board, one's completions vanishing.*

Those three rest on one piece of plumbing — the **pure-skill architecture** (v1.0). The
orchestrator owns ALL pipeline management and talks to workers through two JSON envelopes: a
WorkOrder in (`compile-order.mjs`, schema-validated by a `validate-envelope.mjs` PreToolUse
hook) and a WorkResult out (applied by `ingest-result.mjs`). Worker skills contain craft only —
zero pipeline knowledge; everything they used to write into shared files they now return as data
(D6 closed: single-writer is mechanically true). Treat the envelope as an implementation detail:
it is what makes 1–3 mechanically true, and it should never be the first thing a user learns.

### Phase 1 — Shaping (`/shapeup`)
1. Set Boundaries → `/shapeup shaping`
2. Find the Elements → `/shapeup breadboarding`
3. Risks & Rabbit Holes → `/shapeup spike`
4. Write the Pitch → `/generate-pitch` → `pitch.md`

### Phase 2 — Betting (PO governance, no skill)
- PO decides at the Betting Table; rejected pitches loop back to raw idea.

### Phase 3 — Building (orchestrated by `/tech-lead`)
| Step | Gate | Action |
|------|------|--------|
| Kick-off | ⏸ **L0** — Intake & Config (L0.8 model/budget matrix) | `/translator` if non-English |
| Orient (Scout) | ⏸ **L1a** — Orient Review | delegate → `/orient` |
| Wire (Reachability) | ⏸ **L1a.5** — Wiring Review ✚ | delegate → `/solution-architect` (`wire`): committed `wiring-map.json` — per-UC engine → seam → entry-point call site → affordance, against `project-profile.json` entry_point; front-loads the integration seam |
| Map Scopes | ⏸ **L1b** — Board Review (+ substrate disjointness via `spec-lint.mjs`) | delegate → `/ba-pitch-analyzer` (spec tree + board: UC + Invariants + Test Surface ★; `coverage` op writes the `requirements.md` registry ✚) then `/scope-architect` (scope contracts ✦ — sole writer). Traceability oracle `trace-lint.mjs` runs advisory ✚ |
| Build Vertically | ⏸ **L2** — Board 100% ✅ + T0-green ✦ | per dispatch: compile-order → `/task-executor` (--order) → ingest-result, T0-verified per attempt (fixtures + DB probe + seesaw ✦), sandboxed to each scope's substrate ✦ |
| EVAL (once per round) | ⏸ **L3** — Verdict | delegate → `/spec-evaluator` (--order; spec-conformance + test-surface-conformance ★; requires a T0 artifact citation on scoped specs ✦); refuted boxes/verdict ledger applied by ingest |
| FAIL → fix round r+1 | — | regression rule ★: bugs + full Test Surface of touched UC |

✦ = v0.3.0 mechanisms, active only when the spec folder has scope contracts
(`docs/shapeup-sdlc/<slug>/scopes/*.json`); non-regression on older specs.
✚ = spine v1.3 traceability mechanisms (covers-closure + reachability), active only when the
spine artifacts exist (`requirements.md`, `wiring-map.json`, `project-profile.json`); `trace-lint`
ships advisory (warn-only) and is promoted to a blocking gate only once `covers:` is populated.
Non-regression on older specs — every arm is skipped when its artifact is absent.

### QA Edge Hunt (`/qa-edge-hunter`, post-PASS, pre-ship)
- **Q0** Preflight → **Q1** Charter (6 lenses − EVAL-covered) → **Hunt** (repro required, findings `~` → ledger) → report (no verdict, no score).
- Skip with `--no-qa`.

### Ship & Triage
- **SHIP S.0 / GATE H** — delegated to `/scope-hammer`: census (QA findings + discovered ledger
  + attempt-budget hammer proposals ✦) → baseline comparison (never vs. the ideal) → cut list;
  TL/PO confirms, promotes only selected items.
- ⏸ **L4** Gate — Ship Sign-off (shows QA status ★).
- **RLHF (Coach Retro)** — Post-sprint feedback from L4 Gate is processed by `/coach`, which runs a categorization gate (GATE COACH-1 — asks the PO which skill each rule belongs to, never assumes) and files each rule under the responsible skill in `docs/shapeup-sdlc/knowledge-base/<skill>.md`. These files are **committed** (not the gitignored `.shapeup-sdlc/` run-trace), so the whole team inherits them on `git pull`. The `/tech-lead` automatically invokes `/coach` when it receives human feedback during the Ship Gate. Coachable skills — each reads its own file at the top of its next run — are `/task-executor` (Phase 1), `/ba-pitch-analyzer` (Phase 1), and `/qa-edge-hunter` (Phase Q1). `/spec-evaluator` is deliberately not coachable (single-judge rule: the KB is guidance, never an invariant). Feedback whose root cause is the mechanism itself (a gate, hook, or skill-contract defect) is categorized `harness-defect` at GATE COACH-1 and filed to the committed defect register (`knowledge-base/harness-defects.md`) as a drafted raw idea for the Betting Table — read by no worker, never worker steering.
- Post-fix: `eval --single-pass` → `qa --recheck` (only re-probes promoted items ✦).
- Remaining `~` findings + new feedback → new raw idea (debt-free).

### Discovered Tasks
All discovered tasks are funnelled into `.shapeup-sdlc/<slug>/discovery/ledger.md` (Orient, task-executor P3.7, QA). A new invariant triggers `ba --tasks-only --from-discovered` which appends a `TS-INV-NN` row to the Test Surface ★.

### Architectural Invariants
- **Single judge** — verdict belongs to `spec-evaluator`; QA has no verdict and no score.
- **EVAL exactly once per round** — QA sits after PASS, outside the loop.
- **Ledger = single source of truth** — all discovery flows write only to their own section.
- **QA is a level-up, not a gate** — `--no-qa` can skip it; circuit breaker outranks the Hunter.
- **Role separation** — Evaluator grades, task-executor fixes, QA discovers; no cross-role work.
- **Three-level circuit breaker ✦** — outer `round_budget` (build+eval cycles) nests an inner
  per-scope `attempt_budget` (T0 attempts); an exhausted scope queues a GATE H proposal, it
  never blocks the round. A third, opt-in `wall_clock_budget_s` breaker (`budget-check.mjs`,
  enforced by `hooks/gate-deadline.mjs`) covers the axis the other two cannot see — both count
  events, so neither notices a single round running for half an hour. Tripping it routes to
  GATE H rather than killing the run: a run killed from outside ships nothing, a run that trips
  its own breaker ships what is green.
- **Hill phase is mechanical, never self-reported ✦** — derived only from T0/T1/seesaw facts.
- **Envelope port (v1.0)** — every worker dispatch is WorkOrder in / WorkResult out; shared
  state is written only by `ingest-result.mjs`; a malformed envelope is denied by hook before
  it reaches a worker. Workers are stateless and pipeline-blind by construction.

## Installed Skills

- **shapeup**: Run Shape Up workflows before writing code (S1-S4, B1-B5).
- **ba-pitch-analyzer**: The spec-analyzer — pitch → DDD spec tree + board, one craft with five order-selected operations (analyze | generate-board | reconcile | retrofit-surface | coverage); graph math and audits delegated to `board-derive.mjs`/`spec-lint.mjs`; the `coverage` op writes the SHARED requirement registry (`requirements.md`) for covers-closure; stateless pure worker.
- **scope-architect**: Sole writer of committed scope contracts (`scopes/*.json`) — import-graph slicing by flow, write-whitelist substrates, affordance manifests, fixtures; map-scopes | remap | split-scope operations.
- **solution-architect**: Sole writer of the committed wiring map (`wiring-map.json`) at gate L1a.5 — per-UC engine → seam → entry-point call site → player-visible affordance, resolved against `project-profile.json`; the reachability input `trace-lint.mjs` checks so no engine ships orphaned; `wire` operation; stateless pure worker.
- **task-executor**: Implement a work order's acceptance criteria exactly — WorkOrder in, code + WorkResult out; zero-memory, substrate-sandboxed, Layer 1/2/3 UI rules; never writes boards/ledgers/run-state.
- **spec-evaluator**: The single judge — evaluates the running app against the committed spec; verdict + refuted boxes return as data; requires a T0 artifact citation and grades UI affordance-only on scoped specs.
- **qa-edge-hunter**: Exploratory QA hunt.
- **translator**: Bilingual Vietnamese/English gate at intake.
- **tech-lead**: Orchestrate runs — envelope port (compile-order → dispatch → ingest-result), two-level circuit breaker, T0/seesaw-verified build rounds, mechanical hill derivation.
- **coach**: Ingests L4 feedback, asks the PO to categorize each rule (GATE COACH-1), and files it under the responsible skill in committed `docs/shapeup-sdlc/knowledge-base/<skill>.md` for team-shared, read-back continuous learning (RLHF).
- **advisor-protocol**: Adjudicates a worker's structured `ESCALATE` (design decision / spec ambiguity / substrate expansion) within a per-scope-per-round budget; persists answers to the committed round ledger.
- **scope-hammer**: GATE H — must-have census, baseline comparison, cut list + ship verdict; handles the normal stop and both circuit-breaker triggers.

## Setup & Execution

- Envelope schemas ship inside the orchestrator skill: \`skills/tech-lead/schemas/\`; the pipeline scripts live beside their owning skill (\`skills/tech-lead/scripts/\`, \`skills/ba-pitch-analyzer/scripts/\`); orders/results live in \`.shapeup-sdlc/<slug>/orders|results/\`
- **Run entry points** — \`init-run.mjs\` (GATE L0.1, opens the run and writes the receipt), \`gate-answers.mjs\` (resolves a gate from the answer set), \`budget-check.mjs\` (the deadline breaker). Because these ship WITH the plugin they live outside your project, so they need a one-time permission grant; \`npx shapeup-sdlc init\` writes it into \`.claude/settings.json\` (\`permissions.allow\`). Without it a headless run cannot take its first step — measured, 26 approval denials in one session.
- **Central domain registry** — \`skills/tech-lead/schemas/domain.schema.json\` defines every cross-boundary record type and payload field ONCE (annotated with tier/location/writer/readers, the \`x-erd\` relationship map, and the \`x-payload-by-worker\` table); the envelope schemas \`$ref\` it and no skill defines its own cross-boundary field
- Telemetry facts for shipped features are saved to: \`docs/shapeup-sdlc/metrics/<machine-id>.jsonl\` (sharded per machine)
- Ephemeral logs and states are stored in: \`.shapeup-sdlc/\` (Gitignored)
- Scope contracts, hill shards, and the round ledger are stored in: \`docs/shapeup-sdlc/<slug>/\` (committed — v0.3.0, when scope contracts are in use)
- **Traceability spine (v1.3)** — the covers-closure + reachability oracle \`skills/tech-lead/scripts/trace-lint.mjs\` reads three committed SHARED artifacts: the requirement registry \`docs/shapeup-sdlc/<slug>/requirements.md\` (RequirementClause rows, written by \`ba-pitch-analyzer coverage\`), the wiring map \`docs/shapeup-sdlc/<slug>/wiring-map.json\` (written by \`solution-architect wire\`), and \`docs/shapeup-sdlc/<slug>/project-profile.json\` (archetype + entry_point, written by \`tech-lead\` at L0). It emits the LOCAL run-trace \`.shapeup-sdlc/<slug>/trace/report.json\`; ships advisory, promoted to a gate only once \`covers:\` is populated
<!-- HARNESS_END -->
