---
scope_id: parsing
topology_type: ICEBERG
use_cases: [UC-ParseEnvText]
covers: [REQ-6, REQ-7, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-22, REQ-24]
depends_on: []
allowed_file_substrate: [src/parse.mjs, test/parse.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/parse.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: parsing

## Why this slice

The parser is one call chain on its own — `.env` text in, `{pairs, problems}` out — and the pitch requires it to be
verifiable alone against its own fixtures, importing nothing from the rules piece. Complexity sits entirely in the
pure function (no UI, no I/O), hence ICEBERG. It shares no file with any other scope, so it builds in the first wave
beside `rules`.
