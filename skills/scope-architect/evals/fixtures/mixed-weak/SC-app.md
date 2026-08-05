---
scope_id: SC-app
topology_type: LAYER_CAKE
tasks: [TASK-001, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007, TASK-009, TASK-010]
allowed_file_substrate: [src/**]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js tag 1 work]
business_goal: The application behind the CLI.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| SC-app-cmd | command | idle, success, error |

## Why this slice

The application behind the CLI.
