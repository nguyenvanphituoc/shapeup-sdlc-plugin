---
scope_id: parsing
topology_type: ICEBERG
use_cases: [UC-ParseEnvText]
covers: [REQ-5, REQ-6, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-21, REQ-23]
depends_on: []
allowed_file_substrate: [src/parse.mjs, test/parse.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/parse.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: parsing

## Why this slice
The pure parser — `.env` text in, `{pairs, problems}` out — is one complete call chain with its own
fixtures. It imports nothing from the project, so it builds alongside `rules` with no shared file.
Its complexity sits entirely in the domain logic, so it is an ICEBERG.
