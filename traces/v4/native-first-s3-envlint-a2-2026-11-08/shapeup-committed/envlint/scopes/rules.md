---
scope_id: rules
topology_type: ICEBERG
use_cases: [UC-EvaluateRules]
covers: [REQ-1, REQ-7, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-27]
depends_on: []
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/rules.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: rules

## Why this slice
This is the rule engine: pairs and a schema in, `{findings, schemaErrors}` out (UC-EvaluateRules). It is
a pure module with its own test file, shares no file with `parsing`, and never imports it. The riskiest
rule, `url` (see the orient spike), lives here.
