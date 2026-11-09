---
schema_version: 1
scope_id: parsing
topology_type: ICEBERG
business_goal: Turn .env text into {pairs, problems} with 1-based line numbers, as a pure module verifiable alone.
use_cases: [UC-ParseEnvText]
covers: [REQ-6, REQ-7, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-22, REQ-23, REQ-26]
depends_on: []
allowed_file_substrate: [src/parse.mjs, test/parse.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: [node --test test/parse.test.mjs]
hill_phase: UPHILL_UNKNOWN
---

# Scope: parsing

## Why this slice
The pitch makes Parsing a piece that shares nothing with Rules and is verifiable alone against its own
fixtures, so it is its own call chain: CLI text in → `parseEnv` → pairs out. All of the complexity sits in one
pure module (ICEBERG); its test file is the fixture. It imports nothing, so it builds in parallel with `rules`.
The pair shape `{key, value, line}` (spec decision SD-1) is the only thing `rules` and `cli` rely on.
