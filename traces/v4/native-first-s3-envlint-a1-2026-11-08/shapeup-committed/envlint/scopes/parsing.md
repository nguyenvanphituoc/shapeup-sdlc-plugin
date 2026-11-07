---
scope_id: parsing
topology_type: ICEBERG
use_cases: [UC-ParseEnvText]
covers: [REQ-6, REQ-7, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-27, REQ-29]
depends_on: []
allowed_file_substrate: [src/parse.mjs, test/parse.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/parse.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: parsing

## Why this slice
The parser is a pure function — text in, `{pairs, problems}` out — with no call chain of its own beyond the
CLI that consumes it. It imports nothing and shares no file with the rules scope, so it builds alone,
concurrently with rules, verified by its own test file. All its complexity sits below the surface (ICEBERG).
