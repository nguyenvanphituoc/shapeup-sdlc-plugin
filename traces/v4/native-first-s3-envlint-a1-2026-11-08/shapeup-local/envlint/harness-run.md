---
type: harness-run
feature: envlint
spec_folder: shapeup/envlint/spec/
lens: standard
eval_dimensions: auto
max_rounds: 3
attempt_budget: 5
wall_clock_budget_s: ~
auto_level: unattended
gate_answers: ci
lane: full
status: shipped
final_verdict: PASS
rounds_used: 1
discovered_rounds: 0
deploy: ~
started_at: 2026-11-07T20:05:00.269Z
closed_at: 2026-11-07T20:17:42.621Z
close_cause: verdict=PASS rounds=1 qa_findings=3 qa=run
closed_status: shipped
---

# Harness run — envlint

Opened by ``harness init run`` (GATE L0.1). The tech lead is the sole writer from here on.

## Rounds

| Phase | Round | Result | Duration | Notes |
|-------|-------|--------|----------|-------|
| Init  | —     | run opened | — | intake recorded, receipt written |
| Build | 1 | T0 3 green / 0 red | — | round build gate: not run |
| Eval | 1 | PASS | — | 30 PASS / 0 FAIL criteria |

## Decisions log

| Gate | Decision | Source | Note |
|------|----------|--------|------|
| L0 | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. — run opened: intake recorded, receipt  |
| L0 | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L1a | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L1a.5 | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L1b | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L2 | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L3 | loop | preset:ci | verdict PASS — the "loop" answer applies only to a failed round; the run goes on to QA and GATE H |
| QA | run | preset:ci | QA is a level-up, not a gate — it discovers, it cannot block. |
| H | accept-cut-list | preset:ci | The census's cut list is accepted as proposed; baseline comparison still runs and is still recorded. |
| L4 | ship | preset:ci | Ship sign-off pre-approved. THIS is the one a reviewer should look at first when auditing a headless run. |
