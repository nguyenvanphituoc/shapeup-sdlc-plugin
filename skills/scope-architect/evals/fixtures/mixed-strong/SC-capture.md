---
scope_id: SC-capture
topology_type: LAYER_CAKE
tasks: [TASK-001, TASK-002]
allowed_file_substrate: [src/capture/**, src/store/**, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js add "write the pitch"]
business_goal: A user can capture a todo that survives the process exiting.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| SC-capture-cmd | command | idle, success, error |

## Why this slice

A user can capture a todo that survives the process exiting.
