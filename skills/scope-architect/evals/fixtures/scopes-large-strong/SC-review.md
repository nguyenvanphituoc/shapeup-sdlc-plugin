---
scope_id: SC-review
topology_type: LAYER_CAKE
tasks: [TASK-002, TASK-006, TASK-007]
allowed_file_substrate: [src/review/**, src/render/lines.js, src/render/errors.js, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js list]
business_goal: A user can see the log and find one entry in it.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| sc-review-cmd | command | idle, success, error |

## Why this slice

A user can see the log and find one entry in it.
