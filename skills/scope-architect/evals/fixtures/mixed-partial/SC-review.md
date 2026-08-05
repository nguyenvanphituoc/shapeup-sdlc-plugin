---
scope_id: SC-review
topology_type: LAYER_CAKE
tasks: [TASK-003, TASK-004, TASK-008]
allowed_file_substrate: [src/review/**, src/render/**, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js list, node src/cli/main.js search pitch]
business_goal: A user can see the list and find one item in it.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| SC-review-cmd | command | idle, success, error |

## Why this slice

A user can see the list and find one item in it.
