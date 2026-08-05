---
scope_id: SC-cli
topology_type: LAYER_CAKE
tasks: []
allowed_file_substrate: [src/cli/**]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js --help]
business_goal: The command-line surface.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| SC-cli-cmd | command | idle, success, error |

## Why this slice

The command-line surface.
