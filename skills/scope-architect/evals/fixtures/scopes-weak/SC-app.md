---
scope_id: SC-app
topology_type: LAYER_CAKE
tasks: [TASK-001, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007]
allowed_file_substrate: [src/**]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js add x]
business_goal: The application behind the CLI.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli-commands | command | idle, success, error |

## Why this slice

The commands all live under `src/`, so one scope covers the application and the CLI scope covers
the surface. The store and the renderers are infrastructure rather than feature work, so their
tasks are not scoped.
