---
scope_id: cli
topology_type: LAYER_CAKE
use_cases: [UC-LintEnvFile]
covers: [REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-22, REQ-23, REQ-25, REQ-26]
depends_on: [parsing, rules]
allowed_file_substrate: [bin/envlint.mjs, test/cli.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --check bin/envlint.mjs", "node --test test/cli.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: cli

## Why this slice
This is the composition root and the only user-facing surface (UC-LintEnvFile): argv → read both files →
parseEnv → checkRules → print → exit code. It builds after `parsing` and `rules` because it imports both.
Its end-to-end test drives the real binary against temp-dir fixtures, and every expected non-zero exit is
asserted inside the test file, which itself exits 0. It declares no affordance manifest: the surface is a
command line, with no interactive elements.
