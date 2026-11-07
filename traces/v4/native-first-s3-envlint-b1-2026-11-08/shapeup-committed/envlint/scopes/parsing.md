---
scope_id: parsing
topology_type: ICEBERG
use_cases: [UC-ParseEnv]
covers: [REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-22, REQ-24]
depends_on: []
allowed_file_substrate: [src/parse.mjs, test/parse.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/parse.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: parsing

## Why this slice
The `.env` text → `{pairs, problems}` flow, end to end: the pure parse function and its own unit
suite. It shares no file with `rules`, so the two build at the same time; the only coupling is the
EnvPair shape pinned in the domain model, which this scope produces and `rules` consumes.
