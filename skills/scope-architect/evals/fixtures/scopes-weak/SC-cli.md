---
scope_id: SC-cli
topology_type: LAYER_CAKE
tasks: []
allowed_file_substrate: [src/cli/**]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: [node src/cli/main.js list]
business_goal: The command-line surface.
---

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli-entry | command | idle, error |

## Why this slice

Everything the user types goes through the CLI layer, so the CLI layer is its own scope.
