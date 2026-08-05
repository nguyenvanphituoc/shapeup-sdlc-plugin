---
scope_id: SC-capture
topology_type: LAYER_CAKE
tasks: [TASK-001, TASK-005, TASK-020]
allowed_file_substrate: [src/capture/**, src/store/**, src/cli/main.js, src/cli/args.js, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js list]
business_goal: A user can capture an entry and have it survive the process exiting.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| sc-capture-cmd | command | idle, success, error |

## Why this slice

A user can capture an entry and have it survive the process exiting.
