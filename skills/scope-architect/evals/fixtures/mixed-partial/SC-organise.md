---
scope_id: SC-organise
topology_type: LAYER_CAKE
tasks: [TASK-009, TASK-010]
allowed_file_substrate: [src/tags/**, src/transfer/**, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js tag 1 work, node src/cli/main.js export out.json]
business_goal: A user can tag items and take the log elsewhere.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| SC-organise-cmd | command | idle, success, error |

## Why this slice

A user can tag items and take the log elsewhere.
