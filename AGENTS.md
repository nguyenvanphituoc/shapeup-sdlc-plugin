<!-- HARNESS_START -->
# Shape Up SDLC Local Harness

## Enforcement model

A three-phase Shape Up loop orchestrated by `/tech-lead`. Invariants live in the runtime, not this file — expect hook denials, not arguments.

- Hook-denied: dispatching a worker without a schema-valid WorkOrder, writing outside the scope's substrate, stopping a run with no receipt (the run's first act writes one).
- GATE L2 is advisory — warns when EVAL runs over unfinished tasks, permits the call (per-machine board, operator asked; ADR-0001) — a signal, not a bug.
- Sign-off is a file: each gate resolves from the answer set (`ci`/`guarded`/`interactive`) — cross, stop for the PO, or abort; the decision's source is ledgered.
- The build+eval loop breaks only three ways ✦: EVAL PASS → QA → Ship; outer `round_budget` exhausted; opt-in `wall_clock_budget_s` tripped (the wall-clock axis event counters miss). Budget trips route to GATE H — ship what's green, never kill the run from outside. A scope exhausting its per-scope `attempt_budget` (T0 attempts) queues a GATE H proposal, never blocks the round.

### Phase 1 — Shaping (`/shapeup`)
1. Set Boundaries → `/shapeup shaping`
2. Find the Elements → `/shapeup breadboarding`
3. Risks & Rabbit Holes → `/shapeup spike`
(The completed pitch is formed by `shaping.md` + `breadboard.md`)

### Phase 2 — Betting (PO governance, no skill)
Betting Table: PO decides; rejected pitches loop back to raw idea.

### Phase 3 — Building
| Step | Gate | Action |
|------|------|--------|
| Kick-off | ⏸ **L0** — Intake & Config (L0.8 model/budget matrix) | `/translator` if non-English |
| Orient (Scout) | ⏸ **L1a** — Orient Review | `/orient` |
| Analyze | — (reviewed at L1b) | `/ba-pitch-analyzer` (`analyze`): spec tree + board (UC + Invariants + Test Surface ★); before Wire (needs its use cases) |
| Wire | ⏸ **L1a.5** — Wiring Review ✚ | `/solution-architect` (`wire`): sole writer of committed `wiring-map.md` — per-UC engine → seam → entry-point call site → affordance, per `project-profile.md` |
| Map Scopes | ⏸ **L1b** — Board Review (+ substrate disjointness lint) | `/scope-architect` (scope contracts ✦ — sole writer); traceability oracle advisory ✚ |
| Build Vertically | ⏸ **L2** — Board 100% ✅ + T0-green ✦ | per dispatch: compile order → `/task-executor` (--order) → ingest result; T0-verified per attempt (fixtures + DB probe + seesaw ✦), substrate-sandboxed ✦ |
| EVAL (once per round) | ⏸ **L3** — Verdict | `/spec-evaluator` (--order): spec- + test-surface-conformance ★, T0 citation ✦; refuted boxes/verdict applied by ingest |
| FAIL → round r+1 | — | regression rule ★: bugs + full Test Surface of touched UC |

✦ = requires scope contracts (`shapeup/<slug>/scopes/*.md`); ✚ = requires the spine artifacts (`requirements.md`, `wiring-map.md`, `project-profile.md`). Traceability stays advisory until `covers:` is populated. Absent artifact ⇒ arm skipped (non-regression).


### QA Edge Hunt (`/qa-edge-hunter`, post-PASS, pre-ship)
**Q0** Preflight → **Q1** Charter (6 lenses − EVAL-covered) → **Hunt** (repro required, findings `~` → ledger) → report (no verdict, no score). Skip with `--no-qa`.

### Ship & Triage
- **SHIP S.0 / GATE H** — `/scope-hammer`: census (QA findings + discovered ledger + attempt-budget proposals ✦) → baseline comparison (never the ideal) → cut list; TL/PO promotes selected items only.
- ⏸ **L4** — Ship Sign-off (shows QA status ★).
- **Coach retro** — L4 feedback → `/coach`; GATE COACH-1 asks the PO which skill owns each rule (never assumes) → committed `shapeup/knowledge-base/<skill>.md` (team inherits on pull). Coachable: `/task-executor`, `/ba-pitch-analyzer`, `/qa-edge-hunter`; `/spec-evaluator` is not (single judge). Mechanism defects file to `knowledge-base/harness-defects.md` as Betting Table raw ideas, never worker steering.
- Post-fix: `eval --single-pass` → remaining `~` + new feedback → new raw idea.

### Discovered Tasks
Everything discovered funnels into `.shapeup/<slug>/discovery/ledger.md` (Orient, task-executor P3.7, QA); a new invariant triggers `ba --tasks-only --from-discovered` → `TS-INV-NN` Test Surface row ★.

### Architectural Invariants
- **Single judge** — verdict belongs to `spec-evaluator`; QA has no verdict, no score.
- **EVAL exactly once per round** — QA sits after PASS, outside the loop.
- **Ledger = single source of truth** — every discovery flow writes only its own section.
- **QA is a level-up, not a gate** — `--no-qa` skips it; circuit breaker outranks the Hunter.
- **Role separation** — Evaluator grades, task-executor fixes, QA discovers.
- **Hill phase is mechanical ✦** — derived only from T0/T1/seesaw artifacts, never self-reported; the evaluator cites a T0 artifact it re-hashes itself.
- **Envelope port (v1.0)** — every dispatch is WorkOrder in / WorkResult out; shared state has exactly one writer (the ingest step); malformed envelopes are hook-denied. Workers: stateless, craft-only, pipeline-blind.

## Setup & Execution

- Orders/results live in `.shapeup/<slug>/orders|results/`; the envelope schemas ship inside the tech-lead skill.
- The plugin's run entry points need a one-time permission grant — `npx shapeup-sdlc init` writes it into `.claude/settings.json` (`permissions.allow`); without it a headless run stalls at step one.
- Two storage tiers (ADR-0001): COMMITTED `shapeup/<slug>/` (shaping, spec, scopes, wiring-map, project-profile, requirements, hill, `REPORT.md` frozen at L4) vs GITIGNORED `.shapeup/` (board, orders/results, T0/eval/QA artifacts, ledgers, metrics, gate answers).
- Contracts: markdown on disk, JSON on the wire; a single library reads/writes the file form.
- Never hard-code a storage root — generated paths resolve through the shared path resolver.
- The traceability oracle emits `.shapeup/<slug>/trace/report.json` from the spine artifacts.
<!-- HARNESS_END -->
