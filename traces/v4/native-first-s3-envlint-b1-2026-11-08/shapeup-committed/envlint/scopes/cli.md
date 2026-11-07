---
scope_id: cli
topology_type: LAYER_CAKE
use_cases: [UC-LintEnvFile]
covers: [REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-21, REQ-23, REQ-25]
depends_on: [parsing, rules]
allowed_file_substrate: [bin/envlint.mjs, test/cli.test.mjs, test/cli-edges.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --check bin/envlint.mjs", "node --test test/cli.test.mjs test/cli-edges.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: cli

## Why this slice
The developer-facing flow: argv → read both files → parse → check → print → exit code. It is the
composition root (the profile's entry point) and the only module that imports both pure pieces, so
it builds after `parsing` and `rules` are green. Its suites drive the real binary over temp-dir
fixtures; the CLI has no interactive elements, so the affordance manifest is empty and the
argv/stdout/exit contract in the UX spec is graded by the `process` oracle instead.
