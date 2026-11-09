---
scope_id: rules
topology_type: ICEBERG
use_cases: [UC-CheckRules]
covers: [REQ-1, REQ-7, REQ-17, REQ-18, REQ-19, REQ-20, REQ-22, REQ-27, REQ-28]
depends_on: []
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/rules.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: rules

## Why this slice

The rules checker is the second independent call chain — pairs and a schema in, findings out — verifiable alone
and importing nothing from the parser. Pure logic with no UI or I/O, hence ICEBERG. Disjoint from `parsing`, so the
two build at the same time.
