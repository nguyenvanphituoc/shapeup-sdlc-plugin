---
schema_version: 1
scope_id: cli
topology_type: LAYER_CAKE
business_goal: A developer or CI runs envlint --schema <s> <envfile> and gets one line per problem and exit 0/1/2.
use_cases: [UC-LintEnvFile]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-21, REQ-24, REQ-25, REQ-27, REQ-28, REQ-29]
depends_on: [parsing, rules]
allowed_file_substrate: [bin/envlint.mjs, test/cli.test.mjs, test/boundaries.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: [node --test test/cli.test.mjs test/boundaries.test.mjs]
hill_phase: UPHILL_UNKNOWN
---

# Scope: cli

## Why this slice
The CLI is the only piece that depends on both others, and the only one a user touches: argv → file reads →
`parseEnv` → `checkSchema`/`checkRules` → stdout + exit code. It is the composition root the wiring map names
(`bin/envlint.mjs`), so it builds after `parsing` and `rules` are green. Its two test files spawn the real
binary against fixtures they write themselves — the pitch's grading constraint — and the boundaries suite
holds the pitch's no-write / no-network / no-color / no-implicit-lookup invariants.
