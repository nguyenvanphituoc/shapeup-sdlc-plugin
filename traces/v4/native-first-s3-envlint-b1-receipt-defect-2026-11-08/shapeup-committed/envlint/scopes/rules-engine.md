---
scope_id: rules-engine
topology_type: ICEBERG
use_cases: [UC-EvaluateRules]
covers: [REQ-5, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-24, REQ-25, REQ-30, REQ-31]
depends_on: []
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs, test/fixtures/rules/**]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --check src/rules.mjs", "node --test test/rules.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: rules-engine

## Why this slice
The whole of UC-EvaluateRules: schema validation, the type/required/enum rules and their tests, verifiable
alone against literal pairs. It shares no file with `parse-env` and imports nothing from it, so the two
build at the same time. Complexity sits in the predicates (ICEBERG); there is no UI.
