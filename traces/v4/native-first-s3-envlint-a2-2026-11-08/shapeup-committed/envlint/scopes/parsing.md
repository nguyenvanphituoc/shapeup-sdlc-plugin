---
scope_id: parsing
topology_type: ICEBERG
use_cases: [UC-ParseEnvText]
covers: [REQ-6, REQ-7, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-21, REQ-24]
depends_on: []
allowed_file_substrate: [src/parse.mjs, test/parse.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/parse.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: parsing

## Why this slice
This is the parser: `.env` text in, `{pairs, problems}` out (UC-ParseEnvText). It is a pure module with
its own test file and shares no file with `rules`, so the two build at the same time. The complexity sits
entirely on the logic side (ICEBERG), and there is no UI. The CLI scope consumes it through the contract's
pairs shape.
