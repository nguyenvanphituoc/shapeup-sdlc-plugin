---
scope_id: parsing
topology_type: ICEBERG
use_cases: [UC-ParseEnvText]
covers: [REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-22]
depends_on: []
allowed_file_substrate: [src/parse.mjs, test/parse.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/parse.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: parsing

## Why this slice
The whole call chain of UC-ParseEnvText: `.env` text in, `{pairs, problems}` out, per the parse
contract. It is pure and shares no file with the rules scope, so the two build at the same time; its
own test file is its end-to-end fixture. All complexity is on the logic side (ICEBERG) — it has no
screen of its own; the CLI scope surfaces its output.
