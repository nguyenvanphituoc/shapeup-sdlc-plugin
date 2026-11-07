---
scope_id: rules
topology_type: ICEBERG
use_cases: [UC-CheckRules]
covers: [REQ-7, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-27, REQ-32, REQ-33]
depends_on: []
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/rules.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: rules

## Why this slice
The rules check is a pure function — pairs and a schema in, findings out. It must not import the parser, and
its tests build pairs by hand, so it shares nothing with the parsing scope and builds at the same time.
All its complexity sits below the surface (ICEBERG).
