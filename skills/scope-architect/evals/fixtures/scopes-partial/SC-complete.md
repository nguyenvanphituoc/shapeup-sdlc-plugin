---
scope_id: SC-complete
topology_type: LAYER_CAKE
tasks: [TASK-005, TASK-006, TASK-007]
allowed_file_substrate: [src/complete/**, src/archive/**, src/cli/dispatch.js]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js done 2-4, node src/cli/main.js rm 1 3, node src/cli/main.js archive]
business_goal: A user can retire items — one at a time, in batches, or all the finished ones at once.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli-done | command | idle, success, error |
| cli-rm | command | idle, success, error |
| cli-archive | command | idle, success |

## Why this slice

`done`, `rm` and `archive` share the selector resolution and the same "resolve first, write
once" rule, so they are one chain. The scope writes the `done`, `rm` and `archive` entries into the
command table itself.