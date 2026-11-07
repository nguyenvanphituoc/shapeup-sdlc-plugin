---
scope_id: rules
topology_type: ICEBERG
use_cases: [UC-CheckRules]
covers: [REQ-1, REQ-17, REQ-18, REQ-19, REQ-20, REQ-22, REQ-26]
depends_on: []
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/rules.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: rules

## Why this slice
The pairs + schema → findings flow, end to end: `checkSchema`, `check` and their own unit suite.
It consumes the EnvPair shape from the domain model as data, never by importing the parse module,
so it builds in parallel with `parsing`.
