---
type: scope-summary
feature: one-page-site
generated_at: 2026-11-07
total_tasks: 6
total_estimated_hours: 8
packages_touched: ["."]
critical_path_length: 5
external_blockers: []
---

# Feature Scope Summary: One-page site

## At a Glance

| | |
|---|---|
| Total tasks | 6 |
| Estimated effort | 8h (~1 day) |
| Packages touched | 1 |
| Critical path depth | 5 steps |
| External blockers | 0 |

## Critical Path

**Critical path estimate:** 7h total, 5 steps (load/validate, render, edge cases, write, tests). The starter content file runs alongside.

## Package Distribution

| Package | Tasks | Est. Hours | % of effort |
|---------|-------|------------|-------------|
| . (repo root) | 6 | 8h | 100% |

## Parallel Opportunities

| Group | Use cases | Tasks | Can start after |
|-------|-----------|-------|-----------------|
| Group A | UC-RejectInvalidContent | 1 | nothing |
| Group B | UC-BuildSite | 4 | Group A |
| Group C | UC-BuildSite, UC-RejectInvalidContent | 1 | Group B |

## External Blockers

None. Node built-ins only; no environment variables beyond the optional `CONTENT_FILE` and `OUT_DIR`.

## Risks (from Pitch)

| Risk | Impact | Mitigation | Related UC |
|------|--------|------------|-----------|
| Failure leaves a partial or stale file | high | validate and render before any write | [[usecases/UC-RejectInvalidContent]] |
| `javascript:` url breaks "no JavaScript" | med | http(s) allowlist | [[usecases/UC-BuildSite]] |
| Wrong-shaped valid JSON | med | shape validation | [[usecases/UC-RejectInvalidContent]] |

## Execution Recommendation

Appetite is a single build round and the estimate (8h) fits; no overflow to hammer.
