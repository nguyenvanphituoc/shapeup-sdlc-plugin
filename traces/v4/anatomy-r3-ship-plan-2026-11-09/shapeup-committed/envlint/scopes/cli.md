---
scope_id: cli
topology_type: LAYER_CAKE
use_cases: [UC-LintEnvFile]
covers: [REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-21, REQ-23, REQ-25, REQ-26]
depends_on: [parsing, rules]
allowed_file_substrate: [bin/envlint.mjs, test/cli.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/cli.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: cli

## Why this slice

The CLI is the user-facing flow end to end: argv → file I/O → parser → rules → stdout and exit code. It is the
composition root named in the project profile and the only piece that touches both pure modules, so it declares
`depends_on: [parsing, rules]` and builds after both are green. Its fixture spawns the real binary over throwaway
files the test writes to a temp directory; the expected exit-1 and exit-2 cases are asserted inside the test file,
which itself exits 0 when the scope is correct. No interactive affordances (CLI only), so the manifest is empty.
