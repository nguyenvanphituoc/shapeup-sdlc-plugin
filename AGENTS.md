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
| Kick-off | ⏸ **L0** — Intake & Config | `/translator` if non-English |
| Orient (Scout) | ⏸ **L1a** — Orient Review | delegate → `/orient` |
| Map Scopes | ⏸ **L1b** — Board Review | delegate → `/ba-pitch-analyzer` (UC + Invariants + Test Surface ★) |
| Build Vertically | ⏸ **L2** — Board 100% ✅ | delegate → `/task-executor` loop |
| EVAL (once per round) | ⏸ **L3** — Verdict | delegate → `/spec-evaluator` (spec-conformance + test-surface-conformance ★) |
| FAIL → fix round r+1 | — | regression rule ★: bugs + full Test Surface of touched UC |

### QA Edge Hunt (`/qa-edge-hunter`, post-PASS, pre-ship)
- **Q0** Preflight → **Q1** Charter (6 lenses − EVAL-covered) → **Hunt** (repro required, findings `~` → ledger) → report (no verdict, no score).
- Skip with `--no-qa`.

### Ship & Triage
- **SHIP S.0** — TL/PO triages findings vs baseline; promotes only selected items.
- ⏸ **L4** Gate — Ship Sign-off (shows QA status ★).
- **RLHF (Coach Retro)** — Post-sprint feedback from L4 Gate is processed by `/coach` to intelligently update `.shapeup-sdlc/knowledge-base.md`. The `/tech-lead` will automatically invoke `/coach` when it receives human feedback during the Ship Gate. This knowledge base acts as guidelines for `/task-executor` and `/ba-pitch-analyzer` in future cycles.
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

## Installed Skills

- **shapeup**: Run Shape Up workflows before writing code (S1-S4, B1-B5).
- **ba-pitch-analyzer**: Analyze pitches and generate DDD spec-tree docs and tasks.
- **task-executor**: Implement specific tasks from the spec folder.
- **spec-evaluator**: Evaluate task execution against specifications.
- **qa-edge-hunter**: Exploratory QA hunt.
- **translator**: Bilingual Vietnamese/English gate at intake.
- **tech-lead**: Orchestrate runs.
- **coach**: Ingests L4 feedback to update `.shapeup-sdlc/knowledge-base.md` for continuous learning (RLHF).

## Setup & Execution

- Telemetry facts for shipped features are saved to: \`docs/shapeup-sdlc/metrics.jsonl\`
- Ephemeral logs and states are stored in: \`.shapeup-sdlc/\` (Gitignored)
<!-- HARNESS_END -->