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
status: escalated
final_verdict: FAIL
rounds_used: 2
discovered_rounds: 0
deploy: ~
started_at: 2026-11-07T20:18:28.259Z
closed_at: 2026-11-07T20:39:08.900Z
close_cause: verdict=FAIL rounds=2 breaker=deadline (session USD budget) census=cannot-ship: r2 fix for INV-03 built+T0-green, not yet evaluated
closed_status: escalated
---

# Harness run — envlint

Opened by ``harness init run`` (GATE L0.1). The tech lead is the sole writer from here on.

## Rounds

| Phase | Round | Result | Duration | Notes |
|-------|-------|--------|----------|-------|
| Init  | —     | run opened | — | intake recorded, receipt written |
| Build | 1 | T0 3 green / 0 red | — | round build gate: green |
| Eval | 1 | FAIL | — | 41 PASS / 1 FAIL criteria |
| Build | 2 | T0 1 green / 0 red | — | round build gate: green |

## Decisions log

| Gate | Decision | Source | Note |
|------|----------|--------|------|
| L0 | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. — run opened: intake recorded, receipt  |
| L0 | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L1a | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L1a.5 | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L1b | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L2 | proceed | preset:ci | Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source. |
| L3 | loop | preset:ci | FAIL → fix round r+1, up to the run's max_rounds. The circuit breaker, not this file, ends the loop. |
| H | accept-cut-list | preset:ci | The census's cut list is accepted as proposed; baseline comparison still runs and is still recorded. |
| L4 | ask | preset:ci | Ship sign-off pre-approved. THIS is the one a reviewer should look at first when auditing a headless run. |
