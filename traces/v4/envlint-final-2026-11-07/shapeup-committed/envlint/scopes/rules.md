---
scope_id: rules
topology_type: ICEBERG
use_cases: [UC-EvaluateRules]
covers: [REQ-1, REQ-17, REQ-18, REQ-19, REQ-20, REQ-22]
depends_on: []
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/rules.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: rules

## Why this slice
The whole call chain of UC-EvaluateRules: schema validation and `lint(pairs, schema)` → findings, per
the rules contract. Pure, imports nothing from parsing (its tests build `pairs` literals), so it builds
alongside the parsing scope. ICEBERG: logic only; the CLI scope surfaces its findings.
