---
scope_id: cli
topology_type: LAYER_CAKE
use_cases: [UC-LintEnvFile]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-23, REQ-26, REQ-28, REQ-29, REQ-30]
depends_on: [parse-env, rules-engine]
allowed_file_substrate: [bin/envlint.mjs, package.json, test/cli.test.mjs, test/fixtures/cli/**]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --check bin/envlint.mjs", "node --test test/cli.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: cli

## Why this slice
The user-facing flow end to end: argument handling, reading the two files, composing `parse` and
`evaluate`, printing and exit codes, plus the spawned-process tests that drive it through fixtures the test
writes. It is the sole owner of the entry point and of `package.json`, so no other scope ever serialises on
them. It builds after `parse-env` and `rules-engine`, whose modules it imports.
