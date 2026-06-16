---
id: performance
title: "Performance"
enabled: false          # ⛔ STUB — not run until flipped true or named in --dimensions
weight: 1.0
hard_threshold: count<=0
applies_to:
  variant: [be, web]
  package: any
requires_browser: true
---

# Performance (stub)

Not run in v0.1. Worked example only. Performance is deliberately out of scope now;
this file documents how it would attach later without touching the core.

## Criteria  (TODO — fill before enabling)

```yaml
- id: PERF-API
  statement: "Endpoints touched by the task respond within the budget stated in the spec."
  probe: cmd
  evidence_required: true
  pass_rule: "TODO: measured p95 under the spec's budget for the documented payload."
  source: contract

- id: PERF-WEB
  statement: "The screen the task delivers meets its interaction budget (no obvious jank)."
  probe: ui
  evidence_required: true
  pass_rule: "TODO: drive the screen; primary interaction completes within budget."
  source: scope-summary
```

## Threshold
`count<=0` — every performance criterion must meet its budget (no over-budget items
tolerated). Tune to `count<=N` if soft budgets are acceptable.

## Bug template
```
severity: [critical|major|minor]
criterion: [PERF-API | PERF-WEB]
location: <endpoint | screen>
repro: <load / measurement performed>
expected: <budget from spec>
actual: <measured value>
```
