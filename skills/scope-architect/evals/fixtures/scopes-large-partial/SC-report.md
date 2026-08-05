---
scope_id: SC-report
topology_type: LAYER_CAKE
tasks: [TASK-016, TASK-018, TASK-019]
allowed_file_substrate: [src/report/**, src/transfer/**, src/render/table.js, src/cli/dispatch.js]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js list]
business_goal: A user can see what the log adds up to and move it somewhere else.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| sc-report-cmd | command | idle, success, error |

## Why this slice

A user can see what the log adds up to and move it somewhere else.
