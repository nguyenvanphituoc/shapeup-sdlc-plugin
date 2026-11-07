---
scope_id: parse-env
topology_type: ICEBERG
use_cases: [UC-ParseEnvText]
covers: [REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-24, REQ-25, REQ-27]
depends_on: []
allowed_file_substrate: [src/parse.mjs, test/parse.test.mjs, test/fixtures/parse/**]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --check src/parse.mjs", "node --test test/parse.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: parse-env

## Why this slice
The whole of UC-ParseEnvText: the pure parser and the tests that drive it, verifiable alone. It shares no
file with `rules-engine` and imports nothing from it, so the two build at the same time; the CLI consumes
its `Pair` output. Complexity sits entirely in the module (ICEBERG); there is no UI.
