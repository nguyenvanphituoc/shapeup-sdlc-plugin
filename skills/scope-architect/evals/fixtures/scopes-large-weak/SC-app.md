---
scope_id: SC-app
topology_type: LAYER_CAKE
tasks: [TASK-005, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011, TASK-012, TASK-013, TASK-014, TASK-015, TASK-016, TASK-017, TASK-018, TASK-019, TASK-020]
allowed_file_substrate: [src/**]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js list]
business_goal: The application behind the CLI.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| sc-app-cmd | command | idle, success, error |

## Why this slice

The application behind the CLI.
