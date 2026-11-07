---
scope_id: cli
topology_type: LAYER_CAKE
use_cases: [UC-LintEnvFile]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-26, REQ-28, REQ-30, REQ-31]
depends_on: [parsing, rules]
allowed_file_substrate: [bin/envlint.mjs, test/cli.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/cli.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: cli

## Why this slice
The CLI is the whole user-facing call chain: argv → read the two files → `parse` → `check` → stdout lines and
an exit code. It is the only module importing both pure modules, so it builds after both are green. Its test
file writes throwaway fixtures and spawns the binary, exiting 0 when every expected exit code (0, 1, 2)
is observed — the error paths are asserted inside the test, never as a bare fixture.
