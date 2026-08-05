---
scope_id: SC-organise
topology_type: LAYER_CAKE
tasks: [TASK-011, TASK-012, TASK-013, TASK-014, TASK-015]
allowed_file_substrate: [src/tags/**, src/schedule/**, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js list]
business_goal: A user can organise entries by tag and by date.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| sc-organise-cmd | command | idle, success, error |

## Why this slice

A user can organise entries by tag and by date.
