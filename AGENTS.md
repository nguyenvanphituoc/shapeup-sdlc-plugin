<!-- HARNESS_START -->
# Shape Up SDLC Local Harness

This project is scaffolded with the Shape Up SDLC Harness for coding agents.

## mechanism instruction

The harness follows a **three-phase Shape Up SDLC loop** orchestrated by `/tech-lead`:

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
| Map Scopes | ⏸ **L1b** — Board Review (+ substrate disjointness) | delegate → `/ba-pitch-analyzer` (scope contracts ✦ + UC + Invariants + Test Surface ★) |
| Build Vertically | ⏸ **L2** — Board 100% ✅ + T0-green ✦ | delegate → `/task-executor` loop, T0-verified per attempt (fixtures + DB probe + seesaw ✦), sandboxed to each scope's substrate ✦ |
| EVAL (once per round) | ⏸ **L3** — Verdict | delegate → `/spec-evaluator` (spec-conformance + test-surface-conformance ★; requires a T0 artifact citation on scoped specs ✦) |
| FAIL → fix round r+1 | — | regression rule ★: bugs + full Test Surface of touched UC |

✦ = v0.3.0 mechanisms, active only when the spec folder has scope contracts
(`docs/shapeup-sdlc/<slug>/scopes/*.json`); non-regression on older specs.

### QA Edge Hunt (`/qa-edge-hunter`, post-PASS, pre-ship)
- **Q0** Preflight → **Q1** Charter (6 lenses − EVAL-covered) → **Hunt** (repro required, findings `~` → ledger) → report (no verdict, no score).
- Skip with `--no-qa`.

### Ship & Triage
- **SHIP S.0 / GATE H** — delegated to `/scope-hammer`: census (QA findings + discovered ledger
  + attempt-budget hammer proposals ✦) → baseline comparison (never vs. the ideal) → cut list;
  TL/PO confirms, promotes only selected items.
- ⏸ **L4** Gate — Ship Sign-off (shows QA status ★).
- **RLHF (Coach Retro)** — Post-sprint feedback from L4 Gate is processed by `/coach`, which runs a categorization gate (GATE COACH-1 — asks the PO which skill each rule belongs to, never assumes) and files each rule under the responsible skill in `docs/shapeup-sdlc/knowledge-base/<skill>.md`. These files are **committed** (not the gitignored `.shapeup-sdlc/` run-trace), so the whole team inherits them on `git pull`. The `/tech-lead` automatically invokes `/coach` when it receives human feedback during the Ship Gate. Coachable skills — each reads its own file at the top of its next run — are `/task-executor` (Phase 1), `/ba-pitch-analyzer` (Phase 1), and `/qa-edge-hunter` (Phase Q1). `/spec-evaluator` is deliberately not coachable (single-judge rule: the KB is guidance, never an invariant).
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
- **Two-level circuit breaker ✦** — outer `round_budget` (build+eval cycles) nests an inner
  per-scope `attempt_budget` (T0 attempts); an exhausted scope queues a GATE H proposal, it
  never blocks the round.
- **Hill phase is mechanical, never self-reported ✦** — derived only from T0/T1/seesaw facts.

## Installed Skills

- **shapeup**: Run Shape Up workflows before writing code (S1-S4, B1-B5).
- **ba-pitch-analyzer**: Analyze pitches and generate DDD spec-tree docs and tasks; scope-architect role writes committed scope contracts (Phase 6b) with a write-whitelist substrate, PA1/PA2 lints, and an affordance manifest.
- **task-executor**: Implement specific tasks from the spec folder; isolated-brief (zero-memory) mode + substrate discipline + Layer 1/2/3 UI rules when scope contracts exist.
- **spec-evaluator**: Evaluate task execution against specifications; requires a T0 artifact citation and grades UI affordance-only on scoped specs.
- **qa-edge-hunter**: Exploratory QA hunt.
- **translator**: Bilingual Vietnamese/English gate at intake.
- **tech-lead**: Orchestrate runs — two-level circuit breaker, T0/seesaw-verified build rounds, mechanical hill derivation.
- **coach**: Ingests L4 feedback, asks the PO to categorize each rule (GATE COACH-1), and files it under the responsible skill in committed `docs/shapeup-sdlc/knowledge-base/<skill>.md` for team-shared, read-back continuous learning (RLHF).
- **advisor-protocol**: Adjudicates a worker's structured `ESCALATE` (design decision / spec ambiguity / substrate expansion) within a per-scope-per-round budget; persists answers to the committed round ledger.
- **scope-hammer**: GATE H — must-have census, baseline comparison, cut list + ship verdict; handles the normal stop and both circuit-breaker triggers.

## Setup & Execution

- Telemetry facts for shipped features are saved to: \`docs/shapeup-sdlc/metrics/<machine-id>.jsonl\` (sharded per machine)
- Ephemeral logs and states are stored in: \`.shapeup-sdlc/\` (Gitignored)
- Scope contracts, hill shards, and the round ledger are stored in: \`docs/shapeup-sdlc/<slug>/\` (committed — v0.3.0, when scope contracts are in use)
<!-- HARNESS_END -->