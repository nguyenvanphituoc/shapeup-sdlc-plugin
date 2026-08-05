---
scope_id: SC-review
topology_type: LAYER_CAKE
tasks: [TASK-003, TASK-004, TASK-008]
allowed_file_substrate: [src/review/**, src/render/**, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js list, node src/cli/main.js search pitch]
business_goal: A user can see what is on the list and find one item in it.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli-list | command | idle, success, empty |
| cli-search | command | idle, success, empty |

## Why this slice

`list` and `search` are the same read-and-render chain with one filter between them, and the
rendering helpers exist only to serve it, so TASK-008 belongs to this flow rather than to a
rendering layer of its own.
