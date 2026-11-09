---
schema_version: 1
scope_id: rules
topology_type: ICEBERG
business_goal: Validate the schema and judge pairs against required / type / enum, as a pure module verifiable alone.
use_cases: [UC-CheckRules]
covers: [REQ-1, REQ-2, REQ-7, REQ-17, REQ-18, REQ-19, REQ-20, REQ-22, REQ-23, REQ-30]
depends_on: []
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: [node --test test/rules.test.mjs]
hill_phase: UPHILL_UNKNOWN
---

# Scope: rules

## Why this slice
Rules is the second pure piece: schema JSON + pairs in → `checkSchema` / `checkRules` → findings out. It
consumes the SD-1 pair shape as data, never `src/parse.mjs` as code, so it does not depend on `parsing` and
its tests build their pairs inline. ICEBERG: all of the logic is in one module.
