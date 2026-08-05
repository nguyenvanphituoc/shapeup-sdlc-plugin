---
scope_id: SC-complete
topology_type: LAYER_CAKE
tasks: [TASK-004, TASK-008, TASK-009, TASK-010]
allowed_file_substrate: [src/complete/**, src/select/**, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js list]
business_goal: A user can retire entries and take it back.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| sc-complete-cmd | command | idle, success, error |

## Why this slice

A user can retire entries and take it back.
