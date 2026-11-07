---
scope_id: cli
topology_type: LAYER_CAKE
use_cases: [UC-LintEnvFile]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-20, REQ-22, REQ-23, REQ-24, REQ-25]
depends_on: [parsing, rules]
allowed_file_substrate: [bin/envlint.mjs, test/cli.test.mjs, test/integration.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/cli.test.mjs test/integration.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: cli

## Why this slice
The composition root: argv → file reads → `parse` → `check` → printed findings and an exit code. It is the
only scope that touches both pure modules, so it builds after `parsing` and `rules` are green. It owns the
entry point alone, so nothing else serialises behind it. Expected non-zero exits are asserted inside the two
test files, which themselves exit 0 when the scope is correct.
