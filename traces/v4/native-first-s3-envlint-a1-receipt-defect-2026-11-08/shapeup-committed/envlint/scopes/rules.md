---
scope_id: rules
topology_type: ICEBERG
use_cases: [UC-CheckEnvAgainstSchema]
covers: [REQ-1, REQ-6, REQ-16, REQ-17, REQ-18, REQ-19, REQ-21, REQ-25]
depends_on: []
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/rules.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: rules

## Why this slice
The pure rule checker — pairs plus schema in, findings out — is one complete call chain with its own
fixtures. It imports nothing from the project and shares no file with `parsing`, so the two build at the
same time. Its complexity sits entirely in the domain logic, so it is an ICEBERG.
