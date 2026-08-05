---
scope_id: SC-capture
topology_type: LAYER_CAKE
tasks: [TASK-001, TASK-002]
allowed_file_substrate: [src/capture/**, src/store/**, src/cli/dispatch.js]
shared_substrate: [src/cli/dispatch.js]
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js add "write the pitch"]
business_goal: A user can capture a todo and have it survive the process exiting.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli-add | command | idle, success, error |

## Why this slice

One call chain: the `add` command entry, the validation it runs, and the store it writes. The
store lives here because capture is the flow that creates items; every other flow only reads
through it. `src/cli/dispatch.js` is the seam all three scopes attach to, so it is declared shared.
