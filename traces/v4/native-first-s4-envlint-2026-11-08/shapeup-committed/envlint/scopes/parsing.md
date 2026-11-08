---
scope_id: parsing
topology_type: ICEBERG
use_cases: [UC-01]
covers: [REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-22, REQ-23, REQ-26]
depends_on: []
allowed_file_substrate: [src/parse.mjs, test/parse.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/parse.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope — parsing

## Why this slice

The pure `.env` parser (contract C1 in the spec's domain model) and its own fixture suite. It imports
nothing and is imported only by the CLI, so it builds concurrently with `rules` and shares no file with
it. No interactive affordance: the terminal surface belongs to the `cli` scope.
