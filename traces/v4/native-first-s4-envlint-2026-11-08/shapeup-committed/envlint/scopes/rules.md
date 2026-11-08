---
scope_id: rules
topology_type: ICEBERG
use_cases: [UC-02]
covers: [REQ-17, REQ-18, REQ-19, REQ-20, REQ-22, REQ-23, REQ-30, REQ-31]
depends_on: []
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/rules.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope — rules

## Why this slice

The pure schema rules engine (contracts C2 and C3 in the spec's domain model) and its own fixture
suite, fed hand-built pairs in the C1 shape. It imports nothing — not the parser — so it builds
concurrently with `parsing`. No interactive affordance.
