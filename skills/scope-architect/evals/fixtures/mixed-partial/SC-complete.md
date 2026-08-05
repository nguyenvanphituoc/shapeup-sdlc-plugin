---
scope_id: SC-complete
topology_type: LAYER_CAKE
tasks: [TASK-005, TASK-006, TASK-007]
allowed_file_substrate: [src/complete/**, src/archive/**, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js done 1, node src/cli/main.js archive]
business_goal: A user can retire items.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| SC-complete-cmd | command | idle, success, error |

## Why this slice

A user can retire items.
